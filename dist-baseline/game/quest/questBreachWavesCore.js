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
   Object.freeze({id:'BREACH-A2',hp:300,entry:'EAST',kind:'scout'}),
   Object.freeze({id:'BREACH-A3',hp:300,entry:'WEST',kind:'scout'})
  ])}),
  B:Object.freeze({cadence:3.5,burst:0,hostiles:Object.freeze([
   Object.freeze({id:'BREACH-B1',hp:260,entry:'WEST',kind:'scout'}),
   Object.freeze({id:'BREACH-B2',hp:260,entry:'EAST',kind:'reaver'}),
   Object.freeze({id:'BREACH-B3',hp:260,entry:'WEST',kind:'scout'}),
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
 function authorizedRetreatImpact(fighter,incoming,threshold=RULES.retreatHpProvisional){
  if(!valid(fighter)||fighter.questTeam!=='ALLY'||!Number.isFinite(incoming)||incoming<0
    ||!Number.isFinite(threshold)||threshold<0)return {ok:false,reason:'invalid-impact'};
  if(fighter.withdrawn===true)return {ok:true,apply:0,retreat:false,reason:'already-withdrawn'};
  // Prevent lethal overflow at the physical Fighter damage boundary before
  // it can execute a death path. No HEAL is applied; contact is still real.
  const apply=Math.min(incoming,Math.max(0,fighter.hp-threshold));
  return {ok:true,apply,retreat:fighter.hp-apply<=threshold,
    unabsorbed:incoming-apply};
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
 // A wave transition is a transaction, not a resetBattle() call.
 // This pure Director sublayer NEVER creates a Fighter or writes hit points;
 // it requires the Arsenal consumer to provide exactly the physical actors
 // returned by its factory, and commits a wave only after validation.
 const WAVE_INTERLUDE_SECONDS=1.8;
 function createWaveLifecycle(){
  let wave='A',phase='ACTIVE',holdElapsed=0,closed=false,pending=null;
  const receipts=[],alliesById=new Map();
  const rosterIds=()=>WAVES[wave]?.hostiles.map(x=>x.id)||[];
  function observe(actors){
   if(closed)return {status:'CLOSED'};
   if(!Array.isArray(actors))return {status:'INVALID',reason:'missing-roster'};
   if(phase!=='ACTIVE')return {status:phase,reason:'wave-not-active'};
   const outcome=waveOutcome(actors,wave);
   if(outcome.status==='INVALID')return outcome;
   const allies=ALLY_IDS.map(id=>actors.find(a=>a.questId===id));
   if(alliesById.size===0){
    for(let i=0;i<ALLY_IDS.length;i++)alliesById.set(ALLY_IDS[i],allies[i]);
   }else if(allies.some((x,i)=>x!==alliesById.get(ALLY_IDS[i])))
     return {status:'INVALID',reason:'ally-identity-reset'};
   if(outcome.status==='ACTIVE')return outcome;
   if(outcome.status==='RETRY'){phase='RETRY';return outcome;}
   const killed=WAVES[wave].hostiles.map(s=>{
    const fighter=actors.find(x=>x.questId===s.id);
    return Object.freeze({id:s.id,hp:fighter.hp,maxHp:fighter.maxHp});
   });
   if(killed.some(x=>x.hp!==0))return {status:'INVALID',reason:'hostile-not-physical-KO'};
   const hp=ALLY_IDS.map(id=>{
    const a=alliesById.get(id);
    return Object.freeze({id,hp:a.hp,maxHp:a.maxHp,withdrawn:a.withdrawn===true});
   });
   receipts.push(Object.freeze({wave,physicalKOs:Object.freeze(killed),
     allies:Object.freeze(hp)}));
   if(outcome.status==='COMPLETE'){
    if(receipts.length!==3||wave!=='C')
     return {status:'INVALID',reason:'unearned-complete'};
    phase='COMPLETE';return outcome;
   }
   phase='INTERLUDE';holdElapsed=0;
   return {status:'INTERLUDE',cleared:wave,receiptCount:receipts.length};
  }
  function tick(dt){
   if(closed)return {phase:'CLOSED'};
   if(phase==='INTERLUDE'&&Number.isFinite(dt)&&dt>0)
     holdElapsed=Math.min(WAVE_INTERLUDE_SECONDS,holdElapsed+dt);
   return {phase,holdElapsed,ready:phase==='INTERLUDE'
     &&holdElapsed>=WAVE_INTERLUDE_SECONDS};
  }
  function prepareNext(actors,factory){
   if(closed||phase!=='INTERLUDE'||pending
      ||holdElapsed<WAVE_INTERLUDE_SECONDS)
     return {ok:false,reason:'not-ready-or-already-prepared'};
   if(!Array.isArray(actors)||typeof factory!=='function')
     return {ok:false,reason:'missing-authority'};
   const idx=ORDER.indexOf(wave),next=ORDER[idx+1];
   if(!next)return {ok:false,reason:'already-final-wave'};
   if(waveOutcome(actors,wave).status!=='NEXT_WAVE')
     return {ok:false,reason:'prior-real-KO-receipt-stale'};
   const hero=ALLY_IDS.map(id=>actors.find(a=>a.questId===id));
   if(hero.some((a,i)=>a!==alliesById.get(ALLY_IDS[i])))
     return {ok:false,reason:'ally-object-changed'};
   const r=receipts[receipts.length-1];
   if(!r||r.wave!==wave||hero.some((a,i)=>
     a.hp!==r.allies[i].hp||!!a.withdrawn!==r.allies[i].withdrawn))
     return {ok:false,reason:'ally-HP-or-withdrawal-changed-in-interlude'};
   let built;
   try{built=resolveWave(next).hostiles.map(s=>factory(s));}
   catch(err){return {ok:false,reason:'factory-threw',error:String(err)};}
   if(built.some((x,i)=>!x||x.questId!==WAVES[next].hostiles[i].id))
     return {ok:false,reason:'factory-created-wrong-id'};
   const candidate=[...hero,...built];
   if(waveOutcome(candidate,next).status!=='ACTIVE')
     return {ok:false,reason:'next-roster-invalid'};
   const ticket=Object.freeze({from:wave,to:next,receiptCount:receipts.length});
   pending={candidate,ticket};
   return {ok:true,roster:candidate,ticket};
  }
  function commitNext(roster,ticket){
   if(closed||phase!=='INTERLUDE'||!pending||ticket!==pending.ticket
      ||!Array.isArray(roster)||roster.length!==pending.candidate.length
      ||roster.some((x,i)=>x!==pending.candidate[i]))
     return {ok:false,reason:'uncommitted-or-modified-physical-roster'};
   const next=pending.ticket.to;
   if(waveOutcome(roster,next).status!=='ACTIVE')
     return {ok:false,reason:'next-roster-not-active'};
   wave=next;phase='ACTIVE';pending=null;holdElapsed=0;
   return {ok:true,wave,phase};
  }
  function snapshot(){return Object.freeze({wave,phase,holdElapsed,
   pending:pending?.ticket.to||null,closed,completed:receipts.length,
   receipts:receipts.map(x=>({wave:x.wave,physicalKOs:x.physicalKOs.map(y=>({...y})),
     allies:x.allies.map(y=>({...y}))}))});}
  function close(){closed=true;phase='CLOSED';pending=null;}
  return Object.freeze({observe,tick,prepareNext,commitNext,snapshot,close});
 }

 function integrationAuthority(){
  return Object.freeze({ready:false,blocker:'X-01 rig handoff unresolved',
    requires:['RIVET rig-to-field choreography','E06 relay continuity',
      'T.O.T and RIVET authored skill availability']});
 }
 root.APEX_QUEST_BREACH_POLICY=Object.freeze({
  ALLY_IDS,WAVES,ORDER,RULES,resolveWave,incomingRetreat,authorizedRetreatImpact,abilityRecipient,
  waveOutcome,eligibleOffensiveRequests,WAVE_INTERLUDE_SECONDS,createWaveLifecycle,integrationAuthority
 });
})(typeof window!=='undefined'?window:globalThis);
