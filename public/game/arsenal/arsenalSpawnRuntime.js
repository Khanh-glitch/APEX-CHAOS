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
    const active = state.slots.filter(s => s.phase !== 'REMOVED' && s.kind !== 'HEAL');
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

  // POST-C §4 — weighted selection. Raw weights: melee 0.5, everything else
  // 1.0 (NOT gun-count dilution: each non-melee id keeps full individual
  // weight). The RNG is injectable (AQ.rng) so probability gates are
  // deterministic in tests and the live game uses Math.random.
  function weightFor(weaponId) {
    const w = CFG.SPAWN_WEIGHTS || { melee: 0.5, base: 1.0 };
    return (CFG.MELEE_WEAPON_IDS || []).includes(weaponId) ? w.melee : w.base;
  }
  function selectSpawnWeapon(rng) {
    const random = typeof rng === 'function' ? rng : (AQ.rng || Math.random);
    if (CFG.selectOffensiveWeapon) return CFG.selectOffensiveWeapon(random).id;
    const ids = (CFG.OFFENSIVE_WEAPON_IDS || CFG.P0_WEAPON_IDS).filter((id) => id !== 'SWIRL_SHIELD' && id !== 'TOWER_SHIELD');
    let total = 0;
    for (const id of ids) total += weightFor(id);
    let roll = random() * total;
    for (const id of ids) {
      roll -= weightFor(id);
      if (roll < 0) return id;
    }
    return ids[ids.length - 1];
  }

  function revealSlot(slot, eta, fighter, force = false) {
    slot.phase = 'REVEALED';
    slot.weaponId = selectSpawnWeapon();
    slot.tier = CFG.tierOf ? CFG.tierOf(slot.weaponId) : null;
    slot.revealedFor = 0;
    const etaText = Number.isFinite(eta) ? eta.toFixed(2) : 'null';
    const who = fighter?.name || 'TIMEOUT';
    log('REVEAL', `id=${slot.id} weapon=${slot.weaponId} eta=${etaText} lead=${slot.revealLeadSeconds.toFixed(2)} fighter=${who} force=${force}`);
    spawnShockwave(slot.x, slot.y, '#e8d9a0', 120);
    emitParticles(slot.x, slot.y, '#e8d9a0', 14, 260, 4, 0.45, 'square');
    playFighterSound('CARD', 'skill');
    window.avCue('reveal', { x: slot.x, y: slot.y, weapon: slot.weaponId });
  }

  function selectHealId(rng) {
    const random = typeof rng === 'function' ? rng : (AQ.rng || Math.random);
    const state = AQ.state;
    if (state && state.forceHealId) return state.forceHealId;
    const weights = CFG.HEAL_WEIGHTS || {};
    const ids = CFG.HEAL_IDS || Object.keys(weights);
    let total = 0;
    for (const id of ids) total += weights[id] || 0;
    let roll = random() * total;
    for (const id of ids) {
      roll -= weights[id] || 0;
      if (roll < 0) return id;
    }
    return ids[ids.length - 1];
  }

  function trySpawnHealSupport() {
    const state = AQ.state;
    const feel = window.APEX_ARSENAL_FEEL;
    if (!state || !feel || !feel.healGameplayEnabled) return null;
    if (state.spawnHeld) return null;
    if ((state.healCooldown || 0) > 0) return null;
    const activeHeal = state.slots.filter((s) => s.kind === 'HEAL' && s.phase !== 'REMOVED');
    if (activeHeal.length >= (CFG.HEAL_MAX_ACTIVE || 1)) return null;
    const living = (typeof fighters !== 'undefined' ? fighters : []).filter((f) => f && f.hp > 0);
    const eligible = living.some((f) => f.hp <= (CFG.HEAL_ELIGIBLE_HP || 80));
    if (!eligible) return null;
    const point = pickSpawnPoint(state.slots);
    const healId = selectHealId();
    const slot = {
      id: state.nextSlotId++,
      x: point.x,
      y: point.y,
      phase: 'REVEALED',
      kind: 'HEAL',
      weaponId: healId,
      healRestore: (CFG.HEAL_RESTORE && CFG.HEAL_RESTORE[healId]) || 0,
      revealedFor: 0,
      pickedBy: null,
      rejectedFor: {},
      spawnTime: state.time,
    };
    state.slots.push(slot);
    state.healCooldown = CFG.HEAL_SPAWN_COOLDOWN || 9;
    state.healSpawnedTotal = (state.healSpawnedTotal || 0) + 1;
    log('SPAWN_HEAL', `id=${slot.id} heal=${healId} restore=${slot.healRestore}`);
    return slot;
  }

  function updateSlots(dt) {
    const state = AQ.state;
    if (!state) return;
    if (state.healCooldown > 0) state.healCooldown = Math.max(0, state.healCooldown - dt);
    trySpawnHealSupport();

    for (const slot of state.slots) {
      if (slot.kind === 'HEAL') {
        if (slot.phase === 'REVEALED') {
          slot.revealedFor += dt;
          if (slot.revealedFor >= (CFG.HEAL_LIFETIME_SECONDS || 12)) {
            slot.phase = 'REMOVED';
            log('EXPIRE_HEAL', `id=${slot.id}`);
          }
        }
        continue;
      }
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

        const weaponApi = AQ.weaponApi;
        if (earliest && weaponApi && earliest.fighter && !weaponApi.getHolder(earliest.fighter)) {
          const other = earliest.fighter === hero ? rival : hero;
          const otherHold = other ? weaponApi.getHolder(other) : null;
          const threatId = otherHold && otherHold.weaponId;
          if (threatId && CFG.isOffensive && CFG.isOffensive(threatId) && threatId !== 'SWIRL_SHIELD' && threatId !== 'TOWER_SHIELD') {
            slot.phase = 'COUNTER_RESERVED';
            slot.reservedFor = earliest.fighter.id;
            slot.weaponId = (CFG.threatShield && CFG.threatShield(threatId)) || 'SWIRL_SHIELD';
            slot.boundWeaponId = threatId;
            slot.boundOwnerId = other.id;
            slot.tier = null;
            log('COUNTER_RESERVED', `id=${slot.id} for=${earliest.fighter.name} shield=${slot.weaponId} vs=${threatId}`);
            continue;
          }
        }
        if (earliest && earliest.eta <= slot.revealLeadSeconds + 1e-6) {
          revealSlot(slot, earliest.eta, earliest.fighter, false);
        } else if (state.time - slot.spawnTime >= Number(CFG.FORCE_REVEAL_AGE_SECONDS ?? 3.0)) {
          revealSlot(slot, null, null, true);
        }
      } else if (slot.phase === 'COUNTER_RESERVED') {
        slot.revealedFor += dt;
        const weaponApi = AQ.weaponApi;
        const reserved = (fighters || []).find((f) => f && f.id === slot.reservedFor) || null;
        const owner = (fighters || []).find((f) => f && f.id === slot.boundOwnerId) || null;
        const oh = owner && weaponApi ? weaponApi.getHolder(owner) : null;
        const threatLive = !!(oh && oh.weaponId === slot.boundWeaponId);
        const reservedOk = !!(reserved && reserved.hp > 0 && weaponApi && !weaponApi.getHolder(reserved));
        const eta = reservedOk ? predictContactETA(slot, reserved) : null;
        const staleFailsafe = slot.revealedFor >= 14;
        if (!reservedOk || !owner || owner.hp <= 0 || !threatLive || eta == null || staleFailsafe) {
          log('COUNTER_RELEASE', `id=${slot.id} reason=${staleFailsafe ? 'failsafe' : 'invalid'}`);
          slot.phase = 'TELEGRAPH';
          slot.reservedFor = null;
          slot.boundWeaponId = null;
          slot.boundOwnerId = null;
          slot.weaponId = null;
          slot.tier = null;
          slot.revealedFor = 0;
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
      if (slot.phase !== 'REVEALED' && slot.phase !== 'COUNTER_RESERVED') continue;
      let closest = null;
      let closestDist = Infinity;

      if (slot.kind === 'HEAL') {
        const maxHp = CFG.MATCH_HP || 100;
        for (const f of fighters) {
          if (!f || f.hp <= 0) continue;
          const cap = f.maxHp || maxHp;
          if (f.hp >= cap) {
            if (!slot.rejectedFor[f.id]) {
              slot.rejectedFor[f.id] = true;
              log('REJECT_HEAL', `fighter=${f.name} id=${slot.id} reason=full-health`);
            }
            continue;
          }
          const d = dist(f.x, f.y, slot.x, slot.y);
          if (d > pickupTouchRadius(f)) continue;
          if (d < closestDist) { closest = f; closestDist = d; }
        }
        if (!closest) continue;
        const cap = closest.maxHp || maxHp;
        const nominal = slot.healRestore || 0;
        const actual = Math.min(nominal, Math.max(0, cap - closest.hp));
        closest.hp = Math.min(cap, closest.hp + actual);
        closest.healingDone = (closest.healingDone || 0) + actual;
        slot.phase = 'PICKED_UP';
        slot.pickedBy = closest.name;
        log('PICKUP_HEAL', `id=${slot.id} fighter=${closest.name} restore=${actual}`);
        if (typeof updateHUD === 'function') {
          try { updateHUD(); } catch (e) { /* headless HUD optional */ }
        }
        if (window.APEX_ARSENAL_FEEL && window.APEX_ARSENAL_FEEL.noteHeal) {
          window.APEX_ARSENAL_FEEL.noteHeal(closest, actual);
        }
        emitParticles(slot.x, slot.y, '#38E07A', 16, 280, 4, 0.4, 'square');
        slot.phase = 'REMOVED';
        continue;
      }

      for (const f of fighters) {
        if (!f || f.hp <= 0) continue;
        const d = dist(f.x, f.y, slot.x, slot.y);
        if (d > pickupTouchRadius(f)) continue;
        if (slot.phase === 'COUNTER_RESERVED' && slot.reservedFor !== f.id) {
          if (!slot.rejectedFor[f.id]) {
            slot.rejectedFor[f.id] = true;
            log('REJECT_PICKUP', `fighter=${f.name} id=${slot.id} reason=not-reserved`);
          }
          continue;
        }
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
      const hold = weaponApi.getHolder(closest);
      if (hold && hold.meta) {
        if (slot.boundWeaponId) hold.meta.boundWeaponId = slot.boundWeaponId;
        if (slot.boundOwnerId != null) hold.meta.boundOwnerId = slot.boundOwnerId;
        if (slot.tier) hold.meta.tier = slot.tier;
      }
      log('PICKUP', `id=${slot.id} fighter=${closest.name} weapon=${slot.weaponId}`);
      emitParticles(slot.x, slot.y, PLACEHOLDER_ART[slot.weaponId]?.color || '#ffffff', 22, 360, 5, 0.5, 'square');
      spawnShockwave(slot.x, slot.y, '#ffffff', 140);
      slot.phase = 'REMOVED';
    }
  }

  // POST-C §8: the missing-asset fallback is a glyph-free magenta plate with a
  // cross — debug tooling stays, arena text goes to zero. The weapon id is
  // still logged for F3/diagnostics.
  function drawDebugMissingWeapon(ctx, weaponId) {
    if (!(AQ.state && AQ.state.debugOverlay)) return;
    ctx.save();
    ctx.fillStyle = '#ff2bd6';
    ctx.strokeStyle = '#1b0016';
    ctx.lineWidth = 4;
    ctx.fillRect(-28, -28, 56, 56);
    ctx.strokeRect(-28, -28, 56, 56);
    ctx.strokeStyle = '#1b0016';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-14, -14); ctx.lineTo(14, 14);
    ctx.moveTo(14, -14); ctx.lineTo(-14, 14);
    ctx.stroke();
    ctx.restore();
  }

  const rarityCache = new Map();
  const rarityStats = { builds: 0, draws: 0, hits: 0 };
  const wellCache = new Map();
  function contactWell(kind) {
    const key = kind || 'gun';
    const hit = wellCache.get(key);
    if (hit) return hit;
    const w = 96, h = 48;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const c = canvas.getContext('2d');
    const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, kind === 'heal' ? 38 : 34);
    g.addColorStop(0, kind === 'heal' ? 'rgba(8,18,12,0.55)' : 'rgba(8,10,14,0.62)');
    g.addColorStop(0.55, kind === 'heal' ? 'rgba(8,18,12,0.28)' : 'rgba(8,10,14,0.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(w / 2, h / 2 + 4, kind === 'heal' ? 30 : 26, 11, 0, 0, Math.PI * 2);
    c.fill();
    const rec = { canvas, ox: w / 2, oy: h / 2 };
    wellCache.set(key, rec);
    return rec;
  }
  function raritySprite(tier, glow, glowSpec, q) {
    const key = tier + ':' + q;
    const hit = rarityCache.get(key);
    if (hit) return { canvas: hit.canvas, ox: hit.ox, oy: hit.oy, cached: true };
    const pulse = q / 7;
    const rx = glowSpec.rx + pulse * 4;
    const ry = glowSpec.ry + pulse * 1.5;
    const pad = 24 + glowSpec.rx * 0.5;
    const w = Math.ceil(rx * 2 + pad * 2);
    const h = Math.ceil(ry * 2 + pad * 2);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const c = canvas.getContext('2d');
    c.translate(w / 2, h / 2);
    const a0 = Math.min(0.95, glowSpec.a + glowSpec.pulse * pulse + 0.15);
    const grad = c.createRadialGradient(0, 0, 2, 0, 0, rx);
    grad.addColorStop(0, glow);
    grad.addColorStop(0.35, glow);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = a0;
    c.fillStyle = grad;
    c.shadowColor = glow;
    c.shadowBlur = 18 + glowSpec.rx * 0.35 + pulse * 10;
    c.beginPath();
    c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    if (glowSpec.shimmer) {
      const warm = c.createRadialGradient(0, 0, 1, 0, 0, rx * 0.55);
      warm.addColorStop(0, 'rgba(255,210,122,0.55)');
      warm.addColorStop(1, 'rgba(255,210,122,0)');
      c.globalAlpha = 0.22 + 0.16 * pulse;
      c.fillStyle = warm;
      c.beginPath();
      c.ellipse(0, 0, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
      c.fill();
    }
    const rec = { canvas, ox: w / 2, oy: h / 2 };
    rarityCache.set(key, rec);
    rarityStats.builds += 1;
    return { canvas, ox: rec.ox, oy: rec.oy, cached: false };
  }

  // Called inside the engine camera transform so slots sit in world space.
  function drawSlots(ctx) {
    const state = AQ.state;
    if (!state) return;
    const t = state.time;

    for (const slot of state.slots) {
      ctx.save();
      ctx.translate(slot.x, slot.y);

      if (slot.kind === 'HEAL' && slot.phase === 'REVEALED') {
        const bob = Math.sin(t * 3.1 + slot.id) * 4;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + slot.id);
        const well = contactWell('heal');
        ctx.save();
        ctx.translate(0, bob + 18);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(well.canvas, -well.ox, -well.oy + 6);
        ctx.globalAlpha = 0.28 + 0.18 * pulse;
        ctx.fillStyle = 'rgba(56,224,122,0.55)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 28 + pulse * 4, 10, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.translate(0, bob);
        const feel = window.APEX_ARSENAL_FEEL;
        const rec = feel && feel.heals && feel.heals.find((h) => h.id === slot.weaponId);
        const img = rec && rec.img;
        if (img && img.complete && img.naturalWidth) {
          const h = 52;
          const w = img.naturalWidth * (h / img.naturalHeight);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else {
          ctx.fillStyle = '#38E07A';
          ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
        }
        ctx.restore();
        continue;
      }

      if (slot.phase === 'TELEGRAPH' || slot.phase === 'COUNTER_RESERVED') {
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

        // POST-C §8: no '?' glyph — the unknown-pickup core is a glyph-free
        // rotating diamond that pulses with the same cadence as the ring.
        ctx.globalAlpha = 0.6 + 0.3 * pulse;
        ctx.fillStyle = '#efe6c8';
        ctx.strokeStyle = '#241f14';
        ctx.lineWidth = 4;
        ctx.save();
        ctx.rotate(t * 1.4 + slot.id);
        const core = 11 + 2.5 * pulse;
        ctx.beginPath();
        ctx.moveTo(0, -core);
        ctx.lineTo(core * 0.72, 0);
        ctx.lineTo(0, core);
        ctx.lineTo(-core * 0.72, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.restore();
      } else if (slot.phase === 'REVEALED') {
        const bob = Math.sin(t * 3.1 + slot.id) * 4;
        const glow = (CFG.TIER_COLORS && slot.tier && CFG.TIER_COLORS[slot.tier]) || null;
        const glowSpec = (CFG.TIER_GLOW && slot.tier && CFG.TIER_GLOW[slot.tier]) || { rx: 34, ry: 10, a: 0.35, pulse: 0 };
        const well = contactWell('gun');
        ctx.save();
        ctx.translate(0, bob + 22);
        ctx.drawImage(well.canvas, -well.ox, -well.oy + 4);
        ctx.restore();
        if (glow) {
          const pulse = 0.5 + 0.5 * Math.sin(t * (1.4 + glowSpec.pulse * 4) + slot.id);
          const q = Math.max(0, Math.min(7, pulse * 7 + 0.5 | 0));
          const sprite = raritySprite(slot.tier, glow, glowSpec, q);
          ctx.save();
          ctx.translate(0, bob + 22);
          ctx.drawImage(sprite.canvas, -sprite.ox, -sprite.oy);
          ctx.restore();
          rarityStats.draws += 1;
          if (sprite.cached) rarityStats.hits += 1;
        }
        const expireSoon = slot.revealedFor > CFG.PICKUP_LIFETIME_SECONDS - 3;
        ctx.globalAlpha = expireSoon && Math.floor(t * 8) % 2 === 0 ? 0.45 : 1;
        ctx.translate(0, bob);

        const av = window.APEX_ARSENAL_AV;
        const meta = av && av.weaponMeta && av.weaponMeta(slot.weaponId);
        const useWorld = !!(meta && meta.worldW);
        const drawn = !!(av && av.drawWeaponSprite && av.drawWeaponSprite(ctx, slot.weaponId, 0, 0, {
          mode: 'floor',
          useWorld,
          targetLongSide: slot.weaponId === 'GRENADE' ? 56 : (useWorld ? undefined : 118),
          alpha: 1,
        }));
        if (!drawn) drawDebugMissingWeapon(ctx, slot.weaponId);
      }

      ctx.restore();
    }
  }

  window.APEX_ARSENAL_SPAWN = {
    trySpawnSlot,
    trySpawnHealSupport,
    selectHealId,
    updateSlots,
    resolvePickups,
    drawSlots,
    predictContactETA,
    isEligibleForPickup,
    selectSpawnWeapon,
    weightFor,
    PLACEHOLDER_ART,
    rarityStats,
  };
  window.apexArsenalSpawnRuntime = 'ready';
})();
