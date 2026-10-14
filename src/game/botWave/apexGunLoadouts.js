// BOT WAVE Arsenal loadouts R3. Source: public/game/arsenal/arsenalConfig.js
// Direct weapon fields mirror native Arsenal; reloading and enemy threat values
// are EXPLICIT wave-mode tuning and MUST NOT modify the shared Arsenal registry.
// No training-orb logic. Robots are carriers/HP only; weapon drives real danger.
// This module provides pressure contracts, NOT projectile gameplay authority.
const GUNS=Object.freeze({
 PISTOL:Object.freeze({ammo:3,shots:3,interval:.22,rawDamage:4.5,bulletSpeed:2600,bulletLife:1,spread:.05,reload:1.30,enemyScale:.32,hitWeight:.47,threat:'accurate-single'}),
 SMG:Object.freeze({ammo:8,shots:8,interval:.085,rawDamage:2.4,bulletSpeed:3100,bulletLife:.9,spread:.10,reload:1.80,enemyScale:.34,hitWeight:.38,threat:'suppression'}),
 SHOTGUN:Object.freeze({ammo:4,pellets:8,interval:.95,rawDamage:3.6,bulletSpeed:2500,bulletLife:.17,cone:.62,reload:2.35,enemyScale:.31,hitWeight:.16,threat:'close-burst'}),
 SNIPER:Object.freeze({ammo:1,aimTime:.8,interval:1.45,rawDamage:26,bulletSpeed:5800,bulletLife:1,reload:2.80,enemyScale:.29,hitWeight:.30,threat:'telegraphed-line'}),
 GRENADE:Object.freeze({ammo:1,fuse:1.4,blastRadius:155,interval:1.70,rawDamage:20,throwSpeed:540,reload:3.40,enemyScale:.31,hitWeight:.47,threat:'area-denial'})
});
export const APEX_WAVE_GUNS=GUNS;
export const ARSENAL_NATIVE_DAMAGE_SCALE=7;
// Temporary balance recommendation for the first active BOXE chapter. Revision
// will require observed real Chrome win/loss data, not standalone DPS guessing.
export const BOXE_WAVE_SURVIVAL=Object.freeze({
 initialHP:1650,baseOnKillHealFraction:.012,
 betweenWaveHealFraction:.16,bossWaveHealFraction:.22,
 activeRobotSoftCapLow:6,activeRobotSoftCapHigh:11,
 perWaveDamageSlope:.055
});
const TABLE=Object.freeze([
 {wave:1,label:'FIRST CONTACT',roster:[['PISTOL',6]],boss:null},
 {wave:2,label:'BURST FIRE',roster:[['PISTOL',5],['SMG',3]],boss:null},
 {wave:3,label:'CLOSE QUARTERS',roster:[['PISTOL',4],['SMG',4],['SHOTGUN',2]],boss:null},
 {wave:4,label:'CROSS FIRE',roster:[['PISTOL',4],['SMG',4],['SHOTGUN',2],['SNIPER',2]],boss:null},
 {wave:5,label:'BOSS IRON SENTINEL',roster:[['PISTOL',2],['SMG',4],['SHOTGUN',4]],boss:'SMG'},
 {wave:6,label:'SUPPRESSION GRID',roster:[['SMG',6],['SHOTGUN',4],['SNIPER',4]],boss:null},
 {wave:7,label:'PINCH MOVEMENT',roster:[['PISTOL',2],['SMG',7],['SHOTGUN',4],['SNIPER',3]],boss:null},
 {wave:8,label:'AREA DENIAL',roster:[['SMG',7],['SHOTGUN',5],['GRENADE',4],['SNIPER',2]],boss:null},
 {wave:9,label:'FIRESTORM',roster:[['GRENADE',5],['SMG',7],['SNIPER',5],['SHOTGUN',3]],boss:null},
 {wave:10,label:'BOSS OMEGA ARSENAL',roster:[['GRENADE',5],['SMG',7],['SHOTGUN',4],['SNIPER',1]],boss:'GRENADE'}
]);
export const APEX_WAVE_LOADOUTS=TABLE;
function seedRng(seed){let s=(Number(seed)>>>0)||0x8cb028f7;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
export function weaponThreatBudget(id){
 const g=GUNS[id];if(!g)throw Error('UNKNOWN_APEX_WAVE_GUN_'+id);
 const attacks=g.pellets||1;
 const cycle=(g.ammo*g.interval)+g.reload;
 return +((g.ammo*attacks*g.rawDamage*ARSENAL_NATIVE_DAMAGE_SCALE*g.enemyScale*g.hitWeight)/cycle).toFixed(3);
}
export function getWaveLoadout(wave,{seed=1}={}){
 if(!Number.isInteger(wave)||wave<1)throw Error('INVALID_WAVE');
 const base=TABLE[Math.min(10,wave)-1];
 const random=seedRng((seed^Math.imul(wave,0x9e3779b1))>>>0);
 const guns=base.roster.flatMap(([id,count])=>Array.from({length:count},()=>id));
 for(let i=guns.length-1;i>0;i--){const k=Math.floor(random()*(i+1));[guns[i],guns[k]]=[guns[k],guns[i]];}
 const waveBoss=wave%5===0;const bossGun=waveBoss?(wave<=10?base.boss:(wave%10===0?'GRENADE':'SMG')):null;
 const gunThreat=Object.keys(GUNS).map(id=>({id,pressure:weaponThreatBudget(id)}));
 const pressure=guns.reduce((t,id)=>t+weaponThreatBudget(id),0) + (bossGun?weaponThreatBudget(bossGun)*1.5:0);
 const scale=1+.055*(wave-1);
 return Object.freeze({
  wave,label:wave<=10?base.label:'ENDLESS '+wave,composition:Object.freeze(guns),
  bossGun,boss:!!bossGun,pressureEstimate:+(pressure*scale).toFixed(2),
  weaponPressure:Object.freeze(gunThreat),damageScalar:scale,
  // Both cap and varied gun composition matter. HP growth is a secondary
  // property of the ENEMY registry; never the sole progression mechanism.
  concurrentLimit:Math.min(11,6+Math.floor(wave/2)),
  reloadPolicy:'KEEP_WEAPON_AND_REFILL_MAGAZINE',
  source:'APEX_ARSENAL_CONFIG + BOT_WAVE_TUNING_R3'
 });
}
export function makeWaveEnemyEquipment(gunId,wave,{boss=false}={}){
 const g=GUNS[gunId];if(!g)throw Error('UNKNOWN_APEX_WAVE_GUN_'+gunId);
 return Object.freeze({
  gunId,magazineCapacity:g.ammo,ammo:g.ammo,shotsPerBurst:g.shots||1,
  pellets:g.pellets||1,cadenceSeconds:g.interval,reloadSeconds:g.reload*(boss?.85:1),
  projectileNativeSpeed:g.bulletSpeed||g.throwSpeed,
  damageFromArsenal:g.rawDamage,damageScale:ARSENAL_NATIVE_DAMAGE_SCALE*g.enemyScale*(1+.055*(wave-1))*(boss?1.16:1),
  timingKind:g.threat,aimTelegraphSeconds:g.aimTime||0,
  bulletsReloadInsteadOfDiscard:true,owner:'enemy-robot'
 });
}
