// Per-frame JS + Canvas-command volume: baseline(13b42fc8) vs HIGH vs PERFORMANCE.
//
// What this measures (stated honestly): the CPU work the game owns per frame —
// update() and draw() JS milliseconds plus the Canvas2D command volume it
// submits — at a FIXED dt with the product engine loop stopped. Displayed FPS
// is NOT measurable here: this sandbox is software-rasterised and throttles
// rAF to a few Hz, so wall-clock FPS would measure the sandbox, not the game.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { startServer } = await import('../../perf/goldNestedServer.mjs');
const seed = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/qaProfile.js', 'utf8');
const instrument = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/instrument.js', 'utf8');
const frameBudget = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/frameBudget.js', 'utf8');
const REPO = '/home/user/APEX-CHAOS';
const ARM_TREE = { baseline: 'dist-baseline', high: 'dist-itch-html5', performance: 'dist-itch-html5' };
const SCEN = [
  { id: 'crystala-frost-skills', p1: 'crystala', p2: 'frost', fn: 'skills' },
  { id: 'crystala-frost-burst', p1: 'crystala', p2: 'frost', fn: 'burst' },
  { id: 'boxe-frost-skills', p1: 'boxe', p2: 'frost', fn: 'skills' },
  { id: 'boxe-frost-burst', p1: 'boxe', p2: 'frost', fn: 'burst' },
  { id: 'shuri-frost-burst', p1: 'shuri', p2: 'frost', fn: 'burst' },
  { id: 'shuri-crystala-burst', p1: 'shuri', p2: 'crystala', fn: 'burst' },
  { id: 'crystala-boxe-burst', p1: 'crystala', p2: 'boxe', fn: 'burst' },
  { id: 'botwave-skills', p1: 'newbot', p2: 'hunter', fn: 'skills', mode: 'bot' },
];
const FRAMES = Number(process.env.FRAMES || 120);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const scen = only ? SCEN.filter(s => only.includes(s.id)) : SCEN;

async function arm(sc, armName, order) {
  const srv = await startServer({ root: `${REPO}/${ARM_TREE[armName]}` });
  const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
    protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(instrument);
  await page.evaluateOnNewDocument(seed);
  try {
    await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
    await page.evaluate(() => document.getElementById('apex-boot-start').click());
    await page.waitForSelector('#freeBattle', { visible: true, timeout: 180000 });
    await page.evaluate(() => {
      document.body.classList.remove('apex-scene-transition-active');
      document.body.dataset.apexSceneTransition = 'DONE';
      const cv = document.getElementById('apex-scene-transition'); if (cv) cv.style.display = 'none';
    });
    await new Promise(r => setTimeout(r, 2000));
    if (armName !== 'baseline') await page.evaluate(m => window.APEX_GRAPHICS_QUALITY?.set(m, 'bench'), armName);
    await page.addScriptTag({ content: instrument });
    await page.addScriptTag({ content: frameBudget });
    await page.evaluate(async ({ p1, p2, mode }) => {
      const h = document.getElementById('battleHudHost');
      h.classList.add('is-open'); document.body.classList.add('battle-hud-open');
      const html = await (await fetch(new URL('battle-hud.html', document.baseURI).href, { cache: 'no-cache' })).text();
      await new Promise(r => window.APEX_GOLD.mountBattleHud(html, r));
      await window.APEX_GOLD.onHandoff({ mode: mode === 'bot' ? 'BOT' : 'LOCAL', p1, p2, p1Hero: p1, p2Hero: p2, shell: 'battle' });
      await window.APEX_GOLD.onBattleLive({ mode, p1, p2 });
    }, { p1: sc.p1, p2: sc.p2, mode: sc.mode || 'local1v1' });
    await new Promise(r => setTimeout(r, 1200));
    if (armName !== 'baseline') await page.evaluate(m => window.APEX_GRAPHICS_QUALITY?.set(m, 'bench'), armName);
    const res = await page.evaluate(async ({ n, id, fn, armName }) => {
      if (armName !== 'baseline') window.APEX_GRAPHICS_QUALITY?.set(armName, 'bench');
      const api = window.APEX_GOLD;
      const map = {
        none: null,
        skills: (i) => { if (i % 22 === 0) { try { api.pressSkill(0, 0); } catch (e) {} }
                         if (i % 34 === 11) { try { api.pressSkill(0, 1); } catch (e) {} }
                         if (i % 28 === 5) { try { api.pressSkill(1, 0); } catch (e) {} }
                         if (i % 38 === 19) { try { api.pressSkill(1, 1); } catch (e) {} } },
        burst: (i) => { if (i % 10 === 0) { try { api.pressSkill(0, 0); api.pressSkill(0, 1); api.pressSkill(1, 0); api.pressSkill(1, 1); } catch (e) {} } },
      };
      const r = await window.__APEX_FRAME_BUDGET({ frames: n, label: id, scenario: map[fn] });
      r.quality = window.APEX_GRAPHICS_QUALITY ? window.APEX_GRAPHICS_QUALITY.mode : null;
      return r;
    }, { n: FRAMES, id: sc.id, fn: sc.fn, armName });
    return { ok: true, order, ...res, errs: errs.slice(0, 3) };
  } catch (e) {
    return { ok: false, error: String(e.message).slice(0, 160), order };
  } finally {
    await browser.close().catch(() => {});
    await srv.server.close();
  }
}

// Alternating order both ways so JIT/thermal drift cannot favour one arm.
const report = { frames: FRAMES, viewport: '1440x900 dpr1', method: 'fixed-dt update()/draw() budget with the product rAF loop stopped', scenarios: [] };
for (const sc of scen) {
  const row = { id: sc.id, arms: {} };
  const fwd = ['baseline', 'high', 'performance'];
  const rev = ['performance', 'high', 'baseline'];
  for (const [label, order] of [['fwd', fwd], ['rev', rev]]) {
    for (const a of order) {
      const r = await arm(sc, a, label);
      if (!r.ok) { console.log(`${sc.id} ${a}/${label} ERROR ${r.error}`); continue; }
      (row.arms[a] || (row.arms[a] = [])).push({
        frame: r.frame, draw: r.draw, update: r.update,
        jsFps: r.jsFpsEquivalent, ops: r.perFrameOps, quality: r.quality, errs: r.errs,
      });
      console.log(`${sc.id.padEnd(22)} ${a.padEnd(11)} ${label} frame p50=${String(r.frame.p50).padStart(8)} p95=${String(r.frame.p95).padStart(9)} draw p50=${String(r.draw.p50).padStart(7)} fill=${r.perFrameOps.fill} drawImage=${r.perFrameOps.drawImage}`);
    }
  }
  report.scenarios.push(row);
}
fs.writeFileSync(process.env.OUT || '/tmp/perf-matrix.json', JSON.stringify(report, null, 1));
console.log('WROTE', process.env.OUT || '/tmp/perf-matrix.json');
process.exit(0);
