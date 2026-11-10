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
        putImageData(image, dx, dy, dirtyX = 0, dirtyY = 0,
          dirtyW = image.data.length / 4, dirtyH = 1) {
          assert.equal(dx, 0, 'fluid uploads at source origin');
          assert.equal(dy, 0, 'fluid uploads at source origin');
          // Simulate Canvas2D's six-argument putImageData, copying ONLY the
          // requested dirty rectangle. A fake full-copy here previously let
          // stale pixels outside an incorrectly computed dirty union pass.
          if (!canvas.pixels) canvas.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
          for (let j = dirtyY; j < dirtyY + dirtyH; j++) {
            const p = (j * canvas.width + dirtyX) * 4;
            const bytes = dirtyW * 4;
            canvas.pixels.set(image.data.subarray(p, p + bytes), p);
          }
          canvas.writes += 1;
          writes.push({ canvas, dirtyX, dirtyY, dirtyW, dirtyH });
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
  const smokeCanvas = fluid.cvsByLayer.smoke;
  assert.deepEqual(Buffer.from(smokeCanvas.pixels), Buffer.from(fluid.imgByLayer.smoke.data),
    'partial upload matches the full authoritative image data');
  assert.equal(writes[0].dirtyW * writes[0].dirtyH, 158 * 158,
    'first render uploads full backing store to clear any stale pixels');
  assert.ok(writes[1].dirtyW * writes[1].dirtyH < 158 * 158,
    'subsequent epoch uploads only the live dirty rectangle');

  // The fluid field MOVES across the grid. Both the old and new regions
  // must be rewritten; old smoke pixels must not remain behind.
  fluid.minI = 10; fluid.maxI = 25;
  fluid.minJ = 22; fluid.maxJ = 38;
  fluid.dens.fill(0); fluid.temp.fill(0); fluid.soot.fill(0);
  for (let j = 22; j <= 38; j++) for (let i = 10; i <= 25; i++)
    fluid.dens[j * 158 + i] = 0.45;
  fluid.epoch += 1;
  fluid.draw(ctx, 'smoke');
  assert.deepEqual(Buffer.from(smokeCanvas.pixels), Buffer.from(fluid.imgByLayer.smoke.data),
    'moving-field dirty union leaves no stale pixels');

  // clear() resets stamps without replacing the GPU canvas. The next draw
  // MUST force a full transparent upload to erase prior match imagery.
  fluid.clear();
  fluid.minI = 85; fluid.maxI = 100;
  fluid.minJ = 110; fluid.maxJ = 122;
  for (let j = 110; j <= 122; j++) for (let i = 85; i <= 100; i++)
    fluid.dens[j * 158 + i] = 0.55;
  fluid.draw(ctx, 'smoke');
  assert.equal(writes.at(-1).dirtyW * writes.at(-1).dirtyH, 158 * 158,
    'first draw after clear() must fully erase retained backing pixels');
  assert.deepEqual(Buffer.from(smokeCanvas.pixels), Buffer.from(fluid.imgByLayer.smoke.data),
    'no ghost pixels after match reset');
}
console.log('P0 BOXE memo PASS: HIGH/PERFORMANCE parity, partial upload, move and reset.');
