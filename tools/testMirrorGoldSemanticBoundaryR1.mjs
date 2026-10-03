#!/usr/bin/env node
/* R1 — real generated Gold semantic boundary.
 *
 * This deliberately creates Gold instances from the generated production
 * module. SH/ND are Gold's real bounded pools; no stand-in pools are used.
 * A small HR.mirrorNode-compatible geometry object is supplied at the seam,
 * mirroring the shared F1 transform contract without importing gameplay.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createCanvas, Path2D, ImageData } from '@napi-rs/canvas';

const GOLD_PATH = 'docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html';
const RUNTIME_PATH = 'public/game/hero-rework/mirrorGoldV1.js';
const GOLD_SHA = 'c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205';
const GOLD_BYTES = fs.readFileSync(GOLD_PATH);
assert.equal(GOLD_BYTES.length, 107480, 'canonical Gold byte length stays pinned');
assert.equal(createHash('sha256').update(GOLD_BYTES).digest('hex'), GOLD_SHA,
  'canonical Gold SHA stays pinned');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
const win = dom.window;
win.Path2D = Path2D;
win.ImageData = ImageData;
win.Math.random = () => { throw new Error('Gold presentation must not consume ambient Math.random'); };
const realCanvases = new WeakMap();
function realCanvasFor(el) {
  let real = realCanvases.get(el);
  const width = el.width || 300, height = el.height || 150;
  if (!real || real.width !== width || real.height !== height) {
    real = createCanvas(width, height);
    realCanvases.set(el, real);
  }
  return real;
}
function unwrapImage(img) {
  return img && (img.__realImage || realCanvases.get(img)
    || (img instanceof win.HTMLCanvasElement ? realCanvasFor(img) : null)) || img;
}
function proxyContext(ctx) {
  return new Proxy(ctx, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (prop === 'drawImage' && typeof value === 'function')
        return (img, ...args) => value.call(target, unwrapImage(img), ...args);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, prop, value) { return Reflect.set(target, prop, value, target); },
  });
}
win.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type && type !== '2d') return null;
  return proxyContext(realCanvasFor(this).getContext('2d'));
};
win.eval(fs.readFileSync(RUNTIME_PATH, 'utf8'));
const G = win.APEX_MIRROR_GOLD;
assert.ok(G, 'the generated Gold module is loaded in the test realm');
assert.equal(G.ensureBaked(), true, String(G.bakeError));

const checks = [];
function check(name, condition, detail = '') {
  assert.ok(condition, name + (detail ? ': ' + detail : ''));
  checks.push(name);
  console.log('PASS ' + name + (detail ? ' — ' + detail : ''));
}
function close(a, b, epsilon = 1e-8) { return Math.abs(a - b) <= epsilon; }
function point(x, y) { return Object.freeze({ x, y }); }
function root(id, x, y, vx = 0, vy = 0) {
  return Object.freeze({ id, x, y, vx, vy, aim: 0 });
}

const exposed = [
  'syncExternalShardSlot', 'syncExternalNode', 'releaseExternalNode',
  'syncExternalPassive', 'presentExternalRoute', 'rebaseExternalExchangeHistory',
  'clearExternalPassive', 'drawExternalPassive', 'externalPassiveAudit',
];
const apiProbe = G.createMirrorInstance({ seed: 1 });
check('R1-01 canonical source is pinned',
  GOLD_BYTES.length === 107480 && createHash('sha256').update(GOLD_BYTES).digest('hex') === GOLD_SHA);
check('R1-02 generated Gold exposes the semantic API',
  G.goldSha256 === GOLD_SHA && G.checkpoint === 'G1' && G.version === '1.4.0-g1-external-truth-foundation'
    && exposed.every((name) => typeof apiProbe[name] === 'function'));

const main = G.createMirrorInstance({ seed: 0x51A7 });
const STEP = main.constants.STEP;
const NV = Array.from(G.NV, (v) => Array.from(v));
check('R1-03 real Gold pools are bounded',
  main.SH.length === 16 && main.ND.length === 4 && main.PJ.length > 0);
assert.equal(main.enableExternalTruth(root('mirror-main', 480, 520), root('foe-main', 820, 360)), true);

let geometryCalls = 0;
const HR = {
  mirrorNode: {
    NV: NV.map((v) => v.slice()),
    toWorld(n, lx, ly) {
      geometryCalls++;
      const c = Math.cos(n.rot), s = Math.sin(n.rot);
      return { x: n.x + lx * c - ly * s, y: n.y + lx * s + ly * c };
    },
  },
};
const geometry = HR.mirrorNode;
const groupSpecs = [
  { id: 'node-a', slots: [1, 2, 3, 4, 5], x: 480, y: 520, rot: .37 },
  { id: 'node-b', slots: [6, 7, 8, 9, 10], x: 725, y: 385, rot: -.26 },
  { id: 'node-c', slots: [11, 12, 13, 14, 15], x: 520, y: 765, rot: .14 },
];
function edgeMidpoint(spec, i) {
  const a = NV[i], b = NV[(i + 1) % NV.length];
  return geometry.toWorld({ x: spec.x, y: spec.y, rot: spec.rot }, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}
const identities = Array.from({ length: 16 }, (_, i) => Object.freeze({ slot: i, generation: 1 }));
const sources = new Array(16);
for (let i = 0; i < sources.length; i++) {
  let x = 140 + i * 29, y = 155 + i * 17;
  for (const spec of groupSpecs) {
    const member = spec.slots.indexOf(i);
    if (member >= 0) {
      const q = edgeMidpoint(spec, member);
      x = q.x + (member - 2) * .08;
      y = q.y + (2 - member) * .06;
    }
  }
  const provenance = Object.freeze({ hitX: 240 + i, hitY: 390 + i,
    dirX: i % 2 ? -1 : 1, dirY: .15, weaponId: 'semantic-fixture-' + i, sourceId: i + 100 });
  sources[i] = Object.freeze({ identity: identities[i], on: true, st: 0, x, y,
    vx: i + 1, vy: -i, age: .8, moving: false, provenance });
}
const rootSnapshot = JSON.stringify(sources.map((s) => ({ identity: s.identity.slot,
  x: s.x, y: s.y, vx: s.vx, vy: s.vy, age: s.age, moving: s.moving,
  provenance: { ...s.provenance } })));
assert.equal(main.syncExternalPassive({ shards: sources, nodes: [] }), true);
check('R1-04 stable real shard slots map to identical Gold SH indices',
  main.SH[0].x === sources[0].x && main.SH[15].x === sources[15].x
    && main.SH[0].on && main.SH[15].on && main.SH[7].x === sources[7].x);

const slotZero = main.SH[0];
slotZero.ph = 2.345;
slotZero.rot = .77;
assert.equal(main.syncExternalShardSlot({ ...sources[0], slotIndex: 0 }), true);
check('R1-05 same shard identity preserves its Gold visual lifetime',
  main.SH[0] === slotZero && close(slotZero.ph, 2.345) && close(slotZero.rot, .77));

Object.assign(slotZero, { st: 3, rot: 8, ta: 7, side: 'R', pe: 999, pn: 998, ps: 997,
  ph: 996, age: 995, fx: 994, fy: 993, frot: 992, tx: 991, ty: 990,
  trot: 989, tlen: 988, twid: 987, mt0: 986, moving: true, rep: 985,
  repT: 984, spt: 983, sa: 982, dsx: 981, dsy: 980, faceA: 979,
  eyeP: 978, spc: 977, dist: 976, trotAdj: 975, node: { stale: true },
  __externalTravelStarted: true });
const replacementIdentity = Object.freeze({ slot: 0, generation: 2 });
const replacementProvenance = Object.freeze({ hitX: 100, hitY: 200, dirX: 1, dirY: 0,
  weaponId: 'replacement-weapon', sourceId: 201 });
const replacementSource = Object.freeze({ identity: replacementIdentity, on: true, st: 0,
  x: 312, y: 414, vx: 17, vy: -5, age: .25, moving: false,
  provenance: replacementProvenance });
assert.equal(main.syncExternalShardSlot({ ...replacementSource, slotIndex: 0 }), true);
check('R1-06 shard identity replacement clears every prior presentation sentinel',
  slotZero.on && slotZero.st === 0 && slotZero.x === 312 && slotZero.y === 414
    && slotZero.side === 'L' && slotZero.ph !== 996 && slotZero.repT === 0
    && slotZero.dsx === .087 && slotZero.dsy === .087 && slotZero.twid === 0
    && slotZero.tlen === 0 && slotZero.faceA === 0 && !('node' in slotZero)
    && !('dist' in slotZero) && !('trotAdj' in slotZero) && !('__externalTravelStarted' in slotZero));
check('R1-07 immutable hit provenance derives Gold face identity',
  slotZero.side === 'L' && slotZero.pe === main.E.eL && slotZero.pn === main.E.nL
    && slotZero.ps === main.E.sL && close(slotZero.x, replacementSource.x));
check('R1-08 frozen gameplay shard truth remains untouched',
  Object.isFrozen(replacementSource) && Object.isFrozen(replacementProvenance)
    && JSON.stringify(sources.map((s) => ({ identity: s.identity.slot, x: s.x, y: s.y,
      vx: s.vx, vy: s.vy, age: s.age, moving: s.moving,
      provenance: { ...s.provenance } }))) === rootSnapshot);

assert.equal(main.syncExternalShardSlot({ slotIndex: 0, on: false }), true);
check('R1-09 shard release clears the Gold proxy without touching other slots',
  !slotZero.on && slotZero.st === 0 && slotZero.ph === 0 && slotZero.x === 0
    && slotZero.pe === 0 && slotZero.dsx === .087 && main.SH[15].on);

function nodeInput(spec, stage = 1, t = .3, tlock = .1, age = 0, t3 = 0) {
  return Object.freeze({ id: spec.id, x: spec.x, y: spec.y, rot: spec.rot,
    st: stage, t, tlock, age, t3, memberSlots: Object.freeze(spec.slots.slice()) });
}
const nodeA = nodeInput(groupSpecs[0]);
assert.equal(main.syncExternalNode(nodeA, geometry), true);
const proxyA = main.ND.find((n) => n.on);
assert.ok(proxyA);
const assemblyTravel = proxyA.sh[0];
assemblyTravel.frot = 1.234;
assemblyTravel.__externalTravelStarted = true;
assert.equal(main.syncExternalNode(nodeInput(groupSpecs[0], 1, .31, .1), geometry), true);
check('R1-10 stable real node ID retains one ND proxy and its travel visual',
  main.ND.filter((n) => n.on).length === 1 && main.ND[0] === proxyA
    && proxyA.id === undefined && proxyA.sh.length === 5
    && assemblyTravel.__externalTravelStarted && close(assemblyTravel.frot, 1.234));

const occupiedShard = main.SH[1];
Object.assign(occupiedShard, { rot: 99, tx: 98, ty: 97, trot: 96, tlen: 95, twid: 94,
  mt0: 93, faceA: 92, dsx: 91, dsy: 90, dist: 89, trotAdj: 88,
  __externalTravelStarted: true });
const occupiedReplacement = Object.freeze({ identity: Object.freeze({ slot: 1, generation: 2 }),
  on: true, st: 1, x: occupiedShard.x, y: occupiedShard.y, vx: 0, vy: 0, age: .8,
  moving: false, provenance: sources[1].provenance });
assert.equal(main.syncExternalShardSlot({ ...occupiedReplacement, slotIndex: 1 }), true);
const detachedDuringReplacement = proxyA.sh.length === 4 && !('node' in occupiedShard)
  && occupiedShard.tlen === 0 && occupiedShard.twid === 0 && occupiedShard.dsx === .087;
assert.equal(main.syncExternalNode(nodeInput(groupSpecs[0], 1, .32, .1), geometry), true);
const nodeRecoveredAfterShardReplacement = proxyA.sh.length === 5 && occupiedShard.node === proxyA;

const nodeB = nodeInput(groupSpecs[1], 2, 1.45, .72, 1.4, 0);
const nodeC = nodeInput(groupSpecs[2], 1, .24, -1, 0, 0);
assert.equal(main.syncExternalNode(nodeB, geometry), true);
assert.equal(main.syncExternalNode(nodeC, geometry), true);
const proxyB = main.ND.find((n) => n.on && n !== proxyA);
const proxyC = main.ND.find((n) => n.on && n !== proxyA && n !== proxyB);
const overlappingFourth = nodeInput({ ...groupSpecs[0], id: 'node-overlap' }, 1, .2, -1);
const rejectOverlap = main.syncExternalNode(overlappingFourth, geometry);
check('R1-11 node projection stays bounded and cannot double-own shard slots',
  main.ND.length === 4 && main.ND.filter((n) => n.on).length === 3
    && main.externalPassiveAudit().nodeBindings === 3 && rejectOverlap === false
    && detachedDuringReplacement && nodeRecoveredAfterShardReplacement);

const badGeometry = { NV: NV.slice().reverse(), toWorld: geometry.toWorld };
const badGeometryResult = main.syncExternalNode(
  nodeInput({ ...groupSpecs[0], id: 'bad-geometry' }, 1, .2, -1), badGeometry);
check('R1-12 node API requires the canonical shared HR.mirrorNode geometry',
  badGeometryResult === false && main.externalPassiveAudit().nodeBindings === 3 && geometryCalls > 0);

function expectedEdges(spec) {
  return NV.map((a, i) => {
    const b = NV[(i + 1) % NV.length];
    const p0 = geometry.toWorld({ x: spec.x, y: spec.y, rot: spec.rot }, a[0], a[1]);
    const p1 = geometry.toWorld({ x: spec.x, y: spec.y, rot: spec.rot }, b[0], b[1]);
    const mid = geometry.toWorld({ x: spec.x, y: spec.y, rot: spec.rot },
      (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    return { x: mid.x, y: mid.y, rot: Math.atan2(dy, dx) - Math.PI / 2,
      len: Math.hypot(dx, dy) * 1.08 };
  });
}
const edgesA = expectedEdges(groupSpecs[0]);
check('R1-13 all five edge targets derive from canonical NV through shared geometry',
  proxyA.sh.length === 5 && proxyA.sh.every((s) =>
    Math.min(...edgesA.map((e) => Math.hypot(s.tx - e.x, s.ty - e.y))) < .5));
check('R1-14 every edge receives complete orientation, length, and canonical width',
  proxyA.sh.every((s) => {
    const edge = edgesA.reduce((best, e) =>
      Math.hypot(s.tx - e.x, s.ty - e.y) < Math.hypot(s.tx - best.x, s.ty - best.y) ? e : best);
    return close(s.trot, edge.rot) && close(s.tlen, edge.len) && s.twid === 9;
  }));
check('R1-15 Gold node body transform is derived from the same supplied geometry',
  close(proxyA.worldTransform.a, Math.cos(groupSpecs[0].rot))
    && close(proxyA.worldTransform.b, Math.sin(groupSpecs[0].rot))
    && close(proxyA.worldTransform.c, -Math.sin(groupSpecs[0].rot))
    && close(proxyA.worldTransform.d, Math.cos(groupSpecs[0].rot)));
check('R1-16 assembly stagger follows canonical travel-distance order',
  proxyA.sh.every((s, i) => close(s.mt0, .18 + i * .06)));
check('R1-17 node fill derives from canonical tlock and Gold smooth-step',
  close(proxyA.fill, G.sstep(.1 + .04, .1 + .34, .32)));

const nodeAFold = nodeInput(groupSpecs[0], 3, 1.7, .1, 2, .25);
assert.equal(main.syncExternalNode(nodeAFold, geometry), true);
check('R1-18 node fold derives from the real fold clock with canonical easing',
  close(proxyA.fold, G.sstep(0, .5, .25)) && proxyA.fill === 1);
const nodeAActive = nodeInput(groupSpecs[0], 2, 1.55, .82, 2.1, 0);
assert.equal(main.syncExternalNode(nodeAActive, geometry), true);

const visualShard = proxyA.sh[0];
const visualBefore = { x: visualShard.x, y: visualShard.y, age: visualShard.age,
  ph: visualShard.ph, nX: proxyA.x, nY: proxyA.y, nT: proxyA.t,
  nAge: proxyA.age, nT3: proxyA.t3, mX: main.M.x, mY: main.M.y, fX: main.F.x, fY: main.F.y };
proxyA.flash = .6;
proxyA.sw[0].on = true; proxyA.sw[0].t = 0; proxyA.sw[0].d = .7;
proxyA.rp[0].t = .2; proxyA.rp[0].x = 3; proxyA.rp[0].y = -4;
proxyA.img.on = true; proxyA.img.k = 1; proxyA.img.t = .02; proxyA.img.d = .42;
assert.throws(() => main.stepExternalPresentation(1 / 60), { name: 'RangeError' });
assert.equal(main.stepExternalPresentation(STEP), true);
check('R1-19 passive visuals advance only on exact Gold 1/120 steps',
  main.externalAudit().steps === 1 && main.externalPassiveAudit().passiveSteps === 1
    && close(proxyA.sw[0].t, STEP) && close(proxyA.rp[0].t, .2 + STEP)
    && close(proxyA.img.t, .02 + STEP) && close(visualShard.ph, visualBefore.ph + STEP));
check('R1-20 passive advancement never mutates real positions, clocks, or actor roots',
  visualShard.x === visualBefore.x && visualShard.y === visualBefore.y
    && visualShard.age === visualBefore.age && proxyA.x === visualBefore.nX
    && proxyA.y === visualBefore.nY && proxyA.t === visualBefore.nT
    && proxyA.age === visualBefore.nAge && proxyA.t3 === visualBefore.nT3
    && main.M.x === visualBefore.mX && main.M.y === visualBefore.mY
    && main.F.x === visualBefore.fX && main.F.y === visualBefore.fY);

const drawCanvas = createCanvas(1000, 1000);
const drawCtx = proxyContext(drawCanvas.getContext('2d'));
assert.equal(main.drawExternalPassive(drawCtx), true);
check('R1-21 semantic pass draws Gold shards and node visuals from real proxies',
  drawCanvas.getContext('2d').getImageData(480, 520, 1, 1).data[3] > 0);

function routeEvent(kind, routeId, extra = {}) {
  return Object.freeze({ kind, routeId, point: point(480, 520),
    direction: point(3, 4), power: 2, projectileClass: 'thrown-melee', weaponId: 'blade-r1', ...extra });
}
const previewId = Object.freeze({ projectile: 'preview' });
proxyA.img.on = false;
assert.equal(main.presentExternalRoute(routeEvent('preview', previewId,
  { entryNodeId: 'node-a', point: point(476, 515), direction: point(0, 1), power: 3 })), true);
check('R1-22 typed preview uses semantic contact, direction, and supplied power',
  proxyA.img.on && proxyA.img.k === 0 && proxyA.img.pw === 3 && proxyA.img.d === .5
    && main.externalPassiveAudit().routes === 0);

proxyA.rp.forEach((r) => { r.t = 9; r.x = 0; r.y = 0; });
const localPoint = point(proxyA.x + 13, proxyA.y - 7);
const localRoute = Object.freeze({ projectile: 'local' });
assert.equal(main.presentExternalRoute(Object.freeze({ kind: 'local', routeId: localRoute,
  nodeId: 'node-a', point: localPoint })), true);
const localRipple = proxyA.rp[0];
const localDx = localPoint.x - proxyA.x, localDy = localPoint.y - proxyA.y;
check('R1-23 local route feedback retains the real world contact point',
  localRipple.t === 0 && close(localRipple.x, localDx * Math.cos(proxyA.rot) + localDy * Math.sin(proxyA.rot))
    && close(localRipple.y, -localDx * Math.sin(proxyA.rot) + localDy * Math.cos(proxyA.rot))
    && main.externalPassiveAudit().routes === 0);

const routeOne = Object.freeze({ projectile: 'capture-one' });
assert.equal(main.presentExternalRoute(routeEvent('capture', routeOne,
  { entryNodeId: 'node-a', destinationNodeId: 'node-b', point: point(490, 531), power: 1 })), true);
check('R1-24 capture binds exact projectile identity and entry visual ownership',
  proxyA.flash === 1 && proxyA.img.on && proxyA.img.k === 0
    && main.externalPassiveAudit().routes === 1 && main.externalPassiveAudit().imageOwners === 1);

assert.equal(main.presentExternalRoute(routeEvent('destination-image', routeOne,
  { destinationNodeId: 'node-b', destinationLive: true, point: point(725, 385),
    direction: point(-4, 3), power: 3 })), true);
check('R1-25 destination image consumes event power and Gold-authored duration',
  proxyB.img.on && proxyB.img.k === 1 && proxyB.img.pw === 3 && proxyB.img.d === .42
    && close(proxyB.img.dx, -.8) && close(proxyB.img.dy, .6)
    && main.externalPassiveAudit().imageOwners === 2);

const deadRoute = Object.freeze({ projectile: 'lost-destination' });
assert.equal(main.presentExternalRoute(routeEvent('capture', deadRoute,
  { entryNodeId: 'node-a', destinationNodeId: 'node-missing' })), true);
proxyC.img.on = false;
assert.equal(main.presentExternalRoute(routeEvent('destination-image', deadRoute,
  { destinationNodeId: 'node-missing', destinationLive: false })), true);
check('R1-26 non-live destination never invents or displays a fallback image',
  proxyC.img.on === false && main.externalPassiveAudit().routes === 2);

assert.equal(main.presentExternalRoute(Object.freeze({ kind: 'emerge', routeId: routeOne,
  viaNodeId: 'node-b', point: point(731, 394) })), true);
const viaRipple = proxyB.rp.find((r) => r.t === 0);
assert.ok(viaRipple);
assert.equal(main.presentExternalRoute(Object.freeze({ kind: 'emerge', routeId: deadRoute,
  fallback: true, point: point(470, 515) })), true);
check('R1-27 emergence uses supplied via/fallback semantics and clears route owners',
  main.externalPassiveAudit().routes === 0 && main.externalPassiveAudit().imageOwners === 0
    && viaRipple.t === 0);

const releaseRoute = Object.freeze({ projectile: 'release-owner' });
assert.equal(main.presentExternalRoute(routeEvent('capture', releaseRoute,
  { entryNodeId: 'node-b', destinationNodeId: 'node-a' })), true);
assert.equal(main.presentExternalRoute(routeEvent('destination-image', releaseRoute,
  { destinationNodeId: 'node-a', destinationLive: true })), true);
proxyA.img.pw = 77; proxyA.rp[0].t = .25; proxyA.rp[0].x = 44;
proxyA.sw[0].on = true; proxyA.sw[0].t = .3; proxyA.flash = .9;
assert.equal(main.releaseExternalNode('node-a'), true);
const nodeReset = !proxyA.on && proxyA.sh.length === 0 && proxyA.fill === 0 && proxyA.fold === 0
  && proxyA.flash === 0 && proxyA.img.on === false && proxyA.img.pw === 1
  && proxyA.img.t === 0 && proxyA.img.d === .5 && proxyA.rp.every((r) => r.t === 9 && r.x === 0 && r.y === 0)
  && proxyA.sw.every((w) => !w.on && w.t === 0 && w.d === .7 && w.ang === .8 && w.amp === .8)
  && proxyA.worldTransform === null && proxyA.externalGeometry === null;
const memberDetached = groupSpecs[0].slots.every((i) => {
  const s = main.SH[i];
  return s.node !== proxyA && s.trot === 0 && s.tlen === 0 && s.twid === 0
    && s.mt0 === 0 && s.faceA === 0 && s.dsx === .087 && s.dsy === .087
    && !('dist' in s) && !('trotAdj' in s) && !('__externalTravelStarted' in s);
});
assert.equal(main.externalPassiveAudit().routes, 0);
assert.equal(main.externalPassiveAudit().imageOwners, 0);
assert.equal(main.syncExternalNode(nodeInput({ ...groupSpecs[0], id: 'node-a-reused' }), geometry), true);
check('R1-28 node release clears nested Gold state, route ownership, links, and reuses ND cleanly',
  nodeReset && memberDetached && main.ND[0] === proxyA && proxyA.on
    && main.externalPassiveAudit().routes === 0 && main.externalPassiveAudit().imageOwners === 0);

const history = G.createMirrorInstance({ seed: 0xA202 });
assert.equal(history.enableExternalTruth(root('history-m', 100, 200), root('history-f', 500, 600)), true);
for (let i = 0; i < 4; i++) history.pushHist();
const exchange = Object.freeze({ castId: 'history-cast', coalesced: 0,
  self: Object.freeze({ id: 'history-m', from: point(100, 200), to: point(500, 600) }),
  opponent: Object.freeze({ id: 'history-f', from: point(500, 600), to: point(100, 200) }),
  delta: point(400, 400) });
const histBefore = Array.from(history.hist);
const mBefore = [history.M.x, history.M.y], fBefore = [history.F.x, history.F.y];
const a2Before = JSON.stringify(history.A2), cameraBefore = JSON.stringify(history.cam);
assert.equal(history.rebaseExternalExchangeHistory(exchange, 'history-m'), true);
const histRebased = Array.from(history.hist);
const historyShiftCorrect = Array.from({ length: history.HN }, (_, i) => {
  const o = i * history.HS;
  return close(histRebased[o], histBefore[o] + 400) && close(histRebased[o + 1], histBefore[o + 1] + 400)
    && close(histRebased[o + 20], histBefore[o + 20] - 400)
    && close(histRebased[o + 21], histBefore[o + 21] - 400);
}).every(Boolean);
const reversedExchange = Object.freeze({ castId: 'opponent-cast', coalesced: 1,
  self: exchange.opponent, opponent: exchange.self, delta: point(-400, -400) });
const duplicateRejected = history.rebaseExternalExchangeHistory(reversedExchange, 'history-m') === false;
const historyOnly = historyShiftCorrect && duplicateRejected
  && history.M.x === mBefore[0] && history.M.y === mBefore[1]
  && history.F.x === fBefore[0] && history.F.y === fBefore[1]
  && JSON.stringify(history.A2) === a2Before && JSON.stringify(history.cam) === cameraBefore;
assert.equal(history.beginExternalA2('history-cast'), true);
assert.equal(history.applyExternalExchange(exchange, root('history-m', 500, 600), root('history-f', 100, 200)), true);
check('R1-29 history-only A2 rebase deduplicates paired PRE/POST events and caster snap',
  historyOnly && JSON.stringify(Array.from(history.hist)) === JSON.stringify(histRebased)
    && history.externalAudit().snaps === 1 && history.externalPassiveAudit().historyRebases === 1
    && history.M.x === 500 && history.F.x === 100);

const pendingResetRoute = Object.freeze({ projectile: 'reset-before-clear' });
assert.equal(main.presentExternalRoute(routeEvent('capture', pendingResetRoute,
  { entryNodeId: 'node-b', destinationNodeId: 'node-c' })), true);
assert.equal(main.presentExternalRoute(routeEvent('destination-image', pendingResetRoute,
  { destinationNodeId: 'node-c', destinationLive: true })), true);
assert.equal(main.clearExternalTruth(), true);
const resetAudit = main.externalPassiveAudit();
const shardsReset = main.SH.every((s) => !s.on && s.st === 0 && s.x === 0 && s.y === 0
  && s.vx === 0 && s.vy === 0 && s.rot === 0 && s.ph === 0 && s.age === 0
  && s.pe === 0 && s.pn === 0 && s.ps === 0 && s.dsx === .087 && s.dsy === .087
  && !('node' in s) && !('dist' in s) && !('trotAdj' in s));
const nodesReset = main.ND.every((n) => !n.on && n.st === 0 && n.t === 0 && n.age === 0
  && n.x === 0 && n.y === 0 && n.rot === 0 && n.fill === 0 && n.fold === 0 && n.sh.length === 0
  && n.flash === 0 && n.img.on === false && n.img.t === 0 && n.img.pw === 1
  && n.rp.every((r) => r.t === 9 && r.x === 0 && r.y === 0)
  && n.sw.every((w) => !w.on && w.t === 0) && n.worldTransform === null && n.externalGeometry === null);
const projectilesReset = main.PJ.every((p) => !p.on && p.x === 0 && p.y === 0
  && p.vx === 0 && p.vy === 0 && p.nA === null && p.nB === null && p.life === 0
  && p.hn === 0 && p.hc === 0 && Array.from(p.hx).every((v) => v === 0)
  && Array.from(p.hy).every((v) => v === 0));
check('R1-30 external reset clears shard/node/route/image history and all nested Gold state',
  main.externalTruth === false && main.M.id === undefined && main.F.id === undefined
    && shardsReset && nodesReset && projectilesReset && resetAudit.shardBindings === 0
    && resetAudit.nodeBindings === 0 && resetAudit.routes === 0 && resetAudit.imageOwners === 0
    && resetAudit.passiveSteps === 0 && resetAudit.routeEvents === 0 && resetAudit.historyRebases === 0
    && resetAudit.goldProjectiles === 0 && main.A1.on === false && main.A2.on === false);

assert.equal(checks.length, 30, 'R1 gate count is exactly thirty named invariants');
console.log(`\nPASS: ${checks.length}/30 R1 semantic Gold boundary invariants`);
dom.window.close();
