// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function GALAXY_REPLACES_NOVA_PATCH(){
  const GALAXY_BASE = '/assets/galaxy_v1';
  const gPath = (folder, name) => `${GALAXY_BASE}/${folder}/${encodeURIComponent(name)}`;
  const GALAXY_IMAGE_FILES = {
    main: 'main visual.webp',
    throw1: 'planet throw frame 1.webp',
    throw2: 'PLANET THROW FRAME 2.webp',
    pressureBefore: 'pressure visual before touch component.webp',
    pressureTouch: 'pressure visual touch component.webp',
    divinePre: 'GALAXY DIVINE TELEPORT AND BEFORE PUNCH.webp',
    divinePunch: 'GALAXY DIVINE.webp',
    impact: 'GALAXY IMPACT.webp',
    teleportLine: 'TELEPORT LINE.webp',
    zone: 'VISUAL FOR THE ZONE OF GALAXY DIVINE.webp',
    field: 'VISUAL FOR FULL OF BATTLE FIELD WHEN USE GALAXY IMPACT.webp',
    planet0: '95a3fae5-da8a-4169-b2d0-1432e72dfdef.webp',
    planet1: 'ef504fdf-95a6-49ca-8fe7-ad23c835d0db.webp',
    planet2: '84b87c41-679b-4cfa-90e4-1602709dcc88.webp',
    planet3: '64e9fc08-8e47-4c3d-911e-99c40158a941.webp',
    planet4: '129f515e-e273-4a57-bc3b-cc20a1232654.webp'
  };
  const GALAXY_AUDIO_FILES = {
    throw: 'planet_throwing_sound_effect.wav',
    explosion: 'planet_explosion_sound_effect.wav',
    pressureWalk: 'pressure_walking.wav',
    pressureContact: 'galaxy_pressure_contact.wav',
    wall: 'wall touch of component when hitted by pressure. ALSO for bluehole.mp3',
    divine: 'Sound_effect_for_galaxy_divine.wav',
    impact: 'GALAXY_IMPACT.wav',
    rage: 'RAGE.mp3',
    bluehole: 'BLUEHOLE.mp3'
  };
  const G = window.APEX_GALAXY = window.APEX_GALAXY || {
    images: {}, audio: {}, zones: [], trails: [], impact: null, split: null,
    paused: false, pauseStateBefore: null, report: {
      ninjaSpeedSource: 'No NINJA/shuriken speed exists in this runtime; fallback shuriken speed 900 was used, so planet speed is 540.',
      planetSpeed: 540,
      timings: { throwWindup: 0.15, throwReleaseHold: 0.12, pressureWindow: 3, divineFreeze: 7, impactCharge: 5, terrainDuration: 5, blueholeRemoved: 5 }
    }
  };
  for (const [key, file] of Object.entries(GALAXY_IMAGE_FILES)) {
    if (!G.images[key]) {
      const img = new Image();
      img.decoding = 'async';
      img.src = gPath('images', file);
      G.images[key] = img;
    }
  }
  async function decodeGalaxyAudioKey(key){
    if (Object.prototype.hasOwnProperty.call(G.audio, key)) return G.audio[key];
    G.audioPromises ||= {};
    if (G.audioPromises[key]) return G.audioPromises[key];
    const file = GALAXY_AUDIO_FILES[key];
    if (!file) return null;
    G.audioPromises[key] = (async () => {
      try {
        const res = await fetch(gPath('audio', file), { cache: 'force-cache' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const arr = await res.arrayBuffer();
        G.audio[key] = await audioCtx.decodeAudioData(arr.slice(0));
      } catch (error) {
        console.warn('[GALAXY audio] failed', file, error);
        G.audio[key] = null;
      }
      return G.audio[key];
    })();
    return G.audioPromises[key];
  }
  G.ensureAudio = decodeGalaxyAudioKey;
  function playGalaxySound(key, opts = {}) {
    if (window.__apexStatsSilent) return null;
    try { if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (error) {}
    const buffer = G.audio[key];
    if (!buffer) {
      decodeGalaxyAudioKey(key).then(decoded => {
        if (decoded) playGalaxySound(key, opts);
      });
      return null;
    }
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = buffer;
    src.loop = !!opts.loop;
    gain.gain.value = opts.volume ?? 0.85;
    src.connect(gain); gain.connect(audioCtx.destination);
    if (window.__apexRecordingAudioDestination) gain.connect(window.__apexRecordingAudioDestination);
    src.start();
    const handle = { src, gain, stopped:false };
    G.activeSounds ||= new Set();
    G.activeSounds.add(handle);
    src.onended = () => G.activeSounds.delete(handle);
    handle.fadeOut = (seconds = 0.25) => {
      if (handle.stopped) return;
      handle.stopped = true;
      const now = audioCtx.currentTime;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + seconds);
        src.stop(now + seconds + 0.02);
      } catch (error) {}
    };
    return handle;
  }
  window.apexPauseGalaxyAudio = function(paused) {
    try { paused ? audioCtx.suspend() : audioCtx.resume(); } catch (error) {}
  };

  const FT = n => FighterTypes.find(f => f.name === n);
  const legacyNova = FT('NOVA') || FT('GALAXY');
  if (!legacyNova) return;
  legacyNova.name = 'GALAXY';
  legacyNova.color = '#7f6dff';
  legacyNova.desc = 'Heavy galaxy fist brawler: planet stacks, pressure, Divine, Impact, Bluehole';
  legacyNova.speed = 360;
  legacyNova.startDx = 1;
  legacyNova.startDy = 0.82;
  SOUND_ID.GALAXY = { base: 88, wave: 'sawtooth', bend: 1.8, noise: 0.07 };
  delete SOUND_ID.NOVA;

  function getGalaxy(f){ return f && f.name === 'GALAXY' ? f : null; }
  function gEnemy(f){ return fighters.find(x => x && f && x.id !== f.id && !x.data?.galaxyRemoved); }
  function galaxyCanAct(f) {
    return f && f.hp > 0 && !G.paused && !f.data.galaxyBluehole && !f.data.galaxyRemoved && !f.data.galaxyDivine && !f.data.galaxyImpact && !f.hasStatus?.('abilityDisabled') && gameState === 'PLAYING';
  }
  function getGalaxyPlanetSpeed() { return G.report.planetSpeed; }
  function drawImg(ctx, img, w, h, alpha = 1) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(img, -w/2, -h/2, w, h); ctx.restore();
    return true;
  }
  function drawImgWorld(ctx, img, x, y, w, h, rot = 0, alpha = 1) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.globalAlpha *= alpha; ctx.drawImage(img, -w/2, -h/2, w, h); ctx.restore();
    return true;
  }
  function galaxySpriteKey(f) {
    const d = f.data || {};
    if (d.galaxyImpact) return 'impact';
    if (d.galaxyDivine) return d.galaxyDivine.phase === 'punch' ? 'divinePunch' : 'divinePre';
    if (d.galaxyPressureWindow > 0) return 'pressureTouch';
    if (d.galaxyPressureArmed) return 'pressureBefore';
    if (d.galaxyThrowPhase === 'release') return 'throw2';
    if (d.galaxyThrowPhase === 'windup') return 'throw1';
    return 'main';
  }
  function initGalaxy(f) {
    f.data.galaxyStacks = 5;
    f.data.galaxyReload = 0;
    f.data.galaxyThrowCd = 2;
    f.data.galaxyThrowPhase = 'idle';
    f.data.galaxyThrowTimer = 0;
    f.data.galaxyPressureCd = 15;
    f.data.galaxyPressureArmed = false;
    f.data.galaxyPressureWindow = 0;
    f.data.galaxyWallHits = 0;
    f.data.galaxyRecentDamage = [];
    f.data.galaxyBlueholeCd = 0;
    f.data.galaxyRageDamageDone = 0;
    f.data.galaxyRageReduction = 0;
    f.data.galaxyState = 'READY';
  }
  legacyNova.init = initGalaxy;
  legacyNova.speedModifier = f => f.data.galaxyPressureArmed ? 0.2 : 1;
  legacyNova.onRage = f => {
    f.data.galaxyRageDamageDone = 0;
    f.data.galaxyRageReduction = 0;
    if (!f.data.galaxyRageSoundPlayed) {
      f.data.galaxyRageSoundPlayed = true;
      playGalaxySound('rage', { volume: 0.9 });
    }
  };
  legacyNova.update = function(f,e,dt) {
    f.data.galaxyBlueholeCd = Math.max(0, (f.data.galaxyBlueholeCd || 0) - dt);
    if (f.data.galaxyReload > 0) {
      f.data.galaxyReload = Math.max(0, f.data.galaxyReload - dt);
      if (f.data.galaxyReload <= 0) f.data.galaxyStacks = 5;
    }
    if (updateGalaxyBluehole(f,e,dt) || updateGalaxyDivine(f,e,dt) || updateGalaxyImpact(f,e,dt)) return;
    if (f.data.galaxyPressureWindow > 0) {
      updateGalaxyPressureWindow(f,e,dt);
      return;
    }
    if (galaxyCanAct(f)) updateGalaxyPressureArming(f, dt);
    if (galaxyCanAct(f)) updateGalaxyThrow(f, e, dt);
  };
  legacyNova.onCollide = function(f,e,dt,normal) {
    if (!f.data.galaxyPressureArmed || f.data.galaxyPressureWindow > 0 || f.data.galaxyPressureContactDone) return false;
    f.data.galaxyPressureContactDone = true;
    f.data.galaxyPressureArmed = false;
    f.data.galaxyPressureWindow = 3;
    f.data.galaxyWallHits = 0;
    f.data.galaxyState = 'PRESSURE_WINDOW';
    const n = normal ? norm(normal.x, normal.y) : norm(e.x - f.x, e.y - f.y);
    e.data.galaxyPressure = { ownerId:f.id, timer:3, vx:n.x*1480, vy:n.y*1480, lastWall:null, lastHitAt:-99 };
    playGalaxySound('pressureContact', { volume: 0.95 });
    if (f.data.galaxyPressureWalkSound) f.data.galaxyPressureWalkSound.fadeOut(3);
    floatingTexts.push(new FloatingText(e.x, e.y-e.radius-78, 'PRESSURE LAUNCH', '#bdb6ff'));
    return true;
  };
  legacyNova.draw = function(ctx,f) {
    const d = f.data || {};
    const bodyW = 176, bodyH = 176;
    const stack = Math.max(0, Math.min(5, d.galaxyStacks || 0));
    for (let i=0;i<stack;i++) {
      const a = -Math.PI*0.72 + i*(Math.PI*1.44/4);
      const px = Math.cos(a)*118 - 18;
      const py = Math.sin(a)*86;
      const img = G.images[`planet${i}`];
      drawImgWorld(ctx, img, px, py, 42, 42, Date.now()/700 + i, 0.95);
    }
    if (!drawImg(ctx, G.images[galaxySpriteKey(f)], bodyW, bodyH)) {
      drawSketchBlob(ctx, f.radius*1.15, '#221750', 14);
      ctx.fillStyle = '#d9d2ff'; ctx.font = '900 18px monospace'; ctx.textAlign = 'center'; ctx.fillText('GALAXY', 0, 6);
    }
  };

  function updateGalaxyThrow(f,e,dt) {
    if (f.data.galaxyThrowPhase === 'idle') {
      f.data.galaxyThrowCd -= dt;
      if (f.data.galaxyThrowCd <= 0 && f.data.galaxyStacks > 0 && e) {
        f.data.galaxyThrowPhase = 'windup';
        f.data.galaxyThrowTimer = 0.15;
        f.setDir(e.x-f.x, e.y-f.y);
      }
      return;
    }
    f.data.galaxyThrowTimer -= dt;
    if (f.data.galaxyThrowPhase === 'windup' && f.data.galaxyThrowTimer <= 0) {
      f.data.galaxyThrowPhase = 'release';
      f.data.galaxyThrowTimer = 0.12;
      releaseGalaxyPlanet(f,e);
      return;
    }
    if (f.data.galaxyThrowPhase === 'release' && f.data.galaxyThrowTimer <= 0) {
      f.data.galaxyThrowPhase = 'idle';
      f.data.galaxyThrowCd = 2;
    }
  }
  function releaseGalaxyPlanet(f,e) {
    if (!e || f.data.galaxyStacks <= 0) return;
    const planetIndex = 5 - f.data.galaxyStacks;
    f.data.galaxyStacks -= 1;
    if (f.data.galaxyStacks <= 0) f.data.galaxyReload = 5;
    const n = norm(e.x-f.x, e.y-f.y);
    const hand = { x:f.x + n.x*(f.radius+42), y:f.y + n.y*(f.radius+8) };
    const speed = getGalaxyPlanetSpeed();
    projectiles.push({ type:'galaxy_planet', owner:f, x:hand.x, y:hand.y, vx:n.x*speed, vy:n.y*speed, radius:30, life:4.2, maxLife:4.2, planetIndex, exploded:false, hitIds:{} });
    playGalaxySound('throw', { volume: 0.78 });
  }
  function updateGalaxyPressureArming(f, dt) {
    if (f.data.galaxyPressureArmed) {
      f.data.galaxyState = 'PRESSURE_ARMED';
      return;
    }
    f.data.galaxyPressureCd -= dt;
    if (f.data.galaxyPressureCd <= 0) {
      f.data.galaxyPressureArmed = true;
      f.data.galaxyPressureContactDone = false;
      f.data.galaxyPressureWalkSound = playGalaxySound('pressureWalk', { loop:true, volume:0.34 });
      floatingTexts.push(new FloatingText(f.x, f.y-f.radius-84, 'PRESSURE ARMED', '#bdb6ff'));
    }
  }
  function countGalaxyWall(f, side, x, y) {
    const now = matchClock;
    if (side && (side !== f.data.galaxyLastWall || now - (f.data.galaxyLastWallTime || -99) >= 0.15)) {
      f.data.galaxyLastWall = side;
      f.data.galaxyLastWallTime = now;
      f.data.galaxyWallHits = (f.data.galaxyWallHits || 0) + 1;
      playGalaxySound('wall', { volume: 0.72 });
      floatingTexts.push(new FloatingText(x, y-40, `WALL ${f.data.galaxyWallHits}`, '#d9d2ff'));
    }
  }
  function updateGalaxyPressureWindow(f,e,dt) {
    if (e && e.data.galaxyPressure?.ownerId === f.id) {
      const p = e.data.galaxyPressure;
      e.x += p.vx * dt; e.y += p.vy * dt;
      let side = null;
      if (e.x < e.radius) { e.x = e.radius; p.vx = Math.abs(p.vx)*0.94; side = 'left'; }
      if (e.x > GAME_SIZE-e.radius) { e.x = GAME_SIZE-e.radius; p.vx = -Math.abs(p.vx)*0.94; side = 'right'; }
      if (e.y < e.radius) { e.y = e.radius; p.vy = Math.abs(p.vy)*0.94; side = 'top'; }
      if (e.y > GAME_SIZE-e.radius) { e.y = GAME_SIZE-e.radius; p.vy = -Math.abs(p.vy)*0.94; side = 'bottom'; }
      p.vx *= 1.003; p.vy *= 1.003;
      if (typeof e.setDir === 'function') e.setDir(p.vx, p.vy);
      else if (typeof e.realFighter?.setDir === 'function') e.realFighter.setDir(p.vx, p.vy);
      e.data.positionLocked = true;
      if (side) countGalaxyWall(f, side, e.x, e.y);
    }
    f.data.galaxyPressureWindow -= dt;
    if (f.data.galaxyPressureWindow <= 0) {
      const hits = f.data.galaxyWallHits || 0;
      if (e?.data.galaxyPressure?.ownerId === f.id) delete e.data.galaxyPressure;
      if (hits >= 9) startGalaxyImpact(f,e,hits);
      else if (hits >= 1) startGalaxyDivine(f,e,hits);
      else endGalaxyPressure(f);
    }
  }
  function endGalaxyPressure(f) {
    f.data.galaxyPressureWindow = 0;
    f.data.galaxyPressureArmed = false;
    f.data.galaxyPressureCd = 15;
    f.data.galaxyWallHits = 0;
    if (!f.data.galaxyDivine && !f.data.galaxyImpact && !f.data.galaxyBluehole) f.data.galaxyState = 'READY';
    if (f.data.galaxyPressureWalkSound) { f.data.galaxyPressureWalkSound.fadeOut(0.2); f.data.galaxyPressureWalkSound = null; }
  }
  function startGalaxyDivine(f,e,hits) {
    playGalaxySound('divine', { volume: 0.95 });
    const old = {x:f.x,y:f.y};
    const dir = e ? norm(e.x-f.x, e.y-f.y) : norm(f.dir.x,f.dir.y);
    const nx = dir.x || 1, ny = dir.y || 0;
    if (e) {
      f.x = clamp(e.x - nx*(f.radius+e.radius+8), f.radius, GAME_SIZE-f.radius);
      f.y = clamp(e.y - ny*(f.radius+e.radius+8), f.radius, GAME_SIZE-f.radius);
      f.setDir(e.x-f.x,e.y-f.y);
    }
    G.trails.push({x1:old.x,y1:old.y,x2:f.x,y2:f.y,life:1.8,maxLife:1.8});
    f.data.galaxyDivine = { timer:7, hits, phase:'pre', punchAt:1.2, punched:false, worldFreeze:7.2, dir:{x:nx,y:ny}, contact:e?{x:e.x,y:e.y}:{x:f.x+nx*80,y:f.y+ny*80} };
    f.data.galaxyState = 'DIVINE';
    endGalaxyPressure(f);
  }
  function updateGalaxyDivine(f,e,dt) {
    const d = f.data.galaxyDivine;
    if (!d) return false;
    d.worldFreeze = Math.max(0, (d.worldFreeze || 0) - dt);
    d.timer -= dt;
    if (!d.punched && d.timer <= 7 - d.punchAt) {
      d.phase = 'punch';
      d.punched = true;
      d.worldFreeze = Math.max(d.worldFreeze, .75);
      const dmg = 5 + d.hits * 5;
      if (e && e.hp > 0) e.takeDamage(dmg, f, 'galaxy-divine');
      createGalaxyUZone(f, e, d);
      spawnShockwave(d.contact.x, d.contact.y, '#a79cff', 260);
      triggerFlash(160,120,255,.26);
    }
    if (d.timer <= 0) {
      f.data.galaxyDivine = null;
      f.data.galaxyState = 'READY';
    }
    return true;
  }
  function createGalaxyUZone(f,e,d) {
    const hits = d.hits;
    G.zones.push({ type:'u', owner:f, x:d.contact.x, y:d.contact.y, dir:d.dir, hits, life:5, maxLife:5, w:260+hits*34, h:220+hits*28, thick:68 });
  }
  function startGalaxyImpact(f,e,hits) {
    if (G.split?.life > 0 || f.data.galaxyImpact) { endGalaxyPressure(f); return; }
    playGalaxySound('impact', { volume: 0.95 });
    f.x = GAME_SIZE/2; f.y = GAME_SIZE/2; f.setDir(1,0);
    f.data.galaxyImpact = { timer:5, elapsed:0, startedAt:nowSec(), hits, phase:'charge', punched:false };
    f.data.galaxyState = 'IMPACT';
    G.impact = { owner:f, timer:5, maxTimer:5, startedAt:nowSec() };
    endGalaxyPressure(f);
  }
  function updateGalaxyImpact(f,e,dt) {
    const im = f.data.galaxyImpact;
    if (!im) return false;
    const realElapsed = Math.max(im.elapsed || 0, nowSec() - (im.startedAt || nowSec()));
    im.elapsed = realElapsed;
    im.timer = Math.max(0, 5 - realElapsed);
    if (G.impact) G.impact.timer = im.timer;
    if (!im.punched && im.timer <= 0) {
      im.punched = true;
      im.phase = 'split';
      const maxEdge = Math.hypot(GAME_SIZE/2, GAME_SIZE/2);
      const ed = e ? dist(e.x,e.y,GAME_SIZE/2,GAME_SIZE/2) : maxEdge;
      const dmg = lerp(50 + Math.max(0, im.hits - 6)*5, 30, clamp(ed/maxEdge,0,1));
      if (e && e.hp > 0) e.takeDamage(dmg, f, 'galaxy-impact');
      G.split = { life:5, maxLife:5, startedAt:nowSec(), gap:72, quadrants:new Map() };
      if (e) { placeDifferentGalaxyQuadrants(f,e); }
      spawnShockwave(500,500,'#7f6dff',640);
      triggerFlash(190,160,255,.36);
      im.timer = 5;
    }
    if (im.punched) {
      im.timer -= dt;
      if ((G.split?.life || 0) <= 0) {
        f.data.galaxyImpact = null;
        G.impact = null;
        f.data.galaxyState = 'READY';
      }
    }
    return true;
  }
  function placeDifferentGalaxyQuadrants(f,e) {
    const spots = [{x:250,y:250},{x:750,y:250},{x:250,y:750},{x:750,y:750}];
    f.x = spots[0].x; f.y = spots[0].y;
    e.x = spots[3].x; e.y = spots[3].y;
    G.split.quadrants.set(f.id, 0);
    G.split.quadrants.set(e.id, 3);
  }
  function updateGalaxyBluehole(f,e,dt) {
    const bh = f.data.galaxyBluehole;
    if (!bh) return false;
    bh.timer -= dt;
    bh.healTick -= dt;
    if (e) {
      e.data.galaxyRemoved = true;
      e.x = bh.crater.x; e.y = bh.crater.y;
      e.data.positionLocked = true;
    }
    if (bh.healTick <= 0) {
      bh.healTick += 1;
      f.heal(0.5 * bh.total, false);
    }
    if (!bh.slammed && bh.timer <= 4.4) {
      bh.slammed = true;
      playGalaxySound('wall', { volume: 0.85 });
      playGalaxySound('bluehole', { volume: 0.75 });
      spawnShockwave(bh.crater.x,bh.crater.y,'#05000a',220);
    }
    if (bh.timer <= 0) {
      if (e) {
        e.data.galaxyRemoved = false;
        e.x = clamp(bh.crater.x, e.radius, GAME_SIZE-e.radius);
        e.y = clamp(bh.crater.y, e.radius, GAME_SIZE-e.radius);
      }
      f.data.galaxyBluehole = null;
      f.data.galaxyState = 'READY';
    }
    return true;
  }
  function tryGalaxyBluehole(f) {
    if (!f || f.name !== 'GALAXY' || f.hp <= 0 || (f.data.galaxyBlueholeCd||0) > 0 || f.data.galaxyBluehole || f.data.galaxyImpact) return;
    const e = gEnemy(f); if (!e || e.hp <= 0 || e.data.galaxyRemoved) return;
    const wr = (x)=> (x.data.galaxyRecentDamage||[]).filter(r=>matchClock-r.t <= 0.05 && r.amount > 0);
    const fd = wr(f), ed = wr(e);
    if (!fd.length || !ed.length) return;
    const total = [...fd, ...ed].reduce((s,r)=>s+r.amount,0);
    f.data.galaxyBlueholeCd = 20;
    f.data.galaxyBluehole = { timer:5, healTick:1, total, crater:{x:e.x,y:e.y}, slammed:false };
    f.data.galaxyState = 'BLUEHOLE';
    f.data.galaxyThrowPhase = 'idle';
    f.data.galaxyPressureArmed = false;
    if (f.data.galaxyPressureWalkSound) f.data.galaxyPressureWalkSound.fadeOut(.25);
    floatingTexts.push(new FloatingText(e.x,e.y-e.radius-96,'BLUEHOLE', '#1a1028'));
  }

  const baseUpdateProjectiles = updateProjectiles;
  updateProjectiles = function(dt) {
    for (const p of projectiles) {
      if (p.type === 'galaxy_planet' && !p.exploded) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        let explode = null;
        if (p.x < p.radius) explode = {x:p.radius,y:p.y};
        else if (p.x > GAME_SIZE-p.radius) explode = {x:GAME_SIZE-p.radius,y:p.y};
        else if (p.y < p.radius) explode = {x:p.x,y:p.radius};
        else if (p.y > GAME_SIZE-p.radius) explode = {x:p.x,y:GAME_SIZE-p.radius};
        const enemy = p.owner ? gEnemy(p.owner) : null;
        if (!explode && enemy && dist(p.x,p.y,enemy.x,enemy.y) <= p.radius + enemy.radius) explode = {x:p.x,y:p.y};
        if (explode) {
          p.exploded = true; p.life = 0; p.x = explode.x; p.y = explode.y;
          playGalaxySound('explosion', { volume: 0.78 });
          window.APEX_GALAXY ||= {};
          window.APEX_GALAXY.planetImpacts ||= [];
          window.APEX_GALAXY.planetImpacts.push({x:p.x,y:p.y,life:.82,maxLife:.82,radius:p.visualSize ? p.visualSize * 2.4 : 250});
          const diag = Math.hypot(GAME_SIZE,GAME_SIZE);
          for (const target of fighters) {
            if (!target || target === p.owner || target.data?.galaxyRemoved || p.hitIds[target.id]) continue;
            const dmg = clamp(10 * (1 - dist(p.x,p.y,target.x,target.y)/diag), 0, 10);
            if (dmg > 0) { p.hitIds[target.id] = true; target.takeDamage(dmg, p.owner, 'galaxy-planet-explosion'); }
          }
        }
      }
    }
    baseUpdateProjectiles(dt);
  };
  const baseDrawProjectiles = drawProjectiles;
  drawProjectiles = function(ctx) {
    drawGalaxyZones(ctx);
    baseDrawProjectiles(ctx);
    for (const p of projectiles) if (p.type === 'galaxy_planet') {
      const img = G.images[`planet${p.planetIndex || 0}`];
      const size = p.visualSize || 76;
      drawImgWorld(ctx,img,p.x,p.y,size,size,Math.atan2(p.vy,p.vx)+Date.now()/220,1);
    }
    for (const tr of G.trails) drawGalaxyTrail(ctx,tr);
  };
  function drawGalaxyTrail(ctx,tr) {
    const a = clamp(tr.life/tr.maxLife,0,1);
    const img = G.images.teleportLine;
    const segs = 7;
    for (let i=0;i<segs;i++) {
      const t0 = i/segs, t1 = (i+1)/segs;
      const x0 = lerp(tr.x1,tr.x2,t0), y0 = lerp(tr.y1,tr.y2,t0);
      const x1 = lerp(tr.x1,tr.x2,t1), y1 = lerp(tr.y1,tr.y2,t1);
      const mx = (x0+x1)/2 + Math.sin(i*2.1)*20;
      const my = (y0+y1)/2 + Math.cos(i*1.7)*20;
      const len = dist(x0,y0,x1,y1);
      drawImgWorld(ctx,img,mx,my,len,34,Math.atan2(y1-y0,x1-x0),0.82*a);
    }
  }
  function drawGalaxyZones(ctx) {
    for (const z of G.zones) {
      const img = G.images.zone;
      ctx.save();
      ctx.translate(z.x,z.y); ctx.rotate(Math.atan2(z.dir.y,z.dir.x));
      ctx.beginPath();
      const w=z.w, h=z.h, t=z.thick;
      ctx.rect(-w/2, -h/2, t, h);
      ctx.rect(w/2-t, -h/2, t, h);
      ctx.rect(-w/2, h/2-t, w, t);
      ctx.clip();
      ctx.globalAlpha = .50 * clamp(z.life/z.maxLife,0,1);
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -w/2, -h/2, w, h);
      else { ctx.fillStyle='rgba(100,70,255,.38)'; ctx.fillRect(-w/2,-h/2,w,h); }
      ctx.restore();
    }
  }
  const baseDrawBackground = drawBackground;
  drawBackground = function(ctx) {
    baseDrawBackground(ctx);
    if (G.impact) {
      const a = clamp(1 - G.impact.timer/G.impact.maxTimer, 0, 1);
      const img = G.images.field;
      ctx.save(); ctx.globalAlpha = .18 + .42*a;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img,0,0,GAME_SIZE,GAME_SIZE);
      else { ctx.fillStyle='rgba(70,30,160,.35)'; ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE); }
      ctx.restore();
    }
    if (G.split?.life > 0) {
      ctx.save();
      const a = clamp(G.split.life/G.split.maxLife,0,1);
      ctx.globalAlpha = .85*a;
      ctx.strokeStyle = '#12091f'; ctx.lineWidth = G.split.gap;
      ctx.beginPath(); ctx.moveTo(500,0); ctx.lineTo(500,1000); ctx.moveTo(0,500); ctx.lineTo(1000,500); ctx.stroke();
      ctx.strokeStyle = '#b7a9ff'; ctx.lineWidth = 7; ctx.setLineDash([24,14]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
  };
  const baseUpdate = update;
  update = function(dt) {
    if (G.paused) return;
    for (const z of G.zones) z.life -= dt;
    G.zones = G.zones.filter(z => z.life > 0);
    for (const tr of G.trails) tr.life -= dt;
    G.trails = G.trails.filter(t => t.life > 0);
    if (G.split?.life > 0) G.split.life = Math.max(0, G.split.life - dt);
    baseUpdate(dt);
    applyGalaxyZoneDebuffs();
    applyGalaxySplitBarriers();
  };
  function applyGalaxyZoneDebuffs() {
    for (const z of G.zones) if (z.type === 'u') {
      const owner = z.owner;
      const enemy = owner ? gEnemy(owner) : null;
      if (!enemy) continue;
      const rel = {x:enemy.x-z.x, y:enemy.y-z.y};
      const a = -Math.atan2(z.dir.y,z.dir.x);
      const x = rel.x*Math.cos(a) - rel.y*Math.sin(a);
      const y = rel.x*Math.sin(a) + rel.y*Math.cos(a);
      const inside = x>=-z.w/2 && x<=z.w/2 && y>=-z.h/2 && y<=z.h/2 && (Math.abs(x)>=z.w/2-z.thick || y>=z.h/2-z.thick);
      if (inside) {
        const slow = 0.40 + (z.hits-1)*0.05;
        const weak = 0.20 + (z.hits-1)*0.05;
        enemy.applyStatus('slow', .15, { mult: 1-slow, source:owner });
        enemy.applyStatus('galaxyZoneWeak', .15, { mult: 1-weak, source:owner });
      }
    }
  }
  function applyGalaxySplitBarriers() {
    if (!G.split?.life) return;
    const gap = G.split.gap/2;
    for (const f of fighters) {
      if (!f || f.hp<=0) continue;
      if (Math.abs(f.x-500) < gap) f.x = f.x < 500 ? 500-gap : 500+gap;
      if (Math.abs(f.y-500) < gap) f.y = f.y < 500 ? 500-gap : 500+gap;
      f.x = clamp(f.x, f.radius, GAME_SIZE-f.radius);
      f.y = clamp(f.y, f.radius, GAME_SIZE-f.radius);
    }
  }
  const baseFighterDraw = Fighter.prototype.draw;
  Fighter.prototype.draw = function(ctx) {
    if (this.data?.galaxyRemoved) return;
    baseFighterDraw.call(this, ctx);
  };
  const baseTakeDamageGalaxy = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false) {
    if (this.data?.galaxyRemoved) return;
    let adjusted = amount;
    if (this.name === 'GALAXY') {
      const pressureReduction = (this.data.galaxyPressureArmed || this.data.galaxyPressureWindow > 0) ? 0.8 : 0;
      const rageReduction = this.isRage ? (this.data.galaxyRageReduction || 0) : 0;
      adjusted *= (1-pressureReduction) * (1-rageReduction);
    }
    if (this.hasStatus?.('galaxyZoneWeak') && source && source !== this) adjusted *= this.statuses.galaxyZoneWeak.mult ?? 1;
    const before = this.hp;
    const sourceBefore = source ? source.damageDone || 0 : 0;
    const result = baseTakeDamageGalaxy.call(this, adjusted, source, label, statusDamage);
    const dealt = Math.max(0, before - this.hp);
    if (dealt > 0) {
      this.data ||= {};
      this.data.galaxyRecentDamage ||= [];
      this.data.galaxyRecentDamage.push({t:matchClock, amount:dealt, sourceId:source?.id, sourceType:source?.name, label});
      this.data.galaxyRecentDamage = this.data.galaxyRecentDamage.filter(r=>matchClock-r.t <= 0.35);
      const galaxy = fighters.find(x=>x?.name==='GALAXY');
      if (galaxy) tryGalaxyBluehole(galaxy);
    }
    if (source?.name === 'GALAXY' && source !== this) {
      const actual = Math.max(0, (source.damageDone || 0) - sourceBefore);
      if (source.isRage && actual > 0) {
        source.data.galaxyRageDamageDone = (source.data.galaxyRageDamageDone || 0) + actual;
        source.data.galaxyRageReduction = Math.min(0.8, source.data.galaxyRageDamageDone * 0.02);
      }
    }
    return result;
  };
  const baseHealGalaxy = Fighter.prototype.heal;
  Fighter.prototype.heal = function(amount, overheal=false) {
    if (this.data?.galaxyRemoved) return;
    return baseHealGalaxy.call(this, amount, overheal);
  };

  const oldGlyph = fighterGlyph;
  fighterGlyph = function(name) {
    if (name === 'GALAXY' || name === 'NOVA') return 'GAL';
    return oldGlyph(name);
  };
  const oldRubberCast = typeof castRubberSubSkill === 'function' ? castRubberSubSkill : null;
  if (oldRubberCast) {
    castRubberSubSkill = function(f,e,sub) {
      if ((sub?.name || sub) === 'GALAXY' || (sub?.name || sub) === 'NOVA') {
        const n = norm(e.x-f.x,e.y-f.y);
        projectiles.push({type:'galaxy_planet',owner:f,x:f.x+n.x*70,y:f.y+n.y*70,vx:n.x*getGalaxyPlanetSpeed(),vy:n.y*getGalaxyPlanetSpeed(),radius:24,life:2.2,maxLife:2.2,planetIndex:0,hitIds:{}});
        return;
      }
      return oldRubberCast(f,e,sub);
    };
  }
  let selectionClick = { name:null, time:0 };
  const oldPopulateRoster = populateRoster;
  populateRoster = function() {
    selectionClick = { name:null, time:0 };
    oldPopulateRoster();
    const grid = document.getElementById('roster-grid');
    if (!grid) return;
    grid.querySelectorAll('.fighter-card').forEach(card => {
      const name = card.querySelector('.f-name')?.textContent;
      if (name === 'NOVA') card.querySelector('.f-name').textContent = 'GALAXY';
    });
  };
  const oldSelectFighter = selectFighter;
  selectFighter = function(ft, card) {
    const now = performance.now();
    if (selectionClick.name === ft.name && now - selectionClick.time <= 350) {
      if (p2Selection === ft) p2Selection = null;
      else if (p1Selection === ft && !p2Selection) p1Selection = null;
      document.querySelectorAll('.fighter-card').forEach(c=>c.classList.remove('selected-p1','selected-p2'));
      if (p1Selection) [...document.querySelectorAll('.fighter-card')].find(c=>c.querySelector('.f-name')?.textContent===p1Selection.name)?.classList.add('selected-p1');
      if (p2Selection) [...document.querySelectorAll('.fighter-card')].find(c=>c.querySelector('.f-name')?.textContent===p2Selection.name)?.classList.add('selected-p2');
      const title = document.getElementById('select-title');
      if (title) { title.innerText = p1Selection ? 'SELECT PLAYER 2' : 'SELECT PLAYER 1'; title.style.color = p1Selection ? '#ff776f' : '#7fd4ff'; }
      document.getElementById('start-btn')?.classList.add('hidden');
      syncSelectedFighterVfx();
      selectionClick = { name:null, time:0 };
      return;
    }
    selectionClick = { name:ft.name, time:now };
    oldSelectFighter(ft, card);
  };
  const oldSoloRosterTypes = typeof soloRosterTypes === 'function' ? soloRosterTypes : null;
  if (oldSoloRosterTypes) soloRosterTypes = function(){ return oldSoloRosterTypes().map(t => t.name === 'NOVA' ? legacyNova : t); };
  window.toggleAutoBattlePause = function() {
    G.paused = !G.paused;
    window.apexPauseGalaxyAudio(G.paused);
    const btn = document.getElementById('battle-pause-btn');
    if (btn) btn.textContent = G.paused ? 'RESUME' : 'PAUSE';
  };
  window.restartAutoBattle = function() {
    if (fighters[0]?.type && fighters[1]?.type) startSpecificMatch(fighters[0].type, fighters[1].type, {countdown:false,tournament:false});
  };
  window.exitAutoBattle = function() {
    G.paused = false;
    goToMenu();
  };
  const oldStartSpecificMatch = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts = {}) {
    G.paused = false; G.zones = []; G.trails = []; G.impact = null; G.split = null;
    if (ft1?.name === 'NOVA') ft1 = legacyNova;
    if (ft2?.name === 'NOVA') ft2 = legacyNova;
    oldStartSpecificMatch(ft1, ft2, opts);
  };
  const oldGoToMenu = goToMenu;
  goToMenu = function() {
    G.paused = false; G.zones = []; G.trails = []; G.impact = null; G.split = null;
    oldGoToMenu();
  };
  window.APEX_GALAXY_READY = true;
})();

window.apexReactBridge = window.apexReactBridge || {};
function exposeApexGlobal(name, value) {
  if (typeof value !== 'function') return;
  window[name] = value;
  window.apexReactBridge[name] = value;
}
window.FighterTypes = FighterTypes;
window.apexFighterTypes = FighterTypes;

// ===== GALAXY LATE FINALIZER: exports + current-max-HP Rage threshold =====
(function GALAXY_LATE_FINALIZER(){
  function fireHalfHpRage(f) {
    if (!f || f.isRage || f.type?.noRage || f.hp <= 0) return;
    if (f.hp > f.maxHp * 0.5) return;
    f.isRage = true;
    f.rageStartHp = f.hp;
    playFighterSound(f, 'skill');
    emitParticles(f.x, f.y, f.color, 60, 540, 7, 1.2, 'square');
    spawnShockwave(f.x, f.y, f.color, 190);
    if (f.type.onRage) f.type.onRage(f);
  }
  const lateTakeDamage = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false) {
    const type = this.type || {};
    const oldNoRage = type.noRage;
    const guardEarlyFixed50 = !this.isRage && !oldNoRage && this.maxHp < 100;
    if (guardEarlyFixed50) type.noRage = true;
    const result = lateTakeDamage.call(this, amount, source, label, statusDamage);
    if (guardEarlyFixed50) type.noRage = oldNoRage;
    fireHalfHpRage(this);
    return result;
  };
  if (Fighter.prototype.takeStandardDamage) {
    const lateStandardDamage = Fighter.prototype.takeStandardDamage;
    Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number') {
      const type = this.type || {};
      const oldNoRage = type.noRage;
      const guardEarlyFixed50 = !this.isRage && !oldNoRage && this.maxHp < 100;
      if (guardEarlyFixed50) type.noRage = true;
      const result = lateStandardDamage.call(this, amount, source, label);
      if (guardEarlyFixed50) type.noRage = oldNoRage;
      fireHalfHpRage(this);
      return result;
    };
  }
  const lateUpdate = update;
  update = function(dt) {
    if (window.APEX_GALAXY?.paused) return;
    return lateUpdate(dt);
  };
  exposeApexGlobal('toggleAutoBattlePause', window.toggleAutoBattlePause);
  exposeApexGlobal('restartAutoBattle', window.restartAutoBattle);
  exposeApexGlobal('exitAutoBattle', window.exitAutoBattle);
})();

// ===== GALAXY COMPLETION PATCH: local latest mechanics hardening =====
(function GALAXY_COMPLETION_PATCH(){
  if (window.__apexGalaxyCompletionPatch) return;
  window.__apexGalaxyCompletionPatch = true;
  const G = window.APEX_GALAXY;
  if (!G) return;
  const FT = name => FighterTypes.find(f => f && f.name === name);
  const galaxyType = FT('GALAXY') || FT('NOVA');
  if (galaxyType) {
    galaxyType.name = 'GALAXY';
    galaxyType.color = '#7f6dff';
    galaxyType.desc = 'Heavy galaxy fist brawler: planet stacks, Pressure, Divine, Impact, Bluehole';
    galaxyType.speed = 360;
    galaxyType.speedModifier = f => (f.data && (f.data.galaxyPressureArmed || f.data.galaxyPressureWindow > 0)) ? 0.2 : 1;
  }
  const NINJA_SHURIKEN_SPEED = 2130;
  G.report ||= {};
  G.report.ninjaSpeedSource = 'Derived from current NINJA runtime projectile velocity in ninjaThrowShuriken: 2130.';
  G.report.planetSpeed = NINJA_SHURIKEN_SPEED * 0.6;

  function live(f){ return f && f.hp > 0; }
  function enemyOfGalaxy(f){ return fighters.find(q => live(q) && q !== f && !q.data?.galaxyRemoved) || null; }
  function activeGalaxyCinematic() {
    const g = fighters.find(f => f && f.name === 'GALAXY' && f.hp > 0);
    if (!g) return null;
    const d = g.data || {};
    if (d.galaxyDivine?.worldFreeze > 0) return { galaxy:g, enemy:enemyOfGalaxy(g), kind:'divine' };
    if (d.galaxyBluehole) return { galaxy:g, enemy:fighters.find(q => q && q !== g), kind:'bluehole' };
    if (d.galaxyImpact && d.galaxyImpact.phase === 'charge') return { galaxy:g, enemy:enemyOfGalaxy(g), kind:'impact-charge' };
    return null;
  }
  function tickPassiveVisuals(dt) {
    for (const tr of G.trails || []) tr.life -= dt;
    G.trails = (G.trails || []).filter(t => t.life > 0);
    if (arenaFlash.a > 0) arenaFlash.a = Math.max(0, arenaFlash.a - dt * 1.6);
    if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 22);
    cameraZoom = lerp(cameraZoom, 1, dt * 2);
    for (let i=particles.length-1;i>=0;i--) { particles[i].update(dt); if (particles[i].life <= 0) particles.splice(i,1); }
    for (let i=floatingTexts.length-1;i>=0;i--) { floatingTexts[i].update(dt); if (floatingTexts[i].life <= 0) floatingTexts.splice(i,1); }
    for (let i=shockwaves.length-1;i>=0;i--) {
      const s = shockwaves[i];
      s.r += 420 * dt;
      s.alpha = Math.max(0, 1 - s.r / s.maxR);
      if (s.alpha <= 0) shockwaves.splice(i,1);
    }
  }

  const prevGalaxyCompletionUpdate = update;
  update = function(dt) {
    if (G.paused) { updateHUD(); return; }
    const cinematic = activeGalaxyCinematic();
    if (cinematic && gameState === 'PLAYING') {
      if (hitStop > 0) { hitStop -= dt; dt *= 0.1; }
      if (cinematic.galaxy?.type?.update) cinematic.galaxy.type.update(cinematic.galaxy, cinematic.enemy, dt);
      tickPassiveVisuals(dt);
      updateHUD();
      if (fighters[0]?.hp <= 0 || fighters[1]?.hp <= 0) endMatch();
      return;
    }
    return prevGalaxyCompletionUpdate(dt);
  };

  const prevGalaxyCompletionFighterUpdate = Fighter.prototype.update;
  Fighter.prototype.update = function(dt, enemy) {
    if (this.data?.galaxyRemoved) {
      this.data.positionLocked = true;
      return;
    }
    return prevGalaxyCompletionFighterUpdate.call(this, dt, enemy);
  };

  const prevGalaxyCompletionTakeDamage = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false) {
    if (this.name === 'GALAXY' && (this.data?.galaxyDivine || this.data?.galaxyImpact)) return;
    if (this.data?.galaxyRemoved) return;
    let adjusted = amount;
    if (source && source !== this && source.hasStatus && source.hasStatus('galaxyZoneWeak')) {
      adjusted *= source.statuses.galaxyZoneWeak.mult ?? 1;
    }
    const savedTargetZoneWeak = this.statuses && this.statuses.galaxyZoneWeak;
    if (savedTargetZoneWeak) delete this.statuses.galaxyZoneWeak;
    const result = prevGalaxyCompletionTakeDamage.call(this, adjusted, source, label, statusDamage);
    if (savedTargetZoneWeak && this.statuses && !this.statuses.galaxyZoneWeak && savedTargetZoneWeak.timer > 0) {
      this.statuses.galaxyZoneWeak = savedTargetZoneWeak;
    }
    return result;
  };
  if (Fighter.prototype.takeStandardDamage) {
    const prevGalaxyCompletionStandardDamage = Fighter.prototype.takeStandardDamage;
    Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number') {
      if (this.name === 'GALAXY' && (this.data?.galaxyDivine || this.data?.galaxyImpact)) return;
      return prevGalaxyCompletionStandardDamage.call(this, amount, source, label);
    };
  }

  const prevGalaxyCompletionStart = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts = {}) {
    if (ft1?.name === 'NOVA') ft1 = galaxyType || ft1;
    if (ft2?.name === 'NOVA') ft2 = galaxyType || ft2;
    G.paused = false;
    G.zones = [];
    G.trails = [];
    G.impact = null;
    G.split = null;
    return prevGalaxyCompletionStart(ft1, ft2, opts);
  };

  const prevGalaxyCompletionDaily = typeof buildDailyChallenge === 'function' ? buildDailyChallenge : null;
  if (prevGalaxyCompletionDaily) {
    buildDailyChallenge = function(...args) {
      const challenge = prevGalaxyCompletionDaily.apply(this, args);
      if (challenge.left === 'NOVA') challenge.left = 'GALAXY';
      if (challenge.right === 'NOVA') challenge.right = 'GALAXY';
      return challenge;
    };
  }

  exposeApexGlobal('startMatch', startMatch);
  exposeApexGlobal('startSpecificMatch', startSpecificMatch);
  if (typeof startDailyChallenge === 'function') exposeApexGlobal('startDailyChallenge', startDailyChallenge);
  exposeApexGlobal('toggleAutoBattlePause', window.toggleAutoBattlePause);
  exposeApexGlobal('restartAutoBattle', window.restartAutoBattle);
  exposeApexGlobal('exitAutoBattle', window.exitAutoBattle);
})();
