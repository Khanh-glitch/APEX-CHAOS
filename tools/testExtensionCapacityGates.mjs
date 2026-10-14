// CP6 pre-implementation load trial. Tests REAL shipped readiness, capability,
// BOT policy and runtime selection against synthetic future IDs — NO fake
// assets/heroes/weapons are added to production catalogs.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { arsenalBattleRuntimesFor, ARSENAL_PRODUCT_RUNTIMES } from '../src/game/runtimeManifest.js';

const NUM_HEROES=48,NUM_WEAPONS=320;
const gameWindow={location:{href:'http://localhost:5173/'}};
const env=vm.createContext({
  window:gameWindow, console, Promise, performance:{now:()=>performance.now()},
  URL, Math, Map, Set, WeakMap, Date, Object, Array, String, Number,
  AbortController, DOMException,
});
const source=fs.readFileSync('public/game/product/productAssetRuntime.js','utf8');
vm.runInContext(source,env,{filename:'productAssetRuntime.js',timeout:10000});
const assets=gameWindow.apexProductAssets;
assert.ok(assets && typeof assets.registerPresentation==='function' &&
  typeof assets.preparePresentations==='function', 'missing generic READY registry');

// Forty-eight completely unknown hero IDs, 144 concurrent scene/preload calls,
// including overlap, duplicates and mixed order. Each hero's preprocess MUST run
// ONCE. This checks an integration law, not timing-dependent visual snapshots.
const heroes=Array.from({length:NUM_HEROES},(_,i)=>'future_hero_'+i);
const starts=new Map();
const tasks=new Map();
for(const hero of heroes){
  const prepare=async()=>{
    starts.set(hero,(starts.get(hero)||0)+1);
    await new Promise(resolve=>setImmediate(resolve));
    return true;
  };
  tasks.set(hero,prepare);
  assert.equal(assets.registerPresentation(hero,prepare),true);
  assert.equal(assets.registerPresentation(hero,prepare),true,
    'idempotent provider registration must be harmless');
}
assert.throws(()=>assets.registerPresentation(heroes[0],async()=>true),
  /Duplicate presentation readiness provider/,
  'a second loader owner for one hero must not be allowed');
const scenes=[];
for(let wave=0;wave<3;wave++){
  for(let index=0;index<NUM_HEROES;index++){
    scenes.push(assets.preparePresentations([
      heroes[index],heroes[(index+13)%NUM_HEROES],
      heroes[(index+29)%NUM_HEROES],heroes[index]
    ]));
  }
}
await Promise.all(scenes);
const ready=assets.presentationReadiness();
for(const hero of heroes){
  assert.equal(starts.get(hero),1,'duplicate future presentation bootstrap: '+hero);
  assert.equal(ready[hero]?.state,'READY','false hero READY: '+hero);
}
assert.equal(Object.keys(ready).filter(h=>h.startsWith('future_hero_')).length,NUM_HEROES);

// A rejected constructor must NEVER be marked READY or permanently cache a
// rejected promise; a later route may retry. In-flight callers share failure.
let attempts=0;
assets.registerPresentation('future_transient',async()=>{
  attempts++;
  await new Promise(resolve=>setImmediate(resolve));
  if(attempts===1)throw new Error('synthetic-decode-failure');
  return true;
});
const broken=await Promise.allSettled(Array.from({length:12},
  ()=>assets.preparePresentations(['future_transient'])));
assert.equal(attempts,1,'failed concurrent preprocess ran more than once');
assert.equal(broken.filter(x=>x.status==='rejected').length,12);
assert.equal(assets.presentationReadiness().future_transient.state,'ERROR',
  'failure must not result in READY');
await assets.preparePresentations(['future_transient']);
assert.equal(attempts,2,'later route did not retry a failed preprocess');
assert.equal(assets.presentationReadiness().future_transient.state,'READY');
const unavailable=await assets.preparePresentations(['future_unregistered']);
assert.ok(!unavailable.heroes.includes('future_unregistered'),
  'missing provider was incorrectly certified as loaded');

// Full-graph fallback is a compatibility safety valve for an unknown hero;
// filtering cannot accidentally omit its brand-new runtime source.
const all=ARSENAL_PRODUCT_RUNTIMES.map(([src])=>src);
const future=arsenalBattleRuntimesFor(['future_hero_19','magnet']).map(([src])=>src);
assert.deepEqual(future,all,'unknown hero must not silently truncate the battle graph');
const empty=arsenalBattleRuntimesFor([]).map(([src])=>src);
assert.deepEqual(empty,all,'empty roster must preserve full dependency graph');

// Real generic CapabilityAuthority + real BOT mechanic decision, NOT a
// versioned catalog mirror. No new weapon IDs added to the shipped game.
const context=vm.createContext({window:gameWindow,console,Math,Set,Map,WeakMap,Date,Number,Object,Array,String,Promise});
for(const file of ['public/game/hero-rework/ailRuntime.js',
  'public/game/hero-rework/heroMechanicsRuntime.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file,timeout:10000});
}
const CAP=gameWindow.APEX_HERO_REWORK_AIL.CapabilityAuthority;
const EXEC=gameWindow.APEX_HERO_REWORK_MECHANICS.EXECUTORS;
const specs={};
for(let i=0;i<NUM_WEAPONS;i++){
  specs['FUTURE_EQUIPMENT_'+i]={
    tier:i%19===0?'T6':'T3',
    family:'hypothetical-extension',
    magneticResponse:i%4===0?'inert':'responsive',
  };
}
const config={
  WEAPONS:specs,isGun:()=>false,
  isHeroManipulableFloorWeapon(slot){
    const spec=this.WEAPONS[slot?.weaponId];
    return !!spec && slot?.kind==='WEAPON' && spec.tier!=='T6'
      && slot.heroInteractionImmune!==true;
  },
  isHeroMagneticallyResponsiveFloorWeapon(slot){
    return this.isHeroManipulableFloorWeapon(slot)
      && this.WEAPONS[slot.weaponId].magneticResponse==='responsive';
  },
};
gameWindow.APEX_ARSENAL_CONFIG=config;
gameWindow.APEX_MAGNET={canCast:()=>true};
const state={slots:[]};
gameWindow.APEX_ARSENAL={state};
const hero={anchor:{x:500,y:500,hp:1000}};
const mechCtx={
  combatant:hero,cfg:{bulletRadius:480,radius:225,gameplayDuration:1,duration:1.8},
  api:{enemyBodies:()=>[],liveProjectiles:()=>[]},
};
let permittedA1=0,permittedA2=0,immune=0;
for(let i=0;i<NUM_WEAPONS;i++){
  const id='FUTURE_EQUIPMENT_'+i,sp=specs[id];
  const floor={id:i,weaponId:id,kind:'WEAPON',phase:'REVEALED',x:525,y:500};
  state.slots=[floor];
  const a1=CAP.query('magnet-revealed-slot',floor,{config});
  const a2=CAP.query('magnet-repel-slot',floor,{config});
  const expectedA1=sp.tier!=='T6';
  const expectedA2=expectedA1 && sp.magneticResponse==='responsive';
  assert.equal(a1.status,expectedA1?'allowed':'denied','A1 role '+id);
  assert.equal(a2.status,expectedA2?'allowed':'denied','A2 role '+id);
  assert.equal(EXEC['magnet.acquisition'].aiEvaluate(mechCtx).shouldCast,expectedA1,
    'Magnet AI A1 diverges from physical capability '+id);
  assert.equal(EXEC['magnet.repulsion_field'].aiEvaluate(mechCtx).shouldCast,expectedA2,
    'Magnet AI A2 diverges from physical capability '+id);
  if(expectedA1)permittedA1++;
  if(expectedA2)permittedA2++;
  if(!expectedA1)immune++;
}
state.slots=[{weaponId:'UNREGISTERED_NEW',kind:'WEAPON',phase:'REVEALED',x:525,y:500}];
assert.equal(CAP.query('magnet-revealed-slot',state.slots[0],{config}).status,'unresolved');
assert.equal(EXEC['magnet.acquisition'].aiEvaluate(mechCtx).shouldCast,false);
console.log('EXTENSION CAPACITY PASS '+JSON.stringify({
  futureHeroProviders:NUM_HEROES,concurrentScenePrepares:scenes.length,
  duplicatedPreprocesses:0,transientRecovery:true,
  futureWeaponTypes:NUM_WEAPONS,permittedA1,permittedA2,immune,
  unknownHeroFullGraph:true,unregisteredWeaponFailsClosed:true
}));
