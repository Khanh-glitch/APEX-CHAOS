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
    A2_BULLET_ENTRY_RESTITUTION: 1.0,   // LEGACY: no longer consulted by the A2 field law (H-PHYS2)
    // H-PHYS2 continuous nonlinear radial field.
    //   S(d) = (R/max(d,dSafe))^2 - 1 for d<R, else 0;  a = COUPLING * S(d) outward.
    // COUPLING is DERIVED by tools/calibrateMagnetA2Field.mjs from the single
    // owner rating A2_RADIAL_STOP_RATING = 3500 px/s inward radial, taking the
    // MAXIMUM demanded by every guaranteed current interaction. The binding
    // case is NOT the projectile (K_min 25866.6 against an 84px envelope) but
    // Hunter's 2200 px/s pounce against its 150px body-contact envelope
    // (K_min 64081.2) -- an inward object reaches a LARGER envelope EARLIER.
    A2_RADIAL_STOP_RATING: 3500,
    A2_FIELD_COUPLING: 73700,
    A2_FIELD_DSAFE: 24,
    A2_FIELD_SUBSTEP_PX: 2.0,           // bounded deterministic substep length
    A2_FIELD_MAX_SUBSTEPS: 64,
    A2_BODY_SUBSTEP_SECONDS: 1 / 480,   // bounded body force substep
    // PHYSICAL bound on field-imparted body speed. This is NOT the owner
    // rating reused as a speed limit -- it is the most work the field can
    // actually do on a fighter body, derived from the field itself:
    //
    //   body collision forbids a centre separation below 150 px (75+75), so
    //   the longest push the field can ever deliver is from d=150 out to R,
    //   giving v_max = sqrt(2*K*(R^2/150 + 150 - 2R)) = 2351 px/s.
    //
    // Anything above that is energy the field cannot physically supply and
    // only appears when something artificially holds a body at a fixed small
    // distance (the force integrator would otherwise accumulate without
    // bound, which the superseded velocity-TARGET law could not do).
    //
    // It provably does not determine the Hunter result: the §14 stop happens
    // at d~154 where the required outward speed is below this bound by
    // construction, and 2351 > the 2200 px/s pounce it must cancel. It also
    // keeps per-frame displacement under the 150 px contact envelope at every
    // supported rate (19.6 px at 1/120, 39 px at 1/60, 78 px at 1/30), so
    // field motion still enters the canonical collision solve.
    A2_FIELD_MAX_WORK_SPEED: Math.sqrt(2 * 73700 * ((225 * 225) / 150 + 150 - 2 * 225)),
    // Separate NUMERICAL ceiling for an EXPLICIT mover that is actively
    // propelling itself into the field. The work bound above describes the
    // most the field can give a FREE body; a mover being driven inward keeps
    // having work done on it, so that bound does not apply and using it would
    // silently decide the §14 outcome. This value is pure anti-tunnelling:
    // (bodyRadius/2) / substep = (75/2) / (1/480) = 18000 px/s, ~7.7x above
    // anything reachable, so it never determines a physical result either.
    A2_EXPLICIT_MOVER_CEILING: 18000,
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
    // Donor A2 body law (MAGNET_FINAL_DONOR_MAX.html L815-817) is a radial
    // VELOCITY TARGET, not an acceleration: push = 1050 * fall * f2 with a
    // LINEAR falloff, approached at k = min(1, dt*10).
    A2_BODY_PUSH_SPEED: 1050,
    A2_BODY_PUSH_APPROACH: 10,
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
    // Ordinary firearm bullets and V4.3 PHYSICAL projectiles are kinetic.
    // V43 devices are NOT in CFG.isGun(): requiring isFirearm here silently
    // let rockets/steel balls pass through Magnet A2. Flame, flare, plasma,
    // and post-impact burns are NOT deflectable by a magnetic field.
    const normal=p?.type==='aq_bullet'&&isFirearm(p.weapon);
    const special=globalScope.APEX_ARSENAL_CONFIG?.V43_WEAPONS?.[p?.weapon];
    const physical=p?.type==='aq_v43'&&!!special&&special.tier!=='T6'
      &&(['bolt','ball','rocket','boomerang','fragment'].includes(p.kind)
        ||(p.kind==='mine'&&p.phase==='flight'));
    return !!p && p.aq===true && p.life>0 && !isT6Weapon(p.weapon)
      && (normal||physical) && !(p.__hr && p.__hr.cryHold);
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
  // ---- H-PHYS2: the ONE spatial field-strength function -------------------
  // Shared by bullets, bodies and floor firearms. S(R)=0 exactly, continuous
  // at R, monotonically increasing as d falls, finite everywhere via dSafe.
  // There is deliberately NO speed term and NO branch: the speed tiering is an
  // emergent consequence of integrating this force, never a scripted outcome.
  function fieldStrength(d, radius) {
    if (!(d < radius)) return 0;
    const q = radius / Math.max(d, CONSTANTS.A2_FIELD_DSAFE);
    return q * q - 1;
  }
  // Hostile A2 field acceleration at an arbitrary point, for explicit movers
  // that must integrate the field DURING their own movement (H-PHYS2 §13)
  // rather than receiving an unrelated after-the-fact nudge. Same S(d), same
  // coupling, vector-summed over every hostile field.
  function fieldAccelerationAt(x, y, body, combatantOfBody, now) {
    const t = now == null ? Number(globalScope.matchClock) || 0 : now;
    const live = activeFields(t);
    const ofBody = combatantOfBody || (() => null);
    let ax = 0, ay = 0;
    for (const field of live) {
      if (field.state.kind !== 'a2') continue;
      const ct = ofBody(body);
      if (ct ? ct === field.owner : (field.owner.bodies && field.owner.bodies.includes(body))) continue;
      const dx = x - field.owner.anchor.x, dy = y - field.owner.anchor.y;
      const d = Math.hypot(dx, dy), radius = field.cfg.radius ?? CONSTANTS.A2_RADIUS;
      if (!(d > EPS) || d >= radius) continue;
      const a = fieldCoupling(field) * fieldStrength(d, radius);
      ax += (dx / d) * a; ay += (dy / d) * a;
    }
    return { ax, ay, active: ax !== 0 || ay !== 0 };
  }

  function fieldCoupling(field) {
    return field && field.cfg && Number.isFinite(field.cfg.fieldCoupling)
      ? field.cfg.fieldCoupling : CONSTANTS.A2_FIELD_COUPLING;
  }

  // ---- H-PHYS2 continuous-field projectile integration --------------------
  //
  // Supersedes the wall-like law. The R=225 swept crossing no longer means
  // "collision occurred"; it means ONLY "force integration starts here".
  // At entry: position continuous, VELOCITY CONTINUOUS, acceleration begins
  // from S(R)=0, so there is no boundary impulse and no radial SET.
  //
  // Returns a PLAN describing the real curved path travelled this frame as
  // ordered sub-segments. Nothing is mutated here.
  function integrateA2Bullet(p, rec, field, dt) {
    const cx = field.owner.anchor.x, cy = field.owner.anchor.y;
    const radius = field.cfg.radius ?? CONSTANTS.A2_RADIUS;
    const K = fieldCoupling(field);

    let ep = rec.a2.get(field.state);
    if (!ep) { ep = { entered: false }; rec.a2.set(field.state, ep); }

    const d0 = Math.hypot(p.x - cx, p.y - cy);
    const rearm = radius * CONSTANTS.A2_BULLET_REARM_RADIUS_MULT;
    if (ep.entered && d0 > rearm) ep.entered = false;

    const insideNow = d0 < radius;
    // Swept detection remains REQUIRED: a fast projectile can cross a large
    // part of the field in one step, so position-only sampling is invalid.
    const tEnter = insideNow ? 0 : sweptEntry(p.x, p.y, p.vx * dt, p.vy * dt, cx, cy, radius);
    if (!insideNow && !(tEnter >= 0)) return null;

    const t0 = insideNow ? 0 : tEnter;
    const ex = p.x + p.vx * dt * t0, ey = p.y + p.vy * dt * t0;

    // Integrate the remaining frame fraction under the continuous force with
    // bounded deterministic substeps. Semi-implicit Euler; substep count is
    // driven by travel distance so the result converges across supported dt.
    const remain = (1 - t0) * dt;
    let x = ex, y = ey, vx = p.vx, vy = p.vy;
    const speed = Math.hypot(vx, vy);
    const sub = Math.max(1, Math.min(CONSTANTS.A2_FIELD_MAX_SUBSTEPS,
      Math.ceil((speed * remain) / CONSTANTS.A2_FIELD_SUBSTEP_PX)));
    const h = remain / sub;
    const poly = [];
    let minRadius = Math.hypot(x - cx, y - cy);
    let peakAccel = 0;
    // The field is unbounded as d -> dSafe (S(dSafe) ~ 86.9, so a ~ 6.4e6
    // px/s^2). Without the canonical projectile speed cap a deep pass could
    // integrate to an absurd exit speed. This is the SAME cap the pre-H-PHYS2
    // continued-force path already applied -- it bounds magnitude only and
    // never changes direction, so it cannot reintroduce a radial SET.
    const speedCap = rec.launchSpeed * CONSTANTS.BULLET_SPEED_CAP_MULT;
    for (let i = 0; i < sub; i++) {
      let rx = x - cx, ry = y - cy;
      const d = Math.hypot(rx, ry);
      if (d > EPS) {
        const S = fieldStrength(d, radius);
        const a = K * S;
        if (a > peakAccel) peakAccel = a;
        // Radial force ONLY. Tangential motion is never directly destroyed.
        vx += (rx / d) * a * h;
        vy += (ry / d) * a * h;
      }
      const sp = Math.hypot(vx, vy);
      if (speedCap >= 0 && sp > speedCap) { const k = speedCap / sp; vx *= k; vy *= k; }
      const px0 = x, py0 = y;
      x += vx * h; y += vy * h;
      const rr = Math.hypot(x - cx, y - cy);
      if (rr < minRadius) minRadius = rr;
      poly.push({
        x0: px0, y0: py0, x1: x, y1: y,
        t0: t0 + (i / sub) * (1 - t0), t1: t0 + ((i + 1) / sub) * (1 - t0),
        vx, vy,
      });
    }

    const entryRadial = (() => {
      const nx = ex - cx, ny = ey - cy, nd = Math.hypot(nx, ny);
      return nd > EPS ? (p.vx * nx + p.vy * ny) / nd : 0;
    })();

    const firstEntry = !ep.entered;
    ep.entered = true;
    return {
      radius, cx, cy,
      plan: {
        t: t0, ex, ey,
        fieldOwner: field.owner, fieldState: field.state,
        preVx: p.vx, preVy: p.vy,
        postVx: vx, postVy: vy,
        finalX: x, finalY: y,
        poly, minRadius, peakAccel,
        entryRadial, insideAtFrameStart: insideNow,
      },
      firstEntry,
      telemetry: {
        entryRadialVelocity: entryRadial,
        totalSpeed: speed,
        distance: d0,
        strength: fieldStrength(Math.max(minRadius, EPS), radius),
        coupling: K,
        peakRadialAccel: peakAccel,
        minRadius,
        substeps: sub,
      },
    };
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

  // Episode bookkeeping for the frame, so an entry can be rolled back if a
  // physically EARLIER event (Crystal contact, Mirror capture) proves the
  // projectile never actually reached the A2 boundary.
  const pendingEntries = new WeakMap();

  // Called by the ordered-path adjudicator in heroReworkRuntime when another
  // subsystem wins at a smaller global frame fraction. Undoes the entry
  // episode so the field can legitimately catch this projectile later, and
  // withdraws the capture beat so presentation never shows a catch that did
  // not physically occur.
  function revokeEntry(p) {
    const rec = projectileState.get(p);
    const pend = pendingEntries.get(p);
    if (pend && rec && rec.a2) {
      const ep = rec.a2.get(pend.fieldState);
      if (ep) { ep.entered = false; ep.capture = null; }
    }
    pendingEntries.delete(p);
    movementPlans.delete(p);
    const before = lastCaptureEvents.length;
    lastCaptureEvents = lastCaptureEvents.filter((e) => e.projectile !== p);
    for (const inf of lastProjectileInfluence) {
      if (inf.projectile === p) { inf.entries = []; inf.plan = null; inf.revoked = true; }
    }
    return before !== lastCaptureEvents.length;
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
          const report = integrateA2Bullet(p, rec, f, dt);
          if (!report) continue;
          by.push({ kind: 'a2', owner: f.owner });
          if (report.firstEntry) {
            entries.push({ owner: f.owner, x: report.plan.ex, y: report.plan.ey, t: report.plan.t,
              cx: report.cx, cy: report.cy,
              radialBefore: report.plan.entryRadial,
              // H-PHYS2: velocity is CONTINUOUS across field entry. There is no
              // radialAfter=0 snap; the field only begins acting here.
              radialAfter: report.plan.entryRadial });
          }
          captures.push({ owner: f.owner, ...report.telemetry });
          // Earliest real engagement across every hostile field wins the frame.
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
          finalX: bestPlan.finalX, finalY: bestPlan.finalY,
          // Real travelled curve as ordered sub-segments (H-PHYS2 §12). The
          // consumer must NOT collapse this into a frame-start -> frame-end
          // chord: Crystal, Mirror and body contact all read the real path.
          poly: bestPlan.poly,
          minRadius: bestPlan.minRadius,
          cx: bestPlan.cx, cy: bestPlan.cy, radius: bestPlan.radius,
        });
        // Direct/unit callers of stepProjectiles have no canonical movement
        // pass to consume the plan, so publish the integrated VELOCITY here
        // too. Position is deliberately NOT written: reworkUpdateProjectiles
        // samples p.px/p.py after this call and owns the one position
        // integration, and it assigns exactly these same postV values, so
        // production behaviour is unchanged.
        p.vx = bestPlan.postVx; p.vy = bestPlan.postVy;
        pendingEntries.set(p, { fieldState: bestPlan.fieldState });
        lastCaptureEvents.push({
          projectile: p, owner: bestPlan.fieldOwner,
          toi: bestPlan.t, x: bestPlan.ex, y: bestPlan.ey,
          nx: bestPlan.nx, ny: bestPlan.ny,
          radialBefore: bestPlan.entryRadial,
          outVx: bestPlan.postVx, outVy: bestPlan.postVy,
          minRadius: bestPlan.minRadius,
          peakAccel: bestPlan.peakAccel,
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
          dx = -dx; dy = -dy;
          // H-PHYS2 §16: the u^2 floor-gun curve is no longer an independent
          // authority. Floor firearms consume the SAME S(d) as bullets and
          // bodies. Their own gunSpeedCap remains their interaction-model
          // bound; wall/body/pickup authority is untouched.
          const accel = fieldCoupling(field) * fieldStrength(d, radius);
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
      // Result-only provenance: remember which genuine A1 moved this gun.
      // If BOTH Magnets pulled it, neither may claim unique ownership.
      if(Math.hypot(st.vx,st.vy)>1){for(const source of by){
        if(source.kind==='a1'&&source.owner?.anchor?.id!=null){
          if(!slot.__resultMagnetA1Owners)slot.__resultMagnetA1Owners=new Set();
          slot.__resultMagnetA1Owners.add(source.owner.anchor.id);
        }
      }}
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
    const now = opts.now == null ? Number(globalScope.matchClock) || 0 : opts.now;
    const bodies = opts.bodies || [];
    const combatantOfBody = opts.combatantOfBody || (() => null);
    const size = opts.gameSize || Number(globalScope.GAME_SIZE) || 1000;
    const present = new Set(bodies);
    const influenced = [];
    for (const body of bodies) {
      if (!body || !(body.hp > 0)) continue;
      // An explicit mover that already integrated this field inside its own
      // movement this frame must not receive the force a second time.
      if (body.__hrExplicitFieldFrame != null
        && body.__hrExplicitFieldFrame === globalScope.APEX_HERO_REWORK?.__frameSeq) {
        bodyStates.delete(body); continue;
      }
      const targetCt = combatantOfBody(body);
      let ax = 0, ay = 0, forced = false;
      const by = [];
      const radialTargets = [];
      let field0Cap = 650;
      for (const field of live) {
        if (field.state.kind !== 'a2') continue;
        field0Cap = field.cfg.bodyRadialSpeedCap ?? 650;
        if (targetCt ? targetCt === field.owner : field.owner.bodies && field.owner.bodies.includes(body)) continue;
        const dx = body.x - field.owner.anchor.x, dy = body.y - field.owner.anchor.y;
        const d = Math.hypot(dx, dy), radius = field.cfg.radius ?? CONSTANTS.A2_RADIUS;
        if (!(d > EPS) || d >= radius) continue;
        // ---- H-PHYS2: the SAME continuous field the projectile law uses ----
        //
        // Supersedes the previous linear `fall = 1 - d/radius` radial-SPEED
        // target. That shape is explicitly no longer an independent authority
        // (H-PHYS2 §1/§6/§7): one S(d) is shared by bullets, bodies and floor
        // firearms, and it must grow NONLINEARLY as distance falls.
        //
        // The body is the BINDING calibration case: Hunter's 2200 px/s pounce
        // against its 150 px body-contact envelope demands K_min 64081.2,
        // versus 25866.6 for the projectile. So the body consumes the shared
        // coupling directly, with no extra per-object factor.
        radialTargets.push({ ux: dx / d, uy: dy / d, radius,
          cx: field.owner.anchor.x, cy: field.owner.anchor.y, fieldRef: field });
        forced = true;
        by.push({ kind: 'a2', owner: field.owner });
      }
      const existing = bodyStates.get(body);
      if (!forced && !existing) continue;
      const st = existing || { vx: 0, vy: 0, integrations: 0, pending: null };
      bodyStates.set(body, st);
      if (forced) {
        // H-PHYS2: true force integration, dv = a*dt. The radial component is
        // never SET and tangential motion is never destroyed, so a body can
        // slide/curve around Magnet instead of meeting an invisible circle.
        //
        // Multiple overlapping hostile fields SUM their acceleration vectors
        // (§23) rather than sequentially assigning velocity, so iteration
        // order cannot change the outcome.
        // Bounded deterministic substeps. A single Euler step over a large dt
        // would hugely overshoot (S grows fast inward), producing exactly the
        // explosive numerical launch §15 forbids. Substep count is driven by
        // the field gradient the body is standing in, so the result converges
        // across supported rates.
        const sub = Math.max(1, Math.min(CONSTANTS.A2_FIELD_MAX_SUBSTEPS,
          Math.ceil(dt / CONSTANTS.A2_BODY_SUBSTEP_SECONDS)));
        const h = dt / sub;
        let bx = body.x, byp = body.y, moved = 0;
        const path = [];
        for (let i = 0; i < sub; i++) {
          let axf = 0, ayf = 0;
          for (const rt of radialTargets) {
            // Re-evaluate S at the body's advancing position so the force is
            // integrated along the real path, not frozen at frame start.
            const ddx = bx - rt.cx, ddy = byp - rt.cy;
            const dd = Math.hypot(ddx, ddy);
            if (!(dd > EPS)) continue;
            const a = fieldCoupling(rt.fieldRef) * fieldStrength(dd, rt.radius);
            axf += (ddx / dd) * a; ayf += (ddy / dd) * a;
          }
          st.vx += axf * h; st.vy += ayf * h;
          // Physical work bound -- see A2_FIELD_MAX_WORK_SPEED. The owner
          // rating is a FIELD POWER anchor and is deliberately NOT reused as a
          // velocity ceiling here.
          const sp = Math.hypot(st.vx, st.vy);
          if (sp > CONSTANTS.A2_FIELD_MAX_WORK_SPEED) {
            const k = CONSTANTS.A2_FIELD_MAX_WORK_SPEED / sp; st.vx *= k; st.vy *= k;
          }
          const sx = bx, sy = byp;
          bx += st.vx * h; byp += st.vy * h; moved += 1;
          // W3: publish the REAL travelled body sub-segments, not just the
          // summed displacement, so physical-contact consumers can query the
          // actual curve the field produced.
          path.push({ x0: sx, y0: sy, x1: bx, y1: byp, vx: st.vx, vy: st.vy });
        }
        st.__fieldDx = bx - body.x; st.__fieldDy = byp - body.y;
        st.fieldPath = path;
        // The outward speed the field may impart is bounded by the ONE owner
        // rating, not by the legacy 650 bodyRadialSpeedCap. That cap is
        // mathematically incapable of satisfying §14: it could add at most
        // 650 px/s outward against a 2200 px/s inbound pounce, leaving 1550
        // px/s of net closing speed, so Hunter would always reach the body.
      } else {
        // Donor opponent momentum and Apex push both recover; the rejected
        // bridge accidentally created a perpetual second position integrator.
        const drag = Math.exp(-5 * dt);
        st.vx *= drag; st.vy *= drag;
      }
      st.pending = {
        dx: Number.isFinite(st.__fieldDx) ? st.__fieldDx : st.vx * dt,
        dy: Number.isFinite(st.__fieldDy) ? st.__fieldDy : st.vy * dt,
        consumed: false,
      };
      st.__fieldDx = st.__fieldDy = undefined;
      if (!forced) st.fieldPath = null;
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
  // W3: the ordered sub-segments the field actually drove this body through.
  function bodyFieldPath(body) {
    const st = bodyStates.get(body);
    return st && st.fieldPath && st.fieldPath.length ? st.fieldPath : null;
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
    stepWorld, prepareBodyForces, consumeBodyMotion, bodyFieldPath, fieldAccelerationAt,
    EXPLICIT_MOVER_CEILING: CONSTANTS.A2_EXPLICIT_MOVER_CEILING,
    stepProjectiles, consumeMovementPlan, revokeEntry, modifyFirearmEmission,
    teardown, inspect,
  };
  globalScope.apexMagnetGameplayRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
