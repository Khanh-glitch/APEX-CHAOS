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
      // Quest GOLD picker swaps the REAL combat kit while retaining the
      // narrative NEWBOT slot. Only a Cast receipt from THAT authenticated
      // Fighter/kit may unlock J/K; never accept a synthetic side-only Cast.
      const type=String(p.newbot.type?.name||p.newbot.name||'').toUpperCase();
      const kit={ROBOT:'ROBOT',HUNTER:'HUNTER',CRYSTAL:'CRYSTAL',
        CRYSTALA:'CRYSTAL',MAGNET:'MAGNET',FROST:'ICE',ICE:'ICE',
        MIRROR:'MIRROR'}[type];
      if(!payload||!kit||!Number.isSafeInteger(seq)||seq<=lastCastSeq
        ||payload.hero!==kit||payload.fighterId!==p.newbot.id
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
  // Q4D: strictly READ-ONLY technical acceptance of the already demonstrated
  // Q4C4 test rig. This is NOT an authorization to complete E01, save REFLEX
  // or trigger WORKSHOP. There is no substitute for a signed cinematic beat.
  // Inputs are LIVE Quest/Arsenal references, never a fabricated combat step.
  // Narrative STORMBREAKER receipt: intentionally NOT a throwable weapon.
  // A proof is accepted ONLY after the real slot exists, Gold's electric
  // simulator has emitted bolts for multiple physical frames, and ≥3s passed.
  // This never grants story completion or persistent checkpoint by itself.
  function technicalHandoff({gate,hold,rig,actors,projectiles,time,over}={}){
    const no=reason=>Object.freeze({ready:false,reason,storyComplete:false});
    const snap=gate?.snapshot?.();
    if(!snap?.active||snap.phase!=='AWAIT_RIVET'||snap.awaitingRivet!==true
       ||snap.complete!==false||snap.storyProgress!==false)return no('missing-real-e01-gate');
    const receipts=snap.receipts||[];
    if(receipts.length!==4
       ||receipts[0]?.kind!=='PISTOL_HIT'||receipts[0].from!=='NEWBOT'||receipts[0].to!=='T.O.T'
       ||receipts[1]?.kind!=='PISTOL_HIT'||receipts[1].from!=='T.O.T'||receipts[1].to!=='NEWBOT'
       ||receipts[2]?.kind!=='CAST'||receipts[2].slot!=='A1'
       ||receipts[3]?.kind!=='CAST'||receipts[3].slot!=='A2'
       ||!Number.isSafeInteger(receipts[2].seq)||!Number.isSafeInteger(receipts[3].seq)
       ||receipts[3].seq<=receipts[2].seq)return no('invalid-real-receipts');
    if(!Array.isArray(actors)||actors.length!==2)return no('wrong-live-roster');
    const newbot=actors.find(f=>f?.questId==='NEWBOT'&&f.questTeam==='ALLY');
    const tot=actors.find(f=>f?.questId==='T.O.T'&&f.questTeam==='HOSTILE');
    if(!newbot||!tot||newbot===tot||newbot.id===tot.id
      ||![newbot,tot].every(f=>Number.isFinite(f.hp)&&f.hp>0&&f.hp<=500)
      ||snap.hp?.newbot!==newbot.hp||snap.hp?.tot!==tot.hp)
      return no('inconsistent-real-fighter-hp');
    if(hold?.phase!=='AWAIT_RIVET'||hold.hp?.length!==2||hold.at!==time
      ||hold.hp.some(h=>!actors.some(f=>f.questId===h.id&&f.hp===h.hp)))
      return no('safe-hold-changed');
    if(!rig||rig.authority!=='ARSENAL_STORMBREAKER_FLOOR_MANIFEST'
       ||rig.phase!=='SETTLED'||rig.settled!==true
       ||!Number.isFinite(rig.elapsed)||rig.elapsed<3
       ||!Number.isInteger(rig.electricFrames)||rig.electricFrames<10
       ||!Number.isInteger(rig.peakBolts)||rig.peakBolts<=0
       ||rig.storyComplete!==false)return no('gold-floor-lightning-incomplete');
    if(!Number.isInteger(rig.slotId)||rig.slotId<=0)return no('missing-floor-slot');
    const slots=rig.getSlots?.();
    if(!Array.isArray(slots)||slots.length!==1)return no('unexpected-floor-inventory');
    const slot=slots[0];
    if(slot?.id!==rig.slotId||slot.questNarrativeOnly!==true
       ||slot.questStage!=='E01_GROUND_SUPPRESSION'
       ||slot.weaponId!=='STORMBREAKER'||slot.phase!=='REVEALED'
       ||slot.tier!=='T6'||!Number.isFinite(slot.x)||!Number.isFinite(slot.y))
      return no('missing-physical-narrative-slot');
    const point=rig.aimPoint,impact=rig.groundImpact;
    if(!point||!impact||impact.kind!=='REAL_ARSENAL_FLOOR_SPAWN'
       ||impact.slotId!==slot.id
       ||![impact.x,impact.y,point.x,point.y].every(Number.isFinite)
       ||slot.x!==impact.x||slot.y!==impact.y
       ||impact.x!==point.x||impact.y!==point.y)
       return no('unproven-ground-location');
    const midX=Math.max(120,Math.min(880,(newbot.x+tot.x)/2));
    const midY=Math.max(120,Math.min(880,(newbot.y+tot.y)/2));
    if(Math.abs(midX-slot.x)>0.001||Math.abs(midY-slot.y)>0.001)
      return no('ground-not-between-fighters');
    const frozen=rig.freeze;
    if(!frozen||frozen.time!==time
       ||JSON.stringify(frozen.hp)!==JSON.stringify(actors.map(f=>[f.questId,f.hp]))
       ||JSON.stringify(frozen.pos)!==JSON.stringify(actors.map(f=>[f.questId,f.x,f.y]))
       ||!Array.isArray(frozen.slots)||frozen.slots.length>5
       ||frozen.slots.some(x=>x?.[0]===slot.id))
       return no('combat-state-drift');
    if(!Array.isArray(projectiles)||projectiles.length!==0||over!=null)
      return no('unresolved-combat');
    return Object.freeze({ready:true,kind:'E01_RIVET_TECHNICAL_PREVIEW',
      phase:'FLOOR_DISCHARGED',storyComplete:false,checkpointAuthorized:false,
      weapon:'STORMBREAKER',operator:'RIVET',
      groundImpact:Object.freeze({x:slot.x,y:slot.y,
        kind:'REAL_ARSENAL_FLOOR_SPAWN',slotId:slot.id}),
      receipts:4,liveFighters:2,projectiles:0,
      electricFrames:rig.electricFrames,peakBolts:rig.peakBolts,
      elapsed:rig.elapsed});
  }
  root.APEX_QUEST_REFLEX_RECEIPTS=Object.freeze({create,PHASES,technicalHandoff});
  root.apexQuestReflexReceipts='ready';
})(typeof window!=='undefined'?window:globalThis);
