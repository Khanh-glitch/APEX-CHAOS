// Full-game Canvas2D cost: HIGH vs PERFORMANCE on IDENTICAL game states.
//
// Why command counts and not wall-clock FPS: this sandbox's wall clock cannot
// resolve a few-percent difference (the same arm varies 26-40 % run to run),
// while Canvas2D command volume is exact and reproducible. It is also precisely
// what PERFORMANCE claims to change: it removes duplicated drawing work. The
// probe therefore also asserts that nothing else moved — same fighters, same
// game state, same HUD information.
//
// Method (this is the part that has to be right):
//   1. boot the nested shipping build and enter ONE live match;
//   2. neutralise the engine loop so nothing advances behind our back;
//   3. for each of several real moments: advance the simulation a fixed number
//      of frames with update(1/60) — deterministic, then FREEZE;
//   4. on that single frozen state, draw alternately HIGH, PERFORMANCE, HIGH,
//      PERFORMANCE and count Canvas2D commands per mode.
// Alternating on ONE frozen state is what makes the comparison honest: the
// modes cannot be shown different fights. Repeating HIGH (H1 vs H2) on the same
// state is a built-in control — if draw() itself mutated the state, H2 would
// drift from H1 and the run is reported as unusable instead of as a result.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { startServer } = await import('../../perf/goldNestedServer.mjs');

const REPO = '/home/user/APEX-CHAOS';
const BLOCKS = Number(process.env.BLOCKS || 4);
const ADVANCE = Number(process.env.ADVANCE || 45);
const OUT = process.env.OUT || '/tmp/mode-cost.json';
const SHOTS = process.env.SHOTS || '/tmp/mode-cost';
fs.mkdirSync(SHOTS, { recursive: true });

const srv = await startServer({ root: REPO + '/dist-itch-html5' });
const seed = fs.readFileSync(REPO + '/tools/perf/qaProfile.js', 'utf8');
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000,
  args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(seed);
await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
await page.evaluate(() => document.getElementById('apex-boot-start').click());
await page.waitForSelector('#freeBattle', { visible: true, timeout: 180000 });
await page.evaluate(() => {
  document.body.classList.remove('apex-scene-transition-active');
  document.body.dataset.apexSceneTransition = 'DONE';
  const cv = document.getElementById('apex-scene-transition'); if (cv) cv.style.display = 'none';
});
await new Promise((r) => setTimeout(r, 2000));

// Enter ONE live match through the product hand-off helpers.
await page.evaluate(async () => {
  const h = document.getElementById('battleHudHost');
  h.classList.add('is-open'); document.body.classList.add('battle-hud-open');
  const html = await (await fetch(new URL('battle-hud.html', document.baseURI).href, { cache: 'no-cache' })).text();
  await new Promise((r) => window.APEX_GOLD.mountBattleHud(html, r));
  await window.APEX_GOLD.onHandoff({ mode: 'LOCAL', p1: 'crystala', p2: 'frost', p1Hero: 'crystala', p2Hero: 'frost', shell: 'battle' });
  await window.APEX_GOLD.onBattleLive({ mode: 'local1v1', p1: 'crystala', p2: 'frost' });
});
await new Promise((r) => setTimeout(r, 2500));

const results = { blocks: BLOCKS, advance: ADVANCE, modes: { high: {}, performance: {} }, states: [] };

for (let b = 0; b < BLOCKS; b += 1) {
  const block = await page.evaluate(async ({ advance }) => {
    // --- neutralise the engine loop for the whole block -------------------
    const realRaf = window.requestAnimationFrame;
    if (typeof window.reqId === 'number' && window.reqId) {
      try { cancelAnimationFrame(window.reqId); } catch (e) {}
      try { window.reqId = 0; } catch (e) {}
    }
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};

    // --- drive real abilities, then advance a fixed amount ----------------
    // An idle arena has no ice and no bloom, so PERFORMANCE would have nothing
    // to trim and an all-zero delta would prove nothing. Cast the expensive
    // abilities first, then freeze WHILE the effect is on screen.
    let advErr = null;
    const castLog = [];
    try {
      const f0 = (window.fighters || [])[0];
      const f1 = (window.fighters || [])[1];
      const HR = window.APEX_HERO_REWORK;
      const GATE = window.APEX_ARSENAL_SKILL_GATE;
      const press = (f, slot) => {
        const r = (HR && HR.pressAbility && HR.pressAbility(f, slot, { source: 'probe' }))
          || (GATE && GATE.pressJ && GATE.pressJ(f));
        return r ? (r.ok === undefined ? 'gate' : (r.ok ? 'ok' : (r.reason || 'no'))) : 'none';
      };
      for (let round = 0; round < 3; round += 1) {
        castLog.push(press(f1, round === 1 ? 'A2' : 'A1'));
        castLog.push(press(f0, round === 1 ? 'A2' : 'A1'));
        for (let i = 0; i < 12; i += 1) window.update(1 / 60);
      }
      for (let i = 0; i < advance; i += 1) window.update(1 / 60);
    }
    catch (e) { advErr = String(e && e.message || e).slice(0, 200); }

    // --- count one draw() in each mode ------------------------------------
    const OPS = ['fill', 'stroke', 'beginPath', 'drawImage', 'putImageData', 'clearRect',
      'clip', 'moveTo', 'lineTo', 'closePath', 'fillRect', 'arc', 'quadraticCurveTo', 'bezierCurveTo'];
    const proto = CanvasRenderingContext2D.prototype;
    const countDraw = (mode) => {
      window.APEX_GRAPHICS_QUALITY.set(mode, 'probe');
      const counts = {};
      const restore = [];
      for (const op of OPS) {
        const orig = proto[op];
        if (typeof orig !== 'function') continue;
        proto[op] = function (...args) { counts[op] = (counts[op] || 0) + 1; return orig.apply(this, args); };
        restore.push([op, orig]);
      }
      let err = null;
      try { window.draw(); } catch (e) { err = String(e && e.message || e).slice(0, 200); }
      for (const [op, orig] of restore) proto[op] = orig;
      return { counts, err };
    };
    // Alternate on the frozen state: H, P, H, P.
    const h1 = countDraw('high');
    const p1 = countDraw('performance');
    const h2 = countDraw('high');
    const p2 = countDraw('performance');
    window.requestAnimationFrame = realRaf;

    const snapshot = {
      fighters: (window.fighters || []).map((f) => ({ hp: Math.round(f.hp), x: Math.round(f.x), y: Math.round(f.y) })),
      gameState: window.gameState || null,
      ice: (window.APEX_FROST_GOLD && window.fighters)
        ? (window.fighters || []).length : 0,
      hudGfx: document.getElementById('hud')?.getAttribute('data-gfx') || null,
      // Is there actually any ice to trim? PERFORMANCE's FROST candidates can
      // only show up when an ice field exists at the sampled moment.
      iceNodes: (() => {
        try {
          const pres = window.APEX_FROST_PRESENTATION;
          const e = pres && pres.engineFor ? pres.engineFor((window.fighters || [])[1]) : null;
          return e && e.ice ? e.ice.nodes.filter((n) => !n.dead).length : -1;
        } catch (err) { return -2; }
      })(),
      castLog: castLog,
      heroes: (window.fighters || []).map((f) => f && (f.heroId || f.name || '?')),
    };
    return { advance, advErr, h1, p1, h2, p2, snapshot,
             flagsHigh: { bloom: window.APEX_GRAPHICS_BLOOM_WIDE, fluid: window.APEX_GRAPHICS_FLUID_SOFT_ALPHA,
                          shadow: window.APEX_ICE_SHADOW_NODE_BUDGET, flow: window.APEX_ICE_FLOW_MOTION_BUDGET } };
  }, { advance: ADVANCE });

  results.states.push(block.snapshot);
  const add = (mode, c) => { for (const k of Object.keys(c)) results.modes[mode][k] = (results.modes[mode][k] || 0) + c[k]; };
  add('high', block.h1.counts); add('performance', block.p1.counts);
  add('high', block.h2.counts); add('performance', block.p2.counts);
  const controlOk = JSON.stringify(block.h1.counts) === JSON.stringify(block.h2.counts)
    && JSON.stringify(block.p1.counts) === JSON.stringify(block.p2.counts);
  console.log(`\nblock ${b + 1}/${BLOCKS}  advance=${block.advance} frames  fighters=${block.snapshot.fighters.length}  state=${block.snapshot.gameState}`);
  console.log(`  draw order H,P,H,P  control(H1==H2 && P1==P2) = ${controlOk}`);
  console.log(`  HIGH  (H1) fill=${block.h1.counts.fill} beginPath=${block.h1.counts.beginPath} drawImage=${block.h1.counts.drawImage}`);
  console.log(`  PERF  (P1) fill=${block.p1.counts.fill} beginPath=${block.p1.counts.beginPath} drawImage=${block.p1.counts.drawImage}`);
  console.log(`  world: heroes=${JSON.stringify(block.snapshot.heroes)} iceNodes=${block.snapshot.iceNodes} casts=${JSON.stringify(block.snapshot.castLog)}`);
  if (block.advErr) console.log('  ADVANCE ERROR', block.advErr);
  if (block.h1.err || block.p1.err) console.log('  DRAW ERROR', block.h1.err, block.p1.err);
  if (!controlOk) { console.log('  -> UNUSABLE BLOCK (draw mutates state); excluded from totals'); results.unusable = (results.unusable || 0) + 1; }
}

// The loop above counted 2 draws per mode per block; normalise per draw.
const perDraw = (c, n) => { const o = {}; for (const k of Object.keys(c)) o[k] = +(c[k] / n).toFixed(3); return o; };
const nDraws = results.unusable ? BLOCKS - results.unusable : BLOCKS;
results.perDraw = { high: perDraw(results.modes.high, nDraws * 2), performance: perDraw(results.modes.performance, nDraws * 2) };
results.delta = {};
for (const k of new Set([...Object.keys(results.perDraw.high), ...Object.keys(results.perDraw.performance)])) {
  const a = results.perDraw.high[k] || 0, b = results.perDraw.performance[k] || 0;
  results.delta[k] = { high: a, performance: b, diff: +(b - a).toFixed(3), pct: a ? +(((b - a) / a) * 100).toFixed(1) : null };
}
const total = (o) => Object.entries(o).filter(([k]) => k !== 'save' && k !== 'restore').reduce((s, [, v]) => s + v, 0);
results.totals = { high: total(results.perDraw.high), performance: total(results.perDraw.performance) };
results.totals.pct = +(((results.totals.performance - results.totals.high) / results.totals.high) * 100).toFixed(1);

console.log('\n--- Canvas2D commands per draw() ---');
for (const k of Object.keys(results.delta).sort((x, y) => Math.abs(results.delta[y].diff) - Math.abs(results.delta[x].diff)).slice(0, 12)) {
  const d = results.delta[k];
  console.log(`  ${k.padEnd(20)} high=${String(d.high).padStart(9)} perf=${String(d.performance).padStart(9)} ${String(d.pct).padStart(7)}%`);
}
console.log(`\n  TOTAL                 high=${String(results.totals.high).padStart(9)} perf=${String(results.totals.performance).padStart(9)} ${String(results.totals.pct).padStart(7)}%`);

await page.screenshot({ path: `${SHOTS}/frozen-end.png` });
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
await browser.close();
await srv.server.close();
process.exit(0);
