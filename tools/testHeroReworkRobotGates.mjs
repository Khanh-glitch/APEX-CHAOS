#!/usr/bin/env node
/* =============================================================================
 * APEX CHAOS — Hero Rework QUALIFICATION gates: ROBOT (Q2).
 *
 * Authority: docs/hero-rework/phase1/02 §1 ROBOT, doc 10 ROBOT target +
 *            "Required behavioral gates — ROBOT".
 *
 * TEST LAW: bodies move at production speed through the real engine step.
 * No baseSpeed=0, no __hrHoldBody, no disabled locomotion. Skills are cast
 * through the real AbilityController (the same entry P1's J/K uses) and
 * damage flows through the real aqDamage -> takeDamage path.
 *
 * Isolation note: P2's cast AI is switched OFF so P2's own skills cannot
 * perturb ROBOT measurements (P2 skills are not the behavior under test).
 * ROBOT's locomotion and mechanics run fully live. P1 never auto-casts in
 * production either (p2CastAI is P2-only).
 *
 * Gates:
 *   R1  idle ROBOT does not seek a revealed pickup (no cast)
 *   R2  A1 explicitly turns + dashes (physical, continuous, <=0.55s)
 *   R3  A1 never auto-targets T6 (fail-cue + no cooldown consumed)
 *   R4  pickup requires physical contact (dash does not teleport-equip)
 *   R5  A2 Virtual Armor: exact 55% DR (incoming x0.45) for exactly 3.0s
 *   R6  A2 grants NO CC immunity (stun applies during armor)
 *   R7  Passive records credited realized damage dealt only
 *   R8  Owner-approved production thresholds; milestone #1 has no refund
 *   R9  Passive refund SEQUENCE law (TEST-ONLY threshold fixture):
 *       #1 none, #2 0.5s, #3 1.0s, #4 1.5s, #5 2.0s (+0.5 step), one proc
 *       each, refunding the currently relevant Active (A1 while cooling).
 *
 * Usage: node tools/testHeroReworkRobotGates.mjs
 * ============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BOOT_GAME_RUNTIMES, MODE_DEFERRED_RUNTIMES } from '../src/game/runtimeManifest.js';
import { installProductSurfaceAuthority } from '../src/game/productSurface.js';

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
for (const [src] of MODE_DEFERRED_RUNTIMES.arsenalProduct) {
  const key = String(src).split(/[?#]/, 1)[0];
  if (loadedRuntimeSrcs.has(key)) continue;
  loadScript(src, true);
}
win['__apexDeferredRuntimesReady_arsenalProduct'] = true;
win['__apexDeferredRuntimesReady_select'] = true;

fs.mkdirSync(evidenceDir, { recursive: true });
const report = { suite: 'hero-rework-robot-gates', gates: {}, failures: [], loadErrors };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

win.eval(`(() => {
  window.__HR_Q = {
    start(p1, p2, seed) {
      if (window.APEX_HERO_REWORK && seed != null) window.APEX_HERO_REWORK.setSeed(seed);
      window.APEX_HERO_REWORK.setAiEnabled(false); // isolate P1 mechanics (see header)
      window.startArsenalBattleMode(p1, p2, { testFixture: true });
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
      return { aSpeed: a.baseSpeed, aHeld: !!(a.data && a.data.__hrHoldBody) };
    },
    snap(who) {
      const f = who === 'HERO' ? fighters[0] : fighters[1];
      return { x: f.x, y: f.y, dirx: f.dir.x, diry: f.dir.y, hp: f.hp, maxHp: f.maxHp };
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

/* =============================================================================
 * R1 — idle ROBOT does not seek a revealed pickup (no cast).
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2001);
  Q.placeFree(350, 800, 1, 0, 200, 150, -1, 0);
  Q.pushSlot({ x: 350, y: 450, weaponId: 'PISTOL' }); // due NORTH
  const slotId = win.APEX_ARSENAL.state.slots[win.APEX_ARSENAL.state.slots.length - 1].id;
  const s0 = Q.snap('HERO');
  Q.step(0.6);
  const s1 = Q.snap('HERO');
  const slot = Q.slotById(slotId);
  const ok = !!m && s1.dirx > 0.9 && Math.abs(s1.diry) < 0.1
    && (s1.x - s0.x) > 250 && (s0.y - s1.y) < 100
    && slot && slot.phase === 'REVEALED' && !slot.pickedBy;
  gate('R1-idle-no-pickup-seek', ok,
    { dir: [s1.dirx, s1.diry], dx: +(s1.x - s0.x).toFixed(1), north: +(s0.y - s1.y).toFixed(1), slot });
}

/* =============================================================================
 * R2 — A1 explicitly turns + dashes: physical continuous motion toward the
 * nearest eligible pickup, dash speed 3400, done within 0.55s.
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2002);
  Q.placeFree(250, 700, 1, 0, 150, 150, -1, -0.5);
  Q.pushSlot({ x: 850, y: 250, weaponId: 'PISTOL' }); // off-heading NE, ~750px
  const slotId = win.APEX_ARSENAL.state.slots[win.APEX_ARSENAL.state.slots.length - 1].id;
  const ctl = Q.ctl();
  const s0 = Q.snap('HERO');
  const slotPos = { x: 850, y: 250 };
  const dist0 = Math.hypot(s0.x - slotPos.x, s0.y - slotPos.y);
  const cast = ctl.tryCast('A1', 'gates');
  // Sample every frame: continuous physical motion (no teleport), travel at
  // dash speed, arrival inside 0.55s.
  let t = 0, last = { x: s0.x, y: s0.y }, maxJump = 0, arrivedAt = null;
  while (t < 0.75) {
    Q.step(1 / 60); t += 1 / 60;
    const s = Q.snap('HERO');
    maxJump = Math.max(maxJump, Math.hypot(s.x - last.x, s.y - last.y));
    last = { x: s.x, y: s.y };
    const d = Math.hypot(s.x - slotPos.x, s.y - slotPos.y);
    if (arrivedAt == null && d < 60) arrivedAt = t;
  }
  const sEnd = Q.snap('HERO');
  const distEnd = Math.hypot(sEnd.x - slotPos.x, sEnd.y - slotPos.y);
  // 3400px/s at 1/60s steps => ~56.7px per frame along the heading; a jump
  // meaningfully beyond that would be a teleport.
  const continuous = maxJump < 90;
  const dashSpeedOk = arrivedAt != null && arrivedAt <= 0.55;
  const turnedToward = distEnd < dist0 - 400;
  gate('R2-a1-turns-and-dashes',
    !!m && cast.ok && continuous && dashSpeedOk && turnedToward,
    { cast, dist0: +dist0.toFixed(1), distEnd: +distEnd.toFixed(1), arrivedAt: arrivedAt && +arrivedAt.toFixed(3), maxJump: +maxJump.toFixed(1) });
}

/* =============================================================================
 * R3 — A1 never auto-targets T6.
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2003);
  Q.placeFree(250, 500, 1, 0, 150, 150, -1, -0.5);
  Q.pushSlot({ x: 850, y: 500, weaponId: 'STORMBREAKER' }); // T6 only
  const ctl = Q.ctl();
  const cdBefore = ctl.cooldownLeft('A1');
  const fail = ctl.tryCast('A1', 'gates'); // must fail-cue: T6 is not a target
  const cdAfterFail = ctl.cooldownLeft('A1');
  // Now a normal pickup appears farther than T6 — A1 must take the normal one.
  const pistolSlotId = Q.pushSlot({ x: 880, y: 520, weaponId: 'PISTOL' });
  const cast = ctl.tryCast('A1', 'gates');
  const dash = Q.ct().store['robot.weapon_dash'] && Q.ct().store['robot.weapon_dash'].dash;
  const targeted = dash && dash.targetSlotId === pistolSlotId;
  gate('R3-a1-t6-not-auto-targeted',
    !!m && !fail.ok && !!fail.failCue && cdAfterFail === cdBefore && cast.ok && targeted,
    { fail, cdBefore, cdAfterFail, cast, targetedSlot: dash && dash.targetSlotId, pistolSlotId });
}

/* =============================================================================
 * R4 — pickup requires physical contact: A1 dash never teleport-equips.
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2004);
  Q.placeFree(150, 500, 1, 0, 80, 80, 1, 0.5);
  Q.pushSlot({ x: 850, y: 500, weaponId: 'PISTOL' });
  const ctl = Q.ctl();
  const cast = ctl.tryCast('A1', 'gates');
  Q.step(0.05); // ~170px along the dash — still far from any contact radius
  const early = Q.holder('HERO');
  const earlySlot = Q.slotById(win.APEX_ARSENAL.state.slots[win.APEX_ARSENAL.state.slots.length - 1].id);
  // Continue until physical arrival; collection must happen via the normal
  // contact resolver (resolvePickups), i.e. slot.pickedBy set while the body
  // is inside the touch radius — never before.
  let t = 0.05, collectedAt = null, collectedDist = null;
  while (t < 0.8) {
    Q.step(1 / 60); t += 1 / 60;
    const s = Q.snap('HERO');
    const slot = Q.slotById(win.APEX_ARSENAL.state.slots[win.APEX_ARSENAL.state.slots.length - 1].id);
    if (slot && slot.pickedBy && collectedAt == null) {
      collectedAt = t;
      collectedDist = Math.hypot(s.x - slot.x, s.y - slot.y);
      break;
    }
  }
  const held = Q.holder('HERO');
  const touchRadius = 75 * 0.6 + 42 + 30; // real pickupTouchRadius (radius*.6 + PICKUP_RADIUS + PICKUP_TOUCH_BONUS)
  const ok = !!m && cast.ok && early === null && earlySlot.phase === 'REVEALED'
    && collectedAt != null && collectedDist != null && collectedDist <= touchRadius + 40
    && !!held && held.weapon === 'PISTOL';
  gate('R4-pickup-requires-physical-contact', ok,
    { cast, earlyHolder: early, collectedAt: collectedAt && +collectedAt.toFixed(3), collectedDist: collectedDist && +collectedDist.toFixed(1), held });
}

/* =============================================================================
 * R5 — A2 exact DR: incoming x0.45 for exactly 3.0s, full damage outside.
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2005);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const a = win.fighters[0], b = win.fighters[1];
  // Real production entry aqDamage (weapon scaling x7 included identically
  // in every call — the LAW under test is the x0.45 ratio).
  const before1 = a.hp;
  Q.aqDamage(a, 2, b, 'PISTOL');
  const raw = before1 - a.hp;
  const ctl = Q.ctl();
  const cast = ctl.tryCast('A2', 'gates');
  const before2 = a.hp;
  Q.aqDamage(a, 2, b, 'PISTOL');
  const armored = before2 - a.hp;
  // Armor window is exactly 3.0s of sim time.
  Q.step(2.9); // inside window
  const before3 = a.hp;
  Q.aqDamage(a, 2, b, 'PISTOL');
  const stillArmored = before3 - a.hp;
  Q.step(0.3); // past 3.0s
  const before4 = a.hp;
  Q.aqDamage(a, 2, b, 'PISTOL');
  const afterWindow = before4 - a.hp;
  const ratioMid = armored / raw;
  const ok = !!m && cast.ok && raw > 0
    && Math.abs(ratioMid - 0.45) < 1e-9
    && Math.abs(stillArmored / raw - 0.45) < 1e-9
    && Math.abs(afterWindow / raw - 1) < 1e-9;
  gate('R5-a2-exact-55pct-dr', ok,
    { raw: +raw.toFixed(3), armored: +armored.toFixed(3), ratio: +ratioMid.toFixed(6), stillArmoredRatio: +(stillArmored / raw).toFixed(6), afterRatio: +(afterWindow / raw).toFixed(6) });
}

/* =============================================================================
 * R6 — A2 grants NO CC immunity.
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2006);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const a = win.fighters[0];
  const ctl = Q.ctl();
  const cast = ctl.tryCast('A2', 'gates');
  a.applyStatus('stun', 0.5, {});
  const ccDuringArmor = a.hardCC();
  gate('R6-a2-no-cc-immunity',
    !!m && cast.ok && ccDuringArmor === true,
    { cast, hardCCDuringArmor: ccDuringArmor, statuses: Object.keys(a.statuses).filter(k => a.statuses[k] && a.statuses[k].timer > 0) });
}

/* Shared rolling-passive test helpers. */
function burstStore() { return Q.ct().store['robot.damage_milestones'] || {}; }
function collector() {
  const arr = [];
  const bus = Q.hr().AIL.bus, emit = bus.emit;
  bus.emit = function (t, payload) {
    if (/^(RobotPassiveMilestone|RobotPassiveUpgrade|MilestoneRefund|RobotBurstReset)/.test(t)) arr.push({ type: t, payload });
    return emit.call(this, t, payload);
  };
  return { arr, stop() { bus.emit = emit; } };
}

/* =============================================================================
 * R7 — Passive records credited realized damage dealt only (rolling burst).
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2007);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const a = win.fighters[0], b = win.fighters[1];
  const st = () => Q.ct().store['robot.damage_milestones'] || {};
  const bBefore = b.hp;
  Q.aqDamage(b, 2, a, 'PISTOL'); // ROBOT deals (credited to ROBOT)
  const realizedDealt = bBefore - b.hp;
  const afterDealt = st().burst || 0;
  const aBefore = a.hp;
  Q.aqDamage(a, 2, b, 'PISTOL'); // ROBOT takes (credited to ICE)
  const realizedTaken = aBefore - a.hp;
  const afterTaken = st().burst || 0;
  gate('R7-passive-records-credited-dealt-only',
    !!m && realizedDealt > 0 && realizedTaken > 0
    && Math.abs(afterDealt - realizedDealt) < 1e-9 && afterTaken === afterDealt,
    { realizedDealt, afterDealt, realizedTaken, afterTaken });
}

/* =============================================================================
 * R8 — Rolling 1.2s burst law: production window/thresholds, milestone #1
 *      refund-free, deadline extension, silence reset.
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2008);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const a = win.fighters[0], b = win.fighters[1];
  const cfg = Q.ct().skills.PASSIVE.cfg;
  const ctl = Q.ctl();
  ctl.setCooldown('A1', 8); ctl.setCooldown('A2', 8);
  const c = collector();
  let guard = 0;
  while ((burstStore().burst || 0) < 160 && guard++ < 40) b.takeDamage(13.72, a, 'arsenal-PISTOL');
  const milestones8 = c.arr.filter(e => e.type === 'RobotPassiveMilestone').map(e => e.payload.milestone);
  const refunds = c.arr.filter(e => e.type === 'MilestoneRefund');
  const lawShape = cfg.burstWindowSec === 1.2 && cfg.firstThreshold === 150 && cfg.thresholdStep === 50;
  const nextAfterHits = burstStore().next || 1;
  const cdUntouched = ctl.cooldownLeft('A1') === 8 && ctl.cooldownLeft('A2') === 8; // milestone #1 is refund-free
  Q.step(1.0); // inside the 1.2s window: no reset
  const midBurst = burstStore().burst || 0;
  const stillActive = (burstStore().burstDeadline || 0) > 0 && midBurst >= 150 && midBurst < 200;
  b.takeDamage(13.72, a, 'arsenal-PISTOL'); // extends the deadline
  Q.step(1.0);
  const extended = (burstStore().burst || 0) > midBurst && (burstStore().burst || 0) < 200;
  Q.step(0.3); // >= 1.2s silence
  const stAfter = burstStore();
  const resets = c.arr.filter(e => e.type === 'RobotBurstReset');
  c.stop();
  const ok = !!m && lawShape && JSON.stringify(milestones8) === '[1]' && nextAfterHits === 2
    && refunds.length === 0 && stillActive && extended && cdUntouched
    && (stAfter.burst || 0) === 0 && (stAfter.next || 1) === 1 && resets.length >= 1;
  gate('R8-rolling-burst-law-and-reset', ok,
    { cfg: { w: cfg.burstWindowSec, f: cfg.firstThreshold, s: cfg.thresholdStep }, milestones8, refunds: refunds.length, midBurst, stillActive, extended, cdUntouched, lawShape, after: stAfter, resets: resets.length });
}

/* =============================================================================
/* =============================================================================
 * R8b — A single large hit crosses multiple thresholds, each exactly once.
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2012);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const a = win.fighters[0], b = win.fighters[1];
  let g2 = 0;
  while ((burstStore().burst || 0) < 140 && g2++ < 40) b.takeDamage(13.72, a, 'arsenal-PISTOL');
  const c = collector();
  b.takeDamage(460, a, 'arsenal-PISTOL'); // one large hit crosses several thresholds
  const ev = c.arr.filter(e => e.type === 'RobotPassiveMilestone').map(e => e.payload.milestone);
  c.stop();
  const ascendingOnce = ev.length >= 3 && ev.every((v, i) => i === 0 || v === ev[i - 1] + 1);
  const ok = !!m && ascendingOnce;
  gate('R8b-single-hit-multi-cross-once', ok, { milestones: ev });
}

/* =============================================================================
/* =============================================================================
 * R9 — Passive refund SEQUENCE law (TEST-ONLY threshold fixture).
 *
 * The fixture thresholds below are NOT production values and NOT an
 * authority claim — they exist only to prove the frozen refund sequence
 * (#1 none, #2 0.5s, #3 1.0s, #4 1.5s, subsequent +0.5s) and the
 * "refund the currently relevant Active" targeting inside ONE rolling
 * burst. Production thresholds are covered independently by R8/R8b/R10.
 * ============================================================================= */
{
  const m = Q.start('ROBOT', 'ICE', 2009);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const a = win.fighters[0], b = win.fighters[1];
  const pCt = Q.ct();
  // TEST-ONLY FIXTURE (see header) — runtime config copy, never the registry.
  pCt.skills.PASSIVE.cfg = { ...pCt.skills.PASSIVE.cfg, firstThreshold: 12, thresholdStep: 12 };
  const ctl = Q.ctl();
  ctl.setCooldown('A1', 8); ctl.setCooldown('A2', 8);
  const c = collector();
  for (let i = 0; i < 5; i++) b.takeDamage(13.72, a, 'arsenal-PISTOL'); // burst 12/24/36/48/60
  const events = c.arr.filter(e => e.type === 'MilestoneRefund')
    .map(e => ({ m: e.payload.milestone, slot: e.payload.slot, refund: e.payload.refund }));
  const expected = [0.5, 1.0, 1.5, 2.0]; // #1 (refund 0) is an idle proc
  const oneProcEach = events.length === 4 && events.every((e, i) => e.m === i + 2 && e.slot === 'A1' && Math.abs(e.refund - expected[i]) < 1e-9);
  const cdA1 = ctl.cooldownLeft('A1');
  const cdA2 = ctl.cooldownLeft('A2');
  const cdOk = Math.abs(cdA1 - (8 - 5.0)) < 1e-9 && cdA2 === 8; // 0.5+1+1.5+2 = 5.0 to A1
  // Second phase: only A2 cooling -> the refund targets A2 ("relevant Active").
  ctl.setCooldown('A1', 0); ctl.setCooldown('A2', 6);
  b.takeDamage(13.72, a, 'arsenal-PISTOL'); // burst 72 -> milestone 6 (72)
  const ev6 = c.arr.filter(e => e.type === 'MilestoneRefund' && e.payload.milestone === 6);
  c.stop();
  const refund6 = ev6.length === 1 && ev6[0].payload.slot === 'A2' && Math.abs(ev6[0].payload.refund - 2.5) < 1e-9;
  const cdA2After = ctl.cooldownLeft('A2');
  const ok = !!m && oneProcEach && cdOk && refund6 && Math.abs(cdA2After - (6 - 2.5)) < 1e-9;
  gate('R9-passive-refund-sequence-law', ok,
    { events, cdA1, cdA2, ev6: ev6.map(e => ({ m: e.payload.milestone, slot: e.payload.slot, refund: e.payload.refund })), cdA2After });
}

/* Production rolling thresholds + truthful clamped refund + READY silence + reset. */
{
  Q.start('ROBOT', 'ICE', 2010);
  const a = win.fighters[0], b = win.fighters[1], ctl = Q.ctl();
  const ct = Q.ct();
  let st = ct.store['robot.damage_milestones'] || {};
  const events = [], emit = Q.hr().AIL.bus.emit;
  Q.hr().AIL.bus.emit = function(type, payload) { if(type.startsWith('RobotPassive')) events.push({type,payload}); return emit.call(this,type,payload); };
  const hitTo = value => { let guard=0; while((st.burst || 0) < value - 1e-7 && guard++<24) { b.takeDamage(Math.max(1,(value - (st.burst || 0)) * 1.2), a, 'arsenal-PISTOL'); st = ct.store['robot.damage_milestones'] || {}; } };
  hitTo(100); const before = st.next || 1;
  hitTo(150); const first = events.filter(e => e.type==='RobotPassiveUpgrade').length;
  ctl.setCooldown('A1',8); hitTo(200);
  ctl.setCooldown('A1',0.2); hitTo(250);
  ctl.setCooldown('A1',0); ctl.setCooldown('A2',6); hitTo(300);
  ctl.setCooldown('A1',0); ctl.setCooldown('A2',0); hitTo(400);
  const upgrades=events.filter(e=>e.type==='RobotPassiveUpgrade').map(e=>e.payload);
  const milestones=events.filter(e=>e.type==='RobotPassiveMilestone');
  const state=Q.hr().robotPassiveHud(a);
  const baseUntouched = ct.skills.A1.cfg.cooldown === 10 && ct.skills.A2.cfg.cooldown === 10;
  const ok=before===1&&first===0&&(st.next||1)===7&&milestones.length===6&&upgrades.length===3
    &&upgrades[0].slot==='A1'&&Math.abs(upgrades[0].refund-.5)<1e-9
    &&upgrades[1].slot==='A1'&&Math.abs(upgrades[1].refund-.2)<1e-9
    &&upgrades[2].slot==='A2'&&Math.abs(upgrades[2].refund-1.5)<1e-9&&state.refund===null&&baseUntouched;
  Q.hr().AIL.bus.emit=emit;
  Q.step(1.3); // silence window must fully clear the burst
  const reset=Q.hr().robotPassiveHud(a);
  Q.start('ROBOT','ICE',2011);
  const fresh=Q.hr().robotPassiveHud(win.fighters[0]);
  gate('R10-production-truthful-refund-and-reset',ok&&reset.reached===0&&reset.burst===0&&fresh.reached===0&&fresh.burst===0,{milestones:milestones.length,upgrades,state,reset,fresh});
}

/* ------------------------------------------------------------------ summary */
const total = Object.keys(report.gates).length;
const passed = Object.values(report.gates).filter(g => g.pass).length;
console.log(`\n[HERO REWORK ROBOT GATES] ${passed}/${total} gates passed`);
if (report.failures.length) console.log('FAILURES:', report.failures.join(', '));
report.summary = { total, passed, failed: report.failures };
fs.writeFileSync(path.join(evidenceDir, 'robot-gates-report.json'), JSON.stringify(report, null, 2));
try { win.close(); } catch (e) { /* teardown only */ }
process.exit(report.failures.length ? 1 : 0);
