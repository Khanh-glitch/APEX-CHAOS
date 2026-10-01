#!/usr/bin/env node
/* MAGNET A2 — FAST targeted repulsion probe (no browser).
 *
 * Loads the real public/game/hero-rework/magnetGameplayRuntime.js into a stub
 * global, casts a real A2 field, and drives real production firearm bullet
 * speeds through the exact production seam order:
 *     MAG.stepProjectiles(dt, ...)  ->  p.x += p.vx*dt (canonical integration)
 * which is how heroReworkRuntime.reworkUpdateProjectiles() does it.
 *
 * It measures penetration against the real damaging envelope
 * (target.radius * BULLET_HIT_RADIUS_SCALE + p.radius).
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'public/game/hero-rework/magnetGameplayRuntime.js');

const GUNS = new Set(['PISTOL', 'SMG', 'SNIPER', 'SHOTGUN']);
const SPEEDS = { PISTOL: 2600, SMG: 3100, SNIPER: 5800 };
const RADII = { PISTOL: 7, SMG: 6, SNIPER: 8 };
const HIT_SCALE = 0.78;
const BODY_R = 75;

function loadRuntime() {
  const sandbox = { matchClock: 0, GAME_SIZE: 1000, console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.APEX_ARSENAL_CONFIG = { isGun: (id) => GUNS.has(id) };
  sandbox.APEX_ARSENAL = { state: { slots: [] } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: SRC });
  return sandbox;
}


// Exactly mirrors the canonical seam in heroReworkRuntime.reworkUpdateProjectiles():
// MAG.stepProjectiles(...) publishes a TOI plan, then the integration travels
// frameStart -> boundary with the ORIGINAL velocity, applies the response at
// the boundary, and integrates the remaining (1-t)*dt. Returns the ordered
// physical segments actually travelled this frame.
function integrate(MAG, p, dt) {
  const plan = MAG.consumeMovementPlan ? MAG.consumeMovementPlan(p) : null;
  const x0 = p.x, y0 = p.y;
  if (plan) {
    const ex = x0 + plan.preVx * dt * plan.entryT;
    const ey = y0 + plan.preVy * dt * plan.entryT;
    p.vx = plan.postVx; p.vy = plan.postVy;
    p.x = ex + p.vx * dt * (1 - plan.entryT);
    p.y = ey + p.vy * dt * (1 - plan.entryT);
    return { plan, segments: [{ x0, y0, x1: ex, y1: ey }, { x0: ex, y0: ey, x1: p.x, y1: p.y }] };
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  return { plan: null, segments: [{ x0, y0, x1: p.x, y1: p.y }] };
}

function makeMagnet(x, y) {
  const anchor = { x, y, hp: 100, radius: BODY_R, id: 'magnet-anchor' };
  return {
    idx: 0, anchor, bodies: [anchor],
    skills: {
      A1: { cfg: { bulletRadius: 480, bulletAcceleration: 14000 } },
      A2: { cfg: { duration: 1.80, radius: 225, bulletAcceleration: 18000 } },
    },
  };
}

function run({ weapon, offsetDeg, dt, label }) {
  const g = loadRuntime();
  const MAG = g.APEX_MAGNET;
  const magnet = makeMagnet(500, 500);
  const api = { emitEvent() {} };
  let clock = 0;
  g.matchClock = 0;
  MAG.castA2({ combatant: magnet, api, clock: () => clock, cfg: magnet.skills.A2.cfg });

  const speed = SPEEDS[weapon];
  const pr = RADII[weapon];
  // Launch from 420px away, aimed at Magnet, then rotated off-axis by offsetDeg.
  const start = { x: 500 - 420, y: 500 };
  let aim = Math.atan2(500 - start.y, 500 - start.x) + (offsetDeg * Math.PI) / 180;
  const shooter = { id: 'hostile-body' };
  const p = {
    aq: true, type: 'aq_bullet', weapon, life: 1.0, radius: pr,
    owner: shooter, damage: 4.5, critical: true,
    __hr: { payload: 'probe-payload' },
    x: start.x, y: start.y,
    vx: Math.cos(aim) * speed, vy: Math.sin(aim) * speed,
  };
  const identity = { owner: p.owner, damage: p.damage, critical: p.critical, weapon: p.weapon, payload: p.__hr.payload, life: p.life };

  const envelope = BODY_R * HIT_SCALE + pr;
  const trace = [];
  let entryEvent = null, minDist = Infinity, penetrated = false;
  let radialBefore = null, radialAfter = null;
  const launchSpeed = speed;

  let toi = null, influenceBeforeBoundary = false, captureSamples = [], releaseClock = null;
  let minRadiusDuringCapture = Infinity, entryFrameIndex = -1;
  for (let i = 0; i < Math.ceil(1.8 / dt); i++) {
    const pathBeforeStep = sweptMin(p.x, p.y, p.x + p.vx * dt, p.y + p.vy * dt, 500, 500);
    MAG.stepProjectiles(dt, [p], () => null, clock);
    const inf = MAG.inspect(clock).projectileInfluence;
    const rec = inf.find((r) => r.projectile === p);
    // INVARIANT 1: BEFORE the bullet has ever reached the boundary, no frame
    // whose whole physical path stays outside R=225 may be influenced at all.
    // (After entry, the capture episode legitimately keeps acting while the
    // bullet is pushed back out past R, so this guards only the approach.)
    if (!entryEvent && rec && pathBeforeStep > 225 + 1e-6) influenceBeforeBoundary = true;
    if (rec && rec.entries && rec.entries.length && !entryEvent) {
      entryEvent = rec.entries[0];
      radialBefore = entryEvent.radialBefore;
      radialAfter = entryEvent.radialAfter;
      entryFrameIndex = i;
    }
    if (rec && rec.captures && rec.captures.length) {
      const c = rec.captures[0];
      captureSamples.push({ u: +c.u.toFixed(3), want: +c.want.toFixed(1), vr: +c.vr.toFixed(1), r: +c.radius.toFixed(1), tan: +c.tangential.toFixed(1), clock: +clock.toFixed(4) });
      minRadiusDuringCapture = Math.min(minRadiusDuringCapture, c.radius);
      if (c.u >= 1 && releaseClock == null) releaseClock = clock;
    }
    const step = integrate(MAG, p, dt);
    if (step.plan && !toi) {
      const seg = step.segments;
      toi = {
        t: +step.plan.entryT.toFixed(5),
        clock: +clock.toFixed(4),
        entryX: +step.plan.entryX.toFixed(3), entryY: +step.plan.entryY.toFixed(3),
        // INVARIANT 3: the response position lies ON the R=225 circle.
        radiusAtResponse: +Math.hypot(step.plan.entryX - 500, step.plan.entryY - 500).toFixed(6),
        // ordered-segment continuity proof
        preSegmentEnd: { x: +seg[0].x1.toFixed(6), y: +seg[0].y1.toFixed(6) },
        postSegmentStart: { x: +seg[1].x0.toFixed(6), y: +seg[1].y0.toFixed(6) },
      };
      toi.radiusError = +Math.abs(toi.radiusAtResponse - 225).toFixed(6);
      toi.segmentContinuityError = +Math.hypot(seg[1].x0 - seg[0].x1, seg[1].y0 - seg[0].y1).toFixed(9);
    }
    // swept check across every real sub-segment travelled
    for (const sgm of step.segments) {
      const m = sweptMin(sgm.x0, sgm.y0, sgm.x1, sgm.y1, 500, 500);
      minDist = Math.min(minDist, m);
      if (m <= envelope) penetrated = true;
    }
    const d = Math.hypot(p.x - 500, p.y - 500);
    if (trace.length < 400) trace.push({ t: +(clock).toFixed(4), x: +p.x.toFixed(1), y: +p.y.toFixed(1), d: +d.toFixed(1), sp: +Math.hypot(p.vx, p.vy).toFixed(1) });
    clock += dt; g.matchClock = clock;
    if (p.x < -50 || p.x > 1050 || p.y < -50 || p.y > 1050) break;
  }
  const finalD = Math.hypot(p.x - 500, p.y - 500);
  const identityOk =
    identity.owner === p.owner && identity.damage === p.damage &&
    identity.critical === p.critical && identity.weapon === p.weapon &&
    identity.payload === p.__hr.payload && identity.life === p.life;

  return {
    label, weapon, offsetDeg, dt,
    launchSpeed,
    damagingEnvelope: +envelope.toFixed(1),
    sweptEntryUsed: !!(entryEvent && entryEvent.t > 0),
    entry: entryEvent && {
      t: +entryEvent.t.toFixed(4),
      x: +entryEvent.x.toFixed(1), y: +entryEvent.y.toFixed(1),
      radialBefore: +radialBefore.toFixed(1),
      radialAfter: +radialAfter.toFixed(1),
      tangentialPreserved: +entryEvent.tangential.toFixed(1),
    },
    toi,
    noInfluenceBeforeBoundary: !influenceBeforeBoundary,
    capture: {
      durationConfigured: 0.07,
      samples: captureSamples.slice(0, 12),
      frames: captureSamples.length,
      minRadiusDuringCapture: Number.isFinite(minRadiusDuringCapture) ? +minRadiusDuringCapture.toFixed(1) : null,
      releaseClock: releaseClock == null ? null : +releaseClock.toFixed(4),
      outwardRamp: captureSamples.map((c) => c.want),
      tangentialDuringCapture: captureSamples.map((c) => c.tan),
      monotonicOutwardRamp: captureSamples.every((c, i, arr) => i === 0 || c.want >= arr[i - 1].want - 1e-6),
      neverInward: captureSamples.every((c) => c.want >= 0),
    },
    minDistanceToMagnet: +minDist.toFixed(1),
    penetratedDamagingEnvelope: penetrated,
    finalDistance: +finalD.toFixed(1),
    finalSpeed: +Math.hypot(p.vx, p.vy).toFixed(1),
    speedCapRespected: Math.hypot(p.vx, p.vy) <= launchSpeed * 1.1 + 1e-6,
    identityPreserved: identityOk,
    trace: trace.filter((_, i) => i % 2 === 0).slice(0, 40),
  };
}

function sweptMin(x0, y0, x1, y1, cx, cy) {
  const dx = x1 - x0, dy = y1 - y0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return Math.hypot(x0 - cx, y0 - cy);
  let t = ((cx - x0) * dx + (cy - y0) * dy) / a;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x0 + dx * t - cx, y0 + dy * t - cy);
}

/* ---- extra invariant probes ------------------------------------------- */

// Bullet that is ALREADY inside the field when A2 begins: exercises the
// continued flat-18000 branch and counts entry responses (must be <= 1).
function probeInsideAtCast(weapon) {
  const g = loadRuntime();
  const MAG = g.APEX_MAGNET;
  const magnet = makeMagnet(500, 500);
  let clock = 0;
  MAG.castA2({ combatant: magnet, api: { emitEvent() {} }, clock: () => clock, cfg: magnet.skills.A2.cfg });
  const speed = SPEEDS[weapon], dt = 1 / 60;
  const p = {
    aq: true, type: 'aq_bullet', weapon, life: 1, radius: RADII[weapon],
    owner: { id: 'h' }, damage: 9, critical: false, __hr: {},
    x: 500 - 150, y: 500, vx: speed, vy: 0, // inbound, already inside r=225
  };
  let entryCount = 0, snaps = 0, snapsOutsideCapture = 0, captureFrames = 0, prevSpeed = speed;
  const samples = [];
  for (let i = 0; i < 60; i++) {
    const before = { vx: p.vx, vy: p.vy };
    MAG.stepProjectiles(dt, [p], () => null, clock);
    const rec = MAG.inspect(clock).projectileInfluence.find((r) => r.projectile === p);
    if (rec && rec.entries) entryCount += rec.entries.length;
    const capturingNow = !!(rec && rec.captures && rec.captures.length);
    if (capturingNow) captureFrames++;
    const dv = Math.hypot(p.vx - before.vx, p.vy - before.vy);
    // A "snap" is a velocity change beyond what the donor 18000 force could
    // produce in one frame. The owner-directed magnetic-capture envelope is
    // allowed to do this, but ONLY inside one bounded episode -- so the
    // exploit invariant is that there are ZERO such writes outside a capture
    // window, and that the window itself is bounded by captureDuration.
    if (dv > 18000 * dt * 1.5 + 1) { snaps++; if (!capturingNow) snapsOutsideCapture++; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    samples.push({ d: +Math.hypot(p.x - 500, p.y - 500).toFixed(1), vr: +(((p.x - 500) * p.vx + (p.y - 500) * p.vy) / (Math.hypot(p.x - 500, p.y - 500) || 1)).toFixed(1) });
    prevSpeed = Math.hypot(p.vx, p.vy);
    clock += dt;
    if (p.x < -50 || p.x > 1050) break;
  }
  const maxCaptureFrames = Math.ceil(0.07 / dt) + 1;
  return {
    label: `${weapon} already-inside-at-cast`,
    entryResponses: entryCount,
    perFrameSnapsBeyondDonorForce: snaps,
    snapsOutsideCaptureWindow: snapsOutsideCapture,
    captureFrames,
    maxCaptureFrames,
    pushedOutward: samples[samples.length - 1].d > 225,
    finalRadialVelocity: samples[samples.length - 1].vr,
    pass: entryCount <= 1
      && snapsOutsideCapture === 0
      && captureFrames <= maxCaptureFrames
      && samples[samples.length - 1].d > 225,
  };
}

// A1 POSITIVE CONTROL: unchanged attract law must still pull bullets inward.
function probeA1Oracle() {
  const g = loadRuntime();
  const MAG = g.APEX_MAGNET;
  const magnet = makeMagnet(500, 500);
  let clock = 0;
  MAG.castA1({ combatant: magnet, api: { emitEvent() {} }, clock: () => clock, cfg: magnet.skills.A1.cfg });
  const dt = 1 / 60;
  // off-axis bullet passing by; A1 must bend it TOWARD magnet
  const p = {
    aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 1, radius: 7,
    owner: { id: 'h' }, damage: 4.5, critical: false, __hr: {},
    x: 500 - 420, y: 500 - 260, vx: 2600, vy: 0,
  };
  const d0 = Math.hypot(p.x - 500, p.y - 500);
  let minD = d0, totalInward = 0;
  for (let i = 0; i < 60; i++) {
    const beforeV = { vx: p.vx, vy: p.vy };
    MAG.stepProjectiles(dt, [p], () => null, clock);
    const nx = (500 - p.x), ny = (500 - p.y), nd = Math.hypot(nx, ny) || 1;
    totalInward += ((p.vx - beforeV.vx) * nx + (p.vy - beforeV.vy) * ny) / nd;
    p.x += p.vx * dt; p.y += p.vy * dt;
    minD = Math.min(minD, Math.hypot(p.x - 500, p.y - 500));
    clock += dt;
    if (p.x > 1050) break;
  }
  return {
    label: 'A1 acquisition oracle (unchanged law)',
    startDistance: +d0.toFixed(1),
    minDistance: +minD.toFixed(1),
    totalInwardDeltaV: +totalInward.toFixed(1),
    pass: totalInward > 50 && minD < d0,
  };
}


// NEGATIVE CONTROL: a frame whose swept segment does NOT reach R=225 must
// produce NO entry response, even though it WOULD intersect the inflated
// speed-dependent radius (225 + v*dt) that the previous frame-start-reflection
// bug effectively had. This test is what stops that bug coming back.
function probeNonCrossing(weapon) {
  const g = loadRuntime();
  const MAG = g.APEX_MAGNET;
  const magnet = makeMagnet(500, 500);
  let clock = 0;
  MAG.castA2({ combatant: magnet, api: { emitEvent() {} }, clock: () => clock, cfg: magnet.skills.A2.cfg });
  const dt = 1 / 60, speed = SPEEDS[weapon];
  const travel = speed * dt;
  // Start so the frame ends 12px OUTSIDE the boundary: start d = 225+travel+12.
  const startD = 225 + travel + 12;
  const p = {
    aq: true, type: 'aq_bullet', weapon, life: 1, radius: RADII[weapon],
    owner: { id: 'h' }, damage: 4.5, critical: false, __hr: {},
    x: 500 - startD, y: 500, vx: speed, vy: 0,
  };
  const vBefore = { vx: p.vx, vy: p.vy };
  MAG.stepProjectiles(dt, [p], () => null, clock);
  const rec = MAG.inspect(clock).projectileInfluence.find((r) => r.projectile === p);
  const entries = rec && rec.entries ? rec.entries.length : 0;
  const plan = MAG.consumeMovementPlan ? MAG.consumeMovementPlan(p) : null;
  const endD = Math.hypot((p.x + p.vx * dt) - 500, p.y - 500);
  const velocityUntouched = p.vx === vBefore.vx && p.vy === vBefore.vy;
  return {
    label: `${weapon} non-crossing frame`,
    startDistance: +startD.toFixed(1),
    frameTravel: +travel.toFixed(1),
    endDistance: +endD.toFixed(1),
    inflatedRadiusWouldCatch: startD < 225 + travel,
    entryResponses: entries,
    planPublished: !!plan,
    velocityUntouched,
    pass: entries === 0 && !plan && velocityUntouched && endD > 225,
  };
}

const dts = [1 / 60, 1 / 30];
const cases = [];
for (const weapon of ['PISTOL', 'SMG', 'SNIPER']) {
  for (const offsetDeg of [0, 18]) {
    for (const dt of dts) {
      cases.push({ weapon, offsetDeg, dt, label: `${weapon} ${offsetDeg === 0 ? 'head-on' : 'off-axis ' + offsetDeg + 'deg'} @${Math.round(1 / dt)}Hz` });
    }
  }
}

const results = cases.map(run);
const insideCases = ['PISTOL', 'SMG', 'SNIPER'].map(probeInsideAtCast);
const nonCrossing = ['PISTOL', 'SMG', 'SNIPER'].map(probeNonCrossing);
const a1Oracle = probeA1Oracle();
const TOI_EPS = 1e-6;
const badToi = (r) => !r.toi
  || r.toi.radiusError > TOI_EPS * 225          // response must be ON R=225
  || r.toi.segmentContinuityError > 1e-9        // preSegment.end == postSegment.start
  || !r.noInfluenceBeforeBoundary               // no influence before reaching 225
  || !(r.entry && r.entry.radialBefore < 0)     // inbound before
  || !(r.capture.outwardRamp.length === 0 || r.capture.neverInward)
  || !r.capture.monotonicOutwardRamp
  || (r.capture.minRadiusDuringCapture != null && r.capture.minRadiusDuringCapture < r.damagingEnvelope);
const failures = results.filter((r) => r.penetratedDamagingEnvelope || !r.identityPreserved || !r.speedCapRespected || badToi(r))
  .map((f) => f.label)
  .concat(insideCases.filter((c) => !c.pass).map((c) => c.label))
  .concat(nonCrossing.filter((c) => !c.pass).map((c) => c.label))
  .concat(a1Oracle.pass ? [] : [a1Oracle.label]);
const report = {
  generatedAt: new Date().toISOString(),
  law: {
    donor: '18000 * f2 * dt outward, gate d<225, no u^2 falloff (MAGNET_FINAL_DONOR_MAX.html world())',
    rejectedProduction: 'accel = 18000 * clamp(1-d/225,0,1)^2',
    newProduction: 'TIME-OF-IMPACT split integration: frameStart -> R=225 boundary with the ORIGINAL velocity, response applied exactly AT the boundary (inward radial -> 0, tangential preserved verbatim), then the remaining (1-t)*dt; outward radial ramps 0 -> -vr over a 0.07s smoothstep magnetic-capture envelope; flat donor 18000 outward resumes after release while still inside; once per entry episode; re-arm > 1.12R; cap launch*1.10',
    fixedBug: 'the response used to be applied at the FRAME-START position while the bullet was still outside R=225, which inflated the effective capture radius by one frame of travel (225 + v*dt) and made min distance grow with projectile speed',
  },
  results,
  insideAtCast: insideCases,
  nonCrossingNegativeControl: nonCrossing,
  a1Oracle,
  pass: failures.length === 0,
  failures,
};
fs.mkdirSync(path.join(ROOT, 'docs/hero-rework/magnet-v1/evidence'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/hero-rework/magnet-v1/evidence/a2-bullet-repel-probe.json'), JSON.stringify(report, null, 2));
for (const r of results) {
  console.log(
    `${r.penetratedDamagingEnvelope ? 'FAIL' : 'PASS'}  ${r.label.padEnd(34)}` +
    ` launch=${r.launchSpeed} entry@${r.entry ? r.entry.t.toFixed(3) : 'n/a'}` +
    ` vr ${r.entry ? r.entry.radialBefore : '-'} -> ${r.entry ? r.entry.radialAfter : '-'}` +
    ` minD=${r.minDistanceToMagnet} (envelope ${r.damagingEnvelope}) finalD=${r.finalDistance}`
  );
  if (r.toi) console.log(
    `      TOI t=${r.toi.t} R@response=${r.toi.radiusAtResponse} (err ${r.toi.radiusError})` +
    ` segJoin=${r.toi.segmentContinuityError} capFrames=${r.capture.frames}` +
    ` ramp=[${r.capture.outwardRamp.slice(0, 5).join(', ')}] minR=${r.capture.minRadiusDuringCapture}`
  );
}
for (const c of nonCrossing) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.label.padEnd(34)} startD=${c.startDistance} travel=${c.frameTravel} endD=${c.endDistance} entries=${c.entryResponses} plan=${c.planPublished} vUntouched=${c.velocityUntouched}`);
for (const c of insideCases) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.label.padEnd(34)} entryResponses=${c.entryResponses} snapsOutsideCapture=${c.snapsOutsideCaptureWindow} capFrames=${c.captureFrames}/${c.maxCaptureFrames} pushedOutward=${c.pushedOutward} finalVr=${c.finalRadialVelocity}`);
console.log(`${a1Oracle.pass ? 'PASS' : 'FAIL'}  ${a1Oracle.label.padEnd(34)} d ${a1Oracle.startDistance} -> min ${a1Oracle.minDistance}, inward dV=${a1Oracle.totalInwardDeltaV}`);
console.log(report.pass ? '\nA2 BULLET REPEL PROBE: PASS' : `\nA2 BULLET REPEL PROBE: FAIL -> ${report.failures.join(', ')}`);
process.exit(report.pass ? 0 : 1);
