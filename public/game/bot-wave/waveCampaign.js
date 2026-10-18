// BOT WAVE — runtime campaign director. This file has no fixed wave limit.
// The 41 equipable weapons are taken ONLY from live Arsenal P0_WEAPON_IDS.
// BOT WAVE uses the current Free Battle post-x7 gun numbers and native aim
// exactly as delivered by arsenalConfig + arsenalIdentityRuntime +
// arsenalWeaponRuntime. This director only controls carrier count, spawn
// lanes/intervals, enemy HP, mixtures and recovery; it never rescales gun
// damage, cadence, spread or projectiles.
(function(root){
'use strict';
const ROLE_WEIGHT=Object.freeze({
 SEMI:1,AUTO:2,BURST:3,SHOTGUN:4,PRECISION:5,AUTOSHOT:6,
 GRENADE:7,MELEE:8,SHIELD:9,SPECIAL:10
});
const FAMILY_PROFILES=Object.freeze({
 fodder:Object.freeze({SEMI:5,AUTO:3,BURST:2.2,SHOTGUN:.7,PRECISION:.25,AUTOSHOT:.35,GRENADE:.35,MELEE:1.4,SHIELD:.5,SPECIAL:.2}),
 mixed:Object.freeze({SEMI:2.2,AUTO:1.8,BURST:1.8,SHOTGUN:1.2,PRECISION:.8,AUTOSHOT:.9,GRENADE:.9,MELEE:1.4,SHIELD:1,SPECIAL:.7}),
 hard:Object.freeze({SEMI:1.4,AUTO:1.7,BURST:1.9,SHOTGUN:1.8,PRECISION:1.5,AUTOSHOT:1.7,GRENADE:1.6,MELEE:1.5,SHIELD:1.4,SPECIAL:1.5})
});
// One cluster is a full ten-wave up/down arc:
// farm -> two teaching waves -> two mixes -> pressure spike -> power farm
// -> two crescendos -> boss. The opening farm is a confidence/reset wave,
// while wave 7 intentionally trades individual enemy HP for volume so a
// built-up BOXE can feel powerful immediately before the final squeeze.
const PLAN_BEATS=Object.freeze([
 {id:'farm',caption:'OPEN FARM',cap:3,count:12,spawnInterval:.65,hpMul:.55,pressure:150,pattern:'front',heal:.10,familyWeights:FAMILY_PROFILES.fodder},
 {id:'teach',caption:'NEW THREAT',cap:3,count:9,spawnInterval:.60,hpMul:.72,pressure:175,pattern:'flank',heal:.07,familyWeights:FAMILY_PROFILES.mixed},
 {id:'teach',caption:'DEEPER THREAT',cap:4,count:11,spawnInterval:.55,hpMul:.78,pressure:200,pattern:'flank',heal:.07,familyWeights:FAMILY_PROFILES.mixed},
 {id:'mix',caption:'CROSS-PRESSURE',cap:4,count:14,spawnInterval:.50,hpMul:.84,pressure:230,pattern:'cross',heal:.065,familyWeights:FAMILY_PROFILES.mixed},
 {id:'mix',caption:'COMBINED FIRE',cap:4,count:16,spawnInterval:.46,hpMul:.88,pressure:250,pattern:'cross',heal:.065,familyWeights:FAMILY_PROFILES.mixed},
 {id:'spike',caption:'BREAKPOINT',cap:5,count:16,spawnInterval:.40,hpMul:.95,pressure:300,pattern:'pincer',heal:.08,familyWeights:FAMILY_PROFILES.hard},
 {id:'power',caption:'POWER HARVEST',cap:4,count:20,spawnInterval:.30,hpMul:.42,pressure:210,pattern:'front',heal:.09,familyWeights:FAMILY_PROFILES.fodder},
 {id:'crescendo',caption:'CRESCENDO',cap:5,count:18,spawnInterval:.38,hpMul:.92,pressure:340,pattern:'four-edge',heal:.07,familyWeights:FAMILY_PROFILES.hard},
 {id:'crescendo',caption:'FINAL PRESSURE',cap:6,count:20,spawnInterval:.34,hpMul:.98,pressure:380,pattern:'four-edge',heal:.08,familyWeights:FAMILY_PROFILES.hard},
 {id:'boss',caption:'ARSENAL GUARDIAN',cap:4,count:10,spawnInterval:.55,hpMul:.85,pressure:280,pattern:'four-edge',heal:.14,familyWeights:FAMILY_PROFILES.mixed}
]);
const EDGES=Object.freeze(['top','right','bottom','left']);
function seeded(seed){let v=(seed>>>0)||0x9e3779b9;return ()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return(v>>>0)/4294967296;};}
function familyOf(id,config){
 const native=config.WEAPONS[id];
 if(!native)throw Error('WAVE_MISSING_NATIVE_WEAPON_'+id);
 if(id==='GRENADE')return 'GRENADE';
 if(id==='STORMBREAKER'||config.MELEE_WEAPON_IDS?.includes(id))return 'MELEE';
 if(id.endsWith('_SHIELD'))return 'SHIELD';
 if(config.V43_WEAPONS?.[id])return 'SPECIAL';
 return native.family||'SEMI';
}
function indexNative(config){
 if(!config||!Array.isArray(config.P0_WEAPON_IDS)||!config.WEAPONS)throw Error('WAVE_NATIVE_ARSENAL_REQUIRED');
 const ids=config.P0_WEAPON_IDS;
 if(new Set(ids).size!==ids.length)throw Error('WAVE_DUPLICATE_NATIVE_WEAPON');
 if(ids.length!==41)throw Error('WAVE_EXPECTED_41_REGISTERED_WEAPONS_'+ids.length);
 const records=ids.map((id,ordinal)=>{
  const family=familyOf(id,config),spec=config.WEAPONS[id];
  return Object.freeze({id,ordinal,family,spec,role:family==='SHIELD'?'defend':
   family==='MELEE'?'close':family==='GRENADE'?'zone':
   family==='PRECISION'?'snipe':family==='SHOTGUN'||family==='AUTOSHOT'?'flank':
   family==='SPECIAL'?'signature':'fire'});
 });
 // Stable authored reveal order. Keep the iconic starters; defer shield/heavy
 // specials until positioning, flanks and dodging are understandable.
 const starters=['PISTOL','SMG','SHOTGUN','SNIPER','GRENADE'];
 const byRole=records.filter(r=>!starters.includes(r.id)).sort((a,b)=>
  (ROLE_WEIGHT[a.family]||10)-(ROLE_WEIGHT[b.family]||10)||a.ordinal-b.ordinal);
 const recordById=new Map(records.map(r=>[r.id,r]));
 const ordered=[...starters.map(id=>recordById.get(id)).filter(Boolean),...byRole];
 return Object.freeze({records:Object.freeze(records),ordered:Object.freeze(ordered),
  byId:recordById,allWeaponIds:Object.freeze([...ids])});
}
function revealedCount(wave,total){
 if(wave<=5)return Math.min(total,wave);
 if(wave>=30)return total;
 return Math.min(total,5+Math.floor((wave-5)*36/25));
}
function scaledPressureDamage(config,id,amount){
 const spec=config.WEAPONS[id]||{};
 if(spec.confirmedHitDamage!=null||spec.finalDamage===true)return amount;
 const scaled=(typeof config.isGun==='function'&&config.isGun(id))||
  (typeof config.isMelee==='function'&&config.isMelee(id))||id==='GRENADE'||id==='STORMBREAKER';
 return scaled?amount*(config.ARSENAL_DAMAGE_SCALE||1):amount;
}
function pressureCritMultiplier(config,id){
 if(typeof config.isGun!=='function'||!config.isGun(id))return 1;
 return 1+(config.CRIT_CHANCE?.[id]||0)*((config.CRIT_DAMAGE_MULTIPLIER||1.5)-1);
}
function pressurePelletHits(spec){
 const pellets=spec.pellets||1;if(pellets<=1)return 1;
 const hitRadius=30+(spec.bulletRadius||7);let hits=0;
 for(let i=0;i<pellets;i++){
  const t=i/(pellets-1);
  if(Math.abs(275*Math.tan((t-.5)*(spec.cone||0)))<=hitRadius)hits++;
 }
 return Math.max(1,hits);
}
function pressureCycleSeconds(config,spec,family){
 const ready=config.RANGED_READY_DELAY_SECONDS||.35;
 const rearm=family==='PRECISION'||family==='SPECIAL'?1.35:
  family==='SHOTGUN'||family==='AUTOSHOT'?1.2:.85;
 if(family==='PRECISION')
  return ready+(spec.aimTime||.5)+Math.max(0,(spec.shots||1)-1)*(spec.interval||.45)+rearm;
 if(family==='SHOTGUN'&&!spec.shots)return ready+rearm;
 const shots=Math.max(1,spec.shots||1),interval=spec.interval||0;let firing=0;
 for(let shot=1;shot<=shots;shot++){
  const burstEnd=spec.burstSize&&shot%spec.burstSize===0&&shot<shots;
  const step=burstEnd?(spec.burstPause||interval):interval;
  if(shot<shots||!(family==='AUTOSHOT'||family==='SHOTGUN'||shots===1))firing+=step;
 }
 return ready+firing+rearm;
}
function specialPressureDamage(spec){
 if(spec.direct)return spec.direct+(spec.burnTicks||0)*(spec.burnDamage||0);
 if(spec.outgoing)return spec.outgoing+(spec.returning||0);
 if(spec.ticks)return spec.ticks*(spec.tickDamage||0)+(spec.burnTicks||0)*(spec.burnDamage||0);
 if(spec.coreDamage)return spec.coreDamage+(spec.shardDamage||0);
 if(spec.peak)return spec.peak+(spec.maxFragmentHits||0)*(spec.fragmentDamage||0);
 return spec.damage||spec.maxDamage||80;
}
function weaponPressure(record,config){
 const {id,family,spec}=record;
 if(family==='SHIELD')return 0;
 if(family==='SPECIAL')return +(specialPressureDamage(spec)/2.9).toFixed(3);
 if(id==='GRENADE')
  return +(scaledPressureDamage(config,id,spec.maxDamage||20)*.65/1.95).toFixed(3);
 if(family==='MELEE'){
  const input=typeof config.meleeDamage==='function'?config.meleeDamage(id):(spec.damage||0);
  return +(scaledPressureDamage(config,id,input)/2.2).toFixed(3);
 }
 const shots=Math.max(1,spec.shots||1);
 const perShot=family==='PRECISION'?scaledPressureDamage(config,id,spec.damage||0):
  (spec.pellets||1)>1?scaledPressureDamage(config,id,spec.damagePerPellet||0)*pressurePelletHits(spec):
  scaledPressureDamage(config,id,spec.damagePerShot||spec.damage||0);
 return +(perShot*shots*pressureCritMultiplier(config,id)/
  pressureCycleSeconds(config,spec,family)).toFixed(3);
}
function planWave(nativeConfig,wave,{seed=41}={}){
 if(!Number.isInteger(wave)||wave<1)throw Error('WAVE_INVALID_INDEX');
 const catalog=indexNative(nativeConfig);
 const pressureById=new Map(catalog.records.map(r=>[r.id,weaponPressure(r,nativeConfig)]));
 const clusterWave=((wave-1)%10)+1;
 const beat=PLAN_BEATS[clusterWave-1];
 const cluster=Math.floor((wave-1)/10)+1;
 const rand=seeded((seed^Math.imul(wave,0x9e3779b1))>>>0);
 // The five starters debut one per wave. The remaining 36 identities then
 // debut across waves 6-30. Every newly revealed weapon is guaranteed an
 // actual carrier slot in that wave, not merely a catalogue entry. From
 // cluster 4 onward the full pool is remixed with rising density/HP.
 const revealed=revealedCount(wave,catalog.ordered.length);
 const previous=wave===1?0:revealedCount(wave-1,catalog.ordered.length);
 const newly=catalog.ordered.slice(previous,revealed);
 const available=catalog.ordered.slice(0,revealed);
 const weights=available.map(r=>beat.familyWeights[r.family]??1);
 const totalWeight=weights.reduce((sum,v)=>sum+v,0)||1;
 function weightedPick(){
  let roll=rand()*totalWeight;
  for(let i=0;i<available.length;i++){roll-=weights[i];if(roll<0)return available[i];}
  return available[available.length-1];
 }
 const featured=wave===1?catalog.byId.get('PISTOL'):
  newly.length?newly[Math.floor(rand()*newly.length)]:weightedPick();
 let count=beat.id==='boss'?Math.min(15,beat.count+Math.floor((cluster-1)/2)):
  Math.min(34,beat.count+(cluster-1));
 let concurrentLimit=Math.min(8,beat.cap+Math.floor((cluster-1)/4));
 let spawnInterval=Math.max(.24,beat.spawnInterval-Math.min(.05,(cluster-1)*.005));
 let pressureBudget=Math.round(beat.pressure*(1+Math.min(.25,(cluster-1)*.03)));
 if(wave===1){count=6;concurrentLimit=2;spawnInterval=.70;pressureBudget=110;}
 else if(wave===2){count=7;concurrentLimit=3;spawnInterval=.62;pressureBudget=150;}
 else if(wave===3){count=9;concurrentLimit=3;spawnInterval=.58;pressureBudget=170;}
 count=Math.max(count,newly.length+(beat.id==='boss'?1:0));
 const slots=Math.max(0,count-(beat.id==='boss'?1:0));
 const roster=[];
 const edgeOffset=Math.floor(rand()*4);
 if(beat.id==='boss'){
  // The boss is first in the spawn queue: it is the readable centerpiece
  // while the remaining composition trickles in as escorts under the cap.
  const elitePool=available.filter(r=>(ROLE_WEIGHT[r.family]||0)>=7);
  const pick=newly.length?featured:(elitePool.length?elitePool[Math.floor(rand()*elitePool.length)]:featured);
  roster.push(Object.freeze({weaponId:pick.id,family:pick.family,role:pick.role,
   pressure:pressureById.get(pick.id)||0,edge:'bottom',edgeFraction:.5,boss:true}));
 }
 for(let i=0;i<slots;i++){
  let pick;
  if(i<newly.length)pick=newly[i];
  else if(wave===1||i===newly.length)pick=featured;
  else pick=weightedPick();
  const edge=beat.pattern==='front'?'top':
   beat.pattern==='flank'?(i%2?'right':'left'):
   beat.pattern==='pincer'?(i%2?'bottom':'top'):
   EDGES[(i+edgeOffset)%4];
  roster.push(Object.freeze({weaponId:pick.id,family:pick.family,role:pick.role,
   pressure:pressureById.get(pick.id)||0,edge,edgeFraction:.1+.8*rand(),boss:false}));
 }
 const endlessHpScale=1+Math.min(.18,Math.max(0,cluster-3)*.025);
 return Object.freeze({wave,chapter:cluster,cluster,clusterWave,
  beat:beat.id,title:beat.caption,boss:beat.id==='boss',
  newWeapons:Object.freeze(newly.map(x=>x.id)),
  revealedWeapons:revealed,totalWeapons:catalog.allWeaponIds.length,
  composition:Object.freeze(roster),
  concurrentLimit,
  spawnInterval:+spawnInterval.toFixed(4),
  pressureBudget,
  enemyHpMultiplier:+(beat.hpMul*endlessHpScale).toFixed(4),
  bossHp:beat.id==='boss'?Math.min(9000,1700+cluster*550):0,
  betweenWaveHealFraction:beat.heal,
  reloadPolicy:'KEEP_WEAPON_AND_REFILL_MAGAZINE',
  gunDamageScalar:1,gunCadenceScalar:1,gunProjectileSpeedScalar:1,
  damageAuthority:'FREE_BATTLE_POST_X7',infinite:true});
}
// Pressure comes from real Arsenal guns, directions, survival HP and recovery,
// never from altering weapon damage, accuracy, cadence or projectile physics.
const SURVIVAL=Object.freeze({startingHP:1000,baseKillHealFraction:.005,
 healthPack:Object.freeze({dropChance:.04,healFraction:.10,lifetimeSeconds:8,maxActive:1})});
const API=Object.freeze({indexNative,planWave,beats:PLAN_BEATS,survival:SURVIVAL,clusterLength:10});
root.APEX_BOT_WAVE_CAMPAIGN=API;
})(typeof window!=='undefined'?window:globalThis);
