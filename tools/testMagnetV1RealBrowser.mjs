#!/usr/bin/env node
// MAGNET V1 R4 — real Chromium / real requestAnimationFrame scheduler proof.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';
import chromium, { inflate } from '@sparticuz/chromium';

const require=createRequire(import.meta.url),pkgRoot=path.dirname(path.dirname(require.resolve('@sparticuz/chromium')));
await inflate(path.join(pkgRoot,'bin','al2023.tar.br'));
process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||'');
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173',browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--autoplay-policy=no-user-gesture-required'],headless:true});
const page=await browser.newPage();await page.setViewport({width:1280,height:1100,deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/ERR_|favicon|Failed to load resource/.test(m.text()))errors.push(`console: ${m.text()}`);});
let telemetry;
try{
  await page.goto(url,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:60000});
  telemetry=await page.evaluate(async()=>{
    await window.__apexEnsureDeferredRuntimes('arsenalQuest');
    const waitFrames=n=>new Promise(resolve=>{let count=0;const next=()=>{if(++count>=n)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);});
    const waitUntil=async(predicate,frames=300)=>{for(let i=0;i<frames;i++){if(predicate())return true;await waitFrames(1);}return false;};
    window.APEX_HERO_REWORK.setAiEnabled(false);
    window.startArsenalQuestMode('MAGNET','MIRROR');
    const state=window.APEX_ARSENAL.state;state.spawnTimer=1e6;state.slots=[];state.unarmedFastConsumed=true;state.spawnHeld=true;
    const fighter=window.fighters[0],opponent=window.fighters[1],ct=window.APEX_HERO_REWORK.byCombatant(fighter),gold=window.APEX_MAGNET_GOLD,pres=window.APEX_MAGNET_PRESENTATION;
    fighter.baseSpeed=0;opponent.baseSpeed=0;fighter.x=500;fighter.y=500;opponent.x=900;opponent.y=900;
    const ready=await waitUntil(()=>gold.ready,600);
    let actorDraws=0,beforeDraws=0,afterDraws=0;
    const actor=gold.drawActor,beforeFx=gold.drawBefore,afterFx=gold.drawAfter;
    gold.drawActor=function(){actorDraws++;return actor.apply(this,arguments);};
    gold.drawBefore=function(){beforeDraws++;return beforeFx.apply(this,arguments);};
    gold.drawAfter=function(){afterDraws++;return afterFx.apply(this,arguments);};
    await waitFrames(4);
    const before={clock:Number(window.matchClock)||0,scheduler:{...pres.inspect(ct).scheduler},gold:gold.inspect(ct).state};
    await waitFrames(36);
    const after={clock:Number(window.matchClock)||0,scheduler:{...pres.inspect(ct).scheduler},gold:gold.inspect(ct).state,sample:pres.inspect(ct).state.frameSample,body:{x:fighter.x,y:fighter.y}};
    const slot={id:state.nextSlotId++,x:100,y:500,phase:'REVEALED',weaponId:'PISTOL',revealLeadSeconds:1.5,revealedFor:0,pickedBy:null,rejectedFor:{},spawnTime:state.time,predictedHeroETA:null,predictedRivalETA:null,earliestETA:null,predictedFighter:null};state.slots.push(slot);
    const cast=window.APEX_HERO_REWORK.pressAbility(fighter,'A1'),a1WallStart=performance.now();await waitFrames(24);const a1WallMs=performance.now()-a1WallStart,a1=gold.inspect(ct).state;
    const canvas=document.getElementById('game-canvas'),pixel=Array.from(canvas.getContext('2d').getImageData(Math.max(0,Math.floor(fighter.x)),Math.max(0,Math.floor(fighter.y)),1,1).data);
    const goldResource=performance.getEntriesByType('resource').find(entry=>entry.name.includes('/game/hero-rework/magnetGoldV1.js'));
    const report={ready,revision:{runtime:goldResource?new URL(goldResource.name).searchParams.get('v'):null,gold:gold.version,adapter:pres.version},before:{clock:before.clock,scheduler:before.scheduler,fixedSteps:before.gold.fixedSteps},after:{clock:after.clock,scheduler:after.scheduler,fixedSteps:after.gold.fixedSteps,frameCount:after.gold.frameCount,sample:after.sample,body:after.body},draws:{actor:actorDraws,before:beforeDraws,after:afterDraws},a1:{accepted:!!cast.ok,target:a1.a1Target,desired:a1.desiredA1Target,objects:a1.objects,rings:a1.effects.rings,wallMs:a1WallMs,meanFrameMs:a1WallMs/24},pixel};
    window.exitArsenalQuestMode();return report;
  });
}finally{await browser.close();}
const delta={clock:telemetry.after.clock-telemetry.before.clock,tickCalls:telemetry.after.scheduler.tickCalls-telemetry.before.scheduler.tickCalls,advancedFrames:telemetry.after.scheduler.advancedFrames-telemetry.before.scheduler.advancedFrames,duplicateCalls:telemetry.after.scheduler.duplicateCalls-telemetry.before.scheduler.duplicateCalls,fixedSteps:telemetry.after.fixedSteps-telemetry.before.fixedSteps};telemetry.delta=delta;telemetry.errors=errors;
const checks={
  'browser-assets-ready':telemetry.ready&&telemetry.revision.runtime==='20261001-magnet-v1-r2'&&telemetry.revision.gold==='2.0.0-canonical-engine'&&telemetry.revision.adapter==='2.0.0-thin-semantic-adapter',
  'real-raf-exactly-one-frame-owner':delta.tickCalls>=30&&delta.tickCalls===delta.advancedFrames&&delta.duplicateCalls===0,
  'real-raf-fixed-120-mapping':delta.clock>0&&Math.abs(delta.fixedSteps-delta.clock*120)<=3,
  'post-movement-sample-is-drawn-root':Math.hypot(telemetry.after.sample.after.x-telemetry.after.body.x,telemetry.after.sample.after.y-telemetry.after.body.y)<1e-9,
  'three-phase-render-called':telemetry.draws.actor>=30&&telemetry.draws.before===telemetry.draws.actor&&telemetry.draws.after===telemetry.draws.actor,
  'real-raf-a1-production-object-direction':telemetry.a1.accepted&&telemetry.a1.objects.a1===1&&telemetry.a1.target.x<-.5&&telemetry.a1.desired.x<-.99,
  'a1-field-render-frame-budget-measured':telemetry.a1.meanFrameMs>0&&telemetry.a1.meanFrameMs<40,
  'no-browser-runtime-errors':errors.length===0,
};
for(const[name,pass]of Object.entries(checks))console.log(`${pass?'PASS':'FAIL'}  ${name}`);console.log(JSON.stringify(telemetry,null,2));
if(process.env.MAGNET_BROWSER_REPORT)fs.writeFileSync(process.env.MAGNET_BROWSER_REPORT,JSON.stringify({generatedAt:new Date().toISOString(),url,checks,telemetry},null,2)+'\n');
const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(`\n[MAGNET REAL BROWSER] ${failed.length?'FAIL':'PASS'}`);if(failed.length)console.error(`FAILURES: ${failed.join(', ')}`);process.exit(failed.length?1:0);
