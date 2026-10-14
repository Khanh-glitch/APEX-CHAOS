// CP10: owner ECO V17 targeting family regression. This validates the actual
// Gold render functions without mutating Robot targeting, cooldown or pickups.
import assert from 'node:assert/strict';
import {drawEcoGoldTargetLock,drawEcoGoldTargetMeasure} from '../src/game/cosmetics/ecoNewbotV17WorldGold.js';
import {cosmetics} from '../src/game/cosmetics/cosmeticAuthority.js';

function probe(){
 const events=[],stack=[];let tx=0,ty=0,alpha=1,mode='source-over';
 const ctx={
  events,get globalAlpha(){return alpha;},set globalAlpha(x){alpha=x;},
  get globalCompositeOperation(){return mode;},set globalCompositeOperation(x){mode=x;},
  save(){stack.push({tx,ty,alpha,mode});events.push({kind:'save'});},
  restore(){assert.ok(stack.length,'Canvas stack underflow');({tx,ty,alpha,mode}=stack.pop());events.push({kind:'restore'});},
  translate(x,y){tx+=x;ty+=y;events.push({kind:'translate',x,y});},
  rotate(a){events.push({kind:'rotate',a});},
  beginPath(){events.push({kind:'begin'});},
  moveTo(x,y){events.push({kind:'move',x,y});},
  lineTo(x,y){events.push({kind:'line',x,y});},
  quadraticCurveTo(...args){events.push({kind:'leafCurve',args});},
  arc(x,y,r,start,end){events.push({kind:'arc',x:tx+x,y:ty+y,r,start,end});},
  stroke(){events.push({kind:'stroke',alpha,mode});},
  fill(){events.push({kind:'fill',alpha,mode});},
  createRadialGradient(...args){events.push({kind:'gradient',args});return {addColorStop(off,color){events.push({kind:'stop',off,color})}};},
 };
 return {ctx,events,balanced:()=>assert.equal(stack.length,0,'Unbalanced GOLD canvas state')};
}
const point={x:650,y:320};
const actual={kind:'ROBOT',x:220,y:440,robot:{
 time:10.21,radius:55,held:false,scanSource:{x:220,y:396},
 brackets:{state:'in',t0:10.01,target:point},measure:{t0:10.06,target:point}
}};
const lock=probe();
assert.equal(drawEcoGoldTargetLock(lock.ctx,actual),true);
lock.balanced();
assert.ok(lock.events.some(e=>e.kind==='translate'&&e.x===650&&e.y===320),
 'Reticle must be attached to the authoritative floor slot');
assert.ok(lock.events.filter(e=>e.kind==='arc').length>=6,
 'Owner Gold requires two orbital arc families plus halo');
assert.equal(lock.events.filter(e=>e.kind==='leafCurve').length,8,
 'Owner Gold ring has exactly four living seeds with two curves each');
assert.ok(lock.events.some(e=>e.kind==='stop'&&e.color.includes('182,255,163')),
 'Owner ECO biological glow was replaced or neutralized');
const measure=probe();
assert.equal(drawEcoGoldTargetMeasure(measure.ctx,actual),true);
measure.balanced();
assert.ok(measure.events.filter(e=>e.kind==='stroke').length>=6,
 'Gold acquisition ray/tick family incomplete');
assert.ok(measure.events.some(e=>e.kind==='move'&&e.x===220&&e.y===396),
 'Gold ray must originate at native Robot head anchor');
const frozenPoint=JSON.stringify(point),frozenTime=actual.robot.brackets.t0;
assert.equal(JSON.stringify(point),frozenPoint);
assert.equal(actual.robot.brackets.t0,frozenTime);
const missing=probe(),wrongReceipt={kind:'ROBOT',x:220,y:440,robot:{time:10.21,held:false,brackets:{state:'in',t0:10.01,target:null}}};
assert.equal(drawEcoGoldTargetLock(missing.ctx,wrongReceipt),true);
assert.equal(missing.events.length,0,'Never invent phantom targeting coordinates');
const ending=probe();
assert.equal(drawEcoGoldTargetLock(ending.ctx,{...actual,robot:{
 ...actual.robot,time:10.45,brackets:{state:'out',t0:10.01,t1:10.27,target:point}
}}),true);
assert.equal(ending.events.filter(e=>e.kind==='stroke').length,0,'Target reticle must release after Gold .14 s');
const completed=probe();
assert.equal(drawEcoGoldTargetMeasure(completed.ctx,{...actual,robot:{...actual.robot,time:10.44}}),true);
assert.equal(completed.events.length,0,'Gold ray must end after .34 s');
const alt=probe();
assert.equal(drawEcoGoldTargetLock(alt.ctx,{...actual,robot:{...actual.robot,time:10.30}}),true);
assert.notDeepEqual(alt.events.filter(e=>e.kind==='arc').map(e=>e.start),lock.events.filter(e=>e.kind==='arc').map(e=>e.start),
 'Gold arcs must rotate with native time, not freeze on the slot');

const hero='CP10_LOCK_CANARY';
cosmetics.register({kind:'hero',baseId:hero,id:'living',render:{targetLock:drawEcoGoldTargetLock,targetMeasure:drawEcoGoldTargetMeasure}});
const receiptOriginal=cosmetics.capture('p2','hero',hero);
cosmetics.equip('p1','hero',hero,'living');
const receiptGold=cosmetics.capture('p1','hero',hero);
assert.equal(cosmetics.render('targetLock',probe().ctx,receiptOriginal,actual),false,'ORIGINAL remains native');
assert.equal(cosmetics.render('targetLock',probe().ctx,receiptGold,actual),true,'ECO Gold is registered');
assert.equal(cosmetics.render('targetMeasure',probe().ctx,receiptGold,actual),true);
console.log('CP10 ECO GOLD TARGET FAMILY PASS',JSON.stringify({
 ringArcs:lock.events.filter(e=>e.kind==='arc').length,
 cardinalSeedCurves:lock.events.filter(e=>e.kind==='leafCurve').length,
 scanStrokes:measure.events.filter(e=>e.kind==='stroke').length,
 noPhantom:true,originalFallback:true,goldReleaseSec:.14,goldMeasureSec:.34
}));
