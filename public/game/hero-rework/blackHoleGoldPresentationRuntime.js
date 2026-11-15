/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — BLACK HOLE (VORTEX-09) Gold Presentation Runtime
 *
 * Multi-layered cosmic-industrial singularity rig + wormhole transit portals +
 * damage-singularity escrow implosion + live WebGL2 relativistic lensing feed.
 * Driven 100% by canonical heroReworkRuntime / heroMechanicsRuntime state.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_BLACK_HOLE_PRESENTATION) return;

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  const states = new WeakMap();
  const api = (g.APEX_BLACK_HOLE_PRESENTATION = { ready: true });

  g.apexProductAssets?.registerPresentation?.('black_hole', () => Promise.resolve(true));

  function isBlackHole(f) {
    const HR = g.APEX_HERO_REWORK;
    return HR?.byCombatant?.(f)?.heroId === 'BLACK_HOLE' || f?.type?.name === 'BLACK_HOLE' || f?.name === 'BLACK_HOLE';
  }

  function makeShards() {
    const list = [];
    for (let i = 0; i < 14; i++) {
      list.push({
        ang: (i / 14) * TAU,
        dist: 1.05 + (i % 3) * 0.16,
        spd: (i % 2 === 0 ? 1 : -0.78) * (1.35 + (i % 4) * 0.28),
        len: 10 + (i % 4) * 4,
        wid: 3.5 + (i % 3) * 1.4,
        tilt: (i * 0.7) % TAU,
      });
    }
    return list;
  }

  function getState(f) {
    let s = states.get(f);
    if (s) return s;
    s = {
      t: Math.random() * 10,
      bankX: 0,
      bankY: 0,
      openPulse: 0,
      escrowPulse: 0,
      detonateFlash: 0,
      blinkT: 2.8,
      shards: makeShards(),
      sparks: [],
      lastX: f.x,
      lastY: f.y,
    };
    states.set(f, s);
    return s;
  }

  function pushSpark(s, x, y, vx, vy, col, life, sz) {
    if (s.sparks.length > 48) s.sparks.shift();
    s.sparks.push({ x, y, vx, vy, col, life, maxLife: life, sz });
  }

  function updateRig(f, s, dt) {
    s.t += dt;
    const vx = (f.x - s.lastX) / Math.max(dt, 0.008);
    const vy = (f.y - s.lastY) / Math.max(dt, 0.008);
    s.lastX = f.x;
    s.lastY = f.y;

    s.bankX = lerp(s.bankX, clamp(vx / 620, -1, 1), clamp(dt * 10, 0, 1));
    s.bankY = lerp(s.bankY, clamp(vy / 620, -1, 1), clamp(dt * 10, 0, 1));
    s.openPulse = Math.max(0, s.openPulse - dt * 1.35);
    s.detonateFlash = Math.max(0, s.detonateFlash - dt * 2.4);

    s.blinkT -= dt;
    if (s.blinkT <= -0.11) s.blinkT = 2.6 + ((s.t * 1.37) % 2.1);

    const HR = g.APEX_HERO_REWORK;
    const ct = HR?.byCombatant?.(f);
    const singStore = ct?.store?.['black_hole.damage_singularity'] || null;
    const inEscrow = !!(singStore && singStore.escrowLeft > 0);
    const storedAmt = singStore ? Number(singStore.stored || 0) : 0;
    s.escrowPulse = lerp(s.escrowPulse, inEscrow ? clamp(0.35 + storedAmt / 260, 0.35, 1.35) : 0, clamp(dt * 9, 0, 1));

    if (Math.hypot(vx, vy) > 140 && Math.random() < 0.55) {
      const ang = Math.atan2(-vy, -vx) + (Math.random() - 0.5) * 0.8;
      pushSpark(
        s,
        f.x + Math.cos(ang) * (f.radius * 0.65),
        f.y + Math.sin(ang) * (f.radius * 0.65),
        Math.cos(ang) * 95,
        Math.sin(ang) * 95,
        inEscrow ? '#ffd166' : '#c77dff',
        0.34,
        3.6
      );
    }

    for (let i = s.sparks.length - 1; i >= 0; i--) {
      const p = s.sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        s.sparks.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }

    // Feed relativistic gravitational lens to the GPU WebGL2 shader compositor
    const shader = g.APEX_EVOLUTION_SHADER;
    if (shader && f.hp > 0) {
      const rScale = (f.radius || 75) / 75;
      shader.pushLens?.(
        f.x,
        f.y,
        (78 + s.escrowPulse * 48 + s.openPulse * 30) * rScale,
        0.22 + s.escrowPulse * 0.34 + s.openPulse * 0.2
      );
      shader.pushLight?.(f.x, f.y, 0.68, 0.32, 1.0, 165 * rScale, 0.52 + s.escrowPulse * 0.45);
    }
  }

  function drawArmorSegment(c, rInner, rOuter, a0, a1, fill, stroke, glowCol) {
    c.beginPath();
    c.arc(0, 0, rOuter, a0, a1);
    c.arc(0, 0, rInner, a1, a0, true);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 2.2;
    c.strokeStyle = stroke;
    c.stroke();
    if (glowCol) {
      c.beginPath();
      c.arc(0, 0, (rInner + rOuter) * 0.5, a0 + 0.05, a1 - 0.05);
      c.strokeStyle = glowCol;
      c.lineWidth = 1.6;
      c.stroke();
    }
  }

  function drawActorCore(c, f) {
    const s = getState(f);
    const R = f.radius || 75;
    const t = s.t;
    const flare = 1 + s.openPulse * 0.18 + s.escrowPulse * 0.14;

    c.save();
    // Trailing Hawking sparks in world space
    for (const p of s.sparks) {
      const u = clamp(p.life / p.maxLife, 0, 1);
      c.globalAlpha = u * 0.85;
      c.fillStyle = p.col;
      c.beginPath();
      c.arc(p.x, p.y, p.sz * u, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;

    c.translate(f.x, f.y);

    // 1. Outer gravitational distortion halo + accretion swirl
    const outerGlow = c.createRadialGradient(0, 0, R * 0.25, 0, 0, R * 1.48 * flare);
    outerGlow.addColorStop(0, 'rgba(8, 4, 18, 0.98)');
    outerGlow.addColorStop(0.42, 'rgba(138, 62, 255, 0.62)');
    outerGlow.addColorStop(0.68, s.escrowPulse > 0.1 ? 'rgba(255, 196, 86, 0.42)' : 'rgba(196, 118, 255, 0.28)');
    outerGlow.addColorStop(1, 'rgba(20, 8, 42, 0)');
    c.fillStyle = outerGlow;
    c.beginPath();
    c.arc(0, 0, R * 1.48 * flare, 0, TAU);
    c.fill();

    // 2. Relativistic Accretion Disk (tilted multi-band Doppler rings)
    c.save();
    const tiltAngle = Math.atan2(s.bankY, s.bankX) * 0.15 - 0.32;
    c.rotate(tiltAngle);
    c.scale(1.16, 0.68);
    for (let ring = 0; ring < 3; ring++) {
      const rr = R * (0.76 + ring * 0.16) * flare;
      const rot = t * (2.6 - ring * 0.55) * (ring % 2 === 0 ? 1 : -1);
      c.save();
      c.rotate(rot);
      const grad = c.createLinearGradient(-rr, 0, rr, 0);
      grad.addColorStop(0, 'rgba(245, 224, 255, 0.92)');
      grad.addColorStop(0.35, 'rgba(172, 88, 255, 0.78)');
      grad.addColorStop(0.7, 'rgba(84, 26, 168, 0.35)');
      grad.addColorStop(1, 'rgba(214, 148, 255, 0.85)');
      c.strokeStyle = grad;
      c.lineWidth = (7.5 - ring * 1.8) * (R / 75);
      c.beginPath();
      c.arc(0, 0, rr, 0.15, TAU - 0.22);
      c.stroke();
      c.restore();
    }
    c.restore();

    // 3. Articulated Dark-Titanium Orbital Containment Plates (6 heavy mech segments)
    const segCount = 6;
    const collarRot = t * 0.42 + s.bankX * 0.22;
    for (let i = 0; i < segCount; i++) {
      const baseA = collarRot + (i / segCount) * TAU;
      const pushOut = R * (0.04 * Math.sin(t * 3.1 + i) + s.openPulse * 0.14 + s.escrowPulse * 0.1);
      c.save();
      c.translate(Math.cos(baseA) * pushOut, Math.sin(baseA) * pushOut);
      drawArmorSegment(
        c,
        R * 0.72,
        R * 0.96,
        baseA - 0.34,
        baseA + 0.34,
        i % 2 === 0 ? '#161922' : '#212634',
        '#090b10',
        s.escrowPulse > 0.15 ? 'rgba(255, 208, 102, 0.85)' : 'rgba(186, 114, 255, 0.75)'
      );
      // Gold mechanical rivet node on each containment plate
      const midR = R * 0.84;
      c.fillStyle = '#e0a94f';
      c.beginPath();
      c.arc(Math.cos(baseA) * midR, Math.sin(baseA) * midR, R * 0.042, 0, TAU);
      c.fill();
      c.restore();
    }

    // 4. Orbiting Relativistic Shards
    for (const sh of s.shards) {
      const a = sh.ang + t * sh.spd;
      const rad = R * sh.dist * flare;
      const sx = Math.cos(a) * rad;
      const sy = Math.sin(a) * rad * 0.88;
      c.save();
      c.translate(sx, sy);
      c.rotate(a + Math.PI * 0.5);
      c.fillStyle = '#2a223d';
      c.strokeStyle = '#d49bff';
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(sh.len * 0.6, 0);
      c.lineTo(-sh.len * 0.45, sh.wid);
      c.lineTo(-sh.len * 0.25, 0);
      c.lineTo(-sh.len * 0.45, -sh.wid);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }

    // 5. Event Horizon Singularity Core + Photon Ring
    const coreR = R * 0.56;
    c.save();
    c.translate(s.bankX * 4.5, s.bankY * 4.5);

    // Bright ultraviolet-white Einstein Photon Ring
    const photonGrad = c.createRadialGradient(0, 0, coreR * 0.76, 0, 0, coreR * 1.18);
    photonGrad.addColorStop(0, '#040208');
    photonGrad.addColorStop(0.72, '#070310');
    photonGrad.addColorStop(0.87, s.escrowPulse > 0.15 ? '#ffe599' : '#f3d9ff');
    photonGrad.addColorStop(0.95, '#9d4edd');
    photonGrad.addColorStop(1, 'rgba(157, 78, 221, 0)');
    c.fillStyle = photonGrad;
    c.beginPath();
    c.arc(0, 0, coreR * 1.18, 0, TAU);
    c.fill();

    // Pitch-black Schwarzschild interior
    c.fillStyle = '#05030a';
    c.beginPath();
    c.arc(0, 0, coreR * 0.82, 0, TAU);
    c.fill();

    // Crown Mech Brow Crest above the Event Horizon
    c.fillStyle = '#1b1e2b';
    c.strokeStyle = '#b57cff';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -R * 0.88);
    c.lineTo(R * 0.34, -R * 0.44);
    c.lineTo(R * 0.14, -R * 0.28);
    c.lineTo(0, -R * 0.42);
    c.lineTo(-R * 0.14, -R * 0.28);
    c.lineTo(-R * 0.34, -R * 0.44);
    c.closePath();
    c.fill();
    c.stroke();

    // Luminous Twin Ultraviolet Visor Eyes inside the Void
    const eyeOpen = s.blinkT < 0 ? 0.14 : 1;
    for (const dir of [-1, 1]) {
      c.save();
      c.translate(dir * coreR * 0.36 + s.bankX * 3, coreR * 0.08 + s.bankY * 2.5);
      c.rotate(dir * 0.24);
      c.scale(1, eyeOpen);
      c.shadowColor = '#e0aaff';
      c.shadowBlur = 14;
      c.fillStyle = s.escrowPulse > 0.2 ? '#fff3b0' : '#f6e8ff';
      c.beginPath();
      c.moveTo(-coreR * 0.24, -coreR * 0.05);
      c.lineTo(coreR * 0.22, -coreR * 0.11);
      c.lineTo(coreR * 0.16, coreR * 0.09);
      c.lineTo(-coreR * 0.18, coreR * 0.06);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.restore();

    // 6. A2 Damage Singularity Escrow Cage Overlay
    if (s.escrowPulse > 0.04) {
      const cageR = R * (1.28 - 0.18 * Math.sin(t * 14));
      c.strokeStyle = `rgba(255, 214, 102, ${clamp(s.escrowPulse, 0, 0.95)})`;
      c.lineWidth = 3.2;
      c.setLineDash([12, 8]);
      c.beginPath();
      c.arc(0, 0, cageR, t * 4, t * 4 + TAU);
      c.stroke();
      c.setLineDash([]);
    }

    if (s.detonateFlash > 0.01) {
      c.strokeStyle = `rgba(240, 210, 255, ${s.detonateFlash})`;
      c.lineWidth = 6 * s.detonateFlash;
      c.beginPath();
      c.arc(0, 0, R * (1.1 + (1 - s.detonateFlash) * 1.9), 0, TAU);
      c.stroke();
    }

    c.restore();
  }

  function drawWorldGatesAndSingularities(c) {
    const HR = g.APEX_HERO_REWORK;
    const world = HR?.match?.world;
    if (!world) return;
    const now = HR.AIL?.clock?.() || performance.now() / 1000;

    // Render A1 Gravity Transit Wormholes
    if (Array.isArray(world.gates)) {
      for (const gate of world.gates) {
        if (!gate || gate.dead) continue;
        const r = gate.radius || 48;
        const isExit = gate.kind === 'exit' || gate.isExit;
        c.save();
        c.translate(gate.x, gate.y);

        const gGrad = c.createRadialGradient(0, 0, r * 0.12, 0, 0, r * 1.45);
        gGrad.addColorStop(0, '#04010a');
        gGrad.addColorStop(0.55, isExit ? 'rgba(255, 174, 72, 0.78)' : 'rgba(162, 82, 255, 0.82)');
        gGrad.addColorStop(1, 'rgba(20, 6, 38, 0)');
        c.fillStyle = gGrad;
        c.beginPath();
        c.arc(0, 0, r * 1.45, 0, TAU);
        c.fill();

        for (let k = 0; k < 3; k++) {
          c.save();
          c.rotate(now * (isExit ? -4.2 : 4.2) + (k * TAU) / 3);
          c.strokeStyle = isExit ? '#ffd166' : '#e0aaff';
          c.lineWidth = 2.6 - k * 0.5;
          c.beginPath();
          c.arc(0, 0, r * (0.68 + k * 0.16), 0, Math.PI * 1.15);
          c.stroke();
          c.restore();
        }

        c.fillStyle = '#06030d';
        c.beginPath();
        c.arc(0, 0, r * 0.44, 0, TAU);
        c.fill();

        g.APEX_EVOLUTION_SHADER?.pushLens?.(gate.x, gate.y, r * 1.5, 0.24);
        c.restore();
      }
    }

    // Render world Singularities
    if (Array.isArray(world.singularities)) {
      for (const sg of world.singularities) {
        if (!sg || sg.dead) continue;
        const r = sg.radius || 115;
        c.save();
        c.translate(sg.x, sg.y);
        c.strokeStyle = 'rgba(199, 125, 255, 0.55)';
        c.lineWidth = 2.4;
        c.beginPath();
        c.arc(0, 0, r * (0.85 + 0.1 * Math.sin(now * 9)), 0, TAU);
        c.stroke();
        g.APEX_EVOLUTION_SHADER?.pushLens?.(sg.x, sg.y, r * 1.25, 0.32);
        c.restore();
      }
    }
  }

  api.renderBody = function renderBlackHoleBody(c, f) {
    const s = getState(f);
    updateRig(f, s, 1 / 60);
    const P = g.APEX_CHAMBER_PALETTE;
    if (P && P.actorRender && P.isActive()) {
      P.actorRender(c, f, f.x, f.y, (oc) => drawActorCore(oc, f));
    } else {
      drawActorCore(c, f);
    }
  };
  api.renderIdentityBody = drawActorCore;

  // Hook Fighter.prototype.draw cleanly
  if (g.Fighter && g.Fighter.prototype) {
    const prevDraw = g.Fighter.prototype.draw;
    g.Fighter.prototype.draw = function (c) {
      if (isBlackHole(this)) {
        if (this.hp > 0) api.renderBody(c, this);
      } else {
        prevDraw.call(this, c);
      }
      if (this === g.fighters?.[g.fighters.length - 1]) {
        drawWorldGatesAndSingularities(c);
      }
    };
  }

  // Subscribe to AIL cast events for open/collapse visual & audio impulses
  const bus = g.APEX_HERO_REWORK_AIL?.bus;
  if (bus && typeof bus.on === 'function') {
    bus.on('Cast', (ev) => {
      if (!ev || ev.hero !== 'BLACK_HOLE') return;
      const list = g.fighters || [];
      const f = list[ev.side === 'p2' ? 1 : 0];
      if (!f) return;
      const s = getState(f);
      s.openPulse = 1.0;
      if (ev.slot === 'A2') s.detonateFlash = 1.0;
      g.APEX_EVOLUTION_SHADER?.spawnShockwave?.(f.x, f.y, ev.slot === 'A2' ? 0.55 : 0.35, 320, 680, 1.0);
      g.APEX_EVOLUTION_AUDIO?.playHeroCue?.('BLACK_HOLE', ev.slot);
    });
  }

  g.apexBlackHolePresentationRuntime = 'ready';
})(window);
