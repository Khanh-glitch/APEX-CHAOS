// =============================================================================
// SCENE INPUT-LOCK LAW GATE (owner law 2026-10-06)
//
// The frozen-scene report ("Lucky Draw is still frozen", "the Mode cards do
// nothing") was measured, not guessed: the Mechanical Door's transaction held
// `body.apex-scene-transition-active` for its WHOLE lifetime, and the shell CSS
// turned that class into `pointer-events:none` on #gold-shell-host and
// #battle-shell. Everything inside those hosts - Mode cards, Fighter Pick,
// the Lucky Draw donor iframe, the Battle HUD - was therefore physically
// unclickable until the door's own frame clock reached DONE. On a starved
// renderer (the engine clamps frame dt, so a 1.68s authored opening can stretch
// far past a second) that is an input-dead product.
//
// Three laws replace that:
//   L1  the input lock belongs to the COVER, not to the transaction;
//   L2  after the committed destination is handed to the door (READY) the door
//       owns only its authored reveal - a bounded wall-clock window;
//   L3  the stall guard measures the door's OWN liveness, not numeric wiggle
//       (holdTime used to grow while the render loop was dead, which is how a
//       frozen door kept resetting its own watchdog).
// =============================================================================
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const failures = [];
const passes = [];
function check(name, cond, detail = '') {
  if (cond) { passes.push('PASS ' + name); return; }
  failures.push('FAIL ' + name + (detail ? ' :: ' + detail : ''));
}

const css = fs.readFileSync('src/styles.css', 'utf8');
const coordinatorSrc = fs.readFileSync('src/game/sceneTransitionCoordinator.js', 'utf8');

// ── L1: the lock is scoped to the covering phases ────────────────────────────
const lockBlock = (() => {
  const marker = 'body.apex-scene-transition-active[data-apex-scene-transition="CLOSING"] #gold-shell-host';
  const ruleStart = css.indexOf(marker);
  if (ruleStart < 0) return '';
  const ruleEnd = css.indexOf('{', ruleStart);
  return ruleEnd > ruleStart ? css.slice(ruleStart, ruleEnd) : '';
})();
check('the shell lock is the rule this law is about', lockBlock.length > 0);
const lockSelectors = lockBlock.split(',').map((s) => s.trim()).filter(Boolean);
check('shell input lock exists at all', lockSelectors.length >= 2, lockBlock.slice(0, 200));
check('input lock names the COVER phase (CLOSING)',
  lockSelectors.some((s) => /\[data-apex-scene-transition="CLOSING"\]/.test(s) && /#gold-shell-host$/.test(s))
  && lockSelectors.some((s) => /\[data-apex-scene-transition="CLOSING"\]/.test(s) && /#battle-shell$/.test(s)),
  lockBlock.slice(0, 240));
check('input lock names the SEALED hold',
  lockSelectors.some((s) => /\[data-apex-scene-transition="SEALED"\]/.test(s) && /#gold-shell-host$/.test(s))
  && lockSelectors.some((s) => /\[data-apex-scene-transition="SEALED"\]/.test(s) && /#battle-shell$/.test(s)),
  lockBlock.slice(0, 240));
check('input lock never names the revealing phase',
  !/\[data-apex-scene-transition="(OPENING|DONE)"\]/.test(lockBlock) && !/\[data-apex-scene-transition="IDLE"\]/.test(lockBlock));
check('no unscoped transition-wide shell lock remains',
  !/body\.apex-scene-transition-active\s+#gold-shell-host\s*[,{]/.test(css)
  && !/body\.apex-scene-transition-active\s+#battle-shell\s*[,{]/.test(css),
  'a transition-wide lock is what froze the scene surface');
check('the phase signal the CSS reads is the one the coordinator publishes',
  coordinatorSrc.includes("document.body.dataset.apexSceneTransition = state || 'IDLE'")
  && coordinatorSrc.includes("bodyState('CLOSING')"));

// ── L2: a bounded reveal window after READY ─────────────────────────────────
check('reveal window is a declared policy, not a magic number',
  coordinatorSrc.includes('revealGraceMs = 4000') && coordinatorSrc.includes('REVEAL_GRACE_MS')
  && coordinatorSrc.includes('revealGraceMs: REVEAL_GRACE_MS'));
check('reveal window is measured from the engine OWN opening state',
  coordinatorSrc.includes("debug.state === 'OPENING'") && coordinatorSrc.includes('tx.openingAt = now')
  && coordinatorSrc.includes('revealOverdue'));
check('a door that overstays its reveal window fail-opens the scene',
  /revealOverdue\) \{[\s\S]{0,900}releaseCover\(\);[\s\S]{0,120}finish\(false\)/.test(coordinatorSrc));

// ── L4: a destination that cannot render yet never gates READY ─────────────
check('a non-rendered destination document is detected, not assumed',
  coordinatorSrc.includes('const documentIsRendered = (doc)')
  && coordinatorSrc.includes("doc.visibilityState === 'hidden'")
  && coordinatorSrc.includes('frame.getClientRects().length === 0'));
check('paint verification moves to the live parent when the destination is hidden',
  coordinatorSrc.includes('const paintView = rendered ? view :')
  && coordinatorSrc.includes('view.frameElement?.ownerDocument?.defaultView'));
check('a hidden destination never awaits its own font faces',
  /if \(rendered\) \{\s*try \{ await doc\?\.fonts\?\.ready; \} catch \(_\) \{\}/.test(coordinatorSrc));
check('requested media is still verified for a hidden destination',
  coordinatorSrc.includes('if (verifyImages) await decodeLoadedImages(root);')
  && coordinatorSrc.indexOf('if (verifyImages) await decodeLoadedImages(root);') < coordinatorSrc.indexOf('const rendered = documentIsRendered(doc);'));

// ── L5: a prepared destination survives a broken door ──────────────────────
check('a forced recovery marks the missing cover instead of skipping the commit',
  coordinatorSrc.includes('const forceCommit = () =>') && coordinatorSrc.includes('tx.coverFailed = true')
  && coordinatorSrc.includes('(!tx.covered && !tx.coverFailed)'));
check('a forced recovery commits instead of rolling the scene back',
  coordinatorSrc.includes('tx.forced = true') && coordinatorSrc.includes('if (tx.failed && !tx.forced)'));
check('a dead door never cuts a destination that is still preparing',
  coordinatorSrc.includes('const doorDead = stalledFor >= STALL_MS && (tx.prepared || age >= HARD_CAP_MS)')
  && coordinatorSrc.includes('if (doorDead || age >= HARD_CAP_MS || revealOverdue)'));
check('every watchdog release hands the prepared destination over first',
  /console\.warn\(`\[scene-transition\] \$\{reason\}; releasing the scene surface\.`\);[\s\S]{0,220}forceCommit\(\);[\s\S]{0,80}releaseCover\(\);[\s\S]{0,40}finish\(false\)/.test(coordinatorSrc));

// ── L3: liveness, not numeric wiggle ────────────────────────────────────────
check('stall signature no longer counts holdTime as progress',
  !/watchdogSignature = .*holdTime/.test(coordinatorSrc) && !/signature = debug \? `[^`]*holdTime/.test(coordinatorSrc));
check('stall signature reads the door wall clock',
  /signature = debug[\s\S]{0,120}debug\.wallTime/.test(coordinatorSrc));

// ── behaviour fixtures ─────────────────────────────────────────────────────
const dom = new JSDOM(
  '<!doctype html><html><body><div id="blackout" hidden></div><div id="root"></div><canvas id="door"></canvas></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true },
);
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.CustomEvent = window.CustomEvent;
globalThis.DOMException = window.DOMException;
window.requestAnimationFrame = globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
window.cancelAnimationFrame = globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// A faithful-enough Mechanical Door: the coordinator's OWN prime/cover/READY
// handshake drives it, and its clock only moves when the fixture says so.
class FakeDoorEngine {
  static instances = [];
  constructor(canvas, assets, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.state = 'IDLE';
    this.wallTime = 0;
    this.readyRequested = false;
    this.destroyCount = 0;
    FakeDoorEngine.instances.push(this);
  }
  open() { this.state = 'CLOSING'; this.callbacks.onState?.('CLOSING'); }
  frame(ms) { this.wallTime += ms; }
  cover() {
    this.state = 'SEALED';
    this.callbacks.onState?.('SEALED');
    this.callbacks.onCover?.();
    // The real engine opens straight out of the sealed hold once READY has been
    // requested (Gold: `s === 'SEALED' && readyRequested && t >= sealedMin`).
    if (this.readyRequested) { this.state = 'OPENING'; this.callbacks.onState?.('OPENING'); }
  }
  ready() {
    this.readyRequested = true;
    if (this.state === 'SEALED') { this.state = 'OPENING'; this.callbacks.onState?.('OPENING'); }
  }
  done() { this.state = 'DONE'; this.callbacks.onState?.('DONE'); this.callbacks.onDone?.(); }
  destroy() { this.destroyCount += 1; }
  getDebug() { return { state: this.state, wallTime: this.wallTime }; }
}

const { installSceneTransitionCoordinator } = await import('../src/game/sceneTransitionCoordinator.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flush = async (n = 6) => { for (let i = 0; i < n; i += 1) await sleep(0); };
const latest = () => FakeDoorEngine.instances[FakeDoorEngine.instances.length - 1];

// Boots every fresh installation: the coordinator starts `boot->home` itself.
async function settleBoot(engine, signal) {
  await signal();
  await flush();
  engine.cover();
  await flush();
  engine.done();
  await flush();
}

// ── behaviour A: an alive-but-slow door must fail open ─────────────────────
window.__ApexDoorV4 = { TransitionEngine: FakeDoorEngine, loadAssets: async () => ({ authority: 'law-gate-a' }) };
const alive = installSceneTransitionCoordinator({
  canvas: document.getElementById('door'),
  blackout: document.getElementById('blackout'),
  contentRoot: document.getElementById('root'),
  stallGuardMs: 100000,
  hardCapMs: 200000,
  revealGraceMs: 150,
});
await flush();
const bootEngineA = latest();
await settleBoot(bootEngineA, alive.signalBootReady);
check('the reveal window is reported as guard policy',
  alive.guard().revealGraceMs === 150, JSON.stringify(alive.guard()));

// The renderer is alive: frames keep arriving, the door simply never finishes.
const heartbeat = setInterval(() => latest().frame(16), 20);
let committed = 0;
const slow = alive.run({
  name: 'slow-reveal',
  source: () => document.getElementById('root'),
  target: () => document.getElementById('root'),
  prepare: async () => true,
  commit: () => { committed += 1; },
});
await flush();
const slowEngine = latest();
slowEngine.cover();
await flush();
check('the destination commits while the door covers',
  committed === 1 && slowEngine.state === 'OPENING', JSON.stringify({ committed, state: slowEngine.state }));
await sleep(60); // let the heartbeat deliver real frames before judging liveness
check('the door really is alive (frames keep arriving)', slowEngine.wallTime > 0, String(slowEngine.wallTime));
let released = false;
for (let i = 0; i < 80 && !released; i += 1) { await sleep(20); released = alive.active() === false; }
const slowResult = await slow;
clearInterval(heartbeat);
check('a door that outlives its reveal window is fail-opened', released,
  JSON.stringify({ state: slowEngine.state, wallTime: slowEngine.wallTime, active: alive.active() }));
check('the fail-open is reported to the caller instead of hanging',
  slowResult?.ok === false && /still-opening door/.test(String(slowResult?.error)), JSON.stringify(slowResult?.error));
check('the input-lock class is gone after the recovery',
  !document.body.classList.contains('apex-scene-transition-active'), document.body.className);
check('the published phase is not left mid-transition',
  document.body.dataset.apexSceneTransition === 'DONE', String(document.body.dataset.apexSceneTransition));
check('the recovered scene hides the stuck door instead of leaving it on screen',
  slowEngine.destroyCount >= 1 || document.getElementById('door').style.display === 'none');
alive.dispose();

// ── behaviour B: a dead render loop still trips the stall guard ────────────
delete window.APEX_SCENE_TRANSITION;
window.__ApexDoorV4 = { TransitionEngine: FakeDoorEngine, loadAssets: async () => ({ authority: 'law-gate-b' }) };
const strict = installSceneTransitionCoordinator({
  canvas: document.getElementById('door'),
  blackout: document.getElementById('blackout'),
  contentRoot: document.getElementById('root'),
  stallGuardMs: 200,
  hardCapMs: 1400,
  revealGraceMs: 100000, // the reveal budget may NOT rescue a frozen door
});
await flush();
await settleBoot(latest(), strict.signalBootReady);
let frozenCommitted = 0;
const frozen = strict.run({
  name: 'frozen-before-ready',
  source: () => document.getElementById('root'),
  target: () => document.getElementById('root'),
  prepare: () => new Promise(() => {}),
  commit: () => { frozenCommitted += 1; },
});
await flush();
const frozenEngine = latest();
let stalledRecovered = false;
for (let i = 0; i < 200 && !stalledRecovered; i += 1) { await sleep(20); stalledRecovered = strict.active() === false; }
const frozenResult = await frozen;
check('a door that cannot draw any frame is released by the stall guard', stalledRecovered,
  JSON.stringify({ state: frozenEngine.state, wallTime: frozenEngine.wallTime, active: strict.active() }));
check('the stall recovery is named in the transaction result',
  frozenResult?.ok === false && /no progress/.test(String(frozenResult?.error)), JSON.stringify(frozenResult?.error));
check('no lock survives the stall recovery', !document.body.classList.contains('apex-scene-transition-active'));
check('a destination that never prepared is not committed behind its back', frozenCommitted === 0,
  String(frozenCommitted));

// A slow-but-working destination must not be cut by the dead door; once it is
// prepared the recovery commits it. This is the measured Lucky Draw ordering.
let slowPrepareCommitted = 0;
const slowPrepared = strict.run({
  name: 'slow-prepare-dead-door',
  source: () => document.getElementById('root'),
  target: () => document.getElementById('root'),
  prepare: () => new Promise((resolve) => setTimeout(resolve, 700)),
  commit: () => { slowPrepareCommitted += 1; },
});
await sleep(450); // past the stall budget, before prepare lands
check('the dead door is held while the destination is still preparing',
  strict.active() === true && slowPrepareCommitted === 0,
  JSON.stringify({ active: strict.active(), slowPrepareCommitted }));
const settledSlow = (async () => { for (let i = 0; i < 200; i += 1) { if (strict.active() === false) return true; await sleep(20); } return false; })();
check('the slow destination is committed once it is ready', (await settledSlow) && slowPrepareCommitted === 1,
  JSON.stringify({ slowPrepareCommitted, active: strict.active() }));
check('the slow-prepare recovery is reported too', (await slowPrepared)?.ok === false);

// A destination that DID prepare must appear even when the door never covers:
// this is the frozen Lucky Draw path (door starved while the bay was ready).
let preparedCommitted = 0;
const resurrected = strict.run({
  name: 'prepared-but-never-covered',
  source: () => document.getElementById('root'),
  target: () => document.getElementById('root'),
  prepare: async () => true,
  commit: () => { preparedCommitted += 1; },
});
// Wait for the transaction to actually own the door before judging its
// recovery - `active()` is false in the window before startTransaction begins.
for (let i = 0; i < 200 && strict.state()?.name !== 'prepared-but-never-covered'; i += 1) await sleep(20);
let rescued = false;
for (let i = 0; i < 200 && !rescued; i += 1) { await sleep(20); rescued = strict.active() === false; }
const rescuedResult = await resurrected;
check('a prepared destination is committed even when the door never covered', rescued && preparedCommitted === 1,
  JSON.stringify({ rescued, preparedCommitted }));
check('the rescued scene reports the recovery to its caller', rescuedResult?.ok === false,
  JSON.stringify(rescuedResult?.error));

// ── behaviour: a hidden destination document must not gate READY ───────────
const parentDoc = document;
let parentFrames = 0;
const realRaf = parentDoc.defaultView.requestAnimationFrame;
parentDoc.defaultView.requestAnimationFrame = (cb) => { parentFrames += 1; return realRaf(cb); };
const hiddenFrame = parentDoc.createElement('iframe');
parentDoc.body.appendChild(hiddenFrame);
hiddenFrame.style.display = 'none';
let childFontsAwaited = 0;
const childWin = hiddenFrame.contentWindow;
if (childWin) {
  Object.defineProperty(childWin.document, 'fonts', {
    configurable: true,
    get: () => ({ get ready() { childFontsAwaited += 1; return new Promise(() => {}); } }),
  });
  childWin.requestAnimationFrame = () => 0; // a hidden document services no frames
}
const childRoot = childWin ? childWin.document.documentElement : null;
let settled = false;
if (childRoot) {
  const settle = (await import('../src/game/sceneTransitionCoordinator.js')).settleSceneElement(childRoot);
  settle.then(() => { settled = true; });
  for (let i = 0; i < 100 && !settled; i += 1) await sleep(20);
}
parentDoc.defaultView.requestAnimationFrame = realRaf;
check('a hidden destination document settles instead of parking the door', settled,
  JSON.stringify({ settled, childFontsAwaited, parentFrames }));
check('the hidden destination never awaited its own font faces', childFontsAwaited === 0, String(childFontsAwaited));
check('the live parent surface is the one whose painted frame gates READY', parentFrames >= 2, String(parentFrames));
strict.dispose();

console.log(['SCENE INPUT-LOCK LAW GATE', ...passes].join('\n'));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('RESULT: PASS (' + passes.length + ' checks)');
dom.window.close();
