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

  function requestGoldNavigation(target, options) {
    const nav = window.APEX_GOLD_SHELL_NAVIGATE;
    if (typeof nav === 'function') return nav(target, options || {}) !== false;
    // Shell scripts may still be mounting while a production runtime requests
    // navigation. Queue ONE semantic destination; never resurrect legacy DOM.
    window.__apexPendingGoldNavigation = { target, options: options || {} };
    return false;
  }

  function beginSelection(opts = {}) {
    const requested = String(opts.mode || window.__apexArsenalSelectionMode || 'local').toLowerCase();
    const mode = requested === 'bot' ? 'bot' : 'local';
    window.__apexArsenalSelectionMode = mode;
    window.__apexArsenalBotBattle = mode === 'bot';
    window.__apexArsenalFreeBattle = mode === 'local';
    window.__apexArsenalSelectPending = true;
    requestGoldNavigation('fighter', { mode });
    try { window.APEX_HERO_REWORK?.patchFrostProductCopy?.(); } catch (error) {}
    return true;
  }

  function canPublicSelect(name) {
    const id = canonicalId(name);
    if (!id) return false;
    // ONE selection authority. The production meta owns playability, ownership
    // AND the owner-playtest selection override; the shell adapter must never
    // re-derive them. The old form re-checked `meta.owns()` and therefore
    // rejected every unlocked-but-unowned Core Six hero, so window.startMatch()
    // resolved false and Local 1v1 never reached READY (owner-visible: Local
    // and BOT looked identical because Local never started its own HUD).
    const meta = window.APEX_ARSENAL_META;
    if (meta && typeof meta.canPublicSelect === 'function') return meta.canPublicSelect(id) === true;
    // Cold boot fallback: the meta runtime may not be installed yet, so the
    // product roster decides. Ownership is NEVER guessed here.
    return isPublicPlayableId(id);
  }

  // The shared select screen is the only player-facing match entry point.
  // It cannot fall through into the removed classic roster/match launcher.
  //
  // BOT OPPONENT IDENTITY — ONE PRODUCTION AUTHORITY (2026-10-05 correction
  // slice). The accepted Arsenal CPU opponent is a single production truth.
  // Presentation (fighter pick, battle-entry transition, handoff payload, HUD
  // identity) must DERIVE from this value; nothing may hardcode a second BOT
  // identity for the same match.
  const BOT_OPPONENT_ID = 'ROBOT';
  window.startMatch = function startProductBattle(...args) {
    if (!window.__apexArsenalSelectPending) return Promise.resolve(false);
    const mode = window.__apexArsenalSelectionMode === 'bot' ? 'BOT' : 'LOCAL';
    const goldHosted = window.__apexGoldBattleHosted === true;
    window.__apexArsenalSelectPending = false;
    const p1 = typeof p1Selection !== 'undefined' ? p1Selection : null;
    const p2 = typeof p2Selection !== 'undefined' ? p2Selection : null;

    // Legacy selection is a fallback ONLY for legacy entry. A Gold-hosted
    // handoff already owns fighter selection and must never resurrect the old
    // picker while its battle runtimes are loading.
    const fail = () => {
      if (!goldHosted) beginSelection({ mode: mode === 'BOT' ? 'bot' : 'local' });
      return false;
    };
    if (!p1 || !p2 || !canPublicSelect(p1.name) || !canPublicSelect(p2.name)) {
      return Promise.resolve(fail());
    }

    window.__apexArsenalBattleProfile = mode;
    window.__apexArsenalBotBattle = false;
    window.__apexArsenalFreeBattle = false;

    const launch = () => {
      if (typeof window.startArsenalBattleMode !== 'function') return fail();
      return window.startArsenalBattleMode(p1.name, p2.name) === true;
    };

    // READY CONTRACT: every branch resolves only after the real Arsenal match
    // has either started or definitively failed. Gold transition reveal awaits
    // this Promise and therefore cannot show donor defaults / old picker UI.
    if (window.apexArsenalGameplayBarrierSync?.('match')) {
      return Promise.resolve(launch());
    }
    if (window.apexArsenalGameplayBarrier) {
      return Promise.resolve(window.apexArsenalGameplayBarrier('match'))
        .then((ready) => ready ? launch() : false)
        .catch(() => false);
    }
    const ensure = window.__apexEnsureDeferredRuntimes;
    if (typeof ensure === 'function') {
      return Promise.resolve(ensure('arsenalProduct'))
        .then(() => launch())
        .catch(() => false);
    }
    return Promise.resolve(launch());
  };

  window.goToMenu = function goToProductMenu() {
    window.__apexArsenalSelectPending = false;
    window.__apexArsenalBotBattle = false;
    window.__apexArsenalFreeBattle = false;
    requestGoldNavigation('home');
    return true;
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
    // The one BOT opponent authority: the production CPU identity every layer
    // (presentation, transition, handoff, HUD, spawned fighter) derives from.
    botOpponentId: () => BOT_OPPONENT_ID,
  };
  window.apexArsenalShellSelectRuntime = 'ready';
})();
