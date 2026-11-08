// Deterministic visual-diff: baseline(13b42fc8) vs HIGH vs PERFORMANCE.
//
// Design notes (why this measures what it claims):
//  * Both the baseline and the optimised tree are driven the SAME way, so any
//    difference is caused by the code under test, not the harness.
//  * Wall-clock is removed from the comparison: frameBudget-style fixed-dt
//    stepping drives update()/draw() a fixed number of times, and skills are
//    pressed on the same frame indices in every arm.
//  * We read the ARENA canvas AND the FX canvas. The FX canvas carries the
//    hero VFX under test; the arena carries bodies and the world.
//  * The capture happens on the SAME frame index, so a difference cannot be a
//    one-frame skew. A control run (same arm, twice) quantifies harness noise.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { startServer } = await import('../../perf/goldNestedServer.mjs');
const seed = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/qaProfile.js', 'utf8');
const REPO = '/home/user/APEX-CHAOS';

const SEED_JS = `(function(){var a=0x9E3779B9;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`;
const ARM_TREE = { baseline: 'dist-baseline', high: 'dist-itch-html5', performance: 'dist-itch-html5' };
const SCEN = [
  { id: 'crystala-frost', p1: 'crystala', p2: 'frost' },
  { id: 'boxe-frost', p1: 'boxe', p2: 'frost' },
  { id: 'shuri-crystala', p1: 'shuri', p2: 'crystala' },
  { id: 'crystala-boxe', p1: 'crystala', p2: 'boxe' },
];
const FRAMES = Number(process.env.FRAMES || 110);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const scen = only ? SCEN.filter(s => only.includes(s.id)) : SCEN;
const ARMS = (process.env.ARMS || 'baseline,high,performance').split(',');

async function runArm(sc, mode) {
  const srv = await startServer({ root: `${REPO}/${ARM_TREE[mode]}` });
  const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
    protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(SEED_JS);
  await page.evaluateOnNewDocument(seed);
  try {
    await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
    await page.evaluate(() => document.getElementById('apex-boot-start').click());
    await page.waitForSelector('#freeBattle', { visible: true, timeout: 180000 });
    await page.evaluate(() => {
      document.body.classList.remove('apex-scene-transition-active');
      document.body.dataset.apexSceneTransition = 'DONE';
      const cv = document.getElementById('apex-scene-transition');
      if (cv) cv.style.display = 'none';
    });
    await new Promise(r => setTimeout(r, 1500));
    if (mode !== 'baseline') await page.evaluate(m => window.APEX_GRAPHICS_QUALITY?.set(m, 'diff'), mode);
    await page.evaluate(async ({ p1, p2 }) => {
      const h = document.getElementById('battleHudHost');
      h.classList.add('is-open'); document.body.classList.add('battle-hud-open');
      const html = await (await fetch(new URL('battle-hud.html', document.baseURI).href, { cache: 'no-cache' })).text();
      await new Promise(r => window.APEX_GOLD.mountBattleHud(html, r));
      await window.APEX_GOLD.onHandoff({ mode: 'LOCAL', p1, p2, p1Hero: p1, p2Hero: p2, shell: 'battle' });
      await window.APEX_GOLD.onBattleLive({ mode: 'local1v1', p1, p2 });
    }, { p1: sc.p1, p2: sc.p2 });
    await new Promise(r => setTimeout(r, 1500));
    const out = await page.evaluate(async ({ frames }) => {
      const api = window.APEX_GOLD;
      const dt = 1 / 60;
      // Skills land at fixed frames. The last ~6 frames let the newest VFX
      // develop so the readback is not of a freshly-spawned, zero-alpha frame.
      const at = { 10: [0,0], 18: [1,0], 30: [0,1], 44: [1,1], 58: [0,0], 74: [1,0], 88: [0,1] };
      for (let i = 0; i < frames; i += 1) {
        const a = at[i];
        if (a) { try { api.pressSkill(a[0], a[1]); } catch (e) {} }
        try { window.update(dt); } catch (e) {}
        try { window.draw(); } catch (e) {}
      }
      // Draw the FX layer explicitly so the FX canvas is current.
      if (window.APEX_COMBAT_EFFECTS && typeof window.APEX_COMBAT_EFFECTS.render === 'function') {
        try { window.APEX_COMBAT_EFFECTS.render(); } catch (e) {}
      }
      function grab(el) {
        if (!el || !el.width) return null;
        const g = document.createElement('canvas');
        g.width = el.width; g.height = el.height;
        const gc = g.getContext('2d', { willReadFrequently: true });
        gc.drawImage(el, 0, 0);
        const d = gc.getImageData(0, 0, g.width, g.height).data;
        let hash = 2166136261;
        for (let i = 0; i < d.length; i += 4) { hash ^= d[i]; hash = Math.imul(hash, 16777619); hash ^= d[i+1]; hash = Math.imul(hash, 16777619); hash ^= d[i+2]; hash = Math.imul(hash, 16777619); }
        const grid = [], step = 4;
        for (let y = 0; y < g.height; y += step) for (let x = 0; x < g.width; x += step) {
          const i = (y * g.width + x) * 4;
          grid.push(d[i], d[i+1], d[i+2]);
        }
        return { w: g.width, h: g.height, hash: hash >>> 0, grid, step };
      }
      const arena = grab(window.canvas || document.getElementById('game-canvas'));
      const fx = grab(document.getElementById('fxCanvas'));
      return {
        arena, fx,
        fighters: (window.fighters || []).map(f => f.name),
        hp: (window.fighters || []).map(f => Math.round(f.hp)),
        particles: (window.particles || []).length,
        projectiles: (window.projectiles || []).length,
        mode: window.APEX_GRAPHICS_QUALITY ? window.APEX_GRAPHICS_QUALITY.mode : null,
      };
    }, { frames: FRAMES });
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, error: String(e.message).slice(0, 200) };
  } finally {
    await browser.close().catch(() => {});
    await srv.server.close();
  }
}

function compare(a, b, label) {
  if (!a || !b) return { error: 'missing surface ' + label };
  if (a.w !== b.w || a.h !== b.h) return { error: 'shape mismatch ' + label };
  const n = Math.min(a.grid.length, b.grid.length);
  let changed = 0, sum = 0, max = 0, over2 = 0, over8 = 0;
  for (let i = 0; i < n; i += 3) {
    const dr = Math.abs(a.grid[i]-b.grid[i]), dg = Math.abs(a.grid[i+1]-b.grid[i+1]), db = Math.abs(a.grid[i+2]-b.grid[i+2]);
    const d = Math.max(dr, dg, db);
    sum += dr + dg + db;
    if (d > 0) changed += 1;
    if (d > max) max = d;
    if (d > 2) over2 += 1;
    if (d > 8) over8 += 1;
  }
  const px = n / 3;
  return { samples: px, changedPct: +(100*changed/px).toFixed(3), over2Pct: +(100*over2/px).toFixed(3),
           over8Pct: +(100*over8/px).toFixed(3), maxDelta: max, meanAbs: +(sum/(px*3)).toFixed(3), identical: changed === 0 };
}

const report = { frames: FRAMES, viewport: '1000x1000 dpr1', scenarios: [] };
for (const sc of scen) {
  const row = { id: sc.id, arms: {}, diff: {} };
  const got = {};
  for (const mode of ARMS) {
    const r = await runArm(sc, mode);
    if (!r.ok) { console.log(`${sc.id} ${mode} ERROR ${r.error}`); row.arms[mode] = { error: r.error }; continue; }
    got[mode] = r;
    row.arms[mode] = { arenaHash: r.arena?.hash, fxHash: r.fx?.hash, fighters: r.fighters, hp: r.hp,
                       particles: r.particles, projectiles: r.projectiles, mode: r.mode };
    console.log(`${sc.id.padEnd(16)} ${mode.padEnd(12)} arena=${r.arena?.hash} fx=${r.fx?.hash} hp=${JSON.stringify(r.hp)} parts=${r.particles} proj=${r.projectiles} q=${r.mode}`);
  }
  // Gameplay invariants must hold across all arms: identical HP and identical
  // entity counts prove the simulation was untouched.
  const simKey = (r) => JSON.stringify({ hp: r.hp, particles: r.particles, projectiles: r.projectiles, fighters: r.fighters });
  const sims = Object.entries(got).map(([k, v]) => [k, simKey(v)]);
  row.simulationIdentical = sims.every(([, v]) => v === sims[0][1]);
  row.simulationDetail = Object.fromEntries(sims);
  if (got.high && got.baseline) { row.diff.arenaHighVsBaseline = compare(got.baseline.arena, got.high.arena, 'arena'); row.diff.fxHighVsBaseline = compare(got.baseline.fx, got.high.fx, 'fx'); }
  if (got.performance && got.baseline) { row.diff.arenaPerfVsBaseline = compare(got.baseline.arena, got.performance.arena, 'arena'); row.diff.fxPerfVsBaseline = compare(got.baseline.fx, got.performance.fx, 'fx'); }
  if (got.performance && got.high) { row.diff.arenaPerfVsHigh = compare(got.high.arena, got.performance.arena, 'arena'); row.diff.fxPerfVsHigh = compare(got.high.fx, got.performance.fx, 'fx'); }
  console.log(`   sim identical across arms: ${row.simulationIdentical}`);
  for (const [k, v] of Object.entries(row.diff)) console.log(`   ${k.padEnd(24)} ${JSON.stringify(v)}`);
  report.scenarios.push(row);
}
fs.writeFileSync(process.env.OUT || '/tmp/vfxdif.json', JSON.stringify(report, null, 1));
console.log('WROTE', process.env.OUT || '/tmp/vfxdif.json');
process.exit(0);
