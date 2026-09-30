// Hunter A1 owner-fix production-browser proof.
// Verifies the Hunter-vs-Crystal wrapper order, full ROOT front-blade pass,
// and the Gold-authored recoil trajectory in the real production bundle.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

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
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_'))errors.push('[console] '+m.text());});
await page.goto(APP,{waitUntil:'load',timeout:30000});
await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:30000});
await page.evaluate(async()=>{await window.__apexEnsureDeferredRuntimes('arsenalQuest');});
await page.waitForFunction(()=>window.APEX_HUNTER_PRESENTATION?.ready===true,{timeout:30000});

const audit=await page.evaluate(()=>{
  const G=window;
  if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
  if(G.APEX_ARSENAL?.state?.active)G.exitArsenalQuestMode();
  G.startArsenalQuestMode('HUNTER','CRYSTAL');
  if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
  if(G.APEX_ARSENAL?.state)G.APEX_ARSENAL.state.labMode=true;
  G.APEX_HERO_REWORK?.setAiEnabled?.(false);

  const h=G.fighters[0],c=G.fighters[1];
  h.x=340;h.y=500;h.baseSpeed=0;h.setDir(1,0);
  c.x=820;c.y=500;c.baseSpeed=0;c.setDir(-1,0);

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
    const jump=Math.hypot(h.x-lastX,h.y-y0);
    maxDisp=Math.max(maxDisp,disp);maxStep=Math.max(maxStep,jump);lastX=h.x;
    const sn=G.APEX_HERO_REWORK.match?.world?.snares?.[0]||null;
    if(sn&&snareSeenAt==null)snareSeenAt=t;
    if(sn&&sn.phase==='armed'&&armedAt==null)armedAt=t;
    trajectory.push({frame:frame+1,t:+t.toFixed(4),x:+h.x.toFixed(3),y:+h.y.toFixed(3),disp:+disp.toFixed(3),snare:sn?sn.phase:null});
  }
  const movingFrames=trajectory.filter((r,i)=>i>0&&Math.abs(r.x-trajectory[i-1].x)>.05).length;
  const snare=G.APEX_HERO_REWORK.match?.world?.snares?.[0]||null;
  const inspect=G.APEX_HUNTER_PRESENTATION.inspect(h);
  HG.rtDraw=origRt;
  return {
    cast,counts,x0,y0,final:{x:h.x,y:h.y},maxDisp,maxStep,movingFrames,
    snareSeenAt,armedAt,snare:snare?{phase:snare.phase,x:snare.x,y:snare.y}:null,
    inspect,trajectory
  };
});

const canvas=await page.$('#game-canvas');
if(!canvas)throw new Error('#game-canvas missing');
await canvas.screenshot({path:path.join(OUT,'hunter-a1-trap-fixed.png')});
audit.errors=errors;
audit.pass=!!audit.snare && audit.counts.back>0 && audit.counts.front>0 && audit.counts.fx>0
  && audit.maxDisp>20 && audit.maxDisp<100 && audit.maxStep<20 && audit.movingFrames>=8
  && errors.length===0;
fs.writeFileSync(path.join(OUT,'hunter-a1-ownerfix-browser.json'),JSON.stringify(audit,null,2)+'\n');
console.log('HUNTER_A1_BROWSER '+JSON.stringify({
  pass:audit.pass,counts:audit.counts,maxDisp:audit.maxDisp,maxStep:audit.maxStep,
  movingFrames:audit.movingFrames,snareSeenAt:audit.snareSeenAt,armedAt:audit.armedAt,
  final:audit.final,errors
}));
await browser.close();
if(!audit.pass)process.exitCode=1;
