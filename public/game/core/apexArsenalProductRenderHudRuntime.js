// Current Arsenal/Core Six render and HP-HUD seam.
//
// This deliberately replaces only the mixed Full Roster renderer/HUD behavior
// used by the current product. Collision and draw-error recovery remain on
// their transitional owners until their dedicated Phase 2A slices.
(function installArsenalProductRenderHud() {
  function syncArsenalPlayerHud() {
    // Current-product HUD DOM has one owner: APEX_COMBAT_HUD.
    if (window.APEX_COMBAT_HUD && window.APEX_COMBAT_HUD.syncVitals) window.APEX_COMBAT_HUD.syncVitals();
  }

  updateHUD = syncArsenalPlayerHud;

  draw = function drawArsenalProductFrame() {
    window.__apexRenderFrame = (window.__apexRenderFrame || 0) + 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    try {
      const shakeX = rand(-cameraShake, cameraShake);
      const shakeY = rand(-cameraShake, cameraShake);
      ctx.translate(GAME_SIZE / 2 + shakeX, GAME_SIZE / 2 + shakeY);
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(-GAME_SIZE / 2, -GAME_SIZE / 2);

      drawBackground(ctx);
      drawProjectiles(ctx);
      if (window.APEX_HERO_REWORK?.renderArenaWorldEffects) {
        window.APEX_HERO_REWORK.renderArenaWorldEffects(ctx, {
          stage: 'after-world-before-fighters',
          background: true,
          projectiles: true,
          particles: false,
          fighters: false,
        });
      }

      for (let i = 0; i < 2; i++) {
        const fighter = fighters[i];
        if (fighter && fighter.hp > 0 && typeof fighter.draw === 'function') fighter.draw(ctx);
      }
      for (const particle of particles) {
        if (particle && typeof particle.draw === 'function') particle.draw(ctx);
      }
      for (const shockwave of shockwaves) {
        if (!shockwave) continue;
        if (typeof shockwave.draw === 'function') {
          shockwave.draw(ctx);
        } else {
          ctx.save();
          ctx.globalAlpha = Number.isFinite(shockwave.alpha) ? shockwave.alpha : 0.7;
          ctx.strokeStyle = shockwave.color || '#ffffff';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(shockwave.x || 0, shockwave.y || 0, Math.max(1, shockwave.r || 10), 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
      for (const text of floatingTexts) {
        if (text && typeof text.draw === 'function') text.draw(ctx);
      }
      if (arenaFlash.a > 0) {
        ctx.fillStyle = `rgba(${arenaFlash.r},${arenaFlash.g},${arenaFlash.b},${arenaFlash.a})`;
        ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);
      }
    } finally {
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
    }

    updateHUD();
  };

  window.apexArsenalProductRenderHudRuntime = 'ready';
})();
