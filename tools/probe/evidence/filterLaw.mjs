// filterLaw.mjs — isolate WHY the CRYSTALA wide-halo pass is expensive.
//
// Observation that motivated this probe: a 560x560 destination blur measured
// ~48 ms in isolation, yet the bloom's wide pass at the same size added
// ~250 ms. So the cost is not the blur radius alone. This probe isolates each
// factor of that single draw call:
//
//     ctx.filter = 'blur(9px)'                       <-- convolution
//     ctx.globalCompositeOperation = 'lighter'        <-- additive blend
//     ctx.drawImage(halfResSurface, dx, dy, w, h)     <-- 2x upscale in the same call
//
// and then measures the alternatives (blur at half-res then plain upscale; blur
// at quarter-res then upscale; no blur at all).
//
// Every measurement flushes with a 1x1 getImageData, because a Canvas2D draw is
// only QUEUED on submit — submit-time numbers are meaningless here (a full
// bloom measured 0.2 ms submit / 2572 ms paid).
//
// Usage: DPR=3.5 REPS=7 OUT=/tmp/filterlaw.json bash boot.sh evidence/filterLaw.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const DPR = Number(process.env.DPR || 3.5);
const REPS = Number(process.env.REPS || 7);
const OUT = process.env.OUT || '/tmp/filterlaw.json';

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 432, height: 768, deviceScaleFactor: DPR });
await page.setContent('<!doctype html><html><body></body></html>');

const gpu = await page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return gl ? { renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a' } : { renderer: 'none' };
  } catch (e) { return { renderer: 'err' }; }
});

const result = await page.evaluate((REPS) => {
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(3); };
  const t = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  const R = 560;                                    // destination region (prison case)
  const dst = mk(1000, 1000);
  const dctx = dst.getContext('2d');
  const flush = () => { try { dctx.getImageData(0, 0, 1, 1); } catch (e) {} };
  function reset() {
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.filter = 'none';
    dctx.globalAlpha = 1;
    dctx.globalCompositeOperation = 'source-over';
  }
  function bench(setup, draw) {
    const sub = [], paid = [];
    for (let i = 0; i < REPS; i++) {
      reset(); setup && setup();
      sub.push(t(draw));
      paid.push(t(() => { reset(); setup && setup(); draw(); flush(); }));
    }
    return { submit: median(sub), paid: median(paid) };
  }

  // Source: 280x280 surface of emissive blobs = the bloom half-res surface for
  // a 560 px destination region at scale 0.5.
  const src = mk(280, 280);
  const sx = src.getContext('2d');
  sx.fillStyle = '#ffb343';
  for (let i = 0; i < 40; i++) sx.fillRect(20 + i * 6, 20 + i * 5, 46, 46);
  flush();

  const cases = {};
  const run = (name, setup, draw) => { cases[name] = bench(setup, draw); };

  // 1. plain 2x upscale blit, source-over
  run('A_upscale_plain_so', () => {}, () => dctx.drawImage(src, 200, 200, R, R));
  // 2. plain 2x upscale, additively blended (PERFORMANCE with wide=0)
  run('B_upscale_plain_lighter', () => { dctx.globalAlpha = 0.25; dctx.globalCompositeOperation = 'lighter'; },
      () => dctx.drawImage(src, 200, 200, R, R));
  // 3. 2x upscale + blur, source-over
  run('C_upscale_blur_so', () => { dctx.filter = 'blur(9px)'; }, () => dctx.drawImage(src, 200, 200, R, R));
  // 4. 2x upscale + blur + additive  (current HIGH path)
  run('D_upscale_blur_lighter', () => { dctx.filter = 'blur(9px)'; dctx.globalAlpha = 0.25; dctx.globalCompositeOperation = 'lighter'; },
      () => dctx.drawImage(src, 200, 200, R, R));
  // 5. blur with NO scale change
  run('E_noscale_blur_so', () => { dctx.filter = 'blur(9px)'; }, () => dctx.drawImage(src, 200, 200));
  // 6. no filter, 1:1, additive
  run('F_noscale_plain_lighter', () => { dctx.globalAlpha = 0.25; dctx.globalCompositeOperation = 'lighter'; },
      () => dctx.drawImage(src, 200, 200));

  // 7. legacy two-pass: blur into another half-res surface, then plain upscale.
  const tmp = mk(280, 280);
  const tx = tmp.getContext('2d');
  run('G_legacy_two_pass',
    () => { tx.setTransform(1, 0, 0, 1, 0, 0); },
    () => {
      tx.globalCompositeOperation = 'copy';
      tx.filter = 'blur(4.5px)';
      tx.drawImage(src, 0, 0);
      tx.filter = 'none';
      dctx.globalAlpha = 0.25;
      dctx.globalCompositeOperation = 'lighter';
      dctx.drawImage(tmp, 200, 200, R, R);
    });

  // 8. quarter-res wide pass: downsample+blur 280 -> 140, then upscale.
  const q = mk(140, 140);
  const qc = q.getContext('2d');
  run('H_quarter_two_pass',
    () => { qc.setTransform(1, 0, 0, 1, 0, 0); },
    () => {
      qc.globalCompositeOperation = 'copy';
      qc.filter = 'blur(2.25px)';
      qc.drawImage(src, 0, 0, 140, 140);
      qc.filter = 'none';
      dctx.globalAlpha = 0.25;
      dctx.globalCompositeOperation = 'lighter';
      dctx.drawImage(q, 200, 200, R, R);
    });

  // 9. quarter-res, no blur at all (pure box downsample + upscale)
  run('I_quarter_noblur',
    () => { qc.setTransform(1, 0, 0, 1, 0, 0); },
    () => {
      qc.globalCompositeOperation = 'copy';
      qc.drawImage(src, 0, 0, 140, 140);
      dctx.globalAlpha = 0.25;
      dctx.globalCompositeOperation = 'lighter';
      dctx.drawImage(q, 200, 200, R, R);
    });

  // 10. does the DESTINATION canvas size matter? same draw into 2000x2000.
  const big = mk(2000, 2000);
  const bctx = big.getContext('2d');
  const flushBig = () => { try { bctx.getImageData(0, 0, 1, 1); } catch (e) {} };
  const sub = [], paid = [];
  for (let i = 0; i < REPS; i++) {
    const setup = () => { bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.filter = 'blur(9px)'; bctx.globalAlpha = 0.25; bctx.globalCompositeOperation = 'lighter'; };
    setup();
    sub.push(t(() => bctx.drawImage(src, 400, 400, R, R)));
    paid.push(t(() => { setup(); bctx.drawImage(src, 400, 400, R, R); flushBig(); }));
  }
  cases.J_dest2000_upscale_blur_lighter = { submit: median(sub), paid: median(paid) };

  // Flush the destination once so its first rasterisation is not charged to case A.
  flush();
  return { cases, destSize: [dst.width, dst.height], srcSize: [src.width, src.height], regionPx: R };
}, REPS);

const report = { gpu, pageDpr: await page.evaluate(() => devicePixelRatio), reps: REPS, ...result };
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('GPU:', JSON.stringify(report.gpu));
console.log('dest', report.destSize, 'src', report.srcSize, 'region', report.regionPx);
console.log('\ncase                                  submit    paid(flushed)');
for (const [k, v] of Object.entries(report.cases)) {
  console.log('  ' + k.padEnd(34) + String(v.submit).padStart(8) + String(v.paid).padStart(14));
}
await page.close();
await browser.close();
