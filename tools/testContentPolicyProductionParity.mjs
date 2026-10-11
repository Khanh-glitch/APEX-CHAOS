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
console.log('CP5 LIVE MAGNET POLICY '+(checked-failures)+'/'+checked+(failures?' DRIFT':' PASS'));
process.exit(failures?1:0);
