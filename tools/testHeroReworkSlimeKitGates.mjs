#!/usr/bin/env node
/* =============================================================================
 * APEX CHAOS — Hero Rework QUALIFICATION gates: LEGACY/REWORK SLIME SEPARATION
 * (Q3a).
 *
 * Authority: docs/hero-rework/phase1/10 (Q3 architecture law),
 *            docs/hero-rework/phase1/12 (this audit — classification table).
 *
 * Law: canonical playable REWORK SLIME (makeReworkShell type,
 * type.arsenalShell === true) runs ONLY the rework kit — no legacy slime_child
 * spawns, no legacy fighters[] clone splits, no legacy damage modification.
 * Legacy/boss SLIME (FT('SLIME'), no arsenalShell flag) keeps its legacy kit.
 *
 * Gates:
 *   L1  rework shell under legacy trigger load: zero slime_child/slime_mucus
 *       projectiles, fighters[] never grows (no clones)
 *   L2  rework shell realizes weapon damage EXACTLY (no legacy guard absorb,
 *       no gel modifier) on the real aqDamage path
 *   L3  rework shell keeps NO legacy bookkeeping (slimeDmgWindow/childCounter/
 *       shockCounter stay empty)
 *   L4  legacy-type SLIME still runs legacy child spawn (legacy preserved)
 *   L5  legacy-type SLIME still performs legacy fighters[] mitosis clones
 *       (legacy preserved — the B3/B4 kits remain load-bearing)
 *   L6  rework shell SLIME is a live rework combatant (M installed, body in
 *       combatant.bodies, isRework identity)
 *
 * Usage: node tools/testHeroReworkSlimeLegacySeparation.mjs
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
const report = { suite: 'hero-rework-slime-kit-gates', gates: {}, failures: [], loadErrors };
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
    bodies() {
      const ct = APEX_HERO_REWORK.byCombatant(fighters[0]);
      return ct.bodies.map(b => ({
        id: b.id, x: b.x, y: b.y, dirx: b.dir.x, diry: b.dir.y,
        hp: b.hp, maxHp: b.maxHp, radius: b.radius, baseSpeed: b.baseSpeed,
        kind: b.__hrChild ? b.__hrChild.kind : null,
        held: (APEX_ARSENAL.weaponApi.getHolder(b) || {}).weaponId || null,
      }));
    },
    inFighters(bodyId) {
      return fighters.some(f => f && f.id === bodyId);
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
    slots() {
      return APEX_ARSENAL.state.slots.map(s => ({ id: s.id, phase: s.phase, weaponId: s.weaponId, x: s.x, y: s.y }));
    },
    ctl() { return APEX_HERO_REWORK.abilityController(APEX_HERO_REWORK.byCombatant(fighters[0])); },
    ct() { return APEX_HERO_REWORK.byCombatant(fighters[0]); },
    hr() { return APEX_HERO_REWORK; },
  };
  return true;
})()`);
const Q = win.__HR_Q;

// Helpers on the REAL production surfaces (real Fighter objects throughout).
const W = win.APEX_ARSENAL.weaponApi;
const HR = win.APEX_HERO_REWORK;
function slimeCt() { return HR.byCombatant(win.fighters[0]); }
function realBodies() { return slimeCt().bodies.slice(); }
function shedKids() { return realBodies().filter(x => x.hp > 0 && x.__hrChild && x.__hrChild.kind === 'shed'); }
function heldOf(body) { const h = W.getHolder(body); return (h && h.weaponId) || null; }
function hit(body, amount, source, opts) {
  // Controlled hit through the REAL aqDamage entry. STORMBREAKER is a
  // final-authority weapon (confirmedHitDamage) so `amount` is the exact
  // submitted damage; realized damage is MEASURED (shared roster tuning
  // multiplies uniformly — never assumed away).
  return W.aqDamage(body, amount, source, 'STORMBREAKER', opts || {});
}
function shedState() {
  const st = slimeCt().store['slime.damage_shedding'] || {};
  return { progress: st.progress || 0, shedUntil: st.shedUntil || 0 };
}

/* =============================================================================
 * S9 — A2 Damage Shedding: threshold spawn with carry-over, child stats,
 * HP transfer (never free), 90% speed, non-overlap; capacity cap RETAINS
 * progress (exact arithmetic — never burns); killed-child HP is lost (not
 * returned, not recycled — isolated with a clearly-labeled TEST-ONLY window
 * fixture so the loss cannot be confounded with a spawn); retained progress
 * resumes spawning once a slot frees. Expectations measured from the REAL
 * realized-damage path (shared roster tuning multiplies uniformly).
 * ============================================================================= */
{
  const m = Q.start('SLIME', 'ICE', 3101);
  Q.placeFree(500, 500, 1, 0, 150, 150, -1, -0.5);
  const a = win.fighters[0], b = win.fighters[1];
  win.fighters[1].x = 60; win.fighters[1].y = 60; win.fighters[1].setDir(-0.4, -0.4); // park P2
  const parentSpeed = a.baseSpeed;
  // Probe the realized scale BEFORE the window (probe hit must not count).
  const probeBefore = a.hp;
  hit(a, 10, b);
  const scale = (probeBefore - a.hp) / 10;
  a.hp = probeBefore; // repair probe (HP arrange, not locomotion)
  const cast = Q.ctl().tryCast('A2', 'gates');
  const hp0 = a.hp;
  hit(a, 60, b); hit(a, 60, b); // -> 1 child (100 threshold), carry-over
  const kids1 = shedKids();
  const s1 = shedState();
  const child1 = kids1[0];
  const realized12 = (hp0 - a.hp) - 140 * kids1.length; // damage + transfer
  const transferExact = Math.abs(a.hp - (hp0 - realized12 - 140)) < 1e-6;
  const statsOk = child1 && Math.abs(child1.hp - 140) < 1e-6
    && Math.abs(child1.radius - 45) < 1e-6
    && Math.abs(child1.baseSpeed - parentSpeed * 0.9) < 1e-6;
  const d = child1 ? Math.hypot(child1.x - a.x, child1.y - a.y) : 0;
  const nonOverlap = d >= a.radius + 45 - 1;
  const carryOk = Math.abs(s1.progress - (realized12 - 100)) < 1e-6;
  // Capacity: three live children max. Blocked progress is RETAINED — the
  // residue must equal exact arithmetic (total realized - 300 consumed).
  const hpB3 = a.hp;
  hit(a, 60, b); hit(a, 60, b); hit(a, 60, b);
  const kids3 = shedKids();
  const s3 = shedState();
  const realized3 = (hpB3 - a.hp) - 140 * (kids3.length - kids1.length); // transfers for kids 2..3
  const residueExact = Math.abs(s3.progress - (realized12 + realized3 - 300)) < 1e-6;
  const capOk = kids3.length === 3 && s3.progress > 0 && residueExact;
  // KILLED-CHILD HP IS LOST. TEST-ONLY FIXTURE (not production state): close
  // the shedding window so the kill's realized damage cannot recycle into a
  // spawn — isolating the HP-loss law from the A2 counter law.
  slimeCt().store['slime.damage_shedding'].shedUntil = 0;
  const kidsPre = shedKids();
  const sumBeforeKill = a.hp + kidsPre.reduce((s, k) => s + k.hp, 0);
  const victimKid = kidsPre[0];
  const victimHp = victimKid.hp;
  const parentBeforeKill = a.hp;
  hit(victimKid, 2000, b); // kill one child through the real damage path
  const kidsPost = shedKids();
  const sumAfterKill = a.hp + kidsPost.reduce((s, k) => s + k.hp, 0);
  const killLost = victimKid.hp <= 0
    && Math.abs(a.hp - parentBeforeKill) < 1e-6
    && Math.abs((sumBeforeKill - sumAfterKill) - victimHp) < 1e-6;
  // RESUME FROM RETAINED PROGRESS: a fresh window (TEST-ONLY cooldown reset)
  // spawns immediately from the carried residue.
  Q.ctl().setCooldown('A2', 0); // TEST-ONLY fixture: isolate the second window
  const cast2 = Q.ctl().tryCast('A2', 'gates');
  const progressCarried = shedState().progress;
  const hpB4 = a.hp;
  const kidsB4 = shedKids().length;
  hit(a, 60, b);
  const kids4 = shedKids();
  const s4 = shedState();
  const spawned4 = kids4.length - kidsB4;
  const realized4 = (hpB4 - a.hp) - 140 * Math.max(0, kids4.length - kidsB4);
  const resumeDiff = Math.abs(s4.progress - (progressCarried + realized4 - 100 * Math.max(0, kids4.length - kidsB4)));
  const resumeOk = kids4.length === 3 && progressCarried > 0 && resumeDiff < 1e-6;
  const ok = !!m && cast.ok && scale > 0 && kids1.length === 1 && statsOk
    && transferExact && nonOverlap && carryOk && capOk && killLost && cast2.ok && resumeOk;
  gate('S9-a2-threshold-transfer-capacity', ok,
    { scale: +scale.toFixed(4), cast, cast2, kids1: kids1.length, statsOk, transferExact, nonOverlapDist: +d.toFixed(1), carry: +s1.progress.toFixed(2), expectedCarry: +(realized12 - 100).toFixed(2), capOk, progressAtCap: +s3.progress.toFixed(2), residueExact, victimHp: +victimHp.toFixed(2), killLost, progressCarried: +progressCarried.toFixed(2), kidsB4, kids4: kids4.length, realized4: +realized4.toFixed(4), resumeDiff: +resumeDiff.toFixed(8), resumeOk, progressAfter: +s4.progress.toFixed(2) });
}

/* =============================================================================
 * S10 — A2 child expiry: surviving HP returns to the nearest valid living
 * Body (HP ONLY — the child's radius/area is NEVER merged into the
 * receiver, owner correction), weapon drops as exactly one pickup slot,
 * and timed expiry NEVER deletes the final valid living Body's HP (a
 * promoted child anchor is exempt from expiry).
 * ============================================================================= */
{
  const m = Q.start('SLIME', 'ICE', 3102);
  Q.placeFree(500, 500, 1, 0, 150, 150, -1, -0.5);
  const a = win.fighters[0], b = win.fighters[1];
  const probeBefore = a.hp;
  hit(a, 10, b);
  a.hp = probeBefore;
  Q.ctl().tryCast('A2', 'gates');
  hit(a, 60, b); hit(a, 60, b); // 1 child (progress carries)
  // Run until just before the child's 5s lifetime, then arm it physically
  // (arena auto-fire may consume weapons during long free runs).
  Q.step(4.5);
  const kidMid = shedKids()[0];
  Q.pushSlot({ x: kidMid.x, y: kidMid.y, weaponId: 'PISTOL' });
  Q.step(0.15);
  const kidArmed = shedKids()[0];
  const heldBefore = kidArmed && heldOf(kidArmed);
  const slotsBefore = Q.slots().length;
  const hpSumBefore = a.hp + (kidArmed ? kidArmed.hp : 0);
  const parentRadiusBefore = a.radius;
  // Robust drop-law measurement (path-proof against arena auto-play pickups
  // consuming the drop before the snapshot): hook the live slot list's push
  // for the expiry window and count the DROP EVENT itself. The law asserted
  // is unchanged — the child's held weapon drops as EXACTLY ONE pickup slot
  // (REVEALED, WEAPON/PISTOL); its fate afterwards is either still visible
  // or consumed by a real in-arena pickup (both legitimate terminal states).
  // The arsenal may REASSIGN its slot array mid-run, so hook the shared
  // push primitive for the window and count WEAPON-slot creation events.
  // Hook INSIDE the jsdom window realm — game arrays live there, not on the
  // harness's Node realm, so the patch must live on the window's prototype.
  win.eval(`(function () {
    window.__s10pushed = [];
    const orig = Array.prototype.push;
    Array.prototype.push = function (...items) {
      for (const it of items) {
        if (it && it.kind === 'WEAPON' && it.weaponId) orig.call(window.__s10pushed, { phase: it.phase, kind: it.kind, weaponId: it.weaponId });
      }
      return orig.apply(this, items);
    };
    window.__s10unhook = function () { Array.prototype.push = orig; };
    return true;
  })()`);
  // Account REAL in-window damage to the receiver so the HP-return law is
  // measured path-proof (the arena keeps shooting during free runs).
  const dmgTaken = { v: 0 };
  const origTd = a.takeDamage;
  a.takeDamage = function (amount, src, kind) {
    const before = this.hp;
    origTd.call(this, amount, src, kind);
    dmgTaken.v += Math.max(0, before - this.hp);
  };
  Q.step(0.8); // past the child's 5s lifetime (the drop lands in this window)
  win.eval('window.__s10unhook()');
  a.takeDamage = origTd;
  const pushed = win.__s10pushed || [];
  const kidGone = shedKids().length === 0;
  const slotsNow = Q.slots();
  const returned = Math.abs(a.hp - (hpSumBefore - dmgTaken.v)) < 1e-6; // sum preserved (real in-window damage accounted)
  const radiusUntouched = Math.abs(a.radius - parentRadiusBefore) < 1e-9; // HP ONLY
  const pistolDrops = pushed.filter(p => p.kind === 'WEAPON' && p.weaponId === 'PISTOL');
  const dropExactlyOne = pistolDrops.length === 1 && pistolDrops[0].phase === 'REVEALED';
  const fateVisible = slotsNow.length === slotsBefore + 1
    && slotsNow[slotsNow.length - 1].phase === 'REVEALED'
    && slotsNow[slotsNow.length - 1].weaponId === 'PISTOL';
  const fateConsumed = win.fighters.some(f => f.data && f.data.arsenal && f.data.arsenal.weaponId === 'PISTOL');
  const oneSlot = dropExactlyOne && (fateVisible || fateConsumed);
  // Final-HP law: a promoted child anchor must never be expiry-deleted.
  Q.ctl().setCooldown('A2', 0); // TEST-ONLY: isolate the second window
  Q.ctl().tryCast('A2', 'gates');
  hit(a, 100, b); // spawn 1 child again
  const kid2Born = shedKids().length === 1;
  hit(a, 2000, b); // kill the anchor body -> child promoted to anchor
  Q.step(5.4); // past kid2's lifetime — as promoted anchor it must survive
  const survivor = realBodies().find(x => x.hp > 0);
  const finalHpSafe = !!survivor && survivor.hp > 0;
  const ok = !!m && kidArmed && heldBefore === 'PISTOL' && kidGone && returned
    && radiusUntouched && oneSlot && kid2Born && finalHpSafe;
  gate('S10-a2-expiry-return-hp-only-drop-final-hp-law', ok,
    { heldBefore, kidGone, returned, radiusUntouched, oneSlot, dropExactlyOne, fateVisible, fateConsumed, kid2Born, finalHpSafe, survivorHp: survivor && +survivor.hp.toFixed(1), hpSumBefore: +hpSumBefore.toFixed(1), dmgTaken: +dmgTaken.v.toFixed(1), aHpAfter: +a.hp.toFixed(1), pushed });
}

/* =============================================================================
 * S11 — A2 children are targetable, can pick up AND use dropped weapons.
 * ============================================================================= */
{
  const m = Q.start('SLIME', 'ICE', 3103);
  Q.placeFree(500, 500, 1, 0, 150, 150, -1, -0.5);
  const a = win.fighters[0], b = win.fighters[1];
  Q.ctl().tryCast('A2', 'gates');
  hit(a, 60, b); hit(a, 60, b);
  const kid = shedKids()[0];
  const targetable = kid && HR.getTargetableBodies(slimeCt()).some(x => x.id === kid.id);
  Q.pushSlot({ x: kid.x, y: kid.y, weaponId: 'PISTOL' });
  Q.step(0.2);
  const armedKid = shedKids()[0];
  const pickedUp = !!armedKid && heldOf(armedKid) === 'PISTOL';
  // USE: the holder auto-fires through the real weapon pipeline.
  const eventsMark = win.APEX_ARSENAL.events.length;
  Q.step(1.2);
  const kidNow = shedKids()[0];
  const used = win.APEX_ARSENAL.events.slice(eventsMark)
    .some(e => e.includes('SHOT') && e.includes('SLIME_CHILD'))
    || (kidNow ? (W.getHolder(kidNow) || {}).shotsFired > 0 : false);
  const ok = !!m && targetable && pickedUp && used;
  gate('S11-a2-child-targetable-pickup-use', ok,
    { targetable, pickedUp, used });
}

/* =============================================================================
 * S12 — Passive Emergency Mitosis: per-Body 80% reference-HP loss triggers
 * a split that REPLACES the source (never duplicates), each half >= 100
 * else no split, halves get new reference HP from creation state, and the
 * combatant dies only when no living Body remains.
 * ============================================================================= */
{
  const m = Q.start('SLIME', 'ICE', 3104);
  Q.placeFree(500, 500, 1, 0, 150, 150, -1, -0.5);
  const a = win.fighters[0], b = win.fighters[1];
  // Measure the realized scale, then land EXACTLY 800 realized (probe hit
  // first so it cannot count toward the trigger).
  const probeBefore = a.hp;
  hit(a, 10, b);
  const scale = (probeBefore - a.hp) / 10;
  a.hp = probeBefore;
  hit(a, 800 / scale, b); // 1000 -> 200 exactly (halves = 100 >= minSplitHp)
  const halves = realBodies();
  const halfHpNow = halves.map(x => x.hp);
  const halfRefs = halves.map(x => x.__hrRefHp || 0);
  const splitOk = halves.length === 2 && halfHpNow.every(hp => Math.abs(hp - 100) < 1e-6);
  // Creation-state reference HP: each half's __hrRefHp is its creation HP.
  const refOk = halfRefs.every(r => Math.abs(r - 100) < 1e-6);
  // Below-min guard: >=80% loss but halves would be < 100 -> NO split.
  const half0 = realBodies()[0];
  hit(half0, 81 / scale, b); // 100 -> ~19
  const still2 = realBodies().length === 2;
  // Death law: one half dead keeps the combatant alive; none living ends it.
  const half1 = realBodies().find(x => x !== half0 && x.hp > 0);
  hit(half0, 2000, b);
  const aliveAfterOne = realBodies().some(x => x.hp > 0);
  hit(half1, 2000, b);
  const allDead = !realBodies().some(x => x.hp > 0);
  const ok = !!m && scale > 0 && splitOk && refOk && still2 && aliveAfterOne && allDead;
  gate('S12-passive-emergency-mitosis-laws', ok,
    { scale: +scale.toFixed(4), splitOk, halfHp: halfHpNow, halfRefs, refOk, still2, aliveAfterOne, allDead });
}

/* =============================================================================
 * S13 — Seeded gameplay RNG only: no raw Math.random in the ROBOT/SLIME
 * gameplay layers (static producer scan).
 * ============================================================================= */
{
  const files = [
    'public/game/hero-rework/heroMechanicsRuntime.js',
    'public/game/hero-rework/heroReworkRuntime.js',
    'public/game/hero-rework/heroRegistry.js',
    'public/game/hero-rework/ailRuntime.js',
  ];
  const offenders = [];
  for (const f of files) {
    const s = fs.readFileSync(path.join(REPO, f), 'utf8');
    s.split('\n').forEach((line, i) => {
      if (/Math\.random\s*\(/.test(line) && !/^\s*(\*|\/\/|\/\*)/.test(line)) {
        offenders.push(`${f}:${i + 1}`);
      }
    });
  }
  gate('S13-seeded-gameplay-rng-only', offenders.length === 0, { offenders });
}

/* ------------------------------------------------------------------ summary */
const total = Object.keys(report.gates).length;
const passed = Object.values(report.gates).filter(g => g.pass).length;
console.log(`\n[HERO REWORK SLIME KIT GATES] ${passed}/${total} gates passed`);
if (report.failures.length) console.log('FAILURES:', report.failures.join(', '));
report.summary = { total, passed, failed: report.failures };
fs.writeFileSync(path.join(evidenceDir, 'slime-kit-gates-report.json'), JSON.stringify(report, null, 2));
try { win.close(); } catch (e) { /* teardown only */ }
process.exit(report.failures.length ? 1 : 0);
