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
// @@GATES_CONTINUE@@
const failed = results.filter((r) => !r.ok);
console.log(`\n[CRYSTALA GAMEPLAY GATES] ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
