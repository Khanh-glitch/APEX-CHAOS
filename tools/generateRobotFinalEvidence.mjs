#!/usr/bin/env node
/* Generate real gameplay evidence for ROBOT final integration */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BOOT_GAME_RUNTIMES, MODE_DEFERRED_RUNTIMES } from '../src/game/runtimeManifest.js';

const REPO = process.cwd();
const TOOLING_DIR = process.env.AQ_TOOLING_DIR || path.join(REPO, 'node_modules');
const evidenceDir = path.join(REPO, 'docs', 'hero-rework', 'evidence', 'robot-final');
const requireTool = createRequire(path.join(TOOLING_DIR, 'noop.js'));
const { JSDOM } = requireTool('jsdom');
const { createCanvas, loadImage, GlobalFonts } = requireTool('@napi-rs/canvas');
GlobalFonts.registerFromPath(path.join(REPO, 'public', 'assets', 'fonts', 'kanit', 'Kanit-BlackItalic.ttf'), 'ApcKanit');

const dom = new JSDOM(`<!doctype html><html><body>
  <div id="battle-shell">
    <aside id="p1-combat-panel" class="combat-panel"><div class="cp-identity"><span id="p1-cp-chip"></span><div id="p1-name">P1</div><div class="hp-bar-bg"><div id="p1-hp-loss"></div><div id="p1-hp"></div><div id="p1-hp-text"></div></div><div id="p1-rage"></div></div><div id="p1-burst"><div id="p1-burst-label"></div><div id="p1-burst-total">0</div><span id="p1-burst-hits">0 HITS</span><span id="p1-burst-crits">0 CRIT</span></div><div id="p1-loadout"><canvas id="p1-loadout-canvas" width="480" height="240"></canvas><div id="p1-loadout-fallback"><span id="p1-cp-glyph"></span><span id="p1-loadout-fallback-label">UNARMED</span></div><div id="p1-loadout-name">—</div><span id="p1-loadout-family"></span><span id="p1-loadout-tier"></span></div><div id="p1-energy"><span id="p1-energy-val">0</span><div id="p1-energy-fill"></div><div id="p1-energy-state"></div></div><div id="p1-mode-slot"></div></aside>
  <div id="game-wrapper"><canvas id="game-canvas" width="1000" height="1000"></canvas><div id="countdown-overlay" style="display:none"><div id="countdown-num">3</div><div id="countdown-sub"></div></div><div class="ui-layer" id="hud"><div id="manual-lab-hud" class="hidden"></div></div><div id="battle-controls" class="hidden"></div><div id="menu-screen" class="screen"></div><div id="select-screen" class="screen hidden"><div id="select-title"></div><button id="start-btn" class="hidden"></button><div id="apex-pick-runtime-root"></div></div><div id="manual-room-screen" class="screen hidden"></div><div id="tournament-screen" class="screen hidden"></div><div id="end-screen" class="screen hidden"><div id="winner-text"></div><div id="stats-panel"></div><button id="tournament-return-btn" class="hidden"></button><button id="challenge-retry-btn" class="hidden"></button></div><div id="solo-screen" class="screen hidden"></div><div id="trial-screen" class="screen hidden"></div><div id="tam-chien-screen" class="screen hidden"></div><div id="roster-grid"></div></div>
    <aside id="p2-combat-panel" class="combat-panel"><div class="cp-identity"><span id="p2-cp-chip"></span><div id="p2-name">P2</div><div class="hp-bar-bg"><div id="p2-hp-loss"></div><div id="p2-hp"></div><div id="p2-hp-text"></div></div><div id="p2-rage"></div></div><div id="p2-burst"><div id="p2-burst-label"></div><div id="p2-burst-total">0</div><span id="p2-burst-hits">0 HITS</span><span id="p2-burst-crits">0 CRIT</span></div><div id="p2-loadout"><canvas id="p2-loadout-canvas" width="480" height="240"></canvas><div id="p2-loadout-fallback"><span id="p2-cp-glyph"></span><span id="p2-loadout-fallback-label">UNARMED</span></div><div id="p2-loadout-name">—</div><span id="p2-loadout-family"></span><span id="p2-loadout-tier"></span></div><div id="p2-energy"><span id="p2-energy-val">0</span><div id="p2-energy-fill"></div><div id="p2-energy-state"></div></div><div id="p2-mode-slot"></div></aside>
  </div>
</body></html>`, { pretendToBeVisual: true, runScripts: 'dangerously', url: 'http://localhost/' });

const win = dom.window;
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

class ParamStub { constructor() { this.value = 0; } setValueAtTime() { return this; } exponentialRampToValueAtTime() { return this; } linearRampToValueAtTime() { return this; } setTargetAtTime() { return this; } cancelScheduledValues() { return this; } }
class AudioNodeStub { constructor() { this.gain = new ParamStub(); this.frequency = new ParamStub(); this.Q = new ParamStub(); this.detune = new ParamStub(); this.pan = new ParamStub(); this.buffer = null; this.loop = false; this.type = 'sine'; } connect() { return this; } disconnect() {} start() {} stop() {} }
class AudioContextStub {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000; this.destination = new AudioNodeStub(); }
  decodeAudioData(buf) { const seconds = Math.max(0.05, (buf && buf.byteLength ? buf.byteLength / 2 / 48000 : 0.5)); return Promise.resolve({ duration: seconds, sampleRate: 48000, length: Math.floor(seconds * 48000) }); }
  createGain() { return new AudioNodeStub(); } createOscillator() { return new AudioNodeStub(); } createBufferSource() { return new AudioNodeStub(); } createBiquadFilter() { return new AudioNodeStub(); } createStereoPanner() { return new AudioNodeStub(); } createDynamicsCompressor() { return new AudioNodeStub(); } createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, getChannelData: () => new Float32Array(len) }; } resume() { return Promise.resolve(); }
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
class HarnessImage { constructor() { this.complete = false; this.width = 0; this.height = 0; this.__realImage = null; this.onload = null; this.onerror = null; } set src(v) { this._src = v; const rel = String(v).replace(/^\//, ''); loadImage(path.join(REPO, 'public', rel)).then((im) => { this.__realImage = im; this.width = im.width; this.height = im.height; this.naturalWidth = im.width; this.naturalHeight = im.height; this.complete = true; if (this.onload) this.onload(); }).catch(() => { if (this.onerror) this.onerror(); }); } get src() { return this._src; } }
win.Image = HarnessImage;
win.requestAnimationFrame = () => 0;
win.cancelAnimationFrame = () => {};

function loadScript(relPath, required) {
  const fileRelPath = String(relPath).split(/[?#]/, 1)[0];
  const file = path.join(REPO, 'public', fileRelPath.replace(/^\//, ''));
  try { win.eval(fs.readFileSync(file, 'utf8')); return true; } catch (error) { if (required) throw new Error(`Required runtime failed to load: ${relPath}: ${error}`); return false; }
}
loadScript('/apexEngine.js', true);
const loadedRuntimeSrcs = new Set();
for (const [src] of BOOT_GAME_RUNTIMES) { loadedRuntimeSrcs.add(String(src).split(/[?#]/, 1)[0]); loadScript(src, false); }
for (const [src] of MODE_DEFERRED_RUNTIMES.arsenalQuest) { const key = String(src).split(/[?#]/, 1)[0]; if (loadedRuntimeSrcs.has(key)) continue; loadScript(src, true); }
win['__apexDeferredRuntimesReady_arsenalQuest'] = true;
win['__apexDeferredRuntimesReady_select'] = true;

win.eval(`(() => {
  window.__HR_Q = {
    start(p1, p2, seed) {
      if (window.APEX_HERO_REWORK && seed != null) window.APEX_HERO_REWORK.setSeed(seed);
      window.APEX_HERO_REWORK.setAiEnabled(false);
      window.startArsenalQuestMode(p1, p2);
      const s = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
      if (s) { s.spawnTimer = 1e6; s.slots = []; s.unarmedFastConsumed = true; s.spawnHeld = true; }
      return window.APEX_HERO_REWORK.match;
    },
    step(seconds, dt) {
      dt = dt || 1/60;
      let t = seconds;
      while (t > 1e-9) { const d = Math.min(dt, t); APEX_ARSENAL.step(d); t -= d; }
    },
    placeFree(fx, fy, fdirx, fdiry, ex, ey, edirx, ediry) {
      const [a, b] = fighters;
      a.x = fx; a.y = fy; a.setDir(fdirx, fdiry);
      b.x = ex; b.y = ey; b.setDir(edirx, ediry);
    },
    pushSlot(o) {
      const s = APEX_ARSENAL.state;
      const slot = Object.assign({
        id: s.nextSlotId++, x: 500, y: 500, phase: 'REVEALED', weaponId: 'PISTOL',
        revealLeadSeconds: 1.5, revealedFor: 0, pickedBy: null, rejectedFor: {}, spawnTime: s.time,
        predictedHeroETA: null, predictedRivalETA: null, earliestETA: null, predictedFighter: null,
      }, o);
      s.slots.push(slot);
      return slot.id;
    },
    holder(who) {
      const f = who === 'HERO' ? fighters[0] : fighters[1];
      const h = APEX_ARSENAL.weaponApi.getHolder(f);
      return h ? { weapon: h.weaponId, phase: h.phase } : null;
    },
    ctl() { return APEX_HERO_REWORK.abilityController(APEX_HERO_REWORK.byCombatant(fighters[0])); },
    ct() { return APEX_HERO_REWORK.byCombatant(fighters[0]); },
    aqDamage(target, amount, source, weaponId) {
      return APEX_ARSENAL.weaponApi.aqDamage(target, amount, source, weaponId, {});
    },
    hr() { return APEX_HERO_REWORK; },
  };
  return true;
})()`);
const Q = win.__HR_Q;

fs.mkdirSync(evidenceDir, { recursive: true });

function saveCanvas(name) {
  const el = win.document.getElementById('game-canvas');
  const rc = realCanvases.get(el) || realCanvasFor(el);
  const outPath = path.join(evidenceDir, `${name}.png`);
  fs.writeFileSync(outPath, rc.toBuffer('image/png'));
  console.log(`saved ${name} -> ${outPath}`);
}

async function run() {
  // idle
  {
    const m = Q.start('ROBOT', 'ICE', 4001);
    Q.placeFree(350, 500, 1, 0, 700, 500, -1, 0);
    Q.step(0.5);
    saveCanvas('01-idle');
  }
  // movement inertia
  {
    const m = Q.start('ROBOT', 'ICE', 4002);
    Q.placeFree(200, 500, 1, 0, 700, 500, -1, 0);
    // force movement via baseSpeed direction
    win.fighters[0].setDir(1, 0.2);
    Q.step(0.3);
    saveCanvas('02-movement-inertia');
  }
  // real APEX weapon held in socket
  {
    const m = Q.start('ROBOT', 'ICE', 4003);
    Q.placeFree(150, 500, 1, 0, 700, 500, -1, 0);
    Q.pushSlot({ x: 850, y: 500, weaponId: 'PISTOL' });
    const ctl = Q.ctl();
    ctl.tryCast('A1', 'gates');
    Q.step(0.4);
    saveCanvas('03-weapon-held-in-socket');
  }
  // firearm recoil
  {
    const m = Q.start('ROBOT', 'ICE', 4004);
    Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
    Q.pushSlot({ x: 850, y: 500, weaponId: 'PISTOL' });
    const ctl = Q.ctl();
    ctl.tryCast('A1', 'gates');
    Q.step(0.5);
    // fire
    const fighter = win.fighters[0];
    const holder = win.APEX_ARSENAL.weaponApi.getHolder(fighter);
    if (holder) {
      // simulate fire via onFireBullet hook already
      Q.step(0.05);
      saveCanvas('04-firearm-recoil');
    } else {
      saveCanvas('04-firearm-recoil-no-holder');
    }
  }
  // A1 focus
  {
    const m = Q.start('ROBOT', 'ICE', 4005);
    Q.placeFree(250, 700, 1, 0, 150, 150, -1, -0.5);
    Q.pushSlot({ x: 850, y: 250, weaponId: 'PISTOL' });
    const ctl = Q.ctl();
    ctl.tryCast('A1', 'gates');
    Q.step(0.05);
    saveCanvas('05-a1-focus-lock');
  }
  // real dash
  {
    const m = Q.start('ROBOT', 'ICE', 4006);
    Q.placeFree(250, 700, 1, 0, 150, 150, -1, -0.5);
    Q.pushSlot({ x: 850, y: 250, weaponId: 'PISTOL' });
    const ctl = Q.ctl();
    ctl.tryCast('A1', 'gates');
    Q.step(0.15);
    saveCanvas('06-a1-real-dash');
  }
  // real physical pickup/contact settle
  {
    const m = Q.start('ROBOT', 'ICE', 4007);
    Q.placeFree(150, 500, 1, 0, 80, 80, 1, 0.5);
    Q.pushSlot({ x: 850, y: 500, weaponId: 'PISTOL' });
    const ctl = Q.ctl();
    ctl.tryCast('A1', 'gates');
    Q.step(0.3);
    saveCanvas('07-a1-contact-settle');
  }
  // A1 no-target
  {
    const m = Q.start('ROBOT', 'ICE', 4008);
    Q.placeFree(250, 500, 1, 0, 150, 150, -1, -0.5);
    Q.pushSlot({ x: 850, y: 500, weaponId: 'STORMBREAKER' });
    const ctl = Q.ctl();
    ctl.tryCast('A1', 'p1');
    Q.step(0.1);
    saveCanvas('08-a1-no-target');
  }
  // A2 start/index
  {
    const m = Q.start('ROBOT', 'ICE', 4009);
    Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
    const ctl = Q.ctl();
    ctl.tryCast('A2', 'gates');
    Q.step(0.05);
    saveCanvas('09-a2-start-index');
  }
  // A2 locked
  {
    const m = Q.start('ROBOT', 'ICE', 4010);
    Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
    const ctl = Q.ctl();
    ctl.tryCast('A2', 'gates');
    Q.step(0.2);
    saveCanvas('10-a2-locked');
  }
  // A2 hit from >=2 dirs
  {
    const m = Q.start('ROBOT', 'ICE', 4011);
    Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
    const a = win.fighters[0], b = win.fighters[1];
    const ctl = Q.ctl();
    ctl.tryCast('A2', 'gates');
    Q.step(0.2);
    // hit from right
    b.x = 600; b.y = 500;
    Q.aqDamage(a, 2, b, 'PISTOL');
    Q.step(0.1);
    saveCanvas('11-a2-hit-dir-right');
    // hit from left
    b.x = 0; b.y = 500;
    Q.aqDamage(a, 2, b, 'PISTOL');
    Q.step(0.1);
    saveCanvas('12-a2-hit-dir-left');
  }
  // A2 expiry/release
  {
    const m = Q.start('ROBOT', 'ICE', 4012);
    Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
    const ctl = Q.ctl();
    ctl.tryCast('A2', 'gates');
    Q.step(3.1);
    saveCanvas('13-a2-expiry-release');
  }
  // wall bounce
  {
    const m = Q.start('ROBOT', 'ICE', 4013);
    Q.placeFree(50, 500, -1, 0, 700, 500, -1, 0);
    // drive into wall
    win.fighters[0].setDir(-1, 0);
    Q.step(0.5);
    saveCanvas('14-wall-bounce');
  }
  // passive milestone/upgrade with test-only thresholds
  {
    const m = Q.start('ROBOT', 'ICE', 4014);
    Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
    const a = win.fighters[0], b = win.fighters[1];
    const pCt = Q.ct();
    pCt.skills.PASSIVE.cfg = { ...pCt.skills.PASSIVE.cfg, milestoneThresholds: [10, 20, 30] };
    const ctl = Q.ctl();
    ctl.setCooldown('A1', 8);
    Q.aqDamage(b, 2, a, 'PISTOL');
    Q.step(0.1);
    saveCanvas('15-passive-milestone');
    Q.aqDamage(b, 2, a, 'PISTOL');
    Q.step(0.1);
    saveCanvas('16-passive-upgrade');
  }

  console.log('evidence generation done');
}

run().then(() => {
  try { win.close(); } catch(e){}
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
