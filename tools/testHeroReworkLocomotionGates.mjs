#!/usr/bin/env node
/* =============================================================================
 * APEX CHAOS — Hero Rework QUALIFICATION locomotion gates (real movement).
 *
 * Authority: docs/hero-rework/phase1/10_ROBOT_SLIME_MODEL_QUALIFICATION_TASK
 *            "Required behavioral gates — Shared" + "Movement gates must
 *            observe real moving fighters."
 *
 * HARD TEST LAW (owner-failure root cause S6): these gates NEVER freeze a
 * body (no baseSpeed=0), NEVER pin a body (__hrHoldBody), NEVER disable the
 * locomotion behavior under test, and NEVER approximate the engine step.
 * Bodies run at production baseSpeed through the real APEX engine step
 * (APEX_ARSENAL.step -> Fighter.update -> wall/body physics).
 *
 * Shared locomotion gates (Q1):
 *   L1  unarmed rework Hero does not turn toward an off-heading pickup
 *   L2  armed rework Hero does not chase an off-heading opponent
 *   L3  armed rework Hero does not kite away from a close opponent
 *   L4  normal wall bounce survives on rework bodies
 *
 * Usage: node tools/testHeroReworkLocomotionGates.mjs
 * ============================================================================= */
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
    <div class="ui-layer" id="hud"><div id="manual-lab-hud" class="hidden"></div></div>
    <div id="battle-controls" class="hidden"></div>
    <div id="menu-screen" class="screen"></div>
    <div id="select-screen" class="screen hidden"><div id="select-title"></div><button id="start-btn" class="hidden"></button><div id="apex-pick-runtime-root"></div></div>
    <div id="manual-room-screen" class="screen hidden"></div>
    <div id="tournament-screen" class="screen hidden"></div>
    <div id="end-screen" class="screen hidden"><div id="winner-text"></div><div id="stats-panel"></div><button id="tournament-return-btn" class="hidden"></button><button id="challenge-retry-btn" class="hidden"></button></div>
    <div id="solo-screen" class="screen hidden"></div>
    <div id="trial-screen" class="screen hidden"></div>
    <div id="tam-chien-screen" class="screen hidden"></div>
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
  const file = path.join(REPO, 'public', fileRelPath.replace(/^\//, ''));
  try { win.eval(fs.readFileSync(file, 'utf8')); return true; } catch (error) {
    loadErrors.push({ file: relPath, error: String(error && error.message || error) });
    if (required) throw new Error(`Required runtime failed to load: ${relPath}: ${error}`);
    return false;
  }
}
loadScript('/apexEngine.js', true);
const loadedRuntimeSrcs = new Set();
for (const [src] of BOOT_GAME_RUNTIMES) {
  loadedRuntimeSrcs.add(String(src).split(/[?#]/, 1)[0]);
  loadScript(src, false);
}
for (const [src] of MODE_DEFERRED_RUNTIMES.arsenalQuest) {
  const key = String(src).split(/[?#]/, 1)[0];
  if (loadedRuntimeSrcs.has(key)) continue;
  loadScript(src, true);
}
win['__apexDeferredRuntimesReady_arsenalQuest'] = true;
win['__apexDeferredRuntimesReady_select'] = true;

fs.mkdirSync(evidenceDir, { recursive: true });
const report = { suite: 'hero-rework-locomotion-gates', gates: {}, failures: [], loadErrors };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

// ------------------------------------------------------------- test helpers
// TEST LAW: `placeFree` never touches baseSpeed and never sets __hrHoldBody.
// Bodies keep production speed and run through the real engine movement.
win.eval(`(() => {
  window.__HR_Q = {
    start(p1, p2, seed) {
      if (window.APEX_HERO_REWORK && seed != null) window.APEX_HERO_REWORK.setSeed(seed);
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
    // REAL-MOVEMENT placement: heading set, positions set, NOTHING frozen.
    placeFree(fx, fy, fdirx, fdiry, ex, ey, edirx, ediry) {
      const [a, b] = fighters;
      a.x = fx; a.y = fy; a.setDir(fdirx, fdiry);
      b.x = ex; b.y = ey; b.setDir(edirx, ediry);
      return { aSpeed: a.baseSpeed, bSpeed: b.baseSpeed, aHeld: !!(a.data && a.data.__hrHoldBody), bHeld: !!(b.data && b.data.__hrHoldBody) };
    },
    snap(who) {
      const f = who === 'HERO' ? fighters[0] : fighters[1];
      return { x: f.x, y: f.y, dirx: f.dir.x, diry: f.dir.y, speed: f.baseSpeed, hp: f.hp };
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
    slotById(id) {
      const s = APEX_ARSENAL.state && APEX_ARSENAL.state.slots.find(s => s.id === id);
      return s ? { phase: s.phase, pickedBy: s.pickedBy, x: s.x, y: s.y } : null;
    },
    equip(who, weaponId) { return APEX_ARSENAL.weaponApi.equip(who === 'HERO' ? fighters[0] : fighters[1], weaponId); },
    holder(who) {
      const f = who === 'HERO' ? fighters[0] : fighters[1];
      const h = APEX_ARSENAL.weaponApi.getHolder(f);
      return h ? { weapon: h.weaponId, phase: h.phase } : null;
    },
    hr() { return APEX_HERO_REWORK; },
    fighters: () => fighters,
  };
  return true;
})()`);
const Q = win.__HR_Q;

/* =============================================================================
 * L1 — unarmed rework Hero does not turn toward an off-heading pickup.
 *
 * ICE (rework shell) walks east at production speed. A revealed weapon sits
 * due north (off-heading). Under the old illegal autopilot the body turned
 * north within one frame. Original APEX law: heading preserved.
 * ============================================================================= */
{
  HR_RESET: {
    const m = Q.start('ICE', 'ICE', 1001);
    if (!m) { gate('L1-unarmed-no-pickup-seek', false, 'match did not install'); break HR_RESET; }
    // Watchdog on the law itself: production speed, nothing pinned.
    const placement = Q.placeFree(350, 800, 1, 0, 200, 150, -1, 0);
    const heroFree = placement.aSpeed > 0 && placement.bSpeed > 0 && !placement.aHeld && !placement.bHeld;
    Q.pushSlot({ x: 350, y: 450, weaponId: 'PISTOL' }); // due NORTH of P1
    const slotId = win.APEX_ARSENAL.state.slots[win.APEX_ARSENAL.state.slots.length - 1].id;
    const s0 = Q.snap('HERO');
    Q.step(0.6);
    const s1 = Q.snap('HERO');
    const slot = Q.slotById(slotId);
    const headingPreserved = s1.dirx > 0.9 && Math.abs(s1.diry) < 0.1;
    const traveledEast = s1.x - s0.x > 250;           // real engine movement (520px/s * 0.6s)
    const driftedNorth = s0.y - s1.y;                   // seek would drive y down
    const stillRevealed = slot && slot.phase === 'REVEALED' && !slot.pickedBy;
    gate('L1-unarmed-no-pickup-seek',
      heroFree && headingPreserved && traveledEast && driftedNorth < 100 && stillRevealed,
      { heroFree, dir0: [s0.dirx, s0.diry], dir1: [s1.dirx, s1.diry], dx: +(s1.x - s0.x).toFixed(1), northDrift: +driftedNorth.toFixed(1), slot });
  }
}

/* =============================================================================
 * L2 — armed rework Hero does not chase an off-heading opponent.
 *
 * P1 armed (real equip) walks east; the opponent stands due south at chase
 * range. The old hold-band autopilot turned P1 south to hold 260..380px.
 * ============================================================================= */
{
  HR_RESET: {
    const m = Q.start('ICE', 'ICE', 1002);
    if (!m) { gate('L2-armed-no-chase', false, 'match did not install'); break HR_RESET; }
    const placement = Q.placeFree(300, 300, 1, 0, 300, 850, -1, 0); // opponent far south (550px)
    const armed = Q.equip('HERO', 'PISTOL');
    const holder = Q.holder('HERO');
    const s0 = Q.snap('HERO');
    Q.step(0.5);
    const s1 = Q.snap('HERO');
    const e1 = Q.snap('RIVAL');
    const dist1 = Math.hypot(s1.x - e1.x, s1.y - e1.y);
    const headingPreserved = s1.dirx > 0.9 && Math.abs(s1.diry) < 0.1;
    const traveledEast = s1.x - s0.x > 200;
    gate('L2-armed-no-chase',
      placement.aSpeed > 0 && !placement.aHeld && armed && !!holder
      && headingPreserved && traveledEast && dist1 > 380,
      { armed, holder, dir0: [s0.dirx, s0.diry], dir1: [s1.dirx, s1.diry], dx: +(s1.x - s0.x).toFixed(1), dist1: +dist1.toFixed(1) });
  }
}

/* =============================================================================
 * L3 — armed rework Hero does not kite away from a close opponent.
 *
 * Same setup, but the opponent starts INSIDE the old hold band (<260px,
 * off-heading south). The old autopilot turned P1 AWAY to restore range.
 * ============================================================================= */
{
  HR_RESET: {
    const m = Q.start('ICE', 'ICE', 1003);
    if (!m) { gate('L3-armed-no-kite', false, 'match did not install'); break HR_RESET; }
    // Opponent 181px due NORTH — inside the old kite band (<260px) but with a
    // collision-proof vertical gap (181 > radius sum 150) so only ILLEGAL
    // steering could change P1's heading in this window.
    const placement = Q.placeFree(400, 600, 1, 0, 400, 419, -1, 0);
    Q.equip('HERO', 'PISTOL');
    const s0 = Q.snap('HERO');
    Q.step(0.5);
    const s1 = Q.snap('HERO');
    const headingPreserved = s1.dirx > 0.9 && Math.abs(s1.diry) < 0.1;
    const traveledEast = s1.x - s0.x > 200;
    gate('L3-armed-no-kite',
      placement.aSpeed > 0 && !placement.aHeld && headingPreserved && traveledEast,
      { dir0: [s0.dirx, s0.diry], dir1: [s1.dirx, s1.diry], dx: +(s1.x - s0.x).toFixed(1) });
  }
}

/* =============================================================================
 * L4 — normal wall bounce survives on rework bodies.
 *
 * P1 walks east at production speed into the right wall. Original APEX
 * physics must flip dir.x and rebound the body — no test intervention.
 * ============================================================================= */
{
  HR_RESET: {
    const m = Q.start('ICE', 'ICE', 1004);
    if (!m) { gate('L4-wall-bounce', false, 'match did not install'); break HR_RESET; }
    const placement = Q.placeFree(820, 700, 1, 0, 150, 150, -1, -0.2);
    const s0 = Q.snap('HERO');
    Q.step(1.2); // plenty to reach the wall at x=925 and rebound
    const s1 = Q.snap('HERO');
    const bounced = s1.dirx < -0.9;        // heading flipped by wall physics
    const rebounded = s1.x < 900;          // physically back inside
    gate('L4-wall-bounce',
      placement.aSpeed > 0 && !placement.aHeld && bounced && rebounded,
      { dir0: [s0.dirx, s0.diry], dir1: [s1.dirx, s1.diry], x1: +s1.x.toFixed(1) });
  }
}

/* ------------------------------------------------------------------ summary */
const total = Object.keys(report.gates).length;
const passed = Object.values(report.gates).filter(g => g.pass).length;
console.log(`\n[HERO REWORK LOCOMOTION GATES] ${passed}/${total} gates passed`);
if (report.failures.length) console.log('FAILURES:', report.failures.join(', '));
report.summary = { total, passed, failed: report.failures };
fs.writeFileSync(path.join(evidenceDir, 'locomotion-gates-report.json'), JSON.stringify(report, null, 2));
try { win.close(); } catch (e) { /* teardown only */ }
process.exit(report.failures.length ? 1 : 0);
