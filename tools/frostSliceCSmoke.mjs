#!/usr/bin/env node
// Slice C smoke: frozen PISTOL duel + A2 contact. Throwaway (deleted before commit).
import { bootHarness } from './lib/crystalaHarness.mjs';
const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;
const FR = () => win.APEX_FROST;
const W = () => win.APEX_ARSENAL.weaponApi;
const bus = win.APEX_HERO_REWORK_AIL.bus;
const seen = [];
const oe = bus.emit.bind(bus);
bus.emit = (t, p) => { if (String(t).startsWith('Frost')) seen.push(t); return oe(t, p); };

FR().setFreezeSeed(7);
T.start('ICE', 'ROBOT');
T.holdSpawns();
console.log('dispatch:', W().updateArsenalProjectiles.name, 'swapped=', !!W().__hrPassSwapped, 'M=', !!HR.match, 'forceBase=', !!HR._forceBasePass);
let aqCalls = 0, glCalls = 0;
const oaq = W().updateArsenalProjectiles.bind(W());
W().updateArsenalProjectiles = (...a) => { aqCalls++; return oaq(...a); };
console.log('globalUpdateProjectiles=', typeof win.updateProjectiles);
const [a, b] = H.fighters();
W().equip(a, 'PISTOL');
W().getHolder(a).__frostFrozen = { weaponId: 'PISTOL', at: 0 };
a.x = 300; a.y = 500; a.setDir(1, 0); a.baseSpeed = 0;
b.x = 600; b.y = 500; b.setDir(-1, 0); b.baseSpeed = 0;
const ct = HR.byCombatant(a);
let tagCalls = 0, hitCalls = 0;
const otb = FR().tagFrozenBullet.bind(FR()), onb = FR().noteBodyHit.bind(FR());
FR().tagFrozenBullet = (...a) => { tagCalls++; return otb(...a); };
FR().noteBodyHit = (...a) => { hitCalls++; return onb(...a); };
let dumped = false;
for (let i = 0; i < 200; i++) {
  T.step(1 / 60);
  if (!dumped) {
    const ps = (win.projectiles || []).filter((q) => q && q.type === 'aq_bullet');
    if (ps.length) {
      dumped = true;
      const fr = ps[0].__hr && ps[0].__hr.frost;
      console.log('midflight:', JSON.stringify({ hrKeys: ps[0].__hr && Object.keys(ps[0].__hr), frostGroup: fr && fr.group, fam: ps[0].family, owner: ps[0].owner && ps[0].owner.name, holderFrozen: !!(ps[0].owner && ps[0].owner.data.arsenal && ps[0].owner.data.arsenal.__frostFrozen) }));
    }
  }
  if (i % 40 === 39) console.log(i, JSON.stringify(FR().inspect(ct)), 'bFrozen=', b.hasStatus('freeze'));
}
console.log('events:', seen.join(','));
console.log('tagCalls=', tagCalls, 'hitCalls=', hitCalls, 'aqCalls=', aqCalls);
console.log('b.hp=', b.hp, 'b.slow=', b.hasStatus('slow'));

// A2 contact: fresh match, teleport contact.
seen.length = 0;
T.start('ICE', 'ROBOT');
T.holdSpawns();
const [a2, b2] = H.fighters();
a2.x = 400; a2.y = 500; a2.setDir(1, 0); a2.baseSpeed = 0;
b2.x = 700; b2.y = 500; b2.setDir(-1, 0); b2.baseSpeed = 0;
W().equip(b2, 'PISTOL');
const ct2 = HR.byCombatant(a2);
console.log('A2 cast:', JSON.stringify(HR.pressAbility(a2, 'A2')));
T.step(0.2);
a2.x = b2.x - 10; a2.y = b2.y; // teleport onto enemy
T.step(3 / 60);
console.log('post-contact frostHolder=', !!W().getHolder(a2), 'enemyHolder=', !!W().getHolder(b2),
  'frozen=', !!(W().getHolder(a2) && W().getHolder(a2).__frostFrozen),
  'shock=', b2.hasStatus('slow') && b2.statuses.slow.mult);
console.log('events2:', seen.join(','));
process.exit(0);
