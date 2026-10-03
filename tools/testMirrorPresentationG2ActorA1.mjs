#!/usr/bin/env node
/* CHECKPOINT G2A — Gold actor draw ownership and real Arsenal A1 reflection. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createCanvas, Path2D, ImageData } from '@napi-rs/canvas';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
const win = dom.window;
win.Path2D = Path2D;
win.ImageData = ImageData;
let canvasCreations = 0;
let imageCreations = 0;
const createElement = win.document.createElement.bind(win.document);
win.document.createElement = function countedCreateElement(name, ...args) {
  const lower = String(name).toLowerCase();
  if (lower === 'canvas') canvasCreations++;
  if (lower === 'img' || lower === 'image') imageCreations++;
  return createElement(name, ...args);
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
        return (img, ...args) => value.call(ctx,
          img && (img.__realImage || realCanvases.get(img)
            || (img instanceof win.HTMLCanvasElement ? realCanvasFor(img) : null)) || img,
          ...args);
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
    const event = { type, payload };
    for (const fn of list.slice()) fn(event);
  },
};

let typeDrawCalls = 0;
let statusPasses = 0;
let equippedWeaponDraws = 0;
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
  }
  hasStatus() { return false; }
  draw(ctx) {
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

const arsenalImage = win.document.createElement('canvas');
arsenalImage.width = 180;
arsenalImage.height = 68;
const weaponCtx = arsenalImage.getContext('2d');
weaponCtx.fillStyle = '#ef3757';
weaponCtx.fillRect(18, 25, 140, 18);
weaponCtx.fillStyle = '#ffd36a';
weaponCtx.fillRect(128, 12, 32, 44);
let weaponImageLookups = 0;
win.APEX_ARSENAL_AV = {
  weaponImage(weaponId) {
    weaponImageLookups++;
    return weaponId === 'PISTOL' ? arsenalImage : null;
  },
  drawEquippedWeapon(ctx, fighter) {
    equippedWeaponDraws++;
    ctx.save();
    ctx.fillStyle = '#ffd36a';
    ctx.fillRect(fighter.x + 22, fighter.y - 6, 34, 12);
    ctx.restore();
    return true;
  },
};

function combatant(idx, heroId, anchor, facade = false) {
  const ct = { idx, heroId, anchor, facade };
  anchor.__hrCombatant = ct;
  return ct;
}
function pixelHash(canvas) {
  const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}
function bodySnapshot(f) { return { x: f.x, y: f.y }; }

try {
  win.eval(fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js', 'utf8'));
  const GOLD = win.APEX_MIRROR_GOLD;
  const realCreate = GOLD.createMirrorInstance;
  const goldInstances = [];
  GOLD.createMirrorInstance = function captureGold(options) {
    const instance = realCreate.call(GOLD, options);
    goldInstances.push(instance);
    return instance;
  };
  const mirrorType = { name: 'MIRROR', draw() { typeDrawCalls++; } };
  const foeType = {
    name: 'STALKER',
    draw(ctx) {
      typeDrawCalls++;
      ctx.fillStyle = '#42d9b2';
      ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
    },
  };
  const mirror = new Fighter('mirror-a1', 300, 400, mirrorType);
  const foe = new Fighter('foe-a1', 700, 400, foeType, {
    arsenal: { weaponId: 'PISTOL', meta: { aimAngle: 0.15 } },
  });
  const mirrorCt = combatant(0, 'MIRROR', mirror);
  const foeCt = combatant(1, 'STALKER', foe, true);
  HR.match = { combatants: [mirrorCt, foeCt] };

  win.eval(fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8'));
  const bridge = win.APEX_MIRROR_PRESENTATION;
  assert.equal(bridge.version, 'g2a-actor-a1-presentation');
  bus.emit('ReworkMatchInstall', { p1: 'MIRROR', p2: 'STALKER' });
  assert.equal(bridge.inspect().instanceCount, 1);
  const gold = goldInstances[0];
  assert.equal(gold.externalTruth, true);
  const drawA1World = gold.drawA1World;
  let a1WorldDraws = 0;
  gold.drawA1World = function captureA1World(ctx) {
    a1WorldDraws++;
    return drawA1World.call(gold, ctx);
  };

  const view = win.document.createElement('canvas');
  view.width = 1000;
  view.height = 1000;
  const ctx = view.getContext('2d');
  const originalMirrorTypeDraw = mirrorType.draw;
  const mirrorBeforeDraw = bodySnapshot(mirror);
  mirror.draw(ctx);
  assert.equal(typeDrawCalls, 0, 'Gold actor replaces only the Mirror type art');
  assert.equal(statusPasses, 1, 'the existing Fighter draw/status chain still runs once');
  assert.equal(mirrorType.draw, originalMirrorTypeDraw, 'the cached type override is restored after the actor pass');
  assert.equal(Fighter.prototype.draw === originalFighterDraw, false, 'the Mirror adapter wraps the existing draw chain');
  assert.deepEqual(bodySnapshot(mirror), mirrorBeforeDraw, 'Gold actor drawing does not write gameplay coordinates');
  assert.ok(gold.M.x === mirror.x && gold.M.y === mirror.y);
  assert.ok(pixelHash(view) !== createHash('sha256').update(Buffer.alloc(1000 * 1000 * 4)).digest('hex'),
    'the Gold Mirror rig produces visible actor pixels');

  foe.draw(ctx);
  assert.equal(typeDrawCalls, 1, 'non-Mirror actors still delegate to their original actor draw');
  assert.equal(statusPasses, 2, 'non-Mirror status layer still draws exactly once');

  bus.emit('MirrorA1Cast', {
    hero: 'MIRROR', castId: 'a1-pistol-1', combatantIndex: 0,
    weaponId: 'PISTOL', whiff: false,
  });
  assert.equal(weaponImageLookups, 1, 'A1 resolves the real cached Arsenal image once');
  assert.equal(gold.weaponArt().source, 'production');
  assert.equal(gold.weaponArt().weaponId, 'PISTOL');
  assert.equal(bridge.inspect().records[0].weaponArtReady, true);
  assert.equal(gold.A1.on, false, 'cast start is applied only after post-movement root sync');

  const actorCanvasCount = canvasCreations;
  const actorImageCount = imageCreations;
  for (let i = 0; i < 26; i++) bridge.tick(1 / 120);
  assert.equal(gold.A1.on, true);
  assert.ok(gold.A1.u > 0.12, 'Gold A1 presentation reaches the authored reflection interval');
  assert.equal(weaponImageLookups, 1, 'steady presentation ticks reuse Arsenal image identity');
  assert.equal(canvasCreations, actorCanvasCount, 'Gold stepping creates no per-frame canvas');
  assert.equal(imageCreations, actorImageCount, 'Gold stepping creates no per-frame image');

  const noStageHash = pixelHash(view);
  assert.equal(bridge.renderArenaWorldEffects(ctx, { stage: 'before-world' }), false);
  assert.equal(pixelHash(view), noStageHash, 'A1 reflection obeys the protected world-draw stage');
  ctx.clearRect(0, 0, view.width, view.height);
  const emptyWorldHash = pixelHash(view);
  assert.equal(bridge.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' }), true);
  const reflectionHash = pixelHash(view);
  assert.notEqual(reflectionHash, emptyWorldHash, 'the A1 reflection is drawn from real Arsenal weapon art');
  assert.equal(a1WorldDraws, 1, 'the protected world stage owns the pre-OWN reflection exactly once');
  mirror.draw(ctx);
  foe.draw(ctx);
  assert.equal(gold.weaponArt().source, 'production', 'the Gold demo weapon fallback is not used');

  let goldHeldDraws = 0;
  gold.drawHeld = () => { goldHeldDraws++; return true; };
  bus.emit('MirrorA1Own', { hero: 'MIRROR', castId: 'a1-pistol-1', weaponId: 'PISTOL' });
  assert.equal(bridge.inspect().records[0].realOwn, true, 'real OWN is the held-weapon authority');
  mirror.data.arsenal = { weaponId: 'PISTOL', meta: { aimAngle: 0.15 } };
  ctx.clearRect(0, 0, view.width, view.height);
  const emptyAfterOwnHash = pixelHash(view);
  bridge.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' });
  assert.equal(pixelHash(view), emptyAfterOwnHash, 'Gold stops reflected-weapon ownership at the real OWN edge');
  assert.equal(a1WorldDraws, 1, 'no Gold weapon image is drawn after real OWN');
  mirror.draw(ctx);
  const actorAfterOwnHash = pixelHash(view);
  win.APEX_ARSENAL_AV.drawEquippedWeapon(ctx, mirror, mirror.data.arsenal);
  assert.notEqual(pixelHash(view), actorAfterOwnHash, 'the actual equipped weapon remains in the Arsenal foreground');
  assert.equal(equippedWeaponDraws, 1, 'the real Arsenal foreground draws the held weapon once');
  assert.equal(goldHeldDraws, 0, 'Gold never double-draws its demo held weapon after OWN');
  assert.equal(gold.M.copyOn, false, 'Gold never claims gameplay copy materialisation');
  assert.equal(canvasCreations, actorCanvasCount, 'actor and A1 drawing reuse the baked/cached surfaces');

  bus.emit('MirrorA1End', { hero: 'MIRROR', castId: 'a1-pistol-1' });
  assert.equal(gold.A1.on, true, 'real A1 end is applied at the post-step edge, not inside the event callback');
  bridge.tick(1 / 120);
  assert.equal(gold.A1.on, false);
  assert.equal(bridge.inspect().records[0].realOwn, false);

  bus.emit('MirrorA1Cast', {
    hero: 'MIRROR', castId: 'a1-late-whiff', combatantIndex: 0,
    weaponId: 'PISTOL', whiff: false,
  });
  bridge.tick(1 / 120);
  assert.equal(gold.A1.on, true);
  bus.emit('MirrorA1Whiff', { hero: 'MIRROR', castId: 'a1-late-whiff', reason: 'equip-failed' });
  assert.equal(gold.A1.whiff, true, 'real OWN failure changes only the active visual to a whiff');
  const whiffHash = pixelHash(view);
  bridge.renderArenaWorldEffects(ctx, { stage: 'after-world-before-fighters' });
  assert.equal(pixelHash(view), whiffHash, 'a failed real OWN cannot leave the reflected weapon active');
  assert.equal(a1WorldDraws, 1, 'a failed real OWN suppresses the reflected image as well');
  bus.emit('MirrorA1End', { hero: 'MIRROR', castId: 'a1-late-whiff' });
  bridge.tick(1 / 120);
  assert.equal(gold.A1.on, false);

  const runtimeSource = fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js', 'utf8');
  const fullRosterSource = fs.readFileSync('public/game/core/apexFullRosterQa.js', 'utf8');
  const arsenalQuestSource = fs.readFileSync('public/game/modes/arsenalQuestRuntime.js', 'utf8');
  assert.match(runtimeSource, /APEX_MIRROR_PRESENTATION\?\.renderArenaWorldEffects\?\.\(ctx, provenance\)/,
    'the Hero world seam dispatches Mirror presentation once');
  assert.match(fullRosterSource, /stage: 'after-world-before-fighters'/,
    'the effective world renderer preserves the protected presentation stage');
  assert.match(arsenalQuestSource, /drawEquippedWeapons\(ctx\)/,
    'real Arsenal held-weapon foreground remains outside the Gold actor pass');
  assert.match(fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js', 'utf8'),
    /state\.gold\.rigFull\(ctx, state\.gold\.M\.x, state\.gold\.M\.y\)/,
    'Mirror actor uses the authored Gold body rig, not demo gameplay draw/update');

  bridge.dispose();
  assert.equal(Fighter.prototype.draw, originalFighterDraw, 'dispose restores the original draw chain');
  console.log('[MIRROR G2A actor/A1] PASS — Gold body ownership, preserved status/actor chain, cached real Arsenal reflection, no held-weapon double draw after OWN, real whiff/end edges, no frame canvas/image allocation.');
} finally {
  try { win.APEX_MIRROR_PRESENTATION?.dispose(); } catch (error) {}
  dom.window.close();
}
