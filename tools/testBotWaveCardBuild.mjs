import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const game = fs.readFileSync('public/bot-wave/game.html', 'utf8');

function near(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) <= 1e-9,
    `${label}: expected ${expected}, got ${actual}`,
  );
}

// Execute the real card catalogue literal from the shipped monolith. This
// catches duplicate IDs and malformed weights/requires instead of treating
// the card list as inert text.
const cardsStart = game.indexOf('const CARDS=');
const cardsEnd = game.indexOf('\n];', cardsStart);
assert.ok(cardsStart >= 0 && cardsEnd > cardsStart, 'CARDS literal not found');
const cardsExpr = game.slice(cardsStart + 'const CARDS='.length, cardsEnd + 2);
// Normalize across the VM realm boundary so deepStrictEqual compares data,
// not the different Object prototypes owned by the VM context.
const cards = JSON.parse(JSON.stringify(vm.runInNewContext(`(${cardsExpr})`)));
assert.equal(cards.length, 20, 'BOT WAVE must expose the expanded 20-card pool');
assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, 'Card IDs must be unique');
for (const card of cards) {
  assert.ok(card.label && card.desc && card.tier, `Card presentation incomplete: ${card.id}`);
  assert.ok(Number.isFinite(card.weight) && card.weight > 0, `Invalid card weight: ${card.id}`);
  if (card.max !== undefined) assert.ok(Number.isInteger(card.max) && card.max > 0, `Invalid card max: ${card.id}`);
}
const byId = new Map(cards.map((card) => [card.id, card]));
assert.deepEqual(
  {
    armor: byId.get('armor'),
    insight: byId.get('insight'),
    overclock: byId.get('overclock'),
    counterFocus: byId.get('counterFocus'),
    rocketPrimer: byId.get('rocketPrimer'),
  },
  {
    armor: { id: 'armor', label: 'GIÁP LÕI', desc: '-5% sát thương phải nhận (tối đa 30%)', tier: 'COMMON', weight: 30, max: 6 },
    insight: { id: 'insight', label: 'KINH NGHIỆM THỰC CHIẾN', desc: '+10% XP nhận được', tier: 'RARE', weight: 18, max: 8 },
    overclock: { id: 'overclock', label: 'ÉP XUNG KỸ NĂNG', desc: '-7% thời gian hồi kỹ năng đã mở', tier: 'EPIC', weight: 12, max: 7, requires: ['jab'] },
    counterFocus: { id: 'counterFocus', label: 'MỞ RỘNG PHẢN ĐÒN', desc: '+0,25s cửa sổ GOLDEN COUNTER', tier: 'EPIC', weight: 10, max: 6, requires: ['counter'] },
    rocketPrimer: { id: 'rocketPrimer', label: 'MỒI ROCKET', desc: '+1,5 điểm % tỉ lệ FIST ROCKET mỗi đòn trúng', tier: 'EPIC', weight: 10, max: 6, requires: ['rocket'] },
  },
);

// Execute the actual applyStacksDerived() shipped in game.html. This is the
// core CP2 contract: stats are a pure function of state.stacks, so CP3 can
// restore a build exactly by restoring stacks and recomputing once.
const fnStart = game.indexOf('function applyStacksDerived');
const fnEndMarker = '\n}\n/* THE LAST ROUND';
const fnEnd = game.indexOf(fnEndMarker, fnStart);
assert.ok(fnStart >= 0 && fnEnd > fnStart, 'applyStacksDerived not found');
const fnText = game.slice(fnStart, fnEnd + 2);
const sandbox = {
  Math,
  clamp: (value, lo, hi) => Math.min(hi, Math.max(lo, value)),
  CAMPAIGN: { survival: { startingHP: 1000, baseKillHealFraction: 0.005 } },
  state: {
    stacks: {},
    owned: new Set(),
    damageMul: 99,
    punchMul: 99,
    moveMul: 99,
    guardBonus: 99,
    knockMul: 99,
    dashCdMul: 99,
    skillCdMul: 99,
    armor: 99,
    xpMul: 99,
    counterWindowBonus: 99,
    rocketChance: 99,
    healOnKill: 99,
  },
  engine: {
    player: { hp: 500, maxHp: 9999 },
    waveCounterUnlocked: true,
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`${fnText};globalThis.applyStacksDerived=applyStacksDerived;`, sandbox);
const apply = sandbox.applyStacksDerived;
assert.equal(typeof apply, 'function');

apply();
near(sandbox.engine.player.maxHp, 1000, 'baseline maxHp');
near(sandbox.engine.player.hp, 500, 'baseline hp preserved');
near(sandbox.state.damageMul, 1, 'baseline fist');
near(sandbox.state.punchMul, 1, 'baseline tempo');
near(sandbox.state.moveMul, 1, 'baseline agility');
near(sandbox.state.guardBonus, 0, 'baseline guard');
near(sandbox.state.knockMul, 1, 'baseline knock');
near(sandbox.state.dashCdMul, 1, 'baseline dash');
near(sandbox.state.skillCdMul, 1, 'baseline skill CD');
near(sandbox.state.armor, 0, 'baseline armor');
near(sandbox.state.xpMul, 1, 'baseline XP');
near(sandbox.state.counterWindowBonus, 0, 'baseline counter window');
near(sandbox.state.rocketChance, 0.075, 'baseline rocket chance');
near(sandbox.state.healOnKill, 0.005, 'baseline kill heal');
assert.equal(sandbox.engine.waveCounterUnlocked, false);

sandbox.state.stacks = {
  fist: 2,
  tempo: 3,
  agility: 2,
  guard: 4,
  knock: 3,
  dash: 2,
  overclock: 2,
  armor: 4,
  insight: 3,
  counterFocus: 2,
  rocketPrimer: 4,
  sustain: 2,
  vitality: 2,
};
sandbox.state.owned = new Set(['counter']);
sandbox.engine.player.hp = 800;
sandbox.engine.player.maxHp = 1000;
apply({ healIncrease: true });
near(sandbox.state.damageMul, 1.13 ** 2, 'fist stacks');
near(sandbox.state.punchMul, 0.93 ** 3, 'tempo stacks');
near(sandbox.state.moveMul, 1.07 ** 2, 'agility stacks');
near(sandbox.state.guardBonus, 0.32, 'guard stacks');
near(sandbox.state.knockMul, 1.54, 'knock stacks');
near(sandbox.state.dashCdMul, 0.81, 'dash stacks');
near(sandbox.state.skillCdMul, 0.93 ** 2, 'overclock stacks');
near(sandbox.state.armor, 0.2, 'armor stacks');
near(sandbox.state.xpMul, 1.1 ** 3, 'insight stacks');
near(sandbox.state.counterWindowBonus, 0.5, 'counter focus stacks');
near(sandbox.state.rocketChance, 0.135, 'rocket primer stacks');
near(sandbox.state.healOnKill, 0.039, 'sustain stacks');
near(sandbox.engine.player.maxHp, 1254.4, 'vitality maxHp');
near(sandbox.engine.player.hp, 1054.4, 'vitality heals only the newly added maxHp');
assert.equal(sandbox.engine.waveCounterUnlocked, true);

// Deterministic rollback: the same function must erase a built-up character
// completely when CP3 restores an earlier stack snapshot.
sandbox.state.stacks = { armor: 99, fist: -8 };
apply();
near(sandbox.state.armor, 0.3, 'armor is hard-capped at 30%');
near(sandbox.state.damageMul, 1, 'negative/corrupt stacks cannot debuff below baseline');
sandbox.state.stacks = {};
sandbox.state.owned = new Set();
sandbox.engine.player.hp = 2000;
apply();
near(sandbox.engine.player.maxHp, 1000, 'rollback maxHp');
near(sandbox.engine.player.hp, 1000, 'rollback clamps hp to restored maxHp');
near(sandbox.state.damageMul, 1, 'rollback fist');
near(sandbox.state.knockMul, 1, 'rollback knock');
near(sandbox.state.dashCdMul, 1, 'rollback dash');
near(sandbox.state.healOnKill, 0.005, 'rollback kill heal');
assert.equal(sandbox.engine.waveCounterUnlocked, false);

// The derived values must be consumed by the real pilot seams. A correct
// formula that no combat path reads would simply recreate the old dead
// knock/dash defects under a new name.
for (const required of [
  "applyStacksDerived({healIncrease:id==='vitality'})",
  'applyStacksDerived();engine.player.hp=engine.player.maxHp;',
  'engine.waveCounterUnlocked=false;applyStacksDerived();',
  'state.xp+=xp*(state.xpMul||1)',
  'kx:(opts.kx||0)*state.knockMul',
  'ky:(opts.ky||0)*state.knockMul',
  'R2_PRESENT.hit(e,done,hitOpts||{})',
  'const effective=Math.max(0,dmg*(1-(state.armor||0)))',
  'function castGoldSkill(id)',
  'engine.cds.set(id,afterCd*state.skillCdMul)',
  "if(id==='counter'&&state.counterWindowBonus)engine.player.guardT+=state.counterWindowBonus",
  'const nativeDash=engine.dash.bind(engine)',
  'this.player.dashCd*=state.dashCdMul',
  'roll>=(state.rocketChance??.075)',
  "castGoldSkill('rocket')",
  "castGoldSkill('jab')",
  "castGoldSkill('uppercut')",
  'this.player.basicCd*=state.punchMul',
  'const speed=state.moveMul*ARMORY.movementSlow()',
]) {
  assert.ok(game.includes(required), `Missing CP2 combat seam: ${required}`);
}

// Retired incremental mutations must not return: they made snapshot rollback
// mathematically ambiguous and left knock/dash partly or wholly inert.
for (const retired of [
  "if(id==='vitality'){let heal=engine.player.maxHp*.12",
  "else if(id==='fist')state.damageMul*=1.13",
  "else if(id==='tempo')state.punchMul*=.93",
  "else if(id==='agility')state.moveMul*=1.07",
  "else if(id==='guard')state.guardBonus+=.08",
  "else if(id==='sustain')state.healOnKill+=.017",
  "else if(id==='dash')engine.player.dashCd=Math.max(0,engine.player.dashCd*.90)",
  'state.healOnKill=.012',
  "originalCast('rocket')",
  "originalCast('jab')",
  "originalCast('uppercut')",
  'roll>=.075',
]) {
  assert.ok(!game.includes(retired), `Retired CP2 defect returned: ${retired}`);
}

console.log('BOT WAVE card build PASS: 20 cards, deterministic stack-derived stats, live knock/dash/skill seams');
