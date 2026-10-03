#!/usr/bin/env node
/* CHECKPOINT G1 — external-truth foundation for isolated Gold instances.
 *
 * This gate proves the production API accepts real actor samples, advances only
 * exact presentation ticks, cannot apply the gameplay exchange, and waits for
 * real Mirror end/exchange events instead of self-authoring lifecycle edges.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createCanvas, Path2D, ImageData } from '@napi-rs/canvas';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
const win = dom.window;
win.Path2D = Path2D; win.ImageData = ImageData;
const realCanvases = new WeakMap();
function realCanvasFor(el) {
  let real = realCanvases.get(el);
  const width = el.width || 300, height = el.height || 150;
  if (!real || real.width !== width || real.height !== height) {
    real = createCanvas(width, height); realCanvases.set(el, real);
  }
  return real;
}
win.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type && type !== '2d') return null;
  const target = realCanvasFor(this).getContext('2d');
  return new Proxy(target, {
    get(ctx, prop) {
      const value = Reflect.get(ctx, prop, ctx);
      if (prop === 'drawImage' && typeof value === 'function') {
        return (img, ...args) => value.call(ctx,
          img && (img.__realImage || realCanvases.get(img) || (img instanceof win.HTMLCanvasElement ? realCanvasFor(img) : null)) || img,
          ...args);
      }
      return typeof value === 'function' ? value.bind(ctx) : value;
    },
    set(ctx, prop, value) { return Reflect.set(ctx, prop, value, ctx); },
  });
};
try {
  win.eval(fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js', 'utf8'));
  const G = win.APEX_MIRROR_GOLD;
  assert.equal(G.checkpoint, 'G1');
  assert.match(G.version, /g1-external-truth-foundation/);
  assert.equal(G.goldSha256, 'c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205');
  assert.equal(G.ensureBaked(), true, String(G.bakeError));

  const root = (id, x, y, vx = 0, vy = 0, aim = 0, extra = {}) =>
    Object.freeze({ id, x, y, vx, vy, aim, ...extra });
  const m0 = root('mirror-a', 410, 500, 0, 0, 0);
  const f0 = root('foe-a', 770, 500, 0, 0, Math.PI, { armed: true });
  const A = G.createMirrorInstance({ seed: 81 });
  const B = G.createMirrorInstance({ seed: 81 });
  assert.notEqual(A.M, B.M, 'instances own separate actor proxies');
  assert.notEqual(A.hist, B.hist, 'instances own separate history rings');
  assert.equal(A.enableExternalTruth(m0, f0), true);
  assert.equal(B.enableExternalTruth(root('mirror-b', 240, 330), root('foe-b', 900, 820)), true);
  assert.equal(A.applyExchange, false);
  A.setApplyExchange(true);
  assert.equal(A.applyExchange, false, 'external-truth instances cannot enable local actor swaps');
  assert.equal(A.syncExternalTruth(root('bad', NaN, 0), f0), false);
  assert.throws(() => A.stepExternalPresentation(1 / 60), { name: 'RangeError' });
  assert.equal(A.externalAudit().steps, 0, 'rejected raw frame dt does not advance presentation');

  const moving = root('mirror-a', 410, 500, 120, 0, 0);
  assert.equal(A.syncExternalTruth(moving, f0), true);
  const beforeStep = { x: A.M.x, y: A.M.y, vx: A.M.vx, vy: A.M.vy };
  const STEP = A.constants.STEP;
  for (let i = 0; i < 8; i++) assert.equal(A.stepExternalPresentation(STEP), true);
  assert.deepEqual({ x: A.M.x, y: A.M.y, vx: A.M.vx, vy: A.M.vy }, beforeStep,
    'presentation ticks preserve the latest real APEX root and velocity');
  assert.equal(A.externalAudit().steps, 8);
  assert.equal(B.externalAudit().steps, 0, 'stepping one Mirror cannot advance another instance');
  assert.equal(moving.x, 410, 'frozen gameplay samples are read-only');
  assert.equal(A.M.x, 410);

  // Gold may animate to its A2 snap crossing but cannot snap/end itself. The
  // authoritative MirrorExchange event supplies the PRE-swap roots and the
  // adapter supplies the already-committed POST-swap roots.
  const preM = root('mirror-a', 410, 500, 120, 0, 0);
  const preF = root('foe-a', 770, 500, -40, 5, Math.PI, { armed: true });
  assert.equal(A.syncExternalTruth(preM, preF), true);
  assert.equal(A.beginExternalA2('a2-cast-1'), true);
  const camBefore = { sx: A.cam.sx.x, svx: A.cam.sx.v, sy: A.cam.sy.x, svy: A.cam.sy.v };
  for (let i = 0; i < 82; i++) A.stepExternalPresentation(STEP);
  assert.equal(A.A2.on, true, 'Gold does not own the real A2 end event');
  assert.equal(A.M.x, 410);
  assert.equal(A.F.x, 770);
  assert.equal(A.externalAudit().snaps, 0, 'the Gold .25 threshold is visual only in external-truth mode');
  assert.equal(A.externalAudit().applyExchange, false);
  assert.deepEqual({ sx: A.cam.sx.x, svx: A.cam.sx.v, sy: A.cam.sy.x, svy: A.cam.sy.v }, camBefore,
    'production snap timing does not mutate Gold demo camera springs');

  const event = Object.freeze({
    hero: 'MIRROR', castId: 'a2-cast-1',
    self: Object.freeze({ id: 'mirror-a', from: Object.freeze({ x: 410, y: 500 }), to: Object.freeze({ x: 770, y: 500 }) }),
    opponent: Object.freeze({ id: 'foe-a', from: Object.freeze({ x: 770, y: 500 }), to: Object.freeze({ x: 410, y: 500 }) }),
  });
  const postM = root('mirror-a', 770, 500, -40, 5, 0.1);
  const postF = root('foe-a', 410, 500, 120, 0, Math.PI, { armed: true });
  assert.equal(A.applyExternalExchange({ ...event, castId: 'wrong-cast' }, postM, postF), false,
    'exchange event must match the active real A2 cast');
  assert.equal(A.applyExternalExchange(event, postM, postF), true);
  assert.equal(A.externalAudit().snaps, 1, 'one real exchange invokes authored a2Snap exactly once');
  assert.equal(A.externalAudit().exchanges, 1);
  assert.equal(A.externalAudit().lastExchangeCastId, 'a2-cast-1');
  assert.equal(A.M.x, 770); assert.equal(A.M.vx, -40);
  assert.equal(A.F.x, 410); assert.equal(A.F.vx, 120);
  assert.equal(A.hs(0, 0), 770); assert.equal(A.hs(0, 20), 410,
    'Gold history is rebased from PRE-swap to POST-swap roots');
  assert.equal(A.applyExternalExchange(event, postM, postF), false, 'duplicate event is ignored');
  const otherIdEvent = { ...event, castId: 'a2-cast-2' };
  assert.equal(A.applyExternalExchange(otherIdEvent, postM, postF), false,
    'one external exchange can resolve only once per active A2');
  assert.equal(A.externalAudit().snaps, 1);
  assert.equal(A.endExternalA2('wrong-cast'), false);
  assert.equal(A.endExternalA2('a2-cast-1'), true);
  assert.equal(A.A2.on, false);

  // A1 keeps its authored pose, but OWN and END are not Gold-owned events in
  // external-truth mode; the actual APEX Mirror events close those edges.
  const C = G.createMirrorInstance({ seed: 82 });
  assert.equal(C.enableExternalTruth(root('mirror-c', 400, 500), root('foe-c', 720, 500, 0, 0, Math.PI, { armed: true })), true);
  let ownEdges = 0;
  C.on('ownEdge', () => { ownEdges++; });
  assert.equal(C.beginExternalA1('a1-cast-1', false), true);
  for (let i = 0; i < 205; i++) C.stepExternalPresentation(STEP);
  assert.equal(C.A1.on, true, 'Gold does not own the real A1 end event');
  assert.equal(C.M.copyOn, false, 'Gold does not claim gameplay OWN or a held weapon');
  assert.equal(ownEdges, 0, 'external-truth OWN is owned by real MirrorA1Own');
  assert.equal(C.endExternalA1('wrong-cast'), false);
  assert.equal(C.endExternalA1('a1-cast-1'), true);
  assert.equal(C.A1.on, false);
  assert.equal(C.clearExternalTruth(), true);
  assert.equal(C.externalTruth, false);
  assert.equal(C.stepExternalPresentation(STEP), false);

  const audit = A.externalAudit();
  assert.equal(audit.enabled, true);
  assert.equal(audit.fixedStep, 1 / 120);
  assert.equal(audit.applyExchange, false);
  console.log('[MIRROR G1 external truth] PASS — fixed tick, actor immutability, deferred A1/A2 edges, single history rebase, instance isolation.');
} finally {
  dom.window.close();
}
