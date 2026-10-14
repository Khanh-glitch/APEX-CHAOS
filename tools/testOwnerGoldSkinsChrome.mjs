// CP8 REAL owner Gold skin proof, desktop and Android: no procedural QA artwork.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const chrome=process.env.CHROME_PATH;
if(!chrome)throw Error('CHROME_PATH required');
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
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
   a.x=230;a.y=460;b.x=780;b.y=540;a.setDir(1,0);b.setDir(-1,0);a.hp=1000;b.hp=1000;
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
   if(typeof G.draw==='function')G.draw();
   const st=G.APEX_ROBOT_PRESENTATION?.getRobotState(a);
   if(!st)throw Error('Native robot spring state unavailable');
   const springs={};for(const [k,v] of Object.entries(st.R))springs[k]=Array.isArray(v)?v.map(s=>s.x):v.x;
   const hCtx=document.createElement('canvas').getContext('2d');hCtx.canvas.width=900;hCtx.canvas.height=900;
   hCtx.translate(450,450);
   const ecoDraw=C.render('actor',hCtx,C.capture('p1','hero','ROBOT'),{x:0,y:0,kind:'ROBOT',robot:{time:st.T,springs,armor:st.armor,held:st.held,mode:st.mode,ticks:st.ticks,lockFlash:st.lockFlash}});
   if(ecoDraw!==true)throw Error('ECO V17 owner-rig did not draw');
   const painted=hCtx.getImageData(450,450,1,1).data[3];
   const oldOwner=p.owner;p.owner=b;
   W.drawArsenalProjectiles(ctx);
   if(p.cosmetic?.skinId!=='vua-he')throw Error('Reflection changed Gold identity');
   p.owner=oldOwner;
   projectiles.splice(projectiles.indexOf(q),1);
   p.x=600;p.y=490;p.vx=0;p.vy=0;p.life=.08;
   for(let i=0;i<30&&!p.exploded;i++)A.step(1/60);
   if(!p.exploded)throw Error('Native Rocket did not detonate');
   const blast=A.state.visuals?.find(v=>v.kind==='v43_blast'&&v.cosmetic?.skinId==='vua-he');
   if(!blast||blast.maxLife<1.37)throw Error('Gold V7 blast lifetime missing '+JSON.stringify(blast));
   const drawBlast=C.render('blast',ctx,blast.cosmetic,{...blast,age:.4});
   if(!drawBlast)throw Error('Gold V7 smoke/full-face renderer did not render');
   return {readyAssets:G.__cp8ReadyAssets,carriers:steps,p1Skin:p.cosmetic.skinId,p2Skin:q.cosmetic.skinId,ecoDraw,painted,blastLife:blast.maxLife,exploded:p.exploded,hp:[a.hp,b.hp]};
  });
  assert.equal(exceptions.length,0,'Chrome page errors: '+exceptions.join('\n'));
  assert.equal(warnings.filter(s=>s.includes('[cosmetic] renderer failed')).length,0,'Gold renderer exceptions: '+warnings.join('\n'));
  console.log('CP8 OWNER GOLD REAL CHROME PASS '+caseInfo.name+' '+JSON.stringify(evidence));
 }catch(e){errors++;console.error('CP8 OWNER GOLD REAL CHROME FAIL '+caseInfo.name+' '+String(e?.stack||e)+' warnings='+warnings.slice(-8).join(' | '));}
 finally{await page.close()}
}
await browser.close();if(errors)process.exitCode=1;
