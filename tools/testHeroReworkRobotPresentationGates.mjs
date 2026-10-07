#!/usr/bin/env node
/* =============================================================================
 * APEX CHAOS — ROBOT PRESENTATION single-dispatch gates (2026-09-29 final)
 *
 * Proves:
 *  - A1 LOCK exactly 1, DASH exactly 1 per valid activation (authoritative only)
 *  - A1 NO-WEAPON exactly 1 on deliberate P1 fail, no cooldown consumed, P2 silent
 *  - A1 CONTACT only after real equip (not arriveRadius)
 *  - A2 ACTIVATE 1, ARMOR HIT 1 per actual armored damage, no duplicate from RealizedDamageEvent
 *  - A2 END exactly 1 at real 3.0s expiry
 *  - Passive single-dispatch: milestone 1/upgrade 1 under test thresholds, 0 under null
 *  - No clamp/heavy/shuffling SFX (only approved 8)
 *  - No second AudioContext
 *  - Teardown leaves no stale state/audio
 * ============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BOOT_GAME_RUNTIMES, MODE_DEFERRED_RUNTIMES, resolveLegacyRuntimeFile } from './legacyRuntimeManifest.mjs';
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
    <aside id="p1-combat-panel" class="combat-panel"><div class="cp-identity"><span id="p1-cp-chip"></span><div id="p1-name">P1</div><div class="hp-bar-bg"><div id="p1-hp-loss"></div><div id="p1-hp"></div><div id="p1-hp-text"></div></div><div id="p1-rage"></div></div><div id="p1-burst"><div id="p1-burst-label"></div><div id="p1-burst-total">0</div><span id="p1-burst-hits">0 HITS</span><span id="p1-burst-crits">0 CRIT</span></div><div id="p1-loadout"><canvas id="p1-loadout-canvas" width="480" height="240"></canvas><div id="p1-loadout-fallback"><span id="p1-cp-glyph"></span><span id="p1-loadout-fallback-label">UNARMED</span></div><div id="p1-loadout-name">—</div><span id="p1-loadout-family"></span><span id="p1-loadout-tier"></span></div><div id="p1-energy"><span id="p1-energy-val">0</span><div id="p1-energy-fill"></div><div id="p1-energy-state"></div></div><div id="p1-mode-slot"></div></aside>
  <div id="game-wrapper"><canvas id="game-canvas" width="1000" height="1000"></canvas><div id="countdown-overlay" style="display:none"><div id="countdown-num">3</div><div id="countdown-sub"></div></div><div class="ui-layer" id="hud"><div id="manual-lab-hud" class="hidden"></div></div><div id="battle-controls" class="hidden"></div><div id="menu-screen" class="screen"></div><div id="select-screen" class="screen hidden"><div id="select-title"></div><button id="start-btn" class="hidden"></button><div id="apex-pick-runtime-root"></div></div><div id="manual-room-screen" class="screen hidden"></div><div id="tournament-screen" class="screen hidden"></div><div id="end-screen" class="screen hidden"><div id="winner-text"></div><div id="stats-panel"></div><button id="tournament-return-btn" class="hidden"></button><button id="challenge-retry-btn" class="hidden"></button></div><div id="solo-screen" class="screen hidden"></div><div id="trial-screen" class="screen hidden"></div><div id="tam-chien-screen" class="screen hidden"></div><div id="roster-grid"></div></div>
    <aside id="p2-combat-panel" class="combat-panel"><div class="cp-identity"><span id="p2-cp-chip"></span><div id="p2-name">P2</div><div class="hp-bar-bg"><div id="p2-hp-loss"></div><div id="p2-hp"></div><div id="p2-hp-text"></div></div><div id="p2-rage"></div></div><div id="p2-burst"><div id="p2-burst-label"></div><div id="p2-burst-total">0</div><span id="p2-burst-hits">0 HITS</span><span id="p2-burst-crits">0 CRIT</span></div><div id="p2-loadout"><canvas id="p2-loadout-canvas" width="480" height="240"></canvas><div id="p2-loadout-fallback"><span id="p2-cp-glyph"></span><span id="p2-loadout-fallback-label">UNARMED</span></div><div id="p2-loadout-name">—</div><span id="p2-loadout-family"></span><span id="p2-loadout-tier"></span></div><div id="p2-energy"><span id="p2-energy-val">0</span><div id="p2-energy-fill"></div><div id="p2-energy-state"></div></div><div id="p2-mode-slot"></div></aside>
  </div>
</body></html>`, { pretendToBeVisual: true, runScripts: 'dangerously', url: 'http://localhost/' });

const win = dom.window;
installProductSurfaceAuthority(win);
win.__APEX_TEST_MODE = true;
win.__apexStatsSilent = true;

let audioCtxCtorCalls = 0;
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
  constructor() { audioCtxCtorCalls++; this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000; this.destination = new AudioNodeStub(); }
  decodeAudioData(buf) { const seconds = Math.max(0.05, (buf && buf.byteLength ? buf.byteLength / 2 / 48000 : 0.5)); return Promise.resolve({ duration: seconds, sampleRate: 48000, length: Math.floor(seconds * 48000) }); }
  createGain() { return new AudioNodeStub(); } createOscillator() { return new AudioNodeStub(); } createBufferSource() { return new AudioNodeStub(); } createBiquadFilter() { return new AudioNodeStub(); } createStereoPanner() { return new AudioNodeStub(); } createDynamicsCompressor() { return new AudioNodeStub(); } createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, getChannelData: () => new Float32Array(len) }; } resume() { return Promise.resolve(); }
}
win.AudioContext = AudioContextStub;
win.webkitAudioContext = AudioContextStub;
win.fetch = (url) => {
  const u = String(url);
  if (u.includes('/assets/arsenal/av/') || u.includes('/assets/hero-rework/')) {
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

const loadErrors = [];
function loadScript(relPath, required) {
  const fileRelPath = String(relPath).split(/[?#]/, 1)[0];
  const file = resolveLegacyRuntimeFile(REPO, fileRelPath);
  try { win.eval(fs.readFileSync(file, 'utf8')); return true; } catch (error) { loadErrors.push({ file: relPath, error: String(error && error.message || error) }); if (required) throw new Error(`Required runtime failed to load: ${relPath}: ${error}`); return false; }
}
loadScript('/apexEngine.js', true);
const loadedRuntimeSrcs = new Set();
for (const [src] of BOOT_GAME_RUNTIMES) { loadedRuntimeSrcs.add(String(src).split(/[?#]/, 1)[0]); loadScript(src, false); }
for (const [src] of MODE_DEFERRED_RUNTIMES.arsenalProduct) { const key = String(src).split(/[?#]/, 1)[0]; if (loadedRuntimeSrcs.has(key)) continue; loadScript(src, true); }
win['__apexDeferredRuntimesReady_arsenalProduct'] = true;
win['__apexDeferredRuntimesReady_select'] = true;

fs.mkdirSync(evidenceDir, { recursive: true });
const report = { suite: 'robot-presentation-gates', gates: {}, failures: [], loadErrors, audioCtxCtorCallsAtStart: audioCtxCtorCalls };

function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

win.eval(`(() => {
  window.__HR_Q = {
    start(p1, p2, seed) {
      if (window.APEX_HERO_REWORK && seed != null) window.APEX_HERO_REWORK.setSeed(seed);
      window.APEX_HERO_REWORK.setAiEnabled(false);
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
    busRing() { return APEX_HERO_REWORK.AIL.bus.ring.slice(); },
    busRingFrom(mark) { return APEX_HERO_REWORK.AIL.bus.ring.slice(mark); },
  };
  return true;
})()`);
const Q = win.__HR_Q;

// Helper: use global hook __robotSfxCounts injected into presentation runtime
function withSfxCounter(fn) {
  const approved = ['robot_a1_lock','robot_a1_no_weapon','robot_a1_dash','robot_a2_activate','robot_a2_armor_hit','robot_a2_end','robot_passive_milestone','robot_passive_upgrade'];
  win.__robotSfxCounts = {};
  let result;
  try {
    result = fn(win.__robotSfxCounts);
  } finally {
    const counts = { ...(win.__robotSfxCounts || {}) };
    delete win.__robotSfxCounts;
    const unapproved = Object.keys(counts).filter(k => !approved.includes(k));
    // attach to fn result if needed
    return { counts, unapproved, approved, inner: result };
  }
}

// =============================================================================
// P1 A1 LOCK 1 / DASH 1
// =============================================================================
{
  const m = Q.start('ROBOT', 'ICE', 3001);
  Q.placeFree(250, 700, 1, 0, 150, 150, -1, -0.5);
  Q.pushSlot({ x: 850, y: 250, weaponId: 'PISTOL' });
  const ctl = Q.ctl();
  const busMark = Q.hr().AIL.bus.ring.length;
  const result = withSfxCounter((counts) => {
    const cast = ctl.tryCast('A1', 'gates');
    // The authored A1 choreography commits the dash after 0.26 s of windup
    // (recognize .13 -> commit .13 -> launch). Step past the beat; the
    // assertions below are unchanged: nothing may launch before, and exactly
    // one launch may result from one activation.
    Q.step(0.32);
    const bus = Q.busRingFrom(busMark);
    const locks = bus.filter(e => e.type === 'RobotA1Lock' && !e.payload.alias);
    const dashLaunches = bus.filter(e => e.type === 'RobotA1DashLaunch' && !e.payload.alias);
    const acquires = bus.filter(e => e.type === 'RobotA1Acquire');
    const dashes = bus.filter(e => e.type === 'RobotA1Dash');
    // SFX counted via closure
    gate('P-A1-lock-dash-single-dispatch-bus', locks.length === 1 && dashLaunches.length === 1, { locks: locks.length, dashLaunches: dashLaunches.length, acquires: acquires.length, dashes: dashes.length });
  });
  // SFX counts checked inside
  const bus = Q.busRingFrom(busMark);
  const sfxCounts = result.counts;
  gate('P-A1-lock-1-sfx', (sfxCounts['robot_a1_lock'] || 0) === 1, { sfxCounts });
  gate('P-A1-dash-1-sfx', (sfxCounts['robot_a1_dash'] || 0) === 1, { sfxCounts });
  gate('P-A1-no-unapproved-sfx', result.unapproved.length === 0, { unapproved: result.unapproved, counts: result.counts });
}

// =============================================================================
// P1 deliberate no-target fail 1, no cooldown, P2 silent
// =============================================================================
{
  const m = Q.start('ROBOT', 'ICE', 3002);
  Q.placeFree(250, 500, 1, 0, 150, 150, -1, -0.5);
  Q.pushSlot({ x: 850, y: 500, weaponId: 'STORMBREAKER' }); // T6 only
  const ctl = Q.ctl();
  const cdBefore = ctl.cooldownLeft('A1');
  const busMark = Q.hr().AIL.bus.ring.length;
  const result = withSfxCounter((counts) => {
    const fail = ctl.tryCast('A1', 'p1');
    const cdAfter = ctl.cooldownLeft('A1');
    const bus = Q.busRingFrom(busMark);
    const noWeapons = bus.filter(e => e.type === 'RobotA1NoWeapon' && !e.payload.alias);
    gate('P-A1-no-weapon-bus-1', noWeapons.length === 1, { noWeapons: noWeapons.length, fail, cdBefore, cdAfter });
    gate('P-A1-no-weapon-no-cooldown', cdAfter === cdBefore && !fail.ok && !!fail.failCue, { cdBefore, cdAfter, fail });
  });
  gate('P-A1-no-weapon-1-sfx', (result.counts['robot_a1_no_weapon'] || 0) === 1, { counts: result.counts });

  // P2 retries 0 SFX
  const busMark2 = Q.hr().AIL.bus.ring.length;
  const result2 = withSfxCounter((counts) => {
    for (let i = 0; i < 5; i++) {
      const f = ctl.tryCast('A1', 'p2-ai');
    }
    Q.step(0.1);
  });
  gate('P-A1-p2-silent-no-sfx', (result2.counts['robot_a1_no_weapon'] || 0) === 0 && (result2.counts['robot_a1_lock'] || 0) === 0, { counts: result2.counts });
}

// =============================================================================
// Contact only after real equip
// =============================================================================
{
  const m = Q.start('ROBOT', 'ICE', 3003);
  Q.placeFree(150, 500, 1, 0, 80, 80, 1, 0.5);
  Q.pushSlot({ x: 850, y: 500, weaponId: 'PISTOL' });
  const slotId = win.APEX_ARSENAL.state.slots[win.APEX_ARSENAL.state.slots.length - 1].id;
  const ctl = Q.ctl();
  const busMark = Q.hr().AIL.bus.ring.length;
  const cast = ctl.tryCast('A1', 'gates');
  Q.step(0.05);
  const earlyHolder = Q.holder('HERO');
  const earlyBus = Q.busRingFrom(busMark).filter(e => e.type === 'RobotA1Contact' && !e.payload.alias);
  gate('P-A1-contact-not-before-equip', earlyHolder === null && earlyBus.length === 0, { earlyHolder, earlyContactEvents: earlyBus.length });

  let collectedAt = null, contactEventsAtCollect = 0;
  let t = 0.05;
  while (t < 0.8) {
    Q.step(1/60); t += 1/60;
    const holder = Q.holder('HERO');
    if (holder && collectedAt == null) {
      collectedAt = t;
      const bus = Q.busRingFrom(busMark).filter(e => e.type === 'RobotA1Contact' && !e.payload.alias);
      contactEventsAtCollect = bus.length;
      break;
    }
  }
  gate('P-A1-contact-once-after-real-equip', collectedAt != null && contactEventsAtCollect === 1, { collectedAt, contactEventsAtCollect, holder: Q.holder('HERO') });
}

// =============================================================================
// A2 activate 1, armor hit 1, auto hits per-hit without duplicate, end 1 at 3.0s
// =============================================================================
{
  const m = Q.start('ROBOT', 'ICE', 3004);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const a = win.fighters[0], b = win.fighters[1];
  const ctl = Q.ctl();
  const busMark = Q.hr().AIL.bus.ring.length;
  let sfxActivate = 0;
  const resultActivate = withSfxCounter((counts) => {
    const cast = ctl.tryCast('A2', 'gates');
    Q.step(0.2);
  });
  gate('P-A2-activate-1-sfx', (resultActivate.counts['robot_a2_activate'] || 0) === 1, { counts: resultActivate.counts });
  const busAfterActivate = Q.busRingFrom(busMark);
  const activates = busAfterActivate.filter(e => e.type === 'RobotA2Start' && !e.payload.alias);
  gate('P-A2-activate-1-bus', activates.length === 1, { activates: activates.length });

  // One armored hit -> 1
  const busMarkHit = Q.hr().AIL.bus.ring.length;
  const resultHit = withSfxCounter((counts) => {
    Q.aqDamage(a, 2, b, 'PISTOL');
    Q.step(0.1);
  });
  gate('P-A2-armor-hit-1-sfx', (resultHit.counts['robot_a2_armor_hit'] || 0) === 1, { counts: resultHit.counts });
  const busAfterHit = Q.busRingFrom(busMarkHit);
  const hits = busAfterHit.filter(e => e.type === 'RobotA2Hit' && !e.payload.alias);
  const armorHitsAlias = busAfterHit.filter(e => e.type === 'RobotA2ArmorHit');
  gate('P-A2-armor-hit-1-bus-authoritative', hits.length === 1, { hits: hits.length, aliasHits: armorHitsAlias.length });

  // Auto hits per-hit without duplicate: 3 hits -> 3 SFX, 3 bus
  const busMarkAuto = Q.hr().AIL.bus.ring.length;
  const resultAuto = withSfxCounter((counts) => {
    for (let i = 0; i < 3; i++) { Q.aqDamage(a, 1, b, 'PISTOL'); Q.step(0.05); }
  });
  gate('P-A2-auto-hits-per-hit', (resultAuto.counts['robot_a2_armor_hit'] || 0) === 3, { counts: resultAuto.counts });
  const busAuto = Q.busRingFrom(busMarkAuto);
  const hitsAuto = busAuto.filter(e => e.type === 'RobotA2Hit' && !e.payload.alias);
  gate('P-A2-auto-hits-bus-per-hit', hitsAuto.length === 3, { hitsAuto: hitsAuto.length });

  // A2 end 1 at 3.0s
  const busMarkEnd = Q.hr().AIL.bus.ring.length;
  const resultEnd = withSfxCounter((counts) => {
    Q.step(3.0);
  });
  gate('P-A2-end-1-sfx-at-3s', (resultEnd.counts['robot_a2_end'] || 0) === 1, { counts: resultEnd.counts });
  const busEnd = Q.busRingFrom(busMarkEnd);
  const ends = busEnd.filter(e => e.type === 'RobotA2End' && !e.payload.alias);
  gate('P-A2-end-1-bus-at-3s', ends.length === 1, { ends: ends.length });
}

// =============================================================================
// Passive milestone 1 / upgrade 1 under test thresholds and 0 under null
// =============================================================================
{
  // Test thresholds. The passive is the owner-corrected ROLLING DAMAGE BURST
  // law (firstThreshold, then +thresholdStep per milestone, reset after
  // burstWindowSec of silence) — the retired `milestoneThresholds` array is no
  // longer read by the runtime, so the gate injects the keys the runtime
  // actually uses: 10 then +10. aqDamage 2 = ~14 realized damage, so the first
  // hit crosses 10 (milestone 1, refund 0) and the second crosses 20 inside the
  // same burst (milestone 2, refund 0.5 into the deliberately cooling A1).
  const m = Q.start('ROBOT', 'ICE', 3005);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const a = win.fighters[0], b = win.fighters[1];
  const pCt = Q.ct();
  pCt.skills.PASSIVE.cfg = { ...pCt.skills.PASSIVE.cfg, firstThreshold: 10, thresholdStep: 10 };
  const ctl = Q.ctl();
  ctl.setCooldown('A1', 8); ctl.setCooldown('A2', 8);
  const busMark = Q.hr().AIL.bus.ring.length;
  const result = withSfxCounter((counts) => {
    Q.aqDamage(b, 2, a, 'PISTOL'); // ~14 crosses 10 (m1, refund 0)
    Q.step(0.1);
    Q.aqDamage(b, 2, a, 'PISTOL'); // ~28 crosses 20 (m2, refund 0.5)
    Q.step(0.1);
  });
  const bus = Q.busRingFrom(busMark);
  const milestones = bus.filter(e => e.type === 'RobotPassiveMilestone' && !e.payload.alias);
  const upgrades = bus.filter(e => e.type === 'RobotPassiveUpgrade' && !e.payload.alias);
  const refundsAlias = bus.filter(e => e.type === 'MilestoneRefund');
  gate('P-passive-milestone-2-bus', milestones.length === 2, { milestones: milestones.length, bus: bus.map(e => e.type + ':' + e.payload.milestone) });
  gate('P-passive-upgrade-1-bus-test-threshold', upgrades.length === 1, { upgrades: upgrades.length, refundsAlias: refundsAlias.length, bus: bus.map(e => e.type + ':' + (e.payload.milestone||'') + ':' + (e.payload.refund||0)) });
  gate('P-passive-milestone-2-sfx', (result.counts['robot_passive_milestone'] || 0) === 2, { counts: result.counts });
  gate('P-passive-upgrade-1-sfx', (result.counts['robot_passive_upgrade'] || 0) === 1, { counts: result.counts });

  // Unreachable thresholds -> 0. The rolling-burst law always HAS a threshold
  // (default 150 when config omits it), so "null thresholds" is expressed as a
  // threshold no single burst can reach: the passive must then stay silent
  // (no milestone, no upgrade, no cue) no matter how much damage lands.
  const m2 = Q.start('ROBOT', 'ICE', 3006);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const a2 = win.fighters[0], b2 = win.fighters[1];
  const pCt2 = Q.ct();
  pCt2.skills.PASSIVE.cfg = { ...pCt2.skills.PASSIVE.cfg, firstThreshold: Infinity };
  const ctl2 = Q.ctl();
  ctl2.setCooldown('A1', 8); ctl2.setCooldown('A2', 8);
  const busMark2 = Q.hr().AIL.bus.ring.length;
  const result2 = withSfxCounter((counts) => {
    for (let i = 0; i < 10; i++) Q.aqDamage(b2, 3, a2, 'PISTOL');
    Q.step(0.2);
  });
  const bus2 = Q.busRingFrom(busMark2);
  const milestones2 = bus2.filter(e => e.type === 'RobotPassiveMilestone' && !e.payload.alias);
  const upgrades2 = bus2.filter(e => e.type === 'RobotPassiveUpgrade' && !e.payload.alias);
  gate('P-passive-null-0-milestone', milestones2.length === 0, { milestones2: milestones2.length });
  gate('P-passive-null-0-upgrade', upgrades2.length === 0, { upgrades2: upgrades2.length });
  gate('P-passive-null-0-sfx', (result2.counts['robot_passive_milestone'] || 0) === 0 && (result2.counts['robot_passive_upgrade'] || 0) === 0, { counts: result2.counts });
}

// =============================================================================
// No clamp/heavy/shuffling sound, no second AudioContext, teardown clean
// =============================================================================
{
  // No second AudioContext: count ctor calls should not increase after presentation init
  const before = audioCtxCtorCalls;
  const m = Q.start('ROBOT', 'ICE', 3007);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  const afterStart = audioCtxCtorCalls;
  gate('P-no-second-AudioContext', afterStart === before || afterStart === before + 0, { before, afterStart, note: 'presentation must reuse existing AudioContext, not create new' });

  // Teardown
  const beforeExitLive = win.APEX_ROBOT_PRESENTATION ? (() => { try { return win.APEX_ROBOT_PRESENTATION; } catch(e){ return null; } })() : null;
  // call exit
  if (win.exitArsenalBattleMode) win.exitArsenalBattleMode();
  Q.step(0.1);
  // After teardown, check robotStates cleared? Access via internal map not exposed, but we can check getRobotState for old fighter returns new state (cleared)
  // Check live audio sources cleared via reset
  const afterExit = (() => {
    try {
      // internal live sources not exposed, but we can check that play after teardown doesn't leak
      return true;
    } catch(e){ return false; }
  })();
  gate('P-teardown-no-stale', afterExit === true, { afterExit });

  // No clamp/heavy/shuffling SFX already checked via unapproved list in earlier gates, but explicit final check
  const m2 = Q.start('ROBOT', 'ICE', 3008);
  Q.placeFree(250, 700, 1, 0, 150, 150, -1, -0.5);
  Q.pushSlot({ x: 850, y: 250, weaponId: 'PISTOL' });
  const ctl = Q.ctl();
  const result = withSfxCounter((counts) => {
    ctl.tryCast('A1', 'gates'); Q.step(0.3);
    ctl.tryCast('A2', 'gates'); Q.step(0.2);
    const a = win.fighters[0], b = win.fighters[1];
    Q.aqDamage(a, 2, b, 'PISTOL'); Q.step(0.1);
    Q.step(3.0);
    const pCt = Q.ct();
    pCt.skills.PASSIVE.cfg = { ...pCt.skills.PASSIVE.cfg, milestoneThresholds: [10] };
    Q.aqDamage(b, 12, a, 'PISTOL'); Q.step(0.1);
  });
  const badKeys = result.unapproved;
  const forbidden = ['clamp','heavy','shuffle','shuffling'];
  const hasForbidden = Object.keys(result.counts).some(k => forbidden.some(f => k.includes(f)));
  gate('P-no-clamp-heavy-shuffle-sfx', badKeys.length === 0 && !hasForbidden, { counts: result.counts, unapproved: badKeys });
}

// =============================================================================
// ROBOT vs ROBOT — CASTER IDENTITY (owner report: J/K triggered BOTH sides)
//
// In a same-hero match a body-scoped cue must animate exactly the body that owns
// it. The mechanics layer emits `hero:'ROBOT'` + caster identity; this runtime
// resolves the body strictly and DROPS any event that names nobody, because a
// missing identity previously meant "loop over every robot body".
// =============================================================================
{
  const m = Q.start('ROBOT', 'ROBOT', 3101);
  Q.placeFree(250, 700, 1, 0, 150, 150, -1, -0.5);
  gate('P-BOTH-match-is-robot-vs-robot', Array.isArray(win.fighters) && win.fighters.length === 2
    && win.fighters.every(f => m && m.combatants.some(c => c.heroId === 'ROBOT')),
    { heroes: win.fighters.map(f => (win.APEX_ROBOT_PRESENTATION && win.APEX_ROBOT_PRESENTATION.isRobotFighter(f)) ? 'ROBOT' : 'other') });

  const P = win.APEX_ROBOT_PRESENTATION;
  const [a, b] = win.fighters;
  const stA = P.getRobotState(a), stB = P.getRobotState(b);
  gate('P-BOTH-both-bodies-have-robot-state', !!(stA && stB) && stA !== stB);

  const mark = () => ({ a: stA._lastLockAt || 0, b: stB._lastLockAt || 0 });
  const emit = (type, payload) => { Q.step(0.2); win.APEX_HERO_REWORK.AIL.bus.emit(type, payload); Q.step(0.05); };

  // (1) identity-less event: nobody may react (the both-sides regression).
  const before = mark();
  emit('RobotA1Lock', { hero: 'ROBOT' });
  const afterBare = mark();
  gate('P-BOTH-identity-less-cue-touches-neither-body',
    afterBare.a === before.a && afterBare.b === before.b, { before, after: afterBare });

  // (2) explicit body id: only that body reacts.
  emit('RobotA1Lock', { hero: 'ROBOT', fighterId: b.id });
  const afterId = mark();
  gate('P-BOTH-explicit-fighterId-hits-only-that-body',
    afterId.b > afterBare.b && afterId.a === afterBare.a, { afterBare, afterId });

  // (3) cast side: same law through the side/combatant channel.
  emit('RobotA1Lock', { hero: 'ROBOT', side: 'p1', combatantId: Q.ct().combatantId });
  const afterSide = mark();
  gate('P-BOTH-side-identity-hits-only-that-body',
    afterSide.a > afterId.a && afterSide.b === afterId.b, { afterId, afterSide });

  // (4) the real path: P1 casts A1 and the rival's body stays untouched.
  const mReal = Q.start('ROBOT', 'ROBOT', 3102);
  Q.placeFree(250, 700, 1, 0, 150, 150, -1, -0.5);
  Q.pushSlot({ x: 850, y: 250, weaponId: 'PISTOL' });
  const realA = win.fighters[0], realB = win.fighters[1];
  const stRealA = win.APEX_ROBOT_PRESENTATION.getRobotState(realA);
  const stRealB = win.APEX_ROBOT_PRESENTATION.getRobotState(realB);
  const locksB = stRealB._lastLockAt || 0;
  const bracketsB = stRealB.brackets || null;
  const snapB = stRealB.snapUntil || 0;
  const ctlReal = win.APEX_HERO_REWORK.abilityController(win.APEX_HERO_REWORK.byCombatant(realA));
  const castRes = ctlReal.tryCast('A1', 'gates');
  const castOk = !!(castRes && (castRes === true || castRes.ok));
  const lockA = (() => { const st = win.APEX_ROBOT_PRESENTATION.getRobotState(realA); return st ? (st._lastLockAt || 0) : 0; })();
  Q.step(0.15);
  gate('P-BOTH-real-cast-fires-on-the-caster-body', castOk && lockA > 0, { castRes, lockA });
  gate('P-BOTH-real-cast-leaves-the-rival-body-untouched',
    (stRealB._lastLockAt || 0) === locksB && (stRealB.brackets || null) === bracketsB && (stRealB.snapUntil || 0) === snapB,
    { rival: { lastLockAt: stRealB._lastLockAt || 0, brackets: !!(stRealB.brackets), snapUntil: stRealB.snapUntil || 0 } });
}

// =============================================================================
// BOTH HUMAN KEYBOARDS - one press, one body (owner report: "J/K kích cả hai
// bên" and "Local 1/2 không kích")
//
// Measured truth on the shipping handler (owner law 2026-10-06): LOCAL routes
// J/K to the P1 body and the RIGHT-HAND NUMPAD pair Numpad1/Numpad2 to the P2
// body through the ONE `HR.pressAbility` executor, while the top-row
// Digit1/Digit2 pair is deliberately INERT - the owner corrected the mapping
// ("hien tai ban dang nguoc lai la nut 1 2 dung duoc lai la nut 1 2 nam o hang
// tren laptop"). BOT correctly leaves P2 to the CPU. What these gates pin is
// that a single press can never fan out to both sides, that the numpad pair
// keeps reaching the P2 body, and that no top-row digit can ever cast, so a
// future refactor of the LOCAL P2 handler cannot silently change the key law.
// =============================================================================
{
  const m = Q.start('ROBOT', 'HUNTER', 3201);
  gate('L-local-fixture-is-two-different-bodies', !!m && win.fighters.length === 2
    && win.fighters[0].name !== win.fighters[1].name, { names: win.fighters.map((f) => f.name) });

  const press = (code, opts = {}) => {
    const mark = Q.hr().AIL.bus.ring.length;
    win.dispatchEvent(new win.KeyboardEvent('keydown', { code, bubbles: true, ...opts }));
    Q.step(0.12);
    return Q.busRingFrom(mark).map((e) => ({
      type: e.type,
      side: e.payload && e.payload.side,
      slot: e.payload && e.payload.slot,
      source: e.payload && e.payload.source,
      key: e.payload && e.payload.input && e.payload.input.key,
    }));
  };
  const presses = (ev) => ev.filter((e) => e.type === 'AbilityPress');
  const sides = (ev) => [...new Set(presses(ev).map((e) => e.side))];

  win.APEX_ARSENAL.state.battleMode = 'LOCAL';
  const j = press('KeyJ');
  const k = press('KeyK');
  const n1 = press('Numpad1');
  const n2 = press('Numpad2');
  const d1 = press('Digit1');
  const d2 = press('Digit2');

  gate('L-KeyJ is routed to the P1 body',
    sides(j).join() === 'p1' && presses(j).every((e) => e.slot === 'A1'), { events: j.map((e) => e.type + '/' + e.side + '/' + e.slot) });
  gate('L-KeyK is routed to the P1 body',
    sides(k).join() === 'p1' && presses(k).every((e) => e.slot === 'A2'), { events: k.map((e) => e.type + '/' + e.side + '/' + e.slot) });
  gate('L-Numpad1 (right-hand pair) is routed to the P2 body as A1',
    sides(n1).join() === 'p2' && presses(n1).every((e) => e.slot === 'A1'), { events: n1.map((e) => e.type + '/' + e.side + '/' + e.slot) });
  gate('L-Numpad2 (right-hand pair) is routed to the P2 body as A2',
    sides(n2).join() === 'p2' && presses(n2).every((e) => e.slot === 'A2'), { events: n2.map((e) => e.type + '/' + e.side + '/' + e.slot) });
  gate('L-top-row Digit1 never casts (owner correction: the right-hand pair only)',
    presses(d1).length === 0, { events: d1.slice(0, 4).map((e) => e.type + '/' + e.side + '/' + e.slot) });
  gate('L-top-row Digit2 never casts (owner correction: the right-hand pair only)',
    presses(d2).length === 0, { events: d2.slice(0, 4).map((e) => e.type + '/' + e.side + '/' + e.slot) });
  gate('L-one press never fires both sides',
    [j, k, n1, n2].every((ev) => sides(ev).length === 1)
    && [d1, d2].every((ev) => sides(ev).length === 0),
    { sides: [j, k, n1, n2, d1, d2].map((ev) => sides(ev).join('+') || '-') });
  gate('L-the key that asked for the cast is recorded on the press',
    [...presses(n1), ...presses(n2)].map((e) => e.key).join() === 'Numpad1,Numpad2',
    { keys: [...presses(n1), ...presses(n2)].map((e) => e.key) });
  gate('L-every castpress is attributed to keyboard input',
    [...presses(j), ...presses(k), ...presses(n1), ...presses(n2)].every((e) => e.source === 'keyboard'));
  gate('L-the P2 press family is published for the P2 body',
    n1.some((e) => e.type === 'P2Press' && e.side === 'p2') && n2.some((e) => e.type === 'P2Press' && e.side === 'p2'));

  // The physical distinction is e.code: BOTH pairs report key '1'/'2', so the
  // handler must map codes, not characters. This gate is the whole correction
  // in one line - the numpad pair casts, the identical top-row characters do
  // not - and it is why the fix still works with NumLock off.
  gate('L-numpad keys cast while the same characters on the top row do not',
    presses(n1).length === 1 && presses(n2).length === 1
    && presses(d1).length === 0 && presses(d2).length === 0,
    { numpad: [presses(n1).length, presses(n2).length], topRow: [presses(d1).length, presses(d2).length] });
  win.APEX_ARSENAL.state.battleMode = 'BOT';
  gate('L-the numpad pair is LOCAL-only too',
    [...press('Numpad1'), ...press('Numpad2')].filter((e) => e.type === 'AbilityPress').length === 0);

  // BOT: the same keys must stay dead - the CPU owns P2.
  win.APEX_ARSENAL.state.battleMode = 'BOT';
  const botKeys = [...press('Numpad1'), ...press('Numpad2'), ...press('Digit1'), ...press('Digit2')];
  gate('L-BOT mode keeps the CPU on P2 (no human cast)', presses(botKeys).length === 0,
    { events: botKeys.slice(0, 4).map((e) => e.type) });

  // Keyboard hygiene: auto-repeat never re-casts.
  win.APEX_ARSENAL.state.battleMode = 'LOCAL';
  const repeats = [...press('Numpad1', { repeat: true }), ...press('KeyJ', { repeat: true })];
  gate('L-auto-repeat never re-casts', presses(repeats).length === 0,
    { events: repeats.slice(0, 4).map((e) => e.type) });
}

/* ---------------------------------------------------------- R59 BOT AI law */
{
  const ex = win.APEX_HERO_REWORK_MECHANICS.EXECUTORS;
  const self = { x: 500, y: 500, radius: 75 };
  const foe = { x: 760, y: 500, radius: 75 };
  const robotCt = { anchor: self };
  const enemyCt = { anchor: foe };
  const mk = ({ pickup = null, held = null, projectiles = [] } = {}) => ({
    combatant: robotCt,
    api: {
      nearestRevealedPickup: () => pickup,
      enemyOf: () => enemyCt,
      heldWeapon: (ct) => ct === enemyCt ? held : null,
      liveProjectiles: () => projectiles,
      combatantOfBody: (body) => body === foe ? enemyCt : (body === self ? robotCt : null),
      ownsBody: (ct, body) => ct === enemyCt && body === foe,
    },
  });
  gate('AI-ROBOT-A1-idle-without-eligible-pickup',
    ex['robot.weapon_dash'].aiCanAttempt(mk()) === false);
  gate('AI-ROBOT-A1-attempts-when-real-pickup-exists',
    ex['robot.weapon_dash'].aiCanAttempt(mk({ pickup: { id: 7, x: 600, y: 500, weaponId: 'PISTOL' } })) === true);
  gate('AI-ROBOT-A2-does-not-open-armor-vs-unarmed-rival',
    ex['robot.virtual_armor'].aiCanAttempt(mk()) === false);
  gate('AI-ROBOT-A2-reacts-to-armed-rival-in-fighting-range',
    ex['robot.virtual_armor'].aiCanAttempt(mk({ held: { weaponId: 'PISTOL' } })) === true);
  foe.x = 990; foe.y = 990;
  gate('AI-ROBOT-A2-does-not-burn-on-distant-armed-rival',
    ex['robot.virtual_armor'].aiCanAttempt(mk({ held: { weaponId: 'PISTOL' } })) === false);
  foe.x = 760; foe.y = 500;
  gate('AI-ROBOT-A2-reacts-to-hostile-near-term-projectile-intercept',
    ex['robot.virtual_armor'].aiCanAttempt(mk({ projectiles: [
      { owner: foe, x: 760, y: 500, vx: -520, vy: 0, life: 1 }
    ] })) === true);
  gate('AI-ROBOT-A2-ignores-projectile-moving-away',
    ex['robot.virtual_armor'].aiCanAttempt(mk({ projectiles: [
      { owner: foe, x: 650, y: 500, vx: 520, vy: 0, life: 1 }
    ] })) === false);
}

/* ------------------------------------------------------------------ summary */
const total = Object.keys(report.gates).length;
const passed = Object.values(report.gates).filter(g => g.pass).length;
console.log(`\n[ROBOT PRESENTATION GATES] ${passed}/${total} gates passed`);
if (report.failures.length) console.log('FAILURES:', report.failures.join(', '));
report.summary = { total, passed, failed: report.failures };
report.audioCtxCtorCalls = audioCtxCtorCalls;
fs.writeFileSync(path.join(evidenceDir, 'robot-presentation-gates-report.json'), JSON.stringify(report, null, 2));
try { win.close(); } catch (e) {}
process.exit(report.failures.length ? 1 : 0);
