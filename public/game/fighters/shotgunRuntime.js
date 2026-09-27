// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_SHOTGUN_CHAMPION(){
  if (window.__apexShotgunChampion) return;
  window.__apexShotgunChampion = true;

  const C = Object.freeze({
    PELLET_COUNT:7,
    PELLET_DAMAGE:10,
    CONE_DEGREES:60,
    RAY_WIDTH:10,
    MAX_SHELLS:6,
    SHOT_CYCLE:2,
    PUMP_READY_TIME:1.9,
    SHOT_AFTER_TIME:.2,
    SHOT_SPIN_START:.8,
    SHOT_SPIN_END:1.5,
    SHOT_READY_TIME:1.9,
    LONG_RELOAD_TIME:7,
    LONG_RELOAD_FILL_TIME:6,
    HARD_STUN_IMMUNITY:2.5,
    HOOK_MIN_RANGE:700,
    HOOK_MAX_RANGE:800,
    HOOK_MIN_GAP:700,
    HOOK_MAX_GAP:800,
    HOOK_PULL:85,
    HOOK_DASH:140,
    HOOK_FLIGHT_TIME:.12,
    HOOK_PULL_END:.68,
    HOOK_SHOT_TIME:.72,
    HOOK_LOCK_TIME:1,
    GUN_X:-7,
    GUN_Y:45,
    GUN_WIDTH:60,
    GUN_LENGTH:238,
    GUN_RECOIL:24,
    MUZZLE_SIDE_OFFSET:-4,
    COUNTER_RANGE:150,
    COUNTER_RECOIL:210,
    COUNTER_CONE_SCALE:.85,
    SHOT_LOCK_TIME:.18,
    GUN_SPIN_TIME:.7,
    COUNTER_SPIN_TIME:.34,
    HEAT_PER_SHOT:5,
    COOLING_TIME_AT_FULL_HEAT:15,
    BUTT_STRIKE_DAMAGE:5,
    BUTT_STRIKE_INTERVAL:1,
    BUTT_STRIKE_VISUAL_INTERVAL:.24,
    BUTT_STRIKE_VISUAL_TIME:.22,
    RELOAD_SPIN_TIME:1,
    DOUBLE_DELAY:.22,
    MULTIPLIER:Object.freeze({1:1,2:.8,3:.75,4:.7,5:.65,6:.6,7:.55})
  });
  const ROOT = '/assets/shotgun_v1/';
  const FILES = Object.freeze({
    body:ROOT+'body.webp', gunReady:ROOT+'gun_ready.webp', gunAfter:ROOT+'gun_after.webp',
    gunPump:ROOT+'gun_pump.webp', muzzle:ROOT+'muzzle.webp', pellet:ROOT+'pellet.webp',
    shell:ROOT+'shell.webp', hookRope:ROOT+'hook_rope.webp', hookHead:ROOT+'hook_head.webp',
    ring0:ROOT+'ring_0.webp', ring1:ROOT+'ring_1.webp', ring2:ROOT+'ring_2.webp',
    ring3:ROOT+'ring_3.webp', ring4:ROOT+'ring_4.webp', ring5:ROOT+'ring_5.webp',
    ring6:ROOT+'ring_6.webp', pickButton:ROOT+'pick_button.webp', picked:ROOT+'picked.webp'
  });
  const AUDIO_FILES = Object.freeze({
    fire:ROOT+'audio/fire_sfx.mp3',
    hook:ROOT+'audio/shoot_the_hook_the_pull.mp3',
    specialReload:ROOT+'audio/special_reloading_after_use_the_dash_skill.mp3',
    reloadBatch:ROOT+'audio/reloading_batch_7s.mp3',
    sevenHit:ROOT+'audio/7_pellet_hit_in_one_sfx.mp3',
    buildingHit:ROOT+'audio/pellet_hit_the_building_of_engineer.mp3',
    failedFire:ROOT+'audio/failed_fire.mp3',
    buttStroke:ROOT+'audio/butt-stroken.mp3'
  });
  const images = {};
  for (const [key,src] of Object.entries(FILES)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    images[key] = img;
  }
  const audio = {};
  const audioPools = {};
  for (const [key,src] of Object.entries(AUDIO_FILES)) {
    const base = new Audio(src);
    base.preload = 'auto';
    registerBattleMediaElement(base);
    audio[key] = base;
    audioPools[key] = [base];
  }
  const vfx = [];
  let batchSerial = 0;
  let damageTextContext = null;
  let counterDepth = 0;

  function state(f) { return f?.data?.shotgun || null; }
  function live(f) { return !!(f && f.hp > 0 && !f.data?.galaxyRemoved); }
  function sameTeam(a,b) {
    if (!a || !b) return false;
    const ta = a.teamId ?? a.owner?.teamId ?? a.owner?.id ?? a.id;
    const tb = b.teamId ?? b.owner?.teamId ?? b.owner?.id ?? b.id;
    return ta === tb;
  }
  function enemyChampion(owner) {
    return (fighters || []).find(f => live(f) && f !== owner && !sameTeam(f,owner)) ||
      (fighters || []).find(f => live(f) && f !== owner) || null;
  }
  function aimTarget(f,target) {
    if (!live(f) || !live(target)) return;
    const d=norm(target.x-f.x,target.y-f.y);
    const s=state(f);
    if (s && Number.isFinite(d.x) && Number.isFinite(d.y)) {
      s.visualDir={x:d.x,y:d.y};
      s.visualAngle=Math.atan2(d.y,d.x);
    }
  }
  function playShotgunSound(key,volume=.78,rate=1) {
    if (window.__apexStatsSilent) return;
    const base=audio[key];
    if (!base) return;
    try {
      ensureBattleAudioReady?.();
      const pool=audioPools[key] || (audioPools[key]=[base]);
      let item=pool.find(a=>a.paused || a.ended);
      if (!item && pool.length<10) {
        item=base.cloneNode(true);
        item.preload='auto';
        registerBattleMediaElement(item);
        pool.push(item);
      }
      if (!item) return;
      item.currentTime=0;
      item.volume=clamp(volume,0,1);
      item.playbackRate=clamp(rate,.55,1.8);
      const p=item.play();
      if (p?.catch) p.catch(()=>{});
    } catch (error) {}
  }
  function playGalaxyWallShared(volume=.68) {
    if (window.__apexStatsSilent) return;
    const buffer=window.APEX_GALAXY?.audio?.wall;
    if (!buffer || !audioCtx) return;
    try {
      if (audioCtx.state==='suspended') audioCtx.resume();
      const src=audioCtx.createBufferSource();
      const gain=audioCtx.createGain();
      src.buffer=buffer;
      gain.gain.value=volume;
      src.connect(gain); gain.connect(audioCtx.destination);
      if (window.__apexRecordingAudioDestination) gain.connect(window.__apexRecordingAudioDestination);
      src.start();
    } catch (error) {}
  }
  function seededUnit(s) {
    let x = (s.rngState || 0x9e3779b9) >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    s.rngState = x >>> 0;
    return (s.rngState >>> 0) / 4294967296;
  }
  function rageChance(f) {
    const hpPercent = clamp((f.hp / Math.max(1,f.maxHp)) * 100, 0, 100);
    return hpPercent > 50 ? 0 : clamp(.2 + ((50-hpPercent)/50)*.4, .2, .6);
  }
  function doubleChancePercent(f) {
    return Math.round(rageChance(f) * 100);
  }
  function startCooling(f) {
    const s = state(f);
    if (!s || s.coolingActive) return;
    const startHeat = clamp(s.heatPct || 0, 0, 100);
    const duration = C.COOLING_TIME_AT_FULL_HEAT * startHeat / 100;
    if (duration <= 0) {
      s.heatPct = 0;
      refill(f, 'cooling');
      return;
    }
    s.coolingStart = matchClock;
    s.coolingDuration = duration;
    s.coolingUntil = matchClock + duration;
    s.coolingStartHeat = startHeat;
    s.coolingActive = true;
    s.isLongReloading = true;
    s.longReloadStart = s.coolingUntil;
    s.longReloadRemaining = duration;
    s.isPumping = false;
    s.pendingSecond = null;
    s.hookCheckPending = false;
    s.hookSequence = null;
    s.jamStreak = 0;
    s.visualPhase = 'cooling';
    floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 96, 'COOLING', '#ffb27a'));
  }
  function updateCooling(f, target, dt) {
    const s = state(f);
    if (!s || !s.coolingActive) return false;
    const coolingStart = Number.isFinite(s.coolingStart) ? s.coolingStart : matchClock;
    const elapsed = matchClock - coolingStart;
    const startHeat = Number.isFinite(s.coolingStartHeat) ? s.coolingStartHeat : (s.heatPct || 0);
    const duration = Math.max(.001, s.coolingDuration || C.COOLING_TIME_AT_FULL_HEAT * startHeat / 100);
    s.heatPct = clamp(startHeat * (1 - elapsed / duration), 0, 100);
    s.longReloadRemaining = Math.max(0, s.coolingUntil - matchClock);
    s.visualPhase = 'cooling';
    if (target && live(target) && dist(f.x, f.y, target.x, target.y) <= f.radius + target.radius + 10) {
      const face = norm(target.x - f.x, target.y - f.y);
      s.visualDir = {x:face.x, y:face.y};
      s.visualAngle = Math.atan2(face.y, face.x);
      s.buttStrikeVisualTimer = (s.buttStrikeVisualTimer || 0) - dt;
      if (s.buttStrikeVisualTimer <= 0) {
        s.buttStrikeVisualTimer = C.BUTT_STRIKE_VISUAL_INTERVAL;
        s.buttStrikeAnimStart = matchClock;
        s.buttStrikeAnimUntil = matchClock + C.BUTT_STRIKE_VISUAL_TIME;
      }
      s.buttStrikePoseUntil = matchClock + 1;
      s.buttStrikeTick = Math.max(0, (s.buttStrikeTick || 0) - dt);
      if (s.buttStrikeTick <= 0) {
        s.buttStrikeTick = C.BUTT_STRIKE_INTERVAL;
        const n = norm(target.x - f.x, target.y - f.y);
        target.takeDamage(C.BUTT_STRIKE_DAMAGE, f, 'shotgun-butt-stroke');
        target.applyStatus('push', .14, {x:n.x, y:n.y, strength:430});
        playShotgunSound('buttStroke', .7);
      }
    } else {
      s.buttStrikeTick = 0;
      s.buttStrikeVisualTimer = 0;
    }
    if (matchClock >= s.coolingUntil) {
      s.coolingActive = false;
      s.coolingUntil = 0;
      s.coolingStart = 0;
      s.coolingStartHeat = 0;
      s.coolingDuration = 0;
      s.heatPct = 0;
      refill(f, 'cooling');
    }
    return true;
  }
  function shotgunFireGate(f) {
    const s = state(f);
    if (!s || s.coolingActive) return false;
    const jamChance = clamp((s.heatPct || 0) / 100, 0, .98);
    if (jamChance > 0 && seededUnit(s) < jamChance) {
      s.jamStreak = (s.jamStreak || 0) + 1;
      s.nextShotReadyTime = matchClock + .7;
      s.visualPhase = 'jam';
      playShotgunSound('failedFire', .76);
      floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 86, `JAM ${Math.round((s.heatPct || 0))}%`, '#ffbf8d'));
      if (s.jamStreak >= 2) startCooling(f);
      return false;
    }
    s.jamStreak = 0;
    s.heatPct = clamp((s.heatPct || 0) + C.HEAT_PER_SHOT, 0, 100);
    return true;
  }
  function angleDir(base, degrees) {
    const a = Math.atan2(base.y,base.x) + degrees * Math.PI / 180;
    return {x:Math.cos(a),y:Math.sin(a)};
  }
  function rayCircle(origin,dir,maxT,cx,cy,radius) {
    const ox = origin.x-cx, oy = origin.y-cy;
    const b = ox*dir.x + oy*dir.y;
    const c = ox*ox + oy*oy - radius*radius;
    const disc = b*b-c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    let t = -b-root;
    if (t < 0) t = -b+root;
    if (t < 0 || t > maxT) return null;
    return t;
  }
  function rayEdgeDistance(origin,dir) {
    const edge = pointOnRayToEdge(origin.x,origin.y,dir.x,dir.y);
    return dist(origin.x,origin.y,edge.x,edge.y);
  }
  function allTargets(owner) {
    const out = [];
    for (const f of fighters || []) {
      if (!live(f) || f === owner || sameTeam(f,owner)) continue;
      out.push({kind:'fighter',entity:f,x:f.x,y:f.y,radius:f.radius || 40,id:`fighter-${f.id}`});
    }
    const E = window.APEX_ENGINEER;
    if (E?.allStructures) {
      for (const s of E.allStructures() || []) {
        if (!s || s.dead || s.hp <= 0 || sameTeam(s.owner,owner)) continue;
        const radius = E.structureFootprint?.(s) || s.blockRadius || s.radius || 34;
        out.push({kind:'structure',entity:s,x:s.x,y:s.y,radius,id:`structure-${s.id}`});
      }
    }
    for (const p of projectiles || []) {
      if (!p || !(p.hp > 0) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || sameTeam(p.owner,owner)) continue;
      if (p.type === 'puppet_effigy' || p.type === 'straw_monster' || p.type === 'slime_child' || p.type === 'superfan' || p.targetable) {
        out.push({kind:'summon',entity:p,x:p.x,y:p.y,radius:p.radius || 18,id:`summon-${p.id ?? p.type}-${out.length}`});
      }
    }
    return out;
  }
  function firstRayHit(owner,origin,dir) {
    const maxT = rayEdgeDistance(origin,dir);
    let best = null;
    for (const target of allTargets(owner)) {
      const t = rayCircle(origin,dir,maxT,target.x,target.y,target.radius+C.RAY_WIDTH);
      if (t == null || (best && t >= best.t)) continue;
      best = {...target,t,point:{x:origin.x+dir.x*t,y:origin.y+dir.y*t}};
    }
    return best || {kind:'wall',t:maxT,point:{x:origin.x+dir.x*maxT,y:origin.y+dir.y*maxT}};
  }
  function pelletText() {}
  const previousSpawnDamageText = spawnDamageText;
  spawnDamageText = function(x,y,amount,isHeal=false) {
    if (!isHeal && damageTextContext) {
      return;
    }
    return previousSpawnDamageText(x,y,amount,isHeal);
  };
  function damageSummon(target,amount,owner,index,count,point) {
    const p = target.entity;
    p.hp = Math.max(0,p.hp-amount);
    pelletText(p,amount,index,count,point);
    owner.damageDone = (owner.damageDone||0)+amount;
    owner.hitsLanded = (owner.hitsLanded||0)+1;
    owner.maxHit = Math.max(owner.maxHit||0,amount);
    owner.damageLabels['shotgun-pellet'] = (owner.damageLabels['shotgun-pellet']||0)+amount;
    if (p.hp <= 0) { p.life=0; p._dead=true; spawnShockwave(p.x,p.y,'#ff7b32',90); }
  }
  function damageStructure(target,amount,owner,index,count,point) {
    const E = window.APEX_ENGINEER, s = target.entity;
    if (!E?.damageStructure) return;
    const textStart = floatingTexts.length;
    E.damageStructure(s,amount,owner,'shotgun-pellet',Infinity);
    if (floatingTexts.length > textStart) floatingTexts.splice(textStart,floatingTexts.length-textStart);
    pelletText(s,amount,index,count,point);
  }
  function damageTarget(target,amount,owner,index,count,point,label) {
    if (target.kind === 'fighter') {
      damageTextContext={target:target.entity,index,count,point};
      try { target.entity.takeDamage(amount,owner,label); }
      finally { damageTextContext=null; }
    } else if (target.kind === 'structure') damageStructure(target,amount,owner,index,count,point);
    else if (target.kind === 'summon') damageSummon(target,amount,owner,index,count,point);
  }
  function shotgunStunActive(target) {
    return target?.data?.shotgunHardStun && target.data.shotgunHardStun.endAt > matchClock;
  }
  function applyShotgunStun(target,duration,owner,batchId,allowSameBatchUpgrade=false) {
    if (!target?.data) return false;
    const active=target.data.shotgunHardStun;
    if (active && active.endAt>matchClock) {
      if (!allowSameBatchUpgrade || active.batchId!==batchId || duration<=active.duration) return false;
    } else if (active && active.endAt<=matchClock) {
      target.data.shotgunHardStun=null;
      target.data.shotgunHardStunImmunityUntil=Math.max(target.data.shotgunHardStunImmunityUntil||0,matchClock+C.HARD_STUN_IMMUNITY);
      return false;
    } else if ((target.data.shotgunHardStunImmunityUntil||0)>matchClock) return false;
    const existing=target.statuses?.stun;
    const timer=Math.max(duration,existing?.timer||0);
    target.statuses.stun={timer,max:timer,source:owner,shotgun:true,batchId};
    target.data.shotgunHardStun={batchId,ownerId:owner.id,duration,endAt:matchClock+duration};
    interruptMajorState(target);
    return true;
  }
  function interruptMajorState(target) {
    if (!target?.data) return;
    const d=target.data;
    if (d.galaxyImpact?.phase==='charge') {
      d.galaxyImpact=null; d.galaxyState='READY'; d.positionLocked=false;
      if (window.APEX_GALAXY) { window.APEX_GALAXY.impact=null; window.APEX_GALAXY.split=null; }
    }
    if (d.soccerBall && (d.soccerPossessionActive || d.soccerOneTouchKick || d.soccerPenaltyCinematicActive)) {
      d.soccerPossessionActive=false; d.soccerFieldOverlayActive=false; d.soccerOneTouchKick=null;
      d.soccerCurrentKickType=null; d.soccerPenaltyCinematicActive=false; d.soccerState='SOCCER_FREE_BALL';
      Object.assign(d.soccerBall,{state:'SOCCER_FREE_BALL',damageArmed:false,ownerContactActive:false});
    }
    for (const key of ['ninjaCharge','ninjaDash','ninjaChannel','stringCast','blackStringCast','iceAgeCast','activeChannel','chargeState']) {
      if (key in d) d[key]=null;
    }
    d.wallHitInterruptSerial=(d.wallHitInterruptSerial||0)+1;
  }
  function wallBonus(target,owner,pending) {
    if (!pending || pending.wallResolved || pending.count<3) return;
    pending.wallResolved=true;
    if (target.takeDamage) {
      interruptMajorState(target);
      applyShotgunStun(target,2,owner,pending.batchId,true);
    }
    cameraShake=Math.max(cameraShake,18);
    hitStop=Math.max(hitStop,.07);
    playGalaxyWallShared(.72);
    spawnShockwave(target.x,target.y,'#ff7b32',250);
    vfx.push({type:'wall',x:target.x,y:target.y,life:.5,maxLife:.5});
  }
  function applyKnockback(target,owner,count,dir,batchId) {
    const kb=34+count*27;
    if (target.kind==='fighter') {
      const f=target.entity;
      const nx=f.x+dir.x*kb, ny=f.y+dir.y*kb;
      const wall=nx<f.radius||nx>GAME_SIZE-f.radius||ny<f.radius||ny>GAME_SIZE-f.radius;
      f.data.shotgunKnockback={startAt:matchClock,endAt:matchClock+.2,startX:f.x,startY:f.y,
        endX:clamp(nx,f.radius,GAME_SIZE-f.radius),endY:clamp(ny,f.radius,GAME_SIZE-f.radius),
        wall,pending:{owner,batchId,count,wallResolved:false}};
      vfx.push({type:'push',x:f.x,y:f.y,dir:{...dir},strength:kb,life:.24,maxLife:.24});
    } else if (target.kind==='structure' && target.entity.kind==='war_machine') {
      const s=target.entity, r=window.APEX_ENGINEER?.structureFootprint?.(s)||s.radius||60;
      const nx=s.x+dir.x*kb, ny=s.y+dir.y*kb;
      const wall=nx<r||nx>GAME_SIZE-r||ny<r||ny>GAME_SIZE-r;
      s.x=clamp(nx,r,GAME_SIZE-r); s.y=clamp(ny,r,GAME_SIZE-r);
      if (wall && count>=3) wallBonus(s,owner,{batchId,count,wallResolved:false});
    }
  }
  function resolveBatch(owner,dir,spreadScale=1,sourceKind='normal') {
    if (!live(owner)) return null;
    const batchId=++batchSerial;
    const muzzle={x:owner.x+dir.x*(owner.radius+26),y:owner.y+dir.y*(owner.radius+26)};
    const hits=new Map(), rays=[];
    for (let i=0;i<C.PELLET_COUNT;i++) {
      const degrees=(-30+i*10)*spreadScale;
      const pelletDir=angleDir(dir,degrees);
      const hit=firstRayHit(owner,muzzle,pelletDir);
      rays.push({dir:pelletDir,end:hit.point,hit:hit.kind!=='wall'});
      if (hit.kind==='wall') continue;
      let data=hits.get(hit.entity);
      if (!data) { data={target:hit,count:0,points:[],sumX:0,sumY:0}; hits.set(hit.entity,data); }
      data.count++; data.points.push(hit.point); data.sumX+=pelletDir.x; data.sumY+=pelletDir.y;
    }
    for (const data of hits.values()) {
      const count=data.count, multiplier=C.MULTIPLIER[count]||1, amount=C.PELLET_DAMAGE*multiplier;
      for (let i=0;i<count;i++) damageTarget(data.target,amount,owner,i,count,data.points[i],`shotgun-${sourceKind}-pellet`);
      if (data.target.kind==='structure') playShotgunSound('buildingHit',.62);
      const pushDir=norm(data.sumX/count,data.sumY/count);
      applyKnockback(data.target,owner,count,pushDir,batchId);
      if (data.target.kind==='fighter' && count===7) {
        applyShotgunStun(data.target.entity,1,owner,batchId,false);
        playShotgunSound('sevenHit',.72);
        cameraShake=Math.max(cameraShake,8);
      }
    }
    const scale=(owner.radius||75)/75, side={x:-dir.y,y:dir.x};
    const nearestEnd=rays.reduce((best,ray)=>Math.min(best,dist(owner.x,owner.y,ray.end.x,ray.end.y)),Infinity);
    const fireMuzzleDistance=(C.GUN_Y+C.GUN_LENGTH*.5-C.GUN_RECOIL)*scale;
    const visualDistance=Math.min(fireMuzzleDistance,Math.max(owner.radius+22,nearestEnd-10));
    const visualMuzzle={x:owner.x+dir.x*visualDistance+side.x*C.MUZZLE_SIDE_OFFSET*scale,y:owner.y+dir.y*visualDistance+side.y*C.MUZZLE_SIDE_OFFSET*scale};
    vfx.push({type:'streaks',ownerId:owner.id,x:visualMuzzle.x,y:visualMuzzle.y,rays,life:.19,maxLife:.19,travelTime:.13,createdAt:matchClock});
    vfx.push({type:'muzzle',ownerId:owner.id,x:visualMuzzle.x,y:visualMuzzle.y,angle:Math.atan2(dir.y,dir.x),life:.12,maxLife:.12,createdAt:matchClock});
    vfx.push({type:'shell',x:owner.x+side.x*31,y:owner.y+side.y*31,vx:-dir.x*90+side.x*310,vy:-dir.y*90+side.y*310,angle:Math.atan2(dir.y,dir.x),spin:13,life:1.15,maxLife:1.15,createdAt:matchClock});
    playShotgunSound('fire',.84);
    cameraShake=Math.max(cameraShake,4.5);
    hitStop=Math.max(hitStop,.018);
    return {batchId,hits};
  }
  function startLongReload(f) {
    const s=state(f); if (!s || s.isLongReloading || s.shells>0) return;
    s.isLongReloading=true; s.longReloadRemaining=C.LONG_RELOAD_TIME; s.longReloadStart=matchClock;
    s.isPumping=false; s.hookCheckPending=false; s.visualPhase='longReload';
    playShotgunSound('reloadBatch',.66);
  }
  function refill(f,reason='reload') {
    const s=state(f); if (!s) return;
    s.shells=C.MAX_SHELLS; s.isLongReloading=false; s.longReloadRemaining=0;
    s.hookBreachCharge=1; s.counterBlastCharge=1; s.isPumping=false;
    s.ringRotation=0;s.ringRotationFrom=0;s.ringRotationTo=0;s.ringAnimStart=matchClock;
    s.ringFromShells=C.MAX_SHELLS;s.ringToShells=C.MAX_SHELLS;s.longReloadStart=0;
  }
  function spendShell(f) {
    const s=state(f); if (!s || s.shells<=0) return false;
    const before=s.shells;
    s.shells--;
    s.ringFromShells=before;
    s.ringToShells=s.shells;
    s.ringRotationFrom=0;
    s.ringRotationTo=-TAU/C.MAX_SHELLS;
    s.ringAnimStart=matchClock+C.SHOT_AFTER_TIME;
    if (s.shells===0) startLongReload(f); return true;
  }
  function scheduleDouble(f,dir,sourceKind) {
    const s=state(f); if (!s) return;
    s.pendingSecond={at:matchClock+C.DOUBLE_DELAY,dir:{...dir},sourceKind};
  }
  function startShotLock(f,dir) {
    const s=state(f);if(!s)return;
    s.shotLockUntil=matchClock+C.SHOT_LOCK_TIME;
    s.shotAnchor={x:f.x,y:f.y,dir:{...dir}};
    s.visualDir={x:dir.x,y:dir.y};s.visualAngle=Math.atan2(dir.y,dir.x);
  }
  function fireCycle(f,target,sourceKind='normal',allowDouble=true,spreadScale=1) {
    const s=state(f); if (!s || !live(target) || s.shells<=0) return false;
    if (!shotgunFireGate(f)) return false;
    const startShells=s.shells;
    const dir=norm(target.x-f.x,target.y-f.y);
    s.visualDir={x:dir.x,y:dir.y};s.visualAngle=Math.atan2(dir.y,dir.x);
    startShotLock(f,dir);
    const double=allowDouble && startShells>=2 && rageChance(f)>0 && seededUnit(s)<rageChance(f);
    spendShell(f);
    s.lastShotTime=matchClock; s.nextShotReadyTime=matchClock+C.SHOT_CYCLE;
    s.isPumping=true; s.pumpReadyTime=matchClock+C.PUMP_READY_TIME;
    s.hookCheckPending=sourceKind==='normal'; s.visualPhase='fire'; s.recoilUntil=matchClock+.15;
    resolveBatch(f,dir,spreadScale,sourceKind);
    if (double) {
      scheduleDouble(f,dir,sourceKind);
    }
    return true;
  }
  function doSecondShot(f) {
    const s=state(f), pending=s?.pendingSecond;
    if (!pending || matchClock<pending.at || !live(f)) return;
    s.pendingSecond=null;
    if (s.shells<=0) return;
    startShotLock(f,pending.dir);
    s.visualDir={x:pending.dir.x,y:pending.dir.y};s.visualAngle=Math.atan2(pending.dir.y,pending.dir.x);
    spendShell(f);
    s.lastShotTime=matchClock; s.recoilUntil=matchClock+.15; s.visualPhase='fire';
    resolveBatch(f,pending.dir,1,pending.sourceKind+'-double');
  }
  function validHookPath(f,target) {
    if (!live(target)) return false;
    const d=dist(f.x,f.y,target.x,target.y);
    return d>=C.HOOK_MIN_RANGE && d<=C.HOOK_MAX_RANGE;
  }
  function tryHook(f,target) {
    const s=state(f);
    if (!s || !s.hookCheckPending || matchClock<s.pumpReadyTime) return;
    s.hookCheckPending=false; s.isPumping=false; s.visualPhase='ready';
    if (s.hookBreachCharge<=0 || s.isLongReloading || s.shells<1 || f.hardCC() || f.hasStatus('abilityDisabled') || !validHookPath(f,target)) return;
    s.hookBreachCharge=0;
    const dir=norm(target.x-f.x,target.y-f.y);
    const startDistance=dist(f.x,f.y,target.x,target.y);
    const rangeT=clamp((startDistance-C.HOOK_MIN_RANGE)/Math.max(1,C.HOOK_MAX_RANGE-C.HOOK_MIN_RANGE),0,1);
    const desiredCenterGap=lerp(225,300,rangeT);
    const totalClose=Math.max(0,startDistance-desiredCenterGap);
    const dynamicDash=clamp(totalClose*.58,220,330);
    const dynamicPull=clamp(totalClose-dynamicDash,170,270);
    s.visualDir={x:dir.x,y:dir.y};s.visualAngle=Math.atan2(dir.y,dir.x);
    f.setDir(dir.x,dir.y);
    f.data.positionLocked=true;
    s.hookSequence={startAt:matchClock,targetId:target.id,shot:false,
      ownerStart:{x:f.x,y:f.y},targetStart:{x:target.x,y:target.y},
      ownerEnd:{x:clamp(f.x+dir.x*dynamicDash,f.radius,GAME_SIZE-f.radius),y:clamp(f.y+dir.y*dynamicDash,f.radius,GAME_SIZE-f.radius)},
      targetEnd:{x:clamp(target.x-dir.x*dynamicPull,target.radius,GAME_SIZE-target.radius),y:clamp(target.y-dir.y*dynamicPull,target.radius,GAME_SIZE-target.radius)}};
    target.applyStatus('stun',C.HOOK_LOCK_TIME,{source:f,shotgunHook:true});
    interruptMajorState(target);
    vfx.push({type:'hook',ownerId:f.id,targetId:target.id,startAt:matchClock,life:C.HOOK_LOCK_TIME,maxLife:C.HOOK_LOCK_TIME});
    playShotgunSound('hook',.82);
  }
  function shotgunOnCollide(f,e) {
    const s=state(f);
    if (!s || !live(f) || !live(e) || s.hookSequence || s.counterMotion || (s.shotLockUntil||0)>matchClock) return false;
    const d=Math.max(1,dist(f.x,f.y,e.x,e.y));
    const minGap=(f.radius||0)+(e.radius||0)+10;
    const away=norm(f.x-e.x,f.y-e.y);
    if (d<minGap) {
      const push=(minGap-d)*.72;
      f.x=clamp(f.x+away.x*push,f.radius,GAME_SIZE-f.radius);
      f.y=clamp(f.y+away.y*push,f.radius,GAME_SIZE-f.radius);
      f.data.positionLocked=false;
    }
    if (!f.hardCC?.()) {
      s.visualDir = {x:-away.x, y:-away.y};
      s.visualAngle = Math.atan2(-away.y, -away.x);
    }
    return false;
  }
  function hookCinematicEase(t) {
    t = clamp(t, 0, 1);
    let base;
    if (t < .2) base = lerp(0, .34, smoothstep(t / .2));
    else if (t < .42) base = lerp(.34, .43, smoothstep((t - .2) / .22));
    else if (t < .74) base = lerp(.43, .76, smoothstep((t - .42) / .32));
    else base = lerp(.76, 1, 1 - Math.pow(1 - (t - .74) / .26, 3));
    const jerk = Math.sin(t * Math.PI * 9) * .025 * (1 - t);
    return clamp(base + jerk, 0, 1);
  }
  function updateHookSequence(f) {
    const s=state(f), hook=s?.hookSequence;
    if (!hook) return false;
    const target=(fighters||[]).find(q=>q.id===hook.targetId&&live(q));
    const age=matchClock-hook.startAt;
    f.data.positionLocked=true;
    if (!target) { s.hookSequence=null; return false; }
    target.data.positionLocked=true;
    if (age>=C.HOOK_FLIGHT_TIME) {
      const t=hookCinematicEase((age-C.HOOK_FLIGHT_TIME)/(C.HOOK_PULL_END-C.HOOK_FLIGHT_TIME));
      f.x=lerp(hook.ownerStart.x,hook.ownerEnd.x,t);f.y=lerp(hook.ownerStart.y,hook.ownerEnd.y,t);
      target.x=lerp(hook.targetStart.x,hook.targetEnd.x,t);target.y=lerp(hook.targetStart.y,hook.targetEnd.y,t);
      f.setDir(target.x-f.x,target.y-f.y);
    }
    if (!hook.shot && age>=C.HOOK_SHOT_TIME) {
      hook.shot=true;
      if (s.shells>0) {
        fireCycle(f,target,'hook',true,1);
        playShotgunSound('specialReload',.68);
      }
      const releaseDir = norm((hook.ownerEnd?.x ?? f.x) - (hook.ownerStart?.x ?? f.x), (hook.ownerEnd?.y ?? f.y) - (hook.ownerStart?.y ?? f.y));
      if (Number.isFinite(releaseDir.x) && Number.isFinite(releaseDir.y)) {
        f.setDir(-releaseDir.x, -releaseDir.y);
        s.visualDir={x:-releaseDir.x,y:-releaseDir.y};
        s.visualAngle=Math.atan2(-releaseDir.y,-releaseDir.x);
      }
      s.hookSequence=null;
      return false;
    }
    if (age>=C.HOOK_LOCK_TIME) { s.hookSequence=null; return false; }
    return true;
  }
  function updateShotgun(f,ignored,dt) {
    const s=state(f), target=enemyChampion(f);
    if (!s) return;
    if (s.counterMotion) {
      const motion=s.counterMotion, t=smoothstep(clamp((matchClock-motion.startAt)/motion.duration,0,1));
      f.data.positionLocked=true;
      f.x=lerp(motion.startX,motion.endX,t);f.y=lerp(motion.startY,motion.endY,t);
      if (t>=1) s.counterMotion=null;
      else return;
    }
    if (!f.isRage && f.hp<=f.maxHp*.5) {
      f.isRage=true; f.rageStartHp=f.hp;
      emitParticles(f.x,f.y,'#ff562f',55,480,7,1,'square'); spawnShockwave(f.x,f.y,'#ff562f',190);
    }
    if (target && !s.hookSequence && !(s.shotLockUntil>matchClock)) aimTarget(f,target);
    doSecondShot(f);
    if (updateHookSequence(f)) return;
    if (updateCooling(f,target,dt)) return;
    if ((s.shotLockUntil||0)>matchClock && s.shotAnchor) {
      return;
    }
    if (s.isLongReloading) {
      s.longReloadRemaining=Math.max(0,s.longReloadRemaining-dt);
      s.visualPhase='longReload';
      if (s.longReloadRemaining<=0) refill(f,'reload');
      return;
    }
    tryHook(f,target);
    if (target && !s.pendingSecond && !s.hookSequence && matchClock>=s.nextShotReadyTime && s.shells>0) fireCycle(f,target,'normal',true,1);
  }
  function drawImageFit(ctx,img,x,y,w,h,rotation=0,alpha=1) {
    if (!img?.complete || !img.naturalWidth) return false;
    ctx.save(); ctx.translate(x,y); ctx.rotate(rotation); ctx.globalAlpha*=alpha;
    ctx.drawImage(img,-w/2,-h/2,w,h); ctx.restore(); return true;
  }
  function gunImage(s) {
    if (!s) return images.gunReady;
    if (s.coolingUntil > matchClock) return images.gunPump;
    if (s.isLongReloading) return images.gunPump;
    const shotAge=matchClock-(s.lastShotTime||-Infinity);
    if (shotAge>=0 && shotAge<C.SHOT_CYCLE) {
      if (shotAge<C.SHOT_SPIN_START) return images.gunAfter;
      if (shotAge<C.SHOT_READY_TIME) return images.gunPump;
      return images.gunReady;
    }
    return images.gunReady;
  }
  function ringImage(shells) {
    const count=clamp(Math.round(shells||0),0,C.MAX_SHELLS);
    return images[`ring${count}`] || images.ring0;
  }
  function reloadHalfSpinAngle(phase) {
    phase = clamp(phase, 0, 1);
    if (phase < .25) return smoothstep(phase / .25) * Math.PI;
    if (phase < .5) return Math.PI;
    if (phase < .75) return Math.PI * (1 - smoothstep((phase - .5) / .25));
    return 0;
  }
  function reloadSlideOffset(phase, scale = 1) {
    phase = clamp(phase, 0, 1);
    if (phase >= .25 && phase < .5) {
      const local = (phase - .25) / .25;
      return Math.sin(local * Math.PI * 2) * 12 * scale;
    }
    if (phase >= .75) {
      const local = (phase - .75) / .25;
      return Math.sin(local * Math.PI * 2) * 12 * scale;
    }
    return 0;
  }
  function shotSpinAngle(s) {
    if (!s) return 0;
    const shotAge=matchClock-(s.lastShotTime||-Infinity);
    if (shotAge>=C.SHOT_SPIN_START && shotAge<C.SHOT_SPIN_END) {
      const t=clamp((shotAge-C.SHOT_SPIN_START)/(C.SHOT_SPIN_END-C.SHOT_SPIN_START),0,1);
      return (1-Math.pow(1-t,3))*TAU;
    }
    if ((s.gunSpinUntil||0)>matchClock) {
      const t=clamp((matchClock-(s.gunSpinStart||matchClock))/C.COUNTER_SPIN_TIME,0,1);
      return (1-Math.pow(1-t,3))*TAU;
    }
    if (s.isLongReloading) {
      const elapsed=clamp(matchClock-(s.longReloadStart||matchClock),0,C.LONG_RELOAD_TIME);
      if (elapsed>=C.LONG_RELOAD_FILL_TIME) {
        const phase=clamp((elapsed-C.LONG_RELOAD_FILL_TIME)/C.RELOAD_SPIN_TIME,0,1);
        return reloadHalfSpinAngle(phase);
      }
    }
    return 0;
  }
  function drawReloadRing(ctx,f,s,scale) {
    const size=74*scale, x=-142*scale, y=-112*scale;
    ctx.save(); ctx.translate(x,y);
    if (s.isLongReloading) {
      const elapsed=clamp(matchClock-(s.longReloadStart||matchClock),0,C.LONG_RELOAD_TIME);
      if (elapsed<C.LONG_RELOAD_FILL_TIME) {
        const loaded=clamp(Math.floor(elapsed),0,C.MAX_SHELLS);
        const local=elapsed-loaded;
        drawImageFit(ctx,ringImage(loaded),0,0,size,size,-local*TAU/C.MAX_SHELLS,.96);
      } else {
        const phase=clamp((elapsed-C.LONG_RELOAD_FILL_TIME)/C.RELOAD_SPIN_TIME,0,1);
        drawImageFit(ctx,ringImage(C.MAX_SHELLS),0,0,size,size,reloadHalfSpinAngle(phase),.96);
      }
    } else {
      const start=s.ringAnimStart||0;
      const t=matchClock<start?0:smoothstep(clamp((matchClock-start)/.32,0,1));
      const rotation=lerp(s.ringRotationFrom||0,s.ringRotationTo||0,t);
      s.ringRotation=rotation;
      const displayShells=matchClock<start?(s.ringFromShells ?? s.shells):(s.ringToShells ?? s.shells);
      drawImageFit(ctx,ringImage(displayShells),0,0,size,size,rotation,.96);
    }
    ctx.restore();
  }
  function drawShotgun(ctx,f) {
    const s=state(f), scale=(f.radius||75)/75;
    ctx.save();
    if (s?.visualDir) {
      const currentAngle=Math.atan2(f.dir?.y||0,f.dir?.x||1);
      const visualAngle=Math.atan2(s.visualDir.y,s.visualDir.x);
      ctx.rotate(visualAngle-currentAngle);
    }
    ctx.rotate(-Math.PI/2);
    if (s) drawReloadRing(ctx,f,s,scale);
    if (!drawImageFit(ctx,images.body,-11*scale,4*scale,204*scale,276*scale,0,1)) {
      drawSketchBlob(ctx,f.radius,'#2a1512',12);
    }
    const recoil=matchClock<(s?.recoilUntil||0)?-C.GUN_RECOIL*scale:0;
    const pump=s?.isLongReloading && !(s?.coolingUntil>matchClock)?Math.sin(matchClock*8)*5*scale:0;
    const spin=shotSpinAngle(s);
    let gunRot=Math.PI+spin;
    let gunX=C.GUN_X*scale;
    let gunY=C.GUN_Y*scale+recoil+pump;
    if (s?.isLongReloading && !(s?.coolingUntil>matchClock)) {
      const elapsed=clamp(matchClock-(s.longReloadStart||matchClock),0,C.LONG_RELOAD_TIME);
      if (elapsed>=C.LONG_RELOAD_FILL_TIME) {
        const phase=clamp((elapsed-C.LONG_RELOAD_FILL_TIME)/C.RELOAD_SPIN_TIME,0,1);
        gunY+=reloadSlideOffset(phase, scale);
      }
    }
    if (s?.coolingUntil>matchClock) {
      const coolingRot = Math.PI / 2;
      const buttRot = 0;
      gunRot=coolingRot;
      const poseHold = (s.buttStrikePoseUntil || 0) - matchClock;
      if (poseHold > 0) {
        const poseMix = poseHold > .24 ? 1 : smoothstep(poseHold / .24);
        gunRot = lerp(coolingRot, buttRot, poseMix);
      }
      if ((s.buttStrikeAnimUntil||0)>matchClock) {
        const p=clamp((matchClock-(s.buttStrikeAnimStart ?? matchClock))/C.BUTT_STRIKE_VISUAL_TIME,0,1);
        const slap=Math.sin(p*Math.PI);
        gunRot=buttRot + slap*.18;
        gunY+=Math.sin(p*Math.PI*2)*40*scale - slap*22*scale;
      }
    }
    drawImageFit(ctx,gunImage(s),gunX,gunY,C.GUN_WIDTH*scale,C.GUN_LENGTH*scale,gunRot,1);
    ctx.restore();
  }
  const ShotgunType={
    id:'shotgun', name:'SHOTGUN', hp:1000, color:'#ff6238',
    desc:'7-pellet pressure, breach engage, counter blast', speed:445, startDx:1, startDy:.18,
    init:f=>{
      f.maxHp=1000; f.hp=1000;
      f.data.shotgun={shells:6,maxShells:6,isLongReloading:false,longReloadRemaining:0,
        hookBreachCharge:1,counterBlastCharge:1,lastShotTime:-Infinity,nextShotReadyTime:0,
        isPumping:false,pumpReadyTime:0,shotgunHardStunImmunityUntil:0,pendingSecond:null,pendingHook:null,
        hookCheckPending:false,recoilUntil:0,visualPhase:'ready',rngState:(0x51f15e5d^(f.id*2654435761))>>>0,
        counterPacketKey:null,counterGuardUntil:-Infinity,hookSequence:null,counterMotion:null,
        ringRotation:0,ringRotationFrom:0,ringRotationTo:0,ringAnimStart:0,gunSpinStart:-Infinity,gunSpinUntil:-Infinity,
        ringFromShells:6,ringToShells:6,longReloadStart:0,shotLockUntil:-Infinity,shotAnchor:null,
        heatPct:0,jamStreak:0,coolingUntil:0,coolingStart:0,coolingStartHeat:0,coolingDuration:0,coolingActive:false,buttStrikeTick:0,
        buttStrikeVisualTimer:0,buttStrikeAnimStart:0,buttStrikeAnimUntil:0,buttStrikePoseUntil:0,
        visualDir:{x:f.dir?.x||1,y:f.dir?.y||0},visualAngle:Math.atan2(f.dir?.y||0,f.dir?.x||1)};
    },
    update:updateShotgun,
    onCollide:shotgunOnCollide,
    draw:drawShotgun
  };
  const existing=FighterTypes.find(ft=>ft.name==='SHOTGUN');
  if (existing) Object.assign(existing,ShotgunType); else FighterTypes.push(ShotgunType);
  SOUND_ID.SHOTGUN={base:78,wave:'sawtooth',bend:.36,noise:.18};

  const previousResolveWalls=Fighter.prototype.resolveWalls;
  Fighter.prototype.resolveWalls=function() {
    const wall=previousResolveWalls.call(this);
    const pending=this.data?.shotgunPendingWall;
    if (pending && (pending.expires<matchClock || pending.wallResolved)) delete this.data.shotgunPendingWall;
    else if (wall && pending) {
      wallBonus(this,pending.owner,pending);
      delete this.data.shotgunPendingWall;
    }
    return wall;
  };
  const harmfulAttached=new Set(['slow','push','burn','poison','freeze','bleed','stun','weak','brittle','abilityDisabled','silenceCurse','hexBurn','rapidPunch','disease','innerTrauma']);
  const previousApplyStatus=Fighter.prototype.applyStatus;
  Fighter.prototype.applyStatus=function(name,duration,data={}) {
    const s=state(this);
    if (s && harmfulAttached.has(name) && s.counterNegateUntil>=matchClock && (!data.source || data.source===s.counterNegatedSource)) return;
    const result=previousApplyStatus.call(this,name,duration,data);
    if (s && (name==='stun'||name==='freeze')) {
      s.pendingSecond=null;s.pendingHook=null;s.hookSequence=null;s.hookCheckPending=false;
    }
    return result;
  };
  function counterBlast(f,source,label) {
    const s=state(f); if (!s) return false;
    const target=source?.owner && live(source.owner)?source.owner:source;
    if (!live(target) || target===f || dist(f.x,f.y,target.x,target.y)>C.COUNTER_RANGE) return false;
    if (s.counterBlastCharge<=0 || f.hardCC() || f.hasStatus('abilityDisabled') || s.counterGuardUntil>=matchClock || counterDepth>0) return false;
    s.counterBlastCharge=0; s.counterGuardUntil=matchClock+.05; s.counterNegateUntil=matchClock+.001; s.counterNegatedSource=target;
    for (const key of harmfulAttached) {
      const status=f.statuses?.[key];
      if (status?.source===target && status.max && status.timer>=status.max*.98) delete f.statuses[key];
    }
    const dir=norm(target.x-f.x,target.y-f.y);
    s.visualDir={x:dir.x,y:dir.y};s.visualAngle=Math.atan2(dir.y,dir.x);
    f.setDir(dir.x,dir.y);
    counterDepth++;
    try { resolveBatch(f,dir,C.COUNTER_CONE_SCALE,'counter'); }
    finally { counterDepth--; }
    s.counterMotion={startAt:matchClock,duration:.42,startX:f.x,startY:f.y,
      endX:clamp(f.x-dir.x*C.COUNTER_RECOIL,f.radius,GAME_SIZE-f.radius),
      endY:clamp(f.y-dir.y*C.COUNTER_RECOIL,f.radius,GAME_SIZE-f.radius)};
    f.data.positionLocked=true;
    refill(f,'counter');
    playShotgunSound('specialReload',.68);
    s.nextShotReadyTime=Math.max(s.nextShotReadyTime,matchClock+C.SHOT_CYCLE);
    s.recoilUntil=matchClock+.2; s.visualPhase='fire';
    s.gunSpinStart=matchClock;s.gunSpinUntil=matchClock+C.COUNTER_SPIN_TIME;
    vfx.push({type:'counterRecoil',x:f.x,y:f.y,dir:{...dir},life:.48,maxLife:.48});
    return true;
  }
  const previousTakeDamage=Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage=function(amount,source=null,label='',statusDamage=false) {
    if (this.name==='SHOTGUN' && !statusDamage && Number.isFinite(amount) && amount>10 && source && source!==this) {
      if (counterBlast(this,source,label)) return 0;
    }
    return previousTakeDamage.call(this,amount,source,label,statusDamage);
  };

  function updateVfx(dt) {
    const controlFrameKey = window.__apexControlUpdateFrameKey;
    if (controlFrameKey) {
      if (window.__apexShotgunVfxUpdateFrameKey === controlFrameKey) return;
      window.__apexShotgunVfxUpdateFrameKey = controlFrameKey;
    }
    for (const fx of vfx) {
      if (!Number.isFinite(fx.createdAt)) fx.createdAt = matchClock;
      fx.life = Number.isFinite(fx.life) ? fx.life - dt : 0;
      if (fx.type==='shell') {
        fx.x+=fx.vx*dt; fx.y+=fx.vy*dt; fx.vy+=360*dt; fx.angle+=fx.spin*dt;
        if (matchClock - fx.createdAt > Math.max(1.35, (fx.maxLife || 1.15) + .35)) fx.life = 0;
      }
    }
    for (let i=vfx.length-1;i>=0;i--) if (!vfx[i] || !Number.isFinite(vfx[i].life) || vfx[i].life<=0) vfx.splice(i,1);
    for (const f of fighters||[]) {
      const motion=f?.data?.shotgunKnockback;
      if (motion) {
        const t=smoothstep(clamp((matchClock-motion.startAt)/(motion.endAt-motion.startAt),0,1));
        f.x=lerp(motion.startX,motion.endX,t);f.y=lerp(motion.startY,motion.endY,t);
        f.data.positionLocked=true;
        if (t>=1) {
          if (motion.wall && motion.pending?.count>=3) wallBonus(f,motion.pending.owner,motion.pending);
          delete f.data.shotgunKnockback;
        }
      }
      const hard=f?.data?.shotgunHardStun;
      if (hard && hard.endAt<=matchClock) {
        f.data.shotgunHardStun=null;
        f.data.shotgunHardStunImmunityUntil=Math.max(f.data.shotgunHardStunImmunityUntil||0,matchClock+C.HARD_STUN_IMMUNITY);
      }
    }
  }
  function drawVfx(ctx) {
    const controlFrameKey = window.__apexControlDrawFrameKey;
    if (controlFrameKey) {
      if (window.__apexShotgunVfxDrawFrameKey === controlFrameKey) return;
      window.__apexShotgunVfxDrawFrameKey = controlFrameKey;
    }
    for (const fx of vfx) {
      const a=clamp(fx.life/fx.maxLife,0,1);
      ctx.save(); ctx.globalAlpha=a;
      if (fx.type==='streaks') {
        ctx.lineCap='round';
        for (const ray of fx.rays) {
          const progress=clamp((fx.maxLife-fx.life)/(fx.travelTime||.13),0,1);
          const head={x:lerp(fx.x,ray.end.x,progress),y:lerp(fx.y,ray.end.y,progress)};
          const travelled=dist(fx.x,fx.y,head.x,head.y),tail=Math.min(105,travelled);
          ctx.shadowColor='#ff7b2d';ctx.shadowBlur=12;
          ctx.strokeStyle=ray.hit?'rgba(255,252,220,1)':'rgba(255,151,58,.92)'; ctx.lineWidth=ray.hit?7:4;
          ctx.beginPath(); ctx.moveTo(head.x-ray.dir.x*tail,head.y-ray.dir.y*tail); ctx.lineTo(head.x,head.y); ctx.stroke();
          ctx.shadowBlur=0;
          drawImageFit(ctx,images.pellet,head.x,head.y,64,24,Math.atan2(ray.dir.y,ray.dir.x),1);
          if(ray.hit&&progress>=.98){ctx.fillStyle='#fff4b0';for(let i=0;i<3;i++){const side=(i-1)*8;ctx.beginPath();ctx.arc(ray.end.x-ray.dir.y*side,ray.end.y+ray.dir.x*side,4-i*.7,0,TAU);ctx.fill();}}
        }
      } else if (fx.type==='muzzle') drawImageFit(ctx,images.muzzle,fx.x,fx.y,190,112,fx.angle,Math.min(1,a*2));
      else if (fx.type==='shell') {ctx.shadowColor='#ffc465';ctx.shadowBlur=9;drawImageFit(ctx,images.shell,fx.x,fx.y,19,47,fx.angle,Math.min(1,a*1.5));}
      else if (fx.type==='hook') {
        const owner=(fighters||[]).find(f=>f.id===fx.ownerId),target=(fighters||[]).find(f=>f.id===fx.targetId);
        if(owner&&target){const d=norm(target.x-owner.x,target.y-owner.y),scale=(owner.radius||75)/75,side={x:-d.y,y:d.x},muzzleDistance=(C.GUN_X+C.GUN_LENGTH*.5)*scale,origin={x:owner.x+d.x*muzzleDistance+side.x*C.MUZZLE_SIDE_OFFSET*scale,y:owner.y+d.y*muzzleDistance+side.y*C.MUZZLE_SIDE_OFFSET*scale};
          const progress=clamp((matchClock-fx.startAt)/C.HOOK_FLIGHT_TIME,0,1),hx=lerp(origin.x,target.x,progress),hy=lerp(origin.y,target.y,progress);
          const length=Math.max(1,dist(origin.x,origin.y,hx,hy)),angle=Math.atan2(hy-origin.y,hx-origin.x),ropeLen=Math.max(8,length-28);
          ctx.translate(origin.x,origin.y);ctx.rotate(angle);ctx.shadowColor='#ff562c';ctx.shadowBlur=10;
          if(!drawImageFit(ctx,images.hookRope,ropeLen/2,0,ropeLen,18,0,Math.min(1,a*1.6))){
            ctx.lineCap='round';ctx.strokeStyle='#30140b';ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(ropeLen,0);ctx.stroke();
            ctx.strokeStyle='#ffad54';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(ropeLen,0);ctx.stroke();
          }
          drawImageFit(ctx,images.hookHead,length,0,76,50,0,Math.min(1,a*1.6));}
      } else if (fx.type==='wall') {
        ctx.strokeStyle='#fff0a0';ctx.lineWidth=8;ctx.beginPath();ctx.arc(fx.x,fx.y,(1-a)*95+18,0,TAU);ctx.stroke();
      } else if (fx.type==='push') {
        ctx.strokeStyle='rgba(255,130,50,.9)';ctx.lineWidth=7;ctx.lineCap='round';
        for(let i=-1;i<=1;i++){const sx=-fx.dir.y*i*13,sy=fx.dir.x*i*13;ctx.beginPath();ctx.moveTo(fx.x+sx-fx.dir.x*15,fx.y+sy-fx.dir.y*15);ctx.lineTo(fx.x+sx-fx.dir.x*(55+(1-a)*fx.strength*.35),fx.y+sy-fx.dir.y*(55+(1-a)*fx.strength*.35));ctx.stroke();}
      } else if (fx.type==='counterRecoil') {
        ctx.strokeStyle='rgba(255,237,170,.9)';ctx.lineWidth=8;ctx.lineCap='round';
        for(let i=-2;i<=2;i++){const sx=-fx.dir.y*i*14,sy=fx.dir.x*i*14;ctx.beginPath();ctx.moveTo(fx.x+sx,fx.y+sy);ctx.lineTo(fx.x+sx-fx.dir.x*(90+(1-a)*130),fx.y+sy-fx.dir.y*(90+(1-a)*130));ctx.stroke();}
      }
      ctx.restore();
    }
  }
  const previousUpdate=update;
  update=function(dt) { const result=previousUpdate(dt); if(!window.__apexShotgunLateBinder)updateVfx(dt); return result; };
  const previousDrawProjectiles=drawProjectiles;
  drawProjectiles=function(ctx) { const result=previousDrawProjectiles(ctx); if(!window.__apexShotgunLateBinder)drawVfx(ctx); return result; };

  const previousFloatingTextDrawShotgun=FloatingText.prototype.draw;
  FloatingText.prototype.draw=function(ctx) {
    return previousFloatingTextDrawShotgun.call(this,ctx);
  };
  const previousGlyph=fighterGlyph;
  fighterGlyph=function(name) { return name==='SHOTGUN'?'✹':previousGlyph(name); };
  function appendShotgunCard() {
    const grid=document.getElementById('roster-grid'), ft=FighterTypes.find(q=>q.name==='SHOTGUN');
    const activeText=document.querySelector('#roster-tabs button.active')?.textContent||'';
    if (!grid || !ft || (!activeText.includes('APEX') && activeText) || grid.querySelector('[data-fighter="SHOTGUN"]')) return;
    const card=document.createElement('div');card.className='fighter-card';card.dataset.fighter='SHOTGUN';card.style.color=ft.color;
    card.style.backgroundImage=`linear-gradient(rgba(7,5,5,.2),rgba(7,5,5,.58)),url(${FILES.pickButton})`;
    card.style.backgroundSize='cover';card.style.backgroundPosition='center';
    const name=document.createElement('div');name.className='f-name';name.textContent='SHOTGUN';
    const preview=document.createElement('canvas');preview.className='f-preview';preview.width=140;preview.height=96;preview.setAttribute('aria-label','SHOTGUN battle visual preview');
    card.append(name,preview);card.onclick=()=>selectFighter(ft,card);grid.appendChild(card);drawRosterPreview(preview,ft,1001);
  }
  const previousPopulateRoster=populateRoster;
  populateRoster=function(){ const result=previousPopulateRoster(); appendShotgunCard(); return result; };
  const previousSyncSelected=syncSelectedFighterVfx;
  syncSelectedFighterVfx=function() {
    const result=previousSyncSelected();
    [[1,p1Selection],[2,p2Selection]].forEach(([player,fighter])=>{
      if (fighter?.name!=='SHOTGUN') return;
      const image=document.getElementById(`p${player}-fighter-vfx`);if(!image)return;
      const slot=image.closest('.picked-fighter-slot');if(slot)slot.dataset.fighter='SHOTGUN';
      image.src=FILES.picked;image.classList.add('has-fighter');image.alt=`Player ${player}: SHOTGUN`;
    });
    return result;
  };

  function soloFire(st,p,forceDouble=false) {
    p.data.shotgun ||= {shells:6,reload:0,hook:1,counter:1,rngState:(0x51f15e5d^(p.side*2654435761))>>>0}; const s=p.data.shotgun;
    if (s.reload>0 || s.shells<=0) return false;
    const enemy=p.side===1?st.p2:st.p1, dx=p.dx,dy=p.dy;
    const d=norm(enemy.x-p.x,enemy.y-p.y);p.dx=d.x;p.dy=d.y;
    const distance=dist(p.x,p.y,enemy.x,enemy.y), angular=Math.abs(Math.atan2(d.y,d.x)-Math.atan2(dy,dx));
    const hits=clamp(Math.round(7-distance/95-angular*2),0,7), mult=C.MULTIPLIER[hits]||1;
    const startShells=s.shells,hpPercent=p.hp/Math.max(1,p.maxHp)*100;
    const rageRoll=forceDouble!=='counter'&&forceDouble!==true&&startShells>=2&&hpPercent<=50&&seededUnit(s)<clamp(.2+((50-hpPercent)/50)*.4,.2,.6);
    const double=forceDouble===true||rageRoll;
    if(hits>0){ const amount=hits*C.PELLET_DAMAGE*mult*.22; enemy.hp=Math.max(0,enemy.hp-amount); if(enemy.hp<=0){enemy.dead=true;st.winner=p;} }
    const beginSoloReload=()=>{s.reload=C.LONG_RELOAD_TIME;clearTimeout(s.reloadTimer);s.reloadTimer=setTimeout(()=>{s.reload=0;s.shells=6;s.hook=1;s.counter=1;},C.LONG_RELOAD_TIME*1000);};
    s.shells--;if(s.shells<=0)beginSoloReload();
    s.spinStart=st.clock;s.gunSpinAngle=0;s.shotMotion={startAt:st.clock,duration:C.SHOT_LOCK_TIME,x:p.x,y:p.y};
    st.projectiles.push({type:'solo_generic_burst',owner:p,x:enemy.x,y:enemy.y,life:.25,maxLife:.25,radius:45,damage:0,color:'#ff7b32',hit:true});
    if(double&&s.shells>0){s.shells--;const amount=hits*C.PELLET_DAMAGE*mult*.22;enemy.hp=Math.max(0,enemy.hp-amount);if(s.shells<=0)beginSoloReload();}
    return true;
  }
  function soloHook(st,p) {
    p.data.shotgun ||= {shells:6,reload:0,hook:1,counter:1,rngState:(0x51f15e5d^(p.side*2654435761))>>>0};
    const s=p.data.shotgun,e=p.side===1?st.p2:st.p1,centerDistance=dist(p.x,p.y,e.x,e.y);
    if(s.hook<=0||s.reload>0||s.shells<1||centerDistance<C.HOOK_MIN_RANGE||centerDistance>C.HOOK_MAX_RANGE)return false;
    const dir=norm(e.x-p.x,e.y-p.y);s.hook=0;p.dx=dir.x;p.dy=dir.y;
    const rangeT=clamp((centerDistance-C.HOOK_MIN_RANGE)/Math.max(1,C.HOOK_MAX_RANGE-C.HOOK_MIN_RANGE),0,1);
    const desiredCenterGap=lerp(225,300,rangeT);
    const totalClose=Math.max(0,centerDistance-desiredCenterGap);
    const dynamicDash=clamp(totalClose*.58,220,330);
    const dynamicPull=clamp(totalClose-dynamicDash,170,270);
    s.hookMotion={startAt:st.clock,target:e,shot:false,ownerStart:{x:p.x,y:p.y},targetStart:{x:e.x,y:e.y},
      ownerEnd:{x:clamp(p.x+dir.x*dynamicDash,p.radius,st.w-p.radius),y:clamp(p.y+dir.y*dynamicDash,p.radius,st.h-p.radius)},
      targetEnd:{x:clamp(e.x-dir.x*dynamicPull,e.radius,st.w-e.radius),y:clamp(e.y-dir.y*dynamicPull,e.radius,st.h-e.radius)}};
    const hookFx={type:'solo_web_line',owner:p,shotgunCable:true,x1:e.x,y1:e.y,x2:p.x,y2:p.y,hitCd:Infinity,life:1,maxLife:1};
    st.projectiles.push(hookFx);s.hookFx=hookFx;
    return true;
  }
  function soloCounter(st,p,attacker) {
    p.data.shotgun ||= {shells:6,reload:0,hook:1,counter:1,rngState:(0x51f15e5d^(p.side*2654435761))>>>0};
    const s=p.data.shotgun;
    if(!attacker||s.counter<=0||(s.counterGuardUntil||-1)>=st.clock||dist(p.x,p.y,attacker.x,attacker.y)>C.COUNTER_RANGE)return false;
    s.counter=0;s.counterGuardUntil=st.clock+.05;
    const dir=norm(attacker.x-p.x,attacker.y-p.y);p.dx=dir.x;p.dy=dir.y;
    clearTimeout(s.reloadTimer);s.reload=0;s.shells=Math.max(1,s.shells);
    soloFire(st,p,'counter');
    s.counterMotion={startAt:st.clock,duration:.42,startX:p.x,startY:p.y,
      endX:clamp(p.x-dir.x*C.COUNTER_RECOIL,p.radius,st.w-p.radius),endY:clamp(p.y-dir.y*C.COUNTER_RECOIL,p.radius,st.h-p.radius)};
    s.spinStart=st.clock;s.gunSpinAngle=0;
    s.shells=6;s.reload=0;s.hook=1;s.counter=1;
    return true;
  }
  function soloAdvanceMotion(st,p) {
    const s=p?.data?.shotgun;if(!s)return false;
    const enemy=p.side===1?st.p2:st.p1;
    if(enemy&&!enemy.dead&&!s.hookMotion&&!s.shotMotion){const d=norm(enemy.x-p.x,enemy.y-p.y);p.dx=d.x;p.dy=d.y;}
    if(s.spinStart==null)s.gunSpinAngle=0;else{const age=st.clock-s.spinStart,spinT=clamp((age-C.SHOT_SPIN_START)/(C.SHOT_SPIN_END-C.SHOT_SPIN_START),0,1);s.gunSpinAngle=age>=C.SHOT_SPIN_START&&age<C.SHOT_SPIN_END?(1-Math.pow(1-spinT,3))*TAU:0;}
    if(s.hookMotion){const h=s.hookMotion,age=st.clock-h.startAt,e=h.target;if(!e||e.dead){s.hookMotion=null;return false;}
      if(s.hookFx){s.hookFx.x1=e.x;s.hookFx.y1=e.y;}
      if(age>=C.HOOK_FLIGHT_TIME){const t=smoothstep(clamp((age-C.HOOK_FLIGHT_TIME)/(C.HOOK_PULL_END-C.HOOK_FLIGHT_TIME),0,1));p.x=lerp(h.ownerStart.x,h.ownerEnd.x,t);p.y=lerp(h.ownerStart.y,h.ownerEnd.y,t);e.x=lerp(h.targetStart.x,h.targetEnd.x,t);e.y=lerp(h.targetStart.y,h.targetEnd.y,t);}
      if(!h.shot&&age>=C.HOOK_SHOT_TIME){h.shot=true;soloFire(st,p,false);}
      if(age>=C.HOOK_LOCK_TIME){s.hookMotion=null;return false;}return true;}
    if(s.counterMotion){const m=s.counterMotion,t=smoothstep(clamp((st.clock-m.startAt)/m.duration,0,1));p.x=lerp(m.startX,m.endX,t);p.y=lerp(m.startY,m.endY,t);if(t>=1)s.counterMotion=null;else return true;}
    if(s.shotMotion){const m=s.shotMotion;if(st.clock-m.startAt<m.duration){p.x=m.x;p.y=m.y;return true;}s.shotMotion=null;}
    return false;
  }
  function soloUpdate(dt) {
    if(gameState!=='SOLO')return;const st=window.__solo375;
    for(const p of [st?.p1,st?.p2]){const s=p?.data?.shotgun;if(!s)continue;if(s.reload>0){s.reload=Math.max(0,s.reload-dt);if(s.reload===0)s.shells=6;}}
  }
  function drawSolo(ctx,p) {
    const s=p.data?.shotgun,img=images.body;if(img?.complete&&img.naturalWidth)ctx.drawImage(img,-48,-66,98,132);else drawSketchBlob(ctx,58,p.color||'#ff6238',10);
    drawImageFit(ctx,gunImage(s),42,0,25,100,-Math.PI/2+(s?.gunSpinAngle||0),1);
  }
  const previousFinalUpdate=update;
  update=function(dt){const result=previousFinalUpdate(dt);soloUpdate(dt);return result;};

  function selfTest() {
    const totals={};for(let n=1;n<=7;n++)totals[n]=n*C.PELLET_DAMAGE*C.MULTIPLIER[n];
    const expected=[10,16,22.5,28,32.5,36,38.5];
    const errors=[];
    expected.forEach((v,i)=>{if(Math.abs(totals[i+1]-v)>1e-9)errors.push(`damage-${i+1}`);});
    if(C.PELLET_COUNT!==7||C.CONE_DEGREES!==60||C.MAX_SHELLS!==6)errors.push('constants');
    if(Math.abs((.2+((50-25)/50)*.4)-.4)>1e-9)errors.push('rage-formula');
    const ray=rayCircle({x:0,y:0},{x:1,y:0},100,50,0,10);if(Math.abs(ray-40)>1e-9)errors.push('raycast');
    const hookOwner={x:0,y:0,radius:75,hp:1,data:{}},hookTarget={x:699,y:0,radius:75,hp:1,data:{}};
    if(validHookPath(hookOwner,hookTarget))errors.push('hook-too-close');hookTarget.x=700;if(!validHookPath(hookOwner,hookTarget))errors.push('hook-min-range');hookTarget.x=801;if(validHookPath(hookOwner,hookTarget))errors.push('hook-too-far');
    if(!FighterTypes.some(ft=>ft.name==='SHOTGUN'))errors.push('roster');
    return {ok:errors.length===0,errors,totals,constants:C,assets:FILES};
  }
  window.APEX_SHOTGUN={constants:C,files:FILES,audioFiles:AUDIO_FILES,images,audio,audioPools,vfx,state,ShotgunType,rageChance,validHookPath,resolveBatch,fireCycle,counterBlast,startCooling,playShotgunSound,soloFire,soloHook,soloCounter,soloAdvanceMotion,drawSolo,updateVfx,drawVfx,selfTest};
  window.FighterTypes=FighterTypes;window.apexFighterTypes=FighterTypes;
  Object.assign(window.apexReactBridge||{},{startSpecificMatch,goToMenu});
  if(document.getElementById('roster-grid')&&!document.getElementById('select-screen')?.classList.contains('hidden'))appendShotgunCard();
  console.info('[Apex Chaos] SHOTGUN champion integrated',selfTest());
})();
