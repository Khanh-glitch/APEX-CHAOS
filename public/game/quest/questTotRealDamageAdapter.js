/* E08 real Fighter accepted-damage adapter. Inert until explicitly attached
 * by a future authenticated Gold encounter. No Story Director route here.
 */
(function installTotRealDamageAdapter(root){
'use strict';
if(root.APEX_QUEST_TOT_DAMAGE_ADAPTER)return;
const BEFORE='__apexQuestBeforeAcceptedDamage';
const AFTER='__apexQuestAfterAcceptedDamage';
function create({authority,verifyNativeStorm,onCue}={}){
 if(typeof authority?.create!=='function')
  throw Error('E08 needs immutable LAST CHOICE threshold authority');
 const policy=authority.create({verifyNativeStorm,onCue});
 let active=true,tot=null,priorBefore,priorAfter;
 function attach(hero,boss){
  if(!active||tot)return {ok:false,reason:'closed-or-already-attached'};
  if(!hero||hero.questId!=='NEWBOT'||hero.questTeam!=='ALLY'
    ||hero.maxHp!==1000||hero.hp!==1000
    ||!boss||boss.questId!=='T.O.T'||boss.questTeam!=='HOSTILE'
    ||boss.maxHp!==1000||boss.hp!==1000
    ||typeof boss.takeDamage!=='function')
    return {ok:false,reason:'requires-repaired-actual-newbot-and-hostile-tot'};
  if(typeof boss[BEFORE]==='function'||typeof boss[AFTER]==='function')
    return {ok:false,reason:'foreign-real-damage-hook'};
  const initialized=policy.start(hero,boss);
  if(!initialized.ok)return initialized;
  tot=boss;priorBefore=boss[BEFORE];priorAfter=boss[AFTER];
  boss[BEFORE]=function(actual,source,label,statusDamage){
    if(!active)throw Error('E08 closed before-accepted hook');
    const p=policy.beforeAccepted(this,actual);
    if(!p.ok)throw Error('E08 rejected actual damage: '+p.reason);
    return p.allowed;
  };
  boss[AFTER]=function(real,source,label,statusDamage){
    if(!active)throw Error('E08 closed after-accepted hook');
    const p=policy.afterAccepted(this,real);
    if(!p.ok)throw Error('E08 invalid native Fighter HP receipt: '+p.reason);
  };
  return {ok:true,hero:'NEWBOT',boss:'T.O.T'};
 }
 function close(){
  if(!active)return;
  active=false;
  if(tot){
   if(priorBefore===undefined)delete tot[BEFORE];else tot[BEFORE]=priorBefore;
   if(priorAfter===undefined)delete tot[AFTER];else tot[AFTER]=priorAfter;
   tot=null;
  }
  policy.close();
 }
 return Object.freeze({
  attach,physicalStorm:(receipt)=>policy.physicalStorm(receipt),
  snapshot:()=>policy.snapshot(),close
 });
}
root.APEX_QUEST_TOT_DAMAGE_ADAPTER=Object.freeze({create});
root.apexQuestTotDamageAdapter='ready';
})(typeof window!=='undefined'?window:globalThis);
