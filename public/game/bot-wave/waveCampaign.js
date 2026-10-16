// BOT WAVE CP2 — runtime campaign director. This file has no fixed wave limit.
// The 41 equipable weapons are taken ONLY from live Arsenal P0_WEAPON_IDS.
// Guns are not rebalanced by wave: carrier count, lanes and mixtures do the work.
(function(root){
'use strict';
const ROLE_WEIGHT=Object.freeze({
 SEMI:1,AUTO:2,BURST:3,SHOTGUN:4,PRECISION:5,AUTOSHOT:6,
 GRENADE:7,MELEE:8,SHIELD:9,SPECIAL:10
});
const PLAN_BEATS=Object.freeze([
 {id:'breather',caption:'RECALIBRATION',cap:5,pacing:.76,pattern:'front'},
 {id:'teach',caption:'NEW THREAT',cap:7,pacing:.90,pattern:'flank'},
 {id:'mix',caption:'CROSS-PRESSURE',cap:8,pacing:1.08,pattern:'cross'},
 {id:'crescendo',caption:'BREAKPOINT',cap:9,pacing:1.26,pattern:'pincer'},
 {id:'boss',caption:'ARSENAL GUARDIAN',cap:9,pacing:1.13,pattern:'four-edge'}
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
function planWave(nativeConfig,wave,{seed=41}={}){
 if(!Number.isInteger(wave)||wave<1)throw Error('WAVE_INVALID_INDEX');
 const catalog=indexNative(nativeConfig);
 const beat=PLAN_BEATS[(wave-1)%5];
 const chapter=Math.floor((wave-1)/5)+1;
 const rand=seeded((seed^Math.imul(wave,0x9e3779b1))>>>0);
 // Stage approximately 1.36 fresh identities per wave, with exactly PISTOL
 // on wave 1. Every newly unlocked weapon is GUARANTEED an actual carrier
 // slot in its reveal wave, not merely a name in the director catalogue.
 // All 41 physically encounterable weapons have debuted by wave 31.
 const revealed=Math.min(catalog.ordered.length,Math.max(1,Math.floor((wave-1)*1.36)+1));
 const previous=wave===1?0:Math.min(catalog.ordered.length,Math.max(1,Math.floor((wave-2)*1.36)+1));
 const newly=catalog.ordered.slice(previous,revealed);
 const available=catalog.ordered.slice(0,revealed);
 const featured=wave===1?catalog.byId.get('PISTOL'):newly.length?newly[Math.floor(rand()*newly.length)]:
  available[(Math.floor(rand()*available.length))];
 const count=Math.min(36,Math.round((6+Math.min(16,Math.floor((wave-1)*.55)))*beat.pacing));
 const slots=Math.max(1,count-(beat.id==='boss'?1:0));
 const roster=[];
 for(let i=0;i<slots;i++){
  // The spotlight gets space and never becomes a 41-gun simultaneity soup.
  let pick;
  if(i<newly.length)pick=newly[i]; // Guaranteed real first encounter.
  else if(wave===1||i===newly.length)pick=featured;
  else if(i%5===0&&newly.length>1)pick=newly[Math.floor(rand()*newly.length)];
  else if(i%3===0)pick=available[Math.floor(rand()*available.length)];
  else pick=available[Math.floor(Math.pow(rand(),1.4)*available.length)];
  const edge=beat.pattern==='front'?'top':beat.pattern==='flank'?(i%2?'right':'left'):
   beat.pattern==='pincer'?(i%2?'top':'bottom'):EDGES[(i+Math.floor(rand()*4))%4];
  roster.push(Object.freeze({weaponId:pick.id,family:pick.family,role:pick.role,
   edge,edgeFraction:.1+.8*rand(),boss:false}));
 }
 if(beat.id==='boss'){
  const pick=newly.length?featured:available[Math.floor(rand()*available.length)];
  roster.push(Object.freeze({weaponId:pick.id,family:pick.family,role:pick.role,
    edge:'bottom',edgeFraction:.5,boss:true}));
 }
 const healing=beat.id==='breather'?.23:beat.id==='boss'?.28:.12;
 return Object.freeze({wave,chapter,beat:beat.id,title:beat.caption,
  boss:beat.id==='boss',newWeapons:Object.freeze(newly.map(x=>x.id)),
  revealedWeapons:revealed,totalWeapons:catalog.allWeaponIds.length,
  composition:Object.freeze(roster),concurrentLimit:Math.min(beat.cap,5+Math.floor(chapter/3)),
  betweenWaveHealFraction:healing,reloadPolicy:'KEEP_WEAPON_AND_REFILL_MAGAZINE',
  gunDamageScalar:1,gunCadenceScalar:1,gunProjectileSpeedScalar:1,
  infinite:true});
}
const API=Object.freeze({indexNative,planWave,beats:PLAN_BEATS});
root.APEX_BOT_WAVE_CAMPAIGN=API;
})(typeof window!=='undefined'?window:globalThis);
