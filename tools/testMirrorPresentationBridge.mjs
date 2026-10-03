#!/usr/bin/env node
/* CHECKPOINT G1B — lifecycle, root binding and fixed-step production bridge. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createCanvas, Path2D, ImageData } from '@napi-rs/canvas';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
const win = dom.window;
win.Path2D = Path2D;
win.ImageData = ImageData;
let canvasCreations = 0;
let imageCreations = 0;
const createElement = win.document.createElement.bind(win.document);
win.document.createElement = function countedCreateElement(name, ...args) {
  const lower = String(name).toLowerCase();
  if (lower === 'canvas') canvasCreations++;
  if (lower === 'img' || lower === 'image') imageCreations++;
  return createElement(name, ...args);
};
const nativeImage = win.Image;
win.Image = new Proxy(nativeImage, {
  construct(target, args, newTarget) {
    imageCreations++;
    return Reflect.construct(target, args, newTarget);
  },
});
const realCanvases = new WeakMap();
function realCanvasFor(el) {
  let real = realCanvases.get(el);
  const width = el.width || 300;
  const height = el.height || 150;
  if (!real || real.width !== width || real.height !== height) {
    real = createCanvas(width, height);
    realCanvases.set(el, real);
  }
  return real;
}
win.HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type && type !== '2d') return null;
  const target = realCanvasFor(this).getContext('2d');
  return new Proxy(target, {
    get(ctx, prop) {
      const value = Reflect.get(ctx, prop, ctx);
      if (prop === 'drawImage' && typeof value === 'function') {
        return (img, ...args) => value.call(ctx,
          img && (img.__realImage || realCanvases.get(img)
            || (img instanceof win.HTMLCanvasElement ? realCanvasFor(img) : null)) || img,
          ...args);
      }
      return typeof value === 'function' ? value.bind(ctx) : value;
    },
    set(ctx, prop, value) { return Reflect.set(ctx, prop, value, ctx); },
  });
};

const listeners = new Map();
const bus = {
  on(type, fn) {
    let list = listeners.get(type);
    if (!list) listeners.set(type, list = []);
    list.push(fn);
    return () => {
      const current = listeners.get(type);
      if (!current) return;
      const index = current.indexOf(fn);
      if (index >= 0) current.splice(index, 1);
    };
  },
  emit(type, payload = {}) {
    const list = listeners.get(type);
    if (!list) return;
    const event = { type, payload };
    for (const fn of list.slice()) fn(event);
  },
};
const HR = { match: null };
win.APEX_HERO_REWORK = HR;
win.APEX_HERO_REWORK_AIL = { bus };

function body(id, x, y, data = {}) {
  return {
    id, x, y, hp: 100, data,
    dir: { x: 0, y: 0 },
    __hrFrameStart: { x, y },
    __hrFrameMotion: {
      ordinaryAllowed: true,
      locomotionVx: 0, locomotionVy: 0,
      engineForceVx: 0, engineForceVy: 0,
    },
  };
}
function combatant(idx, heroId, anchor, facade = false) {
  return { idx, heroId, anchor, facade };
}
function makeMatch(p1, p2) { return { combatants: [p1, p2] }; }
function install(p1, p2) {
  HR.match = makeMatch(p1, p2);
  bus.emit('ReworkMatchInstall', { p1: p1.heroId, p2: p2.heroId });
  return HR.match;
}
function endMatch() {
  HR.match = null;
  bus.emit('ReworkMatchTeardown', {});
}
function coords(actor) { return { x: actor.x, y: actor.y }; }

try {
  win.eval(fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js', 'utf8'));
  const GOLD = win.APEX_MIRROR_GOLD;
  const realCreateMirrorInstance = GOLD.createMirrorInstance;
  const createdGoldInstances = [];
  GOLD.createMirrorInstance = function countedCreate(options) {
    const instance = realCreateMirrorInstance.call(GOLD, options);
    createdGoldInstances.push(instance);
    return instance;
  };
  win.eval(fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8'));
  const bridge = win.APEX_MIRROR_PRESENTATION;
  assert.equal(bridge.version, 'g2b-actor-a1-a2-presentation');
  assert.equal(bridge.inspect().version, bridge.version, 'inspection reports the installed adapter version');
  assert.equal(bridge.fixedStep, 1 / 120);
  assert.equal(bridge.inspect().instanceCount, 0, 'no Mirror means no Gold instance');
  assert.equal(createdGoldInstances.length, 0);
  assert.deepEqual([...listeners.keys()].sort(), [
    'MirrorA1Cast', 'MirrorA1End', 'MirrorA1Own', 'MirrorA1Whiff',
    'MirrorA2Cast', 'MirrorA2End', 'MirrorA2NoSnap',
    'MirrorExchange', 'ReworkMatchInstall', 'ReworkMatchTeardown',
  ], 'bridge listens only for match lifetime, A1/A2 edges and the real exchange teleport');

  const runtimeSource = fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js', 'utf8');
  const manifestSource = fs.readFileSync('src/game/runtimeManifest.js', 'utf8');
  const adapterSource = fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8');
  assert.equal((runtimeSource.match(/APEX_MIRROR_PRESENTATION\?\.tick\(dt\)/g) || []).length, 1,
    'the adapter has exactly one production tick callsite');
  const postTickStart = runtimeSource.indexOf('function hrPostTick(dt) {');
  const worldTickStart = runtimeSource.indexOf('function tickWorld(dt) {', postTickStart);
  assert.ok(postTickStart >= 0 && worldTickStart > postTickStart);
  assert.match(runtimeSource.slice(postTickStart, worldTickStart),
    /APEX_MIRROR_PRESENTATION\?\.tick\(dt\)/,
    'presentation ticks at the shared post-movement seam');
  assert.match(runtimeSource, /baseStep\(dt\);\s*hrPostTick\(dt\);/,
    'headless AQ.step routes through hrPostTick');
  assert.match(runtimeSource, /baseUpdateFn\(dt\);\s*hrPostTick\(dt\);/,
    'rAF update routes through the same hrPostTick');
  const goldIndex = manifestSource.indexOf('/game/hero-rework/mirrorGoldV1.js');
  const adapterIndex = manifestSource.indexOf('/game/hero-rework/mirrorPresentationRuntime.js');
  assert.ok(goldIndex >= 0 && adapterIndex > goldIndex, 'Gold loads before its production adapter');
  assert.match(manifestSource, /20261002-mirror-v1-r26/,
    'G1B preserves the current r26 runtime lock');
  assert.doesNotMatch(adapterSource, /requestAnimationFrame|setInterval|stepMirror\s*\(/,
    'the bridge owns neither an independent clock nor Gold demo gameplay');

  const noMirror = install(
    combatant(0, 'STALKER', body('legacy-p1', 180, 200), true),
    combatant(1, 'NEWBIE', body('legacy-p2', 800, 200), true),
  );
  assert.equal(bridge.inspect().instanceCount, 0);
  assert.equal(createdGoldInstances.length, 0);
  assert.equal(bridge.tick(1 / 120), false, 'no-Mirror match advances no Gold');
  assert.equal(bridge.inspect().scheduler.advancedSteps, 0);

  endMatch();
  const mirrorP1 = combatant(0, 'MIRROR', body('mirror-p1', 100, 220));
  const foeP1 = combatant(1, 'NEWBIE', body('foe-p1', 500, 220, {
    arsenal: { weaponId: 'PISTOL', meta: { aimAngle: 0.37 } },
  }), true);
  const p1Match = install(mirrorP1, foeP1);
  assert.equal(bridge.inspect().instanceCount, 1, 'P1 Mirror owns exactly one Gold instance');
  assert.equal(createdGoldInstances.length, 1);
  const p1Gold = createdGoldInstances[0];
  assert.equal(p1Gold.externalTruth, true);
  assert.equal(p1Gold.applyExchange, false);
  assert.equal(p1Gold.externalAudit().mirror.x, 100);
  assert.equal(p1Gold.externalAudit().opponent.x, 500);
  assert.equal(p1Gold.F.aim, 0.37, 'real opponent weapon aim is bound without allocating a holder snapshot');

  // Production positions move first; the bridge samples the resolved post-step
  // roots and their real displacement velocity, then Gold reads but never writes.
  mirrorP1.anchor.__hrFrameStart.x = 100;
  mirrorP1.anchor.__hrFrameStart.y = 220;
  mirrorP1.anchor.x = 102;
  foeP1.anchor.__hrFrameStart.x = 500;
  foeP1.anchor.x = 499;
  const afterMovementP1 = [coords(mirrorP1.anchor), coords(foeP1.anchor)];
  assert.equal(bridge.tick(1 / 120), true);
  let p1Audit = p1Gold.externalAudit();
  assert.equal(p1Audit.steps, 1);
  assert.equal(p1Audit.simTime, 1 / 120);
  assert.deepEqual({ ...p1Audit.mirror }, { x: 102, y: 220, vx: 240, vy: 0 });
  assert.deepEqual({ ...p1Audit.opponent }, { x: 499, y: 220, vx: -120, vy: 0 });
  assert.deepEqual([coords(mirrorP1.anchor), coords(foeP1.anchor)], afterMovementP1,
    'Gold presentation never mutates gameplay coordinates');

  mirrorP1.anchor.__hrFrameStart.x = 102;
  mirrorP1.anchor.x = 104;
  foeP1.anchor.__hrFrameStart.x = 499;
  foeP1.anchor.x = 497;
  const beforeSixtyHz = p1Gold.externalAudit().steps;
  bridge.tick(1 / 60);
  assert.equal(p1Gold.externalAudit().steps - beforeSixtyHz, 2,
    'a 60 Hz gameplay frame advances two exact 120 Hz presentation quanta');

  // Actual MirrorExchange is an instantaneous gameplay position swap. The
  // sampled Gold roots are post-swap, while velocity comes from PRE-swap
  // movement positions in the semantic event (not teleport displacement).
  const preSwapMirror = { x: 106, y: 220 };
  const preSwapFoe = { x: 496, y: 220 };
  mirrorP1.anchor.__hrFrameStart.x = 104;
  foeP1.anchor.__hrFrameStart.x = 497;
  mirrorP1.anchor.x = preSwapFoe.x;
  foeP1.anchor.x = preSwapMirror.x;
  bus.emit('MirrorExchange', {
    castId: 'exchange-p1-1',
    self: { id: mirrorP1.anchor.id, from: preSwapMirror, to: coords(mirrorP1.anchor) },
    opponent: { id: foeP1.anchor.id, from: preSwapFoe, to: coords(foeP1.anchor) },
  });
  bridge.tick(1 / 120);
  p1Audit = p1Gold.externalAudit();
  assert.deepEqual({ ...p1Audit.mirror }, { x: preSwapFoe.x, y: 220, vx: 240, vy: 0 });
  assert.deepEqual({ ...p1Audit.opponent }, { x: preSwapMirror.x, y: 220, vx: -120, vy: 0 });
  assert.equal(bridge.inspect().records[0].exchangeEvents, 1);

  const beforeHitch = p1Gold.externalAudit().steps;
  mirrorP1.anchor.__hrFrameStart.x = mirrorP1.anchor.x;
  foeP1.anchor.__hrFrameStart.x = foeP1.anchor.x;
  bridge.tick(1);
  assert.equal(p1Gold.externalAudit().steps - beforeHitch, 8,
    'hitches are capped at eight exact presentation steps');
  assert.ok(bridge.inspect().scheduler.droppedSeconds > 0,
    'excess hitch time is dropped instead of passed raw to Gold');
  assert.equal(p1Gold.applyExchange, false);

  // Re-emitting install for the same match is idempotent.
  bus.emit('ReworkMatchInstall', { p1: 'MIRROR', p2: 'NEWBIE' });
  assert.equal(bridge.inspect().instanceCount, 1);
  assert.equal(createdGoldInstances.length, 1);

  const oldP1History = p1Gold.hist;
  endMatch();
  assert.equal(bridge.inspect().instanceCount, 0, 'teardown releases every live Gold state');
  assert.equal(p1Gold.externalTruth, false, 'teardown disables external truth and clears action state');

  const foeP2 = combatant(0, 'FROST', body('foe-p2', 200, 300), false);
  const mirrorP2 = combatant(1, 'MIRROR', body('mirror-p2', 780, 300));
  install(foeP2, mirrorP2);
  assert.equal(bridge.inspect().instanceCount, 1, 'P2 Mirror also owns one independent Gold instance');
  assert.equal(bridge.inspect().records[0].combatantIndex, 1);
  assert.equal(createdGoldInstances.length, 2);

  const mirrorA = combatant(0, 'MIRROR', body('mirror-a', 180, 400));
  const mirrorB = combatant(1, 'MIRROR', body('mirror-b', 820, 400));
  install(mirrorA, mirrorB);
  assert.equal(bridge.inspect().instanceCount, 2, 'Mirror-v-Mirror is bounded to two live instances');
  assert.equal(createdGoldInstances.length, 4);
  const goldA = createdGoldInstances[2];
  const goldB = createdGoldInstances[3];
  assert.notEqual(goldA, goldB);
  assert.notEqual(goldA.M, goldB.M);
  assert.notEqual(goldA.hist, goldB.hist);
  assert.equal(goldA.externalAudit().mirror.x, 180);
  assert.equal(goldB.externalAudit().mirror.x, 820);

  const canvasCountBeforeFrames = canvasCreations;
  const imageCountBeforeFrames = imageCreations;
  const instanceCountBeforeFrames = createdGoldInstances.length;
  for (let i = 0; i < 100; i++) bridge.tick(1 / 120);
  assert.equal(createdGoldInstances.length, instanceCountBeforeFrames,
    'production frames never create Gold instances');
  assert.equal(canvasCreations, canvasCountBeforeFrames,
    'production frames never create canvases');
  assert.equal(imageCreations, imageCountBeforeFrames,
    'production frames never create images');
  assert.equal(bridge.inspect().instanceCount, 2);
  assert.ok(goldA.externalAudit().steps >= 100 && goldB.externalAudit().steps >= 100);

  endMatch();
  const freshMirror = combatant(0, 'MIRROR', body('mirror-rematch', 300, 500));
  const freshFoe = combatant(1, 'NEWBIE', body('foe-rematch', 700, 500), true);
  install(freshMirror, freshFoe);
  const rematchGold = createdGoldInstances.at(-1);
  assert.equal(bridge.inspect().instanceCount, 1);
  assert.notEqual(rematchGold.hist, oldP1History,
    'rematch creates a fresh Gold history ring instead of retaining stale presentation');
  assert.equal(rematchGold.externalAudit().steps, 0);
  assert.equal(rematchGold.externalAudit().applyExchange, false);

  bridge.dispose();
  assert.equal(win.APEX_MIRROR_PRESENTATION, undefined);
  assert.equal(listeners.get('ReworkMatchInstall').length, 0);
  assert.equal(listeners.get('ReworkMatchTeardown').length, 0);
  assert.equal(listeners.get('MirrorExchange').length, 0);
  assert.equal(listeners.get('MirrorA1Cast').length, 0);
  assert.equal(listeners.get('MirrorA1Own').length, 0);
  assert.equal(listeners.get('MirrorA1Whiff').length, 0);
  assert.equal(listeners.get('MirrorA1End').length, 0);
  assert.equal(listeners.get('MirrorA2Cast').length, 0);
  assert.equal(listeners.get('MirrorA2NoSnap').length, 0);
  assert.equal(listeners.get('MirrorA2End').length, 0);
  console.log('[MIRROR G2B bridge] PASS — G1B fixed-step/lifecycle bridge plus A1/A2 event subscriptions, P1/P2/Mirror-v-Mirror isolation, bounded steps and clean disposal.');
} finally {
  try { win.APEX_MIRROR_PRESENTATION?.dispose(); } catch (error) {}
  dom.window.close();
}
