#!/usr/bin/env node
// Debug: F08.6 lock timeline + F01.8 inspect-null. Throwaway.
import { bootHarness } from './lib/crystalaHarness.mjs';
const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;
const FR = () => win.APEX_FROST;
const W = () => win.APEX_ARSENAL.weaponApi;
const clock = () => win.APEX_HERO_REWORK_AIL.clock();
function frostDraws(seed, n) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const out = [];
  for (let i = 0; i < n; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296);
  }
  return out;
}
function frostSeedFor(pattern) {
  for (let s = 1; s < 500000; s++) {
    const d = frostDraws(s, pattern.length);
    if (pattern.every((want, i) => (d[i] < 0.08) === want)) return s;
  }
  throw new Error('no seed');
}
const seed = frostSeedFor([true, false, true, true]);
console.log('seed:', seed, frostDraws(seed, 4).map((d) => d.toFixed(4)).join(' '));
FR().setFreezeSeed(seed);
T.start('ICE', 'ROBOT');
T.holdSpawns();
const [a, b] = H.fighters();
const ct = HR.byCombatant(a);
// frozenDuel replica:
a.x = 200; a.y = 500; a.setDir(1, 0);
b.x = 800; b.y = 800; b.setDir(-1, 0);
win.APEX_ARSENAL_SKILL_GATE.pressJ(a);
T.step(0.9);
const lane = FR().inspect(ct).lanes[0];
T.pushSlot({ x: lane.ox + 300, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
T.step(2 / 60);
a.x = lane.ox + 300; a.y = lane.oy;
T.step(2 / 60);
console.log('holder frozen:', !!(W().getHolder(a) && W().getHolder(a).__frostFrozen));
a.x = 300; a.y = 500; a.setDir(1, 0); a.baseSpeed = 0;
b.x = 600; b.y = 500; b.setDir(-1, 0); b.baseSpeed = 0;
let hits = 0;
const hitLog = [];
const olog = console.log;
console.log = (...lg) => {
  if (/\[AQ\] HIT/.test(String(lg[0]))) { hits++; hitLog.push({ n: hits, at: +clock().toFixed(3), rolls: FR().inspect(ct).rolls, froze: b.hasStatus('freeze') }); }
  return olog(...lg);
};
for (let f = 0; f < 200 && hits < 3; f++) T.step(1 / 60);
console.log = olog;
olog('hits:', JSON.stringify(hitLog));
console.log('after hits: clock=', clock().toFixed(3), 'froze=', b.hasStatus('freeze'), 'timer=', b.statuses.freeze && b.statuses.freeze.timer.toFixed(3), 'insp=', JSON.stringify(FR().inspect(ct)));
for (let f = 0; f < 200 && b.hasStatus('freeze'); f++) {
  T.step(1 / 60);
  if (f % 20 === 0) olog('poll f=', f, 'clock=', clock().toFixed(3), 'timer=', (b.statuses.freeze && b.statuses.freeze.timer.toFixed(3)) || 'NONE', 'lock=', b.__frostLockedUntil || 0);
}
olog('thaw observed. clock=', clock().toFixed(3), 'lock=', b.__frostLockedUntil || 0, 'insp=', JSON.stringify(FR().inspect(ct)));
process.exit(0);
