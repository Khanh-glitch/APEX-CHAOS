// Phase 2B: current Arsenal shells must be behaviorally isolated from legacy
// FighterType callbacks, while generic Battle may retain the historical runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PRODUCT_ROSTER } from '../src/game/productSurface.js';
import {
  ARSENAL_PRODUCT_RUNTIMES,
  CURRENT_COMBAT_CORE_RUNTIMES,
} from '../src/game/runtimeManifest.js';
import { LEGACY_COMBAT_CORE_RUNTIMES } from './legacyRuntimeManifest.mjs';

const runtimeKey = (src) => String(src).split(/[?#]/, 1)[0];
const productPaths = ARSENAL_PRODUCT_RUNTIMES.map(([src]) => runtimeKey(src));
const genericCorePaths = LEGACY_COMBAT_CORE_RUNTIMES.map(([src]) => runtimeKey(src));
const currentCorePaths = CURRENT_COMBAT_CORE_RUNTIMES.map(([src]) => runtimeKey(src));
const legacyMajor = '/game/core/apexMajorMechanicVisuals.js';

assert.ok(!productPaths.includes(legacyMajor),
  'current Arsenal product graph must not load apexMajorMechanicVisuals');
assert.ok(genericCorePaths.includes(legacyMajor),
  'test-only legacy fixture keeps apexMajorMechanicVisuals for regression compatibility');
assert.deepEqual(currentCorePaths, [
  '/game/core/apexBattleSfxRuntime.js',
  '/game/core/apexRenderPrimitives.js',
  '/game/core/apexCombatEffectsRuntime.js',
]);

let poisonCalls = 0;
function poisonLegacyCallback() {
  poisonCalls += 1;
  throw new Error('legacy FighterType behavior leaked into current Arsenal shell');
}

const legacyTypes = PRODUCT_ROSTER.visibleIds.map((name, index) => ({
  name,
  color: `#${String(index + 1).padStart(6, '0')}`,
  desc: 'POISON LEGACY DESC',
  speed: 9999,
  startDx: 0.25 + index * 0.01,
  startDy: 0.5 + index * 0.01,
  init: poisonLegacyCallback,
  update: poisonLegacyCallback,
  draw: poisonLegacyCallback,
  speedModifier: poisonLegacyCallback,
  onCollide: poisonLegacyCallback,
  onWallBounce: poisonLegacyCallback,
  onRage: poisonLegacyCallback,
  onTakeDamage: poisonLegacyCallback,
}));

let currentShellUpdates = 0;
const window = {
  APEX_ARSENAL_CONFIG: { FIGHTER_SPEED: 450 },
  APEX_PRODUCT_SURFACE: {
    roster: {
      visibleIds: PRODUCT_ROSTER.visibleIds.slice(),
      playableIds: PRODUCT_ROSTER.playableIds.slice(),
    },
  },
  APEX_HERO_REWORK_REGISTRY: {
    displayNameFor(id) { return id === 'ICE' ? 'FROST' : id; },
  },
  APEX_HERO_REWORK: {
    shellUpdate() { currentShellUpdates += 1; },
  },
};
window.window = window;

const context = vm.createContext({
  window,
  FighterTypes: legacyTypes,
  Map,
  Array,
  String,
  Object,
  Math,
  p1Selection: null,
  p2Selection: null,
  goToSelect() {},
});

const source = fs.readFileSync('public/game/arsenal/arsenalShellSelectRuntime.js', 'utf8');
vm.runInContext(source, context, { filename: 'arsenalShellSelectRuntime.js' });

assert.equal(window.apexArsenalShellSelectRuntime, 'ready');
const shells = window.APEX_ARSENAL_SHELLS;
assert.ok(shells);
assert.deepEqual(Array.from(shells.visibleIds), Array.from(PRODUCT_ROSTER.visibleIds));
assert.deepEqual(Array.from(shells.playableIds), Array.from(PRODUCT_ROSTER.playableIds));

const forbiddenBehaviorKeys = [
  'draw', 'speedModifier', 'onCollide', 'onWallBounce', 'onRage', 'onTakeDamage',
];

for (let i = 0; i < PRODUCT_ROSTER.visibleIds.length; i += 1) {
  const id = PRODUCT_ROSTER.visibleIds[i];
  const base = legacyTypes[i];
  const shell = shells.typeFor(id);
  assert.ok(shell, `${id}: visible shell must resolve`);
  assert.equal(shell.compatKit, 'REWORK', `${id}: current compat authority`);
  assert.equal(shell.arsenalShell, true);
  assert.equal(shell.__hrHero, id);
  assert.equal(shell.speed, 450, `${id}: legacy speed must not leak`);
  assert.notEqual(shell.desc, base.desc, `${id}: legacy description must not leak`);
  assert.equal(shell.color, base.color, `${id}: cosmetic color metadata may carry forward`);
  assert.equal(shell.startDx, base.startDx, `${id}: neutral spawn vector metadata may carry forward`);
  assert.equal(shell.startDy, base.startDy, `${id}: neutral spawn vector metadata may carry forward`);
  assert.notEqual(shell.init, base.init, `${id}: legacy init must not leak`);
  assert.notEqual(shell.update, base.update, `${id}: legacy update must not leak`);

  for (const key of forbiddenBehaviorKeys) {
    assert.equal(Object.prototype.hasOwnProperty.call(shell, key), false,
      `${id}: legacy behavior key ${key} must not exist on current shell`);
  }

  const fighter = { data: null };
  shell.init(fighter);
  assert.ok(fighter.data && typeof fighter.data === 'object');
  assert.equal(Object.keys(fighter.data).length, 0,
    `${id}: current shell init must create an empty data bag without legacy init behavior`);
  shell.update(fighter, {}, 1 / 60);
}

assert.equal(poisonCalls, 0, 'no poisoned legacy callback may execute');
assert.equal(currentShellUpdates, PRODUCT_ROSTER.visibleIds.length,
  'every visible current shell routes update to Hero Rework authority');

console.log('PASS  current Arsenal shells are isolated from legacy FighterType mechanics while generic Battle retains legacy compatibility');
