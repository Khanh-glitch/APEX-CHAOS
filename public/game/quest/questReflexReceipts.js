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
  // Q4D: strictly READ-ONLY technical acceptance of the already demonstrated
  // Q4C4 test rig. This is NOT an authorization to complete E01, save REFLEX
  // or trigger WORKSHOP. There is no substitute for a signed cinematic beat.
  // Inputs are LIVE Quest/Arsenal references, never a fabricated combat step.
  function technicalHandoff({gate,hold,rig,actors,projectiles,time,over} = {}){
    const no=reason=>Object.freeze({ready:false,reason,storyComplete:false});
    const snap=gate?.snapshot?.();
    if(!snap?.active||snap.phase!=='AWAIT_RIVET'||snap.awaitingRivet!==true
      ||snap.complete!==false||snap.storyProgress!==false)return no('missing-real-e01-gate');
    const rs=snap.receipts||[];
    if(rs.length!==4
      ||rs[0]?.kind!=='PISTOL_HIT'||rs[0].from!=='NEWBOT'||rs[0].to!=='T.O.T'
      ||rs[1]?.kind!=='PISTOL_HIT'||rs[1].from!=='T.O.T'||rs[1].to!=='NEWBOT'
      ||rs[2]?.kind!=='CAST'||rs[2].slot!=='A1'
      ||rs[3]?.kind!=='CAST'||rs[3].slot!=='A2'
      ||!Number.isSafeInteger(rs[2].seq)||!Number.isSafeInteger(rs[3].seq)
      ||rs[3].seq<=rs[2].seq)return no('invalid-real-receipts');
    if(!Array.isArray(actors)||actors.length!==2)return no('wrong-live-roster');
    const n=actors.find(x=>x?.questId==='NEWBOT'&&x.questTeam==='ALLY');
    const t=actors.find(x=>x?.questId==='T.O.T'&&x.questTeam==='HOSTILE');
    // Only live HP threshold and authentic receipt matter. The previous
    // >=250 hidden floor silently invalidated a successful low-HP lesson.
    if(!n||!t||n===t||n.hp<=0||t.hp<=0||n.hp>500||t.hp>500
      ||snap.hp?.newbot!==n.hp||snap.hp?.tot!==t.hp)return no('inconsistent-fighter-hp');
    if(hold?.phase!=='AWAIT_RIVET'||hold.hp?.length!==2||hold.at!==time
      ||hold.hp.some(h=>!actors.some(a=>a.questId===h.id&&a.hp===h.hp)))
      return no('safe-hold-changed');
    if(!rig||rig.authority!=='ARSENAL_STORMBREAKER_EQUIP_PREVIEW'
      ||rig.phase!=='SETTLED'||rig.settled!==true
      ||rig.sawFlight!==true||rig.peakFlight!==1||rig.storyComplete!==false)
      return no('preview-not-settled');
    const strike=rig.groundImpact;
    const point=rig.aimPoint;
    if(!strike||strike.kind!=='REAL_ARSENAL_FLOOR_CONTACT'
      ||strike.weapon!=='STORMBREAKER'||strike.owner!=='RIVET'
      ||strike.projectileType!=='aq_thrown'
      ||!Number.isFinite(strike.x)||!Number.isFinite(strike.y)
      ||!point||strike.x!==point.x||strike.y!==point.y
      ||!Number.isFinite(strike.flightTime)||strike.flightTime<0)
      return no('missing-physical-floor-contact');
    const expectedX=(actors[0].x+actors[1].x)/2;
    const expectedY=(actors[0].y+actors[1].y)/2;
    if(Math.abs(strike.x-Math.max(45,Math.min(955,expectedX)))>0.001
      ||Math.abs(strike.y-Math.max(45,Math.min(955,expectedY)))>0.001)
      return no('strike-not-between-fighters');
    const b=rig.birth;
    if(b?.kind!=='aq_thrown'||b.weapon!=='STORMBREAKER'||b.owner!=='RIVET'
      ||![b.x,b.y,b.vx,b.vy].every(Number.isFinite)
      ||Math.hypot(b.vx,b.vy)<100)return no('unproven-arsenal-throw');
    // Safely fail if any physical training-state field drifted during the rig
    // flight. Comparison uses a snapshot captured BEFORE the real equip.
    const frozen=rig.freeze;
    if(!frozen||frozen.time!==time
      ||JSON.stringify(frozen.hp)!==JSON.stringify(actors.map(a=>[a.questId,a.hp]))
      ||JSON.stringify(frozen.pos)!==JSON.stringify(actors.map(a=>[a.questId,a.x,a.y]))
      ||JSON.stringify(frozen.slots)!==JSON.stringify(
        (rig.getSlots?.()||[]).map(s=>[s.id,s.phase]))
      ||!Array.isArray(frozen.slots))return no('combat-state-drift');
    if(!Array.isArray(projectiles)||projectiles.length!==0||over!=null)
      return no('unresolved-combat');
    return Object.freeze({
      ready:true,kind:'E01_RIVET_TECHNICAL_PREVIEW',
      phase:'PREVIEW_SETTLED',storyComplete:false,
      checkpointAuthorized:false,weapon:b.weapon,operator:b.owner,
      groundImpact:Object.freeze({x:strike.x,y:strike.y,kind:strike.kind}),
      receipts:4,liveFighters:2,projectiles:0
    });
  }
  root.APEX_QUEST_REFLEX_RECEIPTS=Object.freeze({create,PHASES,technicalHandoff});
  root.apexQuestReflexReceipts='ready';
})(typeof window!=='undefined'?window:globalThis);
