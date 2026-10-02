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
export const BODY_CONTACT_ENVELOPE = FIGHTER_R + FIGHTER_R; // 150 px
export const HUNTER_POUNCE_SPEED = 2200;

/* GUARANTEED CURRENT INTERACTIONS.
 *
 * The 3500 rating is the owner-facing anchor, but the coupling it implies is
 * NOT set by the projectile case alone. Each guaranteed interaction has its own
 * legal contact envelope, and an inward object reaches a LARGER envelope
 * EARLIER. Hunter's body-contact envelope is 150 px -- nearly twice the
 * projectile's 84 px -- so even at the lower 2200 px/s pounce speed it is by
 * far the more demanding constraint. The single coupling must therefore be the
 * MAXIMUM required across every guaranteed case, not the projectile's. */
export const GUARANTEED_CASES = Object.freeze([
  { id: 'projectile-3500', vRadial: RATING, envelope: DAMAGE_ENVELOPE,
    note: 'standard firearm tier ceiling vs fighter radius + max bullet radius' },
  { id: 'hunter-pounce-2200', vRadial: HUNTER_POUNCE_SPEED, envelope: BODY_CONTACT_ENVELOPE,
    note: 'Hunter A2 pursuit vs Hunter radius + Magnet radius' },
]);

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
export function calibrateCase(vRadial, envelope, dts = [1 / 30, 1 / 60, 1 / 120]) {
  const ok = (K) => dts.every((dt) => simulateHeadOn(vRadial, K, dt).minD > envelope);
  let lo = 1, hi = 1 << 22;
  if (!ok(hi)) return null;
  for (let i = 0; i < 90; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}

/* The field coupling is the maximum demanded by any guaranteed case. */
export function calibrate(cases = GUARANTEED_CASES, dts = [1 / 30, 1 / 60, 1 / 120]) {
  const per = cases.map((c) => ({ ...c, kMin: calibrateCase(c.vRadial, c.envelope, dts),
    kClosed: closedFormK(c.vRadial, c.envelope) }));
  const binding = per.reduce((a, b) => (b.kMin > a.kMin ? b : a));
  return { perCase: per, binding, kMin: binding.kMin };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cal = calibrate();
  const MARGIN = 1.15;                       // modest numerical safety margin
  const K = Math.round(cal.kMin * MARGIN / 100) * 100;

  console.log('MAGNET A2 CONTINUOUS FIELD CALIBRATION');
  console.log('  R', R_DEFAULT, ' dSafe', D_SAFE, ' S(dSafe)', strength(D_SAFE).toFixed(2));
  console.log('  owner rating', RATING, 'px/s inward radial\n');
  console.log('  GUARANTEED CASES (coupling must satisfy ALL):');
  for (const c of cal.perCase) {
    console.log(`    ${c.id.padEnd(20)} v=${String(c.vRadial).padStart(4)}  envelope=${String(c.envelope).padStart(3)}  K_min=${c.kMin.toFixed(1).padStart(10)}  closed=${c.kClosed.toFixed(1).padStart(10)}`);
  }
  console.log(`  BINDING CASE: ${cal.binding.id}  (K_min ${cal.binding.kMin.toFixed(1)})`);
  console.log(`  margin x${MARGIN}  =>  CHOSEN A2_FIELD_COUPLING = ${K}\n`);

  console.log('Continuity / monotonicity');
  console.log('  S(R) =', strength(R_DEFAULT).toFixed(6), ' S(R-1e-9) =', strength(R_DEFAULT - 1e-9).toExponential(3));
  let mono = true, prev = -1;
  for (let d = R_DEFAULT; d >= 1; d -= 1) { const v = strength(d); if (v < prev) mono = false; prev = v; }
  console.log('  monotonic increasing as d falls:', mono, '\n');

  console.log('TURNING RADIUS TABLE (head-on, A2 active before entry), K =', K);
  console.log('  v0      closed   dt=1/30   dt=1/60  dt=1/120   vs84(bullet)  vs150(body)');
  const SPEEDS = [2200, 2600, 3000, 3200, 3400, 3490, 3500, 3510, 5000, 5200, 5400, 5800];
  const table = [];
  for (const v of SPEEDS) {
    const cf = closedFormTurningRadius(v, K);
    const a = simulateHeadOn(v, K, 1 / 30), b = simulateHeadOn(v, K, 1 / 60), c = simulateHeadOn(v, K, 1 / 120);
    const row = { v0: v, closedForm: cf == null ? null : +cf.toFixed(1),
      dt30: +a.minD.toFixed(1), dt60: +b.minD.toFixed(1), dt120: +c.minD.toFixed(1),
      reachesBulletEnvelope: b.minD <= DAMAGE_ENVELOPE, reachesBodyEnvelope: b.minD <= BODY_CONTACT_ENVELOPE };
    table.push(row);
    console.log(`  ${String(v).padStart(5)}  ${(cf == null ? 'centre' : cf.toFixed(1)).padStart(7)}  ${a.minD.toFixed(1).padStart(7)}  ${b.minD.toFixed(1).padStart(8)}  ${c.minD.toFixed(1).padStart(8)}   ${(row.reachesBulletEnvelope ? 'REACHES' : 'outside').padStart(12)}  ${(row.reachesBodyEnvelope ? 'REACHES' : 'outside').padStart(11)}`);
  }

  const guar = table.filter((r) => r.v0 <= RATING);
  console.log('\n  all <=3500 outside bullet envelope(84):', guar.every((r) => !r.reachesBulletEnvelope));
  const h = table.find((r) => r.v0 === 2200);
  console.log('  HUNTER 2200 turns BEFORE body envelope(150):', !h.reachesBodyEnvelope, `(minD ${h.dt60})`);
  const p1 = table.find((r) => r.v0 === 3490), p2 = table.find((r) => r.v0 === 3510);
  console.log('  3490 vs 3510 delta:', (p1.dt60 - p2.dt60).toFixed(2), 'px (no discontinuity at the anchor)');
  let monoR = true;
  for (let i = 1; i < table.length; i++) if (table[i].dt60 > table[i - 1].dt60 + 1e-6) monoR = false;
  console.log('  turning radius decreases monotonically with speed:', monoR);
  const prec = table.filter((r) => r.v0 >= 5000);
  console.log('  precision tier head-on reaching bullet envelope:', prec.filter((r) => r.reachesBulletEnvelope).map((r) => r.v0).join(',') || 'none');

  console.log('\nHIGH-SPEED CONDITIONALITY (no weapon/speed branch anywhere)');
  // (a) legitimate penetration: field engages late, object already deep
  for (const v of [5400, 5800]) for (const d0 of [150, 110]) {
    let x = d0, vx = -v, minD = d0; const dt = 1 / 60;
    for (let st = 0; st < 240 && x > 0; st++) {
      const sub = Math.max(1, Math.ceil(Math.abs(vx) * dt / 1.5)), hh = dt / sub;
      for (let i = 0; i < sub; i++) { vx += K * strength(Math.max(x, 1e-9)) * hh; x += vx * hh; if (x < minD) minD = x; if (x <= 0) break; }
      if (x >= R_DEFAULT && vx > 0) break;
    }
    console.log(`  penetration probe v=${v} engaged at d=${d0}: minD=${Math.max(minD,0).toFixed(1)} -> ${minD <= DAMAGE_ENVELOPE ? 'HITS (PASS)' : 'stopped'}`);
  }
  // (b) same high speed, off-axis: inward RADIAL component is what matters
  for (const [v, deg] of [[5800, 70], [5800, 75], [5400, 72]]) {
    const vr = v * Math.cos(deg * Math.PI / 180);
    const s = simulateHeadOn(vr, K, 1 / 60);
    console.log(`  deflection probe v=${v} at ${deg}deg off-axis -> inward radial ${vr.toFixed(0)}: minD=${s.minD.toFixed(1)} -> ${s.minD > DAMAGE_ENVELOPE ? 'DEFLECTED (PASS)' : 'hits'}`);
  }
  console.log('\nexport A2_FIELD_COUPLING =', K);
}
