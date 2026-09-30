#!/usr/bin/env node
// Slice C survey: gun stats, cadences, spread. Throwaway (deleted before commit).
import { bootHarness } from './lib/crystalaHarness.mjs';
const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;
const CFG = win.APEX_ARSENAL_CONFIG;
for (const id of ['PISTOL', 'SMG', 'BERETTA_93R', 'M16', 'MBR', 'SHOTGUN', 'JACKHAMMER', 'M249', 'SABRE', 'FRAG_GRENADE', 'SWIRL_SHIELD', 'STORMBREAKER', 'RAILGUN']) {
  const w = CFG.WEAPONS[id];
  console.log(id, w ? JSON.stringify({ fam: w.family, shots: w.shots, dmg: w.damagePerShot, burst: w.burstSize, pellets: w.pellets, trig: w.triggerRange, interval: w.fireInterval, shotInterval: w.shotInterval, blast: w.blastInterval }) : 'MISSING');
}
console.log('slimeA1:', JSON.stringify(win.APEX_HERO_REWORK_REGISTRY.HEROES.SLIME.skills.A1.cfg));
// cadence survey: equip + pinned duel, tap HIT clocks
const W = () => win.APEX_ARSENAL.weaponApi;
console.log('SLIME skills:', Object.keys(win.APEX_HERO_REWORK_REGISTRY.HEROES.SLIME.skills || {}));
console.log('M249_SAW live:', JSON.stringify(CFG.WEAPONS.M249_SAW));
console.log('MBR live:', JSON.stringify(CFG.WEAPONS.MBR));
console.log('JACK live:', JSON.stringify(CFG.WEAPONS.JACKHAMMER));
for (const id of ['MBR', 'SHOTGUN', 'JACKHAMMER', 'M249_SAW']) {
  T.start('ICE', 'ROBOT');
  T.holdSpawns();
  const [a, b] = H.fighters();
  W().equip(a, id);
  a.x = 300; a.y = 500; a.setDir(1, 0); a.baseSpeed = 0;
  b.x = 600; b.y = 500; b.setDir(-1, 0); b.baseSpeed = 0;
  const hits = [];
  const o = console.log;
  console.log = (...lg) => { const m = String(lg[0]).match(/\[AQ\] HIT/); if (m) hits.push(+win.APEX_ARSENAL.state.time.toFixed(3)); return o(...lg); };
  try { T.step(6); } finally { console.log = o; }
  console.log(id, 'hits@', hits.join(',') || 'NONE', 'b.hp=', b.hp.toFixed(1));
}
process.exit(0);
