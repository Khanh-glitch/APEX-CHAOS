#!/usr/bin/env node
/* CHECKPOINT A-R — ordered event supersession + segment kinematic truth.
 *
 * Checkpoint A gave every swept consumer the real cornered path. A-R closes
 * the remaining physical-order gap:
 *
 *  1. SEGMENT KINEMATIC TRUTH. The Magnet integration writes the POST-response
 *     velocity onto p.vx/p.vy before any later consumer adjudicates. A
 *     consumer resolving an event on the INBOUND leg must use that leg's
 *     pre-Magnet velocity, never p.vx.
 *
 *  2. SELECTIVE SUPERSESSION. Being earlier than the Magnet boundary is not
 *     sufficient to cancel it. Only a terminal or trajectory-changing event
 *     supersedes. A Crystal breaking-shot pass-through resolves first and the
 *     SAME projectile still physically reaches the boundary afterwards.
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
const G = HR.geom;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;

const DT = 1 / 60;
function start(p1, p2) {
  if (HR.match) win.exitArsenalQuestMode();
  win.startArsenalQuestMode(p1, p2);
  HR.setAiEnabled(false);
  const st = win.APEX_ARSENAL.state;
  st.spawnTimer = 1e6; st.slots = []; st.spawnHeld = true; st.unarmedFastConsumed = true;
  const [a, b] = win.fighters;
  a.baseSpeed = 0; b.baseSpeed = 0; a.dir.x = 0; a.dir.y = 0; b.dir.x = 0; b.dir.y = 0;
  return { a, b };
}

/* A real Magnet corner built through Magnet's OWN movement-plan seam, so the
 * production integration in reworkUpdateProjectiles() constructs the path.
 * frameStart (200,500) -> corner (500,500) at t=0.5 -> end (500,800).
 * PRE velocity is +X; POST velocity is +Y. They are deliberately orthogonal so
 * any consumer using the wrong one is unmistakable. */
const PRE_VX = 300 / (DT * 0.5), PRE_VY = 0;
const POST_VX = 0, POST_VY = 300 / (DT * 0.5);
function cornerPlan() {
  return { entryT: 0.5, entryX: 500, entryY: 500, preVx: PRE_VX, preVy: PRE_VY, postVx: POST_VX, postVy: POST_VY };
}
function withCorner(p, fn) {
  const real = MAG.consumeMovementPlan;
  let served = false;
  MAG.consumeMovementPlan = function (proj) {
    if (proj === p && !served) { served = true; return cornerPlan(); }
    return real.call(this, proj);
  };
  try { return fn(); } finally { MAG.consumeMovementPlan = real; }
}
function mkBullet(owner, over) {
  return Object.assign({
    aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 1, radius: 7,
    owner, damage: 10, critical: false, __hr: {},
    x: 200, y: 500, vx: PRE_VX, vy: PRE_VY,
  }, over || {});
}

/* ===================== A-R1 segment kinematic truth ===================== */
try {
  const p = { px: 200, py: 500, x: 500, y: 800, vx: POST_VX, vy: POST_VY,
    __hr: { pathVia: { x: 500, y: 500, t: 0.5, preVx: PRE_VX, preVy: PRE_VY, postVx: POST_VX, postVy: POST_VY } } };
  const segs = G.pathSegments(p);
  gate('AR1-segments-carry-their-own-velocity',
    segs.length === 2 && segs[0].vx === PRE_VX && segs[0].vy === PRE_VY
    && segs[1].vx === POST_VX && segs[1].vy === POST_VY,
    segs.map((g) => ({ t0: g.t0, t1: g.t1, vx: g.vx, vy: g.vy })));
  gate('AR1-velocity-query-by-global-fraction',
    G.pathVelocityAt(p, 0.25).vx === PRE_VX && G.pathVelocityAt(p, 0.75).vy === POST_VY,
    { at025: G.pathVelocityAt(p, 0.25), at075: G.pathVelocityAt(p, 0.75) });

  const plain = { px: 0, py: 0, x: 100, y: 0, vx: 777, vy: -3, __hr: {} };
  const one = G.pathSegments(plain);
  gate('AR9-no-corner-parity-unchanged',
    one.length === 1 && one[0].vx === 777 && one[0].vy === -3 && one[0].t0 === 0 && one[0].t1 === 1, one[0]);
} catch (e) { gate('AR1-segments-carry-their-own-velocity', false, String(e)); }

/* ============ AR-1/2: Mirror route direction per leg ============ */
// F2 migration: the legacy circular router was retired at Checkpoint F2; the
// same ordered-leg direction law is now pinned through the real F1 node
// surface + escrow authority (nodes seeded via the NON-SHIPPING
// mirrorTestNode seam for exact geometry).
function mirrorRouteCase({ entryAt, label }) {
  const o = start('MIRROR', 'ROBOT');
  const M = HR.match;
  const ctA = HR.byCombatant(o.a);
  // Fixture hygiene: keep both bodies off the ordered test path so the
  // surface capture (not a body hit) is the earliest event under test.
  o.a.x = 150; o.a.y = 150; o.b.x = 850; o.b.y = 850;
  M.api.mirrorTestNode(ctA, entryAt.x, entryAt.y, 0);      // entry node
  M.api.mirrorTestNode(ctA, 900, 120, 0);                  // destination node
  const p = mkBullet(o.b);
  win.projectiles.length = 0; win.projectiles.push(p);
  const routed = [];
  const un = win.APEX_HERO_REWORK_AIL.bus.on('MirrorRouteCapture', (e) => routed.push(e.payload || e));
  withCorner(p, () => win.APEX_ARSENAL.weaponApi.updateArsenalProjectiles(DT));
  un();
  return { label, routed: routed.length, vx: p.vx, vy: p.vy, toi: routed[0] && routed[0].toi };
}
try {
  // Entry-node surface on the real INBOUND leg (y=500, x in [200,500]).
  const r = mirrorRouteCase({ entryAt: { x: 330, y: 500 }, label: 'inbound' });
  gate('AR-T1-mirror-inbound-uses-PRE-magnet-direction',
    r.routed === 1 && Math.abs(r.vx - PRE_VX) < 1e-6 && Math.abs(r.vy - PRE_VY) < 1e-6,
    r);
} catch (e) { gate('AR-T1-mirror-inbound-uses-PRE-magnet-direction', false, String(e)); }
try {
  // Entry-node surface on the real OUTBOUND leg (x=500, y in [500,800]).
  // The Magnet boundary at t=0.5 is physically EARLIER here, so it stays
  // realized and the capture follows on the post-boundary leg with the POST
  // velocity — global TOI ordering, not mirror-always-first.
  const r = mirrorRouteCase({ entryAt: { x: 500, y: 700 }, label: 'outbound' });
  gate('AR-T2-mirror-outbound-uses-POST-magnet-direction',
    r.routed === 1 && Math.abs(r.vx - POST_VX) < 1e-6 && Math.abs(r.vy - POST_VY) < 1e-6,
    r);
} catch (e) { gate('AR-T2-mirror-outbound-uses-POST-magnet-direction', false, String(e)); }

/* ============ AR-T3/T4: Crystal reflect vs break-through ============ */
function crystalCase({ capAt, hp, label }) {
  const o = start('MAGNET', 'CRYSTAL');
  for (let i = 0; i < 5; i++) win.APEX_ARSENAL.step(DT);
  HR.pressAbility(o.b, 'A1');
  for (let i = 0; i < 30; i++) win.APEX_ARSENAL.step(DT);
  const CR = win.APEX_CRYSTAL;
  const caps = CR.capsules();
  if (!caps.length) return { label, skipped: 'no capsules' };
  const cap = caps[0];
  const hw = (cap.bx - cap.ax) / 2, hh = (cap.by - cap.ay) / 2;
  cap.ax = capAt.x - hw; cap.ay = capAt.y - hh;
  cap.bx = capAt.x + hw; cap.by = capAt.y + hh;
  if (hp != null) cap.cons.hp = hp;
  cap.cons.kind = 'wall';
  const p = mkBullet(o.a, {
    px: 200, py: 500, x: 500, y: 800, vx: POST_VX, vy: POST_VY,
    __hr: { pathVia: { x: 500, y: 500, t: 0.5, preVx: PRE_VX, preVy: PRE_VY, postVx: POST_VX, postVy: POST_VY } },
  });
  const before = { vx: p.vx, vy: p.vy };
  const res = CR.resolveBullet(p, 2, DT);
  return {
    label, consumed: !!(res && res.consumed), reflected: !!(res && res.reflected),
    before, after: { vx: p.vx, vy: p.vy },
    pathViaStillPending: !!(p.__hr && p.__hr.pathVia),
  };
}
try {
  // Construct with high HP on the inbound leg -> REFLECT (trajectory change).
  const r = crystalCase({ capAt: { x: 330, y: 500 }, hp: 100000, label: 'reflect' });
  // A reflection of the PRE velocity (+X) off a surface cannot keep +X sign;
  // a reflection of the POST velocity (+Y) would leave vx at 0.
  const usedPre = r.skipped ? false : Math.abs(r.after.vx) > 1e-6;
  gate('AR-T3-crystal-reflect-uses-PRE-magnet-incoming-velocity',
    !r.skipped && r.reflected === true && usedPre, r);
  gate('AR-T3b-crystal-reflect-supersedes-magnet',
    !r.skipped && r.reflected === true && r.pathViaStillPending === false, r);
} catch (e) { gate('AR-T3-crystal-reflect-uses-PRE-magnet-incoming-velocity', false, String(e)); }
try {
  // Low-HP wall -> breaking shot: damage resolves, projectile continues
  // UNCHANGED, so the later Magnet boundary must remain possible.
  const r = crystalCase({ capAt: { x: 330, y: 500 }, hp: 1, label: 'break-through' });
  gate('AR-T4-crystal-break-through-does-NOT-supersede-magnet',
    !r.skipped && r.reflected === false && r.pathViaStillPending === true, r);
} catch (e) { gate('AR-T4-crystal-break-through-does-NOT-supersede-magnet', false, String(e)); }

/* ============ AR-T5: body consume before Magnet -> no capture beat ====== */
try {
  const o = start('MAGNET', 'ROBOT');
  o.a.x = 500; o.a.y = 500;
  HR.pressAbility(o.a, 'A2');
  // Victim sits on the real inbound leg. The projectile must be owned by the
  // OTHER fighter or it cannot hit, which would make this gate pass trivially.
  o.b.x = 330; o.b.y = 500;
  const p = mkBullet(o.a);
  p.owner = o.a;
  win.projectiles.length = 0; win.projectiles.push(p);
  const hp0 = o.b.hp;
  withCorner(p, () => win.APEX_ARSENAL.weaponApi.updateArsenalProjectiles(DT));
  const beats = MAG.inspect(win.matchClock).captureEvents.length;
  const damaged = o.b.hp < hp0;
  gate('AR-T5-body-consume-before-magnet-emits-no-capture-beat',
    damaged && beats === 0 && !(p.__hr && p.__hr.pathVia),
    { realBodyHit: damaged, captureBeats: beats, hp0, hp1: o.b.hp });
} catch (e) { gate('AR-T5-body-consume-before-magnet-emits-no-capture-beat', false, String(e)); }

/* ============ AR-T6: absorbing wall before Magnet -> no beat =========== */
try {
  const o = start('MAGNET', 'ROBOT');
  const M = HR.match;
  o.a.x = 500; o.a.y = 500;
  HR.pressAbility(o.a, 'A2');
  M.world.walls.length = 0;
  M.world.walls.push({ id: 1, x: 330, y: 500, angle: Math.PI / 2, len: 160, thickness: 14, hp: 100000 });
  const p = mkBullet(o.b);
  win.projectiles.length = 0; win.projectiles.push(p);
  withCorner(p, () => win.APEX_ARSENAL.weaponApi.updateArsenalProjectiles(DT));
  const beats = MAG.inspect(win.matchClock).captureEvents.length;
  gate('AR-T6-absorbing-wall-before-magnet-emits-no-capture-beat',
    beats === 0 && p.life === 0, { captureBeats: beats, life: p.life });
} catch (e) { gate('AR-T6-absorbing-wall-before-magnet-emits-no-capture-beat', false, String(e)); }

/* ============ AR-T7: false chord invents nothing ======================= */
try {
  const o = start('MAGNET', 'ROBOT');
  const M = HR.match;
  o.a.x = 500; o.a.y = 500;
  M.world.walls.length = 0;
  M.world.graphs.length = 0;
  // (350,650) lies on the false frameStart->final chord and on NEITHER leg.
  M.world.graphs.push({ id: 1, x: 350, y: 650, angle: 0, span: 10, height: 2 });
  o.b.x = 350; o.b.y = 650;
  const p = mkBullet(o.b);
  p.owner = o.a;                       // hostile to b, so a body hit is legal
  win.projectiles.length = 0; win.projectiles.push(p);
  const hp0 = o.b.hp;
  withCorner(p, () => win.APEX_ARSENAL.weaponApi.updateArsenalProjectiles(DT));
  gate('AR-T7-false-chord-invents-no-contact',
    p.life !== 0 && o.b.hp === hp0, { life: p.life, hp0, hp1: o.b.hp });
} catch (e) { gate('AR-T7-false-chord-invents-no-contact', false, String(e)); }

/* ============ AR-T8: no stale path after relocation ==================== */
try {
  const r = mirrorRouteCase({ entryAt: { x: 330, y: 500 }, label: 'stale-check' });
  gate('AR-T8-no-stale-path-after-relocation', r.routed === 1 && r.toi != null, r);
} catch (e) { gate('AR-T8-no-stale-path-after-relocation', false, String(e)); }

if (HR.match) win.exitArsenalQuestMode();
fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/ordered-event-supersession.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2));

const total = Object.keys(report.gates).length;
console.log(`\n[ORDERED EVENT SUPERSESSION] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
