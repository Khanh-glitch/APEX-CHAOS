/* BOT WAVE CP3 — real 41-weapon Arsenal adapter for owner Gold combat.
 * Separate from BOXE's immutable Gold animation/VFX engine. No gun damage,
 * projectile speed or per-shot cadence is scaled with wave or boss level.
 */
(function(root){
'use strict';
function createArmory({engine,config,campaign,cue,rand}){
 const native=catalog=>catalog.records;
 const index=campaign.indexNative(config);
 const specials=[];
 // Owner-accepted native Arsenal sonic language: melee swings and shield
 // starts do NOT sound like the Pistol. Polyphony stays bounded per identity.
 const nativeFireSounds=Object.freeze({
  SABRE:'/assets/arsenal/av/sfx/c-final/SABRE/sabre_motion.mp3',
  BATTLE_AXE:'/assets/arsenal/av/sfx/c-final/BATTLE_AXE/axe_motion.mp3',
  DAGGER:'/assets/arsenal/av/sfx/c-final/DAGGER/dagger_motion.mp3',
  SPEAR:'/assets/arsenal/av/sfx/c-final/SPEAR/spear_motion.mp3',
  SPIKED_CLUB:'/assets/arsenal/av/sfx/c-final/SPIKED_CLUB/club_swing.mp3',
  STORMBREAKER:'/assets/arsenal/av/sfx/scifi/forceField_001.ogg',
  SWIRL_SHIELD:'/assets/arsenal/av/sfx/c-final/SWIRL_SHIELD/swirl_shield_block.mp3',
  TOWER_SHIELD:'/assets/arsenal/av/sfx/c-final/TOWER_SHIELD/tower_shield_block.mp3',
  COMBAT_BOOMERANG:'/assets/arsenal/av/sfx/c-final/SABRE/sabre_motion.mp3',
  TACTICAL_CROSSBOW:'/assets/arsenal/av/sfx/c-final/SPEAR/spear_motion.mp3',
 });
 const fireFamily=Object.freeze({
  RPG_7:'SNIPER',PLASMA_SPLITTER:'SNIPER',
  FLAMETHROWER:'SMG',STEEL_BALL_LAUNCHER:'SHOTGUN',
  SHRAPNEL_MINE_LAUNCHER:'SHOTGUN',
 });
 const soundPools=new Map(),lastSoundAt=new Map();
 function playNativeSound(id){
  const url=nativeFireSounds[id];
  if(!url)return false;
  if(engine?.opts?.sound===false||typeof Audio!=='function')return true;
  const last=lastSoundAt.get(id)??-99;
  if(engine.time-last<.10)return true;
  lastSoundAt.set(id,engine.time);
  let pool=soundPools.get(id);
  if(!pool){
   pool=Array.from({length:2},()=>{const a=new Audio(url);a.preload='auto';return a;});
   soundPools.set(id,pool);
  }
  const sample=pool.find(a=>a.paused||a.ended)||pool[0];
  try{sample.pause();sample.currentTime=0;sample.volume=.22;sample.play().catch(()=>{});}catch(_){}
  return true;
 }
 const palette={SEMI:'#ffd99c',AUTO:'#e5a47d',BURST:'#ecb87c',PRECISION:'#ff7095',SHOTGUN:'#ffb96c',
  AUTOSHOT:'#f9b46d',GRENADE:'#ff9d6c',MELEE:'#f0c17b',SHIELD:'#83d6e6',SPECIAL:'#d1a5ff'};
 const specialRange={flare:730,bolt:930,ball:720,boomerang:600,rocket:870,flame:320,plasma:780,mine:520};
 function recordToGun(r){
  const s=r.spec,f=r.family,kind=s.kind||'';
  const isFinal=s.finalDamage===true||r.id==='STORMBREAKER';
  const shot=s.damagePerShot??s.damagePerPellet??s.damage??s.maxDamage??s.direct??
   s.peak??s.coreDamage??s.tickDamage??s.outgoing??s.confirmedHitDamage??0;
  const speed=s.bulletSpeed??s.throwSpeed??s.speed??s.coreSpeed??0;
  const mag=f==='SHIELD'||f==='MELEE'?1:f==='SHOTGUN'?1:
   f==='GRENADE'||f==='SPECIAL'||f==='PRECISION'?1:Math.max(1,s.shots||1);
  return Object.freeze({id:r.id,family:f,kind,role:r.role,mag,
   interval:s.interval??s.aimTime??s.windup??(f==='SPECIAL'?1.25:f==='MELEE'?1.05:0.3),
   reload:f==='SHIELD'?Math.max(2,s.duration||3.2):
    f==='MELEE'?Math.max(.45,s.windup||.82):
    f==='PRECISION'?2.8:f==='SHOTGUN'?2.35:f==='GRENADE'?3.4:
    f==='SPECIAL'?Math.max(1.3,s.charge||s.windup||2):
    f==='BURST'?1.65:f==='AUTO'?1.8:1.4,
   rawDamage:shot,damageScale:isFinal?1/7:1,finalDamage:isFinal,
   speed,bulletLife:s.bulletLife??s.fuse??1,
   spread:s.spread??s.cone??.04,pellets:s.pellets||0,
   range:f==='SHIELD'?170:f==='MELEE'?(s.triggerRange||235):
    specialRange[kind]||(f==='SHOTGUN'||f==='AUTOSHOT'?370:
     f==='PRECISION'?1050:f==='GRENADE'?730:820),
   splash:s.blastRadius||0,color:palette[f]||'#fbd096',native:s});
 }
 const weapons=Object.freeze(Object.fromEntries(native(index).map(r=>[r.id,recordToGun(r)])));
 function rangeHit(e,range){const p=engine.player;return Math.hypot(p.x-e.x,p.y-e.y)<=range+(p.r||0);}
 function impact(x,y,r,color='#f5b96e'){engine.fx?.flash?.(x,y,Math.max(24,r),color,.14);
  engine.material?.dust?.(x,y+16,4,Math.max(35,r),.22);}
 function harm(amount,x,y,angle,range=0){
  const p=engine.player;
  const d=Math.hypot(p.x-x,p.y-y);
  if(d>range+p.r)return false;
  engine.damagePlayer(Math.max(0,amount)*(range?Math.max(.28,1-d/(range+p.r)):1),angle);
  return true;
 }
 function shot(e,g,a,{speed=g.speed,life=g.bulletLife,damage=g.rawDamage*7*g.damageScale}={}){
  engine.projs.push({kind:'orb',x:e.x+Math.cos(a)*36,y:e.y+Math.sin(a)*36,
   vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,angle:a,life,traveled:0,phase:'out',
   hitSet:new Set(),src:e,waveGunId:e.waveGunId,waveDamage:damage,waveColor:g.color,
   waveSplash:g.splash||0});
 }
 function launch(e,g,a,variant,{speed=g.speed,damage=g.rawDamage*7*g.damageScale,ttl=2.2}={}){
  specials.push({x:e.x+Math.cos(a)*42,y:e.y+Math.sin(a)*42,x0:e.x,y0:e.y,
   vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,angle:a,age:0,ttl,variant,
   owner:e,gunId:e.waveGunId,damage,radius:9+((variant==='rocket'||variant==='mine')?7:0),
   bounces:0,returned:false,split:false,hitLeg:0,armed:false});
 }
 function fire(e,dt){
  const g=weapons[e.waveGunId],p=engine.player;
  if(!g||e.dead)return;
  if(e.waveReloadT>0){e.waveReloadT-=dt;if(e.waveReloadT<=0){e.waveAmmo=g.mag;e.waveFireT=0}return}
  e.waveFireT-=dt;if(e.waveFireT>0)return;
  const dx=p.x-e.x,dy=p.y-e.y,dist=Math.hypot(dx,dy);
  if(dist>g.range+(p.r||0)){e.waveFireT=.16;return}
  if(e.waveAmmo<=0){e.waveReloadT=g.reload;return}
  const a=Math.atan2(dy,dx)+(rand()-.5)*g.spread*2,s=g.native;
  e.waveAmmo--;e.waveFireT=g.interval;
  if(!playNativeSound(e.waveGunId))cue(fireFamily[e.waveGunId]||e.waveGunId,'fire');
  if(g.family==='SHIELD'){
   e.waveShieldUntil=engine.time+(s.duration||2.8);
   e.waveShieldId=e.waveGunId;impact(e.x,e.y,g.range,g.color);
   if(dist<175)harm(21,e.x,e.y,a,115); // shield bash, not a fictitious gun shot
  }else if(g.family==='MELEE'){
   if(e.waveGunId==='STORMBREAKER')launch(e,g,a,'stormbreaker',{speed:config.STORMBREAKER?.throwSpeed||1350,damage:s.confirmedHitDamage||446,ttl:2.2});
   else {
    const reach=s.reach||s.triggerRange||260;
    const amount=config.meleeDamage?.(e.waveGunId)??s.damage??0;
    harm(amount*7,e.x,e.y,a,Math.min(reach,365));
    engine.fx?.streakCone?.(e.x,e.y-25,a,6,g.color,.14,reach,55);
    impact(e.x+Math.cos(a)*Math.min(reach,145),e.y+Math.sin(a)*Math.min(reach,145),45,g.color);
   }
  }else if(g.family==='SPECIAL'){
   switch(g.kind){
    case 'flame':{
     for(let tick=0;tick<(s.ticks||5);tick++)if(dist<=s.range)harm(s.tickDamage||18,e.x,e.y,a,s.range);
     if(dist<=s.range)ignite(s.burnTicks||5,s.burnDamage||13,s.burnInterval||.25);
     engine.fire?.column?.(e.x+Math.cos(a)*100,e.y+Math.sin(a)*100,90,150,.35,.3);
     break;
    }
    case 'flare':launch(e,g,a,'flare',{speed:s.speed,damage:s.direct,ttl:3});break;
    case 'bolt':launch(e,g,a,'bolt',{speed:s.speed,damage:s.direct,ttl:2.3});break;
    case 'ball':launch(e,g,a,'ball',{speed:s.speed,damage:s.peak,ttl:2.6});break;
    case 'boomerang':launch(e,g,a,'boomerang',{speed:s.speed,damage:s.outgoing,ttl:s.maxFlightSeconds});break;
    case 'rocket':launch(e,g,a,'rocket',{speed:s.speed,damage:s.peak,ttl:2.6});break;
    case 'plasma':launch(e,g,a,'plasma',{speed:s.coreSpeed,damage:s.coreDamage,ttl:2.8});break;
    case 'mine':launch(e,g,a,'mine',{speed:s.speed,damage:s.peak,ttl:4});break;
    default:throw Error('UNIMPLEMENTED_NATIVE_SPECIAL_'+e.waveGunId);
   }
  }else if(g.family==='GRENADE'){
   shot(e,g,a,{speed:s.throwSpeed,life:s.fuse,damage:s.maxDamage*7});
  }else if(g.family==='SHOTGUN'||g.family==='AUTOSHOT'){
   const pellets=g.pellets||1;
   for(let i=0;i<pellets;i++){
    const angle=a+((i+0.5)/pellets-.5)*g.spread;
    shot(e,g,angle,{damage:g.rawDamage*7});
   }
  }else shot(e,g,a);
  if(g.family!=='SHIELD'){engine.fx?.flash?.(e.x+Math.cos(a)*38,e.y-23+Math.sin(a)*38,26,g.color,.12);}
  if(e.waveAmmo<=0)e.waveReloadT=g.reload;
 }
 let burn=[],slowUntil=0;
 function ignite(count,damage,interval){burn.push({remaining:count,t:interval,interval,damage});}
 function aoe(proj,radius,peak,extra){
  impact(proj.x,proj.y,Math.min(160,radius),weapons[proj.gunId].color);
  harm(peak,proj.x,proj.y,proj.angle,radius);
  if(extra==='shrapnel'){
   for(let i=0;i<8;i++){const a=2*Math.PI*i/8;
    const fake={...proj,x:proj.x,y:proj.y,age:0,ttl:.62,variant:'fragment',angle:a,vx:Math.cos(a)*480,vy:Math.sin(a)*480,
    damage:config.V43_WEAPONS.SHRAPNEL_MINE_LAUNCHER.fragmentDamage,hitLeg:0};
    specials.push(fake);
   }
  }
 }
 function update(dt){
  if(!Number.isFinite(dt)||dt<=0)return;
  for(let i=burn.length-1;i>=0;i--){const b=burn[i];b.t-=dt;
   while(b.remaining>0&&b.t<=0){engine.damagePlayer(b.damage,0);b.remaining--;b.t+=b.interval;}
   if(b.remaining===0)burn.splice(i,1);
  }
  for(let i=specials.length-1;i>=0;i--){
   const q=specials[i],s=config.WEAPONS[q.gunId],id=q.variant;
   q.age+=dt;const p=engine.player;
   if(id==='mine'&&q.age>=.55){q.vx=q.vy=0;q.armed=q.age>=(s.armSeconds||.48)+.55;}
   if(id==='rocket'){const v=Math.min(s.maxSpeed||990,Math.hypot(q.vx,q.vy)+(s.acceleration||760)*dt);
    q.vx=Math.cos(q.angle)*v;q.vy=Math.sin(q.angle)*v;}
   if(id==='stormbreaker'&&q.age>.2){const target=Math.atan2(p.y-q.y,p.x-q.x),delta=Math.atan2(Math.sin(target-q.angle),Math.cos(target-q.angle));
    q.angle+=Math.max(-2.6*dt,Math.min(2.6*dt,delta));q.vx=Math.cos(q.angle)*1350;q.vy=Math.sin(q.angle)*1350;}
   if(id==='boomerang'&&q.age>1.05){q.returned=true;
    const a=Math.atan2(q.owner.y-q.y,q.owner.x-q.x);q.angle=a;
    q.vx=Math.cos(a)*(s.cruise||565);q.vy=Math.sin(a)*(s.cruise||565);
   }
   if(id==='ball'&&q.bounces<(s.maxBounces||1)&&(Math.abs(q.x)>805||Math.abs(q.y)>525)){
    if(Math.abs(q.x)>805)q.vx=-q.vx*(s.restitution||.86);
    if(Math.abs(q.y)>525)q.vy=-q.vy*(s.restitution||.86);
    q.bounces++;q.x=Math.max(-800,Math.min(800,q.x));q.y=Math.max(-520,Math.min(520,q.y));
   }
   if(id!=='mine'){q.x+=q.vx*dt;q.y+=q.vy*dt;}
   if(id==='plasma'&&!q.split&&q.age>=(s.splitAfter||.47)){
    q.split=true;
    for(const angleShift of s.spread||[-.22,0,.22]){
     const a=q.angle+angleShift;
     specials.push({...q,variant:'shard',x:q.x,y:q.y,vx:Math.cos(a)*s.shardSpeed,
      vy:Math.sin(a)*s.shardSpeed,damage:s.shardDamage,age:0,ttl:1.35,split:true,angle:a,hitLeg:0});
    }
   }
   let collided=Math.hypot(p.x-q.x,p.y-q.y)<(p.r||29)+q.radius;
   if(id==='mine')collided=q.armed&&Math.hypot(p.x-q.x,p.y-q.y)<(s.triggerRadius||135);
   if(id==='boomerang'&&(q.returned?q.hitLeg>=2:q.hitLeg>=1))collided=false;
   if(collided){
    if(id==='rocket')aoe(q,s.blastRadius||126,q.damage);
    else if(id==='ball')aoe(q,s.blastRadius||90,q.damage);
    else if(id==='mine')aoe(q,s.blastRadius||150,q.damage,'shrapnel');
    else{
     engine.damagePlayer(q.damage,q.angle);
     impact(q.x,q.y,55,weapons[q.gunId].color);
     if(id==='flare')ignite(s.burnTicks||4,s.burnDamage||14,s.burnInterval||.3);
     if(id==='bolt')slowUntil=engine.time+(s.slowSeconds||.3);
    }
    if(id==='boomerang'){q.hitLeg=q.returned?2:1;}else{specials.splice(i,1);continue}
   }
   const finished=q.age>q.ttl||(id==='boomerang'&&q.returned&&Math.hypot(q.x-q.owner.x,q.y-q.owner.y)<50);
   if(finished){
    if(id==='mine'&&q.armed)aoe(q,s.blastRadius||150,q.damage,'shrapnel');
    if(id==='rocket')aoe(q,s.blastRadius||126,q.damage);
    specials.splice(i,1);
   }
  }
 }
 function draw(ctx,assets){
  for(const q of specials){
   const art=assets?.[q.gunId],g=weapons[q.gunId];
   ctx.save();ctx.translate(q.x,q.y-24);ctx.rotate(q.angle);
   ctx.globalCompositeOperation='lighter';
   if(art?.complete&&art.naturalWidth){
    const width=q.variant==='stormbreaker'?110:q.variant==='boomerang'?75:q.variant==='mine'?38:35;
    ctx.globalAlpha=.9;ctx.drawImage(art,-width/2,-width/2,width,width*art.naturalHeight/art.naturalWidth);
   }else{
    ctx.fillStyle=g.color;ctx.beginPath();ctx.arc(0,0,q.radius,0,Math.PI*2);ctx.fill();
   }
   ctx.restore();
  }
 }
 function protect(e,amount){
  if(!e?.waveShieldUntil||e.waveShieldUntil<engine.time)return amount;
  const shield=config.WEAPONS[e.waveShieldId];
  const mult=shield.damageTakenMult??.65;
  impact(e.x,e.y,40,weapons[e.waveShieldId].color);
  return amount*mult;
 }
 function movementSlow(){return engine.time<slowUntil?(config.V43_WEAPONS.TACTICAL_CROSSBOW?.slowMult||.85):1;}
 function reset(){specials.length=0;burn=[];slowUntil=0;}
 return Object.freeze({weapons,index,fire,update,draw,protect,movementSlow,reset,
  snapshot:()=>({projectiles:specials.length,burn:burn.length,slow:engine.time<slowUntil})});
}
root.APEX_BOT_WAVE_ARMORY=Object.freeze({createArmory});
})(typeof window!=='undefined'?window:globalThis);
