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

/* spawn provenance: real hit direction drives the scatter base direction */
try {
  const o = start();
  // Source far to the WEST: Gold scatter spreads around source->victim (+x).
  o.b.x = 150; o.a.x = 850;
  o.a.takeDamage(60, o.b, 'arsenal-PISTOL');
  const st = pstate(o.ct);
  const shards = st.slots.filter((s) => s && s.on);
  const meanVx = shards.reduce((s, z) => s + z.vx, 0) / shards.length;
  const speeds = shards.map((z) => Math.hypot(z.vx, z.vy));
  gate('F1-P04b-spawn-provenance-from-real-hit',
    shards.length === 2 && meanVx > 0
    && speeds.every((sp) => sp >= 100 - 1e-6 && sp <= 175 + 1e-6),
    { shards: shards.length, meanVx: +meanVx.toFixed(1), speeds: speeds.map((s) => +s.toFixed(1)),
      note: 'scatter base direction = real source->victim direction; speeds are Gold 100..175' });
} catch (e) { gate('F1-P04b-spawn-provenance-from-real-hit', false, String(e)); }

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

try {
  const o = start();
  // Five shards at distinct distances from the node center so travel-distance
  // order is unambiguous.
  placeCluster(o.ct, 0, 0, [[300, 500], [380, 470], [450, 540], [520, 480], [590, 520]], 0.8);
  T.step(DT, DT);                                   // reserve
  const node = pstate(o.ct).nodes[0];
  const shards = node.sh.slice();                   // already travel-ordered
  const starts = shards.map(() => null);
  const arrivals = shards.map(() => null);
  let t = 0;
  for (let i = 0; i < 100; i++) {
    T.step(DT, DT); t += DT;
    shards.forEach((s, k) => {
      if (starts[k] === null && s.moving) starts[k] = t;
      if (arrivals[k] === null && s.moving
        && Math.hypot(s.x - s.tx, s.y - s.ty) < 0.75) arrivals[k] = t;
    });
  }
  const okStarts = shards.every((s, k) => starts[k] !== null && close(starts[k], s.mt0, 2 * DT));
  const okStagger = shards.every((s, k) => close(s.mt0, 0.18 + k * 0.06, 1e-9));
  // Travel is EXACTLY .40 by construction: every shard reached its edge target
  // inside its own window (last arrival ≈ mt0(4)+.4 = .82), none before.
  const okTravel = shards.every((s, k) => arrivals[k] !== null
    && arrivals[k] <= s.mt0 + 0.4 + 2 * DT && arrivals[k] >= s.mt0 + 0.2);
  const okLock = node.tlock > 0 && close(node.tlock, 0.82, 4 * DT);
  gate('F1-P25-P27-assembly-stagger-travel-and-lock',
    okStarts && okStagger && okTravel && okLock,
    { starts: starts.map((x) => x === null ? null : +x.toFixed(4)),
      mt0: shards.map((s) => +s.mt0.toFixed(2)),
      travelDurations: shards.map((s, k) => arrivals[k] === null || starts[k] === null ? null : +(arrivals[k] - starts[k]).toFixed(4)),
      tlock: +node.tlock.toFixed(4), expectedTlock: 0.82 });
} catch (e) { gate('F1-P25-P27-assembly-stagger-travel-and-lock', false, String(e)); }

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
