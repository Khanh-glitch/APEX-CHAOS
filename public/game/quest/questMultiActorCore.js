/* APEX CHAOS Q2 — pure Quest team/target/roster authority.
 * Loaded only in the isolated Quest feature runtime branch.
 * No damage, projectile, cooldown, weapon, HUD or movement laws are copied here.
 * Future integration must call these selectors from the real Arsenal lifecycle.
 */
(function installQuestMultiActorCore(root) {
  'use strict';
  if (root.APEX_QUEST_MULTI_ACTOR_CORE) return;

  const EPS = 1e-9;
  const finite = Number.isFinite;
  const alive = (a) => !!(a && finite(a.hp) && a.hp > 0);
  const identity = (a) => String(a && a.id != null ? a.id : '');
  const team = (a) => a && typeof a.questTeam === 'string' ? a.questTeam : '';
  function hostile(a, b) {
    return !!(a && b && a !== b && team(a) && team(b) && team(a) !== team(b));
  }
  function stableCompare(a, b) {
    // Stable tie-breaking independent of array insertion order.
    const x = identity(a), y = identity(b);
    return x < y ? -1 : (x > y ? 1 : 0);
  }
  function distanceSq(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
  function livingEnemies(actor, actors) {
    if (!actor || !Array.isArray(actors)) return [];
    return actors.filter((other) => alive(other) && hostile(actor, other));
  }
  function nearestEnemy(actor, actors) {
    if (!alive(actor)) return null;
    let best = null, score = Infinity;
    for (const other of livingEnemies(actor, actors)) {
      const d = distanceSq(actor, other);
      if (d + EPS < score || (Math.abs(d - score) <= EPS && best && stableCompare(other, best) < 0)) {
        best = other; score = d;
      }
    }
    return best;
  }

  // Returns normalized first intersection t in [0,1], or null. Start-inside
  // hits are 0. This is swept contact, not an end-point proximity guess.
  function sweptEntry(from, to, circle, radius) {
    if (!from || !to || !circle || !finite(radius) || radius < 0) return null;
    const dx = to.x - from.x, dy = to.y - from.y;
    const fx = from.x - circle.x, fy = from.y - circle.y;
    const aa = dx * dx + dy * dy;
    const cc = fx * fx + fy * fy - radius * radius;
    if (cc <= 0) return 0;
    if (!(aa > EPS)) return null;
    const bb = 2 * (fx * dx + fy * dy);
    const discriminant = bb * bb - 4 * aa * cc;
    if (discriminant < 0) return null;
    const t = (-bb - Math.sqrt(discriminant)) / (2 * aa);
    return t >= -EPS && t <= 1 + EPS ? Math.max(0, Math.min(1, t)) : null;
  }

  // Caller supplies the weapon's *actual* collision radius scaling from CFG.
  // No HP deduction here: the real weapon API must apply the actual hit.
  function firstProjectileHit({ owner, actors, from, to, projectileRadius = 0, bodyRadiusScale = 1 }) {
    if (!Array.isArray(actors) || !finite(projectileRadius) || projectileRadius < 0 ||
        !finite(bodyRadiusScale) || bodyRadiusScale < 0) return null;
    let best = null, at = Infinity;
    for (const other of livingEnemies(owner, actors)) {
      const radius = Number(other.radius || 0) * bodyRadiusScale + projectileRadius;
      const hitAt = sweptEntry(from, to, other, radius);
      if (hitAt == null) continue;
      if (hitAt + EPS < at || (Math.abs(hitAt - at) <= EPS && best && stableCompare(other, best) < 0)) {
        best = other; at = hitAt;
      }
    }
    return best ? { actor: best, t: at, x: from.x + (to.x - from.x) * at,
      y: from.y + (to.y - from.y) * at } : null;
  }

  function splashEnemies(owner, actors) {
    return livingEnemies(owner, actors);
  }

  // Real pickup eligibility remains authoritative in Arsenal. The caller
  // supplies a predicate for armed/frozen/reserved/state rules. This chooses
  // only the physical winner of an already eligible pickup transaction.
  function closestEligiblePickup(slot, actors, touchRadius, isEligible) {
    if (!slot || !Array.isArray(actors) || typeof touchRadius !== 'function' ||
        typeof isEligible !== 'function') return null;
    let best = null, at = Infinity;
    for (const a of actors) {
      if (!alive(a) || !isEligible(a, slot)) continue;
      const r = touchRadius(a, slot);
      if (!finite(r) || r < 0) continue;
      const d = distanceSq(a, slot);
      if (d > r * r + EPS) continue;
      if (d + EPS < at || (Math.abs(d - at) <= EPS && best && stableCompare(a, best) < 0)) {
        best = a; at = d;
      }
    }
    return best;
  }

  // Quest-only simple body separation for all independent Fighter anchors.
  // No status/damage callback is invented; the existing Fighter motion and
  // Arsenal weapon transactions remain authoritative.
  function separateBodyOverlaps(actors) {
    if (!Array.isArray(actors)) return 0;
    let resolved = 0;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      if (!alive(a)) continue;
      for (let j = i + 1; j < actors.length; j++) {
        const b = actors[j];
        if (!alive(b)) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = Number(a.radius || 0) + Number(b.radius || 0);
        const dsq = dx * dx + dy * dy;
        if (!(min > 0) || dsq >= min * min) continue;
        const d = Math.sqrt(dsq);
        const nx = d > EPS ? dx / d : 1, ny = d > EPS ? dy / d : 0;
        const excess = (min - d) / 2;
        a.x -= nx * excess; a.y -= ny * excess;
        b.x += nx * excess; b.y += ny * excess;
        resolved++;
      }
    }
    return resolved;
  }

  // OWNER LOCK 2026-10-09: only THREE hostile species throughout Quest.
  // Independent of balancing wave HP and from the Free Battle Hero roster.
  const ENEMY_SPECIES=Object.freeze({
    scout:Object.freeze({level:1,visual:'scout',speedFactor:1.2,contactDamage:0,laser:null}),
    reaver:Object.freeze({level:2,visual:'reaver',speedFactor:1.2,contactDamage:50,laser:null}),
    sentinel:Object.freeze({level:3,visual:'sentinel',speedFactor:1,contactDamage:0,
      laser:Object.freeze({chargeSeconds:1,damage:100,stunSeconds:2,cooldownSeconds:9})})
  });
  function enemySpecies(kind){return ENEMY_SPECIES[String(kind||'')]||null;}

  // Q2 — general actor-contract and immutable *test-only* compositions.
  // No independent combat physics or synthetic HP; actual Fighters are
  // instantiated and advanced by the existing Arsenal battle runtime.
  const FIXTURES = Object.freeze({
    '1v2': Object.freeze([
      { questId:'NEWBOT', questTeam:'ALLY', hp:1000, x:190, y:480, kind:'newbot' },
      { questId:'SCRAP-A', questTeam:'HOSTILE', hp:350, x:775, y:290, kind:'scout' },
      { questId:'SCRAP-B', questTeam:'HOSTILE', hp:350, x:775, y:700, kind:'bulwark' },
    ]),
    '2v2': Object.freeze([
      { questId:'NEWBOT', questTeam:'ALLY', hp:1000, x:220, y:310, kind:'newbot' },
      { questId:'SCRAP-A', questTeam:'HOSTILE', hp:350, x:780, y:310, kind:'scout' },
      { questId:'T.O.T', questTeam:'ALLY', hp:1000, x:220, y:690, kind:'tot' },
      { questId:'SCRAP-B', questTeam:'HOSTILE', hp:350, x:780, y:690, kind:'scout' },
    ]),
    '3v4': Object.freeze([
      { questId:'NEWBOT', questTeam:'ALLY', hp:1000, x:210, y:240, kind:'newbot' },
      { questId:'SCRAP-A', questTeam:'HOSTILE', hp:300, x:790, y:170, kind:'scout' },
      { questId:'T.O.T', questTeam:'ALLY', hp:1000, x:210, y:510, kind:'tot' },
      { questId:'SCRAP-B', questTeam:'HOSTILE', hp:260, x:790, y:390, kind:'bulwark' },
      { questId:'RIVET', questTeam:'ALLY', hp:1000, x:210, y:780, kind:'rivet' },
      { questId:'SCRAP-C', questTeam:'HOSTILE', hp:260, x:790, y:615, kind:'reaver' },
      { questId:'SCRAP-D', questTeam:'HOSTILE', hp:320, x:790, y:850, kind:'sentinel' },
    ])
  });
  function fixtureRoster(name) {
    const spec = FIXTURES[String(name || '')];
    if (!spec) return null;
    // No caller can mutate the shared fixture definition.
    return spec.map((a) => ({ ...a }));
  }
  function validateRoster(actors, options = {}) {
    if (!Array.isArray(actors) || actors.length < 2 || actors.length > 12)
      return { ok:false, reason:'actor-count-out-of-range' };
    const actorIds = new Set(), questIds = new Set();
    let allies = 0, hostiles = 0, players = 0;
    for (const a of actors) {
      const qid = a && a.questId;
      if (!a || a.id == null || !Number.isFinite(+a.id) ||
          typeof qid !== 'string' || !/^[A-Za-z0-9.-]{1,24}$/.test(qid) ||
          !finite(a.hp) || a.hp < 0 || !finite(a.maxHp) || !(a.maxHp > 0) ||
          a.hp > a.maxHp ||
          !finite(a.x) || !finite(a.y) || !finite(a.radius) || !(a.radius > 0))
        return { ok:false, reason:'invalid-actor' };
      if (actorIds.has(identity(a))) return { ok:false, reason:'duplicate-physical-id' };
      if (questIds.has(qid)) return { ok:false, reason:'duplicate-quest-id' };
      actorIds.add(identity(a));questIds.add(qid);
      if (team(a)==='ALLY') allies++;
      else if (team(a)==='HOSTILE') hostiles++;
      else return { ok:false, reason:'invalid-team' };
      if (qid === 'NEWBOT' && team(a) === 'ALLY') players++;
    }
    if (!allies || !hostiles) return { ok:false, reason:'missing-team' };
    if (options.requireNewbot !== false && players !== 1)
      return { ok:false, reason:'missing-newbot' };
    return { ok:true, reason:'valid-roster', count:actors.length, allies, hostiles };
  }
  function teamsOutcome(actors, options = {}) {
    const check = validateRoster(actors, options);
    if (!check.ok) return {status:'INVALID',reason:check.reason};
    const player = actors.find(a => a.questId === 'NEWBOT');
    if (options.retryOnNewbotKO !== false && (!player || !alive(player)))
      return {status:'RETRY',reason:'newbot-ko'};
    if (actors.filter(a=>team(a)==='HOSTILE').every(a=>!alive(a)))
      return {status:'COMPLETE',reason:'hostiles-ko'};
    if (actors.filter(a=>team(a)==='ALLY').every(a=>!alive(a)))
      return {status:'RETRY',reason:'all-allies-ko'};
    return {status:'ACTIVE',reason:'combat-live'};
  }

  // FIRST WAKE: NEWBOT failure is authoritative; T.O.T being KO'd does not
  // make the quest unwinnable. Never grant synthetic HP to allies.
  function firstWakeOutcome(actors, playerId = 'NEWBOT') {
    if (!Array.isArray(actors)) return { status: 'INVALID', reason: 'missing-roster' };
    const player = actors.find((a) => a && a.questId === String(playerId));
    if (!player || team(player) !== 'ALLY') return { status: 'INVALID', reason: 'missing-player' };
    const foes = actors.filter((a) => team(a) === 'HOSTILE');
    if (!foes.length) return { status: 'INVALID', reason: 'no-hostiles' };
    if (!alive(player)) return { status: 'RETRY', reason: 'newbot-ko' };
    if (foes.every((a) => !alive(a))) return { status: 'COMPLETE', reason: 'hostiles-ko' };
    return { status: 'ACTIVE', reason: 'combat-live' };
  }

  // Encounter staging only: hostile speeds/skills MUST come from species,
  // never a per-wave slowdown that secretly changes the enemy's identity.
  const SWARM_TUNING=Object.freeze({
    interludeSeconds:1.8,
    openingGun:'PISTOL',
    openingGunAhead:65
  });

  // Q5 E03 authored two-wave *roster contract*. Only the real Arsenal
  // creates Fighters and inflicts damage. Never use this as a KO setter.
  // Three Gold Scrap chassis may be reused; no invented hero skill kit.
  const SWARM_WAVES=Object.freeze({
    A:Object.freeze([
      Object.freeze({questId:'SWARM-A1',questTeam:'HOSTILE',hp:120,x:760,y:220,kind:'scout'}),
      Object.freeze({questId:'SWARM-A2',questTeam:'HOSTILE',hp:120,x:785,y:500,kind:'scout'}),
      Object.freeze({questId:'SWARM-A3',questTeam:'HOSTILE',hp:120,x:760,y:780,kind:'scout'}),
    ]),
    B:Object.freeze([
      Object.freeze({questId:'SWARM-B1',questTeam:'HOSTILE',hp:90,x:760,y:150,kind:'scout'}),
      Object.freeze({questId:'SWARM-B2',questTeam:'HOSTILE',hp:90,x:810,y:375,kind:'scout'}),
      Object.freeze({questId:'SWARM-B3',questTeam:'HOSTILE',hp:90,x:810,y:625,kind:'reaver'}),
      Object.freeze({questId:'SWARM-B4',questTeam:'HOSTILE',hp:90,x:760,y:850,kind:'scout'}),
    ])
  });
  function scrapSwarmRoster(wave) {
    const hostile=SWARM_WAVES[String(wave||'')];
    if(!hostile)return null;
    return [{questId:'NEWBOT',questTeam:'ALLY',hp:1000,x:205,y:500,kind:'newbot'},
      ...hostile.map(a=>({...a}))];
  }
  function validateScrapSwarmWave(actors,wave) {
    const spec=SWARM_WAVES[String(wave||'')];
    if(!spec||!Array.isArray(actors)||actors.length!==spec.length+1)
      return {ok:false,reason:'wrong-wave-count'};
    const common=validateRoster(actors);
    if(!common.ok)return common;
    const player=actors.find(a=>a.questId==='NEWBOT');
    if(!player||team(player)!=='ALLY'||player.maxHp!==1000)
      return {ok:false,reason:'wrong-protagonist'};
    if(common.allies!==1||common.hostiles!==spec.length)
      return {ok:false,reason:'wrong-wave-team'};
    for(const e of spec){
      const actor=actors.find(a=>a.questId===e.questId);
      if(!actor||team(actor)!=='HOSTILE'||actor.maxHp!==e.hp)
        return {ok:false,reason:'wrong-wave-identity-or-hp'};
    }
    return {ok:true,reason:'real-wave-roster',wave:String(wave),count:actors.length};
  }
  function scrapSwarmOutcome(actors,wave) {
    const valid=validateScrapSwarmWave(actors,wave);
    if(!valid.ok)return {status:'INVALID',reason:valid.reason};
    const player=actors.find(a=>a.questId==='NEWBOT');
    if(!alive(player))return {status:'RETRY',reason:'newbot-ko'};
    const foes=actors.filter(a=>team(a)==='HOSTILE');
    if(!foes.every(a=>!alive(a)))return {status:'ACTIVE',reason:'hostiles-alive'};
    return wave==='A'
      ?{status:'NEXT_WAVE',reason:'wave-a-real-KO'}
      :{status:'COMPLETE',reason:'wave-b-real-KO'};
  }

  // E04 native rain: the spectacle comes from real cap-aware Arsenal slots.
  // All phase timing and loss-safe observation are isolated from combat.
  const RAIN_SPEC=Object.freeze({
    cadenceEarly:3.0,cadenceHeavy:1.6,heavyAt:11,burstAt:22,
    burstOffsets:Object.freeze([0,0.36,0.72]),observeHold:1.3
  });
  function weaponRainRoster(){
    return [
      {questId:'NEWBOT',questTeam:'ALLY',hp:1000,x:195,y:500,kind:'newbot'},
      {questId:'RAIN-A',questTeam:'HOSTILE',hp:180,x:785,y:280,kind:'scout'},
      {questId:'RAIN-B',questTeam:'HOSTILE',hp:160,x:785,y:740,kind:'reaver'}
    ];
  }
  function validateWeaponRain(actors){
    if(!Array.isArray(actors)||actors.length!==3)
      return {ok:false,reason:'requires-1v2'};
    const common=validateRoster(actors);
    if(!common.ok||common.allies!==1||common.hostiles!==2)
      return {ok:false,reason:'invalid-rain-teams'};
    for(const spec of weaponRainRoster()){
      const match=actors.find(a=>a.questId===spec.questId);
      if(!match||team(match)!==spec.questTeam||match.maxHp!==spec.hp)
        return {ok:false,reason:'invalid-rain-actor-or-hp'};
    }
    return {ok:true,reason:'true-rain-roster'};
  }
  function weaponRainOutcome(actors,observed){
    const valid=validateWeaponRain(actors);
    if(!valid.ok)return {status:'INVALID',reason:valid.reason};
    const hero=actors.find(x=>x.questId==='NEWBOT');
    if(!alive(hero))return {status:'RETRY',reason:'newbot-ko'};
    if(actors.some(x=>team(x)==='HOSTILE'&&alive(x)))
      return {status:'ACTIVE',reason:'hostiles-alive'};
    return observed===true
      ?{status:'COMPLETE',reason:'real-hostile-KO-and-rain-observed'}
      :{status:'AWAIT_OBSERVATION',reason:'real-KO-before-final-rain'};
  }
  function createWeaponRainSequence(){
    let phase='DRIZZLE',attempted=0,accepted=0,rejected=0;
    let observed=false,lastBurstAt=null,closed=false;
    const requestTimes=[];
    function tick(time,requestSlot){
      if(closed||!finite(time)||time<0||typeof requestSlot!=='function')
        return {phase,observed};
      if(time>=RAIN_SPEC.burstAt)phase='BURST';
      else if(time>=RAIN_SPEC.heavyAt)phase='DOWNPOUR';
      while(phase==='BURST'&&attempted<RAIN_SPEC.burstOffsets.length
        &&time+EPS>=RAIN_SPEC.burstAt+RAIN_SPEC.burstOffsets[attempted]){
        const slot=requestSlot();
        requestTimes.push(time);attempted++;
        if(slot)accepted++;else rejected++;
        lastBurstAt=time;
      }
      if(phase==='BURST'&&attempted===RAIN_SPEC.burstOffsets.length
         &&lastBurstAt!=null
         &&time-lastBurstAt+EPS>=RAIN_SPEC.observeHold){
        observed=true;phase='OBSERVED';
      }
      return {phase,observed};
    }
    function snapshot(){return Object.freeze({
      phase,attempted,accepted,rejected,observed,
      burstTimes:requestTimes.slice(),lastBurstAt,closed
    });}
    function cadence(){return phase==='DRIZZLE'
      ?RAIN_SPEC.cadenceEarly:RAIN_SPEC.cadenceHeavy;}
    function close(){closed=true;}
    return Object.freeze({tick,cadence,snapshot,close});
  }

  // E05 is an inert world IMPACT ACCUMULATOR, not an opponent Bot.
  // Internally it borrows an Arsenal Fighter collider so actual bullets,
  // crit and weapon collision remain engine-owned. It NEVER gains AI, guns,
  // heroic abilities or hostile-team victory logic.
  const BREAKER_SPEC=Object.freeze({
    goal:6000,earlyCadence:3.0,chargedCadence:2.2,
    fasterAt:0.50,burstAt:0.85,
    burstOffsets:Object.freeze([0,0.35,0.70]),
    observationHold:1.25,
    milestones:Object.freeze([0.25,0.5,0.75,0.9,1])
  });
  function breakerChargeRoster(){
    return [
      {questId:'NEWBOT',questTeam:'ALLY',hp:1000,x:190,y:500,kind:'newbot'},
      {questId:'BREAKER-CORE',questTeam:'TARGET',hp:BREAKER_SPEC.goal,
        x:660,y:500,kind:'accumulator',questWorldObject:true}
    ];
  }
  function validateBreakerCharge(actors){
    if(!Array.isArray(actors)||actors.length!==2)
      return {ok:false,reason:'exact-one-hero-one-prop'};
    const hero=actors.find(x=>x?.questId==='NEWBOT');
    const target=actors.find(x=>x?.questId==='BREAKER-CORE');
    if(!hero||team(hero)!=='ALLY'||hero.maxHp!==1000
       ||!target||team(target)!=='TARGET'
       ||target.questWorldObject!==true||target.maxHp!==BREAKER_SPEC.goal
       ||target.id===hero.id||!finite(target.hp)||target.hp<0
       ||target.hp>target.maxHp||!finite(target.x)||!finite(target.y)
       ||!finite(target.radius)||target.radius<=0)
       return {ok:false,reason:'invalid-real-world-collider'};
    return {ok:true,reason:'inert-real-collider',count:2,allies:1,hostiles:0};
  }
  function breakerAcceptedDamage(actors){
    const valid=validateBreakerCharge(actors);
    if(!valid.ok)return null;
    const target=actors.find(x=>x.questId==='BREAKER-CORE');
    return BREAKER_SPEC.goal-target.hp;
  }
  function breakerChargeProgress(actors){
    const damage=breakerAcceptedDamage(actors);
    return damage==null?null:Math.max(0,Math.min(1,damage/BREAKER_SPEC.goal));
  }
  function breakerChargeOutcome(actors,pulseObserved){
    const progress=breakerChargeProgress(actors);
    if(progress==null)return {status:'INVALID',reason:'missing-real-accumulator'};
    if(progress<1)return {status:'ACTIVE',reason:'accepted-damage-incomplete'};
    if(pulseObserved!==true)return {status:'AWAIT_PULSE',reason:'charging-cinematic-not-settled'};
    return {status:'COMPLETE',reason:'actual-6000-damage-and-infrastructure-pulse'};
  }
  function createBreakerChargeSequence(){
    let phase='CHARGING',firstBurstAt=null,lastBurstAt=null;
    let requested=0,accepted=0,suppressed=0,pulseObserved=false,closed=false;
    const milestones=[];
    function tick(time,progress,request){
      if(closed||!finite(time)||time<0||!finite(progress)
        ||progress<0||progress>1||typeof request!=='function')
        return {phase,pulseObserved};
      for(const m of BREAKER_SPEC.milestones)
        if(progress+EPS>=m&&!milestones.includes(m))milestones.push(m);
      if(progress>=BREAKER_SPEC.burstAt){
        if(firstBurstAt===null)firstBurstAt=time;
        phase='BURST';
        while(requested<BREAKER_SPEC.burstOffsets.length
          &&time+EPS>=firstBurstAt+BREAKER_SPEC.burstOffsets[requested]){
          const drop=request();requested++;lastBurstAt=time;
          if(drop)accepted++;else suppressed++;
        }
      }else{
        phase=progress>=BREAKER_SPEC.fasterAt?'OVERDRIVE':'CHARGING';
      }
      if(progress>=1&&requested===BREAKER_SPEC.burstOffsets.length
         &&lastBurstAt!==null
         &&time-lastBurstAt+EPS>=BREAKER_SPEC.observationHold){
        pulseObserved=true;phase='PULSE';
      }
      return {phase,pulseObserved};
    }
    function cadence(progress){
      return progress>=BREAKER_SPEC.fasterAt
        ?BREAKER_SPEC.chargedCadence:BREAKER_SPEC.earlyCadence;
    }
    function snapshot(){return Object.freeze({
      phase,firstBurstAt,lastBurstAt,requested,accepted,suppressed,
      pulseObserved,milestones:milestones.slice(),closed
    });}
    function close(){closed=true;}
    return Object.freeze({tick,cadence,snapshot,close});
  }

  // Strong preflight: multiple bodies cannot borrow the same fighter identity;
  // two teams and one controllable protagonist are required.
  function validateFirstWake(actors) {
    if (!Array.isArray(actors) || actors.length !== 4) return { ok: false, reason: 'requires-four-actors' };
    const ids = new Set();
    for (const a of actors) {
      if (!a || a.id == null || !finite(a.hp) || !finite(a.x) || !finite(a.y) ||
          !finite(a.radius) || a.radius <= 0) return { ok: false, reason: 'invalid-actor' };
      if (ids.has(identity(a))) return { ok: false, reason: 'duplicate-actor-id' };
      ids.add(identity(a));
      if (!['ALLY', 'HOSTILE'].includes(team(a))) return { ok: false, reason: 'invalid-team' };
    }
    if (actors.filter((a) => team(a) === 'ALLY').length !== 2 ||
        actors.filter((a) => team(a) === 'HOSTILE').length !== 2)
      return { ok: false, reason: 'not-2v2' };
    if (actors.filter((a) => a.questId === 'NEWBOT' && team(a) === 'ALLY').length !== 1 ||
        actors.filter((a) => a.questId === 'T.O.T' && team(a) === 'ALLY').length !== 1)
      return { ok: false, reason: 'missing-story-allies' };
    return { ok: true, reason: 'valid-2v2' };
  }

  root.apexQuestMultiActorCore = 'ready';
  root.APEX_QUEST_MULTI_ACTOR_CORE = Object.freeze({
    alive, hostile, livingEnemies, nearestEnemy, sweptEntry,
    firstProjectileHit, splashEnemies, closestEligiblePickup, separateBodyOverlaps,
    firstWakeOutcome, validateFirstWake, fixtureRoster, validateRoster, teamsOutcome,
    ENEMY_SPECIES,enemySpecies,
    scrapSwarmRoster,validateScrapSwarmWave,scrapSwarmOutcome,SWARM_TUNING,
    RAIN_SPEC,weaponRainRoster,validateWeaponRain,weaponRainOutcome,createWeaponRainSequence,
    BREAKER_SPEC,breakerChargeRoster,validateBreakerCharge,
    breakerAcceptedDamage,breakerChargeProgress,breakerChargeOutcome,createBreakerChargeSequence,
  });
})(typeof window !== 'undefined' ? window : globalThis);
