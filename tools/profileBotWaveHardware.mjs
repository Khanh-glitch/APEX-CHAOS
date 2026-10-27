// Real-device BOT WAVE profile. Unlike the compatibility workflow, this tool
// refuses SwiftShader/llvmpipe/software adapters and never launches Chromium's
// bundled @sparticuz build. See docs/acceptance/bot-wave-perf-evidence/README.md.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { losslessProject } from './botWaveFluidProjectCandidate.mjs';
import { smokeCacheCandidateHtml } from './botWaveSmokeCacheCandidate.mjs';

const base = (process.env.APEX_APP_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = process.env.APEX_EVIDENCE_DIR || 'reports/bot-wave-hardware';
const runId = process.env.APEX_PROFILE_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const durationMs = Number(process.env.APEX_PROFILE_DURATION_MS || 300_000);
const botCount = Number(process.env.APEX_PROFILE_BOTS || 14);
const sampleMs = Number(process.env.APEX_PROFILE_SAMPLE_MS || 5000);
const remote = process.env.APEX_CHROME_REMOTE || '';
const captureCpuProfile = process.env.APEX_CAPTURE_CPU_PROFILE === '1';
const ciHeadless = process.env.APEX_PROFILE_HEADLESS === '1';
const ciAutoplay = process.env.APEX_PROFILE_AUTOPLAY === '1';
// CI-only browser response substitution. Never alters the shipping file or build.
const fluidVariant = process.env.APEX_PROFILE_FLUID_VARIANT || 'baseline';
assert.ok(['baseline', 'lossless', 'smoke-cache'].includes(fluidVariant), 'Unknown fluid solver A/B variant');
fs.mkdirSync(output, { recursive: true });
assert.ok(durationMs >= 60_000, 'Real-hardware profile must run at least 60 seconds; use 180000 or longer for acceptance evidence.');
assert.ok(botCount >= 8 && botCount <= 40, 'APEX_PROFILE_BOTS must be between 8 and 40.');
assert.ok(sampleMs >= 1000, 'APEX_PROFILE_SAMPLE_MS must be at least 1000 to avoid adding needless profiler traffic.');

function resolveChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = process.platform === 'win32'
    ? [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].flatMap(command => {
        try { return [execFileSync('which', [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()]; }
        catch { return []; }
      });
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || null;
}

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))].toFixed(2) : null;
}
function isSoftwareGpu(info) {
  const devices = info?.gpu?.devices || [];
  const active = devices.filter(d => d.active === true);
  const candidates = active.length ? active : devices.filter(d => d.vendorId !== 0xffff && d.deviceId !== 0xffff);
  const backend = `${info?.gpu?.auxAttributes?.glRenderer || ''} ${info?.gpu?.auxAttributes?.displayType || ''}`;
  const adapters = candidates.map(d => `${d.vendorString || ''} ${d.deviceString || ''} ${d.driverVendor || ''}`).join(' ');
  return !devices.length || !candidates.length ||
    /swiftshader|llvmpipe|softpipe|software raster|basic render|microsoft basic|warp|lavapipe/i.test(backend) ||
    (!backend.trim() && /swiftshader|llvmpipe|softpipe|software raster|basic render|microsoft basic|warp|lavapipe/i.test(adapters));
}

let browser, ownsBrowser = false, page, browserCdp, pageCdp, gameFrame, browserMetricsTimer;
const errors = [], failedRequests = [], consoleErrors = [];
const tracePath = path.join(output, `bot-wave-${runId}.trace.json`);
const startShot = path.join(output, `bot-wave-${runId}-start.png`);
const endShot = path.join(output, `bot-wave-${runId}-end.png`);
const summaryPath = path.join(output, `bot-wave-${runId}.summary.json`);
let traceStarted = false;

try {
  if (remote) {
    // Chrome desktop: --remote-debugging-port=9222. Android: adb forward the
    // Chrome DevTools socket to this host and set APEX_CHROME_REMOTE accordingly.
    browser = await puppeteer.connect({ browserURL: remote, defaultViewport: null });
  } else {
    const executablePath = resolveChrome();
    assert.ok(executablePath,
      'No system Chrome found. Set CHROME_PATH to installed Chrome; bundled/SwiftShader Chromium is deliberately not a fallback.');
    browser = await puppeteer.launch({ executablePath, headless: ciHeadless, defaultViewport: null,
      args: ciHeadless
        ? ['--enable-gpu', '--use-angle=metal', '--disable-software-rasterizer', '--no-first-run', '--no-default-browser-check']
        : ['--start-maximized', '--no-first-run', '--no-default-browser-check'] });
    ownsBrowser = true;
  }
  page = await browser.newPage();
  if(ciHeadless && process.env.APEX_PROFILE_VIEWPORT === 'mobile')
    await page.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.bringToFront();
  browserCdp = await browser.target().createCDPSession();
  pageCdp = await page.createCDPSession();
  const gpuInfo = await browserCdp.send('SystemInfo.getInfo');
  assert.ok(!isSoftwareGpu(gpuInfo),
    `Refusing to profile software rendering: ${JSON.stringify({ devices: gpuInfo?.gpu?.devices, auxAttributes: gpuInfo?.gpu?.auxAttributes })}`);
  const featureStatus = gpuInfo?.gpu?.featureStatus || {};
  assert.ok(/^enabled/.test(featureStatus['gpu_compositing'] || ''),
    `GPU compositing is not hardware-enabled: ${JSON.stringify(featureStatus)}`);
  assert.ok(/^enabled/.test(featureStatus['2d_canvas'] || ''),
    `Canvas2D feature status is not enabled: ${JSON.stringify(featureStatus)}`);
  assert.ok(/^enabled/.test(featureStatus.rasterization || ''),
    `GPU rasterization is not enabled: ${JSON.stringify(featureStatus)}`);
  const processInfo = await browserCdp.send('SystemInfo.getProcessInfo').catch(e => ({ error: String(e) }));
  const chromeVersion = await browserCdp.send('Browser.getVersion').catch(e => ({ error: String(e) }));

  console.log('BOT WAVE HARDWARE PROFILE GPU VERIFIED', JSON.stringify({
    chromeVersion,
    devices: gpuInfo.gpu.devices, auxAttributes: gpuInfo.gpu.auxAttributes,
    featureStatus: gpuInfo.gpu.featureStatus, processInfo: processInfo.processInfo || processInfo,
    remote: !!remote, userAgent: await page.evaluate(() => navigator.userAgent).catch(() => null),
  }));

  if (fluidVariant !== 'baseline') {
    // Substitute exactly ONE self-contained method in Chrome's requested HTML.
    // Keep every other shipping byte unchanged for a controlled browser A/B.
    const gold = fs.readFileSync('public/bot-wave/game.html', 'utf8');
    let candidateHtml;
    if (fluidVariant === 'smoke-cache') {
      candidateHtml = smokeCacheCandidateHtml(gold);
    } else {
    const method = gold.match(/\n    project\(i0b, i1b, j0b, j1b\) \{[\s\S]*?\n    \}\n    step\(dt\) \{/);
    assert.ok(method && gold.match(/\n    project\(i0b, i1b, j0b, j1b\) \{/g)?.length === 1,
      'Cannot uniquely identify shipping Gold Fluid.project; do not run candidate');
    const replacement = '\n    ' + losslessProject.toString()
      .replace(/^function losslessProject/, 'project')
      .split('\n').join('\n    ');
    candidateHtml = gold.replace(method[0], replacement + '\n    step(dt) {');
    }
    assert.notEqual(candidateHtml, gold, 'Fluid A/B substitution did nothing');
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === new URL(base).origin && url.pathname === '/bot-wave/game.html') {
        request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: candidateHtml })
          .catch(e => console.error('BROWSER FLUID A/B RESPOND FAILED', String(e)));
      } else request.continue().catch(e => console.error('BROWSER FLUID A/B CONTINUE FAILED', String(e)));
    });
  }
  await page.goto(`${base}/bot-wave/index.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const readyDeadline = Date.now() + 60_000;
  while (Date.now() < readyDeadline) {
    gameFrame = page.frames().find(f => f.url().includes('/bot-wave/game.html'));
    if (gameFrame && await gameFrame.evaluate(() => !!window.BOXE_WAVE_PILOT &&
      window.APEX_BOT_WAVE_INTERFACE_V2?.installed === true).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(gameFrame, 'Gold wrapper game iframe did not become ready.');
  await gameFrame.waitForSelector('#w-go', { visible: true, timeout: 30_000 });
  await gameFrame.click('#w-go');
  const combatDeadline = Date.now() + 30_000;
  while (Date.now() < combatDeadline &&
    await gameFrame.evaluate(() => window.BOXE_WAVE_PILOT?.state?.phase !== 'combat'))
    await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await gameFrame.evaluate(() => window.BOXE_WAVE_PILOT?.state?.phase), 'combat',
    'Gold onboarding did not enter combat.');

  await pageCdp.send('Performance.enable');
  const browserPerformanceSamples = [];
  const sampleBrowserPerformance = async () => {
    const metrics = await pageCdp.send('Performance.getMetrics').catch(() => null);
    if (metrics) browserPerformanceSamples.push({ at: Date.now(), ...Object.fromEntries(metrics.metrics.map(m => [m.name, m.value])) });
  };
  await sampleBrowserPerformance();
  browserMetricsTimer = setInterval(sampleBrowserPerformance, sampleMs);

  const fixture = await gameFrame.evaluate(({ count, intervalMs }) => {
    const pilot = window.BOXE_WAVE_PILOT, engine = window.handLab, state = pilot?.state;
    if (!pilot || !engine || !state) throw new Error('Gold combat runtime unavailable.');
    const entries = pilot.compositions.flatMap(c => c.plan.composition);
    if (!entries.length) throw new Error('No campaign-authored bot descriptors available.');
    state.softCap = Math.max(state.softCap, count);
    const queueEntry = i => {
      const entry = entries[i % entries.length];
      return { gun: entry.weaponId, boss: !!entry.boss, edge: ['top', 'right', 'bottom', 'left'][i % 4],
        edgeFraction: .08 + (i % 13) * .069, role: entry.role };
    };
    state.queue = Array.from({ length: count }, (_, i) => queueEntry(i));
    window.__apexHardwareQueueEntry = queueEntry;
    window.__apexHardwareDesiredBots = count;
    window.__apexHardwareBotSequence = count;
    for (const id of ['jab', 'rocket', 'uppercut', 'counter', 'phantom', 'ult']) state.owned.add(id);
    engine.waveCounterUnlocked = true;
    engine.paused = false;
    // Synthetic stress fixture only: extend player life so the entire
    // capture remains a live, hostile 14-bot combat sample, not game-over UI.
    // This is never saved or applied to shipping game code.
    engine.player.maxHp=Math.max(engine.player.maxHp,1000000);
    engine.player.hp=engine.player.maxHp;
    for (let i = 0; i < count && state.queue.length; i++) { state.spawnT = 0; engine.update(.016); }
    const probe = { frameIntervals: [], inputToRafMs: [], inputEvents: [], longTasks: [], memorySamples: [],
      runtimeSamples: [], listeners: [], priorFrame: null, frames: 0, lastPointerMove: 0, active: true };
    const recordInput = event => {
      if (['pointermove', 'touchmove'].includes(event.type) && performance.now() - probe.lastPointerMove < 50) return;
      if (['pointermove', 'touchmove'].includes(event.type)) probe.lastPointerMove = performance.now();
      const record = { type: event.type, code: event.code || null, pointerType: event.pointerType || null,
        eventPerfMs: performance.now(), trusted: event.isTrusted };
      probe.inputEvents.push(record);
      requestAnimationFrame(ts => {
        record.nextRafPerfMs = ts;
        record.inputToRafMs = Math.max(0, ts - record.eventPerfMs);
        probe.inputToRafMs.push(record.inputToRafMs);
      });
    };
    for (const type of ['keydown', 'pointerdown', 'pointermove', 'touchstart', 'touchmove']) {
      window.addEventListener(type, recordInput, { capture: true, passive: true });
      probe.listeners.push([type, recordInput]);
    }
    const frame = ts => {
      if (!probe.active) return;
      if (probe.priorFrame != null) probe.frameIntervals.push(ts - probe.priorFrame);
      probe.priorFrame = ts; probe.frames++;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    try {
      window.__apexHardwareLongTaskObserver = new PerformanceObserver(list => probe.longTasks.push(...list.getEntries().map(e => ({
        startTime: e.startTime, durationMs: e.duration,
      }))));
      window.__apexHardwareLongTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {}
    const sample = () => {
      probe.runtimeSamples.push({ atMs: performance.now(), gameTime: engine.time,
        bots: engine.enemies.filter(e => !e.dead).length, projectiles: engine.projs.length,
        particles: engine.particles.length, phase: state.phase, paused: engine.paused,
        visibility: document.visibilityState, focused: document.hasFocus() });
      const heap = performance.memory?.usedJSHeapSize;
      if (Number.isFinite(heap)) probe.memorySamples.push({ atMs: performance.now(), usedHeapBytes: heap });
    };
    sample();
    window.__apexHardwareProbe = probe;
    window.__apexHardwareMetricsTimer = setInterval(sample, intervalMs);
    return { botDescriptors: entries.length, queuedAtStart: state.queue.length,
      activeAtStart: engine.enemies.filter(e => !e.dead).length, skills: [...state.owned],
      canvas: { width: engine.canvas.width, height: engine.canvas.height, dpr: engine.dpr } };
  }, { count: botCount, intervalMs: sampleMs });
  // Avoid serializing internal objects or timer handles from the iframe. Keep
  // a stable handle to the page-side probe and schedule VFX with native effects.
  await gameFrame.evaluate(() => {
    const e = window.handLab;
    window.__apexHardwareProfileTimer = setInterval(() => {
      const k = Math.random() * Math.PI * 2;
      e.wave(e.player.x + Math.cos(k) * 85, e.player.y + Math.sin(k) * 70, 175, .12, .82);
      e.fluid.addHeat(e.player.x + Math.cos(k + 1.5) * 54,
        e.player.y + Math.sin(k + 1.5) * 42, 32, .55, .2);
      const state = window.BOXE_WAVE_PILOT.state;
      // Preserve the authentic game upgrade flow under automated stress:
      // a real user would choose one of the three cards and continue.
      // The previous 65s trace entered upgrade and stopped rendering combat.
      if(state.phase==='upgrade')document.querySelector('#w-cards .w-card')?.click();
      const living = e.enemies.filter(enemy => !enemy.dead).length;
      const missing = window.__apexHardwareDesiredBots - living - state.queue.length;
      for (let i = 0; i < missing; i++) state.queue.push(window.__apexHardwareQueueEntry(window.__apexHardwareBotSequence++));
      if (missing > 0) state.spawnT = 0;
    }, 450);
  });
  console.log('BOT WAVE HARDWARE PROFILE READY', JSON.stringify({
    fixture: { botDescriptors: fixture.botDescriptors, queuedAtStart: fixture.queuedAtStart,
      activeAtStart: fixture.activeAtStart, skills: fixture.skills, canvas: fixture.canvas },
    durationMs, botCount,
    instructions: 'Keep Chrome foreground and play normally; move and use skills during the entire capture. Do not resize, change DPR, quality, or gameplay settings.',
  }));
  await page.screenshot({ path: startShot, fullPage: false });

  const traceCategories = [
    'devtools.timeline', 'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.frame', 'toplevel', 'blink', 'blink.user_timing',
    'cc', 'gpu', 'viz', 'renderer.scheduler', 'input', 'latencyInfo',
    ...(captureCpuProfile ? ['v8', 'disabled-by-default-v8.cpu_profiler', 'disabled-by-default-v8.gc'] : []),
  ];
  await gameFrame.evaluate(() => {
    const p = window.__apexHardwareProbe;
    p.frameIntervals.length = 0; p.inputToRafMs.length = 0; p.inputEvents.length = 0;
    p.longTasks.length = 0; p.memorySamples.length = 0; p.runtimeSamples.length = 0;
    p.priorFrame = null; p.frames = 0;
  });
  browserPerformanceSamples.length = 0;
  await sampleBrowserPerformance();
  if (captureCpuProfile) { await pageCdp.send('Profiler.enable'); await pageCdp.send('Profiler.start'); }
  await page.tracing.start({ path: tracePath, screenshots: false, categories: traceCategories });
  traceStarted = true;
  // Optional CI-only real CDP keyboard events. Nothing changes in the game.
  // Puppeteer keyboard events are trusted browser input, unlike dispatched JS events.
  let autoplayTimer=null,autoBusy=false,autoIndex=0;
  if(ciAutoplay){
    const sequence=['w','d','s','a','j','k','w','d','s','a'];
    autoplayTimer=setInterval(async()=>{
      if(autoBusy)return;
      autoBusy=true;
      try{await page.keyboard.press(sequence[autoIndex++%sequence.length],{delay:75});}
      catch(e){console.warn('AUTOPLAY INPUT',String(e));}
      finally{autoBusy=false;}
    },480);
  }
  try{await new Promise(resolve => setTimeout(resolve, durationMs));}
  finally{if(autoplayTimer)clearInterval(autoplayTimer);}
  await page.tracing.stop();
  traceStarted = false;
  const cpuProfile = captureCpuProfile
    ? await pageCdp.send('Profiler.stop').then(x => x.profile).catch(e => ({ error: String(e) })) : null;
  if (captureCpuProfile) await pageCdp.send('Profiler.disable').catch(() => {});
  await page.screenshot({ path: endShot, fullPage: false });

  const final = await gameFrame.evaluate(() => {
    const p = window.__apexHardwareProbe, e = window.handLab, s = window.BOXE_WAVE_PILOT.state;
    const atMs = performance.now();
    p.runtimeSamples.push({ atMs, gameTime: e.time, bots: e.enemies.filter(x => !x.dead).length,
      projectiles: e.projs.length, particles: e.particles.length, phase: s.phase,
      paused: e.paused, visibility: document.visibilityState, focused: document.hasFocus() });
    const finalHeap = performance.memory?.usedJSHeapSize;
    if (Number.isFinite(finalHeap)) p.memorySamples.push({ atMs, usedHeapBytes: finalHeap });
    p.active = false;
    for (const [type, listener] of p.listeners) window.removeEventListener(type, listener, true);
    p.listeners.length = 0;
    window.__apexHardwareLongTaskObserver?.disconnect();
    clearInterval(window.__apexHardwareProfileTimer);
    clearInterval(window.__apexHardwareMetricsTimer);
    delete window.__apexHardwareQueueEntry; delete window.__apexHardwareDesiredBots; delete window.__apexHardwareBotSequence;
    const profiles = Object.fromEntries(['frameIntervals', 'inputToRafMs'].map(key => {
      const a = p[key];
      const sorted = a.slice().sort((x, y) => x - y);
      const pct = q => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] : null;
      return [key, { count: a.length, p50Ms: pct(.5), p95Ms: pct(.95), p99Ms: pct(.99),
        maxMs: sorted.length ? sorted.at(-1) : null,
        averageFps: key === 'frameIntervals' && a.length ? 1000 / (a.reduce((x, y) => x + y, 0) / a.length) : null,
        onePercentLowFps: key === 'frameIntervals' && pct(.99) ? 1000 / pct(.99) : null }];
    }));
    return { probe: p, profiles, runtime: { phase: s.phase, paused: e.paused, gameTime: e.time,
      bots: e.enemies.filter(x => !x.dead).length, projectiles: e.projs.length, particles: e.particles.length,
      canvas: { width: e.canvas.width, height: e.canvas.height, dpr: e.dpr },
      postSurfaces: ['scene', 'a', 'b', 'cp', 'r1', 'r2', 'rb'].map(key => ({
        name: key, width: e.post[key]?.width || 0, height: e.post[key]?.height || 0 })) } };
  });
  clearInterval(browserMetricsTimer);
  const activeSamples=final.probe.runtimeSamples.filter(x=>x.phase==='combat'&&!x.paused).length;
  assert.ok(activeSamples>=final.probe.runtimeSamples.length*.75,
    'Stress fixture did not sustain actual combat for majority of the capture: '+activeSamples+'/'+final.probe.runtimeSamples.length);
  assert.equal(final.runtime.phase,'combat','Stress fixture ended combat early; hardware profile is INVALID');
  assert.ok(final.runtime.gameTime>=durationMs/1000*.6,
    'Insufficient active combat simulation time; hardware profile is INVALID: '+final.runtime.gameTime);
  await sampleBrowserPerformance();
  const cpuProfilePath = captureCpuProfile ? path.join(output, `bot-wave-${runId}.cpu-profile.json`) : null;
  if (captureCpuProfile && cpuProfile) fs.writeFileSync(cpuProfilePath, JSON.stringify(cpuProfile));
  const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  const events = trace.traceEvents || [];
  const threadNames = new Map(events.filter(e => e.name === 'thread_name').map(e => [`${e.pid}:${e.tid}`, e.args?.name]));
  const slices = events.filter(e => e.ph === 'X' && Number.isFinite(e.dur));
  const gpuSlices = slices.filter(e => /gpu|raster|compositor|viz/i.test(
    `${threadNames.get(`${e.pid}:${e.tid}`) || ''} ${e.name} ${e.cat || ''}`));
  const byEvent = Object.groupBy ? Object.groupBy(gpuSlices, e => e.name) : gpuSlices.reduce((a, e) => ((a[e.name] ||= []).push(e), a), {});
  const gpuTraceSummary = Object.entries(byEvent).map(([name, list]) => ({ name, count: list.length,
    totalMs: +(list.reduce((sum, e) => sum + e.dur, 0) / 1000).toFixed(2),
    p95Ms: percentile(list.map(e => e.dur / 1000), .95),
    maxMs: +(list.reduce((max, e) => Math.max(max, e.dur), 0) / 1000).toFixed(2) }))
    .sort((a, b) => b.totalMs - a.totalMs).slice(0, 40);
  const threadSummary = Object.fromEntries([...new Set(gpuSlices.map(e => threadNames.get(`${e.pid}:${e.tid}`) || 'unknown'))]
    .map(name => {
      const list = gpuSlices.filter(e => (threadNames.get(`${e.pid}:${e.tid}`) || 'unknown') === name);
      return [name, { taskCount: list.length,
        maxTaskMs: +(list.reduce((max, e) => Math.max(max, e.dur), 0) / 1000).toFixed(2) }];
    }));
  const memory = final.probe.memorySamples;
  const presentationEvents = events.filter(e => /FramePresented|SubmitCompositorFrame|SwapBuffers|DrawFrame/i.test(e.name));
  const pageCpuMetricDelta = (() => {
    const first = browserPerformanceSamples[0] || {}, last = browserPerformanceSamples.at(-1) || {};
    return Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'JSHeapUsedSize']
      .filter(key => Number.isFinite(first[key]) && Number.isFinite(last[key]))
      .map(key => [key, { start: first[key], end: last[key], delta: last[key] - first[key] }]));
  })();
  const browserContext = await page.evaluate(async () => ({
    userAgent: navigator.userAgent, platform: navigator.platform,
    userAgentData: navigator.userAgentData?.getHighEntropyValues
      ? await navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion', 'model', 'architecture', 'bitness']).catch(() => null)
      : null,
    viewport: { innerWidth, innerHeight, screenWidth: screen.width, screenHeight: screen.height,
      devicePixelRatio, visibility: document.visibilityState, focused: document.hasFocus() },
  }));
  const report = {
    runId, fluidVariant, appUrl: `${base}/bot-wave/index.html`, durationMs, sampleIntervalMs: sampleMs,
    browser: { version: chromeVersion, ...browserContext, remote: !!remote },
    gpu: { devices: gpuInfo.gpu.devices, auxAttributes: gpuInfo.gpu.auxAttributes,
      featureStatus: gpuInfo.gpu.featureStatus, processInfo: processInfo.processInfo || processInfo,
      interpretation: 'Chrome trace GPU/Viz/raster event durations are queue/service timings, not per-shader hardware timer queries.' },
    fixture: { botDescriptors: fixture.botDescriptors, queuedAtStart: fixture.queuedAtStart,
      activeAtStart: fixture.activeAtStart, skills: fixture.skills, canvas: fixture.canvas },
    runtime: final.runtime, frameTiming: final.profiles.frameIntervals,
    inputToNextRaf: final.profiles.inputToRafMs,
    trustedInputCount: final.probe.inputEvents.filter(x => x.trusted).length,
    longTasks: { count: final.probe.longTasks.length,
      maxMs: Math.max(0, ...final.probe.longTasks.map(x => x.durationMs)), entries: final.probe.longTasks },
    memory: { samples: memory, deltaBytes: memory.length >= 2 ? memory.at(-1).usedHeapBytes - memory[0].usedHeapBytes : null },
    browserPerformanceSamples, pageCpuMetricDelta,
    gameRuntimeSamples: final.probe.runtimeSamples,
    trace: { path: tracePath, bytes: fs.statSync(tracePath).size, events: events.length,
      presentationEvents: { count: presentationEvents.length,
        countsByName: Object.fromEntries([...new Set(presentationEvents.map(e => e.name))]
          .map(name => [name, presentationEvents.filter(e => e.name === name).length])) },
      gpuEventSummary: gpuTraceSummary, gpuThreads: threadSummary },
    screenshots: { start: startShot, end: endShot },
    cpuProfile: cpuProfile ? { path: cpuProfilePath, samples: cpuProfile.samples?.length || 0 } : null,
    runtimeErrors: errors, consoleErrors, failedRequests,
    acceptanceNote: 'This profile refuses software renderers and is a single real-device stress capture, not a performance fix. Compare before/after only on the same physical GPU, browser version, display mode and gameplay state.',
  };
  fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2) + '\n');
  console.log('BOT WAVE HARDWARE PROFILE COMPLETE', JSON.stringify({
    summaryPath, tracePath, gpu: report.gpu.devices, frameTiming: report.frameTiming,
    inputToNextRaf: report.inputToNextRaf, longTasks: report.longTasks.count,
    memoryDeltaBytes: report.memory.deltaBytes, runtime: report.runtime,
  }));
} catch (error) {
  console.error('BOT WAVE HARDWARE PROFILE FAILED', String(error), error.stack || '');
  throw error;
} finally {
  clearInterval(browserMetricsTimer);
  await gameFrame?.evaluate(() => {
    if (window.__apexHardwareProbe) {
      window.__apexHardwareProbe.active = false;
      for (const [type, listener] of window.__apexHardwareProbe.listeners || []) window.removeEventListener(type, listener, true);
      window.__apexHardwareLongTaskObserver?.disconnect();
    }
    clearInterval(window.__apexHardwareMetricsTimer);
    clearInterval(window.__apexHardwareProfileTimer);
    delete window.__apexHardwareQueueEntry; delete window.__apexHardwareDesiredBots; delete window.__apexHardwareBotSequence;
  }).catch(() => {});
  if (traceStarted) await page?.tracing.stop().catch(() => {});
  await pageCdp?.detach().catch(() => {});
  await browserCdp?.detach().catch(() => {});
  if (ownsBrowser) await browser?.close().catch(() => {});
  else if (browser) browser.disconnect();
}
