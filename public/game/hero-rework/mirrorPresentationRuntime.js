/* =============================================================================
 * MIRROR G1B — thin production/Gold lifecycle + fixed-step bridge.
 *
 * APEX owns combatant identity, roots, velocity, events and match lifetime.
 * APEX_MIRROR_GOLD owns the isolated authored presentation instance. This
 * bridge never draws, simulates demo gameplay, creates an rAF clock, or writes
 * gameplay coordinates. hrPostTick(dt) is its sole production clock seam.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_MIRROR_PRESENTATION) return;

  const HR = g.APEX_HERO_REWORK;
  const AIL = g.APEX_HERO_REWORK_AIL;
  const GOLD = g.APEX_MIRROR_GOLD;
  const STEP = 1 / 120;
  const MAX_SUBSTEPS = 8;
  const MAX_FRAME_DT = STEP * MAX_SUBSTEPS;
  const EPSILON = 1e-12;
  const instances = new Map();
  const unsubscribers = [];
  const scheduler = {
    tickCalls: 0, advancedSteps: 0, createdInstances: 0, destroyedInstances: 0,
    droppedSeconds: 0, invalidDt: 0, invalidRoots: 0, errors: 0, exchangeEvents: 0,
  };
  let boundMatch = null;
  let disposed = false;

  function currentMatch() {
    return HR && HR.match ? HR.match : null;
  }

  function opponentOf(match, ct) {
    const combatants = match && match.combatants;
    if (!combatants) return null;
    for (let i = 0; i < combatants.length; i++) {
      if (combatants[i] === ct) return combatants[i === 0 ? 1 : 0] || null;
    }
    return null;
  }

  function seedFor(ct) {
    return (0x4d495252 ^ Math.imul(((Number(ct.idx) || 0) + 1) >>> 0, 0x9e3779b1)) >>> 0 || 1;
  }

  function rootAim(body, other) {
    const holder = body && body.data && body.data.arsenal;
    const authoredAim = holder && holder.meta && holder.meta.aimAngle;
    if (Number.isFinite(authoredAim)) return authoredAim;
    return Math.atan2(other.y - body.y, other.x - body.x);
  }

  // Mutate one preallocated Gold root sample; never allocate per production
  // frame. `movementFrom` is used only for a real MirrorExchange event, whose
  // post-swap destination must not be mistaken for a physical velocity vector.
  function fillRootSample(sample, body, other, dt, movementFrom) {
    if (!body || !other || !Number.isFinite(body.x) || !Number.isFinite(body.y)
        || !Number.isFinite(other.x) || !Number.isFinite(other.y)) return false;
    sample.id = body.id;
    sample.x = body.x;
    sample.y = body.y;
    sample.aim = rootAim(body, other);
    const start = body.__hrFrameStart;
    if (dt > 0 && start && Number.isFinite(start.x) && Number.isFinite(start.y)) {
      const endX = movementFrom && Number.isFinite(movementFrom.x) ? movementFrom.x : body.x;
      const endY = movementFrom && Number.isFinite(movementFrom.y) ? movementFrom.y : body.y;
      sample.vx = (endX - start.x) / dt;
      sample.vy = (endY - start.y) / dt;
    } else if (dt > 0 && body.__hrFrameMotion) {
      const motion = body.__hrFrameMotion;
      const external = body.__hrExternalVelocity || null;
      sample.vx = (Number(motion.locomotionVx) || 0) + (Number(motion.engineForceVx) || 0)
        + (external ? Number(external.x) || 0 : 0);
      sample.vy = (Number(motion.locomotionVy) || 0) + (Number(motion.engineForceVy) || 0)
        + (external ? Number(external.y) || 0 : 0);
    } else {
      sample.vx = 0;
      sample.vy = 0;
    }
    return true;
  }

  function makeState(match, ct, opponent) {
    const mirrorBody = ct && ct.anchor;
    const opponentBody = opponent && opponent.anchor;
    if (!GOLD || typeof GOLD.createMirrorInstance !== 'function'
        || !mirrorBody || !opponentBody
        || !Number.isFinite(mirrorBody.x) || !Number.isFinite(mirrorBody.y)
        || !Number.isFinite(opponentBody.x) || !Number.isFinite(opponentBody.y)) return null;

    const state = {
      match, ct, opponent, gold: null, accumulator: 0, totalSteps: 0,
      droppedSeconds: 0, pendingExchange: null, exchangeEvents: 0,
      mirrorSample: { id: mirrorBody.id, x: mirrorBody.x, y: mirrorBody.y, vx: 0, vy: 0, aim: 0 },
      opponentSample: {
        id: opponentBody.id, x: opponentBody.x, y: opponentBody.y,
        vx: 0, vy: 0, aim: 0, armed: !!(opponentBody.data && opponentBody.data.arsenal
          && opponentBody.data.arsenal.weaponId),
      },
    };
    if (!fillRootSample(state.mirrorSample, mirrorBody, opponentBody, 0, null)
        || !fillRootSample(state.opponentSample, opponentBody, mirrorBody, 0, null)) return null;
    state.opponentSample.armed = !!(opponentBody.data && opponentBody.data.arsenal
      && opponentBody.data.arsenal.weaponId);
    try {
      state.gold = GOLD.createMirrorInstance({ seed: seedFor(ct) });
      if (!state.gold || !state.gold.enableExternalTruth
          || !state.gold.enableExternalTruth(state.mirrorSample, state.opponentSample)) {
        if (state.gold && state.gold.clearExternalTruth) state.gold.clearExternalTruth();
        return null;
      }
      instances.set(ct, state);
      scheduler.createdInstances++;
      return state;
    } catch (error) {
      scheduler.errors++;
      if (state.gold && state.gold.clearExternalTruth) {
        try { state.gold.clearExternalTruth(); } catch (ignored) {}
      }
      return null;
    }
  }

  function destroyState(ct, state) {
    if (state && state.gold && state.gold.clearExternalTruth) {
      try { state.gold.clearExternalTruth(); } catch (error) { scheduler.errors++; }
    }
    instances.delete(ct);
    if (state) scheduler.destroyedInstances++;
  }

  function teardown() {
    for (const [ct, state] of instances) destroyState(ct, state);
    instances.clear();
    boundMatch = null;
  }

  function reconcile(match) {
    if (match !== boundMatch) {
      teardown();
      boundMatch = match;
    }
    if (!match || !Array.isArray(match.combatants)) return;

    const combatants = match.combatants;
    for (let i = 0; i < combatants.length; i++) {
      const ct = combatants[i];
      if (!ct || ct.facade || ct.heroId !== 'MIRROR') continue;
      const opponent = opponentOf(match, ct);
      if (!opponent || !opponent.anchor) continue;
      const existing = instances.get(ct);
      if (existing) existing.opponent = opponent;
      else if (instances.size < 2) makeState(match, ct, opponent);
    }

    for (const [ct, state] of instances) {
      const live = combatants.includes(ct) && !ct.facade && ct.heroId === 'MIRROR';
      const opponent = live ? opponentOf(match, ct) : null;
      if (!opponent || !combatants.includes(opponent) || !opponent.anchor) destroyState(ct, state);
      else state.opponent = opponent;
    }
  }

  function onMatchInstall() {
    if (!disposed) reconcile(currentMatch());
  }

  function onMatchTeardown() {
    teardown();
  }

  function onMirrorExchange(event) {
    const payload = event && event.payload ? event.payload : event;
    if (disposed || !payload || !payload.self || !payload.opponent
        || !payload.self.from || !payload.opponent.from) return;
    for (const state of instances.values()) {
      const id = state.ct && state.ct.anchor && state.ct.anchor.id;
      if (id == null) continue;
      if (payload.self.id === id) {
        state.pendingExchange = {
          mirrorFrom: payload.self.from,
          opponentFrom: payload.opponent.from,
        };
      } else if (payload.opponent.id === id) {
        state.pendingExchange = {
          mirrorFrom: payload.opponent.from,
          opponentFrom: payload.self.from,
        };
      } else continue;
      state.exchangeEvents++;
      scheduler.exchangeEvents++;
    }
  }

  function refreshRoots(state, dt) {
    const mirrorBody = state.ct && state.ct.anchor;
    const opponentBody = state.opponent && state.opponent.anchor;
    const exchange = state.pendingExchange;
    const mirrorFrom = exchange && exchange.mirrorFrom;
    const opponentFrom = exchange && exchange.opponentFrom;
    const valid = fillRootSample(state.mirrorSample, mirrorBody, opponentBody, dt, mirrorFrom)
      && fillRootSample(state.opponentSample, opponentBody, mirrorBody, dt, opponentFrom);
    state.pendingExchange = null;
    if (!valid) {
      scheduler.invalidRoots++;
      return false;
    }
    state.opponentSample.armed = !!(opponentBody.data && opponentBody.data.arsenal
      && opponentBody.data.arsenal.weaponId);
    return state.gold.syncExternalTruth(state.mirrorSample, state.opponentSample);
  }

  function tick(dt) {
    if (disposed) return false;
    scheduler.tickCalls++;
    const match = currentMatch();
    if (match !== boundMatch) reconcile(match);
    if (!match || instances.size === 0) return false;

    const validDt = Number.isFinite(dt) && dt >= 0;
    if (!validDt) scheduler.invalidDt++;
    const frameDt = validDt ? Math.min(dt, MAX_FRAME_DT) : 0;
    if (validDt && dt > frameDt) scheduler.droppedSeconds += dt - frameDt;
    let advanced = false;

    for (const state of instances.values()) {
      if (!refreshRoots(state, validDt ? dt : 0)) continue;
      if (frameDt <= 0) continue;
      state.accumulator += frameDt;
      let substeps = 0;
      while (state.accumulator + EPSILON >= STEP && substeps < MAX_SUBSTEPS) {
        try {
          if (!state.gold.stepExternalPresentation(STEP)) break;
          state.accumulator = Math.max(0, state.accumulator - STEP);
          state.totalSteps++;
          scheduler.advancedSteps++;
          substeps++;
          advanced = true;
        } catch (error) {
          scheduler.errors++;
          break;
        }
      }
      if (state.accumulator >= STEP && substeps >= MAX_SUBSTEPS) {
        const remainder = state.accumulator % STEP;
        const dropped = state.accumulator - remainder;
        state.accumulator = remainder;
        state.droppedSeconds += dropped;
        scheduler.droppedSeconds += dropped;
      }
    }
    return advanced;
  }

  function inspect() {
    const records = [];
    for (const [ct, state] of instances) {
      records.push({
        combatantIndex: ct.idx,
        heroId: ct.heroId,
        mirrorId: ct.anchor && ct.anchor.id,
        opponentId: state.opponent && state.opponent.anchor && state.opponent.anchor.id,
        accumulator: state.accumulator,
        totalSteps: state.totalSteps,
        droppedSeconds: state.droppedSeconds,
        exchangeEvents: state.exchangeEvents,
        external: state.gold.externalAudit(),
      });
    }
    return {
      version: 'g1b-thin-fixed-step-bridge',
      fixedStep: STEP,
      maxSubsteps: MAX_SUBSTEPS,
      matchBound: !!boundMatch,
      instanceCount: instances.size,
      scheduler: { ...scheduler },
      records,
    };
  }

  function dispose() {
    teardown();
    disposed = true;
    while (unsubscribers.length) {
      const unsubscribe = unsubscribers.pop();
      try { unsubscribe(); } catch (error) { scheduler.errors++; }
    }
    if (g.APEX_MIRROR_PRESENTATION === api) delete g.APEX_MIRROR_PRESENTATION;
  }

  const api = { version: 'g1b-thin-fixed-step-bridge', fixedStep: STEP, tick, teardown, inspect, dispose };

  if (AIL && AIL.bus && typeof AIL.bus.on === 'function') {
    unsubscribers.push(AIL.bus.on('ReworkMatchInstall', onMatchInstall));
    unsubscribers.push(AIL.bus.on('ReworkMatchTeardown', onMatchTeardown));
    // The exchange is a coordinate teleport, not a velocity impulse. Retain
    // its PRE-SWAP movement samples so the next post-tick binds honest velocity.
    unsubscribers.push(AIL.bus.on('MirrorExchange', onMirrorExchange));
  }
  g.APEX_MIRROR_PRESENTATION = api;
  reconcile(currentMatch());
  g.apexMirrorPresentationRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
