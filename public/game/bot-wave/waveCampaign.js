// BOT WAVE — runtime campaign director. This file has no fixed wave limit.
// The 41 equipable weapons are taken ONLY from live Arsenal P0_WEAPON_IDS.
// BOT WAVE uses the current Free Battle post-x7 gun numbers and native aim
// exactly as delivered by arsenalConfig + arsenalWeaponRuntime. This director
// only controls carrier count, spawn lanes/intervals, enemy HP, mixtures and
// recovery; it never rescales gun damage, cadence, spread or projectiles.
(function(root){
'use strict';
const ROLE_WEIGHT=Object.freeze({
 SEMI:1,AUTO:2,BURST:3,SHOTGUN:4,PRECISION:5,AUTOSHOT:6,
 GRENADE:7,MELEE:8,SHIELD:9,SPECIAL:10
});
const FAMILY_PROFILES=Object.freeze({
 fodder:Object.freeze({SEMI:5,AUTO:4,BURST:3,SHOTGUN:1.2,PRECISION:.5,AUTOSHOT:.6,GRENADE:.5,MELEE:1,SHIELD:.3,SPECIAL:.35}),
 mixed:Object.freeze({SEMI:2,AUTO:2,BURST:2,SHOTGUN:2,PRECISION:1.4,AUTOSHOT:1.5,GRENADE:1.3,MELEE:1.2,SHIELD:1,SPECIAL:1}),
 hard:Object.freeze({SEMI:1,AUTO:1.5,BURST:2,SHOTGUN:2.5,PRECISION:3,AUTOSHOT:3,GRENADE:3,MELEE:1.5,SHIELD:2,SPECIAL:3})
});
// One cluster is a full ten-wave up/down arc:
// farm -> two teaching waves -> two mixes -> pressure spike -> power farm
// -> two crescendos -> boss. The opening farm is a confidence/reset wave,
// while wave 7 intentionally trades individual enemy HP for volume so a
// built-up BOXE can feel powerful immediately before the final squeeze.
const PLAN_BEATS=Object.freeze([
 {id:'farm',caption:'OPEN FARM',cap:6,count:14,spawnInterval:.50,hpMul:.68,pattern:'front',heal:.08,familyWeights:FAMILY_PROFILES.fodder},
 {id:'teach',caption:'NEW THREAT',cap:6,count:10,spawnInterval:.46,hpMul:.90,pattern:'flank',heal:.05,familyWeights:FAMILY_PROFILES.mixed},
 {id:'teach',caption:'DEEPER THREAT',cap:7,count:12,spawnInterval:.43,hpMul:.95,pattern:'flank',heal:.05,familyWeights:FAMILY_PROFILES.mixed},
 {id:'mix',caption:'CROSS-PRESSURE',cap:7,count:16,spawnInterval:.40,hpMul:1,pattern:'cross',heal:.045,familyWeights:FAMILY_PROFILES.mixed},
 {id:'mix',caption:'COMBINED FIRE',cap:8,count:18,spawnInterval:.37,hpMul:1.03,pattern:'cross',heal:.045,familyWeights:FAMILY_PROFILES.mixed},
 {id:'spike',caption:'BREAKPOINT',cap:8,count:18,spawnInterval:.32,hpMul:1.12,pattern:'pincer',heal:.055,familyWeights:FAMILY_PROFILES.hard},
 {id:'power',caption:'POWER HARVEST',cap:8,count:24,spawnInterval:.22,hpMul:.55,pattern:'front',heal:.07,familyWeights:FAMILY_PROFILES.fodder},
 {id:'crescendo',caption:'CRESCENDO',cap:9,count:20,spawnInterval:.30,hpMul:1.08,pattern:'four-edge',heal:.05,familyWeights:FAMILY_PROFILES.hard},
 {id:'crescendo',caption:'FINAL PRESSURE',cap:10,count:22,spawnInterval:.27,hpMul:1.15,pattern:'four-edge',heal:.055,familyWeights:FAMILY_PROFILES.hard},
 {id:'boss',caption:'ARSENAL GUARDIAN',cap:6,count:12,spawnInterval:.42,hpMul:1,pattern:'four-edge',heal:.12,familyWeights:FAMILY_PROFILES.mixed}
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
function planWave(nativeConfig,wave,{seed=41}={}){
 if(!Number.isInteger(wave)||wave<1)throw Error('WAVE_INVALID_INDEX');
 const catalog=indexNative(nativeConfig);
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
 let count=beat.id==='boss'?Math.min(18,beat.count+(cluster-1)):
  Math.min(42,beat.count+(cluster-1)*2);
 if(wave===1)count=6;else if(wave===2)count=8;else if(wave===3)count=10;
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
   edge:'bottom',edgeFraction:.5,boss:true}));
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
   edge,edgeFraction:.1+.8*rand(),boss:false}));
 }
 const endlessHpScale=1+Math.min(.3,Math.max(0,cluster-3)*.04);
 return Object.freeze({wave,chapter:cluster,cluster,clusterWave,
  beat:beat.id,title:beat.caption,boss:beat.id==='boss',
  newWeapons:Object.freeze(newly.map(x=>x.id)),
  revealedWeapons:revealed,totalWeapons:catalog.allWeaponIds.length,
  composition:Object.freeze(roster),
  concurrentLimit:Math.min(11,beat.cap+Math.floor((cluster-1)/3)),
  spawnInterval:Math.max(.18,beat.spawnInterval-Math.min(.06,(cluster-1)*.01)),
  enemyHpMultiplier:+(beat.hpMul*endlessHpScale).toFixed(4),
  bossHp:beat.id==='boss'?Math.min(12000,2200+cluster*800):0,
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
