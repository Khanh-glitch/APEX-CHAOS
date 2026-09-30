// Generated from hash-verified Frost Gold Fusion by tools/bridgeFrostGoldV1.mjs.
(function(){
// ===== MATH =====
// Core math: exact spring-dampers (after Daniel Holden, "Spring-It-On"),
// deterministic RNG, small vector helpers. No per-frame allocation in hot paths.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sat = (v) => clamp(v, 0, 1);
const smooth = (a, b, v) => {
    const t = sat((v - a) / (b - a));
    return t * t * (3 - 2 * t);
};
const easeOutCubic = (t) => 1 - Math.pow(1 - sat(t), 3);
const easeOutQuart = (t) => 1 - Math.pow(1 - sat(t), 4);
const easeInCubic = (t) => sat(t) ** 3;
const easeOutBack = (t, s = 1.7) => {
    const u = sat(t) - 1;
    return 1 + u * u * ((s + 1) * u + s);
};
// ---- deterministic RNG (mulberry32) so Reset replays identically
class Rng {
    constructor(seed = 1) {
        this.s = seed >>> 0;
    }
    next() {
        let t = (this.s += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) {
        return a + (b - a) * this.next();
    }
    sign() {
        return this.next() < 0.5 ? -1 : 1;
    }
}
// hash-based 1D value noise for art-directable irregularity
function hash1(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
}
function noise1(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(hash1(i), hash1(i + 1), u);
}
// ---- Holden exact spring damper (under/critically damped via damping ratio)
const LN2 = 0.69314718056;
const fastNegExp = (x) => 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
/** critically damped – used for smooth followers (camera, lag) */
class Crit {
    constructor(x = 0) {
        this.v = 0;
        this.x = x;
    }
    step(goal, halflife, dt) {
        const y = (4 * LN2) / (halflife + 1e-5) / 2;
        const j0 = this.x - goal;
        const j1 = this.v + j0 * y;
        const e = fastNegExp(y * dt);
        this.x = e * (j0 + j1 * dt) + goal;
        this.v = e * (this.v - j1 * y * dt);
        return this.x;
    }
}
/** under-damped spring with frequency + damping ratio: overshoot & weighted settle */
class Spring {
    constructor(x = 0, freq = 6, zeta = 0.5) {
        this.v = 0;
        this.x = x;
        this.goal = x;
        this.freq = freq;
        this.zeta = zeta;
    }
    kick(v) {
        this.v += v;
    }
    step(dt) {
        // semi-implicit integration at fixed 120Hz sub-steps is stable for these ranges
        const w = TAU * this.freq;
        const k = w * w;
        const c = 2 * this.zeta * w;
        const a = k * (this.goal - this.x) - c * this.v;
        this.v += a * dt;
        this.x += this.v * dt;
        return this.x;
    }
}
function damp(x, goal, halflife, dt) {
    return lerp(x, goal, 1 - fastNegExp((LN2 * dt) / (halflife + 1e-5)));
}
function angDiff(a, b) {
    let d = b - a;
    while (d > Math.PI)
        d -= TAU;
    while (d < -Math.PI)
        d += TAU;
    return d;
}
const len = (x, y) => Math.hypot(x, y);


// ===== ASSET =====
// AUTO-GENERATED from the approved Frost source art (cleaned + segmented in art/build_layers.py).
const FROST_META = { "w": 622, "h": 767, "center": [310.8, 392.0], "browLPivot": [290.08, 428.96], "browRPivot": [331.52, 428.96], "jawPivot": [310.8, 523.6], "crestPivot": [310.8, 324.8], "vent": [310.8, 495.6], "eyeL": [234.64, 431.2], "eyeR": [386.96, 431.2], "crackTop": [308.0, 72.8], "crackBot": [310.8, 319.2] };
const FROST_LAYERS = {
    base: "/assets/hero-rework/frost-v1/base.png",
    crest: "/assets/hero-rework/frost-v1/crest.png",
    browL: "/assets/hero-rework/frost-v1/browL.png",
    browR: "/assets/hero-rework/frost-v1/browR.png",
    jaw: "/assets/hero-rework/frost-v1/jaw.png",
    eyes: "/assets/hero-rework/frost-v1/eyes.png",
    crack: "/assets/hero-rework/frost-v1/crack.png",
    cavity: "/assets/hero-rework/frost-v1/cavity.png",
    sil: "/assets/hero-rework/frost-v1/sil.png",
};


// ===== SHAPES =====
// FROST SHAPE LIBRARY — filled, outlined, direction-aware shape families.
// Hierarchy rule: primary mass -> secondary structure -> small accents -> haze last.
// Every family has a birth / growth / breakup lifecycle. Pools are preallocated.
const PAL = {
    navy: "#10284c",
    navySoft: "rgba(16,40,76,0.85)",
    deep: "#2a6cb5",
    blue: "#4f98d6",
    mid: "#8cc3e8",
    light: "#cde7f6",
    white: "#f6fbfe",
    cyan: "#46e6f5",
    outlineIce: "#4a86bd",
};
const R = new Rng(9001);
const rnd = (a, b) => R.range(a, b);
const CHIPS = Array.from({ length: 320 }, () => ({
    on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vrot: 0, L: 4, W: 2, skew: 0,
    age: 0, life: 1, settle: 0, outline: true, fric: 4,
}));
let chipCursor = 0;
function spawnChip(x, y, ang, speed, L, opts = {}) {
    for (let n = 0; n < CHIPS.length; n++) {
        const c = CHIPS[(chipCursor + n) % CHIPS.length];
        if (c.on)
            continue;
        chipCursor = (chipCursor + n + 1) % CHIPS.length;
        c.on = true;
        c.x = x;
        c.y = y;
        c.z = opts.z ?? 0;
        c.vx = Math.cos(ang) * speed;
        c.vy = Math.sin(ang) * speed;
        c.vz = opts.vz ?? rnd(40, 140);
        c.rot = ang + rnd(-0.4, 0.4);
        c.vrot = opts.vrot ?? rnd(-9, 9);
        c.L = L;
        c.W = L * (opts.W ?? rnd(0.36, 0.5));
        c.skew = rnd(-0.35, 0.35);
        c.age = 0;
        c.life = opts.life ?? rnd(1.1, 1.9);
        c.settle = 0;
        c.outline = opts.outline ?? L > 4.2;
        c.fric = opts.fric ?? 3.2;
        return c;
    }
    return null;
}
/** hierarchical cluster: 1–2 large, several small, shared direction */
function chipCluster(x, y, ang, spread, n, speed, size, extra = {}) {
    for (let i = 0; i < n; i++) {
        const big = i < (n > 4 ? 2 : 1);
        const L = big ? size * rnd(0.9, 1.15) : size * rnd(0.38, 0.66);
        const a = ang + rnd(-spread, spread) * (big ? 0.5 : 1);
        const sp = speed * (big ? rnd(0.7, 0.95) : rnd(0.85, 1.35));
        spawnChip(x + rnd(-2, 2), y + rnd(-2, 2), a, sp, L, { vz: big ? rnd(50, 110) : rnd(70, 170), ...extra });
    }
}
function updateChips(dt) {
    for (const c of CHIPS) {
        if (!c.on)
            continue;
        c.age += dt;
        // ballistic hop in z, sliding friction on floor (stronger once grounded)
        if (c.z > 0 || c.vz > 0) {
            c.vz -= 900 * dt;
            c.z += c.vz * dt;
            if (c.z <= 0) {
                c.z = 0;
                c.vz = c.vz < -60 ? -c.vz * 0.28 : 0; // tiny bounce
                c.vx *= 0.7;
                c.vy *= 0.7;
                c.vrot *= 0.5;
            }
        }
        const grounded = c.z <= 0.01 && c.vz === 0;
        const f = Math.exp(-(grounded ? c.fric * 1.6 : 0.6) * dt);
        c.vx *= f;
        c.vy *= f;
        c.vrot *= Math.exp(-(grounded ? 6 : 1) * dt);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vrot * dt;
        if (grounded && Math.hypot(c.vx, c.vy) < 12)
            c.settle += dt;
        if (c.age > c.life)
            c.on = false;
    }
}
function chipPath(ctx, L, W, sk) {
    // asymmetric faceted shard: long tip, broken back
    ctx.beginPath();
    ctx.moveTo(L, 0);
    ctx.lineTo(L * 0.18, -W * (0.95 + sk * 0.3));
    ctx.lineTo(-L * 0.62, -W * 0.55);
    ctx.lineTo(-L * 0.78, W * (0.12 + sk * 0.2));
    ctx.lineTo(-L * 0.2, W * (0.9 - sk * 0.3));
    ctx.closePath();
}
function drawChips(ctx, px) {
    for (const c of CHIPS) {
        if (!c.on)
            continue;
        const melt = smooth(c.life - 0.45, c.life, c.age);
        const s = (1 - melt * 0.75) * (0.5 + 0.5 * smooth(0, 0.04, c.age));
        const L = c.L * s, W = c.W * s;
        const hot = 1 - smooth(0.03, 0.14, c.age); // born white (guides the eye), then cools
        // floor shadow (separates airborne chips from floor on light gray)
        ctx.save();
        ctx.translate(c.x + c.z * 0.25, c.y + c.z * 0.45);
        ctx.rotate(c.rot);
        ctx.globalAlpha = (0.22 - melt * 0.2) * (c.z > 0 ? 0.8 : 1);
        ctx.fillStyle = "#2b4a6e";
        chipPath(ctx, L * 0.9, W * 0.9, c.skew);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(c.x, c.y - c.z * 0.35);
        ctx.rotate(c.rot);
        const zs = 1 + c.z / 160;
        ctx.scale(zs, zs);
        ctx.globalAlpha = 1 - melt;
        chipPath(ctx, L, W, c.skew);
        ctx.fillStyle = hot > 0.5 ? PAL.white : PAL.blue;
        ctx.fill();
        // lit facet
        ctx.beginPath();
        ctx.moveTo(L, 0);
        ctx.lineTo(L * 0.18, -W * (0.95 + c.skew * 0.3));
        ctx.lineTo(-L * 0.62, -W * 0.55);
        ctx.lineTo(-L * 0.3, W * 0.1);
        ctx.closePath();
        ctx.fillStyle = hot > 0.2 ? "#ffffff" : PAL.white;
        ctx.fill();
        if (c.outline) {
            chipPath(ctx, L, W, c.skew);
            ctx.lineWidth = Math.max(px, 0.9) / zs;
            ctx.strokeStyle = PAL.navySoft;
            ctx.stroke();
        }
        ctx.restore();
    }
}
const SHARDS = Array.from({ length: 260 }, () => ({ on: false, x: 0, y: 0, a: 0, L: 0, W: 0, age: 0, life: 0, skew: 0, delay: 0 }));
function spawnShard(x, y, a, L, W, life = 0.5, delay = 0) {
    for (const s of SHARDS) {
        if (s.on)
            continue;
        s.on = true;
        s.x = x;
        s.y = y;
        s.a = a;
        s.L = L;
        s.W = W;
        s.age = -delay;
        s.life = life;
        s.skew = rnd(-0.3, 0.3);
        s.delay = delay;
        return s;
    }
    return null;
}
function drawShards(ctx, px) {
    for (const s of SHARDS) {
        if (!s.on || s.age < 0)
            continue;
        const t = s.age;
        const grow = easeOutBack(t / 0.07, 2.2);
        const flat = smooth(s.life * 0.35, s.life, t); // flatten into ice
        const L = s.L * grow * (1 - 0.72 * flat);
        const W = s.W * (0.6 + 0.4 * sat(t / 0.05)) * (1 + 0.25 * flat);
        const hot = 1 - smooth(0.02, 0.1, t);
        const fade = 1 - smooth(s.life * 0.7, s.life, t);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.a);
        ctx.globalAlpha = fade;
        // body (shadow side)
        ctx.beginPath();
        ctx.moveTo(-W * 0.3, -W);
        ctx.lineTo(L * 0.55, -W * (0.85 + s.skew));
        ctx.lineTo(L, W * s.skew * 0.6);
        ctx.lineTo(L * 0.5, W * (0.95 - s.skew * 0.5));
        ctx.lineTo(-W * 0.3, W);
        ctx.closePath();
        ctx.fillStyle = hot > 0.4 ? PAL.white : flat > 0.55 ? PAL.mid : "#79b4e2";
        ctx.fill();
        ctx.lineWidth = Math.max(px, 0.85);
        ctx.strokeStyle = flat > 0.6 ? "rgba(58,110,170,0.7)" : PAL.navySoft;
        ctx.stroke();
        // lit facet
        ctx.beginPath();
        ctx.moveTo(-W * 0.3, -W);
        ctx.lineTo(L * 0.55, -W * (0.85 + s.skew));
        ctx.lineTo(L, W * s.skew * 0.6);
        ctx.lineTo(L * 0.2, W * 0.15);
        ctx.closePath();
        ctx.fillStyle = PAL.white;
        ctx.fill();
        ctx.restore();
    }
}
const LOBES = Array.from({ length: 200 }, () => ({ on: false, x: 0, y: 0, a: 0, rx: 0, ry: 0, age: 0, life: 0, seed: 0, delay: 0, tint: 0, vx: 0, vy: 0 }));
function spawnLobe(x, y, a, rx, ry, life = 0.6, delay = 0, vx = 0, vy = 0) {
    for (const l of LOBES) {
        if (l.on)
            continue;
        l.on = true;
        l.x = x;
        l.y = y;
        l.a = a;
        l.rx = rx;
        l.ry = ry;
        l.age = -delay;
        l.life = life;
        l.seed = rnd(0, 1000);
        l.delay = delay;
        l.tint = rnd(0, 1);
        l.vx = vx;
        l.vy = vy;
        return l;
    }
    return null;
}
function blobPath(ctx, rx, ry, seed, n = 7, amp = 0.28) {
    // rounded-lumpy closed shape via quadratic midpoints through jittered radial points
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.sin(seed + i * 1.7) * 0.25;
        const r = 1 - amp + amp * 2 * (0.5 + 0.5 * Math.sin(seed * 1.31 + i * 2.39));
        pts.push(Math.cos(a) * rx * r, Math.sin(a) * ry * r);
    }
    ctx.beginPath();
    const mx = (pts[0] + pts[2 * (n - 1)]) / 2, my = (pts[1] + pts[2 * (n - 1) + 1]) / 2;
    ctx.moveTo(mx, my);
    for (let i = 0; i < n; i++) {
        const x = pts[2 * i], y = pts[2 * i + 1];
        const j = (i + 1) % n;
        ctx.quadraticCurveTo(x, y, (x + pts[2 * j]) / 2, (y + pts[2 * j + 1]) / 2);
    }
    ctx.closePath();
}
function drawLobes(ctx, px) {
    for (const l of LOBES) {
        if (!l.on || l.age < 0)
            continue;
        const t = l.age;
        const g = easeOutBack(t / 0.12, 1.6);
        const settle = smooth(0.18, l.life, t);
        const fade = 1 - smooth(l.life * 0.55, l.life, t);
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.a);
        ctx.scale(g * (1 - 0.35 * settle), g * (1 + 0.1 * settle));
        ctx.globalAlpha = fade;
        // shade underside (offset) -> gives the crust volume on light floor
        ctx.save();
        ctx.translate(l.ry * 0.12, l.ry * 0.16);
        blobPath(ctx, l.rx, l.ry, l.seed);
        ctx.fillStyle = settle > 0.5 ? "#a8d3ef" : "#8fc2e6";
        ctx.fill();
        ctx.restore();
        blobPath(ctx, l.rx, l.ry, l.seed);
        ctx.fillStyle = l.tint > 0.5 ? PAL.white : "#eaf6fd";
        ctx.fill();
        ctx.lineWidth = Math.max(px * 0.9, 0.7);
        ctx.strokeStyle = `rgba(74,134,189,${0.75 * (1 - settle)})`;
        ctx.stroke();
        // inner packed highlight
        ctx.translate(-l.rx * 0.18, -l.ry * 0.2);
        blobPath(ctx, l.rx * 0.45, l.ry * 0.42, l.seed + 3, 6, 0.2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();
    }
}
function updateLobes(dt) {
    for (const l of LOBES) {
        if (!l.on)
            continue;
        l.age += dt;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        const f = Math.exp(-7 * dt);
        l.vx *= f;
        l.vy *= f;
        if (l.age > l.life)
            l.on = false;
    }
}
const WEDGES = Array.from({ length: 40 }, () => ({ on: false, x: 0, y: 0, a: 0, L: 0, half: 0, age: 0, life: 0, seed: 0, drift: 0 }));
function spawnWedge(x, y, a, L, half = 0.42, life = 0.7) {
    for (const w of WEDGES) {
        if (w.on)
            continue;
        w.on = true;
        w.x = x;
        w.y = y;
        w.a = a;
        w.L = L;
        w.half = half;
        w.age = 0;
        w.life = life;
        w.seed = rnd(0, 100);
        w.drift = rnd(0.18, 0.3);
        return w;
    }
    return null;
}
function wedgePath(ctx, L, half, s0, seed) {
    // apex region eroded by s0 (fan detaches from origin as it ages)
    const n = 12;
    ctx.beginPath();
    const a0 = s0 * L;
    ctx.moveTo(a0, -Math.tan(half) * a0 * 0.8);
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const ang = -half + 2 * half * t;
        const bump = 1 + 0.13 * Math.sin(seed + t * 9.5) + 0.06 * Math.sin(seed * 2 + t * 23);
        const r = L * bump * (1 - 0.12 * Math.abs(t - 0.5) * 2);
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.lineTo(a0, Math.tan(half) * a0 * 0.8);
    ctx.closePath();
}
function drawWedges(ctx) {
    for (const w of WEDGES) {
        if (!w.on)
            continue;
        const t = w.age / w.life;
        const ext = easeOutCubic(w.age / 0.11);
        const L = w.L * (ext + w.drift * t);
        const s0 = smooth(0.15, 0.9, t) * 0.75;
        const fade = 1 - smooth(0.35, 1, t);
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.a);
        // three nested fills: soft outer body, denser mid, packed core (no radial gradients)
        ctx.globalAlpha = 0.4 * fade;
        ctx.fillStyle = "#dcedf8";
        wedgePath(ctx, L * 1.08, w.half * 1.12, s0, w.seed);
        ctx.fill();
        ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = "#eef7fc";
        wedgePath(ctx, L * 0.9, w.half * 0.9, s0 * 1.1, w.seed + 2);
        ctx.fill();
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = "#ffffff";
        wedgePath(ctx, L * 0.62, w.half * 0.6, s0 * 1.2, w.seed + 5);
        ctx.fill();
        // cool shadow lip on the leading arc for value separation on light floor
        ctx.globalAlpha = 0.35 * fade;
        ctx.strokeStyle = "#7fb3dc";
        ctx.lineWidth = 1.1;
        wedgePath(ctx, L * 1.08, w.half * 1.12, s0, w.seed);
        ctx.stroke();
        ctx.restore();
    }
}
const RIBBONS = Array.from({ length: 48 }, () => ({ on: false, x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, W: 0, age: 0, life: 0, curl: 0, vx: 0, vy: 0, grow: 0.08, shredAt: 0.55, core: 1, tone: 0 }));
function spawnRibbon(x, y, a, L, W, bend, life, opts = {}) {
    for (const r of RIBBONS) {
        if (r.on)
            continue;
        const ca = Math.cos(a), sa = Math.sin(a);
        r.on = true;
        r.x0 = x;
        r.y0 = y;
        r.x2 = x + ca * L;
        r.y2 = y + sa * L;
        r.x1 = x + ca * L * 0.5 - sa * bend;
        r.y1 = y + sa * L * 0.5 + ca * bend;
        r.W = W;
        r.age = 0;
        r.life = life;
        r.curl = opts.curl ?? rnd(-1, 1);
        r.vx = opts.vx ?? ca * 40;
        r.vy = opts.vy ?? sa * 40;
        r.grow = opts.grow ?? 0.08;
        r.shredAt = opts.shredAt ?? 0.55;
        r.core = opts.core ?? 1;
        r.tone = opts.tone ?? 0;
        return r;
    }
    return null;
}
const SP = new Float32Array(64);
function ribbonSegment(ctx, r, sa, sb, Wm, curlAmt) {
    const n = 16;
    // sample spine
    for (let i = 0; i <= n; i++) {
        const t = sa + (sb - sa) * (i / n);
        const u = 1 - t;
        let x = u * u * r.x0 + 2 * u * t * r.x1 + t * t * r.x2;
        let y = u * u * r.y0 + 2 * u * t * r.y1 + t * t * r.y2;
        // curl: late-life lateral wave growing toward the tip
        const dx = r.x2 - r.x0, dy = r.y2 - r.y0, dl = Math.hypot(dx, dy) || 1;
        const k = Math.sin(t * 5.5 + r.curl * 3) * curlAmt * t * dl * 0.09;
        x += (-dy / dl) * k;
        y += (dx / dl) * k;
        SP[i * 2] = x;
        SP[i * 2 + 1] = y;
    }
    ctx.beginPath();
    // left side
    for (let i = 0; i <= n; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1);
        let tx = SP[i1 * 2] - SP[i0 * 2], ty = SP[i1 * 2 + 1] - SP[i0 * 2 + 1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const u = i / n;
        const w = Wm * Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 0.65) * (1 - 0.35 * u);
        const X = SP[i * 2] - ty * w, Y = SP[i * 2 + 1] + tx * w;
        if (i === 0)
            ctx.moveTo(X, Y);
        else
            ctx.lineTo(X, Y);
    }
    for (let i = n; i >= 0; i--) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1);
        let tx = SP[i1 * 2] - SP[i0 * 2], ty = SP[i1 * 2 + 1] - SP[i0 * 2 + 1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const u = i / n;
        const w = Wm * 0.8 * Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 0.65) * (1 - 0.35 * u);
        ctx.lineTo(SP[i * 2] + ty * w, SP[i * 2 + 1] - tx * w);
    }
    ctx.closePath();
}
function drawRibbons(ctx) {
    for (const r of RIBBONS) {
        if (!r.on)
            continue;
        const t = r.age / r.life;
        const head = easeOutCubic(r.age / (r.life * r.grow + 0.001));
        const tail = smooth(0.25, 1, t); // tail retracts forward: the breath dies quickly
        const Wm = r.W * (1 - 0.55 * smooth(0.4, 1, t));
        const fade = 1 - smooth(0.6, 1, t);
        const curl = smooth(0.2, 1, t) * 1.3;
        const shred = smooth(r.shredAt, r.shredAt + 0.25, t);
        const pieces = shred > 0.02
            ? [[tail, lerp(head, tail + (head - tail) * 0.48, shred)], [tail + (head - tail) * (0.52 + 0.1 * shred), head]]
            : [[tail, head]];
        for (const [a, b] of pieces) {
            if (b - a < 0.02)
                continue;
            ctx.globalAlpha = 0.55 * fade;
            ctx.fillStyle = r.tone ? "#bfe6f7" : "#d4eefa";
            ribbonSegment(ctx, r, a, b, Wm * 1.25, curl);
            ctx.fill();
            ctx.globalAlpha = 0.9 * fade * r.core;
            ctx.fillStyle = "#ffffff";
            ribbonSegment(ctx, r, a, b, Wm * 0.62, curl);
            ctx.fill();
            ctx.globalAlpha = 0.5 * fade;
            ctx.strokeStyle = "#78b2de";
            ctx.lineWidth = 0.9;
            ribbonSegment(ctx, r, a, b, Wm * 1.25, curl);
            ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
}
function updateRibbons(dt) {
    for (const r of RIBBONS) {
        if (!r.on)
            continue;
        r.age += dt;
        const f = Math.exp(-3 * dt);
        r.vx *= f;
        r.vy *= f;
        r.x0 += r.vx * dt * 1.4;
        r.y0 += r.vy * dt * 1.4;
        r.x1 += r.vx * dt;
        r.y1 += r.vy * dt;
        r.x2 += r.vx * dt * 0.6;
        r.y2 += r.vy * dt * 0.6;
        if (r.age > r.life)
            r.on = false;
    }
}
function updateShapes(dt) {
    updateChips(dt);
    for (const s of SHARDS)
        if (s.on) {
            s.age += dt;
            if (s.age > s.life)
                s.on = false;
        }
    updateLobes(dt);
    for (const w of WEDGES)
        if (w.on) {
            w.age += dt;
            if (w.age > w.life)
                w.on = false;
        }
    updateRibbons(dt);
}
/** floor-level layer (drawn under actors): wedges, lobes, crown shards, grounded chips */
function drawFloorShapes(ctx, px) {
    drawWedges(ctx);
    drawLobes(ctx, px);
    drawShards(ctx, px);
}
function drawAirShapes(ctx, px) {
    drawChips(ctx, px);
}
function drawRibbonLayer(ctx) {
    drawRibbons(ctx);
}
function clearShapes() {
    for (const c of CHIPS)
        c.on = false;
    for (const s of SHARDS)
        s.on = false;
    for (const l of LOBES)
        l.on = false;
    for (const w of WEDGES)
        w.on = false;
    for (const r of RIBBONS)
        r.on = false;
}


// ===== ICE =====
// FROZEN FLOOR MATERIAL SYSTEM
// Shared by A1 lane, A2 trail, underfoot pads and freeze patches.
// Law: PRESSURE/VAPOR -> PACKED FROST (white) -> THIN ICE -> STABLE ICE -> EDGE LOSS/CRACK -> THAW
// Rendering: all node plates are filled OPAQUE into one offscreen layer in ordered passes
// (union => no alpha stacking where trails overlap), then detail is clipped with source-atop.
const NV = 8;
const rng = new Rng(4242);
class IceField {
    constructor(w, h) {
        this.nodes = [];
        this.carves = [];
        this.wets = [];
        this.facetPaths = [];
        this.facetStyles = ["rgba(255,255,255,0.26)", "rgba(255,255,255,0.1)", "rgba(38,104,170,0.07)", "rgba(38,104,170,0.15)"];
        // jittered-grid low-poly facet mesh (matches the faceted cel language of the source art)
        const S = 36;
        const cols = Math.ceil(w / S) + 3, rows = Math.ceil(h / S) + 3;
        const P = [];
        const r = new Rng(77);
        for (let j = 0; j < rows; j++)
            for (let i = 0; i < cols; i++)
                P.push((i - 1) * S + r.range(-S * 0.38, S * 0.38) - w / 2, (j - 1) * S + r.range(-S * 0.38, S * 0.38) - h / 2);
        this.facetPaths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        const tri = (a, b, c) => {
            const k = Math.floor(r.next() * 4);
            const p = this.facetPaths[k];
            p.moveTo(P[a * 2], P[a * 2 + 1]);
            p.lineTo(P[b * 2], P[b * 2 + 1]);
            p.lineTo(P[c * 2], P[c * 2 + 1]);
            p.closePath();
        };
        for (let j = 0; j < rows - 1; j++)
            for (let i = 0; i < cols - 1; i++) {
                const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
                if ((i + j) % 2) {
                    tri(a, b, d);
                    tri(a, d, c);
                }
                else {
                    tri(a, b, c);
                    tri(b, d, c);
                }
            }
        // broad glossy sheen bands (fixed world direction => reads as one continuous surface)
        this.sheen = new Path2D();
        const ang = -0.5, ca = Math.cos(ang), sa = Math.sin(ang);
        for (let k = -12; k <= 12; k++) {
            const o = k * 150 + (k % 3) * 23, bw = 16 + (Math.abs(k) % 3) * 10;
            const pts = [[-1400, o], [1400, o], [1400, o + bw], [-1400, o + bw]];
            pts.forEach(([x, y], i) => {
                const X = x * ca - y * sa, Y = x * sa + y * ca;
                if (i === 0)
                    this.sheen.moveTo(X, Y);
                else
                    this.sheen.lineTo(X, Y);
            });
            this.sheen.closePath();
        }
    }
    clear() {
        this.nodes.length = 0;
        this.carves.length = 0;
        this.wets.length = 0;
    }
    add(x, y, ang, L, W, born, kind, opt = {}) {
        const ua = new Float32Array(NV), uc = new Float32Array(NV), er = new Float32Array(NV);
        const jag = opt.jag ?? 0.2;
        for (let k = 0; k < NV; k++) {
            const a = (k / NV) * TAU + rng.range(-0.22, 0.22);
            const rr = 1 + rng.range(-jag, jag);
            ua[k] = Math.cos(a) * rr;
            uc[k] = Math.sin(a) * rr * (k % 2 ? 1 : 1.08); // angular, slightly faceted
            er[k] = rng.next();
        }
        const n = {
            x, y, ca: Math.cos(ang), sa: Math.sin(ang), L, W, born,
            lockDur: opt.lockDur ?? 0.55, decayAt: Infinity, decayDur: 1.15,
            seed: rng.range(0, 1000), kind, ua, uc, er,
            spur: rng.next() < (opt.spurChance ?? 0) ? rng.sign() : 0,
            spurPos: rng.range(-0.5, 0.5), spurLen: rng.range(0.45, 0.9),
            cracks: [], crackAt: [], flow: rng.next(), released: false, dead: false,
            rimK: rng.range(0.85, 1.2),
        };
        this.nodes.push(n);
        return n;
    }
    addCarve(x, y, a, side, strength, born, trailW) {
        const c = {
            x, y, a, side, strength, born, decayAt: Infinity, dead: false,
            Rc: 31 + 17 * (1 - strength), off: trailW * 0.58, T: 8 + 10 * strength, span: 1.35 + 0.85 * strength,
        };
        this.carves.push(c);
        return c;
    }
    scheduleDecay(filter, start, spread, order) {
        for (const n of this.nodes) {
            if (!filter(n) || n.decayAt !== Infinity)
                continue;
            n.decayAt = start + order(n) * spread + hash1(n.seed) * 0.35;
        }
    }
    /** coverage test for on-ice locomotion */
    iceAt(x, y, t) {
        for (const n of this.nodes) {
            if (n.dead || t < n.born + 0.03)
                continue;
            const dx = x - n.x, dy = y - n.y;
            const a = dx * n.ca + dy * n.sa, c = -dx * n.sa + dy * n.ca;
            const w = n.W * this.widthF(n, t);
            if ((a * a) / ((n.L + 4) * (n.L + 4)) + (c * c) / ((w + 4) * (w + 4)) < 1)
                return true;
        }
        return false;
    }
    growF(n, t) {
        const age = t - n.born;
        return age <= 0 ? 0 : easeOutBack(age / 0.14, 1.9);
    }
    widthF(n, t) {
        const d = (t - n.decayAt) / n.decayDur;
        return this.growF(n, t) * (d > 0 ? 1 - smooth(0.25, 1, d) : 1);
    }
    update(t) {
        for (const n of this.nodes) {
            if (n.dead)
                continue;
            const age = t - n.born;
            // at lock: seed the sparse stable-plate cracks & flow marks
            if (age > n.lockDur && n.cracks.length === 0 && hash1(n.seed + 1) < (n.kind === "lane" ? 0.22 : 0.12))
                this.makeCrack(n, t + 0.02);
            const d = (t - n.decayAt) / n.decayDur;
            if (d > 0.05 && n.cracks.length < 2 && hash1(n.seed + 7) < 0.45)
                this.makeCrack(n, t);
            if (d > 0.3 && !n.released) {
                n.released = true;
                // edge crust breaks away: tiny chip clusters and a crust fragment
                if (hash1(n.seed + 3) < 0.4) {
                    const side = hash1(n.seed + 4) < 0.5 ? -1 : 1;
                    const ex = n.x - n.sa * n.W * side * 0.9, ey = n.y + n.ca * n.W * side * 0.9;
                    const out = Math.atan2(n.ca * side, -n.sa * side);
                    spawnChip(ex, ey, out + (hash1(n.seed) - 0.5), 30 + 40 * hash1(n.seed + 9), 3 + 2.5 * hash1(n.seed + 5), { vz: 30, life: 0.9, outline: true });
                    if (hash1(n.seed + 6) < 0.5)
                        spawnLobe(ex, ey, out, 3.5, 2.6, 0.45, 0, Math.cos(out) * 25, Math.sin(out) * 25);
                }
            }
            if (d >= 1) {
                n.dead = true;
                this.wets.push({ x: n.x, y: n.y, r: Math.max(n.W, n.L) * 1.05, born: t });
            }
        }
        for (const c of this.carves)
            if ((t - c.decayAt) / 1.1 >= 1)
                c.dead = true;
        if (this.nodes.length > 40 && this.nodes[0].dead)
            this.nodes = this.nodes.filter((n) => !n.dead);
        if (this.carves.length && this.carves[0].dead)
            this.carves = this.carves.filter((c) => !c.dead);
        if (this.wets.length && t - this.wets[0].born > 1.6)
            this.wets = this.wets.filter((w) => t - w.born <= 1.6);
    }
    makeCrack(n, at) {
        const side = hash1(n.seed + n.cracks.length * 3) < 0.5 ? -1 : 1;
        const pts = [];
        let a = n.L * (hash1(n.seed + 11 + n.cracks.length) - 0.5) * 1.2;
        let c = side * n.W * 0.92;
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            pts.push(n.x + n.ca * a - n.sa * c, n.y + n.sa * a + n.ca * c);
            a += (hash1(n.seed + i * 5.3) - 0.5) * n.W * 0.7;
            c -= side * n.W * (0.18 + 0.12 * hash1(n.seed + i));
        }
        n.cracks.push(new Float32Array(pts));
        n.crackAt.push(at);
    }
    polyNode(ctx, n, sL, sW, e, t, ox = 0, oy = 0) {
        const d = (t - n.decayAt) / n.decayDur;
        const g = this.growF(n, t);
        const L = n.L * g * sL + e, W = n.W * g * sW + e;
        ctx.beginPath();
        for (let k = 0; k < NV; k++) {
            let er = 1;
            if (d > 0)
                er = 1 - smooth(0.2 + 0.25 * n.er[k], 0.95 - 0.1 * n.er[k], d); // irregular recession
            const px = n.ua[k] * L * er, py = n.uc[k] * W * er;
            const X = n.x + ox + n.ca * px - n.sa * py, Y = n.y + oy + n.sa * px + n.ca * py;
            if (k === 0)
                ctx.moveTo(X, Y);
            else
                ctx.lineTo(X, Y);
            // ice finger spur growing into the floor
            if (n.spur && ((n.spur > 0 && k === 2) || (n.spur < 0 && k === 6)) && sW > 0.9) {
                const sp = n.spurLen * smooth(0.04, 0.3, t - n.born) * (d > 0 ? 1 - smooth(0, 0.4, d) : 1);
                const tipA = n.spurPos * n.L * g, tipC = n.spur * (W + n.W * sp);
                ctx.lineTo(n.x + ox + n.ca * tipA - n.sa * tipC, n.y + oy + n.sa * tipA + n.ca * tipC);
            }
        }
        ctx.closePath();
    }
    carvePath(ctx, c, t, inset, grow) {
        const reveal = smooth(0, 0.08, t - c.born);
        const d = (t - c.decayAt) / 1.1;
        const k = (d > 0 ? 1 - smooth(0, 1, d) : 1) * grow;
        if (reveal <= 0 || k <= 0)
            return false;
        const ca = Math.cos(c.a), sa = Math.sin(c.a);
        const N = 14;
        const ph0 = -c.span / 2, ph1 = ph0 + c.span * reveal;
        ctx.beginPath();
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i <= N; i++) {
                const u = pass === 0 ? i / N : 1 - i / N;
                const ph = ph0 + (ph1 - ph0) * u;
                const taper = Math.pow(Math.sin(Math.PI * u), 0.75);
                const r = c.Rc + c.off + (pass === 0 ? c.T * taper * k - inset * taper : inset * taper);
                // local: x along tangent (motion), y toward outside of the turn
                const lx = Math.sin(ph) * r, ly = -c.Rc + Math.cos(ph) * r;
                const X = c.x + ca * lx - sa * ly * c.side, Y = c.y + sa * lx + ca * ly * c.side;
                if (pass === 0 && i === 0)
                    ctx.moveTo(X, Y);
                else
                    ctx.lineTo(X, Y);
            }
        }
        ctx.closePath();
        return true;
    }
    /** floor-level wet marks left by thawed ice (drawn on floor before ice) */
    drawWet(ctx, t) {
        for (const w of this.wets) {
            const a = 1 - (t - w.born) / 1.6;
            if (a <= 0)
                continue;
            ctx.globalAlpha = 0.1 * a;
            ctx.fillStyle = "#5d7890";
            ctx.beginPath();
            ctx.ellipse(w.x, w.y, w.r * (1 - 0.3 * (1 - a)), w.r * 0.8 * (1 - 0.3 * (1 - a)), 0, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    render(ctx, t, px) {
        const live = this.nodes.filter((n) => !n.dead && t > n.born);
        const carves = this.carves.filter((c) => !c.dead && t > c.born);
        if (!live.length && !carves.length)
            return false;
        // P0: cast shadow of the ice slab (opaque, merged) – physical elevation on light floor
        ctx.fillStyle = "#c3cad0";
        for (const n of live) {
            this.polyNode(ctx, n, 1, 1, 1.8, t, 1.2, 2.2);
            ctx.fill();
        }
        // P1: steel-blue slab edge
        ctx.fillStyle = "#5a92c4";
        for (const n of live) {
            this.polyNode(ctx, n, 1, 1, 1.5, t);
            ctx.fill();
        }
        for (const c of carves)
            if (this.carvePath(ctx, c, t, -1.5, 1))
                ctx.fill();
        // P2: packed frost band (white). Disappears first during decay (edge loses frost)
        for (const n of live) {
            const d = (t - n.decayAt) / n.decayDur;
            ctx.fillStyle = d > 0 ? (d > 0.3 ? "#b4d6ec" : "#dcecf6") : "#f4f9fd";
            this.polyNode(ctx, n, 1, 1, 0, t);
            ctx.fill();
        }
        ctx.fillStyle = "#f4f9fd";
        for (const c of carves)
            if (this.carvePath(ctx, c, t, 0, 1))
                ctx.fill();
        // P3: ice body – grows from the plate centre outward as frost converts (lock)
        for (const n of live) {
            const age = t - n.born;
            const lock = smooth(0.06, n.lockDur, age);
            if (lock <= 0.01)
                continue;
            const d = (t - n.decayAt) / n.decayDur;
            const rim = (n.kind === "trail" ? 2.6 : 3.4) * n.rimK * (d > 0 ? 1 - smooth(0, 0.3, d) : 1);
            const sW = lock * Math.max(0, 1 - rim / n.W);
            const sL = lock * Math.max(0, 1 - rim / n.L);
            ctx.fillStyle = d > 0.25 ? "#a0c7e2" : lock < 0.8 ? "#c9e6f6" : "#a9d2ec";
            this.polyNode(ctx, n, sL, sW, 0, t);
            ctx.fill();
        }
        // P3b: lighter slab core -> inner edge band reads as thickness (cel banding like the source art)
        for (const n of live) {
            const age = t - n.born;
            const lock = smooth(0.2, n.lockDur + 0.25, age);
            if (lock <= 0.01)
                continue;
            const d = (t - n.decayAt) / n.decayDur;
            const k = lock * (d > 0 ? 1 - smooth(0, 0.5, d) : 1);
            if (k <= 0.01)
                continue;
            const inner = n.kind === "trail" ? 0.6 : 0.68;
            ctx.fillStyle = d > 0.1 ? "#b2d4ea" : "#bfe0f2";
            const strip = n.kind === "lane" || n.kind === "trail";
            const along = strip ? 1.05 * k : Math.max(0, 1 - 4.5 / n.L) * inner * k;
            this.polyNode(ctx, n, along + 0.001, Math.max(0, 1 - 5 / n.W) * inner * k + 0.001, 0, t);
            ctx.fill();
        }
        // P4: clipped material detail
        ctx.globalCompositeOperation = "source-atop";
        // restrict the arena-wide facet/sheen fills to the live ice bounds (perf, same look)
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const n of live) {
            const r = Math.max(n.L, n.W) * 1.9 + 6;
            if (n.x - r < x0)
                x0 = n.x - r;
            if (n.y - r < y0)
                y0 = n.y - r;
            if (n.x + r > x1)
                x1 = n.x + r;
            if (n.y + r > y1)
                y1 = n.y + r;
        }
        for (const c of carves) {
            const r = c.Rc + c.off + c.T + 8;
            if (c.x - r < x0)
                x0 = c.x - r;
            if (c.y - r < y0)
                y0 = c.y - r;
            if (c.x + r > x1)
                x1 = c.x + r;
            if (c.y + r > y1)
                y1 = c.y + r;
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.clip();
        for (let k = 0; k < 4; k++) {
            ctx.fillStyle = this.facetStyles[k];
            ctx.fill(this.facetPaths[k]);
        }
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fill(this.sheen);
        ctx.restore();
        // directional flow marks (sparse, stable ice only)
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(255,255,255,0.58)";
        ctx.lineWidth = Math.max(px, 1);
        ctx.beginPath();
        for (const n of live) {
            if (n.kind === "patch" || n.kind === "pad" || n.flow > 0.34)
                continue;
            const age = t - n.born;
            if (age < n.lockDur)
                continue;
            const off = (n.flow * 6 - 1) * n.W * 0.45;
            const l = n.L * (0.9 + n.flow);
            ctx.moveTo(n.x - n.ca * l - n.sa * off, n.y - n.sa * l + n.ca * off);
            ctx.lineTo(n.x + n.ca * l - n.sa * off, n.y + n.sa * l + n.ca * off);
        }
        ctx.stroke();
        // cracks: dark cut + white bevel, revealed along their length
        for (const n of live) {
            for (let i = 0; i < n.cracks.length; i++) {
                const cr = n.cracks[i];
                const rev = sat((t - n.crackAt[i]) / 0.12);
                if (rev <= 0)
                    continue;
                const m = cr.length / 2;
                const upto = rev * (m - 1);
                for (let pass = 0; pass < 2; pass++) {
                    ctx.beginPath();
                    const o = pass ? 0.8 : 0;
                    ctx.moveTo(cr[0] + o, cr[1] + o);
                    for (let j = 1; j <= Math.ceil(upto); j++) {
                        const f = Math.min(1, upto - (j - 1));
                        ctx.lineTo(cr[(j - 1) * 2] + (cr[j * 2] - cr[(j - 1) * 2]) * f + o, cr[(j - 1) * 2 + 1] + (cr[j * 2 + 1] - cr[(j - 1) * 2 + 1]) * f + o);
                    }
                    ctx.strokeStyle = pass ? "rgba(255,255,255,0.85)" : "#3f78b0";
                    ctx.lineWidth = Math.max(px, pass ? 0.8 : 1.2);
                    ctx.stroke();
                }
            }
        }
        // carve gouges: scraped deep channel + bright inner lip
        for (const c of carves) {
            if (this.carvePath(ctx, c, t, c.T * 0.28, 0.85)) {
                ctx.fillStyle = "#6da3d2";
                ctx.fill();
                ctx.strokeStyle = "#2f64a0";
                ctx.lineWidth = Math.max(px, 1);
                ctx.stroke();
            }
            if (this.carvePath(ctx, c, t, c.T * 0.62, 0.55)) {
                ctx.fillStyle = "#e9f6fd";
                ctx.fill();
            }
        }
        ctx.globalCompositeOperation = "source-over";
        return true;
    }
}


// ===== ENGINE =====
// ============================================================ CONSTANTS
const K = 0.132; // layer px -> world units (Frost silhouette ≈ 74 × 93 world units)
const M = FROST_META;
const LAYERS = ["base", "crest", "browL", "browR", "jaw", "eyes", "crack", "cavity", "sil"];
function mkCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
}
/** crisp downsampling: successive high-quality halvings (avoids aliasing/shimmer at battle scale) */
function mipChain(img) {
    const levels = [];
    let c = mkCanvas(img.width, img.height);
    c.getContext("2d").drawImage(img, 0, 0);
    levels.push(c);
    while (c.width > 48) {
        const n = mkCanvas(Math.ceil(c.width / 2), Math.ceil(c.height / 2));
        const x = n.getContext("2d");
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = "high";
        x.drawImage(c, 0, 0, n.width, n.height);
        levels.push(n);
        c = n;
    }
    return levels;
}
function pick(levels, targetW) {
    for (let i = levels.length - 1; i >= 0; i--)
        if (levels[i].width >= targetW)
            return levels[i];
    return levels[0];
}
// ============================================================ ENGINE
class FrostEngine {
    constructor() {
        this.mips = {};
        this.shadowCanvas = null;
        this.ready = false;
        this.ice = new IceField(2000, 2000); // facet/sheen pattern covers the 1000x1000 world
        this.t = 0;
        this.dpr = 1;
        this.scale = 1;
        this.rng = new Rng(7);
        // ---------------- Frost
        this.fx = -380;
        this.fy = 70;
        this.fvx = 0;
        this.fvy = 0;
        this.fax = 0;
        this.fay = 0;
        this.mode = "free";
        this.modeT = 0;
        this.onIce = false;
        // rig springs (layer px unless noted)
        this.lagX = new Spring(0, 2.6, 0.38);
        this.lagY = new Spring(0, 2.6, 0.38); // world units
        this.tilt = new Spring(0, 2.4, 0.42);
        this.sx = new Spring(1, 4.2, 0.32);
        this.sy = new Spring(1, 4.2, 0.32);
        this.bLiftL = new Spring(0, 6.5, 0.42);
        this.bLiftR = new Spring(0, 6.1, 0.42);
        this.bRotL = new Spring(0, 5.5, 0.4);
        this.bRotR = new Spring(0, 5.2, 0.4);
        this.jaw = new Spring(0, 8.5, 0.5);
        this.crestLift = new Spring(0, 5, 0.36);
        this.crestRot = new Spring(0, 3.2, 0.3);
        this.eye = new Spring(1, 6, 0.65);
        this.crack = new Spring(1, 5, 0.6);
        this.vent = new Spring(0, 7, 0.7);
        this.hunt = new Crit(0);
        this.huntGoal = 0;
        this.idleNext = 2.2;
        this.gunSlot = null;
        // A1
        this.a1 = { ang: 0, ox: 0, oy: 0, len: 0, front: 0, frontPrev: 0, nodes: [], released: false, bite: false, ended: false, tStart: 0, endT: 0, rowAcc: 0, lobeAcc: 0, chipAcc: 0 };
        this.breath = { t0: 0, on: false };
        // A2
        this.a2 = { lastNode: { x: 0, y: 0 }, trail: [], hist: [], histT: 0, lastCarve: -9, contact: false, kicked: false, crustAcc: 0, side: 1 };
        // on-ice free movement carve cooldown
        this.freeCarveT = -9;
        this.freeHist = [];
        this.freeHistT = 0;
        // ---------------- world props
        this.crusts = [];
        this.shell = null;
        this.iceCanvas = mkCanvas(2, 2);
        this.iceCtx = this.iceCanvas.getContext("2d");
        this.ventCanvas = mkCanvas(2, 2);
    }
    mkGun(x, y, a, owner) {
        return { x, y, a, owner, frost: 0, frostStart: -1, snapAt: -1, thawAt: Infinity, kick: new Spring(0, 7, 0.4), seed: rnd(0, 100), tx0: 0, ty0: 0, tStart: 0, tDur: 0.42, spin: 0, lastWisp: 0, lastVapor: 0 };
    }
    async load() {
        if (loadPromise) return loadPromise;
        cacheStats.loadCalls++;
        return (loadPromise = (async () => {
        await Promise.all(LAYERS.map((k) => new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => { this.mips[k] = mipChain(img); res(); };
            img.onerror = rej;
            img.src = FROST_LAYERS[k];
        })));
        // soft contact shadow from the real silhouette
        const s = pick(this.mips.sil, 150);
        const tint = mkCanvas(s.width, s.height);
        const tc = tint.getContext("2d");
        tc.drawImage(s, 0, 0);
        tc.globalCompositeOperation = "source-in";
        tc.fillStyle = "#1d3552";
        tc.fillRect(0, 0, s.width, s.height);
        const pad = 16;
        const sh = mkCanvas(s.width + pad * 2, s.height + pad * 2);
        const sc = sh.getContext("2d");
        sc.filter = "blur(5px)";
        sc.drawImage(tint, pad, pad);
        this.shadowCanvas = sh;
        this.ready = true;
        })());
    }
    // ============================================================ CONTROL
    // ------------------------------------------------------------ A1 FROST BREATH
    castA1(ang) {
        if (this.mode === "a1" || this.mode === "a2")
            return;
        this.mode = "a1";
        this.modeT = 0;
        const a = ang;
        Object.assign(this.a1, { ang: a, released: false, bite: false, ended: false, front: 0, frontPrev: 0, nodes: [], rowAcc: 0, lobeAcc: 0, chipAcc: 0 });
        // TIGHTEN: source-art parts prepare (brows lift, eyes sharpen, vent separates, crack wakes)
        this.bLiftL.goal = 11;
        this.bLiftR.goal = 12;
        this.bRotL.goal = 0.035;
        this.bRotR.goal = -0.03;
        this.eye.goal = 1.7;
        this.crack.goal = 1.9;
        this.jaw.goal = 7;
        this.vent.goal = 0.35;
        this.sx.goal = 1.035;
        this.sy.goal = 0.955;
        this.crestLift.goal = 5;
    }
    ventWorld() {
        const vx = (M.vent[0] - M.center[0]) * K * this.sx.x;
        const vy = (M.vent[1] - M.center[1]) * K * this.sy.x;
        return { x: this.fx + this.lagX.x * 0.8 + vx, y: this.fy + this.lagY.x * 0.8 + vy };
    }
    buildLane(t0, len, travel) {
        const A = this.a1;
        len = len || 440;
        const v = this.ventWorld();
        const ca = Math.cos(A.ang), sa = Math.sin(A.ang);
        A.ox = v.x + ca * 22;
        A.oy = v.y + sa * 22 + 4;
        // Production lane length is gameplay truth (passed in).
        A.len = len;
        A.tStart = t0;
        travel = (typeof travel === 'number' ? travel : 0.62 * Math.sqrt(len / 440));
        A.endT = t0 + travel;
        const step = 10;
        for (let d = 0; d <= len; d += step) {
            const s = d / len;
            // freeze-front arrival time (inverse of an ease-out front curve)
            const u = 1 - Math.pow(1 - s, 1 / 2.2);
            const born = t0 + u * travel;
            const wob = (noise1(d * 0.021 + 3) - 0.5) * 10 * smooth(0, 0.3, s);
            const W = (9 + 19 * smooth(0, 0.22, s) + 5 * (noise1(d * 0.05) - 0.5)) * (1 - 0.42 * smooth(0.8, 1, s));
            const x = A.ox + ca * d - sa * wob, y = A.oy + sa * d + ca * wob;
            const n = this.ice.add(x, y, A.ang + (noise1(d * 0.03) - 0.5) * 0.15, this.rng.range(14, 18), W, born, "lane", {
                lockDur: 0.5, spurChance: s > 0.84 ? 0.34 : 0.08, jag: 0.11,
            });
            A.nodes.push({ n, s });
            // satellite plates: larger-scale irregular perimeter (designed, not bead-chain)
            if (s > 0.1 && this.rng.next() < 0.18) {
                const side = this.rng.sign();
                const off = W * this.rng.range(0.62, 0.85);
                const sn = this.ice.add(x - sa * off * side + ca * this.rng.range(-4, 4), y + ca * off * side + sa * this.rng.range(-4, 4), A.ang + this.rng.range(-0.5, 0.5), this.rng.range(10, 14), W * this.rng.range(0.34, 0.5), born + 0.025, "lane", { lockDur: 0.5, spurChance: 0.12, jag: 0.15 });
                A.nodes.push({ n: sn, s });
            }
        }
        // Production: presentation schedules lane decay from real gameplay expiry.
    }
    updateA1(dt) {
        const A = this.a1;
        const T = this.modeT;
        const ca = Math.cos(A.ang), sa = Math.sin(A.ang);
        const v = this.ventWorld();
        // PRESSURE SET ~0.10–0.20 : directional compact pressure at the vent
        if (T > 0.1 && T - dt <= 0.1) {
            this.jaw.goal = 12;
            this.vent.goal = 1;
            this.eye.goal = 1.9;
            this.lagX.kick(-ca * 45);
            this.lagY.kick(-sa * 45); // pull back: store pressure
            for (let i = 0; i < 3; i++) {
                const side = i === 0 ? 0 : i === 1 ? -1 : 1;
                spawnLobe(v.x - sa * side * 5 + ca * 3, v.y + ca * side * 5 + sa * 3, A.ang, 3.4 - Math.abs(side) * 0.8, 2.6, 0.32, i * 0.02);
            }
            spawnRibbon(v.x, v.y, A.ang, 20, 3.4, rnd(-4, 4), 0.26, { grow: 0.5, vx: ca * 60, vy: sa * 60 });
        }
        // RELEASE ~0.20 : cold core + shredded sheath + leading chips + floor bite
        if (!A.released && T >= 0.2) {
            A.released = true;
            this.breath = { t0: this.t, on: true };
            this.jaw.goal = 24;
            this.jaw.kick(260);
            this.eye.goal = 1.6;
            this.crack.goal = 2.2;
            this.crack.kick(12);
            this.sx.goal = 1;
            this.sy.goal = 1;
            this.sx.kick(-1.2);
            this.sy.kick(1.4);
            this.lagX.kick(-ca * 150);
            this.lagY.kick(-sa * 150);
            const sheath = [-0.2, 0.17, -0.06, 0.08];
            sheath.forEach((o, i) => {
                spawnRibbon(v.x + ca * 4, v.y + sa * 4, A.ang + o, rnd(105, 150), rnd(8, 11.5), (i % 2 ? 1 : -1) * rnd(8, 16), rnd(0.4, 0.5), {
                    grow: 0.2, shredAt: rnd(0.45, 0.6), vx: Math.cos(A.ang + o) * 130, vy: Math.sin(A.ang + o) * 130, tone: i % 2,
                });
            });
            for (let i = 0; i < 5; i++)
                spawnChip(v.x + ca * 16, v.y + sa * 16, A.ang + rnd(-0.12, 0.12), rnd(520, 760), i < 2 ? rnd(5.5, 7) : rnd(3, 4.4), { vz: rnd(20, 60), fric: 2.4, life: rnd(1.0, 1.5) });
            this.buildLane(this.t + 0.03, this.a1Len, this.a1Travel);
        }
        // FLOOR BITE: air becomes material
        if (A.released && !A.bite && this.t >= A.tStart) {
            A.bite = true;
            spawnLobe(A.ox + ca * 3, A.oy + sa * 3, A.ang, 13, 10, 0.55);
            spawnLobe(A.ox - sa * 10, A.oy + ca * 10, A.ang + 0.6, 8, 6, 0.5, 0.03, -sa * 40, ca * 40);
            spawnLobe(A.ox + sa * 10, A.oy - ca * 10, A.ang - 0.6, 8, 6, 0.5, 0.03, sa * 40, -ca * 40);
            for (let i = 0; i < 6; i++) {
                const o = -1 + (i / 5) * 2;
                spawnShard(A.ox + ca * 8 - sa * o * 11, A.oy + sa * 8 + ca * o * 11, A.ang + o * 0.8, rnd(8, 12), 3, 0.5, i * 0.01);
            }
        }
        // FREEZE-FRONT TRAVEL: crown rides the front (shards + packed lobes + micro-chips ahead)
        if (A.released && !A.ended) {
            const u = sat((this.t - A.tStart) / (A.endT - A.tStart));
            A.frontPrev = A.front;
            A.front = A.len * (1 - Math.pow(1 - u, 2.2));
            const adv = A.front - A.frontPrev;
            const spd = adv / dt;
            const s = A.front / Math.max(1, A.len);
            const W = (9 + 19 * smooth(0, 0.22, s)) * (1 - 0.42 * smooth(0.8, 1, s));
            const wob = (noise1(A.front * 0.021 + 3) - 0.5) * 10 * smooth(0, 0.3, s);
            const fxp = A.ox + ca * A.front - sa * wob, fyp = A.oy + sa * A.front + ca * wob;
            A.rowAcc += adv;
            A.lobeAcc += adv;
            A.chipAcc += adv;
            const big = clamp(spd / 600, 0.55, 1.15);
            while (A.rowAcc > 17) {
                A.rowAcc -= 17;
                const n = 1 + (this.rng.next() < 0.35 ? 1 : 0);
                for (let i = 0; i < n; i++) {
                    const c = this.rng.range(-0.95, 0.95);
                    const center = 1 - Math.abs(c);
                    spawnShard(fxp - sa * c * W + ca * this.rng.range(-3, 3), fyp + ca * c * W + sa * this.rng.range(-3, 3), A.ang + c * 0.62 + this.rng.range(-0.18, 0.18), (6 + 7 * center) * big, 2.3 + 1.2 * center, 0.46);
                }
            }
            while (A.lobeAcc > 28) {
                A.lobeAcc -= 28;
                const c = this.rng.range(-0.7, 0.7);
                spawnLobe(fxp - ca * 5 - sa * c * W, fyp - sa * 5 + ca * c * W, A.ang, W * 0.42 + 2, 5, 0.5);
            }
            while (A.chipAcc > 78) {
                A.chipAcc -= 78;
                spawnChip(fxp + ca * 8, fyp + sa * 8, A.ang + this.rng.range(-0.25, 0.25), spd * 0.9 + 60, this.rng.range(2.4, 3.6), { vz: 25, outline: false, life: 0.7, fric: 3 });
            }
            if (u >= 1) {
                A.ended = true;
                // terminal crest: splayed spurs + a small forward chip cluster
                for (let i = 0; i < 5; i++) {
                    const c = -1 + (i / 4) * 2;
                    spawnShard(fxp - sa * c * W * 0.8, fyp + ca * c * W * 0.8, A.ang + c * 0.9, rnd(9, 14), 3.2, 0.6, i * 0.015);
                }
                chipCluster(fxp, fyp, A.ang, 0.5, 4, 170, 5.5);
                spawnLobe(fxp, fyp, A.ang, W * 0.6, 7, 0.55);
            }
        }
        if (this.breath.on && this.t - this.breath.t0 > 0.45)
            this.breath.on = false;
        // RECOVERY: vent closes with weight, brows settle with overshoot
        if (T > 0.46 && T - dt <= 0.46) {
            this.jaw.goal = 0;
            this.vent.goal = 0;
            this.eye.goal = 1.08;
            this.crack.goal = 1.1;
            this.bLiftL.goal = 0;
            this.bLiftR.goal = 0;
            this.bRotL.goal = 0;
            this.bRotR.goal = 0;
            this.crestLift.goal = 0;
        }
        if (T > 0.95 && T - dt <= 0.95) {
            // lingering condensation leak from the vent
            spawnRibbon(v.x, v.y + 2, Math.PI / 2 + rnd(-0.5, 0.5), 16, 3, rnd(-5, 5), 1.1, { grow: 0.3, vx: rnd(-8, 8), vy: 12, core: 0.5 });
            this.eye.goal = 1;
            this.crack.goal = 1;
        }
        if (T > 0.8 && this.mode === "a1")
            this.mode = "free";
    }
    // ------------------------------------------------------------ A2 FROST HUNT
    castA2() {
        if (this.mode === "a2" || this.mode === "a1")
            return;
        this.mode = "a2";
        this.modeT = 0;
        Object.assign(this.a2, { lastNode: { x: this.fx, y: this.fy }, trail: [], hist: [], histT: 0, lastCarve: -9, contact: false, kicked: false, crustAcc: 0 });
        // HUNT IGNITION: brows open, eyes flare, crack wakes, body compresses
        this.huntGoal = 1;
        this.bLiftL.goal = 16;
        this.bLiftR.goal = 17;
        this.bRotL.goal = 0.05;
        this.bRotR.goal = -0.05;
        this.eye.goal = 2.3;
        this.eye.kick(20);
        this.crack.goal = 2.3;
        this.crestLift.goal = 8;
        this.crestLift.kick(-60);
        this.sx.goal = 1.07;
        this.sy.goal = 0.92;
    }
    kickOff() {
        const A = this.a2;
        const a = Math.atan2(this.fvy, this.fvx);
        const ca = Math.cos(a), sa = Math.sin(a);
        A.kicked = true;
        this.sx.goal = 1;
        this.sy.goal = 1;
        this.sx.kick(-1.6);
        this.sy.kick(1.8);
        this.lagX.kick(-ca * 160);
        this.lagY.kick(-sa * 160);
        // UNDERFOOT BITE: Frost grabbed the floor and turned it to ice
        const pad = this.ice.add(this.fx, this.fy + 6, a, 24, 22, this.t, "pad", { lockDur: 0.5, jag: 0.24 });
        A.trail.push(pad);
        for (let i = 0; i < 3; i++) {
            const aa = a + Math.PI + (i - 1) * 0.9;
            spawnLobe(this.fx + Math.cos(aa) * 14, this.fy + 6 + Math.sin(aa) * 14, aa, 7, 5, 0.5, i * 0.02, Math.cos(aa) * 30, Math.sin(aa) * 30);
        }
        spawnWedge(this.fx - ca * 10, this.fy + 6 - sa * 10, a + Math.PI, 50, 0.46, 0.7);
        chipCluster(this.fx - ca * 12, this.fy + 6 - sa * 12, a + Math.PI, 0.5, 5, 250, 6.5);
        spawnRibbon(this.fx - ca * 6, this.fy + 8 - sa * 6, a + Math.PI, 36, 5, rnd(-8, 8), 0.4, { grow: 0.25, vx: -ca * 50, vy: -sa * 50 });
    }
    carve(ax, ay, head, dAng, strength, hunt) {
        const s = Math.sign(dAng) || 1;
        const side = -s;
        const ca = Math.cos(head), sa = Math.sin(head);
        // outside normal (away from turn centre)
        const ox = -sa * side, oy = ca * side;
        const W = 14;
        if (hunt || this.onIce)
            this.ice.addCarve(ax, ay + 5, head - dAng * 0.4, side, Math.max(strength, hunt ? 0.72 : strength), this.t, hunt ? W * 2.65 : W * 2);
        const outAng = Math.atan2(oy + ca * 0.45, ox + sa * 0.45);
        const n = hunt ? 4 + Math.round(2 * strength) : 3;
        chipCluster(ax + ox * W * 0.95, ay + 5 + oy * W * 0.95, outAng, 0.32, n, hunt ? 330 + 130 * strength : 200, hunt ? 8.2 : 5);
        spawnWedge(ax + ox * W * 0.62, ay + 5 + oy * W * 0.62, Math.atan2(oy - ca * 0.3, ox - sa * 0.3), (hunt ? 66 : 34) + 30 * strength, hunt ? 0.46 : 0.4, 0.78);
        for (let i = 0; i < 3; i++) {
            const u = -0.7 + i * 0.7;
            const lx = ax + ca * u * 18 + ox * (W + 10), ly = ay + 5 + sa * u * 18 + oy * (W + 10);
            spawnLobe(lx, ly, head, 5.5, 3.8, 0.55, i * 0.025, ox * 35, oy * 35);
        }
        // body response: outer mass swings out, outside brow loads, face rolls slightly
        this.lagX.kick(ox * 90);
        this.lagY.kick(oy * 90);
        this.tilt.kick(s * 1.3);
        if (ox < 0)
            this.bLiftL.kick(90);
        else
            this.bLiftR.kick(90);
        this.sx.kick(0.8);
        this.sy.kick(-0.8);
    }
    updateA2(dt) {
        const A = this.a2;
        const T = this.modeT;
        if (!A.kicked) {
            if (T >= 0.13)
                this.kickOff();
            return;
        }
        const sp = Math.hypot(this.fvx, this.fvy);
        // PATH CRYSTALLIZATION from actual motion history (distance-resampled)
        const ndx = this.fx - A.lastNode.x, ndy = this.fy - A.lastNode.y;
        const nd = Math.hypot(ndx, ndy);
        if (nd >= 9 && !A.contact) {
            const h = Math.atan2(ndy, ndx);
            const spn = sat(sp / 520);
            const W = 11 + 6 * (1 - spn) + this.rng.range(-1.2, 1.2);
            const n = this.ice.add(this.fx - Math.cos(h) * 3, this.fy + 6 - Math.sin(h) * 3, h, this.rng.range(12, 16), W * 1.04, this.t, "trail", { lockDur: 0.45, spurChance: 0.015, jag: 0.09 });
            A.trail.push(n);
            A.lastNode.x = this.fx;
            A.lastNode.y = this.fy;
            A.crustAcc += nd;
            if (A.crustAcc > 26) {
                A.crustAcc = 0;
                A.side = -A.side;
                const ox = -Math.sin(h) * A.side, oy = Math.cos(h) * A.side;
                spawnLobe(this.fx + ox * W * 0.85, this.fy + 6 + oy * W * 0.85, h, 5, 3.4, 0.45, 0, ox * 26, oy * 26);
                if (this.rng.next() < 0.6)
                    spawnShard(this.fx + ox * W, this.fy + 6 + oy * W, Math.atan2(oy, ox) + Math.PI * 0.25 * -A.side, 6, 2.2, 0.4);
            }
        }
        // sparse glide wisps (only at full commit speed)
        if (sp > 400 && !A.contact && Math.floor(this.t / 0.16) !== Math.floor((this.t - dt) / 0.16)) {
            const h = Math.atan2(this.fvy, this.fvx);
            spawnRibbon(this.fx - Math.cos(h) * 16 + rnd(-4, 4), this.fy + 8 - Math.sin(h) * 16, h + Math.PI + rnd(-0.12, 0.12), 30, 3.6, rnd(-6, 6), 0.32, {
                grow: 0.15, vx: this.fvx * 0.15, vy: this.fvy * 0.15, core: 0.5,
            });
        }
        // TURN SIGNATURE: heading change over a short window of real motion
        A.histT += dt;
        if (A.histT >= 1 / 60) {
            A.histT = 0;
            A.hist.push(Math.atan2(this.fvy, this.fvx));
            if (A.hist.length > 10)
                A.hist.shift();
        }
        if (A.hist.length >= 9 && sp > 220 && this.t - A.lastCarve > 0.3 && !A.contact) {
            const dA = angDiff(A.hist[0], A.hist[A.hist.length - 1]);
            if (Math.abs(dA) > 0.62) {
                A.lastCarve = this.t;
                this.carve(this.fx, this.fy, A.hist[A.hist.length - 1], dA, sat((Math.abs(dA) - 0.5) / 1.0), true);
            }
        }
    }
    contact(nx, ny, px, py, proxy) {
        const A = this.a2;
        A.contact = true;
        this.lagX.kick(nx * 220);
        this.lagY.kick(ny * 220);
        if (Math.abs(nx) > Math.abs(ny)) {
            this.sx.kick(-2.2);
            this.sy.kick(1.6);
        }
        else {
            this.sy.kick(-2.2);
            this.sx.kick(1.6);
        }
        const ang = Math.atan2(-ny, -nx);
        for (let i = 0; i < 5; i++)
            this.crusts.push({ ang: ang + (i - 2) * 0.28 + rnd(-0.08, 0.08), size: rnd(5, 8), born: this.t + i * 0.02, life: 2.6, seed: rnd(0, 99) });
        // compact packed-frost burst + directional chip cluster (control, not explosion)
        for (let i = 0; i < 4; i++) {
            const o = (i - 1.5) * 0.55;
            const a = Math.atan2(ny, nx) + Math.PI + o * 1.6;
            spawnLobe(px + Math.cos(a) * 6, py + Math.sin(a) * 6, a, 8, 6, 0.5, i * 0.015, Math.cos(a) * 40, Math.sin(a) * 40);
        }
        chipCluster(px, py, Math.atan2(ny, nx) + Math.PI * 0.5 * (rnd(0, 1) < 0.5 ? 1 : -1) * 0.6, 0.7, 6, 290, 6.5);
        const patch = this.ice.add(px, py + 8, Math.atan2(ny, nx), 26, 24, this.t, "patch", { lockDur: 0.35, jag: 0.28 });
        patch.decayAt = this.t + 2.6;
        // GUN STEAL: the same gun leaves the enemy, gets frozen in transit, arrives with Frost
        if (proxy && !this.gunSlot) {
            const g = proxy;
            g.owner = "transfer";
            g.a0 = g.a;
            g.tx0 = g.x;
            g.ty0 = g.y;
            g.tStart = this.t;
            g.tDur = 0.44;
            g.spin = (rnd(0, 1) < 0.5 ? -1 : 1) * TAU * 1.25;
            g.frostStart = this.t;
            g.snapAt = this.t + 0.3;
            g.thawAt = Infinity;
            spawnChip(g.x, g.y, Math.atan2(ny, nx), 120, 3.5, { vz: 90 });
        }
    }
    endA2() {
        const A = this.a2;
        this.mode = "free";
        this.huntGoal = 0;
        this.bLiftL.goal = 0;
        this.bLiftR.goal = 0;
        this.bRotL.goal = 0;
        this.bRotR.goal = 0;
        this.eye.goal = 1;
        this.crack.goal = 1;
        this.crestLift.goal = 0;
        const sp = Math.hypot(this.fvx, this.fvy);
        if (sp > 60)
            spawnWedge(this.fx, this.fy + 6, Math.atan2(this.fvy, this.fvx), 34, 0.4, 0.6);
    }
    // ------------------------------------------------------------ L : FROZEN GUN + FREEZE PROC
    muzzle(g, mx, my) {
        // Gold fireShot 1747-1770 minus demo bullet spawn: cold muzzle visual.
        const a = g.a;
        g.kick.kick(-70);
        // cold muzzle: short tapered vapour + one fleck (no glowing snowball)
        spawnRibbon(mx, my, a + rnd(-0.2, 0.2), 22, 3.5, rnd(-6, 6), 0.35, { grow: 0.2, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, core: 0.7 });
        spawnChip(mx, my, a + rnd(-0.6, 0.6), 90, 2.4, { outline: false, vz: 40, life: 0.5 });
        g.snapAt = Math.max(g.snapAt, this.t - 0.05); // frost plates flicker on recoil
        this.lagX.kick(-Math.cos(a) * 30);
        this.lagY.kick(-Math.sin(a) * 30);
    }
    hitPatch(cx, cy, R, ang) {
        // Gold bulletHit 1771-1788 minus demo enemy physics + forced freeze.
        const hx = cx + Math.cos(ang) * R, hy = cy + Math.sin(ang) * R;
        // distinct cold hit patch
        for (let i = 0; i < 3; i++) {
            const a = ang + (i - 1) * 0.5;
            spawnLobe(hx + Math.cos(a) * 3, hy + Math.sin(a) * 3, a, 4.5, 3.4, 0.45, i * 0.02, Math.cos(a) * 30, Math.sin(a) * 30);
        }
        chipCluster(hx, hy, ang, 0.6, 3, 160, 4.2);
        this.crusts.push({ ang: ang + rnd(-0.1, 0.1), size: rnd(4.5, 6.5), born: this.t, life: 3.2, seed: rnd(0, 99) });
    }
    freezeEnemy(hitAng, R, tx, ty, dur) {
        // Voronoi fracture of an irregular shell outline via half-plane clipping
        const outline = [];
        const NO = 15;
        for (let i = 0; i < NO; i++) {
            const a = (i / NO) * TAU + rnd(-0.08, 0.08);
            const r = R * (1.17 + rnd(-0.05, 0.07));
            outline.push(Math.cos(a) * r, Math.sin(a) * r);
        }
        const seeds = [Math.cos(hitAng) * R * 0.7, Math.sin(hitAng) * R * 0.7];
        for (let i = 0; i < 7; i++) {
            const a = hitAng + 0.6 + (i / 7) * (TAU - 1.2) + rnd(-0.25, 0.25);
            const r = R * rnd(0.55, 1.0);
            seeds.push(Math.cos(a) * r, Math.sin(a) * r);
        }
        seeds.push(rnd(-6, 6), rnd(-6, 6));
        const hx = Math.cos(hitAng) * R, hy = Math.sin(hitAng) * R;
        const plates = [];
        const S = seeds.length / 2;
        let maxD = 1;
        for (let i = 0; i < S; i++) {
            let poly = outline.slice();
            const sx = seeds[i * 2], sy = seeds[i * 2 + 1];
            for (let j = 0; j < S && poly.length >= 6; j++) {
                if (i === j)
                    continue;
                const tx = seeds[j * 2], ty = seeds[j * 2 + 1];
                const mx = (sx + tx) / 2, my = (sy + ty) / 2, nx = tx - sx, ny = ty - sy;
                const out = [];
                const n = poly.length / 2;
                for (let k = 0; k < n; k++) {
                    const ax = poly[k * 2], ay = poly[k * 2 + 1];
                    const bx = poly[((k + 1) % n) * 2], by = poly[((k + 1) % n) * 2 + 1];
                    const da = (ax - mx) * nx + (ay - my) * ny, db = (bx - mx) * nx + (by - my) * ny;
                    if (da <= 0)
                        out.push(ax, ay);
                    if ((da <= 0) !== (db <= 0)) {
                        const f = da / (da - db);
                        out.push(ax + (bx - ax) * f, ay + (by - ay) * f);
                    }
                }
                poly = out;
            }
            if (poly.length < 6)
                continue;
            let cx = 0, cy = 0;
            const n = poly.length / 2;
            for (let k = 0; k < n; k++) {
                cx += poly[k * 2];
                cy += poly[k * 2 + 1];
            }
            cx /= n;
            cy /= n;
            // gap: shrink toward centroid
            for (let k = 0; k < n; k++) {
                const dx = poly[k * 2] - cx, dy = poly[k * 2 + 1] - cy, dl = Math.hypot(dx, dy) || 1;
                poly[k * 2] = cx + dx * (1 - 1.5 / dl);
                poly[k * 2 + 1] = cy + dy * (1 - 1.5 / dl);
            }
            let best = 0, bd = 1e9;
            for (let k = 0; k < n; k++) {
                const d = Math.hypot(poly[k * 2] - hx, poly[k * 2 + 1] - hy);
                if (d < bd) {
                    bd = d;
                    best = k;
                }
            }
            const dist = Math.hypot(cx - hx, cy - hy);
            maxD = Math.max(maxD, dist);
            plates.push({ poly, cx, cy, appear: dist, anchorX: poly[best * 2], anchorY: poly[best * 2 + 1], released: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, z: 0, vz: 0, hl: Math.floor(rnd(0, n)) });
        }
        for (const p of plates)
            p.appear = this.t + 0.03 + (p.appear / maxD) * 0.3;
        // strong cracks (few): first from the hit point, second a stress branch
        const c1 = [];
        for (let i = 0; i <= 6; i++) {
            const u = i / 6;
            const bx = lerp(hx, -hx * 0.8, u), by = lerp(hy, -hy * 0.8, u);
            const j = (i === 0 || i === 6 ? 0 : rnd(-7, 7));
            c1.push(bx - Math.sin(hitAng) * j, by + Math.cos(hitAng) * j);
        }
        const mid = 3;
        const c2 = [c1[mid * 2], c1[mid * 2 + 1]];
        const ba = hitAng + Math.PI / 2 * (rnd(0, 1) < 0.5 ? 1 : -1) + rnd(-0.3, 0.3);
        for (let i = 1; i <= 4; i++)
            c2.push(c1[mid * 2] + Math.cos(ba) * i * R * 0.26 + rnd(-4, 4), c1[mid * 2 + 1] + Math.sin(ba) * i * R * 0.26 + rnd(-4, 4));
        const patch = this.ice.add(tx, ty + 6, hitAng, R * 1.28, R * 1.22, this.t + 0.05, "patch", { lockDur: 0.4, jag: 0.2 });
        this.shell = {
            t0: this.t, hitAng, plates,
            cracks: [{ pts: c1, at: this.t + dur * (2.05 / 2.6), w: 1.7 }, { pts: c2, at: this.t + dur * (2.35 / 2.6), w: 1.3 }],
            thawT: this.t + dur, done: false, patch, released: false, x: tx, y: ty, R,
        };
        patch.decayAt = this.t + dur * (3.4 / 2.6);
        for (let i = 0; i < 4; i++) {
            const a = hitAng + (i - 1.5) * 0.4;
            spawnLobe(tx + Math.cos(a) * R, ty + Math.sin(a) * R, a, 6, 4.5, 0.5, i * 0.02);
        }
    }
    updateShell(dt) {
        const S = this.shell;
        if (!S)
            return;
        const t = this.t;
        if (t >= S.cracks[0].at && t - dt < S.cracks[0].at) {
            const c = S.cracks[0].pts;
            chipCluster(S.x + c[0], S.y + c[1], S.hitAng, 0.8, 3, 110, 3.6);
        }
        if (t >= S.thawT && !S.released) {
            S.released = true;
            const order = S.plates.map((p, i) => ({ i, d: Math.abs(Math.sin(Math.atan2(p.cy, p.cx) - S.hitAng)) + rnd(0, 0.3) })).sort((a, b) => a.d - b.d);
            order.forEach((o, k) => { S.plates[o.i].released = t + k * 0.05; });
        }
        let live = 0;
        for (const p of S.plates) {
            if (p.released && t >= p.released) {
                if (p.vx === 0 && p.vy === 0 && p.z === 0) {
                    const d = Math.hypot(p.cx, p.cy) || 1;
                    const sp = rnd(60, 140);
                    p.vx = (p.cx / d) * sp + rnd(-20, 20);
                    p.vy = (p.cy / d) * sp + rnd(-20, 20);
                    p.vz = rnd(40, 110);
                    p.vr = rnd(-4, 4);
                    if (rnd(0, 1) < 0.7)
                        chipCluster(S.x + p.cx, S.y + p.cy, Math.atan2(p.cy, p.cx), 0.6, 2, 150, 3.5);
                }
                if (p.z > 0 || p.vz > 0) {
                    p.vz -= 700 * dt;
                    p.z = Math.max(0, p.z + p.vz * dt);
                    if (p.z === 0) {
                        p.vz = 0;
                        p.vr *= 0.4;
                    }
                }
                const f = Math.exp(-(p.z > 0 ? 0.5 : 5) * dt);
                p.vx *= f;
                p.vy *= f;
                p.vr *= f;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.rot += p.vr * dt;
                if (t - p.released < 1.25)
                    live++;
            }
            else
                live++;
        }
        if (S.released && !S.done && S.plates.every((p) => p.released && t > p.released)) {
            S.done = true;
        }
        if (S.done && live === 0)
            this.shell = null;
    }
    // ============================================================ SIM STEP
    updateIdle(dt) {
        const moving = Math.hypot(this.fvx, this.fvy) > 20;
        this.idleNext -= dt;
        if (this.idleNext <= 0 && !moving && this.mode === "free") {
            const r = this.rng.next();
            this.idleNext = this.rng.range(2.4, 5.2);
            if (r < 0.4) {
                // asynchronous brow adjustment
                (this.rng.next() < 0.5 ? this.bLiftL : this.bLiftR).kick(this.rng.range(26, 40));
                (this.rng.next() < 0.5 ? this.bRotL : this.bRotR).kick(this.rng.range(-0.12, 0.12));
            }
            else if (r < 0.72) {
                // rare tiny vent condensation release
                this.jaw.kick(40);
                const v = this.ventWorld();
                spawnRibbon(v.x, v.y + 1, Math.PI / 2 + this.rng.range(-0.7, 0.7), 14, 2.6, this.rng.range(-5, 5), 1.2, { grow: 0.35, vx: this.rng.range(-6, 6), vy: 10, core: 0.45 });
            }
            else {
                this.crack.kick(5);
                this.eye.kick(2.5);
            }
        }
    }
    updateGunVisual(g, dt, target) {
        // Gold updateGuns 2078-2152: transfer flight + frost grow/thaw laws.
        // Demo enemy-follow + lane-scan trigger cut; presentation feeds target
        // (real holder anchor) and frostStart/thawAt (real slot/holder state).
        const t = this.t;
        if (!g)
            return;
        g.kick.step(dt);
        if (g.owner === "transfer") {
            const u = sat((t - g.tStart) / g.tDur);
            const e = easeOutCubic(u);
            const mx = (g.tx0 + target.x) / 2, my = (g.ty0 + target.y) / 2 - 60;
            const iu = 1 - e;
            g.x = iu * iu * g.tx0 + 2 * iu * e * mx + e * e * target.x;
            g.y = iu * iu * g.ty0 + 2 * iu * e * my + e * e * target.y;
            g.a = lerp(g.a0, target.a + g.spin, e);
            if (t - g.lastWisp > 0.045 && u < 0.95) {
                g.lastWisp = t;
                spawnRibbon(g.x, g.y, Math.atan2(g.y - my, g.x - mx) + Math.PI, 20, 3.6, rnd(-5, 5), 0.35, { grow: 0.15, vx: 0, vy: 0, core: 0.7 });
            }
            if (u >= 1) {
                g.owner = "frost";
                this.gunSlot = g;
                g.kick.kick(-60);
                chipCluster(g.x, g.y, g.a + Math.PI, 1.0, 3, 90, 3.4);
                this.sx.kick(0.6);
                this.sy.kick(-0.6);
            }
        }
        else if (g.owner === "frost") {
            g.x = damp(g.x, target.x, 0.03, dt);
            g.y = damp(g.y, target.y, 0.03, dt);
            g.a = g.a + angDiff(g.a, target.a) * (1 - Math.exp(-14 * dt));
            if (g.frost > 0.8 && t - g.lastVapor > 1.6) {
                g.lastVapor = t;
                const mx = g.x + Math.cos(g.a) * 26, my = g.y + Math.sin(g.a) * 26;
                spawnRibbon(mx, my, g.a + Math.PI / 2 * (rnd(0, 1) < 0.5 ? 1 : -1) * 0.6, 14, 2.4, rnd(-4, 4), 1.0, { grow: 0.3, vx: Math.cos(g.a) * 8, vy: 6, core: 0.4 });
            }
        }
        if (g.frostStart >= 0) {
            const grow = smooth(0, 0.5, t - g.frostStart);
            const thaw = g.owner === "floor" && g.thawAt < Infinity ? smooth(0, 0.9, t - g.thawAt) : 0;
            g.frost = grow * (1 - thaw);
            if (thaw >= 1) {
                g.frostStart = -1;
                g.frost = 0;
                g.thawAt = Infinity;
            }
            if (thaw > 0.2 && thaw - dt < 0.2 + dt)
                chipCluster(g.x, g.y, rnd(0, TAU), 1.4, 3, 60, 3.2);
        }
    }
    updateCrusts(x, y, R, dt) {
        // Gold updateEnemy crust-expiry filter 2166-2174 (demo locomotion cut).
        void dt;
        this.crusts = this.crusts.filter((c) => {
            if (this.t - c.born > c.life) {
                spawnChip(x + Math.cos(c.ang) * R, y + Math.sin(c.ang) * R, c.ang, 50, c.size * 0.6, { vz: 50, life: 0.8 });
                return false;
            }
            return true;
        });
    }
    // ============================================================ LOOP
    // ============================================================ RENDER
    // ------------------------------------------------------------ A1 MACRO FREEZE FRONT
    // One coherent transverse crystallization mass. This is intentionally NOT a particle cloud:
    // it is the single macro silhouette that makes the advancing floor-front readable at battle scale.
    drawA1MacroFront(ctx, px) {
        const A = this.a1;
        if (!A.released || A.ended || this.t < A.tStart || this.t > A.endT + 0.08)
            return;
        const u = sat((this.t - A.tStart) / Math.max(0.001, A.endT - A.tStart));
        const front = A.len * (1 - Math.pow(1 - u, 2.2));
        const ca = Math.cos(A.ang), sa = Math.sin(A.ang);
        const s = front / Math.max(1, A.len);
        const W = (10 + 22 * smooth(0, 0.22, s)) * (1 - 0.38 * smooth(0.8, 1, s));
        const wob = (noise1(front * 0.021 + 3) - 0.5) * 10 * smooth(0, 0.3, s);
        const x = A.ox + ca * front - sa * wob;
        const y = A.oy + sa * front + ca * wob;
        const pulse = 0.96 + 0.04 * Math.sin(this.t * 31);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(A.ang);
        ctx.scale(pulse, 1);
        const crownPath = (depth, width, back) => {
            const ys = [-1, -0.78, -0.52, -0.25, 0, 0.24, 0.5, 0.76, 1];
            const tips = [0.08, 0.38, 0.22, 0.68, 1, 0.58, 0.28, 0.42, 0.06];
            ctx.beginPath();
            ctx.moveTo(-back, -width);
            for (let i = 0; i < ys.length; i++) {
                const yy = ys[i] * width;
                const xx = depth * tips[i] + (i % 2 ? 1.2 : -0.8);
                ctx.lineTo(xx, yy);
            }
            ctx.lineTo(-back, width);
            ctx.quadraticCurveTo(-back * 1.5, 0, -back, -width);
            ctx.closePath();
        };
        // cool slab lip underneath: grounds the crown on the light arena floor
        ctx.save();
        ctx.translate(-1.5, 2.2);
        crownPath(15, W * 1.04, 12);
        ctx.fillStyle = "rgba(69,122,177,0.62)";
        ctx.fill();
        ctx.restore();
        // packed frost body: one readable macro mass
        crownPath(17, W, 10);
        ctx.fillStyle = "#dff3fd";
        ctx.fill();
        ctx.lineWidth = Math.max(px, 1.1);
        ctx.strokeStyle = "rgba(50,105,165,0.78)";
        ctx.stroke();
        // broad white cap, deliberately not a full duplicate silhouette
        ctx.beginPath();
        ctx.moveTo(-6, -W * 0.82);
        ctx.quadraticCurveTo(4, -W * 0.5, 9, -W * 0.25);
        ctx.quadraticCurveTo(14, 0, 9, W * 0.25);
        ctx.quadraticCurveTo(4, W * 0.5, -6, W * 0.82);
        ctx.quadraticCurveTo(-1, 0, -6, -W * 0.82);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.fill();
        // five structural shard heads share the same mass and direction.
        const pos = [-0.72, -0.36, 0, 0.38, 0.73];
        const len = [10, 15, 23, 14, 9];
        for (let i = 0; i < pos.length; i++) {
            const yy = pos[i] * W;
            const L = len[i] * (0.82 + 0.18 * Math.sin(this.t * 19 + i));
            const bw = i === 2 ? 5.2 : 3.8;
            ctx.beginPath();
            ctx.moveTo(1, yy - bw);
            ctx.lineTo(L, yy + (i % 2 ? -1.5 : 1.5));
            ctx.lineTo(2, yy + bw);
            ctx.lineTo(-3, yy + bw * 0.35);
            ctx.closePath();
            ctx.fillStyle = i % 2 ? "#b8e2f7" : "#f7fcff";
            ctx.fill();
            ctx.lineWidth = Math.max(px * 0.9, 0.8);
            ctx.strokeStyle = "rgba(56,111,171,0.72)";
            ctx.stroke();
        }
        ctx.restore();
    }
    drawFrostShadow(ctx) {
        if (!this.shadowCanvas)
            return;
        const sh = this.shadowCanvas;
        const lvl = pick(this.mips.sil, 150);
        const k = (M.w / lvl.width) * K;
        ctx.globalAlpha = 0.24;
        const w = sh.width * k * 1.02, h = sh.height * k * 0.98;
        ctx.drawImage(sh, this.fx + this.lagX.x * 0.3 + 3 - w / 2, this.fy + this.lagY.x * 0.3 + 6 - h / 2 + 2, w, h);
        ctx.globalAlpha = 1;
    }
    // ------------------------------------------------------------ FROST RIG DRAW
    drawFrost(ctx, px) {
        const pxW = M.w * K * this.scale * this.dpr * Math.max(this.sx.x, 1);
        const L = (k) => pick(this.mips[k], pxW);
        const h = this.hunt.x;
        const breathe = 1 + 0.0035 * Math.sin(this.t * 1.25);
        const lx = this.lagX.x, ly = this.lagY.x;
        ctx.save();
        ctx.translate(this.fx, this.fy);
        ctx.rotate(this.tilt.x);
        ctx.scale(K * this.sx.x, K * this.sy.x * breathe);
        ctx.translate(-M.center[0], -M.center[1]);
        const iK = 1 / K;
        const draw = (k, ox = 0, oy = 0) => ctx.drawImage(L(k), ox, oy, M.w, M.h);
        // outer plate mass lags the core
        const bx = lx * 0.55 * iK, by = ly * 0.55 * iK;
        draw("base", bx, by);
        // vent glow on hidden connector cavity (masked by the real cavity shape)
        const vI = Math.max(this.vent.x, sat(this.jaw.x / 30) * 0.6, h * 0.25);
        if (vI > 0.02)
            this.drawVentGlow(ctx, L("cavity"), vI, bx, by);
        // jaw / vent lower plate: opens downward, no teeth added
        ctx.save();
        ctx.translate(lx * 0.75 * iK, ly * 0.75 * iK + Math.max(-2, this.jaw.x));
        draw("jaw");
        ctx.restore();
        // crest: tip lags more (secondary), lifts on pressure
        ctx.save();
        ctx.translate(M.crestPivot[0] + lx * 0.95 * iK, M.crestPivot[1] + ly * 0.9 * iK - this.crestLift.x);
        ctx.rotate(this.crestRot.x - this.tilt.x * 0.3);
        ctx.translate(-M.crestPivot[0], -M.crestPivot[1]);
        draw("crest");
        if (this.crack.x > 1.02) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = clamp((this.crack.x - 1) * 0.75, 0, 1);
            draw("crack");
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
        }
        ctx.restore();
        // eyes (under brows): intensity + sharpening
        if (this.eye.x > 1.02) {
            ctx.save();
            ctx.translate(bx, by);
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = clamp((this.eye.x - 1) * 0.8, 0, 1);
            draw("eyes");
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.restore();
        }
        // brow plates: inner-end pivots, asymmetric springs, compensate against lag
        const brow = (k, piv, lift, rot) => {
            ctx.save();
            ctx.translate(piv[0] - lx * 0.2 * iK + bx * 0.9, piv[1] - ly * 0.2 * iK + by * 0.9 - lift);
            ctx.rotate(rot);
            ctx.translate(-piv[0], -piv[1]);
            draw(k);
            ctx.restore();
        };
        brow("browL", M.browLPivot, this.bLiftL.x, this.bRotL.x);
        brow("browR", M.browRPivot, this.bLiftR.x, this.bRotR.x);
        // hunt eye flares: tapered filled slivers (read at battle scale)
        const fl = Math.max(h, clamp((this.eye.x - 1.4) * 1.2, 0, 1) * 0.6);
        if (fl > 0.03) {
            ctx.save();
            ctx.translate(bx, by);
            ctx.globalCompositeOperation = "lighter";
            for (const [e, sgn] of [[M.eyeL, -1], [M.eyeR, 1]]) {
                const len = 70 * fl, w = 9 * fl;
                ctx.beginPath();
                ctx.moveTo(e[0] - sgn * 22, e[1] + 4);
                ctx.quadraticCurveTo(e[0] + sgn * len * 0.4, e[1] - w * 1.4, e[0] + sgn * len, e[1] - 16 * fl);
                ctx.quadraticCurveTo(e[0] + sgn * len * 0.4, e[1] + w * 0.4, e[0] - sgn * 22, e[1] + 4);
                ctx.fillStyle = `rgba(70,215,245,${0.75 * fl})`;
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(e[0], e[1], 26 * fl + 6, 7 * fl + 2, sgn * -0.25, 0, TAU);
                ctx.fillStyle = `rgba(190,255,255,${0.55 * fl})`;
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.restore();
        void px;
    }
    drawVentGlow(ctx, cav, I, ox, oy) {
        const vc = this.ventCanvas;
        if (vc.width !== cav.width || vc.height !== cav.height) {
            vc.width = cav.width;
            vc.height = cav.height;
        }
        const c = vc.getContext("2d");
        const k = cav.width / M.w;
        c.globalCompositeOperation = "source-over";
        c.clearRect(0, 0, vc.width, vc.height);
        c.drawImage(cav, 0, 0);
        c.globalCompositeOperation = "source-in";
        const vx = M.vent[0] * k, vy = (M.vent[1] + this.jaw.x * 0.35) * k;
        const g = c.createRadialGradient(vx, vy, 0, vx, vy, 150 * k);
        g.addColorStop(0, `rgba(235,255,255,${I})`);
        g.addColorStop(0.35, `rgba(90,230,250,${0.9 * I})`);
        g.addColorStop(1, `rgba(20,90,170,${0.35 * I})`);
        c.fillStyle = g;
        c.fillRect(0, 0, vc.width, vc.height);
        // cold core slit (shape, not puff)
        c.globalCompositeOperation = "source-atop";
        c.beginPath();
        c.ellipse(vx, vy + 4 * k, 70 * k * I, (6 + this.jaw.x * 0.3) * k, 0, 0, TAU);
        c.fillStyle = `rgba(255,255,255,${0.95 * I})`;
        c.fill();
        ctx.drawImage(vc, ox, oy, M.w, M.h);
    }
    // PRESSURE SET: one tight cold core at the vent lip, already leaning toward the aim
    drawPreCore(ctx, px) {
        const u = sat((this.modeT - 0.08) / 0.12);
        const v = this.ventWorld();
        const a = this.a1.ang;
        const r = 2 + 5 * easeOutBack(u, 2);
        const stretch = 1 + 0.9 * u;
        ctx.save();
        ctx.translate(v.x + Math.cos(a) * r * 0.6, v.y + Math.sin(a) * r * 0.6);
        ctx.rotate(a);
        blobPath(ctx, r * stretch, r * 0.8, 17 + this.t * 30, 7, 0.14);
        ctx.fillStyle = "#b6e6fa";
        ctx.fill();
        ctx.lineWidth = Math.max(px, 0.9);
        ctx.strokeStyle = "rgba(60,130,200,0.7)";
        ctx.stroke();
        blobPath(ctx, r * stretch * 0.62, r * 0.5, 5, 6, 0.1);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();
    }
    // ------------------------------------------------------------ BREATH CORE
    drawBreathCore(ctx, px) {
        const tau = this.t - this.breath.t0;
        const a = this.a1.ang;
        const v = this.ventWorld();
        const Lmax = 92;
        const head = Lmax * easeOutCubic(tau / 0.075);
        const tail = Lmax * 0.85 * smooth(0.12, 0.36, tau);
        const W = 12.5 * (1 - 0.6 * smooth(0.1, 0.36, tau));
        const fade = 1 - smooth(0.27, 0.42, tau);
        if (head - tail < 2 || fade <= 0)
            return;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(a);
        const shape = (wm, jitter) => {
            const n = 18;
            ctx.beginPath();
            for (let side = 0; side < 2; side++) {
                for (let i = 0; i <= n; i++) {
                    const u = side === 0 ? i / n : 1 - i / n;
                    const x = tail + (head - tail) * u;
                    const prof = u < 0.22 ? Math.sqrt(u / 0.22) : Math.pow(1 - (u - 0.22) / 0.78, 0.8);
                    const nz = 1 + jitter * (noise1(u * 7 + this.t * 16 + side * 13) - 0.5);
                    const y = (side === 0 ? -1 : 1) * W * wm * prof * nz;
                    if (side === 0 && i === 0)
                        ctx.moveTo(x, y);
                    else
                        ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
        };
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = "#bfe7fa";
        shape(1.25, 0.5);
        ctx.fill();
        ctx.strokeStyle = "rgba(70,140,205,0.55)";
        ctx.lineWidth = Math.max(px, 0.9);
        ctx.stroke();
        ctx.globalAlpha = 0.95 * fade;
        ctx.fillStyle = "#eaf8ff";
        shape(0.85, 0.3);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        shape(0.42, 0.15);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
    }
    // ------------------------------------------------------------ ENEMY / SHELL
    drawTargetFrost(ctx, x, y, R, px, seizeT) {
        // Gold drawEnemy 2611-2684: seize tint + rim crusts + shell call.
        // Demo enemy art cut; (x, y, R) is the real target.
        const t = this.t;
        const S = this.shell;
        const frozen = !!S && !S.done;
        const seize = 1 - smooth(0, 0.35, t - seizeT);
        const jx = seize * Math.sin(t * 90) * 1.6 + (S && t > S.cracks[0].at && !S.released ? Math.sin(t * 110) * 0.8 : 0);
        const dx = x + jx, dy = y;
        // cold seize tint
        const chill = Math.max(frozen ? 1 : 0, seize * 0.6);
        if (chill > 0.01) {
            ctx.beginPath();
            ctx.arc(dx, dy, R - 1.5, 0, TAU);
            ctx.fillStyle = `rgba(150,205,240,${0.38 * chill})`;
            ctx.fill();
        }
        // crusts on the rim (contact / hit side)
        for (const c of this.crusts) {
            const age = t - c.born;
            if (age < 0)
                continue;
            const g = easeOutBack(age / 0.12, 1.8) * (1 - smooth(c.life - 0.3, c.life, age) * 0.5);
            ctx.save();
            ctx.translate(dx + Math.cos(c.ang) * (R - 1), dy + Math.sin(c.ang) * (R - 1));
            ctx.rotate(c.ang + Math.PI / 2);
            ctx.scale(g, g);
            blobPath(ctx, c.size, c.size * 0.62, c.seed);
            ctx.fillStyle = PAL.white;
            ctx.fill();
            ctx.lineWidth = Math.max(px, 1);
            ctx.strokeStyle = PAL.outlineIce;
            ctx.stroke();
            ctx.restore();
        }
        if (S)
            this.drawShell(ctx, S, dx, dy, px);
    }
    drawShell(ctx, S, x, y, px) {
        const t = this.t;
        for (const p of S.plates) {
            if (t < p.appear)
                continue;
            const g = easeOutBack((t - p.appear) / 0.11, 1.6);
            let alpha = 1;
            ctx.save();
            if (p.released && t >= p.released) {
                const age = t - p.released;
                alpha = 1 - smooth(0.7, 1.25, age);
                ctx.translate(x + p.x + p.z * 0.2, y + p.y - p.z * 0.35);
                ctx.translate(p.cx, p.cy);
                ctx.rotate(p.rot);
                const sm = 1 - 0.5 * smooth(0.6, 1.25, age);
                ctx.scale(sm, sm);
                ctx.translate(-p.cx, -p.cy);
            }
            else {
                const stress = S.cracks[1] && t > S.cracks[1].at ? 1 : 0;
                const d = Math.hypot(p.cx, p.cy) || 1;
                ctx.translate(x + (p.cx / d) * stress * 1.2, y + (p.cy / d) * stress * 1.2);
                ctx.translate(p.anchorX, p.anchorY);
                ctx.scale(g, g);
                ctx.translate(-p.anchorX, -p.anchorY);
            }
            ctx.globalAlpha = alpha;
            const n = p.poly.length / 2;
            const path = () => { ctx.beginPath(); for (let k = 0; k < n; k++)
                ctx[k ? "lineTo" : "moveTo"](p.poly[k * 2], p.poly[k * 2 + 1]); ctx.closePath(); };
            path();
            const fresh = 1 - smooth(0.02, 0.2, t - p.appear);
            ctx.fillStyle = fresh > 0.3 ? "rgba(240,250,255,0.85)" : "rgba(186,228,249,0.56)";
            ctx.fill();
            // facet highlight (one lit triangle per plate)
            const k0 = p.hl % n, k1 = (p.hl + 1) % n;
            ctx.beginPath();
            ctx.moveTo(p.cx, p.cy);
            ctx.lineTo(p.poly[k0 * 2], p.poly[k0 * 2 + 1]);
            ctx.lineTo(p.poly[k1 * 2], p.poly[k1 * 2 + 1]);
            ctx.closePath();
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fill();
            // outer rim edge frost: thick white on edges lying on the shell boundary
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.beginPath();
            for (let k = 0; k < n; k++) {
                const ax = p.poly[k * 2], ay = p.poly[k * 2 + 1], bx2 = p.poly[((k + 1) % n) * 2], by2 = p.poly[((k + 1) % n) * 2 + 1];
                if (Math.hypot(ax, ay) > S.R * 1.02 && Math.hypot(bx2, by2) > S.R * 1.02) {
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(bx2, by2);
                }
            }
            ctx.lineWidth = 3.4;
            ctx.strokeStyle = "#f7fcff";
            ctx.stroke();
            path();
            ctx.lineWidth = Math.max(px, 1.2);
            ctx.strokeStyle = "#3a78b3";
            ctx.stroke();
            ctx.restore();
        }
        // closure seam: after all plates arrive, one short bright ring resolves and immediately dies.
        // The shell then reads as colder/heavier material rather than a permanent glowing barrier.
        const lockAge = t - (S.t0 + 0.34);
        if (lockAge > 0 && lockAge < 0.24 && !S.released) {
            const q = sat(lockAge / 0.24);
            const sweep = easeOutCubic(sat(lockAge / 0.12));
            ctx.save();
            ctx.translate(x, y);
            ctx.globalAlpha = (1 - q) * 0.92;
            ctx.strokeStyle = "#f8fdff";
            ctx.lineWidth = Math.max(px * 1.5, 1.3);
            ctx.beginPath();
            ctx.arc(0, 0, S.R * 1.17, S.hitAng - 0.18, S.hitAng - 0.18 + TAU * sweep);
            ctx.stroke();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        // strong cracks: revealed along length
        for (const c of S.cracks) {
            if (t < c.at || S.done)
                continue;
            const rev = sat((t - c.at) / 0.09);
            const m = c.pts.length / 2;
            const upto = rev * (m - 1);
            for (let pass = 0; pass < 2; pass++) {
                ctx.beginPath();
                const o = pass ? -0.9 : 0;
                ctx.moveTo(x + c.pts[0] + o, y + c.pts[1] + o);
                for (let j = 1; j <= Math.ceil(upto); j++) {
                    const f = Math.min(1, upto - (j - 1));
                    ctx.lineTo(x + lerp(c.pts[(j - 1) * 2], c.pts[j * 2], f) + o, y + lerp(c.pts[(j - 1) * 2 + 1], c.pts[j * 2 + 1], f) + o);
                }
                ctx.lineWidth = pass ? c.w * 0.8 : c.w;
                ctx.strokeStyle = pass ? "#ffffff" : "#1f4f86";
                ctx.stroke();
            }
        }
    }
    // ------------------------------------------------------------ GUN
    drawGunFrost(ctx, g, px, clipFn) {
        // Gold drawGun 2787-2906 frost overlay (demo gun base cut; production
        // draws the real Arsenal sprite underneath). clipFn traces the real
        // gun silhouette for tint/clip; default is the Gold demo silhouette.
        const t = this.t;
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(-15, -5);
            ctx.lineTo(10, -5);
            ctx.lineTo(13, -3);
            ctx.lineTo(13, 3);
            ctx.lineTo(10, 5.5);
            ctx.lineTo(4, 5.5);
            ctx.lineTo(4, 11);
            ctx.lineTo(-1, 11);
            ctx.lineTo(-1, 5.5);
            ctx.lineTo(-7, 5.5);
            ctx.lineTo(-9, 12);
            ctx.lineTo(-14, 12);
            ctx.lineTo(-13, 5.5);
            ctx.lineTo(-15, 4);
            ctx.closePath();
        };
        const trace = clipFn || body;
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.a);
        ctx.translate(g.kick.x * 0.08, 0);
        const f = g.frost;
        if (f > 0.01) {
            // cold tint on the metal
            trace();
            ctx.fillStyle = `rgba(165,215,245,${0.3 * f})`;
            ctx.fill();
            // thin cold plates on selected edges
            ctx.globalAlpha = sat(f * 1.4 - 0.3);
            const plates = [
                [-15, -5, -6, -7.5, -2, -5, -9, -2.5],
                [8, -5.5, 14, -4, 16, -1.5, 11, -2],
                [-14, 12, -8.5, 13.5, -7, 8, -12, 7],
            ];
            for (const q of plates) {
                ctx.beginPath();
                ctx.moveTo(q[0], q[1]);
                ctx.lineTo(q[2], q[3]);
                ctx.lineTo(q[4], q[5]);
                ctx.lineTo(q[6], q[7]);
                ctx.closePath();
                ctx.fillStyle = "rgba(200,236,252,0.85)";
                ctx.fill();
                ctx.lineWidth = Math.max(px * 0.8, 0.7);
                ctx.strokeStyle = "#4a86bd";
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            // packed frost crawling up from the lower silhouette (bottom-rear first)
            const spots = [[-12, 12.5, 4.2], [-6, 6.5, 3.4], [1.5, 11.5, 3.6], [6, 6, 3], [-15, 1, 3.4], [11, 5, 2.8], [22, 2.6, 2.4]];
            spots.forEach(([sx, sy, r], i) => {
                const th = i / spots.length;
                const k = smooth(th * 0.8, th * 0.8 + 0.25, f);
                if (k <= 0)
                    return;
                ctx.save();
                ctx.translate(sx, sy);
                ctx.scale(k, k);
                blobPath(ctx, r * 1.3, r, g.seed + i * 3);
                ctx.fillStyle = PAL.white;
                ctx.fill();
                ctx.lineWidth = Math.max(px * 0.8, 0.7);
                ctx.strokeStyle = PAL.outlineIce;
                ctx.stroke();
                ctx.restore();
            });
            // cold snap sweep across the weapon + one crack
            const snap = t - g.snapAt;
            if (snap > 0 && snap < 0.2) {
                const sx = lerp(-18, 30, snap / 0.2);
                ctx.save();
                trace();
                ctx.rect(12, -2.3, 15, 4.6);
                ctx.clip();
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.beginPath();
                ctx.moveTo(sx - 3, -14);
                ctx.lineTo(sx + 3, -14);
                ctx.lineTo(sx - 1, 14);
                ctx.lineTo(sx - 7, 14);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            if (snap > 0.1) {
                ctx.beginPath();
                ctx.moveTo(-4, -5);
                ctx.lineTo(-2, -1.5);
                ctx.lineTo(-4.5, 1);
                ctx.lineTo(-2.5, 4.5);
                ctx.lineWidth = Math.max(px, 0.9);
                ctx.strokeStyle = `rgba(255,255,255,${0.9 * f})`;
                ctx.stroke();
            }
        }
        ctx.restore();
    }
    drawBulletFrost(ctx, x, y, a, px) {
        // Gold drawBullets 2907-2955 wake + cold leading edge (demo brass cut;
        // production draws the real projectile underneath). lineWidth for the
        // cold edge was inherited from the cut brass block: set explicitly.
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        // chill wake: short tapered filled wisp
        ctx.beginPath();
        ctx.moveTo(-3, -2.6);
        ctx.quadraticCurveTo(-16, -1.8, -30, 0);
        ctx.quadraticCurveTo(-16, 1.8, -3, 2.6);
        ctx.closePath();
        ctx.fillStyle = "rgba(190,232,250,0.85)";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-3, -1.1);
        ctx.quadraticCurveTo(-12, -0.6, -20, 0);
        ctx.quadraticCurveTo(-12, 0.6, -3, 1.1);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        // colder leading edge on the real projectile body
        ctx.beginPath();
        ctx.moveTo(1, -2.4);
        ctx.lineTo(4.5, -2);
        ctx.lineTo(8, 0);
        ctx.lineTo(4.5, 2);
        ctx.lineTo(1, 2.4);
        ctx.closePath();
        ctx.fillStyle = "#e9fbff";
        ctx.fill();
        ctx.lineWidth = Math.max(px, 0.9);
        ctx.strokeStyle = "#2b5f95";
        ctx.stroke();
        ctx.restore();
    }
}




let loadPromise = null;
const cacheStats = { loadCalls: 0 };
// Gold updateBullets fleck law 2180-2185 (demo integration/collision cut).
function frostBulletFleck(b, dt) {
    b.age += dt;
    if (b.age - b.lastFleck > 0.05) {
        b.lastFleck = b.age;
        spawnChip(b.x, b.y, Math.atan2(-b.vy, -b.vx) + rnd(-0.5, 0.5), 60, 2, { outline: false, vz: 10, life: 0.35 });
    }
}
window.APEX_FROST_GOLD = {
    FrostEngine, IceField, Rng, Crit, Spring, R, rng, rnd, PAL, FROST_META,
    FROST_LAYERS, K, M, LAYERS, mkCanvas, mipChain, pick,
    TAU, clamp, lerp, sat, smooth, easeOutCubic, easeOutQuart, easeInCubic,
    easeOutBack, damp, angDiff, hash1, noise1,
    updateShapes, drawFloorShapes, drawAirShapes, drawRibbonLayer, clearShapes,
    frostBulletFleck, cacheStats,
};
window.apexFrostGoldV1 = 'ready';

})();
