#!/usr/bin/env node
// MAGNET V1 R4 — production-truth → Gold semantic integration proof.
import fs from 'node:fs';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H=await bootHarness(),{win,T}=H;
const HR=win.APEX_HERO_REWORK,GOLD=win.APEX_MAGNET_GOLD,PRES=win.APEX_MAGNET_PRESENTATION;
const failures=[];
function gate(name,ok,detail){console.log(`${ok?'PASS':'FAIL'}  ${name} — ${JSON.stringify(detail)}`);if(!ok)failures.push(name);}
const deadline=Date.now()+12000;while(!GOLD.ready&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
function start(rival='MIRROR'){if(HR.match)win.exitArsenalBattleMode();T.start('MAGNET',rival);T.holdSpawns();HR.setAiEnabled(false);const[fighter,opponent]=H.fighters(),ct=HR.byCombatant(fighter),opponentCt=HR.byCombatant(opponent);fighter.baseSpeed=0;opponent.baseSpeed=0;fighter.x=500;fighter.y=500;opponent.x=900;opponent.y=900;return{fighter,opponent,ct,opponentCt};}
function pose(ct){return GOLD.inspect(ct).state.rig;}
function finitePose(rig){return Object.values(rig).every(p=>Object.values(p).every(v=>typeof v!=='number'||Number.isFinite(v)));}
function semanticItems(objects){return objects.a2Items||objects.a2Kinds.map(kind=>({kind,id:null}));}

try{
  let m=start();T.pushSlot({x:220,y:500});gate('a1-left-cast-accepted',HR.pressAbility(m.fighter,'A1').ok,{});T.step(.4,1/120);const left={state:GOLD.inspect(m.ct).state,pose:pose(m.ct)};
  m=start();T.pushSlot({x:780,y:500});gate('a1-right-cast-accepted',HR.pressAbility(m.fighter,'A1').ok,{});T.step(.4,1/120);const right={state:GOLD.inspect(m.ct).state,pose:pose(m.ct)};
  gate('a1-real-floor-left-right-body-lead',left.state.a1Target.x<-.9&&right.state.a1Target.x>.9&&left.pose.polL.x<right.pose.polL.x&&right.pose.polR.x>left.pose.polR.x,{left:{target:left.state.a1Target,polL:left.pose.polL.x,polR:left.pose.polR.x},right:{target:right.state.a1Target,polL:right.pose.polL.x,polR:right.pose.polR.x}});

  m=start();gate('a1-zero-object-cast-accepted',HR.pressAbility(m.fighter,'A1').ok,{});T.step(.18,1/120);let state=GOLD.inspect(m.ct).state;
  gate('a1-zero-object-neutral-finite',state.objects.a1===0&&Math.abs(state.a1Target.x)<1e-8&&Math.abs(state.a1Target.y)<1e-8&&finitePose(state.rig),{objects:state.objects,target:state.a1Target});
  const lateId=T.pushSlot({x:700,y:500});T.step(.22,1/120);state=GOLD.inspect(m.ct).state;
  gate('a1-late-reveal-acquired-with-ack',state.objects.a1===1&&state.desiredA1Target.x>.99&&state.a1Target.x>.5&&state.effects.rings===1,{slotId:lateId,objects:state.objects,target:state.a1Target,desired:state.desiredA1Target,rings:state.effects.rings});

  m=start();gate('a1-hostile-bullet-cast-accepted',HR.pressAbility(m.fighter,'A1').ok,{});H.projectiles().push({type:'aq_bullet',aq:true,owner:m.opponent,weapon:'PISTOL',x:260,y:500,px:260,py:500,vx:0,vy:340,radius:5,damage:1,life:2,maxLife:2,__hr:{}});T.step(.12,1/120);state=GOLD.inspect(m.ct).state;
  gate('a1-real-hostile-firearm-bullet-fed-continuously',state.objects.a1Kinds.includes('bullet')&&state.a1Target.x<-.5&&state.effects.projectileHistories===1,{objects:state.objects,target:state.a1Target,histories:state.effects.projectileHistories});

  m=start();m.opponent.x=630;m.opponent.y=500;T.pushSlot({x:500,y:330});H.projectiles().push({type:'aq_bullet',aq:true,owner:m.opponent,weapon:'PISTOL',x:570,y:470,px:570,py:470,vx:0,vy:240,radius:5,damage:1,life:2,maxLife:2,__hr:{}});gate('a2-real-object-cast-accepted',HR.pressAbility(m.fighter,'A2').ok,{});
  // H-PHYS2 §28: sample window shortened .12 -> .03. The continuous field is
  // far stronger than the superseded linear law (it must turn a 2200 px/s
  // pounce inside 75px), so a body at d=130 and a floor gun at d=170 are now
  // expelled past R=225 within ~0.1s. At .12s they had already left the field
  // and were legitimately no longer fed to Gold. The assertion itself -- real
  // body + gun + bullet objects are fed, with hot>0 -- is UNCHANGED.
  T.step(.03,1/120);state=GOLD.inspect(m.ct).state;
  const kinds=new Set(state.objects.a2Kinds);gate('a2-real-body-floor-gun-hostile-bullet-fed',kinds.has('body')&&kinds.has('gun')&&kinds.has('bullet')&&state.effects.hot.some(v=>v>0),{objects:state.objects,hotMax:Math.max(...state.effects.hot)});

  // Negative boundary: both objects are first genuinely influenced so their
  // gameplay momentum state exists, then moved outside while A2 remains live.
  // Persistent state must not be mistaken for current-tick A2 influence.
  m=start();m.opponent.x=630;m.opponent.y=500;const residualSlotId=T.pushSlot({x:500,y:330});gate('a2-residual-boundary-cast-accepted',HR.pressAbility(m.fighter,'A2').ok,{});T.step(1/120,1/120);
  const residualSlot=win.APEX_ARSENAL.state.slots.find(slot=>slot.id===residualSlotId);residualSlot.x=850;residualSlot.y=330;m.opponent.x=850;m.opponent.y=500;T.step(1/120,1/120);
  state=GOLD.inspect(m.ct).state;const residualTruth=win.APEX_MAGNET.inspect(),residualItems=semanticItems(state.objects);
  gate('a2-out-of-range-residual-gun-not-semantic',residualTruth.floorFirearms.some(q=>q.slot===residualSlot)&&(residualTruth.floorInfluence||[]).every(q=>q.slot!==residualSlot||!q.fields.some(f=>f.owner===m.ct&&f.kind==='a2'))&&!residualItems.some(o=>o.kind==='gun'),{persistent:residualTruth.floorFirearms.length,influenced:(residualTruth.floorInfluence||[]).length,objects:state.objects});
  gate('a2-out-of-range-residual-body-not-semantic',residualTruth.bodies.some(q=>q.body===m.opponent)&&(residualTruth.bodyInfluence||[]).every(q=>q.body!==m.opponent||!q.fields.some(f=>f.owner===m.ct&&f.kind==='a2'))&&!residualItems.some(o=>o.kind==='body'),{persistent:residualTruth.bodies.length,influenced:(residualTruth.bodyInfluence||[]).length,objects:state.objects});

  // Two Magnets: each body may be affected by the other field, but never by
  // its own field. The adapter must preserve field ownership per descriptor.
  m=start('MAGNET');m.fighter.x=400;m.fighter.y=500;m.opponent.x=520;m.opponent.y=500;const castA=HR.pressAbility(m.fighter,'A2'),castB=HR.pressAbility(m.opponent,'A2');T.step(1/120,1/120);
  const ownA=GOLD.inspect(m.ct).state.objects,ownB=GOLD.inspect(m.opponentCt).state.objects,ownAItems=semanticItems(ownA),ownBItems=semanticItems(ownB),ownABodies=ownAItems.filter(o=>o.kind==='body'),ownBBodies=ownBItems.filter(o=>o.kind==='body');
  gate('a2-own-body-not-claimed-in-two-magnet-match',castA.ok&&castB.ok&&ownABodies.length===1&&ownBBodies.length===1&&ownABodies[0].id===m.opponent.id&&ownBBodies[0].id===m.fighter.id,{a:ownAItems,b:ownBItems});

  m=start('MAGNET');m.fighter.x=200;m.fighter.y=500;m.opponent.x=700;m.opponent.y=500;const crossSlotId=T.pushSlot({x:700,y:680});HR.pressAbility(m.fighter,'A2');HR.pressAbility(m.opponent,'A2');T.step(1/120,1/120);
  const crossA=GOLD.inspect(m.ct).state.objects,crossB=GOLD.inspect(m.opponentCt).state.objects,crossAItems=semanticItems(crossA),crossBItems=semanticItems(crossB),crossAGuns=crossAItems.filter(o=>o.kind==='gun'),crossBGuns=crossBItems.filter(o=>o.kind==='gun');
  gate('a2-two-magnet-floor-truth-not-cross-attributed',crossAGuns.length===0&&crossBGuns.length===1&&crossBGuns[0].id===crossSlotId,{a:crossAItems,b:crossBItems});

  const adapterSource=fs.readFileSync('public/game/hero-rework/magnetPresentationRuntime.js','utf8'),goldSource=fs.readFileSync('public/game/hero-rework/magnetGoldV1.js','utf8'),boundary=adapterSource.slice(adapterSource.indexOf('function a2FloorTruth('),adapterSource.indexOf('function currentFloorDescriptors(')),pressure=goldSource.slice(goldSource.indexOf('function drawObjectPressure('),goldSource.indexOf('function drawCorridors(')),lenses=goldSource.slice(goldSource.indexOf('function drawLenses('),goldSource.indexOf('function drawBefore('));
  gate('a2-local-consumers-use-authoritative-semantic-set',/snapshot\.floorInfluence/.test(boundary)&&/snapshot\.bodyInfluence/.test(boundary)&&!/snapshot\.bodies\.map/.test(boundary)&&/s\.objects\.a2/.test(pressure)&&/s\.objects\.a2/.test(lenses),{semanticObjects:state.objects.a2,pressureUsesSemantic:/s\.objects\.a2/.test(pressure),lensesUseSemantic:/s\.objects\.a2/.test(lenses)});

  m=start();T.step(.02,1/120);const fxBefore=GOLD.inspect(m.ct).state.effects;m.fighter.takeDamage(16,m.opponent,'semantic-contact-test');const fxImpact=GOLD.inspect(m.ct).state.effects;T.step(.08,1/120);
  gate('real-damage-event-drives-gold-contact-recovery',fxImpact.echoes===fxBefore.echoes+1&&fxImpact.bumps===fxBefore.bumps+1&&finitePose(GOLD.inspect(m.ct).state.rig),{before:{echoes:fxBefore.echoes,bumps:fxBefore.bumps},after:{echoes:fxImpact.echoes,bumps:fxImpact.bumps}});

  const spec={owner:m.fighter,x:m.fighter.x,y:m.fighter.y,angle:Math.PI/3,speed:1000,damage:10,weapon:'PISTOL'},tag=HR.onFireBullet(spec);state=GOLD.inspect(m.ct).state;
  gate('passive-real-emission-timing-and-once-only-speed',tag.magnetBoosted===true&&spec.speed===1180&&PRES.inspect(m.ct).state.corridors===1,{speed:spec.speed,tag,corridors:PRES.inspect(m.ct).state.corridors});

  const body=m.fighter,beforeRadius=body.radius,socketState=GOLD.inspect(m.ct).state,rig=socketState.rig.polL,meta=GOLD.META.polL,pivot=meta.pivot,k=(body.radius/GOLD.BODY_REF.HX)*GOLD.BODY_VISUAL_CALIBRATION,source=170/1020,qx=412-627,qy=100-610,px=pivot[0]-627,py=pivot[1]-610,lx=(qx-px)*rig.sx,ly=(qy-py)*rig.sy,c=Math.cos(rig.r),sn=Math.sin(rig.r),expected={x:socketState.root.x+k*(rig.x+source*(px+lx*c-ly*sn)),y:socketState.root.y+k*(rig.y+source*(py+lx*sn+ly*c))},socket=GOLD.getSockets(m.ct).leftPoleTip;
  const expectedBodyScale=(170/1020)*(body.radius/GOLD.BODY_REF.HX)*GOLD.BODY_VISUAL_CALIBRATION;
  gate('presentation-scale-calibrated-without-gameplay-radius-change',Math.abs(socketState.bodyScale-expectedBodyScale)<1e-10&&body.radius===beforeRadius,{gameplayRadius:body.radius,bodyScale:socketState.bodyScale,expectedBodyScale,calibration:socketState.bodyCalibration,reference:GOLD.BODY_REF});
  gate('socket-matches-active-rig-transform',Math.hypot(socket.x-expected.x,socket.y-expected.y)<1e-9,{socket,expected,error:Math.hypot(socket.x-expected.x,socket.y-expected.y)});

  const canvas=win.document.createElement('canvas');canvas.width=1000;canvas.height=1000;const ctx=canvas.getContext('2d');ctx.translate(9,13);ctx.rotate(.04);ctx.globalAlpha=.41;ctx.globalCompositeOperation='xor';ctx.filter='blur(1px)';ctx.shadowColor='#102030';ctx.shadowBlur=7;ctx.shadowOffsetX=2;ctx.shadowOffsetY=3;ctx.imageSmoothingEnabled=false;
  const snap=()=>{const t=ctx.getTransform();return[t.a,t.b,t.c,t.d,t.e,t.f,ctx.globalAlpha,ctx.globalCompositeOperation,ctx.filter,ctx.shadowColor,ctx.shadowBlur,ctx.shadowOffsetX,ctx.shadowOffsetY,ctx.imageSmoothingEnabled]};
  const canvasBefore=snap(),physics=JSON.stringify({x:body.x,y:body.y,radius:body.radius,hp:body.hp,dir:body.dir});GOLD.drawBefore(ctx,m.ct);GOLD.drawActor(ctx,m.ct);GOLD.drawAfter(ctx,m.ct);const canvasAfter=snap(),physicsAfter=JSON.stringify({x:body.x,y:body.y,radius:body.radius,hp:body.hp,dir:body.dir});
  gate('complete-three-phase-render-isolation',JSON.stringify(canvasBefore)===JSON.stringify(canvasAfter)&&physics===physicsAfter,{canvasRestored:JSON.stringify(canvasBefore)===JSON.stringify(canvasAfter),gameplayUntouched:physics===physicsAfter});
}catch(error){gate('presentation-semantics-execution',false,String(error&&error.stack||error));}

if(HR.match)win.exitArsenalBattleMode();
console.log(`\n[MAGNET PRESENTATION SEMANTICS] ${failures.length?'FAIL':'PASS'}`);if(failures.length)console.error(`FAILURES: ${failures.join(', ')}`);process.exit(failures.length?1:0);
