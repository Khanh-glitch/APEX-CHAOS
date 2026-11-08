// iceSplit.mjs — where inside the FROST ice pass does the 135 ms/frame go?
//
// bisectFrame.mjs ranked the subsystems: FROST ice (-135 ms/frame) is the
// largest single cost in a real battle frame, ahead of the CRYSTALA bloom
// (-69 ms). This probe splits the ice pass itself using the marks the shipped
// renderer already calls — markIceClear / markIceRender / markIceBlit — by
// installing the same probe shape the owner playtest capture exposes, so the
// instrumented path is the production path, not a re-implementation.
//
// Blocks are followed by a forced readback, because the render writes into an
// offscreen surface whose cost is only paid when something consumes it.
//
// Usage: ROOT=/tmp/zip8584 FRAMES=48 bash boot.sh evidence/iceSplit.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { startServer } = await import('../../perf/goldNestedServer.mjs');

const ROOT = process.env.ROOT || '/home/user/APEX-CHAOS/dist-itch-html5';
const FRAMES = Number(process.env.FRAMES || 48);
const OUT = process.env.OUT || '/tmp/iceSplit.json';
const DPR = Number(process.env.DPR || 3.5);
const seed = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/qaProfile.js', 'utf8');

const srv = await startServer({ root: ROOT });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000,
  args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.setViewport({ width: 432, height: 768, deviceScaleFactor: DPR });
await page.evaluateOnNewDocument(seed);
await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
await page.evaluate(() => document.getElementById('apex-boot-start').click());
await page.waitForSelector('#freeBattle', { visible: true, timeout: 180000 });
await page.evaluate(() => {
  document.body.classList.remove('apex-scene-transition-active');
  document.body.dataset.apexSceneTransition = 'DONE';
  const c = document.getElementById('apex-scene-transition'); if (c) c.style.display = 'none';
});
await new Promise((r) => setTimeout(r, 2000));
await page.evaluate(async () => {
  const h = document.getElementById('battleHudHost');
  h.classList.add('is-open'); document.body.classList.add('battle-hud-open');
  const html = await (await fetch(new URL('battle-hud.html', document.baseURI).href, { cache: 'no-cache' })).text();
  await new Promise((r) => window.APEX_GOLD.mountBattleHud(html, r));
  await window.APEX_GOLD.onHandoff({ mode: 'BOT', p1: 'crystala', p2: 'frost', p1Hero: 'crystala', p2Hero: 'frost', shell: 'battle' });
  await window.APEX_GOLD.onBattleLive({ mode: 'BOT', p1: 'crystala', p2: 'frost' });
});
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => window.APEX_GRAPHICS_QUALITY?.set('high', 'bench'));
await new Promise((r) => setTimeout(r, 400));

const res = await page.evaluate(async ({ frames }) => {
  const api = window.APEX_GOLD;
  const ctx = window.ctx || window.canvas.getContext('2d');
  // Same shape as the owner playtest probe, so the renderer takes the exact
  // instrumented branch it would take for the owner.
  const acc = {};
  const bump = (k, ms) => { acc[k] = (acc[k] || 0) + ms; };
  const shim = {
    active: true,
    markIceClear: (ms) => bump('iceClear', ms),
    markIceRender: (ms) => bump('iceRender', ms),
    markIceBlit: (ms) => bump('iceBlit', ms),
    markHeroRender: (id, ms) => bump('hero_' + id, ms),
    markFrostTick: (ms) => bump('frostTick', ms),
    markSkillActivation: (kind, ms, d) => bump('skill_' + kind, ms),
    markFrameTotal: () => {},
  };
  window.__apexOwnerPerfProbe = shim;

  function scenario(i) {
    if (i % 17 === 0) { try { api.pressSkill(0, 0); } catch (e) {} }
    if (i % 23 === 11) { try { api.pressSkill(1, 0); } catch (e) {} }
    if (i % 31 === 7) { try { api.pressSkill(0, 1); } catch (e) {} }
    if (i % 40 === 0) { try { api.pressSkill(0, 0); api.pressSkill(0, 1); api.pressSkill(1, 0); } catch (e) {} }
  }
  // warm-up
  for (let i = 0; i < 20; i++) { scenario(i); window.update(1 / 60); window.draw(); }
  try { ctx.getImageData(0, 0, 1, 1); } catch (e) {}
  for (const k of Object.keys(acc)) delete acc[k];

  const blockFrames = [];
  const BLOCK = 8;
  let blockStart = 0, n = 0;
  for (let i = 0; i < frames; i++) {
    scenario(i);
    const t0 = performance.now();
    window.update(1 / 60); window.draw();
    if (n === 0) blockStart = t0;
    n++;
    if (n === BLOCK) {
      try { ctx.getImageData(0, 0, 1, 1); } catch (e) {}
      blockFrames.push((performance.now() - blockStart) / BLOCK);
      n = 0;
    }
    if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
  }
  window.__apexOwnerPerfProbe = undefined;
  const per = {};
  for (const [k, v] of Object.entries(acc)) per[k] = +(v / frames).toFixed(2);
  const s = blockFrames.slice().sort((a, b) => a - b);
  return {
    frames,
    frameMsWithFlush: { p50: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1) },
    perFrame: per,
    iceSurface: window.APEX_FROST_PRESENTATION ? 'present' : 'absent',
  };
}, { frames: FRAMES });

fs.writeFileSync(OUT, JSON.stringify({ root: ROOT, dpr: DPR, ...res, errs: errs.slice(0, 3) }, null, 2));
console.log('\nframe (with flush):', JSON.stringify(res.frameMsWithFlush));
console.log('\nper-frame breakdown (ms):');
for (const [k, v] of Object.entries(res.perFrame).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + k.padEnd(24) + String(v).padStart(8));
}
console.log('errs', JSON.stringify(errs.slice(0, 2)));
await page.close(); await browser.close(); await srv.server.close();
process.exit(0);
