// Proves the renderer optimisations are OUTPUT-EQUIVALENT to the pristine
// baseline in ONE browser with NO simulation and NO timing.
//
// Method: old (13b42fc8) and new module sources are evaluated in two isolated
// same-origin iframes (separate realms => no shared globals). Each realm builds
// an IceField with an identical node/carve set through the public add()/
// addCarve() API and calls the public render(ctx, t, px) with identical
// arguments on identical canvases. Any difference is the renderer change alone.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const REPO = '/home/user/APEX-CHAOS';
const SRC = {
  frostOld: fs.readFileSync('/tmp/frost-old.js', 'utf8'),
  frostNew: fs.readFileSync(REPO + '/public/game/hero-rework/frostGoldV1.js', 'utf8'),
};
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1100, deviceScaleFactor: 1 });
await page.setContent('<!doctype html><html><body></body></html>');

async function paint(source, bodyCode) {
  return page.evaluate(async ({ source, bodyCode }) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:0;height:0;border:0;position:absolute';
    document.body.appendChild(frame);
    const d = frame.contentDocument;
    d.open(); d.write('<!doctype html><html><body></body></html>'); d.close();
    let a = 0x9E3779B9;
    frame.contentWindow.Math.random = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const s = d.createElement('script');
    s.textContent = source;
    d.body.appendChild(s);
    const W = frame.contentWindow;
    const canvas = d.createElement('canvas');
    canvas.width = 1000; canvas.height = 1000;
    d.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let err = null, info = null;
    try {
      info = await new Function('W', 'ctx', 'canvas', bodyCode)(W, ctx, canvas);
    } catch (e) { err = String(e && e.stack || e).slice(0, 300); }
    let hash = 0, grid = [];
    if (!err) {
      const g = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      hash = 2166136261;
      for (let i = 0; i < g.length; i += 4) { hash ^= g[i]; hash = Math.imul(hash, 16777619); hash ^= g[i+1]; hash = Math.imul(hash, 16777619); hash ^= g[i+2]; hash = Math.imul(hash, 16777619); }
      hash = hash >>> 0;
      const step = 3;
      for (let y = 0; y < canvas.height; y += step) for (let x = 0; x < canvas.width; x += step) {
        const i = (y * canvas.width + x) * 4;
        grid.push(g[i], g[i+1], g[i+2]);
      }
    }
    frame.remove();
    return { err, info, hash, grid, w: canvas.width, h: canvas.height };
  }, { source, bodyCode });
}

function compare(a, b) {
  if (a.err || b.err) return { error: 'render error', a: a.err, b: b.err };
  const n = Math.min(a.grid.length, b.grid.length);
  let changed = 0, sum = 0, max = 0, over2 = 0, over8 = 0;
  for (let i = 0; i < n; i += 3) {
    const dr = Math.abs(a.grid[i]-b.grid[i]), dg = Math.abs(a.grid[i+1]-b.grid[i+1]), db = Math.abs(a.grid[i+2]-b.grid[i+2]);
    const dd = Math.max(dr, dg, db);
    sum += dr + dg + db;
    if (dd > 0) changed += 1;
    if (dd > max) max = dd;
    if (dd > 2) over2 += 1;
    if (dd > 8) over8 += 1;
  }
  const px = n / 3;
  return { samples: px, changedPct: +(100*changed/px).toFixed(3), over2Pct: +(100*over2/px).toFixed(3),
           over8Pct: +(100*over8/px).toFixed(3), maxDelta: max, meanAbs: +(sum/(px*3)).toFixed(3), identical: changed === 0 };
}

// Scenarios cover the passes that were rewritten: P0-P3b fills, decay, spurs,
// plus a dense field (many nodes => batching actually engages).
const CASES = {
  'ice-wall-p3': `
    const G = W.APEX_FROST_GOLD;
    const f = new G.IceField(1000, 1000);
    f.add(380, 520, 0.35, 130, 48, 0.0, 'wall', { lockDur: 0.55 });
    f.add(470, 560, 0.90, 100, 40, 0.0, 'wall', { lockDur: 0.55 });
    f.add(300, 470, 1.40, 155, 54, 0.0, 'lane', { lockDur: 0.55 });
    f.add(560, 500, 2.20, 115, 42, 0.0, 'wall', { lockDur: 0.55 });
    const t = 2.4, px = 1;
    const painted = f.render(ctx, t, px);
    return { painted, nodes: f.nodes.length };`,
  'ice-dense': `
    const G = W.APEX_FROST_GOLD;
    const f = new G.IceField(1000, 1000);
    // 14 overlapping nodes in several colours: the batching path must merge
    // runs without changing z-order or coverage.
    for (let i = 0; i < 14; i += 1) {
      const a = i * 0.45;
      f.add(500 + Math.cos(a) * 150, 500 + Math.sin(a) * 150, a, 90 + (i % 5) * 18, 34 + (i % 3) * 9, 0.0,
            i % 4 === 0 ? 'lane' : 'wall', { lockDur: 0.55, spurChance: 0.5 });
    }
    const t = 3.1, px = 1;
    const painted = f.render(ctx, t, px);
    return { painted, nodes: f.nodes.length };`,
  'ice-decaying': `
    const G = W.APEX_FROST_GOLD;
    const f = new G.IceField(1000, 1000);
    for (let i = 0; i < 7; i += 1) {
      const n = f.add(400 + i * 32, 500, i * 0.3, 110, 44, 0.0, 'wall', { lockDur: 0.55 });
      n.decayAt = 1.0; n.decayDur = 1.15;   // drive the recessed-decay code path
    }
    const t = 2.0, px = 1;
    const painted = f.render(ctx, t, px);
    return { painted, nodes: f.nodes.length };`,
  'ice-carves': `
    const G = W.APEX_FROST_GOLD;
    const f = new G.IceField(1000, 1000);
    for (let i = 0; i < 5; i += 1) f.add(420 + i * 34, 470, i * 0.4, 120, 46, 0.0, 'wall', { lockDur: 0.55 });
    for (let i = 0; i < 4; i += 1) f.addCarve(430 + i * 40, 560 + i * 8, i * 0.7, i % 2 ? 1 : -1, 0.4 + i * 0.1, 0.0, 14);
    const t = 2.6, px = 1;
    const painted = f.render(ctx, t, px);
    return { painted, nodes: f.nodes.length, carves: f.carves.length };`,
};

const report = { cases: {} };
for (const [name, code] of Object.entries(CASES)) {
  const oldR = await paint(SRC.frostOld, code);
  const newR = await paint(SRC.frostNew, code);
  const diff = compare(oldR, newR);
  const sameErr = oldR.err && newR.err;
  report.cases[name] = { old: { hash: oldR.hash, err: oldR.err, info: oldR.info }, new: { hash: newR.hash, err: newR.err, info: newR.info }, diff };
  console.log(`${name.padEnd(14)} old=${oldR.hash} new=${newR.hash} ${oldR.err ? 'OLD_ERR ' + oldR.err.slice(0,90) : ''} ${newR.err ? 'NEW_ERR ' + newR.err.slice(0,90) : ''}`);
  console.log(`   ${sameErr ? '(both failed identically — inconclusive)' : JSON.stringify(diff)}`);
}
fs.writeFileSync(process.env.OUT || '/tmp/render-equiv.json', JSON.stringify(report, null, 1));
console.log('WROTE', process.env.OUT || '/tmp/render-equiv.json');
await browser.close(); process.exit(0);
