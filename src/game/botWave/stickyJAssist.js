// Gold BOT WAVE J approach planner (R5).
// Authoritative decision, not motion implementation: native Gold dash() owns
// displacement, VFX, SFX, hitstop, i-frames and shared L cooldown.
export const WAVE_STICKY_ASSIST=Object.freeze({
  minGap:190,maxGap:370,desiredDistance:157,maxDashSeconds:.17,
  nominalDashSpeed:1250,requiresNativeDashReady:true
});
export function planStickyJ({player,target,ready=true,comboLocked=false,paused=false}={}){
 if(!ready||comboLocked||paused||!player||!target||target.dead)return null;
 const dx=target.x-player.x,dy=target.y-player.y;
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return null;
 const distance=Math.hypot(dx,dy)-(Number(target.r)||0);
 if(distance<=WAVE_STICKY_ASSIST.minGap||distance>WAVE_STICKY_ASSIST.maxGap)return null;
 const seconds=Math.min(WAVE_STICKY_ASSIST.maxDashSeconds,
   Math.max(.045,(distance-WAVE_STICKY_ASSIST.desiredDistance)/WAVE_STICKY_ASSIST.nominalDashSpeed));
 return Object.freeze({targetId:target.id,direction:Math.atan2(dy,dx),
  seconds,stopDistance:WAVE_STICKY_ASSIST.desiredDistance,consumesNativeDash:true});
}
