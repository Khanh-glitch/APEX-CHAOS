/* BOXE / normal Arsenal Battle adapter — gameplay authority only.
 * Opt-in through the canonical registry; no standalone simulation, HP writes,
 * fake weapons or synthesized visual effects. Gold presentation listens to
 * boxe:* events and must be provided before BOXE becomes public-playable.
 */
(function registerBoxeBattle(global) {
  'use strict';
  if (global.APEX_BOXE_BATTLE) return;
  const V = {passiveThreshold:300, enhancedSeconds:3, rocketOutboundSeconds:5,
    rocketReturnSeconds:.82, rocketRange:880, rocketRadius:46, rocketHitGap:.15,
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
      rocket:null,flurry:null,counter:null,catchId:0});
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
    const incoming=ev.victimCombatant===ct&&ev.creditedTo&&ev.creditedTo!==ct;
    const outgoing=ev.creditedTo===ct&&ev.victimCombatant!==ct&&
      typeof ev.weaponId==='string'&&!!ev.weaponId;
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
  function hitRocket(ctx,st,foe,now){
    const r=st.rocket;
    if(!r||r.phase!=='outbound')return;
    const touch=dist(r,foe)<=V.rocketRadius+(foe.radius||0);
    if(!touch){r.ongoingTouch=false;return;}
    if(r.ongoingTouch||now-r.lastHit<V.rocketHitGap)return;
    r.ongoingTouch=true;r.lastHit=now;
    ctx.api.applyStunTo(foe,V.rocketStunSeconds);
    disarm(ctx,foe,'rocket');
    emit(ctx,'boxe:rocket-impact',{targetId:foe.id,x:r.x,y:r.y,damage:0});
    if(r.enhanced&&!r.triggeredFlurry){
      r.triggeredFlurry=true;
      st.flurry={until:now+V.flurrySeconds,next:now,count:0};
      emit(ctx,'boxe:flurry-start',{duration:V.flurrySeconds,period:V.flurryInterval,bodyDash:false});
    }
  }
  function acquireGroundGun(ctx,st){
    const r=st.rocket;
    if(!r||r.cargoId||r.phase!=='outbound')return;
    const slots=global.APEX_ARSENAL?.state?.slots;
    if(!Array.isArray(slots))return;
    const idx=slots.findIndex(slot=>slot&&slot.phase==='REVEALED'&&slot.kind==='WEAPON'
      &&slot.weaponId!=='STORMBREAKER'&&slot.weaponId!=='T6'&&
      Math.hypot(slot.x-r.x,slot.y-r.y)<V.rocketRadius+20);
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
    emit(ctx,'boxe:rocket-catch',{x:body.x,y:body.y,
      physicalRecoil:true,hitstop:true,hasGun:!!r.cargoWeapon});
    st.rocket=null;
  }
  function tickRocket(ctx,dt){
    const st=boxe(ctx),r=st.rocket;if(!r)return;
    const body=ctx.combatant.anchor;
    if(!body||body.hp<=0){if(r.cargoWeapon)ctx.api.dropWeaponSlot(r.cargoWeapon,body?.x??r.x,body?.y??r.y);st.rocket=null;return;}
    const now=ctx.api.clock();
    if(r.awaitEquip){catchRocket(ctx,st);return;}
    if(r.phase==='outbound'){
      const fraction=Math.min(1,Math.max(0,(now-r.started)/V.rocketOutboundSeconds));
      r.x=r.startX+Math.cos(r.heading)*V.rocketRange*fraction;
      r.y=r.startY+Math.sin(r.heading)*V.rocketRange*fraction;
      const foe=liveOpponent(ctx);if(foe)hitRocket(ctx,st,foe,now);
      acquireGroundGun(ctx,st);
      if(fraction>=1){r.phase='returning';r.returnAt=now;
        r.returnX=r.x;r.returnY=r.y;
        emit(ctx,'boxe:rocket-return',{x:r.x,y:r.y});}
    }else{
      const t=Math.min(1,Math.max(0,(now-r.returnAt)/V.rocketReturnSeconds));
      // Owner remains mobile: the return endpoint follows the living shoulder.
      const ease=1-(1-t)*(1-t);
      r.x=r.returnX+(body.x-r.returnX)*ease;
      r.y=r.returnY+(body.y-r.returnY)*ease;
      if(t>=1)catchRocket(ctx,st);
    }
    if(st.rocket)emit(ctx,'boxe:rocket-position',{x:r.x,y:r.y,phase:r.phase});
  }
  function tickFlurry(ctx){
    const st=boxe(ctx),f=st.flurry;if(!f)return;
    const now=ctx.api.clock(),body=ctx.combatant.anchor,foe=liveOpponent(ctx);
    while(f.next<Math.min(now,f.until)&&f.count<24){
      const index=f.count++; f.next+=V.flurryInterval;
      // Real spatial/contact eligibility, not an invented guaranteed hit.
      const contact=foe&&dist(body,foe)<(body.radius||75)+(foe.radius||75)+110;
      if(contact){ctx.api.applyStunTo(foe,V.flurryHitStunSeconds);}
      emit(ctx,'boxe:flurry-punch',{punchIndex:index,hit:!!contact,
        targetId:contact?foe.id:null,damage:0});
    }
    if(now>=f.until){st.flurry=null;emit(ctx,'boxe:flurry-end');}
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
        st.rocket={started:now,startX:self.x,startY:self.y,x:self.x,y:self.y,
          phase:'outbound',heading,ongoingTouch:false,lastHit:-Infinity,
          enhanced:isEmpowered(ctx,st),triggeredFlurry:false,cargoId:null,cargoWeapon:null};
        emit(ctx,'boxe:rocket-launch',{x:self.x,y:self.y,heading,goldKey:'2',damage:0});return true;},
      onTick(ctx,dt){tickRocket(ctx,dt);tickFlurry(ctx);},
      onTeardown(ctx){const st=boxe(ctx);if(st.rocket?.cargoWeapon){const r=st.rocket,body=ctx.combatant.anchor;ctx.api.dropWeaponSlot(r.cargoWeapon,body?.x??r.x,body?.y??r.y);}st.rocket=null;st.flurry=null;}
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
  global.APEX_BOXE_BATTLE={version:'normal-r1',values:Object.freeze(V),executors,
    install(table){for(const [k,v] of Object.entries(executors)){
      if(table[k])throw Error('BOXE_MECHANIC_ALREADY_REGISTERED_'+k);
      table[k]=v;
    }return table;},snapshot(ctx){const st=boxe(ctx);return {
      progress:st.progress,enhancedUntil:st.enhancedUntil,
      rocket:st.rocket&&{phase:st.rocket.phase,x:st.rocket.x,y:st.rocket.y,
        cargoId:st.rocket.cargoId},flurry:st.flurry&&{count:st.flurry.count},
      counter:st.counter&&{phase:st.counter.phase}};}};
})(typeof window!=='undefined'?window:globalThis);
