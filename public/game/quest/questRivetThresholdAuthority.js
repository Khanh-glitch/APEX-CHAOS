/* Quest 01 E07 RIVET OVERRIDDEN — no synthetic damage and no lethal boss.
 * Only an actual Fighter/Arsenal accepted-damage transaction may observe an
 * HP threshold crossing. A single heavy hit may cross multiple thresholds;
 * each cue fires once, in narrative order.
 */
(function installRivetThresholds(root){
'use strict';
if(root.APEX_QUEST_RIVET_THRESHOLDS)return;
const START_HP=1000,STOP_HP=180;
const CROSSINGS=Object.freeze([
 Object.freeze({hp:750,beat:'E07_RIVET_COMMAND_750'}),
 Object.freeze({hp:450,beat:'E07_RIVET_COMMAND_450'}),
 Object.freeze({hp:180,beat:'E07_RIVET_NONLETHAL_STOP'})
]);
function create({onCue}={}){
 let observed=START_HP,started=false,closed=false,stopped=false,consumed=new Set(),inflight=null;
 const receipts=[];
 function preflight(fighter){
  if(closed)return {ok:false,reason:'closed'};
  if(started)return {ok:false,reason:'already-started'};
  if(!fighter||fighter.questId!=='RIVET'||fighter.questTeam!=='HOSTILE'
   ||fighter.maxHp!==START_HP||fighter.hp!==START_HP
   ||typeof fighter.takeDamage!=='function')
   return {ok:false,reason:'requires-authentic-1000HP-hostile-RIVET'};
  started=true;observed=fighter.hp;
  return {ok:true,reason:'real-boss-is-armed'};
 }
 function beforeAccepted(fighter,amount){
  if(closed||!started||!fighter||fighter.questId!=='RIVET'
    ||!Number.isFinite(amount)||amount<0)
   return {ok:false,reason:'bad-accepted-damage'};
  if(fighter.hp!==observed||inflight)
   return {ok:false,reason:'unobserved-or-concurrent-hp-change'};
  if(stopped)return {ok:true,allowed:0,reason:'settled-nonlethal-stop'};
  const allowed=Math.min(amount,Math.max(0,fighter.hp-STOP_HP));
  inflight={before:fighter.hp,allowed};
  return {ok:true,allowed,reason:'accepted-damage-capped'};
 }
 function afterAccepted(fighter,actual){
  if(closed||!started||!inflight||!fighter||fighter.questId!=='RIVET'
    ||!Number.isFinite(actual)||actual<0)
   return {ok:false,reason:'no-real-transaction'};
  const t=inflight;inflight=null;
  if(actual>t.allowed+1e-6||Math.abs((t.before-actual)-fighter.hp)>1e-6
    ||fighter.hp<STOP_HP-1e-6||fighter.hp>t.before)
   return {ok:false,reason:'physical-hp-receipt-invalid'};
  observed=fighter.hp;
  const crossed=[];
  if(actual>0){
   for(const cue of CROSSINGS){
    if(!consumed.has(cue.hp)&&t.before>cue.hp&&fighter.hp<=cue.hp){
      consumed.add(cue.hp);
      const entry=Object.freeze({beat:cue.beat,threshold:cue.hp,
        before:t.before,after:fighter.hp,damage:actual});
      receipts.push(entry);crossed.push(entry);
      onCue?.(entry);
    }
   }
  }
  if(fighter.hp===STOP_HP&&consumed.has(STOP_HP))stopped=true;
  return {ok:true,events:crossed.map(x=>({...x})),stopped};
 }
 function clearZero(){
  if(closed||!inflight)return false;
  if(inflight.allowed!==0)return false;
  inflight=null;return true;
 }
 function snapshot(){return Object.freeze({started,closed,stopped,observed,
  pending:inflight!==null,cues:receipts.map(x=>({...x}))});}
 function close(){closed=true;inflight=null;}
 return Object.freeze({preflight,beforeAccepted,afterAccepted,clearZero,snapshot,close});
}
root.APEX_QUEST_RIVET_THRESHOLDS=Object.freeze({START_HP,STOP_HP,CROSSINGS,create});
root.apexQuestRivetThresholds='ready';
})(typeof window!=='undefined'?window:globalThis);
