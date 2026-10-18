// BOT WAVE post-x7 balance gate.
//
// The campaign director must balance the REAL Free Battle damage authority
// (arsenalConfig + arsenalIdentityRuntime + arsenalWeaponRuntime), not the
// authored pre-scale numbers. This gate independently derives sustained
// pressure from weaponApi.scaledDamage, compares it with the pressure scores
// carried by every planned carrier, and locks the spawn budgets/HP envelope
// that keep simultaneous fire survivable without rescaling any gun.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = {
  console,
  performance: { now: () => 0 },
  setTimeout: () => 0,
  clearTimeout() {},
  setInterval: () => 0,
  clearInterval() {},
  requestAnimationFrame: () => 0,
  addEventListener() {},
  removeEventListener() {},
  document: {
    body: { appendChild() {} },
    documentElement: {},
    head: {},
    getElementById() { return null; },
    createElement() {
      return { style: {}, dataset: {}, appendChild() {}, remove() {}, setAttribute() {} };
    },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  },
};
sandbox.window = sandbox;
sandbox.self = sandbox;

const context = vm.createContext(sandbox);
vm.runInContext('Math.random = () => 0.5;', context, { filename: '<botwave-balance-random>' });
const load = (path) => vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });

load('public/game/arsenal/arsenalConfig.js');
load('public/game/arsenal/arsenalIdentityRuntime.js');
sandbox.APEX_ARSENAL = {
  state: { visuals: [], detachedWeapons: [], resultLedger: null },
  events: [],
  log() {},
  combatRng: () => 0.5,
};
Object.assign(sandbox, {
  GAME_SIZE: 2000,
  TAU: Math.PI * 2,
  clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
  norm: (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  },
  dist: (x, y, a, b) => Math.hypot(x - a, y - b),
  emitParticles() {},
  spawnShockwave() {},
  triggerFlash() {},
  playFighterSound() {},
  cameraShake: 0,
  hitStop: 0,
  projectiles: [],
  fighters: [],
  avCue() {},
});
load('public/game/arsenal/arsenalCWeaponSet.generated.js');
load('public/game/arsenal/arsenalWeaponRuntime.js');
load('public/game/bot-wave/waveCampaign.js');

const config = sandbox.APEX_ARSENAL_CONFIG;
const campaign = sandbox.APEX_BOT_WAVE_CAMPAIGN;
const weaponApi = sandbox.APEX_ARSENAL.weaponApi;
assert.equal(sandbox.apexArsenalIdentityRuntime, 'ready');
assert.equal(config.isGun?.('PISTOL'), true);
assert.equal(
  weaponApi.scaledDamage(config.WEAPONS.PISTOL.damagePerShot, 'PISTOL', false),
  31.5,
  'balance must start from realized post-x7 Pistol damage',
);

function critMultiplier(id) {
  if (!config.isGun?.(id)) return 1;
  return 1 + (config.CRIT_CHANCE?.[id] || 0) * ((config.CRIT_DAMAGE_MULTIPLIER || 1.5) - 1);
}

function pelletHits(spec) {
  const pellets = spec.pellets || 1;
  if (pellets <= 1) return 1;
  const hitRadius = 30 + (spec.bulletRadius || 7);
  let hits = 0;
  for (let i = 0; i < pellets; i++) {
    const t = i / (pellets - 1);
    if (Math.abs(275 * Math.tan((t - 0.5) * (spec.cone || 0))) <= hitRadius) hits++;
  }
  return Math.max(1, hits);
}

function cycleSeconds(spec, family) {
  const ready = config.RANGED_READY_DELAY_SECONDS || 0.35;
  const rearm = family === 'PRECISION' || family === 'SPECIAL'
    ? 1.35
    : family === 'SHOTGUN' || family === 'AUTOSHOT' ? 1.2 : 0.85;
  if (family === 'PRECISION') {
    return ready + (spec.aimTime || 0.5)
      + Math.max(0, (spec.shots || 1) - 1) * (spec.interval || 0.45) + rearm;
  }
  if (family === 'SHOTGUN' && !spec.shots) return ready + rearm;
  const shots = Math.max(1, spec.shots || 1);
  const interval = spec.interval || 0;
  let firing = 0;
  for (let shot = 1; shot <= shots; shot++) {
    const burstEnd = spec.burstSize && shot % spec.burstSize === 0 && shot < shots;
    const step = burstEnd ? (spec.burstPause || interval) : interval;
    if (shot < shots || !(family === 'AUTOSHOT' || family === 'SHOTGUN' || shots === 1)) firing += step;
  }
  return ready + firing + rearm;
}

function specialDamage(spec) {
  if (spec.direct) return spec.direct + (spec.burnTicks || 0) * (spec.burnDamage || 0);
  if (spec.outgoing) return spec.outgoing + (spec.returning || 0);
  if (spec.ticks) return spec.ticks * (spec.tickDamage || 0) + (spec.burnTicks || 0) * (spec.burnDamage || 0);
  if (spec.coreDamage) return spec.coreDamage + (spec.shardDamage || 0);
  if (spec.peak) return spec.peak + (spec.maxFragmentHits || 0) * (spec.fragmentDamage || 0);
  return spec.damage || spec.maxDamage || 80;
}

function independentPressure(record) {
  const { id, family, spec } = record;
  if (family === 'SHIELD') return 0;
  if (family === 'SPECIAL') return specialDamage(spec) / 2.9;
  if (id === 'GRENADE') return weaponApi.scaledDamage(spec.maxDamage || 20, id, false) * 0.65 / 1.95;
  if (family === 'MELEE') {
    const input = typeof config.meleeDamage === 'function' ? config.meleeDamage(id) : (spec.damage || 0);
    return weaponApi.scaledDamage(input, id, false) / 2.2;
  }
  const shots = Math.max(1, spec.shots || 1);
  const perShot = family === 'PRECISION'
    ? weaponApi.scaledDamage(spec.damage || 0, id, false)
    : (spec.pellets || 1) > 1
      ? weaponApi.scaledDamage(spec.damagePerPellet || 0, id, false) * pelletHits(spec)
      : weaponApi.scaledDamage(spec.damagePerShot || spec.damage || 0, id, false);
  return perShot * shots * critMultiplier(id) / cycleSeconds(spec, family);
}

const catalog = campaign.indexNative(config);
const campaignPressure = new Map();
const plans = new Map();
for (let wave = 1; wave <= 60; wave++) {
  const plan = campaign.planWave(config, wave);
  plans.set(wave, plan);
  for (const entry of plan.composition) {
    if (!campaignPressure.has(entry.weaponId)) campaignPressure.set(entry.weaponId, entry.pressure);
  }
}
assert.equal(campaignPressure.size, 41, 'every weapon must receive a campaign pressure score by wave 60');

for (const record of catalog.records) {
  const expected = independentPressure(record);
  const actual = campaignPressure.get(record.id);
  assert.ok(Number.isFinite(actual) && actual >= 0, `${record.id} campaign pressure must be finite`);
  assert.ok(
    Math.abs(actual - expected) <= Math.max(1.5, expected * 0.08),
    `${record.id} campaign pressure ${actual} drifted from independent post-x7 pressure ${expected}`,
  );
}
assert.ok(campaignPressure.get('MAGNUM_500') > campaignPressure.get('PISTOL') * 2.5);
assert.ok(campaignPressure.get('SNIPER') > campaignPressure.get('SMG') * 1.5);
assert.ok(campaignPressure.get('STORMBREAKER') >= 180, 'final-authority Stormbreaker must remain an elite pressure carrier');
assert.equal(campaignPressure.get('TOWER_SHIELD'), 0);
assert.equal(campaignPressure.get('SWIRL_SHIELD'), 0);

const budgetBands = {
  farm: [100, 190],
  teach: [140, 260],
  mix: [200, 330],
  spike: [260, 390],
  power: [180, 280],
  crescendo: [300, 480],
  boss: [240, 380],
};

function simulatedMaxActivePressure(plan) {
  const active = [];
  let maxPressure = 0;
  const sum = () => active.reduce((total, value) => total + value, 0);
  for (const entry of plan.composition) {
    while (active.length >= plan.concurrentLimit
      || (active.length && sum() + entry.pressure > plan.pressureBudget)) {
      let lowest = 0;
      for (let i = 1; i < active.length; i++) if (active[i] < active[lowest]) lowest = i;
      active.splice(lowest, 1);
    }
    active.push(entry.pressure);
    maxPressure = Math.max(maxPressure, sum());
  }
  return maxPressure;
}

for (const plan of plans.values()) {
  const [minBudget, maxBudget] = budgetBands[plan.beat];
  assert.ok(plan.concurrentLimit >= 2 && plan.concurrentLimit <= 8, `wave ${plan.wave} cap out of balance envelope`);
  assert.ok(plan.spawnInterval >= 0.24 && plan.spawnInterval <= 0.7, `wave ${plan.wave} spawn interval out of balance envelope`);
  assert.ok(
    plan.pressureBudget >= minBudget && plan.pressureBudget <= maxBudget,
    `wave ${plan.wave} ${plan.beat} pressure budget ${plan.pressureBudget} outside ${minBudget}-${maxBudget}`,
  );
  assert.ok(plan.composition.length <= (plan.boss ? 15 : 34), `wave ${plan.wave} count exceeds the post-x7 envelope`);
  const highestSingle = Math.max(...plan.composition.map((entry) => entry.pressure));
  assert.ok(
    simulatedMaxActivePressure(plan) <= Math.max(plan.pressureBudget, highestSingle) + 1e-9,
    `wave ${plan.wave} spawn queue can exceed its pressure budget`,
  );
}

const wave1 = plans.get(1);
assert.equal(wave1.concurrentLimit, 2);
assert.equal(wave1.pressureBudget, 110);
assert.ok(wave1.composition.every((entry) => entry.weaponId === 'PISTOL'));
assert.equal(plans.get(10).bossHp, 2250);
assert.equal(plans.get(20).bossHp, 2800);
assert.equal(plans.get(30).bossHp, 3350);
assert.ok(Math.max(...[...plans.values()].map((plan) => plan.bossHp || 0)) <= 9000);

function normalBotHp(wave) {
  const plan = plans.get(wave);
  return Math.max(32, Math.round(
    Math.min(320, 110 * (1 + 0.022 * Math.min(wave - 1, 50))) * plan.enemyHpMultiplier,
  ));
}
assert.ok(normalBotHp(1) <= 70, 'wave 1 fodder must fall inside one base three-hit BOXE combo');
assert.ok(normalBotHp(4) <= 115, 'wave 4 TTK must not expose the player to the first Sniper wave for too long');
assert.ok(normalBotHp(9) <= 145, 'final-pressure escorts must stay inside the post-x7 TTK envelope');
assert.ok(normalBotHp(10) <= 130, 'boss escorts must not become HP sponges around the boss');
assert.ok(normalBotHp(30) <= 185, 'cluster 3 escorts must scale with build growth without restoring sponge TTK');

assert.equal(campaign.survival.startingHP, 1000);
assert.deepEqual(JSON.parse(JSON.stringify(campaign.survival.healthPack)), {
  dropChance: 0.04,
  healFraction: 0.10,
  lifetimeSeconds: 8,
  maxActive: 1,
});

const game = fs.readFileSync('public/bot-wave/game.html', 'utf8');
assert.ok(game.includes('function activePressure()'), 'Gold spawn loop must measure active carrier pressure');
assert.ok(
  game.includes('activePressure()+(nextSpawn.pressure||0)<=state.pressureBudget'),
  'Gold spawn loop must enforce the campaign pressure budget',
);
assert.ok(game.includes('wavePressure:desc.pressure||0'), 'spawned BOTs must retain their planned pressure score');
assert.ok(game.includes('110*(1+.022*Math.min(state.wave-1,50))'), 'normal BOT HP growth must stay on the flattened post-x7 curve');
assert.ok(game.includes('Math.min(320,'), 'normal BOT HP must retain the post-x7 base cap');

console.log('BOT WAVE post-x7 balance PASS: identity-derived pressure budgets, flattened endless scaling, bounded BOT/boss TTK, gun stats untouched');
