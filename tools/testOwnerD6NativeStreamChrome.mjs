// D6 owner-law real Chrome desktop/mobile, with native Canvas screenshots.
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
   // The route returns an intent before Fighter's authored choreography
   // settles. Wait until a player can truly interact, then use pointer input
   // instead of synthetic DOM click() that bypasses transition hit-testing.
   await page.waitForFunction(()=>{
     const stage=document.getElementById('stage');
     const card=document.querySelector('.rosterCard[data-hero="crystala"]');
     return stage?.classList.contains('screen-fighter') &&
       !stage.classList.contains('mode-committing') &&
       !stage.classList.contains('flow-transition') &&
       !window.APEX_SCENE_TRANSITION?.active?.() &&
       !!card && card.getClientRects().length>0 &&
       getComputedStyle(card).visibility!=='hidden';
   },{timeout:90000});
   await page.click('.rosterCard[data-hero="crystala"]');
   await page.click('#lockIn');
   await page.waitForFunction(()=>{
     const stage=document.getElementById('stage');
     return stage?.classList.contains('fighter-p1-locked') &&
       stage?.classList.contains('fighter-active-p2');
   },{timeout:15000});
   await page.click('.rosterCard[data-hero="newbot"]');
   await page.click('#lockIn');
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
  console.log('D6 VISIBLE GOLD BATTLE HOST '+name+' '+JSON.stringify(visible));
  const init=await page.evaluate(()=>{
   const G=window,AR=G.APEX_ARSENAL,HR=G.APEX_HERO_REWORK,CR=G.APEX_CRYSTAL;
   if(!AR?.state?.active || !HR?.match)
     throw Error('Gold battle surface open but real Arsenal match not running');
   if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
   // This is an isolated Crystala WALL vs real native Flame stream test.
   // An autonomous BOT is unrelated to the authored 80-HP material fixture:
   // its shots could lower the wall to 3 HP before the first assertion,
   // intermittently on Android while desktop passed. Disable ONLY fixture AI;
   // retain real wall creation, Flame carrier, tick contacts, damage and render.
   HR.setAiEnabled(false);
   const [a,b]=G.fighters;
   if(HR.byCombatant(a)?.heroId!=='CRYSTAL')
     throw Error('Public Gold selection did not launch Crystala as P1');
   a.baseSpeed=b.baseSpeed=0;
   a.x=150;a.y=500;a.setDir(1,0);
   b.x=850;b.y=500;b.setDir(-1,0);
   AR.state.spawnTimer=1e6;AR.state.spawnHeld=true;
   AR.state.slots=[];AR.state.unarmedFastConsumed=true;
   for(let i=0;i<18;i++)AR.step(1/60);
   const ct=HR.byCombatant(a);
   if(!HR.pressAbility(a,'A1').ok)throw Error('A1 Wall failed');
   let c=CR.inspect(ct).constructs.find(x=>x.kind==='wall');
   for(let i=0;i<180&&!c?.lockedAt;i++){
    AR.step(1/60);c=CR.inspect(ct).constructs.find(x=>x.kind==='wall');
   }
   if(!c?.lockedAt)throw Error('A1 material not solid');
   a.x=350;a.y=500;b.x=610;b.y=500;
   a.baseSpeed=b.baseSpeed=0;
   // Moving the fighter in an owner fixture must advance the real Gold
   // presentation rig BEFORE a screenshot; otherwise the live character
   // body still draws at its previous position for that one frame.
   AR.step(1/60);
   const pre={wallHp:c.hp,sourceHp:b.hp,targetHp:a.hp,material:CR.capsules().length};
   G.__d6Case={a,b,ct,AR,CR,pre,receipts:[]};
   G.__d6Case.off=G.APEX_HERO_REWORK_AIL.bus.on('CrystalStreamContact',
     ev=>G.__d6Case.receipts.push(ev.payload));
   if(typeof G.draw==='function')G.draw();
   return pre;
  });
  assert.equal(init.wallHp,80);
  const canvas=await page.$('#game-canvas');
  assert.ok(canvas,'game canvas not available');
  await canvas.screenshot({path:path.join(OUT,name+'-before.png')});
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
   return {ticks:p.ticks,wallHp:O.CR.inspect(O.ct).constructs.find(x=>x.kind==='wall').hp,
     visualHistory:p.flameReflectHistory?.length||0,
     routeCount:p.flameReflectHistory?.reduce((s,x)=>s+x.routes.length,0)||0};
  });
  assert.ok(middle.ticks>=2&&middle.ticks<=4,'wrong intermediate tick count');
  assert.ok(middle.wallHp>0&&middle.wallHp<80,'expected live reflecting wall');
  assert.ok(middle.visualHistory>0&&middle.routeCount>0,'missing Gold reflected routes');
  await canvas.screenshot({path:path.join(OUT,name+'-reflecting.png')});
  const after=await page.evaluate(()=>{
   const G=window,O=G.__d6Case,{AR,CR,ct,a,b,pre,flame}=O;
   for(let i=0;i<11;i++)AR.step(1/60);
   if(typeof G.draw==='function')G.draw();
   const c=CR.inspect(ct).constructs.find(x=>x.kind==='wall');
   O.off();
   return {wallState:c.state,wallHp:c.hp,wallReason:c.reason,
     ticks:flame.ticks,sourceHpLoss:pre.sourceHp-b.hp,targetHpLoss:pre.targetHp-a.hp,
     receipts:O.receipts.map(x=>({broken:x.broken,tick:x.tick,facet:x.facet})),
     visualHistory:flame.flameReflectHistory?.length||0};
  });
  await canvas.screenshot({path:path.join(OUT,name+'-broken.png')});
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
  await canvas.screenshot({path:path.join(OUT,name+'-settled.png')});

  assert.equal(after.wallState,'ENDED');
  assert.equal(after.wallReason,'destroyed');
  assert.equal(after.ticks,5);
  assert.equal(after.receipts.length,5);
  assert.deepEqual(after.receipts.map(x=>x.broken),[false,false,false,false,true]);
  assert.ok(after.sourceHpLoss>0&&after.targetHpLoss>0);
  assert.deepEqual(errors,[],'browser page errors');
  report.push({name,initial:init,middle,after,settled,errors});
  console.log('PASS D6 REAL CHROME '+name+' '+JSON.stringify({middle,after}));
  await page.close();
 }
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
 console.log('D6 REAL CHROME: 2/2 PASS with six original product Canvas screenshots');
}finally{await browser.close();}
