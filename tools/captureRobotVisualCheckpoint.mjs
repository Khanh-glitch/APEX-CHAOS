// Bounded owner checkpoint only. Production bundle, real Chromium, controlled
// ROBOT vs ICE. No mock renderer/damage and no repository-wide evidence refresh.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import chromium, { inflate } from '@sparticuz/chromium';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const chromiumRoot = path.dirname(path.dirname(require.resolve('@sparticuz/chromium')));
await inflate(path.join(chromiumRoot, 'bin/al2023.tar.br'));
process.env.LD_LIBRARY_PATH = '/tmp/al2023/lib:' + (process.env.LD_LIBRARY_PATH || '');
const out = process.env.ROBOT_PROOF_DIR || 'docs/hero-rework/robot-visual-correction/proofs';
fs.mkdirSync(out, {recursive:true});
const browser = await puppeteer.launch({executablePath:await chromium.executablePath(), args:[...chromium.args,'--autoplay-policy=no-user-gesture-required'], headless:true,ignoreDefaultArgs:['--mute-audio']});
const page = await browser.newPage();
await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.evaluateOnNewDocument(()=>{
  window.__audioContexts=0;
  const Native=window.AudioContext;
  window.AudioContext=new Proxy(Native,{construct(T,args){window.__audioContexts++;return Reflect.construct(T,args);}});
});
await page.goto(process.env.APEX_APP_URL || 'http://127.0.0.1:4173',{waitUntil:'networkidle0'});
await page.waitForFunction(()=>window.Fighter && window.APEX_ROBOT_PRESENTATION);
await page.mouse.click(30,30);
await page.evaluate(async()=>{
  ensureBattleAudioReady(); await audioCtx.resume();
  await APEX_ROBOT_PRESENTATION.loadRobotAudio();
  // The production draw loop stays live. Only its automatic simulation is
  // replaced by fixed, paced calls to the production AQ.step entry point.
  window.update=()=>{};
  window.checkpoint={
    setup(){
      if (APEX_ARSENAL.state?.active) exitArsenalQuestMode();
      APEX_HERO_REWORK.setAiEnabled(false);
      startArsenalQuestMode('ROBOT','ICE');
      const s=APEX_ARSENAL.state;
      s.spawnTimer=1e6;s.slots=[];s.spawnHeld=true;s.unarmedFastConsumed=true;
      const [a,b]=fighters;
      a.x=400;a.y=500;a.setDir(1,0);
      b.x=850;b.y=180;b.setDir(0,1);b.baseSpeed=0;
      // Controlled opponent only: never cast or move into the Robot.
      checkpoint.a=a;checkpoint.b=b;
      checkpoint.ctl=APEX_HERO_REWORK.abilityController(APEX_HERO_REWORK.byCombatant(a));
      checkpoint.st=APEX_ROBOT_PRESENTATION.getRobotState(a);
      checkpoint.st.lastPos={x:a.x,y:a.y};
      checkpoint.events=[];
      checkpoint.hitSnapshots=[];
      checkpoint.fireCount=0;
    },
    slot(x,y,weaponId='PISTOL'){
      const s=APEX_ARSENAL.state;
      const slot={id:s.nextSlotId++,x,y,phase:'REVEALED',weaponId,revealLeadSeconds:1.5,revealedFor:0,pickedBy:null,rejectedFor:{},spawnTime:s.time};
      s.slots.push(slot);return slot;
    },
    snap(){const {a,st}=checkpoint;return {x:a.x,y:a.y,dir:{...a.dir},tilt:st.R.tilt.x,lag:st.R.lagX.x,pose:{...st.POSE},trail:st.trail.length,trailOn:st.trailOn,contactT:Number.isFinite(st.contactT)?st.contactT:null,time:st.T,socket:APEX_ROBOT_PRESENTATION.getRobotWeaponSocketWorld(a),weapon:APEX_ARSENAL.weaponApi.getHolder(a)?.weaponId};},
    async run(frames,each){
      for(let i=0;i<frames;i++){
        if(each)each(i);
        APEX_ARSENAL.step(1/60);
        await new Promise(r=>setTimeout(r,1000/60));
      }
    },
    async record(){
      const cv=document.getElementById('game-canvas');
      const dest=audioCtx.createMediaStreamDestination();battleAudioMaster.connect(dest);
      const stream=cv.captureStream(30);
      for(const track of dest.stream.getAudioTracks())stream.addTrack(track);
      const chunks=[];const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:2200000});
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      checkpoint.recording={rec,chunks,dest,stream};rec.start();
    },
    async stop(){
      const {rec,chunks,dest,stream}=checkpoint.recording;
      await new Promise(r=>{rec.onstop=r;rec.stop();});
      battleAudioMaster.disconnect(dest);stream.getTracks().forEach(t=>t.stop());
      const buf=await new Blob(chunks,{type:'video/webm'}).arrayBuffer();
      return Array.from(new Uint8Array(buf));
    }
  };
  const bus=APEX_HERO_REWORK.AIL.bus, emit=bus.emit;
  bus.emit=function(type,payload){
    const result=emit.call(this,type,payload);
    if(type.startsWith('Robot')) checkpoint.events?.push({type,payload,time:checkpoint.st?.T});
    if(type==='RobotA2Hit') checkpoint.hitSnapshots?.push({payload,stress:JSON.parse(JSON.stringify(checkpoint.st.stress)),blood:APEX_ARSENAL_FEEL.stats.splatters});
    return result;
  };
  const fire=APEX_HERO_REWORK.onFireBullet;
  APEX_HERO_REWORK.onFireBullet=function(spec){checkpoint.fireCount++;return fire.call(this,spec);};
});
const groups=[];
async function start(name){console.log('Capture',name);const dir=path.join(out,name);fs.mkdirSync(dir,{recursive:true});await page.evaluate(()=>checkpoint.setup());await page.evaluate(()=>checkpoint.record());groups.push({name,dir,frames:[]});}
async function shot(label){const g=groups.at(-1);await page.$eval('#game-canvas',el=>el.scrollIntoView({block:'center'}));await (await page.$('#game-canvas')).screenshot({path:path.join(g.dir,label+'.png')});g.frames.push({label,...await page.evaluate(()=>checkpoint.snap())});}
async function stop(){const g=groups.at(-1);const bytes=await page.evaluate(()=>checkpoint.stop());fs.writeFileSync(path.join(g.dir,'sequence.webm'),Buffer.from(bytes));g.events=await page.evaluate(()=>checkpoint.events);}
try{
await start('01-idle-move-fixed-orientation');
await shot('idle');
for(const [label,dx,dy] of [['right',1,0],['down',0,1],['left',-1,0],['up',0,-1]]){
 await page.evaluate(async({dx,dy})=>{checkpoint.a.setDir(dx,dy);await checkpoint.run(24);},{dx,dy});await shot(label);
}
await stop();
// Socket invariant in an unchanged spring pose, independent of all four headings.
assert(await page.evaluate(()=>{const f=checkpoint.a,robot=APEX_ROBOT_PRESENTATION;const coords=[];for(const [x,y] of [[1,0],[0,1],[-1,0],[0,-1]]){f.setDir(x,y);coords.push(robot.getRobotWeaponSocketWorld(f));}return coords.every(p=>p.x===coords[0].x&&p.y===coords[0].y); }));

await start('02-real-weapon-socket');
await page.evaluate(()=>{checkpoint.a.x=220;checkpoint.st.lastPos.x=220;checkpoint.slot(700,500);checkpoint.ctl.tryCast('A1','p1');});
await page.evaluate(()=>checkpoint.run(26));await shot('real-a1-pickup');
assert.equal(await page.evaluate(()=>APEX_ARSENAL.weaponApi.getHolder(checkpoint.a)?.weaponId),'PISTOL');
// Hold the real holder in its prefire phase until the controlled shot.
await page.evaluate(()=>{const h=APEX_ARSENAL.weaponApi.getHolder(checkpoint.a);checkpoint.holder=h;checkpoint.a.baseSpeed=120;});
for(const [label,dx,dy] of [['aim-right',1,0],['aim-down',0,1],['aim-left',-1,0],['aim-up',0,-1]]){
 await page.evaluate(async({dx,dy})=>{
  const {a,b,holder:h}=checkpoint;
  a.setDir(dx,dy);b.x=a.x+dx*260;b.y=a.y+dy*260;
  await checkpoint.run(8,()=>{h.meta.aimAngle=Math.atan2(dy,dx);h.elapsed=-10;h.meta.nextShot=10;});
 },{dx,dy});await shot(label);
}
await page.evaluate(async()=>{const {a,b,holder:h}=checkpoint;b.x=850;b.y=500;a.setDir(1,0);h.elapsed=10;h.meta.nextShot=0;const before=checkpoint.fireCount;for(let i=0;i<45&&checkpoint.fireCount===before;i++)await checkpoint.run(1);});await shot('real-fire');
assert(await page.evaluate(()=>checkpoint.fireCount>0));await stop();

await start('03-a1-sequence');
await page.evaluate(()=>{checkpoint.a.x=200;checkpoint.st.lastPos.x=200;checkpoint.slot(840,500);checkpoint.ctl.tryCast('A1','p1');});
await page.evaluate(()=>checkpoint.run(5));await shot('recognize');
assert.equal(await page.evaluate(()=>checkpoint.a.x),200);
await page.evaluate(()=>checkpoint.run(6));await shot('commit');
await page.evaluate(()=>checkpoint.run(7));await shot('launch-fresh-trail');
await page.evaluate(()=>checkpoint.run(7));await shot('real-contact');
await page.evaluate(()=>checkpoint.run(13));await shot('settle');
await page.evaluate(()=>checkpoint.run(24));await shot('trail-off');
assert(await page.evaluate(()=>!checkpoint.st.trailOn&&checkpoint.st.trail.length===0));
// Same actor, second cast: no historical samples may enter the new launch.
await page.evaluate(()=>{
 checkpoint.ctl.setCooldown('A1',0);
 checkpoint.secondStart=checkpoint.st.T;
 checkpoint.slot(350,700);checkpoint.ctl.tryCast('A1','p1');
});
await page.evaluate(()=>checkpoint.run(18));await shot('second-cast-fresh-trail');
assert(await page.evaluate(()=>checkpoint.st.trail.every(p=>p.t>=checkpoint.secondStart)));
await page.evaluate(()=>checkpoint.run(65));
await stop();

await start('04-a2-sequence');
await page.evaluate(()=>{checkpoint.a.baseSpeed=0;checkpoint.ctl.tryCast('A2','p1');});
await page.evaluate(()=>checkpoint.run(5));await shot('index');
await page.evaluate(()=>checkpoint.run(9));await shot('structural-lock');
await page.evaluate(()=>checkpoint.run(40));await shot('active');
await page.evaluate(()=>checkpoint.run(129));await shot('release');
await page.evaluate(()=>checkpoint.run(36));await shot('settled');await stop();

await start('05-a2-controlled-gunfire');
await page.evaluate(()=>{checkpoint.a.x=500;checkpoint.a.baseSpeed=0;checkpoint.st.lastPos.x=500;checkpoint.ctl.tryCast('A2','p1');checkpoint.bloodBefore=APEX_ARSENAL_FEEL.stats.splatters;});
await page.evaluate(()=>checkpoint.run(25));
for(const side of ['left','right']){
 await page.evaluate(async(side)=>{
  const {a,b}=checkpoint;b.x=side==='left'?200:800;b.y=a.y;b.setDir(side==='left'?1:-1,0);
  // Real equip and production holder/fire→projectile→collision→damage path.
  APEX_ARSENAL.weaponApi.equip(b,'PISTOL');
  const before=checkpoint.hitSnapshots.length;
  for(let i=0;i<75 && checkpoint.hitSnapshots.length===before;i++)await checkpoint.run(1);
  const h=APEX_ARSENAL.weaponApi.getHolder(b);if(h)h.meta.nextShot=100;
 },side);await shot(side+'-impact');
 await page.evaluate(()=>checkpoint.run(8));await shot(side+'-force-route');
}
const hits=await page.evaluate(()=>({hits:checkpoint.hitSnapshots,before:checkpoint.bloodBefore,after:APEX_ARSENAL_FEEL.stats.splatters}));
assert.equal(hits.hits.length,2);assert(hits.hits[0].payload.direction.x>0);assert(hits.hits[1].payload.direction.x<0);assert.equal(hits.before,hits.after);
await page.evaluate(()=>checkpoint.run(115));await shot('release');await stop();

// Audio-only bounded fixture: no sixth visual group. Capture the real graph
// for no-target and passive test thresholds, in addition to five clip tracks.
await page.evaluate(async()=>{
 checkpoint.setup();
 const dest=audioCtx.createMediaStreamDestination();battleAudioMaster.connect(dest);
 const chunks=[];const rec=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus'});
 rec.ondataavailable=e=>chunks.push(e.data);rec.start();checkpoint.audioRecording={dest,chunks,rec};
 checkpoint.ctl.tryCast('A1','p1');await checkpoint.run(60);
 const ct=APEX_HERO_REWORK.byCombatant(checkpoint.a);
 ct.skills.PASSIVE.cfg={...ct.skills.PASSIVE.cfg,milestoneThresholds:[1,2]};
 checkpoint.ctl.setCooldown('A1',8);
 checkpoint.nonRobotBloodBefore=APEX_ARSENAL_FEEL.stats.splatters;
 APEX_ARSENAL.weaponApi.aqDamage(checkpoint.b,2,checkpoint.a,'PISTOL');
 await checkpoint.run(120);
});
const bytes=await page.evaluate(async()=>{const {rec,chunks,dest}=checkpoint.audioRecording;await new Promise(r=>{rec.onstop=r;rec.stop();});battleAudioMaster.disconnect(dest);dest.stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));});
fs.writeFileSync(path.join(out,'sfx-no-target-passive.webm'),Buffer.from(bytes));
const safety=await page.evaluate(()=>({contexts:__audioContexts,nonRobotBlood:APEX_ARSENAL_FEEL.stats.splatters>checkpoint.nonRobotBloodBefore,audio:APEX_ROBOT_PRESENTATION.audioEvidence()}));
assert.equal(safety.contexts,1);assert(safety.nonRobotBlood);
for(const row of safety.audio){assert(row.decoded,row.event);assert(row.requested>0,row.event);assert(row.sourceStarted>0,row.event);assert.equal(row.errors.length,0,row.event);}
assert.equal(errors.length,0,errors.join('\n'));
fs.writeFileSync(path.join(out,'sfx-runtime.json'),JSON.stringify(safety.audio,null,2));
fs.writeFileSync(path.join(out,'focused-checks.json'),JSON.stringify({productionBrowser:await browser.version(),authorityHead:'2026fbbf70687d0ecb682774ef3bb03b96b8478d',audioContexts:safety.contexts,nonRobotBlood:safety.nonRobotBlood,hits,errors,groups},null,2));
console.log('PASS: five proof groups, real playback starts, controlled hits, pickup/fire, non-Robot blood, one AudioContext');
} finally {await browser.close();}
