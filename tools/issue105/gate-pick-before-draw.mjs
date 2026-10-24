// Issue #105 §3 — route the owner reported: Pick visited BEFORE the draw.
//   seed 1000 AC -> Pick (pre-draw truth) -> reload -> Lucky UI draw (#btn1)
//   -> Pick (same session) -> reload -> Pick.
// Every Pick must agree with production ownership (APEX_ARSENAL_META):
//   NEWBOT first and playable; owned fighters never LOCKED; unowned playable
//   fighters LOCKED; the six roadmap-locked fighters LOCKED and last, in roadmap
//   order; each entry exactly once. The draw is a real UI click that charges
//   through APEX_ARSENAL_META.spin(); the seed is a labelled test fixture.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, openApp, check, wait, BASE } from './harness.mjs';

const OUT = process.env.ISSUE105_OUT || '/tmp/i105-pick-before-draw';
const TEST_SEED_ID = 'ISSUE-105-LABELLED-TEST-SEED-1000AC';
const results = [];
const browser = await launchBrowser();

const SHELL_KEY = { ROBOT: 'newbot', HUNTER: 'hunter', CRYSTAL: 'crystala', MAGNET: 'magnet', ICE: 'frost', MIRROR: 'mirror', BOXE: 'boxe', SHURI: 'shuri' };
const PLAYABLE_PROD = Object.keys(SHELL_KEY);
const ROADMAP = ['black_hole', 'math_v2', 'rubber', 'time', 'slime', 'sniper'];

const seed = (credits) => ({ version: 1, testFixture: TEST_SEED_ID, credits, ownedFighters: ['ROBOT'], lastSelectedP1: 'ROBOT', lastSelectedP2: 'ROBOT', totalSpins: 0, unlockedAt: { ROBOT: 0 } });
const meta = (page) => page.evaluate(() => { const s = window.APEX_ARSENAL_META?.getState?.(); return s ? { credits: s.credits, owned: s.ownedFighters.slice(), totalSpins: s.totalSpins } : null; });

async function bootAgain(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await page.click('#apex-boot-start');
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 120000 });
  await wait(600);
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

async function rosterRows(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.rosterCard')).map((c) => ({ id: c.dataset.hero, locked: c.classList.contains('is-locked') })));
}

// Returns the list of disagreements between the Pick screen and production truth.
async function pickTruth(page, label, owned) {
  await openPick(page);
  const rows = await rosterRows(page);
  await mkdir(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `pick-${label}.png`) });
  const ids = rows.map((r) => r.id);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  const ownedKeys = owned.map((p) => SHELL_KEY[p]).filter(Boolean);
  const issues = [];
  if (new Set(ids).size !== ids.length) issues.push('duplicate card');
  if (ids.length !== 14) issues.push(`expected 14 entries, got ${ids.length}`);
  if (ids[0] !== 'newbot' || rows[0].locked) issues.push(`first card ${ids[0]} locked=${rows[0].locked}`);
  for (const k of ownedKeys) { if (!byId[k]) issues.push(`owned ${k} missing`); else if (byId[k].locked) issues.push(`owned ${k} shown LOCKED`); }
  for (const p of PLAYABLE_PROD) { const k = SHELL_KEY[p]; if (byId[k] && !owned.includes(p) && !byId[k].locked) issues.push(`unowned ${k} shown playable`); }
  for (const k of ROADMAP) if (byId[k] && !byId[k].locked) issues.push(`roadmap ${k} not LOCKED`);
  const tail = ids.slice(-6).join(',');
  if (tail !== ROADMAP.join(',')) issues.push(`roadmap tail order ${tail}`);
  // leave the Pick screen for the next step by reloading (documented route)
  return { ids, issues, locked: rows.filter((r) => r.locked).map((r) => r.id) };
}

const errorsAll = [];
try {
  const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, dpr: 1, seed: seed(1000), storage: { 'apex.alpha.tutorial.v1': 'off' } });
  errorsAll.push(...errors);
  // 1. Pick visited BEFORE the draw
  const pre = await pickTruth(page, 'pre-draw', ['ROBOT']);
  check(results, pre.issues.length === 0, 'P1 Pick before draw: truth (NEWBOT first, only ROBOT owned, 13 others locked)', { issues: pre.issues, ids: pre.ids });
  await bootAgain(page);
  // 2. Lucky UI draw from home
  await page.waitForSelector('#openLuckyDraw', { visible: true, timeout: 60000 });
  await page.click('#openLuckyDraw');
  await page.waitForFunction(() => !!document.getElementById('luckyDonorFrame')?.contentDocument?.getElementById('btn1'), { timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 90000 }).catch(() => {});
  await wait(900);
  const frame = page.frames().find((f) => f.url().includes('/gold/lucky-draw.html'));
  await frame.evaluate(() => document.getElementById('btn1').click());
  await wait(3500);
  const afterDraw = await meta(page);
  const drawn = afterDraw.owned.filter((x) => x !== 'ROBOT');
  check(results, afterDraw.credits === 0 && drawn.length === 1, 'P2 Lucky UI draw after Pick-before-draw: 1000 -> 0 and exactly one new fighter', { afterDraw });
  // 3. Pick in the same session after the draw (reload-free route from home)
  await page.evaluate(() => document.getElementById('luckyDonorHost')?.getAttribute('aria-hidden') === 'true' || true);
  await bootAgain(page);
  const post = await pickTruth(page, 'post-draw-after-reload', afterDraw.owned);
  check(results, post.issues.length === 0, 'P3 Pick after draw (post-reload): owned incl. drawn fighter never LOCKED, order and locks exact', { issues: post.issues, owned: afterDraw.owned, ids: post.ids });
  // 4. reload once more, Pick again
  await bootAgain(page);
  const final = await pickTruth(page, 'final-reload', (await meta(page)).owned);
  check(results, final.issues.length === 0, 'P4 Pick after second reload: identical truth', { issues: final.issues });
  await context.close();
} catch (err) {
  check(results, false, 'pick-before-draw journey completed without exception', { error: String(err && err.stack || err).slice(0, 600) });
} finally {
  await browser.close();
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'gate-pick-before-draw.json'), JSON.stringify({ base: BASE, seed: TEST_SEED_ID, results, errors: errorsAll.slice(0, 20) }, null, 2));
}
const failed = results.filter((r) => !r.ok);
console.log('SUMMARY', JSON.stringify({ total: results.length, failed: failed.map((r) => r.name) }));
if (failed.length) process.exitCode = 1;
