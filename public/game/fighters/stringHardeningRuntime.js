// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function RESTORED_STRING_MAINLINE_HARDENING(){
  if (window.__apexRestoredStringMainlineHardening) return;
  window.__apexRestoredStringMainlineHardening = true;

  const STATE = window.APEX_AUTOBATTLE_STATE = window.APEX_AUTOBATTLE_STATE || {
    paused: false,
    lastFt1: null,
    lastFt2: null,
    lastOpts: null
  };

  function fmtHp(value) {
    return !Number.isFinite(value) ? 'INF' : Number(value).toFixed(1);
  }
  function parseHpInput(id) {
    const raw = String(document.getElementById(id)?.value || String(DEFAULT_MATCH_HP)).trim().toUpperCase();
    if (raw === 'INF' || raw === 'INFINITY' || raw === '∞') return Infinity;
    const n = Number(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? Math.max(100, n) : DEFAULT_MATCH_HP;
  }
  function parseDmgInput(id) {
    const n = Number(document.getElementById(id)?.value || 100);
    return clamp(Number.isFinite(n) ? n : 100, 100, 1000) / 100;
  }
  function setBattleControls(visible) {
    const controls = document.getElementById('battle-controls');
    if (!controls) return;
    controls.classList.toggle('hidden', !visible);
    controls.style.display = visible ? 'flex' : '';
    const btn = document.getElementById('battle-pause-btn');
    if (btn) btn.textContent = STATE.paused ? 'RESUME' : 'PAUSE';
  }
  function clearNinjaEvents(force = false) {
    const events = window.apexNinjaVisualEvents;
    if (!Array.isArray(events)) return;
    if (force || !fighters || !fighters.length) {
      events.length = 0;
      return;
    }
    const liveIds = new Set(fighters.filter(f => f && f.name === 'NINJA' && f.hp > 0).map(f => f.id));
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (!liveIds.has(events[i]?.ownerId)) events.splice(i, 1);
    }
    for (const f of fighters) {
      if (!f || f.name !== 'NINJA' || !f.visual?.ninja) continue;
      const v = f.visual.ninja;
      const now = performance.now() / 1000;
      if (v.arrivalStart && now - v.arrivalStart > 1.25) v.arrivalStart = -999;
      if (v.kunaiThrowStart && now - v.kunaiThrowStart > 1.25) v.kunaiThrowStart = -999;
    }
  }
  function randomizeOpeningDirections() {
    for (const f of fighters || []) {
      if (!f || !f.setDir) continue;
      const a = Math.random() * TAU;
      f.setDir(Math.cos(a), Math.sin(a));
    }
  }
  function applyAutoBattleSettings() {
    if (!fighters[0] || !fighters[1]) return;
    const hp = [parseHpInput('p1-hp-setting'), parseHpInput('p2-hp-setting')];
    const dmg = [parseDmgInput('p1-dmg-setting'), parseDmgInput('p2-dmg-setting')];
    for (let i = 0; i < 2; i += 1) {
      const f = fighters[i];
      f.maxHp = hp[i];
      f.hp = hp[i];
      f.data ||= {};
      f.data.autoBattleDamageMult = dmg[i];
    }
    updateHUD();
  }

  const prevHud = updateHUD;
  updateHUD = function() {
    if (!fighters[0] || !fighters[1]) return;
    for (let i = 0; i < 2; i += 1) {
      const f = fighters[i];
      const hpEl = document.getElementById(`p${i+1}-hp`);
      const textEl = document.getElementById(`p${i+1}-hp-text`);
      if (hpEl) {
        const pct = !Number.isFinite(f.maxHp) ? 100 : clamp((f.hp / Math.max(1, f.maxHp)) * 100, 0, 140);
        updateHpLossTrail(hpEl,document.getElementById(`p${i+1}-hp-loss`),Math.min(100,pct));
      }
      if (textEl) textEl.innerText = `${fmtHp(f.hp)} / ${fmtHp(f.maxHp)}`;
      const rageEl = document.getElementById(`p${i+1}-rage`);
      if (rageEl) {
        rageEl.style.opacity = f.isRage ? 1 : 0;
        rageEl.style.display = f.isRage ? 'block' : 'none';
      }
    }
  };

  const prevDrawFighterNoTrail = Fighter.prototype.draw;
  Fighter.prototype.draw = function(ctx) {
    const oldTrail = this.trail;
    this.trail = [];
    try {
      return prevDrawFighterNoTrail.call(this, ctx);
    } finally {
      this.trail = oldTrail;
    }
  };

  const prevDamageAutoSettings = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source = null, label = '', statusDamage = false) {
    let adjusted = amount;
    if (source && source !== this && source.data?.autoBattleDamageMult) {
      adjusted *= source.data.autoBattleDamageMult;
    }
    const result = prevDamageAutoSettings.call(this, adjusted, source, label, statusDamage);
    if (this.hp > 0 && !this.isRage && !this.type?.noRage && Number.isFinite(this.maxHp) && this.hp <= this.maxHp * 0.5) {
      this.isRage = true;
      this.rageStartHp = this.hp;
      try { playFighterSound(this, 'skill'); } catch (error) {}
      try { emitParticles(this.x, this.y, this.color, 60, 540, 7, 1.2, 'square'); spawnShockwave(this.x, this.y, this.color, 190); } catch (error) {}
      if (this.type?.onRage) this.type.onRage(this);
      updateHUD();
    }
    return result;
  };

  const prevUpdatePause = update;
  update = function(dt) {
    if (STATE.paused || window.APEX_GALAXY?.paused) {
      clearNinjaEvents(false);
      updateHUD();
      return;
    }
    clearNinjaEvents(false);
    return prevUpdatePause(dt);
  };

  const prevStartSpecificRestored = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts = {}) {
    STATE.paused = false;
    if (window.APEX_GALAXY) window.APEX_GALAXY.paused = false;
    clearNinjaEvents(true);
    STATE.lastFt1 = ft1;
    STATE.lastFt2 = ft2;
    STATE.lastOpts = {...opts};
    const result = prevStartSpecificRestored(ft1, ft2, opts);
    if (!opts.trial) applyAutoBattleSettings();
    randomizeOpeningDirections();
    setBattleControls(!opts.trial);
    return result;
  };

  const prevGoMenuRestored = goToMenu;
  goToMenu = function() {
    STATE.paused = false;
    if (window.APEX_GALAXY) window.APEX_GALAXY.paused = false;
    clearNinjaEvents(true);
    setBattleControls(false);
    return prevGoMenuRestored();
  };
  const prevGoSelectRestored = goToSelect;
  goToSelect = function() {
    STATE.paused = false;
    clearNinjaEvents(true);
    setBattleControls(false);
    return prevGoSelectRestored();
  };
  const prevEndMatchRestored = endMatch;
  endMatch = function() {
    setBattleControls(false);
    clearNinjaEvents(true);
    return prevEndMatchRestored();
  };

  window.toggleAutoBattlePause = function() {
    if (gameState !== 'PLAYING' && gameState !== 'COUNTDOWN') return;
    STATE.paused = !STATE.paused;
    if (window.APEX_GALAXY) window.APEX_GALAXY.paused = STATE.paused;
    try { window.apexPauseGalaxyAudio?.(STATE.paused); } catch (error) {}
    const btn = document.getElementById('battle-pause-btn');
    if (btn) btn.textContent = STATE.paused ? 'RESUME' : 'PAUSE';
  };
  window.restartAutoBattle = function() {
    const ft1 = fighters[0]?.type || STATE.lastFt1;
    const ft2 = fighters[1]?.type || STATE.lastFt2;
    if (!ft1 || !ft2) return;
    STATE.paused = false;
    if (window.APEX_GALAXY) window.APEX_GALAXY.paused = false;
    clearNinjaEvents(true);
    startSpecificMatch(ft1, ft2, { countdown:false, tournament:false });
  };
  window.exitAutoBattle = function() {
    STATE.paused = false;
    if (window.APEX_GALAXY) window.APEX_GALAXY.paused = false;
    clearNinjaEvents(true);
    setBattleControls(false);
    goToMenu();
  };
  Object.assign(window.apexReactBridge || {}, {
    goToMenu,
    goToSelect,
    startMatch,
    startSpecificMatch,
    toggleAutoBattlePause: window.toggleAutoBattlePause,
    restartAutoBattle: window.restartAutoBattle,
    exitAutoBattle: window.exitAutoBattle
  });
  Object.assign(window, window.apexReactBridge || {});
  window.FighterTypes = FighterTypes;
  window.apexFighterTypes = FighterTypes;
})();
