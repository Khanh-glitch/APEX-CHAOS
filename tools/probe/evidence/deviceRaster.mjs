// deviceRaster.mjs — does a destination-side ctx.filter force the whole canvas
// layer to be re-rasterised at DEVICE resolution?
//
// filterLaw.mjs showed the same 560x560 filtered draw costs
//     266 ms into a 1000x1000 canvas
//    1052 ms into a 2000x2000 canvas
// i.e. cost tracked DESTINATION AREA (4x area -> ~4x time), not region area.
// The product canvas is 1000x1000 in CSS px on a DPR-3.5 phone, so the layer is
// rasterised at 3500x3500 device px. If the engine re-rasterises the whole layer
// whenever ctx.filter is set, then moving the blur OFF the destination is a
// device-resolution win, not a region win.
//
// Method: a real DOM page, canvas mounted with CSS size 1000x1000 (the product
// geometry), animated in requestAnimationFrame. Each frame performs one of three
// composites. We record rAF deltas - that is frame pacing, the metric that
// actually matters - instead of Canvas submit time.
//
// Usage: DPR=3.5 FRAMES=180 bash boot.sh evidence/deviceRaster.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const DPR = Number(process.env.DPR || 3.5);
const FRAMES = Number(process.env.FRAMES || 180);
const OUT = process.env.OUT || '/tmp/deviceRaster.json';

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox', '--disable-frame-rate-limit'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: DPR });
await page.setContent(`<!doctype html><html><body style="margin:0;background:#000">
<style>#game-canvas{width:1000px;height:1000px;display:block}</style>
<canvas id="game-canvas" width="1000" height="1000"></canvas></body></html>`);

const out = await page.evaluate(async (FRAMES) => {
  const cv = document.getElementById('game-canvas');
  const ctx = cv.getContext('2d', { alpha: false });
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };

  // A background scene so the canvas is never empty (an empty canvas can be
  // skipped by the rasteriser and would hide the effect).
  const bg = mk(1000, 1000);
  const bgx = bg.getContext('2d');
  for (let i = 0; i < 900; i++) {
    bgx.fillStyle = `hsl(${(i * 37) % 360},40%,${18 + (i % 5) * 4}%)`;
    bgx.fillRect((i * 53) % 980, (i * 97) % 980, 60, 60);
  }

  // Bloom source: half-res emissive surface for a 560 px region.
  const src = mk(280, 280);
  const sx = src.getContext('2d');
  sx.fillStyle = '#ffb343';
  for (let i = 0; i < 40; i++) sx.fillRect(20 + i * 6, 20 + i * 5, 46, 46);
  // Pre-blurred wide variant (what the legacy two-pass produces).
  const pre = mk(280, 280);
  const px = pre.getContext('2d');
  px.globalCompositeOperation = 'copy';
  px.filter = 'blur(4.5px)';
  px.drawImage(src, 0, 0);
  px.filter = 'none';

  const R = 560, DX = 220, DY = 220;

  const modes = {
    // (1) current HIGH: wide blur applied on the destination
    destinationFilter() {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.56;
      ctx.drawImage(src, DX, DY, R, R);
      ctx.filter = 'blur(9px)';
      ctx.globalAlpha = 0.25;
      ctx.drawImage(pre, DX, DY, R, R);
      ctx.filter = 'none';
    },
    // (2) legacy two-pass equivalent: wide blur precomputed offscreen
    offscreenWide() {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.56;
      ctx.drawImage(src, DX, DY, R, R);
      ctx.globalAlpha = 0.25;
      ctx.drawImage(pre, DX, DY, R, R);
    },
    // (3) no bloom at all (floor)
    none() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  };

  function runFrames(modeName) {
    return new Promise((resolve) => {
      const deltas = [];
      let last = 0, n = 0;
      function frame(ts) {
        if (last) deltas.push(ts - last);
        last = ts;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.filter = 'none';
        ctx.drawImage(bg, 0, 0);
        modes[modeName]();
        if (++n < FRAMES) requestAnimationFrame(frame);
        else resolve({ p50: pct(deltas, 0.5), p95: pct(deltas, 0.95), p99: pct(deltas, 0.99), max: +Math.max(...deltas).toFixed(2), frames: deltas.length });
      }
      requestAnimationFrame(frame);
    });
  }

  // Warm up every path once so first-paint allocations are not charged.
  for (const m of Object.keys(modes)) { modes[m](); }
  ctx.getImageData(0, 0, 1, 1);

  const res = {};
  // Interleaved order, two passes each, to cancel thermal/GC drift.
  for (const pass of [1, 2]) {
    const order = pass === 1 ? ['none', 'destinationFilter', 'offscreenWide'] : ['offscreenWide', 'destinationFilter', 'none'];
    for (const m of order) {
      const r = await runFrames(m);
      res[m] = res[m] ? { ...r, p50: Math.min(r.p50, res[m].p50), p95: Math.min(r.p95, res[m].p95), p99: Math.min(r.p99, res[m].p99) } : r;
    }
  }
  return { devicePixelRatio: devicePixelRatio, cssSize: [cv.clientWidth, cv.clientHeight], backing: [cv.width, cv.height], res };
}, FRAMES);

const report = { dpr: DPR, frames: FRAMES, ...out };
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('DPR', report.dpr, 'backing', report.backing, 'css', report.cssSize,
            '=> device raster', report.backing[0] * report.dpr + 'px');
console.log('\nmode                    p50      p95      p99      max');
for (const [k, v] of Object.entries(report.res)) {
  console.log('  ' + k.padEnd(20) + String(v.p50).padStart(7) + String(v.p95).padStart(9) + String(v.p99).padStart(9) + String(v.max).padStart(9));
}
await page.close();
await browser.close();
