#!/usr/bin/env node
/* G4 hostile structural closure: Core Six identity and semantic Gold shipping ownership. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const mirror = read('public/game/hero-rework/mirrorPresentationRuntime.js');
const gold = read('public/game/hero-rework/mirrorGoldV1.js');
const hero = read('public/game/hero-rework/heroReworkRuntime.js');
const manifest = read('src/game/runtimeManifest.js');
const hunter = read('public/game/hero-rework/hunterPresentationRuntime.js');
const crystal = read('public/game/hero-rework/crystalaPresentationRuntime.js');
const frost = read('public/game/hero-rework/frostPresentationRuntime.js');
const magnet = read('public/game/hero-rework/magnetPresentationRuntime.js');
const robot = read('public/game/hero-rework/robotPresentationRuntime.js');
let n = 0;
const gate = (name, fn) => { fn(); n++; console.log('PASS', name); };
gate('one production Mirror tick callsite', () => assert.equal((hero.match(/APEX_MIRROR_PRESENTATION\?\.tick\(dt\)/g) || []).length, 1));
gate('both update paths converge on hrPostTick', () => assert.equal((hero.match(/hrPostTick\(dt\);/g) || []).length, 2));
gate('fixed 1\/120 and bounded hitch stepping', () => {
  assert.match(mirror, /const STEP = 1 \/ 120/); assert.match(mirror, /Math\.min\(dt, MAX_FRAME_DT\)/);
});
gate('no Gold locomotion/gameplay calls', () => {
  assert.doesNotMatch(mirror, /\.stepMirror\(/); assert.doesNotMatch(mirror, /\.tryForm\(|\.formNode\(/);
});
gate('world seam ownership', () => {
  assert.match(hero, /HR\.renderArenaWorldEffects = function/);
  assert.match(mirror, /provenance\?\.stage !== 'after-world-before-fighters'/);
});
gate('Core Six explicit body identity seams', () => {
  assert.match(robot, /function renderActorImage\(/); assert.match(hunter, /api\.renderIdentityBody=actorCore/);
  assert.match(crystal, /renderIdentityBody\(ctx, f\)/); assert.match(frost, /api\.renderIdentityBody = drawFrostIdentity/);
  assert.match(magnet, /renderIdentityBody,/); assert.match(mirror, /opponent\.heroId === 'MIRROR'/);
});
gate('identity snapshot never recursively calls Fighter.draw', () => {
  const a = mirror.indexOf('function refreshOpponentIdentitySurface');
  const b = mirror.indexOf('function drawOpponentIdentity', a);
  assert.doesNotMatch(mirror.slice(a, b), /fighter\.draw|\.prototype\.draw/);
});
gate('A1 validates production wrapper readiness, dimensions and exact ID', () => {
  assert.match(mirror, /function validWeaponImageWrapper\(wrapper\)/);
  assert.match(mirror, /function imageReady\(image\)/);
  assert.match(mirror, /weaponId: state\.a1WeaponId, source: 'production'/);
  assert.match(mirror, /!state\.realOwn/);
  assert.match(mirror, /function resetA1WeaponArt\(state\)/);
});
gate('A2 remains an external exchange-only bridge', () => {
  assert.match(mirror, /applyExternalExchange/); assert.doesNotMatch(mirror, /anchor\.(x|y)\s*=/);
});
gate('F1 snapshots preserve actual identities and use Gold semantic sync', () => {
  assert.match(mirror, /identity = real/); assert.match(mirror, /syncExternalPassive\(snapshot, HR && HR\.mirrorNode\)/);
  assert.match(mirror, /input\.presentationSide = state\.shardHitSeeds\.get\(real\)/);
  assert.match(gold, /syncExternalPassive\(snapshot, sharedGeometry\)/);
  assert.match(gold, /captureExternalShardSide\(provenance, mirrorX\)/);
  assert.doesNotMatch(mirror, /state\.gold\.(?:SH|ND)\b/);
});
gate('P17 consumes shared HR geometry; Gold derives edge and fill/fold visuals', () => {
  assert.match(mirror, /HR && HR\.mirrorNode/); assert.match(gold, /__deriveExternalNodeEdges/);
  assert.match(gold, /n\.fill = n\.st >= 2/); assert.match(gold, /n\.fold = n\.st === 3/);
});
gate('F2 forwards exact projectile identity and has no adapter lifecycle maps or clocks', () => {
  assert.match(mirror, /routeId: p\.projectile/); assert.match(mirror, /state\.gold\.presentExternalRoute\(route\)/);
  assert.doesNotMatch(mirror, /routeBindings|imageOwners|nodeBindings/);
  assert.doesNotMatch(mirror, /0\.208|0\.566|state\.gold\.(?:SH|ND|PJ)\b/);
});
gate('manifest preserves Gold-before-adapter order', () =>
  assert.ok(manifest.indexOf('mirrorGoldV1.js') < manifest.indexOf('mirrorPresentationRuntime.js')));
gate('teardown delegates semantic cleanup to Gold', () => {
  assert.match(mirror, /state\.gold\.clearExternalTruth\(\)/);
  assert.match(gold, /function clearExternalPassive\(\)/);
  assert.match(mirror, /function destroyState\(ct, state\)/);
});
gate('real R2 harness covers event ordering, actual F2 producers, A1 wrapper and teardown', () => {
  const r2 = read('tools/testMirrorPresentationR2SemanticMigration.mjs');
  assert.match(r2, /mirror\.takeDamage/); assert.match(r2, /weaponApi\.fireBullet/);
  assert.match(r2, /HR\.pressAbility\(mirror, 'A1'\)/);
  assert.match(r2, /real production AV returns null while its actual image is not ready/);
  assert.match(r2, /productionImage\.complete = true/);
  assert.match(r2, /ReworkMatchTeardown/);
});
console.log(`[MIRROR G4 CLOSURE AUDIT] ${n}/${n} passed`);
