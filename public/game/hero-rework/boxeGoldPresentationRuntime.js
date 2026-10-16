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
  // Gold's smoke/fire grid is centered; native match coordinates are not.
  const worldOffset=()=>((Number.isFinite(global.GAME_SIZE)?global.GAME_SIZE:1000)/2);
  const toGold=v=>v-worldOffset();
  function isBoxe(f){return f?.type?.__hrHero==='BOXE'||f?.__hrCombatant?.heroId==='BOXE';}
  function make(f){
    const offscreen=document.createElement('canvas');
    offscreen.width=1;offscreen.height=1;
    const g=new lib.Engine(offscreen,{visualOnly:true,materialFx:true,sound:false,
      hitstop:true,afterimage:true,shake:1});
    // visual-only Gold must never register DOM events, spawn lab enemies, or
    // requestAnimationFrame; the patched constructor returns before attach().
    g.enemies=[];g.projs=[];g.ribbons=[];g.paused=true;
    const rec={g,f,last:now(),rocket:null,flurry:null,punches:[],disposers:[]};live.set(f,rec);
    return rec;
  }
  function purgeStale(){
    const active=new Set(global.fighters||[]);
    for(const [f,r] of live)if(!active.has(f)||f.hp<=0){r.g.destroy();r.flurry?.g?.destroy();live.delete(f);}
  }
  function find(id){
    purgeStale();
    const fighters=global.fighters||[];
    const f=fighters.find(f=>f&&f.id===id&&isBoxe(f));
    return f?live.get(f)||make(f):null;
  }
  function syncGoldPlayer(g,body,aim){
    g.player.x=toGold(body.x);g.player.y=toGold(body.y);
    g.player.aim=Number.isFinite(aim)?aim:Math.atan2(body.dir?.y||0,body.dir?.x||1);
    g.player.faceX=Math.cos(g.player.aim)<0?-1:1;
  }
  // Gold key #1/#3/#9 create impact effects only through hitCone/hitCircle.
  // Feed those methods a **disconnected visual target**: it is a fresh POJO
  // holding copied positions, never the native Fighter, HP ledger or Arsenal
  // Combatant. Local dummy damage creates Gold VFX, NEVER real HP mutation.
  function syncVisualTarget(g,body,originX,originY,limit=Infinity){
    const foe=(global.fighters||[]).find(x=>x&&x!==body&&x.hp>0);
    if(!foe||Math.hypot(toGold(foe.x)-originX,toGold(foe.y)-originY)>limit){g.enemies=[];return;}
    const p=g.enemies[0]||{id:'__VISUAL_ONLY__',r:75,z:0,hp:1e9,maxHp:1e9,
      vx:0,vy:0,wob:0,dead:false,kind:'dummy',slowT:0,stunT:0};
    p.x=toGold(foe.x);p.y=toGold(foe.y);p.r=foe.radius||75;p.dead=false;
    p.hp=1e9;p.maxHp=1e9;
    g.enemies=[p];
  }
  // All Gold timeline events retain their actual delays without enabling a
  // second combat simulation or Gold's RAF/AI/projectiles.
  function advanceGoldFx(g,dt){
    if(!g)return;
    const p=g.player;
    g.time+=dt;
    for(let i=g.timeline.length-1;i>=0;i--){
      const e=g.timeline[i];e.t-=dt;
      if(e.t<=0){g.timeline.splice(i,1);e.fn();}
    }
    if(p.empoweredT>0&&Math.random()<.25)g.fire.puff(p.x+(Math.random()*52-26),p.y-Math.random()*40,14,0,-90,.45);
    for(const hand of ['L','R']){
      const h=g.hands[hand];
      if(h.t>=0){h.t+=dt/(h.dur||.26);if(h.t>=1)h.t=-1;}
      if(!h.missing){
        const pose=g.glovePose(hand);
        g.fx.trail(hand,pose.x,pose.y,g.trailColor,pose.active?30*pose.scale:13);
        if(p.empoweredT>0&&Math.random()<.3)g.fire.puff(pose.x+(Math.random()*20-10),pose.y+(Math.random()*16-8),12,0,-80,.4);
        if(pose.active){
          g.fluid.addForce(pose.x,pose.y,34,Math.cos(pose.angle)*9,Math.sin(pose.angle)*5);
          if(Math.random()<.5)g.after(pose.x,pose.y,pose.angle,'glove',g.trailColor,pose.mirror);
          if(Math.random()<.6)g.fx.addSpark(pose.x,pose.y,pose.angle+Math.PI,
            120+Math.random()*220,g.trailColor,1.2+Math.random()*1.2,.12+Math.random()*.12,p.y+34);
        }
      }
    }
    if(g.rocketCatch){g.rocketCatch.t+=dt;if(g.rocketCatch.t>=g.rocketCatch.life)g.rocketCatch=null;}
    g.rocketCatchApproach=Math.max(0,g.rocketCatchApproach-dt*4.2);
    for(const a of [...g.pressure]){a.life-=dt;if(a.life<=0)g.pressure.splice(g.pressure.indexOf(a),1);else{
      const k=1-a.life/a.max;a.r=6+(a.r1-6)*(1-Math.pow(1-k,2.4));}}
    for(const a of [...g.rings]){a.life-=dt;a.r+=a.vr*dt;if(a.life<=0)g.rings.splice(g.rings.indexOf(a),1);}
    for(const a of [...g.arcs]){a.life-=dt;if(a.life<=0)g.arcs.splice(g.arcs.indexOf(a),1);}
    for(const a of [...g.afters]){a.life-=dt;if(a.life<=0)g.afters.splice(g.afters.indexOf(a),1);}
    for(const a of [...g.particles]){
      a.life-=dt;a.vy+=(a.grav||0)*dt;
      const drag=Math.exp(-(a.drag||0)*dt);a.vx*=drag;a.vy*=drag;
      a.x+=a.vx*dt;a.y+=a.vy*dt;a.rot+=(a.vr||0)*dt;
      if(a.life<=0)g.particles.splice(g.particles.indexOf(a),1);
    }
    for(const zone of [...g.zones]){
      zone.t+=dt;
      if(zone.kind==='flame'&&!zone.pulsed&&zone.t>.12){zone.pulsed=true;
        g.fire.column(zone.x,zone.y,42,150,.65,.8);}
      if(zone.t>=zone.dur)g.zones.splice(g.zones.indexOf(zone),1);
    }
    g.material.update(dt);g.fluid.step(Math.min(dt,.034));
    g.fire.update(dt);g.lightning.update(dt);g.fx.update(dt,dt);
  }
  // Gold's ORIGINAL key-2 projectile exhaust cadence, copied from its
  // Engine.update rocket branch; only enemy damage and second movement loop
  // are removed. APEX alone owns velocity and HP.
  function goldRocketExhaust(g,pr){
    const y=pr.y-10; // source-Gold SHOULDER_Y
    const v=g.player;
    g.fire.puff(pr.x-pr.vx*.04,pr.y-pr.vy*.04-10,26,-pr.vx*.12,-pr.vy*.12-60,.9);
    g.fx.flash(pr.x,y,48,'#ff7a3c',.22);
    g.fx.addSmoke(pr.x,y,-pr.vx*.06,-pr.vy*.06+(Math.random()*32-16),13+Math.random()*11,.45+Math.random()*.35,'#ff8a4c',true);
    if(Math.random()<.5)g.fx.addSmoke(pr.x,y,Math.random()*40-20,Math.random()*36-10,16+Math.random()*12,.6+Math.random()*.4,'#6f6a62',false);
    g.fx.addEmber(pr.x,y,'#ffd23c',90);
    g.fx.pool(pr.x,pr.y+34,90,'#ff7a3c',.16);
    g.burst(pr.x,pr.y,1,['#ffe97a'],'spark',40,3,.3);
    if(Math.random()<.35)g.lightning.strike(pr.x,y,pr.x+(Math.random()*80-40),y+(Math.random()*80-40),'#ffd23c',1.6,{branches:1,life:.14,rough:.5});
    g.rocketDetailTravel(pr);
  }
  function consume(ev){
    if(!ev||!ev.type?.startsWith('boxe:'))return;
    const body=ev.payload||{},rec=find(body.fighterId);
    if(!rec)return;const g=rec.g;
    const r=rec.f.__hrCombatant?.store?.__boxeBattle?.rocket;
    if(ev.type==='boxe:counter-guard'){
      syncGoldPlayer(g,rec.f);
      g.skillCounter(); // EXACT Gold key 9 startup, including material+screen fx
      g.player.guardT=body.duration||1;
    }else if(ev.type==='boxe:counter-intercept'){
      g.fx.flash(toGold(rec.f.x),toGold(rec.f.y)-20,155,'#ffe9a8',.25);
    }else if(ev.type==='boxe:rocket-launch'){
      rec.rocket={lastX:body.x,lastY:body.y,lastAt:ev.t,dist:0,lastVisual:ev.t};
      syncGoldPlayer(g,rec.f,body.heading);
      g.hands.R.missing=false;
      g.skillRocket(); // EXACT Gold key 2 entire launch: smoke, scorch,
                       // flame, debris, impulse, shake, pressure and sparks.
      g.projs=[]; // Replace only Gold combat/projectile motion, NOT its FX.
    }else if(ev.type==='boxe:rocket-impact'){
      if(!r)return;
      const v=rec.rocket||{};
      const pr={x:toGold(body.x),y:toGold(body.y),angle:body.heading,
        vx:(body.speed||1250)*Math.cos(body.heading),
        vy:(body.speed||1250)*Math.sin(body.heading),phase:'out',traveled:v.dist||0};
      g.material.eruption(pr.x,pr.y+22,.52,true);
      g.ring(pr.x,pr.y,'#ff7a3c',380,5,.3);
      g.shake(4);g.hitstop(.04);
      g.rocketDetailContact(pr,{x:body.x,y:body.y,r:75});
    }else if(ev.type==='boxe:rocket-wall-reflect'){
      // Reuse Gold's earth/dust and lightning primitives for arena contact.
      g.material.fracture(toGold(body.x),toGold(body.y)+20,36,2,.55);
      g.fx.flash(toGold(body.x),toGold(body.y)-10,40,'#ffd23c',.10);
    }else if(ev.type==='boxe:flurry-start'){
      // Two fists stay at the physical impact site. Native BOXE is NEVER
      // teleported or slowed; a second *visual-only* Gold instance draws only
      // gloves and original six-jab FX, not another fighter body.
      const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
      const fg=new lib.Engine(canvas,{visualOnly:true,materialFx:true,sound:false,
        hitstop:true,afterimage:true,shake:1});
      fg.enemies=[];fg.projs=[];fg.ribbons=[];fg.paused=true;
      fg.player.x=toGold(body.x);fg.player.y=toGold(body.y);fg.player.aim=g.player.aim;
      fg.player.empoweredT=body.duration;
      rec.flurry={g:fg,x:toGold(body.x),y:toGold(body.y),start:now(),until:now()+body.duration,
        fromX:toGold(body.sourceX),fromY:toGold(body.sourceY),last:now(),cycle:0};
    }else if(ev.type==='boxe:rocket-shot'){
      // Native physical bullet/gauntlet contact. Gold V3 sound bank stays
      // untouched; original contact light, grit and sparks only.
      g.fx.flash(toGold(body.x),toGold(body.y)-14,50,'#ffe9a8',.13);
      g.fx.shock(toGold(body.x),toGold(body.y),65,'#ffd23c',4,.18);
      g.burst(toGold(body.x),toGold(body.y),7,['#ffffff','#ffe97a'],'spark',260,3,.24);
      g.material.fracture(toGold(body.x),toGold(body.y)+18,25,1,.25);
    }else if(ev.type==='boxe:rocket-return'){
      g.rocketCatchApproach=.16;
    }else if(ev.type==='boxe:rocket-catch'){
      const state=rec.rocket;
      const prev=state||{lastX:rec.f.x-55,lastY:rec.f.y};
      const dx=Number.isFinite(body.vx)?body.vx:rec.f.x-prev.lastX;
      const dy=Number.isFinite(body.vy)?body.vy:rec.f.y-prev.lastY;
      const angle=Math.atan2(dy,dx),speed=1450;
      syncGoldPlayer(g,rec.f,angle);
      const grip=g.glovePose('R');
      g.hands.R.missing=false;
      g.startRocketCatch({vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,angle},
        grip,toGold(prev.lastX),toGold(prev.lastY));
      g.ring(toGold(rec.f.x),toGold(rec.f.y),'#38e1ff',260,4,.3);
      rec.rocket=null;
    }else if(ev.type==='boxe:flurry-end'){
      if(rec.flurry){
        // Cancelling J must cancel future Gold jab callbacks too: the
        // original scheduled six-beat visuals must not keep punching after
        // native gameplay has withdrawn both gloves. Existing particles fade.
        rec.flurry.endAt=now();
        rec.flurry.g.timeline.length=0;
      }
    }else if(ev.type==='boxe:counter-contact'){
      const target=(global.fighters||[]).find(f=>f?.id===body.targetId)||{
        x:rec.f.x+90,y:rec.f.y,radius:75};
      syncGoldPlayer(g,rec.f,Math.atan2(target.y-rec.f.y,target.x-rec.f.x));
      syncVisualTarget(g,rec.f,g.player.x,g.player.y);
      // Source key 9 FULL counterStrike: impactPackage, ghost fist, wave,
      // lightning, material, afterimage and cinematic feedback. Enemy HP
      // remains exclusively owned by the native APEX Arsenal adapter.
      g.counterStrike({x:toGold(target.x),y:toGold(target.y),r:target.radius||75,z:0,dead:false});
      rec.counterFlashUntil=now()+.26;
      if(body.finisher){
        // Entire original key-3 choreography, including deferred five fire
        // columns; a visual-only Gold Engine has zero combat targets.
        syncGoldPlayer(g,rec.f,g.player.aim);
        g.skillUppercut();
      }
    }
  }
  AIL.bus.on('*',consume);
  function advance(rec,body){
    const g=rec.g,ct=body.__hrCombatant,st=ct?.store?.__boxeBattle;
    const clock=now(),dt=Math.min(.05,Math.max(0,clock-rec.last));rec.last=clock;
    syncGoldPlayer(g,body);
    g.player.z=0;g.player.hp=body.hp;g.player.maxHp=body.maxHp||1000;
    g.player.empoweredT=st?Math.max(0,st.enhancedUntil-clock):0;
    g.player.guardT=st?.counter?.phase==='guard'?Math.max(0,st.counter.until-clock):0;
    // Gold's visual-only launch recoil must decay; native movement stays authoritative.
    g.player.vx*=Math.exp(-10*dt);g.player.vy*=Math.exp(-10*dt);
    g.hands.R.missing=!!st?.secondary||!!st?.flurry;
    g.hands.L.missing=!!st?.rocket&&st.rocket.phase!=='caught';
    if(g.fx.scorches)g.fx.scorches.length=0;
    if(st?.rocket){
      const r=st.rocket;
      const v=rec.rocket||(rec.rocket={lastX:r.x,lastY:r.y,lastAt:clock,dist:0});
      const distance=Math.hypot(r.x-v.lastX,r.y-v.lastY);
      v.dist+=distance;v.lastX=r.x;v.lastY=r.y;
      const vx=Number.isFinite(r.vx)?r.vx:Math.cos(r.heading)*1250;
      const vy=Number.isFinite(r.vy)?r.vy:Math.sin(r.heading)*1250;
      const pr={kind:'rocket',phase:r.phase==='returning'?'return':'out',x:toGold(r.x),y:toGold(r.y),
        vx,vy,angle:r.heading,traveled:v.dist};
      if(r.phase==='outbound')goldRocketExhaust(g,pr);
      else if(r.phase==='returning')g.rocketDetailReturn(pr);
      g.projs=(r.phase==='flurry'||r.phase==='caught')?[]:[pr];
      if(st.secondary?.phase==='returning'){
        const h=st.secondary,angle=Math.atan2(h.y-h.prevY,h.x-h.prevX);
        const item={kind:'rocket',phase:'return',x:toGold(h.x),y:toGold(h.y),
          vx:h.x-h.prevX,vy:h.y-h.prevY,angle,traveled:0};
        g.rocketDetailReturn(item);g.projs.push(item);
      }
      if(r.phase==='returning'){
        const d=Math.hypot(r.x-body.x,r.y-body.y);
        g.rocketCatchApproach=d<205?Math.max(0,(205-d)/175):0;
      }
    }else g.projs=[];
    advanceGoldFx(g,dt);
    const f=rec.flurry;
    if(f){
      const elapsed=clock-f.start;
      const e=f.g;
      e.player.x=f.x;e.player.y=f.y;
      e.player.empoweredT=Math.max(0,f.until-clock);
      const foe=(global.fighters||[]).find(x=>x&&x!==body&&x.hp>0);
      if(foe)e.player.aim=Math.atan2(foe.y-f.y,foe.x-f.x);
      syncVisualTarget(e,body,f.x,f.y,46+(foe?.radius||75)+110);
      while(!f.endAt&&f.cycle<4&&elapsed>=f.cycle*.51){
        e.skillJab(); // EXACT Gold key 1 six-beat motion while live
        f.cycle++;
      }
      const fdt=Math.min(.05,Math.max(0,clock-f.last));f.last=clock;
      advanceGoldFx(e,fdt);
      if(f.endAt&&clock-f.endAt>.32){e.destroy();rec.flurry=null;}
    }
  }
  function drawLayers(ctx,g){
    // Original Gold engine's world-compositing layers in their source order.
    // Excludes Gold's alternative arena, AI, health overlays and second HUD.
    g.material.drawGround(ctx);
    g.fx.drawGround(ctx);
    g.drawAfters(ctx);
    g.material.drawWorld(ctx);
    g.fluid.draw(ctx,'smoke');
    g.drawPlayer(ctx);g.drawProjs(ctx);
    g.material.drawAtmosphere(ctx);
    ctx.save();ctx.globalAlpha=.45;g.fluid.draw(ctx,'smoke');ctx.restore();
    g.fluid.draw(ctx,'fire');
    g.fire.draw(ctx);g.lightning.draw(ctx);
    g.drawFx(ctx);g.fx.drawTop(ctx);
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
        ctx.translate(worldOffset(),worldOffset());
        drawLayers(ctx,g);
        if(rec.counterFlashUntil>now()){
          // Original Gold screen FX are spatially clipped to the counter
          // contact; other fighters and the Arsenal HUD never get flash.
          ctx.save();ctx.beginPath();ctx.arc(toGold(this.x),toGold(this.y),230,0,Math.PI*2);ctx.clip();
          g.fx.drawScreen(ctx,global.GAME_SIZE||1000,global.GAME_SIZE||1000,toGold(this.x),toGold(this.y));
          ctx.restore();
        }
        if(rec.flurry){
          const f=rec.flurry,fg=f.g,elapsed=Math.max(0,now()-f.start);
          ctx.save();
          // Draw the source Gold punch sprites, not circles or temporary assets.
          fg.drawAfters(ctx);
          fg.material.drawGround(ctx);fg.material.drawWorld(ctx);
          fg.fluid.draw(ctx,'smoke');
          const l=fg.glovePose('L'),r=fg.glovePose('R');
          const arrival=Math.min(1,elapsed/.11);
          const lx=f.fromX+(l.x-f.fromX)*(1-(1-arrival)**3);
          const ly=f.fromY+(l.y-f.fromY)*(1-(1-arrival)**3);
          if(!f.endAt&&fg.sprites){
            const hands=this.__hrCombatant?.store?.__boxeBattle?.flurry?.hands;
            if(!hands||hands.L.phase==='active')
              fg.drawGlovePose(ctx,{...l,x:lx,y:ly,scale:l.scale||1});
            if(!hands||hands.R.phase==='active'||hands.R.phase==='approach')
              fg.drawGlovePose(ctx,{...r,scale:r.scale||1});
          }
          fg.material.drawAtmosphere(ctx);
          fg.fluid.draw(ctx,'fire');fg.fire.draw(ctx);fg.lightning.draw(ctx);
          fg.drawFx(ctx);fg.fx.drawTop(ctx);
          ctx.restore();
        }
      }finally{ctx.restore();}
    };
  }
  global.APEX_BOXE_GOLD_PRESENTATION={version:'r2-owner-gold-choreography',
    ready:()=>!!lib.Engine&&!!global.Fighter?.prototype?.__boxeGoldDraw,
    hasSprites:f=>!!live.get(f)?.g?.sprites,
    teardown:f=>{const r=live.get(f);if(r){r.g.destroy();r.flurry?.g?.destroy();live.delete(f);}},
    purgeStale,
    snapshot:f=>({exists:live.has(f),sprites:!!live.get(f)?.g?.sprites,
      source:lib.sourceSha256,visualOnly:true})};
  global.apexBoxeGoldPresentationRuntime='ready';
})(typeof window!=='undefined'?window:globalThis);
