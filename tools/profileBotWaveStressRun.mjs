// One fresh-process BOT WAVE stress sample for benchmarkBotWaveStressAB.mjs.
// It uses actual campaign-authored enemies and real browser key events; no
// production gameplay/assets are changed. Headless SwiftShader is not a phone GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs22.x';
const { default: chromium } = await import('@sparticuz/chromium');
const base = (process.env.APEX_APP_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = process.env.APEX_EVIDENCE_DIR || 'reports/bot-wave-stress-ab';
fs.mkdirSync(output, { recursive: true });
const mode = process.env.APEX_PERF_MODE || 'off';
assert.ok(['off', 'on'].includes(mode));
const profile = process.env.APEX_PERF_PROFILE || 'desktop-1440x900';
const viewport = profile.startsWith('mobile') ? { width: 844, height: 390, dpr: 2 } : { width: 1440, height: 900, dpr: 1 };
const seed = Number(process.env.APEX_PERF_SEED || 20261027) >>> 0;
const durationMs = Number(process.env.APEX_PERF_DURATION_MS || 60000);
const botCount = Number(process.env.APEX_PERF_BOTS || 14);
const runId = process.env.APEX_PERF_RUN_ID || `${profile}-${mode}-${Date.now()}`;
const vfxIntervalMs = Number(process.env.APEX_PERF_VFX_INTERVAL_MS || 450);
const skillIntervalMs = Number(process.env.APEX_PERF_SKILL_INTERVAL_MS || 450);
const reportPath = path.join(output, `stress-${runId}.json`);
const screenshotPath = process.env.APEX_PERF_CAPTURE_SCREENSHOT === '1' ? path.join(output, `stress-${runId}.png`) : null;
const errors = [], consoleErrors = [], failedRequests = [];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || await chromium.executablePath(), headless: true,
  args: [...chromium.args.filter(arg => arg !== '--single-process'), '--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
let stage = 'startup';
let browserVersion = null;
let before = null, setup = null;
const wait = ms => new Promise(r => setTimeout(r, ms));
const percentile = (values, p) => {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? +a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))].toFixed(2) : null;
};
try {
  browserVersion = await browser.version();
  await page.evaluateOnNewDocument(value => {
    let state = value || 1;
    Math.random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  }, seed);
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dpr, isMobile: viewport.dpr > 1, hasTouch: viewport.dpr > 1 });
  stage = 'navigation';
  await page.goto(`${base}/bot-wave/game.html?refractionCopy=${mode}&wavePerf=on`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#w-go', { visible: true, timeout: 30000 });
  stage = 'campaign-start';
  await page.click('#w-go');
  const combatDeadline = Date.now() + 30000;
  while (Date.now() < combatDeadline && await page.evaluate(() => window.BOXE_WAVE_PILOT?.state?.phase !== 'combat')) await wait(50);
  assert.equal(await page.evaluate(() => window.BOXE_WAVE_PILOT?.state?.phase), 'combat', 'campaign enters combat');
  stage = 'stress-fixture';
  setup = await page.evaluate(({ targetBots, vfxEveryMs }) => {
    const pilot = window.BOXE_WAVE_PILOT, state = pilot?.state, e = window.handLab;
    if (!pilot || !state || !e) throw new Error('Gold campaign fixture is unavailable');
    const entries = pilot.compositions.flatMap(c => c.plan.composition);
    assertCampaignEntries(entries);
    state.softCap = Math.max(state.softCap, targetBots);
    state.queue = Array.from({ length: targetBots * 4 }, (_, i) => {
      const item = entries[i % entries.length];
      return { gun: item.weaponId, boss: !!item.boss, edge: ['top', 'right', 'bottom', 'left'][i % 4],
        edgeFraction: .08 + (i % 13) * .069, role: item.role };
    });
    for (const id of ['jab', 'rocket', 'uppercut', 'counter', 'phantom', 'ult']) state.owned.add(id);
    e.waveCounterUnlocked = true; e.paused = false;
    for (let i = 0; i < targetBots && state.queue.length; i++) { state.spawnT = 0; e.update(.016); }
    e.player.hp = e.player.maxHp; // starts at Gold campaign HP; no invulnerability or altered damage rules
    let pass = 0;
    window.__botWaveStressTimer = setInterval(() => {
      const i = pass++ % 5;
      e.wave(e.player.x + Math.cos(i * Math.PI * 2 / 5) * 70,
        e.player.y + Math.sin(i * Math.PI * 2 / 5) * 60, 155, .09, .72);
      e.fluid.addHeat(e.player.x + (i - 2) * 30, e.player.y - 20, 24, .42, .16);
      e.radialAmt = .45; e.chroma = .35;
    }, vfxEveryMs);
    window.__botWaveInputLatency = [];
    document.addEventListener('keydown', event => {
      if (!['KeyD', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI'].includes(event.code)) return;
      const mark = { code: event.code, eventTime: performance.now(), nextFrameTime: null };
      window.__botWaveInputLatency.push(mark);
      requestAnimationFrame(ts => { mark.nextFrameTime = ts; mark.inputToNextFrameMs = ts - mark.eventTime; });
    }, true);
    window.APEX_WAVE_PERF.enableCanvasPassProfiler();
    return { activeBots: e.enemies.filter(x => !x.dead).length, queueRemaining: state.queue.length,
      softCap: state.softCap, wave: state.wave, descriptors: entries.length,
      validWeapons: [...new Set(entries.map(x => x.weaponId))].length, skills: [...state.owned], vfxEveryMs };
    function assertCampaignEntries(items) { if (!items.length || items.some(x => !x.weaponId)) throw new Error('Campaign contains no valid weapon descriptors'); }
  }, { targetBots: botCount, vfxEveryMs: vfxIntervalMs });
  assert.ok(setup.activeBots >= Math.min(10, botCount), `did not prefill real campaign bots: ${JSON.stringify(setup)}`);
  await wait(Number(process.env.APEX_PERF_WARMUP_MS || 4000));
  await page.evaluate(() => {
    window.APEX_WAVE_PERF.resetSamples(); window.APEX_WAVE_REFRACTION_COPY.reset();
    window.__botWaveBenchStart = performance.now();
  });
  before = await page.evaluate(() => ({ x: window.handLab.player.x, y: window.handLab.player.y,
    gameTime: window.handLab.time, phase: window.BOXE_WAVE_PILOT.state.phase,
    bots: window.handLab.enemies.filter(e => !e.dead).length, heapBytes: performance.memory?.usedJSHeapSize ?? null }));
  await page.keyboard.down('KeyD');
  stage = 'measurement';
  const started = Date.now();
  const measuredAt = new Date().toISOString();
  let inputActive = true;
  const inputDriver = (async () => {
    const keys = ['KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI']; let i = 0;
    while (inputActive) {
      await page.keyboard.press(keys[i++ % keys.length]);
      await wait(skillIntervalMs);
    }
  })();
  const memoryTrend = [];
  while (Date.now() - started < durationMs) {
    await wait(Math.min(15000, durationMs - (Date.now() - started)));
    if (Date.now() - started < durationMs) memoryTrend.push(await page.evaluate(() => ({
      elapsedMs: performance.now() - window.__botWaveBenchStart,
      heapBytes: performance.memory?.usedJSHeapSize ?? null,
      gameTime: window.handLab.time, bots: window.handLab.enemies.filter(e => !e.dead).length,
      phase: window.BOXE_WAVE_PILOT.state.phase,
    })));
  }
  inputActive = false;
  await inputDriver;
  await page.keyboard.up('KeyD').catch(() => {});
  const after = await page.evaluate(() => {
    clearInterval(window.__botWaveStressTimer);
    return { x: window.handLab.player.x, y: window.handLab.player.y, gameTime: window.handLab.time,
      phase: window.BOXE_WAVE_PILOT.state.phase, paused: window.handLab.paused,
      bots: window.handLab.enemies.filter(e => !e.dead).length,
      inputLatency: window.__botWaveInputLatency || [],
      perf: window.APEX_WAVE_PERF.snapshot(), refractionCopy: window.APEX_WAVE_REFRACTION_COPY.snapshot(),
      heapBytes: performance.memory?.usedJSHeapSize ?? null, visibility: document.visibilityState, focused: document.hasFocus() };
  });
  stage = 'report';
  const latencies = after.inputLatency.map(x => x.inputToNextFrameMs).filter(Number.isFinite);
  const report = {
    runId, seed, browserVersion, profile, viewport, mode, durationMs, stressFixture: setup,
    startedAt: measuredAt, hostElapsedMs: Date.now() - started,
    phaseAtEnd: after.phase, pausedAtEnd: after.paused, visibleAtEnd: after.visibility, focusedAtEnd: after.focused,
    activeBotsAtStart: before.bots, activeBotsAtEnd: after.bots, queueRemainingAtEnd: setup.queueRemaining,
    gameClockSeconds: +(after.gameTime - before.gameTime).toFixed(3),
    movementPx: +Math.hypot(after.x - before.x, after.y - before.y).toFixed(2),
    framesSampled: after.perf.renderSamples,
    fpsAverageEstimate: +after.perf.fpsAverageEstimate.toFixed(2), fps1PercentLowEstimate: +after.perf.fps1PercentLowEstimate.toFixed(2),
    frameTimeP50Ms: +after.perf.frameGapP50Ms.toFixed(2), frameTimeP95Ms: +after.perf.frameGapP95Ms.toFixed(2), frameTimeP99Ms: +after.perf.frameGapP99Ms.toFixed(2),
    updateP50Ms: +after.perf.updateP50Ms.toFixed(2), updateP95Ms: +after.perf.updateP95Ms.toFixed(2), updateP99Ms: +after.perf.updateP99Ms.toFixed(2),
    renderP50Ms: +after.perf.renderP50Ms.toFixed(2), renderP95Ms: +after.perf.renderP95Ms.toFixed(2), renderP99Ms: +after.perf.renderP99Ms.toFixed(2),
    postP50Ms: +after.perf.postP50Ms.toFixed(2), postP95Ms: +after.perf.postP95Ms.toFixed(2), postP99Ms: +after.perf.postP99Ms.toFixed(2),
    inputQueueP50Ms: +after.perf.inputQueueP50Ms.toFixed(2), inputQueueP95Ms: +after.perf.inputQueueP95Ms.toFixed(2), inputQueueP99Ms: +after.perf.inputQueueP99Ms.toFixed(2),
    inputToNextFrameSamples: latencies.length, inputToNextFrameP50Ms: percentile(latencies, .50),
    inputToNextFrameP95Ms: percentile(latencies, .95), inputToNextFrameP99Ms: percentile(latencies, .99),
    longTasks: after.perf.longTasks, longTaskMaxMs: +after.perf.longTaskMaxMs.toFixed(2),
    gcSupported: after.perf.gcSupported, gcEvents: after.perf.gcEvents,
    gcDurationMs: +after.perf.gcDurationMs.toFixed(2), gcMaxMs: +after.perf.gcMaxMs.toFixed(2),
    heapStartBytes: before.heapBytes, heapEndBytes: after.heapBytes,
    heapTrend: memoryTrend, renderDpr: after.perf.renderDpr, canvasPixels: after.perf.canvasPixels,
    postSurfaceBytes: after.perf.postSurfaceBytes, refractionCopy: after.refractionCopy,
    canvasPassCosts: after.perf.canvasPassCosts, runtimeErrors: errors, consoleErrors, failedRequests,
    note: 'Browser-renderer synthetic stress evidence. Chrome is headless SwiftShader here; this is not a physical GPU/mobile acceptance result.',
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  if (screenshotPath) await page.screenshot({ path: screenshotPath });
  assert.deepEqual(errors, [], 'no uncaught browser runtime errors');
  if (mode === 'on') assert.ok(report.refractionCopy.partialFrames > 0 && report.refractionCopy.pixelsAvoided > 0, 'candidate path was exercised');
  assert.ok(report.framesSampled >= 30, `insufficient full-window frame samples: ${report.framesSampled}`);
  assert.ok(report.movementPx > 8 && report.gameClockSeconds > .25, `input/simulation stalled: ${JSON.stringify({ movementPx: report.movementPx, gameClockSeconds: report.gameClockSeconds, phase: report.phaseAtEnd })}`);
  console.log('BOT_WAVE_STRESS_REPORT ' + JSON.stringify({ reportPath, screenshotPath, report }));
} catch (error) {
  const diagnostics = await Promise.race([page.evaluate(() => ({
    phase: window.BOXE_WAVE_PILOT?.state?.phase, paused: window.handLab?.paused,
    visibility: document.visibilityState, time: window.handLab?.time,
    player: window.handLab?.player && { x: window.handLab.player.x, y: window.handLab.player.y },
    bots: window.handLab?.enemies?.filter(e => !e.dead).length,
    perf: window.APEX_WAVE_PERF?.snapshot?.(), refractionCopy: window.APEX_WAVE_REFRACTION_COPY?.snapshot?.(),
  })).catch(e => ({ error: String(e) })), wait(2500).then(() => ({ error: 'diagnostic timeout' }))]);
  const failure = { runId, mode, profile, seed, stage, message: String(error), stack: error.stack,
    setup, before, diagnostics, errors, consoleErrors, failedRequests };
  fs.writeFileSync(path.join(output, `failure-${runId}.json`), JSON.stringify(failure, null, 2) + '\n');
  console.error('BOT WAVE stress sample failed', JSON.stringify(failure));
  throw error;
} finally {
  browser.process()?.kill('SIGKILL');
}
