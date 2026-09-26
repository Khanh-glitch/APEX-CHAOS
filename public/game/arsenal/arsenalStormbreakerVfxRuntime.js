// STORMBREAKER — red-tier VFX presentation (V1 port, docs/stormbreaker/v1-port).
// Visual authority: 02_APPROVED_EXECUTABLE_REFERENCE_V9_NO_LONG_TAIL.html
// (V9 = V5 fixed-cost performance architecture + NO LONG THROW TAIL).
//
// Presentation only. This module consumes gameplay truth (slots, holders,
// the real aq_thrown projectile transform, real stun status, real hit points
// handed over by the weapon runtime) and never creates its own damage/stun
// truth. Bounded cost by construction:
//   - pre-scaled cached weapon sprite + one-time glow cache (V5 law);
//   - flight renders ZERO procedural bolt objects: only 3 cached rotational
//     ghosts + a fixed set of short local arcs across the WHOLE weapon
//     (V9 final decision — there is structurally no long tail to draw);
//   - spawn/impact/claim bolts come from capped, self-expiring pools.
(function apexArsenalStormbreakerVfxRuntime() {
  if (window.apexArsenalStormbreakerVfxRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL;
  const CFG = window.APEX_ARSENAL_CONFIG;
  if (!AQ || !CFG) return;
  const T = CFG.STORMBREAKER || {};

  const WORLD = () => (typeof GAME_SIZE === 'number' && GAME_SIZE) || 1000;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- pools --
  const BOLT_CAP = 30;      // spawn pulses + impact discharge + held accents
  const SPARK_CAP = 72;
  const MOTE_CAP = 32;
  const bolts = [];
  const sparks = [];
  const motes = [];
  const shockRings = []; // exact V9 local ring pool; bounded and presentation-only
  const impacts = [];       // { x, y, t, victimId, pulse2, crackleT }
  const claims = [];        // { x, y, t } pickup concentration moment
  const spawned = new Map();// slotId -> { x, y, t, pulseTimer, pulseIndex, coronaT, activeLinks }
  let arenaFlashA = 0;      // V9 sim.flash: white/cyan radial + screen tint
  let impactFlashA = 0;     // V9 sim.impactFlash: tight hit-point flash
  let flashCenter = { x: 500, y: 500 };
  let flightHist = [];      // last few real positions, ghosts only (V9)
  let heldCoronaT = 0;
  let lastHeldId = null;
  let clock = 0;

  const stats = {
    spawns: 0, throws: 0, impacts: 0, boltsPeak: 0, sparksPeak: 0, motesPeak: 0,
    frames: 0, trailEntities: 0, spawnWebBursts: 0, heldWebBursts: 0,
  };

  // ------------------------------------------------- weapon sprite caches --
  // V5 law: pre-scale the huge source image ONCE. Drawing the small cached
  // canvas every frame is far cheaper than scaling the 1086x1448 source.
  const CACHE_LONG = 460;
  const PAD = 34;
  let weaponCache = null, weaponGlowCache = null;
  function buildCaches() {
    const av = window.APEX_ARSENAL_AV;
    const w = av && av.weaponImage ? av.weaponImage('STORMBREAKER') : null;
    if (!w || !w.img || !w.img.complete || !w.img.width) return false;
    const scale = CACHE_LONG / w.h; // portrait: h is the long side
    const cw = Math.ceil(w.w * scale) + PAD * 2;
    const ch = Math.ceil(w.h * scale) + PAD * 2;
    const mk = (glow) => {
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const g = cv.getContext('2d');
      if (glow) {
        g.shadowColor = 'rgba(50,160,255,.85)';
        g.shadowBlur = 20; // one-time cost only
        g.globalAlpha = 0.72;
        g.drawImage(w.img, 0, 0, w.w, w.h, PAD, PAD, w.w * scale, w.h * scale);
        g.globalAlpha = 0.85;
        g.drawImage(w.img, 0, 0, w.w, w.h, PAD, PAD, w.w * scale, w.h * scale);
        g.globalAlpha = 1;
      } else {
        g.drawImage(w.img, 0, 0, w.w, w.h, PAD, PAD, w.w * scale, w.h * scale);
      }
      return cv;
    };
    weaponCache = mk(false);
    weaponGlowCache = mk(true);
    return true;
  }
  function drawWeaponCached(ctx, x, y, worldRot, long, alpha, glow) {
    if (!weaponCache || !weaponGlowCache) {
      if (!buildCaches()) return;
    }
    const src = glow ? weaponGlowCache : weaponCache;
    const s = long / CACHE_LONG;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(worldRot);
    ctx.globalAlpha = alpha;
    ctx.drawImage(src, -src.width * s / 2, -src.height * s / 2, src.width * s, src.height * s);
    ctx.restore();
  }

  // ------------------------------------------------------- anchor lattice --
  // Literal V9 source coordinates. The executable reference uses a 1448x1086
  // landscape PNG and samples the weapon in image-local coordinates. The game
  // asset is the same artwork rotated 90deg CW into 1086x1448 portrait form.
  // Therefore ref-local [px,py] maps to portrait-local [-py,px]. No hand-tuned
  // normalized anchor approximation is permitted in this parity path.
  const REF_SOURCE_LONG = 1448;
  const REF_ANCHORS = [
    [-310, -72], [-260, -35], [-214, -8], [-165, 12], [-110, 18],
    [-52, 18], [8, 18], [62, 18], [115, 15],
  ];
  const SPAWN_PAIRS = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
    [0, 2], [1, 3], [3, 5], [5, 7], [6, 8],
  ];
  const FLIGHT_LINKS = [
    [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 8],
    [0, 3], [2, 6], [4, 8],
  ];
  const SNAP_IDX = [0, 2, 5, 8];

  function anchorWorld(cx, cy, worldRot, long, ai) {
    const [px, py] = REF_ANCHORS[ai];
    const scale = long / REF_SOURCE_LONG;
    // reference landscape -> game portrait = 90deg CW
    const ax = -py * scale;
    const ay = px * scale;
    const c = Math.cos(worldRot), s = Math.sin(worldRot);
    return { x: cx + ax * c - ay * s, y: cy + ax * s + ay * c };
  }

  // ------------------------------------------------------- bolt geometry --
  // Midpoint-displacement bolts with periodic topology mutation (V9).
  function buildBoltPoints(x1, y1, x2, y2, rough, steps) {
    let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    const total = Math.hypot(x2 - x1, y2 - y1);
    let amp = total * rough;
    for (let s = 0; s < steps; s++) {
      const next = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        next.push(a);
        const mx = (a.x + b.x) * 0.5, my = (a.y + b.y) * 0.5;
        const dx = b.x - a.x, dy = b.y - a.y;
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L;
        const off = rand(-amp, amp);
        next.push({ x: mx + nx * off, y: my + ny * off });
      }
      next.push(pts[pts.length - 1]);
      pts = next;
      amp *= 0.52;
    }
    return pts;
  }
  function norm2(x, y) { const L = Math.hypot(x, y) || 1; return [x / L, y / L]; }
  function regenerateBolt(b) {
    b.points = buildBoltPoints(b.x1, b.y1, b.x2, b.y2, b.rough, b.floor ? 5 : 6);
    b.branches.length = 0;
    for (let k = 0; k < b.branchCount; k++) {
      const idx = Math.floor(rand(b.points.length * 0.22, b.points.length * 0.78));
      const p = b.points[clamp(idx, 1, b.points.length - 2)];
      const next = b.points[Math.min(b.points.length - 1, idx + 1)];
      const [dx, dy] = norm2(next.x - p.x, next.y - p.y);
      const side = Math.random() < 0.5 ? -1 : 1;
      const nx = -dy * side, ny = dx * side;
      const mainLen = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      const L = mainLen * rand(b.branchScale * 0.55, b.branchScale);
      const fwd = rand(0.15, 0.55);
      const ex = p.x + (nx * (1 - fwd) + dx * fwd) * L;
      const ey = p.y + (ny * (1 - fwd) + dy * fwd) * L;
      b.branches.push(buildBoltPoints(p.x, p.y, ex, ey, b.rough * 0.9, 4));
    }
  }
  function makeBolt(x1, y1, x2, y2, opts = {}) {
    if (bolts.length >= BOLT_CAP) bolts.shift();
    const b = {
      x1, y1, x2, y2,
      life: opts.life != null ? opts.life : 0.11,
      max: opts.life != null ? opts.life : 0.11,
      width: opts.width != null ? opts.width : 1.7,
      power: opts.power != null ? opts.power : 1,
      rough: opts.rough != null ? opts.rough : 0.18,
      floor: !!opts.floor,
      alpha: opts.alpha != null ? opts.alpha : 1,
      regen: opts.regen != null ? opts.regen : 0.025,
      regenT: 0,
      branchCount: opts.branchCount != null ? opts.branchCount : 0,
      branchScale: opts.branchScale != null ? opts.branchScale : 0.24,
      points: null,
      branches: [],
    };
    regenerateBolt(b);
    bolts.push(b);
    stats.boltsPeak = Math.max(stats.boltsPeak, bolts.length);
    return b;
  }
  function strokePolyline(g, pts, width, style, alpha, blur) {
    if (!pts || pts.length < 2 || alpha <= 0) return;
    g.save();
    g.globalAlpha = alpha;
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.lineWidth = width;
    g.strokeStyle = style;
    if (blur > 0) { g.shadowColor = style; g.shadowBlur = blur; }
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
    g.restore();
  }
  function drawBolt(g, b) {
    const fade = clamp(b.life / b.max, 0, 1);
    const flicker = 0.68 + Math.random() * 0.32;
    const a = b.alpha * fade * flicker * b.power;
    const floorMul = b.floor ? 0.74 : 1;
    strokePolyline(g, b.points, b.width * 10, 'rgba(28,123,255,.18)', a * 0.58 * floorMul, b.width * 9);
    strokePolyline(g, b.points, b.width * 4.8, 'rgba(30,150,255,.50)', a * 0.85 * floorMul, b.width * 4.2);
    strokePolyline(g, b.points, b.width * 2.2, 'rgba(96,211,255,.92)', a * 0.95 * floorMul, b.width * 1.5);
    strokePolyline(g, b.points, b.width * 0.8, 'rgba(245,253,255,1)', a, 0);
    for (const br of b.branches) {
      strokePolyline(g, br, b.width * 4.8, 'rgba(32,137,255,.16)', a * 0.44 * floorMul, b.width * 4.2);
      strokePolyline(g, br, b.width * 1.65, 'rgba(72,189,255,.74)', a * 0.65 * floorMul, b.width * 1.35);
      strokePolyline(g, br, b.width * 0.55, 'rgba(235,251,255,.95)', a * 0.82 * floorMul, 0);
    }
  }

  // ------------------------------------------------------------- sparks --
  function sparkBurst(x, y, count, power) {
    for (let i = 0; i < count; i++) {
      if (sparks.length >= SPARK_CAP) sparks.shift();
      const a = rand(0, Math.PI * 2), sp = rand(55, 230) * power;
      const life = rand(0.12, 0.34);
      sparks.push({ x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: rand(0.7, 1.8) });
    }
    stats.sparksPeak = Math.max(stats.sparksPeak, sparks.length);
  }
  function addMotes(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      if (motes.length >= MOTE_CAP) motes.shift();
      const life = rand(0.25, 0.65);
      motes.push({
        x: x + rand(-22, 22), y: y + rand(-22, 22),
        vx: rand(-15, 15), vy: rand(-28, -8),
        life, max: life, size: rand(1, 2.4),
      });
    }
    stats.motesPeak = Math.max(stats.motesPeak, motes.length);
  }
  function ring(x, y, power = 1) {
    if (shockRings.length >= 18) shockRings.shift();
    shockRings.push({ x, y, r: 8, life: 0.34, max: 0.34, power });
  }
  function drawRings(g) {
    for (const r of shockRings) {
      const a = clamp(r.life / r.max, 0, 1);
      g.save();
      g.globalAlpha = a * 0.5;
      g.lineWidth = 1.5 + r.power;
      g.strokeStyle = 'rgba(67,179,255,.8)';
      g.shadowColor = 'rgba(30,145,255,.9)';
      g.shadowBlur = 9;
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  function drawSparks(g) {
    for (const p of sparks) {
      const a = clamp(p.life / p.max, 0, 1);
      g.save();
      g.globalAlpha = a;
      g.strokeStyle = 'rgba(210,248,255,.92)';
      g.shadowColor = 'rgba(55,174,255,.92)';
      g.shadowBlur = 5;
      g.lineWidth = p.size;
      g.beginPath(); g.moveTo(p.px, p.py); g.lineTo(p.x, p.y); g.stroke();
      g.restore();
    }
    for (const p of motes) {
      const a = clamp(p.life / p.max, 0, 1);
      g.save();
      g.globalAlpha = a * 0.6;
      g.fillStyle = 'rgba(104,205,255,.9)';
      g.shadowColor = 'rgba(42,160,255,.9)';
      g.shadowBlur = 7;
      g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }

  // --------------------------------------------------------- arena edges --
  function arenaEdgePoint() {
    const W = WORLD();
    const wall = 30; // Chamber 01 visible/playable wall band.
    const left = wall, top = wall, right = W - wall, bottom = W - wall;
    const side = Math.floor(rand(0, 4));
    if (side === 0) return { x: rand(left + 40, right - 40), y: top + rand(18, 55) };
    if (side === 1) return { x: right - rand(18, 55), y: rand(top + 40, bottom - 40) };
    if (side === 2) return { x: rand(left + 40, right - 40), y: bottom - rand(18, 55) };
    return { x: left + rand(18, 55), y: rand(top + 40, bottom - 40) };
  }

  // ------------------------------------------------- linked arc drawing --
  // Fixed-cost local electricity: a fixed link set across the whole weapon
  // with rapid midpoint wobble (V9 flight grammar). No spawned objects.
  function spawnHandleWeb(cx, cy, worldRot, long, intensity = 1, phase = 'spawn') {
    const limit = intensity > 1 ? 8 : 6;
    for (let i = 0; i < limit; i++) {
      const pair = SPAWN_PAIRS[Math.floor(rand(0, SPAWN_PAIRS.length))];
      const a = anchorWorld(cx, cy, worldRot, long, pair[0]);
      const b = anchorWorld(cx, cy, worldRot, long, pair[1]);
      makeBolt(a.x, a.y, b.x, b.y, {
        life: rand(0.04, 0.08),
        width: rand(0.45, 0.85),
        power: 0.62 * intensity,
        rough: 0.24,
        branchCount: Math.random() < 0.35 ? 1 : 0,
        branchScale: 0.16,
        regen: 0.018,
      });
    }
    if (Math.random() < 0.6) {
      const ai = Math.floor(rand(0, REF_ANCHORS.length));
      const a = anchorWorld(cx, cy, worldRot, long, ai);
      makeBolt(a.x, a.y, a.x + rand(-22, 22), a.y + rand(-20, 20), {
        life: 0.05, width: 0.55, power: 0.55 * intensity, rough: 0.28, regen: 0.016,
      });
    }
    if (phase === 'held') stats.heldWebBursts += 1;
    else stats.spawnWebBursts += 1;
  }

  // Literal V9 flight grammar: fixed 10-link web + four short outward snaps.
  // Widths/wobble/snap distances are intentionally NOT multiplied by weapon
  // scale: the prior port did so and made the final effect visibly weaker.
  function drawLinkedArcs(g, cx, cy, worldRot, long, t, alphaMul = 1) {
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < FLIGHT_LINKS.length; i++) {
      const [ia, ib] = FLIGHT_LINKS[i];
      const a = anchorWorld(cx, cy, worldRot, long, ia);
      const b = anchorWorld(cx, cy, worldRot, long, ib);
      const mx = (a.x + b.x) * 0.5 + Math.sin(t * 34 + i * 1.83) * 3.8;
      const my = (a.y + b.y) * 0.5 + Math.cos(t * 29 + i * 2.17) * 3.2;
      const pts = [a, { x: mx, y: my }, b];
      strokePolyline(g, pts, 4.1, 'rgba(30,136,255,.13)', 0.82 * alphaMul, 3.0);
      strokePolyline(g, pts, 1.55, 'rgba(100,218,255,.72)', 0.90 * alphaMul, 0.8);
      strokePolyline(g, pts, 0.62, 'rgba(246,253,255,.92)', 0.95 * alphaMul, 0);
    }
    for (let j = 0; j < SNAP_IDX.length; j++) {
      const a = anchorWorld(cx, cy, worldRot, long, SNAP_IDX[j]);
      const phase = t * 26 + j * 2.31;
      const ex = a.x + Math.cos(phase) * (13 + j * 1.7);
      const ey = a.y + Math.sin(phase * 1.11) * (11 + j * 1.4);
      const bend = {
        x: (a.x + ex) * 0.5 + Math.sin(phase * 1.7) * 3,
        y: (a.y + ey) * 0.5 + Math.cos(phase * 1.5) * 3,
      };
      const pts = [a, bend, { x: ex, y: ey }];
      strokePolyline(g, pts, 3.2, 'rgba(28,134,255,.12)', 0.76 * alphaMul, 2.4);
      strokePolyline(g, pts, 1.25, 'rgba(104,222,255,.66)', 0.86 * alphaMul, 0.6);
      strokePolyline(g, pts, 0.52, 'rgba(248,254,255,.88)', 0.92 * alphaMul, 0);
    }
    g.restore();
  }

  // ------------------------------------------------------- state probes --
  function fightersAlive() { return (typeof fighters !== 'undefined' ? fighters : []) || []; }
  function findFlight() {
    for (const p of (typeof projectiles !== 'undefined' ? projectiles : [])) {
      if (p && p.aq && p.type === 'aq_thrown' && p.weapon === 'STORMBREAKER' && p.state === 'flight') return p;
    }
    return null;
  }
  function findHeld() {
    for (const f of fightersAlive()) {
      if (!f || f.hp <= 0) continue;
      const h = AQ.weaponApi && AQ.weaponApi.getHolder ? AQ.weaponApi.getHolder(f) : null;
      if (h && h.weaponId === 'STORMBREAKER') return { f, h };
    }
    return null;
  }
  // Reproduce drawWeaponWithPose's transform for held arcs (melee branch).
  function heldTransform(info) {
    const f = info.f, h = info.h;
    const pose = (h.meta && h.meta.pose) || {};
    const r = f.radius || 75;
    const aim = (h.meta && h.meta.aimAngle != null) ? h.meta.aimAngle : Math.atan2(f.dir?.y || 0, f.dir?.x || 1);
    const long = T.heldLongSide || 224;
    const offset = r * 0.72 + (pose.localX || 0) - (pose.recoil || 0);
    const lateral = pose.localY || 0;
    const theta = aim + Math.PI / 2 + (pose.rotKick || 0) + (pose.flourish || 0);
    return {
      x: f.x + Math.cos(aim) * offset + Math.cos(aim + Math.PI / 2) * lateral,
      y: f.y + Math.sin(aim) * offset + Math.sin(aim + Math.PI / 2) * lateral,
      theta,
      long,
    };
  }
  // Slot draw bob (SPAWN.drawSlots) — kept in sync so arcs track the sprite.
  function slotBob(slotId, time) { return Math.sin(time * 2.6) * 2; }

  // --------------------------------------------------------------- tick --
  function tick(dt) {
    stats.frames += 1;
    clock += dt;
    const state = AQ.state;
    const time = state ? state.time : clock;

    // Reconcile spawned (unclaimed floor) state against real slots.
    const liveIds = new Set();
    if (state) {
      for (const s of state.slots) {
        if (s.phase === 'REVEALED' && s.weaponId === 'STORMBREAKER') liveIds.add(s.id);
      }
    }
    for (const id of Array.from(spawned.keys())) {
      if (!liveIds.has(id)) spawned.delete(id);
    }
    if (state) {
      for (const s of state.slots) {
        if (s.phase !== 'REVEALED' || s.weaponId !== 'STORMBREAKER') continue;
        let rec = spawned.get(s.id);
        if (!rec) {
          rec = {
            x: s.x, y: s.y, t: 0,
            pulseTimer: 0.08,
            pulseIndex: 0,
            coronaT: 0,
          };
          spawned.set(s.id, rec);
          stats.spawns += 1;
          AQ.log && AQ.log('STORM_SPAWN_VFX', `slot=${s.id}`);
        }
        rec.t += dt;
        // Dense but hierarchical floor pulses (V9 cadence).
        rec.pulseTimer -= dt;
        if (rec.pulseTimer <= 0) {
          const strong = rec.pulseIndex % 3 === 2;
          rec.pulseIndex += 1;
          spawnGroundPulse(rec.x, rec.y, strong);
          rec.pulseTimer = rand(0.28, 0.48);
        }
        // V9 executable reference: transient body web is actually emitted
        // every 60–110ms. The previous port only shuffled activeLinks without
        // rendering them, which is why the floor weapon read as an aura ring.
        rec.coronaT -= dt;
        if (rec.coronaT <= 0) {
          rec.coronaT = rand(0.06, 0.11);
          spawnHandleWeb(
            rec.x, rec.y + slotBob(s.id, time),
            T.floorAngleRad || 0, T.spawnLongSide || T.floorLongSide || 261,
            1.15, 'spawn'
          );
          addMotes(rec.x, rec.y + slotBob(s.id, time), 2);
        }
      }
    }

    // Held state: claim transition + calmer concentrated crackle accents.
    const held = findHeld();
    if (held) {
      if (lastHeldId !== held.f.id) {
        lastHeldId = held.f.id;
        onPickup(held.f, held.h);
      }
      heldCoronaT -= dt;
      if (heldCoronaT <= 0) {
        heldCoronaT = rand(0.05, 0.1);
        const th = heldTransform(held);
        spawnHandleWeb(th.x, th.y, th.theta, th.long, 1.2, 'held');
        if (Math.random() < 0.5) {
          makeBolt(
            held.f.x + rand(-12, 12), held.f.y + rand(-14, 14),
            th.x + rand(-14, 14), th.y + rand(-10, 10),
            { life: 0.055, width: 0.65, power: 0.6, rough: 0.24, regen: 0.018 }
          );
        }
      }
    } else if (lastHeldId != null) {
      // Claim cleared (throw consumed or match end) — no stale held VFX.
      lastHeldId = null;
      heldCoronaT = 0;
    }

    // Flight: track the REAL projectile transform (gameplay truth).
    const fl = findFlight();
    if (fl) {
      flightHist.push({ x: fl.x, y: fl.y });
      if (flightHist.length > 6) flightHist.shift();
      if (flightHist.length === 1) {
        // New throw: one-time release accent at the release point.
        stats.throws += 1;
        sparkBurst(fl.x, fl.y, 13, 0.9);
      }
    } else if (flightHist.length) {
      flightHist = []; // weapon resolved (hit/miss) — arcs die with flight
    }

    // Impacts: second flash pulse (V9 @75ms) + residual victim crackle.
    for (let i = impacts.length - 1; i >= 0; i--) {
      const im = impacts[i];
      im.t += dt;
      if (!im.pulse2 && im.t >= 0.075) {
        im.pulse2 = true;
        arenaFlashA = Math.max(arenaFlashA, 0.28);
      }
      const victim = im.victimId != null ? fightersAlive().find(f => f && f.id === im.victimId) : null;
      if (victim && victim.hp > 0 && victim.hasStatus && victim.hasStatus('stun')) {
        im.crackleT = (im.crackleT || 0) - dt;
        if (im.crackleT <= 0) {
          im.crackleT = rand(0.06, 0.12);
          makeBolt(
            victim.x + rand(-22, 22), victim.y + rand(-18, 18),
            victim.x + rand(-35, 35), victim.y + rand(-30, 30),
            { life: 0.055, width: 0.7, power: 0.7, rough: 0.3, regen: 0.014 }
          );
        }
      }
      if (im.t > 1.6) impacts.splice(i, 1);
    }

    // Claims.
    for (let i = claims.length - 1; i >= 0; i--) {
      claims[i].t += dt;
      if (claims[i].t > 0.4) claims.splice(i, 1);
    }

    // Pool lifecycles (V9 bolt integration: life + periodic regen).
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt; b.regenT -= dt;
      if (b.regenT <= 0 && b.life > 0) { regenerateBolt(b); b.regenT = b.regen; }
      if (b.life <= 0) bolts.splice(i, 1);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= dt; p.px = p.x; p.py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const drag = Math.pow(0.90, dt * 60);
      p.vx *= drag; p.vy *= drag;
      if (p.life <= 0) sparks.splice(i, 1);
    }
    for (let i = motes.length - 1; i >= 0; i--) {
      const p = motes[i];
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) motes.splice(i, 1);
    }

    for (let i = shockRings.length - 1; i >= 0; i--) {
      const r = shockRings[i];
      r.life -= dt;
      r.r += dt * 260 * r.power;
      if (r.life <= 0) shockRings.splice(i, 1);
    }

    // V9 flash decays: full flash pow(.018,dt), hit flash pow(.0018,dt).
    arenaFlashA *= Math.pow(0.018, dt);
    if (impacts.length > 0) impactFlashA *= Math.pow(0.0018, dt);
    else impactFlashA = 0;
  }

  function spawnGroundPulse(x, y, strong) {
    const p = arenaEdgePoint();
    makeBolt(x + rand(-8, 8), y + rand(-6, 6), p.x, p.y, {
      life: strong ? 0.16 : 0.12, width: strong ? 1.8 : 1.35, power: strong ? 1.0 : 0.82,
      rough: 0.17, floor: true, branchCount: strong ? 4 : 3, branchScale: strong ? 0.24 : 0.18, regen: 0.024,
    });
    if (Math.random() < 0.85) {
      const p2 = arenaEdgePoint();
      makeBolt(x + rand(-10, 10), y + rand(-8, 8), p2.x, p2.y, {
        life: strong ? 0.12 : 0.09, width: strong ? 1.05 : 0.85, power: 0.56,
        rough: 0.19, floor: true, branchCount: 2, branchScale: 0.14, regen: 0.02,
      });
    }
    ring(x, y, strong ? 1.18 : 0.82);
    sparkBurst(x, y, strong ? 14 : 8, strong ? 1.06 : 0.76);
    flashCenter = { x, y };
    arenaFlashA = Math.max(arenaFlashA, strong ? 0.16 : 0.07);
    if (typeof cameraShake !== 'undefined') cameraShake = Math.max(cameraShake, strong ? 4.4 : 2.4);
  }

  function onPickup(f, h) {
    const r = f.radius || 75;
    const aim = (h.meta && h.meta.aimAngle != null) ? h.meta.aimAngle : Math.atan2(f.dir?.y || 0, f.dir?.x || 1);
    const offset = r * 0.72;
    const wx = f.x + Math.cos(aim) * offset;
    const wy = f.y + Math.sin(aim) * offset;
    claims.push({ x: f.x, y: f.y, t: 0 });
    flashCenter = { x: f.x, y: f.y };
    arenaFlashA = Math.max(arenaFlashA, 0.14);
    ring(f.x, f.y, 1.05);
    sparkBurst(f.x, f.y, 18, 1.06);
    if (typeof cameraShake !== 'undefined') cameraShake = Math.max(cameraShake, 3.5);
    makeBolt(wx, wy, f.x, f.y, { life: 0.17, width: 1.45, power: 0.92, rough: 0.18, branchCount: 2, branchScale: 0.16, regen: 0.027 });
    makeBolt(f.x - 18, f.y + 8, f.x + 20, f.y - 14, { life: 0.12, width: 1.12, power: 0.85, rough: 0.26, branchCount: 1, branchScale: 0.2, regen: 0.022 });
  }

  // ------------------------------------------------- event from gameplay --
  // Called by the weapon runtime on a CONFIRMED hit with the real swept
  // collision point + victim. The weapon itself is already removed from the
  // world (no pin) — the flash covers the vanishing (V9 sequence).
  function onImpact(x, y, victim) {
    impacts.push({ x, y, t: 0, victimId: victim && victim.id != null ? victim.id : null, pulse2: false, crackleT: 0 });
    stats.impacts += 1;
    impactFlashA = 1;
    flashCenter = { x, y };
    arenaFlashA = Math.max(arenaFlashA, 0.92);
    if (typeof cameraShake !== 'undefined') cameraShake = Math.max(cameraShake, 12.5);
    // Exact V9: its own internal scene illumination + two thin local rings.
    // Do not stack the generic APEX shockwave/flash grammar on top.
    ring(x, y, 2.05);
    ring(x, y, 1.28);
    sparkBurst(x, y, 36, 1.5);
    // Hero discharge + major floor branches + short local snaps (V9 impact).
    const hero = arenaEdgePoint();
    makeBolt(x, y, hero.x, hero.y, { life: 0.19, width: 2.9, power: 1.0, rough: 0.13, branchCount: 4, branchScale: 0.24, regen: 0.022 });
    for (let i = 0; i < 5; i++) {
      const p = arenaEdgePoint();
      makeBolt(x + rand(-6, 6), y + rand(-6, 6), p.x, p.y, {
        life: rand(0.11, 0.16), width: rand(1.35, 1.9), power: 0.72, rough: 0.16,
        floor: true, branchCount: 2, branchScale: 0.18, regen: 0.026,
      });
    }
    for (let i = 0; i < 5; i++) {
      const a = rand(0, Math.PI * 2);
      makeBolt(x + rand(-10, 10), y + rand(-10, 10), x + Math.cos(a) * rand(38, 68), y + Math.sin(a) * rand(38, 68), {
        life: rand(0.07, 0.11), width: rand(0.8, 1.15), power: 0.84, rough: 0.28, branchCount: 0, regen: 0.018,
      });
    }
  }

  // --------------------------------------------------------------- draw --
  // Floor pass (drawBackground, under actors): arena glow, spawn aura,
  // floor-running lightning, slowed-fighter ground rings.
  function drawFloor(ctx) {
    if (!AQ.state) return;
    const time = AQ.state.time;
    // V9 floor discharge is one arena layer. Drawing this inside the per-slot
    // loop duplicated every bolt when Lab spawned multiple Stormbreakers.
    for (const b of bolts) if (b.floor) drawBolt(ctx, b);
    drawRings(ctx);
    for (const [id, rec] of spawned) {
      const bob = slotBob(id, time);
      const W = WORLD();
      // Charged floor glow under the weapon (V9 spawn gradient).
      const rg = ctx.createRadialGradient(rec.x, rec.y + bob, 8, rec.x, rec.y + bob, W * 0.46);
      rg.addColorStop(0, 'rgba(46,158,255,.11)');
      rg.addColorStop(0.35, 'rgba(22,104,190,.055)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, W);
      ctx.restore();
      // Floor-running bolts are drawn once above, before per-slot aura work.
      // Spawn aura ellipse (V9).
      const pulse = (Math.sin(rec.t * 5.5) + 1) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.19 + pulse * 0.1;
      ctx.strokeStyle = 'rgba(60,177,255,.78)';
      ctx.lineWidth = 1.3;
      ctx.shadowColor = 'rgba(40,155,255,.74)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(rec.x, rec.y + bob + 8, 84 + pulse * 12, 47 + pulse * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Restrained ground ring under each fighter while the global slow is up.
    for (const f of fightersAlive()) {
      if (!f || f.hp <= 0) continue;
      if (!(f.statuses && f.statuses.slow && f.statuses.slow.timer > 0)) continue;
      const pulse = (Math.sin(time * 4.2 + f.id) + 1) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.10 + 0.08 * pulse;
      ctx.strokeStyle = 'rgba(90,190,255,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + f.radius * 0.72, f.radius * 0.9 + pulse * 3, (f.radius * 0.9 + pulse * 3) * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Reference communication: explicit SLOWED marker on affected fighters.
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.84;
      ctx.fillStyle = 'rgba(112,204,255,.84)';
      ctx.font = '900 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('SLOWED', f.x, f.y + f.radius + 22);
      ctx.restore();
    }
    if (spawned.size > 0) {
      ctx.save();
      ctx.globalAlpha = 0.50;
      ctx.fillStyle = 'rgba(217,235,250,1)';
      ctx.font = '800 11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('RED TIER SPAWN • GLOBAL SLOW ACTIVE', 46, 47);
      ctx.restore();
    }
  }

  // Foreground pass (drawForeground, after equipped weapons + AV VFX):
  // flight ghosts + local arcs, held arcs, claims, impact flashes, sparks.
  function draw(ctx) {
    if (!AQ.state) return;
    const time = AQ.state.time;
    const g = ctx;

    // --- flight: the ONLY in-flight VFX. Fixed cost, zero bolt objects,
    // NO LONG TAIL (structurally: no trail/history render path exists).
    const fl = findFlight();
    if (fl) {
      const long = T.flightLongSide || T.worldLongSide || 209;
      const visualOffset = T.flightVisualOffsetRad || 0;
      const theta = fl.rot + Math.PI / 2 + visualOffset;
      const back1 = flightHist.length >= 2 ? flightHist[flightHist.length - 2] : { x: fl.px != null ? fl.px : fl.x, y: fl.py != null ? fl.py : fl.y };
      const back2 = flightHist.length >= 4 ? flightHist[flightHist.length - 4] : back1;
      // V9 spin blur: three cached ghosts (angular offsets behind the head).
      drawWeaponCached(g, back2.x, back2.y, (fl.rot - 0.68) + Math.PI / 2 + visualOffset, long, 0.10, true);
      drawWeaponCached(g, back1.x, back1.y, (fl.rot - 0.34) + Math.PI / 2 + visualOffset, long, 0.18, true);
      drawWeaponCached(g, fl.x, fl.y, (fl.rot - 0.16) + Math.PI / 2 + visualOffset, long, 0.18, true);
      // Linked electricity across the WHOLE spinning weapon + short snaps.
      drawLinkedArcs(g, fl.x, fl.y, theta, long, time, 1.0);
    }

    // --- held: V9 uses the transient handle-web emitted in tick(); the fixed
    // 10-link renderer belongs only to flight.
    // --- airborne bolts (pickup/impact/crackle accents — never trails).
    for (const b of bolts) if (!b.floor) drawBolt(g, b);

    // --- claim concentration flash (brief, V9 pickup).
    for (const c of claims) {
      const u = c.t / 0.4;
      const a = Math.max(0, 1 - u) * 0.5;
      const r = 30 + u * 90;
      g.save();
      g.globalAlpha = a;
      g.strokeStyle = 'rgba(120,220,255,.9)';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(c.x, c.y, r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    drawSparks(g);

    // --- tight hit-point flash (V9 impactFlash, screen composite).
    if (impactFlashA > 0.002) {
      const a = impactFlashA;
      const im = impacts[0] || flashCenter;
      const x = im.x != null ? im.x : flashCenter.x;
      const y = im.y != null ? im.y : flashCenter.y;
      g.save();
      g.globalCompositeOperation = 'screen';
      const rg = g.createRadialGradient(x, y, 0, x, y, 130);
      rg.addColorStop(0, `rgba(255,255,255,${(a * 0.95).toFixed(3)})`);
      rg.addColorStop(0.10, `rgba(220,248,255,${(a * 0.85).toFixed(3)})`);
      rg.addColorStop(0.30, `rgba(80,198,255,${(a * 0.48).toFixed(3)})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, 130, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    // --- scene illumination pulse (V9 sim.flash: tint + radial).
    if (arenaFlashA > 0.002) {
      const a = arenaFlashA;
      const W = WORLD();
      g.save();
      g.globalCompositeOperation = 'screen';
      g.fillStyle = `rgba(86,181,255,${(a * 0.24).toFixed(3)})`;
      g.fillRect(0, 0, W, W);
      const fx = flashCenter.x, fy = flashCenter.y;
      const rg = g.createRadialGradient(fx, fy, 0, fx, fy, W * 0.55);
      rg.addColorStop(0, `rgba(235,252,255,${(a * 0.44).toFixed(3)})`);
      rg.addColorStop(0.16, `rgba(72,185,255,${(a * 0.22).toFixed(3)})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, W);
      g.restore();
    }

  }

  function clear() {
    bolts.length = 0;
    sparks.length = 0;
    motes.length = 0;
    shockRings.length = 0;
    impacts.length = 0;
    claims.length = 0;
    spawned.clear();
    flightHist = [];
    lastHeldId = null;
    heldCoronaT = 0;
    arenaFlashA = 0;
    impactFlashA = 0;
    weaponCache = null;
    weaponGlowCache = null;
    stats.frames = 0;
  }

  window.APEX_ARSENAL_STORM = {
    tick,
    draw,
    drawFloor,
    clear,
    onImpact,
    boltCount: () => bolts.length,
    sparkCount: () => sparks.length,
    moteCount: () => motes.length,
    ringCount: () => shockRings.length,
    impactCount: () => impacts.length,
    spawnCount: () => spawned.size,
    // Structural no-long-tail guarantee: the module has no trail entity type;
    // flight VFX is ghosts + fixed local arcs only.
    hasTrailEntities: () => stats.trailEntities > 0,
    stats,
    referenceProfile: () => ({
      spawnPairCount: SPAWN_PAIRS.length,
      flightLinkCount: FLIGHT_LINKS.length,
      snapCount: SNAP_IDX.length,
      rawAnchorCount: REF_ANCHORS.length,
      anchorTransform: 'ref-landscape-to-game-portrait-90cw',
      floorAngleRad: T.floorAngleRad || 0,
      flightVisualOffsetRad: T.flightVisualOffsetRad || 0,
      spawnLongSide: T.spawnLongSide || 261,
      heldLongSide: T.heldLongSide || 224,
      flightLongSide: T.flightLongSide || 209,
      slowMult: T.slowMult || 0.54,
      spinRate: T.spinRate || 82,
      motesEnabled: true,
      ringRenderer: 'v9-local',
      genericShockwaveSubstitution: false,
      flightWidths: [4.1, 1.55, 0.62],
      spawnStrongEvery: 3,
      longTail: false,
    }),
  };
  window.apexArsenalStormbreakerVfxRuntime = 'ready';
})();
