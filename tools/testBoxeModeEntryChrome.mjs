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
 const errors=[],consoleIssues=[];
 page.on('pageerror',e=>errors.push(String(e?.stack||e)));
 page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')
   consoleIssues.push('['+msg.type()+'] '+msg.text());});
 try{
  await page.setViewport({width:view.width,height:view.height,
   isMobile:view.name!=='desktop',hasTouch:view.name!=='desktop'});
  await page.goto(url+'/?goldViewport=native',{waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
  await page.click('#apex-boot-start');
  await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
  // Independent special-mode icon is visible on HOME; never appear as a
  // third Free Battle card or require a visit to MODE SELECT.
  await page.waitForSelector('#botWaveEntry',{timeout:30000});
  await page.waitForFunction(()=>{
    const el=document.getElementById('botWaveEntry'),stage=document.getElementById('stage');
    if(!el||!stage?.querySelector('.routes')?.contains(el))return false;
    if(document.querySelector('#modeSelectScreen #botWaveEntry'))return false;
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return r.width>18&&r.height>18&&s.display!=='none'&&s.visibility!=='hidden';
  },{timeout:20000});
  await page.screenshot({path:path.join(output,view.name+'-home-special-icon.png')});
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
   // Owner Gold intentionally starts paused with ZERO enemies. A real
   // authenticated START WAVE click is required before asserting gameplay;
   // skipping this user gesture causes false Chrome timeouts and muted audio.
   const gameFrame=page.frames().find(f=>f.url().includes('/bot-wave/game.html'));
   assert.ok(gameFrame,'Gold playable frame never loaded');
   await gameFrame.waitForSelector('#w-go',{visible:true,timeout:18000}).catch(async error=>{
    const diag=await gameFrame.evaluate(()=>({
      title:document.title,
      ready:document.readyState,
      bodySize:document.body?.innerHTML?.length,
      hasGold:!!window.handLab,
      hasWavePilot:!!window.BOXE_WAVE_PILOT,
      hasWaveCampaign:!!window.APEX_BOT_WAVE_CAMPAIGN,
      hasConfig:!!window.APEX_ARSENAL_CONFIG,
      hasArmory:!!window.APEX_BOT_WAVE_ARMORY,
      hasGo:!!document.querySelector('#w-go'),
      scriptErrors:[...document.querySelectorAll('script[src]')].map(x=>x.src),
    }));
    throw Error('WAVE_GAME_NOT_BOOTED '+JSON.stringify({diag,errors,consoleIssues},null,2)+'\n'+error);
   });
   await gameFrame.click('#w-go');
   await page.waitForFunction(()=>{
     const frame=document.querySelector('#wave')?.contentWindow;
     const game=frame?.handLab;
     return !!(game?.player&&Array.isArray(game?.enemies)&&game.enemies.some(e=>!e.dead)
       && !game.paused);
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
    return {path,ok:response.ok,correctMime:/\.(?:png|webp)$/.test(path)?mime.includes('image/'):
      (mime.includes('audio/')||mime.includes('mpeg')||mime.includes('ogg'))};
   })),refs);
   assert.ok(checks.every(x=>x.ok&&x.correctMime),'Arsenal gun/sound delivery error '+JSON.stringify(checks.filter(x=>!x.ok||!x.correctMime)));
   await page.screenshot({path:path.join(output,view.name+'-wave-playable.png')});
   // Integration proof, not a roster-only unit assertion: the live Gold
   // engine must accept wave 11 AND wave 32 without a "chapter complete".
   const milestones=await gameFrame.evaluate(()=>{
    const pilot=window.BOXE_WAVE_PILOT,engine=window.handLab;
    const result=[];
    for(const n of [11,32]){
     const composition=pilot.planWave(n);
     pilot.state.wave=n-1;
     pilot.state.phase='intermission';
     pilot.state.queue.length=0;
     engine.enemies.length=0;
     pilot.testStartWave();
     if(pilot.state.wave!==n||pilot.state.phase!=='combat'||
       pilot.state.queue.length!==composition.plan.composition.length)
       throw Error('LIVE_WAVE_CAP_OR_SPAWN_PLAN_'+n);
     result.push({wave:pilot.state.wave,
      queue:pilot.state.queue.length,
      revealed:composition.plan.revealedWeapons,
      boss:composition.plan.boss});
    }
    return result;
   });
   assert.deepEqual(milestones.map(m=>m.wave),[11,32]);
   assert.equal(milestones[1].revealed,41,'Chapter 7 must expose all native equipment');
   console.log('BOT WAVE live Gold unlimited progression PASS',view.name,milestones);
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
