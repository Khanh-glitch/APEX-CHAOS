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
      { questId:'SCRAP-B', questTeam:'HOSTILE', hp:350, x:780, y:690, kind:'bulwark' },
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

  // Q5 encounter tuning is data, not a second physics implementation.
  // These factors affect only the physical Scrap Fighters' movement speeds:
  // no change to base hit damage, cooldowns, original weapon cadence or HP.
  const SWARM_TUNING=Object.freeze({
    A:Object.freeze({enemySpeedFactor:0.52}),
    B:Object.freeze({enemySpeedFactor:0.61}),
    interludeSeconds:1.8,
    openingGun:'PISTOL',
    openingGunAhead:65
  });

  // Q5 E03 authored two-wave *roster contract*. Only the real Arsenal
  // creates Fighters and inflicts damage. Never use this as a KO setter.
  // Three Gold Scrap chassis may be reused; no invented hero skill kit.
  const SWARM_WAVES=Object.freeze({
    A:Object.freeze([
      Object.freeze({questId:'SWARM-A1',questTeam:'HOSTILE',hp:280,x:760,y:220,kind:'scout'}),
      Object.freeze({questId:'SWARM-A2',questTeam:'HOSTILE',hp:280,x:785,y:500,kind:'bulwark'}),
      Object.freeze({questId:'SWARM-A3',questTeam:'HOSTILE',hp:280,x:760,y:780,kind:'sentinel'}),
    ]),
    B:Object.freeze([
      Object.freeze({questId:'SWARM-B1',questTeam:'HOSTILE',hp:220,x:760,y:150,kind:'scout'}),
      Object.freeze({questId:'SWARM-B2',questTeam:'HOSTILE',hp:220,x:810,y:375,kind:'bulwark'}),
      Object.freeze({questId:'SWARM-B3',questTeam:'HOSTILE',hp:220,x:810,y:625,kind:'sentinel'}),
      Object.freeze({questId:'SWARM-B4',questTeam:'HOSTILE',hp:220,x:760,y:850,kind:'scout'}),
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
    scrapSwarmRoster,validateScrapSwarmWave,scrapSwarmOutcome,SWARM_TUNING,
  });
})(typeof window !== 'undefined' ? window : globalThis);
