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
  const roles=C.WEAPONS[id]?.worldRoles;
  assert.ok(Array.isArray(roles)&&roles.length>0,id+' missing effective worldRoles');
  assert.equal(C.hasWorldRole(id,'weapon'),C.OFFENSIVE_WEAPON_IDS.includes(id),id+' role-vs-pool baseline');
  assert.equal(C.hasWorldRole(id,'defense'),C.SHIELD_IDS.includes(id),id+' defense baseline');
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
 // Actual HR.onFireBullet sends an intentionally untyped stand-in before
 // the real aq_bullet body is emitted; this must remain a valid Frozen Bullet.
 const standin={weapon:'PISTOL',critical:false,__hr:{}};
 assert.equal(F.tagFrozenBullet({},standin,owner),true,
   'real onFireBullet stand-in cannot be rejected for lacking p.type');
 assert.ok(standin.__hr.frost?.group,'untyped stand-in must carry blast provenance');
 assert.equal(F.tagFrozenBullet({}, {weapon:'RPG_7',__hr:{}},owner),false,
   'mismatched emitter may not borrow frozen gun provenance');
});
test('future nonspawning Weapon and tiered Defense / hybrid roles stay distinct',()=>{
 const W='OWNER_FUTURE_QUEST_ONLY_WEAPON',D='OWNER_FUTURE_T2_DEFENSE',
   H='OWNER_FUTURE_HYBRID_EQUIPMENT';
 const slot=id=>({kind:'WEAPON',phase:'REVEALED',weaponId:id,tier:C.tierOf(id)});
 try{
  // One canonical identity declaration, no Hero patch, no spawn admission.
  C.WEAPONS[W]={worldRoles:['weapon']};C.WEAPON_TIER[W]='T3';
  assert.ok(!C.OFFENSIVE_WEAPON_IDS.includes(W),'trial Weapon must not be in random spawn pool');
  assert.equal(C.isOffensive(W),true,'World role independent of random spawn roster');
  assert.equal(M.isEligibleFloorWeapon(slot(W)),true);
  assert.equal(F.isFreezableWeapon(slot(W)),true);

  // A separate Defense pool may still assign rarity to a shield.
  C.WEAPONS[D]={worldRoles:['defense']};C.WEAPON_TIER[D]='T2';
  assert.equal(C.isOffensive(D),false,'having a tier does NOT make an item a Weapon');
  assert.equal(C.hasWorldRole(D,'defense'),true);
  assert.equal(M.isEligibleFloorWeapon(slot(D)),false);
  assert.equal(F.isFreezableWeapon(slot(D)),false);

  // Composite roles must not need special-case lists on every old Hero.
  C.WEAPONS[H]={worldRoles:['weapon','defense']};C.WEAPON_TIER[H]='T4';
  assert.equal(C.hasWorldRole(H,'weapon'),true);
  assert.equal(C.hasWorldRole(H,'defense'),true);
  assert.equal(M.isEligibleFloorWeapon(slot(H)),true);
  assert.equal(F.isFreezableWeapon(slot(H)),true);
 }finally{
  for(const id of [W,D,H]){delete C.WEAPON_TIER[id];delete C.WEAPONS[id];}
 }
});
test('A1 Weapon law and A2 material response are independent, including instance overrides',()=>{
 const ids=['PISTOL','RPG_7','GRENADE','SABRE','FLAMETHROWER'];
 for(const id of ids){
  const slot={kind:'WEAPON',phase:'REVEALED',weaponId:id,tier:C.tierOf(id)};
  assert.equal(C.magneticResponseOf(id,slot),'responsive',id+' baseline magnetic response');
  assert.equal(M.isEligibleA2FloorWeapon(slot),true,id+' current A2 parity');
  slot.magneticResponse='inert';
  assert.equal(M.isEligibleFloorWeapon(slot),true,id+' A1 must still attract');
  assert.equal(M.isEligibleA2FloorWeapon(slot),false,id+' A2 must not repel');
  slot.magneticResponse='responsive';
  assert.equal(M.isEligibleA2FloorWeapon(slot),true,id+' instance responsive');
  slot.magneticResponse='invalid';
  assert.equal(M.isEligibleA2FloorWeapon(slot),false,id+' invalid instance fails closed');
 }
 const W='FUTURE_A2_NONMAGNETIC_WEAPON',H='FUTURE_A2_HYBRID',D='FUTURE_A2_DEFENSE';
 try{
  C.WEAPONS[W]={worldRoles:['weapon'],magneticResponse:'inert'};
  C.WEAPONS[H]={worldRoles:['weapon','defense'],magneticResponse:'responsive'};
  C.WEAPONS[D]={worldRoles:['defense'],magneticResponse:'responsive'};
  const slot=id=>({kind:'WEAPON',phase:'REVEALED',weaponId:id});
  assert.equal(M.isEligibleFloorWeapon(slot(W)),true,'nonmagnetic Weapon still A1 eligible');
  assert.equal(M.isEligibleA2FloorWeapon(slot(W)),false,'nonmagnetic Weapon A2 denied');
  assert.equal(F.isFreezableWeapon(slot(W)),true,'nonmagnetic Weapon still Frost eligible');
  assert.equal(M.isEligibleA2FloorWeapon(slot(H)),true,'hybrid allows A2 if responsive');
  assert.equal(M.isEligibleA2FloorWeapon(slot(D)),false,'Defense alone does not become Weapon');
  assert.equal(M.isEligibleA2FloorWeapon({...slot(W),magneticResponse:'responsive'}),true,
   'instance response overrides canonical definition');
  assert.equal(M.isEligibleA2FloorWeapon({...slot(H),magneticResponse:'inert'}),false,
   'instance inert overrides responsive hybrid');
  delete C.WEAPONS[W].magneticResponse;
  assert.equal(M.isEligibleA2FloorWeapon(slot(W)),false,'missing future trait fails closed');
 }finally{for(const id of [W,H,D])delete C.WEAPONS[id];}
});
test('real Frost A1 freezes revealed melee, Grenade and V43 but not Defense/T6',()=>{
 HR.setSeed(26);HR.setAiEnabled(false);
 const match=T.start('ICE','ROBOT');assert.ok(match);
 T.holdSpawns();
 const [a,b]=H.fighters();a.x=200;a.y=500;a.setDir(1,0);
 b.x=800;b.y=800;b.setDir(-1,0);
 assert.equal(win.APEX_ARSENAL_SKILL_GATE.pressJ(a),true);
 T.step(.9);
 const lane=F.inspect(HR.byCombatant(a)).lanes[0];
 assert.ok(lane&&lane.len>250,'no real Frost Breath floor');
 a.x=100;a.y=100;b.x=100;b.y=900;
 const ids=['SABRE','GRENADE','RPG_7','SWIRL_SHIELD','STORMBREAKER'];
 const slots=ids.map((weaponId,i)=>T.pushSlot({
   kind:'WEAPON',phase:'REVEALED',weaponId,x:lane.ox+270+i*52,y:lane.oy
 }));
 T.step(2/60);
 const current=win.APEX_ARSENAL.state.slots;
 for(let i=0;i<ids.length;i++){
   const slot=current.find(s=>s.id===slots[i]);
   assert.ok(slot,'slot vanished from real floor: '+ids[i]);
   assert.equal(!!slot.__frostFrozen,i<3,ids[i]+' A1 Frozen Equipment');
 }
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
test('REAL Magnet A2 repels responsive floor equipment but leaves inert Weapon stationary',()=>{
 HR.setSeed(138);HR.setAiEnabled(false);
 assert.ok(T.start('MAGNET','ROBOT'));T.holdSpawns();
 const [a,b]=H.fighters();
 a.x=310;a.y=500;a.baseSpeed=0;
 b.x=900;b.y=900;b.baseSpeed=0;
 const specs=[
  {kind:'WEAPON',phase:'REVEALED',weaponId:'PISTOL',magneticResponse:'inert',x:410,y:500},
  {kind:'WEAPON',phase:'REVEALED',weaponId:'PISTOL',magneticResponse:'responsive',x:410,y:550}
 ];
 const ids=specs.map(s=>T.pushSlot(s));
 const get=id=>win.APEX_ARSENAL.state.slots.find(s=>s.id===id);
 const before=ids.map(id=>({x:get(id).x,y:get(id).y}));
 const cast=HR.pressAbility(a,'A2');assert.equal(cast.ok,true,'real A2 cast');
 T.step(.1);
 const after=ids.map(id=>get(id));
 for(const s of after)assert.ok(s&&s.phase==='REVEALED','floor persisted through live A2');
 const inertDistance=Math.hypot(after[0].x-before[0].x,after[0].y-before[0].y);
 const responsiveDistance=Math.hypot(after[1].x-before[1].x,after[1].y-before[1].y);
 assert.ok(inertDistance<.01,'A2 incorrectly displaced inert Weapon: '+inertDistance);
 assert.ok(responsiveDistance>.1,'A2 failed to repel responsive Weapon: '+responsiveDistance);
 assert.ok(after[1].x>before[1].x,'A2 response must be outward');
});
console.log('OWNER WORLD EQUIPMENT D5: '+passed+'/'+passed+' real runtime tests PASS');
process.exit(0);
