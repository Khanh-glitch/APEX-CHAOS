/* =============================================================================
 * CRYSTALA V1 — gameplay truth (APEX_CRYSTAL).
 *
 * Authority: docs/hero-rework/crystala-v1/00_CRYSTALA_IMPLEMENTATION_AUTHORITY.md
 *            docs/hero-rework/crystala-v1/02_CRYSTALA_V2_SIX_SHARD_RESOURCE_AUTHORITY.md
 *            (V2 minimal delta: Wall routing/HP/breaking-shot + K acquisition,
 *            radii, return timing, cooldown. HEXA/prison, Passive, T6 and the
 *            Gold visual language are EXPLICIT non-change.)
 *
 * Owns (real APEX truth): six immortal shard semantic records, K/A2 awakening
 * (12.0 s cooldown via the AbilityController, 2.4 s active), the radius-entry
 * threat acquisition (450 px read radius -> one free shard per eligible hostile
 * projectile; no hit prediction) with independent per-shard jobs, real
 * shard/projectile contact at the 300 px ring, the intercept/reflection
 * transaction (passive scales CURRENT damage once; crit/provenance kept; owner
 * -> Crystal; one reflection per projectile; T6 never), J/A1 context construct
 * routing (live HEXA path first: 6 ORBIT -> Prison; otherwise Wall fallback on
 * BLADE L/R shards [0,1] which works even with K off), real Wall
 * (W220/HP80/4.0 s from material lock; breaking shot passes through unreflected)
 * and Prison (R135/6 x HP75/3.0 s from closure) HP + lifetimes, physical
 * capsule geometry of the visibly grown material, and first-pass telemetry.
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
/* V2 minimal-delta retiming (02_CRYSTALA_V2_SIX_SHARD_RESOURCE_AUTHORITY §2):
 * BAND is the successful-interception contact ring (300 px = body radius 75 +
 * 1.5 fighter diameters); SCAN is the projectile read radius (450 px). The old
 * inward rescue sequence 180/150/120/90 is REMOVED from gameplay assignment. */
const BAND = 300;              // successful interception/contact ring from the Crystal centre
const SCAN = 450;              // projectile read radius (entry is enough to request a shard)
const MIN_LEAD = 0.12;         // preferred visual anticipation beat (s) — never an eligibility veto
const REFRACT = 0.16;          // Gold internal-light beat (unchanged)
const RECOIL = 0.16;           // free drift after the exit impulse (unchanged)
const RETURN_T = 1.28;         // REFRACT + RECOIL + RETURN_T = 1.60 s contact -> dock (V2 §2.3)
const ABORT_T = 0.5;           // Gold-style banking return for an aborted job
const TRAVEL_K = 1.12 / 1000;  // shard travel-time model (Hermite arc, s per px)
const TRAVEL_BASE = 0.02;
const CAP_R = 19.5;            // half thickness of the grown material capsule (mean cell height)
const SHARDS = 6;
const BLADE_L = 0, BLADE_R = 1; // V2 §1.1: WALL always uses the two largest Gold shards

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
    // ignoredMiss/Expired/Blocked/Unreachable are legacy prediction-drop
    // counters: V2 acquisition has no hit prediction, so they stay at zero and
    // remain only so old telemetry readers keep their shape.
    threatsSeen: 0, ignoredMiss: 0, ignoredBlocked: 0, ignoredExpired: 0, ignoredUnreachable: 0,
    overflowThreats: 0, overflowHits: 0, reservations: 0, intercepts: 0, aborts: 0,
    repeatIntercepts: 0, reflectedDamage: 0, preventedDamage: 0, shardBusySeconds: 0,
    constructDamage: 0, wallBreaks: 0, facetBreaks: 0, constructEnds: [], jPerK: [],
    constructReflects: 0, reflectedProjectiles: 0, urgentReservations: 0,
    // Decision telemetry: measures the actual trade between K-only, early J
    // Prison, and delayed-J Wall without changing any gameplay law.
    decisionWindows: [], constructDecisions: [],
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
  const until = now + (cfg.active != null ? cfg.active : 2.4);
  const windowId = st.tele.kCasts + 1;
  const jDecisionWindow = ct.skills.A1.cfg.decisionWindow != null ? ct.skills.A1.cfg.decisionWindow : 1.2;
  const decisionWindow = {
    id: windowId, startedAt: now, until, decisionDeadline: now + jDecisionWindow, endedAt: null, j: [],
    start: {
      reservations: st.tele.reservations, intercepts: st.tele.intercepts,
      preventedDamage: st.tele.preventedDamage, reflectedDamage: st.tele.reflectedDamage,
      constructReflects: st.tele.constructReflects,
    },
  };
  st.k = { active: true, startedAt: now, until, jCasts: 0, hits: new Array(SHARDS).fill(0), windowId, decisionWindow };
  st.tele.kCasts += 1;
  st.tele.decisionWindows.push(decisionWindow);
  st.rig.awaken(1.0, 0.85);
  emit('CrystalAwaken', { combatant: ct.heroId, at: now, until: st.k.until });
  return true;
}
function endAwakening(st, now) {
  if (!st.k.active) return;
  st.k.active = false;
  st.tele.jPerK.push(st.k.jCasts);
  const w = st.k.decisionWindow;
  if (w && w.endedAt == null) {
    w.endedAt = now;
    w.result = {
      reservations: st.tele.reservations - w.start.reservations,
      intercepts: st.tele.intercepts - w.start.intercepts,
      preventedDamage: st.tele.preventedDamage - w.start.preventedDamage,
      reflectedDamage: st.tele.reflectedDamage - w.start.reflectedDamage,
      constructReflectsDuringK: st.tele.constructReflects - w.start.constructReflects,
      jCasts: st.k.jCasts,
    };
  }
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

function stonePos(st, id) { const s = st.rig.stones[id]; return s; }
function physicalLeadFor(st, id, ip) {
  const s = stonePos(st, id);
  const travel = Math.hypot(s.x - ip.x, s.y - ip.y);
  return travel * TRAVEL_K + TRAVEL_BASE;
}

// V2 §2.1/§2.2 acquisition is deliberately simple: NO hit prediction, NO
// body-hit/damage-priority ranking, NO blocker-first prerequisite. An eligible
// hostile projectile entering the 450 px read radius is enough to request one
// free shard. The contact target is the real 300 px ring crossing of the
// Crystal-centred ring; a projectile already inside the ring is met where it
// is, and one that never crosses the ring is met at its closest approach to it.
// Never teleport, never consume the projectile at assignment.
function contactPlan(st, c) {
  const b = st.ct.anchor;
  const v = b.__hrVel || { x: 0, y: 0 };
  const wx = c.p.vx - v.x, wy = c.p.vy - v.y;
  let tBand = firstWithin(c.d0x, c.d0y, wx, wy, BAND);
  if (tBand == null) {
    // never reaches the ring: closest approach to the ring centre (~the ring)
    const a = wx * wx + wy * wy;
    tBand = a < 1e-9 ? 0 : Math.max(0, -(c.d0x * wx + c.d0y * wy) / a);
  } else if (tBand < 0) {
    tBand = 0;
  }
  const ip = { x: c.p.x + c.p.vx * tBand, y: c.p.y + c.p.vy * tBand };
  return { tBand, ip, band: BAND };
}

function predictorStep(st, now, dt) {
  const list = (g.projectiles || []);
  const b = st.ct.anchor;
  const cands = [];
  for (const p of list) {
    if (notAThreat(st, p)) continue;
    const hr = hrOf(p);
    if (hr.cryTid) continue;                                  // one shard job per projectile, ever
    if (hr.cryLost) continue;                                 // decided once: capacity overflow
    const d0x = p.x - b.x, d0y = p.y - b.y;
    const dist0 = Math.hypot(d0x, d0y);
    if (dist0 > SCAN) continue;                               // outside the 450 px read radius
    if (hr.cryPid == null) hr.cryPid = ++st.pidSeq;
    const first = !st.seen.has(p);
    if (first) { st.seen.add(p); st.tele.threatsSeen += 1; }
    cands.push({ p, hr, d0x, d0y, dist0 });
  }
  if (!cands.length) return;
  // V2 §2.1: hit prediction and damage priority are gone. Stable first-seen
  // order decides who gets the last free shard; each candidate gets at most
  // ONE distinct shard and one shard owns at most one job.
  cands.sort((a, c) => a.hr.cryPid - c.hr.cryPid);
  const free = availableIds(st);
  const taken = new Set();
  for (const c of cands) {
    const plan = contactPlan(st, c);
    let best = null;
    for (const id of free) {
      if (taken.has(id)) continue;
      const score = st.rig.scoreStone(st.rig.stones[id], c.p.vx, c.p.vy, plan.ip);
      if (!best || score > best.score) best = { id, score };
    }
    if (!best) {
      // Capacity is per-shard, never global. Spray/spread/near-miss waste is
      // the intended cost of the simple acquisition rule (V2 §2.1).
      c.hr.cryLost = 'busy';
      st.tele.overflowThreats += 1;
      c.hr.cryOverflow = true;
      continue;
    }
    taken.add(best.id);
    reserve(st, c, plan, best.id, now);
  }
}

function launchReservedJob(st, job, now) {
  const s = st.shards[job.shard], rig = st.rig;
  if (!job || job.phase !== STATE.RESERVED) return;
  const T = Math.max(1 / 120, job.tContact - now);
  rig.beginIntercept(job.shard, job.ip, T, job.pv, job.facet);
  s.state = STATE.OUTBOUND; job.phase = STATE.OUTBOUND; job.T = T; job.launchedAt = now;
}

function reserve(st, c, plan, id, now) {
  const p = c.p, hr = c.hr, s = st.shards[id];
  const pv = { x: p.vx, y: p.vy };
  const facet = st.rig.reserve(id, pv);
  const physicalLead = physicalLeadFor(st, id, plan.ip);
  const job = {
    id: ++st.jobSeq, shard: id, p, pid: hr.cryPid, ip: plan.ip, pv, facet, tContact: now + plan.tBand,
    band: BAND,
    // Truthful readability telemetry: the SAME Gold Hermite motion is simply
    // compressed into the real contact time when the ring is reached sooner
    // than the authored travel lead (V2 §2.2: "the shard may travel faster").
    urgent: plan.tBand < MIN_LEAD,
    accelerated: plan.tBand < physicalLead - 1e-9,
    reservedAt: now, phase: STATE.RESERVED, incoming: scaledDamageOf(p),
  };
  s.state = STATE.RESERVED; s.job = job; s.busyAt = now;
  hr.cryTid = job.id;
  st.jobs.push(job);
  st.tele.reservations += 1;
  if (job.urgent) st.tele.urgentReservations += 1;
  emit('CrystalReserve', { shard: id, tid: job.id, pid: hr.cryPid, tBand: plan.tBand, band: BAND,
    urgent: job.urgent, accelerated: job.accelerated, ip: plan.ip });
  // Launch immediately: the shard is timed to arrive at the real contact point
  // exactly when the projectile reaches it. Real swept contact is what
  // reflects — assignment NEVER consumes the projectile.
  launchReservedJob(st, job, now);
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
  // V2 §1.3 breaking-shot law — WALL ONLY (HEXA keeps live reflect-first
  // ordering unchanged). Structural damage >= remaining Wall HP: apply the
  // structural hit (which destroys the Wall), do NOT reflect, and let the SAME
  // projectile continue through the broken Wall with its full current
  // damage/owner/velocity/crit/provenance. No residual-damage arithmetic.
  const breaking = !t6 && cons.kind === 'wall' && dmg >= cons.hp;
  if (!t6 && !breaking) {
    const v = reflectVec(p.vx, p.vy, n.x, n.y);
    if (cons.decision) cons.decision.blockedProjectileDamage += dmg;
    applyPassive(st, p);
    if (cons.decision) {
      cons.decision.reflectCount += 1;
      cons.decision.reflectedDamageIssued += p.damage;
      hr.crySourceConsDecision = cons.decision.id;
    }
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
  damageConstruct(st, cons, cap, dmg, hx, hy, p.vx, p.vy, t6 ? 'T6' : breaking ? 'break-through' : 'hit');
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
  const hpRemain = cons.kind === 'wall' ? Math.max(0, cons.hp) : cons.facets.map((f) => Math.max(0, f.hp));
  st.tele.constructEnds.push({ kind: cons.kind, reason, at: cons.endedAt, hp: hpRemain });
  if (cons.decision) {
    cons.decision.endedAt = cons.endedAt;
    cons.decision.endReason = reason;
    cons.decision.lifeFromCast = Math.max(0, cons.endedAt - cons.castAt);
    cons.decision.solidLifeRealized = cons.lockedAt == null ? 0 : Math.max(0, cons.endedAt - cons.lockedAt);
    cons.decision.hpRemaining = hpRemain;
  }
  emit('CrystalConstructEnd', { cons: cons.id, kind: cons.kind, reason, decisionId: cons.decisionId || null });
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
function constructDecisionOpen(st) {
  if (!kActive(st)) return false;
  const cfg = st.ct.skills.A1.cfg;
  const maxCasts = cfg.maxCastsPerAwakening != null ? cfg.maxCastsPerAwakening : 1;
  const window = cfg.decisionWindow != null ? cfg.decisionWindow : 1.2;
  return st.k.jCasts < maxCasts && AIL.clock() <= st.k.startedAt + window + 1e-9;
}
// V2 §1.1 routing — the EXISTING live HEXA (six-facet) path, resolved exactly
// as live code resolves it today: K decision window open AND six ORBIT shards
// at the input edge AND a real placement anchor. Nothing here may change.
function hexaPathAvailable(st) {
  return constructDecisionOpen(st) && availableIds(st).length >= SHARDS && !!enemyAnchorOf(st.ct);
}
// V2 §1.1 wall fallback: WALL always uses BLADE L/R (shard ids 0/1). Both must
// be ORBIT; if either is busy/returning/anchored the attempt fails with no
// cooldown. WALL may be cast while K is off, or while K is on but the live
// HEXA path is not eligible.
function wallPathAvailable(st) {
  return st.shards[BLADE_L].state === STATE.ORBIT && st.shards[BLADE_R].state === STATE.ORBIT
    && !!enemyAnchorOf(st.ct);
}
function canCastConstruct(ctx) {
  const st = ensure(ctx.combatant);
  return hexaPathAvailable(st) || wallPathAvailable(st);
}
function aiCanAttemptConstruct(ctx) {
  return canCastConstruct(ctx);
}
function castConstruct(ctx) {
  const ct = ctx.combatant, st = ensure(ct), now = AIL.clock();
  const ea = enemyAnchorOf(ct), me = ct.anchor;
  if (!ea) return false;
  const ids = availableIds(st);                               // snapshot at the INPUT EDGE
  const cfg = ctx.cfg;
  const mult = cfg.constructHpMult != null ? cfg.constructHpMult : 1;
  const cons = { id: ++st.consSeq, st, ct, state: 'LIVE', castAt: now, lockedAt: null, endAt: null, endReason: null };
  if (constructDecisionOpen(st) && ids.length >= SHARDS) {
    // ---- HEXA path: live behavior, zero semantic change (V2 §3) ----
    const R = cfg.prison.radius;
    cons.kind = 'prison';
    cons.rc = st.rig.castPrison({ cx: ea.x, cy: ea.y, R, seed: 31 + st.consSeq });
    cons.facets = []; for (let i = 0; i < cfg.prison.facets; i++) { const hp = cfg.prison.facetHp * mult; cons.facets.push({ hp, max: hp, dead: false }); }
    cons.solidLife = cfg.prison.solidLifetime;
    cons.assign = cons.rc.assign.map(([s, , vi]) => ({ id: s.uid, vIdx: vi }));
    cons.shardIds = cons.assign.map((a) => a.id);
    st.tele.prisonCasts += 1;
  } else if (st.shards[BLADE_L].state === STATE.ORBIT && st.shards[BLADE_R].state === STATE.ORBIT) {
    // ---- Wall fallback (V2 §1.1): BLADE L/R only, shard ids exactly [0,1] ----
    const S = gameSize();
    let ux = ea.x - me.x, uy = ea.y - me.y;
    const d = Math.hypot(ux, uy);
    if (d < 1e-6) { ux = 1; uy = 0; } else { ux /= d; uy /= d; }
    const tx = -uy, ty = ux, half = cfg.wall.width / 2, off = Math.min(330, d * 0.48);
    const mx = clamp(me.x + ux * off, 130, S - 130), my = clamp(me.y + uy * off, 130, S - 130);
    const a0 = { x: mx - tx * half, y: my - ty * half }, a1 = { x: mx + tx * half, y: my + ty * half };
    const plan = st.rig.planWall([BLADE_L, BLADE_R], a0, a1);
    cons.kind = 'wall';
    cons.rc = st.rig.castWall({ a0, a1, pair: plan.pair, seed: 7 + st.consSeq });
    cons.hp = cons.maxHp = cfg.wall.hp * mult;
    cons.solidLife = cfg.wall.solidLifetime;
    cons.shardIds = plan.pair.map((p) => p[0]);               // always exactly [0,1]
    st.tele.wallCasts += 1;
  } else {
    return false;                                             // blades busy -> fail, no cooldown
  }
  for (const id of cons.shardIds) { const s = st.shards[id]; s.state = STATE.CONSTRUCT_TRAVEL; s.consId = cons.id; }
  const window = st.k.decisionWindow || null;
  const decision = {
    id: st.tele.constructDecisions.length + 1,
    kWindow: st.k.windowId || null,
    at: now,
    sinceKStart: Math.max(0, now - st.k.startedAt),
    kRemaining: Math.max(0, st.k.until - now),
    availableAtInput: ids.length,
    kind: cons.kind,
    shardsSpent: cons.shardIds.length,
    interceptsBeforeJ: window ? st.tele.intercepts - window.start.intercepts : 0,
    preventedBeforeJ: window ? st.tele.preventedDamage - window.start.preventedDamage : 0,
    blockedProjectileDamage: 0,
    reflectedDamageIssued: 0,
    reflectedDamageRealized: 0,
    reflectCount: 0,
    endedAt: null,
    endReason: null,
  };
  cons.decisionId = decision.id;
  cons.decision = decision;
  st.tele.constructDecisions.push(decision);
  if (window) window.j.push(decision.id);

  st.constructs.push(cons);
  st.k.jCasts += 1; st.tele.jCasts += 1;
  invalidate();
  emit('CrystalConstructCast', { cons: cons.id, kind: cons.kind, shards: cons.shardIds.slice(), at: now,
    decisionId: decision.id, kWindow: decision.kWindow, kRemaining: decision.kRemaining, availableAtInput: ids.length });
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
  if (st) {
    st.tele.reflectedDamage += realized;
    const did = hr.crySourceConsDecision;
    if (did) {
      const d = st.tele.constructDecisions.find((x) => x.id === did);
      if (d) d.reflectedDamageRealized += realized;
    }
  }
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
      k: {
        active: kActive(st), until: st.k.until, startedAt: st.k.startedAt, jCasts: st.k.jCasts,
        decisionDeadline: st.k.startedAt + (st.ct.skills.A1.cfg.decisionWindow != null ? st.ct.skills.A1.cfg.decisionWindow : 1.2),
        constructDecisionOpen: constructDecisionOpen(st),
      },
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
