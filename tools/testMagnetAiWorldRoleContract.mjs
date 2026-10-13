// Pure engine contract gate: the actual AIL and actual hero mechanic policy,
// with deliberately FUTURE (non-firearm) World Weapon role data.
// Fail closed for unregistered, T6, HEAL and physically inert A2 cases.
// It is intentionally independent of all numbered weapon catalogues.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const w={};
const sandbox=vm.createContext({window:w,console,Math,Set,Map,WeakMap,Date,Number,Object,Array,String,Promise});
for(const file of ['public/game/hero-rework/ailRuntime.js',
                   'public/game/hero-rework/heroMechanicsRuntime.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file,timeout:10000});
}
const CAP=w.APEX_HERO_REWORK_AIL.CapabilityAuthority;
const mechanic=w.APEX_HERO_REWORK_MECHANICS.EXECUTORS;
const future='FUTURE_WORLD_WEAPON_CANARY';
const inert='FUTURE_INERT_WEAPON_CANARY';
const t6='FUTURE_T6_WEAPON_CANARY';
const config={
  WEAPONS:{
    [future]:{tier:'T3',family:'future-special',magneticResponse:'responsive'},
    [inert]:{tier:'T3',family:'future-special',magneticResponse:'inert'},
    [t6]:{tier:'T6',family:'future-special',magneticResponse:'responsive'},
  },
  V43_WEAPONS:{SAMPLE_KINETIC:{tier:'T3',magnetizableKinds:['bolt']}},
  isGun:()=>false, // critical: NONE of the future equipment is a firearm
  isHeroManipulableFloorWeapon(slot){
    const data=this.WEAPONS[slot?.weaponId];
    return !!(slot?.kind==='WEAPON'&&data&&data.tier!=='T6'&&slot.heroInteractionImmune!==true);
  },
  isHeroMagneticallyResponsiveFloorWeapon(slot){
    return this.isHeroManipulableFloorWeapon(slot)
      && this.WEAPONS[slot.weaponId]?.magneticResponse==='responsive';
  },
};
config.WEAPONS.SAMPLE_KINETIC={tier:'T3'};
w.APEX_ARSENAL_CONFIG=config;
w.APEX_MAGNET={canCast:()=>true};
const self={x:400,y:400,hp:1000,id:'magnet'};
const enemy={x:900,y:900,hp:1000,id:'enemy'};
const ct={anchor:self};
let projs=[];
const ctx={
  combatant:ct,cfg:{bulletRadius:480,radius:225,gameplayDuration:1,duration:1.8},
  api:{
    enemyBodies:()=>[],
    liveProjectiles:()=>projs,
    combatantOfBody:(body)=>body===enemy?{anchor:enemy}:null,
    ownsBody:(_ct,body)=>body===self,
  }
};
let slots=[];
w.APEX_ARSENAL={state:{slots}};
const floor=(id,extra={})=>({id:'pickup-'+id,phase:'REVEALED',kind:'WEAPON',
  weaponId:id,x:480,y:400,...extra});
const decide=(kind)=>mechanic[kind==='a1'?'magnet.acquisition':'magnet.repulsion_field'].aiEvaluate(ctx);
function check(action,target,allowed){
  const verdict=CAP.query(action,target,{config});
  assert.equal(verdict.status,allowed?'allowed':'denied',
    action+' '+JSON.stringify(target)+' '+JSON.stringify(verdict));
}
try{
  slots=[floor(future)];w.APEX_ARSENAL.state.slots=slots;
  check('magnet-revealed-slot',slots[0],true);
  assert.equal(decide('a1').shouldCast,true,'future non-gun must provoke A1');
  assert.equal(decide('a1').reason,'eligible-world-weapon');
  assert.equal(decide('a2').shouldCast,true,'physically responsive future weapon must provoke A2 nearby');
  slots=[floor(inert)];w.APEX_ARSENAL.state.slots=slots;
  check('magnet-revealed-slot',slots[0],true);
  check('magnet-repel-slot',slots[0],false);
  assert.equal(decide('a1').shouldCast,true,'inert weapon is still attractable on A1');
  assert.equal(decide('a2').shouldCast,false,'inert weapon must not provoke A2');
  slots=[floor(t6)];w.APEX_ARSENAL.state.slots=slots;
  check('magnet-revealed-slot',slots[0],false);
  assert.equal(decide('a1').shouldCast,false,'T6 weapon must NOT provoke A1');
  slots=[floor('NOT_REGISTERED')];w.APEX_ARSENAL.state.slots=slots;
  assert.equal(CAP.query('magnet-revealed-slot',slots[0],{config}).status,'unresolved');
  assert.equal(decide('a1').shouldCast,false,'unregistered future ID fails closed');
  slots=[{...floor(future),kind:'HEAL'}];w.APEX_ARSENAL.state.slots=slots;
  assert.equal(decide('a1').shouldCast,false,'HEAL must not provoke A1');
  slots=[];w.APEX_ARSENAL.state.slots=slots;
  projs=[{aq:true,type:'aq_v43',weapon:'SAMPLE_KINETIC',kind:'bolt',
    life:1,owner:enemy,x:100,y:400,vx:440,vy:0}];
  check('magnet-projectile',projs[0],true);
  assert.equal(decide('a1').shouldCast,true,'eligible physical special projectile provokes A1');
  projs=[{...projs[0],kind:'plasma'}];
  assert.equal(decide('a1').shouldCast,false,'non-kinetic projectile must not provoke Magnet');
  console.log('PASS MAGNET AI World Weapon contract: future non-gun A1/A2, inert A2, T6, unregistered, heal, kinetic special');
}finally{delete w.APEX_MAGNET;delete w.APEX_ARSENAL;delete w.APEX_ARSENAL_CONFIG;}
