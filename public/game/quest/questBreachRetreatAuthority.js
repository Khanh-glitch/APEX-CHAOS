/* E06 retreat authority binds to the REALIZED Fighter.takeDamage transaction,
 * AFTER all defensive mitigation / immunity but BEFORE HP loss. Never writes
 * actor HP, resets a weapon or fabricates an outcome.
 */
(function installBreachRetreat(root){
'use strict';
if(root.APEX_QUEST_BREACH_RETREAT)return;
const BEFORE='__apexQuestBeforeAcceptedDamage';
const AFTER='__apexQuestAfterAcceptedDamage';
function create({policy,onRetreat,threshold,mitigate}={}){
 if(!policy?.authorizedRetreatImpact)throw Error('missing physical E06 policy');
 const limit=Number.isFinite(threshold)?threshold:policy.RULES.retreatHpProvisional;
 const originals=new Map(),pending=new Map(),events=[];
 let active=true;
 function record(f,source,info,label){
  if(f.withdrawn===true)return;
  f.withdrawn=true;
  if(f.data)f.data.questRetreat=Object.freeze({
   x:f.x,y:f.y,hp:f.hp,sourceId:source?.questId||null,
   label:label||'direct',unabsorbed:Math.max(0,info?.unabsorbed||0)
  });
  const e=Object.freeze({id:f.questId,hp:f.hp,sourceId:source?.questId||null,
   label:label||'direct',unabsorbed:Math.max(0,info?.unabsorbed||0)});
  events.push(e);onRetreat?.(f,e);
 }
 function attach(actors){
  if(!active||!Array.isArray(actors))return {ok:false,reason:'invalid-session'};
  const allies=policy.ALLY_IDS.map(id=>actors.find(f=>f?.questId===id&&f.questTeam==='ALLY'));
  if(allies.some(f=>!f||typeof f.takeDamage!=='function'||f.maxHp!==1000))
   return {ok:false,reason:'not-three-valid-allied-Fighters'};
  if(originals.size)return {ok:false,reason:'already-attached'};
  for(const f of allies){
   originals.set(f,{before:f[BEFORE],after:f[AFTER]});
   f.withdrawn=false;
   f[BEFORE]=function(amount,source,label){
    if(!active) return amount;
    if(this.withdrawn===true){pending.delete(this);return 0;}
    // RIVET may inherit exactly Robot K / Virtual Armor while E06 active.
    // Native pre-HP boundary still remains the one authority for retreat.
    const adjusted=typeof mitigate==='function'?mitigate(this,amount,source,label):amount;
    if(!Number.isFinite(adjusted)||adjusted<0||adjusted>amount)
      throw Error('invalid Quest companion native mitigation');
    const proposal=policy.authorizedRetreatImpact(this,adjusted,limit);
    if(!proposal.ok)throw Error('invalid E06 realized damage: '+proposal.reason);
    pending.set(this,{proposal,source,label});
    return proposal.apply;
   };
   f[AFTER]=function(actual,source,label){
    if(!active)return;
    const transaction=pending.get(this);pending.delete(this);
    if(actual>0&&this.hp<=limit)
      record(this,source,transaction?.proposal,label);
   };
  }
  return {ok:true,allies:allies.map(f=>f.questId),threshold:limit};
 }
 function snapshot(){return Object.freeze({active,attached:originals.size,
  threshold:limit,events:events.map(x=>({...x}))});}
 function close(){
  if(!active)return;
  active=false;
  for(const [f,prior] of originals){
   if(prior.before===undefined)delete f[BEFORE];else f[BEFORE]=prior.before;
   if(prior.after===undefined)delete f[AFTER];else f[AFTER]=prior.after;
  }
  originals.clear();pending.clear();
 }
 return Object.freeze({attach,snapshot,close});
}
root.APEX_QUEST_BREACH_RETREAT=Object.freeze({create});
root.apexQuestBreachRetreat='ready';
})(typeof window!=='undefined'?window:globalThis);
