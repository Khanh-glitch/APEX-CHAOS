#!/usr/bin/env node
/* H1 — live-root Gold body calibration and production post-held-weapon order.
 *
 * Runs the shipping Arsenal Quest renderer through bootHarness. The focused
 * visual probes use real AV.weaponImage wrappers for PISTOL, AK_47, and
 * SHOTGUN, while accepted presentation events advance only Gold's production
 * fixed-step bridge. Separate real-gameplay cases cover fighter order,
 * Mirror-v-Mirror, custom Crystal bodies, and a dead opponent.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
const GOLD = win.APEX_MIRROR_GOLD;
const AV = win.APEX_ARSENAL_AV;
const W = win.APEX_ARSENAL.weaponApi;
const bus = win.APEX_HERO_REWORK_AIL.bus;
const PRESENTATION = win.APEX_MIRROR_PRESENTATION;
const FIXED_STEP = 1 / 120;
const GOLD_REF_RADIUS = 34;
const GOLD_SHA256 = 'c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205';
const WEAPON_IDS = ['PISTOL', 'AK_47', 'SHOTGUN'];
const captureDir = process.env.H1_CAPTURE_DIR ? path.resolve(process.env.H1_CAPTURE_DIR) : null;

let checks = 0;
let frameEvents = null;
let suppressA1Pixels = false;
let crystalProbe = false;
const createdGold = [];
const artReceipts = [];
const crystalCalls = [];
const weaponWrappers = new Map();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const close = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;

function gate(name, details = undefined) {
  checks++;
  console.log(`PASS H1-${String(checks).padStart(2, '0')} ${name}${details === undefined ? '' : ` — ${JSON.stringify(details)}`}`);
}
function record(event) {
  if (frameEvents) frameEvents.push({ ...event, frame: win.__apexRenderFrame });
}
function matrixOf(ctx) {
  if (!ctx || typeof ctx.getTransform !== 'function') return null;
  const m = ctx.getTransform();
  return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f };
}
function mapPoint(m, x, y) {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}
function expectUniformScale(m, k, label) {
  assert.ok(m, `${label}: canvas transform is available`);
  assert.ok(close(m.a, k) && close(m.d, k) && close(m.b, 0) && close(m.c, 0),
    `${label}: expected uniform body scale ${k}, got ${JSON.stringify(m)}`);
}
function expectIdentity(m, label) {
  assert.ok(m && close(m.a, 1) && close(m.d, 1) && close(m.b, 0) && close(m.c, 0)
    && close(m.e, 0) && close(m.f, 0), `${label}: expected unscaled world transform, got ${JSON.stringify(m)}`);
}
function bodySnapshot(fighters) {
  return fighters.map((f) => ({ id: f.id, x: f.x, y: f.y, radius: f.radius,
    hp: f.hp, maxHp: f.maxHp, vx: f.vx, vy: f.vy }));
}
function actorName(f) {
  const ct = HR.byCombatant(f);
  return ct && ct.heroId || (f.type && f.type.name) || String(f.id);
}
function assertBodyScaleDiagnostics(mirror, context) {
  const record = PRESENTATION.inspect().records.find((row) => row.mirrorId === mirror.id);
  assert.ok(record, `${context}: live Mirror diagnostic exists`);
  const expected = mirror.radius / GOLD_REF_RADIUS;
  assert.equal(record.fighterRadius, mirror.radius);
  assert.equal(record.goldMirrorRadius, GOLD_REF_RADIUS);
  assert.equal(record.bodyVisualMultiplier, 1.00);
  assert.equal(record.bodyK, expected);
  gate(`${context}: live radius / Gold 34, multiplier 1.00`, {
    radius: mirror.radius, goldRadius: record.goldMirrorRadius,
    multiplier: record.bodyVisualMultiplier, bodyK: record.bodyK,
  });
  return expected;
}
function goldFor(mirror) {
  const gold = createdGold.find((item) => item.externalTruth && item.M.id === mirror.id);
  assert.ok(gold, `live Gold instance for ${mirror.id}`);
  return gold;
}
function startMatch(p1, p2) {
  HR.setAiEnabled(false);
  T.start(p1, p2);
  T.holdSpawns();
  HR.setAiEnabled(false);
  const fighters = H.fighters();
  assert.equal(fighters.length, 2, 'H1 fixtures use the real two-fighter match');
  const positions = [{ x: 320, y: 500 }, { x: 680, y: 500 }];
  for (let i = 0; i < fighters.length; i++) {
    const f = fighters[i];
    f.baseSpeed = 0;
    f.vx = 0; f.vy = 0;
    f.x = positions[i].x; f.y = positions[i].y;
    if (f.dir) { f.dir.x = i === 0 ? 1 : -1; f.dir.y = 0; }
  }
  // Deterministic view for real raster and transform checks; no gameplay clock
  // or camera timing is changed by this test fixture.
  win.eval('cameraShake = 0; cameraZoom = 1;');
  win.__apexCameraView = { shakeX: 0, shakeY: 0, zoom: 1 };
  return { fighters, mirrors: fighters.filter((f) => HR.byCombatant(f)?.heroId === 'MIRROR') };
}
function equip(fighter, weaponId) {
  const result = W.equip(fighter, weaponId);
  const holder = W.getHolder(fighter);
  assert.ok(holder && holder.weaponId === weaponId,
    `real Arsenal equip ${weaponId} on ${fighter.id}: ${JSON.stringify(result)}`);
  return holder;
}
function lookupA1Record(mirror) {
  return PRESENTATION.inspect().records.find((row) => row.mirrorId === mirror.id);
}
function castRealA1(mirror, weaponId) {
  const before = bus.ring.length;
  const result = HR.pressAbility(mirror, 'A1');
  assert.ok(result && result.ok, `real gameplay A1 cast for ${actorName(mirror)}: ${JSON.stringify(result)}`);
  const event = bus.ring.slice(before).find((row) => row.type === 'MirrorA1Cast');
  assert.ok(event, 'real MirrorA1Cast edge was emitted');
  assert.equal(event.payload.weaponId, weaponId);
  return event.payload.castId;
}
function castPresentationA1(mirror, weaponId, castId) {
  bus.emit('MirrorA1Cast', {
    hero: 'MIRROR', castId,
    combatantIndex: HR.byCombatant(mirror).idx,
    weaponId, whiff: false,
  });
  // A zero-delta production tick binds the accepted edge and real image but
  // does not advance choreography. Later fixed steps run Gold without moving
  // or advancing the real gameplay fighters in the silhouette comparison.
  PRESENTATION.tick(0);
}
function stepPresentation(seconds) {
  const frames = Math.round(seconds / FIXED_STEP);
  for (let i = 0; i < frames; i++) PRESENTATION.tick(FIXED_STEP);
}
async function preloadWeapon(weaponId) {
  const started = Date.now();
  let wrapper = AV.weaponImage(weaponId);
  while (!(wrapper && wrapper.img && wrapper.img.complete && wrapper.img.width > 0
      && wrapper.w > 0 && wrapper.h > 0) && Date.now() - started < 8000) {
    await wait(25);
    wrapper = AV.weaponImage(weaponId);
  }
  assert.ok(wrapper && wrapper.img && wrapper.img.complete && wrapper.img.width > 0,
    `real Arsenal weapon art becomes ready for ${weaponId}`);
  assert.ok(Number.isFinite(wrapper.w) && wrapper.w > 0
    && Number.isFinite(wrapper.h) && wrapper.h > 0,
    `real weaponImage(${weaponId}) retains authored wrapper bounds`);
  weaponWrappers.set(weaponId, wrapper);
  return wrapper;
}
function readPixels() {
  const ctx = H.gameCanvasReal.getContext('2d');
  return ctx.getImageData(0, 0, H.gameCanvasReal.width, H.gameCanvasReal.height).data.slice();
}
function a1Mask(off, on) {
  const width = H.gameCanvasReal.width, height = H.gameCanvasReal.height;
  const mask = new Uint8Array(width * height);
  let count = 0, minX = width, minY = height, maxX = -1, maxY = -1;
  for (let p = 0, q = 0; p < mask.length; p++, q += 4) {
    const delta = Math.max(Math.abs(off[q] - on[q]), Math.abs(off[q + 1] - on[q + 1]),
      Math.abs(off[q + 2] - on[q + 2]), Math.abs(off[q + 3] - on[q + 3]));
    if (delta > 8) {
      mask[p] = 1; count++;
      const x = p % width, y = Math.floor(p / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { mask, count, bounds: count ? { minX, minY, maxX, maxY } : null };
}
function maskDistance(a, b) {
  let different = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) different++;
  return different;
}
function renderFrame({ suppressA1 = false } = {}) {
  const fighters = H.fighters();
  const beforeBodies = bodySnapshot(fighters);
  frameEvents = [];
  suppressA1Pixels = suppressA1;
  try {
    T.redraw();
    const events = frameEvents.slice();
    const pixels = readPixels();
    const png = captureDir ? H.gameCanvasReal.toBuffer('image/png') : null;
    assert.deepEqual(bodySnapshot(fighters), beforeBodies,
      'rendering changes no real fighter position, radius, velocity, or health');
    return { events, pixels, png };
  } finally {
    frameEvents = null;
    suppressA1Pixels = false;
  }
}
function assertRenderOrder(events, expectedFighters, expectedMirrorIds, label, { requireHeld = true } = {}) {
  const starts = events.filter((e) => e.kind === 'body-start').map((e) => e.actorId);
  const ends = events.filter((e) => e.kind === 'body-end').map((e) => e.actorId);
  const expectedIds = Array.from(expectedFighters, (f) => f.id);
  assert.deepEqual(starts, expectedIds, `${label}: each living fighter enters draw once in engine order`);
  assert.deepEqual(ends, expectedIds, `${label}: each living fighter completes draw once`);
  const bodyEndAt = events.reduce((last, event, i) => event.kind === 'body-end' ? i : last, -1);
  const heldAt = events.map((event, i) => event.kind === 'held-weapon' ? i : -1).filter((i) => i >= 0);
  const a1At = events.map((event, i) => event.kind === 'a1-world' ? i : -1).filter((i) => i >= 0);
  const passiveAt = events.map((event, i) => event.kind === 'passive-world' ? i : -1).filter((i) => i >= 0);
  assert.equal(a1At.length, expectedMirrorIds.length,
    `${label}: A1World is dispatched exactly once per eligible Mirror`);
  if (requireHeld) assert.ok(heldAt.length > 0, `${label}: at least one real held weapon is drawn`);
  if (heldAt.length) {
    assert.ok(bodyEndAt < heldAt[0], `${label}: all fighter bodies precede the held-weapon pass`);
    assert.ok(Math.max(...heldAt) < a1At[0], `${label}: every real held weapon precedes A1World`);
  } else {
    assert.ok(bodyEndAt < a1At[0], `${label}: A1World follows all live fighter bodies`);
  }
  if (passiveAt.length) assert.ok(Math.max(...passiveAt) < events.findIndex((e) => e.kind === 'body-start'),
    `${label}: free passive world geometry stays in its existing pre-fighter seam`);
  const actualMirrorIds = events.filter((e) => e.kind === 'a1-world').map((e) => e.mirrorId).sort();
  assert.deepEqual(actualMirrorIds, Array.from(expectedMirrorIds).sort(), `${label}: expected Mirror instance ownership`);
  gate(`${label}: body → real held weapon → one A1World`, {
    bodies: starts.map((id) => id), heldWeaponDraws: heldAt.length, a1WorldDraws: a1At.length,
  });
}
function assertBodyMatrices(events, mirrors, label, { requireA1 = true } = {}) {
  for (const mirror of mirrors) {
    const k = mirror.radius / GOLD_REF_RADIUS;
    const body = events.find((e) => e.kind === 'mirror-body' && e.mirrorId === mirror.id);
    const overlay = events.find((e) => e.kind === 'a1-world' && e.mirrorId === mirror.id);
    assert.ok(body, `${label}: Mirror Gold body draw observed for ${mirror.id}`);
    if (requireA1) assert.ok(overlay, `${label}: A1World draw observed for ${mirror.id}`);
    for (const [name, item] of [['body', body], ...(overlay ? [['A1World', overlay]] : [])]) {
      expectUniformScale(item.matrix, k, `${label} ${name} ${mirror.id}`);
      const root = mapPoint(item.matrix, item.root.x, item.root.y);
      assert.ok(close(root.x, item.root.x, 1e-3) && close(root.y, item.root.y, 1e-3),
        `${label} ${name}: scale center expected ${JSON.stringify(item.root)}, got ${JSON.stringify(root)} from ${JSON.stringify(item.matrix)}`);
    }
  }
}
function activeGolds() { return createdGold.filter((gold) => gold.externalTruth); }

const sourceFiles = {
  adapter: fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8'),
  arsenal: fs.readFileSync('public/game/modes/arsenalQuestRuntime.js', 'utf8'),
  gold: fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js', 'utf8'),
  manifest: fs.readFileSync('src/game/runtimeManifest.js', 'utf8'),
  revisionLock: JSON.parse(fs.readFileSync('tools/runtimeRevision.lock.json', 'utf8')),
};

const originalCreateGold = GOLD.createMirrorInstance;
GOLD.createMirrorInstance = function captureGoldInstance(options) {
  const gold = originalCreateGold.call(GOLD, options);
  createdGold.push(gold);
  const drawMirrorBody = gold.drawMirrorEntityWithOpponent;
  gold.drawMirrorEntityWithOpponent = function recordMirrorBody(ctx, ...args) {
    record({ kind: 'mirror-body', mirrorId: gold.M.id,
      root: { x: gold.M.x, y: gold.M.y }, matrix: matrixOf(ctx) });
    return drawMirrorBody.call(this, ctx, ...args);
  };
  const drawA1World = gold.drawA1World;
  gold.drawA1World = function recordA1World(ctx, ...args) {
    record({ kind: 'a1-world', mirrorId: gold.M.id,
      root: { x: gold.M.x, y: gold.M.y }, matrix: matrixOf(ctx), u: gold.A1.u });
    if (suppressA1Pixels) return false;
    return drawA1World.call(this, ctx, ...args);
  };
  const drawPassive = gold.drawExternalPassive;
  gold.drawExternalPassive = function recordPassiveWorld(ctx, ...args) {
    record({ kind: 'passive-world', mirrorId: gold.M.id, matrix: matrixOf(ctx) });
    return drawPassive.call(this, ctx, ...args);
  };
  const setWeaponArt = gold.setWeaponArt;
  gold.setWeaponArt = function captureWeaponArt(art, ...args) {
    if (art) artReceipts.push({ mirrorId: gold.M.id, image: art.image, w: art.w, h: art.h,
      weaponId: art.weaponId, source: art.source });
    return setWeaponArt.call(this, art, ...args);
  };
  return gold;
};

const fighterPrototype = win.Fighter.prototype;
const originalFighterDraw = fighterPrototype.draw;
fighterPrototype.draw = function recordFighterDraw(ctx) {
  record({ kind: 'body-start', actorId: this.id, heroId: actorName(this) });
  const result = originalFighterDraw.call(this, ctx);
  record({ kind: 'body-end', actorId: this.id, heroId: actorName(this) });
  return result;
};
const originalEquippedDraw = AV.drawEquippedWeapon;
AV.drawEquippedWeapon = function recordEquippedWeapon(ctx, fighter, holder, ...args) {
  record({ kind: 'held-weapon', actorId: fighter && fighter.id,
    weaponId: holder && holder.weaponId, matrix: matrixOf(ctx) });
  return originalEquippedDraw.call(this, ctx, fighter, holder, ...args);
};
const crystalGold = win.APEX_CRYSTALA_GOLD;
const originalCrystalDraw = crystalGold.drawCrystala;
crystalGold.drawCrystala = function recordCrystalDraw(ctx, hero, emissive, ...args) {
  if (crystalProbe) crystalCalls.push({ emissive: !!emissive, matrix: matrixOf(ctx) });
  return originalCrystalDraw.call(this, ctx, hero, emissive, ...args);
};

try {
  const goldHtml = fs.readFileSync('docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html');
  const goldSha = crypto.createHash('sha256').update(goldHtml).digest('hex');
  assert.equal(goldSha, GOLD_SHA256, 'canonical Gold source remains byte-identical');
  assert.equal(sourceFiles.revisionLock.revision, '20261002-mirror-v1-r29',
    'the locked r29 revision identifies the H1 visual playtest candidate');
  assert.match(sourceFiles.manifest, /20261002-mirror-v1-r29/);
  assert.match(sourceFiles.gold, /const A1TS=1\.6/);
  const drawForegroundAt = sourceFiles.arsenal.indexOf('function drawForeground() {');
  const drawForegroundEnd = sourceFiles.arsenal.indexOf('function muteArenaGlyphs(c)', drawForegroundAt);
  const drawForegroundSource = sourceFiles.arsenal.slice(drawForegroundAt, drawForegroundEnd);
  const residueAt = drawForegroundSource.indexOf('renderPostFighterResidue?.(ctx)');
  const heldAt = drawForegroundSource.indexOf('drawEquippedWeapons(ctx)');
  const mirrorPostAt = drawForegroundSource.indexOf('renderPostFighters?.(ctx)');
  const vfxAt = drawForegroundSource.indexOf('weaponApi.drawArsenalVisuals(ctx)');
  assert.ok(drawForegroundAt >= 0 && drawForegroundEnd > drawForegroundAt
    && residueAt >= 0 && heldAt > residueAt && mirrorPostAt > heldAt && vfxAt > mirrorPostAt,
    'the shipped foreground seam is A2 residue → real held weapons → A1World → Arsenal VFX');
  const worldAt = sourceFiles.adapter.indexOf('function renderArenaWorldEffects');
  const postAt = sourceFiles.adapter.indexOf('function renderPostFighters', worldAt);
  const worldPass = sourceFiles.adapter.slice(worldAt, postAt);
  assert.doesNotMatch(worldPass, /drawA1World/,
    'the pre-fighter world seam owns no A1World draw');
  assert.match(worldPass, /!hasArsenalForeground\(\)[\s\S]*drawScaledA2Residue/,
    'non-Arsenal modes retain their prior A2 residue seam, calibrated to body scale');
  assert.match(worldPass, /drawExternalPassive\(ctx\)/,
    'free F1/F2 passive world content retains its original unscaled world seam');
  gate('canonical Gold unchanged, r29 candidate locked, and production layer insertion is exact', {
    canonicalGoldSha256: goldSha, revision: sourceFiles.revisionLock.revision,
    foregroundOrder: ['fighter bodies', 'A2 residue', 'real held weapons', 'A1World'],
  });

  for (const weaponId of WEAPON_IDS) {
    const wrapper = await preloadWeapon(weaponId);
    gate(`production weaponImage(${weaponId}) is ready with authored bounds`, {
      width: wrapper.w, height: wrapper.h, imageWidth: wrapper.img.width, imageHeight: wrapper.img.height,
    });
  }

  // Three actual Arsenal silhouettes. The accepted cast edge is injected only
  // for these render-only comparisons so automatic opponent firing cannot
  // disturb the identical on/off pixels; art and held-weapon rendering are
  // still the real production Arsenal implementations.
  const silhouetteMasks = new Map();
  const phaseMasks = {};
  for (const weaponId of WEAPON_IDS) {
    const { fighters, mirrors } = startMatch('MIRROR', 'ROBOT');
    const [mirror, opponent] = fighters;
    equip(opponent, weaponId);
    const gold = goldFor(mirror);
    const artWrapper = weaponWrappers.get(weaponId);
    const castId = `h1-visual-${weaponId}`;
    castPresentationA1(mirror, weaponId, castId);
    assert.ok(lookupA1Record(mirror)?.weaponArtReady,
      `${weaponId}: production wrapper converted into Gold art`);
    assert.equal(gold.weaponArt().source, 'production');
    assert.equal(gold.weaponArt().weaponId, weaponId);
    const accepted = artReceipts.filter((receipt) => receipt.mirrorId === mirror.id
      && receipt.weaponId === weaponId && receipt.source === 'production');
    assert.equal(accepted.length, 1, `${weaponId}: one production wrapper conversion`);
    assert.strictEqual(accepted[0].image, artWrapper.img,
      `${weaponId}: Gold receives the exact real Arsenal Image object`);
    assert.equal(accepted[0].w, artWrapper.w, `${weaponId}: authored wrapper width preserved`);
    assert.equal(accepted[0].h, artWrapper.h, `${weaponId}: authored wrapper height preserved`);
    gate(`${weaponId}: real production art reaches Gold without bounds/identity changes`, {
      weaponId, source: gold.weaponArt().source, w: accepted[0].w, h: accepted[0].h,
    });

    const bodyScale = assertBodyScaleDiagnostics(mirror, `${weaponId} visual fixture`);
    const phaseRows = [
      { name: 'attached', time: 0.25, check: () => close(gold.A1.q, 0) && close(gold.A1.tr, 0) },
      { name: 'peel', time: 0.60, check: () => gold.A1.q > 0.5 && gold.A1.tr < 0.05 },
      { name: 'reform', time: 0.80, check: () => gold.A1.q > 0.99 && gold.A1.tr > 0.4 },
    ];
    let elapsed = 0;
    const masksForWeapon = {};
    for (const phase of phaseRows) {
      stepPresentation(phase.time - elapsed);
      elapsed = phase.time;
      assert.ok(gold.A1.on && gold.A1.u >= 0.1 && !lookupA1Record(mirror).realOwn,
        `${weaponId}/${phase.name}: A1 remains active and pre-OWN`);
      assert.ok(phase.check(),
        `${weaponId}/${phase.name}: canonical q/tr stage, got q=${gold.A1.q}, tr=${gold.A1.tr}`);
      assert.ok(close(gold.A1.u, phase.time / 1.6, 0.01),
        `${weaponId}/${phase.name}: canonical A1TS=1.6 progression`);
      const expectedActors = fighters.slice();
      const withNoA1 = renderFrame({ suppressA1: true });
      const withA1 = renderFrame();
      assertRenderOrder(withA1.events, expectedActors, [mirror.id], `${weaponId}/${phase.name}`, { requireHeld: true });
      assertBodyMatrices(withA1.events, mirrors, `${weaponId}/${phase.name}`);
      const mask = a1Mask(withNoA1.pixels, withA1.pixels);
      assert.ok(mask.count > 80,
        `${weaponId}/${phase.name}: reflected production silhouette changes enough real canvas pixels (${mask.count})`);
      masksForWeapon[phase.name] = mask.mask;
      if (phase.name === 'attached') {
        silhouetteMasks.set(weaponId, mask.mask);
        if (captureDir) {
          fs.mkdirSync(captureDir, { recursive: true });
          fs.writeFileSync(path.join(captureDir, `${weaponId}-attached.png`), withA1.png);
          fs.writeFileSync(path.join(captureDir, `${weaponId}-attached-off.png`), withNoA1.png);
        }
      }
      if (phase.name === 'attached' || phase.name === 'peel' || phase.name === 'reform') {
        phaseMasks[`${weaponId}-${phase.name}`] = mask.mask;
      }
      gate(`${weaponId}/${phase.name}: plate-clipped A1 pixels render in canonical stage`, {
        q: +gold.A1.q.toFixed(4), tr: +gold.A1.tr.toFixed(4),
        u: +gold.A1.u.toFixed(4), changedPixels: mask.count, bounds: mask.bounds,
      });
      assert.equal(bodyScale, mirror.radius / GOLD_REF_RADIUS,
        `${weaponId}: scale law continues to use the unchanged live fighter radius`);
    }
    assert.ok(maskDistance(masksForWeapon.attached, masksForWeapon.peel) > 160,
      `${weaponId}: peel changes the rendered production silhouette, not just pass order`);
    assert.ok(maskDistance(masksForWeapon.peel, masksForWeapon.reform) > 160,
      `${weaponId}: outward reform changes the rendered production silhouette`);
    gate(`${weaponId}: attached → peel → reform geometry visibly advances`, {
      attachedToPeelChanged: maskDistance(masksForWeapon.attached, masksForWeapon.peel),
      peelToReformChanged: maskDistance(masksForWeapon.peel, masksForWeapon.reform),
    });
  }
  for (const [a, b] of [['PISTOL', 'AK_47'], ['PISTOL', 'SHOTGUN'], ['AK_47', 'SHOTGUN']]) {
    const distance = maskDistance(silhouetteMasks.get(a), silhouetteMasks.get(b));
    assert.ok(distance > 100, `${a} and ${b} production A1 silhouettes remain distinct (${distance})`);
    gate(`production A1 silhouettes stay distinct: ${a} vs ${b}`, { changedMaskPixels: distance });
  }

  // Real gameplay edge: Mirror in fighter slot 0 against custom Crystal body.
  {
    const { fighters, mirrors } = startMatch('MIRROR', 'CRYSTAL');
    const [mirror, crystal] = fighters;
    equip(crystal, 'PISTOL');
    const castId = castRealA1(mirror, 'PISTOL');
    T.step(0.25, FIXED_STEP);
    assert.ok(goldFor(mirror).A1.on, 'real gameplay cast advanced into pre-OWN A1');
    const bodyScale = assertBodyScaleDiagnostics(mirror, 'fighter slot 0 / Crystal opponent');
    crystalProbe = true;
    const cryptoStart = crystalCalls.length;
    const frame = renderFrame();
    crystalProbe = false;
    assertRenderOrder(frame.events, fighters, [mirror.id], 'real A1, Mirror fighter 0 vs custom Crystal', { requireHeld: true });
    assertBodyMatrices(frame.events, mirrors, 'real A1, Mirror fighter 0 vs custom Crystal');
    const crystalFrameCalls = crystalCalls.slice(cryptoStart);
    assert.equal(crystalFrameCalls.filter((call) => !call.emissive).length, 1,
      'Crystala authoritative custom body renders once');
    assert.equal(crystalFrameCalls.filter((call) => call.emissive).length, 1,
      'Crystala bloom/post-body Gold source renders once');
    assert.deepEqual(crystalFrameCalls.map((call) => call.matrix.a).sort(), [0.5, 1],
      'Crystal actor and its half-resolution bloom keep their own unscaled presentation transforms');
    assert.ok(crystalFrameCalls.every((call) => !close(call.matrix.a, bodyScale)),
      'Mirror body scale does not leak into the custom Crystal body or bloom context');
    gate('Crystala custom body and bloom hooks remain once-only in fighter slot 0', {
      bodyDraws: crystalFrameCalls.filter((call) => !call.emissive).length,
      bloomDraws: crystalFrameCalls.filter((call) => call.emissive).length,
      castId,
    });
    const frameToken = win.__apexRenderFrame;
    const a1Count = frame.events.filter((e) => e.kind === 'a1-world').length;
    const duplicate = PRESENTATION.renderPostFighters(win.document.getElementById('game-canvas').getContext('2d'));
    assert.equal(duplicate, false, 'a second same-frame post-fighter dispatch is rejected');
    assert.equal(frameEvents, null);
    assert.equal(win.__apexRenderFrame, frameToken);
    assert.equal(a1Count, 1);
    gate('real A1 postpass is once-only for one render-frame token', { frame: frameToken, a1WorldDraws: a1Count });
    assert.equal(bodyScale, mirror.radius / GOLD_REF_RADIUS);
  }

  // Real gameplay edge with Mirror in fighter slot 1. The custom Crystala draw
  // runs before Mirror, while its owned post-world hooks still run only once.
  {
    const { fighters, mirrors } = startMatch('CRYSTAL', 'MIRROR');
    const [crystal, mirror] = fighters;
    equip(crystal, 'PISTOL');
    const castId = castRealA1(mirror, 'PISTOL');
    T.step(0.25, FIXED_STEP);
    const bodyScale = assertBodyScaleDiagnostics(mirror, 'fighter slot 1 / custom Crystal opponent');
    crystalProbe = true;
    const cryptoStart = crystalCalls.length;
    const frame = renderFrame();
    crystalProbe = false;
    assertRenderOrder(frame.events, fighters, [mirror.id], 'real A1, Mirror fighter 1 vs custom Crystal', { requireHeld: true });
    assertBodyMatrices(frame.events, mirrors, 'real A1, Mirror fighter 1 vs custom Crystal');
    const crystalFrameCalls = crystalCalls.slice(cryptoStart);
    assert.equal(crystalFrameCalls.filter((call) => !call.emissive).length, 1,
      'slot-0 Crystala custom body renders once');
    assert.equal(crystalFrameCalls.filter((call) => call.emissive).length, 1,
      'slot-1 Mirror does not duplicate Crystal bloom hooks');
    gate('Crystala custom body and bloom hooks remain once-only in fighter slot 1', {
      bodyDraws: crystalFrameCalls.filter((call) => !call.emissive).length,
      bloomDraws: crystalFrameCalls.filter((call) => call.emissive).length,
      castId,
    });
    assert.equal(bodyScale, mirror.radius / GOLD_REF_RADIUS);
  }

  // Mirror-v-Mirror: two independent Gold bodies and two A1 overlays, all
  // behind both real held-weapon draws, never one per actor hook chain.
  {
    const { fighters, mirrors } = startMatch('MIRROR', 'MIRROR');
    const [mirror0, mirror1] = fighters;
    equip(mirror0, 'PISTOL'); equip(mirror1, 'AK_47');
    castRealA1(mirror0, 'AK_47'); castRealA1(mirror1, 'PISTOL');
    T.step(0.25, FIXED_STEP);
    assert.equal(PRESENTATION.inspect().instanceCount, 2);
    const frame = renderFrame();
    assertRenderOrder(frame.events, fighters, mirrors.map((f) => f.id), 'Mirror-v-Mirror real A1', { requireHeld: true });
    assertBodyMatrices(frame.events, mirrors, 'Mirror-v-Mirror real A1');
    assert.equal(frame.events.filter((e) => e.kind === 'mirror-body').length, 2,
      'each Mirror body draws exactly once');
    gate('Mirror-v-Mirror keeps two isolated once-only Gold body/overlay owners', {
      bodies: frame.events.filter((e) => e.kind === 'mirror-body').length,
      overlays: frame.events.filter((e) => e.kind === 'a1-world').length,
      held: frame.events.filter((e) => e.kind === 'held-weapon').length,
    });
  }

  // One dead opponent: the surviving Mirror still gets one post-held-weapon
  // overlay after the only body that remains in the live actor pass.
  {
    const { fighters, mirrors } = startMatch('MIRROR', 'ROBOT');
    const [mirror, opponent] = fighters;
    equip(mirror, 'PISTOL'); equip(opponent, 'AK_47');
    castRealA1(mirror, 'AK_47');
    T.step(0.25, FIXED_STEP);
    opponent.hp = 0;
    const frame = renderFrame();
    const living = fighters.filter((fighter) => fighter.hp > 0);
    assertRenderOrder(frame.events, living, [mirror.id], 'one-dead opponent / surviving Mirror', { requireHeld: true });
    assertBodyMatrices(frame.events, mirrors, 'one-dead opponent / surviving Mirror');
    assert.equal(frame.events.filter((e) => e.kind === 'body-start' && e.actorId === opponent.id).length, 0,
      'dead opponent contributes no fighter body draw');
    gate('one-dead frame retains one postpass after the surviving body and held art', {
      livingBodies: living.length, a1WorldDraws: frame.events.filter((e) => e.kind === 'a1-world').length,
    });
  }

  // A2 residue is rendered with only the Mirror silhouette scaled around its
  // authored PRE-exchange root; the opponent echo and passive world seam stay
  // in unscaled world coordinates.
  {
    const { fighters, mirrors } = startMatch('MIRROR', 'ROBOT');
    const [mirror, opponent] = fighters;
    equip(mirror, 'PISTOL'); equip(opponent, 'AK_47');
    const gold = goldFor(mirror);
    const cast = HR.pressAbility(mirror, 'A2');
    assert.ok(cast && cast.ok, `real Mirror A2 accepted: ${JSON.stringify(cast)}`);
    T.step(0.32, FIXED_STEP);
    assert.ok(gold.A2.res > 0, `real A2 leaves canonical post-snap residue (${gold.A2.res})`);
    const residueMirror = [], residueFoe = [];
    let residueEcho = null;
    const oldStrips = gold.strips;
    const oldRigFull = gold.rigFull;
    const oldFoeReal = gold.foeReal;
    gold.strips = function auditResidueStrip(ctx, x, y, radius, off, drawEcho) {
      const a2 = gold.A2;
      const next = close(x, a2.rx) && close(y, a2.ry) ? 'mirror' : 'foe';
      record({ kind: 'a2-residue', mirrorId: mirror.id, echo: next });
      const wrapped = function () {
        const previous = residueEcho;
        residueEcho = next;
        try { return drawEcho(); } finally { residueEcho = previous; }
      };
      return oldStrips.call(this, ctx, x, y, radius, off, wrapped);
    };
    gold.rigFull = function auditResidueMirror(ctx, x, y) {
      if (residueEcho === 'mirror') residueMirror.push({ root: { x, y }, matrix: matrixOf(ctx) });
      return oldRigFull.call(this, ctx, x, y);
    };
    gold.foeReal = function auditResidueFoe(ctx, x, y) {
      if (residueEcho === 'foe') residueFoe.push({ root: { x, y }, matrix: matrixOf(ctx) });
      return oldFoeReal.call(this, ctx, x, y);
    };
    const frame = renderFrame();
    gold.strips = oldStrips; gold.rigFull = oldRigFull; gold.foeReal = oldFoeReal;
    const bodyEndAt = frame.events.reduce((last, event, index) => event.kind === 'body-end' ? index : last, -1);
    const residueAt = frame.events.map((event, index) => event.kind === 'a2-residue' ? index : -1).filter((index) => index >= 0);
    const heldAt = frame.events.map((event, index) => event.kind === 'held-weapon' ? index : -1).filter((index) => index >= 0);
    assert.equal(residueAt.length, 2, 'Mirror and opponent Gold residue echoes each render once');
    assert.equal(heldAt.length, 2, 'both real held weapons are present for the A2 order fixture');
    assert.ok(bodyEndAt >= 0 && residueAt[0] > bodyEndAt && Math.max(...residueAt) < Math.min(...heldAt),
      'production preserves body → A2 residue → real held weapons');
    const duplicateResidue = PRESENTATION.renderPostFighterResidue(win.document.getElementById('game-canvas').getContext('2d'));
    assert.equal(duplicateResidue, false, 'A2 residue pass is once-only for the render-frame token');
    assert.equal(residueMirror.length, 2, 'duplicate residue dispatch does not redraw the Mirror echo');
    const k = mirror.radius / GOLD_REF_RADIUS;
    assert.equal(residueMirror.length, 2, 'Gold Mirror residue echo is sliced into its two authored strips');
    assert.equal(residueFoe.length, 2, 'Gold opponent residue echo retains its two authored strips');
    for (const echo of residueMirror) expectUniformScale(echo.matrix, k, 'A2 Mirror residue silhouette');
    for (const echo of residueFoe) expectUniformScale(echo.matrix, 1, 'A2 opponent residue world echo');
    const mirrorCenters = residueMirror.map((echo) => mapPoint(echo.matrix, echo.root.x, echo.root.y));
    const foeCenters = residueFoe.map((echo) => mapPoint(echo.matrix, echo.root.x, echo.root.y));
    assert.ok(close((mirrorCenters[0].x + mirrorCenters[1].x) / 2, gold.A2.rx, 1e-3)
      && close((mirrorCenters[0].y + mirrorCenters[1].y) / 2, gold.A2.ry, 1e-3),
      'scaled Mirror residue strips retain their authored mean root');
    assert.ok(close((foeCenters[0].x + foeCenters[1].x) / 2, gold.A2.fx, 1e-3)
      && close((foeCenters[0].y + foeCenters[1].y) / 2, gold.A2.fy, 1e-3),
      'opponent residue strips retain their exact authored world root');
    const passive = frame.events.filter((e) => e.kind === 'passive-world');
    assert.equal(passive.length, 1, 'real F1/F2 Gold passive routing still owns the world seam once');
    expectIdentity(passive[0].matrix, 'F1/F2 passive world geometry');
    assertBodyMatrices(frame.events, mirrors, 'A2 residue / passive-world scale isolation', { requireA1: false });
    gate('A2 residue scales only Mirror body art; opponent and passive geometry remain world-space', {
      layerOrder: ['fighter bodies', 'Mirror/opponent residue', 'real held weapons'],
      mirrorScale: k, mirrorEchoRoot: { x: gold.A2.rx, y: gold.A2.ry },
      opponentScale: 1, opponentEchoRoot: { x: gold.A2.fx, y: gold.A2.fy },
      passiveWorldMatrix: passive[0].matrix,
    });
  }

  // Existing custom actor/post-world chains are left intact by the new
  // foreground insertion. Exercise their actual one-frame source dispatches.
  {
    const hunterGold = win.APEX_HUNTER_GOLD;
    const readyStarted = Date.now();
    while (!win.APEX_HUNTER_PRESENTATION?.ready && Date.now() - readyStarted < 15000) await wait(50);
    assert.ok(win.APEX_HUNTER_PRESENTATION?.ready, 'Hunter Gold art reaches ready state in the headless harness');
    const originalStage = hunterGold.Stage;
    const originalDrawHunter = hunterGold.Stage.prototype.drawHunter;
    let hunterBodyDraws = 0, hunterPostFxDraws = 0;
    hunterGold.Stage.prototype.drawHunter = function countHunterBody(ctx, ...args) {
      hunterBodyDraws++;
      return originalDrawHunter.call(this, ctx, ...args);
    };
    hunterGold.Stage = function InstrumentedHunterStage(...args) {
      const stage = new originalStage(...args);
      const originalFxDraw = stage.fx.draw;
      stage.fx.draw = function countHunterPostFx(ctx, front, ...rest) {
        if (front === true) hunterPostFxDraws++;
        return originalFxDraw.call(this, ctx, front, ...rest);
      };
      return stage;
    };
    hunterGold.Stage.prototype = originalStage.prototype;
    try {
      const { fighters } = startMatch('MIRROR', 'HUNTER');
      hunterBodyDraws = hunterPostFxDraws = 0;
      const frame = renderFrame();
      assert.deepEqual(frame.events.filter((e) => e.kind === 'body-start').map((e) => e.actorId),
        Array.from(fighters, (f) => f.id));
      assert.equal(hunterBodyDraws, 1, 'Hunter Gold actor source renders once');
      assert.equal(hunterPostFxDraws, 1, 'Hunter post-world FX hook renders once');
      gate('Hunter body and existing post-world hook remain once-only', {
        bodyDraws: hunterBodyDraws, postWorldFxDraws: hunterPostFxDraws,
      });
    } finally {
      hunterGold.Stage = originalStage;
      hunterGold.Stage.prototype.drawHunter = originalDrawHunter;
    }
  }

  {
    const frostGold = win.APEX_FROST_GOLD;
    const frostApi = win.APEX_FROST_PRESENTATION;
    const { fighters } = startMatch('MIRROR', 'ICE');
    const frostFighter = fighters.find((fighter) => actorName(fighter) === 'ICE');
    assert.ok(frostFighter, 'the real ICE Gold fighter is present in the matchup');
    equip(frostFighter, 'PISTOL');
    T.step(FIXED_STEP, FIXED_STEP); // create the live Gold engine and start its shared art load
    const readyStarted = Date.now();
    while (!frostApi?.ready && Date.now() - readyStarted < 15000) await wait(50);
    assert.ok(frostApi?.ready,
      `Frost Gold art reaches ready state in the headless harness (error=${frostApi?.error || 'none'})`);
    const enginePrototype = frostGold.FrostEngine.prototype;
    const originalFrostDraw = enginePrototype.drawFrost;
    const originalRibbon = frostGold.drawRibbonLayer;
    const originalAirShapes = frostGold.drawAirShapes;
    let frostBodyDraws = 0, frostRibbonPasses = 0, frostAirPasses = 0;
    enginePrototype.drawFrost = function countFrostBody(ctx, ...args) {
      frostBodyDraws++;
      record({ kind: 'body-start', actorId: frostFighter.id, heroId: 'ICE' });
      try { return originalFrostDraw.call(this, ctx, ...args); }
      finally { record({ kind: 'body-end', actorId: frostFighter.id, heroId: 'ICE' }); }
    };
    frostGold.drawRibbonLayer = function countFrostRibbon(ctx, ...args) {
      frostRibbonPasses++;
      return originalRibbon.call(this, ctx, ...args);
    };
    frostGold.drawAirShapes = function countFrostAir(ctx, ...args) {
      frostAirPasses++;
      return originalAirShapes.call(this, ctx, ...args);
    };
    try {
      frostBodyDraws = frostRibbonPasses = frostAirPasses = 0;
      const frame = renderFrame();
      assert.deepEqual(frame.events.filter((e) => e.kind === 'body-start').map((e) => e.actorId),
        Array.from(fighters, (f) => f.id));
      assert.equal(frostBodyDraws, 1, 'Frost Gold body source renders once');
      assert.equal(frostRibbonPasses, 1, 'Frost post-world ribbon hook renders once');
      assert.equal(frostAirPasses, 1, 'Frost post-world air-shape hook renders once');
      gate('Frost body and existing post-world hooks remain once-only', {
        bodyDraws: frostBodyDraws, ribbonPasses: frostRibbonPasses, airShapePasses: frostAirPasses,
      });
    } finally {
      enginePrototype.drawFrost = originalFrostDraw;
      frostGold.drawRibbonLayer = originalRibbon;
      frostGold.drawAirShapes = originalAirShapes;
    }
  }

  console.log(`\n[MIRROR H1 SCALE/ORDER] ${checks}/${checks} focused gates passed; r28 remains a playtest candidate.`);
  if (captureDir) console.log(`[MIRROR H1 SCALE/ORDER] rendered PNG captures: ${captureDir}`);
} finally {
  crystalProbe = false;
  frameEvents = null;
  suppressA1Pixels = false;
  win.Fighter.prototype.draw = originalFighterDraw;
  AV.drawEquippedWeapon = originalEquippedDraw;
  crystalGold.drawCrystala = originalCrystalDraw;
  GOLD.createMirrorInstance = originalCreateGold;
  try { PRESENTATION.dispose(); } catch (error) {}
  win.close?.();
  H.dom.window.close();
}
