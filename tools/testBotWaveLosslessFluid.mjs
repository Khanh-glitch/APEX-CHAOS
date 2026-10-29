import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const game=fs.readFileSync('public/bot-wave/game.html','utf8').replace(/\r\n/g,'\n');
const start=game.indexOf("'src/game/fx/fluid.ts': function(module,exports,require){");
const end=game.indexOf("\n},\n'src/game/fx/fire.ts'",start);
assert.ok(start>0&&end>start);
const moduleSource=game.slice(game.indexOf('\n',start)+1,end);
const exports={};
const context={exports,Math,Float32Array,Uint8ClampedArray,document:{createElement:()=>({getContext:()=>({
 createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}
})})},window:{}};
vm.runInNewContext(moduleSource,context);
vm.runInNewContext(fs.readFileSync('public/game/bot-wave/losslessFluidRuntime.js','utf8'),context);
const install=context.window.APEX_WAVE_LOSSLESS_FLUID.install;
const arrays=['u','v','u0','v0','dens','dens0','temp','temp0','curl','p','div','soot'];
function seed(a,b,seed,box){
 let state=seed;
 const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 for(const key of arrays)for(let i=0;i<a[key].length;i++){
  const value=(random()-.25)*(key==='u'||key==='v'?180:1.4);
  a[key][i]=b[key][i]=value;
 }
 for(const [key,v] of Object.entries(box))a[key]=b[key]=v;
}
const boxes=[{minI:1,maxI:156,minJ:1,maxJ:156},
 {minI:43,maxI:110,minJ:19,maxJ:97},{minI:-5,maxI:7,minJ:149,maxJ:166},
 {minI:65,maxI:65,minJ:39,maxJ:39},{minI:158,maxI:0,minJ:158,maxJ:0}];
let comparisons=0;
for(let s=1;s<=6;s++)for(const box of boxes){
 const a=new exports.Fluid(),b=new exports.Fluid();const api=install(b);
 assert.equal(install(b),api,'installation must be idempotent');
 assert.equal(api.snapshot().pairedAdvectionEnabled,true);
 seed(a,b,s,box);
 for(const dt of [0,1/120,1/60,.034,.05]){
  a.step(dt);b.step(dt);
  for(const key of arrays){
   assert.ok(Buffer.from(a[key].buffer).equals(Buffer.from(b[key].buffer)),`${key} seed=${s} dt=${dt}`);
   comparisons++;
  }
  for(const key of ['minI','maxI','minJ','maxJ'])assert.equal(a[key],b[key]);
 }
 // Calls outside the canonical step retain the original single-field API.
 a.advect(a.dens,a.dens0,a.u,a.v,.016,2,20,3,21);
 b.advect(b.dens,b.dens0,b.u,b.v,.016,2,20,3,21);
 assert.deepEqual(a.dens,b.dens);
}
// Compare the raster bytes and complete composite command stream, including
// alpha, filter and source pixels. A mutation between draws must invalidate.
function destination(){
 const calls=[],stack=[];
 return {calls,globalAlpha:.45,filter:'none',imageSmoothingEnabled:false,imageSmoothingQuality:'low',
  save(){stack.push([this.globalAlpha,this.filter,this.imageSmoothingEnabled,this.imageSmoothingQuality]);},
  restore(){[this.globalAlpha,this.filter,this.imageSmoothingEnabled,this.imageSmoothingQuality]=stack.pop();},
  drawImage(c,...args){calls.push({args,alpha:this.globalAlpha,filter:this.filter,
   smoothing:this.imageSmoothingQuality,pixels:[...c.pixels]});}};
}
const a=new exports.Fluid(),b=new exports.Fluid();seed(a,b,73,boxes[1]);
for(const f of [a,b])f.cctx.putImageData=img=>{f.cvs.pixels=img.data.slice();};
const api=install(b),da=destination(),db=destination();
api.beginFrame();
for(const layer of ['smoke','smoke','fire','smoke']){a.draw(da,layer);b.draw(db,layer);}
api.endFrame();assert.deepEqual(da.calls,db.calls);
assert.equal(api.snapshot().smokeRasterReuses,1);
api.beginFrame();b.draw(db,'smoke');b.addSmoke(0,0,80,.9,.2);b.draw(db,'smoke');api.endFrame();
assert.equal(api.snapshot().smokeRasterReuses,1,'mutation must discard the smoke cache');
const targetBody=game.match(/engine\.waveAimTarget=function\(\)\{([\s\S]*?)\n\};/)[1];
const nearest=new Function(targetBody);
let targetSeed=91;
const random=()=>((targetSeed=(Math.imul(targetSeed,1664525)+1013904223)>>>0)/4294967296);
for(let count=0;count<80;count++){
 const player={x:13,y:-71},enemies=Array.from({length:count},(_,id)=>({id,dead:random()<.2,x:Math.floor(random()*9)*40,y:Math.floor(random()*9)*40}));
 const expected=enemies.filter(e=>!e.dead).sort((a,b)=>
  ((a.x-player.x)**2+(a.y-player.y)**2)-((b.x-player.x)**2+(b.y-player.y)**2)||a.id-b.id)[0]||null;
 assert.equal(nearest.call({player,enemies}),expected,'nearest target must retain distance/ID ordering');
}
const perfStart=game.indexOf('window.APEX_WAVE_PERF=Object.freeze(');
const perfEnd=game.indexOf('const nativeUpdate=',perfStart);
const diagnostic={window:{},PERF:{samples:8,lastMs:12,longTasks:2},
 perfHistory:{frame:{count:3,data:new Float32Array([16,90,17])}},lastRenderStart:123};
vm.runInNewContext(game.slice(perfStart,perfEnd)+'window.APEX_WAVE_PERF.reset();',diagnostic);
assert.equal(diagnostic.PERF.samples,0);assert.equal(diagnostic.PERF.longTasks,0);
assert.equal(diagnostic.perfHistory.frame.count,0);assert.equal(diagnostic.lastRenderStart,0);
assert.deepEqual([...diagnostic.perfHistory.frame.data],[0,0,0]);
console.log(`BOT WAVE lossless fluid PASS: ${comparisons} bitwise field comparisons, composite/raster parity, mutation invalidation, standalone calls`);
