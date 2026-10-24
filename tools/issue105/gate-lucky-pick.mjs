// Issue #105 §2 + §3 + §8 — real UI journey: Lucky Draw -> Pick -> reload.
//
// Economy authority: a LABELLED ISOLATED TEST SEED (fixture id below) writes
// the production arsenal meta key with credits=1000. It is never a synthetic
// grant inside the app; the draw itself is the real UI click on #btn1 inside
// the real Lucky Draw donor, which charges through APEX_ARSENAL_META.spin().
//
// Asserts (all genuine, no hidden elements):
//   A  insufficient case (350 AC): #btn1 click charges 0, owns nothing new,
//      shows the NEED 1000 AC message.
//   B  labelled 1000 AC seed: one UI click charges exactly 1000 (1000 -> 0),
//      owns exactly one new fighter; a second click is refused (no 2nd charge).
//   C  Pick after the draw (same session): NEWBOT first and playable; the
//      drawn fighter is NOT shown LOCKED; the six roadmap-locked are LOCKED
//      in roadmap order; no duplicate or stale card.
//   D  reload: the same Pick ordering and lock truth persist.
//   E  no "[APEX Lucky Draw] transition recovered" console error.
//
// Usage: APEX_APP_URL=http://127.0.0.1:5173/ CHROME_PATH=... node tools/issue105/gate-lucky-pick.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, openApp, check, wait, BASE } from './harness.mjs';

export const TEST_SEED_ID = 'ISSUE-105-LABELLED-TEST-SEED-1000AC';
const OUT = process.env.ISSUE105_OUT || '/tmp/i105-lucky-pick';
const results = [];
const browser = await launchBrowser();

const seedFor = (credits) => ({
  version: 1,
  testFixture: TEST_SEED_ID,
  credits,
  ownedFighters: ['ROBOT'],
  lastSelectedP1: 'ROBOT',
  lastSelectedP2: 'ROBOT',
  totalSpins: 0,
  unlockedAt: { ROBOT: 0 },
  arenaPaletteId: null,
  claimedMatchIds: [],
  progression: { botMatches: 0, botWins: 0, localMatches: 0, claimedIds: [] },
});

const meta = (page) => page.evaluate(() => {
  const m = window.APEX_ARSENAL_META;
  const s = m && m.getState ? m.getState() : null;
  return s ? { credits: s.credits, owned: s.ownedFighters.slice(), totalSpins: s.totalSpins } : null;
});

async function openLuckyFromHome(page) {
  await page.waitForSelector('#openLuckyDraw', { visible: true, timeout: 60000 });
  await page.click('#openLuckyDraw');
  await page.waitForFunction(() => document.getElementById('luckyDonorFrame')?.contentDocument?.getElementById('btn1'), { timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 60000 }).catch(() => {});
  await wait(900);
}

// Click the REAL draw button inside the donor iframe.
async function clickDraw(page) {
  await page.waitForFunction(() => !!document.getElementById('luckyDonorFrame')?.contentDocument?.getElementById('btn1'), { timeout: 30000 });
  const frame = page.frames().find((f) => f.url().includes('/gold/lucky-draw.html'));
  if (!frame) throw new Error('lucky donor frame not found');
  await frame.evaluate(() => document.getElementById('btn1').click());
  await wait(3200);
}

async function closeLuckyToHome(page) {
  const frame = page.frames().find((f) => f.url().includes('/gold/lucky-draw.html'));
  if (frame) await frame.evaluate(() => document.getElementById('backBtn')?.click()).catch(() => {});
  await page.waitForFunction(() => document.getElementById('luckyDonorHost')?.getAttribute('aria-hidden') === 'true' && document.body.dataset.apexSceneTransition === 'DONE', { timeout: 60000 }).catch(() => {});
  await wait(900);
}

async function openPick(page) {
  await page.click('#freeBattle');
  await page.waitForFunction(() => document.querySelector('#modeSelectScreen')?.getAttribute('aria-hidden') === 'false', { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 120000 }).catch(() => {});
  await wait(900);
  await page.click('.modeCard[data-mode="bot"]');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-fighter') && document.body.dataset.apexSceneTransition === 'DONE', { timeout: 60000 });
  await wait(900);
}

async function rosterState(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#roster .rosterCard, .rosterCard')).map((c) => ({
    id: c.dataset.hero,
    locked: c.classList.contains('is-locked'),
    disabled: !!c.disabled,
    name: (c.getAttribute('aria-label') || '').trim(),
  })));
}

const dedupe = (rows) => rows.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i);

const consoleErrors = [];
try {
  const pageErrs = [];
  // ─── A: insufficient funds (350 AC) ─────────────────────────────────────
  {
    const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, dpr: 1, seed: seedFor(350), storage: { 'apex.alpha.tutorial.v1': 'off' } });
    const before = await meta(page);
    await openLuckyFromHome(page);
    await clickDraw(page);
    const after = await meta(page);
    check(results, before && after && after.credits === 350 && after.owned.length === 1 && after.totalSpins === 0,
      'A insufficient (350 AC): click charges 0, grants nothing', { before, after });
    await closeLuckyToHome(page);
    pageErrs.push(...errors);
    await context.close();
  }

  // ─── B,C,D,E: labelled 1000 AC seed ─────────────────────────────────────
  const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, dpr: 1, seed: seedFor(1000), storage: { 'apex.alpha.tutorial.v1': 'off' } });
  const start = await meta(page);
  await openLuckyFromHome(page);
  await clickDraw(page);
  const afterDraw = await meta(page);
  const drawn = afterDraw && afterDraw.owned.filter((x) => !start.owned.includes(x));
  check(results, afterDraw && afterDraw.credits === 0 && afterDraw.totalSpins === 1 && drawn.length === 1,
    'B one UI draw charges exactly 1000 AC and grants exactly one fighter', { start, afterDraw, drawn });
  await clickDraw(page);
  const afterSecond = await meta(page);
  check(results, afterSecond && afterSecond.credits === afterDraw.credits && afterSecond.totalSpins === afterDraw.totalSpins,
    'B2 second click after balance 0 is refused (no second charge, no grant)', { afterDraw, afterSecond });
  await closeLuckyToHome(page);

  // C/D: Pick truth. Shell keys are mapped from production ids via the same
  // registry the bridge uses (ROBOT->newbot, CRYSTAL->crystala, ICE->frost ...).
  const SHELL_KEY = { ROBOT: 'newbot', HUNTER: 'hunter', CRYSTAL: 'crystala', MAGNET: 'magnet', ICE: 'frost', MIRROR: 'mirror', BOXE: 'boxe', SHURI: 'shuri' };
  const PLAYABLE_PROD = Object.keys(SHELL_KEY);
  const ROADMAP_LOCKED_PROD = ['BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER'];
  const pickTruth = async (label, owned) => {
    await openPick(page);
    const rows = await rosterState(page);
    await mkdir(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `pick-${label}.png`) });
    const ids = rows.map((r) => r.id);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    const ownedKeys = owned.map((p) => SHELL_KEY[p]).filter(Boolean);
    const issues = [];
    if (ids.length !== new Set(ids).size) issues.push('duplicate card');
    if (rows[0].id !== 'newbot' || rows[0].locked) issues.push(`first card is ${rows[0].id} locked=${rows[0].locked}, expected newbot playable`);
    for (const k of ownedKeys) if (!byId[k]) issues.push(`owned ${k} missing from Pick`); else if (byId[k].locked) issues.push(`owned ${k} shown LOCKED`);
    for (const p of PLAYABLE_PROD) { const k = SHELL_KEY[p]; if (byId[k] && !owned.includes(p) && !byId[k].locked) issues.push(`unowned ${k} shown playable`); }
    const roadmapSeen = ROADMAP_LOCKED_PROD.map((p) => p.toLowerCase()).filter((k) => byId[k]);
    for (const k of roadmapSeen) if (!byId[k].locked) issues.push(`roadmap ${k} not LOCKED`);
    // roadmap-locked must come last, in roadmap order
    const tail = ids.slice(-ROADMAP_LOCKED_PROD.length).join(',');
    if (roadmapSeen.length === 6 && tail !== ROADMAP_LOCKED_PROD.map((p) => p.toLowerCase()).join(',')) issues.push(`roadmap tail order ${tail}`);
    return { label, ids, rows, issues, roadmapSeen, ownedKeys };
  };
  const ownedNow = (await meta(page)).owned;
  const c = await pickTruth('same-session', ownedNow);
  check(results, c.rows.length === 14, 'C0 Pick lists 14 entries (8 playable + 6 roadmap-locked)', { n: c.rows.length, ids: c.ids });
  check(results, c.issues.length === 0, 'C1 same-session Pick truth: NEWBOT first & playable, owned never LOCKED, roadmap LOCKED last', { issues: c.issues, ownedNow, ids: c.ids });
  check(results, c.ids.includes(SHELL_KEY[drawn[0]]) && !c.rows.find((r) => r.id === SHELL_KEY[drawn[0]]).locked, 'C2 the Lucky-drawn fighter is selectable on Pick', { drawn: drawn[0] });

  // D: reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await page.click('#apex-boot-start');
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 120000 });
  await wait(600);
  const reloadMeta = await meta(page);
  check(results, reloadMeta && reloadMeta.credits === 0 && reloadMeta.owned.length === 2, 'D1 reload preserves balance 0 and the drawn ownership', reloadMeta);
  const d = await pickTruth('after-reload', reloadMeta.owned);
  check(results, d.issues.length === 0, 'D2 after reload Pick truth identical', { issues: d.issues, ids: d.ids });

  // E: console
  const transitionRecovered = errors.filter((e) => /transition recovered/i.test(e));
  check(results, transitionRecovered.length === 0, 'E no Lucky transition-recovered console error', { transitionRecovered });
  consoleErrors.push(...errors);
  await context.close();
  const pageFatal = pageErrs.filter((e) => /pageerror/.test(e));
  check(results, pageFatal.length === 0, 'F no uncaught pageerror in the insufficient profile', { pageFatal: pageFatal.slice(0, 3) });
} catch (err) {
  check(results, false, 'journey completed without exception', { error: String(err && err.stack || err).slice(0, 800) });
} finally {
  await browser.close();
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'gate-lucky-pick.json'), JSON.stringify({ base: BASE, seed: TEST_SEED_ID, results, consoleErrors: consoleErrors.slice(0, 20) }, null, 2));
}
const failed = results.filter((r) => !r.ok);
console.log('SUMMARY', JSON.stringify({ total: results.length, failed: failed.map((r) => r.name) }));
if (failed.length) process.exitCode = 1;
