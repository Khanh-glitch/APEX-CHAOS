// Where does a skill cast actually spend its time?
//
// The question is NOT "does PERFORMANCE submit fewer Canvas commands" (it does,
// -12.8%) but "what stalls the frame when a skill fires". This probe therefore
// times individual OPERATIONS with and without the GPU-ish work, at the real
// DPR, and reports the cost split.
//
// Method:
//   * harness boot at a chosen devicePixelRatio (default 3.5, the owner's phone);
//   * isolated realms load the SHIPPED renderer files (same bytes as the ZIP);
//   * each candidate operation is run N times and timed with performance.now();
//   * a *forced raster readback* separates "JS submitted the command" from
//     "the backend actually rasterised it". Canvas2D is asynchronous: without a
//     readback, a blur() or drawImage() can be queued and never paid for inside
//     the measured window, which is exactly how a command-count win can look
//     free while the frame still stalls.
//
// Readback: ctx.getImageData(0,0,1,1) is enough to force a flush of the current
// surface. It is used ONLY in the instrumented probe, never in the product.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const REPO = '/home/user/APEX-CHAOS';
const DPR = Number(process.env.DPR || 3.5);
const REPS = Number(process.env.REPS || 7);
const OUT = process.env.OUT || '/tmp/castcost.json';

const SRC = {
  crystala: fs.readFileSync(REPO + '/public/game/hero-rework/crystalaGoldV6.js', 'utf8'),
  frost: fs.readFileSync(REPO + '/public/game/hero-rework/frostGoldV1.js', 'utf8'),
  boxe: fs.readFileSync(REPO + '/public/game/hero-rework/boxeGoldLibrary.js', 'utf8'),
};

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 432, height: 768, deviceScaleFactor: DPR });
await page.setContent('<!doctype html><html><body></body></html>');

const results = { dpr: DPR, reps: REPS, browser: {}, ops: {}, flags: {} };

results.browser = await page.evaluate(() => ({
  devicePixelRatio: devicePixelRatio,
  hardwareConcurrency: navigator.hardwareConcurrency,
  // Is any real GPU present? SwiftShader means NO.
  gpu: (() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { available: false };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return { available: true, vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : '?',
               renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?' };
    } catch (e) { return { available: false, err: String(e.message) }; }
  })(),
}));

// Helper injected once: inRealm(source, flags, fnBody) -> result
async function inRealm(source, flags, code) {
  return page.evaluate(async ({ source, flags, code, dpr }) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:0;height:0;border:0';
    document.body.appendChild(frame);
    const d = frame.contentDocument;
    d.open(); d.write('<!doctype html><body></body>'); d.close();
    Object.assign(frame.contentWindow, flags);
    // Deterministic RNG so every arm draws the same geometry.
    let a = 0x9E3779B9;
    frame.contentWindow.Math.random = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const s = d.createElement('script'); s.textContent = source; d.body.appendChild(s);
    const W = frame.contentWindow;
    let out = null, err = null;
    try { out = await new Function('W', 'dpr', 'code', code)(W, dpr, code); }
    catch (e) { err = String(e && e.message || e).slice(0, 300); }
    frame.remove();
    return err ? { err } : out;
  }, { source, flags, code, dpr: DPR });
}

const time = (label, fn) => `(() => { const t0=performance.now(); const r=${fn}; const dt=performance.now()-t0; return [dt,r]; })()`;

// ---------------------------------------------------------------- BLOOM ----
// The bloom system renders emissive geometry into a half-res surface, blurs it
// with a CSS filter, then composites. Measure: fill cost, wide-blur cost,
// composite cost, each with and without a forced flush.
const BLOOM = `
  const G = W.APEX_CRYSTALA_GOLD;
  if (!G || !G.createBloomSystem) return { err: 'createBloomSystem missing' };
  // PRODUCT TRUTH: src/App.jsx mounts <canvas id="game-canvas" width=1000
  // height=1000 /> and nothing ever rewrites width/height from devicePixelRatio.
  // So cw=ch=1000 and the bloom system is built with no dpr (=> dpr=1).
  // The destination canvas here must therefore be 1000x1000 CSS px, matching
  // the product, and the surface must be w*0.5.
  const cv = document.createElement('canvas');
  cv.width = 1000; cv.height = 1000;
  const ctx = cv.getContext('2d', { willReadFrequently: false });
  const surfaceDpr = ${process.env.DPR_SURFACE === '1'} ? dpr : 1;
  const b = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5,
    ...(surfaceDpr !== 1 ? { dpr: surfaceDpr } : {}) });
  b.ensure(1000, 1000, surfaceDpr);
  const flush = () => { try { ctx.getImageData(0, 0, 1, 1); } catch (e) {} };
  const t = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
  const measure = (fn) => {
    const submit = [], paid = [];
    for (let i = 0; i < ${REPS}; i++) {
      submit.push(t(fn));
      paid.push(t(() => { fn(); flush(); }));
    }
    return { submitMedian: median(submit), paidMedian: median(paid) };
  };
  function median(a) { const s = a.slice().sort((x,y)=>x-y); return +s[Math.floor(s.length/2)].toFixed(3); }
  const out = { surfaces: {}, ops: {} };
  out.scale = 0.5; out.pageDpr = dpr; out.surfaceDpr = surfaceDpr;
  out.surfaces.glowHalfRes = [Math.round(1000*surfaceDpr*0.5), Math.round(1000*surfaceDpr*0.5)];
  out.surfaces.dprScaled = surfaceDpr !== 1;
  // Fill geometry into the bloom source at the region size the runtime uses.
  const REGIONS = [ { n: 'body', w: 400, h: 440 }, { n: 'prison', w: 560, h: 560 }, { n: 'wall', w: 900, h: 900 } ];
  for (const reg of REGIONS) {
    const r = { x: 200, y: 200, w: reg.w, h: reg.h };
    const g2 = b.begin(0, r);            // no world transform: 1:1 region pixels
    if (!g2) { out.ops['fill_' + reg.n] = null; continue; }
    out.ops['fill_' + reg.n] = measure(() => {
      g2.clearRect(0, 0, reg.w, reg.h);
      g2.fillStyle = '#ffb343';
      for (let i = 0; i < 40; i++) g2.fillRect(120 + i*7, 120 + i*5, 90, 90);
    });
    out.ops['composite_' + reg.n] = measure(() => b.composite(ctx, 1000, 1000, r));
  }
  // Three wide-halo strategies at the SAME destination region:
  //   A  destination-side blur(9*dpr)          (current default / HIGH)
  //   B  no wide pass at all                   (current PERFORMANCE)
  //   C  blur on the half-res surface, radius halved, then upscaled
  //      (createBloomSystem({forceLegacyWide:true})) — mathematically the same
  //      convolution as A because the surface is region*0.5 and is drawn back
  //      at region size, i.e. an exact x2 upscale.
  {
    const r = { x: 200, y: 200, w: 560, h: 560 };
    const legacy = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5, forceLegacyWide: true });
    legacy.ensure(1000, 1000, surfaceDpr);
    legacy.begin(0, r);
    out.ops['composite_wideLegacyHalfRes'] = measure(() => legacy.composite(ctx, 1000, 1000, r));
    // and at a small (body) region for the per-frame case
    const rb = { x: 260, y: 260, w: 400, h: 440 };
    legacy.begin(0, rb);
    out.ops['composite_wideLegacy_body'] = measure(() => legacy.composite(ctx, 1000, 1000, rb));
  }
  // Wide-halo switch: PERFORMANCE can drop the destination-wide convolution.
  for (const wide of [1, 0]) {
    W.APEX_GRAPHICS_BLOOM_WIDE = wide;
    const r = { x: 200, y: 200, w: 560, h: 560 };
    b.begin(0, r);
    out.ops['composite_prison_wide' + wide] = measure(() => b.composite(ctx, 1000, 1000, r));
  }
  W.APEX_GRAPHICS_BLOOM_WIDE = 1;
  return out;
`;


// --------------------------------------------------------- FROST ICE -------
// IceField builds slab paths per node and fills them in batched runs, then
// blits a dirty region. Measure: path+fill for a dense field, the blit, and
// the same with a forced flush.
const ICE = `
  const G = W.APEX_FROST_GOLD;
  if (!G || !G.IceField) return { err: 'IceField missing' };
  const cv = document.createElement('canvas');
  cv.width = 1000; cv.height = 1000;
  const ctx = cv.getContext('2d');
  const f = new G.IceField(1000, 1000);
  for (let i = 0; i < 40; i++) f.add(400 + (i%8)*24, 400 + Math.floor(i/8)*26, i*0.2, 120, 46, 0.0, 'wall', { lockDur: 0.55 });
  const flush = () => { try { ctx.getImageData(0, 0, 1, 1); } catch (e) {} };
  function median(a){const s=a.slice().sort((x,y)=>x-y);return +s[Math.floor(s.length/2)].toFixed(3);}
  const measure = (fn) => {
    const submit = [], paid = [];
    for (let i = 0; i < ${REPS}; i++) {
      const t0 = performance.now(); fn(); submit.push(performance.now() - t0);
      const t1 = performance.now(); flush(); paid.push(performance.now() - t1);
    }
    return { submitMedian: median(submit), paidMedian: median(paid) };
  };
  const out = { ops: {} };
  out.nodes = f.nodes.filter(n => !n.dead).length;
  out.ops.render = measure(() => f.render(ctx, 3.0, 1));
  out.ops.renderFlush = measure(() => { f.render(ctx, 3.0, 1); flush(); });
  return out;
`;

// ------------------------------------------------- BLUR COST vs DPR --------
// The single most suspicious operation: a CSS blur on a large surface. Time it
// at several sizes to expose the DPR^2 growth.
const BLUR = `
  const out = { ops: {}, sizes: [] };
  function median(a){const s=a.slice().sort((x,y)=>x-y);return +s[Math.floor(s.length/2)].toFixed(3);}
  const flushOf = (ctx) => { try { ctx.getImageData(0,0,1,1); } catch(e){} };
  for (const [w,h,radius] of [[500,500,9],[875,875,31.5],[1750,1750,31.5],[1750,1750,63]]) {
    const src = document.createElement('canvas'); src.width=w; src.height=h;
    const sx = src.getContext('2d');
    sx.fillStyle='#ffb343';
    for (let i=0;i<60;i++) sx.fillRect((i*37)%w, (i*53)%h, w*0.12, h*0.12);
    const dst = document.createElement('canvas'); dst.width=w; dst.height=h;
    const dx = dst.getContext('2d');
    const submit=[], paid=[];
    for (let i=0;i<${REPS};i++){
      const t0=performance.now();
      dx.clearRect(0,0,w,h);
      dx.filter='blur('+radius+'px)';
      dx.drawImage(src,0,0);
      dx.filter='none';
      submit.push(performance.now()-t0);
      const t1=performance.now(); flushOf(dx); paid.push(performance.now()-t1);
    }
    out.sizes.push({ w, h, radius, px: w*h,
      submitMedian: median(submit), paidMedian: median(paid) });
  }
  return out;
`;

// -------------------------------------------------- FULL-CANVAS BLIT -------
const BLIT = `
  const out = { ops: {}, sizes: [] };
  function median(a){const s=a.slice().sort((x,y)=>x-y);return +s[Math.floor(s.length/2)].toFixed(3);}
  for (const s of [1000, 1750, 3500]) {
    const src=document.createElement('canvas'); src.width=s; src.height=s;
    const sc=src.getContext('2d'); sc.fillStyle='#123'; sc.fillRect(0,0,s,s);
    const dst=document.createElement('canvas'); dst.width=s; dst.height=s;
    const dc=dst.getContext('2d');
    const submit=[], paid=[];
    for (let i=0;i<${REPS};i++){
      const t0=performance.now(); dc.drawImage(src,0,0); submit.push(performance.now()-t0);
      const t1=performance.now(); try{dc.getImageData(0,0,1,1);}catch(e){} paid.push(performance.now()-t1);
    }
    out.sizes.push({ size:s, submitMedian:median(submit), paidMedian:median(paid) });
  }
  return out;
`;

const HIGH = { APEX_GRAPHICS_BLOOM_WIDE: 1, APEX_GRAPHICS_FLUID_SOFT_ALPHA: 1 };
const PERF = { APEX_GRAPHICS_BLOOM_WIDE: 0, APEX_GRAPHICS_FLUID_SOFT_ALPHA: 0 };

console.log(`DPR=${DPR} reps=${REPS}`);
console.log('GPU:', JSON.stringify(results.browser.gpu));
console.log('DPR reported:', results.browser.devicePixelRatio);

results.ops.bloom_high = await inRealm(SRC.crystala, HIGH, BLOOM);
results.ops.bloom_perf = await inRealm(SRC.crystala, PERF, BLOOM);
results.ops.ice_high = await inRealm(SRC.frost, {}, ICE);
results.ops.ice_perf = await inRealm(SRC.frost, { APEX_ICE_SHADOW_NODE_BUDGET: 5, APEX_ICE_FLOW_MOTION_BUDGET: 0.55 }, ICE);
results.ops.blur = await inRealm('', {}, BLUR);
results.ops.blit = await inRealm('', {}, BLIT);

const show = (label, o) => {
  if (!o || o.err) { console.log(`  ${label}: ${o && o.err}`); return; }
  const parts = [];
  if (o.ops) for (const [k, v] of Object.entries(o.ops)) {
    if (v && typeof v === 'object') parts.push(`${k}=${v.submitMedian}/${v.paidMedian}`);
    else parts.push(`${k}=${v}`);
  }
  if (o.sizes) for (const s of o.sizes) {
    parts.push(`${s.w || s.size}px@${s.radius || '-'}=${s.submitMedian}/${s.paidMedian}`);
  }
  console.log(`  ${label}: ${parts.join('  ')}`);
};
console.log('\n--- per operation (submit / flushed ms) ---');
show('bloom HIGH', results.ops.bloom_high);
show('bloom PERF', results.ops.bloom_perf);
show('ice   HIGH', results.ops.ice_high);
show('ice   PERF', results.ops.ice_perf);
console.log('\n--- CSS blur by surface size (submit / flushed ms) ---');
show('blur', results.ops.blur);
console.log('\n--- full-canvas blit by size ---');
show('blit', results.ops.blit);

fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
await browser.close();
process.exit(0);
