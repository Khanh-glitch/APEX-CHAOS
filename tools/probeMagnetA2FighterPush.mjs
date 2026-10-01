#!/usr/bin/env node
/* MAGNET A2 — real legal-spacing FIGHTER PUSH probe.
 *
 * Owner playtest: "A2 does not visibly push the enemy fighter."
 * The existing M05.1/M06.2 gates place the target around d=100 (an overlap
 * that normal collision forbids) and only assert state, so they cannot see
 * this. This probe drives the REAL shipping pipeline and the REAL
 * Fighter.update at LEGAL fighter spacing and measures actual displacement.
 *
 * Donor authority (MAGNET_FINAL_DONOR_MAX.html L815-817) is a radial-velocity
 * TARGET controller with a LINEAR falloff:
 *     fall = clamp(1-d/225,0,1);  push = 1050*fall*f2
 *     if (radialSpeed < push) radialSpeed -> push at k = min(1, dt*10)
 */
import { bootHarness } from './lib/crystalaHarness.mjs';
import fs from 'node:fs';

const H = await bootHarness();
const { win } = H;
const HR = win.APEX_HERO_REWORK;
const MAG = win.APEX_MAGNET;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;

const DT = 1 / 60;
const A2_SECONDS = 1.8;

function scenario({ distance, magnetP1 = true, victimMotion = 'still', nearWall = false, t6 = false }) {
  if (HR.match) win.exitArsenalQuestMode();
  win.startArsenalQuestMode(magnetP1 ? 'MAGNET' : 'ROBOT', magnetP1 ? 'ROBOT' : 'MAGNET');
  HR.setAiEnabled(false);
  const st = win.APEX_ARSENAL.state;
  st.spawnTimer = 1e6; st.slots = []; st.spawnHeld = true; st.unarmedFastConsumed = true;
  const [f0, f1] = win.fighters;
  const magnet = magnetP1 ? f0 : f1;
  const victim = magnetP1 ? f1 : f0;

  const mx = nearWall ? 140 : 500;
  magnet.x = mx; magnet.y = 500;
  victim.x = mx + distance; victim.y = 500;
  magnet.baseSpeed = 0; magnet.dir.x = 0; magnet.dir.y = 0;

  // Victim motion is REAL locomotion, not a scripted position write.
  if (victimMotion === 'toward') { victim.baseSpeed = 300; victim.dir.x = -1; victim.dir.y = 0; }
  else if (victimMotion === 'tangential') { victim.baseSpeed = 300; victim.dir.x = 0; victim.dir.y = 1; }
  else { victim.baseSpeed = 0; victim.dir.x = 0; victim.dir.y = 0; }

  if (t6) { try { win.APEX_ARSENAL.weaponApi.equip(victim, 'STORMBREAKER'); } catch (e) { /* optional */ } }

  for (let i = 0; i < 3; i++) win.APEX_ARSENAL.step(DT);
  victim.x = mx + distance; victim.y = 500;

  const d0 = Math.hypot(victim.x - magnet.x, victim.y - magnet.y);
  const cast = HR.pressAbility(magnet, 'A2');
  let peakRadial = 0, maxExternal = 0, consumedTwice = false;
  const samples = [];
  const frames = Math.round(A2_SECONDS / DT);
  for (let i = 0; i < frames; i++) {
    win.APEX_ARSENAL.step(DT);
    const d = Math.hypot(victim.x - magnet.x, victim.y - magnet.y);
    peakRadial = Math.max(peakRadial, d - d0);
    const ext = victim.__hrExternalVelocity || { x: 0, y: 0 };
    maxExternal = Math.max(maxExternal, Math.hypot(ext.x || 0, ext.y || 0));
    if (i % 12 === 0) samples.push({ t: +(i * DT).toFixed(2), d: +d.toFixed(1), ext: +Math.hypot(ext.x || 0, ext.y || 0).toFixed(1) });
  }
  const dEnd = Math.hypot(victim.x - magnet.x, victim.y - magnet.y);

  // After the field ends momentum must recover without sticking.
  for (let i = 0; i < 60; i++) win.APEX_ARSENAL.step(DT);
  const residual = MAG.inspect(win.matchClock).bodyInfluence.length;
  const dAfter = Math.hypot(victim.x - magnet.x, victim.y - magnet.y);

  return {
    distance, magnetP1, victimMotion, nearWall, t6,
    cast: !!(cast && cast.ok),
    d0: +d0.toFixed(1), dEnd: +dEnd.toFixed(1),
    displacement: +(dEnd - d0).toFixed(1),
    peakRadialDisplacement: +peakRadial.toFixed(1),
    maxExternalVelocity: +maxExternal.toFixed(1),
    residualBodyInfluence: residual,
    dAfterFieldEnds: +dAfter.toFixed(1),
    samples,
  };
}

const cases = [
  { distance: 150, label: 'contact edge d=150' },
  { distance: 170, label: 'd=170' },
  { distance: 200, label: 'd=200' },
  { distance: 220, label: 'd=220 (just inside R=225)' },
  { distance: 170, victimMotion: 'toward', label: 'd=170 moving toward' },
  { distance: 170, victimMotion: 'tangential', label: 'd=170 tangential' },
  { distance: 170, magnetP1: false, label: 'd=170 Magnet as P2' },
  { distance: 170, t6: true, label: 'd=170 T6 holder' },
  { distance: 170, nearWall: true, label: 'd=170 wall-near' },
];

const results = [];
for (const c of cases) {
  try { results.push({ label: c.label, ...scenario(c) }); }
  catch (e) { results.push({ label: c.label, error: String(e) }); }
}
if (HR.match) win.exitArsenalQuestMode();

// PRODUCT LAW, expressed against the DONOR rather than a flat constant.
// Gold is the absolute authority: its own law is push = 1050*fall*f2, so at
// d=220 (5px inside R=225) the donor itself only commands ~23 px/s and a flat
// "must move 24px" threshold would contradict Gold. The gate therefore asserts
// BOTH:
//   1. production tracks the donor's commanded radial speed at EVERY distance
//      (this is the check that actually caught the quadratic-falloff defect:
//      the old mapping sat at ~0.27 of donor at d=170 and ~0.07 at d=220);
//   2. where the donor commands a meaningful push, the fighter visibly moves.
const DONOR_PUSH_SPEED = 1050;
const DONOR_TRACK_MIN = 0.55;   // allows for the .14-.26 intensity ramp-in
const MIN_PUSH_PX = 24;
const VISIBLE_DONOR_TARGET = 100;
function donorTarget(d) { return DONOR_PUSH_SPEED * Math.max(0, 1 - d / 225); }
function ok(r) {
  if (r.error || !r.cast) return false;
  if (r.residualBodyInfluence !== 0) return false;      // no sticking
  const dt0 = donorTarget(r.d0);
  // Donor tracking is only comparable against the INITIAL distance while the
  // victim holds station. A victim under its own locomotion travels far enough
  // during the 1.8s that `fall` -- and therefore the donor's own commanded
  // target -- legitimately decays, so the ratio is not a like-for-like
  // comparison there. Those cases are judged on real displacement instead,
  // which is the owner-visible property and is far larger for them.
  if (r.victimMotion === 'still' && dt0 > 1 && r.maxExternalVelocity < DONOR_TRACK_MIN * dt0) return false;
  if (dt0 >= VISIBLE_DONOR_TARGET && r.peakRadialDisplacement < MIN_PUSH_PX) return false;
  return true;
}
const failures = results.filter((r) => !ok(r)).map((r) => r.label);

const report = {
  generatedAt: new Date().toISOString(),
  donorLaw: 'fall=clamp(1-d/225,0,1); push=1050*fall*f2 (TARGET radial speed); if(radial<push) radial->push at k=min(1,dt*10)  [MAGNET_FINAL_DONOR_MAX.html L815-817]',
  minimumVisiblePushPx: MIN_PUSH_PX,
  donorTrackingFloor: DONOR_TRACK_MIN,
  donorTargets: Object.fromEntries([150,170,200,220].map((d)=>[d, +donorTarget(d).toFixed(1)])),
  results,
  pass: failures.length === 0,
  failures,
};
fs.mkdirSync('docs/hero-rework/magnet-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/magnet-v1/evidence/a2-fighter-push.json', JSON.stringify(report, null, 2));

for (const r of results) {
  console.log(`${ok(r) ? 'PASS' : 'FAIL'}  ${String(r.label).padEnd(30)}` +
    (r.error ? ` ERROR ${r.error}` :
      ` d ${r.d0} -> ${r.dEnd} (peak +${r.peakRadialDisplacement}px) maxExtV=${r.maxExternalVelocity}` +
      ` donorTarget=${donorTarget(r.d0).toFixed(1)} track=${(r.maxExternalVelocity / Math.max(1e-6, donorTarget(r.d0))).toFixed(3)} residual=${r.residualBodyInfluence}`));
}
console.log(report.pass ? '\nA2 FIGHTER PUSH PROBE: PASS' : `\nA2 FIGHTER PUSH PROBE: FAIL -> ${failures.join(', ')}`);
process.exit(report.pass ? 0 : 1);
