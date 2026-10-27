// Paired real-Chromium A/B benchmark for the lossless Gold refraction-copy
// adapter. Results are diagnostics; headless Chromium is not a phone GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
// @sparticuz/chromium bundles Amazon Linux 2023 compatibility libraries.
process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs22.x';
const { default: chromium } = await import('@sparticuz/chromium');

const base = (process.env.APEX_APP_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const output = process.env.APEX_EVIDENCE_DIR || 'reports/bot-wave-perf';
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || await chromium.executablePath(),
  headless: true,
  args: [...chromium.args.filter(arg => arg !== '--single-process'), '--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: null,
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const viewports = [
  { name: 'desktop-1440x900', width: 1440, height: 900, dpr: 1 },
  { name: 'mobile-landscape-844x390-dpr2', width: 844, height: 390, dpr: 2 },
].filter(profile => !process.env.APEX_PERF_PROFILE || profile.name === process.env.APEX_PERF_PROFILE);
const all = [];
const runId = process.env.APEX_PERF_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
let activeFailureContext = { stage: 'startup', profile: null, mode: null, page: null };
const modes = process.env.APEX_PERF_MODE ? [process.env.APEX_PERF_MODE] : ['off', 'on'];
for (const mode of modes) assert.ok(['off', 'on'].includes(mode), 'APEX_PERF_MODE must be off or on');

async function waitFor(page, predicate, label, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await wait(80);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function parityProof(page) {
  const result = await page.evaluate(() => {
    const Post = window.handLab?.post?.constructor;
    if (!Post || !window.APEX_WAVE_REFRACTION_COPY?.installForTest) return null;
    const gold = new Post(), optimized = new Post();
    const stats = window.APEX_WAVE_REFRACTION_COPY.installForTest(optimized);
    const width = 420, height = 280;
    const trials = [
      { x: 165, y: 125, r: 78, hx: 90, hy: 164 },
      { x: 292, y: 99, r: 48, hx: 195, hy: 155 },
      { x: 95, y: 205, r: 68, hx: 260, hy: 85 },
      { x: 218, y: 170, r: 94, hx: 70, hy: 120 },
      { x: 330, y: 190, r: 38, hx: 185, hy: 215 },
      { x: 120, y: 79, r: 79, hx: 280, hy: 170 },
    ];
    for (const post of [gold, optimized]) post.scene.width = width, post.scene.height = height;
    let changedChannels = 0, maxChannelDiff = 0, absoluteDiff = 0, channels = 0;
    const frames = [];
    for (let pass = 0; pass < trials.length; pass++) {
      const t = trials[pass];
      const options = {
        time: 1.2 + pass * .37,
        shocks: [
          { x: t.x, y: t.y, r: t.r, width: 22, strength: .12, squash: .62 },
          { x: 305 - pass * 17, y: 232 - pass * 21, r: 25, width: 35, strength: .06, squash: .62 },
        ],
        heat: [
          { x: t.hx, y: t.hy, w: 80, h: 85, heat: .8 },
          { x: 318 - pass * 29, y: 80 + pass * 20, w: 76, h: 60, heat: .9 },
        ],
      };
      for (const post of [gold, optimized]) {
        const ctx = post.sctx;
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, pass % 2 ? '#315d79' : '#c98d45');
        gradient.addColorStop(.5, '#24386c');
        gradient.addColorStop(1, '#080d13');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#ffcf69'; ctx.lineWidth = 5;
        for (let k = 0; k < 25; k++) {
          ctx.beginPath(); ctx.arc((k * 27 + pass * 13) % width, (k * 59 + pass * 29) % height, 8 + k % 6, 0, Math.PI * 2); ctx.stroke();
        }
        post.distort(width, height, 1, options);
      }
      const a = gold.sctx.getImageData(0, 0, width, height).data;
      const b = optimized.sctx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < a.length; i++) {
        const delta = Math.abs(a[i] - b[i]);
        if (delta) changedChannels++;
        maxChannelDiff = Math.max(maxChannelDiff, delta);
        absoluteDiff += delta;
      }
      channels += a.length;
      frames.push({ gold: gold.scene.toDataURL('image/png'), optimized: optimized.scene.toDataURL('image/png') });
    }
    return {
      passes: trials.length, changedChannels, maxChannelDiff,
      meanAbsoluteChannelDiff: absoluteDiff / channels, frames,
      copyStats: stats.snapshot(),
    };
  });
  assert.ok(result, 'Gold Post parity fixture initialized');
  assert.equal(result.changedChannels, 0, `refraction output differs from Gold: ${JSON.stringify(result)}`);
  return result;
}

async function runOne(profile, mode) {
  console.log('BOT WAVE profile start', profile.name, mode);
  const page = await browser.newPage();
  const errors = [], consoleErrors = [], failedRequests = [];
  activeFailureContext = { stage: 'page-created', profile: profile.name, mode, page, consoleErrors, failedRequests };
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  await page.setViewport({ width: profile.width, height: profile.height, deviceScaleFactor: profile.dpr, isMobile: profile.dpr > 1, hasTouch: profile.dpr > 1 });
  activeFailureContext.stage = 'navigation';
  await page.goto(`${base}/bot-wave/game.html?refractionCopy=${mode}&wavePerf=on`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('BOT WAVE loaded', profile.name, mode);
  await page.waitForSelector('#w-go', { visible: true, timeout: 30000 });
  activeFailureContext.stage = 'campaign-start';
  await page.click('#w-go');
  await waitFor(page, () => page.evaluate(() => window.BOXE_WAVE_PILOT?.state?.phase === 'combat'), 'wave combat');
  activeFailureContext.stage = 'stress-sample';
  console.log('BOT WAVE combat started', profile.name, mode);
  await page.evaluate(stress => {
    const e = window.handLab;
    window.APEX_WAVE_PERF.enableCanvasPassProfiler();
    if (!stress) return;
    // Opt-in stress-only optical effects. Default A/B leaves natural gameplay untouched.
    let pass = 0;
    window.__botWaveVfxTimer = setInterval(() => {
      const i = pass++ % 5;
      e.wave(e.player.x + Math.cos(i * Math.PI * 2 / 5) * 70,
        e.player.y + Math.sin(i * Math.PI * 2 / 5) * 60, 155, .09, .72);
      e.fluid.addHeat(e.player.x + (i - 2) * 30, e.player.y - 20, 24, .42, .16);
      e.radialAmt = .45; e.chroma = .35;
    }, 800);
  }, process.env.APEX_PERF_STRESS === '1');
  await wait(Number(process.env.APEX_PERF_WARMUP_MS || 1500));
  await page.evaluate(() => { window.APEX_WAVE_PERF.resetSamples(); window.APEX_WAVE_REFRACTION_COPY.reset(); });
  const beforeMove = await page.evaluate(() => ({ x: window.handLab.player.x, y: window.handLab.player.y, t: window.handLab.time }));
  await page.keyboard.down('KeyD'); await page.keyboard.down('KeyJ');
  const samples = [];
  const durationMs = Number(process.env.APEX_PERF_DURATION_MS || 12000);
  const stepMs = 1000;
  for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs) {
    await wait(Math.min(stepMs, durationMs - elapsed));
    samples.push(await page.evaluate(() => ({
      now: performance.now(), perf: window.APEX_WAVE_PERF.snapshot(),
      memory: performance.memory?.usedJSHeapSize ?? null,
    })));
  }
  await page.keyboard.up('KeyJ'); await page.keyboard.up('KeyD');
  console.log('BOT WAVE sample window complete', profile.name, mode);
  const afterMove = await page.evaluate(() => {
    clearInterval(window.__botWaveVfxTimer);
    return { x: window.handLab.player.x, y: window.handLab.player.y, t: window.handLab.time };
  });
  const final = samples.at(-1)?.perf;
  activeFailureContext.stage = 'render-sample-assertion';
  assert.ok(final?.renderSamples > 10 && final?.postSamples > 10, `${profile.name}/${mode}: render pipeline did not sample: ${JSON.stringify(final)}`);
  activeFailureContext.stage = 'pixel-parity';
  const parity = await parityProof(page);
  for (const [index, frame] of parity.frames.entries()) for (const [kind, url] of Object.entries(frame)) {
    const base64 = url.slice(url.indexOf(',') + 1);
    fs.writeFileSync(path.join(output, `${profile.name}-${mode}-parity-${String(index + 1).padStart(2, '0')}-${kind}.png`), Buffer.from(base64, 'base64'));
  }
  delete parity.frames;
  console.log('BOT WAVE browser pixel parity complete', profile.name, mode);
  assert.deepEqual(errors, [], `${profile.name}/${mode}: uncaught browser errors`);
  const heaps = samples.map(s => s.memory).filter(Number.isFinite);
  const report = {
    runId, profile: profile.name, mode, viewport: { width: profile.width, height: profile.height, dpr: profile.dpr },
    durationMs, framesSampled: final.renderSamples, botsAtEnd: final.livingBots,
    movementPx: Math.hypot(afterMove.x - beforeMove.x, afterMove.y - beforeMove.y),
    gameClockSeconds: afterMove.t - beforeMove.t,
    fpsAverageEstimate: +final.fpsAverageEstimate.toFixed(2),
    fps1PercentLowEstimate: +final.fps1PercentLowEstimate.toFixed(2),
    frameTimeP50Ms: +final.frameGapP50Ms.toFixed(2), frameTimeP95Ms: +final.frameGapP95Ms.toFixed(2), frameTimeP99Ms: +final.frameGapP99Ms.toFixed(2),
    updateP50Ms: +final.updateP50Ms.toFixed(2), updateP95Ms: +final.updateP95Ms.toFixed(2), updateP99Ms: +final.updateP99Ms.toFixed(2),
    renderP50Ms: +final.renderP50Ms.toFixed(2), renderP95Ms: +final.renderP95Ms.toFixed(2), renderP99Ms: +final.renderP99Ms.toFixed(2),
    postP50Ms: +final.postP50Ms.toFixed(2), postP95Ms: +final.postP95Ms.toFixed(2), postP99Ms: +final.postP99Ms.toFixed(2),
    inputQueueP95Ms: +final.inputQueueP95Ms.toFixed(2), longTasks: final.longTasks, longTaskMaxMs: +final.longTaskMaxMs.toFixed(2),
    gcSupported: final.gcSupported, gcEvents: final.gcEvents, gcDurationMs: +final.gcDurationMs.toFixed(2), gcMaxMs: +final.gcMaxMs.toFixed(2),
    heapStartBytes: heaps[0] ?? null, heapEndBytes: heaps.at(-1) ?? null, heapPeakBytes: heaps.length ? Math.max(...heaps) : null,
    renderDpr: final.renderDpr, canvasPixels: final.canvasPixels, postSurfaceBytes: final.postSurfaceBytes,
    refractionCopy: await page.evaluate(() => window.APEX_WAVE_REFRACTION_COPY.snapshot()),
    canvasPassCosts: final.canvasPassCosts, parity,
  };
  if (mode === 'on') {
    activeFailureContext.stage = 'candidate-copy-assertion';
    assert.ok(report.refractionCopy.partialFrames > 0 && report.refractionCopy.pixelsAvoided > 0,
      `${profile.name}: candidate refraction copy did not exercise sparse sampling`);
  }
  activeFailureContext.stage = 'movement-and-clock-assertion';
  assert.ok(report.movementPx > 8 && report.gameClockSeconds > .25, `${profile.name}/${mode}: movement or clock stalled: ${JSON.stringify(report)}`);
  await page.evaluate(() => { clearInterval(window.__botWaveVfxTimer); window.handLab?.destroy(); });
  await page.screenshot({ path: path.join(output, `${profile.name}-${mode}-combat.png`) });
  await page.close({ runBeforeUnload: false });
  activeFailureContext = { stage: 'profile-complete', profile: profile.name, mode, page: null };
  console.log('BOT WAVE profile ready', profile.name, mode);
  return report;
}

try {
  for (const profile of viewports) {
    const pair = [];
    for (const mode of modes) pair.push(await runOne(profile, mode));
    all.push({ profile: profile.name, results: pair });
    console.log('BOT WAVE profile pair', JSON.stringify(all.at(-1)));
  }
  const reportName = `profile-${runId}-${all.map(item => item.profile).join('_')}-${modes.join('-')}.json`;
  fs.writeFileSync(path.join(output, reportName), JSON.stringify({
    note: 'Headless Chromium/SwiftShader profile, not representative of physical mobile GPUs. Run mode=off and mode=on separately for paired same-host A/B. Image parity is separately checked pixel by pixel.',
    results: all,
  }, null, 2) + '\n');
  console.log('BOT WAVE lossless refraction browser profile PASS');
} catch (error) {
  const context = activeFailureContext;
  let runtime = null, screenshot = null;
  if (context.page && !context.page.isClosed()) {
    runtime = await Promise.race([
      context.page.evaluate(() => ({
        url: location.href, phase: window.BOXE_WAVE_PILOT?.state?.phase,
        paused: window.handLab?.paused, visibility: document.visibilityState,
        focus: document.hasFocus(), time: window.handLab?.time,
        player: window.handLab?.player && { x: window.handLab.player.x, y: window.handLab.player.y },
        bots: window.handLab?.enemies?.filter(e => !e.dead).length,
        perf: window.APEX_WAVE_PERF?.snapshot?.(), refractionCopy: window.APEX_WAVE_REFRACTION_COPY?.snapshot?.(),
      })).catch(e => ({ error: String(e) })),
      wait(2500).then(() => ({ error: 'diagnostics timeout' })),
    ]);
    screenshot = path.join(output, `failure-${runId}-${context.profile || 'startup'}-${context.mode || 'unknown'}.png`);
    await Promise.race([
      context.page.screenshot({ path: screenshot }).catch(() => { screenshot = null; }),
      wait(2500),
    ]);
  }
  const failurePath = path.join(output, `failure-${runId}-${context.profile || 'startup'}-${context.mode || 'unknown'}.json`);
  const failure = {
    message: String(error), stack: error.stack, runId, profile: context.profile,
    mode: context.mode, stage: context.stage, url: context.page?.url() || null,
    runtime, screenshot, consoleErrors: context.consoleErrors || [], failedRequests: context.failedRequests || [],
  };
  fs.writeFileSync(failurePath, JSON.stringify(failure, null, 2) + '\n');
  console.error('BOT WAVE profile failure detail', JSON.stringify({ failurePath, ...failure }));
  const annotation = `${context.mode || 'unknown'}/${context.profile || 'unknown'} failed at ${context.stage}: ${String(error)} (details: ${path.basename(failurePath)})`
    .replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.error(`::error title=BOT WAVE profiling diagnostic::${annotation}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `\n### BOT WAVE browser profile failure\n\n- Mode/profile: ${context.mode || 'unknown'} / ${context.profile || 'unknown'}\n- Stage: ${context.stage}\n- Error: \`${String(error).replace(/`/g, "'")}\`\n- Details: \`${failurePath}\`\n`);
  throw error;
} finally {
  // Heavy canvas pages can make graceful single-process Chromium teardown take
  // minutes on constrained CI hosts. All evidence is flushed before this point.
  browser.process()?.kill('SIGKILL');
}
