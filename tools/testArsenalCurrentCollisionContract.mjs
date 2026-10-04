// Focused Phase 2A.2 contract for the current Arsenal anchor-collision seam.
// Boots only MENU_INTERACTIVE + ARSENAL_PRODUCT + SELECT runtimes; generic
// legacy Battle and hero-specific legacy suites are deliberately excluded.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ARSENAL_PRODUCT_RUNTIMES,
  BATTLE_RUNTIMES,
} from '../src/game/runtimeManifest.js';
import { bootHarness } from './lib/crystalaHarness.mjs';

const runtimePaths = entries => entries.map(([src]) => String(src).split(/[?#]/, 1)[0]);
const report = { failures: [] };
function gate(name, fn) {
  try {
    const detail = fn();
    console.log(`PASS  ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  } catch (error) {
    report.failures.push(name);
    console.error(`FAIL  ${name} — ${error?.stack || error}`);
  }
}

const H = await bootHarness({ productAuthentic: true });
const { win, T, HR } = H;
const bus = () => win.APEX_HERO_REWORK_AIL.bus;
const BASE_RADIUS = 75;

function freezeAnchors() {
  for (const fighter of win.fighters) {
    fighter.baseSpeed = 0;
    fighter.data.__hrHoldBody = true;
  }
}
function startMatch(p1, p2) {
  const match = T.start(p1, p2);
  assert.ok(match, `could not start ${p1} vs ${p2}`);
  T.holdSpawns();
  HR.setAiEnabled(false);
  freezeAnchors();
  return win.fighters;
}
function positionPair(a, b, ax, ay, bx, by, aDirX = 1, aDirY = 0, bDirX = -1, bDirY = 0) {
  a.x = ax; a.y = ay; a.setDir(aDirX, aDirY);
  b.x = bx; b.y = by; b.setDir(bDirX, bDirY);
}
function bodyCollisionsSince(mark) {
  return bus().since(mark).filter(event => event.type === 'BodyCollision');
}
function distance(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function distanceToSegment(x, y, cap) {
  const dx = cap.bx - cap.ax, dy = cap.by - cap.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0
    ? Math.max(0, Math.min(1, ((x - cap.ax) * dx + (y - cap.ay) * dy) / len2))
    : 0;
  return Math.hypot(x - (cap.ax + dx * t), y - (cap.ay + dy * t));
}

try {
  gate('product-authentic-graph-installs-current-seam-before-Hero-Rework', () => {
    const active = runtimePaths(ARSENAL_PRODUCT_RUNTIMES);
    const battle = runtimePaths(BATTLE_RUNTIMES);
    const loaded = new Set(H.loadedRuntimeSrcs);
    const seam = '/game/core/apexArsenalAnchorCollisionRuntime.js';
    const fullRoster = '/game/core/apexFullRosterQa.js';
    assert.equal(H.productAuthentic, true);
    assert.ok(loaded.has(seam));
    assert.ok(!loaded.has(fullRoster), 'product-authentic load must not request FullRoster');
    assert.ok(active.includes(seam));
    assert.ok(!active.includes(fullRoster));
    assert.ok(active.indexOf(seam) < active.indexOf('/game/hero-rework/heroReworkRuntime.js'));
    assert.ok(battle.includes(fullRoster), 'generic Battle keeps its legacy FullRoster chain');
    assert.equal(win.apexArsenalAnchorCollisionRuntime, 'ready');
    return { currentRuntimes: active.length, genericBattleKeepsFullRoster: true };
  });

  gate('anchor-overlap-separates-reflects-and-observes-once', () => {
    const [a, b] = startMatch('ROBOT', 'HUNTER');
    positionPair(a, b, 400, 500, 520, 500);
    const sum = a.radius + b.radius;
    const initialGap = distance(a, b);
    const overlap = sum - initialGap;
    const startAX = a.x, startBX = b.x;
    const mark = bus().seq;

    win.handleCollisions(1 / 60);

    assert.ok(distance(a, b) >= sum - 1e-8, 'overlapping anchors must be physically separated');
    assert.ok(Math.abs(a.x - (startAX - overlap / 2)) < 1e-8);
    assert.ok(Math.abs(b.x - (startBX + overlap / 2)) < 1e-8);
    assert.ok(a.dir.x < -0.999 && Math.abs(a.dir.y) < 1e-8, 'P1 reflects away from P2');
    assert.ok(b.dir.x > 0.999 && Math.abs(b.dir.y) < 1e-8, 'P2 reflects away from P1');
    assert.equal(bodyCollisionsSince(mark).length, 2, 'Hero Rework observes the new anchor contact for both sides');

    const separated = [a.x, a.y, b.x, b.y];
    win.handleCollisions(1 / 60);
    assert.deepEqual([a.x, a.y, b.x, b.y], separated, 'a second collision pass must not separate anchors again');
    assert.equal(bodyCollisionsSince(mark).length, 2, 'sustained contact does not double-fire Hero Rework observation');
    return { initialGap, finalGap: distance(a, b), radiusSum: sum, bodyCollisionEvents: 2 };
  });

  gate('separation-clamps-at-arena-edge', () => {
    const [a, b] = startMatch('ROBOT', 'ROBOT');
    positionPair(a, b, 80, 500, 110, 500);
    win.handleCollisions(1 / 60);
    assert.ok(a.x >= a.radius && a.y >= a.radius && a.y <= 1000 - a.radius);
    assert.ok(b.x >= b.radius && b.x <= 1000 - b.radius);
    assert.equal(a.x, a.radius, 'the pushed-out edge anchor is clamped to its legal x bound');
    return { p1: [a.x, a.y], p2: [b.x, b.y], radius: a.radius };
  });

  gate('corner-overlap-clamps-both-arena-axes', () => {
    const [a, b] = startMatch('ROBOT', 'ROBOT');
    positionPair(a, b, 76, 76, 105, 110, 1, 1, -1, -1);
    win.handleCollisions(1 / 60);
    for (const fighter of [a, b]) {
      assert.ok(fighter.x >= fighter.radius && fighter.x <= 1000 - fighter.radius);
      assert.ok(fighter.y >= fighter.radius && fighter.y <= 1000 - fighter.radius);
    }
    assert.equal(a.x, a.radius);
    assert.equal(a.y, a.radius);
    return { p1: [a.x, a.y], p2: [b.x, b.y] };
  });

  gate('Robot-Hunter-Frost-normal-contact-remains-neutral', () => {
    const pairs = [['ROBOT', 'HUNTER'], ['HUNTER', 'ICE'], ['ICE', 'ROBOT']];
    const observations = [];
    for (const [p1, p2] of pairs) {
      const [a, b] = startMatch(p1, p2);
      positionPair(a, b, 400, 500, 520, 500);
      const sum = a.radius + b.radius;
      const hpBefore = [a.hp, b.hp];
      const mark = bus().seq;
      win.handleCollisions(1 / 60);
      assert.ok(distance(a, b) >= sum - 1e-8, `${p1}/${p2} separates normally`);
      assert.ok(a.dir.x < 0 && b.dir.x > 0, `${p1}/${p2} reflects normally`);
      assert.deepEqual([a.hp, b.hp], hpBefore, `${p1}/${p2} has no added contact damage`);
      assert.equal(bodyCollisionsSince(mark).length, 2, `${p1}/${p2} remains observable by Hero Rework`);
      observations.push(`${p1}/${p2}`);
    }
    return observations;
  });

  gate('Mirror-stolen-contact-hook-remains-unchanged', () => {
    const [mirror, rival] = startMatch('MIRROR', 'ROBOT');
    positionPair(mirror, rival, 400, 500, 520, 500);
    const stolenData = { sentinel: 'restored' };
    let calls = 0;
    let observed = null;
    const stolenType = {
      name: 'CONTRACT_STOLEN_TYPE',
      onCollide(fighter, enemy, dt, normal, stolen) {
        calls += 1;
        observed = { enemy: enemy.name, dt, normal: { ...normal }, stolen, data: fighter.data.sentinel };
        return true;
      },
    };
    mirror.data.stolenType = stolenType;
    mirror.data.stolenData = stolenData;
    mirror.data.stolenTimer = 1;
    mirror.data.stolenPower = 1;
    const outerData = mirror.data;

    win.handleCollisions(1 / 60);

    assert.equal(calls, 1);
    assert.equal(observed.enemy, 'ROBOT');
    assert.equal(observed.stolen, true);
    assert.equal(observed.data, 'restored');
    assert.equal(mirror.data, outerData, 'the mirror restores its own data after the copied collision hook');
    assert.equal(mirror.data.stolenType, stolenType);
    assert.ok(Number.isFinite(observed.normal.x) && Number.isFinite(observed.normal.y));
    return { calls, copiedType: stolenType.name, restoredOuterData: mirror.data === outerData };
  });

  gate('current-Magnet-cast-remains-owned-by-APEX_MAGNET-and-Hero-Rework', () => {
    const [magnet] = startMatch('MAGNET', 'ROBOT');
    const ct = HR.byCombatant(magnet);
    const result = HR.pressAbility(magnet, 'A2');
    assert.equal(result.ok, true);
    assert.equal(ct.skills.A2.def.mechanicId, 'magnet.repulsion_field');
    assert.equal(win.APEX_MAGNET.activeFor(ct, 'a2'), true);
    assert.equal(magnet.data.fieldTimer, undefined, 'the retired FullRoster timer is not reintroduced');
    assert.ok(!win.projectiles.some(projectile => projectile?.type === 'magnet_field'));
    const collisionSource = fs.readFileSync('public/game/core/apexArsenalAnchorCollisionRuntime.js', 'utf8');
    assert.doesNotMatch(collisionSource, /fieldTimer|magnet_field|SNIPER|SLIME|FLASH/);
    return { cast: result.ok, activeOwner: 'APEX_MAGNET', legacyFieldTimer: magnet.data.fieldTimer ?? null };
  });

  gate('Hero-Rework-Crystal-wall-still-resolves-in-shared-world-collision', () => {
    const [crystal, robot] = startMatch('CRYSTAL', 'ROBOT');
    crystal.x = 350; crystal.y = 500;
    robot.x = 630; robot.y = 500;
    crystal.setDir(1, 0); robot.setDir(-1, 0);
    const ct = HR.byCombatant(crystal);
    const controller = HR.abilityController(ct);
    const k = controller.tryCast('A2', 'collision-contract');
    assert.equal(k.ok, true, 'Crystal K must activate');
    win.APEX_ARSENAL.weaponApi.fireBullet({
      owner: robot, x: crystal.x, y: 985, angle: -Math.PI / 2,
      speed: 900, damage: 0, weapon: 'PISTOL', radius: 7, life: 2,
    });
    for (let frame = 0; frame < 120; frame += 1) {
      T.step(1 / 60);
      if (win.APEX_CRYSTAL.inspect(ct).jobs.length) break;
    }
    const j = controller.tryCast('A1', 'collision-contract');
    assert.equal(j.ok, true, 'Crystal J must route its live construction');
    for (let frame = 0; frame < 90; frame += 1) T.step(1 / 60);

    const construct = win.APEX_CRYSTAL.inspect(ct).constructs.find(item => item.kind === 'wall');
    const capsules = win.APEX_CRYSTAL.capsules()
      .filter(cap => cap.cons?.id === construct?.id && cap.kind === 'wall');
    assert.ok(construct?.solid && capsules.length > 0, 'a real solid Crystal wall must expose current capsules');

    // Move the Crystal away from the probe path; the Robot makes one swept
    // crossing attempt through the actual current wall geometry.
    crystal.x = 150; crystal.y = 150;
    crystal.__hrWallPos = { x: crystal.x, y: crystal.y };
    const cap = capsules.slice().sort((left, right) =>
      Math.abs((right.by - right.ay)) - Math.abs((left.by - left.ay)))[0];
    const midX = (cap.ax + cap.bx) / 2, midY = (cap.ay + cap.by) / 2;
    const vx = cap.bx - cap.ax, vy = cap.by - cap.ay;
    const length = Math.hypot(vx, vy) || 1;
    const nx = -vy / length, ny = vx / length;
    const fromX = midX + nx * 260, fromY = midY + ny * 260;
    const toX = midX - nx * 260, toY = midY - ny * 260;
    assert.ok(fromX > robot.radius && fromX < 1000 - robot.radius);
    assert.ok(toX > robot.radius && toX < 1000 - robot.radius);
    assert.ok(fromY > robot.radius && fromY < 1000 - robot.radius);
    assert.ok(toY > robot.radius && toY < 1000 - robot.radius);
    robot.__hrWallPos = { x: fromX, y: fromY };
    robot.x = toX; robot.y = toY; robot.setDir(-nx, -ny);
    const mark = bus().seq;
    win.handleCollisions(1 / 60);

    const signedAfter = (robot.x - midX) * nx + (robot.y - midY) * ny;
    assert.ok(signedAfter > robot.radius + cap.r - 1, 'the anchor must remain on its entry side of the Crystal wall');
    assert.ok(robot.dir.x * nx + robot.dir.y * ny > 0, 'world-wall response reflects the anchor away');
    const wallEvents = bus().since(mark).filter(event => event.type === 'WorldWallCollision');
    assert.ok(wallEvents.length > 0, 'Hero Rework emits the actual shared world-wall contact');
    assert.ok(distanceToSegment(robot.x, robot.y, cap) >= robot.radius + cap.r - 1);
    return { solidCapsules: capsules.length, worldWallEvents: wallEvents.length, stoppedAt: [robot.x, robot.y] };
  });
} finally {
  win.close();
}

if (report.failures.length) process.exitCode = 1;
else console.log('PASS  current Arsenal collision contract complete');
