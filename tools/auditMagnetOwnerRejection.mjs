#!/usr/bin/env node
// Forensic probes for the owner-rejected Magnet bridge at 4aac3fb.
// This file intentionally records production truth; it does not assert the
// reconstructed Gold engine is canonical.
import fs from 'node:fs';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H=await bootHarness(),{win,T}=H,HR=win.APEX_HERO_REWORK,W=win.APEX_ARSENAL.weaponApi;
const DT=1/120;
const out={tip:'4aac3fbb831bfaf1ac4f19336607763f16234c12',generatedAt:new Date().toISOString()};
function start(p2='ROBOT'){
  if(HR.match)win.exitArsenalQuestMode();
  T.start('MAGNET',p2);T.holdSpawns();HR.setAiEnabled(false);
  const [magnet,opponent]=H.fighters();
  magnet.baseSpeed=0;opponent.baseSpeed=0;
  magnet.x=500;magnet.y=500;opponent.x=120;opponent.y=500;
  magnet.setDir(1,0);opponent.setDir(1,0);
  return{magnet,opponent,ct:HR.byCombatant(magnet)};
}
function angle(vx,vy){return Math.atan2(vy,vx);}
function normAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}

// Actual holder update -> actual arsenalWeaponRuntime.fireBullet -> shipping
// rework projectile pass. No synthetic projectile is inserted.
{
  const s=start();
  W.equip(s.opponent,'PISTOL');
  const cast=HR.pressAbility(s.magnet,'A2');
  let bullet=null,initial=null;const trace=[];
  for(let tick=0;tick<240;tick++){
    const before=new Map(H.projectiles().map(p=>[p,{x:p.x,y:p.y,vx:p.vx,vy:p.vy}]));
    T.step(DT,DT);
    if(!bullet)bullet=H.projectiles().find(p=>p?.aq&&p.type==='aq_bullet'&&p.owner===s.opponent);
    if(bullet){
      const prior=before.get(bullet);
      if(!initial)initial={tick,x:prior?.x??bullet.px??bullet.x,y:prior?.y??bullet.py??bullet.y,vx:prior?.vx??bullet.vx,vy:prior?.vy??bullet.vy,speed:Math.hypot(prior?.vx??bullet.vx,prior?.vy??bullet.vy),weapon:bullet.weapon,ownerId:bullet.owner?.id};
      const dx=bullet.x-s.magnet.x,dy=bullet.y-s.magnet.y,d=Math.hypot(dx,dy);
      const truth=win.APEX_MAGNET.inspect(win.matchClock).projectileInfluence.find(q=>q.projectile===bullet);
      trace.push({tick,t:Number(win.matchClock.toFixed(6)),x:bullet.x,y:bullet.y,vx:bullet.vx,vy:bullet.vy,d,inside:d<225,influenced:!!truth,ax:truth?.ax||0,ay:truth?.ay||0,life:bullet.life});
      if(!H.projectiles().includes(bullet)||bullet.life===0)break;
    }
  }
  const influenced=trace.filter(q=>q.influenced),firstInside=trace.find(q=>q.inside),last=trace.at(-1);
  out.realA2HeadOn={cast,initial,firstInside,influencedTicks:influenced.length,trace,last,angleDelta:initial&&last?normAngle(angle(last.vx,last.vy)-angle(initial.vx,initial.vy)):null,speedDelta:initial&&last?Math.hypot(last.vx,last.vy)-initial.speed:null};
}

// Off-axis actual fire: emit from the real holder path, then move the active
// field laterally before entry. The bullet identity/emission remain real.
{
  const s=start();s.opponent.x=100;s.opponent.y=500;s.magnet.x=500;s.magnet.y=500;
  W.equip(s.opponent,'PISTOL');
  const cast=HR.pressAbility(s.magnet,'A2');let bullet=null,initial=null,moved=false;const trace=[];
  for(let tick=0;tick<240;tick++){
    const before=new Map(H.projectiles().map(p=>[p,{x:p.x,y:p.y,vx:p.vx,vy:p.vy}]));
    T.step(DT,DT);
    if(!bullet)bullet=H.projectiles().find(p=>p?.aq&&p.type==='aq_bullet'&&p.owner===s.opponent);
    if(bullet){const prior=before.get(bullet);if(!initial){initial={tick,x:prior?.x??bullet.x,y:prior?.y??bullet.y,vx:prior?.vx??bullet.vx,vy:prior?.vy??bullet.vy,speed:Math.hypot(prior?.vx??bullet.vx,prior?.vy??bullet.vy),weapon:bullet.weapon,ownerId:bullet.owner?.id};s.magnet.y=620;moved=true;}const d=Math.hypot(bullet.x-s.magnet.x,bullet.y-s.magnet.y),truth=win.APEX_MAGNET.inspect(win.matchClock).projectileInfluence.find(q=>q.projectile===bullet);trace.push({tick,t:Number(win.matchClock.toFixed(6)),x:bullet.x,y:bullet.y,vx:bullet.vx,vy:bullet.vy,d,inside:d<225,influenced:!!truth,ax:truth?.ax||0,ay:truth?.ay||0,life:bullet.life});if(!H.projectiles().includes(bullet)||bullet.life===0)break;}
  }
  const last=trace.at(-1);out.realA2OffAxis={cast,moved,initial,influencedTicks:trace.filter(q=>q.influenced).length,trace,last,angleDelta:initial&&last?normAngle(angle(last.vx,last.vy)-angle(initial.vx,initial.vy)):null};
}

// Directed ordering reproduction. First build rightward sidecar momentum while
// Robot is right of Magnet. Then relocate Magnet to Robot's right and place the
// pair at exact contact. Canonical collision sees no overlap; the later sidecar
// integration moves Robot back into Magnet in the same frame.
{
  const s=start();s.magnet.x=500;s.magnet.y=500;s.opponent.x=600;s.opponent.y=500;
  HR.pressAbility(s.magnet,'A2');
  for(let i=0;i<168;i++){T.step(DT,DT);s.magnet.x=s.opponent.x-150;s.magnet.y=s.opponent.y;}
  const primed=win.APEX_MAGNET.inspect(win.matchClock).bodies.find(q=>q.body===s.opponent);
  s.magnet.x=700;s.magnet.y=500;s.opponent.x=550;s.opponent.y=500;
  s.magnet.baseSpeed=0;s.opponent.baseSpeed=0;const frames=[];
  for(let tick=0;tick<60;tick++){
    T.step(DT,DT);
    const dx=s.opponent.x-s.magnet.x,dy=s.opponent.y-s.magnet.y,d=Math.hypot(dx,dy),minD=s.magnet.radius+s.opponent.radius;
    const bodyState=win.APEX_MAGNET.inspect(win.matchClock).bodies.find(q=>q.body===s.opponent);
    frames.push({tick,t:Number(win.matchClock.toFixed(6)),ax:s.magnet.x,bx:s.opponent.x,d,penetration:Math.max(0,minD-d),bodyVx:bodyState?.vx||0});
  }
  out.anchorContact={primedVx:primed?.vx||0,maxPenetration:Math.max(...frames.map(q=>q.penetration)),penetratingFrames:frames.filter(q=>q.penetration>1e-6).length,deepFrames:frames.filter(q=>q.penetration>2).length,tail:frames.slice(-24),frames};
}

// Gate-forensics: characterize what current motion test actually proves.
{
  const src=fs.readFileSync('tools/testMagnetGoldMotionTrace.mjs','utf8');
  out.gateForensics={drivesProductionGold:/GOLD\.updateFrame/.test(src),loadsCanonicalHtml:/MAGNET_FINAL_DONOR_MAX\.html/.test(src),epsilonChecks:(src.match(/>\.02/g)||[]).length,canonicalComparison:/canonical.*(?:compare|parity)|parity.*canonical/i.test(src)};
}

const file=process.env.MAGNET_FORENSIC_REPORT||'docs/hero-rework/magnet-v1/evidence/owner-rejection-forensics.json';
fs.mkdirSync(new URL('.',`file://${process.cwd()}/${file}`).pathname,{recursive:true});
fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({
  realA2HeadOn:{initial:out.realA2HeadOn.initial,influencedTicks:out.realA2HeadOn.influencedTicks,angleDelta:out.realA2HeadOn.angleDelta,speedDelta:out.realA2HeadOn.speedDelta,last:out.realA2HeadOn.last},
  realA2OffAxis:{initial:out.realA2OffAxis.initial,influencedTicks:out.realA2OffAxis.influencedTicks,angleDelta:out.realA2OffAxis.angleDelta,last:out.realA2OffAxis.last},
  anchorContact:{maxPenetration:out.anchorContact.maxPenetration,penetratingFrames:out.anchorContact.penetratingFrames,deepFrames:out.anchorContact.deepFrames},gateForensics:out.gateForensics,file
},null,2));
win.exitArsenalQuestMode();
process.exit(0);
