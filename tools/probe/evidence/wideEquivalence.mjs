// wideEquivalence.mjs — is the expensive destination-side wide blur actually
// equivalent to a cheaper offscreen blur at lower resolution?
//
// The shipped createBloomSystem() has two wide-halo strategies:
//   default          targetCtx.filter = blur(9*dpr)      over the 2x-upscaled
//                    half-res glow surface, drawn at destination size
//   forceLegacyWide  blur(9*dpr*0.5) on the half-res surface, then a plain
//                    upscaled additive blit
// Both convolve the same authored halo radius; the second does it where the
// pixels are 4x fewer. filterLaw.mjs says that is 266 ms vs 89 ms per cast.
//
// This probe renders each strategy with identical emissive geometry and diffs
// the destination pixels, so the cheaper path can only ship if the image is
// actually the same.
//
// Usage: DPR=3.5 bash boot.sh evidence/wideEquivalence.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const REPO = '/home/user/APEX-CHAOS';
const DPR = Number(process.env.DPR || 3.5);
const OUT = process.env.OUT || '/tmp/wideEquivalence.json';
const SRC = fs.readFileSync(REPO + '/public/game/hero-rework/crystalaGoldV6.js', 'utf8');

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 432, height: 768, deviceScaleFactor: DPR });
await page.setContent('<!doctype html><html><body></body></html>');
await page.evaluate((code) => { (0, eval)(code); }, SRC);

const out = await page.evaluate(() => {
  const G = globalThis.APEX_CRYSTALA_GOLD;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const REGIONS = [
    { n: 'body', r: { x: 280, y: 260, w: 400, h: 440 } },
    { n: 'prison', r: { x: 220, y: 220, w: 560, h: 560 } },
    { n: 'wall', r: { x: 150, y: 150, w: 900, h: 900 } },
  ];
  // Deterministic emissive geometry inside the bloom source surface.
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
  function render(strategy, reg) {
    const dst = mk(1000, 1000);
    const dctx = dst.getContext('2d', { willReadFrequently: true });
    // A neutral background so additive blending has something to add to.
    dctx.fillStyle = '#101418';
    dctx.fillRect(0, 0, 1000, 1000);
    const b = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5, forceLegacyWide: strategy === 'legacy' });
    b.ensure(reg.w, reg.h);
    const gx = b.begin(null, reg);
    fillGeometry(gx, Math.round(reg.w * 0.5), Math.round(reg.h * 0.5));
    b.composite(dctx, 1000, 1000, reg);
    return dctx.getImageData(reg.x, reg.y, reg.w, reg.h).data;
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
    return { maxDelta: max, meanDelta: +(sum / n).toFixed(3), over2Pct: +((over2 / n) * 100).toFixed(3), samples: n };
  }
  const res = {};
  for (const { n, r } of REGIONS) {
    const a = render('destination', r);
    const c = render('legacy', r);
    res[n] = { ...diff(a, c), px: r.w * r.h };
  }
  return res;
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('\nregion    px        maxDelta  meanDelta  >2/255%   verdict');
for (const [k, v] of Object.entries(out)) {
  const verdict = v.maxDelta <= 3 ? 'EQUIVALENT' : v.maxDelta <= 8 ? 'near' : 'DIFFERENT';
  console.log('  ' + k.padEnd(8) + String(v.px).padStart(7) + String(v.maxDelta).padStart(10) + String(v.meanDelta).padStart(11) + String(v.over2Pct).padStart(10) + '   ' + verdict);
}
await page.close();
await browser.close();
