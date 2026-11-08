// castMatrix.mjs — the measurement the owner asked for, on the REAL archive.
//
// What it does, per arm:
//   * serves an unpacked itch ZIP tree under the /html/apex/ nested path;
//   * boots the product, enters a real BOT battle, and plays real casts through
//     the product's own skill API (no synthetic draw calls);
//   * runs the SAME scenario for HIGH and PERFORMANCE, and with recording OFF
//     and ON (a real 1080x1920 MediaRecorder over the live canvas, so the
//     encoder load is real);
//   * alternates the arm order (forward then reversed) so JIT/thermal drift
//     cannot favour one arm;
//   * reports frame p50/p95/p99 and stall counts, never command counts.
//
// The sandbox has no GPU (SwiftShader), so absolute milliseconds are NOT the
// owner's phone. What transfers is the RATIO between arms and the identity of
// the expensive operation, both of which are structural.
//
// Usage:
//   ARMS=base:/tmp/basezip,new:/tmp/newzip bash boot.sh evidence/castMatrix.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { startServer } = await import('../../perf/goldNestedServer.mjs');

const FRAMES = Number(process.env.FRAMES || 240);
const OUT = process.env.OUT || '/tmp/castMatrix.json';
const DPR = Number(process.env.DPR || 3.5);
const ARMS = (process.env.ARMS || '').split(',').filter(Boolean).map((s) => {
  const i = s.indexOf(':');
  return { id: s.slice(0, i), root: s.slice(i + 1) };
});

const instrument = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/instrument.js', 'utf8');
const seed = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/qaProfile.js', 'utf8');

// The scenario: real presses through the product API, at a cadence slow enough
// that each cast resolves before the next one starts, plus a burst phase where
// both heroes fire together (that is the owner's "cast stutter" case).
const SCRIPT = `
window.__APEX_CAST_SCENARIO = function (api) {
  return function (i) {
    // Phase 1 (0-60%): single casts, spaced.
    // Phase 2 (60-100%): simultaneous casts from both heroes.
    const burst = i > 0 && i % 40 === 0;
    if (burst) {
      try { api.pressSkill(0, 0); } catch (e) {}
      try { api.pressSkill(0, 1); } catch (e) {}
      try { api.pressSkill(1, 0); } catch (e) {}
      try { api.pressSkill(1, 1); } catch (e) {}
      return;
    }
    if (i % 17 === 0) { try { api.pressSkill(0, 0); } catch (e) {} }
    if (i % 23 === 11) { try { api.pressSkill(1, 0); } catch (e) {} }
    if (i % 31 === 7) { try { api.pressSkill(0, 1); } catch (e) {} }
    if (i % 37 === 19) { try { api.pressSkill(1, 1); } catch (e) {} }
  };
};
`;

async function runArm(arm, mode, recording) {
  const srv = await startServer({ root: arm.root });
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(), headless: true,
    protocolTimeout: 900000,
    args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream'],
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.setViewport({ width: 432, height: 768, deviceScaleFactor: DPR });
  await page.evaluateOnNewDocument(instrument);
  await page.evaluateOnNewDocument(seed);
  await page.evaluateOnNewDocument(SCRIPT);
  const out = { arm: arm.id, mode, recording, ok: false };
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
    await new Promise((r) => setTimeout(r, 2000));
    // Open the battle and start CRYSTALA vs FROST as a BOT match through the
    // product's own handoff, exactly like the perfMatrix probe.
    await page.evaluate(async () => {
      const h = document.getElementById('battleHudHost');
      h.classList.add('is-open'); document.body.classList.add('battle-hud-open');
      const html = await (await fetch(new URL('battle-hud.html', document.baseURI).href, { cache: 'no-cache' })).text();
      await new Promise((r) => window.APEX_GOLD.mountBattleHud(html, r));
      await window.APEX_GOLD.onHandoff({ mode: 'BOT', p1: 'crystala', p2: 'frost', p1Hero: 'crystala', p2Hero: 'frost', shell: 'battle' });
      await window.APEX_GOLD.onBattleLive({ mode: 'BOT', p1: 'crystala', p2: 'frost' });
    });
    await new Promise((r) => setTimeout(r, 1500));
    // Set the mode through the AUTHORITY, which is what the renderer reads.
    await page.evaluate((m) => {
      window.APEX_GRAPHICS_QUALITY?.set(m, 'bench');
      if (window.APEX_GRAPHICS_MODE_RUNTIME?.apply) window.APEX_GRAPHICS_MODE_RUNTIME.apply();
    }, mode);
    await new Promise((r) => setTimeout(r, 300));

    if (recording) {
      await page.evaluate(async () => {
        const cv = document.getElementById('game-canvas');
        if (!cv || !window.MediaRecorder) throw new Error('no recorder');
        // Real 1080x1920 capture surface, same as the product's studio path.
        const rs = document.createElement('canvas');
        rs.width = 1080; rs.height = 1920;
        const rc = rs.getContext('2d');
        const stream = rs.captureStream(30);
        const types = ['video/webm;codecs=vp8', 'video/webm'];
        const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
        const rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 22000000 })
          : new MediaRecorder(stream);
        rec.start(250);
        let stop = false;
        window.__apexOwnerRecorder = { track: 'matrix', captureMethod: 'region-1080x1920' };
        // Draw the live canvas into the recording surface every frame, which is
        // what the product's studio recorder does; the encoder then has to keep
        // up with 1080x1920 at 30 fps.
        (function pump() {
          const t0 = performance.now();
          rc.setTransform(1, 0, 0, 1, 0, 0);
          rc.fillStyle = '#000'; rc.fillRect(0, 0, 1080, 1920);
          const s = Math.min(1080 / cv.width, 1920 / cv.height);
          const w = cv.width * s, h = cv.height * s;
          rc.drawImage(cv, (1080 - w) / 2, (1920 - h) / 2, w, h);
          window.__apexOwnerRecorder.lastDrawMs = performance.now() - t0;
          if (!stop) requestAnimationFrame(pump);
        })();
        window.__apexOwnerRecorder.stop = () => { stop = true; try { rec.stop(); } catch (e) {} };
      });
    }

    const res = await page.evaluate(async ({ frames }) => {
      const api = window.APEX_GOLD;
      const scenario = window.__APEX_CAST_SCENARIO(api);
      const inst = window.__APEX_INSTR;
      inst.install(); inst.active = true; inst.ops.clear(); inst.heroDraw = {};
      const now = () => performance.now();
      const updateMs = [], drawMs = [], frameMs = [], gpuMs = [];
      // Canvas2D returns before the pixels exist. Timing draw() alone therefore
      // reports command submission and UNDERSTATES every filter/blur/composite
      // in this renderer by orders of magnitude. Each block below is followed by
      // a 1x1 readback, which forces the queued raster work to complete; the
      // flush wall time / block size is the GPU work a frame actually costs.
      const ctx = window.ctx || (window.canvas && window.canvas.getContext('2d'));
      const BLOCK = 10;
      let blockStart = 0, blockFrames = 0;
      for (let i = 0; i < frames; i++) {
        scenario(i);
        const t0 = now(); window.update(1 / 60);
        const t1 = now(); window.draw();
        const t2 = now();
        updateMs.push(t1 - t0); drawMs.push(t2 - t1); frameMs.push(t2 - t0);
        blockFrames++;
        if (blockFrames === 1) blockStart = t2;
        if (blockFrames === BLOCK) {
          const before = now();
          try { ctx.getImageData(0, 0, 1, 1); } catch (e) {}
          const after = now();
          gpuMs.push((after - blockStart) / blockFrames);
          blockFrames = 0;
        }
        if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
      }
      inst.active = false;
      const q = (arr, p) => {
        const s = arr.slice().sort((a, b) => a - b);
        return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2);
      };
      const stats = (arr) => ({
        p50: q(arr, 0.5), p95: q(arr, 0.95), p99: q(arr, 0.99),
        max: +Math.max(...arr).toFixed(2),
        over50: arr.filter((v) => v > 50).length,
        over100: arr.filter((v) => v > 100).length,
        total: +arr.reduce((a, b) => a + b, 0).toFixed(0),
      });
      const ops = {}; for (const [k, v] of inst.ops) ops[k] = +(v / frames).toFixed(2);
      const probe = window.__apexOwnerPerfProbe;
      return {
        frames,
        mode: window.APEX_GRAPHICS_QUALITY?.mode || null,
        flags: {
          bloom: window.APEX_GRAPHICS_BLOOM_WIDE,
          fluid: window.APEX_GRAPHICS_FLUID_SOFT_ALPHA,
          shadow: window.APEX_ICE_SHADOW_NODE_BUDGET === Infinity ? 'Inf' : window.APEX_ICE_SHADOW_NODE_BUDGET,
          flow: window.APEX_ICE_FLOW_MOTION_BUDGET === Infinity ? 'Inf' : window.APEX_ICE_FLOW_MOTION_BUDGET,
        },
        frame: stats(frameMs), draw: stats(drawMs), update: stats(updateMs),
        // Per frame INCLUDING the forced raster flush: this is the number that
        // says what the frame really costs on this machine.
        frameFlushed: stats(gpuMs),
        opsPerFrame: ops,
        canvas: window.canvas ? { w: window.canvas.width, h: window.canvas.height } : null,
        recorderDrawMs: window.__apexOwnerRecorder?.lastDrawMs ?? null,
        skillMarks: probe?.skills?.count ?? null,
        // DIAGNOSTIC: did the presentation runtimes the owner's crash lives in
        // actually load in this arm, and is a Crystal rig alive? If these are
        // false the numbers describe a generic battle, not a CRYSTALA cast.
        runtime: {
          gold: !!window.APEX_CRYSTALA_GOLD,
          crystalaPresentation: !!window.APEX_CRYSTALA_PRESENTATION,
          frostPresentation: !!window.APEX_FROST_PRESENTATION,
          modeRuntime: !!window.APEX_GRAPHICS_MODE_RUNTIME,
          fighters: (window.fighters || []).map(f => ({ name: f.name, heroId: f.heroId || null, id: f.id || null })),
          matchCombatants: (window.APEX_HERO_REWORK?.match?.combatants || []).map(c => c.heroId),
          bloomStats: window.APEX_CRYSTALA_PRESENTATION?.bloomSurfaceStats
            ? JSON.parse(JSON.stringify(window.APEX_CRYSTALA_PRESENTATION.bloomSurfaceStats)) : null,
        },
      };
    }, { frames: FRAMES });

    if (recording) await page.evaluate(() => window.__apexOwnerRecorder?.stop?.());
    out.ok = true;
    Object.assign(out, res);
  } catch (e) {
    out.error = String(e.message).slice(0, 200);
  } finally {
    out.errs = errs.slice(0, 3);
    await browser.close().catch(() => {});
    await srv.server.close();
  }
  return out;
}

// Also capture the probe report shape from one arm so the deliverable can show
// the exact JSON the owner will download.
const ARMS_ORDER = [];
for (const a of ARMS) ARMS_ORDER.push(a);
const report = { dpr: DPR, frames: FRAMES, gpu: null, runs: [], scenarios: {} };
const SCEN = [['high', false], ['performance', false], ['high', true], ['performance', true]];

for (const arm of ARMS_ORDER) {
  const rows = {};
  // forward then reversed, so drift cancels
  for (const order of [SCEN, [...SCEN].reverse()]) {
    for (const [mode, rec] of order) {
      const r = await runArm(arm, mode, rec);
      const key = mode + (rec ? '+rec' : '');
      (rows[key] || (rows[key] = [])).push(r);
      if (!r.ok) { console.log(`${arm.id} ${key} ERROR ${r.error}`); continue; }
      const f = r.frameFlushed;
      console.log(`${arm.id.padEnd(6)} ${key.padEnd(14)} flushed/frame p50=${String(f.p50).padStart(7)} `
        + `p95=${String(f.p95).padStart(8)} p99=${String(f.p99).padStart(8)} max=${String(f.max).padStart(8)} `
        + `| js draw p95=${String(r.draw.p95).padStart(6)} | flags=${JSON.stringify(r.flags)}`);
    }
  }
  report.scenarios[arm.id] = rows;
}
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('WROTE', OUT);
process.exit(0);
