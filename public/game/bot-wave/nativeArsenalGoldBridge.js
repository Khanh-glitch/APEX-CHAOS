/* BOT WAVE R3 — Free Battle Arsenal native executor bridge.
 * The Wave Director may choose an ID or a robot position; it MUST NOT
 * reimplement a bullet, firearm cadence, shotgun pellet, V43 impact, aim
 * release, crit, native AV cue, or weapon pose. All are owned by the
 * production Arsenal weapon + presentation runtimes.
 *
 * Gold remains authority for BOXE actor, gloves, skills, arena, VFX and HP.
 * This adapter only projects Gold robot/player coordinates into Arsenal.
 */
(function(root){
'use strict';
const ORIGIN=1000;
function installGlobals(engine){
 const aq={state:{visuals:[],detachedWeapons:[],resultLedger:null},events:[],
  log(kind,msg){if(this.events.length>180)this.events.shift();this.events.push([kind,msg]);},
  combatRng:Math.random};
 root.APEX_ARSENAL=aq;
 root.GAME_SIZE=2000;
 root.TAU=Math.PI*2;
 root.clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 root.norm=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}};
 root.dist=(x,y,a,b)=>Math.hypot(x-a,y-b);
 root.distPointToSegment=(x,y,x1,y1,x2,y2)=>{
  const dx=x2-x1,dy=y2-y1;
  const u=root.clamp(((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(x-(x1+u*dx),y-(y1+u*dy));
 };
 root.emitParticles=(x,y,color,count,speed,size,life)=>{
  // Only the existing Gold floor material engine emits environment debris.
  // All projectile and muzzle visual identities stay in Arsenal presentation.
  engine.material?.dust?.(x-ORIGIN,y-ORIGIN+12,Math.min(8,count||3),Math.min(80,speed||80),Math.min(.6,life||.2));
 };
 root.spawnShockwave=(x,y,color,r)=>engine.fx?.flash?.(x-ORIGIN,y-ORIGIN,Math.min(150,r||70),color,.16);
 root.triggerFlash=()=>{};
 root.playFighterSound=()=>{};
 root.cameraShake=0;
 root.hitStop=0;
 Object.defineProperty(root,'audioCtx',{configurable:true,get:()=>engine.actx||null});
 root.projectiles=[];
 root.fighters=[];
 return aq;
}
function mirrorGoldActor(actor,engine,{player=false}={}){
 const proxy={id:actor.id,name:player?'BOXE':'ROBOT',color:player?'#ffac42':'#ff7043',
  radius:actor.r||30,dir:{x:1,y:0},data:{},withdrawn:false};
 for(const key of ['x','y']){
  Object.defineProperty(proxy,key,{configurable:true,enumerable:true,
   get:()=>actor[key]+ORIGIN,set:v=>{actor[key]=v-ORIGIN;}});
 }
 Object.defineProperty(proxy,'hp',{configurable:true,enumerable:true,
  get:()=>Math.max(0,actor.hp),set:v=>{actor.hp=v;}});
 proxy.takeDamage=function(amount,source,reason){
  if(player)engine.damagePlayer(amount,Math.atan2((source?.y||ORIGIN)-proxy.y,(source?.x||ORIGIN)-proxy.x));
  else engine.damageEnemy(actor,amount,{});
 };
 proxy.applyStatus=function(kind,time,arg){
  if(kind==='push'&&arg&&Number.isFinite(arg.strength)){
   const dir=arg.x!=null?arg:{x:1,y:0};
   actor.vx=(actor.vx||0)+dir.x*arg.strength*.18;
   actor.vy=(actor.vy||0)+dir.y*arg.strength*.18;
  }
  if(kind==='stun')actor.waveStunT=Math.max(actor.waveStunT||0,time||0);
 };
 return proxy;
}
function build({engine,config,campaign,cue,rand}){
 if(!engine||!config||!campaign)throw Error('NATIVE_WAVE_BOOT_REQUIRED');
 const aq=installGlobals(engine);
 const combatants=new WeakMap(),queued=new Map();
 const player=mirrorGoldActor(engine.player,engine,{player:true});
 root.fighters.push(player);
 const records=campaign.indexNative(config).records;
 const ammo=Object.freeze(Object.fromEntries(records.map(r=>{
  const s=r.spec,f=r.family;
  return[r.id,f==='SHIELD'||f==='MELEE'||f==='GRENADE'||f==='SPECIAL'||f==='PRECISION'?1:
   f==='SHOTGUN'?1:Math.max(1,s.shots||1)];
 })));
 function create(e){
  const proxy=mirrorGoldActor(e,engine);
  combatants.set(e,proxy);queued.delete(e);
  return proxy;
 }
 const native={weapons:null,api:null,av:null,ready:false};
 function connect(){
  const api=aq.weaponApi;
  const weapons=root.APEX_ARSENAL_WEAPONS;
  const av=root.APEX_ARSENAL_AV;
  const missing=campaign.indexNative(config).allWeaponIds.filter(id=>!weapons?.[id]);
  if(!api||!weapons||!av||missing.length)
   throw Error('NATIVE_WAVE_MISSING_EXECUTORS api='+!!api+
    ' total='+Object.keys(weapons||{}).length+' av='+!!av+
    ' missing='+missing.join(','));
  native.api=api;native.weapons=weapons;native.av=av;native.ready=true;
  root.avCue=(event,detail={})=>av.cue(event,detail);
  av.preload({audio:false});
 }
 function activate(e){
  if(!native.ready)throw Error('NATIVE_WAVE_NOT_READY');
  const proxy=combatants.get(e)||create(e);
  const id=e.waveGunId;
  if(!native.weapons[id])throw Error('NATIVE_WAVE_UNREGISTERED_'+id);
  // True Arsenal equip -> holder-def -> projectiles. No fake mode shots.
  if(!native.api.getHolder(proxy)){
   if(!native.api.equip(proxy,id))throw Error('NATIVE_WAVE_EQUIP_REJECTED_'+id);
  }
  return proxy;
 }
 const catalog=Object.freeze(Object.fromEntries(records.map(r=>[
  r.id,Object.freeze({
   id:r.id,family:r.family,role:r.role,native:r.spec,
   // display only; combat state lives in the actual Arsenal holder.
   mag:ammo[r.id],color:({PRECISION:'#ff7095',SPECIAL:'#d1a5ff',SHIELD:'#83d6e6',MELEE:'#f0c17b'})[r.family]||'#ffd99c'
  })
 ])));
 function fire(e,dt){
  if(!native.ready||!e||e.dead)return;
  e.waveStunT=Math.max(0,(e.waveStunT||0)-dt);
  if(e.waveStunT>0)return;
  const proxy=combatants.get(e)||create(e),id=e.waveGunId;
  if(e.waveReloadT>0){
   e.waveReloadT=Math.max(0,e.waveReloadT-dt);return;
  }
  if(queued.has(e))return;
  if(!native.api.getHolder(proxy))activate(e);
  const holder=native.api.getHolder(proxy);
  if(!holder)throw Error('NATIVE_WAVE_HOLDER_MISSING_'+id);
  const oldCount=root.projectiles.length,priorShots=holder.shotsFired||0;
  // Native update uses actual READY/WINDUP/FOLLOW_THROUGH timing, native
  // makeGun/makePrecisionGun/makeBlastGun and full V43 emitters.
  native.api.updateHolder(proxy,dt);
  const live=native.api.getHolder(proxy);
  const consumed=!live||live.consumed;
  const firedDelta=(live?.shotsFired||holder.shotsFired||0)-priorShots;
  const added=root.projectiles.length-oldCount;
  if(firedDelta>0||added>0)e.waveAmmo=Math.max(0,ammo[id]-Math.max(0,live?.shotsFired||holder.shotsFired||0));
  if(consumed){
   // Free Battle discards consumed guns; BOT WAVE retains its carrier and
   // gives it a mode-only rearm pause, without overriding any shot cadence.
   queued.set(e,true);
   e.waveAmmo=0;
   e.waveReloadT=(r=>r.family==='PRECISION'?1.35:r.family==='SPECIAL'?1.35:
    r.family==='SHOTGUN'||r.family==='AUTOSHOT'?1.2:.85)(catalog[id]);
   queued.delete(e);
  }
 }
 function update(dt){
  if(!native.ready)return;
  // Native sweep/physics handles every actual aq_bullet, grenade, thrown
  // melee and V4.3 carrier. It never creates Gold 'orb' projectiles.
  // In Free Battle the outer engine decrements global projectile lifetimes
  // BEFORE the native Arsenal collision driver runs. Gold's Engine has its
  // OWN projectile array, so this single adapter must perform that SAME
  // pre-step exactly once for all aq_* carriers (including V43 burn/mine).
  for(const projectile of root.projectiles){
   if(projectile?.aq&&Number.isFinite(projectile.life))projectile.life-=dt;
  }
  native.api.updateArsenalProjectiles(dt,'all');
  // The native driver may set life=0 on impact; remove its spent bullets.
  for(let i=root.projectiles.length-1;i>=0;i--){
   const projectile=root.projectiles[i];
   if(projectile?.aq&&projectile.life<=0)root.projectiles.splice(i,1);
  }
  native.api.tickVisuals(dt);
  native.av.tick(dt);
 }
 function draw(ctx){
  if(!native.ready)return;
  ctx.save();ctx.translate(-ORIGIN,-ORIGIN);
  native.api.drawArsenalProjectiles(ctx);
  native.api.drawArsenalVisuals(ctx);
  native.av.draw(ctx);
  ctx.restore();
 }
 function drawEquipped(ctx,e){
  if(!native.ready)return false;
  const proxy=combatants.get(e),holder=proxy&&native.api.getHolder(proxy);
  if(!proxy||!holder)return false;
  // This is EXACTLY the same equipped-weapon pose/recoil, muzzle orientation
  // and asset provider Free Battle calls. The -1000 offset is camera only.
  ctx.save();ctx.translate(-ORIGIN,-ORIGIN);
  const rendered=native.av.drawEquippedWeapon(ctx,proxy,holder);
  ctx.restore();
  return rendered;
 }
 let audioWarmed=false;
 function ensureAudio(){
  // Native shots use the ONE Gold-engine AudioContext and the trimmed,
  // polyphony-limited sound recipes from ArsenalPresentationRuntime.
  engine.initAudio();
  if(audioWarmed||!engine.actx)return;
  audioWarmed=true;
  native.av.warmAudio().catch(e=>console.error('[BOT WAVE] native AV',e));
 }
 function protect(e,amount){
  // Gold BOXE punches live in Gold's own attack-contact authority (they are
  // not Arsenal aq_bullet). Bridge ONLY the native Tower Shield mitigation,
  // reading the exact Free Battle GUARD phase and CFG damageTakenMult.
  // Native Arsenal bullets already pass through aqDamage and must NOT be
  // reduced twice. There is no invented BOT WAVE shield multiplier.
  const p=combatants.get(e),holder=p&&native.api?.getHolder(p);
  if(holder?.weaponId==='TOWER_SHIELD'&&holder.phase==='GUARD'){
   const factor=config.WEAPONS.TOWER_SHIELD.damageTakenMult;
   if(!Number.isFinite(factor)||factor<0||factor>1)
    throw Error('NATIVE_TOWER_SHIELD_INVALID_FACTOR');
   native.av?.cue?.('tower_block',{weapon:'TOWER_SHIELD',
    x:e.x+ORIGIN,y:e.y+ORIGIN});
   return amount*factor;
  }
  return amount;
 }
 function movementSlow(){return 1;}
 function reset(){
  root.projectiles.length=0;
  aq.state.visuals.length=0;
  aq.state.detachedWeapons.length=0;
  native.av?.clear();
 }
 function liveHolder(e){return combatants.has(e)?native.api?.getHolder(combatants.get(e)):null;}
 return Object.freeze({weapons:catalog,index:campaign.indexNative(config),
  fire,update,draw,drawEquipped,ensureAudio,protect,movementSlow,reset,activate,connect,liveHolder,
  snapshot:()=>({projectiles:root.projectiles.length,backend:'FREE_BATTLE_NATIVE',native41:Object.keys(native.weapons||{}).length}),
  getNative:()=>native});
}
root.APEX_BOT_WAVE_NATIVE_BRIDGE=Object.freeze({createArmory:build});
})(typeof window!=='undefined'?window:globalThis);
