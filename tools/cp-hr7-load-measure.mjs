// Arsenal product load measurement probe (real Chromium via CDP).
// Measures menu-interactive timing, active-product warmup, physical Bot Battle
// entry into the shared picker, and the current match gameplay barrier.
//
//   LD_LIBRARY_PATH=... CHROME_PATH=... APEX_APP_URL=http://127.0.0.1:5173 \
//   node tools/cp-hr7-load-measure.mjs runA 9225
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const label = process.argv[2] || 'runA';
const port = process.argv[3] || '9225';
const endpoint = `http://127.0.0.1:${port}`;
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH;
const evidenceDir = 'docs/acceptance/arsenal-product/evidence';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let chrome = null;

if (!chromePath) throw new Error('CHROME_PATH required');
chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`,
  '--window-size=1100,1100',
  '--user-data-dir=/tmp/.arsenal-product-probe-' + label,
  'about:blank',
], { stdio: 'ignore', detached: false });

async function pageTarget() {
  for (let i = 0; i < 100; i++) {
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
  const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

// Long-task observer + boot clock installed before any app script runs.
// CDP domains MUST be enabled before addScriptToEvaluateOnNewDocument will
// apply to the navigated document.
await command('Page.enable');
await command('Runtime.enable');
await command('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__cpHr7 = { t0: Date.now(), longTasks: [], paint: null };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__cpHr7.longTasks.push({ start: +(e.startTime).toFixed(1), dur: +(e.duration).toFixed(1) });
    }).observe({ entryTypes: ['longtask'] });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!window.__cpHr7.paint) window.__cpHr7.paint = +(e.startTime).toFixed(1);
    }).observe({ entryTypes: ['paint'] });
  } catch (e) {}
` });

const navStart = Date.now();
await command('Page.navigate', { url: appUrl });

// Menu interactive: menu screen visible with a clickable button surface.
let menuInteractiveMs = null;
for (let i = 0; i < 200; i++) {
  const ok = await evaluate(`(() => {
    const m = document.getElementById('menu-screen');
    if (!m || m.classList.contains('hidden')) return false;
    const b = m.querySelector('button');
    return !!(b && b.getBoundingClientRect().width > 10);
  })()`).catch(() => false);
  if (ok) { menuInteractiveMs = Date.now() - navStart; break; }
  await sleep(100);
}

// Let the active Arsenal product and selection warmup settle.
await sleep(9000);

const warmup = await evaluate(`(() => {
  const w = window.__cpHr7;
  const res = performance.getEntriesByType('resource');
  const game = res.filter(r => /\\/game\\//.test(r.name));
  return {
    firstPaintMs: w.paint,
    longTaskCount: w.longTasks.length,
    longTaskTotalMs: +w.longTasks.reduce((a, b) => a + b.dur, 0).toFixed(1),
    longTasks: w.longTasks,
    gameScripts: game.length,
    gameScriptEvalMs: +game.reduce((a, b) => a + b.duration, 0).toFixed(1),
    gameScriptTransferKB: +(game.reduce((a, b) => a + (b.transferSize || 0), 0) / 1024).toFixed(1),
    warmupGroupReady: {
      arsenalProduct: window.__apexDeferredRuntimesReady_arsenalProduct === true,
      select: window.__apexDeferredRuntimesReady_select === true,
    },
    transition: window.__apexArsenalTransition ? {
      state: window.__apexArsenalTransition.state,
      lastDurationMs: window.__apexArsenalTransition.lastDurationMs,
    } : null,
  };
})()`);

// Enter Bot Battle through the real product card and physical CDP pointer input.
const productT0 = Date.now();
const productCard = await evaluate(`(() => {
  const card = document.querySelector('#menu-screen [data-product-surface="bot-battle"]');
  if (!card || card.disabled) return null;
  const r = card.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`);
if (!productCard) throw new Error('active Bot Battle card was not found or was disabled');
await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: productCard.x, y: productCard.y, button: 'left', clickCount: 1 });
await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: productCard.x, y: productCard.y, button: 'left', clickCount: 1 });
let productEntryMs = null;
for (let i = 0; i < 120; i++) {
  const ready = await evaluate(`(() => {
    const picker = document.getElementById('select-screen');
    return !!picker && !picker.classList.contains('hidden');
  })()`).catch(() => false);
  if (ready) { productEntryMs = Date.now() - productT0; break; }
  await sleep(50);
}
const barrier = await evaluate(`(() => ({
  syncBarrier: typeof window.apexArsenalGameplayBarrierSync === 'function'
    ? window.apexArsenalGameplayBarrierSync('match') : null,
  transition: window.__apexArsenalTransition ? {
    state: window.__apexArsenalTransition.state,
    lastDurationMs: window.__apexArsenalTransition.lastDurationMs,
  } : null,
  productReady: window.__apexDeferredRuntimesReady_arsenalProduct === true,
}))()`);

const out = {
  label, appUrl, at: new Date().toISOString(),
  menuInteractiveMs, productEntryMs, warmup, barrier,
};
mkdirSync(evidenceDir, { recursive: true });
const file = join(evidenceDir, 'arsenal-product-load-measure.json');
let all = {};
try { all = JSON.parse(readFileSync(file, 'utf8')); } catch {}
all[label] = out;
writeFileSync(file, JSON.stringify(all, null, 2));
console.log('Arsenal product measure', label, JSON.stringify({
  menuInteractiveMs, productEntryMs, productReady: barrier.productReady,
  longTasks: warmup.longTaskCount, longTaskTotalMs: warmup.longTaskTotalMs,
  gameScripts: warmup.gameScripts, gameScriptEvalMs: warmup.gameScriptEvalMs,
}, null, 1));

try { chrome.kill(); } catch {}
try { socket.close(); } catch {}
process.exit(0);
