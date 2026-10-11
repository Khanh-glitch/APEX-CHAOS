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
  const cast=HR.pressAbility(a,'A1');
  assert.equal(cast.ok,true,'real Magnet A1 must cast: '+id);
  const slotId=T.pushSlot({x:500,y:500,kind:'WEAPON',phase:'REVEALED',weaponId:id});
  const slot=win.APEX_ARSENAL.state.slots.find(s=>s.id===slotId);
  assert.ok(slot,'real spawned floor slot '+id);
  const x0=slot.x;
  T.step(1/60);
  const influence=MAG.inspect(win.matchClock).floorInfluence.find(e=>e.slot===slot);
  assert.ok(slot.x<x0,'real A1 attracts '+id+' through floor movement integration');
  assert.ok(influence?.fields.some(f=>f.kind==='a1'),'real Magnet A1 provenance: '+id);
  cases+=3;
  win.exitArsenalBattleMode();
}
console.log('V43 MAGNET FLOOR HOLDER CONTRACT '+cases+'/'+cases+' PASS');
process.exit(0);
