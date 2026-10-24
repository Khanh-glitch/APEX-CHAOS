// Issue #105 §5 gate: first-play guide.
//  - default battle is CLEAN (no coach, beacon, cable, pickup hint or HUD instruction)
//  - one-time question at a safe menu; Yes enables from step 0; No persists OFF
//  - Help-row toggle "Tutorial / Hướng dẫn tân thủ" (EN + VIE) flips the preference
//  - legacy guide key and in-progress coach v2 records are honoured without a prompt
//  - the guide never blocks input (hit-test on the primary CTA)
//  - battle chip is stable over 60 consecutive frames at 5 viewports (no left-right hop)
import { mkdir, writeFile } from 'node:fs/promises';
import { launchBrowser, openApp, startBotBattle, wait, check } from './harness.mjs';

const results = [];
const receipts = {};
const browser = await launchBrowser();

const coachLayerPresent = (page) => page.evaluate(() => !!document.querySelector('.apex-coach-layer, .apex-coach-chip, .apex-coach-beacon, .apex-guide-pickup-prompt'));
const askVisible = (page) => page.evaluate(() => {
  const el = document.querySelector('.apex-tutorial-ask');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
});
const pref = (page) => page.evaluate(() => localStorage.getItem('apex.alpha.tutorial.v1'));
// The toggle lives in the Help sheet opened by `?` (home only).
const openHelp = async (page) => {
  if (!(await page.$('#apex-tutorial-toggle'))) {
    await page.click('#apex-guide-open');
    await page.waitForSelector('#apex-tutorial-toggle', { timeout: 5000 });
  }
};
const toggleState = async (page) => { await openHelp(page); return page.evaluate(() => document.querySelector('#apex-tutorial-toggle')?.getAttribute('aria-checked') ?? null); };
// Question strip must not overlap any interactive control (input never blocked).
const askOverlap = (page) => page.evaluate(() => {
  const ask = document.querySelector('.apex-tutorial-ask');
  if (!ask) return null;
  const a = ask.getBoundingClientRect();
  const hits = [...document.querySelectorAll('button, [role="button"], a, .modeCard, .route, input, select')]
    .filter((el) => !ask.contains(el))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0 && !(r.right <= a.left || r.left >= a.right || r.bottom <= a.top || r.top >= a.bottom))
    .map(({ el }) => (el.id || el.textContent || '').trim().slice(0, 24));
  return { box: [Math.round(a.left), Math.round(a.top), Math.round(a.right), Math.round(a.bottom)], hits };
});

async function freshHome(opts) {
  const session = await openApp(browser, opts);
  await wait(900);
  return session;
}

try {
  // A. Fresh profile, answer NO, battle must be clean, reload keeps OFF.
  {
    const { page, errors, context } = await freshHome({ width: 1440, height: 900 });
    check(results, await askVisible(page), 'A1 fresh profile shows the one-time tutorial question at a safe menu');
    const ov = await askOverlap(page);
    check(results, ov && ov.hits.length === 0, 'A1b question strip covers no interactive control (320x568 is the tightest)', ov);
    check(results, (await pref(page)) === null, 'A2 no preference is written before the player answers', await pref(page));
    check(results, !(await coachLayerPresent(page)), 'A3 coach is not running on the menu before an answer');
    const ctaHit = await page.evaluate(() => {
      const cta = document.querySelector('#freeBattle');
      const r = cta.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { onCta: !!el && (el === cta || cta.contains(el)), inAsk: !!el?.closest('.apex-tutorial-ask') };
    });
    check(results, ctaHit.onCta && !ctaHit.inAsk, 'A4 question never covers the primary FREE BATTLE control (input not blocked)', ctaHit);
    await page.click('.apex-tutorial-ask-no');
    await page.waitForFunction(() => localStorage.getItem('apex.alpha.tutorial.v1') === 'off', { timeout: 10000 });
    check(results, !(await askVisible(page)), 'A5 answering NO hides the question');
    check(results, (await toggleState(page)) === 'false', 'A6 Help toggle reflects OFF');
    await page.keyboard.press('Escape');
    await wait(200);
    await startBotBattle(page);
    const samples = await page.evaluate(async () => {
      const seen = { coach: 0, beacon: 0, pickup: 0, taught: 0, ask: 0 };
      for (let i = 0; i < 120; i++) {
        if (document.querySelector('.apex-coach-layer, .apex-coach-chip')) seen.coach++;
        if (document.querySelector('.apex-coach-beacon')) seen.beacon++;
        if (document.querySelector('.apex-guide-pickup-prompt')) seen.pickup++;
        if (document.querySelector('.apex-coach-taught')) seen.taught++;
        if (document.querySelector('.apex-tutorial-ask')) seen.ask++;
        await new Promise((r) => requestAnimationFrame(() => r()));
      }
      return seen;
    });
    receipts.cleanBattle = samples;
    check(results, Object.values(samples).every((v) => v === 0), 'A7 default battle is CLEAN for 120 frames (no coach, beacon, pickup, HUD instruction)', samples);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
    await page.click('#apex-boot-start');
    await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 120000 });
    await wait(900);
    check(results, (await pref(page)) === 'off' && !(await askVisible(page)), 'A8 OFF persists across reload and the question is not asked again');
    check(results, errors.filter((e) => /apex|tutorial|coach/i.test(e)).length === 0, 'A9 no page errors from the guide', errors.slice(0, 3));
    await context.close();
  }

  // B. YES enables from step 0; battle coach then runs and stays stable.
  {
    const { page, context } = await freshHome({ width: 1440, height: 900 });
    await page.click('.apex-tutorial-ask-yes');
    await page.waitForFunction(() => localStorage.getItem('apex.alpha.tutorial.v1') === 'on', { timeout: 10000 });
    await wait(500);
    const coachStep = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.alpha.coach.v2') || 'null'));
    check(results, coachStep && coachStep.step === 0 && coachStep.done === false, 'B1 YES starts the lesson at step 0', coachStep);
    check(results, await page.evaluate(() => !!document.querySelector('.apex-coach-chip')), 'B2 coach chip visible on the menu after YES');
    check(results, (await toggleState(page)) === 'true', 'B3 Help toggle reflects ON');
    check(results, !(await askVisible(page)), 'B4 question is gone after YES');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
    await page.click('#apex-boot-start');
    await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 120000 });
    await wait(900);
    check(results, (await pref(page)) === 'on' && !(await askVisible(page)), 'B5 ON persists across reload without re-asking');
    await context.close();
  }

  // C. Help toggle: OFF -> ON -> OFF without any question.
  {
    const { page, context } = await freshHome({ width: 390, height: 844, mobile: true, storage: { 'apex.alpha.tutorial.v1': 'off' } });
    check(results, !(await askVisible(page)), 'C1 stored OFF never re-asks');
    const before = await toggleState(page);
    await page.click('#apex-tutorial-toggle');
    await page.waitForFunction(() => localStorage.getItem('apex.alpha.tutorial.v1') === 'on', { timeout: 10000 });
    await wait(500);
    check(results, (await toggleState(page)) === 'true' && await page.evaluate(() => !!document.querySelector('.apex-coach-chip')), 'C2 Help toggle turns the tutorial ON and shows step 0', { before });
    await page.click('#apex-tutorial-toggle');
    await page.waitForFunction(() => localStorage.getItem('apex.alpha.tutorial.v1') === 'off', { timeout: 10000 });
    await wait(400);
    check(results, !(await coachLayerPresent(page)) && (await toggleState(page)) === 'false', 'C3 Help toggle turns the tutorial OFF and removes the coach');
    // The Help sheet is opened by the player, so it may cover the menu. Its own rules:
    // fully inside the viewport and every control >= 44px.
    const sheet = await page.evaluate(() => {
      const sh = document.querySelector('.apex-help-sheet')?.getBoundingClientRect();
      const btns = [...document.querySelectorAll('.apex-help-sheet button')].map((b) => b.getBoundingClientRect().height);
      return { inside: !!sh && sh.left >= 0 && sh.top >= 0 && sh.right <= innerWidth && sh.bottom <= innerHeight, minBtnH: Math.min(...btns) };
    });
    check(results, sheet.inside && sheet.minBtnH >= 44, 'C4 Help sheet stays inside the viewport with >=44px controls (390x844)', sheet);
    await page.keyboard.press('Escape');
    await wait(200);
    check(results, !(await page.$('.apex-help-sheet')), 'C5 Escape closes the Help sheet');
    await context.close();
  }

  // D. VIE copy for the question and toggle.
  {
    const { page, context } = await freshHome({ width: 390, height: 844, mobile: true, lang: 'vie' });
    const text = await page.evaluate(() => document.querySelector('.apex-tutorial-ask')?.innerText || '');
    check(results, /Bật hướng dẫn\?/.test(text) && /CÓ/.test(text) && /KHÔNG/.test(text), 'D1 VIE question copy is shown', text.slice(0, 120));
    await page.click('.apex-tutorial-ask-no');
    await page.waitForFunction(() => localStorage.getItem('apex.alpha.tutorial.v1') === 'off', { timeout: 10000 });
    // textContent, not innerText: the shell uppercases buttons with CSS text-transform.
    await openHelp(page);
    const label = await page.evaluate(() => document.querySelector('#apex-tutorial-toggle')?.textContent || '');
    check(results, label.includes('Tutorial / Hướng dẫn tân thủ') && label.includes('TẮT'), 'D2 VIE toggle label and state (Help sheet)', label);
    await context.close();
  }

  // E. Legacy guide key: no question, tutorial OFF.
  {
    const { page, context } = await freshHome({ width: 1440, height: 900, storage: { 'apex.alpha.guide.v1': '1' } });
    check(results, !(await askVisible(page)) && (await pref(page)) === 'off', 'E1 legacy guide key keeps tutorial OFF without a question', await pref(page));
    await context.close();
  }

  // F. Existing in-progress coach v2 record: stays ON without a question.
  {
    const { page, context } = await freshHome({
      width: 1440, height: 900,
      storage: { 'apex.alpha.coach.v2': JSON.stringify({ version: 2, step: 1, done: false, skipped: false, baselineBotMatches: 0, baselineSealedMatches: 0 }) },
    });
    check(results, (await pref(page)) === 'on' && !(await askVisible(page)), 'F1 in-progress coach v2 record migrates to ON without a question');
    check(results, await page.evaluate(() => !!document.querySelector('.apex-coach-chip')), 'F2 migrated lesson is visible on the menu');
    await context.close();
  }

  // G. 60-frame battle chip stability at the required viewports (tutorial ON).
  const frameReceipts = [];
  for (const [w, h] of [[320, 568], [390, 844], [844, 390], [900, 900], [1440, 900]]) {
    // Tutorial ON with a live lesson record (step 0, not done): the same state the
    // YES answer produces (gate B), so the battle chip runs its real lesson.
    const { page, context } = await openApp(browser, {
      width: w, height: h, mobile: w < 600,
      storage: {
        'apex.alpha.tutorial.v1': 'on',
        'apex.alpha.coach.v2': JSON.stringify({ version: 2, step: 0, done: false, skipped: false, baselineBotMatches: 0, baselineSealedMatches: 0 }),
      },
    });
    await startBotBattle(page);
    await wait(300);
    const rows = await page.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 60; i++) {
        const chip = document.querySelector('.apex-coach-chip');
        if (chip) { const r = chip.getBoundingClientRect(); out.push({ x: r.left, y: r.top, c: chip.dataset.candidate || '' }); }
        await new Promise((res) => requestAnimationFrame(() => res()));
      }
      return out;
    });
    const xs = rows.map((r) => r.x);
    const xRange = xs.length ? Math.max(...xs) - Math.min(...xs) : -1;
    const switches = rows.reduce((n, r, i) => (i && r.c !== rows[i - 1].c ? n + 1 : n), 0);
    const jumps = rows.reduce((n, r, i) => (i && Math.abs(r.x - rows[i - 1].x) > 3 ? n + 1 : n), 0);
    const receipt = { viewport: `${w}x${h}`, frames: rows.length, xRangePx: Math.round(xRange * 10) / 10, candidateSwitches: switches, jumpsOver3px: jumps };
    frameReceipts.push(receipt);
    check(results, rows.length === 60 && xRange <= 2 && switches === 0 && jumps === 0, `G ${w}x${h} chip is stable over 60 frames`, receipt);
    await context.close();
  }
  receipts.frames = frameReceipts;

  const failed = results.filter((r) => !r.ok);
  receipts.summary = { total: results.length, passed: results.length - failed.length, failed: failed.map((r) => r.name) };
  const outDir = process.env.ISSUE105_OUT || 'evidence/issue-105/receipts';
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/gate-first-play-guide.json`, JSON.stringify({ results, receipts }, null, 2));
  console.log('SUMMARY', JSON.stringify(receipts.summary));
  if (failed.length) process.exitCode = 1;
} finally {
  await browser.close();
}
