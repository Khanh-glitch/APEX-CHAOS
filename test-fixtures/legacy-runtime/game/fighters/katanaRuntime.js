// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_KATANA_CHAMPION(){
  if (window.__apexKatanaChampion) return;
  window.__apexKatanaChampion = true;

  const ROOT = '/assets/katana_v1/';
  const FRAME_COUNT = 48;
  const FRAME_RATE = 24;
  const LOOP = 2;
  const RELEASE_FRAME = 17;
  const C = {
    color:'#ff78b7',
    scale:.312,
    effectScale:.8,
    bodyForwardOffset:-Math.PI/2,
    drawW:221,
    drawH:221,
    waveSpeed:1080,
    waveHalfWidth:100,
    waveLength:416,
    waveImpactLead:86,
    bladeAlphaThreshold:36,
    waveDamage:5,
    oneSwordDamage:5,
    twoSwordDamage:10,
    infiniteLegDamage:[20,10,5],
    oneSwordStun:.5,
    oneSwordComboWindow:2,
    cloneMaturity:1,
    postDashImmunity:.2,
    oneSwordDistance:400,
    oneSwordPredict:.25,
    dashDuration:.105,
    twinSyncTolerance:.05,
    twinMinCloneDistance:200,
    twinPathSamples:17,
    twinInfiniteWindow:2,
    centroidRadius:42,
    infiniteLegDuration:.31,
    infiniteBeyond:300,
    infiniteFinisherInterval:.065,
    infiniteEndFrame:23,
    evadeThreshold:30,
    evadeWindow:.5,
    normalCollisionCooldown:5,
    rageCollisionCooldown:1,
    ragePostDashImmunity:.5,
    rageHpRatio:.5
  };

  const frameImages = Array.from({length:FRAME_COUNT}, (_, i) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = `${ROOT}frames/frame_${String(i + 1).padStart(3, '0')}.webp`;
    return img;
  });
  const images = {
    bladeWave:loadImage('bladeWave.webp'),
    sakuraPetal:loadImage('sakuraPetal.webp'),
    slashOverlay:loadImage('slashOverlay.webp'),
    pinkMoon:loadImage('pinkMoon.webp'),
    pickButton:loadImage('pickButton.webp'),
    picked:loadImage('picked.webp')
  };
  const audioFiles = {
    attack:`${ROOT}audio/attack.mp3`,
    infiniteSeverStart:`${ROOT}audio/infiniteSeverStart.mp3`,
    directFleshHit:`${ROOT}audio/directFleshHit.mp3`,
    twoSwordImpact:`${ROOT}audio/twoSwordImpact.mp3`,
    waveHitEnemy:`${ROOT}audio/waveHitEnemy.mp3`,
    waveHitDefendedObject:`${ROOT}audio/waveHitDefendedObject.mp3`,
    waveHitHeavyObject:`${ROOT}audio/waveHitHeavyObject.mp3`,
    cloneTeleport:'/assets/ninja_v1/audio/teleport.mp3'
  };
  const audio = {};
  const audioPools = {};
  const state = { waves:[], vfx:[], lastTick:0, updateFrame:0, filteredFrames:{clone:[],afterimage:[]}, perf:{secondStart:0, collisionCalls:0, oneSwordTriggers:0, twinTriggers:0, infiniteTriggers:0, frameTimeMs:0} };
  const bladeMask = { canvas:null, ctx:null, data:null, width:0, height:0 };
  let nextWaveId = 1;
  let nextVfxId = 1;

  function loadImage(file) {
    const img = new Image();
    img.decoding = 'async';
    img.src = ROOT + file;
    return img;
  }
  function whenImageReady(img) {
    if (!img) return Promise.resolve(false);
    if (img.complete && img.naturalWidth) {
      return img.decode ? img.decode().catch(() => false).then(() => true) : Promise.resolve(true);
    }
    if (img.complete && !img.naturalWidth) return Promise.resolve(false);
    return new Promise(resolve => {
      const done = () => {
        if (img.decode) img.decode().catch(() => false).then(() => resolve(!!img.naturalWidth));
        else resolve(!!img.naturalWidth);
      };
      img.addEventListener('load', done, {once:true});
      img.addEventListener('error', () => resolve(false), {once:true});
    });
  }
  function warmDrawImage(ctx, img, scale=1) {
    if (!ctx || !img?.naturalWidth) return false;
    const w = Math.max(1, Math.min(64, img.naturalWidth * scale));
    const h = Math.max(1, Math.min(64, img.naturalHeight * scale));
    ctx.save();
    ctx.globalAlpha = .001;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
    return true;
  }
  const FILTERED_FRAME_SPECS = Object.freeze({
    clone:{filter:'saturate(.48) opacity(.72) drop-shadow(0 0 7px rgba(255,120,183,.55))',pad:18},
    afterimage:{filter:'saturate(.55) opacity(.65) drop-shadow(0 0 9px rgba(255,112,188,.55))',pad:24}
  });
  function bakeFilteredFrame(img, kind) {
    if (!img?.naturalWidth || !FILTERED_FRAME_SPECS[kind]) return null;
    const index=frameImages.indexOf(img), bucket=state.filteredFrames[kind];
    if (index>=0 && bucket[index]) return bucket[index];
    const spec=FILTERED_FRAME_SPECS[kind], bodyW=img.naturalWidth*C.scale, bodyH=img.naturalHeight*C.scale;
    const surface=typeof OffscreenCanvas!=='undefined'
      ? new OffscreenCanvas(Math.ceil(bodyW+spec.pad*2),Math.ceil(bodyH+spec.pad*2))
      : Object.assign(document.createElement('canvas'),{width:Math.ceil(bodyW+spec.pad*2),height:Math.ceil(bodyH+spec.pad*2)});
    const c=surface.getContext('2d'); if(!c)return null;
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.filter=spec.filter;
    c.drawImage(img,spec.pad,spec.pad,bodyW,bodyH);c.filter='none';
    const entry={canvas:surface,w:surface.width,h:surface.height};
    if(index>=0)bucket[index]=entry;
    return entry;
  }
  function drawFilteredFrame(ctx,img,kind,alpha=1,scale=C.scale) {
    if(scale!==C.scale)return false;
    const cached=bakeFilteredFrame(img,kind);if(!cached)return false;
    ctx.save();ctx.filter='none';ctx.globalAlpha*=alpha;ctx.drawImage(cached.canvas,-cached.w/2,-cached.h/2,cached.w,cached.h);ctx.restore();
    return true;
  }
  function warmKatanaVisualAssets() {
    if (state.visualWarmup?.started) return state.visualWarmup.promise;
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(96, 96)
      : Object.assign(document.createElement('canvas'), {width:96, height:96});
    const warmCtx = canvas.getContext?.('2d');
    const hotFrames = frameImages.filter(Boolean);
    const hotImages = [...hotFrames, images.bladeWave, images.sakuraPetal, images.slashOverlay, images.pinkMoon];
    state.visualWarmup = {
      started:true,
      ready:false,
      // CP6: this warmup forces decodes (warmDrawImage), bakes filtered frame
      // variants, and builds the 1535x1024 blade mask (full getImageData
      // readback). Doing all of it inside one .then() produced a ~1s
      // main-thread stall on the Arsenal entry path. Chunked now: one asset
      // per idle slot, yielding to input/paint between them; ensureBladeMask
      // also stays available as the lazy in-match fallback.
      promise:Promise.all(hotImages.map(whenImageReady)).then(() => {
        const tasks = [];
        for (const img of hotImages) {
          tasks.push(() => warmDrawImage(warmCtx, img, img === images.sakuraPetal ? .08 : .35));
        }
        for (const img of hotFrames) {
          tasks.push(() => bakeFilteredFrame(img,'clone'));
          tasks.push(() => bakeFilteredFrame(img,'afterimage'));
        }
        tasks.push(() => {
          ensureBladeMask();
          state.visualWarmup.bladeMaskReady = !!bladeMask.data;
          state.visualWarmup.ready = true;
          state.visualWarmup.finishedAt = performance.now();
        });
        if (typeof window.apexIdleChain === 'function') return window.apexIdleChain(tasks).then(() => true);
        for (const t of tasks) t();
        return true;
      }).catch(error => {
        state.visualWarmup.error = String(error?.message || error);
        return false;
      })
    };
    return state.visualWarmup.promise;
  }
  function scheduleKatanaVisualWarmup() {
    const run = () => warmKatanaVisualAssets();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, {timeout:1800});
    else setTimeout(run, 300);
  }
  function preloadAudio() {
    for (const [key, src] of Object.entries(audioFiles)) {
      const base = new Audio(src);
      base.preload = 'auto';
      audio[key] = registerBattleMediaElement(base);
      audioPools[key] = [base];
    }
  }
  function playKatanaSound(key, volume=.62, cooldown=.025) {
    const now = performance.now();
    const base = audio[key];
    if (!base || (base.__katanaLast && now - base.__katanaLast < cooldown * 1000)) return;
    base.__katanaLast = now;
    const pool = audioPools[key] || (audioPools[key] = [base]);
    let snd = pool.find(a => a.paused || a.ended);
    if (!snd && pool.length < 8) {
      snd = registerBattleMediaElement(base.cloneNode(true));
      snd.preload = 'auto';
      pool.push(snd);
    }
    if (!snd) return;
    try { snd.currentTime = 0; } catch (error) {}
    snd.volume = volume;
    const p = snd.play();
    if (p?.catch) p.catch(() => {});
  }
  function katanaData(f) {
    f.data ||= {};
    if (!f.data.katana) initKatana(f);
    return f.data.katana;
  }
  function initKatana(f) {
    f.radius = 58;
    f.baseRadius = 58;
    f.data.katana = {
      animTime:0,
      lastFrame:1,
      cloneSerial:0,
      clones:[],
      action:null,
      hitHistory:[],
      centroid:null,
      moon:{x:f.x-52,y:f.y-92,mode:'follow'},
      lastEnemy:{x:null,y:null},
      visualDir:{x:f.dir.x,y:f.dir.y},
      awaitFaceFrame1:false,
      invulnUntil:0,
      oneSwordLockoutUntil:0,
      collisionOneReadyAt:0,
      twinHistory:[],
      pendingTwinInfinite:false,
      rage:false
    };
  }
  function frameIndex(f) {
    const d = katanaData(f);
    return Math.floor(((((d.animTime % LOOP) + LOOP) % LOOP) * FRAME_RATE) + 1e-9) % FRAME_COUNT + 1;
  }
  function resetAnim(f) {
    const d = katanaData(f);
    d.animTime = 0;
    d.lastFrame = 1;
  }
  function nextKatanaActionId(f) {
    const d = katanaData(f);
    d.actionSerial = (d.actionSerial || 0) + 1;
    return d.actionSerial;
  }
  function enemyOf(f) {
    return (fighters || []).find(q => q && q !== f && q.hp > 0) || null;
  }
  function live(f) { return f && f.hp > 0; }
  function katanaShouldRage(f) { return isHpBelowRatio(f, C.rageHpRatio); }
  function dirTo(a,b) { return norm((b?.x || a.x + a.dir.x) - a.x, (b?.y || a.y + a.dir.y) - a.y); }
  function cross(ax, ay, bx, by) { return ax * by - ay * bx; }
  function pointLineProjection(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    const t = ((px - ax) * vx + (py - ay) * vy) / len2;
    return {t, x:ax + vx * t, y:ay + vy * t, len:Math.sqrt(len2)};
  }
  function segmentCircleHit(x1,y1,x2,y2,cx,cy,r) {
    return distToSegment(cx,cy,x1,y1,x2,y2) <= r;
  }
  function oldestAvailableClones(d) {
    return (d.clones || []).filter(c => !c.consumed && !c.reserved && matchClock - (c.createdAt ?? -Infinity) >= C.cloneMaturity).sort((a,b) => a.id - b.id);
  }
  function katanaPerfCounter(key, amount=1) {
    state.perf ||= {secondStart:0};
    state.perf[key] = (state.perf[key] || 0) + amount;
  }
  function refreshKatanaPerfCounters(frameStart=performance.now()) {
    const now = performance.now();
    const perf = state.perf || (state.perf = {});
    perf.frameTimeMs = now - frameStart;
    perf.activeBladeWaves = state.waves.length;
    perf.activeKatanaVfx = state.vfx.length;
    perf.activeClones = (fighters || []).filter(f => f?.name === 'KATANA').reduce((sum, f) => sum + ((f.data?.katana?.clones || []).filter(c => !c.consumed).length), 0);
    if (!perf.secondStart) perf.secondStart = now;
    if (now - perf.secondStart >= 1000) {
      perf.lastSecond = {
        katanaCollisionCallsPerSecond:perf.collisionCalls || 0,
        katanaOneSwordTriggersPerSecond:perf.oneSwordTriggers || 0,
        katanaTwinTriggersPerSecond:perf.twinTriggers || 0,
        katanaInfiniteTriggersPerSecond:perf.infiniteTriggers || 0,
        activeBladeWaves:perf.activeBladeWaves || 0,
        activeKatanaVfx:perf.activeKatanaVfx || 0,
        activeClones:perf.activeClones || 0,
        frameTimeMs:perf.frameTimeMs || 0
      };
      perf.collisionCalls = 0;
      perf.oneSwordTriggers = 0;
      perf.twinTriggers = 0;
      perf.infiniteTriggers = 0;
      perf.secondStart = now;
    }
    window.__apexKatanaDebugCounters = perf.lastSecond || {
      katanaCollisionCallsPerSecond:perf.collisionCalls || 0,
      katanaOneSwordTriggersPerSecond:perf.oneSwordTriggers || 0,
      katanaTwinTriggersPerSecond:perf.twinTriggers || 0,
      katanaInfiniteTriggersPerSecond:perf.infiniteTriggers || 0,
      activeBladeWaves:perf.activeBladeWaves || 0,
      activeKatanaVfx:perf.activeKatanaVfx || 0,
      activeClones:perf.activeClones || 0,
      frameTimeMs:perf.frameTimeMs || 0
    };
  }
  function visualCentroid(f) {
    const d = katanaData(f);
    const trio = (d.clones || []).filter(c => !c.consumed && !c.reserved).sort((a,b) => a.id - b.id).slice(0, 3);
    if (trio.length < 3) return null;
    const ids = trio.map(c => c.id).join(',');
    const x = trio.reduce((s,c) => s + c.x, 0) / 3;
    const y = trio.reduce((s,c) => s + c.y, 0) / 3;
    return { ids, clones:trio, x, y, radius:C.centroidRadius, visualOnly:true };
  }
  function updateCentroid(f) {
    const d = katanaData(f);
    const trio = oldestAvailableClones(d).slice(0, 3);
    if (trio.length < 3) {
      d.centroid = null;
      return null;
    }
    const ids = trio.map(c => c.id).join(',');
    const x = trio.reduce((s,c) => s + c.x, 0) / 3;
    const y = trio.reduce((s,c) => s + c.y, 0) / 3;
    d.centroid = { ids, clones:trio, x, y, radius:C.centroidRadius };
    return d.centroid;
  }
  function currentFrameRecord(f) {
    const idx = frameIndex(f);
    return { frame:idx, image:frameImages[idx - 1], dir:{x:f.dir.x,y:f.dir.y} };
  }
  function clonePetalOrbit(id) {
    const items=[];
    for(let i=0;i<3;i++){
      const seed=n=>((Math.sin((id*37.17+i*91.73+n*17.41))*43758.5453)%1+1)%1;
      items.push({duration:2.5+seed(1)*1.7,phase:seed(2)*2.7,baseX:(seed(3)-.5)*126,drift:(seed(4)-.5)*34,
        wavePhase:seed(5)*TAU,waveSize:7+seed(6)*11,fall:116+seed(7)*34,rotation:(seed(8)-.5)*1.4,
        spin:1.2+seed(9)*2.4,alpha:.45+seed(10)*.35,scale:.022+seed(11)*.015});
    }
    return items;
  }
  function createClone(f, x=f.x, y=f.y, dir=f.dir) {
    const d = katanaData(f);
    const rec = currentFrameRecord(f);
    const clone = { id:++d.cloneSerial, ownerId:f.id, x, y, dir:{x:dir.x,y:dir.y}, frame:rec.frame, createdAt:matchClock, consumed:false, reserved:false };
    clone.petalOrbit=clonePetalOrbit(clone.id);
    d.clones.push(clone);
    for (let i=0;i<6;i++) spawnPetal(clone.x + rand(-28,28), clone.y + rand(-28,28), rand(-20,20), rand(-34,24), .95 + rand(0,.55), .36, clone.id);
    updateCentroid(f);
    return clone;
  }
  function consumeClone(f, clone, teleport=true) {
    if (!clone || clone.consumed) return false;
    clone.consumed = true;
    clone.reserved = false;
    const from = {x:f.x,y:f.y};
    f.x = clamp(clone.x, f.radius, GAME_SIZE - f.radius);
    f.y = clamp(clone.y, f.radius, GAME_SIZE - f.radius);
    f.setDir(clone.dir.x, clone.dir.y);
    resetAnim(f);
    if (teleport) playKatanaSound('cloneTeleport', .55, .01);
    emitDashPetals(from, f, 12);
    updateCentroid(f);
    return true;
  }
  function reserveClone(clone) {
    if (!clone || clone.consumed || clone.reserved || matchClock - (clone.createdAt ?? -Infinity) < C.cloneMaturity) return false;
    clone.reserved = true;
    return true;
  }
  function emitDashPetals(from, to, count=12) {
    const vx = (to.x || 0) - (from.x || 0), vy = (to.y || 0) - (from.y || 0);
    for (let i=0;i<count;i++) {
      const t = count <= 1 ? .5 : i / (count - 1);
      const x = lerp(from.x, to.x, t) + rand(-18,18);
      const y = lerp(from.y, to.y, t) + rand(-18,18);
      const lateral = norm(-vy, vx);
      spawnPetal(x, y, lateral.x * rand(-90,90) + vx * .10, lateral.y * rand(-90,90) + vy * .10, .55 + rand(0,.55), .45);
    }
  }
  function spawnTwinDeparturePetals(origin, count=26) {
    for (let i=0;i<count;i++) {
      const a = Math.random() * TAU;
      const speed = rand(90, 310);
      const x = origin.x + Math.cos(a) * rand(4, 32);
      const y = origin.y + Math.sin(a) * rand(4, 28);
      spawnPetal(x, y, Math.cos(a) * speed, Math.sin(a) * speed - rand(70, 190), 1.2 + rand(0,.8), .78);
    }
  }
  function spawnPetal(x,y,vx=0,vy=0,life=.8,alpha=.75,cloneId=null, anchor=null) {
    if (state.vfx.length > 360) return;
    const fx = { type:'petal', id:nextVfxId++, x,y,vx:vx+rand(-18,18),vy:vy+rand(-25,20),rot:rand(0,TAU),spin:rand(-5,5),scale:rand(.035,.075) * C.effectScale,life,maxLife:life,alpha,cloneId };
    if (anchor?.target) {
      fx.targetId = anchor.target.id;
      fx.targetRef = anchor.target;
      fx.ox = x - anchor.target.x;
      fx.oy = y - anchor.target.y;
      fx.sticky = true;
    }
    state.vfx.push(fx);
  }
  function spawnSlash(x,y,angle,second=false,target=null) {
    const fx = { type:'slash', id:nextVfxId++, x,y,angle:angle + (second ? Math.PI/3 : 0), scale:(second ? .25 : .22) * C.effectScale, life:.36, maxLife:.36 };
    if (target) {
      fx.targetId = target.id;
      fx.targetRef = target;
      fx.ox = x - target.x;
      fx.oy = y - target.y;
      fx.sticky = true;
    }
    state.vfx.push(fx);
  }
  function spawnAfterimage(f, x, y, dir, frame, life=.34) {
    if (state.vfx.length > 360) return;
    state.vfx.push({ type:'afterimage', id:nextVfxId++, x,y,dir:{x:dir.x,y:dir.y},frame,life,maxLife:life,scale:C.scale, ownerId:f.id });
  }
  function emitAfterimageTrail(f, sx, sy, ex, ey, dir, count=8) {
    const frame = frameIndex(f);
    for (let i=0;i<count;i++) {
      const t = count <= 1 ? .5 : i / (count - 1);
      spawnAfterimage(f, lerp(sx, ex, t), lerp(sy, ey, t), dir, frame, .86 - t * .16);
    }
  }
  function spawnHitBurst(target, dir, count=10) {
    const exit = {x:target.x + dir.x * (target.radius + 8), y:target.y + dir.y * (target.radius + 8)};
    for (let i=0;i<count;i++) {
      const x = exit.x + rand(-14,14);
      const y = exit.y + rand(-14,14);
      spawnPetal(x, y, 0, 0, .55+rand(0,.45), .7, null, {target});
    }
  }
  function syncStickyFx(fx) {
    if (!fx?.sticky || fx.targetId === undefined) return;
    const target = fx.targetRef?.id===fx.targetId ? fx.targetRef : fighters.find(q => q && q.id === fx.targetId);
    if (!target) return;
    fx.targetRef=target;
    fx.x = target.x + (fx.ox || 0);
    fx.y = target.y + (fx.oy || 0);
  }
  function applyKatanaDamage(owner, target, amount, label, dir, wave=false, slashSecond=false, suppressImpactSound=false) {
    if (!live(owner) || !live(target) || amount <= 0) return 0;
    const defendedBladeWave = wave && label === 'katana-blade-wave' && bladeWaveDefenseBuff(target);
    const before = target.hp;
    target.takeDamage(amount, owner, label);
    let dealt = Math.max(0, before - target.hp);
    if (!defendedBladeWave && dealt > 0 && dealt < amount - .001 && target.hp > 0) {
      const deficit = Math.min(amount - dealt, target.hp);
      target.hp = Math.max(0, target.hp - deficit);
      target.damageTaken = (target.damageTaken || 0) + deficit;
      owner.damageDone = (owner.damageDone || 0) + deficit;
      owner.maxHit = Math.max(owner.maxHit || 0, amount);
      owner.damageLabels[label || 'direct'] = (owner.damageLabels[label || 'direct'] || 0) + deficit;
      dealt += deficit;
      if (target.hp <= 0 && !target.killSoundPlayed) {
        target.killSoundPlayed = true;
        playFighterSound(target, 'death');
        triggerSlowMoFinish();
      }
      updateHUD();
    }
    if (dealt > 0) {
      spawnSlash(target.x, target.y, Math.atan2(dir.y, dir.x), slashSecond, target);
      spawnHitBurst(target, dir, label === 'katana-infinite-finisher' ? 4 : wave ? 12 : 10);
      if (!defendedBladeWave && !suppressImpactSound) playKatanaSound(wave ? 'waveHitEnemy' : 'directFleshHit', wave ? .58 : .62, .02);
    }
    if (defendedBladeWave) {
      playKatanaSound('waveHitDefendedObject', .7, .02);
      state.lastWaveDefenseSfx = { target:target.name, at:performance.now() };
    }
    return dealt;
  }
  function bladeWaveDefenseBuff(target) {
    if (!target) return false;
    if (target.name === 'GALAXY' && (target.data?.galaxyPressureArmed || (target.data?.galaxyPressureWindow || 0) > 0)) return true;
    if (target.name === 'SOCCER' && target.data?.soccerPossessionActive && target.y > GAME_SIZE / 2) return true;
    if (target.name === 'ENGINEER' && (target.data?.engineerVirtualShield?.amount || 0) > 0) return true;
    if (target.name === 'ICE') {
      return (projectiles || []).some(p => p?.type === 'ice_lane' && p.owner === target && p.life > 0
        && distToSegment(target.x, target.y, p.x1, p.y1, p.x2, p.y2) <= (p.halfWidth || 0) + target.radius * .3);
    }
    return false;
  }
  function nextOneSwordDamage(f) {
    return C.oneSwordDamage;
  }
  function applyOneSwordDamage(f, target, label, dir, slashSecond=false) {
    const amount = nextOneSwordDamage(f);
    const dealt = applyKatanaDamage(f, target, amount, label, dir, false, slashSecond);
    if (dealt > 0) target.applyStatus('stun', C.oneSwordStun, { source:f, katanaOneSword:true });
    return dealt;
  }
  function twinLifestealActive(f) {
    return (katanaData(f).clones || []).filter(c => !c.consumed).length < 3;
  }
  function applyTwinSwordDamage(f,target,amount,label,dir,waveHit=false,slashSecond=false) {
    const dealt = applyKatanaDamage(f,target,amount,label,dir,waveHit,slashSecond,true);
    if (dealt > 0) {
      playKatanaSound('twoSwordImpact',.8,.04);
      state.lastTwinImpactSfx = {key:'twoSwordImpact',volume:.8,at:performance.now()};
    }
    if (dealt > 0 && twinLifestealActive(f)) f.heal(dealt,false);
    return dealt;
  }
  function spawnWave(owner, dir, opts={}) {
    const d = katanaData(owner);
    if (state.waves.length > 44) state.waves.splice(0, state.waves.length - 44);
    const dmg = opts.damage ?? C.waveDamage;
    const wave = {
      id:nextWaveId++,
      owner,
      x:owner.x + dir.x * 54,
      y:owner.y + dir.y * 54,
      prevX:owner.x,
      prevY:owner.y,
      dir:{x:dir.x,y:dir.y},
      speed:C.waveSpeed,
      damage:dmg,
      baseDamage:C.waveDamage,
      halfWidth:C.waveHalfWidth,
      length:C.waveLength,
      life:opts.life ?? 2.4,
      maxLife:opts.life ?? 2.4,
      bounces:0,
      hit:false,
      twinUsed:false,
      reserved:!!opts.reserved,
      currentSegment:true,
      createdRealAt:performance.now(),
      heldRealUntil:performance.now() + 650
    };
    state.waves.push(wave);
    playKatanaSound('attack', .62, .04);
    recordSkill(owner);
    return wave;
  }
  function ensureBladeMask() {
    const img = images.bladeWave;
    if (!img.complete || !img.naturalWidth) return null;
    if (!bladeMask.canvas || bladeMask.width !== img.naturalWidth || bladeMask.height !== img.naturalHeight) {
      bladeMask.canvas = document.createElement('canvas');
      bladeMask.canvas.width = img.naturalWidth;
      bladeMask.canvas.height = img.naturalHeight;
      bladeMask.ctx = bladeMask.canvas.getContext('2d', { willReadFrequently:true });
      bladeMask.ctx.clearRect(0,0,img.naturalWidth,img.naturalHeight);
      bladeMask.ctx.drawImage(img,0,0);
      bladeMask.data = bladeMask.ctx.getImageData(0,0,img.naturalWidth,img.naturalHeight).data;
      bladeMask.width = img.naturalWidth;
      bladeMask.height = img.naturalHeight;
    }
    return bladeMask;
  }
  function bladeWaveAlphaAt(w, cx, cy, px, py) {
    const mask = ensureBladeMask();
    if (!mask) return false;
    const img = images.bladeWave;
    const angle = Math.atan2(w.dir.y,w.dir.x) - Math.PI / 2;
    const ca = Math.cos(-angle), sa = Math.sin(-angle);
    const dx = px - cx, dy = py - cy;
    const lx = dx * ca - dy * sa;
    const ly = dx * sa + dy * ca;
    const drawW = w.length;
    const drawH = drawW * (img.naturalHeight / img.naturalWidth);
    if (lx < -drawW/2 || lx > drawW/2 || ly < -drawH/2 || ly > drawH/2) return false;
    const ix = Math.floor((lx / drawW + .5) * img.naturalWidth);
    const iy = Math.floor((ly / drawH + .5) * img.naturalHeight);
    if (ix < 0 || iy < 0 || ix >= img.naturalWidth || iy >= img.naturalHeight) return false;
    return mask.data[(iy * mask.width + ix) * 4 + 3] >= C.bladeAlphaThreshold;
  }
  function bladeWaveVisualHit(w, enemy) {
    const sweep = [
      {x:w.prevX,y:w.prevY},
      {x:lerp(w.prevX,w.x,.33),y:lerp(w.prevY,w.y,.33)},
      {x:lerp(w.prevX,w.x,.66),y:lerp(w.prevY,w.y,.66)},
      {x:w.x,y:w.y}
    ];
    const points = [{x:enemy.x,y:enemy.y}];
    for (let ring of [.55, 1]) {
      const r = enemy.radius * ring;
      for (let i=0;i<12;i++) {
        const a = i * TAU / 12;
        points.push({x:enemy.x + Math.cos(a)*r, y:enemy.y + Math.sin(a)*r});
      }
    }
    return sweep.some(c => points.some(p => bladeWaveAlphaAt(w, c.x, c.y, p.x, p.y)));
  }
  function estimateBladeWaveImpactTime(w, enemy) {
    const dx = enemy.x - w.x, dy = enemy.y - w.y;
    const along = dot(dx,dy,w.dir.x,w.dir.y);
    const lateral = Math.abs(dx*w.dir.y - dy*w.dir.x);
    const effectiveLead = Math.max(24,C.waveImpactLead - lateral*.25);
    return clamp((along-effectiveLead) / Math.max(1,w.speed),.025,.75);
  }
  function closingSoon(f,e) {
    return dist(f.x,f.y,e.x,e.y) <= C.oneSwordDistance;
  }
  function postDashImmunityFor(f) {
    return f?.isRage ? C.ragePostDashImmunity : C.postDashImmunity;
  }
  function getKatanaTwoSwordCandidate(f,e,wave=null, clonesOverride=null, options={}) {
    const d = katanaData(f);
    const clones = clonesOverride || oldestAvailableClones(d);
    const axisDir = wave?.dir ? norm(wave.dir.x, wave.dir.y) : dirTo(f,e);
    const axisCenter = wave
      ? {x:wave.x,y:wave.y}
      : {x:f.x + axisDir.x * 54,y:f.y + axisDir.y * 54};
    const halfLength = (wave?.length || C.waveLength) * .5;
    const hitRadius = e.radius + 18;
    let best = null;
    let failReason = clones.length ? 'no aligned clone' : 'no mature clone';
    for (const c of clones) {
      if (dist(c.x,c.y,e.x,e.y) <= C.twinMinCloneDistance) { failReason = 'clone too close to enemy'; continue; }
      const axisProjection = pointLineProjection(c.x,c.y,axisCenter.x,axisCenter.y,axisCenter.x+axisDir.x,axisCenter.y+axisDir.y);
      const pathOffset = dist(c.x,c.y,axisProjection.x,axisProjection.y);
      const pathAlong = dot(c.x-axisCenter.x,c.y-axisCenter.y,axisDir.x,axisDir.y);
      if (pathOffset > (wave?.halfWidth || C.waveHalfWidth)) { failReason = 'clone off wave axis'; continue; }
      if (pathAlong < -halfLength) { failReason = 'clone behind wave segment'; continue; }
      for (let i=0;i<C.twinPathSamples;i++) {
        const u = -halfLength + (halfLength * 2 * i) / Math.max(1, C.twinPathSamples - 1);
        const sourcePoint = {x:axisCenter.x + axisDir.x * u,y:axisCenter.y + axisDir.y * u};
        const proj = pointLineProjection(e.x,e.y,sourcePoint.x,sourcePoint.y,c.x,c.y);
        if (proj.t <= .02 || proj.t >= .98) { failReason = 'enemy not between wave and clone'; continue; }
        const off = dist(e.x,e.y,proj.x,proj.y);
        if (off > hitRadius) { failReason = 'enemy too far from wave-clone line'; continue; }
        const score = off + Math.abs(proj.t - .5) * 10;
        if (!best || score < best.score) best = {clone:c, score, proj, sourcePoint, pathOffset, cloneAlignment:pathOffset, distanceToWaveLine:off, waveAxis:{center:axisCenter,dir:axisDir}};
      }
    }
    if (options.debug || window.__apexKatanaDebugTwoSword) {
      state.lastTwoSwordDebug = {
        waveId:wave?.id ?? null,
        enemyCenter:e ? {x:e.x,y:e.y} : null,
        cloneId:best?.clone?.id ?? null,
        distanceToWaveLine:best?.distanceToWaveLine ?? null,
        cloneAlignment:best?.cloneAlignment ?? null,
        candidate:!!best,
        failReason:best ? null : failReason
      };
    }
    return best;
  }
  function twinCandidate(f,e,wave=null) {
    return getKatanaTwoSwordCandidate(f,e,wave);
  }
  function beginOneSword(f,e,opts={}) {
    const d = katanaData(f);
    if ((d.oneSwordLockoutUntil || 0) > matchClock) return false;
    katanaPerfCounter('oneSwordTriggers');
    d.oneSwordLockoutUntil = matchClock + .92;
    d.twinHistory = [];
    d.pendingTwinInfinite = false;
    createClone(f, f.x, f.y, f.dir);
    const dir = dirTo(f,e);
    let end = {x:clamp(e.x + dir.x * (e.radius + f.radius + 112), f.radius, GAME_SIZE - f.radius), y:clamp(e.y + dir.y * (e.radius + f.radius + 112), f.radius, GAME_SIZE - f.radius)};
    if (opts.manual || d.manual?.enabled) end = controlSafeDashEnd(f, f.x, f.y, end.x, end.y);
    d.visualDir = {x:dir.x,y:dir.y};
    d.awaitFaceFrame1 = true;
    emitAfterimageTrail(f, f.x, f.y, end.x, end.y, dir, 9);
    emitDashPetals({x:f.x,y:f.y}, end, 16);
    const postDashImmunity = opts.postDashImmunity ?? postDashImmunityFor(f);
    d.action = { type:'one', actionId:nextKatanaActionId(f), t:0, duration:C.dashDuration, sx:f.x, sy:f.y, ex:end.x, ey:end.y, dir, targetId:e.id, hit:false, sample:0, postDashImmunity, manual:!!opts.manual };
    f.applyStatus('immune', C.dashDuration + postDashImmunity, { source:f });
    return true;
  }
  function noteTwinUse(f) {
    const d = katanaData(f);
    d.twinHistory = (d.twinHistory || []).filter(t => matchClock - t <= C.twinInfiniteWindow);
    d.twinHistory.push(matchClock);
    if (d.twinHistory.length < 3) return false;
    d.twinHistory = [];
    d.pendingTwinInfinite = true;
    return true;
  }
  function beginInfiniteFinisherOnly(f,e) {
    if (!live(f) || !live(e)) return false;
    const d = katanaData(f);
    const dir = dirTo(f,e);
    playKatanaSound('infiniteSeverStart', .72, .1);
    d.animTime = 0;
    d.lastFrame = 1;
    d.action = {
      type:'infinite', phase:'finisher', finisherOnly:true, leg:3, t:0, route:[], targetId:e.id,
      hit:false, sample:0, finisherHits:0, finisherTimer:C.infiniteFinisherInterval,
      finisherBaseAngle:Math.atan2(dir.y,dir.x), finisherRolls:Array.from({length:10}, () => 1 + Math.floor(Math.random() * 10))
    };
    e.data.katanaSuspendedBy = f.id;
    e.applyStatus('stun', 2, { source:f, katanaInfiniteFinisher:true });
    f.applyStatus('immune', 2, { source:f });
    return true;
  }
  function beginTwin(f,e,candidate, sourceWave=null, opts={}) {
    const d = katanaData(f);
    const clone = candidate.clone;
    if (!reserveClone(clone)) return false;
    katanaPerfCounter('twinTriggers');
    const wave = sourceWave || spawnWave(f, dirTo(f,e), {reserved:true, life:1.3});
    wave.reserved = true;
    wave.twinUsed = true;
    wave.brightRealUntil = performance.now() + 260;
    d.lastTwinPulseCount = (d.lastTwinPulseCount || 0) + 1;
    const departure = {x:f.x,y:f.y};
    consumeClone(f, clone, true);
    spawnTwinDeparturePetals(departure, 26);
    e.data.katanaTwinHeldBy = f.id;
    e.data.katanaTwinAnchor = {x:e.x,y:e.y};
    e.data.positionLocked = true;
    e.applyStatus('stun', 1.8, { source:f, katanaTwin:true });
    spawnShockwave(f.x, f.y, '#ff9dce', 115);
    emitDashPetals({x:f.x-10,y:f.y}, {x:f.x+10,y:f.y}, 10);
    const dir = dirTo(f,e);
    let end = {x:clamp(e.x + dir.x * (e.radius + f.radius + 116), f.radius, GAME_SIZE - f.radius), y:clamp(e.y + dir.y * (e.radius + f.radius + 116), f.radius, GAME_SIZE - f.radius)};
    if (opts.manual || d.manual?.enabled) end = controlSafeDashEnd(f, f.x, f.y, end.x, end.y);
    const pathLength = Math.max(1,dist(f.x,f.y,end.x,end.y));
    const hitDistance = Math.max(0,dist(f.x,f.y,e.x,e.y) - (e.radius + 18));
    const hitProgress = clamp(hitDistance / pathLength,.08,.95);
    const waveImpactTime = Math.max(.025,estimateBladeWaveImpactTime(wave,e));
    const naturalTravelDuration = clamp(pathLength / 4200,.075,.24);
    const naturalHitTime = naturalTravelDuration * hitProgress;
    const waitDuration = Math.max(0,waveImpactTime - naturalHitTime);
    const travelDuration = waveImpactTime < naturalHitTime
      ? clamp(waveImpactTime / Math.max(.08,hitProgress),.045,naturalTravelDuration)
      : naturalTravelDuration;
    d.lastTwinWaveSpeed = wave.speed;
    d.lastTwinWaitDuration = waitDuration;
    d.lastTwinTravelDuration = travelDuration;
    const manual = !!opts.manual || !!d.manual?.enabled;
    d.action = { type:'twin', actionId:nextKatanaActionId(f), phase:waitDuration > .008 ? 'wait' : 'dash', waitRemaining:waitDuration, t:0, duration:travelDuration, sx:f.x, sy:f.y, ex:end.x, ey:end.y, dir, targetId:e.id, hit:false, waveId:wave.id, sample:0, holdStarted:false, pulse2:false, animStart:0, animImpact:(RELEASE_FRAME-1)/FRAME_RATE, manual };
    noteTwinUse(f);
    if (manual) consumeManualTwinRefresh(f);
    f.applyStatus('immune', waitDuration + travelDuration + postDashImmunityFor(f), { source:f });
    return true;
  }
  function finishTwin(f, target) {
    const d = katanaData(f);
    if (target?.data?.katanaTwinHeldBy === f.id) {
      delete target.data.katanaTwinHeldBy;
      delete target.data.katanaTwinAnchor;
      target.data.positionLocked = false;
      if (target.statuses?.stun?.katanaTwin || target.statuses?.stun?.source === f) target.statuses.stun.timer = 0;
    }
    d.animTime = 0;
    d.lastFrame = 1;
    d.lastTwinFinishFrame = 1;
    d.lastTwinReleasedTarget = !target?.hasStatus?.('stun');
    d.awaitFaceFrame1 = false;
    d.noCollisionUntil = matchClock + postDashImmunityFor(f);
    d.action = null;
    if (d.pendingTwinInfinite && live(target)) {
      d.pendingTwinInfinite = false;
      beginInfiniteFinisherOnly(f, target);
    }
  }
  function sortedInfiniteRoute(clones, target) {
    const start = clones.slice().sort((a,b) => a.y - b.y || a.x - b.x || a.id - b.id)[0];
    const cx = target.x, cy = target.y;
    return clones.slice().sort((a,b) => {
      if (a === start) return -1;
      if (b === start) return 1;
      const aa = Math.atan2(a.y - cy, a.x - cx);
      const bb = Math.atan2(b.y - cy, b.x - cx);
      return aa - bb || a.id - b.id;
    });
  }
  function beginInfinite(f,e,opts={}) {
    const d = katanaData(f);
    const centroid = updateCentroid(f);
    if (!centroid || d.action?.type === 'infinite') return false;
    const clones = centroid.clones.slice();
    clones.forEach(c => c.reserved = true);
    katanaPerfCounter('infiniteTriggers');
    playKatanaSound('infiniteSeverStart', .72, .1);
    d.twinHistory = [];
    d.pendingTwinInfinite = false;
    const route = sortedInfiniteRoute(clones, e);
    const manual = !!opts.manual || !!d.manual?.enabled;
    d.action = { type:'infinite', actionId:nextKatanaActionId(f), phase:'leg', leg:0, t:0, route:route.map(c => ({id:c.id, x:c.x, y:c.y, dir:{...c.dir}, frame:c.frame, sourceClone:c})), targetId:e.id, hit:false, sample:0, finisherHits:0, finisherTimer:.18, finisherRolls:Array.from({length:10}, () => 1 + Math.floor(Math.random() * 10)), manual, legDuration:C.infiniteLegDuration };
    e.data.katanaSuspendedBy = f.id;
    e.applyStatus('stun', 5, { source:f });
    f.applyStatus('immune', 5, { source:f });
    startInfiniteLeg(f,e);
    return true;
  }
  function startInfiniteLeg(f,e) {
    const d = katanaData(f);
    const a = d.action;
    const clone = a.route[a.leg];
    if (!clone) {
      a.phase = 'finisher';
      a.t = 0;
      a.finisherTimer = .16;
      return;
    }
    const sx = clone.x;
    const sy = clone.y;
    consumeClone(f, clone.sourceClone || clone, true);
    f.x = sx;
    f.y = sy;
    const dir = norm(e.x - sx, e.y - sy);
    let end = {x:clamp(e.x + dir.x * C.infiniteBeyond, f.radius, GAME_SIZE - f.radius), y:clamp(e.y + dir.y * C.infiniteBeyond, f.radius, GAME_SIZE - f.radius)};
    if (a.manual) end = controlSafeDashEnd(f, sx, sy, end.x, end.y);
    d.visualDir = {x:dir.x,y:dir.y};
    spawnShockwave(sx, sy, '#ffd6ed', 90);
    Object.assign(a, { phase:'leg', t:0, duration:a.legDuration || C.infiniteLegDuration, sx, sy, ex:end.x, ey:end.y, dir, hit:false, sample:0 });
  }
  function beginEvade(f, source) {
    const d = katanaData(f);
    if (d.action?.type === 'infinite') return false;
    const clones = oldestAvailableClones(d);
    if (clones.length < 4) return false;
    const e = source && source.x !== undefined ? source : enemyOf(f);
    const safest = clones.slice().sort((a,b) => (dist(b.x,b.y,e?.x||f.x,e?.y||f.y) - dist(a.x,a.y,e?.x||f.x,e?.y||f.y)) || a.id - b.id)[0];
    if (!safest) return false;
    const from = {x:f.x,y:f.y};
    consumeClone(f, safest, true);
    const postDashImmunity = postDashImmunityFor(f);
    f.applyStatus('immune', postDashImmunity, { source:f });
    d.invulnUntil = matchClock + postDashImmunity;
    emitDashPetals(from, f, 12);
    return true;
  }
  const MANUAL = Object.freeze({
    qDistance:800,
    qCooldown:5,
    qWindow:1,
    lmbCooldown:2,
    evadeCooldown:7,
    rewriteCooldown:10,
    rewriteDuration:.6,
    apexChargeDuration:2,
    apexFanWaves:10,
    apexFanArc:Math.PI * 2 / 3,
    lmbReleaseTime:2 / FRAME_RATE
  });
  function manualState(f) {
    const d = katanaData(f);
    return d.manual || (d.manual = {
      enabled:true, mode:'idle', swordTime:0, lmbCooldown:0, qCooldown:0, eCooldown:0, qCastId:0, qWindowRemaining:0,
      qWindowConsumed:false, qDash:null, rewrite:null, rCooldown:0, rCharge:null, collisionCd:0, selectedEvadeId:null,
      selectedRewriteId:null, selectionNextAt:0, selectionAimX:null, selectionAimY:null, feedback:'', feedbackUntil:0
    });
  }
  function isManualKatana(f) {
    return !!(f?.name === 'KATANA' && f.data?.manualController?.mode === 'MANUAL_LAB' && f.data.manualController.active);
  }
  function normalizeManualMove(v) {
    if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return {x:0,y:0};
    const len = Math.hypot(v.x, v.y);
    return len > 0 ? {x:v.x/len, y:v.y/len} : {x:0,y:0};
  }
  function markManualKatanaIntent(f, controller, d=katanaData(f), m=manualState(f)) {
    const aim = controller?.getAimPoint?.();
    const aimDir = aim && controller?.hasAimPoint?.() && Number.isFinite(aim.x) && Number.isFinite(aim.y)
      ? norm(aim.x - f.x, aim.y - f.y)
      : norm(d.visualDir?.x || f.dir?.x || 1, d.visualDir?.y || f.dir?.y || 0);
    const move = normalizeManualMove(controller?.getMoveVector?.());
    const actionLocked = !!(d.action || m.qDash || m.rewrite || m.rCharge);
    f.data ||= {};
    f.data.apexControlManualMove = move;
    f.data.apexControlManualAimDir = {x:aimDir.x || 1, y:aimDir.y || 0};
    f.data.apexControlManualBaseLock = true;
    f.data.apexControlManualActionLock = actionLocked;
    f.data.positionLocked = true;
    if (!actionLocked && (aimDir.x || aimDir.y)) {
      f.setDir(aimDir.x, aimDir.y);
      d.visualDir = {x:aimDir.x, y:aimDir.y};
    }
    return {aimDir, move, actionLocked};
  }
  function manualFeedback(f, text, duration=.7) {
    const m = manualState(f);
    m.feedback = text;
    m.feedbackUntil = matchClock + duration;
  }
  function updateManualCloneSelection(d, m, aim, active) {
    if (!aim || (m.selectionNextAt || 0) > matchClock) return;
    m.selectionNextAt = matchClock + .05;
    m.selectionAimX = aim.x;
    m.selectionAimY = aim.y;
    const available = oldestAvailableClones(d);
    m.selectedEvadeId = available.length > 3 ? cloneUnderPoint(available, aim)?.id ?? null : null;
    m.selectedRewriteId = active ? cloneUnderPoint(active.clones, aim)?.id ?? null : null;
  }
  function consumeManualTwinRefresh(f) {
    const m = katanaData(f).manual;
    if (!m?.enabled || m.qWindowConsumed || m.qWindowRemaining <= 0) return false;
    m.qCooldown = 0;
    m.qWindowRemaining = 0;
    m.qWindowConsumed = true;
    manualFeedback(f, 'Q REFRESHED', .8);
    return true;
  }
  function cloneHitRadius(c) {
    const img = frameImages[(c?.frame || 1) - 1];
    const w = (img?.naturalWidth || C.drawW) * C.scale;
    const h = (img?.naturalHeight || C.drawH) * C.scale;
    return Math.max(30, Math.min(78, Math.max(w,h) * .42));
  }
  function cloneUnderPoint(clones, point) {
    if (!point) return null;
    let best = null, bestDist = Infinity;
    for (const c of clones || []) {
      if (!c || c.consumed || c.reserved) continue;
      const dx = c.x - point.x, dy = c.y - point.y;
      const d2 = dx * dx + dy * dy;
      const r = cloneHitRadius(c);
      if (d2 > r * r) continue;
      if (!best || d2 < bestDist || (d2 === bestDist && c.id < best.id)) {
        best = c;
        bestDist = d2;
      }
    }
    return best;
  }
  function resetManualPose(f, preserveCooldowns=true) {
    const d = katanaData(f), old = d.manual;
    const keepManual = isManualKatana(f);
    const qCooldown = keepManual && preserveCooldowns ? old?.qCooldown || 0 : 0;
    const rCooldown = keepManual && preserveCooldowns ? old?.rCooldown || 0 : 0;
    d.manual = keepManual ? null : undefined;
    const m = keepManual ? manualState(f) : null;
    if (m) {
      m.qCooldown = qCooldown;
      m.rCooldown = rCooldown;
    }
    d.action = null;
    d.manualQPassThrough = false;
    resetAnim(f);
    return m;
  }
  function cancelManualPreparation(f) {
    const d = katanaData(f), m = manualState(f);
    m.mode = 'idle';
    m.swordTime = 0;
    m.qDash = null;
    d.manualQPassThrough = false;
    resetAnim(f);
  }
  function sweepPointFraction(sx,sy,ex,ey,cx,cy,r) {
    const vx=ex-sx, vy=ey-sy, ox=sx-cx, oy=sy-cy;
    const a=vx*vx+vy*vy;
    if (a <= 1e-9) return ox*ox+oy*oy <= r*r ? 0 : null;
    const c=ox*ox+oy*oy-r*r;
    if (c <= 0) return 0;
    const b=2*(ox*vx+oy*vy), disc=b*b-4*a*c;
    if (disc < 0) return null;
    const t=(-b-Math.sqrt(disc))/(2*a);
    return t >= 0 && t <= 1 ? t : null;
  }
  function qBlockFraction(f,sx,sy,ex,ey) {
    let best=1;
    const apexWalls = window.APEX_CONTROL_BATTLE_WALLS;
    if (apexWalls?.active?.()) {
      const wall = apexWalls.raycast?.(sx, sy, ex, ey, f.radius || 0);
      if (wall) {
        const cx = clamp((wall.x || 0) + (wall.w || 0) / 2, Math.min(sx, ex), Math.max(sx, ex));
        const cy = clamp((wall.y || 0) + (wall.h || 0) / 2, Math.min(sy, ey), Math.max(sy, ey));
        const total = Math.max(1, dist(sx, sy, ex, ey));
        best = Math.min(best, clamp(dist(sx, sy, cx, cy) / total - .01, 0, 1));
      }
    }
    const engineer=window.APEX_ENGINEER;
    for (const s of engineer?.allStructures?.() || []) {
      if (!s || s.dead || s.hp <= 0 || s.owner === f) continue;
      const radius=(engineer.structureFootprint?.(s) || s.blockRadius || s.radius || 36) + f.radius;
      const t=sweepPointFraction(sx,sy,ex,ey,s.x,s.y,radius);
      if (t !== null) best=Math.min(best,Math.max(0,t-.002));
    }
    return best;
  }
  function controlWallPadding(f) {
    return Math.min(42, (f.radius || 0) * .45);
  }
  function controlPathBlocked(f, sx, sy, ex, ey) {
    const apexWalls = window.APEX_CONTROL_BATTLE_WALLS;
    if (!apexWalls?.active?.()) return false;
    const r = f.radius || 0;
    const end = {x:ex,y:ey};
    return !!(apexWalls.isBlocked?.(ex, ey, r) || apexWalls.segmentIntersectsWall?.({x:sx,y:sy}, end, controlWallPadding(f)));
  }
  function controlSafeDashEnd(f, sx, sy, ex, ey) {
    const r = f.radius || 0;
    const end = {x:clamp(ex, r, GAME_SIZE - r), y:clamp(ey, r, GAME_SIZE - r)};
    const apexWalls = window.APEX_CONTROL_BATTLE_WALLS;
    if (!apexWalls?.active?.() || !controlPathBlocked(f, sx, sy, end.x, end.y)) return end;
    let lo = 0, hi = 1;
    let best = {x:sx, y:sy};
    for (let i = 0; i < 12; i += 1) {
      const mid = (lo + hi) / 2;
      const p = {x:lerp(sx, end.x, mid), y:lerp(sy, end.y, mid)};
      if (controlPathBlocked(f, sx, sy, p.x, p.y)) hi = mid;
      else { best = p; lo = mid; }
    }
    return {x:clamp(best.x, r, GAME_SIZE - r), y:clamp(best.y, r, GAME_SIZE - r)};
  }
  function beginManualOne(f,e) {
    const d=katanaData(f), m=manualState(f);
    d.oneSwordLockoutUntil=0;
    m.mode='recovery';
    m.swordTime=Math.max(m.swordTime,(RELEASE_FRAME-1)/FRAME_RATE);
    d.animTime=m.swordTime;
    return beginOneSword(f,e,{manual:true,postDashImmunity:postDashImmunityFor(f)});
  }
  function manualCollisionOne(f,e) {
    if (!isManualKatana(f) || !live(e)) return false;
    const d=katanaData(f), m=manualState(f);
    if (d.action || !['rmbWindup','rmbHold'].includes(m.mode)) return false;
    m.swordTime=(RELEASE_FRAME-1)/FRAME_RATE;
    d.animTime=m.swordTime;
    return beginManualOne(f,e);
  }
  function acceptManualQ(f,e,controller) {
    const d=katanaData(f), m=manualState(f);
    if (m.qCooldown > 0 || m.qDash || d.action || m.rewrite || m.mode === 'recovery') return false;
    if (!['idle','lmbWindup','rmbWindup','rmbHold'].includes(m.mode) || f.hasStatus?.('abilityDisabled') || f.hardCC?.()) return false;
    const aim=controller.getAimPoint(), dir=norm(aim.x-f.x,aim.y-f.y);
    if (!Number.isFinite(dir.x) || (!dir.x && !dir.y)) return false;
    const length=Math.min(MANUAL.qDistance,dist(f.x,f.y,aim.x,aim.y));
    if (length <= .5) return false;
    const sx=f.x, sy=f.y;
    const rawX=clamp(sx+dir.x*length,f.radius,GAME_SIZE-f.radius);
    const rawY=clamp(sy+dir.y*length,f.radius,GAME_SIZE-f.radius);
    const block=qBlockFraction(f,sx,sy,rawX,rawY);
    const safeEnd=controlSafeDashEnd(f,sx,sy,lerp(sx,rawX,block),lerp(sy,rawY,block));
    const ex=safeEnd.x, ey=safeEnd.y;
    if (dist(sx,sy,ex,ey) <= .5) return false;
    m.qCooldown=MANUAL.qCooldown;
    m.qCastId++;
    m.qWindowRemaining=MANUAL.qWindow;
    m.qWindowConsumed=false;
    m.qDash={sx,sy,ex,ey,t:0,duration:C.dashDuration,dir,withPreparation:['rmbWindup','rmbHold'].includes(m.mode),sample:0};
    d.manualQPassThrough=!m.qDash.withPreparation;
    emitAfterimageTrail(f,sx,sy,ex,ey,dir,7);
    emitDashPetals({x:sx,y:sy},{x:ex,y:ey},10);
    return true;
  }
  function updateManualQ(f,e,dt) {
    const d=katanaData(f), m=manualState(f), q=m.qDash;
    if (!q) return false;
    q.t+=dt;
    const p=clamp(q.t/q.duration,0,1), prev={x:f.x,y:f.y};
    let nx=lerp(q.sx,q.ex,p), ny=lerp(q.sy,q.ey,p);
    if (q.withPreparation && live(e)) {
      const hit=sweepPointFraction(prev.x,prev.y,nx,ny,e.x,e.y,f.radius+e.radius);
      if (hit !== null) {
        f.x=lerp(prev.x,nx,hit); f.y=lerp(prev.y,ny,hit);
        m.qDash=null; d.manualQPassThrough=false;
        manualCollisionOne(f,e);
        return true;
      }
    }
    f.x=nx; f.y=ny; f.setDir(q.dir.x,q.dir.y); f.data.positionLocked=true;
    q.sample+=dt;
    if (q.sample >= .055) { q.sample=0; spawnAfterimage(f,f.x,f.y,q.dir,frameIndex(f),.3); }
    if (p >= 1) { m.qDash=null; d.manualQPassThrough=false; }
    return true;
  }
  function manualEvade(f,controller) {
    const d=katanaData(f), m=manualState(f);
    if (d.action?.type === 'infinite' || d.action?.type === 'twin' || !live(f)) return false;
    if (m.eCooldown > 0) { manualFeedback(f, `E ${m.eCooldown.toFixed(1)}s`); return false; }
    const available=oldestAvailableClones(d);
    if (available.length <= 3) { manualFeedback(f,'E NEEDS >3 CLONES'); return false; }
    const e = enemyOf(f);
    const selected=available.slice().sort((a,b) => (dist(b.x,b.y,e?.x || f.x,e?.y || f.y) - dist(a.x,a.y,e?.x || f.x,e?.y || f.y)) || a.id - b.id)[0];
    if (!selected || !reserveClone(selected)) { manualFeedback(f,'NO CLONE UNDER CURSOR'); return false; }
    const from={x:f.x,y:f.y};
    d.action=null; m.rewrite=null; m.qDash=null; d.manualQPassThrough=false;
    if (!consumeClone(f,selected,true)) { selected.reserved=false; return false; }
    const post=postDashImmunityFor(f);
    f.applyStatus('immune',post,{source:f}); d.invulnUntil=matchClock+post;
    emitDashPetals(from,f,12);
    m.mode='idle'; m.swordTime=0; resetAnim(f); updateCentroid(f);
    m.eCooldown = MANUAL.evadeCooldown;
    manualFeedback(f,'CLONE EVADE',.55);
    return true;
  }
  function beginRewrite(f,controller) {
    const d=katanaData(f), m=manualState(f), c=updateCentroid(f);
    if (m.rCooldown>0 || m.rewrite || d.action || !c || oldestAvailableClones(d).length<3) return false;
    const selected=cloneUnderPoint(c.clones,controller.getAimPoint());
    if (!selected || selected.reserved || selected.consumed) { manualFeedback(f,'R: SELECT ACTIVE CLONE'); return false; }
    const captured={x:f.x,y:f.y,dir:{x:(d.visualDir||f.dir).x,y:(d.visualDir||f.dir).y},frame:frameIndex(f)};
    const others=c.clones.filter(q=>q!==selected);
    const future={x:(others[0].x+others[1].x+captured.x)/3,y:(others[0].y+others[1].y+captured.y)/3};
    m.rCooldown=MANUAL.rewriteCooldown;
    m.rewrite={timer:MANUAL.rewriteDuration,sourceId:selected.id,oldCentroid:{x:c.x,y:c.y,ids:c.ids},future,captured};
    manualFeedback(f,'LUNAR REWRITE',.6);
    return true;
  }
  function cancelRewrite(f) {
    const m=manualState(f);
    m.rewrite=null;
  }
  function updateRewrite(f,e,dt) {
    const d=katanaData(f), m=manualState(f), r=m.rewrite;
    if (!r) return false;
    const source=d.clones.find(c=>c.id===r.sourceId);
    if (!source || source.consumed || source.reserved) { cancelRewrite(f); return false; }
    r.timer-=dt;
    if (r.timer>0) return true;
    source.x=clamp(r.captured.x,f.radius,GAME_SIZE-f.radius);
    source.y=clamp(r.captured.y,f.radius,GAME_SIZE-f.radius);
    source.dir={...r.captured.dir}; source.frame=r.captured.frame;
    m.rewrite=null;
    const next=updateCentroid(f);
    if (next && e && dist(e.x,e.y,next.x,next.y)<=next.radius+e.radius*.12) beginInfinite(f,e,{manual:true});
    return true;
  }
  function spawnManualFanWaves(f, dir) {
    const base = Math.atan2(dir.y || f.dir?.y || 0, dir.x || f.dir?.x || 1);
    const count = MANUAL.apexFanWaves;
    const arc = MANUAL.apexFanArc;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? .5 : i / (count - 1);
      const a = base - arc / 2 + arc * t;
      spawnWave(f, {x:Math.cos(a), y:Math.sin(a)}, {life:2.55});
    }
    spawnShockwave(f.x, f.y, C.color, 210);
    manualFeedback(f, 'TEN WAVE ARC', .8);
  }
  function beginManualApexCharge(f, controller) {
    const d=katanaData(f), m=manualState(f);
    if (m.rCooldown > 0 || m.rCharge || d.action || m.qDash || f.hardCC?.() || f.hasStatus?.('abilityDisabled')) return false;
    const aim = controller.getAimPoint?.() || {x:f.x + (f.dir?.x || 1), y:f.y + (f.dir?.y || 0)};
    const dir = norm(aim.x - f.x, aim.y - f.y);
    m.rCooldown = MANUAL.rewriteCooldown;
    m.rCharge = {timer:MANUAL.apexChargeDuration, dir:dir.x || dir.y ? dir : (d.visualDir || f.dir || {x:1,y:0})};
    m.mode = 'apexCharge';
    m.swordTime = 0;
    d.action = null;
    d.manualQPassThrough = false;
    manualFeedback(f, 'APEX CHARGE', .7);
    return true;
  }
  function updateManualApexCharge(f, dt) {
    const d=katanaData(f), m=manualState(f), charge=m.rCharge;
    if (!charge) return false;
    f.data.positionLocked = true;
    f.applyStatus?.('immune', .16, {source:f, katanaApexCharge:true});
    d.invulnUntil = Math.max(d.invulnUntil || 0, matchClock + .16);
    charge.timer -= dt;
    d.animTime = 0;
    d.lastFrame = frameIndex(f);
    if (charge.timer > 0) return true;
    d.animTime = (RELEASE_FRAME - 1) / FRAME_RATE;
    d.lastFrame = RELEASE_FRAME;
    spawnManualFanWaves(f, charge.dir);
    m.rCharge = null;
    m.mode = 'recovery';
    m.swordTime = (RELEASE_FRAME - 1) / FRAME_RATE;
    return true;
  }
  function commitManualLmb(f,e,controller) {
    const d=katanaData(f), m=manualState(f);
    if (m.lmbCooldown > 0) return false;
    const secondary = controller.isHeld?.('SECONDARY');
    if (secondary && e && dist(f.x,f.y,e.x,e.y) <= C.oneSwordDistance && beginManualOne(f,e)) {
      m.lmbCooldown = MANUAL.lmbCooldown;
      m.mode='recovery';
      return 'one';
    }
    const twin=e ? twinCandidate(f,e) : null;
    if (twin && beginTwin(f,e,twin,null,{manual:true})) { m.lmbCooldown = MANUAL.lmbCooldown; m.mode='recovery'; return 'twin'; }
    if (e && dist(f.x,f.y,e.x,e.y)<=50 && beginManualOne(f,e)) { m.lmbCooldown = MANUAL.lmbCooldown; return 'one'; }
    const aim=controller.getAimPoint(), dir=norm(aim.x-f.x,aim.y-f.y);
    spawnWave(f,dir.x||dir.y?dir:(d.visualDir||f.dir));
    d.twinHistory=[]; d.pendingTwinInfinite=false;
    m.lmbCooldown = MANUAL.lmbCooldown;
    m.mode='recovery';
    return 'wave';
  }
  function updateManualAnimation(f,e,dt,controller) {
    const d=katanaData(f), m=manualState(f);
    if (d.action?.type === 'twin' || d.action?.type === 'infinite') return;
    const frozen=f.hasStatus?.('stun') || f.hasStatus?.('freeze') || window.__apexUniversalVisualStopMotionActive?.();
    const secondary=controller.isHeld('SECONDARY');
    if ((m.mode==='rmbWindup'||m.mode==='rmbHold') && !secondary) { cancelManualPreparation(f); return; }
    if (m.mode==='idle') { m.swordTime=0; d.animTime=0; d.lastFrame=1; return; }
    if (m.mode==='rmbHold') { m.swordTime=15/FRAME_RATE; d.animTime=m.swordTime; d.lastFrame=16; return; }
    if (frozen) return;
    const previous=m.swordTime;
    m.swordTime=Math.min(LOOP,m.swordTime+dt);
    if (m.mode==='rmbWindup' && m.swordTime>=15/FRAME_RATE) { m.swordTime=15/FRAME_RATE; m.mode='rmbHold'; }
    if (m.mode==='lmbWindup' && previous<MANUAL.lmbReleaseTime && m.swordTime>=MANUAL.lmbReleaseTime) {
      m.swordTime=(RELEASE_FRAME-1)/FRAME_RATE;
      commitManualLmb(f,e,controller);
    }
    if (m.mode==='recovery' && m.swordTime>=LOOP) { m.mode='idle'; m.swordTime=0; }
    d.animTime=m.swordTime; d.lastFrame=frameIndex(f);
  }
  function manualKatanaThink(f,e,dt,controller) {
    const d=katanaData(f), m=manualState(f);
    m.enabled=true;
    if (katanaShouldRage(f) && !f.isRage) { f.isRage=true; f.rageStartHp=f.hp; d.rage=true; spawnShockwave(f.x,f.y,C.color,190); }
    m.lmbCooldown=Math.max(0,(m.lmbCooldown || 0)-dt);
    m.qCooldown=Math.max(0,m.qCooldown-dt);
    m.eCooldown=Math.max(0,(m.eCooldown || 0)-dt);
    m.rCooldown=Math.max(0,m.rCooldown-dt);
    m.collisionCd=Math.max(0,(m.collisionCd || 0)-dt);
    m.qWindowRemaining=Math.max(0,m.qWindowRemaining-dt);
    const aim=controller.getAimPoint();
    markManualKatanaIntent(f, controller, d, m);
    const active=updateCentroid(f);
    updateManualCloneSelection(d,m,aim,active);
    if (e && active && !d.action) {
      const prev=d.lastEnemy&&Number.isFinite(d.lastEnemy.x)?d.lastEnemy:{x:e.x,y:e.y};
      const steppedIntoCentroid = dist(e.x,e.y,active.x,active.y) <= active.radius + e.radius * .55;
      if (steppedIntoCentroid || segmentCircleHit(prev.x,prev.y,e.x,e.y,active.x,active.y,active.radius+e.radius*.55)) {
        cancelRewrite(f); beginInfinite(f,e,{manual:true});
      }
    }
    if (controller.consume('ABILITY_2')) manualEvade(f,controller);
    const actionBefore=d.action?.type || null;
    if (updateManualApexCharge(f, dt)) {
      markManualKatanaIntent(f, controller, d, m);
      updateMoon(f,dt);
      if (e) d.lastEnemy={x:e.x,y:e.y};
      return;
    }
    const acted=updateAction(f,e,dt);
    if ((actionBefore === 'twin' || actionBefore === 'infinite') && !d.action) {
      m.mode='idle'; m.swordTime=0; d.manualQPassThrough=false; resetAnim(f);
    }
    if (d.action?.type==='infinite' || d.action?.type==='twin') {
      m.qDash=null;
      d.manualQPassThrough=false;
      markManualKatanaIntent(f, controller, d, m);
      updateMoon(f,dt);
      if (e) d.lastEnemy={x:e.x,y:e.y};
      return;
    }
    if (!d.action) updateRewrite(f,e,dt);
    if (controller.consume('APEX')) beginManualApexCharge(f,controller);
    if (controller.consume('ABILITY_1')) acceptManualQ(f,e,controller);
    updateManualQ(f,e,dt);
    if (!d.action && !m.rewrite && m.mode==='idle') {
      if (controller.isHeld('PRIMARY') && m.lmbCooldown <= 0) { m.mode='lmbWindup'; m.swordTime=0; resetAnim(f); }
      else if (controller.isHeld('SECONDARY')) { m.mode='rmbWindup'; m.swordTime=0; resetAnim(f); }
    } else if (m.mode!=='idle') controller.consume('PRIMARY');
    updateManualAnimation(f,e,dt,controller);
    if (!acted && !m.qDash && !d.action) markManualKatanaIntent(f, controller, d, m);
    else {
      f.data ||= {};
      f.data.apexControlManualBaseLock = true;
      f.data.apexControlManualActionLock = !!(d.action || m.qDash || m.rewrite || m.rCharge);
      f.data.positionLocked = true;
    }
    updateMoon(f,dt);
    if (e) d.lastEnemy={x:e.x,y:e.y};
  }
  function updateAction(f, e, dt) {
    const d = katanaData(f);
    const a = d.action;
    if (!a) return false;
    const lockedTarget = a.targetId !== undefined ? fighters.find(q => q && q.id === a.targetId) : e;
    if (!live(lockedTarget) && a.type !== 'one') { d.action = null; return false; }
    if (a.type === 'twin' && a.phase === 'wait') {
      const targetLock = lockedTarget;
      f.x = a.sx; f.y = a.sy; f.data.positionLocked = true;
      d.animTime = 0;
      if (targetLock) {
        const anchor = targetLock.data.katanaTwinAnchor;
        if (anchor) { targetLock.x = anchor.x; targetLock.y = anchor.y; }
        targetLock.data.positionLocked = true;
        targetLock.applyStatus('stun',.12,{source:f,katanaTwin:true});
      }
      a.waitRemaining -= dt;
      if (a.waitRemaining <= 0) { a.phase = 'dash'; a.t = 0; }
      return true;
    }
    if (a.type === 'one' || (a.type === 'twin' && a.phase === 'dash')) {
      if (a.type === 'twin' && a.releaseWave) {
        const wave = state.waves.find(w => w.id === a.waveId);
        if (wave) wave.held = false;
        a.releaseWave = false;
      }
      a.t += dt;
      const p = clamp(a.t / Math.max(.001, a.duration), 0, 1);
      const prev = {x:f.x,y:f.y};
      f.x = lerp(a.sx, a.ex, p);
      f.y = lerp(a.sy, a.ey, p);
      f.setDir(a.dir.x, a.dir.y);
      f.data.positionLocked = true;
      if (a.type === 'twin') {
        const targetLock = lockedTarget;
        if (targetLock) {
          const anchor = targetLock.data.katanaTwinAnchor;
          if (anchor) { targetLock.x = anchor.x; targetLock.y = anchor.y; }
          targetLock.data.positionLocked = true;
          targetLock.applyStatus('stun', .12, { source:f, katanaTwin:true });
        }
        if (Number.isFinite(a.hitProgress)) {
          const postHit = clamp((p - a.hitProgress) / Math.max(.001, 1 - a.hitProgress), 0, 1);
          d.animTime = lerp(a.animImpact, LOOP, postHit);
        } else {
          d.animTime = lerp(a.animStart ?? d.animTime, a.animImpact ?? d.animTime, p);
        }
        if (!a.pulse2 && p >= .34) {
          a.pulse2 = true;
          const wave = state.waves.find(w => w.id === a.waveId);
          if (wave) {
            wave.brightHeld = true;
            wave.brightRealUntil = performance.now() + 420;
          }
          d.lastTwinPulseCount = (d.lastTwinPulseCount || 0) + 1;
          spawnShockwave(f.x, f.y, '#ffd6ed', 135);
          emitDashPetals({x:f.x-a.dir.x*18,y:f.y-a.dir.y*18}, {x:f.x+a.dir.x*18,y:f.y+a.dir.y*18}, 12);
        }
      }
      a.sample += dt;
      if (a.sample >= .055) {
        a.sample = 0;
        spawnAfterimage(f, f.x, f.y, f.dir, frameIndex(f), .32);
      }
      const target = lockedTarget;
      if (target && !a.hit && segmentCircleHit(prev.x,prev.y,f.x,f.y,target.x,target.y,target.radius + 18)) {
        a.hit = true;
        if (a.type === 'twin') {
          a.hitProgress = p;
          d.animTime = (RELEASE_FRAME - 1) / FRAME_RATE;
        }
        if (a.type === 'twin') d.lastTwinImpactFrame = frameIndex(f);
        if (a.type === 'twin') applyTwinSwordDamage(f, target, C.twoSwordDamage / 2, 'katana-twin-dash', a.dir, false, false);
        else applyOneSwordDamage(f, target, 'katana-one-sword', a.dir, false);
        if (a.type === 'twin') {
          const wave = state.waves.find(w => w.id === a.waveId);
          const waveDmg = C.twoSwordDamage / 2;
          if (wave) { wave.hit = true; wave.life = 0; wave.held = false; wave.brightHeld = false; wave.brightRealUntil = 0; }
          applyTwinSwordDamage(f, target, waveDmg, f.isRage ? 'katana-rage-twin-wave' : 'katana-twin-wave', {x:-a.dir.x,y:-a.dir.y}, true, true);
        }
      }
      if (p >= 1) {
        if (target) {
          const minPass = target.radius + f.radius + 96;
          const along = dot(f.x - target.x, f.y - target.y, a.dir.x, a.dir.y);
          if (along < minPass) {
            f.x = clamp(target.x + a.dir.x * minPass, f.radius, GAME_SIZE - f.radius);
            f.y = clamp(target.y + a.dir.y * minPass, f.radius, GAME_SIZE - f.radius);
            if (a.manual) {
              const safe = controlSafeDashEnd(f, target.x, target.y, f.x, f.y);
              f.x = safe.x;
              f.y = safe.y;
            }
          }
        }
        if (target && !a.hit) {
          a.hit = true;
          if (a.type === 'twin') {
            a.hitProgress = p;
            d.animTime = (RELEASE_FRAME - 1) / FRAME_RATE;
          }
          if (a.type === 'twin') d.lastTwinImpactFrame = frameIndex(f);
          if (a.type === 'twin') applyTwinSwordDamage(f, target, C.twoSwordDamage / 2, 'katana-twin-dash', a.dir, false, false);
          else applyOneSwordDamage(f, target, 'katana-one-sword', a.dir, false);
          if (a.type === 'twin') {
            const wave = state.waves.find(w => w.id === a.waveId);
            const waveDmg = C.twoSwordDamage / 2;
            if (wave) { wave.hit = true; wave.life = 0; wave.held = false; wave.brightHeld = false; wave.brightRealUntil = 0; }
            applyTwinSwordDamage(f, target, waveDmg, f.isRage ? 'katana-rage-twin-wave' : 'katana-twin-wave', {x:-a.dir.x,y:-a.dir.y}, true, true);
          }
        }
        if (a.type === 'twin') {
          finishTwin(f, target);
        } else {
          d.noCollisionUntil = matchClock + (a.postDashImmunity ?? postDashImmunityFor(f));
          d.awaitFaceFrame1 = true;
          d.action = null;
        }
      }
      return true;
    }
    if (a.type === 'infinite') {
      const target = lockedTarget;
      if (target) {
        target.data.positionLocked = true;
        target.applyStatus('stun', .12, { source:f });
      }
      f.data.positionLocked = true;
      if (a.phase === 'leg') {
        a.t += dt;
        const p = clamp(a.t / Math.max(.001, a.duration || C.infiniteLegDuration), 0, 1);
        const dashP = 1 - Math.pow(1 - p, 2.4);
        const prev = {x:f.x,y:f.y};
        d.animTime = lerp(0, (C.infiniteEndFrame - 1) / FRAME_RATE, dashP);
        f.x = lerp(a.sx, a.ex, dashP);
        f.y = lerp(a.sy, a.ey, dashP);
        f.setDir(a.dir.x, a.dir.y);
        a.sample += dt;
        if (dashP > 0 && a.sample >= .055) {
          a.sample = 0;
          spawnAfterimage(f, f.x, f.y, f.dir, frameIndex(f), .34);
        }
        if (target && !a.hit && segmentCircleHit(prev.x,prev.y,f.x,f.y,target.x,target.y,target.radius + 18)) {
          a.hit = true;
          applyKatanaDamage(f, target, C.infiniteLegDamage[a.leg] ?? C.oneSwordDamage, 'katana-infinite-leg', a.dir, false);
        }
        if (p >= 1) {
          if (target && !a.hit) {
            a.hit = true;
            applyKatanaDamage(f, target, C.infiniteLegDamage[a.leg] ?? C.oneSwordDamage, 'katana-infinite-leg', a.dir, false);
          }
          d.lastInfiniteLegEndFrames ||= [];
          d.lastInfiniteLegEndFrames.push(frameIndex(f));
          a.leg += 1;
          if (a.leg >= 3) {
            a.phase = 'finisher';
            a.t = 0;
            a.finisherTimer = C.infiniteFinisherInterval;
            a.finisherBaseAngle = Math.atan2(a.dir.y, a.dir.x);
            d.animTime = 0;
          } else startInfiniteLeg(f, target || e);
        }
      } else if (a.phase === 'finisher') {
        a.finisherTimer -= dt;
        if (a.manual && a.finisherTimer < -C.infiniteFinisherInterval) {
          a.finisherTimer = -C.infiniteFinisherInterval;
        }
        d.animTime = lerp(0, (C.infiniteEndFrame - 1) / FRAME_RATE, clamp(1 - a.finisherTimer / C.infiniteFinisherInterval, 0, 1));
        let finisherHitsThisFrame = 0;
        const finisherHitBudget = a.manual ? 1 : 10;
        while (a.finisherTimer <= 0 && a.finisherHits < 10 && finisherHitsThisFrame < finisherHitBudget) {
          finisherHitsThisFrame += 1;
          d.animTime = (C.infiniteEndFrame - 1) / FRAME_RATE;
          a.finisherTimer += C.infiniteFinisherInterval;
          const pass = a.finisherHits++;
          const roll = a.finisherRolls[pass];
          const axisIndex = Math.floor(pass / 2);
          const axisAngle = (a.finisherBaseAngle ?? Math.atan2(a.dir?.y || 0, a.dir?.x || 1)) + axisIndex * Math.PI / 5;
          const axis = {x:Math.cos(axisAngle),y:Math.sin(axisAngle)};
          const side = pass % 2 === 0 ? -1 : 1;
          const from = {x:f.x,y:f.y};
          let end = target ? {
            x:clamp(target.x + axis.x * C.infiniteBeyond * side, f.radius, GAME_SIZE - f.radius),
            y:clamp(target.y + axis.y * C.infiniteBeyond * side, f.radius, GAME_SIZE - f.radius)
          } : from;
          if (a.manual) end = controlSafeDashEnd(f, from.x, from.y, end.x, end.y);
          const dir = norm(end.x - from.x, end.y - from.y);
          emitAfterimageTrail(f, from.x, from.y, end.x, end.y, dir, 4);
          emitDashPetals(from, end, 5);
          f.x = end.x;
          f.y = end.y;
          f.setDir(dir.x, dir.y);
          d.visualDir = {x:dir.x,y:dir.y};
          a.lastFinisherAxis = axisIndex;
          a.lastFinisherSide = side;
          d.lastInfiniteFinisherFrames ||= [];
          d.lastInfiniteFinisherFrames.push(frameIndex(f));
          if (target) applyKatanaDamage(f, target, roll, 'katana-infinite-finisher', dir, false, a.finisherHits % 2 === 0);
        }
        if (a.finisherHits >= 10 && a.finisherTimer > C.infiniteFinisherInterval * .45) {
          if (target) delete target.data.katanaSuspendedBy;
          f.applyStatus('immune', postDashImmunityFor(f), { source:f });
          d.animTime = 0;
          d.lastFrame = 1;
          d.oneSwordLockoutUntil = matchClock + 1.25;
          d.action = null;
          updateCentroid(f);
        }
      }
      return true;
    }
    return false;
  }
  function bladeWaveTouchesBlocker(w, blocker, radius=18) {
    if (!w || !blocker || !Number.isFinite(blocker.x) || !Number.isFinite(blocker.y)) return false;
    const target = { x:blocker.x, y:blocker.y, radius:Math.max(8, radius || blocker.radius || 18) };
    return bladeWaveVisualHit(w, target)
      || distToSegment(target.x, target.y, w.prevX, w.prevY, w.x, w.y) <= target.radius + Math.min(72, w.halfWidth * .55);
  }
  function blockBladeWave(w, kind, blocker) {
    w.hit = true;
    w.life = 0;
    w.held = false;
    w.brightHeld = false;
    w.brightRealUntil = 0;
    const heavy = kind === 'planet' || kind === 'rocket' || kind === 'war_machine';
    playKatanaSound(heavy ? 'waveHitHeavyObject' : 'waveHitDefendedObject', .72, .02);
    state.lastWaveBlock = { kind, at:performance.now(), x:blocker?.x ?? w.x, y:blocker?.y ?? w.y };
    spawnShockwave(blocker?.x ?? w.x, blocker?.y ?? w.y, '#ffc5e4', heavy ? 115 : 82);
    return true;
  }
  function resolveBladeWaveBlocker(w) {
    const engineer = window.APEX_ENGINEER;
    if (engineer?.allStructures && engineer?.damageStructure) {
      for (const s of engineer.allStructures()) {
        if (!s || s.owner === w.owner || s.dead || s.hp <= 0) continue;
        const radius = engineer.structureFootprint?.(s) || s.blockRadius || s.radius || 42;
        if (!bladeWaveTouchesBlocker(w, s, radius)) continue;
        engineer.damageStructure(s, w.damage, w.owner, 'structure-katana-blade-wave', 0);
        return blockBladeWave(w, s.kind === 'war_machine' ? 'war_machine' : 'construction', s);
      }
    }
    for (const shot of engineer?.shots || []) {
      if (!shot || shot.owner === w.owner || shot.life <= 0 || !['rocket','war_machine'].includes(shot.kind)) continue;
      if (!bladeWaveTouchesBlocker(w, shot, shot.radius || 18)) continue;
      shot.life = 0;
      if (engineer?.vfx) engineer.vfx.push({ type:'explosion', x:shot.x, y:shot.y, life:.42, maxLife:.42, radius:120 });
      return blockBladeWave(w, shot.kind === 'war_machine' ? 'war_machine' : 'rocket', shot);
    }
    for (const p of projectiles || []) {
      if (!p || p.owner === w.owner || p.life <= 0) continue;
      const planet = p.type === 'galaxy_planet';
      const rocket = /rocket/i.test(String(p.type || ''));
      const defendedProjectile = p.type === 'ninja_shuriken' || p.type === 'ninja_kunai';
      if (!planet && !rocket && !defendedProjectile) continue;
      if (!bladeWaveTouchesBlocker(w, p, p.radius || (planet ? 38 : 18))) continue;
      p.life = 0;
      p.customLife = 0;
      p._dead = true;
      if (planet) p.exploded = true;
      return blockBladeWave(w, planet ? 'planet' : rocket ? 'rocket' : 'defended_projectile', p);
    }
    return false;
  }
  function updateWave(w, dt) {
    if (!w || !live(w.owner)) { w.life = 0; return; }
    if (w.held) {
      w.prevX = w.x;
      w.prevY = w.y;
      if (performance.now() <= (w.heldRealUntil || 0)) return;
      w.held = false;
      w.brightHeld = false;
    }
    if (!Number.isFinite(w.life) || performance.now() - (w.createdRealAt || performance.now()) > (w.maxLife + .8) * 1000) { w.life = 0; w.hit = true; return; }
    w.life -= dt;
    w.prevX = w.x; w.prevY = w.y;
    w.x += w.dir.x * w.speed * dt;
    w.y += w.dir.y * w.speed * dt;
    if (w.owner.isRage) {
      let bounced = false;
      if (w.x < w.length * .15 || w.x > GAME_SIZE - w.length * .15) { w.dir.x *= -1; w.x = clamp(w.x, w.length*.15, GAME_SIZE-w.length*.15); bounced = true; }
      if (w.y < w.length * .15 || w.y > GAME_SIZE - w.length * .15) { w.dir.y *= -1; w.y = clamp(w.y, w.length*.15, GAME_SIZE-w.length*.15); bounced = true; }
      if (bounced) {
        w.bounces += 1;
        w.damage = Math.max(0, C.waveDamage * (1 - .1 * w.bounces));
        spawnShockwave(w.x, w.y, '#ff99c8', 70);
        if (w.damage <= 0 || w.bounces >= 10) w.life = 0;
      }
    } else if (w.x < -w.length || w.x > GAME_SIZE + w.length || w.y < -w.length || w.y > GAME_SIZE + w.length) w.life = 0;
    if (resolveBladeWaveBlocker(w)) return;
    const enemy = enemyOf(w.owner);
    const cand = enemy && !w.twinUsed ? twinCandidate(w.owner, enemy, w) : null;
    if (cand && !katanaData(w.owner).action && beginTwin(w.owner, enemy, cand, w)) return;
    if (enemy && !w.reserved && !w.hit && bladeWaveVisualHit(w, enemy)) {
      w.hit = true;
      w.life = 0;
      w.held = false;
      w.brightHeld = false;
      w.brightRealUntil = 0;
      applyKatanaDamage(w.owner, enemy, w.damage, 'katana-blade-wave', w.dir, true);
    }
  }
  function updateWaves(dt) {
    for (const w of state.waves) updateWave(w, dt);
    let write=0;for(let i=0;i<state.waves.length;i++){const w=state.waves[i];if(Number.isFinite(w.life)&&w.life>0&&!w.hit&&Number.isFinite(w.x)&&Number.isFinite(w.y))state.waves[write++]=w;}state.waves.length=write;
  }
  function updateVisuals(dt) {
    for (const fx of state.vfx) {
      fx.life -= dt;
      syncStickyFx(fx);
      if (fx.type === 'petal') {
        if (!fx.sticky) {
          fx.x += (fx.vx || 0) * dt;
          fx.y += (fx.vy || 0) * dt;
          fx.vx *= Math.pow(.16, dt);
          fx.vy = (fx.vy || 0) * Math.pow(.25, dt) + 18 * dt;
        }
        fx.rot += (fx.spin || 0) * dt;
      }
    }
    let write=0;for(let i=0;i<state.vfx.length;i++){const fx=state.vfx[i];if(fx.life>0)state.vfx[write++]=fx;}state.vfx.length=write;
  }
  function updateMoon(f, dt) {
    const d = katanaData(f);
    const c = updateCentroid(f) || (d.manual?.enabled ? visualCentroid(f) : null);
    const rewrite = d.manual?.rewrite;
    const moon = d.moon || (d.moon = {x:f.x,y:f.y});
    let tx, ty;
    if (rewrite) {
      tx = rewrite.future.x; ty = rewrite.future.y;
      moon.mode = 'rewrite';
    } else if (c) {
      tx = c.x; ty = c.y;
      moon.mode = 'centroid';
    } else {
      const side = f.dir.y >= 0 ? -1 : 1;
      tx = f.x - f.dir.x * 58 + -f.dir.y * side * 34;
      ty = f.y - f.dir.y * 58 + f.dir.x * side * 34 - 48;
      moon.mode = 'follow';
    }
    const targetKey = rewrite ? `rewrite:${rewrite.sourceId}` : c ? `centroid:${c.ids}` : 'follow';
    if (moon.targetKey !== targetKey) {
      moon.targetKey = targetKey;
      moon.gliding = true;
    }
    moon.x ??= tx;
    moon.y ??= ty;
    const dx = tx - moon.x, dy = ty - moon.y;
    const remaining = Math.hypot(dx,dy);
    const glideSpeed = moon.gliding ? 460 : 1120;
    const step = Math.min(remaining, glideSpeed * dt);
    if (remaining > .001) {
      moon.x += dx / remaining * step;
      moon.y += dy / remaining * step;
    }
    if (remaining <= 2) moon.gliding = false;
  }
  function katanaThink(f,e,dt) {
    const d = katanaData(f);
    if (isManualKatana(f)) {
      manualKatanaThink(f,e,dt,f.data.manualController);
      return;
    }
    if (katanaShouldRage(f) && !f.isRage) {
      f.isRage = true;
      f.rageStartHp = f.hp;
      d.rage = true;
      spawnShockwave(f.x,f.y,C.color,190);
    }
    const frozenAnimTime = d.animTime;
    const animationFrozen = f.hasStatus?.('stun') || f.hasStatus?.('freeze')
      || window.__apexUniversalVisualStopMotionActive?.();
    if (!animationFrozen) d.animTime += dt;
    const curFrame = frameIndex(f);
    const prevFrame = d.lastFrame || curFrame;
    if (d.awaitFaceFrame1 && prevFrame !== 1 && curFrame === 1) d.awaitFaceFrame1 = false;
    updateMoon(f, dt);
    const acted = updateAction(f, e, dt);
    if (animationFrozen) d.animTime = frozenAnimTime;
    if (!animationFrozen) {
      if (d.action?.dir) d.visualDir = {x:d.action.dir.x,y:d.action.dir.y};
      else if (e && !d.awaitFaceFrame1) {
        const face = dirTo(f,e);
        d.visualDir = {x:face.x,y:face.y};
      }
    }
    const centroid = d.centroid;
    if (e && centroid && !d.action) {
      const prev = d.lastEnemy && Number.isFinite(d.lastEnemy.x) ? d.lastEnemy : {x:e.x,y:e.y};
      const severRadius = centroid.radius + e.radius * .55;
      const insideSeverMark = dist(e.x,e.y,centroid.x,centroid.y) <= severRadius;
      if (insideSeverMark || segmentCircleHit(prev.x,prev.y,e.x,e.y,centroid.x,centroid.y,severRadius)) beginInfinite(f,e);
    }
    if (!acted && e && prevFrame !== RELEASE_FRAME && curFrame === RELEASE_FRAME && !d.action) {
      const twin = twinCandidate(f,e);
      if (twin) beginTwin(f,e,twin,null);
      else if (closingSoon(f,e)) beginOneSword(f,e);
      else { d.twinHistory = []; d.pendingTwinInfinite = false; spawnWave(f, dirTo(f,e)); }
    }
    d.lastFrame = frameIndex(f);
    if (e) d.lastEnemy = {x:e.x,y:e.y};
  }
  function drawBodyImage(ctx, img, alpha=1, scale=C.scale) {
    if (!img || !img.complete || !img.naturalWidth) {
      drawSketchBlob(ctx, 58, C.color, 13);
      return;
    }
    ctx.globalAlpha *= alpha;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, -w/2, -h/2, w, h);
  }
  function drawKatana(ctx,f) {
    const idx = frameIndex(f);
    const vd = katanaData(f).visualDir || f.dir;
    const base = Math.atan2(f.dir.y, f.dir.x);
    const face = Math.atan2(vd.y, vd.x);
    ctx.save();
    ctx.rotate(face - base + C.bodyForwardOffset);
    drawBodyImage(ctx, frameImages[idx - 1], 1, C.scale);
    ctx.restore();
  }
  function visibleInApexView(x, y, radius=180) {
    const view = window.__apexCameraView;
    if (!view || !Number.isFinite(view.worldX) || !Number.isFinite(view.worldY)) return true;
    const width = Number.isFinite(view.width) ? view.width : (canvas?.width || GAME_SIZE) / Math.max(.001, view.zoom || 1);
    const height = Number.isFinite(view.height) ? view.height : (canvas?.height || GAME_SIZE) / Math.max(.001, view.zoom || 1);
    return x + radius >= view.worldX && x - radius <= view.worldX + width
      && y + radius >= view.worldY && y - radius <= view.worldY + height;
  }
  function drawClone(ctx,c) {
    if (!visibleInApexView(c.x, c.y, 180)) return;
    ctx.save();
    ctx.translate(c.x,c.y);
    const petalImg = images.sakuraPetal;
    const orbit=c.petalOrbit||(c.petalOrbit=clonePetalOrbit(c.id));
    for (let i=0;i<3;i++) {
      const petal=orbit[i],duration=petal.duration;
      const cycle = ((matchClock + petal.phase * duration) % duration + duration) % duration / duration;
      const px = petal.baseX + petal.drift * cycle + Math.sin(cycle * TAU + petal.wavePhase) * petal.waveSize;
      const py = -72 + cycle * petal.fall;
      ctx.save();
      ctx.translate(px,py);
      ctx.rotate(petal.rotation + cycle * petal.spin);
      ctx.globalAlpha = Math.sin(cycle * Math.PI) * petal.alpha;
      if (petalImg.complete && petalImg.naturalWidth) {
        const ps = petal.scale;
        ctx.drawImage(petalImg,-petalImg.naturalWidth*ps/2,-petalImg.naturalHeight*ps/2,petalImg.naturalWidth*ps,petalImg.naturalHeight*ps);
      } else {
        ctx.fillStyle = '#ffaad3';
        ctx.beginPath();ctx.ellipse(0,0,5,2.5,0,0,TAU);ctx.fill();
      }
      ctx.restore();
    }
    ctx.rotate(Math.atan2(c.dir.y,c.dir.x) + C.bodyForwardOffset);
    const body=frameImages[c.frame-1];
    if(!drawFilteredFrame(ctx,body,'clone',.55,C.scale)){ctx.filter=FILTERED_FRAME_SPECS.clone.filter;drawBodyImage(ctx,body,.55,C.scale);}
    ctx.restore();
  }
  function drawMoon(ctx,f) {
    const d = katanaData(f), moon = d.moon;
    if (!moon) return;
    if (!visibleInApexView(moon.x, moon.y, 160)) return;
    const img = images.pinkMoon;
    ctx.save();
    ctx.translate(moon.x, moon.y);
    const pulse = moon.mode === 'centroid' ? 1 + .05 * Math.sin(matchClock * 5) : .86;
    ctx.globalAlpha = moon.mode === 'centroid' ? .86 : .64;
    ctx.filter = `drop-shadow(0 0 ${moon.mode === 'centroid' ? 18 : 8}px rgba(255,110,190,.75))`;
    const ms = C.effectScale;
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -46*pulse*ms, -48*pulse*ms, 92*pulse*ms, 96*pulse*ms);
    else { ctx.strokeStyle=C.color; ctx.lineWidth=7; ctx.beginPath(); ctx.arc(0,0,40,-1.1,1.1); ctx.stroke(); }
    ctx.restore();
  }
  function drawManualKatanaVfx(ctx,f) {
    const d=katanaData(f), m=d.manual;
    if (!m?.enabled) return;
    const drawSelectedClone = (id) => {
      if (!Number.isFinite(id)) return;
      const c=d.clones.find(q=>q.id===id&&!q.consumed&&!q.reserved);
      if (!c || !visibleInApexView(c.x, c.y, 190)) return;
      ctx.save(); ctx.globalAlpha=.34; ctx.filter='brightness(1.65) drop-shadow(0 0 16px rgba(255,220,245,.95))'; drawClone(ctx,c); ctx.restore();
    };
    drawSelectedClone(m.selectedEvadeId);
    if (m.selectedRewriteId !== m.selectedEvadeId) drawSelectedClone(m.selectedRewriteId);
    const r=m.rewrite;
    if (!r) return;
    const progress=clamp(r.timer/MANUAL.rewriteDuration,0,1);
    const img=images.pinkMoon;
    if (!visibleInApexView(r.oldCentroid.x, r.oldCentroid.y, 170)) return;
    ctx.save(); ctx.translate(r.oldCentroid.x,r.oldCentroid.y); ctx.globalAlpha=.48*progress;
    ctx.filter='drop-shadow(0 0 12px rgba(255,110,190,.65))';
    const ms=C.effectScale;
    if (img.complete&&img.naturalWidth) ctx.drawImage(img,-46*ms,-48*ms,92*ms,96*ms);
    ctx.restore();
    const ghost={id:r.sourceId,x:r.captured.x,y:r.captured.y,dir:r.captured.dir,frame:r.captured.frame};
    ctx.save(); ctx.globalAlpha=.42; ctx.filter='brightness(1.25) drop-shadow(0 0 13px rgba(255,120,190,.78))'; drawClone(ctx,ghost); ctx.restore();
  }
  function drawVfx(ctx, layer='all') {
    if (layer !== 'top') {
      for (const f of fighters || []) if (f?.name === 'KATANA') {
        const d = katanaData(f);
        drawMoon(ctx,f);
        for (const c of d.clones || []) if (!c.consumed) drawClone(ctx,c);
        drawManualKatanaVfx(ctx,f);
      }
    }
    for (const fx of state.vfx) {
      const isTop = fx.type === 'petal' || fx.type === 'slash';
      if (layer === 'top' && !isTop) continue;
      if (layer === 'under' && isTop) continue;
      if (!visibleInApexView(fx.x, fx.y, fx.type === 'afterimage' ? 150 : 100)) continue;
      const a = clamp(fx.life / Math.max(.001, fx.maxLife), 0, 1);
      ctx.save();
      ctx.globalAlpha = (fx.alpha ?? 1) * a;
      if (fx.type === 'afterimage') {
        ctx.translate(fx.x,fx.y); ctx.rotate(Math.atan2(fx.dir.y,fx.dir.x) + C.bodyForwardOffset);
        const body=frameImages[(fx.frame||1)-1],scale=fx.scale||C.scale;
        if(!drawFilteredFrame(ctx,body,'afterimage',.62*a,scale)){ctx.filter=FILTERED_FRAME_SPECS.afterimage.filter;drawBodyImage(ctx,body,.62*a,scale);}
      } else if (fx.type === 'petal') {
        const img = images.sakuraPetal;
        ctx.translate(fx.x,fx.y); ctx.rotate(fx.rot || 0);
        const s = (fx.scale || .05) * (.45 + .55 * a);
        if (img.complete && img.naturalWidth) ctx.drawImage(img, -img.naturalWidth*s/2, -img.naturalHeight*s/2, img.naturalWidth*s, img.naturalHeight*s);
      } else if (fx.type === 'slash') {
        const img = images.slashOverlay;
        ctx.translate(fx.x,fx.y); ctx.rotate(fx.angle || 0);
        ctx.globalCompositeOperation = 'lighter';
        const s = (fx.scale || .22) * (1.1 - .18*a);
        if (img.complete && img.naturalWidth) ctx.drawImage(img, -img.naturalWidth*s/2, -img.naturalHeight*s/2, img.naturalWidth*s, img.naturalHeight*s);
      }
      ctx.restore();
    }
  }
  function drawWaves(ctx) {
    for (const w of state.waves) {
      if (!w || w.hit || !(w.life > 0)) continue;
      if (!visibleInApexView(w.x, w.y, Math.max(w.length, w.halfWidth * 2))) continue;
      const img = images.bladeWave;
      const a = clamp(w.life / Math.max(.001,w.maxLife), 0, 1);
      const bright = w.brightHeld || (w.brightUntil || 0) > matchClock || (w.brightRealUntil || 0) > performance.now() ? 1 : 0;
      ctx.save();
      ctx.translate(w.x,w.y);
      ctx.rotate(Math.atan2(w.dir.y,w.dir.x) - Math.PI / 2);
      ctx.globalAlpha = Math.min(1, .42 + .45 * a + bright * .38);
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `brightness(${1 + bright * .95}) drop-shadow(0 0 ${12 + bright * 18}px rgba(255,90,180,${.35+.35*a+bright*.35}))`;
      const drawW = w.length;
      const drawH = img.complete && img.naturalWidth ? drawW * (img.naturalHeight / img.naturalWidth) : w.halfWidth * 2;
      if (img.complete && img.naturalWidth) ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
      else { ctx.fillStyle='rgba(255,95,185,.42)'; ctx.beginPath(); ctx.ellipse(0,0,drawW*.5,drawH*.5,0,0,TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  function drawRosterKatana(canvas) {
    if (!canvas) return;
    const c = canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    c.save(); c.translate(canvas.width/2, canvas.height*.57); c.rotate(-.12); c.scale(.52,.52); drawKatana(c,{data:{katana:{animTime:16/24,lastFrame:17}},dir:{x:1,y:0},x:0,y:0,radius:58}); c.restore();
  }
  const KatanaType = {
    id:'katana',
    name:'KATANA',
    color:C.color,
    desc:'Measured blade waves, clone checkpoints, moon-marked sever trap',
    speed:505,
    startDx:1,
    startDy:.72,
    init:f => initKatana(f),
    update:(f,e,dt) => {
      if (!e || katanaData(f).action) return;
    },
    speedModifier:f => {
      if (!isManualKatana(f)) return 1;
      const d=katanaData(f), m=manualState(f);
      if (d.action || m.qDash || m.rewrite) return 0;
      return Math.min(1,Math.max(0,f.data.manualController.getMoveMagnitude?.() ?? f.data.manualController.moveMagnitude?.() ?? 0));
    },
    onCollide:(f,e) => {
      katanaPerfCounter('collisionCalls');
      if (isManualKatana(f)) {
        const d = katanaData(f);
        const m = manualState(f);
        const held = f.data?.manualController?.isHeld?.('SECONDARY');
        if (!held) return false;
        if (d.action || m.qDash || m.mode === 'recovery' || (Number.isFinite(m.lastCollisionTick) && m.lastCollisionTick === state.updateFrame)) return true;
        m.lastCollisionTick = state.updateFrame;
        if (m.collisionCd <= 0 && manualCollisionOne(f,e)) {
          m.collisionCd = f.isRage ? C.rageCollisionCooldown : C.normalCollisionCooldown;
        }
        f.applyStatus?.('immune', .12, {source:f, katanaCollisionGuard:true});
        return true;
      }
      const d = katanaData(f);
      if (d.action || matchClock < (d.collisionOneReadyAt || 0)) return false;
      d.oneSwordLockoutUntil = 0;
      const postDashImmunity = postDashImmunityFor(f);
      if (!beginOneSword(f,e,{postDashImmunity})) return false;
      d.collisionOneReadyAt = matchClock + (f.isRage ? C.rageCollisionCooldown : C.normalCollisionCooldown);
      d.noCollisionUntil = Math.max(d.noCollisionUntil || 0, matchClock + C.dashDuration + postDashImmunity);
      return true;
    },
    draw:(ctx,f) => drawKatana(ctx,f)
  };
  function registerKatana() {
    const old = FighterTypes.find(ft => ft && ft.name === 'KATANA');
    if (old) Object.assign(old, KatanaType);
    else FighterTypes.push(KatanaType);
    ASSET_ONLY_FIGHTER_SFX.add('KATANA');
    window.FighterTypes = FighterTypes;
    window.apexFighterTypes = FighterTypes;
  }
  function appendKatanaCard() {
    const grid = document.getElementById('roster-grid');
    const ft = FighterTypes.find(q => q.name === 'KATANA');
    if (!grid || !ft || grid.querySelector('[data-fighter="KATANA"]')) return;
    const card = document.createElement('div');
    card.className = 'fighter-card';
    card.dataset.fighter = 'KATANA';
    card.style.color = ft.color;
    const name = document.createElement('div');
    name.className = 'f-name';
    name.textContent = 'KATANA';
    const preview = document.createElement('canvas');
    preview.className = 'f-preview';
    preview.width = 140; preview.height = 96;
    card.appendChild(name); card.appendChild(preview);
    card.onclick = () => selectFighter(ft, card);
    grid.appendChild(card);
    drawRosterKatana(preview);
  }
  function syncKatanaSelectedVfx() {
    [[1,p1Selection],[2,p2Selection]].forEach(([player,fighter]) => {
      if (fighter?.name !== 'KATANA') return;
      const image = document.getElementById(`p${player}-fighter-vfx`);
      if (!image) return;
      const slot = image.closest('.picked-fighter-slot');
      if (slot) slot.dataset.fighter = 'KATANA';
      image.src = ROOT + 'picked.webp';
      image.classList.add('has-fighter');
      image.alt = `Player ${player}: KATANA`;
    });
  }
  function updateAllKatana(dt) {
    if (gameState !== 'PLAYING') return;
    const frameStart = performance.now();
    state.updateFrame = (state.updateFrame || 0) + 1;
    for (const f of fighters || []) if (live(f) && f.name === 'KATANA') katanaThink(f, enemyOf(f), dt);
    const waveStart = performance.now();
    updateWaves(dt);
    state.perf.waveUpdateMs = performance.now() - waveStart;
    const vfxStart = performance.now();
    updateVisuals(dt);
    state.perf.vfxUpdateMs = performance.now() - vfxStart;
    refreshKatanaPerfCounters(frameStart);
  }
  function clearKatanaRuntime() {
    state.waves.length = 0;
    state.vfx.length = 0;
    state.slowToken = (state.slowToken || 0) + 1;
    state.slowActive = false;
    state.slowScale = null;
    state.slowUntil = 0;
    nextWaveId = 1;
    nextVfxId = 1;
    for (const f of fighters || []) if (f?.name === 'KATANA' && f.data?.katana?.manual) resetManualPose(f,false);
  }
  function soloEnsure(p) {
    p.data.katana ||= { clock:0, clones:[], cloneId:0, waves:[], vfx:[] };
    return p.data.katana;
  }
  function soloFireWave(st,p,rage=false) {
    const d = soloEnsure(p);
    const dmg = rage ? 8 : 4.5;
    d.waves.push({x:p.x + p.dx*28, y:p.y + p.dy*28, vx:p.dx*(rage?540:460), vy:p.dy*(rage?540:460), life:1.8, damage:dmg, hit:false});
    playKatanaSound('attack', .56, .04);
  }
  function soloAttack(st,p) {
    soloFireWave(st,p,false);
    p.cd.normal = .65;
  }
  function soloSpecial(st,p) {
    const d = soloEnsure(p), e = p.side === 1 ? st.p2 : st.p1;
    d.clones.push({x:p.x,y:p.y,id:++d.cloneId});
    if (Math.abs(e.x-p.x) < 95) {
      const dir = p.x < e.x ? 1 : -1;
      p.x = clamp(e.x + dir * 72, 30, 970);
      if (!e.dead) {
        e.hp = Math.max(0, e.hp - 18);
        if (e.hp <= 0) { e.dead = true; st.winner = p; }
      }
      playKatanaSound('directFleshHit', .55, .02);
    }
    p.cd.special = 4.8;
  }
  function soloRage(st,p) {
    const d = soloEnsure(p), e = p.side === 1 ? st.p2 : st.p1;
    if (d.clones.length >= 3 && e && !e.dead) {
      const dmg = 36;
      e.hp = Math.max(0, e.hp - dmg);
      if (e.hp <= 0) { e.dead = true; st.winner = p; }
      d.clones.splice(0,3);
      playKatanaSound('infiniteSeverStart', .62, .1);
    } else soloFireWave(st,p,true);
    p.cd.rage = 8;
  }
  function soloAdvance(st,dt) {
    for (const p of [st?.p1, st?.p2]) {
      if (!p || p.name !== 'KATANA') continue;
      const d = soloEnsure(p), e = p.side === 1 ? st.p2 : st.p1;
      d.clock = (d.clock + dt) % LOOP;
      for (const w of d.waves) {
        w.life -= dt; w.x += w.vx*dt; w.y += w.vy*dt;
        if (e && !e.dead && !w.hit && dist(w.x,w.y,e.x,e.y) <= e.radius + 28) {
          w.hit = true; w.life = 0; e.hp = Math.max(0, e.hp - w.damage); playKatanaSound('waveHitEnemy', .45, .03);
          if (e.hp <= 0) { e.dead = true; st.winner = p; }
        }
      }
      d.waves = d.waves.filter(w => w.life > 0);
    }
  }
  function drawSolo(ctx,p) {
    const d = soloEnsure(p);
    ctx.save();
    for (const c of d.clones) {
      ctx.save(); ctx.globalAlpha=.34; ctx.translate(c.x-p.x,c.y-p.y); ctx.fillStyle=C.color; ctx.beginPath(); ctx.arc(0,0,22,0,TAU); ctx.fill(); ctx.restore();
    }
    const idx = Math.floor((d.clock || 0) * FRAME_RATE) % FRAME_COUNT;
    const img = frameImages[idx];
    if (img.complete && img.naturalWidth) {
      const s=.068;
      ctx.drawImage(img, -img.naturalWidth*s/2, -img.naturalHeight*s/2, img.naturalWidth*s, img.naturalHeight*s);
    } else {
      drawSketchBlob(ctx,58,C.color,12);
    }
    ctx.restore();
  }

  preloadAudio();
  registerKatana();

  const previousGlyph = fighterGlyph;
  fighterGlyph = function(name) { return name === 'KATANA' ? 'K' : previousGlyph(name); };

  const prevPopulateKatana = populateRoster;
  populateRoster = function(...args) {
    const result = prevPopulateKatana.apply(this,args);
    appendKatanaCard();
    return result;
  };
  const prevSyncSelectedKatana = syncSelectedFighterVfx;
  syncSelectedFighterVfx = function(...args) {
    const result = prevSyncSelectedKatana.apply(this,args);
    syncKatanaSelectedVfx();
    return result;
  };
  const prevStartKatana = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts={}) {
    document.getElementById('menu-screen')?.classList.add('hidden');
    document.getElementById('select-screen')?.classList.add('hidden');
    document.getElementById('tournament-screen')?.classList.add('hidden');
    document.getElementById('end-screen')?.classList.add('hidden');
    const hud = document.getElementById('hud');
    if (hud) hud.style.opacity = 1;
    clearKatanaRuntime();
    const result = prevStartKatana(ft1, ft2, opts);
    return result;
  };
  const prevEndKatana = endMatch;
  endMatch = function(...args) {
    const result = prevEndKatana.apply(this,args);
    clearKatanaRuntime();
    return result;
  };
  const prevMenuKatana = goToMenu;
  goToMenu = function(...args) {
    clearKatanaRuntime();
    return prevMenuKatana.apply(this,args);
  };
  const prevUpdateKatana = update;
  update = function(dt) {
    if (gameState === 'PLAYING') updateAllKatana(dt);
    const result = prevUpdateKatana(dt);
    if (gameState === 'PLAYING') state.vfx.forEach(syncStickyFx);
    if (gameState === 'SOLO') soloAdvance(window.__solo375, dt);
    return result;
  };
  const prevHandleCollisionsKatana = handleCollisions;
  handleCollisions = function(dt) {
    const list = fighters || [];
    for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i], b = list[j];
      if (!a || !b || a.hp <= 0 || b.hp <= 0) continue;
      const ka = a.name === 'KATANA' ? a : b.name === 'KATANA' ? b : null;
      const other = ka === a ? b : ka === b ? a : null;
      if (!ka || !other) continue;
      const dx = other.x - ka.x, dy = other.y - ka.y;
      const gap = Math.hypot(dx, dy) || 1;
      if (gap >= ka.radius + other.radius) continue;
      katanaPerfCounter('collisionCalls');
      const d = katanaData(ka);
      const piercing = d.action || d.manualQPassThrough || (d.noCollisionUntil || 0) > matchClock;
      if (piercing) return;
      const manualHeldRmb = isManualKatana(ka) && ka.data?.manualController?.isHeld?.('SECONDARY');
      if (manualHeldRmb) {
        const m = manualState(ka);
        if (!ka.hasStatus('abilityDisabled') && m.collisionCd <= 0 && ka.type?.onCollide?.(ka, other, dt, norm(other.x-ka.x, other.y-ka.y))) return;
        const nx = dx / gap, ny = dy / gap;
        const overlapPush = Math.max(0, ka.radius + other.radius - gap) + .5;
        ka.x = clamp(ka.x - nx * overlapPush * .5, ka.radius, GAME_SIZE - ka.radius);
        ka.y = clamp(ka.y - ny * overlapPush * .5, ka.radius, GAME_SIZE - ka.radius);
        other.x = clamp(other.x + nx * overlapPush * .5, other.radius, GAME_SIZE - other.radius);
        other.y = clamp(other.y + ny * overlapPush * .5, other.radius, GAME_SIZE - other.radius);
        ka.applyStatus?.('immune', .08, {source:ka, katanaCollisionGuard:true});
        return;
      }
      if (!ka.hasStatus('abilityDisabled') && ka.type?.onCollide?.(ka, other, dt, norm(other.x-ka.x, other.y-ka.y))) return;
    }
    return prevHandleCollisionsKatana(dt);
  };
  const prevDrawProjectilesKatana = drawProjectiles;
  drawProjectiles = function(ctx) {
    drawVfx(ctx, 'under');
    const result = prevDrawProjectilesKatana(ctx);
    drawWaves(ctx);
    return result;
  };
  const previousTopLayerDrawKatana = window.__apexTopLayerDraw;
  window.__apexTopLayerDraw = function(ctx) {
    if (typeof previousTopLayerDrawKatana === 'function') previousTopLayerDrawKatana(ctx);
    state.topLayerDrawCount = (state.topLayerDrawCount || 0) + 1;
    drawVfx(ctx, 'top');
  };
  const prevDamageKatana = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false) {
    if (this.name === 'KATANA' && source && source !== this && !statusDamage && Number.isFinite(amount) && amount > 0) {
      const d = katanaData(this);
      if ((d.invulnUntil || 0) > matchClock) return;
      const key = `${source.id ?? source.name ?? 'src'}:${label || 'direct'}`;
      d.hitHistory = (d.hitHistory || []).filter(h => matchClock - h.t <= C.evadeWindow && h.key === key);
      const total = d.hitHistory.reduce((s,h) => s + h.amount, 0) + amount;
      if (!d.manual?.enabled && total > C.evadeThreshold && oldestAvailableClones(d).length >= 4 && beginEvade(this, source)) {
        d.hitHistory = [];
        return;
      }
      d.hitHistory.push({t:matchClock, amount, key});
    }
    const before = this.hp;
    const result = prevDamageKatana.call(this, amount, source, label, statusDamage);
    if (this.name === 'KATANA' && katanaShouldRage(this) && !this.isRage) {
      this.isRage = true;
      this.rageStartHp = this.hp;
      katanaData(this).rage = true;
      spawnShockwave(this.x,this.y,C.color,190);
    }
    return result;
  };

  const manualApi = {
    constants:MANUAL,
    reset(f) { if (f?.name === 'KATANA') resetManualPose(f,false); },
    hudState(f) {
      if (!f?.data?.katana?.manual) return null;
      const d=katanaData(f), m=d.manual;
      return {
        mode:m.mode, frame:frameIndex(f), lmbCooldown:m.lmbCooldown || 0, qCooldown:m.qCooldown, qWindow:m.qWindowRemaining,
        qCastId:m.qCastId, eCooldown:m.eCooldown || 0, eReady:oldestAvailableClones(d).length>3, selectedEvadeId:m.selectedEvadeId,
        selectedRewriteId:m.selectedRewriteId, rCooldown:m.rCooldown,
        rewriteRemaining:m.rCharge?.timer || m.rewrite?.timer || 0, collisionCd:m.collisionCd || 0, feedback:m.feedbackUntil>matchClock?m.feedback:''
      };
    },
    createCloneForTest:createClone,
    updateCentroid,
    cloneUnderPoint,
    beginRewrite,
    manualEvade,
    acceptQ:acceptManualQ
  };
  window.APEX_KATANA = { constants:C, manualApi, images, frameImages, audioFiles, state, KatanaType, frameIndex, getKatanaTwoSwordCandidate, spawnSlashEffect:spawnSlash, warmVisualAssets:warmKatanaVisualAssets, _debugBladeWaveVisualHit:bladeWaveVisualHit, selfTest:() => ({
    registered:FighterTypes.filter(ft => ft.name === 'KATANA').length,
    frames:frameImages.length,
    releaseFrame:RELEASE_FRAME,
    pickButton:images.pickButton.src,
    picked:images.picked.src,
    visualWarmupReady:!!state.visualWarmup?.ready
  }), soloAttack, soloSpecial, soloRage, soloAdvance, drawSolo };
  Object.assign(window.apexReactBridge || {}, { startSpecificMatch, goToMenu });
  Object.assign(window, window.apexReactBridge || {}, { APEX_KATANA:window.APEX_KATANA, startSpecificMatch, goToMenu });
  scheduleKatanaVisualWarmup();
  if (document.getElementById('roster-grid')) appendKatanaCard();
  console.info('[Apex Chaos] KATANA champion integrated', window.APEX_KATANA.selfTest());
})();
