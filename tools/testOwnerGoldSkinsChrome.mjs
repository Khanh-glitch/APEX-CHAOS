// CP8 REAL owner Gold skin proof, desktop and Android: no procedural QA artwork.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const chrome=process.env.CHROME_PATH;
if(!chrome)throw Error('CHROME_PATH required');
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
const captureDir=process.env.APEX_CP8_CAPTURE_DIR||'';
if(captureDir)fs.mkdirSync(captureDir,{recursive:true});
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
let errors=0;
for(const caseInfo of [{name:'desktop',viewport:{width:1440,height:900}},{name:'android',viewport:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}}]){
 const page=await browser.newPage(),exceptions=[],warnings=[];
 try{
  await page.setViewport(caseInfo.viewport);
  page.on('pageerror',e=>exceptions.push(String(e)));
  page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text())});
  await page.goto(url,{waitUntil:'load',timeout:50000});
  await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:65000});
  await page.evaluate(async()=>{
   await window.__apexEnsureDeferredRuntimes('arsenalProduct');
   window.__APEX_TEST_MODE=true;
   const C=window.APEX_COSMETICS;
   if(!C.variants('hero','ROBOT').some(s=>s.id==='ecobot')||!C.variants('weapon','RPG_7').some(s=>s.id==='vua-he'))throw Error('Owner GOLD skin not registered');
   if(!C.equip('p1','hero','ROBOT','ecobot').ok)throw Error('ECOBOT equip rejected');
   if(!C.equip('p1','weapon','RPG_7','vua-he').ok)throw Error('Vua He equip rejected');
   if(!C.equip('p2','weapon','RPG_7','default').ok)throw Error('P2 ORIGINAL equip rejected');
   const result=await C.ready([{side:'p1',heroId:'ROBOT'},{side:'p2',heroId:'HUNTER'}]);
   if(!result?.ready||result.assetCount<23)throw Error('Gold asset decode gate incomplete '+JSON.stringify(result));
   window.__cp8ReadyAssets=result.assetCount;
  });
  await page.waitForSelector('#apex-boot-start',{visible:true,timeout:85000});
  await page.click('#apex-boot-start');
  await page.waitForFunction(()=>typeof window.APEX_GOLD_SHELL_NAVIGATE==='function'&&!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:85000});
  assert.equal(await page.evaluate(()=>window.APEX_GOLD_SHELL_NAVIGATE('fighter',{mode:'bot'})),true);
  await page.waitForSelector('.rosterCard[data-hero="newbot"]',{visible:true,timeout:90000});
  await page.$eval('.rosterCard[data-hero="newbot"]',el=>el.click());
  await page.$eval('#lockIn',el=>el.click());
  await page.$eval('.rosterCard[data-hero="hunter"]',el=>el.click());
  await page.$eval('#lockIn',el=>el.click());
  await page.waitForFunction(()=>document.body.classList.contains('battle-hud-open')&&document.getElementById('battleHudHost')?.contains(document.getElementById('game-canvas'))&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:110000});
  const evidence=await page.evaluate(()=>{
   const G=window,A=G.APEX_ARSENAL,W=A.weaponApi,C=G.APEX_COSMETICS;
   const H=G.APEX_HERO_REWORK,[a,b]=G.fighters;
   H.setAiEnabled(false);
   if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0}
   A.state.spawnTimer=1e6;A.state.spawnHeld=true;A.state.unarmedFastConsumed=true;A.state.slots=[];
   projectiles.length=0;a.baseSpeed=0;b.baseSpeed=0;
   // Native homing RPG must have a distant forward target, not an off-axis target it reaches by t=.75s.
   a.x=100;a.y=440;b.x=980;b.y=440;a.setDir(1,0);b.setDir(-1,0);a.hp=1000;b.hp=1000;
   if(!W.equip(a,'RPG_7')||!W.equip(b,'RPG_7'))throw Error('Native RPG equipment refused');
   let p=null,q=null,steps=0;
   for(;steps<180;steps++){
    A.step(1/60);
    p=projectiles.find(z=>z.aq&&z.kind==='rocket'&&z.weapon==='RPG_7'&&z.owner===a);
    q=projectiles.find(z=>z.aq&&z.kind==='rocket'&&z.weapon==='RPG_7'&&z.owner===b);
    if(p&&q)break;
   }
   if(!p||!q)throw Error('Two native Rocket carriers unavailable '+steps);
   if(p.cosmetic?.skinId!=='vua-he'||q.cosmetic?.skinId!=='default')throw Error('P1/P2 Gold receipt mismatch');
   if(!Object.isFrozen(p.cosmetic)||!Object.isFrozen(q.cosmetic))throw Error('Projectile cosmetic receipt not frozen');
   if(p.damage!==q.damage||p.radius!==q.radius)throw Error('Cosmetic mutated RPG damage/radius');
   const ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=1200;ctx.canvas.height=900;
   const skinProjectile=C.render('projectile',ctx,p.cosmetic,p);
   const originalProjectile=C.render('projectile',ctx,q.cosmetic,q);
   if(skinProjectile!==true||originalProjectile!==false)throw Error('Gold/ORIGINAL rocket draw hooks rejected');
   W.drawArsenalProjectiles(ctx);
   // Catch the real Robot jaw/socket draw route, not just a direct call to a
   // cosmetic hook: P1's *held launcher* must be the selected Gold skin.
   const AV=G.APEX_ARSENAL_AV;
   const originalDrawWeapon=AV.drawWeaponSprite;
   let realRobotGoldWeaponCalls=0;
   AV.drawWeaponSprite=function(c,id,x,y,options){
     if(id==='RPG_7'&&options?.mode==='equipped'&&options?.cosmetic?.skinId==='vua-he')
       realRobotGoldWeaponCalls++;
     return originalDrawWeapon.apply(this,arguments);
   };
   try{if(typeof G.draw==='function')G.draw();}
   finally{AV.drawWeaponSprite=originalDrawWeapon;}
   if(realRobotGoldWeaponCalls<1)throw Error('NEWBOT held RPG_7 bypassed the equipped Gold launcher skin');
   const st=G.APEX_ROBOT_PRESENTATION?.getRobotState(a);
   if(!st)throw Error('Native robot spring state unavailable');
   const springs={};for(const [k,v] of Object.entries(st.R))springs[k]=Array.isArray(v)?v.map(s=>s.x):v.x;
   const hCtx=document.createElement('canvas').getContext('2d');hCtx.canvas.width=900;hCtx.canvas.height=900;
   hCtx.translate(450,450);
   const ecoDraw=C.render('actor',hCtx,C.capture('p1','hero','ROBOT'),{x:0,y:0,kind:'ROBOT',robot:{time:st.T,springs,armor:st.armor,held:st.held,mode:st.mode,ticks:st.ticks,lockFlash:st.lockFlash}});
   if(ecoDraw!==true)throw Error('ECO V17 owner-rig did not draw');
   // CP9 regression: a replacement silhouette alone cannot pass Gold fidelity.
   // Exercise the actual native AIL presentation bus and assert world FX callbacks
   // emit visible pixels for one passive beat. No gameplay cooldown or damage edits.
   const bus=G.APEX_HERO_REWORK_AIL?.bus;
   if(!bus)throw Error('Native Robot event bus unavailable');
   if(bus.__robotPresentationHooked!==true)
     throw Error('Robot presentation native AIL bus hook is not installed');
   if(G.__apexRobotEventBody?.({fighterId:a.id})!==a)
     throw Error('Robot presentation event body ownership resolver differs from P1');
   const beforeFx=st.ecoFxSerial||0;
   // The native match may already have reached milestone 1 while we sampled
   // its real RPG carriers. Advance the milestone *test fixture*, not gameplay.
   // Replaying a previous milestone is SUPPOSED to be ignored by Robot's owner
   // event dedup guard and cannot prove the cosmetic FX branch.
   const nextMilestone=Math.max(0,Number(st._lastMilestoneNumber)||0)+1;
   bus.emit('RobotPassiveMilestone',{hero:'ROBOT',fighterId:a.id,milestone:nextMilestone});
   // Native Robot GOLD schedules the passive pulse at +0.20 s via the SAME
   // authoritative spring/event queue. Check after a real engine advance,
   // not synchronously at emission (which would reject the correct choreography).
   // These 15 real RPG simulation frames simultaneously build the smoke path.
   for(let j=0;j<15;j++)A.step(1/60);
   if((st.ecoFxSerial||0)<=beforeFx||!st.ecoFxEvents?.some(e=>e.kind==='passive'&&e.serial>beforeFx))
     throw Error('ECO Gold presentation event failed for next milestone '+nextMilestone+
       ' body='+a.id+' busHook='+bus.__robotPresentationHooked+
       ' last='+st._lastMilestoneNumber+' fxBefore='+beforeFx+' fxAfter='+st.ecoFxSerial);
   const worldPose={x:a.x,y:a.y,kind:'ROBOT',robot:{
      time:st.T+.06,mode:st.mode,armor:st.armor,vx:st.vxw,vy:st.vyw,
      trailOn:st.trailOn,dashTrail:st.trail,
      fxEvents:st.ecoFxEvents
   }};
   const wc=document.createElement('canvas');wc.width=1200;wc.height=900;
   const wctx=wc.getContext('2d');
   if(C.render('worldBack',wctx,C.capture('p1','hero','ROBOT'),worldPose)!==true)
      throw Error('ECO Gold rear FX not registered/dispatchable');
   // At birth alpha is exactly zero in Gold; sample the next presentation tick.
   worldPose.robot.time=st.T+.12;
   if(C.render('worldFront',wctx,C.capture('p1','hero','ROBOT'),worldPose)!==true)
      throw Error('ECO Gold leaf VFX not registered/dispatchable');
   const worldPixels=wctx.getImageData(0,0,1200,900).data;
   let alphaPixelCount=0;
   for(let k=3;k<worldPixels.length;k+=4)if(worldPixels[k])alphaPixelCount++;
   if(alphaPixelCount<8)throw Error('ECO Gold native passive has no visible leaf material');

   // CP9 smoke proof MUST be acquired from the ACTUAL RPG carrier after
   // native physics has produced sampled flight history. A first-frame rocket
   // sprite does NOT prove the exhaust is attached, smooth or Gold-faithful.
   if(!projectiles.includes(p)||p.visual.length<8)
      throw Error('Gold smoke missing continuous native rocket flight samples');
   const smokeCanvas=document.createElement('canvas');
   smokeCanvas.width=1200;smokeCanvas.height=900;
   W.drawArsenalProjectiles(smokeCanvas.getContext('2d'));
   const smokeEarly=smokeCanvas.toDataURL('image/png');
   const earlyAge=p.age;
   // Compare with the owner's Gold t=0.84s rather than an unrelated early
   // age. ONLY the authoritative Arsenal simulation advances this carrier.
   for(let n=0;n<80&&p.age<.84&&projectiles.includes(p);n++)A.step(1/60);
   if(!projectiles.includes(p)||p.exploded||p.age<.84-1e-6)
     throw Error('Gold t=.84s native rocket flight unavailable age='+p.age+' x='+p.x+' y='+p.y);
   const smokeMatched=document.createElement('canvas');
   smokeMatched.width=1200;smokeMatched.height=900;
   W.drawArsenalProjectiles(smokeMatched.getContext('2d'));
   const smokeFrame=smokeMatched.toDataURL('image/png');
   const painted=hCtx.getImageData(450,450,1,1).data[3];
   // Save pixels from exactly the approved native presentation callbacks; these
   // are not synthetic CSS mockups or screenshots of a separate Gold studio.
   if(G.__cp8Evidence)throw Error('CP8 evidence namespace already in use');
   G.__cp8Evidence={actor:hCtx.canvas.toDataURL('image/png'),ecoWorld:wc.toDataURL('image/png'),
      rocket:ctx.canvas.toDataURL('image/png'),rocketSmokeEarly:smokeEarly,rocketSmoke:smokeFrame};
   const oldOwner=p.owner;p.owner=b;
   W.drawArsenalProjectiles(ctx);
   if(p.cosmetic?.skinId!=='vua-he')throw Error('Reflection changed Gold identity');
   p.owner=oldOwner;
   projectiles.splice(projectiles.indexOf(q),1);
   // Now test the REAL wall-triggered blast after capturing the full-length
   // flight. The old .08s forced fuse could expire at the engine's removal
   // seam before the native detonation callback, leaving a false QA failure.
   // Crossing the arena boundary exercises the same authoritative v43Detonate.
   const worldEdge=typeof GAME_SIZE==='number'?GAME_SIZE:1024;
   p.x=worldEdge-8;p.y=490;p.vx=500;p.vy=0;p.life=.35;
   for(let i=0;i<30&&!p.exploded;i++)A.step(1/60);
   if(!p.exploded)throw Error('Native Rocket did not detonate');
   const blast=A.state.visuals?.find(v=>v.kind==='v43_blast'&&v.cosmetic?.skinId==='vua-he');
   if(!blast||blast.maxLife<1.37)throw Error('Gold V7 blast lifetime missing '+JSON.stringify(blast));
   const drawBlast=C.render('blast',ctx,blast.cosmetic,{...blast,age:.4});
   if(!drawBlast)throw Error('Gold V7 smoke/full-face renderer did not render');
   // Sample timeline WITHOUT advancing damage/collision or forging a second hit.
   // These PNGs permit owner comparison against the supplied Gold keyframes.
   for(const age of [.20,.43,.91,1.20]){
     const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
     if(!C.render('blast',canvas.getContext('2d'),blast.cosmetic,{...blast,age,kind:'v43_blast'}))
       throw Error('Gold blast frame renderer rejected age '+age);
     G.__cp8Evidence['blast-'+String(Math.round(age*100)).padStart(3,'0')]=canvas.toDataURL('image/png');
   }
   return {readyAssets:G.__cp8ReadyAssets,realRobotGoldWeaponCalls,carriers:steps,p1Skin:p.cosmetic.skinId,p2Skin:q.cosmetic.skinId,ecoDraw,painted,blastLife:blast.maxLife,exploded:p.exploded,smokeEarlyAge:earlyAge,smokeMatchedAge:p.age,hp:[a.hp,b.hp]};
  });
  assert.equal(exceptions.length,0,'Chrome page errors: '+exceptions.join('\n'));
  if(captureDir){
   const frames=await page.evaluate(()=>window.__cp8Evidence||null);
   assert.deepEqual(Object.keys(frames||{}).sort(),[
     'actor','ecoWorld','rocket','rocketSmokeEarly','rocketSmoke','blast-020','blast-043','blast-091','blast-120'].sort());
   for(const [name,data] of Object.entries(frames)){
     assert.match(data,/^data:image\/png;base64,/,'Evidence must be a lossless PNG');
     fs.writeFileSync(path.join(captureDir,`${caseInfo.name}-${name}.png`),
       Buffer.from(data.slice('data:image/png;base64,'.length),'base64'));
   }
   await page.screenshot({path:path.join(captureDir,`${caseInfo.name}-battle-ui.png`)});
  }
  assert.equal(warnings.filter(s=>s.includes('[cosmetic] renderer failed')).length,0,'Gold renderer exceptions: '+warnings.join('\n'));
  console.log('CP8 OWNER GOLD REAL CHROME PASS '+caseInfo.name+' '+JSON.stringify(evidence));
 }catch(e){errors++;console.error('CP8 OWNER GOLD REAL CHROME FAIL '+caseInfo.name+' '+String(e?.stack||e)+' warnings='+warnings.slice(-8).join(' | '));}
 finally{await page.close()}
}
await browser.close();if(errors)process.exitCode=1;
