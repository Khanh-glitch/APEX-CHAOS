// Two owner-accepted Gold packs. Family inventory is REVIEWED DATA, not
// another execution authority: every pass points at the real renderer.
// Registration fails closed if a required pass or event family is omitted.
import {cosmetics} from './cosmeticAuthority.js';
import {rocketGoldAssets,drawRocketGoldWeapon,drawRocketGoldProjectile,drawRocketGoldBlast} from './rocketVuaHeGold.js';
import {prepareEcoGold,drawEcoGoldActor} from './ecoNewbotV17Gold.js';
import {drawEcoGoldWorldBack,drawEcoGoldWorldFront,drawEcoGoldTargetLock,drawEcoGoldTargetMeasure} from './ecoNewbotV17WorldGold.js';

const rocketVisualContract={
 version:1,ownerReference:'APEX_CHAOS_Rocket_Vua_He_FACE_GOLD / V7',
 requiredPasses:['weapon','projectile','blast'],
 families:[
  {name:'held-launcher',nativeSource:'arsenalWeaponRuntime.equip',passes:['weapon'],proof:'tools/testOwnerGoldSkinsChrome.mjs'},
  {name:'rocket-flight-smoke',nativeSource:'arsenalWeaponRuntime.v43Spawn',passes:['projectile'],proof:'tools/testGoldRocketSmokeSampling.mjs'},
  {name:'rocket-native-detonation',nativeSource:'arsenalWeaponRuntime.v43DetonateRocket',passes:['blast'],proof:'tools/testOwnerGoldSkinsChrome.mjs'},
 ]
};
const ecoFamilies=[
 ['actor-pose','robotCosmeticMotion',['actor'],'tools/testOwnerGoldSkinsChrome.mjs'],
 ['target-lock','RobotA1Lock',['targetLock'],'tools/testEcoGoldTargetFamily.mjs'],
 ['target-measure','RobotA1Lock',['targetMeasure'],'tools/testEcoGoldTargetFamily.mjs'],
 ...['a1-launch','a1-contact','a1-fail','a2-on','a2-off',
     'passive','hit','wall','fire'].map(name=>[
       name,'ecoFx:'+name,['worldBack','worldFront'],'tools/testOwnerGoldSkinsChrome.mjs'
     ])
].map(([name,nativeSource,passes,proof])=>({name,nativeSource,passes,proof}));
const ecoVisualContract={
 version:1,ownerReference:'ECO_NEWBOT_RECYCLE_CORE_V17.html',
 requiredPasses:['actor','worldBack','worldFront','targetLock','targetMeasure'],
 families:ecoFamilies
};

cosmetics.register({
 kind:'weapon',baseId:'RPG_7',id:'vua-he',label:'VUA HỀ — THE LAST LAUGH',
 detail:'Owner Gold / native RPG-7 · V7 smoke and original complete face frame',
 preview:'/assets/skins/rocket-vua-he/launcher.png',assets:rocketGoldAssets,
 fidelity:'owner-gold', visualContract:rocketVisualContract,
 suppressBaseBlast:true,suppressBaseTrail:true,blastSeconds:1.38,trailHistorySeconds:.87,
 render:{weapon:drawRocketGoldWeapon,projectile:drawRocketGoldProjectile,blast:drawRocketGoldBlast}
});
cosmetics.register({
 kind:'hero',baseId:'ROBOT',id:'ecobot',label:'ECOBOT — RECYCLE CORE V17',
 detail:'Owner Gold · forest-jade mechanical layers · native NEWBOT springs',
 assets:[],prepare:prepareEcoGold,
 fidelity:'owner-gold',visualContract:ecoVisualContract,
 render:{actor:drawEcoGoldActor,worldBack:drawEcoGoldWorldBack,worldFront:drawEcoGoldWorldFront,
  targetLock:drawEcoGoldTargetLock,targetMeasure:drawEcoGoldTargetMeasure}
});
