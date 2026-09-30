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
    !!m && m[1].indexOf('20260930-crystala-v2-r11-frost-') === 0 && lock.revision === m[1],
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
  // Release origin: 200 + 520*0.25 = 330 (live pos at release).
  gate('F03.3-opposite-lanes', oppEast && oppWest, { leOx: le.ox, lwOx: lw.ox });
  gate('F03.5-origin-follows-release', Math.abs(le.ox - 330) < 20 && Math.abs(le.oy - 500) < 5, { ox: le.ox });
} catch (e) { gate('F03.3-opposite-lanes', false, String(e && e.message)); }

try {
  // No lock/brake/steer during the ~0.25s commitment.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  const speeds = [];
  for (let i = 0; i < 15; i++) { T.step(1 / 60); speeds.push(o.a.baseSpeed); }
  const moved = o.a.x - 200;
  const hpB = o.b.hp;
  gate('F03.4-no-commit-lock',
    speeds.every((s) => s === 520) && moved > 110 && moved < 150
    && o.a.dir.x > 0.99 && !o.a.data.positionLocked,
    { moved: +moved.toFixed(1) });
  gate('F03.6-zero-direct-damage', hpB === 1000, { hp: hpB });
  gate('F03.7-cooldown-10-5', Math.abs(o.ctl.cooldownLeft('A1') - (10.5 - 0.25)) < 0.15,
    { cd: +o.ctl.cooldownLeft('A1').toFixed(2) });
} catch (e) { gate('F03.4-no-commit-lock', false, String(e && e.message)); }

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
  const p79 = supportedAt(lane.ox + 325, lane.oy + 79);
  const p81 = supportedAt(lane.ox + 325, lane.oy + 81);
  const behind = supportedAt(lane.ox - 5, lane.oy);
  gate('F04.1-footprint-650x160', s325 && s649 && !s651 && p79 && !p81 && !behind,
    { s325, s649, s651, p79, p81, behind });
} catch (e) { gate('F04.1-footprint-650x160', false, String(e && e.message)); }

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
  // Frost x2.35 on stable floor.
  o.a.x = lane.ox + 50; o.a.y = lane.oy; o.a.setDir(1, 0);
  o.b.x = 100; o.b.y = 900;
  const x0 = o.a.x;
  T.step(0.3);
  const ratioF = (o.a.x - x0) / (520 * 0.3);
  const speedMult = o.a.hasStatus('speed') ? o.a.statuses.speed.mult : null;
  // Enemy x0.60.
  o.b.x = lane.ox + 50; o.b.y = lane.oy; o.b.setDir(1, 0);
  o.a.x = 100; o.a.y = 100;
  const bx0 = o.b.x;
  T.step(0.3);
  const ratioE = (o.b.x - bx0) / (520 * 0.3);
  const slowMult = o.b.hasStatus('slow') ? o.b.statuses.slow.mult : null;
  gate('F04.4-frost-x2.35', Math.abs(ratioF - 2.35) < 0.12 && speedMult === 2.35, { ratio: +ratioF.toFixed(3), speedMult });
  gate('F04.5-enemy-x0.60', Math.abs(ratioE - 0.60) < 0.06 && slowMult === 0.60, { ratio: +ratioE.toFixed(3), slowMult });
} catch (e) { gate('F04.4-frost-x2.35', false, String(e && e.message)); }

try {
  const { o, lane } = buildLane();
  o.b.x = lane.ox + 300; o.b.y = lane.oy; o.b.setDir(1, 0);
  o.a.x = 100; o.a.y = 100;
  T.step(0.2); // enemy on floor
  o.b.x = lane.ox + 300; o.b.y = lane.oy + 400; // leave floor (north)
  T.step(0.2); // linger (0.35) still active
  const lingerOn = o.b.hasStatus('slow') && o.b.statuses.slow.mult === 0.60;
  T.step(0.4); // linger + refresh decay gone
  const lingerOff = !o.b.hasStatus('slow');
  gate('F04.6-linger-0.35', lingerOn && lingerOff, { lingerOn, lingerOff });
} catch (e) { gate('F04.6-linger-0.35', false, String(e && e.message)); }

try {
  // Overlap: A1 lane + A2 trail under the same bodies, still single effect.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 800; o.b.y = 800;
  win.APEX_ARSENAL_SKILL_GATE.pressJ(o.a);
  HR.pressAbility(o.a, 'A2');
  T.step(1.2); // lane built, trail laid along it
  const lane = FR().inspect(o.ct).lanes[0];
  o.b.x = lane.ox + 200; o.b.y = lane.oy; o.b.setDir(1, 0);
  o.a.x = lane.ox + 100; o.a.y = lane.oy; o.a.setDir(1, 0);
  T.step(2 / 60);
  const slowE = o.b.hasStatus('slow') ? o.b.statuses.slow.mult : null;
  const speedF = o.a.hasStatus('speed') ? o.a.statuses.speed.mult : null;
  gate('F04.7-overlap-no-multiply', slowE === 0.60 && speedF === 2.35, { slowE, speedF });
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
  // A2 trail alone never freezes a floor firearm.
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
  gate('F05.8-trail-never-freezes', r.ok === true && trailLive && !!s && !s.__frostFrozen,
    { trail: trailLive, frozen: !!(s && s.__frostFrozen) });
} catch (e) { gate('F05.8-trail-never-freezes', false, String(e && e.message)); }

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
  for (let i = 0; i < 30; i++) T.step(0.1); // 3.0s
  const live3 = FR().inspect(o.ct).a2live;
  gate('F09.1-cooldown-12-5', r.ok === true && cd > 12 && cd <= 12.5, { cd: +cd.toFixed(2) });
  gate('F09.2-window-3-0', live0 === true && live3 === false, { live0, live3 });
} catch (e) { gate('F09.1-cooldown-12-5', false, String(e && e.message)); }

try {
  // No homing: dir never steered toward the enemy; static + behavioral.
  const frostSrc = fs.readFileSync('public/game/hero-rework/frostGameplayRuntime.js', 'utf8');
  const mechSrc = fs.readFileSync('public/game/hero-rework/heroMechanicsRuntime.js', 'utf8');
  const frostBlock = mechSrc.slice(mechSrc.indexOf('frost.breath'), mechSrc.indexOf('frostTruth'));
  const staticOk = !/\.dir\s*=/.test(frostSrc) && !/setDir/.test(frostSrc) && !/\.dir\s*=|setDir/.test(frostBlock);
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
  T.step(7.0); // window (3.0) + segment lifetime (3.5) + margin
  const gone = FR().inspect(o.ct).trail === 0;
  gate('F09.4-native-bounce', bounced, { dirx: +o.a.dir.x.toFixed(2) });
  gate('F09.5-trail-samples-path', nodes.length >= 6 && span > 200, { n: nodes.length, span: +span.toFixed(0) });
  gate('F09.6-bounce-turns-trail', turned, {});
  gate('F09.10-no-fixed-path', turned && nodes.length >= 6, {});
  gate('F09.8-segments-expire-3-5', gone, {});
} catch (e) { gate('F09.4-native-bounce', false, String(e && e.message)); }

try {
  // Width 120: slowed at |perp| 59, clean at 61. Frost x2.35 on trail.
  const o = withCtl(frostPair());
  o.a.x = 200; o.a.y = 500; o.a.setDir(1, 0);
  o.b.x = 850; o.b.y = 100; o.b.setDir(-1, 0);
  HR.pressAbility(o.a, 'A2');
  T.step(0.6); // trail spans ~200..510 at y=500
  o.b.x = 350; o.b.y = 559; o.b.setDir(1, 0);
  o.a.x = 700; o.a.y = 500;
  T.step(2 / 60);
  const slow59 = o.b.hasStatus('slow');
  o.b.x = 350; o.b.y = 561;
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
  gate('F09.9-frost-x2.35-trail', Math.abs(ratio - 2.35) < 0.12, { ratio: +ratio.toFixed(3) });
} catch (e) { gate('F09.7-width-120', false, String(e && e.message)); }

/* ================= summary ============================================ */
const names = Object.keys(report.gates);
const passed = names.filter((n) => report.gates[n].pass).length;
console.log(`\nFROST V1 gates: ${passed}/${names.length} PASS`);
if (report.failures.length) {
  console.log('FAILURES:', report.failures.join(', '));
}
// The harness leaves asset-retry handles alive; exit explicitly.
process.exit(report.failures.length ? 1 : 0);
