import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {botWaveShippingAssetRefs} from './botWaveShippingAssetRefs.mjs';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,
 args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
const output='docs/boxe/r5-browser';
fs.mkdirSync(output,{recursive:true});
const url=(process.env.APEX_APP_URL||'http://127.0.0.1:4173/').replace(/\/$/,'');
for(const view of [{name:'desktop',width:1440,height:900},{name:'landscape-phone',width:844,height:390}]){
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setViewport({width:view.width,height:view.height,
   isMobile:view.name!=='desktop',hasTouch:view.name!=='desktop'});
  await page.goto(url+'/?goldViewport=native',{waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
  await page.click('#apex-boot-start');
  await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
  await page.waitForSelector('#botWaveEntry',{timeout:30000});
  // The legitimate product control must be mounted WITHOUT mutating the
  // Gold shell source (CP16 checks the immutable bytes).
  await page.$eval('#freeBattle',el=>el.click());
  await page.waitForSelector('#modeSelectScreen[aria-hidden="false"]',{timeout:15000}).catch(()=>{});
  await page.waitForFunction(()=>{
    const el=document.getElementById('botWaveEntry');
    if(!el)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return r.width>100&&r.height>35&&s.display!=='none'&&s.visibility!=='hidden';
  },{timeout:20000});
  await page.screenshot({path:path.join(output,view.name+'-mode-entry.png')});
  await page.$eval('#botWaveEntry',el=>el.click());
  await page.waitForFunction(()=>location.pathname==='/bot-wave/index.html',{timeout:30000});
  await page.waitForSelector('#wave',{timeout:10000});
  const status=await page.evaluate(()=>({
   pathname:location.pathname,
   hasFullFrame:document.querySelector('#wave')!==null,
   hasHome:document.querySelector('#return')!==null,
   assetNotice:document.querySelector('#info')?.textContent||''
  }));
  assert.equal(status.pathname,'/bot-wave/index.html');
  assert.equal(status.hasFullFrame,true);
  assert.equal(status.hasHome,true);
  if(fs.existsSync('public/bot-wave/game.html')){
   // Post-import gate: this must be a PLAYABLE iframe, not just a successful
   // navigation into the fail-closed pending-Gold wrapper.
   await page.waitForFunction(()=>{
     const f=document.querySelector('#wave');
     return !!f&&!f.hidden&&document.querySelector('#status')?.classList.contains('hidden');
   },{timeout:60000});
   await page.waitForFunction(()=>{
     const frame=document.querySelector('#wave')?.contentWindow;
     const game=frame?.handLab;
     return !!(game?.player&&Array.isArray(game?.enemies)&&game.enemies.some(e=>!e.dead));
   },{timeout:60000});
   const waveRuntime=await page.evaluate(()=>{
     const w=document.querySelector('#wave').contentWindow;
     const player=w.handLab.player,enemies=w.handLab.enemies;
     return {playerHP:player.hp,enemyCount:enemies.filter(e=>!e.dead).length,
      width:w.innerWidth,height:w.innerHeight,gameCanvas:!!w.document.getElementById('arena')};
   });
   assert.ok(waveRuntime.playerHP>0&&waveRuntime.enemyCount>=1);
   assert.equal(waveRuntime.gameCanvas,true);
   // Explicit real HTTP fetch proof: no sprite/audio is accidentally
   // discarded by shipping-prune or silently replaced by SPA HTML fallback.
   const refs=botWaveShippingAssetRefs(fs.readFileSync('public/bot-wave/game.html','utf8'));
   const checks=await page.evaluate(async paths=>Promise.all(paths.map(async path=>{
    const response=await fetch(path,{method:'HEAD'});
    const mime=response.headers.get('content-type')||'';
    return {path,ok:response.ok,correctMime:path.endsWith('.png')?mime.includes('image/'):
      (mime.includes('audio/')||mime.includes('mpeg')||mime.includes('ogg'))};
   })),refs);
   assert.ok(checks.every(x=>x.ok&&x.correctMime),'Arsenal gun/sound delivery error '+JSON.stringify(checks.filter(x=>!x.ok||!x.correctMime)));
   await page.screenshot({path:path.join(output,view.name+'-wave-playable.png')});
   console.log('BOXE R5 integrated Gold GAMEPLAY + sprites/SFX PASS',view.name,waveRuntime,checks.length);
  }else{
   // Staging-only: explicitly report the binary gap; do not claim playability.
   await page.waitForFunction(()=>document.querySelector('#info')?.textContent?.includes('not installed'),{timeout:20000});
   assert.ok(status.hasFullFrame,'wrapper missing even without Gold');
   console.log('BOXE R5 route STAGED (Gold binary not yet imported)',view.name);
  }
  assert.deepEqual(errors,[],'Browser errors '+JSON.stringify(errors));
  console.log('BOXE R5 mode launch PASS',view.name,status);
 }finally{await page.close();}
}
await browser.close();
