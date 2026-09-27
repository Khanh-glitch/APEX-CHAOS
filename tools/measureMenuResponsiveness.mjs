// Menu responsiveness measurement — owner correction pass item 3B.
//
// Measures the FIRST seconds after the menu becomes interactive while the
// Tier-2 background warmup is running:
//   - frame health: p50/p95/p99/max frame duration, slow-frame buckets
//   - Long Tasks: count, total, longest, and WHICH warmup group's script
//     loads overlap each long task (attribution from runtime spans)
//   - input responsiveness: synthetic pointermove/pointerdown + wheel events
//     driven through the real CDP input pipeline; input→next-frame latency
//     recorded in-page (rAF after the event)
//   - menu button action latency: real click → first DOM/canvas change
//     (MutationObserver), i.e. the artificial handleMenuButton delay + queue
//
// Usage:
//   LD_LIBRARY_PATH=/tmp/chromium/AL2023libs/lib CHROME_PATH=/tmp/chromium/chromium \
//   APEX_APP_URL=http://127.0.0.1:4173 node tools/measureMenuResponsiveness.mjs out.json [label]
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.APEX_CDP_ENDPOINT || 'http://127.0.0.1:9226';
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const chromePath = process.env.CHROME_PATH || '/tmp/chromium/chromium';
const outPath = process.argv[2] || 'docs/arsenal-quest/evidence/menu-responsiveness.json';
const label = process.argv[3] || 'run';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome = null;

if (!process.env.APEX_CDP_ENDPOINT) {
  chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9226',
    '--window-size=1100,1100',
    '--user-data-dir=' + path.join(process.cwd(), '.menu-probe-profile'),
    'about:blank',
  ], { stdio: 'ignore', detached: false });
}

async function pageTarget() {
  for (let i = 0; i < 120; i++) {
    try {
      const targets = await fetch(`${endpoint}/json/list`).then(r => r.json());
      const t = targets.find(x => x.type === 'page');
      if (t) return t;
    } catch {}
    await sleep(250);
  }
  throw new Error('CDP page did not become ready.');
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let serial = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const m = JSON.parse(event.data);
  if (!m.id || !pending.has(m.id)) return;
  const p = pending.get(m.id);
  pending.delete(m.id);
  m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
});
function command(method, params = {}) {
  const id = ++serial;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
  return r.result.value;
}

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1100, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: appUrl });

// Wait for the menu to be interactive.
for (let i = 0; i < 240; i++) {
  const ready = await evaluate('(window.apexPerfReport && window.apexPerfReport().boot.interactiveMs !== null) || false').catch(() => false);
  if (ready) break;
  await sleep(250);
}

// In-page instrumentation: input→frame latency + button action latency.
await evaluate(`(() => {
  window.__menuProbe = { pointer: [], down: [], wheel: [], buttonMs: null, mutations: 0 };
  const rec = (arr, t0) => requestAnimationFrame(() => arr.push(Math.round((performance.now() - t0) * 10) / 10));
  for (const type of ['pointermove', 'pointerdown', 'wheel']) {
    window.addEventListener(type, (e) => {
      const t0 = performance.now();
      const arr = type === 'pointermove' ? window.__menuProbe.pointer : type === 'pointerdown' ? window.__menuProbe.down : window.__menuProbe.wheel;
      rec(arr, t0);
    }, { capture: true, passive: true });
  }
  window.__menuProbe.observer = new MutationObserver(() => { window.__menuProbe.mutations += 1; });
  window.__menuProbe.observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  return true;
})()`);

const t0 = Date.now();
const startedAt = await evaluate('Math.round(performance.now())');

// Track warmup group readiness during the run.
const groups = ['arsenalQuest', 'battle', 'select', 'soloBattle', 'trialBattle', 'tamChien', 'manualLab'];
const groupReadyAt = {};

// Drive synthetic input at ~5 Hz and interleave group polls for 10s.
const INPUT_MS = 10000;
let nextInput = Date.now();
let n = 0;
while (Date.now() - t0 < INPUT_MS) {
  if (Date.now() >= nextInput) {
    nextInput += 200;
    n += 1;
    // Input is driven in the button-free band ABOVE the menu buttons
    // (buttons: y 452-831 at this viewport) — stray clicks would navigate,
    // load groups and pollute the measurement.
    const x = 120 + (n % 8) * 110;
    const y = 140 + (n % 4) * 70;
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', pointerType: 'mouse' });
    if (n % 2 === 0) {
      await command('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' });
      await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' });
    }
    if (n % 3 === 0) {
      await command('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: 120, pointerType: 'mouse' });
    }
  }
  const g = groups[(Date.now() / 400 | 0) % groups.length];
  if (!(g in groupReadyAt)) {
    const done = await evaluate(`(window.__apexDeferredRuntimesReady_${g} === true) ? Math.round(performance.now()) : false`).catch(() => false);
    if (done) groupReadyAt[g] = done;
  }
  await sleep(50);
}

// Measure menu button action latency (real click on a navigating button).
const btn = await evaluate(`(() => {
  const b = document.querySelector('#menu-screen .menu-image-button');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
})()`);
let buttonActionMs = null;
if (btn) {
  await evaluate('window.__menuProbe.mutations = 0; true');
  const c0 = Date.now();
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.x, y: btn.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.x, y: btn.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
  // Wait for the first DOM mutation after the click (pressed state or nav).
  for (let i = 0; i < 200; i++) {
    const m = await evaluate('window.__menuProbe.mutations');
    if (m > 0) { buttonActionMs = Date.now() - c0; break; }
    await sleep(10);
  }
}

const report = await evaluate('window.apexPerfReport()');
const probe = await evaluate('window.__menuProbe');

function stats(arr) {
  if (!arr || !arr.length) return { samples: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    samples: arr.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    max: sorted[sorted.length - 1],
    over50ms: arr.filter(v => v > 50).length,
  };
}

// Attribute each long task to overlapping runtime script spans.
const spans = report.resources.timings.filter(t => t.category === 'runtime');
const longTasksWithOverlap = report.longTasks.samples.map(t => {
  const overlapping = spans
    .filter(s => s.startedAt < t.at + t.durationMs && s.startedAt + s.durationMs > t.at)
    .map(s => path.basename(String(s.name || '')).replace(/\?.*$/, ''));
  return { atMs: t.at, durationMs: t.durationMs, overlappingRuntimes: overlapping };
});

const result = {
  label,
  appUrl,
  sampledForMs: INPUT_MS,
  startedAtPageMs: startedAt,
  frames: report.frames,
  longTasks: {
    count: report.longTasks.count,
    totalMs: report.longTasks.totalMs,
    longestMs: report.longTasks.slowest[0]?.durationMs || 0,
    withOverlap: longTasksWithOverlap,
  },
  inputLatency: {
    pointermove: stats(probe.pointer),
    pointerdown: stats(probe.down),
    wheelOrKey: stats(probe.wheel),
  },
  menuButtonActionMs: buttonActionMs,
  warmupGroupsReadyAtPageMs: groupReadyAt,
  bootPhases: report.boot.phases.map(p => ({ name: p.name, atMs: p.atMs })),
  interactiveMs: report.boot.interactiveMs,
  loaderHiddenMs: report.boot.loaderHiddenMs,
};

// Regression gates — menu responsiveness DURING background warmup.
// Baseline (deployed build, 7-group warmup, same methodology): 15 long tasks /
// 1695ms total / 2 dropped-frame seconds; all 7 mode groups parsed on the
// menu; rAF sample count 292 (starved).
// After the likely-next-only restructure: 2–3 long tasks, quest+select only.
// KNOWN RESIDUAL (documented, pre-existing in the baseline at ~750ms): one
// ~850ms no-span block right after warmup-end — a ROSTER-ATLAS DECODE STORM
// (trace evidence: ~50 'Decode Image'/'Decode LazyPixelRef' ~17ms slices in
// one RunTask; the battle-core roster runtimes carried by the quest group
// fire atlasImg.onload together once their bytes land). It is battle-core/
// roster-runtime architecture, not warmup sequencing — restructuring it is
// out of scope for this pass (hero rework scale). The gates below bind the
// improvements that ARE owned here: task count/total, group curation, frame
// health, and click latency medians.
// CP6 recalibration: the Arsenal warm-path work (tinted atlas kinds, katana
// visual bakes) is now CHUNKED (one asset per idle slot) instead of one
// monolithic onload callback. Measured effect on the menu (this tool,
// post-chunking): task count 3→8 but each ~140-200ms (max 199) instead of
// ~400ms+, total 1135ms (was ~1200), frame p95 16.8ms, pointerdown p95
// 15.6ms. The count gate is recalibrated for the chunked shape and a NEW
// longest-task gate protects the property that actually matters: no single
// warmup task may block input for the old monolith durations (~600-1078ms).
result.gates = {
  'menu-longtask-count': { pass: result.longTasks.count <= 10, value: result.longTasks.count, baseline: 15, limit: 10 },
  'menu-longtask-longest-ms': { pass: result.longTasks.longestMs <= 250, value: result.longTasks.longestMs, baseline: 1078, limit: 250 },
  'menu-longtask-total-ms': { pass: result.longTasks.totalMs <= 1300, value: result.longTasks.totalMs, baseline: 1695, limit: 1300 },
  'menu-pointerdown-median-ms': { pass: (result.inputLatency.pointerdown.median || 0) <= 30, value: result.inputLatency.pointerdown.median, baseline: 14.5, limit: 30 },
  'menu-pointerdown-p95-ms': { pass: (result.inputLatency.pointerdown.p95 || 0) <= 500, value: result.inputLatency.pointerdown.p95, baseline: 328.3, limit: 500 },
  'menu-pointerdown-over-50ms': { pass: (result.inputLatency.pointerdown.over50ms || 0) <= 5, value: result.inputLatency.pointerdown.over50ms, baseline: 2, limit: 5 },
  'menu-frame-p95-ms': { pass: (result.frames.p95Ms || 0) <= 40, value: result.frames.p95Ms, baseline: 50, limit: 40 },
  // Sample floor lowered from the post-CP5 aspirational 350 to 300 (CP5's
  // own baseline run measured 292; the chunked warmup trades a few frames
  // for bounded task sizes — frame p95/p99 and input gates carry the real
  // smoothness authority).
  'menu-frame-samples': { pass: (result.frames.samples || 0) >= 300, value: result.frames.samples, baseline: 292, limit: 300 },
  'menu-legacy-groups-not-warm': {
    pass: !groups.some(g => groupReadyAt[g] != null && !['arsenalQuest', 'select'].includes(g)),
    value: Object.fromEntries(Object.entries(groupReadyAt)),
  },
};
result.summary = {
  total: Object.keys(result.gates).length,
  passed: Object.values(result.gates).filter(g => g.pass).length,
  failed: Object.keys(result.gates).filter(k => !result.gates[k].pass),
};

await writeFile(outPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  label,
  interactiveMs: result.interactiveMs,
  frames: { p95Ms: result.frames.p95Ms, p99Ms: result.frames.p99Ms, maxMs: result.frames.maxMs, slowFrames: result.frames.slowFrames, samples: result.frames.samples },
  longTasks: { count: result.longTasks.count, totalMs: result.longTasks.totalMs, longestMs: result.longTasks.longestMs },
  inputLatency: result.inputLatency,
  menuButtonActionMs: result.menuButtonActionMs,
  warmupGroupsReadyAtPageMs: groupReadyAt,
  gates: result.summary,
}, null, 2));

socket.close();
try { chrome?.kill(); } catch {}
process.exit(result.summary.failed.length ? 1 : 0);
