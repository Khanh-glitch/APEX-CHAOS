// Focused parity contract for the current Arsenal/Core Six two-anchor collision seam.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/game/core/apexArsenalProductCollisionRuntime.js', 'utf8');
const heroRework = fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js', 'utf8');

const forbidden = /MAGNET|fieldTimer|magnet_field|SLIME|SNIPER|FLASH|mirrorStolenCollide|onCollide|teamId/;
assert.doesNotMatch(source, forbidden, 'current collision seam must not carry legacy hero-specific collision logic');

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function reflectDir(dir, nx, ny) {
  const d = (dir?.x || 0) * nx + (dir?.y || 0) * ny;
  return { x: (dir?.x || 0) - 2 * d * nx, y: (dir?.y || 0) - 2 * d * ny };
}
function cloneFighter(f) {
  return {
    ...f,
    dir: { ...f.dir },
    data: { ...(f.data || {}) },
    setDir(x, y) {
      const m = Math.hypot(x, y) || 1;
      this.dir = { x: x / m, y: y / m };
    },
  };
}
function legacyNeutralStep(fighters, gameSize = 1000) {
  const live = f => f && f.hp > 0;
  const clampFighter = f => {
    if (!f) return;
    f.x = clamp(f.x, f.radius, gameSize - f.radius);
    f.y = clamp(f.y, f.radius, gameSize - f.radius);
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) {
      f.x = gameSize / 2; f.y = gameSize / 2; f.setDir(0, 1);
    }
  };
  const a = fighters[0], b = fighters[1];
  if (!live(a) || !live(b)) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const minD = a.radius + b.radius;
  if (d < minD) {
    const nx = dx / d, ny = dy / d, overlap = minD - d;
    a.x -= nx * overlap * .5; a.y -= ny * overlap * .5;
    b.x += nx * overlap * .5; b.y += ny * overlap * .5;
    clampFighter(a); clampFighter(b);
    a.dir = reflectDir(a.dir, -nx, -ny);
    b.dir = reflectDir(b.dir, nx, ny);
  }
}
function runCurrent(seed, gameSize = 1000) {
  const fighters = seed.map(cloneFighter);
  const window = {};
  const context = vm.createContext({
    window,
    fighters,
    GAME_SIZE: gameSize,
    clamp,
    reflectDir,
    rand: () => 0.5,
    handleCollisions() { throw new Error('base collision should be replaced'); },
    Number,
    Math,
  });
  vm.runInContext(source, context, { filename: 'apexArsenalProductCollisionRuntime.js' });
  assert.equal(window.apexArsenalProductCollisionRuntime, 'ready');
  context.handleCollisions(1 / 60);
  return fighters;
}
function snapshot(list) {
  return list.map(f => ({
    x: +f.x.toFixed(9), y: +f.y.toFixed(9),
    dir: { x: +f.dir.x.toFixed(9), y: +f.dir.y.toFixed(9) },
    hp: f.hp, radius: f.radius,
  }));
}
function assertParity(name, seed) {
  const expected = seed.map(cloneFighter);
  legacyNeutralStep(expected);
  const actual = runCurrent(seed);
  assert.deepEqual(snapshot(actual), snapshot(expected), name);
}

const base = (x, y, dx, dy, extra = {}) => ({
  x, y, radius: 50, hp: 1000, dir: { x: dx, y: dy }, data: {}, ...extra,
});
assertParity('ordinary horizontal overlap', [base(450, 500, 1, 0), base(520, 500, -1, 0)]);
assertParity('diagonal overlap', [base(460, 460, .8, .6), base(520, 520, -.8, -.6)]);
assertParity('left-edge overlap preserves clamp semantics', [base(50, 500, 1, 0), base(105, 500, -1, 0)]);
assertParity('corner overlap preserves clamp semantics', [base(50, 50, 1, 1), base(88, 88, -1, -1)]);
assertParity('non-overlap is a no-op', [base(200, 200, 1, 0), base(800, 800, -1, 0)]);
assertParity('dead anchor is a no-op', [base(450, 500, 1, 0, { hp: 0 }), base(520, 500, -1, 0)]);

// The current Hero Rework must remain the outer wrapper: observe contact first,
// call the neutral base collision, then resolve current solid-world geometry.
assert.match(heroRework, /const baseHC = globalScope\.handleCollisions;[\s\S]*HR\.noteAnchorContacts\(\)[\s\S]*baseHC\(dt\)[\s\S]*resolveWorldWalls\(\)/);

console.log('PASS  Arsenal current two-anchor collision matches the accepted neutral FullRoster behavior without legacy hero branches');
