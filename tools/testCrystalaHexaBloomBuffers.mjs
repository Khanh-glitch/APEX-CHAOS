// CRYSTALA A2/HEXA renderer: prove real Gold bloom pixel parity while
// eliminating cross-emitter canvas reallocations. No effects are disabled.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,Path2D}=require('@napi-rs/canvas');

const goldCode=fs.readFileSync('public/game/hero-rework/crystalaGoldV6.js','utf8');
const code=fs.readFileSync('public/game/hero-rework/crystalaPresentationRuntime.js','utf8');
const marker='renderBloomRegion(ctx, getConstructBloom(cons, cw, ch), worldTransform, cw, ch, bounds, gx => {';
assert(code.includes(marker),'Construct-specific buffer routing is missing');
const legacy=code.replace(marker,
 'renderBloomRegion(ctx, bloom, worldTransform, cw, ch, bounds, gx => {');

function createGold() {
 const scope={console,Math,Float32Array,Uint8Array,Path2D,__createCanvas:createCanvas};
 scope.document={createElement(tag){if(tag==='canvas')return createCanvas(300,150);return{};}};
 scope.window=scope;scope.globalThis=scope;
 new Function('window','globalThis',goldCode)(scope,scope);
 return scope.APEX_CRYSTALA_GOLD;
}

function run(presentationSource) {
 const gold=createGold(),runs=[];
 const hero={x:205,y:230,px:205,py:230,awake:1};
 const stones=Array.from({length:6},(_,i)=>{
  const angle=i*Math.PI/3;
  return {x:205+Math.cos(angle)*80,y:230+Math.sin(angle)*80,
   px:205+Math.cos(angle)*80,py:230+Math.sin(angle)*80,
   gem:{r:18}};
 });
 const prison={cx:442,cy:235,R:114};
 const cons={kind:'prison',prison};
 const rig={hero,stones,constructs:[cons],fx:{debris:[],dust:[]}};
 const ct={heroId:'CRYSTAL'};
 const goldApi={
  createBloomSystem(options){
   const sys=gold.createBloomSystem(options);
   const stats={resizes:0,begins:0};
   runs.push(stats);
   return {
    begin(...args){
     const canvas=sys.glowCanvas,prevW=canvas.width,prevH=canvas.height;
     const ctx=sys.begin(...args);
     if(canvas.width!==prevW||canvas.height!==prevH)stats.resizes++;
     stats.begins++;
     return ctx;
    },
    composite(...args){return sys.composite(...args);},
    get glowCanvas(){return sys.glowCanvas;}
   };
  },
  drawStone(ctx,stone){
   ctx.save();ctx.fillStyle='rgba(177,107,232,.73)';
   ctx.beginPath();ctx.arc(stone.x,stone.y,stone.gem.r,0,2*Math.PI);ctx.fill();ctx.restore();
  },
  drawCrystala(ctx,h){
   ctx.save();ctx.fillStyle='rgba(192,96,240,.76)';
   ctx.fillRect(h.x-45,h.y-57,90,114);ctx.restore();
  },
  drawWall(){},
  drawPrison(ctx,p,emissive,front){
   ctx.save();ctx.fillStyle=front?'rgba(244,174,255,.85)':'rgba(108,72,215,.75)';
   const y=front?p.cy+24:p.cy-24;
   ctx.fillRect(p.cx-p.R,y-10,p.R*2,20);ctx.restore();
  },
 };
 const scope={console,Math,Date,
  APEX_CRYSTALA_GOLD:goldApi,
  APEX_HERO_REWORK:{match:{combatants:[ct]}},
  APEX_CRYSTAL:{stateOf:()=>({rig}),setPresentation(){}},
  drawProjectiles(){}};
 scope.window=scope;scope.globalThis=scope;
 new Function('window','globalThis',presentationSource)(scope,scope);
 const {runBloomPass}=scope.APEX_CRYSTALA_PRESENTATION;
 assert.equal(typeof runBloomPass,'function');
 const cv=createCanvas(640,480),ctx=cv.getContext('2d');
 const frames=[];
 for(let i=0;i<12;i++){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,cv.width,cv.height);
  runBloomPass(ctx);
  ctx.restore();
  frames.push(Buffer.from(ctx.getImageData(0,0,cv.width,cv.height).data));
 }
 return {frames,systems:runs.length,begins:runs.reduce((n,x)=>n+x.begins,0),
  resizes:runs.reduce((n,x)=>n+x.resizes,0)};
}
const base=run(legacy);
const optimized=run(code);
assert.equal(base.systems,1,'Original renderer must use one buffer set');
assert.equal(optimized.systems,2,'Body and live HEXA must own separate buffer sets');
assert.equal(base.begins,optimized.begins,'No bloom pass may be dropped');
assert(base.resizes>=20,'Repro must demonstrate baseline buffer thrashing');
assert(optimized.resizes<=2,'New emitter-specific buffers must stop alternating resizes');
for(let i=0;i<base.frames.length;i++)
 assert(base.frames[i].equals(optimized.frames[i]),'Pixel mismatch in frame '+i);
console.log('PASS CRYSTALA A2/HEXA bloom: 12 frames exact pixel parity; '+base.begins+
 ' passes preserved; buffer dimension changes '+base.resizes+' -> '+optimized.resizes);
