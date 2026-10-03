#!/usr/bin/env node
/* R2 — real Hero-Rework gameplay, semantic Gold reconciliation, and F2/A1 adapter integration. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
const GOLD = win.APEX_MIRROR_GOLD;
const bus = win.APEX_HERO_REWORK_AIL.bus;
const DT = 1 / 120;
const goldInstances = [];
const createGold = GOLD.createMirrorInstance;
GOLD.createMirrorInstance = function captureGold(options) {
  const instance = createGold.call(GOLD, options);
  goldInstances.push(instance);
  return instance;
};
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;
let gateCount = 0;
function gate(name, fn) {
  fn(); gateCount++;
  console.log(`PASS R2 ${String(gateCount).padStart(2, '0')} ${name}`);
}
function stepFrames(n) { for (let i = 0; i < n; i++) T.step(DT, DT); }
function eventsAfter(seq, type) { return bus.since(seq).filter((event) => event.type === type); }
function recordFor(presentation, index) {
  return presentation.inspect().records.find((record) => record.combatantIndex === index);
}
function byId(pool, id) { return pool.find((item) => item.on && item.id === id); }
function close(a, b, eps = 1e-8) { return Math.abs(a - b) <= eps; }
function expectedSide(provenance, mirrorX) {
  const dx = Number.isFinite(provenance.dirX) ? provenance.dirX : 0;
  const dy = Number.isFinite(provenance.dirY) ? provenance.dirY : 0;
  const magnitude = Math.hypot(dx, dy) || 1;
  const nx = dx / magnitude;
  return Math.abs(nx) > .25 ? (nx > 0 ? 'L' : 'R')
    : (provenance.hitX < mirrorX ? 'L' : 'R');
}
function snapshotShards(shards) {
  return shards.map((shard) => ({ identity: shard,
    fields: ['on', 'st', 'x', 'y', 'vx', 'vy', 'age', 'fx', 'fy', 'tx', 'ty', 'mt0', 'moving']
      .map((key) => shard[key]), prov: shard.prov }));
}
function assertShardSnapshot(shards, snapshot) {
  assert.equal(shards.length, snapshot.length);
  for (let i = 0; i < shards.length; i++) {
    assert.strictEqual(shards[i], snapshot[i].identity);
    assert.deepEqual(['on', 'st', 'x', 'y', 'vx', 'vy', 'age', 'fx', 'fy', 'tx', 'ty', 'mt0', 'moving']
      .map((key) => shards[i][key]), snapshot[i].fields);
    assert.strictEqual(shards[i].prov, snapshot[i].prov);
  }
}
function latestNewProjectile(before) {
  for (let i = win.projectiles.length - 1; i >= 0; i--) {
    const projectile = win.projectiles[i];
    if (projectile && projectile.aq && !before.has(projectile)) return projectile;
  }
  return null;
}
function fireBullet(spec) {
  const before = new Set(win.projectiles);
  win.APEX_ARSENAL.weaponApi.fireBullet(spec);
  const projectile = latestNewProjectile(before);
  assert.ok(projectile, 'real weaponApi.fireBullet creates one projectile');
  return projectile;
}

try {
  T.start('MIRROR', 'ROBOT');
  T.holdSpawns();
  const [mirror, foe] = H.fighters();
  const ct = HR.byCombatant(mirror);
  mirror.baseSpeed = 0; foe.baseSpeed = 0;
  mirror.x = 500; mirror.y = 500; foe.x = 850; foe.y = 500;
  stepFrames(1);
  const presentation = win.APEX_MIRROR_PRESENTATION;
  assert.ok(presentation && HR.mirrorNode, 'shipping adapter and canonical HR.mirrorNode exist');
  const gold = goldInstances.find((instance) => instance.M.id === mirror.id);
  assert.ok(gold, 'the real Mirror combatant owns one isolated Gold instance');
  const passive = ct.store['mirror.passive'];
  assert.ok(passive && passive.slots.length === 16 && passive.nodes.length === 0);

  // Record the actual damage-hook/reconcile ordering. mirrorShardProc installs
  // the real pool objects, captures only the hit-time side, and the production
  // hrPostTick must bind them before its first Gold fixed step.
  const originalCaptureSeeds = presentation.capturePassiveShardSeeds;
  const originalSyncPassive = gold.syncExternalPassive;
  const originalGoldStep = gold.stepExternalPresentation;
  const semanticOrder = [];
  gold.syncExternalPassive = function observeFirstSemanticBind(snapshot, geometry) {
    if (!semanticOrder.some((event) => event.kind === 'bind')
        && snapshot.shards.some((input) => input && input.on && input.identity)) {
      semanticOrder.push({ kind: 'bind', goldSteps: gold.externalAudit().steps,
        expressions: { eL: gold.E.eL, nL: gold.E.nL, sL: gold.E.sL,
          eR: gold.E.eR, nR: gold.E.nR, sR: gold.E.sR } });
    }
    return originalSyncPassive.call(gold, snapshot, geometry);
  };
  gold.stepExternalPresentation = function observeFirstGoldStep(dt) {
    if (semanticOrder.some((event) => event.kind === 'bind')
        && !semanticOrder.some((event) => event.kind === 'step'))
      semanticOrder.push({ kind: 'step', dt, goldSteps: gold.externalAudit().steps });
    return originalGoldStep.call(gold, dt);
  };
  let hitObservation = null;
  presentation.capturePassiveShardSeeds = function observeHitSeed(realCt, made) {
    if (realCt === ct && !hitObservation) {
      const first = made[0];
      const provenance = first && first.prov;
      const side = expectedSide(provenance, mirror.x);
      hitObservation = {
        made: made.slice(),
        slots: made.map((shard) => passive.slots.indexOf(shard)),
        steps: presentation.inspect().scheduler.advancedSteps,
        goldSteps: gold.externalAudit().steps,
        bindingsBeforeReconcile: gold.externalPassiveAudit().shardBindings,
        realPoolAlreadyOwnsAll: made.every((shard) => passive.slots.includes(shard)),
        provenance,
        provenanceSnapshot: { ...provenance },
        mirrorX: mirror.x,
        side,
        expressions: { eL: gold.E.eL, nL: gold.E.nL, sL: gold.E.sL,
          eR: gold.E.eR, nR: gold.E.nR, sR: gold.E.sR },
      };
    }
    return originalCaptureSeeds.call(presentation, realCt, made);
  };
  const hpBefore = mirror.hp;
  mirror.takeDamage(210, foe, 'arsenal-PISTOL');
  const made = passive.slots.filter((shard) => shard && shard.on);
  assert.ok(mirror.hp < hpBefore, 'real damage path realizes Mirror HP loss');
  assert.equal(made.length, 5, 'real F1 damage creates five shards in its fixed 16-slot pool');
  assert.ok(hitObservation, 'the real mirrorShardProc path calls the presentation-only side seam');
  assert.equal(gold.externalPassiveAudit().shardBindings, 0, 'the hit callback precedes first Gold binding');
  assert.equal(gold.externalAudit().steps, hitObservation.goldSteps, 'no Gold step occurs between hit and hrPostTick');
  T.step(DT, DT); // production AQ.step -> gameplay -> hrPostTick -> semantic bind -> Gold step
  assert.ok(semanticOrder.length >= 2);
  const preReconcileSnapshot = snapshotShards(made);
  const oldGoldSteps = gold.externalAudit().steps;
  const oldPassiveSteps = gold.externalPassiveAudit().passiveSteps;
  presentation.tick(0); // same production adapter, deliberately no visual step
  assertShardSnapshot(made, preReconcileSnapshot);
  gate('real F1 damage → shard pool → hit-side capture → hrPostTick bind before Gold step', () => {
    assert.equal(hitObservation.made.length, 5);
    assert.ok(hitObservation.realPoolAlreadyOwnsAll);
    assert.equal(Array.from(hitObservation.slots).join(','), '0,1,2,3,4');
    assert.equal(hitObservation.bindingsBeforeReconcile, 0,
      'no Gold proxy exists for these new identities when hit-side is captured');
    assert.equal(hitObservation.steps, hitObservation.goldSteps,
      'hit-side capture runs before another presentation fixed step');
    assert.deepEqual({ ...hitObservation.provenance }, hitObservation.provenanceSnapshot,
      'presentation capture does not mutate real shard provenance');
    assert.equal(hitObservation.side, 'R', 'the canonical incoming leftward hit selects Gold R face');
    assert.deepEqual(semanticOrder.map((event) => event.kind), ['bind', 'step']);
    assert.equal(semanticOrder[0].goldSteps, hitObservation.goldSteps);
    assert.equal(semanticOrder[1].goldSteps, hitObservation.goldSteps,
      'first semantic bind occurs before that post-hit Gold step');
    assert.equal(semanticOrder[1].dt, DT);
    assert.deepEqual(semanticOrder[0].expressions, hitObservation.expressions,
      'Gold expression state is still pre-hit at first binding because Gold has not advanced');
  });

  gate('first semantic binding preserves exact slots and pre-hit e/n/s without mutating gameplay', () => {
    assert.equal(gold.externalPassiveAudit().shardBindings, 5);
    assert.equal(gold.externalAudit().steps, oldGoldSteps, 'zero-dt reconciliation cannot advance Gold time');
    assert.equal(gold.externalPassiveAudit().passiveSteps, oldPassiveSteps);
    for (const shard of made) {
      const slot = passive.slots.indexOf(shard);
      const proxy = gold.SH[slot];
      assert.ok(proxy.on);
      assert.equal(proxy.side, hitObservation.side);
      assert.equal(proxy.pe, hitObservation.expressions[`e${hitObservation.side}`]);
      assert.equal(proxy.pn, hitObservation.expressions[`n${hitObservation.side}`]);
      assert.equal(proxy.ps, hitObservation.expressions[`s${hitObservation.side}`]);
      assert.equal(proxy.x, shard.x);
      assert.equal(proxy.y, shard.y);
      assert.deepEqual({ ...shard.prov }, hitObservation.provenanceSnapshot);
    }
  });

  let activeNode = null;
  let partialFill = null;
  for (let i = 0; i < 500 && !activeNode; i++) {
    stepFrames(1);
    const candidate = passive.nodes.find((node) => node && node.st === 1);
    const proxy = gold.ND.find((node) => node.on);
    if (candidate && proxy && candidate.tlock >= 0 && proxy.fill > 0 && proxy.fill < 1) {
      partialFill = { t: candidate.t, tlock: candidate.tlock, fill: proxy.fill };
    }
    activeNode = passive.nodes.find((node) => node && node.st === 2) || null;
  }
  assert.ok(activeNode, 'real F1 cadence/formation/assembly reaches ACTIVE without test-node injection');
  const goldNode = byId(gold.ND, activeNode.id) || gold.ND.find((node) => node.on);
  assert.ok(goldNode);
  gate('real F1 cadence forms a node and maps its five exact member slots into Gold', () => {
    assert.equal(passive.nodes.length, 1);
    assert.strictEqual(activeNode.owner, ct);
    assert.equal(activeNode.sh.length, 5);
    assert.ok(activeNode.sh.every((shard) => made.includes(shard)),
      'formation uses the five real damage-produced pool identities');
    assert.equal(gold.externalPassiveAudit().shardBindings, 5);
    assert.equal(gold.externalPassiveAudit().nodeBindings, 1);
    assert.strictEqual(goldNode.externalGeometry, HR.mirrorNode);
    assert.equal(goldNode.st, activeNode.st);
    assert.equal(goldNode.fill, 1);
    assert.deepEqual(new Set(goldNode.sh), new Set(activeNode.sh.map((shard) => gold.SH[passive.slots.indexOf(shard)])));
    assert.ok(partialFill && partialFill.fill > 0 && partialFill.fill < 1,
      'the real assembly exposed an intermediate Gold fill state');
    assert.ok(close(partialFill.fill, GOLD.sstep(partialFill.tlock + .04,
      partialFill.tlock + .34, partialFill.t)), 'partial fill follows Gold smooth-step and real tlock');
  });

  gate('Gold node edge targets and body basis derive only from canonical HR.mirrorNode geometry', () => {
    const origin = HR.mirrorNode.toWorld(activeNode, 0, 0);
    const ux = HR.mirrorNode.toWorld(activeNode, 1, 0);
    const uy = HR.mirrorNode.toWorld(activeNode, 0, 1);
    assert.deepEqual([goldNode.x, goldNode.y], [origin.x, origin.y]);
    assert.ok(close(goldNode.worldTransform.a, ux.x - origin.x));
    assert.ok(close(goldNode.worldTransform.b, ux.y - origin.y));
    assert.ok(close(goldNode.worldTransform.c, uy.x - origin.x));
    assert.ok(close(goldNode.worldTransform.d, uy.y - origin.y));
    const edges = HR.mirrorNode.NV.map((a, i) => {
      const b = HR.mirrorNode.NV[(i + 1) % HR.mirrorNode.NV.length];
      const pa = HR.mirrorNode.toWorld(activeNode, a[0], a[1]);
      const pb = HR.mirrorNode.toWorld(activeNode, b[0], b[1]);
      const midpoint = HR.mirrorNode.toWorld(activeNode, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      return { x: midpoint.x, y: midpoint.y, rot: Math.atan2(dy, dx) - Math.PI / 2,
        len: Math.hypot(dx, dy) * 1.08 };
    });
    assert.equal(goldNode.sh.length, 5);
    for (const shard of goldNode.sh) {
      const edge = edges.find((candidate) => close(shard.tx, candidate.x) && close(shard.ty, candidate.y));
      assert.ok(edge, 'Gold shard target lands on one canonical transformed NV edge');
      assert.ok(close(shard.trot, edge.rot));
      assert.ok(close(shard.tlen, edge.len));
      assert.equal(shard.twid, 9);
    }
  });

  // The real F1 node is the entry; the second endpoint is created only through
  // the runtime's documented NON-SHIPPING test seam. Actual F2 producer events
  // still come from a production weaponApi projectile and real swept contact.
  const destination = HR.match.api.mirrorTestNode(ct, activeNode.x + 320, activeNode.y, 0);
  assert.ok(destination && destination.st === 2);
  // Keep the real Mirror body downstream of both node surfaces so the exact
  // F2 surface contact precedes ordinary body collision on this test path.
  mirror.x = 900; mirror.y = 500;
  presentation.tick(0);
  const routeCalls = [];
  const presentExternalRoute = gold.presentExternalRoute;
  gold.presentExternalRoute = function captureAdapterRoute(route) {
    routeCalls.push(route);
    return presentExternalRoute.call(gold, route);
  };
  win.projectiles.length = 0;
  const routeSeq = bus.seq;
  const projectile = fireBullet({ owner: foe, x: activeNode.x - 200, y: activeNode.y,
    angle: 0, speed: 1200, damage: 40, weapon: 'SNIPER', life: 6 });
  let captureEvent = null;
  for (let i = 0; i < 80 && !captureEvent; i++) {
    stepFrames(1);
    captureEvent = eventsAfter(routeSeq, 'MirrorRouteCapture')[0] || null;
  }
  assert.ok(captureEvent, 'actual F2 sweep emits a real capture event');
  const capturePayload = captureEvent.payload;
  const captureCall = routeCalls.find((route) => route.kind === 'capture' && route.routeId === projectile);
  gate('real F2 capture preserves projectile identity, fixed endpoints, contact, direction and family power', () => {
    assert.strictEqual(capturePayload.projectile, projectile);
    assert.equal(Object.getOwnPropertyDescriptor(capturePayload, 'projectile').enumerable, false);
    assert.equal(capturePayload.entry, activeNode.id);
    assert.equal(capturePayload.dest, destination.id);
    assert.ok(capturePayload.point && Number.isFinite(capturePayload.point.x) && Number.isFinite(capturePayload.point.y));
    assert.ok(capturePayload.direction && Math.hypot(capturePayload.direction.x, capturePayload.direction.y) > 0);
    assert.equal(projectile.family, 'PRECISION');
    assert.equal(capturePayload.power, 3);
    assert.ok(captureCall);
    assert.strictEqual(captureCall.routeId, projectile);
    assert.equal(captureCall.entryNodeId, capturePayload.entry);
    assert.equal(captureCall.destinationNodeId, capturePayload.dest);
    assert.strictEqual(captureCall.point, capturePayload.point);
    assert.strictEqual(captureCall.direction, capturePayload.direction);
    assert.equal(captureCall.power, capturePayload.power);
    assert.strictEqual(HR.match.world.mirrorF2.escrow.find((entry) => entry.p === projectile).p, projectile);
    assert.equal(gold.externalPassiveAudit().routes, 1);
    assert.equal(gold.externalPassiveAudit().goldProjectiles, 0);
  });

  let imageEvent = null;
  for (let i = 0; i < 80 && !imageEvent; i++) {
    stepFrames(1);
    imageEvent = eventsAfter(routeSeq, 'MirrorEscrowImage')[0] || null;
  }
  assert.ok(imageEvent, 'real escrow timeline emits its destination-image edge');
  const imagePayload = imageEvent.payload;
  const imageCall = routeCalls.find((route) => route.kind === 'destination-image' && route.routeId === projectile);
  gate('real F2 destination image forwards real liveness and exact capture contact to Gold', () => {
    assert.strictEqual(imagePayload.projectile, projectile);
    assert.equal(imagePayload.destLive, true);
    assert.equal(imagePayload.dest, destination.id);
    assert.strictEqual(imagePayload.point, capturePayload.point);
    assert.strictEqual(imageCall.routeId, projectile);
    assert.equal(imageCall.destinationNodeId, destination.id);
    assert.equal(imageCall.destinationLive, true);
    assert.strictEqual(imageCall.point, imagePayload.point);
    assert.strictEqual(imageCall.direction, imagePayload.direction);
    assert.equal(gold.externalPassiveAudit().routes, 1);
    assert.equal(gold.externalPassiveAudit().imageOwners, 2);
  });

  destination.st = 3; // actual endpoint loss before terminal emerge; F2 must use captured entry fallback.
  let emergeEvent = null;
  for (let i = 0; i < 100 && !emergeEvent; i++) {
    stepFrames(1);
    emergeEvent = eventsAfter(routeSeq, 'MirrorRouteEmerge')[0] || null;
  }
  assert.ok(emergeEvent, 'real F2 timeline emits its exact terminal emerge');
  const emergePayload = emergeEvent.payload;
  const emergeCall = routeCalls.find((route) => route.kind === 'emerge' && route.routeId === projectile);
  gate('R1 route termination preserves true entry-fallback, terminal point and exact route ID', () => {
    assert.strictEqual(emergePayload.projectile, projectile);
    assert.equal(emergePayload.via, 'entry-fallback');
    assert.equal(emergePayload.fallback, true);
    assert.ok(Number.isFinite(emergePayload.x) && Number.isFinite(emergePayload.y));
    assert.strictEqual(emergeCall.routeId, projectile);
    assert.equal(emergeCall.via, 'entry-fallback');
    assert.equal(emergeCall.viaNodeId, null);
    assert.equal(emergeCall.fallback, true);
    assert.strictEqual(emergeCall.point, emergePayload.point);
    assert.equal(gold.externalPassiveAudit().routes, 0);
    assert.equal(gold.externalPassiveAudit().imageOwners, 0);
    assert.equal(gold.externalPassiveAudit().goldProjectiles, 0);
  });
  const pIndex = win.projectiles.indexOf(projectile);
  if (pIndex >= 0) win.projectiles.splice(pIndex, 1); // fixture cleanup after the real terminal event

  // Let the lost destination follow its real fold lifecycle, leaving only the
  // naturally formed F1 entry to produce an actual one-node local response.
  stepFrames(75);
  assert.ok(passive.nodes.includes(activeNode) && activeNode.st === 2);
  assert.ok(!passive.nodes.includes(destination), 'lost destination leaves the active set through real F1 fold');
  const localSeq = bus.seq;
  const localProjectile = fireBullet({ owner: foe, x: activeNode.x - 200, y: activeNode.y,
    angle: 0, speed: 1200, damage: 40, weapon: 'GLOCK_17', life: 6 });
  let localEvent = null;
  for (let i = 0; i < 80 && !localEvent; i++) {
    stepFrames(1);
    localEvent = eventsAfter(localSeq, 'MirrorRouteLocal')[0] || null;
  }
  assert.ok(localEvent, 'actual one-node F2 pass emits the local-response event');
  const localPayload = localEvent.payload;
  const localCall = routeCalls.find((route) => route.kind === 'local' && route.routeId === localProjectile);
  const previewPayload = eventsAfter(localSeq, 'MirrorRoutePreview')[0]?.payload || null;
  const previewCall = routeCalls.find((route) => route.kind === 'preview' && route.routeId === localProjectile);
  gate('real F2 preview and one-node local edges pass exact contact, direction, identity and power', () => {
    assert.strictEqual(localPayload.projectile, localProjectile);
    assert.equal(localPayload.node, activeNode.id);
    assert.ok(localPayload.point && localPayload.direction);
    assert.strictEqual(localCall.routeId, localProjectile);
    assert.equal(localCall.nodeId, activeNode.id);
    assert.strictEqual(localCall.point, localPayload.point);
    assert.strictEqual(localCall.direction, localPayload.direction);
    assert.equal(localCall.power, localPayload.power);
    assert.ok(previewPayload && previewCall, 'the real approach emitted Gold preview feedback before local contact');
    assert.strictEqual(previewCall.routeId, localProjectile);
    assert.strictEqual(previewCall.point, previewPayload.point);
    assert.strictEqual(previewCall.direction, previewPayload.direction);
    assert.equal(previewCall.power, previewPayload.power);
    assert.equal(gold.externalPassiveAudit().routes, 0, 'preview/local never invent an escrow route');
    assert.ok(win.projectiles.includes(localProjectile), 'one-node response leaves the real projectile in WORLD');
  });
  const localIndex = win.projectiles.indexOf(localProjectile);
  if (localIndex >= 0) win.projectiles.splice(localIndex, 1);

  // Use the real Arsenal weaponImage implementation and real production art.
  // Hold its loaded image as not-ready so production returns null, then expose
  // readiness on that same asset and verify the adapter retries without a loader.
  const av = win.APEX_ARSENAL_AV;
  const productionArtSource = fs.readFileSync('public/game/arsenal/arsenalPresentationRuntime.js', 'utf8');
  const authoredWeapon = win.APEX_ARSENAL_C_SET.weapons.PISTOL;
  assert.ok(authoredWeapon && authoredWeapon.w > 0 && authoredWeapon.h > 0);
  assert.match(productionArtSource,
    /return \(img && img\.complete && img\.width\) \? \{ img, w: meta\.w, h: meta\.h \} : null;/);
  const previousWeaponImage = av.weaponImage;
  const productionWeaponImage = previousWeaponImage.bind(av);
  let readyWeaponWrapper = productionWeaponImage('PISTOL');
  for (let attempt = 0; !readyWeaponWrapper && attempt < 700; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    readyWeaponWrapper = productionWeaponImage('PISTOL');
  }
  assert.ok(readyWeaponWrapper, 'the real Arsenal AV loader supplies an actual ready PISTOL wrapper');
  assert.deepEqual(Object.keys(readyWeaponWrapper).sort(), ['h', 'img', 'w']);
  assert.equal(readyWeaponWrapper.w, authoredWeapon.w);
  assert.equal(readyWeaponWrapper.h, authoredWeapon.h);
  const productionImage = readyWeaponWrapper.img;
  assert.ok(productionImage.__realImage, 'the wrapper references the loaded production weapon asset');
  const imageWasComplete = productionImage.complete;
  productionImage.complete = false;
  let weaponLookups = 0;
  av.weaponImage = function countProductionWeaponImage(id) {
    assert.equal(id, 'PISTOL', 'adapter requests the exact real action weapon ID');
    // Arena rendering may also ask AV for this weapon while real gameplay
    // advances; count only calls originating in the adapter's art resolver.
    if (new Error().stack.includes('resolveA1WeaponArt')) weaponLookups++;
    return productionWeaponImage(id);
  };
  const suppliedArts = [];
  const setWeaponArt = gold.setWeaponArt;
  gold.setWeaponArt = function captureAcceptedArt(art) {
    if (art) suppliedArts.push(art);
    return setWeaponArt.call(gold, art);
  };
  let a1Draws = 0;
  const drawA1World = gold.drawA1World;
  gold.drawA1World = function countA1Draw(ctx) { a1Draws++; return drawA1World.call(gold, ctx); };
  win.APEX_ARSENAL.weaponApi.equip(foe, 'PISTOL');
  const a1Seq = bus.seq;
  const castResult = HR.pressAbility(mirror, 'A1');
  assert.ok(castResult.ok, 'the real Mirror A1 executor accepts an eligible opponent weapon');
  const castEvent = eventsAfter(a1Seq, 'MirrorA1Cast')[0];
  assert.ok(castEvent, 'real A1 gameplay emits its cast event');
  const a1CastId = castEvent.payload.castId;
  assert.equal(castEvent.payload.weaponId, 'PISTOL');
  assert.equal(weaponLookups, 1, 'the real production AV returns null while its actual image is not ready');
  assert.equal(recordFor(presentation, ct.idx).weaponArtReady, false);
  stepFrames(1);
  assert.equal(weaponLookups, 2, 'later production post-tick retries the null AV result');
  assert.equal(suppliedArts.length, 0, 'not-ready production art is not converted or allocated');
  productionImage.complete = true;
  stepFrames(1);
  gate('A1 real wrapper readiness, null retry, authored bounds and cache are correct', () => {
    assert.equal(weaponLookups, 3);
    assert.equal(suppliedArts.length, 1, 'one accepted wrapper performs one Gold conversion');
    assert.strictEqual(suppliedArts[0].image, productionImage);
    assert.equal(suppliedArts[0].w, authoredWeapon.w);
    assert.equal(suppliedArts[0].h, authoredWeapon.h);
    assert.equal(suppliedArts[0].weaponId, 'PISTOL');
    assert.equal(suppliedArts[0].source, 'production');
    assert.equal(recordFor(presentation, ct.idx).weaponArtReady, true);
    assert.equal(gold.weaponArt().source, 'production');
    assert.equal(gold.weaponArt().weaponId, 'PISTOL');
  });
  stepFrames(30);
  assert.equal(weaponLookups, 3);
  assert.equal(suppliedArts.length, 1, 'steady ticks do not repeat lookup or conversion');
  const view = win.document.getElementById('game-canvas');
  const ctx = view.getContext('2d');
  const drawCountBefore = a1Draws;
  presentation.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' });
  assert.equal(a1Draws, drawCountBefore + 1, 'ready pre-OWN art renders once in the protected world pass');
  let ownEvent = eventsAfter(a1Seq, 'MirrorA1Own')[0] || null;
  for (let i = 0; i < 500 && !ownEvent; i++) {
    stepFrames(1);
    ownEvent = eventsAfter(a1Seq, 'MirrorA1Own')[0] || null;
  }
  assert.ok(ownEvent, 'real Mirror gameplay resolves the authored A1 OWN edge');
  assert.equal(ownEvent.payload.castId, a1CastId);
  const postOwnDrawCount = a1Draws;
  presentation.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' });
  assert.equal(a1Draws, postOwnDrawCount, 'real OWN prevents a duplicate reflected held weapon');
  let endEvent = eventsAfter(a1Seq, 'MirrorA1End')[0] || null;
  for (let i = 0; i < 500 && !endEvent; i++) {
    stepFrames(1);
    endEvent = eventsAfter(a1Seq, 'MirrorA1End')[0] || null;
  }
  assert.ok(endEvent, 'real Mirror gameplay emits the authored A1 end edge');
  assert.equal(gold.A1.on, false);
  assert.equal(gold.weaponArt().source, 'gold-demo-fallback', 'A1 end resets accepted production art');

  // A fresh cast resets its lookup state; one accepted same-ID wrapper is
  // converted once for the new cast, never on every tick.
  bus.emit('MirrorA1Cast', { hero: 'MIRROR', castId: 'r2-wrapper-reset-cast',
    combatantIndex: ct.idx, weaponId: 'PISTOL', whiff: false });
  assert.equal(weaponLookups, 4, 'new cast resets wrapper cache and performs a fresh exact-ID lookup');
  assert.equal(suppliedArts.length, 2);
  bus.emit('MirrorA1End', { hero: 'MIRROR', castId: 'r2-wrapper-reset-cast' });
  presentation.tick(DT);
  av.weaponImage = previousWeaponImage;
  productionImage.complete = imageWasComplete;

  // Finish the naturally formed real node's complete ACTIVE clock and catch a
  // real FOLD substep. Gold must derive, not invent, the fold envelope.
  let foldedVisual = null;
  for (let i = 0; i < 1600 && !foldedVisual; i++) {
    stepFrames(1);
    if (activeNode.st === 3) {
      const proxy = gold.ND.find((node) => node.on);
      if (proxy) foldedVisual = { t3: activeNode.t3, fold: proxy.fold, proxy };
    }
  }
  assert.ok(foldedVisual, 'real 10-second ACTIVE lifetime reaches FOLD');
  gate('real F1 fold visual follows the exact real t3 with canonical Gold easing', () => {
    assert.ok(foldedVisual.t3 >= 0 && foldedVisual.t3 < .55);
    assert.ok(close(foldedVisual.fold, GOLD.sstep(0, .5, foldedVisual.t3)));
    assert.equal(foldedVisual.proxy.st, 3);
    assert.equal(foldedVisual.proxy.fill, 1);
  });
  for (let i = 0; i < 100 && passive.nodes.includes(activeNode); i++) stepFrames(1);
  assert.ok(!passive.nodes.includes(activeNode), 'real F1 fold completion turns the node and five slots OFF');
  assert.equal(gold.externalPassiveAudit().nodeBindings, 0);
  assert.equal(gold.externalPassiveAudit().shardBindings, 0);

  // Refill the actual fixed pool, force the real oldest-FREE replacement law
  // into slot zero, then verify that Gold resets its reused proxy completely.
  for (let i = 0; i < 16; i++) {
    const shard = HR.match.api.mirrorShardProc(ct, 80 + i * 48, 120, 1, null)[0];
    assert.ok(shard);
  }
  presentation.tick(0);
  assert.equal(gold.externalPassiveAudit().shardBindings, 16);
  const targetSlot = 0;
  const oldIdentity = passive.slots[targetSlot];
  const reusedProxy = gold.SH[targetSlot];
  Object.assign(reusedProxy, { ph: 996, repT: 984, side: 'R', pe: 999, pn: 998, ps: 997,
    rot: 8, tx: 991, ty: 990, tlen: 988, twid: 987, dist: 976,
    node: { stale: true }, __externalTravelStarted: true });
  passive.slots[targetSlot].age = 100;
  for (let i = 1; i < 16; i++) passive.slots[i].age = 0;
  const replacement = HR.match.api.mirrorShardProc(ct, 444, 555, 1, null)[0];
  assert.notStrictEqual(replacement, oldIdentity);
  assert.strictEqual(passive.slots[targetSlot], replacement);
  presentation.tick(0);
  gate('real same-slot pool replacement resets Gold proxy sentinels without mutating gameplay truth', () => {
    assert.strictEqual(gold.SH[targetSlot], reusedProxy, 'Gold pool index remains fixed while identity changes');
    assert.equal(reusedProxy.on, true);
    assert.equal(reusedProxy.x, replacement.x);
    assert.equal(reusedProxy.y, replacement.y);
    assert.notEqual(reusedProxy.ph, 996);
    assert.equal(reusedProxy.repT, 0);
    assert.equal(reusedProxy.dsx, .087);
    assert.equal(reusedProxy.dsy, .087);
    assert.equal('dist' in reusedProxy, false);
    assert.equal('node' in reusedProxy, false);
    assert.equal('__externalTravelStarted' in reusedProxy, false);
    assert.strictEqual(passive.slots[targetSlot], replacement);
  });

  // Warm Gold's baked world pass before measuring steady-state allocations.
  presentation.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' });
  const doc = win.document;
  const oldCreateElement = doc.createElement.bind(doc);
  const oldImage = win.Image;
  let canvasAllocations = 0, imageAllocations = 0;
  doc.createElement = function countCanvas(name, ...args) {
    if (String(name).toLowerCase() === 'canvas') canvasAllocations++;
    return oldCreateElement(name, ...args);
  };
  win.Image = new Proxy(oldImage, {
    construct(target, args, newTarget) {
      imageAllocations++;
      return Reflect.construct(target, args, newTarget);
    },
  });
  const beforeSchedulerSteps = presentation.inspect().scheduler.advancedSteps;
  const beforeGoldSteps = gold.externalAudit().steps;
  const beforePassiveSteps = gold.externalPassiveAudit().passiveSteps;
  const beforeCreatedInstances = presentation.inspect().scheduler.createdInstances;
  for (let i = 0; i < 120; i++) presentation.tick(DT);
  doc.createElement = oldCreateElement;
  win.Image = oldImage;
  gate('sustained exact-step allocation and fixed-pool bounds hold for 120 presentation frames', () => {
    assert.equal(presentation.inspect().scheduler.advancedSteps - beforeSchedulerSteps, 120);
    assert.equal(gold.externalAudit().steps - beforeGoldSteps, 120);
    assert.equal(gold.externalPassiveAudit().passiveSteps - beforePassiveSteps, 120);
    assert.equal(presentation.inspect().scheduler.createdInstances, beforeCreatedInstances);
    assert.equal(canvasAllocations, 0);
    assert.equal(imageAllocations, 0);
    assert.equal(gold.SH.length, 16);
    assert.equal(gold.ND.length, 4);
    assert.equal(presentation.inspect().scheduler.errors, 0);
  });

  const adapterSource = fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8');
  gate('shipping adapter has no parallel F1/F2 raw visual authority', () => {
    assert.doesNotMatch(adapterSource, /state\.gold\.(?:SH|ND|PJ)\b/);
    assert.doesNotMatch(adapterSource, /routeBindings|imageOwners|nodeBindings/);
    assert.doesNotMatch(adapterSource, /for\s*\(const n of state\.gold\.ND/);
    assert.match(adapterSource, /syncExternalPassive\(snapshot, HR && HR\.mirrorNode\)/);
    assert.match(adapterSource, /drawExternalPassive\(ctx\)/);
    assert.match(adapterSource, /presentExternalRoute\(route\)/);
  });

  // Starting a real Mirror-v-Mirror match tears down the old adapter instance;
  // independent actual F1 damage must then bind to two disjoint Gold pools.
  const oldGold = gold;
  T.start('MIRROR', 'MIRROR');
  T.holdSpawns();
  assert.equal(oldGold.externalAudit().enabled, false);
  assert.equal(oldGold.externalPassiveAudit().shardBindings, 0);
  const [mirrorA, mirrorB] = H.fighters();
  mirrorA.baseSpeed = 0; mirrorB.baseSpeed = 0;
  mirrorA.x = 180; mirrorA.y = 240; mirrorB.x = 820; mirrorB.y = 740;
  const ctA = HR.byCombatant(mirrorA), ctB = HR.byCombatant(mirrorB);
  stepFrames(1);
  mirrorA.takeDamage(210, null, 'arsenal-PISTOL');
  mirrorB.takeDamage(210, null, 'arsenal-PISTOL');
  presentation.tick(0);
  const goldA = goldInstances.find((instance) => instance.M.id === mirrorA.id);
  const goldB = goldInstances.find((instance) => instance.M.id === mirrorB.id);
  gate('Mirror-v-Mirror real slot snapshots and Gold proxy pools stay owner-isolated', () => {
    assert.ok(goldA && goldB && goldA !== goldB);
    assert.equal(recordFor(presentation, ctA.idx).passive.shardBindings, 5);
    assert.equal(recordFor(presentation, ctB.idx).passive.shardBindings, 5);
    assert.notStrictEqual(ctA.store['mirror.passive'].slots[0], ctB.store['mirror.passive'].slots[0]);
    assert.notStrictEqual(goldA.SH[0], goldB.SH[0]);
    assert.equal(goldA.SH[0].x, ctA.store['mirror.passive'].slots[0].x);
    assert.equal(goldB.SH[0].x, ctB.store['mirror.passive'].slots[0].x);
    assert.notEqual(goldA.SH[0].x, goldB.SH[0].x);
  });

  bus.emit('ReworkMatchTeardown', {});
  gate('real teardown clears all Gold semantic pools, routes, wrapper art and instances', () => {
    assert.equal(presentation.inspect().instanceCount, 0);
    for (const instance of goldInstances) {
      assert.equal(instance.externalAudit().enabled, false);
      const audit = instance.externalPassiveAudit();
      assert.equal(audit.shardBindings, 0);
      assert.equal(audit.nodeBindings, 0);
      assert.equal(audit.routes, 0);
      assert.equal(audit.imageOwners, 0);
      assert.equal(audit.goldProjectiles, 0);
      assert.equal(instance.weaponArt().source, 'gold-demo-fallback');
    }
  });

  assert.equal(gateCount, 15);
  console.log(`Mirror R2 semantic migration real-harness gates: ${gateCount}/${gateCount} passed`);
} finally {
  H.dom.window.close();
}
