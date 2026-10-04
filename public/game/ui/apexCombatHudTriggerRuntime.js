// APEX CHAOS — Battle HUD SEMANTIC TRIGGER AUTHORITY (owner patch, 2026-10-04).
//
// This runtime is the ONLY place that decides WHICH Gold presentation response a
// Battle HUD trigger maps to. It owns presentation CLASSIFICATION and nothing
// else: it never recomputes damage, crit chance, cooldowns, HP or ownership.
//
// ── Authority ────────────────────────────────────────────────────────────────
// Gold demo buttons, keyboard shortcuts, showcase timers, animation endpoints,
// test controls and synthetic demo events are NOT production trigger authority.
// Production runtime truth is the only trigger authority. Input keys are never
// HUD trigger authority; changing J/K or any future skill key must not require
// rewriting this file, because this file consumes semantic events, not keys.
//
// ── Trigger → production semantic source map ─────────────────────────────────
// NORMAL HIT    real realized non-critical damage transaction
//               <- apexEngine.js takeDamage -> APEX_COMBAT_HUD.onRealizedDamage
// CRITICAL      CONFIRMED FIREARM critical only
//               <- same event, ev.critical === true AND firearm origin proven
//                  via Arsenal weapon identity (APEX_ARSENAL_CONFIG.isGun).
//                  Melee / grenade / shield / heal / native hero-skill /
//                  environmental damage is NEVER Critical regardless of size.
// HEAVY         ONE victim receives MORE THAN 200 REALIZED DAMAGE inside a
//               rolling 1.20 s window. Presentation/HUD classification only —
//               not a damage calculation, not a multiplier, not balance, and
//               not equivalent to Critical.
// THUNDER       confirmed STORMBREAKER damage -> HEAVY family + THUNDER family.
//               Stormbreaker is never reinterpreted as "just a crit".
// HEAL          real authoritative heal transaction (apexEngine.js heal()).
//               Never inferred from green DOM text or animation state.
// WEAPON CHANGE real weapon ownership/equip change (Arsenal ownership truth).
// LOW HP        crossing the authoritative production low-HP condition.
// SKILL CAST    real accepted cast (AIL bus 'Cast', emitted only AFTER
//               exec.cast() returned truthy). 'CastFailCue' is never a cast.
// SKILL READY   real cooldown/charge transition back to a usable state.
// KO            real authoritative KO/death result. No synthetic timed KO.
// MATCH STATE   real production round/match/result state transition.
//
// ── Design constraints ───────────────────────────────────────────────────────
// No DOM. No AudioContext. No gameplay mutation. The clock is injectable so the
// Heavy rolling-window law is deterministically testable without real timers.

(function apexCombatHudTriggerRuntime(globalScope) {
  'use strict';
  if (!globalScope) return;
  if (globalScope.APEX_COMBAT_HUD_TRIGGERS) return;

  // ── Owner constants ────────────────────────────────────────────────────────
  // HEAVY: MORE THAN 200 realized damage inside a rolling 1.20 s window.
  const HEAVY_BURST_THRESHOLD = 200;
  const HEAVY_BURST_WINDOW_MS = 1200;

  // Accepted damage-number semantic family (data-driven tokens, never
  // hard-coded in a renderer). P1/P2 side colour is separate semantic
  // ownership and is resolved by the HUD renderer from product state.
  const DAMAGE_SEMANTICS = Object.freeze({
    NORMAL: Object.freeze({ id: 'NORMAL', tone: 'red', treatment: 'standard' }),
    CRITICAL: Object.freeze({ id: 'CRITICAL', tone: 'orange', treatment: 'diamond' }),
    HEAL: Object.freeze({ id: 'HEAL', tone: 'green', treatment: 'standard' }),
  });

  const KIND = Object.freeze({
    NORMAL_HIT: 'NORMAL_HIT',
    CRITICAL: 'CRITICAL',
    HEAVY: 'HEAVY',
    THUNDER: 'THUNDER',
    HEAL: 'HEAL',
    WEAPON_CHANGE: 'WEAPON_CHANGE',
    LOW_HP: 'LOW_HP',
    LOW_HP_CLEARED: 'LOW_HP_CLEARED',
    SKILL_CAST: 'SKILL_CAST',
    SKILL_READY: 'SKILL_READY',
    KO: 'KO',
    MATCH_STATE: 'MATCH_STATE',
  });

  const ARSENAL_LABEL_PREFIX = 'arsenal-';
  const STORMBREAKER_ID = 'STORMBREAKER';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function victimKey(ev) {
    // Production hands this classifier real objects (apexEngine takeDamage) and
    // plain identifiers (AIL bus RealizedDamageEvent). Both are legitimate;
    // identity is what the rolling window is keyed on, never a name string
    // that could collide across a rematch.
    const v = ev && ev.victim;
    if (v == null) return null;
    if (typeof v === 'object') return v.id != null ? `o:${v.id}` : null;
    return `k:${v}`;
  }

  // Arsenal damage labels are `arsenal-<weaponId lowercased>` (aqDamage).
  // Non-Arsenal labels ('poison', 'blood-drain', 'direct', ...) therefore have
  // no firearm identity and can never be Critical.
  function weaponIdFromEvent(ev) {
    if (!ev) return null;
    if (typeof ev.weaponId === 'string' && ev.weaponId) return ev.weaponId.toUpperCase();
    const label = ev.label;
    if (typeof label !== 'string') return null;
    if (!label.startsWith(ARSENAL_LABEL_PREFIX)) return null;
    const id = label.slice(ARSENAL_LABEL_PREFIX.length).trim().toUpperCase();
    return id || null;
  }

  function arsenalConfig() {
    return globalScope.APEX_ARSENAL_CONFIG || null;
  }

  // Firearm origin must be CONFIRMED from Arsenal identity, not assumed.
  // Fail-closed: if Arsenal identity is unavailable we cannot confirm a
  // firearm, so the hit is not Critical. Under-classifying is the safe
  // direction; inventing Critical identity is not.
  function isFirearmWeapon(weaponId) {
    if (!weaponId) return false;
    const cfg = arsenalConfig();
    if (cfg && typeof cfg.isGun === 'function') {
      try { return !!cfg.isGun(weaponId); } catch (error) { return false; }
    }
    return false;
  }

  // ── Session ────────────────────────────────────────────────────────────────
  // One session per battle. Presentation triggers accumulate in a queue that
  // the HUD renderer drains; the classifier never touches the DOM.
  function createSession(options = {}) {
    const clock = typeof options.now === 'function'
      ? options.now
      : (typeof performance !== 'undefined' && performance && typeof performance.now === 'function'
        ? () => performance.now()
        : () => Date.now());

    // Per-victim rolling realized-damage window.
    const bursts = new Map();
    const queue = [];
    // LOW HP is a STATE (crossing edge), not a per-hit event. The previous
    // side state is tracked so the HUD gets one entry and one clear.
    const lowHpState = new Map();
    let matchState = null;

    const stats = {
      realizedDamage: 0,
      normal: 0,
      critical: 0,
      heavy: 0,
      thunder: 0,
      heal: 0,
      weaponChange: 0,
      lowHp: 0,
      skillCast: 0,
      skillReady: 0,
      ko: 0,
      matchState: 0,
      // Rejections are counted so a test can prove the classifier actually
      // looked at the guard rather than never being exercised.
      rejectedNonArsenalCritical: 0,
      rejectedUnconfirmedFirearm: 0,
      rejectedHeavyReplay: 0,
      rejectedNonPositive: 0,
    };

    function push(kind, payload) {
      queue.push({ kind, at: clock(), ...payload });
      return queue[queue.length - 1];
    }

    function drain() {
      if (!queue.length) return [];
      return queue.splice(0, queue.length);
    }

    function pruneWindow(b, now) {
      const cutoff = now - HEAVY_BURST_WINDOW_MS;
      while (b.hits.length && b.hits[0].at <= cutoff) {
        b.total -= b.hits[0].amount;
        b.hits.shift();
      }
      if (b.total < 0) b.total = 0;
      // The rolling burst has ended: nothing remains inside the window, so the
      // "at most once per qualifying burst" latch resets naturally.
      if (!b.hits.length) {
        b.total = 0;
        b.triggered = false;
      }
    }

    // ---------------------------------------------------------------- damage --
    function onRealizedDamage(ev) {
      if (!ev) return null;
      const amount = Number(ev.amount);
      if (!(amount > 0)) {
        // Zero/blocked/miss never extends a burst and never presents.
        stats.rejectedNonPositive += 1;
        return null;
      }
      const key = victimKey(ev);
      if (!key) return null;
      stats.realizedDamage += 1;

      const now = clock();
      const weaponId = weaponIdFromEvent(ev);
      const isStormbreaker = weaponId === STORMBREAKER_ID;

      // -- CRITICAL: confirmed firearm critical ONLY -------------------------
      // Guard order matters. Status/environmental damage is excluded first,
      // then weapon identity must resolve, then Arsenal must confirm a gun.
      let critical = false;
      if (ev.critical) {
        if (ev.statusDamage) {
          stats.rejectedNonArsenalCritical += 1;
        } else if (!weaponId) {
          // Large native hero-skill / environmental damage carries no Arsenal
          // weapon identity, so it cannot be a firearm critical.
          stats.rejectedNonArsenalCritical += 1;
        } else if (!isFirearmWeapon(weaponId)) {
          // Melee / grenade / shield / Stormbreaker: never Critical.
          stats.rejectedUnconfirmedFirearm += 1;
        } else {
          critical = true;
        }
      }

      const result = {
        victim: ev.victim,
        amount,
        weaponId,
        critical,
        stormbreaker: isStormbreaker,
        heavy: false,
        thunder: false,
        kinds: [],
      };

      if (critical) {
        result.kinds.push(KIND.CRITICAL);
        stats.critical += 1;
        push(KIND.CRITICAL, {
          victim: ev.victim,
          attacker: ev.attacker ?? null,
          amount,
          weaponId,
          semantic: DAMAGE_SEMANTICS.CRITICAL,
        });
      } else {
        result.kinds.push(KIND.NORMAL_HIT);
        stats.normal += 1;
        push(KIND.NORMAL_HIT, {
          victim: ev.victim,
          attacker: ev.attacker ?? null,
          amount,
          weaponId,
          semantic: DAMAGE_SEMANTICS.NORMAL,
        });
      }

      // -- HEAVY: rolling 1.20 s per-victim burst ---------------------------
      let b = bursts.get(key);
      if (!b) {
        b = { hits: [], total: 0, triggered: false };
        bursts.set(key, b);
      }
      pruneWindow(b, now);
      b.hits.push({ at: now, amount });
      b.total += amount;

      if (b.total > HEAVY_BURST_THRESHOLD && !b.triggered) {
        // First qualifying moment of THIS burst. Later hits inside the same
        // burst must not replay Heavy.
        b.triggered = true;
        result.heavy = true;
        result.kinds.push(KIND.HEAVY);
        stats.heavy += 1;
        push(KIND.HEAVY, {
          victim: ev.victim,
          burstTotal: b.total,
          burstHits: b.hits.length,
          windowMs: HEAVY_BURST_WINDOW_MS,
          threshold: HEAVY_BURST_THRESHOLD,
        });
      } else if (b.total > HEAVY_BURST_THRESHOLD && b.triggered) {
        stats.rejectedHeavyReplay += 1;
      }

      // -- THUNDER: confirmed Stormbreaker damage ---------------------------
      // Stormbreaker is its own authored identity LAYERED with Heavy. It is
      // never folded into ordinary firearm-critical semantics.
      if (isStormbreaker) {
        result.thunder = true;
        if (!result.heavy) {
          // A confirmed Stormbreaker event belongs to the Heavy family even
          // when the rolling burst had not yet qualified on its own.
          result.heavy = true;
          result.kinds.push(KIND.HEAVY);
          stats.heavy += 1;
          push(KIND.HEAVY, {
            victim: ev.victim,
            burstTotal: b.total,
            burstHits: b.hits.length,
            windowMs: HEAVY_BURST_WINDOW_MS,
            threshold: HEAVY_BURST_THRESHOLD,
            via: 'stormbreaker',
          });
        }
        result.kinds.push(KIND.THUNDER);
        stats.thunder += 1;
        push(KIND.THUNDER, { victim: ev.victim, weaponId });
      }

      return result;
    }

    // ------------------------------------------------------------------ heal --
    // Only a real heal transaction calls this. Green DOM text / animation state
    // is never accepted as a source.
    function onHeal(ev) {
      if (!ev) return null;
      const amount = Number(ev.amount);
      if (!(amount > 0)) { stats.rejectedNonPositive += 1; return null; }
      stats.heal += 1;
      return push(KIND.HEAL, {
        target: ev.target ?? ev.victim ?? null,
        amount,
        overheal: !!ev.overheal,
        semantic: DAMAGE_SEMANTICS.HEAL,
      });
    }

    // --------------------------------------------------------- weapon change --
    // Real Arsenal ownership/equip change. Never weapon-art animation
    // completion, placeholder swapping or a demo control.
    function onWeaponChange(ev) {
      if (!ev) return null;
      const holder = ev.holder ?? ev.fighter ?? null;
      if (!holder) return null;
      const from = ev.from ?? null;
      const to = ev.to ?? ev.weaponId ?? null;
      if (from === to) return null; // no real change
      stats.weaponChange += 1;
      return push(KIND.WEAPON_CHANGE, { holder, from, to, slot: ev.slot ?? null });
    }

    // --------------------------------------------------------------- low hp --
    // Crossing edge only. The threshold is owned by production and passed in;
    // this runtime deliberately has NO HP threshold of its own.
    function syncLowHp(entries, threshold) {
      const list = Array.isArray(entries) ? entries : [];
      const out = [];
      for (const entry of list) {
        if (!entry) continue;
        const key = entry.id != null ? `o:${entry.id}` : `k:${String(entry.subject ?? '')}`;
        const was = !!lowHpState.get(key);
        // Production supplies `low`; when it supplies raw values instead the
        // threshold is production-provided, never authored here.
        const is = entry.low != null
          ? !!entry.low
          : (typeof threshold === 'number' && Number(entry.hp) <= threshold);
        if (is === was) continue;
        lowHpState.set(key, is);
        if (is) {
          stats.lowHp += 1;
          out.push(push(KIND.LOW_HP, { subject: entry.subject ?? entry.fighter ?? null, hp: entry.hp ?? null }));
        } else {
          out.push(push(KIND.LOW_HP_CLEARED, { subject: entry.subject ?? entry.fighter ?? null, hp: entry.hp ?? null }));
        }
      }
      return out;
    }

    // ------------------------------------------------------------- skill io --
    // A real accepted cast. 'CastFailCue' must never reach this seam.
    function onSkillCast(ev) {
      if (!ev) return null;
      if (ev.rejected || ev.reason) return null; // fail cue, not a cast
      stats.skillCast += 1;
      return push(KIND.SKILL_CAST, {
        hero: ev.hero ?? null,
        slot: ev.slot ?? null,
        mechanic: ev.mechanic ?? null,
      });
    }

    // A real cooldown/charge transition back to usable. Not "an authored
    // cooldown animation finished".
    function onSkillReady(ev) {
      if (!ev) return null;
      if (!(ev.usable === true)) return null;
      stats.skillReady += 1;
      return push(KIND.SKILL_READY, {
        hero: ev.hero ?? null,
        slot: ev.slot ?? null,
        charges: ev.charges ?? null,
      });
    }

    // ------------------------------------------------------------------- ko --
    // Real authoritative KO/death result only. No synthetic timed KO.
    function onKO(ev) {
      if (!ev) return null;
      const victim = ev.victim ?? ev.loser ?? null;
      if (!victim) return null;
      stats.ko += 1;
      return push(KIND.KO, {
        victim,
        winner: ev.winner ?? null,
        reason: ev.reason ?? 'KO',
      });
    }

    // ----------------------------------------------------------- match state --
    function onMatchState(ev) {
      if (!ev) return null;
      const state = ev.state ?? ev.phase ?? null;
      if (!state) return null;
      const from = matchState;
      if (state === matchState) return null; // no real transition
      matchState = state;
      stats.matchState += 1;
      return push(KIND.MATCH_STATE, { from, to: state, round: ev.round ?? null, result: ev.result ?? null });
    }

    // -------------------------------------------------------------- session --
    // A new battle must not inherit a previous match's burst windows, low-HP
    // latches or trigger backlog.
    function reset() {
      bursts.clear();
      lowHpState.clear();
      queue.length = 0;
      matchState = null;
    }

    return {
      onRealizedDamage,
      onHeal,
      onWeaponChange,
      syncLowHp,
      onSkillCast,
      onSkillReady,
      onKO,
      onMatchState,
      drain,
      pending: () => queue.length,
      reset,
      stats,
      burstSnapshot: () => Array.from(bursts.entries()).map(([key, b]) => ({
        victim: key, total: b.total, hits: b.hits.length, triggered: b.triggered,
      })),
      matchState: () => matchState,
    };
  }

  globalScope.APEX_COMBAT_HUD_TRIGGERS = Object.freeze({
    version: 'apex-combat-hud-trigger-authority-v1',
    KIND,
    DAMAGE_SEMANTICS,
    HEAVY_BURST_THRESHOLD,
    HEAVY_BURST_WINDOW_MS,
    createSession,
    // Exported so a gate can prove the firearm-origin guard is Arsenal-backed
    // rather than a hard-coded weapon list.
    weaponIdFromEvent,
    isFirearmWeapon,
  });
})(typeof window !== 'undefined' ? window : globalThis);
