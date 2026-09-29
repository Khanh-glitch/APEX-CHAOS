import fs from'node:fs';import {execFileSync}from'node:child_process';import path from'node:path';import{createRequire}from'node:module';import puppeteer from'puppeteer-core';import chromium,{inflate}from'@sparticuz/chromium';
const require=createRequire(import.meta.url);await inflate(path.join(path.dirname(path.dirname(require.resolve('@sparticuz/chromium'))),'bin/al2023.tar.br'));process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||'');
const OUT='docs/hero-rework/hunter-v1.1/evidence';const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const errors=[];
try{const page=await browser.newPage();await page.setViewport({width:1440,height:1000});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text());});await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.APEX_HUNTER_PRESENTATION?.ready,{timeout:60000});
await page.evaluate(()=>{
 const draw=window.draw;window.draw=()=>{};window.update=()=>{};
 window.Q={draw,setup(){if(APEX_ARSENAL.state?.active)exitArsenalQuestMode();APEX_HERO_REWORK.setAiEnabled(false);startArsenalQuestMode('HUNTER','ICE');const s=APEX_ARSENAL.state;s.slots=[];s.spawnHeld=true;s.spawnTimer=1e6;s.unarmedFastConsumed=true;this.a=fighters[0];this.b=fighters[1];this.a.x=400;this.a.y=500;this.b.x=850;this.b.y=200;this.a.setDir(1,0);this.b.setDir(0,1);this.ct=APEX_HERO_REWORK.byCombatant(this.a);this.ctl=APEX_HERO_REWORK.abilityController(this.ct);},step(n=1){for(let i=0;i<n;i++)APEX_ARSENAL.step(1/60);APEX_COMBAT_HUD.sync();cameraShake=0;this.draw();},cast(slot){return this.ctl.tryCast(slot,'p1');},snap(){return{body:{x:this.a.x,y:this.a.y},skills:structuredClone(Object.fromEntries(['A1','A2'].map(k=>[k,{charges:this.ct.skills[k].charges,rechargeLeft:this.ct.skills[k].rechargeLeft,cd:this.ctl.cooldownLeft(k)}]))),rig:APEX_HUNTER_PRESENTATION.inspect(this.a),traps:APEX_HERO_REWORK.match.world.snares.map(t=>({id:t.id,x:t.x,y:t.y,phase:t.phase,t:t.phaseTime,pose:t.visual?._rt?.arms.map(a=>a.root.y)})),cache:{...APEX_HUNTER_PRESENTATION.cacheStats}}}};Q.setup();Q.step();
});
const frameDir='/tmp/hunter-v10-reel-frames';fs.mkdirSync(frameDir,{recursive:true});
await page.evaluate(()=>{
 const el=document.createElement('div');el.id='hunter-proof-caption';el.style.cssText='position:fixed;z-index:9999;top:27px;left:270px;right:270px;text-align:center;color:#eaffdb;background:#101b18e8;padding:9px;font:13px monospace;pointer-events:none;border-bottom:1px solid #8fb652';document.body.append(el);
 window.reel={events:[],cache:[],phases:[],fps:30};
 const bus=APEX_HERO_REWORK.AIL.bus,emit=bus.emit;bus.emit=function(type,payload){if(['Cast','SnarePlaced','SnareTriggered','HunterTrapPhase','PounceWeak','HunterDodge','WeakApplied'].includes(type))reel.events.push({frame:reel.frame,type,payload});return emit.call(this,type,payload);};
 window.reelFrame=f=>{
  reel.frame=f;const t=f/30;
  const place=(x,y,dx,dy)=>{Q.a.x=x;Q.a.y=y;Q.a.setDir(dx,dy);};
  const reset=()=>{Q.setup();Q.b.x=850;Q.b.y=100;Q.b.setDir(0,1);};
  if(f===0)reset();
  if(f===90)place(450,300,1,0);if(f===96)Q.cast('A1');
  if(f===126)place(600,500,-1,0);if(f===132)Q.cast('A1');
  if(f===162)place(400,720,1,0);if(f===168)Q.cast('A1');
  if(f===204){const s=APEX_HERO_REWORK.match.world.snares[0];Q.b.x=s.x;Q.b.y=s.y-120;Q.b.setDir(0,1);}
  if(f===720||f===1080){reset();}
  if(f===774||f===1134){place(200,500,1,0);Q.b.x=800;Q.b.y=500;Q.b.setDir(0,1);}
  if(f===780||f===1140)Q.cast('A2');
  if(f===787||f===1147)Q.b.setDir(0,-1);
  if(f===810){place(500,500,1,0);Q.b.x=200;Q.b.y=500;Q.b.setDir(0,1);APEX_HERO_REWORK.setSeed(7);APEX_ARSENAL.weaponApi.fireBullet({owner:Q.b,x:Q.b.x+75,y:Q.b.y,angle:0,speed:6000,damage:2,weapon:'PISTOL'});}
  if(f===849)APEX_ARSENAL.weaponApi.equip(Q.b,'PISTOL');
  if(f===1170){place(400,500,0,-1);Q.b.x=750;Q.b.y=500;Q.b.setDir(0,1);APEX_HERO_REWORK.setSeed(7);APEX_ARSENAL.weaponApi.spawnThrownMelee(Q.b,'STORMBREAKER',Math.PI,{});}
  if(f===1215)APEX_ARSENAL.weaponApi.equip(Q.a,'PISTOL');
  if(f===1380)reset();if(f===1440)Q.cast('A1');if(f===1500)Q.cast('A1');if(f===1560)Q.cast('A2');
  if(f===1680){reset();place(150,150,1,0);Q.b.x=850;Q.b.y=850;Q.b.setDir(0,1);Q.cast('A2');}
  if(f>=1685&&f<=1704){Q.b.x=Q.a.x<500?900:100;Q.b.y=Q.a.y<500?900:100;}
  if(f===1860)reset();if(f===1920)Q.cast('A1');
  if(f===1965){const s=APEX_HERO_REWORK.match.world.snares[0];Q.b.x=s.x;Q.b.y=s.y-120;Q.b.setDir(0,1);}
  if(f===2100)reset();
  Q.step(2);
  const snares=APEX_HERO_REWORK.match.world.snares,st=Q.ct.skills.A1;
  let label=t<3?'HUNTER V10 | native locomotion':t<6.8?'Gold A1 | opposite movement directions | physical retreat':t<10?'Three independent ROOT traps | real opponent trigger':t<24?'Sequential recharge | no extra A1 cooldown lock':t<26?'A2 | live target chase':t<27?'0.16s prelaunch | target direction change | swept contact':t<28.3?'Killer Instinct | seeded eligible real projectile':t<36?'Real PISTOL interaction | no prey state, no dodge proc':t<38?'T6 exclusion | production thrown-weapon test':t<40.5?'Real Pounce -> WEAK | real STORMBREAKER projectile':t<46?'Arsenal weapon interaction | WEAK damage window':t<56?'Repeated skills | independent cleanup':t<62?'Controlled exceptional escape | no fake CATCH / WEAK':t<70?'ROOT lifecycle repeat | trigger -> PIN -> RELEASE':'Rematch reset | 3/3 charges | no stale traps';
  el.textContent=`${label} · A1 ${st.charges}/3${st.rechargeLeft>0?' +1 '+st.rechargeLeft.toFixed(1)+'s':''} · ${snares.map(s=>s.phase.toUpperCase()).join(' / ')||'NO TRAPS'} · materials ${APEX_HUNTER_PRESENTATION.cacheStats.derivations}`;
  if(f%30===0)reel.phases.push({t,charges:st.charges,traps:snares.map(s=>({id:s.id,phase:s.phase})),hunter:APEX_HUNTER_PRESENTATION.inspect(Q.a).phase,weak:APEX_HERO_REWORK.AIL.StatusResolver.remaining(Q.b,'WEAK')});
  if(f===195)reel.three=Q.snap();
  if(f>=2100){
   Q.b.x=900;Q.b.y=100;Q.b.setDir(0,1);
   if(f===2103){Q.a.x=400;Q.a.y=250;Q.a.setDir(1,0);}
   if(f===2106)Q.cast('A1');
   if(f===2136){Q.a.x=600;Q.a.y=500;Q.a.setDir(-1,0);}
   if(f===2139)Q.cast('A1');
   if(f===2172){Q.a.x=400;Q.a.y=750;Q.a.setDir(1,0);}
   if(f===2175)Q.cast('A1');
   const ss=APEX_HERO_REWORK.match.world.snares,skill=Q.ct.skills.A1;
   document.getElementById('hunter-proof-caption').textContent=`Independent trap/cache check | A1 ${skill.charges}/3 | ${ss.length} traps | ${ss.map(s=>s.phase.toUpperCase()).join(' / ')} | material derivations ${APEX_HUNTER_PRESENTATION.cacheStats.derivations}`;
   if(f===2235)reel.finalThree=Q.snap();
   Q.draw();
  }
 };
});
for(let f=0;f<2250;f++){await page.evaluate(f=>reelFrame(f),f);await page.screenshot({path:`${frameDir}/${String(f).padStart(5,'0')}.jpg`,type:'jpeg',quality:80});if(f%300===0)console.log('Reel frame',f);}
const data=await page.evaluate(()=>({events:reel.events,phases:reel.phases,three:reel.three,finalThree:reel.finalThree,cache:APEX_HUNTER_PRESENTATION.cacheStats,final:Q.snap()}));
await page.evaluate(()=>exitArsenalQuestMode());await page.goto('about:blank');
fs.writeFileSync(`${OUT}/reel-telemetry.json`,JSON.stringify({...data,errors,frames:2250,fps:30,durationSeconds:75,capture:'Deterministic production frame-step: two real 1/60-second Arsenal steps per full-viewport output frame. No interpolation, no gameplay speedup, no demo actor/projectile loop. Captions are fixture annotations; HUD is production DOM. Scene arrangements and exceptional escape are controlled fixtures. Silent video.'},null,2));
execFileSync(require('@ffmpeg-installer/ffmpeg').path,['-y','-framerate','30','-i',`${frameDir}/%05d.jpg`,'-c:v','libvpx-vp9','-b:v','0','-crf','34','-row-mt','1','-pix_fmt','yuv420p',`${OUT}/hunter-v10-owner-reel.webm`],{stdio:'ignore',timeout:1500000});
fs.rmSync(frameDir,{recursive:true,force:true});
console.log('75s reel saved. Errors:',errors);
}finally{await browser.close();}
