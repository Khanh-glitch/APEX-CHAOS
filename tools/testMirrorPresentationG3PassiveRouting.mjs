#!/usr/bin/env node
/* G3 — semantic snapshot and Gold-owned F1/F2 presentation bridge gates. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const listeners = new Map();
const bus = {
  on(type, fn) { const a = listeners.get(type) || []; a.push(fn); listeners.set(type, a); return () => a.splice(a.indexOf(fn), 1); },
  emit(type, payload = {}) { for (const fn of (listeners.get(type) || []).slice()) fn({ type, payload }); },
};
let drawExternalCalls = 0, instancesMade = 0, capturedSeedInput = null;
const goldInstances = [];
function goldInstance() {
  const routes = new Map();
  const imageOwners = new Map();
  let shardBindings = 0, nodeBindings = 0, routeEvents = 0, steps = 0;
  const semanticRouteEvents = [];
  let lastSnapshot = null, lastGeometry = null;
  function setImage(nodeId, routeId) {
    let owners = imageOwners.get(nodeId);
    if (!owners) imageOwners.set(nodeId, owners = new Set());
    owners.add(routeId);
  }
  return {
    A1: { on: false }, A2: { on: false, res: 0 },
    enableExternalTruth() { return true; },
    clearExternalTruth() { routes.clear(); imageOwners.clear(); shardBindings = nodeBindings = routeEvents = steps = 0; return true; },
    syncExternalTruth() { return true; },
    syncExternalPassive(snapshot, geometry) {
      lastSnapshot = snapshot; lastGeometry = geometry;
      shardBindings = snapshot.shards.filter((s) => s && s.on && s.identity).length;
      nodeBindings = snapshot.nodes.length;
      return true;
    },
    captureExternalShardSide(provenance, mirrorX) {
      capturedSeedInput = {
        x: provenance.hitX, y: provenance.hitY,
        dx: provenance.dirX, dy: provenance.dirY, mirrorX,
      };
      const magnitude = Math.hypot(provenance.dirX, provenance.dirY) || 1;
      const nx = provenance.dirX / magnitude;
      return Math.abs(nx) > .25 ? (nx > 0 ? 'L' : 'R')
        : (provenance.hitX < mirrorX ? 'L' : 'R');
    },
    presentExternalRoute(event) {
      routeEvents++;
      semanticRouteEvents.push(event);
      if (event.kind === 'preview' || event.kind === 'local') return true;
      if (event.kind === 'capture') {
        if (routes.has(event.routeId)) return false;
        routes.set(event.routeId, { entry: event.entryNodeId, dest: event.destinationNodeId });
        setImage(event.entryNodeId, event.routeId);
        return true;
      }
      const route = routes.get(event.routeId);
      if (!route) return false;
      if (event.kind === 'destination-image') {
        if (event.destinationLive) setImage(route.dest, event.routeId);
        return true;
      }
      if (event.kind === 'emerge') {
        routes.delete(event.routeId);
        for (const [id, owners] of imageOwners) {
          owners.delete(event.routeId);
          if (!owners.size) imageOwners.delete(id);
        }
        return true;
      }
      return false;
    },
    stepExternalPresentation(dt) { assert.equal(dt, 1 / 120); steps++; return true; },
    externalPassiveAudit() {
      let ownerCount = 0; for (const owners of imageOwners.values()) ownerCount += owners.size;
      return Object.freeze({ shardBindings, nodeBindings, routes: routes.size,
        imageOwners: ownerCount, passiveSteps: steps, routeEvents, historyRebases: 0, goldProjectiles: 0 });
    },
    externalAudit() { return { enabled: true, steps, a1On: false, a2On: false }; },
    get testRouteIds() { return Array.from(routes.keys()); },
    get testRouteEvents() { return semanticRouteEvents; },
    beginExternalA1() { return true; }, beginExternalA2() { return true; },
    endExternalA1() { return true; }, endExternalA2() { return true; },
    markExternalA1Whiff() { return true; }, applyExternalExchange() { return true; },
    weaponArt() { return null; }, setWeaponArt() { return null; },
    drawExternalPassive() { drawExternalCalls++; return true; }, drawA1World() {}, drawResidue() {},
    get testSnapshot() { return lastSnapshot; }, get testGeometry() { return lastGeometry; },
  };
}
const HR = {
  match: null,
  byCombatant(b) { return b.__ct; },
  mirrorNode: {
    NV: [[-5,-60],[28,-27],[20,28],[0,62],[-28,31]],
    toWorld(node, x, y) { return { x: node.x + x, y: node.y + y }; },
  },
};
const context = { console, Math, Map, Set, Array, Object, Number, Float32Array,
  APEX_HERO_REWORK: HR, APEX_HERO_REWORK_AIL: { bus },
  APEX_MIRROR_GOLD: { createMirrorInstance() { instancesMade++; const instance = goldInstance(); goldInstances.push(instance); return instance; } },
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8'), context);
const api = context.APEX_MIRROR_PRESENTATION;
const body = (id, x, y) => ({ id, x, y, hp: 100, data: {}, dir: { x: 1, y: 0 }, __hrFrameStart: { x, y } });
const ct = (idx) => { const anchor = body(idx + 1, 100 + idx * 300, 200); const c = { idx, heroId: 'MIRROR', anchor, facade: false, store: {} }; anchor.__ct = c; return c; };
const m0 = ct(0), m1 = ct(1);
HR.match = { combatants: [m0, m1], world: { mirrorF2: { escrow: [], nodeSeq: 0 } } };
const passive = (c) => c.store['mirror.passive'] = { slots: Array(16).fill(null), nodes: [], scanT: 0 };
const p0 = passive(m0), p1 = passive(m1);
bus.emit('ReworkMatchInstall', {});
const run = (dt = 1 / 120) => api.tick(dt);
let pass = 0;
const gate = (name, fn) => { fn(); pass++; console.log(`PASS ${name}`); };
const shard = (x, y, st = 0) => ({ on: true, st, node: null, x, y, vx: 4, vy: 5, age: 1,
  fx: x - 1, fy: y - 1, tx: x + 2, ty: y + 3, mt0: .18, moving: st === 1,
  prov: { hitX: x - 4, hitY: y - 5, dirX: 0, dirY: 1, weaponId: 'AK' } });
const node = (id, owner, x, y, rot, st, members) => ({ id, owner, x, y, rot, st,
  t: .8, age: .2, t3: 0, tlock: .6, sh: members });
const record = (index = 0) => api.inspect().records.find((r) => r.combatantIndex === index);
const fiveAt = (slots, first, x, y, owner) => {
  const members = [];
  for (let i = 0; i < 5; i++) { const s = shard(x + i, y + i, 1); slots[first + i] = s; members.push(s); }
  return members;
};

const first = shard(123, 234); p0.slots[3] = first; run();
gate('R2-01 real slot truth preserves exact shard object identity', () => {
  assert.equal(record().passive.shardBindings, 1);
  assert.strictEqual(goldInstances[0].testSnapshot.shards[3].identity, first);
  assert.strictEqual(goldInstances[0].testSnapshot.shards[3].provenance, first.prov);
});
gate('R2-02 stable semantic snapshot carries lifecycle without changing real truth', () => {
  assert.equal(goldInstances[0].testSnapshot.shards[3].st, first.st);
  assert.equal(goldInstances[0].testSnapshot.shards[3].x, first.x);
  assert.strictEqual(p0.slots[3], first);
  const source = fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8');
  assert.match(source, /identity = real/);
  assert.match(source, /syncExternalPassive\(snapshot, HR && HR\.mirrorNode\)/);
});
p0.slots[3] = null; run(); const replacement = shard(333, 444); p0.slots[3] = replacement; run();
gate('R2-03 same-slot object replacement is reconciled from real identity', () => {
  assert.notStrictEqual(first, replacement);
  assert.strictEqual(p0.slots[3], replacement);
  assert.strictEqual(goldInstances[0].testSnapshot.shards[3].identity, replacement);
  assert.equal(record().passive.shardBindings, 1);
});
const seedShard = shard(360, 240); p0.slots[6] = seedShard;
assert.equal(api.capturePassiveShardSeeds(m0, [seedShard]), true); run();
gate('R2-04 hit-time side seed captures exact provenance/root X before reconciliation', () => {
  assert.deepEqual(capturedSeedInput, { x: 356, y: 235, dx: 0, dy: 1, mirrorX: m0.anchor.x });
  assert.deepEqual({ ...seedShard.prov }, { hitX: 356, hitY: 235, dirX: 0, dirY: 1, weaponId: 'AK' });
  assert.equal(record().passive.shardBindings, 2);
  assert.equal(goldInstances[0].testSnapshot.shards[6].presentationSide, 'R');
});
const five = fiveAt(p0.slots, 0, 300, 400, m0);
const forming = node(10, m0, 302, 402, .2, 1, five); p0.nodes = [forming]; run();
gate('R2-05 F1 member-slot truth passes exact five real shards and node ID', () => {
  assert.equal(record().passive.nodeBindings, 1);
  assert.equal(record().passive.shardBindings, 6);
  assert.strictEqual(p0.nodes[0], forming);
  assert.equal(forming.sh.length, 5);
  assert.deepEqual(goldInstances[0].testSnapshot.nodes[0].memberSlots, [0, 1, 2, 3, 4]);
});
gate('R2-06 real FORMING/ACTIVE/FOLD states remain input, not adapter-owned', () => {
  for (const st of [1, 2, 3]) {
    forming.st = st; run();
    assert.equal(record().passive.nodeBindings, 1);
    assert.equal(goldInstances[0].testSnapshot.nodes[0].st, st);
  }
  assert.equal(p0.nodes[0].st, 3);
});
const membersB = fiveAt(p0.slots, 5, 500, 600, m0);
const membersC = fiveAt(p0.slots, 10, 700, 800, m0);
p0.nodes = [forming, node(11, m0, 510, 610, .1, 2, membersB), node(12, m0, 710, 810, -.1, 3, membersC)]; run();
gate('R2-07 maps three real gameplay nodes without creating a synthetic fourth', () => {
  assert.equal(p0.nodes.length, 3);
  assert.equal(record().passive.nodeBindings, 3);
});
const otherMembers = fiveAt(p1.slots, 0, 770, 880, m1);
p1.nodes = [node(21, m1, 780, 890, .1, 2, otherMembers)]; run();
gate('R2-08 Mirror-v-Mirror snapshots remain owner-isolated', () => {
  assert.equal(record(0).passive.shardBindings, 15);
  assert.equal(record(0).passive.nodeBindings, 3);
  assert.equal(record(1).passive.shardBindings, 5);
  assert.equal(record(1).passive.nodeBindings, 1);
});
const source = fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8');
const goldSource = fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js', 'utf8');
gate('R2-09 shared HR.mirrorNode geometry is passed to Gold semantic sync', () => {
  assert.ok(HR.mirrorNode && typeof HR.mirrorNode.toWorld === 'function');
  assert.match(source, /syncExternalPassive\(snapshot, HR && HR\.mirrorNode\)/);
  assert.strictEqual(goldInstances[0].testGeometry, HR.mirrorNode);
  assert.match(goldSource, /__deriveExternalNodeEdges/);
});
const ctx = {};
const drawsBefore = drawExternalCalls;
assert.equal(api.renderArenaWorldEffects(ctx, { stage: 'before-world' }), false);
assert.equal(api.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' }), true);
gate('R2-10 F1 world rendering delegates to Gold semantic draw API', () => {
  assert.equal(drawExternalCalls, drawsBefore + 2);
  assert.match(source, /state\.gold\.drawExternalPassive\(ctx\)/);
  assert.doesNotMatch(source, /drawFreeShard|drawNodeBody/);
});
const projectile = { id: 'same-projectile' };
const routePayload = (extra = {}) => ({ owner: 0, node: 10, dest: 11,
  projectile, point: Object.freeze({ x: 309, y: 417 }),
  direction: Object.freeze({ x: 0, y: 280 }), power: 2, ...extra });
const previewPayload = routePayload(), localPayload = routePayload();
bus.emit('MirrorRoutePreview', previewPayload);
bus.emit('MirrorRouteLocal', localPayload);
gate('R2-11 preview/local preserve exact identity and real visual payload without escrow', () => {
  const events = goldInstances[0].testRouteEvents.slice(-2);
  assert.equal(record(0).passive.routeEvents, 2);
  assert.deepEqual(events.map((event) => event.kind), ['preview', 'local']);
  assert.strictEqual(events[0].routeId, projectile);
  assert.strictEqual(events[0].point, previewPayload.point);
  assert.strictEqual(events[0].direction, previewPayload.direction);
  assert.equal(events[0].power, previewPayload.power);
  assert.strictEqual(events[1].routeId, projectile);
  assert.strictEqual(events[1].point, localPayload.point);
  assert.equal(record(0).passive.routes, 0, 'preview/local do not create escrow routes');
  assert.equal(record(1).passive.routeEvents, 0, 'one owner receives no cross-owner local event');
  assert.equal(projectile.id, 'same-projectile');
});
const capturePayload = routePayload({ entry: 10, dest: 11 });
bus.emit('MirrorRouteCapture', capturePayload);
gate('R2-12 capture uses the exact projectile object and fixed real endpoints', () => {
  assert.equal(record(0).passive.routes, 1);
  assert.equal(record(0).passive.imageOwners, 1);
  assert.strictEqual(goldInstances[0].testRouteIds[0], projectile);
  const capture = goldInstances[0].testRouteEvents.at(-1);
  assert.equal(capture.kind, 'capture');
  assert.equal(capture.entryNodeId, 10);
  assert.equal(capture.destinationNodeId, 11);
  assert.strictEqual(capture.routeId, projectile);
  assert.equal(record(1).passive.routes, 0);
  assert.equal(projectile.id, 'same-projectile');
});
const imagePayload = routePayload({ dest: 11, destLive: true, point: capturePayload.point });
bus.emit('MirrorEscrowImage', imagePayload);
gate('R2-13 destination-image forwards truthful liveness and shared identity', () => {
  assert.equal(record(0).passive.routes, 1);
  assert.equal(record(0).passive.imageOwners, 2);
  const image = goldInstances[0].testRouteEvents.at(-1);
  assert.equal(image.kind, 'destination-image');
  assert.strictEqual(image.routeId, projectile);
  assert.equal(image.destinationLive, true);
  assert.equal(image.destinationNodeId, 11);
  assert.strictEqual(image.point, capturePayload.point);
});
bus.emit('MirrorRouteEmerge', routePayload({ via: 11, x: 720, y: 500 }));
gate('R2-14 exact terminal emerge releases only Gold-owned route/image state', () => {
  assert.equal(record(0).passive.routes, 0);
  assert.equal(record(0).passive.imageOwners, 0);
  assert.equal(record(0).passive.goldProjectiles, 0);
});
const fallbackProjectile = { id: 'fallback-projectile' };
bus.emit('MirrorRouteCapture', routePayload({ projectile: fallbackProjectile, entry: 10, dest: 11 }));
const fallbackPayload = routePayload({ projectile: fallbackProjectile,
  via: 'entry-fallback', fallback: true, x: 300, y: 400 });
bus.emit('MirrorRouteEmerge', fallbackPayload);
const routeCountAfterFallback = record(0).passive.routes;
bus.emit('MirrorRouteEmerge', fallbackPayload); // duplicate terminal event must not resurrect or retarget it
gate('R2-15 entry fallback consumes one exact route once without retargeting', () => {
  assert.equal(routeCountAfterFallback, 0);
  assert.equal(record(0).passive.routes, 0);
  assert.equal(record(0).passive.imageOwners, 0);
  const fallback = goldInstances[0].testRouteEvents.at(-2);
  assert.equal(fallback.kind, 'emerge');
  assert.strictEqual(fallback.routeId, fallbackProjectile);
  assert.equal(fallback.via, 'entry-fallback');
  assert.equal(fallback.fallback, true);
  assert.equal(fallback.viaNodeId, null);
  assert.equal(fallbackProjectile.id, 'fallback-projectile');
});
gate('R2-16 R1 owns route/node/image maps; adapter contains no parallel lifecycle', () => {
  assert.doesNotMatch(source, /routeBindings|imageOwners|nodeBindings/);
  assert.doesNotMatch(source, /state\.gold\.(SH|ND|PJ)\b/);
});
gate('R2-17 Gold owns passive clocks; adapter has no raw-frame ND advancement', () => {
  assert.doesNotMatch(source, /for\s*\(const n of state\.gold\.ND/);
  assert.doesNotMatch(source, /0\.208|0\.566/);
  assert.match(source, /stepExternalPresentation\(STEP\)/);
});
const beforeInstances = instancesMade;
const beforeSteps = record().external.steps;
for (let i = 0; i < 120; i++) run();
gate('R2-18 sustained ticks keep bounded Gold instances and exact 1/120 steps', () => {
  assert.equal(instancesMade, beforeInstances);
  assert.equal(record().external.steps - beforeSteps, 120);
  assert.equal(api.inspect().scheduler.errors, 0);
});
gate('R2-19 adapter teardown delegates all F1/F2 cleanup to Gold', () => {
  bus.emit('ReworkMatchTeardown', {});
  assert.equal(api.inspect().instanceCount, 0);
  assert.equal(api.inspect().listenerCount, 15);
  for (const instance of goldInstances) {
    const audit = instance.externalPassiveAudit();
    assert.equal(audit.shardBindings, 0);
    assert.equal(audit.nodeBindings, 0);
    assert.equal(audit.routes, 0);
    assert.equal(audit.imageOwners, 0);
  }
});
gate('R2-20 bridge retains actor/A1/A2 world API after semantic migration', () => {
  assert.equal(typeof api.renderArenaWorldEffects, 'function');
  assert.equal(api.fixedStep, 1 / 120);
});
assert.equal(pass, 20);
console.log(`Mirror R2 semantic adapter fake-Gold checks: ${pass}/${pass} passed`);
