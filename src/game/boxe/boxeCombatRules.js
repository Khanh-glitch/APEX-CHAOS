// BOXE auto-battle semantic state machine. All effects are requests to the
// real Arena authority; this module never applies HP or spawns VFX itself.
// Gold visuals MUST be bridged after the immutable source is imported.
import {BOXE_BATTLE as RULES} from './boxeConfig.js';
const finite=(v)=>typeof v==='number'&&Number.isFinite(v);
const validTime=t=>{if(!finite(t)||t<0)throw Error('INVALID_BOXE_TIME');};
export const BOXE_AUTO_SKILL_DAMAGE=0;
export function boxeSkillDamage({kind,targetRemainingHP=0}={}){
 if(kind==='A2_EMPOWERED_FINISHER')return Math.max(0,finite(targetRemainingHP)?targetRemainingHP:0)*RULES.a2.enhanced.finisherFractionOfRemainingHP;
 return 0;
}
export function createBoxeBattleController({emit=()=>{}}={}){
 const state={
  now:0,damageProgress:0,enhancedUntil:0,enhanced:false,
  cooldowns:{A1:0,A2:0},rocket:null,flurry:null,counter:null,
  carryQueue:null,fireCycleActive:false
 };
 function dispatch(type,payload={}){emit({type,now:state.now,...payload});}
 function expireEnhance(){
  if(!state.enhanced)return;
  state.enhanced=false;state.enhancedUntil=0;state.damageProgress=0;
  dispatch('boxe:enhancement-ended');
 }
 function advance(now){
  validTime(now);if(now<state.now)throw Error('NON_MONOTONIC_BOXE_TIME');
  // Split cooldown progress at expiry: half of delta may be accelerated.
  let elapsed=now-state.now,boostedMs=state.enhanced?Math.max(0,Math.min(now,state.enhancedUntil)-state.now):0;
  const recovered=elapsed+boostedMs*(RULES.passive.cooldownRecoveryMultiplier-1);
  for(const k of ['A1','A2'])state.cooldowns[k]=Math.max(0,state.cooldowns[k]-recovered);
  state.now=now;
  if(state.enhanced&&now>=state.enhancedUntil)expireEnhance();
  if(state.rocket?.phase==='outbound'&&now>=state.rocket.returnAt){
   state.rocket.phase='returning';dispatch('boxe:rocket-return-phase',{goldKey:'2',carryId:state.rocket.cargoId});
  }
  if(state.counter?.phase==='guard'&&now>=state.counter.expiresAt){
   state.counter=null;dispatch('boxe:counter-window-ended');
  }
  // Gold key 1: launch interval 85ms, impact delay 50ms. Events retain
  // their exact scheduled time even when one engine frame spans many ticks.
  const f=state.flurry;
  if(f){
   while(f.nextLaunchAt+50<=f.endingAt&&f.nextLaunchAt<=now){
    dispatch('boxe:flurry-punch-scheduled',{goldKey:'1',punchIndex:f.punchCount++,atMs:f.nextLaunchAt,
     impactAtMs:f.nextLaunchAt+50,periodMs:85,bodyDash:false,damage:0});
    f.nextLaunchAt+=85;
   }
   if(now>=f.endingAt){
    dispatch('boxe:flurry-finished',{goldKey:'1',atMs:f.endingAt,punchCount:f.punchCount});
    state.flurry=null;
    if(state.rocket?.recallRequested&&state.rocket.phase==='outbound'){
      state.rocket.phase='returning';dispatch('boxe:rocket-return-phase',{goldKey:'2',early:true});
    }
   }
  }
 }
 function recordRealDamage({direction,realizedHp,source,ownedByBoxe=true},now){
  advance(now);
  if(!finite(realizedHp)||realizedHp<=0)return false;
  const eligible=direction==='incoming'||(direction==='outgoing'&&source==='owned-weapon'&&ownedByBoxe);
  if(!eligible||state.enhanced)return false;
  state.damageProgress+=realizedHp;
  if(state.damageProgress>=RULES.passive.damageThreshold){
   state.enhanced=true;state.enhancedUntil=now+RULES.passive.enhancedDurationMs;
   state.damageProgress=0;
   dispatch('boxe:enhancement-started',{until:state.enhancedUntil,cooldownMultiplier:2});
   return true;
  }
  return false;
 }
 function castA1(now){
  advance(now);if(state.cooldowns.A1>0||state.rocket)return false;
  state.rocket={phase:'outbound',returnAt:now+RULES.a1.outboundMs,enhancedAtCast:state.enhanced,
   collisionIds:new Set(),lastOpponentHits:new Map(),recallRequested:false,
   flurryUsed:false,cargoId:null,pendingCargoId:null};
  dispatch('boxe:rocket-launch',{goldKey:'2',durationMs:RULES.a1.outboundMs,enhanced:state.enhanced,damage:0});
  return true;
 }
 function recallA1(now){
  advance(now);const r=state.rocket;
  if(!r||r.phase==='returning')return false;
  r.recallRequested=true;
  if(state.flurry)return true;
  r.phase='returning';dispatch('boxe:rocket-return-phase',{goldKey:'2',early:true,carryId:r.cargoId});
  return true;
 }
 function rocketFighterHit({collisionId,opponentId},now){
  advance(now);const r=state.rocket;
  if(!r||r.phase!=='outbound'||!collisionId||r.collisionIds.has(collisionId))return false;
  r.collisionIds.add(collisionId);
  const previous=r.lastOpponentHits.get(opponentId)??-Infinity;
  if(now-previous<RULES.a1.repeatHitGapMs)return false;
  r.lastOpponentHits.set(opponentId,now);
  dispatch('arena:stun-request',{opponentId,durationMs:RULES.a1.impactStunMs,damage:0,source:'A1'});
  dispatch('arena:disarm-request',{opponentId,source:'A1',collisionId});
  dispatch('boxe:rocket-impact',{goldKey:'2',opponentId,collisionId,damage:0});
  if(r.enhancedAtCast&&!r.flurryUsed){
   r.flurryUsed=true;
   state.flurry={startedAt:now,endingAt:now+RULES.a1.enhanced.durationMs,
    nextLaunchAt:now,punchCount:0,hitIds:new Set()};
   dispatch('boxe:flurry-start',{goldKey:'1',durationMs:2000,periodMs:85,bodyDash:false});
   // Immediate first launch belongs to the same exact clock tick.
   advance(now);
  }
  return true;
 }
 function flurryFighterHit({collisionId,opponentId},now){
  advance(now);const f=state.flurry;
  if(!f||now>=f.endingAt||!collisionId||f.hitIds.has(collisionId))return false;
  f.hitIds.add(collisionId);
  dispatch('arena:stun-request',{opponentId,source:'A1-FLURRY',durationMs:RULES.a1.enhanced.impactStunMs,damage:0,collisionId});
  dispatch('boxe:flurry-impact',{goldKey:'1',opponentId,collisionId,damage:0});
  return true;
 }
 function rocketGroundGunContact({gunId,eligible=true},now){
  advance(now);const r=state.rocket;
  if(!r||r.phase!=='outbound'||r.cargoId||r.pendingCargoId||!gunId||!eligible)return false;
  // This is a PENDING request, never proof of actual floor-weapon ownership.
  r.pendingCargoId=gunId;
  dispatch('arena:reserve-ground-gun-request',{gunId,maxCargo:1});
  return true;
 }
 function resolveGroundGunReservation({gunId,accepted},now){
  advance(now);const r=state.rocket;
  if(!r||r.pendingCargoId!==gunId)return false;
  r.pendingCargoId=null;
  if(!accepted){dispatch('boxe:ground-gun-reservation-rejected',{gunId});return true;}
  r.cargoId=gunId;
  dispatch('boxe:ground-gun-reservation-confirmed',{gunId});return true;
 }
 function rocketCatch(now){
  advance(now);const r=state.rocket;
  if(!r||r.phase!=='returning')return false;
  dispatch('boxe:gold-rocket-catch',{goldKey:'2',physicalRecoil:true,hitstop:true});
  if(r.cargoId){
   state.carryQueue=r.cargoId;
   dispatch('arena:weapon-transfer-on-catch-request',{gunId:r.cargoId,afterActiveFire:state.fireCycleActive});
  }
  state.rocket=null;
  state.cooldowns.A1=RULES.a1.cooldownMs;
  dispatch('boxe:rocket-cooldown-started',{durationMs:RULES.a1.cooldownMs});
  if(state.carryQueue&&!state.fireCycleActive)flushWeaponQueue();
  return true;
 }
 function setWeaponFireCycle(active,now){
  advance(now);state.fireCycleActive=!!active;
  if(!active)flushWeaponQueue();
 }
 function flushWeaponQueue(){
  if(state.carryQueue&&!state.fireCycleActive){
   dispatch('arena:equip-queued-gun-request',{gunId:state.carryQueue});
   state.carryQueue=null;
  }
 }
 function castA2(now){
  advance(now);if(state.cooldowns.A2>0||state.counter||state.rocket||state.flurry)return false;
  state.cooldowns.A2=RULES.a2.cooldownMs;
  state.counter={phase:'guard',expiresAt:now+RULES.a2.guardMs,enhancedAtCast:state.enhanced};
  dispatch('boxe:counter-guard',{goldKey:'9',durationMs:1000,damage:0});
  return true;
 }
 function interceptIncoming({opponentOwned=false,qualifyingDamage=0},now){
  advance(now);const c=state.counter;
  if(!c||c.phase!=='guard'||!opponentOwned||!(qualifyingDamage>0))return {negated:false};
  c.phase='charging';dispatch('arena:negate-hit-before-hp',{preventedHP:qualifyingDamage});
  dispatch('boxe:counter-lunge',{goldKey:'9',damage:0});
  return {negated:true,preventedHP:qualifyingDamage};
 }
 function counterContact({opponentId,opponentRemainingHP,collisionId},now){
  advance(now);const c=state.counter;
  if(!c||c.phase!=='charging'||!opponentId||!collisionId)return false;
  c.phase='completed';
  dispatch('arena:stun-request',{opponentId,durationMs:RULES.a2.counterStunMs,source:'A2',damage:0});
  dispatch('arena:disarm-request',{opponentId,source:'A2',collisionId});
  if(c.enhancedAtCast){
   // No precomputed absolute amount: the engine MUST atomically resolve
   // 10% of current target HP at application time after collision authority.
   dispatch('boxe:uppercut-finisher-vfx',{goldKey:'3',opponentId,collisionId});
   dispatch('arena:damage-request',{opponentId,kind:'A2_EMPOWERED_FINISHER',
    formula:'FRACTION_OF_REMAINING_HP',fractionRemaining:0.10,
    authoritativeRemainingAtImpact:true});
  }
  state.counter=null;return true;
 }
 function snapshot(){return {
  now:state.now,damageProgress:state.damageProgress,enhanced:state.enhanced,
  enhancedUntil:state.enhancedUntil,cooldowns:{...state.cooldowns},
  rocket:state.rocket?{phase:state.rocket.phase,returnAt:state.rocket.returnAt,cargoId:state.rocket.cargoId,pendingCargoId:state.rocket.pendingCargoId,flurryUsed:state.rocket.flurryUsed}:null,
  flurry:state.flurry?{startedAt:state.flurry.startedAt,endingAt:state.flurry.endingAt,punchCount:state.flurry.punchCount}:null,
  counterPhase:state.counter?.phase||null,carryQueue:state.carryQueue,fireCycleActive:state.fireCycleActive
 };}
 return {advance,recordRealDamage,castA1,recallA1,rocketFighterHit,flurryFighterHit,rocketGroundGunContact,
  resolveGroundGunReservation,rocketCatch,setWeaponFireCycle,castA2,interceptIncoming,counterContact,snapshot};
}
