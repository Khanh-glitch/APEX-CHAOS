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

  function resetState() {
    const state = {
      active: true,
      time: 0,
      spawnTimer: CFG.FIRST_SPAWN_DELAY_SECONDS,
      slots: [],
      visuals: [],
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
      // Fixed spawn cadence — independent of collection state (handoff §5).
      state.spawnTimer -= dt;
      let guard = 0;
      while (state.spawnTimer <= 0 && guard++ < 4) {
        state.spawnTimer += CFG.SPAWN_CADENCE_SECONDS;
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
      updateProjectiles(dt);                     // engine lifecycle + cleanup
      weaponApi.updateArsenalProjectiles(dt);    // aq_* movement + hits
    }
    weaponApi.tickVisuals(dt);
    if (window.APEX_ARSENAL_AV) window.APEX_ARSENAL_AV.tick(dt);
    // Presentation decay over the shared engine collections.
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.update(dt); if (p.life <= 0) particles.splice(i, 1); }
    for (let i = floatingTexts.length - 1; i >= 0; i--) { const t = floatingTexts[i]; t.update(dt); if (t.life <= 0) floatingTexts.splice(i, 1); }
    for (let i = shockwaves.length - 1; i >= 0; i--) { const s = shockwaves[i]; s.r += 420 * dt; s.alpha = Math.max(0, 1 - s.r / s.maxR); if (s.alpha <= 0) shockwaves.splice(i, 1); }
    if (arenaFlash.a > 0) arenaFlash.a = Math.max(0, arenaFlash.a - dt * 1.6);
    if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 22);
    cameraZoom = lerp(cameraZoom, 1, dt * 2);
    if (!state.over && fighters[0] && fighters[1] && (fighters[0].hp <= 0 || fighters[1].hp <= 0)) {
      const winner = fighters[0].hp > fighters[1].hp ? fighters[0] : fighters[1];
      state.over = winner.name;
      AQ.log('KO', `winner=${winner.name}`);
      updateHUD();
    }
  }

  function updateArsenalQuest(dt) {
    if (hitStop > 0) { hitStop -= dt; dt *= 0.1; }
    stepSimulation(dt);
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
      drawChamber01(c); // Arsenal-only arena; global Apex background untouched
      SPAWN.drawSlots(c);
      return;
    }
    baseDrawBackground(c);
  };

  // ---------------------------------------------------------------------------
  // C §7 — ARSENAL FIELD TEST // CHAMBER 01. Dark graphite evaluation room:
  // restrained range grid, sparse ticks/zone marks, industrial wall panels,
  // neutral pickup floor. Low contrast, no bright lanes, no center obstacle.
  // ---------------------------------------------------------------------------
  function drawChamber01(c) {
    const S = GAME_SIZE;
    c.save();
    // Base graphite with subtle material variation.
    c.fillStyle = '#17181c';
    c.fillRect(0, 0, S, S);
    const grad = c.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.72);
    grad.addColorStop(0, 'rgba(38,41,47,0.55)');
    grad.addColorStop(1, 'rgba(10,11,14,0.85)');
    c.fillStyle = grad;
    c.fillRect(0, 0, S, S);

    // Very restrained range grid.
    c.strokeStyle = 'rgba(255,255,255,0.028)';
    c.lineWidth = 1;
    for (let g = 125; g < S; g += 125) {
      c.beginPath(); c.moveTo(g, 40); c.lineTo(g, S - 40); c.stroke();
      c.beginPath(); c.moveTo(40, g); c.lineTo(S - 40, g); c.stroke();
    }
    // Sparse measurement ticks along the walls.
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    c.lineWidth = 2;
    for (let g = 100; g < S; g += 100) {
      c.beginPath(); c.moveTo(g, 34); c.lineTo(g, 46); c.stroke();
      c.beginPath(); c.moveTo(g, S - 46); c.lineTo(g, S - 34); c.stroke();
      c.beginPath(); c.moveTo(34, g); c.lineTo(46, g); c.stroke();
      c.beginPath(); c.moveTo(S - 46, g); c.lineTo(S - 34, g); c.stroke();
    }
    // POST-C §8: zone marks are glyph-free ticks, never Z-01..Z-04 numerals.

    // Central alignment marks (no obstacle, no glow).
    c.strokeStyle = 'rgba(255,255,255,0.07)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(S / 2, S / 2, 62, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(S / 2 - 88, S / 2); c.lineTo(S / 2 - 40, S / 2);
    c.moveTo(S / 2 + 40, S / 2); c.lineTo(S / 2 + 88, S / 2);
    c.moveTo(S / 2, S / 2 - 88); c.lineTo(S / 2, S / 2 - 40);
    c.moveTo(S / 2, S / 2 + 40); c.lineTo(S / 2, S / 2 + 88);
    c.stroke();

    // Industrial wall band: panels + guard rail, brighter boundary read.
    c.fillStyle = '#202227';
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
    c.strokeStyle = '#2c2f36';
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
      if (f.data && f.data.arsenalFade && av.drawPoseGhost) av.drawPoseGhost(c, f, f.data.arsenalFade);
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

  function hudRoot() {
    let el = document.getElementById('aq-dom-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aq-dom-hud';
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:40;font-family:monospace;';
      (document.getElementById('game-wrap') || document.body).appendChild(el);
    }
    return el;
  }
  function syncDomHud() {
    const state = AQ.state;
    const el = hudRoot();
    const hint = document.getElementById('aq-hint') || (() => {
      const n = document.createElement('div');
      n.id = 'aq-hint';
      n.style.cssText = 'position:absolute;left:0;right:0;bottom:12px;text-align:center;color:rgba(232,224,200,0.9);font-weight:800;font-size:14px;';
      n.textContent = 'ARSENAL QUEST — F3 debug · T rematch · B/ESC menu';
      el.appendChild(n);
      return n;
    })();
    hint.style.display = (state && state.active) ? 'block' : 'none';
    let win = document.getElementById('aq-win');
    if (state && state.over) {
      if (!win) {
        win = document.createElement('div');
        win.id = 'aq-win';
        win.style.cssText = 'position:absolute;left:0;right:0;top:38%;text-align:center;color:#efe6c8;';
        el.appendChild(win);
      }
      win.innerHTML = `<div style="font:900 64px Segoe UI">${state.over} WINS</div><div style="font:800 22px monospace;margin-top:8px">T — REMATCH      B — MENU</div>`;
    } else if (win) win.remove();
    let dbg = document.getElementById('aq-debug');
    if (state && state.debugOverlay) {
      const s = window.getArsenalQuestDebugState();
      if (!dbg) {
        dbg = document.createElement('div');
        dbg.id = 'aq-debug';
        dbg.style.cssText = 'position:absolute;left:16px;top:96px;padding:12px;background:rgba(6,6,10,0.78);color:#d8d2c0;font:700 14px monospace;white-space:pre;border:2px solid #6d8f4e;';
        el.appendChild(dbg);
      }
      dbg.textContent = [
        'ARSENAL QUEST DEBUG',
        `spawn in: ${s.spawnIn.toFixed(1)}s`,
        `active slots: ${s.activeSlots}`,
        `telegraphs: ${s.telegraphs}`,
        `revealed: ${s.revealed}`,
        `${s.hero ? s.hero.name : 'P1'}  HP ${s.hero ? s.hero.hp : 0}/${CFG.MATCH_HP}   weapon: ${s.hero ? s.hero.weapon : 'NONE'}`,
        `${s.rival ? s.rival.name : 'P2'} HP ${s.rival ? s.rival.hp : 0}/${CFG.MATCH_HP}   weapon: ${s.rival ? s.rival.weapon : 'NONE'}`,
      ].join('\n');
    } else if (dbg) dbg.remove();
  }

  function drawForeground() {
    const view = window.__apexCameraView || { shakeX: 0, shakeY: 0, zoom: 1 };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(GAME_SIZE / 2 + view.shakeX, GAME_SIZE / 2 + view.shakeY);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-GAME_SIZE / 2, -GAME_SIZE / 2);
    drawEquippedWeapons(ctx);
    weaponApi.drawArsenalVisuals(ctx);
    if (window.APEX_ARSENAL_AV) window.APEX_ARSENAL_AV.draw(ctx);
    drawHolderTags(ctx);
    ctx.restore();
    syncDomHud();
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
    const restore = muteArenaGlyphs(ctx);
    try { baseDraw(); } finally { restore(); }
    drawForeground();
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
    if (e.code === 'KeyT' && AQ.state && AQ.state.over) { window.startArsenalQuestMode(); return; }
    if (e.code === 'KeyB' || e.code === 'Escape') { window.exitArsenalQuestMode(); }
  }

  let lastShells = null;

  window.startArsenalQuestMode = function startArsenalQuestMode(p1Name, p2Name) {
    resetState();
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
