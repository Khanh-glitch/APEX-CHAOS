// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function GALAXY_REFINEMENT_PASS(){
  if (window.__apexGalaxyRefinementPass) return;
  window.__apexGalaxyRefinementPass = true;
  const G = window.APEX_GALAXY;
  if (!G) return;
  const galaxyType = FighterTypes.find(f => f && f.name === 'GALAXY');
  if (!galaxyType) return;

  const BODY_SIZE = 242;
  const BODY_SIZE_IMPACT = 294;
  const PLANET_ORBIT_SIZE = 76;
  const PLANET_PROJECTILE_SIZE = 108;
  const PLANET_MAX = 5;
  const PLANET_RELOAD_STEP = 0.72;
  const PRESSURE_TIME = 3;
  const DIVINE_PREP_TIME = 7;
  const DIVINE_RECOVER_TIME = 1.15;
  const IMPACT_CHARGE_TIME = 5;
  const SPLIT_LIFE = 5;
  const refinedTeleportLineImage = new Image();
  refinedTeleportLineImage.decoding = 'async';
  refinedTeleportLineImage.src = '/assets/galaxy_v1/images/teleportLineGalaxyKeyed.webp';

  function live(f){ return f && f.hp > 0; }
  function enemyOf(f){ return fighters.find(q => live(q) && q !== f && !q.data?.galaxyRemoved) || null; }
  function imgReady(img){ return img && img.complete && img.naturalWidth; }
  function gImg(key){ return G.images && G.images[key]; }
  function nowSec(){ return performance.now() / 1000; }
  function faceAngleToEnemy(f, e) {
    if (e && live(e) && Number.isFinite(e.x) && Number.isFinite(e.y)) return Math.atan2(e.y - f.y, e.x - f.x);
    return Math.atan2(f?.dir?.y || 0, f?.dir?.x || 1);
  }
  function playGalaxySfx(key, volume = 0.9, opts = {}) {
    if (window.__apexStatsSilent) return null;
    try { if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (error) {}
    const buffer = G.audio && G.audio[key];
    if (!buffer) return null;
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = buffer;
    src.loop = !!opts.loop;
    gain.gain.value = volume;
    src.connect(gain);
    // CP6 session ownership: route through the battle master and register the
    // source so session transitions stop it (was: direct destination leak).
    gain.connect(typeof battleAudioMaster !== 'undefined' ? battleAudioMaster : audioCtx.destination);
    if (window.__apexRecordingAudioDestination) gain.connect(window.__apexRecordingAudioDestination);
    if (window.apexRegisterBattleAudioSource) window.apexRegisterBattleAudioSource(src);
    try { src.start(); } catch (error) {}
    return { src, gain, stop(seconds = 0.18) {
      const now = audioCtx.currentTime;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + seconds);
        src.stop(now + seconds + 0.02);
      } catch (error) {}
    } };
  }
  function stopPressureWalk(f) {
    const h = f?.data?.galaxyPressureWalkRefined;
    if (h && h.stop) h.stop(0.14);
    if (f?.data) f.data.galaxyPressureWalkRefined = null;
  }
  function resetPlanetOrder(f) {
    f.data.galaxyPlanetOrder = Array.from({ length: PLANET_MAX }, (_, i) => i);
    f.data.galaxyPlanetVisuals = {};
    f.data.galaxyStacks = PLANET_MAX;
    f.data.galaxyVisibleStacks = PLANET_MAX;
    f.data.galaxyReloadFill = 0;
    f.data.galaxyReloading = false;
    f.data.galaxyNextReloadIndex = 0;
  }
  function silenceNonGalaxy(seconds) {
    G.silenceTimer = Math.max(G.silenceTimer || 0, seconds);
    try {
      battleAudioMaster.gain.cancelScheduledValues(audioCtx.currentTime);
      battleAudioMaster.gain.setValueAtTime(0.001, audioCtx.currentTime);
    } catch (error) {}
    try {
      for (const audio of battleMediaElements || []) if (audio && !audio.paused) audio.volume = Math.min(audio.volume, 0.02);
    } catch (error) {}
  }
  function maintainGalaxySilence(dt) {
    if ((G.silenceTimer || 0) <= 0) return;
    G.silenceTimer = Math.max(0, G.silenceTimer - dt);
    try { battleAudioMaster.gain.setValueAtTime(0.001, audioCtx.currentTime); } catch (error) {}
    if (G.silenceTimer <= 0) {
      try {
        battleAudioMaster.gain.cancelScheduledValues(audioCtx.currentTime);
        battleAudioMaster.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.22);
      } catch (error) {}
      try {
        for (const audio of battleMediaElements || []) if (audio) audio.volume = 1;
      } catch (error) {}
    }
  }
  function drawImageLocal(ctx, img, w, h, alpha = 1) {
    if (!imgReady(img)) return false;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }
  function drawImageWorld(ctx, img, x, y, w, h, rot = 0, alpha = 1) {
    if (!imgReady(img)) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }
  function galaxySpriteKey(f) {
    const d = f.data || {};
    if (d.galaxyImpact) return 'impact';
    if (d.galaxyDivine) return d.galaxyDivine.phase === 'punch' ? 'divinePunch' : 'divinePre';
    if (d.galaxyPressureWindow > 0) return 'main';
    if (d.galaxyPressureArmed) return 'pressureBefore';
    if (d.galaxyThrowPhase === 'release') return 'throw2';
    if (d.galaxyThrowPhase === 'windup') return 'throw1';
    return 'main';
  }
  function localToWorld(origin, dir, x, y) {
    const px = -dir.y, py = dir.x;
    return { x: origin.x + dir.x * x + px * y, y: origin.y + dir.y * x + py * y };
  }
  function rayToArenaEdge(x, y, dx, dy) {
    const ts = [];
    if (Math.abs(dx) > 0.0001) {
      ts.push((0 - x) / dx, (GAME_SIZE - x) / dx);
    }
    if (Math.abs(dy) > 0.0001) {
      ts.push((0 - y) / dy, (GAME_SIZE - y) / dy);
    }
    return Math.max(1, Math.min(...ts.filter(t => t > 0)));
  }
  function worldDeltaToDrawLocal(dx, dy, baseRot) {
    const c = Math.cos(-baseRot), s = Math.sin(-baseRot);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }
  function drawTeleportZigzag(ctx, tr) {
    const a = clamp(tr.life / tr.maxLife, 0, 1);
    const img = refinedTeleportLineImage;
    const dx = tr.x2 - tr.x1, dy = tr.y2 - tr.y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / len, ny = dy / len;
    const px = -ny, py = nx;
    const pts = [];
    const amp = tr.amp || 24;
    const count = tr.segments || 5;
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const off = (i % 2 ? 1 : -1) * amp * (0.45 + 0.55 * Math.sin(Math.PI * t));
      pts.push({ x: lerp(tr.x1, tr.x2, t) + px * off, y: lerp(tr.y1, tr.y2, t) + py * off });
    }
    ctx.save();
    ctx.globalAlpha = 0.38 * a;
    ctx.strokeStyle = 'rgba(70,0,10,.92)';
    ctx.shadowColor = '#ff3155';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();
    if (imgReady(img)) {
      for (let i = 0; i < pts.length - 1; i += 1) {
        const p0 = pts[i], p1 = pts[i + 1];
        drawImageWorld(ctx, img, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, dist(p0.x,p0.y,p1.x,p1.y) * 1.22, 48, Math.atan2(p1.y - p0.y, p1.x - p0.x), 0.95 * a);
      }
    }
  }
  function drawGalaxyAfterimage(ctx, tr) {
    const a = clamp(tr.life / tr.maxLife, 0, 1);
    const img = gImg('main');
    ctx.save();
    ctx.translate(tr.x, tr.y);
    ctx.rotate((tr.angle || 0) - Math.PI / 2);
    ctx.globalAlpha = 0.34 * a;
    ctx.shadowColor = '#ff3558';
    ctx.shadowBlur = 22;
    if (!drawImageLocal(ctx, img, BODY_SIZE, BODY_SIZE, 1)) drawSketchBlob(ctx, 82, '#291544', 14);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.28 * a;
    ctx.strokeStyle = 'rgba(255,75,95,.82)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i += 1) {
      const y = tr.y + (i - 3) * 18;
      ctx.beginPath();
      ctx.moveTo(tr.x - 74 - i * 3, y);
      ctx.lineTo(tr.x + 82 + i * 4, y + Math.sin(i * 1.9) * 18);
      ctx.stroke();
    }
    ctx.restore();
  }
  function orbitPoint(f, index, count, sideBias = 0) {
    const d = f.data || {};
    const face = d.galaxyFaceAngle ?? Math.atan2(f?.dir?.y || 0, f?.dir?.x || 1);
    const t = count <= 1 ? 0.5 : index / (count - 1);
    const arc = face + Math.PI + lerp(-1.18, 1.18, t);
    const rad = 188 + Math.sin(nowSec() * 1.5 + index * 1.7) * 9;
    const drift = sideBias * 34;
    return {
      x: f.x + Math.cos(arc) * rad + Math.cos(face) * drift,
      y: f.y + Math.sin(arc) * rad + Math.sin(face) * drift
    };
  }
  function throwStartPoint(f, e) {
    const face = f?.data?.galaxyFaceAngle ?? faceAngleToEnemy(f, e);
    const dir = { x: Math.cos(face), y: Math.sin(face) };
    const side = { x: -dir.y, y: dir.x };
    return { x: f.x + dir.x * 86 + side.x * 36, y: f.y + dir.y * 86 + side.y * 36 };
  }
  function updatePlanetVisuals(f, e, dt) {
    if (!f?.data || f.data.galaxyDivine) return;
    const d = f.data;
    d.galaxyPlanetOrder ||= Array.from({ length: d.galaxyStacks || PLANET_MAX }, (_, i) => i);
    d.galaxyPlanetVisuals ||= {};
    const order = d.galaxyPlanetOrder;
    const active = d.galaxyThrowPhase !== 'idle' ? d.galaxyThrownIndex : -1;
    const keep = new Set(order);
    const follow = 1 - Math.exp(-Math.max(0, dt) * 10);
    for (let slot = 0; slot < order.length; slot += 1) {
      const planetIndex = order[slot];
      let target = orbitPoint(f, slot, order.length, d.galaxyThrowPhase !== 'idle' ? .18 : 0);
      if (planetIndex === active && e) {
        const start = d.galaxyThrowStart || orbitPoint(f, slot, order.length, 0);
        const end = throwStartPoint(f, e);
        const progress = d.galaxyThrowPhase === 'windup' ? clamp(1 - d.galaxyThrowTimer / .28, 0, 1) : 1;
        const ease = progress * progress * (3 - 2 * progress);
        const face = d.galaxyFaceAngle ?? faceAngleToEnemy(f, e);
        const side = { x:-Math.sin(face), y:Math.cos(face) };
        const control = {
          x:lerp(start.x,end.x,.55) - Math.cos(face) * 30 + side.x * 42,
          y:lerp(start.y,end.y,.55) - Math.sin(face) * 30 + side.y * 42
        };
        const inv = 1 - ease;
        target = {
          x:inv*inv*start.x + 2*inv*ease*control.x + ease*ease*end.x,
          y:inv*inv*start.y + 2*inv*ease*control.y + ease*ease*end.y
        };
      }
      let v = d.galaxyPlanetVisuals[planetIndex];
      if (!v) {
          const face = d.galaxyFaceAngle ?? Math.atan2(f?.dir?.y || 0, f?.dir?.x || 1);
        v = {
          x: f.x - Math.cos(face) * 84 + Math.sin(planetIndex * 2.3) * 18,
          y: f.y - Math.sin(face) * 84 + Math.cos(planetIndex * 2.3) * 18,
          alpha: 0
        };
        d.galaxyPlanetVisuals[planetIndex] = v;
      }
      v.x = lerp(v.x, target.x, follow);
      v.y = lerp(v.y, target.y, follow);
      v.alpha = lerp(v.alpha ?? 1, 1, 1 - Math.exp(-Math.max(0, dt) * 8));
    }
    for (const key of Object.keys(d.galaxyPlanetVisuals)) {
      const idx = Number(key);
      if (!keep.has(idx) && idx !== active) delete d.galaxyPlanetVisuals[key];
    }
  }
  function drawDivinePlanetSwirl(ctx, f, baseRot, d) {
    if (!d) return false;
    const start = DIVINE_PREP_TIME - 0.58;
    const phase = d.punched ? 1 : clamp((d.elapsed - start) / 0.58, 0, 1);
    const collapse = d.punched ? clamp(1 - d.timer / DIVINE_RECOVER_TIME, 0, 1) : 0;
    const alpha = d.punched ? Math.max(0, 1 - collapse * 1.45) : 1;
    const vertex = d.vertex || {x:f.x,y:f.y};
    const oldPoint = d.oldPoint || {x:f.x,y:f.y};
    const travel = phase * phase * (3 - 2 * phase);
    const centerWorld = {
      x: lerp(oldPoint.x, vertex.x, travel),
      y: lerp(oldPoint.y, vertex.y, travel)
    };
    const center = worldDeltaToDrawLocal(centerWorld.x - f.x, centerWorld.y - f.y, baseRot);
    for (let i = 0; i < PLANET_MAX; i += 1) {
      const img = gImg(`planet${i}`);
      const spin = nowSec() * (phase > 0 ? 12.5 : 2.1) + i * TAU / PLANET_MAX;
      const expand = Math.sin(Math.PI * Math.min(1, phase * 1.35));
      const r = phase <= 0 ? 82 + i * 5 : lerp(104 + expand * 86, 14 + i * 2, travel);
      const size = lerp(PLANET_ORBIT_SIZE * 1.12, 18, travel);
      const x = center.x + Math.cos(spin) * r;
      const y = center.y + Math.sin(spin) * r * .64;
      drawImageWorld(ctx, img, x, y, size, size, spin, alpha * (1 - travel * .62));
    }
    return true;
  }
  function initRefinedGalaxy(f) {
    f.radius = 82;
    f.baseRadius = 82;
    resetPlanetOrder(f);
    f.data.galaxyThrowCd = 1.55;
    f.data.galaxyThrowPhase = 'idle';
    f.data.galaxyThrowTimer = 0;
    f.data.galaxyThrownIndex = -1;
    f.data.galaxyPressureCd = 15;
    f.data.galaxyPressureArmed = false;
    f.data.galaxyPressureWindow = 0;
    f.data.galaxyPressureContactDone = false;
    f.data.galaxyWallHits = 0;
    f.data.galaxyRecentDamage = [];
    f.data.galaxyBlueholeCd = 0;
    f.data.galaxyRageDamageDone = 0;
    f.data.galaxyRageReduction = 0;
    f.data.galaxyState = 'READY';
    f.data.galaxyFaceAngle = Math.atan2(f.dir.y, f.dir.x);
  }
  galaxyType.init = initRefinedGalaxy;
  galaxyType.speedModifier = f => (f.data && f.data.galaxyPressureArmed) ? 1.12 : 1;

  function canGalaxyAct(f) {
    return f && f.hp > 0 && !G.paused && !f.data.galaxyBlueholeRefined && !f.data.galaxyDivine && !f.data.galaxyImpact && !f.hasStatus?.('abilityDisabled') && gameState === 'PLAYING';
  }
  function updatePlanetReload(f, dt) {
    if (f.data.galaxyPressureArmed || f.data.galaxyPressureWindow > 0) return;
    f.data.galaxyPlanetOrder ||= Array.from({ length: f.data.galaxyStacks || PLANET_MAX }, (_, i) => i);
    f.data.galaxyStacks = f.data.galaxyPlanetOrder.length;
    if (f.data.galaxyStacks >= PLANET_MAX) {
      f.data.galaxyReloadFill = 0;
      f.data.galaxyReloading = false;
      f.data.galaxyVisibleStacks = PLANET_MAX;
      return;
    }
    if (f.data.galaxyStacks > 0 && !f.data.galaxyReloading) return;
    if (f.data.galaxyStacks <= 0) {
      f.data.galaxyReloading = true;
      f.data.galaxyNextReloadIndex = 0;
    }
    if (!f.data.galaxyReloading) return;
    f.data.galaxyReloadFill = (f.data.galaxyReloadFill || 0) + dt;
    while (f.data.galaxyReloadFill >= PLANET_RELOAD_STEP && f.data.galaxyPlanetOrder.length < PLANET_MAX) {
      f.data.galaxyReloadFill -= PLANET_RELOAD_STEP;
      const next = f.data.galaxyNextReloadIndex || 0;
      f.data.galaxyPlanetOrder.push(next);
      f.data.galaxyNextReloadIndex = next + 1;
      f.data.galaxyStacks = f.data.galaxyPlanetOrder.length;
      f.data.galaxyVisibleStacks = f.data.galaxyStacks;
    }
    if (f.data.galaxyPlanetOrder.length >= PLANET_MAX) {
      f.data.galaxyReloading = false;
      f.data.galaxyReloadFill = 0;
      f.data.galaxyNextReloadIndex = 0;
    }
  }
  function updateGalaxyThrowRefined(f, e, dt) {
    if (f.data.galaxyPressureArmed || f.data.galaxyPressureWindow > 0) {
      f.data.galaxyThrowPhase = 'idle';
      return;
    }
    if (f.data.galaxyThrowPhase === 'idle') {
      f.data.galaxyThrowCd -= dt;
      f.data.galaxyPlanetOrder ||= Array.from({ length: f.data.galaxyStacks || PLANET_MAX }, (_, i) => i);
      f.data.galaxyStacks = f.data.galaxyPlanetOrder.length;
      if (f.data.galaxyThrowCd <= 0 && f.data.galaxyStacks > 0 && e && !f.data.galaxyReloading) {
        f.data.galaxyThrowPhase = 'windup';
        f.data.galaxyThrowTimer = 0.28;
        f.data.galaxyThrownIndex = f.data.galaxyPlanetOrder[0] ?? 0;
        const current = f.data.galaxyPlanetVisuals?.[f.data.galaxyThrownIndex];
        f.data.galaxyThrowStart = current
          ? {x:current.x, y:current.y}
          : orbitPoint(f, 0, f.data.galaxyPlanetOrder.length, 0);
      }
      return;
    }
    f.data.galaxyThrowTimer -= dt;
    if (f.data.galaxyThrowPhase === 'windup' && f.data.galaxyThrowTimer <= 0) {
      f.data.galaxyThrowPhase = 'release';
      f.data.galaxyThrowTimer = 0.16;
      releaseRefinedPlanet(f, e);
      return;
    }
    if (f.data.galaxyThrowPhase === 'release' && f.data.galaxyThrowTimer <= 0) {
      f.data.galaxyThrowPhase = 'idle';
      f.data.galaxyThrowCd = 1.7;
      f.data.galaxyThrowStart = null;
    }
  }
  function releaseRefinedPlanet(f, e) {
    f.data.galaxyPlanetOrder ||= Array.from({ length: f.data.galaxyStacks || PLANET_MAX }, (_, i) => i);
    if (!e || f.data.galaxyPlanetOrder.length <= 0) return;
    const idx = f.data.galaxyPlanetOrder.shift();
    f.data.galaxyStacks = f.data.galaxyPlanetOrder.length;
    f.data.galaxyVisibleStacks = f.data.galaxyStacks;
    if (f.data.galaxyStacks <= 0) {
      f.data.galaxyReloading = true;
      f.data.galaxyReloadFill = 0;
      f.data.galaxyNextReloadIndex = 0;
    }
    const visual = f.data.galaxyPlanetVisuals?.[idx];
    const start = visual ? { x:visual.x, y:visual.y } : throwStartPoint(f, e);
    if (f.data.galaxyPlanetVisuals) delete f.data.galaxyPlanetVisuals[idx];
    const n = norm(e.x - start.x, e.y - start.y);
    const speed = (G.report?.planetSpeed || 1278) * 1.02;
    projectiles.push({
      type:'galaxy_planet',
      owner:f,
      x:start.x,
      y:start.y,
      vx:n.x*speed,
      vy:n.y*speed,
      radius:38,
      visualSize:PLANET_PROJECTILE_SIZE,
      life:4.2,
      maxLife:4.2,
      planetIndex:idx,
      exploded:false,
      hitIds:{}
    });
    playGalaxySfx('throw', 0.72);
  }
  function updatePressureArmingRefined(f, e, dt) {
    if (f.data.galaxyPressureArmed) {
      f.data.galaxyState = 'PRESSURE_ARMED';
      if (e) f.setDir(e.x - f.x, e.y - f.y);
      return;
    }
    f.data.galaxyPressureCd -= dt;
    if (f.data.galaxyPressureCd <= 0) {
      f.data.galaxyPressureArmed = true;
      f.data.galaxyPressureContactDone = false;
      f.data.galaxyThrowPhase = 'idle';
      f.data.galaxyState = 'PRESSURE_ARMED';
      if (e) f.setDir(e.x - f.x, e.y - f.y);
      stopPressureWalk(f);
      f.data.galaxyPressureWalkRefined = playGalaxySfx('pressureWalk', 0.34, { loop:true });
    }
  }
  function countPressureWall(f, side, x, y) {
    const now = matchClock;
    if (!side) return;
    if (side === f.data.galaxyLastWall && now - (f.data.galaxyLastWallTime || -99) < 0.16) return;
    f.data.galaxyLastWall = side;
    f.data.galaxyLastWallTime = now;
    f.data.galaxyWallHits = (f.data.galaxyWallHits || 0) + 1;
    playGalaxySfx('wall', 0.55);
    emitParticles(x, y, '#bdb6ff', 10, 260, 3, .26, 'square');
  }
  function pushPressureTrail(x1, y1, x2, y2, life = .34) {
    G.refinedTrails ||= [];
    G.refinedTrails.push({
      type:'galaxy_teleport_zigzag',
      x1, y1, x2, y2,
      life, maxLife:life,
      amp:16,
      segments:3
    });
  }
  function updatePressureDodgeRefined(f, e, dt, p) {
    if (!e || !p) return;
    f.data.galaxyPressureDodgeCd = Math.max(0, (f.data.galaxyPressureDodgeCd || 0) - dt);
    const vx = p.vx || 0, vy = p.vy || 0;
    const speed = Math.hypot(vx, vy);
    if (speed < 80) return;
    const toGalaxy = { x:f.x - e.x, y:f.y - e.y };
    const closing = dot(toGalaxy.x, toGalaxy.y, vx / speed, vy / speed);
    const near = Math.hypot(toGalaxy.x, toGalaxy.y) < f.radius + e.radius + 42;
    const shouldDodge = near && closing > 0 && (f.data.galaxyPressureDodgeCd || 0) <= 0;
    if (!shouldDodge) return;
    const old = {x:f.x, y:f.y};
    const gap = f.radius + e.radius + 22;
    const candidates = [-1, 1].map(sign => {
      const px = -vy / speed * sign;
      const py = vx / speed * sign;
      const x = clamp(e.x + px * gap - vx / speed * 12, f.radius, GAME_SIZE - f.radius);
      const y = clamp(e.y + py * gap - vy / speed * 12, f.radius, GAME_SIZE - f.radius);
      const d = dist(old.x, old.y, x, y);
      const clearance = dist(x, y, e.x, e.y);
      return {x, y, score:d + (clearance < gap - 3 ? 10000 : 0)};
    }).sort((a,b)=>a.score-b.score);
    const best = candidates[0];
    f.x = best.x;
    f.y = best.y;
    f.data.positionLocked = true;
    f.data.galaxyFaceAngle = Math.atan2(e.y - f.y, e.x - f.x);
    G.refinedTrails ||= [];
    for (let i = 0; i < 4; i += 1) {
      const t = i / 3;
      G.refinedTrails.push({
        type:'galaxy_afterimage',
        x:lerp(old.x, f.x, t),
        y:lerp(old.y, f.y, t),
        angle:f.data.galaxyFaceAngle,
        life:.38 + i * .05,
        maxLife:.38 + i * .05
      });
    }
    f.data.galaxyPressureDodgeCd = .2;
  }
  function updatePressureWindowRefined(f, e, dt) {
    if (e && e.data.galaxyPressure?.ownerId === f.id) {
      const p = e.data.galaxyPressure;
      e.x += p.vx * dt;
      e.y += p.vy * dt;
      let side = null;
      if (e.x < e.radius) { e.x = e.radius; p.vx = Math.abs(p.vx) * 0.92; side = 'left'; }
      if (e.x > GAME_SIZE - e.radius) { e.x = GAME_SIZE - e.radius; p.vx = -Math.abs(p.vx) * 0.92; side = 'right'; }
      if (e.y < e.radius) { e.y = e.radius; p.vy = Math.abs(p.vy) * 0.92; side = 'top'; }
      if (e.y > GAME_SIZE - e.radius) { e.y = GAME_SIZE - e.radius; p.vy = -Math.abs(p.vy) * 0.92; side = 'bottom'; }
      p.vx *= 1.002;
      p.vy *= 1.002;
      if (typeof e.setDir === 'function') e.setDir(p.vx, p.vy);
      else if (typeof e.realFighter?.setDir === 'function') e.realFighter.setDir(p.vx, p.vy);
      e.data.positionLocked = true;
      if (side) countPressureWall(f, side, e.x, e.y);
      updatePressureDodgeRefined(f, e, dt, p);
    }
    f.data.galaxyPressureWindow -= dt;
    if (f.data.galaxyPressureWindow <= 0) {
      const hits = f.data.galaxyWallHits || 0;
      if (e?.data.galaxyPressure?.ownerId === f.id) delete e.data.galaxyPressure;
      if (hits >= 9) startImpactRefined(f, e, hits);
      else if (hits >= 1) startDivineRefined(f, e, hits);
      else endPressureRefined(f);
    }
  }
  function endPressureRefined(f) {
    f.data.galaxyPressureWindow = 0;
    f.data.galaxyPressureArmed = false;
    f.data.galaxyPressureCd = 15;
    f.data.galaxyWallHits = 0;
    if (!f.data.galaxyDivine && !f.data.galaxyImpact && !f.data.galaxyBluehole) f.data.galaxyState = 'READY';
    stopPressureWalk(f);
  }
  function startDivineRefined(f, e, hits) {
    const old = { x:f.x, y:f.y };
    const dir = e ? norm(e.x - f.x, e.y - f.y) : norm(f.dir.x, f.dir.y);
    const nx = dir.x || 1, ny = dir.y || 0;
    if (e) {
      f.x = clamp(e.x - nx * (f.radius + e.radius + 10), f.radius, GAME_SIZE - f.radius);
      f.y = clamp(e.y - ny * (f.radius + e.radius + 10), f.radius, GAME_SIZE - f.radius);
      f.data.galaxyFaceAngle = Math.atan2(e.y - f.y, e.x - f.x);
    }
    G.refinedTrails ||= [];
    G.refinedTrails.push({ type:'galaxy_afterimage', x:old.x, y:old.y, angle:Math.atan2(ny,nx), life:1.2, maxLife:1.2 });
    G.refinedTrails.push({ type:'galaxy_teleport_zigzag', x1:old.x, y1:old.y, x2:f.x, y2:f.y, life:1.35, maxLife:1.35, amp:24, segments:5 });
    const vertex = {x:f.x + nx * (f.radius + 4), y:f.y + ny * (f.radius + 4)};
    const backT = rayToArenaEdge(vertex.x, vertex.y, -nx, -ny);
    const center = {x:vertex.x - nx * backT, y:vertex.y - ny * backT};
    f.data.galaxyDivine = {
      timer: DIVINE_PREP_TIME + DIVINE_RECOVER_TIME,
      elapsed: 0,
      startedAt: nowSec(),
      punchDueAt: nowSec() + DIVINE_PREP_TIME,
      endDueAt: nowSec() + DIVINE_PREP_TIME + DIVINE_RECOVER_TIME,
      worldFreeze:DIVINE_PREP_TIME + DIVINE_RECOVER_TIME + .18,
      hits,
      phase:'pre',
      punched:false,
      dir:{x:nx,y:ny},
      vertex,
      oldPoint:old,
      preField:{
        x:vertex.x,
        y:vertex.y,
        dir:{x:nx,y:ny},
        center,
        radius:Math.max(GAME_SIZE * 3.2, backT + GAME_SIZE * 1.6),
        length:GAME_SIZE * 24,
        halfWidth:GAME_SIZE * 2.05,
        curve:220 + hits * 12
      }
    };
    f.data.galaxyState = 'DIVINE';
    f.data.positionLocked = true;
    endPressureRefined(f);
    silenceNonGalaxy(DIVINE_PREP_TIME + 0.6);
    cameraShake = Math.max(cameraShake, 12);
    playGalaxySfx('divine', 0.96);
  }
  function updateDivineRefined(f, e, dt) {
    const d = f.data.galaxyDivine;
    if (!d) return false;
    d.worldFreeze = Math.max(0, (d.worldFreeze || 0) - dt);
    const realElapsed = Math.max(0, nowSec() - (d.startedAt || nowSec()));
    d.elapsed = Math.max(d.elapsed || 0, realElapsed);
    d.timer = Math.max(0, (d.endDueAt || (d.startedAt || nowSec()) + DIVINE_PREP_TIME + DIVINE_RECOVER_TIME) - nowSec());
    f.data.positionLocked = true;
    if (e && live(e)) f.data.galaxyFaceAngle = Math.atan2(e.y - f.y, e.x - f.x);
    if (!d.punched && nowSec() >= (d.punchDueAt || ((d.startedAt || nowSec()) + DIVINE_PREP_TIME))) {
      d.elapsed = Math.max(d.elapsed, DIVINE_PREP_TIME);
      d.phase = 'punch';
      d.punched = true;
      d.worldFreeze = Math.max(d.worldFreeze, DIVINE_RECOVER_TIME + .08);
      const dir = e ? norm(e.x - f.x, e.y - f.y) : d.dir;
      d.dir = {x:dir.x || d.dir.x, y:dir.y || d.dir.y};
      d.vertex = {x:f.x + d.dir.x * (f.radius + 4), y:f.y + d.dir.y * (f.radius + 4)};
      const dmg = 5 + d.hits * 5;
      if (e && e.hp > 0) {
        e.takeDamage(dmg, f, 'galaxy-divine');
        e.applyStatus('push', .22, { x:d.dir.x, y:d.dir.y, strength:420 });
      }
      createParabolaZone(f, e, d);
      spawnShockwave(d.vertex.x, d.vertex.y, '#ffcf91', 360);
      triggerFlash(255,180,110,.42);
      cameraShake = Math.max(cameraShake, 30);
    }
    if (d.timer <= 0 || nowSec() >= (d.endDueAt || Infinity)) {
      f.data.galaxyDivine = null;
      f.data.galaxyState = 'READY';
    }
    return true;
  }
  function createParabolaZone(f, e, d) {
    G.zones ||= [];
    G.zones.push({
      type:'galaxy_parabola',
      owner:f,
      x:d.vertex.x,
      y:d.vertex.y,
      dir:{...d.dir},
      hits:d.hits,
      life:5,
      maxLife:5,
      length:GAME_SIZE * 24,
      halfWidth:GAME_SIZE * 2.05,
      curve:220 + d.hits * 12
    });
  }
  function startImpactRefined(f, e, hits) {
    if (G.split?.life > 0 || f.data.galaxyImpact) { endPressureRefined(f); return; }
    f.x = GAME_SIZE / 2;
    f.y = GAME_SIZE / 2;
    if (e) f.data.galaxyFaceAngle = Math.atan2(e.y - f.y, e.x - f.x);
    f.data.galaxyImpact = { timer:IMPACT_CHARGE_TIME, elapsed:0, startedAt:nowSec(), hits, phase:'charge', punched:false };
    f.data.galaxyState = 'IMPACT';
    G.impact = { owner:f, timer:IMPACT_CHARGE_TIME, maxTimer:IMPACT_CHARGE_TIME, startedAt:nowSec(), charge:true };
    endPressureRefined(f);
    silenceNonGalaxy(IMPACT_CHARGE_TIME + 0.5);
    cameraShake = Math.max(cameraShake, 14);
    playGalaxySfx('impact', 0.96);
  }
  function updateImpactRefined(f, e, dt) {
    const im = f.data.galaxyImpact;
    if (!im) return false;
    const realElapsed = Math.max(im.elapsed || 0, nowSec() - (im.startedAt || nowSec()));
    im.elapsed = realElapsed;
    im.timer = Math.max(0, IMPACT_CHARGE_TIME - realElapsed);
    f.data.positionLocked = true;
    if (e && live(e)) f.data.galaxyFaceAngle = Math.atan2(e.y - f.y, e.x - f.x);
    if (G.impact) G.impact.timer = Math.max(0, im.timer);
    if (!im.punched && im.timer <= 0) {
      im.punched = true;
      im.phase = 'split';
      const maxEdge = Math.hypot(GAME_SIZE/2, GAME_SIZE/2);
      const ed = e ? dist(e.x,e.y,GAME_SIZE/2,GAME_SIZE/2) : maxEdge;
      const dmg = lerp(50 + Math.max(0, im.hits - 9)*5, 30, clamp(ed/maxEdge,0,1));
      if (e && e.hp > 0) e.takeDamage(dmg, f, 'galaxy-impact');
      G.split = { life:SPLIT_LIFE, maxLife:SPLIT_LIFE, startedAt:nowSec(), gap:88, quadrants:new Map() };
      G.zones ||= [];
      G.zones.push({ type:'galaxy_impact_burst', owner:f, x:GAME_SIZE / 2, y:GAME_SIZE / 2, radius:GAME_SIZE, hits:im.hits, life:.35, maxLife:.35 });
      if (e) placeImpactQuadrants(f, e);
      spawnShockwave(500,500,'#7f6dff',720);
      triggerFlash(210,180,255,.42);
      cameraShake = Math.max(cameraShake, 36);
      G.impact = null;
      f.data.galaxyImpact = null;
      f.data.galaxyState = 'READY';
      return true;
    }
    if (im.punched) {
      im.timer -= dt;
      if ((G.split?.life || 0) <= 0) {
        f.data.galaxyImpact = null;
        f.data.galaxyState = 'READY';
      }
    }
    return true;
  }
  function placeImpactQuadrants(f,e) {
    const spots = [{x:250,y:250,q:0},{x:750,y:250,q:1},{x:250,y:750,q:2},{x:750,y:750,q:3}];
    f.x = spots[0].x; f.y = spots[0].y;
    e.x = spots[3].x; e.y = spots[3].y;
    G.split.quadrants.set(f.id, 0);
    G.split.quadrants.set(e.id, 3);
  }
  function updateBlueholeRefined(f, e, dt) {
    const bh = f.data.galaxyBlueholeRefined;
    if (!bh) return false;
    bh.timer -= dt;
    bh.healTick -= dt;
    const target = fighters.find(q => q && q.id === bh.targetId) || e;
    if (bh.phase === 'dash') {
      bh.dashTimer -= dt;
      const t = 1 - clamp(bh.dashTimer / Math.max(.001, bh.dashMax || .22), 0, 1);
      const ease = t*t*(3-2*t);
      const oldX = f.x, oldY = f.y;
      f.x = clamp(lerp(bh.start.x, bh.dashEnd.x, ease), f.radius, GAME_SIZE - f.radius);
      f.y = clamp(lerp(bh.start.y, bh.dashEnd.y, ease), f.radius, GAME_SIZE - f.radius);
      f.data.positionLocked = true;
      updatePlanetVisuals(f, target, dt);
      if (target && target !== f) {
        f.data.galaxyFaceAngle = Math.atan2(target.y - f.y, target.x - f.x);
        target.applyStatus('abilityDisabled', .08, { source:f });
      }
      if (Math.hypot(f.x - oldX, f.y - oldY) > 8) {
        G.refinedTrails ||= [];
        G.refinedTrails.push({ type:'galaxy_afterimage', x:oldX, y:oldY, angle:f.data.galaxyFaceAngle, life:.24, maxLife:.24 });
      }
      if (bh.dashTimer > 0) return true;
      bh.phase = 'hold';
      bh.timer = bh.holdTime || 5;
      bh.healTick = Math.min(bh.healTick, 1);
      if (target && target !== f) {
        bh.crater = { x:target.x, y:target.y };
        target.data.galaxyRemoved = true;
        target.data.positionLocked = true;
        target.applyStatus('abilityDisabled', bh.timer + .08, { source:f });
      }
      G.blackholes ||= [];
      G.blackholes.push({ x:bh.crater.x, y:bh.crater.y, radius:136, life:bh.timer, maxLife:bh.timer, cracks:true });
      playGalaxySfx('bluehole', 0.78);
      spawnShockwave(bh.crater.x,bh.crater.y,'#05000a',240);
      cameraShake = Math.max(cameraShake, 12);
    }
    if (target && target !== f) {
      target.data.galaxyRemoved = true;
      target.x = bh.crater.x;
      target.y = bh.crater.y;
      target.data.positionLocked = true;
      target.applyStatus('abilityDisabled', .18, { source:f });
    }
    updatePlanetVisuals(f, target, dt);
    if (bh.healTick <= 0) {
      bh.healTick += 1;
      f.heal(0.5 * bh.total, false);
    }
    if (!bh.slammed && bh.timer <= 4.4) {
      bh.slammed = true;
      spawnShockwave(bh.crater.x,bh.crater.y,'#05000a',220);
    }
    if (bh.timer <= 0) {
      if (target && target !== f) {
        target.data.galaxyRemoved = false;
        if (target.statuses?.abilityDisabled?.source === f) delete target.statuses.abilityDisabled;
        target.x = clamp(bh.crater.x, target.radius, GAME_SIZE-target.radius);
        target.y = clamp(bh.crater.y, target.radius, GAME_SIZE-target.radius);
      }
      f.data.galaxyBlueholeRefined = null;
      f.data.galaxyState = 'READY';
    }
    return true;
  }
  function tryBlueholeRefined(f) {
    if (!f || f.name !== 'GALAXY' || f.hp <= 0 || (f.data.galaxyBlueholeCd||0) > 0 || f.data.galaxyBlueholeRefined || f.data.galaxyImpact) return;
    const e = enemyOf(f);
    if (!e || e.hp <= 0 || e.data.galaxyRemoved) return;
    const recent = x => (x.data.galaxyRecentDamage || []).filter(r => matchClock - r.t <= 0.05 && r.amount > 0);
    const fd = recent(f), ed = recent(e);
    if (!fd.length || !ed.length) return;
    const total = [...fd, ...ed].reduce((s,r)=>s+r.amount,0);
    f.data.galaxyBlueholeCd = 20;
    const n = norm(e.x - f.x, e.y - f.y);
    const dashEnd = {
      x: clamp(e.x - (n.x || 1) * (f.radius + e.radius + 18), f.radius, GAME_SIZE - f.radius),
      y: clamp(e.y - (n.y || 0) * (f.radius + e.radius + 18), f.radius, GAME_SIZE - f.radius)
    };
    f.data.galaxyBlueholeRefined = {
      phase:'dash',
      timer:5.24,
      holdTime:5,
      dashTimer:.24,
      dashMax:.24,
      healTick:1,
      total,
      start:{x:f.x,y:f.y},
      dashEnd,
      crater:{x:e.x,y:e.y},
      targetId:e.id,
      slammed:false
    };
    f.data.galaxyState = 'BLUEHOLE';
    f.data.galaxyThrowPhase = 'idle';
    f.data.galaxyPressureArmed = false;
    G.refinedTrails ||= [];
    G.refinedTrails.push({ type:'galaxy_afterimage', x:f.x, y:f.y, angle:Math.atan2(n.y,n.x), life:.45, maxLife:.45 });
    pushPressureTrail(f.x, f.y, dashEnd.x, dashEnd.y, .42);
  }

  galaxyType.update = function(f,e,dt) {
    f.data.galaxyFaceAngle = faceAngleToEnemy(f, e);
    f.data.galaxyBlueholeCd = Math.max(0, (f.data.galaxyBlueholeCd || 0) - dt);
    if (f.data.galaxyBluehole && !f.data.galaxyBlueholeRefined) {
      const old = f.data.galaxyBluehole;
      const crater = old.crater || (e ? {x:e.x,y:e.y} : {x:f.x,y:f.y});
      const target = fighters.find(q => q && q.id === ((e && e.id) || old.targetId)) || e;
      const n = norm(crater.x - f.x, crater.y - f.y);
      const dashEnd = target ? {
        x: clamp(crater.x - (n.x || 1) * (f.radius + target.radius + 18), f.radius, GAME_SIZE - f.radius),
        y: clamp(crater.y - (n.y || 0) * (f.radius + target.radius + 18), f.radius, GAME_SIZE - f.radius)
      } : {x:f.x,y:f.y};
      f.data.galaxyBlueholeRefined = {
        phase:'dash',
        timer:(old.timer || 5) + .24,
        holdTime:old.timer || 5,
        dashTimer:.24,
        dashMax:.24,
        healTick:old.healTick || 1,
        total:old.total || 0,
        start:{x:f.x,y:f.y},
        dashEnd,
        crater,
        targetId:(target && target.id) || old.targetId,
        slammed:!!old.slammed
      };
      f.data.galaxyBluehole = null;
    }
    if (updateBlueholeRefined(f,e,dt) || updateDivineRefined(f,e,dt) || updateImpactRefined(f,e,dt)) return;
    if (f.data.galaxyPressureWindow > 0) {
      updatePressureWindowRefined(f,e,dt);
      updatePlanetVisuals(f, e, dt);
      return;
    }
    if (canGalaxyAct(f)) updatePressureArmingRefined(f,e,dt);
    if (canGalaxyAct(f)) {
      updatePlanetReload(f, dt);
      updateGalaxyThrowRefined(f, e, dt);
      updatePlanetVisuals(f, e, dt);
    }
  };
  galaxyType.onCollide = function(f,e,dt,normal) {
    if (!f.data.galaxyPressureArmed || f.data.galaxyPressureWindow > 0 || f.data.galaxyPressureContactDone) return false;
    f.data.galaxyPressureContactDone = true;
    f.data.galaxyPressureArmed = false;
    f.data.galaxyPressureWindow = PRESSURE_TIME;
    f.data.galaxyWallHits = 0;
    f.data.galaxyThrowPhase = 'idle';
    f.data.galaxyState = 'PRESSURE_WINDOW';
    const n = normal ? norm(normal.x, normal.y) : norm(e.x - f.x, e.y - f.y);
    e.data.galaxyPressure = { ownerId:f.id, timer:PRESSURE_TIME, vx:n.x*1480, vy:n.y*1480, lastWall:null, lastHitAt:-99 };
    G.pressureRetracts ||= [];
    G.pressureRetracts.push({ ownerId:f.id, x:f.x, y:f.y, life:.72, maxLife:.72, seed:Math.random()*1000 });
    stopPressureWalk(f);
    playGalaxySfx('pressureContact', 0.9);
    return true;
  };
  galaxyType.draw = function(ctx,f) {
    const d = f.data || {};
    const baseRot = Math.atan2(f.dir?.y || 0, f.dir?.x || 1);
    const face = d.galaxyFaceAngle ?? baseRot;
    const drawRot = face - baseRot - Math.PI / 2;
    d.galaxyPlanetOrder ||= Array.from({ length: d.galaxyStacks || PLANET_MAX }, (_, i) => i);
    const stack = clamp(d.galaxyPlanetOrder.length, 0, PLANET_MAX);
    const activeThrow = d.galaxyThrowPhase !== 'idle' ? d.galaxyThrownIndex : -1;
    const drewSwirl = d.galaxyDivine && drawDivinePlanetSwirl(ctx, f, baseRot, d.galaxyDivine);
    const impactCharge = d.galaxyImpact && d.galaxyImpact.phase === 'charge';
    if (impactCharge) {
      const t = clamp((d.galaxyImpact.elapsed || 0) / IMPACT_CHARGE_TIME, 0, 1);
      const rr = lerp(180, 42, Math.pow(t, .72));
      const speed = lerp(9, 24, t);
      for (let i = 0; i < 4; i += 1) {
        const planetIndex = d.galaxyPlanetOrder?.[i] ?? i;
        const img = gImg(`planet${planetIndex}`);
        const ang = nowSec() * speed + i * TAU / 4;
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        const size = lerp(PLANET_ORBIT_SIZE * 1.14, 28, t);
        drawImageWorld(ctx, img, px, py, size, size, -baseRot + ang * .7, .96);
      }
    }
    for (let i = 0; !drewSwirl && !impactCharge && i < stack; i += 1) {
      const planetIndex = d.galaxyPlanetOrder[i] ?? i;
      const img = gImg(`planet${planetIndex}`);
      let p = orbitPoint(f, i, stack, d.galaxyThrowPhase !== 'idle' ? .18 : 0);
      let alpha = .96;
      if (planetIndex === activeThrow) {
        const start = orbitPoint(f, i, stack, 0);
        const end = throwStartPoint(f, enemyOf(f));
        const progress = d.galaxyThrowPhase === 'windup' ? clamp(1 - d.galaxyThrowTimer / .28, 0, 1) : 1;
        const ease = progress * progress * (3 - 2 * progress);
        p = { x:lerp(start.x,end.x,ease), y:lerp(start.y,end.y,ease) };
        alpha = d.galaxyThrowPhase === 'release' ? .25 : 1;
      }
      const visual = d.galaxyPlanetVisuals?.[planetIndex];
      if (visual) {
        p = { x:visual.x, y:visual.y };
        alpha *= clamp(visual.alpha ?? 1, 0, 1);
      }
      const local = worldDeltaToDrawLocal(p.x - f.x, p.y - f.y, baseRot);
      const pulse = 1 + Math.sin(nowSec() * 3 + i) * .035;
      drawImageWorld(ctx, img, local.x, local.y, PLANET_ORBIT_SIZE * pulse, PLANET_ORBIT_SIZE * pulse, nowSec() * .9 + i - baseRot, alpha);
    }
    ctx.save();
    ctx.rotate(drawRot);
    let size = BODY_SIZE;
    const spriteKey = galaxySpriteKey(f);
    if (spriteKey !== 'main') {
      size *= spriteKey === 'throw2' ? 1.17 : (spriteKey === 'divinePre' || spriteKey === 'divinePunch') ? 1.12 : 1.08;
    }
    if (d.galaxyImpact && d.galaxyImpact.phase === 'charge') {
      const t = clamp((d.galaxyImpact.elapsed || 0) / IMPACT_CHARGE_TIME, 0, 1);
      size = lerp(BODY_SIZE, BODY_SIZE_IMPACT, t);
      ctx.shadowColor = '#a99cff';
      ctx.shadowBlur = 22 + 24 * t;
    }
    if (!drawImageLocal(ctx, gImg(spriteKey), size, size)) drawSketchBlob(ctx, f.radius*1.16, '#221750', 14);
    ctx.restore();
  };

  const prevRefinedTakeDamage = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false) {
    if (this.data?.galaxyRemoved) return;
    if (source?.data?.galaxyRemoved) return;
    const before = this.hp;
    const sourceBefore = source ? (source.damageDone || 0) : 0;
    const result = prevRefinedTakeDamage.call(this, amount, source, label, statusDamage);
    const dealt = Math.max(0, before - this.hp);
    if (dealt > 0) {
      this.data ||= {};
      this.data.galaxyRecentDamage ||= [];
      this.data.galaxyRecentDamage.push({t:matchClock, amount:dealt, sourceId:source?.id, sourceType:source?.name, label});
      this.data.galaxyRecentDamage = this.data.galaxyRecentDamage.filter(r=>matchClock-r.t <= .35);
      const g = fighters.find(x => x && x.name === 'GALAXY');
      if (g) tryBlueholeRefined(g);
    }
    if (source?.name === 'GALAXY' && source !== this) {
      const actual = Math.max(0, (source.damageDone || 0) - sourceBefore);
      if (source.isRage && actual > 0) {
        source.data.galaxyRageDamageDone = (source.data.galaxyRageDamageDone || 0) + actual;
        source.data.galaxyRageReduction = Math.min(.8, source.data.galaxyRageDamageDone * .02);
      }
    }
    return result;
  };

  const prevRefinedUpdate = update;
  update = function(dt) {
    maintainGalaxySilence(dt);
    const galaxyCinematic = fighters.some(f => f && f.name === 'GALAXY' && (f.data?.galaxyDivine || f.data?.galaxyImpact));
    const iceWindupConflict = galaxyCinematic && fighters.some(f => f?.data?.iceAgeWindup);
    if (iceWindupConflict && timeScale < 1) timeScale = 1;
    if (G.blackholes) {
      for (const b of G.blackholes) b.life -= dt;
      G.blackholes = G.blackholes.filter(b => b.life > 0);
    }
    if (G.refinedTrails) {
      for (const tr of G.refinedTrails) tr.life -= dt;
      G.refinedTrails = G.refinedTrails.filter(tr => tr.life > 0);
    }
    if (G.planetImpacts) {
      for (const fx of G.planetImpacts) fx.life -= dt;
      G.planetImpacts = G.planetImpacts.filter(fx => fx.life > 0);
    }
    if (G.pressureRetracts) {
      for (const fx of G.pressureRetracts) fx.life -= dt;
      G.pressureRetracts = G.pressureRetracts.filter(fx => fx.life > 0);
    }
    const result = prevRefinedUpdate(dt);
    if (iceWindupConflict && timeScale < 1) timeScale = 1;
    applyParabolaZones();
    applyStrictSplitQuadrants();
    return result;
  };
  function pointInParabolaZone(z, f) {
    return pointInParabolaXY(z, f.x, f.y);
  }
  function pointInParabolaXY(z, px, py) {
    const dir = norm(z.dir.x, z.dir.y);
    const rel = {x:px - z.x, y:py - z.y};
    const x = rel.x * dir.x + rel.y * dir.y;
    const y = rel.x * (-dir.y) + rel.y * dir.x;
    if (x < 0 || x > z.length || Math.abs(y) > z.halfWidth) return false;
    const curveX = (y * y) / Math.max(1, z.curve);
    return x >= curveX;
  }
  function projectileTouchesParabola(z, p) {
    const pts = [];
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) pts.push({x:p.x,y:p.y});
    if (Number.isFinite(p.x1) && Number.isFinite(p.y1)) pts.push({x:p.x1,y:p.y1});
    if (Number.isFinite(p.x2) && Number.isFinite(p.y2)) pts.push({x:p.x2,y:p.y2});
    if (Number.isFinite(p.cx) && Number.isFinite(p.cy)) pts.push({x:p.cx,y:p.cy});
    if (!pts.length) return false;
    if (pts.some(pt => pointInParabolaXY(z, pt.x, pt.y))) return true;
    if (pts.length >= 2) {
      for (let i = 0; i < pts.length - 1; i += 1) {
        for (let s = 1; s < 6; s += 1) {
          const t = s / 6;
          if (pointInParabolaXY(z, lerp(pts[i].x, pts[i+1].x, t), lerp(pts[i].y, pts[i+1].y, t))) return true;
        }
      }
    }
    return false;
  }
  function purgeOpponentEffectsInParabola(z) {
    if (!z?.owner || !Array.isArray(projectiles)) return;
    projectiles = projectiles.filter(p => {
      if (!p || p.owner === z.owner || p.type === 'galaxy_planet') return true;
      if (p.owner?.name === 'ICE' && (p.type === 'ice_lane' || p.type === 'ice_age_field')) return true;
      if (!p.owner || !live(p.owner)) return true;
      return !projectileTouchesParabola(z, p);
    });
  }
  function applyParabolaZones() {
    for (const z of G.zones || []) {
      if (z.type !== 'galaxy_parabola') continue;
      purgeOpponentEffectsInParabola(z);
      const owner = z.owner;
      const enemy = owner ? enemyOf(owner) : null;
      if (!enemy || !pointInParabolaZone(z, enemy)) continue;
      const slow = clamp(.36 + (z.hits || 1) * .035, 0, .72);
      enemy.applyStatus('slow', .16, { mult:1-slow, source:owner });
      enemy.applyStatus('galaxyZoneWeak', .16, { mult:clamp(.82 - (z.hits || 1)*.025, .48, .82), source:owner });
    }
  }
  function quadrantOf(f) {
    return (f.x < 500 ? 0 : 1) + (f.y < 500 ? 0 : 2);
  }
  function applyStrictSplitQuadrants() {
    if (!G.split?.life) return;
    const close = clamp(G.split.life / Math.max(.001, G.split.maxLife || 1), 0, 1);
    const gap = ((G.split.gap || 88) * close) / 2;
    for (const f of fighters) {
      if (!f || f.hp <= 0 || f.data?.galaxyRemoved) continue;
      if (!G.split.quadrants.has(f.id)) G.split.quadrants.set(f.id, quadrantOf(f));
      const q = G.split.quadrants.get(f.id);
      const left = (q % 2 === 0) ? f.radius : 500 + gap;
      const right = (q % 2 === 0) ? 500 - gap : GAME_SIZE - f.radius;
      const top = (q < 2) ? f.radius : 500 + gap;
      const bottom = (q < 2) ? 500 - gap : GAME_SIZE - f.radius;
      if (f.x < left) { f.x = left; f.dir.x = Math.abs(f.dir.x); }
      if (f.x > right) { f.x = right; f.dir.x = -Math.abs(f.dir.x); }
      if (f.y < top) { f.y = top; f.dir.y = Math.abs(f.dir.y); }
      if (f.y > bottom) { f.y = bottom; f.dir.y = -Math.abs(f.dir.y); }
      f.dir = norm(f.dir.x, f.dir.y);
    }
  }

  const prevRefinedDrawProjectiles = drawProjectiles;
  drawProjectiles = function(ctx) {
    drawBlueholes(ctx);
    drawPressureWalkingVfx(ctx);
    drawDivineChargingFields(ctx);
    drawPlanetImpactVfx(ctx);
    const allZones = G.zones || [];
    const passthroughZones = allZones.filter(z => z.type !== 'galaxy_parabola');
    G.zones = passthroughZones;
    try {
      prevRefinedDrawProjectiles(ctx);
    } finally {
      G.zones = allZones;
    }
    drawParabolaZones(ctx);
    for (const tr of G.refinedTrails || []) {
      if (tr.type === 'galaxy_teleport_zigzag') drawTeleportZigzag(ctx, tr);
      else if (tr.type === 'galaxy_afterimage') drawGalaxyAfterimage(ctx, tr);
    }
  };
  function drawPlanetImpactVfx(ctx) {
    const effects = G.planetImpacts || [];
    if (!effects.length) return;
    for (const fx of effects) {
      const a = clamp(fx.life / fx.maxLife, 0, 1);
      const size = fx.radius * (1.05 + (1 - a) * .28);
      ctx.save();
      ctx.translate(fx.x, fx.y);
      ctx.globalAlpha = a;
      ctx.strokeStyle = `rgba(190,160,255,${.72*a})`;
      ctx.shadowColor = '#8b6dff';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, size * .23, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,112,86,${.54*a})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, size * .38 * (1.08 - a * .08), 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,235,180,${.34*a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * .53 * (1.14 - a * .12), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
  function buildMorphFieldPoints(field, morph) {
    const dir = norm(field.dir.x, field.dir.y);
    const steps = 112;
    const r = field.radius;
    const half = field.halfWidth;
    const outerBehind = -r * 1.35;
    const outerForward = field.length;
    const outerX = lerp(outerBehind, outerForward, morph);
    const pts = [];
    pts.push(localToWorld(field, dir, outerX, -half));
    pts.push(localToWorld(field, dir, outerX, half));
    for (let i = steps; i >= 0; i -= 1) {
      const y = lerp(-half, half, i / steps);
      const circleX = -r + Math.sqrt(Math.max(0, r*r - Math.min(r*r, y*y)));
      const parabolaX = (y * y) / Math.max(1, field.curve);
      const x = lerp(circleX, parabolaX, morph);
      pts.push(localToWorld(field, dir, x, y));
    }
    return pts;
  }
  function drawDivineChargingFields(ctx) {
    for (const f of fighters) {
      if (!f || f.name !== 'GALAXY' || !f.data?.galaxyDivine || f.data.galaxyDivine.punched) continue;
      const d = f.data.galaxyDivine;
      const field = d.preField;
      if (!field) continue;
      const fade = clamp(d.elapsed / Math.max(.1, DIVINE_PREP_TIME - .5), 0, 1);
      const morph = clamp((d.elapsed - (DIVINE_PREP_TIME - .5)) / .5, 0, 1);
      const pts = buildMorphFieldPoints(field, morph);
      ctx.save();
      ctx.beginPath();
      pts.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
      ctx.closePath();
      ctx.clip();
      const fieldImg = gImg('field');
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = (.22 + .74 * fade) * (0.96 - .025 * Math.sin(nowSec()*4));
      if (imgReady(fieldImg)) ctx.drawImage(fieldImg, 0, 0, GAME_SIZE, GAME_SIZE);
      ctx.globalAlpha = (.035 + .055 * fade) * (1 - morph * .25);
      ctx.fillStyle = 'rgba(255,178,92,.95)';
      ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);
      ctx.restore();
    }
  }
  function drawBlueholes(ctx) {
    for (const b of G.blackholes || []) {
      const a = clamp(b.life / b.maxLife, 0, 1);
      const r = b.radius * (1.08 - .08 * a);
      ctx.save();
      const grd = ctx.createRadialGradient(b.x,b.y,8,b.x,b.y,r);
      grd.addColorStop(0,'rgba(0,0,0,.98)');
      grd.addColorStop(.62,'rgba(6,0,16,.94)');
      grd.addColorStop(1,`rgba(105,75,170,${.34*a})`);
      ctx.fillStyle = grd;
      ctx.shadowColor = '#07000d';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(b.x,b.y,r,0,TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(16,0,24,${.95*a})`;
      ctx.lineWidth = 12;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(b.x,b.y,r*.82,0,TAU);
      ctx.stroke();
      const cracks = 18;
      for (let i = 0; i < cracks; i += 1) {
        const seed = i * 9.731 + (b.x + b.y) * .017;
        const ang = i * TAU / cracks + Math.sin(seed) * .18;
        const len = r * lerp(.45, 1.2, Math.abs(Math.sin(seed * 2.3)));
        const start = r * lerp(.38, .68, Math.abs(Math.sin(seed * 1.4)));
        const steps = 4;
        ctx.strokeStyle = `rgba(9,0,16,${.78*a})`;
        ctx.lineWidth = lerp(2.5, 7, Math.abs(Math.sin(seed * 4.2)));
        ctx.shadowColor = 'rgba(0,0,0,.95)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let j = 0; j <= steps; j += 1) {
          const k = j / steps;
          const rr = lerp(start, len, k);
          const wob = Math.sin(seed + j * 2.9 + nowSec() * 1.3) * 10 * (1-k*.35);
          const x = Math.cos(ang) * rr + Math.cos(ang + Math.PI/2) * wob;
          const y = Math.sin(ang) * rr + Math.sin(ang + Math.PI/2) * wob;
          j ? ctx.lineTo(b.x + x, b.y + y) : ctx.moveTo(b.x + x, b.y + y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawPressureWalkingVfx(ctx) {
    const lineImg = refinedTeleportLineImage;
    for (const fx of G.pressureRetracts || []) {
      const owner = fighters.find(q => q && q.id === fx.ownerId && q.hp > 0);
      const cx = owner ? owner.x : fx.x;
      const cy = owner ? owner.y : fx.y;
      const aLife = clamp(fx.life / fx.maxLife, 0, 1);
      const pull = 1 - aLife;
      const bolts = 9;
      for (let i = 0; i < bolts; i += 1) {
        const seed = (fx.seed || 0) + i * 15.37;
        const ang = seed + i * TAU / bolts;
        const far = lerp(GAME_SIZE * .62, owner ? owner.radius * .7 : 70, pull);
        const start = { x:cx + Math.cos(ang) * far, y:cy + Math.sin(ang) * far };
        const pts = [start];
        const segs = 5;
        for (let j = 1; j <= segs; j += 1) {
          const k = j / segs;
          const bx = lerp(start.x, cx, k);
          const by = lerp(start.y, cy, k);
          const bend = Math.sin(seed + j * 4.9 + nowSec() * 8) * 32 * aLife * (1 - k * .25);
          pts.push({ x:bx + Math.cos(ang + Math.PI/2) * bend, y:by + Math.sin(ang + Math.PI/2) * bend });
        }
        ctx.save();
        ctx.globalAlpha = .55 * aLife;
        ctx.strokeStyle = 'rgba(4,0,2,.92)';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((p, idx) => idx ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.stroke();
        ctx.strokeStyle = 'rgba(190,25,30,.72)';
        ctx.shadowColor = '#b80f19';
        ctx.shadowBlur = 9;
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        pts.forEach((p, idx) => idx ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.stroke();
        ctx.restore();
      }
    }
    for (const f of fighters) {
      if (!f || f.name !== 'GALAXY' || !f.data?.galaxyPressureArmed || f.data.galaxyPressureWindow > 0 || f.hp <= 0) continue;
      const t = nowSec();
      const bolts = 7;
      for (let i = 0; i < bolts; i += 1) {
        const cycle = Math.floor(t * 6.2 + i * .31);
        const seed = i * 19.191 + cycle * 73.73;
        const pulse = clamp((Math.sin(t * 8.2 + i * 2.17) + 1) * .5, 0, 1);
        if (pulse < .46) continue;
        const jitter = Math.sin(seed) * .72 + Math.sin(seed * 1.7) * .32;
        const a = t * .38 + i * TAU / bolts + jitter;
        const reach = .25 + .75 * Math.abs(Math.sin(seed * 2.31));
        const len = lerp(f.radius * 2.4, GAME_SIZE * 1.12, reach) * lerp(.55, 1, pulse);
        const segs = 4 + Math.floor(Math.abs(Math.sin(seed * 3.7)) * 3);
        const pts = [{x:f.x, y:f.y}];
        for (let j = 1; j <= segs; j += 1) {
          const k = j / segs;
          const bend = Math.sin(seed + j * 4.71 + t * 9.3) * lerp(34, 94, reach) * (1 - k * .1);
          const bx = Math.cos(a) * len * k + Math.cos(a + Math.PI/2) * bend;
          const by = Math.sin(a) * len * k + Math.sin(a + Math.PI/2) * bend;
          pts.push({x:f.x + bx, y:f.y + by});
        }
        ctx.save();
        ctx.globalAlpha = .34 + .28 * pulse;
        ctx.strokeStyle = 'rgba(10,0,0,.92)';
        ctx.lineWidth = 13 + 10 * reach;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((p, idx) => idx ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.stroke();
        ctx.strokeStyle = 'rgba(174,22,28,.72)';
        ctx.shadowColor = '#9e0e18';
        ctx.shadowBlur = 12 + 8 * reach;
        ctx.lineWidth = 3.8 + 3.2 * reach;
        ctx.beginPath();
        pts.forEach((p, idx) => idx ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.stroke();
        ctx.restore();
        if (imgReady(lineImg)) {
          for (let j = 0; j < pts.length - 1; j += 1) {
            const p0 = pts[j], p1 = pts[j + 1];
            const l = dist(p0.x,p0.y,p1.x,p1.y);
            drawImageWorld(ctx, lineImg, (p0.x+p1.x)/2, (p0.y+p1.y)/2, l * 1.2, 30 + 15 * reach, Math.atan2(p1.y-p0.y,p1.x-p0.x), .24 + .16 * pulse);
          }
        }
      }
    }
  }
  function drawParabolaZones(ctx) {
    for (const z of G.zones || []) {
      if (z.type !== 'galaxy_parabola') continue;
      if (!z.dir || !Number.isFinite(z.dir.x) || !Number.isFinite(z.dir.y)) continue;
      const a = clamp(z.life / z.maxLife, 0, 1);
      const dir = norm(z.dir.x,z.dir.y);
      const pts = [];
      const steps = 128;
      pts.push(localToWorld(z, dir, z.length, -z.halfWidth));
      pts.push(localToWorld(z, dir, z.length, z.halfWidth));
      for (let i = steps; i >= 0; i -= 1) {
        const y = lerp(-z.halfWidth, z.halfWidth, i / steps);
        const x = (y * y) / Math.max(1, z.curve);
        pts.push(localToWorld(z, dir, x, y));
      }
      ctx.save();
      ctx.beginPath();
      pts.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
      ctx.closePath();
      ctx.clip();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = .88 * a;
      const field = gImg('field');
      if (imgReady(field)) ctx.drawImage(field, 0, 0, GAME_SIZE, GAME_SIZE);
      ctx.globalAlpha = .12 * a;
      ctx.fillStyle = 'rgba(255,210,132,.95)';
      ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);
      ctx.restore();
    }
  }
  function drawImpactSplitCracks(ctx) {
    if (!G.split?.life) return;
    const a = clamp(G.split.life / G.split.maxLife, 0, 1);
    const open = 1 - a;
    const gap = (G.split.gap || 88) * (0.08 + 0.94 * a) * (0.86 + 0.18 * Math.sin((1 - a) * Math.PI));
    const t = nowSec();
    ctx.save();
    ctx.globalAlpha = .78 + .18 * a;
    ctx.fillStyle = 'rgba(2,1,6,.78)';
    ctx.fillRect(500 - gap * .48, 0, gap * .96, GAME_SIZE);
    ctx.fillRect(0, 500 - gap * .48, GAME_SIZE, gap * .96);
    ctx.globalCompositeOperation = 'source-over';
    const drawFault = (vertical, side) => {
      const pts = [];
      const steps = 28;
      for (let i = 0; i <= steps; i += 1) {
        const k = i / steps;
        const base = k * GAME_SIZE;
        const wobble = Math.sin(k * 22 + side * 1.7 + t * .6) * (12 + 14 * open)
          + Math.sin(k * 61 + side * 3.1) * (7 + 10 * open);
        const split = side * (gap * .55 + wobble);
        pts.push(vertical ? {x:500 + split, y:base} : {x:base, y:500 + split});
      }
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(3,0,10,.98)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      pts.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,92,76,${.42 + .24 * a})`;
      ctx.shadowColor = '#ff503b';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 5;
      ctx.beginPath();
      pts.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
      ctx.stroke();
      ctx.strokeStyle = `rgba(204,170,255,${.34 + .22 * a})`;
      ctx.shadowColor = '#8b6dff';
      ctx.shadowBlur = 20;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      pts.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
      ctx.stroke();
      ctx.restore();
      for (let i = 3; i < steps; i += 4) {
        const p = pts[i];
        const branchLen = 46 + 82 * Math.abs(Math.sin(i * 7.31 + side));
        const branchSide = (i % 8 < 4 ? -1 : 1) * side;
        const ang = (vertical ? 0 : Math.PI / 2) + branchSide * lerp(.34, .72, Math.abs(Math.sin(i * 2.9)));
        ctx.save();
        ctx.strokeStyle = `rgba(255,108,80,${.18 + .25 * a})`;
        ctx.lineWidth = 2.5 + 2 * Math.abs(Math.sin(i + t));
        ctx.shadowColor = '#ff452d';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(ang) * branchLen, p.y + Math.sin(ang) * branchLen);
        ctx.stroke();
        ctx.restore();
      }
    };
    drawFault(true, -1);
    drawFault(true, 1);
    drawFault(false, -1);
    drawFault(false, 1);
    ctx.restore();
  }
  function drawImpactChargeField(ctx) {
    if (!G.impact?.charge) return;
    const t = clamp(1 - G.impact.timer / G.impact.maxTimer, 0, 1);
    const fast = Math.pow(t, .48);
    const scale = lerp(1, .42, fast);
    ctx.save();
    ctx.translate(500,500);
    ctx.scale(scale,scale);
    ctx.translate(-500,-500);
    ctx.globalAlpha = .42 + .32 * fast;
    ctx.fillStyle = `rgba(9,4,22,${.18 + .28*fast})`;
    ctx.fillRect(-760,-760,GAME_SIZE+1520,GAME_SIZE+1520);
    ctx.strokeStyle = `rgba(174,160,255,${.20 + .28*fast})`;
    ctx.lineWidth = 2;
    const step = lerp(50, 31, fast);
    for (let x = -760; x <= GAME_SIZE + 760; x += step) {
      ctx.beginPath(); ctx.moveTo(x,-760); ctx.lineTo(x,GAME_SIZE+760); ctx.stroke();
    }
    for (let y = -760; y <= GAME_SIZE + 760; y += step) {
      ctx.beginPath(); ctx.moveTo(-760,y); ctx.lineTo(GAME_SIZE+760,y); ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = .20 + .18 * fast;
    ctx.fillStyle = '#05020c';
    ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);
    ctx.restore();
  }

  const prevRefinedDrawBackground = drawBackground;
  drawBackground = function(ctx) {
    prevRefinedDrawBackground(ctx);
    if (G.impact?.charge) {
      const t = clamp(1 - G.impact.timer / G.impact.maxTimer, 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(9,4,22,${.22 + .32*t})`;
      ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);
      ctx.restore();
      drawImpactChargeField(ctx);
    }
    drawImpactSplitCracks(ctx);
  };

  const prevRefinedFighterDraw = Fighter.prototype.draw;
  Fighter.prototype.draw = function(ctx) {
    if (this.data?.galaxyRemoved) return;
    const impact = G.impact?.charge;
    const galaxy = fighters.find(f => f && f.name === 'GALAXY');
    if (G.split?.life > 0) {
      const t = clamp(G.split.life / G.split.maxLife, 0, 1);
      const s = lerp(.72, 1, 1 - t);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(s, s);
      ctx.translate(-this.x, -this.y);
      const r = prevRefinedFighterDraw.call(this, ctx);
      ctx.restore();
      return r;
    }
    if (impact && galaxy && this !== galaxy) {
      const t = clamp(1 - G.impact.timer / G.impact.maxTimer, 0, 1);
      const s = lerp(1, .46, Math.pow(t, .5));
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(s, s);
      ctx.translate(-this.x, -this.y);
      const r = prevRefinedFighterDraw.call(this, ctx);
      ctx.restore();
      return r;
    }
    return prevRefinedFighterDraw.call(this, ctx);
  };

  const prevImpactScaledDrawProjectiles = drawProjectiles;
  drawProjectiles = function(ctx) {
    const impact = G.impact?.charge;
    const galaxy = fighters.find(f => f && f.name === 'GALAXY');
    if (impact && galaxy) {
      const t = clamp(1 - G.impact.timer / G.impact.maxTimer, 0, 1);
      const s = lerp(1, .46, Math.pow(t, .5));
      ctx.save();
      ctx.translate(GAME_SIZE / 2, GAME_SIZE / 2);
      ctx.scale(s, s);
      ctx.translate(-GAME_SIZE / 2, -GAME_SIZE / 2);
      const r = prevImpactScaledDrawProjectiles(ctx);
      ctx.restore();
      return r;
    }
    return prevImpactScaledDrawProjectiles(ctx);
  };

  const prevRefinedStart = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts = {}) {
    G.blackholes = [];
    G.refinedTrails = [];
    G.planetImpacts = [];
    G.pressureRetracts = [];
    G.silenceTimer = 0;
    return prevRefinedStart(ft1, ft2, opts);
  };
  exposeApexGlobal('startSpecificMatch', startSpecificMatch);
  Object.assign(window.apexReactBridge || {}, { startSpecificMatch });
  window.startSpecificMatch = startSpecificMatch;
})();
