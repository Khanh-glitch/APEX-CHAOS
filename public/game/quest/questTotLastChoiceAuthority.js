/* Quest 01 E08 — owner's T.O.T LAST CHOICE contract, not yet playable.
 * No Fighter allocation, native Stormbreaker creation, forced story credits,
 * fake HP writes, timed KO, or automatic sacrifice. Real Arsenal must verify
 * the one-time pickup, firing, projectile lifecycle and cradle return.
 */
(function installTotLastChoiceAuthority(root){
'use strict';
if(root.APEX_QUEST_TOT_LAST_CHOICE)return;
const FIRST=700,LAST=120;
const STORM=Object.freeze({
  id:'STORMBREAKER',
  onHitDamage:446,stunSeconds:2,speed:1350,
  homingRadiansPerSecond:2.6,missDeadlineSeconds:2.2,
  groundDamage:0,groundStunSeconds:1
});
const PHASE=Object.freeze({
  FIRST:'DUEL_TO_700', ELIGIBLE:'STORM_ELIGIBLE',
  SHOWN:'STORM_VISIBLE', HELD:'STORM_HELD',
  FINAL:'DUEL_TO_120', CHOICE:'SAFE_CHOICE'
});
function create({verifyNativeStorm,onCue}={}){
  let active=true,armed=false,phase=PHASE.FIRST;
  let hero=null,tot=null,observed=1000,pending=null,artifactId=null;
  const events=[],stormReceipts=[];
  function guardFighter(f){
    return active&&armed&&f===tot&&f?.questId==='T.O.T'
      &&f?.questTeam==='HOSTILE'&&f.maxHp===1000;
  }
  function start(newbot,target){
    if(!active||armed)return {ok:false,reason:'already-started-or-closed'};
    if(!newbot||newbot.questId!=='NEWBOT'||newbot.questTeam!=='ALLY'
      ||newbot.maxHp!==1000||newbot.hp!==1000
      ||!target||target.questId!=='T.O.T'||target.questTeam!=='HOSTILE'
      ||target.maxHp!==1000||target.hp!==1000
      ||typeof target.takeDamage!=='function')
      return {ok:false,reason:'requires-repaired-real-newbot-and-tot'};
    armed=true;hero=newbot;tot=target;observed=target.hp;
    return {ok:true,phase};
  }
  function beforeAccepted(f,amount){
    if(!guardFighter(f)||!Number.isFinite(amount)||amount<0)
      return {ok:false,reason:'invalid-physical-damage'};
    if(pending!==null||f.hp!==observed)
      return {ok:false,reason:'unobserved-or-concurrent-HP-change'};
    const floor=phase===PHASE.FIRST?FIRST:phase===PHASE.FINAL?LAST:null;
    if(floor===null||f.hp<=floor)return {ok:true,allowed:0,reason:'phase-hold'};
    const allowed=Math.min(amount,f.hp-floor);
    pending={before:f.hp,allowed};
    if(allowed===0)pending=null;
    return {ok:true,allowed,reason:'native-accepted-damage-proposal'};
  }
  function afterAccepted(f,actual){
    if(!guardFighter(f)||!pending||!Number.isFinite(actual)||actual<0)
      return {ok:false,reason:'no-pending-real-hit'};
    const p=pending;pending=null;
    if(actual>p.allowed+1e-6||Math.abs((p.before-actual)-f.hp)>1e-6)
      return {ok:false,reason:'realized-hp-mismatch'};
    observed=f.hp;
    let cue=null;
    if(phase===PHASE.FIRST&&f.hp===FIRST&&p.before>FIRST){
      phase=PHASE.ELIGIBLE;cue='E08_STORMBREAKER_ELIGIBLE';
    }else if(phase===PHASE.FINAL&&f.hp===LAST&&p.before>LAST){
      phase=PHASE.CHOICE;cue='E08_TOT_NONLETHAL_CHOICE';
    }
    if(cue){
      const entry=Object.freeze({cue,before:p.before,after:f.hp,actual});
      events.push(entry);onCue?.(entry);
    }
    return {ok:true,phase,cue,realized:actual};
  }
  function physicalStorm(receipt){
    if(!active||!armed||typeof verifyNativeStorm!=='function'
      ||!receipt||typeof receipt!=='object')
      return {ok:false,reason:'requires-Arsenal-verification'};
    const id=receipt.artifactId;
    if(typeof id!=='string'||!id||receipt.weaponId!==STORM.id
      ||receipt.ownerQuestId!=='T.O.T'
      ||verifyNativeStorm(receipt)!==true)
      return {ok:false,reason:'not-a-verified-single-native-artifact'};
    const op=receipt.event;
    if(phase===PHASE.ELIGIBLE&&op==='SPAWN'&&artifactId===null){
      artifactId=id;phase=PHASE.SHOWN;
    }else if(phase===PHASE.SHOWN&&op==='PICKUP'&&artifactId===id){
      phase=PHASE.HELD;
    }else if(phase===PHASE.HELD&&op==='RESOLVED'&&artifactId===id
      &&receipt.returnedToCradle===true
      &&['HIT','MISS','GROUND'].includes(receipt.resolution)){
      phase=PHASE.FINAL;
    }else return {ok:false,reason:'wrong-storm-lifecycle-order'};
    const entry=Object.freeze({
      event:op,artifactId:id,
      resolution:op==='RESOLVED'?receipt.resolution:null
    });
    stormReceipts.push(entry);
    return {ok:true,phase};
  }
  function snapshot(){return Object.freeze({
    active,armed,phase,observed,pending:pending!==null,
    artifactId,events:events.map(x=>({...x})),
    stormReceipts:stormReceipts.map(x=>({...x})),
    combatStopped:phase===PHASE.CHOICE,
    mayCompleteStory:false
  });}
  function close(){active=false;pending=null;hero=null;tot=null;}
  return Object.freeze({start,beforeAccepted,afterAccepted,physicalStorm,snapshot,close});
}
root.APEX_QUEST_TOT_LAST_CHOICE=Object.freeze({
  FIRST,LAST,STORM,PHASE,create
});
root.apexQuestTotLastChoice='ready';
})(typeof window!=='undefined'?window:globalThis);
