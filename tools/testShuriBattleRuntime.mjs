// Native SHURI ability semantics, tested without Gold art or a second combat engine.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('public/game/hero-rework/shuriBattleRuntime.js','utf8');
let t=0,nextId=0;
const handlers=new Map(),events=[],slots=[],solids=[],collectors=new Map(),attractors=new Map();
const bus={
 on(key,fn){const a=handlers.get(key)||[];a.push(fn);handlers.set(key,a);return ()=>{const i=a.indexOf(fn);if(i>=0)a.splice(i,1);};},
 emit(type,payload){events.push({type,payload,time:t});for(const fn of handlers.get(type)||[])fn({type,payload,t});},
};
const a={id:1,x:400,y:350,radius:75,hp:900,maxHp:1000,dir:{x:1,y:0}},
      b={id:2,x:720,y:350,radius:75,hp:1000,maxHp:1000};
const ct={heroId:'SHURI',combatantId:'p1',side:'p1',anchor:a,store:{}};
a.__hrCombatant=ct;
const held=new Map();
const weapons={
 getHolder(f){return held.get(f)||null;},
 createWeaponEmitter(owner,solid){return {__arsenalEmitterOwner:owner,__arsenalWorldSolid:solid,
  x:solid.x,y:solid.y,hp:solid.hp,radius:solid.radius,data:{arsenal:null},dir:{x:1,y:0}};},
 syncWeaponEmitter(host){host.x=host.__arsenalWorldSolid.x;host.y=host.__arsenalWorldSolid.y;
  host.hp=host.__arsenalWorldSolid.hp;return host.hp>0;},
 equip(host,id){if(held.has(host))return false;held.set(host,{weaponId:id,phase:'READY',shotsFired:0,def:{shots:4}});return true;},
 consume(host){held.delete(host);},
 updateHolder(host){const h=held.get(host);if(h&&h.phase==='FIRING')h.shotsFired++;},
};
const tiers={PISTOL:'T1',SNIPER:'T5',RPG_7:'T3',GRENADE:'T3',COMBAT_BOOMERANG:'T2'};
const config={
 tierOf(id){return tiers[id]||null;},
 isGunOrLauncher(id){return ['PISTOL','SNIPER','RPG_7'].includes(id);},
 isHeroManipulableFloorWeapon(s){return s.phase==='REVEALED'&&s.kind==='WEAPON';},
 isMountableFloorGun(s){return s.phase==='REVEALED'&&s.kind==='WEAPON'&&this.isGunOrLauncher(s.weaponId);},
};
const spawn={
 registerExternalPickupConsumer(id,fn){assert.ok(!collectors.has(id));collectors.set(id,fn);return ()=>collectors.delete(id);},
 registerFloorAttractor(id,fn){assert.ok(!attractors.has(id));attractors.set(id,fn);return ()=>attractors.delete(id);},
};
const world={APEX_HERO_REWORK_AIL:{bus,clock:()=>t},
 APEX_ARSENAL_CONFIG:config,APEX_ARSENAL_SPAWN:spawn,
 APEX_ARSENAL:{weaponApi:weapons,state:{slots,resultLedger:{onHeal(){},onShot(){}}}},
 fighters:[a,b],console};
world.globalThis=world;
vm.runInNewContext(source,world,{filename:'shuriBattleRuntime.js'});
const ex={};world.APEX_SHURI_BATTLE.install(ex);
assert.deepEqual(Object.keys(ex).sort(),['shuri.machine','shuri.recycle','shuri.shock_recoil']);
const nativeEvents=[];
const ctx={combatant:ct,api:{
 emitEvent:(type,payload)=>{nativeEvents.push({type,payload,time:t});},
 nearestFreeWorldCircle:(x,y,r)=>({x,y,adjusted:false}),
 spawnWall(o){const s={id:++nextId,...o,maxHp:o.hp};solids.push(s);return s;},
 enemyBodies:()=>[b],applyStunTo:(f,d)=>nativeEvents.push({type:'stun',f,d,time:t}),
 gameSize:1000,
}};
const passive=ex['shuri.recycle'];
const castA1=ex['shuri.shock_recoil'].cast;
const a2=ex['shuri.machine'];
const state=()=>world.APEX_SHURI_BATTLE.stateOf(ct);
const step=(dt)=>{t+=dt;passive.onTick(ctx,dt);};
assert.equal(state().scrap,20);
bus.emit('ArsenalHolderEnded',{fighter:a,weaponId:'GRENADE',completion:true});
assert.equal(state().scrap,20,'non-gun throwable must be excluded');
bus.emit('ArsenalHolderEnded',{fighter:a,weaponId:'SNIPER',completion:false});
assert.equal(state().scrap,20,'disarmed holder must be excluded');
bus.emit('ArsenalHolderEnded',{fighter:a,weaponId:'SNIPER',completion:true,reason:'shot-fired'});
assert.equal(state().scrap,20,'Gold snap starts before any Scrap reward');
assert.equal(state().pendingRecycle.length,1);
step(2.95);
assert.equal(state().scrap,20,'Gold compressor must not pay early');
step(.06);
assert.equal(state().scrap,25,'eligible T5 awards 5 Scrap only at Gold 3s compressor');
assert.equal(a2.canCast(ctx),false,'cannot build with no anchor or insufficient Scrap');
assert.equal(castA1(ctx),true);
assert.equal(a2.canCast(ctx),false,'the native anchor has not yet been placed');
assert.equal(state().bomb,null,'Gold does not create a bomb at key press');
assert.equal(state().anchor,null,'Gold anchor appears only on placement');
b.x=450;b.y=400;
step(.39);
assert.equal(state().bomb,null,'still not placed at 0.39 seconds');
step(.02);
assert.equal(state().bomb.armed,false,'place at 0.40 seconds, not armed');
assert.equal(state().anchor.y,400,'anchor is at Gold cast position +50 on Y');
assert.equal(nativeEvents.filter(e=>e.type==='stun').length,0,'not armed yet');
step(.07);
assert.equal(nativeEvents.filter(e=>e.type==='stun').length,1,'stun only after 0.47 arm');
assert.equal(state().bomb,null,'bomb triggers at most once');
step(.09);
assert.ok(a.x<400,'Gold 0.52 recoil moves by native swept movement');
state().scrap=25;
assert.equal(a2.canCast(ctx),true);
assert.equal(a2.cast(ctx),true);
assert.equal(state().scrap,5);
const structure=state().structure;
assert.equal(structure.phase,'BUILD');assert.equal(structure.solid.hp,200);
assert.equal(structure.solid.shape,'circle');
assert.equal(structure.solid.friendlyProjectilePassThrough,true);
assert.equal(a2.canCast(ctx),false,'cannot repair before construction finishes');
structure.solid.hp=180;
step(5.02);
assert.equal(structure.phase,'ACTIVE');
assert.equal(collectors.size,1);
const slot={id:101,phase:'REVEALED',kind:'WEAPON',weaponId:'RPG_7',
 x:structure.solid.x+30,y:structure.solid.y};
const propose=[...collectors.values()][0](slot);
assert.equal(propose.commit(slot),true,'one native Rack acquire transaction');
assert.equal(structure.solid.hp,120,'Rack pays 60HP to equip T3 from 180');
assert.equal(weapons.getHolder(structure.emitter).weaponId,'RPG_7');
bus.emit('ArsenalHolderEnded',{fighter:structure.emitter,weaponId:'RPG_7',completion:true});
assert.equal(state().scrap,5,'Rack gun lifecycle must not grant Passive Scrap');
weapons.getHolder(structure.emitter).phase='FIRING';
assert.equal(castA1(ctx),true);
assert.equal(structure.phase,'ACTIVE','in-progress native shot must finish before morph');
step(.75);
assert.equal(structure.phase,'MORPH','Morph command fires at Gold 0.72 mark');
assert.equal(weapons.getHolder(structure.emitter),null,'holder released after last in-flight shot');
step(1.61);
assert.equal(structure.mode,'MED');
b.x=950;b.y=950;
a.x=structure.solid.x+100;a.y=structure.solid.y;
const beforeHp=a.hp, beforeSolidHp=structure.solid.hp;
step(.5);
assert.ok(a.hp>beforeHp && Math.abs((a.hp-beforeHp)-10)<1e-8);
assert.ok(Math.abs((beforeSolidHp-structure.solid.hp)-10)<1e-8,'heal has 1:1 structure HP cost');
state().scrap=9;structure.solid.hp=140;
assert.equal(a2.cast(ctx),true);
assert.equal(structure.solid.hp,200);
assert.equal(state().scrap,0,'repair consumes all Scrap even if only 60 HP is needed');
assert.equal(a2.canCast(ctx),false,'full HP must deny wasteful Repair');
structure.solid.hp=0;step(.016);
assert.equal(state().structure,null);
assert.equal(collectors.size,0);assert.equal(attractors.size,0);
passive.onTeardown(ctx);
assert.equal(state().disposed,true);
console.log('PASS SHURI native: passive eligibility, delayed arm, 5s build, real Rack, one final shot, morph, heal, repair, teardown');
