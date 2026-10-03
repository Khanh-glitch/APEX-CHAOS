#!/usr/bin/env node
/* R3 — real shipping A2 receiver-only history rebasing and physical-key closure. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
const GOLD = win.APEX_MIRROR_GOLD;
const bus = win.APEX_HERO_REWORK_AIL.bus;
const STEP = 1 / 120;
const goldInstances = [];
const historyOperations = [];
const exchangeDeliveries = [];
let passed = 0;
const passedGates = [];

function gate(name, fn) {
  fn(); passed++; passedGates.push(name);
  console.log(`PASS R3 ${String(passed).padStart(2, '0')} ${name}`);
}
function stepFrames(count) { for (let i = 0; i < count; i++) T.step(STEP, STEP); }
function eventsAfter(seq, type) { return bus.since(seq).filter((event) => event.type === type); }
function close(a, b, eps = 1e-8) { return Math.abs(a - b) <= eps; }
function activeGolds() { return goldInstances.filter((gold) => gold.externalTruth); }
function byBodyId(bodyId) { return activeGolds().find((gold) => gold.M.id === bodyId); }
function actorFor(event, id) { return [event && event.self, event && event.opponent].find((actor) => actor && actor.id === id) || null; }
function stateSnapshot(gold) {
  return {
    gold,
    history: Array.from(gold.hist),
    hHead: gold.hHead,
    historyRebases: gold.externalPassiveAudit().historyRebases,
    snaps: gold.externalAudit().snaps,
    exchanges: gold.externalAudit().exchanges,
    a2On: gold.A2.on,
    a2Res: gold.A2.res,
    a2Band: gold.A2.band,
    a2Ghost: gold.A2.ghostA,
    a2Tear: gold.A2.tear,
    roots: [gold.M.x, gold.M.y, gold.F.x, gold.F.y],
  };
}
function expectedRebase(history, gold, event, mirrorId) {
  const actor = actorFor(event, mirrorId);
  assert.ok(actor, `physical exchange includes Gold root ${mirrorId}`);
  const dx = actor.to.x - actor.from.x, dy = actor.to.y - actor.from.y;
  const out = Float32Array.from(history);
  for (let i = 0; i < gold.HN; i++) {
    const o = i * gold.HS;
    out[o] += dx; out[o + 1] += dy;
    out[o + 20] -= dx; out[o + 21] -= dy;
  }
  return Array.from(out);
}
function physicalKey(event) {
  const rows = [event.self, event.opponent].map((actor) => [typeof actor.id, String(actor.id),
    actor.from.x === 0 ? 0 : actor.from.x, actor.from.y === 0 ? 0 : actor.from.y,
    actor.to.x === 0 ? 0 : actor.to.x, actor.to.y === 0 ? 0 : actor.to.y]);
  rows.sort((a, b) => (a[0] + ':' + a[1]).localeCompare(b[0] + ':' + b[1]));
  return JSON.stringify(rows);
}
function canonicalCoalescedSamples(event) {
  if (!(Number.isFinite(event.coalesced) && event.coalesced > 0)) return event;
  return { ...event,
    self: { ...event.self, from: { x: event.opponent.to.x, y: event.opponent.to.y } },
    opponent: { ...event.opponent, from: { x: event.self.to.x, y: event.self.to.y } },
  };
}
function reversePhysicalNotice(event, castId) {
  return { ...event, castId, coalesced: (event.coalesced || 0) + 17,
    self: event.opponent, opponent: event.self,
    delta: { x: -event.delta.x, y: -event.delta.y } };
}
function deliveryFor(payload) { return exchangeDeliveries.find((row) => row.payload === payload); }
function operationFor(gold, kind, event, result = undefined) {
  return historyOperations.find((op) => op.gold === gold && op.kind === kind
    && (op.event === event || op.event && event && op.event.castId === event.castId)
    && (result === undefined || op.result === result));
}
function sameHistory(a, b, message) { assert.deepEqual(a, b, message); }
function assertRoot(gold, mirror, opponent) {
  const audit = gold.externalAudit();
  assert.deepEqual([audit.mirror.x, audit.mirror.y], [mirror.x, mirror.y]);
  assert.deepEqual([audit.opponent.x, audit.opponent.y], [opponent.x, opponent.y]);
}
function instrumentGold(gold) {
  if (gold.__r3Instrumented) return;
  Object.defineProperty(gold, '__r3Instrumented', { value: true });
  const rebase = gold.rebaseExternalExchangeHistory;
  gold.rebaseExternalExchangeHistory = function recordReceiverRebase(event, mirrorId) {
    const before = stateSnapshot(gold);
    const result = rebase.call(gold, event, mirrorId);
    const after = stateSnapshot(gold);
    historyOperations.push({ kind: 'receiver', gold, event, mirrorId, result, before, after });
    return result;
  };
  const apply = gold.applyExternalExchange;
  gold.applyExternalExchange = function recordCasterExchange(event, mirror, opponent) {
    const before = stateSnapshot(gold);
    const result = apply.call(gold, event, mirror, opponent);
    const after = stateSnapshot(gold);
    historyOperations.push({ kind: 'caster', gold, event, mirrorId: mirror && mirror.id,
      result, before, after });
    return result;
  };
}

const createGold = GOLD.createMirrorInstance;
GOLD.createMirrorInstance = function captureGold(options) {
  const gold = createGold.call(GOLD, options);
  instrumentGold(gold);
  goldInstances.push(gold);
  return gold;
};

// Observe the actual bus boundary so the test can compare history immediately
// before/after synchronous receiver handling, before the ordinary Gold tick.
const originalEmit = bus.emit;
bus.emit = function observeMirrorExchange(type, payload, ...rest) {
  if (type !== 'MirrorExchange') return originalEmit.call(this, type, payload, ...rest);
  const row = { payload, before: activeGolds().map(stateSnapshot), afterEmit: null };
  const out = originalEmit.call(this, type, payload, ...rest);
  row.afterEmit = activeGolds().map(stateSnapshot);
  exchangeDeliveries.push(row);
  return out;
};

HR.setAiEnabled(false);
function startMatch(opponentHero = 'MIRROR', positions = null) {
  T.start('MIRROR', opponentHero); T.holdSpawns();
  const [mirror, opponent] = H.fighters();
  const pos = positions || { mirror: { x: 230, y: 260 }, opponent: { x: 770, y: 740 } };
  mirror.baseSpeed = 0; opponent.baseSpeed = 0;
  mirror.x = pos.mirror.x; mirror.y = pos.mirror.y;
  opponent.x = pos.opponent.x; opponent.y = pos.opponent.y;
  stepFrames(1);
  const ct = HR.byCombatant(mirror);
  const gold = byBodyId(mirror.id);
  assert.ok(ct && gold, 'real Mirror installation creates its shipping Gold instance');
  return { mirror, opponent, ct, gold,
    otherCombatant: HR.byCombatant(opponent), otherGold: byBodyId(opponent.id) };
}
function castA2(body) {
  const seq = bus.seq;
  const result = HR.pressAbility(body, 'A2');
  const event = eventsAfter(seq, 'MirrorA2Cast')[0] || null;
  assert.ok(result && result.ok, 'real HR.pressAbility(MIRROR, A2) is accepted');
  assert.ok(event, 'real A2 gameplay emitted MirrorA2Cast');
  return { result, castId: event.payload.castId, event: event.payload };
}
function waitForExchange(seq, count = 1, maxFrames = 60) {
  for (let i = 0; i < maxFrames && eventsAfter(seq, 'MirrorExchange').length < count; i++) stepFrames(1);
  return eventsAfter(seq, 'MirrorExchange').map((event) => event.payload);
}
function rowFor(snapshotRows, gold) { return snapshotRows.find((row) => row.gold === gold); }
function assertImmediateHistoryLaw(gold, delivery, event, { alreadyShifted = false } = {}) {
  const before = rowFor(delivery.before, gold);
  const afterEmit = rowFor(delivery.afterEmit, gold);
  assert.ok(before && afterEmit);
  const expected = expectedRebase(before.history, gold, event, gold.M.id);
  if (alreadyShifted) sameHistory(before.history, expected, 'pre-operation ring is already physically rebased');
  else sameHistory(afterEmit.history, expected, 'event handling applies exactly the own PRE-to-POST history delta');
  assert.equal(afterEmit.hHead, before.hHead, 'a history-only exchange never advances hHead');
  return { before, afterEmit, expected };
}
function rootPairsFromEvent(event, gold) {
  const own = actorFor(event, gold.M.id);
  const other = actorFor(event, gold.F.id);
  assert.ok(own && other);
  return { own: own.to, other: other.to };
}

try {
  // CASE A/B — one real MvM caster, one receiver-only Mirror, then duplicate.
  const one = startMatch('MIRROR');
  assert.ok(one.otherGold && one.otherGold !== one.gold);
  const initialHeadA = one.gold.hHead, initialHeadB = one.otherGold.hHead;
  const cast = castA2(one.mirror);
  gate('MirrorA2Cast alone does not rebase or start receiver choreography', () => {
    assert.equal(one.gold.externalPassiveAudit().historyRebases, 0);
    assert.equal(one.otherGold.externalPassiveAudit().historyRebases, 0);
    assert.equal(one.gold.externalAudit().snaps, 0);
    assert.equal(one.otherGold.externalAudit().snaps, 0);
    assert.equal(one.gold.hHead, initialHeadA);
    assert.equal(one.otherGold.hHead, initialHeadB);
    assert.equal(one.otherGold.A2.on, false);
    assert.equal(one.otherGold.A2.res, 0);
  });
  const oneSeq = bus.seq;
  const oneEvents = waitForExchange(oneSeq);
  assert.equal(oneEvents.length, 1, 'one real A2 cast yields one physical MirrorExchange');
  const oneEvent = oneEvents[0];
  assert.equal(oneEvent.castId, cast.castId);
  const oneDelivery = deliveryFor(oneEvent);
  assert.ok(oneDelivery);
  const preA = rowFor(oneDelivery.before, one.gold);
  const preB = rowFor(oneDelivery.before, one.otherGold);
  const eventBRebase = operationFor(one.otherGold, 'receiver', oneEvent, true);
  assert.ok(eventBRebase, 'the non-casting Mirror consumes the real physical exchange as history only');
  const expectedA = expectedRebase(preA.history, one.gold, oneEvent, one.gold.M.id);
  const expectedB = expectedRebase(preB.history, one.otherGold, oneEvent, one.otherGold.M.id);
  const postsA = rootPairsFromEvent(oneEvent, one.gold);
  const postsB = rootPairsFromEvent(oneEvent, one.otherGold);
  sameHistory(rowFor(oneDelivery.afterEmit, one.gold).history, preA.history,
    'caster waits for its existing post-root applyExternalExchange path');
  sameHistory(rowFor(oneDelivery.afterEmit, one.otherGold).history, expectedB,
    'receiver history is rebased synchronously before root synchronization');
  sameHistory(eventBRebase.after.history, expectedB,
    'receiver operation changes every root sample and no other history channel');
  assert.deepEqual(rowFor(oneDelivery.afterEmit, one.gold).roots, preA.roots,
    'caster Gold roots are not synced from inside the event callback');
  assert.deepEqual(rowFor(oneDelivery.afterEmit, one.otherGold).roots, preB.roots,
    'receiver-only rebase does not sync POST roots inside the exchange callback');
  assert.deepEqual(eventBRebase.after.roots, eventBRebase.before.roots,
    'receiver history rebase is root-neutral until the ordinary POST-root sync');
  assert.equal(eventBRebase.before.hHead, eventBRebase.after.hHead);
  const applyA = operationFor(one.gold, 'caster', oneEvent, true);
  assert.ok(applyA, 'the caster retains the existing authored applyExternalExchange path');
  sameHistory(applyA.before.history, preA.history);
  sameHistory(applyA.after.history, expectedA,
    'the caster still performs exactly one authored snap/history rebase');
  assert.deepEqual(applyA.after.roots,
    [postsA.own.x, postsA.own.y, postsA.other.x, postsA.other.y],
    'caster apply retains POST-root synchronization after authored choreography');
  assert.equal(applyA.before.hHead, applyA.after.hHead);
  assert.deepEqual([one.gold.externalAudit().snaps, one.gold.externalAudit().exchanges], [1, 1]);
  assert.deepEqual([one.otherGold.externalAudit().snaps, one.otherGold.externalAudit().exchanges], [0, 0]);
  assert.deepEqual([one.gold.externalPassiveAudit().historyRebases,
    one.otherGold.externalPassiveAudit().historyRebases], [1, 1]);
  assert.ok(one.gold.A2.res > 0, 'only the caster owns authored post-snap residue');
  assert.deepEqual([one.otherGold.A2.on, one.otherGold.A2.res,
    one.otherGold.A2.band, one.otherGold.A2.ghostA, one.otherGold.A2.tear], [false, 0, 0, 0, 0]);
  assert.deepEqual([one.gold.M.x, one.gold.M.y, one.gold.F.x, one.gold.F.y],
    [postsA.own.x, postsA.own.y, postsA.other.x, postsA.other.y]);
  assert.deepEqual([one.otherGold.M.x, one.otherGold.M.y, one.otherGold.F.x, one.otherGold.F.y],
    [postsB.own.x, postsB.own.y, postsB.other.x, postsB.other.y]);
  assert.equal(one.gold.hHead, (preA.hHead + 1) % one.gold.HN,
    'only the normal production Gold step, not exchange handling, advances the ring');
  assert.equal(one.otherGold.hHead, (preB.hHead + 1) % one.otherGold.HN);
  gate('one-caster/one-receiver translates full rings once; receiver gets no A2 choreography', () => {
    sameHistory(applyA.after.history, expectedA);
    sameHistory(eventBRebase.after.history, expectedB);
    assert.equal(eventBRebase.after.snaps, 0);
    assert.equal(eventBRebase.after.exchanges, 0);
    assert.equal(eventBRebase.after.a2Res, 0);
  });

  const historyAfterFirst = new Map([[one.gold, Array.from(one.gold.hist)],
    [one.otherGold, Array.from(one.otherGold.hist)]]);
  const headsAfterFirst = new Map([[one.gold, one.gold.hHead], [one.otherGold, one.otherGold.hHead]]);
  const auditsAfterFirst = new Map([[one.gold, stateSnapshot(one.gold)], [one.otherGold, stateSnapshot(one.otherGold)]]);
  const exchangeEventsAfterFirst = one.ct && win.APEX_MIRROR_PRESENTATION.inspect().records
    .find((record) => record.combatantIndex === one.ct.idx).exchangeEvents;
  bus.emit('MirrorExchange', oneEvent);
  win.APEX_MIRROR_PRESENTATION.tick(0);
  gate('duplicate same-cast delivery is inert and does not move hHead or increment counters', () => {
    sameHistory(Array.from(one.gold.hist), historyAfterFirst.get(one.gold));
    sameHistory(Array.from(one.otherGold.hist), historyAfterFirst.get(one.otherGold));
    assert.equal(one.gold.hHead, headsAfterFirst.get(one.gold));
    assert.equal(one.otherGold.hHead, headsAfterFirst.get(one.otherGold));
    assert.deepEqual([one.gold.externalAudit().snaps, one.gold.externalAudit().exchanges,
      one.otherGold.externalAudit().snaps, one.otherGold.externalAudit().exchanges], [1, 1, 0, 0]);
    assert.deepEqual([one.gold.externalPassiveAudit().historyRebases,
      one.otherGold.externalPassiveAudit().historyRebases], [1, 1]);
    const current = win.APEX_MIRROR_PRESENTATION.inspect().records
      .find((record) => record.combatantIndex === one.ct.idx).exchangeEvents;
    assert.equal(current, exchangeEventsAfterFirst, 'adapter cast guard suppresses exact duplicate delivery');
    assert.deepEqual([one.gold.M.x, one.gold.M.y], [one.mirror.x, one.mirror.y]);
  });
  // Bypass adapter cast-ID suppression deliberately: Gold itself must dedupe
  // the unordered actor-pair + PRE/POST physical key across new cast IDs and
  // reversed perspective.
  const otherCastNotice = reversePhysicalNotice(oneEvent, 'r3-same-physical-different-cast');
  for (const gold of [one.gold, one.otherGold]) {
    const before = stateSnapshot(gold);
    assert.equal(gold.rebaseExternalExchangeHistory(otherCastNotice, gold.M.id), false);
    sameHistory(Array.from(gold.hist), before.history);
    assert.equal(gold.hHead, before.hHead);
    assert.equal(gold.externalPassiveAudit().historyRebases, before.historyRebases);
  }
  gate('Gold physical-key dedupe independently rejects reversed same exchange with a new castId', () => {
    assert.equal(physicalKey(oneEvent), physicalKey(otherCastNotice));
    assert.deepEqual([one.gold.externalPassiveAudit().historyRebases,
      one.otherGold.externalPassiveAudit().historyRebases], [1, 1]);
  });

  // CASE C — the real resolver coalesces simultaneous Mirror A2 casts into two
  // notices for one physical PRE/POST exchange. Each Gold first receives the
  // other cast as a receiver, then its own cast snap is physically deduped.
  const simultaneous = startMatch('MIRROR', {
    mirror: { x: 250, y: 330 }, opponent: { x: 750, y: 670 },
  });
  assert.ok(simultaneous.otherGold);
  const simultaneousSeq = bus.seq, simultaneousDeliveryStart = exchangeDeliveries.length;
  const castA = castA2(simultaneous.mirror);
  const castB = castA2(simultaneous.opponent);
  const simultaneousEvents = waitForExchange(simultaneousSeq, 2, 50);
  assert.equal(simultaneousEvents.length, 2);
  const delivery0 = deliveryFor(simultaneousEvents[0]);
  const delivery1 = deliveryFor(simultaneousEvents[1]);
  assert.ok(delivery0 && delivery1);
  const physicalBeforeA = rowFor(delivery0.before, simultaneous.gold);
  const physicalBeforeB = rowFor(delivery0.before, simultaneous.otherGold);
  const canonicalEvent0 = canonicalCoalescedSamples(simultaneousEvents[0]);
  const canonicalEvent1 = canonicalCoalescedSamples(simultaneousEvents[1]);
  const expectedSimA = expectedRebase(physicalBeforeA.history, simultaneous.gold,
    canonicalEvent0, simultaneous.gold.M.id);
  const expectedSimB = expectedRebase(physicalBeforeB.history, simultaneous.otherGold,
    canonicalEvent0, simultaneous.otherGold.M.id);
  gate('simultaneous casts canonicalize two coalesced notices to one unordered physical key', () => {
    assert.ok(castA.result.ok && castB.result.ok);
    assert.notEqual(castA.castId, castB.castId);
    assert.equal(simultaneousEvents[0].coalesced, 1);
    assert.equal(simultaneousEvents[1].coalesced, 1);
    assert.notEqual(physicalKey(simultaneousEvents[0]), physicalKey(simultaneousEvents[1]),
      'raw later callback has the resolver shared-result PRE pair in first-request orientation');
    assert.equal(physicalKey(canonicalEvent0), physicalKey(canonicalEvent1),
      'presentation reconstructs the actual unordered PRE pair from committed POST roots');
    assert.equal(simultaneousDeliveryStart + 2, exchangeDeliveries.length);
    sameHistory(rowFor(delivery0.afterEmit, simultaneous.gold).history,
      rowFor(delivery0.before, simultaneous.gold).history);
    sameHistory(rowFor(delivery0.afterEmit, simultaneous.otherGold).history, expectedSimB);
    sameHistory(rowFor(delivery1.afterEmit, simultaneous.gold).history, expectedSimA);
    sameHistory(rowFor(delivery1.afterEmit, simultaneous.otherGold).history, expectedSimB);
    assert.deepEqual(rowFor(delivery0.afterEmit, simultaneous.gold).roots, physicalBeforeA.roots);
    assert.deepEqual(rowFor(delivery0.afterEmit, simultaneous.otherGold).roots, physicalBeforeB.roots);
    assert.deepEqual(rowFor(delivery1.afterEmit, simultaneous.gold).roots, physicalBeforeA.roots,
      'receiver event handling records POST roots for the ordinary sync without syncing inline');
    assert.deepEqual(rowFor(delivery1.afterEmit, simultaneous.otherGold).roots, physicalBeforeB.roots);
    assert.equal(rowFor(delivery1.afterEmit, simultaneous.gold).hHead, physicalBeforeA.hHead);
    assert.equal(rowFor(delivery1.afterEmit, simultaneous.otherGold).hHead, physicalBeforeB.hHead);
  });
  for (const gold of [simultaneous.gold, simultaneous.otherGold]) {
    const ownCastId = gold === simultaneous.gold ? castA.castId : castB.castId;
    const ownEvent = simultaneousEvents.find((event) => event.castId === ownCastId);
    const receiverEvent = simultaneousEvents.find((event) => event.castId !== ownCastId);
    const receiverOp = operationFor(gold, 'receiver', receiverEvent, true);
    const casterOp = operationFor(gold, 'caster', ownEvent, true);
    assert.ok(receiverOp && casterOp);
    const start = rowFor(delivery0.before, gold);
    const expected = expectedRebase(start.history, gold,
      canonicalCoalescedSamples(ownEvent), gold.M.id);
    sameHistory(receiverOp.after.history, expected,
      'receiver notice translates every root sample by the real actor PRE-to-POST delta');
    sameHistory(casterOp.before.history, expected,
      'the caster snap sees the already-rebased physical history');
    sameHistory(casterOp.after.history, expected,
      'Gold physical-key dedupe prevents a second shift in authored a2Snap');
    assert.deepEqual(receiverOp.after.roots, start.roots,
      'receiver callback rebases history only; POST roots remain for the ordinary sync');
    assert.deepEqual(casterOp.before.roots, start.roots);
    const postRoots = rootPairsFromEvent(canonicalCoalescedSamples(ownEvent), gold);
    assert.deepEqual(casterOp.after.roots,
      [postRoots.own.x, postRoots.own.y, postRoots.other.x, postRoots.other.y]);
    assert.equal(physicalKey(receiverOp.event), physicalKey(casterOp.event),
      'receiver and caster methods share Gold’s unordered physical key');
    assert.equal(receiverOp.before.hHead, receiverOp.after.hHead);
    assert.equal(receiverOp.before.snaps, receiverOp.after.snaps,
      'receiver-only rebasing never invokes authored a2Snap');
    assert.equal(receiverOp.before.exchanges, receiverOp.after.exchanges);
    assert.deepEqual([receiverOp.before.a2On, receiverOp.before.a2Res,
      receiverOp.before.a2Band, receiverOp.before.a2Ghost, receiverOp.before.a2Tear],
      [receiverOp.after.a2On, receiverOp.after.a2Res,
        receiverOp.after.a2Band, receiverOp.after.a2Ghost, receiverOp.after.a2Tear],
      'receiver notice does not alter its Gold A2 choreography state');
    assert.equal(casterOp.before.hHead, casterOp.after.hHead);
    assert.equal(gold.externalPassiveAudit().historyRebases, 1);
    assert.equal(gold.externalAudit().snaps, 1);
    assert.equal(gold.externalAudit().exchanges, 1);
  }
  assert.ok(simultaneous.gold.A2.res > 0 && simultaneous.otherGold.A2.res > 0);
  let residueA = 0, residueB = 0;
  const stripsA = simultaneous.gold.strips, stripsB = simultaneous.otherGold.strips;
  simultaneous.gold.strips = function (ctx, ...args) {
    residueA++; return stripsA.call(simultaneous.gold, ctx, ...args);
  };
  simultaneous.otherGold.strips = function (ctx, ...args) {
    residueB++; return stripsB.call(simultaneous.otherGold, ctx, ...args);
  };
  const ctx = win.document.getElementById('game-canvas').getContext('2d');
  const presentation = win.APEX_MIRROR_PRESENTATION;
  presentation.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' });
  assert.deepEqual([residueA, residueB], [0, 0], 'A2 residue is not drawn in the pre-fighter world layer');
  win.__apexRenderFrame = (win.__apexRenderFrame || 0) + 1;
  presentation.renderPostFighterResidue(ctx);
  simultaneous.gold.strips = stripsA; simultaneous.otherGold.strips = stripsB;
  gate('simultaneous physical exchange yields one rebase per Gold and one post-fighter residue owner', () => {
    assert.deepEqual([simultaneous.gold.externalPassiveAudit().historyRebases,
      simultaneous.otherGold.externalPassiveAudit().historyRebases], [1, 1]);
    assert.deepEqual([residueA, residueB], [2, 0], 'one owner draws the two Gold residue echoes exactly once');
    assert.deepEqual([simultaneous.mirror.x, simultaneous.mirror.y,
      simultaneous.opponent.x, simultaneous.opponent.y],
      [simultaneousEvents[0].self.to.x, simultaneousEvents[0].self.to.y,
        simultaneousEvents[0].opponent.to.x, simultaneousEvents[0].opponent.to.y],
      'presentation performs no second physical exchange');
  });

  // CASE D — a later real A2 on the receiver causes a genuinely different
  // physical exchange. Pair-only dedupe would fail this; Gold's full key allows it.
  const staggered = startMatch('MIRROR', {
    mirror: { x: 220, y: 370 }, opponent: { x: 780, y: 630 },
  });
  const staggerSeq1 = bus.seq;
  const firstCast = castA2(staggered.mirror);
  const firstStaggerEvents = waitForExchange(staggerSeq1, 1, 50);
  assert.equal(firstStaggerEvents.length, 1);
  const firstStaggerEvent = firstStaggerEvents[0];
  const firstStaggerDelivery = deliveryFor(firstStaggerEvent);
  assert.ok(firstStaggerDelivery);
  const endSeq = bus.seq;
  for (let i = 0; i < 100 && !eventsAfter(endSeq, 'MirrorA2End').some((e) => e.payload.castId === firstCast.castId); i++)
    stepFrames(1);
  assert.ok(eventsAfter(endSeq, 'MirrorA2End').some((e) => e.payload.castId === firstCast.castId),
    'first real A2 finishes before the second cast');
  const secondSeq = bus.seq;
  const secondCast = castA2(staggered.opponent);
  const secondStaggerEvents = waitForExchange(secondSeq, 1, 50);
  assert.equal(secondStaggerEvents.length, 1);
  const secondStaggerEvent = secondStaggerEvents[0];
  const secondStaggerDelivery = deliveryFor(secondStaggerEvent);
  assert.ok(secondStaggerDelivery);
  const secondBeforeA = rowFor(secondStaggerDelivery.before, staggered.gold);
  const secondBeforeB = rowFor(secondStaggerDelivery.before, staggered.otherGold);
  const expectedSecondA = expectedRebase(secondBeforeA.history, staggered.gold,
    secondStaggerEvent, staggered.gold.M.id);
  const expectedSecondB = expectedRebase(secondBeforeB.history, staggered.otherGold,
    secondStaggerEvent, staggered.otherGold.M.id);
  const secondReceiverA = operationFor(staggered.gold, 'receiver', secondStaggerEvent, true);
  const secondCasterB = operationFor(staggered.otherGold, 'caster', secondStaggerEvent, true);
  gate('staggered distinct PRE/POST exchange gets a second independent full-ring rebase', () => {
    assert.ok(secondCast.result.ok);
    assert.notEqual(firstCast.castId, secondCast.castId);
    assert.notEqual(physicalKey(firstStaggerEvent), physicalKey(secondStaggerEvent));
    assert.ok(secondReceiverA && secondCasterB);
    sameHistory(secondReceiverA.after.history, expectedSecondA);
    sameHistory(secondCasterB.after.history, expectedSecondB);
    assert.equal(secondReceiverA.before.hHead, secondReceiverA.after.hHead);
    assert.equal(secondCasterB.before.hHead, secondCasterB.after.hHead);
    assert.deepEqual([staggered.gold.externalPassiveAudit().historyRebases,
      staggered.otherGold.externalPassiveAudit().historyRebases], [2, 2]);
    assert.deepEqual([staggered.gold.externalAudit().snaps,
      staggered.otherGold.externalAudit().snaps], [1, 1],
      'each Gold authors only the one snap for the cast it owns');
    assert.deepEqual([staggered.gold.externalAudit().exchanges,
      staggered.otherGold.externalAudit().exchanges], [1, 1]);
    assert.deepEqual([staggered.gold.M.x, staggered.gold.M.y,
      staggered.otherGold.M.x, staggered.otherGold.M.y],
      [staggered.mirror.x, staggered.mirror.y, staggered.opponent.x, staggered.opponent.y]);
  });

  // CASE E — cast-only, then real death-before-snap NoSnap, followed by a stale
  // old-match exchange. None may be inferred as a receiver physical exchange.
  const noSnap = startMatch('ROBOT', {
    mirror: { x: 300, y: 500 }, opponent: { x: 800, y: 500 },
  });
  assert.equal(noSnap.otherGold, undefined, 'non-Mirror opponent has no Gold instance');
  const noSnapHistory = Array.from(noSnap.gold.hist), noSnapHead = noSnap.gold.hHead;
  const noSnapSeq = bus.seq;
  const noSnapCast = castA2(noSnap.mirror);
  gate('non-Mirror matchup installs exactly one Gold; cast event alone has no snap/rebase', () => {
    assert.equal(activeGolds().length, 1);
    sameHistory(Array.from(noSnap.gold.hist), noSnapHistory);
    assert.equal(noSnap.gold.hHead, noSnapHead);
    assert.equal(noSnap.gold.externalPassiveAudit().historyRebases, 0);
    assert.equal(noSnap.gold.externalAudit().snaps, 0);
  });
  stepFrames(12); // A2 is active but still before its authored crossing.
  noSnap.opponent.hp = 0; // real death-before-snap precondition
  const noSnapOpsBefore = historyOperations.length;
  let noSnapEvent = null;
  for (let i = 0; i < 40 && !noSnapEvent; i++) {
    stepFrames(1);
    noSnapEvent = eventsAfter(noSnapSeq, 'MirrorA2NoSnap').find((e) => e.payload.castId === noSnapCast.castId) || null;
  }
  assert.ok(noSnapEvent, 'real Mirror A2 emits NoSnap after opponent death');
  const noPhysicalExchange = eventsAfter(noSnapSeq, 'MirrorExchange')
    .every((event) => event.payload.castId !== noSnapCast.castId);
  gate('death-before-snap emits no receiver rebase, authored snap, exchange or residue', () => {
    assert.ok(noPhysicalExchange);
    assert.equal(noSnap.gold.externalPassiveAudit().historyRebases, 0);
    assert.equal(noSnap.gold.externalAudit().snaps, 0);
    assert.equal(noSnap.gold.externalAudit().exchanges, 0);
    assert.equal(historyOperations.length, noSnapOpsBefore);
    assert.equal(noSnap.gold.A2.res, 0);
  });
  const staleEvent = oneEvent;
  const staleExchangeCount = noSnap.gold.externalAudit().exchanges;
  const historyBeforeStale = Array.from(noSnap.gold.hist), headBeforeStale = noSnap.gold.hHead;
  const noSnapOperationsBeforeStale = historyOperations.length;
  bus.emit('MirrorExchange', staleEvent); // actor IDs belong to a torn-down prior match
  win.APEX_MIRROR_PRESENTATION.tick(0);
  assert.equal(noSnap.gold.externalAudit().exchanges, staleExchangeCount);
  assert.equal(noSnap.gold.externalPassiveAudit().historyRebases, 0);
  sameHistory(Array.from(noSnap.gold.hist), historyBeforeStale);
  assert.equal(noSnap.gold.hHead, headBeforeStale);
  assert.equal(historyOperations.length, noSnapOperationsBeforeStale);
  const malformedEvent = { ...staleEvent, castId: noSnapCast.castId,
    self: { ...staleEvent.self, from: { x: Number.NaN, y: staleEvent.self.from.y } } };
  bus.emit('MirrorExchange', malformedEvent); // active cast, but malformed PRE point
  win.APEX_MIRROR_PRESENTATION.tick(0);
  const noSnapRecord = win.APEX_MIRROR_PRESENTATION.inspect().records
    .find((record) => record.combatantIndex === noSnap.ct.idx);
  assert.equal(noSnapRecord.exchangeEvents, 0);
  assert.equal(historyOperations.length, noSnapOperationsBeforeStale);
  sameHistory(Array.from(noSnap.gold.hist), historyBeforeStale);
  assert.equal(noSnap.gold.hHead, headBeforeStale);
  const teardownGold = noSnap.gold;
  bus.emit('ReworkMatchTeardown', {});
  const operationsAfterTeardown = historyOperations.length;
  bus.emit('MirrorExchange', staleEvent);
  gate('teardown and invalid/stale physical event cannot trigger a late receiver rebase', () => {
    assert.equal(teardownGold.externalTruth, false);
    assert.equal(historyOperations.length, operationsAfterTeardown);
    assert.equal(win.APEX_MIRROR_PRESENTATION.inspect().instanceCount, 0);
  });

  // CASE F — each established non-Mirror opponent retains the one-caster path.
  const nonMirrorResults = [];
  for (const hero of ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE']) {
    const matchup = startMatch(hero, {
      mirror: { x: 300, y: 500 }, opponent: { x: 800, y: 500 },
    });
    assert.equal(matchup.otherGold, undefined, `${hero} is not a Mirror presentation owner`);
    const seq = bus.seq;
    const cast = castA2(matchup.mirror);
    const exchanges = waitForExchange(seq, 1, 50);
    assert.equal(exchanges.length, 1, `${hero} receives the existing real A2 physical event`);
    const physical = exchanges[0];
    const apply = operationFor(matchup.gold, 'caster', physical, true);
    assert.ok(apply, `${hero} matchup keeps the real caster applyExternalExchange path`);
    assert.equal(operationFor(matchup.gold, 'receiver', physical), undefined);
    assert.deepEqual([matchup.gold.externalAudit().snaps, matchup.gold.externalAudit().exchanges], [1, 1]);
    assert.equal(matchup.gold.externalPassiveAudit().historyRebases, 1);
    assert.deepEqual([matchup.gold.M.x, matchup.gold.M.y], [matchup.mirror.x, matchup.mirror.y]);
    nonMirrorResults.push(hero);
  }
  gate('Robot/Hunter/Crystala/Magnet/Frost keep one-Gold caster semantics unchanged', () => {
    assert.deepEqual(nonMirrorResults, ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE']);
    assert.equal(activeGolds().length, 1);
  });

  const adapterSource = fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8');
  gate('shipping adapter uses Gold physical-key history primitive without A2 choreography for receivers', () => {
    assert.match(adapterSource, /state\.a2CastId === payload\.castId/);
    assert.match(adapterSource, /state\.gold\.rebaseExternalExchangeHistory\(exchange, id\)/);
    assert.doesNotMatch(adapterSource, /\.a2Snap\s*\(|\.shiftHist\s*\(/);
  });

  assert.equal(passed, 12);
  const canonicalGold = fs.readFileSync('docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html');
  const generatedGold = fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js');
  const manifest = fs.readFileSync('src/game/runtimeManifest.js', 'utf8');
  const revision = manifest.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/)?.[1] || null;
  const evidence = {
    checkpoint: 'G-R3 Mirror-vs-Mirror A2 receiver-only history continuity',
    result: 'PASS',
    test: 'tools/testMirrorPresentationR3A2ReceiverClosure.mjs',
    gates: { passed, failed: 0, names: passedGates },
    gold: {
      canonicalSha256: createHash('sha256').update(canonicalGold).digest('hex'),
      generatedRuntimeSha256: createHash('sha256').update(generatedGold).digest('hex'),
      authority: 'tools/bridgeMirrorGoldV1.mjs; Gold HTML unchanged',
    },
    runtimeRevision: revision,
    proved: [
      'real gameplay caster retains applyExternalExchange and exactly one authored snap',
      'receiver-only Mirror synchronously rebases Gold history then syncs POST roots on the normal adapter tick',
      'receiver-only event does not start A2, snap, residue, or caster choreography',
      'simultaneous/coalesced MvM notices normalize to one unordered PRE/POST Gold key; Gold dedupes caster apply',
      'changed castId and reversed participant order are independently rejected by Gold physical-key dedupe',
      'a later distinct physical PRE/POST exchange rebases despite the same unordered actor pair',
      'full Float32Array shift law holds and exchange methods leave hHead unchanged',
      'death-before-snap, malformed/stale event, teardown, and non-Mirror opponent cases do not create receiver work',
    ],
    nonClaims: ['visual parity', 'Checkpoint H owner acceptance'],
  };
  const evidencePath = 'docs/hero-rework/mirror-v1/evidence/r3-a2-receiver-closure.json';
  fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Mirror R3 A2 receiver closure: ${passed}/${passed} passed`);
} finally {
  H.dom.window.close();
}
