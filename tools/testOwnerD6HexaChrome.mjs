// D6 owner-law actual HEXA facet in Gold Battle on desktop/mobile.
// Not an original-Gold pixel-match certification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const CHROME=process.env.CHROME_PATH;
if(!CHROME)throw Error('Set CHROME_PATH');
const URL=process.env.APEX_APP_URL||'http://127.0.0.1:5173/';
const OUT=path.resolve(process.env.APEX_EVIDENCE_DIR||'/tmp/d6-stream-chrome');
fs.mkdirSync(OUT,{recursive:true});
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,
 args:['--headless=new','--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const report=[];
try {
 for(const [name,viewport] of [
   ['desktop',{width:1440,height:900}],
   ['mobile',{width:390,height:844,isMobile:true,deviceScaleFactor:2}]
 ]) {
  const page=await browser.newPage();
  await page.setViewport(viewport);
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  // A1 production economy: a fresh profile owns NEWBOT only (proven by the
  // A1 gates). This proof selects CRYSTALA through the real Gold roster, so
  // its fixture is a legitimate saved profile that already owns her — the
  // state a real player reaches via Lucky Draw/Shop.
  await page.evaluateOnNewDocument(()=>{
   localStorage.setItem('apexChaos.arsenalMeta.v1',JSON.stringify({
    version:1,credits:425,ownedFighters:['ROBOT','CRYSTAL'],
    lastSelectedP1:'ROBOT',lastSelectedP2:'ROBOT',totalSpins:1,
    unlockedAt:{ROBOT:0,CRYSTAL:1},arenaPaletteId:null,claimedMatchIds:[],
   }));
  });
  await page.goto(URL,{waitUntil:'load',timeout:45000});
  await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:45000});
  await page.evaluate(async()=>{
   await window.__apexEnsureDeferredRuntimes('arsenalProduct');
   window.__APEX_TEST_MODE=true;
  });
  // Traverse the ACTUAL public boot and Gold selection lifecycle. A game
  // simulation can run behind the START/Home compositor and still return
  // correct HP values; screenshots of that state are NOT battle evidence.
  try {
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>typeof window.APEX_GOLD_SHELL_NAVIGATE==='function' &&
     !document.getElementById('apex-boot-start') &&
     !window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
   const navigated=await page.evaluate(()=>
     window.APEX_GOLD_SHELL_NAVIGATE('fighter',{mode:'bot'}));
   assert.equal(navigated,true,'Gold fighter navigation rejected');
   await page.waitForFunction(()=>{
     const card=document.querySelector('.rosterCard[data-hero="crystala"]');
     return !!card && card.getClientRects().length>0 &&
       getComputedStyle(card).visibility!=='hidden';
   },{timeout:90000});
   await page.$eval('.rosterCard[data-hero="crystala"]',el=>el.click());
   await page.$eval('#lockIn',el=>el.click());
   await page.$eval('.rosterCard[data-hero="newbot"]',el=>el.click());
   await page.$eval('#lockIn',el=>el.click());
   await page.waitForFunction(()=>{
     const root=document.getElementById('battleHudHost');
     return document.body.classList.contains('battle-hud-open') &&
       root?.classList.contains('is-open') &&
       root.contains(document.getElementById('game-canvas')) &&
       !window.APEX_SCENE_TRANSITION?.active?.();
   },{timeout:120000});
  }catch(err){
   const state=await page.evaluate(()=>({
     bootStart:!!document.getElementById('apex-boot-start'),
     donorClass:document.getElementById('battleHudHost')?.className,
     battleOpen:document.body.classList.contains('battle-hud-open'),
     stageClass:document.getElementById('stage')?.className,
     rosterCount:document.querySelectorAll('.rosterCard').length,
     fighterNavigator:typeof window.APEX_GOLD_SHELL_NAVIGATE,
     engineActive:window.APEX_ARSENAL?.state?.active,
   }));
   console.error('D6 REAL CHROME public navigation failed',name,JSON.stringify(state),err);
   await page.screenshot({path:path.join(OUT,name+'-navigation-FAILED.png')});
   throw err;
  }
  // The screenshot must be from the LIVE Gold battle compositor, not the
  // door canvas or an engine simulation running under Home.
  const visible=await page.evaluate(()=>{
    const canvas=document.getElementById('game-canvas');
    const host=document.getElementById('battleHudHost');
    const rect=canvas.getBoundingClientRect(),styles=getComputedStyle(canvas);
    return {
      battleOpen:document.body.classList.contains('battle-hud-open'),
      rootOpen:host.classList.contains('is-open'),inRoot:host.contains(canvas),
      bootStart:!!document.getElementById('apex-boot-start'),
      canvasWidth:rect.width,canvasHeight:rect.height,
      visibility:styles.visibility,display:styles.display,opacity:styles.opacity,
      viewport:{width:innerWidth,height:innerHeight}
    };
  });
  assert.ok(visible.battleOpen&&visible.rootOpen&&visible.inRoot&&!visible.bootStart,
    'Gold battle compositor is NOT visibly authoritative: '+JSON.stringify(visible));
  assert.ok(visible.canvasWidth>200&&visible.canvasHeight>200&&
    visible.visibility==='visible'&&visible.display!=='none'&&
    Number(visible.opacity)>.95,
    'No visible battle canvas: '+JSON.stringify(visible));
  console.log('D6 VISIBLE GOLD HEXA HOST '+name+' '+JSON.stringify(visible));
  const init=await page.evaluate(()=>{
   const G=window,AR=G.APEX_ARSENAL,HR=G.APEX_HERO_REWORK,CR=G.APEX_CRYSTAL;
   if(!AR?.state?.active || !HR?.match)
     throw Error('Gold battle surface open but real Arsenal match not running');
   if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
   const [a,b]=G.fighters;
   // This is a controlled single-Stream law experiment INSIDE an authentic
   // Gold Battle. Stop unrelated BOT decision-making after the real selection.
   // We retain independent BOT/interaction product tests elsewhere.
   HR.setAiEnabled(false);
   if(HR.byCombatant(a)?.heroId!=='CRYSTAL')
     throw Error('Public Gold selection did not launch Crystala as P1');
   a.baseSpeed=b.baseSpeed=0;
   a.x=150;a.y=500;a.setDir(1,0);
   b.x=700;b.y=500;b.setDir(-1,0);
   AR.state.spawnTimer=1e6;AR.state.spawnHeld=true;
   AR.state.slots=[];AR.state.unarmedFastConsumed=true;
   // The public navigation can start combat BEFORE this controlled probe.
   // Existing carried guns/projectiles would create a second facet hit with
   // no connection to the one Flame injected below. Retire those through
   // the REAL holder API, then empty unrelated outstanding projectiles.
   const prior={projectiles:G.projectiles.length,
     holders:[!!AR.weaponApi.getHolder(a),!!AR.weaponApi.getHolder(b)]};
   for(const fighter of [a,b]){
     if(AR.weaponApi.getHolder(fighter))AR.weaponApi.consume(fighter,'qa-controlled-stream-fixture');
     if(fighter.data)fighter.data.arsenalFade=null; // exit ghost is unrelated to this probe
   }
   G.projectiles.length=0; // fixture only: NEVER shipping/gameplay logic
   if(AR.state.detachedWeapons)AR.state.detachedWeapons.length=0;
   for(let i=0;i<18;i++)AR.step(1/60);
   G.__d6FixturePrior=prior;
   const ct=HR.byCombatant(a);
   if(!HR.pressAbility(a,'A2').ok)throw Error('K/A2 active required for HEXA');
   for(let i=0;i<6;i++)AR.step(1/60);
   if(!HR.pressAbility(a,'A1').ok)throw Error('A1 HEXA failed');
   const get=()=>CR.inspect(ct).constructs.find(x=>x.kind==='prison');
   let c=get();
   for(let i=0;i<180&&!c?.lockedAt;i++){AR.step(1/60);c=get();}
   if(!c?.lockedAt)throw Error('A1 HEXA material not solid');
   const live=CR.rigOf(ct).constructs.find(x=>x.kind==='prison').prison;
   const selected=Array.from({length:6},(_,i)=>{
     const edge=live.edges[i];return {i,x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2};
   }).sort((x,y)=>x.x-y.x)[0];
   const facet=selected.i,dx=selected.x-live.cx,dy=selected.y-live.cy,d=Math.hypot(dx,dy);
   a.x=selected.x+dx/d*145;a.y=selected.y+dy/d*145;
   b.x=live.cx;b.y=live.cy;
   a.baseSpeed=b.baseSpeed=0;
   // Moving the fighter in an owner fixture must advance the real Gold
   // presentation rig BEFORE a screenshot; otherwise the live character
   // body still draws at its previous position for that one frame.
   AR.step(1/60);
   const pre={wallHp:c.hp[facet],facet,sourceHp:b.hp,targetHp:a.hp,
     material:CR.capsules().length,allHp:c.hp.slice(),allDead:c.facetsDead.slice(),
     fixturePrior:G.__d6FixturePrior};
   G.__d6Case={a,b,ct,AR,CR,pre,facet,receipts:[],constructHits:[],facetBreaks:[]};
   const bus=G.APEX_HERO_REWORK_AIL.bus;
   G.__d6Case.off=bus.on('CrystalStreamContact',
     ev=>G.__d6Case.receipts.push(ev.payload));
   G.__d6Case.offHits=bus.on('CrystalConstructHit',
     ev=>G.__d6Case.constructHits.push(ev.payload));
   G.__d6Case.offBreaks=bus.on('CrystalFacetBreak',
     ev=>G.__d6Case.facetBreaks.push(ev.payload));
   if(typeof G.draw==='function')G.draw();
   return pre;
  });
  assert.equal(init.wallHp,75);
  assert.deepEqual(init.allHp,[75,75,75,75,75,75],
    'controlled HEXA must begin with six independent undamaged facet HP');
  assert.deepEqual(init.allDead,[false,false,false,false,false,false],
    'controlled HEXA must begin with six live facets');
  const canvas=await page.$('#game-canvas');
  assert.ok(canvas,'game canvas not available');
  await canvas.screenshot({path:path.join(OUT,name+'-hexa-before.png')});
  const middle=await page.evaluate(()=>{
   const G=window,O=G.__d6Case,{a,b,AR}=O;
   const p={aq:true,type:'aq_v43',kind:'flame',weapon:'FLAMETHROWER',
     owner:b,launchOwner:b,flameTarget:a,angle:Math.PI,
     x:b.x,y:b.y,px:b.x,py:b.y,ox:b.x,oy:b.y,vx:0,vy:0,
     age:0,life:.325,maxLife:.325,damage:18,ticks:0,
     flameOrigins:[],hits:new Set(),phase:'flight'};
   G.projectiles.push(p);O.flame=p;
   for(let i=0;i<11;i++)AR.step(1/60);
   if(typeof G.draw==='function')G.draw();
   const panel=O.CR.inspect(O.ct).constructs.find(x=>x.kind==='prison');
   return {ticks:p.ticks,wallHp:panel.hp[O.facet],
     visualHistory:p.flameReflectHistory?.length||0,
     routeCount:p.flameReflectHistory?.reduce((s,x)=>s+x.routes.length,0)||0};
  });
  assert.ok(middle.ticks>=2&&middle.ticks<=4,'wrong intermediate tick count');
  assert.ok(middle.wallHp>0&&middle.wallHp<75,'expected live reflecting wall');
  assert.ok(middle.visualHistory>0&&middle.routeCount>0,'missing Gold reflected routes');
  await canvas.screenshot({path:path.join(OUT,name+'-hexa-reflecting.png')});
  const after=await page.evaluate(()=>{
   const G=window,O=G.__d6Case,{AR,CR,ct,a,b,pre,flame}=O;
   for(let i=0;i<11;i++)AR.step(1/60);
   if(typeof G.draw==='function')G.draw();
   const c=CR.inspect(ct).constructs.find(x=>x.kind==='prison');
   O.off();O.offHits();O.offBreaks();
   return {wallState:c.state,wallHp:c.hp[O.facet],wallReason:c.reason,
     selectedFacet:O.facet,facetDead:c.facetsDead[O.facet],
     liveOtherFacets:c.facetsDead.filter(x=>!x).length,
     beforeFacets:pre.allHp,beforeDead:pre.allDead,
     afterFacets:c.hp,afterDead:c.facetsDead,
     hits:O.constructHits.map(x=>({cons:x.cons,kind:x.kind,facet:x.facet,damage:x.damage,why:x.why})),
     facetBreaks:O.facetBreaks.map(x=>({cons:x.cons,facet:x.facet})),
     ticks:flame.ticks,sourceHpLoss:pre.sourceHp-b.hp,targetHpLoss:pre.targetHp-a.hp,
     receipts:O.receipts.map(x=>({broken:x.broken,tick:x.tick,facet:x.facet})),
     visualHistory:flame.flameReflectHistory?.length||0};
  });
  await canvas.screenshot({path:path.join(OUT,name+'-hexa-broken.png')});
  // Check gameplay hitbox teardown separately from the authored Gold
  // collapsing animation. The screenshot captures the ACTUAL later visual,
  // not a false expectation that a destroyed Wall disappears instantly.
  const settled=await page.evaluate(()=>{
   const G=window,O=G.__d6Case,{AR,CR,ct}=O;
   for(let i=0;i<36;i++)AR.step(1/60);
   if(typeof G.draw==='function')G.draw();
   const form=O.facet===undefined?'wall':'prison';
   const cons=CR.inspect(ct).constructs.find(x=>x.kind===form);
   return {panelState:cons.state,blockedCaps:CR.capsules()
     .filter(x=>x.cons.id===cons.id && x.idx===(O.facet??-1)).length,
     remainingMaterialCaps:CR.capsules().length};
  });
  assert.equal(settled.blockedCaps,0,
    'destroyed material still presents an authoritative collision surface');
  await canvas.screenshot({path:path.join(OUT,name+'-hexa-settled.png')});

  console.log('D6_HEXA_CAUSAL '+name+' '+JSON.stringify({initial:init,after}));
  assert.equal(after.facetDead,true,'struck HEXA facet must break');
  assert.equal(after.liveOtherFacets,5,'other five HEXA facets must retain independent HP');
  assert.deepEqual(after.hits.map(x=>x.facet),Array(5).fill(init.facet),
    'single Flame may contact only its struck facet');
  for(let i=0;i<6;i++)if(i!==init.facet)
    assert.equal(after.afterFacets[i],init.allHp[i],
      'non-contacted HEXA facet '+i+' must keep original HP');
  assert.ok(after.wallHp<=0,'destroyed HEXA facet HP must be exhausted');
  assert.equal(after.ticks,5);
  assert.equal(after.receipts.length,5);
  assert.deepEqual(after.receipts.map(x=>x.broken),[false,false,false,false,true]);
  assert.ok(after.receipts.every(x=>x.facet===init.facet),
    'wrong HEXA facet received a Stream tick');
  assert.ok(after.sourceHpLoss>0&&after.targetHpLoss>0);
  assert.deepEqual(errors,[],'browser page errors');
  report.push({name,initial:init,middle,after,settled,errors});
  console.log('PASS D6 REAL CHROME HEXA '+name+' '+JSON.stringify({middle,after}));
  await page.close();
 }
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
 console.log('D6 REAL CHROME HEXA: 2/2 PASS with six original HEXA battle Canvas screenshots');
}finally{await browser.close();}
