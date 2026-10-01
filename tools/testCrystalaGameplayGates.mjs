// CRYSTALA V1+V2 — deterministic gameplay gates (docs/hero-rework/crystala-v1/03_IMPLEMENTATION_TEST_MATRIX.md
// §1-§4 + R07, retargeted to the V2 minimal-delta acceptance gates in
// docs/hero-rework/crystala-v1/02_CRYSTALA_V2_SIX_SHARD_RESOURCE_AUTHORITY.md §5).
// Boots the REAL engine/runtimes headlessly (tools/lib/crystalaHarness.mjs) and drives
// real casts, real bullets through the real fireBullet path and the real shared step.
//
//   node tools/testCrystalaGameplayGates.mjs            # all gates
//   CRY_GATES=C0,G node tools/testCrystalaGameplayGates.mjs   # name-prefix filter while iterating
import crypto from 'node:crypto';
import fs from 'node:fs';
import { bootHarness } from './lib/crystalaHarness.mjs';

const only = (process.env.CRY_GATES || '').split(',').filter(Boolean);
const H = await bootHarness();
const { win, T, HR, CRY, AIL, W, CFG } = H;
const results = [];
async function gate(name, fn) {
  if (only.length && !only.some((o) => name.startsWith(o))) return;
  let ok = false, detail;
  try {
    const r = await fn();
    ok = r === true || !!(r && r.ok === true);
    detail = r && typeof r === 'object' ? r.detail : undefined;
  } catch (e) { ok = false; detail = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}

/* ------------------------------------------------------------------ helpers */
const DT = 1 / 60;
const clock = () => AIL.clock();
const PRESET = {
  PISTOL: { damage: 4.5, speed: 2600, radius: 7, life: 1.0, weapon: 'PISTOL' },
  SNIPER: { damage: 26, speed: 5800, radius: 8, life: 1.0, weapon: 'SNIPER' },
  SMG: { damage: 2.4, speed: 3100, radius: 6, life: 0.9, weapon: 'SMG' },
  SHOTGUN: { damage: 3.6, speed: 2500, radius: 6, life: 0.17, weapon: 'SHOTGUN' },
  SLOW: { damage: 4.5, speed: 1500, radius: 7, life: 1.6, weapon: 'PISTOL' },     // test-speed bullet: every orbit phase can reach it
};
function fresh(o = {}) {
  HR.setSeed(o.seed != null ? o.seed : 42);
  HR.setAiEnabled(false);
  const m = T.start(o.p1 || 'CRYSTAL', o.p2 || 'ROBOT');
  T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;                       // pin BEFORE stepping (random initial headings)
  a.x = o.ax != null ? o.ax : 150; a.y = o.ay != null ? o.ay : 500;
  b.x = o.bx != null ? o.bx : 850; b.y = o.by != null ? o.by : 500;
  a.setDir(1, 0); b.setDir(-1, 0);
  T.step(o.settle != null ? o.settle : 0.3);
  const ev = [];
  AIL.bus.on('*', (e) => ev.push(e));
  return { m, a, b, cta: m.combatants[0], ctb: m.combatants[1], ev };
}
const step = (s, dt) => T.step(s, dt || DT);
function stepUntil(cond, max, dt) {
  const d = dt || DT; let t = 0;
  while (t < max - 1e-9) { if (cond()) return t; step(d, d); t += d; }
  return cond() ? t : null;
}
function fire(owner, x, y, tx, ty, kind, o = {}) {
  const pr = Object.assign({}, PRESET[kind || 'PISTOL'], o);
  const angle = Math.atan2(ty - y, tx - x);
  W.fireBullet({ owner, x, y, angle, speed: pr.speed, damage: pr.damage, weapon: pr.weapon, radius: pr.radius, life: pr.life, critical: !!pr.critical });
  return win.projectiles[win.projectiles.length - 1];
}
const press = (f, slot) => HR.pressAbility(f, slot);
const ins = (ct) => CRY.inspect(ct);
const evOf = (ev, type) => ev.filter((e) => e.type === type);
const rigOf = (ct) => CRY.rigOf(ct);
const telem = (ct) => ct.telemetry.crystal;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const fmt = (n) => (typeof n === 'number' ? +n.toFixed(3) : n);
const hpOf = (f) => f.hp;

/* =========================================================================
 * §1 MECHANICS — C01..C20
 * ========================================================================= */
await gate('C01-dormant-no-body-auto-reflect', () => {
  const { a, b, cta } = fresh();
  const p = fire(b, 850, 500, a.x, a.y, 'PISTOL');
  const hp0 = hpOf(a);
  step(0.6);
  const reflected = !!(p.__hr && p.__hr.crystalReflected);
  return { ok: !reflected && hpOf(a) < hp0 && ins(cta).available === 6 && telem(cta).reservations === 0,
    detail: { reflected, hpLoss: fmt(hp0 - hpOf(a)), available: ins(cta).available } };
});

await gate('C02-K-valid-press-2.4s-awakening-12s-cooldown', () => {
  const { a, cta } = fresh();
  const t0 = clock();
  const r = press(a, 'A2');
  const cd = HR.abilityController(cta).cooldownLeft('A2');
  step(2.3);
  const activeAt23 = ins(cta).k.active;
  step(0.2);
  const activeAt25 = ins(cta).k.active;
  // V2 §2.4: K cooldown exactly 12.0 s; active duration remains 2.4 s.
  return { ok: r.ok && near(cd, 12.0, 1e-6) && activeAt23 && !activeAt25 && telem(cta).kCasts === 1,
    detail: { r: r.ok, cd, activeAt23, activeAt25, dur: fmt(ins(cta).k.until - t0) } };
});

await gate('C03-K-cooldown-press-fails-no-duplicate-cast', () => {
  const { a, cta } = fresh();
  press(a, 'A2'); step(0.5);
  const r = press(a, 'A2');
  return { ok: !r.ok && r.reason === 'cooldown' && telem(cta).kCasts === 1,
    detail: { reason: r.reason, kCasts: telem(cta).kCasts } };
});

await gate('C04-K-expiry-stops-new-assignments', () => {
  const { a, b, cta } = fresh({ ax: 120, ay: 500, bx: 900, by: 500 });
  press(a, 'A2');
  step(2.30 - 0.0);                               // K ends at 2.40
  // V2 acquisition claims on 450 px read-radius entry (~+0.13 s for this
  // bullet) => after expiry, so nothing may be assigned.
  const p = fire(b, 900, 500, a.x, a.y, 'PISTOL');
  step(0.7);
  return { ok: telem(cta).reservations === 0 && !ins(cta).k.active,
    detail: { reservations: telem(cta).reservations, seen: telem(cta).threatsSeen, pAlive: win.projectiles.includes(p) } };
});

await gate('C05-committed-job-completes-after-K-expiry', () => {
  const { a, b, cta, ev } = fresh({ ax: 120, ay: 500, bx: 975, by: 500 });
  press(a, 'A2');
  step(1.9333);
  // 1000 px/s test bullet: read-radius entry claim happens at ~2.667 (the
  // acquisition loop sees the previous frame's positions — one frame of lag),
  // still inside K; the real swept contact lands at ~2.74 — AFTER K ends at
  // 2.70. The committed job must complete on its own physics regardless.
  const p = fire(b, 975, 500, a.x, a.y, 'SLOW', { speed: 1000 });
  const kEnd = ins(cta).k.until;
  step(2.0);
  const ic = evOf(ev, 'CrystalIntercept')[0];
  return { ok: !!ic && ic.payload.contactAt > kEnd && telem(cta).intercepts === 1 && telem(cta).reservations === 1 && !!(p.__hr && p.__hr.cryTid),
    detail: { kEnd: fmt(kEnd), contactAt: ic && fmt(ic.payload.contactAt), reservations: telem(cta).reservations } };
});

await gate('C06-six-immortal-shard-records', () => {
  const { cta } = fresh();
  const s = ins(cta).shards;
  const noHp = s.every((x) => x.hp === undefined && x.maxHp === undefined && x.dead === undefined);
  return { ok: s.length === 6 && new Set(s.map((x) => x.id)).size === 6 && noHp, detail: { n: s.length } };
});

await gate('C07-only-ORBIT-is-AVAILABLE', () => {
  const { a, b, cta } = fresh();
  press(a, 'A2');
  fire(b, 850, 500, a.x, a.y, 'SLOW');
  stepUntil(() => ins(cta).jobs.length > 0, 1.0);
  const i = ins(cta);
  const nonOrbit = i.shards.filter((s) => s.state !== 'ORBIT').length;
  return { ok: nonOrbit === 1 && i.available === 5 && i.shards.filter((s) => s.available).every((s) => s.state === 'ORBIT'),
    detail: { states: i.shards.map((s) => s.state).join(','), available: i.available } };
});

await gate('C08-RESERVED-shard-unavailable-to-J-immediately', () => {
  const { a, b, cta, ev } = fresh();
  press(a, 'A2');
  fire(b, 850, 500, a.x, a.y, 'SLOW');
  // step one tick at a time until the reservation event, then press J at once
  let reserved = false;
  for (let k = 0; k < 120 && !reserved; k++) { step(DT); reserved = evOf(ev, 'CrystalReserve').length > 0; }
  const i0 = ins(cta);
  const unavailableAtReserve = i0.shards.filter((s) => !s.available).length;
  const stateAtReserve = i0.shards.find((s) => !s.available)?.state;
  const availNow = i0.available;
  const busyId = i0.shards.find((s) => !s.available)?.id;
  // V2 §1.1: the Wall fallback needs BLADE L/R [0,1] BOTH ORBIT. If the
  // intercept reserved a blade the wall must fail with no cooldown; otherwise
  // it succeeds on exactly [0,1]. The LAW is asserted in whichever branch the
  // deterministic reservation takes.
  const r = press(a, 'A1');
  const c = ins(cta).constructs[0];
  const bladeBusy = busyId === 0 || busyId === 1;
  const cd = HR.abilityController(cta).cooldownLeft('A1');
  const ok = reserved && unavailableAtReserve === 1 && availNow === 5 && stateAtReserve !== 'ORBIT'
    && (bladeBusy
      ? (!r.ok && cd === 0 && !c)
      : (r.ok && !!c && c.kind === 'wall' && c.shardIds.join() === '0,1' && near(cd, 8.0, 1e-6)));
  return { ok, detail: { stateAtReserve, busyId, bladeBusy, unavailableAtReserve, availNow, r: r.ok, cd,
    kind: c && c.kind, shardIds: c && c.shardIds } };
});

await gate('C09-RETURN-shard-unavailable-until-exact-dock-frame', () => {
  const { a, b, cta, ev } = fresh();
  press(a, 'A2');
  fire(b, 850, 500, a.x, a.y, 'SLOW');
  let docked = null, log = [];
  for (let k = 0; k < 240 && docked == null; k++) {
    step(DT);
    const d = evOf(ev, 'CrystalDock');
    if (d.length) { docked = d[0]; break; }
    if (evOf(ev, 'CrystalReserve').length) log.push(ins(cta).available);   // after the reservation
  }
  // until the dock event the intercepting shard never counted as available
  const neverEarly = log.every((n) => n <= 5);
  const stateAtDock = ins(cta).shards[docked ? docked.payload.shard : 0].state;
  return { ok: !!docked && neverEarly && stateAtDock === 'ORBIT' && ins(cta).available === 6,
    detail: { neverEarly, stateAtDock, dockAt: docked && fmt(docked.payload.at) } };
});

await gate('C10-docked-shard-can-be-selected-again-in-same-K', async () => {
  // Freeze the owner fantasy directly: fill all six independent guardian slots,
  // then ONLY the first shard that docks may serve the next threat.
  const { a, b, cta } = fresh({ ax: 150, ay: 500, bx: 430, by: 500 });
  press(a, 'A2');
  for (let k = 0; k < 6; k++) {
    fire(b, 430, 500 + (k - 2.5) * 5, a.x, a.y, 'SMG', { damage: 2.4 + k * 0.001 });
  }
  const filled = stepUntil(() => ins(cta).available === 0 && telem(cta).reservations === 6, 0.25);
  const allHit = stepUntil(() => telem(cta).intercepts === 6, 0.35);
  const busyAfterSix = ins(cta).available === 0;
  const reopened = stepUntil(() => ins(cta).available >= 1, 2.0);
  const activeWhenReopened = ins(cta).k.active;
  const hit0 = telem(cta).intercepts;
  fire(b, 430, 500, a.x, a.y, 'SMG', { damage: 2.9 });
  step(0.25);
  const t = telem(cta);
  return { ok: filled != null && allHit != null && busyAfterSix && reopened != null && activeWhenReopened
      && t.repeatIntercepts >= 1 && t.intercepts >= 7,
    detail: { filled: fmt(filled), allHit: fmt(allHit), busyAfterSix, reopened: fmt(reopened),
      activeWhenReopened, intercepts: t.intercepts, repeat: t.repeatIntercepts, hit0 } };
});

await gate('C11-J-outside-K-builds-wall-8s-cooldown', () => {
  // V2 §1.1 gate 2/4/5/6: K off + BLADE 0/1 ORBIT + J ready -> Wall succeeds
  // on exactly shardIds [0,1], HP 80, consuming the 8.0 s J cooldown.
  const { a, cta } = fresh();
  const r = press(a, 'A1');
  const cd = HR.abilityController(cta).cooldownLeft('A1');
  const c = ins(cta).constructs[0];
  return { ok: r.ok && near(cd, 8.0, 1e-6) && telem(cta).jCasts === 1 && !!c && c.kind === 'wall'
      && c.shardIds.join() === '0,1' && c.maxHp === 80 && ins(cta).available === 4,
    detail: { r: r.ok, cd, kind: c && c.kind, shardIds: c && c.shardIds, maxHp: c && c.maxHp, available: ins(cta).available } };
});

await gate('C12-failed-J-no-latent-replay', () => {
  const { a, cta } = fresh();
  press(a, 'A1');                                  // Wall #1 (K off) consumes BLADE L/R
  cta.skills.A1.cdLeft = 0;                        // isolate the availability law from the 8 s cooldown
  const r2 = press(a, 'A1');                       // blades anchored -> fails 'condition', no cooldown
  const ctaCd = HR.abilityController(cta).cooldownLeft('A1');
  const failOk = !r2.ok && r2.reason === 'condition' && r2.failCue === true && ctaCd === 0;
  // let the wall expire + blades dock: the failed press must never replay as a
  // latent cast and the forced-ready cooldown must survive unconsumed.
  stepUntil(() => ins(cta).available === 6, 8.0);
  step(0.5);
  return { ok: failOk && ins(cta).constructs.filter((c) => c.kind === 'wall').length === 1
      && telem(cta).jCasts === 1,
    detail: { failOk, reason: r2.reason, cdAfterFail: fmt(ctaCd), walls: ins(cta).constructs.filter((c) => c.kind === 'wall').length,
      jCasts: telem(cta).jCasts, available: ins(cta).available } };
});

await gate('C13-J-success-consumes-8s-cooldown', () => {
  const { a, cta } = fresh();
  press(a, 'A2'); step(0.1);
  const r = press(a, 'A1');
  const cd = HR.abilityController(cta).cooldownLeft('A1');
  return { ok: r.ok && near(cd, 8.0, 1e-6) && telem(cta).jCasts === 1, detail: { cd } };
});

await gate('C13a-late-J-after-Hexa-window-falls-back-to-wall-while-K-active', () => {
  // V2 §1.1 routing clause 6: after the live HEXA decision window closes the
  // HEXA path is not eligible, and J may attempt WALL while K is still on.
  const { a, cta } = fresh();
  press(a, 'A2'); step(1.21);
  const before = ins(cta);
  const r = press(a, 'A1');
  const cd = HR.abilityController(cta).cooldownLeft('A1');
  const c = ins(cta).constructs[0];
  return { ok: before.available === 6 && before.k.active && before.k.constructDecisionOpen === false
      && r.ok && near(cd, 8.0, 1e-6) && !!c && c.kind === 'wall' && c.shardIds.join() === '0,1'
      && telem(cta).jCasts === 1,
    detail: { available: before.available, active: before.k.active, decisionOpen: before.k.constructDecisionOpen,
      r: r.ok, cd, kind: c && c.kind, shardIds: c && c.shardIds } };
});

await gate('C13b-only-one-successful-J-per-Awakening-even-if-cooldown-is-forced-ready', () => {
  // The HEXA commitment law (00 §10) is live-current: one successful J per
  // Awakening. Prove it against a forced-ready cooldown so the 8.0 s ordinary
  // A1 cooldown cannot mask it.
  const { a, cta } = fresh();
  press(a, 'A2');
  step(0.1);
  const before = ins(cta);
  const first = press(a, 'A1');                    // HEXA -> Prison (6 ORBIT)
  cta.skills.A1.cdLeft = 0;                        // QA-only forced-ready
  const avail = ins(cta).available;
  const second = press(a, 'A1');                   // blades anchored to the prison -> fail
  return { ok: before.available === 6 && first.ok && ins(cta).constructs[0]?.kind === 'prison'
      && avail === 0 && ins(cta).k.constructDecisionOpen === false
      && !second.ok && second.reason === 'condition' && telem(cta).jCasts === 1
      && ins(cta).constructs.length === 1,
    detail: { beforeAvail: before.available, first: first.ok, second, avail,
      kind: ins(cta).constructs[0]?.kind, jCasts: telem(cta).jCasts, constructs: ins(cta).constructs.length } };
});

await gate('C14-J-with-6-ORBIT-builds-PRISON', () => {
  const { a, cta } = fresh();
  press(a, 'A2'); step(0.1);
  const r = press(a, 'A1');
  const c = ins(cta).constructs[0];
  return { ok: r.ok && c && c.kind === 'prison' && c.shardIds.length === 6 && telem(cta).prisonCasts === 1 && ins(cta).available === 0,
    detail: { kind: c && c.kind, shards: c && c.shardIds.length } };
});

await gate('C15-wall-always-uses-BLADE-LR-shardIds-0-1', () => {
  // V2 §1.1 gates 3/4: Wall shardIds are exactly [0,1]; the wall succeeds iff
  // BOTH blades are ORBIT, regardless of how many other shards are busy.
  const out = {};
  for (const busy of [0, 1, 2, 3]) {
    const { a, b, cta } = fresh({ ax: 130, ay: 500, bx: 990, by: 500 });
    press(a, 'A2');
    for (let k = 0; k < busy; k++) { fire(b, 990, 500, a.x, a.y, 'SLOW', { damage: 4.5 + k * 0.01 }); step(0.02); }
    if (busy) stepUntil(() => ins(cta).jobs.length >= busy, 1.2);
    else step(1.25);   // busy=0: close the HEXA decision window so this exercises the WALL path
    const s = ins(cta).shards;
    const bladesOrbit = s[0].state === 'ORBIT' && s[1].state === 'ORBIT';
    const r = press(a, 'A1');
    const c = ins(cta).constructs[0];
    out[busy] = { bladesOrbit, avail: ins(cta).available, ok: r.ok, kind: c && c.kind,
      ids: c && c.shardIds.join(), cd: HR.abilityController(cta).cooldownLeft('A1') };
  }
  const ok = Object.values(out).every((x) => x.bladesOrbit
    ? (x.ok && x.kind === 'wall' && x.ids === '0,1' && near(x.cd, 8.0, 1e-6))
    : (!x.ok && x.cd === 0 && !x.kind));
  return { ok, detail: out };
});

await gate('C16-J-fails-no-cooldown-when-blades-not-ORBIT', () => {
  const out = {};
  {   // 0 available: a Prison consumed all six (blades anchored) -> J fails, no cooldown
    const { a, cta } = fresh();
    press(a, 'A2'); step(0.1); press(a, 'A1');
    cta.skills.A1.cdLeft = 0;                    // QA-only forced-ready: isolate the availability law
    const r = press(a, 'A1');
    out.zero = { ok: r.ok, reason: r.reason, failCue: r.failCue, cd: HR.abilityController(cta).cooldownLeft('A1'),
      avail: ins(cta).available };
  }
  {   // 1 available: five shards busy with real intercepts -> blades cannot both be ORBIT
    const { a, b, cta } = fresh({ ax: 130, ay: 500, bx: 990, by: 500 });
    press(a, 'A2');
    for (let k = 0; k < 5; k++) { fire(b, 990, 500, a.x, a.y, 'SLOW', { damage: 4.5 + k * 0.01 }); step(0.02); }
    stepUntil(() => ins(cta).jobs.length >= 5, 1.2);
    const avail = ins(cta).available;
    const r = press(a, 'A1');
    out.one = { ok: r.ok, reason: r.reason, failCue: r.failCue, avail,
      cd: HR.abilityController(cta).cooldownLeft('A1') };
  }
  const ok = !out.zero.ok && out.zero.reason === 'condition' && out.zero.failCue && out.zero.cd === 0 && out.zero.avail === 0
    && !out.one.ok && out.one.reason === 'condition' && out.one.failCue && out.one.cd === 0 && out.one.avail === 1;
  return { ok, detail: out };
});

await gate('C17-same-frame-J-snapshot-resolves-before-threat-reservation', () => {
  // World A: find the tick n at which this deterministic threat would be reserved.
  const probe = () => {
    const w = fresh({ ax: 130, ay: 500, bx: 990, by: 500 });
    press(w.a, 'A2');
    fire(w.b, 990, 500, w.a.x, w.a.y, 'SLOW');
    return w;
  };
  let w = probe(), n = 0;
  while (telem(w.cta).reservations === 0 && n < 240) { step(DT); n++; }
  // World B: identical, but press J at the input edge immediately before tick n
  w = probe();
  for (let k = 0; k < n - 1; k++) step(DT);
  const availBefore = ins(w.cta).available;
  const r = press(w.a, 'A1');
  step(DT);
  const reservationsAfterTick = telem(w.cta).reservations;      // the tick that WOULD have reserved finds no ORBIT shard
  step(0.6);                                                    // the unserved bullet reaches its deadline -> overflow
  const c = ins(w.cta).constructs[0];
  return { ok: n > 2 && availBefore === 6 && r.ok && c && c.kind === 'prison' && reservationsAfterTick === 0 && telem(w.cta).reservations === 0 && telem(w.cta).overflowThreats === 1,
    detail: { tick: n, availBefore, kind: c && c.kind, reservations: telem(w.cta).reservations, overflow: telem(w.cta).overflowThreats } };
});

/* ---- construct scenarios ------------------------------------------------- */
// Wall: V2 §1.1 — WALL is castable with K OFF. Blades [0,1] ORBIT + J ready is
// the whole gate, so this helper is fully deterministic (no shard busywork).
function wallFresh(o = {}) {
  const w = fresh(Object.assign({ ax: 150, ay: 500, bx: 850, by: 500 }, o));
  w.r = press(w.a, 'A1');
  w.cons = () => ins(w.cta).constructs.find((c) => c.kind === 'wall');
  return w;
}
// Wall via the K-on fallback (HEXA decision window already closed).
function wallFreshK(o = {}) {
  const w = fresh(Object.assign({ ax: 150, ay: 500, bx: 850, by: 500 }, o));
  press(w.a, 'A2');
  step(1.25);
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
const lockedAt = (w) => { const c = w.cons(); return c && c.lockedAt; };
const waitLock = (w) => stepUntil(() => lockedAt(w) != null, 3.0);

await gate('C18-wall-HP80-width220-solid-4s-from-material-lock', () => {
  const w = wallFresh();
  const castAt = clock();
  waitLock(w);
  const c = w.cons();
  const rc = rigOf(w.cta).constructs.find((x) => x.kind === 'wall');
  const span = rc.geom.span;
  const lockDelay = c.lockedAt - castAt;
  const life = c.endAt - c.lockedAt;
  // run until removal
  const t = stepUntil(() => w.cons().state === 'ENDED', 6.0);
  const c2 = w.cons();
  const endedAt = c2.state === 'ENDED' ? clock() : null;
  // V2 §1.2: HP exactly 80; width 220 / 4.0 s solid life / Gold build timing unchanged.
  return { ok: w.r.ok && c.maxHp === 80 && near(span, 220, 1e-6) && near(life, 4.0, 1e-9) && lockDelay > 0.6 && lockDelay < 0.9 && c2.reason === 'expire' && endedAt != null && endedAt - c.endAt < 2 * DT + 1e-6 && endedAt - c.endAt >= -1e-6,
    detail: { maxHp: c.maxHp, span: fmt(span), lockDelay: fmt(lockDelay), life, reason: c2.reason, lateBy: endedAt && fmt(endedAt - c.endAt) } };
});

await gate('C19-prison-R135-six-independent-facets-HP75-solid-3s-from-closure', () => {
  const w = prisonFresh();
  waitLock(w);
  const c = w.cons();
  const rc = rigOf(w.cta).constructs.find((x) => x.kind === 'prison');
  const P = rc.prison;
  const radii = P.verts.map((v) => Math.hypot(v.x - P.cx, v.y - P.cy));
  const life = c.endAt - c.lockedAt;
  // independence: hit facet 2 from the inside with a real bullet; only facet 2 loses HP
  const mid = (i) => ({ x: (P.edges[i].a.x + P.edges[i].b.x) / 2, y: (P.edges[i].a.y + P.edges[i].b.y) / 2 });
  const m2 = mid(2);
  fire(w.b, P.cx, P.cy, m2.x, m2.y, 'SLOW');
  step(0.3);
  const hp = w.cons().hp;
  const others = hp.filter((_, i) => i !== 2).every((v) => v === 75);
  return { ok: radii.every((r) => near(r, 135, 1e-6)) && c.maxHp.every((v) => v === 75) && c.maxHp.length === 6 && near(life, 3.0, 1e-9) && hp[2] < 75 && others,
    detail: { radii: radii.map(fmt), hp, life } };
});

await gate('C20-shards-never-lose-HP-die-or-reconstruct', () => {
  const w = prisonFresh();
  waitLock(w);
  // break facet 0 with real hits, let the prison end, let everything dock
  const P = rigOf(w.cta).constructs.find((x) => x.kind === 'prison').prison;
  const mid = { x: (P.edges[0].a.x + P.edges[0].b.x) / 2, y: (P.edges[0].a.y + P.edges[0].b.y) / 2 };
  for (let k = 0; k < 4; k++) { fire(w.b, P.cx, P.cy, mid.x, mid.y, 'SNIPER'); step(0.25); }
  stepUntil(() => ins(w.cta).constructs.every((c) => c.state === 'ENDED'), 6.0);
  stepUntil(() => ins(w.cta).available === 6, 4.0);
  const i = ins(w.cta);
  const noHp = i.shards.every((s) => s.hp === undefined);
  return { ok: i.shards.length === 6 && i.available === 6 && noHp && win.projectiles.every((p) => !p || p.type !== 'crystal_shard'),
    detail: { available: i.available, states: i.shards.map((s) => s.state).join(',') } };
});

/* ---- finish (part 1 of the suite; later parts append above this) ---------- */
/* =========================================================================
 * §2 THREAT PREDICTOR — C21..C36
 * ========================================================================= */
const crystalK = (o) => { const w = fresh(o); press(w.a, 'A2'); return w; };

await gate('C21-near-miss-entering-450-claims-a-shard-even-though-it-would-miss', () => {
  // V2 §2.1 gate 14: the old body-hit predictor classified this as a miss; the
  // simple radius rule intentionally spends shard capacity on it.
  const w = crystalK();
  const hp0 = hpOf(w.a);
  fire(w.b, 850, 500, 150, 800, 'SLOW');                 // closest approach ~276 px: never hits the body
  step(1.5);
  const claimed = telem(w.cta).reservations === 1 && telem(w.cta).ignoredMiss === 0;
  const ic = evOf(w.ev, 'CrystalIntercept')[0];
  const cD = ic ? Math.hypot(ic.payload.x - w.a.x, ic.payload.y - w.a.y) : null;
  // and a projectile that never enters the 450 px read radius claims nothing (gate 11)
  const v = crystalK();
  fire(v.b, 850, 500, 150, 1200, 'SLOW');                // closest approach ~495 px: outside the read radius
  step(1.5);
  const outside = telem(v.cta).reservations === 0 && telem(v.cta).threatsSeen === 0;
  return { ok: claimed && !!ic && near(cD, 300, 60) && hpOf(w.a) === hp0 && outside,
    detail: { claimed, interceptDist: cD && fmt(cD), outside450: outside,
      res: telem(w.cta).reservations, outsideRes: telem(v.cta).reservations } };
});

await gate('C22-short-lived-projectile-also-claims-no-lifetime-prediction', () => {
  // V2 §2.1: lifetime prediction is not a kept exclusion. A bullet that will
  // expire inside the ring still claims a free shard (intended capacity waste);
  // the job then aborts honestly when the threat disappears.
  const w = crystalK();
  fire(w.b, 570, 500, w.a.x, w.a.y, 'SLOW', { life: 0.05 });   // spawned 420 px away, dies at ~345 px
  step(0.35);
  const reserved = telem(w.cta).reservations === 1 && telem(w.cta).ignoredExpired === 0;
  const ab = evOf(w.ev, 'CrystalAbort')[0];
  stepUntil(() => ins(w.cta).available === 6, 2.5);
  return { ok: reserved && !!ab && ab.payload.reason === 'threat-gone' && ins(w.cta).available === 6,
    detail: { reserved, abort: ab && ab.payload.reason, available: ins(w.cta).available } };
});

await gate('C23-blocked-first-projectile-also-claims-no-blocker-prediction', () => {
  // V2 §2.1: the blocker-first prerequisite is REMOVED. A projectile that will
  // hit a solid Wall first still claims a free shard (capacity waste is
  // intended); the Wall reflects it and the shard job aborts 'blocked'.
  const w = wallFresh();
  waitLock(w);
  press(w.a, 'A2');                                   // K on so the acquisition runs
  fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW');           // crosses the wall line x~480 first
  step(0.6);
  const ab = evOf(w.ev, 'CrystalAbort')[0];
  return { ok: ins(w.cta).k.active && telem(w.cta).reservations === 1 && telem(w.cta).ignoredBlocked === 0
      && telem(w.cta).constructReflects === 1 && !!ab && ab.payload.reason === 'blocked',
    detail: { res: telem(w.cta).reservations, blocked: telem(w.cta).ignoredBlocked,
      reflects: telem(w.cta).constructReflects, abort: ab && ab.payload.reason } };
});

await gate('C24-non-hostile-projectile-does-not-reserve', () => {
  const w = crystalK();
  const p = fire(w.a, 850, 500, w.a.x, w.a.y, 'SLOW');   // Crystal-owned, aimed at Crystal
  const hp0 = hpOf(w.a);
  step(1.0);
  return { ok: telem(w.cta).reservations === 0 && telem(w.cta).threatsSeen === 0 && hpOf(w.a) === hp0 && p.owner === w.a,
    detail: { seen: telem(w.cta).threatsSeen } };
});

await gate('C25-already-Crystal-reflected-does-not-reserve', () => {
  const w = crystalK();
  const p = fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW');
  p.__hr = Object.assign(p.__hr || {}, { crystalReflected: true });
  const hp0 = hpOf(w.a);
  step(1.0);
  return { ok: telem(w.cta).reservations === 0 && telem(w.cta).threatsSeen === 0 && hpOf(w.a) < hp0, detail: { hpLoss: fmt(hp0 - hpOf(w.a)) } };
});

await gate('C26-T6-Stormbreaker-never-reserves-never-reflects', () => {
  const w = crystalK();
  const p = fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW', { weapon: 'STORMBREAKER', damage: 446 });
  const hp0 = hpOf(w.a);
  step(1.0);
  return { ok: telem(w.cta).reservations === 0 && telem(w.cta).threatsSeen === 0 && !(p.__hr && p.__hr.crystalReflected) && hp0 - hpOf(w.a) > 400,
    detail: { hpLoss: fmt(hp0 - hpOf(w.a)) } };
});

await gate('C27-melee-contact-blast-beam-field-DoT-never-wake-K', () => {
  const w = crystalK();
  // thrown melee (real spawn), grenade (real throw) aimed at the Crystal
  W.spawnThrownMelee(w.b, 'SABRE', Math.PI);
  W.throwGrenade({ owner: w.b, x: 850, y: 500, angle: Math.PI, speed: 540, weapon: 'GRENADE' });
  step(1.0);
  // contact/beam/field/DoT are not projectiles at all: nothing for the K predictor to see
  return { ok: telem(w.cta).reservations === 0 && telem(w.cta).threatsSeen === 0 && ins(w.cta).available === 6,
    detail: { seen: telem(w.cta).threatsSeen, res: telem(w.cta).reservations } };
});

await gate('C28-read-radius-450-claims-on-entry-not-at-spawn', () => {
  const w = crystalK({ ax: 100, ay: 500, bx: 990, by: 500 });
  const t0 = clock();
  fire(w.b, 990, 500, w.a.x, w.a.y, 'SLOW');            // ~890 px away at spawn: OUTSIDE 450
  step(DT, DT); step(DT, DT);
  const early = { seen: telem(w.cta).threatsSeen, res: telem(w.cta).reservations };
  stepUntil(() => telem(w.cta).reservations > 0, 1.0);
  const rv = evOf(w.ev, 'CrystalReserve')[0];
  // V2 §2.2 gate 11: nothing exists for K before the 450 px entry; the claim
  // happens exactly at entry (~0.29 s), with the 300 px ring as contact target.
  return { ok: early.seen === 0 && early.res === 0 && !!rv && rv.payload.band === 300
      && (rv.t - t0) > 0.25 && (rv.t - t0) < 0.35 && near(rv.payload.tBand, 0.10, 0.03),
    detail: { early, tBandAtReserve: rv && fmt(rv.payload.tBand), after: rv && fmt(rv.t - t0) } };
});

await gate('C29-intercept-target-is-the-real-300px-ring', () => {
  const w = crystalK();
  fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW');
  stepUntil(() => telem(w.cta).intercepts > 0, 2.0);
  const rv = evOf(w.ev, 'CrystalReserve')[0].payload;
  const ic = evOf(w.ev, 'CrystalIntercept')[0].payload;
  const ipD = Math.hypot(rv.ip.x - w.a.x, rv.ip.y - w.a.y);
  const cD = Math.hypot(ic.x - w.a.x, ic.y - w.a.y);
  return { ok: rv.band === 300 && near(ipD, 300, 0.5) && near(cD, 300, 60),
    detail: { ipDist: fmt(ipD), contactDist: fmt(cD), band: rv.band } };
});

await gate('C30-ring-geometry-still-accounts-for-Crystal-current-movement', () => {
  const w = fresh({ ax: 200, ay: 200, bx: 850, by: 700 });
  w.a.baseSpeed = 400; w.a.setDir(0, 1);                     // Crystal walking down at 400 px/s
  press(w.a, 'A2');
  const snap = [];
  AIL.bus.on('CrystalReserve', (e) => snap.push({ ev: e, cx: w.a.x, cy: w.a.y, v: Object.assign({}, w.a.__hrVel) }));
  // lead-aim at where the walking Crystal WILL be (a stationary assumption would see a miss)
  const P0 = { x: 850, y: 700 }, sp = 1500;
  let tx = w.a.x, ty = w.a.y;
  for (let k = 0; k < 6; k++) { const t = Math.hypot(tx - P0.x, ty - P0.y) / sp; tx = w.a.x; ty = w.a.y + 400 * t; }
  const p = fire(w.b, P0.x, P0.y, tx, ty, 'SLOW');
  const c0 = { x: w.a.x, y: w.a.y };
  const hp0 = hpOf(w.a);
  // miss distance of the bullet line against a STATIONARY Crystal
  const vx = p.vx, vy = p.vy, vm = Math.hypot(vx, vy);
  const dd = Math.abs((c0.x - P0.x) * vy / vm - (c0.y - P0.y) * vx / vm);
  step(1.6);
  const s0 = snap[0];
  let ipErr = null;
  if (s0) { const pr = s0.ev.payload; const cx = s0.cx + s0.v.x * pr.tBand, cy = s0.cy + s0.v.y * pr.tBand; ipErr = Math.abs(Math.hypot(pr.ip.x - cx, pr.ip.y - cy) - 300); }
  // V2: even a bullet the old predictor called a miss claims capacity; the 300
  // px contact ring is still computed against the MOVING Crystal centre.
  return { ok: dd > 65.5 && !!s0 && ipErr < 2.0 && telem(w.cta).intercepts === 1 && hpOf(w.a) === hp0,
    detail: { stationaryMiss: fmt(dd), ipErr: ipErr && fmt(ipErr), intercepts: telem(w.cta).intercepts } };
});

await gate('C31-simultaneous-threats-stable-first-seen-order-no-damage-priority', () => {
  // V2 §2.1: time-to-hit and damage priority prediction are GONE. Seven
  // simultaneous eligible projectiles, six shards: the stable first-seen order
  // decides — the LAST spawned is unserved, even when it carries the heaviest shot.
  const round = (dmgFn) => {
    const w = crystalK({ ax: 150, ay: 500, bx: 850, by: 500 });
    const ths = [-0.25, -0.17, -0.08, 0, 0.08, 0.17, 0.25];
    const ps = ths.map((th, i) => fire(w.b, 150 + 850 * Math.cos(th), 500 + 850 * Math.sin(th), w.a.x, w.a.y, 'SLOW',
      { speed: 900, life: 3, damage: dmgFn(i) }));
    step(2.6);
    return ps.map((p) => !!(p.__hr && p.__hr.cryTid));
  };
  const lost = (r) => r.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  const a = round(() => 4.5);
  const b = round((i) => (i === 6 ? 9.0 : 4.5));
  return { ok: lost(a).join() === '6' && lost(b).join() === '6',
    detail: { unservedEqualDamage: lost(a), unservedHeaviestLast: lost(b) } };
});

await gate('C32-each-projectile-gets-at-most-one-shard', () => {
  const w = crystalK({ ax: 150, ay: 500, bx: 990, by: 500 });
  for (let k = 0; k < 4; k++) { fire(w.b, 990, 500 + (k - 1.5) * 40, w.a.x, w.a.y + (k - 1.5) * 20, 'SLOW', { damage: 4.5 + k * 0.01 }); }
  step(2.5);
  const pids = evOf(w.ev, 'CrystalReserve').map((e) => e.payload.pid);
  return { ok: pids.length >= 2 && new Set(pids).size === pids.length, detail: { pids } };
});

await gate('C33-each-shard-handles-at-most-one-current-assignment', () => {
  const w = crystalK({ ax: 150, ay: 500, bx: 990, by: 500 });
  for (let k = 0; k < 4; k++) fire(w.b, 990, 500 + (k - 1.5) * 40, w.a.x, w.a.y + (k - 1.5) * 20, 'SLOW', { damage: 4.5 + k * 0.01 });
  let violations = 0, maxJobs = 0;
  for (let k = 0; k < 150; k++) {
    step(DT);
    const jobs = ins(w.cta).jobs;
    maxJobs = Math.max(maxJobs, jobs.length);
    if (new Set(jobs.map((j) => j.shard)).size !== jobs.length) violations++;
  }
  return { ok: violations === 0 && maxJobs >= 2, detail: { violations, maxJobs } };
});

await gate('C34-spray-and-spread-waste-shard-capacity-by-design', () => {
  // V2 §2.1: every pellet entering 450 claims a free shard — spray/spread
  // waste is the INTENDED consequence of the simple acquisition rule. The
  // shotgun-blast independence law is preserved: one shard per pellet, and the
  // 8-pellet fan saturates exactly six shards with two unserved.
  const w = crystalK({ ax: 150, ay: 500, bx: 850, by: 500 });
  for (let k = 0; k < 8; k++) {
    const ang = Math.PI + (k - 3.5) * 0.06;
    const tx = 850 + Math.cos(ang) * 700, ty = 500 + Math.sin(ang) * 700;
    fire(w.b, 850, 500, tx, ty, 'SLOW', { radius: 6, life: 2 });
  }
  step(2.5);
  const res = telem(w.cta).reservations;
  const pids = evOf(w.ev, 'CrystalReserve').map((e) => e.payload.pid);
  const bands = evOf(w.ev, 'CrystalReserve').map((e) => e.payload.band);
  // (b) real shotgun pellets at close range: all eight enter 450 at once, six
  // claim distinct shards instantly, the rest overflow — no rescue bands exist.
  const v = crystalK({ ax: 150, ay: 500, bx: 560, by: 500 });
  for (let k = 0; k < 8; k++) {
    const ang = Math.PI + (k - 3.5) * 0.05;
    fire(v.b, 560, 500, 560 + Math.cos(ang) * 500, 500 + Math.sin(ang) * 500, 'SHOTGUN');
  }
  step(0.4);
  const vr = evOf(v.ev, 'CrystalReserve');
  const vShards = vr.map((e) => e.payload.shard);
  return { ok: res === 6 && new Set(pids).size === 6 && telem(w.cta).overflowThreats === 2
      && bands.every((b) => b === 300)
      && telem(v.cta).reservations === 6 && telem(v.cta).overflowThreats === 2
      && new Set(vShards).size === 6 && vr.every((e) => e.payload.band === 300),
    detail: { slowFan: { reserved: res, overflow: telem(w.cta).overflowThreats }, bands,
      realShotgunReserved: telem(v.cta).reservations, realShotgunOverflow: telem(v.cta).overflowThreats,
      shotgunBands: vr.map((e) => e.payload.band) } };
});

await gate('C34b-real-sniper-800px-met-on-the-300-ring-assignment-never-consumes', () => {
  const w = crystalK({ ax: 100, ay: 500, bx: 900, by: 500 });
  const p = fire(w.b, 900, 500, 100, 500, 'SNIPER');
  let aliveAtReserve = null;
  AIL.bus.on('CrystalReserve', () => {
    aliveAtReserve = win.projectiles.includes(p) && p.life > 0
      && !(p.__hr && p.__hr.crystalReflected) && (p.damage === 26);
  });
  step(0.55);
  const rs = evOf(w.ev, 'CrystalReserve');
  const hit = evOf(w.ev, 'CrystalIntercept');
  const cD = hit[0] ? Math.hypot(hit[0].payload.x - w.a.x, hit[0].payload.y - w.a.y) : null;
  // V2 §2.2 gates 12/18: the shard may travel faster to the 300 px contact
  // ring, real swept contact is what reflects, and assignment never consumes
  // or re-damages the projectile.
  return { ok: rs.length === 1 && hit.length === 1 && rs[0].payload.band === 300
      && rs[0].payload.urgent === true && aliveAtReserve === true && near(cD, 300, 70)
      && telem(w.cta).ignoredUnreachable === 0,
    detail: { reservations: rs.length, intercepts: hit.length, band: rs[0]?.payload?.band,
      urgent: rs[0]?.payload?.urgent, accelerated: rs[0]?.payload?.accelerated,
      contactDist: cD && fmt(cD), aliveAtReserve, unreachable: telem(w.cta).ignoredUnreachable } };
});

await gate('C34c-six-close-threats-use-six-independent-shards-seventh-waits', () => {
  const w = crystalK({ ax: 150, ay: 500, bx: 430, by: 500 });
  const hp0 = hpOf(w.a);
  for (let k = 0; k < 6; k++) {
    fire(w.b, 430, 500 + (k - 2.5) * 5, w.a.x, w.a.y, 'SMG', { damage: 2.4 + k * 0.001 });
  }
  step(0.22);
  const rs = evOf(w.ev, 'CrystalReserve');
  const ic = evOf(w.ev, 'CrystalIntercept');
  const sixDistinct = rs.length === 6 && new Set(rs.map((e) => e.payload.shard)).size === 6;
  const sixBlocked = ic.length === 6 && hpOf(w.a) === hp0 && ins(w.cta).available === 0;

  // All six are now independently busy. A seventh close threat cannot borrow a
  // globally reset K slot; it must wait for one actual shard to dock.
  const hp6 = hpOf(w.a);
  fire(w.b, 430, 500, w.a.x, w.a.y, 'SMG', { damage: 2.7 });
  step(0.16);
  const seventhPassed = hpOf(w.a) < hp6 && telem(w.cta).overflowThreats >= 1;

  const docked = stepUntil(() => ins(w.cta).available >= 1, 2.0);
  const activeAfterDock = ins(w.cta).k.active;
  const before8 = telem(w.cta).intercepts;
  if (activeAfterDock) {
    fire(w.b, 430, 500, w.a.x, w.a.y, 'SMG', { damage: 2.8 });
    step(0.22);
  }
  const reusedAfterOwnDock = activeAfterDock && telem(w.cta).intercepts > before8;
  return { ok: sixDistinct && sixBlocked && seventhPassed && docked != null && reusedAfterOwnDock,
    detail: { reservations: rs.length, intercepts: ic.length, sixDistinct, sixBlocked, seventhPassed,
      overflow: telem(w.cta).overflowThreats, docked: fmt(docked), activeAfterDock, reusedAfterOwnDock } };
});

await gate('C35-vanished-outbound-target-aborts-with-curved-return-no-teleport', () => {
  const w = crystalK();
  const p = fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW');
  stepUntil(() => ins(w.cta).shards.some((s) => s.state === 'OUTBOUND'), 1.0);
  const id = ins(w.cta).shards.find((s) => s.state === 'OUTBOUND').id;
  p.life = 0;                                              // the threat disappears
  let maxJump = 0, prev = null, docked = null;
  const stone = rigOf(w.cta).stones[id];
  const t0 = clock();
  for (let k = 0; k < 120 && docked == null; k++) {
    step(DT);
    if (prev) maxJump = Math.max(maxJump, Math.hypot(stone.x - prev.x, stone.y - prev.y));
    prev = { x: stone.x, y: stone.y };
    if (ins(w.cta).shards[id].state === 'ORBIT') docked = clock() - t0;
  }
  const ab = evOf(w.ev, 'CrystalAbort')[0];
  return { ok: !!ab && ab.payload.reason === 'threat-gone' && telem(w.cta).aborts === 1 && telem(w.cta).intercepts === 0 && maxJump < 45 && docked != null && docked < 0.75,
    detail: { reason: ab && ab.payload.reason, maxJump: fmt(maxJump), dockAfter: docked && fmt(docked) } };
});

await gate('C36-shard-travel-is-continuous-no-far-side-teleport', () => {
  const w = crystalK({ ax: 150, ay: 500, bx: 990, by: 500 });
  const rec = [];
  AIL.bus.on('CrystalReserve', (e) => { const st = rigOf(w.cta).stones[e.payload.shard]; rec.push({
    shard: e.payload.shard,
    tBand: e.payload.tBand, travel: Math.hypot(st.x - e.payload.ip.x, st.y - e.payload.ip.y),
    accelerated: !!e.payload.accelerated, band: e.payload.band
  }); });
  for (let k = 0; k < 3; k++) fire(w.b, 990, 500 + (k - 1) * 50, w.a.x, w.a.y + (k - 1) * 25, 'SLOW', { damage: 4.5 + k * 0.01 });
  const maxJump = new Map();
  const prev = new Map();
  for (let k = 0; k < 150; k++) {
    step(DT);
    for (const s of rigOf(w.cta).stones) {
      const q = prev.get(s.uid);
      if (q) maxJump.set(s.uid, Math.max(maxJump.get(s.uid) || 0, Math.hypot(s.x - q.x, s.y - q.y)));
      prev.set(s.uid, { x: s.x, y: s.y });
    }
  }
  // V2 §2.2: the shard may travel faster to the 300 px contact point — but it
  // is ALWAYS the same continuous Gold Hermite motion (never a teleport: no
  // tick may relocate a stone across a major part of ITS OWN travel) and the
  // contact target is always the 300 px ring.
  const fitsOrExplicitlyAccelerated = rec.every((r) => r.band === 300 && (r.accelerated || (r.travel * 1.12 / 1000 + 0.02) <= r.tBand + 0.011));
  const continuous = rec.every((r) => (maxJump.get(r.shard) || 0) < 0.6 * r.travel);
  return { ok: rec.length >= 2 && fitsOrExplicitlyAccelerated && continuous,
    detail: { n: rec.length, fitsOrExplicitlyAccelerated, continuous,
      jumps: rec.map((r) => fmt(maxJump.get(r.shard) || 0)), travel: rec.map((r) => fmt(r.travel)),
      accelerated: rec.map((r) => r.accelerated), bands: rec.map((r) => r.band) } };
});

/* =========================================================================
 * §3 REFLECTION / PROJECTILE TRUTH — C37..C50
 * ========================================================================= */
// Control = a Crystal-owned bullet of the identical spec into the Robot (no K). The reflected leg of the same
// spec must then realise exactly pct x the control damage on the same victim: one multiplier, nothing else.
function reflectRun(o = {}) {
  const w = fresh({ ax: 150, ay: 500, bx: 850, by: 500 });
  const spec = { critical: !!o.critical };
  const hp0 = hpOf(w.b);
  fire(w.a, 150, 500, 850, 500, 'SLOW', spec);
  step(0.8);
  const dControl = hp0 - hpOf(w.b);
  press(w.a, 'A2');
  if (o.armor) HR.abilityController(w.ctb).tryCast('A2', 'test');
  const hpA = hpOf(w.a), hp1 = hpOf(w.b);
  const dealt0 = w.cta.telemetry.damageDealt;
  const rawBefore = PRESET.SLOW.damage;
  const p = fire(w.b, 990, 500, 150, 500, 'SLOW', spec);
  if (o.tags) p.__hr = Object.assign(p.__hr || {}, o.tags);
  if (o.mutate) o.mutate(p);
  // K's exit direction is pure facet geometry (the shard's rotation lags the ray by a few degrees), so it does not
  // always return to the shooter. To measure the DAMAGE law in isolation, stand the victim on the real exit ray.
  const released = stepUntil(() => p.__hr && p.__hr.crystalReflected && !p.__hr.cryHold && (p.vx || p.vy), 3.0);
  if (released != null) {
    const sp = Math.hypot(p.vx, p.vy);
    w.b.x = Math.min(930, Math.max(70, p.x + (p.vx / sp) * 320)); w.b.y = Math.min(930, Math.max(70, p.y + (p.vy / sp) * 320));
  }
  step(1.6);
  return { w, p, dControl, dReflect: hp1 - hpOf(w.b), hpLossCrystal: hpA - hpOf(w.a), rawBefore, dealt: w.cta.telemetry.damageDealt - dealt0 };
}

await gate('C37-shard-contact-cancels-the-incoming-hit', () => {
  const r = reflectRun();
  const ic = evOf(r.w.ev, 'CrystalIntercept');
  return { ok: ic.length === 1 && r.hpLossCrystal === 0 && r.p.owner === r.w.a, detail: { intercepts: ic.length, crystalHpLoss: r.hpLossCrystal } };
});

await gate('C38-reflected-damage-is-current-damage-x0.50-exactly-once', () => {
  const r = reflectRun();
  const hold = r.w.ev.filter((e) => e.type === 'CrystalRelease').length === 1;
  const ratio = r.dReflect / r.dControl;
  return { ok: hold && r.dControl > 0 && near(ratio, 0.5, 1e-9) && near(r.p.damage, r.rawBefore * 0.5, 1e-12),
    detail: { control: fmt(r.dControl), reflected: fmt(r.dReflect), ratio, rawNow: r.p.damage } };
});

await gate('C39-no-second-Arsenal-x7', () => {
  const r = reflectRun();
  const ratio = r.dReflect / r.dControl;
  // x7 applied twice would make the ratio 3.5; one x7 (at the hit) and one pct gives exactly 0.5
  return { ok: near(ratio, 0.5, 1e-9) && r.dReflect < r.dControl, detail: { ratio } };
});

await gate('C40-no-new-firearm-crit-roll', () => {
  const calls = { n: 0 };
  const AQ = win.APEX_ARSENAL, prev = AQ.combatRng;
  AQ.combatRng = () => { calls.n++; return 0; };           // would ALWAYS crit if the reflect path rolled
  let r;
  try { r = reflectRun({ critical: false }); } finally { AQ.combatRng = prev; }
  return { ok: calls.n === 0 && r.p.critical === false && near(r.dReflect / r.dControl, 0.5, 1e-9), detail: { rngCalls: calls.n, critical: r.p.critical } };
});

await gate('C41-valid-crit-and-provenance-survive', () => {
  const r = reflectRun({ critical: true, tags: { chill: true } });
  const ratio = r.dReflect / r.dControl;
  return { ok: r.p.critical === true && r.p.weapon === 'PISTOL' && r.p.__hr.chill === true && r.p.family === 'SEMI' && near(ratio, 0.5, 1e-9) && r.dControl > 0,
    detail: { critical: r.p.critical, weapon: r.p.weapon, chill: r.p.__hr.chill, ratio } };
});

await gate('C42-owner-controller-becomes-Crystal-and-damage-is-credited-to-Crystal', () => {
  const r = reflectRun();
  return { ok: r.p.owner === r.w.a && r.p.__hr.crystalReflected === true && r.dealt > 0 && near(r.dealt, r.dReflect, 1e-9),
    detail: { ownerIsCrystal: r.p.owner === r.w.a, credited: fmt(r.dealt), realised: fmt(r.dReflect) } };
});

await gate('C43-a-projectile-is-Crystal-reflected-at-most-once', () => {
  // K-reflected bullet is turned back at the Crystal and the shards: never reflected again, never reserved again.
  const r = reflectRun({ mutate: () => {} });
  const t = telem(r.w.cta);
  const before = { refl: t.reflectedProjectiles, res: t.reservations };
  const q = r.p;
  q.life = 2; q.px = q.x = 500; q.py = q.y = 500; q.vx = -1500; q.vy = 0;       // same bullet, flung back through the orbit
  step(0.6);
  // and through a construct: still only the one reflection
  press(r.w.a, 'A2');                                                              // (cooldown: fails, K stays as is)
  const after = { refl: t.reflectedProjectiles, res: t.reservations };
  return { ok: before.refl === 1 && after.refl === 1 && after.res === before.res && q.__hr.crystalReflected === true,
    detail: { before, after } };
});

await gate('C44-reflected-and-Crystal-owned-projectiles-ignore-own-constructs', () => {
  const w = wallFresh();
  waitLock(w);
  const hp0 = w.cons().hp;
  // Crystal-owned shot across its own wall into the Robot, and a Robot-owned bullet already Crystal-reflected
  const hpB = hpOf(w.b);
  const own = fire(w.a, 150, 500, 850, 500, 'SLOW');
  const refl = fire(w.b, 850, 500, 150, 500, 'SLOW');
  refl.__hr = Object.assign(refl.__hr || {}, { crystalReflected: true });
  step(1.2);
  const c = w.cons();
  return { ok: c.hp === hp0 && c.state === 'LIVE' && hpOf(w.b) < hpB && telem(w.cta).constructReflects === 0 && own.owner === w.a,
    detail: { wallHp: c.hp, robotLoss: fmt(hpB - hpOf(w.b)), constructReflects: telem(w.cta).constructReflects } };
});

await gate('C45-Robot-A2-mitigation-still-applies-to-the-reflected-projectile', () => {
  const free = reflectRun({});
  const armed = reflectRun({ armor: true });
  const mult = CFG.__robotA2 || 0.45;
  const ratio = armed.dReflect / armed.dControl;
  return { ok: armed.dControl > 0 && armed.dReflect > 0 && near(ratio, 0.5 * 0.45, 1e-9) && near(free.dReflect / free.dControl, 0.5, 1e-9),
    detail: { armedRatio: ratio, expected: 0.5 * 0.45, freeRatio: free.dReflect / free.dControl } };
});

await gate('C46-K-reflection-is-pure-facet-geometry-no-homing-correction', () => {
  // oblique shot from a point that is NOT the enemy: any pull toward the enemy would be visible
  const w = crystalK({ ax: 150, ay: 500, bx: 850, by: 500 });
  fire(w.b, 990, 280, w.a.x, w.a.y, 'SLOW');
  stepUntil(() => telem(w.cta).intercepts > 0, 2.0);
  const ic = evOf(w.ev, 'CrystalIntercept')[0].payload;
  const d = ic.inV.x * ic.n.x + ic.inV.y * ic.n.y;
  const pure = { x: ic.inV.x - 2 * d * ic.n.x, y: ic.inV.y - 2 * d * ic.n.y };
  const dirErr = Math.hypot(ic.exitV.x - pure.x, ic.exitV.y - pure.y);
  const toFoe = Math.atan2(w.b.y - ic.y, w.b.x - ic.x), exitAng = Math.atan2(ic.exitV.y, ic.exitV.x);
  let diff = Math.abs(exitAng - toFoe); if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return { ok: dirErr < 1e-9 && diff > 0.05 && near(Math.hypot(ic.exitV.x, ic.exitV.y), Math.hypot(ic.inV.x, ic.inV.y), 1e-6),
    detail: { dirErr, angleToFoe: fmt(diff), speedKept: true } };
});

await gate('C47-fixed-wall-reflection-obeys-the-surface-plane', () => {
  const w = wallFresh();
  waitLock(w);
  const rc = rigOf(w.cta).constructs.find((x) => x.kind === 'wall');
  const n = { x: rc.geom.nx, y: rc.geom.ny };
  const p = fire(w.b, 850, 400, w.a.x, w.a.y, 'SLOW');         // oblique onto the flat side
  const v0 = { x: p.vx, y: p.vy };
  stepUntil(() => p.__hr && p.__hr.crystalReflected, 1.0);
  const d = v0.x * n.x + v0.y * n.y;
  const expect = { x: v0.x - 2 * d * n.x, y: v0.y - 2 * d * n.y };
  const err = Math.hypot(p.vx - expect.x, p.vy - expect.y);
  return { ok: !!(p.__hr && p.__hr.crystalReflected) && err < 1e-6 && p.owner === w.a, detail: { err, normal: { x: fmt(n.x), y: fmt(n.y) } } };
});

await gate('C48-three-shot-breaking-law-killer-passes-through-unreflected', () => {
  // V2 §1.2: structural damage BELOW remaining Wall HP reflects; the shot that
  // DEALS the remaining HP is the breaking shot: hit applied, Wall destroyed,
  // same projectile NOT reflected and untouched (owner / velocity / crit /
  // provenance / full damage), it simply continues through. SLOW effective
  // damage 31.5 kills an HP 80 Wall on the THIRD shot.
  const w = wallFresh();
  waitLock(w);
  const shots = [];
  for (let k = 0; k < 3; k++) { shots.push(fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW', { damage: 4.5 + k * 0.001 })); step(0.6); }
  const c = w.cons();
  const last = shots[2];
  const hps = evOf(w.ev, 'CrystalConstructHit');
  const refs = evOf(w.ev, 'CrystalConstructReflect');
  const pass = last.__hr && last.__hr.cryPassed;
  return { ok: c.state === 'ENDED' && c.reason === 'destroyed'
      && shots[0].__hr && shots[0].__hr.crystalReflected
      && shots[1].__hr && shots[1].__hr.crystalReflected
      && !(last.__hr && last.__hr.crystalReflected) && !!pass
      && last.owner === w.b && last.vx < 0 && near(last.damage, 4.5 + 0.002, 1e-9)
      && hps.length === 3 && refs.length === 2
      && hps[0].payload.why === 'hit' && hps[1].payload.why === 'hit' && hps[2].payload.why === 'break-through',
    detail: { state: c.state, reason: c.reason,
      reflected: shots.map((p) => !!(p.__hr && p.__hr.crystalReflected)), breakThrough: pass,
      lastVx: fmt(last.vx), lastDamage: last.damage, lastOwner: last.owner === w.b ? 'B' : last.owner === w.a ? 'A' : '?',
      hits: hps.map((e) => `${fmt(e.payload.damage)}:${e.payload.why}`), reflectEvents: refs.length } };
});

await gate('C49-T6-keeps-final-authority-and-is-never-reflected', () => {
  const w = wallFresh();
  waitLock(w);
  const hpB = hpOf(w.b);
  const t6 = fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW', { weapon: 'STORMBREAKER', damage: 446 });
  step(1.0);
  const c = w.cons();
  const a1 = { wallEnded: c.state === 'ENDED' && c.reason === 'destroyed', notReflected: !(t6.__hr && t6.__hr.crystalReflected), crystalLoss: fmt(hpOf(w.a)) };
  // thrown T6 (aq_thrown) through a fresh wall
  const v = wallFresh();
  waitLock(v);
  W.spawnThrownMelee(v.b, 'STORMBREAKER', Math.PI);
  step(1.2);
  const cv = v.cons();
  return { ok: a1.wallEnded && a1.notReflected && cv.state === 'ENDED' && cv.reason === 'destroyed' && !win.projectiles.some((q) => q && q.weapon === 'STORMBREAKER' && q.__hr && q.__hr.crystalReflected),
    detail: { bullet: a1, thrownWall: { state: cv.state, reason: cv.reason } } };
});

await gate('C50-enemy-projectiles-damage-the-real-construct-through-one-transaction', () => {
  const out = {};
  for (const crit of [false, true]) {
    const w = wallFresh();
    waitLock(w);
    const c0 = w.cons().hp;
    const p = fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW', { critical: crit });
    const expect = W.scaledDamage(p.damage, 'PISTOL', crit);      // the ONE damage law (x7, crit x1.5)
    step(0.6);
    const c1 = w.cons().hp;
    out[crit ? 'crit' : 'plain'] = { delta: fmt(c0 - c1), expect: fmt(expect), tele: fmt(telem(w.cta).constructDamage), ok: near(c0 - c1, expect, 1e-9) && near(telem(w.cta).constructDamage, expect, 1e-9) };
  }
  return { ok: out.plain.ok && out.crit.ok && out.crit.delta > out.plain.delta, detail: out };
});

/* =========================================================================
 * §4 MOVEMENT / GEOMETRY — G01..G08
 * ========================================================================= */
const CAPR = 19.5, BODY_R = 75;

await gate('G01-no-invisible-collision-before-visible-grown-material', () => {
  const w = wallFresh();
  const rc = rigOf(w.cta).constructs.find((x) => x.kind === 'wall');
  const early = CRY.capsules().length;                          // just cast: nothing is visible yet
  // a bullet that is a predicted MISS for K but crosses the future wall line (x~480, y~553) while nothing has grown
  const p = fire(w.b, 850, 500, 150, 600, 'SLOW');
  let bad = 0, samples = 0, crossedAt = null;
  for (let k = 0; k < 90; k++) {
    step(DT);
    if (crossedAt == null && p.x < 470) crossedAt = k;
    if (rc.geom) {
      // every capsule run covers ONLY cells whose material has actually grown (>= 0.5), and every grown cell is covered
      const grown = rc.geom.segs.map((s) => s.grow >= 0.5 - 1e-6);
      const covered = new Array(grown.length).fill(false);
      for (const r of rigOf(w.cta).wallRuns(rc)) for (let i = r.from; i <= r.to; i++) covered[i] = true;
      samples++;
      if (covered.some((c, i) => c !== grown[i])) bad++;
    }
  }
  const passed = crossedAt != null && !(p.__hr && p.__hr.crystalReflected) && telem(w.cta).constructReflects === 0;
  // control: the identical shot AFTER the material locked is stopped and reflected
  waitLock(w);
  const q = fire(w.b, 850, 500, 150, 600, 'SLOW');
  step(0.7);
  const stopped = telem(w.cta).constructReflects === 1 && !!(q.__hr && q.__hr.crystalReflected);
  return { ok: early === 0 && bad === 0 && samples > 20 && passed && stopped,
    detail: { capsulesAtCast: early, mismatchTicks: bad, samples, earlyShotCrossedAtTick: crossedAt, earlyShotPassed: passed, lockedShotStopped: stopped } };
});

await gate('G02-normal-locomotion-cannot-cross-solid-wall', () => {
  const w = wallFresh();
  waitLock(w);
  w.b.x = 850; w.b.y = 500; w.b.baseSpeed = 520; w.b.setDir(-1, 0);
  let minX = 1e9, contact = false, bounced = false;
  for (let k = 0; k < 150; k++) {
    step(DT);
    minX = Math.min(minX, w.b.x);
    if (w.b.x < 600) contact = true;
    if (contact && w.b.dir.x > 0) bounced = true;
  }
  const face = 480 + CAPR + BODY_R;                              // body centre can never be nearer than this
  return { ok: minX >= face - 0.6 && contact && bounced && w.cons().state === 'LIVE', detail: { minX: fmt(minX), face, contact, bounced } };
});

await gate('G03-normal-locomotion-cannot-cross-live-prison-facet', () => {
  const w = prisonFresh();
  waitLock(w);
  const P = rigOf(w.cta).constructs.find((x) => x.kind === 'prison').prison;
  w.b.baseSpeed = 520; w.b.setDir(Math.cos(0.3), Math.sin(0.3));
  let maxOut = 0, n = 0;
  const inradius = 135 * Math.cos(Math.PI / 6);
  for (let k = 0; k < 120; k++) {
    step(DT);
    if (w.cons().state !== 'LIVE') break;
    n++;
    maxOut = Math.max(maxOut, Math.hypot(w.b.x - P.cx, w.b.y - P.cy));
  }
  // the body centre is confined to the hexagon shrunk by (body radius + material half thickness)
  return { ok: n > 60 && maxOut <= inradius - (BODY_R + CAPR) + 0.8 + 8, detail: { maxDistFromCentre: fmt(maxOut), limit: fmt(inradius - (BODY_R + CAPR)), ticks: n } };
});

await gate('G04-destroyed-prison-facet-opens-a-real-gap', () => {
  const out = {};
  {   // one facet: collision gone at once, projectile passes; a 150 px body still cannot pass a 135 px chord
    const w = prisonFresh(); waitLock(w);
    const P = rigOf(w.cta).constructs.find((x) => x.kind === 'prison').prison;
    const mid = (i) => ({ x: (P.edges[i].a.x + P.edges[i].b.x) / 2, y: (P.edges[i].a.y + P.edges[i].b.y) / 2 });
    const m = mid(3);
    fire(w.b, P.cx, P.cy, m.x, m.y, 'SNIPER'); step(0.2);
    const c = w.cons();
    const capsOf3 = CRY.capsules().filter((q) => q.cons && q.idx === 3).length;
    const hpB = hpOf(w.b);
    // a shot from the centre through the gap now reaches the far side of the arena (no facet stops it)
    const q = fire(w.b, P.cx, P.cy, m.x, m.y, 'SLOW');
    step(0.5);
    const reflected = !!(q.__hr && q.__hr.crystalReflected);
    w.b.baseSpeed = 520; w.b.setDir((m.x - P.cx), (m.y - P.cy));
    let maxOut = 0; for (let k = 0; k < 90; k++) { step(DT); maxOut = Math.max(maxOut, Math.hypot(w.b.x - P.cx, w.b.y - P.cy)); }
    out.one = { facetDead: c.facetsDead[3], capsulesOfFacet: capsOf3, projectilePasses: !reflected, bodyEscapes: maxOut > 135 + 40, maxOut: fmt(maxOut) };
  }
  {   // two ADJACENT facets: the opening is wide enough for the body
    const w = prisonFresh(); waitLock(w);
    const P = rigOf(w.cta).constructs.find((x) => x.kind === 'prison').prison;
    const mid = (i) => ({ x: (P.edges[i].a.x + P.edges[i].b.x) / 2, y: (P.edges[i].a.y + P.edges[i].b.y) / 2 });
    for (const i of [3, 4]) { const m = mid(i); fire(w.b, P.cx, P.cy, m.x, m.y, 'SNIPER'); step(0.2); }
    const m3 = mid(3), m4 = mid(4); const gx = (m3.x + m4.x) / 2 - P.cx, gy = (m3.y + m4.y) / 2 - P.cy;
    w.b.baseSpeed = 520; w.b.setDir(gx, gy);
    let maxOut = 0; for (let k = 0; k < 90; k++) { step(DT); maxOut = Math.max(maxOut, Math.hypot(w.b.x - P.cx, w.b.y - P.cy)); }
    out.two = { dead: w.cons().facetsDead.join(','), bodyEscapes: maxOut > 135 + 40, maxOut: fmt(maxOut) };
  }
  return { ok: out.one.facetDead && out.one.capsulesOfFacet === 0 && out.one.projectilePasses && !out.one.bodyEscapes && out.two.bodyEscapes, detail: out };
});

await gate('G05-Robot-A1-high-speed-dash-cannot-tunnel-through-solid-crystal-geometry', () => {
  const run = (withWall) => {
    const w = withWall ? wallFresh() : fresh({ ax: 150, ay: 500, bx: 850, by: 500 });
    if (withWall) waitLock(w);
    T.holdSpawns();
    T.pushSlot({ x: 300, y: 500, weaponId: 'PISTOL' });
    w.b.baseSpeed = 0;
    const r = HR.abilityController(w.ctb).tryCast('A1', 'test');
    let minX = 1e9, dashed = false;
    for (let k = 0; k < 60; k++) { step(DT); minX = Math.min(minX, w.b.x); }
    return { r: r.ok, minX, stoodOnOtherSide: minX < 420 };
  };
  const control = run(false), walled = run(true);
  const face = 480 + CAPR + BODY_R;
  return { ok: control.r && control.stoodOnOtherSide && walled.r && walled.minX >= face - 0.6 && !walled.stoodOnOtherSide,
    detail: { control: { minX: fmt(control.minX) }, walled: { minX: fmt(walled.minX), face } } };
});

await gate('G05b-large-step-anti-tunnelling-is-swept-not-sampled', () => {
  // a body teleported 400 px through the wall in ONE step (far beyond any per-frame dash) is still stopped
  const w = wallFresh(); waitLock(w);
  w.b.x = 700; w.b.y = 500; step(DT);                           // register previous position
  w.b.x = 300; w.b.y = 500;                                     // jump across the wall line in a single step
  step(DT);
  return { ok: w.b.x >= 480 + CAPR + BODY_R - 0.6 && w.b.x < 700, detail: { x: fmt(w.b.x) } };
});

await gate('G06-Hunter-pounce-authored-displacement-cannot-tunnel', async () => {
  const ready = await H.hunterReady(20000);
  if (!ready) return { ok: false, detail: 'Hunter art not ready in the headless harness (known baseline condition)' };
  const w = fresh({ p1: 'CRYSTAL', p2: 'HUNTER', ax: 150, ay: 500, bx: 850, by: 500 });
  press(w.a, 'A2'); fire(w.b, w.a.x, 900, w.a.x, w.a.y, 'SLOW'); stepUntil(() => ins(w.cta).jobs.length >= 1, 1.5);
  press(w.a, 'A1');
  waitLock({ cta: w.cta, cons: () => ins(w.cta).constructs.find((c) => c.kind === 'wall') });
  w.b.x = 850; w.b.y = 500; w.b.baseSpeed = 0;
  const r = HR.abilityController(w.ctb).tryCast('A2', 'test');
  let minX = 1e9;
  for (let k = 0; k < 80; k++) { step(DT); minX = Math.min(minX, w.b.x); }
  return { ok: r.ok && minX >= 480 + CAPR + BODY_R - 0.6, detail: { cast: r.ok, minX: fmt(minX), face: 480 + CAPR + BODY_R } };
});

await gate('G07-anti-tunnelling-is-shared-geometry-not-robot-hunter-rewrites', () => {
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
  const read = (f) => fs.readFileSync(f, 'utf8');
  const PROTECTED = {   // byte-identical to the Hunter owner-fix / prep baseline 12613d89 (protected semantics)
    'public/game/arsenal/arsenalChamberPaletteRuntime.js': '547ed50a88dbf1a10e8eb3f2fcdf69e3930ad10547302f8e6b48cc8b29425978',
    'public/game/arsenal/arsenalMetaRuntime.js': 'c7bca2c76d954a2887f311d4c00515e2c6350fc707fd98bf0f9d02c37280021d',
    'public/game/hero-rework/hunterPresentationRuntime.js': 'a5e414a61a25ce5595d129a712785b59fa68f996febb29cdf361b36302c645e2',
    'public/game/hero-rework/robotPresentationRuntime.js': '27856fca5ccda11674a825948a0f98ea48a62e9fe23b27e49200570f09e1c24c',
    'public/game/hero-rework/hunterGoldV10.js': '3aa150490997345877b3eb8c8801252e733b544aa4f14a6ad3fde1ae59ac01a1',
    'public/game/arsenal/arsenalWeaponRuntime.js': '70f26c3fa049e572fe9e9d045adc3a8d0b46f569b22e0b990f1a073b2d16c9b3',
    'public/game/modes/arsenalQuestRuntime.js': 'c82047c13559e550a541dd7fbc5179d5c8b9765871e544d885dc685c95e3a8de',
    'public/game/hero-rework/ailRuntime.js': 'dbc5e1e22a52639fbf8a0cc609ee9be03ca2538903d8c13788188b73d4e2f0b0',
  };
  const bad = Object.entries(PROTECTED).filter(([f, h]) => sha(read(f)) !== h).map(([f]) => f);
  const mech = read('public/game/hero-rework/heroMechanicsRuntime.js');
  const slice = (a, b) => mech.slice(mech.indexOf(a), mech.indexOf(b));
  const robot = sha(slice('   * 1. ROBOT', '   * 2. CRYSTAL')) === 'e3f0ee8cd974403a27ac53bbb739629b2e550b1f548a42a19c3e58b5d73f983b';
  const hunter = sha(slice('   * 8. HUNTER', '   * 9. TIME')) === 'f56cb13f3632fc7b1e5bf767177fc534bd453f41eee0899829c3719490bda9b4';
  const geom = HR.geom && typeof HR.geom.capsuleToi === 'function' && typeof HR.geom.wallsBlockPoint === 'function' && typeof HR.geom.solidCapsules === 'function';
  const grant = /OWNER_TEST_CREDITS\s*=\s*12000/.test(read('public/game/arsenal/arsenalMetaRuntime.js')) && /OWNER_TEST_GRANT_KEY/.test(read('public/game/arsenal/arsenalMetaRuntime.js'));
  return { ok: bad.length === 0 && robot && hunter && geom && grant, detail: { changedProtectedFiles: bad, robotBlockIdentical: robot, hunterBlockIdentical: hunter, sharedGeom: geom, grant12000: grant } };
});

await gate('G08-cage-stops-tracking-the-target-after-NUCLEATE', () => {
  const w = fresh({ ax: 150, ay: 500, bx: 700, by: 500 });
  press(w.a, 'A2'); step(0.1);
  w.b.baseSpeed = 380; w.b.setDir(0, 1);                          // the target keeps moving while the cage forms
  press(w.a, 'A1');
  const rc = rigOf(w.cta).constructs.find((x) => x.kind === 'prison');
  const P = rc.prison;
  let followedBefore = 0, movedAfter = 0, frozenAt = null, c0 = null, nFollow = 0;
  for (let k = 0; k < 90; k++) {
    step(DT);
    if (!P.frozen) { nFollow++; if (Math.hypot(P.cx - w.b.x, P.cy - w.b.y) < 25) followedBefore++; }
    else { if (frozenAt == null) { frozenAt = k; c0 = { x: P.cx, y: P.cy }; } movedAfter = Math.max(movedAfter, Math.hypot(P.cx - c0.x, P.cy - c0.y)); }
  }
  const targetDrift = Math.hypot(w.b.x - c0.x, w.b.y - c0.y);
  return { ok: frozenAt != null && nFollow > 10 && followedBefore >= nFollow - 2 && movedAfter === 0 && ins(w.cta).constructs[0].frozen === true,
    detail: { trackedTicksBeforeFreeze: `${followedBefore}/${nFollow}`, freezeTick: frozenAt, centreMovedAfterFreeze: movedAfter, targetNowFromCentre: fmt(targetDrift) } };
});

/* =========================================================================
 * §5 INTEGRITY — R07 and static law
 * ========================================================================= */
await gate('R07-runtime-revision-cache-bust-gate-green', async () => {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, ['tools/testRuntimeRevisionGate.mjs'], { encoding: 'utf8' });
  return { ok: r.status === 0, detail: (r.stdout || '').trim().split('\n').pop() };
});

await gate('L01-no-duplicate-KeyK-listener-and-no-input-buffer-in-Crystal-code', () => {
  const src = ['public/game/hero-rework/crystalGameplayRuntime.js', 'public/game/hero-rework/crystalaGoldV6.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const listeners = (src.match(/addEventListener\s*\(\s*['"]key/g) || []).length;
  const buffer = /pressK|bufferedJ|jBuffer|inputBuffer\s*[:=]\s*true/.test(src);
  const reg = fs.readFileSync('public/game/hero-rework/heroRegistry.js', 'utf8');
  return { ok: listeners === 0 && !buffer && /inputBuffer: false/.test(reg), detail: { keyListeners: listeners, buffer } };
});

await gate('L02-registry-frozen-numbers-and-one-knob-per-skill', () => {
  const R = win.APEX_HERO_REWORK_REGISTRY;
  const c = R.HEROES.CRYSTAL.skills;
  const a1 = R.resolveSkillLevel('CRYSTAL', 'A1', 1), a2 = R.resolveSkillLevel('CRYSTAL', 'A2', 1), ps = R.resolveSkillLevel('CRYSTAL', 'PASSIVE', 1);
  const knobs = [c.A1, c.A2, c.PASSIVE].map((s) => s.progressionBinding.knobPath.join('.'));
  const v = R.validateRegistry();
  return { ok: v.ok && a1.cooldown === 8 && a1.decisionWindow === 1.2 && a1.maxCastsPerAwakening === 1
    && a1.wall.width === 220 && a1.wall.hp === 80 && a1.wall.solidLifetime === 4 && a1.prison.radius === 135 && a1.prison.facetHp === 75 && a1.prison.solidLifetime === 3
    && a2.cooldown === 12 && a2.active === 2.4 && a2.scanRadius === 450 && a2.interceptBand === 300 && a2.minAnticipation === 0.12 && a2.contactToDock === 1.6
    && ps.reflectedDamagePct === 0.5 && knobs.join() === 'constructHpMult,cooldown,reflectedDamagePct',
    detail: { knobs, registryOk: v.ok, errors: v.errors } };
});

await gate('M01-contact-to-dock-is-1.60s-and-dock-flips-availability-exactly', () => {
  const w = crystalK();
  fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW');
  stepUntil(() => evOf(w.ev, 'CrystalDock').length > 0, 3.0);
  const ic = evOf(w.ev, 'CrystalIntercept')[0].payload, dk = evOf(w.ev, 'CrystalDock')[0].payload;
  const total = dk.at - ic.contactAt;
  const rl = evOf(w.ev, 'CrystalRelease')[0].payload.at - ic.contactAt;
  // V2 §2.2: contact-to-visible-dock retuned to 1.60 s total (refract/recoil
  // beats 0.16 s each are unchanged; only the return leg was retuned).
  return { ok: near(total, 1.60, 0.04) && near(rl, 0.16, 0.02) && ins(w.cta).available === 6, detail: { contactToDock: fmt(total), refractBeat: fmt(rl) } };
});

await gate('A01-P2-Crystal-AI-healthy-no-fail-cue-spam', () => {
  HR.setSeed(7);
  HR.setAiEnabled(true);
  const m = T.start('ROBOT', 'CRYSTAL'); T.holdSpawns();
  const ev = []; AIL.bus.on('*', (e) => ev.push(e));
  let err = null;
  try { step(25); } catch (e) { err = String(e && e.stack || e).split('\n').slice(0, 2).join(' | '); }
  const ct = m.combatants[1];
  const fails = ev.filter((e) => e.type === 'CastFailCue' && e.payload.hero === 'CRYSTAL').length;
  const casts = ev.filter((e) => e.type === 'Cast' && e.payload.hero === 'CRYSTAL').map((e) => e.payload.slot);
  HR.setAiEnabled(false);
  return { ok: !err && HR.invariants().ok && casts.includes('A2') && fails <= 2 && ct.anchor.hp > 0, detail: { err, fails, casts: casts.join(','), invariants: HR.invariants().errors } };
});

// @@GATES_CONTINUE@@

/* ============================ V2 law gates ============================== */

await gate('V02-single-heavy-shot-breaks-wall-and-passes-through-completely', () => {
  // V2 §1.2: a single shot whose structural damage >= remaining Wall HP applies
  // its hit, destroys the Wall and passes through UNCHANGED — same owner,
  // velocity, crit, provenance and FULL damage — then lands on the victim.
  const w = wallFresh();
  waitLock(w);
  const hpA = hpOf(w.a);
  const p = fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW', { damage: 13 });   // 13 x 7 = 91 >= 80
  step(1.2);
  const c = w.cons();
  const hps = evOf(w.ev, 'CrystalConstructHit');
  return { ok: c.state === 'ENDED' && c.reason === 'destroyed'
      && !(p.__hr && p.__hr.crystalReflected) && !!(p.__hr && p.__hr.cryPassed)
      && p.owner === w.b && hpOf(w.a) < hpA && hps.length === 1
      && evOf(w.ev, 'CrystalConstructReflect').length === 0
      && hps[0].payload.why === 'break-through' && hps[0].payload.kind === 'wall'
      && near(p.damage, 13, 1e-9) && near(hps[0].payload.damage, 13 * 7, 1e-6),
    detail: { state: c.state, reason: c.reason, reflected: !!(p.__hr && p.__hr.crystalReflected),
      passed: !!(p.__hr && p.__hr.cryPassed), crystalHpLoss: fmt(hpA - hpOf(w.a)),
      hits: hps.map((e) => ({ dmg: fmt(e.payload.damage), why: e.payload.why })) } };
});

await gate('V04-wall-fails-with-no-cooldown-when-a-blade-is-busy', () => {
  // V2 §1.1: Wall needs BOTH blades free — shard identity [0,1], not count.
  // With the blades anchored to an existing Wall (4 shards still free) and K
  // just turned on (HEXA window OPEN), J must refuse: HEXA (only 4 of 6) and
  // Wall (blades busy) both decline, so the cast fails 'condition' with NO
  // cooldown consumed and no second construct appears.
  const w = fresh();
  press(w.a, 'A1');                                          // Wall #1 (K off) anchors blades [0,1]
  const s = ins(w.cta).shards;
  const bladesBusy = s[0].state !== 'ORBIT' && s[1].state !== 'ORBIT';
  press(w.a, 'A2');                                          // K on: HEXA decision window now OPEN
  const before = ins(w.cta);
  w.cta.skills.A1.cdLeft = 0;                                // isolate the availability law
  const r = press(w.a, 'A1');
  const after = w.cta.skills.A1.cdLeft;
  return { ok: bladesBusy && before.available === 4 && before.k.constructDecisionOpen === true
      && r && r.ok === false && r.reason === 'condition' && r.failCue === true && after === 0
      && ins(w.cta).constructs.filter((c) => c.kind === 'wall').length === 1 && ins(w.cta).constructs.length === 1,
    detail: { bladesBusy, available: before.available, decisionOpen: before.k.constructDecisionOpen,
      reason: r && r.reason, cdLeftAfter: after, constructs: ins(w.cta).constructs.length } };
});

await gate('V05-hexa-facet-numbers-and-reflect-first-removal-are-unchanged', () => {
  // V2 §1.3 NON-CHANGE: facet HP stays 75 and HEXA keeps its own reflect-first
  // law — even the shot that removes the last facet HP is still reflected
  // (the Wall's new breaking-shot law does NOT leak into HEXA). The prism
  // holds all six shards, so the test shots can never be claimed and fly
  // straight to the facets: three effective-31.5 shots land 75 -> 43.5 ->
  // 12 -> removed on one facet, every one of them reflected.
  const w = crystalK();
  press(w.a, 'A2');
  step(0.05);
  const r = press(w.a, 'A1');                                   // HEXA while the window is open
  const pr = () => ins(w.cta).constructs.find((c) => c.kind === 'prison');
  const rc = () => rigOf(w.cta).constructs.find((x) => x.kind === 'prison');
  const built = pr();
  step(0.85);                                                    // test shots land after the prism locks
  const shots = [];
  for (let k = 0; k < 3; k++) { shots.push(fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW', { damage: 4.5 })); step(0.55); }
  const hps = evOf(w.ev, 'CrystalConstructHit');
  const refs = evOf(w.ev, 'CrystalConstructReflect');
  const g = rc() && rc().prison;
  const end = pr();
  const deadFacets = end.facetsDead.filter(Boolean).length;
  return { ok: r && r.ok === true && built && built.kind === 'prison' && built.maxHp.length === 6 && built.maxHp.every((m) => m === 75)
      && g && near(g.R, 135, 1e-6) && g.edges.length === 6
      && end.lockedAt != null && near(end.endAt - end.lockedAt, 3.0, 1e-9)
      && hps.length === 3 && refs.length === 3 && hps.every((e) => e.payload.kind === 'prison' && e.payload.why === 'hit')
      && shots.every((p) => p.__hr && p.__hr.crystalReflected && p.owner === w.a)
      && deadFacets === 1 && end.state === 'LIVE',
    detail: { r: r && r.ok, facetMax: built && built.maxHp,
      radius: g && fmt(g.R), edges: g && g.edges.length, life: end.lockedAt != null ? (end.endAt - end.lockedAt) : null,
      hits: hps.map((e) => `${fmt(e.payload.damage)}:${e.payload.why}`), reflectEvents: refs.length,
      killingReflected: shots[2] && !!(shots[2].__hr && shots[2].__hr.crystalReflected),
      deadFacets, state: end.state } };
});

await gate('V06-every-contact-ring-is-the-300px-ring', () => {
  // V2 §2.2 gates 3/10: all contact estimates land on 300 px (75 + 1.5 x 150);
  // no 180/150/120/90 rescue bands exist in any scenario.
  const bands = new Set();
  const add = (w) => { for (const e of evOf(w.ev, 'CrystalReserve')) bands.add(e.payload.band); };
  const a = crystalK({ ax: 150, ay: 500, bx: 850, by: 500 });
  fire(a.b, 850, 500, 150, 500, 'SLOW'); step(1.2); add(a);
  const b = crystalK({ ax: 150, ay: 500, bx: 850, by: 500 });
  fire(b.b, 850, 500, 150, 500, 'SNIPER'); step(0.6); add(b);
  const c = crystalK({ ax: 150, ay: 500, bx: 850, by: 500 });
  for (let k = 0; k < 4; k++) fire(c.b, 850, 500 + (k - 1.5) * 20, 150, 500, 'SMG');
  step(1.2); add(c);
  const d = crystalK({ ax: 150, ay: 500, bx: 560, by: 500 });
  for (let k = 0; k < 8; k++) { const ang = Math.PI + (k - 3.5) * 0.05; fire(d.b, 560, 500, 560 + Math.cos(ang) * 500, 500 + Math.sin(ang) * 500, 'SHOTGUN'); }
  step(0.5); add(d);
  return { ok: bands.size === 1 && bands.has(300), detail: { bands: [...bands] } };
});

await gate('V07-assignment-never-consumes-a-projectile-even-at-contact-distance', () => {
  // V2 §2.2 gates 8/12/18: claiming, selection and travel never teleport or
  // consume the projectile. A threat spawned 5 px from the Crystal surface is
  // claimed on its first sight (it is already inside the 450 ring) — at the
  // RESERVE moment it is still fully intact, and the cancellation happens only
  // at a real swept contact strictly LATER than the assignment frame.
  const w = crystalK();
  const hp0 = hpOf(w.a);
  const p = fire(w.b, 150 + 58.5 + 5, 500, w.a.x, w.a.y, 'SLOW', { damage: 4.5 });
  const before = { damage: p.damage, ownerIsB: p.owner === w.b, vx: p.vx, vy: p.vy };
  let atReserve = null, tReserve = null;
  AIL.bus.on('CrystalReserve', (e) => {
    atReserve = { inList: win.projectiles.includes(p), damage: p.damage, ownerIsB: p.owner === w.b,
      vx: p.vx, vy: p.vy, reflected: !!(p.__hr && p.__hr.crystalReflected) };
    tReserve = e.payload.at;
  });
  step(0.5);
  const ic = evOf(w.ev, 'CrystalIntercept')[0];
  // At point-blank range the body may win the race before any shard can
  // physically arrive (shards never teleport) — that is ordinary physics.
  // The LAW is that the assignment itself consumed nothing: any cancellation
  // is a strictly later physical event (shard contact or body hit).
  const fate = ic ? 'intercept' : (hpOf(w.a) < hp0 ? 'body' : 'none');
  return { ok: telem(w.cta).reservations === 1 && !!atReserve
      && atReserve.inList && atReserve.damage === before.damage && atReserve.ownerIsB === before.ownerIsB
      && near(atReserve.vx, before.vx, 1e-9) && near(atReserve.vy, before.vy, 1e-9)
      && atReserve.reflected === false && fate !== 'none'
      && (ic == null || ic.payload.at - tReserve >= DT - 1e-9),
    detail: { atReserve, fate, contactAt: ic && ic.payload.at, reserveAt: tReserve,
      assignToContact: ic && fmt(ic.payload.at - tReserve), crystalHpLoss: fmt(hp0 - hpOf(w.a)) } };
});
const failed = results.filter((r) => !r.ok);
console.log(`\n[CRYSTALA GAMEPLAY GATES] ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
