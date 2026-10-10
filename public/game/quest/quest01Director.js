// QUEST 01 — Q1 director. Story/checkpoint authority only: NEVER simulate combat.
// No Arsenal imports. No live Fighter objects persisted. Q1 is an unfinished opening.
(function quest01DirectorModule(root) {
  'use strict';
  if (root.APEX_QUEST01_DIRECTOR) return;
  const STORAGE_KEY = 'apex-chaos.quest01.progress.v1';
  const SCHEMA_VERSION = 1;
  const QUEST_ID = 'THE_ONES_THROWN_AWAY';
  const CONTENT_REVISION = 'q1-director-20261008';
  const NODES = Object.freeze([
    { id:'WAKE', label:'WAKE', type:'STORY', status:'PENDING_IMPLEMENTATION', copy:'No valid network ID. One machine wakes in the Scrap Basin.' },
    { id:'REFLEX', label:'REFLEX', type:'ENCOUNTER', encounterId:'E01', status:'PENDING_IMPLEMENTATION', copy:'Two routines wake beneath the scrap. Learn the controls through a real encounter.' },
    { id:'WORKSHOP', label:'WORKSHOP — THREE FAILURES', type:'STORY', status:'PENDING_IMPLEMENTATION', copy:'Three discarded units take shelter together. The workshop is their last safe place.' },
    { id:'FIRST_WAKE', label:'FIRST WAKE', type:'ENCOUNTER', encounterId:'E02', status:'CP04_PREVIEW_ONLY', copy:'NEWBOT and T.O.T stand together against two approaching scrap hunters.' },
    { id:'SCRAP_SWARM', label:'SCRAP SWARM', type:'ENCOUNTER', encounterId:'E03', status:'PENDING_IMPLEMENTATION', copy:'Two waves. Seven hostiles. Hold the basin without losing NEWBOT.' },
    { id:'WEAPON_RAIN', label:'WEAPON RAIN', type:'ENCOUNTER', encounterId:'E04', status:'PENDING_IMPLEMENTATION', copy:'Metal falls from above. Survive two hostiles and the final rain of weapons.' },
    { id:'CHARGE_THE_BREAKER', label:'CHARGE THE BREAKER', type:'ENCOUNTER', encounterId:'E05', status:'PENDING_IMPLEMENTATION', copy:'Charge the impact accumulator with genuine weapon damage. Hold until the relay answers.' },
    { id:'BREACH_WAVES', label:'BREACH WAVES', type:'ENCOUNTER', encounterId:'E06', status:'B6_NATIVE_ACCEPTANCE', copy:'Three allies defend the basin in three real waves. RIVET secures the rig before joining the front.' },
    { id:'RIVET_OVERRIDDEN', label:'RIVET OVERRIDDEN', type:'ENCOUNTER', encounterId:'E07', status:'B7_GOLD_NATIVE_PILOT' },
    { id:'TOT_LAST_CHOICE', label:'T.O.T — LAST CHOICE', type:'ENCOUNTER', encounterId:'E08', status:'B8_NATIVE_LAST_CHOICE', copy:'NEWBOT faces T.O.T. Only one of them can make the final choice.' },
    { id:'OUTSIDE', label:'OUTSIDE', type:'STORY', status:'B8_CLOSING_STORY', copy:'T.O.T chose to stop. NEWBOT steps beyond the workshop.' }
  ]);
  // Stage signposts are SYSTEM/NARRATOR information, not character speech.
  // They make each change in gameplay causal without inventing canon dialogue.
  // E06–E08 dialogue remains locked; do not preview spoiler text in the hub.
  const STORY_CONTEXT=Object.freeze({
    WAKE:'NEWBOT is awake, but the network cannot identify it. Another discarded unit is nearby.',
    REFLEX:'NEWBOT and T.O.T have not learned to recognize each other. Weapon contact reveals what their old routines can still do.',
    WORKSHOP:'RIVET stopped the duel with Stormbreaker. Three rejected machines reach the workshop together.',
    FIRST_WAKE:'Two Scrap Scouts approach the workshop perimeter. NEWBOT and T.O.T must defend it together.',
    SCRAP_SWARM:'The basin is not secure. Two successive enemy waves now force NEWBOT to hold the ground without a free reset.',
    WEAPON_RAIN:'The supply rhythm accelerates while two hostiles remain active. Every weapon is a real Arsenal pickup, not falling scenery.',
    CHARGE_THE_BREAKER:'The inert accumulator accepts weapon impacts. Filling its charge sends one infrastructure pulse toward the relay.',
    BREACH_WAVES:'The accumulator signal draws three waves. RIVET must stop operating the rig before joining NEWBOT and T.O.T in physical defense.',
    RIVET_OVERRIDDEN:'The relay identified RIVET and T.O.T; NEWBOT remains unidentified. RIVET returned to the passive rig and lost control of its body.',
    OUTSIDE:'RIVET survives the override. T.O.T voluntarily shuts down, leaving NEWBOT to find what lies beyond the Scrap Basin.'
  });
  const NODE_IDS = NODES.map(n => n.id);
  const byId = id => NODES.find(n => n.id === id) || null;
  const copy = value => JSON.parse(JSON.stringify(value));
  const safeStr = x => typeof x === 'string' ? x : '';
  let nextSession = 0;
  function makeState() {
    return {
      schemaVersion: SCHEMA_VERSION, questId: QUEST_ID, contentRevision: CONTENT_REVISION,
      checkpointId:'WAKE', encounterId:null, phaseId:'ENTRY',
      completedCueIds:[], stormbreakerArtifactPhase:'SEALED',
      sessionId:'quest01-' + Date.now() + '-' + (++nextSession),
      updatedAt:Date.now()
    };
  }
  function sanitize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.schemaVersion !== SCHEMA_VERSION || value.questId !== QUEST_ID) return null;
    if (!byId(value.checkpointId)) return null;
    if (safeStr(value.contentRevision) !== CONTENT_REVISION) return null; // future migration must be explicit
    const node = byId(value.checkpointId);
    if (value.encounterId !== (node.encounterId || null)) return null;
    if (value.phaseId !== 'ENTRY') return null; // Q1 never persists mid-combat frames
    if (!Array.isArray(value.completedCueIds) || value.completedCueIds.length > 150
      || value.completedCueIds.some(x => typeof x !== 'string' || x.length > 128)) return null;
    if (value.stormbreakerArtifactPhase !== 'SEALED') return null;
    const id = safeStr(value.sessionId);
    if (!id || id.length > 128) return null;
    return {
      schemaVersion:SCHEMA_VERSION,questId:QUEST_ID,contentRevision:CONTENT_REVISION,
      checkpointId:node.id,encounterId:node.encounterId || null,phaseId:'ENTRY',
      completedCueIds:[...new Set(value.completedCueIds)],
      stormbreakerArtifactPhase:'SEALED',sessionId:id,
      updatedAt:Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now()
    };
  }
  function create(storage) {
    let current = null;
    let readError = null;
    function load() {
      if (current) return copy(current);
      let parsed = null;
      try { const raw = storage && storage.getItem(STORAGE_KEY); parsed = raw ? JSON.parse(raw) : null; }
      catch (error) { readError = String(error && error.message || error); }
      current = sanitize(parsed) || makeState();
      return copy(current);
    }
    function persist() {
      const state = load();
      try { storage && storage.setItem(STORAGE_KEY,JSON.stringify(state)); }
      catch (error) { readError = String(error && error.message || error); }
      return state;
    }
    function beginOrResume() { load(); return persist(); }
    function checkpoint() { return load(); }
    function diagnostics() {
      return {checkpointId:load().checkpointId,storageError:readError,revision:CONTENT_REVISION};
    }
    function commitNativeTransition(target,cueIds) {
      // Never exposed to the browser as a generic checkpoint setter.
      // Only accept an ADJACENT native beat after the live game has already
      // passed the stricter receipt, actual impact and scene-ack gates below.
      const prev=load(),from=NODE_IDS.indexOf(prev.checkpointId),to=NODE_IDS.indexOf(target);
      if(to!==from+1)return {ok:false,reason:'non-adjacent-native-transition'};
      if(!Array.isArray(cueIds)||!cueIds.length
         ||cueIds.some(x=>typeof x!=='string'||x.length>128))
        return {ok:false,reason:'invalid-native-cues'};
      const all=[...new Set([...prev.completedCueIds,...cueIds])];
      if(all.length>150)return {ok:false,reason:'cue-limit'};
      current={...prev,checkpointId:target,encounterId:byId(target).encounterId||null,
        phaseId:'ENTRY',completedCueIds:all,updatedAt:Date.now()};
      return {ok:true,state:persist()};
    }
    function transitionForTest(target) {
      // Not exposed on browser singleton. Node/VM-only proof of deterministic
      // route ordering. NOT quest completion and NOT a cheat/unlock API.
      const prev=load(),from=NODE_IDS.indexOf(prev.checkpointId),to=NODE_IDS.indexOf(target);
      if (to !== from + 1) return {ok:false,reason:'non-adjacent-or-unknown'};
      current={...prev,checkpointId:target,encounterId:byId(target).encounterId || null,
        phaseId:'ENTRY',updatedAt:Date.now()};
      return {ok:true,state:persist()};
    }
    return { beginOrResume,checkpoint,diagnostics,
      _commitNativeTransition:commitNativeTransition,
      _transitionForNodeTest:transitionForTest };
  }
  const storage = root.localStorage || null;
  const permanentCore=create(storage);
  // Replay runs in a private in-memory copy. It can NEVER mutate the saved
  // Quest checkpoint and receives the same strict engine/scene receipt laws.
  let core=permanentCore;
  let replaySession=null;
  let lastReplayCompletion=null;
  function replayStatus(){
    return replaySession?Object.freeze({
      active:true,stageId:replaySession.stageId,
      originalCheckpoint:replaySession.originalCheckpoint
    }):Object.freeze({active:false});
  }
  function startReplay(stageId,options){
    const actual=permanentCore.checkpoint();
    const node=byId(stageId);
    const current=NODE_IDS.indexOf(actual.checkpointId);
    const target=NODE_IDS.indexOf(stageId);
    if(!node?.encounterId||target<0||target>=current)
      return {ok:false,reason:'replay-not-unlocked'};
    if(root.APEX_ARSENAL?.state?.active===true)
      return {ok:false,reason:'battle-already-active'};
    const entryId=stageId==='FIRST_WAKE'?'WORKSHOP':
      stageId==='REFLEX'?'WAKE':stageId;
    const entry=byId(entryId);
    const snapshot={
      ...actual,checkpointId:entryId,
      encounterId:entry.encounterId||null,
      phaseId:'ENTRY',updatedAt:Date.now(),
      sessionId:'quest01-replay-'+Date.now()+'-'+(++nextSession)
    };
    let raw=JSON.stringify(snapshot);
    const memory={
      getItem:key=>key===STORAGE_KEY?raw:null,
      setItem:(key,value)=>{if(key===STORAGE_KEY)raw=String(value);}
    };
    const opts=options||callbacks||{};
    core=create(memory);
    lastReplayCompletion=null;
    replaySession={stageId,originalCheckpoint:actual.checkpointId,completed:false};
    hide();
    const state=show(opts);
    return {ok:true,stageId,entryId,state,ephemeral:true};
  }
  function exitReplay(){
    if(!replaySession)return false;
    // Never swap authority back to the permanent save while a live Arsenal
    // battle still holds Quest receipts/callbacks from the replay instance.
    if(root.APEX_ARSENAL?.state?.active===true)return false;
    core=permanentCore;
    replaySession=null;
    lastReplayCompletion=null;
    hide();
    return true;
  }
  function commitSignedBeat(target,cues){
    const result=core._commitNativeTransition(target,cues);
    if(result?.ok===true&&replaySession){
      // A replay is ONE encounter, not a second campaign whose next
      // encounter can spill past the user's saved unlock boundary.
      replaySession.completed=NODE_IDS.indexOf(target)>
        NODE_IDS.indexOf(replaySession.stageId);
    }
    return result;
  }
  function acceptNativeBeat(beat) {
    const no=reason=>Object.freeze({ok:false,reason});
    const A=root.APEX_ARSENAL,q=A?.state,actors=root.fighters;
    if(beat==='E06_OVERRIDE_BUILDUP'){
      const p=root.APEX_QUEST_BREACH_POLICY;
      const live=q?.questBreachLifecycle?.snapshot?.();
      const rig=q?.questBreachRig?.snapshot?.();
      const view=q?.questBreachStoryView?.snapshot?.();
      const stages=['E06_RIG_LOCK','E06_BREACH_CLEAR','E06_RELAY_REPLY',
        'E06_NETWORK_SCAN','E06_RIG_RETURN','E06_OVERRIDE_BUILDUP'];
      if(core.checkpoint().checkpointId!=='BREACH_WAVES'||!q?.active
        ||q.questBreachProgression!==true||q.questBreachEncounter!==true
        ||q.over!=='QUEST_BREACH_WAVES_COMPLETE'||q.questOutcome!=='COMPLETE'
        ||p?.waveOutcome?.(actors,'C')?.status!=='COMPLETE'
        ||live?.phase!=='COMPLETE'||live.wave!=='C'||live.completed!==3
        ||live.receipts?.length!==3
        ||live.receipts.reduce((n,w)=>n+(w.physicalKOs?.length||0),0)!==10
        ||live.receipts.some((w,i)=>w.wave!=='ABC'[i]||
          w.physicalKOs?.some(k=>k.hp!==0||k.maxHp<=0))
        ||rig?.readyForE07!==true||rig.closed!==false
        ||rig.receipts?.map(x=>x.cue).join('|')!==stages.join('|')
        ||!view||view.active!==false||view.closed!==false
        ||view.shown.join('|')!==stages.join('|'))
        return no('e06-ten-native-KO-passive-rig-and-ordered-cinematic-required');
      return commitSignedBeat('RIVET_OVERRIDDEN',stages);
    }
    if(beat==='E08_L13'){
      const n=q?.questTotStormNative?.snapshot?.();
      const v=q?.questTotStoryView?.snapshot?.();
      const expected=['E08_START','E08_STORMBREAKER_ELIGIBLE',
        'E08_STORMBREAKER_RESOLVED','E08_TOT_NONLETHAL_CHOICE',
        'E08_L02','E08_L03','E08_L04','E08_L05','E08_L06','E08_L07','E08_L08','E08_L09','E08_L10','E08_L11','E08_L12','E08_L13'];
      const legal=['SPAWN','PICKUP','RESOLVED'];
      const physical=n?.stormReceipts?.map(x=>x.event)||[];
      const slot=q?.slots?.find(s=>s.id===n?.slotId);
      const holder=root.APEX_ARSENAL?.weaponApi?.getHolder?.(actors?.[1]);
      if(core.checkpoint().checkpointId!=='TOT_LAST_CHOICE'
        ||!q?.active||q.questTotProgression!==true
        ||q.questOutcome!=='COMPLETE'||q.over!=='QUEST_TOT_LAST_CHOICE_COMPLETE'
        ||actors?.length!==2||actors[0]?.questId!=='NEWBOT'||actors[0].hp<=0
        ||actors[1]?.questId!=='T.O.T'||actors[1]?.questTeam!=='HOSTILE'
        ||actors[1].maxHp!==1000||actors[1].hp!==120
        ||n?.phase!=='SAFE_CHOICE'||n?.observed!==120||n.pending
        ||!n.spawned||!n.returned||!n.projectileReleased||!n.projectileNative
        ||physical.join('|')!==legal.join('|')
        ||n.events?.map(e=>e.cue).join('|')!=='E08_STORMBREAKER_ELIGIBLE|E08_TOT_NONLETHAL_CHOICE'
        ||n.receipts?.filter(e=>e.native==='THROW').length!==1
        ||!n.cradle||n.cradle.slotId!==n.slotId
        ||slot?.questStage!=='E08_CRADLE_RETURN'
        ||slot?.questNarrativeOnly!==true||slot?.weaponId!=='STORMBREAKER'
        ||holder?.weaponId==='STORMBREAKER'
        ||!Array.isArray(root.projectiles)
        ||root.projectiles.some(p=>p.questTotArtifactId===String(n.slotId)&&p.state==='flight')
        ||q.questTotVoluntaryChoice!==true
        ||!v||v.active||v.closed||v.skipped.length>0
        ||v.shown.join('|')!==expected.join('|'))
        return no('e08-real-700-120-single-native-storm-and-voluntary-verbatim-ending-required');
      return commitSignedBeat('OUTSIDE',expected);
    }
    if(beat==='E07_RECOVERY'){
      const a=root.APEX_QUEST_RIVET_THRESHOLDS;
      const v=q?.questRivetStoryView?.snapshot?.();
      const sig=q?.questRivetAdapter?.snapshot?.();
      const needs=['E07_START','E07_RIVET_COMMAND_750',
        'E07_RIVET_COMMAND_450','E07_RIVET_NONLETHAL_STOP','E07_RECOVERY'];
      if(core.checkpoint().checkpointId!=='RIVET_OVERRIDDEN'||!q?.active
        ||q.questRivetProgression!==true||q.questRivetTest!==true
        ||q.over!=='QUEST_RIVET_OVERRIDDEN_COMPLETE'
        ||q.questOutcome!=='COMPLETE'
        ||actors?.length!==2||actors[0]?.questId!=='NEWBOT'||actors[0].hp<=0
        ||actors[1]?.questId!=='RIVET'||actors[1].questTeam!=='HOSTILE'
        ||actors[1].hp!==a?.STOP_HP||actors[1].maxHp!==a?.START_HP
        ||!sig?.stopped||sig.closed||sig.pending||sig.observed!==a.STOP_HP
        ||sig.cues?.map(x=>x.threshold).join('|')!=='750|450|180'
        ||q.questRivetReceipts?.map(x=>x.threshold).join('|')!=='750|450|180'
        ||!v||v.active||v.closed||v.shown.join('|')!==needs.join('|'))
        return no('e07-real-nonlethal-rivet-and-all-stories-required');
      return commitSignedBeat('TOT_LAST_CHOICE',needs);
    }
    if(beat==='E05_BREAKER_CHARGE_CLEAR'){
      const Q=root.APEX_QUEST_MULTI_ACTOR_CORE;
      const pulse=q?.questBreakerSequence?.snapshot?.();
      const view=q?.questBreakerStoryView?.snapshot?.();
      const genuine=Q?.breakerChargeOutcome?.(actors,pulse?.pulseObserved===true);
      if(core.checkpoint().checkpointId!=='CHARGE_THE_BREAKER'
         ||!q?.active||q.questBreakerChargeProgression!==true
         ||q.questOutcome!=='COMPLETE'||q.over!=='QUEST_BREAKER_CHARGE_COMPLETE'
         ||genuine?.status!=='COMPLETE'||pulse?.phase!=='PULSE'
         ||pulse?.requested!==3
         ||pulse?.accepted+pulse?.suppressed!==3
         ||pulse?.milestones?.join('|')!=='0.25|0.5|0.75|0.9|1'
         ||!view||view.active!==false||view.closed!==false
         ||view.shown.join('|')!=='E05_BREAKER_CHARGE_CLEAR')
        return no('e05-real-damage-pulse-and-panel-required');
      return commitSignedBeat('BREACH_WAVES',['E05_BREAKER_CHARGE_CLEAR']);
    }
    if(beat==='E04_WEAPON_RAIN_CLEAR'){
      const Q=root.APEX_QUEST_MULTI_ACTOR_CORE;
      const view=q?.questRainStoryView?.snapshot?.();
      const rain=q?.questRainSequence?.snapshot?.();
      if(core.checkpoint().checkpointId!=='WEAPON_RAIN'
        ||!q?.active||q.questWeaponRainProgression!==true
        ||q.questOutcome!=='COMPLETE'||q.over!=='QUEST_WEAPON_RAIN_COMPLETE'
        ||Q?.weaponRainOutcome?.(actors,rain?.observed===true)?.status!=='COMPLETE'
        ||rain?.attempted!==3||rain.accepted+rain.rejected!==3
        ||rain.phase!=='OBSERVED'
        ||!view||view.active!==false||view.closed!==false
        ||view.shown.join('|')!=='E04_WEAPON_RAIN_CLEAR')
        return no('e04-real-KO-rain-and-panel-required');
      return commitSignedBeat('CHARGE_THE_BREAKER',['E04_WEAPON_RAIN_CLEAR']);
    }
    if(beat==='E03_SCRAP_SWARM_CLEAR'){
      const Q=root.APEX_QUEST_MULTI_ACTOR_CORE;
      const checkpoint=core.checkpoint();
      if(checkpoint.checkpointId!=='SCRAP_SWARM'||!q?.active
        ||q.questScrapSwarmProgression!==true||q.questSwarmWave!=='B'
        ||q.questSwarmWaveBCreated!==true||q.questSwarmPhase!=='COMBAT'
        ||q.questOutcome!=='COMPLETE'||q.over!=='QUEST_SCRAP_SWARM_COMPLETE'
        ||!Array.isArray(actors)||Q?.scrapSwarmOutcome?.(actors,'B')?.status!=='COMPLETE')
        return no('e03-native-combat-not-earned');
      const first=q.questSwarmWaveAReceipt;
      // Single authority: Gold's physically created wave and the Director
      // MUST read one canonical roster. Balancing 280 -> 120 must not turn
      // genuine three-KO proof into an impossible hidden checkpoint gate.
      const expected=Q?.scrapSwarmRoster?.('A')?.filter(x=>x.questTeam==='HOSTILE');
      const expectedIds=new Set((expected||[]).map(x=>x.questId));
      if(!Array.isArray(expected)||expected.length!==3
        ||expectedIds.size!==3||!Array.isArray(first)
        ||first.length!==expected.length
        ||new Set(first.map(x=>x.questId)).size!==expected.length
        ||first.some(x=>{
          const authored=expected.find(e=>e.questId===x.questId);
          return !authored||x.hp!==0||x.maxHp!==authored.hp;
        }))
        return no('e03-prior-wave-unverified');
      const v=q.questSwarmStoryView?.snapshot?.();
      if(!v||v.active!==false||v.closed!==false
        ||v.shown.join('|')!=='E03_SCRAP_SWARM_CLEAR')
        return no('e03-result-panel-not-acknowledged');
      return commitSignedBeat('WEAPON_RAIN',['E03_SCRAP_SWARM_CLEAR']);
    }
    if(beat==='FIRST_WAKE_ENTER'||beat==='E02_FIRST_WAKE_CLEAR'){
      const Q=root.APEX_QUEST_MULTI_ACTOR_CORE;
      if(!q?.active||q.questFirstWake!==true||q.questFirstWakeProgression!==true
         ||!Array.isArray(actors)||actors.length!==4
         ||Q?.validateFirstWake?.(actors)?.ok!==true)
        return no('no-authorized-first-wake');
      const checkpoint=core.checkpoint();
      const byQuestId=id=>actors.find(x=>x.questId===id);
      const n=byQuestId('NEWBOT'),t=byQuestId('T.O.T');
      const a=byQuestId('SCRAP-A'),bb=byQuestId('SCRAP-B');
      if(!n||!t||!a||!bb
         ||n.questTeam!=='ALLY'||t.questTeam!=='ALLY'
         ||a.questTeam!=='HOSTILE'||bb.questTeam!=='HOSTILE')
        return no('incorrect-first-wake-roster');
      if(beat==='FIRST_WAKE_ENTER'){
        if(checkpoint.checkpointId!=='WORKSHOP'
          ||!checkpoint.completedCueIds.includes('WORKSHOP_ARRIVAL')
          ||q.over!=null||q.questOutcome!=null
          ||n.hp!==1000||t.hp!==1000||a.hp!==350||bb.hp!==350)
          return no('first-wake-entry-not-earned');
        return commitSignedBeat('FIRST_WAKE',['E02_FIRST_WAKE_ENTRY']);
      }
      const view=q.questFirstWakeStoryView?.snapshot?.();
      if(checkpoint.checkpointId!=='FIRST_WAKE'
        ||q.questOutcome!=='COMPLETE'||q.over!=='QUEST_FIRST_WAKE_COMPLETE'
        ||Q.firstWakeOutcome(actors).status!=='COMPLETE'
        ||n.hp<=0||a.hp>0||bb.hp>0
        ||!view||view.active!==false||view.closed!==false
        ||view.shown.join('|')!=='E02_FIRST_WAKE_CLEAR')
        return no('first-wake-KO-or-scene-not-earned');
      return commitSignedBeat('SCRAP_SWARM',['E02_FIRST_WAKE_CLEAR']);
    }
    if(!q?.active||q.questReflex!==true||q.questStoryCompletion!==true
      ||!Array.isArray(actors)||actors.length!==2
      ||actors[0]?.questId!=='NEWBOT'||actors[1]?.questId!=='T.O.T'
      ||actors[0]?.questTeam!=='ALLY'||actors[1]?.questTeam!=='HOSTILE')
      return no('no-authorized-live-e01');
    const v=q.questStoryView?.snapshot?.();
    if(!v||v.active!==false||!Array.isArray(v.shown)||v.closed!==false)
      return no('scene-not-acknowledged');
    const gate=q.questReflexGate?.snapshot?.();
    if(!gate?.active)return no('no-real-reflex');
    const checkpoint=core.checkpoint().checkpointId;
    if(beat==='WAKE_OPEN'){
      if(checkpoint!=='WAKE'||v.shown.join('|')!=='WAKE_OPEN'
         ||gate.phase!=='R1_PISTOL'||gate.receipts?.length!==0
         ||!actors.every(f=>f.hp===1000&&f.maxHp===1000)
         ||q.questRivetPreview)return no('wake-not-earned');
      return commitSignedBeat('REFLEX',['WAKE_OPEN']);
    }
    if(beat==='WORKSHOP_ARRIVAL'){
      if(checkpoint!=='REFLEX'||q.questWorkshopPreview!==true
         ||q.questStoryRescueStart?.ok!==true
         ||gate.phase!=='AWAIT_RIVET'||gate.receipts?.length!==4)
        return no('workshop-not-earned');
      const expected=['E01_R1_IMPACT','E01_R2_IMPACT','E01_J_REVEAL',
        'E01_K_REVEAL','E01_RIVET_HOLD','E01_RIVET_SUPPRESSION_TECH',
        'WORKSHOP_ARRIVAL'];
      const observed=v.shown[0]==='WAKE_OPEN'?v.shown.slice(1):v.shown;
      if(observed.join('|')!==expected.join('|'))return no('incomplete-cinematic-route');
      // Crucially, this proof REBUILDS from actual engine state, not from
      // caller-provided flags. A storyboard click alone can never pass.
      const proof=root.__apexQuestReflexTechnicalRead?.();
      const ground=q.questRivetPreview?.groundImpact;
      if(proof?.ready!==true||proof.kind!=='E01_RIVET_TECHNICAL_PREVIEW'
        ||proof.checkpointAuthorized!==false||proof.storyComplete!==false
        ||proof.groundImpact?.kind!=='REAL_ARSENAL_FLOOR_SPAWN'
        ||ground?.kind!=='REAL_ARSENAL_FLOOR_SPAWN'
        ||ground?.x!==proof.groundImpact.x||ground?.y!==proof.groundImpact.y
        ||!Array.isArray(root.projectiles)||root.projectiles.length!==0
        ||q.over!=null)return no('no-physical-rescue-proof');
      return commitSignedBeat('WORKSHOP',[
        'E01_R1_IMPACT','E01_R2_IMPACT','E01_J_REVEAL','E01_K_REVEAL',
        'E01_RIVET_HOLD','E01_RIVET_SUPPRESSION_TECH','WORKSHOP_ARRIVAL']);
    }
    return no('unsupported-native-beat');
  }
  // Presentation lives only in the Gold Home document and never touches the
  // existing Gold HUD geometry, canvas or battle engine.
  let overlay = null;
  let callbacks = null;
  let previousFocus = null;
  const HAS_DOM = !!(root.document && root.document.createElement);
  // Quest-only adaptation of the Gold hero pick roster/portrait authority.
  // This is a combat-kit choice, not a new hero economy or story identity.
  const QUEST_HEROES=Object.freeze([
    ['newbot','ROBOT','ROBOT'],['hunter','HUNTER','HUNTER'],
    ['crystala','CRYSTAL','CRYSTALA'],['magnet','MAGNET','MAGNET'],
    ['frost','ICE','FROST'],['mirror','MIRROR','MIRROR']
  ]);
  function populateQuestHeroPicker(overlay){
    const host=overlay?.querySelector('#q1HeroCards');
    if(!host)return;
    const allowed=root.APEX_PRODUCT_SURFACE?.roster?.playableIds;
    const accepted=Array.isArray(allowed)&&allowed.length
      ?new Set(allowed):new Set(['ROBOT']);
    const picked=QUEST_HEROES.some(x=>x[0]===root.__apexQuestHeroChoice)
      ?root.__apexQuestHeroChoice:'newbot';
    root.__apexQuestHeroChoice=picked;
    host.replaceChildren();
    for(const [key,id,label] of QUEST_HEROES){
      const available=accepted.has(id),selected=key===picked;
      const card=root.document.createElement('button');
      card.type='button';card.className='q1-hero-card';
      card.disabled=!available;card.setAttribute('aria-pressed',String(selected));
      card.setAttribute('aria-label',label+(available?'':' locked'));
      const img=root.document.createElement('img');
      // EXACT Gold product roster card asset path, never the old Quest
      // placeholder or a copied weapon illustration.
      img.src='/assets/gold-ui/heroes/'+key+'/pick_roster_cover.webp';
      img.alt='';img.loading='lazy';
      const title=root.document.createElement('span');
      title.textContent=label;
      card.append(img,title);
      card.addEventListener('click',()=>{
        if(!available)return;
        root.__apexQuestHeroChoice=key;
        populateQuestHeroPicker(overlay);
      });
      host.appendChild(card);
    }
  }
  function ensureView() {
    if (!HAS_DOM || overlay) return overlay;
    const d = root.document;
    const style = d.createElement('style');
    style.id='apexQuest01StageStyles';
    style.textContent=[
      '#apexQuest01Stage{position:fixed;inset:0;z-index:9200;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(3,5,8,.95);color:#e8e9e5;font-family:Arial,sans-serif;}',
      '#apexQuest01Stage[hidden]{display:none;}',
      '#apexQuest01Stage .q1-panel{position:relative;width:min(620px,100%);max-height:min(88dvh,900px);overflow:auto;border:1px solid #84613b;border-top:3px solid #e4a858;background:radial-gradient(ellipse at 95% 6%,#48321b77,transparent 43%),linear-gradient(145deg,#1a1d21,#080c10 78%);box-shadow:0 18px 75px #000d,0 0 55px #b16a1a12;padding:clamp(20px,5vw,42px);animation:q1Enter .42s cubic-bezier(.18,.82,.25,1) both;}',
      '@keyframes q1Enter{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '#apexQuest01Stage .q1-panel::before{content:"";pointer-events:none;position:absolute;inset:0;opacity:.09;background:repeating-linear-gradient(0deg,transparent 0 3px,#ddd 4px 4.5px)}',
      '#apexQuest01Stage .q1-progress{height:3px;background:#34312b;margin:18px 0 4px;position:relative;overflow:hidden}',
      '#apexQuest01Stage .q1-progress::before{content:"";position:absolute;inset:0 auto 0 0;width:var(--quest-progress,9.1%);background:linear-gradient(90deg,#8d5926,#ffc174);box-shadow:0 0 12px #efa448}',
      '#apexQuest01Stage .q1-eyebrow{font-size:11px;letter-spacing:.22em;color:#c5a069;font-weight:700;}',
      '#apexQuest01Stage h2{font-family:Impact,"Arial Narrow",Arial,sans-serif;font-size:clamp(36px,7vw,72px);line-height:.93;margin:18px 0 16px;letter-spacing:.045em;text-transform:uppercase;text-shadow:0 4px 19px #0008;}',
      '#apexQuest01Stage .q1-sub{font-size:13px;line-height:1.7;color:#c9cbd0;max-width:48ch;}',
      '#apexQuest01Stage .q1-cause{margin-top:14px;padding:12px 14px;border-left:2px solid #c18a48;background:#e7a65d0c;display:grid;gap:6px;}',
      '#apexQuest01Stage .q1-cause-kicker{font-size:10px;letter-spacing:.16em;font-weight:800;color:#d7ac72;}',
      '#apexQuest01Stage .q1-cause-text{font:500 12px/1.6 Arial,sans-serif;color:#d4d6d5;max-width:52ch;}',
      '#apexQuest01Stage .q1-status{margin:24px 0 12px;color:#c4a777;font-size:11px;letter-spacing:.13em;}',
      '#apexQuest01Stage .q1-hero-pick{margin:17px 0 10px;padding:14px;border:1px solid #5b4f3b;background:linear-gradient(145deg,#111922,#111112)}',
      '#apexQuest01Stage .q1-hero-pick strong{display:block;color:#eec48a;font:800 11px/1.4 Arial;letter-spacing:.14em;margin-bottom:12px}',
      '#apexQuest01Stage .q1-hero-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
      '#apexQuest01Stage .q1-hero-card{position:relative;display:flex;align-items:center;gap:8px;min-height:62px;overflow:hidden;text-align:left;padding:5px!important;border:1px solid #48525c!important;background:#101922!important;color:#f8eac9!important;font:800 10px/1.2 Arial;letter-spacing:.025em!important}',
      '#apexQuest01Stage .q1-hero-card img{width:53px;height:53px;flex:none;object-fit:cover}',
      '#apexQuest01Stage .q1-hero-card[aria-pressed="true"]{border-color:#ffc26d!important;box-shadow:0 0 0 1px #df9b42 inset,0 0 15px #a4711c33}',
      '#apexQuest01Stage .q1-hero-card:disabled{opacity:.30;filter:grayscale(1)}',
      '@media(max-width:600px){#apexQuest01Stage .q1-hero-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '#apexQuest01Stage .q1-actions{display:grid;gap:10px;margin-top:22px;}',
      '#apexQuest01Stage button{font:700 13px Arial,sans-serif;letter-spacing:.1em;min-height:48px;padding:12px 15px;border:1px solid #9a8259;color:#f6eee0;background:#403725;cursor:pointer;}',
      '#apexQuest01Stage button:focus-visible{outline:3px solid #f6c981;outline-offset:3px;}',
      '#apexQuest01Stage #q4hQuestPlay,#apexQuest01Stage #q4iFirstWakePlay,#apexQuest01Stage #q5ScrapSwarmPlay,#apexQuest01Stage #q5WeaponRainPlay,#apexQuest01Stage #q5BreakerChargePlay,#apexQuest01Stage #q6BreachPlay,#apexQuest01Stage #q7RivetPlay,#apexQuest01Stage #q8TotPlay{background:linear-gradient(120deg,#98672a,#ebae59);color:#13100c;border-color:#e7b66e;box-shadow:0 8px 24px #0008;transition:transform .18s,filter .18s,box-shadow .18s;}',
      '#apexQuest01Stage button:where(:hover,:focus-visible){filter:brightness(1.13);box-shadow:0 8px 24px #b9742644;}',
      '#apexQuest01Stage button:active{transform:scale(.985)}',
      '@media(max-height:520px){#apexQuest01Stage{padding:8px}#apexQuest01Stage .q1-panel{padding:14px;max-height:calc(100dvh - 16px)}#apexQuest01Stage h2{font-size:clamp(28px,7vh,48px);margin:8px 0}#apexQuest01Stage .q1-status{margin:10px 0 4px}}',
      '@media(prefers-reduced-motion:reduce){#apexQuest01Stage .q1-panel,#apexQuest01Stage button{animation:none;transition:none}}',
      '#apexQuest01Stage button.q1-back{background:transparent;border-color:#61666b;color:#d1d1cf;}',
      '#apexQuest01Stage .q1-fine{margin-top:16px;font-size:11px;color:#9fa5ad;line-height:1.5;}',
      '#apexQuest01Stage .q1-hub{margin-top:16px;padding-top:14px;border-top:1px solid #6e5535;display:grid;gap:8px}',
      '#apexQuest01Stage .q1-hub h3{font:800 11px/1.4 Arial,sans-serif;letter-spacing:.17em;color:#caa674;margin:0 0 4px}',
      '#apexQuest01Stage .q1-hub-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:7px}',
      '#apexQuest01Stage .q1-hub button{min-height:40px;text-align:left;padding:8px 10px;font-size:10px;letter-spacing:.05em}',
      '#apexQuest01Stage .q1-hub button[disabled]{opacity:.42;cursor:default;filter:none}',
      '#apexQuest01Stage .q1-replay-note{font:600 11px/1.55 Arial,sans-serif;color:#cbb18a}'
    ].join('\n');
    d.head.appendChild(style);
    overlay = d.createElement('section');
    overlay.id='apexQuest01Stage';overlay.hidden=true;overlay.tabIndex=-1;
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Quest 01 story checkpoint');
    // Static trusted template: copy is set via textContent only.
    overlay.innerHTML='<div class="q1-panel"><div class="q1-eyebrow">QUEST 01 // THE ONES THROWN AWAY</div><div class="q1-progress" aria-hidden="true"></div><h2 id="q1Title"></h2><p class="q1-sub" id="q1Copy"></p><div class="q1-cause" id="q1Cause" hidden><div class="q1-cause-kicker">WHY THIS CHAPTER</div><div class="q1-cause-text" id="q1Context"></div></div><p class="q1-status" id="q1Status"></p><section class="q1-hero-pick" aria-label="Quest hero selection"><strong>QUEST · CHOOSE YOUR COMBAT HERO</strong><div class="q1-hero-cards" id="q1HeroCards"></div></section><div class="q1-actions"><button type="button" id="q4hQuestPlay">START QUEST 01 · OPENING</button><button type="button" id="q4iFirstWakePlay">BEGIN FIRST WAKE · E02</button><button type="button" id="q5ScrapSwarmPlay">ENTER SCRAP SWARM · E03</button><button type="button" id="q5WeaponRainPlay">ENTER WEAPON RAIN · E04</button><button type="button" id="q5BreakerChargePlay">CHARGE THE BREAKER · E05</button><button type="button" id="q6BreachPlay">DEFEND THE BREACH · E06</button><button type="button" id="q7RivetPlay">FACE RIVET · E07</button><button type="button" id="q8TotPlay">T.O.T · LAST CHOICE · E08</button><button type="button" id="q1Preview">PLAYTEST FIRST WAKE · CP04</button><button type="button" id="q4ReflexPreview">PLAYTEST REFLEX · Q4A</button><button type="button" id="q4eStoryPreview">REFLEX · STORY PREVIEW</button><button type="button" class="q1-back" id="q1Exit">RETURN HOME</button></div><div class="q1-fine" id="q1Objective"></div><nav class="q1-hub" aria-label="Quest encounter replay"><h3>QUEST STAGES / REPLAY</h3><div class="q1-hub-grid" id="q1StageHub"></div><div class="q1-replay-note" id="q1ReplayNotice"></div></nav></div>';
    d.body.appendChild(overlay);
    populateQuestHeroPicker(overlay);
    overlay.querySelector('#q1Exit').addEventListener('click',()=>{
      if(replaySession)exitReplay();else hide();
    });
    overlay.querySelector('#q1Preview').addEventListener('click',()=>{const cb=callbacks && callbacks.onPreview;hide(); if(typeof cb==='function')cb();});
    overlay.querySelector('#q4ReflexPreview').addEventListener('click',()=>{const cb=callbacks && callbacks.onReflexPreview;hide();root.__APEX_QUEST_STORY_PLAYBACK=false;if(typeof cb==='function')cb();});
    overlay.querySelector('#q4iFirstWakePlay').addEventListener('click',()=>{
      if(!['WORKSHOP','FIRST_WAKE'].includes(core.checkpoint().checkpointId))return;
      const opts=callbacks;
      // Never bypass Gold composer: only it mounts the real battle surface
      // and grants a short-lived Quest launch authority.
      const cb=callbacks?.onFirstWakeStory||root.__apexGoldQuestFirstWakeStoryEntry;
      if(typeof cb!=='function')return;
      hide();const started=cb();
      if(started!==true)show(opts);
    });
    overlay.querySelector('#q6BreachPlay').addEventListener('click',()=>{
      if(core.checkpoint().checkpointId!=='BREACH_WAVES')return;
      const opts=callbacks;
      const cb=callbacks?.onBreachStory||root.__apexGoldQuestBreachStoryEntry;
      if(typeof cb!=='function')return;
      hide();const started=cb();
      if(started!==true)show(opts);
    });
    overlay.querySelector('#q8TotPlay').addEventListener('click',()=>{
      if(core.checkpoint().checkpointId!=='TOT_LAST_CHOICE')return;
      const opts=callbacks;
      const cb=callbacks?.onTotStory||root.__apexGoldQuestTotStoryEntry;
      if(typeof cb!=='function')return;
      hide();const started=cb();
      if(started!==true)show(opts);
    });
    overlay.querySelector('#q7RivetPlay').addEventListener('click',()=>{
      if(core.checkpoint().checkpointId!=='RIVET_OVERRIDDEN')return;
      const opts=callbacks;
      const cb=callbacks?.onRivetStory||root.__apexGoldQuestRivetStoryEntry;
      if(typeof cb!=='function')return;
      hide();const started=cb();
      if(started!==true)show(opts);
    });
    overlay.querySelector('#q5BreakerChargePlay').addEventListener('click',()=>{
      if(core.checkpoint().checkpointId!=='CHARGE_THE_BREAKER')return;
      const opts=callbacks;
      const cb=callbacks?.onBreakerChargeStory||root.__apexGoldQuestBreakerChargeStoryEntry;
      if(typeof cb!=='function')return;
      hide();const started=cb();if(started!==true)show(opts);
    });
    overlay.querySelector('#q5WeaponRainPlay').addEventListener('click',()=>{
      if(core.checkpoint().checkpointId!=='WEAPON_RAIN')return;
      const opts=callbacks;
      const cb=callbacks?.onWeaponRainStory||root.__apexGoldQuestWeaponRainStoryEntry;
      if(typeof cb!=='function')return;
      hide();const started=cb();if(started!==true)show(opts);
    });
    overlay.querySelector('#q5ScrapSwarmPlay').addEventListener('click',()=>{
      if(core.checkpoint().checkpointId!=='SCRAP_SWARM')return;
      const opts=callbacks;
      const cb=callbacks?.onScrapSwarmStory||root.__apexGoldQuestScrapSwarmStoryEntry;
      if(typeof cb!=='function')return;
      hide();const started=cb();
      if(started!==true)show(opts);
    });
    overlay.querySelector('#q4hQuestPlay').addEventListener('click',()=>{
      if(!['WAKE','REFLEX'].includes(core.checkpoint().checkpointId))return;
      const cb=callbacks&&callbacks.onReflexPreview;hide();
      root.__APEX_QUEST_STORY_PLAYBACK=true;
      root.__APEX_QUEST_STORY_FULL=true;
      if(typeof cb==='function')cb();
    });
    // The Story preview is an isolated alternative presentation of the same
    // Arsenal duel. It cannot mark REFLEX complete, unlock a checkpoint or
    // be reached by a generic Story save transition.
    overlay.querySelector('#q4eStoryPreview').addEventListener('click',()=>{
      const cb=callbacks&&callbacks.onReflexPreview;hide();
      root.__APEX_QUEST_STORY_PLAYBACK=true;
      delete root.__APEX_QUEST_STORY_FULL;
      if(typeof cb==='function')cb();
    });
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();if(replaySession)exitReplay();else hide();}else if(e.key==='Tab'){const els=[overlay.querySelector('#q8TotPlay'),overlay.querySelector('#q7RivetPlay'),overlay.querySelector('#q6BreachPlay'),overlay.querySelector('#q5BreakerChargePlay'),overlay.querySelector('#q5WeaponRainPlay'),overlay.querySelector('#q5ScrapSwarmPlay'),overlay.querySelector('#q4iFirstWakePlay'),overlay.querySelector('#q4hQuestPlay'),overlay.querySelector('#q1Preview'),overlay.querySelector('#q4ReflexPreview'),overlay.querySelector('#q4eStoryPreview'),overlay.querySelector('#q1Exit')].filter(x=>!x.hidden);const index=els.indexOf(d.activeElement);if(e.shiftKey&&index===0){e.preventDefault();els[els.length-1].focus();}if(!e.shiftKey&&index===els.length-1){e.preventDefault();els[0].focus();}}});
    return overlay;
  }
  function show(options) {
    if(overlay)populateQuestHeroPicker(overlay);
    // Story callback order is acceptNativeBeat -> exitArsenalBattleMode ->
    // Director.show. Restore only AFTER the true battle has been disposed.
    let restoredFromReplay=false;
    if(replaySession?.completed===true
       &&root.APEX_ARSENAL?.state?.active!==true){
      lastReplayCompletion=replaySession.stageId;
      core=permanentCore;
      replaySession=null;
      restoredFromReplay=true;
    }
    const el=ensureView();
    // Inspecting the permanent chapter immediately after replay must NOT
    // write localStorage, even a byte-identical redundant save.
    const state=restoredFromReplay?core.checkpoint():core.beginOrResume();
    if (!el) return state;
    callbacks=options||{};
    const node=byId(state.checkpointId);
    el.dataset.node=node.id;
    el.querySelector('#q1Title').textContent=node.label;
    el.querySelector('#q1Copy').textContent=node.copy||'Another chapter waits beyond the scrap.';
    const chapterContext=STORY_CONTEXT[node.id]||'';
    el.querySelector('#q1Context').textContent=chapterContext;
    el.querySelector('#q1Cause').hidden=!chapterContext;
    const index=NODE_IDS.indexOf(node.id);
    el.querySelector('#q1Status').textContent='CHAPTER '+String(index+1).padStart(2,'0')+' / 11';
    el.querySelector('.q1-panel').style.setProperty('--quest-progress',((index+1)/NODE_IDS.length*100).toFixed(2)+'%');
    const objective={
      CHARGE_THE_BREAKER:'6000 DAMAGE · ONE ACCUMULATOR · REAL WEAPON CONTACT',
      BREACH_WAVES:'THREE ALLIES · THREE REAL WAVES · RETREAT AT DANGER',
      REFLEX:'ROUTINE J / K · REAL COMBAT',
      FIRST_WAKE:'FIGHT TOGETHER · E02',
      SCRAP_SWARM:'SURVIVE TWO WAVES · E03',
      WEAPON_RAIN:'TWO HOSTILES · FINAL RAIN · E04'
    };
    el.querySelector('#q1Objective').textContent=objective[node.id]||'THE ONES THROWN AWAY';
    const saved=permanentCore.checkpoint();
    const furthest=NODE_IDS.indexOf(saved.checkpointId);
    const hub=el.querySelector('#q1StageHub');
    hub.replaceChildren();
    for(const stage of NODES.filter(n=>n.encounterId)){
      const at=NODE_IDS.indexOf(stage.id);
      const completed=at<furthest;
      const current=at===furthest;
      const action=root.document.createElement('button');
      action.type='button';action.dataset.stage=stage.id;
      action.textContent=stage.encounterId+' · '+stage.label+
        (completed?'  / REPLAY':current?'  / CURRENT':'  / LOCKED');
      action.disabled=!completed;
      action.title=completed?'Replay in isolated session — permanent checkpoint unchanged':
        current?'Continue using the current chapter button':'Complete earlier encounters to unlock';
      if(completed)action.addEventListener('click',()=>startReplay(stage.id,callbacks||{}));
      hub.appendChild(action);
    }
    el.querySelector('#q1ReplayNotice').textContent=replaySession
      ?'REPLAY MODE · progress and results are temporary. Return Home to restore your saved chapter.'
      :lastReplayCompletion
        ?('REPLAY '+lastReplayCompletion+' COMPLETE · Original chapter restored. No permanent progress or rewards were changed.')
        :'Previously completed encounters can be replayed without changing the saved chapter.';
    el.querySelector('#q4hQuestPlay').hidden=!['WAKE','REFLEX'].includes(node.id);
    el.querySelector('#q4iFirstWakePlay').hidden=!['WORKSHOP','FIRST_WAKE'].includes(node.id);
    el.querySelector('#q5ScrapSwarmPlay').hidden=node.id!=='SCRAP_SWARM';
    el.querySelector('#q5WeaponRainPlay').hidden=node.id!=='WEAPON_RAIN';
    el.querySelector('#q5BreakerChargePlay').hidden=node.id!=='CHARGE_THE_BREAKER';
    el.querySelector('#q6BreachPlay').hidden=node.id!=='BREACH_WAVES';
    el.querySelector('#q7RivetPlay').hidden=node.id!=='RIVET_OVERRIDDEN';
    el.querySelector('#q8TotPlay').hidden=node.id!=='TOT_LAST_CHOICE';
    // Playtest-only probes remain discoverable on localhost but cannot
    // appear as unfinished developer chrome on the Cloudflare production UI.
    const diagnostic=['localhost','127.0.0.1','::1'].includes(String(root.location?.hostname||''))||
      root.__APEX_TEST_MODE===true;
    for(const id of ['q1Preview','q4ReflexPreview','q4eStoryPreview'])
      el.querySelector('#'+id).hidden=!diagnostic;
    previousFocus=root.document.activeElement;
    el.hidden=false;
    const start=!el.querySelector('#q8TotPlay').hidden
      ?el.querySelector('#q8TotPlay')
      :!el.querySelector('#q7RivetPlay').hidden
      ?el.querySelector('#q7RivetPlay')
      :!el.querySelector('#q6BreachPlay').hidden
      ?el.querySelector('#q6BreachPlay')
      :!el.querySelector('#q5BreakerChargePlay').hidden
      ?el.querySelector('#q5BreakerChargePlay')
      :!el.querySelector('#q5WeaponRainPlay').hidden
      ?el.querySelector('#q5WeaponRainPlay')
      :!el.querySelector('#q5ScrapSwarmPlay').hidden
      ?el.querySelector('#q5ScrapSwarmPlay')
      :el.querySelector('#q4iFirstWakePlay').hidden
        ?(el.querySelector('#q4hQuestPlay').hidden?el.querySelector('#q1Exit'):el.querySelector('#q4hQuestPlay'))
        :el.querySelector('#q4iFirstWakePlay');
    start.focus({preventScroll:true});
    return state;
  }
  function hide() {
    if (!overlay || overlay.hidden) return false;
    overlay.hidden=true;callbacks=null;
    if (previousFocus && typeof previousFocus.focus==='function') previousFocus.focus({preventScroll:true});
    return true;
  }
  const api=Object.freeze({
    beginOrResume:()=>core.beginOrResume(), checkpoint:()=>core.checkpoint(),
    diagnostics:()=>core.diagnostics(), acceptNativeBeat, show, hide,
    startReplay,exitReplay,replayStatus,
    isVisible:()=>!!(overlay&&!overlay.hidden),
    sequence:()=>NODES.map(({id,label,type,status,encounterId})=>({id,label,type,status,encounterId:encounterId||null})),
    STORAGE_KEY
  });
  root.APEX_QUEST01_DIRECTOR = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports={create,makeState,sanitize,NODES,STORY_CONTEXT,STORAGE_KEY,CONTENT_REVISION};
  }
})(typeof window !== 'undefined' ? window : globalThis);
