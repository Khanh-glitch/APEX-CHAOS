// Owner 2026-10-13: same A1 break-before-reflect law for Wall/HEXA.
// GENUINE shipped engine harness, not a synthetic classification check.
import assert from 'node:assert/strict';
import {bootHarness} from './lib/crystalaHarness.mjs';

const H=await bootHarness(),{win,T,HR,CRY,W,AIL}=H,DT=1/60;
let pass=0;
const fmt=x=>typeof x==='number'?Number(x.toFixed(4)):x;
function stepUntil(fn,seconds=3){
  let t=0;for(;t<seconds;t+=DT){if(fn())return true;T.step(DT);}
  return !!fn();
}
function fresh(form){
  HR.setSeed(42);HR.setAiEnabled(false);
  const m=T.start('CRYSTAL','ROBOT');assert.ok(m);
  T.holdSpawns();
  const [a,b]=H.fighters();
  a.baseSpeed=0;b.baseSpeed=0;
  a.x=150;a.y=500;b.x=form==='hexa'?700:850;b.y=500;
  a.setDir(1,0);b.setDir(-1,0);
  T.step(.3);
  if(form==='hexa'){
    assert.ok(HR.pressAbility(a,'A2').ok,'K activation failed');
    T.step(.1);
  }
  const cast=HR.pressAbility(a,'A1');
  assert.ok(cast.ok,'A1 cast failed: '+JSON.stringify(cast));
  const ct=m.combatants[0];
  const kind=form==='hexa'?'prison':'wall';
  const get=()=>CRY.inspect(ct).constructs.find(x=>x.kind===kind);
  assert.ok(stepUntil(()=>get()?.lockedAt!=null),'A1 structure did not become solid');
  return {a,b,ct,get,kind};
}
function fire(source,x,y,target,damage){
  const angle=Math.atan2(target.y-y,target.x-x);
  W.fireBullet({owner:source,x,y,angle,speed:1500,damage,
    weapon:'PISTOL',radius:7,life:1.6,critical:false});
  const p=win.projectiles[win.projectiles.length-1];
  assert.ok(p&&p.aq,'real arsenal bullet missing');
  return p;
}
function test(name,fn){
  try{const info=fn();pass++;console.log('PASS '+name+' '+JSON.stringify(info||{}));}
  catch(e){console.error('FAIL '+name+' '+String(e?.stack||e));process.exit(1);}
}
test('Wall: nonbreaking bullet reflects as same original carrier',()=>{
  const w=fresh('wall'),before=w.get().hp;
  const p=fire(w.b,850,500,{x:w.a.x,y:w.a.y},4.5);
  assert.ok(stepUntil(()=>p.__hr?.crystalReflected,1.2),'Wall did not reflect');
  assert.equal(p.owner,w.a); assert.equal(p.__hr.crystalReflected,true);
  assert.ok(w.get().hp<before&&w.get().hp>0);
  return {hp:fmt(w.get().hp),owner:'crystal'};
});
test('HEXA: nonbreaking bullet reflects as same original carrier',()=>{
  const w=fresh('hexa'),P=CRY.rigOf(w.ct).constructs.find(x=>x.kind==='prison').prison;
  const i=2,target={x:(P.edges[i].a.x+P.edges[i].b.x)/2,y:(P.edges[i].a.y+P.edges[i].b.y)/2};
  const p=fire(w.b,P.cx,P.cy,target,4.5);
  assert.ok(stepUntil(()=>p.__hr?.crystalReflected,.6),'HEXA did not reflect');
  assert.equal(p.owner,w.a);assert.equal(w.get().facetsDead[i],false);
  assert.ok(w.get().hp[i]<75&&w.get().hp[i]>0);
  return {facet:i,hp:fmt(w.get().hp[i]),owner:'crystal'};
});
test('Wall: breaking bullet passes through unchanged',()=>{
  const w=fresh('wall');
  const p=fire(w.b,850,500,{x:w.a.x,y:w.a.y},12);
  const original={owner:p.owner,damage:p.damage,critical:p.critical,weapon:p.weapon};
  assert.ok(stepUntil(()=>w.get().state==='ENDED',1.2),'Wall not destroyed');
  assert.equal(w.get().reason,'destroyed');
  assert.notEqual(p.__hr?.crystalReflected,true,'Breaking hit reflected');
  assert.equal(p.owner,original.owner);assert.equal(p.damage,original.damage);
  assert.equal(p.critical,original.critical);assert.equal(p.weapon,original.weapon);
  assert.ok(p.__hr?.cryPassed,'Breaking projectile lacks pass-through contact witness');
  return {state:w.get().state,damage:fmt(p.damage),passed:true};
});
test('HEXA: breaking bullet passes through unchanged, only contacted facet breaks',()=>{
  const w=fresh('hexa'),P=CRY.rigOf(w.ct).constructs.find(x=>x.kind==='prison').prison;
  const i=2,target={x:(P.edges[i].a.x+P.edges[i].b.x)/2,y:(P.edges[i].a.y+P.edges[i].b.y)/2};
  const p=fire(w.b,P.cx,P.cy,target,12);
  const original={owner:p.owner,damage:p.damage,critical:p.critical,weapon:p.weapon};
  assert.ok(stepUntil(()=>w.get().facetsDead[i],.6),'Facet did not break');
  assert.notEqual(p.__hr?.crystalReflected,true,'Breaking HEXA hit wrongly reflected');
  assert.equal(p.owner,original.owner);
  assert.equal(p.damage,original.damage);
  assert.equal(p.critical,original.critical);assert.equal(p.weapon,original.weapon);
  assert.ok(p.__hr?.cryPassed,'Missing HEXA pass-through witness');
  assert.equal(w.get().facetsDead.filter(Boolean).length,1,'Uncontacted facets unexpectedly died');
  return {facet:i,dead:w.get().facetsDead[i],damage:fmt(p.damage),passed:true};
});
console.log(`OWNER CRYSTALA A1 ACTUAL ARSENAL: ${pass}/${pass} PASS`);
process.exit(0);
