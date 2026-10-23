// Issue #103 — Read-only / non-publishing itch.io HTML5 Alpha candidate gate.
//
// Strictly honors ALL owner constraints:
//   - NEVER deploys or publishes to Cloudflare Pages or itch.io
//   - NEVER creates any .zip archive
//   - Serves dist-itch-html5/ locally under a parent host page embedding
//     <iframe src="/html/apex/index.html"> so every relative URL resolution rule
//     (./ vs ../ under Gold's <base href="/html/apex/gold/">) is exercised
//     against real HTTP 404 boundaries and zero-external-network isolation.
//   - Proves on the ACTUAL git HEAD SHA across Phone (844x390 touch + 390x844
//     portrait) and Desktop (1440x900 mouse/keyboard):
//       1. Guest-only boundary (350 starter AC, PLAY INSTANTLY — NO SIGN-IN,
//          0 password/Google/email controls, 0 external network requests)
//       2. Real Start -> Mode (VS BOT) -> Fighter Select -> Live Match ->
//          legitimate organic P1 KO win (zero HP mutation / zero mock state) ->
//          Result Gold (/html/apex/result-gold/index.html) -> native touch swipe
//          & tap / mouse click Continue -> Return to Fighter Select
//       3. Exact +200 AC wallet reward (350 -> 550 AC), strict one-time
//          idempotency (+0 AC on duplicate claim & reload), and +0 AC on
//          invalid / non-battle / BOT feat paths
//       4. Zero uncaught page errors, zero blocking console errors, zero HTTP >=400.

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ITCH_DIR = path.join(ROOT, 'dist-itch-html5');
const OUT_DIR = path.resolve(process.env.ITCH_EVIDENCE_DIR || path.join(ROOT, 'evidence/issue-103-final-alpha-gate-20261023/itch-nested'));
fs.mkdirSync(OUT_DIR, { recursive: true });

async function loadPuppeteer() {
  try {
    const mod = await import('puppeteer-core');
    return mod.default ?? mod;
  } catch {
    const probeReq = createRequire(new URL('./probe/package.json', import.meta.url));
    const mod = await import(probeReq.resolve('puppeteer-core'));
    return mod.default ?? mod;
  }
}

async function resolveChromeExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const probeReq = createRequire(new URL('./probe/package.json', import.meta.url));
  const chromium = (await import(probeReq.resolve('@sparticuz/chromium'))).default;
  return chromium.executablePath();
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const expectedSha = (process.env.EXPECTED_GIT_SHA
  || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })).trim();

assert.ok(fs.existsSync(path.join(ITCH_DIR, 'index.html')), 'dist-itch-html5/index.html missing — run packItchPortable.mjs first');
const builtSha = fs.readFileSync(path.join(ITCH_DIR, 'ITCH_GUEST_BUILD_SHA.txt'), 'utf8').trim();
assert.equal(builtSha, expectedSha, `ITCH_GUEST_BUILD_SHA.txt (${builtSha}) must match exact HEAD (${expectedSha})`);

// Hard prohibition guard: ZERO itch .zip packages created before owner approval.
const rootEntries = fs.readdirSync(ROOT);
const forbiddenItchZips = rootEntries.filter((name) => /itch.*\.zip$/i.test(name));
assert.deepEqual(forbiddenItchZips, [], `Forbidden itch ZIP detected before owner approval: ${forbiddenItchZips.join(', ')}`);

const serverRequests = [];
const serverErrors = [];

const wrapperHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Local itch.io Nested /html/apex/ Candidate Harness</title>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #07090d; }
    iframe { border: 0; width: 100vw; height: 100vh; display: block; }
  </style>
</head>
<body>
  <iframe id="itch-game-drop" src="/html/apex/index.html" allow="autoplay; fullscreen" allowfullscreen></iframe>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
  const pathname = decodeURIComponent(urlObj.pathname);
  if (pathname === '/' || pathname === '/index.html') {
    serverRequests.push({ status: 200, path: pathname });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(wrapperHtml);
    return;
  }
  if (pathname === '/favicon.ico') {
    const fav = path.join(ITCH_DIR, 'favicon.ico');
    if (fs.existsSync(fav)) {
      res.writeHead(200, { 'Content-Type': 'image/x-icon' });
      res.end(fs.readFileSync(fav));
      return;
    }
  }
  if (!pathname.startsWith('/html/apex/')) {
    // Any escaped root-relative URL (/assets/..., /game/..., /gold/..., /result-gold/...)
    // fails loudly with HTTP 404, matching real itch.io CDN isolation!
    serverErrors.push(`404 ESCAPED_ROOT_PATH ${pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Escaped nested root: ${pathname}`);
    return;
  }
  let subPath = pathname.slice('/html/apex/'.length);
  if (subPath === '' || subPath.endsWith('/')) subPath += 'index.html';
  const targetFile = path.resolve(ITCH_DIR, subPath);
  if (!targetFile.startsWith(ITCH_DIR + path.sep) || !fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
    serverErrors.push(`404 MISSING_NESTED_ASSET ${pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Not found: ${pathname}`);
    return;
  }
  const ext = path.extname(targetFile).toLowerCase();
  serverRequests.push({ status: 200, path: pathname });
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(targetFile).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const hostUrl = `http://127.0.0.1:${port}`;
console.log(`[ITCH NESTED HARNESS] Local temporary nested iframe server active at ${hostUrl}/ -> /html/apex/index.html (SHA=${expectedSha})`);

const CHROME = await resolveChromeExecutable();
const puppeteer = await loadPuppeteer();

const subGateReceipts = {};
async function runSubGate(label, scriptRel, extraEnv = {}) {
  const res = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, scriptRel)], {
      cwd: ROOT,
      env: {
        ...process.env,
        CHROME_PATH: CHROME,
        ITCH_NESTED_URL: `${hostUrl}/`,
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  subGateReceipts[label] = {
    command: `node ${scriptRel}`,
    exitCode: res.status,
    stdoutTail: (res.stdout || '').trim().split('\n').slice(-8),
    stderrTail: (res.stderr || '').trim().split('\n').filter(Boolean).slice(-5),
  };
  if (res.status !== 0) {
    console.error(`[FAIL ${label}]\nSTDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}`);
    throw new Error(`${label} failed with exit code ${res.status}`);
  }
  console.log(`[PASS] ${label} (exit 0)`);
}

async function runNestedFullGameplayJourney(browser, vp) {
  let attempt = 0;
  const nonWinAttempts = [];

  while (attempt < 10) {
    attempt += 1;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const badHttp = [];
    const externalUrls = [];

    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 400));
    });
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return;
      try {
        const parsed = new URL(url);
        if (parsed.origin !== hostUrl) externalUrls.push(url);
      } catch { /* ignore non-URL */ }
    });
    page.on('response', (resp) => {
      if (resp.status() >= 400) badHttp.push(`${resp.status()} ${resp.url()}`);
    });

    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      isMobile: vp.touch,
      hasTouch: vp.touch,
    });

    const tapOrClick = async (x, y) => {
      if (vp.touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await sleep(180);
    };

    const clickInFrame = async (frame, selector) => {
      await frame.waitForSelector(selector, { visible: true, timeout: 45000 });
      const rect = await frame.$eval(selector, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
      });
      assert.ok(rect.width > 4 && rect.height > 4, `${vp.id}: ${selector} has valid hitbox`);
      // Outer #itch-game-drop iframe fills 100vw x 100vh from (0,0)
      await tapOrClick(rect.x, rect.y);
      return rect;
    };

    await page.goto(`${hostUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const shaResp = await page.evaluate(async () => {
      const r = await fetch('/html/apex/ITCH_GUEST_BUILD_SHA.txt');
      return { status: r.status, text: (await r.text()).trim() };
    });
    assert.equal(shaResp.status, 200);
    assert.equal(shaResp.text, expectedSha, `${vp.id}: nested SHA endpoint matches exact HEAD`);

    await page.waitForFunction(
      () => [...document.querySelectorAll('iframe')].some((f) => f.contentDocument?.querySelector('#apex-boot-start')),
      { timeout: 45000 }
    );
    const getNestedGameFrame = () => page.frames().find(
      (f) => f.url().includes('/html/apex/') && !f.url().includes('/gold/') && !f.url().includes('/result-gold/')
    );
    let gameFrame = getNestedGameFrame();
    assert.ok(gameFrame, `${vp.id}: nested /html/apex/index.html frame mounted`);

    await page.screenshot({ path: path.join(OUT_DIR, `nested-${vp.id}-01-boot.png`) });
    await clickInFrame(gameFrame, '#apex-boot-start');

    await gameFrame.waitForSelector('#freeBattle', { visible: true, timeout: 60000 });
    await gameFrame.waitForFunction(() => document.body?.dataset?.apexSceneTransition === 'DONE', { timeout: 60000 });

    // 1. Verify Guest-first wallet & no-auth Account Center inside nested /html/apex/ iframe
    const guestBefore = await gameFrame.evaluate(() => ({
      credits: window.APEX_ARSENAL_META?.credits?.(),
      ownedFighters: window.APEX_ARSENAL_META?.getState?.()?.ownedFighters || [],
      baseURI: document.baseURI,
      frameHref: window.location.href,
    }));
    assert.equal(guestBefore.credits, 350, `${vp.id}: fresh Guest starts at exact 350 AC`);
    assert.deepEqual(guestBefore.ownedFighters, ['ROBOT'], `${vp.id}: fresh Guest owns ROBOT only`);
    assert.match(guestBefore.baseURI, /\/html\/apex\/gold\/$/, `${vp.id}: Gold post-mount <base> points to /html/apex/gold/`);

    await clickInFrame(gameFrame, '#apexAccountOpen');
    await gameFrame.waitForSelector('[role="dialog"]', { visible: true, timeout: 15000 });
    const accountAudit = await gameFrame.$eval('[role="dialog"]', (dlg) => ({
      text: dlg.innerText.replace(/\s+/g, ' ').trim(),
      passwordInputs: dlg.querySelectorAll('input[type="password"]').length,
      emailInputs: dlg.querySelectorAll('input[type="email"]').length,
      oauthButtons: [...dlg.querySelectorAll('button, a')].filter((b) => /google|sign in with|magic link|otp/i.test(b.textContent || '')).length,
    }));
    assert.match(accountAudit.text, /PLAY INSTANTLY — NO SIGN-IN/);
    assert.match(accountAudit.text, /200 AC/);
    assert.match(accountAudit.text, /350 AC/);
    assert.equal(accountAudit.passwordInputs, 0, `${vp.id}: 0 password inputs in Guest release`);
    assert.equal(accountAudit.emailInputs, 0, `${vp.id}: 0 email inputs in Guest release`);
    assert.equal(accountAudit.oauthButtons, 0, `${vp.id}: 0 Google/email auth buttons in Guest release`);
    await page.screenshot({ path: path.join(OUT_DIR, `nested-${vp.id}-02-guest-account-modal.png`) });
    await page.keyboard.press('Escape');
    await gameFrame.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10000 });

    // 2. Drive real Mode Select -> VS BOT -> Fighter Select -> Lock In -> Live Battle
    await clickInFrame(gameFrame, '#freeBattle');
    await gameFrame.waitForFunction(
      () => document.querySelector('#stage')?.classList.contains('screen-mode')
        && document.body?.dataset?.apexSceneTransition === 'DONE',
      { timeout: 30000 }
    );
    await clickInFrame(gameFrame, '.modeCard[data-mode="bot"]');
    await gameFrame.waitForFunction(
      () => document.querySelector('#stage')?.classList.contains('screen-fighter')
        && document.body?.dataset?.apexSceneTransition === 'DONE',
      { timeout: 30000 }
    );
    await sleep(350);
    await page.screenshot({ path: path.join(OUT_DIR, `nested-${vp.id}-03-fighter-select.png`) });

    await clickInFrame(gameFrame, '#lockIn');
    await gameFrame.waitForSelector('.fighter-active-p2', { timeout: 30000 });
    await clickInFrame(gameFrame, '#lockIn');
    await gameFrame.waitForSelector('#battleHudHost.is-open #p1Side .skill[data-i="0"]', { timeout: 60000 });
    await gameFrame.waitForFunction(() => window.APEX_ARSENAL?.state?.active === true && !!window.fighters?.[0], { timeout: 30000 });
    await sleep(600);
    await page.screenshot({ path: path.join(OUT_DIR, `nested-${vp.id}-04-live-battle.png`) });

    // Play legitimately using ONLY public player skill inputs (Weapon Dash A1 + Virtual Armor A2)
    // polled at 500ms so P1 decisively out-trades BOT with zero per-frame rAF overhead.
    // ZERO state tampering, ZERO HP assignment, ZERO mock ledger!
    let matchSnapshotBeforeResult = null;
    const koDeadline = Date.now() + 420000;
    while (Date.now() < koDeadline) {
      const step = await gameFrame.evaluate(() => {
        if (document.querySelector('#apex-real-match-result')) return { done: true, snap: null };
        const hr = window.APEX_HERO_REWORK;
        const hud = window.APEX_GOLD_HUD || window.APEX_GOLD_BRIDGE;
        const p1 = window.fighters?.[0];
        if (hr && hud && p1) {
          if (hr.observeAbilityCastability?.(p1, 'A1')?.castable) {
            hud.pressSkill?.(0, 0, { source: 'test-player' });
          }
          if (hr.observeAbilityCastability?.(p1, 'A2')?.castable) {
            hud.pressSkill?.(0, 1, { source: 'test-player' });
          }
        }
        const st = window.APEX_ARSENAL?.state;
        return {
          done: false,
          snap: st ? {
            winnerSide: st.winnerSide || null,
            battleMode: st.battleMode || null,
            roundsWon: st.roundsWon ? [...st.roundsWon] : null,
          } : null,
        };
      });
      if (step.done) break;
      matchSnapshotBeforeResult = step.snap;
      await sleep(500);
    }

    await gameFrame.waitForSelector('#apex-real-match-result', { visible: true, timeout: 20000 });
    const postMatchInfo = await gameFrame.evaluate(() => {
      const st = window.APEX_ARSENAL?.state;
      const metaState = window.APEX_ARSENAL_META?.getState?.();
      return {
        credits: window.APEX_ARSENAL_META?.credits?.(),
        winnerSide: st?.winnerSide || null,
        battleMode: st?.battleMode || null,
        claimedMatchIds: [...(metaState?.claimedMatchIds || [])],
      };
    });

    if (postMatchInfo.winnerSide !== 'P1') {
      // Even a rare organic BOT win proves the real loss reward law (350 + 25 = 375 AC),
      // then we rerun a fresh guest session so every viewport ALSO proves a genuine P1 +200 AC win!
      assert.equal(postMatchInfo.credits, 375, `${vp.id}: legitimate BOT loss awards exact +25 AC (375 AC)`);
      nonWinAttempts.push({ attempt, postMatchInfo, matchSnapshotBeforeResult });
      console.log(`[Attempt ${attempt}] ${vp.id}: legitimate BOT loss verified (+25 AC => 375 AC), retrying fresh session for P1 win proof...`);
      await context.close();
      continue;
    }

    // 3. Prove EXACT +200 AC for legitimate BOT win (350 -> 550 AC), strict one-time idempotency, and invalid/bot rejection!
    assert.equal(postMatchInfo.credits, 550, `${vp.id}: legitimate BOT win must award exact +200 AC (350 -> 550, got ${postMatchInfo.credits})`);
    assert.equal(postMatchInfo.claimedMatchIds.length, 1, `${vp.id}: exactly 1 match claim recorded`);

    const idempotencyAndAbuseAudit = await gameFrame.evaluate(() => {
      const liveState = window.APEX_ARSENAL?.state;
      const before = window.APEX_ARSENAL_META.credits();
      const masteryBefore = JSON.stringify(window.APEX_ARSENAL_META.getMastery?.() || {});

      // Replay exact same legitimate match state twice
      const dup1 = window.APEX_ARSENAL_META.awardBattleResult?.('P1', liveState);
      const dup2 = window.APEX_ARSENAL_META.awardBattleResult?.('P1', liveState);
      const afterDuplicate = window.APEX_ARSENAL_META.credits();

      // Attempt invalid / lab / null / bot credit paths
      const invalidNull = window.APEX_ARSENAL_META.awardBattleResult?.('P1', null);
      const invalidLab = window.APEX_ARSENAL_META.awardBattleResult?.('P1', { battleMode: 'LAB', matchId: 'fake-lab-claim', winnerSide: 'P1' });
      const invalidUnknown = window.APEX_ARSENAL_META.awardBattleResult?.('P1', { battleMode: 'INVALID', matchId: 'fake-invalid-claim', winnerSide: 'P1' });
      window.dispatchEvent(new CustomEvent('apex:mastery-unlocked', {
        detail: { unlocks: [{ achievementId: 'first-blood', heroId: 'NEWBOT', ownerSide: 'P2', ownerKind: 'bot', walletEligible: false, battleMode: 'BOT', value: 1, at: Date.now() }] },
      }));
      const afterInvalidAndBot = window.APEX_ARSENAL_META.credits();
      const masteryAfterBot = JSON.stringify(window.APEX_ARSENAL_META.getMastery?.() || {});

      return {
        before,
        afterDuplicate,
        afterInvalidAndBot,
        masteryUnchangedOnBotEvent: masteryBefore === masteryAfterBot,
        dup1,
        dup2,
        invalidNull,
        invalidLab,
        invalidUnknown,
      };
    });

    assert.equal(idempotencyAndAbuseAudit.before, 550);
    assert.equal(idempotencyAndAbuseAudit.afterDuplicate, 550, `${vp.id}: duplicate awardBattleResult must pay +0 AC`);
    assert.equal(idempotencyAndAbuseAudit.afterInvalidAndBot, 550, `${vp.id}: invalid/LAB/BOT paths must pay +0 AC`);
    assert.equal(idempotencyAndAbuseAudit.masteryUnchangedOnBotEvent, true, `${vp.id}: BOT event must not mutate player mastery`);

    // 4. Inspect nested /html/apex/result-gold/index.html & exit cleanly with native touch/mouse input
    const resultFrame = page.frames().find((f) => f.url().includes('/html/apex/result-gold/'));
    assert.ok(resultFrame, `${vp.id}: nested Result Gold iframe mounted from /html/apex/result-gold/`);
    await resultFrame.waitForSelector('.ac-root .ac-run', { visible: true, timeout: 20000 });
    await sleep(500);
    await resultFrame.evaluate(() => {
      const skipBtn = [...document.querySelectorAll('button')].find((b) => /skip|bỏ qua/i.test(b.textContent || ''));
      if (skipBtn) skipBtn.click();
    });
    await resultFrame.waitForSelector('.ac-run.is-done', { timeout: 15000 });
    await sleep(400);
    await page.screenshot({ path: path.join(OUT_DIR, `nested-${vp.id}-05-result-gold.png`) });

    if (vp.touch && vp.width >= 760 && vp.height <= 449) {
      const sx = Math.round(vp.width * 0.5);
      const startY = Math.round(vp.height * 0.82);
      const endY = Math.round(vp.height * 0.22);
      await page.touchscreen.touchStart(sx, startY);
      for (let i = 1; i <= 8; i += 1) {
        await page.touchscreen.touchMove(sx, Math.round(startY + ((endY - startY) * i) / 8));
        await sleep(35);
      }
      await page.touchscreen.touchEnd();
      await sleep(250);
    }

    const continueHandle = await resultFrame.evaluateHandle(() => {
      const btns = [...document.querySelectorAll('main.ac-stage button')];
      return btns.find((b) => /tiếp tục|continue|quay lại|return/i.test(b.textContent || '')) || btns[btns.length - 1] || null;
    });
    const continueBtn = continueHandle.asElement();
    assert.ok(continueBtn, `${vp.id}: nested Result Gold Continue button exists`);
    await continueBtn.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
    await sleep(180);
    const continueBox = await continueBtn.boundingBox();
    assert.ok(continueBox && continueBox.width >= 44 && continueBox.height >= 44, `${vp.id}: Continue >=44x44px`);
    await page.screenshot({ path: path.join(OUT_DIR, `nested-${vp.id}-05b-result-continue-reachable.png`) });

    await tapOrClick(continueBox.x + continueBox.width / 2, continueBox.y + continueBox.height / 2);
    await continueHandle.dispose();

    await gameFrame.waitForFunction(
      () => !document.querySelector('#apex-real-match-result')
        && !document.querySelector('#battleHudHost')?.classList.contains('is-open')
        && document.querySelector('#stage')?.classList.contains('screen-fighter'),
      { timeout: 25000 }
    );
    await sleep(350);
    await page.screenshot({ path: path.join(OUT_DIR, `nested-${vp.id}-06-returned-fighter-select.png`) });

    // 5. Reload nested host page -> prove 550 AC persists with zero refill and zero duplicate award
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(
      () => [...document.querySelectorAll('iframe')].some((f) => f.contentDocument?.querySelector('#apex-boot-start')),
      { timeout: 45000 }
    );
    gameFrame = getNestedGameFrame();
    await clickInFrame(gameFrame, '#apex-boot-start');
    await gameFrame.waitForSelector('#freeBattle', { visible: true, timeout: 60000 });
    const persistedAfterReload = await gameFrame.evaluate(() => ({
      credits: window.APEX_ARSENAL_META?.credits?.(),
      claimedMatchIds: [...(window.APEX_ARSENAL_META?.getState?.()?.claimedMatchIds || [])],
    }));
    assert.equal(persistedAfterReload.credits, 550, `${vp.id}: reload preserves exact 550 AC without refill or loss`);
    assert.equal(persistedAfterReload.claimedMatchIds.length, 1, `${vp.id}: claimedMatchIds persists across reload`);

    const blockingConsoleErrors = consoleErrors.filter((s) => /Error:|Uncaught|Cosmetic asset|failed to fetch/i.test(s));
    assert.deepEqual(pageErrors, [], `${vp.id}: zero pageerror`);
    assert.deepEqual(blockingConsoleErrors, [], `${vp.id}: zero blocking console.error (raw=${JSON.stringify(consoleErrors)})`);
    assert.deepEqual(badHttp, [], `${vp.id}: zero HTTP >=400 inside nested /html/apex/`);
    assert.deepEqual(externalUrls, [], `${vp.id}: zero external host network requests`);

    await context.close();
    console.log(`[PASS] Nested /html/apex/ full journey (${vp.id}) — 350 -> 550 AC (+200 AC), idempotent, 0 errors, Continue returned cleanly`);
    return {
      viewport: vp,
      attemptsUsed: attempt,
      nonWinAttempts,
      guestBefore,
      accountAudit,
      postMatchInfo,
      idempotencyAndAbuseAudit,
      resultContinueBox: continueBox,
      persistedAfterReload,
      pageErrors,
      blockingConsoleErrors,
      rawConsoleErrors: consoleErrors,
      badHttp,
      externalUrls,
    };
  }
  throw new Error(`${vp.id}: P1 did not achieve a clean win within 10 legitimate attempts`);
}

try {
  // 1. Existing official itch nested gates against local /html/apex/ server
  await runSubGate('testItchNestedChrome', 'tools/testItchNestedChrome.mjs');
  await runSubGate('testRa1NestedItchHostingBrowser (390x844 portrait)', 'tools/testRa1NestedItchHostingBrowser.mjs', {
    APEX_EVIDENCE_DIR: path.join(OUT_DIR, 'ra1-nested-390x844'),
  });

  // 2. Full Start -> Selection -> Live Match -> +200 AC Win -> Idempotency -> Result -> Return -> Reload persistence
  //    across representative Phone Touch (844x390) and Desktop (1440x900)
  const BROWSER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required',
  ];

  const journeys = {};
  for (const vp of [
    { id: '844x390-phone-touch', width: 844, height: 390, touch: true },
    { id: '1440x900-desktop', width: 1440, height: 900, touch: false },
  ]) {
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: BROWSER_ARGS });
    try {
      journeys[vp.id] = await runNestedFullGameplayJourney(browser, vp);
    } finally {
      await browser.close();
    }
  }

  assert.deepEqual(serverErrors, [], `Zero escaped/missing nested assets on HTTP server (got ${serverErrors.join('; ')})`);

  const postCheckZips = fs.readdirSync(ROOT).filter((name) => /itch.*\.zip$/i.test(name));
  assert.deepEqual(postCheckZips, [], 'Zero itch ZIP artifacts created');

  const receipt = {
    generatedAt: new Date().toISOString(),
    gitSha: expectedSha,
    nestedEntryPath: '/html/apex/index.html',
    totalServedRequests: serverRequests.length,
    serverErrors,
    zipCreated: false,
    cloudflarePublished: false,
    subGateReceipts,
    journeys,
  };
  const receiptPath = path.join(OUT_DIR, 'itch-nested-candidate-report.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  const summaryLine = `SHA=${expectedSha} | served=${serverRequests.length} | serverErrors=0 | 844x390=350->550AC(attempts=${journeys['844x390-phone-touch'].attemptsUsed}) | 1440x900=350->550AC(attempts=${journeys['1440x900-desktop'].attemptsUsed}) | 0 ZIPs`;
  console.log(`::notice title=ItchNestedCandidateGate::PASS ${summaryLine}`);
  console.log(`\nITCH NESTED CANDIDATE FULL E2E PASS (${summaryLine}) -> ${receiptPath}`);
} catch (err) {
  const encoded = String(err?.stack || err).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.error(`::error title=ItchNestedCandidateGate::${encoded}`);
  throw err;
} finally {
  server.close();
}
