// wideStrategies.mjs — pick the wide-halo strategy on EVIDENCE, not vibes.
//
// For each candidate strategy this probe reports, in the same run:
//   * paid cost (flushed) of one composite at the product's region sizes;
//   * pixel delta against the shipped HIGH path (destination-side blur).
//
// A strategy is only eligible if it is pixel-equivalent (max delta <= 3/255)
// AND cheaper. Anything that changes the look is reported as such and rejected.
//
// Candidates
//   1 destination   — shipped default: blur(9*dpr) on the destination, 2x upscaled
//   2 halfres       — shipped forceLegacyWide: blur(9*dpr*0.5) on the half-res
//                     surface, then a plain 2x additive upscale
//   3 quarter       — downsample the half-res surface to 1/4 with blur(9*dpr*0.25),
//                     then a plain 4x additive upscale
//   4 quarterBox    — downsample to 1/4 with no filter, plain 4x additive upscale
//                     (bilinear downsample+upsample is itself a triangular kernel)
//   5 none          — shipped PERFORMANCE: halo dropped entirely (reference for
//                     "how much does the halo actually contribute?")
//
// Usage: DPR=3.5 REPS=5 bash boot.sh evidence/wideStrategies.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const REPO = '/home/user/APEX-CHAOS';
const DPR = Number(process.env.DPR || 3.5);
const REPS = Number(process.env.REPS || 5);
const OUT = process.env.OUT || '/tmp/wideStrategies.json';
const SRC = fs.readFileSync(REPO + '/public/game/hero-rework/crystalaGoldV6.js', 'utf8');

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 432, height: 768, deviceScaleFactor: DPR });
await page.setContent('<!doctype html><html><body></body></html>');
await page.evaluate((code) => { (0, eval)(code); }, SRC);

const out = await page.evaluate((REPS) => {
  const G = globalThis.APEX_CRYSTALA_GOLD;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(3); };
  const now = () => performance.now();

  const REGIONS = [
    { n: 'body', r: { x: 280, y: 260, w: 400, h: 440 } },
    { n: 'prison', r: { x: 220, y: 220, w: 560, h: 560 } },
    { n: 'wall', r: { x: 150, y: 150, w: 900, h: 900 } },
  ];

  function fillGeometry(gx, w, h) {
    gx.setTransform(1, 0, 0, 1, 0, 0);
    gx.clearRect(0, 0, w, h);
    gx.fillStyle = '#ffb343';
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      gx.beginPath();
      gx.arc(w / 2 + Math.cos(a) * w * 0.26, h / 2 + Math.sin(a) * h * 0.26, w * 0.05, 0, Math.PI * 2);
      gx.fill();
    }
    gx.fillStyle = '#fff3c4';
    gx.fillRect(w * 0.42, h * 0.42, w * 0.16, h * 0.16);
  }

  // Run one composite for a strategy, either producing pixels or timing it.
  function setup(strategy, reg) {
    const dst = mk(1000, 1000);
    const dctx = dst.getContext('2d', { willReadFrequently: false });
    dctx.fillStyle = '#101418';
    dctx.fillRect(0, 0, 1000, 1000);
    const sys = {
      dst, dctx,
      // Reusable intermediate surfaces for the custom strategies.
      half: mk(Math.max(1, Math.round(reg.w * 0.5)), Math.max(1, Math.round(reg.h * 0.5))),
      quarter: mk(Math.max(1, Math.round(reg.w * 0.25)), Math.max(1, Math.round(reg.h * 0.25))),
    };
    return sys;
  }

  function composite(sys, strategy, reg) {
    const { dctx } = sys;
    const legacy = strategy === 'halfres';
    const b = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5, forceLegacyWide: legacy });
    b.ensure(reg.w, reg.h);
    const gx = b.begin(null, reg);
    fillGeometry(gx, Math.round(reg.w * 0.5), Math.round(reg.h * 0.5));
    if (strategy === 'destination' || strategy === 'halfres' || strategy === 'none') {
      // 'none' = shipped PERFORMANCE path (flag off)
      if (strategy === 'none') globalThis.APEX_GRAPHICS_BLOOM_WIDE = 0;
      b.composite(dctx, 1000, 1000, reg);
      if (strategy === 'none') globalThis.APEX_GRAPHICS_BLOOM_WIDE = 1;
      return;
    }
    // Custom: reproduce the shipping blend, but budget the wide pass differently.
    const glow = b.glowCanvas;
    dctx.save();
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    // mid pass: 2.6*dpr*0.5 px blur on the half-res surface -> destination
    const mid = mk(glow.width, glow.height);
    const mx = mid.getContext('2d');
    mx.globalCompositeOperation = 'copy';
    mx.filter = 'blur(1.30px)';           // 2.6*1*0.5
    mx.drawImage(glow, 0, 0);
    mx.filter = 'none';
    dctx.globalCompositeOperation = 'lighter';
    dctx.globalAlpha = 0.56;
    dctx.drawImage(mid, reg.x, reg.y, reg.w, reg.h);
    // wide pass
    dctx.globalAlpha = 0.25;
    if (strategy === 'quarter' || strategy === 'quarterBox') {
      const q = sys.quarter;
      const qx = q.getContext('2d');
      qx.setTransform(1, 0, 0, 1, 0, 0);
      qx.globalCompositeOperation = 'copy';
      if (strategy === 'quarter') { qx.filter = 'blur(2.25px)'; }   // 9*1*0.25
      qx.drawImage(mid, 0, 0, q.width, q.height);
      qx.filter = 'none';
      dctx.drawImage(q, reg.x, reg.y, reg.w, reg.h);
    }
    dctx.restore();
    dctx.globalCompositeOperation = 'source-over';
    dctx.globalAlpha = 1;
  }

  function pixels(sys, strategy, reg) {
    composite(sys, strategy, reg);
    return sys.dctx.getImageData(reg.x, reg.y, reg.w, reg.h).data;
  }
  function diff(a, b) {
    let max = 0, sum = 0, over2 = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        const d = Math.abs(a[i + k] - b[i + k]);
        if (d > max) max = d;
        sum += d;
        if (d > 2) over2++;
        n++;
      }
    }
    return { maxDelta: max, meanDelta: +(sum / n).toFixed(3), over2Pct: +((over2 / n) * 100).toFixed(3) };
  }
  function cost(strategy, reg) {
    const sys = setup(strategy, reg);
    const flush = () => { try { sys.dctx.getImageData(0, 0, 1, 1); } catch (e) {} };
    // warm
    composite(sys, strategy, reg); flush();
    const paid = [];
    for (let i = 0; i < REPS; i++) {
      const t0 = now();
      composite(sys, strategy, reg);
      flush();
      paid.push(now() - t0);
    }
    return median(paid);
  }

  const STRATS = ['destination', 'halfres', 'quarter', 'quarterBox', 'none'];
  const res = {};
  for (const { n, r } of REGIONS) {
    const ref = pixels(setup('destination', r), 'destination', r);
    const row = {};
    for (const s of STRATS) {
      const px = pixels(setup(s, r), s, r);
      row[s] = { ...diff(ref, px), paidMs: cost(s, r) };
    }
    res[n] = { px: r.w * r.h, ...row };
  }
  return res;
}, REPS);

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
for (const [region, row] of Object.entries(out)) {
  const base = row.destination.paidMs;
  console.log(`\n=== region ${region} (${row.px} px) — reference = destination-side blur ===`);
  console.log('  strategy        paid ms   vs ref   maxΔ  meanΔ   >2/255%  verdict');
  for (const [s, v] of Object.entries(row)) {
    if (s === 'px') continue;
    const verdict = v.maxDelta <= 3 ? 'EQUIVALENT' : v.maxDelta <= 8 ? 'near' : 'DIFFERENT';
    const speed = base ? (v.paidMs / base * 100).toFixed(0) + '%' : 'n/a';
    console.log('  ' + s.padEnd(14) + String(v.paidMs).padStart(8) + String(speed).padStart(9) +
      String(v.maxDelta).padStart(7) + String(v.meanDelta).padStart(8) + String(v.over2Pct).padStart(9) + '   ' + verdict);
  }
}
await page.close();
await browser.close();
