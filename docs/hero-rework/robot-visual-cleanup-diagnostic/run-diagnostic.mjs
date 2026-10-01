import {execFileSync} from 'node:child_process';
// Diagnostic-only browser instrumentation. Never shipped with the game.
// Run from repository root against a fresh production preview on :4173.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import puppeteer from 'puppeteer-core';
import chromium,{inflate} from '@sparticuz/chromium';
const require=createRequire(import.meta.url);
const root=path.dirname(path.dirname(require.resolve('@sparticuz/chromium')));
await inflate(path.join(root,'bin/al2023.tar.br'));
process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||'');
const OUT='docs/hero-rework/robot-visual-cleanup-diagnostic';
for(const d of ['background-matrix','edge-crops','impact-isolation','sharpness-ab'])fs.mkdirSync(`${OUT}/${d}`,{recursive:true});
const html=fs.readFileSync('docs/hero-rework/robot-final/reference/ROBOT_VISUAL_AUTHORITY.html','utf8');
const runtime=execFileSync('git',['show','bdf29a75770e2013e08bd2b005b8c4eae371b229:public/game/hero-rework/robotPresentationRuntime.js'],{encoding:'utf8'});
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
const metrics={browser:await browser.version(),viewport:{width:1440,height:1000},authority:'bdf29a75770e2013e08bd2b005b8c4eae371b229',goldenSHA256:'bd0cc64fbeea94969fbef0b4bc4de690a19e85fafe93cb4a12c9b3accf095f75',runs:[],errors:[]};
function save(file,data){fs.writeFileSync(`${OUT}/${file}`,Buffer.from(data.split(',')[1],'base64'));}
const injected=runtime.replace('  function renderRobotLocal(ctx, fighter, st) {','  function renderRobotLocalDirect(ctx, fighter, st) {').replace('  // World-space: brackets, measure, trail with calibration ticks (authority)',`
  // Harness-only candidate B, 2x GAME backing sampling, same world size.
  let diagRT;
  function renderRobotLocal(ctx,fighter,st){
    if(!window.__diagSupersample)return renderRobotLocalDirect(ctx,fighter,st);
    const m=ctx.getTransform(),scale=Math.hypot(m.a,m.b),size=Math.ceil(320*scale*2);
    if(!diagRT||diagRT.width!==size){diagRT=document.createElement('canvas');diagRT.width=diagRT.height=size;}
    const g=diagRT.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,size,size);
    g.setTransform(size/320,0,0,size/320,size/2,size/2);
    renderRobotLocalDirect(g,fighter,st);
    ctx.drawImage(diagRT,-160,-160,320,320);
  }
  window.__robotDiag={source:()=>SRC,sprites:()=>SPR,render:renderRobotLocalDirect};
  // World-space: brackets, measure, trail with calibration ticks (authority)`);
const htmlInjected=html.replace('requestAnimationFrame(frame);\n})();',`
window.__htmlDiag={ready:()=>SPR.ready,source:()=>SRC,sprites:()=>SPR,
 set(st){for(const k in R){const v=R[k],o=st.R[k];if(Array.isArray(v))v.forEach((s,i)=>Object.assign(s,o[i]));else Object.assign(v,o);}lockFlash=st.lockFlash;ticks=st.ticks;pulses=st.pulses;stress=st.stress;},
 render(scale,bg){
  const dpr=Math.min(devicePixelRatio,2);cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=bg;ctx.fillRect(0,0,cv.width,cv.height);
  // Unmodified authority ensureRT/renderRig/blitRobot, matched viewport fit.
  ensureRT(HS*scale*dpr*1600/1280);
  const q=rtSize/1600;RTg.setTransform(1,0,0,1,0,0);RTg.clearRect(0,0,rtSize,rtSize);
  RTg.setTransform(q,0,0,q,160*q,200*q);renderRig(RTg);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,innerWidth*dpr/2,innerHeight*dpr/2);
  blitRobot(ctx,R.rootX.x*HSC,R.rootY.x*HSC,RT,1);
  return {dpr,source:1280,segment:SR,renderTarget:rtSize,canvas:[cv.width,cv.height],displayedHeadBox:HS*scale,backingHeadBox:HS*scale*dpr};
 }
};
})();`);
try{
for(const dpr of [1,2]){
 const page=await browser.newPage();await page.setViewport({...metrics.viewport,deviceScaleFactor:dpr});
 page.on('pageerror',e=>metrics.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='warn'&&m.text().includes('robot-presentation'))metrics.errors.push(m.text());});
 await page.evaluateOnNewDocument(()=>{
  window.__contexts=0;const AC=window.AudioContext;window.AudioContext=new Proxy(AC,{construct(T,a){window.__contexts++;return Reflect.construct(T,a);}});
  let seed=20260929;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 });
 await page.setRequestInterception(true);
 page.on('request',r=>r.url().includes('/game/hero-rework/robotPresentationRuntime.js')?r.respond({status:200,contentType:'application/javascript',body:injected}):r.continue());
 await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>window.APEX_ROBOT_PRESENTATION&&window.Fighter);
 await page.evaluate(()=>{
  window.update=()=>{};window.draw=()=>{};
  APEX_HERO_REWORK.setAiEnabled(false);startArsenalQuestMode('ROBOT','ICE');
  const s=APEX_ARSENAL.state;s.slots=[];s.spawnHeld=true;s.spawnTimer=1e6;s.unarmedFastConsumed=true;
  const [a,b]=fighters;a.x=a.y=500;a.baseSpeed=0;b.x=800;b.y=500;b.baseSpeed=0;
  const st=APEX_ROBOT_PRESENTATION.getRobotState(a);st.lastPos={x:500,y:500};
  window.D={a,b,st,ctl:APEX_HERO_REWORK.abilityController(APEX_HERO_REWORK.byCombatant(a)),states:{},
   snapshot(){return JSON.parse(JSON.stringify({R:st.R,POSE:st.POSE,T:st.T,ticks:st.ticks,lockFlash:st.lockFlash,pulses:st.pulses,stress:st.stress,flashes:st.flashes,parts:st.parts,armor:st.armor}));},
   set(state){const o=D.states[state];for(const k in o){if(k==='R'){for(const n in st.R){if(Array.isArray(st.R[n]))st.R[n].forEach((s,i)=>Object.assign(s,o.R[n][i]));else Object.assign(st.R[n],o.R[n]);}}else st[k]=structuredClone(o[k]);}},
   render(state,bg,candidate=false,hide=false){D.set(state);window.__diagSupersample=candidate;
    cameraShake=0;cameraZoom=1;const c=document.getElementById('game-canvas'),g=c.getContext('2d');
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.filter='none';g.clearRect(0,0,c.width,c.height);g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);
    const p=st.parts;if(hide)st.parts=[];a.draw(g);st.parts=p;
   },
   step(n){for(let i=0;i<n;i++)APEX_ARSENAL.step(1/60);}
  };
  D.states.idle=D.snapshot();D.ctl.tryCast('A2','p1');D.step(39);D.states.lock=D.snapshot();
  // Real holder fire → projectile pass → collision → real damage.
  APEX_ARSENAL.weaponApi.equip(b,'PISTOL');
  const hp=a.hp;for(let i=0;i<90&&a.hp===hp;i++)D.step(1);
  if(a.hp===hp)throw Error('No real firearm impact');
  const h=APEX_ARSENAL.weaponApi.getHolder(b);if(h)h.meta.nextShot=100;
  D.step(2);D.states.impact=D.snapshot();
 });
 const rect=await page.$eval('#game-canvas',el=>{const r=el.getBoundingClientRect();const c=getComputedStyle(el);return {x:r.x+parseFloat(c.borderLeftWidth),y:r.y+parseFloat(c.borderTopWidth),width:el.clientWidth,height:el.clientHeight,backingW:el.width,backingH:el.height};});
 const ratio=rect.width/rect.backingW;
 const clip={x:rect.x+500*ratio-160,y:rect.y+500*ratio-160,width:320,height:320};
 const run={dpr,canvas:rect,cssWorldScale:ratio,worldHeadBox:172,displayedHeadBox:172*ratio,gameBackingHeadBox:172,physicalHeadBox:172*ratio*dpr,source:1280,segment:820,candidateB:{renderTarget:640,effectiveBackingMultiplier:2,finalGameBackingUnchanged:true},states:await page.evaluate(()=>D.states)};
 console.log('DPR',dpr,'canvas',rect,'scale',ratio);
 const reference=await browser.newPage();await reference.setViewport({...metrics.viewport,deviceScaleFactor:dpr});
 reference.on('pageerror',e=>metrics.errors.push('HTML: '+e));
 await reference.setContent(htmlInjected,{waitUntil:'load'});await reference.waitForFunction(()=>window.__htmlDiag?.ready());
 await reference.addStyleTag({content:'#tl,#tr,#bar{display:none}'});
 for(const state of ['idle','lock','impact']){
  for(const [bg,color] of [['black','#080a0c'],['gray','#808080'],['white','#f4f4f4']]){
   await page.evaluate(({state,color})=>D.render(state,color),{state,color});
   await page.screenshot({path:`${OUT}/background-matrix/dpr${dpr}-${state}-${bg}.png`,clip});
   if(state==='impact'){
    await page.screenshot({path:`${OUT}/impact-isolation/dpr${dpr}-${bg}-A-normal.png`,clip});
    await page.evaluate(({state,color})=>D.render(state,color,false,true),{state,color});
    await page.screenshot({path:`${OUT}/impact-isolation/dpr${dpr}-${bg}-B-no-world-particles.png`,clip});
   }
   if(bg==='gray'){
    await page.evaluate(({state,color})=>D.render(state,color),{state,color});
    await page.screenshot({path:`${OUT}/sharpness-ab/dpr${dpr}-${state}-A-current.png`,clip});
    await page.evaluate(({state,color})=>D.render(state,color,true),{state,color});
    await page.screenshot({path:`${OUT}/sharpness-ab/dpr${dpr}-${state}-B-2x.png`,clip});
   }
   // Match all spring displacements and local effects exactly; no prototype time drift.
   const hmetrics=await reference.evaluate(({st,ratio,color})=>{__htmlDiag.set(st);return __htmlDiag.render(ratio,color);},{st:run.states[state],ratio,color});
   await reference.screenshot({path:`${OUT}/background-matrix/dpr${dpr}-${state}-${bg}-HTML.png`,clip:{x:560,y:340,width:320,height:320}});
   if(bg==='gray'){
    await reference.screenshot({path:`${OUT}/sharpness-ab/dpr${dpr}-${state}-HTML.png`,clip:{x:560,y:340,width:320,height:320}});
    run.html=hmetrics;
   }
  }
 }
 // Transparent source/segment exports establish ownership of static shards.
 if(dpr===1){
  for(const [name,prefix,p] of [['prod','__robotDiag',page],['html','__htmlDiag',reference]]){
   const imgs=await p.evaluate(prefix=>{const d=window[prefix],s=d.sprites();return {source:d.source().toDataURL(),core:s.core.toDataURL(),calL:s.calL.toDataURL(),back:s.back.toDataURL()};},prefix);
   for(const [key,value]of Object.entries(imgs))save(`edge-crops/${name}-${key}.png`,value);
  }
 }
 // Raster coverage and timings use transparent isolated rig, same 1 world→backing pixel.
 run.raster=await page.evaluate(()=>{
  D.set('idle');const c=document.createElement('canvas');c.width=c.height=320;const g=c.getContext('2d');g.translate(160,160);__robotDiag.render(g,D.a,D.st);
  const p=g.getImageData(0,0,320,320).data;let x0=320,y0=320,x1=0,y1=0;for(let y=0;y<320;y++)for(let x=0;x<320;x++)if(p[(y*320+x)*4+3]>16){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  return {alphaThreshold:16,bounds:[x0,y0,x1+1,y1+1],width:x1-x0+1,height:y1-y0+1};
 });
 metrics.runs.push(run);
 await reference.close();await page.close();
}
assert.equal(metrics.errors.length,0,metrics.errors.join('\n'));
fs.writeFileSync(`${OUT}/sharpness-metrics.json`,JSON.stringify(metrics,null,2));
console.log('Matrix / isolation / matched-size A-B captured. Production unchanged.');
}finally{await browser.close();}
