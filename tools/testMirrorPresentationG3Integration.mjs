#!/usr/bin/env node
/* G3/R2 real integration — semantic F1 snapshots and Gold-owned route lifetimes. */
import assert from 'node:assert/strict';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
const GOLD = win.APEX_MIRROR_GOLD;
const bus = win.APEX_HERO_REWORK_AIL.bus;
const DT = 1 / 120;
const goldInstances = [];
const makeGold = GOLD.createMirrorInstance;
GOLD.createMirrorInstance = function captureGold(options) {
  const instance = makeGold.call(GOLD, options); goldInstances.push(instance); return instance;
};
HR.setAiEnabled(false);
const stepPresentation = (api, count) => { for (let i = 0; i < count; i++) api.tick(DT); };
let passed = 0;
function gate(name, fn) { fn(); passed++; console.log(`PASS G3/R2 ${passed} ${name}`); }

try {
  T.start('MIRROR', 'MIRROR'); T.holdSpawns();
  const [a, b] = H.fighters();
  const ca = HR.byCombatant(a), cb = HR.byCombatant(b);
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = 160; a.y = 240; b.x = 840; b.y = 760;
  T.step(DT, DT);
  const P = win.APEX_MIRROR_PRESENTATION;
  assert.ok(P && HR.mirrorNode);
  const goldA = goldInstances.find((instance) => instance.M.id === a.id);
  const goldB = goldInstances.find((instance) => instance.M.id === b.id);
  assert.ok(goldA && goldB && goldA !== goldB);
  const passiveA = ca.store['mirror.passive'], passiveB = cb.store['mirror.passive'];

  const addNode = (ct, id, x, y, rot) => {
    const state = ct.store['mirror.passive'];
    const members = [];
    for (let i = 0; i < 5; i++) {
      const slot = state.slots.findIndex((entry) => !entry);
      assert.ok(slot >= 0);
      const shard = { on: true, st: 3, node: null, x: x + i, y: y - i,
        vx: 0, vy: 0, age: 1, fx: x + i, fy: y - i, tx: x + i + 1, ty: y - i + 1,
        mt0: .18, moving: false,
        prov: Object.freeze({ hitX: x, hitY: y, dirX: 1, dirY: 0, weaponId: 'PISTOL', sourceId: ct.anchor.id }) };
      state.slots[slot] = shard; members.push(shard);
    }
    const node = { owner: ct, id, x, y, rot, st: 2, t: 1.5, age: .7, t3: 0,
      tlock: 1.1, activeAtClock: 0, formedAtClock: 0, sh: members };
    for (const shard of members) shard.node = node;
    state.nodes.push(node);
    return node;
  };
  const na = addNode(ca, 9001, 213, 377, .41);
  const da = addNode(ca, 9002, 613, 477, -.22);
  const nb = addNode(cb, 9011, 733, 207, .13);
  const db = addNode(cb, 9012, 433, 707, -.31);
  const shardSnapshots = [passiveA, passiveB].map((state) => state.slots.map((shard) =>
    shard && { identity: shard, on: shard.on, x: shard.x, y: shard.y, prov: shard.prov }));
  P.tick(0);

  gate('real per-owner F1 pools bind semantic shards/nodes without mutating gameplay truth', () => {
    const recA = P.inspect().records.find((record) => record.combatantIndex === ca.idx);
    const recB = P.inspect().records.find((record) => record.combatantIndex === cb.idx);
    assert.deepEqual([recA.passive.shardBindings, recA.passive.nodeBindings], [10, 2]);
    assert.deepEqual([recB.passive.shardBindings, recB.passive.nodeBindings], [10, 2]);
    for (const [state, before] of [[passiveA, shardSnapshots[0]], [passiveB, shardSnapshots[1]]]) {
      for (let i = 0; i < state.slots.length; i++) {
        const old = before[i], current = state.slots[i];
        if (!old) { assert.equal(current, null); continue; }
        assert.strictEqual(current, old.identity);
        assert.deepEqual([current.on, current.x, current.y], [old.on, old.x, old.y]);
        assert.strictEqual(current.prov, old.prov);
      }
    }
  });

  const close = (x, y) => Math.abs(x - y) < 1e-9;
  for (const [gold, real] of [[goldA, na], [goldA, da], [goldB, nb], [goldB, db]]) {
    const proxy = gold.ND.find((node) => node.on && node.x === real.x && node.y === real.y);
    assert.ok(proxy);
    assert.strictEqual(proxy.externalGeometry, HR.mirrorNode);
    const origin = HR.mirrorNode.toWorld(real, 0, 0);
    const xAxis = HR.mirrorNode.toWorld(real, 1, 0);
    const yAxis = HR.mirrorNode.toWorld(real, 0, 1);
    assert.deepEqual([proxy.x, proxy.y], [origin.x, origin.y]);
    assert.ok(close(proxy.worldTransform.a, xAxis.x - origin.x));
    assert.ok(close(proxy.worldTransform.b, xAxis.y - origin.y));
    assert.ok(close(proxy.worldTransform.c, yAxis.x - origin.x));
    assert.ok(close(proxy.worldTransform.d, yAxis.y - origin.y));
    for (const [slot, v] of HR.mirrorNode.NV.entries()) {
      const expected = HR.mirrorNode.toWorld(real, v[0], v[1]);
      const projected = { x: proxy.x + v[0] * proxy.worldTransform.a + v[1] * proxy.worldTransform.c,
        y: proxy.y + v[0] * proxy.worldTransform.b + v[1] * proxy.worldTransform.d };
      assert.ok(Math.hypot(projected.x - expected.x, projected.y - expected.y) < 1e-9);
      const realMember = real.sh[slot];
      const goldMember = gold.SH[passiveA === real.owner.store['mirror.passive']
        ? passiveA.slots.indexOf(realMember) : passiveB.slots.indexOf(realMember)];
      assert.ok(proxy.sh.includes(goldMember));
    }
    const surface = HR.mirrorNode.surface(real);
    const first = HR.mirrorNode.toWorld(real, ...HR.mirrorNode.NV[0]);
    const fourth = HR.mirrorNode.toWorld(real, ...HR.mirrorNode.NV[3]);
    assert.deepEqual([surface.ax, surface.ay, surface.bx, surface.by], [first.x, first.y, fourth.x, fourth.y]);
  }
  gate('all real F1 node bases, surfaces, five NV vertices and member slots share HR.mirrorNode geometry', () => {
    assert.equal(goldA.ND.filter((node) => node.on).length, 2);
    assert.equal(goldB.ND.filter((node) => node.on).length, 2);
  });

  const routeCallsA = [], routeCallsB = [];
  for (const [gold, calls] of [[goldA, routeCallsA], [goldB, routeCallsB]]) {
    const present = gold.presentExternalRoute;
    gold.presentExternalRoute = function captureRoute(route) {
      calls.push(route); return present.call(gold, route);
    };
  }
  const projectileA1 = { route: 'A1' }, projectileA2 = { route: 'A2' }, projectileB = { route: 'B1' };
  const visualEvent = (base, projectile, point, direction = { x: 300, y: 0 }, power = 1) => {
    const payload = { ...base };
    Object.defineProperties(payload, {
      projectile: { value: projectile }, point: { value: Object.freeze({ ...point }) },
      direction: { value: Object.freeze({ ...direction }) }, power: { value: power },
    });
    return payload;
  };
  const emit = (type, payload) => bus.emit(type, payload);
  const capture = (owner, entry, destination, projectile, point) => emit('MirrorRouteCapture',
    visualEvent({ owner: owner.idx, entry: entry.id, dest: destination.id, toi: .5,
      weapon: 'PISTOL', type: 'aq_bullet' }, projectile, point));
  const image = (entry, destination, projectile, point) => emit('MirrorEscrowImage',
    visualEvent({ entry: entry.id, dest: destination.id, destLive: true, t: .208 }, projectile, point));
  const emerge = (entry, destination, projectile, point, via = destination.id) => emit('MirrorRouteEmerge',
    visualEvent({ entry: entry.id, via, t: .566, x: point.x, y: point.y,
      weapon: 'PISTOL', type: 'aq_bullet', fallback: via === 'entry-fallback' }, projectile, point));
  capture(ca, na, da, projectileA1, { x: 250, y: 377 });
  capture(ca, na, da, projectileA2, { x: 260, y: 378 });
  capture(cb, nb, db, projectileB, { x: 500, y: 207 });
  image(na, da, projectileA1, { x: 250, y: 377 });
  image(na, da, projectileA2, { x: 260, y: 378 });
  image(nb, db, projectileB, { x: 500, y: 207 });
  gate('semantic route bridge preserves exact same-endpoint and Mirror-v-Mirror projectile identities', () => {
    assert.equal(goldA.externalPassiveAudit().routes, 2);
    assert.equal(goldB.externalPassiveAudit().routes, 1);
    assert.equal(goldA.externalPassiveAudit().imageOwners, 4);
    assert.equal(goldB.externalPassiveAudit().imageOwners, 2);
    for (const [calls, ids] of [[routeCallsA, [projectileA1, projectileA2]], [routeCallsB, [projectileB]]]) {
      const captures = calls.filter((route) => route.kind === 'capture');
      assert.equal(captures.length, ids.length);
      for (let i = 0; i < ids.length; i++) assert.strictEqual(captures[i].routeId, ids[i]);
    }
    assert.equal(goldA.externalPassiveAudit().goldProjectiles, 0);
    assert.equal(goldB.externalPassiveAudit().goldProjectiles, 0);
  });

  emerge(na, da, projectileA1, { x: 613, y: 477 });
  gate('one exact emerge consumes only its route and preserves concurrent route/image owners', () => {
    assert.equal(goldA.externalPassiveAudit().routes, 1);
    assert.equal(goldA.externalPassiveAudit().imageOwners, 2);
    assert.equal(goldB.externalPassiveAudit().routes, 1);
    assert.equal(goldB.externalPassiveAudit().imageOwners, 2);
    assert.strictEqual(routeCallsA.filter((route) => route.kind === 'emerge').at(-1).routeId, projectileA1);
  });
  emerge(na, da, projectileA2, { x: 613, y: 477 });
  emerge(nb, db, projectileB, { x: 433, y: 707 });
  gate('terminal emerge clears only its real Gold route and image owners', () => {
    assert.equal(goldA.externalPassiveAudit().routes, 0);
    assert.equal(goldA.externalPassiveAudit().imageOwners, 0);
    assert.equal(goldB.externalPassiveAudit().routes, 0);
    assert.equal(goldB.externalPassiveAudit().imageOwners, 0);
    assert.deepEqual([goldA.externalPassiveAudit().goldProjectiles,
      goldB.externalPassiveAudit().goldProjectiles], [0, 0]);
    assert.ok(routeCallsA.every((route) => route.routeId !== null));
    assert.ok(routeCallsB.every((route) => route.routeId !== null));
  });

  const canvas = win.document.getElementById('game-canvas');
  P.renderArenaWorldEffects(canvas.getContext('2d'), { stage: 'after-world-before-fighters' });
  const oldCreateElement = win.document.createElement.bind(win.document);
  const oldImage = win.Image;
  let canvases = 0, images = 0;
  win.document.createElement = function countCanvas(name, ...args) {
    if (String(name).toLowerCase() === 'canvas') canvases++;
    return oldCreateElement(name, ...args);
  };
  win.Image = new Proxy(oldImage, { construct(target, args, newTarget) {
    images++; return Reflect.construct(target, args, newTarget);
  } });
  const beforeCreated = P.inspect().scheduler.createdInstances;
  const beforeListeners = P.inspect().listenerCount;
  const beforeStepsA = goldA.externalAudit().steps, beforeStepsB = goldB.externalAudit().steps;
  stepPresentation(P, 120);
  win.document.createElement = oldCreateElement; win.Image = oldImage;
  gate('sustained presentation frames remain allocation-bounded and Gold-clock exact', () => {
    assert.deepEqual([canvases, images], [0, 0]);
    assert.equal(P.inspect().scheduler.createdInstances, beforeCreated);
    assert.equal(P.inspect().listenerCount, beforeListeners);
    assert.equal(goldA.externalAudit().steps - beforeStepsA, 120);
    assert.equal(goldB.externalAudit().steps - beforeStepsB, 120);
    assert.equal(goldA.externalPassiveAudit().goldProjectiles, 0);
    assert.equal(goldB.externalPassiveAudit().goldProjectiles, 0);
  });

  bus.emit('ReworkMatchTeardown', {});
  gate('teardown explicitly clears both Gold semantic instances', () => {
    assert.equal(P.inspect().instanceCount, 0);
    for (const instance of [goldA, goldB]) {
      assert.equal(instance.externalAudit().enabled, false);
      assert.equal(instance.externalPassiveAudit().shardBindings, 0);
      assert.equal(instance.externalPassiveAudit().nodeBindings, 0);
      assert.equal(instance.externalPassiveAudit().routes, 0);
      assert.equal(instance.externalPassiveAudit().imageOwners, 0);
    }
  });
  assert.equal(passed, 7);
  console.log('Mirror G3/R2 real semantic integration: 7/7 passed');
} finally {
  H.dom.window.close();
}
