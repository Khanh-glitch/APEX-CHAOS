// ARSENAL QUEST V2 — Checkpoint A shells + B-handoff A-CORR-3 compatibility.
// Canonical 32 fighter shells, independently selectable for P1/P2.
// Shells reuse each fighter's real identity: native kits run per the
// documented KEEP/ADAPT/SUPPRESS matrix in
// docs/arsenal-quest/V2_ROSTER_COMPATIBILITY_MATRIX.md. Movement base speed is
// Arsenal-normalized; rage variants are suppressed roster-wide (noRage).
// No second roster renderer: the shared select screen renders these cards.
(function apexArsenalShellSelectRuntime() {
  if (window.apexArsenalShellSelectRuntime === 'ready') return;
  const CFG = window.APEX_ARSENAL_CONFIG;

  const CANONICAL_32 = [
    'RUBBER', 'ICE', 'VAMPIRE', 'STRING', 'VOLCANO', 'MAGNET', 'FLASH', 'ELECTRIC',
    'ORBIT', 'TOXIC', 'MIRROR', 'BLACK_HOLE', 'SAW', 'BLADE', 'NOVA', 'HUNTER',
    'CRYSTAL', 'VIRUS', 'DRUM', 'CARD', 'MATH', 'MATH_V2', 'SNIPER', 'SLIME',
    'TIME', 'WOLF', 'WIND', 'WITCH', 'PIRATE', 'PAINTER', 'MONK', 'SUPERSTAR',
    // POST-C §7: NEWBIE — the Arsenal-original hero (33rd shell).
    'NEWBIE',
  ];

  // Three canonical identities were re-keyed by boot-time mainline patches:
  // GALAXY_REPLACES_NOVA_PATCH (NOVA -> GALAXY), apexCanonicalBalance
  // (WIND -> PUPPET, MONK -> KUNGFU) with apexPrecisionFixes re-writing the
  // KUNGFU kit. Shells keep the canonical NAMES (cards, engine hooks, QA) but
  // resolve the CURRENT live identity so compatible kits actually run.
  const IDENTITY_ALIASES = { NOVA: 'GALAXY', WIND: 'PUPPET', MONK: 'KUNGFU' };

  function baseTypeFor(name) {
    const live = (typeof FighterTypes !== 'undefined' && FighterTypes)
      ? FighterTypes.find(t => t && t.name === name) : null;
    if (live) return live;
    const alias = IDENTITY_ALIASES[name];
    if (alias && typeof FighterTypes !== 'undefined' && FighterTypes) {
      const aliased = FighterTypes.find(t => t && t.name === alias);
      if (aliased) return aliased;
    }
    return (window.__APEX_REMOVED_FIGHTER_TYPES || {})[name] || null;
  }

  // V2 B-handoff A-CORR-3: data-driven compatibility profiles. One entry per
  // canonical fighter; see docs/arsenal-quest/V2_ROSTER_COMPATIBILITY_MATRIX.md
  // for the per-mechanic rationale. Default is KEEP (native kit runs).
  // 'ADAPT' rows run native too — their narrow compatibility changes live as
  // arsenalShell-keyed engine hooks (VAMPIRE latch 2.5s, MONK rush 2.5s).
  // No per-fighter mode checks scattered through gameplay code.
  const COMPAT_PROFILES = {
    RUBBER: 'KEEP', ICE: 'KEEP', VAMPIRE: 'ADAPT', STRING: 'KEEP',
    VOLCANO: 'KEEP', MAGNET: 'KEEP', FLASH: 'KEEP', ELECTRIC: 'KEEP',
    ORBIT: 'KEEP', TOXIC: 'KEEP', MIRROR: 'KEEP', BLACK_HOLE: 'KEEP',
    SAW: 'KEEP', BLADE: 'KEEP', NOVA: 'KEEP', HUNTER: 'KEEP',
    CRYSTAL: 'KEEP', VIRUS: 'KEEP', DRUM: 'KEEP', CARD: 'KEEP',
    MATH: 'KEEP', MATH_V2: 'KEEP', SNIPER: 'KEEP', SLIME: 'KEEP',
    TIME: 'KEEP', WOLF: 'KEEP', WIND: 'KEEP', WITCH: 'KEEP',
    PIRATE: 'KEEP', PAINTER: 'KEEP', MONK: 'ADAPT', SUPERSTAR: 'KEEP',
    NEWBIE: 'KEEP',
  };

  // POST-C §7 — NEWBIE: Arsenal-original 33rd shell. Simple beginner body
  // (no glyphs). One active: 10s cooldown, dash toward the nearest REVEALED
  // pickup. P1 uses J via the skill gate (nbTrigger); P2 auto-casts when
  // ready. Activation fails (cooldown NOT consumed) if no eligible pickup.
  function makeNewbieType() {
    const spec = (CFG && CFG.NEWBIE) || { cooldown: 10, dashSpeed: 3400, dashMaxSeconds: 0.55, turnRate: 11, magnetRadius: 34, magnetPull: 900 };
    function nearestRevealedPickup(f) {
      const slots = (window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.slots) || [];
      let best = null, bestD = Infinity;
      for (const s of slots) {
        if (!s || s.phase !== 'REVEALED' || !s.weaponId) continue;
        const d = Math.hypot(s.x - f.x, s.y - f.y);
        if (d < bestD) { bestD = d; best = s; }
      }
      return best;
    }
    function tryLaunchDash(f) {
      const slot = nearestRevealedPickup(f);
      if (!slot) {
        window.avCue && window.avCue('newbie_fail', { x: f.x, y: f.y });
        return false;
      }
      const dx = slot.x - f.x, dy = slot.y - f.y;
      const mag = Math.hypot(dx, dy) || 1;
      f.data.nbDash = {
        tx: slot.x, ty: slot.y, slotId: slot.id,
        vx: (dx / mag) * spec.dashSpeed,
        vy: (dy / mag) * spec.dashSpeed,
        t: 0, max: spec.dashMaxSeconds,
      };
      // Trajectory BEND — setDir so movement reads as a real dash, not a teleport.
      if (typeof f.setDir === 'function') f.setDir(dx / mag, dy / mag);
      f.data.nbCd = spec.cooldown;
      window.avCue && window.avCue('newbie_dash', { x: f.x, y: f.y, angle: Math.atan2(dy, dx) });
      if (window.APEX_ARSENAL && window.APEX_ARSENAL.log) {
        window.APEX_ARSENAL.log('NEWBIE_DASH', `fighter=${f.name} slot=${slot.id} weapon=${slot.weaponId}`);
      }
      return true;
    }
    return {
      name: 'NEWBIE',
      color: '#c8c2b4',
      desc: 'Beginner shell — dash to the nearest revealed weapon',
      speed: CFG.FIGHTER_SPEED,
      startDx: 1,
      startDy: 0.55,
      noRage: true,
      arsenalShell: true,
      arsenalOriginal: true,
      compatKit: 'KEEP',
      init: (f) => {
        f.data = f.data || {};
        f.data.nbCd = 0;
        f.data.nbDash = null;
        f.data.nbTrigger = false;
      },
      update: (f, e, dt) => {
        f.data.nbCd = Math.max(0, (f.data.nbCd || 0) - (typeof abilityDt === 'function' ? abilityDt(f, dt) : dt));
        // In-flight dash: physical motion toward the pickup, magnet in last metre.
        if (f.data.nbDash) {
          const d = f.data.nbDash;
          d.t += dt;
          const dx = d.tx - f.x, dy = d.ty - f.y;
          const mag = Math.hypot(dx, dy) || 1;
          // Steer toward the (possibly moving) pickup without teleporting.
          const desiredVx = (dx / mag) * spec.dashSpeed;
          const desiredVy = (dy / mag) * spec.dashSpeed;
          const k = Math.min(1, spec.turnRate * dt);
          d.vx += (desiredVx - d.vx) * k;
          d.vy += (desiredVy - d.vy) * k;
          f.x += d.vx * dt;
          f.y += d.vy * dt;
          if (typeof f.setDir === 'function') f.setDir(d.vx, d.vy);
          // Soft magnet on the pickup in the last few dozen pixels.
          const slots = (window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.slots) || [];
          const slot = slots.find((s) => s && s.id === d.slotId);
          if (slot && slot.phase === 'REVEALED') {
            const sd = Math.hypot(slot.x - f.x, slot.y - f.y);
            if (sd < spec.magnetRadius * 3) {
              const pull = spec.magnetPull * dt;
              const nx = (f.x - slot.x) / (sd || 1);
              const ny = (f.y - slot.y) / (sd || 1);
              slot.x += nx * pull * 0.15;
              slot.y += ny * pull * 0.15;
            }
          }
          const arrived = mag < spec.magnetRadius || d.t >= d.max;
          if (arrived) f.data.nbDash = null;
          return;
        }
        // P1: the skill gate sets nbTrigger on a successful J pulse.
        // P2: auto-cast when ready (narrow exception to no-weapon-seeking-AI).
        const isP1 = typeof fighters !== 'undefined' && fighters && fighters[0] === f;
        if (f.data.nbTrigger) {
          f.data.nbTrigger = false;
          if (f.data.nbCd > 1e-6) return;
          tryLaunchDash(f);
          return;
        }
        if (!isP1 && f.data.nbCd <= 1e-6) tryLaunchDash(f);
      },
      draw: (c, f) => {
        // Glyph-free beginner body: stacked rounded blobs + visor band.
        if (typeof drawSketchBlob === 'function') drawSketchBlob(c, f.radius, f.color, 14);
        else {
          c.fillStyle = f.color;
          c.beginPath();
          c.arc(0, 0, f.radius, 0, Math.PI * 2);
          c.fill();
        }
        c.save();
        c.fillStyle = '#2a2c32';
        c.beginPath();
        c.ellipse(0, -8, f.radius * 0.55, 10, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(180, 220, 255, 0.55)';
        c.beginPath();
        c.ellipse(0, -8, f.radius * 0.42, 6, 0, 0, Math.PI * 2);
        c.fill();
        if (f.data && f.data.nbDash) {
          c.strokeStyle = 'rgba(232,224,200,0.55)';
          c.lineWidth = 6;
          c.beginPath();
          c.arc(0, 0, f.radius + 18, 0, Math.PI * 2);
          c.stroke();
        }
        c.restore();
      },
    };
  }

  // Every native hook is delegated through a guard so a native-kit fault can
  // never corrupt Arsenal weapon pickup/reveal/holder state (A-CORR-3 rule).
  function guardHook(fn, fallback) {
    if (typeof fn !== 'function') return null;
    return function guarded(...args) {
      try { return fn(...args); } catch (error) { return fallback; }
    };
  }

  const shellCache = new Map();
  function shellTypeFor(name) {
    if (!name) return null;
    if (shellCache.has(name)) return shellCache.get(name);
    if (name === 'NEWBIE') {
      const newbie = makeNewbieType();
      shellCache.set(name, newbie);
      return newbie;
    }
    const base = baseTypeFor(name);
    const kit = COMPAT_PROFILES[name] || 'KEEP';
    let shell;
    if (!base) {
      shell = {
        name,
        color: '#9e9e9e',
        desc: 'Arsenal shell — no native kit found',
        speed: CFG.FIGHTER_SPEED,
        startDx: 1,
        startDy: 0.55,
        noRage: true,
        arsenalShell: true,
        compatKit: 'SUPPRESS',
        init: () => {},
        update: () => {},
        draw: (c, f) => { drawSketchBlob(c, f.radius, f.color, 12); },
      };
    } else {
      // Real characters with compatible identity: native init/update/collide/
      // wall/damage hooks run as documented in the matrix. Rage variants stay
      // suppressed roster-wide via noRage (global ADAPT, documented).
      shell = {
        name: base.name,
        color: base.color,
        desc: base.desc,
        speed: CFG.FIGHTER_SPEED,
        startDx: base.startDx != null ? base.startDx : 1,
        startDy: base.startDy != null ? base.startDy : 0.55,
        noRage: true,
        arsenalShell: true,
        shellOf: base.name,
        compatKit: kit,
        init: (f) => { f.data = f.data || {}; try { if (base.init) base.init(f); } catch (error) {} },
        update: guardHook(base.update, undefined) || (() => {}),
        speedModifier: guardHook(base.speedModifier, 1),
        onWallBounce: guardHook(base.onWallBounce, undefined),
        onCollide: guardHook(base.onCollide, false),
        onTakeDamage: guardHook(base.onTakeDamage, undefined),
        draw: typeof base.draw === 'function'
          ? (c, f) => { try { base.draw(c, f); } catch (error) {} }
          : (c, f) => { drawSketchBlob(c, f.radius, f.color, 12); },
      };
    }
    shellCache.set(name, shell);
    return shell;
  }

  function roster() { return CANONICAL_32.map(shellTypeFor); }

  function ensureNewbieOnRoster() {
    if (typeof FighterTypes === 'undefined' || !FighterTypes) return;
    if (FighterTypes.some((t) => t && t.name === 'NEWBIE')) return;
    FighterTypes.push(shellTypeFor('NEWBIE'));
  }
  function dropNewbieFromRoster() {
    if (typeof FighterTypes === 'undefined' || !FighterTypes) return;
    const i = FighterTypes.findIndex((t) => t && t.name === 'NEWBIE' && t.arsenalOriginal);
    if (i >= 0) FighterTypes.splice(i, 1);
  }

  function beginSelection() {
    window.__apexArsenalSelectPending = true;
    ensureNewbieOnRoster();
    if (typeof goToSelect === 'function') goToSelect();
    else if (typeof window.goToSelect === 'function') window.goToSelect();
  }

  // Route the shared select screen's START into Arsenal mode with the picked
  // shells. Wraps window.startMatch (React bridge) — normal flow untouched.
  const baseStartMatch = typeof window.startMatch === 'function' ? window.startMatch : null;
  window.startMatch = function (...args) {
    if (window.__apexArsenalSelectPending) {
      window.__apexArsenalSelectPending = false;
      const p1 = typeof p1Selection !== 'undefined' ? p1Selection : null;
      const p2 = typeof p2Selection !== 'undefined' ? p2Selection : null;
      if (p1 && p2 && typeof window.startArsenalQuestMode === 'function') {
        window.startArsenalQuestMode(p1.name, p2.name);
        return;
      }
    }
    return baseStartMatch ? baseStartMatch.apply(this, args) : undefined;
  };

  // Leaving the select screen any other way cancels the pending Arsenal select.
  const baseGoToMenu = typeof window.goToMenu === 'function' ? window.goToMenu : null;
  window.goToMenu = function (...args) {
    window.__apexArsenalSelectPending = false;
    return baseGoToMenu ? baseGoToMenu.apply(this, args) : undefined;
  };

  window.beginArsenalQuestSelection = beginSelection;

  window.APEX_ARSENAL_SHELLS = {
    ids: CANONICAL_32,
    typeFor: shellTypeFor,
    roster,
    beginSelection,
    isPending: () => !!window.__apexArsenalSelectPending,
  };
  window.apexArsenalShellSelectRuntime = 'ready';
})();
