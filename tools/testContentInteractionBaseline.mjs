#!/usr/bin/env node
// CP2: Pin behavior of shipped AIL, Arsenal, Hero Rework and eight V4.3 weapons.
// SOURCE baseline: main@578098c73436e3263a34f5b83b6ceb8340b26258.
// This is a regression gate, NOT a new interaction runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHarness } from './lib/crystalaHarness.mjs';
import { BASE_HERO_IDS, BASE_WEAPON_IDS, BASE_GUN_IDS, BASE_V43_IDS } from './lib/contentBaseline.mjs';

const baseline = {
  FLARE_GUN:               {kind:'flare',     reflect:['flare'],                magnet:[]},
  TACTICAL_CROSSBOW:      {kind:'bolt',      reflect:['bolt'],                 magnet:['bolt']},
  STEEL_BALL_LAUNCHER:    {kind:'ball',      reflect:['ball'],                 magnet:['ball']},
  COMBAT_BOOMERANG:       {kind:'boomerang', reflect:['boomerang'],            magnet:['boomerang']},
  RPG_7:                  {kind:'rocket',    reflect:['rocket'],               magnet:['rocket']},
  FLAMETHROWER:           {kind:'flame',     reflect:[],                       magnet:[]},
  PLASMA_SPLITTER:        {kind:'plasma',    reflect:['plasma-core','plasma'], magnet:[]},
  SHRAPNEL_MINE_LAUNCHER: {kind:'mine',      reflect:['mine'],                 magnet:['mine','fragment']},
};
const H = await bootHarness(), {win,T} = H;
const C = win.APEX_ARSENAL_CONFIG, A = win.APEX_HERO_REWORK_AIL;
const R = win.APEX_HERO_REWORK_REGISTRY, M = win.APEX_MAGNET, F = win.APEX_FROST;
const W = win.APEX_ARSENAL.weaponApi, HR = win.APEX_HERO_REWORK;
let passed=0, failed=0;
function gate(name, test) {
  try { test(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + '\n' + String(e?.stack || e)); }
}
gate('boot-real-production-runtime', () => {
  assert.ok(C && A && R && M && F && W && HR && win.APEX_ARSENAL_WEAPONS);
  assert.deepEqual(H.loadErrors.filter(x => /arsenal|hero-rework|apexEngine/.test(x.file)), []);
});
gate('canonical-12-heroes-preserved-with-extensible-ID-set', () => {
  const ids=Object.keys(R.HEROES);
  for(const id of BASE_HERO_IDS){
    assert.ok(ids.includes(id),'missing original hero '+id);
    for(const slot of ['A1','A2','PASSIVE']){
      const skill=R.HEROES[id].skills?.[slot];
      assert.ok(skill?.mechanicId,'missing skill '+id+'.'+slot);
      assert.ok(Array.isArray(skill.progressionBinding?.knobPath),'missing progression knob '+id+'.'+slot);
      assert.ok(R.resolveSkillLevel(id,slot,1),'Lv1 broken '+id+'.'+slot);
    }
  }
  // Production validateRegistry still hard-codes 12/36 until a revisioned CP5 cutover.
  if(ids.length===BASE_HERO_IDS.length){
    const r=R.validateRegistry();assert.equal(r.ok,true,r.errors.join('; '));
  }
});
gate('canonical-24-guns-8-specials-41-items-preserved-with-extensions', () => {
  for(const id of BASE_GUN_IDS)assert.ok(C.GUN_REGISTRY.some(e=>e.id===id),'missing original gun '+id);
  for(const id of BASE_V43_IDS)assert.ok(C.V43_SPECIAL_IDS.includes(id),'missing original special '+id);
  for(const id of BASE_WEAPON_IDS)assert.ok(C.P0_WEAPON_IDS.includes(id),'missing original item '+id);
  assert.ok(C.P0_WEAPON_IDS.length>=BASE_WEAPON_IDS.length);
  assert.equal(new Set(Array.from(C.P0_WEAPON_IDS)).size,C.P0_WEAPON_IDS.length);
  for(const id of ['CHAIN_WHIP','HARPOON_LAUNCHER','RAILGUN','TWIN_REAPER_SCYTHES'])
    assert.equal(C.P0_WEAPON_IDS.includes(id),false);
});
gate('eight-specials-kind-policy-snapshot', () => {
  for(const id of Object.keys(baseline))assert.ok(C.V43_WEAPONS[id],'missing original V43 '+id);
  for(const [id,b] of Object.entries(baseline)) {
    const live=C.V43_WEAPONS[id];
    assert.equal(live.kind,b.kind,id+' kind');
    assert.deepEqual(Array.from(live.reflectableKinds),b.reflect,id+' reflection');
    assert.deepEqual(Array.from(live.magnetizableKinds),b.magnet,id+' magnet');
    assert.equal(win.APEX_ARSENAL_WEAPONS[id].category,'ranged',id+' holder');
  }
});
gate('magnet-projectile-eligibility-all-current-special-kinds', () => {
  for(const [id,b] of Object.entries(baseline)){
    for(const kind of new Set([...b.reflect,...b.magnet,b.kind,'burn','unknown'])){
      const p={aq:true,type:'aq_v43',weapon:id,kind,phase:'flight',life:2};
      assert.equal(M.isEligibleBullet(p),b.magnet.includes(kind),id+'/'+kind);
      assert.equal(M.isEligibleBullet({...p,life:0}),false,id+' expired');
      assert.equal(M.isEligibleBullet({...p,__hr:{cryHold:true}}),false,id+' held');
    }
  }
  for(const phase of ['arming','armed','spent'])
    assert.equal(M.isEligibleBullet({aq:true,type:'aq_v43',life:2,weapon:'SHRAPNEL_MINE_LAUNCHER',kind:'mine',phase}),false);
  assert.equal(M.isEligibleBullet({aq:true,type:'aq_v43',life:2,weapon:'SHRAPNEL_MINE_LAUNCHER',kind:'fragment',phase:'flight'}),true);
});
gate('ordinary-firearm-and-T6-magnet-exclusions', () => {
  assert.equal(C.isGun('GLOCK_17'),true);
  assert.equal(C.isGun('RPG_7'),false);
  assert.equal(M.isEligibleBullet({aq:true,type:'aq_bullet',weapon:'GLOCK_17',life:2}),true);
  assert.equal(M.isEligibleBullet({aq:true,type:'aq_bullet',weapon:'STORMBREAKER',life:2}),false);
});
gate('owner-world-equipment-roles-shared-but-effects-remain-distinct', () => {
  // OWNER SUPERSESSION 2026-10-13: "Weapon" is ALL offensive spawn roles,
  // not only firearms/ranged. The previously intentional exclusion of V43,
  // Grenade and melee in Magnet/Frost was a semantic defect.
  const roster=C.P0_WEAPON_IDS;
  assert.equal(roster.length,41,'41 canonical equipment identities');
  assert.equal(C.OFFENSIVE_WEAPON_IDS.length,39,'39 Weapon, incl. T6');
  assert.equal(C.SHIELD_IDS.length,2,'two independent Defense items');
  for(const id of roster){
    const t6=C.tierOf(id)==='T6';
    const eligible=C.isOffensive(id)&&!t6;
    const slot={kind:'WEAPON',weaponId:id,phase:'REVEALED',
      tier:C.tierOf(id)};
    assert.equal(C.isHeroManipulableWeapon(id,slot),eligible,id+' role');
    assert.equal(C.isHeroManipulableFloorWeapon(slot),eligible,id+' floor');
    assert.equal(M.isEligibleFloorFirearm(slot),eligible,id+' Magnet floor');
    assert.equal(M.isEligibleFloorWeapon(slot),eligible,id+' Magnet role');
    assert.equal(F.isFreezableFirearm(slot),eligible,id+' Frost existing API');
    assert.equal(F.isFreezableWeapon(slot),eligible,id+' Frost role');
  }
  const slot=(id,extra={})=>({kind:'WEAPON',weaponId:id,phase:'REVEALED',...extra});
  for(const bad of [slot('SWIRL_SHIELD'),slot('TOWER_SHIELD'),
    slot('STORMBREAKER'),slot('PISTOL',{heroInteractionImmune:true}),
    slot('RPG_7',{phase:'HELD'}),slot('PISTOL',{kind:'HEAL'}),
    slot('FUTURE_UNKNOWN')]){
    assert.equal(C.isHeroManipulableFloorWeapon(bad),false);
    assert.equal(M.isEligibleFloorWeapon(bad),false);
  }
  assert.equal(C.isHeroManipulableWeapon('RPG_7'),true);
  assert.equal(C.isHeroManipulableWeapon('STORMBREAKER'),false);
  assert.equal(F.isFreezableWeapon({weaponId:'GRENADE'}),true,
    'A2 steal can recognize held Grenade without pretending it is a firearm');
});
gate('T6-shared-capability-policy-exceptions', () => {
  const cap=A.CapabilityAuthority;
  for(const op of ['graph','gate-x2','gate-div2','singularity','mirror','reflect','capture','dodge']){
    assert.equal(cap.allows(op,{weapon:'STORMBREAKER'}),false,op);
    assert.equal(cap.allows(op,{weapon:'GLOCK_17'}),true,op);
  }
  assert.equal(cap.allows('weak',{weapon:'STORMBREAKER'}),true);
  assert.equal(cap.canManipulate({weapon:'STORMBREAKER'}),false);
});
gate('mirror-F2-type-exclusion-intentionally-preserved', () => {
  const s=fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js','utf8');
  const i=s.indexOf('function mirrorF2Eligible(p)');
  const j=s.indexOf('function mirrorF2CoolingDown(p)',i);
  assert.ok(i>0 && j>i);
  const body=s.slice(i,j);
  assert.ok(body.includes("auth.query?.('mirror-f2-projectile',p,"),
    'Mirror F2 must consume shared AIL admission, not parallel local rules');
  for(const type of ['aq_bullet','aq_grenade','aq_thrown'])
    assert.ok(body.includes("p.type === '"+type+"'"),'historical no-AIL family proof '+type);
  assert.equal(body.includes('aq_v43'),false,'V43 escrow must remain denied');
  const auth=A.CapabilityAuthority;
  const ctx={config:C,matchActive:true};
  for(const type of ['aq_bullet','aq_grenade','aq_thrown']){
    const proj={aq:true,type,weapon:'PISTOL',state:'flight'};
    assert.equal(auth.query('mirror-f2-projectile',proj,ctx).status,'allowed',type);
  }
  for(const bad of [
    {aq:true,type:'aq_v43',weapon:'RPG_7',kind:'rocket'},
    {aq:true,type:'aq_thrown',weapon:'SABRE',state:'pinned'},
    {aq:true,type:'aq_bullet',weapon:'STORMBREAKER'},
  ]) assert.equal(auth.query('mirror-f2-projectile',bad,ctx).status,'denied');
});
gate('one-real-damage-transaction-and-receipt', () => {
  assert.ok(T.start('MAGNET','MAGNET')); T.holdSpawns();
  const [a,b]=H.fighters(); a.baseSpeed=b.baseSpeed=0;
  const hp=b.hp, seq=A.bus.seq;
  const damage=W.aqDamage(b,1,a,'PISTOL',{impact:{x:b.x,y:b.y,vx:1,vy:0}});
  const realized=hp-b.hp;
  assert.ok(Number.isFinite(realized) && realized>0,'real Fighter HP must decrease');
  // Arsenal returns pre-combatant dealt, while Hero Rework may modify the
  // actual victim HP transaction. The receipt MUST equal realized HP.
  assert.equal(damage,7,'Arsenal applied accepted PISTOL x7 scaling');
  const receipt=A.bus.since(seq).filter(e=>e.type==='RealizedDamageEvent');
  assert.equal(receipt.length,1,'exactly one realized damage receipt');
  assert.ok(Math.abs(receipt[0].payload.amount-realized)<1e-8,
    'receipt must equal actual HP delta, not Arsenal nominal damage');
  assert.equal(receipt[0].payload.weaponId,'PISTOL');
  win.exitArsenalBattleMode();
  assert.equal(HR.match,null);
});
console.log('\nCP2 content interaction baseline: '+passed+'/'+(passed+failed)+(failed?' FAIL':' PASS'));
// jsdom/game runtime keeps browser-like handles alive. Like the existing
// Hero-Rework gates, exit explicitly after the last synchronous assertion.
process.exit(failed ? 1 : 0);
