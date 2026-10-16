import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/game/hero-rework/boxeBattleRuntime.js',import.meta.url),'utf8');
const a={id:1,x:0,y:0,radius:75,hp:1000,dir:{x:1,y:0}},
      b={id:2,x:320,y:0,radius:75,hp:1000};
let time=0;const events=[],slots=[];let held=new Map([[b,{weaponId:'SMG',phase:'READY'}]]);
const weapons={
  getHolder(body){return held.get(body)||null;},
  consume(body){held.delete(body);},
  equip(body,id){held.set(body,{weaponId:id,phase:'READY'});return true;},
  aqDamage(body,value,source,id){const actual=Math.min(body.hp,value);body.hp-=actual;return actual;}
};
const scope={APEX_ARSENAL:{weaponApi:weapons,state:{slots}},console};scope.globalThis=scope;
vm.runInNewContext(source,scope);
const BX=scope.APEX_BOXE_BATTLE,ct={heroId:'BOXE',anchor:a,store:{},skills:{A1:{cdLeft:0},A2:{cdLeft:0}}};
const other={heroId:'ROBOT',anchor:b};
const ctx={combatant:ct,api:{
  clock:()=>time,emitEvent:(name,body)=>events.push({name,body,time}),
  enemyOf:()=>other,combatantOfBody:body=>body===b?other:body===a?ct:null,
  applyStunTo:(body,dur)=>events.push({name:'NATIVE_STUN',body,dur,time}),
  dropWeaponSlot:(weaponId,x,y)=>{const slot={id:slots.length+1,weaponId,x,y,phase:'REVEALED',kind:'WEAPON'};slots.push(slot);return slot;}
}};
const ex=BX.executors;
assert.equal(Object.keys(ex).length,3);
assert.equal(ex['boxe.fist_rocket'].cast(ctx),true);
assert.equal(ex['boxe.fist_rocket'].cast(ctx),false);
assert.equal(ex['boxe.block_and_hit'].canCast(ctx),false,'A2 forbidden while A1 Rocket is active');
assert.equal(ex['boxe.block_and_hit'].cast(ctx),false,'no cooldown spent on forbidden A2');
for(let n=0;n<13;n++){time+=.02;ex['boxe.fist_rocket'].onTick(ctx,.02);}
assert.equal(b.hp,1000,'rocket never harms HP');
assert.ok(events.some(e=>e.name==='boxe:rocket-impact'),'real contact must create impulse + stun');
assert.ok(held.has(b),'A1 must not disarm target');
assert.equal(slots.length,0,'A1 cannot create a dropped enemy weapon');
assert.equal(BX.snapshot(ctx).rocket.cargoId,null,'no remote gun vacuum');
for(let n=0;n<342;n++){time+=.02;ex['boxe.fist_rocket'].onTick(ctx,.02);}
assert.equal(BX.snapshot(ctx).rocket,null,'rocket completes catch');
assert.equal(weapons.getHolder(a),null,'A1 never steals opponent gun');
// A1 may pick one actual ground gun, never mint out of nothing.
const reserve=ctx.api.dropWeaponSlot('PISTOL',100,0);
a.x=0;time=20;
assert.equal(ex['boxe.fist_rocket'].cast(ctx),true);
for(let n=0;n<300;n++){time+=.02;ex['boxe.fist_rocket'].onTick(ctx,.02);}
assert.equal(BX.snapshot(ctx).rocket,null);
assert.equal(weapons.getHolder(a)?.weaponId,'PISTOL');
assert.ok(!slots.includes(reserve));
// Rejected owned-fighter input must never trigger A2.
time=40;
assert.equal(ex['boxe.block_and_hit'].cast(ctx),true);
let p=ex['boxe.block_and_hit'].onTakeDamage(ctx,a,{amount:250,source:null});
assert.equal(p.amount,250,'neutral hit is not intercepted');
p=ex['boxe.block_and_hit'].onTakeDamage(ctx,a,{amount:240,source:b});
assert.equal(p.amount,0,'opponent-owned hit is intercepted');
for(let i=0;i<25;i++){time+=.016;ex['boxe.block_and_hit'].onTick(ctx,.016);}
assert.equal(b.hp,1000,'ordinary counter 0 HP damage');
const stolen=slots.find(slot=>slot.boxeEjection);
assert.ok(stolen,'A2 must create an actual Arsenal floor gun');
assert.ok(stolen.boxeEjection.vx<0,'A2 ejection must travel toward BOXE');
// Passive only tracks real recognized HP transactions; no carried excess.
time=50;
ex['boxe.heat'].onRealizedDamage(ctx,{amount:301,creditedTo:ct,victimCombatant:other,weaponId:'SMG'});
assert.equal(BX.snapshot(ctx).progress,0);
assert.ok(BX.snapshot(ctx).enhancedUntil>time);
ct.skills.A1.cdLeft=12;ct.skills.A2.cdLeft=8;
ex['boxe.heat'].onTick(ctx,.5);
assert.equal(ct.skills.A1.cdLeft,11.5,'extra 1x refund while native tick supplies the other 1x');
// Block and Hit empowered finisher resolves current remaining HP only.
time=51;
a.x=100;b.x=270;b.hp=800;held.set(b,{weaponId:'SMG',phase:'READY'});
assert.equal(ex['boxe.block_and_hit'].cast(ctx),true);
p=ex['boxe.block_and_hit'].onTakeDamage(ctx,a,{amount:200,source:b});
assert.equal(p.amount,0);
for(let i=0;i<24;i++){time+=.016;ex['boxe.block_and_hit'].onTick(ctx,.016);}
assert.equal(b.hp,720,'exact 10% remaining-HP finisher through native weapon authority');
assert.ok(events.some(e=>e.name==='boxe:counter-contact'&&e.body.finisher));
// Timeout: any unconfirmed guard must not create free stun, disarm, or damage.
time=60;b.hp=600;
assert.equal(ex['boxe.block_and_hit'].cast(ctx),true);
time+=1.01;ex['boxe.block_and_hit'].onTick(ctx,1.01);
assert.equal(BX.snapshot(ctx).counter,null);
assert.equal(b.hp,600);
// T6 cannot be disarmed by BOXE A2 (Arsenal hero-manipulation immunity).
time=100;held.set(b,{weaponId:'STORMBREAKER',phase:'READY'});
assert.equal(ex['boxe.block_and_hit'].cast(ctx),true);
p=ex['boxe.block_and_hit'].onTakeDamage(ctx,a,{amount:150,source:b});
for(let i=0;i<24;i++){time+=.016;ex['boxe.block_and_hit'].onTick(ctx,.016);}
assert.equal(held.get(b)?.weaponId,'STORMBREAKER','A2 must honor T6 immunity');
assert.equal(slots.filter(x=>x.weaponId==='STORMBREAKER').length,0);
// Every event has exact identity; no P1-to-P2 cross-owner emission.
for(const e of events.filter(e=>e.name.startsWith('boxe:')))assert.equal(e.body.hero,'BOXE');
console.log('PASS BOXE normal battle semantic runtime: rocket real hit without disarm, native ground gun, counter-only disarm, passive, cooldown');
