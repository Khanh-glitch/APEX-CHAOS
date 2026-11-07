/* E07 RIVET native Fighter damage boundary adapter.
 * The Quest Director does NOT get victory or story credits from this module.
 * Attach only to the actual hostile RIVET Fighter. All damage passes through
 * Fighter.takeDamage, including stock mitigation, after which threshold policy
 * can cap damage and observe genuine accepted HP loss.
 */
(function registerRivetDamageAdapter(root){
  'use strict';
  if(root.APEX_QUEST_RIVET_DAMAGE_ADAPTER)return;
  const BEFORE='__apexQuestBeforeAcceptedDamage';
  const AFTER='__apexQuestAfterAcceptedDamage';
  function create({thresholds,onCue}={}){
    if(typeof thresholds?.create!=='function')
      throw Error('E07 needs RIVET threshold authority');
    const observer=thresholds.create({onCue});
    let active=true,boss=null,oldBefore,oldAfter;
    function attach(fighter){
      if(!active||boss)return {ok:false,reason:'closed-or-already-attached'};
      if(!fighter||fighter.questId!=='RIVET'||fighter.questTeam!=='HOSTILE'
        ||fighter.maxHp!==1000||fighter.hp!==1000
        ||typeof fighter.takeDamage!=='function')
        return {ok:false,reason:'requires-real-hostile-rivet-at-1000'};
      // Never silently shadow E06's allied retreat callbacks. Boss battle
      // is a separate encounter with a fresh native Fighter instance.
      if(typeof fighter[BEFORE]==='function'||typeof fighter[AFTER]==='function')
        return {ok:false,reason:'foreign-accepted-damage-authority'};
      const armed=observer.preflight(fighter);
      if(!armed.ok)return armed;
      boss=fighter;oldBefore=fighter[BEFORE];oldAfter=fighter[AFTER];
      fighter[BEFORE]=function(actual,source,label,statusDamage){
        if(!active)throw Error('E07 closed accepted-damage authority invoked');
        const proposal=observer.beforeAccepted(this,actual);
        if(!proposal.ok)throw Error('E07 invalid real damage transaction: '+proposal.reason);
        // A ZERO realized hit returns before engine's AFTER callback; clear
        // only a genuine pending zero transaction (never fabricate an AFTER).
        if(proposal.allowed===0)observer.clearZero();
        return proposal.allowed;
      };
      fighter[AFTER]=function(real,source,label,statusDamage){
        if(!active)throw Error('E07 closed after-accepted callback invoked');
        const receipt=observer.afterAccepted(this,real);
        if(!receipt.ok)throw Error('E07 native damage receipt failed: '+receipt.reason);
      };
      return {ok:true,id:'RIVET',hp:fighter.hp};
    }
    function snapshot(){return observer.snapshot();}
    function close(){
      if(!active)return;
      active=false;
      if(boss){
        if(oldBefore===undefined)delete boss[BEFORE];else boss[BEFORE]=oldBefore;
        if(oldAfter===undefined)delete boss[AFTER];else boss[AFTER]=oldAfter;
        boss=null;
      }
      observer.close();
    }
    return Object.freeze({attach,snapshot,close});
  }
  root.APEX_QUEST_RIVET_DAMAGE_ADAPTER=Object.freeze({create});
  root.apexQuestRivetDamageAdapter='ready';
})(typeof window!=='undefined'?window:globalThis);
