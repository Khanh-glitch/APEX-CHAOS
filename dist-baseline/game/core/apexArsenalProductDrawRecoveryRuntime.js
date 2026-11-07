// Current Arsenal draw-error recovery seam.
//
// This preserves only the error boundary that the current product previously
// inherited from apexRuntimeStability.js. It intentionally does not mutate
// fighters or prune gameplay/VFX collections.
(function installArsenalProductDrawRecovery() {
  const rawDraw = draw;

  draw = function drawArsenalProductRecovered() {
    try {
      return rawDraw();
    } catch (error) {
      console.error('[Arsenal draw recovered]', error);
      try {
        if (ctx && ctx.setTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (ctx) {
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          ctx.filter = 'none';
        }
        if (typeof updateHUD === 'function') updateHUD();
      } catch (_) {}
      return undefined;
    }
  };

  window.apexArsenalProductDrawRecoveryRuntime = 'ready';
})();
