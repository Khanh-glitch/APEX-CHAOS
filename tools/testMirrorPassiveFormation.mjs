#!/usr/bin/env node
/* CHECKPOINT F1 — MIRROR Gold-first per-owner shard / node formation gates.
 *
 * Drives the REAL shipping runtime through the shared harness (real
 * takeDamage adapter, real AQ.step loop, real combatant passive state, real
 * teardown). No fake Mirror simulator.
 *
 * Law under test (doc 08 §4-§6 binding, doc 02 P01-P18 corrected text):
 *   realized HP loss -> clamp(round(d/35),1,5) shards (>=20 only)
 *   per-owner 16-slot pool, Gold replacement law, 6s FREE lifetime
 *   0.3s per-owner scans, age STRICTLY > .7, same-owner only
 *   seed + 4 nearest, fourth-nearest STRICTLY < 170 (seed radius)
 *   immediate reservation, Gold assembly (.18+i*.06 / .4 travel)
 *   ACTIVE at ~1.20, 10s ACTIVE clock, .55 fold -> node+5 slots OFF
 *   cap = the 16/5 ECONOMY (no counter, no retirement)
 *   routing disabled: F1 nodes never touch the legacy circle router
 */
import { bootHarness } from './lib/crystalaHarness.mjs';
import fs from 'node:fs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
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
const expectedShards = (d) => (d < 20 ? 0 : Math.max(1, Math.min(5, Math.round(d / 35))));

function start(p1 = 'MIRROR', p2 = 'ROBOT') {
  T.start(p1, p2); T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = 150; a.y = 500; b.x = 850; b.y = 500;
  return { a, b, ct: HR.byCombatant(a), ctB: HR.byCombatant(b) };
}
function bus() { return HR.bus || (win.APEX_HERO_REWORK_AIL && win.APEX_HERO_REWORK_AIL.bus); }
function captureSeq(types) {
  const b = bus(); const mark = b.seq;
  return () => b.since(mark).filter((e) => types.includes(e.type));
}
const pstate = (ct) => ct.store['mirror.passive'] || null;
const onCount = (st) => st.slots.filter((s) => s && s.on).length;
const freeCount = (st) => st.slots.filter((s) => s && s.on && s.st === 0).length;
const ownedCount = (st) => st.slots.filter((s) => s && s.on && s.st !== 0).length;

/* §18: controlled placement of existing FREE shards — allowed because these
 * gates test FORMATION LOGIC, not spawn motion. Provenance/motion gates below
 * use the untouched real proc path instead. */
function placeCluster(ct, cx, cy, offs, age = 0.8) {
  const api = HR.match.api;
  const made = [];
  for (const [dx, dy] of offs) {
    const s = api.mirrorShardProc(ct, cx + dx, cy + dy, 1, null)[0];
    s.x = cx + dx; s.y = cy + dy; s.vx = 0; s.vy = 0; s.age = age;
    made.push(s);
  }
  return made;
}
const TIGHT5 = [[0, 0], [12, 4], [-10, 10], [6, -12], [-8, -9]];

/* ============ DAMAGE -> SHARD LAW (P01-P05) ============ */
try {
  const o = start();
  // The engine's upstream mitigation scales authored damage before the adapter
  // sees it; the F1 law is keyed to REALIZED loss (adapter before-after).
  // Calibrate the live factor from the real engine, then craft authored
  // amounts whose realized values land exactly on the law's boundaries.
  o.a.hp = o.a.maxHp;
  const cb = o.a.hp;
  // Sub-threshold calibration hit: factor measured without spawning shards.
  o.a.takeDamage(10, o.b, 'arsenal-PISTOL');
  const factor = (cb - o.a.hp) / 10;
  o.a.hp = o.a.maxHp;
  const craft = (realizedTarget, eps = 0) => (realizedTarget + eps) / factor;
  const probes = [
    { authored: 19.999, note: 'below-threshold (realized < 20)' },
    { authored: craft(20, 1e-9), note: 'realized just >= 20' },
    { authored: craft(35, 1e-9), note: 'round(35/35)=1' },
    { authored: craft(52.4, 0), note: 'round(52.4/35)=1' },
    { authored: craft(52.5, 1e-9), note: 'round(52.5/35)=2 (rounding edge)' },
    { authored: craft(70, 1e-9), note: 'round(70/35)=2' },
    { authored: 500, note: 'clamp to 5' },
  ];
  const counts = [];
  // Fixture hygiene: the engine advances a few frames between probes, which
  // would let probe shards age past the formation gate and churn the pool.
  // Freeze the per-owner scan clock while probing the damage law ONLY
  // (formation cadence is pinned by its own dedicated gates), then restore.
  const st = pstate(o.ct) || HR.match.api.mirrorShardProc(o.ct, 50, 50, 0, null) && pstate(o.ct);
  st.scanT = 1e9;
  for (const p of probes) {
    const before = o.a.hp;
    const shardsBefore = onCount(st);
    o.a.takeDamage(p.authored, o.b, 'arsenal-PISTOL');
    const realized = before - o.a.hp;
    const spawned = onCount(st) - shardsBefore;
    counts.push({ note: p.note, realized: +realized.toFixed(6),
      expected: expectedShards(realized), spawned });
    o.a.hp = o.a.maxHp;                            // fixture-only reset between probes
  }
  st.scanT = 0;
  const total = onCount(st);
  const sum = counts.reduce((s, c) => s + c.expected, 0);
  const allDeltasExact = counts.every((c) => c.spawned === c.expected);
  gate('F1-P01-P03-realized-damage-formula-boundaries',
    allDeltasExact && total === sum && sum === 12
    && counts[0].expected === 0 && counts[1].expected === 1
    && counts[2].expected === 1 && counts[3].expected === 1
    && counts[4].expected === 2 && counts[5].expected === 2
    && counts[6].expected === 5,
    { mitigationFactor: +factor.toFixed(4),
      boundaries: counts.map((c) => `${c.note}: realized ${c.realized} -> spawned ${c.spawned}/${c.expected}`),
      poolTotal: total, expectedTotal: sum,
      note: '<20 -> 0; else clamp(round(realized/35),1,5), all probed on the REAL engine path' });
} catch (e) { gate('F1-P01-P03-realized-damage-formula-boundaries', false, String(e)); }

try {
  const o = start();
  // (a) opponent suffers damage: no Mirror shards for the Mirror owner.
  o.b.takeDamage(70, o.a, 'arsenal-PISTOL');
  const afterOpponent = pstate(o.ct) ? onCount(pstate(o.ct)) : 0;
  // (b) self-credited damage: excluded by the passive law.
  o.a.takeDamage(70, o.a, 'arsenal-PISTOL');
  const afterSelf = pstate(o.ct) ? onCount(pstate(o.ct)) : 0;
  // (c) neutral/external realized damage (no crediting combatant): valid.
  o.a.takeDamage(70, null, 'arsenal-PISTOL');
  const afterNeutral = pstate(o.ct) ? onCount(pstate(o.ct)) : 0;
  gate('F1-P04-only-mirror-owned-realized-damage',
    afterOpponent === 0 && afterSelf === 0 && afterNeutral === 2,
    { afterOpponentHit: afterOpponent, afterSelfCreditedHit: afterSelf, afterNeutralHit: afterNeutral });
} catch (e) { gate('F1-P04-only-mirror-owned-realized-damage', false, String(e)); }

try {
  const o = start();
  // A real T6 hit realizing MIRROR HP loss creates shards by the SAME formula;
  // the passive reacts to HP loss only and never touches the T6 object.
  o.a.takeDamage(60, o.b, 'arsenal-STORMBREAKER');
  const st = pstate(o.ct);
  const shards = st.slots.filter((s) => s && s.on);
  gate('F1-P05-t6-realized-damage-still-creates-shards',
    shards.length === 2 && shards.every((s) => s.prov && s.prov.weaponId === 'STORMBREAKER'),
    { shards: shards.length, provenanceWeapon: shards.map((s) => s.prov && s.prov.weaponId) });
} catch (e) { gate('F1-P05-t6-realized-damage-still-creates-shards', false, String(e)); }

/* F1 PROVENANCE CORRECTION — primary gate on the REAL production projectile
 * path. In a Hero-Rework match the installed projectile authority is
 * heroReworkRuntime's reworkUpdateProjectiles (it replaces
 * weaponApi.updateArsenalProjectiles): Stage B resolves the earliest body TOI
 * and feeds aqDamage the impact produced by sweptHit() = the closest point on
 * the actually-travelled segment plus the incoming leg velocity. This gate
 * therefore captures THAT live-path impact at the aqDamage boundary (the
 * transaction seam the production code itself uses) and proves the Mirror
 * shard prov inherits EXACTLY those values — never an independently
 * substituted collision model:
 *   A. live-path impact != victim center assumption
 *   B. prov.hitX/hitY exactly equal the live-path impact point
 *   C. shard bodies physically jitter around that impact point
 *   D. prov.dirX/dirY exactly equal the normalized live-path incoming leg
 *   E/F. weaponId / sourceId are the real firearm / source body identity
 *   G. all immutable fields survive 1s of real shard motion */
function fireRealBullet(o, weaponId, damage) {
  const p = { aq: true, type: 'aq_bullet',
    x: o.a.x - 200, px: o.a.x - 200, y: o.a.y, py: o.a.y,
    vx: 600, vy: 0, owner: o.b, weapon: weaponId, damage,
    life: 4, radius: 7, family: 'SEMI', color: '#ffffff', __hr: {} };
  win.projectiles.length = 0; win.projectiles.push(p);
  return p;
}
/* Observe the live Hero-Rework projectile path's own output: record the
 * impact handed to aqDamage for target o.a, passthrough to the real function,
 * restore afterwards. No geometry is substituted — the oracle IS the shipping
 * path's transaction payload. */
function captureLiveImpact(o) {
  const W = win.APEX_ARSENAL.weaponApi;
  const orig = W.aqDamage;
  const rec = { impact: null, weaponId: null, source: undefined, restore: null };
  W.aqDamage = function (target, amount, source, weaponId, opts) {
    if (target === o.a && !rec.impact && opts && opts.impact) {
      rec.impact = { x: opts.impact.x, y: opts.impact.y, vx: opts.impact.vx, vy: opts.impact.vy };
      rec.weaponId = weaponId; rec.source = source;
    }
    return orig.call(this, target, amount, source, weaponId, opts);
  };
  rec.restore = () => { W.aqDamage = orig; };
  return rec;
}
try {
  const o = start();
  // Keep both fighters well inside the arena so the bullet's start position
  // (victim.x - 200) is inside the flight boundary.
  o.a.x = 500; o.a.y = 500; o.b.x = 850; o.b.y = 500;
  T.step(DT, DT);                                   // passive state exists
  const st = pstate(o.ct);
  o.a.hp = o.a.maxHp;
  const victimX = o.a.x, victimY = o.a.y;
  const p = fireRealBullet(o, 'PISTOL', 60);
  const rec = captureLiveImpact(o);
  const hpBefore = o.a.hp;
  // Real flight: step until the live rework projectile path resolves the hit.
  let hitStep = null;
  for (let i = 1; i <= 120; i++) {
    T.step(DT, DT);
    if (onCount(st) > 0) { hitStep = i; break; }
  }
  rec.restore();
  const impact = rec.impact;
  const realized = hpBefore - o.a.hp;
  const shards = st.slots.filter((s) => s && s.on);
  const expectedN = expectedShards(realized);
  // A. the live-path contact point is NOT the victim center assumption and
  //    lies on the actually-travelled segment (closest-point property check
  //    of the captured record, not a substituted authority).
  const liveOffCenter = impact && Math.hypot(impact.x - victimX, impact.y - victimY) > 5;
  const onTravelledSegment = impact && impact.x >= p.px - 1e-9 && impact.x <= p.x + 1e-9
    && Math.abs(impact.y - p.y) <= 1e-9;
  // B. prov hit position EXACTLY equals the live-path impact point.
  const exactHitPos = impact && shards.length === expectedN && shards.every((s) =>
    s.prov && s.prov.hitX === impact.x && s.prov.hitY === impact.y);
  // C. physical shard bodies jittered around the live-path impact point
  //    (sampled on the hit frame: the passive tick runs pre-projectiles, so
  //    zero motion so far; jitter law is +-6 per axis), NOT around the victim
  //    center.
  const jitterBound = 6 * Math.SQRT2 + 1e-9;
  const bodiesAroundHit = impact && shards.every((s) =>
    Math.hypot(s.x - impact.x, s.y - impact.y) <= jitterBound);
  const bodiesNotAroundCenter = impact && shards.every((s) =>
    Math.hypot(s.x - victimX, s.y - victimY)
      > Math.hypot(impact.x - victimX, impact.y - victimY) - jitterBound - 1e-9);
  // D. prov direction EXACTLY equals the normalized live-path incoming leg.
  const il = impact ? Math.hypot(impact.vx, impact.vy) : 0;
  const exactDir = impact && il > 0 && shards.every((s) =>
    s.prov && s.prov.dirX === impact.vx / il && s.prov.dirY === impact.vy / il);
  // E/F. real firearm identity + real source body id; no inventions.
  const exactIdentity = impact && shards.every((s) =>
    s.prov && s.prov.weaponId === 'PISTOL' && s.prov.sourceId === o.b.id)
    && rec.weaponId === 'PISTOL' && rec.source === o.b;
  // Transaction hygiene: the impact marker is cleared when the transaction
  // unwinds — it cannot be read stale afterwards.
  const markerCleared = o.a.__aqImpact === null || o.a.__aqImpact === undefined;
  // G. ~1s of real shard motion later, every immutable field is unchanged.
  T.step(1.0, DT);
  const survivesMotion = impact && shards.every((s) =>
    s.on && s.prov
    && s.prov.hitX === impact.x && s.prov.hitY === impact.y
    && s.prov.dirX === impact.vx / il && s.prov.dirY === impact.vy / il
    && s.prov.weaponId === 'PISTOL' && s.prov.sourceId === o.b.id);
  const moved = impact && shards.some((s) =>
    Math.hypot(s.x - impact.x, s.y - impact.y) > jitterBound + 1);
  gate('F1-P04b-real-projectile-impact-provenance',
    !!hitStep && realized > 0 && !!impact && liveOffCenter && onTravelledSegment
    && exactHitPos && bodiesAroundHit && bodiesNotAroundCenter && exactDir
    && exactIdentity && markerCleared && survivesMotion && moved,
    { hitStep, realized: +realized.toFixed(3), shards: shards.length, expectedN,
      livePathImpact: impact && [+impact.x.toFixed(4), +impact.y.toFixed(4)],
      livePathLeg: impact && [impact.vx, impact.vy],
      victimCenter: [victimX, victimY],
      hitOffCenterBy: impact && +Math.hypot(impact.x - victimX, impact.y - victimY).toFixed(3),
      provHit: shards.map((s) => s.prov && [s.prov.hitX, s.prov.hitY]),
      provDir: shards.map((s) => s.prov && [s.prov.dirX, s.prov.dirY]),
      weapon: rec.weaponId, sourceIsOwnerBody: rec.source === o.b,
      markerCleared, survivesMotion, movedAfter1s: moved,
      note: 'oracle = the live Hero-Rework projectile path output captured at the aqDamage boundary; no base-Arsenal circle-entry substitution' });
} catch (e) { gate('F1-P04b-real-projectile-impact-provenance', false, String(e)); }

/* F1 PROVENANCE CORRECTION — mandatory fallback + STALE-IMPACT gate.
 * Damage transactions without real impact metadata fall back deterministically
 * to victim center + source->victim direction, and a stale impact from an
 * earlier real projectile hit can NEVER contaminate a later event:
 *   (1) direct damage before any impact  -> victim-center provenance
 *   (2) real projectile hit              -> impact provenance (off-center)
 *   (3) direct damage AFTER that hit     -> victim-center provenance again
 *       (would equal the old impact point if the marker leaked)
 *   (4) neutral direct damage            -> direction null, no sourceId */
try {
  const o = start();
  o.a.x = 500; o.a.y = 500; o.b.x = 850; o.b.y = 500;
  T.step(DT, DT);
  const st = pstate(o.ct);
  const clearPool = () => { st.slots.fill(null); st.nodes.length = 0; };
  const provs = () => st.slots.filter((s) => s && s.on).map((s) => s.prov);
  const srcDx = (o.a.x - o.b.x), srcDy = (o.a.y - o.b.y);
  const srcLen = Math.hypot(srcDx, srcDy);
  // (1) no-impact fallback baseline
  o.a.hp = o.a.maxHp;
  o.a.takeDamage(70, o.b, 'arsenal-PISTOL');
  const p1 = provs();
  const fallback1 = p1.length === 2 && p1.every((pr) =>
    pr && pr.hitX === o.a.x && pr.hitY === o.a.y
    && Math.abs(pr.dirX - srcDx / srcLen) <= 1e-12 && Math.abs(pr.dirY - srcDy / srcLen) <= 1e-12
    && pr.sourceId === o.b.id && pr.weaponId === 'PISTOL');
  clearPool();
  // (2) real projectile hit — impact provenance captured at the live path's
  //     aqDamage boundary; marker must be cleared when the transaction ends
  o.a.hp = o.a.maxHp;
  const p = fireRealBullet(o, 'PISTOL', 60);
  const rec = captureLiveImpact(o);
  for (let i = 1; i <= 120; i++) { T.step(DT, DT); if (onCount(st) > 0) break; }
  rec.restore();
  const impact = rec.impact;
  const p2 = provs();
  const impactProv = impact && p2.length > 0 && p2.every((pr) =>
    pr && pr.hitX === impact.x && pr.hitY === impact.y);
  const bulletHitX = impact ? impact.x : null;
  const markerClearedAfterHit = o.a.__aqImpact === null || o.a.__aqImpact === undefined;
  clearPool();
  // (3) direct damage AFTER the real impact — must be victim center again,
  //     must NOT carry the old impact point (stale-leak proof)
  o.a.hp = o.a.maxHp;
  o.a.takeDamage(70, o.b, 'arsenal-PISTOL');
  const p3 = provs();
  const noStaleLeak = bulletHitX !== null && p3.length === 2 && p3.every((pr) =>
    pr && pr.hitX === o.a.x && pr.hitY === o.a.y
    && pr.hitX !== bulletHitX
    && Math.abs(pr.dirX - srcDx / srcLen) <= 1e-12 && Math.abs(pr.dirY - srcDy / srcLen) <= 1e-12);
  clearPool();
  // (4) neutral damage: no impact, no source -> direction null, no sourceId
  o.a.hp = o.a.maxHp;
  o.a.takeDamage(70, null, 'arsenal-PISTOL');
  const p4 = provs();
  const neutralFallback = p4.length === 2 && p4.every((pr) =>
    pr && pr.hitX === o.a.x && pr.hitY === o.a.y
    && pr.dirX === null && pr.dirY === null && pr.sourceId === null);
  gate('F1-P04c-no-impact-fallback-and-stale-impact-cannot-leak',
    fallback1 && impactProv && bulletHitX !== null && Math.abs(bulletHitX - o.a.x) > 5
    && markerClearedAfterHit && noStaleLeak && neutralFallback,
    { fallback1: { n: p1.length, hit: p1[0] && [p1[0].hitX, p1[0].hitY], victimCenter: [o.a.x, o.a.y] },
      impact: { n: p2.length, livePathHit: impact && [impact.x, impact.y], provHit: p2[0] && [p2[0].hitX, p2[0].hitY] },
      markerClearedAfterHit,
      afterHitDirectDamage: { n: p3.length, hit: p3[0] && [p3[0].hitX, p3[0].hitY], staleBulletHitX: bulletHitX },
      neutral: { n: p4.length, dir: p4[0] && [p4[0].dirX, p4[0].dirY], sourceId: p4[0] && p4[0].sourceId },
      note: 'victim-center/source-direction fallback is deterministic; a previous real impact never leaks into a later non-impact transaction' });
} catch (e) { gate('F1-P04c-no-impact-fallback-and-stale-impact-cannot-leak', false, String(e)); }

/* ============ PER-OWNER POOL LAW (P06-P10) ============ */
try {
  const o = start();
  const api = HR.match.api;
  const made = [];
  for (let i = 0; i < 20; i++) made.push(api.mirrorShardProc(o.ct, 500, 500, 1, null)[0]);
  const st = pstate(o.ct);
  // All 20 probes ran with zero ticks, so every FREE age is tied at 0 and the
  // oldest-FREE law degenerates to the FIRST free slot (Gold's !old tie rule):
  // requests 17-20 all landed in slot 0, replacing each other.
  const firstSlotIsLastSpawn = st.slots[0] === made[19];
  const survivors = made.filter((s) => s && st.slots.includes(s)).length;
  gate('F1-P06-P07-pool-16-and-oldest-free-replacement',
    st.slots.length === 16 && onCount(st) === 16 && freeCount(st) === 16
    && firstSlotIsLastSpawn && survivors === 16,
    { slotCount: st.slots.length, onCount: onCount(st), free: freeCount(st),
      liveShardsSurviving: survivors, firstSlotIsRequest20: firstSlotIsLastSpawn,
      note: '20 spawn requests -> exactly 16 live FREE shards; overflow replaced the oldest FREE slot, never grew the pool' });
} catch (e) { gate('F1-P06-P07-pool-16-and-oldest-free-replacement', false, String(e)); }

try {
  const o = start();
  const api = HR.match.api;
  // Form one node (5 reserved), then fill the remaining 11 slots with FREE
  // shards of distinct ages. A new spawn must replace the OLDEST FREE and
  // never touch a reserved/node-owned slot.
  placeCluster(o.ct, 300, 500, TIGHT5, 0.8);
  T.step(DT, DT);                                  // first scan reserves the five
  const st = pstate(o.ct);
  const node = st.nodes[0];
  const reserved = node ? node.sh.slice() : [];
  for (let i = 0; i < 11; i++) {
    const s = api.mirrorShardProc(o.ct, 700, 200 + i * 30, 1, null)[0];
    s.age = 0.05 * (i + 1);                        // 0.05 .. 0.55 (ineligible)
  }
  const oldestFree = st.slots.filter((s) => s && s.st === 0).sort((a, b) => b.age - a.age)[0];
  const oldestIdx = st.slots.indexOf(oldestFree);
  const before = onCount(st);
  const probe = api.mirrorShardProc(o.ct, 500, 500, 1, null)[0];
  gate('F1-P08-full-pool-never-steals-reserved',
    !!node && reserved.length === 5 && before === 16
    && onCount(st) === 16 && probe && st.slots.indexOf(probe) === oldestIdx
    && reserved.every((s) => s.on && s.st !== 0 && s.node === node),
    { nodeOwnedIntact: reserved.filter((s) => s.on && s.node === node).length,
      probeReplacedOldestFree: probe ? st.slots.indexOf(probe) === oldestIdx : false,
      onCount: onCount(st) });
} catch (e) { gate('F1-P08-full-pool-never-steals-reserved', false, String(e)); }

try {
  const o = start();
  const api = HR.match.api;
  // Three nodes own 15 slots plus one lone FREE shard. Mark that last shard
  // reserved via the documented test seam so the DROP GUARD (Gold: nothing
  // replaceable -> new shard dropped) is exercised — a state the 16/5 economy
  // can never reach naturally.
  for (const [cx, cy] of [[250, 250], [750, 250], [250, 750]]) placeCluster(o.ct, cx, cy, TIGHT5, 0.8);
  T.step(0.9, DT);                                 // three scans -> three nodes
  api.mirrorShardProc(o.ct, 500, 900, 1, null);    // lone free shard (slot 16)
  const st = pstate(o.ct);
  const loneFree = st.slots.find((s) => s && s.st === 0);
  loneFree.st = 1;                                 // seam: simulate fully-owned pool
  const dropped = api.mirrorShardProc(o.ct, 500, 500, 5, null);
  loneFree.st = 0;
  gate('F1-P09-no-replaceable-free-slot-drops-shard',
    st.nodes.length === 3 && ownedCount(st) === 15 && dropped.length === 0 && onCount(st) === 16,
    { nodes: st.nodes.length, owned: ownedCount(st), droppedSpawned: dropped.length, onCount: onCount(st) });
} catch (e) { gate('F1-P09-no-replaceable-free-slot-drops-shard', false, String(e)); }

try {
  const o = start();
  HR.match.api.mirrorShardProc(o.ct, 500, 500, 1, null);
  T.step(6.0 - 3 * DT, DT);
  const aliveBefore = freeCount(pstate(o.ct));
  T.step(4 * DT, DT);                              // crosses the 6s FREE edge
  const aliveAfter = freeCount(pstate(o.ct));
  gate('F1-P10-free-shard-expires-at-6s',
    aliveBefore === 1 && aliveAfter === 0,
    { at5p997s: aliveBefore, at6p01s: aliveAfter });
} catch (e) { gate('F1-P10-free-shard-expires-at-6s', false, String(e)); }

/* ============ FORMATION ELIGIBILITY / TOPOLOGY (P11-P20) ============ */
try {
  const o = start();
  // Five shards sitting at age EXACTLY .7 (0.7 - DT so the pre-scan aging
  // tick lands them on 0.7): strictly-greater gate must reject them.
  placeCluster(o.ct, 500, 500, TIGHT5, 0.7 - DT);
  T.step(DT, DT);                                  // first scan: age == .7 exactly
  const nodesAtExact = pstate(o.ct).nodes.length;  // snapshot BEFORE later steps mutate
  T.step(0.3 + DT, DT);                            // next scan on the cadence: age > .7
  const nodesAfter = pstate(o.ct).nodes.length;
  gate('F1-P11-P12-age-gate-strictly-greater',
    nodesAtExact === 0 && nodesAfter === 1,
    { nodesAtAgeExactlyPoint7: nodesAtExact, nodesAtNextScan: nodesAfter });
} catch (e) { gate('F1-P11-P12-age-gate-strictly-greater', false, String(e)); }

try {
  const o = start();
  // Warm to an exact scan-grid point: scans fire at t = DT + 0.3k.
  T.step(0.6, DT);                                 // clock 0.6 -> next tick is the DT+0.6 grid point
  const ev = captureSeq(['MirrorNodeForming']);
  const tSpawn = win.matchClock;
  placeCluster(o.ct, 500, 500, TIGHT5, 0);         // age 0 at spawn
  // Per-frame scanning would form at ~tSpawn+0.708; the 0.3s cadence forms at
  // the first grid point past age .7: t = DT + 1.5 (= tSpawn + 0.9).
  T.step(1.0, DT);
  const formed = ev()[0];
  const dtForm = formed ? formed.t - tSpawn : null;
  gate('F1-P13-scan-cadence-0p3-not-immediate-not-per-frame',
    !!formed && dtForm !== null && close(dtForm, 0.9, 2.5 * DT),
    { formedAtDeltaS: dtForm === null ? null : +dtForm.toFixed(5),
      expectedCadencePoint: 0.9, immediateOrPerFrameWindow: '(0, 0.75]',
      note: 'formation lands exactly on the 0.3s scan grid, never at spawn' });
} catch (e) { gate('F1-P13-scan-cadence-0p3-not-immediate-not-per-frame', false, String(e)); }

try {
  const o = start('MIRROR', 'MIRROR');
  // P1: a full eligible cluster. P2: only 4 own eligible shards plus one P1
  // shard sitting inside the P2 cluster — P2 must NOT borrow it.
  placeCluster(o.ct, 250, 500, TIGHT5, 0.8);
  placeCluster(o.ctB, 750, 500, TIGHT5.slice(0, 4), 0.8);
  const stray = HR.match.api.mirrorShardProc(o.ct, 750, 560, 1, null)[0];
  stray.age = 0.8;
  T.step(DT, DT);
  const stA = pstate(o.ct), stB = pstate(o.ctB);
  gate('F1-P14-same-owner-only-no-cross-form',
    stA.nodes.length === 1 && stB.nodes.length === 0
    && stA.nodes[0].owner === o.ct
    && stray.on && stray.st === 0,
    { p1Nodes: stA.nodes.length, p2Nodes: stB.nodes.length,
      p1NodeOwnerIsP1: stA.nodes[0] && stA.nodes[0].owner === o.ct,
      strayStillFreeInP1Pool: stray.on && stray.st === 0 });
} catch (e) { gate('F1-P14-same-owner-only-no-cross-form', false, String(e)); }

try {
  const o = start();
  // Seed-radius topology, NOT all-pairs: four neighbors at 160px in the four
  // cardinal directions are 320px apart from each other (>170), yet the seed
  // sees all four within 170 -> formation MUST succeed.
  placeCluster(o.ct, 500, 500, [[0, 0], [160, 0], [-160, 0], [0, 160], [0, -160]], 0.8);
  T.step(DT, DT);
  const st = pstate(o.ct);
  gate('F1-P15-P17-P18-seed-radius-fourth-nearest-lt-170',
    st.nodes.length === 1 && st.nodes[0].sh.length === 5,
    { nodes: st.nodes.length, note: 'neighbors mutually 320px apart (>170): all-pairs law would fail, seed law forms' });
} catch (e) { gate('F1-P15-P17-P18-seed-radius-fourth-nearest-lt-170', false, String(e)); }

try {
  const o = start();
  // Chain spaced EXACTLY 170px: every seed's fourth-nearest is >= 170.
  placeCluster(o.ct, 160, 500, [[0, 0], [170, 0], [340, 0], [510, 0], [680, 0]], 0.8);
  T.step(DT, DT); T.step(0.3 + DT, DT);
  const st = pstate(o.ct);
  gate('F1-P16-fourth-nearest-eq-170-fails-strictly',
    st.nodes.length === 0 && freeCount(st) === 5,
    { nodes: st.nodes.length, free: freeCount(st) });
} catch (e) { gate('F1-P16-fourth-nearest-eq-170-fails-strictly', false, String(e)); }

try {
  const o = start();
  // Two overlapping candidate clusters: one scan may reserve ONE group only;
  // the other must remain entirely FREE (no double claim, immediate reserve).
  placeCluster(o.ct, 300, 500, TIGHT5, 0.8);
  placeCluster(o.ct, 340, 500, TIGHT5, 0.8);
  const st = pstate(o.ct);
  const second = st.slots.filter((s) => s && s.on).slice(5);
  T.step(DT, DT);
  gate('F1-P19-immediate-reservation-no-double-claim',
    pstate(o.ct).nodes.length === 1
    && pstate(o.ct).nodes[0].sh.length === 5
    && second.every((s) => s.on && s.st === 0),
    { nodes: pstate(o.ct).nodes.length, secondClusterStillFree: second.every((s) => s.on && s.st === 0) });
} catch (e) { gate('F1-P19-immediate-reservation-no-double-claim', false, String(e)); }

try {
  const o = start();
  placeCluster(o.ct, 500, 500, TIGHT5, 0.8);
  T.step(DT, DT);
  const st = pstate(o.ct);
  const node = st.nodes[0];
  T.step(7.0, DT);                                 // far past the 6s FREE lifetime
  gate('F1-P20-reserved-shards-do-not-free-expire',
    !!node && st.nodes.includes(node) && node.sh.every((s) => s.on && s.st !== 0),
    { nodeAlive: !!node && st.nodes.includes(node),
      ownedShardsAlive: node ? node.sh.filter((s) => s.on).length : 0, nodeState: node && node.st });
} catch (e) { gate('F1-P20-reserved-shards-do-not-free-expire', false, String(e)); }

/* ============ NODE TRANSFORM / ASSEMBLY (P21-P30) ============ */
try {
  const o = start();
  const pts = [[400, 400], [410, 410], [420, 420], [430, 400], [410, 430]];
  placeCluster(o.ct, 0, 0, pts, 0.8);
  T.step(DT, DT);
  const node = pstate(o.ct).nodes[0];
  const cx = pts.reduce((s, p) => s + p[0], 0) / 5;
  const cy = pts.reduce((s, p) => s + p[1], 0) / 5;
  gate('F1-P21-centroid-from-five-shards',
    !!node && close(node.x, cx, 1e-9) && close(node.y, cy, 1e-9),
    { node: node && [+node.x.toFixed(4), +node.y.toFixed(4)], centroid: [cx, cy] });
} catch (e) { gate('F1-P21-centroid-from-five-shards', false, String(e)); }

try {
  const o = start();
  // Cluster hard in the arena corner: the clamped center must keep the whole
  // transformed NV polygon inside the real arena [0, GAME_SIZE].
  placeCluster(o.ct, 0, 0, [[40, 40], [50, 45], [45, 55], [60, 40], [40, 60]], 0.8);
  T.step(DT, DT);
  const node = pstate(o.ct).nodes[0];
  const S = win.GAME_SIZE || 1000;
  const poly = HR.mirrorNode.polygon(node);
  const inside = poly.every((p) => p.x >= -1e-9 && p.x <= S + 1e-9 && p.y >= -1e-9 && p.y <= S + 1e-9);
  const rawCx = 47, rawCy = 48;
  gate('F1-P22-corner-centroid-clamp-keeps-surface-inside-arena',
    !!node && inside && Math.hypot(node.x - rawCx, node.y - rawCy) > 1,
    { nodeCenter: node && [+node.x.toFixed(2), +node.y.toFixed(2)], rawCentroid: [rawCx, rawCy],
      polygonInsideArena: inside, arena: S });
} catch (e) { gate('F1-P22-corner-centroid-clamp-keeps-surface-inside-arena', false, String(e)); }

try {
  async function oriented(seed) {
    const o = start();
    win.APEX_HERO_REWORK.setSeed(seed);
    placeCluster(o.ct, 500, 500, TIGHT5, 0.8);
    T.step(DT, DT);
    return pstate(o.ct).nodes[0].rot;
  }
  const r1a = await oriented(4242);
  const r1b = await oriented(4242);
  const r2 = await oriented(97531);
  gate('F1-P23-P24-seeded-orientation-deterministic-bounded',
    close(r1a, r1b, 1e-12) && Math.abs(r1a) <= 0.35 + 1e-9 && Math.abs(r2) <= 0.35 + 1e-9 && r1a !== r2,
    { seed4242: [+r1a.toFixed(6), +r1b.toFixed(6)], seed97531: +r2.toFixed(6), range: '[-0.35, 0.35]' });
} catch (e) { gate('F1-P23-P24-seeded-orientation-deterministic-bounded', false, String(e)); }

/* F1-CLOSURE item 2 — AUTHORED .40s TRAVEL LAW PROOF.
 * Ease-out visually approaches the target early, so a loose arrival radius
 * cannot prove the law. This gate proves it structurally, in NODE time:
 *   (a) mt0 = .18 + i*.06 exactly, in travel-distance order;
 *   (b) the interpolation is still in-flight (>1e-6px out) at every sample
 *       before the mt0+.40 boundary — ease-out never satisfies a strict
 *       tolerance early;
 *   (c) canonical completion occurs at the FIRST fixed-step sample whose
 *       node.t has crossed mt0+.40 (clamp drives p to exactly 1 there);
 *   (d) tlock is set by the LAST shard's completion (~.82 fixed-step
 *       realization), with no extra delay. */
try {
  const o = start();
  // Five shards at distinct, non-trivial travel distances so the in-flight
  // residue one step before completion is comfortably above the strict 1e-6.
  placeCluster(o.ct, 0, 0, [[300, 500], [380, 470], [450, 540], [520, 480], [590, 520]], 0.8);
  T.step(DT, DT);                                   // reserve
  const node = pstate(o.ct).nodes[0];
  const shards = node.sh.slice();                   // travel-ordered
  const ARRIVED = 1e-9, INFLIGHT = 1e-6;
  const completionT = shards.map(() => null);
  const startT = shards.map(() => null);
  // Last sample observed STRICTLY before the shard's mt0+.40 boundary:
  // proves the interpolation is still in flight up to the boundary itself.
  const lastSubBoundary = shards.map(() => null);
  for (let i = 0; i < 120; i++) {
    T.step(DT, DT);
    const t = node.t;
    shards.forEach((s, k) => {
      if (startT[k] === null && s.moving) startT[k] = t;
      const d = Math.hypot(s.x - s.tx, s.y - s.ty);
      if (completionT[k] === null) {
        if (t < s.mt0 + 0.4) lastSubBoundary[k] = { t, d };
        if (d <= ARRIVED) completionT[k] = t;
      }
    });
    if (node.tlock >= 0) break;
  }
  const okMt0 = shards.every((s, k) => close(s.mt0, 0.18 + k * 0.06, 1e-9));
  const okStarts = shards.every((s, k) => startT[k] !== null && close(startT[k], s.mt0, DT + 1e-9));
  const okNoEarlyArrival = shards.every((s, k) => completionT[k] !== null
    && completionT[k] >= s.mt0 + 0.4 - 1e-9);
  const okFirstCrossing = shards.every((s, k) => completionT[k] !== null
    && completionT[k] <= s.mt0 + 0.4 + DT + 1e-9);
  const okInFlightBeforeBoundary = shards.every((s, k) => {
    const m = lastSubBoundary[k];
    return m !== null && m.d > INFLIGHT && m.t > s.mt0          // moved, still out, strictly before boundary
      && s.mt0 + 0.4 - m.t <= DT + 1e-9;                        // ...at the final sub-boundary sample
  });
  const okTlockFollowsLast = (() => {
    const last = Math.max(...completionT);
    return node.tlock >= last - 1e-9 && node.tlock <= last + DT + 1e-9
      && close(node.tlock, 0.82, 2 * DT);
  })();
  gate('F1-P25-P27-assembly-mt0-inflight-canonical-completion-tlock',
    okMt0 && okStarts && okNoEarlyArrival && okFirstCrossing
    && okInFlightBeforeBoundary && okTlockFollowsLast,
    { mt0: shards.map((s) => +s.mt0.toFixed(2)),
      startsNodeTime: startT.map((x) => x === null ? null : +x.toFixed(4)),
      completionNodeTime: completionT.map((x) => x === null ? null : +x.toFixed(4)),
      boundary: shards.map((s) => +(s.mt0 + 0.4).toFixed(2)),
      lastSubBoundaryResiduePx: shards.map((s, k) => lastSubBoundary[k] ? +lastSubBoundary[k].d.toFixed(6) : null),
      tlock: +node.tlock.toFixed(4), expectedTlock: 0.82,
      note: 'completion at the first fixed-step crossing of mt0+.40; still >1e-6px out one step earlier; tlock set by the last completion' });
} catch (e) { gate('F1-P25-P27-assembly-mt0-inflight-canonical-completion-tlock', false, String(e)); }

try {
  const o = start();
  placeCluster(o.ct, 500, 500, TIGHT5, 0);
  const ev = captureSeq(['MirrorNodeForming', 'MirrorNodeActive']);
  T.step(0.5, DT);
  const earlyActive = ev().some((e) => e.type === 'MirrorNodeActive');
  T.step(2.0, DT);
  const formed = ev().find((e) => e.type === 'MirrorNodeForming');
  const act = ev().find((e) => e.type === 'MirrorNodeActive');
  const dtActive = formed && act ? act.t - formed.t : null;
  gate('F1-P28-P29-active-at-1p20-not-early',
    !earlyActive && !!act && dtActive !== null && dtActive > 1.18 && dtActive < 1.26,
    { activeAfterFormS: dtActive === null ? null : +dtActive.toFixed(5), earlyAt0p5: earlyActive,
      canonical: '~1.20 (tlock 0.82 + 0.38 + fixed-step edge)' });
} catch (e) { gate('F1-P28-P29-active-at-1p20-not-early', false, String(e)); }

try {
  const o = start();
  placeCluster(o.ct, 500, 500, TIGHT5, 0.8);
  T.step(DT, DT);
  const node = pstate(o.ct).nodes[0];
  T.step(1.4, DT);                                  // comfortably ACTIVE
  const surf = HR.mirrorNode.surface(node);
  const c = Math.cos(node.rot), s = Math.sin(node.rot);
  const v0 = [-5, -60], v3 = [0, 62];
  const expA = { x: node.x + v0[0] * c - v0[1] * s, y: node.y + v0[0] * s + v0[1] * c };
  const expB = { x: node.x + v3[0] * c - v3[1] * s, y: node.y + v3[0] * s + v3[1] * c };
  gate('F1-P30-shared-transform-v0-v3-surface',
    node.st === 2
    && close(surf.ax, expA.x) && close(surf.ay, expA.y)
    && close(surf.bx, expB.x) && close(surf.by, expB.y)
    && HR.mirrorNode.NV.length === 5,
    { surface: Object.fromEntries(Object.entries(surf).map(([k, v]) => [k, +v.toFixed(3)])),
      NV: HR.mirrorNode.NV, nodeActive: node.st === 2 });
} catch (e) { gate('F1-P30-shared-transform-v0-v3-surface', false, String(e)); }

/* ============ LIFECYCLE / ECONOMY (P31-P40) ============ */
try {
  const o = start();
  placeCluster(o.ct, 500, 500, TIGHT5, 0.8);
  T.step(DT, DT);
  const st = pstate(o.ct);
  const node = st.nodes[0];
  const formClock = win.matchClock;
  T.step(1.4, DT);
  const activeClock = node.activeAtClock;
  T.step(9.7, DT);                                  // ACTIVE age ~9.7
  const stillActive = node.st === 2;
  T.step(0.5, DT);                                  // ACTIVE age crosses 10
  const folded = node.st === 3;
  gate('F1-P31-P33-active-clock-starts-at-active-folds-at-10',
    stillActive && folded && activeClock > 0
    && close(activeClock - formClock, 1.2, 0.06)
    && node.t3 >= 0 && node.t3 < 0.55,
    { activeAtAfterFormS: +(activeClock - formClock).toFixed(4),
      stillActiveAtActiveAge9p7: stillActive, foldEntered: folded,
      note: 'fold clock starts at ACTIVE+10, never at reservation' });
} catch (e) { gate('F1-P31-P33-active-clock-starts-at-active-folds-at-10', false, String(e)); }

try {
  const o = start();
  placeCluster(o.ct, 500, 500, TIGHT5, 0.8);
  T.step(DT, DT);
  const st = pstate(o.ct);
  const node = st.nodes[0];
  const five = node.sh.slice();
  T.step(11.25, DT);                                // ACTIVE done, early in fold
  const midFold = node.st === 3 && node.t3 > 0 && node.t3 < 0.54;
  const midFoldT3Sample = +node.t3.toFixed(3);
  const ownedMidFoldSample = five.filter((s) => s.on).length;
  const heldMidFold = midFold && five.every((s) => s.on && s.st === 3)
    && st.slots.filter((z) => z && z.on).length === 5;
  T.step(0.55, DT);                                 // t3 crosses 0.55
  const offAfter = !st.nodes.includes(node)
    && five.every((s) => !s.on)
    && st.slots.every((z) => !z);
  gate('F1-P34-P36-fold-holds-then-node-and-five-slots-off',
    midFold && heldMidFold && offAfter,
    { midFoldState: node.st, midFoldT3: midFoldT3Sample,
      ownedMidFold: ownedMidFoldSample,
      nodeGoneAfter0p55: !st.nodes.includes(node), slotsOffAfter: st.slots.every((z) => !z),
      note: 'no return-to-free; the five shards are OFF, not fresh FREE' });
} catch (e) { gate('F1-P34-P36-fold-holds-then-node-and-five-slots-off', false, String(e)); }

try {
  const o = start();
  const clusters = [[250, 250], [750, 250], [250, 750]];
  for (const [cx, cy] of clusters) placeCluster(o.ct, cx, cy, TIGHT5, 0.8);
  T.step(0.9, DT);                                  // one formation per scan
  const st = pstate(o.ct);
  const threeNodes = st.nodes.length === 3;
  const owned15 = ownedCount(st) === 15;
  // Three nodes own 15 of 16 slots: exactly ONE slot remains open.
  const oneSlotOpen = onCount(st) === 15 && st.slots.filter((z) => !z).length === 1;
  // A fourth cluster arrives later: only ONE of its shards even fits the pool
  // (filling/replacing the single open slot) — the economy blocks it at the root.
  placeCluster(o.ct, 750, 750, TIGHT5, 0);
  T.step(2.0, DT);                                  // plenty of scans, ages > .7
  gate('F1-P37-P40-16-5-economy-three-nodes-fourth-unproducible',
    threeNodes && owned15 && oneSlotOpen
    && st.nodes.length === 3                        // no fourth node EVER
    && st.nodes.every((n) => n.st === 1 || n.st === 2)  // none retired/folded early
    && freeCount(st) + ownedCount(st) === 16,
    { nodesAfterFourthCluster: st.nodes.length, owned: ownedCount(st), free: freeCount(st),
      nodeStates: st.nodes.map((n) => n.st),
      note: 'no node-count cap branch, no retirement — the pool math is the cap' });
} catch (e) { gate('F1-P37-P40-16-5-economy-three-nodes-fourth-unproducible', false, String(e)); }

/* ============ INTEROP / SAFETY (P41-P45) ============ */
try {
  const o = start();
  placeCluster(o.ct, 500, 500, TIGHT5, 0.8);
  T.step(1.4, DT);                                  // node ACTIVE at the center
  const node = pstate(o.ct).nodes[0];
  const ev = captureSeq(['MirrorPortalRoute']);
  // A real arsenal bullet crosses the ACTIVE node's surface region.
  const p = { aq: true, type: 'aq_bullet', x: 300, y: 500, px: 300, py: 500,
    vx: 900, vy: 0, owner: o.b, weapon: 'PISTOL', damage: 5, life: 3, radius: 7, __hr: {} };
  win.projectiles.length = 0; win.projectiles.push(p);
  const x0 = p.x;
  T.step(0.35, DT);
  const expectedX = x0 + 900 * 0.35;
  gate('F1-P41-active-node-never-routes-projectile',
    node.st === 2 && ev().length === 0
    && win.projectiles.includes(p) && !p.__hr.neutral
    && close(p.x, expectedX, 900 * 2 * DT + 1) && p.life > 2.6
    && win.APEX_HERO_REWORK.match.world.mirrors.length === 0,
    { nodeState: node.st, portalRouteEvents: ev().length, neutral: !!p.__hr.neutral,
      bulletX: +p.x.toFixed(1), expectedX: +expectedX.toFixed(1), life: +p.life.toFixed(3),
      legacyMirrorsInWorld: win.APEX_HERO_REWORK.match.world.mirrors.length,
      note: 'F2 routing is NOT implemented; the projectile stays an ordinary WORLD object' });
} catch (e) { gate('F1-P41-active-node-never-routes-projectile', false, String(e)); }

try {
  const o = start('MIRROR', 'MIRROR');
  const p1c = [[200, 200], [400, 200], [200, 400]];
  const p2c = [[800, 200], [600, 200], [800, 400]];
  for (const [cx, cy] of p1c) placeCluster(o.ct, cx, cy, TIGHT5, 0.8);
  for (const [cx, cy] of p2c) placeCluster(o.ctB, cx, cy, TIGHT5, 0.8);
  T.step(0.9, DT);
  const stA = pstate(o.ct), stB = pstate(o.ctB);
  const p1Own = stA.nodes.every((n) => n.owner === o.ct) && stA.nodes.length === 3;
  const p2Own = stB.nodes.every((n) => n.owner === o.ctB) && stB.nodes.length === 3;
  const p1Left = stA.nodes.every((n) => n.x < 500);
  const p2Right = stB.nodes.every((n) => n.x > 500);
  gate('F1-P42-P44-mirror-vs-mirror-independent-pools-no-global-cap',
    p1Own && p2Own && p1Left && p2Right
    && ownedCount(stA) === 15 && ownedCount(stB) === 15,
    { p1Nodes: stA.nodes.length, p2Nodes: stB.nodes.length,
      totalConcurrentNodes: stA.nodes.length + stB.nodes.length,
      p1Owned: ownedCount(stA), p2Owned: ownedCount(stB),
      note: '6 concurrent nodes across two owners — no global cap 3, no cross-owner reservation' });
} catch (e) { gate('F1-P42-P44-mirror-vs-mirror-independent-pools-no-global-cap', false, String(e)); }

try {
  const o = start();
  placeCluster(o.ct, 500, 500, TIGHT5, 0.8);
  T.step(1.4, DT);                                  // ACTIVE node + live shards exist
  const dirtyBefore = pstate(o.ct).nodes.length === 1;
  win.exitArsenalQuestMode();
  const o2 = start();
  const freshState = pstate(o2.ct);
  T.step(DT, DT);                                   // first passive tick of the new match
  const st2 = pstate(o2.ct);
  gate('F1-P45-teardown-rematch-leaves-nothing-behind',
    dirtyBefore && (freshState === null || (freshState.nodes.length === 0 && onCount(freshState) === 0))
    && st2.nodes.length === 0 && onCount(st2) === 0
    && win.APEX_HERO_REWORK.match.world.mirrors.length === 0
    && win.APEX_HERO_REWORK.match.world.shards.length === 0,
    { stateBeforeExit: dirtyBefore ? 'ACTIVE node + owned shards' : 'MISSING',
      rematchNodes: st2.nodes.length, rematchShards: onCount(st2),
      legacyWorldClean: win.APEX_HERO_REWORK.match.world.mirrors.length === 0 });
} catch (e) { gate('F1-P45-teardown-rematch-leaves-nothing-behind', false, String(e)); }

fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/f1-passive-formation.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), checkpoint: 'F1', ...report, pass: report.failures.length === 0 }, null, 2));
const total = Object.keys(report.gates).length;
console.log(`\n[MIRROR F1 PASSIVE FORMATION] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
