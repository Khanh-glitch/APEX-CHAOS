// Focused contract test for the current Arsenal/Core Six renderer + HUD seam.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/game/core/apexArsenalProductRenderHudRuntime.js', 'utf8');
const events = [];
const provenance = [];
let vitalSyncs = 0;
const cameraSentinel = { shakeX: 9, shakeY: -4, zoom: 0.97 };
const canvas = { width: 1000, height: 1000 };
const ctx = {
  globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none',
  fillStyle: '#000', strokeStyle: '#fff', lineWidth: 1,
  setTransform() {}, clearRect() {},
  fillRect() { if (String(this.fillStyle).startsWith('rgba(')) events.push('flash'); },
  save() {}, restore() {}, translate() {}, scale() {}, beginPath() {},
  arc() { events.push('shockwave'); }, stroke() {},
};
const fighters = [
  { hp: 42.5, maxHp: 100, isRage: true, draw() { events.push('fighter-p1'); } },
  { hp: 25, maxHp: 200, isRage: false, draw() { events.push('fighter-p2'); } },
];
const window = {
  __apexRenderFrame: 12,
  __apexCameraView: cameraSentinel,
  APEX_COMBAT_HUD: { syncVitals() { vitalSyncs += 1; events.push('hud-authority'); } },
  APEX_HERO_REWORK: { renderArenaWorldEffects(_ctx, info) { events.push('world-effects'); provenance.push(info); } },
};
const context = vm.createContext({
  window,
  document: { getElementById() { throw new Error('renderer must not query HUD DOM'); } },
  canvas, ctx, fighters, GAME_SIZE: 1000, cameraShake: 6, cameraZoom: 1.05,
  rand: (min, max) => (min + max) / 2,
  drawBackground() { events.push('background'); },
  drawProjectiles() { events.push('projectiles'); },
  particles: [{ draw() { events.push('particle'); } }],
  shockwaves: [{ x: 50, y: 60, r: 12, alpha: 0.7, color: '#fff' }],
  floatingTexts: [{ draw() { events.push('floating-text'); } }],
  arenaFlash: { r: 1, g: 2, b: 3, a: 0.25 }, TAU: Math.PI * 2,
});
vm.runInContext(source, context, { filename: 'apexArsenalProductRenderHudRuntime.js' });
context.draw();
const expectedPhases = ['background','projectiles','world-effects','fighter-p1','fighter-p2','particle','shockwave','floating-text','flash'];
assert.deepEqual(events.filter(e => expectedPhases.includes(e)), expectedPhases);
assert.equal(window.__apexRenderFrame, 13);
assert.equal(window.__apexCameraView, cameraSentinel);
assert.deepEqual(Object.keys(provenance[0]).sort(), ['background','fighters','particles','projectiles','stage']);
assert.equal(provenance[0].stage, 'after-world-before-fighters');
assert.equal(provenance[0].particles, false);
assert.equal(provenance[0].fighters, false);
assert.equal(vitalSyncs, 1);
assert.ok(events.indexOf('hud-authority') > events.indexOf('flash'));
assert.doesNotMatch(source, /getElementById|p1-hp|p2-hp|bodyHudHp/);
console.log('PASS  Arsenal renderer order + single APEX_COMBAT_HUD vital authority');
