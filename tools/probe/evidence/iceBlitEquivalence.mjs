// iceBlitEquivalence.mjs — does blitting only blitBounds() produce the same
// canvas as blitting the whole ice surface?
//
// The FROST ice pass paints into a full-arena offscreen and then blends it onto
// the arena. The blend used to cover 1000x1000 every frame (23 of 25 blits in a
// live battle) because the pattern was "if the painted bounds touch any edge,
// copy the whole surface". It now copies the painted bounds clamped into the
// canvas. This probe proves that change is invisible: identical ice state is
// rendered into two canvases, one blitted full and one blitted clamped, and the
// entire canvas is diffed.
//
// Usage: bash boot.sh evidence/iceBlitEquivalence.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const FROST = fs.readFileSync('/home/user/APEX-CHAOS/public/game/hero-rework/frostGoldV1.js', 'utf8');
const OUT = process.env.OUT || '/tmp/iceBlitEquivalence.json';
const W = 1000, H = 1000;

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 432, height: 768, deviceScaleFactor: 1 });
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: FROST });

const out = await page.evaluate(({ W, H }) => {
  const G = globalThis.APEX_FROST_GOLD;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // Scenarios: ice fully inside the arena, ice touching an edge, and ice
  // spread across the whole arena. The middle one is the case the old code
  // gave up on.
  const SCENARIOS = [
    { name: 'interior',   nodes: [[500, 500, 0.4, 150, 120], [560, 470, 1.2, 120, 90]] },
    { name: 'edge',       nodes: [[60, 500, 1.5, 170, 130], [140, 520, 0.2, 150, 110]] },
    { name: 'corner',     nodes: [[30, 30, 0.7, 180, 140], [900, 900, 2.1, 180, 140]] },
    { name: 'arena-wide', nodes: [[100, 100, 0, 260, 200], [500, 500, 1, 260, 200], [880, 860, 2, 260, 200]] },
  ];

  function makeField(nodes, t0) {
    const f = new G.IceField();
    for (const [x, y, ang, L, Wd] of nodes) {
      f.add(x, y, ang, L, Wd, t0 - 2.0, 'lane', { lockDur: 0.3 });
    }
    return f;
  }

  function renderInto(mode) {
    const dst = mk(W, H);
    const ctx = dst.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#12161c';
    ctx.fillRect(0, 0, W, H);
    // A patterned background so any missing/extra blended pixel is visible.
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `hsl(${(i * 47) % 360},35%,${20 + (i % 4) * 6}%)`;
      ctx.fillRect((i * 71) % (W - 40), (i * 113) % (H - 40), 40, 40);
    }
    const res = {};
    for (const sc of SCENARIOS) {
      const t = 4.0;
      const f = makeField(sc.nodes, t);
      // Production shape: an offscreen the size of the arena.
      f.prepareSurfaces ? 0 : 0;
      const off = mk(W, H);
      const oc = off.getContext('2d');
      f.render(oc, t, 1);
      const cur = f.blitBounds(t, W, H);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.97;
      if (mode === 'full' || !cur) {
        ctx.drawImage(off, 0, 0);
      } else {
        // exactly the shipped clamping logic
        let bb = cur;
        const x0 = Math.max(0, Math.floor(bb.x));
        const y0 = Math.max(0, Math.floor(bb.y));
        const x1 = Math.min(W, Math.ceil(bb.x + bb.w));
        const y1 = Math.min(H, Math.ceil(bb.y + bb.h));
        bb = (x1 > x0 && y1 > y0 && (x1 - x0) * (y1 - y0) < W * H)
          ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
        if (bb) ctx.drawImage(off, bb.x, bb.y, bb.w, bb.h, bb.x, bb.y, bb.w, bb.h);
        else ctx.drawImage(off, 0, 0);
      }
      ctx.restore();
      res[sc.name] = { bounds: cur, pxData: Array.from(ctx.getImageData(0, 0, W, H).data) };
    }
    return res;
  }
  const fullRun = renderInto('full');
  const clampRun = renderInto('clamped');
  function diff(a, b) {
    let max = 0, sum = 0, over1 = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) {
      const d = Math.abs(a[i + k] - b[i + k]);
      if (d > max) max = d; sum += d; if (d > 1) over1++; n++;
    }
    return { maxDelta: max, meanDelta: +(sum / n).toFixed(4), over1Pct: +((over1 / n) * 100).toFixed(4) };
  }
  const res = {};
  for (const sc of SCENARIOS) {
    res[sc.name] = { bounds: fullRun[sc.name].bounds, ...diff(fullRun[sc.name].pxData, clampRun[sc.name].pxData) };
  }
  return res;
}, { W, H });

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('\nscenario      bounds                       maxΔ  meanΔ   >1/255%   verdict');
for (const [k, v] of Object.entries(out)) {
  const b = v.bounds ? `${v.bounds.x},${v.bounds.y} ${v.bounds.w}x${v.bounds.h}` : 'null';
  const verdict = v.maxDelta === 0 ? 'IDENTICAL' : v.maxDelta <= 1 ? 'equivalent' : 'DIFFERENT';
  console.log('  ' + k.padEnd(12) + b.padEnd(28) + String(v.maxDelta).padStart(5) +
    String(v.meanDelta).padStart(8) + String(v.over1Pct).padStart(10) + '   ' + verdict);
}
await page.close(); await browser.close();
