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
