// F2 browser acceptance — Story / Quest 01 lock authority (owner decision B).
//
// Proof level: BROWSER ACCEPTANCE on the built product (vite preview).
// Verifies, with real mouse/keyboard/touch input, that while the product
// registry (src/game/productSurface.js) lists quest-01 as LOCKED:
//   * Home presents Story as COMING SOON in EN and VI (locked CTA styling,
//     aria-disabled), never as a continuable quest;
//   * mouse click, keyboard Enter/Space and touch taps on the CTA cannot
//     open the Quest director, create quest progress, or write save data;
//   * a pre-seeded quest checkpoint in localStorage does not resurrect or
//     advance the quest across reload — the stored value stays identical;
//   * query/hash deep-link attempts land on a locked Home;
//   * CTA interactions create no history entries (nothing to go back to);
//   * neighbouring Home flows still work (Free Battle opens mode select;
//     BOT WAVE entry remains mounted).
// Quest content itself (director/cutscenes/checkpoints) is untouched by F2;
// this test only proves the player-facing lock. Internal Quest dev suites
// keep living in their branch workflows and reopen by flipping quest-01 to
// ACTIVE in the one registry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const url = (process.env.APEX_APP_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = process.env.APEX_EVIDENCE_DIR || 'docs/quest/f2-browser';
fs.mkdirSync(output, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUEST_SAVE_KEY = 'apex-chaos.quest01.progress.v1';
const SEEDED_SAVE = JSON.stringify({
  schemaVersion: 1, questId: 'THE_ONES_THROWN_AWAY', contentRevision: 'q1-director-20261008',
  checkpointId: 'WORKSHOP', encounterId: null, phaseId: 'ENTRY', completedCueIds: [],
  stormbreakerArtifactPhase: 'SEALED', sessionId: 'quest01-f2-seed', updatedAt: 1700000000000,
});

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});

async function bootHome(page, path = '/?goldViewport=native') {
  await page.goto(url + path, { waitUntil: 'domcontentloaded', timeout: 65000 });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await page.click('#apex-boot-start');
  await page.waitForFunction(
    () => !!document.querySelector('#continueStory') && document.querySelector('#stage')?.classList.contains('ready'),
    { timeout: 60000 });
  await page.waitForFunction(() => document.body?.dataset?.apexSceneTransition === 'DONE', { timeout: 60000 });
  await sleep(400);
}
const readState = (page, key) => page.evaluate((k) => ({
  cta: document.querySelector('#continueStory .label')?.innerText,
  ctaClass: document.querySelector('#continueStory')?.className,
  ariaDisabled: document.querySelector('#continueStory')?.getAttribute('aria-disabled'),
  canLaunchQuest: window.APEX_PRODUCT_SURFACE?.canLaunch?.('quest-01'),
  availability: window.APEX_PRODUCT_SURFACE?.availabilityOf?.('quest-01'),
  directorVisible: window.APEX_QUEST01_DIRECTOR?.isVisible?.() ?? null,
  stageOpen: (() => { const d = document.getElementById('apexQuest01Stage'); return !!d && d.hidden === false; })(),
  checkpoint: window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId,
  questSave: localStorage.getItem(k),
  questKeys: Object.keys(localStorage).filter((x) => x.includes('quest01')),
  href: location.href, historyLength: history.length,
  ctaFit: (() => {
    const b = document.querySelector('#continueStory'), l = document.querySelector('#continueStory .label');
    if (!b || !l) return null;
    const br = b.getBoundingClientRect(), lr = l.getBoundingClientRect();
    return { labelWithin: lr.left >= br.left - 1 && lr.right <= br.right + 3, btnInViewport: br.left >= 0 && br.right <= innerWidth + 1 };
  })(),
  ctaPresentation: (() => {
    const b = document.querySelector('#continueStory');
    if (!b) return null;
    const cs = getComputedStyle(b);
    return { filter: cs.filter, cursor: cs.cursor };
  })(),
}), key);

function assertLocked(state, where) {
  assert.equal(state.availability, 'LOCKED', where + ': registry must keep quest-01 LOCKED');
  assert.equal(state.canLaunchQuest, false, where + ': authority canLaunch must be false');
  assert.equal(state.directorVisible, false, where + ': Quest director must never become visible');
  assert.equal(state.stageOpen, false, where + ': Quest stage must never open');
  assert.ok(state.ctaFit?.labelWithin && state.ctaFit?.btnInViewport, where + ': COMING SOON label must fit its CTA/viewport ' + JSON.stringify(state.ctaFit));
  assert.ok(/saturate\(0\.4\)/.test(state.ctaPresentation?.filter || ''), where + ': CTA must render desaturated like other locked surfaces, got filter=' + state.ctaPresentation?.filter);
  assert.equal(state.ctaPresentation?.cursor, 'not-allowed', where + ': CTA cursor must be not-allowed');
}

const allErrors = [];
function wireErrors(page, tag) { page.on('pageerror', (e) => allErrors.push(tag + ': ' + String(e?.stack || e))); }

try {
  // ── A. Desktop fresh profile: EN/VI copy + mouse/keyboard attacks ────────
  const ctxA = await browser.createBrowserContext();
  const page = await ctxA.newPage(); wireErrors(page, 'desktop');
  await page.setViewport({ width: 1440, height: 900 });
  await bootHome(page);
  await page.evaluate(() => window.APEX_I18N?.setLanguage('eng')); await sleep(450);
  let st = await readState(page, QUEST_SAVE_KEY);
  assert.equal(st.cta, 'STORY — COMING SOON', 'EN CTA must announce COMING SOON, got: ' + st.cta);
  assert.ok(st.ctaClass.includes('is-locked'), 'CTA must carry the locked treatment');
  assert.equal(st.ariaDisabled, 'true', 'CTA must be aria-disabled');
  assert.equal(st.questSave, null, 'fresh profile must have no quest save');
  assertLocked(st, 'desktop EN');
  await page.screenshot({ path: output + '/desktop-home-eng.png' });
  await page.evaluate(() => window.APEX_I18N?.setLanguage('vie')); await sleep(450);
  st = await readState(page, QUEST_SAVE_KEY);
  assert.equal(st.cta, 'CỐT TRUYỆN — SẮP RA MẮT', 'VI CTA must announce SẮP RA MẮT, got: ' + st.cta);
  assertLocked(st, 'desktop VI');
  await page.screenshot({ path: output + '/desktop-home-vie.png' });
  const navBefore = { href: st.href, historyLength: st.historyLength };
  await page.click('#continueStory'); await sleep(800);
  st = await readState(page, QUEST_SAVE_KEY); assertLocked(st, 'after mouse click');
  assert.equal(st.questSave, null, 'mouse click must not create quest progress/save');
  await page.evaluate(() => document.querySelector('#continueStory').focus());
  await page.keyboard.press('Enter'); await sleep(700);
  st = await readState(page, QUEST_SAVE_KEY); assertLocked(st, 'after Enter');
  await page.keyboard.press('Space'); await sleep(700);
  st = await readState(page, QUEST_SAVE_KEY); assertLocked(st, 'after Space');
  assert.equal(st.questSave, null, 'keyboard activation must not create quest progress/save');
  assert.deepEqual(st.questKeys, [], 'no quest01 storage keys may appear');
  assert.equal(st.href, navBefore.href, 'CTA attacks must not navigate');
  assert.equal(st.historyLength, navBefore.historyLength, 'CTA attacks must not create history entries');
  console.log('F2 desktop PASS: COMING SOON EN/VI, mouse+Enter+Space cannot open Quest, zero save writes');

  // ── B. Saved checkpoint cannot resurrect/advance the quest ───────────────
  await page.evaluate((k, v) => localStorage.setItem(k, v), QUEST_SAVE_KEY, SEEDED_SAVE);
  await bootHome(page); // full reload + boot
  st = await readState(page, QUEST_SAVE_KEY);
  assert.equal(st.checkpoint, 'WORKSHOP', 'seeded checkpoint must be readable (content preserved)');
  assertLocked(st, 'seeded reload');
  await page.click('#continueStory'); await sleep(800);
  st = await readState(page, QUEST_SAVE_KEY);
  assertLocked(st, 'seeded click');
  assert.equal(st.questSave, SEEDED_SAVE, 'stored checkpoint must remain byte-identical (no progress/reward/session writes)');
  console.log('F2 saved-state PASS: WORKSHOP checkpoint preserved verbatim, still locked after reload+click');

  // ── C. Deep-link attempts land on a locked Home ───────────────────────────
  for (const path of ['/?quest=1&goldViewport=native', '/?goldViewport=native#quest']) {
    await bootHome(page, path);
    st = await readState(page, QUEST_SAVE_KEY);
    assertLocked(st, 'deep-link ' + path);
  }
  console.log('F2 deep-link PASS: query/hash quest attempts stay on locked Home');
  await ctxA.close();

  // ── D/E. Mobile portrait + landscape touch attacks ───────────────────────
  for (const view of [
    { name: 'portrait', width: 390, height: 844 },
    { name: 'landscape', width: 844, height: 390 },
  ]) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage(); wireErrors(p, view.name);
    await p.setViewport({ width: view.width, height: view.height, isMobile: true, hasTouch: true });
    await bootHome(p);
    await p.evaluate(() => window.APEX_I18N?.setLanguage('vie')); await sleep(450);
    let s = await readState(p, QUEST_SAVE_KEY);
    assert.equal(s.cta, 'CỐT TRUYỆN — SẮP RA MẮT', view.name + ' VI CTA');
    assertLocked(s, view.name);
    await p.tap('#continueStory'); await sleep(900);
    s = await readState(p, QUEST_SAVE_KEY);
    assertLocked(s, view.name + ' after tap');
    assert.equal(s.questSave, null, view.name + ': tap must not create quest save');
    await p.screenshot({ path: output + '/' + view.name + '-home-vie.png' });
    await ctx.close();
    console.log('F2 mobile ' + view.name + ' PASS: tap cannot open Quest');
  }

  // ── F. Neighbouring Home flows still work ─────────────────────────────────
  const ctxF = await browser.createBrowserContext();
  const pf = await ctxF.newPage(); wireErrors(pf, 'regression');
  await pf.setViewport({ width: 1440, height: 900 });
  await bootHome(pf);
  assert.equal(await pf.evaluate(() => !!document.querySelector('#botWaveEntry')), true, 'BOT WAVE Home entry must remain mounted');
  await pf.click('#freeBattle');
  await pf.waitForFunction(() => {
    const m = document.querySelector('#modeSelectScreen');
    return !!m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 10;
  }, { timeout: 20000 });
  console.log('F2 regression PASS: Free Battle opens mode select; BOT WAVE entry intact');
  await ctxF.close();

  assert.deepEqual(allErrors, [], 'no uncaught page errors allowed: ' + allErrors.join(' | '));
  console.log('F2 STORY LOCK BROWSER PASS: Story is COMING SOON and unreachable by mouse, keyboard, touch, reload, deep-link or saved state');
} finally {
  await browser.close();
}
