#!/usr/bin/env node
// Build-time bridge only. Never load or parse authority HTML during gameplay.
//
// FROST V1 Gold bridge: extracts the hash-verified Fusion Gold engine into a
// production module (public/game/hero-rework/frostGoldV1.js) + layer PNGs.
// Keeps: math/RNG, shape systems, IceField, Frost actor rig + all skill/floor/
// shell/gun/bullet material renderers. Cuts: demo loop, camera, input, fake
// enemy/guns/bullets, showcase UI/timings. Production gameplay (frostGameplay-
// Runtime) owns all timers/truth; frostPresentationRuntime drives this module.
//
// Sections mirror the Hunter V10 bridge pattern (tools/bridgeHunterGoldV10.mjs).
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const fail = (m) => { throw new Error('[frost-bridge] ' + m); };
const ROOT = process.cwd();

// ---------- S0: Gold identity (authority 00 section 9) ----------
const GOLD = 'docs/hero-rework/frost-v1/01_OWNER_APPROVED_GOLD_REFERENCE.html';
const GOLD_BYTES = 975616;
const GOLD_SHA = '59201be3d33bdfbeb8459656d3ef37caf922382a06852bd7a609472fdce2da43';
const bytes = fs.readFileSync(path.join(ROOT, GOLD));
if (bytes.length !== GOLD_BYTES) fail(`Gold byte length ${bytes.length} !== ${GOLD_BYTES}`);
if (crypto.createHash('sha256').update(bytes).digest('hex') !== GOLD_SHA) fail('Gold SHA-256 mismatch');

// ---------- S1: isolate the engine script (extract FIRST, then cut) ----------
const blocks = bytes.toString().split('<script>');
if (blocks.length !== 3) fail(`expected 2 script blocks, saw ${blocks.length - 1}`);
let s = blocks[2].split('</script>')[0];
if (!s.includes('class FrostEngine') || !s.includes('class IceField')) fail('engine script isolate failed');

// ---------- S2: source-art layers -> files (Hunter pattern) ----------
const assetDir = 'public/assets/hero-rework/frost-v1';
fs.mkdirSync(path.join(ROOT, assetDir), { recursive: true });
const layers = [];
s = s.replace(/    (\w+): "data:image\/png;base64,([A-Za-z0-9+/=]+)"(,?)/g,
  (_, key, data, comma) => {
    layers.push(key);
    fs.writeFileSync(path.join(ROOT, assetDir, `${key}.png`), Buffer.from(data, 'base64'));
    return `    ${key}: "/assets/hero-rework/frost-v1/${key}.png"${comma}`;
  });
if (layers.length !== 9) fail(`expected 9 art layers, extracted ${layers.length}`);
if (/data:image\/png;base64/.test(s)) fail('base64 residue after asset extraction');

// ---------- helpers: brace-scoped surgery (never regex across braces) ----------
function braceEnd(text, openIdx) {
  let d = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '{') d++;
    else if (text[i] === '}') { d--; if (d === 0) return i; }
  }
  fail('unbalanced braces');
}
function classBodyRange(text) {
  const h = text.indexOf('class FrostEngine {');
  if (h < 0) fail('FrostEngine class not found');
  const open = text.indexOf('{', h);
  return [h, braceEnd(text, open) + 1];
}
// Range of a method INSIDE the class body only (same-name module fns untouched).
function methodRange(text, name) {
  const [cb0, cb1] = classBodyRange(text);
  const body = text.slice(cb0, cb1);
  const m = body.match(new RegExp(`^    (?:async )?${name}\\(`, 'm'));
  if (!m || m.index === undefined) fail(`method ${name} not found in class body`);
  const absH = cb0 + m.index;
  const open = text.indexOf('{', absH);
  let end = braceEnd(text, open) + 1;
  if (text[end] === '\n') end++;
  return [absH, end];
}
const ops = []; // {a, b, code|null}: cuts and splits applied as ONE descending pass
function cutMethod(name) { const [a, b] = methodRange(s, name); ops.push({ a, b, code: null }); }
function splitMethod(name, code) { const [a, b] = methodRange(s, name); ops.push({ a, b, code }); }
function applyOps() {
  ops.sort((x, y) => y.a - x.a);
  for (let i = 1; i < ops.length; i++) {
    if (ops[i].b > ops[i - 1].a) fail(`overlapping ops at ${ops[i].a}..${ops[i].b} vs ${ops[i - 1].a}..${ops[i - 1].b}`);
  }
  for (const { a, b, code } of ops) s = s.slice(0, a) + (code === null ? '' : code) + s.slice(b);
  ops.length = 0;
}
// Exact small replacement with fail-loud count assertion.
function repOnce(needle, repl, what) {
  const n = s.split(needle).length - 1;
  if (n !== 1) fail(`${what}: expected 1 occurrence, saw ${n}`);
  s = s.replace(needle, repl);
}
function repCount(needle, repl, want, what) {
  const n = s.split(needle).length - 1;
  if (n !== want) fail(`${what}: expected ${want} occurrences, saw ${n}`);
  s = s.split(needle).join(repl);
}

// ---------- S3: cut the demo boot/UI tail (loop close, input, showcase) ----------
{
  const tail = s.indexOf("const canvas=document.getElementById('frost-canvas');");
  if (tail < 0) fail('demo tail anchor not found');
  s = s.slice(0, tail);
}

// ---------- S4: cut demo-only methods (class-scoped; IceField.render etc kept) ----------
for (const m of ['reset', 'toggleSlow', 'toggleClose', 'toggleFloor', 'toggleEnemyArmed',
  'manualFire', 'emitState', 'defaultAim', 'castL', 'updateFetch', 'inputDir', 'step',
  'gunAim', 'gunSlotPos', 'updateEnemy', 'updateBullets', 'start', 'stop', 'resize',
  'screenToWorld', 'render', 'drawFloor']) cutMethod(m);
// NOTE: drawEnemy/drawGun/drawBullets/fireShot/bulletHit/updateGuns are SPLITS
// in S5, not cuts. Every method below must appear in exactly one op.

// ---------- S5: splits (demo method -> production entry, Gold-verbatim core) ----------
// Gold line numbers cited per replacement for audit (script-file lines).
splitMethod('fireShot', `    muzzle(g, mx, my) {
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
`);
splitMethod('bulletHit', `    hitPatch(cx, cy, R, ang) {
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
`);
// NOTE: updateEnemy is cut in S4; updateCrusts is inserted at the updateGuns
// site below alongside updateGunVisual (both derive from updateGuns/updateEnemy).
splitMethod('updateGuns', `    updateGunVisual(g, dt, target) {
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
`);
splitMethod('drawEnemy', `    drawTargetFrost(ctx, x, y, R, px, seizeT) {
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
            ctx.fillStyle = \`rgba(150,205,240,\${0.38 * chill})\`;
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
`);
splitMethod('drawGun', `    drawGunFrost(ctx, g, px, clipFn) {
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
            ctx.fillStyle = \`rgba(165,215,245,\${0.3 * f})\`;
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
                ctx.strokeStyle = \`rgba(255,255,255,\${0.9 * f})\`;
                ctx.stroke();
            }
        }
        ctx.restore();
    }
`);
splitMethod('drawBullets', `    drawBulletFrost(ctx, x, y, a, px) {
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
`);
applyOps();
// ---------- S6: trims (exact, fail-loud) ----------
// -- constructor: drop demo canvas param, demo fields, dead keys; production ice coverage
repOnce('    constructor(canvas) {', '    constructor() {', 'ctor header');
repOnce('        this.ice = new IceField(ARENA_W, ARENA_H);',
  '        this.ice = new IceField(2000, 2000); // facet/sheen pattern covers the 1000x1000 world',
  'ice coverage');
{
  const dead = ['acc', 'last', 'raf', 'keys', 'mouse', 'timeScale', 'timeScaleGoal',
    'closeUp', 'darkProof', 'zoomBlend', 'camX', 'camY', 'vw', 'vh', 'aim',
    'ex', 'ey', 'evx', 'evy', 'ehomeX', 'ehomeY', 'eFace', 'eSeize', 'eChill',
    'bullets', 'fire', 'canvas', 'ctx', 'floorGun', 'enemyGun'];
  const re = new RegExp(`^        this\\.(${dead.join('|')}) = .*$\\n`, 'gm');
  const [ctor0, ctor1] = methodRange(s, 'constructor');
  const ctorSlice = s.slice(ctor0, ctor1);
  const found = (ctorSlice.match(re) || []).map((l) => l.trim().slice(0, 70));
  if (found.length !== 30) fail(`ctor dead-field lines: expected 30, saw ${found.length}`);
  s = s.slice(0, ctor0) + ctorSlice.replace(re, '') + s.slice(ctor1);
}
repOnce('        this.eCrusts = [];', '        this.crusts = [];', 'crust field');
repCount('wps: [], ', '', 1, 'wps key');
repCount('wi: 0, ', '', 2, 'wi key');
repCount('dist: 0, ', '', 2, 'dist key');
repCount('endAt: 0, ', '', 2, 'endAt key');
repCount('contactT: 0, ', '', 1, 'contactT key');
repCount(', manual: false', '', 2, 'manual key');
// -- castA1: production passes the snapshotted cast angle
repOnce('    castA1() {', '    castA1(ang) {', 'castA1 header');
repOnce('        const a = this.defaultAim();', '        const a = ang;', 'castA1 aim');
// -- buildLane: gameplay owns len/travel/expiry
repOnce('    buildLane(t0) {', '    buildLane(t0, len, travel) {', 'buildLane header');
repOnce(`        const A = this.a1;
        const v = this.ventWorld();`,
  `        const A = this.a1;
        len = len || 440;
        const v = this.ventWorld();`, 'buildLane default');
repOnce(`        // lane length clamped by arena bounds
        let L = 440;
        for (let d = 0; d < 440; d += 10) {
            const x = A.ox + ca * d, y = A.oy + sa * d;
            if (Math.abs(x) > ARENA_W / 2 - 30 || Math.abs(y) > ARENA_H / 2 - 30) {
                L = d;
                break;
            }
        }
        A.len = L;`,
  `        // Production lane length is gameplay truth (passed in).
        A.len = len;`, 'buildLane clamp');
repOnce('        const travel = 0.62 * Math.sqrt(L / 440);',
  '        travel = (typeof travel === \'number\' ? travel : 0.62 * Math.sqrt(len / 440));', 'buildLane travel');
repOnce('        for (let d = 0; d <= L; d += step) {',
  '        for (let d = 0; d <= len; d += step) {', 'buildLane loop');
repOnce('            const s = d / L;', '            const s = d / len;', 'buildLane s');
repOnce(`        this.ice.scheduleDecay((n) => n.kind === "lane" && A.nodes.some((q) => q.n === n), A.endT + 3.6, 1.0, (n) => {
            const q = A.nodes.find((k) => k.n === n);
            return 1 - q.s;
        });`,
  `        // Production: presentation schedules lane decay from real gameplay expiry.`, 'buildLane decay');
// -- updateA1: no demo body kick; production lane dims
repOnce(`            this.fvx -= ca * 70;
            this.fvy -= sa * 70;
`, '', 'updateA1 body kick');
repOnce('            this.buildLane(this.t + 0.03);',
  '            this.buildLane(this.t + 0.03, this.a1Len, this.a1Travel);', 'updateA1 build call');
// -- castA2: cut the demo homing route (method-scoped)
{
  const [cb0, cb1] = classBodyRange(s);
  const body = s.slice(cb0, cb1);
  const m = body.match(/^    castA2\(\) \{$/m);
  if (!m || m.index === undefined) fail('castA2 not found');
  const mAbs = cb0 + m.index;
  const mOpen = s.indexOf('{', mAbs);
  const mEnd = braceEnd(s, mOpen);
  const start = s.indexOf('        const P = { x: this.fx, y: this.fy };\n', mAbs);
  const stop = s.indexOf('        ];\n', start);
  if (start < 0 || stop < 0 || stop > mEnd) fail('castA2 route block not found');
  s = s.slice(0, start) + s.slice(stop + '        ];\n'.length);
}
repOnce(`        this.fvx *= 0.3;
        this.fvy *= 0.3;
`, '', 'castA2 velocity damp');
// -- kickOff: angle from real mirrored velocity; no demo launch impulse
repOnce(`        const A = this.a2;
        const w = A.wps[0];
        const a = Math.atan2(w.y - this.fy, w.x - this.fx);
        const ca = Math.cos(a), sa = Math.sin(a);
        A.kicked = true;
        this.sx.goal = 1;
        this.sy.goal = 1;
        this.sx.kick(-1.6);
        this.sy.kick(1.8);
        this.fvx = ca * 400;
        this.fvy = sa * 400;
        this.lagX.kick(-ca * 160);`,
  `        const A = this.a2;
        const a = Math.atan2(this.fvy, this.fvx);
        const ca = Math.cos(a), sa = Math.sin(a);
        A.kicked = true;
        this.sx.goal = 1;
        this.sy.goal = 1;
        this.sx.kick(-1.6);
        this.sy.kick(1.8);
        this.lagX.kick(-ca * 160);`, 'kickOff head');
// -- updateA2: cut pre-kick damp, steering, demo contact detect, demo end
repOnce(`        if (!A.kicked) {
            this.fvx *= Math.exp(-12 * dt);
            this.fvy *= Math.exp(-12 * dt);
            if (T >= 0.13)
                this.kickOff();
            return;
        }`,
  `        if (!A.kicked) {
            if (T >= 0.13)
                this.kickOff();
            return;
        }`, 'updateA2 pre-kick');
{
  const [cb0, cb1] = classBodyRange(s);
  const body = s.slice(cb0, cb1);
  const m = body.match(/^    updateA2\(dt\) \{$/m);
  if (!m || m.index === undefined) fail('updateA2 not found');
  const mAbs = cb0 + m.index;
  const mOpen = s.indexOf('{', mAbs);
  const mEnd = braceEnd(s, mOpen);
  const start = s.indexOf('        // steering: manual arrows override the authored route; motion is fully simulated\n', mAbs);
  const stop = s.indexOf('        const sp = Math.hypot(this.fvx, this.fvy);\n', mAbs);
  if (start < 0 || stop < 0 || stop > mEnd || stop < start) fail('updateA2 steering block not found');
  s = s.slice(0, start) + s.slice(stop);
}
repOnce(`        const cosA = sp > 1 ? (dx * this.fvx + dy * this.fvy) / sp : 1;
        const brake = cosA < 0.3 ? 0.72 : 1; // loading the edge through a hard turn
        this.fvx = damp(this.fvx, dx * maxS * brake, A.contact ? 0.25 : 0.11, dt);
        this.fvy = damp(this.fvy, dy * maxS * brake, A.contact ? 0.25 : 0.11, dt);
`, '', 'updateA2 velocity drive');
repOnce(`        // CONTACT
        const cdx = this.ex - this.fx, cdy = this.ey - this.fy;
        const cd = Math.hypot(cdx, cdy);
        if (!A.contact && cd < FROST_R + ENEMY_R)
            this.contact(cdx / cd, cdy / cd);
        const endNow = (A.contact && this.t - A.contactT > 0.42) || T > (A.manual ? 3.0 : 3.8);
        if (endNow)
            this.endA2();
`, '', 'updateA2 demo contact/end');
// -- contact: real normal/point/proxy; no demo physics
repOnce('    contact(nx, ny) {', '    contact(nx, ny, px, py, proxy) {', 'contact header');
repOnce(`        A.contact = true;
        A.contactT = this.t;
        const px = this.ex - nx * ENEMY_R, py = this.ey - ny * ENEMY_R;
`, `        A.contact = true;
`, 'contact head');
repOnce(`        this.fvx = -nx * 90 + -ny * tang * 0.2;
        this.fvy = -ny * 90 + nx * tang * 0.2;
`, '', 'contact body response');
repOnce(`        const tang = -nx * this.fvy + ny * this.fvx;
`, '', 'contact tang');
repOnce(`        this.evx += nx * 170;
        this.evy += ny * 170;
        this.eSeize = this.t;
`, '', 'contact enemy shove');
repOnce('        if (this.enemyGun && this.enemyGun.owner === "enemy" && !this.gunSlot) {',
  '        if (proxy && !this.gunSlot) {', 'contact steal guard');
repOnce(`            const g = this.enemyGun;
            g.owner = "transfer";`,
  `            const g = proxy;
            g.owner = "transfer";
            g.a0 = g.a;`, 'contact steal proxy');
// -- endA2: presentation schedules decay from real segment lifetimes
repOnce(`        const trail = A.trail.slice();
        const N = trail.length;
        const idx = new Map();
        trail.forEach((n, i) => idx.set(n, i / Math.max(1, N - 1)));
        this.ice.scheduleDecay((n) => idx.has(n), this.t + 2.3, 1.3, (n) => idx.get(n));
        for (const c of this.ice.carves)
            if (c.decayAt === Infinity)
                c.decayAt = this.t + 2.3 + 0.9;
`, '', 'endA2 decay');
// -- freezeEnemy: real target (R, x, y) + real freeze duration (Gold ratios kept)
repOnce('    freezeEnemy(hitAng) {', '    freezeEnemy(hitAng, R, tx, ty, dur) {', 'freezeEnemy header');
repOnce('        const R = ENEMY_R;\n', '', 'freezeEnemy R');
repOnce('        const patch = this.ice.add(this.ex, this.ey + 6, hitAng, R * 1.28, R * 1.22, this.t + 0.05, "patch", { lockDur: 0.4, jag: 0.2 });',
  '        const patch = this.ice.add(tx, ty + 6, hitAng, R * 1.28, R * 1.22, this.t + 0.05, "patch", { lockDur: 0.4, jag: 0.2 });', 'freezeEnemy patch');
repOnce('            cracks: [{ pts: c1, at: this.t + 2.05, w: 1.7 }, { pts: c2, at: this.t + 2.35, w: 1.3 }],',
  '            cracks: [{ pts: c1, at: this.t + dur * (2.05 / 2.6), w: 1.7 }, { pts: c2, at: this.t + dur * (2.35 / 2.6), w: 1.3 }],', 'freezeEnemy cracks');
repOnce('            thawT: this.t + 2.6, done: false, patch, released: false,',
  '            thawT: this.t + dur, done: false, patch, released: false, x: tx, y: ty, R,', 'freezeEnemy shell');
repOnce('        patch.decayAt = this.t + 3.4;', '        patch.decayAt = this.t + dur * (3.4 / 2.6);', 'freezeEnemy patch decay');
repOnce('            spawnLobe(this.ex + Math.cos(a) * R, this.ey + Math.sin(a) * R, a, 6, 4.5, 0.5, i * 0.02);',
  '            spawnLobe(tx + Math.cos(a) * R, ty + Math.sin(a) * R, a, 6, 4.5, 0.5, i * 0.02);', 'freezeEnemy lobes');
// -- updateShell: track the real target; no demo enemy response
repOnce('            chipCluster(this.ex + c[0], this.ey + c[1], S.hitAng, 0.8, 3, 110, 3.6);',
  '            chipCluster(S.x + c[0], S.y + c[1], S.hitAng, 0.8, 3, 110, 3.6);', 'updateShell crack chips');
repOnce('                        chipCluster(this.ex + p.cx, this.ey + p.cy, Math.atan2(p.cy, p.cx), 0.6, 2, 150, 3.5);',
  '                        chipCluster(S.x + p.cx, S.y + p.cy, Math.atan2(p.cy, p.cx), 0.6, 2, 150, 3.5);', 'updateShell plate chips');
repOnce(`        if (S.released && !S.done && S.plates.every((p) => p.released && t > p.released)) {
            S.done = true;
            this.eSeize = t; // target returns with a shake
            this.evx += rnd(-30, 30);
            this.evy += rnd(-30, 30);
            this.eChill = 0;
        }`,
  `        if (S.released && !S.done && S.plates.every((p) => p.released && t > p.released)) {
            S.done = true;
        }`, 'updateShell done');
// -- drawShell: real shell radius (exact lines; the demo const dies in S7)
repOnce('if (Math.hypot(ax, ay) > ENEMY_R * 1.02 && Math.hypot(bx2, by2) > ENEMY_R * 1.02) {',
  'if (Math.hypot(ax, ay) > S.R * 1.02 && Math.hypot(bx2, by2) > S.R * 1.02) {', 'drawShell rim');
repOnce('ctx.arc(0, 0, ENEMY_R * 1.17, S.hitAng', 'ctx.arc(0, 0, S.R * 1.17, S.hitAng', 'drawShell ring');
// -- load: cache immutable decode work (Hunter pattern: single-flight + stats)
repOnce(`    async load() {
        await Promise.all(LAYERS.map((k) => new Promise((res, rej) => {`,
  `    async load() {
        if (loadPromise) return loadPromise;
        cacheStats.loadCalls++;
        return (loadPromise = (async () => {
        await Promise.all(LAYERS.map((k) => new Promise((res, rej) => {`, 'load guard');
repOnce(`        this.shadowCanvas = sh;
        this.ready = true;
    }`,
  `        this.shadowCanvas = sh;
        this.ready = true;
        })());
    }`, 'load close');
// -- eCrusts -> crusts (cut regions already gone; contact site remains)
repCount('this.eCrusts', 'this.crusts', 1, 'crust rename');

// ---------- S7: cut demo-only module consts ----------
for (const line of ['const ARENA_W = 1480, ARENA_H = 820;\n',
  'const FROST_R = 34, ENEMY_R = 41;\n', 'const DT = 1 / 120;\n']) repOnce(line, '', `const cut ${line.slice(6, 16)}`);

// ---------- S8: residue checks (word-bound; no false positives) ----------
// Strip comments first: split-insert comments cite Gold lineage (e.g. the
// updateGuns law) as documentation. Residue means remaining demo CODE.
function stripComments(text) {
  let out = '', i = 0, q = null;
  while (i < text.length) {
    const ch = text[i], nx = text[i + 1];
    if (q) {
      out += ch;
      if (ch === '\\') { out += nx; i += 2; continue; }
      if (ch === q) q = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; out += ch; i++; continue; }
    if (ch === '/' && nx === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (ch === '/' && nx === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue; }
    out += ch; i++;
  }
  return out;
}
const code = stripComments(s);
const residue = ['requestAnimationFrame', 'getElementById', 'querySelector',
  'addEventListener', 'castL', 'updateFetch', 'defaultAim', 'inputDir', 'gunAim',
  'gunSlotPos', 'emitState', 'onState', 'manualFire', 'toggleSlow', 'toggleClose',
  'toggleFloor', 'toggleEnemyArmed', 'updateGuns', 'updateEnemy', 'updateBullets',
  'drawEnemy', 'drawFloor', 'screenToWorld', 'runAuto', 'stopAuto', 'updateUi',
  'toggleUI', 'autoTimers', 'floorGun', 'enemyGun', 'closeUp', 'darkProof',
  'zoomBlend', 'camX', 'camY', 'timeScale', 'ehome', 'eFace', 'eSeize', 'eChill',
  'eCrusts', 'ENEMY_R', 'FROST_R', 'ARENA_W', 'ARENA_H', 'actions',
  'this\\.ex\\b', 'this\\.ey\\b', 'this\\.evx\\b', 'this\\.evy\\b', 'this\\.bullets\\b',
  'this\\.fire\\b', 'this\\.keys\\b', 'this\\.mouse\\b', 'this\\.acc\\b', 'this\\.last\\b',
  'this\\.raf\\b', 'this\\.vw\\b', 'this\\.vh\\b', 'this\\.aim\\b', 'this\\.canvas\\b',
  'this\\.ctx\\b', '\\bwps\\b', '\\bmanual\\b', '\\bendAt\\b', '\\bDT\\b', '\\blater\\b'];
for (const r of residue) {
  const m = code.match(new RegExp(r.indexOf('\\') === 0 || r.startsWith('this') ? r : `\\b${r}\\b`));
  if (m) fail(`demo residue: ${r} (near: ${JSON.stringify(code.slice(Math.max(0, m.index - 60), m.index + 60))})`);
}
// Positive checks: every kept entry must exist.
for (const name of ['constructor', 'mkGun', 'load', 'castA1', 'ventWorld',
  'buildLane', 'updateA1', 'castA2', 'kickOff', 'carve', 'updateA2', 'contact',
  'endA2', 'muzzle', 'hitPatch', 'freezeEnemy', 'updateShell', 'updateIdle',
  'updateGunVisual', 'updateCrusts', 'drawA1MacroFront', 'drawFrostShadow',
  'drawFrost', 'drawVentGlow', 'drawPreCore', 'drawBreathCore', 'drawTargetFrost',
  'drawShell', 'drawGunFrost', 'drawBulletFrost']) methodRange(s, name);
for (const fn of ['const rnd =', 'const rng', 'const R = new Rng',
  'class IceField', 'function updateShapes', 'function drawFloorShapes',
  'function drawAirShapes', 'function drawRibbonLayer', 'function clearShapes',
  'function mkCanvas', 'function mipChain', 'function pick']) {
  if (!s.includes(fn)) fail(`missing kept module entry: ${fn}`);
}

// ---------- S9: footer, compile check, write ----------
s += `
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
`;
try {
  new Function('window', 'document', s);
} catch (e) {
  fail('output fails to parse: ' + (e && e.message));
}
s = s.replace(/^[ \t]+$/gm, '');
fs.writeFileSync(path.join(ROOT, 'public/game/hero-rework/frostGoldV1.js'),
  '// Generated from hash-verified Frost Gold Fusion by tools/bridgeFrostGoldV1.mjs.\n(function(){\n' + s + '\n})();\n');
console.log(`[frost-bridge] OK: 9 layers, ${s.length} module chars -> public/game/hero-rework/frostGoldV1.js`);
