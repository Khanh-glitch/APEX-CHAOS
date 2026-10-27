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
  const bloomBackingMode=process.env.APEX_BLOOM_BACKING_MODE||'off';
  await page.goto(base+'/bot-wave/index.html?bloomBacking='+bloomBackingMode,{waitUntil:'domcontentloaded',timeout:65000});
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
  const refractionParity=await frame.evaluate(()=>{
   const Post=window.handLab.post.constructor;
   const classic=new Post(),partial=new Post();
   window.APEX_WAVE_REFRACTION_COPY.installForTest(partial);
   // Six successive uses of the SAME Gold copy buffer: the very first
   // refraction resizes it, later ones prove the no-clear path is pixel-exact.
   const w=420,h=280;
   const trials=[
    {x:165,y:125,r:78,heatX:90,heatY:164},
    {x:292,y:99,r:48,heatX:195,heatY:155},
    {x:95,y:205,r:68,heatX:260,heatY:85},
    {x:218,y:170,r:94,heatX:70,heatY:120},
    {x:330,y:190,r:38,heatX:185,heatY:215},
    {x:120,y:79,r:79,heatX:280,heatY:170}
   ];
   for(const post of [classic,partial]){post.scene.width=w;post.scene.height=h;}
   let changed=0,maxDiff=0,sum=0,totalChannels=0;
   for(const [pass,c] of trials.entries()){
    const opts={time:1.2+pass*.37,
     shocks:[{x:c.x,y:c.y,r:c.r,width:22,strength:.12,squash:.62},
      {x:305-pass*17,y:232-pass*21,r:25,width:35,strength:.06,squash:.62}],
     heat:[{x:c.heatX,y:c.heatY,w:80,h:85,heat:.8},
      {x:318-pass*29,y:80+pass*20,w:76,h:60,heat:.9}]};
    for(const post of [classic,partial]){
     const ctx=post.sctx;
     const g=ctx.createLinearGradient(0,0,w,h);
     g.addColorStop(0,pass%2?'#315d79':'#c98d45');
     g.addColorStop(.5,'#24386c');g.addColorStop(1,'#080d13');
     ctx.setTransform(1,0,0,1,0,0);
     ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
     ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
     ctx.strokeStyle='#ffcf69';ctx.lineWidth=5;
     for(let k=0;k<25;k++){ctx.beginPath();ctx.arc((k*27+pass*13)%w,(k*59+pass*29)%h,8+k%6,0,Math.PI*2);ctx.stroke();}
     post.distort(w,h,1,opts);
    }
    const a=classic.sctx.getImageData(0,0,w,h).data;
    const b=partial.sctx.getImageData(0,0,w,h).data;
    for(let k=0;k<a.length;k++){const d=Math.abs(a[k]-b[k]);if(d)changed++;sum+=d;maxDiff=Math.max(d,maxDiff);}
    totalChannels+=a.length;
   }
   return {changedChannels:changed,maxChannelDiff:maxDiff,meanChannelDiff:sum/totalChannels,totalChannels,passes:trials.length};
  });
  assert.equal(refractionParity.changedChannels,0,
   profile.name+': sampled-region refraction does not match canonical full-copy Gold: '+JSON.stringify(refractionParity));
  const bloomParity=await frame.evaluate(()=>{
   const Post=window.handLab.post.constructor,base=new Post(),candidate=new Post();
   const probe=window.APEX_WAVE_BLOOM_BACKEND.installForTest(candidate,'offscreen');
   if(!probe.installed)return {failure:probe.fallback};
   const width=320,height=192,totalFrames=4;
   let altered=0,maxDiff=0,pixels=0;
   const c1=document.createElement('canvas'),c2=document.createElement('canvas');
   c1.width=c2.width=width;c1.height=c2.height=height;
   const d1=c1.getContext('2d'),d2=c2.getContext('2d');
   for(let frameIndex=0;frameIndex<totalFrames;frameIndex++){
    for(const post of [base,candidate]){
     const sc=post.begin(width,height,1);
     const grad=sc.createLinearGradient(0,0,width,height);
     grad.addColorStop(0,'#f67e31');grad.addColorStop(.5,'#14273f');grad.addColorStop(1,'#e1c575');
     sc.fillStyle=grad;sc.fillRect(0,0,width,height);
     sc.fillStyle='#fff9c6';
     for(let i=0;i<21;i++)sc.fillRect((i*41+frameIndex*17)%width,(i*19+frameIndex*11)%height,5+i%5,10+i%9);
    }
    const opts={grain:0,bloom:1,vignette:.45,fx:145,fy:80,shocks:[],heat:[],chroma:0,radial:0};
    base.end(d1,width,height,1,opts);candidate.end(d2,width,height,1,opts);
    const a=d1.getImageData(0,0,width,height).data,b=d2.getImageData(0,0,width,height).data;
    for(let i=0;i<a.length;i++){
     const delta=Math.abs(a[i]-b[i]);if(delta)altered++;maxDiff=Math.max(maxDiff,delta);
    }
    pixels+=a.length;
   }
   return {changedChannels:altered,maxDiff,totalChannels:pixels,frames:totalFrames,probe};
  });
  assert.equal(bloomParity.changedChannels,0,profile.name+': alternative bloom backing differs from canonical Gold '+JSON.stringify(bloomParity));
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
   catchup:await frame.evaluate(()=>window.APEX_WAVE_CATCHUP?.snapshot()),
   refractionCopy:await frame.evaluate(()=>window.APEX_WAVE_REFRACTION_COPY?.snapshot()),
   refractionParity,bloomBackingMode,bloomParity,bloomBackend:await frame.evaluate(()=>window.APEX_WAVE_BLOOM_BACKEND?.snapshot())
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
