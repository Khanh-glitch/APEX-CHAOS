/* SHURI — native Hero Rework executor.
 * APEX owns physics, HP, skills and Arsenal. The Gold library is visual only.
 * This module registers three mechanic executors; it is not a second battle.
 */
(function installShuriBattle(global) {
  'use strict';
  if(global.APEX_SHURI_BATTLE)return;
  const AIL=global.APEX_HERO_REWORK_AIL;
  if(!AIL)throw Error('SHURI_REQUIRES_AIL');
  const now=()=>AIL.clock();
  const CFG=()=>global.APEX_ARSENAL_CONFIG;
  const W=()=>global.APEX_ARSENAL?.weaponApi;
  const SPAWN=()=>global.APEX_ARSENAL_SPAWN;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const stateOf=(ct)=>{
    if(!ct||ct.heroId!=='SHURI')return null;
    return ct.store.__shuri||(ct.store.__shuri={
      scrap:10,anchor:null,bomb:null,structure:null,recoil:null,disposed:false,
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
  function isEligibleSlot(slot){
    return CFG()?.isMountableFloorGun?.(slot)===true
      && !slot.questPickupOwner
      && !(slot.__frostFrozen && global.APEX_FROST?.deniesPickup?.(slot,null));
  }
  function rackRadius(s,t){
    return s.firstIntakeUntil>t?200:100;
  }
  function cost(slot){
    const tier=CFG()?.tierOf?.(slot.weaponId);
    const level=Number(String(tier||'').slice(1));
    return Number.isInteger(level)&&level>=1&&level<=5?level*20:Infinity;
  }
  function startMorph(ctx,st,s,target){
    if(!s||s.phase==='DEAD')return;
    s.phase='MORPH';s.morphFrom=s.mode;s.morphTo=target;
    s.morphEnds=now()+1.6; // provisional visual transition, not cooldown
    emit(ctx,'morph-start',{structureId:s.solid.id,from:s.morphFrom,to:target});
  }
  function releaseRackWeapon(ctx,s,reason){
    const host=s.emitter;
    if(host && W()?.getHolder(host))W().consume(host,reason);
    emit(ctx,'rack-release',{structureId:s.solid.id,reason});
  }
  function requestMorph(ctx,st,s){
    const target=s.phase==='BUILD'
      ? (s.plannedMode==='RACK'?'MED':'RACK')
      : (s.phase==='MORPH'? (s.morphTo==='RACK'?'MED':'RACK') : (s.mode==='RACK'?'MED':'RACK'));
    if(s.phase==='BUILD'){
      s.plannedMode=target;
      emit(ctx,'build-mode-changed',{structureId:s.solid.id,mode:target});
      return;
    }
    if(s.phase==='MORPH'){
      s.pendingAfterMorph=target;
      return;
    }
    if(s.mode==='RACK'){
      const h=s.emitter&&W()?.getHolder(s.emitter);
      if(h && (h.phase==='FIRING'||h.phase==='WINDUP') &&
          !(Number.isFinite(h.def?.shots)&&h.shotsFired>=h.def.shots)){
        s.pendingShotMorph={target,shots:h.shotsFired,holder:h};
        emit(ctx,'rack-finishing-shot',{structureId:s.solid.id,weaponId:h.weaponId});
        return;
      }
      releaseRackWeapon(ctx,s,'structure-morph');
    }
    startMorph(ctx,st,s,target);
  }
  function destroyStructure(ctx,st,reason='destroyed'){
    const s=st.structure;
    if(!s||s.phase==='DEAD')return;
    s.phase='DEAD';
    s.solid.hp=0;
    releaseRackWeapon(ctx,s,'structure-destroyed');
    if(s.stopPickup){s.stopPickup();s.stopPickup=null;}
    if(s.stopAttractor){s.stopAttractor();s.stopAttractor=null;}
    emit(ctx,'structure-destroyed',{structureId:s.solid.id,reason,mode:s.mode});
    st.structure=null;
  }
  function connectRack(ctx,st,s){
    const spawn=SPAWN(),weapons=W();
    if(!spawn?.registerExternalPickupConsumer||!spawn?.registerFloorAttractor||!weapons)return;
    const id='shuri-rack-'+s.solid.id+'-'+ctx.combatant.combatantId;
    s.emitter=weapons.createWeaponEmitter(ctx.combatant.anchor,s.solid);
    s.stopPickup=spawn.registerExternalPickupConsumer(id,(slot)=>{
      if(st.structure!==s||s.phase!=='ACTIVE'||s.mode!=='RACK')return null;
      if(!isEligibleSlot(slot)||!s.emitter||weapons.getHolder(s.emitter))return null;
      const d=distance(s.solid,slot),price=cost(slot);
      if(d>44||!(s.solid.hp>price))return null;
      return {
        owner:ctx.combatant.anchor,distance:d,
        commit(original){
          if(st.structure!==s||s.phase!=='ACTIVE'||s.mode!=='RACK'
            ||!isEligibleSlot(original)||weapons.getHolder(s.emitter)
            ||!(s.solid.hp>cost(original)))return false;
          weapons.syncWeaponEmitter(s.emitter);
          if(!weapons.equip(s.emitter,original.weaponId))return false;
          s.solid.hp-=cost(original);
          emit(ctx,'rack-equip',{structureId:s.solid.id,weaponId:original.weaponId,
            slotId:original.id,hp:s.solid.hp});
          return true;
        },
      };
    });
    s.stopAttractor=spawn.registerFloorAttractor(id,(slot)=>{
      if(st.structure!==s||s.phase!=='ACTIVE'||s.mode!=='RACK'||!isEligibleSlot(slot))
        return null;
      const d=distance(s.solid,slot),r=rackRadius(s,now());
      if(d<=44||d>r)return null;
      return {vx:(s.solid.x-slot.x)/d*560,vy:(s.solid.y-slot.y)/d*560};
    });
  }
  function tickStructure(ctx,st,dt){
    const s=st.structure;
    if(!s)return;
    if(!validStructure(s)){destroyStructure(ctx,st);return;}
    const t=now();
    if(s.phase==='BUILD'){
      if(t>=s.buildEnds){
        s.phase='ACTIVE';s.mode=s.plannedMode;
        s.firstIntakeUntil=t+1;
        connectRack(ctx,st,s);
        emit(ctx,'build-complete',{structureId:s.solid.id,mode:s.mode});
      }
      return;
    }
    if(s.phase==='MORPH'){
      if(t>=s.morphEnds){
        s.mode=s.morphTo;s.phase='ACTIVE';
        emit(ctx,'morph-complete',{structureId:s.solid.id,mode:s.mode});
        if(s.pendingAfterMorph&&s.pendingAfterMorph!==s.mode){
          const target=s.pendingAfterMorph;s.pendingAfterMorph=null;
          startMorph(ctx,st,s,target);
        }
      }
      return;
    }
    if(s.phase!=='ACTIVE')return;
    if(s.mode==='MED'){
      const f=ctx.combatant.anchor,cap=f.maxHp||1000;
      if(f.hp>0&&f.hp<cap&&distance(f,s.solid)<=200){
        const actual=Math.min(20*dt,cap-f.hp,s.solid.hp);
        if(actual>0){
          f.hp=Math.min(cap,f.hp+actual);
          s.solid.hp-=actual;
          f.healingDone=(f.healingDone||0)+actual;
          global.APEX_ARSENAL?.state?.resultLedger?.onHeal?.(f,actual);
          emit(ctx,'heal',{structureId:s.solid.id,x:f.x,y:f.y,amount:actual,hp:s.solid.hp});
        }
      }
    }else if(s.mode==='RACK'){
      const host=s.emitter,weaponApi=W();
      if(host&&weaponApi?.syncWeaponEmitter(host)){
        const before=weaponApi.getHolder(host);
        const oldShots=before?.shotsFired||0;
        weaponApi.updateHolder(host,dt);
        const after=weaponApi.getHolder(host);
        if(s.pendingShotMorph){
          const ticket=s.pendingShotMorph;
          if(!after||after!==ticket.holder||after.shotsFired>ticket.shots){
            s.pendingShotMorph=null;
            releaseRackWeapon(ctx,s,'structure-morph');
            startMorph(ctx,st,s,ticket.target);
          }
        }
        if(before&&!after){
          emit(ctx,'rack-cycle-ended',{structureId:s.solid.id,weaponId:before.weaponId});
        }else if(after&&after.shotsFired>oldShots){
          emit(ctx,'rack-shot',{structureId:s.solid.id,weaponId:after.weaponId,
            count:after.shotsFired-oldShots});
        }
      }
    }
    if(s.solid.hp<=0)destroyStructure(ctx,st);
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
    const hit=enemyBodies.find(f=>f?.hp>0&&Math.hypot(f.x-b.x,f.y-b.y)<=100+(f.radius||75));
    if(hit){
      ctx.api.applyStunTo(hit,1);
      emit(ctx,'bomb-trigger',{bombId:b.id,x:b.x,y:b.y,targetId:hit.id});
      st.bomb=null;
    }else if(t>=b.armedAt+5){
      emit(ctx,'bomb-expire',{bombId:b.id,x:b.x,y:b.y});
      st.bomb=null;
    }
  }
  function tickRecoil(ctx,st,dt){
    const r=st.recoil;
    if(!r)return;
    const t=now();
    const remaining=r.until-t;
    if(remaining<=0){st.recoil=null;return;}
    const b=ctx.combatant.anchor,step=r.speed*Math.min(dt,remaining);
    b.x+=r.dx*step;b.y+=r.dy*step;
    // The canonical post-step swept world/wall resolver owns contact.
    const S=ctx.api.gameSize,rad=b.radius||75;
    if(b.x<rad||b.x>S-rad){b.x=clamp(b.x,rad,S-rad);r.dx*=-1;}
    if(b.y<rad||b.y>S-rad){b.y=clamp(b.y,rad,S-rad);r.dy*=-1;}
  }
  function a1(ctx){
    const st=stateOf(ctx.combatant),f=ctx.combatant.anchor;
    const anchor={x:f.x,y:f.y};
    const t=now();
    const id=++st.serial;
    st.anchor=anchor;
    st.bomb={id,x:anchor.x,y:anchor.y,armed:false,armedAt:t+.38};
    const foe=ctx.api.enemyBodies(ctx.combatant).find(x=>x.hp>0);
    const vx=foe?f.x-foe.x:-(f.dir?.x||1),vy=foe?f.y-foe.y:-(f.dir?.y||0);
    const mag=Math.hypot(vx,vy)||1;
    st.recoil={dx:vx/mag,dy:vy/mag,speed:1300,until:t+.18};
    emit(ctx,'a1-plant',{bombId:id,x:anchor.x,y:anchor.y,armedAt:st.bomb.armedAt});
    const s=structureOf(ctx);
    if(s)requestMorph(ctx,st,s);
    return true;
  }
  function a2can(ctx){
    const st=stateOf(ctx.combatant),s=structureOf(ctx);
    if(!s)return st.scrap>=20 && !!st.anchor
      && !!ctx.api.nearestFreeWorldCircle(st.anchor.x,st.anchor.y,ctx.combatant.anchor.radius||75);
    return s.phase==='ACTIVE'&&st.scrap>0&&s.solid.hp<200;
  }
  function a2(ctx){
    if(!a2can(ctx))return false;
    const st=stateOf(ctx.combatant),s=structureOf(ctx);
    if(!s){
      const radius=ctx.combatant.anchor.radius||75;
      const pos=ctx.api.nearestFreeWorldCircle(st.anchor.x,st.anchor.y,radius);
      if(!pos)return false;
      const solid=ctx.api.spawnWall({owner:ctx.combatant,shape:'circle',kind:'deployed',
        friendlyProjectilePassThrough:true,x:pos.x,y:pos.y,radius,
        hp:200,lifetime:Infinity});
      st.scrap-=20;
      st.structure={solid,phase:'BUILD',mode:'RACK',plannedMode:'RACK',
        buildEnds:now()+5,firstIntakeUntil:0,emitter:null};
      emit(ctx,'build-start',{structureId:solid.id,x:pos.x,y:pos.y,
        anchorX:st.anchor.x,anchorY:st.anchor.y,adjusted:!!pos.adjusted,hp:200});
      return true;
    }
    const available=st.scrap,hpBefore=s.solid.hp;
    s.solid.hp=Math.min(200,s.solid.hp+available*10);
    st.scrap=0;
    emit(ctx,'repair',{structureId:s.solid.id,spent:available,
      restored:s.solid.hp-hpBefore,hp:s.solid.hp});
    return true;
  }
  function tick(ctx,dt){
    const st=stateOf(ctx.combatant);
    if(!st||st.disposed)return;
    if(ctx.combatant.anchor?.hp<=0){
      if(st.structure)destroyStructure(ctx,st,'owner-dead');
      return;
    }
    tickRecoil(ctx,st,dt);
    tickBomb(ctx,st);
    tickStructure(ctx,st,dt);
  }
  function teardown(ctx){
    const st=stateOf(ctx.combatant);
    if(!st||st.disposed)return;
    if(st.structure)destroyStructure(ctx,st,'teardown');
    st.bomb=null;st.recoil=null;st.anchor=null;st.disposed=true;
  }
  function install(EXECUTORS){
    EXECUTORS['shuri.shock_recoil']={
      cast:a1,
      aiEvaluate(ctx){return {shouldCast:!stateOf(ctx.combatant).bomb,score:.7,retryAfter:1};},
    };
    EXECUTORS['shuri.machine']={
      canCast:a2can,cast:a2,
      aiEvaluate(ctx){return {shouldCast:a2can(ctx),score:.8,retryAfter:.8};},
    };
    EXECUTORS['shuri.recycle']={
      onTick:tick,onTeardown:teardown,
    };
  }
  // One real holder completion may award Scrap once; each holder has one
  // termination receipt. Detached rack emitters never qualify as SHURI held.
  AIL.bus.on('ArsenalHolderEnded',(ev)=>{
    const p=ev.payload||{},f=p.fighter,ct=f?.__hrCombatant;
    if(!ct||ct.heroId!=='SHURI'||ct.anchor!==f||!p.completion)return;
    if(!CFG()?.isGunOrLauncher?.(p.weaponId))return;
    const st=stateOf(ct);
    if(!st||st.disposed)return;
    const amount=Number(String(CFG().tierOf(p.weaponId)).slice(1));
    if(!Number.isInteger(amount)||amount<1||amount>5)return;
    st.scrap+=amount;
    AIL.bus.emit('shuri:recycle',{
      fighterId:f.id,side:ct.side,combatantId:ct.combatantId,
      weaponId:p.weaponId,amount,total:st.scrap,reason:p.reason,
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
