/* BOXE presentation adapter — draw/tick methods are the exact owner-Gold
 * Engine implementation in boxeGoldLibrary.js. This file is only a bridge:
 * APEX Battle remains sole damage/physics/weapon authority. No extra engine
 * loop, Gold enemy simulation, or Gold skill damage is ever started here.
 */
(function installBoxeGoldPresentation(global) {
  'use strict';
  if(global.APEX_BOXE_GOLD_PRESENTATION)return;
  const AIL=global.APEX_HERO_REWORK_AIL;
  const lib=global.APEX_BOXE_GOLD_LIBRARY;
  if(!AIL||!lib?.Engine)throw Error('BOXE_GOLD_REQUIRES_OWNER_LIBRARY_AND_AIL');
  const live=new Map();
  const finite=(n)=>Number.isFinite(n);
  const now=()=>AIL.clock();
  function isBoxe(f){return f?.type?.__hrHero==='BOXE'||f?.__hrCombatant?.heroId==='BOXE';}
  function make(f){
    const offscreen=document.createElement('canvas');
    offscreen.width=1;offscreen.height=1;
    const g=new lib.Engine(offscreen,{visualOnly:true,materialFx:true,sound:false,
      hitstop:true,afterimage:true});
    // visual-only Gold must never register DOM events, spawn lab enemies, or
    // requestAnimationFrame; the patched constructor returns before attach().
    g.enemies=[];g.projs=[];g.ribbons=[];g.paused=true;
    const rec={g,f,last:now(),rocket:null,punches:[],disposers:[]};live.set(f,rec);
    return rec;
  }
  function purgeStale(){
    const active=new Set(global.fighters||[]);
    for(const [f,r] of live)if(!active.has(f)||f.hp<=0){r.g.destroy();live.delete(f);}
  }
  function find(id){
    purgeStale();
    const fighters=global.fighters||[];
    const f=fighters.find(f=>f&&f.id===id&&isBoxe(f));
    return f?live.get(f)||make(f):null;
  }
  function consume(ev){
    if(!ev||!ev.type?.startsWith('boxe:'))return;
    const body=ev.payload||{},rec=find(body.fighterId);
    if(!rec)return;const g=rec.g;
    const r=rec.f.__hrCombatant?.store?.__boxeBattle?.rocket;
    if(ev.type==='boxe:counter-guard'){
      // Owner Gold key-9 guard startup (VFX-only; native collision owns HP).
      g.skillCounter();
    }else if(ev.type==='boxe:counter-intercept'){
      g.fx.flash(rec.f.x,rec.f.y-20,155,'#ffe9a8',.25);
    }else if(ev.type==='boxe:rocket-launch'){
      rec.rocket={lastX:body.x,lastY:body.y,lastAt:ev.t,dist:0,lastVisual:ev.t};
      const a=body.heading||0,px=body.x+Math.cos(a)*40,py=body.y+Math.sin(a)*40;
      g.material.fracture(px,py+36,78,4);
      g.material.throwRubble(px,py+28,10,270,.7,a+Math.PI);
      g.fx.streakCone(px,py,a,10,'#ffd23c',.1,1500,110);
      g.fx.screenFlash('#ff9f2e',.12,.12);
      g.fire.column(px,py+18,72,180,.7,1);
    }else if(ev.type==='boxe:rocket-impact'){
      if(!r)return;
      const v=rec.rocket||{};
      const pr={x:r.x,y:r.y,angle:r.heading,vx:Math.cos(r.heading)*1250,vy:Math.sin(r.heading)*1250,phase:'out',traveled:v.dist||0};
      // Source Gold material erosion + Detail spark/lighting; no fake impact icon.
      g.material.eruption(pr.x,pr.y+22,.52,true);
      g.ring(pr.x,pr.y,'#ff7a3c',380,5,.3);
      g.rocketDetailContact(pr,{x:body.x,y:body.y,r:75});
    }else if(ev.type==='boxe:rocket-return'){
      g.rocketCatchApproach=.16;
    }else if(ev.type==='boxe:rocket-catch'){
      const state=rec.rocket;
      const prev=state||{lastX:rec.f.x-55,lastY:rec.f.y};
      const dx=rec.f.x-prev.lastX,dy=rec.f.y-prev.lastY;
      const angle=Math.atan2(dy,dx),speed=1450;
      const grip=g.glovePose('R');
      const syntheticVisualProjectile={vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,angle};
      // Calls the original Gold physical catch/spring implementation.
      g.hands.R.missing=false;
      g.startRocketCatch(syntheticVisualProjectile,grip,grip.x,grip.y+10);
      rec.rocket=null;
    }else if(ev.type==='boxe:flurry-punch'){
      const h=g.hands[body.punchIndex%2?'R':'L'];
      h.t=0;h.angle=g.player.aim;h.reach=155;h.dur=.26;
      g.fx.flash(g.player.x+Math.cos(h.angle)*95,g.player.y+Math.sin(h.angle)*95,45,'#ffd23c',.11);
    }else if(ev.type==='boxe:counter-contact'){
      g.fx.screenFlash('#ffd76a',.16,.35);
      g.startPunch('R',g.player.aim,132,.34,true);
      g.material.eruption(rec.f.x,rec.f.y+15,.75);
      g.fx.radialStreaks(rec.f.x,rec.f.y-20,20,'#ffe066',1100,80);
      if(body.finisher) {
        // Gold key-3 impact family, no second gameplay transaction.
        g.fx.flash(rec.f.x,rec.f.y-10,165,'#ff9f2e',.3);
        g.fire.column(rec.f.x,rec.f.y+15,90,230,.5,1);
      }
    }
  }
  AIL.bus.on('*',consume);
  function advance(rec,body){
    const g=rec.g,ct=body.__hrCombatant,st=ct?.store?.__boxeBattle;
    const clock=now(),dt=Math.min(.05,Math.max(0,clock-rec.last));rec.last=clock;
    g.time=clock;const p=g.player;
    p.x=body.x;p.y=body.y;p.aim=Math.atan2(body.dir?.y||0,body.dir?.x||1);
    p.faceX=(body.dir?.x??1)<0?-1:1;
    p.z=0;p.hp=body.hp;p.maxHp=body.maxHp||1000;
    p.empoweredT=st?Math.max(0,st.enhancedUntil-clock):0;
    p.guardT=st?.counter?.phase==='guard'?Math.max(0,st.counter.until-clock):0;
    g.hands.R.missing=!!st?.rocket;
    if(g.rocketCatch){g.rocketCatch.t+=dt;if(g.rocketCatch.t>=g.rocketCatch.life)g.rocketCatch=null;}
    if(g.hands.L.t>=0){g.hands.L.t+=dt/.26;if(g.hands.L.t>=1)g.hands.L.t=-1;}
    if(g.hands.R.t>=0){g.hands.R.t+=dt/.26;if(g.hands.R.t>=1)g.hands.R.t=-1;}
    if(st?.rocket){
      const r=st.rocket;
      const v=rec.rocket||(rec.rocket={lastX:r.x,lastY:r.y,lastAt:clock,dist:0});
      const delta=Math.hypot(r.x-v.lastX,r.y-v.lastY);
      const vx=dt>0?(r.x-v.lastX)/dt:Math.cos(r.heading)*1250;
      const vy=dt>0?(r.y-v.lastY)/dt:Math.sin(r.heading)*1250;
      v.dist+=delta;v.lastX=r.x;v.lastY=r.y;
      const pr={kind:'rocket',phase:r.phase==='outbound'?'out':'return',x:r.x,y:r.y,
        vx,vy,angle:Math.atan2(vy,vx),traveled:v.dist};
      if(pr.phase==='out')g.rocketDetailTravel(pr);else g.rocketDetailReturn(pr);
      g.projs=[pr];
      if(pr.phase==='return'){const d=Math.hypot(r.x-body.x,r.y-body.y);
        g.rocketCatchApproach=d<205?Math.max(0,(205-d)/175):0;}
    }else g.projs=[];
    g.material.update(dt);g.fluid.step(Math.min(dt,.034));
    g.fire.update(dt);g.lightning.update(dt);g.fx.update(dt);
  }
  const oldDraw=global.Fighter?.prototype?.draw;
  if(!oldDraw)throw Error('BOXE_REQUIRES_NATIVE_FIGHTER_DRAW');
  if(!global.Fighter.prototype.__boxeGoldDraw){
    global.Fighter.prototype.__boxeGoldDraw=true;
    global.Fighter.prototype.draw=function boxeGoldDraw(ctx){
      if(!isBoxe(this)||this.hp<=0)return oldDraw.call(this,ctx);
      const rec=live.get(this)||make(this);
      if(!rec.g.sprites)return; // UI readiness gate preloads real Gold sprites; no impostor body
      ctx.save();
      try{
        advance(rec,this);
        const g=rec.g;
        g.material.drawGround(ctx);
        g.material.drawWorld(ctx);
        g.drawPlayer(ctx);
        g.drawProjs(ctx);
        g.fire.draw(ctx);g.lightning.draw(ctx);
        g.drawFx(ctx);
        g.fx.drawTop(ctx);
      }finally{ctx.restore();}
    };
  }
  global.APEX_BOXE_GOLD_PRESENTATION={version:'r1-gold-extracted',
    ready:()=>!!lib.Engine&&!!global.Fighter?.prototype?.__boxeGoldDraw,
    hasSprites:f=>!!live.get(f)?.g?.sprites,
    teardown:f=>{const r=live.get(f);if(r){r.g.destroy();live.delete(f);}},
    purgeStale,
    snapshot:f=>({exists:live.has(f),sprites:!!live.get(f)?.g?.sprites,
      source:lib.sourceSha256,visualOnly:true})};
  global.apexBoxeGoldPresentationRuntime='ready';
})(typeof window!=='undefined'?window:globalThis);
