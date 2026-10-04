// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_SOCCER_CHAMPION(){
  if (window.__apexSoccerChampion) return;
  window.__apexSoccerChampion = true;

  const SOCCER_POSSESSION = 'SOCCER_POSSESSION';
  const SOCCER_FREE_BALL = 'SOCCER_FREE_BALL';
  const SOCCER_SHOOT = 'soccer_shoot';
  const C = Object.freeze({
    POSSESSION_DURATION:10,
    GOAL_WIDTH_RATIO:.25,
    GOAL_TARGET_Y_RATIO:.055,
    PENALTY_SPOT_Y_RATIO:.40,
    PENALTY_BOX_WIDTH_RATIO:.40,
    PENALTY_BOX_DEPTH_RATIO:.25,
    HOME_DAMAGE_MULTIPLIER:.20,
    HOME_EFFECT_MULTIPLIER:.20,
    ENEMY_HALF_DODGE_CHANCE:.50,
    DODGE_SOURCE_COOLDOWN:.25,
    OPPONENT_HOME_SPEED_MULTIPLIER:.50,
    OPPONENT_HOME_COOLDOWN_MULTIPLIER:.50,
    GOAL_DRIVE_ALIGNMENT_HOLD:.08,
    GOAL_DRIVE_FIXED_DAMAGE:20,
    GOAL_DRIVE_MAX_CARRY_DAMAGE:20,
    PENALTY_BASE_DAMAGE:30,
    PENALTY_FOUL_DAMAGE_MULTIPLIER:2,
    POSSESSION_RECHARGE:1,
    FREE_BALL_NO_CATCH_DURATION:1,
    FREE_BALL_INTERCEPT_DELAY:10,
    TIMEOUT_RELEASE_SPEED_RATIO:.72,
    BALL_MAX_SPEED:2130,
    WALL_BOUNCE_SPEED_MULTIPLIER:1,
    OPPONENT_BOUNCE_SPEED_MULTIPLIER:1,
    FREE_BALL_MAX_DAMAGE:10,
    FREE_BALL_MAX_SLOW:1,
    FREE_BALL_SLOW_DURATION:.5,
    SAME_TARGET_HIT_COOLDOWN:.35,
    REACQUIRE_LOCKOUT:.25,
    CATCH_EXTRA_RADIUS:8,
    CHASE_DOWN_SPEED_MULTIPLIER:10,
    CHASE_DOWN_STUN:3,
    MOVE_FRAME_COUNT:4,
    MOVE_FPS:8,
    KICK_FRAME_COUNT:9,
    KICK_FPS:30,
    KICK_DURATION:.24,
    KICK_RELEASE_FRAME_INDEX:4,
    KICK_RELEASE_TIME:4/30,
    PENALTY_CHECK_FREEZE_DURATION:1,
    PENALTY_SKILL_DURATION:4,
    PENALTY_CONTACT_TIME:3.5,
    PENALTY_GOAL_IMPACT_TIME:4,
    PENALTY_CONTACT_SLOW_DURATION:.11,
    PENALTY_CONTACT_SLOW_SCALE:.08,
    PENALTY_BALL_SPEED_MULTIPLIER:1.18,
    PENALTY_RETICLE_SCAN_END:1.2,
    PENALTY_RUNUP_START:2.2,
    PENALTY_KICK_ANIM_START:3.5-(6/30)
  });
  const ROOT = '/assets/soccer_v1';
  const SOCCER_ASSET_REV = '20260620-green-update-1';
  const MOVE_FRAME_FILES = [1,2,3,4];
  const STATE = window.APEX_SOCCER = {
    constants:C,
    vfx:[],
    missing:new Set(),
    activeFreezeOwner:null,
    moveFrames:[],
    kickFrames:[],
    images:{},
    audio:{},
    audioPools:{},
    debug:{}
  };

  function loadImage(path, label) {
    const image = new Image();
    image.decoding = 'async';
    image.src = `${path}?v=${SOCCER_ASSET_REV}`;
    image.addEventListener('error', () => {
      if (!STATE.missing.has(path)) console.warn(`[SOCCER] Missing ${label}: ${path}`);
      STATE.missing.add(path);
    });
    return image;
  }
  for (const frame of MOVE_FRAME_FILES) STATE.moveFrames.push(loadImage(`${ROOT}/move/frame_${String(frame).padStart(3,'0')}.webp`, `move frame ${frame}`));
  for (let i=1;i<=C.KICK_FRAME_COUNT;i++) STATE.kickFrames.push(loadImage(`${ROOT}/kick/frame_${String(i).padStart(3,'0')}.webp`, `kick frame ${i}`));
  STATE.images.ball = loadImage(`${ROOT}/images/ball.webp`, 'ball');
  STATE.images.field = loadImage(`${ROOT}/images/field-overlay.webp`, 'field overlay');
  STATE.images.reticle = loadImage(`${ROOT}/images/penalty-reticle.webp`, 'penalty reticle');

  const AUDIO_PATHS = {
    bounce:`${ROOT}/audio/ball-bounce-hit.mp3`,
    hit:`${ROOT}/audio/ball-bounce-hit.mp3`,
    catch:`${ROOT}/audio/ball-catch.mp3`,
    ambience:`${ROOT}/audio/possession-ambience.mp3`,
    powerKick:`${ROOT}/audio/power-kick.mp3`,
    heavyImpact:`${ROOT}/audio/skill-impact.mp3`,
    goalImpact:`${ROOT}/audio/goal-impact.mp3`,
    penaltyActivation:`${ROOT}/audio/penalty-activation.mp3`,
    penaltyWhistle:`${ROOT}/audio/penalty-whistle.mp3`,
    chase:`${ROOT}/audio/chase-down.mp3`
  };
  for (const [key,path] of Object.entries(AUDIO_PATHS)) {
    const a = new Audio(path);
    a.preload = 'auto';
    a.volume = key === 'ambience' ? .32 : key === 'goalImpact' ? .72 : .58;
    registerBattleMediaElement(a);
    STATE.audio[key] = a;
    const poolSize = key === 'ambience' ? 1 : ['bounce','hit','heavyImpact'].includes(key) ? 5 : 3;
    STATE.audioPools[key] = [a];
    for (let i = 1; i < poolSize; i += 1) {
      const clone = a.cloneNode(true);
      clone.preload = 'auto';
      clone.volume = a.volume;
      registerBattleMediaElement(clone);
      STATE.audioPools[key].push(clone);
    }
  }
  function playSoccerAudio(key, opts={}) {
    if (window.__apexStatsSilent) return null;
    const base = STATE.audio[key];
    if (!base) return null;
    try {
      if (opts.loop) {
        base.loop = true;
        base.currentTime = 0;
        const p = base.play(); if (p?.catch) p.catch(()=>{});
        return base;
      }
      const pool = STATE.audioPools[key] || (STATE.audioPools[key] = [base]);
      let a = pool.find(item => item.paused || item.ended);
      if (!a && pool.length < 8) {
        a = base.cloneNode(true);
        a.preload = 'auto';
        registerBattleMediaElement(a);
        pool.push(a);
      }
      if (!a) return null;
      try { a.currentTime = 0; } catch (error) {}
      a.volume = opts.volume ?? base.volume;
      const p = a.play(); if (p?.catch) p.catch(()=>{});
      return a;
    } catch (error) { return null; }
  }
  function stopAmbience(f) {
    const a = f?.data?.soccerAmbience;
    if (a) { try { a.pause(); a.currentTime = 0; } catch (error) {} }
    if (f?.data) f.data.soccerAmbience = null;
  }
  function imageReady(image){ return !!(image && image.complete && image.naturalWidth); }
  function soccerOrangeBallImage(){
    if(STATE.images.orangeBall)return STATE.images.orangeBall;
    const source=STATE.images.ball;
    if(!imageReady(source))return source;
    const canvas=document.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;
    const c=canvas.getContext('2d');c.drawImage(source,0,0);
    c.globalCompositeOperation='source-atop';c.fillStyle='rgba(255,112,18,.78)';c.fillRect(0,0,canvas.width,canvas.height);
    c.globalCompositeOperation='source-over';c.globalAlpha=.34;c.drawImage(source,0,0);
    STATE.images.orangeBall=canvas;return canvas;
  }
  function live(f){ return !!(f && f.hp > 0); }
  function soccerEnemy(f){ return fighters.find(q => live(q) && q !== f && !q.data?.galaxyRemoved) || null; }
  function soccerFighters(){ return fighters.filter(f => live(f) && f.name === 'SOCCER'); }
  function soccerGoalBounds(side='top'){
    const width = GAME_SIZE * C.GOAL_WIDTH_RATIO;
    const center = GAME_SIZE / 2;
    const goalSide = side === 'bottom' ? 'bottom' : 'top';
    const targetY = goalSide === 'bottom' ? GAME_SIZE * (1 - C.GOAL_TARGET_Y_RATIO) : GAME_SIZE * C.GOAL_TARGET_Y_RATIO;
    return {min:center-width/2,max:center+width/2,width,center,targetY,side:goalSide};
  }
  function soccerPenaltyBoxContains(f){
    if (!f) return false;
    const g=soccerGoalBounds();
    const depth = GAME_SIZE * C.PENALTY_BOX_DEPTH_RATIO;
    return f.x>=g.min && f.x<=g.max && (f.y<=depth || f.y>=GAME_SIZE-depth);
  }
  function soccerHalf(f, previous='HOME') {
    if (!f) return previous;
    if (f.y < GAME_SIZE/2-4) return 'ENEMY';
    if (f.y > GAME_SIZE/2+4) return 'HOME';
    return previous;
  }
  function soccerFootAnchor(f, direction=null, dribble=true) {
    const d=direction || norm(f.data.soccerVisualForwardX||f.dir.x||0, f.data.soccerVisualForwardY||f.dir.y||-1);
    const side={x:-d.y,y:d.x};
    const wave=dribble ? Math.sin((f.data.soccerMoveAnimTime||0)*10.5) : 0;
    return {
      x:f.x+d.x*(f.radius*.91)+side.x*(f.radius*.20+wave*6),
      y:f.y+d.y*(f.radius*.91)+side.y*(f.radius*.20+wave*6)-f.radius*.20
    };
  }
  function soccerSetForward(f,x,y){
    const n=norm(x,y);
    if (Number.isFinite(n.x) && Number.isFinite(n.y) && Math.hypot(n.x,n.y)>.5) {
      f.data.soccerVisualForwardX=n.x; f.data.soccerVisualForwardY=n.y;
      f.data.soccerLastMoveDirectionX=n.x; f.data.soccerLastMoveDirectionY=n.y;
    }
  }
  function soccerMakeBall(f){
    const anchor=soccerFootAnchor(f,{x:0,y:-1});
    return {
      state:SOCCER_POSSESSION,x:anchor.x,y:anchor.y,vx:0,vy:0,speed:0,
      radius:33,visualScale:.48,collisionRadius:33,ownerId:f.id,lastReleaseTime:-99,
      freeFlightTime:0,
      hasLeftOwnerRadius:false,sameTargetHitCooldown:{},skillShot:null,
      damageArmed:false,lastSoccerTouchKind:null,
      goalDriveSpent:false,lastWallSoundAt:-99,ownerContactActive:false,
      opponentContactActive:false,trail:[]
    };
  }
  function soccerClearOpponentLocks(f){
    const e=fighters.find(q => q && q !== f);
    if (!e) return;
    if (e.statuses?.soccerPenaltyLock?.source === f) delete e.statuses.soccerPenaltyLock;
    if (e.statuses?.soccerChaseStun?.source === f) delete e.statuses.soccerChaseStun;
    if (e.statuses?.stun?.source === f && e.statuses.stun.soccerChase) delete e.statuses.stun;
    e.data.soccerForcedBy = null;
    e.data.positionLocked = false;
  }
  function soccerExitPossession(f, reason='exit') {
    if (!f?.data) return;
    const d=f.data;
    d.soccerPossessionActive=false;
    d.soccerFieldOverlayActive=false;
    d.soccerFieldFade=Math.max(d.soccerFieldFade||0,1);
    d.soccerHomeResistanceActive=false;
    d.soccerEnemyHalfDodgeActive=false;
    d.soccerOpponentHomeDebuffActive=false;
    d.soccerGoalDriveAlignmentValid=false;
    d.soccerGoalDriveAlignmentHoldTimer=0;
    d.soccerCurrentGoalTargetPoint=null;
    d.soccerLastGoalDriveGeometry=null;
    d.soccerLastGoalDriveReadyAt=-99;
    d.soccerPossessionCooldown=Math.max(d.soccerPossessionCooldown||0,C.POSSESSION_RECHARGE);
    stopAmbience(f);
    d.soccerLastStateTransition=`POSSESSION -> ${reason}`;
  }
  function soccerClearFreeBallRecovery(f) {
    if (!f?.data) return;
    const d=f.data,b=d.soccerBall;
    d.soccerFreeBallStartedAt=-99;
    d.soccerFreeBallCatchReadyAt=-99;
    d.soccerHealKickAvailable=false;
    d.soccerActiveHealKickId=null;
    d.soccerFreeKickHealUntil=0;
    if (b) { b.healKickId=null; b.healWindowUntil=0; b.healResolved=true; }
  }
  function soccerOpenFreeBallRecovery(f, reason='skill_freeball') {
    if (!f?.data) return;
    const d=f.data;
    d.soccerFreeBallStartedAt=matchClock;
    d.soccerFreeBallCatchReadyAt=matchClock+C.FREE_BALL_NO_CATCH_DURATION;
    d.soccerHealKickAvailable=true;
    d.soccerActiveHealKickId=null;
    d.soccerFreeKickHealUntil=0;
    d.soccerLastFreeBallRecoveryReason=reason;
  }
  function soccerFreeBallCatchReady(f,b) {
    if (!f?.data || !b?.hasLeftOwnerRadius) return false;
    const readyAt=f.data.soccerFreeBallCatchReadyAt;
    return b.freeFlightTime>=C.FREE_BALL_NO_CATCH_DURATION || (Number.isFinite(readyAt) && readyAt>0 && matchClock>=readyAt);
  }
  function soccerRecoverPossessionFromFreeBall(f, reason) {
    if (!f?.data) return false;
    f.data.soccerPossessionCooldown=0;
    return soccerEnterPossession(f, reason);
  }
  function soccerArmHealKick(f,b) {
    const d=f.data;
    const id=(d.soccerHealKickSerial||0)+1;
    d.soccerHealKickSerial=id;
    d.soccerActiveHealKickId=id;
    d.soccerHealKickAvailable=false;
    d.soccerFreeKickHealUntil=matchClock+1;
    b.healKickId=id;
    b.healWindowUntil=d.soccerFreeKickHealUntil;
    b.healResolved=false;
  }
  function soccerEnterPossession(f, reason='round_start') {
    const e=soccerEnemy(f);
    if (!live(f) || !live(e) || f.data.soccerPenaltyCinematicActive || gameState==='END') return false;
    const d=f.data;
    if (reason!=='round_start' && (d.soccerPossessionCooldown||0)>0) return false;
    d.soccerBall ||= soccerMakeBall(f);
    const b=d.soccerBall;
    b.state=SOCCER_POSSESSION; b.vx=0; b.vy=0; b.speed=0; b.skillShot=null; b.damageArmed=false; b.lastSoccerTouchKind=null;
    b.goalDriveSpent=false; b.sameTargetHitCooldown={}; b.hasLeftOwnerRadius=false;
    b.ownerContactActive=false;b.opponentContactActive=false;b.trail=[];
    const anchor=soccerFootAnchor(f); b.x=anchor.x; b.y=anchor.y;
    d.soccerState=SOCCER_POSSESSION;
    d.soccerPossessionTimer=C.POSSESSION_DURATION;
    d.soccerPossessionActive=true;
    d.soccerFieldOverlayActive=true;
    d.soccerFieldReveal=0;
    d.soccerFieldFade=0;
    d.soccerPenaltyUsedThisPossession=false;
    d.soccerShotResolving=false;
    d.soccerGoalDriveActive=false;
    d.soccerCarryActive=false;
    d.soccerChaseDownActive=false;
    d.soccerChaseDownHasStunnedOpponent=false;
    d.soccerGoalDriveAlignmentValid=false;
    d.soccerGoalDriveAlignmentHoldTimer=0;
    d.soccerLastGoalDriveGeometry=null;
    d.soccerLastGoalDriveReadyAt=-99;
    d.soccerPossessionCooldown=0;
    soccerClearFreeBallRecovery(f);
    STATE.vfx.length=0;
    d.soccerLastStateTransition=`${reason} -> POSSESSION`;
    stopAmbience(f);
    d.soccerAmbience=playSoccerAudio('ambience',{loop:true});
    return true;
  }
  function soccerInit(f){
    f.radius=f.baseRadius=72;
    f.data.soccerBall=soccerMakeBall(f);
    Object.assign(f.data,{
      soccerState:SOCCER_POSSESSION,soccerPossessionTimer:C.POSSESSION_DURATION,
      soccerPossessionActive:true,soccerShotResolving:false,soccerGoalDriveActive:false,
      soccerPenaltyActive:false,soccerPenaltyCheckFreezeActive:false,
      soccerPenaltyCinematicActive:false,soccerPenaltySkillTime:0,
      soccerPenaltyUsedThisPossession:false,soccerChaseDownActive:false,
      soccerChaseDownHasStunnedOpponent:false,soccerFieldOverlayActive:true,
      soccerFieldReveal:0,soccerFieldFade:0,soccerHomeResistanceActive:false,
      soccerEnemyHalfDodgeActive:false,soccerOpponentHomeDebuffActive:false,
      soccerGoalDriveAlignmentValid:false,soccerGoalDriveAlignmentHoldTimer:0,
      soccerCarryActive:false,soccerCarryDistance:0,soccerMoveAnimTime:0,
      soccerKickAnimTime:0,soccerCurrentKickType:null,soccerVisualForwardX:0,
      soccerVisualForwardY:-1,soccerLastMoveDirectionX:0,soccerLastMoveDirectionY:-1,
      soccerAiRetarget:0,soccerLastStateTransition:'initialized',soccerLastDebugReason:'round_start',
      soccerDodgeBySource:{},soccerCurrentMoveFrame:0,soccerCurrentKickFrame:-1,
      soccerPossessionCooldown:0,soccerGhostTimer:0,soccerMoveFrameAccumulator:0,
      soccerMoveFrameBlend:0,soccerMovementActive:false,soccerCooldownKickTimer:0,
      soccerFreeBallStartedAt:-99,soccerFreeBallCatchReadyAt:-99,soccerHealKickAvailable:false,
      soccerHealKickSerial:0,soccerActiveHealKickId:null,soccerFreeKickHealUntil:0,
      soccerBuffGhostTimer:0,soccerLastGoalDriveGeometry:null,soccerLastGoalDriveReadyAt:-99
    });
  }
  function soccerReleaseBall(f, direction, speed, reason, skillShot=null) {
    const d=f.data,b=d.soccerBall,n=norm(direction.x,direction.y);
    const shotTarget=d.soccerCurrentGoalTargetPoint ? {...d.soccerCurrentGoalTargetPoint} : null;
    soccerExitPossession(f,reason);
    const anchor=skillShot===SOCCER_SHOOT
      ? {x:clamp(f.x+n.x*(f.radius+b.radius+4),b.radius,GAME_SIZE-b.radius),y:clamp(f.y+n.y*(f.radius+b.radius+4),b.radius,GAME_SIZE-b.radius)}
      : soccerFootAnchor(f,n,false);
    Object.assign(b,{state:SOCCER_FREE_BALL,x:anchor.x,y:anchor.y,vx:n.x*speed,vy:n.y*speed,speed,
      lastReleaseTime:matchClock,hasLeftOwnerRadius:false,sameTargetHitCooldown:{},skillShot,
      damageArmed:skillShot===SOCCER_SHOOT,
      lastSoccerTouchKind:'kick',
      goalDriveSpent:false,ownerContactActive:false,opponentContactActive:false,visualScale:.54,
      freeFlightTime:0,
      goalDriveOrigin:skillShot===SOCCER_SHOOT?{x:anchor.x,y:anchor.y}:null,
      goalDriveDirection:skillShot===SOCCER_SHOOT?{x:n.x,y:n.y}:null,
      goalDriveTargetId:skillShot===SOCCER_SHOOT?soccerEnemy(f)?.id:null});
    d.soccerState=SOCCER_FREE_BALL;
    d.soccerCurrentShotDirection={x:n.x,y:n.y};
    if (skillShot===SOCCER_SHOOT) d.soccerCurrentGoalTargetPoint=shotTarget;
    b.trail=[];
    if (skillShot===SOCCER_SHOOT) soccerOpenFreeBallRecovery(f,'shoot_release');
  }
  function soccerRayToGoal(f,dx,dy){
    const len=Math.hypot(dx,dy);
    const fallbackGoal=soccerGoalBounds(dy > 0 ? 'bottom' : 'top');
    if (len<=.001) return {valid:false,xAtTop:null,xAtGoal:null,...fallbackGoal};
    const dir={x:dx/len,y:dy/len};
    if (Math.abs(dir.y)<.12) return {valid:false,xAtTop:null,xAtGoal:null,...fallbackGoal};
    const g=soccerGoalBounds(dir.y > 0 ? 'bottom' : 'top');
    const t=(g.targetY-f.y)/dir.y;
    if (!(t>0)) return {valid:false,xAtTop:null,xAtGoal:null,...g};
    const xAtGoal=f.x+dir.x*t;
    const valid=xAtGoal>=g.min && xAtGoal<=g.max;
    return {valid,xAtTop:xAtGoal,xAtGoal,...g,target:{x:clamp(xAtGoal,g.min,g.max),y:g.targetY,goalSide:g.side},dir};
  }
  function soccerGoalGeometry(f,e){
    const g=soccerGoalBounds();
    if (!live(e)) return {valid:false,xAtTop:null,...g};
    const enemyRay=soccerRayToGoal(f,e.x-f.x,e.y-f.y);
    const enemySeparated=dist(f.x,f.y,e.x,e.y) > Math.max(8, Math.min(f.radius,e.radius) * .08);
    if (enemySeparated && enemyRay.valid) return {...enemyRay,aimMode:'opponent_line'};
    const forwardRay=soccerRayToGoal(f,f.data.soccerVisualForwardX||f.dir.x||0,f.data.soccerVisualForwardY||f.dir.y||-1);
    if (!forwardRay.valid) return {...enemyRay,valid:false,fallbackValid:false,aimMode:'no_lane'};
    return {
      ...enemyRay,
      valid:false,
      fallbackValid:true,
      fallbackTarget:{x:clamp(forwardRay.xAtGoal,forwardRay.min+18,forwardRay.max-18),y:forwardRay.targetY,goalSide:forwardRay.side},
      fallbackDir:forwardRay.dir,
      aimMode:'goal_fallback'
    };
  }
  function soccerReleaseAim(f,e){
    const liveGeometry=soccerGoalGeometry(f,e);
    const g=soccerGoalBounds(f.data?.soccerCurrentGoalTargetPoint?.goalSide);
    const target=liveGeometry.valid
      ? liveGeometry.target
      : f.data?.soccerCurrentGoalTargetPoint
        ? {...f.data.soccerCurrentGoalTargetPoint}
      : liveGeometry.fallbackValid
        ? liveGeometry.fallbackTarget
      : {x:clamp(f.x,g.min+18,g.max-18),y:g.targetY,goalSide:g.side};
    return {target,dir:norm(target.x-f.x,target.y-f.y),mode:liveGeometry.aimMode==='opponent_line'?'opponent_line':'goal_fallback'};
  }
  function soccerCloneGoalGeometry(geometry) {
    if (!geometry) return null;
    return {
      ...geometry,
      target: geometry.target ? {...geometry.target} : null,
      dir: geometry.dir ? {...geometry.dir} : null,
      fallbackTarget: geometry.fallbackTarget ? {...geometry.fallbackTarget} : null,
      fallbackDir: geometry.fallbackDir ? {...geometry.fallbackDir} : null
    };
  }
  function soccerStartGoalDrive(f,e,geometry){
    const d=f.data;
    const target = geometry?.target || d.soccerCurrentGoalTargetPoint;
    if (!target) return;
    d.soccerShotResolving=true; d.soccerGoalDriveActive=true;
    d.soccerCurrentKickType='shoot'; d.soccerKickAnimTime=0;
    d.soccerKickReleased=false; d.soccerCurrentGoalTargetPoint={...target};
    d.soccerCurrentShotDirection=norm(target.x-f.x,target.y-f.y);
    d.soccerShotLockTarget={...target};
    d.soccerShotLockDir={...d.soccerCurrentShotDirection};
    if (e) {
      e.data.soccerShootLockedBy=f.id;
      e.data.positionLocked=true;
    }
    soccerSetForward(f,d.soccerCurrentShotDirection.x,d.soccerCurrentShotDirection.y);
    f.data.positionLocked=true;
    d.soccerLastStateTransition='alignment -> SHOOT';
    recordSkill(f);
  }
  function soccerUpdateGoalDrive(f,e,dt){
    const d=f.data;
    d.soccerKickAnimTime+=dt;
    d.soccerCurrentKickFrame=Math.min(8,Math.floor(d.soccerKickAnimTime*C.KICK_FPS));
    f.data.positionLocked=true;
    if (e && e.data?.soccerShootLockedBy===f.id) e.data.positionLocked=true;
    if (!d.soccerKickReleased && d.soccerKickAnimTime>=C.KICK_RELEASE_TIME) {
      d.soccerKickReleased=true;
      const releaseAim=soccerReleaseAim(f,e);
      d.soccerCurrentGoalTargetPoint=releaseAim.target;
      d.soccerCurrentShotDirection=releaseAim.dir;
      d.soccerLastShootAimMode=releaseAim.mode;
      soccerSetForward(f,releaseAim.dir.x,releaseAim.dir.y);
      playSoccerAudio('powerKick',{volume:.72});
      soccerReleaseBall(f,d.soccerCurrentShotDirection,C.BALL_MAX_SPEED,'shoot_release',SOCCER_SHOOT);
    }
    if (d.soccerKickAnimTime>=C.KICK_DURATION) {
      d.soccerGoalDriveActive=false; d.soccerShotResolving=false;
      d.soccerCurrentKickType=null; d.soccerCurrentKickFrame=-1;
    }
  }
  function soccerStartChase(f){
    const d=f.data;
    if (d.soccerChaseDownActive) return;
    const b=d.soccerBall;
    const speed=f.baseSpeed*C.CHASE_DOWN_SPEED_MULTIPLIER;
    let intercept=null;
    for(let t=.04;t<=3;t+=.04){
      const p=soccerPredictBallPosition(b,t);
      if(dist(f.x,f.y,p.x,p.y)<=speed*t){intercept={...p,time:t};break;}
    }
    intercept ||= soccerPredictBallPosition(b,3);
    const n=norm(intercept.x-f.x,intercept.y-f.y);
    d.soccerChaseDownActive=true; d.soccerChaseDownHasStunnedOpponent=false;
    d.soccerChaseTarget={x:intercept.x,y:intercept.y};
    d.soccerChaseDirection={x:n.x,y:n.y};
    d.soccerState='SOCCER_CHASE_DOWN';
    d.soccerLastStateTransition='FREE BALL 10s -> INTERCEPT';
    playSoccerAudio('chase',{volume:.65});
  }
  function soccerReflectAxis(position,velocity,time,min,max){
    const span=max-min,cycle=span*2;
    let value=((position-min)+velocity*time)%cycle;
    if(value<0)value+=cycle;
    return min+(value<=span?value:cycle-value);
  }
  function soccerPredictBallPosition(b,time){
    return {
      x:soccerReflectAxis(b.x,b.vx,time,b.radius,GAME_SIZE-b.radius),
      y:soccerReflectAxis(b.y,b.vy,time,b.radius,GAME_SIZE-b.radius)
    };
  }
  function soccerUpdateChase(f,e,dt){
    const d=f.data,b=d.soccerBall;
    const target=d.soccerChaseTarget||{x:b.x,y:b.y};
    const n=d.soccerChaseDirection||norm(target.x-f.x,target.y-f.y);
    const distance=dist(f.x,f.y,target.x,target.y);
    soccerSetForward(f,n.x,n.y); f.setDir(n.x,n.y); f.data.positionLocked=true;
    const step=Math.min(distance,f.baseSpeed*C.CHASE_DOWN_SPEED_MULTIPLIER*dt);
    const old={x:f.x,y:f.y};
    f.x=clamp(f.x+n.x*step,f.radius,GAME_SIZE-f.radius);
    f.y=clamp(f.y+n.y*step,f.radius,GAME_SIZE-f.radius);
    d.soccerGhostTimer=(d.soccerGhostTimer||0)-dt;
    if(d.soccerGhostTimer<=0){
      d.soccerGhostTimer=.035;
      STATE.vfx.push({type:'dash_ghost',x:old.x,y:old.y,dir:{x:n.x,y:n.y},life:.34,maxLife:.34,ownerId:f.id});
    }
    if (!d.soccerChaseDownHasStunnedOpponent && e && distToSegment(e.x,e.y,old.x,old.y,f.x,f.y)<=e.radius+f.radius*.7) {
      d.soccerChaseDownHasStunnedOpponent=true;
      const sideA={x:-n.y,y:n.x},sideB={x:n.y,y:-n.x};
      const roomA=Math.min(e.x*sideA.x+(GAME_SIZE-e.x)*Math.max(0,sideA.x),e.y*sideA.y+(GAME_SIZE-e.y)*Math.max(0,sideA.y));
      const side=roomA>0?sideA:sideB;
      e.applyStatus('soccerChaseStun',C.CHASE_DOWN_STUN,{source:f});
      e.applyStatus('stun',C.CHASE_DOWN_STUN,{source:f,soccerChase:true});
      e.x=clamp(e.x+side.x*120,e.radius,GAME_SIZE-e.radius);
      e.y=clamp(e.y+side.y*120,e.radius,GAME_SIZE-e.radius);
      playSoccerAudio('heavyImpact',{volume:.68});
    }
    const catchRadius=f.radius+b.radius+C.CATCH_EXTRA_RADIUS;
    if (distToSegment(b.x,b.y,old.x,old.y,f.x,f.y)<=catchRadius) {
      d.soccerChaseDownActive=false; d.soccerChaseDownHasStunnedOpponent=false;
      playSoccerAudio('catch',{volume:.64}); soccerEnterPossession(f,'chase_down_recovery');
    } else if(distance<=step+2) {
      d.soccerChaseDownActive=false;
      soccerStartChase(f);
    }
  }
  function soccerBallWallBounce(f,b,side,speedRatio){
    b.damageArmed=false;
    b.lastSoccerTouchKind='wall';
    if(b.skillShot===SOCCER_SHOOT){
      b.skillShot=null;b.goalDriveTargetId=null;b.goalDriveDirection=null;b.goalDriveOrigin=null;
      const e=soccerEnemy(f);
      if (e?.data?.soccerShootLockedBy===f.id) { e.data.soccerShootLockedBy=null; e.data.positionLocked=false; }
      f.data.soccerShotResolving=false;
      f.data.soccerLastDebugReason='shoot_missed_wall';
    }
    if (matchClock-(b.lastWallSoundAt||-99)>.12) { playSoccerAudio('bounce',{volume:.28+.28*speedRatio}); b.lastWallSoundAt=matchClock; }
  }
  function soccerStartCarry(f,e,b){
    const d=f.data;
    const goalSide=d.soccerCurrentGoalTargetPoint?.goalSide === 'bottom' ? 'bottom' : 'top';
    const g=soccerGoalBounds(goalSide);
    d.soccerCarryActive=true; d.soccerCarryStartX=e.x; d.soccerCarryStartY=e.y; d.soccerCarryDistance=0;
    d.soccerCarryGoalSide=goalSide;
    d.soccerCarryTargetX=clamp(d.soccerCurrentGoalTargetPoint?.x ?? e.x,g.min,g.max);
    d.soccerCarryTargetY=goalSide === 'bottom' ? GAME_SIZE - e.radius : e.radius;
    e.data.soccerForcedBy=f.id;
    if (e.data.soccerShootLockedBy===f.id) e.data.soccerShootLockedBy=null;
    b.goalDriveSpent=true;
    b.damageArmed=false;
    playSoccerAudio('heavyImpact',{volume:.82});
    cameraShake=Math.max(cameraShake,14);
  }
  function soccerUpdateCarry(f,e,dt){
    const d=f.data,b=d.soccerBall;
    if (!live(e)) { d.soccerCarryActive=false; b.skillShot=null; return; }
    const target={x:d.soccerCarryTargetX,y:d.soccerCarryTargetY};
    const n=norm(target.x-e.x,target.y-e.y),distance=dist(e.x,e.y,target.x,target.y);
    const step=Math.min(distance,C.BALL_MAX_SPEED*.78*dt);
    e.x=clamp(e.x+n.x*step,e.radius,GAME_SIZE-e.radius); e.y=clamp(e.y+n.y*step,e.radius,GAME_SIZE-e.radius);
    e.data.positionLocked=true; e.data.soccerForcedBy=f.id;
    b.x=e.x-n.x*(e.radius*.35); b.y=e.y-n.y*(e.radius*.35); b.vx=n.x*C.BALL_MAX_SPEED; b.vy=n.y*C.BALL_MAX_SPEED;
    d.soccerCarryDistance+=step;
    if (distance<=step+2) {
      const dmg=C.GOAL_DRIVE_FIXED_DAMAGE+C.GOAL_DRIVE_MAX_CARRY_DAMAGE*clamp(d.soccerCarryDistance/GAME_SIZE,0,1);
      e.takeDamage(dmg,f,'soccer-goal-drive');
      playSoccerAudio('goalImpact',{volume:.8});
      cameraShake=Math.max(cameraShake,18);
      d.soccerCarryActive=false; d.soccerShotResolving=false; e.data.soccerForcedBy=null;
      b.skillShot=null; b.damageArmed=false; b.state=SOCCER_FREE_BALL; b.speed=C.BALL_MAX_SPEED*.65;
      const bottomGoal=d.soccerCarryGoalSide === 'bottom';
      b.vx=0; b.vy=bottomGoal ? -b.speed : b.speed; b.x=target.x;
      b.y=bottomGoal ? GAME_SIZE - e.radius - b.radius - 4 : e.radius + b.radius + 4;
      d.soccerCarryGoalSide=null;
      soccerOpenFreeBallRecovery(f,'shoot_impact');
      d.soccerLastStateTransition='SHOOT impact -> FREE BALL';
    }
  }
  function soccerNormalBallHit(f,e,b,speedRatio){
    const preservedSpeed=Math.max(1,b.speed);
    const cd=b.sameTargetHitCooldown[e.id]||0;
    if (b.damageArmed && b.lastSoccerTouchKind === 'kick' && cd<=0 && speedRatio>0) {
      const cooldownKick=b.skillShot==='soccer_cooldown_kick';
      const before=e.hp;
      e.takeDamage(C.FREE_BALL_MAX_DAMAGE*speedRatio,f,'soccer-kick-impact');
      const dealt=Math.max(0,before-e.hp);
      const healWindowUntil=b.healWindowUntil || f.data.soccerFreeKickHealUntil || 0;
      if(cooldownKick&&dealt>0&&!b.healResolved&&matchClock<=healWindowUntil){
        const heal=dealt*.5;
        f.heal(heal,false);
        b.healResolved=true;
        f.data.soccerActiveHealKickId=null;
        f.data.soccerFreeKickHealUntil=0;
        floatingTexts.push(new FloatingText(f.x,f.y-f.radius-78,`+${heal.toFixed(1)}`,'#7dffbc'));
      }
      e.applyStatus('slow',C.FREE_BALL_SLOW_DURATION,{mult:clamp(1-C.FREE_BALL_MAX_SLOW*speedRatio,0,1),source:f});
      b.sameTargetHitCooldown[e.id]=C.SAME_TARGET_HIT_COOLDOWN;
      b.damageArmed=false;
      playSoccerAudio(cooldownKick?'heavyImpact':'hit',{volume:cooldownKick ? .70 : .30+.30*speedRatio});
      if(cooldownKick)b.skillShot=null;
    }
    let n=norm(b.x-e.x,b.y-e.y);
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.hypot(n.x,n.y)<.5) n=norm(-b.vx,-b.vy);
    const dot=b.vx*n.x+b.vy*n.y;
    if(dot<0){
      b.vx=(b.vx-2*dot*n.x)*C.OPPONENT_BOUNCE_SPEED_MULTIPLIER;
      b.vy=(b.vy-2*dot*n.y)*C.OPPONENT_BOUNCE_SPEED_MULTIPLIER;
    }
    const reflected=norm(b.vx,b.vy);
    b.speed=preservedSpeed;b.vx=reflected.x*preservedSpeed;b.vy=reflected.y*preservedSpeed;
    b.x=e.x+n.x*(e.radius+b.radius+2); b.y=e.y+n.y*(e.radius+b.radius+2);
    b.opponentContactActive=true;
  }
  STATE.qaNormalBallHit=soccerNormalBallHit;
  function soccerBounceOffOwner(f,b){
    const preservedSpeed=Math.max(1,b.speed);
    let n=norm(b.x-f.x,b.y-f.y);
    if(!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.hypot(n.x,n.y)<.5)n=norm(-b.vx,-b.vy);
    const dot=b.vx*n.x+b.vy*n.y;
    if(dot<0){
      b.vx=(b.vx-2*dot*n.x)*C.OPPONENT_BOUNCE_SPEED_MULTIPLIER;
      b.vy=(b.vy-2*dot*n.y)*C.OPPONENT_BOUNCE_SPEED_MULTIPLIER;
    }else{
      b.vx=n.x*Math.max(b.speed,C.BALL_MAX_SPEED*.12);
      b.vy=n.y*Math.max(b.speed,C.BALL_MAX_SPEED*.12);
    }
    const reflected=norm(b.vx,b.vy);
    b.speed=preservedSpeed;b.vx=reflected.x*preservedSpeed;b.vy=reflected.y*preservedSpeed;
    const fighterClosing=f.dir.x*n.x+f.dir.y*n.y;
    if(fighterClosing>0)f.dir=reflectDir(f.dir,-n.x,-n.y);
    const gap=f.radius+b.radius+3;
    b.x=clamp(f.x+n.x*gap,b.radius,GAME_SIZE-b.radius);
    b.y=clamp(f.y+n.y*gap,b.radius,GAME_SIZE-b.radius);
    const separated=dist(f.x,f.y,b.x,b.y);
    if(separated<gap-1){
      const correction=gap-separated+2;
      f.x=clamp(f.x-n.x*correction,f.radius,GAME_SIZE-f.radius);
      f.y=clamp(f.y-n.y*correction,f.radius,GAME_SIZE-f.radius);
      b.x=clamp(f.x+n.x*gap,b.radius,GAME_SIZE-b.radius);
      b.y=clamp(f.y+n.y*gap,b.radius,GAME_SIZE-b.radius);
    }
    b.ownerContactActive=true;
  }
  function soccerKickFreeBallAtEnemy(f,e,b,reason='early_freeball_recovery'){
    if(!f||!b||!live(e))return false;
    const d=f.data;
    if(matchClock<(d.soccerEarlyKickLockUntil||0))return true;
    if(soccerFreeBallCatchReady(f,b)){
      playSoccerAudio('catch',{volume:.64});
      return soccerRecoverPossessionFromFreeBall(f,`${reason}_after_5s`);
    }
    if(d.soccerHealKickAvailable!==true)return false;
    const n=norm(e.x-f.x,e.y-f.y);
    const speed=C.BALL_MAX_SPEED*.96;
    const start=soccerFootAnchor(f,n,false);
    Object.assign(b,{
      state:SOCCER_FREE_BALL,
      x:clamp(start.x,b.radius,GAME_SIZE-b.radius),
      y:clamp(start.y,b.radius,GAME_SIZE-b.radius),
      vx:n.x*speed,
      vy:n.y*speed,
      speed,
      skillShot:'soccer_cooldown_kick',
      damageArmed:true,
      lastSoccerTouchKind:'kick',
      ownerContactActive:true,
      opponentContactActive:false,
      hasLeftOwnerRadius:false,
      lastReleaseTime:matchClock,
      freeFlightTime:0,
      trail:[]
    });
    soccerArmHealKick(f,b);
    d.soccerPossessionActive=false;
    d.soccerState=SOCCER_FREE_BALL;
    d.soccerCooldownKickTimer=1;
    d.soccerEarlyKickLockUntil=matchClock+.35;
    d.soccerLastStateTransition=`FREE BALL ${reason} -> HEAL KICK`;
    soccerSetForward(f,n.x,n.y);
    playSoccerAudio('powerKick',{volume:.62});
    return true;
  }
  function soccerSweptCircleHit(oldX,oldY,newX,newY,target,radius){
    const sx=newX-oldX,sy=newY-oldY,l2=sx*sx+sy*sy;
    if(l2<=.0001)return null;
    const t=clamp(((target.x-oldX)*sx+(target.y-oldY)*sy)/l2,0,1);
    const px=oldX+sx*t,py=oldY+sy*t;
    return dist(px,py,target.x,target.y)<=radius?{t,x:px,y:py}:null;
  }
  function soccerUpdateBall(f,e,dt){
    const d=f.data,b=d.soccerBall;
    if (!b) return;
    if (e?.data?.soccerShootLockedBy===f.id) {
      if (b.skillShot===SOCCER_SHOOT && !b.goalDriveSpent) e.data.positionLocked=true;
      else { e.data.soccerShootLockedBy=null; e.data.positionLocked=false; }
    }
    if (![b.x,b.y,b.vx,b.vy,b.speed].every(Number.isFinite)) {
      const safe=soccerFootAnchor(f,null,false);
      Object.assign(b,{state:SOCCER_FREE_BALL,x:clamp(safe.x,b.radius,GAME_SIZE-b.radius),
        y:clamp(safe.y,b.radius,GAME_SIZE-b.radius),vx:0,vy:0,speed:0,skillShot:null,damageArmed:false,lastSoccerTouchKind:null,
        ownerContactActive:false,opponentContactActive:false,hasLeftOwnerRadius:true,trail:[],freeFlightTime:0});
      d.soccerCarryActive=false;d.soccerShotResolving=false;d.soccerState=SOCCER_FREE_BALL;
      return;
    }
    for (const id of Object.keys(b.sameTargetHitCooldown||{})) b.sameTargetHitCooldown[id]=Math.max(0,b.sameTargetHitCooldown[id]-dt);
    if (b.state===SOCCER_POSSESSION) {
      const anchor=soccerFootAnchor(f); b.x=anchor.x; b.y=anchor.y; b.vx=0;b.vy=0;b.speed=0;b.trail=[];b.freeFlightTime=0; return;
    }
    if (d.soccerCarryActive) { soccerUpdateCarry(f,e,dt); return; }
    if(!d.soccerChaseDownActive&&!d.soccerPenaltyCinematicActive)d.soccerState=SOCCER_FREE_BALL;
    b.freeFlightTime=Math.max(0,(b.freeFlightTime||0)+dt);
    if(b.speed<=0){
      const fallback=norm(b.vx||f.dir.x||1,b.vy||f.dir.y||0);
      b.speed=C.BALL_MAX_SPEED*C.TIMEOUT_RELEASE_SPEED_RATIO;
      b.vx=fallback.x*b.speed;b.vy=fallback.y*b.speed;
    }
    const travel=b.speed*dt;
    const steps=Math.max(1,Math.ceil(travel/24));
    const sub=dt/steps;
    for(let i=0;i<steps;i++) {
      const old={x:b.x,y:b.y}; b.x+=b.vx*sub; b.y+=b.vy*sub;
      let bounced=false;
      const preservedSpeed=b.speed;
      if (b.x-b.radius<0) { b.x=b.radius; b.vx=Math.abs(b.vx); bounced=true; }
      else if (b.x+b.radius>GAME_SIZE) { b.x=GAME_SIZE-b.radius; b.vx=-Math.abs(b.vx); bounced=true; }
      if (b.y-b.radius<0) { b.y=b.radius; b.vy=Math.abs(b.vy); bounced=true; }
      else if (b.y+b.radius>GAME_SIZE) { b.y=GAME_SIZE-b.radius; b.vy=-Math.abs(b.vy); bounced=true; }
      if(bounced){const reflected=norm(b.vx,b.vy);b.vx=reflected.x*preservedSpeed;b.vy=reflected.y*preservedSpeed;b.speed=preservedSpeed;}
      if (bounced) soccerBallWallBounce(f,b,'wall',clamp(b.speed/C.BALL_MAX_SPEED,0,1));
      const ownerDistance=dist(f.x,f.y,b.x,b.y);
      if(ownerDistance>f.radius+b.radius+7)b.ownerContactActive=false;
      if(ownerDistance>f.radius+b.radius+4)b.hasLeftOwnerRadius=true;
      const ownerHit=b.hasLeftOwnerRadius
        ? soccerSweptCircleHit(old.x,old.y,b.x,b.y,f,f.radius+b.radius)
          || (ownerDistance<=f.radius+b.radius?{t:1,x:b.x,y:b.y}:null)
        : null;
      if(ownerHit&&!b.ownerContactActive){
        const canCatch=soccerFreeBallCatchReady(f,b);
        b.x=ownerHit.x;b.y=ownerHit.y;
        if(canCatch){
          playSoccerAudio('catch',{volume:.64});soccerRecoverPossessionFromFreeBall(f,'swept_ball_recovery');return;
        }
        if(soccerKickFreeBallAtEnemy(f,e,b,'swept_retouch'))return;
        soccerBounceOffOwner(f,b);break;
      }
      const opponentDistance=e?dist(e.x,e.y,b.x,b.y):Infinity;
      if(opponentDistance>(e?.radius||0)+b.radius+7)b.opponentContactActive=false;
      const sweptHit=e&&!b.opponentContactActive
        ? soccerSweptCircleHit(old.x,old.y,b.x,b.y,e,e.radius+b.radius)
          || (opponentDistance<=e.radius+b.radius?{t:1,x:b.x,y:b.y}:null)
        : null;
      if (e && sweptHit) {
        if (b.skillShot===SOCCER_SHOOT&&!b.goalDriveSpent&&!bounced) {
          b.x=sweptHit.x;b.y=sweptHit.y;soccerStartCarry(f,e,b);break;
        }
        b.x=sweptHit.x;b.y=sweptHit.y;
        soccerNormalBallHit(f,e,b,clamp(b.speed/C.BALL_MAX_SPEED,0,1));
        break;
      }
      if(b.skillShot===SOCCER_SHOOT&&b.goalDriveOrigin&&b.goalDriveDirection&&e){
        const ballAlong=(b.x-b.goalDriveOrigin.x)*b.goalDriveDirection.x+(b.y-b.goalDriveOrigin.y)*b.goalDriveDirection.y;
        const enemyAlong=(e.x-b.goalDriveOrigin.x)*b.goalDriveDirection.x+(e.y-b.goalDriveOrigin.y)*b.goalDriveDirection.y;
        if(ballAlong>enemyAlong+e.radius+b.radius){
          b.skillShot=null;b.goalDriveTargetId=null;b.goalDriveDirection=null;
          if (e.data?.soccerShootLockedBy===f.id) { e.data.soccerShootLockedBy=null; e.data.positionLocked=false; }
          d.soccerShotResolving=false;d.soccerLastDebugReason='shoot_clean_miss';
        }
      }
    }
    if (dist(f.x,f.y,b.x,b.y)>f.radius+b.radius+4) b.hasLeftOwnerRadius=true;
    const canCatch=soccerFreeBallCatchReady(f,b);
    if (dist(f.x,f.y,b.x,b.y)<=f.radius+b.radius+C.CATCH_EXTRA_RADIUS) {
      if (canCatch) {
        playSoccerAudio('catch',{volume:.64}); soccerRecoverPossessionFromFreeBall(f,'catch_moving_ball'); return;
      }
      if (b.hasLeftOwnerRadius && soccerKickFreeBallAtEnemy(f,e,b,'close_retouch')) return;
    }
    if(b.freeFlightTime>=C.FREE_BALL_INTERCEPT_DELAY&&!d.soccerChaseDownActive)soccerStartChase(f);
    b.trail.unshift({x:b.x,y:b.y,rotation:matchClock*(2+clamp(b.speed/C.BALL_MAX_SPEED,0,1)*10)}); if(b.trail.length>7)b.trail.length=7;
  }
  function soccerTriggerPenaltyCheck(f,e,foulDamage=0){
    const d=f.data;
    if (d.soccerPenaltyUsedThisPossession || d.soccerShotResolving || !d.soccerPossessionActive) return;
    d.soccerPenaltyUsedThisPossession=true; d.soccerPenaltyCheckFreezeActive=true;
    d.soccerPenaltyFreezeTimer=C.PENALTY_CHECK_FREEZE_DURATION;
    d.soccerPenaltyFoulDamage=Math.max(0,foulDamage||0);
    d.soccerGoalDriveAlignmentHoldTimer=0; d.soccerGoalDriveAlignmentValid=false;
    STATE.activeFreezeOwner=f.id;
    playSoccerAudio('penaltyWhistle',{volume:.82});
    cameraShake=Math.max(cameraShake,9);
    d.soccerLastStateTransition='confirmed foul -> PENALTY CHECK';
  }
  function soccerBeginPenalty(f,e){
    if (!live(f) || !live(e)) {
      if (f?.data) {
        f.data.soccerPenaltyCheckFreezeActive=false;
        f.data.soccerShotResolving=false;
      }
      STATE.activeFreezeOwner=null;
      return;
    }
    const d=f.data,b=d.soccerBall;
    d.soccerPenaltyCheckFreezeActive=false; STATE.activeFreezeOwner=null;
    const goalSide = f.y > GAME_SIZE / 2 ? 'bottom' : 'top';
    const goalDir = goalSide === 'bottom' ? 1 : -1;
    const spot={x:GAME_SIZE/2,y:goalSide === 'bottom' ? GAME_SIZE*(1-C.PENALTY_SPOT_Y_RATIO) : GAME_SIZE*C.PENALTY_SPOT_Y_RATIO};
    // Begin with the stationary ball exactly at SOCCER's forward foot. The
    // cinematic then pulls SOCCER backward to build the run-up.
    const approach={x:spot.x-f.radius*.20,y:spot.y-goalDir*f.radius*1.11};
    e.x=GAME_SIZE/2;e.y=goalSide === 'bottom' ? GAME_SIZE-e.radius-8 : e.radius+8;e.data.positionLocked=true;
    d.soccerPenaltyOpponentSpot={x:e.x,y:e.y};
    e.applyStatus('soccerPenaltyLock',C.PENALTY_SKILL_DURATION+.2,{source:f});
    f.x=approach.x;f.y=approach.y;f.data.positionLocked=true;
    Object.assign(b,{state:SOCCER_POSSESSION,x:spot.x,y:spot.y,vx:0,vy:0,speed:0,
      skillShot:'penalty',damageArmed:false,trail:[],ownerContactActive:false,opponentContactActive:false});
    d.soccerPenaltyActive=true;d.soccerPenaltyCinematicActive=true;d.soccerShotResolving=true;
    d.soccerPenaltySkillTime=0;d.soccerPenaltyReleased=false;d.soccerPenaltyImpacted=false;
    d.soccerPenaltySpot=spot;d.soccerPenaltyApproach=approach;d.soccerCurrentKickType=null;
    d.soccerPenaltyGoalSide=goalSide;d.soccerPenaltyGoalDir=goalDir;d.soccerPenaltyVisualArrived=false;
    d.soccerState='SOCCER_PENALTY';
    d.soccerLastStateTransition='PENALTY CHECK -> PENALTY';
    soccerSetForward(f,0,goalDir); playSoccerAudio('penaltyActivation',{volume:.72}); recordSkill(f);
  }
  function soccerUpdatePenalty(f,e,dt){
    const d=f.data,b=d.soccerBall;
    d.soccerPenaltySkillTime=Math.min(C.PENALTY_SKILL_DURATION,d.soccerPenaltySkillTime+dt);
    const t=d.soccerPenaltySkillTime,spot=d.soccerPenaltySpot,approach=d.soccerPenaltyApproach;
    const goalDir=d.soccerPenaltyGoalDir||-1;
    f.data.positionLocked=true;
    if(e){e.data.positionLocked=true;e.x=d.soccerPenaltyOpponentSpot.x;e.y=d.soccerPenaltyOpponentSpot.y;}
    if (t<C.PENALTY_RUNUP_START) {
      const back=smoothstep(clamp(t/1.1,0,1)); f.x=approach.x;f.y=approach.y-goalDir*back*70;
      soccerSetForward(f,0,goalDir); d.soccerCurrentKickType=null;
    } else if (t<C.PENALTY_KICK_ANIM_START) {
      const run=smoothstep(clamp((t-C.PENALTY_RUNUP_START)/(C.PENALTY_KICK_ANIM_START-C.PENALTY_RUNUP_START),0,1));
      f.x=lerp(approach.x,spot.x,run);f.y=lerp(approach.y-goalDir*70,spot.y-goalDir*f.radius*.86,run);
      soccerSetForward(f,0,goalDir);
      soccerAdvanceMoveFrames(d,dt);
    } else {
      d.soccerCurrentKickType='penalty';d.soccerKickAnimTime=t-C.PENALTY_KICK_ANIM_START;
      d.soccerCurrentKickFrame=Math.min(8,Math.floor(d.soccerKickAnimTime*C.KICK_FPS));soccerSetForward(f,0,goalDir);
    }
    if (!d.soccerPenaltyReleased && t>=C.PENALTY_CONTACT_TIME) {
      d.soccerPenaltyReleased=true;
      const previousScale=timeScale;
      d.soccerPenaltyPreviousTimeScale=previousScale;
      timeScale=Math.min(timeScale,C.PENALTY_CONTACT_SLOW_SCALE);
      hitStop=Math.max(hitStop,.025);
      setTimeout(()=>{if(timeScale===C.PENALTY_CONTACT_SLOW_SCALE)timeScale=previousScale;},C.PENALTY_CONTACT_SLOW_DURATION*1000);
      playSoccerAudio('powerKick',{volume:.78}); soccerExitPossession(f,'penalty_release');
      const penaltySpeed=C.BALL_MAX_SPEED*C.PENALTY_BALL_SPEED_MULTIPLIER;
      Object.assign(b,{state:SOCCER_FREE_BALL,x:spot.x,y:spot.y,vx:0,vy:goalDir*penaltySpeed,speed:penaltySpeed,
        lastReleaseTime:matchClock,hasLeftOwnerRadius:false,skillShot:'penalty',damageArmed:true,trail:[],freeFlightTime:0});
    }
    if (d.soccerPenaltyReleased && !d.soccerPenaltyImpacted) {
      const linearTravel=clamp((t-C.PENALTY_CONTACT_TIME)/(C.PENALTY_GOAL_IMPACT_TIME-C.PENALTY_CONTACT_TIME),0,1);
      const travel=Math.pow(clamp(linearTravel*1.4,0,1),.72);
      const target=d.soccerPenaltyOpponentSpot;
      b.x=lerp(spot.x,target.x,travel);b.y=lerp(spot.y,target.y,travel);
      if(travel>=1&&!d.soccerPenaltyVisualArrived){
        d.soccerPenaltyVisualArrived=true;
        hitStop=Math.max(hitStop,.035);
        timeScale=Math.min(timeScale,.22);
        const restore=d.soccerPenaltyPreviousTimeScale ?? 1;
        setTimeout(()=>{if(timeScale<=.22)timeScale=restore;},240);
      }
    }
    if (!d.soccerPenaltyImpacted && t>=C.PENALTY_GOAL_IMPACT_TIME) {
      d.soccerPenaltyImpacted=true;
      if(timeScale===C.PENALTY_CONTACT_SLOW_SCALE)timeScale=Number.isFinite(d.soccerPenaltyPreviousTimeScale)?d.soccerPenaltyPreviousTimeScale:1;
      d.soccerPenaltyPreviousTimeScale=null;
      const penaltyDamage=C.PENALTY_BASE_DAMAGE+C.PENALTY_FOUL_DAMAGE_MULTIPLIER*(d.soccerPenaltyFoulDamage||0);
      d.soccerPenaltyResolvedDamage=penaltyDamage;
      if(e){e.takeDamage(penaltyDamage,f,'soccer-penalty');delete e.statuses.soccerPenaltyLock;e.data.soccerForcedBy=null;}
      const rebound=norm(spot.x-(e?.x||spot.x),spot.y-(e?.y||spot.y-goalDir*120));
      cameraShake=Math.max(cameraShake,22);b.skillShot=null;b.damageArmed=false;b.state=SOCCER_FREE_BALL;b.speed=C.BALL_MAX_SPEED*.70;b.vx=rebound.x*b.speed;b.vy=rebound.y*b.speed;b.freeFlightTime=0;
      b.x=GAME_SIZE/2;b.y=goalDir>0?GAME_SIZE-(e?.radius||75)-b.radius-4:(e?.radius||75)+b.radius+4;b.lastReleaseTime=matchClock;b.hasLeftOwnerRadius=true;
      d.soccerPenaltyActive=false;d.soccerPenaltyCinematicActive=false;d.soccerShotResolving=false;
      d.soccerCurrentKickType=null;d.soccerCurrentKickFrame=-1;d.soccerState=SOCCER_FREE_BALL;
      soccerOpenFreeBallRecovery(f,'penalty_impact');
      d.soccerLastStateTransition='PENALTY impact -> FREE BALL';
    }
  }
  function soccerUpdateAI(f,e,dt){
    const d=f.data,b=d.soccerBall;
    d.soccerHalf=soccerHalf(f,d.soccerHalf||'HOME');d.soccerOpponentHalf=soccerHalf(e,d.soccerOpponentHalf||'ENEMY');
    d.soccerHomeResistanceActive=d.soccerPossessionActive&&d.soccerHalf==='HOME';
    d.soccerEnemyHalfDodgeActive=d.soccerPossessionActive&&d.soccerHalf==='ENEMY';
    d.soccerOpponentHomeDebuffActive=d.soccerPossessionActive&&d.soccerOpponentHalf==='HOME';
    if (d.soccerGoalDriveActive) { soccerUpdateGoalDrive(f,e,dt); return; }
    if (d.soccerChaseDownActive) { soccerUpdateChase(f,e,dt); return; }
    // Normal SOCCER movement belongs to the shared fighter physics. Skills may
    // inspect geometry, but must not home or continuously steer the fighter.
    // This preserves the same straight travel and wall/opponent bounce rules
    // used by every other champion, both with and without possession.
    if(Number.isFinite(f.dir.x)&&Number.isFinite(f.dir.y)&&Math.hypot(f.dir.x,f.dir.y)>.5){
      soccerSetForward(f,f.dir.x,f.dir.y);
    }
    if (d.soccerPossessionActive) {
      d.soccerFieldReveal=Math.min(1,(d.soccerFieldReveal||0)+dt/.42);
      d.soccerPossessionTimer=Math.max(0,d.soccerPossessionTimer-dt);
      const geometry=soccerGoalGeometry(f,e);
      const rawShotReady=geometry.valid && geometry.aimMode==='opponent_line';
      if (rawShotReady) {
        d.soccerLastGoalDriveGeometry=soccerCloneGoalGeometry(geometry);
        d.soccerLastGoalDriveReadyAt=matchClock;
      }
      const stickyReady=!rawShotReady && d.soccerLastGoalDriveGeometry && matchClock-(d.soccerLastGoalDriveReadyAt||-99)<=.28;
      const shotReady=rawShotReady || stickyReady;
      const shotGeometry=rawShotReady ? geometry : d.soccerLastGoalDriveGeometry;
      d.soccerGoalDriveAlignmentValid=shotReady;d.soccerXAtTop=(rawShotReady?geometry:shotGeometry)?.xAtTop;
      if (shotReady) d.soccerGoalDriveAlignmentHoldTimer+=dt; else d.soccerGoalDriveAlignmentHoldTimer=0;
      if (shotReady && d.soccerGoalDriveAlignmentHoldTimer>=C.GOAL_DRIVE_ALIGNMENT_HOLD) { soccerStartGoalDrive(f,e,shotGeometry);return; }
      if (d.soccerPossessionTimer<=0) {
        if (shotReady || d.soccerGoalDriveAlignmentHoldTimer>0) {
          soccerStartGoalDrive(f,e,shotGeometry || geometry);
          return;
        }
        const n=norm(d.soccerVisualForwardX||e.x-f.x,d.soccerVisualForwardY||e.y-f.y||-1);
        soccerReleaseBall(f,n,C.BALL_MAX_SPEED*C.TIMEOUT_RELEASE_SPEED_RATIO,'possession_timeout',null);return;
      }
    }
  }
  function soccerAdvanceMoveFrames(d,dt){
    d.soccerMoveFrameAccumulator=(d.soccerMoveFrameAccumulator||0)+dt;
    while(d.soccerMoveFrameAccumulator>=1/C.MOVE_FPS){
      d.soccerMoveFrameAccumulator-=1/C.MOVE_FPS;
      d.soccerCurrentMoveFrame=((d.soccerCurrentMoveFrame||0)+1)%C.MOVE_FRAME_COUNT;
    }
    d.soccerMoveAnimTime=(d.soccerMoveAnimTime||0)+dt;
    d.soccerMoveFrameBlend=clamp((d.soccerMoveFrameAccumulator||0)*C.MOVE_FPS,0,1);
  }
  function soccerSystemTick(f,e,dt){
    if (!live(f)) { stopAmbience(f);soccerClearOpponentLocks(f);return; }
    const d=f.data;d.soccerFieldFade=Math.max(0,(d.soccerFieldFade||0)-dt/.20);
    if (d.soccerBall?.state === SOCCER_POSSESSION && d.soccerState === SOCCER_POSSESSION && !d.soccerPenaltyCinematicActive && !d.soccerChaseDownActive) {
      d.soccerPossessionActive = true;
      d.soccerFieldOverlayActive = true;
      d.soccerFieldReveal = Math.max(d.soccerFieldReveal || 0, .18);
    }
    d.soccerPossessionCooldown=Math.max(0,(d.soccerPossessionCooldown||0)-dt);
    d.soccerCooldownKickTimer=Math.max(0,(d.soccerCooldownKickTimer||0)-dt);
    soccerUpdateBall(f,e,dt);
    const manualControl=f.data?.manualController?.active&&f.data.manualController.mode==='MANUAL_LAB';
    if (manualControl) {
      d.soccerHalf=soccerHalf(f,d.soccerHalf||'HOME');d.soccerOpponentHalf=soccerHalf(e,d.soccerOpponentHalf||'ENEMY');
      d.soccerHomeResistanceActive=d.soccerPossessionActive&&d.soccerHalf==='HOME';
      d.soccerEnemyHalfDodgeActive=d.soccerPossessionActive&&d.soccerHalf==='ENEMY';
      d.soccerOpponentHomeDebuffActive=d.soccerPossessionActive&&d.soccerOpponentHalf==='HOME';
      if (!f.hardCC() && !f.hasStatus('abilityDisabled')) {
        if (d.soccerGoalDriveActive) soccerUpdateGoalDrive(f,e,dt);
        else if (d.soccerChaseDownActive) soccerUpdateChase(f,e,dt);
        else if (d.soccerPossessionActive) {
          d.soccerFieldReveal=Math.min(1,(d.soccerFieldReveal||0)+dt/.42);
          d.soccerPossessionTimer=Math.max(0,d.soccerPossessionTimer-dt);
          if (Number.isFinite(f.dir.x)&&Number.isFinite(f.dir.y)&&Math.hypot(f.dir.x,f.dir.y)>.5) soccerSetForward(f,f.dir.x,f.dir.y);
          if (d.soccerPossessionTimer<=0) {
            const n=norm(d.soccerVisualForwardX||f.dir.x||0,d.soccerVisualForwardY||f.dir.y||-1);
            soccerReleaseBall(f,n,C.BALL_MAX_SPEED*C.TIMEOUT_RELEASE_SPEED_RATIO,'manual_possession_timeout',null);
          }
        }
      }
    } else if (!f.hardCC() && !f.hasStatus('abilityDisabled')) soccerUpdateAI(f,e,dt);
    soccerContactDodgeChance(f);
    const movementLocked=f.data.positionLocked||d.soccerGoalDriveActive||d.soccerPenaltyCinematicActive;
    d.soccerMovementActive=(d.soccerChaseDownActive||!movementLocked)&&!f.hardCC()&&Math.hypot(f.dir.x,f.dir.y)>.5;
    if(d.soccerMovementActive)soccerAdvanceMoveFrames(d,dt);
    const b=d.soccerBall;
    STATE.debug[f.id]={state:d.soccerState,ballState:b?.state,possessionTimer:d.soccerPossessionTimer,
      field:d.soccerFieldOverlayActive,half:d.soccerHalf,opponentHalf:d.soccerOpponentHalf,
      homeResistance:d.soccerHomeResistanceActive,enemyDodge:d.soccerEnemyHalfDodgeActive,
      opponentDebuff:d.soccerOpponentHomeDebuffActive,alignment:d.soccerGoalDriveAlignmentValid,
      xAtTop:d.soccerXAtTop,goalBounds:soccerGoalBounds(),hold:d.soccerGoalDriveAlignmentHoldTimer,
      shotResolving:d.soccerShotResolving,goalDrive:d.soccerGoalDriveActive,carry:d.soccerCarryActive,
      carryDistance:d.soccerCarryDistance,penaltyEligible:soccerPenaltyBoxContains(f),
      penaltyFreeze:d.soccerPenaltyCheckFreezeActive,penalty:d.soccerPenaltyCinematicActive,
      penaltyTime:d.soccerPenaltySkillTime,penaltyUsed:d.soccerPenaltyUsedThisPossession,
      ballSpeedRatio:clamp((b?.speed||0)/C.BALL_MAX_SPEED,0,1),hasLeftOwnerRadius:b?.hasLeftOwnerRadius,
      chase:d.soccerChaseDownActive,chaseStunned:d.soccerChaseDownHasStunnedOpponent,
      moveFrame:d.soccerCurrentMoveFrame,kickFrame:d.soccerCurrentKickFrame,
      possessionCooldown:d.soccerPossessionCooldown,
      rageDodge:d.soccerRageDodgeChance,totalDodge:d.soccerTotalDodgeChance,
      ambience:!!d.soccerAmbience,lastTransition:d.soccerLastStateTransition};
  }

  const soccerType={
    name:'SOCCER',color:'#ff493d',desc:'Possession, SHOOT, Penalty and physical free-ball recovery',speed:485,startDx:0,startDy:-1,
    noRage:false,init:soccerInit,onRage:(f)=>{
      f.data.soccerRageStartHp=f.hp;
      f.data.soccerLastStateTransition='RAGE DODGE ONLINE';
    },update:()=>{},onCollide:(f,e)=>{
      const d=f.data;
      if (d.soccerChaseDownActive && !d.soccerChaseDownHasStunnedOpponent) return true;
      return false;
    },
    draw:(ctx,f)=>{
      const d=f.data;
      const kick=d.soccerCurrentKickType && d.soccerCurrentKickFrame>=0;
      const frames=kick?STATE.kickFrames:STATE.moveFrames;
      const index=kick?clamp(d.soccerCurrentKickFrame,0,8):clamp(d.soccerCurrentMoveFrame||0,0,C.MOVE_FRAME_COUNT-1);
      const image=frames[index];
      const forward=norm(d.soccerVisualForwardX||0,d.soccerVisualForwardY||-1);
      const desired=Math.atan2(forward.y,forward.x)-Math.PI/2;
      const current=Math.atan2(f.dir.y,f.dir.x);
      ctx.save();ctx.rotate(desired-current);
      if (imageReady(image)) {
        const size=f.radius*3.42;
        ctx.drawImage(image,-size/2,-size/2,size,size);
        // Neutral chest plate hides source-specific number/crest at gameplay size.
        ctx.save();ctx.globalAlpha=.76;ctx.fillStyle='#8f1719';ctx.beginPath();ctx.ellipse(0,-size*.08,size*.105,size*.07,0,0,TAU);ctx.fill();ctx.restore();
      } else { drawSketchBlob(ctx,f.radius,'#b91f28',14); }
      ctx.restore();
    }
  };
  FighterTypes.push(soccerType);

  const previousDrawSoccerBallLayer=Fighter.prototype.draw;
  Fighter.prototype.draw=function(ctx){
    const result=previousDrawSoccerBallLayer.call(this,ctx);
    if(this.name==='SOCCER'&&fighters?.includes(this)&&this.data?.soccerBall?.state===SOCCER_POSSESSION){
      drawSoccerBall(ctx,this,true);
    }
    return result;
  };

  const previousApplyStatusSoccer=Fighter.prototype.applyStatus;
  Fighter.prototype.applyStatus=function(name,duration,data={}){
    if (this.name==='SOCCER') {
      const harmful=!['speed','immune'].includes(name) && data?.source!==this;
      const sameContactSource=data?.source && data.source.id===this.data.soccerDodgeSourceId;
      const sourceClose=sameContactSource&&dist(this.x,this.y,data.source.x,data.source.y)
        <=this.radius+(data.source.radius||0)+110;
      const contactStatus=['stun','push','slow','soccerChaseStun','innerTrauma','bleed'].includes(name);
      if(harmful&&contactStatus&&sourceClose&&(this.data.soccerDodgeImmunityUntil||0)>=matchClock)return;
      if(harmful&&this.data?.soccerPossessionActive&&this.data.soccerHomeResistanceActive)duration*=C.HOME_EFFECT_MULTIPLIER;
    }
    return previousApplyStatusSoccer.call(this,name,duration,data);
  };
  function soccerContactDodgeChance(f){
    const field=f.data.soccerEnemyHalfDodgeActive?C.ENEMY_HALF_DODGE_CHANCE:0;
    const rageStart=f.data.soccerRageStartHp??f.rageStartHp??f.hp;
    const lostPct=f.isRage?Math.max(0,(rageStart-f.hp)/Math.max(1,f.maxHp)*100):0;
    const rage=f.isRage?Math.min(.80,lostPct*.05):0;
    f.data.soccerRageDodgeChance=rage;
    f.data.soccerTotalDodgeChance=Math.min(1,field+rage);
    return f.data.soccerTotalDodgeChance;
  }
  function soccerIsContactAttack(target,source,label,statusDamage){
    if(statusDamage||!source||source===target||!Number.isFinite(source.x)||!Number.isFinite(source.y))return false;
    if(/ice[-_ ]?age|burn|poison|bleed|zone|field|dot/i.test(String(label||'')))return false;
    return dist(target.x,target.y,source.x,source.y)<=target.radius+(source.radius||0)+110;
  }
  function soccerDodge(f,source){
    const away=source?norm(f.x-source.x,f.y-source.y):{x:0,y:1};
    const candidates=[{x:-away.y,y:away.x},{x:away.y,y:-away.x},away];
    let best=candidates[0],bestRoom=-Infinity;
    for(const c of candidates){const x=clamp(f.x+c.x*105,f.radius,GAME_SIZE-f.radius),y=clamp(f.y+c.y*105,f.radius,GAME_SIZE-f.radius);const room=dist(f.x,f.y,x,y);if(room>bestRoom){bestRoom=room;best=c;}}
    const old={x:f.x,y:f.y};f.x=clamp(f.x+best.x*105,f.radius,GAME_SIZE-f.radius);f.y=clamp(f.y+best.y*105,f.radius,GAME_SIZE-f.radius);
    f.data.soccerDodgeImmunityUntil=matchClock+.12;f.data.soccerDodgeSourceId=source?.id??null;
    for(let i=0;i<4;i++){
      const t=i/4;
      STATE.vfx.push({type:'dodge',x:lerp(old.x,f.x,t),y:lerp(old.y,f.y,t),dir:best,
        life:.30+i*.035,maxLife:.30+i*.035,ownerId:f.id});
    }
  }
  const previousTakeDamageSoccer=Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage=function(amount,source=null,label='',statusDamage=false){
    let adjusted=amount;
    if(this.name==='SOCCER'&&source&&source!==this){
      const d=this.data,sourceId=source.id||label||'source';
      const dodgeChance=soccerContactDodgeChance(this);
      if(soccerIsContactAttack(this,source,label,statusDamage)&&dodgeChance>0
        &&matchClock>=(d.soccerDodgeBySource[sourceId]||0)&&Math.random()<dodgeChance){
        d.soccerDodgeBySource[sourceId]=matchClock+C.DODGE_SOURCE_COOLDOWN;soccerDodge(this,source);return;
      }
      if(d.soccerPossessionActive&&d.soccerHomeResistanceActive)adjusted*=C.HOME_DAMAGE_MULTIPLIER;
    }
    const before=this.hp;const result=previousTakeDamageSoccer.call(this,adjusted,source,label,statusDamage);
    const confirmed=Math.max(0,before-this.hp);
    if(this.name==='SOCCER' && this.hp>0 && confirmed>0 && !statusDamage && source && source!==this && live(soccerEnemy(this)) && soccerPenaltyBoxContains(this)) soccerTriggerPenaltyCheck(this,soccerEnemy(this),confirmed);
    return result;
  };
  const previousSpeedMultSoccer=Fighter.prototype.speedMult;
  Fighter.prototype.speedMult=function(){
    let value=previousSpeedMultSoccer.call(this);
    const owner=fighters.find(f=>live(f)&&f.name==='SOCCER'&&f!==this&&f.data?.soccerPossessionActive&&soccerHalf(this,'ENEMY')==='HOME');
    if(owner)value*=C.OPPONENT_HOME_SPEED_MULTIPLIER;
    return value;
  };
  const previousCooldownRateSoccer=Fighter.prototype.cooldownRate;
  Fighter.prototype.cooldownRate=function(){
    let value=previousCooldownRateSoccer.call(this);
    const owner=fighters.find(f=>live(f)&&f.name==='SOCCER'&&f!==this&&f.data?.soccerPossessionActive&&soccerHalf(this,'ENEMY')==='HOME');
    if(owner)value*=C.OPPONENT_HOME_COOLDOWN_MULTIPLIER;
    return value;
  };

  const previousBackgroundSoccer=drawBackground;
  drawBackground=function(ctx){
    previousBackgroundSoccer(ctx);
    for(const f of soccerFighters()){
      const d=f.data;const alpha=d.soccerFieldOverlayActive?smoothstep(d.soccerFieldReveal||0):clamp(d.soccerFieldFade||0,0,1);
      if(alpha<=0)continue;
      ctx.save();
      const image=STATE.images.field;
      const reveal=d.soccerFieldOverlayActive?clamp(d.soccerFieldReveal||0,0,1):1;
      ctx.beginPath();ctx.rect(0,GAME_SIZE*(1-reveal),GAME_SIZE,GAME_SIZE*reveal);ctx.clip();
      const turf=ctx.createLinearGradient(0,0,0,GAME_SIZE);
      turf.addColorStop(0,'#102f32');turf.addColorStop(.5,'#123a34');turf.addColorStop(1,'#0b282d');
      ctx.globalAlpha=.94*alpha;ctx.fillStyle=turf;ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);
      for(let stripe=0;stripe<10;stripe++){
        ctx.globalAlpha=(stripe%2?.08:.025)*alpha;ctx.fillStyle='#7ad69a';
        ctx.fillRect(0,stripe*GAME_SIZE/10,GAME_SIZE,GAME_SIZE/10);
      }
      ctx.globalAlpha=.88*alpha;
      if(imageReady(image)){
        ctx.drawImage(image,0,0,GAME_SIZE,GAME_SIZE);
        ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.24*alpha;ctx.fillStyle='#6edcff';ctx.fillRect(0,GAME_SIZE*(1-reveal)-10,GAME_SIZE,20);
      }else{
        ctx.strokeStyle='#8deaff';ctx.lineWidth=6;ctx.strokeRect(6,6,GAME_SIZE-12,GAME_SIZE-12);ctx.beginPath();ctx.moveTo(0,500);ctx.lineTo(1000,500);ctx.stroke();
      }
      ctx.restore();
    }
  };
  window.drawBackground=drawBackground;

  function drawSoccerBall(ctx,f,possessionLayer=false){
    const d=f.data,b=d.soccerBall;if(!b)return;
    if(possessionLayer!== (b.state===SOCCER_POSSESSION))return;
    const ratio=clamp((b.speed||0)/C.BALL_MAX_SPEED,0,1);
    if(b.state===SOCCER_FREE_BALL && b.trail?.length>1){
      const ghostSize=f.radius*1.08;
      const ghostImage=soccerOrangeBallImage();
      ctx.save();
      for(let i=b.trail.length-1;i>=1;i--){
        const p=b.trail[i],fade=1-i/b.trail.length;
        ctx.save();ctx.globalAlpha=(.08+.34*fade)*ratio;ctx.translate(p.x,p.y);ctx.rotate(p.rotation||0);
        if(ghostImage&&(ghostImage instanceof HTMLCanvasElement||imageReady(ghostImage)))ctx.drawImage(ghostImage,-ghostSize/2,-ghostSize/2,ghostSize,ghostSize);
        else{ctx.fillStyle='#eef5ff';ctx.beginPath();ctx.arc(0,0,b.radius*.85,0,TAU);ctx.fill();}
        ctx.restore();
      }
      ctx.restore();
    }
    const size=f.radius*(b.state===SOCCER_POSSESSION?.96:1.08);
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(matchClock*(2+ratio*10));
    if(imageReady(STATE.images.ball))ctx.drawImage(STATE.images.ball,-size/2,-size/2,size,size);
    else{ctx.fillStyle='#fff';ctx.strokeStyle='#111';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,b.radius,0,TAU);ctx.fill();ctx.stroke();}
    ctx.restore();
  }
  function drawSoccerVfx(ctx){
    for(const fx of STATE.vfx){
      const a=clamp(fx.life/fx.maxLife,0,1);ctx.save();ctx.globalAlpha=a;
      if(fx.type==='dash_ghost'||fx.type==='dodge'){const owner=fighters.find(f=>f.id===fx.ownerId);const image=STATE.moveFrames[owner?.data?.soccerCurrentMoveFrame||0];if(imageReady(image)){ctx.translate(fx.x,fx.y);ctx.rotate(Math.atan2(fx.dir.y,fx.dir.x)-Math.PI/2);const size=(owner?.radius||72)*3.42;if(fx.bright){ctx.globalCompositeOperation='lighter';ctx.shadowColor='#fff3ae';ctx.shadowBlur=22;}ctx.globalAlpha*=fx.bright?.44:(fx.type==='dodge'?.26:.38);ctx.drawImage(image,-size/2,-size/2,size,size);}}
      ctx.restore();
    }
  }
  function drawPenaltyAim(ctx,f,e){
    const d=f.data;if(!d.soccerPenaltyCinematicActive||!e)return;
    const t=d.soccerPenaltySkillTime||0,g=soccerGoalBounds();
    const scan=t<C.PENALTY_RETICLE_SCAN_END?Math.sin(t/C.PENALTY_RETICLE_SCAN_END*Math.PI*3):0;
    const x=t<C.PENALTY_RETICLE_SCAN_END?lerp(g.min+40,g.max-40,(scan+1)/2):e.x;const y=e.y;
    const from={x:f.x,y:f.y-f.radius*.72};ctx.save();ctx.strokeStyle='rgba(255,20,45,.92)';ctx.shadowColor='#ff174f';ctx.shadowBlur=16;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(x,y);ctx.stroke();
    ctx.fillStyle='#ff335f';ctx.beginPath();ctx.arc(from.x,from.y,9,0,TAU);ctx.fill();
    ctx.fillStyle='#fff0f5';ctx.beginPath();ctx.arc(from.x,from.y,3.5,0,TAU);ctx.fill();
    const size=180;if(imageReady(STATE.images.reticle))ctx.drawImage(STATE.images.reticle,x-size/2,y-size/2,size,size);else{ctx.beginPath();ctx.arc(x,y,70,0,TAU);ctx.stroke();}
    ctx.strokeStyle='#ff4b70';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,13,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(x-24,y);ctx.lineTo(x+24,y);ctx.moveTo(x,y-24);ctx.lineTo(x,y+24);ctx.stroke();ctx.restore();
  }
  const previousDrawProjectilesSoccer=drawProjectiles;
  drawProjectiles=function(ctx){
    previousDrawProjectilesSoccer(ctx);drawSoccerVfx(ctx);
    for(const f of soccerFighters()){drawSoccerBall(ctx,f,false);drawPenaltyAim(ctx,f,soccerEnemy(f));}
  };
  window.drawProjectiles=drawProjectiles;

  function soccerPreUpdate(dt){
    if (STATE.lastUpdateStamp===lastTime) return false;
    STATE.lastUpdateStamp=lastTime;
    let write=0;
    for(let i=0;i<STATE.vfx.length;i++){
      const fx=STATE.vfx[i];fx.life-=dt;
      if(fx.life>0)STATE.vfx[write++]=fx;
    }
    STATE.vfx.length=write;
    if(STATE.vfx.length>180)STATE.vfx.copyWithin(0,STATE.vfx.length-180),STATE.vfx.length=180;
    if(gameState==='PLAYING'){
      const active=soccerFighters();
      const freeze=active.find(f=>f.data.soccerPenaltyCheckFreezeActive);
      if(freeze){
        freeze.data.soccerPenaltyFreezeTimer=Math.max(0,freeze.data.soccerPenaltyFreezeTimer-dt);
        if(freeze.data.soccerPenaltyFreezeTimer<=0)soccerBeginPenalty(freeze,soccerEnemy(freeze));
        updateHUD();return true;
      }
      const cinematic=active.find(f=>f.data.soccerPenaltyCinematicActive);
      if(cinematic){matchClock+=dt;soccerUpdatePenalty(cinematic,soccerEnemy(cinematic),dt);updateHUD();return true;}
      for(const f of active)soccerSystemTick(f,soccerEnemy(f),dt);
    }
    return false;
  }
  STATE.preUpdate=soccerPreUpdate;
  STATE.enterPossession=soccerRecoverPossessionFromFreeBall;
  STATE.armHealKick=soccerArmHealKick;
  STATE.freeBallCatchReady=soccerFreeBallCatchReady;
  STATE.manualApi={
    releaseBall:soccerReleaseBall,
    startChase:soccerStartChase,
    startGoalDrive:soccerStartGoalDrive,
    beginPenalty:soccerBeginPenalty,
    setForward:soccerSetForward,
    goalGeometry:soccerGoalGeometry
  };

  const previousUpdateSoccer=update;
  update=function(dt){
    if(soccerPreUpdate(dt)) return;
    const result=previousUpdateSoccer(dt);
    for(const f of fighters||[]){
      if(f?.name==='SOCCER' && f.hp<=0){stopAmbience(f);soccerClearOpponentLocks(f);}
    }
    return result;
  };

  function soccerCleanupAll(){
    for(const f of fighters||[]){if(f?.name==='SOCCER'){stopAmbience(f);soccerClearOpponentLocks(f);}}
    STATE.vfx.length=0;STATE.activeFreezeOwner=null;STATE.debug={};
  }
  const previousStartSoccer=startSpecificMatch;
  startSpecificMatch=function(ft1,ft2,opts={}){
    soccerCleanupAll();const result=previousStartSoccer(ft1,ft2,opts);
    for(const f of soccerFighters())soccerEnterPossession(f,'round_start');
    return result;
  };
  const previousMenuSoccer=goToMenu;goToMenu=function(){soccerCleanupAll();return previousMenuSoccer();};
  const previousSelectSoccer=goToSelect;goToSelect=function(){soccerCleanupAll();return previousSelectSoccer();};
  const previousEndSoccer=endMatch;endMatch=function(){soccerCleanupAll();return previousEndSoccer();};

  function soccerUpdateInspector(){
    fighters.slice(0,2).forEach((f,i)=>{
      if(f?.name!=='SOCCER')return;const d=f.data,b=d.soccerBall,rows=document.getElementById(`ci-p${i+1}-rows`);if(!rows)return;
      const state=d.soccerPenaltyCinematicActive?`PENALTY ${Math.min(4,d.soccerPenaltySkillTime||0).toFixed(1)}s`:d.soccerChaseDownActive?'CHASE DOWN':d.soccerPossessionActive?'POSSESSION':'FREE BALL';
      const first=d.soccerPossessionActive?`${Math.max(0,d.soccerPossessionTimer||0).toFixed(1)}s`:(d.soccerPossessionCooldown||0)>0?`DRIBBLE CD ${(d.soccerPossessionCooldown||0).toFixed(1)}s`:b?.state===SOCCER_FREE_BALL?`${Math.round(clamp((b.speed||0)/C.BALL_MAX_SPEED,0,1)*100)}% SPEED`:'READY';
      const alignment=d.soccerGoalDriveAlignmentValid?`${Math.round(clamp((d.soccerGoalDriveAlignmentHoldTimer||0)/C.GOAL_DRIVE_ALIGNMENT_HOLD,0,1)*100)}%`:'NO LANE';
      rows.innerHTML=`<div class="ci-row"><div class="ci-label"><span>STATE</span><b>${state}</b></div><div class="ci-track"><div class="ci-fill" style="width:${d.soccerPossessionActive?clamp((d.soccerPossessionTimer||0)/10*100,0,100):clamp((b?.speed||0)/C.BALL_MAX_SPEED*100,0,100)}%"></div></div></div><div class="ci-row"><div class="ci-label"><span>BALL</span><b>${first}</b></div><div class="ci-track"><div class="ci-fill" style="width:${clamp((b?.speed||0)/C.BALL_MAX_SPEED*100,0,100)}%"></div></div></div><div class="ci-row"><div class="ci-label"><span>SHOT LANE</span><b>${alignment}</b></div><div class="ci-track"><div class="ci-fill" style="width:${d.soccerGoalDriveAlignmentValid?clamp((d.soccerGoalDriveAlignmentHoldTimer||0)/C.GOAL_DRIVE_ALIGNMENT_HOLD*100,0,100):0}%"></div></div></div>`;
    });
  }
  STATE.updateInspector=soccerUpdateInspector;
  const previousInspectorSoccer=window.updateCombatInspector;
  window.updateCombatInspector=function(force=false){
    previousInspectorSoccer?.(force);
    soccerUpdateInspector();
  };

  Object.assign(window.apexReactBridge||{}, {startSpecificMatch,goToMenu,goToSelect,endMatch});
  Object.assign(window,{startSpecificMatch,goToMenu,goToSelect,endMatch});
  window.FighterTypes=FighterTypes;window.apexFighterTypes=FighterTypes;
})();
