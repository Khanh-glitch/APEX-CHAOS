/* =============================================================================
 * MIRROR G2B — Gold actor/A1/A2 presentation on the G1B fixed-step bridge.
 *
 * APEX owns combatant identity, roots, velocity, events and match lifetime.
 * APEX_MIRROR_GOLD owns the isolated authored presentation instance. This
 * adapter uses hrPostTick(dt) as its sole clock and never writes gameplay
 * coordinates or creates a second actor/world render lifecycle.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_MIRROR_PRESENTATION) return;

  const HR = g.APEX_HERO_REWORK;
  const AIL = g.APEX_HERO_REWORK_AIL;
  const GOLD = g.APEX_MIRROR_GOLD;
  const VERSION = 'r2-semantic-gold-presentation';
  const STEP = 1 / 120;
  const MAX_SUBSTEPS = 8;
  const PASSIVE_SHARD_SLOTS = 16;
  const PASSIVE_NODE_SLOTS = 4;
  const PASSIVE_NODE_MEMBERS = 5;
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
  let drawPrototype = null;
  let previousDraw = null;
  let drawWrapper = null;

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

  function rootAimAt(body, x, y, otherX, otherY) {
    const holder = body && body.data && body.data.arsenal;
    const authoredAim = holder && holder.meta && holder.meta.aimAngle;
    if (Number.isFinite(authoredAim)) return authoredAim;
    return Math.atan2(otherY - y, otherX - x);
  }

  function rootAim(body, other) {
    return rootAimAt(body, body.x, body.y, other.x, other.y);
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
    } else if (dt > 0) {
      sample.vx = 0;
      sample.vy = 0;
    }
    return true;
  }

  const IDENTITY_SURFACE_SIZE = 256;
  const IDENTITY_SURFACE_CENTER = IDENTITY_SURFACE_SIZE / 2;

  function ensureOpponentIdentitySurface(state) {
    if (state.identitySurface) return true;
    if (state.identitySurfaceAttempted || !g.document) return false;
    state.identitySurfaceAttempted = true;
    try {
      const surface = g.document.createElement('canvas');
      surface.width = IDENTITY_SURFACE_SIZE;
      surface.height = IDENTITY_SURFACE_SIZE;
      const context = surface.getContext('2d');
      if (!context) { surface.width = surface.height = 0; return false; }
      state.identitySurface = surface;
      state.identityContext = context;
      return true;
    } catch (error) {
      scheduler.errors++;
      return false;
    }
  }

  function refreshOpponentIdentitySurface(state) {
    const opponent = state && state.opponent;
    const fighter = opponent && opponent.anchor;
    if (!fighter || !opponent || !ensureOpponentIdentitySurface(state)) return false;
    const ctx = state.identityContext;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, IDENTITY_SURFACE_SIZE, IDENTITY_SURFACE_SIZE);

    const robot = g.APEX_ROBOT_PRESENTATION;
    const isRobot = opponent.heroId === 'ROBOT'
      || !!(robot && typeof robot.isRobotFighter === 'function' && robot.isRobotFighter(fighter));
    if (isRobot) {
      if (!robot || typeof robot.renderActorImage !== 'function') return false;
      try { return !!robot.renderActorImage(ctx, fighter, IDENTITY_SURFACE_CENTER, IDENTITY_SURFACE_CENTER); }
      catch (error) { scheduler.errors++; return false; }
    }
    if (opponent.heroId === 'MIRROR') {
      const mirrorState = instances.get(opponent);
      if (!mirrorState || !mirrorState.gold) return false;
      try {
        if (fighter.hasStatus && fighter.hasStatus('immune')) ctx.globalAlpha = 0.55;
        mirrorState.gold.rigFull(ctx, IDENTITY_SURFACE_CENTER, IDENTITY_SURFACE_CENTER);
      } catch (error) { scheduler.errors++; return false; }
      return true;
    }
    // Finalized custom actors bypass their engine type.draw in production.
    // Invoke their explicit body-only seam at a translated snapshot root;
    // never recurse through Fighter.draw or run world/status layers.
    const presentation = opponent.heroId === 'HUNTER' ? g.APEX_HUNTER_PRESENTATION
      : opponent.heroId === 'CRYSTAL' ? g.APEX_CRYSTALA_PRESENTATION
      : opponent.heroId === 'ICE' ? g.APEX_FROST_PRESENTATION
      : opponent.heroId === 'MAGNET' ? g.APEX_MAGNET_PRESENTATION : null;
    const identityDraw = presentation && (presentation.renderIdentityBody || presentation.renderBody);
    if (typeof identityDraw === 'function') {
      ctx.save();
      try {
        ctx.translate(IDENTITY_SURFACE_CENTER - fighter.x, IDENTITY_SURFACE_CENTER - fighter.y);
        return identityDraw.call(presentation, ctx, fighter) !== false;
      } catch (error) { scheduler.errors++; return false; }
      finally { ctx.restore(); }
    }
    const type = fighter.type;
    if (!type || typeof type.draw !== 'function') return false;
    ctx.save();
    try {
      if (fighter.hasStatus && fighter.hasStatus('immune')) ctx.globalAlpha *= 0.55;
      ctx.translate(IDENTITY_SURFACE_CENTER, IDENTITY_SURFACE_CENTER);
      const dir = fighter.dir;
      ctx.rotate(Math.atan2(Number(dir && dir.y) || 0, Number(dir && dir.x) || 1));
      if (fighter.isRage) {
        const glow = fighter.color || '#ffffff';
        try { ctx.filter = `drop-shadow(0 0 5px ${glow}) drop-shadow(0 0 11px ${glow})`; } catch (error) {}
      }
      type.draw(ctx, fighter);
      return true;
    } catch (error) {
      scheduler.errors++;
      return false;
    } finally { ctx.restore(); }
  }

  function drawOpponentIdentity(state, ctx, x, y) {
    if (!state || !ctx || !state.identitySurface) return false;
    ctx.drawImage(state.identitySurface, x - IDENTITY_SURFACE_CENTER, y - IDENTITY_SURFACE_CENTER);
    return true;
  }

  // One reusable semantic snapshot per Mirror instance. The arrays and records
  // are adapter scratch only; identities and all lifecycle values are reread
  // from the real ct.store pool on every reconciliation.
  function createPassiveSnapshot() {
    const shards = new Array(PASSIVE_SHARD_SLOTS).fill(null);
    const shardInputs = new Array(PASSIVE_SHARD_SLOTS);
    for (let i = 0; i < shardInputs.length; i++) shardInputs[i] = {
      slotIndex: i, identity: null, on: false, st: 0,
      x: 0, y: 0, vx: 0, vy: 0, age: 0,
      fx: 0, fy: 0, tx: 0, ty: 0, mt0: 0, moving: false,
      provenance: null, mirrorX: 0, presentationSide: null,
    };
    const nodes = new Array(PASSIVE_NODE_SLOTS);
    for (let i = 0; i < nodes.length; i++) nodes[i] = {
      id: null, st: 0, x: 0, y: 0, rot: 0, t: 0, age: 0, t3: 0, tlock: -1,
      memberSlots: new Array(PASSIVE_NODE_MEMBERS).fill(-1),
    };
    return { snapshot: { shards, nodes: [] }, shardInputs, nodeInputs: nodes };
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
      recentExchangeCastIds: [null, null, null, null], recentExchangeWrite: 0,
      pendingA1Cast: null, pendingA1End: null, pendingA1Whiff: null,
      a1CastId: null, a1WeaponId: null, pendingWeaponImage: null,
      failedWeaponImage: null, failedWeaponId: null, failedWeaponWidth: 0, failedWeaponHeight: 0,
      a1Whiff: false, weaponArtReady: false,
      realOwn: false, drawType: null, drawOpponentIdentity: null,
      identitySurface: null, identityContext: null, identitySurfaceAttempted: false,
      pendingA2Cast: null, pendingA2End: null, pendingA2Exchange: null,
      a2CastId: null, a2NoSnap: false, a2ExchangeApplied: false, lastA2Exchange: null,
      // R2 scratch snapshots and hit-time seeds carry no lifecycle authority;
      // Gold owns every shard/node/route binding and visual envelope.
      passiveSnapshotState: createPassiveSnapshot(), shardHitSeeds: new WeakMap(),
      mirrorSample: { id: mirrorBody.id, x: mirrorBody.x, y: mirrorBody.y, vx: 0, vy: 0, aim: 0 },
      preMirrorSample: { id: mirrorBody.id, x: mirrorBody.x, y: mirrorBody.y, vx: 0, vy: 0, aim: 0 },
      preOpponentSample: {
        id: opponentBody.id, x: opponentBody.x, y: opponentBody.y,
        vx: 0, vy: 0, aim: 0, armed: !!(opponentBody.data && opponentBody.data.arsenal
          && opponentBody.data.arsenal.weaponId),
      },
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
    state.drawOpponentIdentity = function drawActualOpponent(ctx, x, y) {
      return drawOpponentIdentity(state, ctx, x, y);
    };
    state.drawType = function drawGoldMirrorBody(ctx, fighter) {
      const angle = Math.atan2(Number(fighter.dir && fighter.dir.y) || 0,
        Number(fighter.dir && fighter.dir.x) || 1);
      ctx.save();
      try {
        // Fighter.draw supplies its normal translated/rotated local actor
        // context. Return to world-space so Gold's authored rig stays upright.
        ctx.rotate(-angle);
        ctx.translate(-fighter.x, -fighter.y);
        const a2 = state.gold.A2;
        if (a2 && a2.on && (a2.band > 0.002 || a2.ghostA > 0.01))
          refreshOpponentIdentitySurface(state);
        state.gold.drawMirrorEntityWithOpponent(ctx, state.drawOpponentIdentity);
      } finally { ctx.restore(); }
    };
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
    if (state) {
      state.shardHitSeeds = new WeakMap();
      state.pendingWeaponImage = null;
      state.failedWeaponImage = null;
      state.failedWeaponId = null;
    }
    if (state && state.gold && state.gold.clearExternalTruth) {
      try { state.gold.clearExternalTruth(); } catch (error) { scheduler.errors++; }
    }
    if (state && state.identitySurface) {
      try { state.identitySurface.width = state.identitySurface.height = 0; }
      catch (error) { scheduler.errors++; }
      state.identitySurface = null;
      state.identityContext = null;
      state.identitySurfaceAttempted = false;
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

  function stateForCombatantIndex(index) {
    for (const state of instances.values()) if (state.ct.idx === index) return state;
    return null;
  }

  function stateForCast(castId) {
    if (castId == null) return null;
    for (const state of instances.values()) if (state.a1CastId === castId) return state;
    return null;
  }

  function imageReady(image) {
    if (!image) return false;
    const width = Number(image.naturalWidth || image.width) || 0;
    const height = Number(image.naturalHeight || image.height) || 0;
    if (image.complete === true) return width > 0 && height > 0;
    return image.complete == null && width > 0 && height > 0;
  }

  function validWeaponImageWrapper(wrapper) {
    return !!(wrapper && typeof wrapper === 'object' && wrapper.img
      && Number.isFinite(wrapper.w) && wrapper.w > 0
      && Number.isFinite(wrapper.h) && wrapper.h > 0);
  }

  function resetA1WeaponArt(state) {
    if (!state) return;
    state.pendingWeaponImage = null;
    state.failedWeaponImage = null; state.failedWeaponId = null;
    state.failedWeaponWidth = 0; state.failedWeaponHeight = 0;
    state.weaponArtReady = false;
    if (state.gold && typeof state.gold.setWeaponArt === 'function') {
      try { state.gold.setWeaponArt(null); }
      catch (error) { scheduler.errors++; }
    }
  }

  function resolveA1WeaponArt(state) {
    if (!state || !state.a1WeaponId || !state.gold) return false;
    const existing = state.gold.weaponArt && state.gold.weaponArt();
    if (existing && existing.source === 'production' && existing.weaponId === state.a1WeaponId) {
      state.pendingWeaponImage = null;
      state.weaponArtReady = true;
      return true;
    }
    // Arsenal's production contract is { img, w, h }. A null lookup is not a
    // terminal miss: retry on later presentation ticks until a ready wrapper
    // exists. Once a wrapper is accepted, retain that exact wrapper while its
    // underlying image finishes loading instead of allocating replacements.
    if (!state.pendingWeaponImage) {
      const av = g.APEX_ARSENAL_AV;
      if (!av || typeof av.weaponImage !== 'function') return false;
      try {
        const wrapper = av.weaponImage(state.a1WeaponId);
        if (!validWeaponImageWrapper(wrapper)) return false;
        state.pendingWeaponImage = wrapper;
      } catch (error) { scheduler.errors++; return false; }
    }
    const wrapper = state.pendingWeaponImage;
    if (!validWeaponImageWrapper(wrapper) || !imageReady(wrapper.img)) return false;
    if (state.failedWeaponImage === wrapper.img && state.failedWeaponId === state.a1WeaponId
        && state.failedWeaponWidth === wrapper.w && state.failedWeaponHeight === wrapper.h) return false;
    try {
      const art = state.gold.setWeaponArt({
        image: wrapper.img, w: wrapper.w, h: wrapper.h,
        weaponId: state.a1WeaponId, source: 'production',
      });
      state.weaponArtReady = !!(art && art.source === 'production' && art.weaponId === state.a1WeaponId);
      if (state.weaponArtReady) {
        state.pendingWeaponImage = null;
        state.failedWeaponImage = null; state.failedWeaponId = null;
      } else {
        state.failedWeaponImage = wrapper.img; state.failedWeaponId = state.a1WeaponId;
        state.failedWeaponWidth = wrapper.w; state.failedWeaponHeight = wrapper.h;
        state.pendingWeaponImage = null;
      }
    } catch (error) {
      scheduler.errors++;
      state.weaponArtReady = false;
      state.failedWeaponImage = wrapper.img; state.failedWeaponId = state.a1WeaponId;
      state.failedWeaponWidth = wrapper.w; state.failedWeaponHeight = wrapper.h;
      state.pendingWeaponImage = null;
    }
    return state.weaponArtReady;
  }

  function onMirrorA1Cast(event) {
    const payload = event && event.payload ? event.payload : event;
    if (!payload || payload.castId == null) return;
    const state = stateForCombatantIndex(payload.combatantIndex);
    if (!state) return;
    resetA1WeaponArt(state);
    state.a1CastId = payload.castId;
    state.a1WeaponId = payload.weaponId == null ? null : payload.weaponId;
    state.a1Whiff = !!payload.whiff;
    state.realOwn = false;
    state.pendingA1Cast = payload;
    state.pendingA1End = null;
    state.pendingA1Whiff = null;
    if (!state.a1Whiff) resolveA1WeaponArt(state);
  }

  function onMirrorA1Own(event) {
    const payload = event && event.payload ? event.payload : event;
    const state = payload && stateForCast(payload.castId);
    if (state) state.realOwn = true;
  }

  function onMirrorA1Whiff(event) {
    const payload = event && event.payload ? event.payload : event;
    const state = payload && stateForCast(payload.castId);
    if (!state) return;
    state.a1Whiff = true;
    state.pendingA1Whiff = payload;
    if (state.gold.A1.on && state.gold.markExternalA1Whiff(payload.castId)) state.pendingA1Whiff = null;
  }

  function onMirrorA1End(event) {
    const payload = event && event.payload ? event.payload : event;
    const state = payload && stateForCast(payload.castId);
    if (state) state.pendingA1End = payload;
  }

  function stateForA2Cast(castId) {
    if (castId == null) return null;
    for (const state of instances.values()) if (state.a2CastId === castId) return state;
    return null;
  }

  function onMirrorA2Cast(event) {
    const payload = event && event.payload ? event.payload : event;
    if (!payload || payload.castId == null) return;
    const state = stateForCombatantIndex(payload.combatantIndex);
    if (!state) return;
    state.a2CastId = payload.castId;
    state.pendingA2Cast = payload;
    state.pendingA2End = null;
    state.pendingA2Exchange = null;
    state.a2NoSnap = false;
    state.a2ExchangeApplied = false;
    state.lastA2Exchange = null;
  }

  function onMirrorA2NoSnap(event) {
    const payload = event && event.payload ? event.payload : event;
    const state = payload && stateForA2Cast(payload.castId);
    if (state) state.a2NoSnap = true;
  }

  function onMirrorA2End(event) {
    const payload = event && event.payload ? event.payload : event;
    const state = payload && stateForA2Cast(payload.castId);
    if (state) state.pendingA2End = payload;
  }

  function processPendingA1Start(state) {
    const cast = state.pendingA1Cast;
    if (cast) {
      if (state.gold.A1.on || state.gold.A2.on) return false;
      state.pendingA1Cast = null;
      if (!state.gold.beginExternalA1(cast.castId, !!cast.whiff)) {
        state.a1CastId = null;
        state.a1WeaponId = null;
        state.a1Whiff = false;
        state.realOwn = false;
        resetA1WeaponArt(state);
        state.pendingA1Whiff = null;
        return false;
      }
    }
    if (state.pendingA1Whiff && state.gold.A1.on
        && state.gold.markExternalA1Whiff(state.pendingA1Whiff.castId)) state.pendingA1Whiff = null;
    return true;
  }

  function processPendingA1End(state) {
    const ending = state.pendingA1End;
    if (!ending) return;
    state.pendingA1End = null;
    if (state.gold.endExternalA1(ending.castId)) {
      state.a1CastId = null;
      state.a1WeaponId = null;
      state.a1Whiff = false;
      state.realOwn = false;
      resetA1WeaponArt(state);
      state.pendingA1Whiff = null;
    }
  }

  function processPendingA2Start(state) {
    const cast = state.pendingA2Cast;
    if (!cast) return true;
    if (state.gold.A1.on || state.gold.A2.on) return false;
    state.pendingA2Cast = null;
    if (state.gold.beginExternalA2(cast.castId)) return true;
    state.a2CastId = null;
    state.pendingA2End = null;
    state.pendingA2Exchange = null;
    state.a2NoSnap = false;
    state.a2ExchangeApplied = false;
    state.lastA2Exchange = null;
    return false;
  }

  function processPendingA2End(state) {
    const ending = state.pendingA2End;
    if (!ending) return;
    state.pendingA2End = null;
    if (state.gold.endExternalA2(ending.castId)) {
      state.a2CastId = null;
      state.pendingA2Cast = null;
      state.pendingA2Exchange = null;
    }
  }

  function hasSeenExchangeCast(state, castId) {
    if (castId == null) return false;
    if (state.lastA2Exchange && state.lastA2Exchange.castId === castId) return true;
    const recent = state.recentExchangeCastIds;
    for (let i = 0; i < recent.length; i++) if (recent[i] === castId) return true;
    recent[state.recentExchangeWrite] = castId;
    state.recentExchangeWrite = (state.recentExchangeWrite + 1) % recent.length;
    return false;
  }

  function invertExchangePerspective(event) {
    const delta = event.delta;
    return {
      ...event,
      self: event.opponent,
      opponent: event.self,
      delta: delta && { x: -delta.x, y: -delta.y },
    };
  }

  function canonicalExchangeSamples(payload) {
    // The real resolver emits every callback after the one atomic coalesced
    // swap. Later notices therefore carry POST roots for both actors in their
    // `to` fields, while their shared result's PRE pair is oriented to the
    // first request. Reconstruct the unordered PRE pair from the opposite
    // POST roots so Gold sees the same physical key for each notice.
    if (!(Number.isFinite(payload.coalesced) && payload.coalesced > 0)) return payload;
    return {
      ...payload,
      self: { ...payload.self, from: { x: payload.opponent.to.x, y: payload.opponent.to.y } },
      opponent: { ...payload.opponent, from: { x: payload.self.to.x, y: payload.self.to.y } },
    };
  }

  function onMirrorExchange(event) {
    const payload = event && event.payload ? event.payload : event;
    const actors = payload && [payload.self, payload.opponent];
    if (disposed || !payload || payload.castId == null || !actors
        || actors.some((actor) => !actor || actor.id == null
          || !actor.from || !Number.isFinite(actor.from.x) || !Number.isFinite(actor.from.y)
          || !actor.to || !Number.isFinite(actor.to.x) || !Number.isFinite(actor.to.y))) return;
    const exchange = canonicalExchangeSamples(payload);
    const casterState = Array.from(instances.values()).find((candidate) =>
      candidate.ct && candidate.ct.anchor && candidate.ct.anchor.id === payload.self.id);
    if (!casterState || casterState.a2CastId !== payload.castId) return;
    for (const state of instances.values()) {
      const id = state.ct && state.ct.anchor && state.ct.anchor.id;
      const opponentId = state.opponentSample && state.opponentSample.id;
      if (id == null || opponentId == null) continue;
      const isSelf = payload.self.id === id && payload.opponent.id === opponentId;
      const isOpponent = payload.opponent.id === id && payload.self.id === opponentId;
      if ((!isSelf && !isOpponent) || hasSeenExchangeCast(state, payload.castId)) continue;
      const perspective = isSelf ? exchange : invertExchangePerspective(exchange);
      state.pendingExchange = {
        mirrorFrom: perspective.self.from,
        opponentFrom: perspective.opponent.from,
      };
      if (state.a2CastId === payload.castId) {
        // The caster path remains the sole owner of authored A2 choreography;
        // Gold's applyExternalExchange performs the one snap and physical-key
        // dedupe for this instance.
        state.pendingA2Exchange = perspective;
      } else if (state.gold && typeof state.gold.rebaseExternalExchangeHistory === 'function') {
        // Gameplay has atomically committed POST roots before this real event.
        // A Mirror that only receives this exchange rebases history now, then
        // syncRootsAndExchange consumes pendingExchange to sample/sync POST.
        // Gold's unordered PRE/POST physical key dedupes coalesced notices even
        // when their cast IDs or perspectives differ.
        try { state.gold.rebaseExternalExchangeHistory(exchange, id); }
        catch (error) { scheduler.errors++; }
      }
      state.exchangeEvents++;
      scheduler.exchangeEvents++;
    }
  }

  function sampleRoots(state, dt) {
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
    return true;
  }

  function fillPreExchangeSamples(state, event) {
    if (!event || !event.self || !event.opponent
        || event.self.id !== state.mirrorSample.id
        || event.opponent.id !== state.opponentSample.id
        || !Number.isFinite(event.self.from && event.self.from.x)
        || !Number.isFinite(event.self.from && event.self.from.y)
        || !Number.isFinite(event.opponent.from && event.opponent.from.x)
        || !Number.isFinite(event.opponent.from && event.opponent.from.y)) return false;
    const mirror = state.preMirrorSample, opponent = state.preOpponentSample;
    mirror.id = state.mirrorSample.id;
    mirror.x = event.self.from.x; mirror.y = event.self.from.y;
    mirror.vx = state.mirrorSample.vx; mirror.vy = state.mirrorSample.vy;
    mirror.aim = rootAimAt(state.ct.anchor, mirror.x, mirror.y, event.opponent.from.x, event.opponent.from.y);
    opponent.id = state.opponentSample.id;
    opponent.x = event.opponent.from.x; opponent.y = event.opponent.from.y;
    opponent.vx = state.opponentSample.vx; opponent.vy = state.opponentSample.vy;
    opponent.aim = rootAimAt(state.opponent.anchor, opponent.x, opponent.y, event.self.from.x, event.self.from.y);
    opponent.armed = state.opponentSample.armed;
    return true;
  }

  function syncRootsAndExchange(state, dt) {
    if (!sampleRoots(state, dt)) return false;
    const exchange = state.pendingA2Exchange;
    if (exchange && state.a2CastId === exchange.castId) {
      if (state.pendingA1End) processPendingA1End(state);
      if (!fillPreExchangeSamples(state, exchange)
          || !state.gold.syncExternalTruth(state.preMirrorSample, state.preOpponentSample)) {
        state.pendingA2Exchange = null;
        return state.gold.syncExternalTruth(state.mirrorSample, state.opponentSample);
      }
      if (!processPendingA2Start(state)) {
        state.gold.syncExternalTruth(state.mirrorSample, state.opponentSample);
        return true;
      }
      state.pendingA2Exchange = null;
      if (state.gold.applyExternalExchange(exchange, state.mirrorSample, state.opponentSample)) {
        state.a2ExchangeApplied = true;
        state.lastA2Exchange = exchange;
        return true;
      }
      return state.gold.syncExternalTruth(state.mirrorSample, state.opponentSample);
    }
    if (!state.gold.syncExternalTruth(state.mirrorSample, state.opponentSample)) return false;
    return true;
  }

  function capturePassiveShardSeeds(ct, shards) {
    const state = instances.get(ct);
    if (!state || !state.gold || !Array.isArray(shards) || !shards.length
        || typeof state.gold.captureExternalShardSide !== 'function') return false;
    const provenance = shards[0] && shards[0].prov;
    if (!provenance) return false;
    // The side depends on the victim root at the realized hit. Capture only
    // that timing-sensitive value here; expression channels remain Gold-owned
    // and are sampled on first semantic bind before Gold advances again.
    const mirrorX = ct.anchor && Number.isFinite(ct.anchor.x) ? ct.anchor.x : state.gold.M.x;
    let side;
    try { side = state.gold.captureExternalShardSide(provenance, mirrorX); }
    catch (error) { scheduler.errors++; return false; }
    if (side !== 'L' && side !== 'R') return false;
    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i];
      if (shard && typeof shard === 'object') state.shardHitSeeds.set(shard, side);
    }
    return true;
  }

  function reconcilePassive(state) {
    if (!state || !state.gold || typeof state.gold.syncExternalPassive !== 'function') return false;
    const snapshotState = state.passiveSnapshotState;
    const snapshot = snapshotState.snapshot;
    const passive = state.ct.store && state.ct.store['mirror.passive'];
    const slots = passive && Array.isArray(passive.slots) ? passive.slots : null;
    const nodes = passive && Array.isArray(passive.nodes) ? passive.nodes : null;
    const shardInputs = snapshotState.shardInputs;
    const mirrorX = state.ct.anchor && Number.isFinite(state.ct.anchor.x) ? state.ct.anchor.x : state.gold.M.x;
    for (let i = 0; i < shardInputs.length; i++) {
      const real = slots && slots[i];
      if (!real) { snapshot.shards[i] = null; continue; }
      const input = shardInputs[i];
      snapshot.shards[i] = input;
      input.identity = real;
      input.on = !!real.on; input.st = real.st;
      input.x = real.x; input.y = real.y; input.vx = real.vx; input.vy = real.vy;
      input.age = real.age; input.fx = real.fx; input.fy = real.fy;
      input.tx = real.tx; input.ty = real.ty; input.mt0 = real.mt0;
      input.moving = !!real.moving; input.provenance = real.prov || null;
      input.mirrorX = mirrorX; input.presentationSide = state.shardHitSeeds.get(real) || null;
    }
    const nodeInputs = snapshotState.nodeInputs;
    const nodeCount = nodes ? nodes.length : 0;
    if (nodeCount > nodeInputs.length) { scheduler.errors++; return false; }
    for (let i = 0; i < nodeCount; i++) {
      const real = nodes[i], input = nodeInputs[i];
      input.id = real.id; input.st = real.st;
      input.x = real.x; input.y = real.y; input.rot = real.rot;
      input.t = real.t; input.age = real.age; input.t3 = real.t3; input.tlock = real.tlock;
      const members = real.sh || [];
      for (let j = 0; j < input.memberSlots.length; j++)
        input.memberSlots[j] = slots && members[j] ? slots.indexOf(members[j]) : -1;
      snapshot.nodes[i] = input;
    }
    snapshot.nodes.length = nodeCount;
    try {
      const ok = state.gold.syncExternalPassive(snapshot, HR && HR.mirrorNode);
      if (!ok) scheduler.errors++;
      return !!ok;
    } catch (error) { scheduler.errors++; return false; }
  }

  function routeOwnerState(payload) {
    return payload && stateForCombatantIndex(payload.owner);
  }

  function presentExternalRoute(state, route) {
    if (!state || !state.gold || !route || route.routeId == null
        || typeof state.gold.presentExternalRoute !== 'function') return false;
    // A real F2 edge may be emitted before hrPostTick reconciles a just-active
    // gameplay node. Bind the current semantic snapshot first; Gold still owns
    // all node/route/image identities and all subsequent lifecycle edges.
    reconcilePassive(state);
    try { return !!state.gold.presentExternalRoute(route); }
    catch (error) { scheduler.errors++; return false; }
  }

  function eventPoint(payload) {
    if (payload && payload.point && Number.isFinite(payload.point.x) && Number.isFinite(payload.point.y))
      return payload.point;
    if (payload && Number.isFinite(payload.x) && Number.isFinite(payload.y))
      return { x: payload.x, y: payload.y };
    return null;
  }

  function onRoutePreviewOrLocal(event) {
    const p = event && event.payload ? event.payload : event;
    const state = routeOwnerState(p);
    if (!state || !p || !p.projectile) return;
    const preview = event && event.type === 'MirrorRoutePreview';
    presentExternalRoute(state, {
      kind: preview ? 'preview' : 'local', routeId: p.projectile,
      nodeId: p.node, entryNodeId: p.node,
      destinationNodeId: p.dest == null ? null : p.dest,
      point: eventPoint(p), direction: p.direction, power: p.power,
    });
  }

  function onRouteCapture(event) {
    const p = event && event.payload ? event.payload : event;
    const state = routeOwnerState(p);
    if (!state || !p || !p.projectile) return;
    presentExternalRoute(state, {
      kind: 'capture', routeId: p.projectile,
      entryNodeId: p.entry, destinationNodeId: p.dest,
      point: eventPoint(p), direction: p.direction, power: p.power,
    });
  }

  function onEscrowImage(event) {
    const p = event && event.payload ? event.payload : event;
    if (!p || !p.projectile) return;
    const route = {
      kind: 'destination-image', routeId: p.projectile,
      destinationNodeId: p.dest, destinationLive: p.destLive === true,
      point: eventPoint(p), direction: p.direction, power: p.power,
    };
    for (const state of instances.values()) presentExternalRoute(state, route);
  }

  function onRouteEmerge(event) {
    const p = event && event.payload ? event.payload : event;
    if (!p || !p.projectile) return;
    const route = {
      kind: 'emerge', routeId: p.projectile,
      via: p.via, viaNodeId: Number.isFinite(p.via) ? p.via : null,
      fallback: p.fallback === true || p.via === 'entry-fallback',
      point: eventPoint(p), direction: p.direction, power: p.power,
    };
    for (const state of instances.values()) presentExternalRoute(state, route);
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
      reconcilePassive(state);
      if (!syncRootsAndExchange(state, validDt ? dt : 0)) continue;
      if (!state.a1Whiff && state.a1WeaponId) resolveA1WeaponArt(state);
      processPendingA1Start(state);
      processPendingA2Start(state);
      if (frameDt <= 0) {
        processPendingA1End(state);
        processPendingA2End(state);
        processPendingA1Start(state);
        processPendingA2Start(state);
        continue;
      }
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
      processPendingA1End(state);
      processPendingA2End(state);
      processPendingA1Start(state);
      processPendingA2Start(state);
    }
    return advanced;
  }

  function sameExchangePair(a, b) {
    return !!(a && b && a.self && a.opponent && b.self && b.opponent
      && a.self.id === b.opponent.id && a.opponent.id === b.self.id
      && a.self.from && a.opponent.from && b.self.from && b.opponent.from
      && a.self.from.x === b.opponent.from.x && a.self.from.y === b.opponent.from.y
      && a.opponent.from.x === b.self.from.x && a.opponent.from.y === b.self.from.y);
  }

  function ownsA2Residue(state) {
    const other = state.opponent && instances.get(state.opponent);
    if (!state.a2ExchangeApplied || !state.lastA2Exchange || !other
        || !other.a2ExchangeApplied || !other.lastA2Exchange || !(other.gold.A2.res > 0)) return true;
    if (!sameExchangePair(state.lastA2Exchange, other.lastA2Exchange)) return true;
    return state.ct.idx < other.ct.idx;
  }

  function renderArenaWorldEffects(ctx, provenance) {
    if (!ctx || provenance?.stage !== 'after-world-before-fighters') return false;
    for (const state of instances.values()) {
      state.gold.drawExternalPassive(ctx);
      if (state.a1CastId != null && state.weaponArtReady && !state.a1Whiff && !state.realOwn)
        state.gold.drawA1World(ctx);
      if (state.gold.A2.res > 0 && ownsA2Residue(state)) state.gold.drawResidue(ctx);
    }
    return true;
  }

  function installDraw() {
    const Fighter = g.Fighter;
    if (!Fighter || !Fighter.prototype || Fighter.prototype.__mirrorPresentationWrapped) return;
    drawPrototype = Fighter.prototype;
    previousDraw = drawPrototype.draw;
    drawWrapper = function drawMirrorPresentation(ctx) {
      const ct = HR && HR.byCombatant ? HR.byCombatant(this) : (this && this.__hrCombatant);
      const state = ct && instances.get(ct);
      if (typeof previousDraw !== 'function') return;
      if (!state || this !== ct.anchor || !(this.hp > 0) || !this.type)
        return previousDraw.call(this, ctx);
      const type = this.type;
      const originalTypeDraw = type.draw;
      type.draw = state.drawType;
      try { return previousDraw.call(this, ctx); }
      finally { type.draw = originalTypeDraw; }
    };
    drawWrapper.__mirrorPresentationWrapped = true;
    drawPrototype.__mirrorPresentationWrapped = true;
    drawPrototype.draw = drawWrapper;
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
        a1CastId: state.a1CastId,
        a1Whiff: state.a1Whiff,
        realOwn: state.realOwn,
        weaponArtReady: state.weaponArtReady,
        a2CastId: state.a2CastId,
        a2NoSnap: state.a2NoSnap,
        a2ExchangeApplied: state.a2ExchangeApplied,
        // Diagnostics are the Gold semantic audit, never a parallel adapter
        // listing of SH/ND proxies or route/image owners.
        passive: state.gold.externalPassiveAudit(),
        external: state.gold.externalAudit(),
      });
    }
    return {
      version: VERSION,
      fixedStep: STEP,
      maxSubsteps: MAX_SUBSTEPS,
      matchBound: !!boundMatch,
      instanceCount: instances.size,
      scheduler: { ...scheduler },
      listenerCount: unsubscribers.length,
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
    if (drawPrototype && drawWrapper && drawPrototype.draw === drawWrapper) {
      drawPrototype.draw = previousDraw;
      delete drawPrototype.__mirrorPresentationWrapped;
    }
    if (g.APEX_MIRROR_PRESENTATION === api) delete g.APEX_MIRROR_PRESENTATION;
  }

  const api = {
    version: VERSION, fixedStep: STEP, tick, teardown,
    capturePassiveShardSeeds,
    renderArenaWorldEffects, inspect, dispose,
  };

  if (AIL && AIL.bus && typeof AIL.bus.on === 'function') {
    unsubscribers.push(AIL.bus.on('ReworkMatchInstall', onMatchInstall));
    unsubscribers.push(AIL.bus.on('ReworkMatchTeardown', onMatchTeardown));
    unsubscribers.push(AIL.bus.on('MirrorA1Cast', onMirrorA1Cast));
    unsubscribers.push(AIL.bus.on('MirrorA1Own', onMirrorA1Own));
    unsubscribers.push(AIL.bus.on('MirrorA1Whiff', onMirrorA1Whiff));
    unsubscribers.push(AIL.bus.on('MirrorA1End', onMirrorA1End));
    unsubscribers.push(AIL.bus.on('MirrorA2Cast', onMirrorA2Cast));
    unsubscribers.push(AIL.bus.on('MirrorA2NoSnap', onMirrorA2NoSnap));
    unsubscribers.push(AIL.bus.on('MirrorA2End', onMirrorA2End));
    // The exchange is a coordinate teleport, not a velocity impulse. Retain
    // its PRE-SWAP movement samples so the next post-tick binds honest velocity.
    unsubscribers.push(AIL.bus.on('MirrorExchange', onMirrorExchange));
    unsubscribers.push(AIL.bus.on('MirrorRoutePreview', onRoutePreviewOrLocal));
    unsubscribers.push(AIL.bus.on('MirrorRouteLocal', onRoutePreviewOrLocal));
    unsubscribers.push(AIL.bus.on('MirrorRouteCapture', onRouteCapture));
    unsubscribers.push(AIL.bus.on('MirrorEscrowImage', onEscrowImage));
    unsubscribers.push(AIL.bus.on('MirrorRouteEmerge', onRouteEmerge));
  }
  g.APEX_MIRROR_PRESENTATION = api;
  installDraw();
  reconcile(currentMatch());
  g.apexMirrorPresentationRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
