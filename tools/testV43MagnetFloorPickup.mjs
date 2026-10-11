#!/usr/bin/env node
// Regression: Magnet A1/A2 share the REAL floor pickup path for all 8 V43
// ranged holders, without pretending their special projectiles are aq_bullet.
import assert from 'node:assert/strict';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H=await bootHarness(),{win,T}=H;
const MAG=win.APEX_MAGNET,CFG=win.APEX_ARSENAL_CONFIG;
const W=win.APEX_ARSENAL_WEAPONS,HR=win.APEX_HERO_REWORK;
assert.equal(CFG.V43_SPECIAL_IDS.length,8,'owner-accepted eight V43 specials');
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng=()=>0.5;
let cases=0;
function checkSlot(id,expected){
  const slot={kind:'WEAPON',phase:'REVEALED',weaponId:id,x:500,y:500};
  assert.equal(MAG.isEligibleFloorFirearm(slot),expected,id+' revealed');
  assert.equal(MAG.isEligibleFloorFirearm({...slot,phase:'TELEGRAPH'}),false,id+' unrevealed');
  assert.equal(MAG.isEligibleFloorFirearm({...slot,kind:'HEAL'}),false,id+' heal');
  cases+=3;
}
for(const id of CFG.V43_SPECIAL_IDS){
  assert.equal(W[id]?.category,'ranged',id+' must have a real ranged holder');
  checkSlot(id,true);
}
checkSlot('PISTOL',true);
checkSlot('STORMBREAKER',false);
checkSlot('DOES_NOT_EXIST_V43',false);
for(const id of ['PLASMA_SPLITTER','FLAMETHROWER']){
  const spec=CFG.V43_WEAPONS[id];
  assert.deepEqual(Array.from(spec.magnetizableKinds),[],
    id+' emission is not kinetic despite magnetic FLOOR holder');
  cases++;
}
for(const id of CFG.V43_SPECIAL_IDS){
  T.start('MAGNET','MIRROR');
  T.holdSpawns();
  const [a,b]=H.fighters();
  a.baseSpeed=b.baseSpeed=0;
  a.x=150;a.y=500;b.x=850;b.y=500;
  a.setDir(1,0);b.setDir(-1,0);
  const slotId=T.pushSlot({x:500,y:500,kind:'WEAPON',phase:'REVEALED',weaponId:id});
  const slot=win.APEX_ARSENAL.state.slots.find(s=>s.id===slotId);
  assert.ok(slot,'real spawned floor slot '+id);
  const ct=HR.byCombatant(a);
  const ai=win.APEX_HERO_REWORK_MECHANICS.EXECUTORS['magnet.acquisition'].aiEvaluate({
    combatant:ct,cfg:ct.skills.A1.cfg,clock:()=>win.matchClock,api:{}
  });
  assert.equal(ai.shouldCast,true,'BOT A1 must consider registered V43 floor gun: '+id);
  const cast=HR.pressAbility(a,'A1');
  assert.equal(cast.ok,true,'real Magnet A1 must cast: '+id);
  const x0=slot.x;
  T.step(1/60);
  const influence=MAG.inspect(win.matchClock).floorInfluence.find(e=>e.slot===slot);
  assert.ok(slot.x<x0,'real A1 attracts '+id+' through floor movement integration');
  assert.ok(influence?.fields.some(f=>f.kind==='a1'),'real Magnet A1 provenance: '+id);
  cases+=4;
  win.exitArsenalBattleMode();
}

// Autonomous A2 must evaluate the *same* real projectile eligibility as
// physics. Incoming metal bolt is an opportunity; plasma energy is not.
T.start('MAGNET','MIRROR');
T.holdSpawns();
const [self,opponent]=H.fighters();
self.x=150;self.y=500;opponent.x=850;opponent.y=500;
win.APEX_ARSENAL.state.slots.length=0;
const ct=HR.byCombatant(self);
const projectile={aq:true,type:'aq_v43',weapon:'TACTICAL_CROSSBOW',
  kind:'bolt',phase:'flight',life:2,owner:opponent,
  x:250,y:500,vx:-300,vy:0};
const aiCtx={
  combatant:ct,cfg:ct.skills.A2.cfg,clock:()=>win.matchClock,
  api:{enemyBodies:()=>[],liveProjectiles:()=>[projectile],
    combatantOfBody:b=>HR.byCombatant(b),
    ownsBody:(c,b)=>c.anchor===b}
};
const decision=win.APEX_HERO_REWORK_MECHANICS.EXECUTORS['magnet.repulsion_field'].aiEvaluate(aiCtx);
assert.equal(decision.shouldCast,true,'BOT must anticipate kinetic V43 bolt');
projectile.weapon='PLASMA_SPLITTER';projectile.kind='plasma';
const denied=win.APEX_HERO_REWORK_MECHANICS.EXECUTORS['magnet.repulsion_field'].aiEvaluate(aiCtx);
assert.equal(denied.shouldCast,false,'BOT must not treat V43 plasma as magnetic material');
cases+=2;
win.exitArsenalBattleMode();

// Emergency unarmed replenishment must count *revealed V43 floor guns*
// rather than adding an unnecessary default pistol.
T.start('MAGNET','MIRROR');
T.holdSpawns();
const state=win.APEX_ARSENAL.state;
state.slots.length=0;
T.pushSlot({x:500,y:500,phase:'REVEALED',kind:'WEAPON',weaponId:'RPG_7'});
const before=state.slots.length;
state.spawnHeld=false;
state.spawnTimer=999;
state.unarmedFastConsumed=false;
T.step(1/60);
assert.equal(state.slots.length,before,
  'revealed V43 floor gun must suppress fake emergency firearm');
cases++;
win.exitArsenalBattleMode();

console.log('V43 MAGNET FLOOR HOLDER CONTRACT '+cases+'/'+cases+' PASS');
process.exit(0);
