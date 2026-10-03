import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';import chromium,{inflate} from '@sparticuz/chromium';
const require=createRequire(import.meta.url);await inflate(path.join(path.dirname(path.dirname(require.resolve('@sparticuz/chromium'))),'bin/al2023.tar.br'));process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||'');
const out='docs/hero-rework/robot-final/passive-completion';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const errors=[],shots=[];
try{const page=await browser.newPage();await page.setViewport({width:1440,height:1000});page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.APEX_ROBOT_PRESENTATION);await page.mouse.click(20,20);
await page.evaluate(()=>{
 const drawGame=window.draw;window.update=()=>{};window.draw=()=>{};APEX_HERO_REWORK.setAiEnabled(false);startArsenalBattleMode('ROBOT','ICE');
 const[a,b]=fighters,hr=APEX_HERO_REWORK,api=APEX_ARSENAL.weaponApi,ctl=hr.abilityController(hr.byCombatant(a));const aq=APEX_ARSENAL.state;aq.slots=[];aq.spawnHeld=true;aq.spawnTimer=1e6;aq.unarmedFastConsumed=true;
 const events=[],emit=hr.AIL.bus.emit;hr.AIL.bus.emit=function(type,payload){if(type.startsWith('RobotPassive')||type==='MilestoneRefund')events.push({type,payload});return emit.call(this,type,payload);};
 window.proof={a,b,hr,api,ctl,events,drawGame,
 state:()=>hr.robotPassiveHud(a),step(n=1){for(let i=0;i<n;i++)APEX_ARSENAL.step(1/120);},
 place(){a.x=250;a.y=500;b.x=600;b.y=500;a.setDir(1,0);b.setDir(1,0);},
 shoot(){this.place();const hp=b.hp;api.fireBullet({owner:a,x:a.x+a.radius+5,y:a.y,angle:0,speed:1800,damage:2,weapon:'PISTOL'});let n=0;while(b.hp===hp&&n++<180)this.step();if(b.hp===hp)throw Error('controlled real projectile missed');},
 to(value){let n=0;while(this.state().cumulative<value&&n++<80)this.shoot();if(n>=80)throw Error('threshold not reached');},
 castA1(){this.place();b.y=850;aq.slots=[{id:aq.nextSlotId++,x:a.x+240,y:a.y,phase:'REVEALED',weaponId:'TOWER_SHIELD',revealLeadSeconds:1.5,revealedFor:0,pickedBy:null,rejectedFor:{},spawnTime:aq.time}];const cast=ctl.tryCast('A1','p1');if(!cast.ok)throw Error('A1 failed');this.step(100);},
 snapshot(){APEX_COMBAT_HUD.sync();cameraShake=0;this.drawGame();return{state:this.state(),burst:APEX_COMBAT_HUD.debug().sides[0].burst,hud:document.getElementById('p1-robot-passive').innerText,cooldowns:{A1:ctl.cooldownLeft('A1'),A2:ctl.cooldownLeft('A2')}};}};
});
async function shot(name){const s=await page.evaluate(()=>proof.snapshot());shots.push({name,...s});await page.screenshot({path:`${out}/${name}.png`});}
await page.evaluate(()=>proof.to(100));await shot('01-before-150');
await page.evaluate(()=>proof.to(150));await shot('02-first-milestone');
await page.evaluate(()=>{proof.castA1();proof.to(300);});await shot('03-A1-refund');
await page.evaluate(()=>{proof.to(435);while(proof.ctl.cooldownLeft('A1')>.35)proof.step();proof.to(450);});await shot('04-clamped-refund');
await page.evaluate(()=>{while(proof.ctl.cooldownLeft('A1')>0)proof.step();if(!proof.ctl.tryCast('A2','p1').ok)throw Error('A2 failed');proof.to(600);});await shot('05-A2-refund');
await page.evaluate(()=>{while(proof.ctl.cooldownLeft('A2')>0)proof.step();proof.to(900);});await shot('06-ready-no-refund');
await new Promise(r=>setTimeout(r,1400));await shot('07-burst-expired-progress-persists');
const events=await page.evaluate(()=>proof.events),audio=await page.evaluate(()=>APEX_ROBOT_PRESENTATION.audioEvidence());
await page.evaluate(()=>{exitArsenalBattleMode();startArsenalBattleMode('ROBOT','ICE');APEX_COMBAT_HUD.sync();proof.drawGame();});
const reset=await page.evaluate(()=>APEX_HERO_REWORK.robotPassiveHud(fighters[0]));
await page.screenshot({path:`${out}/08-match-reset.png`});await page.evaluate(()=>exitArsenalBattleMode());await page.goto('about:blank');
const ms=events.filter(e=>e.type==='RobotPassiveMilestone'),up=events.filter(e=>e.type==='RobotPassiveUpgrade');
assert.equal(audio.find(a=>a.event==='robot_passive_milestone').sourceStarted,6);assert.equal(audio.find(a=>a.event==='robot_passive_upgrade').sourceStarted,3);assert.equal(ms.length,6);assert.equal(up.length,3);assert.equal(up[0].payload.refund,.5);assert(up[1].payload.refund>0&&up[1].payload.refund<1);assert.equal(up[2].payload.slot,'A2');assert.equal(shots[0].state.reached,0);assert.equal(shots[6].burst,null);assert.equal(shots[6].state.reached,6);assert.equal(reset.reached,0);assert.equal(errors.length,0);
fs.writeFileSync(`${out}/browser-proof.json`,JSON.stringify({browser:await browser.version(),method:'Real fireBullet projectiles through Arsenal step and damage adapters. Real A1/A2 casts and naturally elapsed cooldowns; no milestone, HP, cooldown or HUD state injection. Actor positions/directions reset between controlled shots. AI/spawns disabled.',shots,events,audio,reset,runtimeErrors:errors,pass:true},null,2));
}finally{await browser.close();}
