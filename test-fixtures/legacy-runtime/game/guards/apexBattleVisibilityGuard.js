// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_BATTLE_SCREEN_VISIBILITY_GUARD(){
  if (window.__apexBattleScreenVisibilityGuard) return;
  window.__apexBattleScreenVisibilityGuard = true;
  function forceBattleScreens() {
    if (gameState !== 'PLAYING' && gameState !== 'COUNTDOWN') return;
    document.getElementById('menu-screen')?.classList.add('hidden');
    document.getElementById('select-screen')?.classList.add('hidden');
    document.getElementById('tournament-screen')?.classList.add('hidden');
    document.getElementById('end-screen')?.classList.add('hidden');
    const hud = document.getElementById('hud');
    if (hud) hud.style.opacity = 1;
  }
  const prevStartSpecificVisibility = startSpecificMatch;
  startSpecificMatch = function(...args) {
    const result = prevStartSpecificVisibility.apply(this, args);
    forceBattleScreens();
    requestAnimationFrame(forceBattleScreens);
    setTimeout(forceBattleScreens, 60);
    return result;
  };
  const prevUpdateVisibility = update;
  update = function(dt) {
    if (gameState === 'PLAYING' || gameState === 'COUNTDOWN') forceBattleScreens();
    return prevUpdateVisibility(dt);
  };
  Object.assign(window.apexReactBridge || {}, { startSpecificMatch });
  Object.assign(window, window.apexReactBridge || {}, { startSpecificMatch });
})();
