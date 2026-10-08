(function installQuestGoldV12Rig(root){
'use strict';
const __modules={
"/spring":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spring = void 0;
exports.springCoef = springCoef;
exports.peakFactor = peakFactor;
function springCoef(dt, w, z) {
    const eps = 1e-4;
    if (w < eps)
        return [1, 0, 0, 1];
    if (z > 1 + eps) {
        const za = -w * z;
        const zb = w * Math.sqrt(z * z - 1);
        const z1 = za - zb;
        const z2 = za + zb;
        const e1 = Math.exp(z1 * dt);
        const e2 = Math.exp(z2 * dt);
        const inv = 1 / (2 * zb);
        const a = e1 * inv;
        const b = e2 * inv;
        return [
            a * z2 - z2 * b + e2,
            -a + b,
            (z1 * a - z2 * b + e2) * z2,
            -z1 * a + z2 * b,
        ];
    }
    if (z < 1 - eps) {
        const wz = w * z;
        const al = w * Math.sqrt(1 - z * z);
        const e = Math.exp(-wz * dt);
        const c = Math.cos(al * dt);
        const s = Math.sin(al * dt);
        const ia = 1 / al;
        const es = e * s;
        const ec = e * c;
        const ews = e * wz * s * ia;
        return [ec + ews, es * ia, -es * al - wz * ews, ec - ews];
    }
    const e = Math.exp(-w * dt);
    const te = dt * e;
    const twe = te * w;
    return [twe + e, te, -w * twe, -twe + e];
}
/** Peak displacement per unit of (v / w) for an impulse — ROBOT impulse semantics. */
function peakFactor(z) {
    if (z >= 1)
        return 1 / Math.E;
    const s = Math.sqrt(1 - z * z);
    return Math.exp((-z * Math.atan2(s, z)) / s);
}
class Spring {
    constructor(x, w, z) {
        this.v = 0;
        this.x = x;
        this.g = x;
        this.w = w;
        this.z = z;
        this.w0 = w;
        this.z0 = z;
    }
    step(dt) {
        const p = springCoef(dt, this.w, this.z);
        const o = this.x - this.g;
        const v = this.v;
        this.x = o * p[0] + v * p[1] + this.g;
        this.v = o * p[2] + v * p[3];
    }
    /** Impulse injection: modifies velocity only, never teleports the value. */
    kick(peak) {
        this.v += (peak * this.w) / peakFactor(this.z);
    }
    /** Temporary spring tuning. */
    set(w, z) {
        this.w = w;
        this.z = z;
    }
    /** Restore the original tuning. */
    reset() {
        this.w = this.w0;
        this.z = this.z0;
    }
    snapTo(x) {
        this.x = x;
        this.g = x;
        this.v = 0;
    }
}
exports.Spring = Spring;

},
"/constants":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_HP = exports.ARENA = exports.P_A2_LOCK = exports.P_A2_INDEX = exports.P_A1_CONTACT = exports.P_A1_COMMIT = exports.P_A1_FOCUS = exports.P_HELD = exports.P_IDLE = exports.BASE = exports.ROBOT_PASSIVE = exports.ROBOT_A2 = exports.ROBOT_A1 = exports.ENEMY_VARIANTS = exports.HEAD_SCALE = exports.TICK_RATE = exports.DT = void 0;
exports.makeSprings = makeSprings;
exports.allSprings = allSprings;
const spring_1 = require("./spring");
/** Fixed simulation step (120 Hz). Rendering is decoupled via an accumulator. */
exports.DT = 1 / 120;
exports.TICK_RATE = 120;
/** Art-space (1280-unit head coordinates) -> arena world conversion. NOT a movement speed. */
exports.HEAD_SCALE = 172 / 1280;
exports.ENEMY_VARIANTS = ['scout', 'bulwark', 'reaver', 'sentinel', 'operator'];
/** Shared ROBOT mechanics — identical for all four variants. */
exports.ROBOT_A1 = {
    cooldown: 10,
    dashSpeed: 3400,
    maxDashTime: 0.55,
    turnRate: 11,
    arriveRadius: 34,
    windup: 0.26,
};
exports.ROBOT_A2 = {
    cooldown: 10,
    duration: 3.0,
    incomingMult: 0.45,
    ccImmunity: false,
};
exports.ROBOT_PASSIVE = {
    burstWindowSec: 1.2,
    firstThreshold: 150,
    thresholdStep: 50,
    milestoneRefundsSec: [0, 0.5, 1.0, 1.5],
    stepAfterLadder: 0.5,
};
exports.BASE = {
    calTh: 0, calDx: 0, calDy: 0,
    spin: 0, crest: 0, chin: 0,
    cheekX: 0, cheekY: 0,
    lid: 0, glow: 1, seam: 0,
};
exports.P_IDLE = {};
exports.P_HELD = { calTh: -0.05, calDx: 6 };
exports.P_A1_FOCUS = { lid: 0.3, glow: 1.3, spin: Math.PI / 4, crest: -14, calTh: 0.06 };
exports.P_A1_COMMIT = {
    calTh: 0.27, calDx: -8, crest: -54, chin: 12, cheekX: -10, lid: 0.7, glow: 1.75, spin: Math.PI / 2,
};
exports.P_A1_CONTACT = {
    calTh: -0.09, calDx: 12, crest: -16, chin: -6, lid: 0.35, glow: 1.4, spin: Math.PI,
};
exports.P_A2_INDEX = { calTh: 0.04, calDx: 34, crest: 18, lid: 0.26, spin: Math.PI / 4 };
exports.P_A2_LOCK = {
    calTh: 0.13, calDx: 88, calDy: 10, crest: 58, chin: -22, cheekX: 24, cheekY: -20,
    lid: 0.62, glow: 1.12, spin: Math.PI / 2, seam: 0.45,
};
/** Exact reconstructed ROBOT baseline. Every fighter gets its OWN fresh collection. */
function makeSprings() {
    return {
        calTh: [new spring_1.Spring(0, 24, 0.82), new spring_1.Spring(0, 24, 0.82)],
        calDx: [new spring_1.Spring(0, 24, 0.85), new spring_1.Spring(0, 24, 0.85)],
        calDy: [new spring_1.Spring(0, 24, 0.9), new spring_1.Spring(0, 24, 0.9)],
        spin: [new spring_1.Spring(0, 30, 0.62), new spring_1.Spring(0, 30, 0.62)],
        crest: new spring_1.Spring(0, 28, 0.72),
        chin: new spring_1.Spring(0, 24, 0.8),
        cheekX: new spring_1.Spring(0, 24, 0.85),
        cheekY: new spring_1.Spring(0, 24, 0.85),
        lid: new spring_1.Spring(0, 38, 1.0),
        glow: new spring_1.Spring(1, 22, 0.9),
        seam: new spring_1.Spring(0, 12, 1.0),
        coreX: new spring_1.Spring(0, 30, 0.55),
        coreY: new spring_1.Spring(0, 30, 0.6),
        rootX: new spring_1.Spring(0, 22, 0.6),
        rootY: new spring_1.Spring(0, 22, 0.6),
        tilt: new spring_1.Spring(0, 20, 0.55),
        lagX: new spring_1.Spring(0, 16, 0.8),
        lagY: new spring_1.Spring(0, 16, 0.8),
        gunKick: new spring_1.Spring(0, 40, 0.6),
        ped: new spring_1.Spring(0, 18, 0.35),
    };
}
function allSprings(s) {
    return [
        ...s.calTh, ...s.calDx, ...s.calDy, ...s.spin,
        s.crest, s.chin, s.cheekX, s.cheekY, s.lid, s.glow, s.seam,
        s.coreX, s.coreY, s.rootX, s.rootY, s.tilt, s.lagX, s.lagY, s.gunKick, s.ped,
    ];
}
exports.ARENA = { w: 2400, h: 1500 };
exports.MAX_HP = 1000;

},
"/mat":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mix = exports.clamp = exports.Scl = exports.Rot = exports.T = exports.IDENT = void 0;
exports.mul = mul;
exports.apply = apply;
exports.invert = invert;
exports.wrapAngle = wrapAngle;
exports.turnToward = turnToward;
exports.IDENT = [1, 0, 0, 1, 0, 0];
/** mul(m, n): apply n first, then m (same convention as canvas setTransform). */
function mul(m, n) {
    return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
    ];
}
const T = (x, y) => [1, 0, 0, 1, x, y];
exports.T = T;
const Rot = (a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [c, s, -s, c, 0, 0];
};
exports.Rot = Rot;
const Scl = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
exports.Scl = Scl;
function apply(m, x, y) {
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}
function invert(m) {
    const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
    const ia = m[3] / det;
    const ib = -m[1] / det;
    const ic = -m[2] / det;
    const id = m[0] / det;
    return [ia, ib, ic, id, -(ia * m[4] + ic * m[5]), -(ib * m[4] + id * m[5])];
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
exports.clamp = clamp;
const mix = (a, b, t) => a + (b - a) * t;
exports.mix = mix;
function wrapAngle(a) {
    while (a > Math.PI)
        a -= Math.PI * 2;
    while (a < -Math.PI)
        a += Math.PI * 2;
    return a;
}
function turnToward(cur, want, maxStep) {
    const d = wrapAngle(want - cur);
    return wrapAngle(cur + (0, exports.clamp)(d, -maxStep, maxStep));
}

},
"/weapons":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEAPONS = void 0;
exports.WEAPONS = {
    pistol: {
        type: 'pistol', name: 'Pulse Pistol', tier: 2, damage: 30, interval: 0.28, projSpeed: 2300,
        ammo: 45, spread: 0.02, projRadius: 12, range: 2600, stun: 0, recoilK: 1, a1Excluded: false,
        color: '#7df9ff', len: 640, muzzleX: 640, muzzleY: -10,
    },
    smg: {
        type: 'smg', name: 'Arc SMG', tier: 2, damage: 14, interval: 0.085, projSpeed: 2500,
        ammo: 130, spread: 0.06, projRadius: 10, range: 2400, stun: 0, recoilK: 0.65, a1Excluded: false,
        color: '#ffd24a', len: 900, muzzleX: 880, muzzleY: -14,
    },
    rail: {
        type: 'rail', name: 'Rail Rifle', tier: 3, damage: 95, interval: 1.0, projSpeed: 4600,
        ammo: 14, spread: 0, projRadius: 12, range: 3600, stun: 0, recoilK: 1.7, a1Excluded: false,
        color: '#ff6ad5', len: 1250, muzzleX: 1230, muzzleY: -16,
    },
    storm: {
        type: 'storm', name: 'Stormbreaker', tier: 6, damage: 130, interval: 0.8, projSpeed: 3200,
        ammo: 8, spread: 0.01, projRadius: 18, range: 3200, stun: 0.45, recoilK: 2.0, a1Excluded: true,
        color: '#8fb8ff', len: 1050, muzzleX: 1030, muzzleY: -10,
    },
};

},
"/layouts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LAYOUTS = void 0;
const v = (x, y) => ({ x, y });
exports.LAYOUTS = {
    scout: {
        id: 'scout', name: 'SCRAP SCOUT', tag: '01',
        blurb: 'Mobile weapon-seeker. Pincers, open rotors, trailing rear panels.',
        radius: 54, speed: 560, accel: 9000,
        core: v(0, 160), shell: v(0, -200), jaw: v(0, 430), jawHingeL: v(-190, 0), jawHingeR: v(190, 0),
        gripL: v(125, 70), gripR: v(-125, 70),
        shoulderL: v(-440, -20), shoulderR: v(440, -20), fingerL: v(-330, 380), fingerR: v(330, 380),
        armorL: v(0, 0), armorR: v(0, 0), cheekL: v(-300, 140), cheekR: v(300, 140),
        rearL: v(-250, 380), rearR: v(250, 380), antenna: v(-200, -330), latchY: 120,
        eyes: [{ x: -120, y: -5, w: 150, h: 50, rot: 0.2 }, { x: 120, y: -5, w: 150, h: 50, rot: -0.2 }],
        eyeStyle: 'slit', eyeColor: '#ffb629', glowColor: '#ff9a1a', seamColor: '#ffc24a',
        hasFingers: true, hasRear: true, hasAntenna: true,
        gain: { th: 1.5, dx: 1.0, dy: 1.0, crest: 0.9, chin: 1.0, cheekX: 1.2, cheekY: 1.0, core: 1.2, lag: 1.0, rear: 2.4, root: 1.0, jaw: 0.8, finger: 1.6, stab: 0 },
    },
    bulwark: {
        id: 'bulwark', name: 'IRON BULWARK', tag: '02',
        blurb: 'Defensive slab-armor automaton. Armor interlocks around a central latch.',
        radius: 76, speed: 410, accel: 7500,
        core: v(0, 190), shell: v(0, -260), jaw: v(0, 470), jawHingeL: v(-210, 0), jawHingeR: v(210, 0),
        gripL: v(130, 90), gripR: v(-130, 90),
        shoulderL: v(-640, -20), shoulderR: v(640, -20), fingerL: v(0, 0), fingerR: v(0, 0),
        armorL: v(0, 0), armorR: v(0, 0), cheekL: v(-330, 380), cheekR: v(330, 380),
        rearL: v(0, 0), rearR: v(0, 0), antenna: v(0, 0), latchY: 190,
        eyes: [{ x: 0, y: -40, w: 420, h: 58, rot: 0 }],
        eyeStyle: 'slit', eyeColor: '#ff3b30', glowColor: '#ff3b30', seamColor: '#ffd84a',
        hasFingers: false, hasRear: false, hasAntenna: false,
        gain: { th: 0.8, dx: 2.8, dy: 1.5, crest: 1.2, chin: 1.0, cheekX: 1.6, cheekY: 1.2, core: 1.0, lag: 0.6, rear: 0, root: 1.2, jaw: 0.6, finger: 0, stab: 0 },
    },
    reaver: {
        id: 'reaver', name: 'CLAW REAVER', tag: '03',
        blurb: 'Predatory interceptor. Asymmetric claws, skull optics, gripping jaw.',
        radius: 64, speed: 520, accel: 9500,
        core: v(0, 230), shell: v(0, -300), jaw: v(0, 440), jawHingeL: v(-150, 0), jawHingeR: v(150, 0),
        gripL: v(110, 130), gripR: v(-110, 130),
        shoulderL: v(-520, -30), shoulderR: v(520, -30), fingerL: v(-380, 420), fingerR: v(334, 370),
        armorL: v(0, 0), armorR: v(0, 0), cheekL: v(-330, 250), cheekR: v(330, 250),
        rearL: v(0, 0), rearR: v(0, 0), antenna: v(0, 0), latchY: 230,
        eyes: [{ x: -150, y: -40, w: 210, h: 80, rot: 0.5 }, { x: 150, y: -40, w: 210, h: 80, rot: -0.5 }],
        eyeStyle: 'skull', eyeColor: '#ff4a22', glowColor: '#ff3b1f', seamColor: '#ff9a3a',
        hasFingers: true, hasRear: false, hasAntenna: false,
        gain: { th: 2.0, dx: 1.2, dy: 1.0, crest: 1.6, chin: 1.4, cheekX: 1.0, cheekY: 1.0, core: 1.3, lag: 0.9, rear: 0, root: 1.0, jaw: 1.2, finger: 1.8, stab: 0 },
    },
    sentinel: {
        id: 'sentinel', name: 'CORE SENTINEL', tag: '04',
        blurb: 'Precision ranged machine. Suspended reactor, shutter optic, closing plates.',
        radius: 62, speed: 450, accel: 8500,
        core: v(0, 180), shell: v(0, -290), jaw: v(0, 470), jawHingeL: v(-170, 0), jawHingeR: v(170, 0),
        gripL: v(120, 90), gripR: v(-120, 90),
        shoulderL: v(-520, 10), shoulderR: v(520, 10), fingerL: v(0, 0), fingerR: v(0, 0),
        armorL: v(0, 0), armorR: v(0, 0), cheekL: v(-250, 180), cheekR: v(250, 180),
        rearL: v(0, 0), rearR: v(0, 0), antenna: v(0, 0), latchY: 180,
        eyes: [{ x: 0, y: -70, w: 220, h: 220, rot: 0 }],
        eyeStyle: 'lens', eyeColor: '#35e8ff', glowColor: '#35e8ff', seamColor: '#a8f3ff',
        hasFingers: false, hasRear: false, hasAntenna: false,
        gain: { th: 1.0, dx: 1.2, dy: 1.0, crest: 1.0, chin: 1.0, cheekX: 4.5, cheekY: 1.0, core: 1.8, lag: 0.8, rear: 0, root: 1.0, jaw: 1.0, finger: 0, stab: 0.5 },
    },
    operator: {
        id: 'operator', name: 'OPERATOR', tag: 'P1',
        blurb: 'Player chassis (same articulated spring rig, no ROBOT abilities).',
        radius: 58, speed: 540, accel: 10000,
        core: v(0, 180), shell: v(0, -290), jaw: v(0, 470), jawHingeL: v(-170, 0), jawHingeR: v(170, 0),
        gripL: v(120, 90), gripR: v(-120, 90),
        shoulderL: v(-520, 10), shoulderR: v(520, 10), fingerL: v(0, 0), fingerR: v(0, 0),
        armorL: v(0, 0), armorR: v(0, 0), cheekL: v(-250, 180), cheekR: v(250, 180),
        rearL: v(0, 0), rearR: v(0, 0), antenna: v(0, 0), latchY: 180,
        eyes: [{ x: 0, y: -70, w: 220, h: 220, rot: 0 }],
        eyeStyle: 'lens', eyeColor: '#ffb02e', glowColor: '#ffb02e', seamColor: '#ffd27a',
        hasFingers: false, hasRear: false, hasAntenna: false,
        gain: { th: 1.0, dx: 1.2, dy: 1.0, crest: 1.0, chin: 1.0, cheekX: 4.5, cheekY: 1.0, core: 1.8, lag: 0.9, rear: 0, root: 1.0, jaw: 1.0, finger: 0, stab: 0.5 },
    },
};

},
"/vfx":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FighterVFX = void 0;
const mat_1 = require("./mat");
const MAX_P = 200;
const MAX_TRAIL = 44;
class FighterVFX {
    constructor() {
        this.particles = [];
        this.trail = [];
        this.pulses = [];
        this.flashes = [];
        this.cues = [];
        this.rings = [];
        this.brackets = null;
        this.trailActive = false;
        this.seed = 12345;
    }
    r() {
        this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    push(p) {
        if (this.particles.length >= MAX_P)
            this.particles.shift();
        this.particles.push(p);
    }
    sparks(x, y, dirx, diry, n, color, speed = 520) {
        // sparks scatter around the incoming direction reflected back out of the surface
        for (let i = 0; i < n; i++) {
            const a = Math.atan2(-diry, -dirx) + (this.r() - 0.5) * 2.4;
            const s = speed * (0.35 + this.r() * 0.9);
            this.push({
                kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: 0.22 + this.r() * 0.2, max: 0.4, size: 2 + this.r() * 2.5, color, rot: 0, vr: 0,
            });
        }
    }
    fragments(x, y, dirx, diry, n, colors) {
        // fragments eject approximately opposite the incoming force
        for (let i = 0; i < n; i++) {
            const a = Math.atan2(-diry, -dirx) + (this.r() - 0.5) * 1.1;
            const s = 160 + this.r() * 320;
            this.push({
                kind: 'frag', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: 0.55 + this.r() * 0.5, max: 1, size: 5 + this.r() * 8,
                color: colors[Math.floor(this.r() * colors.length)], rot: this.r() * 6, vr: (this.r() - 0.5) * 18,
            });
        }
    }
    smoke(x, y, n, color = 'rgba(210,210,215,0.35)') {
        for (let i = 0; i < n; i++) {
            this.push({
                kind: 'smoke', x, y, vx: (this.r() - 0.5) * 90, vy: (this.r() - 0.5) * 90 - 20,
                life: 0.5 + this.r() * 0.4, max: 0.9, size: 12 + this.r() * 14, color, rot: 0, vr: 0,
            });
        }
    }
    ember(x, y, color) {
        this.push({
            kind: 'ember', x, y, vx: (this.r() - 0.5) * 140, vy: (this.r() - 0.5) * 140,
            life: 0.35 + this.r() * 0.2, max: 0.55, size: 4 + this.r() * 5, color, rot: 0, vr: 0,
        });
    }
    muzzle(x, y, ang, color) {
        this.push({ kind: 'flare', x, y, vx: 0, vy: 0, life: 0.07, max: 0.07, size: 26, color, rot: ang, vr: 0 });
        for (let i = 0; i < 3; i++) {
            const a = ang + (this.r() - 0.5) * 0.6;
            this.push({
                kind: 'spark', x, y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
                life: 0.1, max: 0.1, size: 2.4, color, rot: 0, vr: 0,
            });
        }
    }
    flash(t0, dur, color, r) {
        this.flashes.push({ t0, dur, color, r });
    }
    cue(t0, text, color) {
        this.cues.push({ t0, text, color });
        if (this.cues.length > 4)
            this.cues.shift();
    }
    ring(t0, dur, color, text) {
        this.rings.push({ t0, dur, color, text });
        if (this.rings.length > 6)
            this.rings.shift();
    }
    /** impact path is stored in chassis-local art space so it follows the body while travelling */
    pulse(t0, rootInv, impactWorld, hitPivot, latch, oppPivot, delay, color) {
        const imp = (0, mat_1.apply)(rootInv, impactWorld.x, impactWorld.y);
        this.pulses.push({ t0, path: [imp, hitPivot, latch, oppPivot], delay, dur: delay + 0.12, color, kind: 'transmit' });
        if (this.pulses.length > 6)
            this.pulses.shift();
    }
    recoveryPulse(t0, latch, color) {
        this.pulses.push({ t0, path: [latch, latch, latch, latch], delay: 0, dur: 0.28, color, kind: 'recover' });
        if (this.pulses.length > 6)
            this.pulses.shift();
    }
    update(dt, clock, fighterX, fighterY) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const damp = p.kind === 'frag' ? Math.exp(-3.2 * dt) : p.kind === 'smoke' ? Math.exp(-2 * dt) : Math.exp(-4.5 * dt);
            p.vx *= damp;
            p.vy *= damp;
            p.rot += p.vr * dt;
        }
        if (this.trailActive) {
            this.trail.push({ x: fighterX, y: fighterY, age: 0 });
            if (this.trail.length > MAX_TRAIL)
                this.trail.shift();
            // simple geometric A1 track only — no trailing embers
        }
        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].age += dt;
            if (this.trail[i].age > 0.35)
                this.trail.splice(i, 1);
        }
        this.flashes = this.flashes.filter((f) => clock - f.t0 < f.dur);
        this.cues = this.cues.filter((c) => clock - c.t0 < 1.4);
        this.rings = this.rings.filter((r) => clock - r.t0 < r.dur);
        this.pulses = this.pulses.filter((p) => clock - p.t0 < p.dur + 0.2);
    }
    /** world-space particles + trail */
    drawWorld(ctx, camPx) {
        // trail ribbon (afterimage of the REAL world positions)
        if (this.trail.length > 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineCap = 'round';
            for (let i = 1; i < this.trail.length; i++) {
                const a = this.trail[i - 1];
                const b = this.trail[i];
                const k = Math.max(0, 1 - b.age / 0.35);
                ctx.strokeStyle = `rgba(255,185,92,${0.30 * k})`;
                ctx.lineWidth = (2 + 5 * k);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.strokeStyle = `rgba(255,224,160,${0.35 * k})`;
                ctx.lineWidth = 1 + 2 * k;
                ctx.stroke();
            }
            ctx.restore();
        }
        for (const p of this.particles) {
            const k = Math.max(0, p.life / p.max);
            ctx.save();
            switch (p.kind) {
                case 'spark':
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.strokeStyle = p.color;
                    ctx.globalAlpha = Math.min(1, k * 1.6);
                    ctx.lineWidth = p.size / Math.max(0.2, camPx) * 0.55 + 1.5;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
                    ctx.stroke();
                    break;
                case 'ember':
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = k;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'frag':
                    ctx.globalAlpha = Math.min(1, k * 2);
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.fillStyle = p.color;
                    ctx.strokeStyle = '#0b0b0e';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(-p.size, -p.size * 0.5);
                    ctx.lineTo(p.size, -p.size * 0.2);
                    ctx.lineTo(p.size * 0.4, p.size * 0.7);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    break;
                case 'smoke':
                    ctx.globalAlpha = k * 0.6;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'flare': {
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = k;
                    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                    g.addColorStop(0, '#ffffff');
                    g.addColorStop(0.4, p.color);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                default:
                    break;
            }
            ctx.restore();
        }
    }
    /** structural transmission pulses, drawn in world space from chassis-local waypoints */
    drawPulses(ctx, clock, root) {
        for (const p of this.pulses) {
            const t = clock - p.t0;
            if (t < 0)
                continue;
            const pts = p.path.map((q) => (0, mat_1.apply)(root, q.x, q.y));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (p.kind === 'recover') {
                const k = Math.min(1, t / p.dur);
                ctx.strokeStyle = p.color;
                ctx.globalAlpha = 1 - k;
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(pts[0].x, pts[0].y, 10 + k * 70, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                continue;
            }
            // leg A: impact -> hit pivot -> latch   (0 .. delay)
            // leg B: latch -> opposite pivot        (delay .. delay+0.12)
            const segs = [
                [0, 1, 0, p.delay * 0.55],
                [1, 2, p.delay * 0.55, p.delay],
                [2, 3, p.delay, p.delay + 0.12],
            ];
            for (const [i0, i1, ts, te] of segs) {
                if (t < ts)
                    continue;
                const k = Math.min(1, (t - ts) / Math.max(1e-3, te - ts));
                const a = pts[i0];
                const b = pts[i1];
                const hx = a.x + (b.x - a.x) * k;
                const hy = a.y + (b.y - a.y) * k;
                const fade = t > te ? Math.max(0, 1 - (t - te) / 0.2) : 1;
                ctx.globalAlpha = fade;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(hx, hy);
                ctx.stroke();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                if (t <= te) {
                    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
                    g.addColorStop(0, '#ffffff');
                    g.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(hx, hy, 16, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }
    }
    static rootInverse(root) { return (0, mat_1.invert)(root); }
}
exports.FighterVFX = FighterVFX;

},
"/art/artkit":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PX = exports.OUT = void 0;
exports.makePart = makePart;
exports.shade = shade;
exports.rnd = rnd;
exports.pathPoly = pathPoly;
exports.plate = plate;
exports.disc = disc;
exports.rivet = rivet;
exports.bolt = bolt;
exports.joint = joint;
exports.strut = strut;
exports.piston = piston;
exports.slots = slots;
exports.lightStrip = lightStrip;
exports.hazard = hazard;
exports.gearShape = gearShape;
exports.ring = ring;
exports.mirrorPts = mirrorPts;
exports.OUT = '#0b0b0e';
exports.PX = 0.3; // raster pixels per art unit
/**
 * Create a part. (ox, oy) is the pivot position inside the w x h box; drawing happens in pivot-local coords.
 * mirror=true flips the artwork horizontally around the pivot (for right-side parts).
 */
function makePart(w, h, ox, oy, draw, mirror = false) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * exports.PX);
    c.height = Math.ceil(h * exports.PX);
    const g = c.getContext('2d');
    const px = mirror ? w - ox : ox;
    g.scale(exports.PX, exports.PX);
    g.translate(px, oy);
    if (mirror)
        g.scale(-1, 1);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    draw(g);
    return { canvas: c, w, h, ox: px, oy };
}
function shade(color, amt) {
    // accepts '#rrggbb' or 'rgb(r,g,b)' (shade() output may be shaded again)
    let r = 0;
    let gg = 0;
    let b = 0;
    if (color.startsWith('#')) {
        const n = parseInt(color.slice(1, 7), 16);
        r = n >> 16;
        gg = (n >> 8) & 255;
        b = n & 255;
    }
    else {
        const m = color.match(/-?\d+(\.\d+)?/g);
        if (m && m.length >= 3) {
            r = +m[0];
            gg = +m[1];
            b = +m[2];
        }
    }
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
    return `rgb(${f(r)},${f(gg)},${f(b)})`;
}
function rnd(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
function pathPoly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++)
        g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
}
/** Layered armour plate: gradient body, bevel bands, scratches, edge chips, heavy outline. */
function plate(g, pts, fill, o = {}) {
    const lw = o.lw ?? 30;
    const band = o.band ?? 22;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
    }
    g.save();
    pathPoly(g, pts);
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, shade(fill, 0.28));
    gr.addColorStop(0.55, fill);
    gr.addColorStop(1, shade(fill, -0.34));
    g.fillStyle = gr;
    g.fill();
    g.clip();
    g.lineWidth = band * 1.8;
    g.save();
    g.translate(band, band);
    pathPoly(g, pts);
    g.strokeStyle = 'rgba(255,255,255,0.26)';
    g.stroke();
    g.restore();
    g.save();
    g.translate(-band, -band);
    pathPoly(g, pts);
    g.strokeStyle = 'rgba(0,0,0,0.30)';
    g.stroke();
    g.restore();
    const r = rnd(o.seed ?? 7);
    const ns = o.scratch ?? 4;
    g.lineWidth = 7;
    for (let i = 0; i < ns; i++) {
        const x = x0 + r() * (x1 - x0);
        const y = y0 + r() * (y1 - y0);
        const a = r() * Math.PI;
        const l = 50 + r() * 140;
        g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.28)';
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
    }
    const nc = o.chips ?? 3;
    g.fillStyle = 'rgba(8,8,10,0.85)';
    for (let i = 0; i < nc; i++) {
        const k = Math.floor(r() * pts.length);
        const a = pts[k];
        const b = pts[(k + 1) % pts.length];
        const t = 0.15 + r() * 0.7;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        const s = 26 + r() * 30;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const dx = cx - x;
        const dy = cy - y;
        const dl = Math.hypot(dx, dy) || 1;
        g.beginPath();
        g.moveTo(x - dy / dl * s * 0.6, y + dx / dl * s * 0.6);
        g.lineTo(x + dx / dl * s, y + dy / dl * s);
        g.lineTo(x + dy / dl * s * 0.6, y - dx / dl * s * 0.6);
        g.closePath();
        g.fill();
    }
    g.restore();
    pathPoly(g, pts);
    g.lineWidth = lw;
    g.strokeStyle = o.out ?? exports.OUT;
    g.stroke();
}
function disc(g, x, y, r, fill, lw = 22) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, shade(fill, 0.3));
    gr.addColorStop(1, shade(fill, -0.28));
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = lw;
    g.strokeStyle = exports.OUT;
    g.stroke();
}
function rivet(g, x, y, r = 20, fill = '#9aa0a8') {
    disc(g, x, y, r, fill, 10);
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
}
function bolt(g, x, y, r, fill, rot = 0) {
    disc(g, x, y, r, fill, 18);
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.strokeStyle = exports.OUT;
    g.lineWidth = r * 0.28;
    g.beginPath();
    g.moveTo(-r * 0.7, 0);
    g.lineTo(r * 0.7, 0);
    g.stroke();
    g.restore();
}
/** gold-ring joint with dark core */
function joint(g, x, y, r, ring, core = '#1a1b1f') {
    disc(g, x, y, r + 8, ring, 22);
    disc(g, x, y, r * 0.5, core, 12);
}
function strut(g, x1, y1, x2, y2, w, fill) {
    g.lineCap = 'round';
    g.strokeStyle = exports.OUT;
    g.lineWidth = w + 30;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    g.strokeStyle = fill;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = w * 0.25;
    g.beginPath();
    g.moveTo(x1 - nx * w * 0.22, y1 - ny * w * 0.22);
    g.lineTo(x2 - nx * w * 0.22, y2 - ny * w * 0.22);
    g.stroke();
}
function piston(g, x1, y1, x2, y2, w, sleeve, rod) {
    const mx = x1 + (x2 - x1) * 0.58;
    const my = y1 + (y2 - y1) * 0.58;
    strut(g, mx, my, x2, y2, w * 0.55, rod);
    strut(g, x1, y1, mx, my, w, sleeve);
}
function slots(g, x, y, w, h, n, fill = '#09090b') {
    const sh = h / (n * 2 - 1);
    g.fillStyle = fill;
    g.strokeStyle = exports.OUT;
    g.lineWidth = 8;
    for (let i = 0; i < n; i++) {
        g.fillRect(x, y + i * sh * 2, w, sh);
        g.strokeRect(x, y + i * sh * 2, w, sh);
    }
}
function lightStrip(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.strokeStyle = exports.OUT;
    g.lineWidth = 12;
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(x + 4, y + 3, w - 8, Math.max(2, h * 0.28));
}
function hazard(g, pts, c1, c2, step = 70) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
    }
    g.save();
    pathPoly(g, pts);
    g.fillStyle = c1;
    g.fill();
    g.clip();
    g.strokeStyle = c2;
    g.lineWidth = step * 0.5;
    for (let x = x0 - (y1 - y0); x < x1 + step; x += step) {
        g.beginPath();
        g.moveTo(x, y1);
        g.lineTo(x + (y1 - y0), y0);
        g.stroke();
    }
    g.restore();
    pathPoly(g, pts);
    g.lineWidth = 24;
    g.strokeStyle = exports.OUT;
    g.stroke();
}
function gearShape(g, x, y, r, teeth, fill, hole = 0.35) {
    g.beginPath();
    const n = teeth * 2;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = i % 2 === 0 ? r * 1.18 : r * 0.92;
        const a2 = a + (Math.PI * 2) / n * 0.5;
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        g.lineTo(x + Math.cos(a2) * rr, y + Math.sin(a2) * rr);
    }
    g.closePath();
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.2);
    gr.addColorStop(0, shade(fill, 0.3));
    gr.addColorStop(1, shade(fill, -0.3));
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 20;
    g.strokeStyle = exports.OUT;
    g.stroke();
    if (hole > 0)
        disc(g, x, y, r * hole, '#16171b', 12);
}
function ring(g, x, y, r, w, fill) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.lineWidth = w + 26;
    g.strokeStyle = exports.OUT;
    g.stroke();
    g.lineWidth = w;
    g.strokeStyle = fill;
    g.stroke();
    g.lineWidth = w * 0.25;
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.arc(x - 3, y - 3, r - w * 0.2, Math.PI * 1.05, Math.PI * 1.7);
    g.stroke();
}
function mirrorPts(pts) { return pts.map(([x, y]) => [-x, y]).reverse(); }

},
"/art/robots":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PALS = void 0;
exports.buildRigArt = buildRigArt;
const artkit_1 = require("./artkit");
exports.PALS = {
    scout: { base: '#b0602e', light: '#e09a5a', dark: '#5b2c17', metal: '#5d646b', metalDark: '#2a2d31', metalLight: '#9aa3ab', accent: '#e8a21a', accent2: '#ffd36a', bone: '#d8cdb5', glow: '#ffa000' },
    bulwark: { base: '#6f7f90', light: '#a9b9c9', dark: '#34414e', metal: '#4a525a', metalDark: '#20252b', metalLight: '#9aa6b2', accent: '#f2b705', accent2: '#ffd84a', bone: '#cfd6dd', glow: '#ff3b30' },
    reaver: { base: '#a8242b', light: '#d9535a', dark: '#4b0f14', metal: '#3b3f46', metalDark: '#17181c', metalLight: '#8b919a', accent: '#ff7a1a', accent2: '#ffb347', bone: '#ece3cc', glow: '#ff3b1f' },
    sentinel: { base: '#4f6f90', light: '#8fb4d6', dark: '#223347', metal: '#58626e', metalDark: '#1a2129', metalLight: '#a7b4c2', accent: '#31e0ff', accent2: '#a8f3ff', bone: '#dfe7ee', glow: '#35e8ff' },
    operator: { base: '#e8e2d2', light: '#ffffff', dark: '#8c8573', metal: '#3a3d42', metalDark: '#141518', metalLight: '#a9adb3', accent: '#f0a31a', accent2: '#ffd27a', bone: '#f4efe2', glow: '#ffb02e' },
};
function hexPts(r, rot = 0) {
    const out = [];
    for (let i = 0; i < 6; i++) {
        const a = rot + (i / 6) * Math.PI * 2;
        out.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return out;
}
/* =============================== 01 SCRAP SCOUT ============================ */
function scout() {
    const p = exports.PALS.scout;
    const chassis = (0, artkit_1.makePart)(1100, 1000, 550, 450, (g) => {
        (0, artkit_1.plate)(g, [[-300, -300], [300, -300], [390, -40], [270, 420], [-270, 420], [-390, -40]], p.metalDark, { seed: 1, scratch: 6, chips: 5 });
        (0, artkit_1.strut)(g, -340, -170, -330, 250, 44, p.metal);
        (0, artkit_1.strut)(g, 340, -170, 330, 250, 44, p.metal);
        (0, artkit_1.plate)(g, [[-215, -255], [215, -255], [285, -20], [195, 365], [-195, 365], [-285, -20]], p.base, { seed: 3, scratch: 8, chips: 7 });
        (0, artkit_1.plate)(g, [[-300, -75], [300, -75], [255, 55], [-255, 55]], '#15161a', { lw: 26, scratch: 0, chips: 0 });
        (0, artkit_1.slots)(g, -100, 140, 200, 110, 4);
        (0, artkit_1.lightStrip)(g, -55, 290, 110, 28, p.accent);
        [[-230, -215], [230, -215], [-250, 325], [250, 325], [-262, 90], [262, 90]].forEach(([x, y]) => (0, artkit_1.rivet)(g, x, y, 18));
        g.strokeStyle = artkit_1.OUT;
        g.lineWidth = 26;
        g.beginPath();
        g.moveTo(-180, 280);
        g.bezierCurveTo(-120, 340, -60, 250, 0, 330);
        g.stroke();
        g.strokeStyle = p.accent;
        g.lineWidth = 9;
        g.stroke();
    });
    const core = (0, artkit_1.makePart)(320, 320, 160, 160, (g) => {
        (0, artkit_1.gearShape)(g, 0, 0, 100, 8, p.metalDark, 0);
        (0, artkit_1.disc)(g, 0, 0, 66, '#20140a', 14);
        (0, artkit_1.disc)(g, 0, 0, 38, p.glow, 8);
    });
    const shell = (0, artkit_1.makePart)(840, 440, 420, 230, (g) => {
        (0, artkit_1.plate)(g, [[-340, 130], [-300, -40], [-130, -150], [130, -150], [300, -40], [340, 130], [220, 60], [-220, 60]], p.base, { seed: 5, scratch: 6, chips: 5 });
        (0, artkit_1.plate)(g, [[-200, 40], [-120, -50], [120, -50], [200, 40], [120, 18], [-120, 18]], p.metalDark, { seed: 6, scratch: 0, chips: 0, lw: 22 });
        (0, artkit_1.lightStrip)(g, -110, -112, 220, 26, p.accent);
        (0, artkit_1.rivet)(g, -250, 10, 18);
        (0, artkit_1.rivet)(g, 250, 10, 18);
    });
    const jaw = (m) => (0, artkit_1.makePart)(300, 280, 100, 100, (g) => {
        (0, artkit_1.plate)(g, [[-40, -40], [40, -50], [120, -5], [150, 70], [110, 125], [90, 60], [30, 35], [-40, 40]], p.metal, { seed: 8, scratch: 2, chips: 2, lw: 26 });
        (0, artkit_1.lightStrip)(g, 30, -18, 60, 16, p.accent);
        (0, artkit_1.joint)(g, 0, 0, 26, p.accent);
    }, m);
    const rotor = (m) => (0, artkit_1.makePart)(360, 360, 180, 180, (g) => {
        (0, artkit_1.ring)(g, 0, 0, 110, 34, p.metal);
        for (let k = 0; k < 3; k++) {
            const a = (k * Math.PI * 2) / 3;
            (0, artkit_1.strut)(g, 0, 0, Math.cos(a) * 105, Math.sin(a) * 105, 30, p.metalDark);
            (0, artkit_1.disc)(g, Math.cos(a) * 105, Math.sin(a) * 105, 26, p.accent, 12);
        }
        (0, artkit_1.gearShape)(g, 0, 0, 50, 8, p.accent, 0.3);
    }, m);
    const arm = (m) => (0, artkit_1.makePart)(560, 880, 500, 140, (g) => {
        (0, artkit_1.piston)(g, -30, -70, -215, 60, 46, p.metalDark, p.metalLight);
        (0, artkit_1.strut)(g, 0, 0, -250, 150, 66, p.metal);
        (0, artkit_1.joint)(g, -250, 150, 40, p.accent);
        (0, artkit_1.strut)(g, -250, 150, -330, 380, 54, p.metalDark);
        (0, artkit_1.plate)(g, [[-400, 350], [-320, 320], [-260, 420], [-280, 560], [-330, 640], [-345, 520], [-390, 430]], p.base, { seed: 9, scratch: 4, chips: 4, lw: 26 });
        (0, artkit_1.plate)(g, [[-330, 640], [-300, 560], [-345, 520]], p.metalLight, { lw: 20, scratch: 0, chips: 0 });
        (0, artkit_1.joint)(g, -330, 380, 30, p.accent);
    }, m);
    const finger = (m) => (0, artkit_1.makePart)(260, 430, 60, 110, (g) => {
        (0, artkit_1.plate)(g, [[0, -40], [80, -30], [150, 80], [165, 230], [120, 300], [95, 190], [40, 90], [0, 40]], p.base, { seed: 10, scratch: 3, chips: 3, lw: 26 });
        (0, artkit_1.plate)(g, [[120, 300], [165, 230], [150, 200]], p.metalLight, { lw: 18, scratch: 0, chips: 0 });
        (0, artkit_1.joint)(g, 0, 0, 26, p.accent);
    }, m);
    const armor = (m) => (0, artkit_1.makePart)(440, 380, 220, 260, (g) => {
        (0, artkit_1.plate)(g, [[-70, -200], [80, -190], [150, -70], [60, 50], [-100, 10], [-150, -110]], p.base, { seed: 12, scratch: 5, chips: 5 });
        (0, artkit_1.rivet)(g, -40, -110, 16);
        (0, artkit_1.rivet)(g, 70, -60, 16);
    }, m);
    const cheek = (m) => (0, artkit_1.makePart)(270, 390, 150, 180, (g) => {
        (0, artkit_1.plate)(g, [[-60, -120], [40, -100], [60, 110], [-40, 150], [-90, 40]], p.metal, { seed: 14, scratch: 3, chips: 2, lw: 26 });
        (0, artkit_1.rivet)(g, -10, -60, 14);
        (0, artkit_1.rivet)(g, 10, 80, 14);
    }, m);
    const rear = (m) => (0, artkit_1.makePart)(310, 380, 170, 60, (g) => {
        (0, artkit_1.plate)(g, [[-80, 0], [60, 0], [80, 200], [-20, 260], [-110, 150]], p.dark, { seed: 16, scratch: 4, chips: 3, lw: 26 });
        (0, artkit_1.lightStrip)(g, -50, 40, 80, 14, p.accent);
    }, m);
    const antenna = (0, artkit_1.makePart)(140, 420, 70, 370, (g) => {
        (0, artkit_1.strut)(g, 0, 0, 0, -290, 20, p.metalLight);
        (0, artkit_1.disc)(g, 0, -300, 30, p.accent, 12);
        (0, artkit_1.joint)(g, 0, 0, 22, p.metal);
    });
    return {
        chassis, core, shell, jawL: jaw(false), jawR: jaw(true), rotorL: rotor(false), rotorR: rotor(true),
        armL: arm(false), armR: arm(true), fingerL: finger(false), fingerR: finger(true),
        armorL: armor(false), armorR: armor(true), cheekL: cheek(false), cheekR: cheek(true),
        rearL: rear(false), rearR: rear(true), antenna,
    };
}
/* ============================== 02 IRON BULWARK ============================ */
function bulwark() {
    const p = exports.PALS.bulwark;
    const chassis = (0, artkit_1.makePart)(1400, 1100, 700, 500, (g) => {
        (0, artkit_1.plate)(g, [[-520, -260], [-300, -380], [300, -380], [520, -260], [580, 150], [400, 430], [-400, 430], [-580, 150]], p.base, { seed: 51, scratch: 8, chips: 6, lw: 34 });
        (0, artkit_1.plate)(g, [[-440, -200], [-260, -300], [260, -300], [440, -200], [480, 120], [330, 360], [-330, 360], [-480, 120]], p.dark, { seed: 52, scratch: 3, chips: 2, lw: 24 });
        (0, artkit_1.plate)(g, [[-470, -120], [-200, -120], [-200, 290], [-340, 320], [-470, 150]], p.base, { seed: 53, scratch: 6, chips: 4 });
        (0, artkit_1.plate)(g, [[470, -120], [200, -120], [200, 290], [340, 320], [470, 150]], p.base, { seed: 54, scratch: 6, chips: 4 });
        (0, artkit_1.plate)(g, [[-320, -110], [320, -110], [290, 30], [-290, 30]], '#101114', { lw: 26, scratch: 0, chips: 0 });
        (0, artkit_1.ring)(g, 0, 190, 185, 42, p.metalDark);
        (0, artkit_1.disc)(g, 0, 190, 140, '#14171b', 14);
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + 0.2;
            (0, artkit_1.bolt)(g, Math.cos(a) * 185, 190 + Math.sin(a) * 185, 17, p.metalLight, a);
        }
        (0, artkit_1.hazard)(g, [[-380, 350], [380, 350], [340, 410], [-340, 410]], '#1b1d21', p.accent, 60);
        for (let x = -240; x <= 240; x += 120)
            (0, artkit_1.rivet)(g, x, -335, 18);
        for (let y = -60; y <= 220; y += 140) {
            (0, artkit_1.rivet)(g, -430, y, 16);
            (0, artkit_1.rivet)(g, 430, y, 16);
        }
    });
    const core = (0, artkit_1.makePart)(300, 300, 150, 150, (g) => {
        (0, artkit_1.disc)(g, 0, 0, 100, '#1c1410', 14);
        (0, artkit_1.disc)(g, 0, 0, 62, '#ff6b2a', 10);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath();
        g.arc(-16, -18, 16, 0, Math.PI * 2);
        g.fill();
    });
    const shell = (0, artkit_1.makePart)(1100, 440, 550, 230, (g) => {
        (0, artkit_1.plate)(g, [[-470, 60], [-380, -110], [-260, -170], [260, -170], [380, -110], [470, 60], [330, 110], [-330, 110]], p.base, { seed: 61, scratch: 8, chips: 6, lw: 34 });
        (0, artkit_1.plate)(g, [[-300, -90], [300, -90], [250, 20], [-250, 20]], p.metal, { seed: 62, scratch: 2, chips: 1, lw: 24 });
        (0, artkit_1.slots)(g, -180, -70, 360, 70, 3);
        (0, artkit_1.strut)(g, -300, -140, 300, -140, 22, p.metalLight);
        for (let x = -380; x <= 380; x += 95)
            (0, artkit_1.rivet)(g, x, 78, 15);
    });
    const jaw = (m) => (0, artkit_1.makePart)(380, 300, 130, 110, (g) => {
        (0, artkit_1.plate)(g, [[-70, -60], [70, -70], [150, -20], [160, 70], [110, 130], [40, 100], [-70, 90]], p.metal, { seed: 71, scratch: 3, chips: 2, lw: 28 });
        (0, artkit_1.lightStrip)(g, 10, -35, 90, 18, p.accent);
        (0, artkit_1.joint)(g, 0, 0, 34, p.accent);
    }, m);
    const rotor = (m) => (0, artkit_1.makePart)(420, 420, 210, 210, (g) => {
        (0, artkit_1.plate)(g, hexPts(170), p.metal, { seed: 75, scratch: 3, chips: 2 });
        (0, artkit_1.ring)(g, 0, 0, 105, 26, p.metalDark);
        hexPts(150).forEach(([x, y]) => (0, artkit_1.rivet)(g, x, y, 15));
        (0, artkit_1.bolt)(g, 0, 0, 62, p.accent, 0);
    }, m);
    // compact manipulator: hydraulic forearm hangs behind the slab, twin claws emerge below it
    const arm = (m) => (0, artkit_1.makePart)(560, 900, 300, 140, (g) => {
        (0, artkit_1.piston)(g, -60, 30, -110, 400, 64, p.metalDark, p.metalLight);
        (0, artkit_1.plate)(g, [[-140, 320], [10, 320], [30, 570], [-160, 570]], p.metal, { seed: 81, scratch: 3, chips: 2 });
        (0, artkit_1.joint)(g, -60, 560, 46, p.accent);
        (0, artkit_1.plate)(g, [[-200, 570], [-95, 570], [-105, 760], [-215, 710]], p.base, { seed: 82, scratch: 3, chips: 2 });
        (0, artkit_1.plate)(g, [[-25, 570], [80, 570], [65, 710], [-35, 760]], p.base, { seed: 83, scratch: 3, chips: 2 });
        (0, artkit_1.joint)(g, 0, 0, 50, p.accent);
    }, m);
    const slabPts = [[-280, -170], [60, -230], [200, -140], [200, -60], [150, -20], [200, 40], [150, 80], [200, 140], [150, 180], [200, 240], [200, 420], [60, 520], [-210, 430], [-300, 150]];
    const armor = (m) => (0, artkit_1.makePart)(600, 800, 300, 260, (g) => {
        (0, artkit_1.plate)(g, slabPts, p.base, { seed: 91, scratch: 9, chips: 7, lw: 34 });
        (0, artkit_1.plate)(g, [[-220, -100], [40, -150], [110, -60], [110, 360], [30, 430], [-180, 360], [-230, 140]], p.metal, { seed: 92, scratch: 4, chips: 3, lw: 22 });
        (0, artkit_1.hazard)(g, [[-200, 290], [90, 290], [90, 370], [-170, 370]], '#1b1d21', p.accent, 50);
        for (let y = -60; y <= 240; y += 100)
            (0, artkit_1.rivet)(g, -190, y, 15);
    }, m);
    const cheek = (m) => (0, artkit_1.makePart)(300, 340, 150, 170, (g) => {
        (0, artkit_1.plate)(g, [[-60, -100], [70, -100], [90, 110], [-70, 130]], p.metal, { seed: 95, scratch: 3, chips: 2, lw: 28 });
        (0, artkit_1.rivet)(g, 0, -50, 15);
        (0, artkit_1.rivet)(g, 5, 70, 15);
    }, m);
    return {
        chassis, core, shell, jawL: jaw(false), jawR: jaw(true), rotorL: rotor(false), rotorR: rotor(true),
        armL: arm(false), armR: arm(true), armorL: armor(false), armorR: armor(true), cheekL: cheek(false), cheekR: cheek(true),
    };
}
/* =============================== 03 CLAW REAVER ============================ */
function reaver() {
    const p = exports.PALS.reaver;
    const chassis = (0, artkit_1.makePart)(1300, 1100, 650, 520, (g) => {
        (0, artkit_1.plate)(g, [[-440, -300], [-200, -380], [200, -380], [440, -300], [500, -40], [330, 160], [190, 470], [-190, 470], [-330, 160], [-500, -40]], p.metalDark, { seed: 101, scratch: 6, chips: 6 });
        (0, artkit_1.plate)(g, [[-400, -280], [-60, -340], [-40, 60], [-250, 130], [-430, -20]], p.base, { seed: 102, scratch: 8, chips: 6 });
        (0, artkit_1.plate)(g, [[60, -330], [380, -270], [420, -30], [60, 10]], p.metal, { seed: 103, scratch: 7, chips: 5 });
        (0, artkit_1.plate)(g, [[-60, -130], [60, -130], [95, 100], [0, 190], [-95, 100]], '#101114', { lw: 26, scratch: 0, chips: 0 });
        [-1, 1].forEach((s) => {
            g.save();
            g.translate(s * 150, -40);
            g.rotate(-s * 0.5);
            (0, artkit_1.plate)(g, [[-125, -58], [125, -58], [125, 58], [-125, 58]], '#0e0e10', { lw: 24, scratch: 0, chips: 0 });
            g.restore();
        });
        for (let i = 0; i < 3; i++)
            (0, artkit_1.strut)(g, -190, 180 + i * 80, 190, 180 + i * 80, 16, p.metalDark);
        for (let x = -240; x <= 240; x += 80) {
            (0, artkit_1.plate)(g, [[x - 34, 385], [x + 34, 385], [x, 465]], p.bone, { lw: 18, scratch: 0, chips: 0, band: 12 });
        }
        g.strokeStyle = artkit_1.OUT;
        g.lineWidth = 24;
        g.beginPath();
        g.moveTo(-300, 140);
        g.bezierCurveTo(-220, 250, -160, 150, -110, 240);
        g.stroke();
        g.strokeStyle = p.accent;
        g.lineWidth = 8;
        g.stroke();
    });
    const core = (0, artkit_1.makePart)(300, 300, 150, 150, (g) => {
        (0, artkit_1.disc)(g, 0, 0, 92, '#1b0e0c', 14);
        (0, artkit_1.disc)(g, 0, 0, 56, p.accent, 10);
        g.strokeStyle = artkit_1.OUT;
        g.lineWidth = 12;
        g.beginPath();
        g.moveTo(-90, 0);
        g.lineTo(90, 0);
        g.moveTo(0, -90);
        g.lineTo(0, 90);
        g.stroke();
    });
    const shell = (0, artkit_1.makePart)(1000, 600, 500, 400, (g) => {
        (0, artkit_1.plate)(g, [[-300, 50], [-200, -90], [200, -90], [300, 50], [150, 90], [-150, 90]], p.dark, { seed: 111, scratch: 5, chips: 4 });
        (0, artkit_1.plate)(g, [[-300, 40], [-380, -310], [-170, -60], [-120, -90]], p.base, { seed: 112, scratch: 6, chips: 5 });
        (0, artkit_1.plate)(g, [[300, 40], [355, -150], [170, -70]], p.metal, { seed: 113, scratch: 4, chips: 3 });
        (0, artkit_1.plate)(g, [[-70, 70], [0, -200], [70, 70]], p.metalDark, { seed: 114, scratch: 1, chips: 1, lw: 24 });
        (0, artkit_1.lightStrip)(g, -8, -120, 16, 110, p.accent);
    });
    const jaw = (m) => (0, artkit_1.makePart)(360, 420, 110, 110, (g) => {
        (0, artkit_1.plate)(g, [[-60, -50], [60, -60], [110, 0], [100, 150], [60, 260], [30, 120], [-60, 70]], p.bone, { seed: 121, scratch: 3, chips: 3, lw: 26 });
        (0, artkit_1.plate)(g, [[100, 150], [60, 260], [30, 120]], (0, artkit_1.shade)(p.bone, -0.15), { lw: 18, scratch: 0, chips: 0, band: 10 });
        (0, artkit_1.joint)(g, 0, 0, 28, p.accent);
    }, m);
    const rotor = (m) => (0, artkit_1.makePart)(360, 360, 180, 180, (g) => {
        (0, artkit_1.gearShape)(g, 0, 0, 110, 10, p.metal, 0.3);
        (0, artkit_1.ring)(g, 0, 0, 68, 18, p.accent);
        (0, artkit_1.bolt)(g, 0, 0, 30, p.metalLight, 0);
    }, m);
    const arm = (m, small) => (0, artkit_1.makePart)(620, 960, 560, 140, (g) => {
        if (small)
            g.scale(0.88, 0.88);
        (0, artkit_1.piston)(g, -30, -80, -240, 70, 56, p.metalDark, p.metalLight);
        (0, artkit_1.strut)(g, 0, 0, -300, 200, 120, p.metal);
        (0, artkit_1.plate)(g, [[-130, -70], [40, -50], [-190, 170], [-330, 150]], small ? p.metal : p.base, { seed: 131, scratch: 5, chips: 4, lw: 26 });
        (0, artkit_1.joint)(g, -300, 200, 64, p.accent);
        (0, artkit_1.strut)(g, -300, 200, -380, 430, 100, p.metalDark);
        (0, artkit_1.plate)(g, [[-460, 380], [-330, 380], [-270, 520], [-310, 780], [-380, 640], [-470, 500]], p.bone, { seed: 132, scratch: 4, chips: 4, lw: 26 });
        for (let i = 0; i < 3; i++)
            (0, artkit_1.plate)(g, [[-465 + i * 18, 470 + i * 60], [-420 + i * 18, 495 + i * 60], [-455 + i * 18, 520 + i * 60]], (0, artkit_1.shade)(p.bone, -0.25), { lw: 12, scratch: 0, chips: 0, band: 6 });
        if (small)
            (0, artkit_1.gearShape)(g, -250, 120, 70, 12, p.metalLight, 0.3);
        (0, artkit_1.joint)(g, -380, 420, 36, p.accent);
    }, m);
    const finger = (m, small) => (0, artkit_1.makePart)(360, 510, 60, 110, (g) => {
        if (small)
            g.scale(0.88, 0.88);
        (0, artkit_1.plate)(g, [[0, -40], [110, -10], [210, 120], [240, 330], [170, 250], [70, 150], [10, 60]], p.bone, { seed: 141, scratch: 3, chips: 3, lw: 26 });
        for (let i = 0; i < 3; i++)
            (0, artkit_1.plate)(g, [[60 + i * 40, 120 + i * 60], [110 + i * 40, 125 + i * 60], [90 + i * 40, 165 + i * 60]], (0, artkit_1.shade)(p.bone, -0.25), { lw: 12, scratch: 0, chips: 0, band: 6 });
        (0, artkit_1.joint)(g, 0, 0, 30, p.accent);
    }, m);
    const armor = (m, small) => (0, artkit_1.makePart)(700, 800, 380, 450, (g) => {
        if (!small) {
            (0, artkit_1.plate)(g, [[-220, -250], [40, -300], [160, -140], [120, 60], [-60, 100], [-250, 0]], p.base, { seed: 151, scratch: 7, chips: 6, lw: 32 });
            (0, artkit_1.plate)(g, [[-220, -250], [-310, -420], [-120, -290]], p.bone, { lw: 22, scratch: 0, chips: 0, band: 10 });
            (0, artkit_1.plate)(g, [[-250, 0], [-345, -60], [-240, -120]], p.bone, { lw: 22, scratch: 0, chips: 0, band: 10 });
            (0, artkit_1.rivet)(g, -100, -150, 18);
            (0, artkit_1.rivet)(g, 40, -60, 18);
        }
        else {
            (0, artkit_1.plate)(g, [[-30, -180], [150, -130], [190, -10], [60, 50], [-60, -20]], p.metal, { seed: 152, scratch: 5, chips: 4 });
            (0, artkit_1.plate)(g, [[150, -130], [190, -260], [80, -160]], p.bone, { lw: 20, scratch: 0, chips: 0, band: 8 });
        }
    }, m);
    const cheek = (m) => (0, artkit_1.makePart)(260, 440, 130, 170, (g) => {
        (0, artkit_1.plate)(g, [[-50, -110], [60, -60], [70, 130], [-30, 170], [-80, 30]], p.metalDark, { seed: 161, scratch: 3, chips: 3, lw: 26 });
        (0, artkit_1.plate)(g, [[-30, 170], [10, 250], [40, 150]], p.bone, { lw: 18, scratch: 0, chips: 0, band: 8 });
    }, m);
    return {
        chassis, core, shell, jawL: jaw(false), jawR: jaw(true), rotorL: rotor(false), rotorR: rotor(true),
        armL: arm(false, false), armR: arm(true, true), fingerL: finger(false, false), fingerR: finger(true, true),
        armorL: armor(false, false), armorR: armor(true, true), cheekL: cheek(false), cheekR: cheek(true),
    };
}
/* ======================= 04 CORE SENTINEL / OPERATOR ======================= */
function sentinelFamily(p, seed) {
    const chassis = (0, artkit_1.makePart)(1300, 1100, 650, 520, (g) => {
        (0, artkit_1.plate)(g, [[-440, -290], [440, -290], [520, -40], [400, 300], [0, 490], [-400, 300], [-520, -40]], p.base, { seed: seed + 1, scratch: 6, chips: 5 });
        (0, artkit_1.plate)(g, [[-340, -210], [340, -210], [420, -30], [320, 250], [0, 390], [-320, 250], [-420, -30]], p.dark, { seed: seed + 2, scratch: 2, chips: 2, lw: 24 });
        (0, artkit_1.disc)(g, 0, -70, 150, '#0d1217', 24);
        (0, artkit_1.ring)(g, 0, -70, 150, 24, p.metal);
        (0, artkit_1.ring)(g, 0, 180, 215, 40, p.metalDark);
        (0, artkit_1.disc)(g, 0, 180, 185, '#071017', 14);
        for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2 + Math.PI / 4;
            (0, artkit_1.strut)(g, Math.cos(a) * 185, 180 + Math.sin(a) * 185, Math.cos(a) * 112, 180 + Math.sin(a) * 112, 14, p.metalLight);
        }
        (0, artkit_1.lightStrip)(g, -330, -165, 150, 18, p.accent);
        (0, artkit_1.lightStrip)(g, 180, -165, 150, 18, p.accent);
        [[-400, -240], [400, -240], [-440, 100], [440, 100], [-250, 300], [250, 300]].forEach(([x, y]) => (0, artkit_1.rivet)(g, x, y, 17));
    });
    const core = (0, artkit_1.makePart)(440, 440, 220, 220, (g) => {
        (0, artkit_1.ring)(g, 0, 0, 150, 14, p.accent);
        (0, artkit_1.ring)(g, 0, 0, 106, 12, p.metalLight);
        const gr = g.createRadialGradient(-14, -14, 4, 0, 0, 76);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.35, p.accent2);
        gr.addColorStop(1, p.accent);
        g.beginPath();
        g.arc(0, 0, 74, 0, Math.PI * 2);
        g.fillStyle = gr;
        g.fill();
        g.lineWidth = 14;
        g.strokeStyle = artkit_1.OUT;
        g.stroke();
    });
    const shell = (0, artkit_1.makePart)(900, 640, 450, 420, (g) => {
        (0, artkit_1.plate)(g, [[-380, 60], [-340, -200], [-250, -340], [-270, -30]], p.dark, { seed: seed + 5, scratch: 3, chips: 2 });
        (0, artkit_1.plate)(g, [[380, 60], [340, -200], [250, -340], [270, -30]], p.dark, { seed: seed + 6, scratch: 3, chips: 2 });
        (0, artkit_1.plate)(g, [[-230, 60], [-130, -90], [0, -260], [130, -90], [230, 60], [120, 110], [-120, 110]], p.base, { seed: seed + 7, scratch: 5, chips: 4 });
        (0, artkit_1.lightStrip)(g, -14, -170, 28, 150, p.accent);
        (0, artkit_1.lightStrip)(g, -316, -150, 14, 70, p.accent);
        (0, artkit_1.lightStrip)(g, 302, -150, 14, 70, p.accent);
    });
    const jaw = (m) => (0, artkit_1.makePart)(340, 320, 110, 110, (g) => {
        (0, artkit_1.plate)(g, [[-60, -50], [70, -50], [140, 0], [150, 100], [100, 150], [60, 90], [-60, 70]], p.metal, { seed: seed + 8, scratch: 2, chips: 2, lw: 26 });
        (0, artkit_1.lightStrip)(g, 10, -28, 80, 14, p.accent);
        (0, artkit_1.joint)(g, 0, 0, 28, p.accent);
    }, m);
    const rotor = (m) => (0, artkit_1.makePart)(340, 340, 170, 170, (g) => {
        (0, artkit_1.ring)(g, 0, 0, 105, 24, p.metal);
        for (let k = 0; k < 3; k++) {
            const a = (k * Math.PI * 2) / 3;
            (0, artkit_1.disc)(g, Math.cos(a) * 105, Math.sin(a) * 105, 26, p.accent, 12);
        }
        (0, artkit_1.gearShape)(g, 0, 0, 40, 6, p.metalLight, 0.3);
    }, m);
    const arm = (m) => (0, artkit_1.makePart)(520, 760, 460, 140, (g) => {
        (0, artkit_1.piston)(g, -20, -50, -210, 90, 34, p.metalDark, p.metalLight);
        (0, artkit_1.strut)(g, 0, 0, -260, 170, 56, p.metal);
        (0, artkit_1.joint)(g, -260, 170, 34, p.accent);
        (0, artkit_1.strut)(g, -260, 170, -340, 430, 50, p.metalDark);
        (0, artkit_1.plate)(g, [[-330, 300], [-250, 330], [-230, 540], [-300, 600], [-370, 480]], p.base, { seed: seed + 9, scratch: 3, chips: 3, lw: 26 });
        (0, artkit_1.plate)(g, [[-410, 420], [-340, 410], [-330, 560], [-395, 620]], p.metalLight, { seed: seed + 10, scratch: 1, chips: 1, lw: 22 });
    }, m);
    const armor = (m) => (0, artkit_1.makePart)(440, 440, 240, 230, (g) => {
        (0, artkit_1.plate)(g, [[-190, -170], [60, -190], [140, -60], [120, 140], [-60, 170], [-200, 40]], p.base, { seed: seed + 11, scratch: 5, chips: 4 });
        (0, artkit_1.lightStrip)(g, -120, -90, 150, 16, p.accent);
        (0, artkit_1.rivet)(g, 70, 90, 15);
    }, m);
    const cheek = (m) => (0, artkit_1.makePart)(260, 520, 130, 250, (g) => {
        (0, artkit_1.plate)(g, [[-70, -200], [60, -200], [80, 200], [-60, 220]], p.base, { seed: seed + 12, scratch: 3, chips: 2, lw: 28 });
        (0, artkit_1.lightStrip)(g, 28, -150, 16, 300, p.accent);
    }, m);
    return {
        chassis, core, shell, jawL: jaw(false), jawR: jaw(true), rotorL: rotor(false), rotorR: rotor(true),
        armL: arm(false), armR: arm(true), armorL: armor(false), armorR: armor(true), cheekL: cheek(false), cheekR: cheek(true),
    };
}
const artCache = {};
/** Prerendered part art is immutable and may be shared; all MUTABLE state lives in each fighter's presentation. */
function buildRigArt(id) {
    const hit = artCache[id];
    if (hit)
        return hit;
    let a;
    switch (id) {
        case 'scout':
            a = scout();
            break;
        case 'bulwark':
            a = bulwark();
            break;
        case 'reaver':
            a = reaver();
            break;
        case 'sentinel':
            a = sentinelFamily(exports.PALS.sentinel, 200);
            break;
        default:
            a = sentinelFamily(exports.PALS.operator, 300);
            break;
    }
    artCache[id] = a;
    return a;
}

},
"/art/weaponArt":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEAPON_OUT = void 0;
exports.getWeaponSprite = getWeaponSprite;
exports.pickupGlow = pickupGlow;
const weapons_1 = require("../weapons");
const artkit_1 = require("./artkit");
/** Weapon sprites. Origin (0,0) = grip point, barrel extends along +x. */
const cache = {};
function getWeaponSprite(t) {
    const hit = cache[t];
    if (hit)
        return hit;
    const def = weapons_1.WEAPONS[t];
    let art;
    switch (t) {
        case 'pistol':
            art = (0, artkit_1.makePart)(900, 520, 240, 260, (g) => {
                // slide + barrel
                (0, artkit_1.plate)(g, [[-30, -80], [520, -80], [650, -60], [650, 20], [-30, 30]], '#4a5663', { seed: 11, scratch: 5, chips: 3 });
                (0, artkit_1.plate)(g, [[-60, -40], [220, -40], [220, 150], [100, 260], [-60, 200]], '#2d3641', { seed: 12, scratch: 2, chips: 2 });
                (0, artkit_1.lightStrip)(g, 250, -50, 220, 22, def.color);
                (0, artkit_1.slots)(g, 330, -20, 160, 40, 2);
                (0, artkit_1.strut)(g, 560, -30, 650, -30, 40, '#9aa3ab');
                (0, artkit_1.rivet)(g, 20, -20, 16);
                (0, artkit_1.disc)(g, 640, -28, 26, '#10161c', 10);
                (0, artkit_1.disc)(g, 640, -28, 12, def.color, 6);
            });
            break;
        case 'smg':
            art = (0, artkit_1.makePart)(1200, 640, 330, 300, (g) => {
                (0, artkit_1.plate)(g, [[-260, -60], [-120, -90], [-120, 50], [-250, 60]], '#394350', { seed: 21, scratch: 2, chips: 2 }); // stock
                (0, artkit_1.plate)(g, [[-120, -100], [560, -110], [610, -70], [610, 30], [-120, 60]], '#55616f', { seed: 22, scratch: 6, chips: 4 });
                (0, artkit_1.plate)(g, [[140, 40], [270, 40], [300, 260], [160, 280]], '#2a313a', { seed: 23, scratch: 2, chips: 2 }); // mag
                (0, artkit_1.plate)(g, [[-80, 40], [60, 40], [20, 190], [-90, 170]], '#2d3641', { seed: 24, scratch: 1, chips: 1 }); // grip
                (0, artkit_1.strut)(g, 560, -50, 880, -50, 46, '#8e98a2');
                (0, artkit_1.strut)(g, 640, -50, 640, -50, 10, '#222');
                (0, artkit_1.lightStrip)(g, 40, -75, 300, 22, def.color);
                (0, artkit_1.slots)(g, 380, -60, 150, 60, 3);
                (0, artkit_1.disc)(g, 878, -50, 26, '#10161c', 10);
                (0, artkit_1.rivet)(g, -40, -20, 16);
            });
            break;
        case 'rail':
            art = (0, artkit_1.makePart)(1500, 520, 260, 260, (g) => {
                (0, artkit_1.plate)(g, [[-200, -70], [200, -90], [300, -60], [300, 40], [-200, 50]], '#4d5966', { seed: 31, scratch: 5, chips: 3 });
                (0, artkit_1.strut)(g, 280, -70, 1220, -70, 36, '#aeb6be');
                (0, artkit_1.strut)(g, 280, 10, 1220, 10, 36, '#8a949e');
                for (let x = 420; x < 1150; x += 160) {
                    (0, artkit_1.plate)(g, [[x, -110], [x + 60, -110], [x + 60, 50], [x, 50]], '#2d3641', { seed: x, scratch: 0, chips: 0, lw: 22 });
                    (0, artkit_1.disc)(g, x + 30, -30, 16, def.color, 8);
                }
                (0, artkit_1.lightStrip)(g, -120, -60, 300, 24, def.color);
                (0, artkit_1.plate)(g, [[-80, 40], [60, 40], [20, 200], [-90, 180]], '#2d3641', { seed: 32, scratch: 1, chips: 1 });
                (0, artkit_1.disc)(g, 1224, -30, 28, '#10161c', 10);
                (0, artkit_1.disc)(g, 1224, -30, 12, def.color, 6);
            });
            break;
        case 'storm':
        default:
            art = (0, artkit_1.makePart)(1300, 640, 280, 300, (g) => {
                (0, artkit_1.plate)(g, [[-180, -110], [420, -140], [560, -90], [560, 60], [-180, 80]], '#6a5a2a', { seed: 41, scratch: 6, chips: 4 });
                (0, artkit_1.plate)(g, [[360, -80], [900, -70], [1010, -40], [1010, 10], [360, 30]], '#3e4756', { seed: 42, scratch: 4, chips: 3 });
                for (let i = 0; i < 4; i++) {
                    const x = 420 + i * 140;
                    (0, artkit_1.disc)(g, x, -25, 44, '#f1c34a', 14);
                    (0, artkit_1.disc)(g, x, -25, 20, def.color, 8);
                }
                (0, artkit_1.lightStrip)(g, -120, -90, 380, 24, def.color);
                (0, artkit_1.plate)(g, [[-100, 60], [60, 60], [10, 230], [-110, 210]], '#3a2f14', { seed: 43, scratch: 1, chips: 1 });
                (0, artkit_1.disc)(g, 1010, -15, 32, '#0d1218', 10);
                (0, artkit_1.disc)(g, 1010, -15, 16, def.color, 6);
                const spikes = [[520, -140], [600, -230], [650, -120]];
                (0, artkit_1.plate)(g, spikes, '#f1c34a', { lw: 22, scratch: 0, chips: 0 });
            });
            break;
    }
    cache[t] = art;
    return art;
}
/** pickups use a brighter backing glow so they read on the floor */
function pickupGlow(t) {
    return (0, artkit_1.shade)(weapons_1.WEAPONS[t].color, 0);
}
exports.WEAPON_OUT = artkit_1.OUT;

},
"/presentation":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobotPresentation = void 0;
const constants_1 = require("./constants");
const spring_1 = require("./spring");
const vfx_1 = require("./vfx");
const mat_1 = require("./mat");
const weapons_1 = require("./weapons");
const robots_1 = require("./art/robots");
const weaponArt_1 = require("./art/weaponArt");
const P_DEAD = { calTh: -0.3, calDx: -10, crest: 42, chin: 16, cheekX: -8, lid: 1, glow: 0.04 };
/**
 * RobotPresentation — one instance PER FIGHTER. Owns an isolated spring collection, event queue,
 * pose controller and VFX state. Reads authoritative gameplay state; never mutates gameplay.
 */
class RobotPresentation {
    constructor(fighter, layout, art, audio, lookupPickup = () => null) {
        this.fighter = fighter;
        this.layout = layout;
        this.art = art;
        this.audio = audio;
        this.lookupPickup = lookupPickup;
        this.springs = (0, constants_1.makeSprings)();
        this.vfx = new vfx_1.FighterVFX();
        this.queue = [];
        this.clock = 0;
        this.dead = false;
        this.turnN = 0;
        this.lastEvent = '—';
        this.a1 = 'none';
        this.a2 = 'none';
        this.a1Token = 0;
        this.poseTarget = { ...constants_1.BASE };
        this.timeline = [];
        this.tunes = [];
        this.prevVx = 0;
        this.prevVy = 0;
        this.ax = 0;
        this.ay = 0;
        this.extraTh = [0, 0];
        this.extraSpin = [0, 0];
        this.tiltTarget = 0;
        // Dedicated secondary motors. They do not affect the collision body, skill timing or weapon ownership.
        this.fingerMotors = [new spring_1.Spring(0, 19, 0.66), new spring_1.Spring(0, 21, 0.68)];
        this.opticMotor = new spring_1.Spring(0, 18, 0.78);
        this.balanceMotor = new spring_1.Spring(0, 15, 0.69);
        this.awareness = 0;
        this.motionEnergy = 0;
        this.gaitPhase = 0;
        this.actionImpulse = 0;
        const S = this.springs;
        this.structural = [...S.calTh, ...S.calDx, ...S.calDy, ...S.spin, S.crest, S.chin, S.cheekX, S.cheekY];
        this.optical = [S.lid, S.glow, S.seam];
        this.bodyExtra = [S.coreX, S.coreY, S.rootX, S.rootY, S.tilt];
        this.lastX = fighter.x;
        this.lastY = fighter.y;
        this.lastHeading = fighter.heading;
        this.phaseOffset = (Array.from(fighter.id).reduce((n, ch) => n * 33 + ch.charCodeAt(0), 5381) % 97) / 97 * Math.PI * 2;
        this.applyPose(fighter.weapon ? constants_1.P_HELD : constants_1.P_IDLE);
        for (const s of (0, constants_1.allSprings)(S)) {
            s.x = s.g;
        }
        S.glow.x = 1;
        this.computeTransforms();
    }
    /** world -> presentation: the bus delivers events here; only this fighter's events are queued */
    enqueue(e) {
        if (e.fighterId === this.fighter.id)
            this.queue.push(e);
    }
    resetMotion() {
        this.lastX = this.fighter.x;
        this.lastY = this.fighter.y;
        this.prevVx = 0;
        this.prevVy = 0;
        this.ax = 0;
        this.ay = 0;
        this.awareness = 0;
        this.motionEnergy = 0;
        this.gaitPhase = 0;
        this.actionImpulse = 0;
        for (const motor of [...this.fingerMotors, this.opticMotor, this.balanceMotor])
            motor.snapTo(0);
    }
    get poseName() {
        if (this.dead)
            return 'DEAD';
        if (this.a2 === 'lock')
            return 'A2_LOCK';
        if (this.a2 === 'index')
            return 'A2_INDEX';
        if (this.a1 === 'focus')
            return 'A1_FOCUS';
        if (this.a1 === 'commit')
            return 'A1_COMMIT';
        if (this.a1 === 'contact')
            return 'A1_CONTACT';
        return this.fighter.weapon ? 'HELD' : 'IDLE';
    }
    /* ============================== simulation =============================== */
    step(dt) {
        this.clock += dt;
        const q = this.queue.splice(0, this.queue.length);
        for (const e of q)
            this.handleEvent(e);
        this.runTimeline();
        this.updateMotion(dt);
        this.applyTargets();
        this.applyTuning();
        for (const s of (0, constants_1.allSprings)(this.springs))
            s.step(dt);
        for (const motor of [...this.fingerMotors, this.opticMotor, this.balanceMotor])
            motor.step(dt);
        this.actionImpulse *= Math.exp(-dt * 7.8);
        this.vfx.update(dt, this.clock, this.fighter.x, this.fighter.y);
        this.computeTransforms();
    }
    after(delay, fn) {
        this.timeline.push({ at: this.clock + delay, fn });
    }
    runTimeline() {
        if (!this.timeline.length)
            return;
        const due = this.timeline.filter((t) => t.at <= this.clock + 1e-9);
        if (!due.length)
            return;
        this.timeline = this.timeline.filter((t) => t.at > this.clock + 1e-9);
        due.sort((a, b) => a.at - b.at).forEach((t) => t.fn());
    }
    addTune(start, end, w, z, scope) {
        this.tunes.push({ start, end, w, z, scope });
    }
    applyTuning() {
        this.tunes = this.tunes.filter((t) => this.clock < t.end);
        const pick = (scopes) => {
            let best = null;
            for (const t of this.tunes) {
                if (!scopes.includes(t.scope) || this.clock < t.start)
                    continue;
                if (!best || t.start >= best.start)
                    best = t;
            }
            return best;
        };
        const apply2 = (list, t) => {
            for (const s of list) {
                if (t)
                    s.set(t.w, t.z);
                else
                    s.reset();
            }
        };
        apply2(this.structural, pick(['pose', 'body']));
        apply2(this.optical, pick(['pose']));
        apply2(this.bodyExtra, pick(['body']));
    }
    /** pose application = updating spring TARGETS only; unspecified channels revert to BASE */
    applyPose(p) {
        this.poseTarget = { ...constants_1.BASE, ...p };
    }
    resolvePose() {
        if (this.dead)
            return P_DEAD;
        if (this.a2 === 'lock')
            return constants_1.P_A2_LOCK;
        if (this.a2 === 'index')
            return constants_1.P_A2_INDEX;
        if (this.a1 === 'focus')
            return constants_1.P_A1_FOCUS;
        if (this.a1 === 'commit')
            return constants_1.P_A1_COMMIT;
        if (this.a1 === 'contact')
            return constants_1.P_A1_CONTACT;
        return this.fighter.weapon ? constants_1.P_HELD : constants_1.P_IDLE;
    }
    /** movement inertia derived from the authoritative fighter position (fixed-step) */
    updateMotion(dt) {
        const f = this.fighter;
        const S = this.springs;
        const nvx = (f.x - this.lastX) / dt;
        const nvy = (f.y - this.lastY) / dt;
        this.ax = (0, mat_1.mix)(this.ax, (nvx - this.prevVx) / dt, 0.2);
        this.ay = (0, mat_1.mix)(this.ay, (nvy - this.prevVy) / dt, 0.2);
        this.prevVx = nvx;
        this.prevVy = nvy;
        this.lastX = f.x;
        this.lastY = f.y;
        const dashing = f.dashVel !== null;
        S.lagX.g = (0, mat_1.clamp)(-this.ax * 0.0016 - (dashing ? nvx * 0.009 : 0), -46, 46);
        S.lagY.g = (0, mat_1.clamp)(-this.ay * 0.0016 - (dashing ? nvy * 0.009 : 0), -40, 40);
        if (dashing) {
            const dh = (0, mat_1.wrapAngle)(f.heading - this.lastHeading);
            this.turnN = (0, mat_1.clamp)(dh / dt / 4, -1, 1);
            this.extraTh = [this.turnN * 0.11, -this.turnN * 0.11];
            this.extraSpin = [this.turnN * 0.6, -this.turnN * 0.6];
            this.tiltTarget = (0, mat_1.clamp)(this.turnN * 0.05, -0.06, 0.06);
        }
        else {
            const k = 1 - Math.exp(-dt * 9);
            this.turnN = (0, mat_1.mix)(this.turnN, 0, k);
            this.extraTh = [(0, mat_1.mix)(this.extraTh[0], 0, k), (0, mat_1.mix)(this.extraTh[1], 0, k)];
            this.extraSpin = [(0, mat_1.mix)(this.extraSpin[0], 0, k), (0, mat_1.mix)(this.extraSpin[1], 0, k)];
            this.tiltTarget = (0, mat_1.mix)(this.tiltTarget, 0, k);
        }
        const speed = Math.hypot(nvx, nvy);
        const normalizedSpeed = (0, mat_1.clamp)(speed / Math.max(1, this.layout.speed), 0, 1.5);
        const response = 1 - Math.exp(-dt * 5.8);
        this.motionEnergy = (0, mat_1.mix)(this.motionEnergy, normalizedSpeed, response);
        this.gaitPhase += dt * (2.0 + normalizedSpeed * 7.0);
        // Awareness comes from real aim and world velocity. It stays independent of chassis heading.
        const aimDelta = (0, mat_1.wrapAngle)(f.aim - this.lastHeading);
        this.awareness = (0, mat_1.mix)(this.awareness, (0, mat_1.clamp)(aimDelta, -1, 1), 1 - Math.exp(-dt * 3.2));
        this.lastHeading = f.heading;
    }
    applyTargets() {
        this.applyPose(this.resolvePose());
        const t = this.poseTarget;
        const S = this.springs;
        const c = this.clock;
        const alive = this.dead ? 0 : 1;
        const id = this.layout.id;
        const locked = this.a2 === 'lock' ? 0.18 : 1;
        const focused = this.a1 !== 'none' || this.a2 === 'index';
        const free = alive * locked * (focused ? 0.3 : 1);
        const phase = c + this.phaseOffset;
        const movement = this.motionEnergy;
        const scout = id === 'scout';
        const bulwark = id === 'bulwark';
        const reaver = id === 'reaver';
        const sentinel = id === 'sentinel' || id === 'operator';
        const gait = this.gaitPhase;
        const idleSweep = Math.sin(phase * (scout ? 1.8 : bulwark ? 0.78 : reaver ? 1.42 : 1.0));
        const balance = (0, mat_1.clamp)(this.ax * 0.00009, -1, 1);
        // Separate phase and frequency for each mechanical subsystem; avoid synchronized floating/bobbing.
        const scan = free * (scout ? 0.05 : reaver ? 0.035 : bulwark ? 0.008 : 0.014);
        const stride = free * movement * (scout ? 0.12 : reaver ? 0.16 : bulwark ? 0.027 : 0.045);
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? 1 : -1;
            const counter = Math.sin(gait + i * Math.PI);
            S.calTh[i].g = t.calTh + (this.fighter.weapon ? (i === 0 ? .13 : .13) : 0) + this.extraTh[i]
                + scan * (0.6 * Math.sin(phase * 2.7 + i * 1.9) + 0.4 * idleSweep * side)
                + stride * counter + balance * side * free * 0.035;
            S.calDx[i].g = t.calDx + free * (scout ? 7 : reaver ? 9 : bulwark ? 2 : 3) * Math.sin(phase * 1.35 + i * 2.4)
                + movement * free * (reaver ? 19 : scout ? 12 : 5) * Math.cos(gait + i * Math.PI);
            S.calDy[i].g = t.calDy + free * (scout ? 8 : reaver ? 11 : 3) * Math.sin(phase * 1.7 + i * 2.2)
                + movement * free * 8 * Math.sin(gait + i * Math.PI);
            S.spin[i].g = t.spin + this.extraSpin[i] + free * (scout ? 0.11 : reaver ? 0.07 : 0.023) * Math.sin(phase * 1.95 + i * 2.6);
            const grasp = this.fighter.weapon ? -0.44 : reaver ? 0.16 : scout ? 0.10 : 0;
            this.fingerMotors[i].g = alive * (grasp + free * (scout ? .20 : reaver ? .26 : .055) * Math.sin(phase * (scout ? 3.1 : 2.1) + i * 2.45)
                + movement * free * .085 * counter + this.actionImpulse * side * .10);
        }
        S.crest.g = t.crest + free * (scout ? 6 : reaver ? 7 : bulwark ? 1.5 : 3) * Math.sin(phase * 1.08 + 0.7)
            - free * movement * (scout ? 5 : reaver ? 7 : 2);
        S.chin.g = t.chin + free * (reaver ? 5 : scout ? 3 : 1.2) * Math.sin(phase * 1.47 + 2.2);
        S.cheekX.g = t.cheekX + free * (bulwark ? 3 : 4.5) * Math.sin(phase * .96 + .3);
        S.cheekY.g = t.cheekY + free * (bulwark ? 1 : 4) * Math.cos(phase * 1.27);
        S.lid.g = t.lid + free * (sentinel ? .055 : .035) * (0.5 + 0.5 * Math.sin(phase * 2.2));
        S.glow.g = t.glow + alive * (.045 * Math.sin(phase * 2.1) + this.actionImpulse * .07);
        S.seam.g = t.seam;
        S.coreX.g = free * (sentinel ? 6 : 2) * Math.sin(phase * 1.3) + this.balanceMotor.x * 7;
        S.coreY.g = free * (sentinel ? 8 : 3) * Math.sin(phase * 1.77 + 1.6);
        S.rootX.g = 0;
        S.rootY.g = 0;
        S.tilt.g = this.tiltTarget + free * balance * .018;
        S.gunKick.g = 0;
        S.ped.g = (0, mat_1.clamp)(S.lagX.x * 0.006, -0.5, 0.5);
        this.opticMotor.g = free * (0, mat_1.clamp)(this.awareness * (sentinel ? .12 : .07) + scan * idleSweep, -.2, .2);
        this.balanceMotor.g = free * (0, mat_1.clamp)(-balance * .28 + movement * Math.sin(gait) * .08, -.3, .3);
    }
    /* ================================ events ================================= */
    sfx(c) { this.audio?.play(c); }
    hitSide(point, dir) {
        const dx = point.x - this.fighter.x;
        if (dx < -6)
            return 0;
        if (dx > 6)
            return 1;
        return dir.x > 0 ? 0 : 1;
    }
    handleEvent(e) {
        // Edge light is an event cue, never an always-on movement shader.
        // Glow comes exclusively from real A2 armor activity; ordinary collisions/shots/A1 do not light the outline.
        const S = this.springs;
        const d = e.data ?? {};
        const c = this.clock;
        this.lastEvent = e.type;
        switch (e.type) {
            case 'RobotA1Lock': {
                const tok = ++this.a1Token;
                this.a1 = 'focus';
                this.actionImpulse = Math.max(this.actionImpulse, .8);
                this.fingerMotors[0].kick(.10);
                this.fingerMotors[1].kick(-.10);
                this.addTune(c, c + 0.1, 46, 0.75, 'pose');
                this.vfx.brackets = { targetId: d.targetId, t0: c, weaponName: d.weaponName ?? '' };
                this.sfx('lock');
                this.after(0.13, () => {
                    if (tok !== this.a1Token)
                        return;
                    this.a1 = 'commit';
                    this.addTune(this.clock, this.clock + 0.14, 64, 0.56, 'pose');
                    this.vfx.flash(this.clock, 0.16, '#ffe6a0', 230);
                });
                break;
            }
            case 'RobotA1DashLaunch':
                this.vfx.trailActive = true;
                this.balanceMotor.kick(.22);
                this.actionImpulse = 1;
                // A1 launch: trail-only feedback, never full-character flash.
                this.sfx('launch');
                break;
            case 'RobotA1Contact': {
                const tok = ++this.a1Token;
                this.vfx.trailActive = false;
                this.vfx.brackets = null;
                this.a1 = 'contact';
                this.fingerMotors[0].kick(-.18);
                this.fingerMotors[1].kick(.18);
                // short mechanical impact as the real weapon seats in the socket
                S.rootY.kick(34);
                S.calDx[0].kick(14);
                S.calDx[1].kick(14);
                S.crest.kick(-10);
                S.chin.kick(-8);
                S.gunKick.kick(-9);
                S.coreY.kick(8);
                this.addTune(c, c + 0.12, 64, 0.56, 'pose');
                const g = this.socketWorld();
                this.vfx.sparks(g.x, g.y, 0, 1, 12, '#ffd27a', 420);
                this.vfx.flash(c, 0.14, '#ffd27a', 150);
                this.sfx('contact');
                this.after(0.3, () => { if (tok === this.a1Token)
                    this.a1 = 'none'; });
                break;
            }
            case 'RobotA1Fail':
                this.a1Token++;
                this.vfx.trailActive = false;
                this.vfx.brackets = null;
                this.a1 = 'none';
                this.vfx.cue(c, `A1 FAILED: ${String(d.reason).toUpperCase()}`, '#ff8a5c');
                this.vfx.smoke(this.fighter.x, this.fighter.y, 5);
                break;
            case 'RobotA1NoWeapon':
                this.vfx.cue(c, 'NO WEAPON', '#ff5c5c');
                S.lid.kick(0.25);
                this.sfx('nowep');
                break;
            case 'RobotA2Start':
                this.armorGlowBegan = this.clock;
                this.armorImpactDarkUntil = 0;
                this.a2 = 'index';
                this.actionImpulse = .55;
                this.sfx('a2start');
                this.after(0.16, () => {
                    this.a2 = 'lock';
                    this.addTune(this.clock, this.clock + 0.16, 66, 0.6, 'pose');
                    this.springs.seam.snapTo(1);
                    // A2 uses sustained armor glow, not a one-shot white flash.
                    this.transmitLock();
                    this.sfx('a2lock');
                });
                break;
            case 'RobotA2End':
                this.a2 = 'none';
                // End A2 by gradually extinguishing glow.
                this.vfx.smoke(this.fighter.x, this.fighter.y - 20, 6, 'rgba(220,235,255,0.4)');
                this.vfx.ring(c, 0.5, '#9fd8ff', 'RELEASE');
                this.sfx('a2end');
                break;
            case 'RobotA2Hit':
                // Reset A2 lighting only; retain every original armor impact spring impulse.
                this.armorImpactDarkUntil = this.clock + 0.28;
                this.onArmoredHit(d);
                break;
            case 'FighterHit':
                this.onUnarmoredHit(d);
                break;
            case 'WeaponFired':
                this.onFire(d);
                break;
            case 'WeaponEquipped':
                if (d.via !== 'dash') {
                    S.calDx[0].kick(10);
                    S.calDx[1].kick(10);
                    S.gunKick.kick(-6);
                    this.sfx('equip');
                }
                break;
            case 'WeaponDropped':
            case 'WeaponDepleted':
                this.vfx.smoke(this.fighter.x, this.fighter.y + 20, 4);
                break;
            case 'FighterWallImpact': {
                const dir = d.direction ?? { x: 0, y: 0 };
                const F = Math.min(2.1, Math.max(.3, Number(d.strength) || .3));
                const side = dir.x >= 0 ? 1 : 0;
                S.rootX.kick(-dir.x * 135 * F);
                S.rootY.kick(-dir.y * 110 * F);
                S.calTh[side].kick(-.14 * F);
                S.calTh[1 - side].kick(.065 * F);
                S.calDx[side].kick(-54 * F);
                S.calDx[1 - side].kick(37 * F);
                S.coreX.kick(-dir.x * 19 * F);
                S.crest.kick(-15 * F);
                S.tilt.kick(-dir.x * .07 * F);
                this.fingerMotors[side].kick(.16 * F);
                this.fingerMotors[1 - side].kick(-.08 * F);
                this.balanceMotor.kick(-dir.x * .12 * F);
                this.addTune(c, c + .17, 16, .42, 'body');
                this.after(.19, () => this.addTune(this.clock, this.clock + .13, 65, .62, 'body'));
                this.vfx.sparks(this.fighter.x, this.fighter.y, -dir.x, -dir.y, 18, '#ffcf83', 410);
                this.vfx.ring(c, .22, '#e9ad65');
                this.sfx('hit');
                break;
            }
            case 'FighterStunned':
                S.glow.kick(-0.6);
                S.lid.kick(0.6);
                S.tilt.kick(0.05);
                this.vfx.ring(c, 0.45, '#b9d4ff', 'STUN');
                this.sfx('stun');
                break;
            case 'FighterDied': {
                this.dead = true;
                this.vfx.trailActive = false;
                this.vfx.brackets = null;
                const f = this.fighter;
                this.vfx.sparks(f.x, f.y, 0, 1, 26, '#ffcf6a', 700);
                this.vfx.fragments(f.x, f.y, 0, 1, 14, this.fragColors());
                this.vfx.smoke(f.x, f.y, 12, 'rgba(60,60,66,0.5)');
                this.sfx('death');
                break;
            }
            case 'RobotPassiveMilestone':
                this.vfx.ring(c, 0.6, '#ffd24a', `BURST M${d.milestone}`);
                this.sfx('milestone');
                break;
            case 'RobotPassiveUpgrade':
                this.vfx.ring(c, 0.9, '#6dffb0', `${d.ability} -${Number(d.applied).toFixed(1)}s`);
                S.glow.kick(0.25);
                this.sfx('upgrade');
                break;
            case 'RobotBurstReset':
                this.vfx.cue(c, 'BURST RESET', '#9aa7b8');
                this.sfx('reset');
                break;
            default:
                break;
        }
    }
    fragColors() {
        const p = robots_1.PALS[this.layout.id];
        return [p.base, p.metal, p.metalDark, p.light];
    }
    /** 9A — UNARMORED: loses composure and recoils */
    onUnarmoredHit(d) {
        const S = this.springs;
        const F = d.damageBeforeArmor > 80 ? 2 : 1;
        const dir = d.direction;
        const hs = this.hitSide(d.point, dir);
        const os = 1 - hs;
        S.rootX.kick(dir.x * 120 * F);
        S.rootY.kick(dir.y * 90 * F);
        S.calTh[hs].kick(-0.17 * F);
        S.calDx[hs].kick(30 * F);
        S.calDx[os].kick(-40 * F);
        S.calTh[os].kick(0.08 * F);
        S.coreX.kick(dir.x * 24 * F);
        S.crest.kick(-22 * F);
        S.tilt.kick(dir.x * 0.08 * F);
        S.glow.kick(-0.85);
        S.lid.kick(0.5);
        S.ped.kick(0.2 * F);
        this.fingerMotors[hs].kick(-.24 * F);
        this.fingerMotors[os].kick(.12 * F);
        this.balanceMotor.kick((0, mat_1.clamp)(dir.x * .15 * F, -.4, .4));
        // looser response for 0.34 s, then brief recalibration
        const c = this.clock;
        this.addTune(c, c + 0.34, 14, 0.3, 'body');
        this.addTune(c + 0.34, c + 0.46, 68, 0.62, 'body');
        this.vfx.sparks(d.point.x, d.point.y, dir.x, dir.y, 9 + 5 * F, '#ffd27a');
        this.vfx.fragments(d.point.x, d.point.y, dir.x, dir.y, 3 + 2 * F, this.fragColors());
        this.vfx.smoke(d.point.x, d.point.y, 2);
        // bullet hit uses physical impulse and local impact particles, no character flash.
        this.sfx('hit');
    }
    /** 9B — ARMORED: impact is routed through the locked structure (pivot -> latch -> opposite pivot) */
    onArmoredHit(d) {
        const S = this.springs;
        const F = d.damageBeforeArmor > 80 ? 2 : 1;
        const dir = d.direction;
        const hs = this.hitSide(d.point, dir);
        const os = 1 - hs;
        const pivot = (0, mat_1.apply)(hs === 0 ? this.xf.pL : this.xf.pR, 0, 0);
        const above = d.point.y < pivot.y ? 1 : -1;
        S.calDx[hs].kick(34 * F);
        S.calTh[hs].kick(0.07 * F * above);
        S.spin[hs].kick(0.85 * F);
        S.rootX.kick(dir.x * 16 * F);
        S.rootY.kick(dir.y * 16 * F);
        S.crest.kick(14 * F);
        S.chin.kick(-6 * F);
        S.glow.kick(0.3);
        this.fingerMotors[hs].kick(.065 * F);
        this.balanceMotor.kick((0, mat_1.clamp)(dir.x * .045 * F, -.18, .18));
        const heavy = F > 1.5;
        const delay = heavy ? 0.13 : 0.085;
        const c = this.clock;
        this.after(delay, () => {
            this.springs.calDx[os].kick(22 * F);
            this.springs.spin[os].kick(0.6 * F);
            this.springs.coreX.kick(-dir.x * 6 * F);
        });
        // VFX travels along the structural path, not an all-body explosion
        const root = this.xf.root;
        const rootInv = (0, mat_1.invert)(root);
        const pHit = hs === 0 ? this.xf.pLLocal : this.xf.pRLocal;
        const pOpp = hs === 0 ? this.xf.pRLocal : this.xf.pLLocal;
        this.vfx.pulse(c, rootInv, d.point, pHit, this.xf.latchLocal, pOpp, delay, this.layout.seamColor);
        this.vfx.sparks(d.point.x, d.point.y, dir.x, dir.y, 5, '#bfeaff', 380);
        if (heavy) {
            // strong armored impact: short strain, limited tilt, structural recovery pulse
            S.tilt.kick((0, mat_1.clamp)(dir.x * 0.03 * F, -0.06, 0.06));
            this.addTune(c + 0.22, c + 0.34, 70, 0.6, 'body');
            this.after(0.22, () => this.vfx.recoveryPulse(this.clock, this.xf.latchLocal, this.layout.seamColor));
        }
        this.sfx('a2hit');
    }
    /** actual weapon fire: ONE impulse set; propagates into socket, chassis, core and pivots */
    onFire(d) {
        const S = this.springs;
        const k = d.k ?? 1;
        const side = Math.cos(d.aim) >= 0 ? 1 : -1; // recoil is opposite to the barrel direction
        S.gunKick.kick(-11 * k);
        S.rootX.kick(-22 * k * side);
        S.coreY.kick(7 * k);
        S.crest.kick(9 * k);
        S.calTh[1].kick(-0.035 * k);
        S.calTh[0].kick(0.022 * k);
        S.spin[0].kick(0.3 * k);
        S.spin[1].kick(0.3 * k);
        S.glow.kick(0.12);
        S.ped.kick(0.08 * k);
        this.fingerMotors[0].kick(-.05 * k);
        this.fingerMotors[1].kick(.035 * k);
        this.balanceMotor.kick(-.045 * k);
        this.vfx.muzzle(d.muzzle.x, d.muzzle.y, d.aim, weapons_1.WEAPONS[d.weaponType].color);
        this.sfx('fire');
    }
    /** A2 lock: structural transmission pulses pivot -> latch -> pivot */
    transmitLock() {
        const x = this.xf;
        const rootInv = (0, mat_1.invert)(x.root);
        const wl = (0, mat_1.apply)(x.root, x.pLLocal.x, x.pLLocal.y);
        const wr = (0, mat_1.apply)(x.root, x.pRLocal.x, x.pRLocal.y);
        this.vfx.pulse(this.clock, rootInv, wl, x.pLLocal, x.latchLocal, x.pRLocal, 0.1, this.layout.seamColor);
        this.vfx.pulse(this.clock, rootInv, wr, x.pRLocal, x.latchLocal, x.pLLocal, 0.1, this.layout.seamColor);
    }
    /* ============================ transform composition ======================= */
    computeTransforms() {
        const S = this.springs;
        const L = this.layout;
        const G = L.gain;
        const f = this.fighter;
        const lx = S.lagX.x;
        const ly = S.lagY.x;
        const root = (0, mat_1.mul)((0, mat_1.mul)((0, mat_1.mul)((0, mat_1.T)(f.x, f.y), (0, mat_1.Scl)(constants_1.HEAD_SCALE)), (0, mat_1.T)(S.rootX.x * G.root + lx * 0.25, S.rootY.x * G.root + ly * 0.25)), (0, mat_1.Rot)(S.tilt.x));
        const lCore = (0, mat_1.T)(L.core.x + S.coreX.x * G.core - lx * 0.3, L.core.y + S.coreY.x * G.core - ly * 0.3);
        const lShell = (0, mat_1.mul)((0, mat_1.T)(L.shell.x + lx * 0.5 * G.lag, L.shell.y + S.crest.x * G.crest + ly * 0.5 * G.lag), (0, mat_1.Rot)(this.opticMotor.x));
        const lChin = (0, mat_1.T)(L.jaw.x + lx * 0.3 * G.lag, L.jaw.y + S.chin.x * G.chin + ly * 0.3 * G.lag);
        const lJawL = (0, mat_1.mul)(lChin, (0, mat_1.mul)((0, mat_1.T)(L.jawHingeL.x + S.calDx[0].x * G.jaw * 0.35, L.jawHingeL.y), (0, mat_1.Rot)(S.calTh[0].x * G.jaw + (f.weapon ? -.16 : 0))));
        const lJawR = (0, mat_1.mul)(lChin, (0, mat_1.mul)((0, mat_1.T)(L.jawHingeR.x - S.calDx[1].x * G.jaw * 0.35, L.jawHingeR.y), (0, mat_1.Rot)(-S.calTh[1].x * G.jaw + (f.weapon ? .16 : 0))));
        const lagA = 0.8 * G.lag;
        const lPL = (0, mat_1.T)(L.shoulderL.x + S.calDx[0].x * G.dx + lx * lagA, L.shoulderL.y + S.calDy[0].x * G.dy + ly * lagA);
        const lPR = (0, mat_1.T)(L.shoulderR.x - S.calDx[1].x * G.dx + lx * lagA, L.shoulderR.y + S.calDy[1].x * G.dy + ly * lagA);
        const held = !!f.weapon;
        const flutter = 0.025 * Math.sin(this.clock * 1.9 + this.phaseOffset) * (this.dead ? 0 : 1);
        // The gun owns two receiver seats. Original arm/finger SPRITES solve to them;
        // no extra strokes, rods, hands or overlay geometry are created.
        const aim = f.aim - S.tilt.x * 0.28;
        const mountX = S.coreX.x * G.core * 0.18 + Math.cos(aim) * S.gunKick.x;
        const mountY = 490 + S.coreY.x * G.core * 0.12 + Math.sin(aim) * S.gunKick.x;
        const lWeapon = (0, mat_1.mul)((0, mat_1.T)(mountX, mountY), (0, mat_1.Rot)(aim));
        const receiverX = f.weapon?.type === 'pistol' ? -12 : -65;
        const seatL = (0, mat_1.apply)(lWeapon, receiverX, -76);
        const seatR = (0, mat_1.apply)(lWeapon, receiverX, 76);
        const solveArm = (pivot, seat, originalTip, baseAngle) => {
            if (!held) return (0, mat_1.mul)(pivot, (0, mat_1.Rot)(baseAngle));
            const origin = (0, mat_1.apply)(pivot, 0, 0);
            const targetAngle = Math.atan2(seat.y - origin.y, seat.x - origin.x);
            const originalAngle = Math.atan2(originalTip.y, originalTip.x);
            const reach = Math.hypot(seat.x-origin.x, seat.y-origin.y);
            const baseReach = Math.max(1, Math.hypot(originalTip.x,originalTip.y));
            // Uniform scaling maintains the silhouette of the EXISTING hand/arm artwork.
            const k = Math.max(.52, Math.min(1.35,reach/baseReach));
            return (0, mat_1.mul)(pivot, (0, mat_1.mul)((0, mat_1.Rot)(targetAngle-originalAngle), (0, mat_1.Scl)(k,k)));
        };
        // Some variants integrate the gripper into armL/armR (hasFingers=false).
        const tipL = L.hasFingers ? L.fingerL : {x:-260,y:350};
        const tipR = L.hasFingers ? L.fingerR : {x:260,y:350};
        const lArmL = solveArm(lPL,seatL,tipL,S.calTh[0].x*G.th);
        const lArmR = solveArm(lPR,seatR,tipR,-S.calTh[1].x*G.th);
        const lRotL = (0, mat_1.mul)(lPL, (0, mat_1.Rot)(S.spin[0].x));
        const lRotR = (0, mat_1.mul)(lPR, (0, mat_1.Rot)(S.spin[1].x));
        const lArmorL = (0, mat_1.mul)(lPL, (0, mat_1.mul)((0, mat_1.T)(L.armorL.x, L.armorL.y), (0, mat_1.Rot)(S.calTh[0].x * 0.35)));
        const lArmorR = (0, mat_1.mul)(lPR, (0, mat_1.mul)((0, mat_1.T)(L.armorR.x, L.armorR.y), (0, mat_1.Rot)(-S.calTh[1].x * 0.35)));
        const lFingL = (0, mat_1.mul)(lArmL, (0, mat_1.mul)((0, mat_1.T)(L.fingerL.x, L.fingerL.y), (0, mat_1.Rot)(S.calTh[0].x * G.finger * 0.5 + S.calDx[0].x * 0.004 + this.fingerMotors[0].x + flutter)));
        const lFingR = (0, mat_1.mul)(lArmR, (0, mat_1.mul)((0, mat_1.T)(L.fingerR.x, L.fingerR.y), (0, mat_1.Rot)(-(S.calTh[1].x * G.finger * 0.5 + S.calDx[1].x * 0.004 + this.fingerMotors[1].x - flutter))));
        const cx = S.cheekX.x * G.cheekX + S.seam.x * 60;
        const lCheekL = (0, mat_1.T)(L.cheekL.x + cx + lx * 0.7 * G.lag, L.cheekL.y + S.cheekY.x * G.cheekY + ly * 0.7 * G.lag);
        const lCheekR = (0, mat_1.T)(L.cheekR.x - cx + lx * 0.7 * G.lag, L.cheekR.y + S.cheekY.x * G.cheekY + ly * 0.7 * G.lag);
        const lRearL = (0, mat_1.mul)((0, mat_1.T)(L.rearL.x + lx * G.rear, L.rearL.y + ly * G.rear), (0, mat_1.Rot)(lx * 0.012 + flutter * 0.5));
        const lRearR = (0, mat_1.mul)((0, mat_1.T)(L.rearR.x + lx * G.rear, L.rearR.y + ly * G.rear), (0, mat_1.Rot)(lx * 0.012 - flutter * 0.5));
        const lAnt = (0, mat_1.mul)((0, mat_1.T)(L.antenna.x + lx * 0.4, L.antenna.y + ly * 0.2), (0, mat_1.Rot)(S.ped.x));
        const gA = seatL, gB = seatR;
        const midX = mountX, midY = mountY;
        const axis = aim;
        const W = (m) => (0, mat_1.mul)(root, m);
        this.xf = {
            root,
            core: W(lCore), shell: W(lShell), chin: W(lChin), jawL: W(lJawL), jawR: W(lJawR),
            pL: W(lPL), pR: W(lPR), armL: W(lArmL), armR: W(lArmR), fingL: W(lFingL), fingR: W(lFingR),
            armorL: W(lArmorL), armorR: W(lArmorR), rotL: W(lRotL), rotR: W(lRotR),
            cheekL: W(lCheekL), cheekR: W(lCheekR), rearL: W(lRearL), rearR: W(lRearR), ant: W(lAnt),
            weapon: W(lWeapon),
            gripA: gA, gripB: gB, mid: { x: midX, y: midY }, axis,
            latchLocal: { x: lx * 0.3, y: L.latchY + ly * 0.3 },
            pLLocal: (0, mat_1.apply)(lPL, 0, 0), pRLocal: (0, mat_1.apply)(lPR, 0, 0),
        };
    }
    /** world position of the weapon socket (grip midpoint + recoil) */
    socketWorld() {
        const m = this.xf.weapon;
        return { x: m[4], y: m[5] };
    }
    /** muzzle from the REAL weapon transform and barrel endpoint */
    muzzleWorld() {
        const wp = this.fighter.weapon;
        if (!wp)
            return null;
        this.computeTransforms();
        const def = weapons_1.WEAPONS[wp.type];
        return (0, mat_1.apply)(this.xf.weapon, def.muzzleX, def.muzzleY);
    }
    /* ================================= drawing =============================== */
    blit(ctx, cam, art, m) {
        if (!art)
            return;
        const t = (0, mat_1.mul)(cam, m);
        ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
        ctx.drawImage(art.canvas, -art.ox, -art.oy, art.w, art.h);
    }
    drawBody(ctx, cam) {
        const a = this.art;
        if (!a)
            return;
        const x = this.xf;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (this.dead)
            ctx.filter = 'grayscale(0.85) brightness(0.55)';
        // A small edge flash is enabled ONLY by actual ability/combat events.
        // Ordinary walking and idle do not create powered outlines.
        const armorOn = !!this.fighter.mechanics?.armorActive;
        const armorHit = armorOn && (this.armorImpactDarkUntil || 0) > this.clock;
        if (!this.dead && armorOn) {
            // Active armor sustains energized outlines; impacts briefly suppress the light.
            const ramp = Math.min(1, Math.max(0,(this.clock - (this.armorGlowBegan || this.clock)) / 0.38));
            const shimmer = 0.90 + 0.10 * Math.sin(this.clock * 5);
            // A2 impact: armor POWER drops to ordinary (unlit) appearance,
            // then restores its full light. The robot itself never darkens.
            // Avoid per-sprite Canvas filters and rapid high-frequency flashing.
            const recovery = armorHit
                ? Math.pow(Math.max(0, Math.min(1, 1 - (this.armorImpactDarkUntil - this.clock) / 0.28)), 1.5)
                : 1;
            const armorLight = ramp * shimmer * recovery;
            if (armorLight > 0.025) {
                ctx.shadowColor = this.layout.seamColor;
                ctx.shadowBlur = 23 * armorLight;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
        }
        this.blit(ctx, cam, a.rearL, x.rearL);
        this.blit(ctx, cam, a.rearR, x.rearR);
        this.blit(ctx, cam, a.antenna, x.ant);
        if (!this.fighter.weapon) {
            this.blit(ctx, cam, a.armL, x.armL);
            this.blit(ctx, cam, a.armR, x.armR);
            this.blit(ctx, cam, a.fingerL, x.fingL);
            this.blit(ctx, cam, a.fingerR, x.fingR);
        }
        this.blit(ctx, cam, a.chassis, x.root);
        this.blit(ctx, cam, a.core, x.core);
        this.blit(ctx, cam, a.cheekL, x.cheekL);
        this.blit(ctx, cam, a.cheekR, x.cheekR);
        this.blit(ctx, cam, a.armorL, x.armorL);
        this.blit(ctx, cam, a.armorR, x.armorR);
        // Equipment sits below the face: original arms grip the weapon,
        // then the optic and front shell are drawn IN FRONT to keep the face clear.
        if (this.fighter.weapon) {
            // Q3 compatibility seam: the actual Arsenal weapon is composited later by drawEquippedWeapons.
            // Suppress only the donor's surrogate weapon image; retain original arm/hand spring transforms.
            this.blit(ctx, cam, a.armL, x.armL);
            this.blit(ctx, cam, a.armR, x.armR);
            this.blit(ctx, cam, a.fingerL, x.fingL);
            this.blit(ctx, cam, a.fingerR, x.fingR);
        }
        this.drawOptic(ctx, cam);
        this.blit(ctx, cam, a.shell, x.shell);
        this.blit(ctx, cam, a.jawL, x.jawL);
        this.blit(ctx, cam, a.jawR, x.jawR);
        this.blit(ctx, cam, a.rotorL, x.rotL);
        this.blit(ctx, cam, a.rotorR, x.rotR);
        this.drawLatch(ctx, cam);
        ctx.restore();
    }
    drawWeapon(ctx, cam) {
        // Weapon is now composited between torso and gripping jaws in drawBody.
        return;
        const wp = this.fighter.weapon;
        if (!wp)
            return;
        ctx.save();
        if (this.dead)
            ctx.filter = 'grayscale(0.85) brightness(0.55)';
        // A small edge flash is enabled ONLY by actual ability/combat events.
        // Ordinary walking and idle do not create powered outlines.
        const armorOn = !!this.fighter.mechanics?.armorActive;
        const armorHit = armorOn && (this.armorImpactDarkUntil || 0) > this.clock;
        if (!this.dead && armorOn) {
            // Active armor sustains energized outlines; impacts briefly suppress the light.
            const ramp = Math.min(1, Math.max(0,(this.clock - (this.armorGlowBegan || this.clock)) / 0.38));
            const shimmer = 0.90 + 0.10 * Math.sin(this.clock * 5);
            // A2 impact: armor POWER drops to ordinary (unlit) appearance,
            // then restores its full light. The robot itself never darkens.
            // Avoid per-sprite Canvas filters and rapid high-frequency flashing.
            const recovery = armorHit
                ? Math.pow(Math.max(0, Math.min(1, 1 - (this.armorImpactDarkUntil - this.clock) / 0.28)), 1.5)
                : 1;
            const armorLight = ramp * shimmer * recovery;
            if (armorLight > 0.025) {
                ctx.shadowColor = this.layout.seamColor;
                ctx.shadowBlur = 23 * armorLight;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
        }
        ctx.imageSmoothingQuality = 'high';
        this.blit(ctx, cam, (0, weaponArt_1.getWeaponSprite)(wp.type), this.xf.weapon);
        ctx.restore();
    }
    /** live optics: shutter (lid) and intensity (glow) drive the eye geometry */
    drawOptic(ctx, cam) {
        const S = this.springs;
        const L = this.layout;
        const glow = (0, mat_1.clamp)(S.glow.x, 0, 2.4);
        const lid = (0, mat_1.clamp)(S.lid.x, 0, 1);
        const ox = S.coreX.x * 0.25;
        for (const e of L.eyes) {
            const m = (0, mat_1.mul)(this.xf.root, (0, mat_1.T)(e.x + ox, e.y + S.coreY.x * 0.15));
            ctx.save();
            const t = (0, mat_1.mul)(cam, (0, mat_1.mul)(m, (0, mat_1.Rot)(e.rot)));
            ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
            const k = Math.min(1, 0.35 + glow * 0.55);
            if (L.eyeStyle === 'lens') {
                const R = e.w * 0.5 * 0.78;
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, 0, R, 0, Math.PI * 2);
                ctx.clip();
                const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
                gr.addColorStop(0, '#ffffff');
                gr.addColorStop(0.3, L.eyeColor);
                gr.addColorStop(1, '#04202a');
                ctx.globalAlpha = k;
                ctx.fillStyle = gr;
                ctx.fillRect(-R, -R, R * 2, R * 2);
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#06090c';
                ctx.beginPath();
                ctx.arc(0, 0, R * 0.28, 0, Math.PI * 2);
                ctx.fill();
                // mechanical shutter plates
                const cover = R * lid * 1.02;
                ctx.fillStyle = '#11161c';
                ctx.strokeStyle = '#0b0b0e';
                ctx.lineWidth = 18;
                ctx.fillRect(-R - 6, -R - 6, R * 2 + 12, cover + 6);
                ctx.strokeRect(-R - 6, -R - 6, R * 2 + 12, cover + 6);
                ctx.fillRect(-R - 6, R - cover, R * 2 + 12, cover + 6);
                ctx.strokeRect(-R - 6, R - cover, R * 2 + 12, cover + 6);
                ctx.restore();
                ctx.strokeStyle = '#0b0b0e';
                ctx.lineWidth = 22;
                ctx.beginPath();
                ctx.arc(0, 0, R, 0, Math.PI * 2);
                ctx.stroke();
            }
            else {
                const hh = Math.max(7, e.h * (1 - lid * 0.85));
                ctx.globalAlpha = k;
                ctx.fillStyle = L.eyeColor;
                ctx.strokeStyle = '#0b0b0e';
                ctx.lineWidth = 16;
                ctx.beginPath();
                if (L.eyeStyle === 'skull') {
                    ctx.moveTo(-e.w / 2, -hh / 2);
                    ctx.lineTo(e.w / 2, -hh * 0.15);
                    ctx.lineTo(e.w * 0.38, hh / 2);
                    ctx.lineTo(-e.w / 2, hh * 0.12);
                }
                else {
                    ctx.rect(-e.w / 2, -hh / 2, e.w, hh);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, glow * 0.35)})`;
                ctx.fillRect(-e.w * 0.38, -hh * 0.14, e.w * 0.7, Math.max(3, hh * 0.28));
            }
            // additive glow
            ctx.globalCompositeOperation = 'lighter';
            const gr2 = ctx.createRadialGradient(0, 0, 0, 0, 0, e.w * (L.eyeStyle === 'lens' ? 0.95 : 0.85));
            gr2.addColorStop(0, L.glowColor);
            gr2.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = (0, mat_1.clamp)(0.1 + glow * 0.22, 0, 0.7);
            ctx.fillStyle = gr2;
            ctx.beginPath();
            ctx.arc(0, 0, e.w * (L.eyeStyle === 'lens' ? 0.95 : 0.85), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    /** the visible structural latch: pivot -> central latch -> pivot (armor lock channel `seam`) */
    drawLatch(ctx, cam) {
        const seam = (0, mat_1.clamp)(this.springs.seam.x, 0, 1.2);
        if (seam < 0.03)
            return;
        const x = this.xf;
        const t = (0, mat_1.mul)(cam, x.root);
        ctx.save();
        ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
        ctx.globalAlpha = Math.min(1, seam * 1.4);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const pts = [x.pLLocal, x.latchLocal, x.pRLocal];
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.strokeStyle = '#0b0b0e';
        ctx.lineWidth = 62;
        ctx.stroke();
        ctx.strokeStyle = this.layout.seamColor;
        ctx.lineWidth = 30;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 9;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pts[1].x, pts[1].y, 52, 0, Math.PI * 2);
        ctx.fillStyle = '#16181c';
        ctx.fill();
        ctx.lineWidth = 22;
        ctx.strokeStyle = '#0b0b0e';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pts[1].x, pts[1].y, 28, 0, Math.PI * 2);
        ctx.fillStyle = this.layout.seamColor;
        ctx.fill();
        ctx.restore();
    }
    /** world-space effects drawn above the body: particles, trail, structural pulses, flashes, brackets */
    drawEffects(ctx, view) {
        const cam = view.cam;
        ctx.save();
        ctx.setTransform(cam[0], cam[1], cam[2], cam[3], cam[4], cam[5]);
        this.vfx.drawWorld(ctx, view.zoom);
        this.vfx.drawPulses(ctx, this.clock, this.xf.root);
        // flashes at the optic
        for (const fl of this.vfx.flashes) {
            const k = 1 - (this.clock - fl.t0) / fl.dur;
            if (k <= 0)
                continue;
            const o = (0, mat_1.apply)(this.xf.root, 0, -40);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, fl.r * 0.5);
            g.addColorStop(0, fl.color);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = Math.min(1, k * 1.2);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(o.x, o.y, fl.r * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // passive rings
        for (const r of this.vfx.rings) {
            const k = (this.clock - r.t0) / r.dur;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = r.color;
            ctx.globalAlpha = Math.max(0, 1 - k);
            ctx.lineWidth = 4 / view.zoom;
            ctx.beginPath();
            ctx.arc(this.fighter.x, this.fighter.y, 80 + k * 110, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        // A1 target brackets + measurement
        const b = this.vfx.brackets;
        if (b) {
            const tgt = this.lookupPickup(b.targetId);
            if (tgt) {
                const age = this.clock - b.t0;
                const settle = Math.max(0, 1 - age / 0.3);
                const s = 62 + settle * 70;
                const rot = settle * 0.9;
                const o = this.socketWorld();
                ctx.save();
                ctx.strokeStyle = '#ffd24a';
                ctx.shadowColor = '#ffb000';
                ctx.shadowBlur = 8;
                ctx.lineWidth = 4 / view.zoom;
                ctx.setLineDash([16 / view.zoom, 12 / view.zoom]);
                ctx.beginPath();
                ctx.moveTo(o.x, o.y);
                ctx.lineTo(tgt.x, tgt.y);
                ctx.stroke();
                ctx.setLineDash([]);
                const dx = tgt.x - o.x;
                const dy = tgt.y - o.y;
                const dist = Math.hypot(dx, dy);
                const n = Math.floor(dist / 100);
                for (let i = 1; i <= n; i++) {
                    const px = o.x + (dx / dist) * i * 100;
                    const py = o.y + (dy / dist) * i * 100;
                    ctx.beginPath();
                    ctx.moveTo(px - (dy / dist) * 12, py + (dx / dist) * 12);
                    ctx.lineTo(px + (dy / dist) * 12, py - (dx / dist) * 12);
                    ctx.stroke();
                }
                ctx.translate(tgt.x, tgt.y);
                ctx.rotate(rot);
                ctx.lineWidth = 6 / view.zoom;
                const c = s * 0.38;
                for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                    ctx.beginPath();
                    ctx.moveTo(sx * s, sy * (s - c));
                    ctx.lineTo(sx * s, sy * s);
                    ctx.lineTo(sx * (s - c), sy * s);
                    ctx.stroke();
                }
                ctx.restore();
                // measurement label (screen space)
                const mid = (0, mat_1.apply)(cam, (o.x + tgt.x) / 2, (o.y + tgt.y) / 2);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.font = `700 ${12 * view.dpr}px ui-monospace, Menlo, Consolas, monospace`;
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ffd24a';
                ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.lineWidth = 3 * view.dpr;
                const label = `LOCK ${b.weaponName} · ${Math.round(dist)}u`;
                ctx.strokeText(label, mid.x, mid.y - 10 * view.dpr);
                ctx.fillText(label, mid.x, mid.y - 10 * view.dpr);
            }
        }
        // text cues + ring labels (screen space)
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.textAlign = 'center';
        ctx.font = `800 ${14 * view.dpr}px ui-sans-serif, system-ui, sans-serif`;
        const base = (0, mat_1.apply)(cam, this.fighter.x, this.fighter.y - 170);
        this.vfx.cues.forEach((c) => {
            const age = this.clock - c.t0;
            const a = Math.max(0, 1 - age / 1.4);
            ctx.globalAlpha = a;
            ctx.fillStyle = c.color;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = 4 * view.dpr;
            const y = base.y - age * 26 * view.dpr;
            ctx.strokeText(c.text, base.x, y);
            ctx.fillText(c.text, base.x, y);
        });
        this.vfx.rings.forEach((r, i) => {
            if (!r.text)
                return;
            const age = this.clock - r.t0;
            ctx.globalAlpha = Math.max(0, 1 - age / r.dur);
            ctx.fillStyle = r.color;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = 3 * view.dpr;
            ctx.font = `800 ${12 * view.dpr}px ui-sans-serif, system-ui, sans-serif`;
            const y = base.y + 26 * view.dpr + i * 14 * view.dpr - age * 18 * view.dpr;
            ctx.strokeText(r.text, base.x, y);
            ctx.fillText(r.text, base.x, y);
        });
        ctx.restore();
    }
    /** compact diagnostics for the Test Lab */
    debug() {
        const S = this.springs;
        return {
            pose: this.poseName,
            lagX: +S.lagX.x.toFixed(2),
            lagY: +S.lagY.x.toFixed(2),
            calTh0: +S.calTh[0].x.toFixed(3),
            calTh1: +S.calTh[1].x.toFixed(3),
            calDx0: +S.calDx[0].x.toFixed(1),
            calDx1: +S.calDx[1].x.toFixed(1),
            spin0: +S.spin[0].x.toFixed(2),
            spin1: +S.spin[1].x.toFixed(2),
            seam: +S.seam.x.toFixed(2),
            tilt: +S.tilt.x.toFixed(3),
            gunKick: +S.gunKick.x.toFixed(1),
        };
    }
}
exports.RobotPresentation = RobotPresentation;

}
};

// Q3 Gold V12 presentation adapter, isolated from the donor's AI/combat/lab.
// The modules above are lifted from the byte-exact owner donor at
// docs/quest/donors/APEX_CHAOS_QUEST1_DEEPER_WEAPON_GRIP_V12.html.
// One deliberate seam in /presentation suppresses the donor's simulated gun
// image. All original layered sprite artwork, spring constants, grip transforms,
// local motions and impact impulses remain sourced from the owner file.
const __cache={};
function __req(name){
  if(!name.startsWith('/'))throw Error('V12 external module '+name);
  if(__cache[name])return __cache[name].exports;
  const fn=__modules[name];
  if(!fn)throw Error('V12 missing presentation module '+name);
  const mod={exports:{}};__cache[name]=mod;
  const dir=name.slice(0,name.lastIndexOf('/')+1);
  fn(spec=>{
    const path=spec.startsWith('.')?(dir+spec).split('/'):spec.split('/');
    const stack=[];
    for(const part of path){
      if(part==='..')stack.pop();
      else if(part&&part!=='.')stack.push(part);
    }
    return __req('/'+stack.join('/'));
  },mod,mod.exports);
  return mod.exports;
}
const {RobotPresentation}=__req('/presentation');
const {LAYOUTS}=__req('/layouts');
const {buildRigArt}=__req('/art/robots');
let actors=new WeakMap();
let faulty=new WeakSet();
const stats={attempts:0,draws:0,instances:0,failed:0,realHitEvents:0,realRecoilEvents:0,operatorDraws:0,facingByQuestId:{},lastError:null};
function draw(ctx,real) {
  const variant=real?.questVisualId;
  if(!variant||!['scout','bulwark','reaver','sentinel','operator'].includes(variant)||!ctx?.getTransform)return false;
  if(faulty.has(real))return false;
  stats.attempts++;
  try {
    const ar=root.APEX_ARSENAL;
    const now=Number(ar?.state?.time)||0;
    const holder=ar?.weaponApi?.getHolder?.(real);
    let record=actors.get(real);
    if(!record) {
      const shadow={
        id:'v12:'+String(real.questId||real.id), x:real.x,y:real.y,vx:0,vy:0,
        heading:-Math.PI/2,aim:-Math.PI/2,alive:real.hp>0,weapon:null,
        mechanics:null
      };
      const presentation=new RobotPresentation(shadow,LAYOUTS[variant],buildRigArt(variant),null);
      record={shadow,presentation,lastHp:real.hp,lastNow:now,lastPulses:null,lastAlive:true,hitEvents:0,recoilEvents:0,deathEvents:0,scale:0,scaleFactor:1};
      actors.set(real,record);stats.instances++;
    }
    const {shadow,presentation}=record;
    const pulses=Number(holder?.meta?.pose?.pulses);
    const equipped=!!holder?.weaponId;
    shadow.x=Number(real.x)||0;shadow.y=Number(real.y)||0;
    shadow.weapon=equipped?{type:'pistol'}:null; // presence only: never an invented Arsenal weapon
    shadow.alive=Number(real.hp)>0;
    if(Number.isFinite(real.hp)&&real.hp<record.lastHp){
      const hit=real.__aqImpact;
      const vx=Number(hit?.vx),vy=Number(hit?.vy);
      const l=Number.isFinite(vx)&&Number.isFinite(vy)?(Math.hypot(vx,vy)||1):1;
      const direction=Number.isFinite(vx)&&Number.isFinite(vy)?{x:vx/l,y:vy/l}:{x:0,y:-1};
      presentation.enqueue({
        type:'FighterHit',fighterId:shadow.id,
        data:{point:{x:Number(hit?.x)||shadow.x,y:Number(hit?.y)||shadow.y},
          direction,damageBeforeArmor:record.lastHp-real.hp}
      });
      stats.realHitEvents++;record.hitEvents++;
    }
    if(Number.isFinite(pulses)&&record.lastPulses!=null&&pulses>record.lastPulses&&equipped){
      // Arsenal's actual pose pulse count is the firing authority.
      presentation.enqueue({
        type:'WeaponFired',fighterId:shadow.id,
        data:{k:1,aim:shadow.aim,muzzle:{x:shadow.x,y:shadow.y},weaponType:'pistol'}
      });
      stats.realRecoilEvents++;record.recoilEvents++;
    }
    if(record.lastAlive&&!shadow.alive){
      presentation.enqueue({type:'FighterDied',fighterId:shadow.id,data:{}});
      record.deathEvents++;
    }
    record.lastHp=real.hp;record.lastAlive=shadow.alive;
    record.lastPulses=Number.isFinite(pulses)?pulses:null;
    // Never run a second combat loop; step presentation once per authoritative frame.
    const delta=Math.max(0,Math.min(0.1,now-record.lastNow));
    record.lastNow=now;
    if(delta>0)presentation.step(delta);
    ctx.save();
    // Parent Fighter.draw rotates by MOVEMENT heading. The Gold V12 rig is a
    // forward-facing chassis: cancel only that rotation; retain genuine arm,
    // optic, shell, weapon and hit spring movement from the donor.
    const dirX=Number.isFinite(real.dir?.x)?real.dir.x:1;
    const dirY=Number.isFinite(real.dir?.y)?real.dir.y:0;
    ctx.rotate(-Math.atan2(dirY,dirX));
    // Do not normalize every Gold species to the same Arsenal collision radius.
    // The donor's original proportions (Scout smaller, Bulwark broader) are
    // presentation identity; its REAL collider remains the Arsenal Fighter.
    const canonicalScale=0.93*Math.max(0.35,Math.min(1.2,(Number(real.radius)||75)/75));
    // Owner sizing for the three non-NEWBOT FIRST WAKE models: 18% smaller
    // anywhere they recur in Quest. Do not alter physical Fighter radius,
    // weapon muzzle, pathfinding or other Gold variants not yet approved.
    const ownerCompact=(variant==='operator'||variant==='scout'||variant==='bulwark');
    const ratio=canonicalScale*(ownerCompact?0.82:1);
    record.scale=ratio;
    record.scaleFactor=ownerCompact?0.82:1;
    ctx.scale(ratio,ratio);
    const m=ctx.getTransform();
    // Measured from the actual canvas matrix AFTER undoing engine movement
    // heading, not inferred from a wished-for orientation. Debug state only.
    const angle=Math.atan2(m.b,m.a);
    const identity=String(real.questId||real.id);
    stats.facingByQuestId[identity]={angle,dir:Math.atan2(dirY,dirX)};
    const cam=[m.a,m.b,m.c,m.d,m.e-m.a*shadow.x-m.c*shadow.y,m.f-m.b*shadow.x-m.d*shadow.y];
    // One source of physical pose, one source of world transform. Arsenal still
    // paints the REAL weapon on top after this fighter-body pass.
    presentation.drawBody(ctx,cam);
    ctx.restore();
    stats.draws++;
    if(variant==='operator')stats.operatorDraws++;
    root.__apexQuestV12Draws=(root.__apexQuestV12Draws||0)+1;
    return true;
  }catch(e){
    faulty.add(real);stats.failed++;
    stats.lastError=String(e?.stack||e).slice(0,1200);
    return false; // previous CP04 renderer is the fallback, not a fake PASS
  }
}
// Read-only diagnostic: Chrome acceptance can check the REAL donor springs
// without overlaying the arena, mutating the actor or inventing event cues.
function inspect(real){
  const record=real&&actors.get(real);
  if(!record)return null;
  const p=record.presentation;
  return {
    id:String(real.questId||real.id),
    variant:real.questVisualId,
    scale:record.scale,
    scaleFactor:record.scaleFactor,
    colliderRadius:Number(real.radius),
    pose:p.debug(),
    motionEnergy:p.motionEnergy,
    clock:p.clock,
    hitEvents:record.hitEvents,
    recoilEvents:record.recoilEvents,
    deathEvents:record.deathEvents,
    alive:record.shadow.alive,
    position:{x:record.shadow.x,y:record.shadow.y}
  };
}
function reset(){actors=new WeakMap();faulty=new WeakSet();stats.instances=0;stats.facingByQuestId={};}
root.APEX_QUEST_V12_RIG=Object.freeze({draw,inspect,reset,stats,sourceSha256:'3817ab8b0ab674af9573704f20173ff1edfae5e26598f843b1dd1ab422ff3685'});
root.apexQuestV12Rig='ready';
})(typeof window!=='undefined'?window:globalThis);
