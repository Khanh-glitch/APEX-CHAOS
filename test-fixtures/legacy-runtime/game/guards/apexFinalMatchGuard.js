// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_FINAL_MATCH_RUNTIME_GUARD(){
  if (window.__apexFinalMatchRuntimeGuard) return;
  window.__apexFinalMatchRuntimeGuard = true;

  function restoreAllBattleAudio() {
    try { restoreBattleAudio(); } catch (error) {}
    try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (error) {}
    try {
      for (const audio of battleMediaElements || []) {
        if (audio && !audio.__apexMenuMusic) audio.volume = 1;
      }
    } catch (error) {}
  }

  function resetGalaxyRuntime(reason = 'reset') {
    const G = window.APEX_GALAXY;
    if (!G) {
      restoreAllBattleAudio();
      return;
    }
    try {
      for (const h of G.activeSounds || []) {
        if (h && typeof h.fadeOut === 'function') h.fadeOut(.08);
      }
    } catch (error) {}
    G.zones = [];
    G.trails = [];
    G.impact = null;
    G.split = null;
    G.planetImpacts = [];
    G.blackholes = [];
    G.morphFields = [];
    G.silenceTimer = 0;
    G.paused = false;
    for (const f of fighters || []) {
      if (!f?.data) continue;
      f.data.galaxyImpact = null;
      f.data.galaxyDivine = null;
      f.data.galaxyBluehole = null;
      f.data.galaxyBlueholeRefined = null;
      f.data.galaxyRemoved = false;
      if (f.name === 'GALAXY') f.data.galaxyState = 'READY';
      if (!f.data.galaxyImpact && !f.data.galaxyDivine && !f.data.galaxyBluehole && !f.data.galaxyBlueholeRefined) {
        f.data.positionLocked = false;
      }
    }
    restoreAllBattleAudio();
    if (reason && reason !== 'silent') console.info('[Apex Chaos] Galaxy runtime reset:', reason);
  }

  window.apexPauseGalaxyAudio = function(paused) {
    const G = window.APEX_GALAXY;
    if (G) G.paused = !!paused;
    if (!paused) restoreAllBattleAudio();
  };

  const prevStartSpecificMatchFinal = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts = {}) {
    try { window.apexStopMenuMusic?.(true); } catch (error) {}
    resetGalaxyRuntime('before-match-start');
    const result = prevStartSpecificMatchFinal(ft1, ft2, opts);
    restoreAllBattleAudio();
    try { if (window.APEX_GALAXY) window.APEX_GALAXY.paused = false; } catch (error) {}
    return result;
  };

  const prevEndMatchFinal = endMatch;
  endMatch = function(...args) {
    const result = prevEndMatchFinal.apply(this, args);
    resetGalaxyRuntime('match-end');
    return result;
  };

  const prevGoToMenuFinal = goToMenu;
  goToMenu = function(...args) {
    resetGalaxyRuntime('menu');
    return prevGoToMenuFinal.apply(this, args);
  };

  function applyRageHudGlow() {
    for (let i = 0; i < 2; i += 1) {
      const f = fighters?.[i];
      const fill = document.getElementById(`p${i+1}-hp`);
      if (!fill) continue;
      const wrap = fill.parentElement;
      if (f?.isRage) {
        const color = f.color || '#fff';
        fill.style.filter = 'brightness(1.28) saturate(1.16)';
        fill.style.boxShadow = `0 0 13px ${color}, 0 0 26px ${color}`;
        if (wrap) wrap.style.boxShadow = `0 0 14px ${color}`;
      } else {
        fill.style.filter = '';
        fill.style.boxShadow = '';
        if (wrap) wrap.style.boxShadow = '';
      }
    }
  }

  const prevUpdateHudFinal = updateHUD;
  updateHUD = function(...args) {
    const result = prevUpdateHudFinal.apply(this, args);
    applyRageHudGlow();
    return result;
  };

  const prevUpdateFinal = update;
  update = function(dt) {
    const result = prevUpdateFinal(dt);
    applyRageHudGlow();
    return result;
  };

  exposeApexGlobal('startSpecificMatch', startSpecificMatch);
  Object.assign(window, { startSpecificMatch, goToMenu });
})();
