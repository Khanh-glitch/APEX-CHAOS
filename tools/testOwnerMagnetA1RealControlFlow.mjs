// Regression for the EXACT gap owner found: the physical A1 force works
// when manually cast in old tests, but BOT decision-making used isGun()
// and never initiated the field for V4.3, grenade or melee World Weapons.
import assert from 'node:assert/strict';
import {bootHarness} from './lib/crystalaHarness.mjs';
const H=await bootHarness(), {win,T,HR,CFG}=H;
const MAG=win.APEX_MAGNET, AR=win.APEX_ARSENAL;
const profile=win.__apexArsenalBattleProfile;
try {
  win.__apexArsenalBattleProfile='BOT';
  HR.setSeed(703);
  HR.setAiEnabled(true);
  assert.ok(T.start('ROBOT','MAGNET'),'BOT Magnet match must start');
  T.holdSpawns();
  // The real CPU P2 planner and real Arsenal pickup seam own the simulation.
  // No manual HR.pressAbility or direct MAG.stepWorld is allowed in this test.
  const [opponent,magnet]=H.fighters();
  opponent.x=900;opponent.y=900;opponent.baseSpeed=0;
  magnet.x=310;magnet.y=500;magnet.baseSpeed=0;
  const ids=['RPG_7','SABRE','GRENADE'];
  const spots=[[490,500],[500,600],[600,470]];
  const slots=ids.map((weaponId,i)=>{
    const [x,y]=spots[i];
    const id=T.pushSlot({kind:'WEAPON',phase:'REVEALED',weaponId,x,y});
    return {weaponId,id,x,y};
  });
  for(const {weaponId,id} of slots){
    const s=AR.state.slots.find(x=>x.id===id);
    assert.equal(CFG.isHeroManipulableFloorWeapon(s),true,weaponId+' canonical World Weapon');
    assert.equal(CFG.isGun(weaponId),false,weaponId+' must not regress to isGun AI shortcut');
  }
  // Sample every actual simulation frame: the canonical pickup may REMOVE
  // an attracted RPG before the final snapshot. Remember real movement,
  // never count a disappearance alone as proof of magnetic displacement.
  const travel=new Map(slots.map(o=>[o.id,0]));
  for(let i=0;i<84;i++){
    T.step(1/60);
    for(const item of slots){
      const obj=AR.state.slots.find(s=>s.id===item.id);
      if(obj)travel.set(item.id,Math.max(travel.get(item.id)||0,
        Math.hypot(obj.x-item.x,obj.y-item.y)));
    }
  }
  const ct=HR.byCombatant(magnet),snap=MAG.inspect(win.matchClock);
  const field=snap.fields.find(x=>x.combatant===ct);
  const ai=HR.match?.aiCastPlan||{};
  const diag={clock:win.matchClock,mode:AR.state.battleMode,lab:AR.state.labMode,
    hrAi:HR.aiEnabled,mAi:HR.match?.aiEnabled,hero:ct?.heroId,
    fields:snap.fields.map(s=>({hero:s.combatant?.heroId,casts:s.casts})),
    plans:ai,floor:AR.state.slots.map(s=>({id:s.weaponId,phase:s.phase,
      world:CFG.isHeroManipulableFloorWeapon(s)}))};
  console.log('MAGNET_BOT_REAL_A1_DIAGNOSTIC '+JSON.stringify(diag));
  assert.ok(field&&field.casts.a1>0,
    'BOT Magnet must autonomously cast A1 against V43/melee/grenade Weapon floor: '+
      JSON.stringify(diag));
  for(const original of slots){
    const distance=travel.get(original.id)||0;
    assert.ok(distance>0.2,
      original.weaponId+' must physically move before pickup or removal, tracked='+distance);
  }
  console.log('PASS MAGNET BOT A1 REAL World Weapon AI + physics (RPG/SABRE/GRENADE)');
} finally {
  win.__apexArsenalBattleProfile=profile??'LOCAL';
}
HR.setSeed(704);HR.setAiEnabled(false);
assert.ok(T.start('MAGNET','ROBOT'),'player Magnet match must start');
T.holdSpawns();
const [player,rival]=H.fighters();
player.x=300;player.y=500;player.baseSpeed=0;
rival.x=880;rival.y=850;rival.baseSpeed=0;
// REPRODUCE production bug: never fabricate a correctly typed floor slot.
const SPAWN=win.APEX_ARSENAL_SPAWN;
const slot=SPAWN.trySpawnSlot({forceFirearm:true});
assert.ok(slot,'real Arsenal TELEGRAPH weapon must be created');
assert.equal(slot.kind,'WEAPON','real spawn must own the World Weapon tag');
assert.equal(slot.phase,'TELEGRAPH','real normal pickup reveal lifecycle');
const weaponId=slot.questWeaponId||null;
player.x=slot.x>500?slot.x-190:slot.x+190;
player.y=slot.y;
rival.x=slot.x>500?120:880;
rival.y=slot.y>500?120:880;
T.step(3.1); // NORMAL force-reveal path, not a synthetic REVEALED object.
assert.equal(slot.phase,'REVEALED','normal Arsenal slot never became visible');
assert.equal(slot.kind,'WEAPON','real revealed slot lost World Weapon tag');
assert.equal(CFG.isHeroManipulableFloorWeapon(slot),true,
  'real revealed firearm must enter canonical Magnet/Frost World role');
const start={x:slot.x,y:slot.y};
assert.equal(win.APEX_ARSENAL_SKILL_GATE.pressJ(player),true,
  'actual P1 skill-gate J input must accept Magnet A1');
T.step(.35);
const moved=Math.hypot(slot.x-start.x,slot.y-start.y);
assert.ok(moved>2,
  'P1 Magnet A1 must pull a NATURALLY spawned Weapon, id='+slot.weaponId+' moved='+moved);
console.log('PASS MAGNET P1 A1 skill gate + naturally spawned '+slot.weaponId+' displacement='+moved);
console.log('MAGNET A1 REAL CONTROL FLOW 2/2 PASS');
process.exit(0); // QA harness owns live image/audio handles; don't hold CI open
