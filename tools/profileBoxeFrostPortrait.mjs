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
  const errs=[];
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

    // Instrument source-level section timings on the real live game; only
    // times public runtime methods, never modifies their arguments or output.
    await game.evaluate(()=>{
      const perf=window.__boxeFrostSections={current:null,acc:{},wrappers:[]};
      const add=(name,obj,key)=>{
        if(!obj||typeof obj[key]!=='function')return;
        const orig=obj[key];
        function measured(...args){
          const active=perf.current, t=active?performance.now():0;
          if(name==='FROST.presentation.renderSurfaceUnderWeapons')perf.inFrostSurface=(perf.inFrostSurface||0)+1;
          try{return Reflect.apply(orig,this,args);}
          finally{
            if(name==='FROST.presentation.renderSurfaceUnderWeapons')perf.inFrostSurface--;
            if(active){
              const elapsed=performance.now()-t;
              const bucket=perf.acc[name]||(perf.acc[name]={count:0,totalMs:0,maxMs:0});
              bucket.count++;bucket.totalMs+=elapsed;bucket.maxMs=Math.max(bucket.maxMs,elapsed);
            }
          }
        }
        obj[key]=measured;
        perf.wrappers.push({name});
      };
      const frost=window.APEX_FROST_GOLD || {};
      const pres=window.APEX_FROST_PRESENTATION || {};
      add('FROST.ice.render',frost.IceField?.prototype,'render');
      add('FROST.ice.polyNode',frost.IceField?.prototype,'polyNode');
      add('FROST.engine.drawFrost',frost.FrostEngine?.prototype,'drawFrost');
      add('FROST.engine.drawA1MacroFront',frost.FrostEngine?.prototype,'drawA1MacroFront');
      add('FROST.engine.updateIdle',frost.FrostEngine?.prototype,'updateIdle');
      add('FROST.engine.updateA1',frost.FrostEngine?.prototype,'updateA1');
      add('FROST.engine.updateA2',frost.FrostEngine?.prototype,'updateA2');
      add('FROST.presentation.tick',pres,'tick');
      add('FROST.presentation.renderSurfaceUnderWeapons',pres,'renderSurfaceUnderWeapons');
      add('FROST.presentation.renderPostWorld',pres,'renderPostWorld');
      add('FROST.drawFloorShapes',frost,'drawFloorShapes');
      add('FROST.updateShapes',frost,'updateShapes');
      add('FROST.drawAirShapes',frost,'drawAirShapes');
      add('FROST.drawRibbonLayer',frost,'drawRibbonLayer');
      // Probe 2D canvas operations only while the Frost world-surface pass
      // executes: classify expensive offscreen -> host drawImage blits.
      // Instrumentation is diagnostic and never reaches the game release.
      const ctxProto=window.CanvasRenderingContext2D?.prototype;
      if(ctxProto)for(const operation of ['drawImage','clearRect','fill','stroke']){
        const previous=ctxProto[operation];
        if(typeof previous!=='function')continue;
        ctxProto[operation]=function(...args){
          const active=perf.current&&perf.inFrostSurface>0;
          const src=args[0],width=src?.width||0,height=src?.height||0;
          const size=width&&height?(width+'x'+height):'';
          const name='FROST.canvas.'+operation+(size?'.'+size:'');
          const started=active?performance.now():0;
          try{return Reflect.apply(previous,this,args);}
          finally{if(active){
            const ms=performance.now()-started;
            const b=perf.acc[name]||(perf.acc[name]={count:0,totalMs:0,maxMs:0});
            b.count++;b.totalMs+=ms;b.maxMs=Math.max(b.maxMs,ms);
          }}
        };
      }
      const original=window.Fighter?.prototype?.draw;
      if(original)window.Fighter.prototype.draw=function(...args){
        const category=this?.type?.__hrHero || this?.__hrCombatant?.heroId || '';
        const name=category==='BOXE'?'FIGHTER.draw.BOXE':
          category==='ICE'?'FIGHTER.draw.FROST':'FIGHTER.draw.OTHER';
        const active=perf.current,t=active?performance.now():0;
        try{return Reflect.apply(original,this,args);}
        finally{if(active){
          const elapsed=performance.now()-t;
          const b=perf.acc[name]||(perf.acc[name]={count:0,totalMs:0,maxMs:0});
          b.count++;b.totalMs+=elapsed;b.maxMs=Math.max(b.maxMs,elapsed);
        }}
      };
    });
    // Sample genuine game-frame scheduling; one passive RAF observer per phase.
    async function phase(label,ms) {
      await game.evaluate((phaseName)=>{
        window.__boxeFrostSections.current=phaseName;
        window.__boxeFrostSections.acc={};
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
      },label);
      await sleep(ms);
      const results=await game.evaluate(()=>{
        const sections=window.__boxeFrostSections;
        sections.current=null;
        return {...window.__boxeFrostProbe.stop(),sections:sections.acc,wrapped:sections.wrappers};
      });
      const gaps=results.gaps.filter(x=>Number.isFinite(x)&&x>=0);
      return {phase:label,elapsedMs:results.elapsed,frames:gaps.length,
        p50GapMs:quant(gaps,.50),p95GapMs:quant(gaps,.95),maxGapMs:Math.max(0,...gaps),
        gapOver50Ms:gaps.filter(x=>x>50).length,
        gapOver100Ms:gaps.filter(x=>x>100).length,
        longTasks:results.longs.length,
        longTaskTotalMs:results.longs.reduce((sum,x)=>sum+x.duration,0),
        match:results.match,active:results.active,recording:results.recording,
        sections:results.sections,wrapped:results.wrapped};
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
      diagnostics:{syntheticSource:setup,errors:errs}};
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
