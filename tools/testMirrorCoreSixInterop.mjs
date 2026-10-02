#!/usr/bin/env node
/* CHECKPOINT F3-A — CORE SIX-HERO INTEROPERABILITY MATRIX.
 *
 * Owner-approved execution scope for F3-A:
 *   ROBOT, HUNTER, CRYSTALA, MAGNET, FROST (ICE), MIRROR
 *   + T6 / STORMBREAKER Arsenal capability regression
 *   + Teardown / Rematch state-class cleanup.
 *
 * Deferred to F3-B (owner skill designs not finalized — untouched here):
 *   TIME, RUBBER, BLACK_HOLE, MATH_V2, SLIME, and other unfinished Heroes.
 *
 * Every gate drives REAL shipping production lifecycles through the shared
 * harness and records its explicit lifecycle + classification
 * (PASS / REAL_FAILURE / UNRESOLVED).
 */
import { bootHarness } from './lib/crystalaHarness.mjs';
import fs from 'node:fs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
const AIL = win.APEX_HERO_REWORK_AIL;
const W = () => win.APEX_ARSENAL.weaponApi;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;

const DT = 1 / 60;
const DT120 = 1 / 120;
const close = (a, b, e = 1e-5) => Math.abs(a - b) <= e;

const report = {
  checkpoint: 'F3-A',
  scope: ['ROBOT', 'HUNTER', 'CRYSTALA', 'MAGNET', 'FROST', 'MIRROR'],
  deferredF3B: ['TIME', 'RUBBER', 'BLACK_HOLE', 'MATH_V2', 'SLIME'],
  gates: {},
  unresolvedNotes: [],
  failures: [],
};

function gate(name, ok, detail = {}, classification = ok ? 'PASS' : 'REAL_FAILURE') {
  const entry = { pass: !!ok, classification, ...detail };
  report.gates[name] = entry;
  if (!ok && classification === 'REAL_FAILURE') report.failures.push(name);
  if (classification === 'UNRESOLVED') report.unresolvedNotes.push({ gate: name, ...detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${classification}] ${name}  — ${JSON.stringify(detail)}`);
}

function bus() { return HR.bus || AIL.bus; }
function captureSeq(types) {
  const b = bus(); const mark = b.seq;
  return () => b.since(mark).filter((e) => !types || types.includes(e.type));
}
const seedNode = (ct, x, y, rot = 0) => HR.match.api.mirrorTestNode(ct, x, y, rot);
const escrowList = () => ((HR.match && HR.match.world.mirrorF2) || { escrow: [] }).escrow;
const held = (f) => { const h = W().getHolder ? W().getHolder(f) : null; return h ? h.weaponId : null; };
const holderOf = (f) => (W().getHolder ? W().getHolder(f) : null);

function newestAfter(before) {
  for (let i = win.projectiles.length - 1; i >= 0; i--) {
    const q = win.projectiles[i];
    if (q && q.aq && !before.has(q)) return q;
  }
  return null;
}

function startMatch(p1, p2, ax = 150, ay = 500, bx = 850, by = 500) {
  T.start(p1, p2);
  T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = ax; a.y = ay; b.x = bx; b.y = by;
  a.setDir(1, 0); b.setDir(-1, 0);
  a.__hrWallPos = { x: a.x, y: a.y };
  b.__hrWallPos = { x: b.x, y: b.y };
  return { a, b, ctA: HR.byCombatant(a), ctB: HR.byCombatant(b) };
}

/* ============================================================================
 * 1 — MAGNET × MIRROR (M1, M2, M3)
 * ========================================================================== */

// M1 — routed neutral projectile enters real Magnet field.
try {
  const MAG = win.APEX_MAGNET;
  // Magnet at (650, 380) so an active A2 field (R=225) covers y=500 around x∈[500,800].
  const o = startMatch('MAGNET', 'MIRROR', 650, 380, 150, 850);
  // Seed 2 ACTIVE Mirror nodes on ctB: entry at (300, 500), dest at (500, 500).
  seedNode(o.ctB, 300, 500, 0);
  seedNode(o.ctB, 500, 500, 0);

  const before = new Set(win.projectiles);
  W().fireBullet({
    owner: o.b, x: 220, y: 500, angle: 0, speed: 900, damage: 44,
    weapon: 'GLOCK_17', life: 6, critical: true,
  });
  const p = newestAfter(before);
  const ev = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge', 'MagnetBoundary', 'RealizedDamageEvent']);

  // Step until capture + emergence at (520, 500).
  let emerged = false, falseToiDuringEscrow = false;
  for (let f = 1; f <= 80; f++) {
    win.APEX_ARSENAL.step(DT);
    if (!emerged && ev().some((e) => e.type === 'MirrorRouteEmerge')) {
      emerged = true;
      // Activate Magnet A2 continuous field right as the emerged neutral projectile
      // enters the field region around x∈[520..800], y=500 (distance to (650,380) is ~176 <= 225).
      HR.pressAbility(o.a, 'A2');
      break;
    }
    if (!emerged && ev().some((e) => e.type === 'MagnetBoundary')) falseToiDuringEscrow = true;
  }

  const vyAtEmerge = p.vy;
  let magnetInfluenced = false;
  for (let f = 1; f <= 8; f++) {
    win.APEX_ARSENAL.step(DT);
    const inf = MAG.inspect().projectileInfluence || [];
    if (inf.length > 0 || Math.abs(p.vy - vyAtEmerge) > 1e-3) magnetInfluenced = true;
  }

  // Place Mirror body in front of the Magnet-influenced neutral bullet so it hits
  // and verify Magnet gets ZERO Hero damage credit.
  o.b.x = p.x + p.vx * DT * 1.5;
  o.b.y = p.y + p.vy * DT * 1.5;
  o.b.__hrWallPos = { x: o.b.x, y: o.b.y };
  for (let f = 1; f <= 10; f++) {
    win.APEX_ARSENAL.step(DT);
    if (ev().some((e) => e.type === 'RealizedDamageEvent')) break;
  }
  const dmgEv = ev().find((e) => e.type === 'RealizedDamageEvent');
  const neutralSurvived = !!(p.__hr && p.__hr.neutral);
  const propsSurvived = p.weapon === 'GLOCK_17' && p.damage === 44 && p.critical === true;
  const zeroHeroCredit = !!dmgEv && dmgEv.payload.creditedTo === null && o.ctA.telemetry.damageDealt === 0;

  gate('M1-magnet-field-influences-mirror-routed-neutral-projectile',
    emerged && !falseToiDuringEscrow && magnetInfluenced && neutralSurvived && propsSurvived && zeroHeroCredit,
    {
      lifecycle: 'W.fireBullet -> Mirror F2 capture/escrow/emerge -> HR.pressAbility(MAGNET, A2) -> MAG.stepProjectiles -> Stage B body hit',
      emerged, falseToiDuringEscrow, magnetInfluenced, neutralSurvived, propsSurvived,
      creditedTo: dmgEv ? dmgEv.payload.creditedTo : 'no-hit',
      magnetDamageDealt: o.ctA.telemetry.damageDealt,
    });
} catch (e) {
  gate('M1-magnet-field-influences-mirror-routed-neutral-projectile', false, { error: String(e) });
}

// M2 — Mirror A2 during real Magnet A2 continuous field.
try {
  const MAG = win.APEX_MAGNET;
  const o = startMatch('MAGNET', 'MIRROR', 250, 500, 445, 500);
  const rF = HR.pressAbility(o.a, 'A2');
  T.step(0.20, DT120);
  const inspBefore = MAG.inspect();
  const fieldBefore = inspBefore.fields[0];
  const untilBefore = fieldBefore ? fieldBefore.a2Until : 0;
  const castsBefore = fieldBefore ? fieldBefore.casts.a2 : 0;
  const preSwapMagPos = { x: o.a.x, y: o.a.y };

  const ev = captureSeq(['MirrorExchange']);
  const rM = HR.pressAbility(o.b, 'A2');
  for (let i = 1; i <= 31; i++) T.step(DT120, DT120);

  const ex = ev()[0] && ev()[0].payload;
  const now = AIL.clock();
  const inspAfter = MAG.inspect(now);
  const fieldAfter = inspAfter.fields[0];
  const activeList = MAG.activeFields(now);
  // Subsequent field evaluation must follow Magnet's new post-swap position (~617.5, 500),
  // and acceleration at a point near the OLD position (100, 500) >225px from new pos must be zero.
  const accelNearNew = MAG.fieldAccelerationAt(o.a.x + 120, o.a.y, now);
  const accelNearOld = MAG.fieldAccelerationAt(100, 500, now);

  const liveExchanged = !!ex
    && close(o.b.x, ex.opponent.from.x) && close(o.b.y, ex.opponent.from.y)
    && close(o.a.x, ex.self.from.x) && close(o.a.y, ex.self.from.y);
  const ownedByMagnet = fieldAfter && fieldAfter.combatant === o.ctA && fieldAfter.a2Active;
  const followsNewPos = activeList.length === 1
    && activeList[0].owner === o.ctA
    && close(activeList[0].owner.anchor.x, o.a.x) && close(activeList[0].owner.anchor.y, o.a.y)
    && Math.hypot(accelNearNew.ax, accelNearNew.ay) > 0
    && Math.hypot(accelNearOld.ax, accelNearOld.ay) === 0;
  const noRestart = fieldAfter && close(fieldAfter.a2Until, untilBefore) && fieldAfter.casts.a2 === castsBefore;

  gate('M2-mirror-a2-during-magnet-a2-continuous-field',
    rF.ok && rM.ok && liveExchanged && ownedByMagnet && followsNewPos && noRestart,
    {
      lifecycle: 'HR.pressAbility(MAGNET, A2) -> HR.pressAbility(MIRROR, A2) -> resolvePendingMirrorSnaps -> MAG.activeFields/fieldAccelerationAt',
      liveExchanged, ownedByMagnet, followsNewPos, noRestart,
      activeFieldsCount: activeList.length,
      preSwapMagX: +preSwapMagPos.x.toFixed(1), postSwapMagX: +o.a.x.toFixed(1),
    });
} catch (e) {
  gate('M2-mirror-a2-during-magnet-a2-continuous-field', false, { error: String(e) });
}

// M3 — Mirror A1 copies a real firearm currently held by Magnet (X03 law).
try {
  const MAG = win.APEX_MAGNET;
  const o = startMatch('MIRROR', 'MAGNET', 300, 500, 700, 500);
  W().equip(o.b, 'PISTOL');
  const ev = captureSeq(['MirrorA1Own', 'MirrorA1CopyExpired', 'MagnetPassiveEmission']);

  // Magnet fires a bullet: receives MagnetPassiveEmission speed boost (PASSIVE_SPEED_MULT = 1.18).
  const bMagBefore = new Set(win.projectiles);
  W().fireBullet({ owner: o.b, x: o.b.x, y: o.b.y, angle: Math.PI, speed: 1000, damage: 25, weapon: 'PISTOL', life: 0.05 });
  const magBullet = newestAfter(bMagBefore);
  const magSpeed = magBullet ? Math.hypot(magBullet.vx, magBullet.vy) : 0;
  const magBoosted = !!(magBullet && magBullet.__hr && magBullet.__hr.magnetBoosted)
    && close(magSpeed, 1000 * MAG.CONSTANTS.PASSIVE_SPEED_MULT);

  // Mirror casts A1 to copy Magnet's PISTOL; remove live target during windup/after check
  // (same controlled condition as E-A1-14 so auto-fire does not deplete ammo before 6.0s expiry).
  const rA1 = HR.pressAbility(o.a, 'A1');
  T.step(0.95, DT120);
  const ownEv = ev().find((e) => e.type === 'MirrorA1Own');
  // Re-arm Magnet if it auto-fired its initial pistol during the 0.95s step so we also compare holders live:
  if (!held(o.b)) W().equip(o.b, 'PISTOL');
  const mirrorHolder = holderOf(o.a);
  const magnetHolder = holderOf(o.b);
  const bothHoldPistol = held(o.a) === 'PISTOL' && held(o.b) === 'PISTOL' && mirrorHolder !== magnetHolder;
  const isTempCopy = !!(mirrorHolder && mirrorHolder.__hrMirrorCopy)
    && !!(o.ctA.store.__mirrorCopy && close(o.ctA.store.__mirrorCopy.until - ownEv.payload.clock, 6.0));

  // Mirror fires its copied PISTOL: must NOT inherit Magnet passive acceleration.
  const magEventsBeforeMirShot = ev().filter((e) => e.type === 'MagnetPassiveEmission').length;
  const bMirBefore = new Set(win.projectiles);
  W().fireBullet({ owner: o.a, x: o.a.x, y: o.a.y, angle: 0, speed: 1000, damage: 25, weapon: 'PISTOL', life: 0.05 });
  const mirBullet = newestAfter(bMirBefore);
  const mirSpeed = mirBullet ? Math.hypot(mirBullet.vx, mirBullet.vy) : 0;
  const magEventsAfterMirShot = ev().filter((e) => e.type === 'MagnetPassiveEmission').length;
  const mirNotBoosted = !!(mirBullet && (!mirBullet.__hr || !mirBullet.__hr.magnetBoosted))
    && close(mirSpeed, 1000)
    && magEventsAfterMirShot === magEventsBeforeMirShot;

  // Controlled condition from E-A1-14: remove live target so holder is not depleted by auto-fire before 6.0s expiry.
  o.b.hp = 0;
  T.step(6.05, DT120);
  const expEv = ev().find((e) => e.type === 'MirrorA1CopyExpired');
  const expiredCleanly = !!expEv && held(o.a) === null;

  gate('M3-mirror-a1-copies-magnet-held-firearm-x03',
    rA1.ok && !!ownEv && bothHoldPistol && isTempCopy && magBoosted && mirNotBoosted && expiredCleanly,
    {
      lifecycle: 'W.equip(MAGNET, PISTOL) -> HR.pressAbility(MIRROR, A1) -> MirrorA1Own -> W.fireBullet -> 6s MirrorA1CopyExpired',
      bothHoldPistol, isTempCopy, magBoosted, mirNotBoosted,
      magSpeed, mirSpeed, expiredCleanly,
    });
} catch (e) {
  gate('M3-mirror-a1-copies-magnet-held-firearm-x03', false, { error: String(e) });
}

/* ============================================================================
 * 2 — CRYSTALA × MIRROR (C1, C2, C3)
 * ========================================================================== */

// C1 — real Crystala-reflected projectile routes through Mirror.
try {
  const o = startMatch('CRYSTAL', 'MIRROR', 200, 500, 850, 500);
  T.step(0.35, DT);
  // Seed 2 ACTIVE Mirror nodes on ctB at (660, 500) and (760, 500).
  // Fire from x=580 leftward toward Crystala at (200, 500):
  // Outbound leg (580 -> ~500) hits Crystala's 300px K shard ring;
  // Reflected leg (~500 -> 850) travels rightward into Mirror node (660, 500),
  // emerges at (760+20=780, 500) as NEUTRAL, and hits Mirror at (850, 500)!
  seedNode(o.ctB, 660, 500, 0);
  seedNode(o.ctB, 760, 500, 0);

  const rK = HR.pressAbility(o.a, 'A2'); // Real Crystala K awakening
  const ev = captureSeq(['CrystalIntercept', 'CrystalReflect', 'MirrorRouteCapture', 'MirrorRouteEmerge', 'RealizedDamageEvent']);

  const before = new Set(win.projectiles);
  W().fireBullet({
    owner: o.b, x: 580, y: 500, angle: Math.PI, speed: 800, damage: 40,
    weapon: 'GLOCK_17', life: 6, critical: true,
  });
  const p = newestAfter(before);

  let dmgAtReflect = null, emerged = false;
  for (let f = 1; f <= 180; f++) {
    win.APEX_ARSENAL.step(DT);
    if (dmgAtReflect == null && ev().some((e) => e.type === 'CrystalReflect')) {
      dmgAtReflect = p.damage;
    }
    if (ev().some((e) => e.type === 'MirrorRouteEmerge')) {
      emerged = true;
      break;
    }
  }

  const allEv = ev();
  const reflects = allEv.filter((e) => e.type === 'CrystalReflect');
  const caps = allEv.filter((e) => e.type === 'MirrorRouteCapture');
  const liveBullets = win.projectiles.filter((q) => q && q.aq);
  const payloadSurvived = !!(p.__hr && p.__hr.crystalReflected === true)
    && dmgAtReflect != null && close(p.damage, dmgAtReflect)
    && p.critical === true && p.weapon === 'GLOCK_17';
  const controllerNeutral = !!(p.__hr && p.__hr.neutral === true);

  // Let the emerged neutral reflected bullet hit Mirror at x=850 and verify neutral credit.
  for (let f = 1; f <= 20; f++) {
    win.APEX_ARSENAL.step(DT);
    if (ev().some((e) => e.type === 'RealizedDamageEvent')) break;
  }
  const dmgEv = ev().find((e) => e.type === 'RealizedDamageEvent');

  gate('C1-crystala-reflected-projectile-routes-through-mirror',
    rK.ok && reflects.length === 1 && caps.length === 1 && emerged
    && payloadSurvived && controllerNeutral && liveBullets.length <= 1
    && !!dmgEv && dmgEv.payload.creditedTo === null,
    {
      lifecycle: 'HR.pressAbility(CRYSTAL, A2) -> W.fireBullet -> CrystalIntercept/CrystalReflect -> MirrorRouteCapture/MirrorRouteEmerge -> Stage B hit',
      reflectCount: reflects.length, captureCount: caps.length, emerged,
      dmgAtReflect, dmgAfterEmerge: p.damage, payloadSurvived, controllerNeutral,
      creditedTo: dmgEv ? dmgEv.payload.creditedTo : 'no-hit',
    });
} catch (e) {
  gate('C1-crystala-reflected-projectile-routes-through-mirror', false, { error: String(e) });
}

// C2 — retain/reprove accepted F2 Crystal-vs-Mirror global TOI + post-emergence Crystala interaction.
try {
  const CRY = win.APEX_CRYSTAL;
  // Part A: Crystal earlier than Mirror on the same swept frame -> Crystal wins.
  const o1 = startMatch('CRYSTAL', 'MIRROR', 150, 500, 850, 500);
  T.step(0.35, DT);
  HR.pressAbility(o1.a, 'A1'); // Real Crystala wall at x=480
  T.step(0.85, DT);            // step until wall is solid across y=500
  seedNode(o1.ctB, 465, 500, 0);
  seedNode(o1.ctB, 300, 500, 0);
  const ev1 = captureSeq(['CrystalConstructHit', 'CrystalConstructReflect', 'MirrorRouteCapture', 'MirrorRoutePreview']);
  W().fireBullet({ owner: o1.b, x: 525, y: 500, angle: Math.PI, speed: 3600, damage: 5, weapon: 'GLOCK_17', life: 3 });
  win.APEX_ARSENAL.step(DT);
  const crystalEarlierOk = ev1().some((e) => e.type === 'CrystalConstructHit')
    && ev1().some((e) => e.type === 'CrystalConstructReflect')
    && !ev1().some((e) => e.type.startsWith('MirrorRoute'));

  // Part B: Mirror earlier than Crystal on the same swept frame, THEN emerged neutral bullet
  // hits the real Crystala wall construct at x=480 on its post-emergence path!
  const o2 = startMatch('CRYSTAL', 'MIRROR', 150, 500, 850, 500);
  T.step(0.35, DT);
  HR.pressAbility(o2.a, 'A1'); // Real Crystala wall at x=480
  T.step(0.85, DT);
  // Entry node at x=650, destination node at x=540 (in front of the x=480 Crystal wall!).
  seedNode(o2.ctB, 650, 500, 0);
  seedNode(o2.ctB, 540, 500, 0);
  const hpBeforeCapture = CRY.inspect(o2.ctA).constructs[0].hp;
  const ev2 = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge', 'CrystalConstructHit']);
  W().fireBullet({ owner: o2.b, x: 700, y: 500, angle: Math.PI, speed: 1200, damage: 5, weapon: 'GLOCK_17', life: 3 });

  let hpDuringEscrow = null, postEmergeCrystalHit = false;
  for (let f = 1; f <= 60; f++) {
    win.APEX_ARSENAL.step(DT);
    const eNow = ev2();
    if (hpDuringEscrow == null && eNow.some((e) => e.type === 'MirrorRouteCapture')) {
      hpDuringEscrow = CRY.inspect(o2.ctA).constructs[0].hp;
    }
    if (eNow.some((e) => e.type === 'MirrorRouteEmerge') && eNow.some((e) => e.type === 'CrystalConstructHit')) {
      postEmergeCrystalHit = true;
      break;
    }
  }
  const hpAfterPostEmergeHit = CRY.inspect(o2.ctA).constructs[0].hp;
  const mirrorEarlierOk = hpDuringEscrow === hpBeforeCapture && postEmergeCrystalHit && hpAfterPostEmergeHit < hpBeforeCapture;

  // Part C: Thrown-melee Crystal-earlier and Mirror-earlier on the same swept frame (retained r26 law).
  const o3 = startMatch('CRYSTAL', 'MIRROR', 150, 500, 850, 500);
  T.step(0.35, DT);
  HR.pressAbility(o3.a, 'A1');
  T.step(0.5, DT);
  seedNode(o3.ctB, 480, 500, 0);
  seedNode(o3.ctB, 300, 500, 0);
  const ev3 = captureSeq(['CrystalConstructHit', 'MirrorRouteCapture', 'MirrorRoutePreview']);
  const b3 = new Set(win.projectiles);
  W().spawnThrownMelee(o3.b, 'DAGGER', Math.PI);
  const t3 = newestAfter(b3);
  for (let f = 1; f <= 20; f++) { win.APEX_ARSENAL.step(DT); if (t3.vx > 0) break; }
  const thrownCrystalEarlierOk = t3.vx > 0 && ev3().some((e) => e.type === 'CrystalConstructHit')
    && !ev3().some((e) => e.type.startsWith('MirrorRoute'));

  gate('C2-crystala-vs-mirror-global-toi-and-post-emerge-interaction',
    crystalEarlierOk && mirrorEarlierOk && thrownCrystalEarlierOk,
    {
      lifecycle: 'HR.pressAbility(CRYSTAL, A1) -> W.fireBullet + W.spawnThrownMelee -> global TOI reconcile + post-emergence CRY.resolveBullet wall hit',
      crystalEarlierOk, mirrorEarlierOk, thrownCrystalEarlierOk,
      hpBeforeCapture, hpDuringEscrow, hpAfterPostEmergeHit, postEmergeCrystalHit,
    });
} catch (e) {
  gate('C2-crystala-vs-mirror-global-toi-and-post-emerge-interaction', false, { error: String(e) });
}

// C3 — Mirror A2 while a finalized real Crystala construct exists.
try {
  const CRY = win.APEX_CRYSTAL;
  const o = startMatch('CRYSTAL', 'MIRROR', 150, 500, 850, 500);
  T.step(0.35, DT);
  HR.pressAbility(o.a, 'A1'); // Wall construct at x=480, y∈[390,610]
  T.step(0.85, DT);
  const consBefore = CRY.inspect(o.ctA).constructs[0];
  const capBefore = CRY.capsules()[0];

  const ev = captureSeq(['MirrorExchange', 'CrystalConstructHit']);
  const rM = HR.pressAbility(o.b, 'A2');
  for (let i = 1; i <= 31; i++) T.step(DT120, DT120); // step to SNAP
  // Step 1 more frame to verify resolveWorldWalls does NOT clamp either fighter back to x=480
  T.step(DT120, DT120);

  const consAfter = CRY.inspect(o.ctA).constructs[0];
  const capAfter = CRY.capsules()[0];
  const fightersExchanged = close(o.a.x, 850, 1) && close(o.b.x, 150, 1);
  const constructStayedInWorld = capBefore && capAfter && close(capAfter.ax, 480) && close(capAfter.bx, 480);
  const ownershipIntact = consAfter && consAfter.id === consBefore.id && consAfter.state === 'LIVE'
    && consAfter.hp === consBefore.hp && CRY.inspect(o.ctB) === null;
  const noTeleportGapCollision = fightersExchanged && ev().filter((e) => e.type === 'CrystalConstructHit').length === 0;

  // Subsequent genuine collision: Mirror (now at x=150) fires a bullet into x=480 construct.
  W().fireBullet({ owner: o.b, x: 420, y: 500, angle: 0, speed: 1200, damage: 5, weapon: 'GLOCK_17', life: 2 });
  for (let f = 1; f <= 10; f++) {
    win.APEX_ARSENAL.step(DT);
    if (ev().some((e) => e.type === 'CrystalConstructHit')) break;
  }
  const genuineCollisionWorks = ev().some((e) => e.type === 'CrystalConstructHit')
    && CRY.inspect(o.ctA).constructs[0].hp < consBefore.hp;

  gate('C3-mirror-a2-with-live-crystala-construct',
    rM.ok && fightersExchanged && constructStayedInWorld && ownershipIntact && noTeleportGapCollision && genuineCollisionWorks,
    {
      lifecycle: 'HR.pressAbility(CRYSTAL, A1) -> HR.pressAbility(MIRROR, A2) -> SNAP across construct -> subsequent W.fireBullet into construct',
      fightersExchanged, constructStayedInWorld, ownershipIntact, noTeleportGapCollision, genuineCollisionWorks,
    });
} catch (e) {
  gate('C3-mirror-a2-with-live-crystala-construct', false, { error: String(e) });
}

/* ============================================================================
 * 3 — FROST × MIRROR (F1, F2)
 * ========================================================================== */

// F1 — real Frost provenance routes through Mirror.
try {
  const FR = win.APEX_FROST;
  const o = startMatch('ICE', 'MIRROR', 150, 500, 850, 500);
  seedNode(o.ctB, 450, 500, 0);
  seedNode(o.ctB, 700, 500, 0);

  // Real Frost frozen-gun pickup + fireBullet producer.
  W().equip(o.a, 'PISTOL');
  FR.noteFrozenPickup(o.a, o.a.data.arsenal, null);
  FR.setFreezeSeed(1); // deterministic freeze roll
  const ev = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge', 'FrostFreezeStart', 'FrostRollFailed', 'RealizedDamageEvent']);

  const before = new Set(win.projectiles);
  W().fireBullet({ owner: o.a, x: 380, y: 500, angle: 0, speed: 1200, damage: 35, weapon: 'PISTOL', life: 5 });
  const p = newestAfter(before);
  const tagAtFire = p && p.__hr && p.__hr.frost ? { ...p.__hr.frost } : null;

  for (let f = 1; f <= 80; f++) {
    win.APEX_ARSENAL.step(DT);
    if (ev().some((e) => e.type === 'MirrorRouteEmerge')) break;
  }
  const tagAtEmerge = p && p.__hr && p.__hr.frost ? { ...p.__hr.frost } : null;
  const tagSurvived = !!tagAtFire && !!tagAtEmerge
    && tagAtEmerge.group === tagAtFire.group
    && tagAtEmerge.holder === tagAtFire.holder
    && tagAtEmerge.shooter === o.a;
  const isNeutral = !!(p && p.__hr && p.__hr.neutral === true);

  // Let the emerged neutral bullet hit Mirror at (850, 500) -> reaches FR.noteBodyHit.
  for (let f = 1; f <= 20; f++) {
    win.APEX_ARSENAL.step(DT);
    if (ev().some((e) => e.type === 'RealizedDamageEvent')) break;
  }
  const allEv = ev();
  const dmgEv = allEv.find((e) => e.type === 'RealizedDamageEvent');
  const frostPostHitEvents = allEv.filter((e) => e.type === 'FrostFreezeStart' || e.type === 'FrostRollFailed');
  const insp = FR.inspect(o.ctA);
  FR.setFreezeSeed(null);

  gate('F1-frost-frozen-bullet-provenance-routes-through-mirror',
    tagSurvived && isNeutral && !!dmgEv && dmgEv.payload.creditedTo === null
    && frostPostHitEvents.length === 1 && insp.rolls === 1 && insp.rolled === 1,
    {
      lifecycle: 'W.equip(ICE, PISTOL) -> FR.noteFrozenPickup -> W.fireBullet -> Mirror F2 capture/emerge -> Stage B FR.noteBodyHit',
      tagSurvived, isNeutral, creditedTo: dmgEv ? dmgEv.payload.creditedTo : 'no-hit',
      frostPostHitEvent: frostPostHitEvents[0] ? frostPostHitEvents[0].type : null,
      rollsUsed: insp.rolls, rolledGroups: insp.rolled,
    });
} catch (e) {
  gate('F1-frost-frozen-bullet-provenance-routes-through-mirror', false, { error: String(e) });
}

// F2 — Mirror A2 while a finalized Frost active state is present.
try {
  const FR = win.APEX_FROST;
  const o = startMatch('ICE', 'MIRROR', 200, 300, 800, 700);
  const rA1 = HR.pressAbility(o.a, 'A1'); // Frost Breath lane
  T.step(0.25, DT120);                    // step past 0.18s windup so lane is released in world space
  const rA2 = HR.pressAbility(o.a, 'A2'); // Frost Ice Age active state
  T.step(0.05, DT120);

  const beforeSnap = FR.inspect(o.ctA);
  const laneBefore = beforeSnap.lanes[0];
  const a2IdBefore = beforeSnap.a2castId;

  const ev = captureSeq(['MirrorExchange', 'FrostColdShock', 'FrostSteal']);
  const rM = HR.pressAbility(o.b, 'A2');
  for (let i = 1; i <= 31; i++) T.step(DT120, DT120);

  const afterSnap = FR.inspect(o.ctA);
  const laneAfter = afterSnap.lanes[0];
  const exchanged = close(o.a.x, 800, 1) && close(o.a.y, 700, 1) && close(o.b.x, 200, 1) && close(o.b.y, 300, 1);
  const frostOwned = afterSnap.a2live === true && FR.inspect(o.ctB) === null;
  const worldLaneFixed = !!laneBefore && !!laneAfter
    && laneAfter.ox === laneBefore.ox && laneAfter.oy === laneBefore.oy
    && laneAfter.dx === laneBefore.dx && laneAfter.dy === laneBefore.dy
    && laneAfter.castId === laneBefore.castId;
  const noFalseContactProc = ev().filter((e) => e.type === 'FrostColdShock' || e.type === 'FrostSteal').length === 0;
  const noCloneOrReset = afterSnap.a2castId === a2IdBefore && afterSnap.lanes.length === 1;

  gate('F2-mirror-a2-during-frost-active-states',
    rA1.ok && rA2.ok && rM.ok && exchanged && frostOwned && worldLaneFixed && noFalseContactProc && noCloneOrReset,
    {
      lifecycle: 'HR.pressAbility(ICE, A1) + HR.pressAbility(ICE, A2) -> HR.pressAbility(MIRROR, A2) -> SNAP',
      exchanged, frostOwned, worldLaneFixed, noFalseContactProc, noCloneOrReset,
    });
} catch (e) {
  gate('F2-mirror-a2-during-frost-active-states', false, { error: String(e) });
}

/* ============================================================================
 * 4 — HUNTER × MIRROR (H1, H2)
 * ========================================================================== */

// H1 — REAL Hunter A2 Pounce overlapping Mirror A2.
try {
  // Part A: Same-frame pounce contact + Mirror SNAP (contact resolves before snap, single contact event).
  const o1 = startMatch('HUNTER', 'MIRROR', 300, 500, 660, 500);
  const ready = await H.hunterReady();
  W().equip(o1.b, 'PISTOL');
  const ev1 = captureSeq(['PounceWeak', 'MirrorExchange']);
  HR.pressAbility(o1.b, 'A2');
  HR.pressAbility(o1.a, 'A2');
  for (let i = 1; i <= 31; i++) T.step(DT120, DT120);
  const list1 = ev1();
  const sameFrameOrderOk = list1.length === 2
    && list1[0].type === 'PounceWeak' && list1[1].type === 'MirrorExchange'
    && held(o1.b) === null;

  // Part B: Non-contact pounce overlapping Mirror SNAP across a large separation:
  // verify NO teleport-gap pounce hit on the swap frame or next frame, and no stale pre-swap body path;
  // then move Mirror into Hunter's post-swap pounce path to prove genuine post-swap contact resolves.
  const o2 = startMatch('HUNTER', 'MIRROR', 150, 300, 850, 700);
  await H.hunterReady();
  const ev2 = captureSeq(['PounceWeak', 'MirrorExchange']);
  HR.pressAbility(o2.b, 'A2'); // SNAP at step 31 (~0.2583s)
  for (let i = 1; i <= 10; i++) T.step(DT120, DT120);
  HR.pressAbility(o2.a, 'A2'); // Hunter casts A2 at step 10; windup 0.16s -> launches at step 30!
  for (let i = 11; i <= 31; i++) T.step(DT120, DT120); // step 31: SNAP occurs while Hunter is in active launched pounce!
  T.step(DT120, DT120);
  const noTeleportGapHit = ev2().some((e) => e.type === 'MirrorExchange')
    && !ev2().some((e) => e.type === 'PounceWeak');

  // Now place Mirror directly in front of Hunter's post-swap pounce trajectory so genuine post-swap contact resolves.
  const ang = Math.atan2(o2.b.y - o2.a.y, o2.b.x - o2.a.x);
  o2.b.x = o2.a.x + Math.cos(ang) * 155;
  o2.b.y = o2.a.y + Math.sin(ang) * 155;
  o2.b.__hrWallPos = { x: o2.b.x, y: o2.b.y };
  for (let i = 1; i <= 5; i++) {
    T.step(DT120, DT120);
    if (ev2().some((e) => e.type === 'PounceWeak')) break;
  }
  const pounceEvents2 = ev2().filter((e) => e.type === 'PounceWeak');
  const genuinePostSwapContact = pounceEvents2.length === 1;

  gate('H1-hunter-a2-pounce-overlapping-mirror-a2',
    ready && sameFrameOrderOk && noTeleportGapHit && genuinePostSwapContact,
    {
      lifecycle: 'HR.pressAbility(HUNTER, A2) overlapping HR.pressAbility(MIRROR, A2) -> resolvePendingBodyContacts before resolvePendingMirrorSnaps',
      sameFrameOrderOk, noTeleportGapHit, genuinePostSwapContact,
      pounceCountPartB: pounceEvents2.length,
    });
} catch (e) {
  gate('H1-hunter-a2-pounce-overlapping-mirror-a2', false, { error: String(e) });
}

// H2 — optional integrity smoke: real Hunter world-space trap remains Hunter-owned through Mirror A2.
try {
  const o = startMatch('HUNTER', 'MIRROR', 250, 500, 750, 500);
  await H.hunterReady();
  const rTrap = HR.pressAbility(o.a, 'A1');
  const snare = HR.match.world.snares[0];
  const trapPosBefore = snare ? { x: snare.x, y: snare.y } : null;
  T.step(0.6, DT120);
  o.a.x = 420; o.a.y = 500; o.a.__hrWallPos = { x: 420, y: 500 };

  const ev = captureSeq(['MirrorExchange', 'SnareTriggered']);
  const rM = HR.pressAbility(o.b, 'A2');
  for (let i = 1; i <= 31; i++) T.step(DT120, DT120);

  const snareAfter = HR.match.world.snares[0];
  const trapStayedAndOwned = !!snareAfter
    && snareAfter.owner === o.ctA
    && close(snareAfter.x, trapPosBefore.x) && close(snareAfter.y, trapPosBefore.y)
    && ev().filter((e) => e.type === 'SnareTriggered').length === 0;

  gate('H2-hunter-world-trap-ownership-across-mirror-a2',
    rTrap.ok && rM.ok && trapStayedAndOwned,
    {
      lifecycle: 'HR.pressAbility(HUNTER, A1) -> world.snares[0] -> HR.pressAbility(MIRROR, A2) -> SNAP',
      trapStayedAndOwned, trapX: snareAfter && snareAfter.x, ownerHero: snareAfter && snareAfter.owner.heroId,
    });
} catch (e) {
  gate('H2-hunter-world-trap-ownership-across-mirror-a2', false, { error: String(e) });
}

/* ============================================================================
 * 5 — ROBOT × MIRROR (R1, R2)
 * ========================================================================== */

// R1 — neutral Mirror-routed projectile damages Robot through normal pipeline; zero attacker Hero credit.
try {
  const o = startMatch('ROBOT', 'MIRROR', 850, 500, 150, 500);
  seedNode(o.ctB, 400, 500, 0);
  seedNode(o.ctB, 650, 500, 0);

  // Put Robot A1 on cooldown and activate Robot A2 virtual armor (0.5x incoming damage reduction).
  o.ctA.skills.A1.cdLeft = 5.0;
  const rArmor = HR.pressAbility(o.a, 'A2');

  const ev = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge', 'RobotA2Hit', 'RobotPassiveMilestone', 'RobotPassiveUpgrade', 'RealizedDamageEvent']);
  // Robot fires a 200-damage bullet (>= 150 first milestone threshold if credited to Robot!).
  // Mirror routes it -> emerges NEUTRAL -> hits Robot at (850, 500).
  o.a.x = 250; o.a.y = 500;
  W().fireBullet({ owner: o.a, x: 250, y: 500, angle: 0, speed: 1200, damage: 200, weapon: 'MAGNUM_500', life: 5 });
  o.a.x = 850; o.a.y = 500; o.a.__hrWallPos = { x: 850, y: 500 };

  for (let f = 1; f <= 80; f++) {
    win.APEX_ARSENAL.step(DT);
    if (ev().some((e) => e.type === 'RealizedDamageEvent')) break;
  }
  const allEv = ev();
  const dmgEv = allEv.find((e) => e.type === 'RealizedDamageEvent');
  const armorHit = allEv.find((e) => e.type === 'RobotA2Hit');
  const milestones = allEv.filter((e) => e.type === 'RobotPassiveMilestone' || e.type === 'RobotPassiveUpgrade');
  const robotBurstStore = o.ctA.store['robot.damage_milestones'] || {};

  gate('R1-neutral-mirror-routed-projectile-damages-robot-no-credit',
    rArmor.ok && !!dmgEv && dmgEv.payload.creditedTo === null
    && !!armorHit && armorHit.payload.reduced < armorHit.payload.amount
    && milestones.length === 0 && !robotBurstStore.burst,
    {
      lifecycle: 'HR.pressAbility(ROBOT, A2) -> W.fireBullet(owner=ROBOT, dmg=200) -> Mirror F2 capture/emerge (NEUTRAL) -> hits ROBOT',
      creditedTo: dmgEv ? dmgEv.payload.creditedTo : 'no-hit',
      armorReduced: !!armorHit,
      milestoneEvents: milestones.length,
      robotBurstProgress: robotBurstStore.burst || 0,
    });
} catch (e) {
  gate('R1-neutral-mirror-routed-projectile-damages-robot-no-credit', false, { error: String(e) });
}

// R2 — Mirror A2 during applicable real finalized Robot movement/action state.
try {
  const o = startMatch('ROBOT', 'MIRROR', 250, 500, 750, 500);
  // Spawn a revealed pickup at (500, 300) via the real dropWeaponSlot API so Robot A1 weapon_dash is castable.
  HR.match.api.dropWeaponSlot('PISTOL', 500, 300);
  const rA2 = HR.pressAbility(o.a, 'A2'); // Robot virtual armor active
  const rA1 = HR.pressAbility(o.a, 'A1'); // Robot weapon_dash active
  const armorUntilBefore = o.ctA.store['robot.virtual_armor'].armorUntil;

  const ev = captureSeq(['MirrorExchange', 'RobotA1Contact']);
  const rM = HR.pressAbility(o.b, 'A2');
  for (let i = 1; i <= 31; i++) T.step(DT120, DT120);

  const ex = ev().find((e) => e.type === 'MirrorExchange');
  const exPayload = ex && ex.payload;
  const atomicExchange = !!exPayload
    && close(o.a.x, exPayload.self.from.x) && close(o.a.y, exPayload.self.from.y)
    && close(o.b.x, exPayload.opponent.from.x) && close(o.b.y, exPayload.opponent.from.y);
  const noTeleportGapContact = !ev().some((e) => e.type === 'RobotA1Contact');
  const stateRemainsRobotOwned = o.ctA.store['robot.virtual_armor'].armorUntil === armorUntilBefore
    && !o.ctB.store['robot.virtual_armor'];

  gate('R2-mirror-a2-during-robot-active-states',
    rA2.ok && rA1.ok && rM.ok && atomicExchange && noTeleportGapContact && stateRemainsRobotOwned,
    {
      lifecycle: 'HR.pressAbility(ROBOT, A2) + HR.pressAbility(ROBOT, A1) -> HR.pressAbility(MIRROR, A2) -> SNAP',
      atomicExchange, noTeleportGapContact, stateRemainsRobotOwned,
      unresolvedNote: 'Post-relocation robot.weapon_dash continuation vs cancellation is not separately specified by Robot authority; frozen invariants (atomic swap, no teleport-gap contact, Robot state ownership) hold.',
    });
  report.unresolvedNotes.push({
    area: 'R2-post-relocation-robot-dash-policy',
    classification: 'UNRESOLVED / NO FROZEN PRODUCT LAW',
    detail: 'Robot authority does not freeze whether an external coordinate swap cancels or re-steers an in-flight A1 dash; current executor steers toward the target slot until arrival/timeout without violating any frozen invariant.',
  });
} catch (e) {
  gate('R2-mirror-a2-during-robot-active-states', false, { error: String(e) });
}

/* ============================================================================
 * 6 — MIRROR × MIRROR (MM1, MM2, MM3)
 * ========================================================================== */

// MM1 — independent passive networks.
try {
  const o = startMatch('MIRROR', 'MIRROR', 490, 500, 510, 500);
  // Real realized damage on Mirror A (4 hits of 35 -> 4 FREE shards) and Mirror B (4 hits of 35 -> 4 FREE shards)
  // right next to each other (~500, 500) to prove 4+4 across different owners NEVER cross-form (5 needed per owner)!
  for (let k = 0; k < 4; k++) {
    o.a.takeDamage(35, o.b);
    o.b.takeDamage(35, o.a);
  }
  T.step(1.1, DT); // past 0.7s eligibility + 0.3s scan: 4 shards on A + 4 shards on B must NOT cross-form!
  const stA = o.ctA.store['mirror.passive'];
  const stB = o.ctB.store['mirror.passive'];
  const separatePools = stA && stB && stA !== stB
    && stA.slots.length === 16 && stB.slots.length === 16
    && stA.slots.filter((s) => s && s.on && s.st === 0).length === 4
    && stB.slots.filter((s) => s && s.on && s.st === 0).length === 4;
  const noCrossForm = stA.nodes.filter((n) => n.st !== 0).length === 0
    && stB.nodes.filter((n) => n.st !== 0).length === 0;

  // Give each owner a 5th realized-damage shard -> each owner forms 1 ACTIVE node independently!
  o.a.takeDamage(35, o.b);
  o.b.takeDamage(35, o.a);
  o.a.x = 150; o.a.y = 200; o.b.x = 850; o.b.y = 200;
  T.step(2.0, DT); // eligible + scan + assembly + lock -> 1 ACTIVE node on A, 1 ACTIVE node on B
  const activeA1 = stA.nodes.filter((n) => n.st === 2);
  const activeB1 = stB.nodes.filter((n) => n.st === 2);
  const independentFormation = activeA1.length === 1 && activeB1.length === 1
    && activeA1[0].owner === o.ctA && activeB1[0].owner === o.ctB;

  // With 1 ACTIVE node on A and 1 ACTIVE node on B, firing through A's node must NOT cross-route to B's node!
  const nA = activeA1[0];
  const ev = captureSeq(['MirrorRouteCapture', 'MirrorRouteLocal']);
  W().fireBullet({ owner: o.b, x: nA.x + 60, y: nA.y, angle: Math.PI, speed: 1200, damage: 20, weapon: 'GLOCK_17', life: 0.1 });
  for (let f = 1; f <= 6; f++) win.APEX_ARSENAL.step(DT);
  const noCrossRoute = ev().some((e) => e.type === 'MirrorRouteLocal')
    && !ev().some((e) => e.type === 'MirrorRouteCapture');

  // Verify natural max 3 nodes per owner remains intact (seed/form up to 3 per owner).
  seedNode(o.ctA, 300, 700, 0);
  seedNode(o.ctA, 450, 700, 0);
  seedNode(o.ctB, 600, 700, 0);
  seedNode(o.ctB, 750, 700, 0);
  const maxThreePerOwner = stA.nodes.filter((n) => n.st === 2).length === 3
    && stB.nodes.filter((n) => n.st === 2).length === 3;

  gate('MM1-mirror-vs-mirror-independent-passive-networks',
    separatePools && noCrossForm && independentFormation && noCrossRoute && maxThreePerOwner,
    {
      lifecycle: 'takeDamage realized HP loss -> mirrorShardProc -> mirrorPassiveStep natural formation + cross-route denial',
      separatePools, noCrossForm, independentFormation, noCrossRoute, maxThreePerOwner,
    });
} catch (e) {
  gate('MM1-mirror-vs-mirror-independent-passive-networks', false, { error: String(e) });
}

// MM2 — overlapping routing.
try {
  const o = startMatch('MIRROR', 'MIRROR', 150, 200, 850, 800);
  // Owner A network at y=350: entry (350, 350) -> dest (550, 350)
  const aEntry = seedNode(o.ctA, 350, 350, 0);
  const aDest = seedNode(o.ctA, 550, 350, 0);
  // Owner B network at y=650: entry (650, 650) -> dest (450, 650)
  const bEntry = seedNode(o.ctB, 650, 650, 0);
  const bDest = seedNode(o.ctB, 450, 650, 0);

  const ev = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  const b0 = new Set(win.projectiles);
  W().fireBullet({ owner: o.b, x: 280, y: 350, angle: 0, speed: 1000, damage: 30, weapon: 'GLOCK_17', life: 5 });
  const pA = newestAfter(b0);
  const b1 = new Set(win.projectiles);
  W().fireBullet({ owner: o.a, x: 720, y: 650, angle: Math.PI, speed: 1000, damage: 30, weapon: 'GLOCK_17', life: 5 });
  const pB = newestAfter(b1);

  let bothInEscrow = false;
  for (let f = 1; f <= 60; f++) {
    win.APEX_ARSENAL.step(DT);
    if (escrowList().length === 2) bothInEscrow = true;
    if (ev().filter((e) => e.type === 'MirrorRouteEmerge').length === 2) break;
  }
  const caps = ev().filter((e) => e.type === 'MirrorRouteCapture');
  const ems = ev().filter((e) => e.type === 'MirrorRouteEmerge');
  const capA = caps.find((e) => e.payload.owner === 0);
  const capB = caps.find((e) => e.payload.owner === 1);
  const emA = ems.find((e) => e.payload.via === aDest.id);
  const emB = ems.find((e) => e.payload.via === bDest.id);

  const correctNetworks = !!capA && !!capB && !!emA && !!emB
    && capA.payload.entry === aEntry.id && capA.payload.dest === aDest.id
    && capB.payload.entry === bEntry.id && capB.payload.dest === bDest.id;
  const bothNeutral = !!(pA.__hr && pA.__hr.neutral) && !!(pB.__hr && pB.__hr.neutral);

  gate('MM2-mirror-vs-mirror-overlapping-routing',
    bothInEscrow && correctNetworks && bothNeutral,
    {
      lifecycle: 'Simultaneous W.fireBullet into ctA and ctB ACTIVE node pairs -> overlapping escrow -> independent same-owner emergence',
      bothInEscrow, correctNetworks, bothNeutral,
      capA: capA && capA.payload, capB: capB && capB.payload,
    });
} catch (e) {
  gate('MM2-mirror-vs-mirror-overlapping-routing', false, { error: String(e) });
}

// MM3 — overlapping A2 casts.
try {
  // Part A: Same-frame simultaneous A2 casts -> coalesced single physical swap, 2 MirrorExchange events.
  const o1 = startMatch('MIRROR', 'MIRROR', 200, 500, 800, 500);
  const ev1 = captureSeq(['MirrorExchange']);
  const r1A = HR.pressAbility(o1.a, 'A2');
  const r1B = HR.pressAbility(o1.b, 'A2');
  for (let i = 1; i <= 31; i++) T.step(DT120, DT120);
  const ex1 = ev1();
  const simultaneousOk = r1A.ok && r1B.ok && ex1.length === 2
    && ex1[0].payload.coalesced === 1 && ex1[1].payload.coalesced === 1
    && close(o1.a.x, 800) && close(o1.b.x, 200)
    && close(o1.a.__hrWallPos.x, 800) && close(o1.b.__hrWallPos.x, 200);

  // Part B: Staggered overlapping A2 casts (A casts at t=0, B casts 10 steps later -> two sequential swaps).
  const o2 = startMatch('MIRROR', 'MIRROR', 220, 400, 780, 600);
  const ev2 = captureSeq(['MirrorExchange']);
  const r2A = HR.pressAbility(o2.a, 'A2');
  for (let i = 1; i <= 10; i++) T.step(DT120, DT120);
  const r2B = HR.pressAbility(o2.b, 'A2');
  for (let i = 11; i <= 31; i++) T.step(DT120, DT120); // A snaps at step 31
  const afterFirstSnap = { ax: o2.a.x, ay: o2.a.y, bx: o2.b.x, by: o2.b.y };
  for (let i = 32; i <= 41; i++) T.step(DT120, DT120); // B snaps at step 41
  const afterSecondSnap = { ax: o2.a.x, ay: o2.a.y, bx: o2.b.x, by: o2.b.y };
  const ex2 = ev2();
  const staggeredOk = r2A.ok && r2B.ok && ex2.length === 2
    && close(afterFirstSnap.ax, 780) && close(afterFirstSnap.bx, 220)
    && close(afterSecondSnap.ax, 220) && close(afterSecondSnap.bx, 780);

  gate('MM3-mirror-vs-mirror-overlapping-a2-casts',
    simultaneousOk && staggeredOk,
    {
      lifecycle: 'HR.pressAbility(MIRROR_A, A2) + HR.pressAbility(MIRROR_B, A2) simultaneous and staggered -> resolvePendingMirrorSnaps',
      simultaneousOk, staggeredOk,
    });
  report.unresolvedNotes.push({
    area: 'MM-A1-temporary-copy-of-temporary-copy-lifetime',
    classification: 'UNRESOLVED / NO FROZEN PRODUCT LAW',
    detail: 'Mirror A1 authority snapshots weaponId at cast and grants a fresh 6.0s copy at OWN, but does not define a special remaining-lifetime inheritance rule when copying an opponent Mirror temporary copy; non-blocking per F3-A scope.',
  });
} catch (e) {
  gate('MM3-mirror-vs-mirror-overlapping-a2-casts', false, { error: String(e) });
}

/* ============================================================================
 * 7 — T6 REGRESSION
 * ========================================================================== */
try {
  const o = startMatch('MIRROR', 'ROBOT', 250, 500, 850, 500);
  seedNode(o.ctA, 500, 500, 0);
  seedNode(o.ctA, 650, 500, 0);

  // 1. T6 cannot be Mirror A1 copied.
  W().equip(o.b, 'STORMBREAKER');
  const ev = captureSeq(['MirrorA1Cast', 'MirrorWhiff', 'MirrorRoutePreview', 'MirrorRouteLocal', 'MirrorRouteCapture', 'RealizedDamageEvent']);
  const rA1 = HR.pressAbility(o.a, 'A1');
  const castEv = ev().find((e) => e.type === 'MirrorA1Cast');
  const a1Denied = rA1.ok && !!castEv && castEv.payload.whiff === true
    && castEv.payload.reason === 't6' && held(o.a) === null;

  // 2. T6 cannot be Mirror-routed/manipulated; 3. Realized T6 damage spawns Mirror shards.
  const hpBefore = o.a.hp;
  W().spawnThrownMelee(o.b, 'STORMBREAKER', Math.PI);
  for (let f = 1; f <= 45; f++) {
    win.APEX_ARSENAL.step(DT);
    if (o.a.hp < hpBefore) break;
  }
  const allEv = ev();
  const routeEvs = allEv.filter((e) => e.type.startsWith('MirrorRoute'));
  const freeShards = o.ctA.store['mirror.passive'].slots.filter((s) => s && s.on && s.st === 0).length;
  const shardTelemetry = o.ctA.telemetry.bySkill['mirror.shattered_mirrors:shards'] || 0;

  gate('T6-stormbreaker-a1-routing-passive-regression',
    a1Denied && routeEvs.length === 0 && escrowList().length === 0
    && o.a.hp < hpBefore && shardTelemetry > 0 && freeShards > 0,
    {
      lifecycle: 'W.equip(STORMBREAKER) -> HR.pressAbility(MIRROR, A1) whiff -> W.spawnThrownMelee(STORMBREAKER) across nodes -> hits MIRROR -> mirrorShardProc',
      a1Denied, routeEvents: routeEvs.length, hpLost: +(hpBefore - o.a.hp).toFixed(1),
      shardTelemetry, freeShards,
    });
} catch (e) {
  gate('T6-stormbreaker-a1-routing-passive-regression', false, { error: String(e) });
}

/* ============================================================================
 * 8 — TEARDOWN / REMATCH (T1, T2, T3)
 * ========================================================================== */

// T1 — Mirror escrow + shard/node + pending Mirror action: teardown before completion, then new match.
try {
  const o1 = startMatch('MIRROR', 'ROBOT', 250, 500, 850, 500);
  W().equip(o1.b, 'PISTOL');
  seedNode(o1.ctA, 450, 500, 0);
  seedNode(o1.ctA, 650, 500, 0);
  W().aqDamage(o1.a, 80, o1.b, 'PISTOL', { impact: { x: 250, y: 500, vx: -1, vy: 0 } });
  HR.pressAbility(o1.a, 'A1'); // pending A1 cast (before 0.933s OWN)
  W().fireBullet({ owner: o1.b, x: 380, y: 500, angle: 0, speed: 1200, damage: 30, weapon: 'GLOCK_17', life: 5 });
  for (let f = 1; f <= 8; f++) win.APEX_ARSENAL.step(DT);
  const preTeardownEscrow = escrowList().length;

  // Rematch before escrow emergence or A1 OWN completes.
  const o2 = startMatch('MIRROR', 'ROBOT', 250, 500, 850, 500);
  const evNew = captureSeq(['MirrorRouteEmerge', 'MirrorEscrowImage', 'MirrorA1Own', 'MirrorExchange']);
  T.step(DT, DT); // initialize passive state on first tick
  const stNew = o2.ctA.store['mirror.passive'];
  const cleanAtStart = escrowList().length === 0
    && stNew && stNew.nodes.length === 0
    && stNew.slots.every((s) => !s || s.st === 0)
    && !o2.ctA.store.__mirrorAct && !o2.ctA.store.__mirrorCopy;

  T.step(1.5, DT);
  const noLeakedEvents = evNew().length === 0 && held(o2.a) === null;

  gate('T1-teardown-mirror-escrow-nodes-pending-actions',
    preTeardownEscrow === 1 && cleanAtStart && noLeakedEvents,
    {
      lifecycle: 'Mid-escrow + FREE shards + ACTIVE nodes + pending A1 -> T.start rematch -> step 1.5s',
      preTeardownEscrow, cleanAtStart, leakedEvents: evNew().length,
    });
} catch (e) {
  gate('T1-teardown-mirror-escrow-nodes-pending-actions', false, { error: String(e) });
}

// T2 — Mirror vs WORLD-STATE Heroes (Magnet active field + Crystala construct): teardown before completion, then new match.
try {
  const MAG = win.APEX_MAGNET;
  const CRY = win.APEX_CRYSTAL;

  // Match 1: Magnet A2 active field + Mirror escrow
  const m1 = startMatch('MAGNET', 'MIRROR', 300, 500, 700, 500);
  HR.pressAbility(m1.a, 'A2');
  seedNode(m1.ctB, 450, 500, 0);
  seedNode(m1.ctB, 600, 500, 0);
  W().fireBullet({ owner: m1.a, x: 380, y: 500, angle: 0, speed: 1200, damage: 30, weapon: 'GLOCK_17', life: 5 });
  for (let f = 1; f <= 8; f++) win.APEX_ARSENAL.step(DT);
  const magActiveBefore = MAG.activeFields(AIL.clock()).length === 1 && escrowList().length === 1;

  // Match 2: Crystala A1 wall construct + Mirror escrow
  const m2 = startMatch('CRYSTAL', 'MIRROR', 150, 500, 850, 500);
  const magClearedOnRematch = MAG.activeFields(AIL.clock()).length === 0 && MAG.inspect(AIL.clock()).fields.length === 0;
  T.step(0.35, DT);
  HR.pressAbility(m2.a, 'A1');
  T.step(0.5, DT);
  const cryActiveBefore = CRY.capsules().length > 0;

  // Match 3: clean Mirror vs Robot match
  startMatch('MIRROR', 'ROBOT', 250, 500, 750, 500);
  const cryClearedOnRematch = CRY.capsules().length === 0;

  gate('T2-teardown-mirror-vs-world-state-heroes-magnet-crystala',
    magActiveBefore && magClearedOnRematch && cryActiveBefore && cryClearedOnRematch,
    {
      lifecycle: 'MAGNET A2 + Mirror escrow -> rematch CRYSTAL A1 construct -> rematch MIRROR/ROBOT',
      magActiveBefore, magClearedOnRematch, cryActiveBefore, cryClearedOnRematch,
    });
} catch (e) {
  gate('T2-teardown-mirror-vs-world-state-heroes-magnet-crystala', false, { error: String(e) });
}

// T3 — Mirror vs Mirror teardown + scheduler / combatant / wrapper hygiene.
try {
  const stepFnBefore = win.APEX_ARSENAL.step;
  const o1 = startMatch('MIRROR', 'MIRROR', 250, 500, 750, 500);
  seedNode(o1.ctA, 350, 400, 0);
  seedNode(o1.ctA, 550, 400, 0);
  seedNode(o1.ctB, 650, 600, 0);
  seedNode(o1.ctB, 450, 600, 0);
  HR.pressAbility(o1.a, 'A2');
  HR.pressAbility(o1.b, 'A2');
  let staleCallbackFired = false;
  HR.match.api.after(0.2, () => { staleCallbackFired = true; }, 'test-stale-match-job');

  // Rematch Mirror vs Mirror before A2 SNAP or scheduled job fires.
  const o2 = startMatch('MIRROR', 'MIRROR', 250, 500, 750, 500);
  const stepFnAfter = win.APEX_ARSENAL.step;
  const evNew = captureSeq(['MirrorExchange']);
  T.step(0.5, DT);

  const stA2 = o2.ctA.store['mirror.passive'];
  const stB2 = o2.ctB.store['mirror.passive'];
  const bothClean = stA2.nodes.length === 0 && stB2.nodes.length === 0
    && stA2 !== stB2 && escrowList().length === 0 && evNew().length === 0;
  const ownershipValid = o2.a.__hrCombatant === o2.ctA && o2.b.__hrCombatant === o2.ctB;
  const noWrapperDuplication = stepFnBefore === stepFnAfter;

  gate('T3-teardown-mirror-vs-mirror-and-scheduler-wrapper-hygiene',
    bothClean && !staleCallbackFired && ownershipValid && noWrapperDuplication,
    {
      lifecycle: 'MIRROR vs MIRROR nodes + pending A2 + hrScheduler job -> rematch MIRROR vs MIRROR -> step 0.5s',
      bothClean, staleCallbackFired, ownershipValid, noWrapperDuplication,
    });
} catch (e) {
  gate('T3-teardown-mirror-vs-mirror-and-scheduler-wrapper-hygiene', false, { error: String(e) });
}

if (HR.match) win.exitArsenalQuestMode();

fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/f3a-core-six-interop.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2));

const total = Object.keys(report.gates).length;
const passed = total - report.failures.length;
console.log(`\n[MIRROR F3-A CORE SIX INTEROP] ${passed}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
