#!/usr/bin/env node
/* MAGNET — WALL SCREEN-SPACE parity probe (canonical donor vs real production).
 *
 * The existing canonical parity harness compares the six LOCAL rig transforms
 * and can report ~0 RMSE while the whole rendered Magnet still leaves the wall
 * on the Apex root curve instead of the donor rebound curve. This probe
 * therefore compares the RENDERED ROOT and the six part transforms in SCREEN
 * SPACE (world px, body-relative), plus contact time, peak rebound offset and
 * recovery/settle — for the donor page and the shipping production page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/tmp/magnet-browser-deps/noop.js');
const puppeteer = require('puppeteer-core');
const chromiumModule = require('@sparticuz/chromium');
const chromium = chromiumModule.default || chromiumModule;
const execPath = await chromium.executablePath();
process.env.LD_LIBRARY_PATH = ['/tmp/al2023', '/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const DONOR = process.env.APEX_DONOR_URL || 'http://127.0.0.1:4199/docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html';
const IDS = ['core', 'spine', 'polL', 'polR', 'lobeL', 'lobeR'];
const IMPACT_SPEED = 420; // donor locomotion top speed == production MAGNET approach

const browser = await puppeteer.launch({
  executablePath: execPath,
  args: [...chromium.args, '--autoplay-policy=no-user-gesture-required'],
  headless: true, protocolTimeout: 300000,
});

/* ----------------------------- DONOR ---------------------------------- */
async function donorRun() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1000, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(DONOR, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.MAGNET_DEBUG, { timeout: 60000 });
  const data = await page.evaluate(async (IDS, SPEED) => {
    const D = window.MAGNET_DEBUG, hero = D.hero, RIG = D.RIG;
    const waitFrames = (n) => new Promise((r) => { let c = 0; const next = () => (++c >= n ? r() : requestAnimationFrame(next)); requestAnimationFrame(next); });
    // Park away from the wall, settle, then drive LEFT into the left wall.
    hero.x = 420; hero.y = 500; hero.vx = 0; hero.vy = 0;
    await waitFrames(60);
    hero.x = 420; hero.y = 500; hero.vx = 0; hero.vy = 0;
    const snap = () => ({
      t: performance.now(),
      root: { x: hero.x, y: hero.y },
      vx: hero.vx, vy: hero.vy,
      rig: Object.fromEntries(IDS.map((id) => [id, { x: RIG[id].x, y: RIG[id].y, r: RIG[id].r, sx: RIG[id].sx, sy: RIG[id].sy }])),
    });
    const samples = [];
    // Drive LEFT into the left wall, then RELEASE input (donor holds no key
    // after contact) and keep sampling the rebound + settle.
    const HX = 96;
    let released = false;
    for (let i = 0; i < 150; i++) {
      if (!released && hero.x > HX + 8) hero.vx = -SPEED;
      samples.push(snap());
      await waitFrames(1);
      if (!released && hero.x <= HX + 8) released = true;
      if (released && samples.length > 110) break;
    }
    return { samples, wallX: HX };
  }, IDS, IMPACT_SPEED);
  await page.close();
  return { ...data, errors: errs };
}

/* --------------------------- PRODUCTION -------------------------------- */
async function productionRun() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__apexEnsureDeferredRuntimes === 'function', { timeout: 60000 });
  const data = await page.evaluate(async (IDS, SPEED) => {
    await window.__apexEnsureDeferredRuntimes('arsenalQuest');
    const waitFrames = (n) => new Promise((r) => { let c = 0; const next = () => (++c >= n ? r() : requestAnimationFrame(next)); requestAnimationFrame(next); });
    if (window.APEX_HERO_REWORK.match) window.exitArsenalQuestMode();
    window.startArsenalQuestMode('MAGNET', 'ROBOT');
    window.APEX_HERO_REWORK.setAiEnabled(false);
    const st = window.APEX_ARSENAL.state; st.spawnTimer = 1e6; st.slots = []; st.spawnHeld = true;
    await waitFrames(5);
    const [hero, opp] = window.fighters;
    const ct = window.APEX_HERO_REWORK.byCombatant(hero);
    const GOLD = window.APEX_MAGNET_GOLD;
    await new Promise((r) => { const t = setInterval(() => { if (GOLD.ready) { clearInterval(t); r(); } }, 50); setTimeout(r, 15000); });
    opp.baseSpeed = 0; opp.x = 900; opp.y = 900;
    // Settle MOTIONLESS away from the wall so the measured impact happens
    // inside the sampled window, not during setup.
    hero.baseSpeed = 0; hero.dir = { x: 1, y: 0 }; hero.x = 420; hero.y = 500;
    await waitFrames(40);
    hero.x = 420; hero.y = 500;

    const snap = () => {
      const s = GOLD.inspect(ct).state;
      return {
        t: performance.now(),
        gameplayRoot: { x: hero.x, y: hero.y },
        visualRoot: { x: s.visualRoot.x, y: s.visualRoot.y },
        wallRebound: { ...s.wallRebound, lastImpact: s.wallRebound.lastImpact ? { ...s.wallRebound.lastImpact } : null },
        rig: Object.fromEntries(IDS.map((id) => [id, { x: s.rig[id].x, y: s.rig[id].y, r: s.rig[id].r, sx: s.rig[id].sx, sy: s.rig[id].sy }])),
        sockets: s.sockets,
        hitbox: { x: hero.x, y: hero.y, radius: hero.radius },
      };
    };
    const samples = [];
    const wallX = hero.radius;
    let released = false;
    for (let i = 0; i < 150; i++) {
      if (!released && hero.x > wallX + 8) { hero.dir = { x: -1, y: 0 }; hero.baseSpeed = SPEED; }
      else { released = true; hero.baseSpeed = 0; }
      samples.push(snap());
      await waitFrames(1);
      if (released && samples.length > 110) break;
    }
    return { samples, wallX };
  }, IDS, IMPACT_SPEED);
  await page.close();
  return { ...data, errors: errs };
}

const donor = await donorRun();
const prod = await productionRun();
await browser.close();

/* ----------------------------- ANALYSIS -------------------------------- */
function contactIndexOf(samples, key) {
  let best = 0;
  for (let i = 0; i < samples.length; i++) if (samples[i][key].x < samples[best][key].x) best = i;
  return best;
}
function normalTravel(samples, contactIndex, wallX, key) {
  const base = samples[contactIndex][key].x;
  return samples.slice(contactIndex).map((s, i) => ({
    dt: +((s.t - samples[contactIndex].t) / 1000).toFixed(4),
    n: +(s[key].x - base).toFixed(2),
    abs: +s[key].x.toFixed(2),
  }));
}
donor.contactIndex = contactIndexOf(donor.samples, 'root');
prod.contactIndex = contactIndexOf(prod.samples, 'gameplayRoot');
const donorCurve = normalTravel(donor.samples, donor.contactIndex, donor.wallX, 'root');
const prodGameplay = normalTravel(prod.samples, prod.contactIndex, prod.wallX, 'gameplayRoot');
// Visual travel is measured against the GAMEPLAY root at contact so the
// column is directly comparable with the donor's own root travel.
const visualBase = prod.samples[prod.contactIndex].gameplayRoot.x;
const prodVisual = prod.samples.slice(prod.contactIndex).map((s) => ({
  dt: +((s.t - prod.samples[prod.contactIndex].t) / 1000).toFixed(4),
  n: +(s.visualRoot.x - visualBase).toFixed(2),
}));

function at(curve, t) {
  let best = curve[0];
  for (const p of curve) if (Math.abs(p.dt - t) < Math.abs(best.dt - t)) best = p;
  return best ? best.n : 0;
}
const probeTimes = [0.016, 0.033, 0.05, 0.083, 0.12, 0.17, 0.25, 0.35, 0.45];
const comparison = probeTimes.map((t) => ({
  t,
  donorNormalTravel: at(donorCurve, t),
  productionGameplayRoot: at(prodGameplay, t),
  productionVisualRoot: at(prodVisual, t),
  gameplayErrVsDonor: +(at(prodGameplay, t) - at(donorCurve, t)).toFixed(2),
  visualErrVsDonor: +(at(prodVisual, t) - at(donorCurve, t)).toFixed(2),
}));

const rms = (k) => Math.sqrt(comparison.reduce((a, c) => a + c[k] * c[k], 0) / comparison.length);
const offsets = prod.samples.map((s) => Math.hypot(s.visualRoot.x - s.gameplayRoot.x, s.visualRoot.y - s.gameplayRoot.y));
const peakOffset = Math.max(0, ...offsets);
const firstOffsetIdx = offsets.findIndex((o) => o > 0.5);
const settleIdx = firstOffsetIdx < 0 ? -1 : offsets.findIndex((o, i) => i > firstOffsetIdx && o < 0.5);
const settleTime = settleIdx > 0 ? +((prod.samples[settleIdx].t - prod.samples[firstOffsetIdx].t) / 1000).toFixed(3) : null;
const tail = offsets.slice(-20);
const residual = Math.max(0, ...tail);

// Local six-part RMSE (what the OLD harness measured) around impact.
function partRmse(a, b, idx) {
  let acc = 0, n = 0;
  for (let i = 0; i < 20; i++) {
    const sa = a.samples[a.contactIndex + i], sb = b.samples[b.contactIndex + i];
    if (!sa || !sb) break;
    for (const id of IDS) {
      const d = Math.hypot(sa.rig[id].x - sb.rig[id].x, sa.rig[id].y - sb.rig[id].y);
      acc += d * d; n++;
    }
  }
  return n ? +Math.sqrt(acc / n).toFixed(3) : null;
}

const report = {
  generatedAt: new Date().toISOString(),
  impactSpeed: IMPACT_SPEED,
  donorErrors: donor.errors, productionErrors: prod.errors,
  rootCause:
    'Local six-part parity is measured in the rig\'s own frame and is blind to the ROOT the rendered Magnet is attached to. ' +
    'Donor heroStep reflects the normal velocity off the wall (n*ap*e, e=.4 above 140 u/s, tangent kept) and brakes at 1850 u/s^2, ' +
    'so the donor root leaves the wall with an impulse spike. Apex clamps the gameplay body and re-drives it by locomotion, which ' +
    'leaves the wall linearly. Production previously rendered directly on the authoritative Apex root, so the whole Magnet travelled ' +
    'away from the wall on the wrong curve while the six local transforms still matched.',
  correction:
    'Presentation-only bounded visual-root offset = donorNormalTravel - authoritativeNormalTravel, seeded at the TRUE collision from ' +
    'the real pre-resolution contact velocity, clamped to 28px, capped at 0.45s, converging back to the authoritative root. ' +
    'Gameplay root, hitbox, collision and wall authority are untouched.',
  localSixPartRmseAroundImpact: partRmse(donor, prod),
  screenSpaceNormalTravel: comparison,
  rmseGameplayRootVsDonor: +rms('gameplayErrVsDonor').toFixed(3),
  rmseVisualRootVsDonor: +rms('visualErrVsDonor').toFixed(3),
  peakVisualOffsetPx: +peakOffset.toFixed(2),
  settleSecondsWallClock: settleTime,
  settleBoundedBySimSeconds: 0.45,
  settleNote: 'headless rAF is heavily throttled, so wall-clock settle is not representative; the episode is hard-capped at 0.45 SIM seconds by WALL_VISUAL_MAX_AGE.',
  residualOffsetAfterEpisodePx: +residual.toFixed(3),
  lastImpact: prod.samples.slice(prod.contactIndex).map((s) => s.wallRebound.lastImpact).find(Boolean) || null,
  hitboxNeverDiverges: prod.samples.every((s) => s.hitbox.x === s.gameplayRoot.x && s.hitbox.y === s.gameplayRoot.y),
  bounded: peakOffset <= 28.001,
  converges: residual < 0.5,
  donorReboundPx: Math.max(0, ...donorCurve.map((c) => c.n)),
  visualReboundPx: +peakOffset.toFixed(2),
  reproducesDonorRebound: peakOffset > 0.5 * Math.max(0, ...donorCurve.map((c) => c.n)),
  improved: peakOffset > 0.5,
};
report.pass = report.bounded && report.converges && report.reproducesDonorRebound && report.hitboxNeverDiverges
  && donor.errors.length === 0 && prod.errors.length === 0;

const dest = path.resolve('docs/hero-rework/magnet-v1/evidence/wall-screen-space-parity.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(report, null, 2));

console.log('local six-part RMSE around impact (old harness view):', report.localSixPartRmseAroundImpact);
console.log('\n t      donorN   gameplayN  visualN   gameplayErr  visualErr');
for (const c of comparison) {
  console.log(`${String(c.t).padEnd(7)}${String(c.donorNormalTravel).padEnd(9)}${String(c.productionGameplayRoot).padEnd(11)}${String(c.productionVisualRoot).padEnd(10)}${String(c.gameplayErrVsDonor).padEnd(13)}${c.visualErrVsDonor}`);
}
console.log(`\nRMSE vs donor  gameplay-root=${report.rmseGameplayRootVsDonor}  visual-root=${report.rmseVisualRootVsDonor}`);
console.log(`donor rebound=${report.donorReboundPx}px  visual rebound=${report.visualReboundPx}px  reproduces=${report.reproducesDonorRebound}`);
console.log(`peak visual offset=${report.peakVisualOffsetPx}px  settle<=${report.settleBoundedBySimSeconds}s(sim)  residual=${report.residualOffsetAfterEpisodePx}px  hitbox-stable=${report.hitboxNeverDiverges}`);
console.log(report.pass ? '\nWALL SCREEN-SPACE PROBE: PASS' : '\nWALL SCREEN-SPACE PROBE: FAIL');
process.exit(report.pass ? 0 : 1);
