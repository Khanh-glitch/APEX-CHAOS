// BOXE BOT WAVE R4 — immutable source-derived timing contract.
// The Gold source retains authority over animation/VFX. These timestamps are
// only for scheduling validated combo stages; no artificial substitute FX.
export const GOLD_J_COMBO=Object.freeze({
 basic:Object.freeze([
  {index:1,hand:'L',recoveryMs:260,impactDelayMs:90,heavy:false},
  {index:2,hand:'R',recoveryMs:260,impactDelayMs:90,heavy:false},
  {index:3,hand:'L',recoveryMs:420,impactDelayMs:130,heavy:true}
 ]),
 jab:Object.freeze({goldKey:'1',punches:6,punchSpacingMs:85,impactDelayMs:50,startAfterHeavyMs:420}),
 uppercut:Object.freeze({goldKey:'3',startAfterHeavyMs:980,impactDelayMs:170,releaseAfterHeavyMs:1280}),
 rocket:Object.freeze({goldKey:'2',unlockCard:'unlock-rocket-proc',chancePerConfirmedPunch:.075,
  maxDetachedGloves:1,outboundMs:5000,requiresCollision:true}),
 // Fire or empowered state may alter cooldown recovery but never Gold beat spacing.
 chainOrder:Object.freeze(['BASIC_1','BASIC_2','BASIC_3','GOLD_1_JAB','GOLD_3_UPPERCUT'])
});
export function makeJComboBeats({jabUnlocked=false,jabReady=true,uppercutUnlocked=false,uppercutReady=true}={}){
 const beats=[];let t=0;
 for(const hit of GOLD_J_COMBO.basic){beats.push({type:'basic',step:hit.index,startMs:t,impactMs:t+hit.impactDelayMs,hand:hit.hand});t+=hit.recoveryMs;}
 const heavyStart=GOLD_J_COMBO.basic[0].recoveryMs+GOLD_J_COMBO.basic[1].recoveryMs;
 if(!jabUnlocked||!jabReady)return {beats,releaseMs:t};
 const jabStart=heavyStart+GOLD_J_COMBO.jab.startAfterHeavyMs;
 for(let i=0;i<6;i++){
  const startMs=jabStart+i*85;
  beats.push({type:'Gold1',goldKey:'1',step:i+1,hand:i%2?'R':'L',
   startMs,impactMs:startMs+GOLD_J_COMBO.jab.impactDelayMs});
 }
 if(uppercutUnlocked&&uppercutReady){
  const upStart=heavyStart+GOLD_J_COMBO.uppercut.startAfterHeavyMs;
  beats.push({type:'Gold3',goldKey:'3',startMs:upStart,
   impactMs:upStart+GOLD_J_COMBO.uppercut.impactDelayMs,hand:'R'});
  return {beats,releaseMs:heavyStart+GOLD_J_COMBO.uppercut.releaseAfterHeavyMs};
 }
 return {beats,releaseMs:heavyStart+GOLD_J_COMBO.uppercut.startAfterHeavyMs};
}
export function rocketProcEligible({unlocked=false,confirmedHit=false,detachedGloveCount=0,
 cooldownReady=false,pending=false}={}){
 return !!(unlocked&&confirmedHit&&!pending&&detachedGloveCount<1&&cooldownReady);
}
export function rocketProcRoll(sample,state){
 if(!(typeof sample==='number'&&Number.isFinite(sample)&&sample>=0&&sample<1))throw Error('INVALID_RNG_SAMPLE');
 return rocketProcEligible(state)&&sample<GOLD_J_COMBO.rocket.chancePerConfirmedPunch;
}
