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
    rec={f,w,last:t,audioStarted:false,healLast:0,healing:false,
      stunConfirmPending:false,healedPending:0};
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
      if(st.structure?.solid && w.st){
        w.st.hp=Math.max(0,st.structure.solid.hp);
        // Gold's authored 5s build motion remains independent; never let
        // a placeholder machine damage or spawn alter native structure HP.
        w.st.pos.x=st.structure.solid.x;w.st.pos.y=st.structure.solid.y;
        // Native Gun Rack uses genuine Arsenal holders. The Gold mock rack
        // MUST NEVER autonomously aim/fire, generate damage or audition shots.
        w.st.mounted=null;w.st.incoming=false;
        const holder=global.APEX_ARSENAL?.weaponApi?.getHolder?.(st.structure.emitter);
        if(holder && Number.isFinite(holder.meta?.aimAngle))
          w.st.headAng.x=holder.meta.aimAngle;
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
      case 'shuri:build-mode-changed':
        // Build source remains Gold-owned. The target mode becomes visible
        // only when real build is complete; no synthetic second assembly.
        rec.pendingMode=p.mode;break;
      case 'shuri:build-complete':
        if(w.st){
          w.st.mode=rec.pendingMode==='MED'?'med':(p.mode==='MED'?'med':'rack');
          rec.pendingMode=null;
        }
        break;
      case 'shuri:morph-start':
        // A1's ORIGINAL Gold 8 doA1 task performs its own 0.72s signal
        // and morphTo with authored motion + sound. Mirroring native A1
        // morph here would drive the same machine twice in one frame.
        // Other native transition sources may still request one morph.
        if(p.source!=='a1') Gold.morphTo(w,p.to==='MED'?'med':'rack');
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
      case 'shuri:rack-equip':
      case 'shuri:rack-release':
      case 'shuri:rack-shot':
      case 'shuri:a1-place':
      case 'shuri:a1-recoil':
      case 'shuri:a1-command':
      case 'shuri:bomb-armed':
      case 'shuri:recycle-award':
        // Gold visual tasks already own these exact score beats. Replay is
        // not dispatched twice; native events remain the verification clock.
        break;
    }
  }
  const off=AIL.bus.on('*',consume);
  function advance(rec){
    const t=now(),d=Math.max(0,Math.min(.06,t-rec.last));rec.last=t;
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
  if(!global.Fighter.prototype.__shuriGoldDraw){
    global.Fighter.prototype.__shuriGoldDraw=true;
    global.Fighter.prototype.draw=function shuriGoldDraw(ctx){
      if(!isShuri(this)||this.hp<=0)return oldDraw.call(this,ctx);
      const rec=ensure(this);
      if(!sprites)return; // Never replace unfinished Gold with a generic blob.
      ctx.save();
      try{
        advance(rec);
        Gold.renderNativeLayer(ctx,rec.w,sprites,{
          vfx:true,hud:false,show:FX_SHOW,
        });
        const s=this.__hrCombatant?.store?.__shuri?.structure;
        if(s?.phase==='ACTIVE'&&s.mode==='RACK'&&s.emitter){
          const h=global.APEX_ARSENAL?.weaponApi?.getHolder(s.emitter);
          if(h)global.APEX_ARSENAL_AV?.drawEquippedWeapon?.(ctx,s.emitter,h);
        }
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
        Gold.renderNativeLayer(ctx,world,sprites,{
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
