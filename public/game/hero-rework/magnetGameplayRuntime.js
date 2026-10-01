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
    // Owner-authority A2 firearm-bullet repulsion (supersedes the former
    // production quadratic radial falloff for A2 BULLETS ONLY).
    //
    // Canonical donor law (MAGNET_FINAL_DONOR_MAX.html, world(), bullets):
    //   if(d<225){ const ddv=18000*f2*dt; b.vx+=dx/d*ddv; ... capV(b,launch*1.1) }
    // i.e. a FLAT 18000 outward acceleration gated only by d<225 — there is no
    // u^2 term in the donor. Donor hostile bullets are 640/900/1300 px/s, so a
    // donor bullet spends 0.12..0.5s inside the field and is fully reversed.
    //
    // Production firearm bullets are 2500..5800 px/s and the damaging envelope
    // is radius*0.78+bulletRadius (~63..67px), so an incoming production bullet
    // only traverses 225 -> ~65 px: 1.6 (SNIPER) .. 3.6 (PISTOL) authoritative
    // ticks. Pure acceleration — donor or otherwise — cannot reverse that in
    // the time available, which is exactly the owner-rejected penetration.
    //
    // Therefore A2 firearm bullets now receive an ENTRY RESPONSE at the real
    // (swept) field boundary crossing: the inward radial component is
    // neutralized and converted outward, tangential velocity is preserved, and
    // the donor flat 18000 outward force then continues for as long as the
    // bullet remains inside. Applied at most once per field-entry episode.
    A2_BULLET_ENTRY_RESTITUTION: 1.0,
    // Hysteresis before a bullet may earn a NEW entry response. Without it a
    // bullet loitering on the boundary would be re-snapped every frame.
    A2_BULLET_REARM_RADIUS_MULT: 1.12,
    // Owner-directed cinematic beat: at the physical A2 time-of-impact the
    // inward radial component is killed immediately (gameplay safety is NOT
    // deferred), the tangential component is preserved verbatim, and the
    // OUTWARD radial speed ramps in over this short sim-time envelope so the
    // shot reads as "magnetic catch -> curve -> release" instead of a mirror
    // ricochet. ~0.07s is 4 frames at 60fps.
    A2_BULLET_CAPTURE_SECONDS: 0.07,
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
  let lastCaptureEvents = [];
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
      rec = { launchSpeed: Math.hypot(p.vx || 0, p.vy || 0), a2: null };
      projectileState.set(p, rec);
    }
    if (!rec.a2) rec.a2 = new Map();
    return rec;
  }

  // Earliest parameter t in (0, 1] at which the segment P0 -> P0+D first
  // reaches distance `radius` from C while closing on it. Returns -1 when the
  // segment never crosses inward. Used so a 2500..5800 px/s production bullet
  // cannot step across the A2 boundary between two authoritative positions.
  function sweptEntry(px, py, dx, dy, cx, cy, radius) {
    const ox = px - cx, oy = py - cy;
    const a = dx * dx + dy * dy;
    if (!(a > EPS)) return -1;
    const b = 2 * (ox * dx + oy * dy);
    if (b >= 0) return -1; // moving away from the field centre
    const c = ox * ox + oy * oy - radius * radius;
    if (c <= 0) return 0; // already inside at the authoritative position
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : -1;
  }

  // Smoothstep: slow catch, accelerating release, soft arrival. This is the
  // shape that makes the deflection read as magnetic rather than reflective.
  function captureEase(u) { const k = clamp(u, 0, 1); return k * k * (3 - 2 * k); }

  // A2 firearm-bullet repulsion. Trajectory only: identity, owner, damage,
  // crit, payload and lifetime are never touched. This function NEVER moves
  // the projectile and never writes p.vx/p.vy -- it returns a report, and the
  // entry response is published as a time-of-impact movement plan that the
  // canonical projectile integration consumes, so the response is applied at
  // the real R=225 crossing rather than at the frame-start position.
  function applyA2BulletRepulsion(p, rec, field, dt) {
    const cx = field.owner.anchor.x, cy = field.owner.anchor.y;
    const radius = field.cfg.radius ?? CONSTANTS.A2_RADIUS;
    const maxAccel = field.cfg.bulletAcceleration ?? CONSTANTS.A2_BULLET_ACCEL;
    const rearm = radius * CONSTANTS.A2_BULLET_REARM_RADIUS_MULT;

    let ep = rec.a2.get(field.state);
    if (!ep) { ep = { entered: false, capture: null }; rec.a2.set(field.state, ep); }

    const d0 = Math.hypot(p.x - cx, p.y - cy);
    // Re-arm only after the bullet has genuinely left the field again.
    if (ep.entered && d0 > rearm) { ep.entered = false; ep.capture = null; }

    const t = sweptEntry(p.x, p.y, p.vx * dt, p.vy * dt, cx, cy, radius);
    const insideNow = d0 < radius;
    const crossing = t >= 0;
    // An active capture episode must keep being driven even once the bullet is
    // sitting exactly ON the boundary with no inward motion left: a head-on
    // shot has zero tangential component, so after the inward radial is
    // neutralized it is momentarily stationary at R and would otherwise never
    // be seen by this field again (a trapped bullet).
    const capturing = !!(ep.capture && !ep.capture.released);
    if (!insideNow && !crossing && !capturing) return null;

    const report = { radius, entry: null, plan: null, capture: null, accel: 0, cx, cy };

    // ---- 1. Field-entry response, once per entry episode ------------------
    // Published as a PLAN at parameter t. Nothing is mutated here.
    if (!ep.entered && crossing) {
      const ex = p.x + p.vx * dt * t, ey = p.y + p.vy * dt * t;
      let nx = ex - cx, ny = ey - cy;
      const nd = Math.hypot(nx, ny);
      if (nd > EPS) {
        nx /= nd; ny /= nd;
        const vr = p.vx * nx + p.vy * ny; // < 0 == inbound
        if (vr < 0) {
          const tx = p.vx - vr * nx, ty = p.vy - vr * ny; // tangential preserved
          const target = -vr * CONSTANTS.A2_BULLET_ENTRY_RESTITUTION;
          // Gameplay safety is immediate: radial component becomes exactly 0
          // at the boundary, so the bullet cannot continue inward for even one
          // sub-step. A tangent ray from a point on the circle never re-enters
          // it, so the capture beat cannot leak inward either.
          report.plan = {
            t, ex, ey, nx, ny,
            fieldOwner: field.owner,
            preVx: p.vx, preVy: p.vy,
            postVx: tx, postVy: ty,
            radialBefore: vr, radialTarget: target,
            tangential: Math.hypot(tx, ty),
            cx, cy, radius,
          };
          report.entry = {
            x: ex, y: ey, nx, ny, t,
            // Field centre actually used to solve this crossing. Consumers
            // must measure the response radius against THIS, not against a
            // later anchor position -- the anchor is free to move afterwards.
            cx, cy,
            radialBefore: vr,
            radialAfter: 0,          // neutralized AT the boundary
            radialTarget: target,    // ramped in over the capture envelope
            tangential: Math.hypot(tx, ty),
          };
          ep.capture = {
            age: 0, duration: CONSTANTS.A2_BULLET_CAPTURE_SECONDS,
            target, nx, ny, startedAt: field.state,
            tangentialAtEntry: Math.hypot(tx, ty),
            minRadius: radius, released: false,
          };
          report.capture = ep.capture;
        }
      }
      ep.entered = true;
    } else if (insideNow) {
      ep.entered = true;
    }

    // ---- 2. Magnetic capture envelope (radial authority while active) -----
    // The outward radial speed is driven by a deterministic sim-time envelope
    // rather than snapped. This is ONE continuous episode per entry, not a
    // per-frame re-trigger of the entry response.
    const cap = ep.capture;
    if (cap && !cap.released && !report.plan) {
      cap.age += dt;
      const u = clamp(cap.age / cap.duration, 0, 1);
      let rx = p.x - cx, ry = p.y - cy;
      const rd = Math.hypot(rx, ry);
      if (rd > EPS) {
        rx /= rd; ry /= rd;
        cap.minRadius = Math.min(cap.minRadius, rd);
        const vr = p.vx * rx + p.vy * ry;
        const want = captureEase(u) * cap.target;
        // Radial component is SET to the envelope value; tangential is left to
        // evolve on its own. Never allow it to be inward.
        const dvr = Math.max(want, 0) - vr;
        report.captureRadial = { u, want, vr, radius: rd, tangential: Math.hypot(p.vx - vr * rx, p.vy - vr * ry) };
        report.dvx = rx * dvr; report.dvy = ry * dvr;
      }
      if (u >= 1) { cap.released = true; cap.releasedAt = true; }
      report.accel = 0;
      return report;
    }

    // ---- 3. Donor continued outward force (flat 18000, no u^2 falloff) ----
    let rx = p.x - cx, ry = p.y - cy;
    let rd = Math.hypot(rx, ry);
    if (!(rd > EPS) && report.plan) { rx = report.plan.nx; ry = report.plan.ny; rd = 1; }
    if (rd > EPS && (insideNow || report.plan)) {
      report.accel = maxAccel;
      report.ax = rx / rd * maxAccel;
      report.ay = ry / rd * maxAccel;
    }
    return report;
  }

  // Time-of-impact movement plans published for the canonical projectile
  // integration pass. Keyed by the real projectile object, consumed exactly
  // once per frame by reworkUpdateProjectiles().
  const movementPlans = new WeakMap();
  function consumeMovementPlan(p) {
    const plan = movementPlans.get(p);
    if (plan) movementPlans.delete(p);
    return plan || null;
  }

  // Called once immediately before the canonical projectile movement pass.
  function stepProjectiles(dt, projectiles, combatantOfBody, now) {
    const t = now == null ? Number(globalScope.matchClock) || 0 : now;
    const live = activeFields(t);
    const influenced = [];
    lastCaptureEvents = [];
    for (const p of projectiles || []) {
      if (!isEligibleBullet(p)) continue;
      const rec = projectileRecord(p); // authored emission speed, captured before force
      let ax = 0, ay = 0, dvx = 0, dvy = 0;
      const by = [];
      const entries = [];
      let bestPlan = null;
      const captures = [];
      for (const f of live) {
        if (!hostileTo(p, f.owner, combatantOfBody)) continue;
        if (f.state.kind === 'a1') {
          // A1 acquisition is UNCHANGED (owner: "A1 is very good and fun").
          const cx = f.owner.anchor.x, cy = f.owner.anchor.y;
          const dx = cx - p.x, dy = cy - p.y;
          const radius = f.cfg.bulletRadius ?? CONSTANTS.A1_BULLET_RADIUS;
          const maxAccel = f.cfg.bulletAcceleration ?? CONSTANTS.A1_BULLET_ACCEL;
          const d = Math.hypot(dx, dy);
          if (!(d > EPS) || d >= radius) continue;
          const u = clamp(1 - d / radius, 0, 1);
          const accel = maxAccel * u * u;
          ax += dx / d * accel;
          ay += dy / d * accel;
          by.push({ kind: 'a1', owner: f.owner });
        } else {
          const report = applyA2BulletRepulsion(p, rec, f, dt);
          if (!report) continue;
          ax += report.ax || 0;
          ay += report.ay || 0;
          dvx += report.dvx || 0;
          dvy += report.dvy || 0;
          by.push({ kind: 'a2', owner: f.owner });
          if (report.entry) entries.push({ owner: f.owner, ...report.entry });
          if (report.captureRadial) captures.push({ owner: f.owner, ...report.captureRadial });
          // Earliest real crossing across every hostile field wins the frame.
          if (report.plan && (!bestPlan || report.plan.t < bestPlan.t)) bestPlan = report.plan;
        }
      }
      if (!by.length) continue;

      if (bestPlan) {
        // Publish the split-integration plan. Velocity is NOT written here:
        // the canonical pass travels frameStart -> boundary with the ORIGINAL
        // velocity, applies the response at the boundary, then integrates the
        // remaining (1-t)*dt. Continued-force terms from this frame are not
        // folded in, because they belong to the post-entry sub-step.
        movementPlans.set(p, {
          entryT: bestPlan.t,
          entryX: bestPlan.ex, entryY: bestPlan.ey,
          preVx: bestPlan.preVx, preVy: bestPlan.preVy,
          postVx: bestPlan.postVx, postVy: bestPlan.postVy,
          cx: bestPlan.cx, cy: bestPlan.cy, radius: bestPlan.radius,
        });
        lastCaptureEvents.push({
          projectile: p, owner: bestPlan.fieldOwner,
          toi: bestPlan.t, x: bestPlan.ex, y: bestPlan.ey,
          nx: bestPlan.nx, ny: bestPlan.ny,
          radialBefore: bestPlan.radialBefore,
          radialTarget: bestPlan.radialTarget,
          tangential: bestPlan.tangential,
          duration: CONSTANTS.A2_BULLET_CAPTURE_SECONDS,
          clock: t,
        });
      } else {
        p.vx += ax * dt + dvx;
        p.vy += ay * dt + dvy;
        capVelocity(p, rec.launchSpeed * CONSTANTS.BULLET_SPEED_CAP_MULT);
      }
      influenced.push({ projectile: p, fields: by, ax, ay, entries, captures, plan: bestPlan ? { t: bestPlan.t, x: bestPlan.ex, y: bestPlan.ey } : null });
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
  function applyPreparedBodyMotion(body, st, size) {
    if (!st || !st.pending || st.pending.consumed) return null;
    const move = st.pending;
    move.consumed = true;
    body.x += move.dx; body.y += move.dy;
    // Direct/unit callers do not have Fighter.resolveWalls(). Production
    // consumes this motion inside Fighter.update() and canonical walls own it.
    if (size) {
      const r = body.radius || 75;
      if (body.x < r) { body.x = r; st.vx = Math.abs(st.vx); }
      else if (body.x > size - r) { body.x = size - r; st.vx = -Math.abs(st.vx); }
      if (body.y < r) { body.y = r; st.vy = Math.abs(st.vy); }
      else if (body.y > size - r) { body.y = size - r; st.vy = -Math.abs(st.vy); }
    }
    return { dx: move.dx, dy: move.dy, vx: st.vx, vy: st.vy };
  }
  function prepareBodies(dt, live, opts) {
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
      const st = existing || { vx: 0, vy: 0, integrations: 0, pending: null };
      bodyStates.set(body, st);
      if (forced) {
        st.vx += ax * dt; st.vy += ay * dt;
        capVelocity(st, 650);
      } else {
        // Donor opponent momentum and Apex push both recover; the rejected
        // bridge accidentally created a perpetual second position integrator.
        const drag = Math.exp(-5 * dt);
        st.vx *= drag; st.vy *= drag;
      }
      st.pending = { dx: st.vx * dt, dy: st.vy * dt, consumed: false };
      st.integrations += 1;
      if (!opts.deferBodyMotion) applyPreparedBodyMotion(body, st, size);
      if (by.length) influenced.push({ body, fields: by, vx: st.vx, vy: st.vy });
    }
    for (const [body, st] of bodyStates) {
      const speed = Math.hypot(st.vx || 0, st.vy || 0);
      if (!present.has(body) || !(body.hp > 0) || (!live.some((field) => field.state.kind === 'a2') && speed < 0.05)) bodyStates.delete(body);
    }
    return influenced;
  }
  function prepareBodyForces(dt, options) {
    const opts = options || {};
    const now = opts.now == null ? Number(globalScope.matchClock) || 0 : opts.now;
    lastBodyInfluence = prepareBodies(dt, activeFields(now), { ...opts, deferBodyMotion: true });
    return lastBodyInfluence.length;
  }
  function consumeBodyMotion(body) {
    return applyPreparedBodyMotion(body, bodyStates.get(body), 0);
  }

  // Floor objects keep their canonical pickup-seam transaction. Body force is
  // prepared before Fighter.update in production, then consumed inside the
  // engine before its wall/collision solve. Direct callers retain immediate
  // unit compatibility unless they explicitly defer body motion.
  function stepWorld(dt, options) {
    const opts = options || {};
    const now = opts.now == null ? Number(globalScope.matchClock) || 0 : opts.now;
    const live = activeFields(now);
    lastFloorInfluence = integrateFloorFirearms(dt, live, opts);
    if (!opts.skipBodyForces) lastBodyInfluence = prepareBodies(dt, live, opts);
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
      captureEvents: lastCaptureEvents.slice(),
      worldStepCount,
    };
  }

  globalScope.APEX_MAGNET = {
    version: '1.0.0', CONSTANTS,
    canCast, castA1, castA2, activeFor, activeFields,
    isEligibleFloorFirearm, isEligibleBullet,
    stepWorld, prepareBodyForces, consumeBodyMotion,
    stepProjectiles, consumeMovementPlan, modifyFirearmEmission,
    teardown, inspect,
  };
  globalScope.apexMagnetGameplayRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
