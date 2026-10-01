#!/usr/bin/env node
// MAGNET V1 — real Chromium / real requestAnimationFrame production proof.
// This gate uses the shipping page, Fighter.update, firearm holder emission,
// projectile loop, collision solve and canvas. It does not inject projectiles
// or call the Gold engine as a substitute for production inputs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const localRequire=createRequire(import.meta.url);
let requireBrowser=localRequire;
try{localRequire.resolve('puppeteer-core');localRequire.resolve('@sparticuz/chromium');}
catch(error){requireBrowser=createRequire('/tmp/magnet-browser-deps/noop.js');}
const puppeteer=requireBrowser('puppeteer-core');
const chromiumModule=requireBrowser('@sparticuz/chromium'),chromium=chromiumModule.default||chromiumModule;
const pkgRoot=path.dirname(path.dirname(requireBrowser.resolve('@sparticuz/chromium')));
// Environment compatibility: @sparticuz/chromium >= 121 inflates its own
// payload inside executablePath() and no longer exports inflate(). The shared
// library bundle still has to be on LD_LIBRARY_PATH either way.
if(typeof chromiumModule.inflate==='function')await chromiumModule.inflate(path.join(pkgRoot,'bin','al2023.tar.br'));
process.env.LD_LIBRARY_PATH=['/tmp/al2023','/tmp/al2023/lib',process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173';
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:[...chromium.args.filter(a=>!/use-gl|use-angle|swiftshader|gpu/.test(a)),'--disable-gpu','--autoplay-policy=no-user-gesture-required',
  // Headless Chromium throttles rAF for backgrounded/occluded renderers, and
  // its swiftshader GL path rasterises this 1280x1100 canvas ~7x slower than
  // the plain software path (measured 1255ms/frame vs 176ms/frame), which
  // stretches this rAF-driven suite far beyond its protocol budget on CI-like
  // hosts. These flags only affect scheduling/rasterisation, never game logic.
  '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'],
  headless:true,protocolTimeout:Number(process.env.APEX_PROTOCOL_TIMEOUT_MS)||2400000});
const page=await browser.newPage();await page.setViewport({width:1280,height:1100,deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/ERR_|favicon|Failed to load resource/.test(m.text()))errors.push(`console: ${m.text()}`);});
let telemetry;
try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:60000});
  telemetry=await page.evaluate(async()=>{
    await window.__apexEnsureDeferredRuntimes('arsenalQuest');
    const IDS=['core','spine','polL','polR','lobeL','lobeR'];
    const waitFrames=n=>new Promise(resolve=>{let count=0;const next=()=>{if(++count>=n)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);});
    const waitUntil=async(predicate,frames=300)=>{for(let i=0;i<frames;i++){if(predicate())return true;await waitFrames(1);}return false;};
    const configureWorld=()=>{const state=window.APEX_ARSENAL.state;state.spawnTimer=1e6;state.slots=[];state.unarmedFastConsumed=true;state.spawnHeld=true;return state;};
    const restart=async(enemy='ROBOT')=>{
      if(window.APEX_HERO_REWORK.match)window.exitArsenalQuestMode();
      window.startArsenalQuestMode('MAGNET',enemy);window.APEX_HERO_REWORK.setAiEnabled(false);configureWorld();await waitFrames(3);
      const [fighter,opponent]=window.fighters,ct=window.APEX_HERO_REWORK.byCombatant(fighter);
      fighter.baseSpeed=0;opponent.baseSpeed=0;fighter.x=500;fighter.y=500;opponent.x=900;opponent.y=900;
      return{fighter,opponent,ct,state:window.APEX_ARSENAL.state};
    };
    const gold=window.APEX_MAGNET_GOLD,pres=window.APEX_MAGNET_PRESENTATION,HR=window.APEX_HERO_REWORK,MAG=window.APEX_MAGNET;
    const pose=ct=>{const rig=gold.inspect(ct).state.rig;return Object.fromEntries(IDS.map(id=>[id,{x:rig[id].x,y:rig[id].y,r:rig[id].r,sx:rig[id].sx,sy:rig[id].sy}]));};
    const delta=(a,b,id)=>Math.hypot(b[id].x-a[id].x,b[id].y-a[id].y,(b[id].r-a[id].r)*80,(b[id].sx-a[id].sx)*80,(b[id].sy-a[id].sy)*80);
    const maxFrom=(origin,samples,id)=>Math.max(0,...samples.map(sample=>delta(origin,sample,id)));
    const angle=(vx,vy)=>Math.atan2(vy,vx),normAngle=value=>{while(value>Math.PI)value-=Math.PI*2;while(value<-Math.PI)value+=Math.PI*2;return value;};

    let scene=await restart('MIRROR');
    const ready=await waitUntil(()=>gold.ready,600),{fighter,opponent,ct,state}=scene;
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
    // A1 lasts A1_DURATION (1.0s) of SIM time. Sampling its state only after a
    // fixed 24 frames makes the gate a wall-clock race: on a slow host the
    // whole ability expires inside a couple of frames and the acquired object
    // is gone before it is ever read. Poll every frame instead and keep the
    // peak observation, which is what the gate actually means to assert.
    const idleStart=performance.now();await waitFrames(12);const idleMeanFrameMs=(performance.now()-idleStart)/12;
    const cast=HR.pressAbility(fighter,'A1'),a1WallStart=performance.now();
    let a1ObjectsMax=0,a1TargetMinX=Infinity,a1DesiredMinX=Infinity,a1Satisfied=false,a1RingsMax=0;
    for(let i=0;i<24;i++){
      await waitFrames(1);
      const live=gold.inspect(ct).state;
      a1ObjectsMax=Math.max(a1ObjectsMax,live.objects.a1);
      a1RingsMax=Math.max(a1RingsMax,live.effects.rings);
      if(live.objects.a1>0){
        a1TargetMinX=Math.min(a1TargetMinX,live.a1Target.x);
        a1DesiredMinX=Math.min(a1DesiredMinX,live.desiredA1Target.x);
        if(live.objects.a1===1&&live.a1Target.x<-.5&&live.desiredA1Target.x<-.99)a1Satisfied=true;
      }
    }
    const a1WallMs=performance.now()-a1WallStart,a1=gold.inspect(ct).state;
    const goldResource=performance.getEntriesByType('resource').find(entry=>entry.name.includes('/game/hero-rework/magnetGoldV1.js'));
    const scheduler={revision:{runtime:goldResource?new URL(goldResource.name).searchParams.get('v'):null,gold:gold.version,adapter:pres.version},before:{clock:before.clock,scheduler:before.scheduler,fixedSteps:before.gold.fixedSteps},after:{clock:after.clock,scheduler:after.scheduler,fixedSteps:after.gold.fixedSteps,frameCount:after.gold.frameCount,sample:after.sample,body:after.body},draws:{actor:actorDraws,before:beforeDraws,after:afterDraws},a1:{accepted:!!cast.ok,target:a1.a1Target,desired:a1.desiredA1Target,objects:a1.objects,rings:a1.effects.rings,wallMs:a1WallMs,meanFrameMs:a1WallMs/24,idleMeanFrameMs,a1OverheadMs:a1WallMs/24-idleMeanFrameMs,peak:{objects:a1ObjectsMax,targetMinX:a1TargetMinX,desiredMinX:a1DesiredMinX,rings:a1RingsMax,satisfied:a1Satisfied}}};

    // Actual production locomotion -> stop -> hard reverse articulation.
    scene=await restart('ROBOT');
    scene.fighter.x=250;scene.fighter.y=500;scene.opponent.x=850;scene.opponent.y=850;scene.fighter.baseSpeed=450;scene.fighter.dir.x=1;scene.fighter.dir.y=0;
    const locomotionStart=pose(scene.ct),forward=[],reverse=[],stop=[];
    for(let i=0;i<36;i++){await waitFrames(1);forward.push(pose(scene.ct));}
    const xAfterForward=scene.fighter.x,reverseStart=pose(scene.ct);scene.fighter.dir.x=-1;scene.fighter.dir.y=0;
    for(let i=0;i<36;i++){await waitFrames(1);reverse.push(pose(scene.ct));}
    const xAfterReverse=scene.fighter.x,stopStartX=scene.fighter.x,stopStart=pose(scene.ct);scene.fighter.baseSpeed=0;
    for(let i=0;i<30;i++){await waitFrames(1);stop.push(pose(scene.ct));}
    const locomotion={root:{start:250,afterForward:xAfterForward,afterReverse:xAfterReverse,stopDrift:scene.fighter.x-stopStartX},sustained:Object.fromEntries(IDS.map(id=>[id,maxFrom(locomotionStart,forward,id)])),hardReverse:Object.fromEntries(IDS.map(id=>[id,maxFrom(reverseStart,reverse,id)])),stop:Object.fromEntries(IDS.map(id=>[id,maxFrom(stopStart,stop,id)]))};

    // Actual Fighter wall solve drives the donor wall sequence.
    scene=await restart('ROBOT');scene.fighter.x=310;scene.fighter.y=500;scene.opponent.x=900;scene.opponent.y=900;scene.fighter.baseSpeed=450;scene.fighter.dir.x=-1;scene.fighter.dir.y=0;
    const wallStart=pose(scene.ct),wallSamples=[];let wallEchoes=0,wallBumps=0,minWallX=Infinity;
    for(let i=0;i<90;i++){await waitFrames(1);wallSamples.push(pose(scene.ct));const s=gold.inspect(scene.ct).state;wallEchoes=Math.max(wallEchoes,s.effects.echoes);wallBumps=Math.max(wallBumps,s.effects.bumps);minWallX=Math.min(minWallX,scene.fighter.x);}
    const wall={minX:minWallX,radius:scene.fighter.radius,echoes:wallEchoes,bumps:wallBumps,parts:Object.fromEntries(IDS.map(id=>[id,maxFrom(wallStart,wallSamples,id)])),sample:pres.inspect(scene.ct).state.frameSample};

    // Actual holder emission and actual aq_bullet updates through active A2.
    // Moving Magnet after emission makes the field crossing off-axis without
    // replacing or mutating the emitted projectile identity.
    scene=await restart('ROBOT');scene.opponent.x=100;scene.opponent.y=500;scene.fighter.x=500;scene.fighter.y=500;
    const canvas=document.getElementById('game-canvas'),ctx=canvas.getContext('2d'),originalDrawImage=ctx.drawImage,localCopies=[];
    ctx.drawImage=function(){const args=Array.from(arguments);if(args[0]===canvas&&args.length>=9)localCopies.push({sx:args[1],sy:args[2],sw:args[3],sh:args[4],dx:args[5],dy:args[6],dw:args[7],dh:args[8]});return originalDrawImage.apply(this,args);};
    const weaponApi=window.APEX_ARSENAL.weaponApi;weaponApi.equip(scene.opponent,'PISTOL');
    const a2Cast=HR.pressAbility(scene.fighter,'A2');let bullet=null,initial=null,lastInfluenced=null,influencedTicks=0,historiesMax=0,identityStable=true,lifeDecreased=false;
    // Owner acceptance criterion is REPULSION, not a measurable bend. rAF is
    // throttled hard in headless Chromium, so the bend/tick counts sampled here
    // alias badly; the authoritative entry record and the closest approach the
    // bullet ever achieves are what actually prove the field repels it.
    let entryRecords=[],minDistance=Infinity,hpStart=scene.fighter.hp;
    for(let i=0;i<220;i++){
      await waitFrames(1);
      if(!bullet){bullet=window.projectiles.find(p=>p?.aq&&p.type==='aq_bullet'&&p.owner===scene.opponent)||null;if(bullet){initial={x:bullet.x,y:bullet.y,vx:bullet.vx,vy:bullet.vy,speed:Math.hypot(bullet.vx,bullet.vy),life:bullet.life,weapon:bullet.weapon,ownerId:bullet.owner?.id,type:bullet.type};scene.fighter.y=620;}}
      if(bullet){const influence=MAG.inspect(window.matchClock).projectileInfluence.find(item=>item.projectile===bullet);if(influence){influencedTicks++;lastInfluenced={x:bullet.x,y:bullet.y,vx:bullet.vx,vy:bullet.vy,life:bullet.life};if(influence.entries?.length)entryRecords=influence.entries.map(e=>({radialBefore:e.radialBefore,radialAfter:e.radialAfter,radialTarget:e.radialTarget,tangential:e.tangential,x:e.x,y:e.y,cx:e.cx,cy:e.cy,radiusAtResponse:Math.hypot(e.x-e.cx,e.y-e.cy)}));}minDistance=Math.min(minDistance,Math.hypot(bullet.x-scene.fighter.x,bullet.y-scene.fighter.y));historiesMax=Math.max(historiesMax,gold.inspect(scene.ct).state.effects.projectileHistories);lifeDecreased=lifeDecreased||bullet.life<initial.life;identityStable=identityStable&&bullet.owner===scene.opponent&&bullet.type==='aq_bullet'&&bullet.weapon==='PISTOL';if(!window.projectiles.includes(bullet)&&lastInfluenced)break;}
      if(i>180&&bullet)break;
    }
    ctx.drawImage=originalDrawImage;
    const damagingEnvelope=scene.fighter.radius*(window.APEX_ARSENAL?.config?.BULLET_HIT_RADIUS_SCALE??.78)+(bullet?.radius||0);
    const a2Bullet={cast:!!a2Cast.ok,emitted:!!bullet,initial,lastInfluenced,influencedTicks,historiesMax,identityStable,lifeDecreased,entryRecords,entryResponses:entryRecords.length,minDistance,damagingEnvelope,penetrated:minDistance<=damagingEnvelope,damaged:scene.fighter.hp<hpStart,angleDelta:initial&&lastInfluenced?normAngle(angle(lastInfluenced.vx,lastInfluenced.vy)-angle(initial.vx,initial.vy)):null};
    const floor={copyCount:localCopies.length,maxWidth:Math.max(0,...localCopies.map(item=>item.dw)),maxHeight:Math.max(0,...localCopies.map(item=>item.dh)),canvasWidth:canvas.width,canvasHeight:canvas.height};

    // Repeated Magnet-vs-ROBOT exact contact with legitimate A2 momentum.
    scene=await restart('ROBOT');scene.fighter.x=500;scene.fighter.y=500;scene.opponent.x=670;scene.opponent.y=500;
    const contactCast=HR.pressAbility(scene.fighter,'A2');
    for(let i=0;i<72;i++){await waitFrames(1);scene.fighter.x=scene.opponent.x-170;scene.fighter.y=scene.opponent.y;}
    let bodyCollisionEvents=0;
    const unsubscribeContact=window.APEX_HERO_REWORK_AIL.bus.on('BodyCollision',event=>{if(event.payload?.combatantIndex===scene.ct.idx)bodyCollisionEvents++;});
    scene.fighter.x=700;scene.fighter.y=500;scene.opponent.x=550;scene.opponent.y=500;
    let maxPenetration=0,penetratingFrames=0,contactBumps=0;
    for(let i=0;i<24;i++){await waitFrames(1);const penetration=Math.max(0,scene.fighter.radius+scene.opponent.radius-Math.hypot(scene.opponent.x-scene.fighter.x,scene.opponent.y-scene.fighter.y));maxPenetration=Math.max(maxPenetration,penetration);if(penetration>1e-6)penetratingFrames++;contactBumps=Math.max(contactBumps,gold.inspect(scene.ct).state.effects.bumps);}
    // Let the A2 field fully expire, then command both live bodies away from
    // contact. Increasing distance plus independent displacement is the
    // liveness/separation proof that zero penetration alone cannot provide.
    for(let i=0;i<30;i++)await waitFrames(1);
    const separationStart={magnet:{x:scene.fighter.x,y:scene.fighter.y},robot:{x:scene.opponent.x,y:scene.opponent.y},distance:Math.hypot(scene.opponent.x-scene.fighter.x,scene.opponent.y-scene.fighter.y)};
    scene.fighter.baseSpeed=450;scene.opponent.baseSpeed=450;scene.fighter.dir.x=1;scene.fighter.dir.y=0;scene.opponent.dir.x=-1;scene.opponent.dir.y=0;
    for(let i=0;i<24;i++)await waitFrames(1);
    const separationEnd={magnet:{x:scene.fighter.x,y:scene.fighter.y},robot:{x:scene.opponent.x,y:scene.opponent.y},distance:Math.hypot(scene.opponent.x-scene.fighter.x,scene.opponent.y-scene.fighter.y)};
    unsubscribeContact();
    const contact={cast:!!contactCast.ok,maxPenetration,penetratingFrames,bodyCollisionEvents,contactBumps,separationStart,separationEnd};

    // OWNER REGRESSION: A2 must create a CLEAR physical outward push on a
    // living enemy fighter at LEGAL spacing (75+75 collision radii forbid
    // anything closer than 150). Driven through the real shipping pipeline
    // and the real Fighter.update, measuring actual displacement -- not a
    // value in MAG.inspect().
    const pushCases=[];
    for(const distance of [150,170,200]){
      scene=await restart('ROBOT');
      scene.fighter.x=500;scene.fighter.y=500;scene.fighter.baseSpeed=0;scene.fighter.dir.x=0;scene.fighter.dir.y=0;
      scene.opponent.baseSpeed=0;scene.opponent.dir.x=0;scene.opponent.dir.y=0;
      await waitFrames(3);
      scene.opponent.x=500+distance;scene.opponent.y=500;
      const d0=Math.hypot(scene.opponent.x-scene.fighter.x,scene.opponent.y-scene.fighter.y);
      const cast=HR.pressAbility(scene.fighter,'A2');
      let peak=0,maxExt=0;
      for(let i=0;i<110;i++){
        await waitFrames(1);
        peak=Math.max(peak,Math.hypot(scene.opponent.x-scene.fighter.x,scene.opponent.y-scene.fighter.y)-d0);
        const e=scene.opponent.__hrExternalVelocity||{x:0,y:0};
        maxExt=Math.max(maxExt,Math.hypot(e.x||0,e.y||0));
      }
      pushCases.push({distance,cast:!!(cast&&cast.ok),d0,peakRadialDisplacement:peak,maxExternalVelocity:maxExt,
        donorTarget:1050*Math.max(0,1-d0/225)});
    }
    const fighterPush={cases:pushCases};

    // Instrument the shipping world seam itself, not drawImage counts alone.
    // The event trace proves distortion source sampling happens after the
    // declared completed world layers and before either Fighter.draw.
    const layerProbe=async(p1,p2)=>{
      if(HR.match)window.exitArsenalQuestMode();window.startArsenalQuestMode(p1,p2);HR.setAiEnabled(false);configureWorld();await waitFrames(3);
      const bodies=window.fighters;bodies[0].baseSpeed=0;bodies[1].baseSpeed=0;bodies[0].x=400;bodies[0].y=500;bodies[1].x=650;bodies[1].y=500;
      for(const body of bodies)if(HR.byCombatant(body)?.heroId==='MAGNET')HR.pressAbility(body,'A2');
      await waitFrames(12);
      const canvas=document.getElementById('game-canvas'),probeCtx=canvas.getContext('2d'),records=[];
      const originalSeam=HR.renderArenaWorldEffects,originalArena=gold.drawArenaDistortion,originalImage=probeCtx.drawImage;
      const proto=Object.getPrototypeOf(bodies[0]),originalFighter=proto.draw;let current=null,lastRecord=null;
      HR.renderArenaWorldEffects=function(context,provenance){
        const record={provenance:{...provenance},sequence:['seam:start'],calls:[],fighterInsideSeam:0};records.push(record);current=record;lastRecord=record;
        try{return originalSeam.apply(this,arguments);}finally{record.sequence.push('seam:end');current=null;}
      };
      gold.drawArenaDistortion=function(context,combatant){if(current){current.calls.push(combatant.idx);current.sequence.push(`distortion:${combatant.idx}`);}return originalArena.apply(this,arguments);};
      probeCtx.drawImage=function(){const args=Array.from(arguments);if(current&&args[0]===canvas&&args.length>=9)current.sequence.push(`sample:${current.calls[current.calls.length-1]}:${args[3]}x${args[4]}`);return originalImage.apply(this,args);};
      proto.draw=function(){const idx=window.fighters.indexOf(this);if(current)current.fighterInsideSeam++;if(lastRecord)lastRecord.sequence.push(`fighter:${idx}`);return originalFighter.apply(this,arguments);};
      await waitFrames(5);
      HR.renderArenaWorldEffects=originalSeam;gold.drawArenaDistortion=originalArena;probeCtx.drawImage=originalImage;proto.draw=originalFighter;
      return records.slice(-3);
    };
    const arenaLayers={p1:await layerProbe('MAGNET','ROBOT'),p2:await layerProbe('ROBOT','MAGNET'),mirror:await layerProbe('MAGNET','MAGNET')};

    window.exitArsenalQuestMode();
    return{ready,scheduler,locomotion,wall,a2Bullet,floor,contact,fighterPush,arenaLayers};
  });
}finally{await browser.close();}

const before=telemetry.scheduler.before,after=telemetry.scheduler.after;
const delta={clock:after.clock-before.clock,tickCalls:after.scheduler.tickCalls-before.scheduler.tickCalls,advancedFrames:after.scheduler.advancedFrames-before.scheduler.advancedFrames,duplicateCalls:after.scheduler.duplicateCalls-before.scheduler.duplicateCalls,fixedSteps:after.fixedSteps-before.fixedSteps};telemetry.scheduler.delta=delta;telemetry.errors=errors;
const movingParts=Object.values(telemetry.locomotion.sustained).filter(value=>value>0.45).length;
const reverseParts=Object.values(telemetry.locomotion.hardReverse).filter(value=>value>0.55).length;
const stopParts=Object.values(telemetry.locomotion.stop).filter(value=>value>0.35).length;
const goldSource=fs.readFileSync('public/game/hero-rework/magnetGoldV1.js','utf8'),floorSource=goldSource.slice(goldSource.indexOf('function drawFloorDistortion('),goldSource.indexOf('function drawHistories('));
const validLayerRecord=(record,expected)=>record.provenance?.stage==='after-world-before-fighters'&&record.provenance.background&&record.provenance.projectiles&&record.provenance.scent&&record.provenance.particles===false&&!record.provenance.fighters&&record.fighterInsideSeam===0&&JSON.stringify(record.calls)===JSON.stringify(expected)&&record.sequence.indexOf('seam:end')<record.sequence.indexOf('fighter:0');
const sampledSlots=(records,expected)=>expected.every(idx=>records.some(record=>record.sequence.some(event=>event.startsWith(`sample:${idx}:`))));
const expectedRuntimeRevision=(fs.readFileSync('src/game/runtimeManifest.js','utf8').match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*['"]([^'"]+)['"]/)||[])[1];
const checks={

  'browser-assets-ready':telemetry.ready&&telemetry.scheduler.revision.runtime===expectedRuntimeRevision&&telemetry.scheduler.revision.gold==='2.0.0-canonical-engine'&&telemetry.scheduler.revision.adapter==='2.0.0-thin-semantic-adapter',
  'real-raf-exactly-one-frame-owner':delta.tickCalls>=30&&delta.tickCalls===delta.advancedFrames&&delta.duplicateCalls===0,
  'real-raf-fixed-120-mapping':delta.clock>0&&Math.abs(delta.fixedSteps-delta.clock*120)<=3,
  'post-movement-sample-is-drawn-root':Math.hypot(after.sample.after.x-after.body.x,after.sample.after.y-after.body.y)<1e-9,
  'three-phase-render-called':telemetry.scheduler.draws.actor>=30&&telemetry.scheduler.draws.before===telemetry.scheduler.draws.actor&&telemetry.scheduler.draws.after===telemetry.scheduler.draws.actor,
  'a1-positive-control-real-object':telemetry.scheduler.a1.accepted&&telemetry.scheduler.a1.peak.objects===1&&telemetry.scheduler.a1.peak.targetMinX<-.5&&telemetry.scheduler.a1.peak.desiredMinX<-.99&&telemetry.scheduler.a1.peak.satisfied,
  // Absolute frame time measures the HOST, not Magnet. What this gate is for is
  // that A1's field rendering does not blow the frame budget, so compare A1's
  // marginal cost against the same scene rendering idle.
  'a1-field-render-frame-budget-measured':telemetry.scheduler.a1.meanFrameMs>0&&telemetry.scheduler.a1.idleMeanFrameMs>0&&telemetry.scheduler.a1.a1OverheadMs<40,
  'production-locomotion-six-part-articulation':telemetry.locomotion.root.afterForward>telemetry.locomotion.root.start&&movingParts>=5&&telemetry.locomotion.sustained.polL>1&&telemetry.locomotion.sustained.lobeL>.6,
  'production-hard-reverse-six-part-articulation':telemetry.locomotion.root.afterReverse<telemetry.locomotion.root.afterForward&&reverseParts>=5&&telemetry.locomotion.hardReverse.polL>1,
  'production-stop-six-part-articulation':Math.abs(telemetry.locomotion.root.stopDrift)<1e-6&&stopParts>=4,
  'actual-wall-interaction-structural':telemetry.wall.minX>=telemetry.wall.radius-1e-6&&telemetry.wall.echoes>0&&telemetry.wall.bumps>0&&Object.values(telemetry.wall.parts).filter(value=>value>.5).length>=5,
  // Owner authority: the acceptance criterion for an A2 firearm bullet is that
  // it is REPULSED and never reaches Magnet -- explicitly NOT `angleDelta>.002`,
  // which is satisfied by the rejected "bend a few degrees and penetrate"
  // behaviour. Proven from the authoritative entry record plus the closest
  // approach the bullet ever achieves versus the damaging envelope.
  // The response must land ON the real R=225 boundary (measured against the
  // centre the runtime solved the crossing against, since the anchor may move
  // later in the tick), the inward radial component must be neutralized to
  // exactly 0 there so safety is never deferred, and a meaningful outward
  // response must be queued for the magnetic-capture ramp.
  'actual-firearm-a2-projectile-repulsion':telemetry.a2Bullet.cast&&telemetry.a2Bullet.emitted&&telemetry.a2Bullet.initial?.type==='aq_bullet'&&telemetry.a2Bullet.initial?.weapon==='PISTOL'&&telemetry.a2Bullet.identityStable&&telemetry.a2Bullet.lifeDecreased&&telemetry.a2Bullet.influencedTicks>=1&&telemetry.a2Bullet.entryResponses===1&&telemetry.a2Bullet.entryRecords[0].radialBefore<0&&telemetry.a2Bullet.entryRecords[0].radialAfter===0&&telemetry.a2Bullet.entryRecords[0].radialTarget>0&&Math.abs(telemetry.a2Bullet.entryRecords[0].radiusAtResponse-225)<=0.01&&!telemetry.a2Bullet.penetrated&&!telemetry.a2Bullet.damaged,
  'a2-true-projectile-history-rendered':telemetry.a2Bullet.historiesMax>0,
  // OWNER REGRESSION (playtest: "A2 does not visibly push the enemy fighter").
  // Donor law is a radial-velocity TARGET push=1050*(1-d/225); production must
  // track it at legal spacing AND the fighter must really move.
  'a2-pushes-enemy-fighter-at-legal-spacing':telemetry.fighterPush.cases.length===3
    &&telemetry.fighterPush.cases.every((c)=>c.cast)
    &&telemetry.fighterPush.cases.every((c)=>c.maxExternalVelocity>=0.55*c.donorTarget)
    &&telemetry.fighterPush.cases.filter((c)=>c.donorTarget>=100).every((c)=>c.peakRadialDisplacement>=24),
  'real-arena-local-pixel-deformation':telemetry.floor.copyCount>0&&telemetry.floor.maxWidth<telemetry.floor.canvasWidth*.5&&telemetry.floor.maxHeight<telemetry.floor.canvasHeight*.5,
  'arena-p1-pre-fighter-layer-provenance':telemetry.arenaLayers.p1.length===3&&telemetry.arenaLayers.p1.every(record=>validLayerRecord(record,[0]))&&sampledSlots(telemetry.arenaLayers.p1,[0]),
  'arena-p2-pre-fighter-layer-provenance':telemetry.arenaLayers.p2.length===3&&telemetry.arenaLayers.p2.every(record=>validLayerRecord(record,[1]))&&sampledSlots(telemetry.arenaLayers.p2,[1]),
  'arena-mirror-stable-index-composition':telemetry.arenaLayers.mirror.length===3&&telemetry.arenaLayers.mirror.every(record=>validLayerRecord(record,[0,1]))&&sampledSlots(telemetry.arenaLayers.mirror,[0,1]),
  'no-synthetic-global-grid':/drawImage\(canvas,/.test(goldSource)&&!/lineTo|stroke\(/.test(floorSource),
  'magnet-robot-contact-no-overlap':telemetry.contact.cast&&telemetry.contact.maxPenetration<1e-4&&telemetry.contact.penetratingFrames===0&&telemetry.contact.bodyCollisionEvents>0&&telemetry.contact.contactBumps>0,
  'magnet-robot-post-contact-separation-liveness':telemetry.contact.separationEnd.distance>telemetry.contact.separationStart.distance+80&&telemetry.contact.separationEnd.magnet.x>telemetry.contact.separationStart.magnet.x+30&&telemetry.contact.separationEnd.robot.x<telemetry.contact.separationStart.robot.x-30,
  'no-browser-runtime-errors':errors.length===0,
};
for(const[name,pass]of Object.entries(checks))console.log(`${pass?'PASS':'FAIL'}  ${name}`);console.log(JSON.stringify(telemetry,null,2));
const reportPath=process.env.MAGNET_BROWSER_REPORT;if(reportPath){fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify({generatedAt:new Date().toISOString(),url,checks,telemetry},null,2)+'\n');}
const failed=Object.entries(checks).filter(([,value])=>!value).map(([name])=>name);console.log(`\n[MAGNET REAL BROWSER] ${failed.length?'FAIL':'PASS'}`);if(failed.length)console.error(`FAILURES: ${failed.join(', ')}`);process.exit(failed.length?1:0);
