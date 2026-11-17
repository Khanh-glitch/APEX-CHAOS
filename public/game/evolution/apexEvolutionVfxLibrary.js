/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — VFX Production Library
 *
 * A real 2D VFX pipeline instead of raw primitives:
 *   • Runtime-baked texture atlas (fire puff, plasma burst, crystal shard,
 *     frost dendrite, smoke, spark, ring, debris) rendered ONCE per session.
 *   • Pooled sprite-particle emitters with additive/normal blend, scale/alpha
 *     curves, drag, gravity, spin, trails and floor bounce.
 *   • Structured procedural geometry: branching lightning, faceted crystals,
 *     dendritic ice growth, physical debris, speed lines, impact frame.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_EVOLUTION_VFX) return;

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ── deterministic value noise for material baking ─────────────────────────
  function hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, oct = 4) {
    let amp = 0.5, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += vnoise(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.02;
    }
    return sum / norm;
  }

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // ── TEXTURE ATLAS (baked once) ────────────────────────────────────────────
  const TEX = {};
  function bakeRadial(size, stops) {
    const cv = mk(size, size), c = cv.getContext('2d');
    const gr = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [p, col] of stops) gr.addColorStop(p, col);
    c.fillStyle = gr;
    c.fillRect(0, 0, size, size);
    return cv;
  }
  function bakeFirePuff(size) {
    const cv = mk(size, size), c = cv.getContext('2d');
    const img = c.createImageData(size, size);
    const d = img.data;
    const half = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - half) / half, dy = (y - half) / half;
        const r = Math.hypot(dx, dy);
        const n = fbm(x * 0.045, y * 0.045, 4);
        const edge = clamp(1 - r / (0.55 + n * 0.45), 0, 1);
        const heat = Math.pow(edge, 1.4);
        const i = (y * size + x) * 4;
        d[i] = 255 * clamp(heat * 1.4, 0, 1);
        d[i + 1] = 255 * clamp(heat * heat * 1.25, 0, 1);
        d[i + 2] = 255 * clamp(heat * heat * heat * 0.9, 0, 1);
        d[i + 3] = 255 * clamp(heat * 1.1, 0, 1);
      }
    }
    c.putImageData(img, 0, 0);
    return cv;
  }
  function bakeSmoke(size) {
    const cv = mk(size, size), c = cv.getContext('2d');
    const img = c.createImageData(size, size);
    const d = img.data, half = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (x - half) / half, dy = (y - half) / half;
      const r = Math.hypot(dx, dy);
      const n = fbm(x * 0.03 + 9, y * 0.03 + 3, 5);
      const a = clamp((1 - r / (0.6 + n * 0.4)), 0, 1) * (0.45 + n * 0.55);
      const i = (y * size + x) * 4;
      const v = 150 + n * 70;
      d[i] = v; d[i + 1] = v; d[i + 2] = v + 10; d[i + 3] = 255 * a;
    }
    c.putImageData(img, 0, 0);
    return cv;
  }
  function bakePlasma(size) {
    const cv = mk(size, size), c = cv.getContext('2d');
    c.fillStyle = '#000'; c.fillRect(0, 0, size, size);
    c.globalCompositeOperation = 'lighter';
    const cx = size / 2, cy = size / 2;
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, size * 0.22);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.4, 'rgba(160,230,255,0.9)');
    core.addColorStop(1, 'rgba(40,120,255,0)');
    c.fillStyle = core; c.fillRect(0, 0, size, size);
    for (let k = 0; k < 9; k++) {
      const a0 = (k / 9) * TAU + rnd(-0.2, 0.2);
      drawLightningPath(c, cx, cy, cx + Math.cos(a0) * size * 0.46, cy + Math.sin(a0) * size * 0.46, 5, 'rgba(140,220,255,0.95)', 2.2, 0.35, 3);
    }
    return cv;
  }
  function bakeShard(size, hue) {
    const cv = mk(size, size), c = cv.getContext('2d');
    c.translate(size / 2, size / 2);
    drawFacetedShard(c, size * 0.42, size * 0.16, hue, 1);
    return cv;
  }
  function bakeFrost(size) {
    const cv = mk(size, size), c = cv.getContext('2d');
    c.translate(size / 2, size / 2);
    c.globalCompositeOperation = 'lighter';
    for (let arm = 0; arm < 6; arm++) {
      c.save();
      c.rotate((arm / 6) * TAU);
      drawDendrite(c, 0, 0, size * 0.44, 0, 3, 'rgba(190,245,255,0.95)', 3.2);
      c.restore();
    }
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, size * 0.2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(120,220,255,0)');
    c.fillStyle = gr; c.fillRect(-size / 2, -size / 2, size, size);
    return cv;
  }
  function bakeSpark(size) {
    const cv = mk(size, size), c = cv.getContext('2d');
    const gr = c.createLinearGradient(0, size / 2, size, size / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr;
    c.beginPath(); c.ellipse(size / 2, size / 2, size / 2, size * 0.12, 0, 0, TAU); c.fill();
    return cv;
  }
  function bakeRing(size) {
    const cv = mk(size, size), c = cv.getContext('2d');
    const gr = c.createRadialGradient(size / 2, size / 2, size * 0.34, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, size, size);
    return cv;
  }
  function bakeDebris(size) {
    const cv = mk(size, size), c = cv.getContext('2d');
    c.translate(size / 2, size / 2);
    c.fillStyle = '#3a3f4a'; c.strokeStyle = '#0b0d12'; c.lineWidth = 2;
    c.beginPath();
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, r = size * (0.28 + hash2(i, 7) * 0.2);
      if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath(); c.moveTo(-size * 0.2, -size * 0.1); c.lineTo(size * 0.05, -size * 0.28); c.lineTo(size * 0.1, -size * 0.05); c.closePath(); c.fill();
    return cv;
  }

  let baked = false;
  function ensureBaked() {
    if (baked) return;
    baked = true;
    TEX.glow = bakeRadial(128, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
    TEX.fire = bakeFirePuff(128);
    TEX.smoke = bakeSmoke(128);
    TEX.plasma = bakePlasma(160);
    TEX.shardViolet = bakeShard(96, 275);
    TEX.shardCyan = bakeShard(96, 195);
    TEX.shardGold = bakeShard(96, 42);
    TEX.frost = bakeFrost(160);
    TEX.spark = bakeSpark(64);
    TEX.ring = bakeRing(128);
    TEX.debris = bakeDebris(40);
  }

  // ── STRUCTURED PRIMITIVES ────────────────────────────────────────────────
  function drawLightningPath(c, x0, y0, x1, y1, depth, color, width, jitter, branchLeft) {
    const pts = [[x0, y0], [x1, y1]];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let disp = len * jitter;
    for (let d = 0; d < depth; d++) {
      for (let i = pts.length - 2; i >= 0; i--) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const nx = -(by - ay), ny = bx - ax;
        const nl = Math.hypot(nx, ny) || 1;
        const off = rnd(-disp, disp);
        pts.splice(i + 1, 0, [mx + (nx / nl) * off, my + (ny / nl) * off]);
      }
      disp *= 0.5;
    }
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = color; c.lineWidth = width * 2.6; c.globalAlpha = 0.28;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    c.globalAlpha = 1; c.lineWidth = width; c.strokeStyle = color;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    c.lineWidth = Math.max(0.8, width * 0.4); c.strokeStyle = '#ffffff';
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    c.restore();
    if (branchLeft > 0) {
      const bi = Math.floor(pts.length * rnd(0.3, 0.7));
      const [bx, by] = pts[bi];
      const ang = Math.atan2(y1 - y0, x1 - x0) + rnd(-0.9, 0.9);
      const bl = len * rnd(0.25, 0.45);
      drawLightningPath(c, bx, by, bx + Math.cos(ang) * bl, by + Math.sin(ang) * bl, Math.max(1, depth - 1), color, width * 0.6, jitter, branchLeft - 1);
    }
  }

  function drawFacetedShard(c, length, width, hue, alpha) {
    c.save();
    c.globalAlpha = alpha;
    const light = `hsl(${hue},100%,92%)`, mid = `hsl(${hue},85%,66%)`, dark = `hsl(${hue},70%,30%)`, edge = `hsl(${hue},40%,12%)`;
    // body
    c.beginPath();
    c.moveTo(0, -length); c.lineTo(width, -length * 0.25); c.lineTo(width * 0.65, length * 0.6); c.lineTo(0, length);
    c.lineTo(-width * 0.65, length * 0.6); c.lineTo(-width, -length * 0.25); c.closePath();
    const gr = c.createLinearGradient(-width, 0, width, 0);
    gr.addColorStop(0, dark); gr.addColorStop(0.45, mid); gr.addColorStop(0.55, light); gr.addColorStop(1, dark);
    c.fillStyle = gr; c.fill();
    c.lineWidth = 1.4; c.strokeStyle = edge; c.stroke();
    // facet ridge
    c.beginPath(); c.moveTo(0, -length); c.lineTo(0, length); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.moveTo(-width, -length * 0.25); c.lineTo(0, -length * 0.1); c.lineTo(width, -length * 0.25);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
    // specular
    c.beginPath(); c.moveTo(-width * 0.25, -length * 0.7); c.lineTo(-width * 0.05, -length * 0.75); c.lineTo(-width * 0.12, -length * 0.15); c.lineTo(-width * 0.32, -length * 0.1); c.closePath();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
    c.restore();
  }

  function drawDendrite(c, x, y, len, ang, depth, color, width) {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
    if (depth <= 0) return;
    const branches = 3;
    for (let i = 1; i <= branches; i++) {
      const t = i / (branches + 1);
      const bx = x + (ex - x) * t, by = y + (ey - y) * t;
      const bl = len * (0.42 - t * 0.16);
      drawDendrite(c, bx, by, bl, ang + 1.05, depth - 1, color, width * 0.62);
      drawDendrite(c, bx, by, bl, ang - 1.05, depth - 1, color, width * 0.62);
    }
  }

  function drawSpeedLines(c, cx, cy, S, intensity, color) {
    c.save();
    c.globalAlpha = clamp(intensity, 0, 1) * 0.85;
    c.strokeStyle = color || 'rgba(255,255,255,0.9)';
    const count = 46;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + hash2(i, 3) * 0.2;
      const r0 = S * (0.22 + hash2(i, 5) * 0.22);
      const r1 = S * 0.9;
      c.lineWidth = 1 + hash2(i, 9) * 3;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      c.stroke();
    }
    c.restore();
  }

  // ── PARTICLE SYSTEM (pooled) ─────────────────────────────────────────────
  const MAX_P = 900;
  const pool = [];
  let live = 0;
  for (let i = 0; i < MAX_P; i++) pool.push({ on: false });

  function emit(opts) {
    if (live >= (g.APEX_GRAPHICS?.getSnapshot?.().profile.particles || MAX_P)) return null;
    ensureBaked();
    let p = null;
    for (let i = 0; i < MAX_P; i++) { if (!pool[i].on) { p = pool[i]; break; } }
    if (!p) return null;
    p.on = true; live++;
    p.tex = opts.tex || 'glow';
    p.x = opts.x || 0; p.y = opts.y || 0;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.ax = opts.ax || 0; p.ay = opts.ay || 0;
    p.drag = opts.drag == null ? 1 : opts.drag;
    p.life = p.maxLife = Math.max(0.02, opts.life || 0.6);
    p.s0 = opts.s0 == null ? 20 : opts.s0;
    p.s1 = opts.s1 == null ? p.s0 * 0.4 : opts.s1;
    p.a0 = opts.a0 == null ? 1 : opts.a0;
    p.a1 = opts.a1 == null ? 0 : opts.a1;
    p.rot = opts.rot == null ? Math.random() * TAU : opts.rot;
    p.spin = opts.spin || 0;
    p.tint = opts.tint || null;
    p.blend = opts.blend || 'lighter';
    p.floorY = opts.floorY == null ? null : opts.floorY;
    p.bounce = opts.bounce == null ? 0.42 : opts.bounce;
    p.stretch = opts.stretch || 0;
    p.layer = opts.layer || 'over';
    return p;
  }

  function burst(x, y, n, cfg) {
    n = Math.max(1, Math.round(n * (g.APEX_GRAPHICS?.getSnapshot?.().profile.density ?? 1)));
    for (let i = 0; i < n; i++) {
      const a = cfg.angle == null ? Math.random() * TAU : cfg.angle + rnd(-(cfg.spread || 0.3), cfg.spread || 0.3);
      const sp = rnd(cfg.speedMin || 80, cfg.speedMax || 320);
      emit(Object.assign({}, cfg, {
        x: x + rnd(-(cfg.jitter || 0), cfg.jitter || 0), y: y + rnd(-(cfg.jitter || 0), cfg.jitter || 0),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rnd(cfg.lifeMin || 0.3, cfg.lifeMax || 0.8),
        s0: rnd(cfg.sMin || 10, cfg.sMax || 28),
        s1: cfg.s1,
        spin: rnd(-(cfg.spinMax || 3), cfg.spinMax || 3),
      }));
    }
  }

  function step(dt) {
    if (!live) return;
    for (let i = 0; i < MAX_P; i++) {
      const p = pool[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; live--; continue; }
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.floorY != null && p.y > p.floorY && p.vy > 0) {
        p.y = p.floorY; p.vy = -p.vy * p.bounce; p.vx *= 0.7; p.spin *= 0.6;
      }
    }
  }

  const tintCache = new Map();
  function tintedTex(name, tint) {
    if (!tint) return TEX[name];
    const key = name + '|' + tint;
    let cv = tintCache.get(key);
    if (cv) return cv;
    const src = TEX[name];
    cv = mk(src.width, src.height);
    const c = cv.getContext('2d');
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = tint; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(src, 0, 0);
    tintCache.set(key, cv);
    return cv;
  }

  function draw(c, layer = 'over') {
    if (!live) return;
    ensureBaked();
    c.save();
    for (let i = 0; i < MAX_P; i++) {
      const p = pool[i];
      if (!p.on || p.layer !== layer) continue;
      const u = 1 - p.life / p.maxLife;
      const s = lerp(p.s0, p.s1, u);
      const a = lerp(p.a0, p.a1, u);
      if (a <= 0.005 || s <= 0.5) continue;
      const tex = tintedTex(p.tex, p.tint);
      if (!tex) continue;
      c.globalCompositeOperation = p.blend;
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(p.x, p.y);
      const rot = p.stretch ? Math.atan2(p.vy, p.vx) : p.rot;
      c.rotate(rot);
      const sx = p.stretch ? s * (1 + Math.min(2.5, Math.hypot(p.vx, p.vy) * p.stretch)) : s;
      c.drawImage(tex, -sx / 2, -s / 2, sx, s);
      c.setTransform(1, 0, 0, 1, 0, 0);
      // restore camera transform is caller's job: we re-apply via save/restore pattern
      c.restore(); c.save();
    }
    c.restore();
  }

  // Camera-safe draw: callers pass a function that re-applies the camera matrix.
  function drawInCamera(c, layer, applyCamera) {
    if (!live) return;
    ensureBaked();
    for (let i = 0; i < MAX_P; i++) {
      const p = pool[i];
      if (!p.on || p.layer !== layer) continue;
      const u = 1 - p.life / p.maxLife;
      const s = lerp(p.s0, p.s1, u);
      const a = lerp(p.a0, p.a1, u);
      if (a <= 0.005 || s <= 0.5) continue;
      const tex = tintedTex(p.tex, p.tint);
      if (!tex) continue;
      c.save();
      applyCamera(c);
      c.globalCompositeOperation = p.blend;
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(p.x, p.y);
      const rot = p.stretch ? Math.atan2(p.vy, p.vx) : p.rot;
      c.rotate(rot);
      const sx = p.stretch ? s * (1 + Math.min(2.5, Math.hypot(p.vx, p.vy) * p.stretch)) : s;
      c.drawImage(tex, -sx / 2, -s / 2, sx, s);
      c.restore();
    }
  }

  // ── high-level recipes ────────────────────────────────────────────────────
  const recipes = {
    muzzleFlash(x, y, ang, col) {
      burst(x, y, 6, { tex: 'spark', angle: ang, spread: 0.35, speedMin: 500, speedMax: 1100, lifeMin: 0.06, lifeMax: 0.14, sMin: 14, sMax: 30, s1: 4, tint: col, stretch: 0.004, drag: 0.9 });
      emit({ tex: 'glow', x, y, life: 0.09, s0: 60, s1: 20, tint: col });
    },
    impactSparks(x, y, n, col, floorY) {
      burst(x, y, n, { tex: 'spark', speedMin: 180, speedMax: 620, lifeMin: 0.25, lifeMax: 0.6, sMin: 10, sMax: 22, s1: 2, tint: col, ay: 1400, drag: 0.985, stretch: 0.003, floorY });
      emit({ tex: 'glow', x, y, life: 0.16, s0: 90, s1: 150, a0: 0.9, tint: col });
    },
    explosion(x, y, radius, floorY) {
      emit({ tex: 'glow', x, y, life: 0.2, s0: radius * 0.6, s1: radius * 2.4, a0: 1, tint: '#ffd9a0' });
      burst(x, y, 18, { tex: 'fire', speedMin: 40, speedMax: radius * 2.2, lifeMin: 0.35, lifeMax: 0.8, sMin: radius * 0.35, sMax: radius * 0.8, s1: radius * 0.1, drag: 0.93, spinMax: 2 });
      burst(x, y, 14, { tex: 'smoke', blend: 'source-over', speedMin: 30, speedMax: radius * 1.2, lifeMin: 0.8, lifeMax: 1.6, sMin: radius * 0.4, sMax: radius * 0.9, s1: radius * 1.6, a0: 0.55, drag: 0.96, spinMax: 1 });
      burst(x, y, 16, { tex: 'debris', blend: 'source-over', speedMin: 200, speedMax: 700, lifeMin: 0.7, lifeMax: 1.4, sMin: 6, sMax: 16, s1: 6, a0: 1, a1: 1, ay: 1600, drag: 0.99, spinMax: 12, floorY: floorY == null ? y + radius * 0.8 : floorY });
      burst(x, y, 22, { tex: 'spark', speedMin: 300, speedMax: 1000, lifeMin: 0.3, lifeMax: 0.7, sMin: 10, sMax: 26, s1: 2, tint: '#ffb347', ay: 1200, drag: 0.98, stretch: 0.003 });
    },
    frostBloom(x, y, radius) {
      emit({ tex: 'frost', x, y, life: 1.4, s0: radius * 0.4, s1: radius * 2.1, a0: 1, a1: 0, spin: 0.4, tint: '#bff5ff' });
      burst(x, y, 20, { tex: 'shardCyan', blend: 'source-over', speedMin: 120, speedMax: radius * 2.4, lifeMin: 0.5, lifeMax: 1.1, sMin: 10, sMax: 26, s1: 4, ay: 900, drag: 0.985, spinMax: 9, floorY: y + radius * 0.5 });
      burst(x, y, 14, { tex: 'smoke', blend: 'source-over', speedMin: 20, speedMax: 90, lifeMin: 1.2, lifeMax: 2.2, sMin: 40, sMax: 90, s1: 140, a0: 0.35, tint: '#9fe8ff', drag: 0.97 });
    },
    crystalShatter(x, y, n, hue) {
      const tex = hue === 'cyan' ? 'shardCyan' : hue === 'gold' ? 'shardGold' : 'shardViolet';
      burst(x, y, n, { tex, blend: 'source-over', speedMin: 160, speedMax: 720, lifeMin: 0.6, lifeMax: 1.3, sMin: 12, sMax: 30, s1: 6, ay: 1100, drag: 0.985, spinMax: 10, floorY: y + 60 });
      emit({ tex: 'glow', x, y, life: 0.25, s0: 120, s1: 260, tint: hue === 'cyan' ? '#8ff' : hue === 'gold' ? '#ffd166' : '#d9a6ff' });
    },
    plasmaBurst(x, y, size, col) {
      emit({ tex: 'plasma', x, y, life: 0.22, s0: size * 0.6, s1: size * 1.5, a0: 1, tint: col, spin: 6 });
      emit({ tex: 'plasma', x, y, life: 0.3, s0: size * 0.9, s1: size * 0.3, a0: 0.8, tint: col, rot: 1.3, spin: -4 });
      burst(x, y, 10, { tex: 'spark', speedMin: 200, speedMax: 700, lifeMin: 0.18, lifeMax: 0.4, sMin: 8, sMax: 18, s1: 2, tint: col, stretch: 0.003 });
    },
    thrusterPuff(x, y, ang, col) {
      emit({ tex: 'glow', x, y, vx: Math.cos(ang) * 140 + rnd(-30, 30), vy: Math.sin(ang) * 140 + rnd(-30, 30), life: 0.22, s0: 18, s1: 4, tint: col, a0: 0.8 });
      emit({ tex: 'smoke', blend: 'source-over', x, y, vx: Math.cos(ang) * 90, vy: Math.sin(ang) * 90, life: 0.5, s0: 12, s1: 40, a0: 0.28 });
    },
    trailEmber(x, y, col) {
      emit({ tex: 'fire', x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-40, 40), vy: rnd(-80, -20), life: rnd(0.25, 0.5), s0: rnd(14, 26), s1: 4, tint: col });
    },
  };

  g.APEX_EVOLUTION_VFX = {
    ensureBaked,
    tex: () => (ensureBaked(), TEX),
    fbm, vnoise,
    emit, burst, step, draw, drawInCamera,
    liveCount: () => live,
    clear() { for (const p of pool) p.on = false; live = 0; },
    drawLightning: drawLightningPath,
    drawShard: drawFacetedShard,
    drawDendrite,
    drawSpeedLines,
    recipes,
  };
  g.apexEvolutionVfxLibrary = 'ready';
})(window);
