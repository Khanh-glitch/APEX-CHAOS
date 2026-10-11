#!/usr/bin/env node
/**
 * CP3 shadow-comparison proof against CURRENT actual runtime predicates.
 * The candidate does NOT replace any gameplay branch, collision, TOI or damage.
 * A mismatching current law is a failing gate, not a reason to patch gameplay.
 */
import assert from 'node:assert/strict';
import { bootHarness } from './lib/crystalaHarness.mjs';
import { installShadowQuery } from './lib/interactionPolicyCandidate.mjs';

const H=await bootHarness(), {win}=H;
const cfg=win.APEX_ARSENAL_CONFIG;
const defs=win.APEX_ARSENAL_WEAPONS;
const cap=win.APEX_HERO_REWORK_AIL.CapabilityAuthority;
installShadowQuery(cap); // only in test VM
const mag=win.APEX_MAGNET, frost=win.APEX_FROST;
let cases=0, fails=0;
function equal(name,actual,expected){
  cases++;
  if(actual!==expected){
    fails++;
    if(fails<=20)console.error('DRIFT '+name+' candidate='+actual+' current='+expected);
  }
}
function compare(action,obj,context,expected,tag){
  const r=cap.query(action,obj,context);
  equal(tag,r.status==='allowed',expected);
  if(r.status==='unresolved')throw Error('Registered legacy case unexpectedly unresolved: '+tag+' '+r.reason);
  assert.equal(Object.isFrozen(r),true,'queries must be immutable');
}
assert.equal(typeof cap.query,'function');
const ctx={config:cfg,weapons:defs,matchActive:true};
const ids=Array.from(cfg.P0_WEAPON_IDS);
assert.equal(ids.length,41,'live equipment roster must remain pinned to CP2');
for(const id of ids){
  for(const phase of ['REVEALED','TELEGRAPH','HELD']){
    for(const kind of ['WEAPON','HEAL']){
      const slot={weaponId:id,phase,kind,tier:cfg.tierOf(id)};
      compare('magnet-revealed-slot',slot,ctx,mag.isEligibleFloorFirearm(slot),
        'floor-magnet/'+id+'/'+phase+'/'+kind);
    }
  }
  for(const kind of ['WEAPON','HEAL']){
    for(const tier of [cfg.tierOf(id),'T6']){
      const slot={weaponId:id,kind,tier};
      compare('frost-freezable-equipment',slot,ctx,frost.isFreezableFirearm(slot),
        'frost/'+id+'/'+kind+'/'+tier);
    }
  }
  for(const type of ['aq_bullet','aq_grenade','aq_thrown','aq_v43']){
    const p={aq:true,type,weapon:id,life:3,state:'flight'};
    compare('magnet-projectile',p,ctx,mag.isEligibleBullet(p),'ordinary/'+id+'/'+type);
  }
}
for(const [id,special] of Object.entries(cfg.V43_WEAPONS)){
  const kinds=new Set([...special.reflectableKinds,...special.magnetizableKinds,special.kind,'burn','unknown']);
  for(const kind of kinds){
    for(const phase of ['flight','armed','spent',undefined]){
      for(const life of [2,0]){
        for(const held of [true,false]){
          const p={aq:true,type:'aq_v43',weapon:id,kind,phase,life,
            __hr:held?{cryHold:true}:undefined};
          compare('magnet-projectile',p,ctx,mag.isEligibleBullet(p),
            'v43-magnet/'+id+'/'+kind+'/'+phase+'/'+life+'/'+held);
        }
      }
    }
    const v43={aq:true,type:'aq_v43',weapon:id,kind,life:1,phase:'flight'};
    compare('v43-reflection-tag',v43,ctx,special.reflectableKinds.includes(kind),
      'v43-reflect-tag/'+id+'/'+kind);
  }
}
for(const id of ['GLOCK_17','STORMBREAKER']){
  for(const type of ['aq_bullet','aq_grenade','aq_thrown','aq_v43']){
    for(const state of ['flight','pinned','tumble']){
      const p={aq:true,type,weapon:id,state,life:3};
      const old=!(['T6','STORMBREAKER'].includes(id)) &&
        (type==='aq_bullet'||type==='aq_grenade'||(type==='aq_thrown'&&state==='flight'));
      compare('mirror-f2-projectile',p,ctx,old,
        'mirror-f2/'+id+'/'+type+'/'+state);
    }
  }
}
for(const id of ['GLOCK_17','STORMBREAKER']){
  for(const action of ['graph','gate-x2','gate-div2','singularity','mirror','reflect','capture','dodge','weak']){
    const p={weapon:id};
    compare('hero-object:'+action,p,ctx,cap.allows(action,p),'AIL/'+id+'/'+action);
  }
}
// Future or unknown content must NEVER silently inherit a capability.
for(const [action,obj,context] of [
  ['magnet-projectile',{aq:true,type:'aq_v43',weapon:'NEW_SPECIAL',kind:'bolt',life:1},ctx],
  ['magnet-revealed-slot',{weaponId:'NEW_SPECIAL',phase:'REVEALED',kind:'WEAPON'},ctx],
  ['frost-freezable-equipment',{weaponId:'NEW_SPECIAL',kind:'WEAPON'},ctx],
  ['mirror-f2-projectile',{aq:true,type:'aq_bullet',weapon:'NEW_SPECIAL'},ctx],
  ['v43-reflection-tag',{aq:true,type:'aq_v43',weapon:'NEW_SPECIAL',kind:'bolt'},ctx],
  ['unknown-action',{weapon:'GLOCK_17'},ctx],
  ['magnet-projectile',{aq:true,type:'aq_bullet',weapon:'GLOCK_17',life:1},{}],
]){
  const r=cap.query(action,obj,context);
  assert.equal(r.status,'unresolved',action+' needs explicit policy');
  cases++;
}
const corruptSpec={tier:'T2',kind:'brand-new'};
const cfgMissing={...cfg,WEAPONS:{...cfg.WEAPONS,NEW_SPECIAL:{family:'SPECIAL'}},
  V43_WEAPONS:{...cfg.V43_WEAPONS,NEW_SPECIAL:corruptSpec}};
assert.equal(cap.query('magnet-projectile',
  {aq:true,type:'aq_v43',weapon:'NEW_SPECIAL',kind:'brand-new',life:2},
  {config:cfgMissing}).status,'unresolved','missing capability declaration is not false');
cases++;
console.log('\nCP3 AIL SHADOW POLICY '+(cases-fails)+'/'+cases+(fails?' DRIFT':' PASS'));
process.exit(fails?1:0);
