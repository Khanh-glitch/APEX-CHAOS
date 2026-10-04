// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_GALAXY_DIVINE_STOP_MOTION_FINAL_GUARD(){
  if (window.__apexGalaxyDivineStopMotionFinalGuard) return;
  window.__apexGalaxyDivineStopMotionFinalGuard = true;

  function live(f) { return f && f.hp > 0; }
  function enemyOfGalaxy(g) { return (fighters || []).find(f => live(f) && f !== g && !f.data?.galaxyRemoved) || null; }
  function activeDivineFreeze() {
    if (gameState !== 'PLAYING') return null;
    const galaxy = (fighters || []).find(f => live(f) && f.name === 'GALAXY' && (f.data?.galaxyDivine?.worldFreeze || 0) > 0);
    return galaxy ? { galaxy, enemy:enemyOfGalaxy(galaxy) } : null;
  }

  const soccerState = window.APEX_SOCCER;
  if (soccerState?.preUpdate) {
    const prevSoccerPreUpdate = soccerState.preUpdate;
    soccerState.preUpdate = function(dt) {
      if (activeDivineFreeze()) return false;
      return prevSoccerPreUpdate(dt);
    };
  }

  const prevStopMotionUpdate = update;
  update = function(dt) {
    const frozen = activeDivineFreeze();
    if (!frozen) return prevStopMotionUpdate(dt);
    if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - dt);
      dt *= 0.1;
    }
    if (frozen.galaxy?.type?.update) frozen.galaxy.type.update(frozen.galaxy, frozen.enemy, dt);
    updateHUD();
    if (fighters[0]?.hp <= 0 || fighters[1]?.hp <= 0) endMatch();
  };
})();

// ===== GALAXY CINEMATIC RECOVERY GUARD =====
(function APEX_GALAXY_CINEMATIC_RECOVERY_GUARD(){
  if (window.__apexGalaxyCinematicRecoveryGuard) return;
  window.__apexGalaxyCinematicRecoveryGuard = true;
  const previousUpdate = update;
  update = function(dt) {
    const result = previousUpdate(dt);
    const G = window.APEX_GALAXY;
    if (gameState === 'PLAYING' && G) {
      const active = (fighters || []).some(f => f && f.name === 'GALAXY' && f.hp > 0 && (f.data?.galaxyDivine || f.data?.galaxyImpact || f.data?.galaxyBluehole || f.data?.galaxyBlueholeRefined));
      const controlsPaused = document.getElementById('battle-pause-btn')?.textContent === 'RESUME';
      if (!active && G.paused && !controlsPaused) {
        G.paused = false;
        try { window.apexPauseGalaxyAudio?.(false); } catch (error) {}
      }
      for (const f of fighters || []) {
        if (!f || f.name !== 'GALAXY') continue;
        if (!f.data?.galaxyDivine && !f.data?.galaxyImpact && !f.data?.galaxyBluehole && !f.data?.galaxyBlueholeRefined) {
          if (f.data) {
            f.data.positionLocked = false;
            if (f.data.galaxyState === 'DIVINE' || f.data.galaxyState === 'IMPACT') f.data.galaxyState = 'READY';
          }
        }
      }
    }
    return result;
  };
})();

// ===== GALAXY IMPACT x ENGINEER FREEZE GUARD =====
(function APEX_GALAXY_ENGINEER_IMPACT_GUARD(){
  if (window.__apexGalaxyEngineerImpactGuard) return;
  window.__apexGalaxyEngineerImpactGuard = true;
  const guardNowSec = () => performance.now() / 1000;

  function galaxyImpactWithEngineerActive(G) {
    if (!G || gameState !== 'PLAYING') return false;
    const hasEngineer = (fighters || []).some(f => f && f.name === 'ENGINEER' && f.hp > 0);
    if (!hasEngineer) return false;
    const hasImpactZone = (G.zones || []).some(z => z && (z.type === 'galaxy_impact_burst' || z.type === 'galaxy_planet_impact'));
    return !!(G.impact || G.split || hasImpactZone || (fighters || []).some(f => f && f.name === 'GALAXY' && f.data?.galaxyImpact));
  }

  function clearImpactState(G, reason = 'guard') {
    if (!G) return;
    G.impact = null;
    G.split = null;
    for (const f of fighters || []) {
      if (!f || f.name !== 'GALAXY') continue;
      if (f.data) {
        f.data.galaxyImpact = null;
        if (f.data.galaxyState === 'IMPACT') f.data.galaxyState = 'READY';
        if (!f.data.galaxyDivine && !f.data.galaxyBluehole && !f.data.galaxyBlueholeRefined) f.data.positionLocked = false;
      }
    }
    if (G.paused) {
      G.paused = false;
      try { window.apexPauseGalaxyAudio?.(false); } catch (error) {}
    }
    console.warn('[Apex Chaos] Galaxy impact recovery guard cleared stale impact state:', reason);
  }

  function enforceImpactTimeouts(G) {
    if (!G || gameState !== 'PLAYING') return;
    const now = guardNowSec();
    for (const f of fighters || []) {
      const im = f?.name === 'GALAXY' ? f.data?.galaxyImpact : null;
      if (!im) continue;
      im.startedAt ||= now;
      const maxCharge = im.maxTimer || im.chargeTime || 5;
      const elapsed = now - im.startedAt;
      if (elapsed > maxCharge + 1.25) clearImpactState(G, 'stale-charge');
    }
    if (G.impact?.charge) {
      G.impact.startedAt ||= now;
      if (now - G.impact.startedAt > (G.impact.maxTimer || 5) + 1.25) clearImpactState(G, 'stale-impact-vfx');
    }
    if (G.split?.life > 0) {
      G.split.startedAt ||= now;
      const realLife = Math.max(0, (G.split.maxLife || 5) - (now - G.split.startedAt));
      G.split.life = Math.min(G.split.life, realLife);
      if (G.split.life <= 0) {
        G.split = null;
        for (const f of fighters || []) if (f?.data && !f.data.galaxyDivine && !f.data.galaxyImpact && !f.data.galaxyBluehole && !f.data.galaxyBlueholeRefined) f.data.positionLocked = false;
      }
    }
  }

  const previousUpdate = update;
  update = function(dt) {
    const G = window.APEX_GALAXY;
    try {
      const result = previousUpdate(dt);
      enforceImpactTimeouts(G);
      return result;
    } catch (error) {
      if (!galaxyImpactWithEngineerActive(G)) throw error;
      clearImpactState(G, error?.message || 'impact-runtime-error');
      return undefined;
    }
  };
})();
