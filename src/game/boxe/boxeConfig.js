// BOXE R2 — semantic contract shared by every adapter. No arena mutation here.
// This staging module is deliberately NOT imported by shipping routes before Gold gate.
export const BOXE_ID='BOXE';
export const BOXE_BATTLE=Object.freeze({
 id:BOXE_ID,
 displayName:'BOXE — The Fist of Dawn',
 passive:{damageThreshold:300,enhancedDurationMs:3000,cooldownRecoveryMultiplier:2,reset:'after-window'},
 a1:{id:'fist-rocket',cooldownMs:15000,goldKey:'2',outboundMs:5000,baseDamage:0,
   impactStunMs:500,disarmOnEveryDistinctHit:true,maxGroundGuns:1,
   enhanced:{goldKey:'1',durationMs:2000,punchPeriodMs:85,impactStunMs:42.5,damage:0,bodyDash:false}},
 a2:{id:'block-and-hit',cooldownMs:20000,goldKey:'9',guardMs:1000,
   interceptedDamageMultiplier:0,baseDamage:0,counterStunMs:2000,disarm:true,
   enhanced:{goldKey:'3',finisherFractionOfRemainingHP:0.10}},
 ordinarySkillDamage:0,
 actualDamageException:'a2-enhanced-finisher',
 goldSourceSha256:'ccb889bb08cb2e741c4f7f5e0b33d08047c08fb28bfc1c31ae9401604444e2b2'
});
export const BOXE_WAVE=Object.freeze({
 startingInputs:Object.freeze(['J','K','L']),
 controls:Object.freeze({
   J:{base:'basic-punch',goldKey:null},
   K:{base:'basic-defense',goldKey:null},
   L:{base:'dash',goldKey:null},
   U:{base:null,goldKey:'5',unlock:'unlock-phantom'},
   I:{base:null,goldKey:'0',unlock:'unlock-ultimate'}
 }),
 goldUpgradeOrder:Object.freeze([
   {rank:1,id:'unlock-jab-finisher',goldKey:'1',bind:'J'},
   {rank:2,id:'unlock-uppercut-finisher',goldKey:'3',bind:'J'},
   {rank:3,id:'unlock-counter',goldKey:'9',bind:'K'},
   {rank:4,id:'unlock-phantom',goldKey:'5',bind:'U'},
   {rank:5,id:'unlock-ultimate',goldKey:'0',bind:'I'}
 ]),
 rocketProc:Object.freeze({goldKey:'2',perConfirmedPunchProbability:0.075,flightMs:5000,
   maxDetachedGloves:1,requiresUpgradeId:'unlock-rocket-proc',requiresConfirmedPunchHit:true}),
 initialChapterWaves:10,
 bossesAt:Object.freeze([5,10]),
 mobileAim:'auto-target',
 removedVfxFamilies:Object.freeze(['cloth-ribbons-only'])
});
