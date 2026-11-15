// ABBA comparison through the shipping Home -> BOT WAVE path. Timings are
// observations, never hardware-independent FPS gates. Both variants use the
// same built host/shared runtimes; only the two modified game/HUD files differ.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';

const baseline='cccc6acac918e9b5f05891641f9fed2fcc044175';
const readGold=path=>execFileSync('git',['show',baseline+':'+path],{encoding:'utf8',maxBuffer:5000000});
const goldHtml=readGold('public/bot-wave/game.html');
const goldHud=readGold('public/game/bot-wave/botWavePresentationV2.js');
const base=(process.env.APEX_APP_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const output=process.env.APEX_EVIDENCE_DIR||'reports/bot-wave-whole-frame';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
try{
 for(const variant of ['baseline','candidate','candidate','baseline']){
  const context=await browser.createBrowserContext();
  try{
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(String(error)));
   await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
   await page.setRequestInterception(true);
   page.on('request',request=>{
    const path=new URL(request.url()).pathname;
    if(variant==='baseline'&&path==='/bot-wave/game.html')return request.respond({status:200,contentType:'text/html',body:goldHtml});
    if(variant==='baseline'&&path==='/game/bot-wave/botWavePresentationV2.js')return request.respond({status:200,contentType:'text/javascript',body:goldHud});
    return request.continue();
   });
   await page.goto(base+'/?goldViewport=native',{waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
   await page.waitForSelector('#botWaveEntry',{visible:true});await page.click('#botWaveEntry');
   let frame;
   for(let i=0;i<450;i++){
    frame=page.frames().find(f=>f.url().includes('/bot-wave/game.html'));
    if(frame&&await frame.evaluate(()=>!!window.APEX_BOT_WAVE_INTERFACE_V2&&!!document.getElementById('w-go')).catch(()=>false))break;
    await sleep(100);
   }
   assert.ok(frame,'Gold iframe must load');
   await page.waitForFunction(()=>!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
   await frame.waitForSelector('#w-go',{visible:true});await frame.click('#w-go');
   // Explicit survival fixture in both variants prevents early defeat. Native
   // AI, render, clocks, physics, resolution and effects continue unchanged.
   await frame.evaluate(()=>window.handLab.player.invulnT=100000);
   await sleep(2500);
   await frame.evaluate(()=>{
    window.__wholeFrame={gaps:[],costs:[]};
    const engine=window.handLab,original=engine.render;let last=0;
    engine.render=function(){
     const now=performance.now();if(last)window.__wholeFrame.gaps.push(now-last);last=now;
     try{return original.apply(this,arguments);}
     finally{window.__wholeFrame.costs.push(performance.now()-now);}
    };
   });
   const before=await frame.evaluate(()=>({x:handLab.player.x,y:handLab.player.y,time:handLab.time}));
   await page.keyboard.down('w');await sleep(750);await page.keyboard.up('w');
   const after=await frame.evaluate(()=>({x:handLab.player.x,y:handLab.player.y,time:handLab.time}));
   await sleep(3000);
   const sample=await frame.evaluate(()=>{
    const q=(v,p)=>[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(v.length*p))];
    const {gaps,costs}=window.__wholeFrame;
    return {samples:gaps.length,gapMedianMs:q(gaps,.5),gapP95Ms:q(gaps,.95),renderP95Ms:q(costs,.95),
     activeBots:window.APEX_WAVE_PERF.snapshot().livingBots,userAgent:navigator.userAgent};
   });
   sample.movementPx=Math.hypot(after.x-before.x,after.y-before.y);
   sample.gameClockAdvanced=after.time-before.time;
   assert.ok(sample.samples>10&&sample.movementPx>8&&sample.gameClockAdvanced>0,'Live movement and frame samples required');
   assert.deepEqual(errors,[],'Uncaught browser errors');
   results.push({variant,...sample});
   console.log('BOT WAVE ABBA',JSON.stringify(results.at(-1)));
  }finally{await context.close();}
 }
 fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(output+'/comparison.json',JSON.stringify({baseline,
  protocol:'Home entry; isolated contexts; baseline/candidate/candidate/baseline; 2.5s settling then 3.75s measurement including 750ms W; no pixel readback in window.',
  limitation:'Early-wave desktop observation on one host, not a later-wave stress test, physical-phone result or stable universal speedup. Report all rounds; GPU/compositor/host load varies.',results},null,2)+'\n');
}finally{await browser.close();}
