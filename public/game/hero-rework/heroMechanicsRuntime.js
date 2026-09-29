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
        windup: 0,
        launched: false,
        // for contact authority: track whether we have already emitted contact via real equip
        contactEmitted: false,
      };
      ctx.api.note('robot.weapon_dash', 'cast', { target: pick.weaponId });
      // SINGLE authoritative lock event per valid A1 activation
      // RobotA1Lock is the presentation authority; RobotA1Acquire is telemetry alias (no SFX)
      try { ctx.api.emitEvent('RobotA1Lock', { hero: 'ROBOT', target: pick.weaponId, slotId: pick.slot && pick.slot.id }); } catch (e) {}
      try { ctx.api.emitEvent('RobotA1Acquire', { hero: 'ROBOT', target: pick.weaponId, slotId: pick.slot && pick.slot.id, alias: true }); } catch (e) {}
      return true;
    },
    onTick(ctx, dt) {
      const d = ctx.store.dash;
      if (!d) return;
      const a = ctx.combatant.anchor;
      const cfg = ctx.cfg;
      if (!d.launched) {
        // HTML recognize (.13) → commit (.13) precedes physical launch.
        a.data.positionLocked = true;
        d.windup += dt;
        if (d.windup < .26) return;
        d.launched = true;
        // SINGLE authoritative dash launch event
        try { ctx.api.emitEvent('RobotA1DashLaunch', { hero: 'ROBOT', slotId: d.targetSlotId }); } catch (e) {}
        // Alias for telemetry only — presentation must NOT replay SFX on this
        try { ctx.api.emitEvent('RobotA1Dash', { hero: 'ROBOT', slotId: d.targetSlotId, alias: true }); } catch (e) {}
      }
      d.elapsed += dt;
      const slot = ctx.api.revealedSlotById(d.targetSlotId);
      if (!slot) { ctx.store.dash = null; return; }
      d.heading = turnToward(d.heading, angleTo(a.x, a.y, slot.x, slot.y), cfg.turnRate * dt);
      a.setDir(Math.cos(d.heading), Math.sin(d.heading));
      a.data.positionLocked = true;
      a.x += Math.cos(d.heading) * cfg.dashSpeed * dt;
      a.y += Math.sin(d.heading) * cfg.dashSpeed * dt;
      const arrived = dist(a.x, a.y, slot.x, slot.y) <= (cfg.arriveRadius || 34);
      if (arrived || d.elapsed >= (cfg.maxDashTime || 0.55)) {
        // Do NOT emit RobotA1Contact here — contact authority is REAL equip resolution (onEquipOffensive)
        ctx.store.dash = null;
        ctx.api.note('robot.weapon_dash', arrived ? 'arrived' : 'timeout', { elapsed: d.elapsed });
      }
    },
    onEquipOffensive(ctx, weaponId) {
      // REAL pickup/equip truth — this is the ONLY authoritative contact transition
      const d = ctx.store.dash;
      // If we are still dashing or just finished dash, and we equip, that's a contact
      // Even if dash is already cleared (arrived), we still want to emit contact once
      if (ctx.store._contactEmitted) return;
      ctx.store._contactEmitted = true;
      ctx.store.dash = null;
      try { ctx.api.emitEvent('RobotA1Contact', { hero: 'ROBOT', weaponId, slotId: d ? d.targetSlotId : null }); } catch (e) {}
      ctx.api.note('robot.weapon_dash', 'contact-equip', { weaponId });
      // reset flag after a short window so future dashes can emit again
      ctx.api.after(0.6, () => { ctx.store._contactEmitted = false; }, 'robot.contact-reset');
    },
    onTeardown(ctx) { ctx.store.dash = null; ctx.store._contactEmitted = false; },
  };

  EXECUTORS['robot.virtual_armor'] = {
    cast(ctx) {
      ctx.store.armorUntil = ctx.clock() + ctx.cfg.duration;
      ctx.store._endEmitted = false;
      ctx.api.emitEvent('HeroArmorUp', { hero: 'ROBOT', duration: ctx.cfg.duration });
      // SINGLE authoritative activate event
      try { ctx.api.emitEvent('RobotA2Start', { hero: 'ROBOT', duration: ctx.cfg.duration, armorUntil: ctx.store.armorUntil }); } catch (e) {}
      // Alias for telemetry — presentation must NOT replay SFX on this
      try { ctx.api.emitEvent('RobotA2Activate', { hero: 'ROBOT', duration: ctx.cfg.duration, alias: true }); } catch (e) {}
      ctx.api.note('robot.virtual_armor', 'cast', { duration: ctx.cfg.duration });
      return true;
    },
    onTakeDamage(ctx, body, packet) {
      if (!ctx.store.armorUntil || ctx.clock() >= ctx.store.armorUntil) return packet;
      if (body !== ctx.combatant.anchor && !ctx.api.ownsBody(ctx.combatant, body)) return packet;
      const out = { ...packet, amount: packet.amount * ctx.cfg.incomingMult };
      ctx.api.note('robot.virtual_armor', 'absorb', { from: packet.amount, to: out.amount });
      // SINGLE authoritative armored-hit event per actual damage
      try {
        ctx.api.emitEvent('RobotA2Hit', {
          hero: 'ROBOT',
          amount: packet.amount,
          reduced: out.amount,
          bodyId: body.id,
          // Real firearm velocity takes precedence over source position.
          direction: (() => {
            const impact = body.__aqImpact;
            const dx = impact && Number.isFinite(impact.vx) ? impact.vx : packet.source ? body.x - packet.source.x : 0;
            const dy = impact && Number.isFinite(impact.vy) ? impact.vy : packet.source ? body.y - packet.source.y : 0;
            const length = Math.hypot(dx, dy);
            return length > 0 ? { x: dx / length, y: dy / length } : null;
          })(),
          point: body.__aqImpact ? { x: body.__aqImpact.x, y: body.__aqImpact.y } : null,
        });
        // Alias — presentation must NOT replay SFX on this
        ctx.api.emitEvent('RobotA2ArmorHit', {
          hero: 'ROBOT',
          amount: packet.amount,
          reduced: out.amount,
          bodyId: body.id,
          alias: true,
        });
      } catch (e) {}
      return out;
    },
    onTick(ctx) {
      if (!ctx.store.armorUntil) return;
      if (ctx.store._endEmitted) return;
      if (ctx.clock() >= ctx.store.armorUntil) {
        ctx.store._endEmitted = true;
        // SINGLE authoritative expiry transition
        try { ctx.api.emitEvent('RobotA2End', { hero: 'ROBOT' }); } catch (e) {}
        ctx.store.armorUntil = 0;
      }
    },
    onTeardown(ctx) {
      if (ctx.store.armorUntil && !ctx.store._endEmitted) {
        try { ctx.api.emitEvent('RobotA2End', { hero: 'ROBOT', teardown: true }); } catch (e) {}
      }
      ctx.store.armorUntil = 0;
      ctx.store._endEmitted = false;
    },
  };

  EXECUTORS['robot.damage_milestones'] = {
    // Refund SEQUENCE is owner authority (doc 02): milestone #1 = no refund,
    // #2 = 0.5s, #3 = 1.0s, #4 = 1.5s, subsequent +0.5s each; one proc per
    // milestone; refunds the currently relevant Active.
    //
    // Production thresholds are frozen by the passive completion authority.
    // This store is match-owned; rolling HUD burst state never owns progress.
    onRealizedDamage(ctx, ev) {
      if (ev.creditedTo !== ctx.combatant || !(ev.amount > 0)) return; // credited positive realized damage only
      const st = ctx.store;
      st.cumulative = (st.cumulative || 0) + ev.amount;
      const thresholds = ctx.cfg.milestoneThresholds;
      if (!Array.isArray(thresholds) || thresholds.length === 0) {
        ctx.api.note('robot.damage_milestones', 'recording', { cumulative: st.cumulative, thresholds: 'UNRESOLVED' });
        return;
      }
      st.reached = st.reached || 0;
      let milestone = 0;
      while (milestone < thresholds.length && st.cumulative >= thresholds[milestone]) milestone += 1;
      while (st.reached < milestone) {
        st.reached += 1;
        const m = st.reached;
        st.crossedAt = ctx.api.clock();
        st.lastRefund = null;
        const identity = { fighterId: ctx.combatant.anchor.id, combatantIndex: ctx.combatant.idx };
        // SINGLE authoritative milestone crossing
        try { ctx.api.emitEvent('RobotPassiveMilestone', { ...identity, hero: 'ROBOT', milestone: m, cumulative: st.cumulative }); } catch (e) {}
        const refunds = ctx.cfg.milestoneRefundsSec || [0, 0.5, 1.0, 1.5];
        const refund = m <= refunds.length
          ? refunds[m - 1]
          : refunds[refunds.length - 1] + (m - refunds.length) * (ctx.cfg.stepAfterLadder || 0.5);
        if (refund > 0) {
          const ctl = ctx.api.abilityController(ctx.combatant);
          const target = (ctl && ctl.cooldownLeft('A1') > 0) ? 'A1'
            : (ctl && ctl.cooldownLeft('A2') > 0) ? 'A2' : null;
          if (target && ctl) {
            const before = ctl.cooldownLeft(target);
            ctl.refundCooldown(target, refund);
            const appliedRefund = before - ctl.cooldownLeft(target);
            if (appliedRefund > 0) {
              const payload = { ...identity, hero: 'ROBOT', milestone: m, slot: target,
                refund: appliedRefund, requestedRefund: refund, before, after: ctl.cooldownLeft(target) };
              st.lastRefund = { ...payload, at: ctx.api.clock() };
              ctx.api.emitEvent('RobotPassiveUpgrade', payload);
              // Alias is telemetry only, never another presentation dispatch.
              ctx.api.emitEvent('MilestoneRefund', { ...payload, alias: true });
              ctx.api.note('robot.damage_milestones', 'refund', payload);
            }
          }
        }

        // milestone #1 has refund 0 → only milestone event, no upgrade (per owner law)
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
    // Doc-02 Level-1 law (owner-corrected model):
    //   cast -> BEGIN/RESET MathCounter and OpponentCounter at 0 (arm the
    //   equation; no armor yet). While armed, credited MATH realized damage
    //   adds to MathCounter, credited opponent realized damage adds to
    //   OpponentCounter, neutral damage adds to neither. An opposing
    //   physical body collision CASHES OUT the equation: Virtual Armor HP =
    //   MathCounter + OpponentCounter, lasting armorDuration, protecting
    //   MATH through the shared damage pipeline. A2 creates NO direct
    //   collision-damage payout — Hero abilities must not become an
    //   invented primary raw-damage source. If the equation resets before
    //   cashout (recast/teardown), counters reset with no armor.
    // No Lv1 armed-window expiry duration is specified in doc 02; the
    // equation stays armed until cashout, recast, or teardown (we do not
    // invent a timer).
    onRealizedDamage(ctx, ev) {
      const st = ctx.store;
      if (!st.armed || st.armed.cashedOut) return; // accumulate only while armed
      if (ev.creditedTo === ctx.combatant) st.mathCounter = (st.mathCounter || 0) + ev.amount;
      else if (ev.creditedTo && ev.creditedTo === ctx.api.enemyOf(ctx.combatant)) st.oppCounter = (st.oppCounter || 0) + ev.amount;
      // neutral damage (MIRROR-neutral) adds to neither.
    },
    cast(ctx) {
      const st = ctx.store;
      if (st.armed && !st.armed.cashedOut) {
        // Recast while armed: the previous equation resets without cashout.
        ctx.api.note('math.damage_equation', 'reset-by-recast', { math: st.mathCounter || 0, opp: st.oppCounter || 0 });
      }
      st.armed = { cashedOut: false };
      st.mathCounter = ctx.cfg.countersStartAt || 0;
      st.oppCounter = ctx.cfg.countersStartAt || 0;
      ctx.api.emitEvent('EquationArmed', { hero: 'MATH_V2' });
      ctx.api.note('math.damage_equation', 'cast', { math: 0, opp: 0 });
      return true;
    },
    onBodyCollision(ctx, myBody, otherBody) {
      const st = ctx.store;
      if (!st.armed || st.armed.cashedOut) return;
      const otherCt = ctx.api.combatantOfBody(otherBody);
      if (!otherCt || otherCt === ctx.combatant) return;
      // CASH OUT: create Virtual Armor from the counters. No damage payout.
      const hp = (st.mathCounter || 0) + (st.oppCounter || 0);
      st.armed = {
        cashedOut: true,
        hp,
        until: ctx.clock() + ctx.cfg.armorDuration,
        math: st.mathCounter || 0,
        opp: st.oppCounter || 0,
      };
      st.mathCounter = 0;
      st.oppCounter = 0;
      ctx.api.emitEvent('VirtualArmor', { hero: 'MATH_V2', hp, duration: ctx.cfg.armorDuration });
      ctx.api.note('math.damage_equation', 'cashout', { hp, noDirectDamagePayout: true });
    },
    onTakeDamage(ctx, body, packet) {
      const st = ctx.store;
      if (!st.armed || !st.armed.cashedOut || ctx.clock() >= st.armed.until) return packet;
      // Shared damage pipeline: armor absorbs first, remainder realizes.
      const pool = st.armed.hp;
      const absorbed = Math.min(pool, packet.amount);
      st.armed.hp = pool - absorbed;
      if (st.armed.hp <= 0) st.armed.depleted = true;
      ctx.api.note('math.damage_equation', 'absorb', { absorbed, poolLeft: st.armed.hp });
      return { ...packet, amount: packet.amount - absorbed };
    },
    onTick(ctx) {
      const st = ctx.store;
      if (st.armed && st.armed.cashedOut && (st.armed.depleted || ctx.clock() >= st.armed.until)) {
        // Virtual Armor ended (timed out or depleted) -> counters already
        // consumed; the armor ENDING produces the /2 gate (passive law).
        st.armed = null;
        ctx.api.armorEnded(ctx.combatant);
        ctx.api.note('math.damage_equation', 'armor-ended', {});
      }
    },
    onTeardown(ctx) {
      const st = ctx.store;
      st.armed = null;
      st.mathCounter = 0;
      st.oppCounter = 0;
    },
  };

  EXECUTORS['math.multiply_divide'] = {
    // Gates are spawned by the integration runtime when the graph/armor
    // lifecycle ends (passive reacts to lifecycle events).
    // onArmorEnded is routed via api.armorEnded() — single authority for
    // the /2 gate law ("Virtual Armor ending produces /2 gate at arena
    // center for 2s").
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
      // p.__hr IS the fire-tag object carried onto the real projectile;
      // the projectile pass applies CHILL when __hr.chill is set on hit.
      p.__hr.chill = true; // applies CHILL on hit (projectile pass)
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
      // ctx.store is always provided by mechCtx (auto-created per mechanic);
      // never reassign the const binding.
      const st = ctx.store;
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

  function hunterReady(ctx) {
    const p=globalScope.APEX_HUNTER_PRESENTATION;
    return !!p?.ready && !ctx.combatant.store.__hunterAction && p.idle(ctx.combatant.anchor);
  }
  EXECUTORS['hunter.snare'] = {
    canCast(ctx){return hunterReady(ctx)&&ctx.api.canPlaceSnare(ctx.combatant,ctx.cfg.maxActiveTraps);},
    cast(ctx){
      if(!this.canCast(ctx))return false;
      const a=ctx.combatant.anchor, measured=a.__hrVel;
      const speed=measured?Math.hypot(measured.x,measured.y):0;
      const v=speed>1&&speed<(a.baseSpeed||520)*2?measured:a.dir;
      const n=Math.hypot(v.x,v.y)||1;
      ctx.combatant.store.__hunterAction='a1';
      ctx.store.cast={axis:{x:v.x/n||(!v.y?1:0),y:v.y/n},planted:false};
      globalScope.APEX_HUNTER_PRESENTATION.begin(a,'a1');return true;
    },
    onTick(ctx,dt){const c=ctx.store.cast;if(!c)return;const a=ctx.combatant.anchor;
      a.data.positionLocked=true;
      const motion=globalScope.APEX_HUNTER_PRESENTATION.advanceA1(a,dt);
      ctx.api.moveHunterBody(a,a.x+c.axis.x*motion.dx,a.y+c.axis.y*motion.dx);
      if(motion.plant&&!c.planted){c.planted=true;ctx.api.spawnSnare({owner:ctx.combatant,x:a.x,y:a.y,radius:46,lifetime:ctx.cfg.trapLifetime,rootDuration:ctx.cfg.rootDuration});}
      if(motion.done){ctx.store.cast=null;ctx.combatant.store.__hunterAction=null;}
    },
    onTeardown(ctx){ctx.store.cast=null;ctx.combatant.store.__hunterAction=null;},
  };
  EXECUTORS['hunter.pounce_weak'] = {
    canCast: hunterReady,
    cast(ctx){if(!hunterReady(ctx)||!ctx.api.enemyBodies(ctx.combatant).length)return false;
      ctx.store.pounce={windupLeft:ctx.cfg.windup,elapsed:0};ctx.combatant.store.__hunterAction='a2';
      globalScope.APEX_HUNTER_PRESENTATION.begin(ctx.combatant.anchor,'a2');return true;
    },
    onTick(ctx,dt){
      const p=ctx.store.pounce;if(!p)return;const a=ctx.combatant.anchor;a.data.positionLocked=true;
      let moveDt=dt;
      if(p.windupLeft>0){const used=Math.min(dt,p.windupLeft);globalScope.APEX_HUNTER_PRESENTATION.prelaunch(a,used);p.windupLeft-=used;moveDt-=used;if(p.windupLeft>1e-9)return;}
      if(!(moveDt>0))return;
      moveDt=Math.min(moveDt,ctx.cfg.maxMoveTime-p.elapsed);p.elapsed+=moveDt;
      const bodies=ctx.api.enemyBodies(ctx.combatant),target=bodies.reduce((best,b)=>!best||dist(a.x,a.y,b.x,b.y)<dist(a.x,a.y,best.x,best.y)?b:best,null);
      if(!target){ctx.store.pounce=null;ctx.combatant.store.__hunterAction=null;globalScope.APEX_HUNTER_PRESENTATION.miss(a);return;}
      const heading=angleTo(a.x,a.y,target.x,target.y),ox=a.x,oy=a.y;
      a.setDir(Math.cos(heading),Math.sin(heading));
      ctx.api.moveHunterBody(a,a.x+Math.cos(heading)*ctx.cfg.moveSpeed*moveDt,a.y+Math.sin(heading)*ctx.cfg.moveSpeed*moveDt);
      let hit=null,toi=Infinity;
      for(const b of bodies){const t=ctx.api.sweptHunterContact(ox,oy,a.x,a.y,b.x,b.y,a.radius+b.radius);if(t!=null&&t<toi){toi=t;hit=b;}}
      globalScope.APEX_HUNTER_PRESENTATION.travel(a,heading,moveDt);
      if(hit){a.x=ox+(a.x-ox)*toi;a.y=oy+(a.y-oy)*toi;ctx.api.applyWeakTo(ctx.api.combatantOfBody(hit),ctx.cfg.weakDuration);
        ctx.api.emitEvent('PounceWeak',{hero:'HUNTER',target:hit.id,directDamage:0,swept:true});
        ctx.store.pounce=null;ctx.combatant.store.__hunterAction=null;globalScope.APEX_HUNTER_PRESENTATION.catch(a);
      }else if(p.elapsed>=ctx.cfg.maxMoveTime-1e-9){ctx.store.pounce=null;ctx.combatant.store.__hunterAction=null;globalScope.APEX_HUNTER_PRESENTATION.miss(a);}
    },
    onTeardown(ctx){ctx.store.pounce=null;ctx.combatant.store.__hunterAction=null;},
  };

  EXECUTORS['hunter.killer_instinct'] = {
    // Dodge roll happens in the projectile pass (earliest-TOI + lockout).
    // Doc 02 semantics: the PREY/opponent being Trapped (ROOT, from HUNTER
    // A1 snare) or Weak (from HUNTER A2 pounce) enables Killer Instinct —
    // this creates real A1/A2/Passive synergy. HUNTER's own statuses are
    // irrelevant. T6 exclusion, 24% chance, 95px physical dodge, 0.45s
    // anti-chain and no-invulnerability live in the projectile pass.
    dodgeEligible(ctx, body) {
      if (!ctx.api.ownsBody(ctx.combatant, body)) return false;
      const enemy = ctx.api.enemyOf(ctx.combatant);
      if (!enemy) return false;
      return ctx.api.enemyBodies(ctx.combatant).some((b) =>
        ctx.api.isTrapped(b) || ctx.api.isWeakBody(b));
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
    // Doc 02: "if opponent unarmed/ineligible, cast may whiff". Bad timing
    // is allowed to waste the Active — there is NO free no-cooldown retry:
    // the cast is a valid attempted Active and consumes normal cooldown,
    // producing no copied weapon; the opponent retains the original.
    // (T6 cannot be copied; Level-1 shield copy remains excluded.)
    cast(ctx) {
      const held = ctx.api.heldWeapon(ctx.api.enemyOf(ctx.combatant));
      const reason = !held || !held.weaponId ? 'unarmed'
        : ctx.api.isT6Weapon(held.weaponId) ? 't6'
        : (held.weaponId === 'SWIRL_SHIELD' || held.weaponId === 'TOWER_SHIELD') ? 'shield-excluded'
        : null;
      if (reason) {
        ctx.api.emitEvent('MirrorWhiff', { hero: 'MIRROR', reason });
        ctx.api.note('mirror.arsenal', 'whiff', { reason });
        return true; // whiff: cooldown consumed, no copy
      }
      const ok = ctx.api.grantWeaponCopy(ctx.combatant, held.weaponId, ctx.cfg.copyLifetime);
      ctx.api.note('mirror.arsenal', ok ? 'copy' : 'whiff', { weapon: held.weaponId });
      return true; // cooldown consumed either way (cast happened)
    },
    onTick(ctx) {
      // Copy lifetime: expire the copy only if the fighter still holds THAT
      // copy instance (a later real pickup/equip replaces it cleanly).
      const st = ctx.store;
      const cp = st.__mirrorCopy;
      if (!cp || ctx.clock() < cp.until) return;
      st.__mirrorCopy = null;
      const a = ctx.combatant.anchor;
      const holder = a && a.data && a.data.arsenal;
      if (holder && holder.__hrMirrorCopy && holder.weaponId === cp.weaponId) {
        const W = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
        if (W && W.consume) W.consume(a, 'mirror-copy-expired');
        ctx.api.note('mirror.arsenal', 'copy-expired', { weapon: cp.weaponId });
      }
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
      // HP pool law (doc 10 A1 "split evenly and never duplicated"): the
      // halves also halve maxHp so healing can never recreate a duplicated
      // pool; the split-merge restores the summed pool.
      const halfMax = (a.maxHp || 1000) / 2;
      a.maxHp = halfMax;
      a.__hrRefHp = half; // creation-state reference (symmetric with child)
      // Area-conserving radii: two bodies of r/sqrt(2) conserve area.
      const r = a.baseRadius || a.radius;
      const newR = r / Math.SQRT2;
      a.radius = newR;
      a.baseRadius = newR;
      // Seeded split axis (gameplay RNG law — never Math.random).
      const ang = ctx.rng() * Math.PI * 2;
      const ax = Math.cos(ang), ay = Math.sin(ang);
      // Physical spawn (doc 10): the halves must NOT overlap at spawn.
      const pos = ctx.api.slimeSplitPose(a, newR, ax, ay);
      const child = ctx.api.spawnSlimeChild(ctx.combatant, {
        hp: half, maxHp: halfMax, radius: newR, x: pos.x, y: pos.y,
        kind: 'mitosis', lifetime: ctx.cfg.splitDuration,
      });
      // Initial heading divergence — EXPLICIT UNRESOLVED TUNING SLOT (doc
      // 10: "target +/- 25", semantic/unit NOT frozen by authority).
      // PROVISIONAL pilot interpretation (isolated behind cfg, may be
      // replaced when the owner freezes the unit): each half's heading is
      // the split-axis perpendicular rotated by +/- divergenceTarget in
      // degrees, read live from config on every cast. The FROZEN laws it
      // must never disturb: non-overlap spawn, seeded reproducibility,
      // independent physical motion.
      const divDeg = ctx.cfg.divergenceTarget != null ? ctx.cfg.divergenceTarget : 25;
      const div = divDeg * Math.PI / 180;
      const perpA = ang + Math.PI / 2;
      const perpB = ang - Math.PI / 2;
      a.setDir(Math.cos(perpA + div), Math.sin(perpA + div));
      child.setDir(Math.cos(perpB - div), Math.sin(perpB - div));
      ctx.store.mergeAt = ctx.clock() + ctx.cfg.splitDuration;
      ctx.store.pendingMergeId = child.id;
      ctx.api.emitEvent('SlimeMitosis', { hero: 'SLIME', hpEach: half, divergenceSlot: divDeg });
      ctx.api.note('slime.mitosis', 'split', { hpEach: half, divergenceSlot: divDeg });
      return true;
    },
    onTick(ctx) {
      const st = ctx.store;
      if (!st.mergeAt) return;
      if (ctx.clock() < st.mergeAt) return;
      // Merge law (doc 10 A1): "after splitDuration the surviving Bodies
      // automatically merge WHEN CLOSE" — proximity-gated so a merge never
      // teleports a distant body across the arena.
      const child = (ctx.api.slimeChildrenOf(ctx.combatant, 'mitosis') || [])
        .find((b) => b.id === st.pendingMergeId);
      const a = ctx.combatant.anchor;
      if (child && a && dist(a.x, a.y, child.x, child.y) > (a.radius + child.radius) * 2) {
        ctx.api.note('slime.mitosis', 'merge-waiting', {});
        return; // still apart at/after mergeAt — merge when they meet
      }
      st.mergeAt = 0;
      // HP sums (no heal), footprint area restores, equipment merges
      // deterministically with no duplication.
      ctx.api.mergeSlimeChild(ctx.combatant, st.pendingMergeId, { equipmentMerge: true });
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
        // Progress is consumed ONLY by a successful spawn (doc 10 A2).
        // A blocked spawn (child cap / would-delete-last-HP) RETAINS the
        // progress — it must never silently burn accumulated damage.
        const children = ctx.api.slimeChildrenOf(ctx.combatant, 'shed');
        if (children.length >= ctx.cfg.maxChildren) break;
        const src = ev.victimBody && ev.victimBody.hp > 0 ? ev.victimBody : ctx.combatant.anchor;
        // Child HP is TRANSFERRED from SLIME health, never created free.
        if (src.hp <= ctx.cfg.childHp + 1) break; // never delete the last living HP
        src.hp -= ctx.cfg.childHp;
        // Seeded spawn axis (gameplay RNG law) + non-overlapping placement.
        const spawnAng = ctx.rng() * Math.PI * 2;
        const pos = ctx.api.slimeSplitPose(src, ctx.cfg.childRadius, Math.cos(spawnAng), Math.sin(spawnAng), 6);
        ctx.api.spawnSlimeChild(ctx.combatant, {
          hp: ctx.cfg.childHp, radius: ctx.cfg.childRadius,
          x: pos.x, y: pos.y,
          // R4: no authored heading rule for shed children — inherit the
          // spawning source body's current normalized heading (seeded axis
          // still drives placement only).
          sourceBody: src,
          kind: 'shed', lifetime: ctx.cfg.childLifetime,
          // Children move at 90% of parent speed (doc 10 A2) — explicit knob.
          speedPct: ctx.cfg.childSpeedPct != null ? ctx.cfg.childSpeedPct : 0.9,
        });
        st.progress -= ctx.cfg.damagePerChild;
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
      // Float hygiene at the spec's exact knife edge (80% loss at ref 1000
      // == hp 200 == halves of exactly 100): tolerate IEEE noise (1e-9
      // ratio / 1e-6 hp) so the boundary point behaves as authored. NOT a
      // tuning change — gameplay values well off the boundary are
      // unaffected (hp 199.5 still no-splits, hp 205 still no-triggers).
      if (lostPct + 1e-9 < ctx.cfg.triggerAtLostPct) return;
      if (body.hp + 1e-6 < 2 * ctx.cfg.minSplitShareHp) return; // each share must be >= 100
      const half = body.hp / 2;
      body.hp = half;
      body.__hrRefHp = half; // new reference (creation state) self-limits recursion
      const halfMax = (body.maxHp || 1000) / 2;
      body.maxHp = halfMax; // no duplicated heal pool across the halves
      const r = body.radius || 45;
      const newR = r / Math.SQRT2;
      body.radius = newR;
      body.baseRadius = newR;
      // Seeded split axis (gameplay RNG law) + non-overlapping placement;
      // split halves are ordinary hero Bodies at parent speed.
      const ang = ctx.rng() * Math.PI * 2;
      const pos = ctx.api.slimeSplitPose(body, newR, Math.cos(ang), Math.sin(ang), 6);
      ctx.api.spawnSlimeChild(ctx.combatant, {
        hp: half, maxHp: halfMax, radius: newR,
        x: pos.x, y: pos.y,
        // R4: inherit the triggering source body's normalized heading.
        sourceBody: body,
        kind: 'emergency', lifetime: 0, // emergency children persist (no timed expiry)
        speedPct: 1,
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
