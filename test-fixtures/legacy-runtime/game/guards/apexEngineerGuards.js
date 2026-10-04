// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_ENGINEER_LATE_BINDER(){
  if (window.__apexEngineerLateBinder) return;
  window.__apexEngineerLateBinder = true;
  const E = window.APEX_ENGINEER;
  if (!E) return;

  function ensureEngineerType() {
    if (!E.type || typeof FighterTypes === 'undefined') return null;
    const existing = fighterTypeByName('ENGINEER');
    if (existing) {
      Object.assign(existing, E.type);
      return existing;
    }
    FighterTypes.push(E.type);
    window.FighterTypes = FighterTypes;
    window.apexFighterTypes = FighterTypes;
    return E.type;
  }
  ensureEngineerType();

  const prevUpdate = update;
  update = function(dt) {
    const result = prevUpdate(dt);
    if (E.updateSystems) E.updateSystems(dt);
    return result;
  };

  const prevDrawProjectiles = drawProjectiles;
  drawProjectiles = function(ctx) {
    prevDrawProjectiles(ctx);
    if (E.drawWorld) E.drawWorld(ctx);
  };

  const prevStartSpecificMatch = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts = {}) {
    if (E.clearMatch) E.clearMatch();
    return prevStartSpecificMatch(ft1, ft2, opts);
  };

  const prevPopulateRoster = populateRoster;
  populateRoster = function() {
    const result = prevPopulateRoster();
    const grid = document.getElementById('roster-grid');
    const activeText = document.querySelector('#roster-tabs button.active')?.textContent || '';
    const ft = ensureEngineerType();
    if (grid && ft && activeText.includes('APEX') && !grid.querySelector('[data-fighter="ENGINEER"]')) {
      const card = document.createElement('div');
      card.className = 'fighter-card';
      card.dataset.fighter = ft.name;
      card.style.color = ft.color;
      const name = document.createElement('div');
      name.className = 'f-name';
      name.textContent = ft.name;
      const preview = document.createElement('canvas');
      preview.className = 'f-preview';
      preview.width = 140;
      preview.height = 96;
      preview.setAttribute('aria-label', 'ENGINEER battle visual preview');
      card.appendChild(name);
      card.appendChild(preview);
      card.onclick = () => selectFighter(ft, card);
      grid.appendChild(card);
      drawRosterPreview(preview, ft, 999);
    }
    return result;
  };

  window.APEX_ENGINEER_READY = true;
})();

// ===== ENGINEER WAR MACHINE PILOT DAMAGE GUARD =====
(function APEX_ENGINEER_WAR_MACHINE_PILOT_GUARD(){
  if (window.__apexEngineerWarMachinePilotGuard) return;
  window.__apexEngineerWarMachinePilotGuard = true;
  const previousTakeDamage = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source = null, label = '', statusDamage = false) {
    if (this?.name === 'ENGINEER') {
      const d = this.data?.engineer;
      if (d?.pilotingWarMachine) {
        const proxy = window.APEX_ENGINEER?.targetForDirected?.(this);
        if (proxy && proxy !== this && typeof proxy.takeDamage === 'function') {
          proxy.takeDamage(amount, source, label || 'war-machine-pilot-target', statusDamage);
        }
        this.hp = Math.max(1, this.hp || 1);
        updateHUD(true);
        return 0;
      }
      if (source !== this && Number.isFinite(amount) && amount > 0 && this.hp - amount <= 1) {
        if (window.APEX_ENGINEER?.tryPilotWarMachine?.(this)) return 0;
      }
    }
    const result = previousTakeDamage.call(this, amount, source, label, statusDamage);
    if (this?.name === 'ENGINEER' && this.hp <= 0 && window.APEX_ENGINEER?.tryPilotWarMachine?.(this)) {
      this.hp = Math.max(1, this.hp || 1);
      updateHUD(true);
      return 0;
    }
    return result;
  };
  const previousUpdateHud = updateHUD;
  updateHUD = function(force = false) {
    const result = previousUpdateHud(force);
    for (let i = 0; i < 2; i += 1) {
      const f = fighters?.[i];
      const d = f?.name === 'ENGINEER' ? f.data?.engineer : null;
      const armor = f?.data?.engineerVirtualShield;
      if (f?.name === 'ENGINEER' && armor?.amount > 0 && !d?.pilotingWarMachine) {
        const pct = clamp((armor.amount / Math.max(1, armor.max || armor.amount)) * 100, 0, 100);
        const fill = document.getElementById(`p${i+1}-hp`);
        const trail = document.getElementById(`p${i+1}-hp-loss`);
        if (fill) {
          fill.style.width = `${pct}%`;
          fill.style.background = 'linear-gradient(90deg, #ffffff, #e8fbff)';
          fill.style.boxShadow = '0 0 16px rgba(255,255,255,.95)';
        }
        updateHpLossTrail(fill, trail, pct);
        const text = document.getElementById(`p${i+1}-hp-text`);
        if (text) text.innerText = `${armor.amount.toFixed(1)} / ${Math.max(armor.max || armor.amount, 1).toFixed(1)}`;
      } else if (f?.name === 'ENGINEER' && !d?.pilotingWarMachine) {
        const fill = document.getElementById(`p${i+1}-hp`);
        if (fill) {
          fill.style.background = 'linear-gradient(90deg, #ffd36f, #f0a020 55%, #d86b16)';
          fill.style.boxShadow = '';
        }
      }
      if (!d?.pilotingWarMachine) continue;
      const wm = (d.structures || []).find(s => s.id === d.pilotWarMachineId && s.kind === 'war_machine' && !s.dead && s.hp > 0);
      if (!wm) continue;
      const pct = clamp((wm.hp / Math.max(1, wm.maxHp)) * 100, 0, 100);
      const fill = document.getElementById(`p${i+1}-hp`);
      const trail = document.getElementById(`p${i+1}-hp-loss`);
      updateHpLossTrail(fill, trail, pct);
      const text = document.getElementById(`p${i+1}-hp-text`);
      if (text) text.innerText = `${wm.hp.toFixed(1)} / ${wm.maxHp.toFixed(0)} WM`;
    }
    return result;
  };
})();

// ===== GALAXY x ENGINEER DRAW FAILSAFE =====
(function APEX_GALAXY_ENGINEER_DRAW_FAILSAFE(){
  if (window.__apexGalaxyEngineerDrawFailsafe) return;
  window.__apexGalaxyEngineerDrawFailsafe = true;

  function galEngActive() {
    return gameState === 'PLAYING'
      && (fighters || []).some(f => f?.name === 'GALAXY' && f.hp > 0)
      && (fighters || []).some(f => f?.name === 'ENGINEER' && f.hp > 0);
  }
  function clearGalaxySplit(reason = 'draw-failsafe') {
    const G = window.APEX_GALAXY;
    if (!G) return;
    G.split = null;
    for (const f of fighters || []) {
      if (f?.name !== 'GALAXY' || !f.data) continue;
      if (f.data.galaxyState === 'IMPACT') f.data.galaxyState = 'READY';
      if (!f.data.galaxyDivine && !f.data.galaxyImpact && !f.data.galaxyBluehole && !f.data.galaxyBlueholeRefined) f.data.positionLocked = false;
    }
    console.warn('[Apex Chaos] Galaxy/Engineer split cleared:', reason);
  }
  function sanitizeGalaxySplit() {
    if (!galEngActive()) return;
    const G = window.APEX_GALAXY;
    const split = G?.split;
    if (!split) return;
    const now = performance.now() / 1000;
    split.startedAt ||= now;
    split.maxLife = Number.isFinite(split.maxLife) ? Math.max(.1, split.maxLife) : 1;
    split.life = Math.min(Number.isFinite(split.life) ? split.life : split.maxLife, Math.max(0, split.maxLife - (now - split.startedAt)));
    if (!(split.quadrants instanceof Map)) split.quadrants = new Map();
    if (split.life <= 0) clearGalaxySplit('expired-split');
  }

  const prevDrawProjectilesSafe = drawProjectiles;
  drawProjectiles = function(ctx) {
    sanitizeGalaxySplit();
    try {
      return prevDrawProjectilesSafe(ctx);
    } catch (error) {
      if (!galEngActive()) throw error;
      clearGalaxySplit(error?.message || 'projectile-draw-error');
      return undefined;
    }
  };

  const prevFighterDrawSafe = Fighter.prototype.draw;
  Fighter.prototype.draw = function(ctx) {
    try {
      return prevFighterDrawSafe.call(this, ctx);
    } catch (error) {
      if (!galEngActive()) throw error;
      clearGalaxySplit(error?.message || 'fighter-draw-error');
      try {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.dir?.y || 0, this.dir?.x || 1));
        this.type?.draw?.(ctx, this);
        ctx.restore();
      } catch (_) {}
      return undefined;
    }
  };

  const prevUpdateSafe = update;
  update = function(dt) {
    sanitizeGalaxySplit();
    return prevUpdateSafe(dt);
  };
})();
