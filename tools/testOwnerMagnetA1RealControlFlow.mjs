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
  T.step(1.4);
  const ct=HR.byCombatant(magnet),snap=MAG.inspect(win.matchClock);
  const field=snap.fields.find(x=>x.combatant===ct);
  assert.ok(field&&field.casts.a1>0,
    'BOT Magnet must autonomously cast A1 against V43/melee/grenade Weapon floor');
  for(const original of slots){
    const current=AR.state.slots.find(s=>s.id===original.id);
    const moved=current ? Math.hypot(current.x-original.x,current.y-original.y) : 0;
    const attracted=snap.floorInfluence.some(x=>x.slot.id===original.id)
      ||snap.floorFirearms.some(x=>x.slot.id===original.id&&x.integrations>0);
    assert.ok(moved>0.2||(!current&&attracted),
      original.weaponId+' must move via real pickup-seam integration, moved='+moved);
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
const id=T.pushSlot({kind:'WEAPON',phase:'REVEALED',weaponId:'PISTOL',x:490,y:550});
const slot=AR.state.slots.find(s=>s.id===id);
const start={x:slot.x,y:slot.y};
assert.equal(win.APEX_ARSENAL_SKILL_GATE.pressJ(player),true,
  'actual P1 skill-gate J input must accept Magnet A1');
T.step(.35);
assert.ok(Math.hypot(slot.x-start.x,slot.y-start.y)>2,
  'P1 Magnet A1 must pull an ordinary Pistol on real battle step');
console.log('PASS MAGNET P1 A1 actual skill gate + PISTOL floor displacement');
console.log('MAGNET A1 REAL CONTROL FLOW 2/2 PASS');
