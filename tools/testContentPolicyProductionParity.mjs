#!/usr/bin/env node
/**
 * CP5.1 — production AIL policy and the live Magnet consumer must agree
 * with the PRE-CUTOVER eligibility formula, including physical V4.3 phases.
 *
 * Unlike the CP3 shadow test this NEVER installs or replaces the production
 * AIL query. It checks the real loaded scripts as-is.
 */
import assert from 'node:assert/strict';
import { bootHarness } from './lib/crystalaHarness.mjs';
import { BASE_WEAPON_IDS } from './lib/contentBaseline.mjs';

const H=await bootHarness();
const {win}=H, CFG=win.APEX_ARSENAL_CONFIG;
const AIL=win.APEX_HERO_REWORK_AIL;
const MAG=win.APEX_MAGNET;
assert.equal(typeof AIL?.CapabilityAuthority?.query,'function','deployed AIL query missing');
assert.equal(typeof MAG?.isEligibleBullet,'function','real Magnet consumer missing');
assert.ok(BASE_WEAPON_IDS.every(id=>CFG.P0_WEAPON_IDS.includes(id)));
const baselineEligible=(p)=>{
  const id=p?.weapon;
  const gun=id!=='STORMBREAKER'&&id!=='T6'&&!!id&&CFG.isGun(id);
  const normal=p?.type==='aq_bullet'&&gun;
  const spec=CFG.V43_WEAPONS?.[id];
  const physical=p?.type==='aq_v43'&&!!spec&&spec.tier!=='T6'
    &&Array.isArray(spec.magnetizableKinds)
    &&spec.magnetizableKinds.includes(p.kind)
    &&(p.kind!=='mine'||p.phase==='flight');
  return !!p&&p.aq===true&&p.life>0&&id!=='STORMBREAKER'&&id!=='T6'
    &&(normal||physical)&&!(p.__hr&&p.__hr.cryHold);
};
let checked=0, failures=0;
function compare(p,label){
  const decision=AIL.CapabilityAuthority.query('magnet-projectile',p,{config:CFG});
  const actual=MAG.isEligibleBullet(p);
  const prior=baselineEligible(p);
  checked++;
  if(actual!==prior||actual!==(decision.status==='allowed')){
    failures++;
    if(failures<=15)console.error('DRIFT '+label+' '+JSON.stringify({actual,prior,decision}));
  }
  assert.equal(Object.isFrozen(decision),true,'query result must be immutable');
}
for(const id of CFG.P0_WEAPON_IDS){
  for(const type of ['aq_bullet','aq_grenade','aq_thrown','aq_v43']){
    for(const life of [-1,0,1,3])
      for(const aq of [false,true]){
        compare({type,aq,life,weapon:id,kind:'unknown',phase:'flight'},
          id+'/'+type+'/'+life+'/'+aq);
      }
  }
}
for(const [id,s] of Object.entries(CFG.V43_WEAPONS)){
  const kinds=new Set([...s.reflectableKinds,...s.magnetizableKinds,s.kind,'burn','unknown']);
  for(const kind of kinds)
    for(const phase of ['flight','armed','spent',undefined])
      for(const life of [0,2])
        for(const held of [false,true]){
          compare({aq:true,type:'aq_v43',weapon:id,kind,phase,life,
            __hr:held?{cryHold:true}:undefined},
            id+'/'+kind+'/'+String(phase)+'/'+life+'/'+held);
        }
}
const unknown={aq:true,type:'aq_v43',weapon:'UNREGISTERED_NEW_SPECIAL',
  kind:'bolt',phase:'flight',life:2};
compare(unknown,'unknown-weapon-fails-closed');
assert.equal(AIL.CapabilityAuthority.query('magnet-projectile',unknown,{config:CFG}).status,
  'unresolved','unknown content cannot silently receive Magnet permission');
assert.equal(MAG.isEligibleBullet(unknown),false,'unknown projectile is never pulled');

// Prove the REAL Magnet consumer delegates to AIL rather than passing by
// coincidence through its independent legacy fallback. This probe is confined
// to the Node harness; restore the original authority in a finally block.
const accepted={aq:true,type:'aq_bullet',weapon:'GLOCK_17',life:2,phase:'flight'};
assert.equal(MAG.isEligibleBullet(accepted),true,'registered canonical bullet admitted before probe');
const realQuery=AIL.CapabilityAuthority.query;
try {
  const calls=[];
  AIL.CapabilityAuthority.query=function(action,projectile,context){
    calls.push({action,projectile,context});
    return Object.freeze({status:'denied',reason:'cp5-probe'});
  };
  assert.equal(MAG.isEligibleBullet(accepted),false,
    'Magnet must honor explicit canonical AIL denial');
  assert.equal(calls.length,1,'exactly one AIL query per Magnet classification');
  assert.equal(calls[0].action,'magnet-projectile');
  assert.equal(calls[0].projectile,accepted,'preserve original projectile identity');
  assert.equal(calls[0].context.config,CFG,'pass real canonical Arsenal config');

  AIL.CapabilityAuthority.query=()=>Object.freeze({
    status:'unresolved',reason:'cp5-unknown-content-probe',
  });
  assert.equal(MAG.isEligibleBullet(accepted),false,
    'unknown capability must fail closed, never fall back into legacy allowance');
} finally {
  AIL.CapabilityAuthority.query=realQuery;
}
assert.equal(MAG.isEligibleBullet(accepted),true,'AIL authority restored after probe');
// CP5.2/CP5.3 production consumer proof: floor A1 and A2 are intentionally
// DIFFERENT, and Frost uses the same canonical Weapon role without changing
// Frozen Bullet projectile semantics. All three must honor an explicit AIL
// denial; it is not enough to return the same boolean by coincidence.
const FROST=win.APEX_FROST;
const floor={kind:'WEAPON',phase:'REVEALED',weaponId:'SABRE'};
const responsive={kind:'WEAPON',phase:'REVEALED',weaponId:'PISTOL'};
const inert={...responsive,magneticResponse:'inert'};
const c=AIL.CapabilityAuthority;
assert.equal(c.query('magnet-revealed-slot',floor,{config:CFG}).status,'allowed');
assert.equal(c.query('magnet-repel-slot',responsive,{config:CFG}).status,'allowed');
assert.equal(c.query('magnet-repel-slot',inert,{config:CFG}).status,'denied');
assert.equal(c.query('frost-freezable-equipment',floor,{config:CFG}).status,'allowed');
assert.equal(MAG.isEligibleFloorWeapon(inert),true,'A1 ignores physical response');
assert.equal(MAG.isEligibleA2FloorWeapon(inert),false,'A2 respects physical response');
assert.equal(FROST.isFreezableWeapon(inert),true,'Frost freezes a nonmagnetic Weapon');
for(const action of ['magnet-revealed-slot','magnet-repel-slot','frost-freezable-equipment']){
  assert.equal(c.query(action,{weaponId:'FUTURE_UNKNOWN',kind:'WEAPON',phase:'REVEALED'},
    {config:CFG}).status,'unresolved','unknown equipment must fail closed '+action);
}
const restoreQuery=c.query;
try {
  const seen=[];
  c.query=(action,target,context)=>{
    seen.push({action,target,context});
    return Object.freeze({status:'denied',reason:'cp5-consumer-denial'});
  };
  assert.equal(MAG.isEligibleFloorWeapon(floor),false,'A1 must follow AIL denial');
  assert.equal(MAG.isEligibleA2FloorWeapon(responsive),false,'A2 must follow AIL denial');
  assert.equal(FROST.isFreezableWeapon(floor),false,'Frost must follow AIL denial');
  assert.deepEqual(seen.map(x=>x.action),[
    'magnet-revealed-slot','magnet-repel-slot','frost-freezable-equipment'
  ],'every consumer must query exactly its own semantic action');
  for(const call of seen){
    assert.equal(call.context.config,CFG,'effective Arsenal config must be reused');
  }
  c.query=()=>Object.freeze({status:'unresolved',reason:'cp5-unknown'});
  assert.equal(MAG.isEligibleFloorWeapon(floor),false,'A1 unresolved is denied');
  assert.equal(MAG.isEligibleA2FloorWeapon(responsive),false,'A2 unresolved is denied');
  assert.equal(FROST.isFreezableWeapon(floor),false,'Frost unresolved is denied');
} finally { c.query=restoreQuery; }
assert.equal(MAG.isEligibleFloorWeapon(floor),true,'restored A1 query');
assert.equal(MAG.isEligibleA2FloorWeapon(responsive),true,'restored A2 query');
assert.equal(FROST.isFreezableWeapon(floor),true,'restored Frost query');
// Mirror F2 remains intentionally NOT cut over: V43 escrow/geometry is
// a separate owner decision, not a side-effect of the current CP5 actions.
assert.equal(c.query('mirror-f2-projectile',{aq:true,type:'aq_v43',weapon:'RPG_7',
  kind:'rocket',life:2},{config:CFG}).status,'unresolved',
  'Mirror V43 must not be implicitly enabled by the Magnet/Frost cutover');

// CP5.5: reflection TAG is not a physical reflection transaction.
// Preserve every pre-cutover kind decision while Crystal/Swirl retain the
// independent mine-flight, ownership, geometry, TOI and one-reflection rules.
let reflectCases=0;
for(const [id,spec] of Object.entries(CFG.V43_WEAPONS)){
  const kinds=new Set([...spec.reflectableKinds,...(spec.magnetizableKinds||[]),
    spec.kind,'burn','mine','unregistered-tag'].filter(Boolean));
  for(const kind of kinds){
    const p={aq:true,type:'aq_v43',weapon:id,kind,life:3,phase:'flight'};
    const d=c.query('v43-reflection-tag',p,{config:CFG});
    assert.equal(Object.isFrozen(d),true,id+' immutable reflection decision');
    assert.equal(d.status==='allowed',spec.reflectableKinds.includes(kind),
      id+'/'+kind+' canonical reflected-kind parity');
    // The tag is phase-agnostic. An armed mine is excluded by the executor,
    // not by prematurely rewriting the semantic tag.
    if(kind==='mine') assert.equal(c.query('v43-reflection-tag',
      {...p,phase:'armed'},{config:CFG}).status,d.status,
      'kind policy must not decide mine collision phase');
    reflectCases++;
  }
}
const rP={aq:true,type:'aq_v43',weapon:'RPG_7',kind:'rocket',phase:'flight',life:2};
assert.equal(c.query('v43-reflection-tag',rP,{config:CFG}).status,'allowed');
assert.equal(c.query('v43-reflection-tag',{...rP,weapon:'FUTURE_UNKNOWN'},
  {config:CFG}).status,'unresolved','future unknown V43 cannot inherit reflection');
assert.equal(c.query('v43-reflection-tag',rP,{}).status,'unresolved',
  'missing authority fails closed');
assert.equal(c.query('v43-reflection-tag',{...rP,weapon:'STORMBREAKER'},
  {config:CFG}).status,'denied','T6 never reflectable');
const cryptoPolicy=await import('node:fs');
const crystalSource=cryptoPolicy.readFileSync('public/game/hero-rework/crystalGameplayRuntime.js','utf8');
const arsenalSource=cryptoPolicy.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
assert.ok(crystalSource.includes("authority.query?.('v43-reflection-tag',p,{config:CFG()})"),
  'Crystala must delegate V43 eligibility to AIL');
assert.ok(arsenalSource.includes("const crystalEligible=v43ReflectableTag(p)"),
  'V43 native stream router must delegate canonical reflection kind');
assert.ok(arsenalSource.includes("&&v43ReflectableTag(p)"),
  'Swirl Shield must delegate canonical reflection kind');
assert.ok(arsenalSource.includes("p.kind!=='mine'||p.phase==='flight'"),
  'mine flight/arming restrictions must remain in the executor');
console.log('CP5 V43 REFLECTION KIND PARITY PASS '+reflectCases+' canonical cases');

console.log('CP5 LIVE MAGNET POLICY '+(checked-failures)+'/'+checked+(failures?' DRIFT':' PASS'));
process.exit(failures?1:0);
