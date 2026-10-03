#!/usr/bin/env node
/* G4 hostile structural closure: Core Six identity and shipping ownership. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const mirror=read('public/game/hero-rework/mirrorPresentationRuntime.js');
const hero=read('public/game/hero-rework/heroReworkRuntime.js');
const manifest=read('src/game/runtimeManifest.js');
const hunter=read('public/game/hero-rework/hunterPresentationRuntime.js');
const crystal=read('public/game/hero-rework/crystalaPresentationRuntime.js');
const frost=read('public/game/hero-rework/frostPresentationRuntime.js');
const magnet=read('public/game/hero-rework/magnetPresentationRuntime.js');
const robot=read('public/game/hero-rework/robotPresentationRuntime.js');
let n=0;const gate=(name,fn)=>{fn();n++;console.log('PASS',name);};
gate('one production Mirror tick callsite',()=>assert.equal((hero.match(/APEX_MIRROR_PRESENTATION\?\.tick\(dt\)/g)||[]).length,1));
gate('both update paths converge on hrPostTick',()=>assert.equal((hero.match(/hrPostTick\(dt\);/g)||[]).length,2));
gate('fixed 1\/120 and bounded hitch stepping',()=>{assert.match(mirror,/const STEP = 1 \/ 120/);assert.match(mirror,/Math\.min\(dt, MAX_FRAME_DT\)/);});
gate('no Gold locomotion/gameplay calls',()=>{assert.doesNotMatch(mirror,/\.stepMirror\(/);assert.doesNotMatch(mirror,/\.tryForm\(|\.formNode\(/);});
gate('world seam ownership',()=>{assert.match(hero,/HR\.renderArenaWorldEffects = function/);assert.match(mirror,/provenance\?\.stage !== 'after-world-before-fighters'/);});
gate('Core Six explicit body identity seams',()=>{assert.match(robot,/function renderActorImage\(/);assert.match(hunter,/api\.renderIdentityBody=actorCore/);assert.match(crystal,/renderIdentityBody\(ctx, f\)/);assert.match(frost,/api\.renderIdentityBody = drawFrostIdentity/);assert.match(magnet,/renderIdentityBody,/);assert.match(mirror,/opponent\.heroId === 'MIRROR'/);});
gate('identity snapshot never recursively calls Fighter.draw',()=>{const a=mirror.indexOf('function refreshOpponentIdentitySurface');const b=mirror.indexOf('function drawOpponentIdentity',a);assert.doesNotMatch(mirror.slice(a,b),/fighter\.draw|\.prototype\.draw/);});
gate('A1 Arsenal image and OWN ownership',()=>{assert.match(mirror,/APEX_ARSENAL_AV/);assert.match(mirror,/!state\.realOwn/);});
gate('A2 external exchange only',()=>{assert.match(mirror,/applyExternalExchange/);assert.doesNotMatch(mirror,/anchor\.(x|y)\s*=/);});
gate('F1 bounded fixed Gold pools',()=>{assert.match(mirror,/state\.gold\.SH\.length/);assert.match(mirror,/nodeBindings: \[null, null, null, null\]/);});
gate('P17 consumes shared HR authority',()=>{assert.match(mirror,/HR && HR\.mirrorNode/);assert.match(mirror,/geometry\.toWorld\(node, 1, 0\)/);});
gate('F2 exact references and no clocks',()=>{assert.match(mirror,/state\.routeBindings\.get\(p\.projectile\)/);assert.match(mirror,/route\.escrow\.p !== p\.projectile/);assert.doesNotMatch(mirror,/0\.208|0\.566/);});
gate('manifest Gold-before-adapter order',()=>assert.ok(manifest.indexOf('mirrorGoldV1.js')<manifest.indexOf('mirrorPresentationRuntime.js')));
gate('teardown clears bounded ownership',()=>{assert.match(mirror,/state\.routeBindings\.clear\(\)/);assert.match(mirror,/state\.imageOwners\.clear\(\)/);});
console.log(`[MIRROR G4 CLOSURE AUDIT] ${n}/${n} passed`);
