// ARSENAL QUEST P0 — spawn slot lifecycle (handoff §5, §6).
// TELEGRAPH -> REVEALED -> PICKED_UP -> REMOVED
// Cadence is timer-driven and independent of collection state; multiple slots coexist.
// Placeholder rendering is isolated presentation — never part of game logic (§13).
(function apexArsenalSpawnRuntime() {
  if (window.apexArsenalSpawnRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL;
  const CFG = window.APEX_ARSENAL_CONFIG;
  const log = (event, fields) => AQ.log(event, fields);

  // Isolated placeholder presentation table (logical sprite keys from
  // docs/arsenal-quest/P0_ASSET_MANIFEST.csv). Swap for real art later without
  // touching gameplay.
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

  function trySpawnSlot() {
    const state = AQ.state;
    if (!state) return null;
    const active = state.slots.filter(s => s.phase !== 'REMOVED');
    if (active.length >= CFG.MAX_ACTIVE_SLOTS) {
      // Soft safety cap — suppression must be visible (handoff §5).
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
      // Weapon identity is NOT selected before reveal — telegraph carries no
      // weapon/category information by construction.
      weaponId: null,
      revealDelay: rand(CFG.REVEAL_DELAY_MIN_SECONDS, CFG.REVEAL_DELAY_MAX_SECONDS),
      revealTimer: 0,
      revealedFor: 0,
      pickedBy: null,
      rejectedFor: {},
      spawnTime: state.time,
    };
    slot.revealTimer = slot.revealDelay;
    state.slots.push(slot);
    state.spawnedTotal += 1;
    log('SPAWN_SLOT', `id=${slot.id} x=${Math.round(slot.x)} y=${Math.round(slot.y)}`);
    window.avCue('telegraph', { x: slot.x, y: slot.y });
    return slot;
  }

  function updateSlots(dt) {
    const state = AQ.state;
    if (!state) return;
    for (const slot of state.slots) {
      if (slot.phase === 'TELEGRAPH') {
        slot.revealTimer -= dt;
        if (slot.revealTimer <= 0) {
          slot.phase = 'REVEALED';
          // Identity is only rolled at reveal time.
          slot.weaponId = CFG.P0_WEAPON_IDS[Math.floor(Math.random() * CFG.P0_WEAPON_IDS.length)];
          slot.revealedFor = 0;
          log('REVEAL', `id=${slot.id} weapon=${slot.weaponId}`);
          spawnShockwave(slot.x, slot.y, '#e8d9a0', 120);
          emitParticles(slot.x, slot.y, '#e8d9a0', 14, 260, 4, 0.45, 'square');
          playFighterSound('CARD', 'skill');
          window.avCue('reveal', { x: slot.x, y: slot.y, weapon: slot.weaponId });
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

  // A revealed floor pickup is collected by the first living fighter whose
  // collision volume overlaps it. Armed fighters cannot collect (P0 rule).
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
        if (d > f.radius * 0.6 + CFG.PICKUP_RADIUS + CFG.PICKUP_TOUCH_BONUS) continue;
        if (weaponApi.getHolder(f)) {
          // Already armed: leave the pickup for the opponent; log once per pair.
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

  // Floor rendering — called from inside the engine camera transform
  // (drawBackground wrapper) so slots sit under projectiles/fighters.
  function drawSlots(ctx) {
    const state = AQ.state;
    if (!state) return;
    const t = state.time;
    for (const slot of state.slots) {
      ctx.save();
      ctx.translate(slot.x, slot.y);
      if (slot.phase === 'TELEGRAPH') {
        // Neutral marker: no weapon sprite, no category hint, no identity
        // color-coding. Just a pulsing question slot.
        const pulse = 0.5 + 0.5 * Math.sin(t * 5.2 + slot.id * 1.7);
        ctx.globalAlpha = 0.45 + 0.35 * pulse;
        ctx.strokeStyle = '#cfc6a8';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, CFG.PICKUP_RADIUS * (0.82 + 0.22 * pulse), 0, TAU);
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
        const art = PLACEHOLDER_ART[slot.weaponId] || { tag: '???', color: '#ffffff' };
        const bob = Math.sin(t * 3.1 + slot.id) * 4;
        const expireSoon = slot.revealedFor > CFG.PICKUP_LIFETIME_SECONDS - 3;
        ctx.globalAlpha = expireSoon && Math.floor(t * 8) % 2 === 0 ? 0.45 : 1;
        ctx.translate(0, bob);
        ctx.fillStyle = 'rgba(12,10,6,0.55)';
        ctx.beginPath();
        ctx.ellipse(0, CFG.PICKUP_RADIUS * 0.8, CFG.PICKUP_RADIUS * 0.9, 12, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = art.color;
        ctx.strokeStyle = '#171308';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, CFG.PICKUP_RADIUS * 0.72, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#171308';
        ctx.font = "900 24px 'Segoe UI'";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(art.tag, 0, 1);
        ctx.fillStyle = art.color;
        ctx.font = "900 15px 'Segoe UI'";
        ctx.fillText(slot.weaponId.replace(/_/g, ' '), 0, CFG.PICKUP_RADIUS + 20);
      }
      ctx.restore();
    }
  }

  window.APEX_ARSENAL_SPAWN = {
    trySpawnSlot,
    updateSlots,
    resolvePickups,
    drawSlots,
    PLACEHOLDER_ART,
  };
  window.apexArsenalSpawnRuntime = 'ready';
})();
