// Diagnostic only. Exact packaged HTML5, real Gold fighter picker and live BOT
// matchup. No product/runtime/render changes; no release publication.
// Synthetic tab stream models crop+MediaRecorder cost but NOT Chrome's actual
// tab-compositor capture, hardware-GPU or the owner's computer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startNestedServer } from './issue105/nestedServer.mjs';
const require=createRequire(import.meta.url);
const puppeteer=require('./probe/node_modules/puppeteer-core');
const chrome=process.env.CHROME_PATH || '/usr/bin/google-chrome';
assert.ok(fs.existsSync('dist-itch-html5/portrait-studio.html'), 'Missing packed Portrait Studio');
const server=await startNestedServer();
const browser=await puppeteer.launch({
  executablePath:chrome,headless:true,args:['--no-sandbox','--disable-setuid-sandbox',
    '--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const quant=(v,q)=>v.length?v.slice().sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(q*(v.length-1)))]:null;
const output={environment:{kind:'Chrome headless / software-GPU CI',realTabCapture:false,
  recordingSource:'synthetic animated canvas with live game pixels',game: 'real packaged Gold BOT match',
  playbackAudio:'recorded source has no audio; sound fixed separately',durationMs:3500},results:[],errors:[]};

async function runMatch(caseDef) {
  const page=await browser.newPage();
  const errs=[],captureCodec=[];
  page.on('console',m=>{if(m.text().includes('[owner-capture] selected codec'))captureCodec.push(m.text());});
  page.on('pageerror',e=>errs.push('page: '+String(e)));
  page.on('requestfailed',r=>errs.push('request: '+r.url()+' '+r.failure()?.errorText));
  try {
    await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
    await page.goto(server.url+'/html/apex/portrait-studio.html',{waitUntil:'domcontentloaded',timeout:60000});
    const stage=await page.waitForSelector('#apex-portrait-stage',{timeout:30000});
    const game=await stage.contentFrame();
    assert.ok(game,'Portrait studio must contain the real game iframe');
    await game.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
    await game.$eval('#apex-boot-start',el=>el.click());
    await game.waitForSelector('#freeBattle',{visible:true,timeout:90000});
    // Wait for the exact Home transition gate (as production r5 Chrome test
    // does) before F8 owner navigation. Early F8 requests are rejected while
    // the boot-door transition still owns the screen.
    await game.waitForFunction(()=>document.body?.dataset?.apexSceneTransition==='DONE',
      {timeout:90000});
    await game.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{
      code:'F8',key:'F8',ctrlKey:true,shiftKey:true,bubbles:true
    })));
    await game.waitForSelector('#apex-owner-password-panel input',{visible:true,timeout:15000});
    await game.$eval('#apex-owner-password-panel input',el=>{el.value='500509'});
    await game.$eval('#apex-owner-password-panel form',el=>el.requestSubmit());
    await sleep(2200);
    console.log('[BOXE FROST QA] F8 '+JSON.stringify(await game.evaluate(()=>({
      active:window.APEX_OWNER_TOOLS?.isPlaytestActive?.(),
      stage:document.querySelector('#stage')?.className,
      notice:document.getElementById('apex-owner-notice')?.textContent||null,
      launchType:typeof window.apexLaunchProductSurface,
      transition:document.body?.dataset?.apexSceneTransition
    }))));
    await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter')
      && window.APEX_OWNER_TOOLS?.isPlaytestActive?.()===true,{timeout:45000});
    const roster=await game.evaluate(()=>[...document.querySelectorAll('.rosterCard')].map(el=>({
      hero:el.getAttribute('data-hero'),disabled:!!el.disabled,
      locked:el.classList.contains('is-locked'),label:el.textContent.trim().slice(0,35)})));
    console.log('[BOXE FROST QA] ROSTER '+JSON.stringify(roster));
    async function choose(hero,slot) {
      const actual=await game.evaluate(requested=>{
        const variants=requested==='ice'?['ice','frost']:[requested];
        const card=[...document.querySelectorAll('.rosterCard')].find(c=>
          variants.includes(String(c.dataset.hero||'').toLowerCase()) ||
          (requested==='ice' && /\bFROST\b/i.test(c.textContent||'')));
        if(!card) return {ok:false,available:[...document.querySelectorAll('.rosterCard')].map(c=>c.dataset.hero)};
        card.click();return {ok:true,hero:card.dataset.hero,disabled:card.disabled};
      },hero);
      assert.ok(actual.ok&&!actual.disabled,slot+' fighter unavailable: '+JSON.stringify(actual));
      await game.waitForFunction(({slot,expected})=>{
        const label=document.querySelector(slot==='P1'?'#p1Name':'#p2Name')?.textContent?.trim()?.toUpperCase();
        return label===expected;
      },{timeout:15000},{slot,expected:hero==='ice'?'FROST':hero==='newbot'?'NEWBOT':'BOXE'});
      await game.$eval('#lockIn',el=>el.click());
    }
    await choose('boxe','P1');
    await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('fighter-active-p2'),
      {timeout:20000});
    await choose(caseDef.second,'P2');
    await game.waitForFunction(()=>{
      const match=window.APEX_HERO_REWORK?.match;
      return window.APEX_ARSENAL?.state?.active===true &&
        document.querySelector('#battleHudHost')?.classList.contains('is-open') &&
        Array.isArray(match?.combatants) && match.combatants.length===2;
    },{timeout:110000});
    const pair=await game.evaluate(()=>({
      ids:window.APEX_HERO_REWORK.match.combatants.map(x=>x.heroId),
      gameView:[innerWidth,innerHeight],
      s:window.APEX_ARSENAL?.state?.battleMode
    }));
    assert.deepEqual(pair.ids,['BOXE',caseDef.second==='ice'?'ICE':caseDef.second==='newbot'?'ROBOT':'BOXE'],
      'must measure actual selected matchup, never a proxy '+JSON.stringify(pair));
    console.log('[BOXE FROST QA] ACTUAL MATCH '+JSON.stringify(pair));

    // Sample genuine game-frame scheduling; one passive RAF observer per phase.
    async function phase(label,ms) {
      await game.evaluate(()=>{
        const mark=performance.now(), gaps=[],longs=[];
        let last=mark,live=true,n=0,handle=0;
        const tick=now=>{
          if(!live)return;
          if(n++)gaps.push(now-last);
          last=now;
          handle=requestAnimationFrame(tick);
        };
        let observer=null;
        try{
          observer=new PerformanceObserver(list=>list.getEntries().forEach(e=>
            longs.push({start:e.startTime,duration:e.duration})));
          observer.observe({entryTypes:['longtask']});
        }catch(_){}
        handle=requestAnimationFrame(tick);
        window.__boxeFrostProbe={mark,gaps,longs,stop(){
          live=false;cancelAnimationFrame(handle);observer?.disconnect();
          return {elapsed:performance.now()-mark,gaps,longs,
            match:window.APEX_HERO_REWORK?.match?.combatants?.map(x=>x.heroId)||[],
            active:window.APEX_ARSENAL?.state?.active===true,
            recording:window.APEX_OWNER_TOOLS?.isRecording?.()===true};
        }};
      });
      await sleep(ms);
      const results=await game.evaluate(()=>window.__boxeFrostProbe.stop());
      const gaps=results.gaps.filter(x=>Number.isFinite(x)&&x>=0);
      return {phase:label,elapsedMs:results.elapsed,frames:gaps.length,
        p50GapMs:quant(gaps,.50),p95GapMs:quant(gaps,.95),maxGapMs:Math.max(0,...gaps),
        gapOver50Ms:gaps.filter(x=>x>50).length,
        gapOver100Ms:gaps.filter(x=>x>100).length,
        longTasks:results.longs.length,
        longTaskTotalMs:results.longs.reduce((sum,x)=>sum+x.duration,0),
        match:results.match,active:results.active,recording:results.recording};
    }
    // Match start and asset decode settle without modifying combat/clock.
    await sleep(1600);
    const unrecorded=await phase('LIVE_BATTLE_NO_REC',3500);

    // Same full-resolution r5 recording path. Source pixels are the actual
    // live gameCanvas, presented in a synthetic tab frame at 30 fps, NOT a
    // browser-granted native compositor tab stream.
    const setup=await game.evaluate(()=>{
      const ctl=window.APEX_OWNER_TOOLS;
      if(!ctl?.canStudioRecord?.())return {ok:false,why:'Game ended/record unavailable'};
      const studio=window.parent.APEX_PORTRAIT_STUDIO;
      const crop=studio.getCropRect();
      const src=window.parent.document.createElement('canvas');
      src.width=1440;src.height=900;
      const c=src.getContext('2d',{alpha:false});
      const gameCanvas=document.getElementById('game-canvas') ||
        document.querySelector('#battleHudHost canvas');
      const redraw=()=>{
        c.fillStyle='#0a1016';c.fillRect(0,0,src.width,src.height);
        if(gameCanvas)c.drawImage(gameCanvas,crop.left,crop.top,crop.width,crop.height);
      };
      redraw();
      const srcTimer=window.setInterval(redraw,33);
      const stream=src.captureStream(30);
      const track=stream.getVideoTracks()[0];
      track.getSettings=()=>({displaySurface:'browser',width:1440,height:900});
      track.getCaptureHandle=()=>({
        handle:'apex-chaos-portrait-studio-v2',origin:location.origin
      });
      window.__boxeFrostCapture={src,srcTimer,stream};
      const started=ctl.toggleStudioRecording(stream);
      return {ok:started,gameCanvas:!!gameCanvas,source:[src.width,src.height],crop};
    });
    assert.ok(setup.ok&&setup.gameCanvas,'Synthetic captured source unavailable '+JSON.stringify(setup));
    await game.waitForFunction(()=>window.APEX_OWNER_TOOLS?.isRecording()===true,{timeout:15000});
    const recorded=await phase('LIVE_BATTLE_WITH_MEDIARECORDER',3500);
    await game.evaluate(()=>{
      const capture=window.__boxeFrostCapture;
      window.clearInterval(capture.srcTimer);
      const tools=window.APEX_OWNER_TOOLS;
      if(tools?.isRecording?.())tools.toggleStudioRecording();
      capture.stream.getTracks().forEach(t=>t.stop());
    });
    await game.waitForFunction(()=>window.APEX_OWNER_TOOLS?.isRecording()===false,{timeout:15000});
    const recovered=await phase('LIVE_BATTLE_AFTER_REC',3500);
    assert.deepEqual(errs,[],'Unexpected JavaScript or network errors');
    return {case:caseDef.name,selected:pair,unrecorded,recorded,recovered,
      diagnostics:{syntheticSource:setup,captureCodec,errors:errs}};
  } finally {
    await page.close();
  }
}
try{
  for(const x of [{name:'BOXE_vs_FROST',second:'ice'},
                  {name:'BOXE_vs_NEWBOT_control',second:'newbot'}]){
    try{
      const res=await runMatch(x);
      output.results.push(res);
      console.log('[BOXE FROST QA] RESULT '+JSON.stringify(res));
    }catch(e){
      output.errors.push({case:x.name,error:String(e.stack||e)});
      console.error('[BOXE FROST QA] CASE ERROR '+x.name+' '+String(e.stack||e));
    }
  }
  fs.mkdirSync('reports/boxe-frost',{recursive:true});
  fs.writeFileSync('reports/boxe-frost/capture-profile.json',JSON.stringify(output,null,2));
  console.log('[BOXE FROST QA] SUMMARY '+JSON.stringify(output));
  assert.equal(output.errors.length,0,'Matchup profiling incomplete: '+JSON.stringify(output.errors));
}finally{
  await browser.close();
  await server.close();
}
