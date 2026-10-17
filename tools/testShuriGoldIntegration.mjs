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
const arsenalWeapon=read('public/game/arsenal/arsenalWeaponRuntime.js');
const registrySource=read('public/game/hero-rework/heroRegistry.js');
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
for(const role of ['avatar','standing','cover','passive','a1','a2']){
 const filename='public/assets/dictionary/heroes/shuri/'+role+'.webp';
 assert.ok(fs.existsSync(filename)&&fs.statSync(filename).size>10000,'Missing SHURI owner art '+role);
 assert.ok(bridge.includes('/assets/dictionary/heroes/shuri/'+role+'.webp'),'Bridge missing '+role);
}
const registry=read('public/game/hero-rework/heroRegistry.js');
assert.match(registry,/HEROES\.SHURI/);
for(const role of ['avatar','standing','cover','passive','a1','a2']){
 assert.ok(registry.includes('/assets/dictionary/heroes/shuri/'+role+'.webp'),'Registry missing '+role);
}

assert.ok(gold.length>1000000 && gold.includes('data:audio/ogg;base64,')
  && gold.includes('data:image/webp;base64,'));
assert.doesNotMatch(gold,/new Function\(|\beval\(/,'Native Gold must not evaluate source strings');
for(const exportName of ['renderNativeLayer','visualStartRecycle','doA1','doA2','loadAll','playBatch','audioOn'])
 assert.ok(gold.includes(exportName),'original Gold module export missing '+exportName);
assert.match(gameplay,/castAt\+\.40/);
assert.match(gameplay,/castAt\+\.47/);
assert.match(gameplay,/castAt\+\.52/);
assert.doesNotMatch(gameplay,/castAt\+\.72/,'A1 must not switch the machine form any more');
assert.doesNotMatch(gameplay,/morph/i,'native gameplay has no morph state left');
assert.doesNotMatch(gameplay,/registerFloorAttractor|registerExternalPickupConsumer/,'rack must not suck or eat floor guns');
assert.match(gameplay,/awardAt:now\(\)\+3\.0/);
assert.match(gameplay,/shuri-a1-disarm/,'A1 theft must ride the canonical consume reason');
assert.match(gameplay,/resolveA2Branch/,'A2 branches resolve through one resolver');
assert.match(gameplay,/operatingRange/,'one operating range authority');
assert.match(arsenalWeapon,/reason==='shuri-a1-disarm'/,'stolen gun must not spawn a duplicate ghost');
assert.match(adapter,/shuri:recycle-start/);
assert.match(adapter,/drawNativeRangeRims\(ctx,rec\)/);
assert.match(adapter,/reachRim\(ctx,st\.bomb\.x,st\.bomb\.y,100/);
assert.match(adapter,/const radius=\(s\.solid\.radius\|\|75\)\+range/,'rim must be circumference + operating range');
assert.match(adapter,/drawEquippedWeapon\?\.\(ctx,this,nativeHolder\)/);
assert.match(arsenalWeapon,/const recycled=f\.__hrCombatant/);
assert.match(arsenalWeapon,/if\(recycled\|\|reason==='shuri-a1-disarm'\|\|f\.__arsenalEmitterOwner/);
assert.match(registrySource,/initialScrap:20/);
assert.match(registrySource,/cooldown:15,buildScrap:20/);
assert.match(gold,/const sc = engine_1\.K\.bomb \* 2 \*/);
assert.match(gold,/const bs = engine_1\.K\.bomb \/ k \* 2\.24/);
assert.match(adapter,/Gold\.visualStartRecycle/);
assert.match(adapter,/Gold\.doA1/);
assert.match(adapter,/Gold\.doA2/);
assert.match(adapter,/Gold\.renderNativeLayer/);
assert.match(adapter,/Gold\.audioOn/);
assert.match(bridge,/SHURI Gold renderer unavailable/,'Gold Shell must wait for SHURI art');
assert.match(bridge,/await gold\.whenReady\(\)/,'Gold Shell must await decoded original sprites');
assert.match(adapter,/w\.st\.mode=st\.structure\.recovery\?'med':'rack'/,'native state must own the visual machine form every sync');
assert.doesNotMatch(adapter,/shuri:morph-start|build-mode-changed/,'retired morph events must not be handled');
assert.match(adapter,/shuri:bomb-expire[\s\S]*?w\.bomb=null/,'expired bomb cannot fake a stun explosion');
assert.match(adapter,/registerWorldVisualRenderer/,'world residue must outlive the Fighter draw');

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
// Motion fidelity: Gold's hair/face springs are velocity-driven. Feeding
// measured native velocity before stepping (the adapter's feedMotion)
// must restore authored excursion vs the old teleport-only feeding.
assert.match(adapter,/function feedMotion\(rec\)/,'adapter must feed native velocity into Gold');
assert.match(adapter,/feedMotion\(rec\);\s*\n\s*let remaining/,'velocity must be fed before Gold substeps');
assert.match(adapter,/BOMB_SPRITE_OFFSET=\{x:-25\.5,y:27\.5\}/,'bomb sprite off-centre must be compensated at render');
assert.match(adapter,/k0=rec\.baseK\.grip\*firm/,'satellite grip must firm up with speed via k0');
function hairExcursion(fed){
  const mw=g.createWorld();mw.free=true;mw.script=[];mw.tasks=[];mw.fixtures=[];
  let px=600,vx=0,maxHair=0;
  for(let frame=0;frame<180;frame++){
    const t=frame/60;
    const x=600+290*Math.max(0,t-0.2)*(t<2.2?1:0)+ (t>=2.2?290*2.0:0);
    if(fed){const measured=(x-px)*60;vx=vx*0.35+measured*0.65;
      mw.shuri.vel.x=vx;mw.shuri.vel.y=0;mw.shuri.pos.x=x;mw.shuri.pos.y=590;}
    for(let s=0;s<2;s++)g.step(mw,g.DT);
    mw.shuri.pos.x=x;mw.shuri.pos.y=590;
    maxHair=Math.max(maxHair,Math.abs(mw.shuri.hx[2].x));
    px=x;
  }
  return maxHair;
}
const fedHair=hairExcursion(true),starvedHair=hairExcursion(false);
assert.ok(fedHair>3*starvedHair,
  `velocity-fed hair excursion ${fedHair.toFixed(1)} must dwarf teleport-fed ${starvedHair.toFixed(1)}`);
console.log('PASS SHURI GOLD V8 authentic module + SFX event time / native selected runtime / Pick/Archive/HUD owner art registered');
