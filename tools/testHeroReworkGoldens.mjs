#!/usr/bin/env node
/* =============================================================================
 * APEX CHAOS — Hero Rework CP-HR5 goldens harness (headless).
 *
 * Cross-hero golden scenarios + structural invariants + seeded deterministic
 * fuzz, per docs/hero-rework/phase1/05_IMPLEMENTATION_TASK_FINAL.md §CP-HR5.
 *
 * Goldens (deterministic, rework cast/movement AI OFF):
 *   G1 CRYSTAL reflect x ICE payload (chill survives reflection)
 *   G2 MIRROR neutral portal x ICE (neutral exit, no hero credit, chill lands)
 *   G3 BLACK_HOLE stores a REFLECTED projectile (chain reflect -> store)
 *   G4 RUBBER stores a REFLECTED projectile (compression window)
 *   G5 TIME replay x MIRROR portal (replay exits neutral, no re-record)
 *   G6 MATH geometry x HUNTER trap (graph absorbs; snare roots in place)
 *   G7 SLIME bodies x SNIPER targeting (bodies targetable, death != Combatant)
 *   G8 T6 x every manipulator (no hero manipulation of the T6, ever)
 * Invariants: HP conservation, no equip dup, damage realizes once, clean
 * teardown, no native double-kit, HR.invariants() clean.
 * Fuzz: 14 seeded runs, random pairs x weapons x casts, invariant sampling.
 *
 * Evidence: docs/hero-rework/evidence/hero-rework-goldens-report.json + PNGs.
 * Exit 1 on any gate failure. NOTE: the AIL event ring is capped (160) and
 * trimmed from the front — length-based marks freeze once full, so all
 * bus marks use event seq.
 * ============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BOOT_GAME_RUNTIMES, MODE_DEFERRED_RUNTIMES } from './legacyRuntimeManifest.mjs';
import { installProductSurfaceAuthority } from '../src/game/productSurface.js';

const REPO = process.cwd();
const TOOLING_DIR = process.env.AQ_TOOLING_DIR || path.join(REPO, 'node_modules');
const requireTool = createRequire(path.join(TOOLING_DIR, 'noop.js'));
const { JSDOM } = requireTool('jsdom');
const { createCanvas, loadImage, GlobalFonts, ImageData: NapiImageData, Path2D: NapiPath2D } = requireTool('@napi-rs/canvas');
GlobalFonts.registerFromPath(path.join(REPO, 'public', 'assets', 'fonts', 'kanit', 'Kanit-BlackItalic.ttf'), 'ApcKanit');

const evidenceDir = process.env.AQ_EVIDENCE_DIR || path.join(REPO, 'docs', 'hero-rework', 'evidence');
const loadErrors = [];

// Mirrors the production shell (suite harness boot): PASS B side panels
// carry the engine-owned p1/p2 identity + HP ids; #hud keeps mode overlays.
const dom = new JSDOM(`<!doctype html><html><body>
  <div id="battle-shell">
    <aside id="p1-combat-panel" class="combat-panel">
      <div class="cp-identity">
        <span id="p1-cp-chip"></span>
        <div id="p1-name">P1</div>
        <div class="hp-bar-bg"><div id="p1-hp-loss"></div><div id="p1-hp"></div><div id="p1-hp-text"></div></div>
        <div id="p1-rage"></div>
      </div>
      <div id="p1-burst"><div id="p1-burst-label"></div><div id="p1-burst-total">0</div><span id="p1-burst-hits">0 HITS</span><span id="p1-burst-crits">0 CRIT</span></div>
      <div id="p1-loadout"><canvas id="p1-loadout-canvas" width="480" height="240"></canvas><div id="p1-loadout-fallback"><span id="p1-cp-glyph"></span><span id="p1-loadout-fallback-label">UNARMED</span></div><div id="p1-loadout-name">—</div><span id="p1-loadout-family"></span><span id="p1-loadout-tier"></span></div>
      <div id="p1-energy"><span id="p1-energy-val">0</span><div id="p1-energy-fill"></div><div id="p1-energy-state"></div></div>
      <div id="p1-mode-slot"></div>
    </aside>
  <div id="game-wrapper">
    <canvas id="game-canvas" width="1000" height="1000"></canvas>
    <div id="countdown-overlay" style="display:none"><div id="countdown-num">3</div><div id="countdown-sub"></div></div>
    <div class="ui-layer" id="hud">
      <div id="manual-lab-hud" class="hidden"></div>
    </div>
    <div id="battle-controls" class="hidden"></div>
    <div id="menu-screen" class="screen"></div>
    <div id="select-screen" class="screen hidden"><div id="select-title"></div><button id="start-btn" class="hidden"></button><div id="apex-pick-runtime-root"></div></div>
    <div id="manual-room-screen" class="screen hidden"></div>
    <div id="tournament-screen" class="screen hidden"></div>
    <div id="end-screen" class="screen hidden"><div id="winner-text"></div><div id="stats-panel"></div><button id="tournament-return-btn" class="hidden"></button><button id="challenge-retry-btn" class="hidden"></button></div>
    <div id="solo-screen" class="screen hidden"><div id="solo-hud"></div></div>
    <div id="trial-screen" class="screen hidden"></div>
    <div id="tam-chien-screen" class="screen hidden"></div>
    <div id="roster-grid"></div>
  </div>
    <aside id="p2-combat-panel" class="combat-panel">
      <div class="cp-identity">
        <span id="p2-cp-chip"></span>
        <div id="p2-name">P2</div>
        <div class="hp-bar-bg"><div id="p2-hp-loss"></div><div id="p2-hp"></div><div id="p2-hp-text"></div></div>
        <div id="p2-rage"></div>
      </div>
      <div id="p2-burst"><div id="p2-burst-label"></div><div id="p2-burst-total">0</div><span id="p2-burst-hits">0 HITS</span><span id="p2-burst-crits">0 CRIT</span></div>
      <div id="p2-loadout"><canvas id="p2-loadout-canvas" width="480" height="240"></canvas><div id="p2-loadout-fallback"><span id="p2-cp-glyph"></span><span id="p2-loadout-fallback-label">UNARMED</span></div><div id="p2-loadout-name">—</div><span id="p2-loadout-family"></span><span id="p2-loadout-tier"></span></div>
      <div id="p2-energy"><span id="p2-energy-val">0</span><div id="p2-energy-fill"></div><div id="p2-energy-state"></div></div>
      <div id="p2-mode-slot"></div>
    </aside>
  </div>
</body></html>`, { pretendToBeVisual: true, runScripts: 'dangerously', url: 'http://localhost/' });

const win = dom.window;
installProductSurfaceAuthority(win);
win.__APEX_TEST_MODE = true;
win.__apexStatsSilent = true; // silence synthesized battle SFX in the harness
win.localStorage.setItem('apexChaos.arsenalMeta.v1', JSON.stringify({ version: 1, credits: 350, ownedFighters: ['ROBOT'], lastSelectedP1: 'ROBOT', lastSelectedP2: 'SNIPER', totalSpins: 0, unlockedAt: { ROBOT: 1 } }));

// Real canvas backing for every jsdom <canvas>. @napi-rs/canvas drawImage only
// accepts its own Canvas objects, so translate jsdom elements to their backing
// canvas in a proxy around the 2D context.
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
      // @napi-rs/canvas accessors require the native context itself as receiver;
      // using the Proxy as receiver causes "Failed to unwrap exclusive reference".
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
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target);
    },
  });
};
const gameCanvasEl = win.document.getElementById('game-canvas');
const gameCanvasReal = gameCanvasEl.getContext('2d').canvas;

// Minimal WebAudio stub (SFX code paths are silenced by __apexStatsSilent).
class ParamStub {
  constructor() { this.value = 0; }
  setValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
  cancelScheduledValues() { return this; }
}
class AudioNodeStub {
  constructor() {
    this.gain = new ParamStub(); this.frequency = new ParamStub();
    this.Q = new ParamStub(); this.detune = new ParamStub(); this.pan = new ParamStub();
    this.buffer = null; this.loop = false; this.type = 'sine';
  }
  connect() { return this; }
  disconnect() {}
  start() {}
  stop() {}
}
class AudioContextStub {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000; this.destination = new AudioNodeStub(); }
  decodeAudioData(buf) {
    // Fake decoded buffer; duration derived from byte length (16-bit mono).
    const seconds = Math.max(0.05, (buf && buf.byteLength ? buf.byteLength / 2 / 48000 : 0.5));
    return Promise.resolve({ duration: seconds, sampleRate: 48000, length: Math.floor(seconds * 48000) });
  }
  createGain() { return new AudioNodeStub(); }
  createOscillator() { return new AudioNodeStub(); }
  createBufferSource() { return new AudioNodeStub(); }
  createBiquadFilter() { return new AudioNodeStub(); }
  createStereoPanner() { return new AudioNodeStub(); }
  createDynamicsCompressor() { return new AudioNodeStub(); }
  createMediaElementSource() { return new AudioNodeStub(); }
  createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, getChannelData: () => new Float32Array(len) }; }
  resume() { return Promise.resolve(); }
}
win.AudioContext = AudioContextStub;
win.webkitAudioContext = AudioContextStub;

// jsdom has no fetch; UI runtimes (pick layout JSON) park on a pending promise.
// AV presentation audio fetches ARE served from the repo so preload/decode and
// the bounded-voice playback path run for real (sound itself stays stubbed).
win.fetch = (url) => {
  const u = String(url);
  if (u.includes('/assets/arsenal/av/')) {
    const rel = u.slice(u.indexOf('/assets/') + 1);
    try {
      const data = fs.readFileSync(path.join(REPO, 'public', rel));
      const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(copy) });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return new Promise(() => {});
};

// jsdom Image cannot decode PNGs; back every Image with a real @napi-rs image
// loaded from public/ so curated VFX actually render into evidence frames.
class HarnessImage {
  constructor() { this.complete = false; this.width = 0; this.height = 0; this.__realImage = null; this.onload = null; this.onerror = null; }
  set src(v) {
    this._src = v;
    const rel = String(v).replace(/^\//, '');
    loadImage(path.join(REPO, 'public', rel))
      .then((im) => {
        this.__realImage = im;
        this.width = im.width;
        this.height = im.height;
        this.naturalWidth = im.width;
        this.naturalHeight = im.height;
        this.complete = true;
        if (this.onload) this.onload();
      })
      .catch(() => { if (this.onerror) this.onerror(); });
  }
  get src() { return this._src; }
}
win.Image = HarnessImage;
// Generic jsdom compatibility (test harness only): jsdom has no ImageData/Path2D, which the Hunter V10 art
// derivation needs. Without this the Hunter asset path throws and Hunter never becomes ready (known baseline
// harness condition, GitHub Actions run 36614313983) — it is NOT a gameplay change.
if (!win.ImageData) win.ImageData = NapiImageData;
if (!win.Path2D) win.Path2D = NapiPath2D;

// Harness owns time: no automatic frames; tests step deterministically.
win.requestAnimationFrame = () => 0;
win.cancelAnimationFrame = () => {};
function loadScript(relPath, required) {
  const file = path.join(REPO, 'public', String(relPath).split(/[?#]/, 1)[0].replace(/^\//, ''));
  try { win.eval(fs.readFileSync(file, 'utf8')); return true; } catch (error) {
    if (required) throw error;
    loadErrors.push({ file: relPath, error: String(error && error.message) });
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

fs.mkdirSync(evidenceDir, { recursive: true });
const report = { gates: {}, failures: [], loadErrors, telemetry: {}, fuzz: {} };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}
function snapshot(name) {
  const file = path.join(evidenceDir, `${name}.png`);
  fs.writeFileSync(file, gameCanvasReal.toBuffer('image/png'));
  report.evidence = report.evidence || [];
  report.evidence.push(file);
  return file;
}

// Test helpers (page context).
win.eval(`(() => {
  window.__GOLD_TEST = {
    start(p1, p2) { window.startArsenalBattleMode(p1, p2, { testFixture: true }); cancelAnimationFrame(reqId); reqId = 0; return APEX_HERO_REWORK.match; },
    step(seconds, dt) { let t = seconds; dt = dt || 1/60; while (t > 1e-9) { const d = Math.min(dt, t); APEX_ARSENAL.step(d); t -= d; } },
    place(fx, fy, ex, ey) { const [a, b] = fighters; a.x = fx; a.y = fy; b.x = ex; b.y = ey; a.setDir(Math.sign(ex - fx) || 1, 0); b.setDir(-Math.sign(ex - fx) || -1, 0); a.baseSpeed = 0; b.baseSpeed = 0; if (a.data) a.data.__hrHoldBody = true; if (b.data) b.data.__hrHoldBody = true; },
    unhold() { fighters.forEach(f => { if (f && f.data) f.data.__hrHoldBody = false; }); },
    holdSpawns() { const s = APEX_ARSENAL.state; s.spawnTimer = 1e6; s.slots = []; s.unarmedFastConsumed = true; s.spawnHeld = true; },
    equip(i, wid) { return APEX_ARSENAL.weaponApi.equip(fighters[i], wid); },
    bullets() { return projectiles.filter(p => p && p.aq && p.type === 'aq_bullet'); },
    busCount(type, filterFn) { return APEX_HERO_REWORK.AIL.bus.ring.filter(e => e.type === type && (!filterFn || filterFn(e.payload))).length; },
    // NOTE: the ring is capped (160) and trimmed from the front, so a
    // length-based mark freezes once full — marks must use event seq.
    busMark() { const r = APEX_HERO_REWORK.AIL.bus.ring; return r.length ? r[r.length - 1].seq : 0; },
    busSince(mark, type) { return APEX_HERO_REWORK.AIL.bus.ring.filter(e => e.seq > mark && e.type === type).length; },
    hr() { return APEX_HERO_REWORK; },
    ct(i) { return APEX_HERO_REWORK.byCombatant(fighters[i]); },
    ctl(i) { return APEX_HERO_REWORK.abilityController(APEX_HERO_REWORK.byCombatant(fighters[i])); },
  };
  return window.__GOLD_TEST;
})()`);
const T = win.__GOLD_TEST;
const HR = win.APEX_HERO_REWORK;

/* ================================================================== *
 * G0 — boot
 * ================================================================== */
const hrFilesLoaded = ['apexHeroReworkAil', 'apexHeroReworkRegistry', 'apexHeroReworkMechanics', 'apexHeroReworkRuntime']
  .every((k) => win[k] === 'ready');
const hrLoadErrors = loadErrors.filter((e) => String(e.file).includes('hero-rework'));
gate('goldens-boot', hrFilesLoaded && hrLoadErrors.length === 0,
  hrFilesLoaded ? 'rework runtimes ready' : { hrLoadErrors: hrLoadErrors.slice(0, 3) });

const W = () => HR.match ? HR.match.world : null;

/* ================================================================== *
 * G1 — CRYSTAL reflection x ICE payload (chill survives reflection)
 * ================================================================== */
// CRYSTALA V1: the old always-on body reflect is gone. A Crystal reflects through its REAL construct (the J Wall)
// or a K shard, so the reflect goldens now build a real Wall first: K, then a sacrificial 0-damage hostile decoy keeps
// one shard busy so J (2..5 shards) builds a WALL, then wait for the material to lock.
function crystalWall(ci) {
  const cb = win.fighters[ci], eb = win.fighters[1 - ci], ctl = T.ctl(ci);
  const k = ctl.tryCast('A2', 'goldens');
  win.APEX_ARSENAL.weaponApi.fireBullet({ owner: eb, x: cb.x, y: 985, angle: -Math.PI / 2, speed: 900, damage: 0, weapon: 'PISTOL', radius: 7, life: 2 });
  for (let f = 0; f < 120; f++) { T.step(1 / 60); if (win.APEX_CRYSTAL.inspect(T.ct(ci)).jobs.length) break; }
  const j = ctl.tryCast('A1', 'goldens');
  for (let f = 0; f < 70; f++) T.step(1 / 60);   // the material locks (~0.8 s)
  const cons = win.APEX_CRYSTAL.inspect(T.ct(ci)).constructs.find((c) => c.kind === 'wall');
  return { k: k.ok, j: j.ok, wall: !!cons && cons.solid };
}
try {
  HR.setSeed(101);
  HR.setAiEnabled(false);
  T.start('ICE', 'CRYSTAL');
  T.holdSpawns();
  // ~280px: bodies (r=75) must not touch (the muzzle would spawn inside
  // CRYSTAL's circle). The muzzle art anchor sits ~24px off the aim line,
  // so every auto-fired shot grazes the circle and reflects ~34 degrees
  // off the reverse path — the return can never reach a shooter at legal
  // separation (0.56*D drift vs the 81.5px hit circle). The golden instead
  // INTERCEPTS deterministically: the moment the reflected projectile
  // appears, the shooter is moved onto its measured path via the production
  // relocate API (the same call SNIPER farthest-corner makes).
  T.place(350, 500, 630, 500);
  const wallA = crystalWall(1);
  const ice = T.ctl(0);
  const a1 = ice.tryCast('A1', 'goldens'); // Ice Bullets: own shots apply CHILL
  T.equip(0, 'MAGNUM_500'); // range 1276px — survives the full round trip
  const mark = T.busMark();
  let reflectSeen = false, chilledIce = false, creditedCrystal = false, runError = null;
  let payloadKept = false, controllerFlipped = false, intercepted = false;
  const traj = [];
  win.APEX_ARSENAL.events.length = 0;
  const crystalBody = win.fighters[1];
  const api = HR.match.api;
  try {
    for (let f = 0; f < 420 && !(reflectSeen && chilledIce && creditedCrystal); f++) {
      T.step(1 / 60);
      reflectSeen = reflectSeen || T.busSince(mark, 'CrystalReflect') > 0;
      if (reflectSeen && !intercepted) {
        const p = win.projectiles.find(q => q && q.aq && q.owner === crystalBody);
        if (p) {
          payloadKept = !!(p.__hr && p.__hr.chill); // ICE payload survives reflection
          controllerFlipped = true; // reflect rewrote the controller to CRYSTAL
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const tx = p.x + (p.vx / sp) * 110, ty = p.y + (p.vy / sp) * 110;
          api.relocate(win.fighters[0], tx, ty, 'goldens.reflect-intercept');
          intercepted = true;
        }
      }
      if (intercepted && traj.length < 8) {
        const p = win.projectiles.find(q => q && q.aq && q.owner === crystalBody);
        if (p) traj.push({ f, x: +p.x.toFixed(0), y: +p.y.toFixed(0), life: +p.life.toFixed(2), chill: !!(p.__hr && p.__hr.chill) });
      }
      const c2 = HR.byCombatant(win.fighters[1]);
      creditedCrystal = c2 && c2.telemetry && c2.telemetry.damageDealt > 0;
      const c1 = HR.byCombatant(win.fighters[0]);
      chilledIce = !!(c1 && HR.AIL.StatusResolver.has(win.fighters[0], 'CHILL'));
    }
  } catch (e) { runError = String(e && e.message); }
  const hitLines = win.APEX_ARSENAL.events.filter(e => e.includes('HIT')).slice(0, 6);
  // Laws: reflect fires; the payload + controller flip survive in flight;
  // and when the reflected projectile connects, CHILL lands on the victim
  // and the damage credits CRYSTAL (the reflecting combatant).
  gate('golden-crystal-reflect-ice-payload',
    wallA.wall && a1 && a1.ok && reflectSeen && payloadKept && controllerFlipped
    && chilledIce && creditedCrystal && !runError,
    { wall: wallA, a1: a1 && a1.ok, reflectSeen, payloadKept, controllerFlipped, intercepted,
      chilledIce, creditedCrystal, traj, hitLines, runError });
  snapshot('golden-crystal-reflect-ice-payload');
} catch (e) { gate('golden-crystal-reflect-ice-payload', false, String(e && e.message)); }

/* ================================================================== *
 * G2 — MIRROR neutral portal x ICE (neutral exit, no hero credit)
 * ================================================================== */
try {
  HR.setSeed(102);
  HR.setAiEnabled(false);
  T.start('ICE', 'MIRROR');
  T.holdSpawns();
  T.place(150, 500, 850, 500);
  const mirrorCt = T.ct(1);
  // F2 migration: two ACTIVE same-owner F1 mirror nodes via the
  // NON-SHIPPING test seam (real node shape + lifecycle) at the historical
  // portal positions. The legacy circular router was retired at F2; the
  // golden's law (neutral exit, no hero credit) rides the real F2
  // surface/escrow authority.
  const api = HR.match.api;
  api.mirrorTestNode(mirrorCt, 350, 500, 0);
  api.mirrorTestNode(mirrorCt, 650, 500, 0);
  T.step(0.1);
  const mirrors = ((mirrorCt.store['mirror.passive'] || {}).nodes || []).filter(n => n.st === 2).length;
  // FROST V1 migration: ICE A1 is frost.breath (cone blast), not the legacy
  // ice.bullets chill-payload buff (authority §0/§8 supersession) — no chill
  // leg exists anymore. This golden's purpose is route neutrality, kept intact.
  T.equip(0, 'GLOCK_17');
  const mark = T.busMark();
  let routed = false, neutralSeen = false, mirrorCredit = 0, runError = null;
  const mirCt2 = T.ct(1);
  try {
    for (let f = 0; f < 420; f++) {
      T.step(1 / 60);
      if (!routed && T.busSince(mark, 'MirrorRouteCapture') > 0
          && T.busSince(mark, 'MirrorRouteEmerge') > 0) routed = true;
      if (win.projectiles.some(p => p && p.aq && p.__hr && p.__hr.neutral)) neutralSeen = true;
      mirrorCredit = Math.max(mirrorCredit, mirCt2.telemetry.damageDealt);
      if (routed && neutralSeen) break;
    }
  } catch (e) { runError = String(e && e.message); }
  // Neutral exit: damage unchanged, may hit either side, NO Hero credit —
  // MIRROR (unarmed, no reflect passive) must never gain damageDealt.
  const neutralHitNoCredit = mirrorCredit === 0;
  gate('golden-mirror-portal-neutral-no-credit',
    mirrors >= 2 && routed && neutralSeen && neutralHitNoCredit === true && !runError,
    { mirrors, routed, neutralSeen, neutralHitNoCredit, runError });
  snapshot('golden-mirror-portal-neutral');
} catch (e) { gate('golden-mirror-portal-neutral-no-credit', false, String(e && e.message)); }

/* ================================================================== *
 * G3 — BLACK_HOLE storing a REFLECTED projectile (chain reflect->store)
 * ================================================================== */
try {
  HR.setSeed(103);
  HR.setAiEnabled(false);
  T.start('BLACK_HOLE', 'CRYSTAL');
  T.holdSpawns();
  T.place(200, 500, 780, 500);
  const wallG3 = crystalWall(1);
  // P1 fires at CRYSTAL; the reflection returns on a measured path (the
  // muzzle art anchor grazes the circle, so the return is ~34 degrees off
  // the reverse line). The A1 singularity spawns at the ANCHOR MIDPOINT,
  // so the moment the reflected projectile appears, CRYSTAL is relocated
  // (production API) such that the midpoint lands ON the measured return
  // path ahead of the bullet — the REFLECTED projectile is what gets stored
  // (the release guard would block re-storing a released projectile).
  const bh = T.ctl(0);
  T.equip(0, 'MAGNUM_500'); // range 1276px — survives the full round trip
  const crystalBody = win.fighters[1];
  const bhBody = win.fighters[0];
  const mark = T.busMark();
  let sing = { ok: false }, storedReflected = false, released = false, releases0 = -1, storeFrame = -1, runError = null;
  try {
    for (let f = 0; f < 600; f++) {
      T.step(1 / 60);
      if (!sing.ok && T.busSince(mark, 'CrystalReflect') > 0) {
        const p = win.projectiles.find(q => q && q.aq && q.owner === crystalBody);
        if (p) {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const mx = p.x + (p.vx / sp) * 80, my = p.y + (p.vy / sp) * 80;
          // Singularity spawns at the anchor midpoint: place CRYSTAL so the
          // midpoint equals the intercept point on the return path.
          HR.match.api.relocate(crystalBody, 2 * mx - bhBody.x, 2 * my - bhBody.y, 'goldens.singularity-intercept');
          sing = bh.tryCast('A1', 'goldens');
        }
      }
      // A REFLECTED projectile stored: the stored entry's controller is the
      // CRYSTAL body (reflect rewrites p.owner to the reflecting body).
      if (!storedReflected) {
        const sings = W().singularities || [];
        storedReflected = sings.some(sg => sg.stored.some(d => d.owner === crystalBody));
      }
      if (releases0 < 0 && storedReflected) { releases0 = T.busSince(mark, 'SingularityRelease'); storeFrame = f; }
      if (storedReflected && releases0 >= 0 && T.busSince(mark, 'SingularityRelease') > releases0) released = true;
      if (released) break;
    }
  } catch (e) { runError = String(e && e.message); }
  const singCount = (W() && W().singularities || []).length;
  const schedPending = HR.AIL.hrScheduler.pending();
  const releaseCount = T.busSince(mark, 'SingularityRelease');
  const storedCount = T.busSince(mark, 'SingularityStored');
  gate('golden-blackhole-stores-reflected',
    wallG3.wall && sing && sing.ok && storedReflected && released && !runError,
    { wall: wallG3, sing: sing && sing.ok, storedReflected, released, storeFrame, releaseCount, storedCount, schedPending, singCount, runError });
  snapshot('golden-blackhole-stores-reflected');
} catch (e) { gate('golden-blackhole-stores-reflected', false, String(e && e.message)); }

/* ================================================================== *
 * G4 — RUBBER storing a REFLECTED projectile
 * ================================================================== */
try {
  HR.setSeed(104);
  HR.setAiEnabled(false);
  T.start('RUBBER', 'CRYSTAL');
  T.holdSpawns();
  // ~280px separation (bodies must not touch). The muzzle art anchor
  // grazes CRYSTAL's circle (~24px off-line), so the reflected return
  // misses any static shooter at legal range — the golden INTERCEPTS:
  // the moment the reflected projectile appears, RUBBER is relocated onto
  // its measured path via the production relocate API, and the compression
  // window (2.5s) must STORE the returning projectile.
  T.place(350, 500, 630, 500);
  const wallG4 = crystalWall(1);
  const rub = T.ctl(0);
  const a2 = rub.tryCast('A2', 'goldens'); // compression store window (2.5s)
  T.equip(0, 'MAGNUM_500'); // range 1276px — survives the full round trip
  const mark = T.busMark();
  let storedReflected = false, held = 0, intercepted = false, runError = null;
  const crystalBody = win.fighters[1];
  const api = HR.match.api;
  const traj = [];
  win.APEX_ARSENAL.events.length = 0;
  try {
    for (let f = 0; f < 420; f++) {
      T.step(1 / 60);
      if (!intercepted && T.busSince(mark, 'CrystalReflect') > 0) {
        const p = win.projectiles.find(q => q && q.aq && q.owner === crystalBody);
        if (p) {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          api.relocate(win.fighters[0], p.x + (p.vx / sp) * 110, p.y + (p.vy / sp) * 110, 'goldens.rubber-intercept');
          intercepted = true;
        }
      }
      if (intercepted && traj.length < 8) {
        const p = win.projectiles.find(q => q && q.aq && q.owner === crystalBody);
        if (p) traj.push({ f, x: +p.x.toFixed(0), y: +p.y.toFixed(0), life: +p.life.toFixed(2) });
      }
      // RubberStored can only fire for a RETURNING (reflected) bullet —
      // outgoing shots reach CRYSTAL first.
      if (T.busSince(mark, 'CrystalReflect') > 0 && T.busSince(mark, 'RubberStored') > 0) storedReflected = true;
      if (storedReflected) break;
    }
    const rs = T.ct(0).store['rubber.compression'];
    held = rs && rs.held ? rs.held.length : 0;
  } catch (e) { runError = String(e && e.message); }
  const hitLines = win.APEX_ARSENAL.events.filter(e => e.includes('HIT')).slice(0, 6);
  const reflCount = T.busSince(mark, 'CrystalReflect');
  gate('golden-rubber-stores-reflected',
    wallG4.wall && a2 && a2.ok && storedReflected && held >= 1 && !runError,
    { wall: wallG4, a2: a2 && a2.ok, storedReflected, held, reflCount, intercepted, traj, hitLines, runError });
  snapshot('golden-rubber-stores-reflected');
} catch (e) { gate('golden-rubber-stores-reflected', false, String(e && e.message)); }

/* ================================================================== *
 * G5 — TIME replay x MIRROR portal (replay lineage exits neutral)
 * ================================================================== */
try {
  HR.setSeed(105);
  HR.setAiEnabled(false);
  T.start('TIME', 'MIRROR');
  T.holdSpawns();
  T.place(150, 500, 850, 500);
  const mir = T.ct(1);
  const api = HR.match.api;
  // F2 migration: two ACTIVE same-owner F1 mirror nodes via the
  // NON-SHIPPING test seam at the historical portal positions.
  api.mirrorTestNode(mir, 350, 500, 0);
  api.mirrorTestNode(mir, 650, 500, 0);
  T.step(0.1);
  const mirrors = ((mir.store['mirror.passive'] || {}).nodes || []).filter(n => n.st === 2).length;
  // Record real GLOCK fire for 1.5s, then loop-cast and watch a replayed
  // bullet enter a mirror portal and exit NEUTRAL (no hero controller).
  T.equip(0, 'GLOCK_17');
  T.step(1.5);
  const timeCt = T.ct(0);
  const loopStore = timeCt.store['time.loop'];
  const recorded = loopStore && loopStore.records ? loopStore.records.length : 0;
  const loop = T.ctl(0).tryCast('A1', 'goldens');
  let replayNeutral = false, recordsAfter = null, runError = null;
  try {
    for (let f = 0; f < 480; f++) {
      T.step(1 / 60);
      // Bullet replays are tagged __hr.replay (replayEmission marks the
      // fire-tag object, not a top-level flag).
      const replayBullets = win.projectiles.filter(p => p && p.aq && p.__hr && p.__hr.replay);
      if (replayBullets.some(p => p.__hr.neutral)) replayNeutral = true;
      const st = timeCt.store['time.loop'];
      recordsAfter = st && st.records ? st.records.length : 0;
      if (replayNeutral) break;
    }
    T.step(1); // settle: leftover bullets/replays die before the next match
  } catch (e) { runError = String(e && e.message); }
  // Replays are real projectiles: they route through portals and exit
  // neutral; replay lineage never re-records (no recursive replay).
  gate('golden-time-replay-mirror-portal',
    mirrors >= 2 && recorded >= 1 && loop && loop.ok && replayNeutral && recordsAfter === 0 && !runError,
    { mirrors, recorded, loop: loop && loop.ok, replayNeutral, recordsAfter, runError });
  snapshot('golden-time-replay-mirror-portal');
} catch (e) { gate('golden-time-replay-mirror-portal', false, String(e && e.message)); }

/* ================================================================== *
 * G6 — MATH geometry x HUNTER trap (graph absorbs the shot; the snare
 *      roots; rooted body still protected by the graph)
 * ================================================================== */
// Hunter presentation gates every Hunter cast on its V10 art being ready (assets load asynchronously).
for (let i = 0; i < 400 && !(win.APEX_HUNTER_PRESENTATION && win.APEX_HUNTER_PRESENTATION.ready); i++) await new Promise((r) => setTimeout(r, 50));
try {
  HR.setSeed(106);
  HR.setAiEnabled(false);
  T.start('MATH_V2', 'HUNTER');
  T.holdSpawns();
  T.place(250, 500, 750, 500);
  const math = T.ctl(0);
  const graph = math.tryCast('A1', 'goldens');
  const graphs0 = W().graphs.length;
  const hunter = T.ctl(1);
  const snare = hunter.tryCast('A1', 'goldens');
  const snares0 = W().snares.length;
  const sn = W().snares[0];
  const mathBody = win.fighters[0];
  // Relocate the snare onto MATH (root in place — the graph must stay
  // between the fighters for the absorption check).
  sn.x = mathBody.x; sn.y = mathBody.y;
  T.step(0.1);
  const rooted = HR.AIL.StatusResolver.has(mathBody, 'ROOT');
  // HUNTER fires at the rooted MATH — the graph must absorb the bullets.
  T.equip(1, 'GLOCK_17');
  const hpBefore = mathBody.hp;
  win.APEX_ARSENAL.events.length = 0;
  const hpTimeline = [];
  let shotsFiredAtMath = false, runError = null;
  try {
    for (let f = 0; f < 300; f++) {
      T.step(1 / 60);
      if (win.projectiles.some(p => p && p.aq && p.vx < 0)) shotsFiredAtMath = true;
      if (f % 60 === 0) hpTimeline.push(mathBody.hp);
    }
  } catch (e) { runError = String(e && e.message); }
  const hpAfter = mathBody.hp;
  const hitLines = win.APEX_ARSENAL.events.filter(e => e.includes('HIT')).slice(0, 8);
  // The graph stood between the fighters: bullets fired toward the rooted
  // MATH were absorbed and MATH took no damage while rooted.
  const absorbed = shotsFiredAtMath && hpAfter >= hpBefore - 1e-6;
  gate('golden-math-graph-hunter-trap',
    graph && graph.ok && graphs0 >= 1 && snare && snare.ok && snares0 >= 1
    && rooted && absorbed && !runError,
    { graph: graph && graph.ok, graphs: graphs0, snare: snare && snare.ok, rooted, absorbed,
      hpBefore, hpAfter, hpTimeline, hitLines, runError });
  snapshot('golden-math-graph-hunter-trap');
} catch (e) { gate('golden-math-graph-hunter-trap', false, String(e && e.message)); }

/* ================================================================== *
 * G7 — SLIME body x SNIPER targeting (bodies targetable; body death !=
 *      Combatant death; HUD total = living bodies)
 * ================================================================== */
try {
  HR.setSeed(107);
  HR.setAiEnabled(false);
  T.start('SLIME', 'SNIPER');
  T.holdSpawns();
  T.place(250, 500, 750, 500);
  const slimeCt = T.ct(0);
  const slime = T.ctl(0);
  // Mitosis: one logical Combatant, two living bodies.
  const mit = slime.tryCast('A1', 'goldens');
  T.step(0.1);
  const bodies = HR.getTargetableBodies(slimeCt);
  const notInFighters = bodies.filter(b => b !== win.fighters[0]).every(b => !win.fighters.includes(b));
  // SNIPER kit: A1 relocates to the farthest corner, A2 nests (predictive
  // intercept retarget + crit) — then it hunts the SLIME bodies.
  const sniper = T.ctl(1);
  const relocated = sniper.tryCast('A1', 'goldens');
  const nest = sniper.tryCast('A2', 'goldens');
  T.equip(1, 'GLOCK_17');
  const baseline = new Map(HR.getTargetableBodies(slimeCt).map(b => [b, b.hp]));
  let hitBody = null, runError = null;
  const hpSum0 = HR.combatantHp(slimeCt);
  try {
    for (let f = 0; f < 420 && !hitBody; f++) {
      T.step(1 / 60);
      for (const b of HR.getTargetableBodies(slimeCt)) {
        if (b.hp < baseline.get(b) - 1e-6) { hitBody = b; break; }
      }
    }
  } catch (e) { runError = String(e && e.message); }
  // Killing a child BODY is not Combatant death: the anchor lives on, the
  // combatant stays targetable, and the HUD total reflects living bodies.
  let combatantAliveAfterChildDeath = null, hudTotal = null;
  if (!runError) {
    try {
      const child = HR.getTargetableBodies(slimeCt).find(b => b !== win.fighters[0]);
      if (child) { child.hp = 0; T.step(1 / 30); }
      combatantAliveAfterChildDeath = !!(win.fighters[0].hp > 0 && HR.combatantHp(slimeCt).hp > 0);
      hudTotal = HR.bodyHudHp(win.fighters[0]);
    } catch (e) { runError = String(e && e.message); }
  }
  gate('golden-slime-bodies-sniper-targeting',
    mit && mit.ok && bodies.length >= 2 && notInFighters && relocated && relocated.ok
    && nest && nest.ok && !!hitBody && combatantAliveAfterChildDeath === true
    && hudTotal && hudTotal.hp > 0 && !runError,
    { mit: mit && mit.ok, bodies: bodies.length, notInFighters,
      relocated: relocated && relocated.ok, nest: nest && nest.ok, hitBody: !!hitBody,
      combatantAliveAfterChildDeath, hudTotal, runError });
  snapshot('golden-slime-bodies-sniper-targeting');
} catch (e) { gate('golden-slime-bodies-sniper-targeting', false, String(e && e.message)); }

/* ================================================================== *
 * G8 — T6 x every manipulation-capable Hero (no transform, ever)
 * ================================================================== */
try {
  const manipulators = ['CRYSTAL', 'MAGNET', 'BLACK_HOLE', 'RUBBER', 'MIRROR', 'MATH_V2', 'TIME', 'HUNTER', 'ROBOT'];
  const results = {};
  for (const hero of manipulators) {
    HR.setSeed(200 + manipulators.indexOf(hero));
    HR.setAiEnabled(false);
    T.start(hero, 'SNIPER');
    T.holdSpawns();
    T.place(250, 500, 750, 500);
    const ctl = T.ctl(0);
    // Activate every transform-capable skill the hero has.
    for (const slot of ['A1', 'A2']) { try { ctl.tryCast(slot, 'goldens'); } catch (e) {} }
    // SNIPER (P2) throws the T6 at the hero.
    T.equip(1, 'STORMBREAKER');
    const hp0 = win.fighters[0].hp;
    const mark = T.busMark(); // bus ring persists across matches
    let runError = null;
    try { T.step(6); } catch (e) { runError = String(e && e.message); }
    // F2: the legacy MirrorPortalRoute event was retired with the circular
    // router; F2 routing emits MirrorRouteCapture/MirrorRouteEmerge.
    const t6Transformed = ['CrystalReflect', 'SingularityStored', 'RubberStored',
      'MirrorRouteCapture', 'MirrorRouteEmerge', 'MirrorCopy'].some(t => T.busSince(mark, t) > 0);
    const storedT6 = W() && ((W().singularities || []).some(s => s.stored.some(d => d.weapon === 'STORMBREAKER'))
      || ((T.ct(0).store['rubber.compression'] || {}).held || []).some(d => d.weapon === 'STORMBREAKER'));
    const t6Projectiles = win.projectiles.filter(p => p && p.weapon === 'STORMBREAKER' && p.__hr
      && (p.__hr.neutral || p.__hr.lastPortalId || p.__hr.lastReflect));
    results[hero] = { t6Transformed, storedT6, t6Tagged: t6Projectiles.length > 0, runError };
  }
  const allClean = Object.values(results).every(r => !r.t6Transformed && !r.storedT6 && r.t6Tagged === false && !r.runError);
  gate('golden-t6-no-hero-manipulation', allClean, results);
  snapshot('golden-t6-no-hero-manipulation');
} catch (e) { gate('golden-t6-no-hero-manipulation', false, String(e && e.message)); }

/* ================================================================== *
 * I — Invariants (structural, doc-05 §12 list)
 * ================================================================== */
try {
  HR.setSeed(108);
  HR.setAiEnabled(false);
  T.start('SLIME', 'ROBOT');
  T.holdSpawns();
  T.place(150, 500, 850, 500); // far: pistol shots die mid-flight (no damage)
  const slimeCt = T.ct(0);
  const hpBefore = win.fighters[0].hp;
  // Equip-dup: equipping the same weapon twice never double-spawns.
  T.equip(0, 'PISTOL');
  T.equip(0, 'PISTOL');
  T.step(0.5);
  const ownPistols = win.projectiles.filter(p => p && p.aq && p.weapon === 'PISTOL' && p.owner === win.fighters[0]);
  const noEquipDup = ownPistols.length <= 1;
  // Damage realizes exactly once: every HIT log realizes telemetry once
  // (monotonic, no NaN); zero hits => zero damageTaken delta.
  const taken0 = slimeCt.telemetry.damageTaken;
  T.equip(1, 'PISTOL');
  win.APEX_ARSENAL.events.length = 0;
  T.step(2.5);
  const hitLogs = win.APEX_ARSENAL.events.filter(e => e.startsWith('[ARSENAL] HIT')).length;
  const takenDelta = slimeCt.telemetry.damageTaken - taken0;
  const oneRealize = hitLogs === 0 ? takenDelta === 0 : (takenDelta > 0 && !Number.isNaN(takenDelta));
  const hpAfter = win.fighters[0].hp;
  const hpConserved = hpAfter >= hpBefore - takenDelta - 1e-6 && !Number.isNaN(hpAfter);
  // No native double-kit: a rework ICE hero must not ALSO run the legacy
  // native ice-lane kit (lanes only appear via rework casts — none here).
  T.start('ICE', 'ROBOT');
  T.holdSpawns();
  T.place(150, 500, 850, 500);
  T.step(1);
  const noDoubleKit = W() && W().lanes.length === 0;
  const inv = HR.invariants();
  // Teardown: exiting the mode tears the match down — no match, no pending
  // scheduler jobs, no aq projectiles left.
  win.exitArsenalBattleMode();
  const teardownOk = !HR.match && HR.AIL.hrScheduler.pending() === 0
    && win.projectiles.filter(p => p && p.aq).length === 0;
  gate('goldens-invariants',
    noEquipDup && oneRealize && hpConserved && noDoubleKit && teardownOk && inv.ok,
    { hpBefore, hpAfter, hpConserved, noEquipDup, oneRealize, teardownOk, noDoubleKit, invErrors: inv.errors });
} catch (e) { gate('goldens-invariants', false, String(e && e.message)); }

/* ================================================================== *
 * F — Fuzz: deterministic seeded runs, random pair x weapon x casts,
 *     invariants sampled every 30 frames (rework AI ON — the fuzz is the
 *     only place the cast AI runs hot).
 * ================================================================== */
try {
  const HEROES = ['ROBOT', 'CRYSTAL', 'MAGNET', 'BLACK_HOLE', 'MATH_V2', 'ICE', 'RUBBER', 'HUNTER', 'TIME', 'MIRROR', 'SLIME', 'SNIPER'];
  const WEAPONS = ['PISTOL', 'GLOCK_17', 'AK_47', 'SHOTGUN', 'MOSSBERG_500', 'SNIPER', 'GRENADE', 'SABRE', 'BATTLE_AXE', 'DAGGER', 'SPEAR', 'STORMBREAKER'];
  const rngFor = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; s = (s * 2654435761 + 0x9E3779B9) >>> 0; return s / 4294967296; }; };
  const RUNS = 14;
  const failures = [];
  const telemetry = { pairs: [], runs: 0, casts: 0, entitiesPeak: 0, slimeBodyPeak: 0, mathProjectiles: 0 };
  HR.setAiEnabled(true);
  for (let run = 0; run < RUNS; run++) {
    const seed = 1000 + run * 17;
    const r = rngFor(seed);
    const p1 = HEROES[Math.floor(r() * HEROES.length)];
    let p2 = HEROES[Math.floor(r() * HEROES.length)];
    if (p2 === p1) p2 = HEROES[(HEROES.indexOf(p1) + 1) % HEROES.length];
    let koResolution = null;
    T.start(p1, p2);
    T.holdSpawns();
    T.place(200 + Math.floor(r() * 200), 200 + Math.floor(r() * 200), 700, 700);
    T.unhold();
    const w1 = WEAPONS[Math.floor(r() * WEAPONS.length)];
    const w2 = WEAPONS[Math.floor(r() * WEAPONS.length)];
    T.equip(0, w1); T.equip(1, w2);
    let runError = null;
    const hpBudget = { 0: 1000, 1: 1000 };
    try {
      for (let f = 0; f < 480; f++) {
        // Random P1 skill casts (deterministic from the seeded rng).
        if (r() < 0.02) { const slot = r() < 0.5 ? 'A1' : 'A2'; T.ctl(0).tryCast(slot, 'fuzz'); telemetry.casts++; }
        if (r() < 0.02) { const slot = r() < 0.5 ? 'A1' : 'A2'; T.ctl(1).tryCast(slot, 'fuzz'); telemetry.casts++; }
        T.step(1 / 60);
        // A KO is a LEGITIMATE terminal resolution (AQ sets state.over and
        // reflows the world) — record it and stop this run; invariants are
        // only meaningful while the match is live.
        if (win.APEX_ARSENAL.state.over) { koResolution = String(win.APEX_ARSENAL.state.over); telemetry.koResolutions = (telemetry.koResolutions || 0) + 1; break; }
        // Invariants sampled every 30 frames.
        if (f % 30 === 0) {
          const inv = HR.invariants();
          if (!inv.ok) { failures.push({ run, seed, pair: `${p1}v${p2}`, inv: inv.errors }); break; }
          const c0 = T.ct(0), c1 = T.ct(1);
          for (const [i, ct] of [[0, c0], [1, c1]]) {
            const tot = HR.combatantHp(ct);
            if (ct.heroId === 'SLIME') telemetry.slimeBodyPeak = Math.max(telemetry.slimeBodyPeak, tot.bodies);
            if (tot.hp > hpBudget[i] + 1e-6) { failures.push({ run, seed, pair: `${p1}v${p2}`, err: `${ct.heroId} HP ${tot.hp} > budget` }); }
            if (Number.isNaN(tot.hp)) { failures.push({ run, seed, err: 'NaN HP' }); }
          }
          const ents = win.projectiles.length + (W() ? (W().lanes.length + W().walls.length + W().snares.length + W().singularities.length + W().mirrors.length + W().shards.length + W().graphs.length) : 0);
          telemetry.entitiesPeak = Math.max(telemetry.entitiesPeak, ents);
          if (ents > 600) { failures.push({ run, seed, err: `entity storm ${ents}` }); break; }
        }
      }
    } catch (e) { runError = String(e && e.message); failures.push({ run, seed, pair: `${p1}v${p2}`, err: runError }); }
    telemetry.runs++;
    telemetry.pairs.push(`${p1}v${p2}${koResolution ? '#KO' : ''}`);
    if (runError) break;
  }
  report.telemetry = telemetry;
  gate('goldens-fuzz-deterministic-invariants', failures.length === 0,
    { failures: failures.slice(0, 5), telemetry });
} catch (e) { gate('goldens-fuzz-deterministic-invariants', false, String(e && e.message)); }

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
fs.writeFileSync(path.join(evidenceDir, 'hero-rework-goldens-report.json'), JSON.stringify(report, null, 2));
snapshot('goldens-final-state');
const total = Object.keys(report.gates).length;
const passed = Object.keys(report.gates).filter(k => report.gates[k].pass).length;
console.log(`\n[HERO REWORK GOLDENS] ${passed}/${total} gates passed`);
if (report.failures.length) {
  console.log('FAILED: ' + report.failures.join(', '));
  process.exit(1);
}
process.exit(0); // harness keeps jsdom/canvas handles alive — exit explicitly
