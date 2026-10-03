// HERO REWORK — headless smoke harness.
//
// Boots the REAL engine + runtimes in jsdom (same world as
// tools/testArsenalQuestHeadless.mjs) and runs the rework smoke sequence:
// boot, registry validation, NEWBIE->ROBOT migration, retired-NEWBIE shell,
// ladder preservation (doc-06), playable-pool cutover, 20s@60fps health,
// A1/A2 casts + cooldowns + fail-cues, J/K routing, no-transform parity,
// invariants, teardown.
//
// Usage: node tools/smokeHeroReworkHeadless.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BOOT_GAME_RUNTIMES, MODE_DEFERRED_RUNTIMES } from '../src/game/runtimeManifest.js';
import { PRODUCT_ROSTER, installProductSurfaceAuthority } from '../src/game/productSurface.js';

const REPO = process.cwd();
const TOOLING_DIR = process.env.AQ_TOOLING_DIR || path.join(REPO, 'node_modules');
const evidenceDir = process.env.AQ_EVIDENCE_DIR || 'docs/hero-rework/evidence';
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
win.__apexStatsSilent = true;

// Seed a LEGACY meta save BEFORE any runtime loads, so the NEWBIE->ROBOT
// migration gate exercises the real load()/sanitize() path.
win.localStorage.setItem('apexChaos.arsenalMeta.v1', JSON.stringify({
  version: 1, credits: 900, ownedFighters: ['NEWBIE', 'ICE'],
  lastSelectedP1: 'NEWBIE', lastSelectedP2: 'ICE', totalSpins: 2,
  unlockedAt: { NEWBIE: 123, ICE: 456 },
}));
// Clean and historic balances now pass through unchanged: no owner-test grant
// exists in the pre-pilot product graph.

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
// Active product core is independent from the retired ladder. Load the
// detached group explicitly afterward only because this regression preserves
// compatibility coverage for the historical 20-stage data.
for (const group of ['arsenalProduct', 'arsenalLegacyQuest']) {
  for (const [src] of MODE_DEFERRED_RUNTIMES[group]) {
    const key = String(src).split(/[?#]/, 1)[0];
    if (loadedRuntimeSrcs.has(key)) continue;
    loadedRuntimeSrcs.add(key);
    loadScript(src, true);
  }
}

fs.mkdirSync(evidenceDir, { recursive: true });
const report = { gates: {}, failures: [], loadErrors, evidence: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}
function snapshot(name) {
  const file = path.join(evidenceDir, `${name}.png`);
  fs.writeFileSync(file, gameCanvasReal.toBuffer('image/png'));
  report.evidence.push(file);
  return file;
}

// Test helpers (page context).
win.eval(`(() => {
  window.__HR_TEST = {
    start(p1, p2) { window.startArsenalQuestMode(p1, p2); cancelAnimationFrame(reqId); reqId = 0; return APEX_HERO_REWORK.match; },
    step(seconds, dt) { let t = seconds; dt = dt || 1/60; while (t > 1e-9) { const d = Math.min(dt, t); APEX_ARSENAL.step(d); t -= d; } },
    place(fx, fy, ex, ey) { const [a, b] = fighters; a.x = fx; a.y = fy; b.x = ex; b.y = ey; a.setDir(Math.sign(ex - fx) || 1, 0); b.setDir(-Math.sign(ex - fx) || -1, 0); a.baseSpeed = 0; b.baseSpeed = 0; },
    hp() { return { hero: fighters[0].hp, rival: fighters[1].hp }; },
    holdSpawns() { const s = APEX_ARSENAL.state; s.spawnTimer = 1e6; s.slots = []; s.unarmedFastConsumed = true; s.spawnHeld = true; },
    pushSlot(o) { const s = APEX_ARSENAL.state; const slot = Object.assign({ id: s.nextSlotId++, x: 500, y: 500, phase: 'REVEALED', weaponId: 'PISTOL', revealLeadSeconds: 1.5, revealedFor: 0, pickedBy: null, rejectedFor: {}, spawnTime: s.time, predictedHeroETA: null, predictedRivalETA: null, earliestETA: null, predictedFighter: null }, o); s.slots.push(slot); return slot.id; },
    events() { return APEX_ARSENAL.events.slice(); },
    clearEvents() { APEX_ARSENAL.events.length = 0; },
    countEvents(prefix, filter) { return APEX_ARSENAL.events.filter(e => e.startsWith('[ARSENAL] ' + prefix) && (!filter || e.includes(filter))).length; },
    hr() { return APEX_HERO_REWORK; },
    fighters: () => fighters,
    projectiles: () => projectiles,
    redraw() { draw(); },
  };
  return window.__HR_TEST;
})()`);
const T = win.__HR_TEST;
const HR = win.APEX_HERO_REWORK;

/* ------------------------------------------------------------------ *
 * Gate 1 — boot
 * ------------------------------------------------------------------ */
const hrFilesLoaded = ['apexHeroReworkAil', 'apexHeroReworkRegistry', 'apexHeroReworkMechanics', 'apexHeroReworkRuntime']
  .every((k) => win[k] === 'ready');
const hrLoadErrors = loadErrors.filter((e) => String(e.file).includes('hero-rework'));
gate('smoke-boot', hrFilesLoaded && hrLoadErrors.length === 0,
  hrFilesLoaded ? 'rework runtimes ready' : { hrLoadErrors: hrLoadErrors.slice(0, 3) });

/* Gate 2 — registry validation */
const v = HR.validateRegistry();
gate('smoke-registry', v.ok && v.heroCount === 12 && v.skillCount === 36, { errors: v.errors });

/* Gate 3 — NEWBIE -> ROBOT migration (idempotent, from the seeded legacy save) */
const metaApi = win.APEX_ARSENAL_META;
const migrated = metaApi ? metaApi.getState() : null;
const migrateOk = migrated
  && migrated.ownedFighters.includes('ROBOT') && !migrated.ownedFighters.includes('NEWBIE')
  && migrated.ownedFighters.includes('ICE')
  && migrated.credits === 900
  && migrated.lastSelectedP1 === 'ROBOT'
  && migrated.unlockedAt && migrated.unlockedAt.ROBOT === 123 && migrated.unlockedAt.NEWBIE === undefined;
const migratedAgain = metaApi ? metaApi.getState() : null;
const idempotent = JSON.stringify(migrated.ownedFighters) === JSON.stringify(migratedAgain.ownedFighters)
  && migratedAgain.lastSelectedP1 === 'ROBOT';
gate('smoke-migration-newbie-to-robot', !!migrateOk && !!idempotent,
  migrateOk ? 'NEWBIE→ROBOT idempotent' : migrated);

/* Gate 4 — retired NEWBIE has no legacy product shell */
const shells = win.APEX_ARSENAL_SHELLS;
const newbieType = shells.typeFor('NEWBIE');
const robotType = shells.typeFor('ROBOT');
gate('smoke-newbie-retired',
  !!newbieType && !!robotType
  && newbieType.__hrHero === 'ROBOT' && robotType.__hrHero === 'ROBOT'
  && newbieType.name === 'ROBOT' && newbieType.compatKit === 'REWORK'
  && !newbieType.arsenalOriginal,
  `typeFor('NEWBIE') -> ${newbieType && newbieType.name} (${newbieType && newbieType.compatKit})`);

/* Gate 5 — ladder preservation (doc-06: original boss identities intact) */
const STAGES = win.APEX_ARSENAL_QUEST && win.APEX_ARSENAL_QUEST.STAGES;
const ladderOk = Array.isArray(STAGES) && STAGES.length === 20
  && STAGES[0] && String(STAGES[0].opponent || STAGES[0].boss || STAGES[0]).toUpperCase().includes('PAINTER')
  && STAGES[19] && String(STAGES[19].opponent || STAGES[19].boss || STAGES[19]).toUpperCase().includes('MONK');
gate('smoke-ladder-20-bosses-preserved', ladderOk,
  Array.isArray(STAGES) ? STAGES.map((s) => s.opponent || s.boss || s).join(',') : 'no STAGES');

/* Gate 6 — pre-pilot visible-12 + selectable Core Six + boss-leak prevention */
const ids = shells.ids;
const poolOk = ids.length === 12 && PRODUCT_ROSTER.visibleIds.every((n, i) => ids[i] === n)
  && shells.roster().map((s) => s.name).join(',') === PRODUCT_ROSTER.playableIds.join(',');
const bossIds = ['PAINTER', 'DRUM', 'CARD', 'BLADE', 'TOXIC', 'ORBIT', 'FLASH', 'ELECTRIC', 'VAMPIRE', 'SAW', 'WOLF', 'WITCH', 'MONK'];
const noLeak = bossIds.every((b) => !ids.includes(b) && !shells.isPlayable(b));
const lockedNoPlay = PRODUCT_ROSTER.lockedIds.every((id) => ids.includes(id) && !shells.isPlayable(id));
const buyRejected = metaApi ? metaApi.buy('PAINTER').ok === false && metaApi.buy('BLACK_HOLE').ok === false : false;
gate('smoke-product-visible12-core6-no-boss-leak', poolOk && noLeak && lockedNoPlay && buyRejected,
  { ids, selectable: shells.roster().map((s) => s.name), buyRejected });

/* Gate 7 — 20s @ 60fps healthy match (ROBOT vs SNIPER, AI on) */
HR.setSeed(42);
HR.setAiEnabled(true);
let m = T.start('ROBOT', 'SNIPER');
const startOk = !!(m && m.combatants.length === 2 && !m.combatants[0].facade && !m.combatants[1].facade);
T.holdSpawns();
let runError = null;
try { T.step(20); } catch (e) { runError = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
const hpAfter = T.hp();
const healthy = startOk && !runError && hpAfter.hero > 0 && hpAfter.rival > 0;
gate('smoke-20s-60fps-healthy', healthy, { runError, hpAfter });
snapshot('smoke-20s-robot-vs-sniper');

/* Gate 7b — real Bot Battle profile uses existing P2 Hero Rework cast AI.
 * This is the product seam: no alternate combat loop, no simulated outcome. */
win.__apexArsenalBattleProfile = 'BOT';
HR.setSeed(31);
HR.setAiEnabled(true);
T.start('ROBOT', 'CRYSTAL');
T.holdSpawns();
const botMode = win.getArsenalBattleDebugState()?.battleMode;
const botAiBefore = HR.AIL.bus.ring.length;
T.step(2.2);
const botEvents = HR.AIL.bus.ring.slice(botAiBefore)
  .filter((event) => event.payload?.source === 'p2-ai');
const botCasts = botEvents.filter((event) => event.type === 'Cast');
gate('smoke-bot-profile-real-p2-ai', botMode === 'BOT' && HR.match?.aiEnabled === true && botCasts.length > 0,
  { botMode, aiEnabled: HR.match?.aiEnabled, events: botEvents.map((event) => ({ type: event.type, payload: event.payload })) });
win.__apexArsenalBattleProfile = 'LOCAL';

/* Gate 8 — invariants during the run */
const inv = HR.invariants();
gate('smoke-invariants', inv.ok, inv.errors);

/* Gate 9 — A2 cast + cooldown */
m = HR.match;
const ct = m.combatants[0];
const ctl = HR.abilityController(ct);
const castRes = ctl.tryCast('A2', 'test');
const cdAfter = ctl.cooldownLeft('A2');
gate('smoke-a2-cast-cooldown', castRes.ok && cdAfter > 9 && cdAfter <= 10, { castRes, cdAfter });

/* Gate 10 — A1 fail-cue (no pickup) does NOT consume cooldown */
T.holdSpawns();
const cdBefore = ctl.cooldownLeft('A1');
const failRes = ctl.tryCast('A1', 'test');
const cdAfterFail = ctl.cooldownLeft('A1');
gate('smoke-a1-fail-cue-no-cd', (!failRes.ok && !!failRes.failCue && cdAfterFail === cdBefore) || (failRes.ok === true && ctl.cooldownLeft('A1') > 0),
  { failRes, cdBefore, cdAfterFail });

/* Gate 11 — dash toward a revealed pickup (physical ROBOT A1) */
if (ctl.cooldownLeft('A1') > 0) { T.step(ctl.cooldownLeft('A1') + 0.1); }
T.pushSlot({ x: 800, y: 500, weaponId: 'PISTOL' });
const heroBefore = T.fighters()[0];
const posBefore = { x: heroBefore.x, y: heroBefore.y };
const dashRes = ctl.tryCast('A1', 'test');
// Robot A1 owns a .26s recognize/commit windup before physical launch.
// Step beyond that frozen edge so this gate observes real dash movement.
T.step(0.5);
const posAfter = { x: T.fighters()[0].x, y: T.fighters()[0].y };
const moved = Math.hypot(posAfter.x - posBefore.x, posAfter.y - posBefore.y);
gate('smoke-robot-dash-moves-to-pickup', dashRes.ok && moved > 60, { dashRes, moved: Math.round(moved) });

/* Gate 12 — J/K routing through the legacy gate bridge */
T.clearEvents();
const gateBridge = win.APEX_ARSENAL_SKILL_GATE;
T.step(11); // cooldowns settle
T.pushSlot({ x: 800, y: 500, weaponId: 'PISTOL' }); // make A1 castable
const busBefore = HR.AIL.bus.ring.length;
const jRes = gateBridge.pressJ(T.fighters()[0]);
T.step(0.1);
// Rework Cast/CastFailCue events live on the AIL bus (not the AQ log ring).
const busCasts = HR.AIL.bus.ring.slice(busBefore).filter((e) => e.type === 'Cast' || e.type === 'CastFailCue' || e.type === 'P1Press');
gate('smoke-j-a1-routing', jRes === true && busCasts.length >= 2, { jRes, busCasts: busCasts.map((e) => e.type) });

/* Gate 12b — LOCOMOTION LAW with REAL moving fighters (owner-failure root
 * cause S1/S2 + test-mask S6): no baseSpeed=0, no __hrHoldBody, no disabled
 * behavior. An unarmed rework Hero must NOT turn toward an off-heading
 * pickup; an armed one must NOT chase/kite an off-heading opponent. */
{
  T.start('ICE', 'ICE');
  T.holdSpawns();
  const [a, b] = T.fighters();
  a.x = 350; a.y = 800; a.setDir(1, 0);
  b.x = 200; b.y = 150; b.setDir(-1, 0);
  T.pushSlot({ x: 350, y: 450, weaponId: 'PISTOL' }); // due NORTH of P1
  const s0 = { x: a.x, y: a.y };
  T.step(0.6);
  const noSeek = a.dir.x > 0.9 && Math.abs(a.dir.y) < 0.1 && (a.x - s0.x) > 250 && (s0.y - a.y) < 100;
  gate('smoke-locomotion-no-pickup-seek', noSeek && a.baseSpeed > 0 && !a.data.__hrHoldBody,
    { dir: [a.dir.x, a.dir.y], dx: +(a.x - s0.x).toFixed(1), north: +(s0.y - a.y).toFixed(1), speed: a.baseSpeed });
  // Armed no-chase: opponent far south off-heading; real equip; 0.5s window.
  T.start('ICE', 'ICE');
  T.holdSpawns();
  const [c, d] = T.fighters();
  c.x = 300; c.y = 300; c.setDir(1, 0);
  d.x = 300; d.y = 850; d.setDir(-1, 0);
  win.APEX_ARSENAL.weaponApi.equip(c, 'PISTOL');
  const c0 = { x: c.x, y: c.y };
  T.step(0.5);
  const dist = Math.hypot(c.x - d.x, c.y - d.y);
  const noChase = c.dir.x > 0.9 && Math.abs(c.dir.y) < 0.1 && (c.x - c0.x) > 200 && dist > 380;
  gate('smoke-locomotion-no-chase', noChase && c.baseSpeed > 0 && !c.data.__hrHoldBody,
    { dir: [c.dir.x, c.dir.y], dx: +(c.x - c0.x).toFixed(1), dist: +dist.toFixed(1) });
}

/* Gate 13 — teardown */
win.exitArsenalQuestMode();
const tornDown = HR.match == null;
gate('smoke-teardown', tornDown, { active: !tornDown });

/* Gate 14 — parity: no-transform bullet pass is byte-identical (base vs rework) */
function parityScenario(forceBase) {
  HR._forceBasePass = forceBase;
  HR.setSeed(77);
  const mm = T.start('ROBOT', 'ROBOT'); // both rework, no actives cast
  T.holdSpawns();
  T.place(300, 500, 700, 500);
  const W = win.APEX_ARSENAL.weaponApi;
  W.equip(T.fighters()[0], 'PISTOL');
  T.clearEvents();
  // Deterministic spread: stub Math.random identically for both runs.
  let seedState = 12345;
  const realRandom = win.Math.random;
  win.Math.random = () => { seedState = (seedState * 1103515245 + 12345) & 0x7fffffff; return seedState / 0x7fffffff; };
  try { T.step(1.5); } finally { win.Math.random = realRandom; }
  const events = T.events().filter((e) => e.startsWith('[ARSENAL] '));
  const out = {
    hp: T.hp(),
    hits: events.filter((e) => e.includes('HIT')).map((e) => e.replace(/x=\d+ y=\d+/, '')),
    uses: events.filter((e) => e.includes('USE')).length,
    projectiles: T.projectiles().filter((p) => p.aq).length,
  };
  win.exitArsenalQuestMode();
  HR._forceBasePass = false;
  return out;
}
const baseRun = parityScenario(true);
const reworkRun = parityScenario(false);
const parityOk = JSON.stringify(baseRun) === JSON.stringify(reworkRun);
gate('smoke-parity-no-transform', parityOk, { baseRun, reworkRun });

/* Gate 15 — debugState shape */
const dbg = HR.debugState();
gate('smoke-debug-state', dbg && dbg.active === false || (dbg && dbg.active === true && Array.isArray(dbg.combatants)),
  dbg && dbg.active ? 'match debug OK' : 'no-match debug OK');

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */
const total = Object.keys(report.gates).length;
const passed = Object.values(report.gates).filter((g) => g.pass).length;
console.log(`\n[HERO REWORK SMOKE] ${passed}/${total} gates passed`);
if (report.failures.length) {
  console.log('FAILURES:', report.failures.join(', '));
  process.exitCode = 1;
}
fs.writeFileSync(path.join(evidenceDir, 'smoke-hero-rework-report.json'), JSON.stringify(report, null, 2));
// PASS B harness lifecycle (same law as the headless suite): the production
// HUD owns window timers, and JSDOM keeps Node alive while they exist —
// close the test window after the report is fully written, then exit
// explicitly so a successful run cannot linger.
try { win.close(); } catch (error) { /* teardown only */ }
process.exit(report.failures.length ? 1 : 0);
