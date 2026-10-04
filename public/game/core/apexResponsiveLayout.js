// APEX CHAOS — Gold responsive layout family detection.
// Drives data-layout attribute on #battle-shell for CSS re-composition.
// Authority: docs/gold-ui/current/donors/battle-hud/index.html
// Three authored families: desk, land, port.
// NOT a uniform scale-down. Re-composition from real viewport.
(function apexResponsiveLayout() {
  if (window.apexResponsiveLayout === 'ready') return;

  const LANDSCAPE_HEIGHT_THRESHOLD = 500;
  const PORTRAIT_WIDTH_THRESHOLD = 500;

  function detectFamily() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isPortrait = h > w;

    if (isPortrait && w <= PORTRAIT_WIDTH_THRESHOLD) return 'port';
    if (!isPortrait && h <= LANDSCAPE_HEIGHT_THRESHOLD) return 'land';
    return 'desk';
  }

  let currentFamily = null;

  function apply() {
    const shell = document.getElementById('battle-shell');
    if (!shell) return;
    const family = detectFamily();
    if (family !== currentFamily) {
      currentFamily = family;
      shell.dataset.layout = family;
    }

    // Also detect mode (BOT/LOCAL) for responsive modifiers
    const mode = (window.APEX_ARSENAL && window.APEX_ARSENAL.state &&
      window.APEX_ARSENAL.state.battleMode) || 'LOCAL';
    shell.dataset.mode = mode === 'BOT' ? 'bot' : 'local2p';
  }

  function scheduleApply() {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
    else apply();
  }

  // Observe resize + orientation
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleApply, 50);
  }

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(scheduleApply, 100), { passive: true });

  // Apply on battle start
  const origBegin = window.apexBeginBattleAudioSession;
  window.apexBeginBattleAudioSession = function responsiveBegin() {
    apply();
    if (typeof origBegin === 'function') origBegin.call(this);
  };

  // Initial detection
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleApply);
  } else {
    scheduleApply();
  }

  window.apexResponsiveLayout = 'ready';
  window.__apexGetLayoutFamily = () => currentFamily;
})();