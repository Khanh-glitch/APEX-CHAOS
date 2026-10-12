// PURE reference tests: owner-approved Crystala B; NOT an Arsenal runtime playtest.
import assert from 'node:assert/strict';
import {previewCrystalaStreamRedirect as preview,approveStreamReflectionPreview as approve}
 from './world-ontology/crystalaStreamContract.reference.mjs';
const cases=[];
const check=(name,fn)=>cases.push([name,fn]);
const sample={carrierForm:'stream',attackId:'flame-123',sliceId:'slice-2',
  originSource:'FLAMETHROWER',controller:'ENEMY',tick:2,direction:{x:1,y:0}};
const wall={id:'contact-1',kind:'construct',constructForm:'wall',constructId:'wall-1',
  solid:true,hostile:true,t:0.35,normal:{x:-1,y:0},point:{x:130,y:100}};
const ctx={crystalController:'CRYSTALA'};
const q=(s=sample,c=[wall],x=ctx)=>preview(s,c,x);
check('same A1 Wall reflects Stream',()=>assert.equal(q().status,'allowed'));
check('same A1 HEXA reflects Stream',()=>assert.equal(q(sample,[{...wall,constructForm:'hexa',facetId:2}]).status,'allowed'));
check('keeps native Stream carrier, not fake projectile',()=>assert.equal(q().plan.carrierForm,'stream'));
check('A1 authority, not K/A2',()=>assert.equal(q().plan.ownerAbility,'crystal.context_construct'));
check('retains originating weapon source',()=>assert.equal(q().plan.originSource,'FLAMETHROWER'));
check('changes current controller after reflection',()=>assert.equal(q().plan.toController,'CRYSTALA'));
check('preserves prior controller information',()=>assert.equal(q().plan.fromController,'ENEMY'));
check('specular direction is geometrically correct',()=>assert.deepEqual(q().plan.reflectedDirection,{x:-1,y:0}));
check('T6 excluded',()=>assert.equal(q({...sample,protection:'T6'}).status,'denied'));
check('same-team Stream not reflected',()=>assert.equal(q(sample,[{...wall,hostile:false}]).status,'denied'));
check('not-solid construct cannot reflect',()=>assert.equal(q(sample,[{...wall,solid:false}]).status,'denied'));
check('no contact cannot reflect',()=>assert.equal(q(sample,[]).status,'denied'));
check('earlier body precedes wall',()=>assert.equal(q(sample,[wall,{id:'b',kind:'body',t:.1,point:{x:80,y:100}}]).status,'denied'));
check('later body does not erase earlier wall',()=>assert.equal(q(sample,[wall,{id:'b',kind:'body',t:.8,point:{x:200,y:100}}]).status,'allowed'));
check('missing geometry witness is unresolved',()=>assert.equal(q(sample,null).status,'unresolved'));
check('backside incidence is unresolved',()=>assert.equal(q(sample,[{...wall,normal:{x:1,y:0}}]).status,'unresolved'));
check('missing source identity is unresolved',()=>assert.equal(q({...sample,originSource:null}).status,'unresolved'));
check('preview NEVER applies damage or wall HP',()=>{const p=q().plan;assert.equal(p.damageOutcome,'NO_DAMAGE_APPLIED_IN_REFERENCE');assert.match(p.structuralOutcome,/REQUIRES_/);});
check('no structural proof means no approval',()=>assert.equal(approve(q(),null,new Set()).status,'unresolved'));
check('wall breaking-through is not a reflected stream',()=>assert.equal(approve(q(),{constructId:'wall-1',outcome:'break-through'},new Set()).status,'denied'));
check('deduplicates attack tick/stream slice/construct receipt',()=>{
  const seen=new Set(),p=q(),s={constructId:'wall-1',outcome:'reflect'};
  assert.equal(approve(p,s,seen).status,'allowed');
  assert.equal(approve(p,s,seen).reason,'stream-tick-already-adjudicated');
});
check('wrong construct transaction cannot approve',()=>assert.equal(approve(q(),{constructId:'wrong',outcome:'reflect'},new Set()).status,'unresolved'));
check('HEXA facet identity is retained',()=>{const p=q(sample,[{...wall,constructForm:'hexa',facetId:3}]).plan;assert.equal(p.facetId,3);assert.equal(p.constructForm,'hexa');});
check('mirror must not treat Stream as flying Projectile',()=>assert.equal(sample.carrierForm==='projectile',false));
for(const [name,run] of cases){try{run();}catch(err){console.error('FAILED:',name);throw err;}}
console.log(`Crystala World Ontology STREAM REFERENCE: ${cases.length}/${cases.length} PASS; NO real collision/HP execution`);
