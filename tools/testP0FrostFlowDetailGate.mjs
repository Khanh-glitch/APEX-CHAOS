// Regression: PERFORMANCE can skip fast-flow strokes, NOT FROST's authored
// cracks or carved gouges; source-over must be restored for the next frame.
// Run: node tools/testP0FrostFlowDetailGate.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = fs.readFileSync(path.join(root, 'public/game/hero-rework/frostGoldV1.js'), 'utf8');
const start = file.indexOf("        const flowBudget = Number.isFinite(gfxFlag(");
const endMarker = '        ctx.globalCompositeOperation = "source-over";\n        return true;';
const finish = file.indexOf(endMarker, start);
assert.ok(start >= 0 && finish > start, 'actual Frost renderer flow and detail region found');
const region = file.slice(start, finish + endMarker.length);
assert.match(region, /if \(this\._motionRatio\(t\) <= flowBudget\)/);
assert.match(region, /\/\/ cracks: dark cut/);
assert.match(region, /\/\/ carve gouges:/);
assert.doesNotMatch(region.slice(0, region.indexOf('// cracks:')), /return true;/,
  'flow budget must not return before cracks and gouges');

const drawRegion = new Function('ctx', 'live', 'carves', 't', 'px', 'gfxFlag', 'sat', region);
function trial(budget, motion = 1, eligible = true) {
  const strokes = [], fills = [];
  const ctx = {
    globalCompositeOperation: 'source-atop',
    strokeStyle: '', fillStyle: '',
    beginPath() {}, moveTo() {}, lineTo() {},
    stroke() { strokes.push(this.strokeStyle); },
    fill() { fills.push(this.fillStyle); },
  };
  const n = {
    x: 200, y: 250, ca: 1, sa: 0,
    L: 70, W: 20, flow: 0.2, born: 0, lockDur: 0.2,
    kind: eligible ? 'lane' : 'patch',
    cracks: [new Float32Array([0, 0, 3, 0, 8, 1])],
    crackAt: [0],
  };
  let carveCalls = 0;
  const owner = {
    _motionRatio: () => motion,
    carvePath: () => { carveCalls++; return true; },
  };
  const result = drawRegion.call(owner, ctx, [n], [{ T: 10 }], 1, 1,
    () => budget, v => Math.max(0, Math.min(1, v)));
  return { strokes, fills, carveCalls, composite: ctx.globalCompositeOperation, result };
}
const perf = trial(0.55);
const high = trial(Infinity);
assert.equal(perf.result, true);
assert.equal(high.result, true);
assert.equal(perf.composite, 'source-over', 'PERFORMANCE compositing state restored');
assert.equal(high.composite, 'source-over', 'HIGH compositing state restored');
assert.deepEqual(perf.strokes, ['#3f78b0', 'rgba(255,255,255,0.85)', '#2f64a0'],
  'PERFORMANCE skips only moving flow strokes, retaining cracks and gouges');
assert.deepEqual(high.strokes, ['rgba(255,255,255,0.58)', ...perf.strokes],
  'HIGH keeps flow strokes and all authored details');
assert.equal(perf.carveCalls, 2);
assert.equal(high.carveCalls, 2);
assert.deepEqual(perf.fills, ['#6da3d2', '#e9f6fd']);
assert.deepEqual(high.fills, perf.fills);
assert.deepEqual(trial(Infinity, 0, false).strokes, perf.strokes,
  'no empty flow stroke when no node is eligible');
console.log('P0 FROST flow/detail PASS: both quality modes preserve cracks, gouges and state.');
