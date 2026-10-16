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
    if(!el||el.parentElement!==stage)return false;
    if(stage.querySelector('.routes')?.contains(el))return false;
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
     return !!f&&!f.hidden&&(!document.querySelector('#status') || document.querySelector('#status')?.classList.contains('hidden'));
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
   // Owner reject R2 admission: prove entirely new structural HUD and
   // artwork-led chapter modal, not just a cosmetic CSS over old Gold rectangles.
   await gameFrame.waitForSelector('#bw-interface-v2',{visible:true,timeout:20000}).catch(async e=>{
      const snapshot=await gameFrame.evaluate(()=>({
        app:document.readyState,
        GoldHud:!!document.getElementById('wave-hud'),
        GoldStage:!!document.getElementById('arena-experience-hud'),
        script:[...document.querySelectorAll('script[src]')].map(s=>s.src),
        presentation:window.APEX_BOT_WAVE_INTERFACE_V2||null,
        hero:!!document.querySelector('#wave-hud .w-left'),
        controls:!!document.querySelector('#wave-hud .w-actions'),
        dialog:!!document.querySelector('#wave-modal .w-dialog'),
        stylesheet:!!document.querySelector('#bw-v2-styles'),
        standalone:!!document.querySelector('#bw-interface-v2'),
      }));
      throw Error('BOT_WAVE_REJECT_HUD_FAILED '+JSON.stringify({snapshot,errors,consoleIssues})+' '+e);
   });
   await gameFrame.waitForSelector('.bw-cover-art',{timeout:20000});
   const interfaceRead=await gameFrame.evaluate(()=>({
     standalone:document.querySelector('#wave-hud .bw-command-deck')?.id==='bw-interface-v2',
     hero:!!document.querySelector('.bw-hero .bw-portrait'),
     fiveBeats:document.querySelectorAll('#bw-beat-markers i').length,
     modalArt:!!document.querySelector('.w-dialog > .bw-cover img'),
     controls:document.querySelectorAll('.bw-skill-deck .w-action').length,
     debugHidden:!document.getElementById('arena-experience-tools')||getComputedStyle(document.getElementById('arena-experience-tools')).display==='none',
   }));
   assert.ok(interfaceRead.standalone&&interfaceRead.hero&&interfaceRead.modalArt&&interfaceRead.debugHidden
       &&interfaceRead.fiveBeats===5&&interfaceRead.controls===5,
      'Owner Gold HUD not rebuilt '+JSON.stringify(interfaceRead));
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
   // Restore-fidelity owner gate: source Gold art, source R2 industrial circular
   // stage, postprocess and BOTH sampled SFX banks must render in a live browser.
   await gameFrame.waitForFunction(()=>{
     const gold=window.BOXE_SFX?.getStats?.();
     const accents=window.BOXE_FINAL_SFX;
     const base=window.BOXE_ARENA_EXPERIENCE?.stage?.base;
     return !!(gold?.ready&&gold.loaded===gold.total&&gold.total>=33
       &&accents?.ready&&accents.buffers?.size===9
       &&base?.width===2200&&base?.height===2200);
   },{timeout:40000});
   const ownerGold=await gameFrame.evaluate(()=>{
     const gold=window.BOXE_SFX.getStats();
     const final=window.BOXE_FINAL_SFX;
     const stage=window.BOXE_ARENA_EXPERIENCE.stage;
     const engine=window.handLab;
     return {sfx:{loaded:gold.loaded,total:gold.total,ready:gold.ready,
       recent:gold.recent.length},final:{ready:final.ready,count:final.buffers.size},
       arena:{radius:stage.radius,playable:stage.playable,baseWidth:stage.base.width,
         renderer:engine.drawArena.toString().includes('ARENA_STAGE.draw'),
         goldFire:!!engine.fire,goldLightning:!!engine.lightning,
         post:!!engine.post,goldMaterial:!!engine.material},
       hitFx:!!window.BOXE_R2_PRESENTATION?.enabled,
       stageHud:!!document.getElementById('arena-experience-hud')};
   });
   assert.equal(ownerGold.arena.radius,920);
   assert.equal(ownerGold.arena.playable,880);
   assert.ok(ownerGold.arena.renderer&&ownerGold.arena.goldFire
     &&ownerGold.arena.goldLightning&&ownerGold.arena.post
     &&ownerGold.arena.goldMaterial&&ownerGold.hitFx&&ownerGold.stageHud,
     'Owner Gold arena/VFX not fully active '+JSON.stringify(ownerGold));
   console.log('OWNER GOLD exact 920 arena + 33 SFX + 9 Final + R2 VFX PASS',
     view.name,ownerGold);
   // Real engine receipts, not 41 catalog aliases or hand-drawn tracers.
   // Fire six representative weapon families directly through Free Battle's
   // original weapon holder, against the Gold BOXE actor in a live iframe.
   const weaponReceipts=await gameFrame.evaluate(()=>{
     const api=window.APEX_ARSENAL?.weaponApi;
     const registry=window.APEX_ARSENAL_WEAPONS;
     const pool=window.projectiles;
     const player=window.handLab?.player;
     if(!api||!registry||!Array.isArray(pool)||!player)
       throw Error('FREE_BATTLE_WEAPON_API_ABSENT');
     const ids=['PISTOL','SMG','SHOTGUN','SNIPER','RPG_7','PLASMA_SPLITTER'];
     const captured=[];
     for(const id of ids){
       const e={id:'qa-native-'+id,name:'BOT WAVE QA',color:'#ffb85b',
         hp:1000,radius:30,data:{},dir:{x:-1,y:0},
         x:player.x+1120,y:player.y+1000,
         takeDamage(){},applyStatus(){}};
       const old=pool.length;
       if(!api.equip(e,id))throw Error('NATIVE_EQUIP_FAILED_'+id);
       for(let i=0;i<235;i++)api.updateHolder(e,.016);
       const emitted=pool.slice(old).filter(p=>p?.aq&&p.owner===e&&p.weapon===id);
       if(!emitted.length)throw Error('NATIVE_SHOT_ABSENT_'+id);
       for(const p of emitted){
         if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.life))
           throw Error('NATIVE_INVALID_PROJECTILE_'+id);
       }
       captured.push({id,projectiles:emitted.length,
         carriers:[...new Set(emitted.map(p=>p.type))]});
       pool.splice(old);
     }
     return {weapons:captured,executorCount:Object.keys(registry).length,
       audioDecoded:window.APEX_ARSENAL_AV?.stats?.audioLoaded||0,
       soundEvents:window.APEX_ARSENAL_AV?.stats?.cued?.length||0};
   });
   assert.equal(weaponReceipts.weapons.length,6);
   assert.ok(weaponReceipts.weapons.every(x=>x.projectiles>0),
     'Native Arsenal projectile parity failed '+JSON.stringify(weaponReceipts));
   console.log('BOT WAVE live Free Battle native projectile receipts PASS',
     view.name,weaponReceipts);
   // 41 actual native holders, not merely IDs in campaign metadata. One
   // representative shot test above also pins exact pellet/ammo evidence.
   const fullArsenal=await gameFrame.evaluate(()=>{
     const cfg=window.APEX_ARSENAL_CONFIG;
     const records=window.APEX_BOT_WAVE_CAMPAIGN.indexNative(cfg).records;
     const api=window.APEX_ARSENAL.weaponApi,pool=window.projectiles;
     const p=window.handLab.player,proxy=window.fighters[0];
     const prevHit=proxy.takeDamage,prevStatus=proxy.applyStatus;
     let hitAttempts=0;
     proxy.takeDamage=()=>{hitAttempts++};
     proxy.applyStatus=()=>{};
     const results=[];
     try{
       for(const {id,family} of records){
         const bot={id:'native-full-'+id,name:'NATIVE-WAVE-TEST',color:'#ffbb7d',
           x:p.x+1120,y:p.y+1000,dir:{x:-1,y:0},hp:10000,radius:30,
           data:{},takeDamage(){},applyStatus(){}};
         const was=pool.length,hitBefore=hitAttempts;
         if(!api.equip(bot,id))throw Error('NATIVE_41_EQUIP_DENIED_'+id);
         const activatedGuard=api.getHolder(bot)?.phase==='GUARD';
         if(family!=='SHIELD'){
           try{for(let k=0;k<230;k++)api.updateHolder(bot,.016)}
           catch(e){throw Error('NATIVE_41_EXECUTOR_ERROR_'+id+': '+e.message)}
         }
         const projectiles=pool.slice(was).filter(pr=>pr?.aq&&pr.owner===bot&&pr.weapon===id).length;
         const meleeHit=hitAttempts>hitBefore;
         // A melee attack's actual damage or confirmed active phase is
         // necessary. Shield must enter its canonical GUARD.
         if(family==='SHIELD'){
           if(!activatedGuard)throw Error('NATIVE_41_SHIELD_INACTIVE_'+id);
         }else if(family==='MELEE'){
           if(!(projectiles>0||meleeHit||api.getHolder(bot)?.phase==='WINDUP'))
             throw Error('NATIVE_41_MELEE_INERT_'+id);
         }else if(projectiles===0)throw Error('NATIVE_41_SHOT_INERT_'+id);
         results.push({id,family,projectiles,guard:activatedGuard,hit:meleeHit});
         pool.splice(was);
       }
     }finally{
       proxy.takeDamage=prevHit;
       proxy.applyStatus=prevStatus;
     }
     return {count:results.length,shields:results.filter(x=>x.guard).length,
       projectiles:results.reduce((n,x)=>n+x.projectiles,0),
       melee:results.filter(x=>x.family==='MELEE'&&(x.hit||x.projectiles>0)).length};
   });
   assert.equal(fullArsenal.count,41,'Native 41 roster did not execute all weapons');
   assert.equal(fullArsenal.shields,2,'Both native shield executors must enter GUARD');
   console.log('BOT WAVE full 41/41 real Arsenal execution PASS',view.name,fullArsenal);
   // Reject the prior fake-armory PASS: the REAL Arsenal firing event must
   // actually happen in Chrome, and the Gold orb array may not carry a fake
   // waveGunId projectile. These are observable native battle events.
   await gameFrame.waitForFunction(()=>{
    const a=window.APEX_ARSENAL_AV,api=window.APEX_ARSENAL?.weaponApi;
    return !!api&&!!a&&a.stats.cued.some(x=>x.event==='fire'&&x.weapon==='PISTOL');
   },{timeout:18000});
   const shot=await gameFrame.evaluate(()=>({
    nativeExecutor:!!window.APEX_ARSENAL?.weaponApi,
    nativeProjectileDrawing:typeof window.APEX_ARSENAL.weaponApi.drawArsenalProjectiles==='function',
    nativePistolEmissions:window.APEX_ARSENAL_AV.stats.cued.filter(x=>x.event==='fire'&&x.weapon==='PISTOL').length,
    fakeGoldOrbs:window.handLab.projs.filter(p=>p.waveGunId).length,
    audio:window.APEX_ARSENAL_AV.audioStatus(),
    goldVisualRedesign:!!document.getElementById('bw-interface-v2'),
     skillArt:[...document.querySelectorAll('.bw-action-art')].filter(img=>img.complete&&img.naturalWidth>0).length,
     pressureMeter:!!document.getElementById('bw-pressure-fill'),
   }));
   assert.ok(shot.nativeExecutor&&shot.nativeProjectileDrawing&&shot.nativePistolEmissions>0&&shot.fakeGoldOrbs===0&&shot.goldVisualRedesign,
    'Free Battle shot authority not actually running '+JSON.stringify(shot));
   console.log('BOT WAVE actual Arsenal gun discharge PASS',view.name,shot);
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
