// OWNER D5: REAL effective Arsenal role authority, NO second weapon registry.
import assert from 'node:assert/strict';
import {bootHarness} from './lib/crystalaHarness.mjs';
const H=await bootHarness(),{win,T}=H,C=H.CFG,HR=H.HR;
const M=win.APEX_MAGNET,F=win.APEX_FROST;
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS D5 '+name);}catch(e){console.error('FAIL D5 '+name);throw e;}}
const role=id=>C.isOffensive(id) && C.tierOf(id)!=='T6';
test('all effective equipment IDs inherit 1 common legal Weapon role',()=>{
 assert.equal(C.P0_WEAPON_IDS.length,41);
 assert.equal(C.OFFENSIVE_WEAPON_IDS.length,39);
 assert.equal(C.SHIELD_IDS.length,2);
 for(const id of C.P0_WEAPON_IDS){
  const s={kind:'WEAPON',phase:'REVEALED',weaponId:id,tier:C.tierOf(id)};
  assert.equal(C.isHeroManipulableFloorWeapon(s),role(id),id+'/role');
  assert.equal(M.isEligibleFloorWeapon(s),role(id),id+'/magnet');
  assert.equal(F.isFreezableWeapon(s),role(id),id+'/frost');
 }
});
test('T6, Defense, HEAL, unrevealed, unknown and immune floor denied',()=>{
 for(const id of ['SWIRL_SHIELD','TOWER_SHIELD','STORMBREAKER','UNKNOWN']){
  const slot={kind:'WEAPON',phase:'REVEALED',weaponId:id};
  assert.equal(M.isEligibleFloorWeapon(slot),false,id);
  assert.equal(F.isFreezableWeapon(slot),false,id);
 }
 for(const bad of [
  {kind:'HEAL',phase:'REVEALED',weaponId:'PISTOL'},
  {kind:'WEAPON',phase:'TELEGRAPH',weaponId:'PISTOL'},
  {kind:'WEAPON',phase:'HELD',weaponId:'PISTOL'},
  {kind:'WEAPON',phase:'REVEALED',weaponId:'PISTOL',heroInteractionImmune:true}
 ])assert.equal(M.isEligibleFloorWeapon(bad),false,JSON.stringify(bad));
});
test('held Weapon can be frozen or stolen without equating holder with floor',()=>{
 for(const id of ['GRENADE','SABRE','COMBAT_BOOMERANG','RPG_7']){
  assert.equal(F.isFreezableWeapon({weaponId:id}),true,id);
 }
 assert.equal(F.isFreezableWeapon({weaponId:'STORMBREAKER'}),false);
});
test('Frozen nonfirearm has ZERO Frozen Bullet passive tag',()=>{
 const holder={weaponId:'GRENADE',shotsFired:0,__frostFrozen:{at:1}};
 const owner={data:{arsenal:holder}};
 assert.equal(F.tagFrozenBullet({}, {type:'aq_grenade',weapon:'GRENADE',__hr:{}},owner),false);
 holder.weaponId='SABRE';
 assert.equal(F.tagFrozenBullet({}, {type:'aq_thrown',weapon:'SABRE',__hr:{}},owner),false);
 holder.weaponId='COMBAT_BOOMERANG';
 assert.equal(F.tagFrozenBullet({}, {type:'aq_v43',weapon:'COMBAT_BOOMERANG',__hr:{}},owner),false);
 holder.weaponId='FLAMETHROWER';
 assert.equal(F.tagFrozenBullet({}, {type:'aq_v43',weapon:'FLAMETHROWER',__hr:{}},owner),false);
 holder.weaponId='PISTOL';
 assert.equal(F.tagFrozenBullet({}, {type:'aq_bullet',weapon:'PISTOL',__hr:{}},owner),true);
});
test('fresh canonical future T3 Weapon admitted without per-Hero edits',()=>{
 const future='OWNER_FUTURE_TRIAL_WEAPON';
 try{
  C.WEAPON_TIER[future]='T3';
  const s={kind:'WEAPON',phase:'REVEALED',weaponId:future,tier:'T3'};
  assert.equal(C.isOffensive(future),true);
  assert.equal(M.isEligibleFloorWeapon(s),true);
  assert.equal(F.isFreezableWeapon(s),true);
 }finally{delete C.WEAPON_TIER[future];}
});
test('field A1 physically moves ordinary plus V43 plus melee floor Weapons',()=>{
 HR.setSeed(1337);HR.setAiEnabled(false);
 const m=T.start('MAGNET','ROBOT');assert.ok(m);
 T.holdSpawns();
 const [a,b]=H.fighters();
 a.x=310;a.y=500;a.baseSpeed=0;
 b.x=850;b.y=500;b.baseSpeed=0;
 const items=[
  {x:615,y:500,kind:'WEAPON',phase:'REVEALED',weaponId:'PISTOL'},
  {x:615,y:530,kind:'WEAPON',phase:'REVEALED',weaponId:'RPG_7'},
  {x:615,y:470,kind:'WEAPON',phase:'REVEALED',weaponId:'SABRE'},
  {x:635,y:550,kind:'WEAPON',phase:'REVEALED',weaponId:'GRENADE'},
  {x:635,y:440,kind:'WEAPON',phase:'REVEALED',weaponId:'FLAMETHROWER'},
  {x:615,y:570,kind:'WEAPON',phase:'REVEALED',weaponId:'STORMBREAKER'},
  {x:615,y:430,kind:'WEAPON',phase:'REVEALED',weaponId:'SWIRL_SHIELD'}
 ];
 const ids=items.map(x=>T.pushSlot(x));
 const get=id=>win.APEX_ARSENAL.state.slots.find(s=>s.id===id);
 const starts=ids.map(id=>({id,x:get(id).x,y:get(id).y}));
 assert.ok(HR.pressAbility(a,'A1').ok);
 T.step(.15);
 for(let i=0;i<items.length;i++){
  const s=get(ids[i]);assert.ok(s,'floor slot missing '+items[i].weaponId);
  const moved=Math.hypot(s.x-starts[i].x,s.y-starts[i].y);
  if(role(items[i].weaponId)) assert.ok(moved>0.1,items[i].weaponId+' was not attracted');
  else assert.ok(moved<.01,items[i].weaponId+' wrongly attracted');
 }
});
console.log('OWNER WORLD EQUIPMENT D5: '+passed+'/'+passed+' real runtime tests PASS');
process.exit(0);
