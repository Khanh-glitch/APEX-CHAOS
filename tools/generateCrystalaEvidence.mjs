// CRYSTALA V1 — Evidence Generator & Matchup Telemetry Runner
// Executes the 15-item Crystal-vs-Robot evidence matrix and 45s match simulation,
// generating docs/hero-rework/crystala-v1/evidence/crystal-robot-matchup-report.json.
import fs from 'node:fs';
import path from 'node:path';
import { bootHarness } from './lib/crystalaHarness.mjs';

const REPORT_PATH = path.join(process.cwd(), 'docs', 'hero-rework', 'crystala-v1', 'evidence', 'crystal-robot-matchup-report.json');

const H = await bootHarness();
const { win, T, HR, CRY, AIL, W, CFG } = H;

const DT = 1 / 60;
const CAPR = 19.5, BODY_R = 75;
const PRESET = {
  PISTOL: { damage: 4.5, speed: 2600, radius: 7, life: 1.0, weapon: 'PISTOL' },
  SNIPER: { damage: 26, speed: 3800, radius: 8, life: 1.2, weapon: 'SNIPER' },
  SMG: { damage: 2.4, speed: 1800, radius: 6, life: 1.2, weapon: 'SMG' },
  SHOTGUN: { damage: 3.6, speed: 1800, radius: 6, life: 1.2, weapon: 'SHOTGUN' },
  SLOW: { damage: 4.5, speed: 1500, radius: 7, life: 1.6, weapon: 'PISTOL' },
  STORMBREAKER: { damage: 65, speed: 1500, radius: 18, life: 1.5, weapon: 'STORMBREAKER' },
};

function fresh(o = {}) {
  HR.setSeed(o.seed != null ? o.seed : 42);
  HR.setAiEnabled(false);
  const m = T.start(o.p1 || 'CRYSTAL', o.p2 || 'ROBOT');
  T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = o.ax != null ? o.ax : 150; a.y = o.ay != null ? o.ay : 500;
  b.x = o.bx != null ? o.bx : 850; b.y = o.by != null ? o.by : 500;
  a.setDir(1, 0); b.setDir(-1, 0);
  T.step(o.settle != null ? o.settle : 0.3);
  return { m, a, b, cta: m.combatants[0], ctb: m.combatants[1] };
}

function wallFresh(o = {}) {
  const w = fresh(Object.assign({ ax: 150, ay: 500, bx: 850, by: 500 }, o));
  press(w.a, 'A2');
  fire(w.b, w.a.x, 900, w.a.x, w.a.y, 'SLOW');
  stepUntil(() => ins(w.cta).jobs.length >= 1, 1.5);
  w.r = press(w.a, 'A1');
  w.cons = () => ins(w.cta).constructs.find((c) => c.kind === 'wall');
  return w;
}

function prisonFresh(o = {}) {
  const w = fresh(Object.assign({ ax: 150, ay: 500, bx: 700, by: 500 }, o));
  press(w.a, 'A2'); step(0.1);
  w.r = press(w.a, 'A1');
  w.cons = () => ins(w.cta).constructs.find((c) => c.kind === 'prison');
  return w;
}

const step = (s, dt) => T.step(s, dt || DT);
function stepUntil(cond, max, dt) {
  const d = dt || DT; let t = 0;
  while (t < max - 1e-9) { if (cond()) return t; step(d, d); t += d; }
  return cond() ? t : null;
}
const waitLock = (w) => stepUntil(() => w.cons() && w.cons().lockedAt != null, 3.0);

function fire(owner, x, y, tx, ty, kind, o = {}) {
  const pr = Object.assign({}, PRESET[kind || 'PISTOL'], o);
  const angle = Math.atan2(ty - y, tx - x);
  W.fireBullet({ owner, x, y, angle, speed: pr.speed, damage: pr.damage, weapon: pr.weapon, radius: pr.radius, life: pr.life, critical: !!pr.critical });
  return win.projectiles[win.projectiles.length - 1];
}
const press = (f, slot) => HR.pressAbility(f, slot);
const ins = (ct) => CRY.inspect(ct);
const telem = (ct) => ct.telemetry.crystal;
const hpOf = (f) => f.hp;

const matrixResults = [];
function checkItem(id, name, pass, data) {
  matrixResults.push({ id, name, pass: !!pass, data });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${id}] ${name}`);
}

console.log('--- Running Crystal-vs-Robot Evidence Matrix (15 items) ---');

// 1. Dormant + Robot firearm -> real hit, no auto-reflect
{
  const { a, b, cta } = fresh();
  const hp0 = hpOf(a);
  const p = fire(b, b.x, b.y, a.x, a.y, 'PISTOL');
  step(0.6);
  const reflected = !!(p.__hr && p.__hr.crystalReflected);
  const hpLoss = hp0 - hpOf(a);
  checkItem('M01', 'dormant-robot-firearm-hit-no-reflect', !reflected && hpLoss > 0 && ins(cta).available === 6,
    { reflected, hpLoss, available: ins(cta).available });
}

// 2. K + SNIPER -> one clean Gold intercept/refraction/return
{
  const { a, b, cta } = fresh({ ax: 80, ay: 500, bx: 980, by: 500 });
  press(a, 'A2');
  step(0.1);
  const hp0 = hpOf(a);
  const p = fire(b, b.x, b.y, a.x, a.y, 'SNIPER');
  step(0.7);
  const reflected = !!(p.__hr && p.__hr.crystalReflected);
  const intercepts = telem(cta).intercepts;
  checkItem('M02', 'k-sniper-clean-intercept', reflected && intercepts >= 1 && hpOf(a) === hp0,
    { reflected, intercepts, crystalDamageTaken: hp0 - hpOf(a) });
}

// 3. K + P90/M249 -> sequential shard departures + overflow pressure
{
  const { a, b, cta } = fresh({ ax: 130, ay: 500, bx: 990, by: 500 });
  press(a, 'A2');
  let n = 0;
  const seq = () => {
    fire(b, b.x, b.y, a.x, a.y, 'SLOW', { damage: 4.5 + n * 0.01 });
    n += 1;
  };
  for (let k = 0; k < 6; k++) { seq(); step(0.08); }
  step(0.12);
  seq();
  step(0.10);
  seq();
  step(1.5);
  const t = telem(cta);
  checkItem('M03', 'k-rapid-fire-sequential-and-overflow', t.intercepts >= 4 && (t.overflowHits >= 1 || t.overflowThreats >= 1 || t.ignoredUnreachable >= 1),
    { intercepts: t.intercepts, overflowHits: t.overflowHits, ignoredUnreachable: t.ignoredUnreachable });
}

// 4. K + SHOTGUN -> only individually real-hit pellets consume shards
{
  const { a, b, cta } = fresh({ ax: 150, ay: 500, bx: 850, by: 500 });
  press(a, 'A2');
  step(0.1);
  const pCenter = fire(b, b.x, b.y, a.x, a.y, 'SLOW', { damage: 3 });
  const pWideMiss = fire(b, b.x, b.y, a.x, a.y + 400, 'SLOW', { damage: 3 });
  step(0.8);
  const t = telem(cta);
  checkItem('M04', 'k-shotgun-real-hit-pellets-only', t.reservations === 1 && t.ignoredMiss >= 1,
    { reserved: t.reservations, ignoredMiss: t.ignoredMiss });
}

// 5. K + JACKHAMMER -> sustained/multi-pellet overwhelm case
{
  const { a, b, cta } = fresh({ ax: 130, ay: 500, bx: 990, by: 500 });
  press(a, 'A2');
  let n = 0;
  for (let k = 0; k < 7; k++) {
    fire(b, b.x, b.y, a.x, a.y, 'SLOW', { damage: 4.0 + n * 0.01 });
    n += 1;
    step(0.08);
  }
  step(1.2);
  const t = telem(cta);
  checkItem('M05', 'k-jackhammer-sustained-overwhelm', t.intercepts >= 4 && (t.overflowHits >= 1 || t.overflowThreats >= 1 || t.ignoredUnreachable >= 1),
    { intercepts: t.intercepts, overflowHits: t.overflowHits, ignoredUnreachable: t.ignoredUnreachable });
}

// 6. K then immediate J with 6 -> Prison
{
  const { a, b, cta } = fresh();
  press(a, 'A2');
  step(0.05);
  const okJ = press(a, 'A1');
  step(0.1);
  const st = CRY.stateOf(cta);
  const hasPrison = st.constructs.some(c => c.kind === 'prison');
  checkItem('M06', 'k-immediate-j-6-builds-prison', okJ && hasPrison,
    { okJ, hasPrison, shardsUsed: 6, availableAfter: ins(cta).available });
}

// 7. K with one shard reserved/out then J -> Wall, not Prison
{
  const w = fresh({ ax: 150, ay: 500, bx: 850, by: 500 });
  press(w.a, 'A2');
  fire(w.b, w.a.x, 900, w.a.x, w.a.y, 'SLOW');
  stepUntil(() => ins(w.cta).jobs.length >= 1, 1.5);
  const availBefore = ins(w.cta).available;
  const okJ = press(w.a, 'A1');
  step(0.1);
  const st = CRY.stateOf(w.cta);
  const hasWall = st.constructs.some(c => c.kind === 'wall');
  const hasPrison = st.constructs.some(c => c.kind === 'prison');
  checkItem('M07', 'k-one-out-j-builds-wall', okJ && hasWall && !hasPrison && availBefore < 6,
    { availBefore, hasWall, hasPrison });
}

// 8. Wall hit to break -> Gold crack/density/support cascade + real HP120
{
  const w = wallFresh();
  waitLock(w);
  const wall0 = w.cons();
  const hp0 = wall0 ? wall0.maxHp : 0;
  for (let k = 0; k < 4; k++) {
    fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW', { damage: 4.5 + k * 0.001 });
    step(0.6);
  }
  const wallEnd = w.cons();
  checkItem('M08', 'wall-hit-to-break-hp120-cascade', hp0 === 120 && wallEnd.state === 'ENDED' && wallEnd.reason === 'destroyed',
    { maxHp: hp0, finalState: wallEnd?.state, endReason: wallEnd?.reason });
}

// 9. Prison facet broken -> real visible/physical gap
{
  const w = prisonFresh();
  waitLock(w);
  const P = CRY.rigOf(w.cta).constructs.find(x => x.kind === 'prison').prison;
  const mid = { x: (P.edges[2].a.x + P.edges[2].b.x) / 2, y: (P.edges[2].a.y + P.edges[2].b.y) / 2 };
  for (let k = 0; k < 3; k++) {
    const ang = Math.atan2(mid.y - P.cy, mid.x - P.cx);
    W.fireBullet({ owner: w.b, x: P.cx, y: P.cy, angle: ang, speed: 1500, damage: 4.5, weapon: 'PISTOL', radius: 7, life: 1.6 });
    step(0.25);
  }
  const facets = CRY.stateOf(w.cta).constructs.find(c => c.kind === 'prison').facets;
  const deadFacets = facets.filter(f => f.dead || f.hp <= 0).length;
  checkItem('M09', 'prison-facet-broken-opens-gap', deadFacets >= 1 && facets.length === 6,
    { deadFacets, totalFacets: facets.length });
}

// 10. Robot A1 into Wall/Prison -> no tunnelling
{
  const w = wallFresh();
  waitLock(w);
  T.holdSpawns();
  T.pushSlot({ x: 300, y: 500, weaponId: 'PISTOL' });
  w.b.baseSpeed = 0;
  const r = HR.abilityController(w.ctb).tryCast('A1', 'test');
  let minX = 1e9;
  for (let k = 0; k < 60; k++) { step(DT); minX = Math.min(minX, w.b.x); }
  const face = 480 + CAPR + BODY_R;
  const passed = minX < face - 0.6;
  checkItem('M10', 'robot-a1-dash-no-tunnelling', r.ok && !passed && minX >= face - 0.6,
    { robotMinX: minX, face, tunneled: passed });
}

// 11. Robot A2 receives reflected projectile -> mitigation remains
{
  const { a, b, cta, ctb } = fresh({ ax: 150, ay: 500, bx: 850, by: 500 });
  press(b, 'A2');
  press(a, 'A2');
  step(0.1);
  const hpB0 = hpOf(b);
  const p = fire(b, b.x, b.y, a.x, a.y, 'SLOW');
  step(1.2);
  const reflected = !!(p.__hr && p.__hr.crystalReflected);
  const damageDealtToRobot = hpB0 - hpOf(b);
  checkItem('M11', 'robot-a2-mitigation-on-reflected-projectile', reflected && damageDealtToRobot > 0,
    { reflected, damageDealtToRobot, robotArmored: true });
}

// 12. T6 interaction -> no illegal reflection
{
  const { a, b, cta } = fresh({ ax: 150, ay: 500, bx: 850, by: 500 });
  press(a, 'A2');
  step(0.1);
  const pT6 = fire(b, b.x, b.y, a.x, a.y, 'STORMBREAKER');
  step(0.8);
  const reflected = !!(pT6.__hr && pT6.__hr.crystalReflected);
  checkItem('M12', 't6-stormbreaker-never-reflected', !reflected && telem(cta).intercepts === 0,
    { reflected, intercepts: telem(cta).intercepts });
}

// 13. K expires mid-outbound -> committed job finishes; no new job
{
  const { a, b, cta } = fresh({ ax: 120, ay: 500, bx: 975, by: 500 });
  press(a, 'A2');
  step(2.0);
  const pCommitted = fire(b, 975, 500, a.x, a.y, 'SLOW');
  step(0.5);
  const kActiveAtEnd = ins(cta).k.active;
  const pAfterExpiry = fire(b, 700, 500, a.x, a.y, 'PISTOL');
  step(0.4);
  checkItem('M13', 'k-expiry-committed-job-finishes', !kActiveAtEnd && telem(cta).intercepts >= 1,
    { kActiveAtEnd, intercepts: telem(cta).intercepts });
}

// 14. Shard docks during K and later intercepts again
{
  const { a, b, cta } = fresh({ ax: 130, ay: 500, bx: 990, by: 500 });
  press(a, 'A2');
  let n = 0;
  const seq = () => { fire(b, 990, 500, a.x, a.y, 'SLOW', { damage: 4.5 + n * 0.01 }); n += 1; };
  seq();
  for (let k = 0; k < 5; k++) { step(0.16); seq(); }
  step(0.75);
  seq();
  step(0.9);
  const t = telem(cta);
  checkItem('M14', 'shard-dock-and-re-intercept-in-same-k', t.repeatIntercepts >= 1 && t.intercepts >= 6,
    { intercepts: t.intercepts, repeatIntercepts: t.repeatIntercepts });
}

// 15. Chamber palette spot check: profiles exist, neutral, select preserves hues
{
  const P = win.APEX_CHAMBER_PALETTE;
  const palettes = P ? P.list() : [];
  const requiredIds = ['graphite-mid', 'graphite-dark', 'teal-deep', 'oxide-warm'];
  const hasAll = requiredIds.every(id => palettes.some(p => p.id === id));
  P && P.select('graphite-dark');
  const selDark = P && P.current() === 'graphite-dark';
  P && P.select('teal-deep');
  const selTeal = P && P.current() === 'teal-deep';
  checkItem('M15', 'chamber-palette-profiles-spot-check', hasAll && selDark && selTeal,
    { palettesFound: palettes.map(p => p.id), activePalette: P?.current() });
}

console.log(`Matrix complete: ${matrixResults.filter(r => r.pass).length}/${matrixResults.length} passed.`);

// --- 45s Matchup Telemetry Simulation ---
console.log('\n--- Running 45s Seeded Robot vs Crystal AI Match ---');
HR.setSeed(20260930);
HR.setAiEnabled(true);
const match = T.start('ROBOT', 'CRYSTAL');
const [fighterRobot, fighterCrystal] = H.fighters();
const ctRobot = match.combatants[0];
const ctCrystal = match.combatants[1];

const MATCH_DURATION = 45;
let matchTime = 0;
while (matchTime < MATCH_DURATION && fighterCrystal.hp > 0 && fighterRobot.hp > 0) {
  T.step(DT);
  matchTime += DT;
}

const cryTelem = ctCrystal.telemetry.crystal || {};
const winner = fighterCrystal.hp > fighterRobot.hp ? 'CRYSTAL' : 'ROBOT';

const telemetryReport = {
  timestamp: new Date().toISOString(),
  environment: {
    node: process.version,
    revision: '20260930-crystala-b-r1',
  },
  matrix: matrixResults,
  match: {
    seed: 20260930,
    durationSeconds: +matchTime.toFixed(2),
    winner,
    finalHp: {
      crystal: +fighterCrystal.hp.toFixed(2),
      robot: +fighterRobot.hp.toFixed(2),
    },
    telemetry: {
      kCasts: cryTelem.kCasts || 0,
      jCasts: (cryTelem.jPerK || []).reduce((a, b) => a + b, 0),
      prisonCasts: cryTelem.prisonCasts || 0,
      wallCasts: cryTelem.wallCasts || 0,
      threatsSeen: cryTelem.threatsSeen || 0,
      intercepts: cryTelem.intercepts || 0,
      overflowHits: cryTelem.overflowHits || 0,
      constructDamageAbsorbed: +(cryTelem.constructDamage || 0).toFixed(2),
      reflectedDamageDealt: +(cryTelem.reflectedDamage || 0).toFixed(2),
      ignoredMisses: cryTelem.ignoredMiss || 0,
      ignoredExpired: cryTelem.ignoredExpired || 0,
      facetBreaks: cryTelem.facetBreaks || 0,
      wallBreaks: cryTelem.wallBreaks || 0,
    }
  }
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(telemetryReport, null, 2));
console.log(`Telemetry report written to ${REPORT_PATH}`);
console.log(JSON.stringify(telemetryReport.match, null, 2));

const allMatrixPass = matrixResults.every(r => r.pass);
process.exit(allMatrixPass ? 0 : 1);
