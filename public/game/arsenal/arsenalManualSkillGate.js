// ARSENAL QUEST — POST-C §6: P1 manual active-skill gate.
// ONE central registry. In Arsenal mode, human P1's cooldown-only auto-cast
// skills stop auto-casting: their cooldown still RECOVERS, but the kit's
// "ready" tick is held until an edge-triggered J press releases exactly one
// eligible skill. Reactive/event skills (collision, wall bounce, on-damage,
// threshold, contact, resource, status) are NOT registered and stay
// event-triggered. P2 keeps full auto behavior. No keyboard checks live in
// any kit — the mode runtime feeds pulses in through pressJ().
//
// Mechanism (per gated cooldown key on fighter.data):
//   hold(f)    — each frame before P1's update: if key <= EPS, clamp it to a
//                tiny positive HOLD value so the native kit never sees <= 0
//                and therefore never auto-casts. All other kit timers in the
//                same kit keep running untouched.
//   release(f) — on a J pulse: set key to 0 so the native kit casts on its
//                next update and resets its own cooldown.
//   ready(f)   — key <= EPS plus the kit's own extra cast condition, so a
//                pulse is never spent on a skill that cannot activate.
// Activation success is detected by the key resetting to a real cooldown
// after the frame; failed activations never consume the pulse or the cooldown.
(function apexArsenalManualSkillGate() {
  if (window.apexArsenalManualSkillGate === 'ready') return;

  const EPS = 1e-6;
  const HOLD = 0.08;          // clamped "almost ready" — stays above one frame of abilityDt
  const PULSE_WINDOW = 1.0;   // seconds a J press stays buffered until consumed

  // Registry: canonical shell name -> gated skill keys.
  // `sub` addresses a nested data object (RUBBER's learned sub-skill).
  // `ready` mirrors the kit's own extra cast condition. Full-roster audit:
  // docs/arsenal-quest/POST_C_OWNER_FEEDBACK_REVISION_CONTRACT.md §6.
  // Deliberately ABSENT (event-triggered, stay automatic): VAMPIRE (collision
  // latch), ELECTRIC (wall/contact), BLADE (wall bounce), DRUM (wall beat),
  // SLIME (burst on damage), TOXIC (passive trail; rage-only spit is already
  // suppressed by noRage), STRING (movement cycle), NOVA/GALAXY (stack
  // resource + contact pressure), MONK/KUNGFU (onCollide combos),
  // WIND/PUPPET cyclone (contact hold), WOLF bite (onCollide).
  const GATED_SKILLS = {
    RUBBER: [
      { key: 'cd', ready: (f) => !f.data.active },
      { key: 'cd', sub: 'subData' },
    ],
    ICE: [{ key: 'cd' }],
    MAGNET: [{ key: 'cd' }],
    FLASH: [{ key: 'cd' }],
    ORBIT: [{ key: 'cd' }],
    MIRROR: [{ key: 'cd' }],
    BLACK_HOLE: [{ key: 'cd' }],
    VOLCANO: [{ key: 'cd' }],
    CRYSTAL: [{ key: 'cd' }],
    MATH: [{ key: 'cd' }],
    MATH_V2: [{ key: 'cd' }],
    SNIPER: [{ key: 'cd' }],
    SAW: [{ key: 'cd', ready: (f) => (f.data.spin || 0) <= 0 }],
    HUNTER: [{ key: 'cd', ready: (f) => (f.data.hunt || 0) <= 0 }],
    TIME: [{ key: 'clockCd' }, { key: 'markCd', ready: (f) => !f.data.mark }],
    WOLF: [{ key: 'scentCd' }],
    WITCH: [{ key: 'rayCd' }, { key: 'curseCd' }],
    PIRATE: [{ key: 'lootCd' }, { key: 'anchorCd' }],
    PAINTER: [{ key: 'blobCd' }],
    VIRUS: [{ key: 'spawnCd' }],
    SUPERSTAR: [{ key: 'eventCd' }],
    CARD: [{ key: 'drawCd', ready: (f) => f.data.phase === 'draw' }],
    // POST-C §7: NEWBIE's dash is P1-manual too. Its runtime watches
    // f.data.nbTrigger (set by the custom release below) instead of a raw
    // cooldown-zero, and only consumes the cooldown on a real dash launch.
    NEWBIE: [{ key: 'nbCd', release: (f) => { f.data.nbTrigger = true; }, activated: (f) => !!f.data.nbDash }],
  };

  function containerFor(f, entry) {
    if (!f || !f.data) return null;
    if (!entry.sub) return f.data;
    f.data[entry.sub] = f.data[entry.sub] || {};
    return f.data[entry.sub];
  }

  function skillReady(f, entry) {
    const c = containerFor(f, entry);
    if (!c || typeof c[entry.key] !== 'number') return false;
    if (c[entry.key] > HOLD + 1e-9) return false; // HOLD means "waiting for J"
    if (entry.ready && !entry.ready(f)) return false;
    return true;
  }

  function holdSkill(f, entry) {
    const c = containerFor(f, entry);
    if (!c || typeof c[entry.key] !== 'number') return;
    if (c[entry.key] <= HOLD) c[entry.key] = HOLD;
  }

  function releaseSkill(f, entry) {
    const c = containerFor(f, entry);
    if (!c || typeof c[entry.key] !== 'number') return;
    c[entry.key] = 0;
    if (entry.release) { try { entry.release(f); } catch (e) {} }
  }

  function skillActivated(f, entry, preValue) {
    if (entry.activated) { try { if (entry.activated(f)) return true; } catch (e) {} }
    const c = containerFor(f, entry);
    if (!c || typeof c[entry.key] !== 'number') return false;
    // The kit reset its own cooldown to a real value -> it really cast.
    return c[entry.key] > Math.max(0.5, preValue * 4);
  }

  // Per-fighter gate state lives on f.data.__aqGate (never touches kit keys).
  function gateState(f) {
    if (!f.data.__aqGate) f.data.__aqGate = { pulseAge: null, pending: null, pendingPre: 0 };
    return f.data.__aqGate;
  }

  const api = {
    GATED_SKILLS,
    PULSE_WINDOW,
    isGated(shellName) { return !!GATED_SKILLS[shellName]; },
    // Edge-triggered press from the mode runtime (KeyJ, P1 only).
    pressJ(f) {
      const shell = (f && f.type && (f.type.shellOf || f.type.name)) || (f && f.name);
      if (shell === 'NEWBIE') {
        const slots = (window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.slots) || [];
        const has = slots.some((s) => s && s.phase === 'REVEALED' && s.weaponId);
        if (!has) return false;
      }
      const g = gateState(f);
      g.pulseAge = 0;
      return true;
    },
    // Called by the mode runtime each frame BEFORE fighters[0].update(dt).
    // Returns nothing; mutates only gated cooldown keys / gate state.
    preUpdate(f, dt) {
      const shell = (f && f.type && (f.type.shellOf || f.type.name)) || f.name;
      const entries = GATED_SKILLS[shell];
      if (!f || !f.data || !entries) return;
      const g = gateState(f);

      // Cooldowns still recover on their own (kits decrement them); the gate
      // only intercepts the ready tick. While hard-CC/ability-disabled the
      // engine already pauses cooldowns — skip so we never fight the engine.
      const paused = typeof f.cooldownPaused === 'function' ? f.cooldownPaused() : false;

      if (g.pulseAge != null) {
        g.pulseAge += dt;
        if (g.pulseAge > PULSE_WINDOW) { g.pulseAge = null; g.pending = null; }
      }

      if (paused) return;

      if (g.pulseAge != null && !g.pending) {
        // Arm the first eligible ready skill (registry order).
        for (const entry of entries) {
          if (skillReady(f, entry)) {
            g.pending = entry;
            g.pendingPre = (containerFor(f, entry) || {})[entry.key] || 0;
            releaseSkill(f, entry);
            break;
          }
        }
      }

      // Hold every gated key that is not the armed one.
      for (const entry of entries) {
        if (entry === g.pending) continue;
        holdSkill(f, entry);
      }
    },
    // Called each frame AFTER fighters[0].update(dt).
    postUpdate(f) {
      const shell = (f && f.type && (f.type.shellOf || f.type.name)) || f.name;
      const entries = GATED_SKILLS[shell];
      if (!f || !f.data || !entries) return;
      const g = gateState(f);
      if (!g.pending) return;
      if (skillActivated(f, g.pending, g.pendingPre)) {
        // One press = one pulse = one successful activation, consumed.
        g.pending = null;
        g.pulseAge = null;
      } else {
        // Failed activation: cooldown untouched, pulse stays buffered until
        // the window expires or a later frame succeeds.
        holdSkill(f, g.pending);
      }
    },
    // Debug/inspection helper (F3 overlay + tests).
    snapshot(f) {
      const shell = (f && f.type && (f.type.shellOf || f.type.name)) || (f && f.name);
      const entries = GATED_SKILLS[shell] || [];
      const g = f && f.data ? gateState(f) : { pulseAge: null, pending: null };
      return {
        shell,
        gated: entries.length,
        pulseBuffered: g.pulseAge != null,
        pending: g.pending ? g.pending.key : null,
        keys: entries.map((e) => {
          const c = f && f.data ? containerFor(f, e) : null;
          return { key: e.sub ? `${e.sub}.${e.key}` : e.key, value: c ? c[e.key] : null, ready: !!(f && skillReady(f, e)) };
        }),
      };
    },
  };

  window.APEX_ARSENAL_SKILL_GATE = api;
  window.apexArsenalManualSkillGate = 'ready';
})();
