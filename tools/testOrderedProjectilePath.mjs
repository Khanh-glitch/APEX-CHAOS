#!/usr/bin/env node
/* ORDERED PROJECTILE PATH — directed compatibility gates (Checkpoint A).
 *
 * Magnet A2 produces a REAL cornered path for a projectile in a frame:
 *     frameStart -> R=225 time-of-impact -> post-A2 endpoint
 * Every swept consumer that needs physical truth must read that ordered path
 * (HR.geom.pathSegments) instead of the false frameStart->final chord, must
 * report a GLOBAL frame TOI, and must be adjudicated in true physical order.
 *
 * These gates are deterministic and run against the REAL runtimes.
 */
import { bootHarness } from './lib/crystalaHarness.mjs';
import fs from 'node:fs';

const H = await bootHarness();
const { win } = H;
const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

const HR = win.APEX_HERO_REWORK;
const MAG = win.APEX_MAGNET;
const CR = win.APEX_CRYSTAL;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;

const G = HR.geom;

function start(p1 = 'MAGNET', p2 = 'CRYSTAL') {
  if (HR.match) win.exitArsenalQuestMode();
  win.startArsenalQuestMode(p1, p2);
  HR.setAiEnabled(false);
  const st = win.APEX_ARSENAL.state;
  st.spawnTimer = 1e6; st.slots = []; st.spawnHeld = true; st.unarmedFastConsumed = true;
  const [a, b] = win.fighters;
  a.baseSpeed = 0; b.baseSpeed = 0;
  return { a, b, ct: HR.byCombatant(a) };
}

/* ============================================ P0: the shared representation */
try {
  const p = { aq: true, type: 'aq_bullet', px: 0, py: 0, x: 100, y: 0, vx: 1, vy: 0, __hr: {} };
  const one = G.pathSegments(p);
  const plainOk = one.length === 1 && one[0].x0 === 0 && one[0].y0 === 0
    && one[0].x1 === 100 && one[0].y1 === 0 && one[0].t0 === 0 && one[0].t1 === 1;
  gate('P0.1-no-corner-equals-single-chord', plainOk, one);

  p.__hr.pathVia = { x: 40, y: 30, t: 0.4 };
  const two = G.pathSegments(p);
  const orderedOk = two.length === 2
    && two[0].t0 === 0 && two[0].t1 === 0.4 && two[1].t0 === 0.4 && two[1].t1 === 1
    && two[0].x1 === 40 && two[0].y1 === 30
    && two[1].x0 === 40 && two[1].y0 === 30
    && two[0].x0 === 0 && two[1].x1 === 100;
  gate('P0.2-corner-is-ordered-with-global-fractions', orderedOk, two);
  gate('P0.3-segment-join-is-continuous',
    two[0].x1 === two[1].x0 && two[0].y1 === two[1].y0, { join: [two[0].x1, two[0].y1] });

  // clearPath must restore exact single-chord equivalence.
  G.clearPath(p);
  const back = G.pathSegments(p);
  gate('P0.4-clearPath-restores-single-chord',
    back.length === 1 && back[0].t0 === 0 && back[0].t1 === 1, back);
} catch (e) { gate('P0.1-no-corner-equals-single-chord', false, String(e)); }

/* ================================================== CRYSTALA A / B / C */
// Build a real LIVE Crystala construct and fire a projectile whose frame has a
// Magnet-style corner, then check which leg the construct is actually on.
function crystalScenario(label, { via, capAt, expectContact }) {
  const o = start('MAGNET', 'CRYSTAL');
  const cct = HR.byCombatant(o.b);
  // A real solid construct from the real Crystala runtime.
  for (let i = 0; i < 5; i++) win.APEX_ARSENAL.step(1 / 60);     // settle
  HR.pressAbility(o.b, 'A1');   // crystal.context_construct
  for (let i = 0; i < 30; i++) win.APEX_ARSENAL.step(1 / 60);
  const caps = CR.capsules();
  if (!caps.length) return { label, skipped: 'no live construct capsules' };
  // Move the first capsule onto the requested point.
  const cap = caps[0];
  const hw = (cap.bx - cap.ax) / 2, hh = (cap.by - cap.ay) / 2;
  cap.ax = capAt.x - hw; cap.ay = capAt.y - hh;
  cap.bx = capAt.x + hw; cap.by = capAt.y + hh;
  const p = {
    aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 1, radius: 7,
    owner: o.a, damage: 10, critical: false, __hr: {},
    px: via.px, py: via.py, x: via.x1, y: via.y1, vx: 1000, vy: 0,
  };
  if (via.pathVia) p.__hr.pathVia = via.pathVia;
  const res = CR.resolveBullet(p, 2, 1 / 60);
  return { label, consumed: !!(res && res.consumed), expectContact, cap: { ax: cap.ax, ay: cap.ay, bx: cap.bx, by: cap.by } };
}

// Geometry: frame start (200,500) -> corner (500,500) at t=0.5 -> end (500,800).
// The false chord runs diagonally from (200,500) to (500,800) and passes near
// (350,650) -- a point on NEITHER real leg.
const CORNER = { px: 200, py: 500, x1: 500, y1: 800, pathVia: { x: 500, y: 500, t: 0.5 } };

try {
  const a = crystalScenario('A', { via: CORNER, capAt: { x: 330, y: 500 }, expectContact: true });
  gate('CRYSTALA-A-contact-on-real-inbound-leg', a.skipped ? false : a.consumed === true, a);
} catch (e) { gate('CRYSTALA-A-contact-on-real-inbound-leg', false, String(e)); }

try {
  const b = crystalScenario('B', { via: CORNER, capAt: { x: 350, y: 650 }, expectContact: false });
  gate('CRYSTALA-B-no-contact-on-false-chord-only', b.skipped ? false : b.consumed === false, b);
} catch (e) { gate('CRYSTALA-B-no-contact-on-false-chord-only', false, String(e)); }

try {
  const c = crystalScenario('C', { via: CORNER, capAt: { x: 500, y: 700 }, expectContact: true });
  gate('CRYSTALA-C-contact-on-real-outbound-leg', c.skipped ? false : c.consumed === true, c);
} catch (e) { gate('CRYSTALA-C-contact-on-real-outbound-leg', false, String(e)); }

/* ============================================ ORDERING: Crystal before Magnet */
// A contact earlier in the frame than the pending Magnet boundary must revoke
// the Magnet entry so no capture beat is presented for an event that never
// physically happened.
try {
  const o = start('MAGNET', 'CRYSTAL');
  const p = {
    aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 1, radius: 7,
    owner: o.b, damage: 10, critical: false, __hr: { pathVia: { x: 500, y: 500, t: 0.5 } },
    px: 200, py: 500, x: 500, y: 800, vx: 1000, vy: 0,
  };
  const revoked = G.supersedeMagnetBoundary(p, 0.2);   // earlier than t=0.5
  const cleared = !(p.__hr && p.__hr.pathVia);
  gate('ORDER-earlier-event-supersedes-magnet-boundary', revoked === true && cleared,
    { revoked, cleared });

  const p2 = {
    aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 1, radius: 7,
    owner: o.b, damage: 10, critical: false, __hr: { pathVia: { x: 500, y: 500, t: 0.5 } },
    px: 200, py: 500, x: 500, y: 800, vx: 1000, vy: 0,
  };
  const notRevoked = G.supersedeMagnetBoundary(p2, 0.8); // later than t=0.5
  gate('ORDER-later-event-does-not-supersede',
    notRevoked === false && !!(p2.__hr && p2.__hr.pathVia), { notRevoked });
} catch (e) { gate('ORDER-earlier-event-supersedes-magnet-boundary', false, String(e)); }

/* ============================================ MAGNET capture beat withdrawal */
try {
  const o = start('MAGNET', 'ROBOT');
  o.a.x = 500; o.a.y = 500;
  HR.pressAbility(o.a, 'A2');
  const p = {
    aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 1, radius: 7,
    owner: o.b, damage: 10, critical: false, __hr: {},
    x: 500 - 300, y: 500, vx: 2600, vy: 0,
  };
  // step until the real entry fires
  let fired = false;
  for (let i = 0; i < 10 && !fired; i++) {
    MAG.stepProjectiles(1 / 60, [p], HR.byCombatant, win.matchClock);
    const snap = MAG.inspect(win.matchClock);
    if (snap.captureEvents && snap.captureEvents.length) fired = true;
    else { const pl = MAG.consumeMovementPlan(p); if (!pl) { p.x += p.vx / 60; p.y += p.vy / 60; } }
  }
  const before = MAG.inspect(win.matchClock).captureEvents.length;
  MAG.revokeEntry(p);
  const after = MAG.inspect(win.matchClock).captureEvents.length;
  gate('MAGNET-capture-beat-withdrawn-on-revoke', fired && before === 1 && after === 0,
    { fired, before, after });
} catch (e) { gate('MAGNET-capture-beat-withdrawn-on-revoke', false, String(e)); }

/* ====================================================== MIRROR A / B / C */
// Drive a REAL corner frame: feed Magnet's own movement-plan seam so the real
// production integration in reworkUpdateProjectiles() builds the ordered path,
// then let the real mirrorRoute() consume it. Nothing about the path is
// hand-written -- only the plan Magnet itself would have published.
//
// frameStart (200,500) -> corner (500,500) at t=0.5 -> end (500,800).
// The false chord runs diagonally and passes near (350,650): a point on
// NEITHER real leg.
const DT = 1 / 60;
function cornerPlan() {
  return {
    entryT: 0.5, entryX: 500, entryY: 500,
    preVx: 300 / (DT * 0.5), preVy: 0,      // (200,500) -> (500,500) by t=0.5
    postVx: 0, postVy: 300 / (DT * 0.5),    // (500,500) -> (500,800) by t=1
  };
}
function withCornerFrame(p, fn) {
  const MAGR = win.APEX_MAGNET;
  const realConsume = MAGR.consumeMovementPlan;
  let served = false;
  MAGR.consumeMovementPlan = function (proj) {
    if (proj === p && !served) { served = true; return cornerPlan(); }
    return realConsume.call(this, proj);
  };
  try { return fn(); } finally { MAGR.consumeMovementPlan = realConsume; }
}

function mirrorScenario({ portalAt }) {
  const o = start('MIRROR', 'ROBOT');
  const M = HR.match;
  M.world.mirrors.length = 0;
  const m1 = M.api.spawnMirrorPortal({ owner: o.a, x: portalAt.x, y: portalAt.y });
  const m2 = M.api.spawnMirrorPortal({ owner: o.a, x: 900, y: 120 });
  const plan = cornerPlan();
  const p = {
    aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 1, radius: 7,
    owner: o.b, damage: 10, critical: false, __hr: {},
    x: 200, y: 500, vx: plan.preVx, vy: plan.preVy,
  };
  win.projectiles.length = 0; win.projectiles.push(p);
  const routed = [];
  const AIL = win.APEX_HERO_REWORK_AIL;
  const un = AIL.bus.on('MirrorPortalRoute', (e) => routed.push(e.payload || e));
  withCornerFrame(p, () => win.APEX_ARSENAL.weaponApi.updateArsenalProjectiles(DT));
  un();
  return { routed: routed.length, p, m1, m2, toi: routed[0] && routed[0].toi };
}

try {
  // Portal centred on the real inbound leg.
  const r = mirrorScenario({ portalAt: { x: 330, y: 500 } });
  gate('MIRROR-A-routes-on-real-segment', r.routed === 1, { routed: r.routed });
  gate('MIRROR-A-no-stale-path-after-relocation', !(r.p.__hr && r.p.__hr.pathVia),
    { pathVia: r.p.__hr && r.p.__hr.pathVia });
} catch (e) { gate('MIRROR-A-routes-on-real-segment', false, String(e)); }

try {
  // Portal only on the false chord (350,650) -- on neither real leg.
  const r = mirrorScenario({ portalAt: { x: 350, y: 650 } });
  gate('MIRROR-B-no-route-on-false-chord-only', r.routed === 0, { routed: r.routed });
} catch (e) { gate('MIRROR-B-no-route-on-false-chord-only', false, String(e)); }

try {
  // After relocation the stale portalExit -> oldMagnetBoundary geometry must
  // not produce a phantom body hit. Put a fighter exactly on that stale line.
  const o = start('MIRROR', 'ROBOT');
  const M = HR.match;
  M.world.mirrors.length = 0;
  M.api.spawnMirrorPortal({ owner: o.a, x: 330, y: 500 });
  const exitPortal = M.api.spawnMirrorPortal({ owner: o.a, x: 900, y: 120 });
  const p = {
    aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 1, radius: 7,
    owner: o.b, damage: 25, critical: false, __hr: {},
    px: 200, py: 500, x: 500, y: 800, vx: 0, vy: 0,
  };
  p.__hr.pathVia = { x: 500, y: 500, t: 0.5 };
  // Victim sits on the midpoint of portalExit -> oldMagnetBoundary.
  o.b.x = (exitPortal.x + 500) / 2; o.b.y = (exitPortal.y + 500) / 2;
  const hpBefore = o.b.hp;
  win.projectiles.length = 0; win.projectiles.push(p);
  win.APEX_ARSENAL.weaponApi.updateArsenalProjectiles(0);
  gate('MIRROR-C-no-phantom-body-hit-across-teleport',
    o.b.hp === hpBefore && !(p.__hr && p.__hr.pathVia),
    { hpBefore, hpAfter: o.b.hp, pathVia: p.__hr && p.__hr.pathVia });
} catch (e) { gate('MIRROR-C-no-phantom-body-hit-across-teleport', false, String(e)); }

if (HR.match) win.exitArsenalQuestMode();

fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/ordered-path-gates.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2));

const total = Object.keys(report.gates).length;
const passed = total - report.failures.length;
console.log(`\n[ORDERED PROJECTILE PATH] ${passed}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
