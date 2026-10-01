/* FROST V1 presentation adapter (Slice D / F12).
 *
 * Gameplay owns casts, lanes, trail, contact, statuses, and expiry
 * (APEX_FROST truth + hero mechanics executors). This adapter owns NOTHING
 * mechanical: it mirrors truth into the Fusion Gold FrostEngine rig
 * (APEX_FROST_GOLD) and draws it through the live production frame.
 *
 * Laws:
 * - One FrostEngine per live ICE combatant (mirror-safe). Engine space IS
 *   world space (1000x1000, GAME_SIZE); no panel remap.
 * - The Gold demo `step()` (locomotion/input/demo enemy/demo bullets) was cut
 *   by the bridge; the per-frame driver below replays the exact Gold update
 *   law (mode dispatch, free-hist carve, breath timeout, idle life,
 *   accel-driven lag springs, aim damp, shell/crust/gun updates, ice.update)
 *   while production owns the fighter position (fx/fy/fvx/fvy synced in).
 * - A1 release sync: visual cast starts on pending-appear; modeT is held at 0
 *   until (releaseAt - 0.20) so the Gold 0.20s pressure->release beat lands
 *   exactly on the gameplay release. Lane length/travel come from gameplay
 *   truth (a1cfg.length, LAW.frontSeconds).
 * - A2 trail follows REAL positions (synced fx/fy feed Gold updateA2, which
 *   resamples every 9px vs gameplay nodeSpacing 10 — same path).
 * - Width calibration: the canonical Gold is APEX-accurate, so its authored
 *   ice widths ARE the gameplay widths (A1_WIDTH 160 == a1cfg.width,
 *   A2_WIDTH 120 == a2cfg.trailWidth): laneK/trailK derive from
 *   cfg / GOLD_REF and land on 1.0 for stock Level-1 truth. No showcase
 *   rescaling of authored material, and the rendered ice still covers the
 *   mechanic envelope exactly (Hunter precedent: visible == mechanic).
 * - Body scale (F12.22): the Gold authors its actor against its OWN fighter
 *   radius GOLD_REF.FROST_R (34 world units; silhouette ~74x93). Production
 *   therefore uses kBody = fighter.radius / GOLD_REF.FROST_R, which restores
 *   the authored body-to-fighter proportion at real battle scale instead of
 *   the old 2*radius/93 guess (which drew Frost at 73% of authored size).
 *   engine.bodyK carries the same factor into Gold body-frame world offsets
 *   (vent -> lane origin) so the breath still emerges from the vent. Ice and
 *   shapes stay 1:1 world.
 * - Render isolation (F12.20/F12.23): EVERY Frost draw entry runs inside
 *   isolated(ctx, fn): save/restore plus an unconditional re-assert of
 *   transform/alpha/composite/filter/shadow/smoothing/line state, so a throw
 *   inside Gold material can never leak canvas state into the rest of the
 *   scene (that leak is what scaled the opponent and flickered the arena).
 * - Clock mapping: engine.t advances with presentation dt in the same frame
 *   loop as the game clock, so engineT = clock + C with C captured at first
 *   tick (drift-guarded). All gameplay-anchored visual expiry (lane expire,
 *   slot thaw) maps through C.
 * - Single-victim visual stores: shell/crusts/seize are per-engine Gold state
 *   positioned at the LATEST Frost victim (battle-typical: one enemy). Victim
 *   switch clears stale crusts; shell latest-wins. Multi-victim overlap is a
 *   documented visual-only edge (mechanics untouched).
 * - Projectile frost, muzzle, hit patches, contact bursts, steal transfer,
 *   gun frost overlays, and slot frost overlays all read production objects
 *   (projectiles, holders, slots) + truth tags (__hr.frost, __frostFrozen,
 *   __frostFreezeSource) + bus events (ColdShock, Steal only — everything
 *   else is poll-derived from inspect()/body state, unambiguous in mirrors).
 * - Draw order follows the Gold RENDER law: wet decals -> ice composite
 *   (offscreen, alpha 0.97) -> floor shapes -> A1 macro front -> (production
 *   projectiles/fighters) -> guns-behind rule N/A (Arsenal foreground owns
 *   guns; documented) -> body + breath + preCore -> ribbons/air shapes ->
 *   bullet frost -> transfer guns -> victim frost/shell. Bypass debt: when a
 *   living Frost body bypasses the inner Fighter.draw chain, Hunter's
 *   renderPostWorld and Crystala's world-construct + bloom passes are
 *   re-run explicitly (same law as Crystala's bypass of Hunter).
 */
(function (g) {
'use strict';
if (g.APEX_FROST_PRESENTATION) return;

const G = g.APEX_FROST_GOLD || null;
const FR = g.APEX_FROST || null;
const HR = g.APEX_HERO_REWORK || null;

const api = g.APEX_FROST_PRESENTATION = { ready: false };
let warned = 0;
let sharedArt = null; // { mips, shadow } once the first engine load resolves
function warnOnce(e) {
  if (warned < 6) { warned++; try { console.warn('[frost-presentation]', e); } catch (_) {} }
}

// Authored Gold reference geometry (exported by the bridge from the canonical
// Gold; the fallback mirrors those exact numbers for a partial boot).
const REF = (G && G.GOLD_REF) || {
  FROST_R: 34, ENEMY_R: 41, K: 0.132, ART_W: 622, ART_H: 767,
  A1_WIDTH: 160, A1_CAST: 0.25, A2_WIDTH: 120, A2_SEGMENT_LIFE: 3.5, A1_FLOOR_LIFE: 4.5,
  TRAIL_STEP: 9, TRAIL_LEN_MIN: 12, TRAIL_LEN_MAX: 16, TRAIL_FOOT_Y: 6,
};
const GUN_OVERLAY_REF = 33;
// Gold modeT at which the authored pressure->release beat fires. Taken from
// the canonical Gold (FROST_TUNE.A1_CAST) so the visual release lands exactly
// on the gameplay release instead of drifting behind it.
const A1_RELEASE_BEAT = +((G && G.GOLD_REF && G.GOLD_REF.A1_CAST) || 0.25);
const A1_GHOST_FADE = 0.35;   // lane melt after mechanic expiry
const A2_SEG_FADE = 0.40;     // trail segment melt after segLife

function clock() {
  try {
    if (HR && HR.AIL && typeof HR.AIL.clock === 'function') return HR.AIL.clock();
    if (HR && HR.match && HR.match.api && typeof HR.match.api.clock === 'function') return HR.match.api.clock();
  } catch (e) {}
  return 0;
}
function combatants() {
  try { return (HR && HR.match && HR.match.combatants) || []; } catch (e) { return []; }
}
function isFrostCt(ct) { return !!ct && !ct.facade && ct.heroId === 'ICE'; }
function isFrostBody(f) {
  try { return HR && typeof HR.byCombatant === 'function' && (HR.byCombatant(f) || {}).heroId === 'ICE'; }
  catch (e) { return false; }
}
function ctOfBody(b) {
  try { return (HR && typeof HR.byCombatant === 'function') ? HR.byCombatant(b) : null; } catch (e) { return null; }
}
function allBodies() {
  try {
    const apiM = HR && HR.match && HR.match.api;
    if (apiM && typeof apiM.allBodies === 'function') return apiM.allBodies() || [];
  } catch (e) {}
  return (g.fighters || []).slice();
}
function bodiesOf(ct, own) {
  try {
    const apiM = HR && HR.match && HR.match.api;
    if (!apiM) return ct && ct.anchor ? [ct.anchor] : [];
    return own ? (apiM.ownBodies(ct) || []) : (apiM.enemyBodies(ct) || []);
  } catch (e) { return ct && ct.anchor ? [ct.anchor] : []; }
}
function pxFromCtx(c) {
  try {
    const m = c && typeof c.getTransform === 'function' ? c.getTransform() : null;
    const a = m && Math.abs(m.a) ? Math.abs(m.a) : 1;
    return Math.min(2.5, Math.max(0.4, 1 / Math.max(0.05, a)));
  } catch (e) { return 1; }
}
function angTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

// ------------------------------------------------------- render isolation
// F12.20 / F12.23: after a Frost draw pass the host renderer must be in the
// SAME state it was in before. ctx.save()/restore() alone is not enough: an
// exception inside Gold material (or an unbalanced restore in third-party
// code) can leave the transform, alpha, composite or filter changed, and a
// lost transform makes EVERY later draw in the frame (opponent, floor, HUD)
// render at the wrong scale — the corruption the owner playtested.
const CTX_PROPS = ['globalAlpha', 'globalCompositeOperation', 'filter',
  'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY',
  'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset',
  'strokeStyle', 'fillStyle', 'font', 'textAlign', 'textBaseline',
  'imageSmoothingEnabled', 'imageSmoothingQuality'];
let stateLeaks = 0;
function snapshotCtx(ctx) {
  const snap = { m: null, p: {}, dash: null };
  try { snap.m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null; } catch (e) {}
  for (const k of CTX_PROPS) { try { snap.p[k] = ctx[k]; } catch (e) {} }
  try { if (typeof ctx.getLineDash === 'function') snap.dash = ctx.getLineDash(); } catch (e) {}
  return snap;
}
function restoreCtx(ctx, snap) {
  let leaked = false;
  try {
    if (snap.m && typeof ctx.setTransform === 'function') {
      let cur = null;
      try { cur = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null; } catch (e) {}
      if (cur && (Math.abs(cur.a - snap.m.a) > 1e-6 || Math.abs(cur.b - snap.m.b) > 1e-6
        || Math.abs(cur.c - snap.m.c) > 1e-6 || Math.abs(cur.d - snap.m.d) > 1e-6
        || Math.abs(cur.e - snap.m.e) > 1e-4 || Math.abs(cur.f - snap.m.f) > 1e-4)) leaked = true;
      ctx.setTransform(snap.m);
    }
  } catch (e) {}
  for (const k of CTX_PROPS) {
    try { if (ctx[k] !== snap.p[k]) { if (k === 'globalAlpha' || k === 'globalCompositeOperation' || k === 'filter') leaked = true; ctx[k] = snap.p[k]; } } catch (e) {}
  }
  try { if (snap.dash && typeof ctx.setLineDash === 'function') ctx.setLineDash(snap.dash); } catch (e) {}
  if (leaked) stateLeaks++;
  return leaked;
}
// Every Frost draw entry goes through this. Nothing Frost draws may escape it.
function isolated(ctx, fn) {
  if (!ctx) return;
  const snap = snapshotCtx(ctx);
  let saved = false;
  try { ctx.save(); saved = true; } catch (e) {}
  try { fn(); }
  catch (err) { warnOnce(err); }
  finally {
    if (saved) { try { ctx.restore(); } catch (e) {} }
    restoreCtx(ctx, snap);
  }
}

// ---------------------------------------------------------------- states
// Map (iterable) keyed by anchor; swept every tick against live combatants.
const liveStates = new Map();
let lastMatch = null;

function frostCfg(ct) {
  const sk = (ct && ct.skills) || {};
  return {
    a1: (sk.A1 && sk.A1.cfg) || {},
    a2: (sk.A2 && sk.A2.cfg) || {},
    psv: (sk.PASSIVE && sk.PASSIVE.cfg) || {},
  };
}

function createState(ct) {
  const f = ct.anchor;
  const cfg = frostCfg(ct);
  const e = new G.FrostEngine();
  // Art load is per-engine with a module-shared promise (first engine wins),
  // but mips live ON the engine: every later engine backfills from the
  // shared art cache so rematches/mirrors render (mips are read-only after
  // load, safe to share).
  if (sharedArt) {
    e.mips = sharedArt.mips;
    e.shadowCanvas = sharedArt.shadow;
    e.ready = true;
    api.ready = true;
  } else if (!createState.loadStarted && typeof e.load === 'function') {
    createState.loadStarted = true;
    try {
      e.load().then(() => {
        sharedArt = { mips: e.mips, shadow: e.shadowCanvas };
        for (const [, other] of liveStates) {
          if (other.engine !== e) {
            other.engine.mips = e.mips;
            other.engine.shadowCanvas = e.shadowCanvas;
            other.engine.ready = true;
          }
        }
        api.ready = true;
      }).catch((err) => { api.error = String(err); });
    } catch (err) { api.error = String(err); }
  }
  const S = {
    ct, fighter: f, engine: e, cfg,
    tOff: null, // engine.t - clock()
    // Gold-authored body reference -> real APEX fighter radius (F12.22).
    kBody: ((f && f.radius) || 75) / REF.FROST_R,
    // Authored ice width -> gameplay mechanic width (1.0 on stock Lv1 truth).
    laneK: (+cfg.a1.width || REF.A1_WIDTH) / REF.A1_WIDTH,
    trailK: (+cfg.a2.trailWidth || REF.A2_WIDTH) / REF.A2_WIDTH,
    a1: { pending: false, castClock: 0, holdUntil: 0, releaseClock: -99, expireClock: -99, releasedSeen: false, casts: [], castAng: 0, startedId: 0, startClock: -99, replays: 0 },
    a2: { live: false, started: false, hydrated: 0 },
    castQ: [],       // deferred Gold cast admissions (FIFO, truth-checked)
    castSeq: 0, castStarts: 0, castDeferred: 0, castDropped: 0,
    victim: null, // { id, seizeE }
    froze: new Map(), // bodyId -> { timer, startE }
    shocks: new Map(), // bodyId -> { atE, until }
    guns: new Map(), // holder|slot|transferKey -> { vg, kind, ... }
    flecks: new Map(), // projectile -> { b }
    heldVg: null,
    suppressHolder: null,
    match: HR ? HR.match : null,
  };
  // Width calibration wrapper: Gold internal detail generates at the scaled
  // size through the untouched ice.add path.
  const ice = e.ice;
  const baseAdd = ice.add.bind(ice);
  ice.add = function (x, y, ang, L, W, born, kind, opt) {
    // Authored material, mechanic envelope: only the width law is mapped
    // from Gold truth to gameplay truth (both are 160/120 at Level 1, so
    // this is the identity in stock play). Node LENGTH, spacing, jag, spur
    // and every other authored property stay exactly as the Gold wrote them.
    if (kind === 'lane') W = W * S.laneK;
    else if (kind === 'trail' || kind === 'pad') W = W * S.trailK;
    return baseAdd(x, y, ang, L, W, born, kind, opt);
  };
  e.aim = 0;
  // Gold engine truth hooks: body scale + gameplay-owned lifetimes.
  e.bodyK = S.kBody;
  e.a1FloorLife = +cfg.a1.floorLifetime || REF.A1_FLOOR_LIFE;
  e.a2SegLife = +cfg.a2.segmentLifetime || REF.A2_SEGMENT_LIFE;
  e.a2Active = +cfg.a2.activeWindow || 3.0;
  liveStates.set(f, S);
  return S;
}

function sweepStates() {
  const cts = combatants();
  const alive = new Set();
  for (const ct of cts) if (isFrostCt(ct) && ct.anchor) alive.add(ct.anchor);
  for (const [f, S] of liveStates) {
    if (!alive.has(f)) liveStates.delete(f);
    else { S.ct = cts.find((c) => c.anchor === f) || S.ct; S.fighter = f; }
  }
  const m = HR ? HR.match : null;
  if (m !== lastMatch) {
    lastMatch = m;
    try { if (G && typeof G.clearShapes === 'function') G.clearShapes(); } catch (e) {}
    for (const [, S] of liveStates) resetEngineVisuals(S, m);
  }
}

function resetEngineVisuals(S, m) {
  const e = S.engine;
  try {
    e.ice.clear();
    e.shell = null;
    e.crusts.length = 0;
    e.mode = 'free'; e.modeT = 0;
    e.breath = { t0: e.t, on: false };
    e.huntGoal = 0;
  } catch (err) { warnOnce(err); }
  S.tOff = null;
  S.a1 = { pending: false, castClock: 0, holdUntil: 0, releaseClock: -99, expireClock: -99, releasedSeen: false, casts: [], castAng: 0, startedId: 0, startClock: -99, replays: 0 };
  S.a2 = { live: false, started: false, hydrated: 0 };
  S.castQ.length = 0;
  S.castSeq = 0; S.castStarts = 0; S.castDeferred = 0; S.castDropped = 0;
  S.victim = null;
  S.froze.clear(); S.shocks.clear(); S.guns.clear(); S.flecks.clear();
  S.heldVg = null; S.suppressHolder = null; S.match = m || null;
}

function stateFor(ct) {
  if (!isFrostCt(ct) || !ct.anchor) return null;
  return liveStates.get(ct.anchor) || createState(ct);
}
function firstState() {
  for (const [, S] of liveStates) return S;
  return null;
}

// ------------------------------------------------------------ gun geometry
// Exact production formulas (arsenalPresentationRuntime): held guns sit at
// radius*0.78 along the independent aim angle; floor slots at slot + bob.
function gunLongSide(weaponId, def) {
  try {
    const AV = g.APEX_ARSENAL_AV;
    if (AV && typeof AV.weaponDrawParams === 'function') {
      const p = AV.weaponDrawParams(weaponId, (def && def.category) || '', 75);
      if (p && p.targetLongSide) return p.targetLongSide;
    }
    const table = (g.APEX_ARSENAL_CONFIG && g.APEX_ARSENAL_CONFIG.FIREARM_LONG_SIDE) || {};
    if (table[weaponId]) return table[weaponId];
  } catch (e) {}
  return 145;
}
function heldGunPose(f, h) {
  const aim = (h && h.meta && h.meta.aimAngle != null) ? h.meta.aimAngle
    : Math.atan2((f && f.dir && f.dir.y) || 0, (f && f.dir && f.dir.x) || 1);
  const pose = (h && h.meta && h.meta.pose) || {};
  const off = ((f && f.radius) || 75) * 0.78 + (pose.localX || 0) - (pose.recoil || 0);
  const lat = pose.localY || 0;
  return {
    x: f.x + Math.cos(aim) * off + Math.cos(aim + Math.PI / 2) * lat,
    y: f.y + Math.sin(aim) * off + Math.sin(aim + Math.PI / 2) * lat,
    a: aim,
    longSide: gunLongSide(h && h.weaponId, h && h.def),
  };
}
function slotGunPose(slot) {
  let bob = 0;
  try { bob = Math.sin(((g.APEX_ARSENAL && g.APEX_ARSENAL.state) || {}).time * 3.1 + slot.id) * 4; } catch (e) {}
  const CFG = g.APEX_ARSENAL_CONFIG || {};
  const table = CFG.FIREARM_LONG_SIDE || {};
  const mul = (CFG.FIREARM_DISPLAY_MODE && CFG.FIREARM_DISPLAY_MODE.floor) || 0.92;
  const a = slot.weaponId === 'STORMBREAKER' && CFG.STORMBREAKER ? (CFG.STORMBREAKER.floorAngleRad || 0) : 0;
  return { x: slot.x, y: slot.y + bob, a, longSide: table[slot.weaponId] ? table[slot.weaponId] * mul : 118 };
}

// ------------------------------------------------------------------ events
function engineOfShooterForVictim(victimBody) {
  if (!victimBody) return null;
  for (const ct of combatants()) {
    if (!isFrostCt(ct)) continue;
    const foes = bodiesOf(ct, false);
    if (foes.indexOf(victimBody) >= 0) return liveStates.get(ct.anchor) || null;
  }
  // Reflected freeze on a Frost own-body: the owner's engine draws it.
  const own = ctOfBody(victimBody);
  if (isFrostCt(own)) return liveStates.get(own.anchor) || null;
  return firstState();
}

function onColdShock(ev) {
  const p = (ev && ev.payload) || {};
  if (p.body == null) return;
  const victim = allBodies().find((b) => b && b.id === p.body) || null;
  const S = engineOfShooterForVictim(victim);
  if (!S) return;
  const e = S.engine, f = S.fighter;
  const now = clock();
  const dur = +((S.cfg.a2 && S.cfg.a2.coldShockDuration) || 1.0);
  S.shocks.set(p.body, { atE: e.t, until: now + dur });
  // A2 contact burst at the midpoint; normal points Frost-ward (recoil dir).
  if (victim && f) {
    const dx = f.x - victim.x, dy = f.y - victim.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const px = (f.x + victim.x) / 2, py = (f.y + victim.y) / 2;
    setVictim(S, victim.id, e.t);
    try { e.contact(nx, ny, px, py, null); } catch (err) { warnOnce(err); }
    // Production hunts CONTINUE after contact (re-contact re-procs). The
    // canonical Gold no longer gates the trail on contact at all; clear the
    // overlap marker so nothing latches and the trail keeps laying material.
    try { e.a2.overlap = false; } catch (err) {}
    // Contact crusts belong to the victim rim: refresh rim anchors.
    try { e.updateCrusts(victim.x, victim.y, victim.radius || 75, 0); } catch (err) {}
  }
}

function onSteal(ev) {
  const p = (ev && ev.payload) || {};
  if (!p.weapon) return;
  // Route: the ICE combatant whose anchor now carries the stolen holder.
  let S = null;
  for (const ct of combatants()) {
    if (!isFrostCt(ct) || !ct.anchor) continue;
    const h = ct.anchor.data && ct.anchor.data.arsenal;
    if (h && h.__frostFrozen && h.__frostFrozen.stolen) { S = liveStates.get(ct.anchor) || null; if (S) break; }
  }
  if (!S) S = firstState();
  if (!S) return;
  const e = S.engine, f = S.fighter;
  const carrier = (p.from != null && allBodies().find((b) => b && b.id === p.from)) || null;
  const sx = carrier ? carrier.x : f.x, sy = carrier ? carrier.y : f.y;
  const vg = e.mkGun(sx, sy, 0, 'transfer');
  vg.a0 = 0; vg.tx0 = sx; vg.ty0 = sy;
  const dockDur = (FR && FR.LAW && +FR.LAW.stealDockSeconds) || 0.44;
  vg.tStart = e.t; vg.tDur = dockDur;
  let spin = 1;
  try { spin = (G.rnd(0, 1) < 0.5 ? -1 : 1) * G.TAU * 1.25; } catch (err) {}
  vg.spin = spin;
  vg.frostStart = e.t; vg.snapAt = e.t + 0.3; vg.thawAt = Infinity;
  const holder = f && f.data ? f.data.arsenal : null;
  S.guns.set('steal:' + e.t.toFixed(3), {
    vg, kind: 'transfer', weapon: p.weapon, holder,
    dockAt: (p.dockAt != null ? p.dockAt : clock() + dockDur),
    longSide: gunLongSide(p.weapon, holder && holder.def),
  });
  // In flight: the base equipped draw for this exact holder is suppressed
  // (holderSuppressed) so the weapon exists in exactly one place on screen.
  S.suppressHolder = holder || null;
}

function subscribe() {
  try {
    const bus = HR && HR.AIL && HR.AIL.bus;
    if (!bus || typeof bus.on !== 'function' || subscribe.done) return;
    subscribe.done = true;
    bus.on('FrostColdShock', onColdShock);
    bus.on('FrostSteal', onSteal);
  } catch (e) { warnOnce(e); }
}

// ------------------------------------------------- transparent fire/hit taps
// Call-through FIRST (gameplay can never break); presentation after, isolated.
function tapFirePath() {
  if (!FR || tapFirePath.done) return;
  tapFirePath.done = true;
  try {
    if (typeof FR.tagFrozenBullet === 'function') {
      const base = FR.tagFrozenBullet.bind(FR);
      FR.tagFrozenBullet = function (ctx, pr, owner) {
        const r = base(ctx, pr, owner);
        try {
          const ct = owner ? ctOfBody(owner) : null;
          if (isFrostCt(ct) && pr) {
            const S = liveStates.get(ct.anchor) || null;
            if (S) {
              if (!S.heldVg) S.heldVg = S.engine.mkGun(S.fighter.x, S.fighter.y, 0, 'frost');
              S.heldVg.a = Math.atan2(pr.vy || 0, pr.vx || 1);
              S.engine.muzzle(S.heldVg, pr.x, pr.y);
            }
          }
        } catch (err) { warnOnce(err); }
        return r;
      };
    }
  } catch (e) { warnOnce(e); }
  try {
    if (typeof FR.noteBodyHit === 'function') {
      const base = FR.noteBodyHit.bind(FR);
      FR.noteBodyHit = function (pr, target) {
        try {
          const tag = pr && pr.__hr && pr.__hr.frost;
          if (tag && tag.group && target && target.hp > 0) {
            const shooter = ctOfBody(tag.shooter || (pr && pr.owner));
            if (isFrostCt(shooter)) {
              const S = liveStates.get(shooter.anchor) || null;
              if (S) {
                setVictim(S, target.id, S.engine.t);
                S.engine.hitPatch(target.x, target.y, target.radius || 75,
                  Math.atan2((pr && pr.vy) || 0, (pr && pr.vx) || 1));
              }
            }
          }
        } catch (err) { warnOnce(err); }
        return base(pr, target);
      };
    }
  } catch (e) { warnOnce(e); }
}

function setVictim(S, id, seizeE) {
  if (!S) return;
  if (!S.victim || S.victim.id !== id) {
    try { S.engine.crusts.length = 0; } catch (e) {}
    S.victim = { id, seizeE: seizeE != null ? seizeE : (S.engine ? S.engine.t : 0) };
  }
}

// ------------------------------------------------------- per-frame sim tick
function syncClock(S, now) {
  const e = S.engine;
  if (S.tOff == null) S.tOff = e.t - now;
  else if (Math.abs(e.t - (now + S.tOff)) > 1.0) S.tOff = e.t - now; // resync
  return S.tOff;
}

// ------------------------------------------------- Gold cast admission queue
// Gameplay may run A1 and A2 independently (both are live truth at once);
// Gold serializes them through a single `mode` and REJECTS castA1/castA2
// while the other mode owns the actor. A rejected call used to drop that
// visual lifecycle forever. Presentation is truth-driven, so instead of
// dropping it we DEFER it: the cast waits in a FIFO queue and starts the
// moment Gold can accept it. Nothing here touches gameplay timing or state
// — the gameplay ability already ran; only the visual start is deferred,
// and a deferred cast is retired only when its own gameplay truth is gone.
function canAcceptCast(S) {
  try { return S.engine.mode === 'free'; } catch (e) { return false; }
}

// ---- deferred admission: replay from authoritative gameplay history -------
// A queued cast is admitted after gameplay has already moved on. Starting it
// "here, now" would put the lane under Frost's CURRENT feet and cut the hunt
// path off at the admission point. Both are reconstructed from gameplay truth
// instead, through Gold's own buildLane / ice.add — no second mechanic, no
// approximated effect, no steering or teleport.

// A1: gameplay released while Gold was busy. The lane is rebuilt at the real
// release origin, along the committed direction, with the real front window
// back-dated (born times in the past = the front the player already saw) and
// the one shared gameplay expiry.
function replayA1Lane(S, q, now) {
  const e = S.engine, L = q.lane;
  const off = S.tOff || 0;
  const ang = Math.atan2(L.dy, L.dx);
  e.a1Len = L.len;
  e.a1Travel = Math.max(0.05, L.frontDoneAt - L.frontStartAt);
  Object.assign(e.a1, {
    ang, released: false, bite: true, ended: true, front: L.len, frontPrev: L.len,
    nodes: [], rowAcc: 0, lobeAcc: 0, chipAcc: 0,
  });
  // The lane is rebuilt at the AUTHORITATIVE release origin (gameplay truth),
  // not at Frost's current position: a deferred visual must not drag the
  // floor to wherever Frost has since walked.
  e.a1Origin = { x: L.ox, y: L.oy };
  try { e.buildLane(L.frontStartAt + off, L.len, e.a1Travel); }
  catch (err) { warnOnce(err); }
  finally { e.a1Origin = null; }
  e.a1.released = true;
  // Lifetime stays the ORIGINAL gameplay lane expiry (never a fresh floor
  // from admission time).
  S.a1.casts.push({
    nodes: (e.a1.nodes || []).map((w) => w && w.n).filter(Boolean),
    expireE: L.expireAt + off,
  });
  if (S.a1.casts.length > 4) S.a1.casts.shift();
  S.a1.releasedSeen = true;   // the generic capture must not re-anchor it
  S.a1.replays = (S.a1.replays || 0) + 1;
}

// A2: the hunt has been running (and turning/bouncing) while Gold was busy.
// The Gold trail is reconstructed from the authoritative gameplay movement
// history through GOLD'S OWN trail constructor and GOLD'S OWN node law
// (F12.19): the history polyline is resampled at the Gold's authored
// TRAIL_STEP (9 px of real travel — the same resample the live path uses),
// each node gets the authored width/length/jag/spur/lock recipe and its real
// historical birth time, so the hydrated section is materially identical to
// the section the live path would have laid. No island chunks, no second
// trail algorithm, no smoothing, no synthetic geometry.
function hydrateA2Trail(S, insp, now) {
  const e = S.engine, A = e.a2;
  const hist = (insp && insp.trailNodes) || [];
  if (hist.length < 2) return 0;
  const off = S.tOff || 0;
  const segLife = +((S.cfg.a2 && S.cfg.a2.segmentLifetime) || REF.A2_SEGMENT_LIFE);
  const STEP = REF.TRAIL_STEP || 9;
  const FOOT = REF.TRAIL_FOOT_Y || 6;
  const HALF = (REF.A2_WIDTH || 120) * 0.5;
  let laid = 0, first = true;
  // Walk the real path; emit one Gold node every STEP px, interpolating the
  // birth time along the segment so the melt order matches what the player
  // already saw.
  let carry = 0, last = hist[0];
  for (let k = 1; k < hist.length; k++) {
    const a = hist[k - 1], b = hist[k];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) continue;
    const ang = Math.atan2(dy, dx);
    const dt = Math.max(0, b.bornAt - a.bornAt);
    let travelled = STEP - carry;
    while (travelled <= d) {
      const u = travelled / d;
      const x = a.x + dx * u, y = a.y + dy * u;
      const born = a.bornAt + dt * u;
      if (now - born < segLife) {
        if (first) {
          // The ignition bite belongs to where the hunt really started.
          first = false;
          const pad = e.ice.add(hist[0].x, hist[0].y + FOOT, ang, 24, HALF, hist[0].bornAt + off,
            'pad', { lockDur: 0.5, jag: 0.24, activeUntil: hist[0].bornAt + off + segLife });
          pad.decayAt = pad.activeUntil;
          A.trail.push(pad);
        }
        const W = HALF + e.rng.range(-2, 2);
        const n = e.ice.add(x - Math.cos(ang) * 3, y + FOOT - Math.sin(ang) * 3, ang,
          e.rng.range(REF.TRAIL_LEN_MIN || 12, REF.TRAIL_LEN_MAX || 16), W, born + off, 'trail',
          { lockDur: 0.45, spurChance: 0.015, jag: 0.09, activeUntil: born + off + segLife });
        n.decayAt = n.activeUntil;
        A.trail.push(n);
        laid++;
        A.crustAcc += STEP;
        if (A.crustAcc > 26) { A.crustAcc = 0; A.side = -A.side; }
      }
      last = { x, y, bornAt: born };
      travelled += STEP;
    }
    carry = (d - (travelled - STEP));
    if (!(carry >= 0)) carry = 0;
    if (k === hist.length - 1 && (d - (travelled - STEP)) >= 0) last = last;
  }
  if (laid) {
    // Continue the live path from the real path end: the next Gold node is
    // the next authored STEP of real travel, so there is no jump node, no
    // duplicated section and no restart at the admission point.
    A.lastNode.x = last.x; A.lastNode.y = last.y;
    A.kicked = true;              // the ignition beat already happened
    if (A.activeStart < 0) A.activeStart = (hist[0].bornAt + off);
    // Seed the turn-history window from the real path so the first live
    // carve decision uses real motion, not a cold start.
    A.hist.length = 0;
    for (let k = Math.max(1, hist.length - 10); k < hist.length; k++) {
      A.hist.push(Math.atan2(hist[k].y - hist[k - 1].y, hist[k].x - hist[k - 1].x));
    }
  }
  S.a2.hydrated = (S.a2.hydrated || 0) + laid;
  return laid;
}
function startCast(S, q, now, insp) {
  const e = S.engine;
  if (q.kind === 'a1') {
    if (q.lane) { replayA1Lane(S, q, now); }
    else {
      e.a1Len = q.len;
      e.a1Travel = q.travel;
      try { e.castA1(q.ang); } catch (err) { warnOnce(err); }
    }
    S.a1.startedId = q.castId;
    S.a1.startClock = now;
  } else {
    try { e.castA2(); } catch (err) { warnOnce(err); }
    S.a2.started = true;
    // No-ops on an immediate start (the window has a single origin node).
    try { hydrateA2Trail(S, insp, now); } catch (err) { warnOnce(err); }
  }
  S.castStarts = (S.castStarts || 0) + 1;
}

// Truth check for a still-queued cast: an A1 whose gameplay lane has already
// expired, or an A2 whose gameplay window has closed, has no truth left to
// present and is retired instead of being started late.
function castStillTrue(S, q, now) {
  // A replayable A1 knows its real gameplay expiry; otherwise the cast-time
  // bound applies. A2 is true while its gameplay window is live.
  if (q.kind === 'a1') return q.lane ? now < q.lane.expireAt : now <= q.validUntil;
  return !!S.a2.live;
}

function requestCast(S, q, now, insp) {
  if (canAcceptCast(S) && !S.castQ.length) { startCast(S, q, now, insp); return; }
  // Same-kind supersede: a newer cast of the same ability replaces the older
  // queued one (the older visual's truth is already being overwritten).
  const i = S.castQ.findIndex((o) => o.kind === q.kind);
  if (i >= 0) S.castQ.splice(i, 1);
  S.castQ.push(q);
  S.castDeferred = (S.castDeferred || 0) + 1;
}

// Called once per frame AFTER the mode update, so a mode that ended this
// frame admits its queued successor on the very same frame.
function pumpCastQueue(S, now, insp) {
  while (S.castQ.length && canAcceptCast(S)) {
    const q = S.castQ.shift();
    if (!castStillTrue(S, q, now)) { S.castDropped = (S.castDropped || 0) + 1; continue; }
    startCast(S, q, now, insp);
  }
}

function dropQueued(S, kind) {
  const i = S.castQ.findIndex((o) => o.kind === kind);
  if (i < 0) return false;
  S.castQ.splice(i, 1);
  return true;
}

function tickA1(S, ct, insp, now, dt) {
  const e = S.engine, f = S.fighter;
  const cfg1 = S.cfg.a1;
  const frontSeconds = (FR && FR.LAW && +FR.LAW.frontSeconds) || 0.45;
  if (insp && insp.pending && !S.a1.pending) {
    S.a1.pending = true;
    S.a1.castClock = now;
    S.a1.releasedSeen = false;
    // Direction is the gameplay CAST-ACCEPTANCE snapshot, never live f.dir:
    // a wall/body bounce during commitment turns the body, but the breath
    // and the front must stay on the lane gameplay committed to. Live dir is
    // only a fallback for a truth surface that predates the snapshot.
    const cast = insp.a1cast;
    const ang = cast
      ? Math.atan2(+cast.dy || 0, (+cast.dx === 0 && +cast.dy === 0) ? 1 : +cast.dx)
      : Math.atan2((f.dir && f.dir.y) || 0, (f.dir && f.dir.x) || 1);
    S.a1.castAng = ang;
    const commit = +cfg1.castCommit || 0.25;
    requestCast(S, {
      kind: 'a1', ang,
      len: +cfg1.length || 650,
      travel: frontSeconds,
      castId: (cast && cast.id) || ++S.castSeq,
      // A1 truth ends with its gameplay lane (front + floor lifetime).
      validUntil: now + commit + frontSeconds + (+cfg1.floorLifetime || 4.5),
    }, now, insp);
    S.a1.holdUntil = now + commit - A1_RELEASE_BEAT;
  }
  if (insp && !insp.pending && S.a1.pending) {
    S.a1.pending = false;
    S.a1.releaseClock = now;
    // The gameplay release is the authority for the beat: land the Gold
    // pressure->release on the SAME frame (float dt accumulation otherwise
    // leaves modeT a hair under A1_CAST and the whole visual runs a frame
    // behind the mechanic lane).
    if (e.mode === 'a1' && e.a1 && !e.a1.released && e.modeT < A1_RELEASE_BEAT) {
      e.modeT = A1_RELEASE_BEAT;
    }
    S.a1.expireClock = now + frontSeconds + (+cfg1.floorLifetime || 4.5);
    // Released while Gold is still busy: the visual can no longer be started
    // "here, now". Bind the queued cast to the authoritative lane record so
    // admission replays the real origin/direction/front window/expiry.
    const q = S.castQ.find((o) => o.kind === 'a1');
    if (q) {
      const lanes = insp.lanes || [];
      const L = lanes.filter((l) => l.castId === q.castId).pop() || lanes[lanes.length - 1];
      if (L && L.frontStartAt != null) {
        q.lane = { ox: L.ox, oy: L.oy, dx: L.dx, dy: L.dy, len: L.len,
          frontStartAt: L.frontStartAt, frontDoneAt: L.frontDoneAt, expireAt: L.expireAt };
      }
    }
  }
  // Bind the Gold lane build to the authoritative gameplay origin: the
  // mechanic lane starts at the release position, so the rendered lane must
  // start there too (visible == mechanic). Gold still owns the front travel,
  // node construction, irregularity and melt order.
  if (e.mode === 'a1' && !(e.a1 && e.a1.released)) {
    const lanes = (insp && insp.lanes) || [];
    const Lr = lanes.filter((l) => l.castId === S.a1.startedId).pop() || lanes[lanes.length - 1];
    e.a1Origin = (Lr && Lr.frontStartAt != null && now - Lr.frontStartAt < 1.0)
      ? { x: Lr.ox, y: Lr.oy } : null;
  } else if (e.a1 && e.a1.released) {
    e.a1Origin = null;
  }
  // Capture the released cast's nodes for exact gameplay-anchored decay.
  if (e.a1 && e.a1.released && !S.a1.releasedSeen) {
    S.a1.releasedSeen = true;
    S.a1.casts.push({
      nodes: (e.a1.nodes || []).map((w) => w && w.n).filter(Boolean),
      expireE: S.a1.expireClock + (S.tOff || 0),
    });
    if (S.a1.casts.length > 4) S.a1.casts.shift();
  }
  // Apply decay once (nodes born across the front travel share one expiry).
  for (const c of S.a1.casts) {
    if (c.applied) continue;
    c.applied = true;
    for (const n of c.nodes) {
      if (!n || n.decayAt !== Infinity) continue;
      n.decayAt = c.expireE;
      n.decayDur = A1_GHOST_FADE;
    }
  }
}

function tickA2(S, insp, now) {
  const e = S.engine;
  const live = !!(insp && insp.a2live);
  if (live && !S.a2.live) {
    S.a2.live = true;
    requestCast(S, { kind: 'a2' }, now, insp);
  } else if (!live && S.a2.live) {
    S.a2.live = false;
    // If the hunt visual never got its Gold slot, retire the queued start
    // (its truth is gone) — endA2 belongs only to a hunt that really began.
    if (dropQueued(S, 'a2') && !S.a2.started) S.castDropped = (S.castDropped || 0) + 1;
    else if (S.a2.started) { S.a2.started = false; try { e.endA2(); } catch (err) { warnOnce(err); } }
  }
  const segLife = +((S.cfg.a2 && S.cfg.a2.segmentLifetime) || 3.5);
  for (const n of e.ice.nodes) {
    if ((n.kind === 'trail' || n.kind === 'pad') && n.decayAt === Infinity) {
      n.decayAt = n.born + segLife;
      n.decayDur = A2_SEG_FADE;
    }
  }
  for (const c of e.ice.carves) {
    if (c.decayAt === Infinity) c.decayAt = c.born + segLife - 0.5;
  }
}

function tickVictims(S, ct, now, dt) {
  const e = S.engine;
  const seen = bodiesOf(ct, true).concat(bodiesOf(ct, false));
  const frostFrozen = [];
  const liveIds = new Set();
  for (const b of seen) {
    if (!b || b.hp <= 0) continue;
    liveIds.add(b.id);
    let frozen = false, timer = 0;
    try { frozen = b.hasStatus('freeze') && b.__frostFreezeSource === 'frost'; timer = (b.statuses && b.statuses.freeze && b.statuses.freeze.timer) || 0; } catch (err) {}
    if (!frozen) continue;
    frostFrozen.push(b);
    const prev = S.froze.get(b.id);
    if (!prev) {
      S.froze.set(b.id, { timer, startE: e.t });
      setVictim(S, b.id, e.t);
      const f = S.fighter;
      const hitAng = f ? angTo(f.x, f.y, b.x, b.y) : 0;
      try { e.freezeEnemy(hitAng, b.radius || 75, b.x, b.y, timer || 0.9); } catch (err) { warnOnce(err); }
    } else if (timer > prev.timer + 0.05) {
      // Refresh re-cages (newest owner resets): rebuild the shell.
      prev.timer = timer;
      setVictim(S, b.id, e.t);
      const f = S.fighter;
      const hitAng = f ? angTo(f.x, f.y, b.x, b.y) : 0;
      try { e.freezeEnemy(hitAng, b.radius || 75, b.x, b.y, timer || 0.9); } catch (err) { warnOnce(err); }
    } else {
      prev.timer = timer;
    }
  }
  // Prune per-victim freeze records the moment the Frost freeze is gone: no
  // stale freeze timers survive (F13.1). Refresh re-cage still works because
  // a refreshed body stays frost-frozen across the re-proc tick.
  const stillFrost = new Set(frostFrozen.map((b) => b.id));
  for (const id of Array.from(S.froze.keys())) if (!stillFrost.has(id)) S.froze.delete(id);
  for (const [id, sh] of S.shocks) if (now > sh.until) S.shocks.delete(id);
  // Victim priority: latest frozen, else latest live shock.
  if (frostFrozen.length) {
    const latest = frostFrozen[frostFrozen.length - 1];
    const rec = S.froze.get(latest.id);
    setVictim(S, latest.id, rec ? rec.startE : e.t);
  } else if (S.victim && !S.shocks.has(S.victim.id)) {
    let best = null;
    for (const [id, sh] of S.shocks) if (!best || sh.atE > best.atE) best = { id, atE: sh.atE };
    if (best) S.victim = { id: best.id, seizeE: best.atE };
    else S.victim = null;
  }
  const v = S.victim && seen.find((b) => b && b.id === S.victim.id && b.hp > 0);
  if (v) {
    S.victim.x = v.x; S.victim.y = v.y; S.victim.R = v.radius || 75;
    S.lastVPos = { x: v.x, y: v.y, R: v.radius || 75 };
  }
  // Crusts ALWAYS age (even with no live victim) so contact/hit rims can
  // never go stale; expiry chips fall at the last-known rim.
  if (e.crusts.length && S.lastVPos) {
    try { e.updateCrusts(S.lastVPos.x, S.lastVPos.y, S.lastVPos.R, dt); } catch (err) { warnOnce(err); }
  }
  try { e.updateShell(dt); } catch (err) { warnOnce(err); }
}

function weaponApi() {
  try { return (g.APEX_ARSENAL && g.APEX_ARSENAL.weaponApi) || null; } catch (e) { return null; }
}

function tickGuns(S, now, dt) {
  const e = S.engine;
  const WAPI = weaponApi();
  const seenHolders = new Set();
  const seenSlots = new Set();
  // Held frozen firearms (Frost-side holders).
  if (WAPI && typeof WAPI.getHolder === 'function') {
    for (const ct of combatants()) {
      if (!isFrostCt(ct)) continue;
      for (const b of bodiesOf(ct, true)) {
        if (!b) continue;
        let h = null;
        try { h = WAPI.getHolder(b); } catch (err) {}
        if (!h || !h.__frostFrozen) continue;
        if (S.suppressHolder && h === S.suppressHolder) { seenHolders.add(h); continue; }
        seenHolders.add(h);
        let rec = S.guns.get(h);
        if (!rec) {
          const pose = heldGunPose(b, h);
          const vg = e.mkGun(pose.x, pose.y, pose.a, 'frost');
          vg.frostStart = (h.__frostFrozen.at || now) + (S.tOff || 0);
          vg.thawAt = Infinity;
          rec = { vg, kind: 'held', body: b, holder: h, longSide: pose.longSide };
          S.guns.set(h, rec);
        }
        rec.body = b; rec.holder = h;
        const pose = heldGunPose(b, h);
        rec.longSide = pose.longSide;
        try { e.updateGunVisual(rec.vg, dt, pose); } catch (err) { warnOnce(err); }
        rec.vg.x = pose.x; rec.vg.y = pose.y;
      }
    }
  }
  // Frozen floor slots (REVEALED firearms on A1 ice).
  let slots = [];
  try { slots = ((g.APEX_ARSENAL && g.APEX_ARSENAL.state && g.APEX_ARSENAL.state.slots) || []); } catch (err) {}
  for (const slot of slots) {
    if (!slot || slot.phase !== 'REVEALED' || !slot.__frostFrozen) continue;
    seenSlots.add(slot);
    let rec = S.guns.get(slot);
    if (!rec) {
      const pose = slotGunPose(slot);
      const vg = e.mkGun(pose.x, pose.y, pose.a, 'floor');
      vg.frostStart = e.t; vg.thawAt = Infinity;
      rec = { vg, kind: 'floor', slot, longSide: pose.longSide };
      S.guns.set(slot, rec);
    }
    const pose = slotGunPose(slot);
    rec.vg.x = pose.x; rec.vg.y = pose.y; rec.vg.a = pose.a;
    rec.longSide = pose.longSide;
    if (slot.__frostThawUntil && rec.vg.thawAt === Infinity) rec.vg.thawAt = slot.__frostThawUntil + (S.tOff || 0);
    try { e.updateGunVisual(rec.vg, dt, pose); } catch (err) { warnOnce(err); }
  }
  // Steal transfers ride to the live Frost gun anchor.
  for (const [key, rec] of S.guns) {
    if (!rec || rec.kind !== 'transfer') continue;
    const f = S.fighter;
    let target = { x: f.x, y: f.y, a: 0 };
    try {
      const h = f && f.data ? f.data.arsenal : null;
      if (h) target = heldGunPose(f, h);
    } catch (err) {}
    try { e.updateGunVisual(rec.vg, dt, target); } catch (err) { warnOnce(err); }
    if (rec.vg.owner !== 'transfer') {
      S.guns.delete(key); // docked: the held visual takes over next tick
      if (S.suppressHolder && rec.holder && S.suppressHolder === rec.holder) S.suppressHolder = null;
      else if (S.suppressHolder && !rec.holder) S.suppressHolder = null;
    } else if (rec.dockAt != null && now > rec.dockAt + 0.5) {
      // Safety: a transfer whose holder vanished mid-flight (consumed) must
      // never leave the base draw suppressed.
      S.guns.delete(key);
      if (S.suppressHolder === rec.holder) S.suppressHolder = null;
    }
  }
  // Sweep consumed holders / picked-up slots.
  for (const [key, rec] of S.guns) {
    if (!rec) { S.guns.delete(key); continue; }
    if (rec.kind === 'held' && !seenHolders.has(key)) S.guns.delete(key);
    else if (rec.kind === 'floor' && !seenSlots.has(key)) S.guns.delete(key);
  }
  // Held-gun anchor follows even when unfrozen (muzzle recoil frame).
  try {
    if (S.heldVg && S.fighter) {
      const f = S.fighter;
      const h = f.data ? f.data.arsenal : null;
      const pose = h ? heldGunPose(f, h)
        : { x: f.x, y: f.y, a: Math.atan2((f.dir && f.dir.y) || 0, (f.dir && f.dir.x) || 1) };
      e.updateGunVisual(S.heldVg, dt, pose);
    }
  } catch (err) { warnOnce(err); }
}

function tickFlecks(S, dt) {
  const projs = (g.projectiles || []);
  const live = new Set();
  for (const p of projs) {
    if (!p || !p.__hr || !p.__hr.frost) continue;
    live.add(p);
    let rec = S.flecks.get(p);
    if (!rec) {
      rec = { b: { x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0, age: 0, lastFleck: -9 } };
      S.flecks.set(p, rec);
    }
    rec.b.x = p.x; rec.b.y = p.y; rec.b.vx = p.vx || 0; rec.b.vy = p.vy || 0;
    try { G.frostBulletFleck(rec.b, dt); } catch (err) { warnOnce(err); }
  }
  for (const p of Array.from(S.flecks.keys())) if (!live.has(p)) S.flecks.delete(p);
}

// Gold SIM STEP law (demo locomotion/input/enemy/bullets cut; production owns
// position; everything else replays verbatim through Gold methods).
function driveEngine(S, ct, dt) {
  const e = S.engine, f = S.fighter;
  const now = clock();
  syncClock(S, now);
  e.fx = f.x; e.fy = f.y;
  e.fvx = (f.__hrVel && f.__hrVel.x) || 0;
  e.fvy = (f.__hrVel && f.__hrVel.y) || 0;
  // Gold movementHeading() falls back to moveFacing when nearly stopped:
  // feed it the REAL committed direction (never a demo heading).
  try { e.moveFacing = Math.atan2((f.dir && f.dir.y) || 0, (f.dir && f.dir.x) || 1); } catch (err) {}
  // Body scale follows the live fighter radius (rage/size effects included).
  e.bodyK = S.kBody = ((f && f.radius) || 75) / REF.FROST_R;
  try {
    const vw = g.__apexCameraView;
    e.scale = (vw && vw.zoom) || 1;
    e.dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  } catch (err) {}
  e.t += dt;
  e.modeT += dt;
  const t = e.t;
  // A1 beat sync BEFORE dispatch so the hold freezes modeT at 0.
  let insp = null;
  try { insp = FR && typeof FR.inspect === 'function' ? FR.inspect(ct) : null; } catch (err) {}
  tickA1(S, ct, insp, now, dt);
  if (S.a1.pending && now < S.a1.holdUntil) e.modeT = 0;
  try { e.onIce = e.ice.iceAt(e.fx, e.fy + 6, t); } catch (err) { e.onIce = false; }
  const pvx = e.fvx, pvy = e.fvy;
  const damp = G.damp, clamp = G.clamp, angDiff = G.angDiff;
  if (e.mode === 'a1') {
    e.fvx = damp(e.fvx, 0, 0.06, dt);
    e.fvy = damp(e.fvy, 0, 0.06, dt);
    try { e.updateA1(dt); } catch (err) { warnOnce(err); }
  } else if (e.mode === 'a2') {
    try { e.updateA2(dt); } catch (err) { warnOnce(err); }
  } else {
    if (e.mode === 'free' && e.breath.on && e.t - e.breath.t0 > 0.45) e.breath.on = false;
    // On-ice free carve from real motion history (Gold law verbatim).
    e.freeHistT += dt;
    if (e.freeHistT >= 1 / 60) {
      e.freeHistT = 0;
      e.freeHist.push(Math.atan2(e.fvy, e.fvx));
      if (e.freeHist.length > 10) e.freeHist.shift();
    }
    const sp = Math.hypot(e.fvx, e.fvy);
    if (e.onIce && e.freeHist.length >= 9 && sp > 190 && t - e.freeCarveT > 0.4) {
      const dA = angDiff(e.freeHist[0], e.freeHist[e.freeHist.length - 1]);
      if (Math.abs(dA) > 0.9) {
        e.freeCarveT = t;
        try { e.carve(e.fx, e.fy, e.freeHist[e.freeHist.length - 1], dA, 0.25, false); } catch (err) { warnOnce(err); }
      }
    }
    try { e.updateIdle(dt); } catch (err) { warnOnce(err); }
  }
  // NOTE: no integrate/bounds — production owns the fighter position.
  e.fax = damp(e.fax, (e.fvx - pvx) / Math.max(dt, 1e-4), 0.05, dt);
  e.fay = damp(e.fay, (e.fvy - pvy) / Math.max(dt, 1e-4), 0.05, dt);
  const lagK = (e.onIce || e.mode === 'a2') ? 0.0042 : 0.003;
  e.lagX.goal = clamp(-e.fax * lagK, -4, 4);
  e.lagY.goal = clamp(-e.fay * lagK, -4, 4);
  e.tilt.goal = clamp(e.fvx * 0.00016 + -e.fax * 0.00003, -0.07, 0.07);
  try { e.hunt.step(e.huntGoal, 0.08, dt); } catch (err) {}
  for (const s of [e.lagX, e.lagY, e.tilt, e.sx, e.sy, e.bLiftL,
    e.bLiftR, e.bRotL, e.bRotR, e.jaw, e.crestLift, e.crestRot, e.eye, e.crack, e.vent]) {
    try { s.step(dt); } catch (err) {}
  }
  e.crestRot.goal = clamp(-e.fvx * 0.00008, -0.03, 0.03);
  // Aim damps toward the live enemy anchor (Gold gunAim law, real target).
  try {
    const foes = bodiesOf(ct, false);
    const en = foes && foes[0];
    if (en) e.aim = damp(e.aim, e.aim + angDiff(e.aim, angTo(e.fx, e.fy, en.x, en.y)), 0.08, dt);
  } catch (err) {}
  tickA2(S, insp, now);
  // Admit deferred casts: the mode branch above may have freed Gold this
  // very frame (A1 auto-ends at 0.8s; endA2 on window close). Admission
  // reads LIVE gameplay truth so a deferred visual replays real history.
  pumpCastQueue(S, now, insp);
  tickVictims(S, ct, now, dt);
  tickGuns(S, now, dt);
  tickFlecks(S, dt);
  try { e.ice.update(t); } catch (err) { warnOnce(err); }
}

api.tick = function (dt) {
  if (!G || !FR || !HR) return;
  if (!HR.match) return;
  if (typeof dt !== 'number' || !(dt >= 0)) dt = 1 / 60;
  dt = Math.min(dt, 0.05);
  subscribe(); tapFirePath(); wrapArsenalAV(); ensureDrawWraps();
  sweepStates();
  for (const ct of combatants()) {
    if (!isFrostCt(ct) || !ct.anchor) continue;
    try {
      const S = stateFor(ct);
      if (S) driveEngine(S, ct, dt);
    } catch (err) { warnOnce(err); }
  }
  // Module-global shape pools advance ONCE per frame (shared by engines).
  try { if (typeof G.updateShapes === 'function') G.updateShapes(dt); } catch (err) { warnOnce(err); }
};

// ------------------------------------------------------------------ draws
function ensureDrawWraps() {
  if (ensureDrawWraps.done) return;
  ensureDrawWraps.done = true;
  const Fighter = g.Fighter;
  if (Fighter && Fighter.prototype && !Fighter.prototype.__frostPresentationWrapped) {
    const prevDraw = Fighter.prototype.draw;
    Fighter.prototype.__frostPresentationWrapped = true;
    Fighter.prototype.draw = function (ctx) {
      let bypassed = false;
      if (isFrostBody(this) && this.hp > 0 && api.ready) {
        const S = liveStates.get(this);
        if (S) {
          let drew = false;
          isolated(ctx, () => { drawFrostBody(ctx, this, S); drew = true; });
          bypassed = drew;
          if (!drew) { try { prevDraw.call(this, ctx); } catch (e2) {} }
        } else {
          try { prevDraw.call(this, ctx); } catch (err) { warnOnce(err); }
        }
      } else {
        try { prevDraw.call(this, ctx); } catch (err) { warnOnce(err); }
      }
      try {
        const fl = g.fighters;
        if (this === (fl && fl[fl.length - 1]) || this === (fl && fl[1])) {
          if (bypassed) {
            // Bypass debt (Crystala law): the inner post-world hooks never
            // ran for this fighter, so re-run them explicitly — ONCE, and
            // each inside its own state guard so a foreign pass can never
            // leave the canvas dirty for the rest of the frame.
            try { if (g.APEX_HUNTER_PRESENTATION && g.APEX_HUNTER_PRESENTATION.renderPostWorld) isolated(ctx, () => g.APEX_HUNTER_PRESENTATION.renderPostWorld(ctx)); } catch (e5) {}
            try {
              const C = g.APEX_CRYSTALA_PRESENTATION;
              if (C) {
                if (typeof C.renderWorldConstructsAndFx === 'function') isolated(ctx, () => C.renderWorldConstructsAndFx(ctx, false, true));
                if (typeof C.runBloomPass === 'function') isolated(ctx, () => C.runBloomPass(ctx));
              }
            } catch (e6) {}
          }
          isolated(ctx, () => postWorld(ctx));
        }
      } catch (err) { warnOnce(err); }
    };
  }
  if (typeof g.drawProjectiles === 'function' && !g.drawProjectiles.__frostWrapped) {
    const prevDP = g.drawProjectiles;
    const wrapped = function (ctx) {
      // UNDER (Gold law order): wet -> ice composite -> floor shapes -> macro
      // front -> slot frost. Production projectiles/fighters draw above.
      if (api.ready && liveStates.size) {
        const px = pxFromCtx(ctx);
        for (const [, S] of liveStates) {
          isolated(ctx, () => {
            drawIceComposite(S, ctx, px);
            S.engine.ice.drawWet(ctx, S.engine.t);
            S.engine.drawA1MacroFront(ctx, px);
            drawSlotOverlays(S, ctx, px);
          });
        }
        isolated(ctx, () => { G.drawFloorShapes(ctx, px); });
      }
      try { prevDP.call(this, ctx); } catch (err) { warnOnce(err); }
      // OVER the production projectiles: frozen-bullet frost rides its bullet.
      if (api.ready && liveStates.size) {
        const px2 = pxFromCtx(ctx);
        isolated(ctx, () => bulletFrostPass(ctx, px2));
      }
    };
    wrapped.__frostWrapped = true;
    g.drawProjectiles = wrapped;
  }
}

// Gold actor law: shadow -> breath-behind? -> body -> breath-front? -> preCore,
// all in the radius-adaptive body frame about the live fighter position.
function drawFrostBody(ctx, f, S) {
  const e = S.engine;
  const px = pxFromCtx(ctx);
  if (f.hasStatus && f.hasStatus('immune')) ctx.globalAlpha = 0.55;
  if (f.isRage) {
    const glow = f.color || '#ffffff';
    try { ctx.filter = 'drop-shadow(0 0 5px ' + glow + ') drop-shadow(0 0 11px ' + glow + ')'; } catch (err) {}
  }
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(S.kBody, S.kBody);
  ctx.translate(-f.x, -f.y);
  e.drawFrostShadow(ctx);
  const behind = e.breath.on && Math.sin(e.a1.ang) < -0.35;
  if (behind) e.drawBreathCore(ctx, px);
  e.drawFrost(ctx, px);
  if (e.breath.on && !behind) e.drawBreathCore(ctx, px);
  if (e.mode === 'a1' && e.modeT > 0.08 && e.modeT < 0.23) e.drawPreCore(ctx, px);
  ctx.restore();
  if (f.isRage) { try { ctx.filter = 'none'; } catch (err) {} }
  // Production status rings, verbatim law in the dir-rotated frame.
  drawStatusRings(ctx, f);
}

function drawStatusRings(ctx, f) {
  const TAU = g.TAU || Math.PI * 2;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(Math.atan2((f.dir && f.dir.y) || 0, (f.dir && f.dir.x) || 1));
  try {
    if (f.hasStatus('freeze') && typeof g.drawStatusRing === 'function') g.drawStatusRing(ctx, f.radius + 18, '#a6f4ff', 'FREEZE');
    if (f.hasStatus('stun') && typeof g.drawStunAsset === 'function') {
      ctx.save();
      ctx.rotate(-Math.atan2((f.dir && f.dir.y) || 0, (f.dir && f.dir.x) || 1));
      g.drawStunAsset(ctx, f.radius);
      ctx.restore();
    }
    if (f.hasStatus('poison') && typeof g.drawStatusRing === 'function' && typeof g.poisonLevelFromExposure === 'function') {
      const lvl = g.poisonLevelFromExposure((f.statuses.poison && f.statuses.poison.exposure) || 0);
      g.drawStatusRing(ctx, f.radius + 26, '#88ff00', 'POISON ' + lvl);
      if (lvl > 0) {
        ctx.save();
        ctx.rotate(-Math.atan2((f.dir && f.dir.y) || 0, (f.dir && f.dir.x) || 1));
        ctx.fillStyle = '#b6ff4a'; ctx.strokeStyle = '#0b1702'; ctx.lineWidth = 6;
        ctx.font = "900 54px 'Segoe UI'"; ctx.textAlign = 'center';
        ctx.strokeText(String(lvl), 0, -f.radius - 50);
        ctx.fillText(String(lvl), 0, -f.radius - 50);
        ctx.restore();
      }
    }
    if (f.hasStatus('disease') && typeof g.drawStatusRing === 'function') {
      g.drawStatusRing(ctx, f.radius + 30, '#b9ff55', 'VIRUS -' + Math.round((1 - ((f.statuses.disease && f.statuses.disease.mult) ?? 1)) * 100) + '%');
    }
    if (f.hasStatus('weak') && !(f.statuses.weak && f.statuses.weak.source && f.statuses.weak.source.name === 'BLADE') && typeof g.drawStatusRing === 'function') {
      g.drawStatusRing(ctx, f.radius + 34, '#ff3030', 'WEAK');
    }
    if (f.virusParasites && f.virusParasites.length && typeof g.getVirusStats === 'function') {
      const now = Date.now() / 600;
      const vs = g.getVirusStats(f);
      ctx.save();
      ctx.rotate(-Math.atan2((f.dir && f.dir.y) || 0, (f.dir && f.dir.x) || 1));
      ctx.fillStyle = '#b9ff55'; ctx.strokeStyle = '#102006'; ctx.lineWidth = 5;
      ctx.font = '900 20px monospace'; ctx.textAlign = 'center';
      ctx.strokeText('VIRUS -' + Math.round((1 - vs.damageOut) * 100) + '% DMG', 0, -f.radius - 82);
      ctx.fillText('VIRUS -' + Math.round((1 - vs.damageOut) * 100) + '% DMG', 0, -f.radius - 82);
      ctx.restore();
      f.virusParasites.slice(0, 18).forEach((v, i) => {
        const rr = f.radius + 44 + (i % 3) * 10;
        const a = v.angle + now * (0.35 + v.level * 0.08);
        ctx.fillStyle = v.level === 1 ? '#b8ff63' : v.level === 2 ? '#78cf3d' : '#ff7070';
        ctx.strokeStyle = '#102006'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, v.level === 1 ? 7 : v.level === 2 ? 10 : 14, 0, TAU); ctx.fill(); ctx.stroke();
      });
    }
  } finally {
    ctx.restore();
  }
}

// Gold ice law: union layer composited offscreen (no stacking where paths
// overlap), then blitted at alpha 0.97. Falls back to direct draw when the
// canvas transform cannot be mirrored (headless shims).
function drawIceComposite(S, ctx, px) {
  const e = S.engine;
  if (!e.ice.nodes.length && !e.ice.carves.length) return;
  const cv = ctx && ctx.canvas;
  const w = (cv && cv.width) | 0, h = (cv && cv.height) | 0;
  // Composite only when the target canvas has a usable backing store AND the
  // transform is readable. Anything else falls back to the direct Gold draw:
  // a zero-size or unreadable offscreen used to throw mid-blit and strand the
  // host transform, which is what corrupted the whole battle render.
  if (w > 1 && h > 1 && e.iceCanvas && typeof ctx.getTransform === 'function') {
    try {
      if (e.iceCanvas.width !== w || e.iceCanvas.height !== h) {
        e.iceCanvas.width = w; e.iceCanvas.height = h;
        // Rebind: headless canvas proxies capture the backing store at
        // getContext time, so a resize orphans the old ctx (browsers return
        // the same ctx here — harmless).
        try { e.iceCtx = e.iceCanvas.getContext('2d'); } catch (err) {}
      }
      const ic = e.iceCtx;
      if (ic) {
        const m = ctx.getTransform();
        ic.setTransform(1, 0, 0, 1, 0, 0);
        ic.clearRect(0, 0, e.iceCanvas.width, e.iceCanvas.height);
        ic.setTransform(m);
        const painted = e.ice.render(ic, e.t, px);
        ic.setTransform(1, 0, 0, 1, 0, 0);
        if (painted) {
          // Blit inside its own save/restore: transform + alpha are restored
          // unconditionally, even if drawImage throws.
          ctx.save();
          try {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 0.97;
            ctx.drawImage(e.iceCanvas, 0, 0);
          } finally { ctx.restore(); }
        }
        return;
      }
    } catch (err) { warnOnce(err); }
  }
  try { e.ice.render(ctx, e.t, px); } catch (err) { warnOnce(err); }
}

function withGunScale(ctx, x, y, longSide, fn) {
  const s = (longSide || 145) / GUN_OVERLAY_REF;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-x, -y);
  try { fn(); } finally { ctx.restore(); }
}

function drawSlotOverlays(S, ctx, px) {
  for (const [, rec] of S.guns) {
    if (!rec || rec.kind !== 'floor') continue;
    const vg = rec.vg;
    if (!vg || vg.frost < 0.01) continue;
    withGunScale(ctx, vg.x, vg.y, rec.longSide, () => {
      S.engine.drawGunFrost(ctx, vg, px);
    });
  }
}

function drawHeldOverlay(S, ctx, h) {
  const rec = S.guns.get(h);
  if (!rec || !rec.vg || rec.vg.frost < 0.01) return;
  const px = pxFromCtx(ctx);
  withGunScale(ctx, rec.vg.x, rec.vg.y, rec.longSide, () => {
    S.engine.drawGunFrost(ctx, rec.vg, px);
  });
}

// A stolen holder is ONE object in ONE place: while it is in Gold transfer
// flight it is drawn by drawTransferGuns at the flight position, so the base
// equipped-weapon draw (and its frost overlay) must be suppressed until dock
// — otherwise the same weapon renders twice, in Frost's hand and mid-air.
// Truth order: the gameplay dock stamp first (authoritative), the per-state
// suppressHolder latch second (transfer record still in flight).
function holderSuppressed(h) {
  if (!h) return false;
  try { if (FR && typeof FR.holderInTransfer === 'function' && FR.holderInTransfer(h)) return true; } catch (e) {}
  for (const [, S] of liveStates) if (S.suppressHolder === h) return true;
  return false;
}

function wrapArsenalAV() {
  if (wrapArsenalAV.done) return;
  try {
    const AV = g.APEX_ARSENAL_AV;
    if (!AV || typeof AV.drawEquippedWeapon !== 'function' || AV.__frostWrapped) return;
    wrapArsenalAV.done = true;
    AV.__frostWrapped = true;
    const base = AV.drawEquippedWeapon.bind(AV);
    AV.drawEquippedWeapon = function (c, f, h) {
      try { if (holderSuppressed(h)) return false; } catch (err) { warnOnce(err); }
      const r = base(c, f, h);
      if (h && h.__frostFrozen && f) {
        isolated(c, () => {
          const ct = ctOfBody(f);
          const S = isFrostCt(ct) ? liveStates.get(ct.anchor) : firstState();
          if (S) drawHeldOverlay(S, c, h);
        });
      }
      return r;
    };
  } catch (e) { warnOnce(e); }
}

function bulletFrostPass(ctx, px) {
  const projs = g.projectiles || [];
  if (!projs.length) return;
  for (const p of projs) {
    if (!p || !p.__hr || !p.__hr.frost) continue;
    let S = null;
    try {
      const tag = p.__hr.frost;
      const shooter = ctOfBody(tag.shooter || p.owner);
      S = (isFrostCt(shooter) && liveStates.get(shooter.anchor)) || firstState();
    } catch (err) { S = firstState(); }
    if (!S) continue;
    try { S.engine.drawBulletFrost(ctx, p.x, p.y, Math.atan2(p.vy || 0, p.vx || 1), px); } catch (err) { warnOnce(err); }
  }
}

function postWorld(ctx) {
  if (!api.ready || !liveStates.size) return;
  const px = pxFromCtx(ctx);
  for (const [, S] of liveStates) {
    // Victim frost (latest Frost victim): seize tint + rim crusts + shell.
    try {
      const v = S.victim;
      if (v && v.x != null) {
        const body = allBodies().find((b) => b && b.id === v.id && b.hp > 0);
        if (body) S.engine.drawTargetFrost(ctx, body.x, body.y, body.radius || 75, px, v.seizeE);
        else if (S.engine.shell || S.engine.crusts.length) S.engine.drawTargetFrost(ctx, v.x, v.y, v.R || 75, px, v.seizeE);
      }
    } catch (err) { warnOnce(err); }
    // Steal transfer guns: production sprite in flight + Gold frost.
    try { drawTransferGuns(S, ctx, px); } catch (err) { warnOnce(err); }
  }
  try { G.drawRibbonLayer(ctx); } catch (err) {}
  try { G.drawAirShapes(ctx, px); } catch (err) {}
}
api.renderPostWorld = postWorld;

function drawTransferGuns(S, ctx, px) {
  const AV = g.APEX_ARSENAL_AV;
  for (const [, rec] of S.guns) {
    if (!rec || rec.kind !== 'transfer') continue;
    const vg = rec.vg;
    if (AV && typeof AV.drawWeaponSprite === 'function' && rec.weapon) {
      try { AV.drawWeaponSprite(ctx, rec.weapon, vg.x, vg.y, { angle: vg.a, targetLongSide: (rec.longSide || 145) * 0.96, alpha: 1 }); } catch (err) {}
    }
    if (vg.frost >= 0.01) {
      withGunScale(ctx, vg.x, vg.y, rec.longSide, () => {
        S.engine.drawGunFrost(ctx, vg, px);
      });
    }
  }
}

// ------------------------------------------------------- inspection + boot
api.engineFor = function (f) {
  const S = f ? liveStates.get(f) : firstState();
  return S ? S.engine : null;
};

api.inspect = function (f) {
  const S = f ? liveStates.get(f) : firstState();
  if (!S) return null;
  const e = S.engine;
  return {
    mode: e.mode, t: +e.t.toFixed(3),
    a1: { released: !!e.a1.released, front: +((e.a1.front) || 0).toFixed(1), len: e.a1.len || 0, nodes: (e.a1.nodes || []).length,
      ang: +((e.a1.ang) || 0).toFixed(4), ox: +((e.a1.ox) || 0).toFixed(1), oy: +((e.a1.oy) || 0).toFixed(1) },
    a2: { kicked: !!e.a2.kicked, trail: (e.a2.trail || []).length },
    shell: !!e.shell, crusts: e.crusts.length,
    iceNodes: e.ice.nodes.length, carves: e.ice.carves.length,
    guns: S.guns.size, victim: S.victim ? S.victim.id : null, shocks: S.shocks.size,
    transfers: Array.from(S.guns.values()).filter((r) => r && r.kind === 'transfer').length,
    suppressed: !!S.suppressHolder,
    // Deferred-cast bookkeeping (lossless A1/A2 concurrency).
    queued: S.castQ.length, queuedKinds: S.castQ.map((q) => q.kind),
    castStarts: S.castStarts, castDeferred: S.castDeferred, castDropped: S.castDropped,
    a1Started: S.a1.startedId, a1CastAng: +S.a1.castAng.toFixed(4), a2Started: !!S.a2.started,
    // Historical reconstruction proof surface (deferred admissions).
    a1Replays: S.a1.replays || 0, a2Hydrated: S.a2.hydrated || 0,
    kBody: +S.kBody.toFixed(3), laneK: +S.laneK.toFixed(3), trailK: +S.trailK.toFixed(3),
    // Canvas-state integrity counter (F12.23): any Frost draw pass that had
    // to have host state re-asserted increments this. Must stay 0.
    stateLeaks,
    bodyK: +(S.engine.bodyK || 0).toFixed(3),
    trailStep: REF.TRAIL_STEP, goldA2Width: REF.A2_WIDTH, goldFrostR: REF.FROST_R,
  };
};

if (G && typeof G.load === 'function' && !api.ready) {
  try {
    G.load().then(() => { api.ready = true; }).catch((e) => { api.error = String(e); });
  } catch (e) { api.error = String(e); }
}

g.apexFrostPresentationRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);