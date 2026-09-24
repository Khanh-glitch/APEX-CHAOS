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

// ------------------------------------------------------------- gate: spawn law
report.spawnLaw = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearSlots();
  __AQ_TEST.clearEvents();
  // Frozen, far fighters prove that spawn cadence is independent while slots
  // remain identity-hidden indefinitely.
  __AQ_TEST.place(90, 90, 910, 910);
  const leads = {};
  for (let t = 0; t < 10; t += 0.1) {
    __AQ_TEST.step(0.1);
    for (const slot of APEX_ARSENAL.state.slots) {
      if (slot.phase === 'TELEGRAPH') leads[slot.id] = slot.revealLeadSeconds;
    }
  }
  const d = __AQ_TEST.debug();
  const leadValues = Object.values(leads);
  return {
    spawnedTotal: d.spawnedTotal,
    maxActive: d.maxActiveSlots,
    leadValues,
    leadsInRange: leadValues.length >= 3 && leadValues.every(v => v >= 1.2 && v <= 1.8),
    spawnEvents: __AQ_TEST.countEvents('SPAWN_SLOT'),
    revealEvents: __AQ_TEST.countEvents('REVEAL'),
    allHiddenIdentityNull: d.slots.filter(s => s.phase === 'TELEGRAPH').every(s => s.weaponId === null),
      longHiddenCount: d.slots.filter(s => s.phase === 'TELEGRAPH' && s.age >= 5 && s.weaponId === null).length,
  };
`);
gate('spawn-cadence-independent', report.spawnLaw.spawnedTotal >= 4 && report.spawnLaw.spawnEvents >= 4,
  `spawnedTotal=${report.spawnLaw.spawnedTotal} over 10s (first 1.0s, cadence 3.0s)`);
gate('reveal-lookahead-1.2-1.8s', report.spawnLaw.leadsInRange, report.spawnLaw.leadValues.map(v => +v.toFixed(3)));
gate('multi-slot-coexist', report.spawnLaw.maxActive >= 3, `maxActiveSlots=${report.spawnLaw.maxActive}`);
gate('no-age-based-reveal-while-far', report.spawnLaw.longHiddenCount >= 1 && report.spawnLaw.allHiddenIdentityNull,
    `longHidden=${report.spawnLaw.longHiddenCount} reveals=${report.spawnLaw.revealEvents}`);

// --------------------------------------- gate: proximity-predicted reveal law
report.telegraphLaw = run(`
  __AQ_TEST.enterManual();
  __AQ_TEST.clearEvents();
  __AQ_TEST.holdSpawns();
  __AQ_TEST.place(150, 500, 900, 900); // frozen by default
  const id = __AQ_TEST.pushSlot({
    x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null,
    revealLeadSeconds: 1.5
  });

  // Even after >5s, no eligible moving fighter is approaching.
  __AQ_TEST.step(6.1);
  let slot = APEX_ARSENAL.state.slots.find(s => s.id === id);
  const hiddenAfter6s = !!slot && slot.phase === 'TELEGRAPH' && slot.weaponId === null;
  const beforeDebug = __AQ_TEST.debug().slots.find(s => s.id === id);

  // Now HERO resumes its current Apex trajectory directly toward the slot.
  fighters[0].baseSpeed = 520;
  fighters[0].setDir(1, 0);
  fighters[1].baseSpeed = 0;
  __AQ_TEST.step(0.04);

  slot = APEX_ARSENAL.state.slots.find(s => s.id === id);
  const revealedOnApproach = !!slot && slot.phase === 'REVEALED' && !!slot.weaponId;
  const revealLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + id)) || '';

  // Allow the current trajectory to reach the now-revealed pickup.
  __AQ_TEST.step(1.5);
  return {
    hiddenAfter6s,
    beforeDebug,
    revealedOnApproach,
    revealLog,
    finalHolder: __AQ_TEST.holder('HERO'),
    pickupEvent: __AQ_TEST.countEvents('PICKUP', 'fighter=HERO'),
  };
`);
gate('telegraph-not-collectible-and-long-hidden',
  report.telegraphLaw.hiddenAfter6s && report.telegraphLaw.beforeDebug?.age >= 6 && report.telegraphLaw.beforeDebug?.weaponId === null,
  report.telegraphLaw.beforeDebug);
gate('telegraph-no-identity', report.telegraphLaw.beforeDebug?.weaponId === null);
gate('proximity-reveal-on-approach',
  report.telegraphLaw.revealedOnApproach && /eta=\d+\.\d+/.test(report.telegraphLaw.revealLog)
    && /lead=1\.50/.test(report.telegraphLaw.revealLog) && /fighter=HERO/.test(report.telegraphLaw.revealLog),
  report.telegraphLaw.revealLog);
gate('reveal-then-collectible', !!report.telegraphLaw.finalHolder && report.telegraphLaw.pickupEvent === 1, report.telegraphLaw.finalHolder);

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
snapshot('06-melee-axe-slash');

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
gate('av-muzzle-uses-transparent-sheet',
  !!avDescribe && avDescribe.muzzleSheet.includes('muzzleFlash0_transparent'),
  avDescribe && avDescribe.muzzleSheet);
gate('av-asset-map-complete',
  !!avDescribe
  && ['pistol_shot', 'shotgun_shot', 'smg_shot', 'sniper_shot', 'explosion', 'sabre_swing', 'axe_swing', 'dagger_swing', 'spear_swing', 'club_swing', 'shield_activate_swirl', 'shield_activate_tower', 'reflect', 'block_heavy', 'telegraph', 'reveal', 'pickup'].every(k => (avDescribe.audio[k] || []).length > 0),
  Object.keys(avDescribe ? avDescribe.audio : {}));
gate('av-melee-sequences-distinct',
  !!avDescribe && new Set(Object.values(avDescribe.melee).map(s => s.join(','))).size === 5,
  avDescribe && Object.fromEntries(Object.entries(avDescribe.melee).map(([k, v]) => [k, v.length])));

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
  ['av-08-sabre-slash', 'SABRE', 0.2],
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

report.av.after = avStats();
gate('av-assets-preloaded',
  report.av.after.imagesLoaded === avDescribe.allImages.length && report.av.after.audioLoaded === avDescribe.allAudio.length,
  { images: `${report.av.after.imagesLoaded}/${avDescribe.allImages.length}`, audio: `${report.av.after.audioLoaded}/${avDescribe.allAudio.length}`, imgFail: report.av.after.imagesFailed, sfxFail: report.av.after.audioFailed });
gate('weapon-atlas-floor-sprite-rendered', report.av.after.floorSpriteDraws > 0, `draws=${report.av.after.floorSpriteDraws}`);
gate('weapon-atlas-equipped-sprite-rendered', report.av.after.equippedSpriteDraws > 0, `draws=${report.av.after.equippedSpriteDraws}`);
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
      leadSamplesInRange: leadSamples.length > 100 && leadSamples.every(v => v >= 1.2 && v <= 1.8),
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
gate('reveal-lookahead-range-over-5min', report.fiveMinute.leadSamplesInRange, `samples=${report.fiveMinute.leadSampleCount}`);

// ------------------------------------------------------- gate: structured log
report.logSample = run(`
  const kinds = ['SPAWN_SLOT', 'REVEAL', 'PICKUP', 'USE', 'HIT', 'CONSUME'];
  const out = {};
  for (const k of kinds) out[k] = APEX_ARSENAL.events.find(e => e.startsWith('[AQ] ' + k)) || null;
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
