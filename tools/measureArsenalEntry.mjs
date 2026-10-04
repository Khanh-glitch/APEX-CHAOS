// Owner-flow measurement — Arsenal entry waterfall + input responsiveness
// during background work (correction pass CP6, phase 1).
//
// Cold-owner path, measured end to end with the real CDP input pipeline:
//   fresh page load -> menu interactive -> REAL click on the active Bot Battle card
//   -> pressed visual painted -> product route -> runtime/image warmup -> picker
//   -> first route paint.
//
// Also probes pointer responsiveness (pointerdown -> next rAF paint) at a
// fixed cadence from menu-interactive until the product route is visible, so blocked
// frames during the load/decode window are visible in the evidence.
//
// Usage:
//   LD_LIBRARY_PATH=... CHROME_PATH=/tmp/chromium/chromium \
//   APEX_APP_URL=http://127.0.0.1:4173 node tools/measureArsenalEntry.mjs out.json [label]
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const chromePath = process.env.CHROME_PATH || '/tmp/chromium/chromium';
const outPath = process.argv[2] || 'docs/acceptance/arsenal-product/evidence/arsenal-entry-waterfall.json';
const label = process.argv[3] || 'run';
const entryDelayMs = parseInt(process.env.APEX_ENTRY_DELAY_MS || '0', 10);
const profileDir = path.join(process.cwd(), '.arsenal-entry-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let chrome = null;

chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=9231', '--window-size=1100,1100',
  '--user-data-dir=' + profileDir, 'about:blank',
], { stdio: 'ignore', env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || '' } });

async function pageTarget() {
  for (let i = 0; i < 120; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9231/json/list').then(r => r.json());
      const page = list.find(t => t.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome devtools endpoint never came up');
}
const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => socket.addEventListener('open', r, { once: true }));
let serial = 0; const pending = new Map();
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (!m.id || !pending.has(m.id)) return;
  const p = pending.get(m.id); pending.delete(m.id);
  m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
});
const command = (method, params = {}) => {
  const id = ++serial;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
};
async function evaluate(expression) {
  const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
  return r.result.value;
}

await command('Page.enable');
await command('Runtime.enable');
await command('Page.navigate', { url: appUrl });

// Wait until the document exists, then install the in-page instrumentation.
for (let i = 0; i < 100; i++) {
  const ok = await evaluate('Boolean(document && document.documentElement)').catch(() => false);
  if (ok) break;
  await sleep(100);
}
await evaluate(`(() => {
  window.__ownerFlow = {
    t0: performance.now(),
    events: [],          // { at, type, detail }
    inputs: [],           // { at, paintedAt, latency } pointerdown -> next rAF
    longTasks: [],        // { at, dur }
    resources: [],        // { at, dur, type, name } script/img/audio
    press: null,          // pressed-visual paint time
    productRouteFirstPaint: null,
    menuInteractiveAt: null,
  };
  const F = window.__ownerFlow;
  const mark = (type, detail) => F.events.push({ at: +(performance.now() - F.t0).toFixed(1), type, detail: detail || null });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) F.longTasks.push({ at: +(e.startTime - F.t0).toFixed(1), dur: +e.duration.toFixed(1) });
  }).observe({ entryTypes: ['longtask'] });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.initiatorType === 'script' || e.initiatorType === 'img' || e.initiatorType === 'audio' || e.initiatorType === 'fetch') {
        F.resources.push({ at: +(e.startTime - F.t0).toFixed(1), dur: +e.duration.toFixed(1), type: e.initiatorType, name: e.name.split('/').slice(-2).join('/') });
      }
    }
  }).observe({ entryTypes: ['resource'] });
  // pointerdown -> next rAF paint probe (rAF after the event = next presented frame opportunity)
  const probeInput = (ev) => {
    const at = performance.now();
    requestAnimationFrame(() => { F.inputs.push({ at: +(at - F.t0).toFixed(1), paintedAt: +(performance.now() - F.t0).toFixed(1), latency: +(performance.now() - at).toFixed(1) }); });
  };
  window.addEventListener('pointerdown', probeInput, { capture: true, passive: true });
  window.addEventListener('keydown', probeInput, { capture: true, passive: true });
  // pressed visual: the menu button pressed state is a React state -> class/DOM change on #menu-screen
  const mo = new MutationObserver((muts) => {
    if (F.press != null) return;
    for (const m of muts) {
      const t = m.target;
      if (t.classList && (t.classList.contains('is-pressed') || (m.type === 'childList' && [...m.addedNodes].some(n => n.id === 'aq-meta-root')))) {
        F.press = +(performance.now() - F.t0).toFixed(1); mo.disconnect(); return;
      }
    }
  });
  mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  // product route visible: picker, product meta view, or a hidden menu
  const routeMo = new MutationObserver(() => {
    const menu = document.getElementById('menu-screen');
    const picker = document.getElementById('select-screen');
    const meta = document.getElementById('aq-meta-root');
    const pickerVisible = !!picker && !picker.classList.contains('hidden');
    const metaVisible = !!meta && meta.style.display !== 'none' && meta.getBoundingClientRect().width > 50;
    const menuHidden = !!menu && menu.classList.contains('hidden');
    if (pickerVisible || metaVisible || menuHidden) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (F.productRouteFirstPaint == null) F.productRouteFirstPaint = +(performance.now() - F.t0).toFixed(1);
      }));
      routeMo.disconnect();
    }
  });
  routeMo.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
  mark('instrumented');
  return true;
})()`);

// Wait for menu interactive (loader hidden + buttons present).
for (let i = 0; i < 200; i++) {
  const ready = await evaluate(`(() => {
    const loading = document.getElementById('loading-screen');
    const btns = document.querySelectorAll('#menu-screen button, #menu-screen [role="button"], #menu-screen .menu-button');
    const interactive = window.__apexMenuInteractiveAt != null || (loading && loading.classList.contains('is-fading')) || (loading && getComputedStyle(loading).display === 'none');
    return { interactive: !!interactive && btns.length > 0, btnCount: btns.length };
  })()`).catch(() => ({ interactive: false, btnCount: 0 }));
  if (ready.interactive) break;
  await sleep(100);
}
const menuInteractiveAt = await evaluate(`(() => {
  const F = window.__ownerFlow; F.menuInteractiveAt = performance.now();
  return +(F.menuInteractiveAt - F.t0).toFixed(1);
})()`);

// Find the active Bot Battle product card rect for a REAL click.
const rect = await evaluate(`(() => {
  const b = document.querySelector('#menu-screen [data-product-surface="bot-battle"]');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, tag: b.tagName, disabled: b.disabled };
})()`);
if (!rect || rect.disabled) { console.error('active Bot Battle product card not found or disabled'); chrome.kill(); process.exit(1); }

// Optional soak before the click (warm-entry variant).
if (entryDelayMs > 0) await sleep(entryDelayMs);

// REAL pointer click through the CDP input pipeline (immediately at menu-interactive — the owner flow).
const tClickSent = Date.now();
await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
const clickAt = await evaluate(`+(performance.now() - window.__ownerFlow.t0).toFixed(1)`);
await evaluate(`window.__ownerFlow.events.push({ at: ${clickAt}, type: 'cdp-click', detail: 'arsenal-product surface card' })`);

// Hover jitter during the load window: real pointermoves to measure input health.
const hoverJob = (async () => {
  for (let i = 0; i < 60; i++) {
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 300 + (i % 7) * 40, y: 500 + (i % 5) * 30 }).catch(() => {});
    await sleep(120);
    const done = await evaluate(`window.__ownerFlow.productRouteFirstPaint != null`).catch(() => true);
    if (done) break;
  }
})();

// Wait until the product route paints or timeout (25s).
for (let i = 0; i < 250; i++) {
  const done = await evaluate(`window.__ownerFlow.productRouteFirstPaint != null`).catch(() => false);
  if (done) break;
  await sleep(100);
}
await hoverJob;
await sleep(400);

const result = await evaluate(`(() => {
  const F = window.__ownerFlow;
  const perf = window.apexPerfReport ? window.apexPerfReport() : null;
  const av = window.APEX_ARSENAL_AV ? window.APEX_ARSENAL_AV.audioStatus() : null;
  const productReady = window.__apexDeferredRuntimesReady_arsenalProduct === true;
  const scriptSpans = perf && perf.timings ? perf.timings.filter(t => t.category === 'runtime') : [];
  return JSON.stringify({
    label: ${JSON.stringify(label)},
    menuInteractiveAt: F.menuInteractiveAt,
    clickAt: ${clickAt},
    pressedPaintAt: F.press,
    productRouteFirstPaintAt: F.productRouteFirstPaint,
    pressToPaintMs: F.press != null ? +(F.press - ${clickAt}).toFixed(1) : null,
    pressToProductRouteMs: F.productRouteFirstPaint != null ? +(F.productRouteFirstPaint - ${clickAt}).toFixed(1) : null,
    productReady,
    scriptSpans,
    longTasks: F.longTasks,
    inputsDuringLoad: F.inputs.map(i => i.latency),
    inputMaxMs: F.inputs.length ? Math.max(...F.inputs.map(i => i.latency)) : null,
    inputOver100: F.inputs.filter(i => i.latency > 100).length,
    avWarm: av ? { warmStartedAt: av.warmStartedAt, warmDecodedAt: av.warmDecodedAt, decoded: av.decoded, bankSize: av.bankSize } : null,
    imgResources: F.resources.filter(r => r.type === 'img').length,
    scriptResources: F.resources.filter(r => r.type === 'script').length,
    slowestResources: F.resources.slice().sort((a, b) => b.dur - a.dur).slice(0, 12),
    events: F.events,
  });
})()`);

const data = JSON.parse(result);
await writeFile(outPath, JSON.stringify(data, null, 2));
console.log(JSON.stringify({
  label: data.label,
  menuInteractiveAt: data.menuInteractiveAt,
  clickAt: data.clickAt,
  pressedPaintAt: data.pressedPaintAt,
  pressToPaintMs: data.pressToPaintMs,
  productRouteFirstPaintAt: data.productRouteFirstPaintAt,
  pressToProductRouteMs: data.pressToProductRouteMs,
  productReady: data.productReady,
  longTasksDuringEntry: data.longTasks.filter(l => l.at >= data.clickAt - 50).length,
  worstLongTask: data.longTasks.length ? Math.max(...data.longTasks.map(l => l.dur)) : 0,
  inputMaxMs: data.inputMaxMs,
  inputOver100: data.inputOver100,
  imgResources: data.imgResources,
  scriptResources: data.scriptResources,
}, null, 2));
socket.close(); chrome.kill();
process.exit(0);
