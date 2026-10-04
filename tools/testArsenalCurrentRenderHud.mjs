// Focused contract test for the current Arsenal/Core Six renderer and HUD seam.
// This uses a small canvas spy so draw ordering and excluded legacy overlays
// are checked independently of the larger acceptance harness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/game/core/apexArsenalProductRenderHudRuntime.js', 'utf8');
const events = [];
const elements = new Map();
for (const id of [
  'p1-hp', 'p1-hp-text', 'p1-rage',
  'p2-hp', 'p2-hp-text', 'p2-rage',
]) {
  const style = new Proxy({}, {
    set(target, key, value) {
      events.push(`hud:${id}:${String(key)}`);
      target[key] = value;
      return true;
    },
  });
  const element = { style, _innerText: '' };
  Object.defineProperty(element, 'innerText', {
    get() { return this._innerText; },
    set(value) {
      events.push(`hud:${id}:text`);
      this._innerText = String(value);
    },
  });
  elements.set(id, element);
}

const cameraSentinel = { shakeX: 9, shakeY: -4, zoom: 0.97 };
const provenance = [];
const canvas = { width: 1000, height: 1000 };
const ctx = {
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  filter: 'none',
  fillStyle: '#000',
  strokeStyle: '#fff',
  lineWidth: 1,
  setTransform() {},
  clearRect() {},
  fillRect() {
    if (String(this.fillStyle).startsWith('rgba(')) events.push('flash');
  },
  save() {},
  restore() {},
  translate() {},
  scale() {},
  beginPath() {},
  arc() { events.push('shockwave'); },
  stroke() {},
};
const fighters = [
  {
    hp: 42.5, maxHp: 100, isRage: true, teamId: 'shared-team',
    hasStatus() { events.push('legacy-status-branch'); return true; },
    draw() { events.push('fighter-p1'); },
  },
  {
    hp: 25, maxHp: 200, isRage: false, teamId: 'shared-team',
    hasStatus() { events.push('legacy-status-branch'); return true; },
    draw() { events.push('fighter-p2'); },
  },
];
const window = {
  __apexRenderFrame: 12,
  __apexCameraView: cameraSentinel,
  __apexTopLayerDraw() { events.push('top-layer'); },
  APEX_HERO_REWORK: {
    bodyHudHp() { throw new Error('current HUD must read P1/P2 anchors directly'); },
    renderArenaWorldEffects(_ctx, info) {
      events.push('world-effects');
      provenance.push(info);
    },
  },
};
const context = vm.createContext({
  window,
  document: { getElementById: id => elements.get(id) || null },
  canvas,
  ctx,
  fighters,
  GAME_SIZE: 1000,
  cameraShake: 6,
  cameraZoom: 1.05,
  rand: (min, max) => (min + max) / 2,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  drawBackground() { events.push('background'); },
  drawProjectiles() { events.push('projectiles'); },
  particles: [{ draw() { events.push('particle'); } }],
  // Exercise the current plain-object shockwave fallback.
  shockwaves: [{ x: 50, y: 60, r: 12, alpha: 0.7, color: '#fff' }],
  floatingTexts: [{ draw() { events.push('floating-text'); } }],
  arenaFlash: { r: 1, g: 2, b: 3, a: 0.25 },
  TAU: Math.PI * 2,
});

vm.runInContext(source, context, { filename: 'apexArsenalProductRenderHudRuntime.js' });
context.draw();

const expectedPhases = [
  'background', 'projectiles', 'world-effects',
  'fighter-p1', 'fighter-p2', 'particle', 'shockwave', 'floating-text', 'flash',
];
const observedPhases = events.filter(event => expectedPhases.includes(event));
assert.deepEqual(observedPhases, expectedPhases, 'current render phases must keep their accepted order');
assert.equal(window.__apexRenderFrame, 13, 'render-frame counter increments once');
assert.equal(window.__apexCameraView, cameraSentinel, 'camera-view side channel remains unchanged');
assert.deepEqual(Object.keys(provenance[0]).sort(), ['background', 'fighters', 'particles', 'projectiles', 'stage']);
assert.equal(provenance[0].stage, 'after-world-before-fighters');
assert.equal(provenance[0].particles, false);
assert.equal(provenance[0].fighters, false);
assert.ok(!events.includes('legacy-status-branch'), 'legacy scent/status pass is not migrated');
assert.ok(!events.includes('top-layer'), 'legacy top-layer pass is not migrated');
assert.ok(!events.includes('calc-overlay'), 'legacy calc overlay is not migrated');

assert.equal(elements.get('p1-hp').style.width, '42.5%');
assert.equal(elements.get('p1-hp-text').innerText, '42.5 / 100');
assert.equal(elements.get('p1-rage').style.opacity, 1);
assert.equal(elements.get('p1-rage').style.display, 'block');
assert.equal(elements.get('p2-hp').style.width, '12.5%');
assert.equal(elements.get('p2-hp-text').innerText, '25.0 / 200');
assert.equal(elements.get('p2-rage').style.opacity, 0);
assert.equal(elements.get('p2-rage').style.display, 'none');
assert.ok(events.indexOf('hud:p1-hp:width') > events.indexOf('flash'), 'HUD updates after battlefield draw');
assert.doesNotMatch(source, /SNIPER|scent|__apexTopLayerDraw|calcOverlay|bodyHudHp/);

console.log('PASS  Arsenal current renderer order, camera side channel, and anchor-only P1/P2 HUD');
