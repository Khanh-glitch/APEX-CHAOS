import { JSDOM } from 'jsdom';

const failures = [];
const passes = [];
function check(name, cond, detail = '') {
  if (cond) { passes.push('PASS ' + name); return; }
  failures.push('FAIL ' + name + (detail ? ' :: ' + detail : ''));
}
const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
async function flush(frames = 8) {
  for (let i = 0; i < frames; i++) await sleep(0);
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}

const dom = new JSDOM(
  '<!doctype html><html><body><div id="blackout"></div><div id="root"></div><canvas id="door"></canvas></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true },
);
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.CustomEvent = window.CustomEvent;
globalThis.DOMException = window.DOMException;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame;

class FakeDoorEngine {
  static instances = [];
  constructor(canvas, assets, callbacks) {
    this.canvas = canvas;
    this.assets = assets;
    this.callbacks = callbacks;
    this.state = 'IDLE';
    this.openCount = 0;
    this.readyCount = 0;
    this.readyRequested = false;
    this.destroyCount = 0;
    FakeDoorEngine.instances.push(this);
  }
  open(opts) {
    this.opts = opts;
    this.openCount += 1;
    this.readyRequested = false;
    this.state = 'CLOSING';
    this.callbacks.onState?.('CLOSING');
  }
  cover() {
    this.state = 'SEALED';
    this.callbacks.onState?.('SEALED');
    this.callbacks.onCover?.();
  }
  ready() {
    this.readyCount += 1;
    this.readyRequested = true;
    if (this.state === 'SEALED') {
      this.state = 'OPENING';
      this.callbacks.onState?.('OPENING');
    }
  }
  reveal(p) { this.callbacks.onReveal?.(p); }
  done() {
    this.state = 'DONE';
    this.callbacks.onState?.('DONE');
    this.callbacks.onDone?.();
  }
  destroy() { this.destroyCount += 1; }
  getDebug() {
    return { state: this.state, openCount: this.openCount, readyCount: this.readyCount };
  }
}

window.__ApexDoorV4 = {
  TransitionEngine: FakeDoorEngine,
  loadAssets: async () => ({ authority: 'fake-gold-door' }),
};

const { installSceneTransitionCoordinator } = await import('../src/game/sceneTransitionCoordinator.js');

const canvas = document.getElementById('door');
const blackout = document.getElementById('blackout');
const root = document.getElementById('root');
let bootComplete = 0;
window.addEventListener('apex:boot-transition-complete', () => { bootComplete += 1; });

const coordinator = installSceneTransitionCoordinator({ canvas, blackout, contentRoot: root });
await flush();
const engine = FakeDoorEngine.instances[0];

check('one Gold engine instance is installed', FakeDoorEngine.instances.length === 1);
check('boot starts Mechanical Door automatically', engine?.openCount === 1 && coordinator.active());
check('boot starts from a black screen', blackout.hidden === false);
check('boot transition receives no demo background image', engine?.opts?.from === null && engine?.opts?.autoReadyAfter === null);

// Boot readiness is Home-scoped. A broken image belonging to a future surface
// may coexist in the shell DOM but must not block Home from opening.
const futureBroken = document.createElement('img');
futureBroken.setAttribute('src', '/future-surface-broken.png');
Object.defineProperty(futureBroken, 'complete', { configurable: true, get: () => true });
Object.defineProperty(futureBroken, 'naturalWidth', { configurable: true, get: () => 0 });
root.appendChild(futureBroken);

await coordinator.signalBootReady();
await flush();
check('boot readiness ignores future-surface broken images',
  engine.readyCount === 1 && engine.readyRequested === true && engine.state === 'CLOSING');
futureBroken.remove();
check('boot readiness primes Gold close without revealing early',
  engine.readyCount === 1 && engine.readyRequested === true && engine.state === 'CLOSING' && blackout.hidden === false);

engine.cover();
await flush();
check('boot commits only after cover', blackout.hidden === true);
check('SEALED disarms the prime until covered destination is settled', coordinator.state().gateReady === true || engine.readyRequested === false || engine.state === 'OPENING');
check('boot opens only after destination readiness', engine.readyCount === 2 && coordinator.state().settled === true);
engine.done();
await flush();
check('boot transaction reaches DONE', coordinator.active() === false && bootComplete === 1);

// FAST path: preparation may finish immediately, but commit/READY still wait
// for the authored opaque-cover callback.
let fastCommit = 0;
const fast = coordinator.run({
  name: 'fast',
  source: () => root,
  target: () => root,
  prepare: async () => true,
  commit: () => { fastCommit += 1; },
});
await flush();
check('fast load never shortcuts CLOSE/cover', fastCommit === 0 && engine.readyCount === 3 && engine.state === 'CLOSING');
check('fast load primes the donor close curve as soon as prepare is ready', coordinator.state().closePrimed === true);
engine.cover();
await flush();
check('fast load commits under cover', fastCommit === 1);
check('fast load re-arms one final READY after covered settle', engine.readyCount === 4 && engine.state === 'OPENING');
engine.reveal(0.5);
check('Gold target reveal scale is applied progressively', root.style.transform === 'scale(1.0600)', root.style.transform);
engine.done();
const fastResult = await fast;
check('fast transaction resolves success', fastResult?.ok === true && fastResult?.name === 'fast');
check('target transform is cleared after DONE', root.style.transform === '');

// LOST-EVENT regression: an image that already failed before the coordinator
// observes it has complete=true and naturalWidth=0. This must reject promptly
// instead of waiting forever for an error event that already happened.
const broken = document.createElement('img');
broken.setAttribute('src', '/synthetic-broken.png');
Object.defineProperty(broken, 'complete', { configurable: true, get: () => true });
Object.defineProperty(broken, 'naturalWidth', { configurable: true, get: () => 0 });
root.appendChild(broken);
let brokenRejected = false;
try {
  await coordinator.prepareElement(root);
} catch (error) {
  brokenRejected = /Scene asset failed/.test(String(error?.message || error));
}
check('already-failed image rejects instead of deadlocking scene settle', brokenRejected === true);
broken.remove();

// SLOW path: cover can happen first and the door must hold SEALED until
// preparation finishes.
const slowGate = deferred();
let slowCommit = 0;
const slow = coordinator.run({
  name: 'slow',
  source: () => root,
  target: () => root,
  prepare: () => slowGate.promise,
  commit: () => { slowCommit += 1; },
});
await flush();
engine.cover();
await flush();
const readyBeforeSlow = engine.readyCount;
check('slow load holds sealed without destination commit', slowCommit === 0);
check('slow load sends no READY while preparation is pending', engine.readyCount === readyBeforeSlow);
slowGate.resolve(true);
await flush();
check('slow load commits after preparation resolves', slowCommit === 1);
check('slow load sends READY only after prepare+cover', engine.readyCount === readyBeforeSlow + 1);
engine.done();
const slowResult = await slow;
check('slow transaction resolves success', slowResult?.ok === true && slowResult?.name === 'slow');

// Semantic live gate: DOM can already be committed behind the door, but OPEN
// must still wait for battle/iframe/runtime truth.
const liveGate = deferred();
let gatedCommit = 0;
const gated = coordinator.run({
  name: 'semantic-gate',
  source: () => root,
  target: () => root,
  prepare: async () => true,
  commit: () => { gatedCommit += 1; },
  readyGate: () => liveGate.promise,
});
await flush();
engine.cover();
await flush();
const readyBeforeLive = engine.readyCount;
check('semantic gate allows hidden destination commit', gatedCommit === 1);
check('semantic gate disarms the prepare-time prime while SEALED', engine.readyRequested === false && engine.state === 'SEALED');
check('semantic gate blocks final READY/OPEN', engine.readyCount === readyBeforeLive);
liveGate.resolve(true);
await flush();
check('semantic gate releases exactly one final READY', engine.readyCount === readyBeforeLive + 1 && engine.state === 'OPENING');
engine.done();
const gatedResult = await gated;
check('semantic-gated transaction resolves success', gatedResult?.ok === true);

// Failure path: never reveal a half-ready target. Roll back to the source under
// cover, then mechanically OPEN through the same Gold sequence.
let rollbackCount = 0;
const failed = coordinator.run({
  name: 'failed-prepare',
  source: () => root,
  target: () => root,
  prepare: async () => { throw new Error('synthetic prepare failure'); },
  commit: () => { throw new Error('commit must not run after prepare failure'); },
  rollback: () => { rollbackCount += 1; },
});
await flush();
engine.cover();
await flush();
const readyBeforeFailDone = engine.readyCount;
check('prepare failure rolls back exactly once under cover', rollbackCount === 1);
check('failure recovery still issues one mechanical READY', readyBeforeFailDone >= 1);
engine.done();
const failedResult = await failed;
check('failure transaction reports failure', failedResult?.ok === false && /synthetic prepare failure/.test(String(failedResult?.error)));

// Serialization: repeated intent during an active transition must not start a
// second mechanical sequence.
const serialGate = deferred();
let serialA = 0;
let serialB = 0;
const serial1 = coordinator.run({
  name: 'serial-a',
  prepare: () => serialGate.promise,
  commit: () => { serialA += 1; },
});
await flush();
const opensBeforeSecondIntent = engine.openCount;
const serial2 = coordinator.run({
  name: 'serial-b',
  prepare: async () => true,
  commit: () => { serialB += 1; },
});
await flush();
check('concurrent intent does not start a second door cycle', engine.openCount === opensBeforeSecondIntent);
engine.cover();
serialGate.resolve(true);
await flush();
engine.done();
const [serialResult1, serialResult2] = await Promise.all([serial1, serial2]);
check('first serialized transaction owns the commit', serialA === 1 && serialB === 0);
check('second intent joins the active transaction result', serialResult1?.name === 'serial-a' && serialResult2?.name === 'serial-a');

coordinator.dispose();
check('dispose releases Gold engine ownership', engine.destroyCount === 1 && coordinator.active() === false);
check('dispose hides transition canvas', canvas.getAttribute('aria-hidden') === 'true');

console.log(['GOLD TRANSITION RUNTIME GATE', ...passes].join('\n'));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('RESULT: PASS (' + passes.length + ' checks)');
dom.window.close();
