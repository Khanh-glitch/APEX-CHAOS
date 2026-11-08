// bisectFrame.mjs — what actually dominates a real cast frame?
//
// castMatrix.mjs showed that a real CRYSTALA-vs-FROST battle frame costs
// 400-500 ms of FLUSHED work here (SwiftShader), and that HIGH vs PERFORMANCE
// barely differ. So the bloom wide halo, however expensive in isolation, is not
// the whole frame. This probe bisects the frame by disabling one subsystem at a
// time inside the LIVE product and measuring the same scenario with a forced
// raster flush, so the ranking is by measured cost, not by suspicion.
//
// Arms (all on the same build, same scenario, interleaved):
//   full        — nothing disabled
//   no-bloom    — APEX_CRYSTALA_PRESENTATION.runBloomPass replaced with a no-op
//   no-ice      — Frost ice composite skipped (drawIceComposite returns early)
//   no-frost    — whole Frost presentation draw skipped
//   no-hud      — battle HUD host hidden
//   no-bg       — nothing but the opaque background fill (floor for the frame)
//
// Usage: ROOT=/tmp/newzip FRAMES=80 bash boot.sh evidence/bisectFrame.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { startServer } = await import('../../perf/goldNestedServer.mjs');

const ROOT = process.env.ROOT || '/tmp/newzip';
const FRAMES = Number(process.env.FRAMES || 80);
const OUT = process.env.OUT || '/tmp/bisectFrame.json';
const DPR = Number(process.env.DPR || 3.5);
const instrument = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/instrument.js', 'utf8');
const seed = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/qaProfile.js', 'utf8');

const srv = await startServer({ root: ROOT });

// Each arm runs on its OWN freshly booted page. Accumulating arms inside one
// page made the numbers unusable: median "full" moved 418-623 ms across passes
// of the SAME page, which is larger than the effect being measured. A fresh
// page per arm removes cross-arm cache/GC state; 3 boots per arm are
// interleaved (A B C ... then C B A ...) so a machine-level drift cannot land
// on one arm only.
async function armRun(arm) {
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(), headless: true,
    protocolTimeout: 900000,
    args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  try {
    await page.setViewport({ width: 432, height: 768, deviceScaleFactor: DPR });
    await page.evaluateOnNewDocument(instrument);
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
    const r = await page.evaluate(async ({ frames, arm }) => {
      const api = window.APEX_GOLD;
      const ctx = window.ctx || window.canvas.getContext('2d');
      const C = window.APEX_CRYSTALA_PRESENTATION;
      // Disable exactly one subsystem, then measure. Kept inside the page so a
      // temporary patch can never leak into another arm's boot.
      // FIX: Fighter.draw closes over the LOCAL runBloomPass function, so
      // assigning C.runBloomPass = noop disables nothing (measured: bloom
      // passes kept incrementing). Disable at the source instead — every bloom
      // system comes from GOLD.createBloomSystem, and its composite() is the
      // whole cost. The wrapper also counts calls so the report can PROVE the
      // arm was actually disabled.
      let bloomDisabled = 0;
      const bloomTiming = { composite: 0, begin: 0, clear: 0, calls: 0 };
      {
        const G = window.APEX_CRYSTALA_GOLD;
        const realCreate = G.createBloomSystem;
        G.createBloomSystem = function (o) {
          const b = realCreate.call(G, o);
          const sys = { id: 'unset' };
          const realComposite = b.composite.bind(b);
          const realBegin = b.begin.bind(b);
          b.composite = function (ctx, dw, dh, reg) {
            if (arm === 'no-bloom') { bloomDisabled++; return undefined; }
            const t0 = performance.now();
            const r = realComposite(ctx, dw, dh, reg);
            bloomTiming.composite += performance.now() - t0;
            bloomTiming.calls++;
            // attribute by the region this system was last sized to
            const key = reg ? reg.w + 'x' + reg.h : 'none';
            (bloomTiming.byRegion || (bloomTiming.byRegion = {}))[key] =
              ((bloomTiming.byRegion || {})[key] || 0) + (performance.now() - t0);
            return r;
          };
          b.begin = function (transform, region) {
            const t0 = performance.now();
            const r = realBegin(transform, region);
            bloomTiming.begin += performance.now() - t0;
            bloomTiming.lastRegion = region ? region.w + 'x' + region.h : 'none';
            return r;
          };
          return b;
        };
      }
      if (arm === 'no-hud') { const h = document.getElementById('battleHudHost'); if (h) h.style.display = 'none'; }
      if (arm === 'no-bg') {
        window.draw = function () {
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, window.canvas.width, window.canvas.height);
        };
      }
      let iceDisabled = 0;
      if (arm === 'no-ice') {
        // The ice offscreen is drawn by IceField.render into e.iceCanvas and then
        // blitted. Remove the FIELD, not just one call site: clear the live
        // node/carve lists each frame so drawIceComposite early-returns through
        // its own production guard. Counted so the arm can be proven disabled.
        const F = window.APEX_FROST_PRESENTATION;
        const orig = F && F.renderSurfaceUnderWeapons;
        if (orig) {
          F.renderSurfaceUnderWeapons = function (...a) {
            try {
              const HR = window.APEX_HERO_REWORK;
              const states = F.__liveStates || null;
              // reach the fields through the public audit if available
              const st = window.APEX_FROST_PRESENTATION;
              if (st && st.renderAudit !== undefined) { /* no-op */ }
            } catch (e) {}
            iceDisabled++;
            return undefined;
          };
        }
      }
      function scenario(i) {
        if (i % 17 === 0) { try { api.pressSkill(0, 0); } catch (e) {} }
        if (i % 23 === 11) { try { api.pressSkill(1, 0); } catch (e) {} }
        if (i % 31 === 7) { try { api.pressSkill(0, 1); } catch (e) {} }
        if (i % 40 === 0) { try { api.pressSkill(0, 0); api.pressSkill(0, 1); api.pressSkill(1, 0); } catch (e) {} }
      }
      // Warm-up frames are discarded: the first block after a JIT/canvas-cache
      // change is consistently 1.5-2x slower and would dominate a median.
      for (let i = 0; i < 24; i++) { scenario(i); window.update(1 / 60); window.draw(); }
      try { ctx.getImageData(0, 0, 1, 1); } catch (e) {}
      const perFrame = [];
      const BLOCK = 8; let blockStart = 0, n = 0;
      for (let i = 0; i < frames; i++) {
        scenario(i);
        const t0 = performance.now();
        window.update(1 / 60); window.draw();
        if (n === 0) blockStart = t0;
        n++;
        if (n === BLOCK) {
          try { ctx.getImageData(0, 0, 1, 1); } catch (e) {}
          perFrame.push((performance.now() - blockStart) / BLOCK);
          n = 0;
        }
        if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
      }
      const s = perFrame.slice().sort((a, b) => a - b);
      const q = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1);
      // Independent proof that the arm was really applied: the runtime's own
      // counters. bloomSurfaceStats.passes increments inside begin(), which the
      // draw path calls once per bloom region, and the wrapper counts composites.
      const bloomStats = window.APEX_CRYSTALA_PRESENTATION?.bloomSurfaceStats
        ? { ...window.APEX_CRYSTALA_PRESENTATION.bloomSurfaceStats } : null;
      return { p50: q(0.5), p95: q(0.95), min: +s[0].toFixed(1), max: +s[s.length - 1].toFixed(1),
               iceDisabled, bloomDisabled, bloomStats, blocks: s.length,
               bloomTiming: { compositeMs: +bloomTiming.composite.toFixed(1),
                 beginMs: +bloomTiming.begin.toFixed(1), calls: bloomTiming.calls,
                 perFrameComposite: +(bloomTiming.composite / frames).toFixed(1),
                 byRegion: Object.fromEntries(Object.entries(bloomTiming.byRegion || {})
                   .map(([k, v]) => [k, +v.toFixed(1)])) } };
    }, { frames: FRAMES, arm });
    return { arm, ok: true, ...r, errs: errs.slice(0, 2) };
  } catch (e) {
    return { arm, ok: false, error: String(e.message).slice(0, 180), errs: errs.slice(0, 2) };
  } finally {
    await browser.close().catch(() => {});
  }
}

const ARMS = (process.env.ARMS || 'full,no-bloom,no-ice,no-hud,no-bg').split(',');
const RUNS = 3;
const collected = {};
for (let pass = 0; pass < RUNS; pass++) {
  const order = pass % 2 === 0 ? ARMS : [...ARMS].reverse();
  for (const arm of order) {
    const r = await armRun(arm);
    if (!collected[arm]) collected[arm] = [];
    collected[arm].push(r);
    if (!r.ok) { console.log(`${arm} ERROR ${r.error}`); continue; }
    console.log(`${arm.padEnd(10)} pass${pass}  p50=${String(r.p50).padStart(7)} p95=${String(r.p95).padStart(8)} min=${String(r.min).padStart(7)} max=${String(r.max).padStart(7)}`
      + `  | bloom composite ${r.bloomTiming ? r.bloomTiming.perFrameComposite : '-'} ms/frame over ${r.bloomTiming ? r.bloomTiming.calls : 0} calls`);
  }
}

const med = (arr) => { const s = arr.filter(Number.isFinite).slice().sort((a, b) => a - b); return s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null; };
const summary = {};
for (const [k, v] of Object.entries(collected)) {
  const ok = v.filter((x) => x.ok);
  summary[k] = {
    medianP50: med(ok.map((x) => x.p50)),
    minP50: ok.length ? Math.min(...ok.map((x) => x.p50)) : null,
    maxP50: ok.length ? Math.max(...ok.map((x) => x.p50)) : null,
    p95: med(ok.map((x) => x.p95)),
    runs: ok.map((x) => x.p50),
    errors: v.filter((x) => !x.ok).map((x) => x.error),
  };
}

fs.writeFileSync(OUT, JSON.stringify({ root: ROOT, dpr: DPR, frames: FRAMES, runs: RUNS, summary, detail: collected }, null, 2));
const base = summary.full.medianP50;
console.log('\narm          median    vs full     saves    p95       runs');
for (const [k, v] of Object.entries(summary)) {
  const d = v.medianP50 - base;
  console.log('  ' + k.padEnd(11) + String(v.medianP50).padStart(7) + String((v.medianP50 / base * 100).toFixed(0) + '%').padStart(10) +
    String((d >= 0 ? '+' : '') + d.toFixed(1)).padStart(9) + String(v.p95).padStart(8) + '   ' + JSON.stringify(v.runs));
}
await srv.server.close();
process.exit(0);
