#!/usr/bin/env node
/* PRE-F1 CROSS-SYSTEM ORDERING PROOFS — Mirror A2 vs. Hunter / Magnet.
 *
 * hrPostTick order is asserted here as BEHAVIOR, not just source order:
 *
 *   resolvePendingBodyContacts()   — Hunter explicit-mover physical contact
 *   resolvePendingMirrorSnaps()    — Mirror coordinate exchange
 *
 * Both gates construct a real SAME-FRAME collision between the systems and
 * reuse the existing test seams: H-PHYS (tools/testHunterPouncePhysicalContact.mjs
 * donor) and H-PHYS2 (tools/testMagnetA2ContinuousField.mjs donor).
 *
 * No Hunter, Magnet or Mirror mechanic is altered or redesigned here.
 * The two local E gates prove ordering only; the exchange itself is already
 * locked by tools/testMirrorA1A2Gameplay.mjs.
 */
import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
const W = win.APEX_ARSENAL.weaponApi;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;

const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}
const close = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const DT = 1 / 120;
const held = (f) => { const h = W.getHolder ? W.getHolder(f) : null; return h ? h.weaponId : null; };
function bus() { return HR.bus || (win.APEX_HERO_REWORK_AIL && win.APEX_HERO_REWORK_AIL.bus); }
/* Eviction-safe capture: the bus ring is capped, so mark by monotonic seq. */
function capture(types) {
  const b = bus(); const mark = b.seq;
  return () => b.since(mark).filter((e) => types.includes(e.type));
}

/* ============================================================================
 * E-A2-15 — Hunter contact resolves BEFORE Mirror snap (same frame).
 *
 * Geometry is tuned so both resolutions land on the SAME fixed step:
 *   - Mirror SNAP: canonical step 31 (~0.25833s after cast).
 *   - Hunter pounce: windup 0.16s then 2200px/s closure; from 360px the swept
 *     contact (R = 75+75 = 150) first crosses inside step 31 because
 *     cumulative travel is 198px after step 30 and 216.33px after step 31,
 *     and D - R = 210px sits strictly between them.
 * Assertions are payload-relative, so engine body separation inside the frame
 * cannot confound them.
 * ========================================================================== */
try {
  T.start('HUNTER', 'MIRROR'); T.holdSpawns();
  const ready = await H.hunterReady();
  const [hunter, mirror] = H.fighters();
  hunter.baseSpeed = 0; mirror.baseSpeed = 0;
  hunter.x = 300; hunter.y = 500; mirror.x = 660; mirror.y = 500;
  hunter.setDir(1, 0);
  W.equip(mirror, 'PISTOL');                    // disarm consequence marker
  const SR = win.APEX_HERO_REWORK_AIL.StatusResolver;
  const ev = capture(['PounceWeak', 'HunterA2Disarm', 'MirrorExchange', 'WeakApplied']);
  const rM = HR.pressAbility(mirror, 'A2');
  const rH = HR.pressAbility(hunter, 'A2');
  for (let i = 1; i <= 30; i++) T.step(DT, DT);
  const pre = { hx: hunter.x, hy: hunter.y, mx: mirror.x, my: mirror.y };
  const ringMark = bus().ring.length;
  T.step(DT, DT);                               // frame 31: BOTH must resolve in this single frame
  const sameFrameOrder = bus().ring.slice(ringMark)
    .filter((e) => e.type === 'PounceWeak' || e.type === 'MirrorExchange')
    .map((e) => e.type);
  const all = ev();
  const pounce = all.find((e) => e.type === 'PounceWeak');
  const exchange = all.find((e) => e.type === 'MirrorExchange');
  const iP = all.indexOf(pounce), iX = all.indexOf(exchange);
  const ex = exchange && exchange.payload;
  // Consequences of the REAL resolved contact, asserted AFTER the swap:
  const consequencesHold = !!pounce
    && held(mirror) === null                    // firearm disarmed by the catch
    && SR.has(mirror, 'STUN')                   // stun committed to the prey body
    && all.some((e) => e.type === 'HunterA2Disarm')
    && all.some((e) => e.type === 'WeakApplied');
  // The exchange sampled the hunter's post-contact live position and the swap
  // was the LAST write: hunter ends at Mirror's position (not at the contact
  // TOI point), mirror ends at the hunter-sampled position.
  const swapWasLastWrite = !!ex
    && close(mirror.x, ex.opponent.from.x) && close(mirror.y, ex.opponent.from.y)
    && close(hunter.x, ex.self.from.x) && close(hunter.y, ex.self.from.y)
    && Math.abs(hunter.x - ex.opponent.from.x) > 20;   // hunter NOT left at its own contact point
  const hunterAdvancedBeforeSnap = !!ex && ex.opponent.from.x > pre.hx + 5;
  gate('E-A2-15-hunter-contact-resolves-before-mirror-snap',
    ready && rM.ok && rH.ok && !!pounce && !!exchange
    && sameFrameOrder.length === 2
    && sameFrameOrder[0] === 'PounceWeak' && sameFrameOrder[1] === 'MirrorExchange'
    && iP >= 0 && iX > iP
    && consequencesHold && swapWasLastWrite && hunterAdvancedBeforeSnap,
    { hunterReady: ready, castMirrorA2: rM.ok, castHunterA2: rH.ok,
      sameFrameEventOrder: sameFrameOrder, consequencesHold, swapWasLastWrite, hunterAdvancedBeforeSnap,
      hunterEnd: [+hunter.x.toFixed(2), +hunter.y.toFixed(2)],
      mirrorEnd: [+mirror.x.toFixed(2), +mirror.y.toFixed(2)],
      hunterSampledAtSnap: ex && ex.opponent.from, mirrorSampledAtSnap: ex && ex.self.from,
      hunterPreFrame31: [+pre.hx.toFixed(2), +pre.hy.toFixed(2)],
      note: 'contact consequence committed first; later swap does not erase it' });
} catch (e) { gate('E-A2-15-hunter-contact-resolves-before-mirror-snap', false, String(e)); }

/* ============================================================================
 * E-A2-16 — Magnet body motion resolves BEFORE Mirror snap.
 *
 * H-PHYS2 pattern: Magnet's active continuous field (A2) contributes body
 * motion to the Mirror body. That motion must be consumed by NORMAL movement
 * (prepareBodyForces -> Fighter.update) first; Mirror A2 then samples the
 * resulting LIVE coordinates; only then are positions exchanged. No
 * Mirror-specific field immunity is allowed: the Mirror body must actually be
 * moved by the field.
 * ========================================================================== */
try {
  T.start('MAGNET', 'MIRROR'); T.holdSpawns();
  const [magnet, mirror] = H.fighters();
  magnet.baseSpeed = 0; mirror.baseSpeed = 0;
  // 195px from field centre: inside R=225 with the ejection aimed down the
  // long +x runway, so the body is STILL field-driven inside the arena on the
  // SNAP frame (deeper starts eject into the arena wall before the telegraph,
  // which would measure the wall, not the field — fixture defect, not law).
  magnet.x = 250; magnet.y = 500; mirror.x = 445; mirror.y = 500;
  magnet.__hrWallPos = { x: magnet.x, y: magnet.y };
  mirror.__hrWallPos = { x: mirror.x, y: mirror.y };
  const rF = HR.pressAbility(magnet, 'A2');     // continuous field up (H-PHYS2 law)
  T.step(0.20, DT);                             // field moves the Mirror body through normal movement
  const driftPre = Math.hypot(mirror.x - 445, mirror.y - 500);
  const castPos = { x: mirror.x, y: mirror.y };
  const ev = capture(['MirrorExchange']);
  const rM = HR.pressAbility(mirror, 'A2');
  const traj = [];
  for (let i = 1; i <= 30; i++) { T.step(DT, DT); traj.push({ x: mirror.x, y: mirror.y }); }
  T.step(DT, DT);                               // step 31: SNAP frame
  const ex = ev().length === 1 ? ev()[0].payload : null;
  // Continuity of the field-driven motion: consumed frame by frame through the
  // normal pipeline — bounded steps, many moving frames, never a teleport.
  let maxStep = 0, movedFrames = 0;
  let px = castPos.x, py = castPos.y;
  for (const p of traj) {
    const d = Math.hypot(p.x - px, p.y - py);
    if (d > 1e-6) movedFrames++;
    if (d > maxStep) maxStep = d;
    px = p.x; py = p.y;
  }
  const liveVsCast = ex ? Math.hypot(ex.self.from.x - castPos.x, ex.self.from.y - castPos.y) : NaN;
  const strideIntoSnap = ex ? Math.hypot(ex.self.from.x - traj[29].x, ex.self.from.y - traj[29].y) : NaN;
  gate('E-A2-16-magnet-body-motion-resolves-before-mirror-snap',
    rF.ok && rM.ok
    && driftPre > 50                                     // no Mirror-specific immunity: field really moved it
    && !!ex
    && Number.isFinite(liveVsCast) && liveVsCast > 10    // snap sampled LIVE post-movement coordinates
    && movedFrames >= 8 && maxStep < 80                  // gradual native consumption, not a teleport
    && Number.isFinite(strideIntoSnap) && strideIntoSnap < 80
    && close(mirror.x, ex.opponent.from.x) && close(mirror.y, ex.opponent.from.y)   // exchange of the LIVE coords
    && close(magnet.x, ex.self.from.x) && close(magnet.y, ex.self.from.y),
    { fieldCast: rF.ok, exchangeCast: rM.ok, driftPreCastPx: +driftPre.toFixed(2),
      liveSampleVsCastTimePx: Number.isFinite(liveVsCast) ? +liveVsCast.toFixed(2) : null,
      movedFrames, maxFrameStepPx: +maxStep.toFixed(2),
      strideIntoSnapFramePx: Number.isFinite(strideIntoSnap) ? +strideIntoSnap.toFixed(3) : null,
      mirrorSampledAtSnap: ex && ex.self.from, magnetSampledAtSnap: ex && ex.opponent.from,
      mirrorEnd: [+mirror.x.toFixed(2), +mirror.y.toFixed(2)],
      magnetEnd: [+magnet.x.toFixed(2), +magnet.y.toFixed(2)],
      note: 'body motion consumed by normal movement first; snap samples the result; then exchange' });
} catch (e) { gate('E-A2-16-magnet-body-motion-resolves-before-mirror-snap', false, String(e)); }

const total = Object.keys(report.gates).length;
console.log(`\n[MIRROR A2 CROSS-SYSTEM ORDERING] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
