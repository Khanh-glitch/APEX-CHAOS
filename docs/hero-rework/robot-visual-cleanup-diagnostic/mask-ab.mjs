import {execFileSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import puppeteer from 'puppeteer-core';import chromium from '@sparticuz/chromium';
process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||'');
const OUT='docs/hero-rework/robot-visual-cleanup-diagnostic';
const source=execFileSync('git',['show','bdf29a75770e2013e08bd2b005b8c4eae371b229:public/game/hero-rework/robotPresentationRuntime.js'],{encoding:'utf8'});
// Mask-only prototype: extend coverage six head units (12-unit stroke),
// composite once; do not thicken the source artwork. Restore via saved SPR.
const injected=source.replace('    SPR: () => SPR,',`    SPR: () => SPR,
 diagnosticMask(padding){
   const original=SPR;
   const mask=pts=>{const c=mkCanvas(SR),g=c.getContext('2d');g.scale(SR/1280,SR/1280);g.beginPath();poly(g,pts);g.fill();g.lineWidth=padding*2;g.lineJoin='round';g.stroke();return c;};
   const left=mask(M.calL),right=mask(M.calR);
   function piece(inc,exc){const c=mkCanvas(SR),g=c.getContext('2d');g.drawImage(SRC,0,0,SR,SR);if(inc){g.globalCompositeOperation='destination-in';g.drawImage(inc,0,0);}g.globalCompositeOperation='destination-out';for(const m of exc)g.drawImage(m,0,0);return c;}
   const cheekL=mask0(M.cheekL),cheekR=mask0(M.cheekR),chin=mask0(M.chin),crest=mask0(M.crest);
   function mask0(pts){const c=mkCanvas(SR),g=c.getContext('2d');g.scale(SR/1280,SR/1280);g.beginPath();poly(g,pts);g.fill();return c;}
   SPR={...SPR,calL:piece(left,[cheekL]),calR:piece(right,[cheekR]),core:piece(null,[left,right,cheekL,cheekR,chin,crest])};
   const back=mkCanvas(SR),bg=back.getContext('2d');bg.scale(SR/1280,SR/1280);bg.beginPath();poly(bg,HULL);bg.clip();bg.drawImage(original.back,0,0,1280,1280);SPR.back=back;
   return ()=>{SPR=original;};
 },`);
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
try{
const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
await page.setRequestInterception(true);page.on('request',r=>r.url().includes('/game/hero-rework/robotPresentationRuntime.js')?r.respond({status:200,contentType:'application/javascript',body:injected}):r.continue());
await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.APEX_ROBOT_PRESENTATION);
const states=JSON.parse(fs.readFileSync(`${OUT}/sharpness-metrics.json`)).runs[0].states;
await page.evaluate(states=>{
 window.update=()=>{};window.draw=()=>{};APEX_HERO_REWORK.setAiEnabled(false);startArsenalQuestMode('ROBOT','ICE');fighters[0].x=fighters[0].y=500;
 window.renderMask=(name,padding)=>{
  const a=fighters[0],st=APEX_ROBOT_PRESENTATION.getRobotState(a),o=states[name];
  for(const k in o){if(k==='R'){for(const n in st.R){if(Array.isArray(st.R[n]))st.R[n].forEach((s,i)=>Object.assign(s,o.R[n][i]));else Object.assign(st.R[n],o.R[n]);}}else st[k]=structuredClone(o[k]);}
  const reset=padding?APEX_ROBOT_PRESENTATION.diagnosticMask(padding):null;
  const c=document.getElementById('game-canvas'),g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.width,c.height);g.fillStyle='#f4f4f4';g.fillRect(0,0,c.width,c.height);a.draw(g);
  const spr=APEX_ROBOT_PRESENTATION.SPR();const core=spr.core.toDataURL();if(reset)reset();return core;
 };
},states);
const clip=await page.$eval('#game-canvas',el=>{const r=el.getBoundingClientRect(),b=parseFloat(getComputedStyle(el).borderLeftWidth),sc=el.clientWidth/el.width;return{x:r.x+b+500*sc-160,y:r.y+b+500*sc-160,width:320,height:320};});
for(const state of ['idle','lock','impact'])for(const pad of [0,6,12]){
const core=await page.evaluate(({state,pad})=>renderMask(state,pad),{state,pad});
await page.screenshot({path:`${OUT}/edge-crops/mask-test-${state}-pad${pad}.png`,clip});
if(state==='lock'&&pad)fs.writeFileSync(`${OUT}/edge-crops/mask-test-core-pad${pad}.png`,Buffer.from(core.split(',')[1],'base64'));
}
}finally{await browser.close();}
