// ARSENAL QUEST PROTOTYPE — mode runtime (handoff §4, §10, §11, §12).
// Runs INSIDE the Apex engine: reuses Fighter movement/bounce/collision,
// handleCollisions, projectiles/particles/floatingTexts/shockwaves, camera
// shake / hit stop, HUD and SFX hooks. No standalone engine, no weapon-seeking
// AI — HERO and RIVAL ride the normal Apex auto movement law.
(function apexArsenalQuestRuntime() {
  if (window.apexArsenalQuestRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL;
  const CFG = window.APEX_ARSENAL_CONFIG;
  const SPAWN = window.APEX_ARSENAL_SPAWN;
  const weaponApi = AQ.weaponApi;

  // -------------------------------------------------------------------------
  // Blank fighter model (handoff §4): standard Apex Fighter machinery,
  // 100 HP, no update ability logic, no onCollide intrinsic damage, no rage.
  // -------------------------------------------------------------------------
  function makeArsenalFighterType(name, color, startDx, startDy) {
    return {
      name,
      color,
      desc: 'Arsenal Quest blank fighter — no intrinsic kit',
      speed: CFG.FIGHTER_SPEED,
      startDx,
      startDy,
      noRage: true,
      arsenalBlank: true,
      init: () => {},
      draw: (c, f) => {
        drawSketchBlob(c, f.radius, f.color, name === 'HERO' ? 13 : 17);
        c.save();
        c.rotate(-Math.atan2(f.dir.y, f.dir.x));
        c.fillStyle = name === 'HERO' ? '#efe6c8' : '#1b1a16';
        c.beginPath();
        c.moveTo(f.radius * 0.55, 0);
        c.lineTo(f.radius * 0.18, -12);
        c.lineTo(f.radius * 0.18, 12);
        c.closePath();
        c.fill();
        c.restore();
      },
    };
  }

  const HERO_TYPE = makeArsenalFighterType('HERO', CFG.HERO_COLOR, 1, 0.55);
  const RIVAL_TYPE = makeArsenalFighterType('RIVAL', CFG.RIVAL_COLOR, -1, -0.55);

  const AQ_PERF = {
    sections: {},
    peaks: {},
    chamber: { builds: 0, draws: 0, hits: 0, size: 0, usedCacheLast: false },
    hud: { skillWrites: 0, winWrites: 0, debugWrites: 0 },
  };
  function aqPerfMark(name, ms) {
    const s = AQ_PERF.sections[name] || (AQ_PERF.sections[name] = { n: 0, sum: 0, max: 0 });
    s.n += 1;
    s.sum += ms;
    if (ms > s.max) s.max = ms;
  }
  function aqPerfPeak(name, value) {
    const v = value || 0;
    if (v > (AQ_PERF.peaks[name] || 0)) AQ_PERF.peaks[name] = v;
  }
  function aqPerfSampleCounts() {
    const av = window.APEX_ARSENAL_AV;
    const slots = (AQ.state && AQ.state.slots) || [];
    let aqProj = 0;
    for (const p of (typeof projectiles !== 'undefined' && projectiles) || []) if (p && p.aq) aqProj += 1;
    aqPerfPeak('slots', slots.length);
    aqPerfPeak('aqProjectiles', aqProj);
    aqPerfPeak('projectiles', (typeof projectiles !== 'undefined' && projectiles.length) || 0);
    aqPerfPeak('particles', (typeof particles !== 'undefined' && particles.length) || 0);
    aqPerfPeak('floatingTexts', (typeof floatingTexts !== 'undefined' && floatingTexts.length) || 0);
    aqPerfPeak('shockwaves', (typeof shockwaves !== 'undefined' && shockwaves.length) || 0);
    aqPerfPeak('arsenalVfx', av && av.activeVfx ? av.activeVfx() : 0);
    aqPerfPeak('detachedWeapons', (AQ.state && AQ.state.detachedWeapons && AQ.state.detachedWeapons.length) || 0);
  }
  function aqPerfSectionSummary() {
    const out = {};
    for (const [k, s] of Object.entries(AQ_PERF.sections)) {
      out[k] = { n: s.n, avgMs: s.n ? +(s.sum / s.n).toFixed(3) : 0, maxMs: +s.max.toFixed(3) };
    }
    return out;
  }
  window.apexArsenalPerfSummary = function apexArsenalPerfSummary() {
    const global = (typeof window.apexPerfReport === 'function') ? window.apexPerfReport() : null;
    return {
      frames: global && global.frames,
      longTasks: global && global.longTasks && { count: global.longTasks.count, slowest: global.longTasks.slowest && global.longTasks.slowest[0] },
      sections: aqPerfSectionSummary(),
      peaks: Object.assign({}, AQ_PERF.peaks),
      chamber: Object.assign({}, AQ_PERF.chamber),
      hud: Object.assign({}, AQ_PERF.hud),
      rarity: SPAWN.rarityStats ? Object.assign({}, SPAWN.rarityStats) : null,
      feel: AQ.feel && AQ.feel.stats ? {
        stamps: AQ.feel.stats.stamps,
        stainDraws: AQ.feel.stats.stainDraws,
        sprayPeak: AQ.feel.stats.sprayPeak,
        sprayReuse: AQ.feel.stats.sprayReuse,
        popupReuse: AQ.feel.stats.popupReuse,
      } : null,
      interpolation: false,
    };
  };
  window.apexArsenalObserveRaf = function apexArsenalObserveRaf(frames) {
    const n = Math.max(30, frames || 90);
    const samples = [];
    return new Promise((resolve) => {
      let last = 0;
      let left = n;
      const tick = (t) => {
        if (last > 0) samples.push(t - last);
        last = t;
        left -= 1;
        if (left <= 0) {
          const sorted = samples.slice().sort((a, b) => a - b);
          const sum = samples.reduce((s, v) => s + v, 0);
          const pct = (r) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * r))] || 0;
          const buckets = { le16_7: 0, gt16_7_20: 0, gt20_25: 0, gt25_33: 0, gt33_50: 0, gt50: 0 };
          for (const v of samples) {
            if (v <= 16.7) buckets.le16_7 += 1;
            else if (v <= 20) buckets.gt16_7_20 += 1;
            else if (v <= 25) buckets.gt20_25 += 1;
            else if (v <= 33) buckets.gt25_33 += 1;
            else if (v <= 50) buckets.gt33_50 += 1;
            else buckets.gt50 += 1;
          }
          resolve({
            samples: samples.length,
            avgMs: samples.length ? sum / samples.length : 0,
            medianMs: pct(0.5),
            p95Ms: pct(0.95),
            p99Ms: pct(0.99),
            maxMs: sorted.length ? sorted[sorted.length - 1] : 0,
            buckets,
            interpolation: false,
          });
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  function resetState() {
    const state = {
      active: true,
      time: 0,
      spawnTimer: CFG.SPAWN_CADENCE_SECONDS,
      unarmedFastConsumed: false,
      unarmedFastPending: false,
      spawnHeld: false,
      healCooldown: 0,
      forceHealId: null,
      slots: [],
      visuals: [],
      detachedWeapons: [],
      nextSlotId: 1,
      spawnedTotal: 0,
      suppressedSpawns: 0,
      maxActiveSlots: 0,
      over: null,
      // C §6 telemetry: realized direct damage split weapon vs native kit.
      dmg: { weapon: 0, native: 0, byMechanic: {} },
      debugOverlay: AQ.state ? AQ.state.debugOverlay : false,
    };
    AQ.state = state;
    return state;
  }

  // ---------------------------------------------------------------------------
  // C §6 native lethality normalization — per-mechanic adaptation applied only
  // while the Arsenal mode is live. Identity (setup/control/mobility/defense/
  // sustain) is untouched; only realized direct damage is scaled, and every
  // point is telemetered for the acceptance suite.
  // ---------------------------------------------------------------------------
  function nativeMechanic(label, statusDamage) {
    const l = String(label || '');
    if (statusDamage) return 'dot';
    if (/explosion|blast|divine|planet|nuke|mine/.test(l)) return 'blast';
    if (/laser|beam|field/.test(l)) return 'beam';
    if (/butt|strike|slash|stab|punch|melee|kick|drive/.test(l)) return 'melee';
    if (/shot|bullet|rocket|ball|impact|proj/.test(l)) return 'projectile';
    if (/collide|contact|body/.test(l)) return 'contact';
    return 'default';
  }
  if (typeof Fighter !== 'undefined' && !Fighter.prototype.__aqNativeAdapt) {
    Fighter.prototype.__aqNativeAdapt = true;
    const baseTakeDamage = Fighter.prototype.takeDamage;
    Fighter.prototype.takeDamage = function aqAdaptedTakeDamage(amount, source, label, statusDamage) {
      const st = (typeof gameState !== 'undefined' && gameState === 'ARSENAL') ? (AQ.state || null) : null;
      if (!st || !(amount > 0)) return baseTakeDamage.call(this, amount, source, label, statusDamage);
      const isWeapon = String(label || '').startsWith('arsenal-');
      let scaled = amount;
      let mech = null;
      if (!isWeapon) {
        mech = nativeMechanic(label, statusDamage);
        const mult = CFG.NATIVE_ARSENAL_MULT[mech] != null ? CFG.NATIVE_ARSENAL_MULT[mech] : CFG.NATIVE_ARSENAL_MULT.default;
        scaled = amount * mult;
      }
      const before = this.hp;
      const out = baseTakeDamage.call(this, scaled, source, label, statusDamage);
      const dealt = Math.max(0, before - this.hp);
      st.dmg = st.dmg || { weapon: 0, native: 0, byMechanic: {} };
      if (isWeapon) st.dmg.weapon += dealt;
      else {
        st.dmg.native += dealt;
        st.dmg.byMechanic[mech] = (st.dmg.byMechanic[mech] || 0) + dealt;
      }
      if (AQ.feel && AQ.feel.noteDamage) {
        AQ.feel.noteDamage({
          dealt,
          miss: dealt <= 0 && amount > 0 && !statusDamage,
          victim: this,
          source,
          label,
          statusDamage: !!statusDamage,
          critical: !!this.__aqHitCrit,
        });
        this.__aqHitCrit = false;
      }
      return out;
    };
  }

  // -------------------------------------------------------------------------
  // Simulation tick — the ONLY gameplay step; rAF and headless tests share it.
  // -------------------------------------------------------------------------
  function stepSimulation(dt) {
    const state = AQ.state;
    if (!state || !state.active) return;
    matchClock += dt;
    state.time += dt;
    if (!state.over) {
      const living = (typeof fighters !== 'undefined' ? fighters : []).filter((f) => f && f.hp > 0);
      const holdsGun = (f) => {
        const h = weaponApi.getHolder(f);
        return !!(h && CFG.isGun && CFG.isGun(h.weaponId));
      };
      const revealedGuns = (state.slots || []).filter((s) => s.phase === 'REVEALED' && s.kind !== 'HEAL' && CFG.isGun && CFG.isGun(s.weaponId)).length;
      const emergencyGunNeeded = living.length >= 2 && living.every((f) => !holdsGun(f)) && revealedGuns === 0;
      let emergencySpawned = false;
      if (!emergencyGunNeeded) {
        state.unarmedFastConsumed = false;
        state.unarmedFastPending = false;
      } else if (!state.spawnHeld && !state.unarmedFastConsumed) {
        const cap = CFG.MAX_ACTIVE_SLOTS;
        const active = (state.slots || []).filter((s) => s.phase !== 'REMOVED' && s.kind !== 'HEAL').length;
        if (active >= cap) {
          state.unarmedFastPending = true;
        } else {
          const slot = SPAWN.trySpawnSlot({ forceFirearm: true });
          if (slot) {
            state.spawnTimer = CFG.SPAWN_CADENCE_SECONDS;
            state.unarmedFastConsumed = true;
            state.unarmedFastPending = false;
            emergencySpawned = true;
          } else {
            state.unarmedFastPending = true;
          }
        }
      }
      // Fixed spawn cadence — independent of collection state (handoff §5).
      state.spawnTimer -= dt;
      let guard = 0;
      while (state.spawnTimer <= 0 && guard++ < 4) {
        state.spawnTimer += CFG.SPAWN_CADENCE_SECONDS;
        if (emergencySpawned) continue;
        SPAWN.trySpawnSlot();
      }
      SPAWN.updateSlots(dt);
      // POST-C §6: P1 cooldown-only skills wait for J. Gate wraps P1 update
      // only; P2 keeps automatic kit behavior.
      const gate = window.APEX_ARSENAL_SKILL_GATE;
      if (fighters[0] && fighters[1]) {
        if (gate && gate.preUpdate) gate.preUpdate(fighters[0], dt);
        fighters[0].update(dt, fighters[1]);
        if (gate && gate.postUpdate) gate.postUpdate(fighters[0]);
        fighters[1].update(dt, fighters[0]);
        handleCollisions(dt);
      }
      SPAWN.resolvePickups();
      for (const f of fighters) if (f) weaponApi.updateHolder(f, dt);
      if (weaponApi.tickDetachedWeapons) weaponApi.tickDetachedWeapons(dt);
      updateProjectiles(dt);                     // engine lifecycle + cleanup
      weaponApi.updateArsenalProjectiles(dt);    // aq_* movement + hits
    }
    weaponApi.tickVisuals(dt);
    if (window.APEX_ARSENAL_AV) window.APEX_ARSENAL_AV.tick(dt);
    // Presentation decay over the shared engine collections.
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.update(dt); if (p.life <= 0) particles.splice(i, 1); }
    // Pass 1: battlefield typography is muted in Arsenal. Native kits may still
    // allocate FloatingText; sink them before update/draw so they incur no
    // lifecycle cost. Other modes keep the legacy path.
    if (floatingTexts.length) floatingTexts.length = 0;
    if (AQ.feel && AQ.feel.tick) AQ.feel.tick(dt);
    for (let i = shockwaves.length - 1; i >= 0; i--) { const s = shockwaves[i]; s.r += 420 * dt; s.alpha = Math.max(0, 1 - s.r / s.maxR); if (s.alpha <= 0) shockwaves.splice(i, 1); }
    if (arenaFlash.a > 0) arenaFlash.a = Math.max(0, arenaFlash.a - dt * 1.6);
    if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 22);
    cameraZoom = lerp(cameraZoom, 1, dt * 2);
    if (!state.over && fighters[0] && fighters[1] && (fighters[0].hp <= 0 || fighters[1].hp <= 0)) {
      const winner = fighters[0].hp > fighters[1].hp ? fighters[0] : fighters[1];
      state.over = winner.name;
      AQ.log('KO', `winner=${winner.name}`);
      if (window.APEX_ARSENAL_QUEST && window.APEX_ARSENAL_QUEST.onMatchOver) {
        window.APEX_ARSENAL_QUEST.onMatchOver(winner.name);
      }
      updateHUD();
    }
  }

  function updateArsenalQuest(dt) {
    const t0 = performance.now();
    if (hitStop > 0) { hitStop -= dt; dt *= 0.1; }
    stepSimulation(dt);
    aqPerfMark('simulation', performance.now() - t0);
    aqPerfSampleCounts();
  }

  // -------------------------------------------------------------------------
  // Engine integration — wrap update/draw/background/projectile passes,
  // following the same convention as solo/trial/tamChien mode runtimes.
  // -------------------------------------------------------------------------
  const baseUpdate = update;
  const baseDraw = draw;
  const baseDrawBackground = drawBackground;
  const baseDrawProjectiles = drawProjectiles;

  update = function (dt) {
    if (gameState === 'ARSENAL') { updateArsenalQuest(dt); return; }
    return baseUpdate(dt);
  };

  drawBackground = function (c) {
    if (gameState === 'ARSENAL') {
      const t0 = performance.now();
      drawChamber01(c); // Arsenal-only arena; global Apex background untouched
      const t1 = performance.now();
      if (AQ.feel && AQ.feel.drawStain) AQ.feel.drawStain(c);
      SPAWN.drawSlots(c);
      aqPerfMark('pickupDraw', performance.now() - t1);
      aqPerfMark('background', performance.now() - t0);
      return;
    }
    baseDrawBackground(c);
  };

  // ---------------------------------------------------------------------------
  // C §7 — ARSENAL FIELD TEST // CHAMBER 01. Dark graphite evaluation room:
  // restrained range grid, sparse ticks/zone marks, industrial wall panels,
  // neutral pickup floor. Low contrast, no bright lanes, no center obstacle.
  // ---------------------------------------------------------------------------
  let chamberCache = null;
  let chamberCacheSize = 0;
  function makeChamberSurface(S) {
    if (typeof OffscreenCanvas !== 'undefined') {
      try { return new OffscreenCanvas(S, S); } catch (e) { /* fall through */ }
    }
    const el = document.createElement('canvas');
    el.width = S;
    el.height = S;
    return el;
  }
  function paintChamber01(c, S) {
    c.save();
    // Base graphite with subtle material variation.
    c.fillStyle = '#626A74';
    c.fillRect(0, 0, S, S);
    const grad = c.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.72);
    grad.addColorStop(0, 'rgba(114,123,134,0.78)');
    grad.addColorStop(1, 'rgba(79,87,97,0.92)');
    c.fillStyle = grad;
    c.fillRect(0, 0, S, S);

    // Very restrained range grid.
    c.strokeStyle = 'rgba(12,14,18,0.22)';
    c.lineWidth = 1;
    for (let g = 125; g < S; g += 125) {
      c.beginPath(); c.moveTo(g, 40); c.lineTo(g, S - 40); c.stroke();
      c.beginPath(); c.moveTo(40, g); c.lineTo(S - 40, g); c.stroke();
    }
    // Sparse measurement ticks along the walls.
    c.strokeStyle = 'rgba(10,12,16,0.38)';
    c.lineWidth = 2;
    for (let g = 100; g < S; g += 100) {
      c.beginPath(); c.moveTo(g, 34); c.lineTo(g, 46); c.stroke();
      c.beginPath(); c.moveTo(g, S - 46); c.lineTo(g, S - 34); c.stroke();
      c.beginPath(); c.moveTo(34, g); c.lineTo(46, g); c.stroke();
      c.beginPath(); c.moveTo(S - 46, g); c.lineTo(S - 34, g); c.stroke();
    }
    // POST-C §8: zone marks are glyph-free ticks, never Z-01..Z-04 numerals.

    // Central alignment marks (no obstacle, no glow).
    c.strokeStyle = 'rgba(18,20,24,0.28)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(S / 2, S / 2, 62, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(S / 2 - 88, S / 2); c.lineTo(S / 2 - 40, S / 2);
    c.moveTo(S / 2 + 40, S / 2); c.lineTo(S / 2 + 88, S / 2);
    c.moveTo(S / 2, S / 2 - 88); c.lineTo(S / 2, S / 2 - 40);
    c.moveTo(S / 2, S / 2 + 40); c.lineTo(S / 2, S / 2 + 88);
    c.stroke();

    // Industrial wall band: panels + guard rail, brighter boundary read.
    c.fillStyle = '#3C434C';
    c.fillRect(0, 0, S, 30); c.fillRect(0, S - 30, S, 30);
    c.fillRect(0, 0, 30, S); c.fillRect(S - 30, 0, 30, S);
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 2;
    for (let g = 0; g <= S; g += 125) {
      c.beginPath(); c.moveTo(g, 0); c.lineTo(g, 30); c.stroke();
      c.beginPath(); c.moveTo(g, S - 30); c.lineTo(g, S); c.stroke();
      c.beginPath(); c.moveTo(0, g); c.lineTo(30, g); c.stroke();
      c.beginPath(); c.moveTo(S - 30, g); c.lineTo(S, g); c.stroke();
    }
    c.strokeStyle = '#2C3239';
    c.lineWidth = 6;
    c.strokeRect(30, 30, S - 60, S - 60);
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = 2;
    c.strokeRect(36, 36, S - 72, S - 72);
    // Corner vent slats, slow static machinery hint.
    c.strokeStyle = 'rgba(255,255,255,0.045)';
    c.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.moveTo(52 + i * 10, 52); c.lineTo(52 + i * 10, 84); c.stroke();
      c.beginPath(); c.moveTo(S - 84 + i * 10, S - 84); c.lineTo(S - 84 + i * 10, S - 52); c.stroke();
    }
    // POST-C §8: chamber identity is the graphite room itself — no title plate.
    c.restore();
  }
  function drawChamber01(c) {
    const S = GAME_SIZE;
    const t0 = performance.now();
    let usedCache = true;
    if (!chamberCache || chamberCacheSize !== S) {
      const surface = makeChamberSurface(S);
      const sc = surface.getContext('2d');
      paintChamber01(sc, S);
      chamberCache = surface;
      chamberCacheSize = S;
      AQ_PERF.chamber.builds += 1;
      AQ_PERF.chamber.size = S;
      usedCache = false;
    }
    c.drawImage(chamberCache, 0, 0);
    AQ_PERF.chamber.draws += 1;
    if (usedCache) AQ_PERF.chamber.hits += 1;
    AQ_PERF.chamber.usedCacheLast = usedCache;
    aqPerfMark('chamber', performance.now() - t0);
  }

  drawProjectiles = function (c) {
    if (gameState === 'ARSENAL') weaponApi.drawArsenalProjectiles(c);
    baseDrawProjectiles(c);
  };

  function drawEquippedWeapons(c) {
    const av = window.APEX_ARSENAL_AV;
    if (!av || !av.drawEquippedWeapon) return;
    for (const f of fighters) {
      if (!f) continue;
      const h = weaponApi.getHolder(f);
      if (h) av.drawEquippedWeapon(c, f, h);
      // Checkpoint B pose ghost: recoil settle / throw / thrust return keeps
      // animating for a beat after the weapon is consumed.
      if (f.data && f.data.arsenalFade && !f.data.arsenalFade.detached && av.drawPoseGhost) av.drawPoseGhost(c, f, f.data.arsenalFade);
    }
    const detached = AQ.state && AQ.state.detachedWeapons;
    if (detached && av.drawDetachedWeapon) {
      for (const d of detached) av.drawDetachedWeapon(c, d);
    }
  }

  function drawHolderTags(c) {
    if (!(AQ.state && AQ.state.debugOverlay)) return;
    for (const f of fighters) {
      const h = weaponApi.getHolder(f);
      if (!f || !h) continue;
      c.save();
      c.fillStyle = h.def.category === 'ranged' ? '#ffd479' : h.def.category === 'melee' ? '#ff9d7a' : '#9fd8ff';
      c.fillRect(f.x - 22, f.y - f.radius - 48, 44, 8);
      c.restore();
    }
  }

  const hudRefs = { root: null, hint: null, skill: null, win: null, dbg: null };
  const hudLast = {
    hintDisplay: null, skillText: null, skillVis: null, skillAt: 0,
    winKey: null, debugText: null, debugOn: false, debugAt: 0,
  };
  function skillHudText(state) {
    const f = typeof fighters !== 'undefined' && fighters[0];
    const gate = window.APEX_ARSENAL_SKILL_GATE;
    const snap = gate && f ? gate.snapshot(f) : null;
    let revealed = 0;
    const slots = state.slots || [];
    for (let i = 0; i < slots.length; i++) if (slots[i] && slots[i].phase === 'REVEALED') revealed += 1;
    const lines = [];
    if (snap && snap.shell === 'NEWBIE') {
      const cd = f && f.data ? f.data.nbCd : 0;
      let text = 'J · —';
      if (cd > 0.05) text = 'J · ' + cd.toFixed(1) + 's';
      else if (revealed) text = 'J · READY';
      lines.push(text);
    } else if (snap && snap.keys && snap.keys.length) {
      for (const k of snap.keys) {
        const v = k.value;
        if (typeof v !== 'number') continue;
        const label = k.key.replace(/Cd$/, '').slice(0, 8);
        if (v > 0.09) lines.push(label + ' · ' + v.toFixed(1) + 's');
        else lines.push(label + ' · READY');
      }
    }
    return lines.join('  |  ');
  }
  function syncSkillHud(el, state, now, force) {
    if (!state || !state.active) {
      if (hudRefs.skill && hudLast.skillVis !== 'hidden-off') {
        hudRefs.skill.style.display = 'none';
        hudLast.skillVis = 'hidden-off';
      }
      return;
    }
    if (!force && now - hudLast.skillAt < 100) return;
    hudLast.skillAt = now;
    if (!hudRefs.skill) {
      const box = document.createElement('div');
      box.id = 'aq-skill-hud';
      box.style.cssText = 'position:absolute;left:12px;top:8px;pointer-events:none;color:#efe6c8;font:800 13px monospace;background:rgba(8,8,12,0.55);padding:6px 10px;border:1px solid rgba(180,170,140,0.35);';
      el.appendChild(box);
      hudRefs.skill = box;
    }
    if (hudLast.skillVis !== 'block') {
      hudRefs.skill.style.display = 'block';
      hudLast.skillVis = 'block';
    }
    const text = skillHudText(state);
    if (text !== hudLast.skillText) {
      hudRefs.skill.textContent = text;
      hudLast.skillText = text;
      AQ_PERF.hud.skillWrites += 1;
    }
    const vis = text ? 'visible' : 'hidden';
    if (hudRefs.skill.style.visibility !== vis) hudRefs.skill.style.visibility = vis;
  }

  function hudRoot() {
    if (hudRefs.root && hudRefs.root.isConnected) return hudRefs.root;
    let el = document.getElementById('aq-dom-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aq-dom-hud';
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:40;font-family:monospace;';
      (document.getElementById('game-wrap') || document.body).appendChild(el);
    }
    hudRefs.root = el;
    return el;
  }
  function syncDomHud(force) {
    const t0 = performance.now();
    const state = AQ.state;
    const el = hudRoot();
    const now = t0;
    if (!hudRefs.hint) {
      let hint = document.getElementById('aq-hint');
      if (!hint) {
        hint = document.createElement('div');
        hint.id = 'aq-hint';
        hint.style.cssText = 'position:absolute;left:0;right:0;bottom:12px;text-align:center;color:rgba(232,224,200,0.9);font-weight:800;font-size:14px;';
        hint.textContent = 'ARSENAL QUEST — F3 debug · T rematch · B/ESC menu';
        el.appendChild(hint);
      }
      hudRefs.hint = hint;
    }
    const hintDisplay = (state && state.active) ? 'block' : 'none';
    if (hudLast.hintDisplay !== hintDisplay) {
      hudRefs.hint.style.display = hintDisplay;
      hudLast.hintDisplay = hintDisplay;
    }
    syncSkillHud(el, state, now, !!force || !!(state && state.over && hudLast.winKey == null));
    let win = hudRefs.win || document.getElementById('aq-win');
    if (state && state.over) {
      const Q = window.APEX_ARSENAL_QUEST;
      const spec = Q && Q.resultActions ? Q.resultActions(state) : { mode: 'freeplay', actions: ['REMATCH', 'MENU'] };
      const winKey = state.over + '|' + spec.mode + '|' + (spec.actions || []).join(',');
      if (hudLast.winKey !== winKey) {
        if (!win) {
          win = document.createElement('div');
          win.id = 'aq-win';
          win.style.cssText = 'position:absolute;left:0;right:0;top:32%;text-align:center;color:#efe6c8;pointer-events:auto;z-index:50;';
          el.appendChild(win);
        }
        hudRefs.win = win;
        const title = '<div style="font:900 56px Segoe UI">' + state.over + ' WINS</div>';
        const btn = (id, label) => '<button data-aq-act="' + id + '" style="margin:8px;padding:10px 16px;font:800 16px monospace;pointer-events:auto;cursor:pointer;">' + label + '</button>';
        if (spec.mode === 'quest-win' || spec.mode === 'quest-loss') {
          win.innerHTML = title + '<div id="aq-quest-actions" style="margin-top:12px">' + spec.actions.map((a) => btn(a, a)).join('') + '</div>';
          win.onclick = (e) => {
            const act = e.target && e.target.getAttribute && e.target.getAttribute('data-aq-act');
            if (!act) return;
            if (act === 'NEXT' && Q.nextStage) Q.nextStage();
            else if ((act === 'REPLAY' || act === 'RETRY') && Q.replay) Q.replay();
            else if (act === 'QUEST MAP' && Q.returnToMap) Q.returnToMap();
          };
        } else {
          const M = window.APEX_ARSENAL_META;
          const aw = M && M.lastAward ? M.lastAward() : null;
          const reward = aw && aw.amount ? '<div style="font:700 16px monospace;margin-top:8px">+' + aw.amount + ' AC · balance ' + aw.balance + '</div>' : '';
          win.innerHTML = title + reward
            + '<div style="margin-top:12px">'
            + '<button data-aq-act="REMATCH" style="margin:8px;padding:10px 16px;font:800 16px monospace;pointer-events:auto;cursor:pointer;">REMATCH</button>'
            + '<button data-aq-act="PICK AGAIN" style="margin:8px;padding:10px 16px;font:800 16px monospace;pointer-events:auto;cursor:pointer;">PICK AGAIN</button>'
            + '<button data-aq-act="HUB" style="margin:8px;padding:10px 16px;font:800 16px monospace;pointer-events:auto;cursor:pointer;">HUB</button>'
            + '</div>';
          win.onclick = (e) => {
            const act = e.target && e.target.getAttribute && e.target.getAttribute('data-aq-act');
            if (act === 'REMATCH') window.startArsenalQuestMode();
            else if (act === 'PICK AGAIN' && window.APEX_ARSENAL_META) window.APEX_ARSENAL_META.openFreePick();
            else if (act === 'HUB' && window.APEX_ARSENAL_META) window.APEX_ARSENAL_META.openHub();
          };
        }
        hudLast.winKey = winKey;
        AQ_PERF.hud.winWrites += 1;
      }
    } else if (win) {
      win.remove();
      hudRefs.win = null;
      hudLast.winKey = null;
    }
    const wantDebug = !!(state && state.debugOverlay);
    if (wantDebug !== hudLast.debugOn) {
      hudLast.debugOn = wantDebug;
      hudLast.debugAt = 0;
    }
    if (wantDebug) {
      if (!force && now - hudLast.debugAt < 100 && hudRefs.dbg) {
        aqPerfMark('hud', performance.now() - t0);
        return;
      }
      hudLast.debugAt = now;
      const s = window.getArsenalQuestDebugState();
      if (!hudRefs.dbg) {
        const dbg = document.createElement('div');
        dbg.id = 'aq-debug';
        dbg.style.cssText = 'position:absolute;left:16px;top:96px;padding:12px;background:rgba(6,6,10,0.78);color:#d8d2c0;font:700 14px monospace;white-space:pre;border:2px solid #6d8f4e;';
        el.appendChild(dbg);
        hudRefs.dbg = dbg;
      }
      const text = [
        'ARSENAL QUEST DEBUG',
        'spawn in: ' + s.spawnIn.toFixed(1) + 's',
        'active slots: ' + s.activeSlots,
        'telegraphs: ' + s.telegraphs,
        'revealed: ' + s.revealed,
        (s.hero ? s.hero.name : 'P1') + '  HP ' + (s.hero ? s.hero.hp : 0) + '/' + CFG.MATCH_HP + '   weapon: ' + (s.hero ? s.hero.weapon : 'NONE'),
        (s.rival ? s.rival.name : 'P2') + ' HP ' + (s.rival ? s.rival.hp : 0) + '/' + CFG.MATCH_HP + '   weapon: ' + (s.rival ? s.rival.weapon : 'NONE'),
      ].join('\n');
      if (text !== hudLast.debugText) {
        hudRefs.dbg.textContent = text;
        hudLast.debugText = text;
        AQ_PERF.hud.debugWrites += 1;
      }
    } else if (hudRefs.dbg) {
      hudRefs.dbg.remove();
      hudRefs.dbg = null;
      hudLast.debugText = null;
    }
    aqPerfMark('hud', performance.now() - t0);
  }

  function drawForeground() {
    const t0 = performance.now();
    const view = window.__apexCameraView || { shakeX: 0, shakeY: 0, zoom: 1 };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(GAME_SIZE / 2 + view.shakeX, GAME_SIZE / 2 + view.shakeY);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-GAME_SIZE / 2, -GAME_SIZE / 2);
    const tEq = performance.now();
    drawEquippedWeapons(ctx);
    weaponApi.drawArsenalVisuals(ctx);
    aqPerfMark('foreground', performance.now() - tEq);
    const tVfx = performance.now();
    if (window.APEX_ARSENAL_AV) window.APEX_ARSENAL_AV.draw(ctx);
    aqPerfMark('arsenalVfxDraw', performance.now() - tVfx);
    drawHolderTags(ctx);
    if (AQ.feel && AQ.feel.drawForeground) AQ.feel.drawForeground(ctx);
    ctx.restore();
    syncDomHud();
    aqPerfMark('foregroundTotal', performance.now() - t0);
  }

  // POST-C §8: mute typographic fill/stroke on the battlefield canvas while
  // the engine draws fighters/projectiles/particles. HUD/debug overlays
  // restore the original methods before they paint.
  function muteArenaGlyphs(c) {
    const fill = c.fillText;
    const stroke = c.strokeText;
    c.fillText = function mutedFillText() {};
    c.strokeText = function mutedStrokeText() {};
    return function restoreArenaGlyphs() { c.fillText = fill; c.strokeText = stroke; };
  }

  draw = function () {
    if (gameState !== 'ARSENAL') { baseDraw(); return; }
    const t0 = performance.now();
    baseDraw();
    drawForeground();
    aqPerfMark('arsenalFrame', performance.now() - t0);
  };

  // -------------------------------------------------------------------------
  // Entry / exit (handoff §12)
  // -------------------------------------------------------------------------
  let keyListener = null;

  function onKeyDown(e) {
    if (e.code === 'F3') {
      e.preventDefault();
      if (gameState === 'ARSENAL' && AQ.state) AQ.state.debugOverlay = !AQ.state.debugOverlay;
      return;
    }
    if (gameState !== 'ARSENAL') return;
    if (e.code === 'KeyJ' && !e.repeat) {
      const gate = window.APEX_ARSENAL_SKILL_GATE;
      if (gate && fighters[0]) gate.pressJ(fighters[0]);
      return;
    }
    if (e.code === 'KeyT' && AQ.state && AQ.state.over) {
      const Q = window.APEX_ARSENAL_QUEST;
      if (AQ.state.questStage && Q && Q.replay) Q.replay();
      else window.startArsenalQuestMode();
      return;
    }
    if (e.code === 'KeyB' || e.code === 'Escape') {
      const Q = window.APEX_ARSENAL_QUEST;
      if (AQ.state && AQ.state.questStage && Q && Q.returnToMap) Q.returnToMap();
      else window.exitArsenalQuestMode();
    }
  }

  let lastShells = null;

  window.startArsenalQuestMode = function startArsenalQuestMode(p1Name, p2Name) {
    resetState();
    if (AQ.feel && AQ.feel.resetMatch) AQ.feel.resetMatch();
    ['menu-screen', 'select-screen', 'tournament-screen', 'end-screen', 'solo-screen', 'trial-screen', 'tam-chien-screen', 'manual-room-screen']
      .forEach(id => document.getElementById(id)?.classList.add('hidden'));
    const hud = document.getElementById('hud');
    if (hud) hud.style.opacity = 1;

    // V2 §A3: P1/P2 canonical test shells from the shared select screen;
    // blank HERO/RIVAL remains the direct-entry fallback (harnesses, rematch).
    const shells = window.APEX_ARSENAL_SHELLS || null;
    const want1 = p1Name || (lastShells && lastShells[0]) || null;
    const want2 = p2Name || (lastShells && lastShells[1]) || null;
    const t1 = (shells && want1 && shells.typeFor(want1)) || HERO_TYPE;
    const t2 = (shells && want2 && shells.typeFor(want2)) || RIVAL_TYPE;
    lastShells = [t1.name, t2.name];
    fighters = [
      new Fighter(1, 220, GAME_SIZE / 2, t1),
      new Fighter(2, GAME_SIZE - 220, GAME_SIZE / 2, t2),
    ];
    for (const f of fighters) {
      f.maxHp = CFG.MATCH_HP;
      f.hp = CFG.MATCH_HP;
      const a = Math.random() * TAU;
      f.setDir(Math.cos(a), Math.sin(a));
    }

    // Clear prior normal-match projectiles/effects.
    projectiles = [];
    particles = [];
    floatingTexts = [];
    shockwaves = [];
    timeScale = 1.0;
    cameraZoom = 1.0;
    cameraShake = 0;
    hitStop = 0;
    matchClock = 0;
    arenaFlash = { r: 0, g: 0, b: 0, a: 0 };
    sawWallRage = { timer: 0, owner: null, phase: 0 };

    const p1n = document.getElementById('p1-name');
    const p2n = document.getElementById('p2-name');
    if (p1n) { p1n.innerText = fighters[0].name; p1n.style.color = fighters[0].color; }
    if (p2n) { p2n.innerText = fighters[1].name; p2n.style.color = fighters[1].color; }
    const p1hp = document.getElementById('p1-hp');
    const p2hp = document.getElementById('p2-hp');
    if (p1hp) p1hp.style.backgroundColor = fighters[0].color;
    if (p2hp) p2hp.style.backgroundColor = fighters[1].color;
    updateHUD();

    window.apexStopBattleAudio?.();
    if (window.APEX_ARSENAL_AV) { window.APEX_ARSENAL_AV.clear(); window.APEX_ARSENAL_AV.preload(); }
    gameState = 'ARSENAL';
    lastTime = performance.now();
    if (!reqId) reqId = requestAnimationFrame(loop);
    if (!keyListener) {
      keyListener = onKeyDown;
      window.addEventListener('keydown', keyListener);
    }
    AQ.log('MODE_ENTER', 'mode=ARSENAL_QUEST');
    try { draw(); } catch (error) { console.warn('[AQ] initial draw failed', error); }
  };

  window.exitArsenalQuestMode = function exitArsenalQuestMode() {
    const state = AQ.state;
    if (state) {
      for (const f of fighters || []) if (f && f.data) f.data.arsenal = null;
      state.active = false;
      state.slots = [];
      state.visuals = [];
      state.over = null;
    }
    for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i] && projectiles[i].aq) projectiles.splice(i, 1);
    particles.length = 0;
    floatingTexts.length = 0;
    shockwaves.length = 0;
    if (window.APEX_ARSENAL_AV) window.APEX_ARSENAL_AV.clear();
    if (keyListener) {
      window.removeEventListener('keydown', keyListener);
      keyListener = null; // no leaked listeners
    }
    AQ.log('MODE_EXIT', 'mode=ARSENAL_QUEST');
    goToMenu(); // restores MENU state + screens, stops battle audio
    window.apexPlayMenuMusic?.(true);
  };

  // -------------------------------------------------------------------------
  // Inspection API (handoff §11)
  // -------------------------------------------------------------------------
  function fighterSnapshot(f) {
    if (!f) return null;
    const h = weaponApi.getHolder(f);
    return {
      name: f.name,
      hp: Math.round(f.hp * 10) / 10,
      maxHp: f.maxHp,
      x: Math.round(f.x),
      y: Math.round(f.y),
      weapon: h ? h.weaponId : 'NONE',
      weaponPhase: h ? h.phase : null,
      shotsFired: h ? h.shotsFired : 0,
    };
  }

  window.getArsenalQuestDebugState = function getArsenalQuestDebugState() {
    const state = AQ.state;
    if (!state) return { active: false, gameState };
    const telegraphs = state.slots.filter(s => s.phase === 'TELEGRAPH').length;
    const revealed = state.slots.filter(s => s.phase === 'REVEALED').length;
    return {
      active: state.active,
      gameState,
      over: state.over,
      time: Math.round(state.time * 100) / 100,
      spawnIn: Math.max(0, Math.round(state.spawnTimer * 100) / 100),
      activeSlots: state.slots.length,
      telegraphs,
      revealed,
      spawnedTotal: state.spawnedTotal,
      suppressedSpawns: state.suppressedSpawns,
      maxActiveSlots: state.maxActiveSlots,
      dmg: state.dmg || null,
      weaponDamageShare: state.dmg && (state.dmg.weapon + state.dmg.native) > 0
        ? Math.round(100 * state.dmg.weapon / (state.dmg.weapon + state.dmg.native)) / 100
        : null,
      aqProjectiles: projectiles.filter(p => p && p.aq).length,
      hero: fighterSnapshot(fighters[0]),
      rival: fighterSnapshot(fighters[1]),
      slots: state.slots.map(slot => ({
        id: slot.id,
        phase: slot.phase,
        age: Math.max(0, Math.round((state.time - (slot.spawnTime || 0)) * 100) / 100),
        weaponId: slot.weaponId || null,
        revealLeadSeconds: slot.revealLeadSeconds == null ? null : Math.round(slot.revealLeadSeconds * 100) / 100,
        predictedHeroETA: slot.predictedHeroETA == null ? null : Math.round(slot.predictedHeroETA * 100) / 100,
        predictedRivalETA: slot.predictedRivalETA == null ? null : Math.round(slot.predictedRivalETA * 100) / 100,
        earliestETA: slot.earliestETA == null ? null : Math.round(slot.earliestETA * 100) / 100,
        predictedFighter: slot.predictedFighter || null,
      })),
      events: AQ.events.slice(-40),
    };
  };

  // Headless stepping hook — identical code path to the rAF update.
  AQ.step = updateArsenalQuest;
  AQ.resetState = resetState;

  window.apexArsenalQuestRuntime = 'ready';
})();
