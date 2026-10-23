// RA-2.4: exercise the real React mastery notification component over a live
// BOT battle. Events are presentation fixtures only: no ledger, wallet, or
// mastery state is written by this audit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error('CHROME_PATH is required');
const OUT = path.resolve(process.env.RA2_TOAST_EVIDENCE_DIR || '/tmp/ra2-toast-presentation');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});

async function runLanguage(language) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const width = Number(process.env.RA2_TOAST_WIDTH) || 390;
  const height = Number(process.env.RA2_TOAST_HEIGHT) || 844;
  const reducedMotion = process.env.RA2_REDUCED_MOTION === '1';
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  if (reducedMotion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('apex.alpha.coach.v2', JSON.stringify({
      version: 2, step: 6, done: true, skipped: true,
      baselineBotMatches: 0, baselineSealedMatches: 0,
    }));
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 65000 });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await page.click('#apex-boot-start');
  await page.waitForSelector('#freeBattle', { visible: true, timeout: 60000 });
  await page.waitForFunction(() => document.body?.dataset?.apexSceneTransition === 'DONE', { timeout: 60000 });
  await page.evaluate((lang) => window.APEX_I18N?.setLanguage?.(lang), language);
  await page.click('#freeBattle');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-mode')
    && document.body?.dataset?.apexSceneTransition === 'DONE', { timeout: 30000 });
  await page.waitForSelector('.modeCard[data-mode="bot"]', { visible: true, timeout: 30000 });
  await page.click('.modeCard[data-mode="bot"]');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-fighter')
    && document.body?.dataset?.apexSceneTransition === 'DONE', { timeout: 30000 });
  await page.click('#lockIn');
  await page.waitForSelector('.fighter-active-p2', { timeout: 30000 });
  await page.click('#lockIn');
  await page.waitForSelector('#battleHudHost.is-open #p1Side .skill', { timeout: 60000 });
  await page.waitForFunction(() => window.APEX_ARSENAL?.state?.active === true
    && String(window.APEX_ARSENAL?.state?.battleMode).toUpperCase() === 'BOT', { timeout: 30000 });

  const baseline = await page.evaluate(() => ({
    ac: window.APEX_ARSENAL_META?.credits?.(),
    mastery: JSON.stringify(window.APEX_ARSENAL_META?.getMastery?.() || {}),
    coach: window.APEX_LEARN_BY_PLAYING?.state?.(),
  }));
  assert.equal(baseline.coach?.done, true, `${language}: presentation test must not open the coach`);

  // Use the production event protocol and the real AchievementToast component.
  // P1's candidate is higher priority than the queued BOT feat.
  await page.evaluate(() => {
    const at = Date.now();
    window.dispatchEvent(new CustomEvent('apex:mastery-provisional', { detail: { unlocks: [
      { achievementId: 'first-blood', heroId: 'ROBOT', ownerSide: 'P1', ownerKind: 'human',
        walletEligible: true, battleMode: 'BOT', value: 1, at },
      { achievementId: 'first-blood', heroId: 'NEWBOT', ownerSide: 'P2', ownerKind: 'bot',
        walletEligible: false, battleMode: 'BOT', value: 1, at: at + 1 },
    ] } }));
  });
  await page.waitForSelector('.apex-achievement-toast[data-owner-side="P1"]', { visible: true, timeout: 10000 });
  await sleep(350); // let the authored entrance motion settle before geometry checks
  const p1 = await page.$eval('.apex-achievement-toast[data-owner-side="P1"]', (toast) => {
    const r = toast.getBoundingClientRect();
    const canvas = [...document.querySelectorAll('canvas')].find((el) => {
      const b = el.getBoundingClientRect(); return b.width > 200 && b.height > 200;
    });
    const skills = [...document.querySelectorAll('#p1Side .skill, #p2Side .skill')];
    const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const c = canvas?.getBoundingClientRect();
    return {
      text: toast.innerText.replace(/\s+/g, ' ').trim(),
      role: toast.getAttribute('role'), ariaLive: toast.getAttribute('aria-live'),
      ownerSide: toast.dataset.ownerSide, ownerKind: toast.dataset.ownerKind,
      provisional: toast.dataset.provisional, walletEligible: toast.dataset.walletEligible,
      zIndex: getComputedStyle(toast).zIndex, pointerEvents: getComputedStyle(toast).pointerEvents,
      box: r.toJSON(), canvasBox: c?.toJSON() || null, viewport: { width: innerWidth, height: innerHeight },
      overlapsCanvas: overlaps(r, c),
      overlapsSkills: skills.map((skill) => overlaps(r, skill.getBoundingClientRect())),
      motion: { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, animationName: getComputedStyle(toast).animationName },
      name: toast.querySelector('strong')?.textContent,
    };
  });
  console.log(`RA-2.4 ${language.toUpperCase()} P1 provisional DOM`, JSON.stringify(p1));
  await page.screenshot({ path: path.join(OUT, `${language}-live-bot-p1-provisional-${width}x${height}.png`) });
  assert.equal(p1.ownerSide, 'P1');
  assert.equal(p1.ownerKind, 'human');
  assert.equal(p1.provisional, 'true');
  assert.equal(p1.walletEligible, 'true');
  assert.equal(p1.role, 'status');
  assert.equal(p1.ariaLive, 'polite');
  assert.equal(p1.pointerEvents, 'none');
  if (reducedMotion) {
    assert.equal(p1.motion.reduced, true);
    assert.equal(p1.motion.animationName, 'none', `${language}: toast motion must respect prefers-reduced-motion`);
  }
  assert.equal(p1.name, language === 'eng' ? 'First Blood' : 'Máu Đầu Tiên',
    `${language}: toast title must use the selected locale`);
  assert.match(p1.text, language === 'eng' ? /YOU · ACHIEVEMENT IN REACH/ : /BẠN · THÀNH TỰU ĐANG CHỜ CHỐT/);
  assert.match(p1.text, language === 'eng' ? /FINISH THE MATCH TO RECORD IT/ : /HOÀN THÀNH TRẬN ĐỂ GHI NHẬN/);
  assert.equal(p1.overlapsCanvas, false, `${language}: P1 toast overlaps real battle canvas: ${JSON.stringify(p1)}`);
  assert.ok(p1.overlapsSkills.every((overlap) => !overlap), `${language}: P1 toast overlaps skill cards: ${JSON.stringify(p1)}`);

  await page.waitForSelector('.apex-achievement-toast[data-owner-side="P2"][data-owner-kind="bot"]', { visible: true, timeout: 8000 });
  const bot = await page.$eval('.apex-achievement-toast[data-owner-side="P2"]', (toast) => ({
    text: toast.innerText.replace(/\s+/g, ' ').trim(),
    compact: toast.classList.contains('is-compact'),
    provisional: toast.dataset.provisional,
    walletEligible: toast.dataset.walletEligible,
    name: toast.querySelector('strong')?.textContent,
  }));
  assert.equal(bot.compact, true);
  assert.equal(bot.provisional, 'true');
  assert.equal(bot.walletEligible, 'false');
  assert.ok(bot.name, `${language}: BOT notification must retain its achievement title`);
  assert.match(bot.text, language === 'eng'
    ? /P2 · BOT · (COMMON|RARE|EPIC|LEGENDARY)/
    : /P2 · BOT · (THƯỜNG|HIẾM|SỬ THI|HUYỀN THOẠI)/);
  assert.match(bot.text, language === 'eng' ? /BOT FEAT — NOT ADDED TO YOUR MASTERY/ : /THÀNH TÍCH CỦA BOT — KHÔNG GHI VÀO TINH THÔNG CỦA BẠN/);
  await page.screenshot({ path: path.join(OUT, `${language}-live-bot-p2-bot-feat-${width}x${height}.png`) });

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('apex:mastery-unlocked', { detail: { unlocks: [
      { achievementId: 'first-blood', heroId: 'ROBOT', ownerSide: 'P1', ownerKind: 'human',
        walletEligible: true, battleMode: 'BOT', value: 1, at: Date.now() + 2 },
    ] } }));
  });
  await page.waitForSelector('.apex-achievement-toast[data-owner-side="P1"][data-provisional="false"]',
    { visible: true, timeout: 15000 });
  await sleep(350);
  const sealed = await page.$eval('.apex-achievement-toast[data-owner-side="P1"][data-provisional="false"]', (toast) => {
    const r = toast.getBoundingClientRect();
    const canvas = [...document.querySelectorAll('canvas')].find((el) => {
      const b = el.getBoundingClientRect(); return b.width > 200 && b.height > 200;
    });
    const skills = [...document.querySelectorAll('#p1Side .skill, #p2Side .skill')];
    const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const c = canvas?.getBoundingClientRect();
    return {
      text: toast.innerText.replace(/\s+/g, ' ').trim(),
      ownerSide: toast.dataset.ownerSide, ownerKind: toast.dataset.ownerKind,
      provisional: toast.dataset.provisional, walletEligible: toast.dataset.walletEligible,
      box: r.toJSON(), canvasBox: c?.toJSON() || null,
      overlapsCanvas: overlaps(r, c),
      overlapsSkills: skills.map((skill) => overlaps(r, skill.getBoundingClientRect())),
      name: toast.querySelector('strong')?.textContent,
    };
  });
  console.log(`RA-2.4 ${language.toUpperCase()} sealed P1 DOM`, JSON.stringify(sealed));
  assert.equal(sealed.ownerKind, 'human');
  assert.equal(sealed.provisional, 'false');
  assert.equal(sealed.walletEligible, 'true');
  assert.equal(sealed.name, language === 'eng' ? 'First Blood' : 'Máu Đầu Tiên');
  assert.match(sealed.text, language === 'eng' ? /YOU · ACHIEVEMENT UNLOCKED/ : /BẠN · ĐÃ MỞ THÀNH TỰU/);
  assert.equal(sealed.overlapsCanvas, false, `${language}: sealed toast overlaps the arena: ${JSON.stringify(sealed)}`);
  assert.ok(sealed.overlapsSkills.every((overlap) => !overlap), `${language}: sealed toast overlaps skill cards: ${JSON.stringify(sealed)}`);
  await page.screenshot({ path: path.join(OUT, `${language}-live-bot-p1-sealed-${width}x${height}.png`) });

  const after = await page.evaluate(() => ({
    ac: window.APEX_ARSENAL_META?.credits?.(),
    mastery: JSON.stringify(window.APEX_ARSENAL_META?.getMastery?.() || {}),
  }));
  assert.deepEqual(after, { ac: baseline.ac, mastery: baseline.mastery },
    `${language}: notification event must not mutate wallet or mastery`);
  assert.deepEqual(errors, [], `${language}: browser runtime errors`);
  console.log(`RA-2.4 ${language.toUpperCase()} real toast presentation PASS`, JSON.stringify({ p1, bot, noStateMutation: true }));
  await context.close();
}

try {
  const languages = String(process.env.RA2_TOAST_LANGUAGES || 'eng,vie').split(',')
    .map((language) => language.trim().toLowerCase()).filter((language) => ['eng', 'vie'].includes(language));
  assert.ok(languages.length > 0, 'RA2_TOAST_LANGUAGES must include eng and/or vie');
  for (const language of languages) await runLanguage(language);
  console.log(`RA-2.4 notification presentation gate PASS (${languages.join(',')}); evidence: ${OUT}`);
} finally {
  await browser.close();
}
