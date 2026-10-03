#!/usr/bin/env node
/* Focused regression for opponent-derived reflected-light accents.
 * Uses the production Mirror Gold renderer on real @napi-rs/canvas-backed
 * canvases, plus a live Arena match for identity, isolation, H1 scale, and
 * teardown assertions. This checks semantic inputs/pixels, not browser parity.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
const GOLD = win.APEX_MIRROR_GOLD;
const PRESENTATION = win.APEX_MIRROR_PRESENTATION;
const AV = win.APEX_ARSENAL_AV;
const WEAPONS = win.APEX_ARSENAL.weaponApi;
const bus = win.APEX_HERO_REWORK_AIL.bus;
const RGB_BY_ID = {
  ROBOT: [131, 205, 224],
  HUNTER: [177, 209, 112],
  CRYSTAL: [98, 165, 216],
  MAGNET: [192, 128, 208],
  ICE: [138, 207, 226],
  MIRROR: [183, 171, 217],
};
const NEUTRAL_RGB = [194, 200, 208];
const CANONICAL_IDS = Object.keys(RGB_BY_ID);
const createdGold = [];
let checks = 0;
let renderEvents = null;
let originalCreateGold = null;
let originalFighterDraw = null;
let originalEquippedDraw = null;

function gate(name, details = undefined) {
  checks++;
  console.log(`PASS MIRROR-ACCENT-${String(checks).padStart(2, '0')} ${name}${details === undefined ? '' : ` — ${JSON.stringify(details)}`}`);
}
function rgb(paint) { return [paint.r, paint.g, paint.b]; }
function goldFor(mirror) {
  const gold = createdGold.find((item) => item.externalTruth && item.M.id === mirror.id);
  assert.ok(gold, `one live Gold instance belongs to Mirror ${mirror.id}`);
  return gold;
}
function setOpponentIdentity(opponent, heroId) {
  opponent.heroId = heroId;
  PRESENTATION.tick(0);
  return PRESENTATION.inspect().records;
}
function pixelFrame(ctx, draw) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  draw();
  const data = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data.slice();
  const hash = crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque++;
  return { data, hash, opaque };
}
function changedPixelCount(a, b) {
  assert.equal(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1]
        || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) changed++;
  }
  return changed;
}
function clearDrawFixtures(gold) {
  gold.A2.on = false;
  gold.A2.opp = null;
  gold.A2.band = 0;
  gold.A2.ghostA = 0;
  gold.A2.tear = 0;
  gold.A2.ang = 0;
  for (const plate of gold.PL) {
    plate.tint = 0;
    plate.wash = 0;
    plate.act = 0;
    plate.wrongT = 0;
  }
  gold.sweepStep(10);
}
function renderPlate(ctx, gold) {
  clearDrawFixtures(gold);
  const plate = gold.PL.find((item) => item.id === 'UR');
  assert.ok(plate, 'the authored opponent plate exists');
  plate.tint = 1;
  gold.A2.on = true;
  gold.A2.band = 0.42;
  gold.A2.ghostA = 0.55;
  gold.A2.opp = plate;
  gold.addSweep(plate.id, 0.3, plate.axis, 0.9, 0.22, 0);
  gold.sweepStep(0.11);
  return pixelFrame(ctx, () => gold.drawPlate(ctx, plate));
}
function renderShard(ctx, gold) {
  clearDrawFixtures(gold);
  gold.addSweep('sh0', 0.7, 0.31, 0.88, 0.2, 0);
  gold.sweepStep(0.22);
  return pixelFrame(ctx, () => gold.drawShardAt(ctx, 500, 500, 0.08, 0.42, 0.42, 1, 0, null));
}
function prepareNode(gold) {
  const node = gold.ND[0];
  assert.ok(node, 'the authored formed-material node exists');
  Object.assign(node, {
    on: true, st: 2, t: 0.4, age: 8, x: 500, y: 500, rot: 0.08,
    fill: 1, fold: 0, tlock: 1, t3: 0, flash: 0,
    fa: 2, faT: -1, faW: 0,
  });
  node.sh = [];
  node.img.on = false;
  for (const ripple of node.rp) ripple.t = 9;
  for (const sweep of node.sw) sweep.on = false;
  Object.assign(node.sw[0], { on: true, t: 0.24, d: 0.7, ang: 0.8, amp: 0.82 });
  return node;
}
function renderNode(ctx, gold) {
  clearDrawFixtures(gold);
  const node = prepareNode(gold);
  return pixelFrame(ctx, () => gold.drawNodeBody(ctx, node));
}
function renderReflectedSeam(ctx, gold) {
  clearDrawFixtures(gold);
  gold.A2.on = true;
  gold.A2.band = 0.5;
  gold.A2.ghostA = 0.55;
  gold.A2.tear = 0;
  gold.A2.ang = 0.14;
  return pixelFrame(ctx, () => gold.drawMirrorEntityWithOpponent(ctx, (g, x, y) => {
    g.save();
    g.fillStyle = 'rgba(13,211,154,1)';
    g.beginPath();
    g.arc(x, y, 25, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }));
}
function renderGenericDemoSeam(ctx, gold) {
  clearDrawFixtures(gold);
  gold.A2.on = true;
  gold.A2.band = 0.5;
  gold.A2.ghostA = 0.55;
  gold.A2.tear = 0;
  gold.A2.ang = 0.14;
  return pixelFrame(ctx, () => gold.drawMirrorEntity(ctx));
}
function gameplaySnapshot() {
  const arena = win.APEX_ARSENAL && win.APEX_ARSENAL.state || {};
  const fighters = H.fighters();
  return {
    fighters: fighters.map((fighter) => {
      const combatant = HR.byCombatant(fighter);
      const holder = WEAPONS.getHolder(fighter);
      return {
        id: fighter.id,
        x: fighter.x, y: fighter.y,
        vx: fighter.vx, vy: fighter.vy,
        radius: fighter.radius,
        hp: fighter.hp, maxHp: fighter.maxHp,
        baseSpeed: fighter.baseSpeed,
        dir: fighter.dir ? { x: fighter.dir.x, y: fighter.dir.y } : null,
        combatantIndex: combatant && combatant.idx,
        weapon: holder ? {
          weaponId: holder.weaponId, ammo: holder.ammo,
          cooldown: holder.cooldown, reload: holder.reload, heat: holder.heat,
        } : null,
        // Deliberately omit heroId: the test temporarily changes only this
        // identity input to exercise the presentation resolver.
      };
    }),
    projectiles: Array.from(H.projectiles() || [], (projectile) => ({
      id: projectile.id, x: projectile.x, y: projectile.y,
      vx: projectile.vx, vy: projectile.vy,
      damage: projectile.damage, life: projectile.life,
      ownerId: projectile.owner && projectile.owner.id,
    })),
    arena: {
      time: arena.time, spawnTimer: arena.spawnTimer,
      spawnHeld: arena.spawnHeld, nextSlotId: arena.nextSlotId,
      slots: Array.from(arena.slots || [], (slot) => ({
        id: slot.id, x: slot.x, y: slot.y, phase: slot.phase,
        weaponId: slot.weaponId, pickedBy: slot.pickedBy,
      })),
    },
  };
}
function startMatch(p1, p2) {
  HR.setAiEnabled(false);
  T.start(p1, p2);
  T.holdSpawns();
  HR.setAiEnabled(false);
  const fighters = H.fighters();
  assert.equal(fighters.length, 2, 'the focused fixtures use the real two-fighter match');
  for (let i = 0; i < fighters.length; i++) {
    const fighter = fighters[i];
    fighter.baseSpeed = 0;
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.x = i === 0 ? 320 : 680;
    fighter.y = 500;
    if (fighter.dir) { fighter.dir.x = i === 0 ? 1 : -1; fighter.dir.y = 0; }
  }
  win.eval('cameraShake = 0; cameraZoom = 1;');
  win.__apexCameraView = { shakeX: 0, shakeY: 0, zoom: 1 };
  return fighters;
}
async function waitForPistolArt() {
  const start = Date.now();
  let wrapper = AV.weaponImage('PISTOL');
  while (!(wrapper && wrapper.img && wrapper.img.complete && wrapper.img.width > 0)
      && Date.now() - start < 8000) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    wrapper = AV.weaponImage('PISTOL');
  }
  assert.ok(wrapper && wrapper.img && wrapper.img.complete && wrapper.img.width > 0,
    'the real PISTOL art is ready for the production draw-order probe');
  return wrapper;
}
function installDrawOrderProbe(gold, fighterPrototype) {
  const events = [];
  const oldDraw = fighterPrototype.draw;
  fighterPrototype.draw = function probeFighterDraw(ctx) {
    if (renderEvents) renderEvents.push({ kind: 'body-start', actorId: this.id });
    const result = oldDraw.call(this, ctx);
    if (renderEvents) renderEvents.push({ kind: 'body-end', actorId: this.id });
    return result;
  };
  const oldEquipped = AV.drawEquippedWeapon;
  AV.drawEquippedWeapon = function probeHeldWeapon(ctx, fighter, holder, ...args) {
    if (renderEvents) renderEvents.push({ kind: 'held-weapon', actorId: fighter && fighter.id,
      weaponId: holder && holder.weaponId });
    return oldEquipped.call(this, ctx, fighter, holder, ...args);
  };
  const oldA1 = gold.drawA1World;
  gold.drawA1World = function probeA1World(ctx, ...args) {
    if (renderEvents) renderEvents.push({ kind: 'a1-world', mirrorId: gold.M.id });
    return oldA1.call(this, ctx, ...args);
  };
  const oldMirrorBody = gold.drawMirrorEntityWithOpponent;
  gold.drawMirrorEntityWithOpponent = function probeMirrorBody(ctx, ...args) {
    if (renderEvents) renderEvents.push({ kind: 'mirror-body', mirrorId: gold.M.id });
    return oldMirrorBody.call(this, ctx, ...args);
  };
  return () => {
    fighterPrototype.draw = oldDraw;
    AV.drawEquippedWeapon = oldEquipped;
    gold.drawA1World = oldA1;
    gold.drawMirrorEntityWithOpponent = oldMirrorBody;
  };
}

try {
  assert.ok(PRESENTATION && GOLD, 'production Gold and presentation adapter are installed');
  originalCreateGold = GOLD.createMirrorInstance;
  GOLD.createMirrorInstance = function captureGold(options) {
    const gold = originalCreateGold.call(GOLD, options);
    createdGold.push(gold);
    return gold;
  };

  for (const [heroId, expected] of Object.entries(RGB_BY_ID)) {
    assert.deepEqual(rgb(PRESENTATION.resolveOpponentReflectionAccent(heroId)), expected,
      `${heroId} resolves to its frozen subdued reflected-light accent`);
  }
  assert.deepEqual(rgb(PRESENTATION.resolveOpponentReflectionAccent('  frost ')), RGB_BY_ID.ICE,
    'FROST aliases the canonical ICE accent');
  const neutral = PRESENTATION.resolveOpponentReflectionAccent('UNLISTED_HERO');
  assert.deepEqual(rgb(neutral), NEUTRAL_RGB, 'unknown identity has a deterministic neutral fallback');
  assert.strictEqual(PRESENTATION.resolveOpponentReflectionAccent('__proto__'), neutral,
    'prototype-like unknown identity cannot bypass the neutral fallback');
  assert.strictEqual(PRESENTATION.resolveOpponentReflectionAccent('toString'), neutral,
    'inherited object keys cannot bypass the neutral fallback');
  gate('canonical identity map, FROST alias, and own-property neutral fallback', {
    identities: CANONICAL_IDS, frost: 'ICE', neutral: rgb(neutral),
  });

  const fighters = startMatch('MIRROR', 'ROBOT');
  const mirror = fighters.find((fighter) => HR.byCombatant(fighter)?.heroId === 'MIRROR');
  assert.ok(mirror, 'the live focus fixture contains a Mirror fighter');
  const mirrorCt = HR.byCombatant(mirror);
  const opponentCt = HR.match.combatants.find((combatant) => combatant !== mirrorCt);
  assert.ok(opponentCt && opponentCt.anchor, 'the Mirror has a real opponent combatant');
  const originalOpponentHeroId = opponentCt.heroId;
  const gold = goldFor(mirror);
  const focusRecord = PRESENTATION.inspect().records.find((record) => record.mirrorId === mirror.id);
  assert.ok(focusRecord, 'the live Mirror diagnostic record exists');
  assert.equal(focusRecord.bodyVisualMultiplier, 1.00,
    'accepted H1 live body multiplier remains exactly 1.00');
  assert.equal(focusRecord.goldMirrorRadius, 34, 'H1 uses Gold reference radius 34');
  assert.equal(focusRecord.bodyK, mirror.radius / 34,
    'H1 bodyK remains live fighter radius / Gold MIRROR_R');
  gate('live H1 bodyK remains fighter.radius / Gold.MIRROR_R with multiplier 1.00', {
    fighterRadius: mirror.radius, goldMirrorRadius: 34, bodyVisualMultiplier: 1.00,
    bodyK: focusRecord.bodyK,
  });

  const drawCanvas = win.document.createElement('canvas');
  drawCanvas.width = 1000;
  drawCanvas.height = 1000;
  const drawCtx = drawCanvas.getContext('2d');
  const framesBySurface = Object.create(null);
  const initialSnapshot = gameplaySnapshot();

  setOpponentIdentity(opponentCt, 'UNKNOWN_REFLECTION_ID');
  const neutralFrames = {
    plate: renderPlate(drawCtx, gold),
    shard: renderShard(drawCtx, gold),
    node: renderNode(drawCtx, gold),
    reflectedSeam: renderReflectedSeam(drawCtx, gold),
  };
  for (const [surface, frame] of Object.entries(neutralFrames)) {
    assert.ok(frame.opaque > 25, `${surface} fixture rendered actual Gold pixels`);
  }

  for (const heroId of CANONICAL_IDS) {
    const records = setOpponentIdentity(opponentCt, heroId);
    const record = records.find((item) => item.mirrorId === mirror.id);
    assert.ok(record, `${heroId}: live presentation record remains attached`);
    assert.equal(record.opponentHeroId, heroId, `${heroId}: raw opponent identity refreshed`);
    assert.equal(record.opponentAccent, heroId, `${heroId}: per-Mirror Gold accent refreshed`);
    assert.deepEqual(Array.from(record.opponentAccentRgb), RGB_BY_ID[heroId]);
    assert.equal(gold.getOpponentReflectionAccent().id, heroId,
      `${heroId}: Gold draw inputs receive this opponent identity`);

    const frames = {
      plate: renderPlate(drawCtx, gold),
      shard: renderShard(drawCtx, gold),
      node: renderNode(drawCtx, gold),
      reflectedSeam: renderReflectedSeam(drawCtx, gold),
    };
    framesBySurface[heroId] = {};
    for (const [surface, frame] of Object.entries(frames)) {
      const changed = changedPixelCount(neutralFrames[surface].data, frame.data);
      assert.ok(changed > 12,
        `${heroId}/${surface}: opponent accent changes actual rendered pixels (${changed})`);
      framesBySurface[heroId][surface] = { sha256: frame.hash, changedFromNeutral: changed };
    }
  }
  for (const surface of Object.keys(neutralFrames)) {
    const hashes = new Set(CANONICAL_IDS.map((heroId) => framesBySurface[heroId][surface].sha256));
    assert.equal(hashes.size, CANONICAL_IDS.length,
      `${surface}: all six supported identities produce distinct actual canvas output`);
  }
  gate('opponent plate, shards, formed node, and reflected A2 seam receive real per-identity Gold draw colors', {
    perSurfaceUniqueFrames: Object.fromEntries(Object.keys(neutralFrames).map((surface) => [
      surface, new Set(CANONICAL_IDS.map((heroId) => framesBySurface[heroId][surface].sha256)).size,
    ])),
    sampleChangedPixels: Object.fromEntries(CANONICAL_IDS.map((heroId) => [
      heroId, Object.fromEntries(Object.entries(framesBySurface[heroId])
        .map(([surface, result]) => [surface, result.changedFromNeutral])),
    ])),
  });

  const frostRecords = setOpponentIdentity(opponentCt, 'FROST');
  assert.equal(frostRecords.find((item) => item.mirrorId === mirror.id).opponentAccent, 'ICE');
  assert.deepEqual(gold.getOpponentReflectionAccent().id, 'ICE');
  const frostPlate = renderPlate(drawCtx, gold);
  assert.equal(frostPlate.hash, framesBySurface.ICE.plate.sha256,
    'FROST and ICE use identical reflected-plate draw inputs');
  setOpponentIdentity(opponentCt, 'UNKNOWN_REFLECTION_ID');
  const neutralRepeat = {
    plate: renderPlate(drawCtx, gold),
    shard: renderShard(drawCtx, gold),
    node: renderNode(drawCtx, gold),
    reflectedSeam: renderReflectedSeam(drawCtx, gold),
  };
  for (const surface of Object.keys(neutralFrames)) {
    assert.equal(neutralRepeat[surface].hash, neutralFrames[surface].hash,
      `${surface}: unknown identities render deterministically with the neutral fallback`);
  }
  gate('FROST/ICE alias and repeated unknown-identity neutral pixels are deterministic');

  // A non-opponent Gold seam still keeps its original generic violet/white
  // specular. Only drawMirrorEntityWithOpponent enters the adaptive branch.
  setOpponentIdentity(opponentCt, 'ROBOT');
  const genericRobot = renderGenericDemoSeam(drawCtx, gold);
  setOpponentIdentity(opponentCt, 'HUNTER');
  const genericHunter = renderGenericDemoSeam(drawCtx, gold);
  assert.equal(genericRobot.hash, genericHunter.hash,
    'generic/demo Mirror seam pixels do not follow opponent identity');
  const canonicalGold = fs.readFileSync('docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html');
  const canonicalSha = crypto.createHash('sha256').update(canonicalGold).digest('hex');
  assert.equal(canonicalSha, 'c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205',
    'canonical Gold HTML stays byte-identical');
  const goldSource = fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js', 'utf8');
  assert.match(goldSource, /#ffa04e/);
  assert.match(goldSource, /#c4531a/);
  assert.match(goldSource, /rgba\(255,140,50,\.96\)/);
  assert.match(goldSource, /rgba\(255,150,60,/);
  assert.ok(goldSource.includes("gr.addColorStop(.46,'rgba(255,255,255,.92)')"),
    'white-hot opponent sweep core remains unchanged');
  assert.ok(goldSource.includes("gr.addColorStop(.5,'rgba(255,255,255,.85)')"),
    'white-hot A2 seam center remains unchanged');
  assert.ok(goldSource.includes("gr2.addColorStop(.5,'rgba(255,255,255,'+(.7*w.amp*Math.sin(Math.PI*p))+')')"),
    'formed-node dynamic sweep preserves its white specular envelope');
  gate('canonical Gold, generic Mirror seam, white-hot specular, and unrelated warm channels remain intact');

  // A separately constructed Gold pair proves setter and paint state are not
  // shared globally; mutating one leaves the other's draw inputs intact.
  const isolatedA = GOLD.createMirrorInstance({ seed: 0xA11CE });
  const isolatedB = GOLD.createMirrorInstance({ seed: 0xB0B });
  isolatedA.setOpponentReflectionAccent(PRESENTATION.resolveOpponentReflectionAccent('ROBOT'));
  isolatedB.setOpponentReflectionAccent(PRESENTATION.resolveOpponentReflectionAccent('HUNTER'));
  assert.equal(isolatedA.getOpponentReflectionAccent().id, 'ROBOT');
  assert.equal(isolatedB.getOpponentReflectionAccent().id, 'HUNTER');
  assert.notStrictEqual(isolatedA.getOpponentReflectionAccent(), isolatedB.getOpponentReflectionAccent(),
    'each instance has its own paint object');
  isolatedA.setOpponentReflectionAccent(PRESENTATION.resolveOpponentReflectionAccent('CRYSTAL'));
  assert.equal(isolatedA.getOpponentReflectionAccent().id, 'CRYSTAL');
  assert.equal(isolatedB.getOpponentReflectionAccent().id, 'HUNTER',
    'changing one instance cannot recolor its sibling');
  isolatedA.clearExternalTruth();
  isolatedB.clearExternalTruth();
  assert.equal(isolatedA.getOpponentReflectionAccent().id, 'NEUTRAL');
  assert.equal(isolatedB.getOpponentReflectionAccent().id, 'NEUTRAL');
  gate('Gold setter state is per-instance, sibling-safe, and neutralized by clearExternalTruth');

  opponentCt.heroId = originalOpponentHeroId;
  clearDrawFixtures(gold);
  assert.deepEqual(gameplaySnapshot(), initialSnapshot,
    'identity refresh and actual Gold renders changed no fighter, weapon, projectile, or arena gameplay state');
  gate('opponent identity render probes leave live gameplay snapshot unchanged', {
    fighterCount: initialSnapshot.fighters.length,
    projectileCount: initialSnapshot.projectiles.length,
    arenaTime: initialSnapshot.arena.time,
  });

  // Verify the accepted production order dynamically: body, real held weapon,
  // then the scaled A1World pass. The source-level residue seam must remain
  // before weapons, as in the accepted H1/A1 ordering.
  const { fighters: orderFighters } = { fighters: H.fighters() };
  const orderMirror = orderFighters.find((fighter) => HR.byCombatant(fighter)?.heroId === 'MIRROR');
  const orderCt = HR.byCombatant(orderMirror);
  const orderGold = goldFor(orderMirror);
  const holder = WEAPONS.equip(orderMirror, 'PISTOL');
  assert.ok(holder && WEAPONS.getHolder(orderMirror)?.weaponId === 'PISTOL',
    'the real Arsenal weapon equips for the draw-order probe');
  await waitForPistolArt();
  bus.emit('MirrorA1Cast', {
    hero: 'MIRROR', castId: 'mirror-opponent-accent-draw-order',
    combatantIndex: orderCt.idx, weaponId: 'PISTOL', whiff: false,
  });
  PRESENTATION.tick(0);
  assert.ok(orderGold.A1.on, 'accepted presentation-only A1 is active for the production order probe');

  const fighterPrototype = win.Fighter.prototype;
  originalFighterDraw = fighterPrototype.draw;
  originalEquippedDraw = AV.drawEquippedWeapon;
  const restoreDrawProbe = installDrawOrderProbe(orderGold, fighterPrototype);
  try {
    renderEvents = [];
    T.redraw();
    const events = renderEvents.slice();
    const starts = events.filter((event) => event.kind === 'body-start').map((event) => event.actorId);
    const ends = events.filter((event) => event.kind === 'body-end').map((event) => event.actorId);
    const expectedBodyIds = Array.from(orderFighters, (fighter) => fighter.id);
    assert.deepEqual(starts, expectedBodyIds);
    assert.deepEqual(ends, expectedBodyIds);
    const lastBody = events.reduce((last, event, index) => event.kind === 'body-end' ? index : last, -1);
    const heldAt = events.map((event, index) => event.kind === 'held-weapon' ? index : -1).filter((index) => index >= 0);
    const a1At = events.map((event, index) => event.kind === 'a1-world' ? index : -1).filter((index) => index >= 0);
    assert.ok(heldAt.length > 0, 'real equipped-weapon draw is observed');
    assert.equal(a1At.length, 1, 'one accepted A1World draw is observed for the live Mirror');
    assert.ok(lastBody < heldAt[0], 'all fighter bodies precede held-weapon art');
    assert.ok(Math.max(...heldAt) < a1At[0], 'real held weapons precede the A1World overlay');
    const arsenalSource = fs.readFileSync('public/game/modes/arsenalQuestRuntime.js', 'utf8');
    const foregroundAt = arsenalSource.indexOf('function drawForeground() {');
    const foregroundEnd = arsenalSource.indexOf('function muteArenaGlyphs(c)', foregroundAt);
    const foreground = arsenalSource.slice(foregroundAt, foregroundEnd);
    const residueAt = foreground.indexOf('renderPostFighterResidue?.(ctx)');
    const heldPassAt = foreground.indexOf('drawEquippedWeapons(ctx)');
    const mirrorPostAt = foreground.indexOf('renderPostFighters?.(ctx)');
    const vfxAt = foreground.indexOf('weaponApi.drawArsenalVisuals(ctx)');
    assert.ok(foregroundAt >= 0 && foregroundEnd > foregroundAt
      && residueAt >= 0 && heldPassAt > residueAt && mirrorPostAt > heldPassAt && vfxAt > mirrorPostAt,
    'production source preserves A2 residue → held weapons → A1World → Arsenal VFX');
    gate('live production render order retains body → real held weapons → A1World plus accepted residue seam', {
      bodies: starts.length, heldWeaponDraws: heldAt.length, a1WorldDraws: a1At.length,
      sourceOrder: ['A2 residue', 'real held weapons', 'A1World', 'Arsenal VFX'],
    });
  } finally {
    renderEvents = null;
    restoreDrawProbe();
  }

  // Two real Mirror instances in one match must each retain their own actual
  // opponent identity, and teardown must erase both colors before rematch.
  PRESENTATION.teardown();
  const mvmFighters = startMatch('MIRROR', 'MIRROR');
  const mirrorBodies = mvmFighters.filter((fighter) => HR.byCombatant(fighter)?.heroId === 'MIRROR');
  assert.equal(mirrorBodies.length, 2);
  PRESENTATION.tick(0);
  const mvmRecords = PRESENTATION.inspect().records;
  assert.equal(mvmRecords.length, 2);
  assert.ok(mvmRecords.every((record) => record.opponentHeroId === 'MIRROR'
    && record.opponentAccent === 'MIRROR'), 'each Mirror derives MIRROR accent from the other Mirror');
  const mvmGolds = mirrorBodies.map((fighter) => goldFor(fighter));
  assert.notStrictEqual(mvmGolds[0].getOpponentReflectionAccent(), mvmGolds[1].getOpponentReflectionAccent(),
    'Mirror-v-Mirror Gold instances own distinct paint state');
  mvmGolds[0].setOpponentReflectionAccent(PRESENTATION.resolveOpponentReflectionAccent('ROBOT'));
  assert.equal(mvmGolds[0].getOpponentReflectionAccent().id, 'ROBOT');
  assert.equal(mvmGolds[1].getOpponentReflectionAccent().id, 'MIRROR',
    'one Mirror cannot recolor the other while both are active');
  PRESENTATION.tick(0);
  assert.equal(mvmGolds[0].getOpponentReflectionAccent().id, 'ROBOT',
    'refreshing an unchanged identity does not let the other Mirror overwrite this instance');
  assert.equal(mvmGolds[1].getOpponentReflectionAccent().id, 'MIRROR');
  mvmGolds[0].setOpponentReflectionAccent(PRESENTATION.resolveOpponentReflectionAccent('MIRROR'));
  assert.ok(mvmGolds.every((item) => item.getOpponentReflectionAccent().id === 'MIRROR'));
  gate('Mirror-v-Mirror runtime keeps both opponent colors isolated', {
    mirrors: mvmRecords.map((record) => ({ mirrorId: record.mirrorId,
      opponentId: record.opponentId, accent: record.opponentAccent })),
  });

  PRESENTATION.teardown();
  assert.ok(mvmGolds.every((item) => !item.externalTruth
    && item.getOpponentReflectionAccent().id === 'NEUTRAL'),
  'match teardown clears external truth and restores neutral accent on both old Gold instances');
  assert.equal(PRESENTATION.inspect().instanceCount, 0);
  const rematchFighters = startMatch('MIRROR', 'HUNTER');
  PRESENTATION.tick(0);
  const rematchMirror = rematchFighters.find((fighter) => HR.byCombatant(fighter)?.heroId === 'MIRROR');
  const rematchGold = goldFor(rematchMirror);
  const rematchRecord = PRESENTATION.inspect().records.find((record) => record.mirrorId === rematchMirror.id);
  assert.equal(rematchRecord.opponentHeroId, 'HUNTER');
  assert.equal(rematchGold.getOpponentReflectionAccent().id, 'HUNTER',
    'new match takes the new opponent identity without inheriting prior neutralized state');
  gate('teardown resets old Gold to neutral and new match binds its own opponent identity', {
    oldInstances: mvmGolds.map((item) => item.getOpponentReflectionAccent().id),
    newOpponent: rematchRecord.opponentHeroId,
    newAccent: rematchGold.getOpponentReflectionAccent().id,
  });

  console.log(`PASS Mirror opponent-reflection accent focused suite: ${checks} gates`);
  console.log(`ACTUAL CANVAS PIXEL HASHES ${JSON.stringify(framesBySurface)}`);
} finally {
  renderEvents = null;
  if (originalFighterDraw && win.Fighter && win.Fighter.prototype) {
    // The per-probe wrapper restores this itself; retain a fail-safe for early assertions.
    win.Fighter.prototype.draw = originalFighterDraw;
  }
  if (originalEquippedDraw) AV.drawEquippedWeapon = originalEquippedDraw;
  for (const gold of createdGold) {
    try { if (gold.externalTruth) gold.clearExternalTruth(); } catch { /* cleanup only */ }
  }
  if (originalCreateGold) GOLD.createMirrorInstance = originalCreateGold;
  try { PRESENTATION.dispose(); } catch { /* cleanup only */ }
  H.dom.window.close();
}
