/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — Hero Overdrive Ultimate Choreography Engine
 *
 * Ten distinct combat set-pieces. Every ultimate is a phased choreography
 * (BUILDUP → ANTICIPATION → RELEASE → INTERACTION → IMPACT → AFTERMATH) with
 * readable telegraphs and genuine counterplay (dodge, parry, break, escape).
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_EVOLUTION_ULTIMATES) return;

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ease = (t) => t * t * (3 - 2 * t);
  const S = () => g.GAME_SIZE || 1000;

  const VFX = () => g.APEX_EVOLUTION_VFX;
  const SH = () => g.APEX_EVOLUTION_SHADER;
  const AR = () => g.APEX_EVOLUTION_ARENAS;
  const CB = () => g.APEX_EVOLUTION_COMBAT;
  const AU = () => g.APEX_EVOLUTION_AUDIO;
  const HUD = () => g.APEX_EVOLUTION_HUD;

  const active = [];
  let dilation = 1;

  function dmg(target, amount, source, label) {
    if (!target || target.hp <= 0) return 0;
    const pre = target.hp;
    target.takeDamage?.(amount, source, label);
    return Math.max(0, pre - target.hp);
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function pushBody(f, ang, amount) {
    if (!f) return;
    const s = S(), R = f.radius || 75;
    f.x = clamp(f.x + Math.cos(ang) * amount, R + 40, s - R - 40);
    f.y = clamp(f.y + Math.sin(ang) * amount, R + 40, s - R - 40);
  }
  function segDist(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1, l2 = vx * vx + vy * vy || 1e-6;
    const t = clamp(((px - x1) * vx + (py - y1) * vy) / l2, 0, 1);
    return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t));
  }
  function cinematic(opts) { HUD()?.cinematic?.(opts); }
  function callout(x, y, text, col, scale) { CB()?.callout?.(x, y, text, col, scale); }
  function bolt(side, x, y, vx, vy, d, r, col, life, homing, extra) { CB()?.spawnBolt?.(side, x, y, vx, vy, d, r, col, life, homing, extra); }

  // ── base instance ─────────────────────────────────────────────────────────
  function make(kind, side, owner, enemy, meta) {
    return { kind, side, owner, enemy, meta, t: 0, phase: 'buildup', done: false, data: {} };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ROBOT — OMEGA RAIL BARRAGE
  //    Two shoulder rail cannons unfold. Six shots, each with a 0.22s laser-sight
  //    telegraph (dodgeable by thrusters). Shot 4 is an overcharged piercing slug.
  //    Rails can be Aegis-parried back for massive damage (risk/reward).
  // ═══════════════════════════════════════════════════════════════════════════
  const ROBOT = {
    init(u) { u.data = { shots: 6, cd: 0.55, aim: null, aimT: 0, heat: 0, barrels: 0, scars: [] }; cinematic({ zoom: 1.07, dilation: 0.45, hold: 0.5, letterbox: 1 }); },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      d.barrels = Math.min(1, d.barrels + dt * 3.2);
      d.heat = Math.max(0, d.heat - dt * 1.1);
      if (u.t < 0.5) return;
      if (d.aim) {
        d.aimT -= dt;
        // laser sight tracks slowly so lateral thrusting evades
        const want = Math.atan2(e.y - o.y, e.x - o.x);
        let diff = want - d.aim; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU;
        d.aim += clamp(diff, -1.4 * dt, 1.4 * dt);
        if (d.aimT <= 0) {
          const over = d.shots === 3;
          const side = d.shots % 2 ? 1 : -1;
          const sx = o.x + Math.cos(d.aim + Math.PI / 2) * 30 * side, sy = o.y + Math.sin(d.aim + Math.PI / 2) * 30 * side;
          bolt(u.side, sx, sy, Math.cos(d.aim) * (over ? 2900 : 2450), Math.sin(d.aim) * (over ? 2900 : 2450), over ? 58 : 32, over ? 13 : 9, over ? '#fff1c2' : '#ffae34', 0.8, 0, { pierce: over, rail: true, trail: '#ff9f1c' });
          VFX()?.recipes.muzzleFlash(sx, sy, d.aim, '#ffb347');
          VFX()?.drawLightning && (d.flash = { x: sx, y: sy, a: d.aim, t: 0.12 });
          SH()?.pushLight?.(sx, sy, 1, 0.6, 0.15, 220, 1.2);
          SH()?.spawnShockwave?.(sx, sy, over ? 0.42 : 0.2, 160, 900, 0.6);
          g.cameraShake = Math.max(g.cameraShake || 0, over ? 11 : 5);
          AU()?.playRail?.(over);
          d.heat = 1; d.shots--; d.aim = null; d.cd = over ? 0.42 : 0.24;
          if (over) callout(o.x, o.y - 110, 'OVERCHARGE', '#fff1c2', 1.0);
        }
      } else if (d.shots > 0) {
        d.cd -= dt;
        if (d.cd <= 0) { d.aim = Math.atan2(e.y - o.y, e.x - o.x) + rnd(-0.08, 0.08); d.aimT = 0.22; }
      } else if (u.t > 3.2) u.done = true;
    },
    drawOver(c, u) {
      const d = u.data, o = u.owner;
      const b = ease(d.barrels), R = o.radius || 75;
      const face = d.aim != null ? d.aim : Math.atan2(u.enemy.y - o.y, u.enemy.x - o.x);
      // shoulder rail cannons
      for (const sgn of [-1, 1]) {
        c.save(); c.translate(o.x, o.y); c.rotate(face);
        c.translate(-R * 0.1, sgn * R * (0.55 + 0.25 * b));
        c.fillStyle = '#1c212c'; c.strokeStyle = '#ff9f1c'; c.lineWidth = 2;
        c.beginPath(); c.roundRect(-18, -9, 72 * b, 18, 4); c.fill(); c.stroke();
        c.fillStyle = `rgba(255,${Math.round(150 + d.heat * 100)},40,${0.5 + d.heat * 0.5})`;
        c.beginPath(); c.roundRect(40 * b, -4, 20 * b, 8, 2); c.fill();
        // coil rings
        for (let k = 0; k < 4; k++) { c.strokeStyle = `rgba(255,174,52,${0.35 + d.heat * 0.5})`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6 + k * 14 * b, -12); c.lineTo(-6 + k * 14 * b, 12); c.stroke(); }
        c.restore();
      }
      // laser sight telegraph
      if (d.aim != null) {
        const u2 = 1 - d.aimT / 0.22;
        c.save(); c.globalAlpha = 0.35 + u2 * 0.55; c.strokeStyle = '#ff3b3b'; c.lineWidth = 1.5 + u2 * 2; c.setLineDash([14, 10]);
        c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(o.x + Math.cos(d.aim) * 1400, o.y + Math.sin(d.aim) * 1400); c.stroke(); c.restore();
      }
      if (d.flash && d.flash.t > 0) { d.flash.t -= 1 / 60; VFX()?.drawLightning(c, d.flash.x, d.flash.y, d.flash.x + Math.cos(d.flash.a) * 140, d.flash.y + Math.sin(d.flash.a) * 140, 3, 'rgba(255,200,120,0.9)', 2, 0.25, 1); }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. HUNTER — PREDATOR ECLIPSE
  //    The arena darkens; HUNTER cloaks and gains speed. First contact triggers a
  //    3-slash rake combo. If the prey Aegis-parries mid-combo, HUNTER is stunned.
  // ═══════════════════════════════════════════════════════════════════════════
  const HUNTER = {
    init(u) { u.data = { cloak: 0, combo: 0, comboCd: 0, struck: false, marks: [], afterimages: [] }; cinematic({ zoom: 1.04, dilation: 0.5, hold: 0.4, letterbox: 1, tint: 'eclipse' }); u.owner.__evoCloak = true; },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      d.cloak = Math.min(1, d.cloak + dt * 3);
      o.__evoSpeedBoost = Math.max(o.__evoSpeedBoost || 0, 0.2);
      if (Math.random() < 0.6) d.afterimages.push({ x: o.x, y: o.y, t: 0.35 });
      for (let i = d.afterimages.length - 1; i >= 0; i--) { d.afterimages[i].t -= dt; if (d.afterimages[i].t <= 0) d.afterimages.splice(i, 1); }
      for (let i = d.marks.length - 1; i >= 0; i--) { d.marks[i].t -= dt; if (d.marks[i].t <= 0) d.marks.splice(i, 1); }
      if (!d.struck && u.t > 0.4 && dist(o, e) < (o.radius || 75) + (e.radius || 75) + 30) {
        d.struck = true; d.combo = 3; d.comboCd = 0;
        o.__evoCloak = false;
      }
      if (d.struck && d.combo > 0) {
        d.comboCd -= dt;
        if (d.comboCd <= 0) {
          const st = CB()?.getState?.()?.sides?.[1 - u.side];
          if (st && st.aegisWindow > 0.03) {
            // prey parried the rake: HUNTER punished
            d.combo = 0; o.applyStatus?.('stun', 1.0); callout(o.x, o.y - 100, 'PREDATOR DENIED', '#5ce1ff', 1.1);
            SH()?.spawnShockwave?.(o.x, o.y, 0.5, 300, 760, 1.2); u.done = true; return;
          }
          const ang = Math.atan2(e.y - o.y, e.x - o.x) + rnd(-0.6, 0.6);
          dmg(e, 42, o, 'Predator Eclipse');
          e.applyStatus?.('slow', 0.6, { mult: 0.6 });
          d.marks.push({ x: e.x, y: e.y, a: ang, t: 0.6 });
          AR()?.addScar?.('slash', e.x, e.y, 70, ang, 'rgba(158,240,26,0.5)');
          VFX()?.recipes.impactSparks(e.x, e.y, 10, '#b5ff3a', e.y + 50);
          g.hitStop = Math.max(g.hitStop || 0, 0.045); g.cameraShake = Math.max(g.cameraShake || 0, 7);
          AU()?.playSlash?.();
          d.combo--; d.comboCd = 0.19;
          if (d.combo === 0) { pushBody(e, ang, 120); u.done = true; o.__evoCloak = false; }
        }
      }
      if (u.t > 3.2) { u.done = true; o.__evoCloak = false; }
    },
    drawOver(c, u) {
      const d = u.data, o = u.owner, R = o.radius || 75;
      for (const a of d.afterimages) { c.save(); c.globalAlpha = a.t * 0.5; c.strokeStyle = '#9ef01a'; c.lineWidth = 2; c.beginPath(); c.arc(a.x, a.y, R * 0.8, 0, TAU); c.stroke(); c.restore(); }
      // predator eyes glow through cloak
      c.save(); c.globalAlpha = 0.6 + 0.4 * Math.sin(u.t * 18); c.fillStyle = '#c8ff5e'; c.shadowColor = '#9ef01a'; c.shadowBlur = 16;
      c.beginPath(); c.arc(o.x - 12, o.y - 6, 4, 0, TAU); c.arc(o.x + 12, o.y - 6, 4, 0, TAU); c.fill(); c.restore();
      for (const m of d.marks) {
        const a = clamp(m.t / 0.6, 0, 1);
        c.save(); c.translate(m.x, m.y); c.rotate(m.a); c.globalAlpha = a;
        for (let k = -1; k <= 1; k++) { c.strokeStyle = '#d9ff7a'; c.lineWidth = 6 * a; c.lineCap = 'round'; c.beginPath(); c.moveTo(-90, k * 22); c.lineTo(90, k * 22 - 10); c.stroke(); }
        c.restore();
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CRYSTAL — PRISMATIC SUPERNOVA
  //    A six-facet citadel grows around CRYSTALA (absorbs projectiles, heals).
  //    At peak it detonates: facets become 12 homing shards + 6 refraction beams.
  // ═══════════════════════════════════════════════════════════════════════════
  const CRYSTAL = {
    init(u) { u.data = { grow: 0, facets: [], absorbed: 0, detonated: false, beams: 0, rot: 0 }; for (let i = 0; i < 6; i++) u.data.facets.push({ a: (i / 6) * TAU, hp: 1, delay: i * 0.08 }); cinematic({ zoom: 1.05, dilation: 0.5, hold: 0.45, letterbox: 1 }); },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      d.rot += dt * 0.8;
      if (!d.detonated) {
        d.grow = Math.min(1, d.grow + dt * 1.1);
        o.hp = Math.min(o.maxHp, o.hp + dt * 26);
        // citadel absorbs incoming projectiles
        for (const p of g.projectiles || []) {
          if (!p || p.owner === o || typeof p.x !== 'number') continue;
          if (Math.hypot(p.x - o.x, p.y - o.y) < 150 * d.grow) { p.life = 0; d.absorbed++; VFX()?.recipes.crystalShatter(p.x, p.y, 3, 'violet'); }
        }
        if (u.t > 1.35) {
          d.detonated = true; d.beams = 1;
          const bonus = Math.min(8, d.absorbed);
          for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + d.rot; bolt(u.side, o.x + Math.cos(a) * 120, o.y + Math.sin(a) * 120, Math.cos(a) * 1350, Math.sin(a) * 1350, 20 + bonus * 2, 9, '#e0aaff', 1.5, 3.4, { shard: true }); }
          VFX()?.recipes.crystalShatter(o.x, o.y, 40, 'violet');
          SH()?.spawnShockwave?.(o.x, o.y, 0.75, 560, 820, 1.5);
          g.cameraShake = Math.max(g.cameraShake || 0, 14); g.hitStop = Math.max(g.hitStop || 0, 0.07);
          callout(o.x, o.y - 140, bonus ? `SUPERNOVA +${bonus} ABSORBED` : 'SUPERNOVA', '#e0aaff', 1.2);
          AU()?.playCrystalBurst?.();
          cinematic({ zoom: 1.08, dilation: 0.3, hold: 0.3 });
        }
      } else {
        d.beams = Math.max(0, d.beams - dt * 0.9);
        if (d.beams > 0 && e && e.hp > 0) {
          for (let k = 0; k < 6; k++) {
            const a = d.rot * 2 + (k / 6) * TAU;
            if (segDist(e.x, e.y, o.x, o.y, o.x + Math.cos(a) * 330, o.y + Math.sin(a) * 330) < (e.radius || 75) * 0.9) { dmg(e, 70 * dt, o, 'Refraction'); }
          }
        }
        if (d.beams <= 0) u.done = true;
      }
    },
    drawOver(c, u) {
      const d = u.data, o = u.owner, V = VFX();
      if (!d.detonated) {
        const gr = ease(d.grow);
        c.save(); c.translate(o.x, o.y);
        for (const f of d.facets) {
          const fg = clamp((d.grow - f.delay) / 0.6, 0, 1);
          if (fg <= 0) continue;
          c.save(); c.rotate(f.a + d.rot * 0.2); c.translate(0, -120 * gr);
          V?.drawShard(c, 58 * fg, 22 * fg, 275, 0.95);
          c.restore();
        }
        // inner lattice
        c.strokeStyle = `rgba(224,170,255,${0.35 + 0.3 * Math.sin(u.t * 9)})`; c.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + d.rot * 0.2, b = ((i + 2) / 6) * TAU + d.rot * 0.2; c.beginPath(); c.moveTo(Math.cos(a) * 120 * gr, Math.sin(a) * 120 * gr); c.lineTo(Math.cos(b) * 120 * gr, Math.sin(b) * 120 * gr); c.stroke(); }
        c.restore();
        SH()?.pushLight?.(o.x, o.y, 0.78, 0.5, 1, 260 * gr, 0.8);
      } else if (d.beams > 0) {
        c.save(); c.translate(o.x, o.y); c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 6; k++) {
          const a = d.rot * 2 + (k / 6) * TAU;
          const lg = c.createLinearGradient(0, 0, Math.cos(a) * 330, Math.sin(a) * 330);
          lg.addColorStop(0, `rgba(255,255,255,${0.9 * d.beams})`); lg.addColorStop(0.5, `rgba(199,125,255,${0.7 * d.beams})`); lg.addColorStop(1, 'rgba(157,78,221,0)');
          c.strokeStyle = lg; c.lineWidth = 10 * d.beams; c.beginPath(); c.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); c.lineTo(Math.cos(a) * 330, Math.sin(a) * 330); c.stroke();
        }
        c.restore();
        SH()?.pushLens?.(o.x, o.y, 180, 0.3 * d.beams);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. MAGNET — LORENTZ RAIL-STORM
  //    Twin coil poles plant on both flanks of the rival. Everything metallic
  //    (bullets, floor guns, the rival) is dragged onto the Lorentz line, then a
  //    rail-storm of gauss shards races along it. Escape = leave the line early.
  // ═══════════════════════════════════════════════════════════════════════════
  const MAGNET = {
    init(u) {
      const e = u.enemy, s = S();
      const ang = Math.atan2(e.y - u.owner.y, e.x - u.owner.x) + Math.PI / 2;
      u.data = { ax: clamp(e.x + Math.cos(ang) * 330, 70, s - 70), ay: clamp(e.y + Math.sin(ang) * 330, 70, s - 70), bx: clamp(e.x - Math.cos(ang) * 330, 70, s - 70), by: clamp(e.y - Math.sin(ang) * 330, 70, s - 70), plant: 0, storm: 0, shotCd: 0, arcs: [] };
      cinematic({ zoom: 1.05, dilation: 0.5, hold: 0.4, letterbox: 1 });
    },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      d.plant = Math.min(1, d.plant + dt * 2.2);
      if (u.t < 0.5) return;
      // pull metal onto the line
      const pull = (obj, k) => { const dd = segDist(obj.x, obj.y, d.ax, d.ay, d.bx, d.by); if (dd < 2) return; const lx = d.bx - d.ax, ly = d.by - d.ay, ll = Math.hypot(lx, ly) || 1; const t = clamp(((obj.x - d.ax) * lx + (obj.y - d.ay) * ly) / (ll * ll), 0, 1); const px = d.ax + lx * t, py = d.ay + ly * t; obj.x += (px - obj.x) * k; obj.y += (py - obj.y) * k; };
      if (u.t < 2.1) {
        if (e && e.hp > 0) pull(e, dt * 1.6);
        for (const sl of g.APEX_ARSENAL?.state?.slots || []) if (sl && sl.phase === 'REVEALED') pull(sl, dt * 2.5);
        for (const p of g.projectiles || []) if (p && typeof p.x === 'number') pull(p, dt * 4);
        if (Math.random() < 0.35) d.arcs.push({ t: 0.12, x0: d.ax, y0: d.ay, x1: d.bx, y1: d.by });
      } else if (u.t < 3.6) {
        d.shotCd -= dt;
        if (d.shotCd <= 0) {
          d.shotCd = 0.13;
          const fromA = Math.random() < 0.5;
          const sx = fromA ? d.ax : d.bx, sy = fromA ? d.ay : d.by, tx = fromA ? d.bx : d.ax, ty = fromA ? d.by : d.ay;
          const a = Math.atan2(ty - sy, tx - sx);
          bolt(u.side, sx, sy, Math.cos(a) * 2100, Math.sin(a) * 2100, 24, 8, '#90e0ef', 0.6, 0, { rail: true, trail: '#72efdd' });
          d.arcs.push({ t: 0.1, x0: sx, y0: sy, x1: tx, y1: ty });
          AU()?.playRail?.(false);
        }
      } else u.done = true;
      for (let i = d.arcs.length - 1; i >= 0; i--) { d.arcs[i].t -= dt; if (d.arcs[i].t <= 0) d.arcs.splice(i, 1); }
      SH()?.pushLight?.((d.ax + d.bx) / 2, (d.ay + d.by) / 2, 0.5, 0.9, 1, 360, 0.6);
    },
    drawUnder(c, u) {
      const d = u.data, p = ease(d.plant);
      c.save();
      // Lorentz line field
      const lg = c.createLinearGradient(d.ax, d.ay, d.bx, d.by);
      lg.addColorStop(0, 'rgba(114,239,221,0)'); lg.addColorStop(0.5, `rgba(114,239,221,${0.22 * p})`); lg.addColorStop(1, 'rgba(114,239,221,0)');
      c.strokeStyle = lg; c.lineWidth = 60 * p; c.beginPath(); c.moveTo(d.ax, d.ay); c.lineTo(d.bx, d.by); c.stroke();
      c.strokeStyle = `rgba(255,255,255,${0.5 * p})`; c.lineWidth = 2; c.setLineDash([6, 10]); c.beginPath(); c.moveTo(d.ax, d.ay); c.lineTo(d.bx, d.by); c.stroke(); c.setLineDash([]);
      // coil poles
      for (const [x, y] of [[d.ax, d.ay], [d.bx, d.by]]) {
        c.save(); c.translate(x, y); c.scale(p, p);
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(0, 10, 34, 20, 0, 0, TAU); c.fill();
        c.fillStyle = '#1b2230'; c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 28, 0, TAU); c.fill(); c.stroke();
        for (let k = 0; k < 4; k++) { c.strokeStyle = 'rgba(234,168,72,0.8)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 10 + k * 5, 0, TAU); c.stroke(); }
        c.fillStyle = '#72efdd'; c.beginPath(); c.arc(0, 0, 6 + 2 * Math.sin(u.t * 20), 0, TAU); c.fill();
        c.restore();
      }
      c.restore();
    },
    drawOver(c, u) {
      for (const a of u.data.arcs) VFX()?.drawLightning(c, a.x0, a.y0, a.x1, a.y1, 5, 'rgba(114,239,255,0.9)', 2.4, 0.18, 2);
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. ICE — ABSOLUTE ZERO BLIZZARD
  //    A dendritic frost front radiates from FROST across the deck. Anyone caught
  //    by the wavefront is slowed then flash-frozen; icicle stalagmites erupt in a
  //    ring and shatter into shrapnel. Out-run the front to survive.
  // ═══════════════════════════════════════════════════════════════════════════
  const ICE = {
    init(u) { u.data = { front: 0, maxR: 420, froze: false, spikes: [], shattered: false, cx: u.owner.x, cy: u.owner.y }; for (let i = 0; i < 10; i++) u.data.spikes.push({ a: (i / 10) * TAU + rnd(-0.1, 0.1), r: 150 + rnd(-20, 40), h: 0, delay: 0.3 + i * 0.05 }); cinematic({ zoom: 1.06, dilation: 0.45, hold: 0.45, letterbox: 1, tint: 'frost' }); },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      if (u.t < 0.45) return;
      d.front = Math.min(d.maxR, d.front + dt * 520);
      const de = e ? Math.hypot(e.x - d.cx, e.y - d.cy) : 1e9;
      if (e && e.hp > 0 && de < d.front) {
        e.applyStatus?.('slow', 0.5, { mult: 0.45 });
        if (!d.froze && de < d.front - 40) { d.froze = true; e.applyStatus?.('stun', 0.8); dmg(e, 60, o, 'Absolute Zero'); VFX()?.recipes.frostBloom(e.x, e.y, 70); callout(e.x, e.y - 100, 'FLASH FROZEN', '#bff5ff', 1.1); AU()?.playArenaEvent?.('cryo'); }
      }
      for (const s of d.spikes) if (u.t > d.delay + s.delay) s.h = Math.min(1, s.h + dt * 4);
      if (u.t > 2.2 && !d.shattered) {
        d.shattered = true;
        for (const s of d.spikes) {
          const x = d.cx + Math.cos(s.a) * s.r, y = d.cy + Math.sin(s.a) * s.r;
          VFX()?.recipes.crystalShatter(x, y, 10, 'cyan');
          const a = Math.atan2(e.y - y, e.x - x) + rnd(-0.25, 0.25);
          bolt(u.side, x, y, Math.cos(a) * 1250, Math.sin(a) * 1250, 18, 8, '#bff5ff', 1.2, 1.2, { shard: true });
        }
        AR()?.addScar?.('frost', d.cx, d.cy, d.maxR * 0.75);
        SH()?.spawnShockwave?.(d.cx, d.cy, 0.5, 520, 760, 1.1);
        g.cameraShake = Math.max(g.cameraShake || 0, 10);
      }
      if (u.t > 3.0) u.done = true;
      SH()?.pushLight?.(d.cx, d.cy, 0.35, 0.85, 1, d.front * 1.2, 0.55);
    },
    drawUnder(c, u) {
      const d = u.data, V = VFX();
      if (d.front <= 0) return;
      c.save();
      const fr = c.createRadialGradient(d.cx, d.cy, d.front * 0.3, d.cx, d.cy, d.front);
      fr.addColorStop(0, 'rgba(160,235,255,0.14)'); fr.addColorStop(0.85, 'rgba(190,245,255,0.3)'); fr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = fr; c.beginPath(); c.arc(d.cx, d.cy, d.front, 0, TAU); c.fill();
      // dendritic arms frozen into the floor
      c.globalAlpha = 0.75; c.translate(d.cx, d.cy);
      for (let i = 0; i < 8; i++) { c.save(); c.rotate((i / 8) * TAU + 0.2); V?.drawDendrite(c, 0, 0, d.front * 0.92, 0, 3, 'rgba(210,248,255,0.8)', 3); c.restore(); }
      c.restore();
    },
    drawOver(c, u) {
      const d = u.data;
      if (d.shattered) return;
      for (const s of d.spikes) {
        if (s.h <= 0) continue;
        const x = d.cx + Math.cos(s.a) * s.r, y = d.cy + Math.sin(s.a) * s.r;
        c.save(); c.translate(x, y); c.rotate(s.a + Math.PI / 2 + 0.15);
        c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(0, 14, 26, 10, 0, 0, TAU); c.fill();
        c.scale(1, s.h);
        VFX()?.drawShard(c, 62, 20, 195, 1);
        c.restore();
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. MIRROR — PHANTOM KALEIDOSCOPE
  //    Four mirror panes orbit MIRROR. Enemy projectiles striking a pane are
  //    duplicated back; two phantom clones strafe and fire. The finale shatters
  //    every pane into razor glass. Break panes by hitting them 3 times.
  // ═══════════════════════════════════════════════════════════════════════════
  const MIRROR = {
    init(u) { u.data = { panes: [0, 1, 2, 3].map(i => ({ a: (i / 4) * TAU, hp: 3, alive: true })), rot: 0, shotCd: 0.3, shattered: false }; cinematic({ zoom: 1.04, dilation: 0.5, hold: 0.4, letterbox: 1 }); },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      d.rot += dt * 1.6;
      const R = 125;
      for (const pn of d.panes) {
        if (!pn.alive) continue;
        const px = o.x + Math.cos(pn.a + d.rot) * R, py = o.y + Math.sin(pn.a + d.rot) * R;
        for (const p of g.projectiles || []) {
          if (!p || p.owner === o || p.__mirrored === pn || typeof p.x !== 'number') continue;
          if (Math.hypot(p.x - px, p.y - py) < 34 + (p.radius || 6)) {
            p.__mirrored = pn; pn.hp--;
            const a = Math.atan2(e.y - py, e.x - px);
            const sp = Math.max(1200, Math.hypot(p.vx || 0, p.vy || 0));
            bolt(u.side, px, py, Math.cos(a) * sp, Math.sin(a) * sp, Math.max(12, (p.damage || 14) * 1.1), 7, '#f1e8ff', 1.0, 0.8, {});
            VFX()?.recipes.impactSparks(px, py, 6, '#e9d5ff', py + 40);
            if (pn.hp <= 0) { pn.alive = false; VFX()?.recipes.crystalShatter(px, py, 16, 'violet'); callout(px, py - 50, 'PANE BROKEN', '#e9d5ff', 0.9); }
          }
        }
      }
      d.shotCd -= dt;
      if (d.shotCd <= 0 && e && e.hp > 0 && u.t > 0.5) {
        d.shotCd = 0.55;
        for (const k of [0, Math.PI]) { const cx = o.x + Math.cos(d.rot * 0.7 + k) * 95, cy = o.y + Math.sin(d.rot * 0.7 + k) * 95; const a = Math.atan2(e.y - cy, e.x - cx); bolt(u.side, cx, cy, Math.cos(a) * 1700, Math.sin(a) * 1700, 18, 7, '#f1e8ff', 1.1, 0, {}); VFX()?.recipes.muzzleFlash(cx, cy, a, '#e9d5ff'); }
      }
      if (u.t > 4.2 && !d.shattered) {
        d.shattered = true;
        for (const pn of d.panes) { if (!pn.alive) continue; const px = o.x + Math.cos(pn.a + d.rot) * R, py = o.y + Math.sin(pn.a + d.rot) * R; VFX()?.recipes.crystalShatter(px, py, 14, 'violet'); for (let s = 0; s < 3; s++) { const a = Math.atan2(e.y - py, e.x - px) + (s - 1) * 0.2; bolt(u.side, px, py, Math.cos(a) * 1500, Math.sin(a) * 1500, 16, 7, '#ffffff', 1.0, 1.5, { shard: true }); } }
        SH()?.spawnShockwave?.(o.x, o.y, 0.55, 420, 800, 1.4); AU()?.playCrystalBurst?.();
      }
      if (u.t > 4.5) u.done = true;
    },
    drawOver(c, u) {
      const d = u.data, o = u.owner, R = 125;
      // phantom clones
      for (const k of [0, Math.PI]) {
        const cx = o.x + Math.cos(d.rot * 0.7 + k) * 95, cy = o.y + Math.sin(d.rot * 0.7 + k) * 95;
        c.save(); c.translate(cx, cy); c.globalAlpha = 0.55;
        const idn = g.APEX_MIRROR_PRESENTATION?.renderIdentityBody;
        c.strokeStyle = '#f1e8ff'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.arc(0, 0, 36, 0, TAU); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(241,232,255,0.22)'; c.beginPath(); c.arc(0, 0, 30, 0, TAU); c.fill();
        c.restore();
      }
      if (d.shattered) return;
      for (const pn of d.panes) {
        if (!pn.alive) continue;
        const px = o.x + Math.cos(pn.a + d.rot) * R, py = o.y + Math.sin(pn.a + d.rot) * R;
        c.save(); c.translate(px, py); c.rotate(pn.a + d.rot + Math.PI / 2);
        const gr = c.createLinearGradient(-30, -44, 30, 44);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(200,190,230,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)');
        c.fillStyle = gr; c.strokeStyle = '#ffffff'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(-6, -46); c.lineTo(6, -46); c.lineTo(10, 46); c.lineTo(-10, 46); c.closePath(); c.fill(); c.stroke();
        // crack lines by damage
        c.strokeStyle = 'rgba(40,20,60,0.8)'; c.lineWidth = 1.2;
        for (let k = 0; k < 3 - pn.hp; k++) { c.beginPath(); c.moveTo(-4 + k * 3, -20 + k * 14); c.lineTo(5 - k * 2, 10 + k * 8); c.stroke(); }
        c.restore();
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. BOXE — DAWNBREAKER METEOR
  //    BOXE launches skyward (shadow shrinks), a reticle hunts the rival with
  //    inertia, then he slams down: crater scar, bouncing rock debris, shockwave
  //    knockback and lingering heat rings. Dodge the reticle at the last moment.
  // ═══════════════════════════════════════════════════════════════════════════
  const BOXE = {
    init(u) { u.data = { alt: 0, rx: u.enemy.x, ry: u.enemy.y, landed: false, crater: 0, heat: 0 }; u.owner.__evoAirborne = true; cinematic({ zoom: 1.06, dilation: 0.5, hold: 0.4, letterbox: 1 }); },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      if (!d.landed) {
        d.alt = u.t < 0.55 ? ease(u.t / 0.55) : 1 - ease((u.t - 0.55) / 0.5);
        const k = u.t < 0.75 ? 4.5 : 1.2; // reticle loses tracking in the final dive
        d.rx += (e.x - d.rx) * clamp(k * dt, 0, 1); d.ry += (e.y - d.ry) * clamp(k * dt, 0, 1);
        if (u.t > 0.6) { o.x += (d.rx - o.x) * clamp(6 * dt, 0, 1); o.y += (d.ry - o.y) * clamp(6 * dt, 0, 1); }
        if (u.t >= 1.05) {
          d.landed = true; o.__evoAirborne = false;
          const r = Math.hypot(e.x - o.x, e.y - o.y);
          if (e && e.hp > 0 && r < 190) { dmg(e, r < 110 ? 150 : 95, o, 'Dawnbreaker Meteor'); e.applyStatus?.('stun', r < 110 ? 0.8 : 0.4); pushBody(e, Math.atan2(e.y - o.y, e.x - o.x), 180); callout(e.x, e.y - 100, r < 110 ? 'DIRECT HIT' : 'SPLASH', '#ffb347', 1.1); }
          AR()?.addScar?.('scorch', o.x, o.y, 130);
          VFX()?.recipes.explosion(o.x, o.y, 70, o.y + 60);
          SH()?.spawnShockwave?.(o.x, o.y, 0.85, 540, 800, 1.5);
          g.cameraShake = Math.max(g.cameraShake || 0, 18); g.hitStop = Math.max(g.hitStop || 0, 0.09);
          AU()?.playMeteorSlam?.();
          cinematic({ zoom: 1.1, dilation: 0.25, hold: 0.35 });
          d.heat = 1;
        }
      } else {
        d.heat = Math.max(0, d.heat - dt * 0.8);
        if (e && e.hp > 0 && d.heat > 0 && dist(o, e) < 150) dmg(e, 28 * dt, o, 'Dawnbreaker Heat');
        if (d.heat <= 0) u.done = true;
      }
      if (d.alt > 0) SH()?.pushLight?.(o.x, o.y, 1, 0.5, 0.15, 220 + d.alt * 160, 0.9);
    },
    drawUnder(c, u) {
      const d = u.data, o = u.owner;
      if (!d.landed) {
        // reticle
        c.save(); c.translate(d.rx, d.ry); c.rotate(u.t * 3);
        c.strokeStyle = `rgba(255,107,53,${0.5 + 0.5 * Math.sin(u.t * 20)})`; c.lineWidth = 3;
        c.beginPath(); c.arc(0, 0, 120 - d.alt * 30, 0, TAU); c.stroke();
        for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(Math.cos(k * Math.PI / 2) * 60, Math.sin(k * Math.PI / 2) * 60); c.lineTo(Math.cos(k * Math.PI / 2) * 140, Math.sin(k * Math.PI / 2) * 140); c.stroke(); }
        c.restore();
        // shrinking shadow
        c.save(); c.fillStyle = `rgba(0,0,0,${0.5 - d.alt * 0.3})`; c.beginPath(); c.ellipse(o.x, o.y + 20, 70 * (1 - d.alt * 0.6), 30 * (1 - d.alt * 0.6), 0, 0, TAU); c.fill(); c.restore();
      } else if (d.heat > 0) {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) { const r = 60 + k * 40 + (1 - d.heat) * 60; c.strokeStyle = `rgba(255,120,40,${d.heat * (0.6 - k * 0.15)})`; c.lineWidth = 6; c.beginPath(); c.arc(o.x, o.y, r, 0, TAU); c.stroke(); }
        c.restore();
      }
    },
    drawOver(c, u) {
      const d = u.data, o = u.owner;
      if (d.landed) return;
      // airborne fiery glove halo rising above the actor
      c.save(); c.translate(o.x, o.y - d.alt * 140); c.globalCompositeOperation = 'lighter';
      const tex = VFX()?.tex().fire; if (tex) { c.globalAlpha = 0.9; c.drawImage(tex, -70, -70, 140, 140); }
      c.restore();
      if (Math.random() < 0.8) VFX()?.recipes.trailEmber(o.x, o.y - d.alt * 140, '#ff6b35');
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SHURI — ORBITAL SCRAP SIEGE
  //    Floor scrap assembles into three drone frames that orbit and strafe-fire.
  //    Drones are destructible (2 hits each) — shoot them down to end the siege.
  // ═══════════════════════════════════════════════════════════════════════════
  const SHURI = {
    init(u) { u.data = { drones: [0, 1, 2].map(i => ({ a: (i / 3) * TAU, hp: 2, alive: true, build: 0, fireCd: 0.6 + i * 0.2, r: 110 })), phase: 0 }; cinematic({ zoom: 1.04, dilation: 0.5, hold: 0.4, letterbox: 1 }); for (let i = 0; i < 24; i++) VFX()?.emit({ tex: 'debris', blend: 'source-over', x: u.owner.x + rnd(-200, 200), y: u.owner.y + rnd(-200, 200), vx: rnd(-40, 40), vy: rnd(-40, 40), life: 0.6, s0: 10, s1: 4, a0: 1, a1: 1, spin: 6 }); },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      d.phase += dt * 1.9;
      let anyAlive = false;
      for (const dr of d.drones) {
        if (!dr.alive) continue;
        anyAlive = true;
        dr.build = Math.min(1, dr.build + dt * 2.2);
        const dx = o.x + Math.cos(dr.a + d.phase) * dr.r, dy = o.y + Math.sin(dr.a + d.phase) * dr.r;
        // destructible
        for (const p of g.projectiles || []) {
          if (!p || p.owner === o || typeof p.x !== 'number' || p.__hitDrone === dr) continue;
          if (Math.hypot(p.x - dx, p.y - dy) < 26 + (p.radius || 6)) { p.__hitDrone = dr; dr.hp--; p.life = 0; VFX()?.recipes.impactSparks(dx, dy, 8, '#ff9f1c', dy + 30); if (dr.hp <= 0) { dr.alive = false; VFX()?.recipes.explosion(dx, dy, 34, dy + 40); callout(dx, dy - 40, 'DRONE DOWN', '#ff9f1c', 0.9); } }
        }
        if (!dr.alive) continue;
        dr.fireCd -= dt;
        if (dr.build >= 1 && dr.fireCd <= 0 && e && e.hp > 0) {
          dr.fireCd = 0.5;
          const a = Math.atan2(e.y - dy, e.x - dx) + rnd(-0.05, 0.05);
          for (let k = 0; k < 2; k++) bolt(u.side, dx, dy, Math.cos(a) * 1900, Math.sin(a) * 1900, 17, 7, '#ffc27a', 1.0, 0.6, {});
          VFX()?.recipes.muzzleFlash(dx, dy, a, '#ffb347'); AU()?.playRail?.(false);
        }
      }
      if (!anyAlive || u.t > 5.2) { u.done = true; if (!anyAlive) callout(o.x, o.y - 100, 'SIEGE BROKEN', '#72efdd', 1.0); }
    },
    drawOver(c, u) {
      const d = u.data, o = u.owner;
      for (const dr of d.drones) {
        if (!dr.alive) continue;
        const dx = o.x + Math.cos(dr.a + d.phase) * dr.r, dy = o.y + Math.sin(dr.a + d.phase) * dr.r;
        const b = ease(dr.build);
        c.save(); c.translate(dx, dy);
        c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(0, 18, 24 * b, 10 * b, 0, 0, TAU); c.fill();
        c.rotate(d.phase * 2 + dr.a); c.scale(b, b);
        // drone chassis: hex plate + four rotor arms + eye
        c.fillStyle = '#1e2430'; c.strokeStyle = '#ff9f1c'; c.lineWidth = 2;
        c.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; if (k === 0) c.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); else c.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); } c.closePath(); c.fill(); c.stroke();
        for (let k = 0; k < 4; k++) { c.save(); c.rotate(k * Math.PI / 2 + Math.PI / 4); c.fillStyle = '#2b3240'; c.fillRect(16, -3, 20, 6); c.strokeStyle = 'rgba(114,239,221,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(40, 0, 10, 0, TAU); c.stroke(); c.restore(); }
        c.fillStyle = dr.hp > 1 ? '#72efdd' : '#ff4d4d'; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill();
        c.restore();
        SH()?.pushLight?.(dx, dy, 1, 0.6, 0.2, 90, 0.5);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. BLACK_HOLE — QUASAR SINGULARITY JET
  //    The accretion disk collapses, floor weapons and the rival are dragged
  //    inward, then twin polar jets erupt and sweep. A sweep indicator shows the
  //    direction of rotation; move perpendicular / parry the jet edge to survive.
  // ═══════════════════════════════════════════════════════════════════════════
  const BLACK_HOLE = {
    init(u) { u.data = { collapse: 0, ang: Math.atan2(u.enemy.y - u.owner.y, u.enemy.x - u.owner.x), dir: Math.random() < 0.5 ? 1 : -1, jet: 0, dmgCd: 0 }; cinematic({ zoom: 1.08, dilation: 0.4, hold: 0.55, letterbox: 1, tint: 'void' }); },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      if (u.t < 0.7) { d.collapse = u.t / 0.7; if (Math.random() < 0.8) VFX()?.emit({ tex: 'glow', x: o.x + Math.cos(u.t * 30 + Math.random() * TAU) * 200, y: o.y + Math.sin(u.t * 30 + Math.random() * TAU) * 200, vx: 0, vy: 0, life: 0.25, s0: 10, s1: 2, tint: '#c77dff' }); return; }
      d.jet = Math.min(1, d.jet + dt * 5);
      d.ang += d.dir * dt * 1.25;
      // gravitational pull on everything
      if (e && e.hp > 0) { const a = Math.atan2(o.y - e.y, o.x - e.x); const k = clamp(1 - dist(o, e) / 520, 0, 1) * 190; pushBody(e, a, k * dt); }
      for (const sl of g.APEX_ARSENAL?.state?.slots || []) if (sl && sl.phase === 'REVEALED') { const a = Math.atan2(o.y - sl.y, o.x - sl.x); sl.x += Math.cos(a) * 160 * dt; sl.y += Math.sin(a) * 160 * dt; }
      for (const p of g.projectiles || []) if (p && p.owner !== o && typeof p.vx === 'number') { const a = Math.atan2(o.y - p.y, o.x - p.x); p.vx += Math.cos(a) * 2600 * dt; p.vy += Math.sin(a) * 2600 * dt; }
      d.dmgCd -= dt;
      if (e && e.hp > 0 && d.dmgCd <= 0) {
        for (const sgn of [1, -1]) {
          const bx = o.x + Math.cos(d.ang) * 820 * sgn, by = o.y + Math.sin(d.ang) * 820 * sgn;
          if (segDist(e.x, e.y, o.x, o.y, bx, by) < (e.radius || 75) + 26) {
            const st = CB()?.getState?.()?.sides?.[1 - u.side];
            if (st && st.aegisWindow > 0.03) { d.dmgCd = 0.5; callout(e.x, e.y - 100, 'JET DEFLECTED', '#ffd166', 1.0); }
            else { d.dmgCd = 0.2; dmg(e, 26, o, 'Quasar Jet'); VFX()?.recipes.plasmaBurst(e.x, e.y, 60, '#d9a6ff'); }
          }
        }
      }
      SH()?.pushLens?.(o.x, o.y, 260, 0.55); SH()?.pushLight?.(o.x, o.y, 0.75, 0.3, 1, 420, 1.1);
      if (u.t > 3.0) u.done = true;
    },
    drawUnder(c, u) {
      const d = u.data, o = u.owner;
      if (u.t < 0.7) return;
      // sweep direction indicator
      c.save(); c.translate(o.x, o.y); c.globalAlpha = 0.35; c.strokeStyle = '#c77dff'; c.lineWidth = 2; c.setLineDash([8, 10]);
      c.beginPath(); c.arc(0, 0, 300, d.ang, d.ang + d.dir * 0.9, d.dir < 0); c.stroke(); c.setLineDash([]); c.restore();
    },
    drawOver(c, u) {
      const d = u.data, o = u.owner;
      if (u.t < 0.7) {
        c.save(); c.translate(o.x, o.y); c.strokeStyle = `rgba(199,125,255,${0.6 * d.collapse})`; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 220 * (1 - d.collapse) + 40, 0, TAU); c.stroke(); c.restore();
        return;
      }
      c.save(); c.translate(o.x, o.y); c.rotate(d.ang); c.globalCompositeOperation = 'lighter';
      for (const sgn of [1, -1]) {
        c.save(); if (sgn < 0) c.rotate(Math.PI);
        const w = 26 * d.jet;
        const qg = c.createLinearGradient(0, -w, 0, w);
        qg.addColorStop(0, 'rgba(181,23,158,0)'); qg.addColorStop(0.3, 'rgba(199,125,255,0.75)'); qg.addColorStop(0.5, 'rgba(255,245,255,1)'); qg.addColorStop(0.7, 'rgba(199,125,255,0.75)'); qg.addColorStop(1, 'rgba(181,23,158,0)');
        c.fillStyle = qg; c.fillRect(50, -w, 780, w * 2);
        // helical plasma filaments
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5; c.beginPath();
        for (let x = 50; x < 820; x += 8) { const y = Math.sin(x * 0.05 - u.t * 30) * w * 0.7; if (x === 50) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
        c.restore();
      }
      c.restore();
      if (Math.random() < 0.7) for (const sgn of [1, -1]) { const dd = rnd(120, 780); VFX()?.emit({ tex: 'glow', x: o.x + Math.cos(d.ang) * dd * sgn, y: o.y + Math.sin(d.ang) * dd * sgn, vx: Math.cos(d.ang + Math.PI / 2) * rnd(-120, 120), vy: Math.sin(d.ang + Math.PI / 2) * rnd(-120, 120), life: 0.3, s0: 16, s1: 2, tint: '#e0aaff' }); }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. TIME — CHRONO STASIS CATHEDRAL
  //    A clock-face cathedral dome expands. Inside, enemy projectiles freeze in
  //    place and the rival is dilated. When the bell tolls, every frozen shot is
  //    reversed back toward its shooter. Escape the dome before the toll.
  // ═══════════════════════════════════════════════════════════════════════════
  const TIME = {
    init(u) { u.data = { r: 0, maxR: 320, cx: u.owner.x, cy: u.owner.y, frozen: [], tolled: false, pillars: 12 }; cinematic({ zoom: 1.06, dilation: 0.45, hold: 0.45, letterbox: 1, tint: 'chrono' }); u.owner.hp = Math.min(u.owner.maxHp, u.owner.hp + 60); },
    step(u, dt) {
      const d = u.data, o = u.owner, e = u.enemy;
      d.r = Math.min(d.maxR, d.r + dt * 900);
      if (!d.tolled) {
        for (const p of g.projectiles || []) {
          if (!p || p.owner === o || typeof p.vx !== 'number' || p.__stasis) continue;
          if (Math.hypot(p.x - d.cx, p.y - d.cy) < d.r) { p.__stasis = { vx: p.vx, vy: p.vy }; p.vx = 0; p.vy = 0; if (typeof p.life === 'number') p.life = Math.max(p.life, 3.2); d.frozen.push(p); VFX()?.emit({ tex: 'ring', x: p.x, y: p.y, life: 0.4, s0: 10, s1: 60, tint: '#72f5ff' }); }
        }
        if (u.t > 2.5) {
          d.tolled = true;
          for (const p of d.frozen) {
            if (!p || (p.life !== undefined && p.life <= 0)) continue;
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            const sp = Math.max(1100, Math.hypot(p.__stasis.vx, p.__stasis.vy));
            p.owner = o; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.color = '#ffd166'; p.heavy = true;
          }
          if (d.frozen.length) callout(d.cx, d.cy - d.maxR - 30, `TOLL · ${d.frozen.length} SHOTS REVERSED`, '#ffd166', 1.15);
          SH()?.spawnShockwave?.(d.cx, d.cy, 0.7, d.maxR * 1.6, 900, 1.4); AU()?.playBell?.();
          g.cameraShake = Math.max(g.cameraShake || 0, 9);
          cinematic({ zoom: 1.08, dilation: 0.3, hold: 0.3 });
        }
      }
      if (u.t > 3.2) u.done = true;
      SH()?.pushLight?.(d.cx, d.cy, 0.3, 0.8, 1, d.r * 1.3, 0.5);
    },
    drawUnder(c, u) {
      const d = u.data;
      c.save(); c.translate(d.cx, d.cy);
      const fg = c.createRadialGradient(0, 0, d.r * 0.2, 0, 0, d.r);
      fg.addColorStop(0, 'rgba(76,201,240,0.05)'); fg.addColorStop(0.9, 'rgba(76,201,240,0.18)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = fg; c.beginPath(); c.arc(0, 0, d.r, 0, TAU); c.fill();
      // clock face
      c.strokeStyle = 'rgba(245,203,110,0.75)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, d.r, 0, TAU); c.stroke();
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; c.lineWidth = k % 3 === 0 ? 4 : 2; c.beginPath(); c.moveTo(Math.cos(a) * d.r * 0.9, Math.sin(a) * d.r * 0.9); c.lineTo(Math.cos(a) * d.r, Math.sin(a) * d.r); c.stroke(); }
      // hands: minute races toward the toll
      const prog = clamp(u.t / 2.5, 0, 1);
      c.strokeStyle = '#72f5ff'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(prog * TAU - Math.PI / 2) * d.r * 0.8, Math.sin(prog * TAU - Math.PI / 2) * d.r * 0.8); c.stroke();
      c.strokeStyle = '#f5cb6e'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(prog * 0.5 - Math.PI / 2) * d.r * 0.5, Math.sin(prog * 0.5 - Math.PI / 2) * d.r * 0.5); c.stroke();
      c.restore();
    },
    drawOver(c, u) {
      const d = u.data;
      // 12 cathedral pillars (gears) along the rim
      c.save(); c.translate(d.cx, d.cy);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU + u.t * 0.2; const x = Math.cos(a) * d.r, y = Math.sin(a) * d.r;
        c.save(); c.translate(x, y); c.rotate(u.t * (k % 2 ? 2 : -2));
        c.fillStyle = '#1a1d26'; c.strokeStyle = '#eab957'; c.lineWidth = 2;
        c.beginPath(); for (let t = 0; t < 8; t++) { const ta = (t / 8) * TAU; const rr = t % 2 ? 9 : 13; if (t === 0) c.moveTo(Math.cos(ta) * rr, Math.sin(ta) * rr); else c.lineTo(Math.cos(ta) * rr, Math.sin(ta) * rr); } c.closePath(); c.fill(); c.stroke();
        c.restore();
      }
      c.restore();
      // frozen shots shimmer
      for (const p of d.frozen) { if (!p || p.vx !== 0) continue; c.save(); c.globalAlpha = 0.6 + 0.4 * Math.sin(u.t * 14); c.strokeStyle = '#72f5ff'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, (p.radius || 7) + 6, 0, TAU); c.stroke(); c.restore(); }
    },
  };

  const KITS = { ROBOT, HUNTER, CRYSTAL, MAGNET, ICE, MIRROR, BOXE, SHURI, BLACK_HOLE, TIME };

  const api = {
    cast(side, heroId, owner, enemy, meta) {
      const kit = KITS[heroId] || KITS.ROBOT;
      const u = make(heroId, side, owner, enemy, meta);
      u.kit = kit;
      kit.init(u);
      active.push(u);
      return u;
    },
    step(dt) {
      for (let i = active.length - 1; i >= 0; i--) {
        const u = active[i];
        u.t += dt;
        try { u.kit.step(u, dt); } catch (err) { console.warn('[ult]', u.kind, err); u.done = true; }
        if (u.done || !u.owner || u.owner.hp <= 0) { if (u.owner) { u.owner.__evoCloak = false; u.owner.__evoAirborne = false; } active.splice(i, 1); }
      }
    },
    drawUnder(c) { for (const u of active) if (u.kit.drawUnder) { try { u.kit.drawUnder(c, u); } catch (_) {} } },
    drawOver(c) { for (const u of active) if (u.kit.drawOver) { try { u.kit.drawOver(c, u); } catch (_) {} } },
    activeCount: () => active.length,
    isActive: (side) => active.some(u => u.side === side),
    clear() { for (const u of active) if (u.owner) { u.owner.__evoCloak = false; u.owner.__evoAirborne = false; } active.length = 0; },
  };
  g.APEX_EVOLUTION_ULTIMATES = api;
  g.apexEvolutionUltimates = 'ready';
})(window);
