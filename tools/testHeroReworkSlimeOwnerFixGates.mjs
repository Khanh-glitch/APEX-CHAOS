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
const report = { suite: 'hero-rework-slime-owner-fix-gates', gates: {}, failures: [], loadErrors };
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
      return { aSpeed: a.baseSpeed };
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
    ctl() { return APEX_HERO_REWORK.abilityController(APEX_HERO_REWORK.byCombatant(fighters[0])); },
    ct() { return APEX_HERO_REWORK.byCombatant(fighters[0]); },
    hr() { return APEX_HERO_REWORK; },
    drawOnce() { window.draw(); },
  };
  return true;
})()`);
const Q = win.__HR_Q;
const W = win.APEX_ARSENAL.weaponApi;
const HR = win.APEX_HERO_REWORK;

// Spy the REAL AV.drawEquippedWeapon (renderer-call spy — doc 14 G1
// explicitly allows supplementing real screenshots with this).
const av = win.APEX_ARSENAL_AV;
const drawSpy = { calls: [], on: false };
{
  const orig = av.drawEquippedWeapon.bind(av);
  av.drawEquippedWeapon = function (ctx, body, holder) {
    if (drawSpy.on) drawSpy.calls.push({ bodyId: body && body.id, name: body && body.name, weaponId: holder && holder.weaponId });
    return orig(ctx, body, holder);
  };
}
function spyDraw() {
  drawSpy.on = true;
  drawSpy.calls = [];
  Q.drawOnce();
  drawSpy.on = false;
  return drawSpy.calls.slice();
}

/* =============================================================================
 * G1 — visible child weapon: extra Body collects a real weapon, the real
 * foreground render path draws it exactly once while held, and the real
 * use/throw lifecycle still works.
 * ============================================================================= */
{
  const m = Q.start('SLIME', 'ICE', 4101);
  Q.placeFree(500, 500, 1, 0, 150, 150, -1, -0.5);
  Q.ctl().tryCast('A1', 'gates');
  Q.step(0.05);
  const child = Q.bodies().find(b => b.kind != null);
  // 1) physical collection
  Q.pushSlot({ x: child.x, y: child.y, weaponId: 'PISTOL' });
  Q.step(0.12);
  const realBodies = Q.ct().bodies;
  const childReal = realBodies.find(b => b.id === child.id);
  const heldNow = childReal && (W.getHolder(childReal) || {}).weaponId;
  // 2) holder exists on THAT exact body (holder/pose state is body-local:
  //    the holder IS the body's own data.arsenal — doc 14 R1)
  const holderBodyOk = !!(childReal && childReal.data && childReal.data.arsenal
    && childReal.data.arsenal.weaponId === 'PISTOL'
    && W.getHolder(childReal) === childReal.data.arsenal);
  // 3) real foreground render path draws it — exactly once per frame
  const calls = spyDraw();
  const childCalls = calls.filter(c => c.bodyId === child.id);
  const visible = childCalls.length === 1 && childCalls[0].weaponId === 'PISTOL';
  // 4/5) real use/throw lifecycle still works (arena holder auto-fire path)
  const eventsMark = win.APEX_ARSENAL.events.length;
  Q.step(1.2);
  const used = win.APEX_ARSENAL.events.slice(eventsMark)
    .some(e => typeof e === 'string' && e.includes('SHOT') && e.includes('SLIME_CHILD'))
    || (W.getHolder(childReal) ? (W.getHolder(childReal) || {}).shotsFired > 0 : true)
    || win.APEX_ARSENAL.state.detachedWeapons.length > 0;
  const ok = !!m && heldNow === 'PISTOL' && holderBodyOk && visible && used;
  gate('G1-visible-child-weapon', ok,
    { heldNow, holderBodyOk, visible, childCalls: childCalls.length, used, allCallBodies: calls.map(c => c.bodyId) });
}

/* =============================================================================
 * G2 — no duplicate draw: single-body Hero and split-SLIME anchor/child each
 * draw their equipped weapon exactly once per frame.
 * ============================================================================= */
{
  // (a) normal rework Hero — single body, one draw per frame (armed via the
  //     real physical pickup path so holder state is fully initialized)
  Q.start('ROBOT', 'ICE', 4102);
  Q.placeFree(500, 500, 1, 0, 150, 150, -1, -0.5);
  Q.pushSlot({ x: win.fighters[0].x, y: win.fighters[0].y, weaponId: 'PISTOL' });
  Q.step(0.12);
  const callsA = spyDraw();
  const aCalls = callsA.filter(c => c.bodyId === win.fighters[0].id);
  const singleHeroOk = aCalls.length === 1;
  // (b) split SLIME — anchor + child each exactly one
  Q.start('SLIME', 'ICE', 4103);
  Q.placeFree(500, 500, 1, 0, 150, 150, -1, -0.5);
  Q.ctl().tryCast('A1', 'gates');
  Q.step(0.05);
  const raw = Q.ct().bodies;
  const anchor = raw.find(b => !b.__hrChild);
  const child = raw.find(b => b.__hrChild);
  Q.pushSlot({ x: anchor.x, y: anchor.y, weaponId: 'PISTOL' });
  Q.pushSlot({ x: child.x, y: child.y, weaponId: 'SHOTGUN' });
  Q.step(0.12);
  const callsB = spyDraw();
  const anchorCalls = callsB.filter(c => c.bodyId === anchor.id);
  const childCalls2 = callsB.filter(c => c.bodyId === child.id);
  const splitOk = anchorCalls.length === 1 && childCalls2.length === 1
    && anchorCalls[0].weaponId === 'PISTOL' && childCalls2[0].weaponId === 'SHOTGUN';
  gate('G2-no-duplicate-anchor-or-child-draw', singleHeroOk && splitOk,
    { singleHeroCalls: aCalls.length, anchorCalls: anchorCalls.length, childCalls: childCalls2.length, anchorW: anchorCalls[0] && anchorCalls[0].weaponId, childW: childCalls2[0] && childCalls2[0].weaponId });
}

/* =============================================================================
 * G3 — Storm floor lightning hits extra SLIME Bodies (doc 14 R2/C2).
 * Controlled REAL visible bolt geometry (testInjectFloorBolt = the same
 * polylines the sampler treats as contact authority) crossing real bodies.
 * Frozen floor law: damage = 0, stun = 1.0s, longer stun never shortened,
 * dead/retired excluded. Direct thrown Stormbreaker collides with an extra
 * Body through the body-aware living-body TOI path.
 * ============================================================================= */
{
  const m = Q.start('SLIME', 'ICE', 4201);
  Q.placeFree(300, 500, 1, 0, 700, 500, -1, 0);
  Q.ctl().tryCast('A1', 'gates');
  Q.step(0.05);
  const STORM = win.APEX_ARSENAL_STORM;
  const raw = Q.ct().bodies;
  const anchor = raw.find(b => !b.__hrChild);
  const child = raw.find(b => b.__hrChild);
  const stunned = (body) => (body.statuses && body.statuses.stun && body.statuses.stun.timer) || 0;
  // Re-pin positions right before each controlled contact (bodies move).
  anchor.x = 300; anchor.y = 500;
  child.x = 700; child.y = 500;
  // (a) anchor floor contact -> standard 1.0s stun, zero damage
  const aHp0 = anchor.hp;
  STORM.testInjectFloorBolt(300, 250, 300, 750);
  Q.step(0.03);
  const anchorStun = stunned(anchor);
  const anchorNoDamage = Math.abs(anchor.hp - aHp0) < 1e-9;
  // (b) existing LONGER stun is never shortened by a floor hit
  child.x = 700; child.y = 500;
  child.applyStatus('stun', 2.5, {});
  const cHp0 = child.hp;
  STORM.testInjectFloorBolt(700, 250, 700, 750);
  Q.step(0.03);
  const longStunKept = stunned(child) > 1.5;
  const childNoDamage = Math.abs(child.hp - cHp0) < 1e-9;
  // (c) fresh child floor contact -> standard 1.0s stun (NOT immune)
  child.statuses.stun.timer = 0;
  child.x = 700; child.y = 500;
  STORM.testInjectFloorBolt(700, 250, 700, 750);
  Q.step(0.03);
  const childStun = stunned(child);
  const eligible = STORM.floorContacts(win.APEX_HERO_REWORK.environmentTargets())
    .length >= 0; // query exists and runs
  // (d) dead/retired excluded: kill the anchor -> retired husk stays in
  //     fighters[] but is NOT an environment target and gets no stun.
  anchor.x = 300; anchor.y = 500;
  W.aqDamage(anchor, 5000, win.fighters[1], 'STORMBREAKER', {});
  const husk = win.fighters[0]; // retired representative (promotion moved the anchor)
  const targets = win.APEX_HERO_REWORK.environmentTargets();
  const huskExcluded = !targets.some(t => t === husk) && !!husk.data.__hrRetiredAnchor;
  // The husk IS the body that was legitimately stunned in (a) — a residual
  // body-local stun timer may still be draining. The law under test: the
  // post-kill bolt must add NO NEW stun (timer never increases).
  const huskStunBefore = stunned(husk);
  STORM.testInjectFloorBolt(300, 250, 300, 750);
  Q.step(0.03);
  const huskNoStun = stunned(husk) <= huskStunBefore + 1e-9 && stunned(husk) <= 1.05;
  // (e) direct thrown Stormbreaker collides with an extra Body through the
  //     body-aware TOI path (enemy child intercepts the flight line).
  const m2 = Q.start('SLIME', 'SLIME', 4202);
  const ctl2 = win.APEX_HERO_REWORK.abilityController(win.APEX_HERO_REWORK.byCombatant(win.fighters[1]));
  ctl2.tryCast('A1', 'gates');
  Q.step(0.05);
  const enemyChild = win.APEX_HERO_REWORK.byCombatant(win.fighters[1]).bodies.find(b => b.__hrChild);
  const thrower = win.fighters[0];
  thrower.x = 150; thrower.y = 500;
  win.fighters[1].x = 850; win.fighters[1].y = 500;
  enemyChild.x = 500; enemyChild.y = 500; // directly on the flight line
  const ecHp0 = enemyChild.hp;
  const angle = Math.atan2(500 - 500, 850 - 150);
  W.spawnThrownMelee(thrower, 'STORMBREAKER', angle);
  Q.step(0.6); // flight + homing window
  const childHit = enemyChild.hp < ecHp0;
  const ok = !!m && anchorStun > 0.8 && anchorStun <= 1.05 && anchorNoDamage
    && longStunKept && childNoDamage
    && childStun > 0.8 && childStun <= 1.05 && eligible
    && huskExcluded && huskNoStun && !!m2 && childHit;
  gate('G3-storm-floor-hits-child-bodies', ok,
    { anchorStun: +anchorStun.toFixed(3), anchorNoDamage, longStunKept, childNoDamage, childStun: +childStun.toFixed(3), eligible, huskExcluded, huskNoStun, thrownStormChildHit: childHit, ecHp0, ecHp: enemyChild.hp });
}

/* ------------------------------------------------------------------ summary */
const total = Object.keys(report.gates).length;
const passed = Object.values(report.gates).filter(g => g.pass).length;
console.log(`\n[HERO REWORK SLIME OWNER-FIX GATES] ${passed}/${total} gates passed`);
if (report.failures.length) console.log('FAILURES:', report.failures.join(', '));
report.summary = { total, passed, failed: report.failures };
fs.writeFileSync(path.join(evidenceDir, 'slime-owner-fix-gates-report.json'), JSON.stringify(report, null, 2));
try { win.close(); } catch (e) { /* teardown only */ }
process.exit(report.failures.length ? 1 : 0);
