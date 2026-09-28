#!/usr/bin/env node
/* Generate real-game visual evidence for ROBOT final integration */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BOOT_GAME_RUNTIMES, MODE_DEFERRED_RUNTIMES } from '../src/game/runtimeManifest.js';

const REPO = process.cwd();
const TOOLING_DIR = process.env.AQ_TOOLING_DIR || path.join(REPO, 'node_modules');
const requireTool = createRequire(path.join(TOOLING_DIR, 'noop.js'));
const { JSDOM } = requireTool('jsdom');
const { createCanvas, loadImage, GlobalFonts, Path2D: CanvasPath2D } = requireTool('@napi-rs/canvas');
GlobalFonts.registerFromPath(path.join(REPO, 'public', 'assets', 'fonts', 'kanit', 'Kanit-BlackItalic.ttf'), 'ApcKanit');

const evidenceDir = path.join(REPO, 'docs/hero-rework/robot-final/evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const dom = new JSDOM(`<!doctype html><html><body>
  <div id="battle-shell">
    <aside id="p1-combat-panel" class="combat-panel"><div class="cp-identity"><span id="p1-cp-chip"></span><div id="p1-name">P1</div><div class="hp-bar-bg"><div id="p1-hp-loss"></div><div id="p1-hp"></div><div id="p1-hp-text"></div></div><div id="p1-rage"></div></div><div id="p1-burst"><div id="p1-burst-label"></div><div id="p1-burst-total">0</div><span id="p1-burst-hits">0 HITS</span><span id="p1-burst-crits">0 CRIT</span></div><div id="p1-loadout"><canvas id="p1-loadout-canvas" width="480" height="240"></canvas><div id="p1-loadout-fallback"><span id="p1-cp-glyph"></span><span id="p1-loadout-fallback-label">UNARMED</span></div><div id="p1-loadout-name">—</div><span id="p1-loadout-family"></span><span id="p1-loadout-tier"></span></div><div id="p1-energy"><span id="p1-energy-val">0</span><div id="p1-energy-fill"></div><div id="p1-energy-state"></div></div><div id="p1-mode-slot"></div></aside>
  <div id="game-wrapper"><canvas id="game-canvas" width="1000" height="1000"></canvas><div id="countdown-overlay" style="display:none"><div id="countdown-num">3</div><div id="countdown-sub"></div></div><div class="ui-layer" id="hud"><div id="manual-lab-hud" class="hidden"></div></div><div id="battle-controls" class="hidden"></div><div id="menu-screen" class="screen"></div><div id="select-screen" class="screen hidden"><div id="select-title"></div><button id="start-btn" class="hidden"></button><div id="apex-pick-runtime-root"></div></div><div id="manual-room-screen" class="screen hidden"></div><div id="tournament-screen" class="screen hidden"></div><div id="end-screen" class="screen hidden"><div id="winner-text"></div><div id="stats-panel"></div><button id="tournament-return-btn" class="hidden"></button><button id="challenge-retry-btn" class="hidden"></button></div><div id="solo-screen" class="screen hidden"></div><div id="trial-screen" class="screen hidden"></div><div id="tam-chien-screen" class="screen hidden"></div><div id="roster-grid"></div></div>
    <aside id="p2-combat-panel" class="combat-panel"><div class="cp-identity"><span id="p2-cp-chip"></span><div id="p2-name">P2</div><div class="hp-bar-bg"><div id="p2-hp-loss"></div><div id="p2-hp"></div><div id="p2-hp-text"></div></div><div id="p2-rage"></div></div><div id="p2-burst"><div id="p2-burst-label"></div><div id="p2-burst-total">0</div><span id="p2-burst-hits">0 HITS</span><span id="p2-burst-crits">0 CRIT</span></div><div id="p2-loadout"><canvas id="p2-loadout-canvas" width="480" height="240"></canvas><div id="p2-loadout-fallback"><span id="p2-cp-glyph"></span><span id="p2-loadout-fallback-label">UNARMED</span></div><div id="p2-loadout-name">—</div><span id="p2-loadout-family"></span><span id="p2-loadout-tier"></span></div><div id="p2-energy"><span id="p2-energy-val">0</span><div id="p2-energy-fill"></div><div id="p2-energy-state"></div></div><div id="p2-mode-slot"></div></aside>
  </div>
</body></html>`, { pretendToBeVisual: true, runScripts: 'dangerously', url: 'http://localhost/' });

const win = dom.window;
win.__apexStatsSilent = true;
win.Path2D = CanvasPath2D;
global.Path2D = CanvasPath2D;

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

class ParamStub { constructor() { this.value = 0; } setValueAtTime() { return this; } exponentialRampToValueAtTime() { return this; } linearRampToValueAtTime() { return this; } setTargetAtTime() { return this; } cancelScheduledValues() { return this; } }
class AudioNodeStub {
  constructor() { this.gain = new ParamStub(); this.frequency = new ParamStub(); this.Q = new ParamStub(); this.detune = new ParamStub(); this.pan = new ParamStub(); this.buffer = null; this.loop = false; this.type = 'sine'; }
  connect() { return this; } disconnect() {} start() {} stop() {}
}
class AudioContextStub {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000; this.destination = new AudioNodeStub(); }
  decodeAudioData(buf) {
    const seconds = Math.max(0.05, (buf && buf.byteLength ? buf.byteLength / 2 / 48000 : 0.5));
    return Promise.resolve({ duration: seconds, sampleRate: 48000, length: Math.floor(seconds * 48000) });
  }
  createGain() { return new AudioNodeStub(); } createOscillator() { return new AudioNodeStub(); }
  createBufferSource() { return new AudioNodeStub(); } createBiquadFilter() { return new AudioNodeStub(); }
  createStereoPanner() { return new AudioNodeStub(); } createDynamicsCompressor() { return new AudioNodeStub(); }
  createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, getChannelData: () => new Float32Array(len) }; }
  resume() { return Promise.resolve(); }
}
win.AudioContext = AudioContextStub;
win.webkitAudioContext = AudioContextStub;
win.fetch = (url) => {
  const u = String(url);
  if (u.includes('/assets/')) {
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

function loadScript(relPath, required) {
  const fileRelPath = String(relPath).split(/[?#]/, 1)[0];
  const file = path.join(REPO, 'public', fileRelPath.replace(/^\//, ''));
  try { win.eval(fs.readFileSync(file, 'utf8')); return true; } catch (error) {
    console.error(`Failed to load ${relPath}: ${error.message}`);
    if (required) throw error;
    return false;
  }
}
loadScript('/apexEngine.js', true);
const loaded = new Set();
for (const [src] of BOOT_GAME_RUNTIMES) { loaded.add(String(src).split(/[?#]/,1)[0]); loadScript(src, false); }
for (const [src] of MODE_DEFERRED_RUNTIMES.arsenalQuest) {
  const key = String(src).split(/[?#]/,1)[0];
  if (loaded.has(key)) continue;
  loadScript(src, true);
}
win['__apexDeferredRuntimesReady_arsenalQuest'] = true;

win.eval(`
  window.__HR_Q = {
    start(p1,p2,seed){
      if (window.APEX_HERO_REWORK && seed!=null) window.APEX_HERO_REWORK.setSeed(seed);
      window.APEX_HERO_REWORK.setAiEnabled(false);
      window.startArsenalQuestMode(p1,p2);
      const s = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
      if (s) { s.spawnTimer=1e6; s.slots=[]; s.unarmedFastConsumed=true; s.spawnHeld=true; }
      return window.APEX_HERO_REWORK.match;
    },
    step(dt){ window.APEX_ARSENAL && window.APEX_ARSENAL.step(dt); },
    damage(a,b,amt){ return window.APEX_ARSENAL && window.APEX_ARSENAL.api && window.APEX_ARSENAL.api.aqDamage(b, amt, a, 'PISTOL'); },
    castA1(f){ return window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.tryCast(f,'A1','p1'); },
    castA2(f){ return window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.tryCast(f,'A2','p1'); },
    getFighter(idx){ return window.fighters && window.fighters[idx]; }
  };
`);

function saveCanvas(el, outPath) {
  const rc = realCanvases.get(el) || realCanvasFor(el);
  const buf = rc.toBuffer('image/png');
  fs.writeFileSync(outPath, buf);
  console.log(`Saved ${outPath} (${buf.length} bytes)`);
}

async function main() {
  const Q = win.__HR_Q;
  const match = Q.start('ROBOT','ICE', 1234);
  // step a few frames to init
  for (let i=0;i<10;i++) Q.step(1/60);

  const gameCanvas = win.document.getElementById('game-canvas');
  const p1 = Q.getFighter(0);
  const p2 = Q.getFighter(1);
  const RP = win.APEX_ROBOT_PRESENTATION;
  if (!RP) { console.error('Robot presentation not loaded'); process.exit(1); }
  RP.ensureSprites();
  console.log('Sprites ready?', RP.SPR().ready);

  // Helper to set pose and render
  function setPoseAndCapture(name, pose, extra) {
    const st = RP.getRobotState(p1);
    if (!st) { console.error('no state for p1'); return; }
    // reset pose
    st.POSE = { ...{calTh:0,calDx:0,calDy:0,spin:0,crest:0,chin:0,cheekX:0,cheekY:0,lid:0,glow:1,seam:0}, ...pose };
    // apply extra flags
    if (extra) Object.assign(st, extra);
    // step springs 20 times to settle a bit
    for (let i=0;i<20;i++) {
      // manually step springs towards pose
      for (const k in st.R) {
        const v = st.R[k];
        if (Array.isArray(v)) v.forEach(s => { s.g = st.POSE[k] != null ? st.POSE[k] : (k==='glow'?1:0); s.step(1/60); });
        else { v.g = st.POSE[k] != null ? st.POSE[k] : (k==='glow'?1:0); v.step(1/60); }
      }
    }
    // force draw
    win.draw && win.draw();
    // also draw fighter directly to game canvas via engine draw
    // The engine draw is called via win.draw() already, but we can also ensure
    saveCanvas(gameCanvas, path.join(evidenceDir, `${name}.png`));
  }

  // Poses from authority
  const P_IDLE = {};
  const P_HELD = { calTh:-.05, calDx:6 };
  const P_A1_FOCUS = { lid:.3, glow:1.3, spin: Math.PI/4, crest:-14, calTh:.06 };
  const P_A1_COMMIT = { calTh:.27, calDx:-8, crest:-54, chin:12, cheekX:-10, lid:.7, glow:1.75, spin: Math.PI/2 };
  const P_A1_CONTACT = { calTh:-.09, calDx:12, crest:-16, chin:-6, lid:.35, glow:1.4, spin: Math.PI };
  const P_A2_INDEX = { calTh:.04, calDx:34, crest:18, lid:.26, spin: Math.PI/4 };
  const P_A2_LOCK = { calTh:.13, calDx:88, calDy:10, crest:58, chin:-22, cheekX:24, cheekY:-20, lid:.62, glow:1.12, spin: Math.PI/2, seam:.45 };

  setPoseAndCapture('01-idle', P_IDLE, { held:false, armor:false, trailOn:false });
  setPoseAndCapture('02-held', P_HELD, { held:true, armor:false });
  setPoseAndCapture('03-a1-focus', P_A1_FOCUS, { held:false, armor:false, brackets:{t0:0, state:'in'} });
  setPoseAndCapture('04-a1-commit', P_A1_COMMIT, { held:false, armor:false, trailOn:true });
  setPoseAndCapture('05-a1-contact', P_A1_CONTACT, { held:true, armor:false });
  setPoseAndCapture('06-a2-index', P_A2_INDEX, { held:false, armor:false });
  setPoseAndCapture('07-a2-lock', P_A2_LOCK, { held:false, armor:true, lockFlash:1 });

  // Simulate real gameplay: A1 dash
  // Give robot a weapon pickup to dash to
  // Create a fake slot
  win.eval(`
    const api = window.APEX_ARSENAL && window.APEX_ARSENAL.api;
    if (api) {
      const slot = { id: 9999, x: 700, y: 500, weaponId: 'PISTOL', phase: 'REVEALED', pickedBy: null };
      window.APEX_ARSENAL.state.slots.push(slot);
    }
  `);
  Q.castA1(p1);
  for (let i=0;i<30;i++) { Q.step(1/60); win.draw && win.draw(); }
  saveCanvas(gameCanvas, path.join(evidenceDir, '08-a1-dash-live.png'));

  // A2 armor
  Q.castA2(p1);
  for (let i=0;i<20;i++) { Q.step(1/60); win.draw && win.draw(); }
  saveCanvas(gameCanvas, path.join(evidenceDir, '09-a2-armor-live.png'));

  // Hit response
  Q.damage(p2, p1, 50);
  for (let i=0;i<10;i++) { Q.step(1/60); win.draw && win.draw(); }
  saveCanvas(gameCanvas, path.join(evidenceDir, '10-hit-response.png'));

  // Wall response - move robot to wall
  win.eval(`window.fighters[0].x = 50; window.fighters[0].y = 500;`);
  for (let i=0;i<10;i++) { Q.step(1/60); win.draw && win.draw(); }
  saveCanvas(gameCanvas, path.join(evidenceDir, '11-wall-response.png'));

  console.log('Evidence generation complete');
}

main().catch(e => { console.error(e); process.exit(1); });
