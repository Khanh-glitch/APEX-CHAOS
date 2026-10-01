#!/usr/bin/env node
/* ROBOT recoil gate: one real weapon fire -> one recoil reaction, normal behavior preserved */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BOOT_GAME_RUNTIMES, MODE_DEFERRED_RUNTIMES } from '../src/game/runtimeManifest.js';

const REPO = process.cwd();
const TOOLING_DIR = process.env.AQ_TOOLING_DIR || path.join(REPO, 'node_modules');
const evidenceDir = process.env.AQ_EVIDENCE_DIR || path.join(REPO, 'docs', 'hero-rework', 'evidence');
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
  if (!rc || rc.width !== w || rc.height !== h) { rc = createCanvas(w, h); realCanvases.set(el, rc); }
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
class HarnessImage {
  constructor() { this.complete = false; this.width = 0; this.height = 0; this.__realImage = null; this.onload = null; this.onerror = null; }
  set src(v) {
    const s = String(v);
    const rel = s.startsWith('/') ? s.slice(1) : s;
    loadImage(path.join(REPO, 'public', rel)).then((im) => { this.__realImage = im; this.width = im.width; this.height = im.height; this.naturalWidth = im.width; this.naturalHeight = im.height; this.complete = true; if (this.onload) this.onload(); }).catch(() => { if (this.onerror) this.onerror(); });
  }
  get src() { return this._src; }
}
win.Image = HarnessImage;
win.requestAnimationFrame = () => 0;
win.cancelAnimationFrame = () => {};

function loadScript(relPath, required) {
  const fp = String(relPath).split(/[?#]/, 1)[0];
  const rel = fp.startsWith('/') ? fp.slice(1) : fp;
  const file = path.join(REPO, 'public', rel);
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
    holderRaw(who) {
      const f = who === 'HERO' ? fighters[0] : fighters[1];
      return APEX_ARSENAL.weaponApi.getHolder(f);
    },
    ctl() { return APEX_HERO_REWORK.abilityController(APEX_HERO_REWORK.byCombatant(fighters[0])); },
  };
  return true;
})()`);
const Q = win.__HR_Q;

fs.mkdirSync(evidenceDir, { recursive: true });
const report = { suite: 'robot-recoil-gate', gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ? JSON.stringify(detail) : ''}`);
}

{
  Q.start('ROBOT', 'ICE', 5001);
  Q.placeFree(150, 500, 1, 0, 80, 80, 1, 0);
  Q.pushSlot({ x: 850, y: 500, weaponId: 'PISTOL' });
  const ctl = Q.ctl();
  ctl.tryCast('A1', 'gates');
  let holder = null;
  let t = 0;
  while (t < 1.0) {
    Q.step(1/60);
    t += 1/60;
    holder = Q.holderRaw('HERO');
    if (holder && holder.weaponId === 'PISTOL') break;
  }
  gate('recoil-holder-acquired', !!holder && holder.weaponId === 'PISTOL', { holder: holder ? holder.weaponId : null, t: +t.toFixed(3) });

  win.fighters[1].x = 600; win.fighters[1].y = 500;
  win.fighters[0].setDir(1, 0);

  let fireCount = 0;
  let recoilKickDetected = 0;
  let projectileCreated = 0;
  const wpnApi = win.APEX_ARSENAL.weaponApi;
  const origFireBullet = wpnApi.fireBullet;
  const HR = win.APEX_HERO_REWORK;
  const origOnFire = HR.onFireBullet;
  let lastGunKickBefore = null;
  let lastGunKickAfter = null;
  HR.onFireBullet = function(spec) {
    if (spec && spec.owner && spec.owner.id === win.fighters[0].id) {
      try {
        const st = win.APEX_ROBOT_PRESENTATION.getRobotState(win.fighters[0]);
        if (st) lastGunKickBefore = st.R.gunKick.x;
      } catch(e){}
    }
    const res = origOnFire ? origOnFire.call(this, spec) : null;
    if (spec && spec.owner && spec.owner.id === win.fighters[0].id) {
      fireCount++;
      projectileCreated++;
      try {
        const st = win.APEX_ROBOT_PRESENTATION.getRobotState(win.fighters[0]);
        if (st) {
          lastGunKickAfter = st.R.gunKick.x;
          if (st.R.gunKick.v < -1 || lastGunKickAfter < -0.5) recoilKickDetected++;
        }
      } catch(e){}
    }
    return res;
  };

  let steps = 0;
  while (steps < 180 && fireCount === 0) {
    Q.step(1/60);
    steps++;
  }

  wpnApi.fireBullet = origFireBullet;
  HR.onFireBullet = origOnFire;

  gate('recoil-one-real-fire', fireCount === 1, { fireCount, steps });
  gate('recoil-one-recoil-reaction', recoilKickDetected === 1, { recoilKickDetected, before: lastGunKickBefore, after: lastGunKickAfter });
  gate('recoil-projectile-preserved', projectileCreated === 1, { projectileCreated });
  gate('recoil-normal-behavior-not-replaced', fireCount === 1 && projectileCreated === 1, { fireCount, projectileCreated });

  let fireCount2 = 0;
  let recoil2 = 0;
  HR.onFireBullet = function(spec) {
    const res = origOnFire ? origOnFire.call(this, spec) : null;
    if (spec && spec.owner && spec.owner.id === win.fighters[0].id) {
      fireCount2++;
      try {
        const st = win.APEX_ROBOT_PRESENTATION.getRobotState(win.fighters[0]);
        if (st && (st.R.gunKick.v < -1 || st.R.gunKick.x < -0.5)) recoil2++;
      } catch(e){}
    }
    return res;
  };
  steps = 0;
  while (steps < 180 && fireCount2 === 0) {
    Q.step(1/60);
    steps++;
  }
  HR.onFireBullet = origOnFire;
  gate('recoil-second-fire-second-recoil', fireCount2 === 1 && recoil2 === 1, { fireCount2, recoil2 });
}

const total = Object.keys(report.gates).length;
const passed = Object.values(report.gates).filter(g => g.pass).length;
console.log(`\n[ROBOT RECOIL GATE] ${passed}/${total} gates passed`);
report.summary = { total, passed, failed: report.failures };
fs.writeFileSync(path.join(evidenceDir, 'robot-recoil-gate-report.json'), JSON.stringify(report, null, 2));
try { win.close(); } catch(e){}
process.exit(report.failures.length ? 1 : 0);
