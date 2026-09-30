/* =============================================================================
 * FROST V1 — gameplay truth (APEX_FROST).
 *
 * Authority: docs/hero-rework/frost-v1/00_FROST_IMPLEMENTATION_AUTHORITY.md
 * (Playtest V0: A1 CD 10.5 / 650x160 lane / 4.5s floor / thaw 0.30 / linger
 * 0.35; A2 CD 12.5 / 3.0s window / 120 trail / 3.5s segments / Cold Shock
 * x0.50 1.0s; Passive 8% / Freeze 0.90 / post-thaw lock 0.50; floor law
 * Frost x2.35 / enemy x0.60, strongest-wins, never multiplied.)
 *
 * Owns (real APEX truth): A1 breath commitment + near->far crystallization
 * front + lane geometry/lifecycle, A2 hunt window + actual-path trail, the
 * shared Frozen Floor speed law, battlefield firearm freeze/thaw/support,
 * Frozen Gun holder tags, Frozen Bullet provenance/group tags, Freeze
 * timers/refresh/post-thaw lock, and A2 exact holder steal.
 *
 * Does NOT own: firing/cadence/damage (Arsenal executors), locomotion
 * (engine), appearance (frost presentation + Gold bridge consume the bus
 * events and inspect() snapshots emitted here).
 *
 * Integration surface (all optional/lazy):
 *   executors frost.* (heroMechanicsRuntime) drive casts + per-tick truth
 *   FR.tickCombatant(ctx, dt)   full per-combatant truth advance (passive onTick)
 *   FR.tagFrozenBullet(ctx, p)  Frozen Bullet provenance (passive onProjectileFired)
 *   FR.noteBodyHit(p, target)   post-hit Freeze roll (rework pass Stage B)
 *   FR.deniesPickup(slot, f)    frozen-slot collector gate (spawn resolvePickups)
 *   FR.noteFrozenPickup(f, h, s) carry Frozen state onto the real holder
 *   FR.noteBodyContact(ct,a,b)  A2 Cold Shock + steal (rework contact hook)
 *   FR.releaseCombatant(ct)     teardown (executor onTeardown)
 * ========================================================================== */
(function (g) {
'use strict';
if (g.APEX_FROST) return;

const AIL = () => g.APEX_HERO_REWORK_AIL;
const HR = () => g.APEX_HERO_REWORK;
const clock = () => (AIL() && AIL().clock ? AIL().clock() : 0);
const busEmit = (type, payload) => { try { AIL().bus.emit(type, payload); } catch (e) { /* truth never breaks on telemetry */ } };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ------------------------------------------------------------------ *
 * Shared Frozen Floor law (authority §3). Single source of truth.
 * frontSeconds fills an authority gap (no front duration specified):
 * the near->far crystallization front crosses 650px in 0.45s; whatever
 * the value, the LAW is tested (no invisible full rect before the front;
 * one shared lane expiry after front completion).
 * ------------------------------------------------------------------ */
const FROST_LAW = Object.freeze({
  frostFloorMult: 2.35,   // Frost body on Frozen Floor
  enemyFloorMult: 0.60,   // enemy body on Frozen Floor (also A1 linger)
  frontSeconds: 0.45,     // A1 near->far crystallization front duration
  nodeSpacing: 10,        // A2 trail node spacing (px of real travel)
  speedRefresh: 0.12,     // status refresh cadence (RUBBER precedent)
  // A2 steal: ownership moves IMMEDIATELY (authority §7.5 — the holder is
  // Frost's the instant contact resolves), but the stolen weapon is in
  // transfer flight until it docks in Frost's hand. Gold's transfer arc is
  // 0.44s; that same number is the operational dock eligibility point, so
  // the remaining firing sequence cannot resume mid-flight. Single shared
  // constant: gameplay gates the driver with it, presentation flies with it.
  stealDockSeconds: 0.44,
});

function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cy = ay + dy * t;
  return Math.hypot(px - cx, py - cy);
}

const states = new WeakMap();
function stateOf(ct) {
  let st = states.get(ct);
  if (!st) {
    st = {
      a1pending: null,          // { dx, dy, releaseAt }
      a1lanes: [],              // [{ ox, oy, dx, dy, len, halfW, frontStartAt, frontDoneAt, expireAt }]
      a2: null,                 // { until, trail: [{x,y,bornAt}], segLife, halfW, endEmitted }
      cold: Object.create(null),   // bodyId -> Cold Shock expiry (clock)
      linger: Object.create(null), // bodyId -> A1 linger expiry (clock)
      freeze: Object.create(null), // bodyId -> { until } tracked Freeze (thaw poll; lock is body-global)
      rolledBlasts: Object.create(null), // blast group -> true (one roll opportunity each)
      rollsUsed: 0,                // Freeze RNG draws consumed (F07 audit)
      freezeRng: null,             // dedicated per-combatant seeded stream (lazy)
      castSeq: 0,
    };
    states.set(ct, st);
  }
  return st;
}

function frontLen(lane, now) {
  if (now <= lane.frontStartAt) return 0;
  if (now >= lane.frontDoneAt) return lane.len;
  return lane.len * ((now - lane.frontStartAt) / Math.max(1e-6, lane.frontDoneAt - lane.frontStartAt));
}

function laneSupports(lane, x, y, now) {
  if (now >= lane.expireAt) return false;
  const fl = frontLen(lane, now);
  if (fl <= 0) return false;
  const rx = x - lane.ox, ry = y - lane.oy;
  const s = rx * lane.dx + ry * lane.dy;
  if (s < 0 || s > fl) return false;
  const perp = Math.abs(rx * lane.dy - ry * lane.dx);
  return perp <= lane.halfW;
}

function trailSupports(trail, halfW, x, y, now, segLife) {
  const live = [];
  for (const n of trail) if (now - n.bornAt < segLife) live.push(n);
  if (!live.length) return false;
  if (live.length === 1) return Math.hypot(x - live[0].x, y - live[0].y) <= halfW;
  for (let i = 1; i < live.length; i++) {
    if (pointSegDist(x, y, live[i - 1].x, live[i - 1].y, live[i].x, live[i].y) <= halfW) return true;
  }
  return false;
}

function onA1Floor(st, x, y, now) {
  for (const lane of st.a1lanes) if (laneSupports(lane, x, y, now)) return true;
  return false;
}

function onAnyFloor(st, x, y, now) {
  if (onA1Floor(st, x, y, now)) return true;
  if (st.a2 && trailSupports(st.a2.trail, st.a2.halfW, x, y, now, st.a2.segLife)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
const holderUids = new WeakMap();
let holderSeq = 0;
function holderUid(h) {
  let u = holderUids.get(h);
  if (!u) { u = ++holderSeq; holderUids.set(h, u); }
  return u;
}

/* ------------------------------------------------------------------ *
 * A2 steal transfer window (authority §7.5).
 *
 * Ownership is immediate (the pointer move in noteBodyContact), but the
 * stolen holder is physically in flight for FROST_LAW.stealDockSeconds and
 * must NOT resume its remaining firing sequence before it docks: no elapsed
 * advance, no canActivate/activate, no def.update -> no shot, no cadence
 * drift. The EXACT holder object and every field on it (shotsFired, phase,
 * meta/pose, elapsed) is preserved untouched — this is a driver gate, never
 * a re-equip or reset.
 *
 * Implementation: one idempotent pass-through wrapper on weaponApi's own
 * updateHolder (both call sites — arsenalQuestRuntime and heroReworkRuntime
 * — go through this property). During the window the holder is detached for
 * the duration of the base call only, so the base driver sees UNARMED and
 * still advances that fighter's pose ghosts; everything else in the game is
 * untouched.
 * ------------------------------------------------------------------ */
function holderInTransfer(h, now) {
  const fz = h && h.__frostFrozen;
  if (!fz || !fz.stolen || !(fz.dockAt > 0)) return false;
  return (now == null ? clock() : now) < fz.dockAt;
}

function ensureTransferDockGate() {
  if (ensureTransferDockGate.done) return;
  const WAPI = g.APEX_ARSENAL && g.APEX_ARSENAL.weaponApi;
  if (!WAPI || typeof WAPI.updateHolder !== 'function') return;
  ensureTransferDockGate.done = true;
  if (WAPI.__frostTransferDockGate) return;
  WAPI.__frostTransferDockGate = true;
  const base = WAPI.updateHolder;
  WAPI.updateHolder = function (f, dt) {
    let held = null;
    try {
      const h = f && f.data ? f.data.arsenal : null;
      if (holderInTransfer(h)) held = h;
    } catch (e) { held = null; }
    if (!held) return base.call(this, f, dt);
    f.data.arsenal = null;            // in flight: invisible to the driver
    try { return base.call(this, f, dt); }
    finally { f.data.arsenal = held; } // exact same object back, untouched
  };
}

function isFreezableFirearm(slot) {
  if (!slot || slot.kind === 'HEAL') return false;
  const id = slot.weaponId;
  if (!id || id === 'GRENADE' || id === 'STORMBREAKER' || id === 'T6') return false;
  if (slot.tier === 'T6') return false;
  const W = g.APEX_ARSENAL_WEAPONS;
  const def = W && W[id];
  return !!def && def.category === 'ranged';
}

/* ------------------------------------------------------------------ *
 * Freeze RNG (authority §6.1/§6.2). Dedicated per-combatant seeded
 * stream (AIL.makeSeededRng, never Math.random). Draws happen ONLY in
 * noteBodyHit after a confirmed eligible body hit with all no-roll
 * gates passed. Production seeds from the match clock at first draw
 * (mixed with the combatant index); setFreezeSeed pins a fixed base
 * for deterministic gates — pin before match start.
 * ------------------------------------------------------------------ */
let freezeSeedPin = null;
function freezeRngFor(ct, st) {
  if (!st.freezeRng) {
    let seed = freezeSeedPin;
    if (seed == null) seed = (((clock() * 1000) | 0) ^ (((ct && ct.idx) | 0) * 0x9E3779B9) ^ 0xF2057) >>> 0;
    const A = AIL();
    st.freezeRng = (A && A.makeSeededRng) ? A.makeSeededRng(seed >>> 0) : null;
    if (!st.freezeRng) { // unreachable while AIL loads; total fallback
      let s = (seed >>> 0) || 0x9e3779b9;
      st.freezeRng = function () {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  }
  return st.freezeRng;
}

const FR = {
  version: 'frost-v1',
  LAW: FROST_LAW,

  /* ---------------- A1 ---------------- */
  castBreath(ctx) {
    const ct = ctx.combatant;
    const a = ct.anchor;
    const st = stateOf(ct);
    const dx = (a && a.dir && a.dir.x) || 1, dy = (a && a.dir && a.dir.y) || 0;
    const now = clock();
    st.a1pending = { dx, dy, releaseAt: now + ctx.cfg.castCommit, castAt: now, id: ++st.castSeq };
    busEmit('FrostBreathCast', { hero: ct.heroId, dir: [dx, dy], releaseAt: st.a1pending.releaseAt });
    return true;
  },

  /* ---------------- A2 ---------------- */
  castHunt(ctx) {
    const ct = ctx.combatant;
    const a = ct.anchor;
    const st = stateOf(ct);
    const now = clock();
    st.a2 = {
      until: now + ctx.cfg.activeWindow,
      trail: [{ x: a.x, y: a.y, bornAt: now }],
      segLife: ctx.cfg.segmentLifetime,
      halfW: ctx.cfg.trailWidth / 2,
      endEmitted: false,
    };
    // Trail starts under Frost only if Frost is really there (it is).
    busEmit('FrostHuntStart', { hero: ct.heroId, until: st.a2.until });
    return true;
  },

  /* ---------------- per-tick truth ---------------- */
  tickCombatant(ctx, dt) {
    const ct = ctx.combatant;
    const api = ctx.api;
    if (!ct || !api) return;
    ensureTransferDockGate(); // idempotent; no-op once installed
    const st = stateOf(ct);
    const now = clock();
    const a1cfg = ct.skills.A1 && ct.skills.A1.cfg;
    const a2cfg = ct.skills.A2 && ct.skills.A2.cfg;

    // A1 release: live position at release, snapshotted direction.
    if (st.a1pending && now >= st.a1pending.releaseAt && a1cfg) {
      const p = st.a1pending;
      st.a1pending = null;
      const a = ct.anchor;
      const frontStartAt = now;
      const frontDoneAt = now + FROST_LAW.frontSeconds;
      st.a1lanes.push({
        ox: a.x, oy: a.y, dx: p.dx, dy: p.dy,
        len: a1cfg.length, halfW: a1cfg.width / 2,
        frontStartAt, frontDoneAt,
        expireAt: frontDoneAt + a1cfg.floorLifetime,
        castId: p.id,
      });
      busEmit('FrostFloorBuilt', { hero: ct.heroId, x: a.x, y: a.y, dir: [p.dx, p.dy] });
    }
    // Prune expired lanes (single shared expiry each; no early near-end loss).
    for (let i = st.a1lanes.length - 1; i >= 0; i--) {
      if (now >= st.a1lanes[i].expireAt) st.a1lanes.splice(i, 1);
    }

    // A2 trail from REAL movement history (turns/bounces included).
    if (st.a2) {
      const w = st.a2;
      const a = ct.anchor;
      if (a && a.hp > 0 && now < w.until) {
        const last = w.trail[w.trail.length - 1];
        if (!last || Math.hypot(a.x - last.x, a.y - last.y) >= FROST_LAW.nodeSpacing) {
          w.trail.push({ x: a.x, y: a.y, bornAt: now });
        }
      }
      for (let i = w.trail.length - 1; i >= 0; i--) {
        if (now - w.trail[i].bornAt >= w.segLife) w.trail.splice(i, 1);
      }
      if (!w.endEmitted && now >= w.until) {
        w.endEmitted = true;
        busEmit('FrostHuntEnd', { hero: ct.heroId });
      }
      if (w.endEmitted && !w.trail.length) st.a2 = null;
    }

    // Speed law (strongest Frost effect wins, never multiplied). Unrelated
    // non-Frost slows/speeds are never weakened (F10.6): a strictly
    // stronger existing status is left untouched (timer included).
    const rf = FROST_LAW.speedRefresh;
    for (const b of api.ownBodies(ct)) {
      if (!b || b.hp <= 0) continue;
      if (!onAnyFloor(st, b.x, b.y, now)) continue;
      const ex = b.statuses.speed;
      if (!ex || ex.timer <= 0 || ex.mult <= FROST_LAW.frostFloorMult) {
        b.applyStatus('speed', rf, { mult: FROST_LAW.frostFloorMult });
      }
    }
    const foes = api.enemyBodies(ct);
    for (const b of foes) {
      if (!b || b.hp <= 0) continue;
      const cands = [];
      const onA1 = onA1Floor(st, b.x, b.y, now);
      if (onA1) {
        cands.push(FROST_LAW.enemyFloorMult);
        if (a1cfg) st.linger[b.id] = now + a1cfg.lingerSeconds;
      } else if (st.a2 && trailSupports(st.a2.trail, st.a2.halfW, b.x, b.y, now, st.a2.segLife)) {
        cands.push(FROST_LAW.enemyFloorMult);
      }
      if ((st.cold[b.id] || 0) > now && a2cfg) cands.push(a2cfg.coldShockMult);
      if ((st.linger[b.id] || 0) > now) cands.push(FROST_LAW.enemyFloorMult);
      if (cands.length) {
        const want = Math.min(...cands);
        const ex = b.statuses.slow;
        if (!ex || ex.timer <= 0 || ex.mult >= want) b.applyStatus('slow', rf, { mult: want });
      }
    }

    // Post-thaw reproc lock (authority §6.3): a tracked body observed truly
    // thawed starts its body-global 0.50s lock. Continuous freeze (incl.
    // refresh) never locks; the lock is keyed on the body so mirrors agree.
    // Own bodies are polled too: a reflected Frozen Bullet may freeze Frost.
    const watched = st.freeze;
    if (Object.keys(watched).length) {
      const seenIds = {};
      const seen = api.ownBodies(ct).concat(api.enemyBodies(ct) || []);
      const lockSecs = (ct.skills.PASSIVE && ct.skills.PASSIVE.cfg && ct.skills.PASSIVE.cfg.postThawLock) || 0.50;
      for (const b of seen) {
        if (!b) continue;
        seenIds[b.id] = true;
        if (!watched[b.id]) continue;
        if (b.hp <= 0) { delete watched[b.id]; continue; }
        if (b.hasStatus('freeze')) {
          watched[b.id].until = now + (b.statuses.freeze.timer || 0);
          continue;
        }
        if ((b.__frostLockedUntil || 0) <= now) {
          b.__frostLockedUntil = now + lockSecs;
          busEmit('FrostThaw', { body: b.id });
        }
        delete watched[b.id];
      }
      for (const id of Object.keys(watched)) if (!seenIds[id]) delete watched[id]; // merged/vanished: untrack, no lock
    }

    // Battlefield firearm freeze/thaw/support.
    this.tickSlots(ct, st, now, a1cfg);
  },

  tickSlots(ct, st, now, a1cfg) {
    const AQ = g.APEX_ARSENAL;
    const slots = (AQ && AQ.state && AQ.state.slots) || [];
    for (const slot of slots) {
      if (!slot || slot.phase !== 'REVEALED') {
        if (slot && (slot.__frostFrozen || slot.__frostThawUntil)) {
          delete slot.__frostFrozen; delete slot.__frostThawUntil;
        }
        continue;
      }
      if (!isFreezableFirearm(slot)) continue;
      const supported = onA1Floor(st, slot.x, slot.y, now);
      if (supported) {
        if (slot.__frostThawUntil) delete slot.__frostThawUntil; // support returns: cancel thaw
        if (!slot.__frostFrozen) {
          slot.__frostFrozen = true;
          busEmit('FrostSlotFrozen', { slotId: slot.id, weapon: slot.weaponId });
        }
      } else if (slot.__frostFrozen) {
        const thaw = (a1cfg && a1cfg.thawSeconds) || 0.30;
        if (!slot.__frostThawUntil) {
          slot.__frostThawUntil = now + thaw;
          busEmit('FrostSlotThawing', { slotId: slot.id });
        } else if (now >= slot.__frostThawUntil) {
          delete slot.__frostFrozen; delete slot.__frostThawUntil;
          busEmit('FrostSlotThawed', { slotId: slot.id });
        }
      }
    }
  },

  deniesPickup(slot, f) {
    if (!slot || !slot.__frostFrozen) return false;
    const hr = HR();
    if (!hr || !hr.byCombatant) return false;
    const ct = hr.byCombatant(f);
    return !(ct && !ct.facade && ct.heroId === 'ICE');
  },

  noteFrozenPickup(f, hold, slot) {
    if (!hold) return;
    hold.__frostFrozen = { weaponId: hold.weaponId || (slot && slot.weaponId) || null, at: clock() };
    busEmit('FrostGunFrozen', {
      fighter: f && f.name, weapon: hold.__frostFrozen.weaponId,
      holder: holderUid(hold),
    });
  },

  /* -------- Frozen Bullet provenance (fire time; zero RNG) -------- */
  tagFrozenBullet(ctx, p, owner) {
    const hold = owner && owner.data && owner.data.arsenal;
    if (!hold || !hold.__frostFrozen || !p || !p.__hr) return false;
    // Semantic blast group: holder identity + sequence position at fire time.
    // All pellets of one fireOneShot share both; sequential shots differ in
    // shotsFired (incremented after each shot); re-equips differ in holder.
    // The shooter ref travels with the tag so provenance survives legal
    // transforms that reassign p.owner (authority §6.3); bullet-lifetime only.
    p.__hr.frost = { group: holderUid(hold) + ':' + (hold.shotsFired | 0), holder: holderUid(hold), shooter: owner || null };
    return true;
  },

  /* -------- post-hit Freeze roll (authority §6.2/§6.3) -------- */
  setFreezeSeed(n) { freezeSeedPin = (n == null ? null : (n >>> 0)); },
  noteBodyHit(p, target) {
    const tag = p && p.__hr && p.__hr.frost;
    if (!tag || !tag.group) return false;
    if (!target || target.hp <= 0) return false;
    const hr = HR();
    // Provenance shooter first (survives legal owner transforms), live
    // p.owner second. Either way the shooter must be a Frost combatant.
    const ownerRef = tag.shooter || (p && p.owner);
    const shooter = ownerRef && hr && hr.byCombatant ? hr.byCombatant(ownerRef) : null;
    if (!shooter || shooter.facade || shooter.heroId !== 'ICE') return false;
    const now = clock();
    // Post-thaw reproc lock is body-global: a locked hit never rolls and
    // never consumes the blast opportunity (the draw happens only after all
    // no-roll gates pass).
    if ((target.__frostLockedUntil || 0) > now) return false;
    const st = stateOf(shooter);
    if (st.rolledBlasts[tag.group]) return false; // blast already consumed
    st.rolledBlasts[tag.group] = true;             // first eligible hit consumes
    st.rollsUsed++;
    const pcfg = shooter.skills && shooter.skills.PASSIVE && shooter.skills.PASSIVE.cfg;
    const chance = ((pcfg && pcfg.baseProcPct) || 0.04) + ((pcfg && pcfg.bonusProcPct) || 0.04);
    const roll = freezeRngFor(shooter, st)();
    if (!(roll < chance)) {
      busEmit('FrostRollFailed', { group: tag.group, roll: +roll.toFixed(4) });
      return false;
    }
    // Successful proc: hard Freeze through the existing authoritative
    // status path (applyStatus refreshes: newest owner resets to 0.90s,
    // never stacks). Zero direct Freeze damage — bullet damage is untouched.
    const freezeSecs = (pcfg && pcfg.freezeDuration) || 0.90;
    const wasFrozen = target.hasStatus('freeze');
    target.__frostFreezeSource = 'frost';
    target.applyStatus('freeze', freezeSecs, { source: shooter.anchor });
    st.freeze[target.id] = { until: now + freezeSecs };
    busEmit(wasFrozen ? 'FrostFreezeRefresh' : 'FrostFreezeStart', {
      body: target.id, group: tag.group, roll: +roll.toFixed(4),
    });
    return true;
  },

  /* -------- A2 contact: Cold Shock + exact steal (authority §7.4/§7.5) --- */
  // Called ONLY on engine edge-fired new contact (separation-cleared by the
  // real contact authority). No Frost-side pair latch exists by design, so a
  // genuine re-contact during the same window always re-procs (§7.3/F10.7).
  noteBodyContact(frostCt, myBody, otherBody) {
    if (!frostCt || frostCt.facade || frostCt.heroId !== 'ICE') return false;
    const st = states.get(frostCt);
    const now = clock();
    if (!st || !st.a2 || now >= st.a2.until) return false; // A2 window only
    if (!otherBody || otherBody.hp <= 0) return false;
    const hr = HR();
    const otherCt = hr && hr.byCombatant ? hr.byCombatant(otherBody) : null;
    if (!otherCt || otherCt === frostCt) return false; // enemy bodies only
    const a2cfg = frostCt.skills.A2 && frostCt.skills.A2.cfg;
    // Cold Shock: always, on every valid new contact. Zero direct damage;
    // the x0.50 joins the shared min-law in tickCombatant (floor overlap
    // resolves to x0.50, never x0.30).
    st.cold[otherBody.id] = now + ((a2cfg && a2cfg.coldShockDuration) || 1.0);
    busEmit('FrostColdShock', { body: otherBody.id, mult: (a2cfg && a2cfg.coldShockMult) || 0.50 });
    // Exact holder steal. Carrier authority = the live APEX one-holder law:
    // the opponent's ANCHOR is the authoritative equipment carrier (the only
    // body the weapon runtime drives); the colliding body is never assumed
    // to own anything. Pointer move only: no equip(), no consume(), no
    // floor copy, no ghost, no second holder.
    const anchor = frostCt.anchor;
    const WAPI = g.APEX_ARSENAL && g.APEX_ARSENAL.weaponApi;
    if (!anchor || !WAPI || WAPI.getHolder(anchor)) return true; // armed: shock only
    const carrier = otherCt.anchor;
    if (!carrier || carrier.hp <= 0) return true;
    const h = WAPI.getHolder(carrier);
    if (!h || !h.weaponId) return true;
    if (!isFreezableFirearm({ weaponId: h.weaponId, tier: h.meta && h.meta.tier })) return true;
    ensureTransferDockGate();
    carrier.data.arsenal = null;
    anchor.data.arsenal = h;
    // Ownership is immediate; the firing sequence resumes only at dockAt.
    const dockAt = now + FROST_LAW.stealDockSeconds;
    h.__frostFrozen = { weaponId: h.weaponId, at: now, stolen: true, dockAt, from: carrier.id };
    busEmit('FrostSteal', { weapon: h.weaponId, shotsFired: h.shotsFired, from: carrier.id, dockAt });
    return true;
  },

  releaseCombatant(ct) { states.delete(ct); },

  /* -------- deterministic test/inspection surface -------- */
  inspect(ct) {
    const st = states.get(ct);
    if (!st) return null;
    const now = clock();
    return {
      pending: !!st.a1pending,
      // Exact cast-acceptance direction snapshot (never re-read live dir):
      // presentation must aim breath down the SAME lane gameplay committed
      // to, even if a wall/body bounce turns Frost during commitment.
      a1cast: st.a1pending
        ? { dx: st.a1pending.dx, dy: st.a1pending.dy, id: st.a1pending.id,
            castAt: st.a1pending.castAt, releaseAt: st.a1pending.releaseAt }
        : null,
      // Lane truth is the replay source for a presentation cast that Gold
      // could not accept yet: origin, committed direction, the real front
      // window and the one shared expiry (never re-derived from Frost's
      // later position or from admission time).
      lanes: st.a1lanes.map((l) => ({
        ox: +l.ox.toFixed(1), oy: +l.oy.toFixed(1),
        dx: l.dx, dy: l.dy, castId: l.castId,
        front: +frontLen(l, now).toFixed(1), len: l.len,
        frontStartAt: l.frontStartAt, frontDoneAt: l.frontDoneAt, expireAt: l.expireAt,
        active: now < l.expireAt,
      })),
      a2live: !!(st.a2 && now < st.a2.until),
      trail: st.a2 ? st.a2.trail.length : 0,
      // Node copies for the Slice D presentation bridge + F09 gates.
      trailNodes: st.a2 ? st.a2.trail.map((n) => ({ x: +n.x.toFixed(1), y: +n.y.toFixed(1), bornAt: +n.bornAt.toFixed(3) })) : [],
      cold: Object.keys(st.cold).filter((k) => st.cold[k] > now).length,
      linger: Object.keys(st.linger).filter((k) => st.linger[k] > now).length,
      rolls: st.rollsUsed,
      rolled: Object.keys(st.rolledBlasts).length,
      frozen: Object.keys(st.freeze).length,
    };
  },
  isFreezableFirearm,
  holderInTransfer,   // stolen holder still in Gold transfer flight (pre-dock)
};

g.APEX_FROST = FR;
g.apexFrostGameplayRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
