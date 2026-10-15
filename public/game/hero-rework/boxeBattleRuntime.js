/* BOXE / normal Arsenal Battle adapter — gameplay authority only.
 * Opt-in through the canonical registry; no standalone simulation, HP writes,
 * fake weapons or synthesized visual effects. Gold presentation listens to
 * boxe:* events and must be provided before BOXE becomes public-playable.
 */
(function registerBoxeBattle(global) {
  'use strict';
  if (global.APEX_BOXE_BATTLE) return;
  const V = {passiveThreshold:300, enhancedSeconds:3, rocketOutboundSeconds:5,
    rocketSpeed:1250, rocketReturnSpeed:1450, rocketRadius:46,
    rocketStunSeconds:.35, rocketPushSpeed:320, flurrySeconds:2, flurryInterval:.085,
    flurryHitStunSeconds:.07, flurryPushSpeed:165, counterGuardSeconds:1,
    counterTravelSeconds:.36, counterSpeed:1850,
    counterStunSeconds:2, finisherRemainingFraction:.10};
  const finite = n => Number.isFinite(n);
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const emit=(ctx,type,data={})=>ctx.api.emitEvent(type,{...data,hero:'BOXE'});
  const boxe=ctx=>{
    const st=ctx.combatant.store;
    return st.__boxeBattle || (st.__boxeBattle={progress:0,enhancedUntil:0,
      rocket:null,flurry:null,secondary:null,impulses:[],counter:null,recoil:null,pendingCargo:null,catchId:0});
  };
  const isEmpowered=(ctx,s)=>s.enhancedUntil>ctx.api.clock();
  function disarm(ctx,other,reason){
    const weaponApi=global.APEX_ARSENAL?.weaponApi;
    const old=weaponApi?.getHolder?.(other);
    if(!old)return false;
    const id=old.weaponId;
    weaponApi.consume(other,'boxe-'+reason);
    // Only an actual holder can generate a floor pickup. Gun ownership is
    // transferred through native consume plus the existing world-slot API.
    // Physical weapon ejection originates at the victim, not a teleport.
    // Victim-specific lock prevents same-tick auto re-equip during flight.
    const self=ctx.combatant.anchor,dir=unit(other.x-self.x,other.y-self.y);
    const gameSize=Number.isFinite(global.GAME_SIZE)?global.GAME_SIZE:1000;
    const px=Math.max(60,Math.min(gameSize-60,other.x+dir.x*18));
    const py=Math.max(60,Math.min(gameSize-60,other.y+dir.y*18));
    const slot=ctx.api.dropWeaponSlot(id,px,py);
    if(slot){
      slot.boxeDisarmedVictimId=other.id;
      slot.boxePickupLockUntil=ctx.api.clock()+(reason==='counter'?2.05:.85);
      slot.boxeEjection={fromX:other.x,fromY:other.y,vx:dir.x*1050,vy:dir.y*1050,
        remaining:.38};
    }
    emit(ctx,'boxe:disarm',{reason,weaponId:id,slotId:slot?.id??null,targetId:other.id,x:px,y:py});
    return true;
  }
  function liveOpponent(ctx){
    const foe=ctx.api.enemyOf(ctx.combatant)?.anchor;
    return foe&&foe.hp>0?foe:null;
  }
  function passiveDamage(ctx,ev){
    if(!(ev?.amount>0))return;
    const st=boxe(ctx),ct=ctx.combatant,now=ctx.api.clock();
    if(isEmpowered(ctx,st))return;
    // Only real HP deltas from the native ledger count; hero-skill packets
    // are already zero except enhanced A2. No invented weapon-only filter.
    const incoming=ev.victimCombatant===ct&&ev.creditedTo!==ct;
    const outgoing=ev.creditedTo===ct&&ev.victimCombatant!==ct;
    if(!incoming&&!outgoing)return;
    st.progress+=ev.amount;
    if(st.progress>=V.passiveThreshold){
      st.progress=0;st.enhancedUntil=now+V.enhancedSeconds;
      emit(ctx,'boxe:enhanced',{until:st.enhancedUntil,threshold:V.passiveThreshold});
    }
  }
  function tickPassive(ctx,dt){
    const st=boxe(ctx),now=ctx.api.clock();
    if(st.enhancedUntil>0&&now>=st.enhancedUntil){
      st.enhancedUntil=0;st.progress=0;emit(ctx,'boxe:enhanced-ended');
    }
    // Shared AbilityController already grants ordinary dt cooldown recovery.
    // Grant only the extra 1x while enhanced, never a second 2x.
    if(isEmpowered(ctx,st))for(const slot of ['A1','A2']){
      const skill=ctx.combatant.skills[slot];
      if(skill?.cdLeft>0)skill.cdLeft=Math.max(0,skill.cdLeft-Math.max(0,dt));
    }
  }
  const unit=(x,y)=>{const m=Math.hypot(x,y)||1;return {x:x/m,y:y/m};};
  const reflect=(vx,vy,nx,ny)=>{
    const d=vx*nx+vy*ny;
    return d<0?unit(vx-2*d*nx,vy-2*d*ny):unit(vx,vy);
  };
  // Continuous circle-vs-body test so a 1250-unit/s fist cannot tunnel
  // through an opponent during a lagged frame. Collision normal is measured
  // from target centre to physical fist, mirroring Fighter restitution=1.
  function segmentBodyHit(x0,y0,x1,y1,foe,radius){
    const dx=x1-x0,dy=y1-y0;
    const rr=radius+(foe.radius||75),fx=x0-foe.x,fy=y0-foe.y;
    const a=dx*dx+dy*dy;
    if(a<1e-12)return Math.hypot(fx,fy)<=rr?0:null;
    const qb=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-rr*rr;
    if(c<=0)return 0;
    const disc=qb*qb-4*a*c;if(disc<0)return null;
    const u=(-qb-Math.sqrt(disc))/(2*a);
    return u>=0&&u<=1?u:null;
  }
  // A real NEW contact, not an invisible 650ms immunity window.
  // Relative normal closing speed determines both stun and impulse.
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function impactStrength(vx,vy,tx,ty,nx,ny,reference=V.rocketSpeed){
    const closing=Math.max(0,-((vx-(tx||0))*nx+(vy-(ty||0))*ny));
    return clamp(closing/reference,0,1);
  }
  function applyImpact(ctx,st,foe,nx,ny,strength,jab=false){
    const power=Math.pow(clamp(strength,0,1),1.2);
    const stun=(jab?V.flurryHitStunSeconds:V.rocketStunSeconds)*power;
    if(stun>.002)ctx.api.applyStunTo(foe,stun);
    if(power>.001){
      const speed=(jab?V.flurryPushSpeed:V.rocketPushSpeed)*power;
      const old=st.impulses.find(k=>k.body===foe);
      if(old){old.vx+=-nx*speed;old.vy+=-ny*speed;}
      else st.impulses.push({body:foe,vx:-nx*speed,vy:-ny*speed});
    }
    return stun;
  }
  function tickImpulses(ctx,dt){
    const st=boxe(ctx),d=Math.max(0,dt);
    for(let i=st.impulses.length-1;i>=0;i--){
      const k=st.impulses[i];
      if(!k.body||k.body.hp<=0){st.impulses.splice(i,1);continue;}
      const scale=(1-Math.exp(-10*d))/10;
      const x=k.body.x+k.vx*scale,y=k.body.y+k.vy*scale;
      if(typeof ctx.api.moveHunterBody==='function')
        ctx.api.moveHunterBody(k.body,x,y);
      else{k.body.x=x;k.body.y=y;}
      const damp=Math.exp(-10*d);
      k.vx*=damp;k.vy*=damp;
      if(Math.hypot(k.vx,k.vy)<4)st.impulses.splice(i,1);
    }
  }
  function hitRocket(ctx,st,foe,now,normal,vx,vy){
    const r=st.rocket;
    if(!r||r.phase!=='outbound')return false;
    const fv=foe.__hrVel||{x:0,y:0};
    const power=impactStrength(vx,vy,fv.x,fv.y,normal.x,normal.y);
    const stun=applyImpact(ctx,st,foe,normal.x,normal.y,power);
    // A1 explicitly cannot disarm. A2 remains the sole fighter disarm.
    acquireGroundGun(ctx,st);
    emit(ctx,'boxe:rocket-impact',{targetId:foe.id,x:r.x,y:r.y,heading:r.heading,
      speed:Math.hypot(vx,vy),strength:power,stun,damage:0,enhanced:r.enhanced});
    if(r.enhanced&&!r.triggeredFlurry){
      r.triggeredFlurry=true;r.phase='flurry';
      const from=ctx.combatant.anchor;
      st.secondary={x:from.x,y:from.y,prevX:from.x,prevY:from.y,
        phase:'approach',returnX:r.x,returnY:r.y};
      const hands={
        L:{x:r.x,y:r.y,prevX:r.x,prevY:r.y,phase:'active',attack:null},
        R:{x:from.x,y:from.y,prevX:from.x,prevY:from.y,phase:'approach',attack:null}
      };
      st.flurry={until:now+V.flurrySeconds,next:now,count:0,x:r.x,y:r.y,
        targetId:foe.id,hands,approachStart:now,
        approachFromX:from.x,approachFromY:from.y};
      emit(ctx,'boxe:flurry-start',{x:r.x,y:r.y,sourceX:from.x,sourceY:from.y,
        duration:V.flurrySeconds,period:V.flurryInterval,bodyDash:false,rocketPaused:true});
    }
    return true;
  }
  function acquireGroundGun(ctx,st,collisionPadding=0){
    const r=st.rocket;
    if(!r||r.cargoId||r.phase!=='outbound')return;
    const slots=global.APEX_ARSENAL?.state?.slots;
    if(!Array.isArray(slots))return;
    const idx=slots.findIndex(slot=>slot&&slot.phase==='REVEALED'&&slot.kind==='WEAPON'
      &&slot.weaponId!=='STORMBREAKER'&&slot.weaponId!=='T6'&&
      Math.hypot(slot.x-r.x,slot.y-r.y)<V.rocketRadius+20+collisionPadding);
    if(idx<0)return;
    const slot=slots[idx];
    // A single slot is reserved atomically once. Do not mint a weapon now:
    // equip occurs only after the physical catch and current fire cycle.
    r.cargoId=slot.id;r.cargoWeapon=slot.weaponId;
    slots.splice(idx,1);
    emit(ctx,'boxe:rocket-gun-reserved',{slotId:slot.id,weaponId:slot.weaponId});
  }
  function tickPendingCargo(ctx){
    const st=boxe(ctx),p=st.pendingCargo;if(!p)return;
    const body=ctx.combatant.anchor,w=global.APEX_ARSENAL?.weaponApi;
    const held=w?.getHolder?.(body);
    if(held&&held.phase!=='READY'&&held.phase!=='SPENT')return;
    st.pendingCargo=null;
    if(!body||body.hp<=0||!w?.equip?.(body,p.weaponId)){
      ctx.api.dropWeaponSlot(p.weaponId,body?.x??p.x,body?.y??p.y);
      emit(ctx,'boxe:rocket-gun-rejected',{weaponId:p.weaponId});
    }else emit(ctx,'boxe:rocket-gun-equipped',{weaponId:p.weaponId});
  }
  function catchRocket(ctx,st){
    const r=st.rocket;if(!r)return;
    const body=ctx.combatant.anchor;
    // A physical catch is immediate; a busy firearm queues only the EQUIP.
    if(r.cargoWeapon)st.pendingCargo={weaponId:r.cargoWeapon,x:body.x,y:body.y};
    const dir=unit(r.vx||0,r.vy||0);
    st.recoil={dirX:dir.x,dirY:dir.y,duration:.11,remaining:.11};
    emit(ctx,'boxe:rocket-catch',{x:body.x,y:body.y,
      vx:r.vx,vy:r.vy,physicalRecoil:true,hitstop:true,hasGun:!!r.cargoWeapon});
    // Both independently detached gloves must be caught before A1 cooldown.
    if(st.secondary){
      r.phase='caught';r.x=body.x;r.y=body.y;
      tickPendingCargo(ctx);return;
    }
    completeA1Catch(ctx,st);
  }
  function completeA1Catch(ctx,st){
    st.rocket=null;
    const skill=ctx.combatant.skills?.A1;
    if(skill)skill.cdLeft=skill.cfg?.cooldown??15;
    emit(ctx,'boxe:rocket-cooldown-start',{duration:skill?.cdLeft??15});
    tickPendingCargo(ctx);
  }
  function startSecondaryReturn(st){
    if(st.secondary&&st.secondary.phase!=='returning')st.secondary.phase='returning';
  }
  function tickSecondary(ctx,dt){
    const st=boxe(ctx),second=st.secondary;if(!second)return;
    const now=ctx.api.clock(),body=ctx.combatant.anchor;
    second.prevX=second.x;second.prevY=second.y;
    if(second.phase==='approach'){
      const dx=second.returnX-second.x,dy=second.returnY-second.y;
      const d=Math.hypot(dx,dy),step=V.rocketReturnSpeed*Math.max(0,dt);
      if(d<=step||d<4){second.x=second.returnX;second.y=second.returnY;second.phase='active';}
      else{second.x+=dx/d*step;second.y+=dy/d*step;}
    }else if(second.phase==='returning'){
      const dx=body.x-second.x,dy=body.y-second.y,d=Math.hypot(dx,dy);
      const step=V.rocketReturnSpeed*Math.max(0,dt);
      if(d<=step+V.rocketRadius){
        emit(ctx,'boxe:secondary-catch',{x:body.x,y:body.y});
        st.secondary=null;
        if(st.rocket?.phase==='caught')completeA1Catch(ctx,st);
      }else{second.x+=dx/d*step;second.y+=dy/d*step;}
    }
  }
  function startRocketReturn(ctx,st,now){
    const r=st.rocket;
    if(!r||r.phase==='returning')return;
    r.phase='returning';r.returnAt=now;
    emit(ctx,'boxe:rocket-return',{x:r.x,y:r.y,speed:V.rocketReturnSpeed,
      reason:r.earlyRecall?'manual':'lifetime'});
  }
  function recastRocket(ctx){
    const st=boxe(ctx),r=st.rocket;if(!r||r.phase==='returning')return false;
    r.earlyRecall=true;
    if(r.phase==='flurry'){r.recallAfterFlurry=true;return true;}
    startRocketReturn(ctx,st,ctx.api.clock());
    return true;
  }
  function tickRocket(ctx,dt){
    const st=boxe(ctx),r=st.rocket;if(!r)return;
    const body=ctx.combatant.anchor;
    if(!body||body.hp<=0){
      if(r.cargoWeapon)ctx.api.dropWeaponSlot(r.cargoWeapon,body?.x??r.x,body?.y??r.y);
      st.rocket=null;st.flurry=null;st.secondary=null;st.recoil=null;return;
    }
    const now=ctx.api.clock();
    r.prevX=r.x;r.prevY=r.y;
    if(r.phase==='flurry'){
      // The other glove travels here; the owner keeps moving independently.
      // Finish two seconds of punches even if the five-second clock elapsed.
      if(!st.flurry){
        if(r.recallAfterFlurry||now>=r.started+V.rocketOutboundSeconds)
          startRocketReturn(ctx,st,now);
        else r.phase='outbound';
      }
    }else if(r.phase==='outbound'){
      // Fixed velocity + substeps, NEVER distance/5sec interpolation.
      // World-edge response uses the same restitution=1 axis flip as Fighter.
      const elapsed=Math.max(0,now-r.started);
      let remaining=Math.min(Math.max(0,dt),Math.max(0,V.rocketOutboundSeconds-elapsed+Math.max(0,dt)));
      const arena=Number.isFinite(global.GAME_SIZE)?global.GAME_SIZE:1000;
      const lo=V.rocketRadius,hi=arena-V.rocketRadius;
      const foe=liveOpponent(ctx),crystal=global.APEX_CRYSTAL;
      const geom=global.APEX_HERO_REWORK?.geom;
      while(remaining>1e-7&&r.phase==='outbound'){
        const step=Math.min(remaining,1/120);remaining-=step;
        const x0=r.x,y0=r.y;
        // Same kinetic admission and force integration as real Magnet projectiles.
        // No fake firearm identity or duplicated acceleration formula.
        r.owner=body;r.type='aq_ability';r.abilityKind='BOXE_FIST_ROCKET';
        r.aq=true;r.life=Math.max(.001,r.started+V.rocketOutboundSeconds-now);
        const magnet=global.APEX_MAGNET;
        magnet?.stepProjectiles?.(step,[r],ctx.api.combatantOfBody,now);
        const plan=magnet?.consumeMovementPlan?.(r);
        let x1=plan?.finalX??(x0+r.vx*step),y1=plan?.finalY??(y0+r.vy*step);
        const bodyU=foe?segmentBodyHit(x0,y0,x1,y1,foe,V.rocketRadius):null;
        let solid=null;
        if(geom?.capsuleToi&&crystal?.capsules){
          for(const cap of crystal.capsules()){
            if(cap.cons?.ct===ctx.combatant)continue;
            const hit=geom.capsuleToi(x0,y0,x1,y1,
              cap.ax,cap.ay,cap.bx,cap.by,cap.r+V.rocketRadius);
            if(hit&&hit.t>=0&&hit.t<=1&&(!solid||hit.t<solid.t))
              solid={...hit,cap};
          }
        }
        if(solid&&(bodyU===null||solid.t<=bodyU)){
          r.x=x0+(x1-x0)*solid.t;r.y=y0+(y1-y0)*solid.t;
          const n=unit(solid.nx,solid.ny),v=reflect(r.vx,r.vy,n.x,n.y);
          const speed=Math.hypot(r.vx,r.vy);
          r.vx=v.x*speed;r.vy=v.y*speed;r.heading=Math.atan2(r.vy,r.vx);
          r.x+=n.x*.4;r.y+=n.y*.4;
          const rest=step*(1-solid.t);
          x1=r.x+r.vx*rest;y1=r.y+r.vy*rest;
          emit(ctx,'boxe:rocket-crystal-reflect',{x:r.x,y:r.y,
            constructId:solid.cap.cons?.id,kind:solid.cap.kind});
          // Physical Crystal contact wins before a fighter hidden behind it.
          r.x=x1;r.y=y1;
        }else if(bodyU!==null){
          const u=bodyU; // Physical solidity applies even during stun re-hit cooldown.
          r.x=x0+(x1-x0)*u;r.y=y0+(y1-y0)*u;
          const normal=unit(r.x-foe.x,r.y-foe.y);
          const incoming=r.vx*normal.x+r.vy*normal.y;
          if(incoming<0){
            const impactVx=r.vx,impactVy=r.vy;
            const v=reflect(r.vx,r.vy,normal.x,normal.y);
            r.vx=v.x*V.rocketSpeed;r.vy=v.y*V.rocketSpeed;
            r.heading=Math.atan2(r.vy,r.vx);
            r.x=foe.x+normal.x*(V.rocketRadius+(foe.radius||75)+0.2);
            r.y=foe.y+normal.y*(V.rocketRadius+(foe.radius||75)+0.2);
            hitRocket(ctx,st,foe,now,normal,impactVx,impactVy);
            emit(ctx,'boxe:rocket-reflect',{x:r.x,y:r.y,normalX:normal.x,
              normalY:normal.y,vx:r.vx,vy:r.vy,from:'fighter'});
            if(r.phase==='flurry')break;
            // Spend the remainder of this small substep travelling away.
            const rest=step*(1-u);x1=r.x+r.vx*rest;y1=r.y+r.vy*rest;
          }
        }
        if(r.phase==='outbound'){
          // Mirror Fighter.resolveWalls() normal response without damping.
          if(x1<lo||x1>hi){x1=Math.max(lo,Math.min(hi,x1));r.vx=x1===lo?Math.abs(r.vx):-Math.abs(r.vx);
            emit(ctx,'boxe:rocket-wall-reflect',{x:x1,y:y1,side:x1===lo?'left':'right',vx:r.vx,vy:r.vy});}
          if(y1<lo||y1>hi){y1=Math.max(lo,Math.min(hi,y1));r.vy=y1===lo?Math.abs(r.vy):-Math.abs(r.vy);
            emit(ctx,'boxe:rocket-wall-reflect',{x:x1,y:y1,side:y1===lo?'top':'bottom',vx:r.vx,vy:r.vy});}
          r.x=x1;r.y=y1;r.heading=Math.atan2(r.vy,r.vx);
          acquireGroundGun(ctx,st);
        }
      }
      if(now>=r.started+V.rocketOutboundSeconds&&r.phase==='outbound')startRocketReturn(ctx,st,now);
    }
    if(r.phase==='returning'){
      // Gold chases the ACTUAL owner's moving grip at 1450u/s; the interval
      // is whatever interception physically needs, not a fake .82s tween.
      const gripX=body.x,gripY=body.y;
      const dx=gripX-r.x,dy=gripY-r.y,d=Math.hypot(dx,dy);
      const delta=V.rocketReturnSpeed*Math.max(0,dt);
      if(d<=V.rocketRadius+16||delta>=d){
        r.vx=d?dx/d*V.rocketReturnSpeed:0;
        r.vy=d?dy/d*V.rocketReturnSpeed:0;
        r.x=gripX;r.y=gripY;
        emit(ctx,'boxe:rocket-position',{x:r.x,y:r.y,phase:r.phase,vx:r.vx,vy:r.vy});
        catchRocket(ctx,st);
      }else{
        r.vx=dx/d*V.rocketReturnSpeed;r.vy=dy/d*V.rocketReturnSpeed;
        r.heading=Math.atan2(r.vy,r.vx);
        r.x+=r.vx*dt;r.y+=r.vy*dt;
      }
    }
    if(st.rocket)emit(ctx,'boxe:rocket-position',{x:r.x,y:r.y,phase:r.phase,
      vx:r.vx,vy:r.vy,enhanced:r.enhanced});
  }
  function tickRecoil(ctx,dt){
    const s=boxe(ctx),r=s.recoil;if(!r)return;
    const before=r.remaining,after=Math.max(0,before-Math.max(0,dt));
    // 16px directional momentum absorption with a damped ease-out envelope.
    const u0=before/r.duration,u1=after/r.duration;
    const travel=16*(u0*u0-u1*u1),body=ctx.combatant.anchor;
    if(typeof ctx.api.moveHunterBody==='function')
      ctx.api.moveHunterBody(body,body.x+r.dirX*travel,body.y+r.dirY*travel);
    else {body.x+=r.dirX*travel;body.y+=r.dirY*travel;}
    r.remaining=after;if(after===0)s.recoil=null;
  }
  function tickFlurry(ctx){
    const st=boxe(ctx),f=st.flurry;if(!f)return;
    const now=ctx.api.clock(),foe=liveOpponent(ctx);
    // 24 authored Gold beats (4 x 6), 85ms interval. A jab only stuns at
    // its REAL impact frame if its own glove reaches the target's surface.
    // No 231px all-directions circle, no synthetic hits for missing gloves.
    while(f.next<f.until&&f.next<=now&&f.count<24){
      const index=f.count++,hand=index%2===0?'L':'R',h=f.hands[hand];
      const aim=foe?Math.atan2(foe.y-f.y,foe.x-f.x):0;
      if(h.phase==='active')h.attack={
        started:f.next,hitAt:f.next+.05,index,aim,
        reach:index%6===5?122:104,registered:false
      };
      f.next+=V.flurryInterval;
    }
    for(const hand of ['L','R']){
      const h=f.hands[hand];h.prevX=h.x;h.prevY=h.y;
      const r=st.rocket,sec=st.secondary;
      if(hand==='L'&&h.phase==='returning'&&r){
        h.x=r.x;h.y=r.y;
        if(r.phase==='caught')h.phase='caught';
        continue;
      }
      if(hand==='L'&&h.phase==='caught'){h.x=ctx.combatant.anchor.x;h.y=ctx.combatant.anchor.y;continue;}
      if(hand==='R'&&!sec&&h.phase==='returning'){
        h.phase='caught';h.x=ctx.combatant.anchor.x;h.y=ctx.combatant.anchor.y;
        continue;
      }
      if(hand==='R'&&sec){
        if(sec.phase==='approach'||sec.phase==='returning'){
          h.x=sec.x;h.y=sec.y;h.phase=sec.phase;continue;
        }else if(sec.phase==='active'&&h.phase==='approach')h.phase='active';
      }
      if(h.phase!=='active')continue;
      const a=h.attack;
      if(!a){h.x=f.x;h.y=f.y;continue;}
      const elapsed=now-a.started;
      const u=elapsed<=.05?clamp(elapsed/.05,0,1)
        :clamp((.17-elapsed)/.12,0,1);
      h.x=f.x+Math.cos(a.aim)*a.reach*u;
      h.y=f.y+Math.sin(a.aim)*a.reach*u;
      if(!a.registered&&now>=a.hitAt){
        a.registered=true;
        const reach=a.reach;
        const dx=foe?foe.x-f.x:0,dy=foe?foe.y-f.y:0;
        const d=Math.hypot(dx,dy);
        const diff=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-a.aim),
          Math.cos(Math.atan2(dy,dx)-a.aim)));
        const contact=!!foe&&d<=reach+V.rocketRadius+(foe.radius||75)
          &&(d<1||diff<=.58);
        let stun=0,strength=0;
        if(contact){
          const nx= -Math.cos(a.aim),ny=-Math.sin(a.aim);
          const fv=foe.__hrVel||{x:0,y:0};
          strength=impactStrength(Math.cos(a.aim)*reach/.05,
            Math.sin(a.aim)*reach/.05,fv.x,fv.y,nx,ny,reach/.05);
          stun=applyImpact(ctx,st,foe,nx,ny,strength,true);
        }
        emit(ctx,'boxe:flurry-punch',{punchIndex:a.index,hand,x:h.x,y:h.y,
          hit:contact,stun,strength,targetId:contact?foe.id:null,damage:0});
      }
      if(elapsed>=.17)h.attack=null;
    }
    // The 24th Gold jab launches before 2s but contacts at +50ms.
    // Do not throw away its last physical impact at the timeline boundary.
    if(now>=f.until+.055){
      emit(ctx,'boxe:flurry-end',{x:f.x,y:f.y,punches:f.count});
      st.flurry=null;
      startSecondaryReturn(st);
      if(st.rocket?.phase==='flurry'){
        if(st.rocket.recallAfterFlurry||now>=st.rocket.started+V.rocketOutboundSeconds)
          startRocketReturn(ctx,st,now);
        else st.rocket.phase='outbound';
      }
    }
  }
  function counterTakeDamage(ctx,body,packet){
    const st=boxe(ctx),counter=st.counter,now=ctx.api.clock();
    if(!counter||counter.phase!=='guard'||now>=counter.until||!(packet.amount>0))return packet;
    const owner=ctx.api.combatantOfBody(packet.source);
    if(!owner||owner===ctx.combatant||owner!==ctx.api.enemyOf(ctx.combatant))return packet;
    counter.phase='charge';counter.started=now;counter.contact=false;
    emit(ctx,'boxe:counter-intercept',{preventedAmount:packet.amount,damage:0});
    // The target's takeDamage still runs its normal immunity/result pipeline;
    // only the eligible attack's payload becomes zero BEFORE HP changes.
    return {...packet,amount:0};
  }
  function counterOnTick(ctx,dt){
    const st=boxe(ctx),counter=st.counter;if(!counter)return;
    const now=ctx.api.clock(),body=ctx.combatant.anchor,foe=liveOpponent(ctx);
    if(counter.phase==='guard'){
      if(now>=counter.until){st.counter=null;emit(ctx,'boxe:counter-expired');}
      return;
    }
    if(counter.phase!=='charge'||!foe){st.counter=null;return;}
    // Local native movement: no teleport; the opponent can evade the counter.
    const vx=foe.x-body.x,vy=foe.y-body.y,d=Math.hypot(vx,vy)||1;
    const close=(body.radius||75)+(foe.radius||75)+12;
    if(d>close){const step=Math.min(Math.max(0,dt)*V.counterSpeed,d-close);
      if(typeof ctx.api.moveHunterBody==='function')ctx.api.moveHunterBody(body,body.x+vx/d*step,body.y+vy/d*step);
      else { // test harness only; production always owns the swept solid-world mover
        body.x+=vx/d*step;body.y+=vy/d*step;
      }}
    if(dist(body,foe)<=close){
      ctx.api.applyStunTo(foe,V.counterStunSeconds);
      disarm(ctx,foe,'counter');
      if(counter.enhanced){
        const w=global.APEX_ARSENAL?.weaponApi;
        // BOXE is not a weapon. Unknown native weapon IDs have neutral 1x,
        // while arsenal- labels still let the damage pipeline and ledger own HP.
        const before=foe.hp;
        w?.aqDamage?.(foe,before*V.finisherRemainingFraction,body,'BOXE_FINISHER',{
          resultSource:'boxe-a2-empowered'});
      }
      emit(ctx,'boxe:counter-contact',{targetId:foe.id,
        finisher:counter.enhanced,remainingFraction:counter.enhanced?V.finisherRemainingFraction:0});
      st.counter=null;
    }else if(now>=counter.started+V.counterTravelSeconds){
      st.counter=null;emit(ctx,'boxe:counter-miss');
    }
  }
  // Projectile contact candidates are read-only until the canonical global
  // TOI arbiter confirms that no earlier wall/body/Crystal/Mirror consumed it.
  // Relative swept circles cover BOTH moving projectile and moving gauntlet.
  function movingContact(p,x0,y0,x1,y1,radius,limit){
    const fx=(p.px??p.x)-x0,fy=(p.py??p.y)-y0;
    const vx=(p.x-(p.px??p.x))-(x1-x0);
    const vy=(p.y-(p.py??p.y))-(y1-y0);
    const R=radius+(p.radius||7),a=vx*vx+vy*vy;
    if(fx*fx+fy*fy<=R*R)return 0;
    if(a<1e-10)return null;
    const b=2*(fx*vx+fy*vy),c=fx*fx+fy*fy-R*R;
    const disc=b*b-4*a*c;if(disc<0)return null;
    const t=(-b-Math.sqrt(disc))/(2*a);
    return t>=0&&t<=Math.min(1,limit??1)?t:null;
  }
  function candidateProjectile(p,limitT=1){
    if(!p?.aq||!(p.life>0)||!['aq_bullet','aq_v43','aq_grenade','aq_thrown'].includes(p.type))
      return null;
    if(p.type==='aq_v43'&&(['flame','burn'].includes(p.kind)
      ||(p.kind==='mine'&&p.phase!=='flight')))return null;
    if(p.type==='aq_thrown'&&p.state!=='flight')return null;
    const match=global.APEX_HERO_REWORK?.match;
    if(!match?.combatants)return null;
    let best=null;
    for(const ct of match.combatants){
      if(ct.heroId!=='BOXE'||!ct.anchor||ct.anchor.hp<=0)continue;
      if(p.owner===ct.anchor||p.launchOwner===ct.anchor)continue;
      const st=ct.store.__boxeBattle,r=st?.rocket;
      if(!r)continue;
      const check=(hand,x0,y0,x1,y1,phase)=>{
        const t=movingContact(p,x0,y0,x1,y1,V.rocketRadius,limitT);
        if(t!=null&&(!best||t<best.t))best={ct,hand,phase,t,
          x:(p.px??p.x)+(p.x-(p.px??p.x))*t,
          y:(p.py??p.y)+(p.y-(p.py??p.y))*t};
      };
      if(st.flurry){
        for(const hand of ['L','R']){
          const h=st.flurry.hands[hand];
          if(h.phase==='caught')continue;
          check(hand,h.prevX??h.x,h.prevY??h.y,h.x,h.y,h.phase);
        }
      }else{
        if(r.phase!=='caught')
          check('L',r.prevX??r.x,r.prevY??r.y,r.x,r.y,r.phase);
        if(st.secondary)
          check('R',st.secondary.prevX??st.secondary.x,
            st.secondary.prevY??st.secondary.y,st.secondary.x,st.secondary.y,
            st.secondary.phase);
      }
    }
    return best;
  }
  function confirmProjectileContact(p,candidate){
    if(!candidate||!(p.life>0))return false;
    const ct=candidate.ct,st=ct.store.__boxeBattle;
    if(!st?.rocket)return false;
    const ctx={combatant:ct,api:{
      clock:()=>global.APEX_HERO_REWORK_AIL?.clock?.()??global.matchClock??0,
      emitEvent:(type,detail)=>global.APEX_HERO_REWORK_AIL?.bus?.emit?.(type,
        {...detail,fighterId:ct.anchor.id,side:ct.side})
    }};
    if(candidate.phase==='outbound'){
      st.rocket.earlyRecall=false;
      startRocketReturn(ctx,st,ctx.api.clock());
    }else if(st.flurry&&(candidate.phase==='active'||candidate.phase==='approach')){
      const h=st.flurry.hands[candidate.hand];
      h.phase='returning';h.attack=null;
      if(candidate.hand==='L')startRocketReturn(ctx,st,ctx.api.clock());
      else startSecondaryReturn(st);
    }
    emit(ctx,'boxe:rocket-shot',{hand:candidate.hand,x:candidate.x,
      y:candidate.y,weapon:p.weapon||null,projectileKind:p.kind||p.type,
      phase:candidate.phase,returning:true});
    // Contact stays physical during return but cannot restart recall.
    return true;
  }
  const executors={
    'boxe.fist_rocket':{
      canCast(ctx){return !boxe(ctx).rocket;},
      aiEvaluate(ctx){const foe=liveOpponent(ctx),self=ctx.combatant.anchor;
        return {shouldCast:!!foe&&dist(foe,self)<900,score:.75,reason:'rocket-line',retryAfter:.3};},
      cast(ctx){const st=boxe(ctx),self=ctx.combatant.anchor,foe=liveOpponent(ctx);
        if(st.rocket)return false;
        const now=ctx.api.clock(),heading=foe?Math.atan2(foe.y-self.y,foe.x-self.x)
          :Math.atan2(self.dir?.y||0,self.dir?.x||1);
        st.rocket={started:now,x:self.x,y:self.y,
          phase:'outbound',heading,vx:Math.cos(heading)*V.rocketSpeed,
          vy:Math.sin(heading)*V.rocketSpeed,lastHit:-Infinity,
          enhanced:isEmpowered(ctx,st),triggeredFlurry:false,cargoId:null,cargoWeapon:null};
        emit(ctx,'boxe:rocket-launch',{x:self.x,y:self.y,heading,goldKey:'2',
          speed:V.rocketSpeed,enhanced:st.rocket.enhanced,damage:0});return true;},
      recast:recastRocket,
      onTick(ctx,dt){tickPendingCargo(ctx);tickImpulses(ctx,dt);
        tickFlurry(ctx);tickRocket(ctx,dt);tickSecondary(ctx,dt);tickRecoil(ctx,dt);},
      onTeardown(ctx){const st=boxe(ctx);if(st.rocket?.cargoWeapon){const r=st.rocket,body=ctx.combatant.anchor;ctx.api.dropWeaponSlot(r.cargoWeapon,body?.x??r.x,body?.y??r.y);}if(st.pendingCargo){const p=st.pendingCargo;ctx.api.dropWeaponSlot(p.weaponId,p.x,p.y);}
        st.pendingCargo=null;st.rocket=null;st.flurry=null;st.secondary=null;
        st.impulses=[];st.recoil=null;}
    },
    'boxe.block_and_hit':{
      canCast(ctx){const st=boxe(ctx);return !st.counter&&!st.rocket&&!st.flurry;},
      aiEvaluate(ctx){const foe=liveOpponent(ctx),self=ctx.combatant.anchor;
        return {shouldCast:!!foe&&dist(foe,self)<520,score:.76,
          reason:'counter-opportunity',retryAfter:.35};},
      cast(ctx){const st=boxe(ctx),now=ctx.api.clock();if(!this.canCast(ctx))return false;
        st.counter={phase:'guard',until:now+V.counterGuardSeconds,
          enhanced:isEmpowered(ctx,st)};
        emit(ctx,'boxe:counter-guard',{goldKey:'9',duration:V.counterGuardSeconds});return true;},
      onTakeDamage:counterTakeDamage,
      onTick:counterOnTick,
      onTeardown(ctx){boxe(ctx).counter=null;}
    },
    'boxe.heat':{
      onRealizedDamage:passiveDamage,onTick:tickPassive,
      onTeardown(ctx){const st=boxe(ctx);st.progress=0;st.enhancedUntil=0;}
    }
  };
  global.APEX_BOXE_BATTLE={version:'normal-r5-contact-physics',values:Object.freeze(V),
    candidateProjectile,confirmProjectileContact,executors,
    install(table){for(const [k,v] of Object.entries(executors)){
      if(table[k])throw Error('BOXE_MECHANIC_ALREADY_REGISTERED_'+k);
      table[k]=v;
    }return table;},snapshot(ctx){const st=boxe(ctx);return {
      progress:st.progress,enhancedUntil:st.enhancedUntil,
      rocket:st.rocket&&{phase:st.rocket.phase,x:st.rocket.x,y:st.rocket.y,
        cargoId:st.rocket.cargoId,vx:st.rocket.vx,vy:st.rocket.vy,
        enhanced:st.rocket.enhanced},flurry:st.flurry&&{count:st.flurry.count,
          x:st.flurry.x,y:st.flurry.y,hands:st.flurry.hands},
      counter:st.counter&&{phase:st.counter.phase}};}};
})(typeof window!=='undefined'?window:globalThis);
