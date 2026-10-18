import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

await import('../public/game/bot-wave/waveCampaign.js');
const campaign = globalThis.APEX_BOT_WAVE_CAMPAIGN;
const game = fs.readFileSync('public/bot-wave/game.html', 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
const near = (actual, expected, label) => assert.ok(
  Math.abs(actual - expected) <= 1e-9,
  `${label}: expected ${expected}, got ${actual}`,
);

assert.deepEqual(plain(campaign.survival.healthPack), {
  dropChance: 0.04,
  healFraction: 0.10,
  lifetimeSeconds: 8,
  maxActive: 1,
});

// Use the real shipped card catalogue for stack caps and unlock validation.
const cardsStart = game.indexOf('const CARDS=');
const cardsEnd = game.indexOf('\n];', cardsStart);
assert.ok(cardsStart >= 0 && cardsEnd > cardsStart, 'CARDS literal not found');
const cards = plain(vm.runInNewContext(
  `(${game.slice(cardsStart + 'const CARDS='.length, cardsEnd + 2)})`,
));

// Execute the real derived-stats and CP3 persistence/health-pack blocks from
// the monolith. The stubs below replace only browser/engine presentation
// surfaces; snapshot, restore, rollback and drop logic are shipped code.
const applyStart = game.indexOf('function applyStacksDerived');
const applyEnd = game.indexOf('\n}\n/* THE LAST ROUND', applyStart);
assert.ok(applyStart >= 0 && applyEnd > applyStart, 'applyStacksDerived not found');
const applyText = game.slice(applyStart, applyEnd + 2);
const blockStart = game.indexOf("const BOT_WAVE_SAVE_KEY='apex-botwave-save-v1';");
const blockEnd = game.indexOf('// Campaign plan is immutable per wave.', blockStart);
assert.ok(blockStart >= 0 && blockEnd > blockStart, 'CP3 persistence block not found');
const blockText = game.slice(blockStart, blockEnd);
const loseStart = game.indexOf('function lose()');
const loseEnd = game.indexOf('\nfunction restart()', loseStart);
assert.ok(loseStart >= 0 && loseEnd > loseStart, 'lose() not found');
const loseText = game.slice(loseStart, loseEnd);
const helperStart = game.indexOf('function formatHudInt');
const helperEnd = game.indexOf('\nfunction refreshUI()', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'HUD helper block not found');
const helperText = game.slice(helperStart, helperEnd);
const guardStart = game.indexOf('const GUARD_BASE_CD=');
const guardEnd = game.indexOf('\nfunction act(', guardStart);
assert.ok(guardStart >= 0 && guardEnd > guardStart, 'guard state block not found');
const guardText = game.slice(guardStart, guardEnd);

let rngValue = 0;
let restartCalls = 0;
let refreshCalls = 0;
let resetAllCalls = 0;
let armoryResetCalls = 0;
let stageResetCalls = 0;
let presentResetCalls = 0;
const storage = new Map();
const element = () => ({
  textContent: '',
  hidden: false,
  style: {},
  replaceChildren() {},
});
const sandbox = {
  Math,
  Date,
  clamp: (value, lo, hi) => Math.min(hi, Math.max(lo, value)),
  rng: () => rngValue,
  xpNeeded: (level) => Math.ceil(70 * Math.pow(1.16, level - 1)),
  CARDS: cards,
  CAMPAIGN: campaign,
  UI: {
    'w-title': element(),
    'w-desc': element(),
    'w-go': element(),
    'w-wave': element(),
    'w-cards': element(),
    'wave-modal': element(),
  },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  },
  ARMORY: { reset() { armoryResetCalls++; } },
  ARENA_STAGE: { notice() {}, reset() { stageResetCalls++; } },
  R2_PRESENT: { reset() { presentResetCalls++; } },
  refreshUI() { refreshCalls++; },
  restart() { restartCalls++; },
  stickDX: 9,
  stickDY: -4,
  state: {
    wave: 12,
    phase: 'combat',
    queue: [{ gun: 'PISTOL' }],
    spawnT: 2,
    kills: 25,
    xp: 10,
    level: 3,
    levelsPending: 0,
    offer: null,
    owned: new Set(['rocket']),
    stacks: { fist: 2, vitality: 1, armor: 2, rocket: 1 },
    damageMul: 99,
    moveMul: 99,
    punchMul: 99,
    guardBonus: 99,
    knockMul: 99,
    dashCdMul: 99,
    skillCdMul: 99,
    armor: 99,
    xpMul: 99,
    counterWindowBonus: 99,
    rocketChance: 99,
    healOnKill: 99,
    waveDamageReceived: 0,
    passiveProgress: 77,
    passiveReady: true,
    empowered: true,
    empoweredEnd: 99,
    aliveTime: 12.5,
    shots: 33,
    hit: 0,
    losses: 1,
    activeEnemies: 4,
    debug: { forceRocketNext: true },
    comboFlow: {},
    comboSerial: 8,
    rocketPending: true,
    rocketRolls: 7,
    rocketProcs: 2,
    comboTrace: [{ type: 'old' }],
    stickyEngage: {},
    stickyStats: { attempts: 9, engaged: 8, committed: 7, cancelled: 1 },
    healthPacks: [],
    healthPackDrops: 1,
    healthPackPickups: 1,
    waveSnapshot: null,
    clusterSnapshot: null,
    _goldPriorHP: 1,
    _shownArsenal: 'stale',
    guardHeld: true,
    guardCounterLive: true,
    guardHoldT: 4,
    guardCdT: 9,
    guardCdMax: 9,
    nextWaveT: 2,
    autoNextWave: true,
    waveToast: 'STALE',
    waveToastT: 2,
  },
  engine: {
    time: 10,
    paused: false,
    leap: {},
    ultLockT: 3,
    mouse: { down: true },
    opts: { haste: 2, damageScale: 0.8 },
    cds: new Map([['jab', 5], ['rocket', 4]]),
    enemies: [{ id: 1 }],
    projs: [{ id: 2 }],
    timeline: [{ id: 3 }],
    zones: [{ id: 4 }],
    player: {
      x: 40, y: 80, vx: 9, vy: -7, r: 34,
      hp: 456, maxHp: 9999, fury: 88, empoweredT: 2,
      guardT: 1, invulnT: 1, dashT: 0.2, dashCd: 2,
      basicCd: 1, comboStep: 2, comboWinT: 1,
      castLockT: 1, cycloneT: 1, orbitT: 1,
    },
    waveCounterUnlocked: false,
    fx: { flash() {} },
    combatCue() {},
    resetAll() {
      resetAllCalls++;
      this.enemies = [{ lab: true }];
      this.projs = [{ lab: true }];
      this.timeline = [{ lab: true }];
      this.zones = [{ lab: true }];
    },
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`
${applyText}
${helperText}
${guardText}
${blockText}
${loseText}
globalThis.__api={
 BOT_WAVE_SAVE_KEY,clusterStartWave,isClusterStartWave,cloneSnapshot,sanitizeRunSnapshot,
 captureRunSnapshot,persistRun,clearSavedRun,loadSavedRun,captureBoundarySnapshot,
 applyRunSnapshot,resetArenaForSnapshot,prepareClusterRetry,restoreSavedRunAtBoot,
 presentRunIntro,healthPackConfig,maybeDropHealthPack,updateHealthPacks,drawHealthPacks,lose
};`, sandbox);
const api = sandbox.__api;
assert.equal(api.BOT_WAVE_SAVE_KEY, 'apex-botwave-save-v1');
assert.equal(api.clusterStartWave(1), 1);
assert.equal(api.clusterStartWave(10), 1);
assert.equal(api.clusterStartWave(11), 11);
assert.equal(api.clusterStartWave(27), 21);

// Corrupt or hand-edited saves are clamped to real card caps, real unlock
// prerequisites, a real XP boundary and the max HP actually owned by the build.
const corrupt = plain(api.sanitizeRunSnapshot({
  wave: 17.9,
  hp: 99999,
  xp: 1e9,
  level: 2,
  kills: -4,
  losses: 2.9,
  stacks: { fist: 2.8, vitality: 99, bogus: 5, counter: 1, ult: 1 },
  owned: ['ult', 'counter', 'rocket', 'bogus'],
}));
assert.equal(corrupt.wave, 17);
assert.equal(corrupt.xp, 81, 'XP is clamped below the next unclaimed level');
assert.equal(corrupt.kills, 0);
assert.equal(corrupt.losses, 2);
assert.equal(corrupt.stacks.fist, 2);
assert.equal(corrupt.stacks.vitality, 12);
assert.equal(corrupt.stacks.counter, undefined, 'Broken unlock chain must not smuggle counter');
assert.equal(corrupt.stacks.ult, undefined, 'Broken unlock chain must not smuggle ult');
assert.deepEqual(corrupt.owned, ['rocket']);
near(corrupt.hp, 1000 * (1.12 ** 12), 'HP clamps to vitality-derived max HP');
const chained = plain(api.sanitizeRunSnapshot({
  wave: 9,
  hp: 900,
  xp: 0,
  level: 4,
  stacks: { jab: 1, uppercut: 1, counter: 1, phantom: 1, ult: 1, rocket: 1 },
  owned: ['ult', 'phantom', 'counter', 'uppercut', 'jab', 'rocket'],
}));
assert.deepEqual([...chained.owned].sort(), ['counter', 'jab', 'phantom', 'rocket', 'ult', 'uppercut']);

// A wave-boundary capture persists the current wave without replacing the
// earlier cluster snapshot; crossing into a new cluster replaces both.
const cluster11 = api.sanitizeRunSnapshot({
  wave: 11, hp: 800, xp: 5, level: 2, kills: 10, losses: 1,
  stacks: { fist: 1, vitality: 1, rocket: 1 }, owned: ['rocket'],
});
sandbox.state.clusterSnapshot = cluster11;
const captured12 = plain(api.captureBoundarySnapshot(12));
assert.equal(captured12.wave, 12);
assert.equal(captured12.hp, 456);
assert.equal(captured12.stacks.fist, 2);
let stored = JSON.parse(storage.get(api.BOT_WAVE_SAVE_KEY));
assert.equal(stored.current.wave, 12);
assert.equal(stored.cluster.wave, 11);
assert.equal(plain(api.loadSavedRun()).current.wave, 12);
const captured21 = plain(api.captureBoundarySnapshot(21));
assert.equal(captured21.wave, 21);
stored = JSON.parse(storage.get(api.BOT_WAVE_SAVE_KEY));
assert.equal(stored.current.wave, 21);
assert.equal(stored.cluster.wave, 21, 'Next-cluster boundary becomes the new rollback point');

// Applying a snapshot restores the exact build through derived stats and
// positions state.wave one step before the snapshot wave for startWave().
sandbox.state.wave = 17;
sandbox.state.phase = 'combat';
sandbox.state.queue = [{ gun: 'SMG' }];
sandbox.state.stacks = { fist: 9, armor: 6, vitality: 4 };
sandbox.state.owned = new Set(['jab', 'uppercut', 'counter']);
sandbox.state.losses = 5;
sandbox.state.healthPacks = [{ x: 0, y: 0, r: 24, expiresAt: 99 }];
sandbox.engine.player.hp = 123;
sandbox.engine.player.maxHp = 9999;
assert.equal(api.applyRunSnapshot(cluster11, { preserveLosses: true }), true);
assert.equal(sandbox.state.wave, 10);
assert.equal(sandbox.state.phase, 'intermission');
assert.equal(sandbox.state.losses, 5, 'Loss count does not rewind on rollback');
assert.equal(sandbox.state.waveSnapshot.losses, 5);
assert.deepEqual(plain(sandbox.state.stacks), { fist: 1, vitality: 1, rocket: 1 });
assert.deepEqual([...sandbox.state.owned], ['rocket']);
near(sandbox.engine.player.maxHp, 1120, 'Rollback recomputes max HP from stacks');
near(sandbox.engine.player.hp, 800, 'Rollback restores entry HP');
near(sandbox.state.damageMul, 1.13, 'Rollback recomputes derived damage');
assert.equal(sandbox.state.healthPacks.length, 0);
assert.equal(sandbox.state.levelsPending, 0);
assert.equal(sandbox.state.guardHeld, false, 'Snapshot restore cannot leak a held guard');
assert.equal(sandbox.state.autoNextWave, false, 'Manual snapshot restore must not auto-start');
assert.equal(sandbox.state.nextWaveT, 0);

// Boot restore presents the saved current wave, while a mismatched cluster
// snapshot is rejected rather than silently trusted.
const current17 = api.sanitizeRunSnapshot({
  wave: 17, hp: 640, xp: 12, level: 5, kills: 80, losses: 2,
  stacks: { fist: 3, vitality: 1, rocket: 1 }, owned: ['rocket'],
});
storage.set(api.BOT_WAVE_SAVE_KEY, JSON.stringify({ version: 1, current: current17, cluster: cluster11 }));
sandbox.state.wave = 0;
sandbox.state.phase = 'intro';
sandbox.state.stacks = {};
sandbox.state.owned = new Set();
sandbox.engine.player.hp = 1;
sandbox.engine.player.maxHp = 1000;
assert.equal(api.restoreSavedRunAtBoot(), true);
assert.equal(sandbox.state.phase, 'intro');
assert.equal(sandbox.state.wave, 16, 'Boot positions startWave to enter saved wave 17');
assert.equal(sandbox.state.clusterSnapshot.wave, 11);
near(sandbox.engine.player.hp, 640, 'Boot restores wave-entry HP');
api.presentRunIntro();
assert.match(sandbox.UI['w-title'].textContent, /CONTINUE WAVE 17/);
assert.match(sandbox.UI['w-go'].textContent, /CONTINUE WAVE 17/);
assert.match(sandbox.UI['w-wave'].textContent, /WAVE 17 · CLUSTER 2/);
storage.set(api.BOT_WAVE_SAVE_KEY, JSON.stringify({
  version: 1,
  current: current17,
  cluster: { ...plain(cluster11), wave: 12 },
}));
assert.equal(api.loadSavedRun(), null, 'Cluster snapshot must belong to current snapshot cluster');
storage.clear();

// Losing immediately retargets the persisted current snapshot to cluster
// start. Exiting on the defeat screen therefore cannot dodge rollback.
sandbox.state.phase = 'combat';
sandbox.state.wave = 17;
sandbox.state.losses = 2;
sandbox.state.clusterSnapshot = cluster11;
sandbox.state.waveSnapshot = current17;
sandbox.state.healthPacks = [{ x: 0, y: 0, r: 24, expiresAt: 99 }];
api.lose();
assert.equal(sandbox.state.phase, 'gameover');
assert.equal(sandbox.state.losses, 3);
assert.equal(sandbox.state.healthPacks.length, 0);
stored = JSON.parse(storage.get(api.BOT_WAVE_SAVE_KEY));
assert.equal(stored.current.wave, 11, 'Exit after loss resumes at cluster start');
assert.equal(stored.current.losses, 3);
assert.equal(stored.cluster.wave, 11);
assert.match(sandbox.UI['w-go'].textContent, /RETRY WAVE 11/);
api.lose();
assert.equal(sandbox.state.losses, 3, 'Defeat is idempotent');

// Cluster retry uses the established Gold/Armory/stage resets and restores
// only the snapshot build, preserving the incremented loss count.
sandbox.state.stacks = { fist: 9, armor: 6, vitality: 3 };
sandbox.state.owned = new Set(['jab', 'uppercut', 'counter']);
sandbox.engine.enemies = [{ stale: true }];
sandbox.engine.projs = [{ stale: true }];
sandbox.engine.timeline = [{ stale: true }];
sandbox.engine.cds.set('jab', 9);
const resetsBefore = { resetAllCalls, armoryResetCalls, stageResetCalls, presentResetCalls, refreshCalls };
assert.equal(api.prepareClusterRetry(), true);
assert.equal(resetAllCalls, resetsBefore.resetAllCalls + 1);
assert.equal(armoryResetCalls, resetsBefore.armoryResetCalls + 1);
assert.equal(stageResetCalls, resetsBefore.stageResetCalls + 1);
assert.equal(presentResetCalls, resetsBefore.presentResetCalls + 1);
assert.ok(refreshCalls > resetsBefore.refreshCalls);
assert.equal(restartCalls, 0, 'Valid cluster retry must not fall back to a full restart');
// These arrays are allocated by VM-realm code, so compare their observable
// contents by length instead of tripping deepStrictEqual's prototype check.
assert.equal(sandbox.engine.enemies.length, 0);
assert.equal(sandbox.engine.projs.length, 0);
assert.equal(sandbox.engine.timeline.length, 0);
assert.equal(sandbox.engine.cds.get('jab'), 0);
assert.equal(sandbox.engine.player.x, 0);
assert.equal(sandbox.engine.player.y, 120);
assert.equal(sandbox.state.phase, 'intermission');
assert.equal(sandbox.state.wave, 10);
assert.equal(sandbox.state.losses, 3);
assert.deepEqual(plain(sandbox.state.stacks), { fist: 1, vitality: 1, rocket: 1 });
near(sandbox.engine.player.hp, 800, 'Cluster retry restores cluster-entry HP');

// Health packs: flat 4% on an open slot, no HP pity, max one, 8s lifetime,
// touch pickup for exactly 10% max HP.
sandbox.engine.time = 10;
sandbox.engine.player.x = 0;
sandbox.engine.player.y = 120;
sandbox.engine.player.hp = 500;
sandbox.engine.player.maxHp = 1000;
sandbox.state.healthPacks = [];
sandbox.state.healthPackDrops = 0;
sandbox.state.healthPackPickups = 0;
rngValue = 0.039;
assert.equal(api.maybeDropHealthPack({ x: 10, y: 120 }), true);
assert.equal(sandbox.state.healthPacks.length, 1);
assert.equal(sandbox.state.healthPacks[0].expiresAt, 18);
rngValue = 0;
assert.equal(api.maybeDropHealthPack({ x: 20, y: 120 }), false, 'Only one pack may be active');
api.updateHealthPacks();
near(sandbox.engine.player.hp, 600, 'Pack heals exactly 10% max HP');
assert.equal(sandbox.state.healthPackPickups, 1);
assert.equal(sandbox.state.healthPacks.length, 0);
sandbox.engine.player.hp = 1000;
rngValue = 0.039;
assert.equal(api.maybeDropHealthPack({ x: 500, y: 500 }), true, 'Full HP does not suppress the flat drop roll');
sandbox.state.healthPacks = [];
sandbox.engine.player.hp = 10;
rngValue = 0.04;
assert.equal(api.maybeDropHealthPack({ x: 500, y: 500 }), false, 'Critical HP does not raise the flat 4% chance');
sandbox.engine.time = 20;
rngValue = 0.001;
assert.equal(api.maybeDropHealthPack({ x: 500, y: 500 }), true);
sandbox.engine.time = 28;
api.updateHealthPacks();
assert.equal(sandbox.state.healthPacks.length, 0, 'Pack expires at 8 seconds');
near(sandbox.engine.player.hp, 10, 'Expired distant pack does not heal');
assert.equal(sandbox.state.healthPackDrops, 3);
sandbox.state.healthPacks = [{ x: 0, y: 120, r: 24, bornAt: 28, expiresAt: 36 }];
const ctx = {
  save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, arc() {},
  fill() {}, stroke() {}, fillRect() {}, fillText() {},
};
api.drawHealthPacks(ctx);

// Lock the shipped seams so a future refactor cannot leave the tested logic
// orphaned from actual wave flow, kill flow, rendering or boot.
for (const required of [
  "const BOT_WAVE_SAVE_KEY='apex-botwave-save-v1';",
  'state.wave++;state.healthPacks.length=0;state.autoNextWave=false;state.nextWaveT=0;',
  'captureBoundarySnapshot(state.wave);state.phase=\'combat\';',
  'captureBoundarySnapshot(state.wave+1);',
  "if(state.phase==='gameover')prepareClusterRetry();",
  "UI['w-go'].textContent='↻ RETRY WAVE '+retryWave;",
  'state.waveSnapshot=retry;persistRun();',
  '\n updateHealthPacks();\n if(!state.queue.length',
  'drawHealthPacks(ctx);',
  'restoreSavedRunAtBoot();',
  'presentRunIntro();engine.paused=true;',
  "window.addEventListener('pagehide',()=>{finishGuard('pagehide');persistRun();",
  "document.addEventListener('visibilitychange',()=>{if(document.hidden){finishGuard('hidden');persistRun();}});",
  'state.waveSnapshot=null;state.clusterSnapshot=null;clearSavedRun();',
  'healthPacks:state.healthPacks.length',
  'savedWave:state.waveSnapshot?.wave||0',
  'clusterWave:state.clusterSnapshot?.wave||0',
]) assert.ok(game.includes(required), `Missing CP3 seam: ${required}`);
const dropIndex = game.indexOf('maybeDropHealthPack(e);');
const xpIndex = game.indexOf('gainXP(base);', dropIndex);
assert.ok(dropIndex >= 0 && xpIndex > dropIndex, 'Health-pack roll must live in the real kill seam before XP');
assert.ok(!game.includes("state.phase==='complete'||state.phase==='gameover')restart"),
  'Defeat must not route to the old full-run restart');
const dropFn = game.slice(game.indexOf('function maybeDropHealthPack'), game.indexOf('function updateHealthPacks'));
assert.ok(!dropFn.includes('engine.player.hp') && !dropFn.includes('p.hp'),
  'Health-pack probability must not inspect player HP (no pity)');

console.log('BOT WAVE persistence PASS: wave/cluster snapshots, exit resume, loss rollback, flat 4% health packs');
