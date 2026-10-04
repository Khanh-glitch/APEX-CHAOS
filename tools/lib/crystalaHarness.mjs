// Shared Hero Rework headless harness: boots the REAL engine and active
// Arsenal product runtimes in jsdom on @napi-rs/canvas, with the generic
// ImageData/Path2D shims the Hunter V10 art path needs under jsdom.
// No gameplay is faked: matches start through startArsenalBattleMode and
// advance through the shared APEX_ARSENAL.step used by rAF and these suites.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BOOT_GAME_RUNTIMES, MODE_DEFERRED_RUNTIMES, resolveLegacyRuntimeFile } from '../legacyRuntimeManifest.mjs';
import { installProductSurfaceAuthority } from '../../src/game/productSurface.js';

const REPO = process.cwd();
const requireTool = createRequire(path.join(REPO, 'node_modules', 'noop.js'));

export const SKELETON = `<!doctype html><html><body>
  <div id="battle-shell">
    <aside id="p1-combat-panel" class="combat-panel">
      <div class="cp-identity"><span id="p1-cp-chip"></span><div id="p1-name">P1</div>
        <div class="hp-bar-bg"><div id="p1-hp-loss"></div><div id="p1-hp"></div><div id="p1-hp-text"></div></div><div id="p1-rage"></div></div>
      <div id="p1-burst"><div id="p1-burst-label"></div><div id="p1-burst-total">0</div><span id="p1-burst-hits">0 HITS</span><span id="p1-burst-crits">0 CRIT</span></div>
      <div id="p1-loadout"><canvas id="p1-loadout-canvas" width="480" height="240"></canvas><div id="p1-loadout-fallback"><span id="p1-cp-glyph"></span><span id="p1-loadout-fallback-label">UNARMED</span></div><div id="p1-loadout-name">—</div><span id="p1-loadout-family"></span><span id="p1-loadout-tier"></span></div>
      <div id="p1-energy"><span id="p1-energy-val">0</span><div id="p1-energy-fill"></div><div id="p1-energy-state"></div></div><div id="p1-mode-slot"></div>
    </aside>
  <div id="game-wrapper">
    <canvas id="game-canvas" width="1000" height="1000"></canvas>
    <div id="countdown-overlay" style="display:none"><div id="countdown-num">3</div><div id="countdown-sub"></div></div>
    <div class="ui-layer" id="hud"></div>
    <div id="menu-screen" class="screen"></div>
    <div id="select-screen" class="screen hidden"><div id="select-title"></div><button id="start-btn" class="hidden"></button><div id="apex-pick-runtime-root"></div></div>
    <div id="end-screen" class="screen hidden"><div id="winner-text"></div><div id="stats-panel"></div></div>
    <div id="roster-grid"></div>
  </div>
    <aside id="p2-combat-panel" class="combat-panel">
      <div class="cp-identity"><span id="p2-cp-chip"></span><div id="p2-name">P2</div>
        <div class="hp-bar-bg"><div id="p2-hp-loss"></div><div id="p2-hp"></div><div id="p2-hp-text"></div></div><div id="p2-rage"></div></div>
      <div id="p2-burst"><div id="p2-burst-label"></div><div id="p2-burst-total">0</div><span id="p2-burst-hits">0 HITS</span><span id="p2-burst-crits">0 CRIT</span></div>
      <div id="p2-loadout"><canvas id="p2-loadout-canvas" width="480" height="240"></canvas><div id="p2-loadout-fallback"><span id="p2-cp-glyph"></span><span id="p2-loadout-fallback-label">UNARMED</span></div><div id="p2-loadout-name">—</div><span id="p2-loadout-family"></span><span id="p2-loadout-tier"></span></div>
      <div id="p2-energy"><span id="p2-energy-val">0</span><div id="p2-energy-fill"></div><div id="p2-energy-state"></div></div><div id="p2-mode-slot"></div>
    </aside>
  </div>
</body></html>`;

export async function bootHarness(opts = {}) {
  const { JSDOM } = requireTool('jsdom');
  const canvasPkg = requireTool('@napi-rs/canvas');
  const { createCanvas, loadImage, GlobalFonts } = canvasPkg;
  try { GlobalFonts.registerFromPath(path.join(REPO, 'public', 'assets', 'fonts', 'kanit', 'Kanit-BlackItalic.ttf'), 'ApcKanit'); } catch (e) { /* font optional */ }
  const dom = new JSDOM(SKELETON, { pretendToBeVisual: true, runScripts: 'dangerously', url: 'http://localhost/' });
  const win = dom.window;
  installProductSurfaceAuthority(win);
  win.__APEX_TEST_MODE = true;
  win.__apexStatsSilent = true;
  // One-time owner-test credit grant marker (canonical meta law) so the grant does not perturb saves.
  try { win.localStorage.setItem('apexChaos.ownerTestCredits.20260930.v1', '1'); } catch (e) { /* ignore */ }

  // generic jsdom gaps (test-harness only; production code is untouched)
  if (!win.ImageData) win.ImageData = canvasPkg.ImageData;
  if (!win.Path2D) win.Path2D = canvasPkg.Path2D;

  const realCanvases = new WeakMap();
  function realCanvasFor(el) {
    let rc = realCanvases.get(el);
    const w = el.width || 300, h = el.height || 150;
    if (!rc || rc.width !== w || rc.height !== h) { rc = createCanvas(w, h); realCanvases.set(el, rc); }
    return rc;
  }
  win.HTMLCanvasElement.prototype.getContext = function (type) {
    if (type && type !== '2d') return null;
    const el = this;
    const realCtx = realCanvasFor(el).getContext('2d');
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
  const gameCanvasReal = win.document.getElementById('game-canvas').getContext('2d').canvas;

  class ParamStub { constructor() { this.value = 0; } setValueAtTime() { return this; } exponentialRampToValueAtTime() { return this; } linearRampToValueAtTime() { return this; } setTargetAtTime() { return this; } cancelScheduledValues() { return this; } }
  class AudioNodeStub {
    constructor() { this.gain = new ParamStub(); this.frequency = new ParamStub(); this.Q = new ParamStub(); this.detune = new ParamStub(); this.pan = new ParamStub(); this.buffer = null; this.loop = false; this.type = 'sine'; }
    connect() { return this; } disconnect() {} start() {} stop() {}
  }
  class AudioContextStub {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000; this.destination = new AudioNodeStub(); }
    decodeAudioData(buf) { const seconds = Math.max(0.05, (buf && buf.byteLength ? buf.byteLength / 2 / 48000 : 0.5)); return Promise.resolve({ duration: seconds, sampleRate: 48000, length: Math.floor(seconds * 48000) }); }
    createGain() { return new AudioNodeStub(); } createOscillator() { return new AudioNodeStub(); }
    createBufferSource() { return new AudioNodeStub(); } createBiquadFilter() { return new AudioNodeStub(); }
    createStereoPanner() { return new AudioNodeStub(); } createDynamicsCompressor() { return new AudioNodeStub(); }
    createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, getChannelData: () => new Float32Array(len) }; }
    resume() { return Promise.resolve(); }
  }
  win.AudioContext = AudioContextStub; win.webkitAudioContext = AudioContextStub;
  win.fetch = (url) => {
    const u = String(url);
    if (u.includes('/assets/arsenal/av/')) {
      const rel = u.slice(u.indexOf('/assets/') + 1);
      try {
        const data = fs.readFileSync(path.join(REPO, 'public', rel));
        const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(copy) });
      } catch (error) { return Promise.reject(error); }
    }
    return new Promise(() => {});
  };
  class HarnessImage {
    constructor() { this.complete = false; this.width = 0; this.height = 0; this.__realImage = null; this.onload = null; this.onerror = null; }
    set src(v) {
      this._src = v;
      const rel = String(v).replace(/^\//, '');
      loadImage(path.join(REPO, 'public', rel))
        .then((im) => { this.__realImage = im; this.width = im.width; this.height = im.height; this.naturalWidth = im.width; this.naturalHeight = im.height; this.complete = true; if (this.onload) this.onload(); })
        .catch(() => { if (this.onerror) this.onerror(); });
    }
    get src() { return this._src; }
  }
  win.Image = HarnessImage;
  win.requestAnimationFrame = () => 0;
  win.cancelAnimationFrame = () => {};

  const loadErrors = [];
  function loadScript(relPath, required) {
    const fileRelPath = String(relPath).split(/[?#]/, 1)[0];
    const file = resolveLegacyRuntimeFile(REPO, fileRelPath);
    try { win.eval(fs.readFileSync(file, 'utf8')); return true; } catch (error) {
      loadErrors.push({ file: relPath, error: String(error && error.message || error) });
      if (required) throw new Error(`Required runtime failed to load: ${relPath}: ${error}`);
      return false;
    }
  }
  loadScript('/apexEngine.js', true);
  const loaded = new Set();
  for (const [src] of BOOT_GAME_RUNTIMES) { loaded.add(String(src).split(/[?#]/, 1)[0]); loadScript(src, false); }
  for (const [src] of MODE_DEFERRED_RUNTIMES.arsenalProduct) {
    const key = String(src).split(/[?#]/, 1)[0];
    if (loaded.has(key)) continue;
    loaded.add(key);
    loadScript(src, true);
  }

  win.eval(`(() => {
    window.__HR_TEST = {
      start(p1, p2) {
        const started = window.startArsenalBattleMode(p1, p2, { testFixture: true });
        cancelAnimationFrame(reqId); reqId = 0;
        return started ? APEX_HERO_REWORK.match : null;
      },
      step(seconds, dt) { let t = seconds; dt = dt || 1/60; while (t > 1e-9) { const d = Math.min(dt, t); APEX_ARSENAL.step(d); t -= d; } },
      holdSpawns() { const s = APEX_ARSENAL.state; s.spawnTimer = 1e6; s.slots = []; s.unarmedFastConsumed = true; s.spawnHeld = true; },
      pushSlot(o) { const s = APEX_ARSENAL.state; const slot = Object.assign({ id: s.nextSlotId++, x: 500, y: 500, phase: 'REVEALED', weaponId: 'PISTOL', revealLeadSeconds: 1.5, revealedFor: 0, pickedBy: null, rejectedFor: {}, spawnTime: s.time, predictedHeroETA: null, predictedRivalETA: null, earliestETA: null, predictedFighter: null }, o); s.slots.push(slot); return slot.id; },
      redraw() { draw(); },
    };
    return window.__HR_TEST;
  })()`);

  const H = {
    win, dom, loadErrors, gameCanvasReal, REPO,
    T: win.__HR_TEST,
    get HR() { return win.APEX_HERO_REWORK; },
    get CRY() { return win.APEX_CRYSTAL; },
    get GOLD() { return win.APEX_CRYSTALA_GOLD; },
    get AIL() { return win.APEX_HERO_REWORK_AIL; },
    get CFG() { return win.APEX_ARSENAL_CONFIG; },
    get W() { return win.APEX_ARSENAL.weaponApi; },
    fighters: () => win.fighters,
    projectiles: () => win.projectiles,
    // wait (real time) until Hunter V10 art is ready — only needed for Hunter matchups
    async hunterReady(ms = 15000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { const P = win.APEX_HUNTER_PRESENTATION; if (P && P.ready) return true; await new Promise((r) => setTimeout(r, 50)); }
      return false;
    },
  };
  return H;
}
