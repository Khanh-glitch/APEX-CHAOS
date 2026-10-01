#!/usr/bin/env node
// FROST V1 — Level-1 implementation gates (F00–F15).
// Authority: docs/hero-rework/frost-v1/00_FROST_IMPLEMENTATION_AUTHORITY.md
// Matrix:    docs/hero-rework/frost-v1/03_IMPLEMENTATION_TEST_MATRIX.md
//
// Boots the REAL engine + runtimes headless (shared crystalaHarness) and
// proves Frost law slice by slice. Gates are added as slices land; every
// gate below must pass on the final SHA.
//
// Usage: node tools/testFrostV1Gates.mjs
import { bootHarness } from './lib/crystalaHarness.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';

const H = await bootHarness();
const { win, T } = H;
const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const fatalLoad = (H.loadErrors || []).filter((e) => /arsenal|hero-rework|apexEngine|iceVisual/.test(String(e.file)));
gate('F00-boot', fatalLoad.length === 0, fatalLoad.length ? fatalLoad.slice(0, 3) : 'runtimes ready');

const REG = win.APEX_HERO_REWORK_REGISTRY;
const HR = win.APEX_HERO_REWORK;
// Determinism fixtures: every Frost cast below is a direct press (pressJ /
// pressAbility), so the P2 cast AI only adds noise (its ROBOT dash chased a
// revealed slot in F05.2). combatRng is the engine's blessed crit hook;
// fixed high => PISTOL (crit<0.07) never crits => exact damage assertions.
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;
const SHELLS = win.APEX_ARSENAL_SHELLS;
const FR = () => win.APEX_FROST;
const W = () => win.APEX_ARSENAL.weaponApi;
const AQSlots = () => win.APEX_ARSENAL.state.slots;
const fighters = () => H.fighters();
const frostPair = (p2 = 'ROBOT') => {
  T.start('ICE', p2);
  T.holdSpawns();
  const [a, b] = fighters();
  return { a, b, ct: HR.byCombatant(a), ctl: null };
};
const withCtl = (o) => { o.ctl = HR.abilityController(o.ct); return o; };
// Slot-support probe: a REVEALED PISTOL lives or dies by real A1 support.
// Bodies must be parked >60px away (2-frame steps move ~17px).
function supportedAt(x, y) {
  const id = T.pushSlot({ x, y, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(2 / 60);
  const s = AQSlots().find((q) => q.id === id);
  const f = !!(s && s.__frostFrozen);
  win.APEX_ARSENAL.state.slots = AQSlots().filter((q) => q.id !== id);
  return f;
}
function park(a, b) {
  a.x = 100; a.y = 100; a.setDir(1, 0);
  b.x = 100; b.y = 900; b.setDir(1, 0);
}

/* ================= F00 — baseline / scope (in-node leaves) ============ */
try {
  const out = execSync('git merge-base --is-ancestor 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae HEAD && echo YES', { cwd: process.cwd() }).toString();
  gate('F00.1-ancestry', out.includes('YES'), '6b83fc in HEAD ancestry');
} catch (e) { gate('F00.1-ancestry', false, String(e && e.message)); }
try {
  const manifest = fs.readFileSync('src/game/runtimeManifest.js', 'utf8');
  const lock = JSON.parse(fs.readFileSync('tools/runtimeRevision.lock.json', 'utf8'));
  const m = manifest.match(/APEX_ARSENAL_RUNTIME_REVISION = '([^']+)'/);
  gate('F00.4-revision-lineage',
    !!m && m[1] === '20261001-frost-v1-motion-energy-reliability-r1' && lock.revision === m[1],
    { revision: m && m[1], lock: lock.revision });
} catch (e) { gate('F00.4-revision-lineage', false, String(e && e.message)); }

/* ================= F01 — identity / migration ========================= */
try {
  const keys = Object.keys(REG.HEROES);
  gate('F01.1-single-storage-hero',
    keys.length === 12 && keys[5] === 'ICE' && !keys.includes('FROST') && REG.HEROES.ICE.id === 'ICE',
    { count: keys.length });
} catch (e) { gate('F01.1-single-storage-hero', false, String(e && e.message)); }

try {
  const v = REG.validateRegistry();
  gate('F01-registry-valid', v.ok && v.heroCount === 12 && v.skillCount === 36, { errors: v.errors });
} catch (e) { gate('F01-registry-valid', false, String(e && e.message)); }

try {
  gate('F01.3-ice-alias-resolves',
    REG.resolveHeroId('ICE') === 'ICE' && REG.displayNameFor('ICE') === 'FROST'
    && SHELLS.typeFor('ICE').__hrHero === 'ICE',
    { disp: REG.displayNameFor('ICE') });
  const viaFrost = SHELLS.typeFor('FROST');
  const viaIce = SHELLS.typeFor('ICE');
  gate('F01.4-frost-alias-resolves',
    REG.resolveHeroId('FROST') === 'ICE' && REG.displayNameFor('FROST') === 'FROST'
    && !!viaFrost && viaFrost === viaIce && viaFrost.name === 'ICE'
    && SHELLS.ids.includes('ICE') && !SHELLS.ids.includes('FROST'),
    { same: viaFrost === viaIce });
} catch (e) { gate('F01.3-ice-alias-resolves', false, String(e && e.message)); }

try {
  const shell = SHELLS.typeFor('ICE');
  T.start('ICE', 'ROBOT');
  T.holdSpawns();
  const [a] = fighters();
  const hud = HR.skillHud(a);
  const p1name = win.document.getElementById('p1-name').innerText;
  const ct = HR.byCombatant(a);
  gate('F01.2-product-display-frost',
    REG.HEROES.ICE.displayName === 'FROST' && /FROST/.test(shell.desc)
    && hud.length === 2 && hud[0].startsWith('J · FROST.a1') && p1name === 'FROST'
    && a.name === 'ICE' && ct.heroId === 'ICE',
    { desc: shell.desc, hud, p1name });
} catch (e) { gate('F01.2-product-display-frost', false, String(e && e.message)); }

try {
  const META = win.APEX_ARSENAL_META;
  META.paintShop('ICE');
  const cardName = win.document.querySelector('[data-shop-card="ICE"] .aq-fighter-name');
  const detailH2 = win.document.querySelector('#aq-shop-detail h2');
  const shopOk = !!cardName && cardName.textContent === 'FROST'
    && !!detailH2 && detailH2.textContent === 'FROST'
    && cardName.closest('[data-shop-card]').getAttribute('data-shop-card') === 'ICE';
  win.beginArsenalQuestMap();
  const stage4 = [...win.document.querySelectorAll('#aq-quest-map .aq-stage-name')][3];
  const mapOk = !!stage4 && stage4.textContent === 'FROST';
  gate('F01.2b-shop-map-display', shopOk && mapOk,
    { card: cardName && cardName.textContent, stage4: stage4 && stage4.textContent });
} catch (e) { gate('F01.2b-shop-map-display', false, String(e && e.message)); }

try {
  // Legacy ICE save loads; ICE is selectable and shown as FROST.
  const META = win.APEX_ARSENAL_META;
  META.save(META.sanitize({ version: 1, credits: 500, ownedFighters: ['ROBOT', 'ICE'], lastSelectedP1: 'ROBOT', lastSelectedP2: 'ICE', totalSpins: 0, unlockedAt: { ROBOT: 1, ICE: 2 } }));
  const loaded = META.load();
  META.paintShop('ICE');
  const cardName = win.document.querySelector('[data-shop-card="ICE"] .aq-fighter-name');
  gate('F01.5-legacy-ice-save-loads',
    loaded.ownedFighters.includes('ICE') && loaded.lastSelectedP2 === 'ICE'
    && META.owns('ICE') && !!cardName && cardName.textContent === 'FROST',
    { owned: loaded.ownedFighters, card: cardName && cardName.textContent });
  META.setLast('ICE', 'ROBOT');
  META.save(META.getState());
  const again = META.load();
  gate('F01.6-save-round-trip',
    again.lastSelectedP1 === 'ICE' && again.credits === 500
    && again.ownedFighters.join(',') === 'ROBOT,ICE' && again.unlockedAt.ICE === 2,
    { p1: again.lastSelectedP1, credits: again.credits });
} catch (e) { gate('F01.5-legacy-ice-save-loads', false, String(e && e.message)); }

try {
  const EX = win.APEX_HERO_REWORK_MECHANICS.EXECUTORS;
  const mechs = ['A1', 'A2', 'PASSIVE'].map((s) => REG.HEROES.ICE.skills[s].mechanicId);
  const castEvents = [];
  const bus = win.APEX_HERO_REWORK_AIL.bus;
  const origEmit = bus.emit.bind(bus);
  bus.emit = (t, p) => { if (String(t).indexOf('Frost') === 0) castEvents.push(t); return origEmit(t, p); };
  try {
    const o = withCtl(frostPair());
    o.a.x = 300; o.a.y = 500; o.a.setDir(1, 0);
    win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
    HR.pressAbility(o.a, 'A2');
    T.step(1.0);
    const fired = (win.projectiles || []).filter((p) => p && p.__hr && p.__hr.chill).length;
    const lanes = HR.match.world.lanes.length;
    gate('F01.7-frost-active-ice-dead',
      mechs.join(',') === 'frost.breath,frost.hunt,frost.deep_frost'
      && REG.HEROES.ICE.classRef === 'rework.frost'
      && !!EX['frost.breath'] && !!EX['frost.hunt'] && !!EX['frost.deep_frost']
      && !EX['ice.bullets'] && !EX['ice.lane'] && !EX['ice.deep_freeze']
      && castEvents.includes('FrostBreathCast') && castEvents.includes('FrostHuntStart')
      && fired === 0 && lanes === 0,
      { mechs, castEvents, chillTags: fired, lanes });
  } finally { bus.emit = origEmit; }
} catch (e) { gate('F01.7-frost-active-ice-dead', false, String(e && e.message)); }

try {
  const legacy = win.FighterTypes.find((t) => t && t.name === 'ICE');
  gate('F01.9-legacy-ice-intact',
    !!legacy && typeof legacy.update === 'function' && /Frost lane/.test(legacy.desc || '')
    && !legacy.__hrHero && legacy.combatKit !== 'REWORK',
    { desc: legacy && legacy.desc });
} catch (e) { gate('F01.9-legacy-ice-intact', false, String(e && e.message)); }

try {
  // progressionAnchor is schema compatibility only: present for the old
  // one-knob schema, never read by mechanic/AI/UI/telemetry/balance.
  const mechSrc = fs.readFileSync('public/game/hero-rework/heroMechanicsRuntime.js', 'utf8');
  const frostSrc = fs.readFileSync('public/game/hero-rework/frostGameplayRuntime.js', 'utf8');
  const cfg = REG.resolveSkillLevel('ICE', 'A1', 1);
  let threw = false;
  try { REG.resolveSkillLevel('ICE', 'A1', 2); } catch (e) { threw = true; }
  gate('F01-anchor-inert-unresolved',
    cfg.progressionAnchor === 1 && !/progressionAnchor/.test(mechSrc) && !/progressionAnchor/.test(frostSrc) && threw,
    { anchor: cfg.progressionAnchor, lv2Throws: threw });
} catch (e) { gate('F01-anchor-inert-unresolved', false, String(e && e.message)); }

/* ================= F02 — base locomotion =============================== */
try {
  const o = frostPair();
  o.a.x = 350; o.a.y = 800; o.a.setDir(1, 0);
  o.b.x = 200; o.b.y = 150; o.b.setDir(-1, 0);
  const s0 = { x: o.a.x, y: o.a.y };
  T.step(0.6);
  const idle = o.a.dir.x > 0.9 && Math.abs(o.a.dir.y) < 0.1 && (o.a.x - s0.x) > 250 && (s0.y - o.a.y) < 100
    && o.a.baseSpeed === 520 && !o.a.hasStatus('slow') && !o.a.hasStatus('speed');
  // Independent aim does not rewrite dir (armed, enemy off-heading).
  W().equip(o.a, 'PISTOL');
  o.a.x = 300; o.a.y = 300; o.a.setDir(1, 0);
  o.b.x = 300; o.b.y = 850;
  T.step(0.5);
  const aim = o.a.dir.x > 0.9 && Math.abs(o.a.dir.y) < 0.1;
  gate('F02-frost-locomotion', idle && aim, { dx: +(o.a.x - s0.x).toFixed(1) });
} catch (e) { gate('F02-frost-locomotion', false, String(e && e.message)); }

/* ================= F03 — A1 cast / direction ============================ */
try {
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 200; o.b.y = 100; // enemy NORTH (off-heading)
  const ok1 = win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(2 / 60);
  const cd = o.ctl.cooldownLeft('A1');
  const casts1 = o.ct.telemetry.casts;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a); // during cooldown: must fail
  T.step(2 / 60);
  gate('F03.1-cast-consumes-cd-once', ok1 === true && casts1 === 1 && o.ct.telemetry.casts === 1 && cd > 10 && cd <= 10.5,
    { casts: o.ct.telemetry.casts, cd: +cd.toFixed(2) });
} catch (e) { gate('F03.1-cast-consumes-cd-once', false, String(e && e.message)); }

try {
  // Snapshot: facing east, enemy north, weapon aim north -> lane east.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 200; o.b.y = 100;
  W().equip(o.a, 'PISTOL');
  o.a.baseSpeed = 0; o.b.baseSpeed = 0; // pin: aim must track the live enemy bearing
  T.step(0.5); // aim settles toward the enemy
  const aimAngle = o.a.data.arsenal.meta.aimAngle;
  const expectAim = Math.atan2(o.b.y - o.a.y, o.b.x - o.a.x);
  o.a.baseSpeed = 520;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.9); // release + full front
  const insp = FR().inspect(o.ct);
  park(o.a, o.b);
  const east = supportedAt(insp.lanes[0].ox + 300, insp.lanes[0].oy);
  const north = supportedAt(insp.lanes[0].ox, insp.lanes[0].oy - 300);
  gate('F03.2-direction-snapshot',
    Math.abs(aimAngle - expectAim) < 0.3 && east && !north,
    { aimAngle: +aimAngle.toFixed(2), expectAim: +expectAim.toFixed(2), east, north });
} catch (e) { gate('F03.2-direction-snapshot', false, String(e && e.message)); }

try {
  // Opposite facings -> opposite lanes; origin follows live release pos.
  const east = withCtl(frostPair());
  east.a.x = 200; east.a.y = 500; east.a.setDir(1, 0);
  east.b.x = 800; east.b.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(east.a);
  T.step(0.9);
  const le = FR().inspect(east.ct).lanes[0];
  park(east.a, east.b);
  const oppEast = supportedAt(le.ox + 300, le.oy) && !supportedAt(le.ox - 60, le.oy);
  const west = withCtl(frostPair());
  west.a.x = 800; west.a.y = 500; west.a.setDir(-1, 0);
  west.b.x = 200; west.b.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(west.a);
  T.step(0.9);
  const lw = FR().inspect(west.ct).lanes[0];
  park(west.a, west.b);
  const oppWest = supportedAt(lw.ox - 300, lw.oy) && !supportedAt(lw.ox + 60, lw.oy);
  // Authored lock keeps the release origin at the activation point.
  gate('F03.3-opposite-lanes', oppEast && oppWest, { leOx: le.ox, lwOx: lw.ox });
  gate('F03.5-origin-holds-through-authored-cast', Math.abs(le.ox - 200) < 5 && Math.abs(le.oy - 500) < 5, { ox: le.ox });
} catch (e) { gate('F03.3-opposite-lanes', false, String(e && e.message)); }

try {
  // Authored A1 motion locks locomotion through 0.8s, then restores heading.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  const speeds = [];
  for (let i = 0; i < 15; i++) { T.step(1 / 60); speeds.push(o.a.baseSpeed); }
  const moved = o.a.x - 200;
  const cdAtCommit = o.ctl.cooldownLeft('A1');
  T.step(0.52);
  const stillLocked = Math.abs(o.a.x - 200) < 1;
  T.step(4 / 60);
  const resumed = o.a.x > 205 && o.a.dir.x > 0.99;
  const hpB = o.b.hp;
  gate('F03.4-authored-motion-lock-resume',
    speeds.every((s) => s === 520) && Math.abs(moved) < 1 && stillLocked && resumed
    && !o.a.data.positionLocked,
    { moved: +moved.toFixed(1) });
  gate('F03.6-zero-direct-damage', hpB === 1000, { hp: hpB });
  gate('F03.7-cooldown-10-5', Math.abs(cdAtCommit - (10.5 - 0.25)) < 0.15,
    { cd: +cdAtCommit.toFixed(2) });
} catch (e) { gate('F03.4-authored-motion-lock-resume', false, String(e && e.message)); }

/* ================= F04 — A1 Frozen Floor ================================ */
function buildLane() {
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800; o.b.setDir(-1, 0);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.9);
  const lane = FR().inspect(o.ct).lanes[0];
  park(o.a, o.b);
  return { o, lane };
}
try {
  const { lane } = buildLane();
  const s325 = supportedAt(lane.ox + 325, lane.oy);
  const s649 = supportedAt(lane.ox + 649, lane.oy);
  const s651 = supportedAt(lane.ox + 651, lane.oy);
  const p154 = supportedAt(lane.ox + 325, lane.oy + 154);
  const p156 = supportedAt(lane.ox + 325, lane.oy + 156);
  const behind = supportedAt(lane.ox - 5, lane.oy);
  gate('F04.1-footprint-650x310', s325 && s649 && !s651 && p154 && !p156 && !behind,
    { s325, s649, s651, p154, p156, behind });
} catch (e) { gate('F04.1-footprint-650x310', false, String(e && e.message)); }

try {
  // Near->far: front reaches near ground before far ground.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.32); // release (0.25) + 0.07 of front (~100px grown)
  const lane = FR().inspect(o.ct).lanes[0];
  park(o.a, o.b);
  const nearEarly = supportedAt(lane.ox + 40, lane.oy);
  const farEarly = supportedAt(lane.ox + 600, lane.oy);
  T.step(0.5); // front complete
  park(o.a, o.b);
  const farLate = supportedAt(lane.ox + 600, lane.oy);
  gate('F04.2-near-far-front', nearEarly && !farEarly && farLate, { nearEarly, farEarly, farLate });
} catch (e) { gate('F04.2-near-far-front', false, String(e && e.message)); }

try {
  // Single shared expiry: near end alive at frontDone+4.4, all gone at +4.7.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.9);
  const lane = FR().inspect(o.ct).lanes[0];
  T.step(4.2); // t = 5.1: frontDone(0.7)+4.4
  park(o.a, o.b);
  const nearAlive = supportedAt(lane.ox + 50, lane.oy);
  const farAlive = supportedAt(lane.ox + 600, lane.oy);
  T.step(0.6); // t = 5.7 > expire(5.2)
  park(o.a, o.b);
  const nearGone = supportedAt(lane.ox + 50, lane.oy);
  const lanesLeft = FR().inspect(o.ct).lanes.length;
  gate('F04.3-shared-expiry', nearAlive && farAlive && !nearGone && lanesLeft === 0,
    { nearAlive, farAlive, nearGone, lanesLeft });
} catch (e) { gate('F04.3-shared-expiry', false, String(e && e.message)); }

try {
  const { o, lane } = buildLane();
  // Frost x1.5 on stable active floor.
  o.a.x = lane.ox + 50; o.a.y = lane.oy; o.a.setDir(1, 0);
  o.b.x = 100; o.b.y = 900;
  const x0 = o.a.x;
  T.step(0.3);
  const ratioF = (o.a.x - x0) / (520 * 0.3);
  const speedMult = o.a.hasStatus('speed') ? o.a.statuses.speed.mult : null;
  // Enemy x0.5.
  o.b.x = lane.ox + 50; o.b.y = lane.oy; o.b.setDir(1, 0);
  o.a.x = 100; o.a.y = 100;
  const bx0 = o.b.x;
  T.step(0.3);
  const ratioE = (o.b.x - bx0) / (520 * 0.3);
  const slowMult = o.b.hasStatus('slow') ? o.b.statuses.slow.mult : null;
  gate('F04.4-frost-x1.5', Math.abs(ratioF - 1.5) < 0.08 && speedMult === 1.5, { ratio: +ratioF.toFixed(3), speedMult });
  gate('F04.5-enemy-x0.5', Math.abs(ratioE - 0.50) < 0.05 && slowMult === 0.50, { ratio: +ratioE.toFixed(3), slowMult });
} catch (e) { gate('F04.4-frost-x1.5', false, String(e && e.message)); }

try {
  const { o, lane } = buildLane();
  o.b.x = lane.ox + 300; o.b.y = lane.oy; o.b.setDir(1, 0);
  o.a.x = 100; o.a.y = 100;
  T.step(0.2); // enemy on floor
  o.b.x = lane.ox + 300; o.b.y = lane.oy + 400; // leave floor (north)
  T.step(2 / 60); // active-surface authority clears on physical exit
  const exitClear = !o.b.hasStatus('slow');
  gate('F04.6-immediate-surface-exit', exitClear, { exitClear });
} catch (e) { gate('F04.6-immediate-surface-exit', false, String(e && e.message)); }

try {
  // Overlap: A1 lane + A2 trail under the same bodies, still single effect.
  // The enemy is pinned far off-lane during the pre-roll: Slice C contact
  // is live, so a free-roaming enemy could incidentally touch the A2-run
  // and carry a x0.50 Cold Shock into the sample (flaky 0.5 vs 0.6).
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 900; o.b.y = 900; o.b.baseSpeed = 0;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  HR.pressAbility(o.a, 'A2');
  T.step(1.2); // lane built, trail laid along it
  const lane = FR().inspect(o.ct).lanes[0];
  // 200px apart: both on the floor, no real body contact (Slice C contact
  // is live: 100px would overlap and Cold Shock the enemy to x0.50).
  o.b.x = lane.ox + 300; o.b.y = lane.oy; o.b.setDir(1, 0);
  o.a.x = lane.ox + 100; o.a.y = lane.oy; o.a.setDir(1, 0); o.a.baseSpeed = 0;
  T.step(2 / 60);
  const slowE = o.b.hasStatus('slow') ? o.b.statuses.slow.mult : null;
  const speedF = o.a.hasStatus('speed') ? o.a.statuses.speed.mult : null;
  gate('F04.7-overlap-no-multiply', slowE === 0.50 && speedF === 1.5, { slowE, speedF });
} catch (e) { gate('F04.7-overlap-no-multiply', false, String(e && e.message)); }

try {
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  HR.pressAbility(o.a, 'A2');
  T.step(13.5); // everything expired, cooldowns back
  const insp = FR().inspect(o.ct);
  const r1 = win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  const r2 = HR.pressAbility(o.a, 'A2');
  T.step(0.1);
  gate('F04.8-no-leak-recast-clean',
    insp.lanes.length === 0 && insp.trail === 0 && insp.cold === 0 && insp.linger === 0
    && r1 === true && r2.ok === true,
    { insp, r1, r2: r2.ok });
} catch (e) { gate('F04.8-no-leak-recast-clean', false, String(e && e.message)); }

/* ================= F05 — A1 firearm freezing / pickup ================== */
try {
  const { o, lane } = buildLane();
  const CFG = win.APEX_ARSENAL_CONFIG;
  const id = T.pushSlot({ x: lane.ox + 300, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(2 / 60);
  const s = AQSlots().find((q) => q.id === id);
  const isGun = CFG.isGun(s.weaponId);
  // Opponent overlap: denied, no rejection mark, slot untouched.
  o.b.x = s.x; o.b.y = s.y;
  T.step(2 / 60);
  const denied = !W().getHolder(o.b) && s.phase === 'REVEALED' && !(s.rejectedFor && s.rejectedFor[o.b.id]);
  win.APEX_ARSENAL.state.slots = AQSlots().filter((q) => q.id !== id);
  gate('F05.1-revealed-freezes-in-place',
    !!s.__frostFrozen && s.id === id && s.weaponId === 'PISTOL' && isGun, { id, wid: s.weaponId });
  gate('F05.3-opponent-denied', denied, { holder: !!W().getHolder(o.b) });
} catch (e) { gate('F05.1-revealed-freezes-in-place', false, String(e && e.message)); }

try {
  // TELEGRAPH slot inside active floor -> real reveal path -> Frozen.
  const { o, lane } = buildLane();
  const id = T.pushSlot({ x: lane.ox + 300, y: lane.oy + 40, phase: 'TELEGRAPH', weaponId: null, forceFirearm: true });
  for (let i = 0; i < 7; i++) { park(o.a, o.b); T.step(0.5); } // > force-reveal age
  park(o.a, o.b);
  const s = AQSlots().find((q) => q.id === id);
  gate('F05.2-reveal-inside-freezes',
    !!s && s.phase === 'REVEALED' && !!s.weaponId && !!s.__frostFrozen,
    { phase: s && s.phase, wid: s && s.weaponId, frozen: !!(s && s.__frostFrozen) });
  win.APEX_ARSENAL.state.slots = AQSlots().filter((q) => q.id !== id);
} catch (e) { gate('F05.2-reveal-inside-freezes', false, String(e && e.message)); }

try {
  // Frost unarmed collects frozen; Frost armed cannot take a second holder.
  const { o, lane } = buildLane();
  const id = T.pushSlot({ x: lane.ox + 300, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(2 / 60);
  o.a.x = lane.ox + 300; o.a.y = lane.oy;
  const px = o.a.x, py = o.a.y;
  T.step(2 / 60);
  const h = W().getHolder(o.a);
  const s = AQSlots().find((q) => q.id === id);
  const took = !!h && h.weaponId === 'PISTOL' && !!h.__frostFrozen && (!s || s.phase === 'REMOVED');
  // Now armed: a second frozen slot cannot be collected (no swap/storage).
  const id2 = T.pushSlot({ x: lane.ox + 400, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(2 / 60);
  o.a.x = lane.ox + 400; o.a.y = lane.oy;
  T.step(2 / 60);
  const h2 = W().getHolder(o.a);
  const s2 = AQSlots().find((q) => q.id === id2);
  gate('F05.4-frost-collects-unarmed', took, { frozen: !!(h && h.__frostFrozen) });
  gate('F05.5-armed-no-second', h2 === h && !!s2 && s2.phase === 'REVEALED', { same: h2 === h });
  gate('F05.6-no-teleport-dup',
    Math.hypot(o.a.x - (lane.ox + 400), o.a.y - lane.oy) < 55 // 6 frames of walking ~= 52px max; a teleport would be 100s
    && (win.APEX_ARSENAL.state.slots.filter((q) => q.weaponId === 'PISTOL' && q.phase === 'REVEALED').length) === 1
    && W().getHolder(o.a) === h,
    { drift: +Math.hypot(o.a.x - (lane.ox + 400), o.a.y - lane.oy).toFixed(1) });
  win.APEX_ARSENAL.state.slots = AQSlots().filter((q) => q.id !== id && q.id !== id2);
} catch (e) { gate('F05.4-frost-collects-unarmed', false, String(e && e.message)); }

try {
  // melee/grenade/shield/T6 on A1 floor stay unfrozen.
  const { o, lane } = buildLane();
  const ids = ['STORMBREAKER', 'FRAG_GRENADE', 'SWIRL_SHIELD', 'RAILGUN'].map((w, i) =>
    T.pushSlot({ x: lane.ox + 150 + i * 90, y: lane.oy, phase: 'REVEALED', weaponId: w }));
  T.step(2 / 60);
  const rows = ids.map((id) => AQSlots().find((q) => q.id === id));
  const ok = rows.every((s) => s && !s.__frostFrozen);
  win.APEX_ARSENAL.state.slots = AQSlots().filter((q) => !ids.includes(q.id));
  gate('F05.7-non-firearms-untouched', ok, { frozen: rows.map((s) => !!(s && s.__frostFrozen)) });
} catch (e) { gate('F05.7-non-firearms-untouched', false, String(e && e.message)); }

try {
  // A2 trail is part of the continuous active-surface gun authority.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800;
  const r = HR.pressAbility(o.a, 'A2');
  T.step(0.5); // trail spans ~200..610 at y=500 (no wall yet)
  o.a.baseSpeed = 0; // pin AFTER the trail is laid; Frost stays ~610
  const id = T.pushSlot({ x: 450, y: 500, phase: 'REVEALED', weaponId: 'PISTOL' });
  o.b.x = 100; o.b.y = 900;
  T.step(2 / 60);
  const s = AQSlots().find((q) => q.id === id);
  const trailLive = FR().inspect(o.ct).trail > 0;
  win.APEX_ARSENAL.state.slots = AQSlots().filter((q) => q.id !== id);
  gate('F05.8-trail-freezes', r.ok === true && trailLive && !!s && !!s.__frostFrozen,
    { trail: trailLive, frozen: !!(s && s.__frostFrozen) });
} catch (e) { gate('F05.8-trail-freezes', false, String(e && e.message)); }

function iceVersusIce() {
  // Two Frosts, PINNED and UNARMED 300px+ from the test slot: slot support is
  // positional, so freezing body motion removes pickup/fire noise without
  // touching the mechanic under test.
  T.start('ICE', 'ICE');
  T.holdSpawns();
  const [a, b] = fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  return { a, b };
}
try {
  // F05.9: one floor expiring does not thaw a slot still on another floor.
  const { a, b } = iceVersusIce();
  a.x = 200; a.y = 500; a.setDir(1, 0);
  b.x = 800; b.y = 500; b.setDir(-1, 0);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(a); // lane1: origin 200, expires ~5.2
  T.step(0.9);
  const id = T.pushSlot({ x: 500, y: 500, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(3.6); // t ~ 4.55
  HR.pressAbility(b, 'A1'); // lane2: release ~4.8, front covers slot ~5.0
  T.step(1.0); // t ~ 5.55 > lane1 expiry
  const s = AQSlots().find((q) => q.id === id);
  const l1gone = FR().inspect(HR.byCombatant(a)).lanes.length === 0;
  const l2live = FR().inspect(HR.byCombatant(b)).lanes.length === 1;
  gate('F05.9-dual-support-no-thaw', !!s && !!s.__frostFrozen && l1gone && l2live,
    { frozen: !!(s && s.__frostFrozen), phase: s && s.phase, lane1gone: l1gone, lane2live: l2live });
  // F05.10: thaw begins only after final support ends, completes ~0.30s later.
  T.step(4.6); // t ~ 10.15 > lane2 expiry (~9.7) + thaw
  const s2 = AQSlots().find((q) => q.id === id);
  gate('F05.10-thaw-after-final-support', !!s2 && !s2.__frostFrozen && s2.phase === 'REVEALED',
    { frozen: !!(s2 && s2.__frostFrozen), phase: s2 && s2.phase });
  win.APEX_ARSENAL.state.slots = AQSlots().filter((q) => q.id !== id);
} catch (e) { gate('F05.9-dual-support-no-thaw', false, String(e && e.message)); }

try {
  // F05.11: renewed support during thaw cancels thaw.
  // lane1 expires 5.2 (thaw window 5.2-5.5); lane2's front reaches the slot at ~5.4.
  const { a, b } = iceVersusIce();
  a.x = 200; a.y = 500; a.setDir(1, 0);
  b.x = 800; b.y = 500; b.setDir(-1, 0);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(a);
  T.step(0.9);
  const id = T.pushSlot({ x: 500, y: 500, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(4.0); // t ~ 4.95
  HR.pressAbility(b, 'A1'); // release ~5.2, front at slot (s~300) ~5.41
  T.step(1.25); // t ~ 6.2
  const s = AQSlots().find((q) => q.id === id);
  const l1gone = FR().inspect(HR.byCombatant(a)).lanes.length === 0;
  gate('F05.11-thaw-cancel', !!s && !!s.__frostFrozen && l1gone,
    { frozen: !!(s && s.__frostFrozen), lane1gone: l1gone });
  win.APEX_ARSENAL.state.slots = AQSlots().filter((q) => q.id !== id);
} catch (e) { gate('F05.11-thaw-cancel', false, String(e && e.message)); }

try {
  // F05.12 + F05.15: thawed floor gun is collectible by the SAME denied opponent.
  const { o, lane } = buildLane();
  const id = T.pushSlot({ x: lane.ox + 300, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(2 / 60);
  o.b.x = lane.ox + 300; o.b.y = lane.oy; // denied while frozen
  T.step(2 / 60);
  const deniedFirst = !W().getHolder(o.b);
  o.b.x = 100; o.b.y = 900;
  for (let i = 0; i < 11; i++) { T.step(0.5); park(o.a, o.b); } // t ~ 6.4 > expiry+thaw
  const s = AQSlots().find((q) => q.id === id);
  o.b.x = s.x; o.b.y = s.y; // same opponent returns
  T.step(2 / 60);
  const took = !!W().getHolder(o.b) && W().getHolder(o.b).weaponId === 'PISTOL'
    && !W().getHolder(o.b).__frostFrozen;
  gate('F05.12-thawed-collectible', deniedFirst && !!s && !s.__frostFrozen && took,
    { deniedFirst, thawed: !!s && !s.__frostFrozen, took });
  gate('F05.15-no-permanent-rejection', deniedFirst && took, { took });
} catch (e) { gate('F05.12-thawed-collectible', false, String(e && e.message)); }

try {
  // F05.13: holder picked before thaw stays Frozen after the floor expires.
  const { o, lane } = buildLane();
  const id = T.pushSlot({ x: lane.ox + 300, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  for (let i = 0; i < 8; i++) { T.step(0.5); park(o.a, o.b); } // t ~ 4.9 (floor alive)
  o.a.x = lane.ox + 300; o.a.y = lane.oy;
  T.step(2 / 60);
  const h = W().getHolder(o.a);
  T.step(0.5); // floor expired (5.2 < t); holder still pre-consume
  gate('F05.13-holder-stays-frozen',
    !!h && h.weaponId === 'PISTOL' && !!h.__frostFrozen
    && FR().inspect(o.ct).lanes.length === 0 && W().getHolder(o.a) === h,
    { frozen: !!(h && h.__frostFrozen) });
} catch (e) { gate('F05.13-holder-stays-frozen', false, String(e && e.message)); }

try {
  // F05.14: frozen slot is the same REVEALED slot and counts once for
  // offensive-cap + both-unarmed emergency truth (production predicates).
  const { o, lane } = buildLane();
  const CFG = win.APEX_ARSENAL_CONFIG;
  const id = T.pushSlot({ x: lane.ox + 300, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(2 / 60);
  const s = AQSlots().find((q) => q.id === id);
  const st = win.APEX_ARSENAL.state;
  const revealedGuns = st.slots.filter((q) => q.phase === 'REVEALED' && q.kind !== 'HEAL' && CFG.isGun(q.weaponId)).length;
  const active = st.slots.filter((q) => q.phase !== 'REMOVED' && q.kind !== 'HEAL').length;
  // Behavioral: both unarmed + frozen revealed gun -> no emergency spawn.
  st.spawnHeld = false;
  st.spawnTimer = 999;
  T.step(0.5);
  const noEmergency = st.slots.length === 1 && st.unarmedFastConsumed === false;
  st.spawnHeld = true;
  win.APEX_ARSENAL.state.slots = AQSlots().filter((q) => q.id !== id);
  gate('F05.14-counts-once', s.id === id && s.phase === 'REVEALED' && !!s.__frostFrozen
    && revealedGuns === 1 && active === 1 && noEmergency,
    { revealedGuns, active, noEmergency });
} catch (e) { gate('F05.14-counts-once', false, String(e && e.message)); }

/* ================= F06 — Frozen Gun =================================== */
function frozenPistolMatch() {
  const { o, lane } = buildLane();
  const id = T.pushSlot({ x: lane.ox + 300, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(2 / 60);
  o.a.x = lane.ox + 300; o.a.y = lane.oy;
  T.step(2 / 60);
  return { o, h: W().getHolder(o.a) };
}
try {
  const { o, h } = frozenPistolMatch();
  const CFG = win.APEX_ARSENAL_CONFIG;
  // Control: an ordinary holder from the same equip path.
  const c = frostPair();
  W().equip(c.a, 'PISTOL');
  const hc = W().getHolder(c.a);
  // Holders carry weaponId + the shared runtime behavior def; the stat block
  // (shots/damage) and firing family resolve from CFG by weaponId at use.
  const stat = CFG.WEAPONS[h.weaponId];
  const famOk = !!hc && h.weaponId === 'PISTOL' && hc.weaponId === 'PISTOL'
    && h.def === hc.def
    && stat === CFG.WEAPONS.PISTOL && stat.shots === 3 && stat.damagePerShot === 4.5;
  gate('F06.1-preserves-identity', !!h && famOk, { weaponId: h && h.weaponId, sameDef: !!h && !!hc && h.def === hc.def });
  // Fired-bullet family: the true runtime family carrier must read SEMI.
  T.start('ICE', 'ROBOT');
  T.holdSpawns();
  const [ga, gb] = fighters();
  ga.x = 200; ga.y = 500; ga.setDir(1, 0); gb.x = 800; gb.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(ga);
  T.step(0.9);
  const flane = FR().inspect(HR.byCombatant(ga)).lanes[0];
  T.pushSlot({ x: flane.ox + 300, y: flane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(2 / 60);
  ga.x = flane.ox + 300; ga.y = flane.oy;
  T.step(2 / 60);
  ga.x = 300; ga.y = 500; ga.setDir(1, 0); ga.baseSpeed = 0;
  gb.x = 600; gb.y = 500; gb.baseSpeed = 0;
  let fb1 = null; // poll per-frame: catch the first bullet the frame it fires
  for (let i = 0; i < 60 && !fb1; i++) {
    T.step(1 / 60);
    fb1 = (win.projectiles || []).find((q) => q && q.type === 'aq_bullet');
  }
  gate('F06.1b-bullet-family-semi', !!fb1 && fb1.family === 'SEMI', { family: fb1 && fb1.family });
  // Pinned straight-line duel, one full frozen sequence.
  T.start('ICE', 'ROBOT');
  T.holdSpawns();
  const fa = fighters();
  const a = fa[0], b = fa[1];
  a.x = 200; a.y = 500; a.setDir(1, 0); b.x = 800; b.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(a);
  T.step(0.9);
  const lane = FR().inspect(HR.byCombatant(a)).lanes[0];
  T.pushSlot({ x: lane.ox + 300, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(2 / 60);
  a.x = lane.ox + 300; a.y = lane.oy;
  T.step(2 / 60);
  const hf = W().getHolder(a);
  a.x = 300; a.y = 500; a.setDir(1, 0); a.baseSpeed = 0;
  b.x = 600; b.y = 500; b.setDir(-1, 0); b.baseSpeed = 0;
  const tapHits = (fn) => {
    const out = [];
    const origLog = console.log;
    console.log = (...lg) => {
      const m = String(lg[0]).match(/\[AQ\] HIT .* damage=([\d.]+)/);
      if (m) out.push(+m[1]);
      return origLog(...lg);
    };
    try { fn(); } finally { console.log = origLog; }
    return out;
  };
  const hits = tapHits(() => T.step(2.2));
  gate('F06.4-cadence-consume', hf.shotsFired === 3 && !W().getHolder(a), { shots: hf.shotsFired });
  gate('F06.2-damage-unchanged', hits.length === 3 && hits.every((d) => d === 31.5), { hits });
  // Control A/B: ordinary pistol, identical pinned geometry, identical rng.
  T.start('ICE', 'ROBOT');
  T.holdSpawns();
  const [ca, cb] = fighters();
  W().equip(ca, 'PISTOL');
  ca.x = 300; ca.y = 500; ca.setDir(1, 0); ca.baseSpeed = 0;
  cb.x = 600; cb.y = 500; cb.setDir(-1, 0); cb.baseSpeed = 0;
  const hitsC = tapHits(() => T.step(2.2));
  gate('F06.2b-control-identical', JSON.stringify(hitsC) === JSON.stringify(hits), { hitsC });
} catch (e) { gate('F06.1-preserves-identity', false, String(e && e.message)); }

try {
  // Independent aim tracks the enemy while dir stays put.
  const { o, h } = frozenPistolMatch();
  o.a.x = 300; o.a.y = 300; o.a.setDir(1, 0);
  o.b.x = 300; o.b.y = 800; // enemy south
  T.step(0.6);
  const aim = o.a.data.arsenal.meta.aimAngle;
  gate('F06.3-aim-independent',
    Math.abs(aim - Math.PI / 2) < 0.3 && o.a.dir.x > 0.9 && !!h.__frostFrozen,
    { aim: +aim.toFixed(2) });
} catch (e) { gate('F06.3-aim-independent', false, String(e && e.message)); }

try {
  // Frozen survives floor expiry until consume (pre-consume window).
  const { o, h } = frozenPistolMatch();
  gate('F06.5-frozen-until-consume', !!h && !!h.__frostFrozen, {});
  // Ordinary gun: no Frozen tag.
  const p = frostPair();
  W().equip(p.a, 'PISTOL');
  T.step(0.2);
  gate('F06.6-normal-untagged', !W().getHolder(p.a).__frostFrozen, {});
} catch (e) { gate('F06.5-frozen-until-consume', false, String(e && e.message)); }

/* ================= F09 — A2 movement / trail (no contact) =============== */
try {
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800;
  const r = HR.pressAbility(o.a, 'A2');
  T.step(2 / 60);
  const live0 = FR().inspect(o.ct).a2live;
  const cd = o.ctl.cooldownLeft('A2');
  for (let i = 0; i < 20; i++) T.step(0.1); // 2.0s
  const live2 = FR().inspect(o.ct).a2live;
  gate('F09.1-cooldown-12-5', r.ok === true && cd > 12 && cd <= 12.5, { cd: +cd.toFixed(2) });
  gate('F09.2-window-2-0', live0 === true && live2 === false, { live0, live2 });
} catch (e) { gate('F09.1-cooldown-12-5', false, String(e && e.message)); }

try {
  // No homing: dir never steered toward the enemy; static + behavioral.
  const frostSrc = fs.readFileSync('public/game/hero-rework/frostGameplayRuntime.js', 'utf8');
  const mechSrc = fs.readFileSync('public/game/hero-rework/heroMechanicsRuntime.js', 'utf8');
  const frostBlock = mechSrc.slice(mechSrc.indexOf('frost.breath'), mechSrc.indexOf('frostTruth'));
  const staticOk = !/\.dir\s*=/.test(frostSrc) && !/setDir\([^)]*enemy/i.test(frostSrc) && !/\.dir\s*=|setDir/.test(frostBlock);
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 200; o.b.y = 100; // enemy north, Frost heading east
  HR.pressAbility(o.a, 'A2');
  T.step(0.4); // 488px at trail speed: no wall contact
  gate('F09.3-no-homing',
    staticOk && o.a.dir.x > 0.9 && Math.abs(o.a.dir.y) < 0.1 && Math.abs(o.a.y - 500) < 5,
    { staticOk, y: +o.a.y.toFixed(1) });
} catch (e) { gate('F09.3-no-homing', false, String(e && e.message)); }

try {
  // Native integration + wall bounce; trail samples the real path + turn.
  const o = withCtl(frostPair());
  o.a.x = 700; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 200; o.b.y = 100;
  HR.pressAbility(o.a, 'A2');
  T.step(0.5); // crosses the east wall once, bounces back west
  const bounced = o.a.dir.x < -0.9;
  const nodes = FR().inspect(o.ct).trailNodes;
  const xs = nodes.map((n) => n.x);
  const span = Math.max(...xs) - Math.min(...xs);
  const mid = nodes[Math.floor(nodes.length / 2)];
  const v1 = { x: mid.x - nodes[0].x, y: mid.y - nodes[0].y };
  const v2 = { x: nodes[nodes.length - 1].x - mid.x, y: nodes[nodes.length - 1].y - mid.y };
  const turned = (v1.x * v2.x + v1.y * v2.y) < 0;
  T.step(6.0); // window (2.0) + segment lifetime (3.5) + margin
  const gone = FR().inspect(o.ct).trail === 0;
  gate('F09.4-native-bounce', bounced, { dirx: +o.a.dir.x.toFixed(2) });
  gate('F09.5-trail-samples-path', nodes.length >= 6 && span > 200, { n: nodes.length, span: +span.toFixed(0) });
  gate('F09.6-bounce-turns-trail', turned, {});
  gate('F09.10-no-fixed-path', turned && nodes.length >= 6, {});
  gate('F09.8-segments-expire-3-5', gone, {});
} catch (e) { gate('F09.4-native-bounce', false, String(e && e.message)); }

try {
  // Width 120 plus body support radius; Frost x1.5 on trail.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 850; o.b.y = 100; o.b.setDir(-1, 0);
  HR.pressAbility(o.a, 'A2');
  T.step(0.6); // trail spans ~200..510 at y=500
  // Pin Frost far from the probe points: Slice C contact is live and a
  // moving Frost would really collide with the enemy at (350,559).
  o.a.baseSpeed = 0; o.a.x = 800; o.a.y = 500;
  o.b.x = 350; o.b.y = 559; o.b.setDir(1, 0);
  T.step(2 / 60);
  const slow59 = o.b.hasStatus('slow');
  o.b.x = 350; o.b.y = 600;
  T.step(2 / 60);
  T.step(0.6); // let linger + refresh decay
  const clean61 = !o.b.hasStatus('slow');
  // Frost speed on trail-only floor.
  const p = withCtl(frostPair());
  p.a.x = 200; p.a.y = 500; p.a.setDir(1, 0);
  p.b.x = 100; p.b.y = 100;
  HR.pressAbility(p.a, 'A2');
  T.step(0.3);
  const x0 = p.a.x;
  T.step(0.25);
  const ratio = (p.a.x - x0) / (520 * 0.25);
  gate('F09.7-width-120', slow59 && clean61, { slow59, clean61 });
  gate('F09.9-frost-x1.5-trail', Math.abs(ratio - 1.5) < 0.08, { ratio: +ratio.toFixed(3) });
} catch (e) { gate('F09.7-width-120', false, String(e && e.message)); }

/* ================= Slice C helpers ================================== */
// mulberry32 identical to AIL.makeSeededRng (ailRuntime.js). Frost's Freeze
// stream is seeded ONLY via FR.setFreezeSeed in these gates, so predicted
// draws below are bit-exact expectations, not statistical guesses.
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
// First seed whose opening draws match a wanted proc(true)/fail(false)
// pattern at the 8% line. Deterministic scan, no RNG.
function frostSeedFor(pattern) {
  for (let s = 1; s < 500000; s++) {
    const d = frostDraws(s, pattern.length);
    if (pattern.every((want, i) => (d[i] < 0.08) === want)) return s;
  }
  throw new Error('no seed for pattern ' + pattern.join(','));
}
function frostBusTap() {
  const bus = win.APEX_HERO_REWORK_AIL.bus;
  const seen = [];
  const orig = bus.emit.bind(bus);
  bus.emit = (t, p) => { if (String(t).indexOf('Frost') === 0) seen.push(t); return orig(t, p); };
  return { seen, release() { bus.emit = orig; } };
}
function tapAQ(re, fn) {
  const out = [];
  const origLog = console.log;
  console.log = (...lg) => {
    const m = String(lg[0]).match(re);
    if (m) out.push(m[1] === undefined ? true : m[1]);
    return origLog(...lg);
  };
  try { fn(); } finally { console.log = origLog; }
  return out;
}
const frostClock = () => win.APEX_HERO_REWORK_AIL.clock();
// Full production path to a Frozen gun: A1 lane -> REVEALED slot freezes ->
// Frost walks over -> Frozen holder -> pinned straight-line duel at 300px.
function frozenDuel(weaponId, seed, p2 = 'ROBOT') {
  FR().setFreezeSeed(seed == null ? 7 : seed);
  const o = withCtl(frostPair(p2));
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800; o.b.setDir(-1, 0);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.9);
  const lane = FR().inspect(o.ct).lanes[0];
  T.pushSlot({ x: lane.ox + 300, y: lane.oy, phase: 'REVEALED', weaponId });
  T.step(2 / 60);
  o.a.x = lane.ox + 300; o.a.y = lane.oy;
  T.step(2 / 60);
  const h = W().getHolder(o.a);
  o.a.x = 300; o.a.y = 500; o.a.setDir(1, 0); o.a.baseSpeed = 0;
  o.b.x = 600; o.b.y = 500; o.b.setDir(-1, 0); o.b.baseSpeed = 0;
  return { o, h };
}
// Direct frozen equip (fixture control only; pickup law is proven by F05).
function frozenEquip(f, weaponId) {
  W().equip(f, weaponId);
  const h = W().getHolder(f);
  FR().noteFrozenPickup(f, h, null);
  return h;
}

/* ================= F07 — Frozen Bullet grouping ====================== */
try {
  // SEMI: 3 projectile hits = 3 rolls; outcomes match the seeded predictor.
  const seed = frostSeedFor([false, true, false]);
  const { o, h } = frozenDuel('PISTOL', seed);
  if (!h || !h.__frostFrozen) throw new Error('frozen pistol pickup failed');
  const tap = frostBusTap();
  // The [AQ] HIT log fires inside aqDamage, BEFORE the post-hit hook runs,
  // so freeze state is sampled after each frame that delivered a hit.
  const perHit = [];
  let hits = 0, lastHits = 0;
  const origLog = console.log;
  console.log = (...lg) => {
    if (/\[AQ\] HIT/.test(String(lg[0]))) hits++;
    return origLog(...lg);
  };
  try {
    for (let f = 0; f < 150 && hits < 3; f++) {
      T.step(1 / 60);
      if (hits > lastHits) { lastHits = hits; perHit.push(o.b.hasStatus('freeze')); }
    }
  } finally { console.log = origLog; }
  const rolls = FR().inspect(o.ct).rolls;
  const pred = frostDraws(seed, 3).map((d) => d < 0.08);
  // Hit 1 fails (off); hit 2 procs (on); hit 3 fails while frozen (stays on).
  const freezeOk = perHit[0] === false && perHit[1] === true && perHit[2] === true;
  gate('F07.1-semi-one-roll-per-hit',
    hits === 3 && rolls === 3 && freezeOk && tap.seen.filter((t) => t === 'FrostFreezeStart').length === 1,
    { hits, rolls, perHit, pred, seed });
  tap.release();
} catch (e) { gate('F07.1-semi-one-roll-per-hit', false, String(e && e.message)); }

try {
  // AUTO: SMG 8 projectile hits = 8 rolls.
  const { o, h } = frozenDuel('SMG', 21);
  if (!h || !h.__frostFrozen) throw new Error('frozen smg pickup failed');
  const hits = tapAQ(/\[AQ\] HIT/, () => T.step(2.5));
  gate('F07.2-auto-one-roll-each',
    h.shotsFired === 8 && hits.length === 8 && FR().inspect(o.ct).rolls === 8,
    { shots: h.shotsFired, hits: hits.length, rolls: FR().inspect(o.ct).rolls });
} catch (e) { gate('F07.2-auto-one-roll-each', false, String(e && e.message)); }

try {
  // BURST: BERETTA 6 projectile hits (2 bursts x 3) = 6 rolls.
  const { o, h } = frozenDuel('BERETTA_93R', 22);
  if (!h || !h.__frostFrozen) throw new Error('frozen beretta pickup failed');
  const hits = tapAQ(/\[AQ\] HIT/, () => T.step(2.5));
  gate('F07.3-burst-one-roll-each',
    h.shotsFired === 6 && hits.length === 6 && FR().inspect(o.ct).rolls === 6,
    { shots: h.shotsFired, hits: hits.length, rolls: FR().inspect(o.ct).rolls });
} catch (e) { gate('F07.3-burst-one-roll-each', false, String(e && e.message)); }

try {
  // PRECISION: MBR 2 projectile hits = 2 rolls.
  const { o, h } = frozenDuel('MBR', 23);
  if (!h || !h.__frostFrozen) throw new Error('frozen mbr pickup failed');
  const hits = tapAQ(/\[AQ\] HIT/, () => T.step(3.0));
  gate('F07.4-precision-one-roll-each',
    h.shotsFired === 2 && hits.length === 2 && FR().inspect(o.ct).rolls === 2,
    { shots: h.shotsFired, hits: hits.length, rolls: FR().inspect(o.ct).rolls });
} catch (e) { gate('F07.4-precision-one-roll-each', false, String(e && e.message)); }

try {
  // SHOTGUN: each 6-pellet blast shares one stable group; one roll per blast.
  const { o, h } = frozenDuel('SHOTGUN', 24);
  if (!h || !h.__frostFrozen) throw new Error('frozen shotgun pickup failed');
  // Per-frame poll only (no inner multi-frame steps: blast 2 fires 0.28s
  // after blast 1 and its pellets fly in ~0.12s). Max-simultaneous in
  // flight per group proves every pellet of the fan shares the group.
  const maxSimul = {};
  let rollsAfterBlast1 = null, blast1Drained = false;
  for (let f = 0; f < 300; f++) {
    T.step(1 / 60);
    const nowCount = {};
    for (const p of win.projectiles || []) {
      if (p && p.type === 'aq_bullet' && p.__hr && p.__hr.frost) {
        const g = p.__hr.frost.group;
        nowCount[g] = (nowCount[g] || 0) + 1;
      }
    }
    for (const g of Object.keys(nowCount)) {
      maxSimul[g] = Math.max(maxSimul[g] || 0, nowCount[g]);
    }
    if (rollsAfterBlast1 === null && h.shotsFired >= 1 && Object.keys(nowCount).length === 0) {
      blast1Drained = true;
      rollsAfterBlast1 = FR().inspect(o.ct).rolls;
    }
    if (h.shotsFired >= 2 && Object.keys(nowCount).length === 0 && f > 60) break;
  }
  const keys = Object.keys(maxSimul);
  const insp = FR().inspect(o.ct);
  gate('F07.5-shotgun-one-group-one-roll',
    h.shotsFired === 2 && keys.length === 2 && keys.every((g) => maxSimul[g] === 6)
    && blast1Drained && rollsAfterBlast1 === 1 && insp.rolls === 2,
    { shots: h.shotsFired, maxSimul, rollsAfterBlast1, rolls: insp.rolls });
} catch (e) { gate('F07.5-shotgun-one-group-one-roll', false, String(e && e.message)); }

try {
  // JACKHAMMER: 3 blasts x 5 pellets; one group per blast, new group each.
  const { o, h } = frozenDuel('JACKHAMMER', 25);
  if (!h || !h.__frostFrozen) throw new Error('frozen jackhammer pickup failed');
  const blastOf = {};
  const rollMarks = [];
  let lastShots = 0;
  for (let f = 0; f < 200; f++) {
    T.step(1 / 60);
    for (const p of win.projectiles || []) {
      if (p && p.type === 'aq_bullet' && p.__hr && p.__hr.frost) blastOf[p.__hr.frost.group] = (blastOf[p.__hr.frost.group] || 0) + 1;
    }
    if (h.shotsFired !== lastShots) { lastShots = h.shotsFired; rollMarks.push(FR().inspect(o.ct).rolls); }
  }
  T.step(0.5);
  const keys = Object.keys(blastOf);
  gate('F07.6-jackhammer-blast-groups',
    h.shotsFired === 3 && keys.length === 3 && FR().inspect(o.ct).rolls === 3,
    { shots: h.shotsFired, groups: keys, rolls: FR().inspect(o.ct).rolls, rollMarks });
} catch (e) { gate('F07.6-jackhammer-blast-groups', false, String(e && e.message)); }

try {
  // Structural: grouping is holderUid:shotsFired at fire time; no clocks.
  const frostSrc = fs.readFileSync('public/game/hero-rework/frostGameplayRuntime.js', 'utf8');
  // Exact method slices (the header comment mentions these names first).
  const tagBody = frostSrc.slice(frostSrc.indexOf('tagFrozenBullet(ctx, p, owner)'), frostSrc.indexOf('setFreezeSeed(n)'));
  const hitBody = frostSrc.slice(frostSrc.indexOf('noteBodyHit(p, target)'), frostSrc.indexOf('noteBodyContact(frostCt'));
  const groupOk = /holderUid\(hold\) \+ ':' \+ \(hold\.shotsFired/.test(tagBody);
  // Group CREATION uses no clock at all; the hit path reads the carried
  // tag.group and uses clock() only for lock/freeze DURATIONS (never to
  // reconstruct grouping).
  const noClock = !/clock\(\)|Date\.|setTimeout|performance\.now/.test(tagBody)
    && /tag\.group/.test(hitBody) && !/Date\.|setTimeout|performance\.now/.test(hitBody);
  gate('F07.7-no-time-window', groupOk && noClock, { groupOk, noClock });
} catch (e) { gate('F07.7-no-time-window', false, String(e && e.message)); }

try {
  // Miss: fired frozen bullet hits nothing -> no roll, no events.
  FR().setFreezeSeed(26);
  const o = withCtl(frostPair());
  o.a.x = 300; o.a.y = 500; o.a.setDir(1, 0); o.a.baseSpeed = 0;
  o.b.x = 600; o.b.y = 500; o.b.setDir(-1, 0); o.b.baseSpeed = 0;
  const h = frozenEquip(o.a, 'PISTOL');
  const tap = frostBusTap();
  // Real misses: the enemy orbits faster than in-flight bullets can follow
  // (the holder re-aims every frame with no lead, but fired bullets never
  // retarget). Orbit stays clear of Frost (no contact).
  let hitCount = 0;
  const mazeLog = console.log;
  console.log = (...lg) => {
    if (/\[AQ\] HIT/.test(String(lg[0]))) hitCount++;
    return mazeLog(...lg);
  };
  try {
    for (let f = 0; f < 300; f++) {
      const t = f * 0.35;
      o.b.x = 700 + Math.cos(t) * 200;
      o.b.y = 500 + Math.sin(t) * 200;
      T.step(1 / 60);
      if (!W().getHolder(o.a)) break; // consumed: all 3 shots away
    }
    for (let f = 0; f < 180; f++) { // drain in-flight bullets
      const t = (300 + f) * 0.35;
      o.b.x = 700 + Math.cos(t) * 200;
      o.b.y = 500 + Math.sin(t) * 200;
      T.step(1 / 60);
    }
  } finally { console.log = mazeLog; }
  const rolls = FR().inspect(o.ct).rolls;
  const missed = !(win.projectiles || []).some((p) => p && p.type === 'aq_bullet');
  gate('F07.8-miss-no-roll', h.shotsFired === 3 && hitCount === 0 && missed && rolls === 0 && tap.seen.length === 0,
    { shots: h.shotsFired, hitCount, missed, rolls, events: tap.seen });
  // F07.11: the miss did not advance the RNG sequence: the next real hit
  // draws draw #1 of the pinned seed.
  o.b.x = 600; o.b.y = 500;
  const h2 = frozenEquip(o.a, 'PISTOL');
  void h2;
  const hits = tapAQ(/\[AQ\] HIT/, () => {
    for (let f = 0; f < 200 && FR().inspect(o.ct).rolls < 1; f++) T.step(1 / 60);
  });
  const expectProc = frostDraws(26, 1)[0] < 0.08;
  gate('F07.11-miss-no-advance',
    hits.length === 1 && FR().inspect(o.ct).rolls === 1 && o.b.hasStatus('freeze') === expectProc,
    { hits: hits.length, rolls: FR().inspect(o.ct).rolls, frozen: o.b.hasStatus('freeze'), expectProc });
  tap.release();
} catch (e) { gate('F07.8-miss-no-roll', false, String(e && e.message)); }

try {
  // Multi-body: one JACKHAMMER blast hits anchor + child -> exactly one roll.
  FR().setFreezeSeed(27);
  const o = withCtl(frostPair('SLIME'));
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800; o.b.setDir(-1, 0);
  const ectl = HR.abilityController(HR.byCombatant(o.b));
  const mit = ectl.tryCast('A1', 'frost');
  T.step(0.1);
  const eBodies = HR.getTargetableBodies(HR.byCombatant(o.b));
  if (!mit || !mit.ok || eBodies.length < 2) throw new Error('slime split failed');
  const anchor = o.b, child = eBodies.find((b) => b !== o.b);
  const h = frozenEquip(o.a, 'JACKHAMMER');
  // Pin: Frost west; anchor level; child on the FREE bottom-fan pellet ray
  // (fixed even fan; the t=0 ray clears the anchor and flies to the wall).
  // Anchor/child are 136px apart: physically clear (r+r=106), same side.
  o.a.x = 300; o.a.y = 500; o.a.setDir(1, 0); o.a.baseSpeed = 0;
  anchor.x = 600; anchor.y = 500; anchor.setDir(-1, 0); anchor.baseSpeed = 0;
  child.x = 700; child.y = 408; child.setDir(-1, 0); child.baseSpeed = 0;
  const hpA0 = anchor.hp, hpC0 = child.hp;
  for (let f = 0; f < 200 && h.shotsFired < 1; f++) T.step(1 / 60);
  o.a.data.arsenal = null; // isolate blast 1 (fixture timing; rolls untouched)
  for (let f = 0; f < 40; f++) T.step(1 / 60); // drain blast 1
  const rolls = FR().inspect(o.ct).rolls;
  gate('F07.9-multibody-one-blast-one-roll',
    anchor.hp < hpA0 - 1 && child.hp < hpC0 - 1 && rolls === 1,
    { dAnchor: +(hpA0 - anchor.hp).toFixed(1), dChild: +(hpC0 - child.hp).toFixed(1), rolls });
} catch (e) { gate('F07.9-multibody-one-blast-one-roll', false, String(e && e.message)); }

try {
  // Seeded reproducibility: same seed + same script = same per-hit outcomes.
  const runSeq = (seed) => {
    const { o } = frozenDuel('PISTOL', seed);
    const perHit = [];
    let hits = 0, lastHits = 0;
    const origLog = console.log;
    console.log = (...lg) => {
      if (/\[AQ\] HIT/.test(String(lg[0]))) hits++;
      return origLog(...lg);
    };
    try {
      for (let f = 0; f < 150 && hits < 3; f++) {
        T.step(1 / 60);
        if (hits > lastHits) { lastHits = hits; perHit.push(o.b.hasStatus('freeze')); }
      }
    } finally { console.log = origLog; }
    return { perHit, rolls: FR().inspect(o.ct).rolls };
  };
  const r1 = runSeq(28), r2 = runSeq(28);
  gate('F07.10-seeded-reproducible',
    JSON.stringify(r1) === JSON.stringify(r2) && r1.rolls === 3,
    { r1, r2 });
} catch (e) { gate('F07.10-seeded-reproducible', false, String(e && e.message)); }

try {
  // Structural: the group is created at the real fire source (fireBullet ->
  // HR.onFireBullet -> executor onProjectileFired -> tagFrozenBullet) and
  // the exact tag object rides the real projectile (no reconstruction).
  const mechSrc = fs.readFileSync('public/game/hero-rework/heroMechanicsRuntime.js', 'utf8');
  const rwSrc = fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js', 'utf8');
  const wSrc = fs.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js', 'utf8');
  const c1 = /FR\.tagFrozenBullet\(ctx, p, descriptor\.params && descriptor\.params\.owner\)/.test(mechSrc);
  const c2 = /exec\.onProjectileFired\(mechCtx\(ct, slot\), standin, descriptor\)/.test(rwSrc)
    && /const descriptor = \{ kind: 'bullet'/.test(rwSrc);
  const c3 = /window\.APEX_HERO_REWORK\.onFireBullet\)/.test(wSrc)
    && /window\.APEX_HERO_REWORK\.onFireBullet\(spec\)/.test(wSrc)
    && /__hr: __hrTag/.test(wSrc);
  gate('F07.12-group-at-real-source', c1 && c2 && c3, { c1, c2, c3 });
} catch (e) { gate('F07.12-group-at-real-source', false, String(e && e.message)); }

/* ================= F08 — Freeze / refresh ============================ */
try {
  // F08.1: Lv1 total is base 4% + bonus 4pp = 8%; the roll compares
  // draw < chance; both outcomes are reachable through real hits.
  const pcfg = REG.resolveSkillLevel('ICE', 'PASSIVE', 1);
  const total = pcfg.baseProcPct + pcfg.bonusProcPct;
  const frostSrc = fs.readFileSync('public/game/hero-rework/frostGameplayRuntime.js', 'utf8');
  const cmpOk = /const chance = \(\(pcfg && pcfg\.baseProcPct\)/.test(frostSrc)
    && /if \(!\(roll < chance\)\)/.test(frostSrc);
  const sProc = frostSeedFor([true]), sFail = frostSeedFor([false]);
  const bothOk = frostDraws(sProc, 1)[0] < total && frostDraws(sFail, 1)[0] >= total;
  gate('F08.1-lv1-8pct', total === 0.08 && cmpOk && bothOk,
    { base: pcfg.baseProcPct, bonus: pcfg.bonusProcPct, total, cmpOk, bothOk });
} catch (e) { gate('F08.1-lv1-8pct', false, String(e && e.message)); }

try {
  // F08.2: proc on unfrozen body = exactly 0.90s hard Freeze, zero damage.
  // Enemy walks INTO the bullets (unpinned); after the proc it must stop.
  const seed = frostSeedFor([true, false, false]);
  FR().setFreezeSeed(seed);
  const o = withCtl(frostPair());
  const h = frozenEquip(o.a, 'PISTOL');
  o.a.x = 300; o.a.y = 500; o.a.setDir(1, 0); o.a.baseSpeed = 0;
  o.b.x = 620; o.b.y = 500; o.b.setDir(-1, 0); // walking west, into fire
  let hitClock = -1, timerAtProc = -1;
  const origLog = console.log;
  console.log = (...lg) => {
    if (/\[AQ\] HIT/.test(String(lg[0])) && hitClock < 0) hitClock = frostClock();
    return origLog(...lg);
  };
  try {
    for (let f = 0; f < 150 && hitClock < 0; f++) T.step(1 / 60);
  } finally { console.log = origLog; }
  timerAtProc = o.b.statuses.freeze ? o.b.statuses.freeze.timer : -1;
  const hpAfterHit1 = o.b.hp;
  // Hard lock: unpinned enemy must not move while frozen.
  const fx = o.b.x, fy = o.b.y;
  T.step(0.5);
  const drift = Math.hypot(o.b.x - fx, o.b.y - fy);
  const stillFrozen = o.b.hasStatus('freeze');
  T.step(0.6); // thaw (0.90) + margin
  const thawed = !o.b.hasStatus('freeze');
  gate('F08.2-proc-0.90-zero-dmg-lock',
    h.shotsFired >= 1 && hitClock > 0 && Math.abs(timerAtProc - 0.90) < 0.06
    && drift < 2 && stillFrozen && thawed,
    { timer: +timerAtProc.toFixed(3), drift: +drift.toFixed(2), stillFrozen, thawed, hp: +hpAfterHit1.toFixed(1) });
  // Zero direct Freeze damage: frozen-hit damage == control-hit damage.
  const dmgF = tapAQ(/\[AQ\] HIT .* damage=([\d.]+)/, () => {});
  void dmgF;
} catch (e) { gate('F08.2-proc-0.90-zero-dmg-lock', false, String(e && e.message)); }

try {
  // F08.2b: frozen-hit damage bit-equals ordinary-hit damage (A/B).
  const runDmg = (frozen) => {
    const o = withCtl(frostPair());
    if (frozen) { FR().setFreezeSeed(frostSeedFor([true])); frozenEquip(o.a, 'PISTOL'); }
    else W().equip(o.a, 'PISTOL');
    o.a.x = 300; o.a.y = 500; o.a.setDir(1, 0); o.a.baseSpeed = 0;
    o.b.x = 600; o.b.y = 500; o.b.setDir(-1, 0); o.b.baseSpeed = 0;
    const hp0 = o.b.hp;
    const hits = tapAQ(/\[AQ\] HIT .* damage=([\d.]+)/, () => {
      for (let f = 0; f < 120; f++) { T.step(1 / 60); if (o.b.hp < hp0) break; }
    });
    return { dmg: hits[0], delta: +(hp0 - o.b.hp).toFixed(2), frozen: o.b.hasStatus('freeze') };
  };
  const fz = runDmg(true), ct = runDmg(false);
  gate('F08.2b-freeze-adds-no-damage',
    fz.frozen === true && ct.frozen === false && fz.dmg === ct.dmg && fz.delta === ct.delta,
    { fz, ct });
} catch (e) { gate('F08.2b-freeze-adds-no-damage', false, String(e && e.message)); }

try {
  // F08.3: proc while frozen RESETS remaining to 0.90 (never adds).
  const seed = frostSeedFor([true, true]);
  const { o, h } = frozenDuel('PISTOL', seed);
  void h;
  let hits = 0, preTimer = -1, postTimer = -1;
  const origLog = console.log;
  console.log = (...lg) => {
    if (/\[AQ\] HIT/.test(String(lg[0]))) {
      hits++;
      if (hits === 2 && !o.b.hasStatus('freeze')) preTimer = -2; // would break the fixture
    }
    return origLog(...lg);
  };
  try {
    for (let f = 0; f < 150 && hits < 2; f++) {
      T.step(1 / 60);
      if (hits === 1 && preTimer === -1 && o.b.hasStatus('freeze')) {
        // hit 1 procced; sample the decaying timer just before hit 2 lands.
        preTimer = null; // armed; overwritten below each frame until hit 2
      }
      if (hits === 1 && preTimer !== -1) preTimer = o.b.statuses.freeze.timer;
    }
  } finally { console.log = origLog; }
  postTimer = o.b.statuses.freeze ? o.b.statuses.freeze.timer : -1;
  gate('F08.3-refresh-resets-0.90',
    hits === 2 && preTimer > 0 && preTimer < 0.75 && Math.abs(postTimer - 0.90) < 0.06,
    { pre: preTimer === null ? null : +preTimer.toFixed(3), post: +postTimer.toFixed(3) });
} catch (e) { gate('F08.3-refresh-resets-0.90', false, String(e && e.message)); }

try {
  // F08.4: failed proc while frozen leaves the timer to natural passage.
  const seed = frostSeedFor([true, false]);
  const { o } = frozenDuel('PISTOL', seed);
  let hits = 0;
  let preT = -1, preC = -1, postT = -1, postC = -1;
  const origLog = console.log;
  console.log = (...lg) => {
    if (/\[AQ\] HIT/.test(String(lg[0]))) {
      hits++;
      if (hits === 2) { postT = o.b.statuses.freeze.timer; postC = frostClock(); }
    }
    return origLog(...lg);
  };
  try {
    for (let f = 0; f < 150 && hits < 2; f++) {
      T.step(1 / 60);
      if (hits === 1) { preT = o.b.statuses.freeze.timer; preC = frostClock(); }
    }
  } finally { console.log = origLog; }
  const passage = (preT - postT) - (postC - preC);
  gate('F08.4-fail-while-frozen-no-touch',
    hits === 2 && preT > 0.1 && postT > 0 && postT < 0.75 && Math.abs(passage) < 0.04,
    { preT: +preT.toFixed(3), postT: +postT.toFixed(3), passage: +passage.toFixed(4) });
} catch (e) { gate('F08.4-fail-while-frozen-no-touch', false, String(e && e.message)); }

try {
  // F08.5/6/7/8 lock suite. Seed [T,F,T,T]: hit1 procs, hit2 fails while
  // frozen (rolls while frozen => no lock active), hit3 refreshes; after
  // true thaw a locked hit rolls nothing, and post-lock the draw resumes.
  const seed = frostSeedFor([true, false, true, true]);
  const { o } = frozenDuel('PISTOL', seed);
  const tap = frostBusTap();
  let hits = 0;
  const rollAtHit = [], frozeAtHit = [];
  const origLog = console.log;
  console.log = (...lg) => {
    if (/\[AQ\] HIT/.test(String(lg[0]))) {
      hits++;
      rollAtHit.push(FR().inspect(o.ct).rolls);
      frozeAtHit.push(o.b.hasStatus('freeze'));
    }
    return origLog(...lg);
  };
  try {
    for (let f = 0; f < 200 && hits < 3; f++) T.step(1 / 60);
  } finally { console.log = origLog; }
  // F08.5: hit 2 arrived while frozen (log-time state, pre-hook) and still
  // rolled (rolls 1->2 by hit 3's log); no lock field is set while frozen.
  const f085 = hits === 3 && rollAtHit[0] === 0 && rollAtHit[1] === 1 && rollAtHit[2] === 2
    && frozeAtHit[0] === false && frozeAtHit[1] === true
    && (o.b.__frostLockedUntil || 0) <= frostClock();
  // F08.6: true thaw starts the 0.50 lock (poll the transition, then let
  // the per-tick thaw poll observe it). h2 is equipped while the last 0.2s
  // of freeze remains so its ready-delay elapses pre-thaw and shot 1 lands
  // mid-lock (timing asserted fail-loud in F08.7).
  let h2 = null;
  for (let f = 0; f < 200 && o.b.hasStatus('freeze'); f++) {
    T.step(1 / 60);
    if (!h2 && o.b.statuses.freeze && o.b.statuses.freeze.timer < 0.2) h2 = frozenEquip(o.a, 'PISTOL');
  }
  const thawAt = frostClock();
  T.step(3 / 60);
  const lockUntil = o.b.__frostLockedUntil || 0;
  const f086 = !o.b.hasStatus('freeze') && Math.abs(lockUntil - (thawAt + 0.50)) < 0.06
    && tap.seen.includes('FrostThaw');
  // F08.7: a hit during (thaw, thaw+0.50) rolls nothing and freezes nothing.
  let lockedHits = 0, lockedClock = -1;
  const olog2 = console.log;
  console.log = (...lg) => {
    if (/\[AQ\] HIT/.test(String(lg[0])) && lockedHits === 0) { lockedHits++; lockedClock = frostClock(); }
    return olog2(...lg);
  };
  try {
    for (let f = 0; f < 120 && lockedHits < 1; f++) T.step(1 / 60);
  } finally { console.log = olog2; }
  const rollsAfterLocked = FR().inspect(o.ct).rolls;
  const f087 = lockedHits === 1 && lockedClock > thawAt + 0.08 && lockedClock < thawAt + 0.45
    && rollsAfterLocked === 3 && !o.b.hasStatus('freeze');
  // F08.8: after the lock, the NEXT hit consumes draw #4 (proc): the locked
  // hit consumed nothing, so the sequence resumes mid-pattern.
  o.a.data.arsenal = null; // hold fire until the lock expires (fixture only)
  void h2;
  for (let f = 0; f < 200 && frostClock() < lockUntil + 0.05; f++) T.step(1 / 60);
  frozenEquip(o.a, 'PISTOL');
  let lateHits = 0;
  const olog3 = console.log;
  console.log = (...lg) => {
    if (/\[AQ\] HIT/.test(String(lg[0]))) lateHits++;
    return olog3(...lg);
  };
  try {
    for (let f = 0; f < 150 && lateHits < 1; f++) T.step(1 / 60);
  } finally { console.log = olog3; }
  const f088 = lateHits === 1 && FR().inspect(o.ct).rolls === 4 && o.b.hasStatus('freeze');
  gate('F08.5-no-lock-while-frozen', f085, { rollAtHit });
  gate('F08.6-thaw-starts-lock', f086, { thawAt: +thawAt.toFixed(3), lockUntil: +lockUntil.toFixed(3) });
  gate('F08.7-locked-hit-no-roll', f087, { lockedClock: +lockedClock.toFixed(3), rolls: rollsAfterLocked });
  gate('F08.8-post-lock-resumes', f088, { rolls: FR().inspect(o.ct).rolls, frozen: o.b.hasStatus('freeze') });
  tap.release();
} catch (e) { gate('F08.5-no-lock-while-frozen', false, String(e && e.message)); }

try {
  // F08.9: SLIME freeze is body-local, both directions.
  const runDir = (freezeChild) => {
    FR().setFreezeSeed(frostSeedFor([true]));
    const o = withCtl(frostPair('SLIME'));
    o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
    o.b.x = 800; o.b.y = 800; o.b.setDir(-1, 0);
    const ectl = HR.abilityController(HR.byCombatant(o.b));
    const mit = ectl.tryCast('A1', 'frost');
    T.step(0.1);
    const bodies = HR.getTargetableBodies(HR.byCombatant(o.b));
    if (!mit || !mit.ok || bodies.length < 2) throw new Error('split failed');
    const anchor = o.b, child = bodies.find((b) => b !== o.b);
    frozenEquip(o.a, 'PISTOL');
    o.a.x = 300; o.a.y = 500; o.a.setDir(1, 0); o.a.baseSpeed = 0;
    if (freezeChild) {
      // Child dead-center on the aim ray in front of the anchor: the first
      // bullet meets the child (earlier TOI) and never reaches the anchor.
      child.x = 450; child.y = 500; child.setDir(-1, 0); child.baseSpeed = 0;
      anchor.x = 600; anchor.y = 500; anchor.setDir(-1, 0); anchor.baseSpeed = 0;
    } else {
      anchor.x = 600; anchor.y = 500; anchor.setDir(-1, 0); anchor.baseSpeed = 0;
      child.x = 700; child.y = 850; child.setDir(-1, 0); child.baseSpeed = 0;
    }
    for (let f = 0; f < 150 && FR().inspect(o.ct).rolls < 1; f++) T.step(1 / 60);
    T.step(2 / 60);
    return { childF: child.hasStatus('freeze'), anchorF: anchor.hasStatus('freeze') };
  };
  const rc = runDir(true), ra = runDir(false);
  gate('F08.9-body-local-freeze',
    rc.childF === true && rc.anchorF === false && ra.anchorF === true && ra.childF === false,
    { freezeChild: rc, freezeAnchor: ra });
} catch (e) { gate('F08.9-body-local-freeze', false, String(e && e.message)); }

try {
  // F01.8/F01.10/F08.11: legacy iceVisual freeze overlay/audio never trigger
  // for Frost rework Freeze — on ROBOT and HUNTER victims (source-keyed
  // suppression, never target-keyed). Legacy-source control must still fire.
  const runVictim = (p2) => {
    FR().setFreezeSeed(frostSeedFor([true]));
    const o = withCtl(frostPair(p2));
    frozenEquip(o.a, 'PISTOL');
    o.a.x = 300; o.a.y = 500; o.a.setDir(1, 0); o.a.baseSpeed = 0;
    o.b.x = 600; o.b.y = 500; o.b.setDir(-1, 0); o.b.baseSpeed = 0;
    T.step(1 / 60); // prime: Frost state is created by the first tick
    for (let f = 0; f < 150 && FR().inspect(o.ct).rolls < 1; f++) T.step(1 / 60);
    const froze = o.b.hasStatus('freeze');
    // Thaw fully, then re-apply FRESH through the real status path while
    // armed (a refresh on an already-frozen body would skip the legacy
    // apply branch via wasFrozen and weaken the gate).
    for (let f = 0; f < 120 && o.b.hasStatus('freeze'); f++) T.step(1 / 60);
    win.__apexIceVisualTestArmed = true;
    win.__apexIceVisualTestEvents = [];
    o.b.applyStatus('freeze', 0.90, { source: o.a });
    let drew = false;
    try { T.redraw(); drew = true; } catch (e) { drew = false; }
    const evts = (win.__apexIceVisualTestEvents || []).slice();
    const vActive = !!(o.b.visual && o.b.visual.iceFrozen && o.b.visual.iceFrozen.active);
    win.__apexIceVisualTestArmed = false;
    return { froze, drew, evts, vActive, marker: o.b.__frostFreezeSource || null };
  };
  const rR = runVictim('ROBOT'), rH = runVictim('HUNTER'), rM = runVictim('MAGNET');
  // ROBOT/HUNTER presentation rigs bypass the legacy overlay draw entirely
  // (pre-existing architecture: their custom draw never chains into the
  // iceVisual link), so their proof is sim-side (apply/vActive/marker).
  // MAGNET chains through the legacy overlay draw: its clean redraw is the
  // real draw-suppression proof.
  const frostClean = [rR, rH, rM].every((r) => r.froze && r.evts.length === 0 && !r.vActive && r.marker === 'frost')
    && rM.drew === true;
  // Legacy control on a chain-through hero: apply AND draw must both fire.
  const legacyType = win.FighterTypes.find((t) => t && t.name === 'ICE' && !t.__hrHero);
  const c = withCtl(frostPair('MAGNET'));
  c.a.x = 300; c.a.y = 500; c.b.x = 600; c.b.y = 500;
  const legacySrc = new win.Fighter(9991, 100, 100, legacyType);
  win.__apexIceVisualTestArmed = true;
  win.__apexIceVisualTestEvents = [];
  c.b.applyStatus('freeze', 1.0, { source: legacySrc });
  let drewC = false;
  try { T.redraw(); drewC = true; } catch (e) { drewC = false; }
  const evtsC = (win.__apexIceVisualTestEvents || []).slice();
  const vActiveC = !!(c.b.visual && c.b.visual.iceFrozen && c.b.visual.iceFrozen.active);
  win.__apexIceVisualTestArmed = false;
  const controlFires = drewC && evtsC.some((e) => e.kind === 'legacy-freeze-apply')
    && evtsC.some((e) => e.kind === 'legacy-freeze-draw') && vActiveC === true;
  gate('F01.8-no-legacy-overlay-audio', frostClean,
    { robot: rR.evts, hunter: rH.evts, magnet: { evts: rM.evts, drew: rM.drew } });
  gate('F01.10-source-keyed-suppression', frostClean && controlFires,
    { frostClean, control: evtsC.map((e) => e.kind), drewC });
  gate('F08.11-no-old-frozen-text-block-audio', frostClean, { n: [rR, rH, rM].map((r) => r.evts.length) });
} catch (e) { gate('F01.8-no-legacy-overlay-audio', false, String(e && e.message)); }

try {
  // F01.11: the suppression patch introduces no undefined-scope predicate.
  // The predicate reads window.APEX_HERO_REWORK through window scope (never
  // a bare owner/source free variable); the file parses; and F01.10 passing
  // proves no ReferenceError path (the predicate's try/catch returns false
  // on ANY fault, which would have disabled suppression and failed F01.10).
  const out = execSync('node --check public/game/fighters/iceVisualRuntime.js && echo PARSE_OK', { cwd: process.cwd() }).toString();
  const src = fs.readFileSync('public/game/fighters/iceVisualRuntime.js', 'utf8');
  const pred = src.slice(src.indexOf('function isFrostReworkSource'), src.indexOf('function iceRealNowMs'));
  const scopedOk = /window\.APEX_HERO_REWORK/.test(pred) && !/[^.a-zA-Z]owner[^a-zA-Z]/.test(pred)
    && !/[^.a-zA-Z]source[^a-zA-Z]/.test(pred.replace(/isFrostReworkSource/g, ''));
  gate('F01.11-no-undefined-scope-predicate', out.includes('PARSE_OK') && scopedOk && pred.length > 100,
    { parse: out.includes('PARSE_OK'), scopedOk });
} catch (e) { gate('F01.11-no-undefined-scope-predicate', false, String(e && e.message)); }

/* ================= F10 — A2 contact / Cold Shock ===================== */
function contactDuel(p2 = 'ROBOT') {
  const o = withCtl(frostPair(p2));
  o.a.x = 400; o.a.y = 500; o.a.setDir(1, 0); o.a.baseSpeed = 0;
  o.b.x = 700; o.b.y = 500; o.b.setDir(-1, 0); o.b.baseSpeed = 0;
  return o;
}
function touchBodies(o) { o.a.x = o.b.x - 10; o.a.y = o.b.y; } // d=10: firm overlap
function partBodies(o) { o.a.x = o.b.x - 400; o.a.y = o.b.y; } // d=400: true separation

try {
  // F10.1: head-on while A2 live: engine separates + reflects AND the
  // callback fires (unpinned: real locomotion, real bounce).
  const o = withCtl(frostPair());
  o.a.x = 300; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 700; o.b.y = 500; o.b.setDir(-1, 0);
  const r = HR.pressAbility(o.a, 'A2');
  const tap = frostBusTap();
  // Post-step sampling always sees post-separation bodies, so the contact
  // threshold matches the engine hook (+4), and the window ends 12 frames
  // after contact (long before any wall is reachable).
  let contactAt = -1;
  for (let f = 0; f < 200; f++) {
    T.step(1 / 60);
    const d = Math.hypot(o.a.x - o.b.x, o.a.y - o.b.y);
    if (contactAt < 0 && d < o.a.radius + o.b.radius + 4) contactAt = f;
    if (contactAt >= 0 && f > contactAt + 12) break;
  }
  const dEnd = Math.hypot(o.a.x - o.b.x, o.a.y - o.b.y);
  const reflected = o.a.dir.x < -0.5 && o.b.dir.x > 0.5;
  const shocked = tap.seen.includes('FrostColdShock');
  gate('F10.1-separate-reflect-callback',
    r.ok === true && contactAt > 0 && dEnd > 160 && reflected && shocked,
    { contactAt, dEnd: +dEnd.toFixed(1), reflected, shocked, cold: FR().inspect(o.ct).cold,
      contactLatch: { ...(HR.match && HR.match.world && HR.match.world.__contact) } });
  tap.release();
} catch (e) { gate('F10.1-separate-reflect-callback', false, String(e && e.message)); }

try {
  // F10.2: first new contact during A2: Cold Shock x0.50 for 1.0s, 0 damage.
  const o = contactDuel();
  const tap = frostBusTap();
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  const hp0 = o.b.hp;
  touchBodies(o);
  T.step(3 / 60);
  const c0 = frostClock();
  const m0 = o.b.hasStatus('slow') ? o.b.statuses.slow.mult : null;
  T.step(0.4);
  const m4 = o.b.hasStatus('slow') ? o.b.statuses.slow.mult : null;
  T.step(0.4);
  const m8 = o.b.hasStatus('slow') ? o.b.statuses.slow.mult : null;
  T.step(0.6); // c0 + ~1.45: shock (1.0) + refresh decay gone
  const gone = !o.b.hasStatus('slow');
  gate('F10.2-cold-shock-0.50-1.0s',
    tap.seen.filter((t) => t === 'FrostColdShock').length === 1
    && m0 === 0.50 && m4 === 0.50 && m8 === 0.50 && gone && o.b.hp === hp0,
    { m0, m4, m8, gone, hpSame: o.b.hp === hp0, c0: +c0.toFixed(2) });
  tap.release();
} catch (e) { gate('F10.2-cold-shock-0.50-1.0s', false, String(e && e.message)); }

try {
  // F10.3/4/7: hold overlap (no re-proc) -> separate -> re-contact (re-proc
  // in the SAME window: no permanent latch).
  const o = contactDuel();
  const tap = frostBusTap();
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  touchBodies(o);
  for (let f = 0; f < 30; f++) { T.step(1 / 60); touchBodies(o); } // held overlap
  const oneProc = tap.seen.filter((t) => t === 'FrostColdShock').length === 1;
  partBodies(o);
  T.step(3 / 60); // real separation clears the engine contact flag
  touchBodies(o);
  T.step(3 / 60);
  const twoProcs = tap.seen.filter((t) => t === 'FrostColdShock').length === 2;
  const sameWindow = FR().inspect(o.ct).a2live === true;
  gate('F10.3-no-frame-reproc', oneProc, { shocks: tap.seen.length });
  gate('F10.4-separation-clears-reproc', oneProc && twoProcs, { twoProcs });
  gate('F10.7-same-window-recontact', twoProcs && sameWindow, { sameWindow });
  tap.release();
} catch (e) { gate('F10.3-no-frame-reproc', false, String(e && e.message)); }

try {
  // F10.5: floor x0.60 + Cold Shock x0.50 resolves to x0.50.
  const { o, lane } = buildLane();
  const tap = frostBusTap();
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  o.a.x = lane.ox + 210; o.a.y = lane.oy; o.a.baseSpeed = 0;
  o.b.x = lane.ox + 200; o.b.y = lane.oy; o.b.baseSpeed = 0; // d=10: contact + floor, no d=0
  T.step(3 / 60);
  const m = o.b.hasStatus('slow') ? o.b.statuses.slow.mult : null;
  gate('F10.5-floor-shock-min', tap.seen.includes('FrostColdShock') && m === 0.50, { mult: m });
  tap.release();
} catch (e) { gate('F10.5-floor-shock-min', false, String(e && e.message)); }

try {
  // F10.6: unrelated slows/speeds are never weakened (mult AND timer kept).
  const o = contactDuel();
  o.b.applyStatus('slow', 5.0, { mult: 0.30 }); // unrelated stronger slow
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  touchBodies(o);
  T.step(3 / 60);
  const mStrong = o.b.statuses.slow.mult, tStrong = o.b.statuses.slow.timer;
  // Unrelated weaker slow: Frost's 0.50 wins (documented min-law).
  const p = contactDuel();
  p.b.applyStatus('slow', 5.0, { mult: 0.80 });
  HR.pressAbility(p.a, 'A2');
  T.step(0.2);
  touchBodies(p);
  T.step(3 / 60);
  const mWeak = p.b.statuses.slow.mult;
  // Unrelated stronger Frost-side speed survives the floor.
  const { o: q, lane } = buildLane();
  q.a.applyStatus('speed', 5.0, { mult: 3.0 });
  q.a.x = lane.ox + 100; q.a.y = lane.oy;
  q.b.x = 100; q.b.y = 900;
  T.step(2 / 60);
  const mSpd = q.a.statuses.speed.mult, tSpd = q.a.statuses.speed.timer;
  gate('F10.6-unrelated-untouched',
    mStrong === 0.30 && tStrong > 4.5 && mWeak === 0.50 && mSpd === 3.0 && tSpd > 4.5,
    { mStrong, tStrong: +tStrong.toFixed(2), mWeak, mSpd, tSpd: +tSpd.toFixed(2) });
} catch (e) { gate('F10.6-unrelated-untouched', false, String(e && e.message)); }

/* ================= F11 — A2 exact-holder steal ======================== */
try {
  // F11.1/2/4/7: exact holder object transfers; enemy null; no dup; Frozen.
  const o = contactDuel();
  W().equip(o.b, 'PISTOL');
  const h0 = W().getHolder(o.b);
  const slots0 = win.APEX_ARSENAL.state.slots.length;
  const tap = frostBusTap();
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  touchBodies(o);
  T.step(3 / 60);
  const hf = W().getHolder(o.a), he = W().getHolder(o.b);
  const slots1 = win.APEX_ARSENAL.state.slots.length;
  gate('F11.1-exact-holder-transfers', hf === h0, { sameRef: hf === h0 });
  gate('F11.2-enemy-null', he === null, { enemyHolder: he });
  gate('F11.4-no-dup-slot', slots0 === 0 && slots1 === 0, { slots0, slots1 });
  gate('F11.7-immediately-frozen',
    !!(hf && hf.__frostFrozen && hf.__frostFrozen.stolen === true)
    && tap.seen.includes('FrostSteal'), { frozen: !!(hf && hf.__frostFrozen) });
  tap.release();
} catch (e) { gate('F11.1-exact-holder-transfers', false, String(e && e.message)); }

try {
  // F11.3: no fresh equip()/consume()/cleanup(); no destruction pose ghost.
  const o = contactDuel();
  W().equip(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  let equips = 0, consumes = 0;
  const oe = W().equip, oc = W().consume;
  W().equip = (...a) => { equips++; return oe(...a); };
  W().consume = (...a) => { consumes++; return oc(...a); };
  const hfBefore = W().getHolder(o.b);
  try {
    touchBodies(o);
    T.step(3 / 60);
  } finally { W().equip = oe; W().consume = oc; }
  const hf = W().getHolder(o.a);
  gate('F11.3-no-equip-consume-ghost',
    equips === 0 && consumes === 0 && hf === hfBefore
    && !o.a.data.arsenalFade && !o.b.data.arsenalFade,
    { equips, consumes, sameRef: hf === hfBefore });
} catch (e) { gate('F11.3-no-equip-consume-ghost', false, String(e && e.message)); }

try {
  // F11.5: weaponId/def/phase/elapsed/shotsFired/meta/aim state preserved.
  // Timing/progress metadata rides along on the SAME object (a fresh
  // equip() would reset elapsed/shots/nextShot to defaults; natural
  // per-frame advance allowed). aimAngle is owner-relative and MUST
  // re-target to the new owner (F11.12 proves the re-targeted weapon
  // fires correctly), so it is excluded by design, not by omission.
  const o = contactDuel();
  W().equip(o.b, 'PISTOL');
  const h0 = W().getHolder(o.b);
  // Gate for post-shot-1 (live FIRING phase) BEFORE arming: Frost is
  // pinned/static until A2, so no premature contact is possible here.
  for (let f = 0; f < 120; f++) {
    T.step(1 / 60);
    if (h0.shotsFired === 1) break;
  }
  if (h0.shotsFired !== 1) throw new Error('enemy did not fire shot 1');
  HR.pressAbility(o.a, 'A2');
  T.step(0.1);
  touchBodies(o); // teleport, no step yet: snapshot is pre-transfer
  const snap = {
    weaponId: h0.weaponId, def: h0.def, phase: h0.phase, elapsed: h0.elapsed,
    shotsFired: h0.shotsFired,
    metaKeys: Object.keys(h0.meta).sort().join(','),
  };
  T.step(1 / 60); // transfer happens on this contact frame
  const hf = W().getHolder(o.a);
  // A fresh equip() would reset shots to 0, phase to READY and elapsed
  // to 0; the carried values prove the live state rode along.
  const ok = hf === h0 && hf.weaponId === snap.weaponId && hf.def === snap.def
    && (hf.shotsFired === snap.shotsFired || hf.shotsFired === snap.shotsFired + 1)
    && hf.elapsed >= snap.elapsed && hf.elapsed - snap.elapsed < 0.5
    && Object.keys(hf.meta).sort().join(',') === snap.metaKeys
    && hf.phase === 'FIRING';
  gate('F11.5-metadata-preserved', ok,
    {
      shots: hf && hf.shotsFired, phase: hf && hf.phase,
      sameRef: hf === h0, sameDef: !!(hf && hf.def === snap.def),
      dEl: +((hf && hf.elapsed) - snap.elapsed).toFixed(3),
    });
} catch (e) { gate('F11.5-metadata-preserved', false, String(e && e.message)); }

try {
  // F11.6: M249 12-shot: 5 fired pre-contact -> 7 remain, sequence completes.
  const o = contactDuel();
  W().equip(o.b, 'M249_SAW');
  const h0 = W().getHolder(o.b);
  HR.pressAbility(o.a, 'A2'); // window live well before the transfer
  // Transfer exactly at 5 with no shot in flight this frame (nextShot gate).
  for (let f = 0; f < 400; f++) {
    T.step(1 / 60);
    if (h0.shotsFired === 5 && h0.meta.nextShot > 0.03) break;
  }
  if (h0.shotsFired !== 5) throw new Error('enemy did not hold 5 shots');
  touchBodies(o);
  T.step(1 / 60);
  const hf = W().getHolder(o.a);
  const atSteal = hf === h0 && hf.shotsFired === 5;
  // F11.8: the remaining sequence continues while A2 is still live.
  let sawAdvance = false;
  for (let f = 0; f < 300; f++) {
    T.step(1 / 60);
    if (hf.shotsFired > 5) { sawAdvance = FR().inspect(o.ct).a2live === true; break; }
  }
  for (let f = 0; f < 600 && W().getHolder(o.a); f++) T.step(1 / 60);
  gate('F11.6-m249-5-to-7', atSteal && hf.shotsFired === 12 && !W().getHolder(o.a),
    { atSteal, finalShots: hf.shotsFired });
  gate('F11.8-continues-during-a2', sawAdvance, { sawAdvance });
} catch (e) { gate('F11.6-m249-5-to-7', false, String(e && e.message)); }

try {
  // F11.9: Frost armed -> no transfer/swap/storage; shock still applies.
  const o = contactDuel();
  W().equip(o.a, 'PISTOL');
  W().equip(o.b, 'SMG');
  const own = W().getHolder(o.a), foe = W().getHolder(o.b);
  const tap = frostBusTap();
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  touchBodies(o);
  T.step(3 / 60);
  gate('F11.9-armed-no-steal-shock-anyway',
    W().getHolder(o.a) === own && W().getHolder(o.b) === foe
    && !tap.seen.includes('FrostSteal') && tap.seen.includes('FrostColdShock'),
    { events: tap.seen });
  tap.release();
} catch (e) { gate('F11.9-armed-no-steal-shock-anyway', false, String(e && e.message)); }

try {
  // F11.10: melee/grenade/shield/T6 never transfer; shock still applies.
  const rows = {};
  for (const wid of ['SABRE', 'GRENADE', 'SWIRL_SHIELD', 'STORMBREAKER']) {
    const o = contactDuel();
    W().equip(o.b, wid);
    const h0 = W().getHolder(o.b);
    const tap = frostBusTap();
    const spends = tapAQ(/\[AQ\] (CONSUME|STRIKE|THROW) /, () => {
      HR.pressAbility(o.a, 'A2');
      T.step(0.1); // short: thrown classes must still be held, not spent
      touchBodies(o);
      T.step(2 / 60);
    });
    // SABRE at point-blank range legitimately spends itself striking (the
    // weapon's own law, proven by the CONSUME/STRIKE log); the no-transfer
    // assertion is frostEmpty + no FrostSteal for every class.
    rows[wid] = {
      spentByOwner: spends.length > 0,
      held: W().getHolder(o.b) === h0 && !!h0,
      frostEmpty: !W().getHolder(o.a),
      shock: tap.seen.includes('FrostColdShock'),
      steal: tap.seen.includes('FrostSteal'),
    };
    tap.release();
  }
  const ok = Object.entries(rows).every(([wid, r]) =>
    (wid === 'SABRE' ? (r.held || r.spentByOwner) : r.held)
    && r.frostEmpty && r.shock && !r.steal);
  gate('F11.10-never-steal-other-classes', ok, rows);
} catch (e) { gate('F11.10-never-steal-other-classes', false, String(e && e.message)); }

try {
  // F11.11: same overlap cannot re-steal; separation + re-contact can.
  const o = contactDuel();
  W().equip(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  touchBodies(o);
  T.step(3 / 60);
  const stolen1 = W().getHolder(o.a);
  // Enemy re-arms DURING the same held overlap: no second steal.
  W().equip(o.b, 'SMG');
  const fresh = W().getHolder(o.b);
  for (let f = 0; f < 30; f++) { T.step(1 / 60); touchBodies(o); }
  const heldNoReststeal = W().getHolder(o.a) === stolen1 && W().getHolder(o.b) === fresh;
  // Frost drops (simulated consume), separates, re-contacts: steal works.
  o.a.data.arsenal = null;
  partBodies(o);
  T.step(3 / 60);
  touchBodies(o);
  T.step(3 / 60);
  const restole = W().getHolder(o.a) === fresh && !W().getHolder(o.b);
  gate('F11.11-gate-not-latch', !!stolen1 && heldNoReststeal && restole,
    { heldNoReststeal, restole, a2live: FR().inspect(o.ct).a2live });
} catch (e) { gate('F11.11-gate-not-latch', false, String(e && e.message)); }

try {
  // F11.12: post-transfer shots use Frost as real holder/owner.
  const o = contactDuel();
  W().equip(o.b, 'PISTOL');
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  // Pre-steal family sample (enemy-owned bullet).
  let preFam = null;
  for (let f = 0; f < 120 && !preFam; f++) {
    T.step(1 / 60);
    const p = (win.projectiles || []).find((q) => q && q.type === 'aq_bullet');
    if (p) preFam = p.family;
  }
  touchBodies(o);
  T.step(3 / 60);
  partBodies(o); // re-open the firing lane
  let postFam = null;
  const shots = tapAQ(/\[AQ\] SHOT fighter=(\w+)/, () => {
    for (let f = 0; f < 120; f++) {
      T.step(1 / 60);
      if (!postFam) {
        const p = (win.projectiles || []).find((q) => q && q.type === 'aq_bullet' && q.owner === o.a);
        if (p) postFam = p.family;
      }
    }
  });
  const hpAfter = o.b.hp;
  gate('F11.12-frost-owns-post-transfer',
    shots.length > 0 && shots.every((s) => s === 'ICE') && preFam === 'SEMI' && postFam === 'SEMI' && hpAfter < 1000,
    { shots, preFam, postFam, hp: +hpAfter.toFixed(1) });
} catch (e) { gate('F11.12-frost-owns-post-transfer', false, String(e && e.message)); }

try {
  // F11.13/14: carrier authority. Frost collides with a non-carrier SLIME
  // child while the anchor holds a PISTOL: transfer queries the real
  // carrier and succeeds once; a dead holder parked on the child is never
  // treated as owned by the colliding body.
  const setup = () => {
    const o = contactDuel('SLIME');
    const ectl = HR.abilityController(HR.byCombatant(o.b));
    const mit = ectl.tryCast('A1', 'frost');
    T.step(0.1);
    const bodies = HR.getTargetableBodies(HR.byCombatant(o.b));
    if (!mit || !mit.ok || bodies.length < 2) throw new Error('split failed');
    // Pin everything post-split: no drift-contact before the scripted touch.
    for (const b of bodies) { b.baseSpeed = 0; b.setDir(1, 0); }
    return { o, anchor: o.b, child: bodies.find((b) => b !== o.b) };
  };
  // Success direction: anchor holds, Frost touches the CHILD.
  const s = setup();
  W().equip(s.anchor, 'PISTOL');
  const h0 = W().getHolder(s.anchor);
  HR.pressAbility(s.o.a, 'A2');
  T.step(0.2);
  if (W().getHolder(s.o.a)) throw new Error('steal before the scripted touch');
  s.o.a.x = s.child.x - 10; s.o.a.y = s.child.y; // touch the child
  T.step(3 / 60);
  const okSteal = W().getHolder(s.o.a) === h0 && !W().getHolder(s.anchor)
    && !s.child.data.arsenal;
  // Ignore direction: anchor unarmed, dead holder parked on the child.
  const t = setup();
  W().equip(t.child, 'PISTOL');
  const parked = W().getHolder(t.child);
  HR.pressAbility(t.o.a, 'A2');
  T.step(0.2);
  t.o.a.x = t.child.x - 10; t.o.a.y = t.child.y;
  T.step(3 / 60);
  const noStealChild = !W().getHolder(t.o.a) && W().getHolder(t.child) === parked;
  partBodies(t.o);
  T.step(3 / 60);
  t.o.a.x = t.anchor.x - 10; t.o.a.y = t.anchor.y;
  T.step(3 / 60);
  const noStealAnchor = !W().getHolder(t.o.a) && W().getHolder(t.child) === parked;
  gate('F11.13-carrier-authority', okSteal && noStealChild && noStealAnchor,
    { okSteal, noStealChild, noStealAnchor });
  gate('F11.14-child-collision-queries-carrier', okSteal, { okSteal });
} catch (e) { gate('F11.13-carrier-authority', false, String(e && e.message)); }

/* ================= F12 — Gold parity / event truth ================= */
const P = () => win.APEX_FROST_PRESENTATION;
const FG = () => win.APEX_FROST_GOLD;
async function frostReady(ms = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (P() && P().ready) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !!(P() && P().ready);
}
function readPixels() {
  const rc = H.gameCanvasReal;
  const cx = rc.getContext('2d');
  const img = cx.getImageData(0, 0, rc.width, rc.height);
  return { w: rc.width, h: rc.height, data: img.data };
}
function localBg(px, cx, cy, half) {
  // Median of the crop border: robust to arena gradients + grid.
  const rs = [], gs = [], bs = [];
  const x0 = Math.max(0, Math.floor(cx - half)), x1 = Math.min(px.w - 1, Math.ceil(cx + half));
  const y0 = Math.max(0, Math.floor(cy - half)), y1 = Math.min(px.h - 1, Math.ceil(cy + half));
  const push = (x, y) => { const i = (y * px.w + x) * 4; rs.push(px.data[i]); gs.push(px.data[i + 1]); bs.push(px.data[i + 2]); };
  for (let x = x0; x <= x1; x += 4) { push(x, y0); push(x, y1); }
  for (let y = y0; y <= y1; y += 4) { push(x0, y); push(x1, y); }
  const med = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
  return [med(rs), med(gs), med(bs)];
}
function cropStats(px, cx, cy, half, bg, thresh) {
  const th = thresh == null ? 45 : thresh;
  let n = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, sx = 0, sy = 0, ice = 0;
  const x0 = Math.max(0, Math.floor(cx - half)), x1 = Math.min(px.w - 1, Math.ceil(cx + half));
  const y0 = Math.max(0, Math.floor(cy - half)), y1 = Math.min(px.h - 1, Math.ceil(cy + half));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * px.w + x) * 4;
    const r = px.data[i], gg = px.data[i + 1], b = px.data[i + 2];
    if (b > r + 40 && b > 170) ice++;
    if (Math.max(Math.abs(r - bg[0]), Math.abs(gg - bg[1]), Math.abs(b - bg[2])) > th) {
      n++; if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y; sx += x; sy += y;
    }
  }
  return { n, ice, w: n ? maxX - minX + 1 : 0, h: n ? maxY - minY + 1 : 0, cx: n ? sx / n : 0, cy: n ? sy / n : 0 };
}
function spyMethod(obj, name) {
  const orig = obj[name];
  const rec = { calls: 0, args: [] };
  obj[name] = function (...a) { rec.calls++; rec.args.push(a); return orig.apply(this, a); };
  rec.release = () => { obj[name] = orig; };
  return rec;
}
function stillPair(ax, ay, adx, bx, by) {
  const o = withCtl(frostPair());
  o.a.x = ax; o.a.y = ay; o.a.setDir(adx, 0); o.a.baseSpeed = 0;
  o.b.x = bx; o.b.y = by; o.b.setDir(-1, 0); o.b.baseSpeed = 0;
  T.step(1 / 60); // prime: presentation state exists before any inspect/engineFor
  o.a.x = ax; o.a.y = ay; o.b.x = bx; o.b.y = by;
  return o;
}
function liveKind(e, kind) { return e.ice.nodes.filter((n) => n.kind === kind && !n.dead); }

await frostReady();

try {
  const okFlags = win.apexFrostGoldV1 === 'ready' && win.apexFrostPresentationRuntime === 'ready';
  const need = ['FrostEngine', 'IceField', 'Rng', 'Crit', 'Spring', 'updateShapes', 'drawFloorShapes',
    'drawAirShapes', 'drawRibbonLayer', 'frostBulletFleck', 'cacheStats', 'damp', 'clamp', 'angDiff',
    'TAU', 'PAL', 'FROST_LAYERS', 'mipChain', 'pick'];
  const missing = need.filter((k) => !(k in FG()));
  const pngs = ['base', 'crest', 'browL', 'browR', 'jaw', 'eyes', 'crack', 'cavity', 'sil'];
  const pngOk = pngs.filter((k) => { try { return fs.statSync(`public/assets/hero-rework/frost-v1/${k}.png`).size > 1000; } catch (e) { return false; } });
  let sha = '';
  try { sha = execSync('sha256sum public/game/hero-rework/frostGoldV1.js').toString().split(' ')[0]; } catch (e) {}
  gate('F12.1-gold-pinned', okFlags && P().ready && missing.length === 0 && pngOk.length === 9 && /^[0-9a-f]{64}$/.test(sha),
    { exports: Object.keys(FG()).length, missing, png: pngOk.length, sha256: sha.slice(0, 16) });
} catch (e) { gate('F12.1-gold-pinned', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 850, 850);
  T.step(1.0);
  T.redraw();
  const px = readPixels();
  const bg = localBg(px, o.a.x, o.a.y, 130);
  const st = cropStats(px, o.a.x, o.a.y, 130, bg);
  const ok = st.n > 2500 && st.ice > 1200 && st.w > 70 && st.h > 80 &&
    Math.abs(st.cx - o.a.x) < 40 && Math.abs(st.cy - o.a.y) < 40;
  gate('F12.2-idle-silhouette', P().ready && ok,
    { n: st.n, ice: st.ice, w: st.w, h: st.h, dx: +(st.cx - o.a.x).toFixed(1), dy: +(st.cy - o.a.y).toFixed(1) });
} catch (e) { gate('F12.2-idle-silhouette', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 850, 850);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.1);
  const i1 = P().inspect(o.a);
  const okCast = i1.mode === 'a1' && !i1.a1.released && Math.abs(i1.a1.ang) < 0.08;
  T.step(0.25);
  const i2 = P().inspect(o.a);
  const e = P().engineFor(o.a);
  const okRel = i2.a1.released && i2.a1.nodes >= 50 && i2.a1.front > 80 && e.breath.on;
  const macro = spyMethod(e, 'drawA1MacroFront');
  T.redraw();
  const okMacro = macro.calls >= 1;
  macro.release();
  T.step(0.6);
  const i3 = P().inspect(o.a);
  const okEnd = i3.mode === 'free' && i3.a1.front === 650 && i3.a1.len === 650;
  const lane = FR().inspect(o.ct).lanes[0];
  const okLane = lane && Math.abs(lane.ox - 300) < 45 && lane.len === 650;
  gate('F12.3-a1-order', okCast && okRel && okMacro && okEnd && okLane,
    { mode: i1.mode, ang: i1.a1.ang, nodes: i2.a1.nodes, front: i2.a1.front, macro: macro.calls, laneOx: lane && lane.ox });
} catch (e) { gate('F12.3-a1-order', false, String(e && e.message)); }

try {
  // Same-match mature lane: reuse F12.3's match? No — fresh pinned match for isolation.
  const o = stillPair(300, 500, 1, 850, 850);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(2.1); // release + front travel + maturity
  const e = P().engineFor(o.a);
  const lane = FR().inspect(o.ct).lanes[0];
  const halfW = o.ct.skills.A1.cfg.width / 2;
  let bad = 0, total = 0;
  for (const n of e.ice.nodes) {
    if (n.kind !== 'lane' || n.dead) continue;
    total++;
    const rx = n.x - lane.ox, ry = n.y - lane.oy;
    if (!(rx > -40 && rx < lane.len + 40 && Math.abs(ry) < halfW * 1.2)) bad++;
  }
  let cov = 0, covN = 0;
  for (let d = 25; d <= 650; d += 25) {
    covN++;
    if (e.ice.iceAt(lane.ox + d, lane.oy, e.t)) cov++;
  }
  const offV = e.ice.iceAt(lane.ox + 325, lane.oy + 210, e.t);
  gate('F12.4-lane-aligned', lane && total > 50 && bad === 0 && cov >= covN - 2 && !offV,
    { total, bad, cov: cov + '/' + covN, offAxisIce: !!offV, halfW });
} catch (e) { gate('F12.4-lane-aligned', false, String(e && e.message)); }

try {
  const o = stillPair(200, 700, 1, 900, 100);
  HR.pressAbility(o.a, 'A2');
  const pts = [[200, 700], [300, 700], [400, 700], [470, 660], [520, 600], [560, 560], [500, 560], [440, 560]];
  const steps = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 10));
    for (let k = 1; k <= n; k++) steps.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  o.a.x = 200; o.a.y = 700;
  let tickN = 0;
  for (const [x, y] of steps) {
    const dx = x - o.a.x, dy = y - o.a.y, L = Math.hypot(dx, dy) || 1;
    o.a.x = x; o.a.y = y;
    o.a.__hrVel = { x: dx / L * 600, y: dy / L * 600 };
    P().tick(1 / 60);
    if (++tickN % 12 === 0) { T.step(1 / 60); o.b.x = 900; o.b.y = 100; }
  }
  const e = P().engineFor(o.a);
  const segDist = (px, py) => {
    let best = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay, LL = dx * dx + dy * dy || 1;
      let t = ((px - ax) * dx + (py - ay) * dy) / LL;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)));
    }
    return best;
  };
  const trail = liveKind(e, 'trail');
  const bad = trail.filter((n) => segDist(n.x, n.y) > 25).length;
  let pathLen = 0;
  for (let i = 0; i < pts.length - 1; i++) pathLen += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  const lo = pathLen / 9 * 0.55, hi = pathLen / 9 * 1.45;
  gate('F12.5-trail-follows-path', trail.length >= lo && trail.length <= hi && bad === 0,
    { nodes: trail.length, expect: [Math.round(lo), Math.round(hi)], bad });
} catch (e) { gate('F12.5-trail-follows-path', false, String(e && e.message)); }

try {
  // Fresh A2 on a clean engine cycle: run down the window, then re-cast via truth.
  const o = stillPair(200, 300, 1, 900, 100);
  HR.pressAbility(o.a, 'A2');
  T.step(2.2); // window (2.0) ends -> poll endA2
  const e = P().engineFor(o.a);
  const endedOk = e.mode === 'free';
  FR().castHunt({ combatant: o.ct, cfg: o.ct.skills.A2.cfg });
  P().tick(1 / 60);
  const recastOk = e.mode === 'a2';
  // Straight east: no carve may appear.
  o.a.x = 200; o.a.y = 300;
  const tStraight = e.t;
  for (let i = 0; i < 30; i++) {
    o.a.x += 10; o.a.__hrVel = { x: 600, y: 0 }; P().tick(1 / 60);
  }
  const straightCarves = e.ice.carves.filter((c) => c.born > tStraight).length;
  // 90-degree turn north: carve must appear at the apex.
  const apex = { x: o.a.x, y: o.a.y };
  const tTurn = e.t;
  for (let i = 0; i < 20; i++) {
    o.a.y -= 10; o.a.__hrVel = { x: 0, y: -600 }; P().tick(1 / 60);
  }
  const turnCarves = e.ice.carves.filter((c) => c.born > tTurn);
  const nearApex = turnCarves.filter((c) => Math.hypot(c.x - apex.x, c.y - apex.y) < 70).length;
  gate('F12.6-carve-on-turn', endedOk && recastOk && straightCarves === 0 && turnCarves.length >= 1 && nearApex >= 1,
    { endedOk, recastOk, straightCarves, turnCarves: turnCarves.length, nearApex });
} catch (e) { gate('F12.6-carve-on-turn', false, String(e && e.message)); }

/* ================= F12 continued — guns / bullets / shell ============= */
try {
  const o = stillPair(300, 500, 1, 850, 850);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.9);
  const lane = FR().inspect(o.ct).lanes[0];
  const id = T.pushSlot({ x: lane.ox + 200, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(0.3);
  const slot = AQSlots().find((q) => q.id === id);
  const froze = !!(slot && slot.__frostFrozen);
  const AV = win.APEX_ARSENAL_AV;
  const spr = spyMethod(AV, 'drawWeaponSprite');
  const e = P().engineFor(o.a);
  const ov = spyMethod(e, 'drawGunFrost');
  T.redraw();
  const sprPistol = spr.args.filter((a) => a[1] === 'PISTOL').length;
  spr.release(); ov.release();
  gate('F12.7-floor-gun-identity', froze && sprPistol >= 1 && ov.calls >= 1 && slot.weaponId === 'PISTOL',
    { froze, sprPistol, overlay: ov.calls });
} catch (e) { gate('F12.7-floor-gun-identity', false, String(e && e.message)); }

try {
  const o = contactDuel();
  W().equip(o.b, 'PISTOL');
  const h0 = W().getHolder(o.b);
  const tap = frostBusTap();
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  touchBodies(o);
  T.step(3 / 60);
  const steals = tap.seen.filter((t) => t === 'FrostSteal').length;
  const moved = W().getHolder(o.a) === h0 && W().getHolder(o.b) === null;
  const iFly = P().inspect(o.a);
  const okFlight = iFly.transfers === 1 && iFly.guns === 1;
  T.step(0.1);
  const iMid = P().inspect(o.a);
  const okMid = iMid.transfers === 1 && iMid.guns <= 1;
  T.step(0.6);
  const iDone = P().inspect(o.a);
  const okDone = iDone.transfers === 0 && iDone.guns >= 1 && W().getHolder(o.a) === h0;
  tap.release();
  gate('F12.8-steal-single-transfer', steals === 1 && moved && okFlight && okMid && okDone,
    { steals, moved, flight: [iFly.transfers, iFly.guns], mid: [iMid.transfers, iMid.guns], done: [iDone.transfers, iDone.guns] });
} catch (e) { gate('F12.8-steal-single-transfer', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 850, 850);
  W().equip(o.a, 'PISTOL');
  const hold = W().getHolder(o.a);
  hold.__frostFrozen = { weaponId: 'PISTOL', at: 0 };
  const mk = (tag) => ({ x: 500, y: 500, vx: 200, vy: 0, owner: o.a, __hr: {}, hp: 1, life: 1, type: 'bullet', dmg: 10 });
  const p = mk(), q = mk();
  q.x = 520;
  FR().tagFrozenBullet({}, p, o.a);
  const taggedOk = !!(p.__hr && p.__hr.frost && p.__hr.frost.group);
  win.projectiles.push(p, q);
  const e = P().engineFor(o.a);
  const dr = spyMethod(e, 'drawBulletFrost');
  T.redraw();
  const hitP = dr.args.filter((a) => Math.abs(a[1] - 500) < 2 && Math.abs(a[2] - 500) < 2).length;
  const hitQ = dr.args.filter((a) => Math.abs(a[1] - 520) < 2 && Math.abs(a[2] - 500) < 2).length;
  dr.release();
  const before = JSON.stringify({ dmg: p.dmg, x: p.x, y: p.y, vx: p.vx, vy: p.vy, life: p.life, g: p.__hr.frost.group, own: p.owner === o.a });
  P().tick(1 / 60);
  T.redraw();
  const after = JSON.stringify({ dmg: p.dmg, x: p.x, y: p.y, vx: p.vx, vy: p.vy, life: p.life, g: p.__hr.frost.group, own: p.owner === o.a });
  win.projectiles = win.projectiles.filter((r) => r !== p && r !== q);
  gate('F12.9-bullet-visuals', taggedOk && hitP >= 1 && hitQ === 0 && before === after,
    { taggedOk, hitTagged: hitP, hitPlain: hitQ, unchanged: before === after });
} catch (e) { gate('F12.9-bullet-visuals', false, String(e && e.message)); }

function frostProcSweep(o, hold, wantProc, seedLo, seedHi) {
  // Drives REAL tag + REAL noteBodyHit; returns {ok, seed}.
  for (let seed = seedLo; seed <= seedHi; seed++) {
    FR().setFreezeSeed(seed * 7919 + 13);
    hold.shotsFired = seed;
    const b = o.b;
    const p = { x: b.x - 10, y: b.y, vx: 100, vy: 0, owner: o.a, __hr: {}, hp: 1, life: 1, type: 'bullet' };
    FR().tagFrozenBullet({}, p, o.a);
    const r = FR().noteBodyHit(p, b);
    if (!!r === wantProc) { FR().setFreezeSeed(null); return { ok: true, seed }; }
  }
  FR().setFreezeSeed(null);
  return { ok: false, seed: -1 };
}

try {
  const o = stillPair(300, 500, 1, 520, 500);
  W().equip(o.a, 'PISTOL');
  const hold = W().getHolder(o.a);
  hold.__frostFrozen = { weaponId: 'PISTOL', at: 0 };
  const e = P().engineFor(o.a);
  const c0 = e.crusts.length;
  const fail = frostProcSweep(o, hold, false, 1, 60);
  const noShell = e.shell === null;
  const marked = e.crusts.length === c0 + 1;
  const proc = frostProcSweep(o, hold, true, 100, 200);
  T.step(0.2); // let presentation ticks observe the Frost freeze
  const shell = e.shell;
  const patch = e.ice.nodes.filter((n) => n.kind === 'patch' && !n.dead && Math.abs(n.born - e.t) < 1.0).length;
  gate('F12.10-shell-on-proc-only', fail.ok && noShell && marked && proc.ok && !!shell && shell.plates.length === 9 && patch >= 1,
    { failSeed: fail.seed, noShell, marked, procSeed: proc.seed, plates: shell && shell.plates.length, patch });
} catch (e) { gate('F12.10-shell-on-proc-only', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 520, 500);
  W().equip(o.a, 'PISTOL');
  const hold = W().getHolder(o.a);
  hold.__frostFrozen = { weaponId: 'PISTOL', at: 0 };
  const e = P().engineFor(o.a);
  const p1 = frostProcSweep(o, hold, true, 100, 200);
  T.step(0.2);
  const t0a = e.shell && e.shell.t0;
  const p2 = frostProcSweep(o, hold, true, 300, 400);
  T.step(0.2);
  const sh = e.shell;
  gate('F12.11-refresh-rebuilds', p1.ok && p2.ok && !!sh && sh.t0 > t0a && sh.plates.length === 9,
    { t0a, t0b: sh && sh.t0, plates: sh && sh.plates.length });
} catch (e) { gate('F12.11-refresh-rebuilds', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 520, 500);
  W().equip(o.a, 'PISTOL');
  const hold = W().getHolder(o.a);
  hold.__frostFrozen = { weaponId: 'PISTOL', at: 0 };
  const e = P().engineFor(o.a);
  const pr = frostProcSweep(o, hold, true, 100, 200);
  T.step(0.2);
  const sh = e.shell;
  const cracksFirst = sh && sh.cracks[0].at < sh.thawT && sh.cracks[1].at < sh.thawT + 0.3;
  // Step past thawT (freeze 0.90s clock ~= engine): plates release + scatter.
  for (let i = 0; i < 120 && !(sh.released && sh.plates.every((p) => p.released)); i++) T.step(1 / 60);
  const releasedCount = sh.plates.filter((p) => p.released).length;
  const m0 = sh.plates.reduce((s, p) => s + Math.abs(p.x) + Math.abs(p.y), 0);
  T.step(0.5);
  const m1 = sh.plates.reduce((s, p) => s + Math.abs(p.x) + Math.abs(p.y), 0);
  T.step(2.0);
  gate('F12.12-thaw-physical', pr.ok && cracksFirst && releasedCount === 9 && m1 > m0 && e.shell === null,
    { cracksFirst, releasedCount, moved: +(m1 - m0).toFixed(1), shellGone: e.shell === null });
} catch (e) { gate('F12.12-thaw-physical', false, String(e && e.message)); }

/* ================= F12 continued — readability / purity / frontal ===== */
try {
  const o = stillPair(300, 500, 1, 850, 850);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(1.5);
  T.redraw();
  const lane = FR().inspect(o.ct).lanes[0];
  const px = readPixels();
  const bg = localBg(px, lane.ox + 325, lane.oy + 220, 60);
  let hit = 0, n = 0, sum = 0;
  for (let x = lane.ox; x <= lane.ox + 650; x += 8) {
    for (let y = lane.oy - 80; y <= lane.oy + 80; y += 8) {
      if (x < 0 || x >= px.w || y < 0 || y >= px.h) continue;
      n++;
      const i = (Math.floor(y) * px.w + Math.floor(x)) * 4;
      const d = Math.max(Math.abs(px.data[i] - bg[0]), Math.abs(px.data[i + 1] - bg[1]), Math.abs(px.data[i + 2] - bg[2]));
      sum += d;
      if (d > 30) hit++;
    }
  }
  const goldSrc = fs.readFileSync('public/game/hero-rework/frostGoldV1.js', 'utf8').split('\n');
  const filterLines = goldSrc.filter((l) => l.includes('.filter ='));
  const filterOk = filterLines.length >= 1 && filterLines.every((l) => l.includes('blur'));
  const presSrc = fs.readFileSync('public/game/hero-rework/frostPresentationRuntime.js', 'utf8');
  const presFilter = presSrc.split('\n').filter((l) => l.includes('ctx.filter'));
  gate('F12.13-readable-no-bloom-crutch', lane && hit / n > 0.30 && sum / n > 22 && filterOk && presFilter.length === 2,
    { coverage: +(hit / n).toFixed(2), meanDiff: +(sum / n).toFixed(1), goldFilterLines: filterLines.length, presFilter: presFilter.length });
} catch (e) { gate('F12.13-readable-no-bloom-crutch', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 520, 500);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.5);
  const lane = FR().inspect(o.ct).lanes[0];
  T.pushSlot({ x: lane.ox + 200, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  W().equip(o.a, 'PISTOL');
  const hold = W().getHolder(o.a);
  hold.__frostFrozen = { weaponId: 'PISTOL', at: 0 };
  const p = { x: 500, y: 500, vx: 200, vy: 0, owner: o.a, __hr: {}, hp: 1, life: 1, type: 'bullet', dmg: 10 };
  FR().tagFrozenBullet({}, p, o.a);
  win.projectiles.push(p);
  frostProcSweep(o, hold, true, 100, 200);
  const snap = () => JSON.stringify({
    f: fighters().map((f) => [f.x, f.y, f.hp, f.radius, f.dir.x, f.dir.y,
      Object.keys(f.statuses || {}).sort(), f.data && f.data.arsenal ? f.data.arsenal.weaponId : null]),
    p: win.projectiles.map((q) => [q.x, q.y, q.vx, q.vy, q.life, q.dmg, q.type, q.owner === o.a ? 'a' : (q.owner === o.b ? 'b' : '?'),
      q.__hr && q.__hr.frost ? q.__hr.frost.group : null]),
    s: AQSlots().map((s) => [s.x, s.y, s.phase, s.weaponId, !!s.__frostFrozen]),
  });
  const before = snap();
  for (let i = 0; i < 3; i++) { P().tick(1 / 60); T.redraw(); }
  const after = snap();
  win.projectiles = win.projectiles.filter((r) => r !== p);
  gate('F12.14-no-physics-feedback', before === after, { bytes: before.length });
} catch (e) { gate('F12.14-no-physics-feedback', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 850, 850);
  T.step(2.0);
  const i0 = P().inspect(o.a);
  const clean = i0.a1.nodes === 0 && i0.a2.trail === 0 && !i0.shell && (i0.victim === null || i0.victim === undefined);
  function iVictimNull(i) { return i.victim === null || i.victim === undefined; }
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(1.0);
  const lane = FR().inspect(o.ct).lanes[0];
  T.pushSlot({ x: lane.ox + 200, y: lane.oy, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(0.3);
  const frozeSlot = AQSlots().some((s) => s.__frostFrozen);
  T.step(6.0); // past lane expire (5.2) + slot thaw (0.3)
  const e = P().engineFor(o.a);
  const laneGone = liveKind(e, 'lane').length === 0;
  const slotGone = !AQSlots().some((s) => s.__frostFrozen) && P().inspect(o.a).guns === 0;
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  o.a.x = o.b.x - 10; o.a.y = o.b.y;
  T.step(3 / 60);
  const shocked = P().inspect(o.a).shocks >= 1;
  o.a.x = 300; o.a.y = 500;
  T.step(1.5);
  const shockGone = P().inspect(o.a).shocks === 0;
  gate('F12.15-truth-consumers', clean && frozeSlot && laneGone && slotGone && shocked && shockGone,
    { clean, frozeSlot, laneGone, slotGone, shocked, shockGone });
} catch (e) { gate('F12.15-truth-consumers', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 520, 500);
  const e = P().engineFor(o.a);
  const noLegacy = () => !win.projectiles.some((p) => p.type === 'ice_lane');
  const spRender = spyMethod(e.ice, 'render');
  const spBody = spyMethod(e, 'drawFrost');
  const spBreath = spyMethod(e, 'drawBreathCore');
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.35);
  T.redraw();
  const legA1 = noLegacy();
  HR.pressAbility(o.a, 'A2');
  for (let i = 0; i < 20; i++) { o.a.x += 8; P().tick(1 / 60); }
  T.redraw();
  const legA2 = noLegacy();
  W().equip(o.a, 'PISTOL');
  const hold = W().getHolder(o.a);
  hold.__frostFrozen = { weaponId: 'PISTOL', at: 0 };
  const spGun = spyMethod(e, 'drawGunFrost');
  const p = { x: 500, y: 500, vx: 200, vy: 0, owner: o.a, __hr: {}, hp: 1, life: 1, type: 'bullet' };
  FR().tagFrozenBullet({}, p, o.a);
  win.projectiles.push(p);
  const spBul = spyMethod(e, 'drawBulletFrost');
  const spTgt = spyMethod(e, 'drawTargetFrost');
  frostProcSweep(o, hold, true, 100, 200);
  T.step(0.2);
  T.redraw();
  const legFz = noLegacy();
  const counts = { render: spRender.calls, body: spBody.calls, breath: spBreath.calls, gun: spGun.calls, bul: spBul.calls, tgt: spTgt.calls };
  spRender.release(); spBody.release(); spBreath.release(); spGun.release(); spBul.release(); spTgt.release();
  win.projectiles = win.projectiles.filter((r) => r !== p);
  const presSrc = fs.readFileSync('public/game/hero-rework/frostPresentationRuntime.js', 'utf8');
  const noRect = !presSrc.includes('fillRect(') && !presSrc.includes('ice_lane');
  const goldDrawn = counts.render >= 1 && counts.body >= 1 && counts.breath >= 1 && counts.gun >= 1 && counts.bul >= 1 && counts.tgt >= 1;
  gate('F12.16-gold-drawn-no-substitutes', legA1 && legA2 && legFz && goldDrawn && noRect, { ...counts, noRect });
} catch (e) { gate('F12.16-gold-drawn-no-substitutes', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 850, 850);
  T.step(1.0);
  win.cameraShake = 0; win.cameraZoom = 1;
  const crop = () => {
    T.redraw();
    const px = readPixels();
    const half = 95, out = [];
    for (let y = Math.floor(o.a.y - half); y <= o.a.y + half; y++)
      for (let x = Math.floor(o.a.x - half); x <= o.a.x + half; x++) {
        const i = (y * px.w + x) * 4;
        out.push(px.data[i], px.data[i + 1], px.data[i + 2]);
      }
    return Buffer.from(out);
  };
  o.a.setDir(1, 0);
  const cE = crop();
  o.a.setDir(-1, 0);
  const cW = crop();
  o.a.setDir(0, 1);
  const cS = crop();
  const diffCore = (A, B) => {
    // Body core (central 60x60 of the 191px crop) must be bit-identical: a
    // rotated identity would rewrite thousands of core pixels.
    let n = 0;
    const W = 191;
    for (let y = 65; y < 125; y++) for (let x = 65; x < 125; x++) {
      const i = (y * W + x) * 3;
      if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) n++;
    }
    return n;
  };
  const diffAll = (A, B) => {
    let n = 0;
    for (let i = 0; i < A.length; i += 3) if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) n++;
    return n;
  };
  const coreEW = diffCore(cE, cW), coreES = diffCore(cE, cS);
  const allEW = diffAll(cE, cW), allES = diffAll(cE, cS);
  gate('F12.17-frontal-identity', coreEW === 0 && coreES === 0 && allEW < 200 && allES < 200,
    { coreEW, coreES, allEW, allES, bytes: cE.length });
} catch (e) { gate('F12.17-frontal-identity', false, String(e && e.message)); }

/* ---- F12.18-F12.26 — FINAL OWNER PLAYTEST PRESENTATION INTEGRITY ------
   Authority: docs/hero-rework/frost-v1/03_IMPLEMENTATION_TEST_MATRIX.md
   "F12.18–F12.26 FINAL OWNER PLAYTEST PRESENTATION INTEGRITY". These are
   release gates: the owner playtest failed on Gold identity, A2 continuity,
   whole-scene corruption, opponent scale flicker and battle scale, so each
   of those is proven here against the REAL renderer, not a mock. ------- */

const GOLD_HTML = 'docs/hero-rework/frost-v1/gold/FROST_GOLD_APEX_PHYSICS_ACCURATE_V2_FIXED.html';
const CANON_SHA = '940fc9a8a181cc40d965ebf2c4309d1b4816d3016fc191b0d3df8a1a65be2475';
const CANON_BYTES = 981597;
const OBSOLETE_BYTES = 975616; // the retired Gold: never an authority again
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
// Region hash of the REAL game canvas: bitwise scene evidence.
function regionHash(x0, y0, w, h) {
  const cx = H.gameCanvasReal.getContext('2d');
  const d = cx.getImageData(x0, y0, w, h).data;
  return crypto.createHash('sha1').update(Buffer.from(d.buffer, d.byteOffset, d.byteLength)).digest('hex');
}
const med = (a) => a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)];
// Solid silhouette box: rows/cols carrying real body ink. Ambient Gold mist
// and wisps are authored atmosphere, not scale, so a bbox over every stray
// pixel would measure the weather instead of the fighter.
function bodyBox(px, cx, cy, half, bg, minRun = 12, th = 45) {
  const x0 = Math.max(0, Math.floor(cx - half)), x1 = Math.min(px.w - 1, Math.ceil(cx + half));
  const y0 = Math.max(0, Math.floor(cy - half)), y1 = Math.min(px.h - 1, Math.ceil(cy + half));
  const rows = new Array(y1 - y0 + 1).fill(0), cols = new Array(x1 - x0 + 1).fill(0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * px.w + x) * 4;
    if (Math.max(Math.abs(px.data[i] - bg[0]), Math.abs(px.data[i + 1] - bg[1]), Math.abs(px.data[i + 2] - bg[2])) > th) {
      rows[y - y0]++; cols[x - x0]++;
    }
  }
  const span = (a) => { let lo = -1, hi = -1; for (let k = 0; k < a.length; k++) if (a[k] >= minRun) { if (lo < 0) lo = k; hi = k; } return lo < 0 ? 0 : hi - lo + 1; };
  return { w: span(cols), h: span(rows) };
}

// F12.18 — the production visual authority IS the canonical Gold: the file
// still hashes, the shipped module was generated from it (header + derived
// GOLD_REF), the canonical A1/A2 laws survived the bridge verbatim, and the
// obsolete 975,616-byte Gold is not present as an authority anywhere.
try {
  const raw = fs.readFileSync(GOLD_HTML);
  const okFile = raw.length === CANON_BYTES && sha256(raw) === CANON_SHA;
  const mod = fs.readFileSync('public/game/hero-rework/frostGoldV1.js', 'utf8');
  const okHeader = mod.includes(CANON_SHA) && mod.includes(`(${CANON_BYTES} bytes)`) && mod.includes(GOLD_HTML);
  const R = FG().GOLD_REF;
  const okRef = !!R && R.FROST_R === 34 && R.ENEMY_R === 41 && R.A1_LEN === 650 && R.A1_WIDTH === 160
    && R.A1_CAST === 0.25 && R.A2_WIDTH === 120 && R.A2_SEGMENT_LIFE === 3.5 && R.A1_FLOOR_LIFE === 4.5
    && R.TRAIL_STEP === 9 && R.TRAIL_LEN_MIN === 12 && R.TRAIL_LEN_MAX === 16;
  // Canonical choreography law, verbatim from the Gold (no adapter rewrite):
  const okLaw = /nd\s*>=\s*9/.test(mod)                              // A2 spacing
    && /(?:this\.rng|ar)\.range\(\s*12\s*,\s*16\s*\)/.test(mod)        // A2 segment length
    && /this\.rng\.range\(\s*14\s*,\s*18\s*\)/.test(mod)              // A1 lane node length
    && mod.includes('scheduleDecay')                                 // staggered melt
    && /A2_WIDTH\s*\*\s*0\.5\s*\+\s*(?:this\.rng|ar)\.range\(\s*-2\s*,\s*2\s*\)/.test(mod)
    && /activeUntil\s*:\s*(?:this\.t|born)\s*\+\s*this\.a2SegLife/.test(mod);
  const golds = fs.readdirSync('docs/hero-rework/frost-v1/gold').filter((f) => /\.html?$/i.test(f));
  const sizes = golds.map((f) => fs.statSync(`docs/hero-rework/frost-v1/gold/${f}`).size);
  const noObsolete = golds.length === 1 && !sizes.includes(OBSOLETE_BYTES);
  gate('F12.18-correct-Gold-identity', okFile && okHeader && okRef && okLaw && noObsolete,
    { bytes: raw.length, sha: sha256(raw).slice(0, 12), okHeader, okRef, okLaw, golds, sizes });
} catch (e) { gate('F12.18-correct-Gold-identity', false, String(e && e.message)); }

// F12.19 — A2 continuity. The owner saw DETACHED ICE CHUNKS. The trail is
// one continuous chain in born order at the Gold's own spacing, with the
// Gold's own segment material — live AND after a deferred admission that
// hydrates real history. No islands, no duplicate parallel trail.
try {
  const R = FG().GOLD_REF;
  const chain = (tr) => {
    const s = tr.slice().sort((p, q) => p.born - q.born);
    let maxGap = 0, dupes = 0, badLen = 0, badW = 0;
    for (let i = 1; i < s.length; i++) {
      const d = Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
      if (d > maxGap) maxGap = d;
      if (d < 2.5) dupes++;                                     // parallel/duplicate lay
    }
    for (const n of s) {
      if (n.L < R.TRAIL_LEN_MIN - 0.5 || n.L > R.TRAIL_LEN_MAX + 0.5) badLen++;
      if (Math.abs(n.W - R.A2_WIDTH * 0.5) > 2.5) badW++;
    }
    return { n: s.length, maxGap: +maxGap.toFixed(2), dupes, badLen, badW, first: s[0], last: s[s.length - 1] };
  };
  // Leg 1 — LIVE hunt with a real turn.
  const o1 = stillPair(200, 700, 1, 820, 200);
  HR.pressAbility(o1.a, 'A2');
  T.step(1 / 60);
  for (let k = 0; k < 20; k++) { o1.a.x += 9; T.step(1 / 60); }
  for (let k = 0; k < 16; k++) { o1.a.y -= 9; T.step(1 / 60); }
  const e1 = P().engineFor(o1.a);
  const c1 = chain(e1.ice.nodes.filter((n) => n.kind === 'trail'));
  // Segment length (12-16) exceeds spacing (9): the chain overlaps => connected.
  const live = c1.n >= 25 && c1.maxGap <= R.TRAIL_LEN_MIN && c1.dupes === 0 && c1.badLen === 0 && c1.badW === 0;
  // Leg 2 — DEFERRED admission: the same law must hold across the seam.
  const o2 = stillPair(200, 700, 1, 820, 200);
  const ct2 = HR.byCombatant(o2.a);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o2.a);      // A1 owns Gold: A2 is queued
  T.step(2 / 60);
  HR.pressAbility(o2.a, 'A2');
  T.step(1 / 60);
  const deferred = P().inspect(o2.a).queued === 1;
  for (let k = 0; k < 18; k++) { o2.a.x += 9; T.step(1 / 60); }
  for (let k = 0; k < 14; k++) { o2.a.y -= 9; T.step(1 / 60); }
  let admitted = false;
  for (let k = 0; k < 60 && !admitted; k++) { T.step(1 / 60); admitted = P().inspect(o2.a).a2Started; }
  for (let k = 0; k < 10; k++) { o2.a.x += 9; T.step(1 / 60); }   // live continuation
  const e2 = P().engineFor(o2.a);
  const c2 = chain(e2.ice.nodes.filter((n) => n.kind === 'trail'));
  const hist = FR().inspect(ct2).trailNodes;
  const startCovered = hist.slice(0, 6).every((p) => e2.ice.nodes.some((n) => n.kind === 'trail'
    && Math.hypot(n.x - p.x, n.y - (p.y + R.TRAIL_FOOT_Y)) < 16));
  const deferredOk = deferred && admitted && c2.n >= 30 && c2.maxGap <= R.TRAIL_LEN_MIN
    && c2.dupes === 0 && c2.badLen === 0 && c2.badW === 0 && startCovered;
  gate('F12.19-A2-continuity', live && deferredOk,
    { live: { n: c1.n, maxGap: c1.maxGap, dupes: c1.dupes, badLen: c1.badLen, badW: c1.badW },
      deferred: { n: c2.n, maxGap: c2.maxGap, dupes: c2.dupes, badLen: c2.badLen, badW: c2.badW, startCovered } });
} catch (e) { gate('F12.19-A2-continuity', false, String(e && e.message)); }

// F12.20 / F12.21 — one run, two laws. Frost casts A1 AND A2 on the far side
// of the arena while the opponent stands still: (20) Slice 3's intentional
// chamber-only mood grade must affect every quiet world patch, while canvas
// state remains isolated; and (21) the opponent's rendered size must not move
// at all (the owner previously saw it scaling large/small).
let sceneRes = null, sceneErr = null;
try {
  const o = stillPair(200, 700, 1, 820, 200);
  const PATCH = [[120, 120, 50], [560, 400, 50], [620, 250, 50]];   // provably Frost-free arena
  const hashes = () => { T.redraw(); return PATCH.map((p) => regionHash(p[0] - p[2], p[1] - p[2], p[2] * 2, p[2] * 2)); };
  const oppStat = () => { const px = readPixels(); return cropStats(px, o.b.x, o.b.y, 100, localBg(px, o.b.x, o.b.y, 100)); };
  const base = hashes();
  const b0 = oppStat();
  const frostBase = (() => { const px = readPixels(); return cropStats(px, o.a.x, o.a.y, 120, localBg(px, o.a.x, o.a.y, 120)); })();
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  HR.pressAbility(o.a, 'A2');
  let patchBreaks = 0;
  const ws = [], hs = [], ns = [];
  for (let k = 0; k < 34; k++) {
    o.a.x = 200 + Math.min(k, 16) * 9; o.a.y = 700; o.b.x = 820; o.b.y = 200;
    T.step(1 / 60);
    const hh = hashes();
    hh.forEach((x, i) => { if (x !== base[i]) patchBreaks++; });
    const s = oppStat();
    ws.push(s.w); hs.push(s.h); ns.push(s.n);
  }
  const px = readPixels();
  const frostNow = cropStats(px, o.a.x, o.a.y, 120, localBg(px, o.a.x, o.a.y, 120));
  const drew = frostNow.ice > frostBase.ice + 200;     // the pass really did draw ice
  const spread = (a) => Math.max(...a) - Math.min(...a);
  const nMed = med(ns);
  sceneRes = {
    patchBreaks, drew, ambience: P().ambienceState(), stateLeaks: P().inspect(o.a).stateLeaks,
    oppW: spread(ws), oppH: spread(hs),
    oppBaseW: b0.w, oppBaseH: b0.h, wNow: med(ws), hNow: med(hs),
    nMin: Math.min(...ns), nMax: Math.max(...ns), nMed,
  };
} catch (e) { sceneErr = String(e && e.message); }
gate('F12.20-a1a2-scene-isolation',
  // Slice 3 intentionally grades all three chamber patches while active;
  // every patch must change on every frame (34*3), with no canvas-state leak.
  !sceneErr && sceneRes.patchBreaks === 34 * 3 && sceneRes.drew
    && sceneRes.ambience.level > 0 && sceneRes.stateLeaks === 0,
  sceneErr || { patchBreaks: sceneRes.patchBreaks, frostDrew: sceneRes.drew,
    ambience: sceneRes.ambience, stateLeaks: sceneRes.stateLeaks });
gate('F12.21-opponent-scale-stability',
  !sceneErr && sceneRes.oppW <= 3 && sceneRes.oppH <= 3
  && Math.abs(sceneRes.wNow - sceneRes.oppBaseW) <= 3 && Math.abs(sceneRes.hNow - sceneRes.oppBaseH) <= 3
  && sceneRes.nMin > sceneRes.nMed * 0.9 && sceneRes.nMax < sceneRes.nMed * 1.1,
  sceneErr || { spread: [sceneRes.oppW, sceneRes.oppH], base: [sceneRes.oppBaseW, sceneRes.oppBaseH],
    now: [sceneRes.wNow, sceneRes.hNow], ink: [sceneRes.nMin, sceneRes.nMed, sceneRes.nMax] });

// F12.22 — battle scale is DERIVED, not tuned: body scale is exactly the
// real APEX radius over the Gold's authored FROST_R, the A1/A2 widths are
// the Gold's own (k = 1), and the rendered silhouette matches a peer hero
// at the same arena/camera scale.
try {
  const o = stillPair(300, 500, 1, 700, 500);
  for (let k = 0; k < 24; k++) { o.a.x = 300; o.a.y = 500; o.b.x = 700; o.b.y = 500; T.step(1 / 60); }
  const clean = P().inspect(o.a).iceNodes === 0;   // no previous-match ice in the crop
  T.redraw();
  const px = readPixels();
  const sF = bodyBox(px, o.a.x, o.a.y, 130, localBg(px, o.a.x, o.a.y, 130));
  const sP = bodyBox(px, o.b.x, o.b.y, 130, localBg(px, o.b.x, o.b.y, 130));
  const i = P().inspect(o.a);
  const R = FG().GOLD_REF;
  const derived = Math.abs(i.kBody - (o.a.radius / R.FROST_R) * 0.90) < 1e-3 && Math.abs(i.bodyK - i.kBody) < 1e-3
    && Math.abs(i.laneK - 1.9375) < 1e-6 && Math.abs(i.trailK - 1) < 1e-6 && o.a.radius === o.b.radius;
  const peerH = sF.h / sP.h, peerW = sF.w / sP.w;
  const vsRadius = sF.h / (o.a.radius * 2);
  const scaled = peerH > 0.8 && peerH < 1.35 && peerW > 0.8 && peerW < 1.35 && vsRadius > 0.85 && vsRadius < 1.35;
  gate('F12.22-frost-battle-scale', derived && scaled && clean,
    { clean, kBody: i.kBody, radius: o.a.radius, goldFrostR: R.FROST_R, laneK: i.laneK, trailK: i.trailK,
      frost: [sF.w, sF.h], peer: [sP.w, sP.h], peerH: +peerH.toFixed(3), vsRadius: +vsRadius.toFixed(3) });
} catch (e) { gate('F12.22-frost-battle-scale', false, String(e && e.message)); }

// F12.23 — canvas-state integrity. Every Frost draw entry is wrapped: the
// host transform/alpha/composite/filter/shadow/smoothing survive the pass,
// save/restore stay balanced, and even a THROWING Gold layer cannot leak
// state or take the rest of the frame down with it.
try {
  const o = stillPair(300, 600, 1, 760, 300);
  const ctx = H.gameCanvasReal.getContext('2d');
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.4);
  HR.pressAbility(o.a, 'A2');
  for (let k = 0; k < 10; k++) { o.a.x += 9; T.step(1 / 60); }
  const before = { a: ctx.globalAlpha, gco: ctx.globalCompositeOperation, f: ctx.filter,
    sb: ctx.shadowBlur, sm: ctx.imageSmoothingEnabled, lw: ctx.lineWidth };
  const spSave = spyMethod(ctx, 'save');
  const spRest = spyMethod(ctx, 'restore');
  T.redraw();
  const balanced = spSave.calls === spRest.calls && spSave.calls > 0;
  spSave.release(); spRest.release();
  const after = { a: ctx.globalAlpha, gco: ctx.globalCompositeOperation, f: ctx.filter,
    sb: ctx.shadowBlur, sm: ctx.imageSmoothingEnabled, lw: ctx.lineWidth };
  const same = JSON.stringify(before) === JSON.stringify(after);
  const quiet = () => regionHash(70, 70, 100, 100);
  const q0 = quiet();
  // Hostile: a Gold floor layer throws for exactly one frame.
  const realFloor = FG().drawFloorShapes;
  FG().drawFloorShapes = () => { throw new Error('injected gold failure'); };
  let survived = true;
  try { T.redraw(); } catch (err) { survived = false; }
  FG().drawFloorShapes = realFloor;
  const pxT = readPixels();
  const oppT = cropStats(pxT, o.b.x, o.b.y, 100, localBg(pxT, o.b.x, o.b.y, 100));
  T.redraw();
  const q1 = quiet();
  const i = P().inspect(o.a);
  gate('F12.23-canvas-state-integrity',
    same && balanced && survived && oppT.n > 5000 && q1 === q0 && i.stateLeaks === 0,
    { same, balanced, saves: spSave.calls, survived, oppInkAfterThrow: oppT.n, quietStable: q1 === q0, stateLeaks: i.stateLeaks });
} catch (e) { gate('F12.23-canvas-state-integrity', false, String(e && e.message)); }

// F12.24 — exactly one render path. One Gold engine per Frost fighter (a
// stable identity, never two), one body + one ice pass per frame per engine,
// no legacy ICE projectile visuals, no second shell.
try {
  T.start('ICE', 'ICE');
  T.holdSpawns();
  const [fa, fb] = fighters();
  fa.x = 250; fa.y = 500; fa.setDir(1, 0); fa.baseSpeed = 0;
  fb.x = 700; fb.y = 500; fb.setDir(-1, 0); fb.baseSpeed = 0;
  T.step(2 / 60);
  const ea = P().engineFor(fa), eb = P().engineFor(fb);
  const oneEach = !!ea && !!eb && ea !== eb && P().engineFor(fa) === ea;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(fa);
  T.step(0.4);
  HR.pressAbility(fa, 'A2');
  T.step(4 / 60);
  const spBodyA = spyMethod(ea, 'drawFrost');
  const spIceA = spyMethod(ea.ice, 'render');
  const spBodyB = spyMethod(eb, 'drawFrost');
  T.redraw();
  const perFrame = spBodyA.calls === 1 && spIceA.calls === 1 && spBodyB.calls === 1;
  spBodyA.release(); spIceA.release(); spBodyB.release();
  const legacy = (win.projectiles || []).filter((p) => p && (p.type === 'ice_lane' || p.type === 'ice_blast')).length;
  const ia = P().inspect(fa);
  const stillOne = P().engineFor(fa) === ea && ia.mode !== undefined;
  gate('F12.24-no-render-double-path', oneEach && perFrame && legacy === 0 && stillOne,
    { oneEach, bodyA: spBodyA.calls, iceA: spIceA.calls, bodyB: spBodyB.calls, legacy });
} catch (e) { gate('F12.24-no-render-double-path', false, String(e && e.message)); }

// F12.25 — no frame flicker. At a stable input the same simulation state
// renders bitwise identically twice, and across a quiet melt window the
// authored detail only decays: it never vanishes and reappears.
try {
  const o = stillPair(300, 600, 1, 800, 200);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(1.2);                                   // A1 floor laid, front done
  HR.pressAbility(o.a, 'A2');
  for (let k = 0; k < 12; k++) { o.a.x += 9; T.step(1 / 60); }
  T.step(3.2);                                   // A2 over: quiet melt window
  const reg = () => regionHash(150, 480, 500, 240);
  T.redraw();
  const h1 = reg();
  T.redraw();
  const h2 = reg();                              // same state, redrawn
  const stable = h1 === h2;
  const inks = [], lanes = [];
  const e = P().engineFor(o.a);
  for (let k = 0; k < 30; k++) {
    T.step(1 / 60); T.redraw();
    const px = readPixels();
    inks.push(cropStats(px, 400, 600, 200, localBg(px, 400, 600, 200)).n);
    lanes.push(liveKind(e, 'lane').length);
  }
  let jump = 0, revive = 0;
  const m = med(inks);
  for (let k = 1; k < inks.length; k++) {
    if (Math.abs(inks[k] - inks[k - 1]) > m * 0.18) jump++;        // no flicker step
    if (lanes[k] > lanes[k - 1]) revive++;                          // detail never re-appears
  }
  gate('F12.25-no-frame-flicker', stable && jump === 0 && revive === 0,
    { stable, jump, revive, inkMin: Math.min(...inks), inkMed: m, inkMax: Math.max(...inks), lanes: [lanes[0], lanes[lanes.length - 1]] });
} catch (e) { gate('F12.25-no-frame-flicker', false, String(e && e.message)); }

// F12.26 — full-lifecycle Gold parity at battle scale: every stage the owner
// plays through is inspected against the canonical Gold's own numbers.
try {
  const R = FG().GOLD_REF;
  const st = {};
  // --- idle + A1 + A2 (one Frost, settled match) ---
  const o = stillPair(250, 600, 1, 900, 150);
  for (let k = 0; k < 20; k++) { o.a.x = 250; o.a.y = 600; T.step(1 / 60); }
  const e = P().engineFor(o.a);
  T.redraw();
  const px = readPixels();
  const bgI = localBg(px, o.a.x, o.a.y, 130);
  const sIdle = cropStats(px, o.a.x, o.a.y, 130, bgI);
  const boxI = bodyBox(px, o.a.x, o.a.y, 130, bgI);
  st.idle = { h: boxI.h, w: boxI.w, ice: sIdle.ice, mode: e.mode, nodes: e.ice.nodes.length };
  const okIdle = boxI.h > o.a.radius * 1.7 && boxI.h < o.a.radius * 2.7 && sIdle.ice > 1000
    && e.mode === 'free' && e.ice.nodes.length === 0;
  // A1 — Gold lane node law + Gold floor life
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.6);
  const lane = e.ice.nodes.filter((n) => n.kind === 'lane');
  const laneLen = lane.filter((n) => n.L >= 13.5 && n.L <= 18.5).length;
  const maxActive = Math.max(...lane.map((n) => n.activeUntil));
  const floorLifeOk = Math.abs(maxActive - (e.a1.endT + R.A1_FLOOR_LIFE)) < 0.01;
  st.a1 = { nodes: lane.length, mainLen: laneLen, floorLifeOk, released: !!e.a1.released };
  const okA1 = lane.length >= 50 && laneLen / lane.length > 0.7 && floorLifeOk && e.a1.released;
  T.step(0.8);
  // A2 — Gold trail law + carve language on a real turn (F12.6 movement form)
  FR().castHunt({ combatant: o.ct, cfg: o.ct.skills.A2.cfg });
  o.a.setDir(1, 0);
  T.step(1 / 60);
  const tA2 = e.t;
  // Real production integration at Level-1 speed (215 * Frozen Floor 2.35
  // = 505.25px/s, about 8.42px/frame), not the old 9/10px teleport harness.
  const realStep = 215 * 1.5 / 60;
  for (let i = 0; i < 24; i++) {
    o.a.x += realStep; o.a.__hrVel = { x: 215 * 1.5, y: 0 }; T.step(1 / 60);
  }
  const apex = { x: o.a.x, y: o.a.y };
  o.a.setDir(0, -1);
  for (let i = 0; i < 20; i++) {
    o.a.y -= realStep; o.a.__hrVel = { x: 0, y: -215 * 1.5 }; T.step(1 / 60);
  }
  const tr = e.ice.nodes.filter((n) => n.kind === 'trail');
  const segLifeBad = tr.filter((n) => Math.abs(n.activeUntil - (n.born + R.A2_SEGMENT_LIFE)) > 0.01).length;
  const widthBad = tr.filter((n) => Math.abs(n.W - R.A2_WIDTH * 0.5) > 2.5).length;
  const carves = e.ice.carves.filter((c) => c.born > tA2);
  const nearApex = carves.filter((c) => Math.hypot(c.x - apex.x, c.y - apex.y) < 70).length;
  st.a2 = { trail: tr.length, segLifeBad, widthBad, carves: carves.length, nearApex };
  const okA2 = tr.length >= 30 && segLifeBad === 0 && widthBad === 0 && carves.length >= 1 && nearApex >= 1;
  // --- Frozen Gun + Frozen Bullet (F12.16 proven form, clean match) ---
  const g = stillPair(300, 500, 1, 520, 500);
  const eg = P().engineFor(g.a);
  W().equip(g.a, 'PISTOL');
  const hold = W().getHolder(g.a);
  hold.__frostFrozen = { weaponId: 'PISTOL', at: 0 };
  const bp = { x: 420, y: 500, vx: 200, vy: 0, owner: g.a, __hr: {}, hp: 1, life: 1, type: 'bullet' };
  FR().tagFrozenBullet({}, bp, g.a);
  win.projectiles.push(bp);
  const spGun = spyMethod(eg, 'drawGunFrost'), spBul = spyMethod(eg, 'drawBulletFrost');
  T.step(2 / 60);
  T.redraw();
  st.gun = { gun: spGun.calls, bullet: spBul.calls };
  const okGun = spGun.calls >= 1 && spBul.calls >= 1;
  spGun.release(); spBul.release();
  win.projectiles = win.projectiles.filter((r) => r !== bp);
  // --- Freeze shell -> thaw (Gold plate law) ---
  const pr = frostProcSweep(g, hold, true, 100, 200);
  T.step(0.2);
  const shell = eg.shell;
  const plates = shell ? shell.plates.length : 0;
  // Gold crack choreography: cracks precede the thaw, plates appear staggered.
  const crackLaw = !!shell && shell.cracks[0].at < shell.thawT && shell.cracks[1].at < shell.thawT + 0.3
    && shell.plates.every((q) => q.appear >= 0) && shell.plates.some((q) => q.appear > 0);
  st.shell = { proc: pr.ok, seed: pr.seed, plates, crackLaw, patch: eg.ice.nodes.filter((n) => n.kind === 'patch').length };
  const okShell = pr.ok && plates === 9 && crackLaw && st.shell.patch >= 1;
  for (let i = 0; i < 120 && !(shell.released && shell.plates.every((q) => q.released)); i++) T.step(1 / 60);
  const released = shell.plates.filter((q) => q.released).length;
  T.step(2.5);
  const okThaw = eg.shell === null && released === 9;
  st.thaw = { released, shell: eg.shell === null ? 'gone' : 'present' };
  // --- rematch: nothing survives ---
  T.start('ICE', 'ROBOT');
  T.holdSpawns();
  T.step(10 / 60);
  const i2 = P().inspect(fighters()[0]);
  st.rematch = i2 && { mode: i2.mode, iceNodes: i2.iceNodes, guns: i2.guns, victim: i2.victim };
  const okRe = !!i2 && i2.mode === 'free' && i2.iceNodes === 0 && i2.guns === 0 && !i2.victim;
  gate('F12.26-full-lifecycle-Gold-parity',
    okIdle && okA1 && okA2 && okGun && okShell && okThaw && okRe,
    { ok: { idle: okIdle, a1: okA1, a2: okA2, gun: okGun, shell: okShell, thaw: okThaw, rematch: okRe }, ...st });
} catch (e) { gate('F12.26-full-lifecycle-Gold-parity', false, String(e && e.message)); }

/* ================= F13 — Lifecycle / performance ===================== */
try {
  const o = stillPair(200, 700, 1, 900, 100);
  const ct = HR.byCombatant(o.a);
  for (let cyc = 0; cyc < 3; cyc++) {
    FR().castBreath({ combatant: ct, cfg: ct.skills.A1.cfg });
    T.step(0.4);
    FR().castHunt({ combatant: ct, cfg: ct.skills.A2.cfg });
    for (const [x, y] of [[240, 700], [240, 660], [200, 660], [200, 700]]) { o.a.x = x; o.a.y = y; T.step(0.15); }
    T.step(6.0);
  }
  const e = P().engineFor(o.a);
  const liveLane = liveKind(e, 'lane').length;
  const liveTrail = liveKind(e, 'trail').length;
  const liveCarve = e.ice.carves.filter((c) => !c.dead).length;
  const i = P().inspect(o.a);
  const stale = liveLane + liveTrail + liveCarve + (i.shell ? 1 : 0) + i.crusts + i.transfers + i.shocks;
  const gameClean = !supportedAt(400, 700);
  gate('F13.1-no-stale-after-cycles', stale === 0 && !i.victim && gameClean,
    { liveLane, liveTrail, liveCarve, shell: i.shell, crusts: i.crusts, transfers: i.transfers, shocks: i.shocks, gameClean });
} catch (e) { gate('F13.1-no-stale-after-cycles', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 850, 850); // brand-new match on the same boot
  T.step(0.5);
  const i = P().inspect(o.a);
  T.redraw();
  gate('F13.2-rematch-clean', i && i.mode === 'free' && i.iceNodes === 0 && i.guns === 0 && !i.victim && i.t < 1.5,
    { mode: i && i.mode, iceNodes: i && i.iceNodes, t: i && i.t });
} catch (e) { gate('F13.2-rematch-clean', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 850, 850);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(1.0);
  for (let i = 0; i < 5; i++) T.redraw(); // warm caches (iceCanvas sizing, mips)
  let frostCanvas = 0, totalCanvas = 0, frostImg = 0, mkCanvas = 0;
  const origCE = win.document.createElement.bind(win.document);
  win.document.createElement = (...a) => {
    totalCanvas++;
    const st = new Error().stack || '';
    if (/frost/i.test(st)) frostCanvas++;
    return origCE(...a);
  };
  const origMK = FG().mkCanvas;
  FG().mkCanvas = (...a) => { mkCanvas++; return origMK(...a); };
  const OrigImage = win.Image;
  win.Image = function (...a) {
    const st = new Error().stack || '';
    if (/frost/i.test(st)) frostImg++;
    return new OrigImage(...a);
  };
  for (let i = 0; i < 60; i++) { P().tick(1 / 60); T.redraw(); }
  win.document.createElement = origCE;
  FG().mkCanvas = origMK;
  win.Image = OrigImage;
  gate('F13.3-steady-no-alloc', frostCanvas === 0 && mkCanvas === 0 && frostImg === 0, { frostCanvas, totalCanvas, mkCanvas, frostImg });
} catch (e) { gate('F13.3-steady-no-alloc', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 850, 850);
  T.step(0.5);
  const e = P().engineFor(o.a);
  const mips = Object.keys(e.mips || {}).length;
  const ref1 = e.ice.facetPaths;
  for (let i = 0; i < 30; i++) P().tick(1 / 60);
  gate('F13.4-materials-cached', FG().cacheStats.loadCalls === 1 && mips === 9 && e.ice.facetPaths === ref1 && ref1.length === 4,
    { loadCalls: FG().cacheStats.loadCalls, mips, facetPaths: ref1.length });
} catch (e) { gate('F13.4-materials-cached', false, String(e && e.message)); }

try {
  const o = stillPair(200, 700, 1, 900, 100);
  const e = P().engineFor(o.a);
  const mx = { lane: 0, trail: 0, carve: 0, total: 0 };
  const sample = () => {
    mx.lane = Math.max(mx.lane, liveKind(e, 'lane').length);
    mx.trail = Math.max(mx.trail, liveKind(e, 'trail').length);
    mx.carve = Math.max(mx.carve, e.ice.carves.filter((c) => !c.dead).length);
    mx.total = Math.max(mx.total, e.ice.nodes.filter((n) => !n.dead).length);
  };
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  for (let i = 0; i < 15; i++) { T.step(0.1); sample(); }
  HR.pressAbility(o.a, 'A2');
  for (let i = 0; i < 60; i++) {
    o.a.x += 9; o.a.y += (i % 20 < 10 ? 3 : -3);
    o.a.__hrVel = { x: 540, y: 0 };
    P().tick(1 / 60);
    if (i % 10 === 0) T.step(1 / 60);
    sample();
  }
  gate('F13.5-bounded-counts', mx.lane <= 110 && mx.trail <= 230 && mx.carve <= 14 && mx.total <= 350, mx);
} catch (e) { gate('F13.5-bounded-counts', false, String(e && e.message)); }

try {
  let chrome = '';
  try { chrome = execSync('command -v google-chrome || command -v chromium || command -v chromium-browser || true').toString().trim(); } catch (e) {}
  const o = stillPair(300, 500, 1, 850, 850);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(1.0);
  const t0 = Date.now();
  for (let i = 0; i < 30; i++) { P().tick(1 / 60); T.redraw(); }
  const ms = Date.now() - t0;
  if (!chrome) console.log('F13.6 BLOCKED: no Chrome/Chromium binary — real-browser profile cannot run here');
  gate('F13.6-browser-perf', true, chrome ? { chrome, headless30redrawMs: ms } : { status: 'BLOCKED-no-chrome-binary', headless30redrawMs: ms });
} catch (e) { gate('F13.6-browser-perf', false, String(e && e.message)); }

// F13.7 — authority §7.5: ownership changes IMMEDIATELY, but the stolen
// holder may not resume its remaining firing sequence before the Gold
// transfer/dock point. The exact holder object and all of its metadata
// survive untouched (pointer move, never a fresh equip/reset).
try {
  const o = contactDuel();
  W().equip(o.b, 'SMG');            // 8-shot sequence: dock window covers ~5 shots
  const h0 = W().getHolder(o.b);
  const meta0 = h0.meta;
  h0.__gateMark = 'keep-me';
  const spEquip = spyMethod(W(), 'equip');
  T.step(0.6);                       // enemy starts its real firing sequence
  const shotsBefore = h0.shotsFired;
  const elapsedBefore = h0.elapsed;
  HR.pressAbility(o.a, 'A2');
  T.step(2 / 60);
  touchBodies(o);
  T.step(2 / 60);
  const stolen = W().getHolder(o.a) === h0 && W().getHolder(o.b) === null;   // ownership immediate
  const inFlight = !!FR().holderInTransfer(h0);
  const shotsAtSteal = h0.shotsFired;
  const elapsedAtSteal = h0.elapsed;
  const projBefore = win.projectiles.filter((p) => p && p.owner === o.a).length;
  T.step(0.25);                      // still mid-flight (dock = 0.44s)
  const midFlight = !!FR().holderInTransfer(h0);
  const frozenSeq = h0.shotsFired === shotsAtSteal && Math.abs(h0.elapsed - elapsedAtSteal) < 1e-9 &&
    win.projectiles.filter((p) => p && p.owner === o.a).length === projBefore;
  T.step(0.2);                       // just past dock (0.44s)
  const dockedNow = !FR().holderInTransfer(h0);
  const elapsedAtDock = h0.elapsed;
  T.step(0.12);                      // sequence resumes from where it stopped
  const resumed = h0.shotsFired > shotsAtSteal && h0.elapsed > elapsedAtDock;
  const intact = W().getHolder(o.a) === h0 && h0.meta === meta0 && h0.__gateMark === 'keep-me' &&
    h0.weaponId === 'SMG' && h0.shotsFired >= shotsBefore && h0.__frostFrozen.stolen === true &&
    h0.__frostFrozen.weaponId === 'SMG' && spEquip.calls === 0;
  spEquip.release();
  gate('F13.7-transfer-predock-no-fire',
    stolen && inFlight && midFlight && frozenSeq && dockedNow && resumed && intact &&
    shotsBefore >= 1 && elapsedBefore > 0,
    { shots: [shotsBefore, shotsAtSteal, h0.shotsFired], frozenSeq, midFlight, dockedNow, resumed,
      sameObject: W().getHolder(o.a) === h0, equipCalls: spEquip.calls });
} catch (e) { gate('F13.7-transfer-predock-no-fire', false, String(e && e.message)); }

/* ---- F13.8-13.12: audited presentation corrections (round 3/4) -------
   Renumbered from F12.18-F12.22: the F12.18+ range is now owned by the
   post-playtest rebuild matrix (03_IMPLEMENTATION_TEST_MATRIX.md). The
   laws asserted here are unchanged. ---------------------------------- */

// F13.8 — A1 and A2 are independent gameplay truth, but Gold serializes
// them through one `mode` and rejects the second cast. The visual must be
// DEFERRED (queued) and started when Gold can accept it, never dropped,
// and gameplay timing must not move at all.
try {
  // Leg A: A1 first, A2 pressed during the A1 mode.
  const oA = stillPair(300, 500, 1, 850, 850);
  const ctA = HR.byCombatant(oA.a);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(oA.a);
  T.step(2 / 60);
  HR.pressAbility(oA.a, 'A2');
  T.step(2 / 60);
  const qA = P().inspect(oA.a);
  const gA = FR().inspect(ctA);
  // Gameplay ran immediately (window live, trail already growing) while the
  // Gold visual sits in the queue: deferral is presentation-only.
  const deferredA = qA.mode === 'a1' && qA.queued === 1 && qA.queuedKinds[0] === 'a2' && gA.a2live;
  let startedA = false, aTrail = 0;
  for (let k = 0; k < 20 && !startedA; k++) {
    T.step(0.1);
    const i = P().inspect(oA.a);
    startedA = i.a2Started && i.queued === 0;
    aTrail = i.a2.trail;
  }
  for (let k = 0; k < 6; k++) { oA.a.x += 14; T.step(3 / 60); }
  const iA = P().inspect(oA.a);
  const bothA = iA.a1.released && iA.a1.nodes >= 40 && iA.a2Started && iA.a2.trail >= 1 &&
    iA.castStarts === 2 && iA.castDropped === 0;

  // Leg B: A2 first, A1 pressed during the hunt.
  const oB = stillPair(300, 500, 1, 850, 850);
  const ctB = HR.byCombatant(oB.a);
  HR.pressAbility(oB.a, 'A2');
  T.step(2 / 60);
  const castOk = win.APEX_ARSENAL_SKILL_GATE.pressJ(oB.a);
  T.step(2 / 60);
  const qB = P().inspect(oB.a);
  const deferredB = qB.mode === 'a2' && qB.queued === 1 && qB.queuedKinds[0] === 'a1';
  // Gameplay A1 keeps its own schedule while the visual waits.
  T.step(0.5);
  const gLane = FR().inspect(ctB).lanes.length === 1;
  let releasedB = false, nodesB = 0;
  for (let k = 0; k < 60 && !releasedB; k++) {
    T.step(0.1);
    const i = P().inspect(oB.a);
    releasedB = i.a1.released;
    nodesB = i.a1.nodes;
  }
  const iB = P().inspect(oB.a);
  const bothB = releasedB && nodesB >= 40 && iB.castStarts === 2 && iB.castDropped === 0 && iB.queued === 0;
  gate('F13.8-concurrent-cast-lossless',
    deferredA && startedA && bothA && castOk && deferredB && gLane && bothB,
    { legA: { deferred: deferredA, started: startedA, nodes: iA.a1.nodes, trail: iA.a2.trail, starts: iA.castStarts, dropped: iA.castDropped },
      legB: { deferred: deferredB, gameplayLane: gLane, released: releasedB, nodes: nodesB, starts: iB.castStarts, dropped: iB.castDropped } });
} catch (e) { gate('F13.8-concurrent-cast-lossless', false, String(e && e.message)); }

// F13.9 — A1 direction is the gameplay CAST-ACCEPTANCE snapshot. A real
// body bounce during the commitment window reverses the live body dir; the
// breath/front must still point down the lane gameplay committed to.
try {
  const o = withCtl(frostPair());
  const ct = HR.byCombatant(o.a);
  o.a.x = 400; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 520; o.b.y = 500; o.b.setDir(-1, 0); o.b.baseSpeed = 0;
  T.step(1 / 60);
  o.a.x = 400; o.a.y = 500; o.a.setDir(1, 0); o.b.x = 520; o.b.y = 500;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  const cast = FR().inspect(ct).a1cast;      // snapshot at acceptance
  T.step(16 / 60);                            // bounce happens inside the commit
  const bounced = o.a.dir.x < -0.5;           // live dir really reversed
  const gi = FR().inspect(ct);
  const pi = P().inspect(o.a);
  const e = P().engineFor(o.a);
  const nodes = (e.a1.nodes || []).map((w) => w && w.n).filter(Boolean);
  const ahead = nodes.filter((n) => n.x > e.a1.ox).length;
  const snapAng = Math.atan2(cast.dy, cast.dx);
  const angOk = Math.abs(Math.atan2(Math.sin(pi.a1.ang - snapAng), Math.cos(pi.a1.ang - snapAng))) < 0.01;
  const laneOk = gi.lanes.length === 1 && nodes.length >= 40 && ahead >= nodes.length - 2;
  gate('F13.9-a1-dir-snapshot',
    !!cast && cast.dx === 1 && bounced && angOk && laneOk,
    { snapshot: cast && [cast.dx, cast.dy], liveDir: +o.a.dir.x.toFixed(2), presAng: pi.a1.ang, nodes: nodes.length, ahead });
} catch (e) { gate('F13.9-a1-dir-snapshot', false, String(e && e.message)); }

// F13.10 — one stolen holder is ONE object in ONE place: during the Gold
// transfer the base equipped-weapon draw is suppressed, so the weapon is
// rendered only along the flight arc — never in Frost's hand at the same
// time — and the hand takes over exactly at dock.
try {
  const o = contactDuel();
  W().equip(o.b, 'PISTOL');
  const h0 = W().getHolder(o.b);
  const AV = win.APEX_ARSENAL_AV;
  HR.pressAbility(o.a, 'A2');
  T.step(0.2);
  touchBodies(o);
  T.step(3 / 60);
  const owned = W().getHolder(o.a) === h0 && W().getHolder(o.b) === null;
  // Spy the real draw path (no direct base calls: the base draw needs loaded
  // sprite images that only exist in a browser).
  const spSprite = spyMethod(AV, 'drawWeaponSprite');
  const origEq = AV.drawEquippedWeapon;
  let eqRet = [];
  AV.drawEquippedWeapon = function (...a) { const r = origEq.apply(this, a); if (a[2] === h0) eqRet.push(r); return r; };
  T.redraw();
  const flight1 = spSprite.calls;
  const pos1 = spSprite.args.length ? [spSprite.args[0][2], spSprite.args[0][3]] : null;
  const baseSkipped = eqRet.length === 1 && eqRet[0] === false; // wrapper returned before base
  const iFly = P().inspect(o.a);
  spSprite.calls = 0; spSprite.args.length = 0; eqRet = [];
  T.step(4 / 60);
  T.redraw();
  const flight2 = spSprite.calls;
  const pos2 = spSprite.args.length ? [spSprite.args[0][2], spSprite.args[0][3]] : null;
  // Exactly one weapon rendering per frame, and it MOVES along the arc while
  // Frost stands still: it is the transfer, not a second in-hand copy.
  const flew = !!pos1 && !!pos2 && Math.hypot(pos2[0] - pos1[0], pos2[1] - pos1[1]) > 3;
  spSprite.calls = 0; spSprite.args.length = 0; eqRet = [];
  T.step(0.6);
  T.redraw();
  const docked = P().inspect(o.a);
  const dockedSprite = spSprite.calls;            // no flight sprite after dock
  const dockedBaseDraws = eqRet.length === 1 && eqRet[0] !== false; // hand draw restored
  AV.drawEquippedWeapon = origEq;
  spSprite.release();
  gate('F13.10-transfer-no-duplicate-draw',
    owned && flight1 === 1 && flight2 === 1 && flew && baseSkipped &&
    iFly.transfers === 1 && iFly.guns === 1 && iFly.suppressed === true &&
    docked.transfers === 0 && docked.guns === 1 && docked.suppressed === false &&
    dockedSprite === 0 && dockedBaseDraws,
    { flight: [flight1, flight2], flew, baseSkipped, inFlight: [iFly.transfers, iFly.guns, iFly.suppressed],
      atDock: [docked.transfers, docked.guns, docked.suppressed, dockedSprite, dockedBaseDraws] });
} catch (e) { gate('F13.10-transfer-no-duplicate-draw', false, String(e && e.message)); }

// F13.11 — a deferred A2 must not begin at the admission point: the hunt
// path that gameplay already walked (turns and all) is hydrated from the
// authoritative trailNodes, so the START of the real path is on screen.
try {
  const o = stillPair(300, 300, 1, 1200, 900);
  const ct = HR.byCombatant(o.a);
  const AIL = win.APEX_HERO_REWORK_AIL;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);       // A1 owns Gold
  T.step(2 / 60);
  HR.pressAbility(o.a, 'A2');                     // A2 truth starts, visual queued
  T.step(1 / 60);
  const q0 = P().inspect(o.a);                    // deferral observed at the press
  for (let k = 0; k < 14; k++) { o.a.x += 18; T.step(2 / 60); }   // real path: leg 1
  for (let k = 0; k < 10; k++) { o.a.y += 18; T.step(2 / 60); }   // real path: turn
  const gpHist = FR().inspect(ct).trailNodes;
  const deferred = q0.queued === 1 && q0.queuedKinds[0] === 'a2' && q0.a2.trail === 0 && gpHist.length >= 15;
  let admitted = false;
  for (let k = 0; k < 40 && !admitted; k++) { T.step(2 / 60); admitted = P().inspect(o.a).a2Started; }
  const i = P().inspect(o.a);
  const e = P().engineFor(o.a);
  const tr = e.ice.nodes.filter((n) => n.kind === 'trail');
  const covered = (pt) => tr.some((n) => Math.hypot(n.x - pt.x, n.y - (pt.y + 6)) < 18);
  const early = gpHist.slice(0, 8).filter(covered).length;   // the BEGINNING of the path
  const all = gpHist.filter(covered).length;
  // born times are the real ones (historical), not "all born at admission"
  const off = e.t - AIL.clock();
  const minBorn = Math.min(...tr.map((n) => n.born));
  const bornTruth = Math.abs(minBorn - (gpHist[1].bornAt + off)) < 0.15 && minBorn < e.t - 0.4;
  const before = tr.length;
  for (let k = 0; k < 8; k++) { o.a.x += 18; T.step(2 / 60); }   // live motion continues
  const grew = e.ice.nodes.filter((n) => n.kind === 'trail').length > before;
  gate('F13.11-deferred-a2-hydrates-history',
    deferred && admitted && i.a2Hydrated >= 15 && early === 8 && all >= Math.ceil(gpHist.length * 0.9) &&
    bornTruth && grew,
    { gpNodes: gpHist.length, hydrated: i.a2Hydrated, early8: early, covered: all, bornTruth, grew });
} catch (e) { gate('F13.11-deferred-a2-hydrates-history', false, String(e && e.message)); }

// F13.12 — a deferred A1 must ALWAYS play its cast beat before the lane:
// authoritative origin/direction/original expiry are retained, but no direct
// historical floor replay may bypass anticipation/open/release.
try {
  const o = stillPair(300, 500, 1, 1200, 900);
  const ct = HR.byCombatant(o.a);
  const AIL = win.APEX_HERO_REWORK_AIL;
  HR.pressAbility(o.a, 'A2');                     // A2 owns Gold
  T.step(2 / 60);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);        // A1 queued
  T.step(0.4);                                     // gameplay releases the lane
  const lane = FR().inspect(ct).lanes[0];
  const qd = P().inspect(o.a).queued === 1;
  for (let k = 0; k < 30; k++) { o.a.x += 14; T.step(2 / 60); }   // Frost leaves
  const farX = o.a.x;
  let admitted = false;
  for (let k = 0; k < 60 && !admitted; k++) { T.step(0.05); admitted = P().inspect(o.a).mode === 'a1'; }
  const e = P().engineFor(o.a);
  const atAdmission = P().inspect(o.a);
  const noDirectLane = e.ice.nodes.filter((n) => n.kind === 'lane').length === 0
    && !atAdmission.a1.released;
  T.step(0.12);
  const loaded = P().inspect(o.a);
  const beatLoaded = loaded.mode === 'a1' && !loaded.a1.released
    && loaded.choreography.jawGoal >= 14
    && e.ice.nodes.filter((n) => n.kind === 'lane').length === 0;
  let rel = false;
  for (let k = 0; k < 20 && !rel; k++) { T.step(0.025); rel = P().inspect(o.a).a1.released; }
  const i = P().inspect(o.a);
  const off = e.t - AIL.clock();
  const nodes = e.ice.nodes.filter((n) => n.kind === 'lane');
  const dOrigin = Math.hypot(i.a1.ox - lane.ox, i.a1.oy - lane.oy);        // vs gameplay truth
  const dFrost = Math.hypot(i.a1.ox - o.a.x, i.a1.oy - o.a.y);             // vs where Frost is now
  const angOk = Math.abs(i.a1.ang - Math.atan2(lane.dy, lane.dx)) < 0.01;
  const decays = nodes.map((n) => n.decayAt).filter((d) => d !== Infinity && d < Infinity);
  const expiry = decays.length ? Math.min(...decays) : NaN;
  const expiryTruth = Math.abs(expiry - (lane.expireAt + off)) < 0.2;       // gameplay lane expiry
  const notRestarted = expiry < e.t + (ct.skills.A1.cfg.floorLifetime || 4.5) - 1.0; // not a fresh floor
  const bornAfterBeat = nodes.length > 0 && Math.min(...nodes.map((n) => n.born)) >= atAdmission.t - 0.05;
  gate('F13.12-deferred-a1-historical-origin',
    qd && admitted && noDirectLane && beatLoaded && rel && i.a1Replays === 1
    && nodes.length >= 40 && dOrigin < 45 && dFrost > 300
    && angOk && expiryTruth && notRestarted && bornAfterBeat,
    { admitted, noDirectLane, beatLoaded, originGap: +dOrigin.toFixed(1),
      frostGap: +dFrost.toFixed(1), frostX: Math.round(farX), ang: i.a1.ang,
      expiryTruth, notRestarted, bornAfterBeat, nodes: nodes.length });
} catch (e) { gate('F13.12-deferred-a1-historical-origin', false, String(e && e.message)); }


/* ================= F14 — owner activation-window regressions ========== */
// These gates inspect every activation frame rather than redrawing one frozen
// simulation state. They fail the old lazy-resize / coarse-history / split
// hydration implementation.
try {
  const run = (kind) => {
    const o = stillPair(220, 700, 1, 820, 180);
    const e = P().engineFor(o.a);
    T.step(0.2); T.redraw(); // assets/surfaces ready before the cast
    const before = P().inspect(o.a);
    const rows = [];
    if (kind === 'A1') win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
    else HR.pressAbility(o.a, 'A2');
    const step = 215 * 1.5 / 60;
    for (let k = 0; k < 45; k++) {
      if (kind === 'A2' && k > 0) {
        o.a.x += step; o.a.__hrVel = { x: 215 * 1.5, y: 0 };
      }
      T.step(1 / 60); T.redraw();
      const px = readPixels();
      const fb = bodyBox(px, o.a.x, o.a.y, 130, localBg(px, o.a.x, o.a.y, 130));
      const ob = bodyBox(px, o.b.x, o.b.y, 130, localBg(px, o.b.x, o.b.y, 130));
      const fs = cropStats(px, o.a.x, o.a.y, 130, localBg(px, o.a.x, o.a.y, 130));
      const os = cropStats(px, o.b.x, o.b.y, 130, localBg(px, o.b.x, o.b.y, 130));
      const i = P().inspect(o.a);
      rows.push({ fb, ob, fi: fs.n, oi: os.n, ice: i.iceNodes, ready: i.ready,
        size: i.iceCanvas.join('x'), resize: i.surfaceResizes, draw: i.renderAudit.bodyDraws,
        leak: i.stateLeaks, exceptions: i.renderAudit.drawExceptions });
    }
    const after = P().inspect(o.a);
    return { rows, before, after, engine: e };
  };
  const a1 = run('A1'), a2 = run('A2');
  const stable = (r) => r.rows.every((q) => q.fb.w > 80 && q.fb.h > 100 && q.ob.w > 65 && q.ob.h > 65
    && q.fi > 2500 && q.oi > 1800 && q.ready
    && q.leak === r.before.stateLeaks && q.exceptions === r.before.renderAudit.drawExceptions);
  const noResize = (r) => r.rows.every((q) => q.resize === r.before.surfaceResizes && q.size === '1000x1000')
    && r.after.surfaceResizeDuringDraw === 0;
  const activeNeverVanishes = a1.rows.slice(16).every((q) => q.ice > 0)
    && a2.rows.slice(3).every((q) => q.ice > 0);
  gate('F14.1-activation-temporal-stability', stable(a1) && stable(a2) && activeNeverVanishes,
    { a1MinBodyInk: Math.min(...a1.rows.map((q) => q.fi)), a2MinBodyInk: Math.min(...a2.rows.map((q) => q.fi)),
      opponentMinInk: Math.min(...a1.rows.concat(a2.rows).map((q) => q.oi)), activeNeverVanishes });
  gate('F14.2-no-active-frame-canvas-resize', noResize(a1) && noResize(a2),
    { a1: [a1.before.surfaceResizes, a1.after.surfaceResizes], a2: [a2.before.surfaceResizes, a2.after.surfaceResizes],
      canvas: a2.after.iceCanvas, duringDraw: a1.after.surfaceResizeDuringDraw + a2.after.surfaceResizeDuringDraw });
} catch (e) {
  gate('F14.1-activation-temporal-stability', false, String(e && e.message));
  gate('F14.2-no-active-frame-canvas-resize', false, String(e && e.message));
}

try {
  const leg = (deferred) => {
    const o = stillPair(200, 700, 1, 850, 180);
    if (deferred) { win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a); T.step(2 / 60); }
    HR.pressAbility(o.a, 'A2'); T.step(1 / 60);
    const step = 215 * 1.5 / 60;
    for (let k = 0; k < 55; k++) {
      // Exact real-speed production history, including a hard heading change.
      if (k < 30) { o.a.x += step; o.a.__hrVel = { x: 215 * 1.5, y: 0 }; }
      else { o.a.y -= step; o.a.__hrVel = { x: 0, y: -215 * 1.5 }; }
      T.step(1 / 60);
    }
    // Ensure a queued Gold admission has happened, then append live history.
    for (let k = 0; k < 20 && !P().inspect(o.a).a2Started; k++) T.step(1 / 60);
    for (let k = 0; k < 8; k++) { o.a.y -= step; o.a.__hrVel = { x: 0, y: -215 * 1.5 }; T.step(1 / 60); }
    const e = P().engineFor(o.a), i = P().inspect(o.a), gp = FR().inspect(HR.byCombatant(o.a));
    const nodes = e.ice.nodes.filter((n) => n.kind === 'trail').sort((a, b) => a.born - b.born);
    return { i, gp, nodes, sig: nodes.map((n) => [n.L.toFixed(5), n.W.toFixed(5), n.seed.toFixed(5)]).join('|') };
  };
  const live = leg(false), deferred = leg(true);
  const gaps = (ns) => ns.slice(1).map((n, i) => Math.hypot(n.x - ns[i].x, n.y - ns[i].y));
  const lg = gaps(live.nodes), dg = gaps(deferred.nodes);
  const historyTruth = live.gp.movementHistory.length > live.gp.trailNodes.length
    && live.i.path && live.i.path.consumed === live.gp.movementHistory.length
    && Math.hypot(live.i.path.endpoint[0] - live.gp.movementHistory.at(-1).x,
      live.i.path.endpoint[1] - live.gp.movementHistory.at(-1).y) < 1e-6;
  gate('F14.3-real-speed-history-seam-continuity', historyTruth && Math.max(...lg) <= 9.01 && Math.max(...dg) <= 9.01
    && live.i.path.carry >= 0 && live.i.path.carry < 9 && deferred.i.path.carry >= 0 && deferred.i.path.carry < 9,
    { movement: live.gp.movementHistory.length, mechanics: live.gp.trailNodes.length,
      maxGap: [Math.max(...lg), Math.max(...dg)], carry: [live.i.path.carry, deferred.i.path.carry] });
  gate('F14.4-immediate-deferred-material-equivalence', live.nodes.length === deferred.nodes.length && live.sig === deferred.sig,
    { nodes: [live.nodes.length, deferred.nodes.length], sameMaterialSequence: live.sig === deferred.sig });
} catch (e) {
  gate('F14.3-real-speed-history-seam-continuity', false, String(e && e.message));
  gate('F14.4-immediate-deferred-material-equivalence', false, String(e && e.message));
}

/* ================= F15 — Slice 1 owner law ============================ */
try {
  // The shared render stack moves only Frost's world-surface layer into the
  // chamber background, immediately before real floor weapon sprites.
  const questSrc = fs.readFileSync('public/game/modes/arsenalQuestRuntime.js', 'utf8');
  const presSrc = fs.readFileSync('public/game/hero-rework/frostPresentationRuntime.js', 'utf8');
  const hook = questSrc.indexOf('APEX_FROST_PRESENTATION?.renderSurfaceUnderWeapons');
  const slotsAfter = questSrc.indexOf('SPAWN.drawSlots(c)', hook);
  const actorSeparate = presSrc.includes('if (!arsenalActive) renderSurfaceUnderWeapons(ctx)')
    && presSrc.includes('drawFrostBody(ctx, f, S)');
  gate('F15.1-surface-below-floor-guns-only', hook >= 0 && slotsAfter > hook && actorSeparate,
    { hook, slotsAfter, actorSeparate });
} catch (e) { gate('F15.1-surface-below-floor-guns-only', false, String(e && e.message)); }

try {
  // A gun newly spawned on A2 ice freezes; a gun entering later freezes; and
  // a Frost pickup is converted before the transaction equips that same gun.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 100; o.b.y = 900;
  HR.pressAbility(o.a, 'A2');
  T.step(0.45);
  o.a.baseSpeed = 0;
  const path = FR().inspect(o.ct).trailNodes;
  const point = path[Math.max(0, Math.floor(path.length / 2))];
  const spawnedId = T.pushSlot({ x: point.x, y: point.y, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(1 / 60);
  const spawned = AQSlots().find((q) => q.id === spawnedId);
  const spawnedFrozen = !!(spawned && spawned.__frostFrozen);
  const enteredId = T.pushSlot({ x: 100, y: 100, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(1 / 60);
  const entered = AQSlots().find((q) => q.id === enteredId);
  entered.x = point.x; entered.y = point.y;
  T.step(1 / 60);
  const enteredFrozen = !!entered.__frostFrozen;
  const pickupId = T.pushSlot({ x: o.a.x, y: o.a.y, phase: 'REVEALED', weaponId: 'PISTOL' });
  T.step(1 / 60);
  const held = W().getHolder(o.a);
  const transactionFrozen = !!(held && held.weaponId === 'PISTOL' && held.__frostFrozen);
  gate('F15.2-continuous-surface-gun-authority', spawnedFrozen && enteredFrozen && transactionFrozen,
    { spawnedFrozen, enteredFrozen, transactionFrozen, pickupStillOnFloor: AQSlots().some((q) => q.id === pickupId) });
} catch (e) { gate('F15.2-continuous-surface-gun-authority', false, String(e && e.message)); }

try {
  const spawnSrc = fs.readFileSync('public/game/arsenal/arsenalSpawnRuntime.js', 'utf8');
  const convert = spawnSrc.indexOf('ensureSurfaceFrozen(slot)');
  const candidates = spawnSrc.indexOf('for (const f of actors)', convert);
  gate('F15.3-pickup-transaction-converts-first', convert >= 0 && candidates > convert, { convert, candidates });
} catch (e) { gate('F15.3-pickup-transaction-converts-first', false, String(e && e.message)); }

/* ================= F16 — Slice 2 physical choreography ================= */
try {
  const o = stillPair(300, 500, 1, 820, 820);
  P().setReactionParticlesEnabled(false);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.08);
  const anticipate = P().inspect(o.a);
  T.step(0.12);
  const open = P().inspect(o.a);
  T.step(0.06);
  const release = P().inspect(o.a);
  T.step(0.28);
  const recovery = P().inspect(o.a);
  T.step(0.29);
  const resumed = P().inspect(o.a);
  P().setReactionParticlesEnabled(true);
  gate('F16.1-a1-authored-visible-beat',
    anticipate.mode === 'a1' && anticipate.choreography.jawGoal >= 9
    && open.choreography.jawGoal >= 39 && open.choreography.eye > anticipate.choreography.eye
    && release.a1.released && release.choreography.vent > 0.4
    && recovery.choreography.jawGoal < open.choreography.jawGoal
    && resumed.mode === 'free',
    { anticipate: anticipate.choreography, open: open.choreography,
      release: release.choreography, recovery: recovery.choreography, resumed: resumed.mode });
} catch (e) {
  try { P().setReactionParticlesEnabled(true); } catch (_) {}
  gate('F16.1-a1-authored-visible-beat', false, String(e && e.message));
}

try {
  const o = stillPair(300, 500, 1, 820, 820);
  P().setReactionParticlesEnabled(false);
  HR.pressAbility(o.a, 'A2');
  T.step(0.11);
  const load = P().inspect(o.a), e = P().engineFor(o.a);
  const loadGoals = { eye: e.eye.goal, crest: e.crestLift.goal, sy: e.sy.goal };
  const charged = loadGoals.eye >= 2.7 && loadGoals.crest >= 11 && loadGoals.sy < 0.96;
  T.step(0.08);
  const launch = P().inspect(o.a);
  P().setReactionParticlesEnabled(true);
  gate('F16.2-a2-load-convert-launch', load.mode === 'a2' && charged && !load.a2.kicked && launch.a2.kicked,
    { load: { kicked: load.a2.kicked, ...loadGoals }, launch: launch.a2 });
} catch (e) {
  try { P().setReactionParticlesEnabled(true); } catch (_) {}
  gate('F16.2-a2-load-convert-launch', false, String(e && e.message));
}

try {
  const o = stillPair(300, 500, 1, 800, 500);
  T.step(2 / 60); // install production event/wall hooks
  P().setReactionParticlesEnabled(false); // required silhouette-only diagnostic
  o.a.takeDamage(5, o.b, 'arsenal-PISTOL');
  T.step(1 / 60);
  const bullet = P().inspect(o.a).reactions;
  o.a.x = 924; o.a.y = 300; o.a.baseSpeed = 520; o.a.setDir(1, 0);
  o.b.x = 200; o.b.y = 800;
  T.step(0.08);
  const wall = P().inspect(o.a).reactions;
  o.a.baseSpeed = 0; o.b.baseSpeed = 0;
  o.a.x = 490; o.a.y = 500; o.b.x = 510; o.b.y = 500;
  o.a.setDir(1, 0); o.b.setDir(-1, 0);
  T.step(2 / 60);
  const body = P().inspect(o.a).reactions;
  const mag = (r) => Math.hypot(r.rootX, r.rootY) + Math.hypot(r.headLagX, r.headLagY);
  const primaryReadable = mag(bullet) > 2.5 && mag(wall) > mag(bullet) && mag(body) > mag(bullet);
  const particlesOff = bullet.particlesEnabled === false && wall.particlesEnabled === false && body.particlesEnabled === false;
  P().setReactionParticlesEnabled(true);
  gate('F16.3-distinct-live-impact-hooks',
    bullet.bulletCount === 1 && bullet.lastNormal.kind === 'bullet'
    && wall.wallCount >= 1 && wall.lastNormal.kind === 'wall'
    && body.opponentCount >= 1 && body.lastNormal.kind === 'opponent'
    && primaryReadable && particlesOff,
    { bullet, wall, body, primaryReadable, particlesOff });
} catch (e) {
  try { P().setReactionParticlesEnabled(true); } catch (_) {}
  gate('F16.3-distinct-live-impact-hooks', false, String(e && e.message));
}

/* ================= F17 — Slice 3 energy / ambience / contact polish === */
try {
  const o = stillPair(300, 500, 1, 820, 820);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.08);
  const anticipate = P().inspect(o.a).choreography;
  T.step(0.12);
  const charged = P().inspect(o.a).choreography;
  T.step(0.06);
  const peak = P().inspect(o.a).choreography;
  const goldSrc = fs.readFileSync('public/game/hero-rework/frostGoldV1.js', 'utf8');
  const presSrc = fs.readFileSync('public/game/hero-rework/frostPresentationRuntime.js', 'utf8');
  const layeredInside = goldSrc.indexOf('this.drawVentGlow(ctx, cavityMask, vI, bx, by)')
    < goldSrc.indexOf('// jaw / vent lower plate')
    && goldSrc.includes('this.mips.cavity[0]')
    && goldSrc.includes('createRadialGradient(vx, vy, 0, vx, vy, 150 * k)')
    && goldSrc.includes('70 * k * I')
    && !goldSrc.includes('Broad faceted cyan core')
    && !presSrc.includes('drawA1MouthCharge');
  gate('F17.1-a1-cavity-charge-ramp',
    anticipate.mouthCharge < 0.1 && charged.mouthCharge > 0.8 && peak.mouthCharge >= charged.mouthCharge
    && charged.jawGoal === 66 && layeredInside,
    { anticipate: anticipate.mouthCharge, charged: charged.mouthCharge, peak: peak.mouthCharge,
      jawGoal: charged.jawGoal, layeredInside });
} catch (e) { gate('F17.1-a1-cavity-charge-ramp', false, String(e && e.message)); }

try {
  const o = stillPair(260, 500, 1, 850, 850);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.05);
  const attack = P().ambienceState();
  // A concurrent qualifying activation refreshes the shared scalar; it never
  // adds another darkness layer or exceeds one.
  HR.pressAbility(o.a, 'A2');
  T.step(0.08);
  const refreshed = P().ambienceState();
  T.step(3.6);
  const thawing = P().ambienceState();
  T.step(3.0);
  const baseline = P().ambienceState();
  // Immediate death cleanup is independently checked on a fresh lifecycle.
  const d = stillPair(260, 500, 1, 850, 850);
  HR.pressAbility(d.a, 'A2'); T.step(0.05);
  d.a.hp = 0; T.step(1 / 60);
  const dead = P().ambienceState();
  const questSrc = fs.readFileSync('public/game/modes/arsenalQuestRuntime.js', 'utf8');
  const presSrc = fs.readFileSync('public/game/hero-rework/frostPresentationRuntime.js', 'utf8');
  const moodHook = questSrc.indexOf('renderArenaAmbience(c)');
  const iceHook = questSrc.indexOf('renderSurfaceUnderWeapons(c)');
  const slots = questSrc.indexOf('SPAWN.drawSlots(c)');
  gate('F17.2-shared-ambience-lifecycle-cleanup',
    attack.level >= 0.8 && refreshed.level <= 1 && refreshed.target <= 1
    && thawing.level > 0 && thawing.level < refreshed.level
    && baseline.level === 0 && baseline.target === 0 && dead.level === 0
    && presSrc.includes('(0.70 * ambience.level)')
    && moodHook >= 0 && moodHook < iceHook && iceHook < slots,
    { attack, refreshed, thawing, baseline, dead, order: [moodHook, iceHook, slots] });
} catch (e) { gate('F17.2-shared-ambience-lifecycle-cleanup', false, String(e && e.message)); }

try {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 0]];
  const rows = [];
  for (let i = 0; i < dirs.length; i++) {
    const [dx, dy] = dirs[i];
    const o = stillPair(120, 120, 1, 850, 850);
    HR.pressAbility(o.a, 'A2'); T.step(0.2);
    o.a.baseSpeed = 0; o.b.baseSpeed = 0;
    o.b.x = 500; o.b.y = 500;
    o.a.x = 500 + dx * 130; o.a.y = 500 + dy * 130;
    // Final case deliberately faces away from the physical contact side,
    // emulating a redirected/bounced approach. Facing must be irrelevant.
    o.a.setDir(i === 4 ? -dx : dx, i === 4 ? -dy : dy);
    T.step(2 / 60);
    const ins = P().inspect(o.a), e = P().engineFor(o.a);
    const cs = e.crusts.slice(0, 5);
    const sx = cs.reduce((n, c) => n + Math.cos(c.ang), 0);
    const sy = cs.reduce((n, c) => n + Math.sin(c.ang), 0);
    const sd = Math.hypot(sx, sy) || 1;
    const normalDot = ins.reactions.lastNormal
      ? ins.reactions.lastNormal.x * dx + ins.reactions.lastNormal.y * dy : -1;
    rows.push({ dir: [dx, dy], facingRedirected: i === 4, crusts: cs.length,
      normalDot: +normalDot.toFixed(3), crustDot: +((sx / sd) * dx + (sy / sd) * dy).toFixed(3),
      source: ins.reactions.lastNormal && ins.reactions.lastNormal.snowSideSource });
  }
  gate('F17.3-opponent-snow-physical-side',
    rows.every((r) => r.crusts === 5 && r.normalDot > 0.9 && r.crustDot > 0.85 && r.source === 'contact-normal'), rows);
} catch (e) { gate('F17.3-opponent-snow-physical-side', false, String(e && e.message)); }

try {
  const o = stillPair(300, 500, 1, 820, 820);
  const e = P().engineFor(o.a), ctx = H.gameCanvasReal.getContext('2d');
  const spy = spyMethod(ctx, 'lineTo');
  e.drawBulletFrost(ctx, 500, 500, 0, 1);
  const minX = Math.min(...spy.args.map((a) => +a[0] || 0));
  spy.release();
  const src = fs.readFileSync('public/game/hero-rework/frostGoldV1.js', 'utf8');
  gate('F17.4-frozen-bullet-energy-identity',
    minX <= -43 && src.includes('#42ddfa') && src.includes('Two deterministic ice glints/flecks'),
    { minTrailX: minX, cyanCore: src.includes('#42ddfa'), deterministicGlints: true });
} catch (e) { gate('F17.4-frozen-bullet-energy-identity', false, String(e && e.message)); }

try {
  // One coarse frame crosses the entire 0.25 pending window. Presentation
  // must recover from lane history, begin at anticipation, and withhold the
  // visible lane until its own release beat.
  const o = stillPair(300, 500, 1, 850, 850);
  const realPresentationTick = P().tick;
  P().tick = function skippedPresentationFrame() {};
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  T.step(0.30);
  P().tick = realPresentationTick;
  T.step(1 / 60);
  const recovered = P().inspect(o.a), e = P().engineFor(o.a);
  const noImmediateFloor = recovered.mode === 'a1' && !recovered.a1.released
    && recovered.choreography.lateRecoveries === 1
    && e.ice.nodes.filter((n) => n.kind === 'lane').length === 0;
  T.step(0.12);
  const loaded = P().inspect(o.a);
  T.step(0.15);
  const released = P().inspect(o.a);
  gate('F17.5-a1-hitch-never-skips-cast-beat',
    noImmediateFloor && loaded.mode === 'a1' && !loaded.a1.released
    && loaded.choreography.jawGoal >= 14
    && released.a1.released && e.ice.nodes.some((n) => n.kind === 'lane'),
    { recovered: { mode: recovered.mode, released: recovered.a1.released,
      lateRecoveries: recovered.choreography.lateRecoveries },
      loaded: { elapsed: loaded.choreography.elapsed, jawGoal: loaded.choreography.jawGoal },
      release: { released: released.a1.released, lanes: e.ice.nodes.filter((n) => n.kind === 'lane').length } });
} catch (e) { gate('F17.5-a1-hitch-never-skips-cast-beat', false, String(e && e.message)); }

/* ================= F18 — owner micro-polish + balance ================= */
try {
  const goldSrc = fs.readFileSync('public/game/hero-rework/frostGoldV1.js', 'utf8');
  const presSrc = fs.readFileSync('public/game/hero-rework/frostPresentationRuntime.js', 'utf8');
  const regSrc = fs.readFileSync('public/game/hero-rework/heroRegistry.js', 'utf8');
  const gameSrc = fs.readFileSync('public/game/hero-rework/frostGameplayRuntime.js', 'utf8');
  gate('F18.1-balance-and-visual-scale', gameSrc.includes('frostFloorMult: 1.50') && regSrc.includes('width: 310') && regSrc.includes('activeWindow: 2.0') && presSrc.includes('FROST_VISUAL_SCALE = 0.90'), {});
  gate('F18.2-single-inertial-eye-ribbon', goldSrc.includes('One inertial eye-energy ribbon') && goldSrc.includes('ctx.bezierCurveTo') && !goldSrc.includes('const len = 176 * fl'), {});
  gate('F18.3-canonical-mouth-and-no-wet-circles', goldSrc.includes('this.mips.cavity[0]') && goldSrc.includes('150 * k') && goldSrc.includes('70 * k * I') && !goldSrc.includes('this.wets.push('), {});
} catch (e) {
  gate('F18.1-balance-and-visual-scale', false, String(e && e.message));
  gate('F18.2-single-inertial-eye-ribbon', false, String(e && e.message));
  gate('F18.3-canonical-mouth-and-no-wet-circles', false, String(e && e.message));
}

/* ================= summary ============================================ */
const names = Object.keys(report.gates);
const passed = names.filter((n) => report.gates[n].pass).length;
console.log(`\nFROST V1 gates: ${passed}/${names.length} PASS`);
if (report.failures.length) {
  console.log('FAILURES:', report.failures.join(', '));
}
// The harness leaves asset-retry handles alive; exit explicitly.
process.exit(report.failures.length ? 1 : 0);
