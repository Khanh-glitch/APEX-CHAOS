// P0 BOXE smoke raster memo contract.
// This runs the actual Fluid class, with a minimal Canvas 2D recording stub,
// to prove that two independent destination blends retain identical source
// pixels while only one ImageData upload is required per simulation epoch.
// Run: node tools/testP0FluidMemoGate.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = fs.readFileSync(path.join(root, 'public/game/hero-rework/boxeGoldLibrary.js'), 'utf8');
const start = text.indexOf('class Fluid {');
const stop = text.indexOf('exports.Fluid = Fluid;', start);
assert.ok(start !== -1 && stop > start, 'canonical BOXE Fluid implementation found');
const helperStart = text.indexOf('const FLUID_BLUR_GUARD_CELLS =');
const helperStop = text.indexOf('/* blackbody-ish LUT:', helperStart);
assert.ok(helperStart !== -1 && helperStop > helperStart, 'canonical crop helper found');
const fluidClass = text.slice(start, stop);
const cropHelper = text.slice(helperStart, helperStop);
assert.match(fluidClass, /const paintKey = layer;/, 'smoke raster keyed by material');
assert.doesNotMatch(fluidClass, /'smoke-soft'/, 'no second smoke texture');

function makeFluid(mode) {
  const writes = [];
  const document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { width: 0, height: 0, pixels: null, writes: 0 };
      canvas.getContext = () => ({
        canvas,
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData(image) {
          canvas.pixels = new Uint8ClampedArray(image.data);
          canvas.writes += 1;
          writes.push(canvas);
        },
      });
      return canvas;
    },
  };
  const N = 158, CELL = 12, HALF = 936;
  const BB = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    BB[i * 3] = i; BB[i * 3 + 1] = Math.floor(i / 2); BB[i * 3 + 2] = Math.floor(i / 3);
  }
  const sandbox = {
    document,
    exports: { N, CELL, HALF, BB },
    FLUID_OX: -954, FLUID_OY: -954, FLUID_SZ: 1896,
    FIRE_BLUR_WIDE: 'blur(7px)',
    FIRE_BLUR_CORE: 'blur(2.5px)',
    SMOKE_BLUR_WIDE: 'blur(6px)',
    gfxFlag: () => mode,
    clamp: (v, a, b) => v < a ? a : v > b ? b : v,
    lerp: (a, b, t) => a + (b - a) * t,
  };
  const Fluid = vm.runInNewContext(cropHelper + '\n' + fluidClass + '\nFluid', sandbox);
  return { fluid: new Fluid(), writes };
}

for (const mode of [1, 0]) {
  const { fluid, writes } = makeFluid(mode);
  fluid.minI = 52; fluid.maxI = 91;
  fluid.minJ = 64; fluid.maxJ = 95;
  fluid.epoch = 5;
  for (let j = 64; j <= 95; j++) for (let i = 52; i <= 91; i++) {
    const idx = j * 158 + i;
    fluid.dens[idx] = 0.22 + ((i * 3 + j * 7) % 17) * 0.03;
    fluid.temp[idx] = ((i + j * 2) % 23) * 0.016;
    fluid.soot[idx] = ((i * 5 + j) % 11) / 11;
  }
  const draws = [];
  const ctx = {
    globalAlpha: 1, filter: 'none',
    save() {}, restore() {},
    drawImage(canvas, ...args) {
      draws.push({ bytes: Buffer.from(canvas.pixels), alpha: this.globalAlpha, filter: this.filter, args });
    },
  };
  // Both layers are composited independently; only the SOURCE raster is reused.
  fluid.draw(ctx, 'smoke');
  fluid.softPass = true;
  ctx.globalAlpha = 0.45;
  fluid.draw(ctx, 'smoke');
  assert.equal(draws.length, 2, 'back and front smoke draws both retained');
  assert.equal(writes.length, 1, 'one ImageData upload for both smoke passes');
  assert.equal(fluid.cvsByLayer['smoke-soft'], undefined, 'no redundant second canvas');
  assert.deepEqual(draws.map((x) => x.alpha), [1, 0.45]);
  assert.deepEqual(draws.map((x) => x.filter), ['blur(6px)', 'blur(6px)']);
  assert.deepEqual(draws[0].bytes, draws[1].bytes, 'source pixels identical between passes');

  const first = Buffer.from(draws[1].bytes);
  fluid.epoch += 1;
  fluid.dens[75 * 158 + 75] += 0.5;
  fluid.draw(ctx, 'smoke');
  assert.equal(writes.length, 2, 'new simulation epoch re-rasterizes once');
  assert.notDeepEqual(draws[2].bytes, first, 'changed density reaches the next frame');
}
console.log('P0 BOXE memo PASS: HIGH/PERFORMANCE preserve 2 blends, 1 raster per epoch.');
