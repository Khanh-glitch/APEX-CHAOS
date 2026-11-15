/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — CHRONO (TIME-00) Gold Presentation Runtime
 *
 * Articulated obsidian-and-brass celestial chronometer rig + tourbillon core +
 * 1s/2s/3s temporal ghost anchors + Time Loop hologram clones + Rewind snapback.
 * Driven 100% by canonical heroReworkRuntime / heroMechanicsRuntime state.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_TIME_PRESENTATION) return;

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  const states = new WeakMap();
  const api = (g.APEX_TIME_PRESENTATION = { ready: true });

  g.apexProductAssets?.registerPresentation?.('time', () => Promise.resolve(true));

  function isTimeHero(f) {
    const HR = g.APEX_HERO_REWORK;
    return HR?.byCombatant?.(f)?.heroId === 'TIME' || f?.type?.name === 'TIME' || f?.name === 'TIME';
  }

  function getState(f) {
    let s = states.get(f);
    if (s) return s;
    s = {
      t: 0,
      gearPhase: 0,
      gearRate: 1,
      loopGlow: 0,
      rewindFlash: 0,
      rewindOrigin: null,
      bankX: 0,
      bankY: 0,
      lastX: f.x,
      lastY: f.y,
      history: [],
      echoClones: [],
    };
    states.set(f, s);
    return s;
  }

  function sampleHistoryAt(history, targetAgeSec, now) {
    if (!history.length) return null;
    const want = now - targetAgeSec;
    let best = history[0];
    let bestErr = Math.abs(best.t - want);
    for (let i = 1; i < history.length; i++) {
      const err = Math.abs(history[i].t - want);
      if (err < bestErr) {
        best = history[i];
        bestErr = err;
      }
    }
    return bestErr < 0.45 ? best : null;
  }

  function updateChronoRig(f, s, dt) {
    s.t += dt;
    const vx = (f.x - s.lastX) / Math.max(dt, 0.008);
    const vy = (f.y - s.lastY) / Math.max(dt, 0.008);
    // Detect sudden Rewind relocation (> 140px instantaneous jump)
    const jumpDist = Math.hypot(f.x - s.lastX, f.y - s.lastY);
    if (jumpDist > 145) {
      s.rewindOrigin = { x: s.lastX, y: s.lastY, tx: f.x, ty: f.y, life: 0.65 };
      s.rewindFlash = 1.0;
      s.gearRate = -5.5;
      g.APEX_EVOLUTION_SHADER?.spawnShockwave?.(f.x, f.y, 0.52, 340, 760, 1.2);
      g.APEX_EVOLUTION_AUDIO?.playHeroCue?.('TIME', 'REWIND_SNAP');
    }
    s.lastX = f.x;
    s.lastY = f.y;

    s.bankX = lerp(s.bankX, clamp(vx / 620, -1, 1), clamp(dt * 11, 0, 1));
    s.bankY = lerp(s.bankY, clamp(vy / 620, -1, 1), clamp(dt * 11, 0, 1));
    s.gearRate = lerp(s.gearRate, 1 + s.loopGlow * 2.6, clamp(dt * 4.5, 0, 1));
    s.gearPhase += dt * s.gearRate;
    s.loopGlow = Math.max(0, s.loopGlow - dt * 0.45);
    s.rewindFlash = Math.max(0, s.rewindFlash - dt * 2.2);

    if (s.rewindOrigin) {
      s.rewindOrigin.life -= dt;
      if (s.rewindOrigin.life <= 0) s.rewindOrigin = null;
    }

    // Record 3.4s position history for canonical 1s, 2s, and 3s Rewind timeline markers
    s.history.push({ t: s.t, x: f.x, y: f.y, bx: s.bankX, by: s.bankY });
    const cutoff = s.t - 3.5;
    while (s.history.length > 2 && s.history[0].t < cutoff) s.history.shift();

    for (let i = s.echoClones.length - 1; i >= 0; i--) {
      s.echoClones[i].life -= dt;
      if (s.echoClones[i].life <= 0) s.echoClones.splice(i, 1);
    }

    g.APEX_EVOLUTION_SHADER?.pushLight?.(
      f.x,
      f.y,
      0.24,
      0.86,
      1.0,
      150 * ((f.radius || 75) / 75),
      0.42 + s.loopGlow * 0.4 + s.rewindFlash * 0.5
    );
  }

  function drawGearRing(c, radius, teeth, toothDepth, rot, strokeCol, fillCol, lineW) {
    c.save();
    c.rotate(rot);
    c.beginPath();
    const step = TAU / teeth;
    for (let i = 0; i < teeth; i++) {
      const a0 = i * step;
      const a1 = a0 + step * 0.38;
      const a2 = a0 + step * 0.52;
      const a3 = a0 + step * 0.88;
      c.lineTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
      c.lineTo(Math.cos(a1) * (radius + toothDepth), Math.sin(a1) * (radius + toothDepth));
      c.lineTo(Math.cos(a2) * (radius + toothDepth), Math.sin(a2) * (radius + toothDepth));
      c.lineTo(Math.cos(a3) * radius, Math.sin(a3) * radius);
    }
    c.closePath();
    if (fillCol) {
      c.fillStyle = fillCol;
      c.fill();
    }
    c.lineWidth = lineW || 2;
    c.strokeStyle = strokeCol;
    c.stroke();
    c.restore();
  }

  function drawTemporalUnderlay(c, f, s) {
    const R = f.radius || 75;
    const m1 = sampleHistoryAt(s.history, 1.0, s.t);
    const m2 = sampleHistoryAt(s.history, 2.0, s.t);
    const m3 = sampleHistoryAt(s.history, 3.0, s.t);

    c.save();
    // Filament spline connecting 3s -> 2s -> 1s -> live Chrono
    const pts = [m3, m2, m1, { x: f.x, y: f.y }].filter(Boolean);
    if (pts.length >= 2) {
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
      c.strokeStyle = 'rgba(94, 234, 255, 0.24)';
      c.lineWidth = 2;
      c.setLineDash([7, 7]);
      c.stroke();
      c.setLineDash([]);
    }

    // Draw 1s & 2s Timeline Markers + 3s Golden Rewind Anchor
    const markers = [
      { pt: m1, col: 'rgba(94, 234, 255, 0.32)', rScale: 0.42 },
      { pt: m2, col: 'rgba(94, 234, 255, 0.22)', rScale: 0.34 },
      { pt: m3, col: 'rgba(246, 196, 83, 0.56)', rScale: 0.54, anchor: true },
    ];
    for (const mk of markers) {
      if (!mk.pt) continue;
      c.save();
      c.translate(mk.pt.x, mk.pt.y);
      c.strokeStyle = mk.col;
      c.lineWidth = mk.anchor ? 2.4 : 1.5;
      c.beginPath();
      c.arc(0, 0, R * mk.rScale, 0, TAU);
      c.stroke();
      if (mk.anchor) {
        // Spinning clock hands inside the 3.0s Rewind Anchor
        c.rotate(-s.gearPhase * 1.4);
        c.beginPath();
        c.moveTo(0, -R * 0.38);
        c.lineTo(0, 0);
        c.lineTo(R * 0.24, 0);
        c.stroke();
      }
      c.restore();
    }

    // Active Time Loop Holographic Echo Clones
    for (const ec of s.echoClones) {
      const a = clamp(ec.life / ec.maxLife, 0, 1);
      c.save();
      c.translate(ec.x, ec.y);
      c.globalAlpha = a * 0.72;
      drawGearRing(c, R * 0.82, 12, 5, s.gearPhase * 2.5, '#5eeaff', 'rgba(18, 68, 92, 0.28)', 2);
      c.strokeStyle = '#ffd166';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, R * 0.5, 0, TAU);
      c.stroke();
      c.restore();
    }

    // Rewind Snapback Ribbon Flash
    if (s.rewindOrigin) {
      const u = clamp(s.rewindOrigin.life / 0.65, 0, 1);
      const grad = c.createLinearGradient(s.rewindOrigin.x, s.rewindOrigin.y, s.rewindOrigin.tx, s.rewindOrigin.ty);
      grad.addColorStop(0, `rgba(94, 234, 255, ${u * 0.15})`);
      grad.addColorStop(0.5, `rgba(255, 214, 102, ${u * 0.85})`);
      grad.addColorStop(1, `rgba(94, 234, 255, ${u * 0.95})`);
      c.strokeStyle = grad;
      c.lineWidth = 18 * u;
      c.beginPath();
      c.moveTo(s.rewindOrigin.x, s.rewindOrigin.y);
      c.lineTo(s.rewindOrigin.tx, s.rewindOrigin.ty);
      c.stroke();
    }
    c.restore();
  }

  function drawActorCore(c, f) {
    const s = getState(f);
    const R = f.radius || 75;

    c.save();
    c.translate(f.x, f.y);

    // 1. Celestial Brass Astrolabe Outer Halo Ring + Tick Marks
    c.save();
    c.rotate(s.gearPhase * 0.55);
    c.strokeStyle = s.loopGlow > 0.1 ? '#72f5ff' : '#d9a441';
    c.lineWidth = 2.6;
    c.beginPath();
    c.arc(0, 0, R * 1.03, 0, TAU);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const major = i % 3 === 0;
      c.beginPath();
      c.moveTo(Math.cos(a) * R * (major ? 0.88 : 0.94), Math.sin(a) * R * (major ? 0.88 : 0.94));
      c.lineTo(Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08);
      c.lineWidth = major ? 2.8 : 1.4;
      c.stroke();
    }
    c.restore();

    // 2. Counter-Rotating Engraved Brass Escapement Gear
    drawGearRing(
      c,
      R * 0.84,
      16,
      R * 0.08,
      -s.gearPhase * 0.95,
      '#eab957',
      '#1a1d26',
      2.2
    );

    // 3. Articulated Gold-Brass Shoulder Pauldrons (Left & Right)
    for (const dir of [-1, 1]) {
      c.save();
      c.translate(dir * R * 0.58 + s.bankX * 3, R * 0.04 + s.bankY * 2.5);
      c.rotate(dir * 0.18 + s.bankX * 0.08);
      const pGrad = c.createLinearGradient(-dir * R * 0.25, -R * 0.45, dir * R * 0.3, R * 0.45);
      pGrad.addColorStop(0, '#f4cf76');
      pGrad.addColorStop(0.55, '#b6832c');
      pGrad.addColorStop(1, '#583d12');
      c.fillStyle = pGrad;
      c.strokeStyle = '#0b0d12';
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(-dir * R * 0.1, -R * 0.54);
      c.lineTo(dir * R * 0.36, -R * 0.26);
      c.lineTo(dir * R * 0.38, R * 0.34);
      c.lineTo(-dir * R * 0.06, R * 0.52);
      c.lineTo(-dir * R * 0.18, 0);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }

    // 4. Luminous Sapphire Tourbillon Core
    const coreGlow = c.createRadialGradient(0, 0, R * 0.06, 0, 0, R * 0.68);
    coreGlow.addColorStop(0, '#e6ffff');
    coreGlow.addColorStop(0.38, '#29d8ff');
    coreGlow.addColorStop(0.76, 'rgba(14, 92, 138, 0.45)');
    coreGlow.addColorStop(1, 'rgba(10, 26, 42, 0)');
    c.fillStyle = coreGlow;
    c.beginPath();
    c.arc(0, 0, R * 0.68, 0, TAU);
    c.fill();

    drawGearRing(c, R * 0.46, 10, R * 0.06, s.gearPhase * 2.2, '#7ef4ff', 'rgba(9, 28, 44, 0.82)', 1.8);

    // 5. Sleek Matte-Obsidian Automaton Helm + Temple Fins + Cyan Chronometer Visor
    c.save();
    c.translate(s.bankX * 4.5, s.bankY * 4.5);

    // Obsidian Cranium Chassis
    const helmGrad = c.createLinearGradient(0, -R * 0.68, 0, R * 0.64);
    helmGrad.addColorStop(0, '#2c3342');
    helmGrad.addColorStop(0.5, '#151922');
    helmGrad.addColorStop(1, '#0b0d13');
    c.fillStyle = helmGrad;
    c.strokeStyle = '#d9a441';
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(0, -R * 0.68);
    c.lineTo(R * 0.46, -R * 0.34);
    c.lineTo(R * 0.42, R * 0.24);
    c.lineTo(0, R * 0.62);
    c.lineTo(-R * 0.42, R * 0.24);
    c.lineTo(-R * 0.46, -R * 0.34);
    c.closePath();
    c.fill();
    c.stroke();

    // Lateral Chronometer Wing-Stabilizers
    for (const dir of [-1, 1]) {
      c.fillStyle = '#1d222e';
      c.strokeStyle = '#72f5ff';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(dir * R * 0.36, -R * 0.22);
      c.lineTo(dir * R * 0.86, -R * 0.44);
      c.lineTo(dir * R * 0.74, -R * 0.12);
      c.lineTo(dir * R * 0.38, -R * 0.02);
      c.closePath();
      c.fill();
      c.stroke();
    }

    // Glowing Cyan Chronometer Optics
    c.save();
    c.shadowColor = '#48f0ff';
    c.shadowBlur = 14;
    c.fillStyle = s.rewindFlash > 0.2 ? '#fff4b8' : '#b8fbff';
    for (const dir of [-1, 1]) {
      c.beginPath();
      c.moveTo(dir * R * 0.07, R * 0.02);
      c.lineTo(dir * R * 0.33, -R * 0.07);
      c.lineTo(dir * R * 0.28, R * 0.11);
      c.lineTo(dir * R * 0.09, R * 0.12);
      c.closePath();
      c.fill();
    }
    c.restore();

    // Central Forehead Hourglass Crest
    c.fillStyle = '#f5cb6e';
    c.beginPath();
    c.moveTo(0, -R * 0.52);
    c.lineTo(R * 0.09, -R * 0.32);
    c.lineTo(0, -R * 0.14);
    c.lineTo(-R * 0.09, -R * 0.32);
    c.closePath();
    c.fill();

    c.restore();

    if (s.rewindFlash > 0.02) {
      c.strokeStyle = `rgba(114, 245, 255, ${s.rewindFlash})`;
      c.lineWidth = 4.5 * s.rewindFlash;
      c.beginPath();
      c.arc(0, 0, R * (1.05 + (1 - s.rewindFlash) * 1.4), 0, TAU);
      c.stroke();
    }

    c.restore();
  }

  api.renderBody = function renderChronoBody(c, f) {
    const s = getState(f);
    updateChronoRig(f, s, 1 / 60);
    drawTemporalUnderlay(c, f, s);
    const P = g.APEX_CHAMBER_PALETTE;
    if (P && P.actorRender && P.isActive()) {
      P.actorRender(c, f, f.x, f.y, (oc) => drawActorCore(oc, f));
    } else {
      drawActorCore(c, f);
    }
  };
  api.renderIdentityBody = drawActorCore;

  if (g.Fighter && g.Fighter.prototype) {
    const prevDraw = g.Fighter.prototype.draw;
    g.Fighter.prototype.draw = function (c) {
      if (isTimeHero(this)) {
        if (this.hp > 0) api.renderBody(c, this);
      } else {
        prevDraw.call(this, c);
      }
    };
  }

  const bus = g.APEX_HERO_REWORK_AIL?.bus;
  if (bus && typeof bus.on === 'function') {
    bus.on('Cast', (ev) => {
      if (!ev || ev.hero !== 'TIME') return;
      const list = g.fighters || [];
      const f = list[ev.side === 'p2' ? 1 : 0];
      if (!f) return;
      const s = getState(f);
      if (ev.slot === 'A1') {
        s.loopGlow = 1.0;
        const m1 = sampleHistoryAt(s.history, 0.9, s.t) || { x: f.x - 45, y: f.y - 35 };
        const m2 = sampleHistoryAt(s.history, 1.7, s.t) || { x: f.x + 45, y: f.y + 35 };
        s.echoClones.push({ x: m1.x, y: m1.y, life: 2.2, maxLife: 2.2 });
        s.echoClones.push({ x: m2.x, y: m2.y, life: 2.8, maxLife: 2.8 });
        g.APEX_EVOLUTION_SHADER?.spawnShockwave?.(f.x, f.y, 0.36, 280, 620, 0.9);
      } else if (ev.slot === 'A2') {
        s.rewindFlash = 1.0;
      }
      g.APEX_EVOLUTION_AUDIO?.playHeroCue?.('TIME', ev.slot);
    });
  }

  g.apexTimePresentationRuntime = 'ready';
})(window);
