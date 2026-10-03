// Shared select-screen adapter for the single-authority pre-pilot roster.
// Product visibility and playability are derived only from
// src/game/productSurface.js; no historical roster is kept here.
(function apexArsenalShellSelectRuntime() {
  if (window.apexArsenalShellSelectRuntime === 'ready') return;
  const CFG = window.APEX_ARSENAL_CONFIG;

  function canonicalId(name) {
    const id = String(name || '').trim().toUpperCase();
    if (id === 'CRYSTALA') return 'CRYSTAL';
    if (id === 'FROST') return 'ICE';
    return id;
  }

  function productIds(key) {
    const ids = window.APEX_PRODUCT_SURFACE?.roster?.[key];
    return Array.isArray(ids) ? ids.slice() : [];
  }
  function visibleIds() { return productIds('visibleIds'); }
  function playableIds() { return productIds('playableIds'); }
  function isVisiblePublicId(name) { return visibleIds().includes(canonicalId(name)); }
  function isPublicPlayableId(name) { return playableIds().includes(canonicalId(name)); }

  function baseTypeFor(name) {
    const live = (typeof FighterTypes !== 'undefined' && FighterTypes)
      ? FighterTypes.find((type) => type && type.name === name) : null;
    if (live) return live;
    // Some locked future shells are retained only for saved-data resolution.
    return (window.__APEX_REMOVED_FIGHTER_TYPES || {})[name] || null;
  }

  function makeReworkShell(name) {
    const base = baseTypeFor(name);
    const registry = window.APEX_HERO_REWORK_REGISTRY;
    const label = registry?.displayNameFor ? registry.displayNameFor(name) : name;
    return {
      name,
      color: (base && base.color) || '#c8c2b4',
      desc: `Hero Rework — ${label}`,
      speed: CFG.FIGHTER_SPEED,
      startDx: (base && base.startDx != null) ? base.startDx : 1,
      startDy: (base && base.startDy != null) ? base.startDy : 0.55,
      noRage: true,
      arsenalShell: true,
      __hrHero: name,
      compatKit: 'REWORK',
      init: (fighter) => { fighter.data = fighter.data || {}; },
      update: (fighter, enemy, dt) => {
        if (window.APEX_HERO_REWORK?.shellUpdate) {
          window.APEX_HERO_REWORK.shellUpdate(fighter, enemy, dt);
        }
      },
    };
  }

  const shellCache = new Map();
  function shellTypeFor(name) {
    const id = canonicalId(name);
    if (!id || !isVisiblePublicId(id)) return null;
    if (shellCache.has(id)) return shellCache.get(id);
    const shell = makeReworkShell(id);
    shellCache.set(id, shell);
    return shell;
  }

  // Pickers receive the playable roster from the product authority. The full
  // visible roster remains resolvable for locked cards and historical saves.
  function roster() {
    return playableIds().map(shellTypeFor).filter(Boolean);
  }

  function beginSelection(opts = {}) {
    const requested = String(opts.mode || window.__apexArsenalSelectionMode || 'local').toLowerCase();
    const mode = requested === 'bot' ? 'bot' : 'local';
    window.__apexArsenalSelectionMode = mode;
    window.__apexArsenalBotBattle = mode === 'bot';
    window.__apexArsenalFreeBattle = mode === 'local';
    window.__apexArsenalSelectPending = true;
    if (typeof goToSelect === 'function') goToSelect();
    else window.goToSelect?.();
    try { window.APEX_HERO_REWORK?.patchFrostProductCopy?.(); } catch (error) {}
  }

  function canPublicSelect(name) {
    const id = canonicalId(name);
    if (!isPublicPlayableId(id)) return false;
    const meta = window.APEX_ARSENAL_META;
    return !meta || typeof meta.owns !== 'function' || meta.owns(id);
  }

  // The shared select screen is the only player-facing match entry point.
  // It cannot fall through into the removed classic roster/match launcher.
  window.startMatch = function startProductBattle(...args) {
    if (!window.__apexArsenalSelectPending) return undefined;
    const mode = window.__apexArsenalSelectionMode === 'bot' ? 'BOT' : 'LOCAL';
    window.__apexArsenalSelectPending = false;
    const p1 = typeof p1Selection !== 'undefined' ? p1Selection : null;
    const p2 = typeof p2Selection !== 'undefined' ? p2Selection : null;
    if (!p1 || !p2 || !canPublicSelect(p1.name) || !canPublicSelect(p2.name)) {
      beginSelection({ mode: mode === 'BOT' ? 'bot' : 'local' });
      return;
    }
    window.__apexArsenalBattleProfile = mode;
    window.__apexArsenalBotBattle = false;
    window.__apexArsenalFreeBattle = false;
    const launch = () => {
      if (typeof window.startArsenalBattleMode === 'function') {
        window.startArsenalBattleMode(p1.name, p2.name);
      } else {
        beginSelection({ mode: mode === 'BOT' ? 'bot' : 'local' });
      }
    };
    if (window.apexArsenalGameplayBarrierSync?.('match')) { launch(); return; }
    if (window.apexArsenalGameplayBarrier) {
      window.apexArsenalGameplayBarrier('match').then((ready) => { if (ready) launch(); });
      return;
    }
    const ensure = window.__apexEnsureDeferredRuntimes;
    if (typeof ensure === 'function') ensure('arsenalProduct').then(launch).catch(() => {});
    else launch();
  };

  const baseGoToMenu = typeof window.goToMenu === 'function' ? window.goToMenu : null;
  window.goToMenu = function goToProductMenu(...args) {
    window.__apexArsenalSelectPending = false;
    window.__apexArsenalBotBattle = false;
    window.__apexArsenalFreeBattle = false;
    return baseGoToMenu ? baseGoToMenu.apply(this, args) : undefined;
  };

  window.beginArsenalBattleSelection = beginSelection;
  window.APEX_ARSENAL_SHELLS = {
    ids: visibleIds(),
    visibleIds: visibleIds(),
    playableIds: playableIds(),
    isVisible: isVisiblePublicId,
    isPlayable: isPublicPlayableId,
    typeFor: shellTypeFor,
    roster,
    beginSelection,
    canPublicSelect,
    isPending: () => !!window.__apexArsenalSelectPending,
  };
  window.apexArsenalShellSelectRuntime = 'ready';
})();
