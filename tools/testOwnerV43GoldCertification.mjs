// FAIL-CLOSED Gold fidelity certification for V4.3.
// "Product Acceptance SUCCESS" = game works, NOT = owner Gold look copied.
// This is a separate required evidence contract; a missing phase remains RED.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const strict=process.argv.includes('--strict');
const SOURCE_SHA='8db9ce58c0a61171ab76bcd5b18dea21564b45c76663d93fc28e61eaefdcd38d';

// Exact source-Canvas gates already implemented; pass only if their EXECUTABLE
// Node tests run successfully. Every new proof needs an actual new test here.
const tests={
 'source:airfoil':'tools/testOwnerV43GoldAirfoilParity.mjs',
 'source:natural-flight':'tools/testOwnerV43BoomerangNaturalFlight.mjs',
 'source:blast':'tools/testOwnerV43GoldBlastParity.mjs',
 'source:flame':'tools/testOwnerV43GoldFlameParity.mjs',
 'source:plasma-transport':'tools/testOwnerV43GoldPlasmaParity.mjs',
 'source:ribbons':'tools/testOwnerV43GoldFlightRibbons.mjs',
 'source:armed-mine':'tools/testOwnerV43GoldMineArming.mjs',
};

// Every weapon needs the *whole experience*, not one luminous pixel. Each
// key means an independently verified phase, not an asserted visual label.
// Missing keys below deliberately BLOCK release instead of outsourcing
// detection to the owner after every build.
const matrix={
 FLARE_GUN:{
  ready:['gold:held-motion'],attack:['source:flame','source:ribbons','gold:flare-ignition-release-motion'],
  contact:['gold:flare-impact'],afterglow:['gold:burn-particles'],
  counter:['gold:flare-Crystal-Magnet-motion']},
 TACTICAL_CROSSBOW:{
  ready:['gold:crossbow-recoil'],attack:['source:ribbons','gold:bolt-accelerating-motion'],
  contact:['gold:bolt-tip-and-impact'],afterglow:['gold:bolt-decay'],
  counter:['gold:bolt-Crystal-Magnet-motion']},
 STEEL_BALL_LAUNCHER:{
  ready:['gold:steelball-recoil'],attack:['source:ribbons','gold:physical-ball-launch-motion'],
  contact:['gold:bank-ricochet'],afterglow:['gold:steelball-contact'],
  counter:['gold:steelball-Crystal-Magnet-motion']},
 COMBAT_BOOMERANG:{
  ready:['gold:throw-release'],attack:['source:airfoil','source:natural-flight','gold:complete-release-flight-and-catch'],
  contact:['gold:two-leg-hit-and-catch'],afterglow:['gold:weapon-return-pose'],
  counter:['gold:boomerang-redirect-motion']},
 RPG_7:{
  ready:['gold:rpg-recoil'],attack:['source:ribbons','gold:rpg-thrust-and-smoke-motion'],
  contact:['source:blast','gold:rpg-impact-and-debris'],afterglow:['gold:rpg-soft-smoke'],
  counter:['gold:rpg-Crystal-Magnet-motion']},
 FLAMETHROWER:{
  ready:['gold:flame-held-animation'],attack:['source:flame','gold:470-rate-emission-field'],
  contact:['gold:flame-contact'],afterglow:['gold:470-particles-and-burn'],
  counter:['gold:flame-counter-identity']},
 PLASMA_SPLITTER:{
  ready:['gold:charge-rings-and-crop'],attack:['source:plasma-transport','gold:core-flight-and-three-split-motion'],
  contact:['gold:core-and-three-split'],afterglow:['gold:plasma-impact'],
  counter:['gold:plasma-Crystal-split-motion']},
 SHRAPNEL_MINE_LAUNCHER:{
  ready:['gold:mine-recoil'],attack:['gold:mine-flight'],
  contact:['source:armed-mine','source:blast','gold:mine-arm-to-contact-transition'],
  afterglow:['gold:mine-pressure-and-shrapnel'],
  counter:['gold:mine-Crystal-Magnet-motion']},
};
const expectedIds=['FLARE_GUN','TACTICAL_CROSSBOW','STEEL_BALL_LAUNCHER',
 'COMBAT_BOOMERANG','RPG_7','FLAMETHROWER','PLASMA_SPLITTER','SHRAPNEL_MINE_LAUNCHER'];
if(JSON.stringify(Object.keys(matrix))!==JSON.stringify(expectedIds))
 throw Error('Gold certification MUST cover all 8 canonical V4.3 IDs');
const results={};
for(const [proof,file] of Object.entries(tests)){
 if(!fs.existsSync(file))throw Error('Missing original Gold proof program: '+file);
 const proc=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:60000});
 results[proof]=proc.status===0&&!proc.error;
 console.log((results[proof]?'PASS':'FAIL')+' GOLD SOURCE PROOF '+proof+' '+file);
 if(!results[proof])console.error((proc.stderr||proc.stdout||String(proc.error)).slice(-1800));
}
let passed=0,needed=0;
const outstanding=[];
for(const [weapon,phases] of Object.entries(matrix)){
 for(const [phase,evidence] of Object.entries(phases)){
  const missing=evidence.filter(id=>results[id]!==true);
  needed++;
  if(missing.length===0){passed++;console.log('VERIFIED '+weapon+'/'+phase+' '+evidence.join(','));}
  else{outstanding.push({weapon,phase,missing});console.log('UNVERIFIED '+weapon+'/'+phase+' '+missing.join(','));}
 }
}
const report={
 status:outstanding.length?'BLOCKED':'GOLD_CERTIFIED',
 baselineGoldHtmlSha256:SOURCE_SHA,
 sourceProofsPassed:Object.values(results).filter(Boolean).length,
 sourceProofsTotal:Object.keys(tests).length,
 phaseGatesPassed:passed,phaseGatesTotal:needed,outstanding,
};
console.log('GOLD_FIDELITY_CERTIFICATION '+JSON.stringify(report));
if(Object.values(results).some(x=>!x))process.exitCode=1;
if(strict&&outstanding.length){
 console.error('GOLD RELEASE BLOCKED: '+outstanding.length+'/'+needed+
  ' entire-weapon visual/motion phases still lack repeatable objective Gold evidence.');
 process.exitCode=1;
}
