// ARSENAL QUEST — spawn / hidden-reveal pickup lifecycle.
// Authoritative override: docs/arsenal-quest/CORRECTION_PASS_HANDOFF.md
// TELEGRAPH -> REVEALED -> PICKED_UP -> REMOVED
// Spawn cadence is independent of collection state; reveal is proximity-predicted.
(function apexArsenalSpawnRuntime() {
  if (window.apexArsenalSpawnRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL;
  const CFG = window.APEX_ARSENAL_CONFIG;
  const log = (event, fields) => AQ.log(event, fields);

  // Kept only for secondary feedback/debug fallback colors. Normal revealed
  // pickup rendering MUST use the committed P0 weapon atlas.
  const PLACEHOLDER_ART = {
    PISTOL:       { tag: 'PIS', color: '#ffd479' },
    SHOTGUN:      { tag: 'SHG', color: '#ffbe6b' },
    SMG:          { tag: 'SMG', color: '#b9f6ca' },
    SNIPER:       { tag: 'SNP', color: '#f4f4f4' },
    GRENADE:      { tag: 'GRN', color: '#9ccc65' },
    SABRE:        { tag: 'SAB', color: '#c9e6ff' },
    BATTLE_AXE:   { tag: 'AXE', color: '#ffb3a0' },
    DAGGER:       { tag: 'DGR', color: '#e8f4ff' },
    SPEAR:        { tag: 'SPR', color: '#d9ffb3' },
    SPIKED_CLUB:  { tag: 'CLB', color: '#e6c9ff' },
    SWIRL_SHIELD: { tag: 'SWL', color: '#9fe8ff' },
    TOWER_SHIELD: { tag: 'TWR', color: '#9fd8ff' },
  };

  function pickSpawnPoint(slots) {
    const margin = CFG.SPAWN_MARGIN;
    let best = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = rand(margin, GAME_SIZE - margin);
      const y = rand(margin, GAME_SIZE - margin);
      let minSlot = Infinity;
      for (const s of slots) minSlot = Math.min(minSlot, dist(x, y, s.x, s.y));
      if (minSlot >= CFG.MIN_SLOT_SPACING) return { x, y };
      if (!best || minSlot > best.minSlot) best = { x, y, minSlot };
    }
    return best ? { x: best.x, y: best.y } : { x: rand(margin, GAME_SIZE - margin), y: rand(margin, GAME_SIZE - margin) };
  }

  function pickupTouchRadius(f) {
    return (f?.radius || 75) * 0.6 + CFG.PICKUP_RADIUS + CFG.PICKUP_TOUCH_BONUS;
  }

  function isEligibleForPickup(f) {
    if (!f || f.hp <= 0) return false;
    const weaponApi = AQ.weaponApi;
    return !(weaponApi && weaponApi.getHolder && weaponApi.getHolder(f));
  }

  // V2 B-handoff A-CORR-2: whole-circle reveal. The hidden slot IS the visible
  // question-mark pickup circle, and its radius is the shared config value
  // CFG.REVEAL_CIRCLE_RADIUS that drawSlots renders, so rendering and reveal
  // logic cannot drift. The fighter's CURRENT straight movement segment is
  // tested as a ray against that circle:
  //  - fighter already inside the circle        -> eta 0 (immediate reveal);
  //  - segment enters the circle within the
  //    fixed 2.0s lead                          -> that entry eta;
  //  - near miss OUTSIDE the visible circle     -> null (stays hidden);
  //  - a wall bounce happens before entry       -> null (no pre-bounce reveal;
  //    recomputed naturally after the bounce).
  // No center-crossing requirement, no multi-bounce future predictor.
  function predictContactETA(slot, fighter) {
    if (!slot || !fighter || !isEligibleForPickup(fighter)) return null;
    let dx = fighter.dir?.x || 0;
    let dy = fighter.dir?.y || 0;
    const mag = Math.hypot(dx, dy);
    if (!(mag > 1e-6)) return null;
    dx /= mag;
    dy /= mag;

    let speed = Number(fighter.baseSpeed ?? CFG.FIGHTER_SPEED ?? 0);
    if (typeof fighter.speedMult === 'function') speed *= Math.max(0, fighter.speedMult());
    if (!(speed > 0)) return null;

    const R = Number(CFG.REVEAL_CIRCLE_RADIUS ?? 42);
    const rx = slot.x - fighter.x;
    const ry = slot.y - fighter.y;
    const c2 = rx * rx + ry * ry;
    if (c2 <= R * R) return 0;                      // already inside visible circle

    const proj = rx * dx + ry * dy;                 // along-track distance to center
    if (proj <= 0) return null;                     // circle is behind the fighter
    const perp2 = c2 - proj * proj;                 // squared cross-track miss
    if (perp2 > R * R) return null;                 // near miss outside the circle

    const tEnter = (proj - Math.sqrt(R * R - perp2)) / speed;
    const lead = Number(CFG.REVEAL_LEAD_SECONDS ?? 2.0);
    if (!(tEnter >= 0) || tEnter > lead + 1e-9) return null;

    // Wall-bounce guard: only the current straight segment counts. Circle entry
    // must happen before the fighter body would touch any arena wall.
    const radius = fighter.radius || 75;
    let tWall = Infinity;
    if (dx > 1e-9) tWall = Math.min(tWall, (GAME_SIZE - radius - fighter.x) / (dx * speed));
    if (dx < -1e-9) tWall = Math.min(tWall, (radius - fighter.x) / (dx * speed));
    if (dy > 1e-9) tWall = Math.min(tWall, (GAME_SIZE - radius - fighter.y) / (dy * speed));
    if (dy < -1e-9) tWall = Math.min(tWall, (radius - fighter.y) / (dy * speed));
    if (tEnter > tWall + 1e-9) return null;         // would bounce first -> stay hidden

    return tEnter;
  }

  function trySpawnSlot() {
    const state = AQ.state;
    if (!state) return null;
    const active = state.slots.filter(s => s.phase !== 'REMOVED');
    if (active.length >= CFG.MAX_ACTIVE_SLOTS) {
      state.suppressedSpawns += 1;
      log('SPAWN_SUPPRESSED', `active=${active.length} cap=${CFG.MAX_ACTIVE_SLOTS}`);
      return null;
    }

    const point = pickSpawnPoint(state.slots);
    const slot = {
      id: state.nextSlotId++,
      x: point.x,
      y: point.y,
      phase: 'TELEGRAPH',
      weaponId: null,
      // V2 B-handoff A-CORR-2: fixed 2.0s whole-circle reveal lead per slot.
      revealLeadSeconds: Number(CFG.REVEAL_LEAD_SECONDS ?? 2.0),
      revealedFor: 0,
      pickedBy: null,
      rejectedFor: {},
      spawnTime: state.time,
      predictedHeroETA: null,
      predictedRivalETA: null,
      earliestETA: null,
      predictedFighter: null,
    };
    state.slots.push(slot);
    state.spawnedTotal += 1;
    log('SPAWN_SLOT', `id=${slot.id} x=${Math.round(slot.x)} y=${Math.round(slot.y)} lead=${slot.revealLeadSeconds.toFixed(2)}`);
    window.avCue('telegraph', { x: slot.x, y: slot.y });
    return slot;
  }

  function revealSlot(slot, eta, fighter, force = false) {
    slot.phase = 'REVEALED';
    slot.weaponId = CFG.P0_WEAPON_IDS[Math.floor(Math.random() * CFG.P0_WEAPON_IDS.length)];
    slot.revealedFor = 0;
    const etaText = Number.isFinite(eta) ? eta.toFixed(2) : 'null';
    const who = fighter?.name || 'TIMEOUT';
    log('REVEAL', `id=${slot.id} weapon=${slot.weaponId} eta=${etaText} lead=${slot.revealLeadSeconds.toFixed(2)} fighter=${who} force=${force}`);
    spawnShockwave(slot.x, slot.y, '#e8d9a0', 120);
    emitParticles(slot.x, slot.y, '#e8d9a0', 14, 260, 4, 0.45, 'square');
    playFighterSound('CARD', 'skill');
    window.avCue('reveal', { x: slot.x, y: slot.y, weapon: slot.weaponId });
  }

  function updateSlots(dt) {
    const state = AQ.state;
    if (!state) return;

    for (const slot of state.slots) {
      if (slot.phase === 'TELEGRAPH') {
        const hero = fighters?.[0] || null;
        const rival = fighters?.[1] || null;
        slot.predictedHeroETA = predictContactETA(slot, hero);
        slot.predictedRivalETA = predictContactETA(slot, rival);

        const candidates = [];
        if (slot.predictedHeroETA != null) candidates.push({ eta: slot.predictedHeroETA, fighter: hero });
        if (slot.predictedRivalETA != null) candidates.push({ eta: slot.predictedRivalETA, fighter: rival });
        candidates.sort((a, b) => a.eta - b.eta);

        const earliest = candidates[0] || null;
        slot.earliestETA = earliest ? earliest.eta : null;
        slot.predictedFighter = earliest?.fighter?.name || null;

        if (earliest && earliest.eta <= slot.revealLeadSeconds + 1e-6) {
          revealSlot(slot, earliest.eta, earliest.fighter, false);
        } else if (state.time - slot.spawnTime >= Number(CFG.FORCE_REVEAL_AGE_SECONDS ?? 3.0)) {
          // A-CORR-2 failsafe: a slot hidden for 3.0s force-reveals. This is
          // FORCE REVEAL (becomes a normal collectible), NOT auto-pickup.
          revealSlot(slot, null, null, true);
        }
      } else if (slot.phase === 'REVEALED') {
        slot.revealedFor += dt;
        if (slot.revealedFor >= CFG.PICKUP_LIFETIME_SECONDS) {
          slot.phase = 'REMOVED';
          log('EXPIRE', `id=${slot.id} weapon=${slot.weaponId}`);
          emitParticles(slot.x, slot.y, '#8a8168', 10, 180, 4, 0.4, 'friction');
        }
      }
    }

    state.slots = state.slots.filter(s => s.phase !== 'REMOVED');
    state.maxActiveSlots = Math.max(state.maxActiveSlots || 0, state.slots.length);
  }

  // A revealed floor pickup is collected by the first living UNARMED fighter
  // whose collision volume overlaps it.
  function resolvePickups() {
    const state = AQ.state;
    if (!state) return;
    const weaponApi = AQ.weaponApi;

    for (const slot of state.slots) {
      if (slot.phase !== 'REVEALED') continue;
      let closest = null;
      let closestDist = Infinity;

      for (const f of fighters) {
        if (!f || f.hp <= 0) continue;
        const d = dist(f.x, f.y, slot.x, slot.y);
        if (d > pickupTouchRadius(f)) continue;
        if (weaponApi.getHolder(f)) {
          if (!slot.rejectedFor[f.id]) {
            slot.rejectedFor[f.id] = true;
            log('REJECT_PICKUP', `fighter=${f.name} id=${slot.id} reason=already-armed`);
          }
          continue;
        }
        if (d < closestDist) { closest = f; closestDist = d; }
      }

      if (!closest) continue;
      slot.phase = 'PICKED_UP';
      slot.pickedBy = closest.name;
      weaponApi.equip(closest, slot.weaponId);
      log('PICKUP', `id=${slot.id} fighter=${closest.name} weapon=${slot.weaponId}`);
      emitParticles(slot.x, slot.y, PLACEHOLDER_ART[slot.weaponId]?.color || '#ffffff', 22, 360, 5, 0.5, 'square');
      spawnShockwave(slot.x, slot.y, '#ffffff', 140);
      slot.phase = 'REMOVED';
    }
  }

  function drawDebugMissingWeapon(ctx, weaponId) {
    if (!(AQ.state && AQ.state.debugOverlay)) return;
    ctx.save();
    ctx.fillStyle = '#ff2bd6';
    ctx.strokeStyle = '#1b0016';
    ctx.lineWidth = 4;
    ctx.fillRect(-28, -28, 56, 56);
    ctx.strokeRect(-28, -28, 56, 56);
    ctx.fillStyle = '#1b0016';
    ctx.font = "900 13px monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MISSING', 0, -7);
    ctx.fillText(weaponId || '?', 0, 9);
    ctx.restore();
  }

  // Called inside the engine camera transform so slots sit in world space.
  function drawSlots(ctx) {
    const state = AQ.state;
    if (!state) return;
    const t = state.time;

    for (const slot of state.slots) {
      ctx.save();
      ctx.translate(slot.x, slot.y);

      if (slot.phase === 'TELEGRAPH') {
        // A-CORR-2: the visible circle IS the reveal region. Radius is pinned
        // to the shared CFG.REVEAL_CIRCLE_RADIUS (pulse moves alpha/weight
        // only, never the geometry the reveal logic tests against).
        const pulse = 0.5 + 0.5 * Math.sin(t * 5.2 + slot.id * 1.7);
        ctx.globalAlpha = 0.45 + 0.35 * pulse;
        ctx.strokeStyle = '#cfc6a8';
        ctx.lineWidth = 3 + 2.5 * pulse;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, CFG.REVEAL_CIRCLE_RADIUS, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 0.55 + 0.3 * pulse;
        ctx.strokeStyle = '#a89f83';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (CFG.PICKUP_RADIUS + 10), Math.sin(a) * (CFG.PICKUP_RADIUS + 10));
          ctx.lineTo(Math.cos(a) * (CFG.PICKUP_RADIUS + 20), Math.sin(a) * (CFG.PICKUP_RADIUS + 20));
          ctx.stroke();
        }

        ctx.fillStyle = '#efe6c8';
        ctx.strokeStyle = '#241f14';
        ctx.lineWidth = 6;
        ctx.font = "900 44px 'Segoe UI'";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText('?', 0, 2);
        ctx.fillText('?', 0, 2);
      } else if (slot.phase === 'REVEALED') {
        const bob = Math.sin(t * 3.1 + slot.id) * 4;
        const expireSoon = slot.revealedFor > CFG.PICKUP_LIFETIME_SECONDS - 3;
        ctx.globalAlpha = expireSoon && Math.floor(t * 8) % 2 === 0 ? 0.45 : 1;
        ctx.translate(0, bob);

        // Neutral floor shadow; the weapon itself is rendered from the real atlas.
        ctx.fillStyle = 'rgba(12,10,6,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, CFG.PICKUP_RADIUS * 0.9, CFG.PICKUP_RADIUS * 1.0, 12, 0, 0, TAU);
        ctx.fill();

        const av = window.APEX_ARSENAL_AV;
        const drawn = !!(av && av.drawWeaponSprite && av.drawWeaponSprite(ctx, slot.weaponId, 0, 0, {
          mode: 'floor',
          // C grenade continuity: pickup scale matches equipped/in-flight reads.
          targetLongSide: slot.weaponId === 'GRENADE' ? 56 : 118,
          alpha: 1,
        }));
        if (!drawn) drawDebugMissingWeapon(ctx, slot.weaponId);
      }

      ctx.restore();
    }
  }

  window.APEX_ARSENAL_SPAWN = {
    trySpawnSlot,
    updateSlots,
    resolvePickups,
    drawSlots,
    predictContactETA,
    isEligibleForPickup,
    PLACEHOLDER_ART,
  };
  window.apexArsenalSpawnRuntime = 'ready';
})();
