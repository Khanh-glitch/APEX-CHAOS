/* SHURI — native Hero Rework executor.
 * APEX owns physics, HP, skills and Arsenal. The Gold library is visual only.
 * This module registers three mechanic executors; it is not a second battle.
 *
 * Design (owner update 2026-10-17):
 *  - PASSIVE: each completed directly held T1-T5 gun/launcher is recycled
 *    into Scrap equal to its tier, paid on the Gold compressor beat.
 *  - A1: plant the shock bomb + build anchor and recoil. There is no
 *    structure switch. A shocked enemy is disarmed and the stolen gun
 *    enters the SAME recycle queue as the Passive.
 *  - A2: one contextual cast. No structure -> build at the anchor.
 *    Structure + held gun -> when that Holder completes, the gun mounts
 *    the rack instead of recycling; the rack re-seats it forever, each
 *    reload costing Scrap equal to its tier (out of Scrap the gun stays
 *    mounted but does not fire). Structure + unarmed inside the machine's
 *    operating range -> recovery hold (free heal, released by realized
 *    damage to SHURI or the machine). Otherwise -> efficient repair.
 *  - One operating range: 200 from the structure circumference. It gates
 *    rack target acquisition (READY only) and recovery admission; a
 *    magazine already firing always finishes.
 */
(function installShuriBattle(global) {
  'use strict';
  if(global.APEX_SHURI_BATTLE)return;
  const AIL=global.APEX_HERO_REWORK_AIL;
  if(!AIL)throw Error('SHURI_REQUIRES_AIL');
  const now=()=>AIL.clock();
  const CFG=()=>global.APEX_ARSENAL_CONFIG;
  const W=()=>global.APEX_ARSENAL?.weaponApi;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const a1cfgOf=(ct)=>ct?.skills?.A1?.cfg||{};
  const a2cfgOf=(ct)=>ct?.skills?.A2?.cfg||{};
  function tierNumber(weaponId){
    const level=Number(String(CFG()?.tierOf?.(weaponId)||'').slice(1));
    return Number.isInteger(level)&&level>=1&&level<=5?level:null;
  }
  const stateOf=(ct)=>{
    if(!ct||ct.heroId!=='SHURI')return null;
    return ct.store.__shuri||(ct.store.__shuri={
      scrap:ct.skills?.PASSIVE?.cfg?.initialScrap??20,anchor:null,bomb:null,structure:null,recoil:null,a1Sequence:null,
      pendingRecycle:[],pendingMount:null,disposed:false,
      serial:0,
    });
  };
  function emit(ctx,type,data={}){
    ctx.api.emitEvent('shuri:'+type,data);
  }
  function validStructure(s){return !!(s && s.solid && s.solid.hp>0 && s.phase!=='DEAD');}
  function structureOf(ctx){
    const st=stateOf(ctx.combatant);
    if(st.structure&&!validStructure(st.structure))destroyStructure(ctx,st,'destroyed');
    return st.structure;
  }
  // THE operating range: a fixed reach measured FROM the circumference,
  // shared by rack acquisition and recovery admission. No second radius.
  function inOperatingRange(ct,s,body){
    if(!s||!body)return false;
    const reach=a2cfgOf(ct).operatingRange??200;
    return distance(s.solid,body)-(s.solid.radius||75)<=reach;
  }
  // One recycle intake for every gun that becomes components — PASSIVE
  // completion and A1 theft share the queue, the receipt serial and the
  // Gold compressor delay. Returns the queue entry or null.
  function scheduleRecycle(st,weaponId,source){
    const amount=tierNumber(weaponId);
    if(amount==null)return null;
    const receipt=++st.serial;
    // Original Gold (8): 0.16s start delay + 2.84s compressor lock.
    // Accrue Scrap at that visual/SFX moment, never at the weapon fade.
    const entry={receipt,weaponId,amount,awardAt:now()+3.0,source};
    st.pendingRecycle.push(entry);
    return entry;
  }
  function releaseRackWeapon(ctx,s,reason){
    const host=s.emitter;
    if(host && W()?.getHolder(host))W().consume(host,reason);
    emit(ctx,'rack-release',{structureId:s.solid.id,reason});
  }
  function exitRecovery(ctx,st,s,reason){
    if(!s||!s.recovery)return;
    s.recovery=false;
    emit(ctx,'recovery-end',{structureId:s.solid.id,reason});
  }
  function destroyStructure(ctx,st,reason='destroyed'){
    const s=st.structure;
    if(!s||s.phase==='DEAD')return;
    s.phase='DEAD';
    s.solid.hp=0;
    s.recovery=false;
    releaseRackWeapon(ctx,s,'structure-destroyed');
    s.mountedWeaponId=null;s.reloadDue=false;s.starved=false;
    emit(ctx,'structure-destroyed',{structureId:s.solid.id,reason});
    st.structure=null;
    // pendingMount is deliberately kept: if the held gun later completes,
    // it simply falls back to its ordinary recycle fate (see listener).
  }
  // Seat a gun on the rack emitter (fill or replace). The mounted identity
  // is durable structure state; the Holder is only its current magazine.
  function tryMountOnRack(st,weaponId){
    const s=st.structure,weapons=W();
    if(!s||!validStructure(s)||s.phase!=='ACTIVE'||!s.emitter||!weapons)return false;
    if(weapons.getHolder(s.emitter))weapons.consume(s.emitter,'rack-replaced');
    if(!weapons.syncWeaponEmitter(s.emitter))return false;
    if(!weapons.equip(s.emitter,weaponId))return false;
    s.mountedWeaponId=weaponId;s.reloadDue=false;s.starved=false;
    return true;
  }
  function enemyInOperatingRange(ctx,s){
    return ctx.api.enemyBodies(ctx.combatant)
      .some(f=>f&&f.hp>0&&inOperatingRange(ctx.combatant,s,f));
  }
  function tickRack(ctx,st,s,dt){
    const host=s.emitter,weaponApi=W();
    if(!host||!weaponApi?.syncWeaponEmitter(host))return;
    const holder=weaponApi.getHolder(host);
    if(!holder)return;
    if(s.reloadDue){
      // The gun is already re-seated with a fresh Holder; it may not fire
      // until the reload transaction pays Scrap equal to its tier.
      const tier=tierNumber(s.mountedWeaponId);
      const cost=tier==null?null:tier*(a2cfgOf(ctx.combatant).reloadScrapPerTier??1);
      if(cost!=null&&st.scrap>=cost){
        st.scrap-=cost;s.reloadDue=false;s.starved=false;
        emit(ctx,'rack-reload',{structureId:s.solid.id,weaponId:s.mountedWeaponId,
          cost,scrap:st.scrap});
      }else{
        if(!s.starved){
          s.starved=true;
          emit(ctx,'rack-starved',{structureId:s.solid.id,
            weaponId:s.mountedWeaponId,cost});
        }
        return; // mounted but inert: the Holder is never advanced
      }
    }
    // Acquisition gate: a READY rack gun may only start aiming at an enemy
    // inside the operating range. A magazine already in AIM/FIRING (or any
    // later phase) always finishes, wherever the enemy goes.
    if(holder.phase==='READY'&&!enemyInOperatingRange(ctx,s))return;
    const oldShots=holder.shotsFired||0,beforeId=holder.weaponId;
    weaponApi.updateHolder(host,dt);
    const after=weaponApi.getHolder(host);
    if(!after){
      emit(ctx,'rack-cycle-ended',{structureId:s.solid.id,weaponId:beforeId});
      // Re-seat the SAME gun at once (the rack never becomes gun-less);
      // the next tick's reload transaction decides whether it may fire.
      if(s.mountedWeaponId&&weaponApi.syncWeaponEmitter(host)
        &&weaponApi.equip(host,s.mountedWeaponId))s.reloadDue=true;
    }else if(after.shotsFired>oldShots){
      emit(ctx,'rack-shot',{structureId:s.solid.id,weaponId:after.weaponId,
        count:after.shotsFired-oldShots});
    }
  }
  function tickRecovery(ctx,st,s,dt){
    const f=ctx.combatant.anchor;
    if(!f||f.hp<=0){exitRecovery(ctx,st,s,'owner-dead');return;}
    if(!inOperatingRange(ctx.combatant,s,f)){
      exitRecovery(ctx,st,s,'out-of-range');return;
    }
    // The machine holds SHURI: the shared engine position lock, re-asserted
    // every tick (the engine consumes it every frame — ROOT/nest law).
    if(f.data)f.data.positionLocked=true;
    const cap=f.maxHp||1000;
    if(f.hp<cap){
      const rate=a2cfgOf(ctx.combatant).healPerSecond??20;
      const actual=Math.min(rate*dt,cap-f.hp);
      if(actual>0){
        // Recovery is free: no Scrap, no structure HP exchange (owner law).
        f.hp=Math.min(cap,f.hp+actual);
        f.healingDone=(f.healingDone||0)+actual;
        global.APEX_ARSENAL?.state?.resultLedger?.onHeal?.(f,actual);
        emit(ctx,'heal',{structureId:s.solid.id,x:f.x,y:f.y,amount:actual});
      }
    }
    if(f.hp>=cap)exitRecovery(ctx,st,s,'full');
  }
  function tickStructure(ctx,st,dt){
    const s=st.structure;
    if(!s)return;
    if(!validStructure(s)){destroyStructure(ctx,st);return;}
    const t=now();
    if(s.phase==='BUILD'){
      s.lastSolidHp=s.solid.hp;
      if(t>=s.buildEnds){
        s.phase='ACTIVE';
        s.emitter=W()?.createWeaponEmitter?.(ctx.combatant.anchor,s.solid)||null;
        s.lastSolidHp=s.solid.hp;
        emit(ctx,'build-complete',{structureId:s.solid.id});
      }
      return;
    }
    if(s.phase!=='ACTIVE')return;
    // World solids have no damage bus event (only WallShattered at zero),
    // so structure damage during recovery is realized HP accounting: the
    // machine has no self-drain left, hence any decrease is enemy damage.
    if(s.solid.hp<s.lastSolidHp-1e-9&&s.recovery)
      exitRecovery(ctx,st,s,'structure-damaged');
    s.lastSolidHp=s.solid.hp;
    if(s.recovery)tickRecovery(ctx,st,s,dt);
    else tickRack(ctx,st,s,dt);
    if(s.solid.hp<=0)destroyStructure(ctx,st);
  }
  // GOLD (8) is the timing authority. Gameplay waits for the EXACT
  // physical Gold beats; presentation receives events but cannot move
  // this native timeline. 0.40 place, 0.47 arm, 0.52 recoil.
  function tickA1Sequence(ctx,st){
    const q=st.a1Sequence;
    if(!q)return;
    const t=now();
    if(!q.placed && t>=q.castAt+.40){
      q.placed=true;
      st.anchor={...q.anchor};
      st.bomb={id:q.id,x:q.anchor.x,y:q.anchor.y,
        armed:false,armedAt:q.castAt+.47};
      emit(ctx,'a1-place',{bombId:q.id,x:q.anchor.x,y:q.anchor.y});
    }
    if(!q.recoiled && t>=q.castAt+.52){
      q.recoiled=true;
      st.recoil={dx:q.dx,dy:q.dy,speed:q.speed,
        startedAt:q.castAt+.52,until:q.castAt+.52+q.duration};
      emit(ctx,'a1-recoil',{bombId:q.id,x:ctx.combatant.anchor.x,
        y:ctx.combatant.anchor.y,dx:q.dx,dy:q.dy});
    }
    if(t>=q.castAt+1.6)st.a1Sequence=null;
  }
  function tickRecycle(ctx,st){
    const due=st.pendingRecycle;
    if(!due?.length)return;
    const t=now();
    for(let i=due.length-1;i>=0;i--){
      const item=due[i];
      if(t<item.awardAt)continue;
      due.splice(i,1);
      st.scrap+=item.amount;
      emit(ctx,'recycle-award',{weaponId:item.weaponId,
        amount:item.amount,total:st.scrap,receipt:item.receipt,source:item.source});
    }
  }
  // A shocked enemy loses a held gun/launcher into SHURI's collector: the
  // canonical consume() ends the victim Holder as a NON-completion (the
  // victim can never recycle their own stolen gun, even in a mirror
  // match), and the shared recycle queue pays SHURI its tier in Scrap.
  function disarmIntoCollector(ctx,st,victim){
    const weapons=W(),held=weapons?.getHolder?.(victim);
    if(!held||CFG()?.isGunOrLauncher?.(held.weaponId)!==true)return null;
    if(tierNumber(held.weaponId)==null)return null;
    const weaponId=held.weaponId;
    weapons.consume(victim,'shuri-a1-disarm');
    const entry=scheduleRecycle(st,weaponId,'a1-disarm');
    if(entry)emit(ctx,'recycle-start',{weaponId,amount:entry.amount,
      receipt:entry.receipt,awardAt:entry.awardAt,source:'a1-disarm',
      targetId:victim.id});
    return weaponId;
  }
  function tickBomb(ctx,st){
    const b=st.bomb;
    if(!b)return;
    const t=now();
    if(!b.armed){
      if(t<b.armedAt)return;
      b.armed=true;
      emit(ctx,'bomb-armed',{bombId:b.id,x:b.x,y:b.y});
    }
    const enemyBodies=ctx.api.enemyBodies(ctx.combatant);
    const radius=a1cfgOf(ctx.combatant).bombRadius??100;
    const hit=enemyBodies.find(f=>f?.hp>0&&Math.hypot(f.x-b.x,f.y-b.y)<=radius+(f.radius||75));
    if(hit){
      ctx.api.applyStunTo(hit,a1cfgOf(ctx.combatant).bombStunSeconds??1);
      const disarmedWeaponId=disarmIntoCollector(ctx,st,hit);
      emit(ctx,'bomb-trigger',{bombId:b.id,x:b.x,y:b.y,targetId:hit.id,disarmedWeaponId});
      st.bomb=null;
    }else if(t>=b.armedAt+(a1cfgOf(ctx.combatant).bombArmedLifetime??5)){
      emit(ctx,'bomb-expire',{bombId:b.id,x:b.x,y:b.y});
      st.bomb=null;
    }
  }
  function tickRecoil(ctx,st,dt){
    const r=st.recoil;
    if(!r)return;
    const t=now();
    const from=Math.max(r.startedAt,t-dt),through=Math.min(r.until,t);
    const step=r.speed*Math.max(0,through-from);
    if(t>=r.until)st.recoil=null;
    if(step<=0)return;
    const b=ctx.combatant.anchor;
    b.x+=r.dx*step;b.y+=r.dy*step;
    // The canonical post-step swept world/wall resolver owns contact.
    const S=ctx.api.gameSize,rad=b.radius||75;
    if(b.x<rad||b.x>S-rad){b.x=clamp(b.x,rad,S-rad);r.dx*=-1;}
    if(b.y<rad||b.y>S-rad){b.y=clamp(b.y,rad,S-rad);r.dy*=-1;}
  }
  function a1(ctx){
    const st=stateOf(ctx.combatant),f=ctx.combatant.anchor;
    // Recoiling out is SHURI's own exit: casting A1 releases the recovery
    // hold before the authored recoil moves her.
    const s=structureOf(ctx);
    if(s?.recovery)exitRecovery(ctx,st,s,'a1-cast');
    const anchor={x:f.x,y:f.y+50};
    const t=now();
    const id=++st.serial;
    const foe=ctx.api.enemyBodies(ctx.combatant).find(x=>x.hp>0);
    const vx=foe?f.x-foe.x:-(f.dir?.x||1),vy=foe?f.y-foe.y:-(f.dir?.y||0);
    const mag=Math.hypot(vx,vy)||1;
    st.a1Sequence={id,castAt:t,anchor,
      dx:vx/mag,dy:vy/mag,
      speed:a1cfgOf(ctx.combatant).recoilSpeedPreview??1300,
      duration:a1cfgOf(ctx.combatant).recoilSecondsPreview??.18,
      placed:false,recoiled:false};
    emit(ctx,'a1-start',{bombId:id,x:anchor.x,y:anchor.y,
      placeAt:t+.40,armAt:t+.47,recoilAt:t+.52});
    return true;
  }
  // ONE resolver for the contextual A2 cast; canCast and cast can never
  // disagree about which branch a press will take. Partition (owner law):
  // build < recovery-cancel < mount (held gun, anywhere) < recovery
  // (unarmed, in range, hurt) < repair.
  function resolveA2Branch(ctx){
    const st=stateOf(ctx.combatant),ct=ctx.combatant,cfg=a2cfgOf(ct);
    const s=structureOf(ctx);
    if(!s){
      return st.scrap>=(cfg.buildScrap??20)&&!!st.anchor
        &&!!ctx.api.nearestFreeWorldCircle(st.anchor.x,st.anchor.y,ct.anchor.radius||75,{excludeBody:ct.anchor})
        ?'build':null;
    }
    if(s.phase!=='ACTIVE')return null;
    if(s.recovery)return 'recovery-cancel';
    const held=W()?.getHolder?.(ct.anchor);
    if(held&&CFG()?.isGunOrLauncher?.(held.weaponId)===true
      &&st.pendingMount?.holder!==held)return 'mount';
    const f=ct.anchor;
    if(f.hp>0&&f.hp<(f.maxHp||1000)&&inOperatingRange(ct,s,f))return 'recovery';
    if(st.scrap>0&&s.solid.hp<(cfg.structureHP??200))return 'repair';
    return null;
  }
  function a2can(ctx){return resolveA2Branch(ctx)!=null;}
  function a2(ctx){
    const branch=resolveA2Branch(ctx);
    if(!branch)return false;
    const st=stateOf(ctx.combatant),ct=ctx.combatant,cfg=a2cfgOf(ct),s=structureOf(ctx);
    if(branch==='build'){
      const radius=ct.anchor.radius||75;
      const pos=ctx.api.nearestFreeWorldCircle(st.anchor.x,st.anchor.y,radius);
      if(!pos)return false;
      const structureHP=cfg.structureHP??200;
      const solid=ctx.api.spawnWall({owner:ct,shape:'circle',kind:'deployed',
        friendlyProjectilePassThrough:true,x:pos.x,y:pos.y,radius,
        hp:structureHP,lifetime:Infinity});
      st.scrap-=(cfg.buildScrap??20);
      st.structure={solid,phase:'BUILD',buildEnds:now()+(cfg.buildSeconds??5),
        emitter:null,mountedWeaponId:null,reloadDue:false,starved:false,
        recovery:false,lastSolidHp:solid.hp};
      emit(ctx,'build-start',{structureId:solid.id,x:pos.x,y:pos.y,
        anchorX:st.anchor.x,anchorY:st.anchor.y,adjusted:!!pos.adjusted,hp:structureHP});
      return true;
    }
    if(branch==='recovery-cancel'){
      exitRecovery(ctx,st,s,'canceled');
      return true;
    }
    if(branch==='mount'){
      // Mark the held Holder: it keeps firing in SHURI's hands and mounts
      // the rack at its one terminal completion (see the Holder listener).
      const held=W().getHolder(ct.anchor);
      st.pendingMount={holder:held,weaponId:held.weaponId};
      emit(ctx,'mount-pending',{structureId:s.solid.id,weaponId:held.weaponId});
      return true;
    }
    if(branch==='recovery'){
      s.recovery=true;s.lastSolidHp=s.solid.hp;
      emit(ctx,'recovery-start',{structureId:s.solid.id,
        x:ct.anchor.x,y:ct.anchor.y});
      return true;
    }
    // repair: spend only the Scrap the missing HP can actually absorb.
    const per=cfg.repairPerScrap??10,maxHp=cfg.structureHP??200;
    const missing=Math.max(0,maxHp-s.solid.hp);
    const spent=Math.min(st.scrap,Math.ceil(missing/per));
    const restored=Math.min(missing,spent*per);
    if(!(spent>0&&restored>0))return false;
    st.scrap-=spent;s.solid.hp+=restored;s.lastSolidHp=s.solid.hp;
    emit(ctx,'repair',{structureId:s.solid.id,spent,restored,
      hp:s.solid.hp,scrap:st.scrap});
    return true;
  }
  function tick(ctx,dt){
    const st=stateOf(ctx.combatant);
    if(!st||st.disposed)return;
    if(ctx.combatant.anchor?.hp<=0){
      if(st.structure)destroyStructure(ctx,st,'owner-dead');
      return;
    }
    tickA1Sequence(ctx,st);
    tickRecoil(ctx,st,dt);
    tickBomb(ctx,st);
    tickRecycle(ctx,st);
    tickStructure(ctx,st,dt);
  }
  function teardown(ctx){
    const st=stateOf(ctx.combatant);
    if(!st||st.disposed)return;
    if(st.structure)destroyStructure(ctx,st,'teardown');
    st.bomb=null;st.recoil=null;st.anchor=null;st.a1Sequence=null;
    st.pendingMount=null;
    st.pendingRecycle.length=0;st.disposed=true;
  }
  function install(EXECUTORS){
    EXECUTORS['shuri.shock_recoil']={
      cast:a1,
      aiEvaluate(ctx){return {shouldCast:!stateOf(ctx.combatant).bomb,score:.7,retryAfter:1};},
    };
    EXECUTORS['shuri.machine']={
      canCast:a2can,cast:a2,
      aiEvaluate(ctx){
        const branch=resolveA2Branch(ctx);
        if(!branch||branch==='recovery-cancel')
          return {shouldCast:false,score:0,retryAfter:.8};
        if(branch==='recovery'){
          const f=ctx.combatant.anchor,cap=f.maxHp||1000;
          return f.hp<=cap*.7
            ?{shouldCast:true,score:.75,retryAfter:1}
            :{shouldCast:false,score:.2,retryAfter:1};
        }
        return {shouldCast:true,score:branch==='build'?.85:.8,retryAfter:.8};
      },
    };
    EXECUTORS['shuri.recycle']={
      onTick:tick,onTeardown:teardown,
      // Realized HP loss — and only realized HP loss — breaks the recovery
      // hold on SHURI's side. The machine side is tickStructure accounting.
      onRealizedDamage(ctx,ev){
        const st=stateOf(ctx.combatant),s=st?.structure;
        if(!s?.recovery||!(ev?.amount>0))return;
        if(ev.victimCombatant===ctx.combatant)
          exitRecovery(ctx,st,s,'owner-damaged');
      },
    };
  }
  // One real holder completion may award Scrap once; each holder has one
  // termination receipt. Detached rack emitters never qualify as SHURI held.
  // A Holder marked by A2 has exactly one terminal disposition instead:
  // mount on completion, cancel on interruption, or the ordinary recycle
  // fate if no live rack remains when it completes.
  AIL.bus.on('ArsenalHolderEnded',(ev)=>{
    const p=ev.payload||{},f=p.fighter,ct=f?.__hrCombatant;
    if(!ct||ct.heroId!=='SHURI'||ct.anchor!==f)return;
    const st=stateOf(ct);
    if(!st||st.disposed)return;
    if(st.pendingMount&&p.holder&&st.pendingMount.holder===p.holder){
      const weaponId=st.pendingMount.weaponId;
      st.pendingMount=null;
      if(p.completion&&CFG()?.isGunOrLauncher?.(weaponId)===true
        &&tryMountOnRack(st,weaponId)){
        AIL.bus.emit('shuri:rack-mount',{
          fighterId:f.id,side:ct.side,combatantId:ct.combatantId,weaponId,
        });
        return;
      }
      if(!p.completion){
        AIL.bus.emit('shuri:mount-canceled',{
          fighterId:f.id,side:ct.side,combatantId:ct.combatantId,
          weaponId,reason:p.reason,
        });
        return;
      }
      // Completed with no live rack: fall through to the recycle fate.
    }
    if(!p.completion)return;
    if(CFG()?.isGunOrLauncher?.(p.weaponId)!==true)return;
    const entry=scheduleRecycle(st,p.weaponId,'passive');
    if(!entry)return;
    AIL.bus.emit('shuri:recycle-start',{
      fighterId:f.id,side:ct.side,combatantId:ct.combatantId,
      weaponId:p.weaponId,amount:entry.amount,receipt:entry.receipt,
      awardAt:entry.awardAt,source:'passive',
    });
  });
  // Recoil receives the canonical wall-contact normal; impact may reverse
  // its direction without ever owning a second collision pipeline.
  AIL.bus.on('WorldWallCollision',(ev)=>{
    const p=ev.payload||{},body=(global.fighters||[]).find(b=>b?.id===p.body);
    const ct=body?.__hrCombatant,st=ct&&stateOf(ct),r=st?.recoil;
    if(!r)return;
    const dot=r.dx*(p.nx||0)+r.dy*(p.ny||0);
    if(dot<0){r.dx-=2*dot*p.nx;r.dy-=2*dot*p.ny;}
  });
  global.APEX_SHURI_BATTLE=Object.freeze({install,stateOf});
})(typeof window!=='undefined'?window:globalThis);
