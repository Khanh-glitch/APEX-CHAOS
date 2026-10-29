// Exact Chrome pixels and paired same-process timings; no FPS promise.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const base=(process.env.APEX_APP_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const output=process.env.APEX_EVIDENCE_DIR||'reports/bot-wave-lossless-fluid';
fs.mkdirSync(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,
 args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluateOnNewDocument(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto(base+'/bot-wave/game.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.BOXE_WAVE_PILOT&&!!window.APEX_WAVE_LOSSLESS_FLUID,{polling:100});
 const result=await page.evaluate(async()=>{
  const Fluid=window.handLab.fluid.constructor,install=window.APEX_WAVE_LOSSLESS_FLUID.install;
  const keys=['u','v','u0','v0','dens','dens0','temp','temp0','curl','p','div','soot'];
  const make=async()=>{const f=new Fluid();await f._pressureWasmReady;return f;};
  const a=await make(),b=await make(),api=install(b);
  function seed(f,seed,full=false){
   let state=seed;
   const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
   for(const key of keys)for(let i=0;i<f[key].length;i++)f[key][i]=(random()-.2)*(key==='u'||key==='v'?140:1.2);
   Object.assign(f,full?{minI:1,maxI:156,minJ:1,maxJ:156}:{minI:39,maxI:102,minJ:22,maxJ:113});
  }
  let fieldComparisons=0,pixelCases=0,changedChannels=0;
  for(let seedValue=1;seedValue<=4;seedValue++){
   seed(a,seedValue,seedValue%2===0);seed(b,seedValue,seedValue%2===0);
   for(const dt of [1/120,1/60,.034,.05]){
    a.step(dt);b.step(dt);
    for(const key of keys){
     const x=new Uint8Array(a[key].buffer,a[key].byteOffset,a[key].byteLength);
     const y=new Uint8Array(b[key].buffer,b[key].byteOffset,b[key].byteLength);
     for(let i=0;i<x.length;i++)if(x[i]!==y[i])throw Error('Fluid field mismatch: '+key+' byte '+i);
     fieldComparisons++;
    }
   }
   for(const dpr of [1,1.5,2])for(const zoom of [.24,.875,1.75]){
    const surfaces=[a,b].map(f=>{
     const c=document.createElement('canvas');c.width=Math.round(640*dpr);c.height=Math.round(380*dpr);
     const ctx=c.getContext('2d');
     ctx.scale(dpr,dpr);ctx.fillStyle='#203047';ctx.fillRect(0,0,640,380);
     ctx.translate(320,190);ctx.rotate(.071*seedValue);ctx.scale(zoom,zoom);
     ctx.beginPath();ctx.rect(-1100,-900,2200,1800);ctx.clip();
     if(f===b)api.beginFrame();
     f.draw(ctx,'smoke');
     ctx.fillStyle='#f0ad36';ctx.fillRect(-80,-35,160,70);
     ctx.globalAlpha=.45;f.draw(ctx,'smoke');ctx.globalAlpha=1;
     f.draw(ctx,'fire');
     if(f===b)api.endFrame();
     return c;
    });
    const x=surfaces[0].getContext('2d').getImageData(0,0,surfaces[0].width,surfaces[0].height).data;
    const y=surfaces[1].getContext('2d').getImageData(0,0,surfaces[1].width,surfaces[1].height).data;
    for(let i=0;i<x.length;i++)if(x[i]!==y[i])changedChannels++;
    pixelCases++;
    if(pixelCases===1)window.__fluidParityPng=surfaces[1].toDataURL('image/png');
   }
  }
  const median=v=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
  const stepTimes={baseline:[],candidate:[]},drawTimes={baseline:[],candidate:[]};
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
  const ctx=canvas.getContext('2d');
  function benchStep(f){
   seed(f,4981,true);const start=performance.now();
   for(let i=0;i<30;i++)f.step(1/60);
   return (performance.now()-start)/30;
  }
  function benchDraw(f){
   seed(f,4981,true);const start=performance.now();
   for(let i=0;i<20;i++){
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,960,540);ctx.translate(480,270);ctx.scale(.6,.6);
    if(f===b)api.beginFrame();
    f.draw(ctx,'smoke');ctx.globalAlpha=.45;f.draw(ctx,'smoke');ctx.globalAlpha=1;f.draw(ctx,'fire');
    if(f===b)api.endFrame();
   }
   // Flush both branches equally so asynchronous canvas work is included.
   ctx.getImageData(0,0,1,1);
   return (performance.now()-start)/20;
  }
  benchStep(a);benchStep(b);benchDraw(a);benchDraw(b);
  for(let round=0;round<9;round++)for(const name of round%2?['candidate','baseline']:['baseline','candidate']){
   const f=name==='baseline'?a:b;
   stepTimes[name].push(benchStep(f));drawTimes[name].push(benchDraw(f));
  }
  function summary(samples){const baseline=median(samples.baseline),candidate=median(samples.candidate);
   return {baselineMedianMs:baseline,candidateMedianMs:candidate,reductionPercent:(1-candidate/baseline)*100,samples};}
  return {fieldComparisons,pixelCases,changedChannels,backend:a._pressureBackend,
   step:summary(stepTimes),draw:summary(drawTimes),work:api.snapshot(),
   userAgent:navigator.userAgent};
 });
 assert.equal(result.changedChannels,0,'Chrome pixel differences');
 assert.equal(result.backend,'wasm-exact-14-iter','Compare the shipping WASM baseline');
 assert.equal(result.work.pairedAdvectionEnabled,true);
 assert.deepEqual(errors,[]);
 const data=await page.evaluate(()=>window.__fluidParityPng);
 fs.writeFileSync(output+'/fluid-parity.png',Buffer.from(data.split(',')[1],'base64'));
 fs.writeFileSync(output+'/comparison.json',JSON.stringify(result,null,2)+'\n');
 console.log('BOT WAVE CHROME LOSSLESS FLUID PASS',JSON.stringify(result));
}finally{await browser.close();}
