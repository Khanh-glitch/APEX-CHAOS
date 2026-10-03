#!/usr/bin/env node
/* CHECKPOINT E — MIRROR A1/A2 final gameplay authority.
 * Drives the REAL shipping loop (APEX_ARSENAL.step) via the shared harness.
 */
import { bootHarness } from './lib/crystalaHarness.mjs';
import fs from 'node:fs';

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

function start(p2 = 'ROBOT') {
  T.start('MIRROR', p2); T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = 300; a.y = 500; b.x = 700; b.y = 500;
  const ct = HR.byCombatant(a);
  return { a, b, ct, ctl: HR.abilityController(ct), ctB: HR.byCombatant(b) };
}
const held = (f) => { const h = W.getHolder ? W.getHolder(f) : null; return h ? h.weaponId : null; };
const holderOf = (f) => (W.getHolder ? W.getHolder(f) : null);
function arm(f, id) { if (W.equip) W.equip(f, id); return held(f); }
function bus() { return HR.bus || (win.APEX_HERO_REWORK_AIL && win.APEX_HERO_REWORK_AIL.bus); }
function capture(types) {
  const b = bus(); const mark = b.ring.length;
  return () => b.ring.slice(mark).filter((e) => types.includes(e.type));
}

/* ============================== A1 ============================== */
try {
  const o = start(); arm(o.b, 'PISTOL');
  const ev = capture(['MirrorA1Cast', 'MirrorA1Own']);
  const res = HR.pressAbility(o.a, 'A1');
  const atCast = held(o.a);
  gate('E-A1-01-no-copy-at-cast', res.ok && atCast === null, { cast: res, heldAtCast: atCast });
  T.step(0.90, DT);
  gate('E-A1-02-no-copy-before-OWN', held(o.a) === null, { at090: held(o.a) });
  T.step(0.05, DT);
  const own = ev().find((e) => e.type === 'MirrorA1Own');
  gate('E-A1-03-OWN-at-canonical-first-crossing',
    !!own && close(own.payload.t, 0.93333, 0.0084), { t: own && +own.payload.t.toFixed(5), canonical: 0.93333 });
  gate('E-A1-04-fresh-holder-instance-at-OWN', held(o.a) === 'PISTOL' && !!holderOf(o.a), { held: held(o.a) });
  gate('E-A1-06-opponent-keeps-original', held(o.b) === 'PISTOL', { opponent: held(o.b) });
} catch (e) { gate('E-A1-01-no-copy-at-cast', false, String(e)); }

try {
  const o = start(); arm(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A1');
  T.step(0.2, DT); arm(o.b, 'SHOTGUN');           // opponent swaps after cast
  T.step(0.80, DT);
  gate('E-A1-07-swap-after-cast-uses-cast-snapshot', held(o.a) === 'PISTOL', { mirror: held(o.a), opponent: held(o.b) });
} catch (e) { gate('E-A1-07-swap-after-cast-uses-cast-snapshot', false, String(e)); }

try {
  const o = start(); arm(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A1');
  T.step(0.2, DT); if (W.consume) W.consume(o.b, 'test-drop');
  T.step(0.80, DT);
  gate('E-A1-08-drop-after-cast-still-copies', held(o.a) === 'PISTOL', { mirror: held(o.a) });
} catch (e) { gate('E-A1-08-drop-after-cast-still-copies', false, String(e)); }

try {
  const o = start(); arm(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A1');
  T.step(0.2, DT); o.b.hp = 0;
  T.step(0.80, DT);
  gate('E-A1-09-opponent-death-does-not-invalidate', held(o.a) === 'PISTOL', { mirror: held(o.a) });
} catch (e) { gate('E-A1-09-opponent-death-does-not-invalidate', false, String(e)); }

try {
  const o = start(); arm(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A1');
  T.step(0.2, DT); o.a.hp = 0;
  T.step(0.80, DT);
  gate('E-A1-10-mirror-death-before-OWN-no-copy', held(o.a) === null, { mirror: held(o.a) });
} catch (e) { gate('E-A1-10-mirror-death-before-OWN-no-copy', false, String(e)); }

for (const [id, label, setup] of [
  ['E-A1-11-unarmed-whiff', 'unarmed', (o) => { if (W.consume) W.consume(o.b, 'test'); }],
  ['E-A1-12-t6-whiff', 't6', (o) => arm(o.b, 'STORMBREAKER')],
  ['E-A1-13-shield-whiff', 'shield', (o) => arm(o.b, 'TOWER_SHIELD')],
]) {
  try {
    const o = start(); setup(o);
    const ev = capture(['MirrorWhiff']);
    const res = HR.pressAbility(o.a, 'A1');
    const cd = o.ctl.cooldownLeft('A1');
    T.step(1.0, DT);
    gate(id, res.ok && cd > 14 && held(o.a) === null && ev().length === 1,
      { label, cast: res.ok, cooldown: +cd.toFixed(2), held: held(o.a), whiffEvents: ev().length });
  } catch (e) { gate(id, false, String(e)); }
}

/* Copy-lifetime law.
 *
 * FIXTURE NOTE: an equipped firearm is auto-activated by the ordinary
 * arsenalWeaponRuntime.updateHolder path whenever a live target exists, which
 * depletes it long before 6s and would confound the lifetime law. Melee is not
 * a valid substitute (it does not persist in the holder the way the old
 * fixture assumed). The controlled condition used here is simply to remove the
 * live target AFTER OWN -- which E-A1-09 already proves cannot affect the
 * cast-time snapshot. No production code is special-cased for tests. */
try {
  const o = start(); arm(o.b, 'PISTOL');
  const castClock = win.matchClock;
  const ownEv = capture(['MirrorA1Own']);
  HR.pressAbility(o.a, 'A1');
  T.step(0.95, DT);
  const own = ownEv()[0];
  const rec = o.ct.store.__mirrorCopy;
  // Exact: the 6s window is measured from the clock AT materialisation, which
  // the OWN event now carries, so there is no sampling-point drift. And it is
  // demonstrably NOT 6s from cast.
  gate('E-A1-14-lifetime-starts-at-OWN-not-cast',
    !!rec && !!own && close(rec.until - own.payload.clock, 6, 1e-9)
    && !close(rec.until - castClock, 6, 0.02)
    && held(o.a) === 'PISTOL',
    { castClock: +castClock.toFixed(4), ownClock: own && +own.payload.clock.toFixed(5),
      until: rec && +rec.until.toFixed(5),
      sinceOwn: own && rec && +(rec.until - own.payload.clock).toFixed(9),
      sinceCast: rec && +(rec.until - castClock).toFixed(4) });

  o.b.hp = 0;                                  // controlled: no live fire target
  T.step(5.4, DT);
  const beforeExpiry = held(o.a);
  T.step(0.8, DT);
  const afterExpiry = held(o.a);
  gate('E-A1-15-copy-expires-six-seconds-after-OWN',
    beforeExpiry === 'PISTOL' && afterExpiry === null,
    { atOwnPlus5p4: beforeExpiry, atOwnPlus6p2: afterExpiry, until: rec && +rec.until.toFixed(3) });
} catch (e) { gate('E-A1-14-lifetime-starts-at-OWN-not-cast', false, String(e)); }

try {
  const o = start(); arm(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A1');
  T.step(0.95, DT);
  const copyHolder = holderOf(o.a);
  o.b.hp = 0;
  arm(o.a, 'SHOTGUN');                         // DIFFERENT real holder, canonical equip
  const replHolder = holderOf(o.a);
  T.step(6.5, DT);                             // well past the old copy expiry
  gate('E-A1-16-replacement-survives-expiry',
    held(o.a) === 'SHOTGUN' && holderOf(o.a) === replHolder && replHolder !== copyHolder,
    { held: held(o.a), replacementIsSameInstance: holderOf(o.a) === replHolder,
      differsFromCopy: replHolder !== copyHolder });
} catch (e) { gate('E-A1-16-replacement-survives-expiry', false, String(e)); }

/* Critical instance-safety proof: a later REAL pickup of the SAME weaponId
 * must never be consumed by the old Mirror copy's expiry. */
try {
  const o = start(); arm(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A1');
  T.step(0.95, DT);
  const copyHolder = holderOf(o.a);
  const copyToken = copyHolder && copyHolder.__hrMirrorCopyToken;
  o.b.hp = 0;
  if (W.consume) W.consume(o.a, 'test-drop');
  arm(o.a, 'PISTOL');                          // later REAL pickup, SAME id
  const laterHolder = holderOf(o.a);
  T.step(6.5, DT);                             // past the old copy expiry
  gate('E-A1-17-later-same-id-real-pickup-survives',
    held(o.a) === 'PISTOL' && holderOf(o.a) === laterHolder
    && laterHolder !== copyHolder
    && (laterHolder && laterHolder.__hrMirrorCopyToken) !== copyToken,
    { held: held(o.a), sameInstanceAsCopy: laterHolder === copyHolder,
      copyToken: copyToken || null,
      laterToken: (laterHolder && laterHolder.__hrMirrorCopyToken) || null,
      note: 'must not be consumed merely because weaponId matches' });
} catch (e) { gate('E-A1-17-later-same-id-real-pickup-survives', false, String(e)); }

try {
  const o = start(); arm(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A1');
  T.step(0.3, DT);
  const blocked = HR.pressAbility(o.a, 'A2');
  T.step(1.25, DT);                              // past A1 authored end 1.475
  o.ctl.setCooldown('A2', 0);
  const allowed = HR.pressAbility(o.a, 'A2');
  gate('E-A1-19-A2-cannot-overlap-A1-window', blocked.ok === false, blocked);
  gate('E-A1-20-A2-allowed-after-authored-end-despite-busy-envelope',
    allowed.ok === true, { allowed, note: 'presentation busy 2.2s is not a gameplay lock' });
} catch (e) { gate('E-A1-19-A2-cannot-overlap-A1-window', false, String(e)); }

/* ============================== A2 ============================== */
try {
  const o = start();
  gate('E-A2-01-cooldown-12', win.APEX_HERO_REWORK_REGISTRY.HEROES.MIRROR.skills.A2.baseConfig.cooldown === 12, null);
  const mech = fs.readFileSync('public/game/hero-rework/heroMechanicsRuntime.js', 'utf8');
  gate('E-A2-02-no-generic-after-telegraph-swap',
    !/ctx\.api\.after\(ctx\.cfg\.telegraph/.test(mech) && !/new AIL\.RelocationTransaction/.test(mech), null);
} catch (e) { gate('E-A2-01-cooldown-12', false, String(e)); }

/* The A2 executor only REQUESTS the snap during pre-movement onTick; the
 * exchange resolves in the POST-MOVEMENT resolver. The fixture therefore steps
 * one canonical Mirror step at a time (each T.step runs hrPreTick ->
 * Fighter.update -> hrPostTick) and counts exact steps. */
try {
  const o = start();
  const ev = capture(['MirrorExchange']);
  HR.pressAbility(o.a, 'A2');
  let at30 = null, firstStep = null, firstT = null;
  for (let i = 1; i <= 40; i++) {
    T.step(DT, DT);
    if (i === 30) at30 = ev().length;
    if (firstStep === null && ev().length > 0) { firstStep = i; firstT = ev()[0].payload.t; }
  }
  gate('E-A2-03-snap-at-canonical-first-crossing',
    at30 === 0 && firstStep !== null && ev().length === 1 && close(firstT, 0.25833, 0.0001),
    { exchangeEventsAfter30Steps: at30, firstObservedAtStep: firstStep,
      payloadT: firstT === null ? null : +firstT.toFixed(5),
      canonical: 0.25833, totalEvents: ev().length });
} catch (e) { gate('E-A2-03-snap-at-canonical-first-crossing', false, String(e)); }

try {
  const o = start();
  o.a.hp = 77; o.b.hp = 41;
  arm(o.a, 'PISTOL'); arm(o.b, 'SHOTGUN');
  o.a.vx = 123; o.a.vy = -45; o.b.vx = -60; o.b.vy = 12;
  const ax = o.a.x, ay = o.a.y, bx = o.b.x, by = o.b.y;
  HR.pressAbility(o.a, 'A2');
  T.step(0.30, DT);
  gate('E-A2-05-exact-coordinate-exchange',
    close(o.a.x, bx) && close(o.a.y, by) && close(o.b.x, ax) && close(o.b.y, ay),
    { a: [o.a.x, o.a.y], b: [o.b.x, o.b.y], expectA: [bx, by], expectB: [ax, ay] });
  gate('E-A2-06-velocity-retained',
    close(o.a.vx, 123) && close(o.a.vy, -45) && close(o.b.vx, -60) && close(o.b.vy, 12),
    { a: [o.a.vx, o.a.vy], b: [o.b.vx, o.b.vy] });
  gate('E-A2-07-hp-retained', o.a.hp === 77 && o.b.hp === 41, { a: o.a.hp, b: o.b.hp });
  gate('E-A2-08-weapons-retained', held(o.a) === 'PISTOL' && held(o.b) === 'SHOTGUN',
    { a: held(o.a), b: held(o.b) });
} catch (e) { gate('E-A2-05-exact-coordinate-exchange', false, String(e)); }

/* observer atomicity — the core A2 requirement */
try {
  const o = start();
  const ax = o.a.x, ay = o.a.y, bx = o.b.x, by = o.b.y;
  const b = bus();
  let firstObs = null;
  const probe = () => {
    if (firstObs) return;
    firstObs = { aNow: [o.a.x, o.a.y], bNow: [o.b.x, o.b.y] };
  };
  b.on('Relocated', probe); b.on('MirrorExchange', probe);
  HR.pressAbility(o.a, 'A2');
  T.step(0.30, DT);
  const halfSwap = !firstObs || !(close(firstObs.aNow[0], bx) && close(firstObs.aNow[1], by)
    && close(firstObs.bNow[0], ax) && close(firstObs.bNow[1], ay));
  gate('E-A2-10-observer-sees-no-half-swap', firstObs !== null && !halfSwap,
    { atFirstEvent: firstObs, expectedA: [bx, by], expectedB: [ax, ay] });
} catch (e) { gate('E-A2-10-observer-sees-no-half-swap', false, String(e)); }

try {
  const o = start();
  const ax = o.a.x, bx = o.b.x;
  HR.pressAbility(o.a, 'A2');
  T.step(0.1, DT); o.b.hp = 0;
  const cd = o.ctl.cooldownLeft('A2');
  T.step(0.5, DT);
  gate('E-A2-11-death-before-snap-no-relocation', close(o.a.x, ax), { a: o.a.x, was: ax });
  gate('E-A2-12-cooldown-remains-spent', cd > 11, { cooldown: +cd.toFixed(2) });
} catch (e) { gate('E-A2-11-death-before-snap-no-relocation', false, String(e)); }

try {
  const o = start();
  HR.pressAbility(o.a, 'A2');
  T.step(0.1, DT);
  win.exitArsenalBattleMode();
  const o2 = start();
  const ax = o2.a.x, bx = o2.b.x;
  T.step(1.0, DT);
  gate('E-A2-13-teardown-no-late-callback', close(o2.a.x, ax) && close(o2.b.x, bx),
    { a: o2.a.x, b: o2.b.x });
} catch (e) { gate('E-A2-13-teardown-no-late-callback', false, String(e)); }

/* Mirror-vs-Mirror simultaneous snap must exchange ONCE */
try {
  const o = start('MIRROR');
  const ax = o.a.x, ay = o.a.y, bx = o.b.x, by = o.b.y;
  const r1 = HR.pressAbility(o.a, 'A2');
  const r2 = HR.pressAbility(o.b, 'A2');
  T.step(0.30, DT);
  const swappedOnce = close(o.a.x, bx) && close(o.a.y, by) && close(o.b.x, ax) && close(o.b.y, ay);
  const backToOrigin = close(o.a.x, ax) && close(o.b.x, bx);
  gate('E-A2-17-mirror-vs-mirror-simultaneous-snap-exchanges-once',
    r1.ok && r2.ok && swappedOnce && !backToOrigin,
    { cast1: r1.ok, cast2: r2.ok, a: [o.a.x, o.a.y], b: [o.b.x, o.b.y],
      expectA: [bx, by], expectB: [ax, ay], backToOrigin });
} catch (e) { gate('E-A2-17-mirror-vs-mirror-simultaneous-snap-exchanges-once', false, String(e)); }

try {
  const o = start(); arm(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A2');
  T.step(0.1, DT);
  const blocked = HR.pressAbility(o.a, 'A1');
  T.step(0.60, DT);                               // past A2 authored end .64
  o.ctl.setCooldown('A1', 0);
  const allowed = HR.pressAbility(o.a, 'A1');
  gate('E-A2-18-A1-cannot-overlap-A2-window', blocked.ok === false, blocked);
  gate('E-A2-19-A1-allowed-after-authored-end-despite-busy-envelope', allowed.ok === true,
    { allowed, note: 'presentation busy 1.8s is not a gameplay lock' });
} catch (e) { gate('E-A2-18-A1-cannot-overlap-A2-window', false, String(e)); }

/* ============================================================================
 * PRE-F1 E-PROOF ADDITIONS — missing LOCAL Checkpoint-E proofs.
 * E-A1-05 / E-A1-18 / E-A2-04 / E-A2-09 / E-A2-14 / E-A2-20.
 * These gates ADD proof; they do not reopen or redesign A1/A2.
 * ========================================================================== */

/* startMoving(): identical to start() EXCEPT baseSpeed is NOT zeroed. Bodies
 * keep production speed and move through the real Fighter.update locomotion
 * seam (heading via setDir, nothing frozen, nothing pinned) — the same
 * real-movement pattern as tools/testHeroReworkLocomotionGates.mjs. */
function startMoving(p2 = 'ROBOT') {
  T.start('MIRROR', p2); T.holdSpawns();
  const [a, b] = H.fighters();
  const ct = HR.byCombatant(a);
  return { a, b, ct, ctl: HR.abilityController(ct), ctB: HR.byCombatant(b) };
}

/* Eviction-safe event capture for the gates below. The shared bus ring is
 * capped (EVENT_RING_CAP = 160), so an index mark silently returns [] once
 * the ring saturates late in this long suite. Capture by the bus's monotonic
 * seq instead (bus.since). */
function captureSeq(types) {
  const b = bus(); const mark = b.seq;
  return () => b.since(mark).filter((e) => types.includes(e.type));
}

/* E-A1-05 — the OWN copy is a FRESH Arsenal holder. Same weapon identity as
 * the cast-time snapshot, but no mutable holder state may transfer merely
 * because weaponId matches. Expected fresh values come 1:1 from the canonical
 * W.equip creation path (arsenalWeaponRuntime.js): phase 'READY', elapsed 0,
 * shotsFired 0, consumed false — nothing fabricated.
 *
 * FIXTURE NOTE: while the Mirror is a live target, the opponent's equipped
 * firearm auto-fires and is eventually CONSUMED by the ordinary holder path,
 * which would destroy the very used-state this gate must inspect. The used
 * state is therefore sampled first; the opponent is then killed BEFORE the
 * cast — a condition E-A1-09-equivalent reproduction confirms is legal: the
 * dead opponent's holder persists and the cast still snapshots it. */
try {
  const o = start(); arm(o.b, 'PISTOL');
  T.step(0.4, DT);                          // opponent holder ages and fires at the live Mirror
  const oppHolder = holderOf(o.b);
  const oppUsed = oppHolder ? { elapsed: oppHolder.elapsed, shotsFired: oppHolder.shotsFired, phase: oppHolder.phase } : null;
  o.b.hp = 0;                               // freeze the holder's usage; snapshot law unaffected
  const res = HR.pressAbility(o.a, 'A1');
  T.step(0.95, DT);                         // past canonical OWN (step 112, ~0.93333s)
  const copyHolder = holderOf(o.a);
  gate('E-A1-05-copy-holder-is-fresh-not-inherited',
    res.ok && held(o.a) === 'PISTOL'
    && !!copyHolder && !!oppHolder && copyHolder !== oppHolder
    && copyHolder.weaponId === oppHolder.weaponId
    && copyHolder.shotsFired === 0
    && copyHolder.consumed === false
    && copyHolder.phase === 'READY'
    && copyHolder.elapsed < 0.1             // only post-OWN frames may have ticked it
    && oppUsed !== null && oppUsed.elapsed > 0.35   // opponent holder WAS partially used
    && !(oppUsed.phase === 'READY' && oppUsed.elapsed === 0 && oppUsed.shotsFired === 0),
    { cast: res.ok,
      sameWeaponIdentity: !!(copyHolder && oppHolder && copyHolder.weaponId === oppHolder.weaponId),
      distinctHolderInstances: copyHolder !== oppHolder,
      copyPhase: copyHolder && copyHolder.phase,
      copyElapsed: copyHolder === null ? null : +copyHolder.elapsed.toFixed(5),
      copyShotsFired: copyHolder && copyHolder.shotsFired,
      copyConsumed: copyHolder && copyHolder.consumed,
      opponentUsedStateAtSample: oppUsed && { elapsed: +oppUsed.elapsed.toFixed(4), shotsFired: oppUsed.shotsFired, phase: oppUsed.phase },
      note: 'used mutable holder state never transfers across a weaponId match' });
} catch (e) { gate('E-A1-05-copy-holder-is-fresh-not-inherited', false, String(e)); }

/* E-A1-18 — A1 does NOT root Mirror movement. Uses the native movement seam
 * (production baseSpeed + setDir through the real frame pipeline), NOT the
 * frozen start() helper and NOT any direct x += mutation. */
try {
  const o = startMoving(); arm(o.b, 'PISTOL');
  o.a.x = 250; o.a.y = 500; o.a.setDir(1, 0);    // east; ~0.95s of travel stays clear of walls
  o.b.x = 250; o.b.y = 150; o.b.setDir(-1, 0);   // opponent drifts away west; fixture stays quiet
  const speed = o.a.baseSpeed;
  const ev = captureSeq(['MirrorA1Cast', 'MirrorA1Own', 'MirrorA1End']);
  const res = HR.pressAbility(o.a, 'A1');
  const x0 = o.a.x;
  let ownAtStep = null, ownX = null, endSeenAtStep = null;
  const disp = [];
  let prev = x0;
  for (let i = 1; i <= 114; i++) {               // 0.95s: past canonical OWN (step 112), before authored end (~step 141)
    T.step(DT, DT);
    disp.push(o.a.x - prev); prev = o.a.x;
    if (ownAtStep === null && ev().some((e) => e.type === 'MirrorA1Own')) { ownAtStep = i; ownX = o.a.x; }
    if (endSeenAtStep === null && ev().some((e) => e.type === 'MirrorA1End')) endSeenAtStep = i;
  }
  const travelled = prev - x0;
  const nativeStride = disp.every((d) => d >= speed * DT * 0.5 && d <= speed * DT * 1.6);
  gate('E-A1-18-A1-does-not-root-native-movement',
    res.ok && speed > 0 && nativeStride
    && travelled > speed * 0.95 * 0.7
    && ownAtStep !== null && (ownX - x0) > speed * 0.7     // OWN fired mid-movement
    && endSeenAtStep === null                              // A1 still inside its authored window
    && held(o.a) === 'PISTOL',
    { cast: res.ok, baseSpeed: speed, travelledPx: +travelled.toFixed(1),
      expectedApproxPx: +(speed * 0.95).toFixed(1),
      ownAtStep, ownDisplacementPx: ownX === null ? null : +(ownX - x0).toFixed(1),
      A1EndBeforeWindowEnd: endSeenAtStep, heldAfterWindow: held(o.a),
      note: 'per-frame displacement bounded by production locomotion while A1 stays active' });
} catch (e) { gate('E-A1-18-A1-does-not-root-native-movement', false, String(e)); }

/* E-A2-04 — SNAP exchanges LIVE post-movement coordinates while BOTH fighters
 * move natively through the real frame pipeline. Strengthens E-A2-05 (static
 * coordinates). Coordinates are never written by the test after cast. */
try {
  const o = startMoving();
  o.a.x = 300; o.a.y = 300; o.a.setDir(1, 0);
  o.b.x = 300; o.b.y = 700; o.b.setDir(1, 0);    // parallel eastbound lanes: no contact, no walls
  const speedA = o.a.baseSpeed, speedB = o.b.baseSpeed;
  const castA = { x: o.a.x, y: o.a.y }, castB = { x: o.b.x, y: o.b.y };
  const ev = captureSeq(['MirrorExchange']);
  HR.pressAbility(o.a, 'A2');
  const trajA = [];
  for (let i = 1; i <= 30; i++) { T.step(DT, DT); trajA.push({ x: o.a.x, y: o.a.y }); }
  T.step(DT, DT);                                 // step 31: canonical SNAP frame
  const ex = ev().length === 1 ? ev()[0].payload : null;
  const aEnd = { x: o.a.x, y: o.a.y }, bEnd = { x: o.b.x, y: o.b.y };
  const movedA = Math.hypot(trajA[29].x - castA.x, trajA[29].y - castA.y);
  const movedB = ex ? Math.hypot(ex.opponent.from.x - castB.x, ex.opponent.from.y - castB.y) : NaN;
  const strideIntoSnap = ex ? Math.hypot(ex.self.from.x - trajA[29].x, ex.self.from.y - trajA[29].y) : NaN;
  gate('E-A2-04-live-post-movement-coordinates',
    !!ex
    && close(aEnd.x, ex.opponent.from.x) && close(aEnd.y, ex.opponent.from.y)
    && close(bEnd.x, ex.self.from.x) && close(bEnd.y, ex.self.from.y)
    && movedA > 50 && movedB > 50                            // NOT the cast-time coordinates
    && Number.isFinite(strideIntoSnap)
    && strideIntoSnap > 0 && strideIntoSnap <= speedA * DT * 2.5,   // one more frame of native movement, then sample
    { aFinal: [+aEnd.x.toFixed(2), +aEnd.y.toFixed(2)], bFinal: [+bEnd.x.toFixed(2), +bEnd.y.toFixed(2)],
      selfFrom: ex && ex.self.from, opponentFrom: ex && ex.opponent.from,
      castA, castB, baseSpeeds: [speedA, speedB],
      movedAPx: +movedA.toFixed(1), movedBPx: Number.isFinite(movedB) ? +movedB.toFixed(1) : null,
      strideIntoSnapFramePx: Number.isFinite(strideIntoSnap) ? +strideIntoSnap.toFixed(2) : null,
      note: 'finals equal the LIVE pre-snap samples, which differ from cast-time positions' });
} catch (e) { gate('E-A2-04-live-post-movement-coordinates', false, String(e)); }

/* E-A2-09 — status retention. Each fighter keeps ITS OWN statuses through the
 * exchange via the ordinary StatusResolver API; no exchange, no reset, no
 * Mirror-specific status copy. */
try {
  const o = start();
  const SR = win.APEX_HERO_REWORK_AIL.StatusResolver;
  HR.pressAbility(o.a, 'A2');
  SR.apply(o.a, 'STUN', 5);                       // distinguishable real statuses, normal API
  SR.apply(o.b, 'CHILL', 5);
  T.step(0.1, DT);
  const remABefore = SR.remaining(o.a, 'STUN');
  const remBBefore = SR.remaining(o.b, 'CHILL');
  const ax = o.a.x, ay = o.a.y, bx = o.b.x, by = o.b.y;
  T.step(0.20, DT);                               // through the step-31 SNAP
  const remAAfter = SR.remaining(o.a, 'STUN');
  const remBAfter = SR.remaining(o.b, 'CHILL');
  gate('E-A2-09-status-retention-own-statuses-survive-snap',
    close(o.a.x, bx) && close(o.a.y, by) && close(o.b.x, ax) && close(o.b.y, ay)   // exchange really happened
    && SR.has(o.a, 'STUN') && !SR.has(o.a, 'CHILL')
    && SR.has(o.b, 'CHILL') && !SR.has(o.b, 'STUN')
    && remAAfter > 4 && remAAfter < remABefore    // decayed normally: not reset, not cleared
    && remBAfter > 4 && remBAfter < remBBefore,
    { swapped: true,
      mirrorStatuses: { STUN: SR.has(o.a, 'STUN'), CHILL: SR.has(o.a, 'CHILL') },
      opponentStatuses: { STUN: SR.has(o.b, 'STUN'), CHILL: SR.has(o.b, 'CHILL') },
      mirrorStunRemaining: [+remABefore.toFixed(4), +remAAfter.toFixed(4)],
      opponentChillRemaining: [+remBBefore.toFixed(4), +remBAfter.toFixed(4)] });
} catch (e) { gate('E-A2-09-status-retention-own-statuses-survive-snap', false, String(e)); }

/* E-A2-14 — teleport is NOT a dash. A real solid world wall (production
 * M.api.spawnWall -> solidCapsules -> the swept-body authority
 * resolveWorldWalls) stands BETWEEN the two exchange endpoints while neither
 * endpoint touches it. No synthetic swept contact may be generated along the
 * teleport gap, and endpoint physics stays fully enabled. */
try {
  const o = start();
  const wall = HR.match.api.spawnWall({ owner: null, x: 500, y: 500, angle: Math.PI / 2, len: 400, hp: 1000, lifetime: 60 });
  o.a.__hrWallPos = { x: o.a.x, y: o.a.y };       // fixture hygiene: placement is not movement
  o.b.__hrWallPos = { x: o.b.x, y: o.b.y };
  T.step(2 * DT, DT);                             // idle frames: endpoints alone must not touch the wall
  const wallEvents = captureSeq(['WorldWallCollision']);
  const ax = o.a.x, ay = o.a.y, bx = o.b.x, by = o.b.y;
  const gapCrossesWall = !!wall && HR.geom.pointToSegmentDist(500, 500, ax, ay, bx, by) < 1
    && Math.hypot(ax - 500, ay - 500) > 75 + 13 + 50 && Math.hypot(bx - 500, by - 500) > 75 + 13 + 50;
  HR.pressAbility(o.a, 'A2');
  T.step(0.30, DT);                               // step-31 SNAP lands inside this window
  const atSnapA = { x: o.a.x, y: o.a.y }, atSnapB = { x: o.b.x, y: o.b.y };
  T.step(0.30, DT);                               // post-snap frames: where a dash-style sweep would hit the wall
  gate('E-A2-14-no-fabricated-teleport-path-contact',
    gapCrossesWall && wall.hp === 1000
    && close(atSnapA.x, bx) && close(atSnapA.y, by) && close(atSnapB.x, ax) && close(atSnapB.y, ay)
    && close(o.a.x, bx) && close(o.a.y, by) && close(o.b.x, ax) && close(o.b.y, ay)
    && wallEvents().length === 0,
    { wallId: wall && wall.id, fixtureGapCrossesWallBetweenEndpoints: gapCrossesWall,
      finalA: [o.a.x, o.a.y], finalB: [o.b.x, o.b.y], expectA: [bx, by], expectB: [ax, ay],
      worldWallCollisionsAfterSnap: wallEvents().length, wallHp: wall.hp,
      note: 'endpoints keep normal physics; only the gap must produce nothing' });
} catch (e) { gate('E-A2-14-no-fabricated-teleport-path-contact', false, String(e)); }

/* E-A2-20 — MirrorExchange history handoff payload (semantic bridge only; G
 * will REBASE Gold history from this exact truth — this gate never runs Gold
 * presentation). */
try {
  const o = start();
  const ev = captureSeq(['MirrorExchange']);
  HR.pressAbility(o.a, 'A2');
  T.step(0.30, DT);
  const ex = ev().length === 1 ? ev()[0].payload : null;
  const coherent = !!ex && !!ex.self && !!ex.opponent && !!ex.delta
    && !!ex.self.from && !!ex.self.to && !!ex.opponent.from && !!ex.opponent.to
    && ex.delta.x === ex.self.to.x - ex.self.from.x          // delta == self.to - self.from
    && ex.delta.y === ex.self.to.y - ex.self.from.y
    && ex.self.to.x === ex.opponent.from.x && ex.self.to.y === ex.opponent.from.y   // coherent exchange
    && ex.opponent.to.x === ex.self.from.x && ex.opponent.to.y === ex.self.from.y
    && (ex.delta.x !== 0 || ex.delta.y !== 0);
  // No gameplay path on the exchange route may clear presentation history.
  const worldSrc = fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js', 'utf8');
  const snapFn = worldSrc.slice(worldSrc.indexOf('function resolvePendingMirrorSnaps'), worldSrc.indexOf('function hrPostTick'));
  const mechSrc = fs.readFileSync('public/game/hero-rework/heroMechanicsRuntime.js', 'utf8');
  const exchangeBlock = mechSrc.slice(mechSrc.indexOf("EXECUTORS['mirror.exchange']"), mechSrc.indexOf("EXECUTORS['mirror.shattered_mirrors']"));
  const noHistoryClear = !/history\s*=\s*\[\]|history\.length\s*=\s*0|clearHistory|shiftHist\s*=\s*\[\]/.test(snapFn + exchangeBlock);
  gate('E-A2-20-history-handoff-payload-coherent',
    coherent && noHistoryClear
    && !!ex && close(o.a.x, ex.self.to.x) && close(o.a.y, ex.self.to.y)
    && close(o.b.x, ex.opponent.to.x) && close(o.b.y, ex.opponent.to.y),
    { payload: ex && { self: ex.self, opponent: ex.opponent, delta: ex.delta },
      deltaEqualsSelfToMinusSelfFrom: !!ex
        && ex.delta.x === ex.self.to.x - ex.self.from.x && ex.delta.y === ex.self.to.y - ex.self.from.y,
      noHistoryClearInExchangePath: noHistoryClear,
      note: 'payload is the exact truth G rebases Gold shiftHist from; never cleared here' });
} catch (e) { gate('E-A2-20-history-handoff-payload-coherent', false, String(e)); }

fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/e-a1-a2-gameplay.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), ...report, pass: report.failures.length === 0 }, null, 2));
const total = Object.keys(report.gates).length;
console.log(`\n[MIRROR E A1/A2 GAMEPLAY] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
