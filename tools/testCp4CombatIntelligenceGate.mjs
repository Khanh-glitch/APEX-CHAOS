// CP4 Combat Intelligence / Premium HUD-UX gate.
// Behavioral where a VM can execute the real authority; static only for
// browser/DOM seams that are separately exercised by browser evidence.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── 1. one weapon display-name authority ───────────────────────────────────
{
  const sandbox = {
    console,
    setTimeout() { return 0; },
    clearTimeout() {},
    window: { addEventListener() {}, removeEventListener() {} },
    document: {
      getElementById() { return null; },
      addEventListener() {},
      querySelector() { return null; },
    },
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(read('public/game/arsenal/arsenalConfig.js'), sandbox, { timeout: 2000 });
  const config = sandbox.window.APEX_ARSENAL_CONFIG;
  assert.ok(config, 'arsenal config publishes APEX_ARSENAL_CONFIG');
  const ids = [...new Set([
    ...Object.keys(config.WEAPONS || {}),
    ...Object.keys(config.V43_WEAPONS || {}),
  ])].sort();
  assert.equal(ids.length, 41, `expected 41 canonical weapon IDs, got ${ids.length}`);
  assert.deepEqual(Object.keys(config.WEAPON_DISPLAY_NAMES).sort(), ids,
    'display-name map covers exactly the canonical weapon ID union');
  assert.equal(Object.isFrozen(config.WEAPON_DISPLAY_NAMES), true);
  assert.equal(config.weaponDisplayName('SHOTGUN'), 'SPAS-12');
  assert.equal(config.weaponDisplayName('PISTOL'), 'colt');
  assert.equal(config.weaponDisplayName('SMG'), 'MP5');
  assert.equal(config.weaponDisplayName('SNIPER'), 'Snipex Alligator');
  assert.equal(config.weaponDisplayName('RPG_7'), 'RPG-7');
  for (const rel of [
    'public/game/ui/apexCombatHudRuntime.js',
    'public/game/gold/goldProductBridge.js',
    'public/game/results/matchResultAuthority.js',
    'src/game/cosmetics/CosmeticLocker.jsx',
    'src/game/cosmetics/FieldArchiveC03.jsx',
    'src/ui/ProgressionCenter.jsx',
  ]) {
    assert.match(read(rel), /weaponDisplayName/, `${rel} consumes the display-name authority`);
  }
}

// ── 2. CP4 wall feedback removes filled radial discs only ──────────────────
{
  const robot = read('public/game/hero-rework/robotPresentationRuntime.js');
  assert.match(robot, /if \(!isWall\) flashState/, 'NEWBOT wall hits suppress the radial flash');
  assert.doesNotMatch(robot, /ctx\.arc\(q2\.x, q2\.y, q2\.s \* \(1 \+ q2\.t \* 2\)/,
    'NEWBOT wall dust is no longer an expanding filled disc');
  assert.match(robot, /wall dust is a short scrape streak along its own velocity/);

  const eco = read('src/game/cosmetics/ecoNewbotV17WorldGold.js');
  const back = eco.slice(
    eco.indexOf('export function drawEcoGoldWorldBack'),
    eco.indexOf('export function drawEcoGoldWorldFront'),
  );
  assert.match(eco, /s\.scuff=\{x:at\.x,y:at\.y,t:0,life:2\.15,axis\}/,
    'ECOBOT records the struck wall axis');
  assert.doesNotMatch(back, /createRadialGradient|ctx\.ellipse/,
    'ECOBOT wall back-layer draws no radial filled ellipse');
  assert.match(back, /three short scrape strokes parallel to the struck wall/);
}

// ── 3. Result works from the app entry base, including nested hosting ──────
{
  const appRoot = read('src/game/appRoot.js');
  const bridge = read('public/game/gold/goldProductBridge.js');
  const pack = read('tools/packItchPortable.mjs');
  const resultApp = read('result-gold/src/App.tsx');
  const resultArt = read('result-gold/src/components/art.tsx');
  assert.match(appRoot, /window\.APEX_APP_ENTRY_BASE\s*=\s*ENTRY_BASE/);
  assert.match(appRoot, /window\.APEX_APP_URL\s*=\s*apexAppUrl/);
  assert.match(bridge, /new URL\('result-gold\/index\.html',base\)/,
    'Result iframe resolves through the entry-base authority first');
  assert.match(pack, /result-gold\//, 'itch pack rewrites result-gold resources');
  assert.match(pack, /return '\.\.\/result-gold\/index\.html';/, 'itch pack canaries the nested Result fallback');
  assert.match(resultApp, /function normalizeMatchArt/);
  assert.match(resultApp, /new URL\("\.\.\/", window\.location\.href\)/,
    'Result payload art resolves against the app root above result-gold/');
  assert.match(resultArt, /stage === 0 && skinSrc \? "skin-image" : "image"/, 'sealed owner skin art has an explicit render state');
  assert.match(resultArt, /data-art-state="fallback"/, 'genuinely unavailable art reaches an honest fallback');
  assert.match(read('public/game/results/matchResultAuthority.js'), /skinArtBySide/,
    'sealed snapshot carries per-side weapon skin art');
}

// ── 4. Pausing tutorial + side introduction seams ──────────────────────────
{
  const hero = read('public/game/hero-rework/heroReworkRuntime.js');
  const coach = read('src/ui/FirstPlayGuide.jsx');
  const coachCss = read('src/ui/firstPlayGuide.css');
  assert.match(hero, /HR\.observeAbilityOpportunity\s*=\s*function observeAbilityOpportunity/,
    'tutorial reuses the hero-rework tactical evaluator seam');
  assert.match(hero, /if \(tutorialPauseActive\(\)\) return \{ ok: false, reason: 'tutorial-paused' \};/,
    'the shared ability executor is closed during the pause lease');
  assert.match(hero, /const wrappedStep = function aqStepHR\(dt\) \{\s*if \(tutorialPauseActive\(\)\) return;/,
    'headless AQ.step is pause-gated before pre-tick');
  assert.match(hero, /const wrappedUpdate = function updateHR\(dt\) \{[\s\S]*?if \(tutorialPauseActive\(\)\) return;/,
    'browser update() is pause-gated before simulation');
  assert.match(coach, /window\.APEX_TUTORIAL_PAUSE/, 'coach publishes one pause lease');
  assert.match(coach, /tacticalOpportunity\(slot, waitedMs\)/, 'pause opens only from tactical opportunity');
  assert.match(coach, /waitedMs < 22000/, 'observable fallback cannot fire merely because cooldown is zero');
  assert.match(coach, /now - pauseRef\.current\.since > 30000/, 'forgotten lessons auto-resume');
  assert.match(coach, /document\.addEventListener\('pointerup', onPointerUp, true\)/,
    'touch lesson accepts the real pointer-release contract');
  assert.match(coach, /expectedCode = slot === 1 \? 'KeyK' : 'KeyJ'/, 'keyboard lesson accepts only the taught J/K slot');
  // CP5.3 (deliberate, disclosed): the intro now teaches the engine
  // edge colors (P1 orange / P2 blue), so the pinned labels and the
  // one-time storage version moved with it — the behavior migrated,
  // the assertion still pins the exact shipped strings.
  assert.match(coach, /apex\.alpha\.sideIntro\.v2/, 'side introduction has one persisted one-time authority');
  assert.match(coach, /sideYou: 'YOU · ORANGE EDGE'/);
  assert.match(coach, /sideYou: 'BẠN · VIỀN CAM'/);
  assert.match(coach, /pausedNote: 'TRẬN ĐANG TẠM DỪNG/);
  assert.match(coachCss, /#hud\.apex-side-intro-on \.id-row\[data-intro-role\]::after/,
    'side roles render inside existing HUD identity rows, not arena markers');
}

// ── 5. SFX aliases share the licensed 18-key element cache ─────────────────
{
  const moduleSandbox = { console, module: { exports: {} } };
  moduleSandbox.globalThis = moduleSandbox;
  vm.runInNewContext(read('public/game/ui/uiSfxAuthority.js'), moduleSandbox, { timeout: 2000 });
  const { installUiSfxAuthority, KEYS, ALIASES } = moduleSandbox.module.exports;
  assert.equal(Object.keys(KEYS).length, 18, 'canonical SFX bank remains exactly 18 files');
  for (const [alias, spec] of Object.entries(ALIASES)) {
    assert.ok(KEYS[spec.key], `${alias} resolves to a canonical licensed key`);
    assert.ok(spec.gain >= 0 && spec.gain <= 1, `${alias} gain is bounded`);
    assert.ok(spec.rate >= 0.5 && spec.rate <= 2, `${alias} rate is bounded`);
    assert.ok(spec.throttleMs >= 0, `${alias} has an explicit throttle policy`);
  }

  class FakeAudio {
    static created = [];
    constructor(src) {
      this.src = src;
      this.readyState = 3;
      this.paused = true;
      this.ended = false;
      this.currentTime = 0;
      this.volume = 1;
      this.muted = false;
      this.loop = false;
      this.playCount = 0;
      FakeAudio.created.push(this);
    }
    load() {}
    play() { this.paused = false; this.playCount += 1; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener() {}
    removeEventListener() {}
  }
  let now = 1000;
  const fakeWin = {
    Audio: FakeAudio,
    document: {},
    performance: { now: () => now },
    setTimeout,
    clearTimeout,
  };
  fakeWin.window = fakeWin;
  const sfx = installUiSfxAuthority({ window: fakeWin });
  assert.equal(sfx.canonicalFor('tutorial.pause'), 'ui.panel.open');
  assert.equal(sfx.urlFor('achievement.legendary'), KEYS['lucky.draw.reward_reveal']);
  assert.equal(sfx.play('tutorial.pause'), true);
  assert.equal(FakeAudio.created.length, 1);
  const panel = FakeAudio.created[0];
  assert.match(panel.src, /ui_panel_open\.ogg$/);
  assert.ok(Math.abs(panel.volume - 0.385) < 1e-9, 'alias gain composes with the one UI volume');
  assert.equal(panel.playbackRate, 0.92);
  now += 100;
  assert.equal(sfx.play('tutorial.pause'), false, 'alias throttle suppresses spam');
  now += 1200;
  assert.equal(sfx.play('ui.panel.open'), true);
  assert.equal(FakeAudio.created.length, 1, 'alias and canonical key share one cached element');
  assert.equal(panel.playCount, 2);
  const warmed = await sfx.warm(['tutorial.pause', 'ui.panel.open'], 300);
  assert.deepEqual([...warmed.warmed], ['ui.panel.open'], 'warm dedupes aliases by canonical file');
}

// ── 6. BOXE decisions use predicted intercept / real counter threats ───────
{
  const self = { id: 1, x: 100, y: 500, radius: 75, hp: 1000, maxHp: 1000, dir: { x: 1, y: 0 }, __hrVel: { x: 0, y: 0 } };
  const foe = { id: 2, x: 500, y: 500, radius: 75, hp: 1000, maxHp: 1000, dir: { x: -1, y: 0 }, __hrVel: { x: 0, y: 0 }, data: { arsenal: { weaponId: 'SMG' } } };
  const ct = { heroId: 'BOXE', anchor: self, store: {}, skills: { A1: { cdLeft: 0 }, A2: { cdLeft: 0 } } };
  const enemyCt = { heroId: 'ROBOT', anchor: foe };
  let projectiles = [];
  const scope = {
    console,
    APEX_ARSENAL: { weaponApi: { getHolder: () => null, consume() {}, equip: () => true }, state: { slots: [] } },
    APEX_ARSENAL_CONFIG: { BULLET_HIT_RADIUS_SCALE: 0.78 },
    GAME_SIZE: 1000,
    projectiles,
  };
  scope.globalThis = scope;
  vm.runInNewContext(read('public/game/hero-rework/boxeBattleRuntime.js'), scope);
  const ex = scope.APEX_BOXE_BATTLE.executors;
  const ctx = {
    combatant: ct,
    api: {
      clock: () => 0,
      emitEvent() {},
      enemyOf: () => enemyCt,
      combatantOfBody: (body) => (body === foe ? enemyCt : body === self ? ct : null),
      heldWeapon: (owner) => (owner === enemyCt ? { weaponId: 'SMG' } : null),
      liveProjectiles: () => projectiles,
      gameSize: 1000,
      applyStunTo() {},
      dropWeaponSlot: () => null,
    },
  };
  let decision = ex['boxe.fist_rocket'].aiEvaluate(ctx);
  assert.equal(decision.shouldCast, true);
  assert.equal(decision.reason, 'predicted-rocket-intercept');
  foe.__hrVel = { x: 0, y: 900 };
  decision = ex['boxe.fist_rocket'].aiEvaluate(ctx);
  assert.equal(decision.shouldCast, false, 'distance alone no longer launches a missing rocket');
  assert.equal(decision.reason, 'no-predicted-rocket-intercept');

  foe.__hrVel = { x: 0, y: 0 };
  projectiles = [{ owner: foe, x: 400, y: 500, vx: -600, vy: 0, radius: 4, life: 2 }];
  decision = ex['boxe.block_and_hit'].aiEvaluate(ctx);
  assert.equal(decision.shouldCast, true);
  assert.equal(decision.reason, 'incoming-projectile-counter');
  projectiles = [{ owner: foe, x: 900, y: 500, vx: -50, vy: 0, radius: 4, life: 5 }];
  foe.x = 900;
  decision = ex['boxe.block_and_hit'].aiEvaluate(ctx);
  assert.equal(decision.shouldCast, false, 'counter does not open outside its real guard/threat window');
}

// ── 7. SHURI predicts the armed bomb and meaningful repairs ────────────────
{
  let time = 0;
  const handlers = new Map();
  const bus = {
    on(key, fn) {
      const list = handlers.get(key) || [];
      list.push(fn);
      handlers.set(key, list);
      return () => {};
    },
    emit() {},
  };
  const self = { id: 1, x: 400, y: 350, radius: 75, hp: 1000, maxHp: 1000, dir: { x: 1, y: 0 }, data: {} };
  const foe = { id: 2, x: 700, y: 400, radius: 75, hp: 1000, maxHp: 1000, __hrVel: { x: -200, y: 0 }, data: {} };
  const ct = {
    heroId: 'SHURI', combatantId: 'p1', side: 'p1', anchor: self, store: {},
    skills: {
      PASSIVE: { cfg: { initialScrap: 20 } },
      A1: { cfg: { bombRadius: 100, bombArmedLifetime: 5 } },
      A2: { cfg: { buildScrap: 20, structureHP: 200, repairPerScrap: 10, operatingRange: 200 } },
    },
  };
  self.__hrCombatant = ct;
  const world = {
    console,
    APEX_HERO_REWORK_AIL: { bus, clock: () => time },
    APEX_ARSENAL_CONFIG: {
      tierOf: (id) => ({ PISTOL: 'T1', SNIPER: 'T5' }[id] || null),
      isGunOrLauncher: (id) => ['PISTOL', 'SNIPER'].includes(id),
    },
    APEX_ARSENAL_SPAWN: {},
    APEX_ARSENAL: { weaponApi: { getHolder: () => null }, state: { resultLedger: { onHeal() {} } } },
    fighters: [self, foe],
  };
  world.globalThis = world;
  vm.runInNewContext(read('public/game/hero-rework/shuriBattleRuntime.js'), world);
  const ex = {};
  world.APEX_SHURI_BATTLE.install(ex);
  const ctx = {
    combatant: ct,
    api: {
      emitEvent() {},
      enemyBodies: () => [foe],
      nearestFreeWorldCircle: (x, y) => ({ x, y, adjusted: false }),
      spawnWall: (spec) => ({ id: 99, ...spec }),
      applyStunTo() {},
      gameSize: 1000,
    },
  };
  let decision = ex['shuri.shock_recoil'].aiEvaluate(ctx);
  assert.equal(decision.shouldCast, true);
  assert.equal(decision.reason, 'predicted-bomb-crossing');
  const st = world.APEX_SHURI_BATTLE.stateOf(ct);
  st.anchor = { x: 400, y: 400 };
  foe.__hrVel = { x: 200, y: 0 };
  decision = ex['shuri.shock_recoil'].aiEvaluate(ctx);
  assert.equal(decision.shouldCast, false, 'an enemy leaving the future bomb radius is not a bomb opportunity');

  st.scrap = 10;
  st.structure = {
    solid: { id: 7, x: 400, y: 400, radius: 75, hp: 190 },
    phase: 'ACTIVE', recovery: false, mountedWeaponId: null,
  };
  decision = ex['shuri.machine'].aiEvaluate(ctx);
  assert.equal(decision.shouldCast, false);
  assert.equal(decision.reason, 'repair-too-small');
  st.structure.solid.hp = 100;
  decision = ex['shuri.machine'].aiEvaluate(ctx);
  assert.equal(decision.shouldCast, true);
  assert.equal(decision.reason, 'meaningful-structure-repair');
}

// ── 8. MAGNET/HUNTER decisions remain observable and legitimate ────────────
{
  const w = {};
  const sandbox = vm.createContext({
    window: w, console, Math, Set, Map, WeakMap, Date, Number, Object, Array, String, Promise,
  });
  for (const rel of [
    'public/game/hero-rework/ailRuntime.js',
    'public/game/hero-rework/heroMechanicsRuntime.js',
  ]) {
    vm.runInContext(read(rel), sandbox, { filename: rel, timeout: 10000 });
  }
  const EXECUTORS = w.APEX_HERO_REWORK_MECHANICS.EXECUTORS;

  // HUNTER: a revealed pickup on the real intercept segment raises an
  // otherwise low-value unarmed/non-closing pounce; off-corridor does not.
  w.APEX_HUNTER_PRESENTATION = { ready: true, idle: () => true, trapWorldRadius: 46 };
  const hunterSelf = { id: 1, x: 100, y: 500, radius: 75, hp: 1000, __hrVel: { x: 0, y: 0 } };
  const hunterFoe = { id: 2, x: 500, y: 500, radius: 75, hp: 1000, __hrVel: { x: 0, y: 0 }, hasStatus: () => false };
  const hunterCt = { anchor: hunterSelf, store: {} };
  const hunterEnemyCt = { anchor: hunterFoe };
  let pickups = [{ x: 300, y: 500, weaponId: 'PISTOL' }];
  const hunterCtx = {
    combatant: hunterCt,
    cfg: { moveSpeed: 1000, maxMoveTime: 1, windup: 0.1 },
    api: {
      enemyBodies: () => [hunterFoe],
      combatantOfBody: (body) => (body === hunterFoe ? hunterEnemyCt : null),
      heldWeapon: () => null,
      revealedPickups: () => pickups,
    },
  };
  let decision = EXECUTORS['hunter.pounce_weak'].aiEvaluate(hunterCtx);
  assert.equal(decision.shouldCast, true);
  assert.equal(decision.reason, 'intercept-pickup-corridor');
  pickups = [{ x: 300, y: 760, weaponId: 'PISTOL' }];
  decision = EXECUTORS['hunter.pounce_weak'].aiEvaluate(hunterCtx);
  assert.equal(decision.shouldCast, false, 'off-corridor pickups do not fabricate a pounce setup');

  // MAGNET: with an observable rival, A2 refuses to push a needed floor
  // weapon toward that rival; enemy-in-field remains an immediate repel.
  const future = 'FUTURE_WORLD_WEAPON_CANARY';
  const magnetConfig = {
    WEAPONS: { [future]: { tier: 'T3', family: 'future-special', magneticResponse: 'responsive' } },
    V43_WEAPONS: {},
    isGun: () => false,
    isHeroManipulableFloorWeapon(slot) {
      const data = this.WEAPONS[slot?.weaponId];
      return !!(slot?.kind === 'WEAPON' && data && data.tier !== 'T6');
    },
    isHeroMagneticallyResponsiveFloorWeapon(slot) {
      return this.isHeroManipulableFloorWeapon(slot)
        && this.WEAPONS[slot.weaponId]?.magneticResponse === 'responsive';
    },
  };
  w.APEX_ARSENAL_CONFIG = magnetConfig;
  w.APEX_MAGNET = { canCast: () => true };
  w.APEX_ARSENAL = {
    state: {
      slots: [{ id: 'pickup-1', phase: 'REVEALED', kind: 'WEAPON', weaponId: future, x: 480, y: 400 }],
    },
  };
  const magnetSelf = { id: 3, x: 400, y: 400, radius: 75, hp: 1000 };
  const magnetFoe = { id: 4, x: 900, y: 400, radius: 75, hp: 1000 };
  const magnetCt = { anchor: magnetSelf };
  const magnetEnemyCt = { anchor: magnetFoe };
  const magnetCtx = {
    combatant: magnetCt,
    cfg: { bulletRadius: 480, radius: 225, gameplayDuration: 1, duration: 1.8 },
    api: {
      enemyOf: () => magnetEnemyCt,
      enemyBodies: () => [magnetFoe],
      heldWeapon: () => null,
      liveProjectiles: () => [],
      combatantOfBody: (body) => (body === magnetFoe ? magnetEnemyCt : null),
      ownsBody: (_ct, body) => body === magnetSelf,
    },
  };
  decision = EXECUTORS['magnet.repulsion_field'].aiEvaluate(magnetCtx);
  assert.equal(decision.shouldCast, false, 'MAGNET A2 must not feed a needed weapon toward the rival');
  magnetFoe.x = 500;
  decision = EXECUTORS['magnet.repulsion_field'].aiEvaluate(magnetCtx);
  assert.equal(decision.shouldCast, true);
  assert.equal(decision.reason, 'enemy-in-repel-radius');
}

// ── 9. Scheduler / Crystal / rarity / localization contracts ───────────────
{
  const hero = read('public/game/hero-rework/heroReworkRuntime.js');
  const crystal = read('public/game/hero-rework/crystalGameplayRuntime.js');
  const headless = read('tools/testArsenalBattleHeadless.mjs');
  assert.match(hero, /ct\.heroId === 'MIRROR' \? 0\.18 \+ rng\(\) \* 0\.25/,
    'only excess MIRROR scheduler think-time is shortened');
  assert.match(hero, /at most one successful cast per AI tick/);
  assert.match(hero, /otherPlan\.at = AIL\.clock\(\) \+ 0\.35/);
  assert.match(crystal, /function wallBlocksThreat/, 'Crystal Wall validates the actual planned segment');
  assert.match(crystal, /reason:threats\.length \? 'wall-segment-miss' : 'no-wall-threat'/);
  assert.match(headless, /x:250,y:500,px:250,py:500,vx:120/,
    'integrated Crystal fixture starts on the blockable side of the planned wall');

  const catalog = read('src/ui/masteryCatalog.js');
  for (const [rarity, shape, pips] of [
    ['common', 'circle', 1],
    ['rare', 'octagon', 2],
    ['epic', 'shield', 3],
    ['legendary', 'starburst', 4],
  ]) {
    assert.match(catalog, new RegExp(`${rarity}: Object\\.freeze\\(\\{ shape: '${shape}', pips: ${pips}`),
      `${rarity} has a non-color shape/pip identity`);
  }
  const decisions = JSON.parse(read('result-gold/src/data/ownerDecisions.json'));
  assert.deepEqual(
    [...new Set(decisions.items.filter((item) => item.decision === 'keep').map((item) => item.rarity))].sort(),
    ['common', 'epic', 'legendary', 'rare'],
    'canonical rarity data remains the four-rarity set',
  );
  const toast = read('src/ui/AchievementToast.jsx');
  assert.match(toast, /const achievementTitle = translateCopy\(achievement\.name, lang\)/,
    'achievement titles in the toast use the selected locale');
  assert.match(toast, /<strong>\{achievementTitle\}<\/strong>/,
    'the localized achievement title is what the real toast renders');
  assert.match(toast, /BOT FEAT — NOT ADDED TO YOUR MASTERY/);
  assert.match(toast, /THÀNH TÍCH CỦA BOT — KHÔNG GHI VÀO TINH THÔNG CỦA BẠN/);
  assert.match(toast, /data-owner-side=/, 'achievement ownership is side-addressable in the DOM');
  assert.match(read('src/ui/ProgressionCenter.jsx'), /data-rarity-shape=/,
    'Mastery Vault consumes the same rarity presentation authority');
  const toastCss = read('src/ui/achievementToast.css');
  assert.match(toastCss, /bottom: max\(118px/, 'achievement toast docks in the desktop side-HUD gutter');
  assert.match(toastCss, /\[data-owner-side="P2"\] \{\s*left: auto;\s*right: max\(8px/, 'P2/BOT toast docks to the owner side');
  assert.match(toastCss, /top: min\(calc\(env\(safe-area-inset-top, 0px\) \+ 92px \+ 100vw\), calc\(100dvh - 232px\)\)/,
    'portrait toast starts after the arena edge and stays above the skill deck');
  assert.match(toastCss, /max-height: 600px[\s\S]*?top: min\(calc\(env\(safe-area-inset-top, 0px\) \+ 92px \+ 100vw\), calc\(100dvh - 208px\)\)/,
    'short portrait toast compresses within the gap instead of covering arena/skills');
  assert.doesNotMatch(toastCss, /left: 42%|left: 58%/, 'toast is no longer side-shifted inside the arena');
}

console.log('CP4 COMBAT INTELLIGENCE GATE PASS: weapon authority, wall streaks, nested Result, tutorial lease, SFX aliases, BOXE/SHURI/HUNTER/MAGNET decisions, scheduler/Crystal/rarity contracts');
