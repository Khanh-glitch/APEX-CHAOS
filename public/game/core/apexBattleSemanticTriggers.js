// APEX CHAOS — Battle semantic trigger adapter.
// Implements thin observation seams for Gold Battle HUD choreography:
// - Heavy: >200 realized damage to same victim in rolling 1.20s
// - Heal: post-heal semantic observer (afterHp - beforeHp > 0)
// - Stormbreaker Thunder: confirmed damaging Stormbreaker hit
// - Critical identity accent: attacker/source color, not fixed orange
//
// This adapter sits between production gameplay truth and Gold presentation.
// It does NOT modify damage, HP, cooldowns, or hero mechanics.
(function apexBattleSemanticTriggers() {
  if (window.apexBattleSemanticTriggers === 'ready') return;
  if (typeof window === 'undefined') return;

  // ── Heavy accumulator (authority §6B) ───────────────────────────
  // Per-victim rolling 1.20s window, threshold >200, at most one Heavy
  // per qualifying burst.
  const HEAVY_WINDOW_MS = 1200;
  const HEAVY_THRESHOLD = 200;

  const heavyState = new Map(); // victimId -> { total, windowStart, triggered }

  function resetHeavy() {
    heavyState.clear();
  }

  function onHeavyDamage(victimId, amount, now) {
    if (!victimId || amount <= 0) return null;
    let state = heavyState.get(victimId);
    if (!state) {
      state = { total: 0, windowStart: now, triggered: false };
      heavyState.set(victimId, state);
    }
    // Reset window if expired
    if (now - state.windowStart > HEAVY_WINDOW_MS) {
      state.total = 0;
      state.windowStart = now;
      state.triggered = false;
    }
    state.total += amount;
    // Heavy fires once per qualifying burst (>200, not >=200)
    if (state.total > HEAVY_THRESHOLD && !state.triggered) {
      state.triggered = true;
      return true; // trigger Heavy
    }
    return false;
  }

  // ── Stormbreaker Thunder seam ───────────────────────────────────
  // Triggered from confirmed damaging Stormbreaker hit only.
  let stormbreakerThunderCallback = null;

  // ── Heal observation seam ───────────────────────────────────────
  // Thin post-heal observer: afterHp - beforeHp > 0
  let healCallback = null;

  // ── Critical identity accent ────────────────────────────────────
  // Returns the color accent for a given attacker/source identity.
  // This replaces the donor's fixed orange --crit.
  function critAccent(fighterOrHeroId) {
    const HERO = window.APEX_HERO_REWORK;
    if (HERO && HERO.hudIdentity) {
      const identity = HERO.hudIdentity(fighterOrHeroId);
      if (identity && identity.color) return identity.color;
    }
    // Fallback: use fighter color if available
    if (fighterOrHeroId && fighterOrHeroId.color) return fighterOrHeroId.color;
    return '#ff941f'; // generic fallback
  }

  // ── Low-HP tension (authority §6B) ─────────────────────────────
  // Both active combatants <= 500 HP (MATCH_HP = 1000)
  const TENSION_HP = 500;
  let tensionState = false;
  let tensionCallback = null;

  function checkTension(p1Hp, p2Hp) {
    const now = (p1Hp <= TENSION_HP && p2Hp <= TENSION_HP);
    if (now !== tensionState) {
      tensionState = now;
      if (tensionCallback) tensionCallback(now);
    }
    return now;
  }

  // ── Integration: hook into existing APEX_COMBAT_HUD ─────────────
  function install() {
    const HUD = window.APEX_COMBAT_HUD;
    if (!HUD) return;

    // Patch onRealizedDamage to also fire Heavy check
    const origDamage = HUD.onRealizedDamage;
    if (typeof origDamage === 'function') {
      HUD.onRealizedDamage = function patchedOnRealizedDamage(event) {
        // Call original
        const result = origDamage.call(this, event);
        // Heavy check
        if (event && event.victim && event.amount > 0) {
          const victimId = event.victim.id || event.victim.name || String(event.victimSide);
          const now = performance.now();
          const isHeavy = onHeavyDamage(victimId, event.amount, now);
          if (isHeavy) {
            // Emit Heavy event for Gold choreography
            window.dispatchEvent(new CustomEvent('apex:heavy', {
              detail: {
                victimSide: event.victimSide,
                victim: event.victim,
                total: heavyState.get(victimId)?.total || 0,
              }
            }));
          }
        }
        // Stormbreaker Thunder check
        if (event && event.stormbreaker === true && event.amount > 0) {
          window.dispatchEvent(new CustomEvent('apex:thunder', {
            detail: {
              victimSide: event.victimSide,
              victim: event.victim,
              amount: event.amount,
            }
          }));
        }
        // Critical identity accent event
        if (event && event.critical) {
          const accent = critAccent(event.attacker || event.attackerSide);
          window.dispatchEvent(new CustomEvent('apex:critical', {
            detail: {
              victimSide: event.victimSide,
              attackerSide: event.attackerSide,
              attacker: event.attacker,
              amount: event.amount,
              accent,
            }
          }));
        }
        return result;
      };
    }

    // Patch syncVitals to check tension
    const origSync = HUD.syncVitals;
    if (typeof origSync === 'function') {
      HUD.syncVitals = function patchedSyncVitals() {
        const result = origSync.call(this);
        try {
          const fighters = window.fighters;
          if (fighters && fighters[0] && fighters[1]) {
            checkTension(fighters[0].hp, fighters[1].hp);
          }
        } catch (_) {}
        return result;
      };
    }

    // Patch onto Fighter.heal for semantic heal observer
    const FighterProto = window.Fighter?.prototype;
    if (FighterProto && typeof FighterProto.heal === 'function') {
      const origHeal = FighterProto.heal;
      FighterProto.heal = function patchedHeal(amount) {
        const beforeHp = this.hp;
        const result = origHeal.call(this, amount);
        const afterHp = this.hp;
        const realized = afterHp - beforeHp;
        if (realized > 0 && healCallback) {
          healCallback({ target: this, beforeHp, afterHp, realized });
        }
        if (realized > 0) {
          window.dispatchEvent(new CustomEvent('apex:heal', {
            detail: { target: this, beforeHp, afterHp, realized }
          }));
        }
        return result;
      };
    }
  }

  // ── Public API ──────────────────────────────────────────────────
  const API = {
    version: 'apex-battle-semantic-triggers-v1',
    onHeavyDamage,
    critAccent,
    checkTension,
    resetHeavy,
    install,
    setHealCallback(fn) { healCallback = fn; },
    setTensionCallback(fn) { tensionCallback = fn; },
    setStormbreakerThunderCallback(fn) { stormbreakerThunderCallback = fn; },
    get tensionActive() { return tensionState; },
    getHeavyState(victimId) { return heavyState.get(victimId) || null; },
  };

  window.APEX_BATTLE_TRIGGERS = API;

  // Auto-install when match starts
  const origBegin = window.apexBeginBattleAudioSession;
  window.apexBeginBattleAudioSession = function semanticTriggerBegin() {
    resetHeavy();
    install();
    if (typeof origBegin === 'function') origBegin.call(this);
  };

  window.apexBattleSemanticTriggers = 'ready';
})();