/* =============================================================================
 * APEX CHAOS — Hero Rework integration runtime.
 *
 * Owns: match installation, combatant graph, AbilityController, the shared
 * locomotion law latch (heading/bounce = original APEX physics; no pickup
 * seek, no chase/kite, no ideal-distance steering — explicit mechanics only),
 * damage adapter, projectile pass (parity-preserving), world entities, SLIME
 * body collections, P2 cast AI, telemetry, public API.
 *
 * Authority: docs/hero-rework/phase1/00..05 + 06_POSTFREEZE_ROSTER_CORRECTION.
 *
 * Roster law (doc 06): the canonical 12 are the PLAYABLE roster. Quest boss
 * identities outside the 12 keep their audited legacy encounter behavior via
 * a facade combatant; bosses that ARE canonical-12 run rework mechanics
 * underneath the encounter layer.
 *
 * SLIME law (doc 06): one logical Combatant per side; child Bodies live in
 * per-combatant AIL collections and are NEVER pushed into the global
 * fighters[] array. Exactly one anchor body per side occupies fighters[].
 *
 * Parity law (doc 06): with no hero transform active, this runtime's
 * projectile pass must reproduce base Arsenal projectile behavior exactly
 * (trajectory, hit time, hit target, realized damage, ricochet, grenade and
 * thrown semantics). `APEX_HERO_REWORK._forceBasePass` delegates to the
 * saved base pass for deterministic no-transform parity tests.
 * ========================================================================== */

(function (globalScope) {
  'use strict';

  if (globalScope.APEX_HERO_REWORK) return; // idempotent

  const AIL = globalScope.APEX_HERO_REWORK_AIL;
  const REG = globalScope.APEX_HERO_REWORK_REGISTRY;
  const MECH = globalScope.APEX_HERO_REWORK_MECHANICS;
  if (!AIL || !REG || !MECH) throw new Error('heroReworkRuntime requires ail+registry+mechanics');

  const HR = {
    version: '1.0.0-rebuild1',
    productCutover: true, // playable roster = canonical 12 (doc 06)
    aiEnabled: true,      // P2 rework cast AI master switch
    _forceBasePass: false, // parity test hook: delegate to base pass
  };
  globalScope.APEX_HERO_REWORK = HR;
  globalScope.apexHeroReworkRuntime = 'ready';

  /* ------------------------------------------------------------------ *
   * Match state
   * ------------------------------------------------------------------ */
  let M = null; // active rework match

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

  let seed = 20260928;
  let rng = AIL.makeSeededRng(seed);
  HR.setSeed = function (s) { seed = (s >>> 0) || 1; rng = AIL.makeSeededRng(seed); };

  let childIdSeq = 100;

  /* ------------------------------------------------------------------ *
   * Combatant graph
   * ------------------------------------------------------------------ */
  function makeCombatant(idx, anchor, heroId) {
    const def = heroId ? REG.HEROES[heroId] : null;
    const ct = {
      idx,
      heroId: heroId || `LEGACY_${anchor.name}`,
      def,
      facade: !heroId,
      anchor,
      bodies: [anchor],
      skills: {},
      store: {},
      telemetry: {
        casts: 0, castFails: 0, damageDealt: 0, damageTaken: 0,
        bySkill: {}, firstSkillCastAt: null,
      },
    };
    if (def) {
      for (const slot of ['A1', 'A2', 'PASSIVE']) {
        const skillDef = def.skills[slot];
        ct.skills[slot] = {
          def: skillDef,
          level: 1,
          cfg: REG.resolveSkillLevel(heroId, slot, 1),
          cdLeft: 0,
          charges: REG.resolveSkillLevel(heroId, slot, 1).maxCharges, rechargeLeft: 0,
        };
      }
    }
    ct.weakUntil = 0; // combatant-owned WEAK debuff (owner law 2026-09-29)
    anchor.__hrCombatant = ct;
    anchor.__hrRefHp = anchor.maxHp;
    return ct;
  }

  function combatantOfBody(body) {
    if (!body) return null;
    if (body.__hrCombatant) return body.__hrCombatant;
    if (M) {
      for (const ct of M.combatants) {
        if (ct.anchor === body) return ct;
      }
    }
    return null;
  }
  HR.byCombatant = combatantOfBody;
  HR.isReworkFighter = function (f) {
    const ct = combatantOfBody(f);
    return !!(ct && !ct.facade);
  };

  function livingBodies(ct) {
    return (ct.bodies || []).filter((b) => b && b.hp > 0);
  }
  HR.getTargetableBodies = function (ct) { return livingBodies(ct || { bodies: [] }); };
  HR.getPickupActors = function (ct) { return livingBodies(ct || { bodies: [] }); };

  /* Generic body enumeration (doc 14 R1/R2). Every living physical body
   * that is NOT already represented in the global fighters[] array — extra
   * SLIME Bodies (never enter fighters[], doc 06) and any promoted anchor
   * (the retired husk stays in the slot). Non-rework matches return [].
   * Consumers merge this with fighters[] to cover the whole eligible set
   * exactly once. Retired/dead/invisible anchors are never returned. */
  function extraLivingBodies() {
    if (!M) return [];
    const arr = globalScope.fighters;
    const inList = new Set();
    if (arr) for (const f of arr) if (f) inList.add(f);
    const out = [];
    for (const ct of M.combatants) {
      for (const b of livingBodies(ct)) {
        if (!b || (b.data && b.data.__hrRetiredAnchor)) continue;
        if (inList.has(b)) continue; // anchor already covered via fighters[]
        out.push(b);
      }
    }
    return out;
  }
  HR.extraLivingBodies = extraLivingBodies;
  // R2: generic environment-target query — normal fighters plus every
  // eligible living rework body. No SLIME-name conditional anywhere.
  HR.environmentTargets = function () {
    const arr = globalScope.fighters || [];
    const normal = [];
    for (const f of arr) if (f && f.hp > 0 && !(f.data && f.data.__hrRetiredAnchor)) normal.push(f);
    return normal.concat(extraLivingBodies());
  };
  // R3 read-model for the temporary body-local HP indicators (drives the
  // in-canvas bars and lets gates/probes observe the same truth).
  HR.bodyLocalHpIndicators = function () {
    if (!M) return [];
    const out = [];
    for (const ct of M.combatants) {
      const living = livingBodies(ct);
      if (living.length <= 1) continue;
      for (const b of living) {
        const pool = b.__hrRefHp || b.maxHp || 1;
        out.push({
          id: b.id,
          kind: b.__hrChild ? b.__hrChild.kind : 'anchor',
          x: +b.x.toFixed(1), y: +b.y.toFixed(1),
          hp: +b.hp.toFixed(2), pool: +pool.toFixed(2),
          frac: +Math.max(0, Math.min(1, b.hp / pool)).toFixed(3),
        });
      }
    }
    return out;
  };

  function enemyOf(ct) {
    if (!M || !ct) return null;
    return M.combatants[0] === ct ? M.combatants[1] : M.combatants[0];
  }

  /* ------------------------------------------------------------------ *
   * AbilityController
   * ------------------------------------------------------------------ */
  function abilityController(ct) {
    if (!ct.__ctl) ct.__ctl = makeAbilityController(ct);
    return ct.__ctl;
  }
  function makeAbilityController(ct) {
    return {
      cooldownLeft(slot) { const s = ct.skills[slot]; return s ? (s.cfg.maxCharges ? (s.charges > 0 ? 0 : s.rechargeLeft) : Math.max(0, s.cdLeft)) : 0; },
      refundCooldown(slot, sec) {
        const s = ct.skills[slot];
        if (s && sec > 0) { s.cdLeft = Math.max(0, s.cdLeft - sec); }
      },
      setCooldown(slot, sec) { const s = ct.skills[slot]; if (s) s.cdLeft = sec; },
      tick(dt) {
        const a = ct.anchor;
        const paused = typeof a.cooldownPaused === 'function' ? a.cooldownPaused() : false;
        if (paused) return;
        for (const slot of ['A1', 'A2']) {
          const s = ct.skills[slot];
          if (s && s.cfg.maxCharges && s.charges < s.cfg.maxCharges) {
            s.rechargeLeft -= dt;
            while(s.rechargeLeft <= 1e-9 && s.charges < s.cfg.maxCharges) { s.charges++; s.rechargeLeft += s.cfg.cooldown; }
            if(s.charges === s.cfg.maxCharges) s.rechargeLeft = 0;
          }
          if (s && s.cdLeft > 0) s.cdLeft = Math.max(0, s.cdLeft - dt);
        }
      },
      tryCast(slot, source) {
        const s = ct.skills[slot];
        if (!s) return { ok: false, reason: 'no-skill' };
        const a = ct.anchor;
        if (!a || a.hp <= 0) return { ok: false, reason: 'dead' };
        if (typeof a.hardCC === 'function' && a.hardCC()) return { ok: false, reason: 'cc' };
        if (s.cfg.maxCharges ? s.charges <= 0 : s.cdLeft > 0) return { ok: false, reason: 'cooldown' };
        const exec = MECH.EXECUTORS[s.def.mechanicId];
        const ctx = mechCtx(ct, slot);
        if (exec && exec.canCast && !exec.canCast(ctx)) {
          ct.telemetry.castFails += 1;
          AIL.bus.emit('CastFailCue', { hero: ct.heroId, slot, reason: 'condition', source });
          return { ok: false, reason: 'condition', failCue: true };
        }
        const ok = exec && exec.cast ? exec.cast(ctx) : false;
        if (!ok) {
          ct.telemetry.castFails += 1;
          AIL.bus.emit('CastFailCue', { hero: ct.heroId, slot, reason: 'whiff', source });
          return { ok: false, reason: 'whiff', failCue: true };
        }
        if(s.cfg.maxCharges) { if(s.charges === s.cfg.maxCharges) s.rechargeLeft = s.cfg.cooldown; s.charges--; }
        else s.cdLeft = s.cfg.cooldown;
        ct.telemetry.casts += 1;
        ct.telemetry.bySkill[slot] = (ct.telemetry.bySkill[slot] || 0) + 1;
        if (ct.telemetry.firstSkillCastAt == null) ct.telemetry.firstSkillCastAt = AIL.clock();
        AIL.bus.emit('Cast', { hero: ct.heroId, slot, mechanic: s.def.mechanicId, source });
        return { ok: true };
      },
    };
  }
  HR.abilityController = abilityController;

  function mechCtx(ct, slot) {
    const s = ct.skills[slot];
    return {
      slot,
      id: s.def.id,
      mechanicId: s.def.mechanicId,
      cfg: s.cfg,
      hero: ct.def,
      combatant: ct,
      store: (ct.store[s.def.mechanicId] = ct.store[s.def.mechanicId] || {}),
      api: M ? M.api : null,
      AIL,
      bus: AIL.bus,
      rng,
      clock: AIL.clock,
      gameSize: globalScope.GAME_SIZE || 1000,
    };
  }

  function eachExecutor(ct, fn) {
    if (!ct || ct.facade) return;
    for (const slot of ['A1', 'A2', 'PASSIVE']) {
      const s = ct.skills[slot];
      if (!s) continue;
      const exec = MECH.EXECUTORS[s.def.mechanicId];
      if (exec) fn(exec, mechCtx(ct, slot), slot);
    }
  }

  /* ------------------------------------------------------------------ *
   * Install / teardown
   * ------------------------------------------------------------------ */
  function installMatch() {
    // Rematch/direct re-entry (end-screen REMATCH calls startArsenalQuestMode
    // again): tear down any live match first so its delayed jobs, executor
    // teardown hooks and body bookkeeping never leak into the new match.
    if (M) teardownMatch();
    const fighters = globalScope.fighters;
    if (!fighters || !fighters[0] || !fighters[1]) return;
    const isRework = (f) => !!(f.type && f.type.__hrHero && REG.isCanonicalHero(f.type.__hrHero));
    const r1 = isRework(fighters[0]);
    const r2 = isRework(fighters[1]);
    if (!r1 && !r2) { M = null; return; } // pure legacy match: no rework layer

    const world = {
      walls: [], gates: [], singularities: [], lanes: [], snares: [], snareSeq: 0,
      graphs: [], mirrors: [], shards: [],
      wallSeq: 0, gateSeq: 0, mirrorSeq: 0,
    };
    M = {
      combatants: [
        makeCombatant(0, fighters[0], r1 ? fighters[0].type.__hrHero : null),
        makeCombatant(1, fighters[1], r2 ? fighters[1].type.__hrHero : null),
      ],
      world,
      startedAt: AIL.clock(),
      // P2 rework cast AI is ON by default; HR.setAiEnabled() syncs both
      // switches AND PERSISTS across installs (an operator-set switch must
      // not be silently reset by the next match). (Deterministic scheduling
      // time = global matchClock, which updateArsenalQuest — the single
      // shared sim step for rAF AND headless AQ.step — advances exactly
      // once per step.)
      aiEnabled: HR.aiEnabled,
      aiCastPlan: {},
      p1Queue: [],
    };
    M.api = makeApi();
    AIL.bus.emit('ReworkMatchInstall', {
      p1: M.combatants[0].heroId, p2: M.combatants[1].heroId,
    });
    syncFrostBattleHud();
  }

  // FROST V1 (authority §1): battle HUD shows the product display identity
  // for rework combatants. installMatch runs after base quest start wrote
  // storage names, so this overwrite is correctly ordered; the G07-pinned
  // quest/engine files are untouched. Legacy (facade) sides keep classic copy.
  function syncFrostBattleHud() {
    try {
      if (typeof document === 'undefined' || !M) return;
      if (!REG || !REG.displayNameFor) return;
      for (let i = 0; i < 2; i++) {
        const ct = M.combatants && M.combatants[i];
        if (!ct || ct.facade || !ct.heroId) continue;
        const el = document.getElementById(i === 0 ? 'p1-name' : 'p2-name');
        if (el) el.innerText = REG.displayNameFor(ct.heroId);
      }
    } catch (e) { /* HUD copy never breaks match install */ }
  }

  function teardownMatch() {
    if (!M) return;
    // Delayed gameplay callbacks (singularity release, TIME loop replays…)
    // belong to THIS match — cancel them so they cannot fire into the next
    // match after a rematch or mode switch.
    AIL.hrScheduler.clear();
    for (const ct of M.combatants) {
      eachExecutor(ct, (exec, ctx) => { if (exec.onTeardown) exec.onTeardown(ctx); });
      // Restore anchor bookkeeping.
      for (const b of ct.bodies) { if (b) { b.__hrCombatant = null; } }
      ct.bodies = [];
    }
    M = null;
    AIL.bus.emit('ReworkMatchTeardown', {});
  }
  HR.installMatch = installMatch;
  Object.defineProperty(HR, 'match', { get: () => M });

  /* ------------------------------------------------------------------ *
   * Executor-facing api (built per match).
   * ------------------------------------------------------------------ */
  function makeApi() {
    const api = {
      AIL,
      bus: AIL.bus,
      clock: AIL.clock,
      rng,
      get gameSize() { return globalScope.GAME_SIZE || 1000; },

      enemyOf,
      ownBodies: (ct) => livingBodies(ct),
      enemyBodies: (ct) => livingBodies(enemyOf(ct)),
      allBodies: () => (M ? M.combatants.flatMap((ct) => livingBodies(ct)) : []),
      ownsBody: (ct, body) => !!body && !!ct && ct.bodies.includes(body),
      combatantOfBody,

      aqDamageBody(body, amount, sourceCombatant, weaponId, opts) {
        const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
        if (!W || !W.aqDamage) return 0;
        return W.aqDamage(body, amount, sourceCombatant ? sourceCombatant.anchor : null, weaponId, opts || {});
      },

      applyChillTo(body, duration) {
        if (!body || body.hp <= 0) return;
        const dur = duration == null ? AIL.STATUS_LAWS.CHILL.duration : duration;
        AIL.StatusResolver.apply(body, 'CHILL', dur);
        body.applyStatus('slow', dur, { mult: 1 - AIL.STATUS_LAWS.CHILL.slowPct });
        AIL.bus.emit('ChillApplied', { target: body.id, duration: dur });
      },
      chillRemaining: (body) => AIL.StatusResolver.remaining(body, 'CHILL'),
      applyWeakTo(ct, duration) { return M.api.applyWeakCombatant(ct, duration); },
      applyWeakCombatant(ct, duration) {
        if (!ct) return;
        const now = AIL.clock();
        const dur = duration == null ? 1.0 : duration;
        // Refresh, never stack: the multipliers are constants of the law.
        ct.weakUntil = Math.max(ct.weakUntil || 0, now + dur);
        const remaining = ct.weakUntil - now;
        for (const b of livingBodies(ct)) {
          AIL.StatusResolver.apply(b, 'WEAK', remaining); // presentation/query mirror only
        }
        AIL.bus.emit('WeakApplied', { combatant: ct.heroId, duration: dur, remaining });
      },
      weakRemaining: (ct) => ct && ct.weakUntil ? Math.max(0, ct.weakUntil - AIL.clock()) : 0,
      isWeak: (ct) => !!ct && (ct.weakUntil || 0) > AIL.clock(),
      isWeakBody: (body) => AIL.StatusResolver.has(body, 'WEAK'),
      isTrapped: (body) => AIL.StatusResolver.has(body, 'ROOT') || AIL.StatusResolver.has(body, 'STUN'),
      applyRootTo(body, duration) {
        if (!body || body.hp <= 0) return;
        AIL.StatusResolver.apply(body, 'ROOT', duration);
        body.data.positionLocked = true;
        AIL.bus.emit('RootApplied', { target: body.id, duration });
      },
      applyFreezeTo(body, duration) {
        if (!body || body.hp <= 0) return;
        AIL.StatusResolver.apply(body, 'STUN', duration);
        body.applyStatus('freeze', duration, {});
        AIL.bus.emit('FreezeApplied', { target: body.id, duration });
      },
      applyStunTo(body, duration) {
        if (!body || body.hp <= 0) return;
        AIL.StatusResolver.apply(body, 'STUN', duration);
        body.applyStatus('stun', duration, {});
      },

      /* world entities ------------------------------------------------ */
      spawnWall(o) {
        const w = {
          id: ++M.world.wallSeq, owner: o.owner, x: o.x, y: o.y,
          angle: o.angle || 0, len: o.len || 220, thickness: 26,
          hp: o.hp, maxHp: o.hp, bornAt: AIL.clock(), lifetime: o.lifetime || 4,
        };
        M.world.walls.push(w);
        AIL.bus.emit('WallSpawned', { id: w.id, hp: w.hp });
        return w;
      },
      spawnGate(o) {
        const g = {
          id: ++M.world.gateSeq, kind: o.kind, owner: o.owner,
          x: (globalScope.GAME_SIZE || 1000) / 2, y: (globalScope.GAME_SIZE || 1000) / 2,
          radius: 46, bornAt: AIL.clock(), lifetime: o.duration || 2,
        };
        M.world.gates.push(g);
        AIL.bus.emit('GateSpawned', { kind: g.kind });
        return g;
      },
      spawnSingularity(o) {
        const s = {
          id: M.world.singularities.length + 1, owner: o.owner, x: o.x, y: o.y,
          radius: o.radius || 120, bornAt: AIL.clock(), lifetime: o.duration || 2.7,
          capacity: o.capacity || 8, transitDelay: o.transitDelay || 0.35,
          exitDistance: o.exitDistance || 120, stored: [],
        };
        M.world.singularities.push(s);
        AIL.bus.emit('SingularitySpawned', { radius: s.radius });
        return s;
      },
      spawnLane(o) {
        const l = {
          id: M.world.lanes.length + 1, owner: o.owner, x: o.x, y: o.y,
          angle: o.angle || 0, width: o.width || 120, speed: o.speed || 1800,
          windupLeft: o.windup || 0.25, bornAt: AIL.clock(), traveled: 0,
        };
        M.world.lanes.push(l);
        return l;
      },
      moveHunterBody(body, x, y) {
        const from={x:body.x,y:body.y},r=body.radius||40,size=globalScope.GAME_SIZE||1000;
        x=clamp(x,r,size-r);y=clamp(y,r,size-r);
        const steps=Math.max(1,Math.ceil(Math.hypot(x-from.x,y-from.y)/4));
        for(let k=1;k<=steps;k++) { const nx=from.x+(x-from.x)*k/steps,ny=from.y+(y-from.y)*k/steps;
          if(wallsBlockPoint(nx,ny,r)) break;
          body.x=nx;body.y=ny;
        }
        return from;
      },
      sweptHunterContact: segmentToPointToi,
      spawnSnare(o) {
        const s = {
          id: ++M.world.snareSeq, owner: o.owner, x: o.x, y: o.y,
          radius: o.radius || 46, bornAt: AIL.clock(), lifetime: o.lifetime || 8,
          rootDuration: o.rootDuration || 1.25, consumed: false, phase: 'unfold', phaseTime: 0,
        };
        M.world.snares.push(s);
        globalScope.APEX_HUNTER_PRESENTATION?.trapCreated(s);
        AIL.bus.emit('SnarePlaced', { id:s.id, x: s.x, y: s.y });
        return s;
      },
      canPlaceSnare(ct, maxActive) {
        return M.world.snares.filter((s) => s.owner === ct && !s.consumed).length < (maxActive || 1);
      },
      spawnGraph(o) {
        if (o.recastReplaces) {
          M.world.graphs = M.world.graphs.filter((g) => g.owner !== o.owner);
        }
        const g = {
          id: M.world.graphs.length + 1, owner: o.owner, x: o.x, y: o.y,
          angle: o.angle || 0, span: o.span || 520, height: o.height || 200,
          bornAt: AIL.clock(), lifetime: o.lifetime || 10, endedBy: null,
        };
        M.world.graphs.push(g);
        return g;
      },
      endGraphsOf(ct) {
        for (const g of M.world.graphs) {
          if (g.owner === ct && !g.endedBy) g.endedBy = 'equipment';
        }
      },
      // Virtual Armor lifecycle end -> route to the owning hero's PASSIVE
      // executor hooks (single authority for the /2 gate law).
      armorEnded(ct) {
        eachExecutor(ct, (exec, ctx) => { if (exec.onArmorEnded) exec.onArmorEnded(ctx); });
      },
      spawnShards(ct, x, y, n) {
        for (let i = 0; i < n; i++) {
          const a = rng() * Math.PI * 2;
          const r = 18 + rng() * 40;
          M.world.shards.push({
            owner: ct, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
            bornAt: AIL.clock(), lifetime: 6,
          });
        }
        tryFormMirrors();
      },
      spawnMirrorPortal(o) {
        if (M.world.mirrors.length >= 3) return null;
        const m = {
          id: ++M.world.mirrorSeq, owner: o.owner, x: o.x, y: o.y,
          radius: 44, bornAt: AIL.clock(), lifetime: o.lifetime || 10,
        };
        M.world.mirrors.push(m);
        AIL.bus.emit('MirrorFormed', { x: m.x, y: m.y });
        return m;
      },

      /* SLIME bodies (doc 06: never in global fighters[]) ------------- */
      // Physical split/spawn pose (doc 10): children NEVER spawn overlapping
      // the source body — placement sits at sourceRadius+childRadius+gap
      // along the caller's seeded axis and is clamped into the arena
      // interior (flipping to the opposite axis / arena center if the raw
      // position would escape the wall).
      slimeSplitPose(source, radius, axisX, axisY, gap) {
        const S = globalScope.GAME_SIZE || 1000;
        const need = (source.radius || 75) + radius + (gap != null ? gap : 8);
        const place = (sx, sy) => ({
          x: clamp(source.x + sx * need, radius + 2, S - radius - 2),
          y: clamp(source.y + sy * need, radius + 2, S - radius - 2),
        });
        let pos = place(axisX, axisY);
        if (dist(pos.x, pos.y, source.x, source.y) < need * 0.7) pos = place(-axisX, -axisY);
        if (dist(pos.x, pos.y, source.x, source.y) < need * 0.7) {
          const cx = S / 2 - source.x, cy = S / 2 - source.y;
          const n = Math.hypot(cx, cy) || 1;
          pos = place(cx / n, cy / n);
        }
        return pos;
      },
      spawnSlimeChild(ct, o) {
        const anchor = ct.anchor;
        const type = SLIME_CHILD_TYPE;
        const child = new globalScope.Fighter(++childIdSeq, o.x, o.y, type);
        child.maxHp = o.maxHp != null ? o.maxHp : o.hp;
        child.hp = o.hp;
        child.radius = o.radius || 45;
        child.baseRadius = o.radius || 45;
        // Speed law (doc 10): split halves / emergency halves are ordinary
        // hero Bodies at PARENT speed; only A2 shed children move at 90% of
        // parent speed (speedPct supplied by that executor's config).
        child.baseSpeed = (anchor.baseSpeed || 450) * (o.speedPct != null ? o.speedPct : 1);
        child.__hrCombatant = ct;
        child.__hrRefHp = o.hp; // reference HP = creation state (doc 10 passive)
        child.__hrChild = { kind: o.kind || 'shed', lifetime: o.lifetime || 0, bornAt: AIL.clock() };
        // R4 heading law (doc 14): an authored heading (A1 divergence) wins.
        // Otherwise the new child inherits the SPAWNING SOURCE BODY's current
        // normalized heading. Never the SLIME_CHILD_TYPE constructor fallback
        // (unrelated default-left), never random steering; normal APEX
        // movement + wall bounce own the trajectory from the next frame.
        if (o.dirX != null && o.dirY != null) {
          child.setDir(o.dirX, o.dirY);
        } else if (o.sourceBody && o.sourceBody.dir) {
          const d = o.sourceBody.dir;
          const n = Math.hypot(d.x, d.y) || 1;
          child.setDir(d.x / n, d.y / n);
        } else {
          child.setDir(1, 0);
        }
        ct.bodies.push(child);
        const weakLeft = M.api.weakRemaining(ct);
        if (weakLeft > 0) AIL.StatusResolver.apply(child, 'WEAK', weakLeft); // combatant law owns the window
        AIL.bus.emit('SlimeBodySpawned', { id: child.id, hp: o.hp, kind: o.kind });
        return child;
      },
      mergeSlimeChild(ct, childId, o) {
        const idx = ct.bodies.findIndex((b) => b && b.id === childId);
        if (idx <= 0) return false; // 0 = anchor, never merge into itself
        const child = ct.bodies[idx];
        const survivors = livingBodies(ct).filter((b) => b !== child);
        if (!survivors.length) return false; // never delete the last living body
        // Nearest valid surviving body receives the child's HP (sum, no dup).
        let best = null, bestD = Infinity;
        for (const s of survivors) {
          const d = dist(child.x, child.y, s.x, s.y);
          if (d < bestD) { bestD = d; best = s; }
        }
        const kind = child.__hrChild && child.__hrChild.kind;
        const isSplitMerge = kind === 'mitosis' || kind === 'emergency';
        // Merge law (doc 10 A1): split-half merges restore the HP pool to the
        // summed split pools (no heal beyond source max). A2 shed children
        // carved their HP out of the pool already — their expiry returns HP
        // ONLY, capped at the receiver's pool (never heals past max).
        if (isSplitMerge) {
          best.maxHp = (best.maxHp || 0) + (child.maxHp || 0);
        }
        const total = Math.min(best.maxHp || ct.anchor.maxHp || 1000, best.hp + child.hp);
        best.hp = total;
        // Footprint law (doc 10 A1 merge): merging SPLIT halves restores the
        // original physical area — r = sqrt(rA^2 + rB^2). A2 shed children
        // must NEVER merge their physical area/radius into the receiver
        // (owner correction: A2 expiry returns HP only).
        if (isSplitMerge) {
          const r = Math.sqrt((best.radius || 75) ** 2 + (child.radius || 45) ** 2);
          best.radius = r;
          best.baseRadius = r;
        }
        // Deterministic equipment merge (doc 10): items NEVER duplicate.
        // Split-merge: an unarmed survivor takes the child's weapon; a
        // second armed item is dropped as exactly one pickup slot. A2 child
        // expiry drops the weapon as a normal pickup (its spec).
        const held = heldWeaponOfBody(child);
        if (held && (o && o.equipmentMerge)) {
          const heldBest = heldWeaponOfBody(best);
          const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
          if (!heldBest && W && W.equip) {
            W.equip(best, held.weaponId); // transfer — one item in the world
          } else {
            api.dropWeaponSlot(held.weaponId, child.x, child.y); // one slot, no dup
          }
        } else if (held && (o && o.dropWeapon)) {
          api.dropWeaponSlot(held.weaponId, child.x, child.y);
        }
        ct.bodies.splice(idx, 1);
        AIL.bus.emit('SlimeBodyMerged', { id: child.id, into: best.id, hp: total });
        return true;
      },
      slimeChildrenOf: (ct, kind) => livingBodies(ct).filter((b) => b.__hrChild && (kind == null || b.__hrChild.kind === kind)),

      relocate(body, x, y, reason) {
        const tx = new AIL.RelocationTransaction(AIL.bus);
        tx.move(body, x, y, reason);
        return tx.commit();
      },
      setAimLost(ct, duration) {
        if (!ct) return;
        const st = (ct.store.__aimLost = ct.store.__aimLost || {});
        st.until = AIL.clock() + duration;
      },

      /* queries --------------------------------------------------------- */
      revealedPickups(opts) {
        const st = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.state;
        const out = [];
        if (!st || !st.slots) return out;
        for (const slot of st.slots) {
          if (!slot || slot.phase !== 'REVEALED' || slot.kind === 'HEAL' || !slot.weaponId) continue;
          // T6/Stormbreaker is NEVER an auto-target (ROBOT A1 law) — same id
          // authority as api.isT6Weapon.
          const isT6 = slot.weaponId === 'STORMBREAKER' || slot.weaponId === 'T6';
          if (opts && opts.excludeT6 && isT6) continue;
          out.push({ slot, id: slot.id, x: slot.x, y: slot.y, weaponId: slot.weaponId, isT6 });
        }
        return out;
      },
      nearestRevealedPickup(ct, opts) {
        const list = api.revealedPickups({ excludeT6: opts && opts.excludeT6 });
        if (!list.length) return null;
        if (opts && opts.weaponsOnly) {
          // All listed entries are weapons already (HEAL excluded).
        }
        const a = ct.anchor;
        let best = null, bestD = Infinity;
        for (const p of list) {
          let d = dist(a.x, a.y, p.x, p.y);
          if (opts && opts.preferSlotId != null && p.id === opts.preferSlotId) d -= 10000;
          if (d < bestD) { bestD = d; best = p; }
        }
        return best;
      },
      revealedSlotById(id) {
        const st = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.state;
        if (!st || !st.slots) return null;
        return st.slots.find((s) => s && s.id === id && s.phase === 'REVEALED') || null;
      },
      dropWeaponSlot(weaponId, x, y) {
        const SPAWN = globalScope.APEX_ARSENAL_SPAWN;
        const st = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.state;
        if (!SPAWN || !st || !st.slots) return null;
        const slot = {
          id: st.nextSlotId++,
          x: clamp(x, 60, (globalScope.GAME_SIZE || 1000) - 60),
          y: clamp(y, 60, (globalScope.GAME_SIZE || 1000) - 60),
          phase: 'REVEALED', kind: 'WEAPON', weaponId,
          revealLeadSeconds: 0, revealedFor: 0, pickedBy: null, rejectedFor: {},
          spawnTime: st.time, predictedHeroETA: null, predictedRivalETA: null,
          earliestETA: null, predictedFighter: null,
        };
        st.slots.push(slot);
        return slot;
      },
      heldWeapon: (ct) => (ct && ct.anchor ? heldWeaponOfBody(ct.anchor) : null),
      isT6Weapon: (weaponId) => weaponId === 'STORMBREAKER' || weaponId === 'T6',
      // MIRROR A1 copy: a FRESH same-weapon instance with fresh use/ammo
      // state (equip() always builds a brand-new holder). The opponent
      // keeps the original. Temporary: the mirror.arsenal executor expires
      // it after the copy lifetime (only if still held and still the copy).
      grantWeaponCopy(ct, weaponId, lifetime) {
        const a = ct && ct.anchor;
        if (!a || a.hp <= 0) return false;
        const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
        if (!W || !W.equip) return false;
        const ok = W.equip(a, weaponId);
        if (!ok) return false;
        if (a.data && a.data.arsenal) a.data.arsenal.__hrMirrorCopy = true;
        ct.store.__mirrorCopy = { weaponId, until: AIL.clock() + (lifetime || 6) };
        AIL.bus.emit('MirrorCopy', { hero: ct.heroId, weaponId, lifetime: lifetime || 6 });
        return true;
      },
      liveProjectiles: () => (globalScope.projectiles || []),
      abilityController,
      note(skillId, kind, data) {
        const parts = String(skillId).split('.');
        const prefix = parts[0].toUpperCase();
        // FROST V1 (authority §1): frost.* telemetry attributes to the
        // canonical ICE storage hero. Dormant until frost.* mechanics exist.
        const heroId = prefix === 'MATH' ? 'MATH_V2' : prefix === 'FROST' ? 'ICE' : prefix;
        for (const ct of M ? M.combatants : []) {
          if (ct.heroId === heroId) {
            ct.telemetry.bySkill[`${skillId}:${kind}`] = (ct.telemetry.bySkill[`${skillId}:${kind}`] || 0) + 1;
          }
        }
      },
      emitEvent: (type, payload) => AIL.bus.emit(type, payload),
      after: (delay, fn, label) => AIL.hrScheduler.after(delay, fn, label),
      cancel: (entry) => AIL.hrScheduler.cancel(entry),
      rollChance: (p) => rng() < p,
      baseCritChance(weaponId) {
        const CFG = globalScope.APEX_ARSENAL_CONFIG;
        return (CFG && CFG.CRIT_CHANCE && CFG.CRIT_CHANCE[weaponId]) || 0;
      },
      /* rubber compression support ------------------------------------ */
      releaseRubberStored(ct) {
        const st = ct.store['rubber.compression'];
        if (!st || !st.held || !st.held.length) return;
        const held = st.held.slice();
        st.held = [];
        const a = ct.anchor;
        const n = held.length;
        for (let i = 0; i < n; i++) {
          const d = held[i];
          const ang = (i / n) * Math.PI * 2 + (rng() * 0.2);
          const p = {
            type: 'aq_bullet', aq: true, owner: a, weapon: d.weapon,
            critical: !!d.critical, family: d.family || 'SEMI', heavy: !!d.heavy,
            x: a.x, y: a.y, px: a.x, py: a.y,
            vx: Math.cos(ang) * d.speed, vy: Math.sin(ang) * d.speed,
            radius: d.radius, damage: d.damage, life: d.life, maxLife: d.life,
            knockback: d.knockback, stun: d.stun, color: d.color,
            __hr: { rubberDebt: d.damage, chill: !!(d.tags && d.tags.chill) },
          };
          globalScope.projectiles.push(p);
        }
        AIL.bus.emit('RubberRelease', { count: n });
      },
      replayEmission(kind, params, loop) {
        if (kind === 'bullet') {
          globalScope.projectiles.push({
            type: 'aq_bullet', aq: true, owner: params.owner, weapon: params.weapon,
            critical: !!params.critical, family: params.family || 'SEMI',
            heavy: params.family === 'PRECISION',
            x: params.x, y: params.y, px: params.x, py: params.y,
            vx: Math.cos(params.angle) * params.speed,
            vy: Math.sin(params.angle) * params.speed,
            radius: params.radius, damage: params.damage, life: params.life, maxLife: params.life,
            knockback: params.knockback, stun: params.stun, color: params.color,
            __hr: { replay: loop, chill: !!(params.__hr && params.__hr.chill) },
          });
        } else if (kind === 'grenade-throw') {
          const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
          if (W && W.throwGrenade) W.throwGrenade({ ...params, __hrReplay: loop });
        } else if (kind === 'thrown-melee') {
          const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
          if (W && W.spawnThrownMelee) W.spawnThrownMelee(params.owner, params.weapon, params.angle, { __hrReplay: loop });
        }
      },
    };
    return api;
  }

  function heldWeaponOfBody(body) {
    const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
    if (!W || !W.getHolder || !body) return null;
    const h = W.getHolder(body);
    return h && h.weaponId ? { weaponId: h.weaponId, holder: h } : null;
  }

  function tryFormMirrors() {
    // 5 shards within 130px form a mirror (mirror.shattered_mirrors).
    const shards = M.world.shards;
    if (shards.length < 5) return;
    for (let i = 0; i < shards.length; i++) {
      const cluster = [shards[i]];
      for (let j = 0; j < shards.length; j++) {
        if (j === i) continue;
        if (dist(shards[i].x, shards[i].y, shards[j].x, shards[j].y) <= 130) cluster.push(shards[j]);
      }
      if (cluster.length >= 5) {
        const mx = cluster.slice(0, 5).reduce((s, c) => s + c.x, 0) / 5;
        const my = cluster.slice(0, 5).reduce((s, c) => s + c.y, 0) / 5;
        const owner = shards[i].owner;
        const used = cluster.slice(0, 5);
        M.world.shards = M.world.shards.filter((s) => !used.includes(s));
        M.api.spawnMirrorPortal({ owner, x: mx, y: my, lifetime: 10 });
        return;
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * SLIME child type — neutral body, no legacy kit.
   * ------------------------------------------------------------------ */
  const SLIME_CHILD_TYPE = {
    name: 'SLIME_CHILD',
    color: '#7ee08a',
    speed: 405,
    startDx: 1, startDy: 0,
    init() {},
    update() {}, // driven by HR (child AI), never a legacy kit
  };

  /* ------------------------------------------------------------------ *
   * Movement law — rework shells and SLIME children.
   *
   * HARD LOCOMOTION LAW (docs 02 / 09 §S1 / 10): ordinary reworked body
   * movement is ORIGINAL APEX locomotion — the body preserves its heading,
   * the engine integrates it at baseSpeed, and wall/body interactions change
   * motion only through normal physics. There is NO automatic pickup
   * seeking, NO chase/kite steering and NO ideal-distance controller. The
   * previous shellUpdate pickup-seek + hold-band steer was an illegal global
   * autopilot that contaminated every Hero (owner-failure root cause S1/S2).
   *
   * The ONLY steering allowed is an explicit Hero mechanic active window
   * (ROBOT A1 Weapon Dash, HUNTER A2 Pounce) — those executors integrate
   * their own motion and latch positionLocked themselves.
   *
   * This hook therefore only latches mechanic-driven movement locks (the
   * engine resets data.positionLocked every frame) and otherwise leaves
   * heading untouched.
   * ------------------------------------------------------------------ */
  HR.shellUpdate = function shellUpdate(f, enemy, dt) {
    const ct = combatantOfBody(f);
    if (!M || !ct || ct.facade) return;
    // Test/freeze hold (weapon-pose laws): never move a test-pinned body.
    // Explicit-mechanic integrators (dash/pounce) are unaffected.
    if (f.data.__hrHoldBody) return;
    // Explicit-mechanic motion states (dash/pounce/nest) already integrated
    // by executor onTicks; they set positionLocked for the engine skip.
    if (f.data.positionLocked) return;
    // ROOT (HUNTER A1 snare / explicit mechanic status): re-latch the engine
    // movement lock every frame while rooted. Nothing else may steer here.
    if (AIL.StatusResolver.has(f, 'ROOT')) { f.data.positionLocked = true; }
    // Otherwise: original APEX law — preserve heading; engine movement +
    // wall/body bounce own the trajectory.
  };

  function childAI(child, dt) {
    const ct = child.__hrCombatant;
    if (!ct) return;
    const enemy = enemyOf(ct);
    HR.shellUpdate(child, enemy ? enemy.anchor : null, dt);
    // Children run the FULL engine per-fighter pipeline themselves.
    const enemyBody = enemy ? (livingBodies(enemy)[0] || null) : null;
    child.update(dt, enemyBody);
  }

  /* ------------------------------------------------------------------ *
   * Damage adapter (wraps the AQ-adapted Fighter.takeDamage).
   * ------------------------------------------------------------------ */
  function installDamageAdapter() {
    const F = globalScope.Fighter;
    if (!F || F.prototype.__hrAdapt) return;
    F.prototype.__hrAdapt = true;
    const prevTake = F.prototype.takeDamage;
    F.prototype.takeDamage = function hrTakeDamage(amount, source, label, statusDamage) {
      if (!M || !(amount > 0)) return prevTake.call(this, amount, source, label, statusDamage);
      const ct = combatantOfBody(this);
      if (!ct) return prevTake.call(this, amount, source, label, statusDamage);
      const weaponId = String(label || '').startsWith('arsenal-')
        ? String(label).slice('arsenal-'.length).toUpperCase() : null;
      let packet = { amount, source, weaponId, statusDamage };
      if (!ct.facade) {
        eachExecutor(ct, (exec, ctx) => {
          if (!exec.onTakeDamage) return;
          const out = exec.onTakeDamage(ctx, this, packet);
          if (out) packet = out;
        });
        eachExecutor(ct, (exec, ctx) => {
          if (!exec.onTakeDamageLate) return;
          const out = exec.onTakeDamageLate(ctx, this, packet);
          if (out) packet = out;
        });
      }
      // POST-PLAYTEST 2026-09-29 WEAK law, exactly once, before realized HP
      // loss: Hunter-controlled damage into a WEAK combatant x1.25; positive
      // damage dealt BY a WEAK combatant x0.75. Neutral/self/unrelated
      // sources never receive the Hunter vulnerability.
      const srcCt = packet.source ? combatantOfBody(packet.source) : null;
      if (srcCt && srcCt !== ct) {
        if ((srcCt.weakUntil || 0) > AIL.clock()) packet = { ...packet, amount: packet.amount * 0.75 };
        if (srcCt.heroId === 'HUNTER' && (ct.weakUntil || 0) > AIL.clock()) {
          packet = { ...packet, amount: packet.amount * 1.25 };
        }
      }
      if (!(packet.amount > 0)) {
        AIL.bus.emit('DamageFullyAbsorbed', { victim: this.id, original: amount });
        return;
      }
      const before = this.hp;
      const out = prevTake.call(this, packet.amount, packet.source, label, statusDamage);
      const dealt = Math.max(0, before - this.hp);
      if (dealt > 0) {
        const sourceCt = combatantOfBody(packet.source);
        onRealized({
          victimBody: this, victimCombatant: ct, amount: dealt,
          creditedTo: sourceCt || null, weaponId,
        });
        // Immediate anchor promotion when the anchor body died (SLIME law:
        // the combatant lives while any body lives; the array keeps exactly
        // one slot per side).
        if (this === ct.anchor && this.hp <= 0) promoteAnchor(ct);
      }
      return out;
    };
  }

  function onRealized(ev) {
    if (!M) return;
    // Telemetry.
    if (ev.creditedTo && ev.creditedTo !== ev.victimCombatant) ev.creditedTo.telemetry.damageDealt += ev.amount;
    if (ev.victimCombatant) ev.victimCombatant.telemetry.damageTaken += ev.amount;
    AIL.bus.emit('RealizedDamageEvent', {
      victim: ev.victimBody.id, amount: ev.amount,
      creditedTo: ev.creditedTo ? ev.creditedTo.heroId : null,
      weaponId: ev.weaponId,
    });
    for (const ct of M.combatants) eachExecutor(ct, (exec, ctx) => {
      if (exec.onRealizedDamage) exec.onRealizedDamage(ctx, ev);
    });
  }

  function promoteAnchor(ct) {
    const living = livingBodies(ct).filter((b) => b !== ct.anchor);
    if (!living.length) return; // combatant truly dead — engine KO stands
    // DOC-06 SLIME LAW: child Bodies never enter the legacy fighters[]
    // array. The retired anchor stays in the slot as a neutralized
    // representative (still, invisible, untouchable); the promoted anchor
    // is driven + drawn by the rework runtime instead of the engine.
    const retired = ct.anchor;
    const next = living[0];
    retired.baseSpeed = 0;
    retired.data.positionLocked = true;
    retired.data.__hrRetiredAnchor = true;
    retired.draw = function retiredAnchorDraw() {}; // engine draw -> nothing
    ct.anchor = next;
    next.__hrRefHp = next.__hrRefHp || next.maxHp;
    AIL.bus.emit('SlimeAnchorPromoted', { combatant: ct.heroId, newAnchor: next.id });
  }

  /* ------------------------------------------------------------------ *
   * Combatant-level HP authority (doc 02: logical victory/HUD/save =
   * Combatant; body-local HP stays the physical damage authority; a
   * Combatant dies only when no living Body remains). Shared body
   * queries (KO check, HUD) route through these instead of reading the
   * current anchor's hp directly.
   * ------------------------------------------------------------------ */
  function combatantHp(ct) {
    const living = livingBodies(ct);
    let hp = 0, maxHp = 0;
    for (const b of living) { hp += b.hp; maxHp += (b.__hrRefHp || b.maxHp); }
    return { hp, maxHp: maxHp || 1, bodies: living.length };
  }
  HR.combatantHp = combatantHp;
  HR.bodyKO = function bodyKO(f) {
    const ct = combatantOfBody(f);
    if (!ct || ct.facade) return (f ? f.hp <= 0 : true); // legacy body
    return livingBodies(ct).length === 0; // rework: Combatant death law
  };
  HR.bodyHudHp = function bodyHudHp(f) {
    const ct = combatantOfBody(f);
    if (!ct || ct.facade) return { hp: f.hp, maxHp: f.maxHp }; // legacy body
    return combatantHp(ct); // logical Combatant total living HP
  };

  /* ------------------------------------------------------------------ *
   * Fire hooks (audited call-sites in arsenalWeaponRuntime).
   * ------------------------------------------------------------------ */
  HR.onFireBullet = function onFireBullet(spec) {
    if (!M) return null;
    if (spec.__hrReplay) {
      return { replay: spec.__hrReplay, chill: !!(spec.__hrTags && spec.__hrTags.chill) };
    }
    const owner = spec.owner;
    const ct = combatantOfBody(owner);
    if (!ct || ct.facade) return null;
    const tag = {};
    // SNIPER predictive intercept (nest) — retarget before the muzzle.
    const snipe = ct.skills.A2 && ct.store['sniper.nest'];
    if (snipe && snipe.nestUntil && AIL.clock() < snipe.nestUntil && ct.heroId === 'SNIPER') {
      const enemy = enemyOf(ct);
      const ea = enemy && livingBodies(enemy)[0];
      if (ea) {
        const vel = bodyVelocity(ea);
        const t = solveIntercept(spec.x, spec.y, ea.x, ea.y, vel.x, vel.y, spec.speed);
        if (t > 0) {
          const px = ea.x + vel.x * t, py = ea.y + vel.y * t;
          spec.angle = Math.atan2(py - spec.y, px - spec.x);
        }
      }
    }
    // Executor hooks (magnet speed, ice chill, sniper crit, time record).
    // A projectile stand-in exposes exactly the fields executors may touch;
    // mutations map back onto the spec BEFORE the base push.
    const standin = { weapon: spec.weapon, critical: !!spec.critical, __hr: tag };
    Object.defineProperty(standin, 'critical', {
      get() { return !!spec.critical; },
      set(v) { spec.critical = !!v; },
    });
    const descriptor = { kind: 'bullet', params: { ...spec, owner } };
    for (const slot of ['A1', 'A2', 'PASSIVE']) {
      const s = ct.skills[slot];
      if (!s) continue;
      const exec = MECH.EXECUTORS[s.def.mechanicId];
      if (!exec || !exec.onProjectileFired) continue;
      exec.onProjectileFired(mechCtx(ct, slot), standin, descriptor);
    }
    return Object.keys(tag).length ? tag : null;
  };

  function solveIntercept(sx, sy, tx, ty, tvx, tvy, projSpeed) {
    const dx = tx - sx, dy = ty - sy;
    const a = tvx * tvx + tvy * tvy - projSpeed * projSpeed;
    const b = 2 * (dx * tvx + dy * tvy);
    const c = dx * dx + dy * dy;
    if (Math.abs(a) < 1e-6) {
      return b !== 0 ? -c / b : 0;
    }
    const disc = b * b - 4 * a * c;
    if (disc < 0) return 0;
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
    const cands = [t1, t2].filter((t) => t > 0);
    return cands.length ? Math.min(...cands) : 0;
  }

  function bodyVelocity(body) {
    const v = body.__hrVel || { x: 0, y: 0 };
    return v;
  }

  HR.onThrownMelee = function onThrownMelee(f, weaponId, angle, extra) {
    if (!M) return null;
    const ct = combatantOfBody(f);
    if (extra && extra.__hrReplay) return { replay: extra.__hrReplay };
    if (!ct || ct.facade) return null;
    const tag = {};
    for (const slot of ['A1', 'A2', 'PASSIVE']) {
      const s = ct.skills[slot];
      if (!s) continue;
      const exec = MECH.EXECUTORS[s.def.mechanicId];
      if (!exec || !exec.onProjectileFired) continue;
      const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
      const t = W && W.thrownSpec ? W.thrownSpec(weaponId) : {};
      exec.onProjectileFired(mechCtx(ct, slot), { weapon: weaponId, __hr: tag }, {
        kind: 'thrown-melee',
        params: { owner: f, weapon: weaponId, angle },
        speed: t.speed, ricochets: t.ricochets,
      });
    }
    return Object.keys(tag).length ? tag : null;
  };

  HR.onGrenade = function onGrenade(spec) {
    if (!M) return null;
    if (spec && spec.__hrReplay) return { replay: spec.__hrReplay };
    const ct = combatantOfBody(spec.owner);
    if (!ct || ct.facade) return null;
    const tag = {};
    for (const slot of ['A1', 'A2', 'PASSIVE']) {
      const s = ct.skills[slot];
      if (!s) continue;
      const exec = MECH.EXECUTORS[s.def.mechanicId];
      if (!exec || !exec.onProjectileFired) continue;
      exec.onProjectileFired(mechCtx(ct, slot), { __hr: tag, weapon: 'GRENADE' }, {
        kind: 'grenade-throw',
        params: { ...spec },
      });
    }
    return Object.keys(tag).length ? tag : null;
  };

  /* ------------------------------------------------------------------ *
   * Equip hook (weapon pickup by a rework combatant).
   * ------------------------------------------------------------------ */
  function onEquipped(f, weaponId) {
    if (!M) return;
    const ct = combatantOfBody(f);
    if (!ct || ct.facade) return;
    eachExecutor(ct, (exec, ctx) => {
      if (exec.onEquipOffensive) exec.onEquipOffensive(ctx, weaponId);
    });
    AIL.bus.emit('ReworkEquip', { combatant: ct.heroId, weaponId });
  }

  /* ------------------------------------------------------------------ *
   * Enemy resolution hook (makeCtx) — body-aware + SNIPER aim-lost.
   * ------------------------------------------------------------------ */
  HR.resolveEnemyBody = function resolveEnemyBody(f, baseEnemy) {
    if (!M) return undefined; // no rework match: keep base resolution
    const ct = combatantOfBody(f);
    if (!ct) return undefined;
    // Aim-lost: no auto-aim target (opponent may still fire last aim).
    const aimLost = ct.store.__aimLost && ct.store.__aimLost.until > AIL.clock();
    if (aimLost) return null;
    const enemy = enemyOf(ct);
    if (!enemy) return baseEnemy || null;
    const bodies = livingBodies(enemy);
    if (!bodies.length) return null;
    if (bodies.length === 1) return bodies[0] === baseEnemy ? baseEnemy : bodies[0];
    let best = null, bestD = Infinity;
    for (const b of bodies) {
      const d = dist(f.x, f.y, b.x, b.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  };

  /* ------------------------------------------------------------------ *
   * Pickup actors hook (resolvePickups) + splash hook (explodeGrenade).
   * ------------------------------------------------------------------ */
  HR.pickupActors = function pickupActors() {
    if (!M) return undefined; // base path
    return M.combatants.flatMap((ct) => livingBodies(ct));
  };
  HR.splashTargets = function splashTargets(owner) {
    if (!M) return undefined;
    const ownerCt = combatantOfBody(owner);
    const out = [];
    for (const ct of M.combatants) {
      for (const b of livingBodies(ct)) if (b !== owner) out.push(b);
    }
    return out;
  };
  HR.spreadScaleFor = function spreadScaleFor(f) {
    if (!M) return 1;
    const ct = combatantOfBody(f);
    if (!ct || ct.facade || ct.heroId !== 'SNIPER') return 1;
    const st = ct.store['sniper.nest'];
    if (st && st.nestUntil && AIL.clock() < st.nestUntil) {
      const cfg = ct.skills.A2.cfg;
      return cfg.spreadMultiplier || 0.25;
    }
    return 1;
  };

  /* ------------------------------------------------------------------ *
   * P1 ability input (J -> A1, K -> A2) + P2 cast AI.
   * ------------------------------------------------------------------ */
  HR.pressAbility = function pressAbility(f, slot) {
    if (!M) return { ok: false, reason: 'no-match' };
    const ct = combatantOfBody(f);
    if (!ct || ct.facade) return { ok: false, reason: 'not-rework' };
    const res = abilityController(ct).tryCast(slot, 'p1');
    AIL.bus.emit('P1Press', { slot, ok: res.ok, reason: res.reason });
    return res;
  };

  function p2CastAI(ct, dt) {
    if (!HR.aiEnabled || !M.aiEnabled) return;
    const AQS = globalScope.APEX_ARSENAL;
    if (AQS && AQS.state && AQS.state.labMode) return;
    if (ct.idx !== 1) return; // P2 only
    const ctl = abilityController(ct);
    for (const slot of ['A1', 'A2']) {
      if (ctl.cooldownLeft(slot) > 0) continue;
      const key = `${ct.heroId}:${slot}`;
      const plan = (M.aiCastPlan[key] = M.aiCastPlan[key] || {});
      if (plan.at == null) {
        // Deterministic post-ready delay (tuning slot).
        plan.at = AIL.clock() + 0.4 + rng() * 0.6;
      } else if (AIL.clock() >= plan.at) {
        const exec = MECH.EXECUTORS[ct.skills[slot].def.mechanicId];
        if (exec && exec.aiCanAttempt && !exec.aiCanAttempt(mechCtx(ct, slot))) {
          plan.at = AIL.clock() + 0.25; // executor says the cast cannot succeed now
          continue;
        }
        const res = ctl.tryCast(slot, 'p2-ai');
        if (res.ok || res.reason === 'cooldown' || res.reason === 'cc') {
          plan.at = null; // re-plan after cooldown returns
        } else {
          plan.at = AIL.clock() + 0.5; // condition unmet: retry shortly
        }
      }
    }
  }
  HR.setAiEnabled = function (v) { HR.aiEnabled = !!v; if (M) M.aiEnabled = HR.aiEnabled; };

  /* ------------------------------------------------------------------ *
   * Step wrapping — AQ.step (headless) and global update (rAF).
   * ------------------------------------------------------------------ */
  function hrPreTick(dt) {
    if (!M) return;
    AIL.bindClock(() => globalScope.matchClock || 0);
    AIL.hrScheduler.tick();
    for (const ct of M.combatants) {
      if (ct.facade) continue;
      abilityController(ct).tick(dt);
      p2CastAI(ct, dt);
      eachExecutor(ct, (exec, ctx) => { if (exec.onTick) exec.onTick(ctx, dt); });
    }
    // Child bodies: full engine pipeline + holder updates. The anchor is
    // driven by the ENGINE while it is the fighters[] entry; a PROMOTED
    // anchor (SLIME, doc-06: children never enter fighters[]) is driven
    // here instead so it keeps moving/fighting after promotion.
    const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
    const engineDrives = (ct) => {
      const arr = globalScope.fighters;
      return !!(arr && arr[ct.idx] === ct.anchor);
    };
    for (const ct of M.combatants) {
      for (const b of ct.bodies) {
        if (!b || b.hp <= 0) continue;
        if (b === ct.anchor && engineDrives(ct)) continue;
        childAI(b, dt);
        if (W && W.updateHolder) W.updateHolder(b, dt);
      }
    }
    // Velocity tracking (for SNIPER intercept).
    for (const ct of M.combatants) {
      for (const b of ct.bodies) {
        if (!b) continue;
        b.__hrVel = b.__hrLast
          ? { x: (b.x - b.__hrLast.x) / Math.max(dt, 1e-4), y: (b.y - b.__hrLast.y) / Math.max(dt, 1e-4) }
          : { x: 0, y: 0 };
        b.__hrLast = { x: b.x, y: b.y };
      }
    }
  }

  function hrPostTick(dt) {
    if (!M) return;
    tickWorld(dt);
    globalScope.APEX_HUNTER_PRESENTATION?.tick(dt);
    globalScope.APEX_FROST_PRESENTATION?.tick(dt);
    separateExtraBodies(dt);
    // SLIME child lifecycle.
    for (const ct of M.combatants) {
      for (let i = ct.bodies.length - 1; i >= 0; i--) {
        const b = ct.bodies[i];
        if (!b || b.hp <= 0) { if (b !== ct.anchor) ct.bodies.splice(i, 1); continue; }
        const ch = b.__hrChild;
        if (ch && ch.lifetime > 0 && AIL.clock() - ch.bornAt >= ch.lifetime && b !== ct.anchor) {
          // Timed expiry: surviving HP returns to nearest surviving body.
          M.api.mergeSlimeChild(ct, b.id, { dropWeapon: true });
        }
      }
      if (ct.anchor && ct.anchor.hp <= 0) promoteAnchor(ct);
    }
  }

  function tickWorld(dt) {
    const w = M.world;
    const now = AIL.clock();
    // Walls
    for (let i = w.walls.length - 1; i >= 0; i--) {
      const wall = w.walls[i];
      if (wall.hp <= 0 || now - wall.bornAt >= wall.lifetime) {
        if (wall.hp <= 0) AIL.bus.emit('WallShattered', { id: wall.id, by: wall.__shatteredBy || 'damage' });
        w.walls.splice(i, 1);
      }
    }
    // Gates
    for (let i = w.gates.length - 1; i >= 0; i--) {
      if (now - w.gates[i].bornAt >= w.gates[i].lifetime) w.gates.splice(i, 1);
    }
    // Singularities
    for (let i = w.singularities.length - 1; i >= 0; i--) {
      const s = w.singularities[i];
      if (now - s.bornAt >= s.lifetime) {
        // Release everything still stored.
        for (const d of s.stored) releaseFromSingularity(s, d);
        w.singularities.splice(i, 1);
      }
    }
    // Lanes
    for (let i = w.lanes.length - 1; i >= 0; i--) {
      const l = w.lanes[i];
      if (l.windupLeft > 0) { l.windupLeft -= dt; continue; }
      l.x += Math.cos(l.angle) * l.speed * dt;
      l.y += Math.sin(l.angle) * l.speed * dt;
      l.traveled += l.speed * dt;
      const enemy = enemyOf(l.owner);
      for (const b of livingBodies(enemy || {})) {
        const d = pointToSegmentDist(b.x, b.y, l.x, l.y,
          l.x - Math.cos(l.angle) * 160, l.y - Math.sin(l.angle) * 160);
        if (d <= l.width / 2 + b.radius) {
          M.api.applyChillTo(b);
          AIL.bus.emit('LaneChill', { target: b.id });
        }
      }
      if (l.x < -200 || l.x > (globalScope.GAME_SIZE || 1000) + 200 || l.y < -200 || l.y > (globalScope.GAME_SIZE || 1000) + 200) {
        w.lanes.splice(i, 1);
      }
    }
    // Logical snare lifecycle. Presentation never decides trigger/root success.
    for (let i=w.snares.length-1;i>=0;i--) {
      const s=w.snares[i]; s.phaseTime+=dt;
      const phase=p=>{s.phase=p;s.phaseTime=0;AIL.bus.emit('HunterTrapPhase',{id:s.id,phase:p});};
      if(s.phase==='release'){if(s.phaseTime>=.92){w.snares.splice(i,1);continue;}}
      else if(s.triggeredAt!=null && (now-s.triggeredAt>=s.rootDuration || !s.prey || s.prey.hp<=0)) phase('release');
      else if(!s.consumed && now-s.bornAt>=s.lifetime) {s.consumed=true;phase('release');}
      else if(s.phase==='unfold' && s.phaseTime>=.62) phase('armed');
      else if(s.phase==='tension' && s.phaseTime>=.1) phase('snap');
      else if(s.phase==='snap' && s.phaseTime>=.34) phase('pin');
      if(!s.consumed && (s.phase==='armed'||s.phase==='unfold')) {
        // Owner playtest: gameplay footprint must not exceed the rendered trap.
        for(const b of livingBodies(enemyOf(s.owner)||{})) if(dist(b.x,b.y,s.x,s.y)<=s.radius) {
          s.consumed=true;s.prey=b;s.triggeredAt=now;M.api.applyRootTo(b,s.rootDuration);
          M.api.applyWeakCombatant(combatantOfBody(b), (s.owner.skills.A1.cfg.weakDuration ?? 1.0));phase('tension');
          AIL.bus.emit('SnareTriggered',{id:s.id,target:b.id,root:s.rootDuration});break;
        }
      }
      globalScope.APEX_HUNTER_PRESENTATION?.trapTick(s,dt);
    }
    // Graphs
    for (let i = w.graphs.length - 1; i >= 0; i--) {
      const g = w.graphs[i];
      const expired = now - g.bornAt >= g.lifetime;
      if (expired || g.endedBy) {
        w.graphs.splice(i, 1);
        // Passive: graph ending produces the x2 gate.
        eachExecutor(g.owner, (exec, ctx) => { if (exec.onGraphEnded) exec.onGraphEnded(ctx); });
      }
    }
    // Shards
    for (let i = w.shards.length - 1; i >= 0; i--) {
      if (now - w.shards[i].bornAt >= w.shards[i].lifetime) w.shards.splice(i, 1);
    }
    // Mirrors
    for (let i = w.mirrors.length - 1; i >= 0; i--) {
      if (now - w.mirrors[i].bornAt >= w.mirrors[i].lifetime) w.mirrors.splice(i, 1);
    }
  }

  function pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /* ------------------------------------------------------------------ *
   * SHARED GEOMETRY AUTHORITY (CRYSTALA anti-tunnelling).
   * Swept point-vs-capsule time of impact + the provider of every SOLID
   * world capsule (Crystal material that has actually grown/locked, and any
   * legacy world wall). Bodies, authored displacement (Robot A1 dash, Hunter
   * pounce) and bullets all consult the same authority, so nothing tunnels and
   * no hero's semantics had to be rewritten for it.
   * ------------------------------------------------------------------ */
  function segCircleT(x0, y0, dx, dy, cx, cy, r) {
    const fx = x0 - cx, fy = y0 - cy;
    const a = dx * dx + dy * dy;
    if (a < 1e-12) return null;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t1 = (-b - Math.sqrt(disc)) / (2 * a);
    return t1 >= 0 && t1 <= 1 ? t1 : null;
  }
  // Earliest t in [0,1] at which the point moving (x0,y0)->(x1,y1) is within r
  // of segment AB. Normal points from the capsule toward the mover.
  function capsuleToi(x0, y0, x1, y1, ax, ay, bx, by, r) {
    const dx = x1 - x0, dy = y1 - y0;
    const abx = bx - ax, aby = by - ay, L2 = abx * abx + aby * aby;
    const s0 = L2 > 0 ? clamp(((x0 - ax) * abx + (y0 - ay) * aby) / L2, 0, 1) : 0;
    const cx = ax + abx * s0, cy = ay + aby * s0;
    const ox = x0 - cx, oy = y0 - cy, od = Math.hypot(ox, oy);
    if (od <= r) { // already overlapping: push out along the closest-point normal
      let nx, ny;
      if (od > 1e-6) { nx = ox / od; ny = oy / od; }
      else { const L = Math.sqrt(L2) || 1; nx = -aby / L; ny = abx / L; if (nx * dx + ny * dy > 0) { nx = -nx; ny = -ny; } }
      return { t: 0, nx, ny };
    }
    let best = null;
    const consider = (t, nx, ny) => { if (t >= 0 && t <= 1 && (!best || t < best.t)) best = { t, nx, ny }; };
    for (const e of [[ax, ay], [bx, by]]) {
      const t = segCircleT(x0, y0, dx, dy, e[0], e[1], r);
      if (t != null) {
        const px = x0 + dx * t - e[0], py = y0 + dy * t - e[1], m = Math.hypot(px, py) || 1;
        consider(t, px / m, py / m);
      }
    }
    if (L2 > 0) {
      const L = Math.sqrt(L2), ux = abx / L, uy = aby / L, nx0 = -uy, ny0 = ux;
      const sd0 = (x0 - ax) * nx0 + (y0 - ay) * ny0, sdv = dx * nx0 + dy * ny0;
      for (const side of [1, -1]) {
        const den = side * sdv;
        if (den >= 0) continue;
        const t = (r - side * sd0) / den;
        if (t < 0 || t > 1) continue;
        const along = (x0 + dx * t - ax) * ux + (y0 + dy * t - ay) * uy;
        if (along < 0 || along > L) continue;
        consider(t, nx0 * side, ny0 * side);
      }
    }
    return best;
  }
  function solidCapsules() {
    const out = [];
    if (!M) return out;
    for (const w of M.world.walls) {
      if (!(w.hp > 0)) continue;
      const c = Math.cos(w.angle), s = Math.sin(w.angle), h = w.len / 2;
      out.push({ ax: w.x - c * h, ay: w.y - s * h, bx: w.x + c * h, by: w.y + s * h, r: w.thickness / 2, owner: w.owner, legacy: w });
    }
    const CRY = globalScope.APEX_CRYSTAL;
    if (CRY) for (const c of CRY.capsules()) out.push(c);
    return out;
  }
  function wallsBlockPoint(x, y, r) {
    for (const c of solidCapsules()) if (pointToSegmentDist(x, y, c.ax, c.ay, c.bx, c.by) < r + c.r) return true;
    return false;
  }
  // Runs after the engine's body separation each step: sweeps every living body
  // from where it was to where it is against all solid capsules and stands it on
  // the surface it would have crossed (bounce heading like an arena wall).
  function resolveWorldWalls() {
    if (!M) return;
    const caps = solidCapsules();
    const bodies = M.api.allBodies();
    const S = globalScope.GAME_SIZE || 1000;
    for (const b of bodies) {
      if (!b || b.hp <= 0) continue;
      const prev = b.__hrWallPos;
      if (caps.length && prev) {
        let px = prev.x, py = prev.y;
        for (let pass = 0; pass < 3; pass++) {
          let best = null;
          for (const c of caps) {
            const hit = capsuleToi(px, py, b.x, b.y, c.ax, c.ay, c.bx, c.by, (b.radius || 75) + c.r);
            if (hit && (!best || hit.t < best.hit.t)) best = { hit, c };
          }
          if (!best) break;
          const { hit, c } = best;
          const qx = px + (b.x - px) * hit.t, qy = py + (b.y - py) * hit.t;
          const abx = c.bx - c.ax, aby = c.by - c.ay, L2 = abx * abx + aby * aby;
          const s = L2 > 0 ? clamp(((qx - c.ax) * abx + (qy - c.ay) * aby) / L2, 0, 1) : 0;
          const rr = (b.radius || 75) + c.r + 0.5;
          b.x = clamp(c.ax + abx * s + hit.nx * rr, (b.radius || 75), S - (b.radius || 75));
          b.y = clamp(c.ay + aby * s + hit.ny * rr, (b.radius || 75), S - (b.radius || 75));
          px = b.x; py = b.y;
          if (b.dir && typeof globalScope.reflectDir === 'function' && (b.dir.x * hit.nx + b.dir.y * hit.ny) < 0) {
            b.dir = globalScope.reflectDir(b.dir, hit.nx, hit.ny);
          }
        }
      }
      b.__hrWallPos = { x: b.x, y: b.y };
    }
  }
  HR.geom = { capsuleToi, solidCapsules, wallsBlockPoint, pointToSegmentDist, segmentToPointToi: (...a) => segmentToPointToi(...a) };


  function releaseFromSingularity(s, d) {
    // Safe exit ~exitDistance px away from the nearest living body.
    const bodies = M.api.allBodies();
    let ref = null, bestD = Infinity;
    for (const b of bodies) {
      const dd = dist(s.x, s.y, b.x, b.y);
      if (dd < bestD) { bestD = dd; ref = b; }
    }
    let ex = s.x, ey = s.y;
    if (ref) {
      const ang = angleTo(ref.x, ref.y, s.x, s.y);
      ex = s.x + Math.cos(ang) * 30;
      ey = s.y + Math.sin(ang) * 30;
    }
    const p = {
      type: d.type, aq: true, owner: d.owner, weapon: d.weapon,
      critical: !!d.critical, family: d.family, heavy: !!d.heavy,
      x: ex, y: ey, px: ex, py: ey,
      vx: d.vx, vy: d.vy, radius: d.radius, damage: d.damage,
      life: d.life, maxLife: d.maxLife, knockback: d.knockback, stun: d.stun,
      color: d.color, rot: d.rot, spin: d.spin, ricochetsLeft: d.ricochetsLeft,
      state: d.state === 'aq_thrown' ? 'flight' : undefined,
      fuse: d.fuse, grace: d.grace, flightTime: 0, maxFlight: d.maxFlight,
      pinAngle: 0, pinnedTo: null, pinTimer: 0,
      __hr: Object.assign({}, d.tags, { singularityReleased: true }),
    };
    if (d.type === 'aq_thrown') p.state = 'flight';
    globalScope.projectiles.push(p);
    AIL.bus.emit('SingularityRelease', { weapon: d.weapon });
  }

  /* ------------------------------------------------------------------ *
   * Body separation for non-anchor bodies (children vs everyone).
   * The engine's handleCollisions only resolves fighters[0]/[1]; all
   * pairs involving children are resolved here, physically, plus the
   * same collision hooks anchors get.
   * ------------------------------------------------------------------ */
  function separateExtraBodies(dt) {
    const all = M.api.allBodies();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (!a || !b || a.hp <= 0 || b.hp <= 0) continue;
        const bothAnchors = a === M.combatants[0].anchor && b === M.combatants[1].anchor;
        if (bothAnchors) continue; // engine handleCollisions owns this pair
        const d = dist(a.x, a.y, b.x, b.y);
        const minD = a.radius + b.radius;
        if (d >= minD || d <= 0.001) continue;
        const ctA = combatantOfBody(a), ctB = combatantOfBody(b);
        // Physical separation (half each).
        const push = (minD - d) / 2;
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        if (!a.data.positionLocked) { a.x -= nx * push; a.y -= ny * push; }
        if (!b.data.positionLocked) { b.x += nx * push; b.y += ny * push; }
        // Cross-side contact fires collision hooks (RUBBER/MATH laws).
        if (ctA && ctB && ctA !== ctB) {
          const va = bodyVelocity(a), vb = bodyVelocity(b);
          const closing = Math.abs((va.x - vb.x) * nx + (va.y - vb.y) * ny);
          const key = `${a.id}:${b.id}`;
          const w = M.world;
          w.__contact = w.__contact || {};
          const inContact = !!w.__contact[key];
          w.__contact[key] = true;
          if (!inContact) {
            fireCollision(ctA, a, b, closing);
            fireCollision(ctB, b, a, closing);
          }
        } else {
          const key = `${a.id}:${b.id}`;
          M.world.__contact = M.world.__contact || {};
          M.world.__contact[key] = true;
        }
      }
    }
    // Decay contact flags for pairs that separated (approximate: rebuild).
    const w = M.world;
    if (w.__contact) {
      const alive = new Set();
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], b = all[j];
          if (dist(a.x, a.y, b.x, b.y) < a.radius + b.radius + 8) alive.add(`${a.id}:${b.id}`);
        }
      }
      for (const k of Object.keys(w.__contact)) if (!alive.has(k)) delete w.__contact[k];
    }
  }

  function fireCollision(ct, myBody, otherBody, closingSpeed) {
    eachExecutor(ct, (exec, ctx) => {
      if (exec.onBodyCollision) exec.onBodyCollision(ctx, myBody, otherBody, closingSpeed);
    });
    AIL.bus.emit('BodyCollision', {
      combatant: ct.heroId, a: myBody.id, b: otherBody.id, closingSpeed,
    });
  }

  HR.noteAnchorContacts = function noteAnchorContacts() {
    if (!M) return;
    const a = M.combatants[0].anchor, b = M.combatants[1].anchor;
    if (!a || !b || a.hp <= 0 || b.hp <= 0) return;
    const d = dist(a.x, a.y, b.x, b.y);
    const key = `${a.id}:${b.id}`;
    M.world.__contact = M.world.__contact || {};
    const was = !!M.world.__contact[key];
    M.world.__contact[key] = d < a.radius + b.radius + 8;
    if (!was && d < a.radius + b.radius + 4) {
      const va = bodyVelocity(a), vb = bodyVelocity(b);
      const nx = (b.x - a.x) / (d || 1), ny = (b.y - a.y) / (d || 1);
      const closing = Math.abs((va.x - vb.x) * nx + (va.y - vb.y) * ny);
      fireCollision(M.combatants[0], a, b, closing);
      fireCollision(M.combatants[1], b, a, closing);
    }
  };

  /* ------------------------------------------------------------------ *
   * PROJECTILE PASS — replaces weaponApi.updateArsenalProjectiles.
   * No-transform behavior is byte-parity with the base pass; hero
   * transforms are interleaved at deterministic per-segment stages.
   * ------------------------------------------------------------------ */
  let baseUpdateArsenalProjectiles = null;

  function reworkUpdateProjectiles(dt) {
    if (!M) { if (baseUpdateArsenalProjectiles) return baseUpdateArsenalProjectiles(dt); return; }
    const CFG = globalScope.APEX_ARSENAL_CONFIG;
    const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
    const projectiles = globalScope.projectiles;
    const GAME_SIZE = globalScope.GAME_SIZE || 1000;
    const BULLET_HIT_SCALE = (CFG && CFG.BULLET_HIT_RADIUS_SCALE) || 0.78;
    // CRYSTALA: shard jobs / K window / construct lifetimes / Gold rig advance.
    const CRY = globalScope.APEX_CRYSTAL;
    if (CRY) CRY.tick(dt);
    // FROST V1: post-hit Freeze roll (authority §6.2). Hooked beside the
    // live chill line: Stage B hands (p, target) for every confirmed exact
    // body hit incl. multi-body children. Optional/lazy like CRY.
    const FR = globalScope.APEX_FROST;

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!p || !p.aq) continue;

      if (p.type === 'aq_bullet') {
        // A bullet held inside a Crystal shard's gem during the refraction beat.
        if (CRY && CRY.holdStep(p)) continue;
        p.px = p.x; p.py = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -20 || p.x > GAME_SIZE + 20 || p.y < -20 || p.y > GAME_SIZE + 20) { p.life = 0; continue; }

        // ---- Stage W: walls (absorb non-T6; T6 shatters) ---------------
        const wallHit = sweepWalls(p, BULLET_HIT_SCALE);
        if (wallHit) {
          const isT6 = p.weapon === 'STORMBREAKER';
          const dmg = scaledProjectileDamage(p);
          wallHit.wall.hp -= isT6 ? ((CFG && CFG.WEAPONS && CFG.WEAPONS.STORMBREAKER && CFG.WEAPONS.STORMBREAKER.confirmedHitDamage) || 446) : dmg;
          if (isT6) { wallHit.wall.__shatteredBy = 'STORMBREAKER'; AIL.bus.emit('WallShatteredByT6', {}); }
          if (wallHit.wall.hp <= 0) wallHit.wall.__shatteredBy = wallHit.wall.__shatteredBy || 'damage';
          if (!isT6) { p.life = 0; continue; } // absorbed
          // T6 continues through the shattering wall.
        }

        // ---- Stage G: MATH graph absorb (T6 immune) --------------------
        if (graphBlocks(p)) { p.life = 0; continue; }

        // ---- Stage T: gates (x2 / div2; T6 unaffected) ------------------
        gateTransform(p);

        // ---- Stage S: singularity store (T6 immune) ---------------------
        if (singularityStore(p)) { projectiles.splice(i, 1); continue; }

        // ---- Stage P: mirror portal routing (bullets; T6 immune) -------
        mirrorRoute(p);

        // ---- Stage B: body interactions (earliest TOI winner) ----------
        const bodyHit = earliestToiBodyT(p, BULLET_HIT_SCALE);
        // CRYSTALA (K shard contact / J solid material): the earliest of shard
        // contact, construct surface and body wins. There is NO automatic body
        // reflect any more (docs/hero-rework/crystala-v1 authority).
        if (CRY) {
          const cr = CRY.resolveBullet(p, bodyHit ? bodyHit.t : 2, dt);
          if (cr && cr.consumed) continue;
        }
        const target = bodyHit ? bodyHit.body : null;
        if (target) {
          // RUBBER compression storage (enemy projectile into RUBBER).
          if (tryRubberStore(p, target)) { projectiles.splice(i, 1); continue; }

          const hitR = target.radius * BULLET_HIT_SCALE + p.radius;
          const hit = sweptHit(p.px, p.py, p.x, p.y, target.x, target.y, hitR) || { x: p.x, y: p.y };
          const neutral = p.__hr && p.__hr.neutral;
          const W2 = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
          const hpBeforeHit = target.hp;
          if (W2 && W2.aqDamage) {
            W2.aqDamage(target, p.damage, neutral ? null : p.owner, p.weapon, {
              knockback: p.knockback, stun: p.stun, hitStop: p.heavy ? 0.05 : 0,
              critical: !!p.critical,
              impact: { x: hit.x, y: hit.y, vx: p.vx, vy: p.vy },
            });
          }
          if (CRY) { CRY.noteBodyHit(p, target); CRY.afterBodyHit(p, target, hpBeforeHit - target.hp); }
          // ICE payload (survives transforms unless stripped).
          if (p.__hr && p.__hr.chill) M.api.applyChillTo(target);
          // FROST V1: Frozen Bullet post-hit Freeze roll (no-op unless tagged).
          if (FR && p.__hr && p.__hr.frost) FR.noteBodyHit(p, target);
          // RUBBER debt erase (released projectile hit the opponent).
          if (p.__hr && p.__hr.rubberDebt) {
            AIL.bus.emit('RubberDebtErased', { amount: p.__hr.rubberDebt });
            p.__hr.rubberDebt = null;
          }
          const fam = p.family || 'SEMI';
          if (globalScope.emitParticles) {
            if (fam === 'AUTO') globalScope.emitParticles(p.x, p.y, p.color, 3, 260, 3, 0.2, 'square');
            else if (fam === 'SHOTGUN' || fam === 'AUTOSHOT') globalScope.emitParticles(p.x, p.y, p.color, 9, 340, 5, 0.3, 'square');
            else if (p.heavy) globalScope.emitParticles(p.x, p.y, p.color, 8, 420, 4, 0.3, 'square');
            else globalScope.emitParticles(p.x, p.y, p.color, 5, 300, 3, 0.25, 'square');
          }
          p.life = 0;
        }
        continue;
      }

      if (p.type === 'aq_grenade') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot = (p.rot || 0) + dt * 9;
        // Mirror portals route grenades too (doc 06).
        mirrorRoute(p);
        if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx); }
        if (p.x > GAME_SIZE - p.radius) { p.x = GAME_SIZE - p.radius; p.vx = -Math.abs(p.vx); }
        if (p.y < p.radius) { p.y = p.radius; p.vy = Math.abs(p.vy); }
        if (p.y > GAME_SIZE - p.radius) { p.y = GAME_SIZE - p.radius; p.vy = -Math.abs(p.vy); }
        p.fuse -= dt;
        if (p.fuse <= 0 && W && W.explodeGrenade) W.explodeGrenade(p);
        continue;
      }

      if (p.type === 'aq_thrown') {
        p.grace = Math.max(0, (p.grace || 0) - dt);
        if (p.state === 'flight') {
          if (p.weapon === 'STORMBREAKER') {
            const tgt = thrownHomingTarget(p);
            if (tgt) {
              let cur = Math.atan2(p.vy, p.vx);
              const want = Math.atan2(tgt.y - p.y, tgt.x - p.x);
              let dAng = want - cur;
              while (dAng > Math.PI) dAng -= 2 * Math.PI;
              while (dAng < -Math.PI) dAng += 2 * Math.PI;
              const maxTurn = ((CFG.STORMBREAKER && CFG.STORMBREAKER.homingTurnRateRadPerSec) || 2.6) * dt;
              cur += Math.max(-maxTurn, Math.min(maxTurn, dAng));
              const sp = Math.hypot(p.vx, p.vy) || ((CFG.THROWN_MELEE && CFG.THROWN_MELEE.speed && CFG.THROWN_MELEE.speed.STORMBREAKER) || 1350);
              p.vx = Math.cos(cur) * sp;
              p.vy = Math.sin(cur) * sp;
            }
          }
          p.px = p.x; p.py = p.y;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          // Walls: T6 shatters through; others consume ricochet budget.
          const tw = (CRY && CRY.thrownSurface(p)) || sweepThrownWall(p);
          if (tw) {
            const isT6 = p.weapon === 'STORMBREAKER';
            if (tw.crystal) CRY.thrownHit(p, tw);   // real structural damage + ricochet stand-off
            else {
              tw.wall.hp -= isT6 ? ((CFG.WEAPONS.STORMBREAKER && CFG.WEAPONS.STORMBREAKER.confirmedHitDamage) || 446) : scaledProjectileDamage(p);
              if (isT6) tw.wall.__shatteredBy = 'STORMBREAKER';
            }
            if (!isT6) {
              // Reflect about the wall normal; budget or exit.
              const n = tw.normal;
              const dot = p.vx * n.x + p.vy * n.y;
              p.vx -= 2 * dot * n.x; p.vy -= 2 * dot * n.y;
              if (p.ricochetsLeft <= 0) { thrownExitLocal(p); continue; }
              p.ricochetsLeft -= 1; p.spin *= -1;
            }
          }
          const target = earliestToiBody(p, BULLET_HIT_SCALE, i);
          if (target && p.grace <= 0) {
            const hitR = target.radius * BULLET_HIT_SCALE + p.radius;
            if (pointToSegmentDist(target.x, target.y, p.px, p.py, p.x, p.y) < hitR) {
              const spec = (CFG.WEAPONS && CFG.WEAPONS[p.weapon]) || {};
              if (p.weapon === 'STORMBREAKER') {
                const hit = sweptHit(p.px, p.py, p.x, p.y, target.x, target.y, hitR) || { x: p.x, y: p.y };
                if (CFG.meleeDamage && W && W.aqDamage) {
                  W.aqDamage(target, CFG.meleeDamage('STORMBREAKER'), p.owner, 'STORMBREAKER', {
                    knockback: spec.knockback, stun: spec.stun,
                    shake: spec.shake != null ? spec.shake : 15,
                    hitStop: spec.hitStop != null ? spec.hitStop : 0.08,
                  });
                }
                if (globalScope.APEX_ARSENAL_STORM && globalScope.APEX_ARSENAL_STORM.onImpact) {
                  globalScope.APEX_ARSENAL_STORM.onImpact(hit.x, hit.y, target);
                }
                if (globalScope.avCue) globalScope.avCue('storm_impact', { weapon: 'STORMBREAKER', x: hit.x, y: hit.y });
                if (globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.log) {
                  globalScope.APEX_ARSENAL.log('STORM_IMPACT', `target=${target.name} x=${Math.round(hit.x)} y=${Math.round(hit.y)}`);
                }
                projectiles.splice(i, 1);
                continue;
              }
              p.pinAngle = Math.atan2(p.vy, p.vx);
              if (W && W.aqDamage && CFG.meleeDamage) {
                W.aqDamage(target, CFG.meleeDamage(p.weapon), p.owner, p.weapon, {
                  knockback: spec.knockback, stun: spec.stun, shake: 8, hitStop: 0.05,
                });
              }
              if (globalScope.avCue) globalScope.avCue('melee_hit', { weapon: p.weapon, x: target.x, y: target.y, angle: p.pinAngle });
              p.state = 'pinned';
              p.pinnedTo = target;
              p.pinTimer = CFG.THROWN_MELEE.pinSeconds;
              if (globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.log) {
                globalScope.APEX_ARSENAL.log('THROWN_PIN', `weapon=${p.weapon} target=${target.name} pin=${CFG.THROWN_MELEE.pinSeconds}s`);
              }
              continue;
            }
          }
          let bounced = false;
          if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx); bounced = true; }
          else if (p.x > GAME_SIZE - p.radius) { p.x = GAME_SIZE - p.radius; p.vx = -Math.abs(p.vx); bounced = true; }
          if (p.y < p.radius) { p.y = p.radius; p.vy = Math.abs(p.vy); bounced = true; }
          else if (p.y > GAME_SIZE - p.radius) { p.y = GAME_SIZE - p.radius; p.vy = -Math.abs(p.vy); bounced = true; }
          if (bounced) {
            if (p.ricochetsLeft <= 0) {
              thrownExitLocal(p);
            } else {
              p.ricochetsLeft -= 1;
              p.spin *= -1;
              if (globalScope.avCue) globalScope.avCue('ricochet', { weapon: p.weapon, x: p.x, y: p.y, angle: Math.atan2(p.vy, p.vx) });
              if (globalScope.emitParticles) globalScope.emitParticles(p.x, p.y, '#ffe6a8', 10, 320, 4, 0.3, 'square');
              if (globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.log) {
                globalScope.APEX_ARSENAL.log('THROWN_RICOCHET', `weapon=${p.weapon} left=${p.ricochetsLeft}`);
              }
            }
          }
          if (p.state === 'flight' && p.maxFlight > 0) {
            p.flightTime += dt;
            if (p.flightTime >= p.maxFlight) {
              thrownExitLocal(p);
              if (globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.log) {
                globalScope.APEX_ARSENAL.log('THROWN_MAXFLIGHT', `weapon=${p.weapon} flight=${p.flightTime.toFixed(2)}s`);
              }
            }
          }
        } else if (p.state === 'pinned') {
          const t = p.pinnedTo;
          if (!t || t.hp <= 0) {
            thrownExitLocal(p);
          } else {
            const long = 60;
            const depth = t.radius * 0.55 + long * 0.28;
            p.x = t.x - Math.cos(p.pinAngle) * depth;
            p.y = t.y - Math.sin(p.pinAngle) * depth;
            p.rot = p.pinAngle;
            p.pinTimer -= dt;
            if (p.pinTimer <= 0) thrownExitLocal(p);
          }
        } else {
          p.vy += 1500 * dt;
          p.px = p.x; p.py = p.y;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx) * 0.4; }
          else if (p.x > GAME_SIZE - p.radius) { p.x = GAME_SIZE - p.radius; p.vx = -Math.abs(p.vx) * 0.4; }
          if (p.y > GAME_SIZE - p.radius) { p.y = GAME_SIZE - p.radius; p.vy = -Math.abs(p.vy) * 0.35; p.vx *= 0.7; }
        }
        p.life -= dt;
        if (p.life <= 0 || p.y > GAME_SIZE + 60) { projectiles.splice(i, 1); }
        continue;
      }
    }
  }

  /* -------- projectile pass helpers -------- */
  function scaledProjectileDamage(p) {
    const CFG = globalScope.APEX_ARSENAL_CONFIG;
    let dmg = p.damage;
    if (HR.scaledDamageExport) return HR.scaledDamageExport(dmg, p.weapon, !!p.critical);
    if (CFG && CFG.ARSENAL_DAMAGE_SCALE) dmg *= CFG.ARSENAL_DAMAGE_SCALE;
    return dmg;
  }

  function sweptHit(x0, y0, x1, y1, cx, cy, r) {
    const d = pointToSegmentDist(cx, cy, x0, y0, x1, y1);
    if (d >= r) return null;
    // Approximate contact point: closest point on segment.
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((cx - x0) * dx + (cy - y0) * dy) / len2;
    t = clamp(t, 0, 1);
    return { x: x0 + t * dx, y: y0 + t * dy };
  }

  function wallEndpoints(w) {
    const dx = Math.cos(w.angle), dy = Math.sin(w.angle);
    const hx = (w.len / 2), hy = (w.thickness / 2);
    return {
      ax: w.x - dx * hx, ay: w.y - dy * hx,
      bx: w.x + dx * hx, by: w.y + dy * hy,
      nx: -dy, ny: dx,
    };
  }

  function sweepWalls(p, BULLET_HIT_SCALE) {
    if (!M || !M.world.walls.length) return null;
    let best = null, bestT = 2;
    for (const w of M.world.walls) {
      const e = wallEndpoints(w);
      const d = pointToSegmentDist(p.x, p.y, e.ax, e.ay, e.bx, e.by);
      if (d > p.radius + w.thickness / 2 + 4) continue;
      const toi = segmentCrossT(p.px, p.py, p.x, p.y, e.ax, e.ay, e.bx, e.by, p.radius + w.thickness / 2);
      if (toi != null && toi < bestT) { bestT = toi; best = { wall: w, normal: { x: e.nx, y: e.ny } }; }
    }
    return best;
  }

  function sweepThrownWall(p) {
    if (!M || !M.world.walls.length) return null;
    let best = null, bestT = 2;
    for (const w of M.world.walls) {
      const e = wallEndpoints(w);
      const toi = segmentCrossT(p.px, p.py, p.x, p.y, e.ax, e.ay, e.bx, e.by, p.radius + w.thickness / 2);
      if (toi != null && toi < bestT) { bestT = toi; best = { wall: w, normal: { x: e.nx, y: e.ny } }; }
    }
    return best;
  }

  function segmentCrossT(x0, y0, x1, y1, ax, ay, bx, by, r) {
    // Circle (wall treated as capsule) vs moving point — sample-based
    // deterministic test at 4 sub-segments.
    for (let s = 1; s <= 4; s++) {
      const t = s / 4;
      const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
      if (pointToSegmentDist(px, py, ax, ay, bx, by) <= r) return t;
    }
    return null;
  }

  function graphBlocks(p) {
    if (!M || !M.world.graphs.length) return false;
    if (p.weapon === 'STORMBREAKER') return false; // T6 immune to graph
    for (const g of M.world.graphs) {
      // Parabola opening toward g.angle; sample the curve.
      const cos = Math.cos(g.angle), sin = Math.sin(g.angle);
      for (let k = -10; k <= 10; k++) {
        const u = (k / 10) * (g.span / 2);
        const v = Math.pow(Math.abs(u) / (g.span / 2), 2) * g.height;
        const gx = g.x + cos * v - sin * u;
        const gy = g.y + sin * v + cos * u;
        if (pointToSegmentDist(gx, gy, p.px, p.py, p.x, p.y) <= p.radius + 12) return true;
      }
    }
    return false;
  }

  function gateTransform(p) {
    if (!M || !M.world.gates.length) return;
    if (p.weapon === 'STORMBREAKER') return; // T6 unaffected
    for (const g of M.world.gates) {
      if (p.__hr && p.__hr.gatedIds && p.__hr.gatedIds.includes(g.id)) continue;
      if (dist(p.x, p.y, g.x, g.y) > g.radius + p.radius) continue;
      const ownerCt = g.owner;
      const shooterCt = combatantOfBody(p.owner);
      (p.__hr = p.__hr || {}).gatedIds = [...(p.__hr.gatedIds || []), g.id];
      if (g.kind === 'x2' && shooterCt === ownerCt) {
        // Duplicate: 2 projectiles, each 100% normal damage (Lv1).
        const clone = { ...p, px: p.x, py: p.y, __hr: { ...p.__hr, gatedIds: [...p.__hr.gatedIds] } };
        const sep = 0.08; // tuning-slot separation angle
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const cur = Math.atan2(p.vy, p.vx);
        p.vx = Math.cos(cur + sep) * sp; p.vy = Math.sin(cur + sep) * sp;
        clone.vx = Math.cos(cur - sep) * sp; clone.vy = Math.sin(cur - sep) * sp;
        globalScope.projectiles.push(clone);
        AIL.bus.emit('GateDuplicate', { gate: g.id });
      } else if (g.kind === 'div2' && shooterCt && shooterCt !== ownerCt) {
        p.damage *= 0.5;
        p.radius = Math.max(3, p.radius * 0.5);
        AIL.bus.emit('GateDivide', { gate: g.id });
      }
    }
  }

  function singularityStore(p) {
    if (!M || !M.world.singularities.length) return false;
    if (p.weapon === 'STORMBREAKER') return false; // T6 immune
    for (const s of M.world.singularities) {
      if (s.stored.length >= s.capacity) continue;
      if (dist(p.x, p.y, s.x, s.y) > s.radius) continue;
      if (p.__hr && p.__hr.singularityReleased && dist(p.x, p.y, s.x, s.y) < s.radius + 30) continue; // zero-progress release guard
      s.stored.push({
        type: p.type, owner: p.owner, weapon: p.weapon, critical: p.critical,
        family: p.family, heavy: p.heavy, vx: p.vx, vy: p.vy, radius: p.radius,
        damage: p.damage, life: Math.max(0.5, (p.life || 1)), maxLife: p.maxLife,
        knockback: p.knockback, stun: p.stun, color: p.color, rot: p.rot,
        spin: p.spin, ricochetsLeft: p.ricochetsLeft, state: p.state, fuse: p.fuse,
        grace: p.grace, maxFlight: p.maxFlight, tags: p.__hr ? { ...p.__hr } : {},
      });
      AIL.bus.emit('SingularityStored', { weapon: p.weapon, at: s.id });
      // Schedule release after the transit delay (identity/payload kept).
      AIL.hrScheduler.after(s.transitDelay, () => {
        const idx = s.stored.findIndex((d) => d.vx === p.vx && d.vy === p.vy && d.weapon === p.weapon);
        if (idx >= 0) {
          const d = s.stored.splice(idx, 1)[0];
          releaseFromSingularity(s, d);
        }
      }, 'singularity.release');
      return true;
    }
    return false;
  }

  function mirrorRoute(p) {
    if (!M || M.world.mirrors.length < 2) return;
    if (p.weapon === 'STORMBREAKER') return; // T6 immune
    for (const m of M.world.mirrors) {
      if (p.__hr && p.__hr.lastPortalId === m.id) continue; // anti-loop
      if (dist(p.x, p.y, m.x, m.y) > m.radius + (p.radius || 0)) continue;
      // Route to the nearest OTHER mirror (Lv1 routing policy).
      let other = null, bestD = Infinity;
      for (const m2 of M.world.mirrors) {
        if (m2 === m) continue;
        const d = dist(m.x, m.y, m2.x, m2.y);
        if (d < bestD) { bestD = d; other = m2; }
      }
      if (!other) return;
      (p.__hr = p.__hr || {}).lastPortalId = other.id;
      p.__hr.neutral = true; // exiting controller = NEUTRAL
      // Exit along the projectile's incoming travel direction.
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const dx = p.vx / sp, dy = p.vy / sp;
      p.x = other.x + dx * (other.radius + 4);
      p.y = other.y + dy * (other.radius + 4);
      p.px = p.x; p.py = p.y;
      AIL.bus.emit('MirrorPortalRoute', { from: m.id, to: other.id });
      return;
    }
  }

  function earliestToiBody(p, BULLET_HIT_SCALE, index) {
    const r = earliestToiBodyT(p, BULLET_HIT_SCALE);
    return r ? r.body : null;
  }
  function earliestToiBodyT(p, BULLET_HIT_SCALE) {
    if (!M) return null;
    const shooterCt = combatantOfBody(p.owner);
    const neutral = p.__hr && p.__hr.neutral;
    let best = null, bestToi = 2;
    for (const ct of M.combatants) {
      if (!neutral && ct === shooterCt) continue;
      for (const b of livingBodies(ct)) {
        const hitR = b.radius * BULLET_HIT_SCALE + p.radius;
        if (pointToSegmentDist(b.x, b.y, p.px, p.py, p.x, p.y) >= hitR) continue;
        const t = segmentToPointToi(p.px, p.py, p.x, p.y, b.x, b.y, hitR);
        if (t == null) continue;
        if (t < bestToi) { bestToi = t; best = b; }
      }
    }
    return best ? { body: best, t: bestToi } : null;
  }

  function segmentToPointToi(x0, y0, x1, y1, cx, cy, r) {
    const dx = x1 - x0, dy = y1 - y0;
    const fx = x0 - cx, fy = y0 - cy;
    const a = dx * dx + dy * dy;
    const c = fx * fx + fy * fy - r * r;
    if (c <= 0) return 0;
    if (a === 0) return null;
    const b = 2 * (fx * dx + fy * dy);
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    const t = t1 >= 0 ? t1 : (t2 >= 0 ? t2 : -1);
    if (t < 0 || t > 1) return null;
    return t;
  }

  function thrownHomingTarget(p) {
    // STORMBREAKER pursues the owner's LIVING opponent (first other body —
    // parity with base first-found anchor; rework adds earliest living body).
    if (!M) return null;
    const shooterCt = combatantOfBody(p.owner);
    for (const ct of M.combatants) {
      if (ct === shooterCt) continue;
      const bodies = livingBodies(ct);
      if (bodies.length) return bodies[0];
    }
    return null;
  }

  function tryRubberStore(p, target) {
    if (p.weapon === 'STORMBREAKER') return false; // T6 immune
    const ct = combatantOfBody(target);
    if (!ct || ct.facade || ct.heroId !== 'RUBBER') return false;
    const st = ct.store['rubber.compression'];
    if (!st || !st.storeUntil || AIL.clock() >= st.storeUntil) return false;
    const cfg = ct.skills.A2.cfg;
    if ((st.held || []).length >= cfg.capacity) return false;
    st.held = st.held || [];
    st.held.push({
      weapon: p.weapon, critical: p.critical, family: p.family, heavy: p.heavy,
      speed: Math.hypot(p.vx, p.vy), radius: p.radius, damage: p.damage,
      life: Math.max(0.5, p.life || 1), knockback: p.knockback, stun: p.stun,
      color: p.color, tags: p.__hr ? { ...p.__hr } : {},
    });
    AIL.bus.emit('RubberStored', { weapon: p.weapon, held: st.held.length });
    return true;
  }

  function thrownExitLocal(p) {
    p.state = 'exit';
    p.vx *= 0.35;
    p.vy = -140;
    p.spin *= 1.6;
    p.life = Math.min(p.life, 0.75);
  }

  /* Rubber debt settlement on released-projectile despawn: handled in
   * hrPostTick via a life-watch — Lv1 settles on miss/despawn. */
  function settleRubberDebts() {
    if (!M) return;
    const projectiles = globalScope.projectiles;
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!p || !p.__hr || !p.__hr.rubberDebt) continue;
      if (p.life > 0) continue;
      // Despawned without connecting: RUBBER takes the debt.
      for (const ct of M.combatants) {
        if (ct.heroId === 'RUBBER' && !ct.facade) {
          const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
          if (W && W.aqDamage && ct.anchor && ct.anchor.hp > 0) {
            W.aqDamage(ct.anchor, p.__hr.rubberDebt, null, 'RUBBER_DEBT', { statusDamage: true });
            AIL.bus.emit('RubberDebtPaid', { amount: p.__hr.rubberDebt });
          }
          p.__hr.rubberDebt = null;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Entry/exit wrapping + step wrapping + draw wrapping.
   * ------------------------------------------------------------------ */
  function installIntegration() {
    const baseStart = globalScope.startArsenalQuestMode;
    if (baseStart && !baseStart.__hrWrapped) {
      const wrapped = function startArsenalQuestModeHR(p1, p2) {
        const out = baseStart.call(this, p1, p2);
        installMatch();
        return out;
      };
      wrapped.__hrWrapped = true;
      globalScope.startArsenalQuestMode = wrapped;
    }

    const baseExit = globalScope.exitArsenalQuestMode;
    if (baseExit && !baseExit.__hrWrapped) {
      const wrapped = function exitArsenalQuestModeHR() {
        teardownMatch();
        return baseExit.call(this);
      };
      wrapped.__hrWrapped = true;
      globalScope.exitArsenalQuestMode = wrapped;
    }

    const AQ = globalScope.APEX_ARSENAL;
    if (AQ && AQ.step && !AQ.step.__hrWrapped) {
      const baseStep = AQ.step;
      const wrappedStep = function aqStepHR(dt) {
        hrPreTick(dt);
        baseStep(dt);
        hrPostTick(dt);
        settleRubberDebts();
      };
      wrappedStep.__hrWrapped = true;
      AQ.step = wrappedStep;
    }

    // rAF path: global update() (already wrapped by the quest runtime).
    if (typeof globalScope.update === 'function' && !globalScope.update.__hrWrapped) {
      const baseUpdateFn = globalScope.update;
      const wrappedUpdate = function updateHR(dt) {
        if (globalScope.gameState === 'ARSENAL' && M) {
          hrPreTick(dt);
          baseUpdateFn(dt);
          hrPostTick(dt);
          settleRubberDebts();
          return;
        }
        return baseUpdateFn(dt);
      };
      wrappedUpdate.__hrWrapped = true;
      globalScope.update = wrappedUpdate;
    }

    // Projectile pass replacement (keep base for parity delegation).
    const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
    if (W && W.scaledDamage) HR.scaledDamageExport = W.scaledDamage;
    if (W && W.updateArsenalProjectiles && !W.__hrPassSwapped) {
      baseUpdateArsenalProjectiles = W.updateArsenalProjectiles;
      W.updateArsenalProjectiles = function updateArsenalProjectilesHR(dt) {
        if (HR._forceBasePass) return baseUpdateArsenalProjectiles(dt);
        if (!M) return baseUpdateArsenalProjectiles(dt);
        return reworkUpdateProjectiles(dt);
      };
      W.__hrPassSwapped = true;
    }

    // equip wrapper (MATH graph end-on-equipment, telemetry).
    if (W && W.equip && !W.__hrEquipWrapped) {
      const baseEquip = W.equip;
      W.equip = function equipHR(f, weaponId) {
        const out = baseEquip.call(W, f, weaponId);
        if (out) onEquipped(f, weaponId);
        return out;
      };
      W.__hrEquipWrapped = true;
    }

    // Manual skill gate bridge: J -> A1 for rework P1 (gate stays untouched
    // for legacy shells; we only intercept rework fighters).
    const gate = globalScope.APEX_ARSENAL_SKILL_GATE;
    if (gate && gate.pressJ && !gate.pressJ.__hrWrapped) {
      const basePressJ = gate.pressJ;
      gate.pressJ = function pressJHR(f) {
        if (M && HR.isReworkFighter(f)) {
          const res = HR.pressAbility(f, 'A1');
          return res.ok || !!res.failCue;
        }
        return basePressJ.call(gate, f);
      };
      gate.pressJ.__hrWrapped = true;
    }

    // K -> A2 for rework P1 (own listener; quest runtime owns J).
    if (!HR.__keyKInstalled && typeof globalScope.addEventListener === 'function') {
      HR.__keyKInstalled = true;
      globalScope.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyK' || e.repeat) return;
        if (globalScope.gameState !== 'ARSENAL' || !M) return;
        const f = globalScope.fighters && globalScope.fighters[0];
        if (f && HR.isReworkFighter(f)) HR.pressAbility(f, 'A2');
      });
    }

    // Collision observation for anchor pairs (engine still resolves).
    if (typeof globalScope.handleCollisions === 'function' && !globalScope.handleCollisions.__hrWrapped) {
      const baseHC = globalScope.handleCollisions;
      globalScope.handleCollisions = function handleCollisionsHR(dt) {
        try { HR.noteAnchorContacts(); } catch (e) { /* never break physics */ }
        const out = baseHC(dt);
        // Shared geometry authority: solid world material (Crystal constructs,
        // legacy walls) stops EVERY body however it moved this step.
        resolveWorldWalls();
        return out;
      };
      globalScope.handleCollisions.__hrWrapped = true;
    }

    // World + child-body drawing (temporary neutral visuals, flagged).
    if (typeof globalScope.drawProjectiles === 'function' && !globalScope.drawProjectiles.__hrWrapped) {
      const baseDP = globalScope.drawProjectiles;
      globalScope.drawProjectiles = function drawProjectilesHR(c) {
        baseDP(c);
        try { drawReworkWorld(c); } catch (e) { /* visuals never break draw */ }
      };
      globalScope.drawProjectiles.__hrWrapped = true;
    }

    installDamageAdapter();
    AIL.hrScheduler = new AIL.Scheduler(() => globalScope.matchClock || 0);
    AIL.bindClock(() => globalScope.matchClock || 0);
    installFrostProductCopy();
  }

  // FROST V1 (authority §1): shop/hub/draw/pick product copy shows FROST.
  // Implemented as wrappers on EXPOSED meta entry points plus a scoped DOM
  // text patch — the G07-pinned meta file is never edited. Storage ids,
  // data attributes and selection logic are untouched (text nodes only).
  const FROST_COPY_SELECTORS = [
    '.aq-fighter-name', '#aq-shop-detail h2', '.aq-sel',
    '.aq-wheel-label', '#roster-grid .f-name', '.aq-draw-result strong',
  ];
  function patchFrostProductCopy(root) {
    try {
      if (!REG || !REG.displayNameFor || REG.productCutover === false) return 0;
      const scope = root || (typeof document !== 'undefined' ? document : null);
      if (!scope || !scope.querySelectorAll) return 0;
      let patched = 0;
      for (const sel of FROST_COPY_SELECTORS) {
        const nodes = scope.querySelectorAll(sel);
        for (const el of nodes) {
          if (el.textContent === 'ICE') { el.textContent = 'FROST'; patched += 1; }
        }
      }
      return patched;
    } catch (e) { return 0; }
  }
  HR.patchFrostProductCopy = patchFrostProductCopy;
  function installFrostProductCopy() {
    if (HR.__frostCopyInstalled) return;
    HR.__frostCopyInstalled = true;
    try {
      const META = globalScope.APEX_ARSENAL_META;
      if (META) {
        for (const key of ['paintShop', 'paintDraw', 'openHub', 'paintHub']) {
          const base = META[key];
          if (typeof base === 'function' && !base.__frostCopyWrapped) {
            const wrapped = function (...args) {
              const out = base.apply(META, args);
              patchFrostProductCopy();
              return out;
            };
            wrapped.__frostCopyWrapped = true;
            META[key] = wrapped;
          }
        }
      }
      // The pick select-title is click-driven (engine selectFighter); keep
      // it mapped with a mutation observer scoped to that one node.
      if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
        const title = document.getElementById('select-title');
        if (title && !title.__frostCopyObserved) {
          title.__frostCopyObserved = true;
          const mapTitle = () => {
            try {
              if (!REG || !REG.displayNameFor || REG.productCutover === false) return;
              const t = title.textContent;
              if (t && t.indexOf('ICE') >= 0) {
                const mapped = t.replace(/\bICE\b/g, 'FROST');
                if (mapped !== t) title.textContent = mapped;
              }
            } catch (e) { /* copy never breaks selection */ }
          };
          new MutationObserver(mapTitle).observe(title, { characterData: true, childList: true, subtree: true });
          mapTitle();
        }
      }
    } catch (e) { /* copy integration never breaks boot */ }
  }

  /* ------------------------------------------------------------------ *
   * Temporary neutral world visuals (NOT owner visual direction).
   * ------------------------------------------------------------------ */
  function drawReworkWorld(c) {
    if (!M) return;
    const w = M.world;
    c.save();
    // Walls
    for (const wall of w.walls) {
      const e = wallEndpoints(wall);
      c.strokeStyle = '#9fd8ff';
      c.lineWidth = wall.thickness;
      c.globalAlpha = 0.85;
      c.beginPath(); c.moveTo(e.ax, e.ay); c.lineTo(e.bx, e.by); c.stroke();
      c.globalAlpha = 1;
    }
    // Gates
    for (const g of w.gates) {
      c.strokeStyle = g.kind === 'x2' ? '#ffd24a' : '#ff7a7a';
      c.lineWidth = 4;
      c.setLineDash([10, 8]);
      c.beginPath(); c.arc(g.x, g.y, g.radius, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
      c.fillStyle = c.strokeStyle;
      c.font = '900 20px monospace';
      c.textAlign = 'center';
      c.fillText(g.kind === 'x2' ? 'x2' : '÷2', g.x, g.y + 7);
    }
    // Singularities
    for (const s of w.singularities) {
      c.fillStyle = 'rgba(30,10,50,0.75)';
      c.beginPath(); c.arc(s.x, s.y, s.radius * 0.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#b98aff';
      c.lineWidth = 3;
      c.beginPath(); c.arc(s.x, s.y, s.radius, 0, Math.PI * 2); c.stroke();
    }
    // Lanes
    for (const l of w.lanes) {
      if (l.windupLeft > 0) continue;
      c.strokeStyle = 'rgba(140,220,255,0.8)';
      c.lineWidth = l.width;
      c.globalAlpha = 0.35;
      c.beginPath();
      c.moveTo(l.x, l.y);
      c.lineTo(l.x - Math.cos(l.angle) * 160, l.y - Math.sin(l.angle) * 160);
      c.stroke();
      c.globalAlpha = 1;
    }
    // Snares
    for (const s of w.snares.filter(s=>s.owner.heroId!=='HUNTER')) {
      c.strokeStyle = '#c8a24a';
      c.lineWidth = 3;
      c.beginPath(); c.arc(s.x, s.y, s.radius, 0, Math.PI * 2); c.stroke();
    }
    // Graph
    for (const g of w.graphs) {
      c.strokeStyle = '#7affc8';
      c.lineWidth = 5;
      c.beginPath();
      const cos = Math.cos(g.angle), sin = Math.sin(g.angle);
      for (let k = -10; k <= 10; k++) {
        const u = (k / 10) * (g.span / 2);
        const v = 0.0009 * u * u * 10;
        const gx = g.x + cos * v - sin * u;
        const gy = g.y + sin * v + cos * u;
        if (k === -10) c.moveTo(gx, gy); else c.lineTo(gx, gy);
      }
      c.stroke();
    }
    // Shards + mirrors
    c.fillStyle = '#cfe8ff';
    for (const s of w.shards) {
      c.globalAlpha = 0.8;
      c.beginPath(); c.arc(s.x, s.y, 7, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    for (const m of w.mirrors) {
      c.strokeStyle = '#cfe8ff';
      c.lineWidth = 4;
      c.beginPath(); c.arc(m.x, m.y, m.radius, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.18;
      c.fillStyle = '#cfe8ff';
      c.fill();
      c.globalAlpha = 1;
    }
    // SLIME child bodies + promoted anchors (not in fighters[] — the
    // engine never draws them). The CURRENT fighters[] anchor is drawn by
    // the engine and skipped here.
    for (const ct of M.combatants) {
      const arr = globalScope.fighters;
      const engineDrawsAnchor = !!(arr && arr[ct.idx] === ct.anchor);
      for (const b of ct.bodies) {
        if (!b || b.hp <= 0) continue;
        if (b === ct.anchor && engineDrawsAnchor) continue;
        if (typeof b.draw === 'function') b.draw(c);
      }
    }
    // Body-local HP readability (doc 14 R3 — TEMPORARY functional combat
    // readability for owner playtesting, NOT final art). When a combatant
    // has more than one living Body, a small local HP bar + count follows
    // EACH living Body (anchor and children). The top HUD stays
    // Combatant-total HP (HR.bodyHudHp). Single-body combatants draw
    // nothing here (no duplicate UI).
    for (const ct of M.combatants) {
      const living = livingBodies(ct);
      if (living.length <= 1) continue;
      for (const b of living) {
        const pool = b.__hrRefHp || b.maxHp || 1;
        const frac = Math.max(0, Math.min(1, (b.hp || 0) / pool));
        const r = b.radius || 45;
        const w = r * 1.4, hh = 5;
        const x = b.x - w / 2, y = b.y - r - 18;
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(x - 1, y - 1, w + 2, hh + 2);
        c.fillStyle = frac > 0.5 ? '#66ff8a' : frac > 0.25 ? '#ffd24a' : '#ff5a4a';
        c.fillRect(x, y, w * frac, hh);
        c.fillStyle = '#eafff0';
        c.font = '700 10px monospace';
        c.textAlign = 'center';
        c.fillText(String(Math.max(0, Math.ceil(b.hp || 0))), b.x, y - 3);
      }
    }
    // TIME ghost markers (information-only, faint).
    for (const ct of M.combatants) {
      const st = ct.store['time.timeline_markers'];
      if (!st || !st.history || !st.history.length) continue;
      const now = AIL.clock();
      for (const h of (ct.skills.PASSIVE.cfg.markerHorizons || [1, 2])) {
        const want = now - h;
        let rec = null;
        for (const r of st.history) if (r.t <= want) rec = r;
        if (!rec) continue;
        c.globalAlpha = 0.16;
        c.fillStyle = ct.anchor.color || '#ffffff';
        c.beginPath(); c.arc(rec.x, rec.y, (ct.anchor.radius || 75) * 0.9, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      }
    }
    c.restore();
  }

  /* ------------------------------------------------------------------ *
   * Public inspection/test API.
   * ------------------------------------------------------------------ */
  HR.AIL = AIL;
  HR.REGISTRY = REG;
  HR.MECHANICS = MECH;
  HR.validateRegistry = () => REG.validateRegistry();
  HR.setSkillLevel = function (ct, slot, level) {
    if (!ct || ct.facade || !ct.skills[slot]) return false;
    const s = ct.skills[slot];
    s.level = clamp(level | 0, 1, 5);
    s.cfg = REG.resolveSkillLevel(ct.heroId, slot, s.level);
    return true;
  };
  // Read-only HUD projection of the executor's match-owned state. No HUD counter.
  HR.robotPassiveHud = function (f) {
    const ct = combatantOfBody(f);
    if (!ct || ct.heroId !== 'ROBOT') return null;
    const st = ct.store['robot.damage_milestones'] || {};
    const cfg = ct.skills.PASSIVE.cfg;
    const now = AIL.clock();
    const active = !!st.burstDeadline && now <= st.burstDeadline;
    const burst = active ? (st.burst || 0) : 0;
    const nextM = active ? (st.next || 1) : 1;
    const first = cfg.firstThreshold ?? 150, step = cfg.thresholdStep ?? 50;
    const next = first + (nextM - 1) * step;
    const previous = nextM > 1 ? first + (nextM - 2) * step : 0;
    return { reached: active ? nextM - 1 : 0, burst, next, active,
      fraction: clamp((burst - previous) / (next - previous), 0, 1),
      crossing: st.crossedAt != null && now - st.crossedAt < 0.8,
      refund: st.lastRefund && now - st.lastRefund.at < 1.8 ? { ...st.lastRefund } : null };
  };
  HR.skillHud = function (f) {
    const ct = combatantOfBody(f);
    if (!ct || ct.facade) return [];
    const lines = [];
    const ctl = abilityController(ct);
    // FROST V1 (authority §1): HUD product copy shows the display identity.
    const REG = globalScope.APEX_HERO_REWORK_REGISTRY;
    const heroLabel = (REG && REG.displayNameFor) ? REG.displayNameFor(ct.heroId) : ct.heroId;
    for (const slot of ['A1', 'A2']) {
      const key = slot === 'A1' ? 'J' : 'K';
      const cd = ctl.cooldownLeft(slot);
      const skill=ct.skills[slot];
      if(skill.cfg.maxCharges){lines.push(`${key} · HUNTER.a1 ${skill.charges}/${skill.cfg.maxCharges}${skill.rechargeLeft>0 ? ' +1 '+skill.rechargeLeft.toFixed(1)+'s' : ''}`);continue;}
      lines.push(`${key} · ${heroLabel}.${slot.toLowerCase()} ${cd > 0.05 ? cd.toFixed(1) + 's' : 'READY'}`);
    }
    return lines;
  };
  HR.invariants = function () {
    const errors = [];
    const fighters = globalScope.fighters;
    if (!M) return { ok: true, errors, note: 'no rework match' };
    if (!fighters || fighters.length !== 2) errors.push('fighters[] must hold exactly 2 anchors');
    for (const ct of M.combatants) {
      if (ct.bodies.filter((b) => b && fighters.includes(b)).length > 1) {
        errors.push(`${ct.heroId}: more than one body in global fighters[] (doc-06 law)`);
      }
      // The fighters[] slot holds either a living body of this combatant or
      // the neutralized retired anchor (post SLIME anchor promotion — the
      // doc-06 law keeps child Bodies out of the array).
      if (fighters && !ct.bodies.includes(fighters[ct.idx])
        && !(fighters[ct.idx] && fighters[ct.idx].data && fighters[ct.idx].data.__hrRetiredAnchor)) {
        errors.push(`${ct.heroId}: fighters[${ct.idx}] is neither a living body nor the retired anchor`);
      }
      // SLIME HP conservation: pool = anchor.hp + sum(other bodies).
      let total = 0;
      for (const b of livingBodies(ct)) total += b.hp;
      if (total > (CFG_MATCH_HP() || 1000) + 1e-6) {
        errors.push(`${ct.heroId}: living HP total ${total.toFixed(1)} exceeds max-HP budget`);
      }
    }
    // T6 never stored/reflected/ported.
    for (const s of M.world.singularities) {
      for (const d of s.stored) if (d.weapon === 'STORMBREAKER') errors.push('T6 stored in singularity (law violation)');
    }
    const projectiles = globalScope.projectiles || [];
    for (const p of projectiles) {
      if (p && p.weapon === 'STORMBREAKER' && p.__hr && (p.__hr.neutral || p.__hr.lastPortalId || p.__hr.lastReflect || p.__hr.crystalReflected)) {
        errors.push('T6 flagged as manipulated (law violation)');
      }
    }
    return { ok: errors.length === 0, errors };
  };
  function CFG_MATCH_HP() {
    const CFG = globalScope.APEX_ARSENAL_CONFIG;
    return CFG && CFG.MATCH_HP;
  }
  HR.debugState = function () {
    if (!M) return { active: false };
    return {
      active: true,
      aiEnabled: !!M.aiEnabled && HR.aiEnabled,
      combatants: M.combatants.map((ct) => ({
        heroId: ct.heroId, facade: !!ct.facade, idx: ct.idx,
        bodies: livingBodies(ct).map((b) => ({ id: b.id, hp: Math.round(b.hp * 10) / 10, x: Math.round(b.x), y: Math.round(b.y) })),
        skills: ct.facade ? {} : {
          A1: { cd: +abilityController(ct).cooldownLeft('A1').toFixed(2), level: ct.skills.A1.level },
          A2: { cd: +abilityController(ct).cooldownLeft('A2').toFixed(2), level: ct.skills.A2.level },
        },
        telemetry: ct.telemetry,
      })),
      world: {
        walls: M.world.walls.length, gates: M.world.gates.length,
        singularities: M.world.singularities.length, lanes: M.world.lanes.length,
        snares: M.world.snares.length, graphs: M.world.graphs.length,
        mirrors: M.world.mirrors.length, shards: M.world.shards.length,
      },
      events: AIL.bus.ring.slice(-30).map((e) => `${e.type}#${e.seq}`),
    };
  };

  // Boot.
  installIntegration();
})(typeof window !== 'undefined' ? window : globalThis);
