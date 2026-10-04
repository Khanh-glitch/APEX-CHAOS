// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_SOCCER_RUNTIME_BRIDGE(){
  const state=window.APEX_SOCCER;
  if(!state?.preUpdate || window.__apexSoccerRuntimeBridge) return;
  window.__apexSoccerRuntimeBridge=true;
  const previousUpdate=update;
  update=function(dt){
    if(state.preUpdate(dt)) return;
    const result=previousUpdate(dt);
    state.updateInspector?.();
    return result;
  };
})();

// ===== SOCCER POWER / UX UPDATE: cooldown kickback, readable dodge, roster tabs, HUD impact =====
(function APEX_SOCCER_POWER_UX_UPDATE(){
  const S = window.APEX_SOCCER;
  if (!S || window.__apexSoccerPowerUxUpdate) return;
  window.__apexSoccerPowerUxUpdate = true;
  const C = S.constants || {};
  const FEATURED_FIGHTERS = ['ICE', 'STRING', 'GALAXY', 'SOCCER', 'NINJA', 'SHOTGUN'];
  let rosterMode = 'featured';
  let lastHudSignature = '';
  let nextHudRefresh = 0;

  function live(f){ return f && f.hp > 0; }
  function enemyOfSoccer(f){ return fighters.find(q => live(q) && q !== f && !q.data?.galaxyRemoved) || null; }
  function soccerBallOf(f){ return f?.name === 'SOCCER' ? f.data?.soccerBall : null; }
  function setSoccerFacing(f,dir){
    const n=norm(dir.x,dir.y);
    if(!Number.isFinite(n.x)||!Number.isFinite(n.y))return;
    f.data.soccerVisualForwardX=n.x;f.data.soccerVisualForwardY=n.y;
    f.data.soccerLastMoveDirectionX=n.x;f.data.soccerLastMoveDirectionY=n.y;
  }
  function soccerLowerHalfBuff(f){ return f?.name === 'SOCCER' && f.data?.soccerPossessionActive && f.y > GAME_SIZE / 2; }
  function soccerTerrainDamage(label, statusDamage) {
    const text = String(label || '');
    return /ice[-_ ]?age|ice[_-]?lane|terrain|zone|field|puddle|lava|poison|burn|bleed|disease|hex|saw-wall|galaxy.*zone/i.test(text)
      || (statusDamage && /dot|tick|aura|trail/i.test(text));
  }
  function soccerPenaltyBoxLikely(f) {
    if (!f) return false;
    const width = GAME_SIZE * (C.GOAL_WIDTH_RATIO || .46);
    const min = GAME_SIZE / 2 - width / 2;
    const max = GAME_SIZE / 2 + width / 2;
    const depth = GAME_SIZE * (C.PENALTY_BOX_DEPTH_RATIO || .25);
    return f.data?.soccerPossessionActive && f.x >= min && f.x <= max && (f.y <= depth || f.y >= GAME_SIZE - depth);
  }
  function playSoccerPowerSound(key, volume) {
    if (window.__apexStatsSilent) return;
    const base = S.audio?.[key];
    if (!base) return;
    try {
      const pool = S.audioPools?.[key] || [base];
      let audio = pool.find(item => item.paused || item.ended);
      if (!audio && pool.length < 8) {
        audio = base.cloneNode(true);
        audio.preload = 'auto';
        registerBattleMediaElement(audio);
        pool.push(audio);
      }
      if (!audio) return;
      audio.currentTime = 0;
      if (Number.isFinite(volume)) audio.volume = volume;
      const p = audio.play();
      if (p?.catch) p.catch(() => {});
    } catch (error) {}
  }
  function soccerDodgeChance(f) {
    if (!f?.data) return 0;
    const field = f.data.soccerEnemyHalfDodgeActive ? (C.ENEMY_HALF_DODGE_CHANCE || .5) : 0;
    const rageStart = f.data.soccerRageStartHp ?? f.rageStartHp ?? f.hp;
    const lostPct = f.isRage ? Math.max(0, (rageStart - f.hp) / Math.max(1, f.maxHp) * 100) : 0;
    const rage = f.isRage ? Math.min(.88, lostPct * .06 + .08) : 0;
    f.data.soccerRageDodgeChance = rage;
    f.data.soccerTotalDodgeChance = Math.min(1, field + rage);
    return f.data.soccerTotalDodgeChance;
  }
  function soccerDashAway(f, source, label='dodge') {
    const away = source && Number.isFinite(source.x) ? norm(f.x - source.x, f.y - source.y) : norm(f.dir?.x || 0, f.dir?.y || 1);
    const sideA = { x:-away.y, y:away.x }, sideB = { x:away.y, y:-away.x };
    const candidates = [away, sideA, sideB, norm(away.x + sideA.x * .45, away.y + sideA.y * .45), norm(away.x + sideB.x * .45, away.y + sideB.y * .45)];
    let best = candidates[0], bestRoom = -1;
    for (const c of candidates) {
      const x = clamp(f.x + c.x * 138, f.radius, GAME_SIZE - f.radius);
      const y = clamp(f.y + c.y * 138, f.radius, GAME_SIZE - f.radius);
      const room = Math.hypot(x - f.x, y - f.y);
      if (room > bestRoom) { bestRoom = room; best = c; }
    }
    const from = { x:f.x, y:f.y };
    f.x = clamp(f.x + best.x * 138, f.radius, GAME_SIZE - f.radius);
    f.y = clamp(f.y + best.y * 138, f.radius, GAME_SIZE - f.radius);
    f.data.soccerDodgeImmunityUntil = matchClock + .18;
    f.data.soccerDodgeSourceId = source?.id ?? null;
    for (let i = 0; i < 7; i += 1) {
      const t = i / 6;
      S.vfx.push({
        type:'dodge',
        x:lerp(from.x, f.x, t),
        y:lerp(from.y, f.y, t),
        dir:{...best},
        life:.42 + i * .035,
        maxLife:.42 + i * .035,
        ownerId:f.id,
        bright:true,
      });
    }
  }
  const prevPowerTakeDamage = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false) {
    if (this.name === 'SOCCER' && source && source !== this && !soccerPenaltyBoxLikely(this) && !soccerTerrainDamage(label, statusDamage)) {
      const chance = soccerDodgeChance(this);
      const key = source.id ?? label ?? 'source';
      if (chance > 0 && matchClock >= (this.data.soccerDodgeBySource?.[key] || 0) && Math.random() < chance) {
        this.data.soccerDodgeBySource ||= {};
        this.data.soccerDodgeBySource[key] = matchClock + (C.DODGE_SOURCE_COOLDOWN || .25);
        soccerDashAway(this, source, this.isRage ? 'rage' : 'field');
        return;
      }
    }
    const before = this.hp;
    const result = prevPowerTakeDamage.call(this, amount, source, label, statusDamage);
    const lost = Math.max(0, before - this.hp);
    if (lost > 0 && Number.isFinite(this.maxHp)) {
      this.data ||= {};
      this.data.lastHpLossImpact = {
        at: performance.now(),
        amount: lost,
        ratio: clamp(lost / Math.max(1, this.maxHp), 0, 1),
        hp: this.hp,
      };
    }
    return result;
  };

  function releaseCooldownKick(f,e,b,dir) {
    const d=f.data;
    const speed=(C.BALL_MAX_SPEED||2130)*.96;
    Object.assign(b,{
      state:'SOCCER_FREE_BALL',
      x:clamp(f.x+dir.x*(f.radius+b.radius+5),b.radius,GAME_SIZE-b.radius),
      y:clamp(f.y+dir.y*(f.radius+b.radius+5),b.radius,GAME_SIZE-b.radius),
      vx:dir.x*speed,vy:dir.y*speed,speed,freeFlightTime:0,lastReleaseTime:matchClock,
      hasLeftOwnerRadius:false,ownerContactActive:true,opponentContactActive:false,
      skillShot:'soccer_cooldown_kick',damageArmed:true,lastSoccerTouchKind:'kick',trail:[],
    });
    if (typeof S.armHealKick === 'function') S.armHealKick(f,b);
    else {
      const id=(d.soccerHealKickSerial||0)+1;
      d.soccerHealKickSerial=id;d.soccerActiveHealKickId=id;d.soccerFreeKickHealUntil=matchClock+1;
      b.healKickId=id;b.healWindowUntil=d.soccerFreeKickHealUntil;b.healResolved=false;
    }
    d.soccerState='SOCCER_FREE_BALL';
    d.soccerCurrentKickType=null;d.soccerCurrentKickFrame=-1;
    d.soccerOneTouchKick=null;
    d.soccerCooldownKickTimer=1;d.soccerLastCooldownKickAt=matchClock;
    d.soccerLastStateTransition='DRIBBLE CD CATCH -> STRAIGHT KICK';
    playSoccerPowerSound('powerKick',.62);
  }
  function updateOneTouchKick(f,e,b,dt) {
    const d=f.data,kick=d.soccerOneTouchKick;
    if(!kick)return false;
    d.soccerOneTouchKick=null;d.soccerCurrentKickType=null;d.soccerCurrentKickFrame=-1;
    f.data.positionLocked=false;
    return false;
  }
  function aimCooldownKick(f, e, b, direct) {
    const d = f.data;
    const now = matchClock;
    const straightReady = (d.soccerCooldownKickTimer || 0) <= 0;
    const dir = direct && straightReady && e
      ? norm(e.x - f.x, e.y - f.y)
      : norm((f.dir?.x || 1) * .55 + (Math.random() - .5) * .9, (f.dir?.y || 0) * .55 + (Math.random() - .5) * .9);
    if(straightReady&&direct&&e){
      releaseCooldownKick(f,e,b,dir);
      d.soccerLastStateTransition='DRIBBLE CD CATCH -> STRAIGHT KICK';
      return true;
    }
    const speed = (C.BALL_MAX_SPEED || 2130) * .68;
    Object.assign(b, {
      state:'SOCCER_FREE_BALL',
      x:clamp(f.x + dir.x * (f.radius + b.radius + 5), b.radius, GAME_SIZE - b.radius),
      y:clamp(f.y + dir.y * (f.radius + b.radius + 5), b.radius, GAME_SIZE - b.radius),
      vx:dir.x * speed,
      vy:dir.y * speed,
      speed,
      freeFlightTime:0,
      lastReleaseTime:now,
      hasLeftOwnerRadius:false,
      ownerContactActive:true,
      opponentContactActive:false,
      skillShot:null,
      damageArmed:true,
      lastSoccerTouchKind:'kick',
      trail:[],
    });
    d.soccerState = 'SOCCER_FREE_BALL';
    d.soccerPossessionActive = false;
    d.soccerFieldOverlayActive = false;
    d.soccerLastStateTransition='DRIBBLE CD CATCH -> CLEAR KICK';
    playSoccerPowerSound('hit',.45);
    return true;
  }
  function applySoccerPowerPostTick(dt=0) {
    for (const f of fighters || []) {
      if (f?.name !== 'SOCCER' || !live(f)) continue;
      const b = soccerBallOf(f), e = enemyOfSoccer(f), d = f.data;
      d.soccerBuffGhostTimer = Math.max(0, (d.soccerBuffGhostTimer || 0) - dt);
      if (soccerLowerHalfBuff(f) && d.soccerMovementActive && d.soccerBuffGhostTimer <= 0) {
        const dir = norm(d.soccerVisualForwardX || f.dir?.x || 0, d.soccerVisualForwardY || f.dir?.y || -1);
        S.vfx.push({type:'dodge',x:f.x,y:f.y,dir,life:.34,maxLife:.34,ownerId:f.id,bright:true});
        d.soccerBuffGhostTimer = .075;
      }
      if(updateOneTouchKick(f,e,b,dt))continue;
      if (!b || b.state !== 'SOCCER_FREE_BALL' || d.soccerPenaltyCinematicActive || d.soccerChaseDownActive || d.soccerCarryActive) continue;
      if (b.skillShot === 'soccer_shoot') continue;
      if ((b.speed || 0) > 0 && (b.speed || 0) < 8) {
        b.speed = 0; b.vx = 0; b.vy = 0; b.trail = [];
      }
      if ((d.soccerPossessionCooldown || 0) <= 0 || !b.hasLeftOwnerRadius) continue;
      const close = dist(f.x, f.y, b.x, b.y) <= f.radius + b.radius + (C.CATCH_EXTRA_RADIUS || 8);
      const absoluteCatchReady = Number.isFinite(d.soccerFreeBallCatchReadyAt) && d.soccerFreeBallCatchReadyAt > 0 && matchClock >= d.soccerFreeBallCatchReadyAt;
      if (close && (b.freeFlightTime >= (C.FREE_BALL_NO_CATCH_DURATION || 5) || absoluteCatchReady)) {
        playSoccerPowerSound('catch', .54);
        if (typeof S.enterPossession === 'function') S.enterPossession(f,'power_posttick_catch');
      }
    }
  }

  const prevPowerUpdate = update;
  update = function(dt) {
    const result = prevPowerUpdate(dt);
    applySoccerPowerPostTick(dt);
    return result;
  };
  const prevPowerPreUpdate = S.preUpdate;
  S.preUpdate = function(dt) {
    const result = prevPowerPreUpdate(dt);
    applySoccerPowerPostTick(dt);
    return result;
  };

  const prevPowerHud = updateHUD;
  updateHUD = function(force=false) {
    const sig = (fighters || []).slice(0, 2).map(f => f ? `${f.id}:${f.hp}:${f.maxHp}:${f.isRage}:${f.data?.lastHpLossImpact?.at || 0}` : 'x').join('|');
    const now = performance.now();
    if (!force && sig === lastHudSignature && now < nextHudRefresh) return;
    lastHudSignature = sig;
    nextHudRefresh = now + 48;
    return prevPowerHud();
  };

  const prevPowerHpTrail = updateHpLossTrail;
  updateHpLossTrail = function(fill, trail, visiblePct) {
    if (!fill || !trail) return prevPowerHpTrail(fill, trail, visiblePct);
    const playerIndex = fill.id === 'p2-hp' ? 1 : 0;
    const f = fighters[playerIndex];
    const impact = f?.data?.lastHpLossImpact;
    const previous = Number(fill.dataset.hpPct);
    const lossPct = Number.isFinite(previous) ? previous - visiblePct : 0;
    if (impact && lossPct > .01 && performance.now() - impact.at < 260) {
      const power = clamp(Math.max(impact.ratio, lossPct / 100), 0, .7);
      const minWidth = power >= .22 ? 18 : power >= .12 ? 12 : 0;
      const width = Math.max(lossPct, minWidth);
      trail.style.transition = 'none';
      trail.style.left = `${Math.max(0, visiblePct)}%`;
      trail.style.width = `${Math.min(100 - visiblePct, width)}%`;
      trail.style.opacity = '1';
      trail.style.background = power >= .12 ? 'linear-gradient(90deg, rgba(255,255,255,.98), rgba(255,238,178,.86))' : '';
      trail.style.boxShadow = power >= .12 ? `0 0 ${18 + power * 70}px rgba(255,255,255,.9)` : '';
      void trail.offsetWidth;
      clearTimeout(trail.__apexFadeTimer);
      const hold = power >= .22 ? 920 : power >= .12 ? 650 : 250;
      const fade = power >= .22 ? 3.1 : power >= .12 ? 2.4 : 1.5;
      trail.style.transition = `opacity ${fade}s ease-out, filter ${fade}s ease-out`;
      trail.__apexFadeTimer = setTimeout(() => { trail.style.opacity = '0'; }, hold);
      fill.style.width = `${visiblePct}%`;
      fill.dataset.hpPct = String(visiblePct);
      return;
    }
    return prevPowerHpTrail(fill, trail, visiblePct);
  };

  function rosterListForMode() {
    if (rosterMode === 'full') return FighterTypes;
    const featured = FEATURED_FIGHTERS.map(name => FighterTypes.find(ft => ft.name === name)).filter(Boolean);
    return featured.length ? featured : FighterTypes;
  }
  function syncRosterSelections(grid) {
    grid.querySelectorAll('.fighter-card').forEach(card => {
      const ft = FighterTypes.find(x => x.name === card.dataset.fighter);
      card.classList.toggle('selected-p1', ft && p1Selection === ft);
      card.classList.toggle('selected-p2', ft && p2Selection === ft);
    });
  }
  function ensureRosterTabs(grid) {
    document.getElementById('roster-tabs')?.remove();
  }
  function renderCard(ft, grid) {
    const card = document.createElement('div');
    card.className = 'fighter-card';
    card.dataset.fighter = ft.name;
    card.style.color = ft.color;
    const name = document.createElement('div');
    name.className = 'f-name';
    name.textContent = ft.name === 'NOVA' ? 'GALAXY' : ft.name;
    const preview = document.createElement('canvas');
    preview.className = 'f-preview';
    preview.width = 140;
    preview.height = 96;
    preview.setAttribute('aria-label', `${ft.name} battle visual preview`);
    card.appendChild(name);
    card.appendChild(preview);
    card.onclick = () => selectFighter(ft, card);
    grid.appendChild(card);
  }
  const prevPowerPopulateRoster = populateRoster;
  populateRoster = function() {
    const grid = document.getElementById('roster-grid');
    if (!grid) return prevPowerPopulateRoster();
    ensureRosterTabs(grid);
    grid.innerHTML = '';
    rosterListForMode().forEach(ft => renderCard(ft, grid));
    document.querySelectorAll('#roster-tabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.rosterMode === rosterMode));
    syncRosterSelections(grid);
    renderRosterPreviews(true);
    ensureRosterPreviewLoop();
  };
  const prevPowerSelectFighter = selectFighter;
  selectFighter = function(ft, card) {
    prevPowerSelectFighter(ft, card);
    const grid = document.getElementById('roster-grid');
    if (grid) syncRosterSelections(grid);
  };
  if (document.getElementById('roster-grid')) populateRoster();

  Object.assign(window.apexReactBridge || {}, { goToSelect, startSpecificMatch, updateHUD });
  Object.assign(window, window.apexReactBridge || {});
})();
