// Deterministic perceptual diff: render the SAME simulation frame in both
// modes and compare the actual canvas pixels. No animation timing involved.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { startServer } from '../perf/goldNestedServer.mjs';
import { enterMatch } from '../perf/enterMatch.js';

const srv = await startServer({ root: '../../dist-itch-html5' });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function capture(p1, p2, steps) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(`(()=>{try{localStorage.setItem('apexChaos.arsenalMeta.v1',JSON.stringify({version:1,ownedFighters:['ROBOT','HUNTER','CRYSTAL','MAGNET','ICE','MIRROR','BOXE','SHURI'],unlockedAt:{}}))}catch(e){}})();`);
  await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
  await page.evaluate(() => document.getElementById('apex-boot-start').click());
  await page.waitForSelector('#freeBattle', { visible: true, timeout: 150000 });
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => { const no = document.getElementById('apex-tutorial-ask-no'); if (no) { no.click(); return true; } return !document.querySelector('.fpGuide'); });
    if (done) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 2500));
  await enterMatch(page, { p1, p2, mode: 'local1v1' });
  await new Promise(r => setTimeout(r, 1200));

  const out = await page.evaluate(async (opts) => {
    // Deterministic drive: fixed dt, paused camera shake, no wall-clock input.
    const A = window.APEX_GRAPHICS_QUALITY;
    const api = window.APEX_GOLD;
    function freeze() {
      try { window.cameraShake = 0; } catch (e) {}
      try { if (typeof cameraShake !== 'undefined') cameraShake = 0; } catch (e) {}
    }
    function readCanvas() {
      const c = document.getElementById('game-canvas') || document.querySelector('canvas');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height);
      // Cheap stable digest + downsampled copy for the node-side diff.
      const step = 4;
      const w = Math.floor(c.width / step), h = Math.floor(c.height / step);
      const small = new Uint8Array(w * h * 3);
      let k = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = ((y * step) * c.width + (x * step)) * 4;
        small[k++] = d.data[i]; small[k++] = d.data[i + 1]; small[k++] = d.data[i + 2];
      }
      return { w, h, bytes: Array.from(small) };
    }
    // Establish a rich, frozen state.
    A.set('high', 'diff');
    for (let i = 0; i < opts.updates; i++) {
      if (opts.skills && i % 12 === 0) { try { api.pressSkill(0, 0); } catch (e) {} }
      if (opts.skills && i % 17 === 0) { try { api.pressSkill(0, 1); } catch (e) {} }
      if (opts.skills && i % 23 === 0) { try { api.pressSkill(1, 0); } catch (e) {} }
      if (opts.skills && i % 29 === 0) { try { api.pressSkill(1, 1); } catch (e) {} }
      window.update(1 / 60);
    }
    freeze(); window.draw();
    const high = readCanvas();
    A.set('performance', 'diff');
    freeze(); window.draw();
    const perf = readCanvas();
    A.set('high', 'diff');
    freeze(); window.draw();
    const high2 = readCanvas();
    return { high, perf, high2, diag: window.APEX_GRAPHICS_MODE_RUNTIME.diagnose() };
  }, { updates: steps, skills: true });
  await page.close();
  return { ...out, errs: errs.slice(0, 3) };
}

function diff(a, b) {
  let gt2 = 0, gt8 = 0, tot = 0, mx = 0;
  const n = a.bytes.length / 3;
  for (let i = 0; i < a.bytes.length; i++) {
    const d = Math.abs(a.bytes[i] - b.bytes[i]);
    if (d > 2) gt2++;
    if (d > 8) gt8++;
    tot += d;
    if (d > mx) mx = d;
  }
  return { gt2pct: +(100 * gt2 / (n * 3)).toFixed(3), gt8pct: +(100 * gt8 / (n * 3)).toFixed(3), meanAbs: +(tot / (n * 3)).toFixed(3), maxAbs: mx };
}

const report = [];
for (const [p1, p2] of [['crystala', 'frost'], ['boxe', 'frost'], ['shuri', 'crystala']]) {
  const r = await capture(p1, p2, 420);
  const noise = diff(r.high, r.high2);       // same mode, same state => render noise floor
  const real = diff(r.high, r.perf);
  report.push({ matchup: `${p1}-${p2}`, noiseFloor: noise, highVsPerformance: real, diag: r.diag.candidates, errs: r.errs });
  console.log(`${p1}-${p2}  noise: gt2=${noise.gt2pct}% max=${noise.maxAbs}  |  HIGH vs PERF: gt2=${real.gt2pct}% gt8=${real.gt8pct}% mean=${real.meanAbs} max=${real.maxAbs}`);
}
fs.writeFileSync('/tmp/percdiff.json', JSON.stringify(report, null, 2));
await browser.close(); srv.server.close();
