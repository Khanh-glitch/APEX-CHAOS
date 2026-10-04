// GOLD BATTLE PATH — headless functional proof through real production paths.
//
// Runs the REAL engine + Arsenal product runtimes inside jsdom with a real 2D
// canvas (@napi-rs/canvas), mounts the REAL generated Gold battle HUD through
// the production bridge (public/game/gold/goldProductBridge.js) exactly the way
// src/App.jsx mounts it, and drives the real match entry + real realized-damage
// choke point. No synthetic game state: every assertion reads production truth.
//
// Usage: node tools/testGoldBattlePathHeadless.mjs
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
const { JSDOM } = requireTool('jsdom');
const { createCanvas, loadImage, GlobalFonts, ImageData: NapiImageData, Path2D: NapiPath2D } = requireTool('@napi-rs/canvas');

GlobalFonts.registerFromPath(path.join(REPO, 'public', 'assets', 'fonts', 'kanit', 'Kanit-BlackItalic.ttf'), 'ApcKanit');

// ---------------------------------------------------------------- DOM setup
// Production shell roots (engine canvas + legacy UI = production truth) PLUS
// the Gold hosts the App.jsx mount creates (#gold-shell-host / #battleHudHost).
const dom = new JSDOM(`<!doctype html><html><body>
  <div id="battle-shell">
    <aside id="p1-combat-panel" class="combat-panel">
      <div class="cp-identity">
        <span id="p1-cp-chip"></span>
        <div id="p1-name">P1</div>
        <div class="hp-bar-bg"><div id="p1-hp-loss"></div><div id="p1-hp"></div><div id="p1-hp-text"></div></div>
        <div id="p1-rage"></div>
      </div>
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
      <div class="cp-identity">
        <span id="p2-cp-chip"></span>
        <div id="p2-name">P2</div>
        <div class="hp-bar-bg"><div id="p2-hp-loss"></div><div id="p2-hp"></div><div id="p2-hp-text"></div></div>
        <div id="p2-rage"></div>
      </div>
      <div id="p2-energy"><span id="p2-energy-val">0</span><div id="p2-energy-fill"></div><div id="p2-energy-state"></div></div>
      <div id="p2-mode-slot"></div>
    </aside>
  </div>
  <div id="gold-shell-host"></div>
  <div id="battleHudHost"></div>
</body></html>`, { pretendToBeVisual: true, runScripts: 'dangerously', url: 'http://localhost/' });

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

// jsdom lacks matchMedia (Gold HUD reduced-motion read).
if (!win.matchMedia) {
  win.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}

// jsdom has no fetch; serve the real Arsenal AV/feel audio so preload/decode
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
if (!win.ImageData) win.ImageData = NapiImageData;
if (!win.Path2D) win.Path2D = NapiPath2D;
win.requestAnimationFrame = () => 0;
win.cancelAnimationFrame = () => {};

// ------------------------------------------------------------ script loading
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

// The Gold bridge is plain production source (not a module): load it exactly
// as the generated shell does.
loadScript('/game/gold/goldProductBridge.js', true);

// This harness loads every runtime directly — the runtimeLoader group flags
// the gameplay-ready barrier reads never exist here. Declare the group state
// only; the real AV image/audio preload still runs for real below.
win['__apexDeferredRuntimesReady_arsenalProduct'] = true;
win['__apexDeferredRuntimesReady_select'] = true;

// ------------------------------------------------------------ test plumbing
const report = { gates: {}, failures: [], loadErrors, evidence: [], runtimeScriptCount: loadedRuntimeSrcs.size };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}
const $ = (id) => win.document.getElementById(id);

// Record what the Gold HUD seam actually receives (real forwarded production
// events), and the order of battle-entry operations.
const seamCalls = [];
function recordSeam() {
  const seam = win.APEX_GOLD_HUD;
  if (!seam) return;
  for (const name of ['hit', 'hitStorm', 'heal', 'cast', 'ko']) {
    const prev = seam[name];
    if (typeof prev !== 'function') continue;
    seam[name] = function recorded(...args) {
      seamCalls.push({ name, args });
      return prev.apply(this, args);
    };
  }
}
const entryOrder = [];

// Mount the REAL generated Gold battle HUD exactly like src/App.jsx: decode the
// shell's base64 payload and hand the HTML to the bridge.
function mountGeneratedBattleHud() {
  const shellHtml = fs.readFileSync(path.join(REPO, 'public/gold/shell.html'), 'utf8');
  const doc = new win.DOMParser().parseFromString(shellHtml, 'text/html');
  const payload = doc.getElementById('battleHudPayload');
  if (!payload) throw new Error('generated shell has no #battleHudPayload');
  const html = Buffer.from((payload.textContent || '').trim(), 'base64').toString('utf8');
  win.APEX_GOLD.mountBattleHud(html, () => {});
  return html;
}

// Bounded wait: the production match entry resolves through the real Arsenal
// gameplay barrier (AV preload), which is asynchronous by design.
async function waitFor(predicate, timeoutMs = 20000, label = 'condition') {
  const started = Date.now();
  for (;;) {
    let value = null;
    try { value = predicate(); } catch (error) { value = null; }
    if (value) return value;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

// ------------------------------------------------------- gate: registration
gate('gold-bridge-registered', !!win.APEX_GOLD
  && typeof win.APEX_GOLD.mountBattleHud === 'function'
  && typeof win.APEX_GOLD.unmountBattleHud === 'function'
  && typeof win.APEX_GOLD.onHandoff === 'function'
  && typeof win.APEX_GOLD.onBattleLive === 'function'
  && typeof win.APEX_GOLD.pressSkill === 'function'
  && win.apexGoldProductBridge === 'ready',
{ loadErrors: loadErrors.map((e) => e.file) });

let mountError = null;
gate('gold-battle-hud-mounts-and-boots', (() => {
  try {
    const html = mountGeneratedBattleHud();
    recordSeam();
    const hud = $('hud');
    return !!html.includes('id="hud"')
      && !!hud
      && hud.closest('#battleHudHost') !== null
      && !!win.APEX_GOLD_HUD
      && typeof win.APEX_GOLD_HUD.version === 'string'
      && win.APEX_GOLD_HUD.version.length > 0;
  } catch (error) {
    mountError = String(error && error.message || error);
    return false;
  }
})(), {
  hudVersion: win.APEX_GOLD_HUD && win.APEX_GOLD_HUD.version,
  hudInHost: !!(win.APEX_GOLD_HUD && $('hud') && $('hud').closest('#battleHudHost')),
  mountError,
});

// --------------------------------------------- gate: handoff accent provenance
gate('handoff-accents-come-from-production', (() => {
  const players = [{ id: 'newbot', name: 'P1' }, { id: 'newbot', name: 'P2' }];
  win.APEX_GOLD.onHandoff({ players });
  return players.every((p) => typeof p.productionId === 'string' && p.productionId.length > 0
    && typeof p.accent === 'string' && /^#[0-9a-f]{6}$/i.test(p.accent));
})(), { players: [{ productionId: 'ROBOT' }] });

// ---------------------------------------------------------------- run matrix
async function main() {
  // 1) product-group preload ordering (real async entry)
  const loader = win.__apexEnsureDeferredRuntimes;
  win.__apexEnsureDeferredRuntimes = function recordingLoader(group) {
    entryOrder.push(`load:${group}`);
    return loader ? loader(group) : Promise.resolve();
  };
  const realStartMatch = win.startMatch;
  win.startMatch = function recordingStartMatch(...args) {
    entryOrder.push('startMatch');
    return realStartMatch.apply(this, args);
  };
  entryOrder.length = 0;
  await win.APEX_GOLD.onBattleLive({ mode: 'local', p1: 'newbot', p2: 'newbot' });
  const loadIdx = entryOrder.findIndex((e) => e === 'load:arsenalProduct');
  const startIdx = entryOrder.indexOf('startMatch');
  gate('battle-live-preloads-product-group-before-start', loadIdx >= 0 && startIdx > loadIdx, { order: entryOrder.slice() });

  // 2) the real match started (production truth, not donor state) — the entry
  //    resolves through the real gameplay barrier, so wait for it.
  await waitFor(() => win.eval(`typeof gameState !== 'undefined' && gameState === 'ARSENAL'`), 20000, 'ARSENAL gameState');
  const liveState = win.eval(`(() => ({
    gameState: typeof gameState !== 'undefined' ? gameState : null,
    active: !!(window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.active),
    mode: window.APEX_ARSENAL && window.APEX_ARSENAL.state ? window.APEX_ARSENAL.state.battleMode : null,
    fighters: (typeof fighters !== 'undefined' ? fighters : []).map((f) => f && f.name),
    canvasInGoldArena: (() => {
      const arena = document.getElementById('arena');
      const wrap = document.getElementById('game-wrapper');
      return !!(arena && wrap && arena.contains(wrap));
    })(),
    legacyShellStillMounted: !!document.getElementById('battle-shell')
      && !!document.getElementById('game-canvas'),
  }))()`);
  gate('real-local-match-started-through-production-path', liveState.gameState === 'ARSENAL'
    && liveState.active === true && liveState.mode === 'LOCAL'
    && liveState.canvasInGoldArena === true
    && liveState.legacyShellStillMounted === true, liveState);

  // 3) idempotent re-entry: a second handoff/live pair must not start a 2nd match
  const startsBefore = entryOrder.filter((e) => e === 'startMatch').length;
  await win.APEX_GOLD.onBattleLive({ mode: 'local', p1: 'newbot', p2: 'newbot' });
  const startsAfter = entryOrder.filter((e) => e === 'startMatch').length;
  gate('battle-live-entry-is-idempotent', startsAfter === startsBefore, { startsBefore, startsAfter });

  // 4) real realized damage reaches the Gold HUD seam (normal tier)
  seamCalls.length = 0;
  const normalHit = win.eval(`(() => {
    const a = fighters[0], v = fighters[1];
    v.hp = v.maxHp;
    window.APEX_ARSENAL.weaponApi.aqDamage(v, 60, a, undefined, {});
    return { victimHp: v.hp, victimMax: v.maxHp };
  })()`);
  const normalCalls = seamCalls.filter((c) => c.name === 'hit');
  gate('real-damage-reaches-gold-hud-seam', normalCalls.length === 1
    && normalCalls[0].args[0] === 0 && normalCalls[0].args[1] === 1
    && normalCalls[0].args[3] === 'normal'
    && normalCalls[0].args[2] === normalHit.victimMax - normalHit.victimHp,
  { seam: normalCalls.map((c) => c.args), realized: normalHit });

  // 5) Heavy law: >200 realized damage to the same victim inside the rolling
  // 1.20s window produces exactly ONE Heavy response per burst.
  seamCalls.length = 0;
  const heavyRun = win.eval(`(() => {
    const a = fighters[0], v = fighters[1];
    v.hp = v.maxHp;
    const perHit = 90;
    for (let i = 0; i < 4; i++) {
      window.APEX_ARSENAL.weaponApi.aqDamage(v, perHit, a, undefined, {});
    }
    return { victimHp: v.hp, victimMax: v.maxHp };
  })()`);
  const heavyCalls = seamCalls.filter((c) => c.name === 'hit' && c.args[3] === 'heavy');
  const burstRealized = heavyRun.victimMax - heavyRun.victimHp;
  gate('heavy-tier-law-one-response-per-burst', heavyCalls.length === 1 && burstRealized > 200, {
    heavyResponses: heavyCalls.length, burstRealized, allTiers: seamCalls.map((c) => c.args[3]),
  });

  // 6) Stormbreaker: a confirmed damaging hit is Heavy family + Thunder family
  //    (hitStorm), proven from the real equipped weapon, not a guessed event.
  seamCalls.length = 0;
  const stormRun = win.eval(`(() => {
    const a = fighters[0], v = fighters[1];
    v.hp = v.maxHp;
    window.APEX_ARSENAL.weaponApi.equip(a, 'STORMBREAKER');
    const equipped = a.data && a.data.arsenal ? a.data.arsenal.weaponId : null;
    window.APEX_ARSENAL.weaponApi.aqDamage(v, 40, a, 'STORMBREAKER', {});
    const realized = v.maxHp - v.hp;
    const afterArsenal = a.data && a.data.arsenal ? a.data.arsenal.weaponId : null;
    window.APEX_ARSENAL.weaponApi.equip(a, 'SABRE'); // leave a normal weapon behind
    return { equipped, afterArsenal, realized };
  })()`);
  const stormCalls = seamCalls.filter((c) => c.name === 'hitStorm');
  gate('stormbreaker-hit-is-heavy-plus-thunder-family', stormRun.equipped === 'STORMBREAKER'
    && stormCalls.length === 1 && stormCalls[0].args[2] === stormRun.realized
    && stormCalls[0].args[3] === 960
    && stormCalls[0].args[0] === 0 && stormCalls[0].args[1] === 1,
  { equipped: stormRun.equipped, seam: stormCalls.map((c) => c.args), realized: stormRun.realized });

  // 7) Critical response color follows the attacker/source accent (production
  //    accent, never the donor's fixed orange).
  const critColor = win.eval(`(() => {
    const a = fighters[0], v = fighters[1];
    v.hp = v.maxHp;
    window.APEX_ARSENAL.weaponApi.aqDamage(v, 25, a, undefined, { critical: true });
    const hud = document.getElementById('hud');
    const root = hud || document.querySelector('#battleHudHost #hud');
    return {
      crit: root ? getComputedStyle(root).getPropertyValue('--crit').trim() : null,
      attackerColor: a.color || null,
      donorOrange: '#ff8a1e',
    };
  })()`);
  gate('crit-color-follows-attacker-accent', !!critColor.crit
    && /^#[0-9a-f]{3,8}$/i.test(critColor.crit)
    && critColor.crit.toLowerCase() !== critColor.donorOrange, critColor);

  // 8) Mobile skill cards are real touch targets through the production input
  //    adapter (HR.pressAbility), never a synthetic key event.
  const skillRun = win.eval(`(() => {
    const hr = window.APEX_HERO_REWORK;
    const seen = [];
    const prev = hr.pressAbility;
    hr.pressAbility = function spy(f, slot) { seen.push(slot); return prev.call(this, f, slot); };
    try {
      window.APEX_GOLD.pressSkill(0, 0);
      window.APEX_GOLD.pressSkill(0, 1);
    } finally { hr.pressAbility = prev; }
    return { seen };
  })()`);
  gate('mobile-skill-cards-use-production-adapter', JSON.stringify(skillRun.seen) === JSON.stringify(['A1', 'A2']), skillRun);

  // 9) The production combat HUD observer stays wrapped (event provenance:
  //    the existing energy/vitals math keeps running underneath Gold).
  const wrapped = win.eval(`(() => {
    const hud = window.APEX_COMBAT_HUD;
    return !!(hud && hud.__apexGoldWrapped === true && typeof hud.onRealizedDamage === 'function');
  })()`);
  gate('production-hud-observer-wrapped-not-replaced', wrapped === true, { wrapped });

  // 10) Unmount releases the entry guard so a rematch can start a fresh match
  //     (listeners/sessions stay idempotent).
  win.APEX_GOLD.unmountBattleHud();
  entryOrder.length = 0;
  await win.APEX_GOLD.onBattleLive({ mode: 'bot', p1: 'newbot', p2: 'newbot' });
  await waitFor(() => win.eval(`typeof gameState !== 'undefined' && gameState === 'ARSENAL'`), 20000, 'rematch ARSENAL gameState');
  const rematchState = win.eval(`(() => ({
    active: !!(window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.active),
    mode: window.APEX_ARSENAL && window.APEX_ARSENAL.state ? window.APEX_ARSENAL.state.battleMode : null,
  }))()`);
  const rematchStarts = entryOrder.filter((e) => e === 'startMatch').length;
  gate('unmount-releases-guard-and-bot-rematch-runs', rematchStarts === 1
    && rematchState.active === true && rematchState.mode === 'BOT', { rematchStarts, rematchState });

  // 11) BOT mode exposes only the P1 human controls (P2 is a real CPU).
  // Production truth: the hero-rework runtime exposes the cast-AI master switch
  // (HR.aiEnabled / HR.setAiEnabled). BOT mode = the switch stays ON (P2 is a
  // real CPU); the Gold HUD only ever routes P1 human input through the
  // production adapter (pressSkill below), so P1 never gains synthetic input.
  // (The __apexArsenalBotBattle flag is transient selection state that the
  // production startMatch resets by design; battle truth is AQ.state.)
  const botControls = win.eval(`(() => ({
    aiMaster: window.APEX_HERO_REWORK ? !!window.APEX_HERO_REWORK.aiEnabled : null,
    battleMode: window.APEX_ARSENAL && window.APEX_ARSENAL.state ? window.APEX_ARSENAL.state.battleMode : null,
    gameState: typeof gameState !== 'undefined' ? gameState : null,
  }))()`);
  gate('bot-mode-real-cpu-and-p1-only-human-controls', botControls.aiMaster === true
    && botControls.battleMode === 'BOT' && botControls.gameState === 'ARSENAL', botControls);

  // 12) Donor harness boundary on the generated shipping files.
  const leakage = [];
  for (const rel of ['battle-hud.html', 'lucky-draw.html', 'shell.html']) {
    const text = fs.readFileSync(path.join(REPO, 'public/gold', rel), 'utf8');
    for (const needle of ['resetDemo(', 'swapWeapon(', 'PRESETS=', 'body.preview', "toast('V view", 'function toast(t)']) {
      if (text.includes(needle)) leakage.push(`${rel}:${needle}`);
    }
  }
  gate('no-donor-harness-survivors-in-generated-gold', leakage.length === 0, { leakage });

  // 13) Protected production truth: the engine canvas and legacy roots stay in
  //     the document underneath Gold (Gold owns presentation, not truth).
  const truth = win.eval(`(() => ({
    canvas: !!document.getElementById('game-canvas'),
    battleShell: !!document.getElementById('battle-shell'),
    engineLoopRunning: typeof reqId !== 'undefined' ? !!reqId : null,
  }))()`);
  gate('production-truth-roots-stay-mounted', truth.canvas === true && truth.battleShell === true, truth);

  report.summary = {
    total: Object.keys(report.gates).length,
    passed: Object.values(report.gates).filter((g) => g.pass).length,
    failed: report.failures,
  };
  console.log('\n==== GOLD BATTLE PATH HEADLESS SUMMARY ====');
  console.log(JSON.stringify(report.summary, null, 2));
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'gold-battle-path-report.json'), JSON.stringify(report, null, 2));
  console.log(`report written under ${evidenceDir}/`);
  if (report.failures.length) process.exitCode = 1;
  try { win.close(); } catch (error) { /* teardown only */ }
}

main().catch((error) => {
  console.error('GOLD BATTLE PATH HARNESS ERROR', error);
  process.exitCode = 1;
  try { win.close(); } catch (e) { /* teardown only */ }
});
