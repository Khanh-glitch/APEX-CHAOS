#!/usr/bin/env node
// Frost presentation first-runnable smoke (temp scaffold; gates subsume it).
import { bootHarness } from './lib/crystalaHarness.mjs';
import fs from 'node:fs';

const H = await bootHarness();
const { win, T } = H;
console.log('gold flag:', win.apexFrostGoldV1, '| pres flag:', win.apexFrostPresentationRuntime);

const HR = win.APEX_HERO_REWORK;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;
T.start('ICE', 'ROBOT');
T.holdSpawns();
const [a, b] = H.fighters();
a.x = 300; a.y = 500; a.setDir(1, 0);
b.x = 900; b.y = 900; b.setDir(-1, 0);
T.step(0.2);

const t0 = Date.now();
while (Date.now() - t0 < 20000) {
  if (win.APEX_FROST_PRESENTATION && win.APEX_FROST_PRESENTATION.ready) break;
  await new Promise((r) => setTimeout(r, 100));
}
const P = win.APEX_FROST_PRESENTATION;
console.log('presentation ready:', !!P.ready, '| err:', P.error || 'none');

T.step(0.3);
T.redraw();
console.log('idle inspect:', JSON.stringify(P.inspect(a)));

async function snap(name) {
  const rc = H.gameCanvasReal;
  let buf = null;
  try { buf = rc.toBuffer('image/png'); } catch (e) { try { buf = rc.encodeSync ? Buffer.from(rc.encodeSync('png')) : null; } catch (e2) {} }
  if (buf && buf.then) buf = await buf;
  if (buf) { fs.writeFileSync('/tmp/frost_' + name + '.png', buf); console.log('snap', name, buf.length, 'bytes'); }
  else console.log('snap', name, 'UNAVAILABLE');
}
await snap('idle');

// A1: cast via real skill gate, step through release + front travel.
a.x = 300; a.y = 500; a.setDir(1, 0);
win.APEX_ARSENAL_SKILL_GATE.pressJ(a);
T.step(0.1);
console.log('a1 cast inspect:', JSON.stringify(P.inspect(a)));
T.step(0.5);
T.redraw();
console.log('a1 released inspect:', JSON.stringify(P.inspect(a)));
await snap('a1');
T.step(1.0);
console.log('a1 settled inspect:', JSON.stringify(P.inspect(a)));
console.log('gameplay lanes:', JSON.stringify(win.APEX_FROST.inspect(HR.byCombatant(a)).lanes));

// A2: cast, then walk a scripted path with a turn (rival pinned far).
b.x = 900; b.y = 900;
a.x = 300; a.y = 500; a.setDir(1, 0);
HR.pressAbility(a, 'A2');
const path = [[340, 500], [400, 500], [460, 500], [520, 470], [570, 420], [620, 380], [680, 380]];
for (const [x, y] of path) { a.x = x; a.y = y; T.step(0.25); b.x = 900; b.y = 900; }
T.redraw();
console.log('a2 inspect:', JSON.stringify(P.inspect(a)));
await snap('a2');
T.step(3.5);
console.log('a2 done inspect:', JSON.stringify(P.inspect(a)));

// Freeze proc via REAL holder + seeded sweep for a successful roll.
const FR = win.APEX_FROST;
const WAPI = win.APEX_ARSENAL.weaponApi;
WAPI.equip(a, 'PISTOL');
const hold = WAPI.getHolder(a);
hold.__frostFrozen = { weaponId: 'PISTOL', at: 0 };
b.x = a.x + 120; b.y = a.y;
let procd = false;
for (let seed = 1; seed <= 60 && !procd; seed++) {
  FR.setFreezeSeed(seed * 7919 + 13);
  hold.shotsFired = seed;
  const p = { x: b.x - 10, y: b.y, vx: 100, vy: 0, owner: a, __hr: {}, hp: 1, life: 1, type: 'bullet' };
  FR.tagFrozenBullet({}, p, a);
  if (FR.noteBodyHit(p, b)) { procd = true; console.log('proc seed:', seed); }
}
FR.setFreezeSeed(null);
T.step(0.3);
T.redraw();
console.log('freeze inspect:', JSON.stringify(P.inspect(a)), '| b frozen:', b.hasStatus('freeze'));
await snap('freeze');
T.step(1.5);
console.log('thaw inspect:', JSON.stringify(P.inspect(a)), '| b frozen:', b.hasStatus('freeze'));
process.exit(0);
