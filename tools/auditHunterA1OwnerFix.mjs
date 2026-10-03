// Hunter A1 owner-fix production-browser proof.
// Verifies the Hunter-vs-Crystal wrapper order, full ROOT front-blade pass,
// and the Gold-authored recoil trajectory in the real production bundle.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';

const APP=process.env.APEX_APP_URL||'http://127.0.0.1:4173';
const CHROME=process.env.CHROME_PATH;
if(!CHROME) throw new Error('CHROME_PATH required');
const OUT=path.resolve('docs/hero-rework/hunter-v1.1/evidence-ownerfix');
fs.mkdirSync(OUT,{recursive:true});

const browser=await puppeteer.launch({
  executablePath:CHROME,
  args:['--headless=new','--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--window-size=1440,1080'],
  headless:true,defaultViewport:{width:1440,height:1080}
});
const goldPage=await browser.newPage();
await goldPage.setViewport({width:1440,height:1000});
const goldPath=path.resolve('docs/hero-rework/hunter-v1.1/reference/HUNTER_GOLD_V10_EXACT_ROOT_TRAP.html');
await goldPage.goto(pathToFileURL(goldPath).href,{waitUntil:'load',timeout:60000});
await goldPage.waitForFunction(()=>window.__hunterStage?.ready===true,{timeout:60000});
const gold=await goldPage.evaluate(async()=>{
  // Isolated exact 60 Hz Gold Stage: no RAF cadence, no production bridge.
  const Ctor=window.__hunterStage.constructor;
  const cv=document.createElement('canvas');cv.width=1200;cv.height=760;
  const st=new Ctor(cv);st.auto=false;st.slowmo=false;st.closeUp=false;
  await st.init();st.reset();st.startA1();
  const rows=[];
  for(let n=0;n<180;n++){
    st.step(1/60);
    rows.push({frame:n+1,t:+st.h.t.toFixed(5),x:+st.h.px.toFixed(4),mode:st.h.mode,phase:st.h.phase,timeScale:+st.timeScale.toFixed(5),trap:st.tr.phase});
    if(st.h.mode==='idle'&&n>10)break;
  }
  const x0=340;
  const steps=rows.slice(1).map((r,i)=>Math.abs(r.x-rows[i].x));
  const moving=steps.filter(v=>v>.05);
  return {
    rows,
    x0,
    finalX:rows.at(-1)?.x,
    maxDisp:Math.max(...rows.map(r=>Math.abs(r.x-x0))),
    maxStep:Math.max(0,...steps),
    movingFrames:moving.length,
    realtimeFrames:rows.length
  };
});
console.log('HUNTER_GOLD_A1_TRAJECTORY '+JSON.stringify({
  maxDisp:gold.maxDisp,maxStep:gold.maxStep,movingFrames:gold.movingFrames,realtimeFrames:gold.realtimeFrames,
  sample:gold.rows.filter((_,i)=>i<8||i%4===0||i>=gold.rows.length-8)
}));
await goldPage.close();

const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_'))errors.push('[console] '+m.text());});
await page.goto(APP,{waitUntil:'load',timeout:30000});
await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:30000});
await page.evaluate(async()=>{await window.__apexEnsureDeferredRuntimes('arsenalProduct');window.__APEX_TEST_MODE=true;});
await page.waitForFunction(()=>window.APEX_HUNTER_PRESENTATION?.ready===true,{timeout:30000});

const audit=await page.evaluate(()=>{
  const G=window;
  if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
  if(G.APEX_ARSENAL?.state?.active)G.exitArsenalBattleMode();
  G.startArsenalBattleMode('HUNTER','CRYSTAL',{testFixture:true});
  if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
  if(G.APEX_ARSENAL?.state)G.APEX_ARSENAL.state.labMode=true;
  G.APEX_HERO_REWORK?.setAiEnabled?.(false);

  const h=G.fighters[0],c=G.fighters[1];
  h.x=650;h.y=500;h.px=650;h.py=500;h.baseSpeed=0;h.setDir(1,0);
  c.x=900;c.y=180;c.px=900;c.py=180;c.baseSpeed=0;c.setDir(0,1);

  const counts={back:0,front:0,fx:0};
  const HG=G.APEX_HUNTER_GOLD;
  const origRt=HG.rtDraw;
  HG.rtDraw=function(st,ctx,V,layer){if(layer in counts)counts[layer]++;return origRt.apply(this,arguments);};

  for(let i=0;i<3;i++){G.APEX_ARSENAL.step(1/60);G.draw();}
  counts.back=counts.front=counts.fx=0;

  const x0=h.x,y0=h.y;
  const cast=G.APEX_HERO_REWORK.pressAbility(h,'A1');
  const trajectory=[];
  let snareSeenAt=null,armedAt=null,maxDisp=0,maxStep=0,lastX=h.x;
  for(let frame=0;frame<80;frame++){
    G.APEX_ARSENAL.step(1/60);
    G.draw();
    const t=(frame+1)/60;
    const disp=Math.hypot(h.x-x0,h.y-y0);
    const jump=Math.abs(h.x-lastX);
    maxDisp=Math.max(maxDisp,disp);maxStep=Math.max(maxStep,jump);lastX=h.x;
    const sn=G.APEX_HERO_REWORK.match?.world?.snares?.[0]||null;
    if(sn&&snareSeenAt==null)snareSeenAt=t;
    if(sn&&sn.phase==='armed'&&armedAt==null)armedAt=t;
    const pi=G.APEX_HUNTER_PRESENTATION.inspect(h);
    trajectory.push({frame:frame+1,t:+t.toFixed(4),x:+h.x.toFixed(3),y:+h.y.toFixed(3),disp:+disp.toFixed(3),
      goldOffset:+(pi.a1?.offset||0).toFixed(3),goldT:+(pi.a1?.goldT||0).toFixed(4),refX:+(pi.a1?.refX||340).toFixed(3),snare:sn?sn.phase:null});
  }
  const movingFrames=trajectory.filter((r,i)=>i>0&&Math.abs(r.x-trajectory[i-1].x)>.05).length;
  const snare=G.APEX_HERO_REWORK.match?.world?.snares?.[0]||null;
  const inspect=G.APEX_HUNTER_PRESENTATION.inspect(h);
  const maxMapError=Math.max(0,...trajectory.map(r=>Math.abs((x0-r.x)-r.goldOffset)));
  const blades=['blade0','blade1','blade2'].map(k=>({key:k,color:!!snare?.visual?._rtImgs?.[k]?.color,shadow:!!snare?.visual?._rtImgs?.[k]?.shadow}));
  HG.rtDraw=origRt;
  return {
    cast,counts,x0,y0,final:{x:h.x,y:h.y},maxDisp,maxStep,movingFrames,maxMapError,blades,
    snareSeenAt,armedAt,snare:snare?{phase:snare.phase,x:snare.x,y:snare.y}:null,
    inspect,trajectory
  };
});

audit.gold=gold;
const canvas=await page.$('#game-canvas');
if(!canvas)throw new Error('#game-canvas missing');
await canvas.screenshot({path:path.join(OUT,'hunter-a1-trap-fixed.png')});
audit.errors=errors;
const prodScale=audit.inspect?.scale||1;
const goldScaled={maxDisp:gold.maxDisp*prodScale,maxStep:gold.maxStep*prodScale,finalDisp:Math.abs(gold.x0-gold.finalX)*prodScale};
const goldTol=Math.max(3,goldScaled.maxDisp*0.08);
audit.goldScaled=goldScaled;
audit.goldDelta={
  maxDisp:Math.abs(audit.maxDisp-goldScaled.maxDisp),
  maxStep:Math.abs(audit.maxStep-goldScaled.maxStep),
  finalDisp:Math.abs(Math.abs(audit.x0-audit.final.x)-goldScaled.finalDisp),
  movingFrames:Math.abs(audit.movingFrames-gold.movingFrames)
};
audit.pass=!!audit.snare && audit.counts.back>0 && audit.counts.front>0 && audit.counts.fx>0
  && audit.blades.every(b=>b.color&&b.shadow)
  && audit.goldDelta.maxDisp<=goldTol
  && audit.goldDelta.maxStep<=Math.max(4,goldScaled.maxStep*0.14)
  && audit.goldDelta.finalDisp<=Math.max(4,goldScaled.finalDisp*0.08)
  // OWNER PLAYTEST 2026-09-30: recoil amplitude/step stays Gold-exact, but the
  // final RECOVER standstill is intentionally cut at h.t=.62. Browser proof
  // must therefore show materially fewer motion-locked frames than raw Gold.
  && audit.goldDelta.movingFrames>=5 && audit.goldDelta.movingFrames<=14
  && audit.maxMapError<0.25
  && errors.length===0;
fs.writeFileSync(path.join(OUT,'hunter-a1-ownerfix-browser.json'),JSON.stringify(audit,null,2)+'\n');
console.log('HUNTER_A1_BROWSER '+JSON.stringify({
  pass:audit.pass,counts:audit.counts,maxDisp:audit.maxDisp,maxStep:audit.maxStep,
  movingFrames:audit.movingFrames,maxMapError:audit.maxMapError,blades:audit.blades,
  gold:{maxDisp:gold.maxDisp,maxStep:gold.maxStep,movingFrames:gold.movingFrames,realtimeFrames:gold.realtimeFrames},goldScaled:audit.goldScaled,goldDelta:audit.goldDelta,
  snareSeenAt:audit.snareSeenAt,armedAt:audit.armedAt,
  final:audit.final,errors
}));
await browser.close();
if(!audit.pass)process.exitCode=1;
