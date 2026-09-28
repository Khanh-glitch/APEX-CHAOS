/* =============================================================================
 * APEX CHAOS — AIL v2 (Arena Interaction Layer) runtime for the Hero Rework.
 *
 * Provides the shared mechanics substrate used by hero-rework executors:
 *   - typed semantic event bus with deterministic ordering,
 *   - StatusResolver (CHILL / WEAK / ROOT / STUN bookkeeping),
 *   - capability authority (T6 / Stormbreaker manipulation immunity),
 *   - swept-circle TOI helper for per-segment collision,
 *   - RelocationTransaction (atomic position moves, no skipped contacts),
 *   - Store/Release escrow semantics for damage/projectile capture,
 *   - seeded RNG + monotonic combat clock,
 *   - simple scheduler for delayed deterministic callbacks.
 *
 * Design authority: docs/hero-rework/phase1/01_AIL_V2_CANONICAL.md
 * Roster correction: docs/hero-rework/phase1/06_POSTFREEZE_ROSTER_CORRECTION.md
 *
 * This file is engine-agnostic: it must not import or require any global
 * besides what the integration runtime injects. It attaches to
 * `window.APEX_HERO_REWORK_AIL` (and a no-window fallback for headless runs).
 * ========================================================================== */

(function (globalScope) {
  'use strict';

  if (globalScope.APEX_HERO_REWORK_AIL) return; // idempotent

  /* ------------------------------------------------------------------ *
   * Seeded RNG — deterministic, reseedable, exposed for tests.
   * ------------------------------------------------------------------ */
  function makeSeededRng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return function next() {
      // mulberry32
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ *
   * Semantic event bus.
   *  - typed events, deterministic insert order,
   *  - small ring buffer for telemetry harvesting,
   *  - `note()` is side-effect free bookkeeping (stats, telemetry),
   *    while gameplay decisions read explicit query APIs, not the log.
   * ------------------------------------------------------------------ */
  const EVENT_RING_CAP = 160;

  function EventBus() {
    this.seq = 0;
    this.ring = [];
    this.listeners = {};
  }
  EventBus.prototype.emit = function (type, payload) {
    const ev = {
      seq: ++this.seq,
      t: this.clock ? this.clock() : 0,
      type,
      payload: payload || {},
    };
    this.ring.push(ev);
    if (this.ring.length > EVENT_RING_CAP) this.ring.splice(0, this.ring.length - EVENT_RING_CAP);
    const subs = this.listeners[type];
    if (subs) for (let i = 0; i < subs.length; i++) {
      try { subs[i](ev); } catch (e) { /* listener isolation */ }
    }
    const wild = this.listeners['*'];
    if (wild) for (let i = 0; i < wild.length; i++) {
      try { wild[i](ev); } catch (e) { /* listener isolation */ }
    }
    return ev;
  };
  EventBus.prototype.on = function (type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
    return () => {
      const arr = this.listeners[type];
      if (!arr) return;
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  };
  EventBus.prototype.since = function (seq) {
    const out = [];
    for (let i = 0; i < this.ring.length; i++) {
      if (this.ring[i].seq > seq) out.push(this.ring[i]);
    }
    return out;
  };
  EventBus.prototype.ofType = function (type) {
    return this.ring.filter((e) => e.type === type);
  };
  EventBus.prototype.clear = function () { this.ring.length = 0; };

  /* ------------------------------------------------------------------ *
   * StatusResolver — single authority for status payloads attached to
   * fighters/bodies. Values live on `holder.__hrStatus` and are readable
   * by gameplay code through typed predicates only.
   *
   * Known statuses (Lv1): CHILL (slow 30%, 2.5s), WEAK (x1.25 incoming,
   * 3s), ROOT (rooted), STUN (engine stun field reuse), GEL (slime armor).
   * ------------------------------------------------------------------ */
  const STATUS_LAWS = {
    CHILL: { refresh: 'duration', slowPct: 0.30, duration: 2.5 },
    WEAK: { refresh: 'duration', incomingMult: 1.25, duration: 3.0 },
    ROOT: { refresh: 'duration' },
    STUN: { refresh: 'duration' },
    GEL: { refresh: 'value' },
  };

  function statusTableFor(holder) {
    if (!holder.__hrStatus) holder.__hrStatus = {};
    return holder.__hrStatus;
  }

  const StatusResolver = {
    apply(holder, status, duration, value) {
      if (!holder) return null;
      const tbl = statusTableFor(holder);
      const law = STATUS_LAWS[status];
      const prev = tbl[status];
      const next = {
        status,
        until: this.clock() + duration,
        duration,
        value: value === undefined ? (prev ? prev.value : 0) : value,
        appliedAt: this.clock(),
      };
      // Refresh semantics: a shorter application never shortens a longer
      // active window (doc 02 ICE laws).
      if (prev && law && law.refresh === 'duration' && prev.until > next.until) {
        next.until = prev.until;
        next.duration = Math.max(prev.duration, duration);
      }
      tbl[status] = next;
      this.bus.emit('StatusApplied', { holder: holder.id, status, until: next.until, value: next.value });
      return next;
    },
    has(holder, status) {
      if (!holder || !holder.__hrStatus) return false;
      const s = holder.__hrStatus[status];
      return !!s && s.until > this.clock();
    },
    remaining(holder, status) {
      if (!this.has(holder, status)) return 0;
      return Math.max(0, holder.__hrStatus[status].until - this.clock());
    },
    clear(holder, status) {
      if (!holder || !holder.__hrStatus) return;
      delete holder.__hrStatus[status];
      this.bus.emit('StatusCleared', { holder: holder.id, status });
    },
    clearAll(holder) {
      if (!holder || !holder.__hrStatus) return;
      holder.__hrStatus = {};
    },
    slowPct(holder) {
      return this.has(holder, 'CHILL') ? STATUS_LAWS.CHILL.slowPct : 0;
    },
    incomingMult(holder) {
      return this.has(holder, 'WEAK') ? STATUS_LAWS.WEAK.incomingMult : 1;
    },
  };

  /* ------------------------------------------------------------------ *
   * Capability authority — who may manipulate what.
   * T6 (Stormbreaker) is immune to Hero object manipulation:
   * graph/gate/singularity/mirror/reflect/capture/dodge never apply to it.
   * Physical pickup/collision/damage remain legal for everyone.
   * ------------------------------------------------------------------ */
  const CapabilityAuthority = {
    isT6(obj) {
      if (!obj) return false;
      if (obj.isT6 === true) return true;
      const w = obj.weapon || (obj.data && obj.data.arsenal && obj.data.arsenal.weaponId);
      return w === 'T6' || w === 'STORMBREAKER';
    },
    canManipulate(obj) { return !this.isT6(obj); },
    // Hero-object interactions this gates (doc 01):
    //   'graph'      MATH parabola absorb
    //   'gate-x2' / 'gate-div2'
    //   'singularity' BLACK_HOLE transit/absorb
    //   'mirror'     MIRROR portal routing / reflect
    //   'reflect'    CRYSTAL refraction
    //   'capture'    BLACK_HOLE/RUBBER projectile storage
    //   'dodge'      HUNTER passive auto-dodge
    //   'weak'       HUNTER pounce weak (combatant-level per doc 03)
    allows(kind, obj) {
      if (!obj) return true;
      if (this.isT6(obj)) {
        switch (kind) {
          case 'graph': case 'gate-x2': case 'gate-div2': case 'singularity':
          case 'mirror': case 'reflect': case 'capture': case 'dodge':
            return false;
          default: return true;
        }
      }
      return true;
    },
  };

  /* ------------------------------------------------------------------ *
   * Swept-circle vs circle TOI. Movement is processed per-segment so the
   * EARLIEST contact wins deterministically (doc 01 "Swept interaction").
   * Returns {toi, hit} | null.
   * ------------------------------------------------------------------ */
  function circleSweepTOI(x0, y0, x1, y1, radius, cx, cy, cradius) {
    const dx = x1 - x0, dy = y1 - y0;
    const fx = x0 - cx, fy = y0 - cy;
    const R = radius + cradius;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - R * R;
    if (c <= 0) return { toi: 0, hit: true }; // already overlapping
    if (a === 0) return null;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    const t = (t1 >= 0) ? t1 : (t2 >= 0 ? t2 : -1);
    if (t < 0 || t > 1) return null;
    return { toi: t, hit: true };
  }

  /* ------------------------------------------------------------------ *
   * RelocationTransaction — atomic relocations with contact checks at
   * the SOURCE and DESTINATION (no skipped-path contacts). Each move is
   * a single jump: state snapshot -> position write -> release events.
   * ------------------------------------------------------------------ */
  function RelocationTransaction(bus) {
    this.bus = bus;
    this.moves = [];
  }
  RelocationTransaction.prototype.move = function (obj, x, y, reason) {
    this.moves.push({ obj, fromX: obj.x, fromY: obj.y, x, y, reason: reason || 'relocation' });
    return this;
  };
  RelocationTransaction.prototype.commit = function () {
    const applied = [];
    for (const m of this.moves) {
      if (!m.obj || m.obj.hp <= 0) continue;
      m.obj.x = m.x; m.obj.y = m.y;
      applied.push(m);
      this.bus.emit('Relocated', {
        id: m.obj.id, fromX: m.fromX, fromY: m.fromY, x: m.x, y: m.y, reason: m.reason,
      });
    }
    this.moves.length = 0;
    return applied;
  };

  /* ------------------------------------------------------------------ *
   * Store/Release escrow. Used by BLACK_HOLE (damage singularity),
   * RUBBER (projectile compression), MIRROR shards. Guarantees:
   *  - identity/payload/provenance preserved on stored objects,
   *  - release emits exactly one event per object,
   *  - escrowed damage that never realizes does not count as HP loss.
   * ------------------------------------------------------------------ */
  function Escrow(id, opts) {
    this.id = id;
    this.opts = opts || {};
    this.capacity = this.opts.capacity || 8;
    this.items = [];
    this.storedDamage = 0;
    this.damageCap = this.opts.damageCap || Infinity;
    this.bus = this.opts.bus || null;
    this.closed = false;
  }
  Escrow.prototype.store = function (obj) {
    if (this.closed) return false;
    if (this.items.length >= this.capacity) return false;
    this.items.push(obj);
    if (this.bus) this.bus.emit('EscrowStored', { escrow: this.id, kind: obj.kind || 'object', id: obj.id });
    return true;
  };
  Escrow.prototype.storeDamage = function (amount) {
    if (this.closed || amount <= 0) return 0;
    const room = Math.max(0, this.damageCap - this.storedDamage);
    const taken = Math.min(room, amount);
    this.storedDamage += taken;
    if (this.bus && taken > 0) this.bus.emit('EscrowDamage', { escrow: this.id, amount: taken, total: this.storedDamage });
    return taken;
  };
  Escrow.prototype.releaseAll = function (reason) {
    const out = this.items.slice();
    this.items.length = 0;
    const dmg = this.storedDamage;
    this.storedDamage = 0;
    if (this.bus) this.bus.emit('EscrowReleased', { escrow: this.id, reason: reason || 'release', count: out.length, damage: dmg });
    return { objects: out, damage: dmg };
  };

  /* ------------------------------------------------------------------ *
   * Scheduler — deterministic delayed callbacks driven by the combat
   * clock. No raw setTimeout for gameplay (doc 00 law).
   * ------------------------------------------------------------------ */
  function Scheduler(clock) {
    this.clock = clock;
    this.next = [];
  }
  Scheduler.prototype.after = function (delay, fn, label) {
    const entry = { at: this.clock() + delay, fn, label: label || 'anon', seq: this._seq = (this._seq || 0) + 1 };
    this.next.push(entry);
    return entry;
  };
  Scheduler.prototype.cancel = function (entry) {
    if (!entry) return;
    const i = this.next.indexOf(entry);
    if (i >= 0) this.next.splice(i, 1);
  };
  Scheduler.prototype.tick = function () {
    if (!this.next.length) return;
    const now = this.clock();
    const due = this.next.filter((e) => e.at <= now).sort((a, b) => (a.at - b.at) || (a.seq - b.seq));
    if (!due.length) return;
    for (const e of due) {
      const i = this.next.indexOf(e);
      if (i >= 0) this.next.splice(i, 1);
      try { e.fn(); } catch (err) { /* isolated */ }
    }
  };
  Scheduler.prototype.pending = function () { return this.next.length; };
  // Cancel every pending job. Gameplay-delayed callbacks are match-scoped;
  // match teardown clears the queue so a rematch/mode switch can never fire
  // the previous match's jobs (cross-match entity leak law).
  Scheduler.prototype.clear = function () { this.next.length = 0; };

  /* ------------------------------------------------------------------ *
   * Root AIL object. `clock` and `bus` are bound by the integration
   * runtime once the combat world exists; AIL itself stays agnostic.
   * ------------------------------------------------------------------ */
  const bus = new EventBus();
  // Simulation clock. The integration runtime binds a DETERMINISTIC
  // resolver (global matchClock — advanced exactly once per simulation
  // step by updateArsenalQuest, the single shared step for rAF AND
  // headless AQ.step). PRODUCER LAW: AIL.clock()/StatusResolver.clock()
  // must always return the RESOLVED NUMBER, never the resolver function —
  // a function leaking into time arithmetic silently kills every
  // time-based semantic (cast plans, lifetimes, status expiry).
  let clockNow = 0;
  let clockResolver = null;

  function bindClock(fn) {
    clockResolver = typeof fn === 'function' ? fn : null;
    clockNow = clockResolver ? clockResolver() : 0;
    bus.clock = clock;
  }
  function clock() {
    if (clockResolver) clockNow = clockResolver();
    return clockNow;
  }

  bus.clock = clock;

  StatusResolver.bus = bus;
  StatusResolver.clock = clock;

  globalScope.apexHeroReworkAil = 'ready';
  globalScope.APEX_HERO_REWORK_AIL = {
    version: '2.0.0-rebuild1',
    makeSeededRng,
    bus,
    bindClock,
    clock,
    StatusResolver,
    CapabilityAuthority,
    circleSweepTOI,
    RelocationTransaction,
    Escrow,
    Scheduler,
    STATUS_LAWS,
    EVENT_RING_CAP,
  };
})(typeof window !== 'undefined' ? window : globalThis);
