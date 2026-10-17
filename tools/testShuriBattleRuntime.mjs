// Native SHURI ability semantics, tested without Gold art or a second combat engine.
// Owner update 2026-10-17: A1 disarm-recycle (no morph switch), contextual
// A2 (build / mount-on-completion / recovery hold / efficient repair),
// rack auto-reload paid in Scrap by tier, one operating range (200 from
// the circumference = 275 from the centre at radius 75), no floor suction.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('public/game/hero-rework/shuriBattleRuntime.js','utf8');
let t=0,nextId=0;
const handlers=new Map(),events=[],solids=[];
const bus={
 on(key,fn){const a=handlers.get(key)||[];a.push(fn);handlers.set(key,a);return ()=>{const i=a.indexOf(fn);if(i>=0)a.splice(i,1);};},
 emit(type,payload){events.push({type,payload,time:t});for(const fn of handlers.get(type)||[])fn({type,payload,t});},
};
const a={id:1,x:400,y:350,radius:75,hp:900,maxHp:1000,dir:{x:1,y:0},data:{}},
      b={id:2,x:720,y:350,radius:75,hp:1000,maxHp:1000,dir:{x:-1,y:0},data:{}};
const ct={heroId:'SHURI',combatantId:'p1',side:'p1',anchor:a,store:{}};
a.__hrCombatant=ct;
const held=new Map();
const weapons={
 getHolder(f){return held.get(f)||null;},
 createWeaponEmitter(owner,solid){return {__arsenalEmitterOwner:owner,__arsenalWorldSolid:solid,
  x:solid.x,y:solid.y,hp:solid.hp,radius:solid.radius,data:{arsenal:null},dir:{x:1,y:0}};},
 syncWeaponEmitter(host){host.x=host.__arsenalWorldSolid.x;host.y=host.__arsenalWorldSolid.y;
  host.hp=host.__arsenalWorldSolid.hp;return host.hp>0;},
 equip(host,id){if(held.has(host)||host.hp<=0)return false;
  held.set(host,{weaponId:id,phase:'READY',shotsFired:0,def:{shots:4}});return true;},
 // Mirror the real consume(): the Holder ends, THEN the generic lifecycle
 // event reports it with the canonical completion reason set.
 consume(host,reason){const h=held.get(host);if(!h)return;held.delete(host);
  bus.emit('ArsenalHolderEnded',{fighter:host,holder:h,weaponId:h.weaponId,reason:String(reason||'unknown'),
   completion:['sequence-complete','shot-fired','blast-resolved'].includes(reason)});},
 updateHolder(host){const h=held.get(host);if(!h)return;
  if(h.phase==='READY'){h.phase='FIRING';return;}
  if(h.phase==='FIRING'){h.shotsFired++;
   if(h.shotsFired>=(h.def?.shots||4))weapons.consume(host,'sequence-complete');}},
};
const tiers={PISTOL:'T1',SNIPER:'T5',RPG_7:'T3',GRENADE:'T3',COMBAT_BOOMERANG:'T2'};
const config={
 tierOf(id){return tiers[id]||null;},
 isGunOrLauncher(id){return ['PISTOL','SNIPER','RPG_7'].includes(id);},
};
const spawn={ // The new design must not touch floor pickups at all.
 registerExternalPickupConsumer(){throw Error('SHURI must not register a pickup consumer');},
 registerFloorAttractor(){throw Error('SHURI must not register a floor attractor');},
};
const world={APEX_HERO_REWORK_AIL:{bus,clock:()=>t},
 APEX_ARSENAL_CONFIG:config,APEX_ARSENAL_SPAWN:spawn,
 APEX_ARSENAL:{weaponApi:weapons,state:{resultLedger:{onHeal(){},onShot(){}}}},
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
// --- PASSIVE: eligibility + Gold compressor timing (unchanged law) ---
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
// --- A1: delayed place/arm, shock stuns AND steals the held gun ---
assert.equal(a2.canCast(ctx),false,'cannot build with no anchor');
assert.equal(weapons.equip(b,'SNIPER'),true,'enemy holds a T5 gun');
assert.equal(castA1(ctx),true);
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
assert.equal(weapons.getHolder(b),null,'shocked enemy is disarmed');
assert.equal(state().pendingRecycle.length,1,'stolen gun enters the shared recycle queue');
assert.equal(state().pendingRecycle[0].source,'a1-disarm');
assert.equal(state().pendingRecycle[0].amount,5,'stolen T5 is worth its tier');
assert.equal(state().scrap,25,'stolen Scrap also waits for the compressor');
step(.09);
assert.ok(a.x<400,'Gold 0.52 recoil moves by native swept movement');
step(3.0);
assert.equal(state().scrap,30,'stolen T5 pays 5 Scrap at the compressor beat');
// Shocked but NOT holding a gun/launcher: stun only, no theft.
a.x=400;a.y=350;b.x=450;b.y=400;
assert.equal(weapons.equip(b,'GRENADE'),true);
assert.equal(castA1(ctx),true);
step(.5);
assert.equal(nativeEvents.filter(e=>e.type==='stun').length,2,'second shock still stuns');
assert.ok(weapons.getHolder(b),'non-gun holder is never disarmed by A1');
assert.equal(state().pendingRecycle.length,0,'no theft from a non-gun holder');
weapons.consume(b,'thrown');
b.x=950;b.y=950; // park the enemy far away for structure tests
// --- A2 build at the anchor (unchanged entry branch) ---
state().scrap=25;a.x=400;a.y=350;
assert.equal(a2.canCast(ctx),true);
assert.equal(a2.cast(ctx),true);
assert.equal(state().scrap,5);
const structure=state().structure;
assert.equal(structure.phase,'BUILD');assert.equal(structure.solid.hp,200);
assert.equal(structure.solid.shape,'circle');
assert.equal(structure.solid.friendlyProjectilePassThrough,true);
assert.equal(a2.canCast(ctx),false,'no A2 branch exists before construction finishes');
step(5.02);
assert.equal(structure.phase,'ACTIVE');
assert.ok(structure.emitter,'build completion seats the weapon emitter');
assert.equal(structure.mountedWeaponId,null,'rack starts empty');
// --- Repair is efficient now: spend only absorbable Scrap ---
a.x=900;a.y=120;a.hp=1000; // far outside operating range, full HP, unarmed
state().scrap=9;structure.solid.hp=140;structure.lastSolidHp=140;
assert.equal(a2.cast(ctx),true);
assert.equal(structure.solid.hp,200);
assert.equal(state().scrap,3,'repair spends ceil(60/10)=6 Scrap and keeps the rest');
assert.equal(a2.canCast(ctx),false,'full HP + full structure must deny wasteful casts');
// --- Mount: held gun mounts on completion instead of recycling ---
assert.equal(weapons.equip(a,'PISTOL'),true);
const heldPistol=weapons.getHolder(a);
assert.equal(a2.cast(ctx),true,'A2 marks the held gun for mounting');
assert.equal(state().pendingMount?.holder,heldPistol);
assert.equal(a2.canCast(ctx),false,'re-marking the same Holder must not waste a cast');
assert.equal(weapons.getHolder(structure.emitter),null,'gun stays in SHURI hands until it finishes');
weapons.consume(a,'sequence-complete');
assert.equal(state().pendingMount,null);
assert.equal(structure.mountedWeaponId,'PISTOL','completed gun mounts the rack');
assert.equal(weapons.getHolder(structure.emitter)?.weaponId,'PISTOL');
assert.equal(state().pendingRecycle.length,0,'mounted gun must not also pay Passive Scrap');
assert.equal(structure.reloadDue,false,'the donated first magazine is free');
// Interrupted mount cancels and the gun keeps its ordinary fate.
assert.equal(weapons.equip(a,'RPG_7'),true);
assert.equal(a2.cast(ctx),true);
weapons.consume(a,'hunter-a2-disarm');
assert.equal(state().pendingMount,null,'interruption cancels the mount mark');
assert.equal(structure.mountedWeaponId,'PISTOL','rack keeps its previous gun');
assert.equal(state().pendingRecycle.length,0,'interrupted holder pays no Scrap');
// --- Rack: operating-range acquisition gate at READY only ---
const rackHolder=()=>weapons.getHolder(structure.emitter);
b.x=structure.solid.x+400;b.y=structure.solid.y; // centre distance 400 > 275
step(.1);
assert.equal(rackHolder().phase,'READY','no acquisition outside the operating range');
b.x=structure.solid.x+200; // centre distance 200 <= 275 (200 from circumference)
step(.1);
assert.equal(rackHolder().phase,'FIRING','acquisition inside the operating range');
b.x=structure.solid.x+900;b.y=950; // leaves mid-magazine
step(.1);step(.1);step(.1);
assert.ok((rackHolder()?.shotsFired||0)>=3||structure.reloadDue,'a firing magazine always finishes');
// --- Auto-reload pays Scrap equal to tier; starvation keeps the gun ---
state().scrap=3;
for(let i=0;i<6&&!structure.reloadDue;i++)step(.1);
assert.equal(structure.reloadDue,true,'magazine end re-seats the gun pending reload pay');
assert.equal(rackHolder()?.weaponId,'PISTOL','the same gun is re-seated at once');
step(.1); // pays T1 = 1 Scrap, resumes
assert.equal(state().scrap,2,'reload pays tier Scrap (T1 = 1)');
assert.equal(structure.reloadDue,false);
b.x=structure.solid.x+200;b.y=structure.solid.y;
for(let i=0;i<8&&!structure.reloadDue;i++)step(.1);
assert.equal(structure.reloadDue,true,'second magazine also ends into a reload');
state().scrap=0;
step(.1);step(.1);
assert.equal(structure.starved,true,'out of Scrap the rack starves');
assert.equal(structure.mountedWeaponId,'PISTOL','starved rack keeps its gun mounted');
assert.equal(rackHolder()?.shotsFired,0,'starved Holder is never advanced');
assert.equal(rackHolder()?.phase,'READY','starved Holder stays frozen at READY');
state().scrap=1;
step(.1);
assert.equal(structure.reloadDue,false,'fresh Scrap auto-resumes the rack');
assert.equal(state().scrap,0,'resume paid the pending tier cost');
// Rack gun lifecycle must never feed the Passive.
bus.emit('ArsenalHolderEnded',{fighter:structure.emitter,weaponId:'PISTOL',completion:true});
assert.equal(state().pendingRecycle.length,0,'emitter completions pay no Passive Scrap');
// --- Replace: a second donated gun replaces the mounted one ---
assert.equal(weapons.equip(a,'SNIPER'),true);
assert.equal(a2.cast(ctx),true);
weapons.consume(a,'shot-fired');
assert.equal(structure.mountedWeaponId,'SNIPER','new donation replaces the mounted gun');
assert.equal(rackHolder()?.weaponId,'SNIPER');
// --- Recovery hold: free heal, position lock, damage releases ---
weapons.consume(structure.emitter,'rack-replaced'); // silence the rack for isolation
structure.mountedWeaponId=null;
a.x=structure.solid.x+150;a.y=structure.solid.y;a.hp=900;
const solidHpBefore=structure.solid.hp;
assert.equal(a2.cast(ctx),true,'unarmed + hurt + in range enters recovery');
assert.equal(structure.recovery,true);
step(.5);
assert.ok(Math.abs(a.hp-910)<1e-8,'recovery heals 20 HP/s');
assert.equal(structure.solid.hp,solidHpBefore,'recovery costs the machine nothing');
assert.equal(a.data.positionLocked,true,'the machine holds SHURI in place');
passive.onRealizedDamage(ctx,{victimCombatant:ct,amount:12});
assert.equal(structure.recovery,false,'realized damage to SHURI releases the hold');
// Structure damage also releases.
assert.equal(a2.cast(ctx),true,'re-enter recovery');
step(.1);
structure.solid.hp-=25;
step(.1);
assert.equal(structure.recovery,false,'structure HP loss releases the hold');
// Full HP releases; A2 during recovery is the manual cancel.
a.hp=995;
assert.equal(a2.cast(ctx),true);
step(.5);
assert.equal(a.hp,1000);
assert.equal(structure.recovery,false,'full HP releases the hold');
a.hp=800;
assert.equal(a2.cast(ctx),true,'recovery again');
assert.equal(a2.cast(ctx),true,'A2 during recovery cancels it');
assert.equal(structure.recovery,false);
// A1 cast also releases (recoil is her own exit).
assert.equal(a2.cast(ctx),true,'recovery once more');
assert.equal(castA1(ctx),true);
assert.equal(structure.recovery,false,'A1 cast releases the hold');
// --- Destruction + teardown ---
structure.solid.hp=0;step(.016);
assert.equal(state().structure,null);
passive.onTeardown(ctx);
assert.equal(state().disposed,true);
assert.equal(state().pendingMount,null);
console.log('PASS SHURI native: passive recycle, A1 delayed arm + disarm theft, build, efficient repair, mount-on-completion, operating-range gate, Scrap reload/starve/replace, free recovery hold + damage release, teardown');
