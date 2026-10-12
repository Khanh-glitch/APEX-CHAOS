// D6 real engine characterization of current Flamethrower -> A1 Wall/HEXA gap.
// IMPORTANT: --characterize intentionally asserts the historical missing
// stream-contact behavior. This is evidence, NOT successful owner gameplay.
// Without --characterize, desired owner-law behavior is the test oracle.
import assert from 'node:assert/strict';
import {bootHarness} from './lib/crystalaHarness.mjs';
import {sampleAttackCarrierSurfaces} from './world-ontology/attackCarrierContact.reference.mjs';
const {win,T,HR,CRY,CFG}=await bootHarness();
const DT=1/60, characterize=process.argv.includes('--characterize');
let passed=0;
function stepUntil(cond,max=3){
 for(let i=0;i<Math.ceil(max/DT);i++){if(cond())return true;T.step(DT);}
 return !!cond();
}
function scenario(form) {
 HR.setSeed(42); HR.setAiEnabled(false);
 const match=T.start('CRYSTAL','ROBOT');
 assert.ok(match,'real Arsenal match could not start');
 T.holdSpawns();
 const [a,b]=win.fighters;
 a.baseSpeed=b.baseSpeed=0;
 a.x=150;a.y=500; b.x=form==='hexa'?700:850;b.y=500;
 a.setDir(1,0); b.setDir(-1,0);
 T.step(.3);
 if(form==='hexa') {assert.ok(HR.pressAbility(a,'A2').ok);T.step(.1);}
 assert.ok(HR.pressAbility(a,'A1').ok);
 const ct=match.combatants[0],kind=form==='hexa'?'prison':'wall';
 const get=()=>CRY.inspect(ct).constructs.find(c=>c.kind===kind);
 assert.ok(stepUntil(()=>get()?.lockedAt!=null),'construct never became solid');
 const P=form==='hexa'
   ?CRY.rigOf(ct).constructs.find(c=>c.kind==='prison').prison:null;
 let facet=-1;
 if(P){
   const entry=Array.from({length:6},(_,i)=>{
     const edge=P.edges[i];
     return {i,x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2};
   }).sort((x,y)=>x.x-y.x)[0];
   facet=entry.i;
   const vx=entry.x-P.cx,vy=entry.y-P.cy,d=Math.hypot(vx,vy);
   assert.ok(d>0);
   a.x=entry.x+vx/d*145; a.y=entry.y+vy/d*145;
   b.x=P.cx; b.y=P.cy; // Flame emitter inside HEXA; target outside.
 } else {
   a.x=350;a.y=500; b.x=610;b.y=500;
 }
 assert.ok(a.x>75&&a.x<925&&a.y>75&&a.y<925,'bad outside victim placement');
 const initialHp=a.hp,initialStructure=get().hp;
 const angle=Math.atan2(a.y-b.y,a.x-b.x);
 const stream={
   aq:true,type:'aq_v43',kind:'flame',weapon:'FLAMETHROWER',
   owner:b,launchOwner:b,flameTarget:a,
   angle,x:b.x,y:b.y,px:b.x,py:b.y,ox:b.x,oy:b.y,
   vx:0,vy:0,age:0,life:.325,maxLife:.325,
   damage:CFG.V43_WEAPONS.FLAMETHROWER.tickDamage,
   ticks:0,flameOrigins:[],hits:new Set(),phase:'flight'
 };
 win.projectiles.push(stream);
 T.step(.36);
 const ending=get();
 const dmg=initialHp-a.hp;
 // The REAL Gold-aligned muzzle/angle is now on the live Stream carrier.
 // Check whether authoritative Crystala material actually lies between the
 // native emitting position and the damaged fighter's body. Never infer
 // this from decorative flame particles.
 const geom=HR.geom,realMaterials=CRY.capsules()
   .filter(cap=>cap.cons?.id===get().id);
 assert.equal(typeof geom?.capsuleToi,'function','missing shared capsule TOI authority');
 const witness=realMaterials.map(cap=>{
   const hit=geom.capsuleToi(stream.x,stream.y,a.x,a.y,
     cap.ax,cap.ay,cap.bx,cap.by,cap.r);
   return hit?{t:hit.t,facet:cap.idx,nx:hit.nx,ny:hit.ny,
     constructId:cap.cons.id}:null;
 }).filter(Boolean).sort((x,y)=>x.t-y.t)[0]||null;
 assert.ok(witness&&witness.t>0&&witness.t<1,
   'actual damaging muzzle-to-target path does not intersect owner A1 solid geometry');
 if(form==='hexa')assert.equal(witness.facet,facet,
   'native stream witness must impact the actual selected Hexa facet');
 // A future energy / acid Stream uses this SAME material witness contract.
 // The current reference is sampled and does not mutate live gameplay.
 const semantic=sampleAttackCarrierSurfaces({
   carrierKind:'stream',id:'live-flame-'+form,tick:4,
   origin:{x:stream.x,y:stream.y},
   direction:{x:Math.cos(stream.angle),y:Math.sin(stream.angle)},
   range:CFG.V43_WEAPONS.FLAMETHROWER.range,
   halfAngle:CFG.V43_WEAPONS.FLAMETHROWER.cone,sampleCount:65
 },realMaterials,geom.capsuleToi);
 assert.equal(semantic.status,'allowed','shared attack-carrier resolver failed');
 assert.ok(semantic.materialContacts.some(c=>c.facetId===facet),
   'actual hit panel missing from generic Stream/Beam material witness');
 assert.equal(new Set(semantic.materialContacts.map(c=>c.receiptKey)).size,
   semantic.materialContacts.length,'same A1 material charged more than once per tick');
 const initialPanelHp=form==='wall'?initialStructure:initialStructure[facet];
 const remainingPanelHp=form==='wall'?ending.hp:ending.hp[facet];
 const out={
   form,facet,damageToBody:+dmg.toFixed(4),
   structureHpBefore:initialPanelHp,structureHpAfter:remainingPanelHp,
   streamTicks:stream.ticks,
   earliestRealMaterialContact:{t:+witness.t.toFixed(4),facet:witness.facet,
     nx:+witness.nx.toFixed(4),ny:+witness.ny.toFixed(4)},
   genericCarrierSurfaceWitnesses:semantic.materialContacts.length,
   activeMaterial:realMaterials.length
 };
 console.log('D6 NATIVE FLAME CHARACTERIZATION '+JSON.stringify(out));
 assert.equal(stream.ticks,5,'not five native damage ticks');
 if(characterize) {
   assert.ok(dmg>0,'legacy Flame did not reach victim; cannot characterize obstruction');
   assert.equal(remainingPanelHp,initialPanelHp,'legacy structure HP changed; update characterization');
 } else {
   assert.equal(remainingPanelHp,0,'owner A1: five real ticks must destroy contacted Wall/facet');
   // First four ticks reflect. Fifth breaking tick passes through unchanged.
   // Additional redirected Stream hit and burn truth is separately tested.
   assert.ok(dmg>0,'owner A1: breaking tick must be able to reach victim beyond material');
 }
 passed++;
}
scenario('wall');
scenario('hexa');
console.log('D6 FLAME '+(characterize?'CHARACTERIZATION OF KNOWN GAP':'OWNER-LAW EXPECTATION')+
  ': '+passed+'/'+passed+' real Arsenal scenarios; NOT visual/redirect damage certification');
process.exit(0);
