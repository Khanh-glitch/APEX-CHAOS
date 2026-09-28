/* =============================================================================
 * APEX CHAOS — Hero Rework Registry (canonical product authority).
 *
 * HeroDefinitions for the canonical playable 12:
 *   ROBOT, CRYSTAL, MAGNET, BLACK_HOLE, MATH_V2, ICE, RUBBER,
 *   HUNTER, TIME, MIRROR, SLIME, SNIPER.
 *
 * Authority: docs/hero-rework/phase1/02_LEVEL1_CANONICAL_BASELINE_V1_2.md
 *            docs/hero-rework/phase1/03_HERO_DEFINITION_CONTRACT_V1_FINAL.md
 *            docs/hero-rework/phase1/04 (progression knob map)
 *            docs/hero-rework/phase1/06 (roster correction: playable roster
 *            only — Quest boss identities stay in their own encounter class)
 *
 * Laws encoded here:
 *   - Lv1 baseConfig is EXACTLY the canonical baseline (hard law).
 *   - One progression knob per skill; knobPath is a FROZEN ARRAY of path
 *     segments (never a dot-split string — keys may contain dots).
 *   - maxLevel 5; minLevel 1.
 *   - No visual/final-art direction is embedded here; presentation is
 *     neutral/temporary and flagged as such.
 * ========================================================================== */

(function (globalScope) {
  'use strict';

  if (globalScope.APEX_HERO_REWORK_REGISTRY) return; // idempotent

  /* ------------------------------------------------------------------ *
   * Progression curves.
   * Lv1 MUST resolve to the exact canonical value. Lv2-5 exact live
   * balance is deferred (doc 04); curves below are bounded provisional
   * tuning slots, monotonic in the "better for the player" direction.
   * Each curve receives the Lv1 base value and the level.
   * ------------------------------------------------------------------ */
  const CURVES = {
    // cooldown -12.5% per level above 1 (provisional)
    cooldown_step: (base, level) => (level <= 1 ? base : base * Math.pow(0.875, level - 1)),
    // magnitude +12% per level above 1 (provisional)
    magnitude_step: (base, level) => (level <= 1 ? base : base * (1 + 0.12 * (level - 1))),
    // fraction percentage points +0.04 (4pp) per level above 1 (provisional)
    pp_step: (base, level) => (level <= 1 ? base : base + 0.04 * (level - 1)),
    // fraction threshold -0.04 (4pp) per level above 1 — triggers sooner (provisional)
    pp_threshold_step: (base, level) => (level <= 1 ? base : base - 0.04 * (level - 1)),
    // capacity +1 per level above 1 (provisional)
    capacity_step: (base, level) => (level <= 1 ? base : base + (level - 1)),
    // seconds step +0.5s per level above 1 (provisional)
    seconds_step: (base, level) => (level <= 1 ? base : base + 0.5 * (level - 1)),
    // multiplicative N (xN / /N) +1 per level above 1 (provisional)
    factor_step: (base, level) => (level <= 1 ? base : base + (level - 1)),
    // spread multiplier toward 0: -15% of remaining per level (provisional)
    spread_step: (base, level) => (level <= 1 ? base : base * Math.pow(0.85, level - 1)),
    // threshold (continuous-chill / split) -0.25s or -2pp per level (provisional)
    threshold_step: (base, level) => (level <= 1 ? base : base - 0.25 * (level - 1)),
  };

  /* ------------------------------------------------------------------ *
   * Helpers — skill definition factory keeps every entry uniform.
   * ------------------------------------------------------------------ */
  function skill(id, slot, mechanicId, baseConfig, knobPath, curveId, extra) {
    return Object.freeze({
      id,
      slot,
      kind: slot === 'PASSIVE' ? 'PASSIVE' : 'ACTIVE',
      mechanicId,
      baseConfig: Object.freeze(baseConfig),
      progressionBinding: Object.freeze({
        minLevel: 1,
        maxLevel: 5,
        knobPath: Object.freeze(knobPath.slice()), // frozen ARRAY (law)
        curveId,
      }),
      activationPolicy: slot === 'PASSIVE' ? 'ALWAYS' : 'MANUAL',
      lifecyclePolicyRef: `${mechanicId}.lifecycle@lv1`,
      presentationEventNamespace: 'hero-rework.presentation',
      telemetrySkillId: id,
      ...(extra || {}),
    });
  }

  /* ------------------------------------------------------------------ *
   * The canonical 12. Every baseConfig number below is copied verbatim
   * from the Level-1 canonical baseline doc — do not "fix" them without
   * a newer design authority.
   * ------------------------------------------------------------------ */

  const HEROES = {
    /* ---------------------------------------------------------------- *
     * 1. ROBOT — product-facing replacement for legacy NEWBIE.
     * ---------------------------------------------------------------- */
    ROBOT: {
      id: 'ROBOT',
      name: 'ROBOT',
      classRef: 'rework.robot',
      skills: {
        A1: skill('robot.weapon_dash', 'A1', 'robot.weapon_dash', {
          cooldown: 10, dashSpeed: 3400, maxDashTime: 0.55, turnRate: 11,
          arriveRadius: 34, targetRevealedPickups: true, t6AutoTarget: false,
        }, ['cooldown'], 'cooldown_step'),
        A2: skill('robot.virtual_armor', 'A2', 'robot.virtual_armor', {
          cooldown: 10, duration: 3.0, incomingMult: 0.45, ccImmunity: false,
        }, ['incomingMult'], 'magnitude_step'),
        PASSIVE: skill('robot.damage_milestones', 'PASSIVE', 'robot.damage_milestones', {
          // Uses the existing visible cumulative damage-dealt milestone ladder.
          milestoneRefundsSec: [0, 0.5, 1.0, 1.5], // index = milestone # - 1; then +0.5s each
          stepAfterLadder: 0.5,
          oneProcPerMilestone: true,
        }, ['stepAfterLadder'], 'seconds_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 2. CRYSTAL
     * ---------------------------------------------------------------- */
    CRYSTAL: {
      id: 'CRYSTAL',
      name: 'CRYSTAL',
      classRef: 'rework.crystal',
      skills: {
        A1: skill('crystal.wall', 'A1', 'crystal.wall', {
          cooldown: 11, wallHp: 120, lifetime: 4, width: 220,
        }, ['wallHp'], 'magnitude_step'),
        A2: skill('crystal.prison', 'A2', 'crystal.prison', {
          cooldown: 20, walls: 6, wallHpPer: 75, cageRadius: 135, maxLifetime: 3,
        }, ['wallHpPer'], 'magnitude_step'),
        PASSIVE: skill('crystal.refraction', 'PASSIVE', 'crystal.refraction', {
          reflectedDamagePct: 0.50, controllerChange: 'CRYSTAL',
          provenanceRetained: true, multiReflection: true,
          loopSuppression: 'same-surface-zero-progress',
          t6Reflect: false,
        }, ['reflectedDamagePct'], 'pp_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 3. MAGNET
     * ---------------------------------------------------------------- */
    MAGNET: {
      id: 'MAGNET',
      name: 'MAGNET',
      classRef: 'rework.magnet',
      skills: {
        A1: skill('magnet.acquisition', 'A1', 'magnet.acquisition', {
          cooldown: 10, pullAcceleration: 1500, maxPulledSpeed: 1000,
          maxActiveTime: 2, t6Immune: true,
        }, ['pullAcceleration'], 'magnitude_step'),
        A2: skill('magnet.repulsion_field', 'A2', 'magnet.repulsion_field', {
          cooldown: 13, duration: 2.2, radius: 210,
          fighterPushAcceleration: 1300, projectileRadialImpulse: 900,
          t6Immune: true,
        }, ['fighterPushAcceleration'], 'magnitude_step'),
        PASSIVE: skill('magnet.acceleration', 'PASSIVE', 'magnet.acceleration', {
          ownedProjectileVelocityBonus: 0.18, t6Immune: true,
        }, ['ownedProjectileVelocityBonus'], 'pp_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 4. BLACK_HOLE
     * ---------------------------------------------------------------- */
    BLACK_HOLE: {
      id: 'BLACK_HOLE',
      name: 'BLACK_HOLE',
      classRef: 'rework.black_hole',
      skills: {
        A1: skill('black_hole.transit', 'A1', 'black_hole.transit', {
          cooldown: 14, activeDuration: 2.7, capacity: 8, transitDelay: 0.35,
          exitTargetDistance: 120, preserveVelocity: true, preserveProvenance: true,
          t6Immune: true,
        }, ['capacity'], 'capacity_step'),
        A2: skill('black_hole.damage_singularity', 'A2', 'black_hole.damage_singularity', {
          cooldown: 18, escrowWindow: 1.0, storedDamageCap: 300,
          returnPct: 0.65, vulnerabilityDuration: 3, vulnerabilityIncomingMult: 2,
          t6DamageCaptured: false,
        }, ['storedDamageCap'], 'magnitude_step'),
        PASSIVE: skill('black_hole.event_horizon', 'PASSIVE', 'black_hole.event_horizon', {
          radiusPerHp: 1 / 10, maxGrowth: 100, healingShrinks: false,
          countsEscrowedDamage: false, biggerIsTargetable: true,
        }, ['radiusPerHp'], 'magnitude_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 5. MATH_V2
     * ---------------------------------------------------------------- */
    MATH_V2: {
      id: 'MATH_V2',
      name: 'MATH_V2',
      classRef: 'rework.math_v2',
      skills: {
        A1: skill('math.parabola_graph', 'A1', 'math.parabola_graph', {
          cooldown: 10, maxLifetime: 10, endsOnOffensiveEquipment: true,
          healPickupDoesNotEnd: false, recastReplaces: true,
          equation: 'tuning-slot', // exact parabola equation/scale/orientation is a tuning slot
        }, ['cooldown'], 'cooldown_step'),
        A2: skill('math.damage_equation', 'A2', 'math.damage_equation', {
          cooldown: 20, armorDuration: 3,
          countersStartAt: 0, cashOnPhysicalBodyCollision: true,
          noLv1Cap: true,
        }, ['cooldown'], 'cooldown_step'),
        PASSIVE: skill('math.multiply_divide', 'PASSIVE', 'math.multiply_divide', {
          gateDuration: 2, xFactor: 2, divFactor: 2,
          duplicateDamagePct: 1.0, halvedDamagePct: 0.5,
          separationAngle: 'tuning-slot',
          loopSuppression: 'same-surface-zero-progress', t6Immune: true,
        }, ['xFactor'], 'factor_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 6. ICE
     * ---------------------------------------------------------------- */
    ICE: {
      id: 'ICE',
      name: 'ICE',
      classRef: 'rework.ice',
      skills: {
        A1: skill('ice.bullets', 'A1', 'ice.bullets', {
          cooldown: 11, duration: 4, appliesChill: true,
        }, ['cooldown'], 'cooldown_step'),
        A2: skill('ice.lane', 'A2', 'ice.lane', {
          cooldown: 10, windup: 0.25, width: 120, speed: 1800,
          traversesArena: true, directDamage: 0, appliesChill: true, homing: false,
        }, ['cooldown'], 'cooldown_step'),
        PASSIVE: skill('ice.deep_freeze', 'PASSIVE', 'ice.deep_freeze', {
          continuousChillThreshold: 3.0, freezeDuration: 1.1,
          resetAfterFreeze: true, isolatedChillCannotFreeze: true,
        }, ['continuousChillThreshold'], 'threshold_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 7. RUBBER
     * ---------------------------------------------------------------- */
    RUBBER: {
      id: 'RUBBER',
      name: 'RUBBER',
      classRef: 'rework.rubber',
      skills: {
        A1: skill('rubber.elastic_state', 'A1', 'rubber.elastic_state', {
          cooldown: 12, activeWindow: 4, energyCap: 100,
          maxSpeedBonusPct: 0.55, postActiveDecay: 25,
          collisionStunThreshold: 60, collisionStun: 0.55,
          impulseCalibration: 'tuning-slot',
        }, ['maxSpeedBonusPct'], 'pp_step'),
        A2: skill('rubber.compression', 'A2', 'rubber.compression', {
          cooldown: 15, duration: 2.5, capacity: 8,
          speedLossPerStored: 0.07, speedFloorPct: 0.45,
          releasedDamagePct: 1.0, debtOnMissPct: 1.0, t6Immune: true,
        }, ['capacity'], 'capacity_step'),
        PASSIVE: skill('rubber.afterbounce', 'PASSIVE', 'rubber.afterbounce', {
          duration: 2.2, pushImpulse: 650, selfSpeedLossPct: 0.15,
          reprocRequiresNewContact: true, stun: false,
        }, ['pushImpulse'], 'magnitude_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 8. HUNTER
     * ---------------------------------------------------------------- */
    HUNTER: {
      id: 'HUNTER',
      name: 'HUNTER',
      classRef: 'rework.hunter',
      skills: {
        A1: skill('hunter.snare', 'A1', 'hunter.snare', {
          cooldown: 11, trapLifetime: 8, maxActiveTraps: 1, rootDuration: 1.6,
          placedAtCaster: true, bulletsPickupsVfxDoNotTrigger: true,
        }, ['cooldown'], 'cooldown_step'),
        A2: skill('hunter.pounce_weak', 'A2', 'hunter.pounce_weak', {
          cooldown: 12, windup: 0.18, moveSpeed: 1500, maxMoveTime: 0.45,
          directDamage: 0, weakDuration: 3, weakIncomingMult: 1.25,
          canMiss: true, weakScope: 'combatant',
        }, ['weakIncomingMult'], 'magnitude_step'),
        PASSIVE: skill('hunter.killer_instinct', 'PASSIVE', 'hunter.killer_instinct', {
          dodgeChance: 0.28, dodgeDistance: 95, antiChainLockout: 0.45,
          requiresTrappedOrWeak: true, invulnerability: false, t6Excluded: true,
        }, ['dodgeChance'], 'pp_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 9. TIME
     * ---------------------------------------------------------------- */
    TIME: {
      id: 'TIME',
      name: 'TIME',
      classRef: 'rework.time',
      skills: {
        A1: skill('time.loop', 'A1', 'time.loop', {
          cooldown: 18, recordWindow: 2, loops: 2, loopDuration: 2,
          ghostBodiesIntangible: true,
          replayWhitelist: ['bullet', 'burst', 'shotgun-fan', 'grenade-throw', 'thrown-melee'],
          replayBlacklist: ['melee-swing', 'shield', 'persistent-field', 'hero-active', 'replay-event', 't6'],
        }, ['cooldown'], 'cooldown_step'),
        A2: skill('time.rewind', 'A2', 'time.rewind', {
          cooldown: 16, snapshotDelay: 3,
          restores: ['hp', 'position', 'velocity'],
          doesNotRewind: ['opponent', 'world', 'projectiles', 'inventory', 'ammo', 'cooldowns'],
          noRevive: true, onlyIfAlive: true,
        }, ['cooldown'], 'cooldown_step'),
        PASSIVE: skill('time.timeline_markers', 'PASSIVE', 'time.timeline_markers', {
          markerHorizons: [1, 2], gameplayMutation: false,
        }, ['markerHorizons', '1'], 'seconds_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 10. MIRROR
     * ---------------------------------------------------------------- */
    MIRROR: {
      id: 'MIRROR',
      name: 'MIRROR',
      classRef: 'rework.mirror',
      skills: {
        A1: skill('mirror.arsenal', 'A1', 'mirror.arsenal', {
          cooldown: 15, copyLifetime: 6,
          copiesOpponentHeldEligible: true, freshInstance: true, freshAmmo: true,
          opponentKeepsOriginal: true, whiffIfIneligible: true,
          t6Copy: false, shieldCopyExcluded: true,
        }, ['cooldown'], 'cooldown_step'),
        A2: skill('mirror.exchange', 'A2', 'mirror.exchange', {
          cooldown: 12, telegraph: 0.25, atomicPositionSwapOnly: true,
          keepsOwn: ['velocity', 'hp', 'weapon', 'status'],
          usesRelocationTransaction: true,
        }, ['cooldown'], 'cooldown_step'),
        PASSIVE: skill('mirror.shattered_mirrors', 'PASSIVE', 'mirror.shattered_mirrors', {
          damagePerShard: 35, minEventDamage: 20, maxShardsPerEvent: 5,
          shardLifetime: 6, shardsToMirror: 5, mirrorFormRadius: 130,
          mirrorLifetime: 10, maxMirrors: 3,
          exitController: 'NEUTRAL', damageUnchanged: true, noHeroCredit: true,
          provenanceRetained: true, t6Immune: true,
          loopSuppression: 'zero-progress-only',
        }, ['shardLifetime'], 'seconds_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 11. SLIME — one Combatant, multiple Bodies (doc 06 correction:
     * child Bodies live in AIL body collections, never in the legacy
     * global fighters[] array).
     * ---------------------------------------------------------------- */
    SLIME: {
      id: 'SLIME',
      name: 'SLIME',
      classRef: 'rework.slime',
      skills: {
        A1: skill('slime.mitosis', 'A1', 'slime.mitosis', {
          cooldown: 14, splitDuration: 6, splitInto: 2,
          hpDividedEvenly: true, areaConserveFormula: true,
          divergenceTarget: 25, equipmentDeterministicMerge: true,
        }, ['cooldown'], 'cooldown_step'),
        A2: skill('slime.damage_shedding', 'A2', 'slime.damage_shedding', {
          cooldown: 16, duration: 5, damagePerChild: 100,
          carryOverProgress: true, maxChildren: 3,
          childHp: 140, childLifetime: 5, childRadius: 45,
          childSpeedPct: 0.9, childValidAutoTarget: true,
          childMayEquip: true, expiryReturnHp: true, killedChildHpLost: true,
        }, ['cooldown'], 'cooldown_step'),
        PASSIVE: skill('slime.emergency_mitosis', 'PASSIVE', 'slime.emergency_mitosis', {
          triggerAtLostPct: 0.80, minSplitShareHp: 100,
          successfulSplitReplacesSource: true,
          combatantDiesWhenNoLivingBody: true,
        }, ['triggerAtLostPct'], 'pp_threshold_step'),
      },
    },

    /* ---------------------------------------------------------------- *
     * 12. SNIPER
     * ---------------------------------------------------------------- */
    SNIPER: {
      id: 'SNIPER',
      name: 'SNIPER',
      classRef: 'rework.sniper',
      skills: {
        A1: skill('sniper.farthest_corner', 'A1', 'sniper.farthest_corner', {
          cooldown: 14, cornerInset: 110, aimLostDuration: 2.2,
          opponentMayStillFireLastAim: true, t6HomingUnaffected: true,
        }, ['aimLostDuration'], 'seconds_step'),
        A2: skill('sniper.nest', 'A2', 'sniper.nest', {
          cooldown: 12, maxDuration: 4, movementSpeed: 0,
          predictiveIntercept: true, postMuzzleNormal: true,
          spreadMultiplier: 0.25,
        }, ['spreadMultiplier'], 'spread_step'),
        PASSIVE: skill('sniper.distance_crit', 'PASSIVE', 'sniper.distance_crit', {
          breakpoints: [
            { dist: 250, crit: 0.00 },
            { dist: 500, crit: 0.08 },
            { dist: 750, crit: 0.16 },
            { dist: 1000, crit: 0.24 },
          ],
          additive: true, critChanceCap: 0.55, critDamageUnchanged: true,
        }, ['breakpoints'], 'pp_step'),
      },
    },
  };

  const CANONICAL_IDS = Object.freeze(Object.keys(HEROES)); // insertion order = doc order

  /* ------------------------------------------------------------------ *
   * Level resolution. Returns a DEEP COPY of baseConfig with only the
   * knob field replaced by the curve value for `level` (2..5). Lv1
   * returns an exact deep copy of baseConfig (no mutation of the static
   * definition — hard law).
   * ------------------------------------------------------------------ */
  function deepCopy(v) {
    if (Array.isArray(v)) return v.map(deepCopy);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v)) out[k] = deepCopy(v[k]);
      return out;
    }
    return v;
  }

  function resolveSkillLevel(heroId, slot, level) {
    const hero = HEROES[heroId];
    if (!hero) throw new Error(`resolveSkillLevel: unknown hero ${heroId}`);
    const def = hero.skills[slot];
    if (!def) throw new Error(`resolveSkillLevel: unknown slot ${slot} for ${heroId}`);
    const lvl = Math.max(1, Math.min(5, level | 0));
    const cfg = deepCopy(def.baseConfig);
    if (lvl === 1) return cfg; // Lv1 exact canonical baseline
    const knobPath = def.progressionBinding.knobPath; // frozen array
    const curve = CURVES[def.progressionBinding.curveId];
    if (!curve) throw new Error(`resolveSkillLevel: unknown curve ${def.progressionBinding.curveId}`);
    // Read current knob value from the deep copy.
    let holder = cfg;
    for (let i = 0; i < knobPath.length - 1; i++) {
      const seg = knobPath[i];
      if (holder[seg] === undefined) holder[seg] = {};
      holder = holder[seg];
    }
    const last = knobPath[knobPath.length - 1];
    const baseVal = holder[last];
    if (typeof baseVal === 'number') {
      holder[last] = curve(baseVal, lvl);
    } else if (Array.isArray(baseVal)) {
      // SNIPER breakpoints: scale every step's crit bonus by the curve ratio
      // using the Lv1 total step as base.
      const totalStep = baseVal.reduce((s, b) => s + (b.crit || 0), 0);
      const scaled = curve(totalStep, lvl);
      const ratio = totalStep > 0 ? scaled / totalStep : 1;
      holder[last] = baseVal.map((b) => ({ dist: b.dist, crit: (b.crit || 0) * ratio }));
    } else {
      throw new Error(`resolveSkillLevel: knob ${knobPath.join('.')} of ${heroId}.${slot} is not numeric`);
    }
    return cfg;
  }

  /* ------------------------------------------------------------------ *
   * Registry validation — used by gates and smoke tests.
   * Invariants: 12 heroes, 36 skills, every skill exactly one knob,
   * knobPath is a non-empty frozen array, Lv1 resolves to canonical.
   * ------------------------------------------------------------------ */
  function validateRegistry() {
    const errors = [];
    const heroes = Object.keys(HEROES);
    if (heroes.length !== 12) errors.push(`expected 12 heroes, got ${heroes.length}`);
    const expected = ['ROBOT', 'CRYSTAL', 'MAGNET', 'BLACK_HOLE', 'MATH_V2', 'ICE', 'RUBBER', 'HUNTER', 'TIME', 'MIRROR', 'SLIME', 'SNIPER'];
    for (let i = 0; i < expected.length; i++) {
      if (heroes[i] !== expected[i]) errors.push(`hero order: position ${i} is ${heroes[i]}, expected ${expected[i]}`);
    }
    let skillCount = 0;
    for (const heroId of heroes) {
      const hero = HEROES[heroId];
      for (const slot of ['A1', 'A2', 'PASSIVE']) {
        const s = hero.skills[slot];
        if (!s) { errors.push(`${heroId}.${slot} missing`); continue; }
        skillCount++;
        const kp = s.progressionBinding && s.progressionBinding.knobPath;
        if (!Array.isArray(kp) || kp.length === 0) errors.push(`${heroId}.${slot} knobPath must be a non-empty array`);
        else {
          if (!Object.isFrozen(kp)) errors.push(`${heroId}.${slot} knobPath not frozen`);
          // exactly one knob = one terminal field; path segments must exist in baseConfig
          let holder = s.baseConfig;
          for (let i = 0; i < kp.length - 1; i++) {
            if (!holder || typeof holder !== 'object' || !(kp[i] in holder)) { errors.push(`${heroId}.${slot} knobPath segment '${kp[i]}' missing in baseConfig`); holder = null; break; }
            holder = holder[kp[i]];
          }
          if (holder && !(kp[kp.length - 1] in holder)) errors.push(`${heroId}.${slot} knob '${kp[kp.length - 1]}' missing in baseConfig`);
        }
        if (s.progressionBinding.maxLevel !== 5) errors.push(`${heroId}.${slot} maxLevel must be 5`);
        if (s.progressionBinding.minLevel !== 1) errors.push(`${heroId}.${slot} minLevel must be 1`);
        // Lv1 exactness is structural here (returns deep copy of baseConfig).
        try { resolveSkillLevel(heroId, slot, 1); } catch (e) { errors.push(`${heroId}.${slot} Lv1 resolve failed: ${e.message}`); }
        try { resolveSkillLevel(heroId, slot, 5); } catch (e) { errors.push(`${heroId}.${slot} Lv5 resolve failed: ${e.message}`); }
      }
    }
    if (skillCount !== 36) errors.push(`expected 36 skills, got ${skillCount}`);
    return { ok: errors.length === 0, errors, heroCount: heroes.length, skillCount };
  }

  globalScope.apexHeroReworkRegistry = 'ready';
  globalScope.APEX_HERO_REWORK_REGISTRY = {
    version: '1.0.0-rebuild1',
    HEROES,
    CANONICAL_IDS,
    CURVES,
    resolveSkillLevel,
    deepCopy,
    validateRegistry,
    isCanonicalHero(id) { return Object.prototype.hasOwnProperty.call(HEROES, id); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
