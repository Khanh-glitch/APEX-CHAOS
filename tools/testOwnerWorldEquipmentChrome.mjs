// D5 owner World Weapon Chrome proof: REAL boot START -> Gold hero selection ->
// visible Battle HUD -> real Arsenal floor physics. NOT a Gold pixel-parity test.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
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
];
const now=()=>Date.now();
async function goGoldBattle(page,hero,name){
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
 await page.waitForFunction((id)=>{const e=document.querySelector('.rosterCard[data-hero="'+id+'"]');
  return !!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility==='visible';},
  {timeout:90000},hero);
 await page.$eval('.rosterCard[data-hero="'+hero+'"]',e=>e.click());
 await page.$eval('#lockIn',e=>e.click());
 await page.$eval('.rosterCard[data-hero="newbot"]',e=>e.click());
 await page.$eval('#lockIn',e=>e.click());
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
 for(const [device,kind,viewport,hero] of variants){
  const label=device+'-'+kind,started=now(),page=await browser.newPage();
  await page.setViewport(viewport);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  let visible;
  try {visible=await goGoldBattle(page,hero,label);}
  catch(e){console.error('D5 Gold navigation FAIL',label,e);
   await page.screenshot({path:path.join(OUT,label+'-navigation-fail.png')});
   throw e;}
  const initial=await page.evaluate((hero)=>{
   const G=window,AR=G.APEX_ARSENAL,HR=G.APEX_HERO_REWORK;
   if(!AR?.state?.active)throw Error('No actual Arsenal battle');
   const [a,b]=G.fighters,ct=HR.byCombatant(a);
   const required=hero==='magnet'?'MAGNET':'ICE';
   if(ct?.heroId!==required)throw Error('Wrong hero for Gold selection '+ct?.heroId);
   HR.setAiEnabled(false);
   if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
   a.baseSpeed=b.baseSpeed=0;
   a.x=hero==='magnet'?310:200;a.y=500;a.setDir(1,0);
   b.x=850;b.y=850;b.setDir(-1,0);
   AR.state.spawnTimer=1e6;AR.state.spawnHeld=true;AR.state.unarmedFastConsumed=true;
   AR.state.slots=[];
   for(let i=0;i<3;i++)AR.step(1/60);
   if(typeof G.draw==='function')G.draw();
   return {hero:ct.heroId,slotCount:AR.state.slots.length,arenaVisible:true};
  },kind);
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
   if(kind==='magnet'){
    const inventory=[
      ['PISTOL',615,500,true],['RPG_7',615,530,true],
      ['SABRE',615,470,true],['GRENADE',635,550,true],
      ['FLAMETHROWER',635,440,true],['STORMBREAKER',615,570,false],
      ['SWIRL_SHIELD',615,430,false]
    ];
    const slots=inventory.map(([id,x,y])=>slot(id,x,y));
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
    const inert=slot('PISTOL',480,500), responsive=slot('PISTOL',480,560);
    inert.magneticResponse='inert';
    responsive.magneticResponse='responsive';
    const before=[{x:inert.x,y:inert.y},{x:responsive.x,y:responsive.y}];
    const castA2=HR.pressAbility(a,'A2');
    if(!castA2.ok)throw Error('Real Magnet A2 cast denied: '+JSON.stringify({
      reason:castA2.reason,cooldown:ctl.cooldownLeft('A2'),
      a1Active:MAG.activeFor(ct,'a1',G.APEX_HERO_REWORK_AIL.clock()),
      hp:a.hp,clock:G.APEX_HERO_REWORK_AIL.clock()
    }));
    for(let i=0;i<8;i++)AR.step(1/60);
    const a2Measurements=[inert,responsive].map((s,i)=>({
      response:s.magneticResponse,distance:Math.hypot(s.x-before[i].x,s.y-before[i].y),
      outward:s.x>before[i].x,phase:s.phase
    }));
    if(typeof G.draw==='function')G.draw();
    return {kind,measurements,fieldActive,a2Measurements};
   }
   if(kind==='frost'){
    a.x=200;a.y=500;a.setDir(1,0);b.x=850;b.y=850;
    if(!G.APEX_ARSENAL_SKILL_GATE.pressJ(a))throw Error('Real Frost A1 press rejected');
    for(let i=0;i<54;i++)AR.step(1/60);
    const lane=G.APEX_FROST.inspect(HR.byCombatant(a)).lanes[0];
    if(!lane)throw Error('Frost A1 failed to make real ice lane');
    a.x=100;a.y=100;b.x=100;b.y=900;
    const ids=['SABRE','GRENADE','RPG_7','SWIRL_SHIELD','STORMBREAKER'];
    const slots=ids.map((id,i)=>slot(id,lane.ox+270+i*52,lane.oy));
    AR.step(2/60);
    const measurements=slots.map((s,i)=>({id:ids[i],eligible:i<3,frozen:!!s.__frostFrozen}));
    if(typeof G.draw==='function')G.draw();
    return {kind,measurements,laneWidth:lane.width??null};
   }
  },kind);
  if(kind==='magnet'){
   assert.ok(evaluated.fieldActive,label+' real field not active');
   for(const m of evaluated.measurements){
    assert.ok(m.eligible?m.distance>0.1:m.distance<.01,
      label+' '+m.id+' wrong floor physics '+m.distance);
   }
   assert.equal(evaluated.a2Measurements.length,2,label+' missing live A2 evidence');
   const [inert,responsive]=evaluated.a2Measurements;
   assert.ok(inert.distance<.01,label+' A2 moved nonmagnetic Pistol: '+inert.distance);
   assert.ok(responsive.distance>.1&&responsive.outward,
     label+' A2 did not repel responsive Pistol: '+JSON.stringify(responsive));
   assert.equal(inert.phase,'REVEALED',label+' inert slot vanished');
   assert.equal(responsive.phase,'REVEALED',label+' responsive slot vanished');

   // Owner-reported failure was against NORMAL spawned slots and HUD button,
   // not the idealized, manually typed slots used in the earlier Chrome proof.
   const liveSetup=await page.evaluate(()=>{
    const G=window,AR=G.APEX_ARSENAL,HR=G.APEX_HERO_REWORK,
      SPAWN=G.APEX_ARSENAL_SPAWN,MAG=G.APEX_MAGNET;
    const [a,b]=G.fighters,ct=HR.byCombatant(a),ctl=HR.abilityController(ct);
    AR.state.slots=[];AR.state.spawnHeld=true;AR.state.unarmedFastConsumed=true;
    AR.state.spawnTimer=1e6;
    let ready=0;
    for(;ready<1000&&(ctl.cooldownLeft('A1')>0||
      MAG.activeFor(ct,'a2',G.APEX_HERO_REWORK_AIL.clock())||
      a.hardCC());ready++)AR.step(1/60);
    if(ctl.cooldownLeft('A1')>0||a.hardCC()||
       MAG.activeFor(ct,'a2',G.APEX_HERO_REWORK_AIL.clock()))
       throw Error('Cannot reach real A1-ready UI state');
    const slot=SPAWN.trySpawnSlot({forceFirearm:true});
    if(!slot||slot.kind!=='WEAPON'||slot.phase!=='TELEGRAPH')
      throw Error('Real spawn failed to declare WEAPON TELEGRAPH');
    a.x=Math.max(95,Math.min(905,slot.x+(slot.x<500?190:-190)));
    a.y=slot.y;a.baseSpeed=0;
    b.x=slot.x<500?900:100;b.y=slot.y<500?900:100;b.baseSpeed=0;
    for(let i=0;i<186&&slot.phase==='TELEGRAPH';i++)AR.step(1/60);
    if(slot.phase!=='REVEALED'||slot.kind!=='WEAPON'||
      !G.APEX_ARSENAL_CONFIG.isHeroManipulableFloorWeapon(slot))
      throw Error('Normal Arsenal reveal did not become a typed legal World Weapon '+
        JSON.stringify({id:slot.weaponId,phase:slot.phase,kind:slot.kind}));
    G.__qaRealMagnet={slot,x:slot.x,y:slot.y,
      castsBefore:MAG.inspect(G.APEX_HERO_REWORK_AIL.clock()).fields
       .find(x=>x.combatant===ct)?.casts.a1||0};
    if(typeof G.draw==='function')G.draw();
    return {id:slot.weaponId,kind:slot.kind,phase:slot.phase,
      readyFrames:ready,castBefore:G.__qaRealMagnet.castsBefore,
      buttons:[...document.querySelectorAll('.skill[data-p="1"]')]
        .map(e=>({i:e.dataset.i,state:e.dataset.state,visible:e.getClientRects().length>0}))};
   });
   await (await page.$('#game-canvas')).screenshot({
     path:path.join(OUT,label+'-natural-before.png')});
   const uiButton=await page.$('.skill[data-p="1"][data-i="0"]');
   assert.ok(uiButton,label+' real Gold A1 skill button missing: '+JSON.stringify(liveSetup));
   await uiButton.click(); // real browser pointerdown + pointerup transaction.
   const liveResult=await page.evaluate(()=>{
     const G=window,AR=G.APEX_ARSENAL,HR=G.APEX_HERO_REWORK,
       MAG=G.APEX_MAGNET,[a]=G.fighters;
     const ct=HR.byCombatant(a),probe=G.__qaRealMagnet;
     let moved=0,frames=0;
     for(let i=0;i<24;i++){
       AR.step(1/60);frames++;
       moved=Math.max(moved,Math.hypot(
         probe.slot.x-probe.x,probe.slot.y-probe.y));
     }
     if(typeof G.draw==='function')G.draw();
     const fields=MAG.inspect(G.APEX_HERO_REWORK_AIL.clock()).fields;
     const castAfter=fields.find(f=>f.combatant===ct)?.casts.a1||0;
     return {id:probe.slot.weaponId,kind:probe.slot.kind,
       phase:probe.slot.phase,castBefore:probe.castsBefore,castAfter,moved,frames};
   });
   assert.equal(liveResult.castAfter,liveResult.castBefore+1,
     label+' HUD pointer release did not invoke real Magnet A1: '+
       JSON.stringify({liveSetup,liveResult}));
   assert.ok(liveResult.moved>2,
     label+' A1 did not pull genuinely spawned floor Weapon: '+
       JSON.stringify({liveSetup,liveResult}));
   await (await page.$('#game-canvas')).screenshot({
     path:path.join(OUT,label+'-natural-after.png')});
   console.log('PASS REAL OWNER MAGNET HUD POINTER + NATURAL SPAWN '+label+' '+
      JSON.stringify({liveSetup,liveResult}));
  }else for(const m of evaluated.measurements){
   assert.equal(m.frozen,m.eligible,label+' '+m.id+' wrong Frozen Equipment');
  }
  assert.deepEqual(errors,[],label+' browser page errors');
  await (await page.$('#game-canvas')).screenshot({path:path.join(OUT,label+'-after.png')});
  results.push({label,visible,initial,evaluated,errors,durationMs:now()-started});
  console.log('PASS D5 REAL GOLD CHROME '+label+' '+JSON.stringify(evaluated));
  await page.close();
 }
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(results,null,2));
 console.log('D5 WORLD WEAPON REAL GOLD CHROME: 4/4 PASS; 8 battle Canvas screenshots');
}finally{await browser.close();}
