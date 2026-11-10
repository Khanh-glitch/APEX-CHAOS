// P0 render-path contract: source crop retains identical world mapping and
// refuses to shorten the authored filter/alpha/composite effects.
// Run: node tools/testP0FluidRegionGate.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = fs.readFileSync(path.join(root, 'public/game/hero-rework/boxeGoldLibrary.js'), 'utf8');
const frost = fs.readFileSync(path.join(root, 'public/game/hero-rework/frostGoldV1.js'), 'utf8');

// Both production files must parse. No need to initialize the game or canvas.
new vm.Script(file, { filename: 'boxeGoldLibrary.js' });
new vm.Script(frost, { filename: 'frostGoldV1.js' });

const match = file.match(/function drawFluidLiveRegion\(ctx, source, i0, i1, j0, j1\) \{[\s\S]*?\n\}/);
assert.ok(match, 'source-cropping helper must exist');
const N = 158, CELL = 12, OX = -954, OY = -954;
const crop = vm.runInNewContext(match[0] + '\ndrawFluidLiveRegion', {
  exports: { N, CELL }, FLUID_OX: OX, FLUID_OY: OY, FLUID_SZ: N * CELL,
  FLUID_BLUR_GUARD_CELLS: 8,
});
// Cover edge clamping, tiny fields, broad storms and large-field fallback
// deterministically. This was previously a 9-case smoke test.
const rectangles = [
  [60, 80, 60, 82], [0, 8, 0, 9], [140, 157, 149, 157],
  [1, 156, 1, 156], [0, 157, 0, 157], [20, 112, 20, 115],
  [55, 56, 78, 79], [70, 100, 90, 122], [75, 145, 80, 115],
];
for (let i = 0; i <= 150; i += 15) {
  for (let j = 0; j <= 150; j += 15) {
    for (const extent of [1, 4, 13, 28, 56, 120]) {
      rectangles.push([i, Math.min(N - 1, i + extent),
        j, Math.min(N - 1, j + extent)]);
    }
  }
}
let cases = 0;
for (const [i0, i1, j0, j1] of rectangles) {
  const calls = [];
  const source = { width: N, height: N };
  crop({ drawImage: (...args) => calls.push(args) }, source, i0, i1, j0, j1);
  assert.equal(calls.length, 1);
  const args = calls[0];
  assert.equal(args[0], source);
  if (args.length === 5) {
    // Original drawImage(source, x, y, fullW, fullH) fallback.
    assert.deepEqual(args.slice(1), [OX, OY, N * CELL, N * CELL]);
  } else {
    assert.equal(args.length, 9, 'crop draws source and destination rectangles');
    const [sx, sy, sw, sh, dx, dy, dw, dh] = args.slice(1);
    assert.ok(sx <= i0 && sy <= j0 && sx + sw > i1 && sy + sh > j1,
      'crop must cover every live cell');
    assert.ok(sx >= 0 && sy >= 0 && sx + sw <= N && sy + sh <= N,
      'crop must remain in source canvas');
    assert.equal(dx, OX + sx * CELL);
    assert.equal(dy, OY + sy * CELL);
    assert.equal(dw, sw * CELL);
    assert.equal(dh, sh * CELL);
  }
  cases++;
}
assert.equal((file.match(/drawFluidLiveRegion\(ctx, cvs, i0b, i1b, j0b, j1b\)/g) || []).length, 2,
  'both smoke/fire and fire-core passes must crop identically');
assert.ok(file.includes("ctx.filter = layer === 'fire' ? FIRE_BLUR_WIDE : SMOKE_BLUR_WIDE"),
  'authored wide blur must be intact');
assert.ok(file.includes('ctx.filter = FIRE_BLUR_CORE'), 'authored fire core blur must be intact');
assert.match(frost, /if \(this\._motionRatio\(t\) > flowBudget\) \{[\s\S]*?ctx\.globalCompositeOperation = "source-over";[\s\S]*?return true;\s*\}/,
  'FROST must restore composite state before a flow-skip return');
console.log('P0 fluid crop PASS: ' + cases + ' geometry cases, blur passes and FROST state guard.');
