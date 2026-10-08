// Quest 01 E01 REFLEX — ordered receipts, NOT a second damage/skill engine.
// This module has zero timers, fake HP setters, synthetic projectiles or save
// writes. It only accepts proven engine transactions passed by the Quest
// encounter adapter. Q4A does not bypass the RIVET Stormbreaker gate.
(function questReflexReceipts(root){
  'use strict';
  if(root.apexQuestReflexReceipts==='ready')return;
  const PHASES=Object.freeze(['R1_PISTOL','R2_PISTOL','J_CAST','K_CAST','BOTH_HALF','AWAIT_RIVET']);
  function create(getActors){
    if(typeof getActors!=='function')throw Error('Quest REFLEX requires live actor resolver');
    let phase=0,closed=false,lastCastSeq=0;
    const accepted=[];
    function pair(){
      const actors=getActors();
      if(!Array.isArray(actors)||actors.length!==2)return null;
      const newbot=actors.find(f=>f?.questId==='NEWBOT'&&f.questTeam==='ALLY');
      const tot=actors.find(f=>f?.questId==='T.O.T'&&f.questTeam==='HOSTILE');
      if(!newbot||!tot||newbot===tot||newbot.id===tot.id)return null;
      if(![newbot,tot].every(f=>Number.isFinite(f.hp)&&Number.isFinite(f.maxHp)
        &&f.maxHp===1000&&f.hp>=0&&f.hp<=f.maxHp))return null;
      return {newbot,tot};
    }
    function acceptDamage(ev){
      const p=!closed&&pair();if(!p||!ev||phase>1)return false;
      if(ev.label!=='arsenal-pistol'||ev.statusDamage===true
        ||!Number.isFinite(Number(ev.amount))||Number(ev.amount)<=0)return false;
      const attacker=phase===0?p.newbot:p.tot;
      const victim=phase===0?p.tot:p.newbot;
      if(ev.attacker!==attacker||ev.victim!==victim)return false;
      accepted.push({kind:'PISTOL_HIT',from:attacker.questId,to:victim.questId,amount:Number(ev.amount)});
      phase++;
      return true;
    }
    function acceptCast(event){
      const p=!closed&&pair();if(!p||!event||event.type!=='Cast'||(phase!==2&&phase!==3))return false;
      const payload=event.payload;
      const seq=Number(event.seq);
      if(!payload||!Number.isSafeInteger(seq)||seq<=lastCastSeq
        ||payload.hero!=='ROBOT'||payload.fighterId!==p.newbot.id
        ||payload.side!=='p1'||payload.slot!==(phase===2?'A1':'A2'))return false;
      lastCastSeq=seq;
      accepted.push({kind:'CAST',slot:payload.slot,seq});
      phase++;
      return true;
    }
    function poll(){
      const p=!closed&&pair();
      if(!p)return snapshot();
      if(phase===4&&p.newbot.hp>0&&p.tot.hp>0&&p.newbot.hp<=500&&p.tot.hp<=500)phase=5;
      return snapshot();
    }
    function snapshot(){
      const p=!closed&&pair();
      return Object.freeze({active:!closed&&!!p,phase:closed?'CLOSED':PHASES[phase],
        receipts:accepted.map(x=>({...x})),hp:p?{newbot:p.newbot.hp,tot:p.tot.hp}:null,
        awaitingRivet:!closed&&phase===5,
        complete:false, // never claim success before authentic RIVET suppression
        storyProgress:false});
    }
    function close(){closed=true;}
    return Object.freeze({acceptDamage,acceptCast,poll,snapshot,close});
  }
  root.APEX_QUEST_REFLEX_RECEIPTS=Object.freeze({create,PHASES});
  root.apexQuestReflexReceipts='ready';
})(typeof window!=='undefined'?window:globalThis);
