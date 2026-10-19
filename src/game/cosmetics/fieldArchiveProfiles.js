// Field Archive C04 — deterministic presentation-only analysis.
// This is a descriptive COMBAT ROLE profile, not DPS, balance authority or a skin buff.
// Newly registered abilities/weapons flow through these rules without UI edits.
// Unknown mechanics can provide archiveProfile.traits in the canonical definition.
// Axis labels are authored in the source language (Gold English) like every
// other UI string; localizationRuntime translates them through localeCatalog.
export const PROFILE_AXES=Object.freeze({
 hero:Object.freeze([
  {key:'damage',label:'DAMAGE'},
  {key:'control',label:'CONTROL'},
  {key:'mobility',label:'MOBILITY'},
  {key:'defense',label:'DEFENSE'},
  {key:'field',label:'FIELD CONTROL'}]),
 weapon:Object.freeze([
  {key:'damage',label:'DAMAGE'},
  {key:'control',label:'CONTROL'},
  {key:'tempo',label:'TEMPO'},
  {key:'reach',label:'REACH'},
  {key:'defense',label:'DEFENSE'}])
});
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const title=s=>String(s||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_./-]+/g,' ').trim().toUpperCase();
function entries(config,prefix='',depth=0){
 if(!config||typeof config!=='object'||depth>5)return [];
 return Object.entries(config).flatMap(([key,value])=>{
  const path=prefix?prefix+'.'+key:key;
  if(finite(value)||typeof value==='boolean')return [{path,value}];
  if(value&&typeof value==='object')return entries(value,path,depth+1);
  return [];
 });
}
function num(obj,keys){for(const key of keys)if(finite(obj?.[key]))return obj[key];return null}
const RULES=Object.freeze({
 damage:/damage|attack|burst|crit|weak|bleed|burn|poison|shard|hit|strike|projectile|shot|hexa/i,
 control:/stun|root|snare|trap|freeze|slow|chill|disarm|repel|knockback|push|pull|prison|bind|lock|crowd|control/i,
 mobility:/dash|rush|speed|blink|teleport|swap|exchange|slide|move|turnrate|accel|velocity|sprint|leap/i,
 defense:/armor|shield|reflect|parry|wall|protect|defend|guard|immune|heal|damage.taken|incoming.mult|mitigation|reduction/i,
 field:/radius|range|zone|wall|area|terrain|ice|magnet|weapon|pickup|floor|orbit|construct|field|hexa|prison|deploy|attract|repel|position|shard|node/i
});
function declaredTraits(def){
 // An extension mechanic may describe a newly introduced effect taxonomy
 // directly in its canonical skill/weapon definition. No ID-based override.
 const traits=def?.archiveProfile?.traits;
 if(!traits||typeof traits!=='object'||Array.isArray(traits))return {};
 return Object.fromEntries(Object.entries(traits).filter(([k,v])=>
  ['damage','control','mobility','defense','field','tempo','reach'].includes(k)&&finite(v)&&v>=0&&v<=100));
}
export function heroProfile(hero){
 if(!hero?.skills)return {kind:'hero',status:'unavailable',axes:PROFILE_AXES.hero.map(a=>({...a,value:null,evidence:[]}))};
 const skills=['PASSIVE','A1','A2'].map(k=>hero.skills[k]).filter(Boolean);
 const axes=PROFILE_AXES.hero.map(axis=>{
  // Owner-declared mechanic profiles win over keyword heuristics, including
  // an explicit ZERO. This supports non-damaging fighters without false DPS.
  const canonical=declaredTraits(hero)[axis.key];
  if(finite(canonical))return {...axis,value:Math.round(canonical),evidence:['DECLARED FIGHTER MECHANIC']};
  let total=0;const evidence=[];
  for(const skill of skills){
   const config=skill.baseConfig||{};
   const tokens=[title(skill.mechanicId||skill.id)];
   const fields=entries(config);
   const matching=fields.filter(e=>RULES[axis.key].test(e.path));
   const nameMatches=RULES[axis.key].test(tokens[0]);
   const tagged=declaredTraits(skill)[axis.key];
   if(finite(tagged)){
    total+=tagged/3;evidence.push('DECLARED SKILL MECHANIC PROFILE');
    continue;
   }
   if(nameMatches||matching.length){
    // Count independently documented mechanic names/parameters. Do not
    // multiply raw damage by global scale or guess chance-to-hit/DPS.
    const signal=clamp((nameMatches?18:0)+Math.min(25,matching.length*8),0,43);
    const cd=num(config,['cooldown','cooldownSeconds']);
    const duration=num(config,['duration','activeSeconds','activeDuration']);
    const availability=(finite(cd)&&finite(duration)&&cd>0)?clamp(duration/(cd+duration)*16,0,12):0;
    total+=signal+availability;
    evidence.push(title(skill.slot||skill.kind||skill.id)+': '+(matching.slice(0,2).map(e=>title(e.path)).join(' / ')||title(skill.mechanicId||skill.id)));
   }
  }
  // Fixed scoring anchors ensure a new fighter does NOT change old scores.
  return {...axis,value:Math.round(clamp(total)),evidence};
 });
 const classified=axes.some(a=>a.evidence.length);
 return {kind:'hero',status:classified?'derived':'unclassified',axes,method:'mechanic-fields-v1',level:1};
}
export function weaponProfile(weapon){
 const d=weapon?.data||weapon;
 if(!d||typeof d!=='object')return {kind:'weapon',status:'unavailable',axes:PROFILE_AXES.weapon.map(a=>({...a,value:null,evidence:[]}))};
 const direct=num(d,['peak','maxDamage','confirmedHitDamage','direct','damagePerShot','damage','coreDamage','damagePerPellet','tickDamage','outgoing','shardDamage']);
 const count=num(d,['shots','pellets','ticks']);
 const knock=num(d,['knockback']);
 const controlTime=num(d,['stun','slowSeconds','freezeSeconds','rootSeconds']);
 const speed=num(d,['bulletSpeed','speed','throwSpeed','shardSpeed']);
 const life=num(d,['bulletLife','maxFlightSeconds','flightMax']);
 const reach=num(d,['triggerRange','range','reach']);
 const radius=num(d,['blastRadius','triggerRadius','reflectRadius']);
 const area=num(d,['cone','spread']);
 const interval=num(d,['interval','shotInterval']);
 const charge=num(d,['charge','aimTime','windup','deployDelay','armSeconds']);
 const defensive=finite(d.damageTakenMult)||finite(d.reflectRadius)||/shield|parry|guard|reflect/i.test(String(d.kind||'')+' '+String(d.family||''));
 const values={
  // Logarithm bounds represent RAW event magnitude, NEVER native final HP or DPS.
  damage:finite(direct)?clamp(100*Math.log1p(Math.max(0,direct))/Math.log1p(210)):0,
  control:clamp((finite(knock)?knock/1200*48:0)+(finite(controlTime)?controlTime/2*52:0)+(finite(d.slowMult)?(1-d.slowMult)*35:0)),
  tempo:clamp((finite(count)?Math.log1p(Math.max(0,count))*23:0)+(finite(interval)?35/(1+Math.max(0,interval)*8):0)+(finite(charge)?22/(1+Math.max(0,charge)*3):0)),
  reach:clamp((finite(reach)?reach/750*62:0)+(finite(radius)?radius/250*48:0)+(finite(speed)&&finite(life)?Math.min(speed*life,1000)/1000*32:0)+(finite(area)?Math.min(area,1.5)*10:0)),
  defense:clamp((finite(d.damageTakenMult)?(1-d.damageTakenMult)*90:0)+(finite(d.reflectRadius)?Math.min(d.reflectRadius/200,1)*65:0)+(defensive?20:0))
 };
 const tagged=declaredTraits(d);
 const axes=PROFILE_AXES.weapon.map(a=>{
  const sources={damage:['peak','maxDamage','damage','per hit / event'],control:['knockback','stun / slow'],tempo:['shots / pellets','interval / charge'],reach:['range / radius','projectile travel'],defense:['reflect / mitigation']};
  const evidence=Object.keys(d).filter(k=>sources[a.key].some(s=>s.split(' / ').some(t=>k.toLowerCase().includes(t.toLowerCase())))).slice(0,3);
  if(finite(tagged[a.key]))evidence.push('DECLARED MECHANIC PROFILE');
  const value=finite(tagged[a.key])?tagged[a.key]:values[a.key];
  return {...a,value:Math.round(clamp(value)),evidence};
 });
 return {kind:'weapon',status:'derived',axes,method:'native-spec-v1'};
}
const SKILL_SPECS=Object.freeze({
 'robot.damage_milestones':[['BURST WINDOW','burstWindowSec','s'],['FIRST MILESTONE','firstThreshold','dmg'],['NEXT EVERY','thresholdStep','dmg']],
 'robot.weapon_dash':[['DASH SPEED','dashSpeed','us'],['MAX DASH','maxDashTime','s'],['ARRIVAL','arriveRadius','u']],
 'robot.virtual_armor':[['DURATION','duration','s'],['DAMAGE TAKEN','incomingMult','x']],
 'hunter.weak_law':[['WEAK','weakDuration','s'],['TARGET TAKES','hunterIncomingMult','x'],['TARGET DEALS','outgoingMult','x']],
 'hunter.snare':[['CHARGES','maxCharges','plain'],['TRAP LIFE','trapLifetime','s'],['ROOT','rootDuration','s']],
 'hunter.pounce_weak':[['WINDUP','windup','s'],['STUN','stunDuration','s'],['WEAK','weakDuration','s']],
 'crystal.refraction':[['REFLECTED DAMAGE','reflectedDamagePct','pct'],['REFLECTIONS / PROJECTILE','maxReflectionsPerProjectile','plain']],
 'crystal.context_construct':[['WALL','wall.hp','hp'],['PRISON FACETS','prison.facets','plain'],['SOLID LIFE',['prison.solidLifetime','wall.solidLifetime'],'rangeS']],
 'crystal.awakening':[['ACTIVE','active','s'],['SHARDS','shards','plain'],['SCAN','scanRadius','u']],
 'magnet.acceleration':[['OWN PROJECTILE SPEED','ownedProjectileVelocityBonus','signedPct']],
 'magnet.acquisition':[['FIELD','gameplayDuration','s'],['PULL RANGE','gunDistanceSpan','u'],['GUN SPEED CAP','gunSpeedCap','us']],
 'magnet.repulsion_field':[['DURATION','duration','s'],['RADIUS','radius','u'],['BODY PUSH CAP','bodyRadialSpeedCap','us']],
 'frost.deep_frost':[['FREEZE CHANCE',['baseProcPct','bonusProcPct'],'sumPct'],['FREEZE','freezeDuration','s'],['RE-FREEZE LOCK','postThawLock','s']],
 'frost.breath':[['RANGE','length','u'],['WIDTH','width','u'],['ICE FLOOR','floorLifetime','s']],
 'frost.hunt':[['ACTIVE','activeWindow','s'],['TRAIL LIFE','segmentLifetime','s'],['COLD SHOCK','coldShockMult','x']],
 'mirror.shattered_mirrors':[['SHARD DAMAGE','damagePerShard','dmg'],['MAX SHARDS / HIT','maxShardsPerEvent','plain'],['SHARD LIFE','freeShardLifetime','s']],
 'mirror.arsenal':[['COPY LIFE','copyLifetime','s'],['READY IN','canonicalOwnSeconds','s']],
 'mirror.exchange':[['SWAP AT','canonicalSnapSeconds','s'],['SEQUENCE','presentationBusySeconds','s']],
 'boxe.heat':[['HEAT AT','damageThreshold','dmg'],['HEAT','enhancedSeconds','s'],['COOLDOWN RECOVERY','cooldownRecoveryMultiplier','x']],
 'boxe.fist_rocket':[['FLIGHT UP TO','outboundSeconds','s'],['IMPACT STUN','impactStunSeconds','s'],['FLURRY HITS','flurryPunches','plain']],
 'boxe.block_and_hit':[['GUARD','guardSeconds','s'],['COUNTER STUN','counterStunSeconds','s'],['FINISHER','finisherFractionRemainingHP','remainingHp']],
 'shuri.recycle':[['STARTING','initialScrap','scrap'],['RECYCLES',['minimumTier','maximumTier'],'tierRange']],
 'shuri.shock_recoil':[['BOMB RADIUS','bombRadius','u'],['STUN','bombStunSeconds','s'],['ARMED','bombArmedLifetime','s']],
 'shuri.machine':[['MACHINE','structureHP','hp'],['BUILD','buildSeconds','s'],['REPAIR','repairPerScrap','hpPerScrap']],
 'black_hole.event_horizon':[['RADIUS GROWTH','radiusPerHp','uPerHp'],['MAX GROWTH','maxGrowth','u']],
 'black_hole.transit':[['ACTIVE','activeDuration','s'],['CAPACITY','capacity','plain'],['EXIT DISTANCE','exitTargetDistance','u']],
 'black_hole.damage_singularity':[['STORE CAP','storedDamageCap','dmg'],['RETURN','returnPct','pct'],['VULNERABLE','vulnerabilityIncomingMult','x']],
 'math.multiply_divide':[['GATE','gateDuration','s'],['MULTIPLY','xFactor','x'],['DIVIDE','halvedDamagePct','x']],
 'math.parabola_graph':[['MAX LIFE','maxLifetime','s']],
 'math.damage_equation':[['ARMOR','armorDuration','s']],
 'rubber.afterbounce':[['WINDOW','duration','s'],['PUSH','pushImpulse','u'],['SELF SPEED','selfSpeedLossPct','lossPct']],
 'rubber.elastic_state':[['ACTIVE','activeWindow','s'],['ENERGY CAP','energyCap','plain'],['MAX SPEED','maxSpeedBonusPct','signedPct']],
 'rubber.compression':[['STORE','duration','s'],['CAPACITY','capacity','plain'],['RELEASE','releasedDamagePct','pct']],
 'time.loop':[['RECORD','recordWindow','s'],['LOOPS','loops','plain'],['LOOP','loopDuration','s']],
 'time.rewind':[['SNAPSHOT DELAY','snapshotDelay','s']],
 'slime.emergency_mitosis':[['TRIGGERS AT LOST HP','triggerAtLostPct','pct'],['MIN SPLIT','minSplitShareHp','hp']],
 'slime.mitosis':[['SPLIT','splitDuration','s'],['BODIES','splitInto','plain'],['DIVERGENCE','divergenceTarget','u']],
 'slime.damage_shedding':[['CHILD EVERY','damagePerChild','dmg'],['MAX CHILDREN','maxChildren','plain'],['CHILD','childHp','hp']],
 'sniper.distance_crit':[['CRIT CHANCE CAP','critChanceCap','signedPct']],
 'sniper.farthest_corner':[['CORNER INSET','cornerInset','u'],['AIM LOST','aimLostDuration','s']],
 'sniper.nest':[['MAX NEST','maxDuration','s'],['SPREAD','spreadMultiplier','x']]
});
function specPathValue(config,path){
 if(Array.isArray(path))return path.map(p=>specPathValue(config,p));
 return String(path).split('.').reduce((value,key)=>value?.[key],config);
}
const specNumber=value=>String(Math.round(Number(value)*100)/100);
function formatSkillSpec(raw,format){
 if(Array.isArray(raw)){
  if(format==='rangeS')return raw.slice().sort((a,b)=>a-b).map(specNumber).join('–')+'s';
  if(format==='sumPct')return specNumber(raw.reduce((sum,v)=>sum+v,0)*100)+'%';
  if(format==='tierRange')return 'T'+raw[0]+'–T'+raw[1];
  return raw.map(specNumber).join(' / ');
 }
 switch(format){
  case 's':return specNumber(raw)+'s';
  case 'pct':return specNumber(raw*100)+'%';
  case 'signedPct':return (raw>=0?'+':'')+specNumber(raw*100)+'%';
  case 'lossPct':return '-'+specNumber(raw*100)+'%';
  case 'remainingHp':return specNumber(raw*100)+'% REMAINING HP';
  case 'x':return '×'+specNumber(raw);
  case 'hp':return specNumber(raw)+' HP';
  case 'dmg':return specNumber(raw)+' DMG';
  case 'u':return specNumber(raw)+'u';
  case 'us':return specNumber(raw)+'u/s';
  case 'uPerHp':return specNumber(raw)+'u/HP';
  case 'scrap':return specNumber(raw)+' SCRAP';
  case 'hpPerScrap':return specNumber(raw)+' HP/SCRAP';
  default:return specNumber(raw);
 }
}
function curatedSkillMetrics(skill){
 const definitions=SKILL_SPECS[skill?.mechanicId]||[];
 return definitions.flatMap(([label,path,format])=>{
  const raw=specPathValue(skill?.baseConfig,path);
  const values=Array.isArray(raw)?raw:[raw];
  return values.every(finite)?[{label,value:formatSkillSpec(raw,format)}]:[];
 });
}
export function skillRecords(hero){
 if(!hero?.skills)return [];
 return ['PASSIVE','A1','A2'].map(slot=>{
  const s=hero.skills[slot];
  if(!s)return null;
  const cd=num(s.baseConfig,['cooldown','cooldownSeconds']);
  // mechanicIds are namespaced ("black_hole.event_horizon"); the display
  // name is the mechanic segment itself. The old first-word strip left
  // dangling fragments ("HOLE TRANSIT") for multi-word hero prefixes.
  return {slot,name:s.displayName||title(String(s.mechanicId||s.id||slot).split('.').pop()),
   mechanicId:s.mechanicId||s.id||slot,
   cooldown:cd,metrics:curatedSkillMetrics(s)};
 }).filter(Boolean);
}
