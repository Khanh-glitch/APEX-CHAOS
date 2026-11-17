/* =============================================================================
 * APEX CHAOS — BEYOND Free Battle Tactical Combat Engine
 * Elevates Free Battle (BOT & LOCAL 1v1) with:
 *   1. Kinetic Impulse & 180ms Perfect Deflect (Space/WASD, Enter/Arrows, or Canvas Tap)
 *   2. Steel-on-Steel Weapon Clashes (momentum-resolved hitstop duels)
 *   3. Hydraulic Wall-Slam Physics (high-speed wall bounce shockwaves & bonus chip)
 *   4. APEX Overdrive Gauge (0-100% momentum surge: +speed, +cooldown haste, aura)
 *   5. Original Total Evolution arena hazards (toggleable)
 *   6. Adaptive BOT AI (ROOKIE / VETERAN / APEX)
 * Strictly scoped to standard Free Battle — cleanly bypassed during Story Quest,
 * Arsenal Lab, and BOT WAVE so no other mode is altered.
 * ========================================================================== */
(function installApexBeyondCombat(global) {
  'use strict';
  if (global.APEX_BEYOND_COMBAT) return;

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const SETTINGS_KEY = 'apexChaos.beyondSettings.v1';

  const settings = {
    botTier: 'VETERAN',    // 'ROOKIE' | 'VETERAN' | 'APEX'
    arenaEvents: true,     // Mid-match Scrap Basin events ON/OFF
    hyperChaos: false,     // Faster cadence + quicker Kinetic recharge
    cameraDirector: true,  // Dynamic combat framing ON/OFF
  };
  try {
    const raw = global.localStorage?.getItem(SETTINGS_KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch (_) {}

  function saveSettings() {
    try { global.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
    global.APEX_BEYOND_VFX?.setCameraDirectorEnabled?.(settings.cameraDirector);
    global.APEX_BEYOND_ARENA?.setEventsEnabled?.(settings.arenaEvents);
    global.dispatchEvent?.(new CustomEvent('apex:beyond-settings', { detail: { ...settings } }));
  }

  function makeSideState() {
    return {
      impulseCharge: 1.0,      // starts ready!
      impulseTimer: 0,
      deflectWindow: 0,
      overdrive: 0,            // 0..100
      overdriveTimer: 0,       // >0 when APEX OVERDRIVE is active
      combo: 0,
      comboTimer: 0,
      deflects: 0,
      clashesWon: 0,
      wallSlams: 0,
      lastHitBy: null,
      lastHitAt: -10,
      botThinkTimer: 0.4,
    };
  }

  const state = {
    active: false,
    matchTime: 0,
    clashCooldown: 0,
    sides: [makeSideState(), makeSideState()],
    event: null,               // { type, phase: 'TELEGRAPH'|'ACTIVE', remaining, telegraphDuration, activeDuration, label, sub, zone?, drop? }
    nextEventAt: 13.5,
    eventCycleIndex: 0,
    koTriggered: false,
    firstHintShownAt: 0,
    p1ImpulseUsed: false,
    recentBanner: null,        // { text, color, life }
  };

  const heldKeys = new Set();
  function isFreeBattleEligible() {
    if (global.gameState !== 'ARSENAL') return false;
    const aq = global.APEX_ARSENAL?.state;
    if (!aq || !aq.active) return false;
    if (aq.labMode || aq.questMultiActor || aq.questReflex
      || aq.questScrapSwarmProgression || aq.questWeaponRainProgression
      || aq.questBreakerChargeProgression || aq.questBreachEncounter
      || aq.questTotProgression) return false;
    return true;
  }

  function resetMatch() {
    state.active = isFreeBattleEligible();
    state.matchTime = 0;
    state.clashCooldown = 0;
    state.sides = [makeSideState(), makeSideState()];
    state.event = null;
    state.nextEventAt = settings.hyperChaos ? 9.5 : 13.5;
    state.eventCycleIndex = 0;
    state.koTriggered = false;
    state.firstHintShownAt = performance.now();
    state.p1ImpulseUsed = false;
    state.recentBanner = null;
    global.APEX_BEYOND_ARENA?.resetMatch?.();
    global.APEX_BEYOND_VFX?.reset?.();
    global.APEX_BEYOND_VFX?.setCameraDirectorEnabled?.(settings.cameraDirector);
  }

  function sideIndexOf(fighter) {
    const fs = global.fighters;
    if (!Array.isArray(fs) || !fighter) return -1;
    if (fs[0] === fighter) return 0;
    if (fs[1] === fighter) return 1;
    return -1;
  }

  function addOverdrive(sideIdx, amount) {
    if (sideIdx !== 0 && sideIdx !== 1) return;
    const st = state.sides[sideIdx];
    const f = global.fighters?.[sideIdx];
    if (!f || f.hp <= 0 || st.overdriveTimer > 0) return;
    const mult = isInOverclockZone(f) ? 2.5 : (settings.hyperChaos ? 1.35 : 1.0);
    st.overdrive = clamp(st.overdrive + amount * mult, 0, 100);
    if (st.overdrive >= 100) {
      st.overdrive = 0;
      st.overdriveTimer = 8.0;
      st.impulseCharge = 1.0; // instant Impulse refill on Overdrive!
      global.APEX_BEYOND_VFX?.onOverdriveStart?.(f);
      // Brief global excitement hitstop
      if (typeof global.hitStop === 'number') global.hitStop = Math.max(global.hitStop, 0.045);
    }
  }

  function isInOverclockZone(f) {
    if (!f || !state.event || state.event.phase !== 'ACTIVE' || state.event.type !== 'OVERCLOCK_ZONE' || !state.event.zone) {
      return false;
    }
    const z = state.event.zone;
    return Math.hypot(f.x - z.x, f.y - z.y) <= z.r + (f.radius || 32) * 0.4;
  }

  // ---- Smart Tactical Aim Computation ----
  function computeSmartAim(sideIdx) {
    const fs = global.fighters;
    const self = fs?.[sideIdx];
    const enemy = fs?.[1 - sideIdx];
    if (!self) return { dx: 1, dy: 0 };

    // 1. Check explicit directional keys held by human player
    let kx = 0, ky = 0;
    if (sideIdx === 0) {
      if (heldKeys.has('KeyA')) kx -= 1;
      if (heldKeys.has('KeyD')) kx += 1;
      if (heldKeys.has('KeyW')) ky -= 1;
      if (heldKeys.has('KeyS')) ky += 1;
    } else if (global.APEX_ARSENAL?.state?.battleMode !== 'BOT') {
      if (heldKeys.has('ArrowLeft')) kx -= 1;
      if (heldKeys.has('ArrowRight')) kx += 1;
      if (heldKeys.has('ArrowUp')) ky -= 1;
      if (heldKeys.has('ArrowDown')) ky += 1;
    }
    if (kx !== 0 || ky !== 0) {
      const m = Math.hypot(kx, ky) || 1;
      return { dx: kx / m, dy: ky / m };
    }

    // 2. Smart Vector Assist: evaluate threats -> high-tier weapons -> heals -> tactical flank
    const weaponApi = global.APEX_ARSENAL?.weaponApi;
    const holder = weaponApi?.getHolder?.(self);
    const slots = global.APEX_ARSENAL?.state?.slots || [];

    // Urgent deflect against nearby incoming enemy projectile
    const projs = global.projectiles || [];
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      if (!p || p.owner === self || !Number.isFinite(p.x)) continue;
      const d = Math.hypot(p.x - self.x, p.y - self.y);
      if (d < 190 && (p.vx || p.vy)) {
        const dotToward = ((self.x - p.x) * (p.vx || 0) + (self.y - p.y) * (p.vy || 0));
        if (dotToward > 0) {
          const m = Math.hypot(p.x - self.x, p.y - self.y) || 1;
          return { dx: (p.x - self.x) / m, dy: (p.y - self.y) / m };
        }
      }
    }

    // If low HP and heal slot available
    if (self.hp < self.maxHp * 0.58) {
      let bestHeal = null, bestD = 420;
      for (const s of slots) {
        if (s.phase === 'REVEALED' && s.kind === 'HEAL') {
          const d = Math.hypot(s.x - self.x, s.y - self.y);
          if (d < bestD) { bestD = d; bestHeal = s; }
        }
      }
      if (bestHeal) {
        const m = Math.hypot(bestHeal.x - self.x, bestHeal.y - self.y) || 1;
        return { dx: (bestHeal.x - self.x) / m, dy: (bestHeal.y - self.y) / m };
      }
    }

    // If unarmed, race toward the highest-priority revealed weapon!
    if (!holder) {
      const tierWeight = { T6: 460, T5: 220, T4: 130, T3: 70, T2: 30, T1: 0 };
      let bestSlot = null, bestScore = -Infinity;
      for (const s of slots) {
        if (s.phase !== 'REVEALED' || s.kind !== 'WEAPON') continue;
        if (s.__frostFrozen && global.APEX_FROST?.deniesPickup?.(s, self)) continue;
        const d = Math.hypot(s.x - self.x, s.y - self.y);
        const score = (tierWeight[s.tier] || 0) - d;
        if (score > bestScore) { bestScore = score; bestSlot = s; }
      }
      if (bestSlot) {
        const m = Math.hypot(bestSlot.x - self.x, bestSlot.y - self.y) || 1;
        return { dx: (bestSlot.x - self.x) / m, dy: (bestSlot.y - self.y) / m };
      }
    }

    // If Overclock Zone is active and we are outside, surge toward it if close
    if (state.event?.phase === 'ACTIVE' && state.event.type === 'OVERCLOCK_ZONE' && state.event.zone && !isInOverclockZone(self)) {
      const z = state.event.zone;
      const d = Math.hypot(z.x - self.x, z.y - self.y);
      if (d < 460) {
        return { dx: (z.x - self.x) / d, dy: (z.y - self.y) / d };
      }
    }

    // Otherwise tactical strike or flank angle toward rival
    if (enemy && enemy.hp > 0) {
      const ex = enemy.x - self.x;
      const ey = enemy.y - self.y;
      const d = Math.hypot(ex, ey) || 1;
      const isRanged = holder?.def?.category === 'ranged';
      if (isRanged && d < 240) {
        // Ranged kiting diagonal sidestep
        const perp = (sideIdx === 0 ? 1 : -1) * 0.72;
        const dx = (-ex / d) * 0.68 + (-ey / d) * perp;
        const dy = (-ey / d) * 0.68 + (ex / d) * perp;
        const m = Math.hypot(dx, dy) || 1;
        return { dx: dx / m, dy: dy / m };
      }
      return { dx: ex / d, dy: ey / d };
    }

    return { dx: self.dir?.x || 1, dy: self.dir?.y || 0 };
  }

  function triggerImpulse(sideIdx, targetX = null, targetY = null) {
    if (!isFreeBattleEligible()) return false;
    const aq = global.APEX_ARSENAL?.state;
    if (!aq || aq.over) return false;
    const f = global.fighters?.[sideIdx];
    const st = state.sides[sideIdx];
    if (!f || f.hp <= 0 || !st) return false;
    if (f.hardCC && f.hardCC()) return false;
    if (st.impulseCharge < 0.99) return false;

    let dx, dy;
    if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
      const vx = targetX - f.x;
      const vy = targetY - f.y;
      const m = Math.hypot(vx, vy);
      if (m > 8) { dx = vx / m; dy = vy / m; }
      else { const a = computeSmartAim(sideIdx); dx = a.dx; dy = a.dy; }
    } else {
      const a = computeSmartAim(sideIdx);
      dx = a.dx; dy = a.dy;
    }

    st.impulseCharge = 0;
    st.impulseTimer = 0.28;
    st.deflectWindow = 0.185; // 185ms PERFECT DEFLECT shield!
    if (sideIdx === 0) state.p1ImpulseUsed = true;

    if (typeof f.setDir === 'function') f.setDir(dx, dy);
    else { f.dir = { x: dx, y: dy }; }

    const boost = st.overdriveTimer > 0 ? 860 : 740;
    if (typeof f.addStatus === 'function') {
      f.addStatus('push', 0.25, { x: dx, y: dy, strength: boost, max: 0.25 });
    }
    global.APEX_BEYOND_VFX?.onImpulseBurst?.(f, Math.atan2(dy, dx), st.overdriveTimer > 0);
    return true;
  }

  // ---- Perfect Deflect Resolution ----
  function resolvePerfectDeflects() {
    const fs = global.fighters;
    const projs = global.projectiles;
    if (!Array.isArray(fs) || !Array.isArray(projs)) return;

    for (let i = 0; i < 2; i++) {
      const f = fs[i];
      const st = state.sides[i];
      const enemy = fs[1 - i];
      if (!f || f.hp <= 0 || !st || st.deflectWindow <= 0) continue;

      const reflectR = (f.radius || 34) + 54;
      for (let pIdx = 0; pIdx < projs.length; pIdx++) {
        const p = projs[pIdx];
        if (!p || p.life <= 0 || p.owner === f || p.__beyondDeflectedBy === f.id) continue;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        // Reflect ballistic & thrown projectiles (skip static floor zones / walls)
        const hasVel = Number.isFinite(p.vx) && Number.isFinite(p.vy) && Math.hypot(p.vx, p.vy) > 40;
        if (!hasVel) continue;
        const d = Math.hypot(p.x - f.x, p.y - f.y);
        if (d > reflectR) continue;

        // PERFECT DEFLECT! Reverse toward original shooter at 1.45x speed!
        const origSpd = Math.hypot(p.vx, p.vy) * 1.45;
        let rx = -p.vx, ry = -p.vy;
        if (enemy && enemy.hp > 0) {
          rx = enemy.x - p.x;
          ry = enemy.y - p.y;
        }
        const rm = Math.hypot(rx, ry) || 1;
        p.vx = (rx / rm) * origSpd;
        p.vy = (ry / rm) * origSpd;
        p.owner = f;
        p.__beyondDeflectedBy = f.id;
        if (Number.isFinite(p.damage)) p.damage *= 1.35;
        if (Number.isFinite(p.life)) p.life = Math.max(p.life, 0.9);

        st.deflects += 1;
        st.impulseCharge = Math.min(1, st.impulseCharge + 0.55);
        addOverdrive(i, 32);
        if (typeof global.hitStop === 'number') global.hitStop = Math.max(global.hitStop, 0.055);
        global.APEX_BEYOND_VFX?.onPerfectDeflect?.(p.x, p.y, Math.atan2(ry, rx));
        // Prevent multi-trigger on same pellet volley frame
        st.deflectWindow = Math.min(st.deflectWindow, 0.06);
      }
    }
  }

  // ---- Steel-on-Steel Weapon Clash Resolution ----
  function onFighterContact(f0, f1) {
    if (!isFreeBattleEligible() || state.clashCooldown > 0) return;
    if (!f0 || !f1 || f0.hp <= 0 || f1.hp <= 0) return;

    const st0 = state.sides[0], st1 = state.sides[1];
    const weaponApi = global.APEX_ARSENAL?.weaponApi;
    const h0 = weaponApi?.getHolder?.(f0);
    const h1 = weaponApi?.getHolder?.(f1);

    // Check Perfect Deflect counter on direct body collision!
    if (st0.deflectWindow > 0 && st1.deflectWindow <= 0) {
      const dx = f1.x - f0.x, dy = f1.y - f0.y;
      const m = Math.hypot(dx, dy) || 1;
      f1.addStatus?.('push', 0.34, { x: dx / m, y: dy / m, strength: 880, max: 0.34 });
      f1.addStatus?.('stun', 0.25);
      st0.deflects += 1;
      st0.impulseCharge = Math.min(1, st0.impulseCharge + 0.5);
      st0.deflectWindow = 0;
      st1.lastHitBy = f0; st1.lastHitAt = state.matchTime;
      addOverdrive(0, 28);
      state.clashCooldown = 0.75;
      if (typeof global.hitStop === 'number') global.hitStop = Math.max(global.hitStop, 0.06);
      global.APEX_BEYOND_VFX?.onPerfectDeflect?.((f0.x + f1.x) / 2, (f0.y + f1.y) / 2, Math.atan2(dy, dx));
      return;
    }
    if (st1.deflectWindow > 0 && st0.deflectWindow <= 0) {
      const dx = f0.x - f1.x, dy = f0.y - f1.y;
      const m = Math.hypot(dx, dy) || 1;
      f0.addStatus?.('push', 0.34, { x: dx / m, y: dy / m, strength: 880, max: 0.34 });
      f0.addStatus?.('stun', 0.25);
      st1.deflects += 1;
      st1.impulseCharge = Math.min(1, st1.impulseCharge + 0.5);
      st1.deflectWindow = 0;
      st0.lastHitBy = f1; st0.lastHitAt = state.matchTime;
      addOverdrive(1, 28);
      state.clashCooldown = 0.75;
      if (typeof global.hitStop === 'number') global.hitStop = Math.max(global.hitStop, 0.06);
      global.APEX_BEYOND_VFX?.onPerfectDeflect?.((f0.x + f1.x) / 2, (f0.y + f1.y) / 2, Math.atan2(dy, dx));
      return;
    }

    // Steel-on-Steel Clash when both armed OR either lunging with Impulse/Overdrive
    const energetic = (h0 && h1) || st0.impulseTimer > 0 || st1.impulseTimer > 0 || st0.overdriveTimer > 0 || st1.overdriveTimer > 0;
    if (!energetic) return;

    const score0 = (st0.impulseTimer > 0 ? 45 : 0) + (st0.overdriveTimer > 0 ? 35 : 0) + (h0?.def?.category === 'melee' ? 28 : h0 ? 14 : 0);
    const score1 = (st1.impulseTimer > 0 ? 45 : 0) + (st1.overdriveTimer > 0 ? 35 : 0) + (h1?.def?.category === 'melee' ? 28 : h1 ? 14 : 0);
    const heavy = score0 >= 45 || score1 >= 45 || (h0?.weaponId === 'STORMBREAKER' || h1?.weaponId === 'STORMBREAKER');

    const mx = (f0.x + f1.x) * 0.5;
    const my = (f0.y + f1.y) * 0.5;
    const nx = f1.x - f0.x, ny = f1.y - f0.y;
    const m = Math.hypot(nx, ny) || 1;
    const ux = nx / m, uy = ny / m;

    const push0 = score1 > score0 ? 780 : 520;
    const push1 = score0 > score1 ? 780 : 520;
    f0.addStatus?.('push', 0.28, { x: -ux, y: -uy, strength: push0, max: 0.28 });
    f1.addStatus?.('push', 0.28, { x: ux, y: uy, strength: push1, max: 0.28 });

    if (score0 > score1 + 10) {
      st0.clashesWon += 1;
      st1.lastHitBy = f0; st1.lastHitAt = state.matchTime;
      addOverdrive(0, 18);
      addOverdrive(1, 8);
    } else if (score1 > score0 + 10) {
      st1.clashesWon += 1;
      st0.lastHitBy = f1; st0.lastHitAt = state.matchTime;
      addOverdrive(1, 18);
      addOverdrive(0, 8);
    } else {
      addOverdrive(0, 12);
      addOverdrive(1, 12);
    }

    state.clashCooldown = 1.15;
    if (typeof global.hitStop === 'number') global.hitStop = Math.max(global.hitStop, heavy ? 0.065 : 0.042);
    global.APEX_BEYOND_VFX?.onWeaponClash?.(mx, my, heavy);
  }

  // ---- Wall-Slam Resolution ----
  function onWallImpact(fighter, side) {
    if (!isFreeBattleEligible() || !fighter || fighter.hp <= 0) return;
    const idx = sideIndexOf(fighter);
    if (idx < 0) return;
    const st = state.sides[idx];
    const rival = global.fighters?.[1 - idx];

    const fm = fighter.__hrFrameMotion;
    const vx = (fm?.locomotionVx || 0) + (fm?.engineForceVx || 0);
    const vy = (fm?.locomotionVy || 0) + (fm?.engineForceVy || 0);
    const spd = Math.hypot(vx, vy);

    const isShockwalls = state.event?.phase === 'ACTIVE' && state.event.type === 'SHOCKWALLS';
    const recentlyKnocked = (state.matchTime - st.lastHitAt) < 1.35 && st.lastHitBy === rival;
    const hasHeavyPush = fighter.hasStatus && fighter.hasStatus('push');

    const S = global.GAME_SIZE || 1000;
    const wx = side === 'left' ? 32 : side === 'right' ? S - 32 : fighter.x;
    const wy = side === 'top' ? 32 : side === 'bottom' ? S - 32 : fighter.y;

    // Hydraulic shockwall speed launch
    if (isShockwalls) {
      const nx = side === 'left' ? 1 : side === 'right' ? -1 : fighter.dir.x;
      const ny = side === 'top' ? 1 : side === 'bottom' ? -1 : fighter.dir.y;
      const nm = Math.hypot(nx, ny) || 1;
      fighter.addStatus?.('push', 0.24, { x: nx / nm, y: ny / nm, strength: 420, max: 0.24 });
    }

    if ((spd > 660 && (recentlyKnocked || hasHeavyPush)) || (isShockwalls && spd > 560 && recentlyKnocked)) {
      const strength = clamp(spd / 740, 0.85, 1.45) * (isShockwalls ? 1.25 : 1);
      global.APEX_BEYOND_VFX?.onWallSlam?.(wx, wy, side, strength, isShockwalls ? '#ff9d3b' : '#ffc15e');
      if (rival && rival.hp > 0 && fighter.hp > 40) {
        const chip = Math.round((isShockwalls ? 34 : 22) * clamp(strength, 0.8, 1.35));
        fighter.takeDamage(Math.min(chip, fighter.hp - 1), rival, 'beyond-wall-slam', true);
        fighter.addStatus?.('stun', 0.22);
        state.sides[1 - idx].wallSlams += 1;
        addOverdrive(1 - idx, 16);
      }
      st.lastHitAt = -10; // consume knockback slam once
    } else {
      // Subtle reactive hydraulic bumper flash & spark kiss on ordinary bounces
      global.APEX_BEYOND_ARENA?.triggerWallImpact?.(side, (side === 'left' || side === 'right') ? fighter.y : fighter.x, 0.35, fighter.color);
      global.APEX_BEYOND_VFX?.emitSparks?.(wx, wy, 4, {
        angle: side === 'left' ? 0 : side === 'right' ? Math.PI : side === 'top' ? Math.PI / 2 : -Math.PI / 2,
        spread: 1.5,
        speedMin: 110,
        speedMax: 280,
        color: '#ffd080',
        width: 1.7,
        lifeMax: 0.24,
      });
    }
  }

  // ---- Adaptive BOT AI Tactical Impulse Brain ----
  function updateBotBrain(dt) {
    const aq = global.APEX_ARSENAL?.state;
    if (!aq || aq.battleMode !== 'BOT' || aq.over) return;
    const bot = global.fighters?.[1];
    const p1 = global.fighters?.[0];
    const st = state.sides[1];
    if (!bot || !p1 || bot.hp <= 0 || p1.hp <= 0 || !st) return;

    st.botThinkTimer -= dt;
    if (st.botThinkTimer > 0) return;

    const cfg = settings.botTier === 'APEX'
      ? { interval: 0.16, deflectChance: 0.74, weaponChase: 0.85, aggro: 0.58 }
      : settings.botTier === 'ROOKIE'
      ? { interval: 0.65, deflectChance: 0.12, weaponChase: 0.35, aggro: 0.18 }
      : { interval: 0.30, deflectChance: 0.42, weaponChase: 0.65, aggro: 0.38 };

    st.botThinkTimer = cfg.interval;
    if (st.impulseCharge < 0.99) return;

    // 1. Reactive Perfect Deflect check on incoming player projectile
    const projs = global.projectiles || [];
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      if (!p || p.owner === bot || !Number.isFinite(p.x)) continue;
      const d = Math.hypot(p.x - bot.x, p.y - bot.y);
      if (d < 155 && (p.vx || p.vy)) {
        const approaching = (bot.x - p.x) * (p.vx || 0) + (bot.y - p.y) * (p.vy || 0) > 0;
        if (approaching && Math.random() < cfg.deflectChance) {
          triggerImpulse(1, p.x, p.y);
          return;
        }
      }
    }

    // 2. Contest Stormbreaker / Supply Drop / high-tier weapon if unarmed
    const weaponApi = global.APEX_ARSENAL?.weaponApi;
    if (!weaponApi?.getHolder?.(bot)) {
      const slots = aq.slots || [];
      for (const s of slots) {
        if (s.phase === 'REVEALED' && s.kind === 'WEAPON' && (s.tier === 'T6' || s.tier === 'T5' || s.tier === 'T4' || Math.random() < cfg.weaponChase)) {
          const d = Math.hypot(s.x - bot.x, s.y - bot.y);
          if (d < 460) {
            triggerImpulse(1, s.x, s.y);
            return;
          }
        }
      }
    }

    // 3. Aggressive flank / wall-slam lunge
    const distEnemy = Math.hypot(p1.x - bot.x, p1.y - bot.y);
    if (distEnemy > 190 && distEnemy < 470 && Math.random() < cfg.aggro) {
      triggerImpulse(1, p1.x, p1.y);
    }
  }

  // ---- Per-Frame Main Tick ----
  function tick(dt, rawDt) {
    const eligible = isFreeBattleEligible();
    state.active = eligible;
    global.APEX_BEYOND_ARENA?.tick?.(rawDt || dt);
    global.APEX_BEYOND_VFX?.tick?.(dt, rawDt || dt);
    if (!eligible) return;

    const aq = global.APEX_ARSENAL?.state;
    if (aq && aq.over) {
      if (!state.koTriggered) {
        state.koTriggered = true;
        const fs = global.fighters || [];
        const loser = (fs[0] && fs[0].hp <= 0) ? fs[0] : (fs[1] && fs[1].hp <= 0) ? fs[1] : null;
        const winner = loser === fs[0] ? fs[1] : fs[0];
        if (loser) global.APEX_BEYOND_VFX?.triggerKoCinema?.(loser, winner);
      }
      return;
    }

    state.matchTime += dt;
    if (state.clashCooldown > 0) state.clashCooldown = Math.max(0, state.clashCooldown - dt);

    const fs = global.fighters || [];
    for (let i = 0; i < 2; i++) {
      const f = fs[i];
      const st = state.sides[i];
      if (!f || !st) continue;

      if (st.impulseTimer > 0) st.impulseTimer = Math.max(0, st.impulseTimer - dt);
      if (st.deflectWindow > 0) st.deflectWindow = Math.max(0, st.deflectWindow - dt);
      if (st.comboTimer > 0) {
        st.comboTimer -= dt;
        if (st.comboTimer <= 0) st.combo = 0;
      }

      // Recharge Kinetic Impulse capacitor
      const inZone = isInOverclockZone(f);
      const baseRecharge = settings.hyperChaos ? 0.44 : 0.31; // ~3.2s standard, ~2.2s hyper
      const zoneMult = inZone ? 1.8 : 1.0;
      const odMult = st.overdriveTimer > 0 ? 1.45 : 1.0;
      if (st.impulseCharge < 1) {
        st.impulseCharge = Math.min(1, st.impulseCharge + dt * baseRecharge * zoneMult * odMult);
      }

      // Overdrive duration & speed/cooldown haste bonus
      if (st.overdriveTimer > 0) {
        st.overdriveTimer = Math.max(0, st.overdriveTimer - dt);
        // Subtle passive speed nudge along movement dir during Overdrive (+18%)
        if (f.hp > 0 && !f.hardCC?.() && f.dir) {
          f.x += f.dir.x * (f.baseSpeed || 520) * 0.16 * dt;
          f.y += f.dir.y * (f.baseSpeed || 520) * 0.16 * dt;
        }
      } else if (inZone && f.hp > 0) {
        // Fighting inside Overclock Zone steadily fills Overdrive!
        addOverdrive(i, 7.5 * dt);
      }

      // Cooldown haste bonus from Overdrive or Overclock Zone on rework hero skills
      if ((st.overdriveTimer > 0 || inZone) && f.hp > 0) {
        const extraDt = dt * (st.overdriveTimer > 0 ? 0.28 : 0.35);
        const hrc = global.APEX_HERO_REWORK?.combatantFor?.(f);
        if (hrc?.skills) {
          for (const key of ['A1', 'A2']) {
            const sk = hrc.skills[key];
            if (sk && typeof sk.cooldown === 'number' && sk.cooldown > 0) {
              sk.cooldown = Math.max(0, sk.cooldown - extraDt);
            }
          }
        }
      }
    }

    resolvePerfectDeflects();
    // Old BEYOND event scheduler removed: original Evolution hazards own arenas.
    global.APEX_BEYOND_ARENA?.setEventsEnabled?.(settings.arenaEvents);
    updateBotBrain(dt);
  }

  // ---- Clean Hooks into Realized Damage, AV Cues, Collisions, & Walls ----
  function installHooks() {
    if (global.__apexBeyondHooksInstalled) return;
    global.__apexBeyondHooksInstalled = true;

    global.APEX_BEYOND_VFX?.installCombatEffectUpgrades?.();

    // 1. Hook realized damage (HUD observer seam — never alters damage law!)
    const wrapDamageHook = () => {
      const hud = global.APEX_COMBAT_HUD;
      if (!hud || typeof hud.onRealizedDamage !== 'function' || hud.__beyondWrapped) return false;
      const orig = hud.onRealizedDamage.bind(hud);
      hud.__beyondWrapped = true;
      hud.onRealizedDamage = function beyondRealizedDamage(ev) {
        const res = orig(ev);
        if (isFreeBattleEligible() && ev && ev.victim && ev.amount > 0) {
          const v = ev.victim;
          const a = ev.attacker;
          const vi = sideIndexOf(v);
          const ai = sideIndexOf(a);
          const angle = (a && v) ? Math.atan2(v.y - a.y, v.x - a.x) : Math.random() * TAU;

          if (vi >= 0 && a && a !== v) {
            state.sides[vi].lastHitBy = a;
            state.sides[vi].lastHitAt = state.matchTime;
          }
          if (ai >= 0) {
            state.sides[ai].combo += 1;
            state.sides[ai].comboTimer = 2.4;
            addOverdrive(ai, clamp(ev.amount * 0.16, 4, 28));
          }
          if (vi >= 0) {
            // Taking hits also grants comeback Overdrive momentum!
            addOverdrive(vi, clamp(ev.amount * 0.10, 3, 18));
          }

          const heavy = ev.amount >= 75 || ev.critical || String(ev.label || '').includes('stormbreaker');
          global.APEX_BEYOND_VFX?.onHitImpact?.({
            x: v.x,
            y: v.y,
            angle,
            damage: ev.amount,
            critical: !!ev.critical,
            heavy,
            color: (a && a.color) || '#ffb84d',
            victim: v,
          });
        }
        return res;
      };
      return true;
    };
    if (!wrapDamageHook()) {
      const id = setInterval(() => { if (wrapDamageHook()) clearInterval(id); }, 250);
      setTimeout(() => clearInterval(id), 15000);
    }

    // 2. Hook AV cues for shell casings, dynamic muzzle lights, explosions, Stormbreaker sky-beams
    const wrapAvCue = () => {
      const AQ = global.APEX_ARSENAL;
      if (!AQ || typeof AQ.avCue !== 'function' || AQ.__beyondAvWrapped) return false;
      const origCue = AQ.avCue;
      AQ.__beyondAvWrapped = true;
      AQ.avCue = function beyondAvCue(name, data) {
        const out = origCue.apply(this, arguments);
        if (!isFreeBattleEligible()) return out;
        try {
          const x = data?.x ?? data?.fighter?.x;
          const y = data?.y ?? data?.fighter?.y;
          const ang = data?.angle ?? (data?.fighter?.dir ? Math.atan2(data.fighter.dir.y, data.fighter.dir.x) : 0);
          if (typeof name === 'string') {
            if (name.includes('fire') || name.includes('shot') || name === 'muzzle') {
              if (Number.isFinite(x) && Number.isFinite(y)) {
                global.APEX_BEYOND_ARENA?.addLight?.(x, y, 130, '#ffcb6b', 0.45, 0.14);
                global.APEX_BEYOND_VFX?.emitCasing?.(x, y, ang);
              }
            } else if (name.includes('explode') || name.includes('blast') || name === 'grenade_boom') {
              if (Number.isFinite(x) && Number.isFinite(y)) {
                global.APEX_BEYOND_ARENA?.stampScorch?.(x, y, 64, '#ff9442');
                global.APEX_BEYOND_ARENA?.stampFracture?.(x, y, ang, 1.0);
                global.APEX_BEYOND_ARENA?.addLight?.(x, y, 240, '#ff9e4a', 0.78, 0.34);
                global.APEX_BEYOND_VFX?.emitSparks?.(x, y, 22, { spread: TAU, speedMin: 240, speedMax: 720, color: '#ffb14a', width: 2.8 });
                global.APEX_BEYOND_VFX?.emitPlumes?.(x, y, 6, { spread: TAU, speed: 190, radius: 36 });
              }
            } else if (name === 'reveal' && data?.weaponId === 'STORMBREAKER') {
              if (Number.isFinite(x) && Number.isFinite(y)) {
                global.APEX_BEYOND_VFX?.emitSkyBeam?.(x, y, '#ff453e', 0.85);
                global.APEX_BEYOND_ARENA?.triggerPowerDip?.(0.38);
                global.APEX_BEYOND_VFX?.emitCallout?.(x, y - 55, 'STORMBREAKER!', '#ff6b61', '#1c0909', 1.15);
              }
            } else if (name === 'pickup' || name.startsWith('pickup_')) {
              if (Number.isFinite(x) && Number.isFinite(y)) {
                global.APEX_BEYOND_VFX?.emitRing?.(x, y, 68, '#ffe285', { lineWidth: 4, life: 0.24, doubleRing: false });
                global.APEX_BEYOND_ARENA?.addLight?.(x, y, 105, '#ffe082', 0.34, 0.18);
              }
            }
          }
        } catch (_) {}
        return out;
      };
      return true;
    };
    if (!wrapAvCue()) {
      const id = setInterval(() => { if (wrapAvCue()) clearInterval(id); }, 250);
      setTimeout(() => clearInterval(id), 15000);
    }

    // 3. Hook Fighter.prototype.resolveWalls cleanly to detect every real wall bounce
    if (global.Fighter && global.Fighter.prototype && !global.Fighter.prototype.__beyondWallWrapped) {
      const origWalls = global.Fighter.prototype.resolveWalls;
      global.Fighter.prototype.__beyondWallWrapped = true;
      global.Fighter.prototype.resolveWalls = function beyondResolveWalls() {
        const side = origWalls.apply(this, arguments);
        if (side) onWallImpact(this, side);
        return side;
      };
    }

    // 4. Keyboard & Canvas Tap/Click listeners for Kinetic Impulse!
    global.addEventListener('keydown', (e) => {
      heldKeys.add(e.code);
      if (!isFreeBattleEligible() || e.repeat) return;
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'KeyL') {
        if (triggerImpulse(0)) e.preventDefault();
      } else if (e.code === 'Enter' || e.code === 'ShiftRight' || e.code === 'Numpad0' || e.code === 'Numpad3') {
        if (global.APEX_ARSENAL?.state?.battleMode !== 'BOT') {
          if (triggerImpulse(1)) e.preventDefault();
        }
      }
    });
    global.addEventListener('keyup', (e) => {
      heldKeys.delete(e.code);
    });

    // Event-delegated Click / Tap directly on #game-canvas to fire P1 Kinetic Impulse toward that exact spot!
    document.addEventListener('pointerdown', (e) => {
      if (!isFreeBattleEligible()) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const cv = e.target && e.target.id === 'game-canvas' ? e.target : null;
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return;
      const S = global.GAME_SIZE || 1000;
      const worldX = ((e.clientX - rect.left) / rect.width) * S;
      const worldY = ((e.clientY - rect.top) / rect.height) * S;
      triggerImpulse(0, worldX, worldY);
    }, { passive: true });
  }

  function getHudSnapshot() {
    const aq = global.APEX_ARSENAL?.state;
    const active = isFreeBattleEligible();
    const theme = global.APEX_BEYOND_ARENA?.currentTheme?.() || { id: 'scrap_foundry', name: 'SCRAP BASIN FOUNDRY', short: 'FOUNDRY', accent: '#ff941f' };
    return {
      active,
      over: !!(aq && aq.over),
      battleMode: aq?.battleMode || 'BOT',
      matchTime: state.matchTime,
      theme,
      themes: global.APEX_BEYOND_ARENA?.THEMES || [],
      settings: { ...settings },
      p1ImpulseUsed: state.p1ImpulseUsed,
      showHint: active && !state.p1ImpulseUsed && state.matchTime < 10.0,
      event: global.APEX_BEYOND_ARENA?.getEvent?.() || null,
      sides: state.sides.map((s) => ({
        impulseCharge: s.impulseCharge,
        deflectWindow: s.deflectWindow,
        overdrive: s.overdrive,
        overdriveTimer: s.overdriveTimer,
        combo: s.combo,
        deflects: s.deflects,
        clashesWon: s.clashesWon,
        wallSlams: s.wallSlams,
      })),
    };
  }

  function updateSetting(patch) {
    Object.assign(settings, patch || {});
    saveSettings();
    return { ...settings };
  }

  installHooks();

  global.APEX_BEYOND_COMBAT = Object.freeze({
    resetMatch,
    tick,
    triggerImpulse,
    onFighterContact,
    onWallImpact,
    isFreeBattleEligible,
    getState: () => state,
    getHudSnapshot,
    getSettings: () => ({ ...settings }),
    updateSetting,
    installHooks,
  });
})(window);
