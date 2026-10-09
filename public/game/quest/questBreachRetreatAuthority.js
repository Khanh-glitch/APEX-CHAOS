/* Quest E06 physical withdrawal adapter.
 * This wraps the EXISTING Fighter.takeDamage instance method instead of
 * inventing a second HP model or restoring dead allies.
 */
(function installBreachRetreat(root){
'use strict';
if(root.APEX_QUEST_BREACH_RETREAT)return;
function create({policy,onRetreat,threshold}={}){
 if(!policy?.authorizedRetreatImpact)throw Error('missing physical E06 policy');
 const limit=Number.isFinite(threshold)?threshold:policy.RULES.retreatHpProvisional;
 const originals=new Map(),events=[],active={value:true};
 function record(f,source,info,label){
  if(f.withdrawn===true)return;
  f.withdrawn=true;
  if(f.data)f.data.questRetreat=Object.freeze({
   x:f.x,y:f.y,hp:f.hp,sourceId:source?.questId||null,
   label:label||'direct',unabsorbed:Math.max(0,info?.unabsorbed||0)
  });
  events.push(Object.freeze({id:f.questId,hp:f.hp,sourceId:source?.questId||null,
   label:label||'direct',unabsorbed:Math.max(0,info?.unabsorbed||0)}));
  onRetreat?.(f,events[events.length-1]);
 }
 function attach(actors){
  if(!active.value||!Array.isArray(actors))return {ok:false,reason:'invalid-session'};
  const allies=policy.ALLY_IDS.map(id=>actors.find(f=>f?.questId===id&&f.questTeam==='ALLY'));
  if(allies.some(f=>!f||typeof f.takeDamage!=='function'||f.maxHp!==1000))
   return {ok:false,reason:'not-three-valid-allied-Fighters'};
  if(originals.size)return {ok:false,reason:'already-attached'};
  for(const f of allies){
   const fn=f.takeDamage;
   originals.set(f,fn);
   f.withdrawn=false;
   f.takeDamage=function(amount,source,label,statusDamage){
    if(!active.value) return fn.call(this,amount,source,label,statusDamage);
    if(this.withdrawn===true)return;
    const proposed=policy.authorizedRetreatImpact(this,amount,limit);
    if(!proposed.ok)throw Error('invalid incoming physical E06 damage: '+proposed.reason);
    const before=this.hp;
    if(proposed.apply>0)fn.call(this,proposed.apply,source,label,statusDamage);
    const actuallyLost=Math.max(0,before-this.hp);
    if((actuallyLost>0||before<=limit)&&this.hp<=limit){
     record(this,source,proposed,label);
    }
   };
  }
  return {ok:true,allies:allies.map(f=>f.questId),threshold:limit};
 }
 function snapshot(){return Object.freeze({active:active.value,attached:originals.size,
  threshold:limit,events:events.map(x=>({...x}))});}
 function close(){
  if(!active.value)return;
  active.value=false;
  for(const [f,fn] of originals){
   if(typeof fn==='function')f.takeDamage=fn;
  }
  originals.clear();
 }
 return Object.freeze({attach,snapshot,close});
}
root.APEX_QUEST_BREACH_RETREAT=Object.freeze({create});
root.apexQuestBreachRetreat='ready';
})(typeof window!=='undefined'?window:globalThis);
