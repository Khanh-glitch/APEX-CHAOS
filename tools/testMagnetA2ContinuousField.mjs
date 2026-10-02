#!/usr/bin/env node
/* H-PHYS2 W1 — MAGNET A2 continuous nonlinear radial field, projectile law.
 *
 * Proves in the REAL shipping projectile pass that:
 *   - there is no invisible wall at R=225 (velocity is continuous at entry);
 *   - force grows continuously as distance falls (one shared S(d));
 *   - every guaranteed-tier inward radial velocity <= 3500 is kept outside the
 *     damaging envelope, with NO speed branch (3490/3510 are continuous);
 *   - high speed is CONDITIONAL, not binary;
 *   - the real curved path is published as ordered sub-segments, not a chord.
 */
import { bootHarness } from './lib/crystalaHarness.mjs';
import fs from 'node:fs';
import { strength, closedFormTurningRadius } from './calibrateMagnetA2Field.mjs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
const MAG = win.APEX_MAGNET;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;

const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

const R = 225, ENVELOPE = 84, BODY_ENV = 150;

function start() {
  T.start('MAGNET', 'ROBOT'); T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = 500; a.y = 500; b.x = 950; b.y = 950;
  return { a, b };
}

/* Fire one bullet with an exact inward radial velocity from outside R and
 * integrate through the REAL pass. offsetDeg gives an off-axis approach so the
 * inward RADIAL component (not scalar speed) is what the field sees. */
function shoot({ speed, fromDist = 320, offAxisDeg = 0, activateAtDist = null, dt = 1 / 60 }) {
  const { a } = start();
  const cx = a.x, cy = a.y;
  // Only pre-activate when the scenario wants the field already up before
  // entry. A late-engagement scenario must genuinely cast A2 later, once the
  // projectile is already deep inside R.
  if (activateAtDist == null) { HR.pressAbility(a, 'A2'); T.step(dt, dt); }

  // Place a real arsenal bullet owned by the opponent, aimed through centre
  // with an angular offset applied to its velocity.
  const ang = Math.PI;                       // approach from +X going -X
  const px = cx - Math.cos(ang) * fromDist, py = cy - Math.sin(ang) * fromDist;
  const off = offAxisDeg * Math.PI / 180;
  const vx = Math.cos(ang + off) * speed, vy = Math.sin(ang + off) * speed;
  const p = { aq: true, type: 'aq_bullet', x: px, y: py, px, py, vx, vy,
    owner: H.fighters()[1], weapon: 'PISTOL', damage: 5, life: 3, radius: 7, __hr: {} };
  win.projectiles.length = 0; win.projectiles.push(p);

  let minD = Math.hypot(p.x - cx, p.y - cy);
  let entrySample = null, polyFrames = 0, maxSegs = 0;
  let consumedInsideField = false, consumedAtDist = null;
  let activated = activateAtDist == null;
  const samples = [];
  for (let i = 0; i < 160; i++) {
    const dPre = Math.hypot(p.x - cx, p.y - cy);
    const vPre = { vx: p.vx, vy: p.vy };
    if (!activated && dPre <= activateAtDist) { HR.pressAbility(a, 'A2'); activated = true; }
    T.step(dt, dt);
    if (!win.projectiles.includes(p) || p.life <= 0) {
      // Consumed mid-flight. If that happened while it was inside the field it
      // reached a real interaction (a hit), which is what a penetration case
      // must demonstrate; minD alone would understate it.
      consumedInsideField = dPre < R * 1.05;
      consumedAtDist = dPre;
      break;
    }
    const dPost = Math.hypot(p.x - cx, p.y - cy);
    if (dPost < minD) minD = dPost;
    const segs = HR.geom.pathSegments(p);
    if (p.__hr && p.__hr.pathPoly) { polyFrames++; maxSegs = Math.max(maxSegs, segs.length); }
    // capture the frame in which the field boundary was first crossed
    if (!entrySample && dPre >= R && dPost < R) {
      entrySample = { dPre, dPost, speedBefore: Math.hypot(vPre.vx, vPre.vy), speedAfter: Math.hypot(p.vx, p.vy),
        radialBefore: ((p.px - cx) * vPre.vx + (p.py - cy) * vPre.vy) / (Math.hypot(p.px - cx, p.py - cy) || 1) };
    }
    samples.push({ d: +dPost.toFixed(1), v: +Math.hypot(p.vx, p.vy).toFixed(1) });
    if (dPost > R * 1.4 && i > 4) break;
  }
  return { minD, entrySample, polyFrames, maxSegs, samples, alive: p.life > 0,
    consumedInsideField, consumedAtDist };
}

/* ---- A. field formula ---- */
gate('A1-strength-zero-at-R', strength(R, R) === 0, { S_R: strength(R, R) });
let mono = true, prev = -1;
for (let d = R; d >= 1; d--) { const v = strength(d, R); if (v < prev) mono = false; prev = v; }
gate('A2-monotonic-increase-inward', mono);
gate('A3-finite-at-dSafe', Number.isFinite(strength(1, R)) && strength(1, R) === strength(24, R),
  { atDsafe: +strength(24, R).toFixed(2) });
gate('A5-continuity-at-R', Math.abs(strength(R - 1e-9, R)) < 1e-9);

const magnetSrc = fs.readFileSync('public/game/hero-rework/magnetGameplayRuntime.js', 'utf8');
gate('A6-no-speed-branch-at-3500',
  !/(speed|vr|radial)[^\n]{0,40}[<>]=?\s*3500/.test(magnetSrc)
  && !/3500[^\n]{0,30}\?/.test(magnetSrc));
gate('A7-no-wall-law-remaining',
  !/radialAfter:\s*0\b/.test(magnetSrc)
  && !/A2_BULLET_ENTRY_RESTITUTION\s*[;,)]/.test(magnetSrc.replace(/A2_BULLET_ENTRY_RESTITUTION: 1\.0,[^\n]*/, ''))
  && !/function applyA2BulletRepulsion/.test(magnetSrc));

/* ---- B. guaranteed standard tier ---- */
const B = {};
for (const v of [2200, 2600, 3000, 3200, 3400, 3490, 3500, 3510]) {
  const r = shoot({ speed: v });
  B[v] = { minD: +r.minD.toFixed(1), closed: +(closedFormTurningRadius(v, 73700) || 0).toFixed(1), polyFrames: r.polyFrames };
}
console.log('  guaranteed tier minD:', JSON.stringify(B));
gate('B1-all-guaranteed-tier-outside-damage-envelope',
  [2200, 2600, 3000, 3200, 3400, 3500].every((v) => B[v].minD > ENVELOPE), B);
gate('B2-no-discontinuity-across-the-anchor',
  Math.abs(B[3490].minD - B[3510].minD) < 6, { d3490: B[3490].minD, d3500: B[3500].minD, d3510: B[3510].minD });
gate('B3-turning-radius-decreases-with-speed',
  B[2200].minD > B[3000].minD && B[3000].minD > B[3500].minD, B);
gate('B4-matches-closed-form-within-tolerance',
  [2200, 3000, 3500].every((v) => Math.abs(B[v].minD - B[v].closed) < 14), B);

/* ---- entry continuity: the invisible wall must be gone ---- */
const e = shoot({ speed: 3000 });
gate('B5-velocity-continuous-across-field-entry',
  !!e.entrySample && Math.abs(e.entrySample.speedAfter - e.entrySample.speedBefore) < e.entrySample.speedBefore * 0.25,
  e.entrySample);

/* ---- C. high speed is conditional ---- */
const cHead = shoot({ speed: 5800 });
const cLate = shoot({ speed: 5800, activateAtDist: 120, fromDist: 320 });
const cOff = shoot({ speed: 5800, offAxisDeg: 72 });
console.log('  high-speed:', JSON.stringify({
  headOn: { minD: +cHead.minD.toFixed(1), consumed: cHead.consumedInsideField },
  lateEngage: { minD: +cLate.minD.toFixed(1), consumed: cLate.consumedInsideField, at: cLate.consumedAtDist },
  offAxis: { minD: +cOff.minD.toFixed(1), consumed: cOff.consumedInsideField } }));
gate('C1-high-speed-still-influenced', cHead.minD > 0 && cHead.minD < R, { minD: +cHead.minD.toFixed(1) });
gate('C2-legit-high-speed-penetration-exists',
  cLate.consumedInsideField || cLate.minD <= ENVELOPE,
  { lateEngageMinD: +cLate.minD.toFixed(1), consumedInsideField: cLate.consumedInsideField,
    consumedAtDist: cLate.consumedAtDist,
    note: 'A2 engaged while the shot was already deep — PASS when it reaches a real interaction' });
gate('C3-high-speed-offaxis-deflects', cOff.minD > ENVELOPE && !cOff.consumedInsideField,
  { offAxisMinD: +cOff.minD.toFixed(1), note: 'inward radial component, not scalar speed, governs' });

/* ---- ordered path truth ---- */
gate('P1-real-curve-published-as-subsegments', e.polyFrames > 0 && e.maxSegs > 2,
  { polyFrames: e.polyFrames, maxSegments: e.maxSegs });

/* ---- dt stability ---- */
const dts = [1 / 30, 1 / 60, 1 / 120].map((dt) => shoot({ speed: 3000, dt }).minD);
gate('N1-dt-convergence-30-60-120', Math.max(...dts) - Math.min(...dts) < 16,
  dts.map((d) => +d.toFixed(1)));
gate('N2-no-nan-or-teleport', dts.every((d) => Number.isFinite(d) && d > 0 && d < R));

fs.mkdirSync('docs/hero-rework/magnet-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/magnet-v1/evidence/a2-continuous-field-w1.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  rating: 3500, coupling: 73700, R, damageEnvelope: ENVELOPE, bodyEnvelope: BODY_ENV,
  guaranteedTier: B, highSpeed: { headOn: cHead.minD, lateEngage: cLate.minD, offAxis: cOff.minD },
  dtConvergence: dts, ...report, pass: report.failures.length === 0,
}, null, 2));

const total = Object.keys(report.gates).length;
console.log(`\n[MAGNET A2 CONTINUOUS FIELD — W1] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
