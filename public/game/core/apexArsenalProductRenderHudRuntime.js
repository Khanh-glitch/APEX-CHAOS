// Current Arsenal/Core Six render and HP-HUD seam.
//
// This deliberately replaces only the mixed Full Roster renderer/HUD behavior
// used by the current product. Anchor collision has its own current seam;
// draw-error recovery remains on its transitional owner until Phase 2A.3.
(function installArsenalProductRenderHud() {
  function updateArsenalPlayerHud() {
    if (!fighters[0] || !fighters[1]) return;

    for (let i = 0; i < 2; i++) {
      const fighter = fighters[i];
      const maxHp = Number.isFinite(fighter.maxHp) && fighter.maxHp > 0 ? fighter.maxHp : 1;
      const hp = Number.isFinite(fighter.hp) ? Math.max(0, fighter.hp) : 0;
      const percent = clamp((hp / maxHp) * 100, 0, 100);
      const fill = document.getElementById(`p${i + 1}-hp`);
      const text = document.getElementById(`p${i + 1}-hp-text`);
      const rage = document.getElementById(`p${i + 1}-rage`);

      if (fill) fill.style.width = `${percent}%`;
      if (text) text.innerText = `${hp.toFixed(1)} / ${maxHp.toFixed(0)}`;
      if (rage) {
        rage.style.opacity = fighter.isRage ? 1 : 0;
        rage.style.display = fighter.isRage ? 'block' : 'none';
      }
    }
  }

  updateHUD = updateArsenalPlayerHud;

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
