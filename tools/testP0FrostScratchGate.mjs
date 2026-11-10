// P0 Frost scratch-buffer parity gate: actual _motionRatio method stays
// numerically identical to the original 2-array map() implementation.
// Run: node tools/testP0FrostScratchGate.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = fs.readFileSync(path.join(root, 'public/game/hero-rework/frostGoldV1.js'), 'utf8');
const start = file.indexOf('    _motionRatio(t) {');
const end = file.indexOf('    /** Reusable entry slot', start);
assert.ok(start !== -1 && end > start, 'real Frost motion function exists');
const Motion = vm.runInNewContext('class FrostMotion {\n' + file.slice(start, end)
  + '\n}\nFrostMotion');
assert.ok(file.includes('this._renderLive = [];') && file.includes('this._renderCarves = [];'));
assert.match(file, /const live = this\._renderLive;[\s\S]*?const carves = this\._renderCarves;/);
assert.doesNotMatch(file.slice(start, end), /live\.map\(/,
  'Frost motion must not allocate coordinate arrays per frame');

function reference(nodes, state, t) {
  if (!nodes.length) return 0;
  if (!state.prev || state.prev.t <= 0 || t <= state.prev.t) {
    state.prev = { t, x: nodes.map((n) => n.x), y: nodes.map((n) => n.y) };
    return 0;
  }
  const prev = state.prev;
  const dt = Math.max(1e-3, t - prev.t);
  let sum = 0, count = 0;
  for (let i = 0; i < nodes.length && i < prev.x.length; i++) {
    const n = nodes[i];
    if (n.dead) continue;
    const size = Math.max(1, Math.max(n.L, n.W));
    const d = Math.hypot(n.x - prev.x[i], n.y - prev.y[i]);
    sum += d / size;
    count++;
  }
  state.prev = { t, x: nodes.map((n) => n.x), y: nodes.map((n) => n.y) };
  return count ? (sum / count) / dt : 0;
}

const m = new Motion(), state = {};
let seed = 42, t = 0;
function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
for (let frame = 0; frame < 900; frame++) {
  t += frame % 53 === 0 ? -0.07 : 0.016 + rnd() * 0.008;
  const count = frame % 37 === 0 ? 0 : Math.floor(rnd() * 31);
  const nodes = Array.from({ length: count }, () => ({
    x: rnd() * 1000, y: rnd() * 1000,
    L: 10 + rnd() * 200, W: 10 + rnd() * 200, dead: rnd() < 0.1,
  }));
  m.nodes = nodes;
  const old = reference(nodes, state, t);
  const actual = m._motionRatio(t);
  assert.equal(actual, old, 'frame ' + frame + ': Frost motion budget changed');
}
console.log('P0 FROST scratch PASS: 900/900 motion frame parity, reusable render arrays.');
