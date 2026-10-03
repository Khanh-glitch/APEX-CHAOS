#!/usr/bin/env node
// MAGNET V1 — canonical Gold / presentation gates (M11–M12).
import { bootHarness } from './lib/crystalaHarness.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const H=await bootHarness(),{win,T}=H;
const HR=win.APEX_HERO_REWORK,GOLD=win.APEX_MAGNET_GOLD,PRES=win.APEX_MAGNET_PRESENTATION;
const report={gates:{},failures:[]};
function gate(name,ok,detail){report.gates[name]={pass:!!ok,detail};if(!ok)report.failures.push(name);console.log(`${ok?'PASS':'FAIL'}  ${name}${detail===undefined?'':`  — ${typeof detail==='string'?detail:JSON.stringify(detail)}`}`);}
const digest=(b)=>crypto.createHash('sha256').update(b).digest('hex');

try{
  const goldPath='docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html',bytes=fs.readFileSync(goldPath),manifest=JSON.parse(fs.readFileSync('public/assets/magnet_v1/gold/manifest.json','utf8'));
  gate('M11.1-canonical-reference-proof',bytes.length===3095049&&digest(bytes)==='468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b'&&manifest.sourceSha256===digest(bytes),{bytes:bytes.length,sha256:digest(bytes)});
  const ids=Object.keys(manifest.parts),files=[];let hashes=true;
  for(const part of Object.values(manifest.parts))for(const level of part.levels){files.push(level.base.file);const base=fs.readFileSync(`public/assets/magnet_v1/gold/${level.base.file}`);hashes&&=digest(base)===level.base.sha256;for(const layers of Object.values(level.channels))for(const rec of Object.values(layers)){files.push(rec.file);hashes&&=digest(fs.readFileSync(`public/assets/magnet_v1/gold/${rec.file}`))===rec.sha256;}}
  gate('M11.2-six-part-prebake-integrity',ids.join(',')==='core,spine,polL,polR,lobeL,lobeR'&&files.length===54&&hashes,{parts:ids,files:files.length,hashes});
}catch(e){gate('M11.1-canonical-reference-proof',false,String(e));}

try{
  const source=fs.readFileSync('public/game/hero-rework/magnetGoldV1.js','utf8'),adapter=fs.readFileSync('public/game/hero-rework/magnetPresentationRuntime.js','utf8');
  const a2=source.slice(source.indexOf('function drawReactiveField('),source.indexOf('function drawA1Filaments('));
  gate('M11.3-no-demo-hitboxes-or-fallback-redraw',!/segCircle|const HC=|demo hit/i.test(source)&&!/strokeRect\([^)]*RASTER|fallback redraw/i.test(source),'runtime consumes only pre-baked six-part raster');
  gate('M11.4-gold-owned-a2-angular-never-filled-shield',/ctx\.arc\(/.test(a2)&&/ctx\.stroke\(/.test(a2)&&!/ctx\.fill\(/.test(a2)&&!/(fillStyle|radialGradient)/.test(a2)&&!/function drawReactiveField\(/.test(adapter),'Gold owns stroke-only A2 sectors; adapter owns no A2 drawing');
  gate('M11.5-local-seeded-presentation-rng',/const rng=\{seed:.*0x4d41474e/.test(source)&&/rng\.seed\^=rng\.seed<</.test(source)&&!/Math\.random\(/.test(source),'no gameplay/global RNG consumption');
}catch(e){gate('M11.3-no-demo-hitboxes-or-fallback-redraw',false,String(e));}

const deadline=Date.now()+12000;
while(!GOLD.ready&&Date.now()<deadline)await new Promise((r)=>setTimeout(r,25));
gate('M11.6-prebaked-assets-load',GOLD.ready,GOLD.inspect().loadError||'ready');

T.start('MAGNET','MIRROR');T.holdSpawns();HR.setAiEnabled(false);
const [fighter,opponent]=H.fighters(),ct=HR.byCombatant(fighter);
fighter.baseSpeed=0;opponent.baseSpeed=0;fighter.x=220;fighter.y=520;opponent.x=820;opponent.y=520;

try{
  const before=GOLD.inspect(ct).state?.fixedSteps||0;
  GOLD.tick(ct,1/60);let state=GOLD.inspect(ct).state;
  const normal=state.fixedSteps-before;
  GOLD.tick(ct,.5);state=GOLD.inspect(ct).state;
  gate('M11.7-fixed-1-over-120-hitch-safe',GOLD.DT===1/120&&normal===2&&state.fixedSteps-before===8&&state.droppedTime>0,{dt:GOLD.DT,normalSteps:normal,totalSteps:state.fixedSteps-before,dropped:state.droppedTime});
}catch(e){gate('M11.7-fixed-1-over-120-hitch-safe',false,String(e));}

try{
  GOLD.cue(ct,'a1',{x:1,y:0});for(let i=0;i<24;i++)GOLD.tick(ct,1/120);
  const state=GOLD.inspect(ct).state,poseOf=(rig)=>JSON.stringify(Object.fromEntries(Object.entries(rig).map(([id,p])=>[id,{x:p.x,y:p.y,r:p.r,sx:p.sx,sy:p.sy}]))),pose=poseOf(state.rig);
  GOLD.cue(ct,'a2');const afterCue=poseOf(GOLD.inspect(ct).state.rig);
  GOLD.tick(ct,1/120);const afterStep=GOLD.inspect(ct).state;
  const finite=Object.values(afterStep.rig).every((p)=>Object.values(p).every((v)=>typeof v!=='number'||Number.isFinite(v)));
  gate('M11.8-current-pose-transition-no-neutral-snap',pose===afterCue&&finite&&afterStep.a1>=0&&afterStep.a2>=0,{unchangedAtCue:pose===afterCue,a1:afterStep.a1,a2:afterStep.a2});
}catch(e){gate('M11.8-current-pose-transition-no-neutral-snap',false,String(e));}

try{
  const canvas=win.document.createElement('canvas');canvas.width=1000;canvas.height=1000;const ctx=canvas.getContext('2d');
  ctx.translate(13,17);ctx.rotate(.07);ctx.globalAlpha=.37;ctx.globalCompositeOperation='xor';ctx.filter='blur(1px)';ctx.shadowColor='#123456';ctx.shadowBlur=8;ctx.shadowOffsetX=3;ctx.shadowOffsetY=4;ctx.imageSmoothingEnabled=false;
  const snap=()=>{const t=ctx.getTransform();return[t.a,t.b,t.c,t.d,t.e,t.f,ctx.globalAlpha,ctx.globalCompositeOperation,ctx.filter,ctx.shadowColor,ctx.shadowBlur,ctx.shadowOffsetX,ctx.shadowOffsetY,ctx.imageSmoothingEnabled]};
  const before=snap(),physics={x:fighter.x,y:fighter.y,hp:fighter.hp,dir:[fighter.dir.x,fighter.dir.y]};
  const drew=GOLD.draw(ctx,ct);const after=snap(),physicsAfter={x:fighter.x,y:fighter.y,hp:fighter.hp,dir:[fighter.dir.x,fighter.dir.y]};
  gate('M12.1-complete-canvas-state-restoration',drew&&JSON.stringify(before)===JSON.stringify(after),{drew,restored:JSON.stringify(before)===JSON.stringify(after)});
  gate('M12.2-presentation-does-not-mutate-gameplay',JSON.stringify(physics)===JSON.stringify(physicsAfter),physicsAfter);
}catch(e){gate('M12.1-complete-canvas-state-restoration',false,String(e));}

try{
  const a1=HR.pressAbility(fighter,'A1');const slotId=T.pushSlot({x:520,y:520,kind:'WEAPON',phase:'REVEALED',weaponId:'PISTOL'});T.step(1/30);
  const st=PRES.inspect(ct).state;
  const spec={owner:fighter,x:fighter.x,y:fighter.y,angle:0,speed:1000,damage:10,weapon:'PISTOL'},tag=HR.onFireBullet(spec);
  const st2=PRES.inspect(ct).state;
  gate('M12.3-real-events-drive-presentation',a1.ok&&st.a1Age>0&&st.late===1&&tag.magnetBoosted&&spec.speed===1180&&st2.corridors===1,{a1Age:st.a1Age,late:st.late,corridors:st2.corridors,speed:spec.speed,slotId});
}catch(e){gate('M12.3-real-events-drive-presentation',false,String(e));}

try{
  for(let i=0;i<40;i++)win.APEX_HERO_REWORK_AIL.bus.emit('MagnetLateReveal',{combatantIndex:ct.idx,slotId:1000+i});
  for(let i=0;i<30;i++)win.APEX_HERO_REWORK_AIL.bus.emit('MagnetPassiveEmission',{combatantIndex:ct.idx,x:1,y:2,angle:0,weapon:'PISTOL',speed:100});
  const st=PRES.inspect(ct).state;
  gate('M12.4-bounded-effect-history',st.late<=8&&st.corridors<=8&&st.projectileHistories<=0,{late:st.late,corridors:st.corridors,projectileHistories:st.projectileHistories});
  win.exitArsenalBattleMode();const clean=PRES.inspect(ct),goldClean=GOLD.inspect(ct);
  gate('M12.5-rematch-teardown-clean',clean.stateCount===0&&goldClean.stateCount===0,{presentation:clean.stateCount,gold:goldClean.stateCount});
}catch(e){gate('M12.4-bounded-effect-history',false,String(e));}

const total=Object.keys(report.gates).length,passed=total-report.failures.length;
console.log(`\n[MAGNET V1 PRESENTATION] ${passed}/${total} gates passed`);
if(report.failures.length)console.error(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length?1:0);
