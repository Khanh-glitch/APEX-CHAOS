// Deterministic renderer cost: old (13b42fc8) vs new, SAME input, same realm
// isolation, N repetitions. Measures only the drawing code that changed.
//
// Why this is the right benchmark for this change: the optimisation removes
// Canvas2D command volume (path builds + fills) and a redundant full-surface
// blit. That cost is a function of the drawing code alone — it does not depend
// on the simulation, the wall clock, or the compositor. Timing inside iframes
// in this sandbox DOES still vary with GC, so we report the median of many
// runs and the command counts (which are exact, not sampled).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const REPO = '/home/user/APEX-CHAOS';
const SRC = {
  old: fs.readFileSync('/tmp/frost-old.js', 'utf8'),
  new: fs.readFileSync(REPO + '/public/game/hero-rework/frostGoldV1.js', 'utf8'),
  boxeOld: fs.readFileSync('/tmp/boxe-old.js', 'utf8'),
  boxeNew: fs.readFileSync(REPO + '/public/game/hero-rework/boxeGoldLibrary.js', 'utf8'),
};
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 700, height: 700 });
await page.setContent('<!doctype html><html><body></body></html>');

async function bench(source, code, reps) {
  return page.evaluate(async ({ source, code, reps }) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:0;height:0;border:0';
    document.body.appendChild(frame);
    const d = frame.contentDocument;
    d.open(); d.write('<!doctype html><body></body>'); d.close();
    let a = 0x9E3779B9;
    frame.contentWindow.Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const s = d.createElement('script'); s.textContent = source; d.body.appendChild(s);
    const W = frame.contentWindow;
    const cv = d.createElement('canvas'); cv.width = 1000; cv.height = 1000; d.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    // Count Canvas2D commands exactly.
    const counts = Object.create(null);
    for (const op of ['fill','stroke','beginPath','drawImage','putImageData','clearRect','save','restore','clip','moveTo','lineTo','closePath']) {
      const orig = ctx[op].bind(ctx);
      ctx[op] = function (...args) { counts[op] = (counts[op] || 0) + 1; return orig(...args); };
    }
    const times = [];
    let err = null;
    try {
      for (let i = 0; i < reps; i += 1) {
        // Fresh field each rep so decay/state does not drift between reps.
        const t0 = performance.now();
        await new Function('W', 'ctx', code)(W, ctx);
        times.push(performance.now() - t0);
      }
    } catch (e) { err = String(e).slice(0, 300); }
    times.sort((x, y) => x - y);
    const q = (p) => {
      if (!times.length) return 0;
      const v = times[Math.min(times.length - 1, Math.floor(p * times.length))];
      return typeof v === 'number' ? +v.toFixed(3) : 0;
    };
    const med = q(0.5);
    frame.remove();
    return { err, times: { n: times.length, p50: med, p95: q(0.95), min: times.length ? +times[0].toFixed(3) : 0, max: times.length ? +times[times.length-1].toFixed(3) : 0 },
             perRep: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, +(v / reps).toFixed(2)])) };
  }, { source, code, reps });
}

const ICE_FIELD_CODE = `
  const G = W.APEX_FROST_GOLD;
  const f = new G.IceField(1000, 1000);
  for (let i = 0; i < 10; i += 1) {
    const a = i * 0.52;
    f.add(500 + Math.cos(a) * 140, 500 + Math.sin(a) * 140, a, 95 + (i % 5) * 16, 36 + (i % 3) * 8, 0.0,
          i % 4 === 0 ? 'lane' : 'wall', { lockDur: 0.55, spurChance: 0.4 });
  }
  f.addCarve(470, 560, 0.7, 1, 0.55, 0.0, 14);
  f.render(ctx, 3.1, 1);
`;

// A full wall wave: the action-locked heavy case from the owner brief.
const ICE_WALL_CODE = `
  const G = W.APEX_FROST_GOLD;
  const f = new G.IceField(1000, 1000);
  for (let i = 0; i < 26; i += 1) {
    const a = i * 0.38;
    f.add(500 + Math.cos(a) * 180, 500 + Math.sin(a) * 180, a, 110 + (i % 6) * 14, 40 + (i % 4) * 8, 0.0,
          i % 5 === 0 ? 'lane' : 'wall', { lockDur: 0.55, spurChance: 0.5 });
  }
  for (let i = 0; i < 5; i += 1) f.addCarve(460 + i * 22, 560, i * 0.6, i % 2 ? 1 : -1, 0.5, 0.0, 14);
  f.render(ctx, 3.1, 1);
`;

// The composite path: full-surface clear + render + blit, exactly as
// drawIceComposite does it (the blit is the part the optimisation bounded).
const ICE_COMPOSITE_CODE = `
  const G = W.APEX_FROST_GOLD;
  const off = document.createElement('canvas'); off.width = 1000; off.height = 1000;
  const oc = off.getContext('2d');
  const f = new G.IceField(1000, 1000);
  for (let i = 0; i < 26; i += 1) {
    const a = i * 0.38;
    f.add(500 + Math.cos(a) * 180, 500 + Math.sin(a) * 180, a, 110 + (i % 6) * 14, 40 + (i % 4) * 8, 0.0,
          i % 5 === 0 ? 'lane' : 'wall', { lockDur: 0.55, spurChance: 0.5 });
  }
  oc.setTransform(1,0,0,1,0,0);
  oc.clearRect(0, 0, 1000, 1000);
  f.render(oc, 3.1, 1);
  oc.setTransform(1,0,0,1,0,0);
  ctx.save(); ctx.globalAlpha = 0.97; ctx.drawImage(off, 0, 0); ctx.restore();
`;

const CASES = { 'ice-10': ICE_FIELD_CODE, 'ice-wall-26': ICE_WALL_CODE, 'ice-composite-26': ICE_COMPOSITE_CODE };
const report = {};
for (const [caseName, code] of Object.entries(CASES)) {
  report[caseName] = {};
  for (const [label, src] of [['old', SRC.old], ['new', SRC.new]]) {
    const r = await bench(src, code, 60);
    report[caseName][label] = r;
    console.log(`${caseName.padEnd(17)} ${label.padEnd(4)} ${r.err ? 'ERR ' + r.err.slice(0,120) : `p50=${String(r.times.p50).padStart(6)}ms p95=${String(r.times.p95).padStart(6)}ms  fill=${String(r.perRep.fill).padStart(4)} beginPath=${String(r.perRep.beginPath).padStart(4)} drawImage=${r.perRep.drawImage} clearRect=${r.perRep.clearRect}`}`);
  }
  const o = report[caseName].old, n = report[caseName].new;
  if (!o.err && !n.err) {
    const pct = (a, b) => (a === 0 ? 'n/a' : `${(((a - b) / a) * 100).toFixed(1)}%`);
    report[caseName].delta = {
      p50: +(((o.times.p50 - n.times.p50) / o.times.p50) * 100).toFixed(1),
      fill: +(((o.perRep.fill - n.perRep.fill) / o.perRep.fill) * 100).toFixed(1),
      beginPath: +(((o.perRep.beginPath - n.perRep.beginPath) / o.perRep.beginPath) * 100).toFixed(1),
    };
    console.log(`   DELTA p50 ${pct(o.times.p50, n.times.p50)} less | fill ${pct(o.perRep.fill, n.perRep.fill)} less | beginPath ${pct(o.perRep.beginPath, n.perRep.beginPath)} less`);
  }
}
fs.writeFileSync(process.env.OUT || '/tmp/render-cost.json', JSON.stringify(report, null, 1));
console.log('WROTE', process.env.OUT || '/tmp/render-cost.json');
await browser.close(); process.exit(0);
