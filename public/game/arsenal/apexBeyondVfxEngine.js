/* =============================================================================
 * APEX CHAOS — BEYOND Multi-Layer Combat VFX & Camera Cinema Engine
 * Structured fighting-game presentation:
 *   Anticipation -> Contact -> Impact Frame -> Aftermath
 * Includes wall-bouncing metallic sparks, tumbling faceted debris shards,
 * directional dust plumes, angled slash wedges, double-ring refractions,
 * ejected brass casings, grounded fighter shadows & kinetic afterimages,
 * holographic weapon drop-pod highlights, dynamic combat camera framing,
 * and an iconic K.O. finisher impact freeze-frame.
 * ========================================================================== */
(function installApexBeyondVfx(global) {
  'use strict';
  if (global.APEX_BEYOND_VFX) return;

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeOutBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const u = clamp(t, 0, 1) - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
  };

  // Bounded pools (zero GC spikes, smooth 60fps desktop & mobile)
  const sparks = [];
  const shards = [];
  const plumes = [];
  const slashes = [];
  const rings = [];
  const casings = [];
  const callouts = [];
  const afterimages = [];
  const skyBeams = [];
  const hitFlashes = new WeakMap();

  const MAX_SPARKS = 140;
  const MAX_SHARDS = 56;
  const MAX_PLUMES = 42;
  const MAX_SLASHES = 28;
  const MAX_RINGS = 28;
  const MAX_CASINGS = 32;
  const MAX_AFTERIMAGES = 28;

  // Dynamic camera director state
  const cam = {
    focusX: 500,
    focusY: 500,
    targetFocusX: 500,
    targetFocusY: 500,
    kickX: 0,
    kickY: 0,
    extraZoom: 0,
    targetExtraZoom: 0,
    enabled: true,
  };

  // Iconic K.O. Finisher Cinema state
  const ko = {
    active: false,
    elapsed: 0,
    x: 500,
    y: 500,
    winnerColor: '#f5c249',
    winnerName: '',
    impactFrameDuration: 0.115,
    totalDuration: 2.35,
  };

  let clock = 0;
  let afterimageSampleAcc = 0;

  function reset() {
    sparks.length = 0;
    shards.length = 0;
    plumes.length = 0;
    slashes.length = 0;
    rings.length = 0;
    casings.length = 0;
    callouts.length = 0;
    afterimages.length = 0;
    skyBeams.length = 0;
    cam.focusX = cam.targetFocusX = 500;
    cam.focusY = cam.targetFocusY = 500;
    cam.kickX = cam.kickY = 0;
    cam.extraZoom = cam.targetExtraZoom = 0;
    ko.active = false;
    ko.elapsed = 0;
    afterimageSampleAcc = 0;
  }

  // ---- Emitters ----
  function emitSparks(x, y, count, opts = {}) {
    const color = opts.color || '#ffb84d';
    const core = opts.core || '#fff8e1';
    const baseAngle = opts.angle ?? 0;
    const spread = opts.spread ?? TAU;
    const speedMin = opts.speedMin ?? 220;
    const speedMax = opts.speedMax ?? 680;
    const lifeMin = opts.lifeMin ?? 0.22;
    const lifeMax = opts.lifeMax ?? 0.52;
    const width = opts.width ?? 2.4;

    const pScale = global.APEX_GFX_QUALITY ? global.APEX_GFX_QUALITY.particleScale() : 1.0;
    const scaledCount = Math.max(1, Math.round(count * pScale));
    const cap = Math.max(24, Math.round(MAX_SPARKS * pScale));

    for (let i = 0; i < scaledCount; i++) {
      const a = baseAngle + (Math.random() - 0.5) * spread;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      const item = {
        x, y,
        px: x, py: y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life, maxLife: life,
        color, core,
        width: width * (0.7 + Math.random() * 0.6),
        drag: opts.drag ?? 0.91,
      };
      if (sparks.length >= cap) sparks[(Math.random() * sparks.length) | 0] = item;
      else sparks.push(item);
    }
  }

  function emitShards(x, y, count, opts = {}) {
    const color = opts.color || '#c7d0db';
    const edge = opts.edge || '#1a2028';
    const baseAngle = opts.angle ?? 0;
    const spread = opts.spread ?? TAU;
    const speedMin = opts.speedMin ?? 140;
    const speedMax = opts.speedMax ?? 460;
    const size = opts.size ?? 8;
    const pScale = global.APEX_GFX_QUALITY ? global.APEX_GFX_QUALITY.particleScale() : 1.0;
    const scaledCount = Math.max(1, Math.round(count * pScale));
    const cap = Math.max(12, Math.round(MAX_SHARDS * pScale));

    for (let i = 0; i < scaledCount; i++) {
      const a = baseAngle + (Math.random() - 0.5) * spread;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      const life = 0.35 + Math.random() * 0.45;
      const r = size * (0.55 + Math.random() * 0.75);
      // Pre-bake 4 irregular facet vertices
      const pts = [];
      for (let k = 0; k < 4; k++) {
        const ka = (k * TAU) / 4 + (Math.random() - 0.5) * 0.45;
        const kr = r * (0.55 + Math.random() * 0.55);
        pts.push([Math.cos(ka) * kr, Math.sin(ka) * kr]);
      }
      const item = {
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        rot: Math.random() * TAU,
        vrot: (Math.random() - 0.5) * 20,
        life, maxLife: life,
        color, edge, pts,
      };
      if (shards.length >= cap) shards[(Math.random() * shards.length) | 0] = item;
      else shards.push(item);
    }
  }

  function emitPlumes(x, y, count, opts = {}) {
    const color = opts.color || 'rgba(182,190,200,0.42)';
    const rim = opts.rim || 'rgba(255,232,196,0.22)';
    const baseAngle = opts.angle ?? 0;
    const spread = opts.spread ?? TAU;
    const speed = opts.speed ?? 150;
    const radius = opts.radius ?? 24;
    const pScale = global.APEX_GFX_QUALITY ? global.APEX_GFX_QUALITY.particleScale() : 1.0;
    const scaledCount = Math.max(1, Math.round(count * pScale));
    const cap = Math.max(10, Math.round(MAX_PLUMES * pScale));

    for (let i = 0; i < scaledCount; i++) {
      const a = baseAngle + (Math.random() - 0.5) * spread;
      const spd = speed * (0.35 + Math.random() * 0.85);
      const life = 0.32 + Math.random() * 0.36;
      const item = {
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r0: radius * (0.4 + Math.random() * 0.35),
        r1: radius * (1.25 + Math.random() * 0.75),
        life, maxLife: life,
        color, rim,
      };
      if (plumes.length >= cap) plumes[(Math.random() * plumes.length) | 0] = item;
      else plumes.push(item);
    }
  }

  function emitSlashWedge(x, y, angle, opts = {}) {
    if (slashes.length >= MAX_SLASHES) slashes.shift();
    const life = opts.life ?? 0.19;
    slashes.push({
      x, y, angle,
      len: opts.len ?? 96,
      width: opts.width ?? 22,
      color: opts.color || '#ffd978',
      core: opts.core || '#ffffff',
      cross: !!opts.cross,
      life, maxLife: life,
    });
  }

  function emitRing(x, y, maxR, color = '#ffd978', opts = {}) {
    if (rings.length >= MAX_RINGS) rings.shift();
    const life = opts.life ?? 0.34;
    rings.push({
      x, y,
      r0: opts.r0 ?? 12,
      maxR,
      color,
      lineWidth: opts.lineWidth ?? 6,
      doubleRing: opts.doubleRing !== false,
      life, maxLife: life,
    });
  }

  function emitCasing(x, y, dirAngle) {
    if (casings.length >= MAX_CASINGS) casings.shift();
    const ejectAngle = dirAngle + (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.52 + (Math.random() - 0.5) * 0.35);
    const spd = 110 + Math.random() * 140;
    casings.push({
      x, y,
      vx: Math.cos(ejectAngle) * spd,
      vy: Math.sin(ejectAngle) * spd,
      rot: Math.random() * TAU,
      vrot: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 16),
      z: 10, vz: 95 + Math.random() * 65,
      bounced: false,
      life: 0.75, maxLife: 0.75,
    });
  }

  function emitSkyBeam(x, y, color = '#ff5244', duration = 0.65) {
    skyBeams.push({ x, y, color, life: duration, maxLife: duration });
    global.APEX_BEYOND_ARENA?.addLight?.(x, y, 220, color, 0.65, duration);
  }

  function emitCallout(x, y, text, color = '#ffd86b', accent = '#10141b', scale = 1) {
    if (callouts.length > 10) callouts.shift();
    callouts.push({
      x: clamp(x, 120, 880),
      y: clamp(y, 90, 910),
      text,
      color,
      accent,
      scale,
      life: 0.92,
      maxLife: 0.92,
      vy: -54,
    });
  }

  // ---- High-level Choreographed Combat Moments ----
  function onHitImpact(opts) {
    const {
      x, y, angle = 0, damage = 20, critical = false,
      color = '#ffb94a', victim = null, heavy = false,
    } = opts || {};
    const power = clamp(damage / 75, 0.35, 2.2) * (critical ? 1.35 : 1) * (heavy ? 1.25 : 1);

    if (victim) {
      hitFlashes.set(victim, { timer: critical || heavy ? 0.14 : 0.085, color: critical ? '#fff4b0' : '#ffffff' });
    }

    // Directional camera recoil aligned with hit vector
    addCameraKick(Math.cos(angle) * 7.5 * power, Math.sin(angle) * 7.5 * power, heavy || critical ? 0.028 : 0.01);

    // Dynamic floor lighting cast onto steel plates
    global.APEX_BEYOND_ARENA?.addLight?.(x, y, 95 + 75 * power, critical ? '#ffe07d' : color, 0.32 + 0.18 * power, 0.2);

    // Layered impact craft: wedge -> hot sparks -> faceted shards -> subtle smoke
    emitSlashWedge(x, y, angle, {
      len: 64 + 46 * power,
      width: 14 + 10 * power,
      color: critical ? '#ffe57f' : color,
      cross: critical || heavy,
      life: 0.16 + 0.04 * power,
    });
    emitSparks(x, y, Math.round(7 + 8 * power), {
      angle,
      spread: critical ? TAU : 1.45,
      speedMin: 210,
      speedMax: 520 + 200 * power,
      color: critical ? '#ffe382' : color,
      width: critical ? 3.0 : 2.3,
    });
    if (power > 0.72) {
      emitShards(x, y, Math.round(3 + 4 * power), { angle, spread: 1.8, color: '#d9e0e8', size: 6.5 });
      emitRing(x, y, 76 + 52 * power, critical ? '#ffe07a' : color, { lineWidth: critical ? 7 : 5, life: 0.28 });
    }
    if (heavy || damage >= 85) {
      emitPlumes(x, y, 4, { angle: angle + Math.PI, spread: 1.5, speed: 120, radius: 26 });
      global.APEX_BEYOND_ARENA?.stampScorch?.(x, y, 28 + 18 * power, color);
      global.APEX_BEYOND_ARENA?.stampFracture?.(x, y, angle, 0.75 * power);
    }
  }

  function onWeaponClash(x, y, heavy = false) {
    global.APEX_BEYOND_AUDIO?.playClash?.(heavy);
    global.APEX_BEYOND_ARENA?.addLight?.(x, y, heavy ? 240 : 175, '#fff0b3', 0.72, 0.32);
    global.APEX_BEYOND_ARENA?.stampFracture?.(x, y, Math.random() * TAU, heavy ? 1.15 : 0.8);
    emitSlashWedge(x, y, Math.random() * Math.PI, {
      len: heavy ? 165 : 120,
      width: heavy ? 30 : 22,
      color: '#ffdf78',
      cross: true,
      life: 0.24,
    });
    emitRing(x, y, heavy ? 190 : 138, '#ffe694', { lineWidth: heavy ? 9 : 6, life: 0.38 });
    emitSparks(x, y, heavy ? 32 : 20, {
      spread: TAU,
      speedMin: 280,
      speedMax: 780,
      color: '#ffd264',
      width: 3.1,
    });
    emitShards(x, y, heavy ? 10 : 6, { spread: TAU, color: '#eef4fa', size: 7.5 });
    emitCallout(x, y - 48, heavy ? 'HEAVY CLASH!' : 'STEEL CLASH!', '#ffe582', '#17120a', heavy ? 1.15 : 1.0);
    addCameraKick((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, heavy ? 0.055 : 0.032);
  }

  function onPerfectDeflect(x, y, angle) {
    global.APEX_BEYOND_AUDIO?.playDeflect?.();
    global.APEX_BEYOND_ARENA?.addLight?.(x, y, 220, '#5ef7c2', 0.75, 0.34);
    emitSlashWedge(x, y, angle, { len: 145, width: 26, color: '#5ef7c2', core: '#ffffff', cross: true, life: 0.25 });
    emitRing(x, y, 165, '#66ffd0', { lineWidth: 8, life: 0.36 });
    emitSparks(x, y, 24, { angle, spread: 1.9, speedMin: 300, speedMax: 740, color: '#68ffd2', width: 2.8 });
    emitCallout(x, y - 56, 'PERFECT DEFLECT!', '#6effd3', '#091a16', 1.12);
    addCameraKick(Math.cos(angle) * 12, Math.sin(angle) * 12, 0.048);
  }

  function onWallSlam(x, y, side, strength = 1, color = '#ffaa44') {
    const normalAngle = side === 'left' ? 0 : side === 'right' ? Math.PI : side === 'top' ? Math.PI / 2 : -Math.PI / 2;
    global.APEX_BEYOND_ARENA?.triggerWallImpact?.(side, (side === 'left' || side === 'right') ? y : x, strength, color);
    global.APEX_BEYOND_ARENA?.stampFracture?.(x, y, normalAngle, 0.95 * strength, 'rgba(255,212,150,0.22)');
    emitSparks(x, y, Math.round(14 + 10 * strength), {
      angle: normalAngle,
      spread: 2.1,
      speedMin: 200,
      speedMax: 640,
      color,
      width: 2.8,
    });
    emitShards(x, y, Math.round(5 + 4 * strength), { angle: normalAngle, spread: 1.9, color: '#9ca8b8', size: 7.5 });
    emitPlumes(x, y, 5, { angle: normalAngle, spread: 1.8, speed: 165, radius: 28 });
    emitRing(x, y, 95 + 45 * strength, color, { lineWidth: 6.5, life: 0.3 });
    if (strength >= 0.85) {
      global.APEX_BEYOND_AUDIO?.playWallSlam?.(strength);
      emitCallout(x + Math.cos(normalAngle) * 58, y + Math.sin(normalAngle) * 40, 'WALL SLAM!', '#ffb552', '#1a1108', 1.05);
      addCameraKick(-Math.cos(normalAngle) * 14 * strength, -Math.sin(normalAngle) * 14 * strength, 0.032);
    }
  }

  function onImpulseBurst(f, angle, isOverdrive = false) {
    global.APEX_BEYOND_AUDIO?.playImpulse?.(isOverdrive ? 1.25 : 1);
    const col = isOverdrive ? '#ffd25a' : '#63e2ff';
    global.APEX_BEYOND_ARENA?.addLight?.(f.x, f.y, 155, col, 0.55, 0.24);
    global.APEX_BEYOND_ARENA?.stampSkid?.(
      f.x - Math.cos(angle) * 26,
      f.y - Math.sin(angle) * 26,
      f.x + Math.cos(angle) * 28,
      f.y + Math.sin(angle) * 28,
      10,
      'rgba(10,12,16,0.24)'
    );
    emitRing(f.x, f.y, 92, col, { lineWidth: 5.5, life: 0.24 });
    emitSlashWedge(f.x, f.y, angle, { len: 108, width: 20, color: col, life: 0.16 });
    emitSparks(f.x, f.y, 14, {
      angle: angle + Math.PI,
      spread: 1.15,
      speedMin: 220,
      speedMax: 520,
      color: col,
      width: 2.3,
    });
    emitPlumes(f.x, f.y, 4, { angle: angle + Math.PI, spread: 1.0, speed: 130, radius: 22 });
  }

  function onOverdriveStart(f) {
    global.APEX_BEYOND_AUDIO?.playOverdrive?.();
    global.APEX_BEYOND_ARENA?.addLight?.(f.x, f.y, 260, '#ffd452', 0.85, 0.45);
    global.APEX_BEYOND_ARENA?.triggerPowerDip?.(0.28);
    emitRing(f.x, f.y, 220, '#ffd866', { lineWidth: 9, life: 0.48 });
    emitSlashWedge(f.x, f.y, 0, { len: 170, width: 24, color: '#ffe484', cross: true, life: 0.28 });
    emitSparks(f.x, f.y, 30, { spread: TAU, speedMin: 240, speedMax: 680, color: '#ffd966', width: 3 });
    emitCallout(f.x, f.y - f.radius - 36, 'APEX OVERDRIVE!', '#ffe275', '#1b1407', 1.18);
    addCameraKick(0, -10, 0.048);
  }

  function triggerKoCinema(loser, winner) {
    if (ko.active) return;
    ko.active = true;
    ko.elapsed = 0;
    ko.x = loser ? loser.x : 500;
    ko.y = loser ? loser.y : 500;
    ko.winnerColor = (winner && winner.color) || '#f5c249';
    ko.winnerName = (winner && winner.name) || 'VICTORY';

    // Clear minor mid-fight callouts so the K.O. climax reads with cinema clarity!
    callouts.length = 0;

    global.APEX_BEYOND_AUDIO?.playKoFinisher?.();
    global.APEX_BEYOND_ARENA?.addLight?.(ko.x, ko.y, 240, '#ffcf66', 0.48, 0.55);
    global.APEX_BEYOND_ARENA?.stampScorch?.(ko.x, ko.y, 82, '#ffb84d');
    global.APEX_BEYOND_ARENA?.stampFracture?.(ko.x, ko.y, 0, 1.55);

    emitRing(ko.x, ko.y, 290, '#ffd466', { lineWidth: 10, life: 0.62 });
    emitSlashWedge(ko.x, ko.y, Math.PI * 0.25, { len: 250, width: 32, color: '#ffcf5c', cross: true, life: 0.36 });
    emitSparks(ko.x, ko.y, 44, { spread: TAU, speedMin: 300, speedMax: 920, color: '#ffbe47', width: 3.4, lifeMax: 0.85 });
    emitShards(ko.x, ko.y, 16, { spread: TAU, speedMin: 200, speedMax: 640, color: '#39424f', edge: '#ffba52', size: 10 });
    emitPlumes(ko.x, ko.y, 7, { spread: TAU, speed: 200, radius: 38 });

    cam.targetFocusX = clamp(ko.x, 360, 640);
    cam.targetFocusY = clamp(ko.y, 360, 640);
    cam.targetExtraZoom = 0.14;
  }

  function addCameraKick(kx, ky, zoomPulse = 0) {
    cam.kickX = clamp(cam.kickX + kx, -22, 22);
    cam.kickY = clamp(cam.kickY + ky, -22, 22);
    cam.extraZoom = Math.min(0.11, cam.extraZoom + zoomPulse);
  }

  function setCameraDirectorEnabled(enabled) {
    cam.enabled = !!enabled;
  }
  function isCameraDirectorEnabled() {
    return cam.enabled;
  }

  function getCameraTransform(baseZoom, baseShakeX, baseShakeY) {
    if (!cam.enabled && !ko.active) {
      return { focusX: 500, focusY: 500, zoom: baseZoom, offsetX: baseShakeX, offsetY: baseShakeY };
    }
    const z = clamp(baseZoom + cam.extraZoom, 1.0, 1.22);
    // Keep arena walls safely visible when zooming subtly
    const maxPan = Math.max(0, 500 - 500 / z);
    const fx = clamp(cam.focusX, 500 - maxPan, 500 + maxPan);
    const fy = clamp(cam.focusY, 500 - maxPan, 500 + maxPan);
    return {
      focusX: fx,
      focusY: fy,
      zoom: z,
      offsetX: baseShakeX + cam.kickX,
      offsetY: baseShakeY + cam.kickY,
    };
  }

  function tick(dt, rawDt) {
    const realDt = rawDt || dt;
    clock += realDt;
    const S = global.GAME_SIZE || 1000;
    const M = 34;

    // Camera director smooth tracking
    const fighters = global.fighters;
    if (ko.active) {
      ko.elapsed += realDt;
      cam.focusX = lerp(cam.focusX, cam.targetFocusX, Math.min(1, realDt * 8));
      cam.focusY = lerp(cam.focusY, cam.targetFocusY, Math.min(1, realDt * 8));
      const koZoomCurve = ko.elapsed < 0.7 ? 0.14 : Math.max(0, 0.14 * (1 - (ko.elapsed - 0.7) / 1.4));
      cam.extraZoom = lerp(cam.extraZoom, koZoomCurve, Math.min(1, realDt * 7));
      if (ko.elapsed >= ko.totalDuration) ko.active = false;
    } else if (cam.enabled && Array.isArray(fighters) && fighters[0] && fighters[1] && fighters[0].hp > 0 && fighters[1].hp > 0) {
      const f0 = fighters[0], f1 = fighters[1];
      const midX = (f0.x + f1.x) * 0.5;
      const midY = (f0.y + f1.y) * 0.5;
      const sep = Math.hypot(f1.x - f0.x, f1.y - f0.y);
      // Subtle micro-zoom when fighters lock into intense close-quarters clashes
      const closeBias = clamp((320 - sep) / 280, 0, 1) * 0.045;
      cam.targetFocusX = lerp(500, midX, 0.45);
      cam.targetFocusY = lerp(500, midY, 0.45);
      cam.focusX = lerp(cam.focusX, cam.targetFocusX, Math.min(1, realDt * 3.8));
      cam.focusY = lerp(cam.focusY, cam.targetFocusY, Math.min(1, realDt * 3.8));
      cam.extraZoom = lerp(cam.extraZoom, closeBias, Math.min(1, realDt * 3.5));
    } else {
      cam.focusX = lerp(cam.focusX, 500, Math.min(1, realDt * 4));
      cam.focusY = lerp(cam.focusY, 500, Math.min(1, realDt * 4));
      cam.extraZoom = lerp(cam.extraZoom, 0, Math.min(1, realDt * 4));
    }
    cam.kickX *= Math.pow(0.001, realDt);
    cam.kickY *= Math.pow(0.001, realDt);

    // Sample kinetic afterimage trails for fast-moving / Impulse / Overdrive fighters
    afterimageSampleAcc += dt;
    if (afterimageSampleAcc >= 0.028 && Array.isArray(fighters)) {
      afterimageSampleAcc = 0;
      const combat = global.APEX_BEYOND_COMBAT?.getState?.();
      for (let i = 0; i < fighters.length; i++) {
        const f = fighters[i];
        if (!f || f.hp <= 0) continue;
        const st = combat?.sides?.[i];
        const fm = f.__hrFrameMotion;
        const spd = fm ? Math.hypot((fm.locomotionVx || 0) + (fm.engineForceVx || 0), (fm.locomotionVy || 0) + (fm.engineForceVy || 0)) : 0;
        const fast = spd > 630 || (st && (st.impulseTimer > 0 || st.overdriveTimer > 0));
        if (fast) {
          if (afterimages.length >= MAX_AFTERIMAGES) afterimages.shift();
          afterimages.push({
            x: f.x,
            y: f.y,
            r: f.radius,
            angle: Math.atan2(f.dir?.y || 0, f.dir?.x || 1),
            color: (st && st.overdriveTimer > 0) ? '#ffd55c' : (st && st.deflectWindow > 0) ? '#5ef7c2' : (i === 0 ? '#b2ff3a' : '#86dcff'),
            life: 0.22,
            maxLife: 0.22,
          });
        }
        const hf = hitFlashes.get(f);
        if (hf && hf.timer > 0) hf.timer = Math.max(0, hf.timer - realDt);
      }
    }

    // Update pools (wall-bouncing sparks, tumbling shards, dust plumes, slashes, rings, casings)
    let w = 0;
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      s.px = s.x; s.py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // Bounce cleanly off arena steel walls!
      if (s.x < M) { s.x = M; s.vx = Math.abs(s.vx) * 0.65; }
      else if (s.x > S - M) { s.x = S - M; s.vx = -Math.abs(s.vx) * 0.65; }
      if (s.y < M) { s.y = M; s.vy = Math.abs(s.vy) * 0.65; }
      else if (s.y > S - M) { s.y = S - M; s.vy = -Math.abs(s.vy) * 0.65; }
      const damp = Math.pow(s.drag, dt * 60);
      s.vx *= damp; s.vy *= damp;
      s.life -= dt;
      if (s.life > 0) sparks[w++] = s;
    }
    sparks.length = w;

    w = 0;
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < M || s.x > S - M) { s.vx *= -0.55; s.x = clamp(s.x, M, S - M); }
      if (s.y < M || s.y > S - M) { s.vy *= -0.55; s.y = clamp(s.y, M, S - M); }
      const damp = Math.pow(0.92, dt * 60);
      s.vx *= damp; s.vy *= damp;
      s.rot += s.vrot * dt;
      s.vrot *= damp;
      s.life -= dt;
      if (s.life > 0) shards[w++] = s;
    }
    shards.length = w;

    w = 0;
    for (let i = 0; i < plumes.length; i++) {
      const p = plumes[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const damp = Math.pow(0.90, dt * 60);
      p.vx *= damp; p.vy *= damp;
      p.life -= dt;
      if (p.life > 0) plumes[w++] = p;
    }
    plumes.length = w;

    w = 0;
    for (let i = 0; i < slashes.length; i++) {
      const s = slashes[i];
      s.life -= dt;
      if (s.life > 0) slashes[w++] = s;
    }
    slashes.length = w;

    w = 0;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      r.life -= dt;
      if (r.life > 0) rings[w++] = r;
    }
    rings.length = w;

    w = 0;
    for (let i = 0; i < casings.length; i++) {
      const c = casings[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vz -= 420 * dt;
      c.z += c.vz * dt;
      if (c.z <= 0) {
        c.z = 0;
        if (!c.bounced) {
          c.bounced = true;
          c.vz = Math.abs(c.vz) * 0.45;
          c.vx *= 0.65;
          c.vy *= 0.65;
          global.APEX_BEYOND_AUDIO?.playCasingClink?.();
        } else {
          c.vz = 0;
          c.vx *= 0.85;
          c.vy *= 0.85;
        }
      }
      c.rot += c.vrot * dt;
      c.life -= dt;
      if (c.life > 0) casings[w++] = c;
    }
    casings.length = w;

    w = 0;
    for (let i = 0; i < afterimages.length; i++) {
      const a = afterimages[i];
      a.life -= dt;
      if (a.life > 0) afterimages[w++] = a;
    }
    afterimages.length = w;

    w = 0;
    for (let i = 0; i < callouts.length; i++) {
      const c = callouts[i];
      c.y += c.vy * realDt;
      c.vy *= Math.pow(0.92, realDt * 60);
      c.life -= realDt;
      if (c.life > 0) callouts[w++] = c;
    }
    callouts.length = w;

    w = 0;
    for (let i = 0; i < skyBeams.length; i++) {
      const b = skyBeams[i];
      b.life -= realDt;
      if (b.life > 0) skyBeams[w++] = b;
    }
    skyBeams.length = w;
  }

  // ---- Pass A: Holographic Drop Pod Underlay around Weapon Pickups ----
  function drawSlotEnhancements(c) {
    const AQ = global.APEX_ARSENAL;
    const slots = AQ?.state?.slots;
    if (!Array.isArray(slots) || !slots.length) return;
    const CFG = global.APEX_ARSENAL_CONFIG;
    const tierCols = CFG?.TIER_COLORS || {
      T1: '#c6cfd9', T2: '#5cb8ff', T3: '#58e887', T4: '#c87cff', T5: '#ffca4f', T6: '#ff4949',
    };

    c.save();
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s || s.phase === 'REMOVED' || s.phase === 'PICKED_UP') continue;
      const col = s.kind === 'HEAL' ? '#49ef8d' : (tierCols[s.tier] || '#f0b64d');
      c.save();
      c.translate(s.x, s.y);

      if (s.phase === 'TELEGRAPH' || s.phase === 'HIDDEN') {
        // Rotating mechanical iris brackets signaling incoming drop
        const r = 44;
        c.rotate(clock * 1.4 + s.id);
        c.strokeStyle = 'rgba(240,192,98,0.42)';
        c.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          const a0 = k * (TAU / 4) + 0.25;
          c.beginPath();
          c.arc(0, 0, r, a0, a0 + 0.65);
          c.stroke();
        }
      } else if (s.phase === 'REVEALED' || s.phase === 'COUNTER_RESERVED') {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 4 + s.id);
        const r = s.tier === 'T6' ? 56 : s.tier === 'T5' ? 48 : 42;
        // Precision alloy containment ring under pickup
        c.strokeStyle = col;
        c.globalAlpha = s.tier === 'T6' ? (0.55 + pulse * 0.35) : (0.28 + pulse * 0.20);
        c.lineWidth = s.tier === 'T6' ? 2.8 : 1.8;
        c.save();
        c.rotate(clock * (s.tier === 'T6' ? 1.8 : 0.7) * (s.id % 2 ? 1 : -1));
        for (let k = 0; k < 3; k++) {
          const a0 = k * (TAU / 3) + 0.16;
          c.beginPath();
          c.arc(0, 0, r, a0, a0 + 1.15);
          c.stroke();
        }
        c.restore();

        // Corner diamond pips on high-tier T4/T5/T6 drops
        if (s.tier === 'T4' || s.tier === 'T5' || s.tier === 'T6') {
          c.globalAlpha = 0.5 + pulse * 0.35;
          c.fillStyle = col;
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2 - clock * 0.9;
            const px = Math.cos(a) * (r + 5);
            const py = Math.sin(a) * (r + 5);
            c.beginPath();
            c.arc(px, py, s.tier === 'T6' ? 3.2 : 2.3, 0, TAU);
            c.fill();
          }
        }
      }
      c.restore();
    }
    c.restore();
  }

  // ---- Pass B: Grounded Fighter Contact Shadows, Kinetic Afterimages & Diegetic Gauges ----
  function drawFighterUnderlay(c) {
    const fighters = global.fighters;
    if (!Array.isArray(fighters)) return;
    const combat = global.APEX_BEYOND_COMBAT?.getState?.();

    // 1. Kinetic Afterimage Silhouettes (drawn beneath live rigs)
    c.save();
    for (let i = 0; i < afterimages.length; i++) {
      const a = afterimages[i];
      const frac = a.life / a.maxLife;
      c.save();
      c.translate(a.x, a.y);
      c.rotate(a.angle);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.24 * frac * frac;
      // Sleek directional kinetic chevron echo
      const r = a.r * (0.78 + 0.24 * frac);
      const g = c.createRadialGradient(-r * 0.2, 0, 2, 0, 0, r * 1.15);
      g.addColorStop(0, a.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, r * 1.15, r * 0.85, 0, 0, TAU);
      c.fill();
      c.strokeStyle = a.color;
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(0, 0, r * 0.88, -0.95, 0.95);
      c.stroke();
      c.restore();
    }
    c.restore();

    // 2. Grounded Contact Shadow + Diegetic Kinetic Capacitor & Overdrive Aura
    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i];
      if (!f || f.hp <= 0) continue;
      const st = combat?.sides?.[i];

      c.save();
      c.translate(f.x, f.y);

      // Contact shadow is owned by APEX_EVOLUTION_ARENAS when active (avoids double shadow + 2 gradients/frame).
      if (!global.APEX_EVOLUTION_ARENAS) {
        const shR = f.radius * 1.06;
        const sg = c.createRadialGradient(-4, f.radius * 0.34, 4, -4, f.radius * 0.34, shR);
        sg.addColorStop(0, 'rgba(4,6,10,0.48)');
        sg.addColorStop(0.62, 'rgba(4,6,10,0.22)');
        sg.addColorStop(1, 'rgba(4,6,10,0)');
        c.fillStyle = sg;
        c.beginPath();
        c.ellipse(-4, f.radius * 0.34, shR, shR * 0.56, 0, 0, TAU);
        c.fill();
      }

      // Diegetic Kinetic Impulse charge ring (subtle clean segmented rim beneath fighter)
      if (st) {
        const ringR = f.radius + 11;
        const charge = clamp(st.impulseCharge || 0, 0, 1);
        const sideColor = i === 0 ? '#b2ff3a' : '#86dcff';
        if (st.overdriveTimer > 0) {
          // Blazing APEX OVERDRIVE rotating hexagonal floor aura
          const odFrac = clamp(st.overdriveTimer / 8, 0, 1);
          c.save();
          c.rotate(clock * 2.6 * (i === 0 ? 1 : -1));
          c.strokeStyle = '#ffda66';
          c.globalAlpha = 0.72;
          c.lineWidth = 3;
          c.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k * TAU) / 6;
            const hx = Math.cos(a) * (ringR + 9);
            const hy = Math.sin(a) * (ringR + 9);
            if (k === 0) c.moveTo(hx, hy); else c.lineTo(hx, hy);
          }
          c.closePath();
          c.stroke();
          c.restore();

          // Remaining Overdrive progress arc
          c.strokeStyle = '#ffe585';
          c.globalAlpha = 0.85;
          c.lineWidth = 3.2;
          c.beginPath();
          c.arc(0, 0, ringR + 2, -Math.PI / 2, -Math.PI / 2 + TAU * odFrac);
          c.stroke();
        } else if (charge >= 0.999) {
          // Crisp ready pulse pips (subtle, never noisy)
          const pulse = 0.5 + 0.5 * Math.sin(clock * 5.2 + i * 2);
          c.strokeStyle = sideColor;
          c.globalAlpha = 0.24 + pulse * 0.22;
          c.lineWidth = 2;
          c.beginPath();
          c.arc(0, 0, ringR, -Math.PI * 0.85, -Math.PI * 0.15);
          c.stroke();
          c.beginPath();
          c.arc(0, 0, ringR, Math.PI * 0.15, Math.PI * 0.85);
          c.stroke();
        } else {
          // Charging arc
          c.strokeStyle = sideColor;
          c.globalAlpha = 0.22;
          c.lineWidth = 1.8;
          c.beginPath();
          c.arc(0, 0, ringR, -Math.PI / 2, -Math.PI / 2 + TAU * charge);
          c.stroke();
        }
      }

      c.restore();
    }
  }

  // ---- Pass C: Fighter Overlay (Perfect Deflect Energy Shield & Crisp Hit-Flash Ring) ----
  function drawFighterOverlay(c) {
    const fighters = global.fighters;
    if (!Array.isArray(fighters)) return;
    const combat = global.APEX_BEYOND_COMBAT?.getState?.();

    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i];
      if (!f || f.hp <= 0) continue;
      const st = combat?.sides?.[i];
      const hf = hitFlashes.get(f);

      if (hf && hf.timer > 0) {
        const a = clamp(hf.timer / 0.12, 0, 1);
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.42 * a;
        const g = c.createRadialGradient(f.x, f.y, 4, f.x, f.y, f.radius * 1.15);
        g.addColorStop(0, hf.color);
        g.addColorStop(0.65, hf.color);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(f.x, f.y, f.radius * 1.15, 0, TAU);
        c.fill();
        c.restore();
      }

      // Active PERFECT DEFLECT shield shell (first 180ms of Kinetic Impulse)
      if (st && st.deflectWindow > 0) {
        const frac = clamp(st.deflectWindow / 0.18, 0, 1);
        const r = f.radius + 17 + (1 - frac) * 7;
        c.save();
        c.translate(f.x, f.y);
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = '#6effd3';
        c.globalAlpha = 0.85 * frac;
        c.lineWidth = 4.5;
        c.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * TAU) / 6 + clock * 4;
          const hx = Math.cos(a) * r;
          const hy = Math.sin(a) * r;
          if (k === 0) c.moveTo(hx, hy); else c.lineTo(hx, hy);
        }
        c.closePath();
        c.stroke();

        const fg = c.createRadialGradient(0, 0, r * 0.45, 0, 0, r);
        fg.addColorStop(0, 'rgba(94,247,194,0)');
        fg.addColorStop(1, `rgba(110,255,211,${(0.32 * frac).toFixed(3)})`);
        c.fillStyle = fg;
        c.fill();
        c.restore();
      }
    }
  }

  // ---- Pass D: Multi-Layer Structured VFX, Sky Beams, Casings, Callouts & K.O. Cinema ----
  function drawForeground(c, S) {
    // 1. Ejected brass shell casings on deck
    if (casings.length) {
      c.save();
      for (let i = 0; i < casings.length; i++) {
        const cs = casings[i];
        const a = clamp(cs.life / cs.maxLife, 0, 1);
        c.save();
        c.translate(cs.x, cs.y - cs.z * 0.45);
        c.rotate(cs.rot);
        c.globalAlpha = a * 0.92;
        c.fillStyle = '#e8bd5a';
        c.fillRect(-4, -1.7, 8, 3.4);
        c.fillStyle = '#fff2be';
        c.fillRect(-3, -1.2, 5, 1.1);
        c.restore();
      }
      c.restore();
    }

    // 2. Directional billowing dust & smoke plumes
    if (plumes.length) {
      c.save();
      for (let i = 0; i < plumes.length; i++) {
        const p = plumes[i];
        const u = 1 - p.life / p.maxLife;
        const r = lerp(p.r0, p.r1, easeOutCubic(u));
        const a = (1 - u) * (1 - u);
        c.globalAlpha = a;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, r, 0, TAU);
        c.fill();
        c.fillStyle = p.rim;
        c.beginPath();
        c.arc(p.x - r * 0.22, p.y - r * 0.22, r * 0.62, 0, TAU);
        c.fill();
      }
      c.restore();
    }

    // 3. Double-ring sonic shockwaves
    if (rings.length) {
      c.save();
      for (let i = 0; i < rings.length; i++) {
        const rg = rings[i];
        const u = 1 - rg.life / rg.maxLife;
        const r = lerp(rg.r0, rg.maxR, easeOutCubic(u));
        const a = Math.max(0, 1 - u);
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = rg.color;
        c.globalAlpha = a * 0.88;
        c.lineWidth = Math.max(1, rg.lineWidth * (1 - u * 0.72));
        c.beginPath();
        c.arc(rg.x, rg.y, r, 0, TAU);
        c.stroke();

        if (rg.doubleRing) {
          c.strokeStyle = '#ffffff';
          c.globalAlpha = a * a * 0.72;
          c.lineWidth = Math.max(1, rg.lineWidth * 0.42 * (1 - u));
          c.beginPath();
          c.arc(rg.x, rg.y, r * 0.78, 0, TAU);
          c.stroke();
        }
      }
      c.restore();
    }

    // 4. Faceted tumbling armor/floor shards (beveled dark metal + hot ember rim + cast micro-shadow)
    if (shards.length) {
      c.save();
      for (let i = 0; i < shards.length; i++) {
        const sh = shards[i];
        const a = clamp(sh.life / sh.maxLife, 0, 1);
        const pts = sh.pts;
        c.save();
        c.translate(sh.x + 3, sh.y + 5);
        c.rotate(sh.rot);
        c.globalAlpha = a * 0.35;
        c.fillStyle = '#05070a';
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
        c.closePath();
        c.fill();
        c.restore();

        c.save();
        c.translate(sh.x, sh.y);
        c.rotate(sh.rot);
        c.globalAlpha = a;
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
        c.closePath();
        c.fillStyle = sh.color;
        c.fill();
        // Specular bevel highlight on one facet
        c.fillStyle = 'rgba(255,244,218,0.28)';
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(pts[0][0], pts[0][1]);
        c.lineTo(pts[1][0], pts[1][1]);
        c.closePath();
        c.fill();
        c.strokeStyle = sh.edge;
        c.lineWidth = 1.5;
        c.stroke();
        c.restore();
      }
      c.restore();
    }

    // 5. Velocity-stretched hot sparks (additive core + color trail)
    if (sparks.length) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      for (let i = 0; i < sparks.length; i++) {
        const sp = sparks[i];
        const a = clamp(sp.life / sp.maxLife, 0, 1);
        const tailX = sp.x - sp.vx * 0.036;
        const tailY = sp.y - sp.vy * 0.036;
        c.globalAlpha = a * 0.92;
        c.strokeStyle = sp.color;
        c.lineWidth = sp.width * (0.5 + 0.6 * a);
        c.beginPath();
        c.moveTo(tailX, tailY);
        c.lineTo(sp.x, sp.y);
        c.stroke();

        c.globalAlpha = a;
        c.strokeStyle = sp.core;
        c.lineWidth = sp.width * 0.45 * a;
        c.beginPath();
        c.moveTo(lerp(tailX, sp.x, 0.45), lerp(tailY, sp.y, 0.45));
        c.lineTo(sp.x, sp.y);
        c.stroke();
      }
      c.restore();
    }

    // 6. Fighting-game tapered crescent slash arcs & razor impact flares
    if (slashes.length) {
      c.save();
      c.globalCompositeOperation = 'screen';
      for (let i = 0; i < slashes.length; i++) {
        const sl = slashes[i];
        const u = 1 - sl.life / sl.maxLife;
        const a = Math.max(0, 1 - u);
        const len = sl.len * (0.72 + 0.44 * easeOutCubic(u));
        const wid = sl.width * (1 - u * 0.72);
        const drawBlade = (rot, l, w) => {
          c.save();
          c.translate(sl.x, sl.y);
          c.rotate(rot);
          // Outer curved crescent slash ribbon
          c.globalAlpha = a * 0.90;
          c.fillStyle = sl.color;
          c.beginPath();
          c.moveTo(-l * 0.58, 0);
          c.quadraticCurveTo(0, -w * 0.85, l * 0.58, 0);
          c.quadraticCurveTo(0, -w * 0.12, -l * 0.58, 0);
          c.closePath();
          c.fill();
          // White-hot razor spine
          c.globalAlpha = a;
          c.fillStyle = sl.core;
          c.beginPath();
          c.moveTo(-l * 0.42, 0);
          c.quadraticCurveTo(0, -w * 0.42, l * 0.42, 0);
          c.quadraticCurveTo(0, -w * 0.16, -l * 0.42, 0);
          c.closePath();
          c.fill();
          c.restore();
        };
        drawBlade(sl.angle, len, wid);
        if (sl.cross) {
          drawBlade(sl.angle + Math.PI * 0.55, len * 0.84, wid * 0.78);
          drawBlade(sl.angle - Math.PI * 0.45, len * 0.65, wid * 0.55);
        }
      }
      c.restore();
    }

    // 7. Crisp High-Tier Drop Sky-Beams (Stormbreaker / Supply Drop)
    if (skyBeams.length) {
      c.save();
      c.globalCompositeOperation = 'screen';
      for (let i = 0; i < skyBeams.length; i++) {
        const b = skyBeams[i];
        const a = clamp(b.life / b.maxLife, 0, 1);
        const w = 10 + (1 - a) * 28;
        const g = c.createLinearGradient(b.x - w, 0, b.x + w, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.38, b.color);
        g.addColorStop(0.5, '#fff6e0');
        g.addColorStop(0.62, b.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = a * 0.62;
        c.fillStyle = g;
        c.fillRect(b.x - w, 0, w * 2, b.y);

        // Ground contact ring at beam foot
        c.globalAlpha = a * 0.75;
        c.strokeStyle = b.color;
        c.lineWidth = 2.6;
        c.beginPath();
        c.ellipse(b.x, b.y + 8, 22 + (1 - a) * 38, 9 + (1 - a) * 14, 0, 0, TAU);
        c.stroke();
      }
      c.restore();
    }

    // 8. Stylized Tactical Combat Callouts (CLASH! / PERFECT DEFLECT! / WALL SLAM! / OVERDRIVE!)
    if (callouts.length) {
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let i = 0; i < callouts.length; i++) {
        const co = callouts[i];
        const age = 1 - co.life / co.maxLife;
        const pop = age < 0.16 ? easeOutBack(age / 0.16) : 1;
        const fade = age > 0.70 ? (1 - age) / 0.30 : 1;
        c.save();
        c.translate(co.x, co.y);
        c.scale(pop * co.scale, pop * co.scale);
        c.rotate(-0.045);
        c.globalAlpha = clamp(fade, 0, 1);

        c.font = '900 24px "Oswald", "Montserrat", "Segoe UI", sans-serif';
        const tw = c.measureText(co.text).width + 26;
        // Slanted industrial cut-plate backing
        c.fillStyle = co.accent;
        c.beginPath();
        c.moveTo(-tw / 2 + 8, -16);
        c.lineTo(tw / 2 + 4, -16);
        c.lineTo(tw / 2 - 8, 16);
        c.lineTo(-tw / 2 - 4, 16);
        c.closePath();
        c.fill();
        c.strokeStyle = co.color;
        c.lineWidth = 2.2;
        c.stroke();

        c.lineWidth = 4;
        c.strokeStyle = '#07080b';
        c.strokeText(co.text, 0, 1);
        c.fillStyle = co.color;
        c.fillText(co.text, 0, 1);
        c.restore();
      }
      c.restore();
    }

  }

  function drawScreenForeground(c, S) {
    // 9. Overhead Arena Atmosphere (sunbeams, embers, subtle tension vignette)
    global.APEX_BEYOND_ARENA?.drawOverheadAtmosphere?.(c, S);

    // 10. Iconic K.O. Finisher Cinema Overlay (pixel-perfect screen space!)
    if (ko.active) {
      drawKoCinemaOverlay(c, S);
    }
  }

  function drawKoCinemaOverlay(c, S) {
    const t = ko.elapsed;
    c.save();

    // Phase 1: Crisp 115ms Fighting-Game Impact Frame!
    if (t < ko.impactFrameDuration) {
      const f = 1 - t / ko.impactFrameDuration;
      // High-contrast gold/obsidian flash cut
      c.fillStyle = t < 0.05 ? `rgba(255,244,205,${(0.76 * f).toFixed(3)})` : `rgba(8,10,14,${(0.55 * f).toFixed(3)})`;
      c.fillRect(0, 0, S, S);

      // Sharp radial comic/anime impact wedges converging on the KO strike point
      c.save();
      c.translate(ko.x, ko.y);
      c.fillStyle = t < 0.05 ? '#0b0d12' : '#ffe588';
      for (let i = 0; i < 18; i++) {
        const a = (i * TAU) / 18 + 0.12;
        const innerR = 75 + (i % 3) * 32;
        const outerR = 1350;
        const halfW = 0.022 + (i % 2) * 0.014;
        c.beginPath();
        c.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
        c.lineTo(Math.cos(a - halfW) * outerR, Math.sin(a - halfW) * outerR);
        c.lineTo(Math.cos(a + halfW) * outerR, Math.sin(a + halfW) * outerR);
        c.closePath();
        c.fill();
      }
      c.restore();
      c.restore();
      return;
    }

    // Phase 2: Kinetic Speedlines + Dramatic "APEX K.O." Finisher Stamp
    const post = t - ko.impactFrameDuration;
    const alpha = post < 1.35 ? 1 : clamp(1 - (post - 1.35) / 0.75, 0, 1);
    if (alpha <= 0.01) { c.restore(); return; }

    // Perimeter radial focus speedlines
    c.save();
    c.translate(S / 2, S / 2);
    c.globalAlpha = alpha * 0.32;
    c.strokeStyle = '#ffdf7e';
    for (let i = 0; i < 28; i++) {
      const a = (i * TAU) / 28 + post * 0.18;
      const r0 = 370 + Math.sin(i * 5.7) * 48;
      const r1 = 740;
      c.lineWidth = 1.6 + (i % 3) * 1.1;
      c.beginPath();
      c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      c.stroke();
    }
    c.restore();

    // Cinematic letterbox bars subtly framing the finish
    const barH = 38 * easeOutCubic(Math.min(1, post * 5)) * alpha;
    c.fillStyle = 'rgba(6,8,12,0.88)';
    c.fillRect(0, 0, S, barH);
    c.fillRect(0, S - barH, S, barH);

    // Bold angled APEX K.O. finisher stamp
    const stampPop = easeOutBack(Math.min(1, post / 0.22));
    c.save();
    c.translate(S / 2, S * 0.22);
    c.scale(stampPop, stampPop);
    c.rotate(-0.04);
    c.globalAlpha = alpha;

    // Slanted dark titanium banner plate
    c.fillStyle = 'rgba(9,12,18,0.86)';
    c.beginPath();
    c.moveTo(-210, -44);
    c.lineTo(222, -44);
    c.lineTo(202, 44);
    c.lineTo(-230, 44);
    c.closePath();
    c.fill();
    c.strokeStyle = '#ffcf54';
    c.lineWidth = 3.5;
    c.stroke();

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '900 58px "Oswald", "Montserrat", sans-serif';
    c.lineWidth = 7;
    c.strokeStyle = '#050608';
    c.strokeText('APEX K.O.', 0, -4);
    const tg = c.createLinearGradient(0, -34, 0, 26);
    tg.addColorStop(0, '#fff7d1');
    tg.addColorStop(0.5, '#ffd052');
    tg.addColorStop(1, '#e87e24');
    c.fillStyle = tg;
    c.fillText('APEX K.O.', 0, -4);

    c.font = '800 16px "JetBrains Mono", "Oswald", monospace';
    c.fillStyle = '#d7e2ee';
    c.fillText(`${ko.winnerName} · DECISIVE FINISH`, 0, 28);
    c.restore();

    c.restore();
  }

  // Upgrade base Particle & FloatingText visuals during Free Battle without breaking legacy callers
  function installCombatEffectUpgrades() {
    if (global.__apexBeyondEffectsInstalled) return;
    global.__apexBeyondEffectsInstalled = true;

    const origEmit = global.emitParticles;
    if (typeof origEmit === 'function') {
      global.emitParticles = function enhancedEmitParticles(x, y, color, count, speed, size, life, type) {
        if (global.gameState === 'ARSENAL' && !global.APEX_ARSENAL?.state?.questMultiActor) {
          // Route generic bursts into structured sparks + shards (much higher visual fidelity!)
          const n = clamp(Math.round((count || 8) * 0.6), 3, 22);
          emitSparks(x, y, n, {
            color: color || '#ffb84d',
            speedMin: (speed || 260) * 0.45,
            speedMax: (speed || 260) * 1.25,
            lifeMin: (life || 0.4) * 0.5,
            lifeMax: (life || 0.4) * 1.05,
            width: clamp((size || 4) * 0.52, 1.8, 3.6),
          });
          if (count >= 12) {
            emitShards(x, y, Math.min(6, Math.floor(count / 5)), {
              color: color || '#d0dae5',
              size: clamp((size || 5) * 1.25, 5, 10),
            });
          }
          return;
        }
        return origEmit(x, y, color, count, speed, size, life, type);
      };
    }

    const origShock = global.spawnShockwave;
    if (typeof origShock === 'function') {
      global.spawnShockwave = function enhancedSpawnShockwave(x, y, color, maxR = 150) {
        if (global.gameState === 'ARSENAL' && !global.APEX_ARSENAL?.state?.questMultiActor) {
          emitRing(x, y, maxR, color || '#ffd978', { lineWidth: maxR > 180 ? 8 : 6, life: 0.35 });
          global.APEX_BEYOND_ARENA?.addLight?.(x, y, maxR * 0.9, color || '#ffd978', 0.35, 0.22);
          return;
        }
        return origShock(x, y, color, maxR);
      };
    }
  }

  global.APEX_BEYOND_VFX = Object.freeze({
    reset,
    tick,
    emitSparks,
    emitShards,
    emitPlumes,
    emitSlashWedge,
    emitRing,
    emitCasing,
    emitSkyBeam,
    emitCallout,
    onHitImpact,
    onWeaponClash,
    onPerfectDeflect,
    onWallSlam,
    onImpulseBurst,
    onOverdriveStart,
    triggerKoCinema,
    addCameraKick,
    setCameraDirectorEnabled,
    isCameraDirectorEnabled,
    getCameraTransform,
    drawSlotEnhancements,
    drawFighterUnderlay,
    drawFighterOverlay,
    drawForeground,
    drawScreenForeground,
    installCombatEffectUpgrades,
  });
})(window);
