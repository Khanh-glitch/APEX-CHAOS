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
  };

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

  function beginSelection() {
    window.__apexArsenalSelectPending = true;
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
