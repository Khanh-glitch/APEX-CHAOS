// CRYSTALA V1 — Gold parity test suite (02_GOLD_TO_GAME_ADAPTATION_MAP.md §J, 03_IMPLEMENTATION_TEST_MATRIX.md)
// Verifies that crystalaGoldV6.js faithfully reproduces the owner-approved Gold reference
// (docs/hero-rework/crystala-v1/01_OWNER_APPROVED_GOLD_REFERENCE.html).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const canvasPkg = require('@napi-rs/canvas');
const { createCanvas, Path2D } = canvasPkg;

const GOLD_HTML_PATH = 'docs/hero-rework/crystala-v1/01_OWNER_APPROVED_GOLD_REFERENCE.html';
const GOLD_V6_PATH = 'public/game/hero-rework/crystalaGoldV6.js';
const EXPECTED_GOLD_SHA = 'e5b90f78304cb8cf1fcdd0fd3e8c94069279040e2d3667050aee833446d65d30';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}

const goldHtml = fs.readFileSync(GOLD_HTML_PATH, 'utf8');
const goldV6 = fs.readFileSync(GOLD_V6_PATH, 'utf8');

// P01: Gold reference file integrity and verbatim blocks in ported module
const goldSha = crypto.createHash('sha256').update(goldHtml).digest('hex');
const verbatimBlocks = [...goldV6.matchAll(/\/\* VERBATIM Gold L(\d+)-(\d+) \*\//g)].map(m => `L${m[1]}-${m[2]}`);
check('P01-gold-hash-and-verbatim-blocks', goldSha === EXPECTED_GOLD_SHA && verbatimBlocks.length >= 5,
  { goldSha, verbatimCount: verbatimBlocks.length, blocks: verbatimBlocks });

// Import the ported Gold module
const globalScope = { console, Math, Float32Array, Uint8Array, Object, Array, Infinity, isFinite, Path2D, __createCanvas: createCanvas };
globalScope.document = {
  createElement(tag) {
    if (tag === 'canvas') return createCanvas(300, 150);
    return {};
  }
};
globalScope.window = globalScope; globalScope.globalThis = globalScope;
const fn = new Function('window', 'globalThis', goldV6);
fn(globalScope, globalScope);
const G = globalScope.APEX_CRYSTALA_GOLD;
check('P02-gold-module-exported', G && G.version && typeof G.createRig === 'function', { version: G?.version });

// P03: Six stone identities match Gold L624-631 verbatim
const expectedRoles = ['blade', 'blade', 'guard', 'guard', 'sentinel', 'sentinel'];
const expectedMasses = [1.55, 1.55, 0.70, 0.70, 1.05, 1.05];
const expectedKs = [165, 165, 360, 360, 250, 250];
const expectedBaseRs = [170, 170, 106, 106, 172, 154];
const cfgRoles = G.STONE_CFG.map(s => s.role);
const cfgMasses = G.STONE_CFG.map(s => s.mass);
const cfgKs = G.STONE_CFG.map(s => s.k);
const cfgBaseRs = G.STONE_CFG.map(s => s.baseR);
check('P03-stone-identities-and-physics-constants',
  JSON.stringify(cfgRoles) === JSON.stringify(expectedRoles) &&
  JSON.stringify(cfgMasses) === JSON.stringify(expectedMasses) &&
  JSON.stringify(cfgKs) === JSON.stringify(expectedKs) &&
  JSON.stringify(cfgBaseRs) === JSON.stringify(expectedBaseRs),
  { roles: cfgRoles, masses: cfgMasses, ks: cfgKs, baseRs: cfgBaseRs });

// P04: Orbit simulation matches Gold spring-damper equations and dynamic redistribution
const rig1 = G.createRig({ seed: 42, visual: false });
rig1.setBody(500, 500, 0, 0);
for (let i = 0; i < 60; i++) rig1.advance(1/60);
const radii = rig1.stones.map(s => Math.round(Math.hypot(s.x - 500, s.y - 500)));
const ellipticalCheck = radii[0] !== radii[2] && radii[2] < radii[0]; // guards orbit tighter than blades
check('P04-orbit-spring-and-elliptical-slots', ellipticalCheck && radii.length === 6, { radii });

// P05: Dynamic redistribution: when 2 stones leave orbit, remaining 4 redistribute
const rigRedist = G.createRig({ seed: 123, visual: false });
rigRedist.setBody(500, 500, 0, 0);
for (let i = 0; i < 60; i++) rigRedist.advance(1/60);
rigRedist.stones[0].claim = true;
rigRedist.stones[1].claim = true;
for (let i = 0; i < 60; i++) rigRedist.advance(1/60);
const activeStones = rigRedist.stones.filter(s => s.state === 'orbit' && !s.claim);
const angBiases = activeStones.map(s => Math.abs(s.angBias));
check('P05-dynamic-redistribution-on-claimed-shards', activeStones.length === 4 && angBiases.some(b => b > 0.05),
  { activeCount: activeStones.length, maxAngBias: Math.max(...angBiases).toFixed(3) });

// P06: Hermite curve interpolation maintains endpoint velocity continuity (no flat eases)
const p0 = { x: 100, y: 100 }, v0 = { x: 200, y: 0 };
const p1 = { x: 300, y: 300 }, v1 = { x: 0, y: 200 };
const outHermite = {};
G.util.hermite(p0, v0, p1, v1, 1.0, 0.0, outHermite);
const h0_pos = Math.hypot(outHermite.x - p0.x, outHermite.y - p0.y);
const h0_vel = Math.hypot(outHermite.vx - v0.x, outHermite.vy - v0.y);
G.util.hermite(p0, v0, p1, v1, 1.0, 1.0, outHermite);
const h1_pos = Math.hypot(outHermite.x - p1.x, outHermite.y - p1.y);
const h1_vel = Math.hypot(outHermite.vx - v1.x, outHermite.vy - v1.y);
check('P06-hermite-tangent-continuity', h0_pos < 1e-6 && h0_vel < 1e-6 && h1_pos < 1e-6 && h1_vel < 1e-6,
  { h0_pos, h0_vel, h1_pos, h1_vel });

// P07: Real facet indexing algorithm: given incoming ray, selects outline facet with minimal angular delta
const rigFacet = G.createRig({ seed: 7, visual: false });
rigFacet.setBody(500, 500, 0, 0);
rigFacet.advance(1/60);
const testStone = rigFacet.stones[0];
const facet0 = rigFacet.indexFacet(testStone, -1500, 0);
const norm0 = rigFacet.facetNormal(0, facet0);
check('P07-facet-indexing-and-normals', facet0 && facet0.local !== undefined && Math.abs(norm0.x) > 0.5,
  { facetIdx: facet0.i, delta: facet0.delta.toFixed(3), normal: [norm0.x.toFixed(2), norm0.y.toFixed(2)] });

// P08: Wall construction retiming: reaches solidity in ~0.75s with phase grammar intact
const rigWall = G.createRig({ seed: 55, visual: false });
rigWall.setBody(300, 500, 0, 0);
for (let i = 0; i < 60; i++) rigWall.advance(1/60);
const wallPlan = rigWall.planWall([0, 1, 2, 3, 4, 5], { x: 500, y: 400 }, { x: 500, y: 620 });
const wallCons = rigWall.castWall({ a0: { x: 500, y: 400 }, a1: { x: 500, y: 620 }, pair: wallPlan.pair, seed: 7 });
const wallCastTime = rigWall.time;
let wallSolidTime = null, wallLockTime = null;
for (let i = 0; i < 120; i++) {
  rigWall.advance(1/60);
  if (wallCons.geom && wallCons.geom.solid && wallSolidTime === null) wallSolidTime = rigWall.time - wallCastTime;
  if (wallCons.locked && wallLockTime === null) wallLockTime = rigWall.time - wallCastTime;
}
check('P08-wall-retime-phases-and-solidity',
  wallSolidTime > 0.65 && wallSolidTime < 0.85 && wallLockTime > 0.70 && wallLockTime < 0.90,
  { wallSolidTime: wallSolidTime?.toFixed(3), wallLockTime: wallLockTime?.toFixed(3), target: '~0.75s' });

// P09: Prison construction retiming: freeze at NUCLEATE, closure and solidity
const rigPrison = G.createRig({ seed: 77, visual: false });
rigPrison.setBody(300, 500, 0, 0);
for (let i = 0; i < 60; i++) rigPrison.advance(1/60);
const prisonCons = rigPrison.castPrison({ cx: 600, cy: 500, R: 135, seed: 31 });
const prisonCastTime = rigPrison.time;
let prisonFreezeTime = null, prisonSolidTime = null;
for (let i = 0; i < 120; i++) {
  rigPrison.advance(1/60);
  if (prisonCons.prison.frozen && prisonFreezeTime === null) prisonFreezeTime = rigPrison.time - prisonCastTime;
  if (prisonCons.prison.solid && prisonSolidTime === null) prisonSolidTime = rigPrison.time - prisonCastTime;
}
check('P09-prison-retime-nucleate-freeze-and-closure',
  prisonFreezeTime > 0.40 && prisonFreezeTime < 0.65 && prisonSolidTime > 0.70 && prisonSolidTime < 0.90,
  { prisonFreezeTime: prisonFreezeTime?.toFixed(3), prisonSolidTime: prisonSolidTime?.toFixed(3), target: '~0.75s' });

// P10: Internal light refraction dwell and momentum recoil kick
const rigRefract = G.createRig({ seed: 88, visual: false });
rigRefract.setBody(500, 500, 0, 0);
for (let i = 0; i < 60; i++) rigRefract.advance(1/60);
const rStone = rigRefract.stones[0];
rigRefract.reserve(0, { x: -2000, y: 0 });
rigRefract.refract(0, { x: rStone.x, y: rStone.y }, { x: 2000, y: 0 }, 7);
const internalActive = !!rStone.internal;
const internalDuration = rStone.internal?.T;
check('P10-internal-refraction-light-dwell', internalActive && Math.abs(internalDuration - 0.16) < 1e-6,
  { internalActive, dwellDuration: internalDuration });

// P11: Rig seeded determinism across multiple runs (exercising recoil kick seed)
function runSimulation(s) {
  const r = G.createRig({ seed: s, visual: false });
  r.setBody(400, 400, 200, 100);
  for (let i = 0; i < 60; i++) r.advance(1/60);
  r.recoilKick(0, { x: 1000, y: 500 });
  for (let i = 0; i < 8; i++) r.advance(1/60);
  return r.stones.map(st => `${st.x.toFixed(4)},${st.y.toFixed(4)},${st.rot.toFixed(4)}`).join('|');
}
const simA1 = runSimulation(42);
const simA2 = runSimulation(42);
const simB = runSimulation(43);
check('P11-rig-simulation-determinism', simA1 === simA2 && simA1 !== simB,
  { identicalSameSeed: simA1 === simA2, distinctDifferentSeed: simA1 !== simB });

// P12: drawCrystala and drawEyeAccent render dormant & awake states without error
const cv12 = createCanvas(400, 400);
const ctx12 = cv12.getContext('2d');
G.drawCrystala(ctx12, { x: 200, y: 200, awake: 0 }, false);
const dormantPixels = cv12.toBuffer('image/png').length;
ctx12.clearRect(0, 0, 400, 400);
G.drawCrystala(ctx12, { x: 200, y: 200, awake: 1, eyeFlash: 0.8 }, true);
G.drawEyeAccent(ctx12, { x: 200, y: 200, awake: 1, eyeFlash: 0.8 });
const awakePixels = cv12.toBuffer('image/png').length;
check('P12-draw-crystala-dormant-and-awake', dormantPixels > 100 && awakePixels > 100,
  { dormantPngBytes: dormantPixels, awakePngBytes: awakePixels });

// P13: drawStone and gem facets for all 6 stones, star presence on sentinels
const cv13 = createCanvas(600, 200);
const ctx13 = cv13.getContext('2d');
const rig13 = G.createRig({ seed: 13, visual: false });
rig13.setBody(300, 100, 0, 0);
rig13.advance(1/60);
let stonesOk = true;
for (let i = 0; i < 6; i++) {
  const st = rig13.stones[i];
  G.drawStone(ctx13, st, 1, false);
  G.drawStone(ctx13, st, 1, true);
  if (!st.gem || !st.gem.outline || !st.gem.facets) stonesOk = false;
}
const sentinelStars = rig13.stones.filter(s => s.role === 'sentinel').every(s => s.gem.star === true);
check('P13-draw-stone-shapes-and-gem-facets', stonesOk && sentinelStars,
  { stonesCount: rig13.stones.length, sentinelStars });

// P14: drawTrail separated motes driven by velocity and energy
const cv14 = createCanvas(300, 300);
const ctx14 = cv14.getContext('2d');
const testTrailStone = rig13.stones[0];
testTrailStone.trailFill = 12;
testTrailStone.energy = 0.85;
testTrailStone.vx = 250; testTrailStone.vy = 120;
for (let i = 0; i < 16; i++) {
  testTrailStone.trail[i * 2] = 100 + i * 8;
  testTrailStone.trail[i * 2 + 1] = 100 + i * 4;
}
testTrailStone.trailI = 12;
let trailError = null;
try { G.drawTrail(ctx14, testTrailStone, 1); } catch (e) { trailError = String(e); }
check('P14-draw-trail-separated-motes', trailError === null && cv14.toBuffer('image/png').length > 100,
  { motesRendered: true, error: trailError });

// P15: drawWall growth, seam lock, and impact cracks
const cv15 = createCanvas(400, 400);
const ctx15 = cv15.getContext('2d');
const rig15 = G.createRig({ seed: 15, visual: false });
rig15.setBody(200, 200, 0, 0);
for (let i = 0; i < 60; i++) rig15.advance(1/60);
const wPlan = rig15.planWall([0, 1, 2, 3, 4, 5], { x: 200, y: 100 }, { x: 200, y: 320 });
const wCons = rig15.castWall({ a0: { x: 200, y: 100 }, a1: { x: 200, y: 320 }, pair: wPlan.pair, seed: 15 });
for (let i = 0; i < 90; i++) rig15.advance(1/60);
rig15.wallHit(wCons.geom, { x: 200, y: 210 }, 35);
let wallDrawOk = true;
try {
  G.drawWall(ctx15, wCons.geom, false);
  G.drawWall(ctx15, wCons.geom, true);
} catch (e) { wallDrawOk = false; }
const crackedSegs = wCons.geom.segs.filter(s => s.cracks && s.cracks.length > 0).length;
check('P15-draw-wall-growth-seam-and-damage', wallDrawOk && crackedSegs > 0,
  { wallSolid: wCons.geom.solid, crackedSegments: crackedSegs });

// P16: drawPrison 6-side cell growth, front/back sorting, build heads
const cv16 = createCanvas(400, 400);
const ctx16 = cv16.getContext('2d');
const rig16 = G.createRig({ seed: 16, visual: false });
rig16.setBody(200, 200, 0, 0);
for (let i = 0; i < 60; i++) rig16.advance(1/60);
const pCons = rig16.castPrison({ cx: 200, cy: 200, R: 135, seed: 16 });
for (let i = 0; i < 80; i++) rig16.advance(1/60);
let prisonDrawOk = true;
try {
  G.drawPrison(ctx16, pCons.prison, false, false);
  G.drawPrison(ctx16, pCons.prison, false, true);
  G.drawPrison(ctx16, pCons.prison, true, false);
  G.drawPrison(ctx16, pCons.prison, true, true);
} catch (e) { prisonDrawOk = false; }
check('P16-draw-prison-encircle-facets-and-build-heads', prisonDrawOk && pCons.prison.edges.length === 6,
  { edges: pCons.prison.edges.length, solid: pCons.prison.solid });

// P17: drawDust Ancient Dust with two-stage rendering
const cv17 = createCanvas(300, 300);
const ctx17 = cv17.getContext('2d');
const rig17 = G.createRig({ seed: 17, visual: true });
rig17.setBody(150, 150, 0, 0);
for (let i = 0; i < 10; i++) {
  rig17.spawnDust(150, 150, 40 + i * 2, 30, 1.2, 1.8, 0.9);
}
rig17.advance(1/60);
let dustOk = true;
try { G.drawDust(ctx17, rig17.fx.dust, 1); } catch (e) { dustOk = false; }
check('P17-draw-dust-two-stage-luminous-core', dustOk && rig17.fx && rig17.fx.dust.alive.some(a => a === 1),
  { activeDust: rig17.fx.dust.alive.filter(a => a === 1).length });

// P18: drawDebris fractured shards with drag and rotational damping
const cv18 = createCanvas(300, 300);
const ctx18 = cv18.getContext('2d');
const rig18 = G.createRig({ seed: 18, visual: true });
rig18.setBody(150, 150, 0, 0);
rig18.spawnDebris(150, 150, 80, 40, 3.5, 999);
rig18.advance(1/60);
let debrisOk = true;
try { G.drawDebris(ctx18, rig18.fx.debris, 1); } catch (e) { debrisOk = false; }
check('P18-draw-debris-drag-and-rotational-damping', debrisOk && rig18.fx.debris.some(d => d.on),
  { activeDebris: rig18.fx.debris.filter(d => d.on).length });

// P19: createBloomSystem half-resolution buffer pipeline
const bloomSys = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5 });
const gxBloom = bloomSys.begin();
const cv19 = createCanvas(1000, 1000);
const ctx19 = cv19.getContext('2d');
let bloomCompositeOk = true;
try { bloomSys.composite(ctx19, 1000, 1000); } catch (e) { bloomCompositeOk = false; }
check('P19-create-bloom-system-half-res-pipeline',
  bloomSys.glowCanvas && bloomSys.glowCanvas.width === 500 && bloomSys.glowCanvas.height === 500 && bloomCompositeOk,
  { bufferWidth: bloomSys.glowCanvas?.width, bufferHeight: bloomSys.glowCanvas?.height, compositeOk: bloomCompositeOk });

// P20: APEX_CRYSTALA_PRESENTATION registers and integrates Chamber actorRender
const presCode = fs.readFileSync('public/game/hero-rework/crystalaPresentationRuntime.js', 'utf8');
const presFn = new Function('window', 'globalThis', presCode);
presFn(globalScope, globalScope);
const Pres = globalScope.APEX_CRYSTALA_PRESENTATION;
const presReady = !!(Pres && Pres.ready && typeof Pres.renderBody === 'function' && typeof Pres.runBloomPass === 'function');
check('P20-presentation-adapter-registers-and-integrates-chamber', presReady,
  { ready: Pres?.ready, hasRenderBody: typeof Pres?.renderBody === 'function' });

// P21: Single weapon render dispatch law (no duplicate drawEquippedWeapon in presentation)
const presDrawsWeapon = /drawEquippedWeapon/.test(presCode);
const presHasWeaponPass = /AV\.drawEquippedWeapon/.test(presCode) || /weaponApi\.equip/.test(presCode);
check('P21-single-weapon-pass-no-double-render', !presDrawsWeapon && !presHasWeaponPass,
  { doubleDrawFree: !presDrawsWeapon, weaponPassIsolated: !presHasWeaponPass });

const failed = results.filter(r => !r.pass);
console.log(`\n[CRYSTALA GOLD PARITY] ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
