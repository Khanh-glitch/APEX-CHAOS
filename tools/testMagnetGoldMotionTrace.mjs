#!/usr/bin/env node
// MAGNET V1 R2 — canonical six-part motion traces.
// Scheduler integration is proved separately. This deterministic engine gate
// drives explicit resolved root samples and checks Gold-authored part ordering.
import { bootHarness } from './lib/crystalaHarness.mjs';

const H=await bootHarness(),{win,T}=H;
const HR=win.APEX_HERO_REWORK,GOLD=win.APEX_MAGNET_GOLD,DT=1/120;
const failures=[];
function gate(name,ok,detail){console.log(`${ok?'PASS':'FAIL'}  ${name} — ${JSON.stringify(detail)}`);if(!ok)failures.push(name);}
const deadline=Date.now()+12000;while(!GOLD.ready&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
T.start('MAGNET','MIRROR');T.holdSpawns();HR.setAiEnabled(false);
const fighter=H.fighters()[0],ct=HR.byCombatant(fighter);fighter.baseSpeed=0;
const partIds=['core','spine','polL','polR','lobeL','lobeR'];
function pose(){const rig=GOLD.inspect(ct).state.rig;return Object.fromEntries(partIds.map(id=>[id,{x:rig[id].x,y:rig[id].y,r:rig[id].r,sx:rig[id].sx,sy:rig[id].sy}]));}
function distance(a,b,id){const x=a[id],y=b[id];return Math.hypot(y.x-x.x,y.y-x.y,(y.r-x.r)*80,(y.sx-x.sx)*80,(y.sy-x.sy)*80);}
function reset(x=500,y=500){GOLD.teardown(ct);fighter.x=x;fighter.y=y;GOLD.updateFrame(ct,DT,{root:{before:{x,y},after:{x,y},radius:fighter.radius}});}
function frame(vx=0,vy=0,extra={}){const before={x:fighter.x,y:fighter.y},after={x:Math.max(fighter.radius,Math.min(1000-fighter.radius,before.x+vx*DT)),y:Math.max(fighter.radius,Math.min(1000-fighter.radius,before.y+vy*DT))},speed=Math.hypot(vx,vy);fighter.x=after.x;fighter.y=after.y;GOLD.updateFrame(ct,DT,{...extra,motion:{x:speed?vx/speed:0,y:speed?vy/speed:0,active:speed>0,contactVx:vx,contactVy:vy},root:{before,after,radius:fighter.radius}});}
function frames(n,vx=0,vy=0,extra={}){for(let i=0;i<n;i++)frame(vx,vy,extra);return pose();}

try{
  reset();const start0=pose();frame(480,0);const startEarly=pose();frames(8,480,0);const startNear=pose();frames(6,480,0);const startFar=pose();frames(6,480,0);const startLobes=pose();
  const movementTrace={early:Object.fromEntries(partIds.map(id=>[id,distance(start0,startEarly,id)])),near:Object.fromEntries(partIds.map(id=>[id,distance(start0,startNear,id)])),far:Object.fromEntries(partIds.map(id=>[id,distance(start0,startFar,id)])),lobes:Object.fromEntries(partIds.map(id=>[id,distance(start0,startLobes,id)]))};
  gate('motion-start-core-before-poles',movementTrace.early.core>movementTrace.early.polR*2&&movementTrace.early.core>movementTrace.early.polL*2,movementTrace);
  gate('motion-start-near-before-far',movementTrace.near.polR>movementTrace.near.polL*1.15,movementTrace);
  gate('motion-start-far-then-lobes',movementTrace.far.polL>movementTrace.near.polL&&movementTrace.lobes.lobeL>movementTrace.far.lobeL&&movementTrace.lobes.lobeR>movementTrace.far.lobeR,movementTrace);

  const travel0=pose();const travel=frames(24,480,0);gate('sustained-travel-six-part-secondary',partIds.filter(id=>distance(travel0,travel,id)>.02).length>=5,Object.fromEntries(partIds.map(id=>[id,distance(travel0,travel,id)])));
  const preStop=pose();frame(0,0);const stopNow=pose();frames(8,0,0);const stopSecondary=pose();frames(8,0,0);const stopSettle=pose();
  const stopTrace={now:Object.fromEntries(partIds.map(id=>[id,distance(preStop,stopNow,id)])),secondary:Object.fromEntries(partIds.map(id=>[id,distance(preStop,stopSecondary,id)])),settle:Object.fromEntries(partIds.map(id=>[id,distance(preStop,stopSettle,id)]))};
  gate('stop-poles-lobes-spine-sequence',stopTrace.now.polR>0&&stopTrace.secondary.polL>stopTrace.now.polL&&stopTrace.settle.lobeL>stopTrace.secondary.lobeL&&stopTrace.settle.spine>stopTrace.now.spine,stopTrace);

  reset();frames(30,480,0);const turn0=pose();frame(-480,0);const turnNow=pose();frames(7,-480,0);const turnSecondary=pose();frames(7,-480,0);const turnLobes=pose();
  const turnTrace={now:Object.fromEntries(partIds.map(id=>[id,distance(turn0,turnNow,id)])),secondary:Object.fromEntries(partIds.map(id=>[id,distance(turn0,turnSecondary,id)])),lobes:Object.fromEntries(partIds.map(id=>[id,distance(turn0,turnLobes,id)]))};
  gate('hard-turn-hierarchy',turnTrace.now.core>0&&turnTrace.now.polL>turnTrace.now.polR&&turnTrace.secondary.spine>turnTrace.now.spine&&turnTrace.secondary.polR>turnTrace.now.polR&&turnTrace.lobes.lobeL>turnTrace.secondary.lobeL,turnTrace);

  reset(303.75,500);frames(60,-450,0);const wall0=pose();frame(-450,0);const wallContact=pose();frames(9,-450,0);const wallTransfer=pose();frames(12,-450,0);const wallSettle=pose();
  const wallTrace={contact:Object.fromEntries(partIds.map(id=>[id,distance(wall0,wallContact,id)])),transfer:Object.fromEntries(partIds.map(id=>[id,distance(wall0,wallTransfer,id)])),settle:Object.fromEntries(partIds.map(id=>[id,distance(wall0,wallSettle,id)]))};
  gate('wall-six-beat-structural-transfer',wallTrace.contact.polL>wallTrace.contact.core&&wallTrace.transfer.core>wallTrace.contact.core&&wallTrace.transfer.spine>wallTrace.contact.spine&&wallTrace.settle.lobeL>wallTrace.contact.lobeL,wallTrace);

  function a1Trace(x,y){reset();GOLD.cue(ct,'a1',{x,y});frames(48,0,0,{a1Target:{x,y}});return{state:GOLD.inspect(ct).state,pose:pose()};}
  const left=a1Trace(-1,0),right=a1Trace(1,0),zero=a1Trace(0,0);
  gate('a1-left-right-directional-body-lead',left.state.a1Target.x<-.9&&right.state.a1Target.x>.9&&left.pose.polL.x<right.pose.polL.x&&right.pose.polR.x>left.pose.polR.x,{left:{target:left.state.a1Target,polL:left.pose.polL,polR:left.pose.polR},right:{target:right.state.a1Target,polL:right.pose.polL,polR:right.pose.polR}});
  gate('a1-zero-object-neutral-finite',Math.abs(zero.state.a1Target.x)<1e-8&&partIds.every(id=>Object.values(zero.pose[id]).every(Number.isFinite)),{target:zero.state.a1Target});

  reset();GOLD.cue(ct,'a2');const a2base=pose();frame();const a2Flip=pose(),a2=frames(39);const a2Trace={flipCore:distance(a2base,a2Flip,'core'),expanded:Object.fromEntries(partIds.map(id=>[id,distance(a2base,a2,id)]))};
  gate('a2-flip-then-six-part-expansion',a2Trace.flipCore>.05&&['spine','polL','polR','lobeL','lobeR'].every(id=>a2Trace.expanded[id]>.05),a2Trace);

  reset();const pass0=pose();GOLD.cue(ct,'passive',{angle:0});frame();const passLaunch=pose();frames(6);const passOther=pose();
  gate('passive-launch-before-opposite-response',distance(pass0,passLaunch,'polR')>distance(pass0,passLaunch,'polL')*2&&distance(pass0,passOther,'polL')>distance(pass0,passLaunch,'polL'),{launch:{left:distance(pass0,passLaunch,'polL'),right:distance(pass0,passLaunch,'polR')},delayed:{left:distance(pass0,passOther,'polL'),right:distance(pass0,passOther,'polR')}});

  reset();const idleSamples=[];for(let i=0;i<600;i++){frame();if(i===0||i===36||i===84||i===132||i===360||i===480)idleSamples.push({t:(i+1)*DT,p:pose()});}
  const idleMoved=partIds.filter(id=>Math.max(...idleSamples.map(q=>distance(idleSamples[0].p,q.p,id)))>.02);
  gate('idle-irregular-six-part-relative-motion',idleMoved.length>=5,{moved:idleMoved,samples:idleSamples.map(q=>q.t)});
}catch(error){gate('motion-trace-execution',false,String(error&&error.stack||error));}

win.exitArsenalQuestMode();
console.log(`\n[MAGNET GOLD MOTION TRACE] ${failures.length?'FAIL':'PASS'}`);if(failures.length)console.error(`FAILURES: ${failures.join(', ')}`);process.exit(failures.length?1:0);
