import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { PRODUCT_ROSTER } from '../src/game/productSurface.js';
import { ARSENAL_PRODUCT_RUNTIMES, arsenalBattleRuntimesFor } from '../src/game/runtimeManifest.js';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const scope={};scope.window=scope;
vm.runInNewContext(read('public/game/hero-rework/heroRegistry.js'),scope);
vm.runInNewContext(read('public/game/hero-rework/boxeBattleRuntime.js'),scope);
const reg=scope.APEX_HERO_REWORK_REGISTRY,boxe=scope.APEX_BOXE_BATTLE;
assert.ok(reg?.validateRegistry().ok,JSON.stringify(reg?.validateRegistry().errors));
assert.deepEqual(Array.from(Object.keys(reg.HEROES).slice(0,12)),['ROBOT','CRYSTAL','MAGNET','BLACK_HOLE','MATH_V2','ICE','RUBBER','HUNTER','TIME','MIRROR','SLIME','SNIPER']);
assert.equal(Object.keys(reg.HEROES).at(-1),'BOXE');
assert.deepEqual(Array.from(PRODUCT_ROSTER.playableIds).slice(-1),['BOXE']);
assert.ok(PRODUCT_ROSTER.visibleIds.includes('BOXE'));
assert.equal(reg.resolveSkillLevel('BOXE','A1',1).cooldown,15);
assert.equal(reg.resolveSkillLevel('BOXE','A2',1).cooldown,20);
assert.equal(reg.resolveSkillLevel('BOXE','PASSIVE',1).damageThreshold,300);
assert.equal(boxe.values.finisherRemainingFraction,.10);
const paths=ARSENAL_PRODUCT_RUNTIMES.map(([url])=>url.split('?')[0]);
const index=p=>paths.indexOf(p);
for(const p of ['boxeBattleRuntime.js','boxeGoldLibrary.js','boxeGoldPresentationRuntime.js'])assert.ok(paths.some(s=>s.endsWith('/'+p)),`missing ${p}`);
assert.ok(index('/game/hero-rework/boxeBattleRuntime.js')<index('/game/hero-rework/heroMechanicsRuntime.js'));
assert.ok(index('/game/hero-rework/boxeGoldLibrary.js')<index('/game/hero-rework/boxeGoldPresentationRuntime.js'));
assert.ok(index('/game/hero-rework/heroReworkRuntime.js')<index('/game/hero-rework/boxeGoldPresentationRuntime.js'));
for(const selected of [['BOXE','ROBOT'],['ROBOT','BOXE'],['BOXE','BOXE']]){
 const list=arsenalBattleRuntimesFor(selected).map(([url])=>url.split('?')[0]);
 assert.ok(list.includes('/game/hero-rework/boxeGoldPresentationRuntime.js'),`missing Gold for ${selected}`);
}
assert.ok(!arsenalBattleRuntimesFor(['ROBOT','ICE']).map(([url])=>url.split('?')[0]).includes('/game/hero-rework/boxeGoldPresentationRuntime.js'),'BOXE Gold must stay deferred when not picked');
const native=read('public/game/arsenal/arsenalWeaponRuntime.js');
assert.ok(native.includes("resolver?.has?.(f,'BOXE_TRIGGER_LOCK')") &&
 native.includes("h.phase==='IN_FLIGHT'") && native.includes("h.def.category==='ranged'"),
 'BOXE A1 must gate all native pre-shot phases through shared AIL status');
const ail=read('public/game/hero-rework/ailRuntime.js');
assert.ok(ail.includes('BOXE_TRIGGER_LOCK'), 'AIL trigger-lock status law missing');
const presentation=read('public/game/hero-rework/boxeGoldPresentationRuntime.js');
assert.ok(presentation.includes('ctx.translate(worldOffset(),worldOffset())') &&
 presentation.includes('const toGold=v=>v-worldOffset()'),'Gold VFX centered-coordinate fix missing');
assert.ok(presentation.includes("g.hands.R.missing=!!st?.rocket") &&
 presentation.includes('detailLastDist:v.detailLastDist') &&
 presentation.includes('toGold(foe.y)-f.y'),
 'Gold R-hand identity, FX cadence and flurry aim must match original');
const gold=read('public/game/hero-rework/boxeGoldLibrary.js');
assert.ok(gold.includes("sourceSha256:'ccb889bb08cb2e741c4f7f5e0b33d08047c08fb28bfc1c31ae9401604444e2b2'"));
assert.ok(gold.includes('preloadSprites:'));
const bridge=read('public/game/gold/goldProductBridge.js');
assert.ok(bridge.includes("boxe: 'BOXE'"));
const pngSha={
 'char-body.png':'20dcb0fda5ddb8bb62065b593d194f814a9879128dac087fb5570147fb87ee3d',
 'glove.png':'6947974edbf8f7e35b67f1ecb89519fb0cd9eb13fa8267c14f36a036943f4fca',
 'dummy.png':'45b622cb64487d7fecf3ea3464e782e5051f24b6ac5e620b90fa0d70c29a5856',
 'bot.png':'e6981e01a9b94f7a74a4fd52a069f211260862f754bb3002803565ee5595e7d5',
 'fx-rock.png':'ff7d40a70b2fa9d14119d35edb087e7a4cb41537d2fa7d44fbbd4224aaffe349',
 'fx-rubble.png':'94235a9d39e824fc7ca1f0ac80bddfdbbc474257a0f1ed836c57bd3635cfec82',
 'fx-fracture.png':'9d1c6080e0ea3ce3ee05671bc7d8a4443b323a2455a22b3e3b1b0f8ef47243cb',
 'char-body-new.png':'fe3fc5a49fdd309cce2484ac3c45cace4051195afdf6a91bc534310f4b56f883',
 'char-body2.png':'0e2aa58951b3772006b2e950c53d7d5882c2bf96333985cde5d2998696c24689',
 'fx-fire.png':'efdb98d065a0fe10e19f8256008cd1dd4c9a7b710b03f2a8dcd5529f965820d2',
};
for(const [file,sha] of Object.entries(pngSha)){
 const full=path.join(root,'public/assets/boxe-gold',file);
 assert.ok(fs.existsSync(full),`missing ${file}`);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'),sha,`changed Gold ${file}`);
}
console.log('PASS BOXE seventh fighter registration, selected-runtime graph, immutable Gold sprites; HUD artwork slots remain pending');
