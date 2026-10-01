/* =============================================================================
 * MAGNET V1 — authoritative gameplay truth.
 *
 * This module owns Magnet field windows and trajectory-only projectile force.
 * Floor-firearm/body world integration is kept here too (below the field core)
 * so multiple Magnets compose before any object is integrated.
 * ========================================================================== */
(function (globalScope) {
  'use strict';

  if (globalScope.APEX_MAGNET) return;

  const EPS = 1e-9;
  const CONSTANTS = Object.freeze({
    A1_DURATION: 1.00,
    A1_BULLET_RADIUS: 480,
    A1_BULLET_ACCEL: 14000,
    A2_DURATION: 1.80,
    A2_RADIUS: 225,
    A2_BULLET_ACCEL: 18000,
    BULLET_SPEED_CAP_MULT: 1.10,
    PASSIVE_SPEED_MULT: 1.18,
  });

  const fields = new Map();
  const floorStates = new Map();
  const bodyStates = new Map();
  let projectileState = new WeakMap();
  // Per-world-step semantic truth for presentation consumers. These records
  // are emitted from the exact branches that applied force; persistent
  // floor/body momentum state is deliberately not equivalent to influence.
  let lastFloorInfluence = [];
  let lastBodyInfluence = [];
  let lastProjectileInfluence = [];
  let worldStepCount = 0;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function capVelocity(o, cap) {
    const speed = Math.hypot(o.vx || 0, o.vy || 0);
    if (speed > cap && cap >= 0) {
      o.vx *= cap / speed;
      o.vy *= cap / speed;
    }
  }
  function nowOf(ctx) {
    if (ctx && typeof ctx.clock === 'function') return ctx.clock();
    if (ctx && ctx.api && typeof ctx.api.clock === 'function') return ctx.api.clock();
    return Number(globalScope.matchClock) || 0;
  }
  function emit(ctx, type, payload) {
    if (ctx && ctx.api && typeof ctx.api.emitEvent === 'function') ctx.api.emitEvent(type, payload);
  }
  function fieldState(ct) {
    let st = fields.get(ct);
    if (!st) {
      st = { combatant: ct, a1: null, a2: null, casts: { a1: 0, a2: 0 } };
      fields.set(ct, st);
    }
    return st;
  }
  function isLive(field, now) {
    return !!field && now + EPS < field.until;
  }
  function activeFor(ct, kind, now) {
    const st = fields.get(ct);
    return !!st && isLive(st[kind], now == null ? Number(globalScope.matchClock) || 0 : now);
  }
  function canCast(ctx, kind) {
    const now = nowOf(ctx);
    const st = fieldState(ctx.combatant);
    return kind === 'a1' ? !isLive(st.a2, now) : !isLive(st.a1, now);
  }
  function snapshotFloorIds() {
    const state = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.state;
    if (!state || !Array.isArray(state.slots)) return new Set();
    return new Set(state.slots.filter(isEligibleFloorFirearm).map((slot) => slot.id));
  }
  function cast(ctx, kind) {
    if (!ctx || !ctx.combatant || !canCast(ctx, kind)) return false;
    const now = nowOf(ctx);
    const st = fieldState(ctx.combatant);
    const cfg = ctx.cfg || {};
    const duration = kind === 'a1'
      ? (cfg.gameplayDuration ?? CONSTANTS.A1_DURATION)
      : (cfg.duration ?? CONSTANTS.A2_DURATION);
    const field = {
      kind,
      acceptedAt: now,
      until: now + duration,
      duration,
      initialFloorIds: kind === 'a1' ? snapshotFloorIds() : new Set(),
      acknowledgedFloorIds: new Set(),
      notify: ctx.api && typeof ctx.api.emitEvent === 'function'
        ? (type, payload) => ctx.api.emitEvent(type, payload)
        : null,
    };
    st[kind] = field;
    st.casts[kind] += 1;
    emit(ctx, kind === 'a1' ? 'MagnetA1Start' : 'MagnetA2Start', {
      hero: 'MAGNET', combatantIndex: ctx.combatant.idx, duration,
    });
    return true;
  }

  function castA1(ctx) { return cast(ctx, 'a1'); }
  function castA2(ctx) { return cast(ctx, 'a2'); }

  function activeFields(now) {
    const out = [];
    for (const st of fields.values()) {
      const ct = st.combatant;
      if (!ct || !ct.anchor || !(ct.anchor.hp > 0)) continue;
      if (isLive(st.a1, now)) out.push({ owner: ct, state: st.a1, cfg: ct.skills.A1.cfg });
      if (isLive(st.a2, now)) out.push({ owner: ct, state: st.a2, cfg: ct.skills.A2.cfg });
    }
    return out;
  }

  function isT6Weapon(id) { return id === 'STORMBREAKER' || id === 'T6'; }
  function isFirearm(id) {
    if (!id || isT6Weapon(id)) return false;
    const cfg = globalScope.APEX_ARSENAL_CONFIG;
    return !!(cfg && typeof cfg.isGun === 'function' && cfg.isGun(id));
  }
  function isEligibleFloorFirearm(slot) {
    return !!slot && slot.phase === 'REVEALED' && slot.kind !== 'HEAL'
      && isFirearm(slot.weaponId);
  }
  function isEligibleBullet(p) {
    return !!p && p.aq === true && p.type === 'aq_bullet' && p.life !== 0
      && isFirearm(p.weapon) && !(p.__hr && p.__hr.cryHold);
  }
  function hostileTo(p, ct, combatantOfBody) {
    if (p.__hr && p.__hr.neutral) return true;
    const ownerCt = typeof combatantOfBody === 'function' ? combatantOfBody(p.owner) : null;
    if (ownerCt) return ownerCt !== ct;
    if (p.owner === ct.anchor || (ct.bodies && ct.bodies.includes(p.owner))) return false;
    return true;
  }
  function projectileRecord(p) {
    let rec = projectileState.get(p);
    if (!rec) {
      rec = { launchSpeed: Math.hypot(p.vx || 0, p.vy || 0) };
      projectileState.set(p, rec);
    }
    return rec;
  }

  // Called once immediately before the canonical projectile movement pass.
  function stepProjectiles(dt, projectiles, combatantOfBody, now) {
    const t = now == null ? Number(globalScope.matchClock) || 0 : now;
    const live = activeFields(t);
    const influenced = [];
    for (const p of projectiles || []) {
      if (!isEligibleBullet(p)) continue;
      const rec = projectileRecord(p); // authored emission speed, captured before force
      let ax = 0, ay = 0;
      const by = [];
      for (const f of live) {
        if (!hostileTo(p, f.owner, combatantOfBody)) continue;
        const cx = f.owner.anchor.x, cy = f.owner.anchor.y;
        let dx, dy, radius, maxAccel;
        if (f.state.kind === 'a1') {
          dx = cx - p.x; dy = cy - p.y;
          radius = f.cfg.bulletRadius ?? CONSTANTS.A1_BULLET_RADIUS;
          maxAccel = f.cfg.bulletAcceleration ?? CONSTANTS.A1_BULLET_ACCEL;
        } else {
          dx = p.x - cx; dy = p.y - cy;
          radius = f.cfg.radius ?? CONSTANTS.A2_RADIUS;
          maxAccel = f.cfg.bulletAcceleration ?? CONSTANTS.A2_BULLET_ACCEL;
        }
        const d = Math.hypot(dx, dy);
        if (!(d > EPS) || d >= radius) continue;
        const u = clamp(1 - d / radius, 0, 1);
        const accel = maxAccel * u * u;
        ax += dx / d * accel;
        ay += dy / d * accel;
        by.push({ kind: f.state.kind, owner: f.owner });
      }
      if (!by.length) continue;
      p.vx += ax * dt;
      p.vy += ay * dt;
      capVelocity(p, rec.launchSpeed * CONSTANTS.BULLET_SPEED_CAP_MULT);
      influenced.push({ projectile: p, fields: by, ax, ay });
    }
    lastProjectileInfluence = influenced;
    return influenced.length;
  }

  function defaultPickupEligible(slot, body) {
    if (!body || !(body.hp > 0)) return false;
    if (slot.phase === 'COUNTER_RESERVED' && slot.reservedFor !== body.id) return false;
    const weaponApi = globalScope.APEX_ARSENAL && globalScope.APEX_ARSENAL.weaponApi;
    if (weaponApi && weaponApi.getHolder && weaponApi.getHolder(body)) return false;
    const frost = globalScope.APEX_FROST;
    if (slot.__frostFrozen && frost && frost.deniesPickup && frost.deniesPickup(slot, body)) return false;
    return true;
  }
  function floorStateFor(slot) {
    let st = floorStates.get(slot);
    if (!st) {
      st = { vx: 0, vy: 0, rotation: 0, wallContacts: new Set(), bodyContacts: new Set(), history: [], integrations: 0 };
      floorStates.set(slot, st);
    }
    return st;
  }
  function resolveFloorWalls(slot, st, size) {
    const r = 16;
    const next = new Set();
    const hit = (key, penetration, nx, ny) => {
      if (!(penetration > 0)) return;
      next.add(key);
      slot.x += nx * penetration; slot.y += ny * penetration;
      const vn = st.vx * nx + st.vy * ny;
      if (vn >= 0) return;
      if (!st.wallContacts.has(key)) {
        const tx = st.vx - vn * nx, ty = st.vy - vn * ny;
        st.vx = tx * 0.82 - vn * 0.45 * nx;
        st.vy = ty * 0.82 - vn * 0.45 * ny;
      } else {
        st.vx -= vn * nx; st.vy -= vn * ny;
      }
    };
    hit('L', r - slot.x, 1, 0);
    hit('R', slot.x - (size - r), -1, 0);
    hit('T', r - slot.y, 0, 1);
    hit('B', slot.y - (size - r), 0, -1);
    st.wallContacts = next;
  }
  function resolveFloorBodies(slot, st, bodies, pickupEligible) {
    const next = new Set();
    for (const body of bodies || []) {
      if (!body || !(body.hp > 0)) continue;
      const dx = slot.x - body.x, dy = slot.y - body.y;
      const d = Math.hypot(dx, dy), minD = 16 + (body.radius || 75);
      if (!(d < minD)) continue;
      if (pickupEligible(slot, body)) continue; // canonical Arsenal pickup wins later this tick
      const key = String(body.id);
      next.add(key);
      const nx = d > EPS ? dx / d : 1, ny = d > EPS ? dy / d : 0;
      slot.x = body.x + nx * minD; slot.y = body.y + ny * minD;
      const bv = body.__hrVel || { x: 0, y: 0 };
      const rvx = st.vx - (bv.x || 0), rvy = st.vy - (bv.y || 0);
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        if (!st.bodyContacts.has(key)) {
          st.vx -= (1 + 0.33) * vn * nx;
          st.vy -= (1 + 0.33) * vn * ny;
        } else {
          st.vx -= vn * nx; st.vy -= vn * ny;
        }
      }
    }
    st.bodyContacts = next;
  }
  function acknowledgeLateReveal(field, slot) {
    if (field.state.kind !== 'a1' || field.state.initialFloorIds.has(slot.id)
      || field.state.acknowledgedFloorIds.has(slot.id)) return;
    field.state.acknowledgedFloorIds.add(slot.id);
    if (field.state.notify) field.state.notify('MagnetLateReveal', {
      hero: 'MAGNET', combatantIndex: field.owner.idx, slotId: slot.id,
    });
  }
  function integrateFloorFirearms(dt, live, opts) {
    const slots = opts.slots || [];
    const bodies = opts.bodies || [];
    const size = opts.gameSize || Number(globalScope.GAME_SIZE) || 1000;
    const pickupEligible = opts.pickupEligible || defaultPickupEligible;
    const present = new Set(slots);
    const influenced = [];
    for (const slot of slots) {
      if (!isEligibleFloorFirearm(slot)) continue;
      let ax = 0, ay = 0, cap = 0, forced = false;
      const by = [];
      for (const field of live) {
        const cx = field.owner.anchor.x, cy = field.owner.anchor.y;
        let dx = cx - slot.x, dy = cy - slot.y;
        const d = Math.hypot(dx, dy);
        if (!(d > EPS)) continue;
        if (field.state.kind === 'a1') {
          const accel0 = field.cfg.gunAccelerationMin ?? 1400;
          const accel1 = field.cfg.gunAccelerationMax ?? 2400;
          const accel = accel0 + (accel1 - accel0) * clamp(d / (field.cfg.gunDistanceSpan ?? 700), 0, 1);
          ax += dx / d * accel; ay += dy / d * accel;
          cap = Math.max(cap, field.cfg.gunSpeedCap ?? 900);
          forced = true; by.push({ kind: 'a1', owner: field.owner });
          acknowledgeLateReveal(field, slot);
        } else {
          const radius = field.cfg.radius ?? CONSTANTS.A2_RADIUS;
          if (d >= radius) continue;
          const u = clamp(1 - d / radius, 0, 1);
          dx = -dx; dy = -dy;
          const accel = (field.cfg.gunAcceleration ?? 3000) * u * u;
          ax += dx / d * accel; ay += dy / d * accel;
          cap = Math.max(cap, field.cfg.gunSpeedCap ?? 950);
          forced = true; by.push({ kind: 'a2', owner: field.owner });
        }
      }
      const existing = floorStates.get(slot);
      if (!forced && !existing) continue;
      const st = existing || floorStateFor(slot);
      if (forced) {
        st.vx += ax * dt; st.vy += ay * dt;
        capVelocity(st, cap);
      } else {
        const drag = Math.exp(-1.8 * dt);
        st.vx *= drag; st.vy *= drag;
      }
      slot.x += st.vx * dt; slot.y += st.vy * dt;
      resolveFloorWalls(slot, st, size);
      resolveFloorBodies(slot, st, bodies, pickupEligible);
      const speed = Math.hypot(st.vx, st.vy);
      if (speed > 1) st.rotation = Math.atan2(st.vy, st.vx);
      st.history.push({ x: slot.x, y: slot.y });
      if (st.history.length > 24) st.history.shift();
      st.integrations += 1;
      if (by.length) influenced.push({
        slot, fields: by, vx: st.vx, vy: st.vy, rotation: st.rotation,
      });
    }
    for (const slot of floorStates.keys()) if (!present.has(slot) || slot.phase !== 'REVEALED') floorStates.delete(slot);
    return influenced;
  }
  function integrateBodies(dt, live, opts) {
    const bodies = opts.bodies || [];
    const combatantOfBody = opts.combatantOfBody || (() => null);
    const size = opts.gameSize || Number(globalScope.GAME_SIZE) || 1000;
    const present = new Set(bodies);
    const influenced = [];
    for (const body of bodies) {
      if (!body || !(body.hp > 0)) continue;
      const targetCt = combatantOfBody(body);
      let ax = 0, ay = 0, forced = false;
      const by = [];
      for (const field of live) {
        if (field.state.kind !== 'a2') continue;
        if (targetCt ? targetCt === field.owner : field.owner.bodies && field.owner.bodies.includes(body)) continue;
        const dx = body.x - field.owner.anchor.x, dy = body.y - field.owner.anchor.y;
        const d = Math.hypot(dx, dy), radius = field.cfg.radius ?? CONSTANTS.A2_RADIUS;
        if (!(d > EPS) || d >= radius) continue;
        const u = clamp(1 - d / radius, 0, 1);
        const accel = (field.cfg.bodyAcceleration ?? 2200) * u * u;
        ax += dx / d * accel; ay += dy / d * accel; forced = true;
        by.push({ kind: 'a2', owner: field.owner });
      }
      const existing = bodyStates.get(body);
      if (!forced && !existing) continue;
      const st = existing || { vx: 0, vy: 0, integrations: 0 };
      bodyStates.set(body, st);
      if (forced) {
        st.vx += ax * dt; st.vy += ay * dt;
        capVelocity(st, 650);
      }
      body.x += st.vx * dt; body.y += st.vy * dt;
      const r = body.radius || 75;
      if (body.x < r) { body.x = r; st.vx = Math.abs(st.vx); }
      else if (body.x > size - r) { body.x = size - r; st.vx = -Math.abs(st.vx); }
      if (body.y < r) { body.y = r; st.vy = Math.abs(st.vy); }
      else if (body.y > size - r) { body.y = size - r; st.vy = -Math.abs(st.vy); }
      st.integrations += 1;
      if (by.length) influenced.push({ body, fields: by, vx: st.vx, vy: st.vy });
    }
    for (const body of bodyStates.keys()) if (!present.has(body) || !(body.hp > 0)) bodyStates.delete(body);
    return influenced;
  }

  // Exactly one call per authoritative world tick. All active Magnet forces
  // are collected first; every real slot/body is then integrated once.
  function stepWorld(dt, options) {
    const opts = options || {};
    const now = opts.now == null ? Number(globalScope.matchClock) || 0 : opts.now;
    const live = activeFields(now);
    lastFloorInfluence = integrateFloorFirearms(dt, live, opts);
    lastBodyInfluence = integrateBodies(dt, live, opts);
    worldStepCount += 1;
  }

  // Real emission hook: only a Magnet-fired firearm bullet is multiplied,
  // once, before the Arsenal projectile object is created.
  function modifyFirearmEmission(ctx, standin, descriptor) {
    if (!descriptor || descriptor.kind !== 'bullet' || !descriptor.params) return false;
    if (!isFirearm(descriptor.params.weapon)) return false;
    if (!Number.isFinite(descriptor.params.speed)) return false;
    if (standin && standin.__hr && standin.__hr.magnetBoosted) return false;
    descriptor.params.speed *= CONSTANTS.PASSIVE_SPEED_MULT;
    if (standin && standin.__hr) standin.__hr.magnetBoosted = true;
    emit(ctx, 'MagnetPassiveEmission', {
      hero: 'MAGNET', combatantIndex: ctx.combatant.idx,
      x: descriptor.params.x, y: descriptor.params.y,
      angle: descriptor.params.angle, weapon: descriptor.params.weapon,
      speed: descriptor.params.speed,
    });
    return true;
  }

  function teardown(combatant) {
    if (combatant) fields.delete(combatant);
    else fields.clear();
    lastFloorInfluence = [];
    lastBodyInfluence = [];
    lastProjectileInfluence = [];
    if (!combatant || fields.size === 0) {
      floorStates.clear(); bodyStates.clear();
      projectileState = new WeakMap();
      worldStepCount = 0;
    }
  }
  function inspect(now) {
    const t = now == null ? Number(globalScope.matchClock) || 0 : now;
    return {
      fields: Array.from(fields.values()).map((st) => ({
        combatant: st.combatant,
        a1Active: isLive(st.a1, t), a2Active: isLive(st.a2, t),
        a1Until: st.a1 ? st.a1.until : 0, a2Until: st.a2 ? st.a2.until : 0,
        casts: { ...st.casts },
      })),
      floorFirearms: Array.from(floorStates.entries()).map(([slot, st]) => ({
        slot, vx: st.vx, vy: st.vy, rotation: st.rotation,
        integrations: st.integrations, history: st.history.slice(),
      })),
      bodies: Array.from(bodyStates.entries()).map(([body, st]) => ({ body, ...st })),
      floorInfluence: lastFloorInfluence.slice(),
      bodyInfluence: lastBodyInfluence.slice(),
      projectileInfluence: lastProjectileInfluence.slice(),
      worldStepCount,
    };
  }

  globalScope.APEX_MAGNET = {
    version: '1.0.0', CONSTANTS,
    canCast, castA1, castA2, activeFor, activeFields,
    isEligibleFloorFirearm, isEligibleBullet,
    stepWorld, stepProjectiles, modifyFirearmEmission,
    teardown, inspect,
  };
  globalScope.apexMagnetGameplayRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
