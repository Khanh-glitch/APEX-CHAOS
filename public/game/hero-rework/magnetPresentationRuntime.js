/* =============================================================================
 * MAGNET V1 — thin production/Gold semantic adapter.
 *
 * Production owns object identity, field activity, events and resolved roots.
 * APEX_MAGNET_GOLD owns all pose, timing, history, effects, sockets and drawing.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_MAGNET_PRESENTATION) return;

  const HR = g.APEX_HERO_REWORK;
  const AIL = g.APEX_HERO_REWORK_AIL;
  const MAG = g.APEX_MAGNET;
  const GOLD = g.APEX_MAGNET_GOLD;
  const states = new Map();
  const scheduler = { tickCalls: 0, advancedFrames: 0, duplicateCalls: 0 };
  let unsubscribers = [];
  let lastTickClock = -Infinity;

  function clock() {
    return AIL && AIL.clock ? AIL.clock() : Number(g.matchClock) || 0;
  }
  function magnets() {
    const match = HR && HR.match;
    return match ? match.combatants.filter((ct) => !ct.facade && ct.heroId === 'MAGNET') : [];
  }
  function byIndex(index) {
    return magnets().find((ct) => ct.idx === index) || null;
  }
  function stateFor(ct) {
    let state = states.get(ct);
    if (!state) {
      state = {
        ct,
        preRoot: null,
        frameSample: null,
        lastGameplayA1: false,
        lastGameplayA2: false,
      };
      states.set(ct, state);
    }
    return state;
  }
  function capturePreMovement() {
    const now = clock();
    for (const ct of magnets()) {
      const body = ct.anchor;
      if (body) stateFor(ct).preRoot = { x: body.x, y: body.y, clock: now };
    }
  }

  function floorDescriptor(record) {
    const slot = record && (record.slot || record);
    if (!slot) return null;
    return {
      key: slot,
      id: slot.id,
      kind: 'gun',
      x: Number(slot.x) || 0,
      y: Number(slot.y) || 0,
      vx: Number(record.vx) || 0,
      vy: Number(record.vy) || 0,
      radius: 16,
    };
  }
  function projectileDescriptor(projectile) {
    if (!projectile) return null;
    return {
      key: projectile,
      kind: 'bullet',
      hostile: true,
      x: Number(projectile.x) || 0,
      y: Number(projectile.y) || 0,
      vx: Number(projectile.vx) || 0,
      vy: Number(projectile.vy) || 0,
      radius: Number(projectile.radius) || 5,
    };
  }
  function bodyDescriptor(record) {
    const body = record && (record.body || record);
    if (!body) return null;
    return {
      key: body,
      id: body.id,
      kind: 'body',
      x: Number(body.x) || 0,
      y: Number(body.y) || 0,
      vx: Number(record.vx) || 0,
      vy: Number(record.vy) || 0,
      radius: Number(body.radius) || 75,
    };
  }
  function realFloor(snapshot) {
    return snapshot.floorFirearms
      .filter((record) => record.slot && record.slot.phase === 'REVEALED')
      .map(floorDescriptor).filter(Boolean);
  }
  function projectileTruth(snapshot, ct, kind) {
    return snapshot.projectileInfluence
      .filter((record) => record.fields.some((field) => field.owner === ct && field.kind === kind))
      .map((record) => projectileDescriptor(record.projectile)).filter(Boolean);
  }
  function objectTruth(snapshot, ct, activeA1, activeA2) {
    const floor = realFloor(snapshot);
    const a1Objects = activeA1 ? floor.concat(projectileTruth(snapshot, ct, 'a1')) : [];
    const a2Objects = activeA2
      ? floor.concat(snapshot.bodies.map(bodyDescriptor).filter(Boolean), projectileTruth(snapshot, ct, 'a2'))
      : [];
    return { a1Objects, a2Objects };
  }
  function currentFloorDescriptors() {
    const slots = g.APEX_ARSENAL && g.APEX_ARSENAL.state && g.APEX_ARSENAL.state.slots;
    return Array.isArray(slots)
      ? slots.filter((slot) => MAG.isEligibleFloorFirearm(slot)).map(floorDescriptor).filter(Boolean)
      : [];
  }
  function floorById(id) {
    const slots = g.APEX_ARSENAL && g.APEX_ARSENAL.state && g.APEX_ARSENAL.state.slots;
    const slot = Array.isArray(slots) ? slots.find((item) => item.id === id) : null;
    return slot ? floorDescriptor(slot) : null;
  }

  function onEvent(event) {
    const payload = event && event.payload || {};
    const ct = byIndex(payload.combatantIndex);
    if (!ct) return;
    const state = stateFor(ct);
    if (event.type === 'MagnetA1Start') {
      state.lastGameplayA1 = true;
      GOLD.cue(ct, 'a1', { objects: currentFloorDescriptors() });
    } else if (event.type === 'MagnetA2Start') {
      state.lastGameplayA2 = true;
      GOLD.cue(ct, 'a2');
    } else if (event.type === 'MagnetLateReveal') {
      GOLD.cue(ct, 'lateReveal', { object: floorById(payload.slotId) });
    } else if (event.type === 'MagnetPassiveEmission') {
      GOLD.cue(ct, 'passive', {
        x: payload.x,
        y: payload.y,
        angle: payload.angle,
        speed: payload.speed,
        weapon: payload.weapon,
      });
    }
  }
  function subscribe() {
    if (!AIL || !AIL.bus) return;
    for (const type of ['MagnetA1Start', 'MagnetA2Start', 'MagnetLateReveal', 'MagnetPassiveEmission']) {
      unsubscribers.push(AIL.bus.on(type, onEvent));
    }
  }

  function tick(dt) {
    scheduler.tickCalls += 1;
    const now = clock();
    if (now === lastTickClock) {
      scheduler.duplicateCalls += 1;
      return;
    }
    lastTickClock = now;
    scheduler.advancedFrames += 1;

    const snapshot = MAG.inspect(now);
    const live = new Set(magnets());
    for (const ct of live) {
      const state = stateFor(ct);
      const body = ct.anchor;
      if (!body) continue;
      const field = snapshot.fields.find((item) => item.combatant === ct);
      const activeA1 = !!(field && field.a1Active);
      const activeA2 = !!(field && field.a2Active);

      // Edge fallback covers a cast accepted before this adapter subscribed.
      if (activeA1 && !state.lastGameplayA1) GOLD.cue(ct, 'a1', { objects: currentFloorDescriptors() });
      if (activeA2 && !state.lastGameplayA2) GOLD.cue(ct, 'a2');
      state.lastGameplayA1 = activeA1;
      state.lastGameplayA2 = activeA2;

      const pre = state.preRoot || { x: body.x, y: body.y, clock: now };
      state.frameSample = {
        before: { x: pre.x, y: pre.y },
        after: { x: body.x, y: body.y },
        dt,
        clock: now,
      };
      state.preRoot = null;
      const objects = objectTruth(snapshot, ct, activeA1, activeA2);
      GOLD.updateFrame(ct, dt, {
        root: {
          before: state.frameSample.before,
          after: state.frameSample.after,
          radius: body.radius,
        },
        a1Objects: objects.a1Objects,
        a2Objects: objects.a2Objects,
      });
    }
    for (const ct of states.keys()) {
      if (!live.has(ct)) {
        GOLD.teardown(ct);
        states.delete(ct);
      }
    }
  }

  function drawStatus(ctx, fighter) {
    if (!fighter || !fighter.hasStatus) return;
    ctx.save();
    try {
      ctx.translate(fighter.x, fighter.y);
      for (const [name, color, offset] of [['freeze', '#a6f4ff', 18], ['stun', '#4fe8ff', 22]]) {
        if (!fighter.hasStatus(name)) continue;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.setLineDash([6, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, (fighter.radius || 75) + offset, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } finally {
      ctx.restore();
    }
  }
  function combatantForMagnet(fighter) {
    const ct = HR && HR.byCombatant ? HR.byCombatant(fighter) : null;
    return ct && ct.heroId === 'MAGNET' ? ct : null;
  }
  function renderPostWorldInterop(ctx, fighter) {
    if (fighter !== g.fighters?.[g.fighters.length - 1] && fighter !== g.fighters?.[1]) return;
    try { g.APEX_HUNTER_PRESENTATION?.renderPostWorld?.(ctx); } catch (error) {}
    try {
      g.APEX_CRYSTALA_PRESENTATION?.renderWorldConstructsAndFx?.(ctx, false, true);
      g.APEX_CRYSTALA_PRESENTATION?.runBloomPass?.(ctx);
    } catch (error) {}
    try { g.APEX_FROST_PRESENTATION?.renderPostWorld?.(ctx); } catch (error) {}
  }
  function installDraw() {
    const Fighter = g.Fighter;
    if (!Fighter?.prototype || Fighter.prototype.__magnetPresentationWrapped) return;
    const previous = Fighter.prototype.draw;
    Fighter.prototype.__magnetPresentationWrapped = true;
    Fighter.prototype.draw = function drawMagnet(ctx) {
      const ct = combatantForMagnet(this);
      if (!ct || !(this.hp > 0) || !GOLD.ready) return previous.call(this, ctx);
      GOLD.drawBefore(ctx, ct);
      ctx.save();
      try {
        ctx.globalAlpha = this.hasStatus && this.hasStatus('immune') ? 0.55 : 1;
        GOLD.drawActor(ctx, ct);
      } finally {
        ctx.restore();
      }
      drawStatus(ctx, this);
      GOLD.drawAfter(ctx, ct);
      renderPostWorldInterop(ctx, this);
    };
  }

  function teardown() {
    for (const ct of states.keys()) GOLD.teardown(ct);
    states.clear();
    lastTickClock = -Infinity;
  }
  function installLifecycle() {
    const exit = g.exitArsenalQuestMode;
    if (!exit || exit.__magnetPresentationWrapped) return;
    const wrapped = function exitWithMagnetTeardown() {
      teardown();
      return exit.apply(this, arguments);
    };
    wrapped.__hrWrapped = exit.__hrWrapped;
    wrapped.__magnetPresentationWrapped = true;
    g.exitArsenalQuestMode = wrapped;
  }
  function inspect(ct) {
    const adapter = ct ? states.get(ct) : null;
    const gold = ct ? GOLD.inspect(ct).state : null;
    const effects = gold && gold.effects;
    return {
      ready: GOLD.ready,
      stateCount: states.size,
      scheduler: { ...scheduler },
      state: adapter && {
        a1Age: gold ? gold.a1 : -1,
        a2Age: gold ? gold.a2 : -1,
        late: effects ? effects.rings : 0,
        corridors: effects ? effects.corridors : 0,
        projectileHistories: effects ? effects.projectileHistories : 0,
        hot: effects ? effects.hot.slice() : [],
        frameSample: adapter.frameSample,
      },
    };
  }

  subscribe();
  installDraw();
  installLifecycle();
  g.APEX_MAGNET_PRESENTATION = {
    version: '2.0.0-thin-semantic-adapter',
    capturePreMovement,
    tick,
    teardown,
    inspect,
  };
  g.apexMagnetPresentationRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
