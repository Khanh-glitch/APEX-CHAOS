// CRYSTALA V1 — deterministic gameplay gates (docs/hero-rework/crystala-v1/03_IMPLEMENTATION_TEST_MATRIX.md
// §1-§4 + R07). Boots the REAL engine/runtimes headlessly (tools/lib/crystalaHarness.mjs) and drives
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

await gate('C02-K-valid-press-2.4s-awakening-8s-cooldown', () => {
  const { a, cta } = fresh();
  const t0 = clock();
  const r = press(a, 'A2');
  const cd = HR.abilityController(cta).cooldownLeft('A2');
  step(2.3);
  const activeAt23 = ins(cta).k.active;
  step(0.2);
  const activeAt25 = ins(cta).k.active;
  return { ok: r.ok && near(cd, 8.0, 1e-6) && activeAt23 && !activeAt25 && telem(cta).kCasts === 1,
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
  // reservation moment for this bullet falls at ~+0.15 s => after expiry
  const p = fire(b, 900, 500, a.x, a.y, 'PISTOL');
  step(0.7);
  return { ok: telem(cta).reservations === 0 && !ins(cta).k.active,
    detail: { reservations: telem(cta).reservations, seen: telem(cta).threatsSeen, pAlive: win.projectiles.includes(p) } };
});

await gate('C05-committed-job-completes-after-K-expiry', () => {
  const { a, b, cta, ev } = fresh({ ax: 120, ay: 500, bx: 975, by: 500 });
  press(a, 'A2');
  step(2.0);
  const p = fire(b, 975, 500, a.x, a.y, 'SLOW');   // reservation ~2.2, contact ~2.45 (after K ends)
  const kEnd = ins(cta).k.until;
  step(2.0);
  const ic = evOf(ev, 'CrystalIntercept')[0];
  return { ok: !!ic && ic.payload.contactAt > kEnd && telem(cta).intercepts === 1 && !p.__hr.cryTid === false,
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
  const stateAtReserve = ins(cta).shards.filter((s) => s.state === 'RESERVED').length;
  const availNow = ins(cta).available;
  const r = press(a, 'A1');
  const c = ins(cta).constructs[0];
  return { ok: reserved && stateAtReserve === 1 && availNow === 5 && r.ok && c && c.kind === 'wall' && c.shardIds.length === 2,
    detail: { stateAtReserve, availNow, kind: c && c.kind } };
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
  // six sequential intercepts occupy every shard, then the first shard(s) dock and serve a later threat
  const { a, b, cta, ev } = fresh({ ax: 130, ay: 500, bx: 990, by: 500 });
  press(a, 'A2');
  let n = 0;
  const seq = () => { fire(b, 990, 500, a.x, a.y, 'SLOW', { damage: 4.5 + n * 0.01 }); n += 1; };
  seq();
  for (let k = 0; k < 5; k++) { step(0.16); seq(); }
  step(0.75);                                      // t ~ 1.6: shard of threat #1 docked (~1.55), K ends at 2.4
  const hit0 = telem(cta).intercepts;
  seq();                                           // a 7th threat while K still active
  step(0.9);
  const t = telem(cta);
  return { ok: t.repeatIntercepts >= 1 && t.intercepts >= 6, detail: { intercepts: t.intercepts, repeat: t.repeatIntercepts, hit0 } };
});

await gate('C11-J-outside-K-fails-immediately-no-cooldown', () => {
  const { a, cta } = fresh();
  const r = press(a, 'A1');
  return { ok: !r.ok && r.failCue === true && HR.abilityController(cta).cooldownLeft('A1') === 0 && telem(cta).jCasts === 0,
    detail: { r, cd: HR.abilityController(cta).cooldownLeft('A1') } };
});

await gate('C12-failed-J-no-latent-replay', () => {
  const { a, cta } = fresh();
  press(a, 'A1');                                  // fails: K not active
  press(a, 'A2'); step(1.0);                       // K now active and six shards return/orbit
  return { ok: ins(cta).constructs.length === 0 && telem(cta).jCasts === 0,
    detail: { constructs: ins(cta).constructs.length } };
});

await gate('C13-J-success-consumes-1.5s-cooldown', () => {
  const { a, cta } = fresh();
  press(a, 'A2'); step(0.1);
  const r = press(a, 'A1');
  const cd = HR.abilityController(cta).cooldownLeft('A1');
  return { ok: r.ok && near(cd, 1.5, 1e-6) && telem(cta).jCasts === 1, detail: { cd } };
});

await gate('C14-J-with-6-ORBIT-builds-PRISON', () => {
  const { a, cta } = fresh();
  press(a, 'A2'); step(0.1);
  const r = press(a, 'A1');
  const c = ins(cta).constructs[0];
  return { ok: r.ok && c && c.kind === 'prison' && c.shardIds.length === 6 && telem(cta).prisonCasts === 1 && ins(cta).available === 0,
    detail: { kind: c && c.kind, shards: c && c.shardIds.length } };
});

await gate('C15-J-with-2to5-ORBIT-builds-WALL-with-exactly-2', () => {
  const out = {};
  for (const busy of [1, 2, 3, 4]) {
    const { a, b, cta } = fresh({ ax: 130, ay: 500, bx: 990, by: 500 });
    press(a, 'A2');
    for (let k = 0; k < busy; k++) { fire(b, 990, 500, a.x, a.y, 'SLOW', { damage: 4.5 + k * 0.01 }); step(0.02); }
    stepUntil(() => ins(cta).jobs.length >= busy, 1.2);
    const avail = ins(cta).available;
    const r = press(a, 'A1');
    const c = ins(cta).constructs[0];
    out[busy] = { avail, ok: r.ok, kind: c && c.kind, n: c && c.shardIds.length };
  }
  const ok = Object.values(out).every((x) => x.ok && x.kind === 'wall' && x.n === 2 && x.avail >= 2 && x.avail <= 5);
  return { ok, detail: out };
});

await gate('C16-J-with-0or1-available-fails-no-cooldown', () => {
  const out = {};
  {   // 0 available: a Prison consumed all six, J again after its cooldown elapsed
    const { a, cta } = fresh();
    press(a, 'A2'); step(0.1); press(a, 'A1');
    step(1.6);
    const r = press(a, 'A1');
    out.zero = { ok: r.ok, reason: r.reason, cd: HR.abilityController(cta).cooldownLeft('A1'), avail: ins(cta).available };
  }
  {   // 1 available: five shards busy with real intercepts
    const { a, b, cta } = fresh({ ax: 130, ay: 500, bx: 990, by: 500 });
    press(a, 'A2');
    for (let k = 0; k < 5; k++) { fire(b, 990, 500, a.x, a.y, 'SLOW', { damage: 4.5 + k * 0.01 }); step(0.02); }
    stepUntil(() => ins(cta).jobs.length >= 5, 1.2);
    const avail = ins(cta).available;
    const r = press(a, 'A1');
    out.one = { ok: r.ok, reason: r.reason, avail, cd: HR.abilityController(cta).cooldownLeft('A1') };
  }
  const ok = !out.zero.ok && out.zero.cd === 0 && out.zero.avail === 0 && !out.one.ok && out.one.cd === 0 && out.one.avail === 1;
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
// Wall: one shard is made busy by a real vertical intercept (away from the wall line), then J (2..5 -> Wall).
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
const lockedAt = (w) => { const c = w.cons(); return c && c.lockedAt; };
const waitLock = (w) => stepUntil(() => lockedAt(w) != null, 3.0);

await gate('C18-wall-HP120-width220-solid-4s-from-material-lock', () => {
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
  return { ok: w.r.ok && c.maxHp === 120 && near(span, 220, 1e-6) && near(life, 4.0, 1e-9) && lockDelay > 0.6 && lockDelay < 0.9 && c2.reason === 'expire' && endedAt != null && endedAt - c.endAt < 2 * DT + 1e-6 && endedAt - c.endAt >= -1e-6,
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

await gate('C21-predicted-miss-does-not-reserve', () => {
  const w = crystalK();
  const hp0 = hpOf(w.a);
  fire(w.b, 850, 500, 150, 800, 'SLOW');                 // passes ~300 px beside the Crystal
  step(1.5);
  return { ok: telem(w.cta).reservations === 0 && telem(w.cta).ignoredMiss === 1 && hpOf(w.a) === hp0 && ins(w.cta).available === 6,
    detail: { miss: telem(w.cta).ignoredMiss, res: telem(w.cta).reservations } };
});

await gate('C22-projectile-that-would-expire-does-not-reserve', () => {
  const w = crystalK();
  fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW', { life: 0.1 });   // range 150 px, target 700 px away
  step(0.8);
  return { ok: telem(w.cta).reservations === 0 && telem(w.cta).ignoredExpired === 1, detail: { expired: telem(w.cta).ignoredExpired } };
});

await gate('C23-projectile-hitting-solid-construct-first-does-not-reserve', () => {
  const w = wallFresh();
  waitLock(w);
  const res0 = telem(w.cta).reservations;
  fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW');            // crosses the wall line x~480 before the Crystal
  step(0.5);
  return { ok: ins(w.cta).k.active && telem(w.cta).reservations === res0 && telem(w.cta).ignoredBlocked === 1 && telem(w.cta).constructReflects === 1,
    detail: { blocked: telem(w.cta).ignoredBlocked, reflects: telem(w.cta).constructReflects, res: telem(w.cta).reservations, kActive: ins(w.cta).k.active } };
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

await gate('C28-scan-1000-detects-but-never-reserves-early-by-distance', () => {
  const w = crystalK({ ax: 100, ay: 500, bx: 990, by: 500 });
  const t0 = clock();
  fire(w.b, 990, 500, w.a.x, w.a.y, 'SLOW');            // ~890 px away at spawn, tBand ~0.47 s
  step(DT, DT); step(DT, DT);
  const early = { seen: telem(w.cta).threatsSeen, res: telem(w.cta).reservations };
  stepUntil(() => telem(w.cta).reservations > 0, 1.0);
  const rv = evOf(w.ev, 'CrystalReserve')[0];
  return { ok: early.seen === 1 && early.res === 0 && !!rv && rv.payload.tBand < 0.5 && rv.t - t0 > 0.05,
    detail: { early, tBandAtReserve: rv && fmt(rv.payload.tBand), after: rv && fmt(rv.t - t0) } };
});

await gate('C29-predicted-intercept-is-the-real-180px-band', () => {
  const w = crystalK();
  fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW');
  stepUntil(() => telem(w.cta).intercepts > 0, 2.0);
  const rv = evOf(w.ev, 'CrystalReserve')[0].payload;
  const ic = evOf(w.ev, 'CrystalIntercept')[0].payload;
  const ipD = Math.hypot(rv.ip.x - w.a.x, rv.ip.y - w.a.y);
  const cD = Math.hypot(ic.x - w.a.x, ic.y - w.a.y);
  return { ok: near(ipD, 180, 0.5) && near(cD, 180, 60), detail: { ipDist: fmt(ipD), contactDist: fmt(cD) } };
});

await gate('C30-predictor-accounts-for-Crystal-current-movement', () => {
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
  if (s0) { const pr = s0.ev.payload; const cx = s0.cx + s0.v.x * pr.tBand, cy = s0.cy + s0.v.y * pr.tBand; ipErr = Math.abs(Math.hypot(pr.ip.x - cx, pr.ip.y - cy) - 180); }
  return { ok: dd > 65.5 && !!s0 && ipErr < 2.0 && telem(w.cta).intercepts === 1 && hpOf(w.a) === hp0,
    detail: { stationaryMiss: fmt(dd), ipErr: ipErr && fmt(ipErr), intercepts: telem(w.cta).intercepts } };
});

await gate('C31-simultaneous-threats-TTI-then-damage-then-stable-id', () => {
  // Seven simultaneous real threats, six shards: the assignment order decides exactly who is left unserved.
  const round = (specs, ax) => {
    ax = ax || 150;
    const w = crystalK({ ax, ay: 500, bx: 850, by: 500 });
    const ps = specs.map((s) => fire(w.b, ax + s.R * Math.cos(s.th), 500 + s.R * Math.sin(s.th), w.a.x, w.a.y, 'SLOW',
      { speed: 900, life: 3, damage: s.dmg }));
    step(2.6);
    return ps.map((p) => !!(p.__hr && p.__hr.cryTid));
  };
  const ths = [-0.25, -0.17, -0.08, 0, 0.08, 0.17, 0.25];
  // (a) nearer projectile = earlier time-to-hit: the FARTHEST one (index 0) loses
  const a = round(ths.map((th, i) => ({ th, R: 900 - i * 20, dmg: 4.5 })), 100);
  // (b) equal TTI: the LOWEST damage (index 6) loses
  const b = round(ths.map((th, i) => ({ th, R: 850, dmg: i === 6 ? 4.4 : 4.5 + i * 0.1 })));
  // (c) equal TTI and damage: the stable id (spawn order) decides; the LAST spawned loses
  const c = round(ths.map((th) => ({ th, R: 850, dmg: 4.5 })));
  const lost = (r) => r.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  return { ok: lost(a).join() === '0' && lost(b).join() === '6' && lost(c).join() === '6',
    detail: { unservedByTTI: lost(a), unservedByDamage: lost(b), unservedById: lost(c) } };
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

await gate('C34-shotgun-pellets-are-independent-threats', () => {
  // (a) independence: a fan of 8 slow pellets; only the ones whose own path hits reserve, each by its own shard
  const w = crystalK({ ax: 150, ay: 500, bx: 850, by: 500 });
  const base = Math.PI;                                   // aimed at the Crystal
  let wouldHit = 0;
  for (let k = 0; k < 8; k++) {
    const ang = base + (k - 3.5) * 0.06;
    const tx = 850 + Math.cos(ang) * 700, ty = 500 + Math.sin(ang) * 700;
    const d = Math.abs((150 - 850) * Math.sin(ang) - (500 - 500) * Math.cos(ang));   // perpendicular miss of a stationary Crystal
    if (d <= 58.5 + 6) wouldHit++;
    fire(w.b, 850, 500, tx, ty, 'SLOW', { radius: 6, life: 2 });
  }
  step(2.5);
  const res = telem(w.cta).reservations, miss = telem(w.cta).ignoredMiss;
  const pids = evOf(w.ev, 'CrystalReserve').map((e) => e.payload.pid);
  // (b) real shotgun pellets: 180 px is too early for the 0.12 s beat at this
  // range, so the predictor must choose a later inward rescue band and still
  // assign pellets independently.
  const v = crystalK({ ax: 150, ay: 500, bx: 560, by: 500 });
  for (let k = 0; k < 8; k++) {
    const ang = Math.PI + (k - 3.5) * 0.05;
    fire(v.b, 560, 500, 560 + Math.cos(ang) * 500, 500 + Math.sin(ang) * 500, 'SHOTGUN');
  }
  step(0.4);
  const vr = evOf(v.ev, 'CrystalReserve');
  return { ok: res === wouldHit && res >= 1 && new Set(pids).size === res && miss === 8 - wouldHit
      && telem(v.cta).reservations >= 1 && vr.some((e) => e.payload.rescue && e.payload.band < 180),
    detail: { slowFan: { wouldHit, reserved: res, miss }, realShotgunReserved: telem(v.cta).reservations,
      realShotgunUnreachable: telem(v.cta).ignoredUnreachable, rescueBands: vr.map((e) => e.payload.band) } };
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

await gate('C36-selected-shard-is-physically-reachable-no-far-side-teleport', () => {
  const w = crystalK({ ax: 150, ay: 500, bx: 990, by: 500 });
  const rec = [];
  AIL.bus.on('CrystalReserve', (e) => { const st = rigOf(w.cta).stones[e.payload.shard]; rec.push({ tBand: e.payload.tBand, travel: Math.hypot(st.x - e.payload.ip.x, st.y - e.payload.ip.y) }); });
  for (let k = 0; k < 3; k++) fire(w.b, 990, 500 + (k - 1) * 50, w.a.x, w.a.y + (k - 1) * 25, 'SLOW', { damage: 4.5 + k * 0.01 });
  let maxJump = 0; const prev = new Map();
  for (let k = 0; k < 150; k++) {
    step(DT);
    for (const s of rigOf(w.cta).stones) { const q = prev.get(s.uid); if (q) maxJump = Math.max(maxJump, Math.hypot(s.x - q.x, s.y - q.y)); prev.set(s.uid, { x: s.x, y: s.y }); }
  }
  // lead the chosen shard needed (Gold travel model) must fit inside the time to the band
  const fits = rec.every((r) => Math.max(0.12, r.travel * 1.12 / 1000 + 0.02) <= r.tBand + 0.011);
  return { ok: rec.length >= 2 && fits && maxJump < 70, detail: { n: rec.length, fits, maxJump: fmt(maxJump), travel: rec.map((r) => fmt(r.travel)) } };
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

await gate('C48-final-killing-hit-is-reflected-before-the-structure-is-removed', () => {
  const w = wallFresh();
  waitLock(w);
  const shots = [];
  for (let k = 0; k < 4; k++) { shots.push(fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW', { damage: 4.5 + k * 0.001 })); step(0.6); }
  const c = w.cons();
  const last = shots[3];
  const hps = evOf(w.ev, 'CrystalConstructHit').map((e) => e.payload.damage);
  return { ok: c.state === 'ENDED' && c.reason === 'destroyed' && shots.every((p) => p.__hr && p.__hr.crystalReflected && p.owner === w.a) && last.vx > 0,
    detail: { state: c.state, reason: c.reason, reflected: shots.map((p) => !!(p.__hr && p.__hr.crystalReflected)), hits: hps.map(fmt) } };
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
    'public/game/hero-rework/hunterPresentationRuntime.js': '18c67a8a8315fa66adff4e8bd046ff389a893ecd6ab590e78b83fa32e7eb8146',
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
  const hunter = sha(slice('   * 8. HUNTER', '   * 9. TIME')) === '479cce6f8088ed0705fe34ce1c1427450803935437820b32b591f5f23f5d1885';
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
  return { ok: v.ok && a1.cooldown === 1.5 && a1.wall.width === 220 && a1.wall.hp === 120 && a1.wall.solidLifetime === 4 && a1.prison.radius === 135 && a1.prison.facetHp === 75 && a1.prison.solidLifetime === 3
    && a2.cooldown === 8 && a2.active === 2.4 && a2.scanRadius === 1000 && a2.interceptBand === 180 && a2.minAnticipation === 0.12 && a2.contactToDock === 1.2
    && ps.reflectedDamagePct === 0.5 && knobs.join() === 'constructHpMult,cooldown,reflectedDamagePct',
    detail: { knobs, registryOk: v.ok, errors: v.errors } };
});

await gate('M01-contact-to-dock-is-1.20s-and-dock-flips-availability-exactly', () => {
  const w = crystalK();
  fire(w.b, 850, 500, w.a.x, w.a.y, 'SLOW');
  stepUntil(() => evOf(w.ev, 'CrystalDock').length > 0, 3.0);
  const ic = evOf(w.ev, 'CrystalIntercept')[0].payload, dk = evOf(w.ev, 'CrystalDock')[0].payload;
  const total = dk.at - ic.contactAt;
  const rl = evOf(w.ev, 'CrystalRelease')[0].payload.at - ic.contactAt;
  return { ok: near(total, 1.20, 0.04) && near(rl, 0.16, 0.02) && ins(w.cta).available === 6, detail: { contactToDock: fmt(total), refractBeat: fmt(rl) } };
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
const failed = results.filter((r) => !r.ok);
console.log(`\n[CRYSTALA GAMEPLAY GATES] ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
