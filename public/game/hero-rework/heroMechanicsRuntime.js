/* =============================================================================
 * APEX CHAOS — Hero Rework mechanic executors (36 skills, canonical 12).
 *
 * Each executor implements ONE mechanicId from the registry. Executors own
 * behavior; the registry owns selection/configuration. There is no generic
 * interpreter and no heroId switch — dispatch is by mechanicId table only.
 *
 * Authority: docs/hero-rework/phase1/02 (Lv1 numbers), 03 (contract),
 *            06 (roster/SLIME-body corrections).
 *
 * The integration runtime (heroReworkRuntime.js) provides `ctx.api`:
 *   combat: enemyOf/enemyBodies/ownBodies/allBodies/aqDamageBody
 *   status: applyChillTo/applyWeakTo/applyRootTo/applyFreezeTo
 *   world:  spawnWall/spawnGate/spawnSingularity/spawnLane/spawnSnare/
 *           spawnGraph/spawnMirrorPortal/spawnShards/spawnSlimeChild/
 *           mergeSlimeChild/relocate/dropWeaponSlot
 *   query:  revealedPickups/heldWeapon/grantWeaponCopy/aimAngleToEnemy/
 *           bodyVelocity
 *   time:   after/cancel, clock, rng
 *   meta:   note/emitEvent, isT6Weapon, gameSize
 *
 * Executor hooks (all optional except where noted):
 *   canCast(ctx)            -> false = fail-cue, cooldown NOT consumed
 *   cast(ctx)               -> required for ACTIVE; false = whiff (no cd)
 *   onTick(ctx, dt)
 *   onTakeDamage(ctx, body, packet) -> packet|null (transform incoming)
 *   onRealizedDamage(ctx, ev)        // ev.creditedTo === ctx.combatant = dealt
 *   onProjectileFired(ctx, p, descriptor)
 *   onBodyCollision(ctx, myBody, otherBody, impulse)
 *   onEquipOffensive(ctx, weaponId)  // MATH graph end-on-equipment law
 *   onTeardown(ctx)
 * ========================================================================== */

(function (globalScope) {
  'use strict';

  if (globalScope.APEX_HERO_REWORK_MECHANICS) return; // idempotent

  const AIL = globalScope.APEX_HERO_REWORK_AIL;
  if (!AIL) throw new Error('heroMechanicsRuntime requires ailRuntime.js');

  const { CapabilityAuthority: CAP } = AIL;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
  function turnToward(cur, want, maxRad) {
    let d = want - cur;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return cur + clamp(d, -maxRad, maxRad);
  }

  /* ==================================================================== *
   * Executor table — keyed by mechanicId.
   * ==================================================================== */
  const EXECUTORS = {};

  /* -------------------------------------------------------------------- *
   * 1. ROBOT
   * -------------------------------------------------------------------- */

  EXECUTORS['robot.weapon_dash'] = {
    canCast(ctx) {
      const pick = ctx.api.nearestRevealedPickup(ctx.combatant, { excludeT6: true });
      return !!pick; // no eligible pickup -> fail-cue, cooldown untouched
    },
    cast(ctx) {
      const pick = ctx.api.nearestRevealedPickup(ctx.combatant, { excludeT6: true });
      if (!pick) return false;
      const a = ctx.combatant.anchor;
      ctx.store.dash = {
        targetSlotId: pick.slot && pick.slot.id,
        heading: angleTo(a.x, a.y, pick.x, pick.y),
        elapsed: 0,
      };
      ctx.api.note('robot.weapon_dash', 'cast', { target: pick.weaponId });
      return true;
    },
    onTick(ctx, dt) {
      const d = ctx.store.dash;
      if (!d) return;
      const a = ctx.combatant.anchor;
      const cfg = ctx.cfg;
      d.elapsed += dt;
      // Re-resolve the live slot each tick (it may be collected/removed).
      const slot = ctx.api.revealedSlotById(d.targetSlotId);
      if (!slot) { ctx.store.dash = null; return; }
      d.heading = turnToward(d.heading, angleTo(a.x, a.y, slot.x, slot.y), cfg.turnRate * dt);
      // Manual integration at dashSpeed; engine movement suppressed this tick.
      a.setDir(Math.cos(d.heading), Math.sin(d.heading));
      a.data.positionLocked = true;
      a.x += Math.cos(d.heading) * cfg.dashSpeed * dt;
      a.y += Math.sin(d.heading) * cfg.dashSpeed * dt;
      const arrived = dist(a.x, a.y, slot.x, slot.y) <= (cfg.arriveRadius || 34);
      if (arrived || d.elapsed >= (cfg.maxDashTime || 0.55)) {
        ctx.store.dash = null;
        ctx.api.note('robot.weapon_dash', arrived ? 'arrived' : 'timeout', { elapsed: d.elapsed });
      }
    },
    onTeardown(ctx) { ctx.store.dash = null; },
  };

  EXECUTORS['robot.virtual_armor'] = {
    cast(ctx) {
      ctx.store.armorUntil = ctx.clock() + ctx.cfg.duration;
      ctx.api.emitEvent('HeroArmorUp', { hero: 'ROBOT', duration: ctx.cfg.duration });
      ctx.api.note('robot.virtual_armor', 'cast', { duration: ctx.cfg.duration });
      return true;
    },
    onTakeDamage(ctx, body, packet) {
      if (!ctx.store.armorUntil || ctx.clock() >= ctx.store.armorUntil) return packet;
      if (body !== ctx.combatant.anchor && !ctx.api.ownsBody(ctx.combatant, body)) return packet;
      const out = { ...packet, amount: packet.amount * ctx.cfg.incomingMult };
      ctx.api.note('robot.virtual_armor', 'absorb', { from: packet.amount, to: out.amount });
      return out;
    },
    onTeardown(ctx) { ctx.store.armorUntil = 0; },
  };

  EXECUTORS['robot.damage_milestones'] = {
    // Lv1 ladder: [no refund, 0.5s, 1.0s, 1.5s], then +0.5s each.
    // Milestone thresholds: every 250 cumulative credited realized damage
    // (provisional tuning slot — no pre-existing visible ladder exists in
    // the 02709c1 engine build; documented here per doc-02 instruction).
    onRealizedDamage(ctx, ev) {
      if (ev.creditedTo !== ctx.combatant) return; // only credited damage dealt
      const st = ctx.store;
      st.cumulative = (st.cumulative || 0) + ev.amount;
      const MILESTONE_STEP = 250;
      const milestone = Math.floor(st.cumulative / MILESTONE_STEP);
      st.reached = st.reached || 0;
      while (st.reached < milestone) {
        st.reached += 1;
        const m = st.reached; // milestone #
        const refunds = ctx.cfg.milestoneRefundsSec || [0, 0.5, 1.0, 1.5];
        const refund = m <= refunds.length
          ? refunds[m - 1]
          : refunds[refunds.length - 1] + (m - refunds.length) * (ctx.cfg.stepAfterLadder || 0.5);
        if (refund > 0) {
          // Refund the currently relevant Active: A1 if cooling, else A2.
          const ctl = ctx.api.abilityController(ctx.combatant);
          const target = (ctl && ctl.cooldownLeft('A1') > 0) ? 'A1'
            : (ctl && ctl.cooldownLeft('A2') > 0) ? 'A2' : null;
          if (target && ctl) {
            ctl.refundCooldown(target, refund);
            ctx.api.emitEvent('MilestoneRefund', { hero: 'ROBOT', milestone: m, slot: target, refund });
            ctx.api.note('robot.damage_milestones', 'refund', { milestone: m, slot: target, refund, cumulative: st.cumulative });
          } else {
            ctx.api.note('robot.damage_milestones', 'milestone', { milestone: m, refund, idle: true, cumulative: st.cumulative });
          }
        }
      }
    },
  };

  /* -------------------------------------------------------------------- *
   * 2. CRYSTAL
   * -------------------------------------------------------------------- */

  EXECUTORS['crystal.wall'] = {
    cast(ctx) {
      const a = ctx.combatant.anchor;
      const enemy = ctx.api.enemyOf(ctx.combatant);
      const ea = enemy && enemy.anchor;
      // Placement (tuning slot): midpoint between caster and enemy anchor,
      // perpendicular to the line between them.
      const mx = ea ? (a.x + ea.x) / 2 : a.x;
      const my = ea ? (a.y + ea.y) / 2 : a.y;
      const ang = ea ? angleTo(a.x, a.y, ea.x, ea.y) : a.dir.x >= 0 ? 0 : Math.PI;
      const wall = ctx.api.spawnWall({
        owner: ctx.combatant, x: mx, y: my, angle: ang + Math.PI / 2,
        len: ctx.cfg.width, hp: ctx.cfg.wallHp, lifetime: ctx.cfg.lifetime,
      });
      ctx.api.note('crystal.wall', 'cast', { wallId: wall.id, hp: wall.hp });
      return true;
    },
  };

  EXECUTORS['crystal.prison'] = {
    cast(ctx) {
      const enemy = ctx.api.enemyOf(ctx.combatant);
      const ea = enemy && enemy.anchor;
      if (!ea) return false;
      const R = ctx.cfg.cageRadius;
      for (let i = 0; i < ctx.cfg.walls; i++) {
        const ang = (i / ctx.cfg.walls) * Math.PI * 2;
        const wx = ea.x + Math.cos(ang) * R;
        const wy = ea.y + Math.sin(ang) * R;
        ctx.api.spawnWall({
          owner: ctx.combatant, x: wx, y: wy, angle: ang + Math.PI / 2,
          len: 2 * R * Math.tan(Math.PI / ctx.cfg.walls), hp: ctx.cfg.wallHpPer,
          lifetime: ctx.cfg.maxLifetime,
        });
      }
      ctx.api.note('crystal.prison', 'cast', { around: ea.name, walls: ctx.cfg.walls });
      return true;
    },
  };

  EXECUTORS['crystal.refraction'] = {
    // Reflection itself is executed by the rework projectile pass, which
    // consults this executor's live config through the combatant.
    onTick() {}, // config-only at Lv1; pass reads cfg via api
    onTeardown() {},
  };

  /* -------------------------------------------------------------------- *
   * 3. MAGNET
   * -------------------------------------------------------------------- */

  EXECUTORS['magnet.acquisition'] = {
    cast(ctx) {
      const pick = ctx.api.nearestRevealedPickup(ctx.combatant, { excludeT6: true, weaponsOnly: true });
      if (!pick) return false; // fail-cue, no cooldown consumed
      ctx.store.pullUntil = ctx.clock() + ctx.cfg.maxActiveTime;
      ctx.store.targetSlotId = pick.slot && pick.slot.id;
      ctx.api.note('magnet.acquisition', 'cast', { target: pick.weaponId });
      return true;
    },
    onTick(ctx, dt) {
      if (!ctx.store.pullUntil || ctx.clock() >= ctx.store.pullUntil) { ctx.store.pullUntil = 0; return; }
      // Physical pull on the nearest eligible revealed weapon pickup slot.
      const pick = ctx.api.nearestRevealedPickup(ctx.combatant, { excludeT6: true, weaponsOnly: true, preferSlotId: ctx.store.targetSlotId });
      if (!pick) return;
      const a = ctx.combatant.anchor;
      const ang = angleTo(pick.x, pick.y, a.x, a.y);
      const sp = Math.min(ctx.cfg.maxPulledSpeed, (pick.speed || 0) + ctx.cfg.pullAcceleration * dt);
      pick.speed = sp;
      // Physical slot movement (the opponent may still intercept it).
      pick.slot.x += Math.cos(ang) * sp * dt;
      pick.slot.y += Math.sin(ang) * sp * dt;
      ctx.api.note('magnet.acquisition', 'pull', { weaponId: pick.weaponId, speed: sp });
    },
    onTeardown(ctx) { ctx.store.pullUntil = 0; },
  };

  EXECUTORS['magnet.repulsion_field'] = {
    cast(ctx) {
      ctx.store.fieldUntil = ctx.clock() + ctx.cfg.duration;
      ctx.api.emitEvent('RepulsionField', { hero: 'MAGNET', radius: ctx.cfg.radius, duration: ctx.cfg.duration });
      ctx.api.note('magnet.repulsion_field', 'cast', {});
      return true;
    },
    onTick(ctx, dt) {
      if (!ctx.store.fieldUntil || ctx.clock() >= ctx.store.fieldUntil) { ctx.store.fieldUntil = 0; return; }
      const a = ctx.combatant.anchor;
      const cfg = ctx.cfg;
      // Fighter push (physical; T6 holder is not globally immune — only the
      // T6 projectile itself is unaffected by the field).
      for (const body of ctx.api.enemyBodies(ctx.combatant)) {
        const d = dist(a.x, a.y, body.x, body.y);
        if (d > cfg.radius || d <= 1) continue;
        const ang = angleTo(a.x, a.y, body.x, body.y);
        const falloff = 1 - d / cfg.radius;
        body.applyStatus('push', 0.1, {
          x: Math.cos(ang), y: Math.sin(ang),
          strength: cfg.fighterPushAcceleration * falloff,
        });
      }
      // Projectile radial impulse (T6 unaffected).
      for (const p of ctx.api.liveProjectiles()) {
        if (!p || !p.aq || p.type !== 'aq_bullet') continue;
        if (p.weapon === 'STORMBREAKER') continue;
        const ownerCt = ctx.api.combatantOfBody(p.owner);
        if (ownerCt === ctx.combatant) continue; // own projectiles unaffected
        const d = dist(a.x, a.y, p.x, p.y);
        if (d > cfg.radius || d <= 1) continue;
        const ang = angleTo(a.x, a.y, p.x, p.y);
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const boost = (cfg.projectileRadialImpulse * dt) / sp;
        p.vx += Math.cos(ang) * sp * boost;
        p.vy += Math.sin(ang) * sp * boost;
        p.__hrRepulsed = true;
      }
    },
    onTeardown(ctx) { ctx.store.fieldUntil = 0; },
  };

  EXECUTORS['magnet.acceleration'] = {
    onProjectileFired(ctx, p, descriptor) {
      if (!descriptor || descriptor.kind !== 'bullet') return;
      if (p.weapon === 'STORMBREAKER') return; // T6 unaffected
      // Boost the spec BEFORE the base push (stand-in has no vx/vy).
      descriptor.params.speed *= 1 + ctx.cfg.ownedProjectileVelocityBonus;
      p.__hr.magnetBoosted = true;
    },
  };

  /* -------------------------------------------------------------------- *
   * 4. BLACK_HOLE
   * -------------------------------------------------------------------- */

  EXECUTORS['black_hole.transit'] = {
    cast(ctx) {
      const a = ctx.combatant.anchor;
      const enemy = ctx.api.enemyOf(ctx.combatant);
      const ea = enemy && enemy.anchor;
      const mx = ea ? (a.x + ea.x) / 2 : a.x;
      const my = ea ? (a.y + ea.y) / 2 : a.y;
      ctx.api.spawnSingularity({
        owner: ctx.combatant, x: mx, y: my, radius: 120, // radius = tuning slot
        duration: ctx.cfg.activeDuration, capacity: ctx.cfg.capacity,
        transitDelay: ctx.cfg.transitDelay, exitDistance: ctx.cfg.exitTargetDistance,
      });
      ctx.api.note('black_hole.transit', 'cast', {});
      return true;
    },
  };

  EXECUTORS['black_hole.damage_singularity'] = {
    cast(ctx) {
      ctx.store.escrowUntil = ctx.clock() + ctx.cfg.escrowWindow;
      ctx.store.stored = 0;
      ctx.api.emitEvent('SingularityEscrowOpen', { hero: 'BLACK_HOLE', window: ctx.cfg.escrowWindow });
      ctx.api.note('black_hole.damage_singularity', 'cast', {});
      return true;
    },
    onTakeDamage(ctx, body, packet) {
      if (!ctx.store.escrowUntil) return packet;
      if (ctx.clock() >= ctx.store.escrowUntil) return packet;
      // T6 damage is never captured/escrowed.
      if (packet.weaponId === 'STORMBREAKER') return packet;
      const room = ctx.cfg.storedDamageCap - ctx.store.stored;
      if (room <= 0) return packet;
      const taken = Math.min(room, packet.amount);
      ctx.store.stored += taken;
      const out = { ...packet, amount: packet.amount - taken };
      ctx.api.note('black_hole.damage_singularity', 'escrow', { taken, stored: ctx.store.stored });
      return out; // remainder (if any) still realizes
    },
    onTick(ctx) {
      const st = ctx.store;
      if (!st.escrowUntil) return;
      if (ctx.clock() < st.escrowUntil) return;
      // Window closed: one return event, then vulnerability.
      st.escrowUntil = 0;
      const stored = st.stored || 0;
      st.stored = 0;
      if (stored > 0) {
        const enemy = ctx.api.enemyOf(ctx.combatant);
        const target = enemy && enemy.anchor;
        if (target && target.hp > 0) {
          ctx.api.aqDamageBody(target, stored * ctx.cfg.returnPct, ctx.combatant, 'BLACK_HOLE_SINGULARITY', {
            knockback: 300, shake: 10, hitStop: 0.04,
          });
          ctx.api.emitEvent('SingularityReturn', { hero: 'BLACK_HOLE', returned: stored * ctx.cfg.returnPct });
        }
      }
      st.vulnerableUntil = ctx.clock() + ctx.cfg.vulnerabilityDuration;
      ctx.api.note('black_hole.damage_singularity', 'vulnerable', { duration: ctx.cfg.vulnerabilityDuration });
    },
    onTakeDamageLate(ctx, body, packet) {
      // Vulnerability multiplier (applied after escrow resolution).
      if (!ctx.store.vulnerableUntil || ctx.clock() >= ctx.store.vulnerableUntil) return packet;
      return { ...packet, amount: packet.amount * ctx.cfg.vulnerabilityIncomingMult };
    },
    onTeardown(ctx) { ctx.store.escrowUntil = 0; ctx.store.vulnerableUntil = 0; ctx.store.stored = 0; },
  };

  EXECUTORS['black_hole.event_horizon'] = {
    onRealizedDamage(ctx, ev) {
      if (ev.creditedTo === ctx.combatant) return; // only damage suffered
      if (!ctx.api.ownsBody(ctx.combatant, ev.victimBody)) return;
      const st = ctx.store;
      st.growth = clamp((st.growth || 0) + ev.amount * ctx.cfg.radiusPerHp, 0, ctx.cfg.maxGrowth);
    },
    onTick(ctx) {
      const st = ctx.store;
      const growth = st.growth || 0;
      if (growth <= 0) return;
      const base = ctx.combatant.anchor.baseRadius || 75;
      for (const b of ctx.api.ownBodies(ctx.combatant)) {
        b.radius = Math.min(base + ctx.cfg.maxGrowth, base + growth);
      }
    },
  };

  /* -------------------------------------------------------------------- *
   * 5. MATH_V2
   * -------------------------------------------------------------------- */

  EXECUTORS['math.parabola_graph'] = {
    cast(ctx) {
      const a = ctx.combatant.anchor;
      const enemy = ctx.api.enemyOf(ctx.combatant);
      const ea = enemy && enemy.anchor;
      const ang = ea ? angleTo(a.x, a.y, ea.x, ea.y) : (a.dir.x >= 0 ? 0 : Math.PI);
      ctx.api.spawnGraph({
        owner: ctx.combatant,
        x: a.x + Math.cos(ang) * 240, y: a.y + Math.sin(ang) * 240,
        angle: ang, span: 520, height: 200, // tuning-slot geometry
        lifetime: ctx.cfg.maxLifetime,
        recastReplaces: !!ctx.cfg.recastReplaces,
      });
      ctx.api.note('math.parabola_graph', 'cast', {});
      return true;
    },
    onEquipOffensive(ctx, weaponId) {
      // "ends when MATH picks offensive Arsenal equipment" — heal excluded.
      if (!ctx.cfg.endsOnOffensiveEquipment) return;
      ctx.api.endGraphsOf(ctx.combatant);
      ctx.api.note('math.parabola_graph', 'ended-by-equipment', { weaponId });
    },
  };

  EXECUTORS['math.damage_equation'] = {
    // Counters are always-on; the cast freezes them into a Virtual Armor pool.
    onRealizedDamage(ctx, ev) {
      const st = ctx.store;
      if (st.armed) return; // frozen during the armor window
      if (ev.creditedTo === ctx.combatant) st.mathCounter = (st.mathCounter || 0) + ev.amount;
      else if (ev.creditedTo && ev.creditedTo === ctx.api.enemyOf(ctx.combatant)) st.oppCounter = (st.oppCounter || 0) + ev.amount;
      // neutral damage (MIRROR-neutral) adds to neither.
    },
    cast(ctx) {
      const st = ctx.store;
      const hp = (st.mathCounter || 0) + (st.oppCounter || 0);
      st.armed = { hp, until: ctx.clock() + ctx.cfg.armorDuration, math: st.mathCounter || 0, opp: st.oppCounter || 0 };
      ctx.api.emitEvent('VirtualArmor', { hero: 'MATH_V2', hp, duration: ctx.cfg.armorDuration });
      ctx.api.note('math.damage_equation', 'cast', { hp });
      return true;
    },
    onTakeDamage(ctx, body, packet) {
      const st = ctx.store;
      if (!st.armed || ctx.clock() >= st.armed.until) return packet;
      const pool = st.armed.hp;
      const absorbed = Math.min(pool, packet.amount);
      st.armed.hp = pool - absorbed;
      ctx.api.note('math.damage_equation', 'absorb', { absorbed, poolLeft: st.armed.hp });
      if (st.armed.hp <= 0) st.armed.expired = true;
      return { ...packet, amount: packet.amount - absorbed };
    },
    onBodyCollision(ctx, myBody, otherBody) {
      const st = ctx.store;
      if (!st.armed || ctx.clock() >= st.armed.until) return;
      const otherCt = ctx.api.combatantOfBody(otherBody);
      if (!otherCt || otherCt === ctx.combatant) return;
      // Cash out: the remaining pool is dealt to the opponent in one event.
      const payout = st.armed.hp;
      st.armed = null;
      st.mathCounter = 0;
      st.oppCounter = 0;
      if (payout > 0) {
        ctx.api.aqDamageBody(otherBody, payout, ctx.combatant, 'MATH_EQUATION', { knockback: 420, shake: 8 });
        ctx.api.emitEvent('EquationCashout', { hero: 'MATH_V2', payout });
        ctx.api.note('math.damage_equation', 'cashout', { payout });
      }
      // Armor ending (cashout) produces the /2 gate (multiply/divide law).
      const passiveCfg = ctx.combatant.skills.PASSIVE.cfg;
      ctx.api.spawnGate({ kind: 'div2', owner: ctx.combatant, duration: passiveCfg.gateDuration });
    },
    onTick(ctx) {
      const st = ctx.store;
      if (st.armed && (ctx.clock() >= st.armed.until || st.armed.expired)) {
        // Equation expired/reset before cashout -> counters reset, and the
        // Virtual Armor ending produces the /2 gate (multiply/divide law).
        st.armed = null;
        st.mathCounter = 0;
        st.oppCounter = 0;
        const passiveCfg = ctx.combatant.skills.PASSIVE.cfg;
        ctx.api.spawnGate({ kind: 'div2', owner: ctx.combatant, duration: passiveCfg.gateDuration });
        ctx.api.note('math.damage_equation', 'expired', {});
      }
    },
    onTeardown(ctx) { ctx.store.armed = null; },
  };

  EXECUTORS['math.multiply_divide'] = {
    // Gates are spawned by the integration runtime when the graph/armor
    // lifecycle ends (passive reacts to lifecycle events).
    onGraphEnded(ctx) {
      ctx.api.spawnGate({ kind: 'x2', owner: ctx.combatant, duration: ctx.cfg.gateDuration });
      ctx.api.note('math.multiply_divide', 'gate-x2', {});
    },
    onArmorEnded(ctx) {
      ctx.api.spawnGate({ kind: 'div2', owner: ctx.combatant, duration: ctx.cfg.gateDuration });
      ctx.api.note('math.multiply_divide', 'gate-div2', {});
    },
  };

  /* -------------------------------------------------------------------- *
   * 6. ICE
   * -------------------------------------------------------------------- */

  EXECUTORS['ice.bullets'] = {
    cast(ctx) {
      ctx.store.chillShotsUntil = ctx.clock() + ctx.cfg.duration;
      ctx.api.note('ice.bullets', 'cast', { duration: ctx.cfg.duration });
      return true;
    },
    onProjectileFired(ctx, p, descriptor) {
      if (!ctx.store.chillShotsUntil || ctx.clock() >= ctx.store.chillShotsUntil) return;
      if (!descriptor || descriptor.kind !== 'bullet') return;
      p.__hrChill = true; // applies CHILL on hit (projectile pass)
    },
    onTeardown(ctx) { ctx.store.chillShotsUntil = 0; },
  };

  EXECUTORS['ice.lane'] = {
    cast(ctx) {
      const a = ctx.combatant.anchor;
      const enemy = ctx.api.enemyOf(ctx.combatant);
      const ea = enemy && enemy.anchor;
      const ang = ea ? angleTo(a.x, a.y, ea.x, ea.y) : (a.dir.x >= 0 ? 0 : Math.PI);
      ctx.api.spawnLane({
        owner: ctx.combatant, x: a.x, y: a.y, angle: ang,
        width: ctx.cfg.width, speed: ctx.cfg.speed,
        windup: ctx.cfg.windup,
      });
      ctx.api.note('ice.lane', 'cast', {});
      return true;
    },
  };

  EXECUTORS['ice.deep_freeze'] = {
    onTick(ctx, dt) {
      const st = ctx.store;
      st = st || {};
      for (const body of ctx.api.ownBodies(ctx.combatant)) {
        const chill = ctx.api.chillRemaining(body);
        if (chill > 0) {
          body.__hrChillAccum = (body.__hrChillAccum || 0) + dt;
          if (body.__hrChillAccum >= ctx.cfg.continuousChillThreshold) {
            body.__hrChillAccum = 0; // accumulation resets after Freeze
            ctx.api.applyFreezeTo(body, ctx.cfg.freezeDuration);
            ctx.api.emitEvent('DeepFreeze', { hero: 'ICE', duration: ctx.cfg.freezeDuration });
            ctx.api.note('ice.deep_freeze', 'freeze', {});
          }
        }
        // An isolated Chill shorter than the threshold never freezes on its
        // own — accumulation naturally persists only while Chill is active.
      }
    },
  };

  /* -------------------------------------------------------------------- *
   * 7. RUBBER
   * -------------------------------------------------------------------- */

  EXECUTORS['rubber.elastic_state'] = {
    cast(ctx) {
      ctx.store.windowUntil = ctx.clock() + ctx.cfg.activeWindow;
      ctx.store.energy = ctx.store.energy || 0;
      ctx.api.note('rubber.elastic_state', 'cast', {});
      return true;
    },
    onBodyCollision(ctx, myBody, otherBody, impulse) {
      const st = ctx.store;
      const otherCt = ctx.api.combatantOfBody(otherBody);
      if (!otherCt || otherCt === ctx.combatant) return;
      if (st.windowUntil && ctx.clock() < st.windowUntil) {
        // Energy from actual collision impulse (calibration = tuning slot;
        // impulse here = closing speed in px/s, typical contact 400-900).
        const gained = Math.min(35, impulse / 20);
        st.energy = clamp((st.energy || 0) + gained, 0, ctx.cfg.energyCap);
        ctx.api.note('rubber.elastic_state', 'energy', { gained, energy: st.energy });
      }
      if ((st.energy || 0) >= ctx.cfg.collisionStunThreshold) {
        ctx.api.applyStunTo(otherBody, ctx.cfg.collisionStun);
        ctx.api.emitEvent('ElasticStun', { hero: 'RUBBER', duration: ctx.cfg.collisionStun });
        ctx.api.note('rubber.elastic_state', 'stun', { energy: st.energy });
      }
    },
    onTick(ctx, dt) {
      const st = ctx.store;
      if (!st) return;
      const now = ctx.clock();
      if (st.windowUntil && now >= st.windowUntil) {
        st.windowUntil = 0; // accumulation window over -> decay begins
      }
      if (!st.windowUntil && (st.energy || 0) > 0) {
        st.energy = Math.max(0, st.energy - ctx.cfg.postActiveDecay * dt);
      }
      const energy = st.energy || 0;
      if (energy > 0) {
        const mult = 1 + (energy / ctx.cfg.energyCap) * ctx.cfg.maxSpeedBonusPct;
        for (const b of ctx.api.ownBodies(ctx.combatant)) {
          b.applyStatus('speed', 0.12, { mult });
        }
      }
    },
    onTeardown(ctx) { ctx.store.windowUntil = 0; },
  };

  EXECUTORS['rubber.compression'] = {
    cast(ctx) {
      ctx.store.storeUntil = ctx.clock() + ctx.cfg.duration;
      ctx.store.held = ctx.store.held || [];
      ctx.api.emitEvent('CompressionOpen', { hero: 'RUBBER', duration: ctx.cfg.duration });
      ctx.api.note('rubber.compression', 'cast', {});
      return true;
    },
    // Storage itself happens in the projectile pass (earliest-TOI gate),
    // which calls api.storeProjectileInRubber when an enemy projectile's
    // segment would connect with the RUBBER body.
    onTick(ctx, dt) {
      const st = ctx.store;
      if (!st) return;
      const now = ctx.clock();
      if (st.storeUntil && now >= st.storeUntil) {
        st.storeUntil = 0;
        ctx.api.releaseRubberStored(ctx.combatant); // radial release
      }
      if (!st.storeUntil && !(st.held && st.held.length)) return;
      // Movement-speed loss while holding stored projectiles (floor applies).
      const held = (st.held || []).length;
      if (held > 0) {
        const mult = Math.max(ctx.cfg.speedFloorPct, 1 - held * ctx.cfg.speedLossPerStored);
        for (const b of ctx.api.ownBodies(ctx.combatant)) b.applyStatus('slow', 0.12, { mult });
      }
    },
    onTeardown(ctx) {
      ctx.store.storeUntil = 0;
      ctx.api.releaseRubberStored(ctx.combatant);
    },
  };

  EXECUTORS['rubber.afterbounce'] = {
    onBodyCollision(ctx, myBody, otherBody, impulse) {
      const st = ctx.store;
      const otherCt = ctx.api.combatantOfBody(otherBody);
      if (!otherCt || otherCt === ctx.combatant) return;
      const now = ctx.clock();
      // Re-proc only after separation/new contact.
      if (st.contactUntil && now < st.contactUntil && st.lastPairKey === pairKey(myBody, otherBody)) return;
      st.contactUntil = now + ctx.cfg.duration;
      st.lastPairKey = pairKey(myBody, otherBody);
      // Opponent push impulse (physical).
      const ang = angleTo(myBody.x, myBody.y, otherBody.x, otherBody.y);
      otherBody.applyStatus('push', 0.16, {
        x: Math.cos(ang), y: Math.sin(ang), strength: ctx.cfg.pushImpulse,
      });
      // RUBBER loses 15% current speed preserving direction (Lv1: brief).
      myBody.applyStatus('slow', ctx.cfg.duration, { mult: 1 - ctx.cfg.selfSpeedLossPct });
      ctx.api.note('rubber.afterbounce', 'proc', { impulse });
    },
  };

  function pairKey(a, b) { return `${a.id}:${b.id}`; }

  /* -------------------------------------------------------------------- *
   * 8. HUNTER
   * -------------------------------------------------------------------- */

  EXECUTORS['hunter.snare'] = {
    cast(ctx) {
      const a = ctx.combatant.anchor;
      if (!ctx.api.canPlaceSnare(ctx.combatant, ctx.cfg.maxActiveTraps)) return false;
      ctx.api.spawnSnare({
        owner: ctx.combatant, x: a.x, y: a.y, radius: 46, // radius = tuning slot
        lifetime: ctx.cfg.trapLifetime, rootDuration: ctx.cfg.rootDuration,
      });
      ctx.api.note('hunter.snare', 'cast', {});
      return true;
    },
  };

  EXECUTORS['hunter.pounce_weak'] = {
    cast(ctx) {
      const a = ctx.combatant.anchor;
      const enemy = ctx.api.enemyOf(ctx.combatant);
      const ea = enemy && enemy.anchor;
      if (!ea) return false;
      ctx.store.pounce = {
        windupLeft: ctx.cfg.windup,
        heading: angleTo(a.x, a.y, ea.x, ea.y),
        elapsed: 0,
      };
      ctx.api.note('hunter.pounce_weak', 'cast', {});
      return true;
    },
    onTick(ctx, dt) {
      const p = ctx.store.pounce;
      if (!p) return;
      const a = ctx.combatant.anchor;
      if (p.windupLeft > 0) {
        p.windupLeft -= dt;
        a.data.positionLocked = true; // windup hold
        return;
      }
      p.elapsed += dt;
      a.data.positionLocked = true;
      a.setDir(Math.cos(p.heading), Math.sin(p.heading));
      a.x += Math.cos(p.heading) * ctx.cfg.moveSpeed * dt;
      a.y += Math.sin(p.heading) * ctx.cfg.moveSpeed * dt;
      // Valid body hit applies Weak (combatant-level) and ends the pounce.
      for (const body of ctx.api.enemyBodies(ctx.combatant)) {
        if (dist(a.x, a.y, body.x, body.y) <= a.radius + body.radius) {
          ctx.api.applyWeakTo(ctx.api.combatantOfBody(body), ctx.cfg.weakDuration);
          ctx.api.emitEvent('PounceWeak', { hero: 'HUNTER', target: body.name });
          ctx.api.note('hunter.pounce_weak', 'hit', {});
          ctx.store.pounce = null;
          return;
        }
      }
      if (p.elapsed >= ctx.cfg.maxMoveTime) {
        ctx.store.pounce = null; // can miss
        ctx.api.note('hunter.pounce_weak', 'miss', {});
      }
    },
    onTeardown(ctx) { ctx.store.pounce = null; },
  };

  EXECUTORS['hunter.killer_instinct'] = {
    // Dodge roll happens in the projectile pass (earliest-TOI + lockout);
    // eligibility: this combatant's body is currently ROOTED or WEAK.
    dodgeEligible(ctx, body) {
      if (!ctx.api.ownsBody(ctx.combatant, body)) return false;
      return ctx.api.isTrapped(body) || ctx.api.isWeakBody(body);
    },
  };

  /* -------------------------------------------------------------------- *
   * 9. TIME
   * -------------------------------------------------------------------- */

  EXECUTORS['time.loop'] = {
    onProjectileFired(ctx, p, descriptor) {
      if (!descriptor) return;
      if (p.__hrReplay) return; // replay lineage never re-records
      const whitelist = ctx.cfg.replayWhitelist || [];
      if (!whitelist.includes(descriptor.kind)) return;
      const st = ctx.store;
      st.records = st.records || [];
      st.records.push({
        t: ctx.clock(), kind: descriptor.kind,
        params: descriptor.params, // {x,y,angle,speed,damage,radius,weapon,...}
      });
      // Rolling 2s record window.
      const cutoff = ctx.clock() - ctx.cfg.recordWindow;
      while (st.records.length && st.records[0].t < cutoff) st.records.shift();
    },
    cast(ctx) {
      const st = ctx.store;
      const records = (st.records || []).slice();
      st.records = [];
      const now = ctx.clock();
      for (let loop = 1; loop <= ctx.cfg.loops; loop++) {
        for (const r of records) {
          const at = now + (loop - 1) * ctx.cfg.loopDuration + (r.t - (records.length ? records[0].t : now));
          ctx.api.after(Math.max(0, at - now), () => {
            ctx.api.replayEmission(r.kind, r.params, loop);
          }, `time.loop.replay.${loop}`);
        }
        // Ghost markers for readability (intangible, visual only).
        ctx.api.after((loop - 1) * ctx.cfg.loopDuration, () => {
          ctx.api.emitEvent('TimeLoopGhost', { loop });
        }, 'time.loop.ghost');
      }
      ctx.api.emitEvent('TimeLoop', { hero: 'TIME', loops: ctx.cfg.loops, emissions: records.length });
      ctx.api.note('time.loop', 'cast', { emissions: records.length, loops: ctx.cfg.loops });
      return true;
    },
    onTeardown(ctx) { ctx.store.records = []; },
  };

  EXECUTORS['time.rewind'] = {
    cast(ctx) {
      const a = ctx.combatant.anchor;
      ctx.store.snapshot = {
        hp: a.hp, x: a.x, y: a.y, dir: { ...a.dir },
        takenAt: ctx.clock(),
      };
      ctx.api.after(ctx.cfg.snapshotDelay, () => {
        const s = ctx.store.snapshot;
        ctx.store.snapshot = null;
        if (!s) return;
        const a2 = ctx.combatant.anchor;
        if (!a2 || a2.hp <= 0) return; // no revive; damage already dealt remains
        ctx.api.relocate(a2, s.x, s.y, 'time.rewind');
        a2.hp = Math.min(a2.maxHp, s.hp);
        a2.setDir(s.dir.x, s.dir.y);
        ctx.api.emitEvent('TimeRewind', { hero: 'TIME', hp: s.hp });
        ctx.api.note('time.rewind', 'restored', { hp: s.hp });
      }, 'time.rewind.restore');
      ctx.api.note('time.rewind', 'cast', {});
      return true;
    },
    onTeardown(ctx) { ctx.store.snapshot = null; },
  };

  EXECUTORS['time.timeline_markers'] = {
    onTick(ctx) {
      const st = ctx.store;
      st.history = st.history || [];
      const a = ctx.combatant.anchor;
      st.history.push({ t: ctx.clock(), x: a.x, y: a.y });
      const horizon = Math.max(...(ctx.cfg.markerHorizons || [1, 2]));
      const cutoff = ctx.clock() - horizon - 0.5;
      while (st.history.length && st.history[0].t < cutoff) st.history.shift();
      // Information-only: no gameplay mutation (doc 02).
    },
    onTeardown(ctx) { ctx.store.history = []; },
  };

  /* -------------------------------------------------------------------- *
   * 10. MIRROR
   * -------------------------------------------------------------------- */

  EXECUTORS['mirror.arsenal'] = {
    canCast(ctx) {
      const held = ctx.api.heldWeapon(ctx.api.enemyOf(ctx.combatant));
      if (!held || !held.weaponId) return false;
      if (ctx.api.isT6Weapon(held.weaponId)) return false;      // T6 cannot be copied
      if (held.weaponId === 'SWIRL_SHIELD' || held.weaponId === 'TOWER_SHIELD') return false; // shield excluded
      return true;
    },
    cast(ctx) {
      const held = ctx.api.heldWeapon(ctx.api.enemyOf(ctx.combatant));
      if (!held || !held.weaponId || ctx.api.isT6Weapon(held.weaponId)) return false;
      const ok = ctx.api.grantWeaponCopy(ctx.combatant, held.weaponId, ctx.cfg.copyLifetime);
      ctx.api.note('mirror.arsenal', ok ? 'copy' : 'whiff', { weapon: held.weaponId });
      return true; // cooldown consumed either way (cast happened)
    },
  };

  EXECUTORS['mirror.exchange'] = {
    canCast(ctx) {
      const enemy = ctx.api.enemyOf(ctx.combatant);
      return !!(enemy && enemy.anchor && enemy.anchor.hp > 0);
    },
    cast(ctx) {
      const enemy = ctx.api.enemyOf(ctx.combatant);
      const a = ctx.combatant.anchor;
      const b = enemy.anchor;
      // Telegraph first; the atomic swap happens after the telegraph.
      ctx.api.emitEvent('ExchangeTelegraph', { hero: 'MIRROR', duration: ctx.cfg.telegraph });
      ctx.api.after(ctx.cfg.telegraph, () => {
        if (a.hp <= 0 || b.hp <= 0) return;
        const tx = new AIL.RelocationTransaction(ctx.api.bus);
        tx.move(a, b.x, b.y, 'mirror.exchange');
        tx.move(b, a.x, a.y, 'mirror.exchange');
        tx.commit(); // atomic — each keeps own velocity/HP/weapon/status
        ctx.api.emitEvent('MirrorExchange', { hero: 'MIRROR' });
        ctx.api.note('mirror.exchange', 'swap', {});
      }, 'mirror.exchange.swap');
      return true;
    },
  };

  EXECUTORS['mirror.shattered_mirrors'] = {
    onRealizedDamage(ctx, ev) {
      // Shards from realized damage suffered by MIRROR bodies.
      if (ev.creditedTo === ctx.combatant) return;
      if (!ctx.api.ownsBody(ctx.combatant, ev.victimBody)) return;
      const amount = ev.amount;
      let n = 0;
      if (amount >= ctx.cfg.minEventDamage) n = clamp(Math.round(amount / ctx.cfg.damagePerShard), 1, ctx.cfg.maxShardsPerEvent);
      if (n <= 0) return;
      ctx.api.spawnShards(ctx.combatant, ev.victimBody.x, ev.victimBody.y, n);
      ctx.api.note('mirror.shattered_mirrors', 'shards', { n, amount });
    },
  };

  /* -------------------------------------------------------------------- *
   * 11. SLIME — one Combatant, multiple Bodies. Children live in AIL body
   * collections attached to the combatant, NEVER in the global fighters[]
   * (doc-06 correction). Anchor promotion keeps exactly one slot per side.
   * -------------------------------------------------------------------- */

  EXECUTORS['slime.mitosis'] = {
    canCast(ctx) {
      const bodies = ctx.api.ownBodies(ctx.combatant);
      if (bodies.length !== 1) return false; // already split
      const a = ctx.combatant.anchor;
      if (a.hp < 2 * ctx.cfg.splitInto) return false; // need enough HP to divide
      return true;
    },
    cast(ctx) {
      const a = ctx.combatant.anchor;
      const half = a.hp / 2;
      a.hp = half;
      // Area-conserving radii: two bodies of r/sqrt(2) conserve area.
      const r = a.baseRadius || a.radius;
      const newR = r / Math.SQRT2;
      a.radius = newR;
      const child = ctx.api.spawnSlimeChild(ctx.combatant, {
        hp: half, radius: newR, x: a.x + 12, y: a.y + 8,
        kind: 'mitosis', lifetime: ctx.cfg.splitDuration,
      });
      // Initial divergence: +/- 25 (tuning slot) along perpendicular axes.
      const ang = Math.random() * Math.PI * 2;
      child.setDir(Math.cos(ang + Math.PI / 2), Math.sin(ang + Math.PI / 2));
      a.setDir(Math.cos(ang - Math.PI / 2), Math.sin(ang - Math.PI / 2));
      ctx.store.mergeAt = ctx.clock() + ctx.cfg.splitDuration;
      ctx.store.pendingMergeId = child.id;
      ctx.api.emitEvent('SlimeMitosis', { hero: 'SLIME', hpEach: half });
      ctx.api.note('slime.mitosis', 'split', { hpEach: half });
      return true;
    },
    onTick(ctx) {
      const st = ctx.store;
      if (!st.mergeAt) return;
      if (ctx.clock() < st.mergeAt) return;
      st.mergeAt = 0;
      ctx.api.mergeSlimeChild(ctx.combatant, st.pendingMergeId, { dropWeapon: true });
      ctx.api.note('slime.mitosis', 'merge', {});
    },
    onTeardown(ctx) { ctx.store.mergeAt = 0; },
  };

  EXECUTORS['slime.damage_shedding'] = {
    cast(ctx) {
      ctx.store.shedUntil = ctx.clock() + ctx.cfg.duration;
      ctx.store.progress = ctx.store.progress || 0;
      ctx.api.note('slime.damage_shedding', 'cast', {});
      return true;
    },
    onRealizedDamage(ctx, ev) {
      const st = ctx.store;
      if (!st.shedUntil || ctx.clock() >= st.shedUntil) return;
      if (ev.creditedTo === ctx.combatant) return; // damage suffered only
      if (!ctx.api.ownsBody(ctx.combatant, ev.victimBody)) return;
      st.progress = (st.progress || 0) + ev.amount;
      while (st.progress >= ctx.cfg.damagePerChild) {
        st.progress -= ctx.cfg.damagePerChild;
        const children = ctx.api.slimeChildrenOf(ctx.combatant, 'shed');
        if (children.length >= ctx.cfg.maxChildren) break;
        const a = ctx.combatant.anchor;
        // Child HP is TRANSFERRED from SLIME health, never created free.
        if (a.hp <= ctx.cfg.childHp + 1) break; // never delete the last living HP
        a.hp -= ctx.cfg.childHp;
        const spawnAng = Math.random() * Math.PI * 2;
        ctx.api.spawnSlimeChild(ctx.combatant, {
          hp: ctx.cfg.childHp, radius: ctx.cfg.childRadius,
          x: a.x + Math.cos(spawnAng) * (a.radius + 10),
          y: a.y + Math.sin(spawnAng) * (a.radius + 10),
          kind: 'shed', lifetime: ctx.cfg.childLifetime,
        });
        ctx.api.emitEvent('SlimeShed', { hero: 'SLIME', childHp: ctx.cfg.childHp });
        ctx.api.note('slime.damage_shedding', 'shed', { childHp: ctx.cfg.childHp });
      }
    },
    onTeardown(ctx) { ctx.store.shedUntil = 0; },
  };

  EXECUTORS['slime.emergency_mitosis'] = {
    onRealizedDamage(ctx, ev) {
      if (ev.creditedTo === ctx.combatant) return;
      const body = ev.victimBody;
      if (!ctx.api.ownsBody(ctx.combatant, body)) return;
      // Per-Body trigger: lost 80% of that body's reference/max HP.
      const ref = body.__hrRefHp || body.maxHp || 1000;
      const lostPct = 1 - body.hp / ref;
      if (lostPct < ctx.cfg.triggerAtLostPct) return;
      if (body.hp < 2 * ctx.cfg.minSplitShareHp) return; // each share must be >= 100
      const half = body.hp / 2;
      body.hp = half;
      body.__hrRefHp = half; // new reference self-limits recursion
      const r = body.radius || 45;
      const newR = r / Math.SQRT2;
      body.radius = newR;
      const ang = Math.random() * Math.PI * 2;
      ctx.api.spawnSlimeChild(ctx.combatant, {
        hp: half, radius: newR,
        x: body.x + Math.cos(ang) * (newR + 6), y: body.y + Math.sin(ang) * (newR + 6),
        kind: 'emergency', lifetime: 0, // emergency children persist (no timed expiry)
      });
      ctx.api.emitEvent('SlimeEmergencyMitosis', { hero: 'SLIME', hpEach: half });
      ctx.api.note('slime.emergency_mitosis', 'split', { hpEach: half });
    },
  };

  /* -------------------------------------------------------------------- *
   * 12. SNIPER
   * -------------------------------------------------------------------- */

  EXECUTORS['sniper.farthest_corner'] = {
    canCast(ctx) {
      const enemy = ctx.api.enemyOf(ctx.combatant);
      return !!(enemy && enemy.anchor && enemy.anchor.hp > 0);
    },
    cast(ctx) {
      const a = ctx.combatant.anchor;
      const enemy = ctx.api.enemyOf(ctx.combatant);
      const ea = enemy.anchor;
      const inset = ctx.cfg.cornerInset;
      const S = ctx.api.gameSize;
      const corners = [
        { x: inset, y: inset }, { x: S - inset, y: inset },
        { x: inset, y: S - inset }, { x: S - inset, y: S - inset },
      ];
      let best = corners[0], bestD = -1;
      for (const c of corners) {
        const d = dist(c.x, c.y, ea.x, ea.y);
        if (d > bestD) { bestD = d; best = c; }
      }
      ctx.api.relocate(a, best.x, best.y, 'sniper.farthest_corner');
      // Opponent loses normal auto-aim (may still fire last aim behavior).
      ctx.api.setAimLost(enemy, ctx.cfg.aimLostDuration);
      ctx.api.emitEvent('SniperCorner', { hero: 'SNIPER', x: best.x, y: best.y });
      ctx.api.note('sniper.farthest_corner', 'cast', { x: best.x, y: best.y });
      return true;
    },
  };

  EXECUTORS['sniper.nest'] = {
    cast(ctx) {
      ctx.store.nestUntil = ctx.clock() + ctx.cfg.maxDuration;
      ctx.api.emitEvent('SniperNest', { hero: 'SNIPER', duration: ctx.cfg.maxDuration });
      ctx.api.note('sniper.nest', 'cast', {});
      return true;
    },
    onTick(ctx) {
      const st = ctx.store;
      if (!st.nestUntil) return;
      if (ctx.clock() >= st.nestUntil) { st.nestUntil = 0; return; }
      const a = ctx.combatant.anchor;
      a.data.positionLocked = true; // movement speed 0 while nested
    },
    onTeardown(ctx) { ctx.store.nestUntil = 0; },
  };

  EXECUTORS['sniper.distance_crit'] = {
    onProjectileFired(ctx, p, descriptor) {
      if (!descriptor || descriptor.kind !== 'bullet') return;
      if (p.critical) return;
      const a = ctx.combatant.anchor;
      const enemy = ctx.api.enemyOf(ctx.combatant);
      const ea = enemy && enemy.anchor;
      if (!ea) return;
      const d = dist(a.x, a.y, ea.x, ea.y);
      const bps = ctx.cfg.breakpoints || [];
      let bonus = 0;
      for (let i = 0; i < bps.length; i++) {
        if (d >= bps[i].dist) bonus = bps[i].crit; // step function (<=250 -> 0)
        else break;
      }
      if (bonus <= 0) return;
      const existing = (ctx.api.baseCritChance && ctx.api.baseCritChance(p.weapon)) || 0;
      const total = Math.min(ctx.cfg.critChanceCap, existing + bonus);
      if (total > existing && ctx.api.rollChance(total - existing)) {
        p.critical = true;
        ctx.api.note('sniper.distance_crit', 'crit', { dist: d, chance: total - existing });
      }
    },
  };

  /* ==================================================================== *
   * Export.
   * ==================================================================== */
  globalScope.apexHeroReworkMechanics = 'ready';
  globalScope.APEX_HERO_REWORK_MECHANICS = {
    version: '1.0.0-rebuild1',
    EXECUTORS,
    hooks: {
      // Extra hook names executors may expose beyond the standard set.
      EXTRA_HOOKS: [
        'dodgeEligible', 'onTakeDamageLate', 'onGraphEnded', 'onArmorEnded',
      ],
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
