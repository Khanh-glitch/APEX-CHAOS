/* BOXE / normal Arsenal Battle adapter — gameplay authority only.
 * Opt-in through the canonical registry; no standalone simulation, HP writes,
 * fake weapons or synthesized visual effects. Gold presentation listens to
 * boxe:* events and must be provided before BOXE becomes public-playable.
 */
(function registerBoxeBattle(global) {
  'use strict';
  if (global.APEX_BOXE_BATTLE) return;
  const V = {passiveThreshold:300, enhancedSeconds:3, rocketOutboundSeconds:5,
    rocketSpeed:1250, rocketReturnSpeed:1450, rocketRadius:46, rocketHitGap:.15,
    rocketStunSeconds:.5, flurrySeconds:2, flurryInterval:.085,
    flurryHitStunSeconds:.0425, counterGuardSeconds:1,
    counterTravelSeconds:.36, counterSpeed:1850,
    counterStunSeconds:2, finisherRemainingFraction:.10};
  const finite = n => Number.isFinite(n);
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const emit=(ctx,type,data={})=>ctx.api.emitEvent(type,{...data,hero:'BOXE'});
  const boxe=ctx=>{
    const st=ctx.combatant.store;
    return st.__boxeBattle || (st.__boxeBattle={progress:0,enhancedUntil:0,
      rocket:null,flurry:null,counter:null,recoil:null,catchId:0});
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
    const slot=ctx.api.dropWeaponSlot(id,other.x,other.y);
    emit(ctx,'boxe:disarm',{reason,weaponId:id,slotId:slot?.id??null,targetId:other.id});
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
  function hitRocket(ctx,st,foe,now){
    const r=st.rocket;
    if(!r||r.phase!=='outbound'||now-r.lastHit<V.rocketHitGap)return false;
    // A separating contact may re-enter during the same five-second active
    // interval; disarm remains a real once-per-held-gun authority operation.
    r.lastHit=now;
    ctx.api.applyStunTo(foe,V.rocketStunSeconds);
    disarm(ctx,foe,'rocket');
    // Collision is at the opponent's surface, while a newly dropped gun is
    // registered at the body centre. Account for that same body radius once.
    acquireGroundGun(ctx,st,(foe.radius||75)+4);
    emit(ctx,'boxe:rocket-impact',{targetId:foe.id,x:r.x,y:r.y,heading:r.heading,
      speed:V.rocketSpeed,damage:0,enhanced:r.enhanced});
    if(r.enhanced&&!r.triggeredFlurry){
      r.triggeredFlurry=true;
      r.phase='flurry'; // Rocket hand stops at actual contact, never owner body.
      const until=now+V.flurrySeconds;
      st.flurry={until,next:now,count:0,x:r.x,y:r.y,targetId:foe.id,
        approachFromX:ctx.combatant.anchor.x,approachFromY:ctx.combatant.anchor.y};
      emit(ctx,'boxe:flurry-start',{x:r.x,y:r.y,sourceX:ctx.combatant.anchor.x,
        sourceY:ctx.combatant.anchor.y,duration:V.flurrySeconds,
        period:V.flurryInterval,bodyDash:false,rocketPaused:true});
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
  function catchRocket(ctx,st){
    const r=st.rocket;if(!r)return;
    const body=ctx.combatant.anchor;
    if(r.cargoWeapon){
      const w=global.APEX_ARSENAL?.weaponApi;
      const cur=w?.getHolder?.(body);
      // Native holder must complete its active fire cycle.  Do not interrupt
      // one mid-burst and do not forge a second concurrently held item.
      if(cur&&cur.phase!=='READY'&&cur.phase!=='SPENT'){
        r.awaitEquip=true;return;
      }
      if(!w?.equip?.(body,r.cargoWeapon)){
        // Restore real floor slot on rejected equip, avoiding silent item loss.
        ctx.api.dropWeaponSlot(r.cargoWeapon,body.x,body.y);
        emit(ctx,'boxe:rocket-gun-rejected',{weaponId:r.cargoWeapon});
      }
    }
    // Gold absorbs the incoming 1450u/s projectile with ~16px directional
    // recoil over its 55ms compression+rebound. Move via native solid mover,
    // never via the disconnected visual Gold player velocity.
    const dir=unit(r.vx||0,r.vy||0);
    st.recoil={dirX:dir.x,dirY:dir.y,duration:.11,remaining:.11};
    emit(ctx,'boxe:rocket-catch',{x:body.x,y:body.y,
      vx:r.vx,vy:r.vy,physicalRecoil:true,hitstop:true,hasGun:!!r.cargoWeapon});
    st.rocket=null;
  }
  function startRocketReturn(ctx,st,now){
    const r=st.rocket;
    if(!r||r.phase==='returning')return;
    r.phase='returning';r.returnAt=now;
    emit(ctx,'boxe:rocket-return',{x:r.x,y:r.y,speed:V.rocketReturnSpeed});
  }
  function tickRocket(ctx,dt){
    const st=boxe(ctx),r=st.rocket;if(!r)return;
    const body=ctx.combatant.anchor;
    if(!body||body.hp<=0){
      if(r.cargoWeapon)ctx.api.dropWeaponSlot(r.cargoWeapon,body?.x??r.x,body?.y??r.y);
      st.rocket=null;st.flurry=null;st.recoil=null;return;
    }
    const now=ctx.api.clock();
    if(r.awaitEquip){catchRocket(ctx,st);return;}
    if(r.phase==='flurry'){
      // The other glove travels here; the owner keeps moving independently.
      // Finish two seconds of punches even if the five-second clock elapsed.
      if(!st.flurry){
        if(now>=r.started+V.rocketOutboundSeconds)startRocketReturn(ctx,st,now);
        else r.phase='outbound';
      }
    }else if(r.phase==='outbound'){
      // Fixed velocity + substeps, NEVER distance/5sec interpolation.
      // World-edge response uses the same restitution=1 axis flip as Fighter.
      const elapsed=Math.max(0,now-r.started);
      let remaining=Math.min(Math.max(0,dt),Math.max(0,V.rocketOutboundSeconds-elapsed+Math.max(0,dt)));
      const arena=Number.isFinite(global.GAME_SIZE)?global.GAME_SIZE:1000;
      const lo=V.rocketRadius,hi=arena-V.rocketRadius;
      const foe=liveOpponent(ctx);
      while(remaining>1e-7&&r.phase==='outbound'){
        const step=Math.min(remaining,1/120);remaining-=step;
        const x0=r.x,y0=r.y;
        let x1=x0+r.vx*step,y1=y0+r.vy*step;
        // Collision against opponent is a solid reflection, not piercing.
        const u=foe?segmentBodyHit(x0,y0,x1,y1,foe,V.rocketRadius):null;
        if(u!==null&&now-r.lastHit>=V.rocketHitGap){
          r.x=x0+(x1-x0)*u;r.y=y0+(y1-y0)*u;
          const normal=unit(r.x-foe.x,r.y-foe.y);
          const incoming=r.vx*normal.x+r.vy*normal.y;
          if(incoming<0){
            const v=reflect(r.vx,r.vy,normal.x,normal.y);
            r.vx=v.x*V.rocketSpeed;r.vy=v.y*V.rocketSpeed;
            r.heading=Math.atan2(r.vy,r.vx);
            r.x=foe.x+normal.x*(V.rocketRadius+(foe.radius||75)+0.2);
            r.y=foe.y+normal.y*(V.rocketRadius+(foe.radius||75)+0.2);
            hitRocket(ctx,st,foe,now);
            emit(ctx,'boxe:rocket-reflect',{x:r.x,y:r.y,normalX:normal.x,
              normalY:normal.y,vx:r.vx,vy:r.vy,from:'fighter'});
            if(r.phase==='flurry')break;
            // Spend the remainder of this small substep travelling away.
            const rest=step*(1-u);x1=r.x+r.vx*rest;y1=r.y+r.vy*rest;
          }
        }
        if(r.phase==='outbound'){
          // Mirror Fighter.resolveWalls() normal response without damping.
          if(x1<lo||x1>hi){x1=Math.max(lo,Math.min(hi,x1));r.vx=x1===lo?Math.abs(r.vx):-Math.abs(r.vx);}
          if(y1<lo||y1>hi){y1=Math.max(lo,Math.min(hi,y1));r.vy=y1===lo?Math.abs(r.vy):-Math.abs(r.vy);}
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
    while(f.next<Math.min(now,f.until)&&f.count<24){
      const index=f.count++;f.next+=V.flurryInterval;
      // Physical fists stay at impact location; BOXE's body position cannot
      // cancel hits or drag the punches away as it runs around the arena.
      const contact=foe&&dist(f,foe)<=V.rocketRadius+(foe.radius||75)+110;
      if(contact)ctx.api.applyStunTo(foe,V.flurryHitStunSeconds);
      emit(ctx,'boxe:flurry-punch',{punchIndex:index,hand:index%2===0?'L':'R',
        x:f.x,y:f.y,hit:!!contact,targetId:contact?foe.id:null,damage:0});
    }
    if(now>=f.until){
      emit(ctx,'boxe:flurry-end',{x:f.x,y:f.y,punches:f.count});
      st.flurry=null;
      if(st.rocket?.phase==='flurry'){
        if(now>=st.rocket.started+V.rocketOutboundSeconds)startRocketReturn(ctx,st,now);
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
      onTick(ctx,dt){tickFlurry(ctx);tickRocket(ctx,dt);tickRecoil(ctx,dt);},
      onTeardown(ctx){const st=boxe(ctx);if(st.rocket?.cargoWeapon){const r=st.rocket,body=ctx.combatant.anchor;ctx.api.dropWeaponSlot(r.cargoWeapon,body?.x??r.x,body?.y??r.y);}st.rocket=null;st.flurry=null;st.recoil=null;}
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
  global.APEX_BOXE_BATTLE={version:'normal-r2-owner-physics',values:Object.freeze(V),executors,
    install(table){for(const [k,v] of Object.entries(executors)){
      if(table[k])throw Error('BOXE_MECHANIC_ALREADY_REGISTERED_'+k);
      table[k]=v;
    }return table;},snapshot(ctx){const st=boxe(ctx);return {
      progress:st.progress,enhancedUntil:st.enhancedUntil,
      rocket:st.rocket&&{phase:st.rocket.phase,x:st.rocket.x,y:st.rocket.y,
        cargoId:st.rocket.cargoId,vx:st.rocket.vx,vy:st.rocket.vy,
        enhanced:st.rocket.enhanced},flurry:st.flurry&&{count:st.flurry.count,
          x:st.flurry.x,y:st.flurry.y},
      counter:st.counter&&{phase:st.counter.phase}};}};
})(typeof window!=='undefined'?window:globalThis);
