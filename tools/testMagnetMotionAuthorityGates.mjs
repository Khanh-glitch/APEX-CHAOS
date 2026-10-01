#!/usr/bin/env node
// Magnet motion-authority gate: presentation intent must be the exact ordinary
// locomotion decision made inside Fighter.update, while pre-collision A2
// external motion remains an independent physical cause.
import { bootHarness } from './lib/crystalaHarness.mjs';

const H=await bootHarness(),{win,T}=H,HR=win.APEX_HERO_REWORK,PRES=win.APEX_MAGNET_PRESENTATION,GOLD=win.APEX_MAGNET_GOLD,AIL=win.APEX_HERO_REWORK_AIL;
const failures=[];
function gate(name,pass,detail){console.log(`${pass?'PASS':'FAIL'}  ${name} — ${JSON.stringify(detail)}`);if(!pass)failures.push(name);}
function fresh(p1='MAGNET',p2='ROBOT'){
  T.start(p1,p2);T.holdSpawns();HR.setAiEnabled(false);
  const fighters=H.fighters();for(const body of fighters){body.baseSpeed=0;body.x=body.id===fighters[0].id?300:800;body.y=500;}
  return fighters;
}
function state(body){const ct=HR.byCombatant(body);return{ct,gold:GOLD.inspect(ct).state,presentation:PRES.inspect(ct).state};}
function finiteHistory(gold){return gold&&gold.rig&&Object.values(gold.rig).every(part=>['x','y','r','sx','sy','vx','vy','vr','vsx','vsy'].every(key=>Number.isFinite(part[key])));}

try{
  const [magnet]=fresh();magnet.baseSpeed=450;magnet.dir.x=1;magnet.dir.y=0;magnet.x=300;
  HR.match.api.applyRootTo(magnet,.24);
  const rootedX=magnet.x;
  for(let i=0;i<16;i++)T.step(1/120,1/120);
  let snapshot=state(magnet),sample=snapshot.presentation.frameSample;
  gate('root-blocks-authoritative-ordinary-locomotion',Math.abs(magnet.x-rootedX)<1e-9&&!sample.motion.ordinaryAllowed,{x0:rootedX,x:magnet.x,motion:sample.motion});
  gate('root-blocks-donor-locomotion-proxy',!sample.motion.active&&Math.hypot(snapshot.gold.velocity.x,snapshot.gold.velocity.y)<1e-9,{motion:sample.motion,velocity:snapshot.gold.velocity});

  let release=null;
  for(let i=0;i<80;i++){
    T.step(1/120,1/120);snapshot=state(magnet);sample=snapshot.presentation.frameSample;
    if(sample.motion.active){release={tick:i,x:magnet.x,velocity:{...snapshot.gold.velocity},acceleration:{...snapshot.gold.acceleration},finite:finiteHistory(snapshot.gold)};break;}
  }
  const releaseX=magnet.x;
  for(let i=0;i<24;i++)T.step(1/120,1/120);
  snapshot=state(magnet);
  gate('root-release-resumes-with-donor-ramp',!!release&&release.x>rootedX&&Math.hypot(release.velocity.x,release.velocity.y)>0&&Math.hypot(release.velocity.x,release.velocity.y)<30&&release.finite&&magnet.x>releaseX&&snapshot.gold.velocity.x>100&&snapshot.gold.velocity.x<=420,{release,releaseX,finalX:magnet.x,finalVelocity:snapshot.gold.velocity});

  magnet.data.__hrHoldBody=true;const holdX=magnet.x;T.step(1/60,1/60);snapshot=state(magnet);sample=snapshot.presentation.frameSample;
  gate('explicit-body-hold-shares-authoritative-lock',Math.abs(magnet.x-holdX)<1e-9&&!sample.motion.ordinaryAllowed&&!sample.motion.active,{holdX,x:magnet.x,motion:sample.motion});
  win.exitArsenalQuestMode();
} catch(error){gate('root-release-integration-execution',false,String(error&&error.stack||error));try{win.exitArsenalQuestMode();}catch{}}

try{
  const [target,source]=fresh('MAGNET','MAGNET');target.x=400;source.x=550;target.baseSpeed=450;target.dir.x=1;target.dir.y=0;
  HR.match.api.applyRootTo(target,.6);const cast=HR.pressAbility(source,'A2'),x0=target.x;
  let sawExternal=false,last=null;
  for(let i=0;i<24;i++){
    T.step(1/120,1/120);const snapshot=state(target);last={x:target.x,motion:snapshot.presentation.frameSample.motion,velocity:{...snapshot.gold.velocity},root:{...snapshot.gold.root}};
    sawExternal=sawExternal||Math.hypot(last.motion.externalVx,last.motion.externalVy)>.01;
  }
  gate('root-keeps-a2-external-force-independent',cast.ok&&target.x<x0&&sawExternal&&!last.motion.active&&!last.motion.ordinaryAllowed&&last.motion.externalVx<0&&Math.abs(last.velocity.x)<1e-9&&Math.abs(last.root.x-target.x)<1e-9,{cast,x0,last});
  win.exitArsenalQuestMode();
} catch(error){gate('root-external-force-integration-execution',false,String(error&&error.stack||error));try{win.exitArsenalQuestMode();}catch{}}

console.log(`\n[MAGNET MOTION AUTHORITY] ${failures.length?'FAIL':'PASS'}`);if(failures.length)console.error(`FAILURES: ${failures.join(', ')}`);process.exit(failures.length?1:0);
