/* Quest 01: owner-approved passive rig. No simulated combat or checkpoints. */
(function(root){
'use strict';
if(root.APEX_QUEST_BREACH_RIG)return;
const ALLIES=Object.freeze(['NEWBOT','T.O.T','RIVET']);
const BEATS=Object.freeze([
 ['WAVES_CLEARED','E06_RELAY_REPLY','RELAY_CONFIRMED'],
 ['RELAY_CONFIRMED','E06_NETWORK_SCAN','IDENTITIES_SCANNED'],
 ['IDENTITIES_SCANNED','E06_RIG_RETURN','RIVET_RETURNED'],
 ['RIVET_RETURNED','E06_OVERRIDE_BUILDUP','OVERRIDE_WITNESSED']
]);
function create(policy){
 if(!policy?.waveOutcome||!policy?.resolveWave)throw Error('native Breach authority required');
 let phase='AWAIT_RIG_LOCK',closed=false,allies=null;
 const receipts=[];
 const reject=reason=>Object.freeze({ok:false,reason,phase});
 function record(cue,detail={}){
  receipts.push(Object.freeze({cue,detail:Object.freeze({...detail})}));
  return Object.freeze({ok:true,phase,receiptCount:receipts.length});
 }
 function acknowledgeLock(actors){
  if(closed||phase!=='AWAIT_RIG_LOCK')return reject('lock-not-expected');
  if(!Array.isArray(actors)||actors.length!==6||
     policy.waveOutcome(actors,'A').status!=='ACTIVE'||
     ALLIES.some((id,i)=>actors[i]?.questId!==id||
        actors[i]?.questTeam!=='ALLY'||actors[i]?.hp!==1000||
        actors[i]?.withdrawn===true))return reject('not-real-wave-A-team');
  allies=actors.slice(0,3);phase='FRONTLINE_PASSIVE_HOLD';
  return record('E06_RIG_LOCK',{hold:'PASSIVE_CIRCUIT',operator:null,automaticFire:false});
 }
 function acceptNativeWaveClear(actors,lifecycle){
  if(closed||phase!=='FRONTLINE_PASSIVE_HOLD')return reject('not-in-frontline');
  if(!Array.isArray(actors)||ALLIES.some((id,i)=>actors[i]!==allies[i]||
      actors[i]?.questId!==id)||policy.waveOutcome(actors,'C').status!=='COMPLETE')
   return reject('real-final-roster-or-ally-identity-missing');
  const s=lifecycle?.snapshot?.(),order=policy.ORDER||['A','B','C'];
  if(!s||s.phase!=='COMPLETE'||s.wave!=='C'||s.completed!==3||
     s.receipts?.length!==3||
     s.receipts.some((w,i)=>w.wave!==order[i]||
       w.physicalKOs?.length!==policy.resolveWave(order[i]).hostiles.length||
       w.physicalKOs.some(k=>k.hp!==0||k.maxHp<=0)||
       w.allies?.length!==3)||
     s.receipts.reduce((n,w)=>n+w.physicalKOs.length,0)!==10)
   return reject('ten-physical-KO-receipts-required');
  phase='WAVES_CLEARED';
  return record('E06_BREACH_CLEAR',{waves:3,physicalKOs:10,passiveHold:true});
 }
 function acknowledgeBeat(cue){
  if(closed)return reject('closed');
  const t=BEATS.find(s=>s[0]===phase&&s[1]===cue);
  if(!t)return reject('wrong-causal-order');
  phase=t[2];return record(cue,{rigDoesNotOperateAutonomously:true});
 }
 function snapshot(){return Object.freeze({phase,closed,passive:!closed&&phase!=='AWAIT_RIG_LOCK',
  readyForE07:phase==='OVERRIDE_WITNESSED',
  receipts:receipts.map(x=>({cue:x.cue,detail:{...x.detail}}))});}
 function close(){closed=true;phase='CLOSED';allies=null;}
 return Object.freeze({acknowledgeLock,acceptNativeWaveClear,acknowledgeBeat,snapshot,close});
}
root.APEX_QUEST_BREACH_RIG=Object.freeze({create,ALLIES,BEATS});
root.apexQuestBreachRig='ready';
})(typeof window!=='undefined'?window:globalThis);
