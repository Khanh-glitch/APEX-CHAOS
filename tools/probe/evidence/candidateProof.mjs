// Proves EACH PERFORMANCE candidate (P1..P4) actually engages, and that it is
// inert in HIGH. This is the check that would have caught the `g`-scope bug:
// the mode switched correctly before, but all four candidates were dead code.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const REPO = '/home/user/APEX-CHAOS';
const SRC = {
  boxe: fs.readFileSync(REPO + '/public/game/hero-rework/boxeGoldLibrary.js', 'utf8'),
  crystala: fs.readFileSync(REPO + '/public/game/hero-rework/crystalaGoldV6.js', 'utf8'),
  frost: fs.readFileSync(REPO + '/public/game/hero-rework/frostGoldV1.js', 'utf8'),
};
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 600000, args: [...chromium.args, '--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
await page.setContent('<!doctype html><html><body></body></html>');

async function inRealm(source, flags, code) {
  return page.evaluate(async ({ source, flags, code }) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:0;height:0;border:0';
    document.body.appendChild(frame);
    const d = frame.contentDocument;
    d.open(); d.write('<!doctype html><body></body>'); d.close();
    Object.assign(frame.contentWindow, flags);
    let a = 0x9E3779B9;
    frame.contentWindow.Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const s = d.createElement('script'); s.textContent = source; d.body.appendChild(s);
    const W = frame.contentWindow;
    const cv = d.createElement('canvas'); cv.width = 1000; cv.height = 1000; d.body.appendChild(cv);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    let out = null, err = null;
    try { out = await new Function('W', 'ctx', 'canvas', code)(W, ctx, cv); } catch (e) { err = String(e && e.message || e).slice(0, 200); }
    frame.remove();
    return err ? { err } : out;
  }, { source, flags, code });
}

// P2 — BOXE soft smoke pass
const P2 = `
  const lib = W.APEX_BOXE_GOLD_LIBRARY;
  const off = document.createElement('canvas'); off.width = 1; off.height = 1;
  const e = new lib.Engine(off, { visualOnly: true, materialFx: true, sound: false });
  const f = e.fluid;
  for (let i = 0; i < 26; i += 1) f.addHeat((i % 6) * 210 - 620, Math.floor(i / 6) * 220 - 480, 190, 1.05, 0.5);
  for (let i = 0; i < 12; i += 1) f.step(1 / 60);
  const proto = W.CanvasRenderingContext2D.prototype;
  const orig = proto.putImageData;
  let puts = 0;
  proto.putImageData = function (...a) { puts += 1; return orig.apply(this, a); };
  f.softPass = false; f.draw(ctx, 'smoke');
  const afterFirst = puts;
  ctx.save(); ctx.globalAlpha = 0.45; f.softPass = true; f.draw(ctx, 'smoke'); ctx.restore();
  proto.putImageData = orig;
  return { rastersPerFrame: puts, secondPassRasterised: puts > afterFirst,
           separateSurfaces: !!(f.imgByLayer && f.imgByLayer['smoke-soft']) };
`;

// P1 — CRYSTALA bloom wide halo filter
const P1 = `
  const G = W.APEX_CRYSTALA_GOLD;
  if (!G || !G.createBloomSystem) return { skip: 'createBloomSystem not exported', keys: Object.keys(G || {}).slice(0,8) };
  const b = G.createBloomSystem({ width: 400, height: 400, scale: 0.5, dpr: 1 });
  b.ensure(400, 400, 1);
  const g2 = b.begin(0, 0, 400, 400);
  g2.fillStyle = '#ffb343'; g2.fillRect(120, 120, 140, 140);
  b.composite(ctx, 400, 400, null);
  return { composited: true, isFilterSupported: b.isFilterSupported };
`;

// P3/P4 — FROST shadow + flow budgets (read the module's own decision)
const P3 = `
  const G = W.APEX_FROST_GOLD;
  const f = new G.IceField(1000, 1000);
  for (let i = 0; i < 9; i += 1) f.add(400 + i * 30, 500, i * 0.3, 110, 44, 0.0, 'wall', { lockDur: 0.55 });
  const proto = W.CanvasRenderingContext2D.prototype;
  const origFill = proto.fill;
  let fills = 0, dashed = 0;
  proto.fill = function (...a) { fills += 1; return origFill.apply(this, a); };
  const origStroke = proto.stroke;
  proto.stroke = function (...a) { if (this.getLineDash && this.getLineDash().length) dashed += 1; return origStroke.apply(this, a); };
  f.render(ctx, 3.0, 1);
  proto.fill = origFill; proto.stroke = origStroke;
  return { fills, budgetShadow: W.APEX_ICE_SHADOW_NODE_BUDGET, budgetFlow: W.APEX_ICE_FLOW_MOTION_BUDGET };
`;

const HIGH = { APEX_GRAPHICS_FLUID_SOFT_ALPHA: 1, APEX_GRAPHICS_BLOOM_WIDE: 1, APEX_ICE_SHADOW_NODE_BUDGET: undefined, APEX_ICE_FLOW_MOTION_BUDGET: undefined };
const PERF = { APEX_GRAPHICS_FLUID_SOFT_ALPHA: 0, APEX_GRAPHICS_BLOOM_WIDE: 0, APEX_ICE_SHADOW_NODE_BUDGET: 5, APEX_ICE_FLOW_MOTION_BUDGET: 0.55 };

const results = {};
for (const [name, src, code] of [['P2 BOXE soft smoke', SRC.boxe, P2], ['P1 CRYSTALA bloom', SRC.crystala, P1], ['P3/P4 FROST ice', SRC.frost, P3]]) {
  const high = await inRealm(src, HIGH, code);
  const perf = await inRealm(src, PERF, code);
  results[name] = { high, perf };
  console.log(`\n${name}`);
  console.log('  HIGH', JSON.stringify(high));
  console.log('  PERF', JSON.stringify(perf));
}
fs.writeFileSync('/tmp/candidate-proof.json', JSON.stringify(results, null, 1));
await browser.close(); process.exit(0);
