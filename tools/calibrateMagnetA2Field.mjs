#!/usr/bin/env node
/* MAGNET A2 — continuous nonlinear radial field calibration (H-PHYS2 §18).
 *
 * One spatial field-strength function, shared by bullets / bodies / floor guns:
 *
 *     S(d) = (R / max(d, dSafe))^2 - 1     for d <  R
 *     S(d) = 0                             for d >= R
 *
 *     a(d) = K * S(d), directed radially OUTWARD from the live Magnet centre.
 *
 * S(R) = 0 exactly, S is continuous at R, monotonically increasing as d falls,
 * and finite everywhere thanks to dSafe. There is NO speed branch anywhere:
 * every object receives the same law, so the speed tiering is an emergent
 * consequence of integrating the force, not a scripted outcome.
 *
 * This tool DERIVES the single coupling K from the one owner-facing number,
 * A2_RADIAL_STOP_RATING = 3500 px/s, instead of guessing it. K is the smallest
 * coupling that honestly earns the 3500 rating, plus a modest margin — it is
 * deliberately NOT raised until the precision tier is also blocked.
 */

export const R_DEFAULT = 225;
export const D_SAFE = 24;           // finite clamp, far below any legal contact distance
export const RATING = 3500;         // owner-facing inward-radial stop rating (px/s)
export const FIGHTER_R = 75;
export const MAX_BULLET_R = 9;
export const DAMAGE_ENVELOPE = FIGHTER_R + MAX_BULLET_R;   // 84 px

export function strength(d, R = R_DEFAULT) {
  if (d >= R) return 0;
  const q = R / Math.max(d, D_SAFE);
  return q * q - 1;
}

/* Closed form: work done by the field between r = d and r = R.
 *   W(d) = K * integral_d^R S(r) dr = K * (R^2/d + d - 2R)
 * Head-on entry at R with inward radial speed v0 turns around when W = v0^2/2. */
export function workPerK(d, R = R_DEFAULT) { return (R * R) / d + d - 2 * R; }
export function closedFormTurningRadius(v0, K, R = R_DEFAULT) {
  const need = (v0 * v0) / 2 / K;                 // = R^2/d + d - 2R
  const b = need + 2 * R;                         // d^2 - b d + R^2 = 0
  const disc = b * b - 4 * R * R;
  if (disc < 0) return null;                      // never turns: penetrates centre
  return (b - Math.sqrt(disc)) / 2;
}
export function closedFormK(v0, dMin, R = R_DEFAULT) {
  return (v0 * v0) / 2 / workPerK(dMin, R);
}

/* Deterministic numeric integration (semi-implicit Euler with bounded
 * substeps). Used to confirm the closed form survives the real discrete
 * integrator at every supported rate, and to measure dt convergence. */
export function simulateHeadOn(v0, K, dt, R = R_DEFAULT, opts = {}) {
  const maxSub = opts.maxSub ?? 64;
  const subTarget = opts.subTarget ?? 1.5;        // px of travel per substep
  let x = R, vx = -v0, t = 0, minD = R;
  const limit = opts.timeLimit ?? 2.0;
  while (t < limit) {
    const sub = Math.max(1, Math.min(maxSub, Math.ceil((Math.abs(vx) * dt) / subTarget)));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const d = Math.max(Math.abs(x), 1e-9);
      const a = K * strength(d, R) * Math.sign(x || 1);
      vx += a * h;
      x += vx * h;
      if (Math.abs(x) < minD) minD = Math.abs(x);
      if (x <= 0) return { minD: 0, turned: false, penetratedCentre: true, exitV: vx, t };
    }
    t += dt;
    if (x >= R && vx > 0) return { minD, turned: true, penetratedCentre: false, exitV: vx, t };
  }
  return { minD, turned: false, penetratedCentre: false, exitV: vx, t };
}

/* Smallest K that keeps a head-on `rating` entry outside `envelope`, found by
 * bisection on the real integrator at the worst supported dt. */
export function calibrate(rating = RATING, envelope = DAMAGE_ENVELOPE, dts = [1 / 30, 1 / 60, 1 / 120]) {
  const ok = (K) => dts.every((dt) => simulateHeadOn(rating, K, dt).minD > envelope);
  let lo = 1, hi = 1 << 20;
  if (!ok(hi)) return null;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const minK = calibrate();
  // Modest safety margin over the bisected minimum. Not enough to start
  // blocking the precision tier — that is deliberate (§5, §19).
  const MARGIN = 1.15;
  const K = Math.round(minK * MARGIN / 100) * 100;

  console.log('MAGNET A2 CONTINUOUS FIELD CALIBRATION');
  console.log('  R                 ', R_DEFAULT);
  console.log('  dSafe             ', D_SAFE, ' S(dSafe) =', strength(D_SAFE).toFixed(2));
  console.log('  rating            ', RATING, 'px/s inward radial');
  console.log('  damage envelope   ', DAMAGE_ENVELOPE, 'px  (fighter 75 + max bullet radius 9)');
  console.log('  minimum K (bisect)', minK.toFixed(1));
  console.log('  margin            ', MARGIN);
  console.log('  CHOSEN K          ', K);
  console.log('  closed-form check : K for exactly envelope at rating =', closedFormK(RATING, DAMAGE_ENVELOPE).toFixed(1));

  console.log('\nContinuity / monotonicity');
  console.log('  S(R)      =', strength(R_DEFAULT).toFixed(6));
  console.log('  S(R-1e-9) =', strength(R_DEFAULT - 1e-9).toExponential(3));
  let mono = true, prev = -1;
  for (let d = R_DEFAULT; d >= 1; d -= 1) { const s = strength(d); if (s < prev) mono = false; prev = s; }
  console.log('  monotonic increasing as d falls:', mono);

  console.log('\nTURNING RADIUS TABLE (head-on, A2 active before entry)');
  console.log('  v0      closed   dt=1/30   dt=1/60  dt=1/120   outcome');
  const SPEEDS = [2200, 2600, 3000, 3200, 3400, 3490, 3500, 3510, 5000, 5200, 5400, 5800];
  const table = [];
  for (const v of SPEEDS) {
    const cf = closedFormTurningRadius(v, K);
    const s30 = simulateHeadOn(v, K, 1 / 30);
    const s60 = simulateHeadOn(v, K, 1 / 60);
    const s120 = simulateHeadOn(v, K, 1 / 120);
    const hits = s60.minD <= DAMAGE_ENVELOPE;
    table.push({ v0: v, closedForm: cf == null ? null : +cf.toFixed(1),
      dt30: +s30.minD.toFixed(1), dt60: +s60.minD.toFixed(1), dt120: +s120.minD.toFixed(1),
      reachesDamageEnvelope: hits });
    console.log(`  ${String(v).padStart(5)}  ${(cf == null ? 'centre' : cf.toFixed(1)).padStart(7)}  ${s30.minD.toFixed(1).padStart(7)}  ${s60.minD.toFixed(1).padStart(8)}  ${s120.minD.toFixed(1).padStart(8)}   ${hits ? 'REACHES ENVELOPE' : 'stopped outside'}`);
  }

  const guaranteed = table.filter((r) => r.v0 <= RATING);
  const precision = table.filter((r) => r.v0 >= 5000);
  console.log('\n  all <= 3500 stopped outside envelope :', guaranteed.every((r) => !r.reachesDamageEnvelope));
  console.log('  precision tier able to penetrate     :', precision.some((r) => r.reachesDamageEnvelope));
  const a = table.find((r) => r.v0 === 3490), b = table.find((r) => r.v0 === 3510);
  console.log('  3490 vs 3510 turning radius delta    :', (a.dt60 - b.dt60).toFixed(2), 'px (continuous, no step)');
  let monoR = true;
  for (let i = 1; i < table.length; i++) if (table[i].dt60 > table[i - 1].dt60 + 1e-6) monoR = false;
  console.log('  turning radius decreases with speed  :', monoR);

  console.log('\nFAVOURABLE PENETRATION (field engaged late, object already deep)');
  for (const v of [5000, 5800]) {
    for (const d0 of [200, 150, 120]) {
      // field activates when the projectile is already at d0 inside R
      let x = d0, vx = -v, minD = d0;
      const dt = 1 / 60;
      for (let step = 0; step < 240 && x > 0; step++) {
        const sub = Math.max(1, Math.ceil((Math.abs(vx) * dt) / 1.5)); const h = dt / sub;
        for (let i = 0; i < sub; i++) { const a2 = K * strength(Math.max(x, 1e-9)) ; vx += a2 * h; x += vx * h; if (x < minD) minD = x; if (x <= 0) break; }
        if (x >= R_DEFAULT && vx > 0) break;
      }
      console.log(`  v=${v} engaged at d=${d0}: minD=${Math.max(minD, 0).toFixed(1)} -> ${minD <= DAMAGE_ENVELOPE ? 'HITS (expected PASS)' : 'stopped'}`);
    }
  }
  console.log('\nexport A2_FIELD_COUPLING =', K);
}
