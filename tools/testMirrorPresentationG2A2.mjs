#!/usr/bin/env node
/* CHECKPOINT G2B — A2 choreography, real exchange roots and opponent identity. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createCanvas, Path2D, ImageData } from '@napi-rs/canvas';

const GOLD_PATH = 'docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html';
const GOLD_SHA = 'c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205';
const canonicalGold = fs.readFileSync(GOLD_PATH);
assert.equal(createHash('sha256').update(canonicalGold).digest('hex'), GOLD_SHA,
  'the canonical Gold source remains byte-identical');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
const win = dom.window;
win.Path2D = Path2D;
win.ImageData = ImageData;
let canvasCreations = 0;
let imageCreations = 0;
const canvases = [];
const identitySurfaces = new WeakSet();
let captureIdentityBlits = false;
let identityBlits = 0;
const identityBlitMatrices = [];
const createElement = win.document.createElement.bind(win.document);
win.document.createElement = function countedCreateElement(name, ...args) {
  const lower = String(name).toLowerCase();
  const element = createElement(name, ...args);
  if (lower === 'canvas') { canvasCreations++; canvases.push(element); }
  if (lower === 'img' || lower === 'image') imageCreations++;
  return element;
};
const nativeImage = win.Image;
win.Image = new Proxy(nativeImage, {
  construct(target, args, newTarget) {
    imageCreations++;
    return Reflect.construct(target, args, newTarget);
  },
});
const realCanvases = new WeakMap();
function realCanvasFor(el) {
  let real = realCanvases.get(el);
  const width = el.width || 300;
  const height = el.height || 150;
  if (!real || real.width !== width || real.height !== height) {
    real = createCanvas(width, height);
    realCanvases.set(el, real);
  }
  return real;
}
win.HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type && type !== '2d') return null;
  const target = realCanvasFor(this).getContext('2d');
  return new Proxy(target, {
    get(ctx, prop) {
      const value = Reflect.get(ctx, prop, ctx);
      if (prop === 'drawImage' && typeof value === 'function') {
        return (img, ...args) => {
          if (captureIdentityBlits && img && img.width === 256 && img.height === 256)
            identitySurfaces.add(img);
          if (identitySurfaces.has(img)) {
            identityBlits++;
            const m = ctx.getTransform();
            identityBlitMatrices.push([m.a, m.b, m.c, m.d, m.e, m.f]);
          }
          const mapped = img && (img.__realImage || realCanvases.get(img)
            || (img instanceof win.HTMLCanvasElement ? realCanvasFor(img) : null));
          return value.call(ctx, mapped || img, ...args);
        };
      }
      return typeof value === 'function' ? value.bind(ctx) : value;
    },
    set(ctx, prop, value) { return Reflect.set(ctx, prop, value, ctx); },
  });
};

const listeners = new Map();
const bus = {
  on(type, fn) {
    let list = listeners.get(type);
    if (!list) listeners.set(type, list = []);
    list.push(fn);
    return () => {
      const current = listeners.get(type);
      if (!current) return;
      const index = current.indexOf(fn);
      if (index >= 0) current.splice(index, 1);
    };
  },
  emit(type, payload = {}) {
    const list = listeners.get(type);
    if (!list) return;
    for (const fn of list.slice()) fn({ type, payload });
  },
};

let statusPasses = 0;
let originalMirrorTypeDraws = 0;
let genericRobotTypeDraws = 0;
let robotImageDraws = 0;
class Fighter {
  constructor(id, x, y, type, data = {}) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.hp = 100;
    this.radius = 48;
    this.dir = { x: 1, y: 0 };
    this.type = type;
    this.name = type.name;
    this.data = data;
    this.statuses = {};
    this.__hrFrameStart = { x, y };
    this.__hrFrameMotion = {
      locomotionVx: 0, locomotionVy: 0, engineForceVx: 0, engineForceVy: 0,
    };
    this.drawCalls = 0;
  }
  hasStatus() { return false; }
  draw(ctx) {
    this.drawCalls++;
    ctx.save();
    try {
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.dir.y, this.dir.x));
      if (this.type.draw) this.type.draw(ctx, this);
      statusPasses++;
    } finally { ctx.restore(); }
  }
}
const originalFighterDraw = Fighter.prototype.draw;
win.Fighter = Fighter;
const HR = {
  match: null,
  byCombatant(body) { return body && body.__hrCombatant || null; },
};
win.APEX_HERO_REWORK = HR;
win.APEX_HERO_REWORK_AIL = { bus };
// Robot is product-facing ROBOT while its engine type is generic NEWBIE. The
// body-only wrapper is intentionally distinct from the generic type renderer.
win.APEX_ROBOT_PRESENTATION = {
  isRobotFighter() { return false; },
  renderActorImage(ctx, fighter, x, y) {
    assert.equal(fighter.heroMarker, 'robot-opponent');
    assert.deepEqual([x, y], [128, 128]);
    robotImageDraws++;
    ctx.fillStyle = '#e92cfc';
    ctx.fillRect(x - 18, y - 18, 36, 36);
    return true;
  },
};

function combatant(idx, heroId, anchor, facade = false) {
  const ct = { idx, heroId, anchor, facade };
  anchor.__hrCombatant = ct;
  if (heroId === 'ROBOT') anchor.heroMarker = 'robot-opponent';
  return ct;
}
function bodyState(fighter) {
  return {
    id: fighter.id, x: fighter.x, y: fighter.y, hp: fighter.hp, radius: fighter.radius,
    dir: { ...fighter.dir }, data: JSON.parse(JSON.stringify(fighter.data)),
  };
}
function install(p1, p2) {
  HR.match = { combatants: [p1, p2] };
  bus.emit('ReworkMatchInstall', { p1: p1.heroId, p2: p2.heroId });
}
function endMatch() {
  HR.match = null;
  bus.emit('ReworkMatchTeardown', {});
}
function exchange(castId, self, opponent) {
  return {
    hero: 'MIRROR', castId,
    self: { id: self.id, from: { x: self.from.x, y: self.from.y }, to: { x: self.to.x, y: self.to.y } },
    opponent: { id: opponent.id, from: { x: opponent.from.x, y: opponent.from.y },
      to: { x: opponent.to.x, y: opponent.to.y } },
    delta: { x: opponent.from.x - self.from.x, y: opponent.from.y - self.from.y },
  };
}
function expectedHistoryRebase(history, HN, HS, dx, dy) {
  const expected = Float32Array.from(history);
  for (let i = 0; i < HN; i++) {
    const o = i * HS;
    expected[o] += dx; expected[o + 1] += dy;
    expected[o + 20] -= dx; expected[o + 21] -= dy;
  }
  return Array.from(expected);
}

const evidence = {
  suite: 'mirror-presentation-g2b-a2',
  canonicalGoldSha256: GOLD_SHA,
  passed: false,
  checks: [],
  results: {},
};
function check(name) { evidence.checks.push(name); }

try {
  win.eval(fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js', 'utf8'));
  const GOLD = win.APEX_MIRROR_GOLD;
  assert.equal(GOLD.ensureBaked(), true, String(GOLD.bakeError));
  const realCreate = GOLD.createMirrorInstance;
  const goldInstances = [];
  GOLD.createMirrorInstance = function captureGold(options) {
    const instance = realCreate.call(GOLD, options);
    goldInstances.push(instance);
    return instance;
  };

  const mirrorType = { name: 'MIRROR', draw() { originalMirrorTypeDraws++; } };
  const genericNewbieType = {
    name: 'NEWBIE',
    draw(ctx) {
      genericRobotTypeDraws++;
      ctx.fillStyle = '#46e0b5';
      ctx.fillRect(-24, -24, 48, 48);
    },
  };
  const mirror = new Fighter('g2b-mirror-robot', 200, 220, mirrorType);
  const robotOpponent = new Fighter('g2b-robot', 800, 260, genericNewbieType, {
    arsenal: { weaponId: 'PISTOL', meta: { aimAngle: 0.3 } },
  });
  const mirrorCt = combatant(0, 'MIRROR', mirror);
  const robotCt = combatant(1, 'ROBOT', robotOpponent, true);

  win.eval(fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8'));
  const bridge = win.APEX_MIRROR_PRESENTATION;
  assert.equal(bridge.version, 'r2-semantic-gold-presentation');
  install(mirrorCt, robotCt);
  assert.equal(bridge.inspect().instanceCount, 1);
  assert.equal(goldInstances.length, 1);
  const gold = goldInstances[0];
  const realDrawMirrorEntityWithOpponent = gold.drawMirrorEntityWithOpponent;
  const a2CompositeScales = [];
  gold.drawMirrorEntityWithOpponent = function captureA2CompositeScale(ctx2d, drawOpponent, mirrorScale) {
    a2CompositeScales.push(mirrorScale);
    return realDrawMirrorEntityWithOpponent.call(this, ctx2d, drawOpponent, mirrorScale);
  };
  assert.equal(gold.externalTruth, true);
  assert.equal(gold.applyExchange, false, 'the production instance cannot own gameplay relocation');
  console.log('[G2B A2] adapter and Gold ready');

  const robotRuntimeSource = fs.readFileSync('public/game/hero-rework/robotPresentationRuntime.js', 'utf8');
  const robotHelperAt = robotRuntimeSource.indexOf('function renderActorImage(');
  const robotHelperEnd = robotRuntimeSource.indexOf('// World-space:', robotHelperAt);
  assert.ok(robotHelperAt >= 0 && robotHelperEnd > robotHelperAt);
  const robotHelperSource = robotRuntimeSource.slice(robotHelperAt, robotHelperEnd);
  assert.match(robotHelperSource, /renderRobotLocal\(ctx, fighter, st\)/,
    'Robot identity uses its wrapper-specific body renderer');
  assert.doesNotMatch(robotHelperSource, /Fighter\.prototype\.draw|updateRobotState|renderRobotWorld/,
    'Robot identity does not recurse through the full actor draw or update/world passes');
  const adapterSource = fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8');
  assert.doesNotMatch(adapterSource, /\.a2Snap\s*\(|\.shiftHist\s*\(/,
    'the adapter routes only through Gold external A2 APIs, never manual snap/history calls');
  const goldSource = fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js', 'utf8');
  const goldDrawHelperStart = goldSource.indexOf('let __mirrorEntityDrawContext');
  const goldDrawHelperEnd = goldSource.indexOf('function beginExternalA1(', goldDrawHelperStart);
  assert.ok(goldDrawHelperStart >= 0 && goldDrawHelperEnd > goldDrawHelperStart);
  const goldDrawHelperSource = goldSource.slice(goldDrawHelperStart, goldDrawHelperEnd);
  assert.doesNotMatch(goldDrawHelperSource, /=>/,
    'the A2 identity draw bridge reuses callbacks instead of allocating per-frame closures');
  assert.match(goldDrawHelperSource, /72 \* scale/,
    'active A2 clip/sweep envelope follows the Mirror presentation scale');
  assert.match(adapterSource, /drawMirrorEntityWithOpponent\(ctx, state\.drawOpponentIdentity, bodyK\)/,
    'active A2 passes Mirror scale into Gold instead of scaling the mixed composite context');
  check('gold-bound-external-truth-and-applyExchange-false');
  check('gold-a2-adapter-draw-reuses-prebound-callbacks');
  check('Robot-product-alias-uses-body-only-identity-renderer');

  const view = win.document.createElement('canvas');
  view.width = 600;
  view.height = 500;
  const ctx = view.getContext('2d');
  let postFrame = 0;
  function renderPostResidue() {
    win.__apexRenderFrame = ++postFrame;
    return bridge.renderPostFighterResidue(ctx);
  }
  const step = bridge.fixedStep;
  const noSnapCast = 'g2b-no-snap';
  bus.emit('MirrorA2Cast', { hero: 'MIRROR', castId: noSnapCast, combatantIndex: mirrorCt.idx });
  bridge.tick(0);
  assert.equal(gold.A2.on, true, 'the real A2 cast event begins authored Gold choreography');
  assert.equal(gold.externalAudit().a2CastId, noSnapCast);
  assert.equal(gold.externalAudit().snaps, 0);
  for (let i = 0; i < 18; i++) bridge.tick(step);
  assert.ok(gold.A2.u >= 0.14 && gold.A2.band > 0 && gold.A2.ghostA > 0,
    'the real cast advances the authored split/identity window at fixed 1/120 ticks');

  const untouchedMirror = bodyState(mirror);
  const untouchedOpponent = bodyState(robotOpponent);
  const canvasesBeforeIdentity = canvasCreations;
  const imagesBeforeIdentity = imageCreations;
  captureIdentityBlits = true;
  mirror.draw(ctx);
  captureIdentityBlits = false;
  assert.equal(robotImageDraws, 1, 'the actual ROBOT opponent identity renderer runs once per actor draw');
  assert.equal(genericRobotTypeDraws, 0,
    'generic NEWBIE type art is not substituted for the product-facing ROBOT');
  assert.equal(robotOpponent.drawCalls, 0,
    'wrong-person identity never recursively enters Fighter.draw');
  assert.equal(mirror.drawCalls, 1);
  assert.equal(statusPasses, 1, 'the owning Mirror keeps one normal status/draw chain');
  assert.equal(originalMirrorTypeDraws, 0, 'Gold replaces only the actual Mirror body type art');
  assert.equal(canvasCreations, canvasesBeforeIdentity + 1,
    'one adapter-owned identity canvas is allocated lazily on first A2 reflection');
  assert.equal(imageCreations, imagesBeforeIdentity,
    'identity rendering constructs no Image object');
  const robotIdentitySurface = canvases.at(-1);
  assert.equal(robotIdentitySurface.width, 256);
  assert.equal(robotIdentitySurface.height, 256);
  identitySurfaces.add(robotIdentitySurface);
  const identityPixel = robotIdentitySurface.getContext('2d').getImageData(128, 128, 1, 1).data;
  assert.deepEqual([...identityPixel].slice(0, 3), [233, 44, 252],
    'the bounded snapshot contains the actual opponent identity pixels');
  assert.ok(identityBlits > 0, 'Gold composites the snapshot through its authored A2 wrong-person clip');
  const expectedA2MirrorScale = (mirror.radius / 34) * 0.70;
  assert.ok(Math.abs(a2CompositeScales.at(-1) - expectedA2MirrorScale) < 1e-9,
    'active A2 receives the same owner-tuned Mirror scale as idle presentation');
  const identityMatrix = identityBlitMatrices.at(-1);
  assert.ok(identityMatrix, 'active A2 records the opponent snapshot composite matrix');
  assert.ok(Math.abs(identityMatrix[0] - 1) < 1e-9 && Math.abs(identityMatrix[1]) < 1e-9
    && Math.abs(identityMatrix[2]) < 1e-9 && Math.abs(identityMatrix[3] - 1) < 1e-9,
    'opponent snapshot stays at 1x production scale instead of inheriting Mirror body scale');
  check('active-a2-keeps-mirror-at-owner-scale-and-opponent-snapshot-at-production-scale');
  assert.deepEqual(bodyState(mirror), untouchedMirror, 'actor drawing leaves all Mirror gameplay state unchanged');
  assert.deepEqual(bodyState(robotOpponent), untouchedOpponent, 'identity drawing leaves all opponent gameplay state unchanged');

  const framesBeforeReuse = goldInstances.length;
  const canvasesBeforeReuse = canvasCreations;
  const imagesBeforeReuse = imageCreations;
  for (let i = 0; i < 10; i++) mirror.draw(ctx);
  assert.equal(goldInstances.length, framesBeforeReuse, 'active A2 frames create no extra Gold instances');
  assert.equal(canvasCreations, canvasesBeforeReuse, 'active A2 frames reuse the single identity canvas');
  assert.equal(imageCreations, imagesBeforeReuse, 'active A2 frames allocate no Image objects');
  assert.equal(robotImageDraws, 11, 'the bounded image surface is refreshed in-place from live identity');
  assert.equal(robotOpponent.drawCalls, 0, 'the opponent actor draw chain remains untouched');
  assert.deepEqual(bodyState(mirror), untouchedMirror);
  assert.deepEqual(bodyState(robotOpponent), untouchedOpponent);

  // Also exercise the normal engine-type body renderer used for non-Robot,
  // non-Mirror opponents; it is still a body-only call, not Fighter.draw().
  const robotImageDrawsBeforeGeneric = robotImageDraws;
  const canvasesBeforeGeneric = canvasCreations;
  robotCt.heroId = 'STALKER';
  mirror.draw(ctx);
  assert.equal(genericRobotTypeDraws, 1, 'ordinary opponent type art is rendered into the same snapshot');
  assert.equal(robotImageDraws, robotImageDrawsBeforeGeneric,
    'a non-Robot identity bypasses the Robot-specific wrapper');
  assert.equal(canvasCreations, canvasesBeforeGeneric, 'switching identity reuses the bounded surface');
  const genericIdentityPixel = robotIdentitySurface.getContext('2d').getImageData(128, 128, 1, 1).data;
  assert.deepEqual([...genericIdentityPixel].slice(0, 3), [70, 224, 181]);
  robotCt.heroId = 'ROBOT';
  mirror.draw(ctx);
  assert.deepEqual([...robotIdentitySurface.getContext('2d').getImageData(128, 128, 1, 1).data].slice(0, 3),
    [233, 44, 252], 'live Robot identity is restored in-place without another canvas');
  assert.equal(robotOpponent.drawCalls, 0);
  evidence.results.identity = {
    renderer: 'Robot body-only renderActorImage',
    canvasesForOneMirror: 1,
    imagesCreatedDuringReuse: 0,
    robotImageDrawCalls: robotImageDraws,
    genericOpponentDrawCalls: genericRobotTypeDraws,
    identityBlits: identityBlits,
    mirrorActorDrawCalls: mirror.drawCalls,
    opponentFullDrawCalls: robotOpponent.drawCalls,
  };
  check('bounded-lazy-opponent-identity-snapshot-no-per-frame-canvas-image');
  check('wrong-person-draw-has-zero-gameplay-mutation-and-no-recursive-effects');
  console.log('[G2B A2] Robot identity snapshot and resource-bound checks passed');

  bus.emit('MirrorA2NoSnap', { hero: 'MIRROR', castId: noSnapCast, reason: 'test-no-snap' });
  bus.emit('MirrorA2End', { hero: 'MIRROR', castId: noSnapCast });
  bridge.tick(0);
  let record = bridge.inspect().records[0];
  assert.equal(record.a2NoSnap, true);
  assert.equal(record.a2CastId, null, 'the real end event closes the no-snap cast');
  assert.equal(record.a2ExchangeApplied, false);
  assert.equal(gold.A2.on, false);
  assert.equal(gold.A2.res, 0, 'no-snap produces no authored post-snap residue');
  assert.equal(gold.externalAudit().snaps, 0);
  assert.equal(gold.externalAudit().exchanges, 0);
  assert.deepEqual(bodyState(mirror), untouchedMirror);
  assert.deepEqual(bodyState(robotOpponent), untouchedOpponent);
  check('no-snap-end-closes-cleanly-without-snap-exchange-or-residue');

  // A no-dt exchange frame isolates the authored history rebase: every history
  // channel is preserved except the one intentional PRE->POST root translation.
  const historyCast = 'g2b-history-exchange';
  bus.emit('MirrorA2Cast', { hero: 'MIRROR', castId: historyCast, combatantIndex: mirrorCt.idx });
  bridge.tick(0);
  for (let i = 0; i < 30; i++) bridge.tick(step);
  assert.equal(gold.A2.on, true);
  const preMirror = { x: 210, y: 230 };
  const preOpponent = { x: 785, y: 255 };
  const postMirror = { x: preOpponent.x, y: preOpponent.y };
  const postOpponent = { x: preMirror.x, y: preMirror.y };
  mirror.x = postMirror.x; mirror.y = postMirror.y;
  robotOpponent.x = postOpponent.x; robotOpponent.y = postOpponent.y;
  const event = exchange(historyCast,
    { id: mirror.id, from: preMirror, to: postMirror },
    { id: robotOpponent.id, from: preOpponent, to: postOpponent });
  const historyBefore = Array.from(gold.hist);
  const headBefore = gold.hHead;
  const noMutationAfterSwap = [bodyState(mirror), bodyState(robotOpponent)];
  bus.emit('MirrorExchange', event);
  bridge.tick(0);
  record = bridge.inspect().records[0];
  assert.equal(gold.externalAudit().snaps, 1, 'one real exchange invokes authored a2Snap exactly once');
  assert.equal(gold.externalAudit().exchanges, 1);
  assert.equal(gold.externalAudit().lastExchangeCastId, historyCast);
  assert.equal(record.a2ExchangeApplied, true);
  assert.deepEqual([gold.M.x, gold.M.y, gold.F.x, gold.F.y],
    [postMirror.x, postMirror.y, postOpponent.x, postOpponent.y],
    'post-swap Gold roots are restored from APEX after the authored PRE-swap snap');
  assert.deepEqual([gold.A2.rx, gold.A2.ry, gold.A2.fx, gold.A2.fy],
    [preMirror.x, preMirror.y, preOpponent.x, preOpponent.y],
    'Gold authored residue retains the real PRE-swap roots');
  assert.equal(gold.hHead, headBefore, 'the exchange frame rebases history without an extra sample');
  const expectedHistory = expectedHistoryRebase(historyBefore, gold.HN, gold.HS,
    preOpponent.x - preMirror.x, preOpponent.y - preMirror.y);
  assert.deepEqual(Array.from(gold.hist), expectedHistory,
    'all authored history channels survive exactly one shiftHist rebase');
  assert.deepEqual([bodyState(mirror), bodyState(robotOpponent)], noMutationAfterSwap,
    'Gold A2 snap never writes gameplay coordinates or actor state');
  assert.ok(gold.A2.res > 0, 'real exchange leaves Gold-authored residue available for world presentation');

  const historyAfterFirstSnap = Array.from(gold.hist);
  const eventsAfterFirstSnap = record.exchangeEvents;
  bus.emit('MirrorExchange', event);
  bridge.tick(0);
  record = bridge.inspect().records[0];
  assert.equal(gold.externalAudit().snaps, 1, 'duplicate real event cannot invoke a second snap');
  assert.equal(gold.externalAudit().exchanges, 1, 'duplicate real event cannot resolve twice');
  assert.equal(record.exchangeEvents, eventsAfterFirstSnap, 'the bounded event-id guard ignores duplicates');
  assert.deepEqual(Array.from(gold.hist), historyAfterFirstSnap,
    'duplicate event neither rebases nor clears retained history');
  assert.deepEqual([gold.M.vx, gold.M.vy, gold.F.vx, gold.F.vy], [0, 0, 0, 0]);
  check('pre-post-roots-exact-once-snap-and-history-rebase-duplicate-protection');

  bus.emit('MirrorA2End', { hero: 'MIRROR', castId: historyCast });
  bridge.tick(0);
  record = bridge.inspect().records[0];
  assert.equal(gold.A2.on, false, 'the real end event, not Gold time, ends external A2');
  assert.equal(record.a2CastId, null);
  assert.equal(record.a2ExchangeApplied, true, 'end cleanup retains snap identity during residue lifetime');
  assert.ok(gold.A2.res > 0, 'clean A2 end preserves authored post-snap residue');
  const realStrips = gold.strips;
  let residueStripDraws = 0;
  gold.strips = function countedResidueStrips(...args) {
    residueStripDraws++;
    return realStrips.apply(gold, args);
  };
  win.APEX_ARSENAL = { state: { active: true } };
  assert.equal(bridge.renderArenaWorldEffects(ctx, { stage: 'before-world' }), false);
  assert.equal(residueStripDraws, 0, 'residue is absent from the pre-fighter world seam');
  assert.equal(bridge.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' }), true);
  assert.equal(residueStripDraws, 0, 'the valid Arsenal world seam draws passive world content only');
  assert.equal(renderPostResidue(), true, 'A2 residue is rendered after fighter bodies');
  assert.equal(residueStripDraws, 2, 'the one Gold residue owns its Mirror and opponent strip passes');
  win.APEX_ARSENAL.state.active = false;
  bridge.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' });
  assert.equal(residueStripDraws, 4, 'non-Arsenal modes retain residue in their existing world seam');
  win.APEX_ARSENAL.state.active = true;
  gold.strips = realStrips;
  check('real-end-cleans-action-and-retains-context-correct-residue-order');
  console.log('[G2B A2] exact snap, history rebase, duplicate, end and residue checks passed');

  // A second real exchange checks physical movement velocity against the PRE
  // movement sample, never the large teleport delta or Gold demo physics.
  const velocityCast = 'g2b-velocity-exchange';
  bus.emit('MirrorA2Cast', { hero: 'MIRROR', castId: velocityCast, combatantIndex: mirrorCt.idx });
  bridge.tick(0);
  for (let i = 0; i < 30; i++) bridge.tick(step);
  const velocityPreMirror = { x: 788, y: 258 };
  const velocityPreOpponent = { x: 207, y: 234 };
  mirror.__hrFrameStart.x = postMirror.x;
  mirror.__hrFrameStart.y = postMirror.y;
  robotOpponent.__hrFrameStart.x = postOpponent.x;
  robotOpponent.__hrFrameStart.y = postOpponent.y;
  const velocityPostMirror = { x: velocityPreOpponent.x, y: velocityPreOpponent.y };
  const velocityPostOpponent = { x: velocityPreMirror.x, y: velocityPreMirror.y };
  mirror.x = velocityPostMirror.x; mirror.y = velocityPostMirror.y;
  robotOpponent.x = velocityPostOpponent.x; robotOpponent.y = velocityPostOpponent.y;
  const velocityEvent = exchange(velocityCast,
    { id: mirror.id, from: velocityPreMirror, to: velocityPostMirror },
    { id: robotOpponent.id, from: velocityPreOpponent, to: velocityPostOpponent });
  const bodiesAfterVelocitySwap = [bodyState(mirror), bodyState(robotOpponent)];
  bus.emit('MirrorExchange', velocityEvent);
  bridge.tick(step);
  const velocityAudit = gold.externalAudit();
  assert.deepEqual({ ...velocityAudit.mirror }, {
    x: velocityPostMirror.x, y: velocityPostMirror.y, vx: 360, vy: 360,
  }, 'Mirror Gold receives post-swap roots and true pre-swap movement velocity');
  assert.deepEqual({ ...velocityAudit.opponent }, {
    x: velocityPostOpponent.x, y: velocityPostOpponent.y, vx: -360, vy: 480,
  }, 'opponent Gold sample never treats exchange teleport displacement as velocity');
  assert.equal(velocityAudit.snaps, 2, 'the second distinct cast adds exactly one authored snap');
  assert.equal(velocityAudit.exchanges, 2);
  assert.deepEqual([bodyState(mirror), bodyState(robotOpponent)], bodiesAfterVelocitySwap,
    'exchange presentation does not mutate APEX after the real gameplay swap');
  const historyAfterVelocitySnap = Array.from(gold.hist);
  const auditAfterVelocitySnap = gold.externalAudit();
  bus.emit('MirrorExchange', velocityEvent);
  bridge.tick(0);
  assert.equal(gold.externalAudit().snaps, 2, 'duplicate velocity event is ignored');
  assert.deepEqual(Array.from(gold.hist), historyAfterVelocitySnap,
    'duplicate after a stepped snap cannot shift retained history again');
  assert.deepEqual([gold.M.vx, gold.M.vy, gold.F.vx, gold.F.vy],
    [auditAfterVelocitySnap.mirror.vx, auditAfterVelocitySnap.mirror.vy,
      auditAfterVelocitySnap.opponent.vx, auditAfterVelocitySnap.opponent.vy],
    'duplicate event preserves the last honest velocity sample');
  check('post-swap-root-and-honest-velocity-sampling');
  console.log('[G2B A2] honest velocity checks passed');

  // Mirror-v-Mirror: each independent Gold state gets its own oriented real
  // event, and a Mirror encountered as payload.opponent is sampled inverted.
  endMatch();
  const sharedMirrorType = { name: 'MIRROR', draw() { originalMirrorTypeDraws++; } };
  const mirrorA = new Fighter('g2b-mirror-a', 200, 360, sharedMirrorType);
  const mirrorB = new Fighter('g2b-mirror-b', 800, 360, sharedMirrorType);
  const mirrorACt = combatant(0, 'MIRROR', mirrorA);
  const mirrorBCt = combatant(1, 'MIRROR', mirrorB);
  install(mirrorACt, mirrorBCt);
  const goldA = goldInstances.at(-2);
  const goldB = goldInstances.at(-1);
  assert.notEqual(goldA, goldB);
  assert.notEqual(goldA.hist, goldB.hist);
  bus.emit('MirrorA2Cast', { hero: 'MIRROR', castId: 'pair-cast-a', combatantIndex: 0 });
  bus.emit('MirrorA2Cast', { hero: 'MIRROR', castId: 'pair-cast-b', combatantIndex: 1 });
  bridge.tick(0);
  for (let i = 0; i < 30; i++) bridge.tick(step);
  const preA = { x: 205, y: 365 };
  const preB = { x: 795, y: 355 };
  const postA = { x: preB.x, y: preB.y };
  const postB = { x: preA.x, y: preA.y };
  mirrorA.x = postA.x; mirrorA.y = postA.y;
  mirrorB.x = postB.x; mirrorB.y = postB.y;
  const eventA = exchange('pair-cast-a',
    { id: mirrorA.id, from: preA, to: postA },
    { id: mirrorB.id, from: preB, to: postB });
  const eventB = exchange('pair-cast-b',
    { id: mirrorB.id, from: preB, to: postB },
    { id: mirrorA.id, from: preA, to: postA });
  const pairPostSwapBodies = [bodyState(mirrorA), bodyState(mirrorB)];
  bus.emit('MirrorExchange', eventA);
  bridge.tick(0);
  assert.equal(goldA.externalAudit().snaps, 1);
  assert.equal(goldB.externalAudit().snaps, 0,
    'the opponent-side Mirror receives inverse roots but not another cast’s A2 snap');
  assert.deepEqual([goldB.M.x, goldB.M.y, goldB.F.x, goldB.F.y],
    [postB.x, postB.y, postA.x, postA.y],
    'payload.opponent perspective is inverted for the second Mirror root pair');
  bus.emit('MirrorExchange', eventB);
  bridge.tick(0);
  assert.equal(goldA.externalAudit().snaps, 1);
  assert.equal(goldB.externalAudit().snaps, 1);
  assert.equal(goldA.externalAudit().lastExchangeCastId, 'pair-cast-a');
  assert.equal(goldB.externalAudit().lastExchangeCastId, 'pair-cast-b');
  assert.deepEqual([goldA.M.x, goldA.M.y, goldA.F.x, goldA.F.y],
    [postA.x, postA.y, postB.x, postB.y]);
  assert.deepEqual([goldB.M.x, goldB.M.y, goldB.F.x, goldB.F.y],
    [postB.x, postB.y, postA.x, postA.y]);
  assert.deepEqual([bodyState(mirrorA), bodyState(mirrorB)], pairPostSwapBodies,
    'both independent Gold perspectives preserve the already-committed gameplay swap');

  let residueA = 0, residueB = 0;
  const stripsA = goldA.strips, stripsB = goldB.strips;
  goldA.strips = function (ctx, ...args) { residueA++; return stripsA.call(goldA, ctx, ...args); };
  goldB.strips = function (ctx, ...args) { residueB++; return stripsB.call(goldB, ctx, ...args); };
  renderPostResidue();
  assert.equal(residueA, 2, 'the singular Mirror-v-Mirror owner draws its two Gold residue echoes');
  assert.equal(residueB, 0, 'coalesced Mirror-v-Mirror residue never double-draws');
  goldA.strips = stripsA; goldB.strips = stripsB;

  const rigA = goldA.rigFull, rigB = goldB.rigFull;
  let identityA = 0, identityB = 0;
  goldA.rigFull = function (ctx, x, y) {
    if (x === 128 && y === 128) identityA++;
    return rigA.call(goldA, ctx, x, y);
  };
  goldB.rigFull = function (ctx, x, y) {
    if (x === 128 && y === 128) identityB++;
    return rigB.call(goldB, ctx, x, y);
  };
  const pairDrawStart = canvases.length;
  const pairBodiesBeforeDraw = [bodyState(mirrorA), bodyState(mirrorB)];
  captureIdentityBlits = true;
  mirrorA.draw(ctx);
  mirrorB.draw(ctx);
  captureIdentityBlits = false;
  const pairIdentityCanvases = canvases.slice(pairDrawStart);
  assert.equal(pairIdentityCanvases.length, 2,
    'each live Mirror allocates one bounded lazy identity surface');
  assert.ok(pairIdentityCanvases.every((surface) => surface.width === 256 && surface.height === 256));
  for (const surface of pairIdentityCanvases) identitySurfaces.add(surface);
  assert.equal(identityA, 1, 'Mirror B’s real Gold rig is snapshotted into Mirror A’s wrong-person identity');
  assert.equal(identityB, 1, 'Mirror A’s real Gold rig is snapshotted into Mirror B’s wrong-person identity');
  const pairGoldCount = goldInstances.length;
  const pairCanvasCount = canvasCreations;
  const pairImageCount = imageCreations;
  const pairDrawA = mirrorA.drawCalls, pairDrawB = mirrorB.drawCalls;
  for (let i = 0; i < 8; i++) { mirrorA.draw(ctx); mirrorB.draw(ctx); }
  assert.equal(goldInstances.length, pairGoldCount, 'Mirror-v-Mirror frames create no additional Gold instances');
  assert.equal(canvasCreations, pairCanvasCount, 'Mirror-v-Mirror reuses exactly two identity surfaces');
  assert.equal(imageCreations, pairImageCount, 'Mirror-v-Mirror identity uses no Image allocations');
  assert.equal(mirrorA.drawCalls - pairDrawA, 8);
  assert.equal(mirrorB.drawCalls - pairDrawB, 8);
  assert.ok(identityBlits > 16, 'each Mirror identity snapshot is repeatedly composited by Gold A2');
  assert.deepEqual([bodyState(mirrorA), bodyState(mirrorB)], pairBodiesBeforeDraw,
    'Mirror-v-Mirror identity draws mutate no gameplay state');
  check('mirror-versus-mirror-perspective-identity-resource-and-residue-bounds');
  console.log('[G2B A2] Mirror-v-Mirror perspectives and bounded snapshots passed');

  const allIdentitySurfaces = [robotIdentitySurface, ...pairIdentityCanvases];
  endMatch();
  assert.equal(bridge.inspect().instanceCount, 0);
  assert.ok(allIdentitySurfaces.every((surface) => surface.width === 0 && surface.height === 0),
    'match teardown releases every adapter-owned identity backing store');
  assert.equal(gold.externalTruth, false, 'teardown disables external truth for the retired state');
  assert.equal(goldA.externalTruth, false);
  assert.equal(goldB.externalTruth, false);
  bridge.dispose();
  assert.equal(win.APEX_MIRROR_PRESENTATION, undefined);
  assert.equal(Fighter.prototype.draw, originalFighterDraw, 'dispose restores the pre-adapter actor chain');

  evidence.passed = true;
  evidence.results.exchange = {
    snapsForNoSnapCast: 0,
    successfulSnaps: 2,
    uniqueExchanges: 2,
    historyRebasesForFirstSnap: 1,
    velocityMirror: { vx: 360, vy: 360 },
    velocityOpponent: { vx: -360, vy: 480 },
    residueAfterEnd: true,
  };
  evidence.results.mirrorVersusMirror = {
    independentInstances: 2,
    snapsPerInstance: [1, 1],
    identitySurfaces: pairIdentityCanvases.length,
    residueDraws: [residueA, residueB],
  };
  const evidencePath = 'docs/hero-rework/mirror-v1/evidence/g2b-a2-presentation.json';
  fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log('[MIRROR G2B A2 presentation] PASS — cast/no-snap/end, exact authored snap/history rebase, duplicate protection, PRE/POST roots, honest velocity, retained residue, Robot identity snapshot, Mirror-v-Mirror perspective, resource bounds and zero gameplay mutation.');
} finally {
  try { win.APEX_MIRROR_PRESENTATION?.dispose(); } catch (error) {}
  dom.window.close();
}
