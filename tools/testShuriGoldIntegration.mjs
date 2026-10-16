// SHURI Gold integration gate: exact renderer/module ownership and native-only
// gameplay. Runs in Product Graph, so every future UI/runtime graph change
// continues to exercise SHURI even before public owner acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ARSENAL_PRODUCT_RUNTIMES, arsenalBattleRuntimesFor } from '../src/game/runtimeManifest.js';
import { PRODUCT_ROSTER } from '../src/game/productSurface.js';
const read=p=>fs.readFileSync(p,'utf8');
const gold=read('public/game/hero-rework/shuriGoldLibrary.js');
const adapter=read('public/game/hero-rework/shuriGoldPresentationRuntime.js');
const gameplay=read('public/game/hero-rework/shuriBattleRuntime.js');
const bridge=read('public/game/gold/goldProductBridge.js');
const manifest=ARSENAL_PRODUCT_RUNTIMES.map(x=>x[0].split('?')[0]);
const idx=p=>manifest.indexOf('/game/hero-rework/'+p);
for(const m of ['shuriBattleRuntime.js','shuriGoldLibrary.js','shuriGoldPresentationRuntime.js'])assert.ok(idx(m)>=0,m);
assert.ok(idx('shuriBattleRuntime.js')<idx('shuriGoldPresentationRuntime.js'));
assert.ok(idx('shuriGoldLibrary.js')<idx('shuriGoldPresentationRuntime.js'));
assert.ok(idx('shuriGoldPresentationRuntime.js')>idx('heroReworkRuntime.js'));
for(const ids of [['SHURI','ROBOT'],['SHURI','BOXE'],['SHURI','SHURI']]){
 const active=arsenalBattleRuntimesFor(ids).map(x=>x[0].split('?')[0]);
 assert.ok(active.includes('/game/hero-rework/shuriGoldPresentationRuntime.js'),'Gold not loaded for '+ids);
}
assert.ok(!arsenalBattleRuntimesFor(['ROBOT','BOXE']).some(x=>x[0].includes('shuriGoldPresentationRuntime')),
 'SHURI Gold must remain lazy when not picked');
assert.match(bridge,/SHURI: 'shuri'/);
assert.match(bridge,/shuri: 'SHURI'/);
assert.ok(PRODUCT_ROSTER.playableIds.includes('SHURI'),
 'SHURI must be admitted through canonical playable roster — no battle-only fighter');
assert.ok(PRODUCT_ROSTER.visibleIds.includes('SHURI'));
for(const file of ['core.webp','collector.webp','bomb.webp','foundation.webp',
                   'grip.webp','tool.webp','rackhead.webp','medhead.webp']){
 assert.ok(fs.statSync('public/assets/gold-ui/heroes/shuri/source/'+file).size>1000,
   'approved owner Gold source asset missing: '+file);
}
for(const role of ['portrait','art','battleAvatar','skillIcons']){
 assert.ok(bridge.includes(role),'Gold Product Bridge missing UI art role '+role);
}
assert.match(bridge,/shuri\/source\/core\.webp/);
assert.match(bridge,/shuri\/source\/collector\.webp/);
assert.match(bridge,/shuri\/source\/bomb\.webp/);
assert.match(bridge,/shuri\/source\/foundation\.webp/);
const registry=read('public/game/hero-rework/heroRegistry.js');
assert.match(registry,/HEROES\.SHURI/);
assert.match(registry,/PASSIVE:\s*'\/assets\/gold-ui\/heroes\/shuri\/source\/collector\.webp'/);
assert.match(registry,/A1:\s*'\/assets\/gold-ui\/heroes\/shuri\/source\/bomb\.webp'/);
assert.match(registry,/A2:\s*'\/assets\/gold-ui\/heroes\/shuri\/source\/foundation\.webp'/);

assert.ok(gold.length>1000000 && gold.includes('data:audio/ogg;base64,')
  && gold.includes('data:image/webp;base64,'));
assert.doesNotMatch(gold,/new Function\(|\beval\(/,'Native Gold must not evaluate source strings');
for(const exportName of ['renderNativeLayer','visualStartRecycle','doA1','doA2','loadAll','playBatch','audioOn'])
 assert.ok(gold.includes(exportName),'original Gold module export missing '+exportName);
assert.match(gameplay,/castAt\+\.40/);
assert.match(gameplay,/castAt\+\.47/);
assert.match(gameplay,/castAt\+\.52/);
assert.match(gameplay,/castAt\+\.72/);
assert.match(gameplay,/awardAt:now\(\)\+3\.0/);
assert.match(adapter,/shuri:recycle-start/);
assert.match(adapter,/Gold\.visualStartRecycle/);
assert.match(adapter,/Gold\.doA1/);
assert.match(adapter,/Gold\.doA2/);
assert.match(adapter,/Gold\.renderNativeLayer/);
assert.match(adapter,/Gold\.audioOn/);
assert.match(adapter,/stunConfirmPending/);
assert.match(adapter,/\^shot\[1-5\]\$/);
assert.doesNotMatch(adapter,/\.takeDamage\(|\.applyStatus\(|\.fireBullet\(/);
// Actual Gold module evaluation: no React, no alternative game loop, no DOM
// access required for the owner's VFX and SFX event timeline.
const scope={console,performance:{now:()=>0}};
scope.window=scope;
vm.runInNewContext(gold,scope,{filename:'shuriGoldLibrary.js',timeout:4000});
const g=scope.APEX_SHURI_GOLD_LIBRARY;
assert.ok(g?.createWorld&&g?.step&&g?.renderNativeLayer);
const w=g.createWorld();
w.free=true;w.script=[];w.tasks=[];
w.shuri.scrap=25;
const x=w.shuri.pos.x,y=w.shuri.pos.y;
g.doA1(w);
for(let i=0;i<Math.ceil(.55/g.DT);i++)g.step(w,g.DT); // Gold runs at 120Hz; reach place/arm/recoil
assert.ok(w.anchor,'Gold must place a real visual anchor at its original 0.4s beat');
assert.equal(w.anchor.pos.x,x);
assert.equal(w.anchor.pos.y,y+50,'Gold bom position must remain ORIGINAL, not relocated by SFX');
assert.ok(w.sfx.some(e=>e.name==='place')&&w.sfx.some(e=>e.name==='arm'));
assert.ok(w.sfx.some(e=>e.name==='recoil'));
console.log('PASS SHURI GOLD V8 authentic module + SFX event time / native selected runtime / Pick/Archive/HUD owner art registered');
