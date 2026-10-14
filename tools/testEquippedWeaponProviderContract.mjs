// CP13: one Arsenal-owned held-weapon presentation dispatch. This test
// protects the future extension API and prohibits legacy Robot overwrites.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const av=fs.readFileSync('public/game/arsenal/arsenalPresentationRuntime.js','utf8');
const robot=fs.readFileSync('public/game/hero-rework/robotPresentationRuntime.js','utf8');
const palette=fs.readFileSync('public/game/arsenal/arsenalChamberPaletteRuntime.js','utf8');
const gold=fs.readFileSync('tools/testOwnerGoldSkinsChrome.mjs','utf8');
assert.match(av,/function registerEquippedWeaponRenderer\(id, paint\)/);
assert.match(av,/const equippedWeaponRenderers = new Map\(\)/);
assert.match(av,/if\(handled===true\)return true/);
assert.match(av,/for\(const \[id,paint\] of equippedWeaponRenderers\)/);
assert.match(av,/registerEquippedWeaponRenderer,/);
assert.match(robot,/registerEquippedWeaponRenderer\('robot-native-jaw'/);
assert.match(robot,/__robotSocketRegistered/);
assert.doesNotMatch(robot,/__robotSocketWrapped|av\.drawEquippedWeapon\s*=/,
  'Robot may not globally replace Arsenal AV draw anymore');
// The authored Chamber Palette offscreen readability pass must preserve
// the exact callback result; otherwise Frost's outer AV wrapper receives
// undefined even though the original Gold launcher renders correctly.
assert.match(palette,/let receipt;/);
assert.match(palette,/receipt = renderFn\(sourceCtx\)/);
assert.match(palette,/return receipt;/);
assert.match(palette,/return actorRender\(c, f, f\.x, f\.y, \(oc\) => bw\(oc, f, h\), 'weapon'\)/);
assert.doesNotMatch(palette,/actorRender\(c, f, f\.x, f\.y, \(oc\) => bw\(oc, f, h\), 'weapon'\);\s*return undefined;/);
assert.match(robot,/getRobotWeaponSocketWorld\(fighter\)/);
assert.match(robot,/drawAngle=aim\+\(params\.drawOffset\|\|0\)\+/);
assert.match(robot,/globalScope\.APEX_COSMETICS\?\.capture\?\.\(/);
assert.match(gold,/realRobotGoldWeaponCalls<1/,
  'Live Gold Chrome must still inspect NEWBOT held Gold launcher receipt');
assert.match(gold,/robot-native-jaw/,
  'Live Chrome must directly verify registered Robot jaw provider');
console.log('CP13 EQUIPPED WEAPON PROVIDER CONTRACT PASS: deterministic Arsenal dispatch, native Robot jaw, no AV override');
