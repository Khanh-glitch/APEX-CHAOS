// BOT WAVE 41-weapon execution gate.
//
// This deliberately boots the shipped BOT WAVE dependency order in a VM:
// arsenalConfig -> waveCampaign -> nativeArsenalGoldBridge -> C weapon set,
// createArmory(), presentation boundary, arsenalWeaponRuntime, connect().
// Only the Gold engine seam and the presentation AV seam are stubbed. Every
// holder, projectile, damage number, phase and consumption transition below
// is produced by the production Free Battle Arsenal runtime through the
// production BOT WAVE native bridge. The removed fake armoryRuntime and its
// engine.projs / waveDamage model must never come back.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const DT = 0.016;
const MAX_TICKS = 320;
const PLAYER_MAX_HP = 1_000_000;
const ENEMY_MAX_HP = 100_000;

let nowMs = 0;

function makeElement() {
  return {
    style: {},
    dataset: {},
    children: [],
    setAttribute() {},
    getAttribute() { return null; },
    appendChild(child) { this.children.push(child); return child; },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() {
      return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
    },
  };
}

const documentStub = {
  body: makeElement(),
  documentElement: makeElement(),
  head: makeElement(),
  getElementById() { return null; },
  createElement() { return makeElement(); },
  addEventListener() {},
  removeEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
};

const sandbox = {
  console,
  document: documentStub,
  performance: { now: () => nowMs },
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  addEventListener() {},
  removeEventListener() {},
};
sandbox.window = sandbox;
sandbox.self = sandbox;

const context = vm.createContext(sandbox);
// The VM sandbox is the window/global object, matching the browser contract
// the bridge uses when it installs bare Apex globals. Deterministic random
// must be installed before createArmory captures APEX_ARSENAL.combatRng.
vm.runInContext('Math.random = () => 0.5;', context, { filename: '<botwave-41-deterministic-random>' });

function load(path) {
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path, timeout: 10_000 });
}

for (const path of [
  'public/game/arsenal/arsenalConfig.js',
  'public/game/bot-wave/waveCampaign.js',
  'public/game/bot-wave/nativeArsenalGoldBridge.js',
  'public/game/arsenal/arsenalCWeaponSet.generated.js',
]) load(path);

const config = sandbox.APEX_ARSENAL_CONFIG;
const campaign = sandbox.APEX_BOT_WAVE_CAMPAIGN;
assert.ok(config, 'arsenalConfig did not publish APEX_ARSENAL_CONFIG');
assert.ok(campaign, 'waveCampaign did not publish APEX_BOT_WAVE_CAMPAIGN');
assert.ok(sandbox.APEX_BOT_WAVE_NATIVE_BRIDGE, 'native BOT WAVE bridge did not publish its factory');
assert.equal(sandbox.APEX_BOT_WAVE_ARMORY, undefined, 'removed fake BOT WAVE armory global must stay absent');
assert.equal(
  fs.existsSync('public/game/bot-wave/armoryRuntime.js'),
  false,
  'removed fake armoryRuntime.js must not be recreated',
);
assert.equal(config.ARSENAL_DAMAGE_SCALE, 7, 'BOT WAVE must execute the canonical post-x7 Free Battle config');

const player = {
  id: 1,
  x: 180,
  y: 0,
  r: 34,
  hp: PLAYER_MAX_HP,
  maxHp: PLAYER_MAX_HP,
  vx: 0,
  vy: 0,
  guardT: 0,
  dead: false,
};

const goldCalls = {
  playerDamage: [],
  enemyDamage: [],
  counterStrike: [],
  combatCues: [],
};

const engine = {
  player,
  actx: null,
  waveCounterUnlocked: false,
  damagePlayer(amount, angle) {
    assert.ok(Number.isFinite(amount) && amount >= 0, `invalid Gold player damage ${amount}`);
    assert.ok(Number.isFinite(angle), `invalid Gold player damage angle ${angle}`);
    goldCalls.playerDamage.push(amount);
    player.hp -= amount;
    // Mirror Gold's own fixed impulse. The bridge must restore velocity after
    // this call so Arsenal's aqDamage impulse remains the only applied push.
    player.vx += Math.cos(angle) * 260;
    player.vy += Math.sin(angle) * 260;
  },
  damageEnemy(actor, amount) {
    assert.ok(actor, 'Gold damageEnemy requires an actor');
    assert.ok(Number.isFinite(amount) && amount >= 0, `invalid Gold enemy damage ${amount}`);
    goldCalls.enemyDamage.push({ actor, amount });
    actor.hp -= amount;
  },
  counterStrike(source) {
    goldCalls.counterStrike.push(source);
  },
  fx: { flash() {} },
  material: { dust() {} },
  combatCue(name) { goldCalls.combatCues.push(name); },
  initAudio() {},
};

const armory = sandbox.APEX_BOT_WAVE_NATIVE_BRIDGE.createArmory({
  engine,
  config,
  campaign,
  cue() {},
  rand: () => 0.5,
});

const avCalls = [];
sandbox.APEX_ARSENAL_AV = {
  cue(event, detail = {}) {
    avCalls.push({ event, weapon: detail.weapon || null });
  },
  preload() {},
  tick() {},
  draw() {},
  clear() {},
  drawEquippedWeapon() { return true; },
  warmAudio() { return Promise.resolve(); },
  weaponMuzzleWorld() { return null; },
  imageByPath() { return null; },
  weaponImage() { return null; },
};

load('public/game/arsenal/arsenalWeaponRuntime.js');
armory.connect();

const projectiles = sandbox.projectiles;
assert.ok(Array.isArray(projectiles), 'bridge did not install the native projectiles array');
assert.equal(sandbox.fighters.length, 1, 'bridge must mirror exactly the Gold player into fighters[]');
assert.equal(sandbox.fighters[0].__goldActor, player, 'fighters[0] must be the Gold player proxy');

const indexed = campaign.indexNative(config);
assert.equal(indexed.records.length, 41, 'campaign must index exactly 41 native weapons');
const snapshot = armory.snapshot();
assert.equal(snapshot.backend, 'FREE_BATTLE_NATIVE');
assert.equal(snapshot.native41, 41, 'native bridge must connect exactly 41 real weapon executors');

function finiteProjectile(projectile, id, ownerProxy) {
  assert.equal(projectile.aq, true, `${id} produced a non-Arsenal projectile`);
  assert.equal(projectile.owner, ownerProxy, `${id} projectile owner must be the bridge enemy proxy`);
  assert.equal(projectile.weapon, id, `${id} projectile carried weapon=${projectile.weapon}`);
  assert.ok(String(projectile.type || '').startsWith('aq_'), `${id} projectile type is not native aq_*: ${projectile.type}`);
  for (const key of ['x', 'y', 'life']) {
    assert.ok(Number.isFinite(projectile[key]), `${id} projectile has non-finite ${key}: ${projectile[key]}`);
  }
  for (const key of ['vx', 'vy']) {
    if (key in projectile) {
      assert.ok(Number.isFinite(projectile[key]), `${id} projectile has non-finite ${key}: ${projectile[key]}`);
    }
  }
}

const results = [];

for (let ordinal = 0; ordinal < indexed.records.length; ordinal++) {
  const record = indexed.records[ordinal];
  const { id, family } = record;
  const catalogEntry = armory.weapons[id];

  assert.ok(catalogEntry, `native bridge catalog is missing ${id}`);
  assert.equal(catalogEntry.native, config.WEAPONS[id], `${id} catalog must reference the exact Free Battle spec`);
  assert.ok(sandbox.APEX_ARSENAL_WEAPONS[id], `real Arsenal executor is missing ${id}`);

  armory.reset();
  projectiles.length = 0;
  sandbox.APEX_ARSENAL.state.visuals.length = 0;
  sandbox.APEX_ARSENAL.state.detachedWeapons.length = 0;
  sandbox.cameraShake = 0;
  sandbox.hitStop = 0;

  player.x = family === 'MELEE' || family === 'SHIELD' ? 90 : 180;
  player.y = 0;
  player.hp = PLAYER_MAX_HP;
  player.vx = 0;
  player.vy = 0;
  player.guardT = 0;
  player.dead = false;

  goldCalls.playerDamage.length = 0;
  goldCalls.enemyDamage.length = 0;
  goldCalls.counterStrike.length = 0;
  goldCalls.combatCues.length = 0;
  avCalls.length = 0;

  const initialMag = catalogEntry.mag;
  const enemy = {
    id: 10_000 + ordinal,
    x: 0,
    y: 0,
    r: 30,
    hp: ENEMY_MAX_HP,
    vx: 0,
    vy: 0,
    dead: false,
    waveGunId: id,
    waveAmmo: initialMag,
    waveReloadT: 0,
    waveStunT: 0,
  };

  const enemyProxy = armory.activate(enemy);
  assert.equal(enemyProxy.__goldActor, enemy, `${id} proxy must retain its Gold actor identity`);
  assert.ok(!sandbox.fighters.includes(enemyProxy), `${id} enemy proxy must not be inserted into fighters[]`);

  const evidence = {
    phases: new Set(),
    holders: new Set(),
    projectiles: new Set(),
    carrierTypes: new Set(),
    maxLiveProjectiles: 0,
    maxShotsFired: 0,
    sawConsumed: false,
  };

  const collect = () => {
    const liveHolder = armory.liveHolder(enemy);
    if (liveHolder) evidence.holders.add(liveHolder);
    else evidence.sawConsumed = true;

    for (const holder of evidence.holders) {
      if (holder.phase) evidence.phases.add(holder.phase);
      if (holder.consumed) evidence.sawConsumed = true;
      evidence.maxShotsFired = Math.max(evidence.maxShotsFired, holder.shotsFired || 0);
    }

    evidence.maxLiveProjectiles = Math.max(evidence.maxLiveProjectiles, projectiles.length);
    for (const projectile of projectiles) {
      if (!evidence.projectiles.has(projectile)) {
        finiteProjectile(projectile, id, enemyProxy);
        evidence.projectiles.add(projectile);
        evidence.carrierTypes.add(projectile.type || projectile.kind || 'unknown');
      }
    }
  };

  collect();
  const initialHolder = armory.liveHolder(enemy);
  assert.ok(initialHolder, `${id} did not create a real native holder`);
  assert.equal(initialHolder.weaponId, id, `${id} holder weaponId mismatch`);

  const totalPlayerDamage = () => goldCalls.playerDamage.reduce((sum, amount) => sum + amount, 0);
  const hasExecutionEvidence = () => {
    if (family === 'SHIELD') return evidence.phases.has('GUARD');
    if (family === 'MELEE') return totalPlayerDamage() > 0 || evidence.projectiles.size > 0;
    return evidence.projectiles.size > 0 || totalPlayerDamage() > 0;
  };
  const hasLifecycleProjection = () =>
    enemy.waveAmmo < initialMag || enemy.waveReloadT > 0 || evidence.sawConsumed;

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    nowMs += DT * 1000;
    armory.fire(enemy, DT);
    collect();
    armory.update(DT);
    collect();

    if (family === 'SHIELD') {
      if (hasExecutionEvidence()) break;
    } else if (hasExecutionEvidence() && hasLifecycleProjection()) {
      break;
    }
  }

  const diagnostic = JSON.stringify({
    id,
    family,
    phases: [...evidence.phases],
    projectiles: evidence.projectiles.size,
    maxLiveProjectiles: evidence.maxLiveProjectiles,
    carriers: [...evidence.carrierTypes],
    playerDamage: totalPlayerDamage(),
    shotsFired: evidence.maxShotsFired,
    waveAmmo: enemy.waveAmmo,
    initialMag,
    waveReloadT: enemy.waveReloadT,
    consumed: evidence.sawConsumed,
    av: avCalls.filter(call => call.weapon === id).map(call => call.event),
  });

  const meleePhaseFallback = family === 'MELEE'
    && (evidence.phases.has('WINDUP') || evidence.phases.has('DASH') || evidence.phases.has('STRIKE'));
  assert.ok(
    hasExecutionEvidence() || meleePhaseFallback,
    `${id} produced no real native execution evidence: ${diagnostic}`,
  );
  assert.ok(player.hp > 0 && enemy.hp > 0, `${id} unexpectedly exhausted a test actor: ${diagnostic}`);
  assert.ok(
    avCalls.some(call => call.event === 'pickup' && call.weapon === id),
    `${id} did not pass through the real native equip AV boundary: ${diagnostic}`,
  );

  if (family === 'SHIELD') {
    assert.ok(
      avCalls.some(call => call.event === 'shield_activate' && call.weapon === id),
      `${id} entered GUARD without its native shield activation cue: ${diagnostic}`,
    );
    if (id === 'TOWER_SHIELD') {
      assert.equal(
        armory.protect(enemy, 100),
        100 * config.WEAPONS.TOWER_SHIELD.damageTakenMult,
        'Tower Shield bridge protection must use the exact Free Battle GUARD multiplier',
      );
    }
  } else {
    assert.ok(hasLifecycleProjection(), `${id} never projected native ammo/reload/consumption to BOT WAVE: ${diagnostic}`);
    const pellets = config.WEAPONS[id]?.pellets || 0;
    if (pellets > 1) {
      assert.ok(
        evidence.projectiles.size >= pellets,
        `${id} must emit its full native ${pellets}-pellet volley: ${diagnostic}`,
      );
    }
  }

  results.push({
    id,
    family,
    projectiles: evidence.projectiles.size,
    playerDamage: totalPlayerDamage(),
    guard: evidence.phases.has('GUARD'),
  });
}

assert.equal(results.length, 41);
assert.equal(new Set(results.map(result => result.id)).size, 41, 'all 41 executions must be distinct weapons');
assert.equal(results.filter(result => result.guard).length, 2, 'both native shields must enter GUARD');
assert.equal('projs' in engine, false, 'native BOT WAVE execution must not create the fake Gold engine.projs model');

const familyById = new Map(results.map(result => [result.id, result.family]));
for (const id of Array.from(config.V43_SPECIAL_IDS)) {
  assert.equal(familyById.get(id), 'SPECIAL', `${id} must execute as a V43 special`);
}
assert.equal(familyById.get('TOWER_SHIELD'), 'SHIELD');
assert.equal(familyById.get('SWIRL_SHIELD'), 'SHIELD');
assert.equal(familyById.get('STORMBREAKER'), 'MELEE');

console.log('BOT WAVE 41/41 native execution PASS: production bridge + real Free Battle holders/projectiles/damage; both shields GUARD; no fake armory or engine.projs');
