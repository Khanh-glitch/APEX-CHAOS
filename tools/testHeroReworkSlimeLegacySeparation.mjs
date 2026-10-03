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
const report = { suite: 'hero-rework-slime-legacy-separation', gates: {}, failures: [], loadErrors };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

win.eval(`(() => {
  window.__HR_Q = {
    start(p1, p2, seed) {
      if (window.APEX_HERO_REWORK && seed != null) window.APEX_HERO_REWORK.setSeed(seed);
      window.APEX_HERO_REWORK.setAiEnabled(false); // isolate P1 mechanics
      window.startArsenalBattleMode(p1, p2, { testFixture: true });
      const s = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
      if (s) { s.spawnTimer = 1e6; s.slots = []; s.unarmedFastConsumed = true; s.spawnHeld = true; }
      return window.APEX_HERO_REWORK.match;
    },
    startLegacy(p1, p2) {
      // Legacy-type match (no rework shells): the legacy encounter path.
      const FTs = window.FighterTypes || [];
      const t1 = FTs.find(t => t && t.name === p1 && !t.arsenalShell && !t.__hrHero);
      const t2 = FTs.find(t => t && t.name === p2 && !t.arsenalShell && !t.__hrHero);
      window.startSpecificMatch(t1, t2, { countdown: false });
      return { t1: !!t1, t2: !!t2 };
    },
    step(seconds, dt) {
      dt = dt || 1/60;
      let t = seconds;
      while (t > 1e-9) { const d = Math.min(dt, t); APEX_ARSENAL.step(d); t -= d; }
    },
    engineStep(seconds, dt) {
      // REAL engine frame loop (legacy matches have no AQ state; AQ.step
      // no-ops there). Fighter.update -> type.update runs here.
      dt = dt || 1/60;
      let t = seconds;
      while (t > 1e-9) { const d = Math.min(dt, t); window.update(d); t -= d; }
    },
  };
  return true;
})()`);
const Q = win.__HR_Q;

function legacyEntityCount() {
  return win.projectiles.filter(p => p && (p.type === 'slime_child' || p.type === 'slime_mucus')).length;
}

/* =============================================================================
 * L1 + L2 + L3 + L6 — rework shell under the EXACT pre-fix legacy trigger load.
 * ============================================================================= */
{
  const m = Q.start('SLIME', 'ICE', 4101);
  const a = win.fighters[0], b = win.fighters[1];
  a.x = 500; a.y = 500; a.setDir(1, 0);
  b.x = 150; b.y = 150; b.setDir(-1, -0.5);
  const W = win.APEX_ARSENAL.weaponApi;
  const fightersBefore = win.fighters.length;
  // Trigger load: several small hits (>=4 dmg windows) + two SHOCK hits
  // (>30% hp in <1s = the legacy clone trigger) + one more small hit after
  // the legacy childSpawnCd window.
  let dealtSum = 0, realizedSum = 0;
  const ratios = [];
  const hitAmt = (amt) => {
    const before = a.hp;
    const dealt = W.aqDamage(a, amt, b, 'STORMBREAKER', {});
    const realized = before - a.hp;
    dealtSum += dealt; realizedSum += realized;
    if (dealt > 0) ratios.push(realized / dealt);
    return realized;
  };
  // Trigger load: several small hits (>=4 dmg windows) + two SHOCK hits
  // (>30% hp in <1s = the legacy clone trigger) + one more small hit after
  // the legacy childSpawnCd window. Total kept under the HP pool so every
  // hit is measurable (no overkill floor).
  hitAmt(10); hitAmt(10); hitAmt(10);       // childCounter trigger load
  hitAmt(300);                              // shock hit (>30% hp)
  hitAmt(300);                              // second shock hit within 1s
  hitAmt(10);                               // post-window small hit
  Q.step(1.2);                              // let any legacy update paths run
  const ents = legacyEntityCount();
  const fightersLen = win.fighters.length;
  // SHARED GENERIC numeric tuning (apexCanonicalBalance CANONICAL_NUMERIC_
  // TUNING, roster-wide, exported) legitimately scales every roster hit:
  // expected ratio = source.out * target.taken. What must NOT exist is any
  // per-hit DRIFT (the pre-fix legacy guard absorb signature) or legacy
  // '-slime-guard-leak'/'-gel-armor' labels.
  const tune = win.APEX_VISIBLE_BALANCE_TUNING || {};
  const expectedRatio = ((tune['ICE'] && tune['ICE'].out) || 1) * ((tune['SLIME'] && tune['SLIME'].taken) || 1);
  const ratioStable = ratios.length >= 5 && ratios.every(r => Math.abs(r - expectedRatio) < 1e-6);
  const noLegacyLabels = !JSON.stringify(a.damageLabels || {}).includes('slime-guard-leak')
    && !JSON.stringify(a.damageLabels || {}).includes('gel-armor');
  const exact = ratioStable && noLegacyLabels;
  const noLegacyBookkeeping = !a.data.slimeDmgWindow && !a.data.childCounter && !a.data.shockCounter;
  const ct = win.APEX_HERO_REWORK && win.APEX_HERO_REWORK.byCombatant && win.APEX_HERO_REWORK.byCombatant(a);
  const live = !!m && !!ct && ct.bodies && ct.bodies.length >= 1;
  gate('L1-rework-no-legacy-entities-no-clones',
    ents === 0 && fightersLen === fightersBefore,
    { entities: ents, fightersBefore, fightersAfter: fightersLen });
  gate('L2-rework-damage-exact-no-legacy-modifiers', exact,
    { dealtSum: +dealtSum.toFixed(3), realizedSum: +realizedSum.toFixed(3), expectedRatio: +expectedRatio.toFixed(4), ratios: ratios.map(r => +r.toFixed(4)), ratioStable, noLegacyLabels });
  gate('L3-rework-no-legacy-bookkeeping', noLegacyBookkeeping,
    { slimeDmgWindow: a.data.slimeDmgWindow || null, childCounter: a.data.childCounter || null, shockCounter: a.data.shockCounter || null });
  gate('L6-rework-combatant-live', live,
    { match: !!m, bodies: ct && ct.bodies && ct.bodies.length, type: a.type.name, arsenalShell: !!a.type.arsenalShell, hrHero: a.type.__hrHero || null });
}

/* =============================================================================
 * L4 + L5 — legacy-type SLIME keeps its legacy kit (load-bearing preserved).
 * Stepped through the REAL engine update loop (legacy matches have no AQ
 * state — AQ.step no-ops there).
 * ============================================================================= */
{
  const started = Q.startLegacy('SLIME', 'ICE');
  const a = win.fighters[0], b = win.fighters[1];
  a.x = 500; a.y = 500; a.setDir(1, 0);
  b.x = 120; b.y = 120; b.setDir(-1, -1);
  const isLegacy = !!(a.type && !a.type.arsenalShell && !a.type.__hrHero && a.type.name === 'SLIME');
  const fightersBefore = win.fighters.length;
  // Two small hits -> legacy child spawn (childCounter >= 4). The spawn is
  // synchronous inside takeDamage (apexPrecisionFixes) — check immediately,
  // before any later hits can guard-block the child to death.
  a.takeDamage(10, b, 'legacy-probe');
  a.takeDamage(10, b, 'legacy-probe');
  const childSpawned = win.projectiles.some(p => p && p.type === 'slime_child' && p.owner === a && p.hp > 0)
    || (a.data.childSpawnCd || 0) > 0; // childSpawnCd is set ONLY by a spawn
  // Legacy type-update kit: run REAL engine frames so cloneCd decays, then a
  // shock hit (> max(10, 20% hp)) fires the legacy fighters[] clone split.
  Q.engineStep(1.6);
  a.takeDamage(Math.max(30, a.hp * 0.5), b, 'legacy-shock');
  Q.engineStep(0.1);
  const clonesGrew = win.fighters.length > fightersBefore;
  gate('L4-legacy-child-spawn-preserved', started.t1 && started.t2 && isLegacy && childSpawned,
    { started, isLegacy, childSpawned, childSpawnCd: a.data.childSpawnCd || 0 });
  gate('L5-legacy-fighters-clones-preserved', clonesGrew,
    { fightersBefore, fightersAfter: win.fighters.length });
}

/* ------------------------------------------------------------------ summary */
const total = Object.keys(report.gates).length;
const passed = Object.values(report.gates).filter(g => g.pass).length;
console.log(`\n[HERO REWORK SLIME LEGACY SEPARATION] ${passed}/${total} gates passed`);
if (report.failures.length) console.log('FAILURES:', report.failures.join(', '));
report.summary = { total, passed, failed: report.failures };
fs.writeFileSync(path.join(evidenceDir, 'slime-legacy-separation-report.json'), JSON.stringify(report, null, 2));
try { win.close(); } catch (e) { /* teardown only */ }
process.exit(report.failures.length ? 1 : 0);
