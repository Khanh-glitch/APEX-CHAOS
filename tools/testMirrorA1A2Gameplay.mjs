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
  win.exitArsenalQuestMode();
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

fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/e-a1-a2-gameplay.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), ...report, pass: report.failures.length === 0 }, null, 2));
const total = Object.keys(report.gates).length;
console.log(`\n[MIRROR E A1/A2 GAMEPLAY] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
