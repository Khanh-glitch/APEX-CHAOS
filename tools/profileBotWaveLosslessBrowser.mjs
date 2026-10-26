// BOT WAVE performance acceptance: observes the real Gold iframe + V2 HUD.
// Numbers are diagnostics, not fabricated FPS claims or hardware-independent caps.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base=(process.env.APEX_APP_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dest=process.env.APEX_EVIDENCE_DIR||'docs/boxe/bot-wave-perf';
fs.mkdirSync(dest,{recursive:true});
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_PATH,headless:true,
 args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const probes=[
 {name:'desktop-1440x900',viewport:{width:1440,height:900,deviceScaleFactor:1}},
 {name:'landscape-phone-844x390',viewport:{width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true}}
];
const results=[];
async function until(label,read,timeout=30000){
 const started=Date.now();
 for(;;){
  const value=await read();
  if(value)return value;
  if(Date.now()-started>timeout)throw Error('TIMEOUT '+label);
  await sleep(100);
 }
}
try{
 for(const profile of probes){
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  await page.setViewport(profile.viewport);
  await page.goto(base+'/bot-wave/index.html',{waitUntil:'domcontentloaded',timeout:65000});
  const frame=await until('Gold iframe',async()=>page.frames().find(f=>f.url().includes('/bot-wave/game.html')));
  await until('Gold + pilot + full V2 presentation',()=>frame.evaluate(()=>
   !!window.handLab&&!!window.BOXE_WAVE_PILOT&&window.APEX_BOT_WAVE_INTERFACE_V2?.installed===true
  ).catch(()=>false),45000);
  await frame.waitForSelector('#w-go',{visible:true,timeout:20000});
  await frame.click('#w-go');
  await until('combat',()=>frame.evaluate(()=>window.BOXE_WAVE_PILOT?.state?.phase==='combat'),20000);
  await frame.evaluate(()=>{
   const post=window.handLab?.post;
   if(!post)return;
   const counts=window.__botwavePassCosts={};
   for(const name of ['sctx','actx','bctx','rctx1','rctx2','rbctx','cpctx']){
    const ctx=post[name];if(!ctx)continue;
    const stat=counts[name]={draws:0,drawMs:0,fillMs:0,clearMs:0,maxDrawMs:0};
    for(const [method,totalKey] of [['drawImage','drawMs'],['fillRect','fillMs'],['clearRect','clearMs']]){
     const original=ctx[method]?.bind(ctx);
     if(!original)continue;
     ctx[method]=function(...args){
      const start=performance.now();
      try{return original(...args);}
      finally{
       const cost=performance.now()-start;
       stat[totalKey]+=cost;
       if(method==='drawImage'){stat.draws++;stat.maxDrawMs=Math.max(stat.maxDrawMs,cost);}
      }
     };
    }
   }
  });
  // Same live scene, same quarter-resolution bloom filter, both paths in
  // one browser task. The comparison is pixel-level, not just screenshots.
  const bloomParity=await frame.evaluate(()=>{
   const source=window.handLab?.post?.scene;
   if(!source)return null;
   const width=Math.max(2,Math.round(source.width/4)),height=Math.max(2,Math.round(source.height/4));
   const make=()=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
   const native=make(),nctx=native.getContext('2d',{willReadFrequently:true});
   const pre=make(),pctx=pre.getContext('2d');
   const optimized=make(),octx=optimized.getContext('2d',{willReadFrequently:true});
   if(!nctx||!pctx||!octx)return null;
   const filter='brightness(1.06) contrast(2.05) saturate(1.18) blur(1.1px)';
   nctx.filter=filter;nctx.drawImage(source,0,0,width,height);nctx.filter='none';
   pctx.drawImage(source,0,0,width,height);
   octx.filter=filter;octx.drawImage(pre,0,0,width,height);octx.filter='none';
   const a=nctx.getImageData(0,0,width,height).data,b=octx.getImageData(0,0,width,height).data;
   let totalDiff=0,maxDiff=0,changedChannels=0;
   for(let i=0;i<a.length;i++){
    const delta=Math.abs(a[i]-b[i]);totalDiff+=delta;
    if(delta>maxDiff)maxDiff=delta;
    if(delta)changedChannels++;
   }
   return {width,height,meanChannelDiff:totalDiff/a.length,maxChannelDiff:maxDiff,
    changedChannels,channelCount:a.length};
  });
  assert.ok(bloomParity&&bloomParity.meanChannelDiff<=0.3&&bloomParity.maxChannelDiff<=5,
   profile.name+': pre-scaled bloom differs materially from canonical Gold bloom: '+JSON.stringify(bloomParity));
  const before=await frame.evaluate(()=>({
   x:window.handLab.player.x,y:window.handLab.player.y,
   t:window.handLab.time
  }));
  // The W-key is the native Gold control, routed through the actual live iframe.
  await page.keyboard.down('w');
  await sleep(750);
  await page.keyboard.up('w');
  const after=await frame.evaluate(()=>({
   x:window.handLab.player.x,y:window.handLab.player.y,
   t:window.handLab.time
  }));
  const movement=Math.hypot(after.x-before.x,after.y-before.y);
  // Give the engine and V2 a representative live sample window.
  await sleep(4500);
  // ABBA on a paused, pixel-identical Gold scene, using the same Chrome
  // process and exact canvas size; keeps shared-host variance out of claims.
  await frame.evaluate(()=>{
   const p=window.handLab.post,original=p.end.bind(p);
   window.handLab.paused=true;
   window.__bloomAB={active:null,samples:{native:[],optimized:[]}};
   p.end=function(...args){
    const start=performance.now();
    try{return original(...args);}
    finally{
     const test=window.__bloomAB;
     if(test?.active){const a=test.samples[test.active];if(a.length<200)a.push(performance.now()-start);}
    }
   };
  });
  for(const mode of ['native','optimized','optimized','native']){
   await frame.evaluate(mode=>{
    window.__bloomAB.active=null;
    window.APEX_BOT_WAVE_BLOOM_PREPASS.setEnabled(mode==='optimized');
   },mode);
   await sleep(250);
   await frame.evaluate(mode=>{window.__bloomAB.active=mode;},mode);
   await sleep(1150);
  }
  const bloomAB=await frame.evaluate(()=>{
   const test=window.__bloomAB;
   test.active=null;
   window.APEX_BOT_WAVE_BLOOM_PREPASS.setEnabled(true);
   window.handLab.paused=false;
   const stats=a=>{
    const items=a.slice().sort((x,y)=>x-y),n=items.length;
    return {count:n,medianMs:n?items[Math.floor(n/2)]:0,
     p95Ms:n?items[Math.floor((n-1)*.95)]:0,meanMs:n?a.reduce((x,y)=>x+y,0)/n:0};
   };
   return {native:stats(test.samples.native),optimized:stats(test.samples.optimized)};
  });
  assert.ok(bloomAB.native.count>=5&&bloomAB.optimized.count>=5,
   profile.name+': insufficient ABBA post frames '+JSON.stringify(bloomAB));
  const stat=await frame.evaluate(()=>({
   ...window.APEX_WAVE_PERF?.snapshot(),
   passCosts:window.__botwavePassCosts||{}
  }));
  assert.ok(stat&&stat.renderSamples>10&&stat.postSamples>10,
   profile.name+': render/post instrumentation never sampled');
  assert.ok(Number.isFinite(stat.renderP95Ms)&&Number.isFinite(stat.frameGapP95Ms),
   profile.name+': invalid latency samples');
  assert.ok(after.t>before.t&&movement>8,
   profile.name+': native movement did not advance under held keyboard input');
  assert.deepEqual(errors,[],profile.name+': uncaught browser errors');
  const result={
   profile:profile.name,viewport:profile.viewport,
   movementPx:+movement.toFixed(2),gameClockAdvanced:+(after.t-before.t).toFixed(3),
   updateP95Ms:+stat.updateP95Ms.toFixed(2),
   renderP95Ms:+stat.renderP95Ms.toFixed(2),
   postP95Ms:+stat.postP95Ms.toFixed(2),
   frameGapP95Ms:+stat.frameGapP95Ms.toFixed(2),
   frameGapP99Ms:+stat.frameGapP99Ms.toFixed(2),
   inputQueueP95Ms:+stat.inputQueueP95Ms.toFixed(2),
   maxRenderMs:+stat.maxRenderMs.toFixed(2),
   longTasks:stat.longTasks,longTaskMaxMs:+stat.longTaskMaxMs.toFixed(2),
   canvasPixels:stat.canvasPixels,renderDpr:stat.renderDpr,
   goldParticles:stat.goldParticles,livingBots:stat.livingBots,
   passCosts:stat.passCosts,
   bloomPrepass:await frame.evaluate(()=>window.APEX_BOT_WAVE_BLOOM_PREPASS?.snapshot()),
   bloomParity,bloomAB
  };
  results.push(result);
  await page.screenshot({path:dest+'/'+profile.name+'.png'});
  console.log('BOT WAVE PERF SAMPLE',JSON.stringify(result));
  await page.close();
 }
 fs.writeFileSync(dest+'/profile.json',JSON.stringify({
  source:'real Chrome — shipping BOT WAVE game.html inside wrapper with V2 HUD',
  note:'Chrome CI hardware is not a representative phone; compare before/after on the same host and scene.',
  results
 },null,2)+'\n');
 console.log('BOT WAVE PERF INSTRUMENTATION + MOVEMENT: PASS (timings reported, not declared performant)');
}finally{await browser.close();}
