#!/usr/bin/env node
/* CHECKPOINT G1 — external-truth foundation for isolated Gold instances.
 *
 * This gate proves the production API accepts real actor samples, advances only
 * exact presentation ticks, cannot apply the gameplay exchange, and waits for
 * real Mirror end/exchange events instead of self-authoring lifecycle edges.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createCanvas, Path2D, ImageData } from '@napi-rs/canvas';

const GOLD_PATH = 'docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html';
const GOLD_SHA = 'c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205';
const canonicalGold = fs.readFileSync(GOLD_PATH);
assert.equal(canonicalGold.length, 107480, 'canonical Gold byte length is pinned');
assert.equal(createHash('sha256').update(canonicalGold).digest('hex'), GOLD_SHA,
  'canonical Gold SHA-256 is pinned');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
const win = dom.window;
win.Path2D = Path2D; win.ImageData = ImageData;
let ambientRandomCalls = 0;
win.Math.random = () => { ambientRandomCalls++; return 0.5; };
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
  for (const method of ['enableExternalTruth', 'syncExternalTruth', 'stepExternalPresentation',
    'beginExternalA1', 'markExternalA1Whiff', 'beginExternalA2', 'applyExternalExchange',
    'endExternalA1', 'endExternalA2', 'clearExternalTruth', 'externalAudit']) {
    assert.equal(typeof A[method], 'function', `external-truth API exposes ${method}`);
  }
  const externalStepSource = A.stepExternalPresentation.toString();
  assert.ok(!['stepMirror(', 'stepFoe(', 'stepProj(', 'stepShards(', 'stepNodes(']
    .some((call) => externalStepSource.includes(call)),
    'shipping presentation step never enters Gold demo movement or lifecycle');
  assert.notEqual(A.M, B.M, 'instances own separate actor proxies');
  assert.notEqual(A.hist, B.hist, 'instances own separate history rings');
  assert.equal(A.enableExternalTruth(m0, f0), true);
  assert.equal(B.enableExternalTruth(root('mirror-b', 240, 330), root('foe-b', 900, 820)), true);
  const bBeforeAAdvance = {
    mirror: { x: B.M.x, y: B.M.y, vx: B.M.vx, vy: B.M.vy },
    opponent: { x: B.F.x, y: B.F.y, vx: B.F.vx, vy: B.F.vy },
    hHead: B.hHead, history: Array.from(B.hist), expression: JSON.stringify(B.E),
  };
  assert.equal(A.applyExchange, false);
  A.setApplyExchange(true);
  assert.equal(A.applyExchange, false, 'external-truth instances cannot enable local actor swaps');
  assert.equal(A.syncExternalTruth(root('bad', NaN, 0), f0), false);
  assert.throws(() => A.stepExternalPresentation(1 / 60), { name: 'RangeError' });
  assert.equal(A.externalAudit().steps, 0, 'rejected raw frame dt does not advance presentation');

  const moving = root('mirror-a', 410, 500, 120, 0, 0);
  assert.equal(A.syncExternalTruth(moving, f0), true);
  const beforeStep = { x: A.M.x, y: A.M.y, vx: A.M.vx, vy: A.M.vy };
  const opponentBeforeStep = { x: A.F.x, y: A.F.y, vx: A.F.vx, vy: A.F.vy };
  const STEP = A.constants.STEP;
  for (let i = 0; i < 8; i++) assert.equal(A.stepExternalPresentation(STEP), true);
  assert.deepEqual({ x: A.M.x, y: A.M.y, vx: A.M.vx, vy: A.M.vy }, beforeStep,
    'presentation ticks preserve the latest real Mirror root and velocity');
  assert.deepEqual({ x: A.F.x, y: A.F.y, vx: A.F.vx, vy: A.F.vy }, opponentBeforeStep,
    'presentation ticks preserve the latest real opponent root and velocity');
  assert.equal(A.externalAudit().steps, 8);
  assert.ok(Math.abs(A.externalAudit().simTime - 8 * STEP) < 1e-12,
    'Gold presentation time advances once per exact fixed tick');
  assert.equal(B.externalAudit().steps, 0, 'stepping one Mirror cannot advance another instance');
  assert.deepEqual({
    mirror: { x: B.M.x, y: B.M.y, vx: B.M.vx, vy: B.M.vy },
    opponent: { x: B.F.x, y: B.F.y, vx: B.F.vx, vy: B.F.vy },
    hHead: B.hHead, history: Array.from(B.hist), expression: JSON.stringify(B.E),
  }, bBeforeAAdvance, 'root, expression, springs and history are isolated per Mirror instance');
  assert.equal(moving.x, 410, 'frozen gameplay samples are read-only');
  assert.equal(A.M.x, 410);

  // Deliberately place external roots at Gold's demo wall/body-collision
  // thresholds. External presentation must preserve both authoritative roots.
  const noDemoPhysics = G.createMirrorInstance({ seed: 83 });
  assert.equal(noDemoPhysics.enableExternalTruth(
    root('wall-root', 20, 420, 0, 0), root('overlap-root', 50, 420, 0, 0, Math.PI)), true);
  assert.equal(noDemoPhysics.stepExternalPresentation(STEP), true);
  assert.deepEqual([noDemoPhysics.M.x, noDemoPhysics.M.y, noDemoPhysics.F.x, noDemoPhysics.F.y],
    [20, 420, 50, 420], 'no Gold wall clamp or body-collision correction runs');

  // The presentation-only queue, tween pool, springs and history all advance
  // once, while D4 gameplay-shaped pools remain read-only.
  const scheduled = G.createMirrorInstance({ seed: 84 });
  assert.equal(scheduled.enableExternalTruth(root('scheduled-m', 300, 400), root('scheduled-f', 700, 400)), true);
  let queued = 0;
  scheduled.later(STEP, () => { queued++; });
  scheduled.tw(scheduled.E, 'gap', 12, 0.12);
  scheduled.H.L.x.v = 120;
  const historyHead = scheduled.hHead;
  const springX = scheduled.H.L.x.x;
  const projectile = scheduled.PJ[0];
  const shard = scheduled.SH[0];
  const node = scheduled.ND[0];
  Object.assign(projectile, { on: true, x: 180, y: 190, vx: 240, vy: -30, t: 0.25, life: 1.2 });
  Object.assign(shard, { on: true, st: 1, x: 220, y: 230, vx: 30, vy: 40, age: 0.3 });
  Object.assign(node, { on: true, st: 1, t: 0.4, age: 0.5, x: 520, y: 530, fill: 0.6 });
  node.img.on = true; node.img.t = 0.2;
  const d4Before = JSON.stringify({ projectile, shard, node });
  assert.equal(scheduled.stepExternalPresentation(STEP), true);
  assert.equal(queued, 1, 'presentation timed callbacks advance by one fixed step');
  assert.ok(scheduled.E.gap > 0, 'authored Gold tween advances');
  assert.notEqual(scheduled.H.L.x.x, springX, 'authored body spring advances');
  assert.equal(scheduled.hHead, (historyHead + 1) % scheduled.HN, 'one history sample is pushed');
  assert.ok(Math.abs(scheduled.externalAudit().simTime - STEP) < 1e-12);
  assert.equal(JSON.stringify({ projectile, shard, node }), d4Before,
    'no demo projectile, shard or node lifecycle advances in the external step');

  // Real externally supplied velocity drives authored start/reaction pose, but
  // the presentation step still cannot integrate either actor root.
  const locomotion = G.createMirrorInstance({ seed: 85 });
  assert.equal(locomotion.enableExternalTruth(root('motion-m', 360, 340), root('motion-f', 760, 340)), true);
  assert.equal(locomotion.syncExternalTruth(root('motion-m', 360, 340, 160, 0),
    root('motion-f', 760, 340, -25, 0, Math.PI)), true);
  assert.equal(locomotion.stepExternalPresentation(STEP), true);
  assert.equal(locomotion.M.x, 360); assert.equal(locomotion.M.y, 340);
  assert.equal(locomotion.F.x, 760); assert.equal(locomotion.F.y, 340);
  assert.equal(locomotion.M.mv, 1, 'real post-movement velocity activates the Gold presentation reaction');
  assert.ok(locomotion.H.L.x.v > 0, 'real velocity drives authored start recoil');

  // Gold may animate to its A2 snap crossing but cannot snap/end itself. The
  // authoritative MirrorExchange event supplies the PRE-swap roots and the
  // adapter supplies the already-committed POST-swap roots.
  const preM = root('mirror-a', 410, 500, 120, 0, 0);
  const preF = root('foe-a', 770, 500, -40, 5, Math.PI, { armed: true });
  assert.equal(A.syncExternalTruth(preM, preF), true);
  assert.equal(A.beginExternalA2('a2-cast-1'), true);
  const camBefore = { sx: A.cam.sx.x, svx: A.cam.sx.v, sy: A.cam.sy.x, svy: A.cam.sy.v };
  for (let i = 0; i < 82; i++) A.stepExternalPresentation(STEP);
  assert.ok(A.A2.t > STEP && A.A2.u > 0.25, 'authored A2 timeline advances through its visual snap crossing');
  assert.ok(Math.abs(A.externalAudit().simTime - 90 * STEP) < 1e-12,
    'presentation simT advances exactly once for each fixed step');
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
  assert.ok(C.A1.t > 1.6 && C.A1.u > 0.92, 'authored A1 timeline advances past its visual end crossing');
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

  const failedOwn = G.createMirrorInstance({ seed: 86 });
  assert.equal(failedOwn.enableExternalTruth(root('failed-own-m', 300, 400), root('failed-own-f', 700, 400)), true);
  assert.equal(failedOwn.beginExternalA1('failed-own-cast', false), true);
  assert.equal(failedOwn.markExternalA1Whiff('other-cast'), false, 'late whiff cannot cross action identity');
  assert.equal(failedOwn.markExternalA1Whiff('failed-own-cast'), true,
    'real OWN failure can suppress the reflected copy after cast-time eligibility');
  assert.equal(failedOwn.A1.whiff, true);
  assert.equal(failedOwn.M.copyOn, false, 'late whiff never grants or consumes Gold demo equipment');

  const rngA = G.createMirrorInstance({ seed: 0x12345678 });
  const rngB = G.createMirrorInstance({ seed: 0x12345678 });
  const rngReference = G.createMirrorInstance({ seed: 0x12345678 });
  assert.equal(rngA.random(), rngB.random(), 'same seed starts the dedicated presentation streams identically');
  rngA.random(); // Advancing one Mirror must not consume another instance's stream.
  rngReference.random();
  const expectedSecond = rngReference.random();
  assert.equal(rngB.random(), expectedSecond, 'presentation RNG state is instance-local');
  assert.equal(rngA.random(), rngReference.random(), 'presentation RNG remains deterministic after isolated advancement');
  assert.equal(ambientRandomCalls, 0, 'Gold stepping and choreography never consume ambient Math.random');
  console.log('[MIRROR G1 external truth] PASS — canonical Gold identity, fixed tick/time, immutable external roots, no demo physics/lifecycle, queue/tween/spring/history, real A1/A2 edges, deterministic per-instance RNG.');
} finally {
  dom.window.close();
}
