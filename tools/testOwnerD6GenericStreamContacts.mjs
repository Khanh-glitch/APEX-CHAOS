import assert from 'node:assert/strict';
import {sampleAttackCarrierSurfaces as probe} from './world-ontology/attackCarrierContact.reference.mjs';
let count=0;
function check(name,test){try{test();count++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const wall=(id,a,b,facet=-1,kind='wall')=>({
  cons:{id,kind,state:'LIVE'},idx:facet,ax:100,ay:a,bx:100,by:b,r:1
});
const em={carrierKind:'stream',id:'future:flame-1',tick:2,
  origin:{x:200,y:0},direction:{x:-1,y:0},range:180,halfAngle:.25,sampleCount:65};
const collision=(ox,oy,tx,ty,ax,ay,bx,by,r)=>{
  // Simple deterministic fixture; REAL harness separately uses HR.geom.capsuleToi.
  const frac=(ax-ox)/(tx-ox);
  if(!Number.isFinite(frac)||frac<0||frac>1)return null;
  const atY=oy+(ty-oy)*frac;
  if(atY<Math.min(ay,by)-r||atY>Math.max(ay,by)+r)return null;
  return {t:frac,nx:1,ny:0};
};
const ask=(e=em,c=[wall('one',-100,100)],fn=collision)=>probe(e,c,fn);
check('generic Stream contacts Wall without weapon or hero name',()=>{
  const r=ask();assert.equal(r.status,'allowed');
  assert.equal(r.materialContacts.length,1);
  assert.equal(r.materialContacts[0].surfaceKey,'one:-1');
});
check('a wide Stream tick charges one impact no matter sample count',()=>{
  const r=ask();
  assert.ok(r.materialContacts[0].sampleCount>1);
  assert.equal(r.materialContacts[0].receiptKey,'future:flame-1:2:one:-1');
});
check('multiple Gold runs of same Wall count as one surface',()=>{
 const r=ask(em,[wall('one',-100,0),wall('one',0,100)]);
 assert.equal(r.materialContacts.length,1);
});
check('two independent HEXA facets retain independent impact rights',()=>{
 const r=ask(em,[wall('hex',-100,0,3,'prison'),wall('hex',0,100,4,'prison')]);
 assert.equal(r.materialContacts.length,2);
 assert.deepEqual(r.materialContacts.map(x=>x.facetId).sort(),[3,4]);
});
check('two different constructs retain two independent identities',()=>{
 const r=ask(em,[wall('a',-100,100),wall('b',-100,100)]);
 assert.equal(r.materialContacts.length,1,'earliest same-depth competing material must not double count the same ray');
});
check('outside cone does not contact material',()=>{
 const r=ask(em,[wall('off',700,900)]);assert.equal(r.materialContacts.length,0);
});
check('expired material is ignored',()=>{
 const c={...wall('expired',-100,100),cons:{id:'expired',kind:'wall',state:'ENDED'}};
 assert.equal(ask(em,[c]).materialContacts.length,0);
});
check('T6 protection precedes geometry',()=>assert.equal(ask({...em,protection:'T6'}).status,'denied'));
check('unknown carrier is unresolved',()=>assert.equal(ask({...em,carrierKind:'area'}).status,'unresolved'));
check('zero direction is unresolved',()=>assert.equal(ask({...em,direction:{x:0,y:0}}).status,'unresolved'));
check('invalid geometry triggers unresolved not false clearance',()=>{
 const r=ask(em,[{...wall('x',-100,100),ax:NaN}]);
 assert.equal(r.status,'unresolved');
});
check('reference never applies HP or damage',()=>{
 const r=ask();assert.equal(r.authoritativeDamageApplied,false);
 assert.equal(r.samplesAreApproximation,true);
});
check('beam carrier with zero halfAngle is supported',()=>{
 const r=ask({...em,carrierKind:'beam',halfAngle:0,sampleCount:1});
 assert.equal(r.materialContacts.length,1);
});
check('ticks receive different receipt identities',()=>{
 const a=ask().materialContacts[0].receiptKey;
 const b=ask({...em,tick:3}).materialContacts[0].receiptKey;
 assert.notEqual(a,b);
});
console.log('D6 GENERIC ATTACK CARRIER CONTACT REFERENCE: '+count+'/'+count+' PASS (NOT LIVE GAME)');
