// Focused contract for the current Arsenal draw-error recovery seam.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/game/core/apexArsenalProductDrawRecoveryRuntime.js', 'utf8');

assert.doesNotMatch(source, /stableClean|SLIME|cloneDepth|projectiles\.splice|particles\.splice|floatingTexts\.splice|shockwaves\.splice|fighters\.splice|maxHp|baseSpeed/,
  'current draw recovery must not migrate legacy mutation/cap behavior');

const errors = [];
const ctx = {
  globalAlpha: 0.2,
  globalCompositeOperation: 'lighter',
  filter: 'blur(3px)',
  transforms: [],
  setTransform(...args) { this.transforms.push(args); },
};

const fighters = [{ hp: NaN, x: NaN }, { hp: 5, x: 10 }, { hp: 7, x: 20 }];
const projectiles = new Array(200).fill(null).map((_, i) => ({ i }));
const particles = new Array(400).fill(null).map((_, i) => ({ i }));
const floatingTexts = new Array(140).fill(null).map((_, i) => ({ i }));
const shockwaves = new Array(90).fill(null).map((_, i) => ({ i }));
const before = {
  fighters: JSON.stringify(fighters),
  projectiles: projectiles.length,
  particles: particles.length,
  floatingTexts: floatingTexts.length,
  shockwaves: shockwaves.length,
};

let hudCalls = 0;
let updateCalls = 0;
const updateSentinel = function updateSentinel() { updateCalls += 1; };
const window = {};
const context = vm.createContext({
  window,
  console: { error(...args) { errors.push(args); } },
  ctx,
  fighters,
  projectiles,
  particles,
  floatingTexts,
  shockwaves,
  updateHUD() { hudCalls += 1; },
  update: updateSentinel,
  draw() {
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'contrast(2)';
    throw new Error('forced-current-draw-failure');
  },
});

const updateBefore = context.update;
vm.runInContext(source, context, { filename: 'apexArsenalProductDrawRecoveryRuntime.js' });
assert.equal(window.apexArsenalProductDrawRecoveryRuntime, 'ready');
assert.equal(context.update, updateBefore, 'draw recovery must not wrap or alter update');

assert.doesNotThrow(() => context.draw());
assert.equal(errors.length, 1, 'draw failure is reported exactly once');
assert.match(String(errors[0][0]), /Arsenal draw recovered/);
assert.equal(hudCalls, 1, 'HUD recovery runs once after a failed draw');
assert.deepEqual(ctx.transforms.at(-1), [1, 0, 0, 1, 0, 0]);
assert.equal(ctx.globalAlpha, 1);
assert.equal(ctx.globalCompositeOperation, 'source-over');
assert.equal(ctx.filter, 'none');

assert.equal(JSON.stringify(fighters), before.fighters, 'recovery must not mutate fighter state');
assert.equal(projectiles.length, before.projectiles, 'recovery must not prune projectiles');
assert.equal(particles.length, before.particles, 'recovery must not prune particles');
assert.equal(floatingTexts.length, before.floatingTexts, 'recovery must not prune floating texts');
assert.equal(shockwaves.length, before.shockwaves, 'recovery must not prune shockwaves');

let successCalls = 0;
const okWindow = {};
const okContext = vm.createContext({
  window: okWindow,
  console: { error() { throw new Error('success path must not report recovery'); } },
  ctx: { setTransform() {}, globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none' },
  updateHUD() { throw new Error('success path must not call recovery HUD'); },
  update: updateSentinel,
  draw() { successCalls += 1; return 42; },
});
vm.runInContext(source, okContext, { filename: 'apexArsenalProductDrawRecoveryRuntime.js' });
assert.equal(okContext.draw(), 42);
assert.equal(successCalls, 1);

console.log('PASS  Arsenal current draw recovery is a transparent error boundary with no legacy state mutation');
