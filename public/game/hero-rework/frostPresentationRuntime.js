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
 * - Width calibration: laneK/trailK derive from live gameplay config over
 *   canonical Gold reference geometry. Slice 1 raises A1 gameplay width from
 *   160 to 360, so laneK is 2.25; A2 remains 120/120 = 1.0. The authored
 *   material therefore expands with the mechanic envelope instead of drifting
 *   away from collision truth (Hunter precedent: visible == mechanic).
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
const renderAudit = { frame: 0, bodyDraws: 0, iceRenders: 0, drawExceptions: 0, lastFrameMs: 0, maxFrameMs: 0 };
// Live entity-integrity trace. This records state ownership and render sources,
// not pixels, and is intentionally bounded so owner-browser diagnosis can read
// the exact first divergent frame without changing Gold choreography.
const integrityFrames = [];
const segmentMeta = new WeakMap();
let nextSegmentId = 1;
function segmentInfo(n, fallbackCastId) {
  let m = segmentMeta.get(n);
  if (!m) {
    m = { id: nextSegmentId++, castId: fallbackCastId || 0, kind: n.kind || 'unknown' };
    segmentMeta.set(n, m);
  } else if (!m.castId && fallbackCastId) m.castId = fallbackCastId;
  return m;
}
function currentIntegrity(S) {
  for (let i = integrityFrames.length - 1; i >= 0; i--) {
    if (integrityFrames[i].fighterId === (S.fighter && S.fighter.id)) return integrityFrames[i];
  }
  return null;
}
function noteRenderSource(S, source) {
  const r = currentIntegrity(S);
  if (!r || r.simFrame !== renderAudit.frame) return;
  r.renderSources.push(source);
  r.renderSourceCounts[source] = (r.renderSourceCounts[source] || 0) + 1;
}
function captureIntegrity(S, insp, now) {
  const e = S.engine, castId = (insp && insp.a2castId) || S.a2.castId || 0;
  // kickOff's authored pad is created inside Gold; assign it to the same cast
  // here without changing Gold itself.
  for (const n of (e.a2.trail || [])) segmentInfo(n, castId);
  const active = [], dead = [];
  for (const n of e.ice.nodes) {
    const m = segmentInfo(n, (n.kind === 'trail' || n.kind === 'pad') ? castId : 0);
    const row = { id: m.id, castId: m.castId, kind: m.kind, x: +n.x.toFixed(3), y: +n.y.toFixed(3), born: +n.born.toFixed(4) };
    if (!n.dead && e.t > n.born) active.push(row); else if (n.dead) dead.push(row);
  }
  const prev = S.integrityActiveIds || new Set();
  const ids = new Set(active.map((n) => n.id));
  const retiredThisFrame = [];
  for (const id of prev) if (!ids.has(id)) retiredThisFrame.push(id);
  S.integrityActiveIds = ids;
  S.integrityRetired = (S.integrityRetired || 0) + retiredThisFrame.length;
  const endpoint = S.a2.path ? { x: S.a2.path.x, y: S.a2.path.y } : null;
  const root = { x: e.fx, y: e.fy }, head = { x: S.fighter.x, y: S.fighter.y };
  const rec = {
    simFrame: renderAudit.frame, clock: +now.toFixed(4), fighterId: S.fighter && S.fighter.id,
    castId, mode: e.mode, visualInstances: liveStates.size,
    activeSegments: active.length, deadSegmentsRetained: dead.length,
    retiredThisFrame, retiredTotal: S.integrityRetired || 0,
    segmentOwners: active.reduce((o, n) => { const k = String(n.castId); o[k] = (o[k] || 0) + 1; return o; }, {}),
    segments: active, head, bodyRoot: root, pathEndpoint: endpoint,
    headRootGap: +Math.hypot(head.x - root.x, head.y - root.y).toFixed(4),
    headPathGap: endpoint ? +Math.hypot(head.x - endpoint.x, head.y - endpoint.y).toFixed(4) : null,
    liveAndHistorySimultaneous: !!(e.externalA2Path && e.mode === 'a2' && !S.a2.path),
    renderSources: [], renderSourceCounts: {}, components: [], componentDrawCounts: {}, componentSaveDepthAfter: 0,
    facialState: {
      browL: { lift: e.bLiftL.x, rotation: e.bRotL.x }, browR: { lift: e.bLiftR.x, rotation: e.bRotR.x },
      crest: { lift: e.crestLift.x, rotation: e.crestRot.x }, jaw: e.jaw.x,
      eye: e.eye.x, lag: { x: e.lagX.x, y: e.lagY.x }, scale: { x: e.sx.x, y: e.sy.x }, tilt: e.tilt.x,
    },
    canvas: { width: e.iceCanvas.width, height: e.iceCanvas.height, cleared: false, painted: false },
  };
  integrityFrames.push(rec);
  if (integrityFrames.length > 900) integrityFrames.splice(0, integrityFrames.length - 900);
  return rec;
}
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
  catch (err) { renderAudit.drawExceptions++; warnOnce(err); }
  finally {
    if (saved) { try { ctx.restore(); } catch (e) {} }
    restoreCtx(ctx, snap);
  }
}

// ---------------------------------------------------------------- states
// Map (iterable) keyed by anchor; swept every tick against live combatants.
const liveStates = new Map();
let lastMatch = null;
// TEMP Slice 2 motion-readability diagnostic. Toggle from the console with
// APEX_FROST_PRESENTATION.setReactionParticlesEnabled(false); primary body
// motion remains active while bullet/wall/body debris is suppressed.
let reactionParticlesEnabled = true;
api.setReactionParticlesEnabled = function (enabled) {
  reactionParticlesEnabled = enabled !== false;
  for (const [, S] of liveStates) S.engine.reactionParticlesEnabled = reactionParticlesEnabled;
  return reactionParticlesEnabled;
};
api.reactionParticlesEnabled = function () { return reactionParticlesEnabled; };

// Slice 3 shared arena mood. One scalar is shared by every Frost instance, so
// overlapping A1/A2 lifecycles refresh/extend but can never stack darker.
// `level === 0` is an exact no-pass baseline (no persistent canvas filter).
const ambience = { level: 0, target: 0, activeIce: false, refreshUntil: -99 };
function resetAmbience() {
  ambience.level = 0;
  ambience.target = 0;
  ambience.activeIce = false;
  ambience.refreshUntil = -99;
}
function refreshAmbience(now) {
  ambience.refreshUntil = Math.max(ambience.refreshUntil, now + 0.35);
  ambience.target = 1;
  // Activation must register immediately even on the first observed frame.
  ambience.level = Math.max(ambience.level, 0.88);
}
function ambienceContribution(S, now) {
  const e = S.engine;
  if (!S.fighter || S.fighter.hp <= 0) return 0;
  let k = (now < ambience.refreshUntil || S.a1.pending || S.a2.live) ? 1 : 0;
  for (const n of e.ice.nodes || []) {
    if (!n || n.dead || (n.kind !== 'lane' && n.kind !== 'trail' && n.kind !== 'pad')) continue;
    const end = Number.isFinite(n.activeUntil) ? n.activeUntil : n.decayAt;
    if (!Number.isFinite(end) || e.t >= end) continue;
    const life = Math.max(0.01, end - n.born);
    // Hold the cold mood near activation, then visibly thaw toward baseline.
    const remain = G.clamp((end - e.t) / life, 0, 1);
    k = Math.max(k, Math.sqrt(remain));
  }
  return k;
}
function tickAmbience(now, dt) {
  let target = 0;
  let livingFrost = false;
  for (const [, S] of liveStates) {
    if (S.fighter && S.fighter.hp > 0) livingFrost = true;
    target = Math.max(target, ambienceContribution(S, now));
  }
  // Death, teardown, mode exit, or the final qualifying ice expiry restores
  // the exact baseline immediately. The gradual return happens while the
  // active ice's remaining lifetime decreases, not after truth has gone.
  if (!livingFrost || !HR || !HR.match || target <= 0) {
    resetAmbience();
    return;
  }
  ambience.activeIce = true;
  ambience.target = G.clamp(target, 0, 1);
  const tau = ambience.target > ambience.level ? 0.055 : 0.24;
  ambience.level += (ambience.target - ambience.level) * (1 - Math.exp(-dt / tau));
  ambience.level = G.clamp(ambience.level, 0, 1);
}

api.renderArenaAmbience = function (ctx) {
  if (!ctx || ambience.level <= 0) return;
  isolated(ctx, () => {
    const cv = ctx.canvas;
    const w = (cv && cv.width) || g.GAME_SIZE || 1000;
    const h = (cv && cv.height) || g.GAME_SIZE || 1000;
    // A dramatic uniform cold takeover: 70% at full strength. This chamber-
    // only hook runs before gameplay entities and HUD, preserving their readability.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(1,8,20,${(0.70 * ambience.level).toFixed(4)})`;
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.fill();
    ctx.restore();
  });
};
api.ambienceState = function () {
  return { level: +ambience.level.toFixed(4), target: +ambience.target.toFixed(4), activeIce: ambience.activeIce };
};

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
  e.externalA2Path = true;
  e.reactionParticlesEnabled = reactionParticlesEnabled;
  // Pre-size the full-screen composite before any cast can activate. A later
  // viewport change is handled during tick only while no Frost material is
  // active; drawIceComposite never resizes a canvas.
  try {
    const host = (g.ctx && g.ctx.canvas) || g.canvas || (g.document && g.document.getElementById && g.document.getElementById('gameCanvas'));
    if (host && typeof e.prepareSurfaces === 'function') e.prepareSurfaces(host.width, host.height);
  } catch (err) { warnOnce(err); }
  // Art load is per-engine with a module-shared promise (first engine wins),
  // but mips live ON the engine: every later engine backfills from the
  // shared art cache so rematches/mirrors render (mips are read-only after
  // load, safe to share).
  if (sharedArt) {
    e.mips = sharedArt.mips;
    e.shadowCanvas = sharedArt.shadow;
    try { e.prepareSurfaces(e.iceCanvas.width, e.iceCanvas.height); } catch (err) { warnOnce(err); }
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
            try { other.engine.prepareSurfaces(other.engine.iceCanvas.width, other.engine.iceCanvas.height); } catch (prepErr) { warnOnce(prepErr); }
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
    a1: { pending: false, castClock: 0, holdUntil: 0, releaseClock: -99, expireClock: -99, releasedSeen: false, casts: [], castAng: 0, startedId: 0, startClock: -99, replays: 0, seenIds: new Set(), lateRecoveries: 0 },
    a2: { live: false, started: false, hydrated: 0, path: null },
    castQ: [],       // deferred Gold cast admissions (FIFO, truth-checked)
    castSeq: 0, castStarts: 0, castDeferred: 0, castDropped: 0,
    victim: null, // { id, seizeE }
    froze: new Map(), // bodyId -> { timer, startE }
    shocks: new Map(), // bodyId -> { atE, until }
    guns: new Map(), // holder|slot|transferKey -> { vg, kind, ... }
    flecks: new Map(), // projectile -> { b }
    heldVg: null,
    suppressHolder: null,
    reactions: { lastBulletE: -99, lastWallE: -99, lastOpponentE: -99, lastPair: null,
      bulletCount: 0, wallCount: 0, opponentCount: 0, lastNormal: null },
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
    resetAmbience();
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
  S.a1 = { pending: false, castClock: 0, holdUntil: 0, releaseClock: -99, expireClock: -99, releasedSeen: false, casts: [], castAng: 0, startedId: 0, startClock: -99, replays: 0, seenIds: new Set(), lateRecoveries: 0 };
  S.a2 = { live: false, started: false, hydrated: 0, path: null };
  S.castQ.length = 0;
  S.castSeq = 0; S.castStarts = 0; S.castDeferred = 0; S.castDropped = 0;
  S.victim = null;
  S.froze.clear(); S.shocks.clear(); S.guns.clear(); S.flecks.clear();
  S.heldVg = null; S.suppressHolder = null; S.match = m || null;
  S.reactions = { lastBulletE: -99, lastWallE: -99, lastOpponentE: -99, lastPair: null,
    bulletCount: 0, wallCount: 0, opponentCount: 0, lastNormal: null };
  for (const spring of [e.rootX, e.rootY, e.rearX, e.rearY, e.impactStress]) {
    if (spring) { spring.x = 0; spring.v = 0; spring.goal = 0; }
  }
  S.integrityActiveIds = new Set(); S.integrityRetired = 0;
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
  // A2 contact burst at the midpoint. Derive the opponent's impact side from
  // physical contact telemetry, not Frost facing. The runtime supplies a
  // Frost->opponent contact normal after separation; invert it so nx/ny point
  // from the opponent rim toward Frost. Resolved centres and relative impact
  // direction are robust fallbacks for redirected/bounced approaches.
  if (victim && f) {
    let nx = -(+p.contactNormalX || 0), ny = -(+p.contactNormalY || 0);
    let sideSource = 'contact-normal';
    let d = Math.hypot(nx, ny);
    if (d < 0.5) {
      nx = (+p.frostX || f.x) - (+p.bodyX || victim.x);
      ny = (+p.frostY || f.y) - (+p.bodyY || victim.y);
      d = Math.hypot(nx, ny);
      sideSource = 'resolved-positions';
    }
    if (d < 0.5) {
      nx = -(+p.relativeImpactX || 0);
      ny = -(+p.relativeImpactY || 0);
      d = Math.hypot(nx, ny);
      sideSource = 'relative-impact';
    }
    if (d < 1e-6) { nx = f.x - victim.x; ny = f.y - victim.y; d = Math.hypot(nx, ny) || 1; sideSource = 'live-positions'; }
    nx /= d; ny /= d;
    const px = (f.x + victim.x) / 2, py = (f.y + victim.y) / 2;
    setVictim(S, victim.id, e.t);
    try { e.contact(nx, ny, px, py, null); } catch (err) { warnOnce(err); }
    S.reactions.lastOpponentE = e.t; // dedupe the BodyCollision event emitted immediately after Cold Shock
    S.reactions.opponentCount++;
    S.reactions.lastNormal = { kind: 'opponent', x: nx, y: ny, strength: 1, snowSideSource: sideSource };
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

function onDamageReaction(ev) {
  const p = (ev && ev.payload) || {};
  if (p.victim == null || !p.weaponId) return; // incoming Arsenal shot/weapon impact only
  const body = allBodies().find((b) => b && b.id === p.victim) || null;
  const ct = body && ctOfBody(body);
  if (!body || !isFrostCt(ct)) return;
  const S = liveStates.get(ct.anchor) || null;
  if (!S || S.engine.t - S.reactions.lastBulletE < 0.035) return;
  let sx = Number(p.sourceX), sy = Number(p.sourceY);
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
    const foe = bodiesOf(ct, false).find((b) => b && b.hp > 0);
    sx = foe ? foe.x : body.x - ((body.dir && body.dir.x) || 1) * 100;
    sy = foe ? foe.y : body.y - ((body.dir && body.dir.y) || 0) * 100;
  }
  const dx = body.x - sx, dy = body.y - sy, d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d; // recoil direction, away from actual source
  const px = body.x - nx * (body.radius || 75) * 0.72;
  const py = body.y - ny * (body.radius || 75) * 0.72;
  const strength = G.clamp(0.65 + (+p.amount || 0) / 45, 0.65, 1.45);
  try { S.engine.reactImpact('bullet', nx, ny, px, py, strength); } catch (err) { warnOnce(err); }
  S.reactions.lastBulletE = S.engine.t;
  S.reactions.bulletCount++;
  S.reactions.lastNormal = { kind: 'bullet', x: nx, y: ny, strength };
}

function onBodyCollisionReaction(ev) {
  const p = (ev && ev.payload) || {};
  const a = allBodies().find((b) => b && b.id === p.a) || null;
  const b = allBodies().find((q) => q && q.id === p.b) || null;
  const ct = a && ctOfBody(a);
  if (!a || !b || !isFrostCt(ct)) return;
  const S = liveStates.get(ct.anchor) || null;
  if (!S || S.engine.t - S.reactions.lastOpponentE < 0.06) return;
  const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;
  const px = (a.x + b.x) * 0.5, py = (a.y + b.y) * 0.5;
  const strength = G.clamp(0.75 + (+p.closingSpeed || 0) / 1000, 0.75, 1.5);
  try { S.engine.reactImpact('opponent', nx, ny, px, py, strength); } catch (err) { warnOnce(err); }
  S.reactions.lastOpponentE = S.engine.t;
  S.reactions.lastPair = `${p.a}:${p.b}`;
  S.reactions.opponentCount++;
  S.reactions.lastNormal = { kind: 'opponent', x: nx, y: ny, strength };
}

function onWorldWallReaction(ev) {
  const p = (ev && ev.payload) || {};
  const body = allBodies().find((b) => b && b.id === p.body) || null;
  const ct = body && ctOfBody(body);
  if (!body || !isFrostCt(ct)) return;
  const S = liveStates.get(ct.anchor) || null;
  if (!S || S.engine.t - S.reactions.lastWallE < 0.045) return;
  const nx = +p.nx || 0, ny = +p.ny || 0;
  const speed = Math.hypot((body.__hrVel && body.__hrVel.x) || 0, (body.__hrVel && body.__hrVel.y) || 0);
  const strength = G.clamp(0.8 + speed / 900, 0.8, 1.55);
  try { S.engine.reactImpact('wall', nx, ny, +p.x || body.x, +p.y || body.y, strength); } catch (err) { warnOnce(err); }
  S.reactions.lastWallE = S.engine.t;
  S.reactions.wallCount++;
  S.reactions.lastNormal = { kind: 'wall', x: nx, y: ny, strength, side: 'world-capsule' };
}

function subscribe() {
  try {
    const bus = HR && HR.AIL && HR.AIL.bus;
    if (!bus || typeof bus.on !== 'function' || subscribe.done) return;
    subscribe.done = true;
    bus.on('FrostColdShock', onColdShock);
    bus.on('FrostSteal', onSteal);
    bus.on('RealizedDamageEvent', onDamageReaction);
    bus.on('BodyCollision', onBodyCollisionReaction);
    bus.on('WorldWallCollision', onWorldWallReaction);
    bus.on('ReworkMatchTeardown', resetAmbience);
  } catch (e) { warnOnce(e); }
}

function wrapWallReactions() {
  if (wrapWallReactions.done) return;
  const Fighter = g.Fighter;
  if (!Fighter || !Fighter.prototype || typeof Fighter.prototype.resolveWalls !== 'function') return;
  wrapWallReactions.done = true;
  const base = Fighter.prototype.resolveWalls;
  Fighter.prototype.resolveWalls = function frostWallReaction() {
    const side = base.call(this);
    if (!side) return side;
    const ct = ctOfBody(this);
    if (!isFrostCt(ct)) return side;
    const S = liveStates.get(ct.anchor) || null;
    if (!S || S.engine.t - S.reactions.lastWallE < 0.045) return side;
    let nx = 0, ny = 0, px = this.x, py = this.y;
    if (side === 'left') { nx = 1; px = this.x - this.radius; }
    else if (side === 'right') { nx = -1; px = this.x + this.radius; }
    else if (side === 'top') { ny = 1; py = this.y - this.radius; }
    else if (side === 'bottom') { ny = -1; py = this.y + this.radius; }
    else { // custom walls expose no normal through Fighter; use reflected heading as fallback
      nx = -((this.dir && this.dir.x) || 0); ny = -((this.dir && this.dir.y) || 0);
    }
    const speed = Math.hypot((this.__hrVel && this.__hrVel.x) || 0, (this.__hrVel && this.__hrVel.y) || 0);
    const strength = G.clamp(0.8 + speed / 900, 0.8, 1.55);
    try { S.engine.reactImpact('wall', nx, ny, px, py, strength); } catch (err) { warnOnce(err); }
    S.reactions.lastWallE = S.engine.t;
    S.reactions.wallCount++;
    S.reactions.lastNormal = { kind: 'wall', x: nx, y: ny, strength, side };
    return side;
  };
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
function syncA2Path(S, insp, now) {
  const e = S.engine, A = e.a2;
  const hist = (insp && insp.movementHistory) || [];
  if (!hist.length) return 0;
  const castId = (insp && insp.a2castId) || 0;
  const STEP = REF.TRAIL_STEP || 9;
  const off = S.tOff || 0;
  let P = S.a2.path;
  if (!P || P.castId !== castId) {
    P = S.a2.path = {
      castId, next: 1, x: hist[0].x, y: hist[0].y,
      bornAt: hist[0].bornAt, carry: 0, laid: 0, lastHeading: null,
    };
    A.lastNode.x = hist[0].x; A.lastNode.y = hist[0].y;
    A.activeStart = hist[0].bornAt + off;
  }
  let laid = 0;
  for (; P.next < hist.length; P.next++) {
    const b = hist[P.next];
    let sx = P.x, sy = P.y, st = P.bornAt;
    let dx = b.x - sx, dy = b.y - sy, d = Math.hypot(dx, dy);
    if (d < 1e-6) { P.x = b.x; P.y = b.y; P.bornAt = b.bornAt; continue; }
    const h = Math.atan2(dy, dx);
    let need = STEP - P.carry;
    while (need <= d + 1e-7) {
      const u = need / d;
      const x = sx + dx * u, y = sy + dy * u;
      const bornClock = st + (b.bornAt - st) * u;
      const born = bornClock + off;
      const node = e.emitA2TrailNode(x, y, h, born, now - bornClock > 2 / 60);
      segmentInfo(node, castId);
      laid++; P.laid++; P.carry = 0;
      sx = x; sy = y; st = bornClock;
      dx = b.x - sx; dy = b.y - sy; d = Math.hypot(dx, dy);
      need = STEP;
    }
    P.carry += d;
    // Crucial seam law: preserve the exact real endpoint and accumulated
    // along-path remainder. Never resume from the last emitted 9px sample.
    P.x = b.x; P.y = b.y; P.bornAt = b.bornAt;
    A.lastNode.x = b.x; A.lastNode.y = b.y;
    P.lastHeading = h;
  }
  S.a2.hydrated = P.laid;
  return laid;
}
function startCast(S, q, now, insp) {
  const e = S.engine;
  if (q.kind === 'a1') {
    // Always admit the authored cast first. The previous deferred path called
    // replayA1Lane() here, which materialized the floor immediately and
    // skipped anticipation/open/release whenever A2 owned Gold or the pending
    // window was missed by a hitch. A historical lane now supplies only its
    // authoritative origin/length/expiry; Gold still plays the full beat and
    // creates the visible floor at its own 0.25 release.
    e.a1Len = q.lane ? q.lane.len : q.len;
    e.a1Travel = q.lane
      ? Math.max(0.05, q.lane.frontDoneAt - q.lane.frontStartAt)
      : q.travel;
    try { e.castA1(q.ang); } catch (err) { warnOnce(err); }
    S.a1.startedId = q.castId;
    S.a1.startClock = q.lane || now - (q.castAt || now) > 0.05 ? now : (q.castAt || now);
    S.a1.forceExpiryId = q.lane ? q.castId : null;
    if (q.lane) {
      S.a1.expireClock = q.lane.expireAt;
      S.a1.replays = (S.a1.replays || 0) + 1;
    }
  } else {
    try {
      e.castA2();
      // Presentation-only load against the real persistent movement heading.
      // Gameplay begins on its existing frame; connected ice mass visually
      // compresses behind it before Gold's authored 0.13s kickOff conversion.
      const a = e.movementHeading();
      e.lagX.kick(-Math.cos(a) * 58); e.lagY.kick(-Math.sin(a) * 58);
      if (e.rearX) e.rearX.kick(-Math.cos(a) * 20);
      if (e.rearY) e.rearY.kick(-Math.sin(a) * 20);
      e.sx.kick(0.65); e.sy.kick(-0.85);
    } catch (err) { warnOnce(err); }
    S.a2.started = true;
    S.a2.castId = q.castId || (insp && insp.a2castId) || 0;
    // No-ops on an immediate start (the window has a single origin node).
    try { syncA2Path(S, insp, now); } catch (err) { warnOnce(err); }
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
  // Gameplay has accepted a qualifying Frost activation. Refresh the one
  // shared arena mood now, even if Gold presentation admission is deferred.
  refreshAmbience(now);
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
  const cast = insp && insp.a1cast;
  const incomingId = cast && cast.id;
  if (insp && insp.pending && (!S.a1.pending || (incomingId && !S.a1.seenIds.has(incomingId)))) {
    S.a1.pending = true;
    // Use gameplay's exact activation/release stamps, not the adapter's first
    // observation frame. This keeps immediate casts phase-locked while a
    // deferred cast receives its own complete presentation clock on admission.
    S.a1.castClock = cast && Number.isFinite(cast.castAt) ? cast.castAt : now;
    S.a1.releasedSeen = false;
    // Direction is the gameplay CAST-ACCEPTANCE snapshot, never live f.dir:
    // a wall/body bounce during commitment turns the body, but the breath
    // and the front must stay on the lane gameplay committed to. Live dir is
    // only a fallback for a truth surface that predates the snapshot.
    const ang = cast
      ? Math.atan2(+cast.dy || 0, (+cast.dx === 0 && +cast.dy === 0) ? 1 : +cast.dx)
      : Math.atan2((f.dir && f.dir.y) || 0, (f.dir && f.dir.x) || 1);
    S.a1.castAng = ang;
    const commit = +cfg1.castCommit || 0.25;
    const castId = incomingId || ++S.castSeq;
    S.a1.seenIds.add(castId);
    requestCast(S, {
      kind: 'a1', ang, castAt: S.a1.castClock,
      len: +cfg1.length || 650,
      travel: frontSeconds,
      castId,
      // A1 truth ends with its gameplay lane (front + floor lifetime).
      validUntil: S.a1.castClock + commit + frontSeconds + (+cfg1.floorLifetime || 4.5),
    }, now, insp);
    const gameplayRelease = cast && Number.isFinite(cast.releaseAt) ? cast.releaseAt : S.a1.castClock + commit;
    S.a1.holdUntil = gameplayRelease - A1_RELEASE_BEAT;
  }
  // Hitch/re-entry recovery: gameplay may advance pending->lane before this
  // presentation tick observes a pending frame. Detect each unseen cast id
  // from authoritative lane history and enqueue the SAME full cast beat.
  // Never paint the lane directly; it appears only after Gold reaches 0.25.
  if (insp && !insp.pending) {
    const lanes = insp.lanes || [];
    for (const L of lanes) {
      const id = L.castId;
      if (id == null || S.a1.seenIds.has(id) || now >= L.expireAt) continue;
      S.a1.seenIds.add(id);
      S.a1.castClock = now;
      S.a1.castAng = Math.atan2(L.dy, L.dx);
      S.a1.expireClock = L.expireAt;
      S.a1.releasedSeen = false;
      S.a1.lateRecoveries++;
      requestCast(S, {
        kind: 'a1', ang: S.a1.castAng, castAt: now, castId: id,
        len: L.len, travel: Math.max(0.05, L.frontDoneAt - L.frontStartAt),
        validUntil: L.expireAt,
        lane: { ox: L.ox, oy: L.oy, dx: L.dx, dy: L.dy, len: L.len,
          frontStartAt: L.frontStartAt, frontDoneAt: L.frontDoneAt, expireAt: L.expireAt },
      }, now, insp);
    }
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
    e.a1Origin = (Lr && Lr.frontStartAt != null && now < Lr.expireAt)
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
      forceExpiry: S.a1.forceExpiryId === S.a1.startedId,
    });
    if (S.a1.casts.length > 4) S.a1.casts.shift();
  }
  // Apply decay once (nodes born across the front travel share one expiry).
  for (const c of S.a1.casts) {
    if (c.applied) continue;
    c.applied = true;
    for (const n of c.nodes) {
      if (!n) continue;
      // Only a delayed/hitch-recovered cast needs clamping: immediate Gold
      // already matches the mechanic lifecycle exactly. A deferred visual may
      // not gain a fresh floor lifetime merely because its beat played late.
      if (c.forceExpiry) {
        n.activeUntil = c.expireE;
        n.decayAt = c.expireE;
        n.decayDur = A1_GHOST_FADE;
      } else if (n.decayAt === Infinity) {
        n.decayAt = c.expireE;
        n.decayDur = A1_GHOST_FADE;
      }
    }
  }
}

function tickA2(S, insp, now) {
  const e = S.engine;
  const live = !!(insp && insp.a2live);
  if (live && !S.a2.live) {
    S.a2.live = true;
    S.a2.path = null;
    requestCast(S, { kind: 'a2', castId: (insp && insp.a2castId) || 0 }, now, insp);
  } else if (!live && S.a2.live) {
    S.a2.live = false;
    // If the hunt visual never got its Gold slot, retire the queued start
    // (its truth is gone) — endA2 belongs only to a hunt that really began.
    if (dropQueued(S, 'a2') && !S.a2.started) S.castDropped = (S.castDropped || 0) + 1;
    else if (S.a2.started) { S.a2.started = false; try { e.endA2(); } catch (err) { warnOnce(err); } }
  }
  // Immediate and deferred casts both consume the same exact movement-history
  // adapter on every frame. There is no second live fx/fy trail pipeline.
  if (live && S.a2.started) {
    try { syncA2Path(S, insp, now); } catch (err) { warnOnce(err); }
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

// Slice 2 adapts Gold's existing goals to normal arena scale while preserving
// the gameplay clocks. No position, movement vector, collision, or cooldown is
// touched here; these are fixed-step rig goals only.
function applyCastChoreography(S, now) {
  const e = S.engine;
  if (e.mode === 'a1' && S.a1.startClock > -90) {
    // Presentation clock: immediate casts use the authoritative cast stamp;
    // deferred/hitch-recovered casts start at admission so no frame can jump
    // directly to release/recovery. Gameplay's 0.8s lock remains untouched.
    const T = Math.max(0, now - S.a1.startClock);
    const ca = Math.cos(e.a1.ang), sa = Math.sin(e.a1.ang);
    if (T < 0.10) { // unmistakable backward anticipation/load
      const u = G.smooth(0, 0.10, T);
      e.rootX.goal = -ca * G.lerp(2, 8, u); e.rootY.goal = -sa * G.lerp(2, 8, u);
      e.lagX.goal = -ca * G.lerp(4, 10, u); e.lagY.goal = -sa * G.lerp(4, 10, u);
      e.sx.goal = 1.085; e.sy.goal = 0.84;
      e.jaw.goal = Math.max(e.jaw.goal, 14);
      e.eye.goal = Math.max(e.eye.goal, 2.05);
      e.crestLift.goal = Math.max(e.crestLift.goal, 9);
      e.vent.goal = Math.max(e.vent.goal, 0.65);
    } else if (T < 0.25) { // held open mouth + exposed cyan cavity
      e.rootX.goal = -ca * 8; e.rootY.goal = -sa * 8;
      e.lagX.goal = -ca * 11; e.lagY.goal = -sa * 11;
      e.sx.goal = 1.10; e.sy.goal = 0.79;
      e.jaw.goal = Math.max(e.jaw.goal, 66);
      e.eye.goal = Math.max(e.eye.goal, 3.0);
      e.crestLift.goal = Math.max(e.crestLift.goal, 15);
      e.crack.goal = Math.max(e.crack.goal, 2.65);
      e.vent.goal = Math.max(e.vent.goal, 2.15);
    } else if (T < 0.44) { // hard blow/recoil then connected forward follow-through
      const u = G.sat((T - 0.25) / 0.19);
      e.rootX.goal = ca * G.lerp(7, 3, u); e.rootY.goal = sa * G.lerp(7, 3, u);
      e.lagX.goal = ca * G.lerp(9, 4, u); e.lagY.goal = sa * G.lerp(9, 4, u);
      e.jaw.goal = Math.max(e.jaw.goal, G.lerp(64, 44, u));
      e.eye.goal = Math.max(e.eye.goal, G.lerp(2.8, 1.8, u));
      e.vent.goal = Math.max(e.vent.goal, G.lerp(2.1, 0.95, u));
      e.sx.goal = G.lerp(0.90, 1.035, u);
      e.sy.goal = G.lerp(1.13, 0.99, u);
    } else { // readable settle/recovery inside the same approved lock
      const u = G.smooth(0.44, 0.80, T);
      e.rootX.goal = ca * G.lerp(3, 0, u); e.rootY.goal = sa * G.lerp(3, 0, u);
      e.lagX.goal = ca * G.lerp(4, 0, u); e.lagY.goal = sa * G.lerp(4, 0, u);
      e.jaw.goal = G.lerp(22, 0, u);
      e.vent.goal = G.lerp(0.75, 0, u);
      e.eye.goal = G.lerp(1.5, 1, u);
      e.crestLift.goal = G.lerp(5, 0, u);
      e.sx.goal = G.lerp(1.03, 1, u);
      e.sy.goal = G.lerp(0.97, 1, u);
      if (T >= 0.80) e.mode = 'free';
    }
  } else if (e.mode === 'a2' && e.a2 && !e.a2.kicked) {
    // Gold's ignition is 0.13s. Amplify its connected compression/eye/crest
    // goals so conversion reads before locomotion carries the body away.
    const u = G.sat(e.modeT / 0.13);
    const a = e.movementHeading(), ca = Math.cos(a), sa = Math.sin(a);
    e.rootX.goal = -ca * G.lerp(3, 9, u); e.rootY.goal = -sa * G.lerp(3, 9, u);
    e.lagX.goal = -ca * G.lerp(5, 12, u); e.lagY.goal = -sa * G.lerp(5, 12, u);
    e.sx.goal = G.lerp(1.07, 1.14, u);
    e.sy.goal = G.lerp(0.88, 0.74, u);
    e.eye.goal = Math.max(e.eye.goal, G.lerp(2.55, 3.5, u));
    e.crack.goal = Math.max(e.crack.goal, G.lerp(2.45, 3.1, u));
    e.crestLift.goal = Math.max(e.crestLift.goal, G.lerp(10, 19, u));
    e.jaw.goal = Math.max(e.jaw.goal, 8 * u);
  } else if (e.mode === 'a2' && e.a2 && e.a2.kicked) {
    const age = Math.max(0, e.t - e.a2.activeStart);
    const u = G.smooth(0, 0.18, age);
    const a = e.movementHeading(), ca = Math.cos(a), sa = Math.sin(a);
    // Release stored compression forward, then settle into travel.
    e.rootX.goal = ca * G.lerp(7, 0, u); e.rootY.goal = sa * G.lerp(7, 0, u);
    e.lagX.goal = ca * G.lerp(8, 0, u); e.lagY.goal = sa * G.lerp(8, 0, u);
    if (age < 0.18) {
      e.sx.goal = G.lerp(0.90, 1, u); e.sy.goal = G.lerp(1.12, 1, u);
      e.eye.goal = Math.max(e.eye.goal, G.lerp(3.1, 2.3, u));
      e.crestLift.goal = Math.max(e.crestLift.goal, G.lerp(16, 8, u));
    }
  } else {
    // Reaction/cast root offsets always return to the gameplay root.
    e.rootX.goal = 0; e.rootY.goal = 0;
  }
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
    const host = (g.ctx && g.ctx.canvas) || g.canvas;
    const materialActive = e.ice.nodes.length || e.ice.carves.length || e.mode !== 'free';
    if (host && !materialActive && typeof e.prepareSurfaces === 'function'
      && (e.iceCanvas.width !== host.width || e.iceCanvas.height !== host.height)) {
      e.prepareSurfaces(host.width, host.height);
    }
  } catch (err) { warnOnce(err); }
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
  applyCastChoreography(S, now);
  // Canonical Gold advances this articulated rig at fixed DT=1/120 inside
  // its accumulator. Passing a browser frame/hitch dt directly into these
  // semi-implicit springs makes brow/crest/jaw transforms overshoot or become
  // unstable (a 50ms activation frame can move a brow several times its
  // authored lift). Preserve the Gold assembly by substepping only the rig;
  // gameplay and Gold choreography remain owned by their existing paths.
  const rigSprings = [e.rootX, e.rootY, e.lagX, e.lagY, e.rearX, e.rearY, e.impactStress,
    e.tilt, e.sx, e.sy, e.bLiftL, e.bLiftR, e.bRotL, e.bRotR,
    e.jaw, e.crestLift, e.crestRot, e.eye, e.crack, e.vent].filter(Boolean);
  const GOLD_DT = 1 / 120;
  let rigRemain = dt;
  while (rigRemain > 1e-8) {
    const h = Math.min(GOLD_DT, rigRemain);
    try { e.hunt.step(e.huntGoal, 0.08, h); } catch (err) {}
    for (const s of rigSprings) { try { s.step(h); } catch (err) {} }
    e.crestRot.goal = clamp(-e.fvx * 0.00008, -0.03, 0.03);
    rigRemain -= h;
  }
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
  captureIntegrity(S, insp, now);
}

api.tick = function (dt) {
  const auditT0 = (g.performance && typeof g.performance.now === 'function') ? g.performance.now() : Date.now();
  renderAudit.frame++;
  if (!G || !FR || !HR) return;
  if (!HR.match) return;
  if (typeof dt !== 'number' || !(dt >= 0)) dt = 1 / 60;
  dt = Math.min(dt, 0.05);
  subscribe(); tapFirePath(); wrapWallReactions(); wrapArsenalAV(); ensureDrawWraps();
  sweepStates();
  for (const ct of combatants()) {
    if (!isFrostCt(ct) || !ct.anchor) continue;
    try {
      const S = stateFor(ct);
      if (S) driveEngine(S, ct, dt);
    } catch (err) { warnOnce(err); }
  }
  tickAmbience(clock(), dt);
  // Module-global shape pools advance ONCE per frame (shared by engines).
  try { if (typeof G.updateShapes === 'function') G.updateShapes(dt); } catch (err) { warnOnce(err); }
  const auditT1 = (g.performance && typeof g.performance.now === 'function') ? g.performance.now() : Date.now();
  renderAudit.lastFrameMs = auditT1 - auditT0;
  renderAudit.maxFrameMs = Math.max(renderAudit.maxFrameMs, renderAudit.lastFrameMs);
};

// ------------------------------------------------------------------ draws
// World-surface layer only: ice/wet/front/floor support. Arsenal invokes this
// after the chamber floor but before pickup sprites, guaranteeing guns remain
// readable without moving the Frost actor/head out of its normal body order.
function renderSurfaceUnderWeapons(ctx) {
  if (!api.ready || !liveStates.size || !ctx) return;
  const px = pxFromCtx(ctx);
  for (const [, S] of liveStates) {
    isolated(ctx, () => {
      S.engine.ice.drawWet(ctx, S.engine.t);
      drawIceComposite(S, ctx, px);
      S.engine.drawA1MacroFront(ctx, px);
    });
  }
  if (reactionParticlesEnabled) isolated(ctx, () => { G.drawFloorShapes(ctx, px); });
}
api.renderSurfaceUnderWeapons = renderSurfaceUnderWeapons;

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
          if (!drew) { noteRenderSource(S, 'inner-fighter-fallback'); try { prevDraw.call(this, ctx); } catch (e2) {} }
        } else {
          try { prevDraw.call(this, ctx); } catch (err) { warnOnce(err); }
        }
      } else {
        const legacyS = isFrostBody(this) ? liveStates.get(this) : null;
        if (legacyS) noteRenderSource(legacyS, 'inner-fighter-chain');
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
      // In Arsenal, the chamber background explicitly places the Frost
      // surface before pickup sprites. Other modes retain the historical
      // projectile-underpass. Slot frost overlays remain here, after the real
      // pickup sprite, while actors/held guns keep their normal ordering.
      if (api.ready && liveStates.size) {
        const arsenalActive = !!(g.APEX_ARSENAL && g.APEX_ARSENAL.state && g.APEX_ARSENAL.state.active);
        if (!arsenalActive) renderSurfaceUnderWeapons(ctx);
        const px = pxFromCtx(ctx);
        for (const [, S] of liveStates) isolated(ctx, () => drawSlotOverlays(S, ctx, px));
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

// Guarded per-part transform trace for browser/Gold assembly comparison. It
// observes the exact drawImage calls without changing Gold or canvas state.
function drawFrostHeadTraced(ctx, S, px) {
  const e = S.engine, rec = currentIntegrity(S);
  if (!g.__apexFrostPartTrace || !rec || rec.simFrame !== renderAudit.frame) {
    e.drawFrost(ctx, px);
    return;
  }
  const names = new Map();
  for (const [name, levels] of Object.entries(e.mips || {})) for (const img of levels || []) names.set(img, name);
  let depth = 0;
  const proxy = new Proxy(ctx, {
    get(target, prop) {
      if (prop === 'save') return () => { depth++; return target.save(); };
      if (prop === 'restore') return () => { const out = target.restore(); depth--; return out; };
      if (prop === 'drawImage') return (img, ...args) => {
        const name = names.get(img) || 'unknown-image';
        const before = target.getTransform();
        const alpha = target.globalAlpha, composite = target.globalCompositeOperation;
        const x = Number(args[0]) || 0, y = Number(args[1]) || 0;
        const wx = before.a * x + before.c * y + before.e;
        const wy = before.b * x + before.d * y + before.f;
        const out = target.drawImage(img, ...args);
        const after = target.getTransform();
        rec.components.push({
          name, expectedLocal: { x, y }, actualLocal: { x, y }, finalWorld: { x: wx, y: wy },
          before: { a: before.a, b: before.b, c: before.c, d: before.d, e: before.e, f: before.f },
          after: { a: after.a, b: after.b, c: after.c, d: after.d, e: after.e, f: after.f },
          alpha, composite, rotation: Math.atan2(before.b, before.a),
          scale: { x: Math.hypot(before.a, before.b), y: Math.hypot(before.c, before.d) },
          saveDepth: depth,
        });
        return out;
      };
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  e.drawFrost(proxy, px);
  rec.componentSaveDepthAfter = depth;
  rec.componentDrawCounts = rec.components.reduce((o, c) => { o[c.name] = (o[c.name] || 0) + 1; return o; }, {});
}

// Gold actor law: shadow -> breath-behind? -> body (including the canonical
// cavity-masked internal light) -> breath-front? -> preCore. Slice 3's added
// post-face faceted mouth slab was intentionally removed: no separate object
// is inserted at the mouth.

function drawFrostBody(ctx, f, S) {
  renderAudit.bodyDraws++;
  noteRenderSource(S, 'frost-gold-body');
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
  drawFrostHeadTraced(ctx, S, px);
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
  renderAudit.iceRenders++;
  noteRenderSource(S, 'frost-ice-pass');
  const cv = ctx && ctx.canvas;
  const w = (cv && cv.width) | 0, h = (cv && cv.height) | 0;
  // Composite only when the target canvas has a usable backing store AND the
  // transform is readable. Anything else falls back to the direct Gold draw:
  // a zero-size or unreadable offscreen used to throw mid-blit and strand the
  // host transform, which is what corrupted the whole battle render.
  if (w > 1 && h > 1 && e.iceCanvas && typeof ctx.getTransform === 'function') {
    try {
      // Never resize in a draw. A mismatch (for example a viewport change on
      // the same frame) uses direct Gold rendering for this frame; tick will
      // prepare the backing store only once the material is inactive.
      const sized = e.iceCanvas.width === w && e.iceCanvas.height === h;
      const ic = sized ? e.iceCtx : null;
      if (ic) {
        const m = ctx.getTransform();
        ic.setTransform(1, 0, 0, 1, 0, 0);
        ic.clearRect(0, 0, e.iceCanvas.width, e.iceCanvas.height);
        const trace = currentIntegrity(S);
        if (trace && trace.simFrame === renderAudit.frame) trace.canvas.cleared = true;
        ic.setTransform(m);
        const painted = e.ice.render(ic, e.t, px);
        if (trace && trace.simFrame === renderAudit.frame) trace.canvas.painted = !!painted;
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
  noteRenderSource(S, 'frost-ice-direct-fallback');
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
  if (reactionParticlesEnabled) {
    try { G.drawRibbonLayer(ctx); } catch (err) {}
    try { G.drawAirShapes(ctx, px); } catch (err) {}
  }
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
    ready: !!api.ready, engineReady: !!e.ready, engineCount: liveStates.size,
    iceCanvas: [e.iceCanvas.width, e.iceCanvas.height],
    ventCanvas: [e.ventCanvas.width, e.ventCanvas.height],
    surfaceResizes: e.surfaceResizeCount || 0,
    surfaceResizeDuringDraw: e.surfaceResizeDuringDraw || 0,
    renderAudit: { ...renderAudit },
    choreography: {
      castClock: S.a1.castClock, startClock: S.a1.startClock,
      elapsed: S.a1.startClock > -90 ? +(clock() - S.a1.startClock).toFixed(3) : null,
      gameplayElapsed: S.a1.castClock > -90 ? +(clock() - S.a1.castClock).toFixed(3) : null,
      lateRecoveries: S.a1.lateRecoveries || 0,
      jaw: +e.jaw.x.toFixed(3), jawGoal: +e.jaw.goal.toFixed(3), eye: +e.eye.x.toFixed(3),
      vent: +e.vent.x.toFixed(3), crest: +e.crestLift.x.toFixed(3),
      mouthCharge: e.mode === 'a1' ? +(e.modeT <= A1_RELEASE_BEAT
        ? G.smooth(0.055, 0.22, e.modeT)
        : 1 - G.smooth(0.30, 0.42, e.modeT)).toFixed(3) : 0,
    },
    ambience: api.ambienceState(),
    reactions: { ...S.reactions,
      rootX: e.rootX ? +e.rootX.x.toFixed(3) : 0, rootY: e.rootY ? +e.rootY.x.toFixed(3) : 0,
      headLagX: +e.lagX.x.toFixed(3), headLagY: +e.lagY.x.toFixed(3),
      rearX: e.rearX ? +e.rearX.x.toFixed(3) : 0, rearY: e.rearY ? +e.rearY.x.toFixed(3) : 0,
      stress: e.impactStress ? +e.impactStress.x.toFixed(3) : 0,
      particlesEnabled: reactionParticlesEnabled },
    path: S.a2.path ? { castId: S.a2.path.castId, consumed: S.a2.path.next,
      laid: S.a2.path.laid, carry: +S.a2.path.carry.toFixed(3),
      endpoint: [S.a2.path.x, S.a2.path.y] } : null,
  };
};
api.integrityTrace = function () { return integrityFrames.map((r) => ({ ...r, renderSources: r.renderSources.slice(), segments: r.segments.map((n) => ({ ...n })) })); };
api.clearIntegrityTrace = function () {
  integrityFrames.length = 0;
  for (const [, S] of liveStates) { S.integrityActiveIds = new Set(); S.integrityRetired = 0; }
};

if (G && typeof G.load === 'function' && !api.ready) {
  try {
    G.load().then(() => { api.ready = true; }).catch((e) => { api.error = String(e); });
  } catch (e) { api.error = String(e); }
}

g.apexFrostPresentationRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);