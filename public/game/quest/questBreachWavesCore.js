/* QUEST 01 Q6A — BREACH WAVES pure, production-compatible policy.
 * Never creates Fighters, affects HP, casts abilities, moves the rig, awards wins
 * or fabricates story. This is not E06 cutover until rig ownership X-01 is solved.
 */
(function installBreachPolicy(root){
 'use strict';
 if(root.APEX_QUEST_BREACH_POLICY)return;
 const ALLY_IDS=Object.freeze(['NEWBOT','T.O.T','RIVET']);
 const WAVES=Object.freeze({
  A:Object.freeze({cadence:4.5,burst:0,hostiles:Object.freeze([
   Object.freeze({id:'BREACH-A1',hp:300,entry:'WEST',kind:'scout'}),
   Object.freeze({id:'BREACH-A2',hp:300,entry:'EAST',kind:'bulwark'}),
   Object.freeze({id:'BREACH-A3',hp:300,entry:'WEST',kind:'sentinel'})
  ])}),
  B:Object.freeze({cadence:3.5,burst:0,hostiles:Object.freeze([
   Object.freeze({id:'BREACH-B1',hp:260,entry:'WEST',kind:'scout'}),
   Object.freeze({id:'BREACH-B2',hp:260,entry:'EAST',kind:'reaver'}),
   Object.freeze({id:'BREACH-B3',hp:260,entry:'WEST',kind:'bulwark'}),
   Object.freeze({id:'BREACH-B4',hp:260,entry:'EAST',kind:'sentinel'})
  ])}),
  C:Object.freeze({cadence:3,burst:2,hostiles:Object.freeze([
   Object.freeze({id:'BREACH-C1',hp:320,entry:'WEST',kind:'scout'}),
   Object.freeze({id:'BREACH-C2',hp:320,entry:'EAST',kind:'reaver'}),
   Object.freeze({id:'BREACH-C3',hp:320,entry:'WEST',kind:'sentinel'})
  ])})
 });
 const ORDER=Object.freeze(['A','B','C']);
 const RULES=Object.freeze({
  retreatHpProvisional:100,
  offensiveSlotCap:5,
  maxWaveActivations:4,
  staggerMin:1,maxStagger:1.5,
  controllerPriority:ALLY_IDS,
  rigHandoffResolved:false
 });
 function resolveWave(wave){
  const s=WAVES[wave];
  return s?{id:wave,cadence:s.cadence,burst:s.burst,
   hostiles:s.hostiles.map(x=>({...x})),count:s.hostiles.length}:null;
 }
 const valid=(a)=>!!a&&typeof a.questId==='string'&&Number.isFinite(a.hp)
  &&Number.isFinite(a.maxHp)&&a.maxHp>0&&a.hp>=0&&a.hp<=a.maxHp;
 function incomingRetreat(actors,threshold=RULES.retreatHpProvisional){
  if(!Array.isArray(actors)||!Number.isFinite(threshold)||threshold<0)
   return {ok:false,reason:'invalid-input'};
  const cmds=[];
  for(const id of ALLY_IDS){
   const a=actors.find(x=>x?.questId===id);
   if(!valid(a)||a.questTeam!=='ALLY')return {ok:false,reason:'invalid-ally-'+id};
   // Physical engine MUST intercept lethal overflow BEFORE actual KO and
   // commit retreat; never change HP here or repair a real defeated body.
   if(a.withdrawn!==true&&a.hp<=threshold)
    cmds.push(Object.freeze({kind:'REQUEST_RETREAT',id,atHp:a.hp}));
  }
  return {ok:true,commands:cmds};
 }
 function abilityRecipient(actors){
  if(!Array.isArray(actors))return null;
  return ALLY_IDS.find(id=>actors.some(a=>a?.questId===id&&a.questTeam==='ALLY'
    &&a.withdrawn!==true&&a.hp>0))||null;
 }
 function waveOutcome(actors,wave){
  const spec=WAVES[wave];
  if(!spec||!Array.isArray(actors))return {status:'INVALID',reason:'bad-wave'};
  const ids=actors.map(a=>a?.questId);
  if(new Set(ids).size!==ids.length||actors.length!==ALLY_IDS.length+spec.hostiles.length)
   return {status:'INVALID',reason:'roster-shape'};
  for(const id of ALLY_IDS){
   const a=actors.find(x=>x?.questId===id);
   if(!valid(a)||a.questTeam!=='ALLY'||a.maxHp!==1000)
    return {status:'INVALID',reason:'wrong-ally'};
   if(a.hp<=0&&!a.withdrawn)return {status:'INVALID',reason:'unintercepted-ally-KO'};
  }
  for(const s of spec.hostiles){
   const a=actors.find(x=>x?.questId===s.id);
   if(!valid(a)||a.questTeam!=='HOSTILE'||a.maxHp!==s.hp)
    return {status:'INVALID',reason:'wrong-hostile'};
  }
  if(ALLY_IDS.every(id=>actors.find(x=>x.questId===id).withdrawn===true))
   return {status:'RETRY',reason:'three-real-withdrawals'};
  if(spec.hostiles.some(s=>actors.find(a=>a.questId===s.id).hp>0))
   return {status:'ACTIVE',reason:'physical-hostiles-active'};
  return wave==='C'?{status:'COMPLETE',reason:'wave-C-KO'}
    :{status:'NEXT_WAVE',reason:'wave-cleared'};
 }
 function eligibleOffensiveRequests(activeOffensive,requested){
  if(!Number.isInteger(activeOffensive)||activeOffensive<0
     ||!Number.isInteger(requested)||requested<0)
   return {ok:false,reason:'bad-count'};
  const accepted=Math.min(requested,Math.max(0,RULES.offensiveSlotCap-activeOffensive));
  return {ok:true,accepted,suppressed:requested-accepted};
 }
 function integrationAuthority(){
  return Object.freeze({ready:false,blocker:'X-01 rig handoff unresolved',
    requires:['RIVET rig-to-field choreography','E06 relay continuity',
      'T.O.T and RIVET authored skill availability']});
 }
 root.APEX_QUEST_BREACH_POLICY=Object.freeze({
  ALLY_IDS,WAVES,ORDER,RULES,resolveWave,incomingRetreat,abilityRecipient,
  waveOutcome,eligibleOffensiveRequests,integrationAuthority
 });
})(typeof window!=='undefined'?window:globalThis);
