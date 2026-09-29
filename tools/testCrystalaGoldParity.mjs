// CRYSTALA V1 — Gold parity test suite (02_GOLD_TO_GAME_ADAPTATION_MAP.md §J, 03_IMPLEMENTATION_TEST_MATRIX.md)
// Verifies that crystalaGoldV6.js faithfully reproduces the owner-approved Gold reference
// (docs/hero-rework/crystala-v1/01_OWNER_APPROVED_GOLD_REFERENCE.html).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
const globalScope = { console, Math, Float32Array, Uint8Array, Object, Array, Infinity, isFinite };
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

/* @@PRESENTATION_PARITY@@ */

const failed = results.filter(r => !r.pass);
console.log(`\n[CRYSTALA GOLD PARITY] ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
