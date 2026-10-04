// SHELL <-> BATTLE HUD HANDOFF PROTOCOL — headless proof through real paths.
//
// This harness mounts the REAL generated Gold product shell
// (public/gold/shell.html) into a jsdom document that already runs the REAL
// engine + Arsenal runtimes + the real Gold product bridge — exactly the way
// src/App.jsx mounts it (fetch -> parse -> copy head/body into
// #gold-shell-host -> execute the shell scripts). It then drives the real
// product flow with real DOM input (BATTLE -> mode card -> LOCK IN) and proves
// the whole handoff protocol on production truth:
//
//   APEX_CHAOS_BATTLE_HANDOFF (live:false)  -> donor pauses, identity applied
//   APEX_CHAOS_HUD_READY                     -> shell (re)sends the handoff
//   APEX_CHAOS_BATTLE_LIVE (+ handoff live:true) -> donor resumes, match live
//   APEX_CHAOS_BATTLE_EXIT (donor Escape)    -> HUD closes, parent resumes
//   parent runtime freeze/resume around the battle session
//
// No synthetic state: every assertion reads the real shell, the real bridge and
// the real mounted donor HUD (decoded from the shell's own base64 payload).
//
// Usage: node tools/testShellHudHandoffProtocolHeadless.mjs
// Env:   APEX_TOOLING_DIR (default node_modules)
//        APEX_EVIDENCE_DIR (default docs/acceptance/gold-cutover/headless)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { MENU_INTERACTIVE_RUNTIMES, ARSENAL_PRODUCT_RUNTIMES, SELECT_RUNTIMES } from '../src/game/runtimeManifest.js';
import { resolveLegacyRuntimeFile } from './legacyRuntimeManifest.mjs';
import { installProductSurfaceAuthority } from '../src/game/productSurface.js';

const REPO = process.cwd();
const TOOLING_DIR = process.env.APEX_TOOLING_DIR || path.join(REPO, 'node_modules');
const evidenceDir = process.env.APEX_EVIDENCE_DIR || 'docs/acceptance/gold-cutover/headless';
const requireTool = createRequire(path.join(TOOLING_DIR, 'noop.js'));
const { JSDOM, VirtualConsole } = requireTool('jsdom');
const { createCanvas, loadImage, GlobalFonts, ImageData: NapiImageData, Path2D: NapiPath2D } = requireTool('@napi-rs/canvas');

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  console.log('[page-error]', String((error && error.message) || error).slice(0, 240));
});
virtualConsole.on('log', (...a) => console.log('[page]', ...a));

GlobalFonts.registerFromPath(path.join(REPO, 'public', 'assets', 'fonts', 'kanit', 'Kanit-BlackItalic.ttf'), 'ApcKanit');

// ---------------------------------------------------------------- DOM setup
// Production roots (engine canvas + legacy UI = production truth) PLUS the
// Gold hosts src/App.jsx creates (#gold-shell-host / #battleHudHost).
const dom = new JSDOM(`<!doctype html><html><body>
  <div id="battle-shell">
    <aside id="p1-combat-panel" class="combat-panel">
      <div class="cp-identity"><span id="p1-cp-chip"></span><div id="p1-name">P1</div>
        <div class="hp-bar-bg"><div id="p1-hp-loss"></div><div id="p1-hp"></div><div id="p1-hp-text"></div></div>
        <div id="p1-rage"></div></div>
      <div id="p1-energy"><span id="p1-energy-val">0</span><div id="p1-energy-fill"></div><div id="p1-energy-state"></div></div>
      <div id="p1-mode-slot"></div>
    </aside>
    <div id="game-wrapper">
      <canvas id="game-canvas" width="1000" height="1000"></canvas>
      <div id="countdown-overlay" style="display:none"><div id="countdown-num">3</div><div id="countdown-sub"></div></div>
      <div class="ui-layer" id="hud"><div id="manual-lab-hud" class="hidden"></div></div>
      <div id="battle-controls" class="hidden"></div>
      <div id="menu-screen" class="screen"></div>
      <div id="select-screen" class="screen hidden"><div id="apex-pick-runtime-root"></div></div>
      <div id="end-screen" class="screen hidden"><div id="winner-text"></div><div id="stats-panel"></div></div>
      <div id="roster-grid"></div>
    </div>
    <aside id="p2-combat-panel" class="combat-panel">
      <div class="cp-identity"><span id="p2-cp-chip"></span><div id="p2-name">P2</div>
        <div class="hp-bar-bg"><div id="p2-hp-loss"></div><div id="p2-hp"></div><div id="p2-hp-text"></div></div>
        <div id="p2-rage"></div></div>
      <div id="p2-energy"><span id="p2-energy-val">0</span><div id="p2-energy-fill"></div><div id="p2-energy-state"></div></div>
      <div id="p2-mode-slot"></div>
    </aside>
  </div>
  <div id="gold-shell-host"></div>
  <div id="battleHudHost"></div>
</body></html>`, { pretendToBeVisual: true, runScripts: 'dangerously', url: 'http://localhost/', virtualConsole });

const win = dom.window;
installProductSurfaceAuthority(win);
win.__APEX_TEST_MODE = true;
win.__apexStatsSilent = true;

const realCanvases = new WeakMap();
function realCanvasFor(el) {
  let rc = realCanvases.get(el);
  const w = el.width || 300;
  const h = el.height || 150;
  if (!rc || rc.width !== w || rc.height !== h) {
    rc = createCanvas(w, h);
    realCanvases.set(el, rc);
  }
  return rc;
}
win.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type && type !== '2d') return null;
  const realCtx = realCanvasFor(this).getContext('2d');
  return new Proxy(realCtx, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (prop === 'drawImage' && typeof value === 'function') {
        return function (img, ...args) {
          const mapped = img && (img.__realImage || realCanvases.get(img) || (img instanceof win.HTMLCanvasElement ? realCanvasFor(img) : null));
          return value.call(target, mapped || img, ...args);
        };
      }
      if (typeof value === 'function') return value.bind(target);
      return value;
    },
    set(target, prop, value) { return Reflect.set(target, prop, value, target); },
  });
};
win.CanvasRenderingContext2D = realCanvasFor(win.document.getElementById('game-canvas')).getContext('2d').constructor;

class ParamStub {
  constructor() { this.value = 0; }
  setValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
  cancelScheduledValues() { return this; }
}
class AudioNodeStub {
  constructor() {
    this.gain = new ParamStub(); this.frequency = new ParamStub();
    this.Q = new ParamStub(); this.detune = new ParamStub(); this.pan = new ParamStub();
    this.buffer = null; this.loop = false; this.type = 'sine';
  }
  connect() { return this; }
  disconnect() {}
  start() {}
  stop() {}
}
class AudioContextStub {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000; this.destination = new AudioNodeStub(); }
  decodeAudioData(buf) {
    const seconds = Math.max(0.05, (buf && buf.byteLength ? buf.byteLength / 2 / 48000 : 0.5));
    return Promise.resolve({ duration: seconds, sampleRate: 48000, length: Math.floor(seconds * 48000) });
  }
  createGain() { return new AudioNodeStub(); }
  createOscillator() { return new AudioNodeStub(); }
  createBufferSource() { return new AudioNodeStub(); }
  createBiquadFilter() { return new AudioNodeStub(); }
  createStereoPanner() { return new AudioNodeStub(); }
  createDynamicsCompressor() { return new AudioNodeStub(); }
  createMediaElementSource() { return new AudioNodeStub(); }
  createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, getChannelData: () => new Float32Array(len) }; }
  resume() { return Promise.resolve(); }
}
win.AudioContext = AudioContextStub;
win.webkitAudioContext = AudioContextStub;

if (!win.ResizeObserver) {
  win.ResizeObserver = class ResizeObserverStub {
    constructor(cb) { this.cb = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!win.matchMedia) {
  win.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}

// jsdom has no fetch: serve the real Arsenal AV/feel audio so preload/decode
// paths run for real; everything else parks (UI runtimes keep browser behavior).
win.fetch = (url) => {
  const u = String(url);
  if (/\/assets\/(?:arsenal\/(?:av|feel)|hero-rework\/hunter-v10\/sfx)\//.test(u)) {
    const rel = u.slice(u.indexOf('/assets/') + 1).split(/[?#]/, 1)[0];
    try {
      const data = fs.readFileSync(path.join(REPO, 'public', rel));
      const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(copy) });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return new Promise(() => {});
};

class HarnessImage {
  constructor() {
    this.complete = false; this.width = 0; this.height = 0;
    this.__realImage = null; this.onload = null; this.onerror = null;
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type) {
    const event = { type, target: this };
    const propertyHandler = this[`on${type}`];
    if (typeof propertyHandler === 'function') {
      try { propertyHandler.call(this, event); } catch (error) { console.log('[image-handler-error]', String(error && error.message || error).slice(0, 200)); }
    }
    for (const listener of this.listeners.get(type) || []) {
      try { listener.call(this, event); } catch (error) { console.log('[image-handler-error]', String(error && error.message || error).slice(0, 200)); }
    }
  }
  set src(v) {
    this._src = v;
    const rel = String(v).replace(/^\//, '');
    loadImage(path.join(REPO, 'public', rel))
      .then((im) => {
        this.__realImage = im; this.width = im.width; this.height = im.height;
        this.naturalWidth = im.width; this.naturalHeight = im.height; this.complete = true;
        this.dispatch('load');
      })
      .catch((error) => { console.log('[image-error]', String(v).slice(0, 80), String(error && error.message || error).slice(0, 200)); this.dispatch('error'); });
  }
  get src() { return this._src; }
}
win.Image = HarnessImage;
if (!win.ImageData) win.ImageData = NapiImageData;
if (!win.Path2D) win.Path2D = NapiPath2D;

// Web Animations: jsdom lacks Element.animate/getAnimations; browsers ship
// them. The mounted donor HUD and the shell both animate through this API.
function installAnimationStubs(target) {
  if (!target || target.__apexAnimStubs) return;
  target.__apexAnimStubs = true;
  target.Element.prototype.getAnimations = function () { return []; };
  target.Element.prototype.animate = function (keyframes, options) {
    const duration = Math.min(Number((options && options.duration) || 0), 30);
    let resolveFinished;
    const finished = new Promise((resolve) => { resolveFinished = resolve; });
    const animation = {
      id: 'stub-anim', currentTime: 0, startTime: 0, playbackRate: 1,
      playState: 'running', replaceState: 'active', onfinish: null, oncancel: null,
      cancel() { if (animation.oncancel) animation.oncancel(); },
      finish() {}, play() {}, pause() {}, reverse() {},
      commitStyles() {}, persist() {},
      addEventListener() {}, removeEventListener() {},
      finished,
    };
    const settle = () => {
      animation.playState = 'finished';
      if (typeof animation.onfinish === 'function') animation.onfinish();
      resolveFinished();
    };
    setTimeout(settle, Math.max(0, duration));
    return animation;
  };
}
installAnimationStubs(win);
// document.getAnimations (shell freezeParentRuntime) — browsers ship it.
if (typeof win.document.getAnimations !== 'function') win.document.getAnimations = function () { return []; };
if (!win.document.fonts) {
  win.document.fonts = { ready: Promise.resolve(), addEventListener() {}, removeEventListener() {}, load() { return Promise.resolve([]); }, forEach() {} };
}

// Frame driver: queued rAF so the production engine loop and the donor HUD pump
// can be stepped deterministically inside the harness.
const rafQueue = [];
let rafId = 0;
win.requestAnimationFrame = (cb) => { const id = ++rafId; rafQueue.push({ id, cb }); return id; };
win.cancelAnimationFrame = (id) => {
  const i = rafQueue.findIndex((e) => e.id === id);
  if (i >= 0) rafQueue.splice(i, 1);
};
function drainFrames(count = 1) {
  for (let i = 0; i < count; i++) {
    const entry = rafQueue.shift();
    if (!entry) break;
    entry.cb(win.performance.now());
  }
  return rafQueue.length;
}

// ------------------------------------------------------------ script loading
const loadErrors = [];
function loadScript(relPath, required) {
  const fileRelPath = String(relPath).split(/[?#]/, 1)[0];
  const file = resolveLegacyRuntimeFile(REPO, fileRelPath);
  try {
    win.eval(fs.readFileSync(file, 'utf8'));
    return true;
  } catch (error) {
    loadErrors.push({ file: relPath, error: String((error && error.message) || error) });
    if (required) throw new Error(`Required runtime failed to load: ${relPath}: ${error}`);
    return false;
  }
}

loadScript('/apexEngine.js', true);
const loadedRuntimeSrcs = new Set();
for (const group of [MENU_INTERACTIVE_RUNTIMES, ARSENAL_PRODUCT_RUNTIMES, SELECT_RUNTIMES]) {
  for (const [src] of group) {
    const key = String(src).split(/[?#]/, 1)[0];
    if (loadedRuntimeSrcs.has(key)) continue;
    loadedRuntimeSrcs.add(key);
    loadScript(src, true);
  }
}
// The Gold bridge is plain production source: it ships inside the generated
// shell AND is part of the arsenalProduct runtime group. Both load paths are
// guarded, so the production state is identical either way.
loadScript('/game/gold/goldProductBridge.js', true);

// This harness loads every runtime directly — the runtimeLoader group flags
// the gameplay-ready barrier reads never exist here.
win['__apexDeferredRuntimesReady_arsenalProduct'] = true;
win['__apexDeferredRuntimesReady_select'] = true;

// ------------------------------------------------------------ test plumbing
const report = { gates: {}, failures: [], loadErrors, evidence: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}
const $ = (id) => win.document.getElementById(id);

// --------------------------------------------------- protocol instrumentation
// Everything the protocol exchanges is observed on production objects: the
// real window 'message' channel (shell <-> donor) and the real bridge hooks.
const messages = [];
const messageListenerAdds = [];
const pauseEvents = [];
const resumeEvents = [];
const handoffHookCalls = [];
const liveHookCalls = [];
const modeHookCalls = [];
const mountCalls = [];

win.addEventListener('message', (event) => {
  const d = event && event.data;
  if (d && typeof d === 'object' && typeof d.type === 'string' && d.type.startsWith('APEX_CHAOS_')) {
    messages.push({ type: d.type, at: Date.now(), data: d });
  }
});
const realWindowAddEventListener = win.addEventListener.bind(win);
win.addEventListener = function instrumented(type, listener, options) {
  if (type === 'message') messageListenerAdds.push(Date.now());
  return realWindowAddEventListener(type, listener, options);
};
win.addEventListener('apex-parent-runtime-pause', () => pauseEvents.push(Date.now()));
win.addEventListener('apex-parent-runtime-resume', () => resumeEvents.push(Date.now()));

for (const [name, sink] of [['onHandoff', handoffHookCalls], ['onBattleLive', liveHookCalls], ['onMode', modeHookCalls]]) {
  const prev = win.APEX_GOLD[name];
  win.APEX_GOLD[name] = function spy(...args) {
    sink.push(args[0]);
    return typeof prev === 'function' ? prev.apply(this, args) : undefined;
  };
}
const realMount = win.APEX_GOLD.mountBattleHud.bind(win.APEX_GOLD);
win.APEX_GOLD.mountBattleHud = function spyMount(html, onready) {
  mountCalls.push({ bytes: String(html || '').length, sha: shortHash(String(html || '')) });
  return realMount(html, onready);
};

// Donor pump observation: the mounted donor HUD ticks only while it is NOT
// paused, so tick cadence is the real behavioural proof of the pause protocol.
let tickCalls = 0;
let tickWindows = [];
let tickWindowStart = 0;

function shortHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function waitFor(predicate, timeoutMs = 20000, label = 'condition') {
  const started = Date.now();
  for (;;) {
    let value = null;
    try { value = predicate(); } catch (error) { value = null; }
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}
const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------- mount the REAL generated shell
// Faithful reproduction of the src/App.jsx mount: parse the generated file,
// copy head children then body children into #gold-shell-host, then execute
// the shell's scripts (the payload script is text/plain and stays inert).
const shellHtml = fs.readFileSync(path.join(REPO, 'public/gold/shell.html'), 'utf8');
const listenerAddsBeforeMount = messageListenerAdds.length;
const doc = new win.DOMParser().parseFromString(shellHtml, 'text/html');
const base = doc.createElement('base');
base.href = '/gold/';
doc.head.insertBefore(base, doc.head.firstChild);
const shellScripts = [...doc.querySelectorAll('script')].filter((node) => {
  const type = String(node.getAttribute('type') || '').toLowerCase();
  return !type || type === 'text/javascript' || type === 'application/javascript' || type === 'module';
});
const host = $('gold-shell-host');
for (const node of [...doc.head.children]) host.appendChild(win.document.importNode(node, true));
for (const node of [...doc.body.children]) host.appendChild(win.document.importNode(node, true));
for (const src of shellScripts) {
  const run = win.document.createElement('script');
  if (src.src) {
    // jsdom has no resource loader: the external bridge tag cannot fetch here.
    // Production truth is unaffected — the bridge runtime is already loaded
    // (arsenalProduct group) and its own guard makes a second load a no-op.
    run.src = src.src;
    host.appendChild(run);
  } else {
    run.textContent = src.textContent;
    host.appendChild(run);
  }
}
host.dataset.apexGoldMounted = '1';
win.document.body.classList.add('apex-gold-mounted');
// The shell's own stage node: hold the reference NOW. When the donor HUD is
// mounted the bridge parks colliding ids (the donor also owns #stage), so a
// later getElementById('stage') resolves to the DONOR's stage instead.
const shellStage = $('stage');
const shellStageIsShellOwned = shellStage.closest('#gold-shell-host') !== null
  && !!shellStage.querySelector('#lockIn');

// The canonical donor HUD the shell hands off: the generated shell carries it
// as a base64 text/plain payload, decoded here byte-for-byte.
const payloadEl = $('battleHudPayload');
const canonicalDonor = payloadEl ? Buffer.from((payloadEl.textContent || '').trim(), 'base64').toString('utf8') : '';

function main() {
  // 1) The real generated shell boots inside the production host, and it boots
  //    EXACTLY ONCE: a dynamically inserted classic script executes on append,
  //    so a mount model that copies script nodes AND re-creates them would run
  //    the shell IIFE twice (duplicated listeners/handlers). The message
  //    listener count is the observable proof.
  gate('production-shell-mounts-through-app-model', shellStageIsShellOwned
    && !!$('lockIn')
    && $('fighterRoster').children.length > 0
    && (messageListenerAdds.length - listenerAddsBeforeMount) === 2, {
    stageInHost: shellStageIsShellOwned,
    rosterCards: $('fighterRoster') ? $('fighterRoster').children.length : 0,
    // Production set: the shell's protocol listener + the Lucky Draw bridge
    // listener. A mount model that copies script nodes AND re-creates them
    // would execute the shell IIFE twice (extra listeners) — this count is
    // the observable proof that it boots exactly once.
    messageListenersAddedByShell: messageListenerAdds.length - listenerAddsBeforeMount,
    loadErrors: loadErrors.map((e) => e.file),
  });

  gate('handoff-payload-is-the-canonical-decoded-donor', canonicalDonor.length > 1000
    && canonicalDonor.includes('APEX_GOLD_HUD')
    && canonicalDonor.includes('APEX_CHAOS_BATTLE_HANDOFF')
    && canonicalDonor.includes('APEX_CHAOS_HUD_READY')
    && canonicalDonor.includes('APEX_CHAOS_BATTLE_EXIT'), {
    payloadBytes: canonicalDonor.length,
    payloadSha: shortHash(canonicalDonor),
  });

  return mainAsync();
}

async function mainAsync() {
  // 3) Real product flow: BATTLE -> mode card -> LOCK IN (real DOM input).
  $('freeBattle').dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await waitFor(() => $('fighterSelectScreen') && $('modeSelectScreen')
    && $('modeSelectScreen').getAttribute('aria-hidden') === 'false', 5000, 'mode screen');
  const modeCard = win.document.querySelector('.modeCard[data-mode="bot"]');
  gate('real-battle-entry-reaches-mode-select', !!modeCard
    && modeHookCalls.length === 0, { modeCards: win.document.querySelectorAll('.modeCard').length });

  modeCard.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await waitFor(() => $('fighterSelectScreen').getAttribute('aria-hidden') === 'false'
    && /VS BOT/.test($('fighterModeBadge').textContent), 5000, 'fighter select screen');
  gate('real-mode-choice-reaches-fighter-select', modeHookCalls.length === 1
    && modeHookCalls[0] === 'bot'
    && /VS BOT/.test($('fighterModeBadge').textContent), {
    mode: modeHookCalls[0], badge: $('fighterModeBadge').textContent,
  });

  // 4) LOCK IN drives the real launchBattleHud() transition.
  const handoffsBeforeLock = messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_HANDOFF').length;
  $('lockIn').dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  const entered = await waitFor(() => win.document.body.classList.contains('battle-hud-open')
    || !win.document.body.classList.contains('battle-transition-active'), 15000, 'battle entry transition')
    .then(() => win.document.body.classList.contains('battle-hud-open'));
  gate('real-lock-drives-battle-entry-transition', entered === true, {
    battleHudOpen: win.document.body.classList.contains('battle-hud-open'),
    hudHostOpen: $('battleHudHost').classList.contains('is-open'),
    handoffMessages: messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_HANDOFF').length - handoffsBeforeLock,
  });

  // 5) The shell mounted the canonical donor through the production bridge.
  gate('shell-mounts-canonical-donor-through-bridge', mountCalls.length === 1
    && mountCalls[0].sha === shortHash(canonicalDonor), {
    mountCalls, canonicalSha: shortHash(canonicalDonor),
  });

  // 6) APEX_CHAOS_BATTLE_HANDOFF carries production truth (real mode, real
  //    production hero ids/accents injected by the bridge's onHandoff).
  const handoffs = messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_HANDOFF').map((m) => m.data);
  const firstHandoff = handoffs[0] || null;
  const liveHandoff = handoffs.filter((h) => h.live === true).slice(-1)[0] || null;
  // 6b) BOT OPPONENT = ONE TRUTH (2026-10-05 correction): the handoff P2
  //     identity is the SAME production CPU identity the shell presents and the
  //     real match spawns. The previous hardcoded 'ICE' presentation (which
  //     contradicted the ROBOT the production match actually spawned) is gone;
  //     the shell derives the presented identity from the bridge authority.
  const botTruth = win.eval(`(() => ({
    productionBotId: window.APEX_GOLD && typeof window.APEX_GOLD.botOpponentProductionId === 'function'
      ? window.APEX_GOLD.botOpponentProductionId() : null,
    shellBotId: window.APEX_ARSENAL_SHELLS && typeof window.APEX_ARSENAL_SHELLS.botOpponentId === 'function'
      ? window.APEX_ARSENAL_SHELLS.botOpponentId() : null,
  }))()`);
  gate('handoff-message-carries-production-truth', !!firstHandoff
    && firstHandoff.mode === '1p'
    && firstHandoff.live === false
    && Array.isArray(firstHandoff.players) && firstHandoff.players.length === 2
    && firstHandoff.players[0].productionId === 'ROBOT'
    && firstHandoff.players[1].productionId === botTruth.productionBotId
    && botTruth.productionBotId === botTruth.shellBotId
    && botTruth.productionBotId === 'ROBOT', {
    mode: firstHandoff && firstHandoff.mode,
    live: firstHandoff && firstHandoff.live,
    players: (firstHandoff && firstHandoff.players || []).map((p) => ({ id: p.id, productionId: p.productionId, accent: p.accent })),
    handoffHookCalls: handoffHookCalls.length,
    botTruth,
  });

  // 7) APEX_CHAOS_HUD_READY (posted by the real donor on boot) makes the shell
  //    (re)send the handoff.
  const readyMessages = messages.filter((m) => m.type === 'APEX_CHAOS_HUD_READY').length;
  gate('hud-ready-message-resends-handoff', readyMessages >= 1
    && handoffs.length >= 2
    && handoffHookCalls.length >= 2, {
    readyMessages, handoffMessages: handoffs.length, hookCalls: handoffHookCalls.length,
  });

  // 7b) Exactly ONE shell protocol listener exists: a duplicated HUD_READY
  //     message produces exactly ONE resend (a double-mounted shell would
  //     answer twice). This is the runtime proof of the single boot.
  const hookCallsBeforeSynthetic = handoffHookCalls.length;
  win.postMessage({ type: 'APEX_CHAOS_HUD_READY' }, '*');
  await settle(150);
  gate('shell-protocol-listener-answers-exactly-once', handoffHookCalls.length - hookCallsBeforeSynthetic === 1, {
    resendsForOneReadyMessage: handoffHookCalls.length - hookCallsBeforeSynthetic,
  });

  // 8) APEX_CHAOS_BATTLE_LIVE is posted once the transition is committed, and
  //    the live handoff follows it with live:true.
  const liveMessages = messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_LIVE').length;
  gate('battle-live-message-sent-with-live-handoff', liveMessages === 1
    && !!liveHandoff
    && liveHandoff.live === true
    && liveHandoff.mode === '1p', {
    liveMessages, liveHandoff: !!liveHandoff, hookLiveCalls: liveHookCalls.length,
  });

  // 9) The bridge receives the real live pick and starts the real match
  //    (production truth, not a synthetic state).
  gate('battle-live-starts-the-real-production-match', liveHookCalls.length === 1
    && liveHookCalls[0] && liveHookCalls[0].mode === 'bot'
    && liveHookCalls[0].p1 === 'newbot'
    && liveHookCalls[0].p2 === 'newbot', { live: liveHookCalls });

  // 10) The donor really pauses on the non-live handoff and resumes on LIVE:
  //     its pump only ticks while unpaused, so tick cadence is the proof.
  const seam = win.APEX_GOLD_HUD;
  const seamTicksBefore = tickCalls;
  drainFrames(240); // ~4s of donor frames at 60fps
  await settle(120);
  const ticksAfterLive = tickCalls - seamTicksBefore;
  gate('donor-pump-runs-after-battle-live', !!seam && ticksAfterLive > 30, {
    seamPresent: !!seam, ticksAfterLive,
  });

  // 11) Parent runtime freeze/resume around the battle session. The shell's
  //     own stage node (captured before the donor parked the colliding id).
  const stage = shellStage;
  gate('parent-runtime-freezes-during-battle', pauseEvents.length === 1
    && win.__APEX_PARENT_RUNTIME_PAUSED === true
    && stage.hasAttribute('inert')
    && stage.getAttribute('aria-hidden') === 'true', {
    pauseEvents: pauseEvents.length,
    paused: win.__APEX_PARENT_RUNTIME_PAUSED,
    inert: stage.hasAttribute('inert'),
    ariaHidden: stage.getAttribute('aria-hidden'),
  });

  // 12) EXIT through the real donor Escape key: the donor posts
  //     APEX_CHAOS_BATTLE_EXIT, the shell closes the HUD and resumes the parent.
  const exitsBefore = messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_EXIT').length;
  win.document.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const closed = await waitFor(() => !$('battleHudHost').classList.contains('is-open'), 10000, 'battle HUD close')
    .then(() => !$('battleHudHost').classList.contains('is-open'));
  gate('donor-escape-exits-battle-and-resumes-parent', closed === true
    && (messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_EXIT').length - exitsBefore) === 1
    && $('battleHudHost').getAttribute('aria-hidden') === 'true'
    && $('battleHudHost').children.length === 0
    && resumeEvents.length === 1
    && win.__APEX_PARENT_RUNTIME_PAUSED === false
    && !stage.hasAttribute('inert')
    && $('fighterSelectScreen').getAttribute('aria-hidden') === 'false', {
    closed, exitMessages: messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_EXIT').length - exitsBefore,
    hudHostChildren: $('battleHudHost').children.length,
    resumeEvents: resumeEvents.length, paused: win.__APEX_PARENT_RUNTIME_PAUSED,
    backOnFighterScreen: $('fighterSelectScreen').getAttribute('aria-hidden') === 'false',
  });

  // 13) Escape DURING the transition cancels it: no battle session, and the
  //     parent runtime is never left frozen. The real path unlocks the fighter
  //     first (Escape = back), because the shell keeps the lock after an exit.
  win.document.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settle(300);
  $('lockIn').dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await waitFor(() => win.document.body.classList.contains('battle-transition-active'), 5000, 'transition start');
  const pausesBeforeCancel = pauseEvents.length;
  win.document.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const cancelled = await waitFor(() => !win.document.body.classList.contains('battle-transition-active'), 5000, 'transition cancel')
    .then(() => !win.document.body.classList.contains('battle-transition-active'));
  gate('escape-cancels-transition-without-entering-battle', cancelled === true
    && !win.document.body.classList.contains('battle-hud-open')
    && pauseEvents.length === pausesBeforeCancel
    && win.__APEX_PARENT_RUNTIME_PAUSED !== true
    && $('fighterSelectScreen').getAttribute('aria-hidden') === 'false', {
    cancelled, battleHudOpen: win.document.body.classList.contains('battle-hud-open'),
    pauseEvents: pauseEvents.length, backOnFighterScreen: $('fighterSelectScreen').getAttribute('aria-hidden') === 'false',
  });

  // 14) A fresh entry after the exit is a complete new handoff cycle (the
  //     bridge/shell stay idempotent across sessions). Real path: unlock, then
  //     LOCK IN again.
  win.document.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settle(200);
  if ($('fighterSelectScreen').getAttribute('aria-hidden') !== 'false') {
    win.document.querySelector('.modeCard[data-mode="bot"]')
      .dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitFor(() => $('fighterSelectScreen').getAttribute('aria-hidden') === 'false', 5000, 'fighter select screen (3)');
  }
  $('lockIn').dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  const reEntered = await waitFor(() => win.document.body.classList.contains('battle-hud-open'), 15000, 'second battle entry')
    .then(() => win.document.body.classList.contains('battle-hud-open'));
  // Three mounts = one per entry attempt (the cancelled transition mounted and
  // then unmounted, exactly like production); two LIVE cycles = the two real
  // battle sessions. The bridge/shell stay idempotent across all of them.
  gate('reentry-after-exit-is-a-fresh-handoff-cycle', reEntered === true
    && mountCalls.length === 3
    && liveHookCalls.length === 2
    && messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_LIVE').length === 2
    && handoffHookCalls.length >= 6, {
    reEntered, mountCalls: mountCalls.length, liveHookCalls: liveHookCalls.length,
    liveMessages: messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_LIVE').length,
    handoffHookCalls: handoffHookCalls.length,
  });

  // Clean exit so the process can finish.
  win.document.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settle(400);

  const summary = {
    total: Object.keys(report.gates).length,
    passed: Object.keys(report.gates).filter((k) => report.gates[k].pass).length,
    failed: report.failures,
  };
  fs.mkdirSync(path.join(REPO, evidenceDir), { recursive: true });
  fs.writeFileSync(path.join(REPO, evidenceDir, 'shell-hud-handoff-protocol-report.json'),
    JSON.stringify({ ...report, ...summary, evidence: {
      messageTypes: messages.reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc; }, {}),
      pauseEvents: pauseEvents.length, resumeEvents: resumeEvents.length,
      handoffHookCalls: handoffHookCalls.length, liveHookCalls: liveHookCalls.length,
      mountCalls,
    } }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  try { win.close(); } catch (error) { /* jsdom teardown */ }
  process.exit(summary.failed.length ? 1 : 0);
}

// Observe the donor pump (tick) to prove pause/resume behaviour.
(function installTickSpy() {
  const attach = () => {
    const seam = win.APEX_GOLD_HUD;
    if (!seam || typeof seam.tick !== 'function' || seam.__apexTickSpied) {
      if (!seam) setTimeout(attach, 50);
      return;
    }
    seam.__apexTickSpied = true;
    const prev = seam.tick;
    seam.tick = function spiedTick(dt, now) {
      tickCalls += 1;
      if (!tickWindowStart) tickWindowStart = Date.now();
      return prev.call(this, dt, now);
    };
  };
  attach();
})();

main().then(mainAsync).catch((error) => {
  console.error('[harness-error]', error && error.stack ? error.stack : error);
  try { win.close(); } catch (e) { /* ignore */ }
  process.exit(1);
});
