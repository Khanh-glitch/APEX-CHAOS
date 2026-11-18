// Current Arsenal/Core Six render and HP-HUD seam.
//
// This deliberately replaces only the mixed Full Roster renderer/HUD behavior
// used by the current product. Collision and draw-error recovery remain on
// their transitional owners until their dedicated Phase 2A slices.
(function installArsenalProductRenderHud() {
  function isGoldBattleHudActive() {
    const body = document.body;
    return !!(body && (body.classList.contains('battle-hud-open') || body.classList.contains('battle-open')) && window.APEX_GOLD_HUD);
  }

  function syncArsenalPlayerHud() {
    // When Gold Battle HUD owns presentation, skip hidden legacy DOM dirtying.
    if (isGoldBattleHudActive()) return;
    if (window.APEX_COMBAT_HUD && window.APEX_COMBAT_HUD.syncVitals) window.APEX_COMBAT_HUD.syncVitals();
  }

  updateHUD = syncArsenalPlayerHud;

  draw = function drawArsenalProductFrame() {
    window.__apexRenderFrame = (window.__apexRenderFrame || 0) + 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    try {
      const shakeX = cameraShake > 0.01 ? rand(-cameraShake, cameraShake) : 0;
      const shakeY = cameraShake > 0.01 ? rand(-cameraShake, cameraShake) : 0;
      const freeBattleActive = gameState === 'ARSENAL'
        && !!(window.APEX_BEYOND_COMBAT && window.APEX_BEYOND_COMBAT.isFreeBattleEligible && window.APEX_BEYOND_COMBAT.isFreeBattleEligible());
      const beyondVfx = freeBattleActive ? window.APEX_BEYOND_VFX : null;
      const cam = (beyondVfx && typeof beyondVfx.getCameraTransform === 'function')
        ? beyondVfx.getCameraTransform(cameraZoom, shakeX, shakeY)
        : null;
      const focusX = cam && Number.isFinite(cam.focusX) ? cam.focusX : GAME_SIZE * 0.5;
      const focusY = cam && Number.isFinite(cam.focusY) ? cam.focusY : GAME_SIZE * 0.5;
      const zoom = cam && Number.isFinite(cam.zoom) ? cam.zoom : cameraZoom;
      const offsetX = cam && Number.isFinite(cam.offsetX) ? cam.offsetX : shakeX;
      const offsetY = cam && Number.isFinite(cam.offsetY) ? cam.offsetY : shakeY;

      // Publish live world-to-screen camera authority so Frost ice, Mirror
      // distortion, and weapon foregrounds never desync during shake or zoom.
      const camView = window.__apexCameraView || (window.__apexCameraView = {});
      camView.shakeX = offsetX;
      camView.shakeY = offsetY;
      camView.zoom = zoom;
      camView.focusX = focusX;
      camView.focusY = focusY;

      ctx.translate(GAME_SIZE * 0.5 + offsetX, GAME_SIZE * 0.5 + offsetY);
      ctx.scale(zoom, zoom);
      ctx.translate(-focusX, -focusY);

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

      if (beyondVfx && typeof beyondVfx.drawFighterUnderlay === 'function') {
        beyondVfx.drawFighterUnderlay(ctx);
      }

      for (let i = 0; i < 2; i++) {
        const fighter = fighters[i];
        if (fighter && fighter.hp > 0 && typeof fighter.draw === 'function') {
          window.APEX_RETAINED_PRESENTATION?.prepare(fighter);
          fighter.draw(ctx);
        }
      }

      if (beyondVfx && typeof beyondVfx.drawFighterOverlay === 'function') {
        beyondVfx.drawFighterOverlay(ctx);
      }

      if (window.APEX_ROBOT_PRESENTATION && typeof window.APEX_ROBOT_PRESENTATION.renderArenaTacticalOverlay === 'function') {
        window.APEX_ROBOT_PRESENTATION.renderArenaTacticalOverlay(ctx);
      }
      for (let i = 0, len = particles.length; i < len; i++) {
        const particle = particles[i];
        if (particle && typeof particle.draw === 'function') particle.draw(ctx);
      }
      for (let i = 0, len = shockwaves.length; i < len; i++) {
        const shockwave = shockwaves[i];
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
      for (let i = 0, len = floatingTexts.length; i < len; i++) {
        const text = floatingTexts[i];
        if (text && typeof text.draw === 'function') text.draw(ctx);
      }
      if (arenaFlash.a > 0) {
        ctx.fillStyle = `rgba(${arenaFlash.r},${arenaFlash.g},${arenaFlash.b},${arenaFlash.a})`;
        ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);
      }
      // CP3: no head tags after the flash — side identity is the
      // silhouette edge composited with each fighter above.
    } finally {
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
    }

    if (!isGoldBattleHudActive()) {
      updateHUD();
      window.APEX_COMBAT_HUD?.flushFrame();
    }
  };

  window.apexArsenalProductRenderHudRuntime = 'ready';
})();
