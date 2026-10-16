// REFERENCE-ONLY owner-law tests: independent geometry/HP decisions, no live damage.
import assert from 'node:assert/strict';
import {
  previewCrystalaStreamRedirect as preview,
  adjudicateA1ConstructImpact as decide,
  approveStreamReflectionPreview as approve
} from './world-ontology/crystalaStreamContract.reference.mjs';

const cases=[];
const check=(name,fn)=>cases.push([name,fn]);
const sample={carrierForm:'stream',attackId:'flame-123',sliceId:'slice-2',
  originSource:'FLAMETHROWER',controller:'ENEMY',tick:2,direction:{x:1,y:0}};
const wall={id:'contact-1',kind:'construct',constructForm:'wall',constructId:'wall-1',
  solid:true,hostile:true,t:.35,normal:{x:-1,y:0},point:{x:130,y:100}};
const ctx={crystalController:'CRYSTALA'};
const q=(s=sample,c=[wall],x=ctx)=>preview(s,c,x);
const hp=(form,h,damage,carrierForm='stream')=>decide({id:form==='wall'?'wall-1':'hexa-facet-2',form,hp:h},
  {carrierForm,structuralDamage:damage});
const witness=(hpBefore,structuralDamage,outcome)=>({constructId:'wall-1',
  hpBefore,structuralDamage,...(outcome?{outcome}:{})});

check('Wall reflects native Stream',()=>assert.equal(q().status,'allowed'));
check('HEXA reflects native Stream',()=>assert.equal(q(sample,[{...wall,constructForm:'hexa',facetId:2}]).status,'allowed'));
check('source Stream persists (not fake bullet)',()=>assert.equal(q().plan.carrierForm,'stream'));
check('Wall/HEXA have identical A1 authority',()=>{
  assert.equal(q().plan.ownerAbility,
    q(sample,[{...wall,constructForm:'hexa',facetId:0}]).plan.ownerAbility);
});
check('original weapon identity remains',()=>assert.equal(q().plan.originSource,'FLAMETHROWER'));
check('damage controller transfers on actual reflected slice',()=>assert.equal(q().plan.toController,'CRYSTALA'));
check('old controller remains in provenance',()=>assert.equal(q().plan.fromController,'ENEMY'));
check('real surface normal used',()=>assert.deepEqual(q().plan.reflectedDirection,{x:-1,y:0}));
check('T6 protected',()=>assert.equal(q({...sample,tier:'T6'}).status,'denied'));
check('own-team stream not reflected',()=>assert.equal(q(sample,[{...wall,hostile:false}]).status,'denied'));
check('no invisible pre-solid collision',()=>assert.equal(q(sample,[{...wall,solid:false}]).status,'denied'));
check('no actual contact -> no reflection',()=>assert.equal(q(sample,[]).status,'denied'));
check('nearer body precedes Wall',()=>assert.equal(q(sample,[wall,{id:'body',kind:'body',t:.1,point:{x:10,y:100}}]).status,'denied'));
check('Wall before later body',()=>assert.equal(q(sample,[wall,{id:'body',kind:'body',t:.8,point:{x:200,y:100}}]).status,'allowed'));
check('missing real collision witness unresolved',()=>assert.equal(q(sample,null).status,'unresolved'));
check('backside normal is not a valid incoming collision',()=>assert.equal(q(sample,[{...wall,normal:{x:1,y:0}}]).status,'unresolved'));
check('unknown attack identity unresolved',()=>assert.equal(q({...sample,originSource:null}).status,'unresolved'));
check('reference preview never edits HP/damage',()=>assert.equal(q().plan.damageOutcome,'NO_DAMAGE_APPLIED_IN_REFERENCE'));
check('no structural contact HP unresolved',()=>assert.equal(approve(q(),null,new Set()).status,'unresolved'));

check('Wall nonbreaking hit reflects',()=>assert.equal(hp('wall',80,18).effect,'reflect'));
check('HEXA nonbreaking hit reflects',()=>assert.equal(hp('hexa',75,18).effect,'reflect'));
check('Wall same hit breaks through at exact HP',()=>assert.equal(hp('wall',18,18).effect,'break-through'));
check('HEXA same hit breaks through at exact HP',()=>assert.equal(hp('hexa',18,18).effect,'break-through'));
check('Wall above remaining HP is still one full passthrough hit',()=>{
  const r=hp('wall',8,18);
  assert.equal(r.effect,'break-through');assert.equal(r.hpAfter,0);
  assert.equal(r.originalAttackContinues,true);assert.equal(r.damageApplied,18);
});
check('HEXA above remaining HP is still one full passthrough hit',()=>{
  const r=hp('hexa',3,18);
  assert.equal(r.effect,'break-through');assert.equal(r.hpAfter,0);
  assert.equal(r.originalAttackContinues,true);assert.equal(r.damageApplied,18);
});
check('Wall and HEXA return same rule independent of geometry',()=>{
  for(const amount of [1,7,18,50,75,80,100])for(const current of [1,3,8,75,80,150]){
    const a=hp('wall',current,amount),b=hp('hexa',current,amount);
    assert.equal(a.effect,b.effect,`damage=${amount} hp=${current}`);
    assert.equal(a.hpAfter,b.hpAfter);
  }
});
check('projectile and stream use same structural adjudication',()=>{
  for(const form of ['wall','hexa'])for(const damage of [1,18,80]){
    assert.equal(hp(form,75,damage,'projectile').effect,hp(form,75,damage,'stream').effect);
  }
});
check('five 18-damage ticks: Wall 80 => four reflect then one pass',()=>{
  let curr=80,events=[];
  for(let n=0;n<5;n++){
    let r=hp('wall',curr,18);events.push(r.effect);curr=r.hpAfter;
  }
  assert.deepEqual(events,['reflect','reflect','reflect','reflect','break-through']);
  assert.equal(curr,0);
});
check('five 18-damage ticks: HEXA facet 75 => four reflect then one pass',()=>{
  let curr=75,events=[];
  for(let n=0;n<5;n++){
    let r=hp('hexa',curr,18);events.push(r.effect);curr=r.hpAfter;
  }
  assert.deepEqual(events,['reflect','reflect','reflect','reflect','break-through']);
  assert.equal(curr,0);
});
check('later Hexa facet independently retains its own HP',()=>{
  const damaged=hp('hexa',3,18),other=hp('hexa',75,18);
  assert.equal(damaged.effect,'break-through');
  assert.equal(other.effect,'reflect');
});
check('zero damage cannot claim structural reflection transaction',()=>assert.equal(hp('wall',80,0).status,'unresolved'));
check('negative damage cannot cause structure healing',()=>assert.equal(hp('hexa',75,-1).status,'unresolved'));
check('expired surface cannot reflect',()=>assert.equal(hp('wall',0,18).status,'unresolved'));
check('unknown carrier cannot mutate structure',()=>assert.equal(hp('wall',80,18,'vfx-particle').status,'unresolved'));
check('missing structure witness must not auto-pass',()=>assert.equal(approve(q(),witness(undefined,18),new Set()).status,'unresolved'));

check('stream nonbreaking receipt approves reflection',()=>{
  let r=approve(q(),witness(80,18,'reflect'),new Set());
  assert.equal(r.status,'allowed');assert.equal(r.effect,'reflect');
  assert.equal(r.redirect.carrierForm,'stream');assert.equal(r.hpAfter,62);
  assert.equal(r.originalAttackContinues,false);
});
check('stream breaking receipt approves same-original attack passthrough',()=>{
  let r=approve(q(),witness(8,18,'break-through'),new Set());
  assert.equal(r.status,'allowed');assert.equal(r.effect,'break-through');
  assert.equal(r.redirect,null);assert.equal(r.hpAfter,0);
  assert.equal(r.originalAttackContinues,true);
});
check('HEXA breaking receipt does NOT reflect the breaking hit',()=>{
  const hexa={...wall,constructForm:'hexa',constructId:'hex-1',facetId:2};
  const r=approve(q(sample,[hexa]),{constructId:'hex-1',hpBefore:3,structuralDamage:18},new Set());
  assert.equal(r.effect,'break-through');assert.equal(r.redirect,null);
});
check('legacy HEXA reflect-first outcome is explicitly rejected',()=>{
  const hexa={...wall,constructForm:'hexa',constructId:'hex-1',facetId:2};
  const r=approve(q(sample,[hexa]),{constructId:'hex-1',hpBefore:3,structuralDamage:18,outcome:'reflect'},new Set());
  assert.equal(r.status,'unresolved');
  assert.equal(r.reason,'structural-outcome-conflicts-with-unified-A1-law');
});
check('Wall false forced break-through rejected when not lethal',()=>{
  const r=approve(q(),witness(80,18,'break-through'),new Set());
  assert.equal(r.status,'unresolved');
});
check('deduplicate reflection before any second structural transaction',()=>{
  const seen=new Set(),p=q(),s=witness(80,18);
  assert.equal(approve(p,s,seen).status,'allowed');
  assert.equal(approve(p,s,seen).reason,'stream-tick-already-adjudicated');
});
check('deduplicate breaking hit before any second structural transaction',()=>{
  const seen=new Set(),p=q(),s=witness(8,18);
  assert.equal(approve(p,s,seen).effect,'break-through');
  assert.equal(approve(p,s,seen).reason,'stream-tick-already-adjudicated');
});
check('mismatched construct witness blocked',()=>assert.equal(approve(q(),{...witness(80,18),constructId:'other'},new Set()).status,'unresolved'));
check('new tick is a distinct collision receipt',()=>{
  assert.notEqual(q({...sample,tick:1}).receiptKey,q({...sample,tick:2}).receiptKey);
});
check('HEXA facet ID preserved',()=>{
  assert.equal(q(sample,[{...wall,constructForm:'hexa',facetId:4}]).plan.facetId,4);
});
check('Mirror does not mistake continuous stream for flying projectile',()=>assert.equal(sample.carrierForm==='projectile',false));

for(const [name,fn] of cases){try{fn();}catch(e){console.error('FAIL:',name);throw e;}}
console.log(`Crystala unified Wall/HEXA D0-D4 REFERENCE: ${cases.length}/${cases.length} PASS; no live HP/TOI execution`);
