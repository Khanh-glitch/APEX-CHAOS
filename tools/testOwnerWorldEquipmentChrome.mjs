// D5 owner World Weapon Chrome proof: REAL boot START -> Gold hero selection ->
// visible Battle HUD -> real Arsenal floor physics. NOT a Gold pixel-parity test.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import './testMagnetAiWorldRoleContract.mjs';
const CHROME=process.env.CHROME_PATH;
if(!CHROME)throw Error('CHROME_PATH must identify installed Chromium');
const URL=process.env.APEX_APP_URL||'http://127.0.0.1:5173/';
const OUT=path.resolve(process.env.APEX_EVIDENCE_DIR||'/tmp/d5-world-weapon-chrome');
fs.mkdirSync(OUT,{recursive:true});
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,
 args:['--headless=new','--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const results=[];
const variants=[
 ['desktop','magnet',{width:1440,height:900},'magnet'],
 ['mobile','magnet',{width:390,height:844,isMobile:true,deviceScaleFactor:2},'magnet'],
 ['desktop','frost',{width:1440,height:900},'frost'],
 ['mobile','frost',{width:390,height:844,isMobile:true,deviceScaleFactor:2},'frost'],
 ['desktop','hunter',{width:1440,height:900},'hunter'],
 ['desktop','magnet-ai',{width:1440,height:900},'newbot','magnet'],
];
const now=()=>Date.now();
async function goGoldBattle(page,hero,name,opponent='newbot'){
 await page.goto(URL,{waitUntil:'load',timeout:45000});
 await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:60000});
 await page.evaluate(async()=>{await window.__apexEnsureDeferredRuntimes('arsenalProduct');
  window.__APEX_TEST_MODE=true;});
 await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
 await page.click('#apex-boot-start');
 await page.waitForFunction(()=>typeof window.APEX_GOLD_SHELL_NAVIGATE==='function' &&
  !document.getElementById('apex-boot-start') && !window.APEX_SCENE_TRANSITION?.active?.(),
  {timeout:90000});
 const route=await page.evaluate(()=>window.APEX_GOLD_SHELL_NAVIGATE('fighter',{mode:'bot'}));
 assert.equal(route,true,'Gold fighter route rejected');
 // Wait for the actual, interactive Fighter surface, not merely a visible
 // card behind Mode -> Fighter choreography. Synthetic DOM click() previously
 // bypassed pointer hit-testing and could lock slots before the route settled.
 await page.waitForFunction((id)=>{
  const stage=document.getElementById('stage');
  const e=document.querySelector('.rosterCard[data-hero="'+id+'"]');
  return stage?.classList.contains('screen-fighter') &&
   !stage.classList.contains('mode-committing') &&
   !stage.classList.contains('flow-transition') &&
   !window.APEX_SCENE_TRANSITION?.active?.() &&
   !!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility==='visible';
 },{timeout:90000},hero);
 await page.click('.rosterCard[data-hero="'+hero+'"]');
 await page.click('#lockIn');
 await page.waitForFunction(()=>{
  const stage=document.getElementById('stage');
  return stage?.classList.contains('fighter-p1-locked')&&
   stage?.classList.contains('fighter-active-p2');
 },{timeout:15000});
 await page.click('.rosterCard[data-hero="'+opponent+'"]');
 await page.click('#lockIn');
 // Record whether battle entry really started at the exact accepted LOCK IN.
 // This is read-only diagnosis: NEVER retry/force the handoff from this fixture.
 const handoffAtLock=await page.evaluate(()=>({
   doorActive:window.APEX_SCENE_TRANSITION?.active?.()??null,
   bodyClass:document.body.className,
   stageClass:document.getElementById('stage')?.className,
   hudClass:document.getElementById('battleHudHost')?.className,
   railsClass:document.getElementById('battleTransition')?.className,
   hudVisible:document.getElementById('battleHudHost')?.getAttribute('aria-hidden')
 }));
 console.log('D5 LOCK IN handoff snapshot '+name+' '+JSON.stringify(handoffAtLock));
 await page.waitForFunction(()=>{const host=document.getElementById('battleHudHost');
  return document.body.classList.contains('battle-hud-open')&&
   host?.classList.contains('is-open')&&
   host.contains(document.getElementById('game-canvas'))&&
   !window.APEX_SCENE_TRANSITION?.active?.();},{timeout:120000});
 const visible=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas'),r=c.getBoundingClientRect(),s=getComputedStyle(c);
  return {width:r.width,height:r.height,opacity:s.opacity,display:s.display,
   visibility:s.visibility,hasStart:!!document.getElementById('apex-boot-start'),
   battleOpen:document.body.classList.contains('battle-hud-open')};
 });
 assert.ok(visible.width>200&&visible.height>200&&visible.visibility==='visible'&&
  visible.display!=='none'&&Number(visible.opacity)>.95&&!visible.hasStart&&visible.battleOpen,
  name+' is not visually displaying Gold battle: '+JSON.stringify(visible));
 return visible;
}
try {
 for(const [device,kind,viewport,hero,opponent] of variants){
  const label=device+'-'+kind,started=now(),page=await browser.newPage();
  await page.setViewport(viewport);
  const errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')warnings.push(m.text())});
  let visible;
  try {visible=await goGoldBattle(page,hero,label,opponent);}
  catch(e){
   const diag=await page.evaluate(()=>({
     doorActive:window.APEX_SCENE_TRANSITION?.active?.()??null,
     bodyClass:document.body.className,
     stageClass:document.getElementById('stage')?.className,
     hudClass:document.getElementById('battleHudHost')?.className,
     railsClass:document.getElementById('battleTransition')?.className,
     hudVisible:document.getElementById('battleHudHost')?.getAttribute('aria-hidden'),
     battleApi:typeof window.APEX_GOLD?.startBattle,
     battleRuntime:window.apexArsenalBattleRuntime||null,
     currentHandoffBanner:document.getElementById('handoffBanner')?.textContent
   })).catch(e=>({probeError:String(e)}));
   console.error('D5 Gold navigation FAIL '+label+' '+JSON.stringify({diag,errors,warnings:warnings.slice(-12)}),e);
   await page.screenshot({path:path.join(OUT,label+'-navigation-fail.png')});
   throw e;
  }
  const initial=await page.evaluate(async (hero)=>{
   const G=window,AR=G.APEX_ARSENAL,HR=G.APEX_HERO_REWORK;
   if(!AR?.state?.active)throw Error('No actual Arsenal battle');
   const [a,b]=G.fighters,ct=HR.byCombatant(a);
   const required=hero==='magnet'?'MAGNET':hero==='frost'?'ICE':hero==='hunter'?'HUNTER':'ROBOT';
   if(ct?.heroId!==required)throw Error('Wrong hero for Gold selection '+ct?.heroId);
   HR.setAiEnabled(hero==='newbot');
   if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
   a.baseSpeed=b.baseSpeed=0;
   a.x=hero==='newbot'?850:hero==='magnet'?310:200;a.y=hero==='newbot'?850:500;a.setDir(1,0);
   b.x=hero==='newbot'?310:850;b.y=hero==='newbot'?500:850;b.setDir(-1,0);
   AR.state.spawnTimer=1e6;AR.state.spawnHeld=true;AR.state.unarmedFastConsumed=true;
   AR.state.slots=[];
   for(let i=0;i<3;i++)AR.step(1/60);
   if(typeof G.draw==='function')G.draw();
   if(hero==='hunter'||hero==='magnet'){
     const states=G.apexProductAssets?.presentationReadiness?.();
     const goldReady=hero==='hunter' ? G.APEX_HUNTER_PRESENTATION?.ready : G.APEX_MAGNET_GOLD?.ready;
     if(states?.[hero]?.state!=='READY'||!goldReady)
       throw Error('Gold '+hero+' first frame not presentation READY: '+JSON.stringify({states,goldReady}));
   }
   if(hero==='newbot'){
     const states=G.apexProductAssets?.presentationReadiness?.();
     if(states?.magnet?.state!=='READY'||!G.APEX_MAGNET_GOLD?.ready)
       throw Error('BOT Magnet first frame rendered before presentation READY');
   }
   if(hero==='frost'){
     // Future heroes opt into this SAME registry: two callers of one prepare
     // must share an in-flight promise, never initialize an atlas twice.
     const assets=G.apexProductAssets;
     let calls=0;
     assets.registerPresentation('cp5_future_visual_canary',async()=>{calls++;await Promise.resolve();});
     await Promise.all([assets.preparePresentations(['cp5_future_visual_canary']),
       assets.preparePresentations(['cp5_future_visual_canary']),
       assets.preparePresentations(['cp5_future_visual_canary'])]);
     if(calls!==1||assets.presentationReadiness()?.cp5_future_visual_canary?.state!=='READY')
       throw Error('Future hero presentation provider was initialized more than once');
     const P=G.APEX_FROST_PRESENTATION,pre=G.apexProductAssets?.presentationReadiness?.();
     const state=P?.inspect?.(a);
     if(pre?.frost?.state!=='READY'||!P?.ready||!state?.engineReady)
       throw Error('First Frost battle frame appeared BEFORE shared presentation READY: '+
         JSON.stringify({pre,frostReady:P?.ready,state}));
     if(G.APEX_FROST_GOLD?.cacheStats?.loadCalls!==1)
       throw Error('Frost Gold atlas preprocessed more than once or not at all: '+
         JSON.stringify(G.APEX_FROST_GOLD?.cacheStats));
   }
   return {hero:ct.heroId,slotCount:AR.state.slots.length,arenaVisible:true};
  },hero);
  await (await page.$('#game-canvas')).screenshot({path:path.join(OUT,label+'-before.png')});
  const evaluated=await page.evaluate((kind)=>{
   const G=window,AR=G.APEX_ARSENAL,HR=G.APEX_HERO_REWORK,CFG=G.APEX_ARSENAL_CONFIG;
   const [a,b]=G.fighters;
   const slot=(id,x,y)=>{
    const s=AR.state;
    const v={id:s.nextSlotId++,x,y,phase:'REVEALED',kind:'WEAPON',weaponId:id,
     revealLeadSeconds:1.5,revealedFor:0,pickedBy:null,rejectedFor:{},
     spawnTime:s.time,predictedHeroETA:null,predictedRivalETA:null,
     earliestETA:null,predictedFighter:null,tier:CFG.tierOf(id)};
    s.slots.push(v);return v;
   };
   if(kind==='magnet-ai'){
    const p2ct=HR.byCombatant(b),CAP=G.APEX_HERO_REWORK_AIL?.CapabilityAuthority;
    if(p2ct?.heroId!=='MAGNET'||!G.APEX_HERO_REWORK.aiEnabled)
      throw Error('Actual BOT not active as Magnet P2');
    // Discover targets from the current semantic catalogue, never enumerate
    // a fixed V4.x version or a fixed set of weapon IDs.
    const candidate=Object.keys(CFG.WEAPONS).find((id)=>{
      const sample={kind:'WEAPON',weaponId:id,phase:'REVEALED'};
      const spec=CFG.WEAPONS[id];
      // Trait discovery, not V43_SPECIAL_IDS or a current gun-name whitelist:
      // this must be a data-declared SPECIAL equipment, not GRENADE.
      const special=Array.isArray(spec?.magnetizableKinds)||Array.isArray(spec?.reflectableKinds);
      return special&&CFG.isGun(id)===false&&
        CAP.query('magnet-revealed-slot',sample,{config:CFG}).status==='allowed';
    });
    if(!candidate)throw Error('No non-firearm World Weapon in canonical catalogue for BOT AI');
    const floorSlot=slot(candidate,690,500);
    const physical=CAP.query('magnet-revealed-slot',floorSlot,{config:CFG});
    if(physical.status!=='allowed')throw Error('Magnet A1 gameplay denies BOT target');
    const before=p2ct.telemetry.bySkill?.A1||0;
    let frames=0;
    for(;frames<280&&(p2ct.telemetry.bySkill?.A1||0)===before;frames++)AR.step(1/60);
    if((p2ct.telemetry.bySkill?.A1||0)!==before+1)
      throw Error('Real BOT never proactively chose Magnet A1 for non-gun World Weapon: '+
        JSON.stringify({candidate,frames,castCount:p2ct.telemetry.bySkill?.A1||0,
          plan:HR.match?.aiCastPlan?.['MAGNET:A1'],remaining:p2ct.skills?.A1?.cdLeft}));
    if(typeof G.draw==='function')G.draw();
    return {kind,candidate,frames,aiCasts:(p2ct.telemetry.bySkill?.A1||0)-before,
      a1Field:G.APEX_MAGNET.activeFields(G.APEX_HERO_REWORK_AIL.clock()).length};
   }
   if(kind==='hunter'){
    return {kind,preprocess:G.apexProductAssets?.presentationReadiness?.()?.hunter?.state,
      goldReady:!!G.APEX_HUNTER_PRESENTATION?.ready};
   }
   if(kind==='magnet'){
    // Full current V4.3 floor pool — a single RPG smoke probe previously
    // left seven new equipment identities unmeasured in the real Gold battle.
    const ids=CFG.V43_SPECIAL_IDS;
    if(ids.length!==8)throw Error('V43 owner roster changed: '+ids.length);
    const inventory=[
      ['PISTOL',610,420,true],['SABRE',610,450,true],
      ['GRENADE',610,480,true],
      ...ids.map((id,i)=>[id,630+(i%2)*30,400+i*27,true]),
      ['STORMBREAKER',650,625,false],['SWIRL_SHIELD',650,660,false]
    ];
    // Lab has a real cap of 6 floor objects. Create its one genuine V43
    // item FIRST, then add synthetic controls for this multi-identity audit.
    const oldLab=AR.state.labMode;
    AR.state.labMode=true;
    let genuineRPG;
    try{genuineRPG=G.APEX_ARSENAL_SPAWN.spawnLabWeapon('RPG_7');}
    finally{AR.state.labMode=oldLab;}
    if(!genuineRPG||genuineRPG.kind!=='WEAPON'){
      const func=String(G.APEX_ARSENAL_SPAWN.spawnLabWeapon);
      throw Error('REAL Lab RPG-7 slot invalid: '+JSON.stringify({
        exists:!!genuineRPG,kind:genuineRPG?.kind,
        activeSlots:AR.state.slots.length,
        labCap:CFG.LAB_MANUAL_SLOT_CAP,
        hasNewSource:func.includes("kind: 'WEAPON'")
      }));
    }
    const slots=inventory.map(([id,x,y])=>{
      const placed=id==='RPG_7'?genuineRPG:slot(id,x,y);
      placed.x=x;placed.y=y;
      return placed;
    });
    const pos=slots.map(s=>({x:s.x,y:s.y}));
    if(!HR.pressAbility(a,'A1').ok)throw Error('Real Magnet A1 cast was denied');
    for(let i=0;i<9;i++)AR.step(1/60);
    const measurements=slots.map((s,i)=>({id:s.weaponId,eligible:inventory[i][3],
      distance:Math.hypot(s.x-pos[i].x,s.y-pos[i].y)}));
    const fieldActive=G.APEX_MAGNET.activeFields(G.APEX_HERO_REWORK_AIL.clock()).length>0;
    // Same Gold Battle Canvas; A1 expires before a distinct A2 physical trial.
    for(let i=0;i<70;i++)AR.step(1/60);
    AR.state.slots=[];
    AR.step(1/60);
    const ct=HR.byCombatant(a),ctl=HR.abilityController(ct),MAG=G.APEX_MAGNET;
    // Real cast-readiness law, not an arbitrary 70-frame assumption: the
    // Gold match may have advanced during transition before this QA probe.
    // No cooldown, CC or mutual-exclusion state is forcibly reset.
    let readySteps=0;
    for(;readySteps<900&&(ctl.cooldownLeft('A2')>0||
        MAG.activeFor(ct,'a1',G.APEX_HERO_REWORK_AIL.clock())||
        a.hardCC());readySteps++)AR.step(1/60);
    if(a.hardCC()||ctl.cooldownLeft('A2')>0||
       MAG.activeFor(ct,'a1',G.APEX_HERO_REWORK_AIL.clock()))
      throw Error('A2 never became legitimately cast-ready: '+JSON.stringify({
        readySteps,cooldown:ctl.cooldownLeft('A2'),
        cc:a.hardCC(),statuses:a.statuses,
        a1Active:MAG.activeFor(ct,'a1',G.APEX_HERO_REWORK_AIL.clock())
      }));
    const inert=slot('PISTOL',480,500);
    inert.magneticResponse='inert';
    const responsive=CFG.V43_SPECIAL_IDS.map((id,i)=>
      slot(id,480+(i%2)*12,420+i*20));
    const targets=[inert,...responsive];
    const before=targets.map(s=>({x:s.x,y:s.y}));
    const castA2=HR.pressAbility(a,'A2');
    if(!castA2.ok)throw Error('Real Magnet A2 cast denied: '+JSON.stringify({
      reason:castA2.reason,cooldown:ctl.cooldownLeft('A2'),
      a1Active:MAG.activeFor(ct,'a1',G.APEX_HERO_REWORK_AIL.clock()),
      hp:a.hp,clock:G.APEX_HERO_REWORK_AIL.clock()
    }));
    for(let i=0;i<8;i++)AR.step(1/60);
    const a2Measurements=targets.map((s,i)=>({
      id:s.weaponId,response:CFG.magneticResponseOf(s.weaponId,s),
      distance:Math.hypot(s.x-before[i].x,s.y-before[i].y),
      outward:s.x>before[i].x,phase:s.phase
    }));
    if(typeof G.draw==='function')G.draw();
    return {kind,measurements,fieldActive,a2Measurements};
   }
   if(kind==='frost'){
    a.x=200;a.y=500;a.setDir(1,0);b.x=850;b.y=850;
    if(!G.APEX_ARSENAL_SKILL_GATE.pressJ(a))throw Error('Real Frost A1 press rejected');
    // CP5 read-only browser canary for the real early A1 presentation window.
    const earlyFrames=[],F=G.APEX_FROST_PRESENTATION;
    for(let i=0;i<54;i++){
      AR.step(1/60);
      if(typeof G.draw==='function')G.draw();
      if(i<20||i===29||i===39||i===53){
        const p=F?.inspect?.(a),audit=p?.renderAudit||{};
        earlyFrames.push({frame:i+1,ready:p?.ready,engineReady:p?.engineReady,
          leaks:p?.stateLeaks,exceptions:audit.drawExceptions,
          bodyDraws:audit.bodyDraws,iceRenders:audit.iceRenders,
          castStarts:p?.castStarts,a1Replays:p?.a1Replays,a1Started:p?.a1Started,
          sources:F?.integrityTrace?.().at(-1)?.renderSourceCounts||{}});
      }
    }
    const lane=G.APEX_FROST.inspect(HR.byCombatant(a)).lanes[0];
    if(!lane)throw Error('Frost A1 failed to make real ice lane');
    a.x=100;a.y=100;b.x=100;b.y=900;
    const ids=['SABRE','GRENADE','RPG_7','SWIRL_SHIELD','STORMBREAKER'];
    const slots=ids.map((id,i)=>slot(id,lane.ox+270+i*52,lane.oy));
    AR.step(2/60);
    const measurements=slots.map((s,i)=>({id:ids[i],eligible:i<3,frozen:!!s.__frostFrozen}));
    if(typeof G.draw==='function')G.draw();
    // Same actual battle, same actor/Gold engine: let the REAL ability clock
    // become ready and cast once more without resetting cooldown/gameplay.
    const firstCast=F.inspect(a),ctl=HR.abilityController(HR.byCombatant(a));
    let elapsed=0;
    for(;elapsed<1800&&(ctl.cooldownLeft('A1')>0||a.hardCC());elapsed++)AR.step(1/60);
    if(ctl.cooldownLeft('A1')>0||a.hardCC())
      throw Error('Frost second A1 never naturally ready: '+JSON.stringify({elapsed,cd:ctl.cooldownLeft('A1')}));
    a.x=200;a.y=500;a.setDir(1,0); AR.state.slots=[];
    if(!G.APEX_ARSENAL_SKILL_GATE.pressJ(a))throw Error('Real Frost second A1 press rejected');
    for(let i=0;i<54;i++){AR.step(1/60);if(typeof G.draw==='function')G.draw();}
    const secondCast=F.inspect(a);
    return {kind,measurements,laneWidth:lane.width??null,earlyFrames,
      twoCastProof:{firstStarts:firstCast.castStarts,firstId:firstCast.a1Started,
        secondStarts:secondCast.castStarts,secondId:secondCast.a1Started,
        firstReplays:firstCast.a1Replays,secondReplays:secondCast.a1Replays,
        loadCalls:G.APEX_FROST_GOLD.cacheStats.loadCalls,waitedFrames:elapsed}};
   }
  },kind);
  if(kind==='magnet-ai'){
   assert.equal(evaluated.aiCasts,1,label+' BOT did not autonomously cast A1 for a non-firearm World Weapon');
  }else if(kind==='hunter'){
   assert.equal(evaluated.preprocess,'READY',label+' Hunter Gold preprocess not READY');
   assert.equal(evaluated.goldReady,true,label+' Hunter Gold art missing first frame');
  }else if(kind==='magnet'){
   assert.ok(evaluated.fieldActive,label+' real field not active');
   for(const m of evaluated.measurements){
    assert.ok(m.eligible?m.distance>0.1:m.distance<.01,
      label+' '+m.id+' wrong floor physics '+m.distance);
   }
   assert.equal(evaluated.a2Measurements.length,9,label+' missing 8 V43 A2 trial objects');
   const [inert,...responsive]=evaluated.a2Measurements;
   assert.ok(inert.distance<.01,label+' A2 moved nonmagnetic Pistol: '+inert.distance);
   assert.equal(inert.phase,'REVEALED',label+' inert slot vanished');
   assert.equal(responsive.length,8);
   for(const m of responsive){
    assert.equal(m.response,'responsive',label+' V43 material response '+m.id);
    assert.ok(m.distance>.1&&m.outward,
      label+' A2 did not repel responsive V43 '+m.id+': '+JSON.stringify(m));
    assert.equal(m.phase,'REVEALED',label+' V43 floor slot vanished '+m.id);
   }
  }else{
   for(const m of evaluated.measurements)
     assert.equal(m.frozen,m.eligible,label+' '+m.id+' wrong Frozen Equipment');
   assert.equal(evaluated.earlyFrames.length,23,label+' Frost early-frame samples');
   const admitted=new Set();
   for(const frame of evaluated.earlyFrames){
     assert.ok(frame.ready&&frame.engineReady,label+' Gold art unavailable frame '+frame.frame);
     assert.equal(frame.leaks,0,label+' canvas state leak frame '+frame.frame);
     assert.equal(frame.exceptions,0,label+' Frost draw exception frame '+frame.frame);
     assert.ok(frame.bodyDraws>0,label+' missing actor render frame '+frame.frame);
     assert.equal(frame.castStarts,1,label+' first A1 spawned a second visual cast at frame '+frame.frame);
     assert.equal(frame.a1Replays,0,label+' first A1 replayed a late visual at frame '+frame.frame);
     admitted.add(frame.a1Started);
   }
   assert.equal(admitted.size,1,label+' first A1 changed cast identity mid-animation');
   const v=evaluated.twoCastProof;
   assert.ok(v.firstId>0&&v.secondId>v.firstId,label+' cast IDs do not advance monotonically');
   assert.equal(v.firstStarts,1,label+' first activation not exactly one Gold visual');
   assert.equal(v.secondStarts,2,label+' second activation not exactly one more Gold visual');
   assert.equal(v.firstReplays,0,label+' first A1 delayed visual replayed');
   assert.equal(v.secondReplays,0,label+' second A1 delayed visual replayed');
   assert.equal(v.loadCalls,1,label+' repeated Gold preprocessing across casts');
   assert.ok(evaluated.earlyFrames.some(f=>(f.sources['frost-gold-body']||0)>0),
     label+' early Gold Frost actor source absent');
  }
  assert.deepEqual(errors,[],label+' browser page errors');
  await (await page.$('#game-canvas')).screenshot({path:path.join(OUT,label+'-after.png')});
  results.push({label,visible,initial,evaluated,errors,durationMs:now()-started});
  console.log('PASS D5 REAL GOLD CHROME '+label+' '+JSON.stringify(evaluated));
  await page.close();
 }
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(results,null,2));
 console.log('D5 WORLD WEAPON REAL GOLD CHROME: '+results.length+'/'+variants.length+' PASS; '+(2*results.length)+' battle Canvas screenshots');
}finally{await browser.close();}
