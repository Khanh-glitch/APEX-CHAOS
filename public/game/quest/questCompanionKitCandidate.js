/* Quest 01 E06 T.O.T/RIVET J/K concept PROTOTYPE — not shipping gameplay.
 * Pure target & balance contract. Never applies statuses, damage, movement,
 * weapon ownership, checkpoint progress or cooldowns. Owner sign-off pending.
 */
(function installCompanionKitCandidate(root){
'use strict';
if(root.APEX_QUEST_COMPANION_KIT_CANDIDATE)return;
const C=Object.freeze({
 'T.O.T':Object.freeze({
  J:Object.freeze({
   id:'tot.offbeat',title:'LỆCH NHỊP',english:'OFF-BEAT',
   cooldown:11,windup:0.28,range:240,maxTargets:2,
   stunSeconds:0.7,damage:0,
   fantasy:'Interrupt two imminent automatic actions; no gun spawn, no free damage.'
  }),
  K:Object.freeze({
   id:'tot.ill-be-here',title:'CỨ ĐỂ TỚ',english:'I WILL COVER',
   cooldown:16,reach:380,maxTravel:190,travelSeconds:0.42,
   braceSeconds:1.2,selfDamageMultiplier:0.75,damage:0,
   fantasy:'Run a physical interception path for a friend; T.O.T can take real damage or withdraw.'
  })
 }),
 RIVET:Object.freeze({
  J:Object.freeze({
   id:'rivet.deadlock',title:'CHỐT NEO',english:'DEADLOCK',
   cooldown:10,reach:240,rootSeconds:1.15,damage:0,
   fantasy:'Clamp one real enemy while RIVET is also rooted; both remain able to shoot.'
  }),
  K:Object.freeze({
   id:'rivet.release',title:'XẢ KHỚP',english:'RELEASE THE JOINT',
   cooldown:15,windup:0.45,range:185,coneDegrees:120,maxTargets:3,
   nativeImpactDamage:45,pushStrength:600,pushSeconds:0.38,
   fantasy:'Forward hydraulic sweep. Native melee contact, genuine Fighter.takeDamage, no Stormbreaker.'
  })
 })
});
const ids=Object.freeze(['NEWBOT','T.O.T','RIVET']);
const num=x=>typeof x==='number'&&Number.isFinite(x);
const dist=(a,c)=>Math.hypot(a.x-c.x,a.y-c.y);
const alive=f=>!!f&&num(f.hp)&&f.hp>0&&f.withdrawn!==true&&num(f.x)&&num(f.y);
const reject=reason=>Object.freeze({ok:false,reason});
const frozen=(x)=>Object.freeze(x);
function plan({owner,slot,actors,encounterId}={}){
 if(encounterId!=='E06')return reject('E06-only-candidate');
 if(!Array.isArray(actors)||new Set(actors).size!==actors.length||
   !ids.every(id=>actors.some(a=>a?.questId===id&&a.questTeam==='ALLY')))
  return reject('requires-authentic-three-ally-roster');
 if(!owner||!actors.includes(owner)||!alive(owner)||
   owner.questTeam!=='ALLY'||!C[owner.questId])
  return reject('requires-living-companion');
 if(slot!=='J'&&slot!=='K')return reject('unknown-slot');
 if(owner.hasStatus?.('stun')||owner.hasStatus?.('freeze')||
    owner.hasStatus?.('abilityDisabled'))return reject('caster-impaired');
 const s=C[owner.questId][slot],targets=[];
 const hostiles=actors.filter(a=>alive(a)&&a.questTeam==='HOSTILE')
  .sort((a,b)=>dist(a,owner)-dist(b,owner)||
      String(a.questId).localeCompare(String(b.questId),'en'));
 if(owner.questId==='T.O.T'&&slot==='J'){
  for(const enemy of hostiles)if(dist(owner,enemy)<=s.range&&targets.length<s.maxTargets)targets.push(enemy);
  if(!targets.length)return reject('no-hostile-in-pulse');
 }else if(owner.questId==='T.O.T'&&slot==='K'){
  const other=actors.filter(a=>a!==owner&&alive(a)&&a.questTeam==='ALLY'&&dist(owner,a)<=s.reach)
    .sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp)||
      ids.indexOf(a.questId)-ids.indexOf(b.questId));
  // Solo fallback: the ability remains useful but DOES NOT invent a saved friend.
  targets.push(other[0]||owner);
 }else if(owner.questId==='RIVET'&&slot==='J'){
  const candidate=hostiles.find(x=>dist(x,owner)<=s.reach);
  if(!candidate)return reject('no-hostile-in-clamp-reach');
  targets.push(candidate);
 }else{
  const heading=owner.dir;
  if(!heading||!num(heading.x)||!num(heading.y)||Math.hypot(heading.x,heading.y)<1e-6)
   return reject('missing-native-heading');
  const hlen=Math.hypot(heading.x,heading.y);
  const threshold=Math.cos(s.coneDegrees*Math.PI/360);
  for(const enemy of hostiles){
   const d=dist(owner,enemy);
   if(d<=s.range&&d>1e-6&&
     ((enemy.x-owner.x)*heading.x+(enemy.y-owner.y)*heading.y)/(d*hlen)>=threshold)
     targets.push(enemy);
   if(targets.length>=s.maxTargets)break;
  }
  if(!targets.length)return reject('no-hostile-in-physical-cone');
 }
 const result=frozen({
  ok:true,candidate:true,ownerQuestId:owner.questId,slot,id:s.id,
  cooldown:s.cooldown,targetQuestIds:frozen(targets.map(x=>x.questId)),
  impactRequiresNativeRecheck:true,
  // Requests for the engine implementer; this module does NOT execute them.
  effectKind:owner.questId==='T.O.T'
    ?(slot==='J'?'WAVE_STUN_ON_PHYSICAL_PULSE':'PHYSICAL_INTERPOSE_WITH_OWN_HP')
    :(slot==='J'?'DUAL_ROOT_WITH_EXPOSURE':'CONE_NATIVE_IMPACT_AND_PUSH')
 });
 return result;
}
root.APEX_QUEST_COMPANION_KIT_CANDIDATE=Object.freeze({C,plan,ids,
 shippingGameplay:false,requiresOwnerApproval:true});
})(typeof window!=='undefined'?window:globalThis);
