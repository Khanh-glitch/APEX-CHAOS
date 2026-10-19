// BOXE R2 — semantic contract shared by every adapter. No arena mutation here.
// This staging module is deliberately NOT imported by shipping routes before Gold gate.
export const BOXE_ID='BOXE';
export const BOXE_BATTLE=Object.freeze({
 id:BOXE_ID,
 displayName:'BOXE — The Fist of Dawn',
 passive:{damageThreshold:300,enhancedDurationMs:3000,cooldownRecoveryMultiplier:2,reset:'after-window'},
 a1:{id:'fist-rocket',cooldownMs:15000,goldKey:'2',outboundMs:5000,cooldownStarts:'on-catch',earlyRecall:true,
   contactLaw:'relative-normal-impulse',bulletContact:'emergency-recall',baseDamage:0,
   impactStunMaxMs:350,rocketPushSpeed:320,disarm:false,maxGroundGuns:1,
   enhanced:{goldKey:'1',durationMs:2000,punchPeriodMs:85,punchCount:24,
     impactStunMaxMs:70,jabPushSpeed:165,damage:0,bodyDash:false,
     gloveIndependentBulletReturn:true,heavyEvery:6,heavyPushRatio:330/130,
     manualRecallCancelsRemaining:true,fullFlurryAutoRecallBoth:true,
     cooldownStartsAfterBothPhysicalCatches:true}},
 a2:{id:'block-and-hit',cooldownMs:20000,goldKey:'9',guardMs:1000,
   interceptedDamageMultiplier:0,baseDamage:0,counterStunMs:2000,disarm:true,
   enhanced:{goldKey:'3',finisherFractionOfRemainingHP:0.10}},
 ordinarySkillDamage:0,
 actualDamageException:'a2-enhanced-finisher',
 goldSourceSha256:'ccb889bb08cb2e741c4f7f5e0b33d08047c08fb28bfc1c31ae9401604444e2b2'
});
// F1: the BOXE_WAVE staging config (wave-5/10 bosses, unlock-* ids) was deleted
// with the rest of the src/game/botWave prototypes. BOT WAVE production truth
// lives in public/game/bot-wave/waveCampaign.js + the pilot in
// public/bot-wave/game.html and is gated by the testBotWave*/testBoxe* suites.
