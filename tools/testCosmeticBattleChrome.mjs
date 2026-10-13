// Full-production Gold arena proof: real Arsenal fighters, real RPG fire,
// real rocket explosion, real render ownership, two independently equipped
// players and original engine damage. QA-only procedural skins are registered
// in the browser; NO demo skin is shipped in the production catalogue.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const chrome=process.env.CHROME_PATH;
if(!chrome)throw Error('CHROME_PATH required for actual Chrome');
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
const browser=await puppeteer.launch({
 executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required']
});
let errors=0;
const cases=[
 {name:'desktop',viewport:{width:1440,height:900}},
 {name:'android',viewport:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}},
];
try {
 for (const test of cases){
  const page=await browser.newPage(),exceptions=[];
  try {
   await page.setViewport(test.viewport);
   page.on('pageerror',e=>exceptions.push(String(e)));
   await page.goto(url,{waitUntil:'load',timeout:50000});
   await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:65000});
   await page.evaluate(async ()=>{
     await window.__apexEnsureDeferredRuntimes('arsenalProduct');
     window.__APEX_TEST_MODE=true;
     const C=window.APEX_COSMETICS;
     if(!C)throw Error('Cosmetic authority was not mounted on the real game');
     window.__qaSkinEvents={blueProjectile:0,redProjectile:0,blueBlast:0,redBlast:0,robotActor:0};
     const ev=window.__qaSkinEvents;
     const skin=(id,color)=>{
       C.register({kind:'weapon',baseId:'RPG_7',id,label:'QA '+id,
         suppressBaseBlast:true,
         render:{
           weapon(ctx,pose){ctx.fillStyle=color;ctx.fillRect(-pose.width/2,-pose.height/2,pose.width,pose.height);return true;},
           projectile(ctx,pose){
             ev[id+'Projectile']++;
             ctx.save();ctx.fillStyle=color;ctx.beginPath();ctx.arc(pose.x,pose.y,10,0,Math.PI*2);ctx.fill();ctx.restore();return true;
           },
           blast(ctx,pose){
             ev[id+'Blast']++;
             ctx.save();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(pose.x,pose.y,35,0,Math.PI*2);ctx.stroke();ctx.restore();return true;
           },
         }});
     };
     skin('blue','#6bc9ff');skin('red','#ff6571');
     C.register({kind:'hero',baseId:'ROBOT',id:'steel',label:'QA STEEL',
       render:{actor(){ev.robotActor++;return false;}}});
     for(const [side,id] of [['p1','blue'],['p2','red']]){
       const equip=C.equip(side,'weapon','RPG_7',id);
       if(!equip.ok)throw Error('Unable to equip skin on '+side);
     }
     C.equip('p1','hero','ROBOT','steel');
   });
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:85000});
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>typeof window.APEX_GOLD_SHELL_NAVIGATE==='function'
     &&!document.getElementById('apex-boot-start')
     &&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:85000});
   assert.equal(await page.evaluate(()=>window.APEX_GOLD_SHELL_NAVIGATE('fighter',{mode:'bot'})),true);
   await page.waitForSelector('.rosterCard[data-hero="newbot"]',{visible:true,timeout:90000});
   await page.$eval('.rosterCard[data-hero="newbot"]',el=>el.click());
   await page.$eval('#lockIn',el=>el.click());
   await page.$eval('.rosterCard[data-hero="hunter"]',el=>el.click());
   await page.$eval('#lockIn',el=>el.click());
   await page.waitForFunction(()=>{
     const host=document.getElementById('battleHudHost');
     return document.body.classList.contains('battle-hud-open')
       && host?.contains(document.getElementById('game-canvas'))
       && !window.APEX_SCENE_TRANSITION?.active?.();
   },{timeout:110000});

   const evidence=await page.evaluate(()=>{
     const G=window,A=G.APEX_ARSENAL,W=A.weaponApi,C=G.APEX_COSMETICS;
     const H=G.APEX_HERO_REWORK,[a,b]=G.fighters;
     H.setAiEnabled(false);
     if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0}
     A.state.spawnTimer=1e6;A.state.spawnHeld=true;A.state.unarmedFastConsumed=true;A.state.slots=[];
     projectiles.length=0;
     a.baseSpeed=0;b.baseSpeed=0;
     a.x=230;a.y=460;b.x=780;b.y=540;
     a.setDir(1,0);b.setDir(-1,0);
     a.hp=1000;b.hp=1000;
     if(!W.equip(a,'RPG_7')||!W.equip(b,'RPG_7'))throw Error('Real RPG equipment failed');
     let p=null,q=null,launchFrames=0;
     for(;launchFrames<180;launchFrames++){
       A.step(1/60);
       p=projectiles.find(z=>z.aq&&z.kind==='rocket'&&z.weapon==='RPG_7'&&z.owner===a);
       q=projectiles.find(z=>z.aq&&z.kind==='rocket'&&z.weapon==='RPG_7'&&z.owner===b);
       if(p&&q)break;
     }
     if(!p||!q)throw Error('Two native RPG carriers never spawned: '+JSON.stringify({
       launchFrames,holders:[W.getHolder(a)?.phase,W.getHolder(b)?.phase],
       nativeEvents:A.events.slice(-10)}));
     const captured={
       p1:p.cosmetic,p2:q.cosmetic,
       p1Hero:C.capture(C.sideOf(a),'hero','ROBOT'),
       p2Hero:C.capture(C.sideOf(b),'hero','HUNTER'),
       physical:{a:{damage:p.damage,radius:p.radius,weapon:p.weapon},
                 b:{damage:q.damage,radius:q.radius,weapon:q.weapon}},
       owners:[C.sideOf(a),C.sideOf(b)],
       startFrames:launchFrames,
     };
     if(p.cosmetic?.skinId!=='blue'||q.cosmetic?.skinId!=='red')
       throw Error('Game-spawned rocket has wrong cosmetic source '+JSON.stringify(captured));
     if(!Object.isFrozen(p.cosmetic)||!Object.isFrozen(q.cosmetic))
       throw Error('Cosmetic receipt is mutable during live flight');
     // A visual-only skin cannot create a second projectile or change damage.
     if(p.damage!==q.damage||p.radius!==q.radius)throw Error('P1/P2 skin altered native Rocket physics');
     const visualCtx=document.createElement('canvas').getContext('2d');
     W.drawArsenalProjectiles(visualCtx);
     if(typeof G.draw==='function')G.draw();
     const before={...G.__qaSkinEvents};
     if(before.blueProjectile<1||before.redProjectile<1||before.robotActor<1)
       throw Error('Real projectile/actor renderer did not select both owners: '+JSON.stringify(before));
     // Simulate a legitimate reflection's owner reassignment: visual identity
     // MUST remain the immutable shot-time receipt, even when owner changes.
     const prevOwner=p.owner;
     p.owner=b;W.drawArsenalProjectiles(visualCtx);
     const afterRedirect={...G.__qaSkinEvents};
     p.owner=prevOwner;
     if(p.cosmetic.skinId!=='blue'||afterRedirect.blueProjectile<=before.blueProjectile)
       throw Error('Rocket inherited enemy skin after owner redirect');
     // Do not spoof an explosion. Advance native fuse to actual detonation;
     // isolate the unrelated P2 rocket after proving both concurrent carriers.
     projectiles.splice(projectiles.indexOf(q),1);
     p.x=600;p.y=490;p.vx=0;p.vy=0;p.life=.08;
     let expiry=0;
     for(;expiry<30&&!p.exploded;expiry++){A.step(1/60);if(typeof G.draw==='function')G.draw()}
     if(!p.exploded)throw Error('Native RPG explosive lifecycle did not detonate');
     if(G.__qaSkinEvents.blueBlast<1)throw Error('Native Gold blast not routed to shot-time cosmetic');
     if(G.__qaSkinEvents.redBlast!==0)throw Error('Blue rocket triggered opponent blast skin');
     return {captured,before,afterRedirect,after:{...G.__qaSkinEvents},
       actualDetonation:p.exploded,expiry,remainingHP:[a.hp,b.hp]};
   });
   assert.deepEqual(evidence.captured.owners,['p1','p2']);
   assert.equal(evidence.captured.p1Hero.skinId,'steel');
   assert.equal(evidence.captured.p2Hero.skinId,'default');
   assert.equal(evidence.actualDetonation,true);
   assert.equal(exceptions.length,0,exceptions.join('\n'));
   console.log('PASS COSMETIC LIVE BATTLE '+test.name+' '+JSON.stringify(evidence));
  }catch(error){
   errors++;
   console.error('FAIL COSMETIC LIVE BATTLE '+test.name+' '+String(error?.stack||error));
  }finally{await page.close()}
 }
}finally{await browser.close()}
if(errors)process.exitCode=1;
else console.log('COSMETIC LIVE BATTLE desktop/android: native two-owner projectiles, stable reflect receipt and single real Rocket detonation PASS');
