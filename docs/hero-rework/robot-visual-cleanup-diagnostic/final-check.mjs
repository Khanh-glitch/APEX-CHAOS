import fs from 'node:fs';import {execFileSync}from'node:child_process';import assert from'node:assert/strict';import puppeteer from'puppeteer-core';import chromium from'@sparticuz/chromium';
process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||'');
const OUT='docs/hero-rework/robot-visual-cleanup-diagnostic';
const metrics=JSON.parse(fs.readFileSync(`${OUT}/sharpness-metrics.json`));
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
const errors=[],result={};
async function boot(dpr,baseline=false){
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:dpr});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warn'&&m.text().includes('robot-presentation'))errors.push(m.text());});
 await page.evaluateOnNewDocument(()=>{window.__contexts=0;const AC=window.AudioContext;window.AudioContext=new Proxy(AC,{construct(T,a){window.__contexts++;return Reflect.construct(T,a);}});let seed=20260929;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
 if(baseline){const src=execFileSync('git',['show','bdf29a75770e2013e08bd2b005b8c4eae371b229:public/game/hero-rework/robotPresentationRuntime.js'],{encoding:'utf8'});await page.setRequestInterception(true);page.on('request',r=>r.url().includes('/game/hero-rework/robotPresentationRuntime.js')?r.respond({status:200,contentType:'application/javascript',body:src}):r.continue());}
 await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.APEX_ROBOT_PRESENTATION);
 await page.evaluate(()=>{
  const realDraw=window.draw;window.update=()=>{};window.draw=()=>{};
  window.F={realDraw,setup(){
   if(APEX_ARSENAL.state?.active)exitArsenalQuestMode();APEX_HERO_REWORK.setAiEnabled(false);startArsenalQuestMode('ROBOT','ICE');
   const s=APEX_ARSENAL.state;s.slots=[];s.spawnHeld=true;s.spawnTimer=1e6;s.unarmedFastConsumed=true;
   const[a,b]=fighters;a.x=a.y=500;a.baseSpeed=0;b.x=800;b.y=500;b.baseSpeed=0;
   F.a=a;F.b=b;F.st=APEX_ROBOT_PRESENTATION.getRobotState(a);F.st.lastPos={x:500,y:500};F.ctl=APEX_HERO_REWORK.abilityController(APEX_HERO_REWORK.byCombatant(a));
  },step(n=1){for(let i=0;i<n;i++)APEX_ARSENAL.step(1/60);},slot(x,y){const s=APEX_ARSENAL.state;const slot={id:s.nextSlotId++,x,y,phase:'REVEALED',weaponId:'PISTOL',revealLeadSeconds:1.5,revealedFor:0,pickedBy:null,rejectedFor:{},spawnTime:s.time};s.slots.push(slot);return slot;},
  set(o){const st=F.st;for(const k in o){if(k==='R'){for(const n in st.R){if(Array.isArray(st.R[n]))st.R[n].forEach((s,i)=>Object.assign(s,o.R[n][i]));else Object.assign(st.R[n],o.R[n]);}}else st[k]=structuredClone(o[k]);}},
  render(bg,hide=false){const c=document.getElementById('game-canvas'),g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.filter='none';g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);const parts=F.st.parts;if(hide)F.st.parts=[];F.a.draw(g);F.st.parts=parts;},
  bench(){const c=document.createElement('canvas');c.width=c.height=1000;const g=c.getContext('2d'),times=[];for(let i=0;i<180;i++){F.a.x=500+i%30*.25;const t=performance.now();g.clearRect(0,0,1000,1000);F.a.draw(g);g.getImageData(0,0,1,1);if(i>=30)times.push(performance.now()-t);}F.a.x=500;times.sort((a,b)=>a-b);return{samples:times.length,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p50Ms:times[75],p95Ms:times[142]};}}
  F.setup();
 });return page;
}
try{
for(const dpr of[1,2]){
 const page=await boot(dpr);
 const clip=await page.$eval('#game-canvas',el=>{const r=el.getBoundingClientRect(),b=parseFloat(getComputedStyle(el).borderLeftWidth),sc=el.clientWidth/el.width;return{x:r.x+b+500*sc-160,y:r.y+b+500*sc-160,width:320,height:320};});
 for(const state of['idle','lock','impact'])for(const[bg,color]of[['black','#080a0c'],['gray','#808080'],['white','#f4f4f4']]){
  await page.evaluate(({s,color})=>{F.set(s);F.render(color);},{s:metrics.runs[dpr-1].states[state],color});
  await page.screenshot({path:`${OUT}/background-matrix/dpr${dpr}-${state}-${bg}-FIX.png`,clip});
  if(state==='impact'){await page.evaluate(color=>F.render(color,true),color);await page.screenshot({path:`${OUT}/impact-isolation/dpr${dpr}-${bg}-FIX-no-world-particles.png`,clip});}
 }
 if(dpr===1){
  result.performanceFinal=await page.evaluate(()=>{F.setup();return F.bench();});
  Object.assign(result,await page.evaluate(()=>{
   F.setup();const robot=APEX_ROBOT_PRESENTATION;const c=document.createElement('canvas');c.width=c.height=1000;const g=c.getContext('2d');const hashes=[],sockets=[];
   for(const[x,y]of[[1,0],[0,1],[-1,0],[0,-1]]){F.a.setDir(x,y);g.clearRect(0,0,1000,1000);F.a.draw(g);const p=g.getImageData(350,350,300,300).data;let hash=2166136261;for(const b of p)hash=Math.imul(hash^b,16777619);hashes.push(hash>>>0);sockets.push(robot.getRobotWeaponSocketWorld(F.a));}
   const fixed=hashes.every(v=>v===hashes[0]);
   F.a.x=200;F.st.lastPos.x=200;F.b.x=850;F.b.y=160;const slot=F.slot(750,500);F.ctl.tryCast('A1','p1');let steps=0;while(!APEX_ARSENAL.weaponApi.getHolder(F.a)&&steps++<60)F.step();
   const holder=APEX_ARSENAL.weaponApi.getHolder(F.a);const realPickup=holder?.weaponId==='PISTOL'&&!!slot.pickedBy;
   const av=APEX_ARSENAL_AV,old=av.drawWeaponSprite,anchors=[];av.drawWeaponSprite=function(ctx,w,x,y,o){anchors.push({x,y});return old.call(this,ctx,w,x,y,o);};
   for(const aim of[0,Math.PI/2,Math.PI,-Math.PI/2]){holder.meta.aimAngle=aim;av.drawEquippedWeapon(g,F.a,holder);}av.drawWeaponSprite=old;
   const socket=robot.getRobotWeaponSocketWorld(F.a),attached=anchors.length===4&&anchors.every(a=>Math.hypot(a.x-socket.x,a.y-socket.y)<1e-8);
   F.step(40);const off=!F.st.trailOn&&F.st.trail.length===0;
   F.ctl.setCooldown('A1',0);const start=F.st.T;F.slot(320,700);F.ctl.tryCast('A1','p1');F.step(18);const fresh=F.st.trail.length>0&&F.st.trail.every(p=>p.t>=start);
   F.setup();F.ctl.tryCast('A2','p1');F.step(35);const hits=[];const bloodBefore=APEX_ARSENAL_FEEL.stats.splatters;
   for(const side of['left','right']){F.b.x=side==='left'?200:800;F.b.y=500;APEX_ARSENAL.weaponApi.equip(F.b,'PISTOL');const hp=F.a.hp;let n=0;while(F.a.hp===hp&&n++<80)F.step();const h=APEX_ARSENAL.weaponApi.getHolder(F.b);if(h)h.meta.nextShot=100;const event=APEX_HERO_REWORK.AIL.bus.ring.filter(e=>e.type==='RobotA2Hit').at(-1);hits.push({hpLost:hp-F.a.hp,direction:event?.payload.direction,stress:structuredClone(F.st.stress)});F.step(6);}
   const robotBlood=APEX_ARSENAL_FEEL.stats.splatters===bloodBefore;
   F.b.x=800;F.b.y=500;const hp=F.b.hp;
   APEX_ARSENAL.weaponApi.fireBullet({owner:F.a,x:F.a.x+80,y:500,angle:0,speed:1800,damage:2,weapon:'PISTOL'});
   for(let i=0;i<30&&F.b.hp===hp;i++)F.step();
   return{fixedOrientation:fixed,orientationHashes:hashes,realPistolPickup:realPickup,pistolSocketAttached:attached,socketAnchors:anchors,trailOff:off,freshTrail:fresh,hits,robotBloodSuppressed:robotBlood,nonRobotBloodPreserved:APEX_ARSENAL_FEEL.stats.splatters>bloodBefore,realFire:F.b.hp<hp,audioContexts:__contexts};
  }));
  await page.evaluate(async()=>{
   F.setup();F.a.baseSpeed=240;F.b.x=850;F.b.y=180;F.a.setDir(1,0);
   const c=document.getElementById('game-canvas'),stream=c.captureStream(30),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:1800000}),chunks=[];
   rec.ondataavailable=e=>chunks.push(e.data);rec.start();
   for(let i=0;i<210;i++){if(i===40)F.a.setDir(0,1);if(i===80)F.a.setDir(-1,0);if(i===120){F.a.setDir(0,-1);F.ctl.tryCast('A2','p1');}if(i===170)F.a.setDir(1,0);F.step();cameraShake=0;cameraZoom=1;F.realDraw();await new Promise(r=>setTimeout(r,1000/60));}
   await new Promise(r=>{rec.onstop=r;rec.stop();});stream.getTracks().forEach(t=>t.stop());window.__movement=Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  fs.writeFileSync(`${OUT}/movement-stability.webm`,Buffer.from(await page.evaluate(()=>__movement)));
 }
 await page.evaluate(()=>exitArsenalQuestMode());await page.goto('about:blank');await page.close();
}
const baseline=await boot(1,true);result.performanceBaseline=await baseline.evaluate(()=>F.bench());await baseline.close();
assert(result.fixedOrientation);assert(result.realPistolPickup);assert(result.pistolSocketAttached);assert(result.trailOff&&result.freshTrail);assert(result.hits[0].direction.x>0&&result.hits[1].direction.x<0);assert(result.robotBloodSuppressed&&result.nonRobotBloodPreserved&&result.realFire);assert.equal(result.audioContexts,1);assert.equal(errors.length,0,errors.join('\n'));
result.runtimeErrors=errors;result.robotGates=JSON.parse(fs.readFileSync('/home/user/robot-diagnostic-gates/robot-gates-report.json')).summary;result.productionBuild='PASS';
fs.writeFileSync(`${OUT}/focused-validation.json`,JSON.stringify(result,null,2));console.log('Focused safety PASS',result);
}finally{await browser.close();}
