// Chrome Performance/Canvas/GPU/compositor trace for BOT WAVE stress diagnosis.
// Headless SwiftShader traces are diagnostic only and are not phone-GPU evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs22.x';
const { default: chromium } = await import('@sparticuz/chromium');
const base = (process.env.APEX_APP_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = process.env.APEX_EVIDENCE_DIR || 'reports/bot-wave-traces';
fs.mkdirSync(output, { recursive: true });
const mode = process.env.APEX_PERF_MODE || 'off';
assert.ok(['off', 'on'].includes(mode));
const profile = process.env.APEX_PERF_PROFILE || 'desktop-1440x900';
const viewport = profile.startsWith('mobile')
  ? { width: 844, height: 390, dpr: 2 }
  : { width: 1440, height: 900, dpr: 1 };
const durationMs = Number(process.env.APEX_TRACE_DURATION_MS || 15000);
const wrapperRoute = process.env.APEX_TRACE_WRAPPER === '1';
const bots = Number(process.env.APEX_TRACE_BOTS || 14);
const tracePath = path.join(output, `${profile}-${mode}-${Date.now()}.trace.json`);
const summaryPath = tracePath.replace(/\.trace\.json$/, '.summary.json');
function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))].toFixed(2) : null;
}
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || await chromium.executablePath(),
  headless: true,
  args: [...chromium.args.filter(arg => arg !== '--single-process'), '--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [], failedRequests = [], consoleErrors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('framenavigated', f => console.log('TRACE frame navigated', f.url()));
await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dpr, isMobile: viewport.dpr > 1, hasTouch: viewport.dpr > 1 });
const pageCdp = await page.createCDPSession();
await pageCdp.send('Performance.enable');
const browserCdp = await browser.target().createCDPSession();
async function chromeMetrics() {
  const [pageMetrics, proc, gpu] = await Promise.all([
    pageCdp.send('Performance.getMetrics').then(x => Object.fromEntries(x.metrics.map(m => [m.name, m.value]))),
    browserCdp.send('SystemInfo.getProcessInfo').catch(e => ({ error: String(e) })),
    browserCdp.send('SystemInfo.getInfo').then(x => x.gpu).catch(e => ({ error: String(e) })),
  ]);
  return { pageMetrics, processes: proc.processInfo || proc, gpu };
}
try {
  const url = wrapperRoute ? `${base}/bot-wave/index.html` : `${base}/bot-wave/game.html?refractionCopy=${mode}&wavePerf=on`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  let gameFrame = page.mainFrame();
  if (wrapperRoute) {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      gameFrame = page.frames().find(f => f.url().includes('/bot-wave/game.html'));
      if (gameFrame && await gameFrame.evaluate(() => !!window.BOXE_WAVE_PILOT && window.APEX_BOT_WAVE_INTERFACE_V2?.installed).catch(() => false)) break;
      await new Promise(r => setTimeout(r, 80));
    }
    assert.ok(gameFrame && await gameFrame.evaluate(() => !!window.BOXE_WAVE_PILOT), 'BOT WAVE iframe ready');
    const instrumentedUrl = `${base}/bot-wave/game.html?refractionCopy=${mode}&wavePerf=on`;
    await page.evaluate(nextUrl => { document.getElementById('wave').src = nextUrl; }, instrumentedUrl);
    const instrumentDeadline = Date.now() + 60000;
    while (Date.now() < instrumentDeadline) {
      gameFrame = page.frames().find(f => f.url().includes('/bot-wave/game.html') && f.url().includes('wavePerf=on'));
      if (gameFrame && await gameFrame.evaluate(() => !!window.BOXE_WAVE_PILOT && window.APEX_BOT_WAVE_INTERFACE_V2?.installed).catch(() => false)) break;
      await new Promise(r => setTimeout(r, 80));
    }
    assert.ok(gameFrame && gameFrame.url().includes('wavePerf=on'), 'instrumented BOT WAVE iframe ready');
  }
  await gameFrame.waitForSelector('#w-go', { visible: true, timeout: 30000 });
  await gameFrame.click('#w-go');
  const combatStart = Date.now();
  while (Date.now() - combatStart < 30000 && await gameFrame.evaluate(() => window.BOXE_WAVE_PILOT?.state?.phase !== 'combat'))
    await new Promise(r => setTimeout(r, 50));
  assert.equal(await gameFrame.evaluate(() => window.BOXE_WAVE_PILOT?.state?.phase), 'combat', 'campaign reaches combat');
  const evalGame = (...args) => gameFrame.evaluate(...args);
  if (wrapperRoute) await evalGame(() => { window.handLab.canvas.tabIndex = 0; window.handLab.canvas.focus(); window.focus(); });
  const fixture = await evalGame((botCount) => {
    const pilot = window.BOXE_WAVE_PILOT, engine = window.handLab, state = pilot?.state;
    if (!pilot || !engine || !state) throw new Error('BOT WAVE fixture unavailable');
    const entries = pilot.compositions.flatMap(c => c.plan.composition);
    if (!entries.length) throw new Error('No campaign-authored valid bot weapon descriptors');
    state.softCap = Math.max(state.softCap, botCount);
    state.queue = Array.from({ length: botCount }, (_, i) => {
      const e = entries[i % entries.length];
      return { gun: e.weaponId, boss: !!e.boss, edge: ['top', 'right', 'bottom', 'left'][i % 4],
        edgeFraction: .08 + (i % 13) * .069, role: e.role };
    });
    // Exercise existing Gold combat and native Arsenal skills without modifying
    // shipped gameplay or fabricating unregistered weapon actors. Prefill by
    // stepping the real combat update, rather than spawning synthetic entities.
    for (const id of ['jab', 'rocket', 'uppercut', 'counter', 'phantom', 'ult']) state.owned.add(id);
    engine.waveCounterUnlocked = true;
    engine.paused = false;
    window.APEX_WAVE_PERF.enableCanvasPassProfiler();
    for (let i = 0; i < botCount && state.queue.length; i++) { state.spawnT = 0; engine.update(.016); }
    const raf = { intervals: [], prior: null, ticks: 0 };
    window.__traceRaf = raf;
    const originalRender = engine.render;
    engine.render = function (...args) {
      const ts = performance.now();
      if (raf.prior != null) raf.intervals.push(ts - raf.prior);
      raf.prior = ts; raf.ticks++;
      return originalRender.apply(this, args);
    };
    return { campaignBotDescriptors: entries.length, queuedBots: state.queue.length,
      activeBots: engine.enemies.filter(e => !e.dead).length, softCap: state.softCap, wave: state.wave,
      validWeapons: [...new Set(entries.map(e => e.weaponId))].length, skillsEnabled: [...state.owned] };
  }, bots);
  console.log('TRACE fixture', JSON.stringify(fixture));
  await evalGame(() => {
    window.__traceInputs = [];
    document.addEventListener('keydown', event => {
      if (!/^(Key[JKLUI]|KeyD)$/.test(event.code)) return;
      const record = { code: event.code, eventTime: performance.now(), rafTime: null };
      window.__traceInputs.push(record);
      requestAnimationFrame(ts => { record.rafTime = ts; record.inputToRafMs = ts - record.eventTime; });
    }, true);
  });
  await evalGame(() => window.APEX_WAVE_PERF.resetSamples());
  const playerBefore = await evalGame(() => ({ x: window.handLab.player.x, y: window.handLab.player.y, gameTime: window.handLab.time }));
  const beforeChrome = await chromeMetrics();
  await pageCdp.send('Profiler.enable');
  await pageCdp.send('Profiler.start');
  await page.tracing.start({ path: tracePath, screenshots: false, categories: [
    'devtools.timeline', 'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-devtools.timeline.stack',
    'toplevel', 'blink', 'blink.user_timing', 'v8', 'disabled-by-default-v8.gc',
    'cc', 'gpu', 'viz', 'renderer.scheduler', 'disabled-by-default-renderer.scheduler',
  ] });
  await evalGame((duration) => {
    const e = window.handLab;
    let n = 0;
    window.__traceStressTimer = setInterval(() => {
      const k = n++ % 5;
      // Simultaneous Gold skills/VFX plus repeated native pressure/heat.
      e.wave(e.player.x + Math.cos(k * Math.PI * 2 / 5) * 85,
        e.player.y + Math.sin(k * Math.PI * 2 / 5) * 70, 175, .12, .82);
      e.fluid.addHeat(e.player.x + (k - 2) * 36, e.player.y - 24, 32, .55, .2);
      e.radialAmt = .55; e.chroma = .45;
      void k;
    }, 450);
    window.__traceRun = { start: performance.now(), duration, phases: [] };
  }, durationMs);
  const hostStart = Date.now();
  await page.keyboard.down('KeyD');
  const inputDriver = (async () => {
    const keys = ['KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI'];
    let i = 0;
    while (Date.now() - hostStart < durationMs) {
      await page.keyboard.press(keys[i++ % keys.length]);
      await new Promise(r => setTimeout(r, 450));
    }
  })();
  await new Promise(r => setTimeout(r, durationMs));
  await inputDriver;
  await page.keyboard.up('KeyD').catch(() => {});
  await evalGame(() => clearInterval(window.__traceStressTimer));
  await page.tracing.stop();
  const cpuProfile = await pageCdp.send('Profiler.stop').then(x => x.profile).catch(e => ({ error: String(e) }));
  await pageCdp.send('Profiler.disable').catch(() => {});
  const afterChrome = await chromeMetrics();
  const finalPage = await evalGame(() => ({
    gameTime: window.handLab.time,
    player: { x: window.handLab.player.x, y: window.handLab.player.y, vx: window.handLab.player.vx, vy: window.handLab.player.vy },
    rafTicks: window.__traceRaf.ticks,
    rafIntervals: window.__traceRaf.intervals,
    queue: window.BOXE_WAVE_PILOT.state.queue.length,
    actors: window.handLab.enemies.filter(e => !e.dead).length,
    projectiles: window.handLab.projs.length,
    particles: window.handLab.particles.length,
    snapshot: window.APEX_WAVE_PERF.snapshot(),
    post: window.APEX_WAVE_REFRACTION_COPY.snapshot(),
    frame: { visibility: document.visibilityState, hasFocus: document.hasFocus(), paused: window.handLab.paused },
    inputEvents: window.__traceInputs,
  }));
  const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  const events = trace.traceEvents || [];
  const threadNames = new Map(events.filter(e => e.name === 'thread_name').map(e => [`${e.pid}:${e.tid}`, e.args?.name]));
  const slices = events.filter(e => e.ph === 'X' && Number.isFinite(e.dur));
  const topSlices = slices.slice().sort((a, b) => b.dur - a.dur).slice(0, 60).map(e => ({
    name: e.name, category: e.cat, durationMs: +(e.dur / 1000).toFixed(2),
    pid: e.pid, tid: e.tid, thread: threadNames.get(`${e.pid}:${e.tid}`) || null,
  }));
  const cpuNodes = new Map((cpuProfile.nodes || []).map(n => [n.id, n]));
  const cpuFunctions = new Map();
  for (let i = 0; i < (cpuProfile.samples || []).length; i++) {
    const node = cpuNodes.get(cpuProfile.samples[i]);
    if (!node) continue;
    const frame = node.callFrame || {};
    const key = `${frame.url || '<native>'} :: ${frame.functionName || '(anonymous)'}`;
    const entry = cpuFunctions.get(key) || { function: frame.functionName || '(anonymous)', url: frame.url || '',
      line: frame.lineNumber ?? null, samples: 0, sampledMs: 0 };
    entry.samples++; entry.sampledMs += (cpuProfile.timeDeltas?.[i] || 1000) / 1000;
    cpuFunctions.set(key, entry);
  }
  const cpuProfileSummary = {
    sampleCount: (cpuProfile.samples || []).length,
    totalSampledMs: +[...cpuFunctions.values()].reduce((sum, x) => sum + x.sampledMs, 0).toFixed(2),
    topFunctions: [...cpuFunctions.values()].sort((a, b) => b.sampledMs - a.sampledMs).slice(0, 40)
      .map(x => ({ ...x, sampledMs: +x.sampledMs.toFixed(2) })),
    error: cpuProfile.error || null,
  };
  const taskSlices = slices.filter(e => /RunTask|ThreadControllerImpl::RunTask|TaskQueueManager::ProcessTaskFromWorkQueue|FunctionCall|FireAnimationFrame/i.test(e.name));
  const mainThreadLongTasks = taskSlices.filter(e => threadNames.get(`${e.pid}:${e.tid}`) === 'CrRendererMain' && e.dur >= 50000)
    .sort((a, b) => b.dur - a.dur).slice(0, 40).map(e => ({
      name: e.name, category: e.cat, durationMs: +(e.dur / 1000).toFixed(2),
      thread: threadNames.get(`${e.pid}:${e.tid}`) || null,
    }));
  const gpuLongTasks = taskSlices.filter(e => /GpuThread|GPU/i.test(threadNames.get(`${e.pid}:${e.tid}`) || '') && e.dur >= 50000)
    .sort((a, b) => b.dur - a.dur).slice(0, 40).map(e => ({
      name: e.name, category: e.cat, durationMs: +(e.dur / 1000).toFixed(2),
      thread: threadNames.get(`${e.pid}:${e.tid}`) || null,
    }));
  const gcEvents = events.filter(e => e.ph === 'X' && /^(MinorGC|MajorGC)$/.test(e.name)).map(e => ({
    name: e.name, category: e.cat, durationMs: Number.isFinite(e.dur) ? +(e.dur / 1000).toFixed(2) : null,
    thread: threadNames.get(`${e.pid}:${e.tid}`) || null,
  }));
  const primaryCanvasEvents = canvasEvents => {
    const names = [...new Set(canvasEvents.map(e => e.name))];
    return Object.fromEntries(names.map(name => {
      const group = canvasEvents.filter(e => e.name === name && e.ph === 'X' && Number.isFinite(e.dur));
      return [name, { count: canvasEvents.filter(e => e.name === name).length,
        totalMs: +(group.reduce((sum, e) => sum + e.dur, 0) / 1000).toFixed(2),
        maxMs: +(Math.max(0, ...group.map(e => e.dur)) / 1000).toFixed(2) }];
    }));
  };
  const threadTopSlices = Object.fromEntries(['CrRendererMain', 'Chrome_InProcGpuThread', 'Compositor', 'VizCompositorThread'].map(thread => [thread,
    slices.filter(e => threadNames.get(`${e.pid}:${e.tid}`) === thread).sort((a, b) => b.dur - a.dur).slice(0, 15).map(e => ({
      name: e.name, category: e.cat, durationMs: +(e.dur / 1000).toFixed(2),
    }))]));
  const scheduleEvents = events.filter(e => /BeginFrame|BeginMainFrame|DrawFrame|SubmitCompositorFrame|FramePresented|SwapBuffers|RasterTask|PipelineReporter|CompositeLayers/i.test(e.name));
  const canvasEvents = events.filter(e => /Canvas|drawImage|DrawImage|Rasterize/i.test(e.name));
  const summary = {
    url, mode, profile, wrapperRoute, durationMs, fixture, tracePath, traceBytes: fs.statSync(tracePath).size,
    traceEventCount: events.length, finalPage, playerBefore, beforeChrome, afterChrome,
    hostElapsedMs: Date.now() - hostStart,
    inputLatency: (() => { const a = finalPage.inputEvents.map(x => x.inputToRafMs).filter(Number.isFinite); return {
      count: a.length, p50Ms: percentile(a, .50), p95Ms: percentile(a, .95), p99Ms: percentile(a, .99), maxMs: a.length ? +Math.max(...a).toFixed(2) : null,
    }; })(),
    movementPx: +Math.hypot(finalPage.player.x - playerBefore.x, finalPage.player.y - playerBefore.y).toFixed(2),
    topSlices, threadTopSlices, cpuProfile: cpuProfileSummary, mainThreadLongTasks, gpuLongTasks, gcEvents,
    schedulingEventCounts: Object.fromEntries([...new Set(scheduleEvents.map(e => e.name))].map(n => [n, scheduleEvents.filter(e => e.name === n).length])),
    canvasEventStats: primaryCanvasEvents(canvasEvents),
    iframeFrames: page.frames().map(f => ({ url: f.url(), name: f.name() })),
    runtimeErrors: errors, consoleErrors, failedRequests,
    note: 'Trace captured under headless Chromium/SwiftShader; correlate Chrome events with app counters. Not physical GPU performance acceptance.',
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  console.log('BOT WAVE Chrome trace summary', JSON.stringify({
    summaryPath, tracePath, traceBytes: summary.traceBytes, events: events.length,
    fixture, gameTime: finalPage.gameTime, frames: finalPage.rafTicks,
    movementPx: summary.movementPx, maxRafGapMs: Math.max(0, ...finalPage.rafIntervals),
    inputLatency: summary.inputLatency, mainLongTaskMaxMs: Math.max(0, ...mainThreadLongTasks.map(x => x.durationMs)),
    gpuTaskMaxMs: Math.max(0, ...gpuLongTasks.map(x => x.durationMs)), gcCount: gcEvents.length,
    cpuHotspots: cpuProfileSummary.topFunctions.slice(0, 5), errors,
  }));
} catch (error) {
  fs.writeFileSync(path.join(output, `${profile}-${mode}-trace-failure.json`), JSON.stringify({
    message: String(error), stack: error.stack, errors, consoleErrors, failedRequests,
  }, null, 2) + '\n');
  throw error;
} finally {
  browser.process()?.kill('SIGKILL');
}
