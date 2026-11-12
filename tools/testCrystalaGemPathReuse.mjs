// Full production Gold cell renderer: compare original R5 and Path2D-cached
// HEXA at identical deterministic stages. CPU microbenchmark is directional
// and does not substitute for laptop hardware-frame measurements.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,Path2D}=require('@napi-rs/canvas');
const SHA='485a75637e985415945662c2a6016eb898932612';
const filename='public/game/hero-rework/crystalaGoldV6.js';
const original=execFileSync('git',['show',SHA+':'+filename],{encoding:'utf8'});
const patched=fs.readFileSync(filename,'utf8');
assert.notEqual(original,patched,'no change to benchmark');
function load(code){
 const scope={console,Math,Float32Array,Uint8Array,Path2D,__createCanvas:createCanvas};
 scope.document={createElement(tag){return tag==='canvas'?createCanvas(300,150):{};}};
 scope.window=scope;scope.globalThis=scope;
 new Function('window','globalThis',code)(scope,scope);
 assert.equal(scope.apexCrystalaGoldV6,'ready');
 return scope.APEX_CRYSTALA_GOLD;
}
const A=load(original),B=load(patched);
function setup(G){
 const rig=G.createRig({seed:145,visual:false});
 rig.setBody(250,315,0,0);
 for(let i=0;i<60;i++)rig.advance(1/60);
 rig.awaken(1,1);
 const prison=rig.castPrison({cx:490,cy:330,R:135,seed:34});
 return {rig,prison};
}
const aa=setup(A),bb=setup(B);
function draw(G,p,ctx){
 ctx.clearRect(0,0,760,680);
 G.drawPrison(ctx,p,false,false);
 G.drawPrison(ctx,p,false,true);
 G.drawPrison(ctx,p,true,false);
 G.drawPrison(ctx,p,true,true);
}
const ca=createCanvas(760,680),cb=createCanvas(760,680);
const aCtx=ca.getContext('2d'),bCtx=cb.getContext('2d');
let compared=0;
for(let frame=0;frame<150;frame++){
 aa.rig.advance(1/60);bb.rig.advance(1/60);
 if([1,3,5,10,15,21,30,42,60,85,110,149].includes(frame)){
   draw(A,aa.prison.prison,aCtx);draw(B,bb.prison.prison,bCtx);
   const x=Buffer.from(aCtx.getImageData(0,0,760,680).data);
   const y=Buffer.from(bCtx.getImageData(0,0,760,680).data);
   assert(x.equals(y),'Gold pixel mismatch at frame '+frame);
   compared++;
 }
}
let loops=90;
function perf(G,p,ctx){
 const times=[];
 for(let round=0;round<7;round++){
   let t=performance.now();
   for(let i=0;i<loops;i++)draw(G,p,ctx);
   times.push((performance.now()-t)/loops);
 }
 times.sort((a,b)=>a-b);
 return {medianMs:times[3],samples:times};
}
const ref=perf(A,aa.prison.prison,aCtx);
const opt=perf(B,bb.prison.prison,bCtx);
const gain=100*(ref.medianMs-opt.medianMs)/ref.medianMs;
const out={visualFrames:compared,polygonCells:6*13,referenceMs:ref.medianMs,
 optimizedMs:opt.medianMs,improvementPct:gain,referenceSamples:ref.samples,
 optimizedSamples:opt.samples};
console.log('CRYSTALA HEXA Path2D reuse '+JSON.stringify(out));
assert(compared===12);
assert(gain>0,'No CPU-side drawing gain; do not ship as performance fix');
