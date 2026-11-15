// BOT WAVE performance acceptance: observes the real Gold iframe + V2 HUD.
// Numbers are diagnostics, not fabricated FPS claims or hardware-independent caps.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base=(process.env.APEX_APP_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dest=process.env.APEX_EVIDENCE_DIR||'docs/boxe/bot-wave-perf';
const route=process.env.APEX_WAVE_PROFILE_ROUTE||'home';
assert.ok(['home','wrapper'].includes(route),'Unknown BOT WAVE profile route');
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
  if(route==='home'){
   await page.goto(base+'/?goldViewport=native',{waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
   await page.waitForSelector('#botWaveEntry',{visible:true,timeout:30000});
   await page.click('#botWaveEntry');
  }else await page.goto(base+'/bot-wave/index.html',{waitUntil:'domcontentloaded',timeout:65000});
  const frame=await until('Gold iframe',async()=>page.frames().find(f=>f.url().includes('/bot-wave/game.html')));
  await until('Gold + pilot + full V2 presentation',()=>frame.evaluate(()=>
   !!window.handLab&&!!window.BOXE_WAVE_PILOT&&window.APEX_BOT_WAVE_INTERFACE_V2?.installed===true
  ).catch(()=>false),45000);
  if(route==='home')await page.waitForFunction(()=>!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:45000});
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
  // Let actual entry/texture/font/audio initialization settle. Keep startup
  // evidence, then reset only diagnostics; never mask a simulation step.
  await sleep(2500);
  const startup=await frame.evaluate(()=>window.APEX_WAVE_PERF.snapshot());
  await frame.evaluate(()=>{
   const time=window.handLab.time;
   window.APEX_WAVE_PERF.reset();
   if(window.handLab.time!==time)throw Error("Performance reset advanced gameplay");
   for(const stat of Object.values(window.__botwavePassCosts||{}))
    for(const key of Object.keys(stat))stat[key]=0;
  });
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
  const refractionParity=await frame.evaluate(()=>{
   const Post=window.handLab.post.constructor;
   const classic=new Post(),partial=new Post();
   window.APEX_WAVE_REFRACTION_COPY.installForTest(partial);
   const w=420,h=280,opts={time:1.2,
    shocks:[{x:165,y:125,r:78,width:22,strength:.12,squash:.62},
     {x:305,y:232,r:25,width:35,strength:.06,squash:.62}],
    heat:[{x:90,y:164,w:80,h:85,heat:.8},
     {x:318,y:80,w:76,h:60,heat:.9}]
   };
   for(const post of [classic,partial]){
    post.scene.width=w;post.scene.height=h;
    const ctx=post.sctx;
    const g=ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#c98d45');g.addColorStop(.5,'#24386c');g.addColorStop(1,'#080d13');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#ffcf69';ctx.lineWidth=5;
    for(let i=0;i<25;i++){ctx.beginPath();ctx.arc(i*27%w,i*59%h,8+i%6,0,Math.PI*2);ctx.stroke();}
    post.distort(w,h,1,opts);
   }
   const a=classic.sctx.getImageData(0,0,w,h).data;
   const b=partial.sctx.getImageData(0,0,w,h).data;
   let changed=0,maxDiff=0,sum=0;
   for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)changed++;sum+=d;maxDiff=Math.max(d,maxDiff);}
   return {changedChannels:changed,maxChannelDiff:maxDiff,meanChannelDiff:sum/a.length,totalChannels:a.length};
  });
  assert.equal(refractionParity.changedChannels,0,
   profile.name+': sampled-region refraction does not match canonical full-copy Gold: '+JSON.stringify(refractionParity));
  const result={
   profile:profile.name,viewport:profile.viewport,route,startup,
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
   fluidWork:stat.fluidWork,
   passCosts:stat.passCosts,
   catchup:await frame.evaluate(()=>window.APEX_WAVE_CATCHUP?.snapshot()),
   refractionCopy:await frame.evaluate(()=>window.APEX_WAVE_REFRACTION_COPY?.snapshot()),
   refractionParity
  };
  results.push(result);
  await page.screenshot({path:dest+'/'+profile.name+'.png'});
  console.log('BOT WAVE PERF SAMPLE',JSON.stringify(result));
  await page.close();
 }
 fs.writeFileSync(dest+'/profile.json',JSON.stringify({
  source:'real Chrome — '+route+' entry to shipping BOT WAVE game.html with V2 HUD',
  note:'Startup is recorded separately; measured combat begins after 2.5s settling. Refraction readback runs after the measured window. Chrome viewport emulation is not physical phone hardware; compare paired runs on the same host and scene.',
  results
 },null,2)+'\n');
 console.log('BOT WAVE PERF INSTRUMENTATION + MOVEMENT: PASS (timings reported, not declared performant)');
}finally{await browser.close();}
