// Arsenal Quest P0 — headless acceptance harness.
//
// Runs the REAL Apex engine (public/apexEngine.js) and the REAL Arsenal Quest
// runtimes inside jsdom with a real 2D canvas (@napi-rs/canvas), stepping the
// simulation deterministically and writing genuine canvas renders as PNG
// evidence. This is the sandbox-friendly sibling of tools/testArsenalQuestRuntime.mjs
// (which drives a real browser over CDP); both assert the same acceptance gates.
//
// Usage: node tools/testArsenalQuestHeadless.mjs
// Env:   AQ_TOOLING_DIR  (default /home/user/.tooling/browser — provides jsdom + @napi-rs/canvas)
//        AQ_EVIDENCE_DIR (default docs/arsenal-quest/evidence)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BOOT_GAME_RUNTIMES, MODE_DEFERRED_RUNTIMES } from '../src/game/runtimeManifest.js';

const REPO = process.cwd();
const TOOLING_DIR = process.env.AQ_TOOLING_DIR || path.join(REPO, 'node_modules');
const evidenceDir = process.env.AQ_EVIDENCE_DIR || 'docs/arsenal-quest/evidence';
const requireTool = createRequire(path.join(TOOLING_DIR, 'noop.js'));
const { JSDOM } = requireTool('jsdom');
const { createCanvas, loadImage } = requireTool('@napi-rs/canvas');

// ---------------------------------------------------------------- DOM setup
const dom = new JSDOM(`<!doctype html><html><body>
  <div id="game-wrapper">
    <canvas id="game-canvas" width="1000" height="1000"></canvas>
    <div id="countdown-overlay" style="display:none"><div id="countdown-num">3</div><div id="countdown-sub"></div></div>
    <div class="ui-layer" id="hud">
      <div id="p1-name">P1</div><div id="p1-hp-loss"></div><div id="p1-hp"></div><div id="p1-hp-text"></div><div id="p1-rage"></div>
      <div id="p2-name">P2</div><div id="p2-hp-loss"></div><div id="p2-hp"></div><div id="p2-hp-text"></div><div id="p2-rage"></div>
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
</body></html>`, { pretendToBeVisual: true, runScripts: 'dangerously', url: 'http://localhost/' });

const win = dom.window;
win.__apexStatsSilent = true; // silence synthesized battle SFX in the harness

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
        this.complete = true;
        if (this.onload) this.onload();
      })
      .catch(() => { if (this.onerror) this.onerror(); });
  }
  get src() { return this._src; }
}
win.Image = HarnessImage;

// Harness owns time: no automatic frames; tests step deterministically.
win.requestAnimationFrame = () => 0;
win.cancelAnimationFrame = () => {};

// ------------------------------------------------------------ script loading
const loadErrors = [];
function loadScript(relPath, required) {
  const file = path.join(REPO, 'public', relPath.replace(/^\//, ''));
  try {
    win.eval(fs.readFileSync(file, 'utf8'));
    return true;
  } catch (error) {
    loadErrors.push({ file: relPath, error: String(error && error.message || error) });
    if (required) throw new Error(`Required runtime failed to load: ${relPath}: ${error}`);
    return false;
  }
}

loadScript('/apexEngine.js', true);
for (const [src] of BOOT_GAME_RUNTIMES) loadScript(src, false);
for (const [src] of MODE_DEFERRED_RUNTIMES.arsenalQuest) loadScript(src, true);

// ------------------------------------------------------------ test plumbing
const report = { gates: {}, failures: [], loadErrors, evidence: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}
const $ = id => win.document.getElementById(id);
const T = {}; // test helpers over engine globals

function snapshot(name) {
  const file = path.join(evidenceDir, `${name}.png`);
  fs.writeFileSync(file, gameCanvasReal.toBuffer('image/png'));
  report.evidence.push(file);
  return file;
}

// Install test helpers into the page context (same API as the CDP harness).
win.eval(`(() => {
  window.__AQ_TEST = {
    enterManual() {
      window.startArsenalQuestMode();
      cancelAnimationFrame(reqId); reqId = 0;
      return getArsenalQuestDebugState();
    },
    step(seconds, dt) {
      dt = dt || 1/60;
      let t = seconds;
      while (t > 1e-9) { const d = Math.min(dt, t); APEX_ARSENAL.step(d); t -= d; }
    },
    place(fx, fy, ex, ey, freeze) {
      const [a, b] = fighters;
      a.x = fx; a.y = fy; b.x = ex; b.y = ey;
      a.setDir(Math.sign(ex - fx) || 1, 0); b.setDir(-Math.sign(ex - fx) || -1, 0);
      if (freeze !== false) { a.baseSpeed = 0; b.baseSpeed = 0; }
    },
    hp() { return { hero: fighters[0].hp, rival: fighters[1].hp }; },
    holder(who) {
      const f = who === 'HERO' ? fighters[0] : fighters[1];
      const h = APEX_ARSENAL.weaponApi.getHolder(f);
      return h ? { weapon: h.weaponId, phase: h.phase, shots: h.shotsFired } : null;
    },
    equip(who, weaponId) { APEX_ARSENAL.weaponApi.equip(who === 'HERO' ? fighters[0] : fighters[1], weaponId); },
    holdSpawns() { APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = []; },
    clearSlots() { APEX_ARSENAL.state.slots = []; },
    pushSlot(overrides) {
      const s = APEX_ARSENAL.state;
      const slot = Object.assign({
        id: s.nextSlotId++, x: 500, y: 500, phase: 'REVEALED', weaponId: 'PISTOL',
        revealLeadSeconds: 1.5, revealedFor: 0, pickedBy: null, rejectedFor: {}, spawnTime: s.time,
        predictedHeroETA: null, predictedRivalETA: null, earliestETA: null, predictedFighter: null,
      }, overrides);
      s.slots.push(slot);
      return slot.id;
    },
    events() { return APEX_ARSENAL.events.slice(); },
    clearEvents() { APEX_ARSENAL.events.length = 0; },
    countEvents(prefix, filter) {
      return APEX_ARSENAL.events.filter(e => e.startsWith('[AQ] ' + prefix) && (!filter || e.includes(filter))).length;
    },
    aqProjectiles() {
      return projectiles.filter(p => p.aq).map(p => ({ type: p.type, owner: p.owner ? p.owner.name : null, weapon: p.weapon }));
    },
    statuses(who) { const f = who === 'HERO' ? fighters[0] : fighters[1]; return Object.keys(f.statuses || {}); },
    debug() { return getArsenalQuestDebugState(); },
    redraw() { draw(); },
    earlyErrors() { return window.apexEarlyErrors || []; },
  };
  return true;
})()`);
const run = expr => win.eval(`(() => { ${expr} })()`);

fs.mkdirSync(evidenceDir, { recursive: true });

// ------------------------------------------------------- gate: registration
gate('runtime-registered',
  typeof win.startArsenalQuestMode === 'function'
  && typeof win.exitArsenalQuestMode === 'function'
  && typeof win.getArsenalQuestDebugState === 'function'
  && !!win.APEX_ARSENAL?.weaponApi,
  { bootLoadErrors: loadErrors.map(e => e.file) });

// ------------------------------------------------- gate: normal modes intact
report.normalModes = run(`
  const results = {};
  goToSelect();
  results.selectState = gameState;
  goToMenu();
  results.menuState = gameState;
  results.menuVisible = !document.getElementById('menu-screen').classList.contains('hidden');
  const ICE = FighterTypes.find(t => t.name === 'ICE');
  const TOXIC = FighterTypes.find(t => t.name === 'TOXIC');
  startSpecificMatch(ICE, TOXIC, { countdown: false });
  results.normalMatchState = gameState;
  results.normalFighters = fighters.map(f => f.name);
  const x0 = fighters[0].x;
  for (let i = 0; i < 60; i++) update(1/60);
  results.normalSimMoved = fighters[0].x !== x0 || projectiles.length > 0;
  goToMenu();
  results.menuAfterMatch = gameState;
  return results;
`);
gate('normal-modes-launch',
  report.normalModes.normalMatchState === 'PLAYING'
  && report.normalModes.menuAfterMatch === 'MENU'
  && report.normalModes.menuVisible
  && report.normalModes.normalSimMoved,
  report.normalModes);

// ---------------------------------------------------------- gate: entry state
report.entry = run(`
  const d = __AQ_TEST.enterManual();
  return {
    gameState: d.gameState, hero: d.hero, rival: d.rival,
    hudOpacity: document.getElementById('hud').style.opacity,
    menuHidden: document.getElementById('menu-screen').classList.contains('hidden'),
    p1Name: document.getElementById('p1-name').innerText,
    p2Name: document.getElementById('p2-name').innerText,
  };
`);
gate('entry-state',
  report.entry.gameState === 'ARSENAL'
  && report.entry.hero.hp === 100 && report.entry.rival.hp === 100
  && report.entry.hero.weapon === 'NONE' && report.entry.rival.weapon === 'NONE'
  && report.entry.menuHidden
  && report.entry.p1Name === 'HERO' && report.entry.p2Name === 'RIVAL',
  report.entry);

// ---------------------------------------------- gate: A-CORR-1 spawn cadence law
report.spawnLaw = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearSlots();
  __AQ_TEST.clearEvents();
  // Frozen, far fighters: cadence is timer-driven and independent of pickups.
  __AQ_TEST.place(90, 90, 910, 910);
  const leads = {};
  const spawnTimes = [];
  let lastCount = 0;
  for (let t = 0; t < 20; t += 0.1) {
    __AQ_TEST.step(0.1);
    const st = APEX_ARSENAL.state;
    if (st.spawnedTotal > lastCount) { spawnTimes.push(+st.time.toFixed(2)); lastCount = st.spawnedTotal; }
    for (const slot of st.slots) {
      if (slot.phase === 'TELEGRAPH') leads[slot.id] = slot.revealLeadSeconds;
    }
  }
  const gaps = spawnTimes.slice(1).map((v, i) => +(v - spawnTimes[i]).toFixed(2));
  const d = __AQ_TEST.debug();
  const leadValues = Object.values(leads);
  const revealEvents = __AQ_TEST.events().filter(e => e.startsWith('[AQ] REVEAL'));
  return {
    spawnedTotal: d.spawnedTotal,
    maxActive: d.maxActiveSlots,
    spawnTimes,
    gaps,
    // A-CORR-1: measured cadence must be 4.5s (2/3 of the 3.0s A build).
    cadenceOk: spawnTimes.length >= 4 && Math.abs(spawnTimes[0] - 1.0) < 0.2
      && gaps.every(g => Math.abs(g - 4.5) < 0.15),
    leadValues,
    // A-CORR-2: every slot carries the fixed 2.0s whole-circle reveal lead.
    leadsFixedTwo: leadValues.length >= 3 && leadValues.every(v => Math.abs(v - 2.0) < 1e-9),
    spawnEvents: __AQ_TEST.countEvents('SPAWN_SLOT'),
    revealCount: revealEvents.length,
    // Nobody approaches, so every reveal in this run is the 3.0s failsafe.
    allRevealsForced: revealEvents.length >= 3 && revealEvents.every(e => /force=true/.test(e)),
    allHiddenIdentityNull: d.slots.filter(s => s.phase === 'TELEGRAPH').every(s => s.weaponId === null),
  };
`);
gate('spawn-cadence-4.5s', report.spawnLaw.cadenceOk,
  `spawnTimes=${JSON.stringify(report.spawnLaw.spawnTimes)} gaps=${JSON.stringify(report.spawnLaw.gaps)}`);
gate('reveal-lead-fixed-2.0', report.spawnLaw.leadsFixedTwo, report.spawnLaw.leadValues.map(v => +v.toFixed(3)));
gate('multi-slot-coexist', report.spawnLaw.maxActive >= 3, `maxActiveSlots=${report.spawnLaw.maxActive}`);
gate('force-reveals-only-while-unapproached',
  report.spawnLaw.allRevealsForced && report.spawnLaw.allHiddenIdentityNull,
  `reveals=${report.spawnLaw.revealCount} (all force=true, identity null while hidden)`);

// ------------------------- gate: A-CORR-2 whole-circle reveal law + 3.0s failsafe
report.telegraphLaw = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearEvents();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(400, 500, 900, 900); // frozen by default
  const id = __AQ_TEST.pushSlot({
    x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null,
    revealLeadSeconds: 2.0
  });

  // Age 2.9s, nobody approaching: still hidden, still identity-null.
  __AQ_TEST.step(2.9);
  let slot = APEX_ARSENAL.state.slots.find(s => s.id === id);
  const hiddenAt2_9 = !!slot && slot.phase === 'TELEGRAPH' && slot.weaponId === null;
  const beforeDebug = __AQ_TEST.debug().slots.find(s => s.id === id);

  // Cross age 3.0s -> FORCE REVEAL (not auto-pickup): identity assigned, log
  // carries force=true; the slot then behaves like any normal collectible.
  __AQ_TEST.step(0.2);
  slot = APEX_ARSENAL.state.slots.find(s => s.id === id);
  const forceRevealed = !!slot && slot.phase === 'REVEALED' && !!slot.weaponId;
  const forceLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + id)) || '';
  const heroHolderAfterForce = __AQ_TEST.holder('HERO');

  // HERO now walks into the force-revealed pickup like a normal weapon.
  fighters[0].baseSpeed = 520;
  fighters[0].setDir(1, 0);
  fighters[1].baseSpeed = 0;
  __AQ_TEST.step(1.5);
  // Instant-fire weapons (SHOTGUN/GRENADE) legitimately consume before we look;
  // a logged PICKUP + (holder still up OR consume logged) proves normal-collectible behavior.
  const pickupAfterForce = __AQ_TEST.countEvents('PICKUP', 'fighter=HERO') === 1
    && (!!__AQ_TEST.holder('HERO') || __AQ_TEST.countEvents('CONSUME', 'fighter=HERO') >= 1);

  // Movement-triggered reveal at the fixed 2.0s lead on a fresh slot.
  // (Disarm HERO first: an armed fighter is not eligible to trigger reveals.)
  fighters[0].data.arsenal = null;
  fighters[0].data.arsenalFade = null;
  fighters[1].data.arsenal = null;
  projectiles.length = 0; // drop leftovers from the pickup walk (grenades etc.)
  fighters[0].statuses = {}; fighters[1].statuses = {}; // e.g. Tower Shield slow
  fighters[0].hp = fighters[0].maxHp; fighters[1].hp = fighters[1].maxHp;
  __AQ_TEST.holdSpawns();
  __AQ_TEST.clearEvents();
  __AQ_TEST.place(100, 300, 900, 900);
  const mid = __AQ_TEST.pushSlot({ x: 850, y: 300, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
  fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
  __AQ_TEST.step(0.04);
  slot = APEX_ARSENAL.state.slots.find(s => s.id === mid);
  const moveRevealLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + mid)) || '';
  const revealedOnMovement = !!slot && slot.phase === 'REVEALED'
    && /lead=2\.00/.test(moveRevealLog) && /force=false/.test(moveRevealLog) && /fighter=HERO/.test(moveRevealLog);
  const etaMatch = /eta=(\\d+\\.\\d+)/.exec(moveRevealLog);
  const eta = etaMatch ? parseFloat(etaMatch[1]) : null;
  return {
    hiddenAt2_9,
    beforeDebug,
    forceRevealed,
    forceLog,
    heroHolderAfterForce,
    pickupAfterForce,
    revealedOnMovement,
    moveRevealLog,
    eta,
  };
`);
gate('hidden-until-force-age-3.0',
  report.telegraphLaw.hiddenAt2_9 && report.telegraphLaw.beforeDebug?.weaponId === null
    && report.telegraphLaw.heroHolderAfterForce === null,
  report.telegraphLaw.beforeDebug);
gate('telegraph-no-identity', report.telegraphLaw.beforeDebug?.weaponId === null);
gate('force-reveal-at-3.0-not-autopickup',
  report.telegraphLaw.forceRevealed && /force=true/.test(report.telegraphLaw.forceLog)
    && /lead=2\.00/.test(report.telegraphLaw.forceLog) && report.telegraphLaw.pickupAfterForce,
  report.telegraphLaw.forceLog);
gate('movement-reveal-lead-2.0',
  report.telegraphLaw.revealedOnMovement && report.telegraphLaw.eta != null
    && report.telegraphLaw.eta > 1.0 && report.telegraphLaw.eta <= 2.0,
  `${report.telegraphLaw.moveRevealLog} eta=${report.telegraphLaw.eta}`);

// ------------- gate: A-CORR-2 negatives — near miss outside circle + no pre-bounce
report.circleNeg = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.clearEvents();
  // Near miss: path passes 60px off-center — outside the 42px visible circle.
  // Must stay hidden through the whole pass (age < 3.0s, no force reveal yet).
  __AQ_TEST.place(400, 440, 900, 200);
  const missId = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
  fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0); fighters[1].baseSpeed = 0;
  __AQ_TEST.step(1.1); // hero sweeps past the slot's x while 60px outside
  const miss = APEX_ARSENAL.state.slots.find(s => s.id === missId);
  const nearMissStayedHidden = !!miss && miss.phase === 'TELEGRAPH' && miss.weaponId === null;

  // Edge of circle: path passes 25px off-center — inside the visible circle.
  // Any part of the visible question-mark circle may trigger the reveal.
  __AQ_TEST.holdSpawns();
  __AQ_TEST.clearEvents();
  __AQ_TEST.place(400, 475, 900, 200);
  const edgeId = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
  fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
  __AQ_TEST.step(0.04);
  const edge = APEX_ARSENAL.state.slots.find(s => s.id === edgeId);
  const edgeLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + edgeId)) || '';
  const edgeOfCircleReveals = !!edge && edge.phase === 'REVEALED' && /force=false/.test(edgeLog);

  // Pre-bounce: slot behind the fighter near the wall. The current segment
  // would bounce before circle entry -> no reveal until the bounce happens.
  __AQ_TEST.holdSpawns();
  __AQ_TEST.clearEvents();
  __AQ_TEST.place(900, 500, 300, 200);
  const bounceId = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
  fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
  __AQ_TEST.step(0.03); // still pre-bounce (wall contact ~0.05s away)
  const preBounce = APEX_ARSENAL.state.slots.find(s => s.id === bounceId);
  const hiddenBeforeBounce = !!preBounce && preBounce.phase === 'TELEGRAPH' && preBounce.weaponId === null;
  __AQ_TEST.step(0.35); // after the bounce the new segment re-evaluates
  const postBounce = APEX_ARSENAL.state.slots.find(s => s.id === bounceId);
  const bounceLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + bounceId)) || '';
  const revealedAfterBounce = !postBounce || (postBounce.phase === 'REVEALED' && /force=false/.test(bounceLog));
  return { nearMissStayedHidden, edgeOfCircleReveals, edgeLog, hiddenBeforeBounce, revealedAfterBounce, bounceLog };
`);
gate('near-miss-outside-circle-stays-hidden', report.circleNeg.nearMissStayedHidden, report.circleNeg);
gate('edge-of-circle-approach-reveals', report.circleNeg.edgeOfCircleReveals, report.circleNeg.edgeLog);
gate('no-reveal-before-bounce', report.circleNeg.hiddenBeforeBounce && report.circleNeg.revealedAfterBounce,
  `hidden=${report.circleNeg.hiddenBeforeBounce} after=${report.circleNeg.revealedAfterBounce} ${report.circleNeg.bounceLog}`);

// ------------------------------------------------ gate: pickup rules both sides
report.pickupRules = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearEvents();
  __AQ_TEST.place(300, 500, 700, 500);
  __AQ_TEST.holdSpawns();
  __AQ_TEST.pushSlot({ x: 700, y: 500, weaponId: 'SABRE' });
  __AQ_TEST.step(0.3);
  const rivalGot = __AQ_TEST.holder('RIVAL');
  __AQ_TEST.pushSlot({ x: 300, y: 500, weaponId: 'SMG' });
  __AQ_TEST.step(0.3);
  const heroGot = __AQ_TEST.holder('HERO');
  __AQ_TEST.pushSlot({ x: 300, y: 520, weaponId: 'PISTOL' });
  __AQ_TEST.step(0.3);
  const rejectedStillThere = APEX_ARSENAL.state.slots.some(s => s.weaponId === 'PISTOL' && s.phase === 'REVEALED');
  return {
    rivalGot: rivalGot && rivalGot.weapon,
    heroGot: heroGot && heroGot.weapon,
    heroStillArmedWith: (__AQ_TEST.holder('HERO') || {}).weapon,
    rejectedStillThere,
    rejectLogged: __AQ_TEST.countEvents('REJECT_PICKUP', 'fighter=HERO') > 0,
  };
`);
gate('rival-can-collect', report.pickupRules.rivalGot === 'SABRE');
gate('hero-can-collect', report.pickupRules.heroGot === 'SMG');
gate('armed-fighter-cannot-vacuum',
  report.pickupRules.rejectedStillThere && report.pickupRules.rejectLogged && report.pickupRules.heroStillArmedWith === 'SMG');

// --------------------------------------------------------- gate: soft cap
report.softCap = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearEvents();
  __AQ_TEST.holdSpawns();
  for (let i = 0; i < 8; i++) __AQ_TEST.pushSlot({ x: 100 + i * 100, y: 200, weaponId: 'PISTOL' });
  const result = APEX_ARSENAL_SPAWN.trySpawnSlot();
  return { spawned: !!result, suppressed: __AQ_TEST.countEvents('SPAWN_SUPPRESSED') };
`);
gate('soft-cap-suppresses-and-logs', report.softCap.spawned === false && report.softCap.suppressed >= 1);

// ------------------------------------------------- gates: 12 weapon behaviors
const MELEE_PLACEMENT = { SABRE: 200, BATTLE_AXE: 200, DAGGER: 190, SPEAR: 320, SPIKED_CLUB: 200 };
report.weapons = {};
for (const weaponId of ['PISTOL', 'SHOTGUN', 'SMG', 'SNIPER', 'GRENADE', 'SABRE', 'BATTLE_AXE', 'DAGGER', 'SPEAR', 'SPIKED_CLUB']) {
  const gap = MELEE_PLACEMENT[weaponId] ?? 300;
  report.weapons[weaponId] = run(`
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(300, 500, ${300 + gap}, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', '${weaponId}');
    __AQ_TEST.step(0.3);
    const midPhase = (__AQ_TEST.holder('HERO') || {}).phase;
    __AQ_TEST.step(0.35);
    const midPhase2 = (__AQ_TEST.holder('HERO') || {}).phase;
    const statusesMid = __AQ_TEST.statuses('RIVAL');
    __AQ_TEST.step(2.35);
    const hp = __AQ_TEST.hp();
    return {
      midPhase,
      midPhase2,
      damageDealt: +(100 - hp.rival).toFixed(1),
      holderAfter: __AQ_TEST.holder('HERO'),
      useLogged: __AQ_TEST.countEvents('USE', 'weapon=${weaponId}'),
      hitLogged: __AQ_TEST.countEvents('HIT', 'weapon=${weaponId}'),
      consumeLogged: __AQ_TEST.countEvents('CONSUME', 'weapon=${weaponId}'),
      statuses: __AQ_TEST.statuses('RIVAL'),
      statusesMid,
    };
  `);
  const w = report.weapons[weaponId];
  gate(`weapon-${weaponId}`,
    w.damageDealt > 0 && w.holderAfter === null && w.useLogged >= 1 && w.consumeLogged >= 1 && w.hitLogged >= 1,
    `dmg=${w.damageDealt} USE=${w.useLogged} HIT=${w.hitLogged} CONSUME=${w.consumeLogged}`);
}
gate('pistol-3-shots', report.weapons.PISTOL.hitLogged === 3, `hits=${report.weapons.PISTOL.hitLogged}`);
gate('smg-8-shots', report.weapons.SMG.hitLogged === 8, `hits=${report.weapons.SMG.hitLogged}`);
gate('sniper-single-high-damage', report.weapons.SNIPER.hitLogged === 1 && report.weapons.SNIPER.damageDealt >= 20, `dmg=${report.weapons.SNIPER.damageDealt}`);
gate('sniper-aim-telegraph-window', report.weapons.SNIPER.midPhase2 === 'AIM', `phase@0.3s=${report.weapons.SNIPER.midPhase} phase@0.65s=${report.weapons.SNIPER.midPhase2}`);
gate('club-stun-applied', report.weapons.SPIKED_CLUB.statusesMid.includes('stun'), report.weapons.SPIKED_CLUB.statusesMid);
gate('axe-knockback-applied', report.weapons.BATTLE_AXE.statusesMid.includes('push'), report.weapons.BATTLE_AXE.statusesMid);

report.grenade = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearEvents();
  __AQ_TEST.place(250, 500, 550, 500);
  __AQ_TEST.holdSpawns();
  __AQ_TEST.equip('HERO', 'GRENADE');
  __AQ_TEST.step(0.6);
  const afterThrow = { holder: __AQ_TEST.holder('HERO'), grenadeInWorld: __AQ_TEST.aqProjectiles().some(p => p.type === 'aq_grenade') };
  __AQ_TEST.step(1.6);
  return {
    afterThrow,
    rivalHpAfter: __AQ_TEST.hp().rival,
    explodeLogged: __AQ_TEST.countEvents('EXPLODE') > 0,
    grenadeGone: !__AQ_TEST.aqProjectiles().some(p => p.type === 'aq_grenade'),
  };
`);
gate('grenade-throw-consumes-immediately', report.grenade.afterThrow.holder === null && report.grenade.afterThrow.grenadeInWorld);
gate('grenade-resolves-after-fuse', report.grenade.rivalHpAfter < 100 && report.grenade.explodeLogged && report.grenade.grenadeGone, `rivalHp=${report.grenade.rivalHpAfter}`);

report.meleeWait = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearEvents();
  __AQ_TEST.place(120, 120, 880, 880);
  __AQ_TEST.holdSpawns();
  __AQ_TEST.equip('HERO', 'BATTLE_AXE');
  __AQ_TEST.step(2.0);
  const farState = { holder: __AQ_TEST.holder('HERO'), rivalHp: __AQ_TEST.hp().rival };
  fighters[1].x = 320; fighters[1].y = 120;
  __AQ_TEST.step(1.2);
  return { farHolder: farState.holder && farState.holder.weapon, farRivalHp: farState.rivalHp, nearHolder: __AQ_TEST.holder('HERO'), nearRivalHp: __AQ_TEST.hp().rival };
`);
gate('melee-not-wasted-out-of-range', report.meleeWait.farHolder === 'BATTLE_AXE' && report.meleeWait.farRivalHp === 100);
gate('melee-activates-in-range', report.meleeWait.nearHolder === null && report.meleeWait.nearRivalHp < 100);

// ------------------------------------------------------------ gate: shields
report.swirl = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearEvents();
  __AQ_TEST.place(300, 500, 700, 500);
  __AQ_TEST.holdSpawns();
  __AQ_TEST.equip('RIVAL', 'SNIPER');
  __AQ_TEST.equip('HERO', 'SWIRL_SHIELD');
  __AQ_TEST.step(2.5);
  return {
    heroHp: __AQ_TEST.hp().hero,
    rivalHp: __AQ_TEST.hp().rival,
    heroHolder: __AQ_TEST.holder('HERO'),
    reflectLogged: __AQ_TEST.countEvents('REFLECT', 'fighter=HERO') > 0,
    hitOnRivalFromHero: __AQ_TEST.events().filter(e => e.startsWith('[AQ] HIT') && e.includes('source=HERO') && e.includes('target=RIVAL')).length,
  };
`);
gate('swirl-reflects-projectile', report.swirl.reflectLogged && report.swirl.heroHp === 100 && report.swirl.rivalHp < 100 && report.swirl.heroHolder === null,
  `heroHp=${report.swirl.heroHp} rivalHp=${report.swirl.rivalHp}`);
gate('swirl-reflect-ownership-correct', report.swirl.hitOnRivalFromHero >= 1, 'reflected bullet source=HERO target=RIVAL');

report.tower = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearEvents();
  __AQ_TEST.place(300, 500, 700, 500);
  __AQ_TEST.holdSpawns();
  __AQ_TEST.equip('HERO', 'TOWER_SHIELD');
  __AQ_TEST.step(0.3);
  const speedStatus = __AQ_TEST.statuses('HERO').includes('slow');
  APEX_ARSENAL.weaponApi.aqDamage(fighters[0], 10, fighters[1], 'TEST_PROBE');
  const guardedHp = __AQ_TEST.hp().hero;
  __AQ_TEST.step(3.0);
  const expired = __AQ_TEST.holder('HERO');
  APEX_ARSENAL.weaponApi.aqDamage(fighters[0], 10, fighters[1], 'TEST_PROBE');
  const unguardedHp = __AQ_TEST.hp().hero;
  return { speedStatus, guardedHp, expiredHolder: expired, unguardedHp, unguardedDelta: +(guardedHp - unguardedHp).toFixed(2) };
`);
gate('tower-shield-reduces-damage', report.tower.guardedHp === 97.5 && report.tower.unguardedDelta === 10,
  `withShield 10->${100 - report.tower.guardedHp}, without 10->${report.tower.unguardedDelta}`);
gate('tower-shield-slow-while-active', report.tower.speedStatus);
gate('tower-shield-expires-to-unarmed', report.tower.expiredHolder === null);

// --------------------------------------------------- gate: exit cleanup
report.cleanup = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(300, 500, 700, 500);
  __AQ_TEST.equip('HERO', 'SNIPER');
  __AQ_TEST.step(1.6);
  __AQ_TEST.equip('RIVAL', 'TOWER_SHIELD');
  window.exitArsenalQuestMode();
  return {
    gameStateAfter: gameState,
    menuVisible: !document.getElementById('menu-screen').classList.contains('hidden'),
    hudHidden: document.getElementById('hud').style.opacity === '0',
    slotsCleared: !APEX_ARSENAL.state || APEX_ARSENAL.state.slots.length === 0,
    aqProjectilesCleared: projectiles.filter(p => p.aq).length === 0,
    heroHolderCleared: !fighters[0].data.arsenal,
    exitLogged: APEX_ARSENAL.events.some(e => e.startsWith('[AQ] MODE_EXIT')),
  };
`);
gate('exit-cleanup',
  report.cleanup.gameStateAfter === 'MENU' && report.cleanup.menuVisible && report.cleanup.hudHidden
  && report.cleanup.slotsCleared && report.cleanup.aqProjectilesCleared && report.cleanup.heroHolderCleared && report.cleanup.exitLogged,
  report.cleanup);

// ------------------------------------------------------ F3 overlay + evidence
report.f3 = run(`
  __AQ_TEST.enterManual();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3', bubbles: true, cancelable: true }));
  return { toggledOn: APEX_ARSENAL.state.debugOverlay };
`);
gate('f3-debug-overlay-toggle', report.f3.toggledOn === true);

// Wait for curated + atlas assets to decode before snapshotting weapon art.
{
  const w0 = Date.now();
  while (win.APEX_ARSENAL_AV && (win.APEX_ARSENAL_AV.imagesReady() < win.APEX_ARSENAL_AV.describe().allImages.length) && Date.now() - w0 < 20000) {
    await new Promise(r => setTimeout(r, 100));
  }
}

// Evidence 1: hidden telegraph + F3 overlay.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(240, 620, 780, 340);
  __AQ_TEST.pushSlot({ x: 500, y: 470, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.5 });
  __AQ_TEST.step(0.4);
  APEX_ARSENAL.state.debugOverlay = true;
  __AQ_TEST.redraw();
`);
snapshot('01-hidden-telegraph');

// Evidence 2: multiple simultaneous pickups (3 revealed + 1 telegraph).
run(`
  __AQ_TEST.holdSpawns();
  __AQ_TEST.pushSlot({ x: 320, y: 300, weaponId: 'SHOTGUN' });
  __AQ_TEST.pushSlot({ x: 500, y: 640, weaponId: 'BATTLE_AXE' });
  __AQ_TEST.pushSlot({ x: 720, y: 380, weaponId: 'SWIRL_SHIELD' });
  __AQ_TEST.pushSlot({ x: 620, y: 760, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.5 });
  __AQ_TEST.step(0.2);
  __AQ_TEST.redraw();
`);
snapshot('02-multiple-simultaneous-pickups');

// Evidence 3: HERO pickup moment.
run(`
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(300, 500, 820, 260);
  __AQ_TEST.pushSlot({ x: 300, y: 500, weaponId: 'SNIPER' });
  __AQ_TEST.step(0.15);
  __AQ_TEST.redraw();
`);
snapshot('03-hero-pickup');

// Evidence 4: RIVAL pickup moment.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(180, 720, 760, 480);
  __AQ_TEST.pushSlot({ x: 760, y: 480, weaponId: 'SPIKED_CLUB' });
  __AQ_TEST.step(0.15);
  __AQ_TEST.redraw();
`);
snapshot('04-rival-pickup');

// Evidence 5: ranged attacks — sniper aim telegraph + pistol tracers.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(220, 500, 780, 500);
  __AQ_TEST.equip('HERO', 'SNIPER');
  __AQ_TEST.step(0.75);
  __AQ_TEST.redraw();
`);
snapshot('05-ranged-sniper-aim');
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(220, 500, 780, 500);
  __AQ_TEST.equip('RIVAL', 'PISTOL');
  __AQ_TEST.step(0.62);
  __AQ_TEST.redraw();
`);
snapshot('05b-ranged-pistol-burst');

// Evidence 6: melee — battle axe windup + slash arc frame.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(330, 500, 520, 500);
  __AQ_TEST.equip('HERO', 'BATTLE_AXE');
  __AQ_TEST.step(0.6);
  __AQ_TEST.redraw();
`);
snapshot('06-melee-axe-swing');

// Evidence 7: shields — tower guard absorbing + swirl reflect frame.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(300, 500, 700, 500);
  __AQ_TEST.equip('HERO', 'TOWER_SHIELD');
  __AQ_TEST.step(0.4);
  APEX_ARSENAL.weaponApi.aqDamage(fighters[0], 10, fighters[1], 'TEST_PROBE');
  __AQ_TEST.redraw();
`);
snapshot('07-tower-shield-guard');
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(300, 500, 700, 500);
  __AQ_TEST.equip('RIVAL', 'SNIPER');
  __AQ_TEST.equip('HERO', 'SWIRL_SHIELD');
  __AQ_TEST.step(1.35);
  __AQ_TEST.redraw();
`);
snapshot('07b-swirl-reflect');

// Evidence 8: F3 debug overlay over a busy arena.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearSlots();
  __AQ_TEST.place(240, 620, 780, 340, false);
  for (let i = 0; i < 120; i++) __AQ_TEST.step(1/30);
  APEX_ARSENAL.state.debugOverlay = true;
  __AQ_TEST.redraw();
`);
snapshot('08-f3-debug-overlay');

// ------------------------------------- AV presentation acceptance (issue #2)
// Curated VFX/SFX bindings + lifecycle evidence. Images decode asynchronously,
// so give the preload a beat before snapshotting AV frames.
await new Promise(r => setTimeout(r, 900));

const AV = win.APEX_ARSENAL_AV;
// The engine's own asset queue can delay AV decodes; wait until the curated
// set is actually decoded before snapshotting AV frames or reading stats.
const avWaitStart = Date.now();
while (AV && (AV.imagesReady() < AV.describe().allImages.length || AV.audioReady() < AV.describe().allAudio.length) && Date.now() - avWaitStart < 20000) {
  await new Promise(r => setTimeout(r, 100));
}
gate('av-runtime-registered', !!AV && typeof AV.cue === 'function' && typeof AV.draw === 'function');

const avDescribe = AV ? AV.describe() : null;
gate('av-muzzle-uses-warm-c-family',
  !!avDescribe && Array.isArray(avDescribe.muzzleFrames) && avDescribe.muzzleFrames.length === 6
  && avDescribe.muzzleFrames.every(f => f.includes('vfx/c/muzzle_')),
  avDescribe && avDescribe.muzzleFrames);
gate('av-no-laser-charge-sfx',
  !!avDescribe && !Object.values(avDescribe.audio).flat().some(rel => String(rel).includes('laserLarge')),
  avDescribe && Object.keys(avDescribe.audio));
gate('av-asset-map-complete',
  !!avDescribe
  && ['pistol_shot', 'shotgun_shot', 'smg_shot', 'sniper_shot', 'explosion', 'sabre_swing', 'axe_swing', 'dagger_swing', 'spear_swing', 'club_swing', 'shield_activate_swirl', 'shield_activate_tower', 'reflect', 'block_heavy', 'telegraph', 'reveal', 'pickup'].every(k => (avDescribe.audio[k] || []).length > 0),
  Object.keys(avDescribe ? avDescribe.audio : {}));
gate('av-melee-contact-transients',
  !!avDescribe && ['SABRE', 'BATTLE_AXE', 'SPEAR', 'SPIKED_CLUB', 'DAGGER'].every(k => (avDescribe.melee[k] || '').includes('vfx/kenney/spark_')),
  avDescribe && avDescribe.melee);

report.av = { scheduledBefore: AV ? AV.stats.scheduled.length : 0 };
const avStats = () => win.eval('JSON.parse(JSON.stringify({ cued: APEX_ARSENAL_AV.stats.cued, scheduled: APEX_ARSENAL_AV.stats.scheduled, throttled: APEX_ARSENAL_AV.stats.throttled, imagesLoaded: APEX_ARSENAL_AV.stats.imagesLoaded, imagesFailed: APEX_ARSENAL_AV.stats.imagesFailed, audioLoaded: APEX_ARSENAL_AV.stats.audioLoaded, audioFailed: APEX_ARSENAL_AV.stats.audioFailed, active: APEX_ARSENAL_AV.activeVfx(), peak: APEX_ARSENAL_AV.stats.vfxPeak, floorSpriteDraws: APEX_ARSENAL_AV.stats.floorSpriteDraws, equippedSpriteDraws: APEX_ARSENAL_AV.stats.equippedSpriteDraws }))');

// AV evidence 1: pickup telegraph with cool neutral accent.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(240, 620, 780, 340);
  window.APEX_ARSENAL_SPAWN.trySpawnSlot();
  __AQ_TEST.step(0.5);
  __AQ_TEST.redraw();
`);
snapshot('av-01-pickup-telegraph');

// AV evidence 2: same long-hidden slot reveals only on predicted approach.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(150, 500, 900, 900);
  const id = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.5 });
  __AQ_TEST.step(6.1);
  fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0); fighters[1].baseSpeed = 0;
  __AQ_TEST.step(0.04);
  __AQ_TEST.redraw();
`);
snapshot('av-02-weapon-reveal');

// AV evidence 3: pistol firing (muzzle + gunshot bound).
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(320, 500, 640, 500);
  __AQ_TEST.equip('HERO', 'PISTOL');
  __AQ_TEST.step(0.5);
  __AQ_TEST.step(0.1);
  __AQ_TEST.redraw();
`);
snapshot('av-03-pistol-firing');

// AV evidence 4: shotgun blast.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(300, 520, 620, 520);
  __AQ_TEST.equip('HERO', 'SHOTGUN');
  __AQ_TEST.step(0.42);
  __AQ_TEST.redraw();
`);
snapshot('av-04-shotgun-firing');

// AV evidence 5: SMG burst mid-stream.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(300, 480, 660, 480);
  __AQ_TEST.equip('HERO', 'SMG');
  __AQ_TEST.step(0.5);
  __AQ_TEST.step(0.3);
  __AQ_TEST.redraw();
`);
snapshot('av-05-smg-burst');

// AV evidence 6: sniper aim window, then the shot.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(240, 500, 820, 500);
  __AQ_TEST.equip('HERO', 'SNIPER');
  __AQ_TEST.step(0.5);
  __AQ_TEST.step(0.3);
  __AQ_TEST.redraw();
`);
snapshot('av-06-sniper-aim');
run(`__AQ_TEST.step(0.37); __AQ_TEST.redraw();`);
snapshot('av-06b-sniper-shot');

// AV evidence 7: grenade explosion atlas.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(300, 500, 620, 500);
  __AQ_TEST.equip('HERO', 'GRENADE');
  __AQ_TEST.step(0.5);
  __AQ_TEST.step(2.2);
  __AQ_TEST.redraw();
`);
snapshot('av-07-grenade-explosion');

// AV evidence 8-12: melee family presentations.
const meleeScenes = [
  ['av-08-sabre-swing', 'SABRE', 0.2],
  ['av-09-battle-axe-hit', 'BATTLE_AXE', 0.6],
  ['av-10-dagger-attack', 'DAGGER', 0.12],
  ['av-11-spear-thrust', 'SPEAR', 0.28],
  ['av-12-spiked-club-hit', 'SPIKED_CLUB', 0.34],
];
for (const [name, weapon, t] of meleeScenes) {
  run(`
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.place(330, 500, 470, 500);
    __AQ_TEST.equip('HERO', '${weapon}');
    __AQ_TEST.step(${t});
    __AQ_TEST.redraw();
  `);
  snapshot(name);
}

// AV evidence 13: swirl shield reflect.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(430, 500, 700, 500);
  __AQ_TEST.equip('HERO', 'SWIRL_SHIELD');
  __AQ_TEST.equip('RIVAL', 'PISTOL');
  let guard = 0;
  while (guard++ < 200 && !APEX_ARSENAL.events.some(e => e.includes('REFLECT'))) __AQ_TEST.step(0.02);
  __AQ_TEST.step(0.05);
  __AQ_TEST.redraw();
`);
snapshot('av-13-swirl-reflect');

// AV evidence 14: tower shield block.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(320, 500, 640, 500);
  __AQ_TEST.equip('RIVAL', 'TOWER_SHIELD');
  __AQ_TEST.equip('HERO', 'SHOTGUN');
  let guard2 = 0;
  while (guard2++ < 200 && !APEX_ARSENAL.events.some(e => e.startsWith('[AQ] HIT'))) __AQ_TEST.step(0.02);
  __AQ_TEST.step(0.04);
  __AQ_TEST.redraw();
`);
snapshot('av-14-tower-shield-block');

// AV evidence 15: multiple simultaneous pickups while VFX/audio stay stable.
run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.step(10);
  __AQ_TEST.redraw();
`);
snapshot('av-15-multi-pickup-stable');

// V2 evidence 16: P1/P2 canonical shells (SNIPER vs WITCH) with body art.
run(`
  window.startArsenalQuestMode('SNIPER', 'WITCH');
  cancelAnimationFrame(reqId); reqId = 0;
  APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = [];
  __AQ_TEST.step(0.6);
  __AQ_TEST.redraw();
`);
snapshot('16-v2-shells-sniper-vs-witch');

// V2 evidence 17: movement direction unchanged while equipped weapon aims.
run(`
  window.startArsenalQuestMode('RUBBER', 'ICE');
  cancelAnimationFrame(reqId); reqId = 0;
  APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = [];
  fighters[0].x = 250; fighters[0].y = 500; fighters[1].x = 800; fighters[1].y = 500;
  fighters[0].baseSpeed = 520; fighters[0].setDir(0, 1); fighters[1].baseSpeed = 0;
  APEX_ARSENAL.weaponApi.equip(fighters[0], 'SNIPER');
  __AQ_TEST.step(0.45); // sniper aiming right while body travels down
  __AQ_TEST.redraw();
`);
snapshot('17-v2-aim-independent-of-movement');

// V2 evidence 18: strict centerline reveal — aligned path reveals at <=1.0s.
run(`
  window.startArsenalQuestMode('RUBBER', 'ICE');
  cancelAnimationFrame(reqId); reqId = 0;
  APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = [];
  fighters[0].x = 400; fighters[0].y = 500; fighters[1].x = 900; fighters[1].y = 150;
  fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
  __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.0 });
  fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
  __AQ_TEST.step(0.1);
  __AQ_TEST.redraw();
`);
snapshot('18-v2-centerline-reveal');

// V2 evidence 19: grazing trajectory (70px off-center) stays a hidden telegraph.
run(`
  window.startArsenalQuestMode('RUBBER', 'ICE');
  cancelAnimationFrame(reqId); reqId = 0;
  APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = [];
  fighters[0].x = 400; fighters[0].y = 500; fighters[1].x = 900; fighters[1].y = 150;
  fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
  __AQ_TEST.pushSlot({ x: 850, y: 570, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.0 });
  fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
  __AQ_TEST.step(0.8); // hero is now beside the slot, 70px off its centerline
  __AQ_TEST.redraw();
`);
snapshot('19-v2-graze-stays-hidden');

report.av.after = avStats();
gate('av-assets-preloaded',
  report.av.after.imagesLoaded === avDescribe.allImages.length && report.av.after.audioLoaded === avDescribe.allAudio.length,
  { images: `${report.av.after.imagesLoaded}/${avDescribe.allImages.length}`, audio: `${report.av.after.audioLoaded}/${avDescribe.allAudio.length}`, imgFail: report.av.after.imagesFailed, sfxFail: report.av.after.audioFailed });
gate('weapon-cset-floor-sprite-rendered', report.av.after.floorSpriteDraws > 0, `draws=${report.av.after.floorSpriteDraws}`);
gate('weapon-cset-equipped-sprite-rendered', report.av.after.equippedSpriteDraws > 0, `draws=${report.av.after.equippedSpriteDraws}`);
gate('weapon-cset-all-12-authored',
  !!avDescribe && ['PISTOL', 'SHOTGUN', 'SMG', 'SNIPER', 'GRENADE', 'SABRE', 'BATTLE_AXE', 'DAGGER', 'SPEAR', 'SPIKED_CLUB', 'SWIRL_SHIELD', 'TOWER_SHIELD']
    .every(id => String(avDescribe.weaponSet[id] || '').includes('weapons/c/')),
  avDescribe && Object.keys(avDescribe.weaponSet || {}));
gate('c-projectile-speeds-v2', (() => {
  const W = win.APEX_ARSENAL_CONFIG.WEAPONS;
  return W.PISTOL.bulletSpeed >= 2400 && W.PISTOL.bulletSpeed <= 2800
    && W.SMG.bulletSpeed >= 2800 && W.SMG.bulletSpeed <= 3400
    && W.SHOTGUN.bulletSpeed >= 2200 && W.SHOTGUN.bulletSpeed <= 2800 && W.SHOTGUN.bulletLife <= 0.25
    && W.SNIPER.bulletSpeed >= 5000 && W.SNIPER.bulletSpeed <= 6500;
})(), win.eval('JSON.stringify({p: APEX_ARSENAL_CONFIG.WEAPONS.PISTOL.bulletSpeed, s: APEX_ARSENAL_CONFIG.WEAPONS.SMG.bulletSpeed, g: APEX_ARSENAL_CONFIG.WEAPONS.SHOTGUN.bulletSpeed, n: APEX_ARSENAL_CONFIG.WEAPONS.SNIPER.bulletSpeed})'));
gate('av-telegraph-audio-bound', report.av.after.scheduled.some(s => s.rel === 'sfx/scifi/forceField_001.ogg'));
gate('av-reveal-audio-bound', report.av.after.scheduled.some(s => s.rel === 'sfx/rpg/metalClick.ogg'));
gate('av-pickup-audio-bound', report.av.after.scheduled.some(s => s.rel === 'sfx/rpg/metalLatch.ogg'));
gate('av-all-12-weapons-cued', (() => {
  const c = report.av.after.cued;
  const has = (ev, w) => c.some(e => e.event === ev && (!w || e.weapon === w));
  return has('fire', 'PISTOL') && has('fire', 'SHOTGUN') && has('fire', 'SMG')
    && has('sniper_aim') && has('sniper_shot') && has('grenade_throw') && has('explosion')
    && has('melee_swing', 'SABRE') && has('melee_swing', 'BATTLE_AXE') && has('melee_swing', 'DAGGER')
    && has('melee_swing', 'SPEAR') && has('melee_swing', 'SPIKED_CLUB')
    && ['SABRE', 'BATTLE_AXE', 'DAGGER', 'SPEAR', 'SPIKED_CLUB'].every(w => has('melee_hit', w))
    && c.some(e => e.event === 'shield_activate' && e.weapon === 'SWIRL_SHIELD')
    && c.some(e => e.event === 'shield_activate' && e.weapon === 'TOWER_SHIELD')
    && has('reflect') && has('tower_block');
})(), report.av.after.cued.filter(e => ['melee_swing', 'melee_hit', 'shield_activate', 'reflect', 'tower_block', 'sniper_aim', 'explosion'].includes(e.event)).length);
gate('av-smg-shots-trimmed', (() => {
  const smg = report.av.after.scheduled.filter(s => s.rel.endsWith('sks.wav'));
  return smg.length >= 8 && smg.every(s => s.dur && s.dur <= 0.3);
})(), report.av.after.scheduled.filter(s => s.rel.endsWith('sks.wav')).slice(0, 3));
gate('av-smg-voice-cap-enforced', (report.av.after.throttled['sfx/guns/sks.wav'] || 0) >= 1, report.av.after.throttled);
gate('av-mosin-pistol-trimmed', report.av.after.scheduled.filter(s => s.rel.endsWith('cz.wav')).every(s => s.dur <= 0.9)
  && report.av.after.scheduled.filter(s => s.rel.endsWith('mosin.wav')).every(s => s.dur <= 1.8));
gate('av-vfx-expire-no-leak', (() => {
  run(`__AQ_TEST.holdSpawns(); __AQ_TEST.clearSlots(); __AQ_TEST.step(3);`);
  return AV.activeVfx() === 0 && report.av.after.peak > 0;
})(), { activeAfterQuiet: AV.activeVfx(), peak: report.av.after.peak });
gate('av-no-asset-load-failures', report.av.after.imagesFailed === 0 && report.av.after.audioFailed === 0);

// -------------------------------------------------- gate: 5-minute simulation
report.fiveMinute = (() => {
  const started = Date.now();
  const out = run(`
    __AQ_TEST.enterManual();
    let error = null, koCount = 0, restarts = 0, spawnedCumulative = 0;
    const dt = 1/30;
    const totalSteps = Math.round(300 / dt);
    const leadSamples = [];
    try {
      for (let i = 0; i < totalSteps; i++) {
        APEX_ARSENAL.step(dt);
        for (const s of APEX_ARSENAL.state.slots) if (s.phase === 'TELEGRAPH' && s.revealLeadSeconds != null) leadSamples.push(s.revealLeadSeconds);
        if (APEX_ARSENAL.state.over) {
          spawnedCumulative += __AQ_TEST.debug().spawnedTotal;
          koCount++; restarts++;
          window.startArsenalQuestMode();
          cancelAnimationFrame(reqId); reqId = 0;
        }
      }
    } catch (e) { error = String(e && e.stack || e); }
    spawnedCumulative += __AQ_TEST.debug().spawnedTotal;
    const d = __AQ_TEST.debug();
    return {
      error, koCount, restarts,
      spawnedTotal: d.spawnedTotal,
      spawnedCumulative,
      // A-CORR-2: fixed 2.0s whole-circle reveal lead on every telegraph, forever.
      leadSamplesFixedOne: leadSamples.length > 100 && leadSamples.every(v => Math.abs(v - 2.0) < 1e-9),
      leadSampleCount: leadSamples.length,
      earlyErrors: __AQ_TEST.earlyErrors(),
    };
  `);
  out.wallClockMs = Date.now() - started;
  return out;
})();
gate('five-minute-no-uncaught-errors',
  report.fiveMinute.error === null && report.fiveMinute.earlyErrors.length === 0,
  `steps=9000 (300s @30Hz) kos=${report.fiveMinute.koCount} spawnedCumulative=${report.fiveMinute.spawnedCumulative} wallClock=${report.fiveMinute.wallClockMs}ms earlyErrors=${report.fiveMinute.earlyErrors.length}`);
gate('reveal-lead-fixed-over-5min', report.fiveMinute.leadSamplesFixedOne, `samples=${report.fiveMinute.leadSampleCount}`);

// ----------------------------------------- gate: V2 §A1 — aim never steers body
report.aimLaw = run(`
  const out = {};
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(200, 500, 800, 500);
  // Fighter commits to a vertical trajectory while the enemy sits horizontal:
  // any weapon steering would bend dir toward the enemy.
  fighters[0].baseSpeed = 520; fighters[0].setDir(0, 1); fighters[1].baseSpeed = 0;
  const d0 = { x: fighters[0].dir.x, y: fighters[0].dir.y };
  const p0 = { x: fighters[0].x, y: fighters[0].y };
  __AQ_TEST.equip('HERO', 'SNIPER');
  __AQ_TEST.step(0.5); // full live-aim window
  out.aimDirSame = fighters[0].dir.x === d0.x && fighters[0].dir.y === d0.y;
  out.aimKeptApexTrajectory = Math.abs(fighters[0].y - (p0.y + 260)) < 8 && Math.abs(fighters[0].x - p0.x) < 1e-6;
  out.aimAngleTrackedEnemy = (() => {
    const h = APEX_ARSENAL.weaponApi.getHolder(fighters[0]);
    return h && h.meta && h.meta.aimAngle != null;
  })();
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(200, 500, 800, 500);
  fighters[0].baseSpeed = 520; fighters[0].setDir(0, 1); fighters[1].baseSpeed = 0;
  const q0 = { x: fighters[0].dir.x, y: fighters[0].dir.y };
  __AQ_TEST.equip('HERO', 'PISTOL');
  __AQ_TEST.step(0.8); // three shots while moving
  out.fireDirSame = fighters[0].dir.x === q0.x && fighters[0].dir.y === q0.y;
  return out;
`);
gate('aim-never-steers-fighter',
  report.aimLaw.aimDirSame && report.aimLaw.aimKeptApexTrajectory && report.aimLaw.fireDirSame && report.aimLaw.aimAngleTrackedEnemy,
  report.aimLaw);

// ----------------------------------------- gate: V2 §A1 — dagger body stays put
report.daggerLaw = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.clearEvents();
  __AQ_TEST.place(500, 500, 700, 500); // 200px apart, inside dagger trigger range
  fighters[0].baseSpeed = 520; fighters[0].setDir(0, 1); fighters[1].baseSpeed = 0;
  const p0 = { x: fighters[0].x, y: fighters[0].y };
  __AQ_TEST.equip('HERO', 'DAGGER');
  __AQ_TEST.step(0.2);
  const dx = fighters[0].x - p0.x;
  const dy = fighters[0].y - p0.y;
  return {
    dx, dy,
    bodyKeptTrajectory: Math.abs(dy - 104) < 12 && Math.abs(dx) < 1e-6,
    thrustConnected: __AQ_TEST.countEvents('CONSUME', 'stab-landed') >= 1,
  };
`);
gate('dagger-no-body-dash', report.daggerLaw.bodyKeptTrajectory, report.daggerLaw);
gate('dagger-weapon-only-thrust-hits', report.daggerLaw.thrustConnected, report.daggerLaw);

// ------------------- gates: Checkpoint B — 12 weapon motion signatures (pose law)
report.motion = run(`
  const out = {};
  const api = APEX_ARSENAL.weaponApi;
  const hero = () => fighters[0];
  function fresh(weaponId, gap) {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(300, 500, 300 + (gap || 260), 500); // frozen fighters
    hero().data.arsenal = null;
    hero().data.arsenalFade = null;
    __AQ_TEST.equip('HERO', weaponId);
    return api.getHolder(hero());
  }
  const poseOf = () => { const h = api.getHolder(hero()); return h ? h.meta.pose : null; };
  const ghostOf = () => hero().data.arsenalFade || null;
  const bodySnapshot = () => ({ x: hero().x, y: hero().y, dx: hero().dir.x, dy: hero().dir.y });
  const sameBody = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6
    && Math.abs(a.dx - b.dx) < 1e-6 && Math.abs(a.dy - b.dy) < 1e-6;

  // B1 PISTOL — 3 countable recoil pulses, 12-16px, fast spring.
  {
    fresh('PISTOL');
    const b0 = bodySnapshot();
    let pulses = 0, maxRecoil = 0, maxRot = 0, lastPulses = -1;
    for (let i = 0; i < 90; i++) {
      __AQ_TEST.step(1 / 60);
      const p = poseOf();
      if (p) {
        if (p.pulses > lastPulses) { lastPulses = p.pulses; pulses = p.pulses; }
        maxRecoil = Math.max(maxRecoil, p.recoil);
        maxRot = Math.max(maxRot, Math.abs(p.rotKick));
      }
    }
    out.pistol = { pulses, maxRecoil: +maxRecoil.toFixed(1), maxRot: +maxRot.toFixed(3), bodySame: sameBody(b0, bodySnapshot()) };
  }
  // B2 SHOTGUN — one heavy 24-32px recoil with slow settle (visible on ghost).
  {
    fresh('SHOTGUN', 200);
    const b0 = bodySnapshot();
    let ghostRecoil = 0, ghostRot = 0;
    for (let i = 0; i < 40; i++) {
      __AQ_TEST.step(1 / 60);
      const g = ghostOf();
      if (g) { ghostRecoil = Math.max(ghostRecoil, g.pose.recoil); ghostRot = Math.max(ghostRot, Math.abs(g.pose.rotKick)); }
    }
    out.shotgun = { ghostRecoil: +ghostRecoil.toFixed(1), ghostRot: +ghostRot.toFixed(3), bodySame: sameBody(b0, bodySnapshot()) };
  }
  // B3 SMG — 8 micro pulses with alternating rotational jitter.
  {
    fresh('SMG');
    const b0 = bodySnapshot();
    let lastPulses = -1, pulses = 0, signFlips = 0, lastSign = 0, maxRecoil = 0;
    for (let i = 0; i < 120; i++) {
      __AQ_TEST.step(1 / 60);
      const p = poseOf();
      if (p) {
        if (p.pulses > lastPulses) {
          lastPulses = p.pulses; pulses = p.pulses;
          const s = Math.sign(p.rotKick);
          if (s !== 0 && lastSign !== 0 && s !== lastSign) signFlips++;
          if (s !== 0) lastSign = s;
        }
        maxRecoil = Math.max(maxRecoil, p.recoil);
      }
    }
    out.smg = { pulses, signFlips, maxRecoil: +maxRecoil.toFixed(1), bodySame: sameBody(b0, bodySnapshot()) };
  }
  // B4 SNIPER — flourish spin in latter aim, snap to 0 at fire, long recoil.
  {
    fresh('SNIPER');
    const b0 = bodySnapshot();
    let midFlourish = 0, ghostRecoil = 0, sawAim = false, chambered = false;
    for (let i = 0; i < 240; i++) {
      __AQ_TEST.step(1 / 60);
      const h = api.getHolder(hero());
      if (h && h.phase === 'AIM') { sawAim = true; chambered = chambered || !!h.meta.chambered; midFlourish = Math.max(midFlourish, h.meta.pose.flourish); }
      const g = ghostOf();
      if (g) ghostRecoil = Math.max(ghostRecoil, g.pose.recoil);
    }
    out.sniper = { sawAim, chambered, midFlourish: +midFlourish.toFixed(2), ghostRecoil: +ghostRecoil.toFixed(1), bodySame: sameBody(b0, bodySnapshot()) };
  }
  // B5 GRENADE — backward draw while ready, forward throw after release.
  {
    fresh('GRENADE');
    const b0 = bodySnapshot();
    let drawSeen = false;
    for (let i = 0; i < 25; i++) { __AQ_TEST.step(1 / 60); const p = poseOf(); if (p && p.localX < -8) drawSeen = true; }
    let throwFwd = 0;
    for (let i = 0; i < 45; i++) { __AQ_TEST.step(1 / 60); const g = ghostOf(); if (g) throwFwd = Math.max(throwFwd, g.pose.localX); }
    out.grenade = { drawSeen, throwFwd: +throwFwd.toFixed(1), bodySame: sameBody(b0, bodySnapshot()) };
  }
  // B6/B7/B10 melee windup -> strike snap with per-weapon easing.
  for (const id of ['SABRE', 'BATTLE_AXE', 'SPIKED_CLUB']) {
    fresh(id, 200);
    const b0 = bodySnapshot();
    let windupRot = 0, strikeRot = 0, lift = 0;
    for (let i = 0; i < 150; i++) {
      __AQ_TEST.step(1 / 60);
      const p = poseOf();
      if (p) { windupRot = Math.min(windupRot, p.rotKick); lift = Math.min(lift, p.localY); }
      const g = ghostOf();
      if (g) strikeRot = Math.max(strikeRot, g.pose.rotKick);
    }
    out[id.toLowerCase()] = { windupRot: +windupRot.toFixed(2), strikeRot: +strikeRot.toFixed(2), lift: +lift.toFixed(1), bodySame: sameBody(b0, bodySnapshot()) };
  }
  // B8 DAGGER — weapon-only 60-90px thrust, body untouched.
  {
    fresh('DAGGER', 190);
    const b0 = bodySnapshot();
    let peak = 0;
    for (let i = 0; i < 90; i++) { __AQ_TEST.step(1 / 60); const p = poseOf(); if (p) peak = Math.max(peak, p.localX); const g = ghostOf(); if (g) peak = Math.max(peak, g.pose.localX); }
    out.dagger = { peakThrust: +peak.toFixed(1), bodySame: sameBody(b0, bodySnapshot()) };
  }
  // B9 SPEAR — long narrow 90-120px thrust with controlled return.
  {
    fresh('SPEAR', 320);
    const b0 = bodySnapshot();
    let peak = 0;
    for (let i = 0; i < 150; i++) { __AQ_TEST.step(1 / 60); const p = poseOf(); if (p) peak = Math.max(peak, p.localX); const g = ghostOf(); if (g) peak = Math.max(peak, g.pose.localX); }
    out.spear = { peakThrust: +peak.toFixed(1), bodySame: sameBody(b0, bodySnapshot()) };
  }
  // B11 SWIRL SHIELD — idle settle oscillation + forward pop on reflect.
  {
    fresh('SWIRL_SHIELD');
    const b0 = bodySnapshot();
    let lastSign = 0, flips = 0, popRecoil = 0;
    for (let i = 0; i < 100; i++) { __AQ_TEST.step(1 / 60); const p = poseOf(); if (p && p.rotKick !== 0) { const s = Math.sign(p.rotKick); if (lastSign !== 0 && s !== lastSign) flips++; lastSign = s; } }
    // Force a reflect: fire a hostile bullet at the hero.
    const rival = fighters[1];
    api.fireBullet({ owner: rival, x: rival.x - 60, y: rival.y, angle: Math.PI, speed: 500, damage: 4, weapon: 'PISTOL' });
    for (let i = 0; i < 60; i++) { __AQ_TEST.step(1 / 60); const g = ghostOf(); if (g) popRecoil = Math.min(popRecoil, g.pose.recoil); }
    out.swirl = { idleFlips: flips, popRecoil: +popRecoil.toFixed(1), bodySame: sameBody(b0, bodySnapshot()) };
  }
  // B12 TOWER SHIELD — forward guard pose + shield-only block pushback.
  {
    fresh('TOWER_SHIELD');
    const b0 = bodySnapshot();
    let guardX = 0;
    for (let i = 0; i < 30; i++) { __AQ_TEST.step(1 / 60); const p = poseOf(); if (p) guardX = Math.max(guardX, p.localX); }
    const rival = fighters[1];
    api.aqDamage(hero(), 10, rival, 'PISTOL', {});
    const p2 = poseOf();
    out.tower = { guardX: +guardX.toFixed(1), blockRecoil: p2 ? +p2.recoil.toFixed(1) : 0, blockRot: p2 ? +p2.rotKick.toFixed(2) : 0, bodySame: sameBody(b0, bodySnapshot()) };
  }
  // Recipe table sanity (heavier weapons settle slower than blades).
  out.recipes = {
    axeSlowerThanSabre: api.poseRecipe('BATTLE_AXE').returnTau > api.poseRecipe('SABRE').returnTau,
    clubSlowerThanSabre: api.poseRecipe('SPIKED_CLUB').returnTau > api.poseRecipe('SABRE').returnTau,
    distinct: new Set(['PISTOL','SHOTGUN','SMG','SNIPER','GRENADE','SABRE','BATTLE_AXE','DAGGER','SPEAR','SPIKED_CLUB','SWIRL_SHIELD','TOWER_SHIELD']
      .map(id => JSON.stringify(api.poseRecipe(id)))).size === 12,
  };
  return out;
`);
gate('motion-pistol-3-pulses-12-16px',
  report.motion.pistol.pulses === 3 && report.motion.pistol.maxRecoil >= 12 && report.motion.pistol.maxRecoil <= 16
    && report.motion.pistol.maxRot > 0 && report.motion.pistol.bodySame,
  report.motion.pistol);
gate('motion-shotgun-heavy-recoil-24-32px',
  report.motion.shotgun.ghostRecoil >= 24 && report.motion.shotgun.ghostRecoil <= 32
    && report.motion.shotgun.ghostRot > 0.15 && report.motion.shotgun.bodySame,
  report.motion.shotgun);
gate('motion-smg-8-pulses-alternating',
  report.motion.smg.pulses === 8 && report.motion.smg.signFlips >= 4
    && report.motion.smg.maxRecoil >= 8 && report.motion.smg.maxRecoil <= 12 && report.motion.smg.bodySame,
  report.motion.smg);
gate('motion-sniper-flourish-then-snap',
  report.motion.sniper.sawAim && report.motion.sniper.chambered
    && report.motion.sniper.midFlourish > Math.PI && report.motion.sniper.ghostRecoil >= 30
    && report.motion.sniper.bodySame,
  report.motion.sniper);
gate('motion-grenade-draw-then-throw',
  report.motion.grenade.drawSeen && report.motion.grenade.throwFwd > 20 && report.motion.grenade.bodySame,
  report.motion.grenade);
gate('motion-sabre-backswing-cut',
  report.motion.sabre.windupRot < -0.5 && report.motion.sabre.strikeRot > 0.2 && report.motion.sabre.bodySame,
  report.motion.sabre);
gate('motion-axe-raise-chop-slower-recovery',
  report.motion.battle_axe.windupRot < -0.8 && report.motion.battle_axe.lift < -5
    && report.motion.battle_axe.strikeRot > 0.4 && report.motion.battle_axe.bodySame
    && report.motion.recipes.axeSlowerThanSabre,
  report.motion.battle_axe);
gate('motion-club-blunt-smash-heavier-easing',
  report.motion.spiked_club.windupRot < -0.6 && report.motion.spiked_club.strikeRot > 0.3
    && report.motion.spiked_club.bodySame && report.motion.recipes.clubSlowerThanSabre,
  report.motion.spiked_club);
gate('motion-dagger-thrust-60-90px',
  report.motion.dagger.peakThrust >= 60 && report.motion.dagger.peakThrust <= 90 && report.motion.dagger.bodySame,
  report.motion.dagger);
gate('motion-spear-thrust-90-120px',
  report.motion.spear.peakThrust >= 90 && report.motion.spear.peakThrust <= 120 && report.motion.spear.bodySame,
  report.motion.spear);
gate('motion-swirl-idle-settle-reflect-pop',
  report.motion.swirl.idleFlips >= 2 && report.motion.swirl.popRecoil <= -14 && report.motion.swirl.bodySame,
  report.motion.swirl);
gate('motion-tower-guard-pose-block-pushback',
  report.motion.tower.guardX >= 8 && report.motion.tower.blockRecoil >= 10
    && report.motion.tower.blockRot >= 0.1 && report.motion.tower.bodySame,
  report.motion.tower);
gate('motion-12-distinct-recipes', report.motion.recipes.distinct, report.motion.recipes);


// ----------------------------------------- gate: V2 §A3 — 32 canonical shells
report.shells = run(`
  const shells = window.APEX_ARSENAL_SHELLS;
  const ids = shells ? shells.ids : [];
  window.startArsenalQuestMode('SNIPER', 'WITCH');
  cancelAnimationFrame(reqId); reqId = 0;
  APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = [];
  const names = fighters.map(f => f.name);
  const shellFlags = fighters.map(f => !!f.type.arsenalShell);
  const speedOk = fighters.every(f => f.type.speed === APEX_ARSENAL_CONFIG.FIGHTER_SPEED);
  const drawFns = fighters.map(f => typeof f.type.draw === 'function');
  let nativeProj = 0;
  for (let i = 0; i < 180; i++) {
    APEX_ARSENAL.step(1 / 60);
    nativeProj = Math.max(nativeProj, projectiles.filter(p => !p.aq).length);
  }
  return {
    count: ids.length,
    allResolvable: ids.every(n => !!shells.typeFor(n)),
    names, shellFlags, speedOk, drawFns, nativeProj,
    hp: [fighters[0].hp, fighters[1].hp],
    rage: fighters.some(f => f.isRage),
  };
`);
gate('shells-32-canonical', report.shells.count === 32 && report.shells.allResolvable, { count: report.shells.count });
gate('shells-p1-p2-independent',
  report.shells.names[0] === 'SNIPER' && report.shells.names[1] === 'WITCH'
    && report.shells.shellFlags.every(Boolean) && report.shells.drawFns.every(Boolean),
  report.shells.names);
gate('shells-native-kits-active-in-arsenal',
  report.shells.nativeProj >= 1 && !report.shells.rage
    && report.shells.hp.every(h => h > 0 && h <= 100) && report.shells.speedOk,
  { nativeProj: report.shells.nativeProj, hp: report.shells.hp });

// ------------------------- gates: A-CORR-3 roster compatibility (matrix proof)
report.roster = run(`
  const shells = window.APEX_ARSENAL_SHELLS;
  const ids = shells.ids;
  const kits = {};
  for (const n of ids) kits[n] = (shells.typeFor(n) || {}).compatKit || 'MISSING';
  const allClassified = ids.every(n => kits[n] === 'KEEP' || kits[n] === 'ADAPT');
  const adapted = ids.filter(n => kits[n] === 'ADAPT');

  // KEEP proof: ICE shell natively casts its frost lane inside Arsenal.
  const ice = shells.typeFor('ICE');
  projectiles.length = 0;
  const iceF = {
    name: 'ICE', id: 101, data: {}, x: 300, y: 300, radius: 75, baseRadius: 75,
    hp: 100, maxHp: 100, isRage: false, statuses: {},
    cooldownRate: () => 1,
    hasStatus: () => false, applyStatus() {}, takeDamage() {}, heal() {}, setDir() {},
  };
  ice.init(iceF);
  ice.update(iceF, { x: 700, y: 700, y2: 0 }, 1.6); // cd 1.5 -> lane fires
  const iceLaneFired = projectiles.some(p => p.type === 'ice_lane');

  // ADAPT proof: VAMPIRE latch shortened to 2.5s for shell fighters.
  const vamp = shells.typeFor('VAMPIRE');
  const vf = { type: vamp, data: {}, x: 500, y: 500, radius: 75, isRage: false, hasStatus: () => false };
  vamp.init(vf);
  vf.data.latchCd = 0; vf.data.latchTimer = 0;
  vamp.onCollide(vf, { id: 2, x: 560, y: 500, radius: 75, applyStatus() {}, takeDamage() {}, heal() {}, hasStatus: () => false, statuses: {} });
  const vampLatch = vf.data.latchTimer;

  // ADAPT proof: MONK trauma rush/stun capped at 2.5s for shell fighters.
  const monk = shells.typeFor('MONK');
  const monkBase = (typeof FighterTypes !== 'undefined' && FighterTypes.find(t => t.name === 'MONK')) || null;
  const mf = { type: monk, data: {}, x: 400, y: 400, radius: 75, isRage: false, hasStatus: () => false, setDir() {}, heal() {} };
  monk.init(mf);
  const me = {
    id: 9, x: 460, y: 400, radius: 75, hp: 100, maxHp: 100, statuses: {},
    applyStatus(k, t) { this.statuses[k] = { timer: t }; },
    takeDamage() {}, hasStatus: () => false, data: {},
  };
  for (let i = 0; i < 4; i++) { mf.data.hitCd = 0; monk.onCollide(mf, me); }
  const monkRush = mf.data.rushTimer;
  const monkStun = me.statuses.stun ? me.statuses.stun.timer : null;

  // Coexistence proof: native skill + equipped Arsenal weapon at the same time.
  window.startArsenalQuestMode('WITCH', 'ICE');
  cancelAnimationFrame(reqId); reqId = 0;
  APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = [];
  projectiles.length = 0;
  __AQ_TEST.equip('HERO', 'PISTOL');
  let nativeSeen = 0, aqSeen = 0, bothFrames = 0;
  for (let i = 0; i < 240; i++) {
    fighters.forEach(q => { if (q) q.hp = q.maxHp; }); // nobody KOs during the proof
    APEX_ARSENAL.step(1 / 60);
    const nat = projectiles.some(p => !p.aq && p.type === 'witch_ray');
    const aq = projectiles.some(p => p.aq);
    if (nat) nativeSeen++;
    if (aq) aqSeen++;
    if (nat && aq) bothFrames++;
  }
  // P1 is the WITCH shell here (names follow the selected shells, not HERO/RIVAL).
  const holderIntact = !!APEX_ARSENAL.weaponApi.getHolder(fighters[0])
    || __AQ_TEST.countEvents('USE', 'fighter=WITCH') >= 1;
  return {
    kits, allClassified, adapted,
    iceLaneFired, vampLatch, monkRush, monkStun,
    nativeSeen, aqSeen, bothFrames, holderIntact,
  };
`);
gate('roster-all-32-classified-keep-or-adapt',
  report.roster.allClassified && Object.keys(report.roster.kits).length === 32
    && report.roster.adapted.join(',') === 'VAMPIRE,MONK',
  { adapted: report.roster.adapted, kits: Object.values(report.roster.kits).join('/') });
gate('roster-keep-native-skill-runs', report.roster.iceLaneFired,
  { iceLaneFired: report.roster.iceLaneFired });
gate('roster-adapt-vampire-latch-2.5', report.roster.vampLatch === 2.5, `latchTimer=${report.roster.vampLatch}`);
gate('roster-adapt-monk-rush-2.5',
  report.roster.monkRush === 2.5 && (report.roster.monkStun == null || report.roster.monkStun <= 2.5),
  { rush: report.roster.monkRush, stun: report.roster.monkStun });
gate('roster-native-skill-and-weapon-coexist',
  report.roster.nativeSeen > 0 && report.roster.aqSeen > 0 && report.roster.holderIntact,
  { nativeFrames: report.roster.nativeSeen, aqFrames: report.roster.aqSeen, bothFrames: report.roster.bothFrames });

// ----------------------------------------- gate: V2 §A4 — slash VFX absent, bomb stays
report.noSlash = run(`
  const av = window.APEX_ARSENAL_AV;
  const seqBefore = av.stats.seqAnimsPushed || 0;
  __AQ_TEST.enterManual();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(500, 500, 650, 500);
  __AQ_TEST.equip('HERO', 'SABRE');
  __AQ_TEST.step(0.5);
  __AQ_TEST.equip('RIVAL', 'BATTLE_AXE');
  __AQ_TEST.step(0.8);
  __AQ_TEST.equip('RIVAL', 'SWIRL_SHIELD');
  __AQ_TEST.equip('HERO', 'PISTOL');
  __AQ_TEST.step(1.0);
  const seqAfter = av.stats.seqAnimsPushed || 0;
  let atlasAfter = av.stats.atlasCued || 0;
  __AQ_TEST.equip('HERO', 'GRENADE');
  for (let i = 0; i < 150; i++) APEX_ARSENAL.step(1 / 60);
  return {
    seqBefore, seqAfter,
    noSlashSeq: seqBefore === 0 && seqAfter === 0,
    bombAtlas: (av.stats.atlasCued || 0) > atlasAfter || (av.stats.atlasCued || 0) >= 1,
  };
`);
gate('no-slash-vfx-in-combat', report.noSlash.noSlashSeq, report.noSlash);
gate('bomb-explosion-vfx-remains', report.noSlash.bombAtlas, report.noSlash);

// ------------------------------------- gates: Checkpoint C combat language
run(`
  window.startArsenalQuestMode();
  cancelAnimationFrame(reqId); reqId = 0;
  __AQ_TEST.step(2);
  __AQ_TEST.redraw();
`);
snapshot('20-chamber01-arena');

run(`
  window.startArsenalQuestMode();
  cancelAnimationFrame(reqId); reqId = 0;
  __AQ_TEST.place(300, 500, 640, 500);
  __AQ_TEST.equip('HERO', 'GRENADE');
  for (let i = 0; i < 12; i++) APEX_ARSENAL.step(1 / 60);
  __AQ_TEST.redraw();
`);
snapshot('21a-grenade-equipped');
run(`
  for (let i = 0; i < 26; i++) APEX_ARSENAL.step(1 / 60);
  __AQ_TEST.redraw();
`);
snapshot('21b-grenade-in-flight');

report.cCasing = run(`
  window.startArsenalQuestMode();
  cancelAnimationFrame(reqId); reqId = 0;
  __AQ_TEST.place(240, 500, 760, 500);
  __AQ_TEST.equip('HERO', 'PISTOL');
  for (let i = 0; i < 90; i++) APEX_ARSENAL.step(1 / 60);
  const cued = APEX_ARSENAL_AV.stats.cued;
  return { casing: cued.some(c => c.event === 'casing') };
`);
gate('c-casing-ejected-on-fire', report.cCasing.casing, report.cCasing);

report.cNative = run(`
  window.startArsenalQuestMode();
  cancelAnimationFrame(reqId); reqId = 0;
  __AQ_TEST.step(0.1);
  const t = fighters[1];
  const h0 = t.hp;
  t.takeDamage(10, fighters[0], 'galaxy-divine', false);
  const nativeDealt = +(h0 - t.hp).toFixed(2);
  const h1 = t.hp;
  t.takeDamage(10, fighters[0], 'arsenal-pistol', false);
  const weaponDealt = +(h1 - t.hp).toFixed(2);
  return { nativeDealt, weaponDealt, telemetry: APEX_ARSENAL.state.dmg };
`);
// The engine applies a small global damage scale to everything, so assert the
// RATIO: blast-labeled native damage must realize at exactly 0.5x of an
// equal-amount arsenal hit, and the arsenal hit must be unscaled-relative.
gate('c-native-damage-normalized',
  Math.abs(report.cNative.nativeDealt - 0.5 * report.cNative.weaponDealt) < 0.01 && report.cNative.weaponDealt > 9,
  report.cNative);
gate('c-power-telemetry-live',
  !!report.cNative.telemetry && report.cNative.telemetry.weapon >= 10 && report.cNative.telemetry.native >= 5,
  report.cNative.telemetry);

// ------------------------------------------------------- gate: structured log
report.logSample = run(`
  // Self-contained organic window so every lifecycle kind is present regardless
  // of earlier event-ring clears.
  window.startArsenalQuestMode();
  cancelAnimationFrame(reqId); reqId = 0;
  __AQ_TEST.clearEvents();
  const kinds = ['SPAWN_SLOT', 'REVEAL', 'PICKUP', 'USE', 'HIT', 'CONSUME'];
  const out = {};
  // The event ring trims to 160 lines, so scan it every second of sim time and
  // keep the first sighting of each lifecycle kind.
  for (let s = 0; s < 60; s++) {
    __AQ_TEST.step(1);
    for (const e of APEX_ARSENAL.events) {
      const m = e.match(/^\\[AQ\\] ([A-Z_]+)/);
      if (m && kinds.includes(m[1]) && !out[m[1]]) out[m[1]] = e;
    }
  }
  for (const k of kinds) if (!out[k]) out[k] = null;
  return out;
`);
gate('structured-aq-events', Object.values(report.logSample).every(Boolean), report.logSample);

// ------------------------------------------------------------------- summary
report.summary = {
  total: Object.keys(report.gates).length,
  passed: Object.values(report.gates).filter(g => g.pass).length,
  failed: report.failures,
};
console.log('\n==== ARSENAL QUEST HEADLESS TEST SUMMARY ====');
console.log(JSON.stringify(report.summary, null, 2));
if (loadErrors.length) console.log('non-fatal boot runtime load errors:', JSON.stringify(loadErrors, null, 2));
fs.writeFileSync(path.join(evidenceDir, 'headless-test-report.json'), JSON.stringify(report, null, 2));
console.log(`report+evidence written under ${evidenceDir}/`);
if (report.failures.length) process.exitCode = 1;
