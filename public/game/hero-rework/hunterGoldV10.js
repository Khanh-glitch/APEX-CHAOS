// Generated from hash-verified V10 by tools/bridgeHunterGoldV10.mjs.
(function(){

const __mods = Object.create(null), __cache = Object.create(null);
function __def(id,fn){ __mods[id]=fn; }
function __norm(p){ const a=[]; for(const x of p.split('/')){ if(!x||x==='.')continue; if(x==='..')a.pop(); else a.push(x); } return a.join('/').replace(/\.js$/,''); }
function __reqFrom(from,spec){ let id; if(spec.startsWith('.')){ const base=from.split('/').slice(0,-1).join('/'); id=__norm(base+'/'+spec); } else id=__norm(spec); return __require(id); }
function __require(id){ id=__norm(id); if(__cache[id]) return __cache[id].exports; const fn=__mods[id]; if(!fn) throw new Error('Module not found: '+id); const m={exports:{}}; __cache[id]=m; fn(m,m.exports,(s)=>__reqFrom(id,s)); return m.exports; }
__def("hunter/art", function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ART = void 0;
// AUTO-GENERATED: segmented source-art sprites inlined as data URLs.
/* eslint-disable */
exports.ART = {
    hunter_head: "/assets/hero-rework/hunter-v10/part-0.png",
    hunter_antL: "/assets/hero-rework/hunter-v10/part-1.png",
    hunter_antR: "/assets/hero-rework/hunter-v10/part-2.png",
    hunter_armL: "/assets/hero-rework/hunter-v10/part-3.png",
    hunter_armR: "/assets/hero-rework/hunter-v10/part-4.png",
};

});
__def("hunter/core", function(module,exports,require){
"use strict";
/* HUNTER — motion core.
   Spring-damper integrators are the exact (analytic) solutions described by
   Daniel Holden's "Spring-It-On" and Ryan Juckett's "Damped Springs":
   stable for any dt, no explicit-Euler blow-up, halflife-parameterised.
   Interception uses the standard |P + Vt| = St quadratic. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsign = exports.rrange = exports.decayTo = exports.spring = exports.fastNegExp = exports.halflifeToDamping = exports.easeBackOut = exports.easeSnap = exports.easeInOut = exports.easeInQuart = exports.easeInCubic = exports.easeOutQuint = exports.easeOutCubic = exports.angLerp = exports.angWrap = exports.deg = exports.rad = exports.smootherstep = exports.smoothstep = exports.lerp = exports.clamp01 = exports.clamp = exports.TAU = void 0;
exports.springTo = springTo;
exports.springRatio = springRatio;
exports.interceptTime = interceptTime;
exports.rnd = rnd;
exports.noise1 = noise1;
exports.TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
exports.clamp = clamp;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
exports.clamp01 = clamp01;
const lerp = (a, b, t) => a + (b - a) * t;
exports.lerp = lerp;
const smoothstep = (e0, e1, x) => {
    const t = (0, exports.clamp01)((x - e0) / (e1 - e0 || 1e-6));
    return t * t * (3 - 2 * t);
};
exports.smoothstep = smoothstep;
const smootherstep = (e0, e1, x) => {
    const t = (0, exports.clamp01)((x - e0) / (e1 - e0 || 1e-6));
    return t * t * t * (t * (t * 6 - 15) + 10);
};
exports.smootherstep = smootherstep;
const rad = (d) => (d * Math.PI) / 180;
exports.rad = rad;
const deg = (r) => (r * 180) / Math.PI;
exports.deg = deg;
const angWrap = (a) => {
    let x = a;
    while (x > Math.PI)
        x -= exports.TAU;
    while (x < -Math.PI)
        x += exports.TAU;
    return x;
};
exports.angWrap = angWrap;
const angLerp = (a, b, t) => a + (0, exports.angWrap)(b - a) * t;
exports.angLerp = angLerp;
/* ---------- easing ---------- */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
exports.easeOutCubic = easeOutCubic;
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
exports.easeOutQuint = easeOutQuint;
const easeInCubic = (t) => t * t * t;
exports.easeInCubic = easeInCubic;
const easeInQuart = (t) => t * t * t * t;
exports.easeInQuart = easeInQuart;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
exports.easeInOut = easeInOut;
/** front-loaded: near-instant commit then settle. Used for the pounce. */
const easeSnap = (t) => 1 - Math.pow(1 - t, 2.2);
exports.easeSnap = easeSnap;
const easeBackOut = (t, s = 1.7) => {
    const c3 = s + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
};
exports.easeBackOut = easeBackOut;
/* ---------- exact spring dampers ---------- */
const LN2x4 = 4 * 0.6931471805599453;
const halflifeToDamping = (h) => LN2x4 / (h + 1e-5);
exports.halflifeToDamping = halflifeToDamping;
const fastNegExp = (x) => 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
exports.fastNegExp = fastNegExp;
const spring = (x = 0, v = 0) => ({ x, v });
exports.spring = spring;
/** critically damped exact integration toward goal */
function springTo(s, goal, halflife, dt) {
    const y = (0, exports.halflifeToDamping)(halflife) / 2;
    const j0 = s.x - goal;
    const j1 = s.v + j0 * y;
    const e = (0, exports.fastNegExp)(y * dt);
    s.x = e * (j0 + j1 * dt) + goal;
    s.v = e * (s.v - j1 * y * dt);
}
/** full damping-ratio spring: ratio<1 overshoots (snap + wobble), =1 critical, >1 sluggish */
function springRatio(s, goal, ratio, halflife, dt) {
    const eps = 1e-5;
    const d = (0, exports.halflifeToDamping)(halflife);
    const st = (d / (ratio * 2 + eps)) ** 2;
    const c = goal;
    const y = d / 2;
    const disc = st - (d * d) / 4;
    if (Math.abs(disc) < eps) {
        const j0 = s.x - c;
        const j1 = s.v + j0 * y;
        const e = (0, exports.fastNegExp)(y * dt);
        s.x = j0 * e + dt * j1 * e + c;
        s.v = -y * j0 * e - y * dt * j1 * e + j1 * e;
    }
    else if (disc > 0) {
        const w = Math.sqrt(disc);
        let j = Math.sqrt(((s.v + y * (s.x - c)) ** 2) / (w * w + eps) + (s.x - c) ** 2);
        const p = Math.atan2(s.v + (s.x - c) * y, -(s.x - c) * w + eps);
        j = s.x - c > 0 ? j : -j;
        const e = (0, exports.fastNegExp)(y * dt);
        s.x = j * e * Math.cos(w * dt + p) + c;
        s.v = -y * j * e * Math.cos(w * dt + p) - w * j * e * Math.sin(w * dt + p);
    }
    else {
        const y0 = (d + Math.sqrt(d * d - 4 * st)) / 2;
        const y1 = (d - Math.sqrt(d * d - 4 * st)) / 2;
        const j1 = (c * y0 - s.x * y0 - s.v) / (y1 - y0);
        const j0 = s.x - j1 - c;
        const e0 = (0, exports.fastNegExp)(y0 * dt);
        const e1 = (0, exports.fastNegExp)(y1 * dt);
        s.x = j0 * e0 + j1 * e1 + c;
        s.v = -y0 * j0 * e0 - y1 * j1 * e1;
    }
}
/** exponential decay toward goal (frame-rate independent lerp) */
const decayTo = (cur, goal, halflife, dt) => goal + (cur - goal) * (0, exports.fastNegExp)((0.6931471805599453 * dt) / (halflife + 1e-5));
exports.decayTo = decayTo;
/* ---------- interception ----------
   Solve |Pt + Vt·t| = S·t  ->  (|V|²-S²)t² + 2(P·V)t + |P|² = 0
   Take the smallest positive root (earliest feasible intercept). */
function interceptTime(px, py, vx, vy, speed) {
    const a = vx * vx + vy * vy - speed * speed;
    const b = 2 * (px * vx + py * vy);
    const c = px * px + py * py;
    if (Math.abs(a) < 1e-6) {
        if (Math.abs(b) < 1e-6)
            return -1;
        const t = -c / b;
        return t > 0 ? t : -1;
    }
    const disc = b * b - 4 * a * c;
    if (disc < 0)
        return -1;
    const q = Math.sqrt(disc);
    const t1 = (-b + q) / (2 * a);
    const t2 = (-b - q) / (2 * a);
    const lo = Math.min(t1, t2);
    const hi = Math.max(t1, t2);
    if (lo > 1e-4)
        return lo;
    if (hi > 1e-4)
        return hi;
    return -1;
}
/* ---------- deterministic-ish noise ---------- */
let seed = 1337;
function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
}
const rrange = (a, b) => a + rnd() * (b - a);
exports.rrange = rrange;
const rsign = () => (rnd() < 0.5 ? -1 : 1);
exports.rsign = rsign;
const P = [];
for (let i = 0; i < 512; i++)
    P[i] = Math.sin(i * 12.9898) * 43758.5453 % 1;
function noise1(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = P[((i % 256) + 256) % 256];
    const b = P[(((i + 1) % 256) + 256) % 256];
    return (0, exports.lerp)(a, b, u) * 2 - 1;
}

});
__def("hunter/fx", function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILTER_OK = exports.Ribbon = exports.FX = exports.PAL = void 0;
exports.refract = refract;
exports.bloom = bloom;
exports.jitter = jitter;
/* HUNTER — VFX architecture.
   Layers are functional, not decorative:
     RIBBON  = true motion history (blade tips / body path)
     ECHO    = source-art transform history (drawn by the sim)
     STREAK  = velocity / direction
     SHARD   = material fracture + convergence
     SPARK   = contact energy
     DUST    = ground / weight
     RING    = local space compression
     DISTORT = local refraction of the already-rendered frame
     BLOOM   = quarter-res bright-pass + additive composite (cheap Canvas-2D bloom)
*/
const core_1 = require("./core");
exports.PAL = {
    lime: '#b8ff35',
    acid: '#e9ff74',
    pale: '#f6ffe2',
    deep: '#59a81e',
    dark: '#1d3a08',
    amber: '#ffb347',
    ember: '#ff7a2f',
    steel: '#8fa6bb',
};
class FX {
    constructor(n = 900) {
        this.pool = [];
        for (let i = 0; i < n; i++)
            this.pool.push(this.blank());
    }
    blank() {
        return {
            live: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1,
            size: 1, size2: 1, rot: 0, vr: 0, drag: 2, grav: 0, col: exports.PAL.lime, col2: exports.PAL.pale,
            tx: 0, ty: 0, a: 0, b: 0, add: true,
        };
    }
    get() {
        for (let i = 0; i < this.pool.length; i++)
            if (!this.pool[i].live) {
                const p = this.pool[i];
                p.live = true;
                return p;
            }
        const p = this.blank();
        p.live = true;
        this.pool.push(p);
        return p;
    }
    spark(x, y, ang, spd, life = 0.35, col = exports.PAL.acid, len = 14) {
        const p = this.get();
        p.kind = 'spark';
        p.x = x;
        p.y = y;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.life = p.max = life;
        p.size = len;
        p.size2 = 1.6;
        p.drag = 3.2;
        p.grav = 220;
        p.col = col;
        p.col2 = exports.PAL.pale;
        p.add = true;
        return p;
    }
    shard(x, y, ang, spd, life = 0.6, size = 9, col = exports.PAL.lime) {
        const p = this.get();
        p.kind = 'shard';
        p.x = x;
        p.y = y;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.life = p.max = life;
        p.size = size;
        p.rot = (0, core_1.rrange)(0, 6.28);
        p.vr = (0, core_1.rrange)(-9, 9);
        p.drag = 1.9;
        p.grav = 300;
        p.col = col;
        p.add = false;
        return p;
    }
    dust(x, y, ang, spd, life = 0.8, size = 16, col = '#6f7a5a') {
        const p = this.get();
        p.kind = 'dust';
        p.x = x;
        p.y = y;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.life = p.max = life;
        p.size = size;
        p.size2 = (0, core_1.rrange)(1.6, 3.4);
        p.drag = 2.6;
        p.grav = -6;
        p.col = col;
        p.add = false;
        return p;
    }
    ring(x, y, r0, r1, life, col = exports.PAL.acid, w = 3, squash = 1, rot = 0) {
        const p = this.get();
        p.kind = 'ring';
        p.x = x;
        p.y = y;
        p.life = p.max = life;
        p.size = r0;
        p.size2 = r1;
        p.a = squash;
        p.rot = rot;
        p.b = w;
        p.col = col;
        p.add = true;
        return p;
    }
    streak(x, y, ang, len, w, life, col = exports.PAL.lime, spd = 0) {
        const p = this.get();
        p.kind = 'streak';
        p.x = x;
        p.y = y;
        p.rot = ang;
        p.size = len;
        p.size2 = w;
        p.life = p.max = life;
        p.col = col;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.drag = 4;
        p.add = true;
        return p;
    }
    converge(x, y, tx, ty, life, col = exports.PAL.acid, size = 3) {
        const p = this.get();
        p.kind = 'converge';
        p.x = x;
        p.y = y;
        p.tx = tx;
        p.ty = ty;
        p.a = x;
        p.b = y;
        p.life = p.max = life;
        p.col = col;
        p.size = size;
        p.add = true;
        return p;
    }
    glint(x, y, size, life, col = exports.PAL.pale) {
        const p = this.get();
        p.kind = 'glint';
        p.x = x;
        p.y = y;
        p.size = size;
        p.life = p.max = life;
        p.col = col;
        p.rot = (0, core_1.rrange)(0, 1.57);
        p.add = true;
        return p;
    }
    crack(x, y, ang, len, life, col = '#20301a') {
        const p = this.get();
        p.kind = 'crack';
        p.x = x;
        p.y = y;
        p.rot = ang;
        p.size = len;
        p.life = p.max = life;
        p.col = col;
        p.add = false;
        p.a = (0, core_1.rrange)(0.3, 0.8);
        return p;
    }
    update(dt) {
        for (const p of this.pool) {
            if (!p.live)
                continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.live = false;
                continue;
            }
            if (p.kind === 'converge') {
                const t = 1 - p.life / p.max;
                const e = t * t;
                p.x = (0, core_1.lerp)(p.a, p.tx, e);
                p.y = (0, core_1.lerp)(p.b, p.ty, e);
                continue;
            }
            if (p.kind === 'ring' || p.kind === 'crack' || p.kind === 'glint')
                continue;
            const d = Math.exp(-p.drag * dt);
            p.vx *= d;
            p.vy *= d;
            p.vy += p.grav * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
        }
    }
    draw(ctx, additive) {
        ctx.save();
        ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
        for (const p of this.pool) {
            if (!p.live || p.add !== additive)
                continue;
            const t = (0, core_1.clamp01)(p.life / p.max);
            switch (p.kind) {
                case 'spark': {
                    const sp = Math.hypot(p.vx, p.vy);
                    const l = Math.min(p.size, sp * 0.032) * (0.35 + t * 0.65);
                    const a = Math.atan2(p.vy, p.vx);
                    const ex = p.x - Math.cos(a) * l, ey = p.y - Math.sin(a) * l;
                    const g = ctx.createLinearGradient(p.x, p.y, ex, ey);
                    g.addColorStop(0, p.col2);
                    g.addColorStop(0.35, p.col);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.globalAlpha = t;
                    ctx.strokeStyle = g;
                    ctx.lineWidth = p.size2 * (0.4 + t * 0.6);
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(ex, ey);
                    ctx.stroke();
                    break;
                }
                case 'shard': {
                    ctx.globalAlpha = Math.min(1, t * 1.8);
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    const s = p.size * (0.4 + t * 0.6);
                    ctx.fillStyle = p.col;
                    ctx.beginPath();
                    ctx.moveTo(0, -s);
                    ctx.lineTo(s * 0.42, 0);
                    ctx.lineTo(0, s * 0.8);
                    ctx.lineTo(-s * 0.38, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(12,22,6,0.85)';
                    ctx.lineWidth = 1.1;
                    ctx.stroke();
                    ctx.restore();
                    break;
                }
                case 'dust': {
                    ctx.globalAlpha = t * t * 0.42;
                    const s = p.size * (1 + (1 - t) * p.size2);
                    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
                    g.addColorStop(0, p.col);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, s, 0, 6.2832);
                    ctx.fill();
                    break;
                }
                case 'ring': {
                    const k = 1 - t;
                    const r = (0, core_1.lerp)(p.size, p.size2, k * (2 - k));
                    ctx.globalAlpha = t * t;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.scale(1, p.a);
                    ctx.strokeStyle = p.col;
                    ctx.lineWidth = p.b * t;
                    ctx.beginPath();
                    ctx.arc(0, 0, r, 0, 6.2832);
                    ctx.stroke();
                    ctx.restore();
                    break;
                }
                case 'streak': {
                    ctx.globalAlpha = t * t;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    const L = p.size * (0.5 + t * 0.5), W = p.size2 * t;
                    const g = ctx.createLinearGradient(-L, 0, L * 0.25, 0);
                    g.addColorStop(0, 'rgba(0,0,0,0)');
                    g.addColorStop(0.7, p.col);
                    g.addColorStop(1, exports.PAL.pale);
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.moveTo(-L, 0);
                    ctx.quadraticCurveTo(-L * 0.4, -W, L * 0.25, 0);
                    ctx.quadraticCurveTo(-L * 0.4, W, -L, 0);
                    ctx.fill();
                    ctx.restore();
                    break;
                }
                case 'converge': {
                    const k = 1 - t;
                    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.95;
                    const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
                    const l = p.size * 3.4;
                    const g = ctx.createLinearGradient(p.x - Math.cos(ang) * l, p.y - Math.sin(ang) * l, p.x, p.y);
                    g.addColorStop(0, 'rgba(0,0,0,0)');
                    g.addColorStop(1, p.col);
                    ctx.strokeStyle = g;
                    ctx.lineWidth = p.size * 0.9;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(p.x - Math.cos(ang) * l, p.y - Math.sin(ang) * l);
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                    break;
                }
                case 'glint': {
                    const k = Math.sin((0, core_1.clamp01)(1 - p.life / p.max) * Math.PI);
                    ctx.globalAlpha = k;
                    const s = p.size * (0.5 + k * 0.9);
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
                    g.addColorStop(0, p.col);
                    g.addColorStop(0.25, 'rgba(200,255,120,0.5)');
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(0, 0, s, 0, 6.2832);
                    ctx.fill();
                    ctx.fillStyle = p.col;
                    ctx.beginPath();
                    ctx.moveTo(0, -s * 2.1);
                    ctx.lineTo(s * 0.16, -s * 0.16);
                    ctx.lineTo(s * 2.1, 0);
                    ctx.lineTo(s * 0.16, s * 0.16);
                    ctx.lineTo(0, s * 2.1);
                    ctx.lineTo(-s * 0.16, s * 0.16);
                    ctx.lineTo(-s * 2.1, 0);
                    ctx.lineTo(-s * 0.16, -s * 0.16);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                    break;
                }
                case 'crack': {
                    ctx.globalAlpha = t * 0.55;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.scale(1, 0.42);
                    ctx.strokeStyle = p.col;
                    ctx.lineWidth = 2.2;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    let cx = 0, cy = 0;
                    for (let i = 0; i < 4; i++) {
                        cx += p.size * 0.25;
                        cy += (i % 2 ? 1 : -1) * p.size * 0.11 * p.a;
                        ctx.lineTo(cx, cy);
                    }
                    ctx.stroke();
                    ctx.restore();
                    break;
                }
            }
        }
        ctx.restore();
    }
}
exports.FX = FX;
class Ribbon {
    constructor(maxLife = 0.28, width = 14, col = exports.PAL.lime, core = exports.PAL.pale) {
        this.maxLife = maxLife;
        this.width = width;
        this.col = col;
        this.core = core;
        this.pts = [];
    }
    push(x, y, now) {
        const l = this.pts[this.pts.length - 1];
        if (l && Math.hypot(l.x - x, l.y - y) < 1.2 && now - l.t < 0.05)
            return;
        this.pts.push({ x, y, t: now });
    }
    prune(now) { while (this.pts.length && now - this.pts[0].t > this.maxLife)
        this.pts.shift(); }
    clear() { this.pts.length = 0; }
    /** collapse toward a point (recovery / trail collapse) */
    collapse(x, y, k) {
        for (const p of this.pts) {
            p.x = (0, core_1.lerp)(p.x, x, k);
            p.y = (0, core_1.lerp)(p.y, y, k);
        }
    }
    draw(ctx, now, alpha = 1, widthMul = 1) {
        const n = this.pts.length;
        if (n < 3)
            return;
        const L = [], R = [];
        for (let i = 0; i < n; i++) {
            const p = this.pts[i];
            const a = this.pts[Math.max(0, i - 1)], b = this.pts[Math.min(n - 1, i + 1)];
            let dx = b.x - a.x, dy = b.y - a.y;
            const l = Math.hypot(dx, dy) || 1;
            dx /= l;
            dy /= l;
            const age = (0, core_1.clamp01)(1 - (now - p.t) / this.maxLife);
            const head = i / (n - 1);
            const w = this.width * widthMul * age * (0.25 + 0.75 * Math.sin(head * Math.PI * 0.85 + 0.2));
            L.push({ x: p.x - dy * w, y: p.y + dx * w });
            R.push({ x: p.x + dy * w, y: p.y - dx * w });
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const hd = this.pts[n - 1], tl = this.pts[0];
        const g = ctx.createLinearGradient(tl.x, tl.y, hd.x, hd.y);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.45, this.col);
        g.addColorStop(1, this.core);
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(L[0].x, L[0].y);
        for (let i = 1; i < n; i++)
            ctx.lineTo(L[i].x, L[i].y);
        for (let i = n - 1; i >= 0; i--)
            ctx.lineTo(R[i].x, R[i].y);
        ctx.closePath();
        ctx.fill();
        // luminous core line
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6 * widthMul;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(this.pts[0].x, this.pts[0].y);
        for (let i = 1; i < n; i++)
            ctx.lineTo(this.pts[i].x, this.pts[i].y);
        ctx.stroke();
        ctx.restore();
    }
}
exports.Ribbon = Ribbon;
let rC = null, rX = null;
/* ---------------- local distortion ----------------
   Refract the already-rendered frame inside an annulus by re-blitting the
   framebuffer scaled about the impact point — a genuine local displacement
   of real pixels rather than a painted "shock" decal. */
function refract(ctx, src, sx, sy, r, thick, amount, alpha = 1, squash = 1, rot = 0) {
    if (r <= 2 || thick <= 0.5 || alpha <= 0.001)
        return;
    // Copy only the affected local patch. The old implementation re-blitted the ENTIRE
    // framebuffer back into itself for every refraction ring; on high-DPR canvases that
    // could stall the tab exactly when dodge/projectile impact VFX stacked up.
    const pad = 6;
    const R = Math.ceil(r + thick + pad);
    const D = Math.max(2, R * 2);
    if (!rC) {
        rC = document.createElement('canvas');
        rX = rC.getContext('2d');
    }
    if (rC.width !== D || rC.height !== D) {
        rC.width = D;
        rC.height = D;
    }
    const rx = rX;
    rx.setTransform(1, 0, 0, 1, 0, 0);
    rx.globalCompositeOperation = 'copy';
    rx.clearRect(0, 0, D, D);
    rx.drawImage(src, sx - R, sy - R, D, D, 0, 0, D, D);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.scale(1, squash);
    ctx.arc(0, 0, r + thick, 0, 6.2832);
    ctx.arc(0, 0, Math.max(0.1, r - thick * 0.9), 0, 6.2832, true);
    ctx.restore();
    ctx.clip('evenodd');
    const sc = 1 + amount;
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy);
    ctx.scale(sc, sc);
    ctx.drawImage(rC, -R, -R);
    ctx.restore();
}
/* ---------------- bloom ----------------
   Quarter-res bright-pass + blur + additive composite. Doing the blur on a
   1/16-area buffer is what makes this affordable in Canvas 2D. */
let bC = null, bX = null;
exports.FILTER_OK = (() => {
    try {
        const a = document.createElement('canvas'), b = document.createElement('canvas');
        a.width = a.height = b.width = b.height = 9;
        const ag = a.getContext('2d'), bg = b.getContext('2d');
        ag.fillStyle = '#fff';
        ag.fillRect(4, 4, 1, 1);
        bg.filter = 'blur(2px)';
        bg.drawImage(a, 0, 0);
        return bg.getImageData(2, 4, 1, 1).data[3] > 0;
    }
    catch {
        return false;
    }
})();
function bloom(cv, cx, strength = 0.46, bright = 'brightness(0.78) contrast(2.7) blur(3px)') {
    if (!exports.FILTER_OK) {
        strength *= 0.55;
        bright = 'none';
    }
    const bw = Math.max(1, cv.width >> 2), bh = Math.max(1, cv.height >> 2);
    if (!bC) {
        bC = document.createElement('canvas');
        bX = bC.getContext('2d');
    }
    if (bC.width !== bw || bC.height !== bh) {
        bC.width = bw;
        bC.height = bh;
    }
    const bx = bX;
    bx.globalCompositeOperation = 'copy';
    bx.filter = bright;
    bx.drawImage(cv, 0, 0, bw, bh);
    bx.filter = 'none';
    cx.save();
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = strength;
    cx.drawImage(bC, 0, 0, cv.width, cv.height);
    cx.restore();
}
function jitter(mag) { return ((0, core_1.rnd)() * 2 - 1) * mag; }

});
__def("hunter/rig", function(module,exports,require){
"use strict";
/* HUNTER — articulated source-art rig.
   Pattern follows Spine's runtime model: every part owns a LOCAL transform and
   its world transform is composed parent-first (world = parent.world * local).
   Bending of the raster art uses per-band affine texture mapping (clip a
   destination triangle, solve the 2x3 matrix that maps source corners onto it,
   blit the sub-rect) — the classic Canvas-2D texture-mapping trick. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Xf = exports.TRAP = exports.HUNTER = exports.TP = exports.HP = void 0;
exports.drawSkinned = drawSkinned;
exports.skinPoint = skinPoint;
exports.drawRigid = drawRigid;
exports.loadArt = loadArt;
exports.makeGlow = makeGlow;
const art_1 = require("./art");
const core_1 = require("./core");
/* --- segmentation metadata produced by the offline extraction pass --- */
exports.HP = {
    head: { x: 691, y: 154, w: 203, h: 379 },
    antL: { x: 508, y: 53, w: 258, h: 214 },
    antR: { x: 818, y: 54, w: 258, h: 213 },
    armL: { x: 505, y: 165, w: 289, h: 446 },
    armR: { x: 792, y: 165, w: 287, h: 446 },
};
exports.TP = {
    core: { x: 560, y: 103, w: 256, h: 441 },
    armA: { x: 482, y: 84, w: 412, h: 200 },
    armB: { x: 693, y: 288, w: 317, h: 393 },
    armC: { x: 366, y: 288, w: 317, h: 393 },
};
/* --- rig constants, all in source-image pixels --- */
exports.HUNTER = {
    origin: { x: 792, y: 430 },
    headPivot: { x: 792, y: 424 },
    antL: { root: { x: 757, y: 258 }, tip: { x: 528, y: 66 } },
    antR: { root: { x: 827, y: 258 }, tip: { x: 1056, y: 67 } },
    armL: { root: { x: 716, y: 292 }, elbow: { x: 600, y: 452 }, curl: { x: 690, y: 552 }, tip: { x: 786, y: 600 } },
    armR: { root: { x: 868, y: 292 }, elbow: { x: 984, y: 452 }, curl: { x: 894, y: 552 }, tip: { x: 798, y: 600 } },
    height: 555,
};
exports.TRAP = {
    center: { x: 687.5, y: 415 },
    arms: [
        { key: 'armA', ang: -90, root: { x: 687.5, y: 282 }, elbow: { x: 687.5, y: 205 }, tip: { x: 687.5, y: 120 } },
        { key: 'armB', ang: 27.6, root: { x: 807, y: 478 }, elbow: { x: 878, y: 515 }, tip: { x: 953, y: 554 } },
        { key: 'armC', ang: 152.5, root: { x: 568, y: 477 }, elbow: { x: 497, y: 514 }, tip: { x: 421, y: 554 } },
    ],
    width: 642,
};
/* ---------------- affine transform ---------------- */
class Xf {
    constructor() {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
    }
    set(a, b, c, d, e, f) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
        return this;
    }
    copy(o) { return this.set(o.a, o.b, o.c, o.d, o.e, o.f); }
    identity() { return this.set(1, 0, 0, 1, 0, 0); }
    /** this = this * (translate(x,y) rotate(r) scale(sx,sy) translate(-ox,-oy)) */
    compose(x, y, r, sx, sy, ox = 0, oy = 0) {
        const co = Math.cos(r), si = Math.sin(r);
        const a2 = co * sx, b2 = si * sx, c2 = -si * sy, d2 = co * sy;
        const e2 = x - (a2 * ox + c2 * oy);
        const f2 = y - (b2 * ox + d2 * oy);
        const { a, b, c, d, e, f } = this;
        return this.set(a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f);
    }
    px(x, y) { return this.a * x + this.c * y + this.e; }
    py(x, y) { return this.b * x + this.d * y + this.f; }
}
exports.Xf = Xf;
const _p = { x: 0, y: 0 };
function deform(px, py, s, dx, dy, alen) {
    const u = (0, core_1.clamp01)(((px - s.ax) * dx + (py - s.ay) * dy) / alen);
    let qx = px, qy = py;
    for (let i = s.joints.length - 1; i >= 0; i--) {
        const j = s.joints[i];
        if (j.ang === 0)
            continue;
        const w = (0, core_1.smoothstep)(j.u - j.blend, j.u + j.blend, u);
        if (w <= 0.0005)
            continue;
        const ang = j.ang * w;
        const co = Math.cos(ang), si = Math.sin(ang);
        const rx = qx - j.x, ry = qy - j.y;
        qx = j.x + rx * co - ry * si;
        qy = j.y + rx * si + ry * co;
    }
    if (s.stretch) {
        qx += dx * s.stretch * u;
        qy += dy * s.stretch * u;
    }
    if (s.widen) {
        const nx = -dy, ny = dx;
        const lat = (px - s.ax) * nx + (py - s.ay) * ny;
        const k = 1 + s.widen * u;
        qx += nx * lat * (k - 1);
        qy += ny * lat * (k - 1);
    }
    _p.x = qx;
    _p.y = qy;
    return _p;
}
function tri(ctx, img, view, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2, sx, sy, sw, sh) {
    const dx1 = x1 - x0, dy1 = y1 - y0, dx2 = x2 - x0, dy2 = y2 - y0;
    const su1 = u1 - u0, sv1 = v1 - v0, su2 = u2 - u0, sv2 = v2 - v0;
    const den = su1 * sv2 - su2 * sv1;
    if (Math.abs(den) < 1e-6)
        return;
    const id = 1 / den;
    const a = id * (sv2 * dx1 - sv1 * dx2);
    const b = id * (sv2 * dy1 - sv1 * dy2);
    const c = id * (su1 * dx2 - su2 * dx1);
    const d = id * (su1 * dy2 - su2 * dy1);
    const e = x0 - a * u0 - c * v0;
    const f = y0 - b * u0 - d * v0;
    // outset the clip a touch so adjacent bands do not show AA seams
    const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
    const O = 0.85;
    const ox = (px, py) => {
        const vx = px - cx, vy = py - cy, l = Math.hypot(vx, vy) || 1;
        return [px + (vx / l) * O, py + (vy / l) * O];
    };
    const p0 = ox(x0, y0), p1 = ox(x1, y1), p2 = ox(x2, y2);
    ctx.save();
    ctx.setTransform(view.a, view.b, view.c, view.d, view.e, view.f);
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
    ctx.restore();
}
/** Draw a segmented part through a 2-3 bone skin with band subdivision. */
function drawSkinned(ctx, img, def, xf, view, skin) {
    const dxa = skin.bx - skin.ax, dya = skin.by - skin.ay;
    const alen = Math.hypot(dxa, dya) || 1;
    const dx = dxa / alen, dy = dya / alen;
    const vertical = Math.abs(dy) >= Math.abs(dx);
    const N = skin.bands ?? 10;
    const X0 = def.x, Y0 = def.y, W = def.w, H = def.h;
    const put = (sxp, syp, out, oi) => {
        const q = deform(sxp, syp, skin, dx, dy, alen);
        out[oi] = xf.px(q.x, q.y);
        out[oi + 1] = xf.py(q.x, q.y);
    };
    const A = [0, 0, 0, 0], B = [0, 0, 0, 0];
    if (vertical) {
        const step = H / N;
        put(X0, Y0, A, 0);
        put(X0 + W, Y0, A, 2);
        for (let i = 0; i < N; i++) {
            const y1 = Y0 + (i + 1) * step;
            put(X0, y1, B, 0);
            put(X0 + W, y1, B, 2);
            const sy = i * step, sh = step + 1;
            const lu = 0, ru = W, tv = sy, bv = sy + step;
            tri(ctx, img, view, A[0], A[1], lu, tv, A[2], A[3], ru, tv, B[2], B[3], ru, bv, 0, sy, W, sh);
            tri(ctx, img, view, A[0], A[1], lu, tv, B[2], B[3], ru, bv, B[0], B[1], lu, bv, 0, sy, W, sh);
            A[0] = B[0];
            A[1] = B[1];
            A[2] = B[2];
            A[3] = B[3];
        }
    }
    else {
        const step = W / N;
        put(X0, Y0, A, 0);
        put(X0, Y0 + H, A, 2);
        for (let i = 0; i < N; i++) {
            const x1 = X0 + (i + 1) * step;
            put(x1, Y0, B, 0);
            put(x1, Y0 + H, B, 2);
            const sx = i * step, sw = step + 1;
            const tu = sx, bu = sx + step, lv = 0, rv = H;
            tri(ctx, img, view, A[0], A[1], tu, lv, B[0], B[1], bu, lv, B[2], B[3], bu, rv, sx, 0, sw, H);
            tri(ctx, img, view, A[0], A[1], tu, lv, B[2], B[3], bu, rv, A[2], A[3], tu, rv, sx, 0, sw, H);
            A[0] = B[0];
            A[1] = B[1];
            A[2] = B[2];
            A[3] = B[3];
        }
    }
}
/** world position of a skinned point (used for trails / contact anchors) */
function skinPoint(xf, skin, px, py) {
    const dxa = skin.bx - skin.ax, dya = skin.by - skin.ay;
    const alen = Math.hypot(dxa, dya) || 1;
    const q = deform(px, py, skin, dxa / alen, dya / alen, alen);
    return { x: xf.px(q.x, q.y), y: xf.py(q.x, q.y) };
}
function drawRigid(ctx, img, def, xf) {
    ctx.save();
    ctx.transform(xf.a, xf.b, xf.c, xf.d, xf.e, xf.f);
    ctx.drawImage(img, def.x, def.y);
    ctx.restore();
}
/* ---------------- asset loading ---------------- */
async function loadArt() {
    const out = {};
    await Promise.all(Object.keys(art_1.ART).map((k) => new Promise((res) => {
        const im = new Image();
        im.onload = () => { out[k] = im; res(); };
        im.onerror = () => res();
        im.src = art_1.ART[k];
    })));
    return out;
}
/** Offscreen luminous silhouette of a sprite, used for additive echoes / rim energy. */
function makeGlow(img, tint, blur) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = tint;
    x.fillRect(0, 0, c.width, c.height);
    if (blur > 0) {
        const d = document.createElement('canvas');
        d.width = c.width;
        d.height = c.height;
        const dx = d.getContext('2d');
        dx.filter = `blur(${blur}px)`;
        dx.drawImage(c, 0, 0);
        return d;
    }
    return c;
}

});
__def("hunter/sim", function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stage = void 0;
/* HUNTER — standalone visual prototype: simulation + choreography + render. */
const core_1 = require("./core");
const fx_1 = require("./fx");
const rig_1 = require("./rig");
const WW = 1280, WH = 720;
const GROUND = 596;
const H_SCALE = 0.335;
const P_SCALE = 0.33;
const T_SCALE = 0.5;
const H_FOOT = (609 - rig_1.HUNTER.origin.y) * H_SCALE; // origin -> art bottom
const PREY_W = 776, PREY_H = 665;
const armS = () => ({ sh: (0, core_1.spring)(), el: (0, core_1.spring)(), cu: (0, core_1.spring)(), st: (0, core_1.spring)() });
const newPose = () => ({
    x: 0, y: 0, rot: 0, sx: 1, sy: 1, head: 0, headY: 0, antL: 0, antR: 0, antLb: 0, antRb: 0,
    aL: [0, 0, 0, 0], aR: [0, 0, 0, 0],
});
const copyPose = (a) => ({ ...a, aL: [...a.aL], aR: [...a.aR] });
class Stage {
    constructor(cv) {
        this.cv = cv; this.ground = 596;
        this.art = {};
        this.glow = {};
        this.ready = false;
        this.fx = new fx_1.FX(1100);
        this.view = new rig_1.Xf();
        this.vs = 1;
        this.time = 0;
        this.timeScale = 1;
        this.tsTarget = 1;
        this.slowmo = false;
        this.closeUp = false;
        this.auto = true;
        this.autoT = 2.6;
        this.autoStep = 0;
        this.dilate = 0;
        this.dodgeX = 0;
        this.dodgeEchoNext = 0;
        this.closed = false;
        this.cutDone = false;
        this.recSet = false;
        this.recX = 0;
        this.refractBudget = 3;
        this.onHud = () => { };
        // ---- hunter ----
        this.h = {
            x: (0, core_1.spring)(340), y: (0, core_1.spring)(this.ground - H_FOOT), vx: 0, vy: 0,
            px: 340, py: this.ground - H_FOOT,
            rot: (0, core_1.spring)(), sx: (0, core_1.spring)(1), sy: (0, core_1.spring)(1),
            head: (0, core_1.spring)(), headY: (0, core_1.spring)(), antL: (0, core_1.spring)(), antR: (0, core_1.spring)(), antLb: (0, core_1.spring)(), antRb: (0, core_1.spring)(),
            aL: armS(), aR: armS(),
            eye: 1, mode: 'idle', phase: '', t: 0,
            ki: 0, shimmer: 0, microT: 2, blinkT: 3,
        };
        this.pose = newPose();
        this.aura = newPose();
        this.auraAlpha = (0, core_1.spring)(0);
        this.auraReady = false;
        this.echoes = [];
        this.ribL = new fx_1.Ribbon(0.3, 15, 'rgba(150,255,60,0.85)', 'rgba(245,255,220,0.95)');
        this.ribR = new fx_1.Ribbon(0.3, 15, 'rgba(150,255,60,0.85)', 'rgba(245,255,220,0.95)');
        this.ribC = new fx_1.Ribbon(0.22, 9, 'rgba(110,220,40,0.7)', 'rgba(230,255,190,0.9)');
        this.collapse = 0;
        // ---- prey ----
        this.p = {
            x: 930, y: this.ground, vx: 0, tx: 930, dir: 1, walk: 0, bob: (0, core_1.spring)(), lean: (0, core_1.spring)(),
            hit: 0, rooted: false, weak: 0, weakPulse: 0, struggle: 0,
            kx: (0, core_1.spring)(), ky: (0, core_1.spring)(), sq: (0, core_1.spring)(1), bend: (0, core_1.spring)(),
            patrolA: 720, patrolB: 1020, juke: 0, freeze: 0, hy: 0, hvy: 0, air: false,
        };
        this.marks = [0, 1, 2].map((i) => ({ a: (0, core_1.rad)(-90 + i * 120), r: (0, core_1.spring)(1), fl: 0 }));
        // ---- trap ----
        this.tr = {
            on: false, x: 0, y: this.ground - 62, phase: 'off', t: 0, scale: (0, core_1.spring)(0.3), lift: (0, core_1.spring)(0),
            arms: [0, 1, 2].map(() => ({ rot: (0, core_1.spring)(), cu: (0, core_1.spring)(), pull: (0, core_1.spring)(), sq: (0, core_1.spring)(1), gem: 0, strain: 0 })),
            captured: false, hold: 0, gem: (0, core_1.spring)(0), sweep: -1, sweepDir: 1, sweepAmp: 0, edge: 0,
        };
        // ---- projectile ----
        this.pr = { on: false, x: 0, y: 0, vx: 0, vy: 0, r: 15, life: 0, src: { x: 0, y: 0 }, tel: 0, passed: false };
        this.dodgeDir = 1;
        // ---- camera ----
        this.cam = { x: (0, core_1.spring)(WW / 2), y: (0, core_1.spring)(WH / 2 - 26), z: (0, core_1.spring)(1), trauma: 0, sx: 0, sy: 0 };
        this.a2 = { ipx: 0, ipy: 0, dir: 0, speed: 0, dist: 0, trav: 0, total: 0, corrected: false, oldDir: 0, turnX: 0, turnY: 0, turnT: -9 };
        this.ctx = cv.getContext('2d', { alpha: false });
    }



    /* ================= update ================= */

    get kiOn() { return this.p.weak > 0 || this.p.rooted; }

    /* ---------------- prey ---------------- */

    coreY() { return this.ground - PREY_H * P_SCALE * 0.55 + this.p.hy; }

    updateMarks(dt) {
        for (const m of this.marks) {
            (0, core_1.springRatio)(m.r, 1, 0.42, 0.24, dt);
            m.fl = Math.max(0, m.fl - dt * 3.2);
        }
    }
    /* ---------------- idle / locomotion ---------------- */
    updIdle(dt) {
        const h = this.h;
        h.phase = this.kiOn ? 'KILLER INSTINCT' : 'IDLE';
        const ki = this.kiOn ? 1 : 0;
        h.ki = (0, core_1.decayTo)(h.ki, ki, 0.25, dt);
        h.eye = (0, core_1.decayTo)(h.eye, 0.78 + h.ki * 0.22, 0.18, dt);
        // spacing behaviour: hold a predatory stand-off, drift slowly
        // Native APEX locomotion owns position; idle only articulates the rig.
        const sp = Math.abs(h.vx);
        // premium stillness: near-zero motion, rare micro corrections
        const n = (0, core_1.noise1)(this.time * 0.55) * 0.5 + (0, core_1.noise1)(this.time * 1.31 + 11) * 0.2;
        h.microT -= dt;
        if (h.microT <= 0) {
            h.microT = (0, core_1.rrange)(2.4, 5.2) * (1 - h.ki * 0.45);
            // a single tiny asymmetric blade repositioning — one tick, then settle
            const s = (0, core_1.rnd)() < 0.5 ? h.aL : h.aR;
            const sg = (0, core_1.rnd)() < 0.5 ? -1 : 1;
            s.sh.v += (0, core_1.rrange)(0.10, 0.22) * sg * (1 + h.ki * 0.8);
            s.el.v += (0, core_1.rrange)(0.14, 0.30) * sg;
            s.cu.v += (0, core_1.rrange)(0.10, 0.22) * -sg;
        }
        h.blinkT -= dt;
        if (h.blinkT <= 0) {
            h.blinkT = (0, core_1.rrange)(3.2, 6.4);
            h.eye = 0.25;
        }
        h.shimmer -= dt;
        if (h.shimmer < -2.6)
            h.shimmer = (0, core_1.rrange)(0.5, 0.9);
        const base = (0, core_1.rad)(-1.2) - (0, core_1.rad)(5.4) * h.ki;
        const lag = (0, core_1.clamp)(-h.vx * 0.00085, -0.11, 0.11);
        this.armTarget(h.aL, base + n * 0.006 + lag * 0.7, (0, core_1.rad)(0.8) - (0, core_1.rad)(6.2) * h.ki + n * 0.01 + lag, (0, core_1.rad)(0) - (0, core_1.rad)(3.4) * h.ki + lag * 1.5, 0, dt, 0.23, 0.55);
        this.armTarget(h.aR, base - n * 0.005 - lag * 0.7, (0, core_1.rad)(0.8) - (0, core_1.rad)(6.2) * h.ki - n * 0.008 - lag, (0, core_1.rad)(0) - (0, core_1.rad)(3.4) * h.ki - lag * 1.5, 0, dt, 0.23, 0.55);
        const face = (0, core_1.clamp)((this.p.x - h.px) * 0.00035, -0.12, 0.12);
        (0, core_1.springTo)(h.head, face * (0.5 + h.ki * 0.5) + n * 0.004, 0.3, dt);
        (0, core_1.springTo)(h.headY, h.ki * 3.2, 0.3, dt);
        (0, core_1.springRatio)(h.antL, (0, core_1.rad)(-1) + n * 0.02 - lag * 1.6, 0.5, 0.42, dt);
        (0, core_1.springRatio)(h.antR, (0, core_1.rad)(1) - n * 0.018 - lag * 1.6, 0.5, 0.42, dt);
        (0, core_1.springRatio)(h.antLb, -lag * 2.4 + n * 0.02, 0.4, 0.5, dt);
        (0, core_1.springRatio)(h.antRb, -lag * 2.4 - n * 0.016, 0.4, 0.5, dt);
        (0, core_1.springTo)(h.rot, (0, core_1.clamp)(-h.vx * 0.00022, -0.035, 0.035), 0.3, dt);
        (0, core_1.springTo)(h.sx, 1, 0.3, dt);
        (0, core_1.springTo)(h.sy, 1, 0.3, dt);
        // subtle inertia streak while moving (never a combat dash)
        if (sp > 240) {
            this.pushEcho(0.11);
            if ((0, core_1.rnd)() < dt * 5)
                this.fx.dust(h.px + (0, core_1.rrange)(-30, 30), this.ground, (0, core_1.rrange)(-3.4, -2.9), (0, core_1.rrange)(6, 18), 0.5, 10);
        }
        else if (this.echoes.length)
            this.echoes.length = 0;
        // killer-instinct prey read tick
        if (this.kiOn && (0, core_1.rnd)() < dt * 1.6)
            this.convergeTick(this.p.x, this.coreY(), 3, 0.42, 110);
    }
    armTarget(a, sh, el, cu, st, dt, hl = 0.12, ratio = 0.5) {
        (0, core_1.springRatio)(a.sh, sh, ratio, hl, dt);
        (0, core_1.springRatio)(a.el, el, ratio, hl * 1.15, dt);
        (0, core_1.springRatio)(a.cu, cu, ratio, hl * 1.35, dt);
        (0, core_1.springTo)(a.st, st, hl * 1.2, dt);
    }
    integrateHunter(dt) {
        const h = this.h;
        const nx = h.x.x, ny = h.y.x;
        if (dt > 0) {
            h.vx = (nx - h.px) / dt;
            h.vy = (ny - h.py) / dt;
        }
        h.px = nx;
        h.py = ny;
        const P = this.pose;
        P.x = nx;
        P.y = ny;
        P.rot = h.rot.x;
        P.sx = h.sx.x;
        P.sy = h.sy.x;
        P.head = h.head.x;
        P.headY = h.headY.x;
        P.antL = h.antL.x;
        P.antR = h.antR.x;
        P.antLb = h.antLb.x;
        P.antRb = h.antRb.x;
        P.aL = [h.aL.sh.x, h.aL.el.x, h.aL.cu.x, h.aL.st.x];
        P.aR = [h.aR.sh.x, h.aR.el.x, h.aR.cu.x, h.aR.st.x];
        for (const e of this.echoes)
            e.t -= dt;
        while (this.echoes.length && this.echoes[0].t <= 0)
            this.echoes.shift();
    }
    pushEcho(life, k = 1) {
        this.echoes.push({ p: copyPose(this.pose), t: life, k });
        if (this.echoes.length > 16)
            this.echoes.shift();
    }
    convergeTick(x, y, n, life, r) {
        for (let i = 0; i < n; i++) {
            const a = (0, core_1.rad)(-90 + i * (360 / n) + (0, core_1.rrange)(-14, 14));
            this.fx.converge(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, x + Math.cos(a) * 26, y + Math.sin(a) * 20, life, 'rgba(200,255,120,0.85)', 2.6);
        }
    }
    /* ================= A2 — PREDICTIVE POUNCE ================= */
    startA2() {
        if (this.h.mode !== 'idle')
            return;
        this.h.mode = 'a2';
        this.h.t = 0;
        this.h.phase = 'READ';
        this.a2.corrected = false;
        this.a2.turnT = -9;
        this.closed = false;
        this.a2.dist = 0;
        this.echoes.length = 0;
        this.ribL.clear();
        this.ribR.clear();
        this.ribC.clear();
        this.collapse = 0;
    }
    updA2(dt) {
        const h = this.h, A = this.a2;
        h.t += dt;
        const t = h.t;
        const READ = 0.44, COIL = READ + 0.18, HOLD = COIL + 0.045;
        if (!A.dist && t < READ) {
            h.phase = 'READ';
            // absolute stillness + focus
            (0, core_1.springTo)(h.x, h.px, 0.9, dt);
            (0, core_1.springTo)(h.y, this.ground - H_FOOT, 0.3, dt);
            h.eye = (0, core_1.decayTo)(h.eye, 1.25, 0.06, dt);
            const k = (0, core_1.smoothstep)(0, 0.3, t);
            const face = (0, core_1.clamp)((this.p.x - h.px) * 0.0005, -0.2, 0.2);
            (0, core_1.springTo)(h.head, face, 0.07, dt);
            (0, core_1.springTo)(h.headY, -1.5, 0.2, dt);
            // forelegs index outward: ready, widening
            this.armTarget(h.aL, (0, core_1.rad)(3.2) * k, (0, core_1.rad)(-2.4) * k, (0, core_1.rad)(-1.6) * k, 0, dt, 0.13, 0.45);
            this.armTarget(h.aR, (0, core_1.rad)(3.2) * k, (0, core_1.rad)(-2.4) * k, (0, core_1.rad)(-1.6) * k, 0, dt, 0.13, 0.45);
            (0, core_1.springRatio)(h.antL, (0, core_1.rad)(-4) * k, 0.4, 0.2, dt);
            (0, core_1.springRatio)(h.antR, (0, core_1.rad)(4) * k, 0.4, 0.2, dt);
            (0, core_1.springTo)(h.rot, 0, 0.2, dt);
            (0, core_1.springTo)(h.sx, 1, 0.2, dt);
            (0, core_1.springTo)(h.sy, 1, 0.2, dt);
            // predictive read: marks slide inward on the FUTURE point, not the body
            const ip = this.solveIntercept(1250);
            A.ipx = ip.x;
            A.ipy = ip.y;
            if (t > 0.1 && (0, core_1.rnd)() < dt * 11) {
                const a = (0, core_1.rad)(-90 + (0, core_1.rnd)() * 360);
                const r = (0, core_1.rrange)(70, 120);
                this.fx.converge(ip.x + Math.cos(a) * r, ip.y + Math.sin(a) * r * 0.7, ip.x, ip.y, (0, core_1.rrange)(0.28, 0.42), 'rgba(190,255,110,0.7)', 2.2);
            }
            if (t > 0.16 && t < 0.2)
                this.bladeFocusSweep();
            return;
        }
        if (!A.dist && t < COIL) {
            h.phase = 'COIL';
            const k = (0, core_1.smoothstep)(READ, COIL, t);
            const e = (0, core_1.easeInCubic)(k);
            // silhouette transform: open/ready -> compressed/loaded
            this.armTarget(h.aL, (0, core_1.rad)(3.2) + (0, core_1.rad)(14) * e, (0, core_1.rad)(-2.4) + (0, core_1.rad)(36) * e, (0, core_1.rad)(25) * e, -14 * e, dt, 0.055, 0.62);
            this.armTarget(h.aR, (0, core_1.rad)(3.2) + (0, core_1.rad)(14) * e, (0, core_1.rad)(-2.4) + (0, core_1.rad)(36) * e, (0, core_1.rad)(25) * e, -14 * e, dt, 0.055, 0.62);
            (0, core_1.springTo)(h.sx, 1 - 0.06 * e, 0.05, dt);
            (0, core_1.springTo)(h.sy, 1 - 0.10 * e, 0.05, dt);
            (0, core_1.springTo)(h.headY, -1.5 + 9 * e, 0.06, dt);
            const dir = Math.atan2(A.ipy - h.py, A.ipx - h.px);
            (0, core_1.springTo)(h.rot, Math.cos(dir) * 0.055 * e, 0.06, dt);
            (0, core_1.springTo)(h.x, h.px - Math.cos(dir) * 16 * e, 0.09, dt);
            (0, core_1.springRatio)(h.antL, (0, core_1.rad)(-4) + (0, core_1.rad)(16) * e, 0.35, 0.09, dt);
            (0, core_1.springRatio)(h.antR, (0, core_1.rad)(4) - (0, core_1.rad)(16) * e, 0.35, 0.09, dt);
            h.eye = (0, core_1.decayTo)(h.eye, 1.55, 0.05, dt);
            // ENERGY COMPRESSES INTO THE SCYTHE ROOTS
            const rootL = this.jointWorld('L', rig_1.HUNTER.armL.root.x, rig_1.HUNTER.armL.root.y);
            const rootR = this.jointWorld('R', rig_1.HUNTER.armR.root.x, rig_1.HUNTER.armR.root.y);
            if ((0, core_1.rnd)() < dt * 46) {
                const tgt = (0, core_1.rnd)() < 0.5 ? rootL : rootR;
                const a = (0, core_1.rrange)(0, 6.283), r = (0, core_1.rrange)(70, 165);
                this.fx.converge(tgt.x + Math.cos(a) * r, tgt.y + Math.sin(a) * r * 0.8, tgt.x, tgt.y, (0, core_1.rrange)(0.1, 0.19), 'rgba(215,255,130,0.9)', (0, core_1.rrange)(1.6, 3.2));
            }
            if ((0, core_1.rnd)() < dt * 16) {
                const tgt = (0, core_1.rnd)() < 0.5 ? rootL : rootR;
                this.fx.shard(tgt.x + (0, core_1.rrange)(-70, 70), tgt.y + (0, core_1.rrange)(-60, 60), (0, core_1.rrange)(0, 6.28), (0, core_1.rrange)(10, 40), 0.16, (0, core_1.rrange)(4, 8), fx_1.PAL.acid);
            }
            if ((0, core_1.rnd)() < dt * 22)
                this.fx.dust(h.px + (0, core_1.rrange)(-70, 70), this.ground, (0, core_1.rrange)(-3.4, -2.9), (0, core_1.rrange)(4, 16), 0.5, 11);
            this.cam.trauma = Math.min(0.28, this.cam.trauma + dt * 0.75);
            return;
        }
        if (!A.dist && t < HOLD) {
            h.phase = 'COIL';
            return;
        } // the held frame before violence
        if (!A.dist) return;
        // ---- travel ----
        const d = Math.hypot(A.ipx - h.px, A.ipy - h.py);
        if (h.phase !== 'CATCH' && h.phase !== 'RECOVER') {
            h.phase = 'TRAVEL';
            const step = A.speed * dt;
            A.trav += step;
            h.x.x = h.px + Math.cos(A.dir) * step;
            h.y.x = h.py + Math.sin(A.dir) * step;
            h.x.v = 0;
            h.y.v = 0;
            // ONE predictive correction at ~35% travel, hard-capped at 18 degrees
            if (false) {
                A.corrected = true;
                const ip = this.solveIntercept(A.speed);
                let nd = Math.atan2(ip.y - h.y.x, ip.x - h.x.x);
                const delta = (0, core_1.clamp)((0, core_1.angWrap)(nd - A.dir), -(0, core_1.rad)(18), (0, core_1.rad)(18));
                nd = A.dir + delta;
                A.oldDir = A.dir;
                A.dir = nd;
                A.ipx = ip.x;
                A.ipy = ip.y;
                // commit: run out the remaining distance along the NEW heading only
                const proj = (ip.x - h.x.x) * Math.cos(nd) + (ip.y - h.y.x) * Math.sin(nd);
                A.total = A.trav + Math.max(60, proj);
                A.turnX = h.x.x;
                A.turnY = h.y.x;
                A.turnT = this.time;
                this.correctionBurst(delta);
            }
            const tip = this.bladeTips();
            this.ribL.push(tip.l.x, tip.l.y, this.time);
            this.ribR.push(tip.r.x, tip.r.y, this.time);
            this.ribC.push(h.x.x, h.y.x - 30, this.time);
            this.pushEcho(0.21);
            // committed, aggressive travel pose: arms released, trailing
            const bank = Math.sin(A.dir) * 0.16 + Math.cos(A.dir) * 0.06;
            (0, core_1.springTo)(h.rot, bank, 0.05, dt);
            (0, core_1.springTo)(h.sx, 1.1, 0.06, dt);
            (0, core_1.springTo)(h.sy, 0.94, 0.06, dt);
            this.armTarget(h.aL, (0, core_1.rad)(9), (0, core_1.rad)(-12), (0, core_1.rad)(-9), 16, dt, 0.075, 0.42);
            this.armTarget(h.aR, (0, core_1.rad)(9), (0, core_1.rad)(-12), (0, core_1.rad)(-9), 16, dt, 0.075, 0.42);
            (0, core_1.springRatio)(h.antL, (0, core_1.rad)(26), 0.3, 0.1, dt);
            (0, core_1.springRatio)(h.antR, (0, core_1.rad)(-26), 0.3, 0.1, dt);
            (0, core_1.springTo)(h.head, -Math.cos(A.dir) * 0.05, 0.08, dt);
            if ((0, core_1.rnd)() < dt * 60) {
                const a = A.dir + Math.PI + (0, core_1.rrange)(-0.6, 0.6);
                this.fx.spark(h.x.x + (0, core_1.rrange)(-24, 24), h.y.x + (0, core_1.rrange)(-40, 30), a, (0, core_1.rrange)(90, 280), (0, core_1.rrange)(0.1, 0.24), fx_1.PAL.acid, 16);
            }
            if ((0, core_1.rnd)() < dt * 22)
                this.fx.shard(h.x.x + (0, core_1.rrange)(-30, 30), h.y.x + (0, core_1.rrange)(-50, 20), A.dir + Math.PI + (0, core_1.rrange)(-0.8, 0.8), (0, core_1.rrange)(60, 200), 0.3, (0, core_1.rrange)(3, 7));
            if (this.contactPending) {
                h.phase = 'CATCH';
                h.t = 0;
                this.catchImpact();
            }
            return;
        }
        if (h.phase === 'CATCH') {
            const ct = h.t;
            if (ct < 0.07) {
                const brake = 1 - (0, core_1.easeOutQuint)((0, core_1.clamp01)(ct / 0.09));
                h.x.x = h.px + Math.cos(A.dir) * A.speed * brake * dt;
                h.y.x = h.py + Math.sin(A.dir) * A.speed * brake * dt;
                h.x.v = 0;
                h.y.v = 0;
            }
            else {
                // physically hold on to the prey: HUNTER rides it down as it lands
                const side = this.p.x >= h.px ? -1 : 1;
                (0, core_1.springTo)(h.x, this.p.x + side * 34, 0.06, dt);
                (0, core_1.springTo)(h.y, this.coreY() - 76, 0.06, dt);
            }
            if (ct < 0.16) {
                this.pushEcho(0.18);
            }
            const tip = this.bladeTips();
            this.ribL.push(tip.l.x, tip.l.y, this.time);
            this.ribR.push(tip.r.x, tip.r.y, this.time);
            // both forelegs converge and frame the prey
            const k = (0, core_1.smoothstep)(0, 0.085, ct);
            this.armTarget(h.aL, (0, core_1.rad)(-6) + (0, core_1.rad)(28) * k, (0, core_1.rad)(-4) + (0, core_1.rad)(28) * k, (0, core_1.rad)(21) * k, -8 * k, dt, 0.032, 0.52);
            this.armTarget(h.aR, (0, core_1.rad)(-6) + (0, core_1.rad)(28) * k, (0, core_1.rad)(-4) + (0, core_1.rad)(28) * k, (0, core_1.rad)(21) * k, -8 * k, dt, 0.032, 0.52);
            (0, core_1.springTo)(h.sx, 1.02, 0.07, dt);
            (0, core_1.springTo)(h.sy, 0.99, 0.07, dt);
            (0, core_1.springTo)(h.rot, 0, 0.12, dt);
            if (!this.closed && ct > 0.055) {
                this.closed = true;
                this.catchClose();
            }
            if (ct > 0.36) {
                h.phase = 'RECOVER';
                h.t = 0;
                this.collapse = 0.4;
                this.recSet = false;
            }
            return;
        }
        // RECOVER
        const rt = h.t;
        h.phase = 'RECOVER';
        const back = Math.cos(A.dir + Math.PI), backY = Math.sin(A.dir + Math.PI);
        if (!this.recSet) {
            this.recSet = true;
            h.x.v = back * 620;
            h.y.v = backY * 260;
            this.recX = (0, core_1.clamp)(h.px + back * 150, 150, WW - 150);
        }
        (0, core_1.springRatio)(h.x, this.recX, 0.6, 0.3, dt);
        (0, core_1.springRatio)(h.y, this.ground - H_FOOT, 0.62, 0.26, dt);
        this.armTarget(h.aL, 0, 0, 0, 0, dt, 0.16, 0.42);
        this.armTarget(h.aR, 0, 0, 0, 0, dt, 0.16, 0.42);
        (0, core_1.springRatio)(h.antL, 0, 0.35, 0.3, dt);
        (0, core_1.springRatio)(h.antR, 0, 0.35, 0.3, dt);
        (0, core_1.springTo)(h.rot, 0, 0.16, dt);
        (0, core_1.springTo)(h.sx, 1, 0.16, dt);
        (0, core_1.springTo)(h.sy, 1, 0.16, dt);
        (0, core_1.springTo)(h.headY, 0, 0.18, dt);
        h.eye = (0, core_1.decayTo)(h.eye, 1, 0.3, dt);
        if (rt > 0.55) {
            h.mode = 'idle';
            this.a2.dist = 0;
            this.echoes.length = 0;
        }
    }
    solveIntercept(speed) {
        const h = this.h;
        const tx = this.p.x, ty = this.coreY();
        const relx = tx - h.px, rely = ty - h.py;
        const t = (0, core_1.interceptTime)(relx, rely, this.p.vx, 0, speed);
        const tt = t > 0 ? Math.min(t, 1.4) : Math.hypot(relx, rely) / speed;
        const ix0 = tx + this.p.vx * tt;
        // land ON the prey's near shoulder: the scythes converge around its core,
        // the prey stays readable underneath, the pin point is the blade crossing.
        const side = ix0 >= h.px ? -1 : 1;
        return { x: ix0 + side * 34, y: ty - 76, t: tt };
    }
    bladeFocusSweep() {
        for (const side of ['L', 'R']) {
            const A = side === 'L' ? rig_1.HUNTER.armL : rig_1.HUNTER.armR;
            for (let i = 0; i < 5; i++) {
                const u = i / 4;
                const px = (0, core_1.lerp)(A.root.x, A.tip.x, u) + (u > 0.4 ? (side === 'L' ? -40 : 40) * Math.sin(u * 3.1) : 0);
                const py = (0, core_1.lerp)(A.root.y, A.tip.y, u);
                const w = this.jointWorld(side, px, py);
                this.fx.glint(w.x, w.y, 4.5, 0.3 + i * 0.05, 'rgba(230,255,170,0.9)');
            }
        }
    }
    launchBurst(dir) {
        const h = this.h;
        const bx = h.px, by = h.py;
        this.pushEcho(0.34, 1.4);
        for (let i = 0; i < 22; i++) {
            const a = dir + Math.PI + (0, core_1.rrange)(-1.1, 1.1);
            this.fx.spark(bx + (0, core_1.rrange)(-26, 26), by - (0, core_1.rrange)(0, 70), a, (0, core_1.rrange)(240, 700), (0, core_1.rrange)(0.16, 0.38), fx_1.PAL.acid, 26);
        }
        for (let i = 0; i < 10; i++)
            this.fx.shard(bx + (0, core_1.rrange)(-40, 40), by - (0, core_1.rrange)(0, 80), dir + Math.PI + (0, core_1.rrange)(-1, 1), (0, core_1.rrange)(140, 400), (0, core_1.rrange)(0.3, 0.55), (0, core_1.rrange)(4, 10));
        for (let i = 0; i < 12; i++)
            this.fx.dust(bx + (0, core_1.rrange)(-60, 60), this.ground + (0, core_1.rrange)(-6, 4), dir + Math.PI + (0, core_1.rrange)(-0.7, 0.7), (0, core_1.rrange)(60, 200), (0, core_1.rrange)(0.6, 1.0), (0, core_1.rrange)(12, 24));
        // scythe-arc signature: two crossing arcs at the departure point
        this.fx.streak(bx - 34, by - 44, dir + 0.42, 130, 30, 0.26, 'rgba(180,255,90,0.95)');
        this.fx.streak(bx + 34, by - 44, dir - 0.42, 130, 30, 0.26, 'rgba(180,255,90,0.95)');
        this.fx.ring(bx, this.ground, 8, 120, 0.3, 'rgba(180,255,110,0.75)', 3, 0.26);
        this.fx.glint(bx, by - 46, 16, 0.2);
    }
    correctionBurst(delta) {
        const A = this.a2, h = this.h;
        const x = h.x.x, y = h.y.x;
        const s = Math.sign(delta) || 1;
        const perp = A.oldDir + s * Math.PI / 2;
        for (let i = 0; i < 16; i++) {
            this.fx.spark(x + (0, core_1.rrange)(-14, 14), y + (0, core_1.rrange)(-40, 20), perp + (0, core_1.rrange)(-0.5, 0.5), (0, core_1.rrange)(180, 520), (0, core_1.rrange)(0.14, 0.3), fx_1.PAL.pale, 22);
        }
        for (let i = 0; i < 7; i++)
            this.fx.shard(x, y - (0, core_1.rrange)(0, 50), A.oldDir + (0, core_1.rrange)(-0.35, 0.35), (0, core_1.rrange)(200, 430), 0.34, (0, core_1.rrange)(4, 9));
        // compact scythe-edge snap on the turn
        this.fx.streak(x, y - 40, A.dir, 160, 26, 0.2, 'rgba(230,255,180,0.95)');
        this.fx.streak(x, y - 40, A.oldDir + Math.PI, 120, 18, 0.18, 'rgba(150,240,70,0.8)');
        this.fx.ring(x, y - 40, 6, 74, 0.2, 'rgba(235,255,190,0.85)', 2.6, 0.35, A.oldDir);
        this.fx.glint(x, y - 40, 13, 0.16);
        // the body physically compensates: hard bank + outer brace / inner fold
        h.rot.v += s * 5.4;
        const outer = s > 0 ? h.aR : h.aL, inner = s > 0 ? h.aL : h.aR;
        outer.sh.v += -13;
        outer.el.v += -16;
        outer.cu.v += -10;
        inner.sh.v += 15;
        inner.el.v += 18;
        inner.cu.v += 12;
        h.antL.v += -s * 9;
        h.antR.v += -s * 9;
        this.cam.trauma = Math.min(1, this.cam.trauma + 0.3);
    }
    /** arrival: the body physically lands on the prey */
    catchImpact() {
        const h = this.h, p = this.p;
        const ax = h.px, ay = h.py + 40;
        this.cam.trauma = Math.min(1, this.cam.trauma + 0.42);
        this.dilate = Math.max(this.dilate, 0.085);
        const back = this.a2.dir + Math.PI;
        for (let i = 0; i < 16; i++)
            this.fx.spark(ax + (0, core_1.rrange)(-30, 30), ay + (0, core_1.rrange)(-30, 30), back + (0, core_1.rrange)(-1.2, 1.2), (0, core_1.rrange)(140, 420), (0, core_1.rrange)(0.14, 0.3), fx_1.PAL.pale, 20);
        for (let i = 0; i < 9; i++)
            this.fx.shard(ax + (0, core_1.rrange)(-40, 40), ay + (0, core_1.rrange)(-30, 30), back + (0, core_1.rrange)(-1, 1), (0, core_1.rrange)(120, 320), (0, core_1.rrange)(0.35, 0.6), (0, core_1.rrange)(4, 9), '#9fd9f0');
        this.fx.ring(ax, ay, 8, 86, 0.2, 'rgba(225,255,170,0.85)', 3.2, 0.72, this.a2.dir);
        // prey material response — no damage nuke, a predator finding the opening
        p.hit = 1;
        p.kx.v += (p.x > h.px ? 1 : -1) * 190;
        p.sq.x = 0.92;
        p.sq.v = 0.5;
        p.freeze = 0.9;
        p.vx *= 0.15;
        if (p.hy < 0) {
            p.hvy = Math.max(p.hvy, 520);
            p.air = true;
        }
        this.cam.z.v += 0.8;
    }
    /** 0.055s later: the two scythes actually meet — this is the capture beat */
    catchClose() {
        const p = this.p;
        const tips = this.bladeTips();
        const mx = (tips.l.x + tips.r.x) / 2, my = (tips.l.y + tips.r.y) / 2;
        this.cam.trauma = Math.min(1, this.cam.trauma + 0.4);
        this.dilate = Math.max(this.dilate, 0.07);
        for (const t of [tips.l, tips.r]) {
            for (let i = 0; i < 13; i++) {
                const a = Math.atan2(my - t.y, mx - t.x) + Math.PI + (0, core_1.rrange)(-1.1, 1.1);
                this.fx.spark(t.x, t.y, a, (0, core_1.rrange)(120, 360), (0, core_1.rrange)(0.14, 0.3), fx_1.PAL.pale, 18);
            }
            this.fx.glint(t.x, t.y, 12, 0.22);
            this.fx.ring(t.x, t.y, 4, 42, 0.2, 'rgba(240,255,200,0.9)', 2.4, 0.85);
        }
        // inward impact lines converging on the vulnerable point
        const cx = p.x, cy = this.coreY();
        for (let i = 0; i < 11; i++) {
            const a = (0, core_1.rad)(i * 33 + (0, core_1.rrange)(-10, 10));
            this.fx.converge(cx + Math.cos(a) * 165, cy + Math.sin(a) * 130, cx + Math.cos(a) * 20, cy + Math.sin(a) * 16, (0, core_1.rrange)(0.14, 0.26), 'rgba(235,255,190,0.95)', 3.2);
        }
        for (let i = 0; i < 12; i++)
            this.fx.shard(cx + (0, core_1.rrange)(-90, 90), cy + (0, core_1.rrange)(-70, 70), (0, core_1.rrange)(0, 6.28), (0, core_1.rrange)(80, 250), (0, core_1.rrange)(0.4, 0.7), (0, core_1.rrange)(4, 9), '#9fd9f0');
        this.fx.ring(mx, my, 8, 96, 0.26, 'rgba(225,255,170,0.9)', 3.4, 0.6);
        this.fx.glint(cx, cy, 16, 0.26);
        p.hit = 1;
        p.sq.x = 0.9;
        p.sq.v = 0.7;
        p.weak = 8.6;
        p.weakPulse = 1.2;
        for (const m of this.marks) {
            m.r.x = 2.6;
            m.r.v = -4.5;
            m.fl = 1;
        }
    }
    /* ================= A1 — SNARE TRAP ================= */
    startA1() {
        if (this.h.mode !== 'idle')
            return;
        this.h.mode = 'a1';
        this.h.t = 0;
        this.h.phase = 'DEPLOY';
        this.tr.on = false;
        this.tr.captured = false;
    }
    updA1(dt) {
        const h = this.h;
        h.t += dt;
        const t = h.t;
        const OPEN = 0.16, PLANT = 0.30, REC = 0.78;
        if (t < OPEN) {
            h.phase = 'DEPLOY';
            const k = (0, core_1.smoothstep)(0, OPEN, t);
            this.armTarget(h.aL, (0, core_1.rad)(-22) * k, (0, core_1.rad)(-16) * k, (0, core_1.rad)(-8) * k, 0, dt, 0.06, 0.5);
            this.armTarget(h.aR, (0, core_1.rad)(-22) * k, (0, core_1.rad)(-16) * k, (0, core_1.rad)(-8) * k, 0, dt, 0.06, 0.5);
            (0, core_1.springTo)(h.sy, 1 + 0.05 * k, 0.07, dt);
            (0, core_1.springTo)(h.headY, -5 * k, 0.08, dt);
            h.eye = (0, core_1.decayTo)(h.eye, 1.3, 0.1, dt);
            return;
        }
        if (t < PLANT) {
            h.phase = 'DEPLOY';
            const k = (0, core_1.smoothstep)(OPEN, PLANT, t);
            const e = (0, core_1.easeInCubic)(k);
            this.armTarget(h.aL, (0, core_1.rad)(-22) + (0, core_1.rad)(46) * e, (0, core_1.rad)(-16) + (0, core_1.rad)(40) * e, (0, core_1.rad)(30) * e, 18 * e, dt, 0.028, 0.6);
            this.armTarget(h.aR, (0, core_1.rad)(-22) + (0, core_1.rad)(46) * e, (0, core_1.rad)(-16) + (0, core_1.rad)(40) * e, (0, core_1.rad)(30) * e, 18 * e, dt, 0.028, 0.6);
            (0, core_1.springTo)(h.sy, 1 - 0.1 * e, 0.04, dt);
            (0, core_1.springTo)(h.sx, 1 + 0.06 * e, 0.04, dt);
            (0, core_1.springTo)(h.headY, 10 * e, 0.05, dt);
            if (!this.tr.on && k > 0.92)
                this.plantTrap();
            return;
        }
        if (!this.tr.on) this.plantTrap();
        h.phase = 'RECOVER';
        const k = (0, core_1.smoothstep)(PLANT, REC, t);
        this.armTarget(h.aL, 0, 0, 0, 0, dt, 0.16, 0.4);
        this.armTarget(h.aR, 0, 0, 0, 0, dt, 0.16, 0.4);
        (0, core_1.springTo)(h.sy, 1, 0.12, dt);
        (0, core_1.springTo)(h.sx, 1, 0.12, dt);
        (0, core_1.springTo)(h.headY, 0, 0.16, dt);
        (0, core_1.springRatio)(h.x, h.px - 55, 0.6, 0.34, dt);
        if (k >= 1) {
            h.mode = 'idle';
        }
    }
    plantTrap() {
        const h = this.h;
        const tx = h.px;
        this.tr.on = true;
        this.tr.x = tx;
        this.tr.y = this.ground - 62;
        this.tr.phase = 'unfold';
        this.tr.t = 0;
        this.tr.captured = false;
        this.tr.sweep = -1;
        this.tr.sweepAmp = 0;
        this.tr.sweepDir = 1;
        this.tr.edge = 0;
        this.tr.scale.x = 0.42;
        this.tr.scale.v = 2.2;
        this.tr.lift.x = -26;
        this.tr.lift.v = 320;
        this.tr.arms.forEach((a, i) => { a.rot.x = (0, core_1.rad)(34); a.rot.v = 0; a.cu.x = (0, core_1.rad)(58); a.cu.v = 0; a.pull.x = 30; a.sq.x = 0.28; a.sq.v = 0; a.gem = 0; void i; });
        // floor contact response — physical, not magical
        this.fx.ring(tx, this.ground, 6, 128, 0.34, 'rgba(190,255,110,0.8)', 3, 0.24);
        for (let i = 0; i < 18; i++)
            this.fx.dust(tx + (0, core_1.rrange)(-40, 40), this.ground + (0, core_1.rrange)(-4, 4), (0, core_1.rrange)(-3.5, -2.8) + (0, core_1.rrange)(-0.6, 0.6), (0, core_1.rrange)(60, 210), (0, core_1.rrange)(0.5, 0.95), (0, core_1.rrange)(10, 22));
        for (let i = 0; i < 14; i++)
            this.fx.spark(tx + (0, core_1.rrange)(-24, 24), this.ground - (0, core_1.rrange)(0, 12), (0, core_1.rrange)(-2.9, -0.3), (0, core_1.rrange)(120, 330), (0, core_1.rrange)(0.16, 0.3), fx_1.PAL.acid, 16);
        for (let i = 0; i < 5; i++)
            this.fx.crack(tx + (0, core_1.rrange)(-40, 40), this.ground + (0, core_1.rrange)(-2, 6), (0, core_1.rrange)(0, 6.28), (0, core_1.rrange)(40, 88), 2.6);
        this.fx.streak(tx - 60, this.ground - 26, (0, core_1.rad)(18), 150, 26, 0.22, 'rgba(200,255,120,0.9)');
        this.fx.streak(tx + 60, this.ground - 26, (0, core_1.rad)(162), 150, 26, 0.22, 'rgba(200,255,120,0.9)');
        this.cam.trauma = Math.min(1, this.cam.trauma + 0.4);
        this.dilate = Math.max(this.dilate, 0.035);
        this.timeScale = Math.min(this.timeScale, 0.22);
    }



    /* ================= KILLER INSTINCT — dodge ================= */





    updateAura(dt) {
        if (!this.auraReady) {
            this.aura = copyPose(this.pose);
            this.auraReady = true;
        }
        const src = this.pose, dst = this.aura;
        const tau = this.h.mode === 'dodge' ? 0.06 : this.h.mode === 'a2' ? 0.09 : this.h.mode === 'a1' ? 0.11 : 0.16;
        const k = 1 - Math.exp(-dt / Math.max(0.001, tau));
        const mix = (a, b) => a + (b - a) * k;
        dst.x = mix(dst.x, src.x);
        dst.y = mix(dst.y, src.y);
        dst.rot = mix(dst.rot, src.rot);
        dst.sx = mix(dst.sx, src.sx);
        dst.sy = mix(dst.sy, src.sy);
        dst.head = mix(dst.head, src.head);
        dst.headY = mix(dst.headY, src.headY);
        dst.antL = mix(dst.antL, src.antL);
        dst.antR = mix(dst.antR, src.antR);
        dst.antLb = mix(dst.antLb, src.antLb);
        dst.antRb = mix(dst.antRb, src.antRb);
        for (let i = 0; i < 4; i++) {
            dst.aL[i] = mix(dst.aL[i], src.aL[i]);
            dst.aR[i] = mix(dst.aR[i], src.aR[i]);
        }
        const target = this.h.mode === 'dodge' ? 0.3 : this.h.mode === 'a2' ? 0.24 : this.h.mode === 'a1' ? 0.2 : 0.14;
        (0, core_1.springTo)(this.auraAlpha, target, 0.18, dt);
    }
    /* ---------------- camera ---------------- */

    /* ---------------- joint helpers ---------------- */
    hunterRootXf(p, out = new rig_1.Xf()) {
        return out.identity().compose(p.x, p.y, p.rot, H_SCALE * p.sx, H_SCALE * p.sy, rig_1.HUNTER.origin.x, rig_1.HUNTER.origin.y);
    }
    armXf(p, side, out = new rig_1.Xf()) {
        const A = side === 'L' ? rig_1.HUNTER.armL : rig_1.HUNTER.armR;
        const sgn = side === 'L' ? -1 : 1;
        const a = side === 'L' ? p.aL : p.aR;
        this.hunterRootXf(p, out);
        return out.compose(A.root.x, A.root.y, sgn * a[0], 1, 1, A.root.x, A.root.y);
    }
    armSkin(p, side) {
        const A = side === 'L' ? rig_1.HUNTER.armL : rig_1.HUNTER.armR;
        const sgn = side === 'L' ? -1 : 1;
        const a = side === 'L' ? p.aL : p.aR;
        return {
            ax: A.root.x, ay: A.root.y, bx: A.tip.x, by: A.tip.y,
            joints: [
                { x: A.elbow.x, y: A.elbow.y, u: 0.41, ang: sgn * a[1], blend: 0.19 },
                { x: A.curl.x, y: A.curl.y, u: 0.78, ang: sgn * a[2], blend: 0.16 },
            ],
            stretch: a[3], bands: 11,
        };
    }
    jointWorld(side, sx, sy) {
        const xf = this.armXf(this.pose, side, _t1);
        return (0, rig_1.skinPoint)(xf, this.armSkin(this.pose, side), sx, sy);
    }
    bladeTips() {
        return { l: this.jointWorld('L', rig_1.HUNTER.armL.tip.x, rig_1.HUNTER.armL.tip.y), r: this.jointWorld('R', rig_1.HUNTER.armR.tip.x, rig_1.HUNTER.armR.tip.y) };
    }




    /* ================= render ================= */



    drawEchoes(ctx, V) {
        if (!this.echoes.length)
            return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const n = this.echoes.length;
        for (let i = 0; i < n; i++) {
            const e = this.echoes[i];
            const age = (0, core_1.clamp01)(e.t / 0.14);
            const a = age * age * 0.46 * e.k * (0.28 + 0.72 * (i / n));
            if (a < 0.014)
                continue;
            // layer 1: luminous energy silhouette (every sample, arms+head only)
            ctx.globalAlpha = a * 0.6;
            this.drawHunterParts(ctx, V, e.p, true, true);
            // Full source-art echoes are intentionally disabled during dodge: the glow-history
            // still shows the truthful path without re-rendering large sprites several times per frame.
            if (this.h.mode !== 'dodge' && i >= n - 2) {
                ctx.globalAlpha = a * 0.95;
                this.drawHunterParts(ctx, V, e.p, false, false);
            }
        }
        ctx.restore();
        // Owner playtest: remove the intermittent directional glow smear that
        // read as an extra bright layer under/behind Hunter. The accepted
        // high-speed echo history above remains the sole movement afterimage.
    }
    drawAura(ctx, V) {
        if (!this.auraReady)
            return;
        const a = (0, core_1.clamp01)(this.auraAlpha.x) * (0.94 + 0.06 * Math.sin(this.time * 2.4));
        if (a < 0.03)
            return;
        const p = copyPose(this.aura);
        p.y += 1.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.5;
        this.drawHunterParts(ctx, V, p, true, true);
        ctx.restore();
    }
    drawHunterParts(ctx, V, p, glowOnly, skipAnt = false) {
        const A = glowOnly ? this.glow : this.art;
        const root = this.hunterRootXf(p, _t2);
        // antennae (behind)
        if (!skipAnt)
            for (const side of ['L', 'R']) {
                const D = side === 'L' ? rig_1.HUNTER.antL : rig_1.HUNTER.antR;
                const rot = side === 'L' ? p.antL : p.antR;
                const xf = _t3.copy(root).compose(D.root.x, D.root.y, rot, 1, 1, D.root.x, D.root.y);
                (0, rig_1.drawRigid)(ctx, A[side === 'L' ? 'hunter_antL' : 'hunter_antR'], side === 'L' ? rig_1.HP.antL : rig_1.HP.antR, xf);
            }
        for (const side of ['L', 'R']) {
            const xf = this.armXf(p, side, _t3);
            (0, rig_1.drawRigid)(ctx, A[side === 'L' ? 'hunter_armL' : 'hunter_armR'], side === 'L' ? rig_1.HP.armL : rig_1.HP.armR, xf);
        }
        const hx = _t3.copy(root).compose(rig_1.HUNTER.headPivot.x, rig_1.HUNTER.headPivot.y + p.headY, p.head, 1, 1, rig_1.HUNTER.headPivot.x, rig_1.HUNTER.headPivot.y);
        (0, rig_1.drawRigid)(ctx, A.hunter_head, rig_1.HP.head, hx);
        void V;
    }
    drawHunter(ctx, V, p, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        const root = this.hunterRootXf(p, _t2);
        // --- antennae: skinned whip
        for (const side of ['L', 'R']) {
            const D = side === 'L' ? rig_1.HUNTER.antL : rig_1.HUNTER.antR;
            const rot = side === 'L' ? p.antL : p.antR;
            const bend = side === 'L' ? p.antLb : p.antRb;
            const xf = _t3.copy(root).compose(D.root.x, D.root.y, rot, 1, 1, D.root.x, D.root.y);
            const skin = {
                ax: D.root.x, ay: D.root.y, bx: D.tip.x, by: D.tip.y,
                joints: [{ x: (0, core_1.lerp)(D.root.x, D.tip.x, 0.42), y: (0, core_1.lerp)(D.root.y, D.tip.y, 0.42), u: 0.42, ang: bend, blend: 0.3 }],
                bands: 5,
            };
            (0, rig_1.drawSkinned)(ctx, this.art[side === 'L' ? 'hunter_antL' : 'hunter_antR'], side === 'L' ? rig_1.HP.antL : rig_1.HP.antR, xf, V, skin);
        }
        // --- forelegs: the visual protagonist, 2-joint skinned bend
        for (const side of ['L', 'R']) {
            const xf = this.armXf(p, side, _t3);
            const skin = this.armSkin(p, side);
            const img = this.art[side === 'L' ? 'hunter_armL' : 'hunter_armR'];
            const def = side === 'L' ? rig_1.HP.armL : rig_1.HP.armR;
            (0, rig_1.drawSkinned)(ctx, img, def, xf, V, skin);
        }
        // --- head
        const hx = _t3.copy(root).compose(rig_1.HUNTER.headPivot.x, rig_1.HUNTER.headPivot.y + p.headY, p.head, 1, 1, rig_1.HUNTER.headPivot.x, rig_1.HUNTER.headPivot.y);
        (0, rig_1.drawRigid)(ctx, this.art.hunter_head, rig_1.HP.head, hx);
        // --- eye focus + stored-violence rim
        const eye = this.h.eye;
        if (eye > 0.05) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const sx of [-25, 25]) {
                const ex = hx.px(rig_1.HUNTER.headPivot.x + sx, 278), ey = hx.py(rig_1.HUNTER.headPivot.x + sx, 278);
                const r = (10 + eye * 9) * H_SCALE * 3.2;
                const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
                g.addColorStop(0, `rgba(250,255,220,${0.5 * (0, core_1.clamp01)(eye)})`);
                g.addColorStop(0.4, `rgba(200,255,110,${0.3 * (0, core_1.clamp01)(eye)})`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(ex, ey, r, 0, 6.2832);
                ctx.fill();
            }
            ctx.restore();
        }
        // --- restrained living-material shimmer travelling a blade
        if (this.h.shimmer > 0) {
            const u = (0, core_1.clamp01)(1 - this.h.shimmer / 0.75);
            const side = (Math.floor(this.time * 0.37) % 2 === 0) ? 'L' : 'R';
            const A2 = side === 'L' ? rig_1.HUNTER.armL : rig_1.HUNTER.armR;
            const px = (0, core_1.lerp)(A2.root.x, A2.tip.x, u), py = (0, core_1.lerp)(A2.root.y, A2.tip.y, u);
            const w = this.jointWorld(side, px, py);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.sin((0, core_1.clamp01)(u) * Math.PI) * 0.5;
            const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, 34);
            g.addColorStop(0, 'rgba(230,255,170,0.9)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(w.x, w.y, 34, 0, 6.2832);
            ctx.fill();
            ctx.restore();
        }
        // --- coil energy: rim load at the scythe roots
        const load = (0, core_1.clamp01)((this.h.mode === 'a2' && this.h.phase === 'COIL') ? (this.h.t - 0.44) / 0.2 : 0);
        if (load > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const side of ['L', 'R']) {
                const A3 = side === 'L' ? rig_1.HUNTER.armL : rig_1.HUNTER.armR;
                const w = this.jointWorld(side, A3.root.x, A3.root.y);
                const r = 26 + load * 46;
                const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
                g.addColorStop(0, `rgba(240,255,190,${0.55 * load})`);
                g.addColorStop(0.45, `rgba(170,255,70,${0.3 * load})`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(w.x, w.y, r, 0, 6.2832);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.restore();
    }

    /** WEAK — three-point convergence bound to prey space */
    drawWeak(ctx) {
        const p = this.p;
        const cx = p.x + p.kx.x, cy = this.coreY() + p.ky.x;
        const fade = (0, core_1.clamp01)(p.weak / 0.8) * (0, core_1.clamp01)((8.6 - p.weak) / 0.25);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const m of this.marks) {
            const r = 118 * m.r.x;
            const a = m.a + Math.sin(this.time * 0.7) * 0.03;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.82;
            const pulse = 0.55 + 0.25 * Math.sin(this.time * 3.4 - m.a) + m.fl * 0.9;
            ctx.globalAlpha = fade * (0, core_1.clamp01)(pulse);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a + Math.PI);
            const sc = 1 + m.fl * 0.45;
            ctx.scale(sc, sc);
            // sharp inward chevron
            ctx.fillStyle = m.fl > 0.2 ? 'rgba(250,255,225,0.95)' : 'rgba(196,255,96,0.9)';
            ctx.beginPath();
            ctx.moveTo(-26, 0);
            ctx.lineTo(4, -16);
            ctx.lineTo(-6, 0);
            ctx.lineTo(4, 16);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = fade * 0.4 * (0, core_1.clamp01)(pulse);
            ctx.beginPath();
            ctx.moveTo(-46, 0);
            ctx.lineTo(-24, -9);
            ctx.lineTo(-28, 0);
            ctx.lineTo(-24, 9);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        // local material stress at the vulnerable point
        ctx.globalAlpha = fade * (0.10 + 0.05 * Math.sin(this.time * 4));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 78);
        g.addColorStop(0, 'rgba(200,255,120,0.8)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 78, 0, 6.2832);
        ctx.fill();
        ctx.restore();
        if ((0, core_1.rnd)() < 0.02 * fade)
            this.convergeTick(cx, cy, 1, 0.4, 96);
    }




}
exports.Stage = Stage;
const _t1 = new rig_1.Xf(), _t2 = new rig_1.Xf(), _t3 = new rig_1.Xf();

});

const { Stage } = __require('hunter/sim');

// ============================================================================
// FINAL V7 PATCH — LITERAL ROOT TRAP PORT + SAFE PASSIVE
// The previous passes only imitated the ROOT trap. This patch actually uses
// the ROOT trap's segmented source-art parts and its two-joint root/blade pose law.
// ============================================================================
const ROOT_TRAP_ART = {"core": "/assets/hero-rework/hunter-v10/clean/part-10.png", "root0": "/assets/hero-rework/hunter-v10/clean/part-11.png", "root1": "/assets/hero-rework/hunter-v10/clean/part-12.png", "root2": "/assets/hero-rework/hunter-v10/clean/part-13.png", "blade0": "/assets/hero-rework/hunter-v10/clean/part-14.png", "blade1": "/assets/hero-rework/hunter-v10/clean/part-15.png", "blade2": "/assets/hero-rework/hunter-v10/clean/part-16.png"};
const RT_DEF = {
  center:{x:704,y:410},
  arms:[
    {core:{x:704,y:282},mid:{x:705,y:118},root:'root0',blade:'blade0'},
    {core:{x:799,y:468},mid:{x:949,y:559},root:'root1',blade:'blade1'},
    {core:{x:608,y:468},mid:{x:459,y:558},root:'root2',blade:'blade2'}
  ],
  pos:{core:[579,245],root0:[543,80],root1:[755,310],root2:[420,420],blade0:[428,0],blade1:[813,261],blade2:[301,333]}
};
const RT_POSE={
  compact:{root:-1.05,blade:1.90,rootS:.50,coreS:.78},
  open:{root:0,blade:0,rootS:1,coreS:1},
  tense:{root:-.07,blade:-.14,rootS:1.02,coreS:1.03},
  closed:{root:.30,blade:.82,rootS:.97,coreS:.97},
  burst:{root:-.16,blade:-.42,rootS:1.03,coreS:1.02}
};
function rtClamp(v,a=0,b=1){return Math.max(a,Math.min(b,v));}
function rtLerp(a,b,t){return a+(b-a)*t;}
class RT_SO{
  constructor(x0,f=3,z=1,r=0){this.y=x0;this.yd=0;this.xp=x0;this.set(f,z,r);}
  set(f,z,r=0){this.f=f;this.z=z;this.r=r;this.k1=z/(Math.PI*f);this.k2=1/((2*Math.PI*f)*(2*Math.PI*f));this.k3=(r*z)/(2*Math.PI*f);return this;}
  update(T,x){if(T<=0)return this.y;const xd=(x-this.xp)/T;this.xp=x;const k2s=Math.max(this.k2,(T*T)/2+(T*this.k1)/2,T*this.k1);this.y+=T*this.yd;this.yd+=(T*(x+this.k3*xd-this.y-this.k1*this.yd))/k2s;return this.y;}
  snap(x){this.y=x;this.xp=x;this.yd=0;}
  kick(v){this.yd+=v;}
}
function rtCanvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return c;}
function rtDeriveLayers(im){
 cacheStats.derivations++;
  const w=im.width,h=im.height,N=w*h,src=rtCanvas(w,h),sx=src.getContext('2d',{willReadFrequently:true});sx.drawImage(im,0,0);
  const data=sx.getImageData(0,0,w,h).data, alpha=new Uint8Array(N);
  for(let i=0;i<N;i++)alpha[i]=data[i*4+3];
  const ld=new Uint8Array(N).fill(9);for(let i=0;i<N;i++)if(alpha[i]<128)ld[i]=0;
  for(let it=0;it<4;it++)for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(!ld[i])continue;const m=Math.min(ld[i-1],ld[i+1],ld[i-w],ld[i+w])+1;if(m<ld[i])ld[i]=m;}
  const dil=new Uint8Array(N);for(let i=0;i<N;i++)if(alpha[i]>100)dil[i]=1;
  for(let it=0;it<1;it++){const nd=dil.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(dil[i])continue;if(dil[i-1]||dil[i+1]||dil[i-w]||dil[i+w])nd[i]=1;}dil.set(nd);}
  const edge=rtCanvas(w,h),glow=rtCanvas(w,h),shadow=rtCanvas(w,h),ed=new ImageData(w,h),gd=new ImageData(w,h),hd=new ImageData(w,h);
  for(let i=0;i<N;i++){
    const o=i*4,a=alpha[i],r=data[o],g=data[o+1],b=data[o+2];
    if(dil[i]){hd.data[o]=5;hd.data[o+1]=9;hd.data[o+2]=4;hd.data[o+3]=150;}
    if(!a)continue;
    const ev=ld[i]<=4?1-(ld[i]-1)/4:0;
    if(ev>0){ed.data[o]=205;ed.data[o+1]=255;ed.data[o+2]=130;ed.data[o+3]=a*Math.min(1,ev);}
    const L=r*.3+g*.59+b*.11,gl=Math.min(1,Math.max(0,(L-95)/140));
    if(gl>0){gd.data[o]=Math.min(255,r*1.4+40);gd.data[o+1]=Math.min(255,g*1.3+40);gd.data[o+2]=Math.min(255,b*1.1+20);gd.data[o+3]=a*gl;}
  }
  edge.getContext('2d').putImageData(ed,0,0);glow.getContext('2d').putImageData(gd,0,0);shadow.getContext('2d').putImageData(hd,0,0);
  return {color:im,edge,glow,shadow,scratch:rtCanvas(w,h),w,h};
}
function rtLoadImages(){
 if(rootPromise)return rootPromise;
 cacheStats.rootLoads++;
  const out={};
  return rootPromise=Promise.all(Object.entries(ROOT_TRAP_ART).map(([k,src])=>new Promise(res=>{
    const im=new Image();im.onload=()=>{out[k]=rtDeriveLayers(im);res();};im.onerror=()=>{throw Error("Hunter V10 art failed: "+src);};im.src=src;
  }))).then(()=>out);
}
function rtFreshArm(){return {root:new RT_SO(0,4,.6),blade:new RT_SO(0,4,.6),rootS:new RT_SO(1,4,.7),target:{...RT_POSE.compact}};}
function rtEnsure(st){
  if(st._rt)return st._rt;
  const R=st._rt={visible:false,alpha:1,phase:'off',closed:false,coreS:new RT_SO(.78,4,.5),coreTarget:.78,coreDy:new RT_SO(0,5,.4),
    arms:[rtFreshArm(),rtFreshArm(),rtFreshArm()],jitter:[0,0,0],boltLight:[0,0,0,0,0,0],slot:0,slotTarget:.3,tension:0,
    sweepT:-1,sweepDir:1,sweepAmt:1,edge:0,armedT:0,nextPull:.35,releaseBurst:false,lockLit:[false,false,false]};
  rtSnapPose(R,RT_POSE.compact);return R;
}
function rtSnapPose(R,p){for(const a of R.arms){a.target={...p};a.root.snap(p.root);a.blade.snap(p.blade);a.rootS.snap(p.rootS);}R.coreS.snap(p.coreS);R.coreTarget=p.coreS;}
function rtSetPose(R,p,k){if(k==null){for(const a of R.arms)a.target={...p};R.coreTarget=p.coreS;}else R.arms[k].target={...p};}
function rtTune(R,k,part,f,z,r=0){R.arms[k][part].set(f,z,r);}
function rtTuneAll(R,f,z,r=0,bladeLag=1.15){for(let k=0;k<3;k++){R.arms[k].root.set(f,z,r);R.arms[k].blade.set(f*bladeLag,z*.92,r);R.arms[k].rootS.set(f,z,r);}}
function rtPhaseEnter(st,R,phase){
  R.phase=phase;
  if(phase==='unfold'){
    rtSnapPose(R,RT_POSE.compact);R.coreS.snap(.78);R.coreTarget=.78;R.coreDy.snap(0);R.coreDy.kick(90);R.alpha=1;R.closed=false;R.edge=0;R.tension=0;R.slot=.2;R.slotTarget=.2;R.sweepT=-1;R.boltLight=[1,1,1,0,0,0];R.lockLit=[false,false,false];
  }else if(phase==='armed'){
    rtSetPose(R,RT_POSE.open);R.coreTarget=1;R.slotTarget=0;R.edge=0;R.tension=0;R.sweepAmt=0;R.sweepDir=1;R.sweepT=-1;R.armedT=0;
  }else if(phase==='tension'){
    rtSetPose(R,RT_POSE.tense);rtTuneAll(R,15,.7,0);R.slotTarget=1.2;R.boltLight=R.boltLight.map(()=>.7);R.sweepT=-1;
  }else if(phase==='snap'){
    rtTuneAll(R,11,.46,1.8,1.3);R.sweepT=-1;
  }else if(phase==='pin'){
    rtSetPose(R,RT_POSE.closed);R.arms[0].target={...RT_POSE.closed,blade:.60,root:.24};rtTuneAll(R,6,.55,0);R.closed=true;R.boltLight=R.boltLight.map(()=>1);R.slotTarget=.9;R.edge=.35;R.tension=1;R.sweepT=-1;R.nextPull=.35;
  }else if(phase==='release'){
    R.slotTarget=0;R.boltLight=R.boltLight.map(()=>1);R.releaseBurst=false;R.sweepT=-1;
  }
}
function rtUpdate(st,dt){
  const R=rtEnsure(st),T=st.tr;R.visible=!!T.on;
  if(!T.on){R.phase='off';R.sweepT=-1;R.closed=false;return;}
  const phase=T.phase||'unfold';if(R.phase!==phase)rtPhaseEnter(st,R,phase);
  // ROOT material decay / interpolation law.
  R.boltLight=R.boltLight.map(v=>v*Math.exp(-dt*3.5));
  R.slot=rtLerp(R.slot,R.slotTarget,1-Math.exp(-dt*10));
  for(let k=0;k<3;k++)R.jitter[k]*=Math.exp(-dt*18);
  if(phase==='unfold'){
    R.coreTarget=T.t<.07?.78:1;
    for(let k=0;k<3;k++){
      const d=k*.055,a=R.arms[k];
      if(T.t>=d){rtTune(R,k,'root',4.6,.42,0);rtTune(R,k,'rootS',4.6,.5,0);a.target={...a.target,root:0,rootS:1};}
      if(T.t>=.07+d){rtTune(R,k,'blade',5.4,.4,0);a.target={...RT_POSE.open};}
      if(T.t>=.37+d&&!R.lockLit[k]){R.lockLit[k]=true;R.boltLight[3+k]=1;R.jitter[k]=.03;}
    }
  }else if(phase==='armed'){
    R.armedT+=dt;R.slotTarget=0;R.edge=0;R.tension=0;R.sweepT=-1;
  }else if(phase==='tension'){
    R.slotTarget=1.2;
  }else if(phase==='snap'){
    if(T.t<.06)rtSetPose(R,RT_POSE.tense);else{rtSetPose(R,RT_POSE.closed);R.arms[0].target={...RT_POSE.closed,blade:.60,root:.24};}
  }else if(phase==='pin'){
    R.tension=rtLerp(R.tension,.5,1-Math.exp(-dt*2));R.edge=rtLerp(R.edge,.16,1-Math.exp(-dt*2));
    if(T.t>=R.nextPull){R.nextPull+=.45+visualRandom()*.25;for(let k=0;k<3;k++)R.jitter[k]=(.03+visualRandom()*.03)*(k%2?1:-1);R.tension=1;R.sweepT=0;R.sweepDir=1;R.sweepAmt=.8;const k=(visualRandom()*3)|0;R.boltLight[3+k]=.9;}
    if(R.sweepT>=0){R.sweepT+=dt/.4;if(R.sweepT>1)R.sweepT=-1;}
  }else if(phase==='release'){
    if(T.t<.09){rtSetPose(R,RT_POSE.closed);R.arms[0].target={...RT_POSE.closed,blade:.60,root:.24};}
    else if(T.t<.49){if(!R.releaseBurst){R.releaseBurst=true;rtTuneAll(R,7.5,.34,1.4,1.2);R.edge=.8;R.tension=0;R.sweepT=0;R.sweepDir=-1;R.sweepAmt=1;}rtSetPose(R,RT_POSE.burst);if(R.sweepT>=0){R.sweepT=(T.t-.09)/.4*1.6;if(R.sweepT>1)R.sweepT=-1;}R.edge=rtLerp(R.edge,0,1-Math.exp(-dt*6));}
    else{rtTuneAll(R,5,.8,0);rtSetPose(R,RT_POSE.compact);R.closed=false;R.edge=rtLerp(R.edge,0,1-Math.exp(-dt*6));R.alpha=T.t>.67?rtClamp(1-(T.t-.67)/.25):1;R.coreTarget=.78-Math.max(0,T.t-.67)/.25*.3;}
  }
  for(let k=0;k<3;k++){const a=R.arms[k],q=a.target;a.root.update(dt,q.root+R.jitter[k]);a.blade.update(dt,q.blade+R.jitter[k]*1.6);a.rootS.update(dt,q.rootS);}
  R.coreS.update(dt,R.coreTarget);R.coreDy.update(dt,0);
}
function rtScale(st){return .172;}
function rtApplyBase(ctx,st,R){const T=st.tr,sc=rtScale(st);ctx.translate(T.x,T.y+(T.lift?.x||0));ctx.scale(sc,sc);ctx.translate(-RT_DEF.center.x,-RT_DEF.center.y);ctx.translate(RT_DEF.center.x,RT_DEF.center.y+R.coreDy.y);ctx.scale(R.coreS.y,R.coreS.y);ctx.translate(-RT_DEF.center.x,-RT_DEF.center.y);}
function rtArmTransform(ctx,R,i,blade){const A=RT_DEF.arms[i],a=R.arms[i],sign=-1;ctx.translate(A.core.x,A.core.y);ctx.rotate(a.root.y*sign);ctx.scale(a.rootS.y,a.rootS.y);ctx.translate(-A.core.x,-A.core.y);if(blade){ctx.translate(A.mid.x,A.mid.y);ctx.rotate(a.blade.y*sign);ctx.translate(-A.mid.x,-A.mid.y);}}
function rtTransformPoint(st,R,i,x,y,blade=false){
  const A=RT_DEF.arms[i],a=R.arms[i],sg=-1,rot=(px,py,cx,cy,ang,sx=1)=>{let dx=(px-cx)*sx,dy=(py-cy)*sx,ca=Math.cos(ang),sa=Math.sin(ang);return {x:cx+dx*ca-dy*sa,y:cy+dx*sa+dy*ca};};
  let p={x,y};if(blade)p=rot(p.x,p.y,A.mid.x,A.mid.y,a.blade.y*sg,1);p=rot(p.x,p.y,A.core.x,A.core.y,a.root.y*sg,a.rootS.y);
  p={x:RT_DEF.center.x+(p.x-RT_DEF.center.x)*R.coreS.y,y:RT_DEF.center.y+R.coreDy.y+(p.y-RT_DEF.center.y)*R.coreS.y};
  const sc=rtScale(st),T=st.tr;return {x:T.x+(p.x-RT_DEF.center.x)*sc,y:T.y+(T.lift?.x||0)+(p.y-RT_DEF.center.y)*sc};
}
function rtDrawPart(ctx,st,R,key,kind,arm=-1,blade=false){const I=st._rtImgs?.[key];if(!I)return;ctx.save();rtApplyBase(ctx,st,R);if(arm>=0)rtArmTransform(ctx,R,arm,blade);const p=RT_DEF.pos[key];ctx.drawImage(I[kind]||I.color,p[0],p[1]);ctx.restore();}
function rtDrawBase(st,ctx,R){for(let k=0;k<3;k++)rtDrawPart(ctx,st,R,'root'+k,'shadow',k,false);rtDrawPart(ctx,st,R,'core','shadow');rtDrawPart(ctx,st,R,'core','color');for(let k=0;k<3;k++)rtDrawPart(ctx,st,R,'root'+k,'color',k,false);}
function rtDrawBlades(st,ctx,R,capRoots){for(let k=0;k<3;k++)rtDrawPart(ctx,st,R,'blade'+k,'shadow',k,true);for(let k=0;k<3;k++)rtDrawPart(ctx,st,R,'blade'+k,'color',k,true);if(capRoots)for(let k=0;k<3;k++)rtDrawPart(ctx,st,R,'root'+k,'color',k,false);}
function rtSweepPart(st,ctx,R,key,arm,blade,u,env){
  const I=st._rtImgs?.[key];if(!I)return;const scx=I.scratch.getContext('2d');scx.setTransform(1,0,0,1,0,0);scx.globalCompositeOperation='source-over';scx.clearRect(0,0,I.w,I.h);scx.drawImage(I.glow,0,0);scx.drawImage(I.edge,0,0);
  const p=RT_DEF.pos[key],cx=RT_DEF.center.x-p[0],cy=RT_DEF.center.y-p[1],rad=60+u*460;
  const g=scx.createRadialGradient(cx,cy,Math.max(0,rad-70),cx,cy,rad+70);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');scx.globalCompositeOperation='destination-in';scx.fillStyle=g;scx.fillRect(0,0,I.w,I.h);scx.globalCompositeOperation='source-over';
  ctx.save();rtApplyBase(ctx,st,R);rtArmTransform(ctx,R,arm,blade);ctx.globalAlpha=env*.85*R.alpha*R.sweepAmt;ctx.drawImage(I.scratch,p[0],p[1]);ctx.restore();
}
function rtDrawFx(st,ctx,R){
  if(!R.visible||R.alpha<=.01)return;const a=R.alpha,e=rtClamp(R.edge+R.tension*.35)*a;
  ctx.save();ctx.globalCompositeOperation='lighter';
  if(e>.01){ctx.globalAlpha=e;for(let k=0;k<3;k++){rtDrawPart(ctx,st,R,'blade'+k,'edge',k,true);rtDrawPart(ctx,st,R,'root'+k,'edge',k,false);}rtDrawPart(ctx,st,R,'core','edge');ctx.globalAlpha=1;}
  if(R.sweepT>=0){const u=R.sweepDir>0?R.sweepT:1-R.sweepT,env=Math.sin(rtClamp(R.sweepT)*Math.PI);for(let k=0;k<3;k++){rtSweepPart(st,ctx,R,'root'+k,k,false,u,env);rtSweepPart(st,ctx,R,'blade'+k,k,true,u,env);}}
  // ROOT joint lights: no permanent armed orb. They exist only from decaying boltLight + clamp tension.
  const pts=[];for(let k=0;k<3;k++)pts.push(rtTransformPoint(st,R,k,RT_DEF.arms[k].core.x,RT_DEF.arms[k].core.y,false));for(let k=0;k<3;k++)pts.push(rtTransformPoint(st,R,k,RT_DEF.arms[k].mid.x,RT_DEF.arms[k].mid.y,false));
  pts.forEach((p,i)=>{const L=rtClamp(R.boltLight[i]+R.tension*.25)*a;if(L<.02)return;const rr=36;const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,rr);g.addColorStop(0,`rgba(235,255,170,${L})`);g.addColorStop(.35,`rgba(170,255,70,${L*.5})`);g.addColorStop(1,'rgba(80,200,20,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,rr,0,Math.PI*2);ctx.fill();});
  const coreI=st._rtImgs?.core,p0=RT_DEF.pos.core,slotSrc={x:RT_DEF.center.x,y:p0[1]+(coreI?.h||0)*.84};let sp={x:slotSrc.x,y:slotSrc.y};sp={x:RT_DEF.center.x+(sp.x-RT_DEF.center.x)*R.coreS.y,y:RT_DEF.center.y+R.coreDy.y+(sp.y-RT_DEF.center.y)*R.coreS.y};const sc=rtScale(st),T=st.tr,so={x:T.x+(sp.x-RT_DEF.center.x)*sc,y:T.y+(T.lift?.x||0)+(sp.y-RT_DEF.center.y)*sc},sl=rtClamp(R.slot)*a;
  if(sl>.02){const rr=68,g=ctx.createRadialGradient(so.x,so.y,0,so.x,so.y,rr);g.addColorStop(0,`rgba(230,255,160,${sl})`);g.addColorStop(.4,`rgba(150,255,60,${sl*.45})`);g.addColorStop(1,'rgba(60,160,20,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(so.x,so.y,rr,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function rtDraw(st,ctx,V,layer){
  const R=rtEnsure(st);if(!R.visible||!st._rtImgs)return;ctx.save();ctx.globalAlpha=R.alpha;
  if(layer==='back'){
    const T=st.tr;ctx.save();ctx.globalAlpha=.35*R.alpha;ctx.translate(T.x,T.y+62);ctx.scale(1,.23);const g=ctx.createRadialGradient(0,0,0,0,0,160);g.addColorStop(0,'rgba(0,0,0,.58)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,160,0,Math.PI*2);ctx.fill();ctx.restore();rtDrawBase(st,ctx,R);
  }else if(layer==='front')rtDrawBlades(st,ctx,R,R.closed);
  else if(layer==='fx')rtDrawFx(st,ctx,R);
  ctx.restore();
}
// ---- install the ROOT trap material/state renderer into the ALT hero ----
// ---- SAFE PASSIVE: replace the entire old dodge execution path ----
Stage.prototype.startDodge=function(){
  const h=this.h,q=this.pr;h.mode='dodge';h.phase='PERCEPTION';h.t=0;this.echoes.length=0;this.ribL.clear();this.ribR.clear();this.ribC.clear();this.collapse=0;
  this.dodgeDir=q.vx>0?-1:1;if(h.px+this.dodgeDir*155>1170||h.px+this.dodgeDir*155<110)this.dodgeDir*=-1;this.dodgeX=h.px;this.dodgeY=h.py;this.cutDone=false;
  // no hit-stop, no full-frame distortion, no history cloning
  this.dilate=0;this.timeScale=1;
};
Stage.prototype.updDodge=function(dt){
  const h=this.h,d=this.dodgeDir;h.t+=dt;const t=h.t;
  const cut=d>0?h.aR:h.aL,brace=d>0?h.aL:h.aR;
  if(t<.07){h.phase='PERCEPTION';h.eye=1.65;return;}
  if(t<.28){
    h.phase='SLIP';const u=Math.max(0,Math.min(1,(t-.07)/.21)),e=1-Math.pow(1-u,4);
    cut.sh.x=-.55*(1-u*.35);cut.el.x=-.40*(1-u*.3);cut.cu.x=-.28;
    brace.sh.x=.20*(1-u*.25);brace.el.x=.24*(1-u*.2);
    h.x.x=this.dodgeX+d*165*e;h.x.v=0;h.y.x=this.dodgeY-Math.sin(u*Math.PI)*12;h.y.v=0;h.rot.x=d*.12*(1-u*.55);h.rot.v=0;h.sx.x=1+.05*Math.sin(u*Math.PI);h.sy.x=1-.04*Math.sin(u*Math.PI);
    return;
  }
  h.phase='SETTLE';const u=Math.max(0,Math.min(1,(t-.28)/.28)),r=1-Math.pow(1-u,3);
  for(const a of [h.aL,h.aR]){a.sh.x*=1-r*.22;a.el.x*=1-r*.22;a.cu.x*=1-r*.25;a.st.x*=1-r*.25;}
  h.rot.x*=1-r*.28;h.sx.x+=(1-h.sx.x)*r*.28;h.sy.x+=(1-h.sy.x)*r*.28;h.y.x+=(this.dodgeY-h.y.x)*r*.35;
  if(t>.58){
    for(const a of [h.aL,h.aR])for(const j of [a.sh,a.el,a.cu,a.st]){j.x=0;j.v=0;}
    h.rot.x=h.rot.v=0;h.sx.x=1;h.sx.v=0;h.sy.x=1;h.sy.v=0;h.y.x=this.dodgeY;h.y.v=0;h.headY.x=h.headY.v=0;h.eye=1;h.mode='idle';h.phase='';this.echoes.length=0;this.ribL.clear();this.ribR.clear();this.ribC.clear();this.pr.on=false;
  }
};


const rig=__require('hunter/rig'),core=__require('hunter/core');
let bodyPromise,rootPromise,visualSeed=0x7a118;const cacheStats={derivations:0,rootLoads:0,bodyLoads:0};
function visualRandom(){visualSeed=(Math.imul(1664525,visualSeed)+1013904223)>>>0;return visualSeed/4294967296;}
async function load(){if(!bodyPromise){cacheStats.bodyLoads++;bodyPromise=rig.loadArt().then(art=>({art,glow:Object.fromEntries(Object.entries(art).map(([k,v])=>[k,rig.makeGlow(v,'rgba(190,255,110,1)',7)]))}));}const [body,root]=await Promise.all([bodyPromise,rtLoadImages()]);return {...body,root};}
// POST-PLAYTEST 2026-09-29: the persistent aura clone is removed; motion
// truth is the high-speed echo history only.
Stage.prototype.drawAura=function(){};Stage.prototype.updateAura=function(){};
window.APEX_HUNTER_GOLD={Stage,rig,core,load,rtUpdate,rtDraw,rtScale,cacheStats};window.apexHunterGoldV10='ready';

})();
