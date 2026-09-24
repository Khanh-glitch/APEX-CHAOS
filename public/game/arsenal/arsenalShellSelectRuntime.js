// ARSENAL QUEST V2 — Checkpoint A (V2_MAJOR_PASS_HANDOFF §A3).
// Canonical 32 fighter test shells, independently selectable for P1/P2.
// Shells reuse each fighter's existing draw identity / body art but disable
// native abilities, rage, passives, summons and attacks inside Arsenal:
// movement is normalized to Arsenal tuning and HP to Arsenal match HP.
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

  function baseTypeFor(name) {
    const live = (typeof FighterTypes !== 'undefined' && FighterTypes)
      ? FighterTypes.find(t => t && t.name === name) : null;
    return live || (window.__APEX_REMOVED_FIGHTER_TYPES || {})[name] || null;
  }

  const shellCache = new Map();
  function shellTypeFor(name) {
    if (!name) return null;
    if (shellCache.has(name)) return shellCache.get(name);
    const base = baseTypeFor(name);
    let shell;
    if (!base) {
      shell = {
        name,
        color: '#9e9e9e',
        desc: 'Arsenal test shell — native kit disabled',
        speed: CFG.FIGHTER_SPEED,
        startDx: 1,
        startDy: 0.55,
        noRage: true,
        arsenalShell: true,
        init: () => {},
        update: () => {},
        draw: (c, f) => { drawSketchBlob(c, f.radius, f.color, 12); },
      };
    } else {
      shell = {
        name: base.name,
        color: base.color,
        desc: 'Arsenal test shell — native kit disabled',
        speed: CFG.FIGHTER_SPEED,
        startDx: base.startDx != null ? base.startDx : 1,
        startDy: base.startDy != null ? base.startDy : 0.55,
        noRage: true,
        arsenalShell: true,
        shellOf: base.name,
        // Visual identity only: init seeds draw state; update is a no-op so no
        // native ability / passive / rage / attack logic ever runs in Arsenal.
        init: (f) => { f.data = f.data || {}; try { if (base.init) base.init(f); } catch (error) {} },
        update: () => {},
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
