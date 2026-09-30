/* =============================================================================
 * CRYSTALA V1 — gameplay truth (APEX_CRYSTAL).
 *
 * Authority: docs/hero-rework/crystala-v1/00_CRYSTALA_IMPLEMENTATION_AUTHORITY.md
 *
 * Owns (real APEX truth): six immortal shard semantic records, K/A2 awakening
 * (8.0 s cooldown via the AbilityController, 2.4 s active), the smart threat
 * predictor with just-in-time reachable-shard reservation and independent
 * per-shard jobs, real shard/projectile contact, the intercept/reflection
 * transaction (passive scales CURRENT damage once; crit/provenance kept; owner
 * -> Crystal; one reflection per projectile; T6 never), J/A1 context construct
 * (6 ORBIT -> Prison, 2..5 -> Wall, 0..1 -> fail, no buffering), real Wall
 * (W220/HP120/4.0 s from material lock) and Prison (R135/6 x HP75/3.0 s from
 * closure) HP + lifetimes, physical capsule geometry of the visibly grown
 * material, and first-pass telemetry.
 *
 * Does NOT own appearance: crystalaGoldV6.js (gameplay-neutral Gold rig) moves
 * the six stones and builds the material; this module only DRIVES it through
 * its semantic API and READS the grown-cell geometry back as collision truth.
 *
 * Integration surface (all optional/lazy, called by heroReworkRuntime.js):
 *   CR.tick(dt)                     top of the rework projectile pass
 *   CR.holdStep(p)                  bullet held inside a gem during refraction
 *   CR.resolveBullet(p,tBody,dt)    earliest of shard contact / construct hit
 *   CR.afterBodyHit / noteBodyHit   telemetry
 *   CR.thrownSurface / thrownHit    thrown melee vs construct (ricochet law)
 *   CR.capsules()                   solid capsules for the shared geometry hook
 *   executors: canCast/cast/aiCanAttempt/onTeardown in heroMechanicsRuntime.js
 * ========================================================================== */
(function (g) {
'use strict';
if (g.APEX_CRYSTAL) return;

const AIL = g.APEX_HERO_REWORK_AIL;
const GOLD = g.APEX_CRYSTALA_GOLD;
if (!AIL || !GOLD) throw new Error('crystalGameplayRuntime requires ailRuntime + crystalaGoldV6');

/* ------------------------------------------------------------ frozen V1 law */
const BAND = 180;              // intercept/contact band radius from the Crystal centre
const SCAN = 1000;             // prediction radius (never an instant reservation)
const MIN_LEAD = 0.12;         // minimum visible anticipation beat (s)
const RESCUE_BANDS = Object.freeze([180, 150, 120, 90]); // 180 preferred; inward only when a real fast shot cannot satisfy the beat there
const REFRACT = 0.16;          // Gold internal-light beat
const RECOIL = 0.16;           // free drift after the exit impulse
const RETURN_T = 0.88;         // REFRACT + RECOIL + RETURN_T = 1.20 s contact -> dock
const ABORT_T = 0.5;           // Gold-style banking return for an aborted job
const JIT_SLACK = 0.010;       // reserve when tBand - dt <= lead + slack
const TRAVEL_K = 1.12 / 1000;  // shard travel-time model (Hermite arc, s per px)
const TRAVEL_BASE = 0.02;
const CAP_R = 19.5;            // half thickness of the grown material capsule (mean cell height)
const TTI_QUANT = 0.0005;      // deterministic tie grid for simultaneous threats
const SHARDS = 6;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const HR = () => g.APEX_HERO_REWORK;
const CFG = () => g.APEX_ARSENAL_CONFIG;
const WAPI = () => (g.APEX_ARSENAL && g.APEX_ARSENAL.weaponApi) || null;
const gameSize = () => g.GAME_SIZE || 1000;
const GEOM = () => (HR() && HR().geom) || null;

const STATE = Object.freeze({
  ORBIT: 'ORBIT', RESERVED: 'RESERVED', OUTBOUND: 'OUTBOUND', REFRACT: 'REFRACT',
  RECOIL: 'RECOIL', RETURN: 'RETURN', ABORT_RETURN: 'ABORT_RETURN',
  CONSTRUCT_TRAVEL: 'CONSTRUCT_TRAVEL', ANCHORED: 'ANCHORED', DETACH: 'DETACH',
});

const CR = { version: 'crystala-v1', STATE, BAND, SCAN, MIN_LEAD, REFRACT, RECOIL, RETURN_T, ABORT_T, CAP_R };
g.APEX_CRYSTAL = CR;
g.apexCrystalGameplayRuntime = 'ready';

const states = new WeakMap();
let presentation = false;
let capCache = null;
const invalidate = () => { capCache = null; };

function emit(type, payload) { try { AIL.bus.emit(type, payload); } catch (e) { /* telemetry never breaks play */ } }
function hrOf(p) { return p.__hr || (p.__hr = {}); }
function isT6(p) { return p.weapon === 'STORMBREAKER' || p.weapon === 'T6'; }

function newTele() {
  return {
    kCasts: 0, jCasts: 0, wallCasts: 0, prisonCasts: 0,
    threatsSeen: 0, ignoredMiss: 0, ignoredBlocked: 0, ignoredExpired: 0, ignoredUnreachable: 0,
    overflowThreats: 0, overflowHits: 0, reservations: 0, intercepts: 0, aborts: 0,
    repeatIntercepts: 0, reflectedDamage: 0, preventedDamage: 0, shardBusySeconds: 0,
    constructDamage: 0, wallBreaks: 0, facetBreaks: 0, constructEnds: [], jPerK: [],
    constructReflects: 0, reflectedProjectiles: 0, urgentReservations: 0,
  };
}

function ensure(ct) {
  let st = states.get(ct);
  if (st) return st;
  const rig = GOLD.createRig({ seed: 20260930 + (ct.idx | 0) * 101, visual: presentation });
  rig.bound = gameSize();
  st = {
    ct, rig, t0: AIL.clock(), jobSeq: 0, consSeq: 0, pidSeq: 0,
    shards: [], jobs: [], constructs: [], seen: new WeakSet(), tick: 0,
    k: { active: false, startedAt: 0, until: 0, jCasts: 0, hits: new Array(SHARDS).fill(0) },
    tele: (ct.telemetry.crystal = newTele()),
  };
  for (let i = 0; i < SHARDS; i++) st.shards.push({ id: i, state: STATE.ORBIT, job: null, consId: null, busyAt: 0, x0: 0, y0: 0 });
  rig.onDock = (uid) => {
    const s = st.shards[uid];
    if (!s) return;
    s.state = STATE.ORBIT; s.job = null; s.consId = null;
    emit('CrystalDock', { shard: uid, at: AIL.clock() });
  };
  const b = ct.anchor;
  rig.setBody(b.x, b.y, 0, 0);
  states.set(ct, st);
  return st;
}
function stateOf(ct) { return states.get(ct) || null; }
const kActive = (st) => st.k.active && AIL.clock() < st.k.until - 1e-9;
const availableIds = (st) => st.shards.filter((s) => s.state === STATE.ORBIT).map((s) => s.id);
function crystals() {
  const M = HR() && HR().match;
  if (!M) return [];
  return M.combatants.filter((ct) => ct && !ct.facade && ct.heroId === 'CRYSTAL');
}
function enemyAnchorOf(ct) {
  const M = HR() && HR().match;
  if (!M) return null;
  const e = M.combatants.find((c) => c !== ct);
  if (!e) return null;
  const living = (e.bodies || []).filter((b) => b && b.hp > 0);
  return (e.anchor && e.anchor.hp > 0 ? e.anchor : living[0]) || null;
}

/* ============================================================ K / AWAKENING */
function castAwakening(ctx) {
  const ct = ctx.combatant, st = ensure(ct), now = AIL.clock();
  if (kActive(st)) return false;
  const cfg = ctx.cfg;
  st.k = { active: true, startedAt: now, until: now + (cfg.active != null ? cfg.active : 2.4), jCasts: 0, hits: new Array(SHARDS).fill(0) };
  st.tele.kCasts += 1;
  st.rig.awaken(1.0, 0.85);
  emit('CrystalAwaken', { combatant: ct.heroId, at: now, until: st.k.until });
  return true;
}
function endAwakening(st, now) {
  if (!st.k.active) return;
  st.k.active = false;
  st.tele.jPerK.push(st.k.jCasts);
  emit('CrystalAwakenEnd', { at: now, jCasts: st.k.jCasts });
}

/* ================================================================ PREDICTOR */
// smallest t >= 0 where |d + w t| <= R (null if never). d,w are 2D.
function firstWithin(dx, dy, wx, wy, R) {
  const c = dx * dx + dy * dy - R * R;
  if (c <= 0) return 0;
  const a = wx * wx + wy * wy;
  if (a < 1e-9) return null;
  const b = 2 * (dx * wx + dy * wy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
  if (t1 >= 0) return t1;
  return t2 >= 0 ? t2 : null;
}

// Why a projectile is NOT a K threat at all (no telemetry, no bookkeeping).
function notAThreat(st, p) {
  if (!p || !p.aq || p.type !== 'aq_bullet' || !(p.life > 0)) return true;
  if (isT6(p)) return true;                                   // T6 never reflectable
  const hr = p.__hr;
  if (hr && (hr.crystalReflected || hr.cryHold)) return true; // one reflection, ever
  const HRr = HR();
  const oct = p.owner && HRr ? HRr.byCombatant(p.owner) : null;
  if (oct === st.ct) return true;                             // Crystal-owned never wakes K
  return false;
}

// Earliest time the straight path hits a blocking solid construct (before tMax).
function firstBlock(p, tMax) {
  const G = GEOM(); if (!G) return null;
  const x1 = p.x + p.vx * tMax, y1 = p.y + p.vy * tMax;
  let best = null;
  for (const cap of capsules()) {
    if (!interacts(p, cap)) continue;
    const r = G.capsuleToi(p.x, p.y, x1, y1, cap.ax, cap.ay, cap.bx, cap.by, cap.r + (p.radius || 7));
    if (r && (best == null || r.t < best)) best = r.t;
  }
  return best == null ? null : best * tMax;
}

function classify(st, p, now, dt) {
  const b = st.ct.anchor;
  const hr = hrOf(p);
  if (hr.cryPid == null) hr.cryPid = ++st.pidSeq;
  const d0x = p.x - b.x, d0y = p.y - b.y;
  const dist0 = Math.hypot(d0x, d0y);
  if (dist0 > SCAN) return null;                              // outside the prediction radius
  const first = !st.seen.has(p);
  if (first) { st.seen.add(p); st.tele.threatsSeen += 1; }
  const v = b.__hrVel || { x: 0, y: 0 };
  const wx = p.vx - v.x, wy = p.vy - v.y;
  const RH = b.radius * ((CFG() && CFG().BULLET_HIT_RADIUS_SCALE) || 0.78) + (p.radius || 7);
  const tHit = firstWithin(d0x, d0y, wx, wy, RH);
  if (tHit == null) { if (first) st.tele.ignoredMiss += 1; return { drop: 'miss' }; }
  if (tHit >= p.life) { if (first) st.tele.ignoredExpired += 1; return { drop: 'expired' }; }
  const blockT = firstBlock(p, Math.min(tHit, p.life));
  if (blockT != null && blockT < tHit) { if (first) st.tele.ignoredBlocked += 1; return { drop: 'blocked' }; }
  return { p, hr, tHit, d0x, d0y, wx, wy, RH, dist0 };
}

function stonePos(st, id) { const s = st.rig.stones[id]; return s; }
function physicalLeadFor(st, id, ip) {
  const s = stonePos(st, id);
  const travel = Math.hypot(s.x - ip.x, s.y - ip.y);
  return travel * TRAVEL_K + TRAVEL_BASE;
}
function rescueBandsFor(c) {
  // 180 px remains the authored Gold-preferred contact. Inward bands are
  // progressively later opportunities before the real body hit.
  const finalBand = Math.ceil(c.RH + 12);
  const emergencyBand = c.dist0 > c.RH + 2
    ? Math.max(c.RH + 2, Math.min(finalBand, c.dist0 - 1))
    : null;
  return [...new Set([...RESCUE_BANDS, finalBand, emergencyBand].filter(Number.isFinite))]
    .filter(b => b > c.RH + 1 && b <= BAND && b < c.dist0)
    .sort((a, b) => b - a);
}
function interceptOption(st, c, id, band, dt) {
  const tBand = firstWithin(c.d0x, c.d0y, c.wx, c.wy, band);
  if (tBand == null || tBand <= 0 || tBand >= c.tHit || tBand >= c.p.life) return null;
  const ip = { x: c.p.x + c.p.vx * tBand, y: c.p.y + c.p.vy * tBand };
  const physicalLead = physicalLeadFor(st, id, ip);
  const rescue = band < BAND;
  const physicalWindow = rescue ? tBand : Math.max(0, tBand - dt);
  const visualLeadOk = tBand >= MIN_LEAD - JIT_SLACK;
  const physicalOk = physicalWindow >= physicalLead - JIT_SLACK;
  return {
    id, band, tBand, ip, physicalLead, rescue, visualLeadOk, physicalOk,
    urgent: !visualLeadOk || !physicalOk,
    accelerated: !physicalOk,
    // Healthy jobs use the authored physical travel lead. Accelerated guardian
    // jobs consume all remaining time to the real contact point.
    lead: Math.max(1 / 120, physicalOk ? physicalLead : tBand),
  };
}
function chooseIntercept(st, c, free, taken, dt) {
  const bands = rescueBandsFor(c);
  const all = [];
  for (const band of bands) {
    for (const id of free) {
      if (taken.has(id)) continue;
      const o = interceptOption(st, c, id, band, dt);
      if (!o) continue;
      o.score = st.rig.scoreStone(st.rig.stones[id], c.p.vx, c.p.vy, o.ip);
      all.push(o);
    }
  }
  if (!all.length) return null;

  // Tier 0: Gold-preferred readable interception (>=0.12 s and normal travel).
  // Tier 1: still physically reachable, but too urgent for the full anticipation beat.
  // Tier 2: last-chance guardian dash. The shard uses the SAME Gold Hermite
  // trajectory/contact/refract/recoil/return grammar, simply compressed into
  // the actual remaining time. This is the hero fantasy: an AVAILABLE shard
  // defends independently instead of the whole K system declining the shot.
  const tier = (o) => o.physicalOk && o.visualLeadOk ? 0 : o.physicalOk ? 1 : 2;
  all.sort((a, b) => {
    // Gold contact language wins first: take the OUTERMOST still-future band
    // (normally 180 px). If that shard must move faster, accelerate THAT shard
    // instead of dragging the block point inward toward Crystal.
    if (Math.abs(a.band - b.band) > 1e-9) return b.band - a.band;
    const ta = tier(a), tb = tier(b);
    if (ta !== tb) return ta - tb;
    return b.score - a.score;
  });
  return all[0];
}

function predictorStep(st, now, dt) {
  const list = (g.projectiles || []);
  const cands = [];
  for (const p of list) {
    if (notAThreat(st, p)) continue;
    const hr = p.__hr;
    if (hr && hr.cryTid) continue;                            // already reserved
    if (hr && hr.cryLost) continue;                           // decided once: overflow / unreachable
    const c = classify(st, p, now, dt);
    if (!c || c.drop) continue;
    cands.push(c);
  }
  if (!cands.length) return;
  // simultaneous threats: earliest predicted time-to-hit, then higher current
  // damage, then stable projectile id; each gets at most ONE distinct shard.
  cands.sort((a, b) =>
    (Math.round(a.tHit / TTI_QUANT) - Math.round(b.tHit / TTI_QUANT))
    || ((b.p.damage || 0) - (a.p.damage || 0))
    || (a.hr.cryPid - b.hr.cryPid));
  const free = availableIds(st);
  const taken = new Set();
  for (const c of cands) {
    // STICKY PLAN: keep both the shard and its chosen contact band. 180 px is
    // always tried first; inward rescue bands are considered only when NO free
    // shard can satisfy the authored anticipation/reachability law at 180.
    let plan = c.hr.cryPlan;
    let opt = null;
    if (plan && free.includes(plan.id) && !taken.has(plan.id)) {
      opt = interceptOption(st, c, plan.id, plan.band, dt);
      if (!opt) plan = null;
    } else if (plan) {
      plan = null;
    }

    if (!plan) {
      opt = chooseIntercept(st, c, free, taken, dt);
      if (opt) plan = { id: opt.id, band: opt.band };
      c.hr.cryPlan = plan;
      if (!plan) {
        const anyFree = free.some((id) => !taken.has(id));
        // Capacity is per-shard, never global. A real incoming hit is dropped
        // only when no distinct AVAILABLE shard remains to own this threat.
        if (!anyFree) {
          c.hr.cryLost = 'busy';
          st.tele.overflowThreats += 1;
          c.hr.cryOverflow = true;
        } else if (c.tHit <= Math.max(dt, 1 / 120)) {
          // Extremely late discovery with a free shard: record honestly, but
          // this means the projectile is already at the body inside this tick.
          c.hr.cryLost = 'unreachable';
          st.tele.ignoredUnreachable += 1;
        }
        continue;
      }
    } else if (!opt) {
      opt = interceptOption(st, c, plan.id, plan.band, dt);
      if (!opt) {
        opt = chooseIntercept(st, c, free, taken, dt);
        plan = opt ? { id: opt.id, band: opt.band } : null;
        c.hr.cryPlan = plan;
        if (!plan) continue;
      }
    }

    taken.add(plan.id);
    // Any rescue/urgent assignment launches immediately. Only a healthy 180px
    // plan waits just-in-time; this keeps maximum independent shard capacity.
    if (opt.rescue || opt.urgent || opt.tBand - dt <= opt.lead + Math.max(JIT_SLACK, dt)) {
      reserve(st, { ...c, tBand: opt.tBand, ip: opt.ip, band: opt.band, rescue: opt.rescue,
        urgent: !!opt.urgent, accelerated: !!opt.accelerated }, plan.id, now);
    }
  }
}

function launchReservedJob(st, job, now) {
  const s = st.shards[job.shard], rig = st.rig;
  if (!job || job.phase !== STATE.RESERVED) return;
  const T = Math.max(1 / 120, job.tContact - now);
  rig.beginIntercept(job.shard, job.ip, T, job.pv, job.facet);
  s.state = STATE.OUTBOUND; job.phase = STATE.OUTBOUND; job.T = T; job.launchedAt = now;
}

function reserve(st, c, id, now) {
  const p = c.p, hr = c.hr, s = st.shards[id];
  const pv = { x: p.vx, y: p.vy };
  const facet = st.rig.reserve(id, pv);
  const job = {
    id: ++st.jobSeq, shard: id, p, pid: hr.cryPid, ip: c.ip, pv, facet, tContact: now + c.tBand,
    band: c.band || BAND, rescue: !!c.rescue, urgent: !!c.urgent, accelerated: !!c.accelerated,
    reservedAt: now, phase: STATE.RESERVED, incoming: scaledDamageOf(p),
  };
  s.state = STATE.RESERVED; s.job = job; s.busyAt = now;
  hr.cryTid = job.id;
  st.jobs.push(job);
  st.tele.reservations += 1;
  if (job.urgent) st.tele.urgentReservations += 1;
  emit('CrystalReserve', { shard: id, tid: job.id, pid: hr.cryPid, tBand: c.tBand, band: job.band, rescue: job.rescue,
    urgent: job.urgent, accelerated: job.accelerated, ip: c.ip });
  if (job.rescue || job.urgent) launchReservedJob(st, job, now);
}

function scaledDamageOf(p) {
  const W = WAPI();
  if (isT6(p)) {
    const C = CFG();
    return (C && C.WEAPONS && C.WEAPONS.STORMBREAKER && C.WEAPONS.STORMBREAKER.confirmedHitDamage) || 446;
  }
  if (W && W.scaledDamage) return W.scaledDamage(p.damage, p.weapon, !!p.critical);
  const C = CFG();
  return p.damage * ((C && C.ARSENAL_DAMAGE_SCALE) || 1);
}

/* ================================================================ JOB STEP */
function projectileAlive(p) {
  if (!p || !(p.life > 0)) return false;
  const list = g.projectiles || [];
  return list.indexOf(p) >= 0;
}
function abortJob(st, job, reason, now) {
  const s = st.shards[job.shard];
  job.phase = 'ABORT'; job.reason = reason;
  st.rig.abortReturn(job.shard, ABORT_T);
  s.state = STATE.ABORT_RETURN;
  st.tele.aborts += 1;
  emit('CrystalAbort', { shard: job.shard, tid: job.id, reason, at: now });
  finishJob(st, job);
}
function finishJob(st, job) {
  const i = st.jobs.indexOf(job);
  if (i >= 0) st.jobs.splice(i, 1);
}

function jobsStep(st, now, dt) {
  for (const job of st.jobs.slice()) {
    const s = st.shards[job.shard], rig = st.rig;
    if (job.phase === STATE.RESERVED) {
      if (!projectileAlive(job.p)) { abortJob(st, job, 'threat-gone', now); continue; }
      if (now > job.reservedAt + 1e-9) launchReservedJob(st, job, now);
    } else if (job.phase === STATE.OUTBOUND) {
      if (!projectileAlive(job.p)) { abortJob(st, job, 'threat-gone', now); continue; }
      // the threat was turned (Wall/facet reflection) or held by something else: nothing left to meet
      if (job.p.__hr && (job.p.__hr.crystalReflected || job.p.__hr.cryHold)) { abortJob(st, job, 'blocked', now); continue; }
      if (now > job.tContact + 0.30) { abortJob(st, job, 'missed', now); continue; }
    } else if (job.phase === STATE.REFRACT) {
      if (now >= job.releaseAt - 1e-9) releaseLeg(st, job, now);
    } else if (job.phase === STATE.RECOIL) {
      if (now >= job.returnStart - 1e-9) {
        const T = Math.max(0.3, RETURN_T - Math.max(0, now - job.returnStart));
        rig.returnHome(job.shard, T);
        s.state = STATE.RETURN; job.phase = STATE.RETURN;
        finishJob(st, job);
      }
    }
  }
}

function releaseLeg(st, job, now) {
  const p = job.p, rig = st.rig, s = st.shards[job.shard], stone = rig.stones[job.shard];
  const hold = p.__hr && p.__hr.cryHold;
  if (hold) {
    p.x = stone.x + hold.exit.x; p.y = stone.y + hold.exit.y; p.px = p.x; p.py = p.y;
    p.vx = hold.exitV.x; p.vy = hold.exitV.y;
    p.life = hold.life;
    p.__hr.cryHold = null;
    p.__hr.cryLeg = 'released';
  }
  rig.recoilKick(job.shard, job.exitV);
  s.state = STATE.RECOIL; job.phase = STATE.RECOIL;
  job.returnStart = job.contactAt + REFRACT + RECOIL;
  emit('CrystalRelease', { shard: job.shard, tid: job.id, at: now, vx: job.exitV.x, vy: job.exitV.y });
}

/* ======================================================= CONTACT / REFLECTION */
// held bullet: frozen inside the gem, life is kept alive across the beat.
function holdStep(p) {
  const hr = p.__hr;
  if (!hr || !hr.cryHold) return false;
  p.life = Math.max(p.life, hr.cryHold.life + 0.1);
  return true;
}

function reflectVec(vx, vy, nx, ny) {
  const d = vx * nx + vy * ny;
  return { x: vx - 2 * d * nx, y: vy - 2 * d * ny };
}

// Passive: scales CURRENT damage exactly once; crit/provenance untouched; owner
// -> Crystal; marked so it can never be Crystal-reflected again.
function applyPassive(st, p) {
  const ct = st.ct;
  const pct = ct.skills.PASSIVE.cfg.reflectedDamagePct;
  const hr = hrOf(p);
  p.damage *= pct;
  p.owner = ct.anchor;
  hr.crystalReflected = true;
  hr.neutral = false;
  hr.cryOwner = ct.idx;
  st.tele.reflectedProjectiles += 1;
  return pct;
}

function shardToi(st, p, job) {
  const stone = st.rig.stones[job.shard], sh = st.shards[job.shard];
  const R = stone.gem.r * 0.95 + (p.radius || 7);
  const dx0 = p.px - sh.x0, dy0 = p.py - sh.y0;
  const wx = (p.x - p.px) - (stone.x - sh.x0), wy = (p.y - p.py) - (stone.y - sh.y0);
  const t = firstWithin(dx0, dy0, wx, wy, R);
  return t != null && t <= 1 ? t : null;
}

function interacts(p, cap) {
  const hr = p.__hr;
  if (hr && hr.crystalReflected) return false;                // reflected legs ignore every construct
  const HRr = HR();
  const oct = p.owner && HRr ? HRr.byCombatant(p.owner) : null;
  if (oct && oct === cap.cons.ct) return false;              // own projectiles pass through own material
  if (hr && hr.cryPassed && hr.cryPassed[cap.cons.id + ':' + cap.idx]) return false;
  return true;
}

function resolveBullet(p, tBody, dt) {
  const M = HR() && HR().match;
  if (!M) return null;
  const G = GEOM(); if (!G) return null;
  const hr = p.__hr || null;
  if (hr && hr.cryHold) return { consumed: true };
  let best = null;
  // 1) the assigned shard (real contact with the real, moving gem)
  if (hr && hr.cryTid) {
    const job = jobById(hr.cryTid);
    if (job && job.phase === STATE.OUTBOUND) {
      const st = job.st, t = shardToi(st, p, job);
      if (t != null) best = { kind: 'shard', t, job, st };
    }
  }
  // 2) solid construct material
  if (!(hr && hr.crystalReflected)) {
    for (const cap of capsules()) {
      if (!interacts(p, cap)) continue;
      const r = G.capsuleToi(p.px, p.py, p.x, p.y, cap.ax, cap.ay, cap.bx, cap.by, cap.r + (p.radius || 7));
      if (r && (!best || r.t < best.t)) best = { kind: 'cap', t: r.t, cap, n: { x: r.nx, y: r.ny } };
    }
  }
  if (!best || best.t >= tBody) return null;                  // a body is hit first (or nothing)
  return best.kind === 'shard' ? shardContact(best, p, dt) : constructHit(best, p, dt);
}

function jobById(id) {
  for (const ct of crystals()) {
    const st = states.get(ct); if (!st) continue;
    for (const j of st.jobs) if (j.id === id) { j.st = st; return j; }
  }
  return null;
}

function shardContact(best, p, dt) {
  const { job, st } = best;
  const rig = st.rig, stone = rig.stones[job.shard], s = st.shards[job.shard];
  const now = AIL.clock();
  const hr = hrOf(p);
  const sh = st.shards[job.shard];
  const cx = p.px + (p.x - p.px) * best.t, cy = p.py + (p.y - p.py) * best.t;
  const sx = sh.x0 + (stone.x - sh.x0) * best.t, sy = sh.y0 + (stone.y - sh.y0) * best.t;
  // real facet normal at this instant; if the indexed facet is not facing the ray
  // fall back to the contact radial (a sphere-like bounce), never a teleport.
  let n = rig.facetNormal(job.shard, job.facet);
  const sp = Math.hypot(p.vx, p.vy) || 1;
  if ((p.vx * n.x + p.vy * n.y) / sp > -0.3) {
    const rx = cx - sx, ry = cy - sy, rm = Math.hypot(rx, ry) || 1;
    n = { x: rx / rm, y: ry / rm };
  }
  const inV = { x: p.vx, y: p.vy };
  const exitV = reflectVec(p.vx, p.vy, n.x, n.y);
  const incoming = scaledDamageOf(p);
  const pct = applyPassive(st, p);
  const exit = rig.refract(job.shard, { x: cx, y: cy }, exitV, p.radius || 7);
  const contactAt = now - (dt || 0) * (1 - best.t);
  job.contactAt = contactAt; job.exitV = exitV; job.phase = STATE.REFRACT; job.releaseAt = contactAt + REFRACT;
  job.contact = { x: cx, y: cy };
  s.state = STATE.REFRACT;
  hr.cryHold = { exit, exitV, life: p.life };
  p.life = Math.max(p.life, 0) + 0.1;                        // engine decrements life every step; survive the beat
  p.x = cx; p.y = cy; p.px = cx; p.py = cy; p.vx = 0; p.vy = 0;
  st.tele.intercepts += 1;
  st.tele.preventedDamage += incoming;
  st.k.hits[job.shard] += 1;
  if (st.k.hits[job.shard] === 2) st.tele.repeatIntercepts += 1;
  emit('CrystalIntercept', { shard: job.shard, tid: job.id, at: now, x: cx, y: cy, damage: p.damage, prevented: incoming,
    n, inV, exitV, contactAt });
  emit('CrystalReflect', { body: st.ct.anchor.id, damage: p.damage, shard: job.shard, pct });
  return { consumed: true, kind: 'shard' };
}

/* ====================================================== CONSTRUCT HIT / HP */
function structDamage(p) { return scaledDamageOf(p); }

function constructHit(best, p, dt) {
  const { cap } = best, cons = cap.cons, st = cons.st;
  const hx = p.px + (p.x - p.px) * best.t, hy = p.py + (p.y - p.py) * best.t;
  const n = best.n;
  const t6 = isT6(p);
  const dmg = structDamage(p);
  const hr = hrOf(p);
  let reflected = false;
  if (!t6) {
    const v = reflectVec(p.vx, p.vy, n.x, n.y);
    applyPassive(st, p);
    p.vx = v.x; p.vy = v.y;
    p.x = hx + n.x * ((p.radius || 7) + 1.5); p.y = hy + n.y * ((p.radius || 7) + 1.5);
    p.px = p.x; p.py = p.y;
    reflected = true;
    st.tele.constructReflects += 1;
    emit('CrystalConstructReflect', { cons: cons.id, kind: cap.kind, facet: cap.idx, x: hx, y: hy, damage: p.damage });
    emit('CrystalReflect', { body: st.ct.anchor.id, damage: p.damage, cons: cons.id });   // compat observers
  } else {
    (hr.cryPassed || (hr.cryPassed = {}))[cons.id + ':' + cap.idx] = true;
  }
  damageConstruct(st, cons, cap, dmg, hx, hy, p.vx, p.vy, t6 ? 'T6' : 'hit');
  return { consumed: reflected, kind: 'construct', reflected };
}

// ONE authoritative structural transaction: real HP, visual response at the real
// contact point, break/reflect ordering handled by the caller (reflect first).
function damageConstruct(st, cons, cap, dmg, hx, hy, vx, vy, why) {
  if (cons.state !== 'LIVE') return;
  st.tele.constructDamage += dmg;
  emit('CrystalConstructHit', { cons: cons.id, kind: cons.kind, facet: cap.idx, damage: dmg, why });
  if (cons.kind === 'wall') {
    cons.hp -= dmg;
    const idx = st.rig.wallHit(cons.rc.geom, hx, hy, dmg / cons.maxHp, vx, vy);
    if (cons.hp <= 0) breakWall(st, cons, 'destroyed', idx);
  } else {
    const f = cons.facets[cap.idx];
    if (!f || f.dead) return;
    f.hp -= dmg;
    const idx = st.rig.facetHit(cons.rc, cap.idx, hx, hy, dmg / f.max, vx, vy);
    if (f.hp <= 0) breakFacet(st, cons, cap.idx, idx);
  }
}

function constructEnded(st, cons, reason) {
  cons.state = 'ENDED'; cons.endReason = reason; cons.endedAt = AIL.clock();
  st.tele.constructEnds.push({ kind: cons.kind, reason, at: cons.endedAt, hp: cons.kind === 'wall' ? Math.max(0, cons.hp) : cons.facets.map((f) => Math.max(0, f.hp)) });
  emit('CrystalConstructEnd', { cons: cons.id, kind: cons.kind, reason });
  invalidate();
}
function breakWall(st, cons, reason, hitIdx) {
  if (cons.state !== 'LIVE') return;
  if (reason === 'destroyed') st.tele.wallBreaks += 1;
  constructEnded(st, cons, reason);
  st.rig.collapseWall(cons.rc, hitIdx);
  st.rig.detachWall(cons.rc);
  for (const id of cons.shardIds) { st.shards[id].state = STATE.DETACH; }
  emit('CrystalConstructBreak', { cons: cons.id, kind: 'wall', reason });
}
function breakFacet(st, cons, i, hitIdx) {
  const f = cons.facets[i];
  if (!f || f.dead) return;
  f.dead = true; f.hp = Math.min(f.hp, 0);
  st.tele.facetBreaks += 1;
  st.rig.breakFacet(cons.rc, i, hitIdx);
  invalidate();
  emit('CrystalFacetBreak', { cons: cons.id, facet: i });
  // a vertex shard whose two adjacent facets are both gone has no structure to hold
  const release = [];
  for (const a of cons.assign) {
    const e1 = (a.vIdx + 5) % 6, e2 = a.vIdx;
    if (cons.facets[e1].dead && cons.facets[e2].dead && st.shards[a.id].state === STATE.ANCHORED) release.push(a.id);
  }
  if (release.length) {
    st.rig.detachPrisonStones(cons.rc, release);
    for (const id of release) st.shards[id].state = STATE.DETACH;
  }
  if (cons.facets.every((x) => x.dead)) endPrison(st, cons, 'destroyed');
}
function endPrison(st, cons, reason) {
  if (cons.state !== 'LIVE') return;
  constructEnded(st, cons, reason);
  st.rig.collapsePrison(cons.rc);
  for (const a of cons.assign) {
    const s = st.shards[a.id];
    if (s.state === STATE.ANCHORED || s.state === STATE.CONSTRUCT_TRAVEL) s.state = STATE.DETACH;
  }
  emit('CrystalConstructBreak', { cons: cons.id, kind: 'prison', reason });
}

/* ------------------------------------------------------ thrown melee (ricochet) */
function thrownSurface(p) {
  const G = GEOM(); if (!G) return null;
  const caps = capsules();
  if (!caps.length) return null;
  let best = null;
  for (const cap of caps) {
    if (!interacts(p, cap)) continue;
    const r = G.capsuleToi(p.px, p.py, p.x, p.y, cap.ax, cap.ay, cap.bx, cap.by, cap.r + (p.radius || 10));
    if (r && (!best || r.t < best.t)) best = { crystal: true, t: r.t, cap, normal: { x: r.nx, y: r.ny } };
  }
  return best;
}
function thrownDamageOf(p) {
  const C = CFG(), W = WAPI();
  if (isT6(p)) return (C && C.WEAPONS && C.WEAPONS.STORMBREAKER && C.WEAPONS.STORMBREAKER.confirmedHitDamage) || 446;
  const raw = C && C.meleeDamage ? C.meleeDamage(p.weapon) : 0;
  return W && W.scaledDamage ? W.scaledDamage(raw, p.weapon, false) : raw;
}
function thrownHit(p, tw) {
  const cap = tw.cap, cons = cap.cons, st = cons.st;
  const hx = p.px + (p.x - p.px) * tw.t, hy = p.py + (p.y - p.py) * tw.t;
  const t6 = isT6(p);
  if (t6) (hrOf(p).cryPassed || (hrOf(p).cryPassed = {}))[cons.id + ':' + cap.idx] = true;
  else { // ricochet: stand just off the surface so the next sweep cannot re-hit it
    p.x = hx + tw.normal.x * ((p.radius || 10) + 1.5); p.y = hy + tw.normal.y * ((p.radius || 10) + 1.5);
    p.px = p.x; p.py = p.y;
  }
  damageConstruct(st, cons, cap, thrownDamageOf(p), hx, hy, p.vx, p.vy, t6 ? 'T6-thrown' : 'thrown');
  return { isT6: t6 };
}

/* =================================================================== J — CONSTRUCT */
function canCastConstruct(ctx) {
  const st = ensure(ctx.combatant);
  return kActive(st) && availableIds(st).length >= 2 && !!enemyAnchorOf(ctx.combatant);
}
function aiCanAttemptConstruct(ctx) {
  const st = ensure(ctx.combatant);
  return kActive(st) && availableIds(st).length >= 2 && !!enemyAnchorOf(ctx.combatant);
}
function castConstruct(ctx) {
  const ct = ctx.combatant, st = ensure(ct), now = AIL.clock();
  if (!kActive(st)) return false;
  const ids = availableIds(st);                               // snapshot at the INPUT EDGE
  if (ids.length < 2) return false;
  const ea = enemyAnchorOf(ct), me = ct.anchor;
  if (!ea) return false;
  const cfg = ctx.cfg;
  const mult = cfg.constructHpMult != null ? cfg.constructHpMult : 1;
  const cons = { id: ++st.consSeq, st, ct, state: 'LIVE', castAt: now, lockedAt: null, endAt: null, endReason: null };
  if (ids.length >= SHARDS) {
    const R = cfg.prison.radius;
    cons.kind = 'prison';
    cons.rc = st.rig.castPrison({ cx: ea.x, cy: ea.y, R, seed: 31 + st.consSeq });
    cons.facets = []; for (let i = 0; i < cfg.prison.facets; i++) { const hp = cfg.prison.facetHp * mult; cons.facets.push({ hp, max: hp, dead: false }); }
    cons.solidLife = cfg.prison.solidLifetime;
    cons.assign = cons.rc.assign.map(([s, , vi]) => ({ id: s.uid, vIdx: vi }));
    cons.shardIds = cons.assign.map((a) => a.id);
    st.tele.prisonCasts += 1;
  } else {
    const S = gameSize();
    let ux = ea.x - me.x, uy = ea.y - me.y;
    const d = Math.hypot(ux, uy);
    if (d < 1e-6) { ux = 1; uy = 0; } else { ux /= d; uy /= d; }
    const tx = -uy, ty = ux, half = cfg.wall.width / 2, off = Math.min(330, d * 0.48);
    const mx = clamp(me.x + ux * off, 130, S - 130), my = clamp(me.y + uy * off, 130, S - 130);
    const a0 = { x: mx - tx * half, y: my - ty * half }, a1 = { x: mx + tx * half, y: my + ty * half };
    const plan = st.rig.planWall(ids, a0, a1);
    cons.kind = 'wall';
    cons.rc = st.rig.castWall({ a0, a1, pair: plan.pair, seed: 7 + st.consSeq });
    cons.hp = cons.maxHp = cfg.wall.hp * mult;
    cons.solidLife = cfg.wall.solidLifetime;
    cons.shardIds = plan.pair.map((p) => p[0]);
    st.tele.wallCasts += 1;
  }
  for (const id of cons.shardIds) { const s = st.shards[id]; s.state = STATE.CONSTRUCT_TRAVEL; s.consId = cons.id; }
  st.constructs.push(cons);
  st.k.jCasts += 1; st.tele.jCasts += 1;
  invalidate();
  emit('CrystalConstructCast', { cons: cons.id, kind: cons.kind, shards: cons.shardIds.slice(), at: now });
  return true;
}

/* ------------------------------------------------------------- construct step */
function constructsStep(st, now, dt) {
  const rig = st.rig;
  for (let i = st.constructs.length - 1; i >= 0; i--) {
    const cons = st.constructs[i];
    if (cons.state === 'ENDED') { if (now - cons.endedAt > 3.2) st.constructs.splice(i, 1); continue; }
    if (cons.kind === 'prison' && !cons.rc.prison.frozen) {
      const ea = enemyAnchorOf(st.ct);
      if (ea) rig.prisonFollow(cons.rc, ea.x, ea.y);
    }
    if (cons.lockedAt == null && cons.rc.locked) {
      cons.lockedAt = st.t0 + cons.rc.lockTime;
      cons.endAt = cons.lockedAt + cons.solidLife;
      emit('CrystalConstructLocked', { cons: cons.id, kind: cons.kind, at: cons.lockedAt, endAt: cons.endAt });
      invalidate();
    }
    if (cons.lockedAt != null && now >= cons.endAt - 1e-9) {
      if (cons.kind === 'wall') breakWall(st, cons, 'expire', null); else endPrison(st, cons, 'expire');
    }
  }
}

function syncShards(st) {
  for (const s of st.shards) {
    const stone = st.rig.stones[s.id];
    if (s.state === STATE.CONSTRUCT_TRAVEL && stone.state === 'anchored') s.state = STATE.ANCHORED;
    else if (s.state === STATE.DETACH && stone.state === 'return') s.state = STATE.RETURN;
  }
}

/* ===================================================================== TICK */
function tick(dt) {
  const M = HR() && HR().match;
  if (!M || !(dt > 0)) return;
  const now = AIL.clock();
  for (const ct of crystals()) {
    const st = ensure(ct), b = ct.anchor;
    if (!b || b.hp <= 0) continue;
    const v = b.__hrVel || { x: 0, y: 0 };
    st.rig.setBody(b.x, b.y, v.x, v.y);
    if (st.k.active && now >= st.k.until - 1e-9) endAwakening(st, now);
    if (st.k.active) st.rig.awaken(1.0);
    constructsStep(st, now, dt);
    jobsStep(st, now, dt);
    syncShards(st);
    if (kActive(st)) predictorStep(st, now, dt);
    for (const s of st.shards) {
      const stone = st.rig.stones[s.id];
      s.x0 = stone.x; s.y0 = stone.y;
      if (s.job) st.tele.shardBusySeconds += dt;           // intercept-job occupancy (RESERVED..dock)
    }
    st.rig.advance(dt);
    st.tick += 1;
  }
  invalidate();
}

/* =========================================================== SOLID GEOMETRY */
function capsules() {
  if (capCache) return capCache;
  const list = [];
  for (const ct of crystals()) {
    const st = states.get(ct); if (!st) continue;
    for (const cons of st.constructs) {
      if (cons.state !== 'LIVE') continue;
      if (cons.kind === 'wall') {
        for (const r of st.rig.wallRuns(cons.rc))
          list.push({ ax: r.ax, ay: r.ay, bx: r.bx, by: r.by, r: CAP_R, cons, kind: 'wall', idx: -1 });
      } else {
        for (let i = 0; i < 6; i++) {
          if (cons.facets[i].dead) continue;
          for (const r of st.rig.facetRuns(cons.rc, i))
            list.push({ ax: r.ax, ay: r.ay, bx: r.bx, by: r.by, r: CAP_R, cons, kind: 'facet', idx: i });
        }
      }
    }
  }
  capCache = list;
  return list;
}

/* ============================================================ BODY-HIT NOTES */
function noteBodyHit(p, target) {
  const HRr = HR(); const ct = HRr && HRr.byCombatant(target);
  if (!ct || ct.heroId !== 'CRYSTAL') return;
  const st = states.get(ct);
  if (st && p.__hr && p.__hr.cryOverflow) st.tele.overflowHits += 1;
}
function afterBodyHit(p, target, realized) {
  const hr = p.__hr;
  if (!hr || !hr.crystalReflected || !(realized > 0)) return;
  const ct = HR().byCombatant(p.owner);
  const st = ct && states.get(ct);
  if (st) st.tele.reflectedDamage += realized;
}

/* ================================================================== PUBLIC API */
Object.assign(CR, {
  tick, holdStep, resolveBullet, capsules, thrownSurface, thrownHit, noteBodyHit, afterBodyHit,
  castAwakening, canCastConstruct, castConstruct, aiCanAttemptConstruct,
  stateOf,
  setPresentation(on) {
    presentation = !!on;
    for (const ct of crystals()) { const st = states.get(ct); if (st) st.rig.setVisual(presentation); }
  },
  get presentation() { return presentation; },
  teardown(ct) { const st = states.get(ct); if (st) { st.rig.onDock = null; states.delete(ct); } invalidate(); },
  // deterministic test/inspection surface
  inspect(ct) {
    const st = states.get(ct); if (!st) return null;
    return {
      k: { active: kActive(st), until: st.k.until, startedAt: st.k.startedAt, jCasts: st.k.jCasts },
      shards: st.shards.map((s) => ({ id: s.id, state: s.state, available: s.state === STATE.ORBIT, jobPhase: s.job ? s.job.phase : null })),
      available: availableIds(st).length,
      jobs: st.jobs.map((j) => ({ id: j.id, shard: j.shard, phase: j.phase, pid: j.pid, tContact: j.tContact })),
      constructs: st.constructs.map((c) => ({
        id: c.id, kind: c.kind, state: c.state, reason: c.endReason, lockedAt: c.lockedAt, endAt: c.endAt, solidLife: c.solidLife,
        hp: c.kind === 'wall' ? c.hp : c.facets.map((f) => f.hp), maxHp: c.kind === 'wall' ? c.maxHp : c.facets.map((f) => f.max),
        facetsDead: c.kind === 'prison' ? c.facets.map((f) => f.dead) : null,
        frozen: c.kind === 'prison' ? c.rc.prison.frozen : null, solid: c.kind === 'wall' ? !!(c.rc.geom && c.rc.geom.solid) : c.rc.prison.solid,
        shardIds: c.shardIds.slice(),
      })),
      telemetry: st.tele,
    };
  },
  rigOf(ct) { const st = states.get(ct); return st ? st.rig : null; },
});
})(typeof window !== 'undefined' ? window : globalThis);
