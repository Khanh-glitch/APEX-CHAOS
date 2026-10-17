/* SHURI GOLD (8): one-way live presentation adapter.
 * Authority: SHURI native executor, Arsenal weapons/projectiles, AIL collision.
 * This bridge replays the owner's unchanged visual rig and scored SFX in a
 * DISCONNECTED visual World. It NEVER writes to Fighter HP, pickup, cooldown,
 * projectile or weapon state. Gold's alternative arena/UI/dummy are excluded.
 */
(function installShuriGoldPresentation(global) {
  'use strict';
  if(global.APEX_SHURI_GOLD_PRESENTATION)return;
  const Gold=global.APEX_SHURI_GOLD_LIBRARY,AIL=global.APEX_HERO_REWORK_AIL;
  if(!Gold?.renderNativeLayer||!Gold?.visualStartRecycle||!AIL?.bus)
    throw Error('SHURI_GOLD_REQUIRES_IMMUTABLE_OWNER_LIBRARY_AND_AIL');
  const live=new Map();
  const FX_SHOW=Object.freeze({core:true,grip:true,tool:true,collector:true,
    structure:true,bomb:true,dummy:false,fixtures:false});
  const now=()=>AIL.clock();
  // Native reach markers are circumference-first. No center-filled discs.
  function reachRim(ctx,x,y,r,rgb,t,alpha=1){
    if(!(r>0)||!Number.isFinite(x)||!Number.isFinite(y))return;
    const phase=(t*.52)%1;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.setLineDash([7,12]);ctx.lineDashOffset=-t*15;
    ctx.strokeStyle='rgba('+rgb+','+(.45*alpha)+')';
    ctx.lineWidth=1.65;
    ctx.beginPath();ctx.arc(x,y,r+2,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    // Expanding pulse begins AT the true gameplay circumference.
    ctx.strokeStyle='rgba('+rgb+','+(.2*(1-phase)*alpha)+')';
    ctx.lineWidth=2.5+phase*5;
    ctx.beginPath();ctx.arc(x,y,r+2+phase*23,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  function drawNativeRangeRims(ctx,rec){
    const st=rec.f.__hrCombatant?.store?.__shuri;
    if(!st)return;
    const t=now();
    if(st.bomb)reachRim(ctx,st.bomb.x,st.bomb.y,100,'143,225,255',t);
    if(rec.bombBurst && t<rec.bombBurst.until){
      const p=1-(rec.bombBurst.until-t)/.4;
      ctx.save();ctx.strokeStyle='rgba(157,238,255,'+(.6*(1-p))+')';
      ctx.lineWidth=5*(1-p)+1;
      ctx.beginPath();ctx.arc(rec.bombBurst.x,rec.bombBurst.y,100+p*36,0,Math.PI*2);
      ctx.stroke();ctx.restore();
    }
    const s=st.structure;
    if(!s||s.phase==='DEAD'||!s.solid||s.solid.hp<=0)return;
    // ONE operating range: 200 measured FROM the circumference, so the rim
    // sits at structure radius + operatingRange from the centre. The same
    // boundary gates rack acquisition and recovery admission natively.
    const range=rec.f.__hrCombatant?.skills?.A2?.cfg?.operatingRange??200;
    const radius=(s.solid.radius||75)+range;
    if(s.phase==='BUILD'){
      reachRim(ctx,s.solid.x,s.solid.y,radius,'245,178,100',t,.18);
    }else if(s.phase==='ACTIVE'){
      reachRim(ctx,s.solid.x,s.solid.y,radius,
        s.recovery?'100,244,209':'255,183,95',t,.82);
    }
  }
  // Browsers require a real gesture before decoding/starting WebAudio.
  // Bind ONCE for all SHURI instances, not a per-fighter listener.
  let soundInit=null,gameAudioPrimed=false;
  function primeSound() {
    if(soundInit)return soundInit;
    gameAudioPrimed=true;
    soundInit=Promise.resolve(Gold.audioOn()).catch(error=>{
      console.warn('[SHURI GOLD] audio authorization failed',error);
      return false;
    });
    return soundInit;
  }
  if(global.document){
    for(const type of ['pointerdown','keydown','touchstart']){
      global.addEventListener(type,primeSound,{capture:true,once:true,passive:true});
    }
  }
  const isShuri=f=>f?.type?.__hrHero==='SHURI'||f?.__hrCombatant?.heroId==='SHURI';
  const bodyById=(id)=> (global.fighters||[]).find(f=>f&&f.id===id);
  let sprites=null,spriteError=null;
  const loadPromise=Gold.loadAll().then(im=>{sprites=im;return true;}).catch(e=>{
    spriteError=String(e);console.error('[SHURI GOLD] original rig not ready',e);return false;
  });
  function ensure(f) {
    let rec=live.get(f);
    if(rec)return rec;
    const w=Gold.createWorld();
    w.script=[];w.tasks=[];w.fixtures=[];w.free=true;
    w.dummy.pos.x=-1e6;w.dummy.pos.y=-1e6;
    const t=now();
    // Preserve choreography overrides; raise neutral spring attachment.
    for(const [m,k,z] of [[w.grip,112,.82],[w.tool,102,.80],[w.col,96,.84]]){
      m.k0=k;m.z0=z;m.k=k;m.z=z;
    }
    rec={f,w,last:t,audioStarted:false,healLast:0,healing:false,
      stunConfirmPending:false,healedPending:0,bombBurst:null,
      motionX:f.x,motionY:f.y,motionT:t,velX:0,velY:0,baseK:null,
      headX:null,headV:0,headT:t,mountFlight:null,dropFlight:null,
      lastMountedId:null};
    live.set(f,rec);
    return rec;
  }
  function visualTarget(w,f) {
    const foe=(global.fighters||[]).find(b=>b&&b!==f&&b.hp>0);
    // Target is only read at Gold A1 cast for the exact authored recoil angle.
    if(foe){w.dummy.pos.x=foe.x;w.dummy.pos.y=foe.y;}
    else{w.dummy.pos.x=-1e6;w.dummy.pos.y=-1e6;}
    return foe;
  }
  function syncNative(rec) {
    const {w,f}=rec,st=f.__hrCombatant?.store?.__shuri;
    w.shuri.pos.x=f.x;w.shuri.pos.y=f.y;
    w.shuri.hp=f.hp;w.shuri.max=f.maxHp||1000;
    if(st){
      w.shuri.scrap=st.scrap;
      w.shuri.a1cd=f.__hrCombatant?.skills?.A1?.cdLeft||0;
      w.shuri.a2cd=f.__hrCombatant?.skills?.A2?.cdLeft||0;
      if(st.anchor)w.anchor={pos:{x:st.anchor.x,y:st.anchor.y},t:w.anchor?.t??w.t};
      // Mounted-gun change tracking for the authored drop flight of a
      // replaced gun (see shuri:rack-mount / drawRackGun).
      if(st.structure){
        const mid=st.structure.mountedWeaponId||null;
        if(mid&&mid!==rec.lastMountedId){
          rec.prevMountedId=rec.lastMountedId;rec.lastMountedId=mid;
        }
      }else{
        rec.lastMountedId=null;rec.prevMountedId=null;rec.mountFlight=null;
      }
      if(!w.st){rec.headX=null;rec.headV=0;}
      if(st.structure?.solid && w.st){
        w.st.hp=Math.max(0,st.structure.solid.hp);
        // Gold's authored 5s build motion remains independent; never let
        // a placeholder machine damage or spawn alter native structure HP.
        w.st.pos.x=st.structure.solid.x;w.st.pos.y=st.structure.solid.y;
        // Native state owns the machine form: recovery reuses the authored
        // med morph (the mounted gun sinks in with the rack head), anything
        // else is the gun rack. Forcing the mode here every sync also
        // neutralizes Gold doA1's legacy 0.72s self-morph — native A1 no
        // longer switches the machine at all.
        if(w.st.phase==='active')
          w.st.mode=st.structure.recovery?'med':'rack';
        // Native Gun Rack uses genuine Arsenal holders. The Gold mock rack
        // MUST NEVER autonomously aim/fire, generate damage or audition shots.
        w.st.mounted=null;w.st.incoming=false;
        const holder=global.APEX_ARSENAL?.weaponApi?.getHolder?.(st.structure.emitter);
        // Rack head ownership: the adapter springs the head with Gold's own
        // authored constants (aim k=55 z=.7; idle sway k=30 z=.8 toward
        // -PI/2+sin(t*.6)*.5) and writes the result into Gold's headAng, so
        // the Gold ring and the native mounted gun share ONE rotation axis
        // and ONE angle. The head keeps its lively rest sway; the gun is
        // drawn in this exact frame by drawRackGun. Gold's internal sway
        // spring (mock mounted stays null) is overwritten here each sync.
        if(rec.headX==null){rec.headX=w.st.headAng.x;rec.headV=0;rec.headT=now();}
        {
          const tNow=now();
          let dtH=Math.min(0.05,Math.max(0,tNow-rec.headT));rec.headT=tNow;
          const aim=holder?.meta?.aimAngle;
          const engaging=!!holder&&holder.phase!=='READY'&&Number.isFinite(aim);
          const target=engaging?aim:(-Math.PI/2+Math.sin(w.t*0.6)*0.5);
          const k=engaging?55:30,c=2*Math.sqrt(k)*(engaging?0.7:0.8);
          while(dtH>1e-6){
            const h=Math.min(1/240,dtH);dtH-=h;
            let d=target-rec.headX;
            d=Math.atan2(Math.sin(d),Math.cos(d));
            rec.headV+=(k*d-c*rec.headV)*h;
            rec.headX+=rec.headV*h;
          }
          w.st.headAng.x=rec.headX;w.st.headAng.v=0;
        }
      }
    }
  }
  function consume(ev) {
    if(!ev?.type?.startsWith('shuri:'))return;
    const p=ev.payload||{};
    const f=bodyById(p.fighterId);
    if(!f||!isShuri(f))return;
    const rec=ensure(f),w=rec.w;
    syncNative(rec);
    switch(ev.type){
      case 'shuri:recycle-start':{
        const id=p.weaponId;
        const tier=Number(String(global.APEX_ARSENAL_CONFIG?.tierOf?.(id)||'').slice(1));
        if(tier>=1&&tier<=5)Gold.visualStartRecycle(w,tier);
        break;
      }
      case 'shuri:a1-start':{
        if(gameAudioPrimed)primeSound();
        visualTarget(w,f);
        Gold.doA1(w); // exact owner Gold charge/place/recoil/machine command
        w.dummy.pos.x=-1e6;w.dummy.pos.y=-1e6;
        break;
      }
      case 'shuri:bomb-trigger':{
        // Gold stun_confirm fires ONLY if native confirmed a body hit.
        const target=bodyById(p.targetId);
        w.dummy.pos.x=target?.x??-1e6;w.dummy.pos.y=target?.y??-1e6;
        Gold.triggerBomb(w);
        rec.bombBurst={x:p.x,y:p.y,until:now()+.4};
        if(target && p.targetId!=null)rec.stunConfirmPending=true;
        w.dummy.pos.x=-1e6;w.dummy.pos.y=-1e6;
        break;
      }
      case 'shuri:bomb-expire':
        // Expiry is NOT a stun or EMP. The owner Gold Lab auditions an
        // automatic discharge at 5s; native APEX explicitly distinguishes
        // timeout from confirmed contact. Clear the isolated visual prop
        // without firing Gold's discharge function.
        w.bomb=null;break;
      case 'shuri:build-start':{
        w.anchor={pos:{x:p.x,y:p.y},t:w.t};
        w.shuri.scrap=Math.max(20,w.shuri.scrap);
        if(w.st?.phase==='collapse')w.st=null;
        Gold.doA2(w); // original four-way, five-second Gold choreography
        break;
      }
      case 'shuri:build-complete':
        // A built machine always comes online as the gun rack; recovery is
        // a later native state mirrored continuously by syncNative.
        if(w.st)w.st.mode='rack';
        break;
      case 'shuri:repair':
        if(w.st){w.shuri.scrap=Math.max(p.spent||0,1);Gold.doA2(w);}break;
      case 'shuri:structure-destroyed':
        if(w.st&&w.st.phase!=='collapse')Gold.damageStructure(w,Math.max(w.st.hp,1));
        break;
      case 'shuri:heal':{
        // Native realized HP changes alone authorize heal audio. Gold demo
        // phantom health is never allowed to trigger extra healing feedback.
        if(!rec.healing)rec.healStartPending=true;
        rec.healing=true;rec.healUntil=now()+.14;
        if(now()-rec.healLast>=.6){rec.healLast=now();rec.pumpPending=true;}
        break;
      }
      case 'shuri:rack-mount':{
        // Authored gunfly (0.55s): the gun leaves Shuri's hand and docks on
        // the hub; a replaced gun gets the authored gundrop away. The
        // native sprite (with the fighter's equipped skin) flies — Gold's
        // own gunfly would fly tier art and charge native structure HP.
        const foeDir=f.side==='A'?1:-1;
        rec.mountFlight={weaponId:p.weaponId,t0:now(),
          x0:f.x+58*foeDir,y0:f.y,a0:foeDir>0?0:Math.PI};
        const prev=rec.prevMountedId;rec.prevMountedId=null;
        if(prev&&prev!==p.weaponId&&w.st&&rec.headX!=null)
          rec.dropFlight={weaponId:prev,t0:now(),
            x0:w.st.pos.x,y0:w.st.pos.y,a0:rec.headX,
            x1:w.st.pos.x+Math.cos(rec.headX+0.65*Math.PI)*92,
            y1:w.st.pos.y+Math.sin(rec.headX+0.65*Math.PI)*92+30};
        break;
      }
      case 'shuri:rack-release':
      case 'shuri:rack-shot':
      case 'shuri:rack-cycle-ended':
      case 'shuri:mount-pending':
      case 'shuri:mount-canceled':
      case 'shuri:rack-reload':
      case 'shuri:rack-starved':
      case 'shuri:recovery-start':
      case 'shuri:recovery-end':
      case 'shuri:a1-place':
      case 'shuri:a1-recoil':
      case 'shuri:bomb-armed':
      case 'shuri:recycle-award':
        // Gold visual tasks / continuous sync already own these beats
        // (rack head + gun follow the adapter head spring; recovery form
        // follows native state in syncNative). Replay is not dispatched
        // twice; native events remain the verification clock.
        break;
    }
  }
  const off=AIL.bus.on('*',consume);
  // Gold's hair chain, head lean/tilt and eye glance are driven by her
  // velocity and its per-substep delta. The native fighter's measured
  // velocity must be fed BEFORE stepping, or those springs read ~zero
  // speed and the rig looks dead next to the Gold HTML. Position is also
  // presented pre-step so satellite-machine anchor targets track the
  // current frame; syncNative after stepping restores the exact native
  // point for rendering (Gold would drift/clamp inside its lab arena).
  function feedMotion(rec){
    const {w,f}=rec,t=now();
    const dt=t-rec.motionT;
    if(dt>0.0005){
      let vx=(f.x-rec.motionX)/dt,vy=(f.y-rec.motionY)/dt;
      if(Math.hypot(vx,vy)>2400){vx=0;vy=0;} // spawn/teleport: no phantom impulse
      // Light smoothing keeps stepped native movement from buzzing.
      rec.velX=rec.velX*0.35+vx*0.65;
      rec.velY=rec.velY*0.35+vy*0.65;
      rec.motionX=f.x;rec.motionY=f.y;rec.motionT=t;
    }
    w.shuri.vel.x=rec.velX;w.shuri.vel.y=rec.velY;
    w.shuri.pos.x=f.x;w.shuri.pos.y=f.y;
    // Face aim life (squint / glance / tilt) from the real native gun,
    // without ever setting shuri.gun: Gold would draw its own gun and
    // double the native one already painted by Arsenal presentation.
    const holder=global.APEX_ARSENAL?.weaponApi?.getHolder?.(f);
    const foe=(global.fighters||[]).find(b=>b&&b!==f&&b.hp>0);
    w.shuri.aimOn=!!holder&&!!foe;
    w.shuri.aimAt=foe?{x:foe.x,y:foe.y}:null;
    // Satellite adherence: while she moves fast, grip/tool/collector
    // hold tighter. Gold derives damping as 2*z*sqrt(k) with z untouched,
    // so scaling k0 raises responsiveness at the SAME damping ratio —
    // firmer tracking, never a rigid lock. At rest k0 returns to the
    // authored values and the original loose float is fully preserved.
    if(!rec.baseK)rec.baseK={grip:w.grip.k0,tool:w.tool.k0,col:w.col.k0};
    const u=Math.min(1,Math.hypot(rec.velX,rec.velY)/340);
    const firm=1+2.1*u*u*(3-2*u);
    w.grip.k0=rec.baseK.grip*firm;
    w.tool.k0=rec.baseK.tool*firm;
    w.col.k0=rec.baseK.col*firm;
  }
  function advance(rec){
    const t=now(),d=Math.max(0,Math.min(.06,t-rec.last));rec.last=t;
    feedMotion(rec);
    let remaining=d,iterations=0;
    while(remaining>=Gold.DT/2 && iterations++<10){
      const h=Math.min(Gold.DT,remaining);
      // Gold Lab's isolated demo automatically detonates an idle bomb
      // at 5s. Live APEX is authoritative on its 5s lifetime (after arm).
      // Keep original visual ticking until a native trigger/expiry arrives.
      if(rec.w.bomb?.st==='armed')
        rec.w.bomb.t=Math.min(rec.w.bomb.t,5-2*Gold.DT);
      Gold.step(rec.w,h);
      remaining-=h;
    }
    syncNative(rec);
    // Original visual-only simulator may generate fake gunfire or dummy/HP
    // pump while updating mechanical springs. Filter those audition cues:
    // true Arsenal SFX and realized native heal events own playback instead.
    const queued=rec.w.sfx.filter(e=>!/^shot[1-5]$/.test(e.name)
      && !['empty','rail_charge','heal_start','pump','heal_end','stun_confirm'].includes(e.name));
    if(rec.stunConfirmPending){
      queued.push({name:'stun_confirm',t:rec.w.t,
        x:rec.w.bomb?.pos.x??rec.f.x,y:rec.w.bomb?.pos.y??rec.f.y});
      rec.stunConfirmPending=false;
    }
    if(rec.healStartPending){queued.push({name:'heal_start',t:rec.w.t,x:rec.f.x,y:rec.f.y});rec.healStartPending=false;}
    if(rec.pumpPending){queued.push({name:'pump',t:rec.w.t,x:rec.f.x,y:rec.f.y});rec.pumpPending=false;}
    if(rec.healing && t>(rec.healUntil||0)){
      rec.healing=false;queued.push({name:'heal_end',t:rec.w.t,x:rec.f.x,y:rec.f.y});
    }
    rec.w.sfx.length=0;
    if(queued.length&&Gold.audioReady())Gold.playBatch(queued,1,rec.f.x);
  }
  const oldDraw=global.Fighter?.prototype?.draw;
  if(!oldDraw)throw Error('SHURI_GOLD_REQUIRES_NATIVE_FIGHTER_DRAW');
  // The authored bomb.webp canvas is 123x122 but the bomb body itself is
  // centred at sprite (-25.5,+27.5) px from the canvas centre (measured
  // from the sprite alpha — debris of another strip shares the canvas).
  // Gold centres the CANVAS on bomb.pos, so in product the bomb floated
  // ~(-10,+11) world px off its gameplay point and range rim. Compensate
  // around rendering only: shift pos by the rotated sprite offset,
  // render, restore. Gold state and task math never see the shift.
  const BOMB_SPRITE_OFFSET={x:-25.5,y:27.5};
  function renderGold(ctx,w,opts){
    const b=w.bomb;
    if(!b?.pos){Gold.renderNativeLayer(ctx,w,sprites,opts);return;}
    const imgW=sprites?.bomb?.width||123;
    // Mirror drawBomb's scale: K.bomb*2*(1+0.14*drop) with K.bomb=25/RIG.bomb.w.
    const sc=(25/imgW)*2*(1+0.14*(b.drop?.x||0));
    const ox=BOMB_SPRITE_OFFSET.x*sc,oy=BOMB_SPRITE_OFFSET.y*sc;
    const c=Math.cos(b.rot?.x||0),s=Math.sin(b.rot?.x||0);
    const px=b.pos.x,py=b.pos.y;
    b.pos.x=px-(ox*c-oy*s);b.pos.y=py-(ox*s+oy*c);
    try{Gold.renderNativeLayer(ctx,w,sprites,opts);}
    finally{b.pos.x=px;b.pos.y=py;}
  }
  const easeOutCubic=t=>1-Math.pow(1-t,3); // Gold's authored `eo`
  const wrapDelta=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function flyWeaponSprite(ctx,rec,weaponId,x,y,angle,scale,alpha){
    const AV=global.APEX_ARSENAL_AV;
    if(!AV?.drawWeaponSprite||!weaponId)return false;
    const cos=global.APEX_COSMETICS;
    const side=cos?.sideOf?.(rec.f,global);
    return AV.drawWeaponSprite(ctx,weaponId,x,y,{
      angle,keepUpright:true,mode:'equipped',
      cosmetic:side?cos.capture?.(side,'weapon',weaponId):null,
      targetLongSide:(global.APEX_ARSENAL_CONFIG?.FIREARM_LONG_SIDE?.[weaponId]||120)*scale,
      alpha:alpha==null?1:alpha,
    });
  }
  // The native mounted gun, bound to the Gold rack head's own frame: same
  // pivot (hub center), same angle (the adapter head spring). Arsenals
  // pose/recoil framing still owns recoil kickback — we only retarget which
  // angle/pivot the pose is solved in, centering it on the hub exactly like
  // Gold's authored rack gun (translated by -kick only). Transfer flights
  // mirror the authored gunfly/gundrop timing with the native skinned
  // sprite. In recovery the gun sinks with the med morph — no gun drawn.
  function drawRackGun(ctx,rec){
    const f=rec.f,w=rec.w;
    const s=f.__hrCombatant?.store?.__shuri?.structure;
    if(!s||s.phase!=='ACTIVE'||s.recovery||!s.emitter||!w.st)return;
    const hub=w.st.pos,head=rec.headX??w.st.headAng.x,tNow=now();
    const holder=global.APEX_ARSENAL?.weaponApi?.getHolder(s.emitter);
    let docking=false;
    const mf=rec.mountFlight;
    if(mf){
      const e=(tNow-mf.t0)/0.55;
      if(e<1){
        docking=true;
        const ee=easeOutCubic(Math.max(0,e));
        flyWeaponSprite(ctx,rec,mf.weaponId,
          mf.x0+(hub.x-mf.x0)*ee,
          mf.y0+(hub.y-mf.y0)*ee-12*Math.sin(Math.PI*ee),
          mf.a0+wrapDelta(head-mf.a0)*ee,
          1+0.25*Math.sin(Math.PI*ee),1);
      }else rec.mountFlight=null;
    }
    if(!docking&&holder){
      const AV=global.APEX_ARSENAL_AV;
      if(AV?.drawEquippedWeapon){
        const meta=holder.meta||{},pose=meta.pose;
        const savedAim=meta.aimAngle,savedLX=pose?pose.localX:undefined;
        try{
          const cat=holder.def?.category;
          const base=(cat==='melee'?72:cat==='defense'?82:78)/100*(s.emitter.r||75);
          meta.aimAngle=head;
          if(pose)pose.localX=-base; // hub pivot; recoil stays in the pose
          AV.drawEquippedWeapon(ctx,s.emitter,holder);
        }finally{
          meta.aimAngle=savedAim;
          if(pose)pose.localX=savedLX;
        }
      }
    }
    const df=rec.dropFlight;
    if(df){
      const age=tNow-df.t0;
      if(age<1.7){
        const ee=easeOutCubic(Math.min(1,age/0.6));
        flyWeaponSprite(ctx,rec,df.weaponId,
          df.x0+(df.x1-df.x0)*ee,df.y0+(df.y1-df.y0)*ee,
          df.a0+7*ee,1,age>0.6?Math.max(0,1-(age-0.6)/1.1):1);
      }else rec.dropFlight=null;
    }
  }
  if(!global.Fighter.prototype.__shuriGoldDraw){
    global.Fighter.prototype.__shuriGoldDraw=true;
    global.Fighter.prototype.draw=function shuriGoldDraw(ctx){
      if(!isShuri(this)||this.hp<=0)return oldDraw.call(this,ctx);
      const rec=ensure(this);
      if(!sprites)return; // Never replace unfinished Gold with a generic blob.
      ctx.save();
      try{
        advance(rec);
        renderGold(ctx,rec.w,{
          vfx:true,hud:false,show:FX_SHOW,
        });
        drawNativeRangeRims(ctx,rec);
        // While held, display the REAL native gun. After completion, Gold's
        // tier-gun enters the collector; never show both representations.
        const nativeHolder=global.APEX_ARSENAL?.weaponApi?.getHolder?.(this);
        if(nativeHolder && !rec.w.snap)
          global.APEX_ARSENAL_AV?.drawEquippedWeapon?.(ctx,this,nativeHolder);
        // The mounted gun is rigidly bound to the rack head's frame
        // (hub pivot + head-spring angle) with authored transfer flights.
        drawRackGun(ctx,rec);
      }finally{ctx.restore();}
    };
  }
  // Persistent machine wreckage and delayed Gold VFX are world visuals,
  // not children of a living Fighter's draw call. A fallen SHURI must not
  // silently make a collapsing building/EMP residue disappear.
  function drawPersistentWorld(ctx){
    if(!sprites)return;
    for(const [fighter,rec] of live){
      if(fighter.hp>0)continue; // alive owner paints the Gold rig once
      const world=rec.w;
      if(!world.st && !world.bomb && !world.fx?.length)continue;
      advance(rec);
      ctx.save();
      try{
        renderGold(ctx,world,{
          vfx:true,hud:false,
          show:{core:false,grip:false,tool:false,collector:false,
            structure:true,bomb:true,dummy:false,fixtures:false},
        });
      }finally{ctx.restore();}
    }
  }
  const av=global.APEX_ARSENAL_AV;
  if(!av?.registerWorldVisualRenderer)
    throw Error('SHURI_GOLD_REQUIRES_SHARED_WORLD_VISUAL_REGISTRY');
  const offWorld=av.registerWorldVisualRenderer('shuri-gold-persistent',drawPersistentWorld);
  const offMatch=AIL.bus.on('ReworkMatchTeardown',()=>{
    for(const rec of live.values())rec.w.sfx.length=0;
    live.clear();
    Gold.clearAudio();
  });
  global.APEX_SHURI_GOLD_PRESENTATION=Object.freeze({
    ready:()=>!!sprites && !spriteError,
    whenReady:()=>loadPromise,
    source:Gold.source,
    hasSprites:()=>!!sprites,
    status:()=>({ready:!!sprites,error:spriteError,instances:live.size,
      originalGold:true,nativeGameplay:true}),
    primeSound,
    clear:()=>{for(const r of live.values())r.w.sfx.length=0;live.clear();Gold.clearAudio();},
    dispose:()=>{off();offWorld();offMatch();live.clear();Gold.clearAudio();},
  });
  global.apexShuriGoldPresentationRuntime='ready';
})(typeof window!=='undefined'?window:globalThis);
