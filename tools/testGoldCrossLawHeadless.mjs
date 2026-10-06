// GOLD CROSS-LAW HEADLESS PROOF — two individually-valid subsystems must AGREE.
//
// Each gate below crosses a seam. A single subsystem can be internally valid
// and still be wrong for the product, so these laws assert AGREEMENT between
// authorities that are authored separately:
//
//   LAW 1  BOT opponent identity: presented === handed off === really spawned
//   LAW 2  skill cast event === real production cooldown === next-frame HUD
//   LAW 3  HUD control label === the key production actually accepts
//   LAW 4  displayed theme policy === the real media-element playback policy
//   LAW 5  visible roster === the production-visible roster authority
//   LAW 6  any timer/round/wins shown === the real production match authority
//
// Real paths only: the REAL generated Gold shell + bridge + donor HUD, the
// REAL hero-rework combatants and the REAL product music authority runtime.
//
// Usage: node tools/testGoldCrossLawHeadless.mjs
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
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  console.log('[page-error]', String((error && error.message) || error).slice(0, 240));
});
const { createCanvas, loadImage, GlobalFonts, ImageData: NapiImageData, Path2D: NapiPath2D } = requireTool('@napi-rs/canvas');
GlobalFonts.registerFromPath(path.join(REPO, 'public', 'assets', 'fonts', 'kanit', 'Kanit-BlackItalic.ttf'), 'ApcKanit');

// ---------------------------------------------------------------- DOM setup
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

// ── canvas / audio / media stubs (browser behaviour jsdom lacks) ────────────
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
    set(target, prop, value) { return Reflect.set(target, prop, value); },
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

// The product theme is a REAL media element in the browser. jsdom has no media
// playback, so record the actual element calls the authority makes (that is the
// observable playback policy: play()/pause()/muted/currentTime/volume).
const mediaCalls = [];
const mediaElements = [];
class MediaStub {
  constructor(src) {
    this.__apexMediaStub = true;
    this.src = src || '';
    this.loop = false;
    this.preload = 'none';
    this.volume = 1;
    this.muted = false;
    this.paused = true;
    this.currentTime = 0;
    this.currentSrc = this.src;
    this.readyState = 4;
    this.networkState = 1;
    mediaElements.push(this);
  }
  load() { mediaCalls.push(['load', this.src]); }
  play() {
    this.paused = false;
    mediaCalls.push(['play', this.src, this.currentTime]);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    mediaCalls.push(['pause', this.src, this.currentTime]);
  }
}
win.Audio = function AudioStub(src) { return new MediaStub(src); };
win.HTMLMediaElement = win.HTMLMediaElement || function HTMLMediaElementStub() {};

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
win.fetch = (url) => {
  const u = String(url);
  if (/\/assets\/(?:arsenal\/(?:av|feel)|hero-rework\/hunter-v10\/sfx)\//.test(u)) {
    const rel = u.slice(u.indexOf('/assets/') + 1).split(/[?#]/, 1)[0];
    try {
      const data = fs.readFileSync(path.join(REPO, 'public', rel));
      const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(copy) });
    } catch (error) { return Promise.reject(error); }
  }
  return new Promise(() => {});
};

class HarnessImage {
  constructor() {
    this.complete = false; this.width = 0; this.height = 0; this.__realImage = null;
    this.onload = null; this.onerror = null; this.listeners = new Map();
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type) {
    const propertyHandler = this[`on${type}`];
    if (typeof propertyHandler === 'function') propertyHandler.call(this, { type, target: this });
    for (const listener of this.listeners.get(type) || []) listener.call(this, { type, target: this });
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
      .catch(() => this.dispatch('error'));
  }
  get src() { return this._src; }
}
win.Image = HarnessImage;
// The media probe must be readable from inside win.eval (LAW 4 reads real
// element calls: play/pause/muted/currentTime).
win.__apexMediaProbe = { calls: mediaCalls, elements: mediaElements };
if (!win.ImageData) win.ImageData = NapiImageData;
if (!win.Path2D) win.Path2D = NapiPath2D;

const rafQueue = [];
let rafId = 0;
// Deterministic virtual clock: fades/cooldowns are time-based, and the harness
// steps frames synchronously, so real time would never advance inside a fade.
let virtualNow = 0;
win.performance.now = () => virtualNow;
win.requestAnimationFrame = (cb) => { const id = ++rafId; rafQueue.push({ id, cb }); return id; };
win.cancelAnimationFrame = (id) => {
  const i = rafQueue.findIndex((e) => e.id === id);
  if (i >= 0) rafQueue.splice(i, 1);
};
function drainFrames(count = 1) {
  for (let i = 0; i < count; i++) win.stepFrame();
  return rafQueue.length;
}

const loadErrors = [];
function loadScript(relPath, required) {
  const fileRelPath = String(relPath).split(/[?#]/, 1)[0];
  const file = resolveLegacyRuntimeFile(REPO, fileRelPath);
  try {
    win.eval(fs.readFileSync(file, 'utf8'));
    return true;
  } catch (error) {
    loadErrors.push({ file: relPath, error: String(error && error.message || error) });
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
loadScript('/game/gold/goldProductBridge.js', true);
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

async function waitFor(predicate, timeoutMs = 20000, label = 'condition') {
  const started = Date.now();
  for (;;) {
    let value = null;
    try { value = predicate(); } catch (error) { value = null; }
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

// ── the HUD projection the bridge actually sends (LAW 2 / LAW 6 read this) ──
// Installed only AFTER the canonical donor HUD has executed: the donor assigns
// window.APEX_GOLD_HUD.applyState itself, so an earlier wrapper would be
// replaced and the harness would observe nothing.
const projections = [];
// Monotonically increasing Gold projection sequence. Several independent rAF
// consumers share the queue, so "N frames" is NOT "N bridge projections": the
// only sound synchronisation is "a projection sequence number GREATER than the
// one recorded before a production state change has actually been observed".
let projectionSeq = 0;
function installProjectionSpy() {
  const live = win.APEX_GOLD_HUD;
  if (!live || live.__crossLawSpy) return;
  const prev = live.applyState;
  live.applyState = function recorded(...args) {
    projectionSeq += 1;
    projections.push({ seq: projectionSeq, state: args[0] });
    return typeof prev === 'function' ? prev.apply(this, args) : undefined;
  };
  live.__crossLawSpy = true;
}
const projectionSequence = () => projectionSeq;
const lastProjection = () => (projections.length ? projections[projections.length - 1].state : null);
// Drain frames until the Gold bridge pump has emitted at least one projection
// AFTER the given sequence number (bounded, deterministic).
function drainUntilFreshProjection(sequenceBefore, maxFrames = 4000) {
  for (let i = 0; i < maxFrames && projectionSeq <= sequenceBefore; i++) win.stepFrame();
  return projectionSeq > sequenceBefore;
}
// Record the pre-change sequence, apply a production state change, then wait
// for the FIRST fresh projection that follows it.
function withFreshProjection(applyProductionChange) {
  const sequenceBefore = projectionSeq;
  const production = applyProductionChange();
  drainUntilFreshProjection(sequenceBefore);
  const fresh = projections.filter((entry) => entry.seq > sequenceBefore);
  return {
    production,
    freshCount: fresh.length,
    firstFresh: fresh.length ? fresh[0].state : null,
    lastFresh: fresh.length ? fresh[fresh.length - 1].state : null,
  };
}

// ── production key acceptance (LAW 3 reads this) ───────────────────────────
const abilityCalls = [];
const hr = win.APEX_HERO_REWORK;
const realPressAbility = hr.pressAbility;
hr.pressAbility = function spyPressAbility(fighter, slot) {
  const idx = (typeof win.fighters !== 'undefined' && Array.isArray(win.fighters))
    ? win.fighters.indexOf(fighter) : -1;
  abilityCalls.push({ slot, name: fighter && fighter.name, heroId: fighter && fighter.heroId, side: idx });
  return realPressAbility.call(this, fighter, slot);
};

// ── mount the REAL generated shell + canonical donor HUD (App mount model) ──
const shellHtml = fs.readFileSync(path.join(REPO, 'public/gold/shell.html'), 'utf8');
const shellDoc = new win.DOMParser().parseFromString(shellHtml, 'text/html');
const base = shellDoc.createElement('base');
base.href = '/gold/';
shellDoc.head.insertBefore(base, shellDoc.head.firstChild);
const shellScripts = [...shellDoc.querySelectorAll('script')].filter((node) => {
  const type = String(node.getAttribute('type') || '').toLowerCase();
  return !type || type === 'text/javascript' || type === 'application/javascript' || type === 'module';
});
const host = $('gold-shell-host');
for (const node of [...shellDoc.head.children]) host.appendChild(win.document.importNode(node, true));
for (const node of [...shellDoc.body.children]) host.appendChild(win.document.importNode(node, true));
for (const src of shellScripts) {
  const run = win.document.createElement('script');
  if (src.src) { run.src = src.src; } else { run.textContent = src.textContent; }
  host.appendChild(run);
}
host.dataset.apexGoldMounted = '1';
win.document.body.classList.add('apex-gold-mounted');
const payloadEl = $('battleHudPayload');
const canonicalDonor = payloadEl ? Buffer.from((payloadEl.textContent || '').trim(), 'base64').toString('utf8') : '';

// every APEX_CHAOS_* protocol message (presentation truth travels on these)
const messages = [];
win.addEventListener('message', (event) => {
  const d = event && event.data;
  if (d && typeof d === 'object' && typeof d.type === 'string' && d.type.startsWith('APEX_CHAOS_')) {
    messages.push(d);
  }
});

async function main() {
  // ── LAW 4 (static half): the product music authority is installed ONCE ────
  const music = win.apexProductMusic;
  gate('law4-single-product-music-element', !!music
    && music.elementCount() === 1
    && mediaElements.filter((el) => /forward_drive_theme\.ogg/.test(String(el.src || ''))).length === 1
    && music.isProductMusicElement(mediaElements.find((el) => /forward_drive_theme\.ogg/.test(String(el.src || '')))) === true, {
    elementCount: music ? music.elementCount() : null,
    mediaElements: mediaElements.length,
    themeElements: mediaElements.filter((el) => /forward_drive_theme\.ogg/.test(String(el.src || ''))).length,
    loadErrors: loadErrors.map((e) => e.file),
  });
  gate('law4-forward-drive-is-the-product-source', !!music
    && /forward_drive_theme\.ogg/.test(String(music.source)), { source: music && music.source });
  // The App installs the SAME authority (no element of its own). Re-installing
  // must return the existing authority and must not create a second element.
  const reinstall = win.eval(`(() => {
    const before = window.__apexMediaProbe.elements.filter((el) => /forward_drive_theme/.test(String(el.src || ''))).length;
    const again = window.installProductMusicAuthority({ window, document });
    const after = window.__apexMediaProbe.elements.filter((el) => /forward_drive_theme/.test(String(el.src || ''))).length;
    return {
      before, after,
      sameAuthority: again && again.api === window.apexProductMusic,
      elementCount: window.apexProductMusic.elementCount(),
    };
  })()`);
  gate('law4-app-install-creates-no-second-element', reinstall.before === 1
    && reinstall.after === 1
    && reinstall.sameAuthority === true
    && reinstall.elementCount === 1, reinstall);

  // ── real product flow: BATTLE -> mode (bot) -> LOCK IN ────────────────────
  $('freeBattle').dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await waitFor(() => $('fighterSelectScreen') && $('modeSelectScreen')
    && $('modeSelectScreen').getAttribute('aria-hidden') === 'false', 5000, 'mode screen');
  const modeCard = win.document.querySelector('.modeCard[data-mode="bot"]');
  modeCard.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await waitFor(() => $('fighterSelectScreen').getAttribute('aria-hidden') === 'false', 5000, 'fighter select screen');

  // ── LAW 5: visible roster === production-visible roster authority ─────────
  const rosterTruth = win.eval(`(() => {
    const g = window.APEX_GOLD;
    const roster = typeof g.roster === 'function' ? g.roster() : [];
    const order = typeof g.rosterOrder === 'function' ? g.rosterOrder() : [];
    const cards = [...document.querySelectorAll('#gold-shell-host .rosterCard')];
    return {
      productionVisible: roster.length,
      productionPlayable: roster.filter((r) => r.playable).length,
      productionLocked: roster.filter((r) => !r.playable).length,
      orderLength: order.length,
      cards: cards.length,
      cardIds: cards.map((c) => c.dataset.hero),
      lockedCards: cards.filter((c) => c.classList.contains('is-locked')).map((c) => c.dataset.hero),
      disabledCards: cards.filter((c) => c.disabled).map((c) => c.dataset.hero),
      playableIds: typeof g.isPlayable === 'function' ? roster.filter((r) => g.isPlayable(r.id)).map((r) => r.id) : [],
      everyEntryCovered: (() => {
        // every production-visible entry has exactly one card, and a card is
        // selectable iff production says the entry is playable
        const byId = {};
        cards.forEach((c) => { byId[c.dataset.hero] = c; });
        return roster.every((r) => {
          const card = byId[r.id];
          if (!card) return false;
          if (r.playable) return card.disabled === false;
          return card.disabled === true && !!card.querySelector('.rosterLock');
        });
      })(),
    };
  })()`);
  gate('law5-visible-roster-matches-production-authority', rosterTruth.cards === rosterTruth.productionVisible
    && rosterTruth.productionVisible === rosterTruth.orderLength
    && rosterTruth.disabledCards.length === rosterTruth.productionLocked
    && rosterTruth.playableIds.length === rosterTruth.productionPlayable
    && rosterTruth.everyEntryCovered === true, rosterTruth);
  gate('law5-core-six-remain-playable-and-future-fighters-locked', rosterTruth.productionPlayable === 6
    && rosterTruth.productionLocked > 0
    && rosterTruth.disabledCards.length === rosterTruth.productionLocked, {
    playable: rosterTruth.productionPlayable, locked: rosterTruth.productionLocked, lockedCards: rosterTruth.disabledCards,
  });

  // ── LAW 4 (dynamic half): displayed policy === media-element policy ───────
  const themePolicy = win.eval(`(() => {
    const music = window.apexProductMusic;
    const results = [];
    const surfaces = ['home', 'mode', 'fighter', 'transition', 'lucky', 'shop', 'missions', 'upgrade', 'battle'];
    for (const id of surfaces) {
      window.__apexMediaProbe.calls.length = 0;
      music.setSurface(id);
      // step the owner fade band (380ms of rAF frames)
      for (let i = 0; i < 40; i++) stepFrame();
      const st = music.state();
      results.push({ surface: id, allowed: st.allowed, paused: st.paused, volume: Math.round(st.volume * 100) / 100 });
    }
    return { results, allowedSurfaces: music.allowedSurfaces() };
  })()`);
  const bySurface = {};
  for (const r of themePolicy.results) bySurface[r.surface] = r;
  const allowedOk = ['home', 'mode', 'fighter', 'transition'].every((id) => bySurface[id].allowed === true && bySurface[id].paused === false);
  const disallowedOk = ['lucky', 'shop', 'missions', 'upgrade', 'battle'].every((id) => bySurface[id].allowed === false && bySurface[id].paused === true);
  gate('law4-allowed-surfaces-really-play-the-theme', allowedOk, {
    allowed: themePolicy.results.filter((r) => r.allowed), allowedSurfaces: themePolicy.allowedSurfaces,
  });
  gate('law4-disallowed-surfaces-really-stop-the-theme', disallowedOk, {
    disallowed: themePolicy.results.filter((r) => !r.allowed),
  });
  // playhead preservation across surfaces (no restart on return)
  const playhead = win.eval(`(() => {
    const music = window.apexProductMusic;
    const el = window.__apexMediaProbe.elements.find((m) => /forward_drive_theme/.test(String(m.src)));
    music.setSurface('home'); for (let i = 0; i < 40; i++) stepFrame();
    el.currentTime = 42.5;
    music.setSurface('lucky'); for (let i = 0; i < 40; i++) stepFrame();
    const afterFadeOut = { paused: el.paused, time: el.currentTime };
    music.setSurface('home'); for (let i = 0; i < 40; i++) stepFrame();
    const afterReturn = { paused: el.paused, time: el.currentTime };
    const restarts = window.__apexMediaProbe.calls.filter((c) => c[0] === 'play').length;
    return { afterFadeOut, afterReturn, restarts };
  })()`);
  gate('law4-playhead-preserved-across-surfaces', playhead.afterFadeOut.paused === true
    && playhead.afterFadeOut.time === 42.5
    && playhead.afterReturn.paused === false
    && playhead.afterReturn.time === 42.5, playhead);
  // M = MUSIC ONLY
  const muteRun = win.eval(`(() => {
    const music = window.apexProductMusic;
    const el = window.__apexMediaProbe.elements.find((m) => /forward_drive_theme/.test(String(m.src)));
    music.setSurface('home'); for (let i = 0; i < 40; i++) stepFrame();
    const before = el.muted;
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
    const afterM = el.muted;
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'M', bubbles: true, cancelable: true }));
    const afterUpper = el.muted;
    const otherAudio = window.__apexMediaProbe.elements.filter((m) => !/forward_drive_theme/.test(String(m.src)));
    return { before, afterM, afterUpper, otherAudioMuted: otherAudio.map((m) => m.muted) };
  })()`);
  gate('law4-m-key-mutes-music-only', muteRun.before === false
    && muteRun.afterM === true && muteRun.afterUpper === false
    && muteRun.otherAudioMuted.every((m) => m === false), muteRun);
  // blur/hidden pause + focus/visible resume (only when previously allowed)
  const visibilityRun = win.eval(`(() => {
    const music = window.apexProductMusic;
    const el = window.__apexMediaProbe.elements.find((m) => /forward_drive_theme/.test(String(m.src)));
    music.setSurface('home'); for (let i = 0; i < 40; i++) stepFrame();
    window.dispatchEvent(new window.Event('blur'));
    const afterBlur = el.paused;
    window.dispatchEvent(new window.Event('focus'));
    const afterFocus = el.paused;
    music.setSurface('shop'); for (let i = 0; i < 40; i++) stepFrame();
    window.dispatchEvent(new window.Event('blur'));
    const afterBlurDisallowed = el.paused;
    window.dispatchEvent(new window.Event('focus'));
    const afterFocusDisallowed = el.paused;
    return { afterBlur, afterFocus, afterBlurDisallowed, afterFocusDisallowed };
  })()`);
  gate('law4-blur-pauses-and-focus-resumes-only-when-allowed', visibilityRun.afterBlur === true
    && visibilityRun.afterFocus === false
    && visibilityRun.afterBlurDisallowed === true
    && visibilityRun.afterFocusDisallowed === true, visibilityRun);

  // ── LAW 1: presented BOT === handed-off BOT === really spawned BOT ────────
  $('lockIn').dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  const entered = await waitFor(() => win.document.body.classList.contains('battle-hud-open'), 15000, 'battle entry')
    .then(() => true).catch(() => false);
  installProjectionSpy();
  const handoffs = messages.filter((m) => m.type === 'APEX_CHAOS_BATTLE_HANDOFF');
  const liveHandoff = handoffs.filter((h) => h.live === true).slice(-1)[0] || null;
  const preLiveHandoff = handoffs.filter((h) => h.live !== true).slice(-1)[0] || null;
  const presented = preLiveHandoff ? preLiveHandoff.players[1] : null;
  await win.APEX_GOLD.onBattleLive({ mode: 'bot', p1: 'newbot', p2: 'newbot' });
  await waitFor(() => win.eval(`typeof gameState !== 'undefined' && gameState === 'ARSENAL'`), 20000, 'ARSENAL gameState');
  // Step the real bridge pump: every law below reads what the HUD is ACTUALLY
  // being told this frame (never a stale or assumed projection).
  drainFrames(30);
  const spawned = win.eval(`(() => {
    const f = (typeof fighters !== 'undefined' && fighters[1]) || null;
    const aq = window.APEX_ARSENAL;
    return {
      name: f ? f.name : null,
      heroId: f ? (f.heroId || (f.data && f.data.heroId) || null) : null,
      productionId: f ? (f.productionId || (f.data && f.data.productionId) || null) : null,
      battleMode: aq && aq.state ? aq.state.battleMode : null,
      botOpponentProductionId: window.APEX_GOLD.botOpponentProductionId(),
      shellBotId: window.APEX_ARSENAL_SHELLS.botOpponentId(),
      p1Name: (typeof fighters !== 'undefined' && fighters[0]) ? fighters[0].name : null,
    };
  })()`);
  const handoffP2 = liveHandoff ? liveHandoff.players[1] : null;
  gate('law1-bot-identity-presented-equals-handoff', !!presented && !!handoffP2
    && presented.id === handoffP2.id
    && presented.productionId === handoffP2.productionId
    && presented.name === handoffP2.name
    && presented.productionId === spawned.botOpponentProductionId, {
    presented: presented && { id: presented.id, productionId: presented.productionId, name: presented.name },
    handoff: handoffP2 && { id: handoffP2.id, productionId: handoffP2.productionId, name: handoffP2.name },
  });
  gate('law1-bot-identity-handoff-equals-real-spawned-fighter', !!handoffP2
    && spawned.battleMode === 'BOT'
    && spawned.shellBotId === 'ROBOT'
    && spawned.botOpponentProductionId === handoffP2.productionId
    && spawned.name === handoffP2.name, { handoffP2: handoffP2 && handoffP2.productionId, spawned });
  // the shell's presentation derives from production (no second hardcoded id)
  const shellCopy = fs.readFileSync(path.join(REPO, 'public/gold/shell.html'), 'utf8');
  gate('law1-shell-derives-bot-identity-from-production', /heroPayload\(botHeroId\(\),'newbot'\)/.test(shellCopy)
    && !/heroPayload\('frost','newbot'\)/.test(shellCopy)
    && typeof win.APEX_GOLD.botOpponentProductionId === 'function'
    && typeof win.APEX_GOLD.botOpponentShellKey === 'function', {
    derivesFromProduction: /heroPayload\(botHeroId\(\),'newbot'\)/.test(shellCopy),
    hardcodedFrostGone: !/heroPayload\('frost','newbot'\)/.test(shellCopy),
    productionBotId: win.APEX_GOLD.botOpponentProductionId(),
  });

  // ── LAW 3: HUD control label === the key production accepts ──────────────
  const labels = win.eval(`(() => {
    const seam = window.APEX_GOLD_HUD;
    const p1 = [...document.querySelectorAll('#battleHudHost .sk-key')].map((el) => el.textContent);
    return { labels: p1, battleMode: window.APEX_ARSENAL.state.battleMode };
  })()`);
  abilityCalls.length = 0;
  win.eval(`(() => {
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', code: 'KeyK', bubbles: true, cancelable: true }));
    // Owner law 2026-10-06: the Local P2 pair IS the right-hand numpad pair.
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', code: 'Numpad1', bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '2', code: 'Numpad2', bubbles: true, cancelable: true }));
  })()`);
  const p1Keys = abilityCalls.filter((c) => c.name === spawned.p1Name || c.heroId);
  const p1J = abilityCalls.some((c) => c.slot === 'A1');
  const p1K = abilityCalls.some((c) => c.slot === 'A2');
  const botP2Human = abilityCalls.filter((c) => c.side === 1).length;
  gate('law3-p1-key-law-j-k-matches-production', p1J === true && p1K === true, { abilityCalls: abilityCalls.slice() });
  gate('law3-bot-p2-has-no-human-key-path', botP2Human === 0, {
    botP2HumanCasts: botP2Human, calls: abilityCalls.map((c) => ({ slot: c.slot, side: c.side, name: c.name })),
  });
  // HUD labels come from the projection (production truth), not donor copy
  const projectionLabels = lastProjection();
  const hudLabels = projectionLabels && projectionLabels.sides
    ? projectionLabels.sides.map((s) => s.keyLabels) : null;
  gate('law3-hud-key-labels-match-accepted-keys', !!hudLabels
    && JSON.stringify(hudLabels[0]) === JSON.stringify(['J', 'K'])
    && JSON.stringify(hudLabels[1]) === JSON.stringify(['CPU', 'CPU']), { hudLabels, battleMode: labels.battleMode });
  gate('law3-hud-shows-no-donor-ue-copy', !/LOCAL · U I E/.test(canonicalDonor) && !/LOCAL · J K W/.test(canonicalDonor), {
    donorCopyGone: !/LOCAL · U I E/.test(canonicalDonor),
  });
  // ── LAW 2 + LAW 3 (Local half): a real LOCAL match, P1 = HUNTER ─────────
  // HUNTER A1 (hunter.snare) is the multi-charge case (maxCharges: 3, cd 6.5).
  win.APEX_GOLD.unmountBattleHud();
  await new Promise((r) => setTimeout(r, 200));
  abilityCalls.length = 0;
  projections.length = 0;
  // Re-mount the canonical donor exactly as src/App.jsx does for a new session,
  // then drive the real Local pick through the production bridge.
  win.APEX_GOLD.mountBattleHud(canonicalDonor, () => {});
  installProjectionSpy();
  // Ownership is production authority: the HUNTER (the multi-charge skill path)
  // is unlocked through the REAL production economy API, not by faking state.
  const unlock = win.eval(`(() => {
    const meta = window.APEX_ARSENAL_META;
    if (!meta || typeof meta.owns !== 'function') return { ok: false, reason: 'no-meta' };
    if (meta.owns('HUNTER')) return { ok: true, already: true };
    if (typeof meta.award === 'function') meta.award(['headless-cross-law'], 5000);
    const bought = typeof meta.buy === 'function' ? meta.buy('HUNTER') : { ok: false, reason: 'no-buy' };
    return { ok: !!bought.ok, bought, owns: meta.owns('HUNTER') };
  })()`);
  if (!unlock.ok) throw new Error(`could not unlock HUNTER through production economy: ${JSON.stringify(unlock)}`);
  await win.APEX_GOLD.onBattleLive({ mode: 'local', p1: 'hunter', p2: 'newbot' });
  await waitFor(() => win.eval(`typeof gameState !== 'undefined' && gameState === 'ARSENAL'
    && window.APEX_ARSENAL.state.battleMode === 'LOCAL'`), 20000, 'LOCAL HUNTER match');
  drainFrames(30);
  const hunter = win.eval(`(() => {
    const f = fighters[0];
    const ct = f.__hrCombatant || (f.anchor && f.anchor.__hrCombatant);
    return {
      name: f.name, heroId: ct && ct.heroId ? ct.heroId : null,
      defId: ct && ct.skills.A1 && ct.skills.A1.def ? ct.skills.A1.def.id : null,
      maxCharges: ct && ct.skills.A1 && ct.skills.A1.cfg ? (Number(ct.skills.A1.cfg.maxCharges) || 1) : 1,
      cooldown: ct && ct.skills.A1 && ct.skills.A1.cfg ? (Number(ct.skills.A1.cfg.cooldown) || 0) : 0,
    };
  })()`);

  // ── LAW 2: the cast consumes a REAL charge in production ──────────────────
  // Every HUD read below is the FIRST projection the bridge emits AFTER the
  // production state change it follows (monotonic projection sequence), so a
  // stale sample can never make a real defect — or hide one — pass.
  const firstCast = win.eval(`(() => {
    const hr = window.APEX_HERO_REWORK;
    const fighter = fighters[0];
    const ct = fighter.__hrCombatant || (fighter.anchor && fighter.anchor.__hrCombatant);
    const before = {
      charges: ct.skills.A1.charges,
      cdLeft: ct.skills.A1.cdLeft,
      rechargeLeft: ct.skills.A1.rechargeLeft,
      cooldownLeft: ct.__ctl.cooldownLeft('A1'),
    };
    const castOk = hr.pressAbility(fighter, 'A1');
    const afterOne = {
      charges: ct.skills.A1.charges,
      rechargeLeft: ct.skills.A1.rechargeLeft,
      cooldownLeft: ct.__ctl.cooldownLeft('A1'),
    };
    return { before, afterOne, castOk };
  })()`);
  const afterCast = withFreshProjection(() => null);
  const a1AfterCast = afterCast.firstFresh && afterCast.firstFresh.sides ? afterCast.firstFresh.sides[0].skills[0] : null;
  gate('law2-cast-consumes-a-real-charge', !!(firstCast.castOk && firstCast.castOk.ok === true)
    && firstCast.afterOne.charges === firstCast.before.charges - 1, {
    before: firstCast.before, afterOne: firstCast.afterOne, castOk: firstCast.castOk,
  });
  // Multi-charge semantics: while charges remain the skill is genuinely usable
  // (production cooldownLeft === 0) and the HUD must project READY.
  gate('law2-multi-charge-usable-while-charges-remain', !!a1AfterCast
    && a1AfterCast.truth === true
    && a1AfterCast.max === hunter.maxCharges
    && a1AfterCast.charges === firstCast.afterOne.charges
    && a1AfterCast.nextIn === 0, {
    projected: a1AfterCast, production: firstCast.afterOne, freshProjections: afterCast.freshCount,
  });
  // Spend the remaining real charges through the SAME production cast path.
  // Real production gates between casts: the deploy/recoil presentation must
  // finish AND the active-trap cap (maxActiveTraps) must leave room, so frames
  // (≈16.7ms of virtual production time each) run between attempts.
  const depleted = win.eval(`(() => {
    const hr = window.APEX_HERO_REWORK;
    const fighter = fighters[0];
    const ct = fighter.__hrCombatant || (fighter.anchor && fighter.anchor.__hrCombatant);
    const attempts = [];
    let frames = 0;
    for (let i = 0; i < 40 && ct.skills.A1.charges > 0 && frames < 1200; i++) {
      const res = hr.pressAbility(fighter, 'A1');
      attempts.push(res && { ok: res.ok, reason: res.reason });
      for (let k = 0; k < 30 && frames < 1200; k++, frames++) stepFrame();
    }
    return {
      attempts,
      charges: ct.skills.A1.charges,
      rechargeLeft: ct.skills.A1.rechargeLeft,
      cooldownLeft: ct.__ctl.cooldownLeft('A1'),
    };
  })()`);
  const afterDepleted = withFreshProjection(() => null);
  const a1Depleted = afterDepleted.firstFresh && afterDepleted.firstFresh.sides ? afterDepleted.firstFresh.sides[0].skills[0] : null;
  gate('law2-charges-depleted-hud-still-cooling', depleted.charges === 0
    && depleted.cooldownLeft > 0
    && !!a1Depleted && a1Depleted.charges === 0 && a1Depleted.nextIn > 0, {
    production: depleted, projected: a1Depleted, freshProjections: afterDepleted.freshCount,
  });
  // midpoint of the real recharge: still cooling, still zero charges
  const midpointRun = withFreshProjection(() => win.eval(`(() => {
    const fighter = fighters[0];
    const ct = fighter.__hrCombatant || (fighter.anchor && fighter.anchor.__hrCombatant);
    const cd = Number(ct.skills.A1.cfg.cooldown) || 0;
    ct.__ctl.tick(cd * 0.5);
    return { cooldownLeft: ct.__ctl.cooldownLeft('A1'), charges: ct.skills.A1.charges };
  })()`));
  const a1Midpoint = midpointRun.firstFresh && midpointRun.firstFresh.sides ? midpointRun.firstFresh.sides[0].skills[0] : null;
  gate('law2-midpoint-still-cooling', !!a1Midpoint && a1Midpoint.nextIn > 0
    && a1Midpoint.charges === midpointRun.production.charges
    && midpointRun.production.cooldownLeft > 0, {
    midpoint: midpointRun.production, projected: a1Midpoint, freshProjections: midpointRun.freshCount,
  });
  // the exact production-ready edge: the charge returns exactly once, and the
  // FIRST projection the bridge emits after that edge must already carry it.
  const edgeRun = withFreshProjection(() => win.eval(`(() => {
    const fighter = fighters[0];
    const ct = fighter.__hrCombatant || (fighter.anchor && fighter.anchor.__hrCombatant);
    const remaining = ct.__ctl.cooldownLeft('A1');
    ct.__ctl.tick(remaining + 0.05);
    return { cooldownLeft: ct.__ctl.cooldownLeft('A1'), charges: ct.skills.A1.charges };
  })()`));
  const a1Edge = edgeRun.firstFresh && edgeRun.firstFresh.sides ? edgeRun.firstFresh.sides[0].skills[0] : null;
  gate('law2-production-ready-edge-projects-ready-once', !!a1Edge
    && edgeRun.production.cooldownLeft === 0
    && edgeRun.production.charges === 1
    && a1Edge.nextIn === 0
    && a1Edge.charges === 1
    && a1Edge.max === hunter.maxCharges
    && a1Edge.truth === true
    && edgeRun.freshCount >= 1, {
    production: edgeRun.production,
    firstFreshProjection: a1Edge,
    freshProjectionsAfterEdge: edgeRun.freshCount,
  });
  gate('law2-multi-charge-skill-stays-multi-charge', hunter.maxCharges > 1
    && !!a1AfterCast && a1AfterCast.max === hunter.maxCharges
    && !!a1Edge && a1Edge.max === hunter.maxCharges, {
    defId: hunter.defId, maxCharges: hunter.maxCharges, cooldown: hunter.cooldown,
  });
  // a Cast response is visual only and can never become cooldown authority
  const castAuthority = win.eval(`(() => {
    const seam = window.APEX_GOLD_HUD;
    const fighter = fighters[0];
    const ct = fighter.__hrCombatant || (fighter.anchor && fighter.anchor.__hrCombatant);
    const left = ct.__ctl.cooldownLeft('A1');
    ct.__ctl.tick(left + 0.05);
    for (let i = 0; i < 3; i++) stepFrame();
    const before = { charges: ct.skills.A1.charges, cooldownLeft: ct.__ctl.cooldownLeft('A1') };
    seam.cast(0, 0); // raw donor cast cue (presentation only)
    for (let i = 0; i < 3; i++) stepFrame();
    const after = { charges: ct.skills.A1.charges, cooldownLeft: ct.__ctl.cooldownLeft('A1') };
    return { before, after };
  })()`);
  gate('law2-cast-response-cannot-become-cooldown-authority', castAuthority.after.cooldownLeft === castAuthority.before.cooldownLeft
    && castAuthority.after.charges === castAuthority.before.charges, castAuthority);

  // ── LAW 3 (Local half): Local P2 keys are NUMPAD 1/2 and reach production ──
  // The top-row Digit1/Digit2 pair is deliberately inert (owner correction
  // 2026-10-06: "nút 1 2 để trigger P2 ... nên là nút 1 2 ở bên phải của bàn
  // phím laptop thôi"), so it is measured here too instead of being assumed.
  const localTopRow = win.eval(`(() => {
    abilityCalls.length = 0;
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true, cancelable: true }));
    return abilityCalls.filter((c) => c.side === 1).length;
  })()`);
  gate('law3-local-top-row-1-2-is-inert-for-p2', localTopRow === 0, { topRowCasts: localTopRow });
  const localRun = win.eval(`(() => {
    const p2 = fighters[1];
    abilityCalls.length = 0;
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', code: 'Numpad1', bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '2', code: 'Numpad2', bubbles: true, cancelable: true }));
    return { p2Name: p2.name, battleMode: window.APEX_ARSENAL.state.battleMode };
  })()`);
  const localP2Casts = abilityCalls.filter((c) => c.side === 1);
  drainFrames(3);
  const localProjection = lastProjection();
  const localHudLabels = localProjection && localProjection.sides ? localProjection.sides.map((s) => s.keyLabels) : null;
  gate('law3-local-p2-numpad-1-and-2-reach-production', localP2Casts.length === 2
    && localP2Casts.map((c) => c.slot).join(',') === 'A1,A2', {
    p2: localRun.p2Name, casts: localP2Casts.map((c) => c.slot), all: abilityCalls.map((c) => ({ slot: c.slot, side: c.side, name: c.name })),
  });
  gate('law3-local-hud-labels-are-1-and-2', !!localHudLabels
    && JSON.stringify(localHudLabels[1]) === JSON.stringify(['1', '2'])
    && JSON.stringify(localHudLabels[0]) === JSON.stringify(['J', 'K']), { labels: localHudLabels, mode: localRun.battleMode });
  // the Local seam is narrow: it never switches the P2 AI master on
  const botStillCpu = win.eval(`(() => {
    const hr = window.APEX_HERO_REWORK;
    return { aiMaster: !!hr.aiEnabled };
  })()`);
  gate('law3-local-seam-does-not-enable-p2-ai-outside-local', botStillCpu.aiMaster === true, botStillCpu);
  report.summary = {
    total: Object.keys(report.gates).length,
    passed: Object.values(report.gates).filter((g) => g.pass).length,
    failed: report.failures,
  };
  console.log('\n==== GOLD CROSS-LAW HEADLESS SUMMARY ====');
  console.log(JSON.stringify(report.summary, null, 2));
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'gold-cross-law-report.json'), JSON.stringify(report, null, 2));
  console.log(`report written under ${evidenceDir}/`);
  if (report.failures.length) process.exitCode = 1;
  try { win.close(); } catch (error) { /* teardown only */ }
}

// deterministic frame stepping available inside win.eval (the harness owns rAF
// and the virtual clock, so time-based fades complete deterministically)
win.stepFrame = () => {
  virtualNow += 16.7;
  const entry = rafQueue.shift();
  if (entry) entry.cb(virtualNow);
  return !!entry;
};
// jsdom implements neither the Web Animations API nor getAnimations; the donor
// HUD and the shell both use them (cast FX + the parent-runtime freeze around a
// battle session). Browsers ship them — the stubs keep the real code paths.
if (!win.document.getAnimations) win.document.getAnimations = () => [];
if (typeof win.Element !== 'undefined' && !win.Element.prototype.animate) {
  win.Element.prototype.animate = function animate() {
    return {
      finished: Promise.resolve(),
      cancel() {},
      finish() {},
      addEventListener() {},
      removeEventListener() {},
      play() { return Promise.resolve(); },
      pause() {},
      currentTime: 0,
      playState: 'finished',
    };
  };
}

main().catch((error) => {
  console.error('GOLD CROSS-LAW HARNESS ERROR', error && error.stack ? error.stack : error);
  process.exitCode = 1;
  try { win.close(); } catch (e) { /* teardown only */ }
});
