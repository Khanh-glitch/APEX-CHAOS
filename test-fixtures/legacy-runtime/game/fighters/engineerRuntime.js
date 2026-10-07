// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_ENGINEER_CHAMPION_PATCH(){
  if (window.__apexEngineerChampionPatch) return;
  window.__apexEngineerChampionPatch = true;

  const ROOT = '/assets/engineer_v1/';
  const FILES = {
    main: 'main visual.webp',
    turretBase: 'đế chung cho cả turret và rocket.webp',
    turretHead: 'Turret 2.webp',
    turretBullet: 'turret bulllet.webp',
    mine: 'mine.webp',
    mineLv2: 'mine lv2.webp',
    repair: 'repair station.webp',
    repairLv2: 'healing nexus.webp',
    factory: 'factory lv1.webp',
    factoryLv1: 'factory lv1.webp',
    megaFactory: 'mega factory.webp',
    rocketBase: 'đế chung cho cả turret và rocket.webp',
    rocketReady: 'thân trên trục xoay rocket.webp',
    rocketReload: 'thân súng trên trục xoay rocket nhưng đang reload.webp',
    rocketBullet: 'rocket bullet.webp',
    explosion: 'explosion.webp',
    warMachine: 'war machine.webp',
    warBase: 'đế war machine.webp',
    warGun: 'thân súng war machine.webp',
    warBullet: 'war machine bullet.webp',
    scrap: 'linh kiện.webp',
    scrap1: 'Component 1.webp',
    scrap2: 'Component 2.webp',
    scrap3: 'Component 3.webp',
    scrap4: 'Component 4.webp',
    scrap5: 'Component 5.webp',
    collectFx: 'thu linh kiện về.webp',
    magnetBeam: 'tia từ hút linh kiện và các vật thể hợp nhất.webp',
    scrapNew: 'ada66438-125e-46d9-b5d0-33c9ff21226c.webp',
    magnetBeamWide: '04ed9a99-f6e8-48d6-84d1-9bb40950ed81.webp',
    collectFxNew: 'magnetic.webp',
    magnetLineNew: 'magnetic line.webp',
    shieldNexus: 'SHIELD of nexus healing.webp',
    shieldRage: 'SHIELD of RAGE.webp',
    warLaser: 'war machine laser strip.webp',
    warPilot: 'war machine fushion with ENGINEER.webp',
    upgradeRing0: 'upgrade circle in 0%.webp',
    upgradeRing100: 'upgrade circle in 100%.webp',
    buildRing0: 'vòng tròn loading xây dựng 0%.webp',
    buildRing100: 'vòng tròn loading xây dựng 100%.webp'
  };
  const images = {};
  function src(file) { return ROOT + encodeURIComponent(file).replace(/%20/g, '%20'); }
  function load(key, file) {
    const img = new Image();
    img.onload = () => { img.ready = true; };
    img.onerror = () => { img.failed = true; console.warn('[ENGINEER] asset failed', file); };
    img.src = src(file);
    images[key] = img;
  }
  for (const [key, file] of Object.entries(FILES)) load(key, file);
  const AUDIO_ROOT = ROOT + 'audio/';
  const AUDIO_FILES = {
    buildStart:'build_Construction_sound.mp3',
    buildDone:'building_completed_sound.mp3',
    destroyed:'construction_destroyed.mp3',
    mergeStart:'lv_up_or_fushion_on_processing.mp3',
    mergeDone:'lv_up_and_fushion_completed_sound.mp3',
    warMerge:'WARMACHINE_FUSHION_WITH_ENGINEER_sfx.mp3',
    turretFire:'turret_firing.mp3',
    rocketFire:'rocket_fire.mp3',
    mineLand:'mine_landing.mp3',
    explosion:'mine_and_rocket_explosion.mp3',
    warLaser:'war_machine_normal_and_fushion_fire.mp3'
  };
  const engineerAudio = {};
  const engineerAudioPools = {};
  const engineerAudioCd = {};
  for (const [key, file] of Object.entries(AUDIO_FILES)) {
    try {
      const audio = new Audio(AUDIO_ROOT + encodeURIComponent(file).replace(/%20/g, '%20'));
      audio.preload = 'auto';
      registerBattleMediaElement(audio);
      engineerAudio[key] = audio;
      engineerAudioPools[key] = [audio];
    } catch (error) {}
  }
  function playEngineerAudio(key, volume = .55, rate = 1, cooldown = .05) {
    if (window.__apexStatsSilent) return null;
    const base = engineerAudio[key];
    if (!base) return null;
    const now = performance.now() / 1000;
    if ((engineerAudioCd[key] || 0) > now) return null;
    engineerAudioCd[key] = now + cooldown;
    try {
      ensureBattleAudioReady?.();
      const pool = engineerAudioPools[key] || (engineerAudioPools[key] = [base]);
      let snd = pool.find(item => item.paused || item.ended);
      if (!snd && pool.length < 5) {
        snd = base.cloneNode(true);
        snd.preload = 'auto';
        registerBattleMediaElement(snd);
        pool.push(snd);
      }
      if (!snd) return null;
      snd.loop = false;
      snd.currentTime = 0;
      snd.volume = clamp(volume, 0, 1);
      snd.playbackRate = clamp(rate, .65, 1.45);
      const p = snd.play();
      if (p?.catch) p.catch(() => {});
      return snd;
    } catch (error) {
      return null;
    }
  }
  function setStructureLoop(s, key, active, volume = .28) {
    if (!s) return;
    s.audioLoops ||= {};
    let audio = s.audioLoops[key];
    if (!active) {
      if (audio) {
        try { audio.pause(); audio.currentTime = 0; } catch (error) {}
      }
      return;
    }
    if (!audio) {
      const base = engineerAudio[key];
      if (!base) return;
      audio = base.cloneNode(true);
      audio.loop = true;
      audio.preload = 'auto';
      registerBattleMediaElement(audio);
      s.audioLoops[key] = audio;
    }
    try {
      audio.volume = volume;
      if (audio.paused) {
        ensureBattleAudioReady?.();
        const p = audio.play();
        if (p?.catch) p.catch(() => {});
      }
    } catch (error) {}
  }
  function stopStructureLoops(s) {
    for (const audio of Object.values(s?.audioLoops || {})) {
      try { audio.pause(); audio.currentTime = 0; } catch (error) {}
    }
  }
  function ready(key) {
    const img = images[key];
    return !!(img && img.complete && img.naturalWidth > 0 && !img.failed);
  }
  function drawAsset(ctx, key, x, y, size, rot = 0, alpha = 1) {
    const img = images[key];
    if (!ready(key)) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= alpha;
    const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
    const w = size;
    const h = size * ratio;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }
  function drawAssetSquare(ctx, key, x, y, size, rot = 0, alpha = 1) {
    const img = images[key];
    if (!ready(key)) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  function drawAssetRect(ctx, key, x, y, w, h, rot = 0, alpha = 1) {
    const img = images[key];
    if (!ready(key)) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }
  function tintedAssetMask(key, color = [49, 245, 255]) {
    const img = images[key];
    if (!ready(key) || !img) return null;
    const cacheKey = `${key}:${color.join(',')}`;
    engineerState.tintMasks ||= {};
    if (engineerState.tintMasks[cacheKey]) return engineerState.tintMasks[cacheKey];
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, w, h);
    let data;
    try {
      data = octx.getImageData(0, 0, w, h);
    } catch (error) {
      return null;
    }
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3] / 255;
      const brightness = Math.max(px[i], px[i + 1], px[i + 2]);
      const mask = brightness <= 10 ? 0 : clamp((brightness - 10) / 150, 0, 1) * a;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = Math.round(255 * mask);
    }
    octx.putImageData(data, 0, 0);
    engineerState.tintMasks[cacheKey] = off;
    return off;
  }
  function drawAssetSquareTintMask(ctx, key, x, y, size, rot = 0, alpha = 1, color = [49, 245, 255]) {
    const mask = tintedAssetMask(key, color);
    if (!mask) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(mask, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  function whenEngineerImageReady(key) {
    const img = images[key];
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
  function warmEngineerDrawImage(ctx, key, size = 72) {
    const img = images[key];
    if (!ctx || !img?.naturalWidth) return false;
    const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
    const w = Math.max(1, Math.min(size, img.naturalWidth));
    const h = Math.max(1, Math.min(size * ratio, img.naturalHeight));
    ctx.save();
    ctx.globalAlpha = .001;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
    return true;
  }
  function warmEngineerVisualAssets() {
    if (engineerState.visualWarmup?.started) return engineerState.visualWarmup.promise;
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(128, 128)
      : Object.assign(document.createElement('canvas'), {width:128, height:128});
    const warmCtx = canvas.getContext?.('2d');
    const hotKeys = ['main', 'shieldNexus', 'shieldRage', 'turret', 'mine', 'repair', 'factory', 'warMachine', 'warPilot'];
    engineerState.visualWarmup = {
      started:true,
      ready:false,
      promise:Promise.all(hotKeys.map(whenEngineerImageReady)).then(() => {
        for (const key of hotKeys) warmEngineerDrawImage(warmCtx, key, key === 'main' ? 96 : 72);
        keyedAsset('shieldNexus');
        keyedAsset('shieldRage');
        engineerState.visualWarmup.ready = true;
        engineerState.visualWarmup.finishedAt = performance.now();
        return true;
      }).catch(error => {
        engineerState.visualWarmup.error = String(error?.message || error);
        return false;
      })
    };
    return engineerState.visualWarmup.promise;
  }
  function keyedAsset(key, threshold = 54, options = {}) {
    const img = images[key];
    if (!ready(key) || !img) return null;
    engineerState.keyedAssets ||= {};
    const bgMax = options.bgMax ?? threshold;
    const bgSpread = options.bgSpread ?? 18;
    const cacheKey = `${key}:${threshold}:${bgMax}:${bgSpread}`;
    if (engineerState.keyedAssets[cacheKey]) return engineerState.keyedAssets[cacheKey];
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, w, h);
    let data;
    try {
      data = octx.getImageData(0, 0, w, h);
    } catch (error) {
      return null;
    }
    const px = data.data;
    const seen = new Uint8Array(w * h);
    const queue = [];
    const isBackground = idx => {
      const p = idx * 4;
      if (px[p + 3] <= 4) return true;
      const max = Math.max(px[p], px[p + 1], px[p + 2]);
      const min = Math.min(px[p], px[p + 1], px[p + 2]);
      return max <= threshold && max <= bgMax && max - min <= bgSpread;
    };
    const push = (x, y) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      const idx = y * w + x;
      if (seen[idx] || !isBackground(idx)) return;
      seen[idx] = 1;
      queue.push(idx);
    };
    for (let x = 0; x < w; x += 1) { push(x, 0); push(x, h - 1); }
    for (let y = 1; y < h - 1; y += 1) { push(0, y); push(w - 1, y); }
    for (let qi = 0; qi < queue.length; qi += 1) {
      const idx = queue[qi];
      const x = idx % w;
      const y = (idx - x) / w;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    for (let idx = 0; idx < seen.length; idx += 1) {
      if (!seen[idx]) continue;
      px[idx * 4 + 3] = 0;
    }
    octx.putImageData(data, 0, 0);
    engineerState.keyedAssets[cacheKey] = off;
    return off;
  }
  function drawAssetSquareKeyed(ctx, key, x, y, size, rot = 0, alpha = 1) {
    const keyed = key === 'warPilot'
      ? keyedAsset(key, 24, { bgMax:32, bgSpread:10 })
      : (key === 'shieldRage' || key === 'shieldNexus')
        ? keyedAsset(key, 88, { bgMax:110, bgSpread:110 })
      : keyedAsset(key);
    if (!keyed) return drawAssetSquare(ctx, key, x, y, size, rot, alpha);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(keyed, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }

  const BASE = {
    mine: { label:'Mine', cost:2, build:0, hp:95, underHp:55, radius:38, baseScore:25 },
    turret: { label:'Turret', cost:3, build:1.4, hp:130, underHp:80, radius:48, baseScore:30 },
    repair: { label:'Repair Station', cost:4, build:1.8, hp:165, underHp:88, radius:52, baseScore:20 },
    factory: { label:'Factory', cost:5, build:2.4, hp:210, underHp:110, radius:58, baseScore:24 }
  };
  const UPGRADED = {
    heavy_turret: { label:'Heavy Turret Rocket', hp:300, radius:68 },
    minefield_core: { label:'Minefield Core', hp:180, radius:62 },
    healing_nexus: { label:'Healing Nexus', hp:320, radius:72 },
    mega_factory: { label:'Mega Factory', hp:360, radius:78 },
    war_machine: { label:'War Machine', hp:500, radius:88 }
  };
  const BUILD_TIME_MULT = 3;
  const STRUCTURE_HP_MULT = .375;
  const STRUCTURE_OUTPUT_MULT = .5;
  const STRUCTURE_VISUAL_SCALE = 1.12;
  const engineerState = window.APEX_ENGINEER = window.APEX_ENGINEER || {
    scraps: [],
    shots: [],
    lasers: [],
    vfx: [],
    nextId: 1
  };
  engineerState.warmVisualAssets = warmEngineerVisualAssets;
  const buildKinds = ['turret', 'mine', 'repair', 'factory'];
  const kindOrder = { turret:0, mine:1, repair:2, factory:3 };
  const recipeResult = {
    turret: 'heavy_turret',
    mine: 'minefield_core',
    repair: 'healing_nexus',
    factory: 'mega_factory'
  };

  function live(f) { return f && f.hp > 0; }
  function ownerData(f) {
    f.data.engineer ||= {
      scrap: 3,
      plan: 'turret',
      planSince: matchClock,
      planScores: {},
      constructionPulse: 0,
      commitPulse: 0,
      openingPending: true,
      salvageCd: 0,
      lowScrapTimer: 0,
      structures: [],
      mergeIds: {},
      buildTimeBonus: 0,
      lastScrap: 3
    };
    return f.data.engineer;
  }
  function enemyOf(f) { return (fighters || []).find(q => q && q !== f && q.hp > 0 && !q.data?.galaxyRemoved) || null; }
  function allEngineerStructures() {
    const out = [];
    for (const f of fighters || []) {
      if (f && f.name === 'ENGINEER') out.push(...(ownerData(f).structures || []).filter(s => s && s.hp > 0 && !s.dead));
    }
    return out;
  }
  function onlineStructures(d, kind) {
    return (d.structures || []).filter(s => s.kind === kind && s.state === 'online' && s.hp > 0 && !s.disabled && !s.dead);
  }
  function missingScrap(f, kind) { return Math.max(0, (BASE[kind]?.cost || 99) - ownerData(f).scrap); }
  function currentConstruction(d) {
    return (d.structures || []).find(s => s.state === 'building' && s.hp > 0 && !s.dead);
  }
  function originalCost(kind) {
    return BASE[kind]?.cost || (kind === 'heavy_turret' ? 9 : kind === 'minefield_core' ? 6 : kind === 'healing_nexus' ? 12 : kind === 'mega_factory' ? 15 : 0);
  }
  function mineLike(s) {
    return s && (s.kind === 'mine' || s.kind === 'small_mine');
  }
  function structureHp(value) { return Math.max(1, Math.round((value || 1) * STRUCTURE_HP_MULT)); }
  function structureOutput(value) { return (value || 0) * STRUCTURE_OUTPUT_MULT; }
  function visualLevelMult(kind) {
    if (kind === 'war_machine') return 1.5;
    if (kind === 'heavy_turret' || kind === 'minefield_core' || kind === 'healing_nexus' || kind === 'mega_factory') return 1.3;
    return 1;
  }
  function visualRadiusForKind(kind, radius) {
    const r = radius || BASE[kind]?.radius || UPGRADED[kind]?.radius || 50;
    return r * STRUCTURE_VISUAL_SCALE * visualLevelMult(kind);
  }
  function visualFootprintForKind(kind, radius) {
    return Math.max(30, visualRadiusForKind(kind, radius) * 1.08);
  }
  function structureVisualFootprint(s) {
    return visualFootprintForKind(s?.kind, s?.radius);
  }
  function footprintForKind(kind, radius) {
    const visualRadius = radius || BASE[kind]?.radius || UPGRADED[kind]?.radius || 50;
    const scale = kind === 'mine' || kind === 'small_mine' ? .38
      : kind === 'war_machine' ? .54
      : kind === 'heavy_turret' || kind === 'mega_factory' || kind === 'healing_nexus' ? .46
      : .44;
    return Math.max(kind === 'small_mine' ? 12 : 18, visualRadius * scale);
  }
  function structureFootprint(s) {
    return s?.blockRadius || footprintForKind(s?.kind, s?.radius);
  }
  function refundFor(kind) {
    const cost = originalCost(kind);
    if (cost <= 0) return 0;
    return Math.max(cost >= 2 ? 1 : 0, Math.round(cost * 0.35));
  }
  function nextScrapVariant() {
    if (!Number.isFinite(engineerState.scrapVariantCursor)) engineerState.scrapVariantCursor = Math.floor(rand(0, 5));
    engineerState.scrapVariantCursor = (engineerState.scrapVariantCursor + 1) % 5;
    return engineerState.scrapVariantCursor;
  }
  function addScrapDrop(x, y, amount, owner, options = {}) {
    const n = Math.max(0, Math.round(amount));
    for (let i = 0; i < n; i++) {
      const a = options.avoidTop ? rand(Math.PI * .08, Math.PI * .92) : rand(0, TAU);
      const r = rand(28, 86) + i * 3;
      const variant = nextScrapVariant();
      engineerState.scraps.push({
        x: clamp(x + Math.cos(a) * r, 22, GAME_SIZE - 22),
        y: clamp(y + Math.sin(a) * r, 22, GAME_SIZE - 22),
        vx: Math.cos(a) * rand(85, 190) + rand(-28, 28),
        vy: Math.sin(a) * rand(85, 190) + rand(-28, 28),
        amount: 1,
        owner,
        variant,
        assetKey: `scrap${variant + 1}`,
        spin: rand(-2.8, 2.8),
        angle: rand(0, TAU),
        scale: rand(.88, 1.18),
        life: 22,
        maxLife: 22
      });
    }
  }
  function grantScrap(f, amount, x = f.x, y = f.y) {
    const d = ownerData(f);
    d.scrap = Math.max(0, Math.round((d.scrap || 0) + amount));
    d.lastScrap = d.scrap;
    if (amount > 0) {
      engineerState.vfx.push({ type:'spark', x, y, life:.45, maxLife:.45, color:'#31f5ff' });
    }
  }
  function formatStructureNumber(amount) {
    if (amount >= 10) return amount.toFixed(0);
    if (amount >= 1) return amount.toFixed(1);
    return amount.toFixed(2);
  }
  function queueStructureNumber(s, amount, color, kind = 'damage', interval = 0) {
    if (!s || !Number.isFinite(amount) || amount <= 0) return;
    const key = kind === 'heal' ? 'healText' : 'damageText';
    s[key] ||= { amount:0, timer:0, color };
    s[key].amount += amount;
    s[key].timer = Math.max(s[key].timer || 0, interval);
    s[key].color = color;
    if (interval <= 0) flushStructureNumber(s, key, kind === 'heal' ? '+' : '-', .08, kind === 'heal' ? 21 : 22, kind === 'heal' ? -42 : -48);
  }
  function flushStructureNumber(s, key, prefix, minAmount, size, vy) {
    const q = s && s[key];
    if (!q || q.amount < minAmount) return;
    const txt = new FloatingText(s.x, s.y - structureVisualFootprint(s) * .55, `${prefix}${formatStructureNumber(q.amount)}`, q.color);
    txt.size = size;
    txt.life = txt.maxLife = .78;
    txt.vy = vy;
    floatingTexts.push(txt);
    q.amount = 0;
    q.timer = 0;
  }
  function updateStructureNumberText(s, dt) {
    if (!s) return;
    for (const [key, prefix, minAmount, size, vy] of [
      ['damageText', '-', .08, 22, -48],
      ['healText', '+', .08, 21, -42]
    ]) {
      const q = s[key];
      if (!q) continue;
      q.timer = Math.max(0, (q.timer || 0) - dt);
      if (q.timer <= 0) flushStructureNumber(s, key, prefix, minAmount, size, vy);
    }
  }
  function healStructure(s, amount, displayInterval = 0) {
    if (!s || s.dead || s.hp <= 0 || amount <= 0) return 0;
    const before = s.hp;
    s.hp = Math.min(s.maxHp, s.hp + amount);
    const healed = Math.max(0, s.hp - before);
    if (healed > 0) queueStructureNumber(s, healed, '#174fd8', 'heal', displayInterval);
    if (healed > 0 && s.kind === 'war_machine' && s.pilotedBy) updateHUD(true);
    return healed;
  }
  function repairHealFighter(target, amount, displayInterval = 0) {
    if (!target || target.hp <= 0 || amount <= 0) return 0;
    amount *= getVirusStats(target).healMult;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = Math.max(0, target.hp - before);
    if (healed > 0) {
      target.healingDone += healed;
      target.data ||= {};
      target.data.engineerRepairHealText ||= { amount:0, timer:0 };
      target.data.engineerRepairHealText.amount += healed;
      target.data.engineerRepairHealText.timer = Math.max(target.data.engineerRepairHealText.timer || 0, displayInterval);
      updateHUD();
    }
    return healed;
  }
  function engineerVirtualShield(f) {
    f.data ||= {};
    f.data.engineerVirtualShield ||= { amount:0, max:0, timer:0 };
    return f.data.engineerVirtualShield;
  }
  function grantEngineerVirtualShield(f, amount, duration = 5, source = 'nexus') {
    if (!f || f.name !== 'ENGINEER' || amount <= 0) return 0;
    const shield = engineerVirtualShield(f);
    const before = shield.amount || 0;
    shield.amount = Math.max(before, amount);
    shield.max = Math.max(shield.max || 0, shield.amount);
    shield.timer = duration;
    shield.source = source;
    shield.pulse = .75;
    f.data.engineerShieldPulse = .55;
    const gained = Math.max(0, shield.amount - before);
    if (gained > 0) {
      updateHUD(true);
    }
    return gained;
  }
  function updateEngineerVirtualShield(f, dt) {
    const shield = f?.data?.engineerVirtualShield;
    if (!shield || shield.amount <= 0) return;
    shield.timer = Math.max(0, (shield.timer || 0) - dt);
    shield.pulse = Math.max(0, (shield.pulse || 0) - dt);
    if (shield.timer > 0) return;
    shield.amount = 0;
    shield.max = 0;
    shield.source = null;
    updateHUD(true);
  }
  function absorbEngineerVirtualShield(f, amount) {
    const shield = f?.data?.engineerVirtualShield;
    if (!shield || shield.amount <= 0 || amount <= 0) return amount;
    const block = Math.min(shield.amount, amount);
    shield.amount -= block;
    shield.pulse = .35;
    f.data.engineerShieldPulse = .4;
    if (shield.amount <= 0) {
      shield.amount = 0;
      shield.max = 0;
      shield.timer = 0;
      shield.source = null;
    }
    updateHUD(true);
    return Math.max(0, amount - block);
  }
  function updateEngineerRepairHealText(f, dt) {
    const q = f?.data?.engineerRepairHealText;
    if (!q) return;
    q.timer = Math.max(0, (q.timer || 0) - dt);
    if (q.timer <= 0 && q.amount >= .08) {
      const txt = new FloatingText(f.x, f.y - f.radius - 12, `+${formatStructureNumber(q.amount)}`, '#167f4a');
      txt.size = 24;
      txt.life = txt.maxLife = .78;
      txt.vy = -52;
      floatingTexts.push(txt);
      q.amount = 0;
    }
  }
  function applyEngineerRageShield(f, reason = 'rage') {
    if (!f || f.name !== 'ENGINEER') return;
    const d = ownerData(f);
    const amount = Math.max(1, (f.maxHp - f.hp) * .5);
    if (!(amount > 0)) return;
    for (const s of d.structures || []) {
      if (!s || s.dead || s.hp <= 0) continue;
      grantStructureShield(s, amount, 'rage');
    }
    const bucket = Math.floor((f.maxHp - f.hp) / Math.max(1, f.maxHp * .1));
    d.rageShieldBucket = Math.max(d.rageShieldBucket ?? -1, bucket);
    const txt = new FloatingText(f.x, f.y - f.radius - 92, `STRUCTURE SHIELD ${formatStructureNumber(amount)}`, '#8ffcff');
    txt.size = 21;
    floatingTexts.push(txt);
  }
  function grantStructureShield(s, amount, source = 'nexus') {
    if (!s || s.dead || s.hp <= 0 || amount <= 0) return 0;
    const before = s.shield || 0;
    s.shield = Math.max(before, amount);
    s.maxShield = Math.max(s.maxShield || 0, s.shield);
    s.shieldSource = source;
    s.shieldPulse = .7;
    s.shieldTimer = 10;
    return Math.max(0, s.shield - before);
  }
  function pilotedWarMachineFor(f) {
    const d = f?.name === 'ENGINEER' ? ownerData(f) : null;
    if (!d?.pilotingWarMachine) return null;
    return (d.structures || []).find(s => s.id === d.pilotWarMachineId && s.kind === 'war_machine' && !s.dead && s.hp > 0) || null;
  }
  function directedTargetForEngineerWarMachine(enemy) {
    const wm = pilotedWarMachineFor(enemy);
    if (!wm) return enemy;
    return {
      __engineerWarMachinePilotProxy:true,
      realFighter:enemy,
      id:enemy.id,
      name:enemy.name,
      color:enemy.color,
      type:enemy.type,
      data:enemy.data,
      get x(){ return wm.x; },
      set x(value){ if (Number.isFinite(value)) wm.x = clamp(value, structureFootprint(wm), GAME_SIZE - structureFootprint(wm)); },
      get y(){ return wm.y; },
      set y(value){ if (Number.isFinite(value)) wm.y = clamp(value, structureFootprint(wm), GAME_SIZE - structureFootprint(wm)); },
      get radius(){ return structureFootprint(wm); },
      get hp(){ return Math.max(1, wm.hp); },
      get maxHp(){ return Math.max(1, wm.maxHp); },
      setDir(x, y) {
        const n = norm(x, y);
        enemy.setDir?.(n.x, n.y);
        wm.dir = n;
      },
      takeDamage(amount, source = null, label = 'war-machine-pilot-target', statusDamage = false) {
        damageStructure(wm, amount, source, label || 'war-machine-pilot-target', statusDamage ? .5 : 0);
        return 0;
      },
      applyStatus(kind, duration, payload = {}) {
        if (kind === 'freeze') applyStructureFreeze(wm, duration, payload.source || null);
      },
      hasStatus(){ return false; },
      hardCC(){ return false; },
      speedMult(){ return 1; },
    };
  }
  function damageStructure(s, amount, source, label = 'structure-hit', displayInterval = 0) {
    if (!s || s.dead || s.hp <= 0 || amount <= 0) return;
    if (mineLike(s) && s.state === 'online') {
      explodeMine(s, s.kind === 'small_mine');
      return;
    }
    let remaining = amount;
    if ((s.shield || 0) > 0) {
      s.maxShield = Math.max(s.maxShield || 0, s.shield);
      const block = Math.min(s.shield, remaining);
      s.shield -= block;
      remaining -= block;
      s.shieldPulse = .22;
      if (s.kind === 'war_machine' && s.pilotedBy) updateHUD(true);
      if (s.shield <= 0) {
        s.shield = 0;
        s.maxShield = 0;
        s.shieldSource = null;
        s.shieldTimer = 0;
      }
    }
    if (remaining <= 0) return;
    s.hp -= remaining;
    s.hitFlash = .18;
    queueStructureNumber(s, remaining, '#ff9b35', 'damage', displayInterval);
    if (s.kind === 'war_machine' && s.pilotedBy) updateHUD(true);
    if (source && source !== s.owner) {
      source.damageDone = (source.damageDone || 0) + remaining * .35;
      source.damageLabels ||= {};
      source.damageLabels[label] = (source.damageLabels[label] || 0) + remaining * .35;
    }
    if (s.hp <= 0) {
      flushStructureNumber(s, 'damageText', '-', .08, 22, -48);
      destroyStructure(s, source);
    }
  }
  function applyStructureFreeze(s, duration, source) {
    if (!s || s.dead || mineLike(s) || duration <= 0) return;
    s.freezeTimer = Math.max(s.freezeTimer || 0, duration);
    s.statuses ||= {};
    s.statuses.freeze = { timer:s.freezeTimer, source };
    s.visual ||= {};
    s.visual.iceFrozen ||= { active:true, start:performance.now()/1000, end:-999, sourceId:source?.id ?? null };
    s.visual.iceFrozen.active = true;
    s.visual.iceFrozen.start = performance.now()/1000;
    s.visual.iceFrozen.sourceId = source?.id ?? null;
    s.disabledByIce = true;
    s.disabled = true;
    s.hitFlash = .18;
    if (source && source !== s.owner) {
      source.damageLabels ||= {};
      source.damageLabels['structure-freeze'] = (source.damageLabels['structure-freeze'] || 0) + .1;
    }
  }
  function updateStructureFreeze(s, dt) {
    if (!s) return;
    if ((s.freezeTimer || 0) > 0) {
      s.freezeTimer = Math.max(0, s.freezeTimer - dt);
      s.statuses ||= {};
      s.statuses.freeze ||= { timer:s.freezeTimer, source:null };
      s.statuses.freeze.timer = s.freezeTimer;
      s.disabled = true;
      s.disabledByIce = true;
    } else if (s.disabledByIce) {
      if (s.statuses) delete s.statuses.freeze;
      if (s.visual?.iceFrozen) {
        s.visual.iceFrozen.active = false;
        s.visual.iceFrozen.end = performance.now()/1000;
      }
      s.disabledByIce = false;
      s.disabled = false;
    }
  }
  function structureSplashFromFighterHit(target, source, amount, label, statusDamage) {
    return;
  }
  function destroyStructure(s, source) {
    if (!s || s.dead) return;
    if (s.state === 'merging') cancelMerge(s.owner, s.mergeId, s);
    const pilot = s.kind === 'war_machine' ? s.pilotedBy : null;
    stopStructureLoops(s);
    s.dead = true;
    playEngineerAudio('destroyed', .58, 1, .08);
    addScrapDrop(s.x, s.y, refundFor(s.kind), s.owner);
    engineerState.vfx.push({ type:'explosion', x:s.x, y:s.y, life:.62, maxLife:.62, radius:s.radius * 2.2 });
    emitParticles(s.x, s.y, '#d68b24', 18, 320, 5, .5, 'square');
    if (pilot) exitEngineerWarMachine(pilot, s);
  }
  function validPlacement(f, kind, x, y) {
    const e = enemyOf(f);
    const visualRadius = BASE[kind]?.radius || 50;
    const radius = footprintForKind(kind, visualRadius);
    const visualPad = visualFootprintForKind(kind, visualRadius);
    if (x < visualPad + 12 || x > GAME_SIZE - visualPad - 12 || y < visualPad + 12 || y > GAME_SIZE - visualPad - 12) return false;
    if (e && kind !== 'mine' && dist(x, y, e.x, e.y) < e.radius + radius + 36) return false;
    if (e && kind === 'mine' && dist(x, y, e.x, e.y) < e.radius + radius + 8) return false;
    for (const s of ownerData(f).structures || []) {
      if (!s.dead && s.hp > 0 && dist(x, y, s.x, s.y) < visualPad + structureVisualFootprint(s) + 10) return false;
    }
    return true;
  }
  function damagedStructuresForRepair(f) {
    const d = ownerData(f);
    return (d.structures || [])
      .filter(s => s.hp > 0 && !s.dead && s.kind !== 'repair' && s.kind !== 'healing_nexus' && s.hp < s.maxHp * .82)
      .sort((a,b) => a.hp / a.maxHp - b.hp / b.maxHp);
  }
  function repairPlacementScore(f, p) {
    if (!p) return -999;
    const damaged = damagedStructuresForRepair(f);
    if (!damaged.length) return 0;
    let score = 0;
    for (const s of damaged) {
      const ratio = clamp(s.hp / Math.max(1, s.maxHp), 0, 1);
      const need = 1 - ratio;
      const d = dist(p.x, p.y, s.x, s.y);
      if (d <= 300) score += 70 * need + (300 - d) * .12;
      else score -= Math.min(50, (d - 300) * .08) * need;
    }
    return score;
  }
  function structureDamageRatio(s) {
    return clamp(1 - (s.hp / Math.max(1, s.maxHp)), 0, 1);
  }
  function repairDemand(f) {
    const d = ownerData(f);
    const candidates = (d.structures || []).filter(s => s && s.hp > 0 && !s.dead && s.kind !== 'repair' && s.kind !== 'healing_nexus');
    const ratios = candidates.map(structureDamageRatio);
    const serious = ratios.filter(r => r >= .34).length;
    const critical = ratios.filter(r => r >= .62).length;
    const light = ratios.filter(r => r >= .18).length;
    const pressure = ratios.reduce((sum, r) => sum + Math.max(0, r - .16), 0);
    return { light, serious, critical, pressure, worst:ratios.length ? Math.max(...ratios) : 0 };
  }
  function repairAnchorPoint(f) {
    const damaged = damagedStructuresForRepair(f);
    if (!damaged.length) return null;
    let wx = 0, wy = 0, wt = 0;
    for (const s of damaged.slice(0, 4)) {
      const w = clamp(1 - s.hp / Math.max(1, s.maxHp), .12, 1.2);
      wx += s.x * w; wy += s.y * w; wt += w;
    }
    return wt > 0 ? { x:wx / wt, y:wy / wt } : null;
  }
  function findPlacement(f, kind) {
    const e = enemyOf(f);
    const away = e ? norm(f.x - e.x, f.y - e.y) : norm(f.dir.x, f.dir.y);
    const toward = e ? norm(e.x - f.x, e.y - f.y) : norm(f.dir.x, f.dir.y);
    const perp = { x:-away.y, y:away.x };
    const candidates = [];
    if (kind === 'mine' && e) {
      for (const t of [.38, .52, .66]) candidates.push({ x:lerp(f.x, e.x, t) + perp.x * rand(-55, 55), y:lerp(f.y, e.y, t) + perp.y * rand(-55, 55) });
      for (const s of ownerData(f).structures || []) if (s.hp > 0 && !s.dead) candidates.push({ x:s.x + toward.x * 78 + rand(-35, 35), y:s.y + toward.y * 78 + rand(-35, 35) });
    } else if (kind === 'factory') {
      for (let i = 0; i < 8; i++) candidates.push({ x:f.x + away.x * rand(95, 210) + perp.x * rand(-150, 150), y:f.y + away.y * rand(95, 210) + perp.y * rand(-150, 150) });
    } else if (kind === 'repair') {
      const damaged = damagedStructuresForRepair(f);
      const anchor = repairAnchorPoint(f);
      if (anchor) {
        for (let i = 0; i < 8; i++) candidates.push({ x:anchor.x + rand(-95, 95), y:anchor.y + rand(-95, 95) });
      }
      for (const s of damaged.slice(0, 3)) candidates.push({ x:s.x + rand(-90, 90), y:s.y + rand(-90, 90) });
      candidates.push({ x:f.x + away.x * 84 + perp.x * rand(-80, 80), y:f.y + away.y * 84 + perp.y * rand(-80, 80) });
    } else {
      for (let i = 0; i < 8; i++) candidates.push({ x:f.x + away.x * rand(60, 135) + perp.x * rand(-145, 145), y:f.y + away.y * rand(60, 135) + perp.y * rand(-145, 145) });
    }
    for (let i = 0; i < 12; i++) candidates.push({ x:f.x + rand(-240, 240), y:f.y + rand(-240, 240) });
    let best = null, bestScore = -Infinity;
    for (const c of candidates) {
      const x = clamp(c.x, 70, GAME_SIZE - 70);
      const y = clamp(c.y, 70, GAME_SIZE - 70);
      if (!validPlacement(f, kind, x, y)) continue;
      const p = { x, y };
      if (kind !== 'repair') return p;
      const score = repairPlacementScore(f, p);
      if (score > bestScore) { best = p; bestScore = score; }
    }
    return best;
  }
  function placementQuality(f, kind) {
    const p = findPlacement(f, kind);
    if (!p) return -80;
    const e = enemyOf(f);
    if (!e) return 5;
    const d = dist(p.x, p.y, e.x, e.y);
    if (kind === 'factory') return d > 360 ? 18 : d > 260 ? 0 : -40;
    if (kind === 'mine') return d < 260 ? 25 : -5;
    if (kind === 'turret') return d > 190 && d < 430 ? 18 : 0;
    if (kind === 'repair') return 4 + clamp(repairPlacementScore(f, p) * .28, -25, 34);
    return 0;
  }
  function scoreBuild(f, kind) {
    const d = ownerData(f);
    const e = enemyOf(f);
    let score = BASE[kind].baseScore;
    const ed = e ? dist(f.x, f.y, e.x, e.y) : 999;
    const close = ed < 245;
    const far = ed > 520;
    const lowHp = f.hp < f.maxHp * .35;
    const damaged = (d.structures || []).filter(s => s.hp > 0 && s.hp < s.maxHp * .6 && !s.dead);
    const demand = repairDemand(f);
    const enemyFast = e && (e.baseSpeed || 0) > 500;
    const scrapLow = d.scrap < 4;
    const scrapAbundant = d.scrap >= 6;
    const scrapOverflow = d.scrap >= 12;
    const repairOnline = onlineStructures(d, 'repair').length + onlineStructures(d, 'healing_nexus').length;
    const factoryOnline = onlineStructures(d, 'factory').length + onlineStructures(d, 'mega_factory').length;
    const offensiveBuilding = (d.structures || []).some(s => s.hp > 0 && !s.dead && s.state === 'building' && (s.kind === 'turret' || s.kind === 'mine'));
    const sameKindOnline = onlineStructures(d, kind).length;
    const nearUpgrade = sameKindOnline >= 2;
    const needsMegaFactoryForWarMachine = onlineStructures(d, 'heavy_turret').length > 0
      && onlineStructures(d, 'healing_nexus').length > 0
      && onlineStructures(d, 'mega_factory').length === 0
      && onlineStructures(d, 'war_machine').length === 0;
    const nearWarMachine = needsMegaFactoryForWarMachine;
    const offensiveOnline = onlineStructures(d, 'turret').length + onlineStructures(d, 'heavy_turret').length + onlineStructures(d, 'mine').length + onlineStructures(d, 'minefield_core').length + onlineStructures(d, 'war_machine').length;
    const hasDamageSource = offensiveOnline > 0 || offensiveBuilding;
    const criticalRepair = damaged.some(s => s.hp < s.maxHp * .28) || f.hp < f.maxHp * .25;
    const tier2Counts = {
      turret: onlineStructures(d, 'heavy_turret').length,
      mine: onlineStructures(d, 'minefield_core').length,
      repair: onlineStructures(d, 'healing_nexus').length,
      factory: onlineStructures(d, 'mega_factory').length
    };
    const baseCounts = {
      turret: onlineStructures(d, 'turret').length,
      mine: onlineStructures(d, 'mine').length,
      repair: onlineStructures(d, 'repair').length,
      factory: onlineStructures(d, 'factory').length
    };
    const totalOnline = (d.structures || []).filter(s => s.hp > 0 && !s.dead && s.state === 'online').length;
    const warMachineMature = !onlineStructures(d, 'war_machine').length && (d.scrap >= 9 || totalOnline >= 7 || Object.values(tier2Counts).reduce((a,b)=>a+b,0) >= 2);
    const warNeeds = {
      turret: tier2Counts.turret <= 0,
      repair: tier2Counts.repair <= 0,
      factory: tier2Counts.factory <= 0
    };
    const pendingMerge = pendingMergeInfo(d);
    if (close) score += { turret:-5, mine:45, repair:15, factory:-35 }[kind] || 0;
    if (far) score += { turret:15, mine:-20, repair:-5, factory:20 }[kind] || 0;
    if (enemyFast) score += { turret:-5, mine:15, repair:0, factory:-5 }[kind] || 0;
    if (lowHp) score += { turret:-5, mine:25, repair:45, factory:-40 }[kind] || 0;
    if (damaged.length >= 2) score += { turret:-5, mine:5, repair:55, factory:-20 }[kind] || 0;
    if (damaged.length >= 1 && repairOnline <= 0) score += { repair:80, factory:-35, turret:-10, mine:-10 }[kind] || 0;
    if (damaged.some(s => s.hp < s.maxHp * .35)) score += { repair:75, factory:-45, turret:-8, mine:-8 }[kind] || 0;
    if (scrapLow) score += { turret:8, mine:5, repair:-10, factory:10 }[kind] || 0;
    if (scrapAbundant) score += { turret:10, mine:10, repair:10, factory:20 }[kind] || 0;
    if (scrapOverflow && kind === 'factory' && !nearUpgrade && !nearWarMachine) score -= 85;
    if (scrapOverflow && kind === 'repair' && damaged.length > 0) score += 35;
    if (warMachineMature) {
      if (warNeeds[kind]) score += 105 + baseCounts[kind] * 38;
      if (!warNeeds[kind] && baseCounts[kind] >= 3) score -= 55;
      if (kind === 'mine' && tier2Counts.mine > 0) score -= 45;
      if (kind === 'factory' && tier2Counts.factory > 0 && d.scrap >= 12) score -= 70;
      if (kind === 'repair' && tier2Counts.repair <= 0 && repairOnline < 3) score += 45;
    }
    if (repairOnline >= 2 && demand.serious <= 0 && demand.worst < .34 && f.hp > f.maxHp * .34) {
      if (kind === 'repair') score -= 145;
      if (kind === 'factory') score += needsMegaFactoryForWarMachine ? 120 : 30;
      if (kind === 'turret' || kind === 'mine') score += 18;
    }
    if (needsMegaFactoryForWarMachine) {
      if (kind === 'factory') score += 170;
      if (kind === 'repair' && demand.critical <= 0 && f.hp > f.maxHp * .25) score -= 125;
    }
    if (kind === 'repair' && repairOnline >= 3 && demand.critical <= 0) score -= 110;
    if (kind === 'repair' && demand.light <= 1 && f.hp > f.maxHp * .55) score -= 55;
    if (kind === 'repair' && demand.critical > 0) score += 95;
    if (pendingMerge && pendingMerge.missing > 0 && (pendingMerge.missing <= 18 || pendingMerge.resultKind === 'war_machine')) {
      score -= 45;
      if (kind === pendingMerge.kind) score -= 120;
      if (kind === 'factory' && pendingMerge.resultKind !== 'mega_factory') score -= 45;
      if (kind === 'repair' && criticalRepair) score += 70;
      if ((kind === 'turret' || kind === 'mine') && !hasDamageSource) score += 70;
    }
    if (kind === 'factory' && offensiveOnline <= 0) score -= 70;
    if (kind === 'factory' && factoryOnline >= 2 && !nearUpgrade && !nearWarMachine) score -= 60;
    if ((kind === 'turret' || kind === 'mine') && offensiveOnline <= 0) score += 35;
    if (!hasDamageSource && !criticalRepair) {
      if (kind === 'factory') score -= 120;
      if (kind === 'repair') score -= 65;
      if (kind === 'turret' || kind === 'mine') score += 85;
    }
    if (!hasDamageSource && criticalRepair && kind === 'factory') score -= 95;

    const online = onlineStructures(d, kind).length;
    if (online >= 2) score += 100;
    else if (online === 1) score += 35;
    if (online >= 4) score -= 25;
    if (kind === 'mine' && online >= 5) score -= 30;
    if (kind === 'repair' && online >= 1 && damaged.length === 0 && f.hp > f.maxHp * .78) score -= 30;
    if (kind === 'factory' && online >= 1 && onlineStructures(d, 'turret').length + onlineStructures(d, 'mine').length < 2) score -= 20;
    score += placementQuality(f, kind);
    score += rand(-5, 5);
    return score;
  }
  function chooseWeighted(top) {
    const min = Math.min(...top.map(x => x.score));
    const weights = top.map(x => Math.max(1, x.score - min + 8));
    let roll = Math.random() * weights.reduce((a,b)=>a+b,0);
    for (let i = 0; i < top.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return top[i].kind;
    }
    return top[0].kind;
  }
  function updateBuildPlan(f) {
    const d = ownerData(f);
    const scores = buildKinds.map(kind => ({ kind, score:scoreBuild(f, kind) })).sort((a,b)=>b.score-a.score || kindOrder[a.kind]-kindOrder[b.kind]);
    d.planScores = Object.fromEntries(scores.map(s => [s.kind, Math.round(s.score)]));
    const current = d.plan && scores.findIndex(s => s.kind === d.plan);
    const currentScore = scores.find(s => s.kind === d.plan)?.score ?? -Infinity;
    const top = scores[0], second = scores[1];
    const held = matchClock - (d.planSince || matchClock);
    const stillTop2 = current === 0 || current === 1;
    const missing = d.plan ? missingScrap(f, d.plan) : 99;
    const validSoon = d.plan ? placementQuality(f, d.plan) > -55 : false;
    const emergency = enemyOf(f) && dist(f.x, f.y, enemyOf(f).x, enemyOf(f).y) < 190 && top.kind !== d.plan && top.score > currentScore + 20;
    if (d.plan && stillTop2 && missing <= 2 && validSoon && held <= 4 && !emergency) return;
    if (!d.plan || top.score >= currentScore + 35 || held > 4 || !validSoon) {
      d.plan = top.score >= second.score + 40 ? top.kind : chooseWeighted(scores.slice(0, 3));
      d.planSince = matchClock;
    }
  }
  function shouldWaitForBetterRepairSpot(f, pos) {
    const d = ownerData(f);
    if (!pos || d.plan !== 'repair') return false;
    const damaged = damagedStructuresForRepair(f);
    if (!damaged.length) return false;
    const currentScore = repairPlacementScore(f, pos);
    const anchor = repairAnchorPoint(f);
    if (!anchor) return false;
    const worst = damaged[0];
    const urgent = worst && worst.hp < worst.maxHp * .28;
    const holdStarted = d.repairHoldSince || matchClock;
    d.repairHoldSince = holdStarted;
    if (urgent || matchClock - holdStarted > 2.8 || currentScore >= 34) return false;
    const toAnchor = norm(anchor.x - f.x, anchor.y - f.y);
    f.setDir(toAnchor.x, toAnchor.y);
    d.repairHoldTarget = anchor;
    d.repairHolding = .35;
    return dist(f.x, f.y, anchor.x, anchor.y) > 95;
  }
  function beginConstructionAt(f, kind, pos, opening = false) {
    const d = ownerData(f);
    const spec = BASE[kind];
    if (!spec || !pos) return false;
    d.scrap -= spec.cost;
    const bonus = Math.min(.8, d.buildTimeBonus || 0);
    d.buildTimeBonus = Math.max(0, (d.buildTimeBonus || 0) - bonus);
    const instantMine = kind === 'mine';
    const buildTime = instantMine ? 0 : Math.max(.35, spec.build * BUILD_TIME_MULT - bonus);
    const s = {
      id: engineerState.nextId++,
      owner:f,
      kind,
      state:instantMine ? 'online' : 'building',
      x:pos.x,
      y:pos.y,
      radius:spec.radius,
      blockRadius:footprintForKind(kind, spec.radius),
      cost:spec.cost,
      buildTime,
      progress:instantMine ? 1 : 0,
      hp:structureHp(instantMine ? spec.hp : spec.underHp),
      maxHp:structureHp(instantMine ? spec.hp : spec.underHp),
      onlineHp:structureHp(spec.hp),
      createdAt:matchClock,
      onlineAt:instantMine ? matchClock : 0,
      fireCd: kind === 'turret' ? .2 : 0,
      spawnCd:0,
      prodTick:0,
      healTick:0,
      pulse:0,
      opening,
      armed:instantMine ? false : undefined,
      armDelay:instantMine ? 1 : undefined
    };
    d.structures.push(s);
    engineerState.vfx.push({ type:'blueprint', x:s.x, y:s.y, life:Math.max(.12, buildTime), maxLife:Math.max(.12, buildTime), radius:s.radius + 18 });
    playEngineerAudio('buildStart', .46, 1, .12);
    recordSkill(f);
    return true;
  }
  function commitBuild(f, kind, opening = false) {
    const d = ownerData(f);
    const spec = BASE[kind];
    if (!spec) return false;
    if (d.scrap < spec.cost || currentConstruction(d) || f.hardCC()) return false;
    if (!opening) {
      const reserve = shouldReserveScrapForMerge(f, kind, spec.cost);
      if (reserve) {
        d.plan = null;
        d.planSince = matchClock;
        d.mergeSavingFor = reserve.resultKind;
        d.mergeSavingMissing = reserve.missing;
        return false;
      }
    }
    const pos = findPlacement(f, kind);
    if (!pos) return false;
    if (kind === 'repair' && !opening && shouldWaitForBetterRepairSpot(f, pos)) return false;
    d.repairHoldSince = 0;
    d.repairHolding = 0;
    return beginConstructionAt(f, kind, pos, opening);
  }
  function useSalvagePulse(f) {
    const d = ownerData(f);
    if (d.salvageCd > 0) return false;
    const nearby = engineerState.scraps.some(s => s.life > 0 && dist(s.x, s.y, f.x, f.y) < 360);
    if (!nearby) return false;
    d.salvageCd = 10;
    d.salvagePulse = 1;
    d.salvageLock = 1;
    engineerState.vfx.push({ type:'salvage', x:f.x, y:f.y, owner:f, life:1, maxLife:1, radius:300 });
    return true;
  }
  function manualPlacementStatus(f, kind, x, y, buildRange = 100) {
    const d = f ? ownerData(f) : null;
    const spec = BASE[kind];
    const distance = f && Number.isFinite(x) && Number.isFinite(y) ? dist(f.x, f.y, x, y) : Infinity;
    const result = { valid:false, reason:'INVALID', kind, cost:spec?.cost ?? 0, scrap:d?.scrap ?? 0, distance, range:buildRange };
    if (!f || f.name !== 'ENGINEER' || !live(f) || !spec) return result;
    if (d.pilotingWarMachine) return { ...result, reason:'PILOTING WAR MACHINE' };
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ...result, reason:'AIM OUTSIDE ARENA' };
    if (distance > buildRange + .0001) return { ...result, reason:`OUT OF RANGE (${Math.ceil(distance)}/${buildRange})` };
    if (d.scrap < spec.cost) return { ...result, reason:`NEED ${spec.cost - d.scrap} SCRAP` };
    if (currentConstruction(d)) return { ...result, reason:'CONSTRUCTION ACTIVE' };
    if (f.hardCC() || f.hasStatus?.('abilityDisabled')) return { ...result, reason:'ENGINEER DISABLED' };
    if (!validPlacement(f, kind, x, y)) return { ...result, reason:'PLACEMENT BLOCKED' };
    return { ...result, valid:true, reason:'READY' };
  }
  function commitManualBuild(f, kind, x, y) {
    const status = manualPlacementStatus(f, kind, x, y, 100);
    if (!status.valid) return status;
    const built = beginConstructionAt(f, kind, { x, y }, false);
    return { ...status, valid:built, committed:built, reason:built ? 'BUILD STARTED' : 'BUILD FAILED' };
  }
  function setManualMagnetRequested(f, requested) {
    if (!f || f.name !== 'ENGINEER') return false;
    const d = ownerData(f);
    if (!requested) {
      d.salvagePulse = 0;
      d.salvageLock = 0;
      return false;
    }
    if (d.pilotingWarMachine || f.hardCC() || f.hasStatus?.('abilityDisabled')) return false;
    if ((d.salvagePulse || 0) > 0) return true;
    return useSalvagePulse(f);
  }
  function availableWarMachines(f) {
    const d = ownerData(f);
    return (d.structures || [])
      .filter(s => s && s.kind === 'war_machine' && s.state === 'online' && !s.dead && s.hp > 0)
      .sort((a,b)=>b.hp-a.hp);
  }
  function enterEngineerWarMachine(f, wm) {
    if (!f || !wm) return false;
    const d = ownerData(f);
    d.pilotingWarMachine = true;
    d.pilotWarMachineId = wm.id;
    d.salvagePulse = 0;
    d.salvageLock = 0;
    d.plan = null;
    f.hp = Math.max(1, Math.min(Number.isFinite(f.hp) ? f.hp : (f.maxHp || 1), f.maxHp || (Number.isFinite(f.hp) ? f.hp : 1) || 1));
    wm.pilotedBy = f;
    wm.pilotPulse = .9;
    engineerState.vfx.push({ type:'pilot', x:wm.x, y:wm.y, life:.9, maxLife:.9, radius:structureVisualFootprint(wm) + 36 });
    updateHUD(true);
    return true;
  }
  function exitEngineerWarMachine(f, destroyedMachine) {
    if (!f) return;
    const d = ownerData(f);
    const next = availableWarMachines(f).find(s => s !== destroyedMachine);
    if (next) {
      enterEngineerWarMachine(f, next);
      return;
    }
    d.pilotingWarMachine = false;
    d.pilotWarMachineId = null;
    f.hp = Math.max(1, Math.min(Number.isFinite(f.hp) ? f.hp : (f.maxHp || 1), f.maxHp || (Number.isFinite(f.hp) ? f.hp : 1) || 1));
    if (destroyedMachine) {
      const away = enemyOf(f) ? norm(destroyedMachine.x - enemyOf(f).x, destroyedMachine.y - enemyOf(f).y) : norm(f.dir?.x || 1, f.dir?.y || 0);
      f.x = clamp(destroyedMachine.x + away.x * 82, f.radius, GAME_SIZE - f.radius);
      f.y = clamp(destroyedMachine.y + away.y * 82, f.radius, GAME_SIZE - f.radius);
    }
    engineerState.vfx.push({ type:'pilotExit', x:f.x, y:f.y, life:.55, maxLife:.55, radius:f.radius * 3.2 });
    updateHUD(true);
  }
  function tryEngineerPilotWarMachine(f) {
    if (!f || f.name !== 'ENGINEER') return false;
    const d = ownerData(f);
    if (d.pilotingWarMachine) return true;
    const wm = availableWarMachines(f)[0];
    return !!wm && enterEngineerWarMachine(f, wm);
  }
  engineerState.tryPilotWarMachine = tryEngineerPilotWarMachine;
  function manualMergeCandidate(f, x, y) {
    if (!f || f.name !== 'ENGINEER' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    const d = ownerData(f);
    if ((d.mergeBlockUntil || 0) > matchClock || Object.keys(d.mergeIds || {}).length || d.pilotingWarMachine) return null;
    for (const kind of buildKinds) {
      const ingredients = onlineStructures(d, kind).sort((a,b)=>a.onlineAt-b.onlineAt).slice(0, 3);
      if (ingredients.length !== 3) continue;
      const hovered = ingredients.find(s => dist(x, y, s.x, s.y) <= structureVisualFootprint(s));
      if (hovered) return { kind, resultKind:recipeResult[kind], ingredients, hovered };
    }
    return null;
  }
  function requestManualMerge(f, x, y) {
    const candidate = manualMergeCandidate(f, x, y);
    if (!candidate) return false;
    return startMerge(f, candidate.ingredients, candidate.resultKind);
  }
  function requestManualAutoMerge(f) {
    if (!f || f.name !== 'ENGINEER') return { valid:false, committed:false, reason:'ENGINEER REQUIRED' };
    const d = ownerData(f);
    if ((d.mergeBlockUntil || 0) > matchClock || Object.keys(d.mergeIds || {}).length || d.pilotingWarMachine) {
      return { valid:false, committed:false, reason:'MERGE BUSY' };
    }
    const candidate = pendingMergeInfo(d);
    if (!candidate) return { valid:false, committed:false, reason:'NO MERGE SET' };
    const ok = startMerge(f, candidate.ingredients, candidate.resultKind, {x:f.x, y:f.y});
    return { ...candidate, valid:ok, committed:ok, reason:ok ? `AUTO MERGE ${candidate.resultKind.toUpperCase()}` : 'AUTO MERGE FAILED' };
  }
  function manualWarMachineStatus(f) {
    if (!f || f.name !== 'ENGINEER') return { valid:false, reason:'ENGINEER REQUIRED' };
    const d = ownerData(f);
    if (d.pilotingWarMachine) return { valid:false, reason:'ALREADY PILOTING' };
    if (Object.keys(d.mergeIds || {}).length) return { valid:false, reason:'MERGE ACTIVE' };
    const existing = availableWarMachines(f)[0];
    if (existing) return { valid:true, action:'PILOT', machine:existing, reason:'WAR MACHINE READY' };
    const ingredients = [onlineStructures(d, 'heavy_turret')[0], onlineStructures(d, 'healing_nexus')[0], onlineStructures(d, 'mega_factory')[0]];
    if (ingredients.every(Boolean)) return { valid:true, action:'ASSEMBLE', ingredients, reason:'ASSEMBLY READY' };
    return { valid:false, reason:'NEED HEAVY TURRET + HEALING NEXUS + MEGA FACTORY' };
  }
  function requestManualWarMachine(f) {
    if (f?.name === 'ENGINEER' && ownerData(f).pilotingWarMachine) {
      const d = ownerData(f);
      const wm = (d.structures || []).find(s => s.id === d.pilotWarMachineId && s.kind === 'war_machine');
      if (wm) {
        wm.pilotedBy = null;
        wm.pilotPulse = .45;
        f.x = clamp(wm.x, f.radius, GAME_SIZE - f.radius);
        f.y = clamp(wm.y, f.radius, GAME_SIZE - f.radius);
      }
      d.pilotingWarMachine = false;
      d.pilotWarMachineId = null;
      engineerState.vfx.push({ type:'pilotExit', x:f.x, y:f.y, life:.55, maxLife:.55, radius:f.radius * 3.2 });
      updateHUD(true);
      return { valid:true, committed:true, action:'EJECT', reason:'WAR MACHINE EJECTED' };
    }
    const status = manualWarMachineStatus(f);
    if (!status.valid) return status;
    const ok = status.action === 'PILOT'
      ? enterEngineerWarMachine(f, status.machine)
      : startMerge(f, status.ingredients, 'war_machine');
    return { ...status, valid:ok, committed:ok, reason:ok ? (status.action === 'PILOT' ? 'PILOT LINKED' : 'WAR MACHINE ASSEMBLY STARTED') : 'WAR MACHINE REQUEST FAILED' };
  }
  function updatePilotedWarMachineMovement(f, wm, e, dt) {
    if (!f || !wm) return;
    const canMove = !!e;
    wm.armed = !!canMove;
    wm.mobileArmed = !!canMove;
    if (!canMove) return;
    const pressure = f.data?.galaxyPressure;
    if (pressure?.ownerId === e.id) {
      wm.dir = norm(pressure.vx || f.dir?.x || 1, pressure.vy || f.dir?.y || 0);
      f.setDir(wm.dir.x, wm.dir.y);
      return;
    }
    if (e.data?.galaxyPressureArmed && !(e.data?.galaxyPressureWindow > 0) && !e.data?.galaxyPressureContactDone) {
      const r = structureFootprint(wm);
      const touchRange = (e.radius || 0) + r + 6;
      if (dist(e.x, e.y, wm.x, wm.y) <= touchRange) {
        const proxy = directedTargetForEngineerWarMachine(f);
        const n = norm(wm.x - e.x, wm.y - e.y);
        if (proxy && proxy !== f && e.type?.onCollide?.(e, proxy, dt, { x:n.x, y:n.y })) {
          wm.dir = n;
          f.setDir(n.x, n.y);
          return;
        }
      }
    }
    const d = dist(wm.x, wm.y, e.x, e.y);
    let desired = f.dir || norm(1, 0);
    if (d > 520) desired = norm(e.x - wm.x, e.y - wm.y);
    else if (d < 280) desired = norm(wm.x - e.x, wm.y - e.y);
    let move = Math.abs(desired.x) >= Math.abs(desired.y)
      ? { x: desired.x >= 0 ? 1 : -1, y: 0 }
      : { x: 0, y: desired.y >= 0 ? 1 : -1 };
    const speed = (f.baseSpeed || engineerType.speed || 405) * .5;
    const r = structureFootprint(wm);
    const nx = wm.x + move.x * speed * dt;
    const ny = wm.y + move.y * speed * dt;
    const clampedX = clamp(nx, r, GAME_SIZE - r);
    const clampedY = clamp(ny, r, GAME_SIZE - r);
    if (clampedX !== nx) move.x *= -1;
    if (clampedY !== ny) move.y *= -1;
    const before = { x:wm.x, y:wm.y };
    wm.x = clampedX;
    wm.y = clampedY;
    const controlWalls = window.APEX_CONTROL_BATTLE_WALLS;
    if (controlWalls?.active?.()) {
      const blocked = controlWalls.isBlocked?.(wm.x, wm.y, r)
        || controlWalls.segmentIntersectsWall?.(before, {x:wm.x,y:wm.y}, Math.min(42, r * .45));
      if (blocked) {
        wm.x = before.x;
        wm.y = before.y;
        move.x *= -1;
        move.y *= -1;
      }
    }
    f.setDir(move.x, move.y);
  }
  function updateEngineerFighter(f, e, dt) {
    const manualController = f.data?.manualController;
    if (manualController?.active && manualController.mode === 'MANUAL_LAB') {
      return updateManualEngineerFighter(f, e, dt, manualController);
    }
    const d = ownerData(f);
    updateEngineerRepairHealText(f, dt);
    updateEngineerVirtualShield(f, dt);
    if (d.pilotingWarMachine) {
      const wm = (d.structures || []).find(s => s.id === d.pilotWarMachineId && s.kind === 'war_machine' && !s.dead && s.hp > 0);
      if (wm) {
        updatePilotedWarMachineMovement(f, wm, e, dt);
        f.hp = Math.max(1, f.hp);
        f.x = wm.x;
        f.y = wm.y;
        d.salvagePulse = 0;
        d.salvageLock = 0;
        d.openingPending = false;
        return;
      }
      exitEngineerWarMachine(f, null);
    }
    d.salvageLock = Math.max(0, (d.salvageLock || 0) - dt);
    if (f.isRage) {
      const bucket = Math.floor((f.maxHp - f.hp) / Math.max(1, f.maxHp * .1));
      if (bucket > (d.rageShieldBucket ?? -1)) applyEngineerRageShield(f, 'hp_threshold');
    }
    if ((d.scrap || 0) < 3) {
      d.lowScrapTimer = (d.lowScrapTimer || 0) + dt;
      if (d.lowScrapTimer >= 10) {
        d.lowScrapTimer = 0;
        grantScrap(f, 5, f.x, f.y);
        engineerState.vfx.push({ type:'restock', x:f.x, y:f.y, life:.7, maxLife:.7, radius:180 });
      }
    } else {
      d.lowScrapTimer = 0;
    }
    d.salvageCd = Math.max(0, d.salvageCd - dt);
    d.salvagePulse = Math.max(0, (d.salvagePulse || 0) - dt);
    if (d.openingPending) {
      d.plan = 'turret';
      if (commitBuild(f, 'turret', true)) {
        d.openingPending = false;
        d.planSince = matchClock;
      }
    }
    d.constructionPulse -= dt;
    if (d.constructionPulse <= 0) {
      d.constructionPulse += .75;
      updateBuildPlan(f);
    }
    d.commitPulse -= dt;
    if (d.commitPulse <= 0) {
      d.commitPulse += 1.4;
      if (d.plan && !commitBuild(f, d.plan, false) && !(d.plan === 'repair' && (d.repairHolding || 0) > 0)) useSalvagePulse(f);
    }
    d.repairHolding = Math.max(0, (d.repairHolding || 0) - dt);
  }
  function updateManualEngineerFighter(f, e, dt, controller) {
    const d = ownerData(f);
    updateEngineerRepairHealText(f, dt);
    updateEngineerVirtualShield(f, dt);
    if (d.pilotingWarMachine) {
      const wm = (d.structures || []).find(s => s.id === d.pilotWarMachineId && s.kind === 'war_machine' && !s.dead && s.hp > 0);
      if (wm) {
        controller.updateWarMachine?.(f, wm, e, dt, engineerState.manualApi);
        f.hp = Math.max(1, f.hp);
        f.x = wm.x;
        f.y = wm.y;
        f.data.positionLocked = true;
        d.salvagePulse = 0;
        d.salvageLock = 0;
        d.openingPending = false;
        return;
      }
      exitEngineerWarMachine(f, null);
    }
    d.salvageLock = Math.max(0, (d.salvageLock || 0) - dt);
    if (f.isRage) {
      const bucket = Math.floor((f.maxHp - f.hp) / Math.max(1, f.maxHp * .1));
      if (bucket > (d.rageShieldBucket ?? -1)) applyEngineerRageShield(f, 'hp_threshold');
    }
    if ((d.scrap || 0) < 3) {
      d.lowScrapTimer = (d.lowScrapTimer || 0) + dt;
      if (d.lowScrapTimer >= 10) {
        d.lowScrapTimer = 0;
        grantScrap(f, 5, f.x, f.y);
        engineerState.vfx.push({ type:'restock', x:f.x, y:f.y, life:.7, maxLife:.7, radius:180 });
      }
    } else d.lowScrapTimer = 0;
    d.salvageCd = Math.max(0, d.salvageCd - dt);
    d.salvagePulse = Math.max(0, (d.salvagePulse || 0) - dt);
    d.openingPending = false;
    controller.updateEngineer?.(f, e, dt, engineerState.manualApi);
  }
  function createStructure(kind, owner, x, y) {
    const spec = UPGRADED[kind] || BASE[kind];
    if (!spec) return null;
    const s = {
      id: engineerState.nextId++,
      owner,
      kind,
      state:'online',
      x:clamp(x, 44, GAME_SIZE - 44),
      y:clamp(y, 44, GAME_SIZE - 44),
      radius:spec.radius,
      blockRadius:footprintForKind(kind, spec.radius),
      cost:originalCost(kind),
      hp:structureHp(spec.hp),
      maxHp:structureHp(spec.hp),
      createdAt:matchClock,
      onlineAt:matchClock,
      fireCd:.6,
      spawnCd:kind === 'minefield_core' ? 1.5 : 0,
      prodTick:0,
      healTick:0,
      shieldCd:5,
      megaTicks:0
    };
    ownerData(owner).structures.push(s);
    engineerState.vfx.push({ type:'assembly', x:s.x, y:s.y, life:.7, maxLife:.7, radius:s.radius * 2 });
    playEngineerAudio(kind === 'war_machine' ? 'mergeDone' : 'buildDone', kind === 'war_machine' ? .66 : .48, 1, .1);
    spawnShockwave(s.x, s.y, kind === 'war_machine' ? '#ff3030' : '#31f5ff', kind === 'war_machine' ? 310 : 190);
    return s;
  }
  function validMergePlacement(owner, ingredients, resultKind, x, y) {
    const spec = UPGRADED[resultKind] || BASE[resultKind];
    const visualPad = visualFootprintForKind(resultKind, spec?.radius || 70);
    if (x < visualPad + 12 || x > GAME_SIZE - visualPad - 12 || y < visualPad + 12 || y > GAME_SIZE - visualPad - 12) return false;
    const ingredientIds = new Set((ingredients || []).map(s => s.id));
    for (const s of ownerData(owner).structures || []) {
      if (!s || s.dead || s.hp <= 0 || ingredientIds.has(s.id)) continue;
      if (dist(x, y, s.x, s.y) < visualPad + structureVisualFootprint(s) + 16) return false;
    }
    return true;
  }
  function findMergePlacement(owner, ingredients, resultKind) {
    const cx = ingredients.reduce((sum,s)=>sum+s.x,0) / Math.max(1, ingredients.length);
    const cy = ingredients.reduce((sum,s)=>sum+s.y,0) / Math.max(1, ingredients.length);
    const e = enemyOf(owner);
    const away = e ? norm(cx - e.x, cy - e.y) : norm(owner.x - cx, owner.y - cy);
    const candidates = [{ x:cx, y:cy }];
    for (const r of [80, 135, 195, 265, 345, 430]) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + r * .013;
        candidates.push({ x:cx + Math.cos(a) * r + away.x * 40, y:cy + Math.sin(a) * r + away.y * 40 });
      }
    }
    let best = null;
    let bestScore = -Infinity;
    let leastBad = null;
    let leastBadScore = -Infinity;
    const spec = UPGRADED[resultKind] || BASE[resultKind];
    const visualPad = visualFootprintForKind(resultKind, spec?.radius || 70);
    for (const c of candidates) {
      const x = clamp(c.x, visualPad + 12, GAME_SIZE - visualPad - 12);
      const y = clamp(c.y, visualPad + 12, GAME_SIZE - visualPad - 12);
      let nearest = 999;
      let overlapPenalty = 0;
      for (const s of ownerData(owner).structures || []) {
        if (!s || s.dead || s.hp <= 0 || ingredients.includes(s)) continue;
        const clearance = dist(x, y, s.x, s.y) - (visualPad + structureVisualFootprint(s) + 20);
        nearest = Math.min(nearest, clearance);
        if (clearance < 0) overlapPenalty += Math.abs(clearance) * Math.abs(clearance);
      }
      const travel = dist(x, y, cx, cy);
      const score = nearest - travel * .22 - overlapPenalty * .02;
      if (score > leastBadScore) { leastBadScore = score; leastBad = { x, y }; }
      if (!validMergePlacement(owner, ingredients, resultKind, x, y)) continue;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best || leastBad || { x:clamp(cx, visualPad + 12, GAME_SIZE - visualPad - 12), y:clamp(cy, visualPad + 12, GAME_SIZE - visualPad - 12) };
  }
  function mergeScrapCost(ingredients) {
    return 0;
  }
  function pendingMergeInfo(d) {
    if (!d || Object.keys(d.mergeIds || {}).length) return null;
    const options = [];
    const ht = onlineStructures(d, 'heavy_turret')[0];
    const hn = onlineStructures(d, 'healing_nexus')[0];
    const mf = onlineStructures(d, 'mega_factory')[0];
    if (ht && hn && mf) {
      const ingredients = [ht, hn, mf];
      options.push({ kind:'war_machine', resultKind:'war_machine', ingredients, cost:0, missing:0, priority:0 });
    }
    for (const kind of buildKinds) {
      const ready = onlineStructures(d, kind).sort((a,b)=>a.onlineAt-b.onlineAt);
      if (ready.length < 3) continue;
      const ingredients = ready.slice(0, 3);
      options.push({ kind, resultKind:recipeResult[kind], ingredients, cost:0, missing:0, priority:kind === 'repair' ? 1 : 2 });
    }
    if (!options.length) return null;
    options.sort((a,b) => a.missing - b.missing || a.priority - b.priority || b.cost - a.cost);
    return options[0];
  }
  function shouldReserveScrapForMerge(f, plannedKind, buildCost) {
    const d = ownerData(f);
    const merge = pendingMergeInfo(d);
    if (!merge) return null;
    const damaged = (d.structures || []).filter(s => s && !s.dead && s.hp > 0 && s.hp < s.maxHp * .28);
    const emergencyRepair = plannedKind === 'repair' && (damaged.length > 0 || f.hp < f.maxHp * .26);
    const offensiveOnline = onlineStructures(d, 'turret').length + onlineStructures(d, 'heavy_turret').length + onlineStructures(d, 'mine').length + onlineStructures(d, 'minefield_core').length + onlineStructures(d, 'war_machine').length;
    const emergencyOffense = (plannedKind === 'turret' || plannedKind === 'mine') && offensiveOnline <= 0;
    if (emergencyRepair || emergencyOffense) return null;
    return null;
  }
  function startMerge(owner, ingredients, resultKind, preferredPoint=null) {
    const d = ownerData(owner);
    const mergeId = `m${engineerState.nextId++}`;
    const spec = UPGRADED[resultKind] || BASE[resultKind];
    const visualPad = visualFootprintForKind(resultKind, spec?.radius || 70);
    const preferred = preferredPoint && Number.isFinite(preferredPoint.x) && Number.isFinite(preferredPoint.y)
      ? {x:clamp(preferredPoint.x, visualPad + 12, GAME_SIZE - visualPad - 12), y:clamp(preferredPoint.y, visualPad + 12, GAME_SIZE - visualPad - 12)}
      : null;
    const p = preferred && validMergePlacement(owner, ingredients, resultKind, preferred.x, preferred.y)
      ? preferred
      : findMergePlacement(owner, ingredients, resultKind);
    const duration = resultKind === 'war_machine' ? 30 : 9;
    d.mergeIds[mergeId] = { id:mergeId, resultKind, timer:duration, duration, x:p.x, y:p.y, ingredients, scrapCost:0 };
    for (const s of ingredients) {
      s.state = 'merging';
      s.mergeId = mergeId;
      s.mergeTargetX = p.x;
      s.mergeTargetY = p.y;
      s.mergeStartX = s.x;
      s.mergeStartY = s.y;
      s.mergeTimer = duration;
      s.mergeDuration = duration;
    }
    engineerState.vfx.push({ type:resultKind === 'war_machine' ? 'warmerge' : 'merge', mergeId, resultKind, x:p.x, y:p.y, life:duration, maxLife:duration, radius:170 });
    playEngineerAudio(resultKind === 'war_machine' ? 'warMerge' : 'mergeStart', resultKind === 'war_machine' ? .64 : .46, 1, .45);
    return true;
  }
  function cancelMerge(owner, mergeId, destroyed) {
    const d = ownerData(owner);
    const merge = d.mergeIds[mergeId];
    if (!merge) return;
    engineerState.vfx = engineerState.vfx.filter(v => v.mergeId !== mergeId);
    for (const s of merge.ingredients || []) {
      if (!s.dead && s.hp > 0) {
        s.state = 'online';
        s.mergeId = null;
        s.mergeTimer = 0;
        s.mergeDuration = 0;
        s.mergeTargetX = null;
        s.mergeTargetY = null;
        s.mergeStartX = null;
        s.mergeStartY = null;
      }
    }
    engineerState.vfx.push({ type:'mergeFail', x:merge.x, y:merge.y, life:.18, maxLife:.18, radius:190 });
    spawnShockwave(merge.x, merge.y, '#ff6a3a', 210);
    delete d.mergeIds[mergeId];
  }
  function completeMerge(owner, mergeId) {
    const d = ownerData(owner);
    const merge = d.mergeIds[mergeId];
    if (!merge) return;
    const alive = (merge.ingredients || []).filter(s => !s.dead && s.hp > 0 && s.state === 'merging');
    if (alive.length < 3) {
      cancelMerge(owner, mergeId, alive[0]);
      return;
    }
    const x = clamp(merge.x, 70, GAME_SIZE - 70);
    const y = clamp(merge.y, 70, GAME_SIZE - 70);
    for (const s of alive) s.dead = true;
    d.structures = d.structures.filter(s => !s.dead);
    engineerState.vfx = engineerState.vfx.filter(v => v.mergeId !== mergeId);
    createStructure(merge.resultKind, owner, x, y);
    playEngineerAudio('mergeDone', .58, 1, .16);
    addScrapDrop(x, y, 5, owner);
    delete d.mergeIds[mergeId];
  }
  function checkMerges(f) {
    const d = ownerData(f);
    if ((d.mergeBlockUntil || 0) > matchClock) return;
    if (Object.keys(d.mergeIds || {}).length) return;
    const ht = onlineStructures(d, 'heavy_turret')[0];
    const hn = onlineStructures(d, 'healing_nexus')[0];
    const mf = onlineStructures(d, 'mega_factory')[0];
    if (ht && hn && mf) {
      if (startMerge(f, [ht, hn, mf], 'war_machine')) return;
    }
    const repairReady = onlineStructures(d, 'repair').sort((a,b)=>a.onlineAt-b.onlineAt);
    if (!hn && repairReady.length >= 3) {
      const ingredients = repairReady.slice(0, 3);
      if (startMerge(f, ingredients, 'healing_nexus')) return;
    }
    for (const kind of buildKinds) {
      const ready = onlineStructures(d, kind).sort((a,b)=>a.onlineAt-b.onlineAt);
      if (ready.length >= 3) {
        const ingredients = ready.slice(0, 3);
        if (startMerge(f, ingredients, recipeResult[kind])) return;
      }
    }
  }
  function activeBirdCages() {
    return (projectiles || []).filter(p => p && p.type === 'string_bird_cage' && p.life > 0 && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.radius));
  }
  function birdCageBlocksStructureEffect(from, target) {
    if (!from || !target) return false;
    for (const cage of activeBirdCages()) {
      const fromInside = dist(from.x, from.y, cage.x, cage.y) <= cage.radius;
      const targetInside = dist(target.x, target.y, cage.x, cage.y) <= cage.radius;
      if (fromInside !== targetInside) return true;
    }
    return false;
  }
  function structureSoccerDebuff(s) {
    return (fighters || []).some(q => live(q) && q.name === 'SOCCER' && q !== s.owner && q.data?.soccerPossessionActive && q.data?.soccerOpponentHomeDebuffActive);
  }
  function structureActionDt(s, dt) {
    return dt * (structureSoccerDebuff(s) ? .5 : 1);
  }
  function engineerForcedSelfTarget(owner, normalTarget) {
    return owner?.data?.stringSelfCastTimer > 0 && owner.data.stringSelfCastOwner ? owner : normalTarget;
  }
  function fireShot(owner, x, y, target, kind, damage, speed, radius, assetKey, maxRange = null) {
    if (!target || birdCageBlocksStructureEffect({ x, y }, target)) return;
    const n = norm(target.x - x, target.y - y);
    engineerState.shots.push({ owner, targetId:target.id, x, y, startX:x, startY:y, vx:n.x*speed, vy:n.y*speed, kind, damage, radius, life:3.2, maxLife:3.2, maxRange, assetKey, hit:false });
  }
  function rayCircleT(ox, oy, dx, dy, cx, cy, radius) {
    const lx = ox - cx, ly = oy - cy;
    const b = lx * dx + ly * dy;
    const c = lx * lx + ly * ly - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    let t = -b - root;
    if (t < 0) t = -b + root;
    return t >= 0 ? t : null;
  }
  function rayWallHit(ox, oy, dx, dy) {
    let best = Infinity, nx = 0, ny = 0;
    if (dx > .0001) { const t = (GAME_SIZE - ox) / dx; if (t > 0 && t < best) { best = t; nx = -1; ny = 0; } }
    if (dx < -.0001) { const t = -ox / dx; if (t > 0 && t < best) { best = t; nx = 1; ny = 0; } }
    if (dy > .0001) { const t = (GAME_SIZE - oy) / dy; if (t > 0 && t < best) { best = t; nx = 0; ny = -1; } }
    if (dy < -.0001) { const t = -oy / dy; if (t > 0 && t < best) { best = t; nx = 0; ny = 1; } }
    if (!Number.isFinite(best)) return null;
    return { t:best, nx, ny, x:ox + dx * best, y:oy + dy * best };
  }
  function traceWarLaser(origin, dir, target, width) {
    const segments = [];
    let ox = origin.x, oy = origin.y, dx = dir.x, dy = dir.y;
    for (let bounce = 0; bounce < 4; bounce += 1) {
      const wall = rayWallHit(ox, oy, dx, dy);
      const wallT = wall?.t ?? 1600;
      const hitT = target ? rayCircleT(ox, oy, dx, dy, target.x, target.y, (target.radius || 40) + width * .45) : null;
      if (hitT != null && hitT <= wallT) {
        segments.push({ x1:ox, y1:oy, x2:ox + dx * hitT, y2:oy + dy * hitT });
        return { segments, hit:true };
      }
      if (!wall) {
        segments.push({ x1:ox, y1:oy, x2:ox + dx * 1200, y2:oy + dy * 1200 });
        return { segments, hit:false };
      }
      segments.push({ x1:ox, y1:oy, x2:wall.x, y2:wall.y });
      const dot = dx * wall.nx + dy * wall.ny;
      dx -= 2 * dot * wall.nx;
      dy -= 2 * dot * wall.ny;
      ox = clamp(wall.x + dx * 1.5, 0, GAME_SIZE);
      oy = clamp(wall.y + dy * 1.5, 0, GAME_SIZE);
    }
    return { segments, hit:false };
  }
  function fireWarMachineLaser(s, target) {
    if (!s || !target || birdCageBlocksStructureEffect(s, target)) return false;
    const f = s.owner;
    const rot = s.aimAngle ?? (Math.atan2(target.y - s.y, target.x - s.x) - Math.PI / 2);
    const dir = { x:Math.cos(rot + Math.PI / 2), y:Math.sin(rot + Math.PI / 2) };
    const vr = visualRadiusForKind(s.kind, s.radius);
    const muzzle = { x:s.x + dir.x * vr * .78, y:s.y + dir.y * vr * .78 };
    const width = Math.max(12, vr * (s.pilotedBy ? .34 : .28));
    const traced = traceWarLaser(muzzle, dir, target, width);
    if (!traced.hit) return false;
    const totalDamage = structureOutput(s.pilotedBy ? 300 : 150) * .5;
    engineerState.lasers.push({
      owner:f, source:s, sourceId:s.id, targetId:target.id, segments:traced.segments, width,
      life:1.05, maxLife:1.05, tick:.1, tickDamage:totalDamage / 10, color:'#7ff8ff',
      pushDir:{x:dir.x,y:dir.y}, ticksDone:0, totalTicks:10
    });
    s.laserLockUntil = matchClock + 1;
    s.fireCd = 5;
    playEngineerAudio('warLaser', s.pilotedBy ? .58 : .48, 1, .15);
    return true;
  }
  function updateStructureOnline(s, dt) {
    const f = s.owner;
    const normalEnemy = enemyOf(f);
    const e = engineerForcedSelfTarget(f, normalEnemy);
    if (!live(f) || !e || s.dead || s.hp <= 0 || s.state !== 'online') {
      stopStructureLoops(s);
      return;
    }
    const actionDt = structureActionDt(s, dt);
    if (s.kind === 'turret') {
      const inRange = dist(s.x,s.y,e.x,e.y) <= 300;
      setStructureLoop(s, 'turretFire', inRange && !birdCageBlocksStructureEffect(s, e), .24);
      if (inRange) {
        s.aimAngle = Math.atan2(e.y - s.y, e.x - s.x) - Math.PI / 2;
        s.fireCd = Math.max(0, (s.fireCd || 0) - actionDt);
      } else {
        s.fireCd = Math.max(0, Math.min(s.fireCd || 0, .8 / 4.5));
      }
      if (s.fireCd <= 0 && inRange && !birdCageBlocksStructureEffect(s, e)) {
        s.fireCd = .8 / 4.5;
        fireShot(f, s.x, s.y, e, 'turret', structureOutput(2), 2940, 13, 'turretBullet', 300);
      }
    } else if (s.kind === 'heavy_turret') {
      const inRange = dist(s.x,s.y,e.x,e.y) <= 750;
      if (inRange) {
        s.aimAngle = Math.atan2(e.y - s.y, e.x - s.x) - Math.PI / 2;
        s.fireCd = Math.max(0, (s.fireCd || 0) - actionDt);
      } else s.fireCd = Math.max(0, Math.min(s.fireCd || 0, 2));
      if (s.fireCd <= 0 && inRange && !birdCageBlocksStructureEffect(s, e)) {
        s.fireCd = 2;
        fireShot(f, s.x, s.y, e, 'rocket', structureOutput(30), 860, 26, 'rocketBullet', 750);
        playEngineerAudio('rocketFire', .52, 1, .18);
      }
    } else if (s.kind === 'war_machine') {
      s.healTick += actionDt;
      if (s.healTick >= 1) {
        s.healTick -= 1;
        for (const q of ownerData(f).structures) if (q !== s && q.hp > 0 && !q.dead && dist(q.x,q.y,s.x,s.y) < 310) healStructure(q, structureOutput(20), 0);
      }
      const inRange = dist(s.x,s.y,e.x,e.y) <= 930;
      const manualPilot = s.pilotedBy?.data?.manualController;
      if (manualPilot?.active && manualPilot.mode === 'MANUAL_LAB') {
        const aim = manualPilot.getAimPoint?.();
        if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) s.aimAngle = Math.atan2(aim.y - s.y, aim.x - s.x) - Math.PI / 2;
        s.fireCd = 0;
      } else if (inRange && !(s.laserLockUntil > matchClock)) {
        s.aimAngle = Math.atan2(e.y - s.y, e.x - s.x) - Math.PI / 2;
        s.fireCd = Math.max(0, (s.fireCd || 0) - actionDt);
      } else if (!inRange) {
        s.fireCd = Math.max(0, Math.min(s.fireCd || 0, 5));
      }
      if (!(manualPilot?.active && manualPilot.mode === 'MANUAL_LAB') && s.fireCd <= 0 && inRange && !birdCageBlocksStructureEffect(s, e)) {
        fireWarMachineLaser(s, e);
      }
    } else if (s.kind === 'mine' || s.kind === 'small_mine') {
      if (!s.armed) {
        s.armDelay = (s.armDelay ?? 1) - actionDt;
        if (s.armDelay <= 0) s.armed = true;
      } else if (!s.triggered && dist(s.x,s.y,e.x,e.y) <= (s.kind === 'small_mine' ? 55 : 70) + e.radius && !birdCageBlocksStructureEffect(s, e)) {
        s.triggered = true;
        s.triggerDelay = s.kind === 'small_mine' ? .12 : .28;
        engineerState.vfx.push({ type:'warning', x:s.x, y:s.y, life:s.triggerDelay, maxLife:s.triggerDelay, radius:s.kind === 'small_mine' ? 95 : 120 });
      } else if (s.triggered) {
        s.triggerDelay -= actionDt;
        if (s.triggerDelay <= 0) explodeMine(s, s.kind === 'small_mine');
      }
    } else if (s.kind === 'minefield_core') {
      s.spawnCd -= actionDt;
      if (s.spawnCd <= 0) {
        s.spawnCd += 3.5;
        const a = rand(0, TAU), r = rand(55, 200);
        const x = clamp(s.x + Math.cos(a)*r, 44, GAME_SIZE-44);
        const y = clamp(s.y + Math.sin(a)*r, 44, GAME_SIZE-44);
        const m = createStructure('mine', f, x, y);
        m.kind = 'small_mine';
        m.state = 'online';
        m.hp = 1;
        m.maxHp = 1;
        m.radius = 28;
        m.blockRadius = footprintForKind('small_mine', 28);
        m.armed = false;
        m.armDelay = 1;
        m.damage = 45;
        m.life = 16;
      }
    } else if (s.kind === 'repair' || s.kind === 'healing_nexus') {
      s.healTick += actionDt;
      const radius = s.kind === 'healing_nexus' ? 385 : 300;
      const buildHeal = structureOutput(s.kind === 'healing_nexus' ? 20 : 14);
      while (s.healTick >= 1) {
        s.healTick -= 1;
        for (const q of ownerData(f).structures) if (q !== s && q.hp > 0 && !q.dead && dist(q.x,q.y,s.x,s.y) <= radius) healStructure(q, buildHeal, 0);
      }
      if (s.kind === 'healing_nexus') {
        s.shieldCd -= actionDt;
        if (s.shieldCd <= 0) {
          s.shieldCd += 5;
          const structureTargets = ownerData(f).structures.filter(q => q !== s && q.hp > 0 && !q.dead);
          const targets = [...structureTargets, f];
          const target = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
          if (target) {
            if (target === f) grantEngineerVirtualShield(f, structureOutput(100), 5, 'nexus');
            else grantStructureShield(target, structureOutput(100), 'nexus');
          }
        }
      }
    } else if (s.kind === 'factory' || s.kind === 'mega_factory') {
      s.prodTick += actionDt;
      while (s.prodTick >= 2) {
        s.prodTick -= 2;
        addScrapDrop(s.x, s.y, s.kind === 'mega_factory' ? 5 : 1, f, { avoidTop:true });
        const stacks = s.kind === 'mega_factory' ? 3 : 2;
        for (let i = 0; i < stacks; i++) {
          engineerState.vfx.push({
            type:'smoke',
            x:s.x + rand(-s.radius * .45, s.radius * .45),
            y:s.y - s.radius * rand(.36, .78),
            life:rand(.55, .9),
            maxLife:.9,
            radius:rand(16, 28),
            rot:rand(0, TAU)
          });
        }
        if (s.kind === 'mega_factory') {
          s.megaTicks = (s.megaTicks || 0) + 1;
          if (s.megaTicks % 3 === 0) ownerData(f).buildTimeBonus = Math.min(.8, (ownerData(f).buildTimeBonus || 0) + .2);
        }
      }
    }
  }
  function explodeMine(s, small) {
    if (!s || s.dead) return;
    const f = s.owner;
    const e = engineerForcedSelfTarget(f, enemyOf(f));
    const radius = small ? 90 : 120;
    if (e) {
      const d = dist(e.x,e.y,s.x,s.y);
      if (d <= radius + e.radius) {
        const base = structureOutput(small ? 45 : lerp(70, 40, clamp(d / radius, 0, 1)));
        e.takeDamage(base, f, small ? 'engineer-small-mine' : 'engineer-mine');
        grantScrap(f, small ? 1 : 2, s.x, s.y);
        e.applyStatus('push', .25, { ...norm(e.x-s.x, e.y-s.y), strength:small ? 720 : 1080 });
      }
    }
    engineerState.vfx.push({ type:'explosion', x:s.x, y:s.y, life:.6, maxLife:.6, radius:radius * 1.8 });
    playEngineerAudio('explosion', .58, 1, .08);
    s.dead = true;
  }
  function updateEngineerSystems(dt) {
    if (gameState !== 'PLAYING' || (autoBattlePaused && autoBattleControlsActive)) return;
    const updateKey = `${gameState}:${window.__apexRenderFrame || 0}:${matchClock.toFixed(6)}`;
    if (engineerState.lastSystemUpdateKey === updateKey) return;
    engineerState.lastSystemUpdateKey = updateKey;
    const galaxyFreeze = (fighters || []).some(f => f?.name === 'GALAXY' && (f.data?.galaxyDivine?.worldFreeze || 0) > 0);
    if (galaxyFreeze) return;
    for (const f of fighters || []) {
      if (!live(f) || f.name !== 'ENGINEER') continue;
      const d = ownerData(f);
      if (f.isRage) {
        const bucket = Math.floor((f.maxHp - f.hp) / Math.max(1, f.maxHp * .1));
        if (bucket > (d.rageShieldBucket ?? -1)) applyEngineerRageShield(f, 'hp_threshold');
      }
      for (const merge of Object.values(d.mergeIds || {})) {
        merge.timer -= dt;
        let cancelled = false;
        for (const s of merge.ingredients || []) {
          if (!s || s.dead || s.hp <= 0) { cancelMerge(f, merge.id, s); cancelled = true; break; }
          const t = smoothstep(1 - clamp(merge.timer / Math.max(.001, merge.duration || 3), 0, 1));
          s.x = lerp(s.mergeStartX, merge.x, t * .72);
          s.y = lerp(s.mergeStartY, merge.y, t * .72);
          s.mergeTimer = merge.timer;
        }
        if (!cancelled && merge.timer <= 0) completeMerge(f, merge.id);
      }
      for (const s of d.structures) {
        if (s.dead || s.hp <= 0) continue;
        updateStructureNumberText(s, dt);
        updateStructureFreeze(s, dt);
        s.shieldPulse = Math.max(0, (s.shieldPulse || 0) - dt);
        if ((s.kind === 'mine' || s.kind === 'small_mine') && s.state === 'online' && !s.armed) {
          s.armDelay = (s.armDelay ?? 1) - dt;
          if (s.armDelay <= 0) s.armed = true;
        }
        if ((s.kind === 'mine' || s.kind === 'small_mine') && s.state === 'online' && s.triggered) {
          s.triggerDelay = (s.triggerDelay ?? .2) - dt;
          if (s.triggerDelay <= 0) {
            explodeMine(s, s.kind === 'small_mine');
            continue;
          }
        }
        if ((s.shield || 0) > 0) {
          s.shieldTimer = Math.max(0, (s.shieldTimer ?? 10) - dt);
          if (s.shieldTimer <= 0) {
            s.shield = 0;
            s.maxShield = 0;
            s.shieldSource = null;
            if (s.kind === 'war_machine' && s.pilotedBy) updateHUD(true);
          }
        }
        if (s.state === 'building') {
          s.progress += dt / s.buildTime;
          if (s.progress >= 1) {
            s.state = 'online';
            s.hp = s.onlineHp;
            s.maxHp = s.onlineHp;
            s.onlineAt = matchClock;
            engineerState.vfx.push({ type:'online', x:s.x, y:s.y, life:.42, maxLife:.42, radius:s.radius + 28 });
            playEngineerAudio(s.kind === 'mine' ? 'mineLand' : 'buildDone', s.kind === 'mine' ? .5 : .42, 1, .08);
          }
        } else if (s.state === 'online') {
          if (s.life !== undefined) { s.life -= dt; if (s.life <= 0) s.dead = true; }
          if (!s.disabled) updateStructureOnline(s, dt);
          if ((s.kind === 'mine' || s.kind === 'small_mine') && s.armed && !s.triggered && !s.dead) {
            const triggerRadius = (s.kind === 'small_mine' ? 55 : 70);
            const victim = (fighters || []).find(q => q && q !== f && q.hp > 0 && q.id !== f.id
              && dist(s.x,s.y,q.x,q.y) <= triggerRadius + (q.radius || 0)
              && !birdCageBlocksStructureEffect(s, q));
            if (victim) {
              s.triggered = true;
              s.triggerDelay = s.kind === 'small_mine' ? .12 : .28;
              engineerState.vfx.push({ type:'warning', x:s.x, y:s.y, life:s.triggerDelay, maxLife:s.triggerDelay, radius:s.kind === 'small_mine' ? 95 : 120 });
            }
          }
        }
      }
      d.structures = d.structures.filter(s => !s.dead && s.hp > 0);
      if (!(f.data?.manualController?.active && f.data.manualController.mode === 'MANUAL_LAB')) checkMerges(f);
    }

    for (const s of engineerState.scraps) {
      s.life -= dt;
      s.x = clamp(s.x + s.vx * dt, 12, GAME_SIZE - 12);
      s.y = clamp(s.y + s.vy * dt, 12, GAME_SIZE - 12);
      s.vx *= .92; s.vy *= .92;
      for (const f of fighters || []) {
        if (!live(f) || f.name !== 'ENGINEER') continue;
        const d = ownerData(f);
        if (d.pilotingWarMachine) continue;
        const pull = d.salvagePulse > 0 || dist(s.x,s.y,f.x,f.y) < 58;
        if (pull) {
          const n = norm(f.x - s.x, f.y - s.y);
          const force = d.salvagePulse > 0 ? 5200 : 650;
          s.vx += n.x * force * dt;
          s.vy += n.y * force * dt;
          if (d.salvagePulse > 0) {
            s.pullOwner = f;
            s.pullGlow = .16;
            const step = Math.min(dist(s.x, s.y, f.x, f.y), 1080 * dt);
            s.x = clamp(s.x + n.x * step, 12, GAME_SIZE - 12);
            s.y = clamp(s.y + n.y * step, 12, GAME_SIZE - 12);
          }
        }
        s.pullGlow = Math.max(0, (s.pullGlow || 0) - dt);
        const collectRadius = d.salvagePulse > 0 ? 10 : f.radius + 18;
        if (dist(s.x,s.y,f.x,f.y) < collectRadius) {
          grantScrap(f, s.amount || 1, f.x, f.y);
          s.life = 0;
        }
      }
    }
    engineerState.scraps = engineerState.scraps.filter(s => s.life > 0);
    if (engineerState.scraps.length > 90) engineerState.scraps.splice(0, engineerState.scraps.length - 90);

    for (const shot of engineerState.shots) {
      shot.life -= dt;
      const prevX = shot.x;
      const prevY = shot.y;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      const e = shot.targetId != null ? fighters.find(q => q && q.id === shot.targetId) : enemyOf(shot.owner);
      if (e && birdCageBlocksStructureEffect(shot, e)) {
        shot.life = 0;
        continue;
      }
      const hitRadius = shot.radius + (e?.radius || 0);
      const sweptHit = e && distToSegment(e.x, e.y, prevX, prevY, shot.x, shot.y) <= hitRadius;
      if (e && !shot.hit && (dist(shot.x,shot.y,e.x,e.y) < hitRadius || sweptHit)) {
        shot.hit = true;
        shot.life = 0;
        e.takeDamage(shot.damage, shot.owner, `engineer-${shot.kind}`);
        if (shot.kind === 'rocket' || shot.kind === 'war_machine') {
          e.applyStatus('push', .28, { ...norm(e.x-shot.x, e.y-shot.y), strength:shot.kind === 'rocket' ? 1200 : 920 });
          engineerState.vfx.push({ type:'explosion', x:shot.x, y:shot.y, life:.48, maxLife:.48, radius:shot.kind === 'rocket' ? 160 : 115 });
        }
      }
      if (shot.maxRange && dist(shot.startX ?? prevX, shot.startY ?? prevY, shot.x, shot.y) >= shot.maxRange) shot.life = 0;
      if (shot.x < -50 || shot.x > GAME_SIZE + 50 || shot.y < -50 || shot.y > GAME_SIZE + 50) shot.life = 0;
    }
    engineerState.shots = engineerState.shots.filter(s => s.life > 0);
    if (engineerState.shots.length > 140) engineerState.shots.splice(0, engineerState.shots.length - 140);

    for (const laser of engineerState.lasers) {
      laser.life = Math.max(0, laser.life - dt);
      const target = laser.targetId != null ? fighters.find(q => q && q.id === laser.targetId && q.hp > 0) : null;
      if (!target) { laser.life = 0; continue; }
      const source = laser.source && !laser.source.dead
        ? laser.source
        : allEngineerStructures().find(s => s.id === laser.sourceId && !s.dead);
      if (!source) { laser.life = 0; continue; }
      const pushDir = norm(target.x - source.x, target.y - source.y);
      const linearStep = (laser.pushStrength || 260) * dt;
      target.x = clamp(target.x + pushDir.x * linearStep, target.radius, GAME_SIZE - target.radius);
      target.y = clamp(target.y + pushDir.y * linearStep, target.radius, GAME_SIZE - target.radius);
      const trackingDir = norm(target.x - source.x, target.y - source.y);
      source.aimAngle = Math.atan2(trackingDir.y, trackingDir.x) - Math.PI / 2;
      const vr = visualRadiusForKind(source.kind, source.radius);
      const muzzle = { x:source.x + trackingDir.x * vr * .78, y:source.y + trackingDir.y * vr * .78 };
      const tracked = traceWarLaser(muzzle, trackingDir, target, laser.width);
      if (tracked.hit) {
        laser.segments = tracked.segments;
        laser.pushDir = {x:trackingDir.x, y:trackingDir.y};
      }
      target.data.positionLocked = true;
      target.applyStatus('stun', Math.max(.18, laser.life + .1), { source:laser.owner, engineerLaser:true });
      laser.tick = (laser.tick || 0) - dt;
      while (laser.tick <= 0 && (laser.ticksDone || 0) < (laser.totalTicks || 10)) {
        laser.tick += .1;
        target.takeDamage(laser.tickDamage || 0, laser.owner, 'engineer-war-machine-laser', true);
        laser.ticksDone = (laser.ticksDone || 0) + 1;
        target.data.positionLocked = true;
      }
    }
    engineerState.lasers = engineerState.lasers.filter(l => l.life > 0);
    if (engineerState.lasers.length > 24) engineerState.lasers.splice(0, engineerState.lasers.length - 24);

    const structures = allEngineerStructures();
    for (const fighter of fighters || []) {
      if (!live(fighter) || fighter.name === 'ENGINEER') continue;
      const target = structures
        .filter(s => s.owner !== fighter)
        .sort((a,b)=>structurePriority(b)-structurePriority(a) || dist(fighter.x,fighter.y,a.x,a.y)-dist(fighter.x,fighter.y,b.x,b.y))[0];
      const targetDist = target ? dist(fighter.x,fighter.y,target.x,target.y) : Infinity;
      if (target && mineLike(target) && target.armed && targetDist < fighter.radius + structureFootprint(target) + 4) {
        explodeMine(target, target.kind === 'small_mine');
      }
    }
    try {
      for (const p of projectiles || []) damageStructuresFromForeignProjectile(p, dt);
      damageStructuresFromExternalZones(dt);
    } catch (error) {
      console.warn('[ENGINEER] structure damage bridge recovered', error);
    }
    engineerState.vfx = engineerState.vfx.filter(v => ((v.life -= dt) > 0));
    if (engineerState.vfx.length > 90) engineerState.vfx.splice(0, engineerState.vfx.length - 90);
  }
  function structurePriority(s) {
    if (s.state === 'merging') return 900;
    if (s.kind === 'war_machine') return 800;
    if (s.kind === 'mega_factory' || s.kind === 'factory') return 520;
    if (s.kind === 'healing_nexus' || s.kind === 'repair') return 500;
    if (s.state === 'building' && s.progress > .65) return 450;
    return 200;
  }
  function continuousStructureProjectile(p) {
    return p && (p.type === 'ice_lane' || p.type === 'ice_age_field' || p.type === 'fire_pit' || p.type === 'toxic_puddle' || p.type === 'toxic_trail' || p.type === 'gravity_well' || p.type === 'magnet_field');
  }
  function structureAoeProjectile(p) {
    return p && (
      p.type === 'ice_lane' ||
      p.type === 'ice_age_field' ||
      p.type === 'string_overheat_whip' ||
      p.type === 'fire_pit' ||
      p.type === 'toxic_puddle' ||
      p.type === 'toxic_trail' ||
      p.type === 'gravity_well' ||
      p.type === 'magnet_field' ||
      p.type === 'blade_wave' ||
      p.type === 'ninja_strike' ||
      p.type === 'kungfu_palm' ||
      p.type === 'meteor'
    );
  }
  function projectileStructureTickInterval(p) {
    if (!p) return 0;
    if (p.type === 'ice_lane' || p.type === 'ice_age_field') return 1;
    if (p.type === 'fire_pit') return .8;
    if (p.type === 'magnet_field') return .25;
    if (p.type === 'toxic_puddle' || p.type === 'toxic_trail') return 1;
    if (p.type === 'gravity_well') return 1;
    return 0;
  }
  function projectileStructureDamage(p, dt = 0, s = null) {
    if (!p || p.visualOnly || p.owner?.name === 'ENGINEER') return 0;
    if (!structureAoeProjectile(p)) return 0;
    if (p.type === 'ice_lane') return (s && (s.freezeTimer || 0) > 0) ? 2.8 : 1.4;
    if (p.type === 'ice_age_field') return 7.3;
    if (p.type === 'string_overheat_whip') return p.damage || 17;
    if (p.type === 'fire_pit') return p.owner?.isRage ? 1.9 : 1.42;
    if (p.type === 'toxic_puddle' || p.type === 'toxic_trail') return .8;
    if (p.type === 'gravity_well' || p.type === 'magnet_field') return 2.6;
    if (p.type === 'meteor') return p.hit ? 16 : 0;
    if (p.type === 'blade_wave') return p.dmg || 12;
    if (p.type === 'ninja_strike') {
      const age = (p.maxCustomLife || p.maxLife || 1) - (p.customLife ?? p.life ?? 0);
      return age >= .34 ? 20 : 0;
    }
    if (p.type === 'kungfu_palm') return 16;
    return 0;
  }
  function distToQuadraticSamples(px, py, x1, y1, cx, cy, x2, y2) {
    let best = Infinity;
    let last = { x:x1, y:y1 };
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      const u = 1 - t;
      const x = u*u*x1 + 2*u*t*cx + t*t*x2;
      const y = u*u*y1 + 2*u*t*cy + t*t*y2;
      best = Math.min(best, distToSegment(px, py, last.x, last.y, x, y));
      last = { x, y };
    }
    return best;
  }
  function projectileTouchesStructure(p, s) {
    const sr = structureFootprint(s);
    if (p.type === 'ice_age_field') return true;
    if (p.type === 'ice_lane' && Number.isFinite(p.x1) && Number.isFinite(p.y1) && Number.isFinite(p.x2) && Number.isFinite(p.y2)) {
      return distToSegment(s.x, s.y, p.x1, p.y1, p.x2, p.y2) <= (p.halfWidth || 0) + Math.min(26, sr * .35);
    }
    if (p.type === 'string_overheat_whip' && Number.isFinite(p.cx) && Number.isFinite(p.cy)) {
      const width = 62 + sr;
      return distToQuadraticSamples(s.x, s.y, p.x1, p.y1, p.cx, p.cy, p.x2, p.y2) <= width
        || distToSegment(s.x, s.y, p.x1, p.y1, p.x2, p.y2) <= width;
    }
    if (p.type === 'ninja_strike' && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      return dist(p.x, p.y, s.x, s.y) <= 170 + sr;
    }
    if (Number.isFinite(p.x1) && Number.isFinite(p.y1) && Number.isFinite(p.x2) && Number.isFinite(p.y2)) {
      const width = p.halfWidth ?? p.width ?? p.radius ?? 18;
      return distToSegment(s.x, s.y, p.x1, p.y1, p.x2, p.y2) <= width + sr;
    }
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      return dist(p.x, p.y, s.x, s.y) <= (p.radius || p.core || 18) + sr;
    }
    if (p.owner && Number.isFinite(p.radius)) {
      return dist(p.owner.x, p.owner.y, s.x, s.y) <= p.radius + sr;
    }
    return false;
  }
  function triggerNinjaStructureStrike(p, s) {
    const owner = p && p.owner;
    if (!owner || owner.name !== 'NINJA' || p.engineerStructureStrike || p._dead) return;
    p.engineerStructureStrike = true;
    const n = norm(owner.x - s.x, owner.y - s.y);
    owner.x = clamp(s.x + n.x * (owner.radius + structureFootprint(s) + 6), owner.radius, GAME_SIZE - owner.radius);
    owner.y = clamp(s.y + n.y * (owner.radius + structureFootprint(s) + 6), owner.radius, GAME_SIZE - owner.radius);
    owner.data.positionLocked = true;
    owner.data.ninjaImmuneUntil = Math.max(owner.data.ninjaImmuneUntil || 0, matchClock + .9);
    owner.data.teleports = (owner.data.teleports || 0) + 1;
    projectiles.push({ apexCustom:true, type:'ninja_strike', owner, targetId:undefined, x:s.x, y:s.y, hit:false, customLife:.92, maxCustomLife:.92, structureStrike:true });
    p._dead = true;
    p.life = 0;
  }
  function damageStructuresFromForeignProjectile(p, dt) {
    if (!p || p.visualOnly || p.owner?.name === 'ENGINEER') return;
    p.engineerHitCd ||= {};
    p.engineerHitIds ||= {};
    const continuous = continuousStructureProjectile(p);
    const tickInterval = projectileStructureTickInterval(p);
    const touchedIds = new Set();
    for (const s of allEngineerStructures()) {
      if (s.owner === p.owner) continue;
      const dmg = projectileStructureDamage(p, dt, s);
      if (dmg <= 0) continue;
      if (!continuous) p.engineerHitCd[s.id] = Math.max(0, (p.engineerHitCd[s.id] || 0) - dt);
      const oncePerCast = p.type === 'string_overheat_whip' || p.type === 'ninja_strike';
      const touches = projectileTouchesStructure(p, s);
      if ((continuous || oncePerCast || p.engineerHitCd[s.id] <= 0) && !p.engineerHitIds[s.id] && touches) {
        touchedIds.add(s.id);
        if (oncePerCast) p.engineerHitIds[s.id] = true;
        if (!continuous && !oncePerCast) p.engineerHitCd[s.id] = .45;
        if (continuous) {
          p.engineerTick ||= {};
          p.engineerTick[s.id] = (p.engineerTick[s.id] || 0) + dt;
          while (p.engineerTick[s.id] >= Math.max(.05, tickInterval || 1)) {
            p.engineerTick[s.id] -= Math.max(.05, tickInterval || 1);
            damageStructure(s, projectileStructureDamage(p, tickInterval || 1, s), p.owner, `structure-${p.type || 'projectile'}`, 0);
          }
        } else {
          damageStructure(s, dmg, p.owner, `structure-${p.type || 'projectile'}`, 0);
        }
        if (p.type === 'ice_lane') {
          p.engineerFreezeInside ||= {};
          p.engineerFreezeInside[s.id] = (p.engineerFreezeInside[s.id] || 0) + dt;
          s.frostLaneBuild = clamp((s.frostLaneBuild || 0) + dt, 0, 3.25);
          if (p.engineerFreezeInside[s.id] >= 3.25) {
            p.engineerFreezeInside[s.id] = 0;
            s.frostLaneBuild = 0;
            applyStructureFreeze(s, 1.8, p.owner);
          }
        } else if (p.type === 'ice_age_field') {
          p.engineerFreezeInside ||= {};
          p.engineerFreezeInside[s.id] = (p.engineerFreezeInside[s.id] || 0) + dt;
          if (p.engineerFreezeInside[s.id] >= 1.75) {
            applyStructureFreeze(s, 1.6, p.owner);
          }
        } else if (p.type === 'ninja_shuriken') {
          triggerNinjaStructureStrike(p, s);
        }
        if (!continuous && !oncePerCast && !['meteor','fire_pit','gravity_well','ice_lane','toxic_puddle','toxic_trail','magnet_field'].includes(p.type)) p.life = Math.min(p.life || 0, .05);
      }
      if (continuous && !touches && p.engineerTick) p.engineerTick[s.id] = 0;
    }
    if (p.type === 'ice_lane' && p.engineerFreezeInside) {
      for (const s of allEngineerStructures()) {
        if (s.owner === p.owner || touchedIds.has(s.id)) continue;
        p.engineerFreezeInside[s.id] = Math.max(0, (p.engineerFreezeInside[s.id] || 0) - dt * 1.5);
        s.frostLaneBuild = Math.max(0, (s.frostLaneBuild || 0) - dt * 1.5);
      }
    }
  }
  function pointInEngineerParabolaZone(z, px, py) {
    if (!z || z.type !== 'galaxy_parabola' || !z.dir || !Number.isFinite(z.dir.x) || !Number.isFinite(z.dir.y)) return false;
    const dir = norm(z.dir.x, z.dir.y);
    const rel = { x:px - z.x, y:py - z.y };
    const x = rel.x * dir.x + rel.y * dir.y;
    const y = rel.x * (-dir.y) + rel.y * dir.x;
    if (x < 0 || x > (z.length || GAME_SIZE) || Math.abs(y) > (z.halfWidth || 120)) return false;
    const curveX = (y * y) / Math.max(1, z.curve || 220);
    return x >= curveX;
  }
  function zoneTouchesStructure(z, s) {
    const sr = structureFootprint(s);
    if (z.type === 'galaxy_parabola') {
      if (pointInEngineerParabolaZone(z, s.x, s.y)) return true;
      for (let i = 0; i < 8; i += 1) {
        const a = i * TAU / 8;
        if (pointInEngineerParabolaZone(z, s.x + Math.cos(a) * sr, s.y + Math.sin(a) * sr)) return true;
      }
      return false;
    }
    if (Number.isFinite(z.x) && Number.isFinite(z.y) && Number.isFinite(z.radius)) return dist(z.x, z.y, s.x, s.y) <= z.radius + sr;
    if (z.type === 'u' && z.dir) {
      const rel = { x:s.x - z.x, y:s.y - z.y };
      const a = -Math.atan2(z.dir.y, z.dir.x);
      const x = rel.x * Math.cos(a) - rel.y * Math.sin(a);
      const y = rel.x * Math.sin(a) + rel.y * Math.cos(a);
      const w = (z.w || 260) / 2 + sr;
      const h = (z.h || 220) / 2 + sr;
      const t = (z.thick || 68) + sr;
      return x >= -w && x <= w && y >= -h && y <= h && (Math.abs(x) >= w - t || y >= h - t);
    }
    return false;
  }
  function damageStructuresFromExternalZones(dt) {
    const G = window.APEX_GALAXY;
    if (!G) return;
    const galaxy = fighters.find(f => f?.name === 'GALAXY');
    const zones = [...(G.zones || [])];
    for (const b of G.blackholes || []) {
      b.type ||= 'galaxy_blackhole';
      b.owner ||= galaxy;
      zones.push(b);
    }
    for (const fx of G.planetImpacts || []) {
      fx.type ||= 'galaxy_planet_impact';
      fx.owner ||= galaxy;
      zones.push(fx);
    }
    for (const z of zones) {
      if (z.type === 'galaxy_impact_burst' && z.engineerResolved) continue;
      const continuous = z.type === 'galaxy_blackhole';
      const oncePerZone = z.type === 'galaxy_planet_impact' || z.type === 'galaxy_impact_burst' || z.type === 'galaxy_parabola' || z.type === 'u';
      const dmg = z.type === 'galaxy_planet_impact' ? 0
        : z.type === 'galaxy_impact_burst' ? 0
        : z.type === 'galaxy_blackhole' ? 2.6 * dt
        : z.type === 'galaxy_parabola' ? 5 + (z.hits || 1) * 5
        : z.type === 'u' ? 5 + (z.hits || 1) * 5
        : 8;
      z.engineerHitCd ||= {};
      z.engineerHitIds ||= {};
      let applied = 0;
      const targets = allEngineerStructures().sort((a,b)=>structurePriority(b)-structurePriority(a));
      for (const s of targets) {
        if (!s || s.owner === z.owner) continue;
        if (oncePerZone && z.engineerHitIds[s.id]) continue;
        if (!continuous) z.engineerHitCd[s.id] = Math.max(0, (z.engineerHitCd[s.id] || 0) - dt);
        if ((continuous || z.engineerHitCd[s.id] <= 0) && zoneTouchesStructure(z, s)) {
          if (oncePerZone) z.engineerHitIds[s.id] = true;
          if (!continuous) z.engineerHitCd[s.id] = .45;
          const amount = z.type === 'galaxy_planet_impact'
            ? clamp(10 * (1 - dist(z.x, z.y, s.x, s.y) / Math.hypot(GAME_SIZE, GAME_SIZE)), 0, 10)
            : z.type === 'galaxy_impact_burst'
              ? lerp(50 + Math.max(0, (z.hits || 9) - 9) * 5, 30, clamp(dist(s.x, s.y, GAME_SIZE / 2, GAME_SIZE / 2) / Math.hypot(GAME_SIZE / 2, GAME_SIZE / 2), 0, 1))
            : dmg;
          if (continuous) {
            z.engineerTick ||= {};
            z.engineerTick[s.id] = (z.engineerTick[s.id] || 0) + dt;
            while (z.engineerTick[s.id] >= 1) {
              z.engineerTick[s.id] -= 1;
              damageStructure(s, 2.6, z.owner, `structure-${z.type || 'zone'}`, 0);
            }
          } else {
            damageStructure(s, amount, z.owner, `structure-${z.type || 'zone'}`, 0);
          }
          applied++;
          if (z.type === 'galaxy_impact_burst' && applied >= 28) break;
        }
      }
      if (z.type === 'galaxy_impact_burst') {
        z.engineerResolved = true;
        z.life = 0;
      }
    }
  }
  function drawStructureShieldOverlay(ctx, s, vr, alpha = 1) {
    if (!s || !(s.shield > 0)) return;
    const source = s.shieldSource || 'nexus';
    const pulse = 1 + Math.sin(performance.now() / (source === 'rage' ? 105 : 145)) * .035 + (s.shieldPulse || 0) * .08;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalCompositeOperation = 'lighter';
    const shieldKey = source === 'rage' ? 'shieldRage' : 'shieldNexus';
    if (ready(shieldKey)) {
      ctx.globalCompositeOperation = 'screen';
      drawAssetSquareKeyed(ctx, shieldKey, 0, 0, vr * 2.75 * pulse, 0, alpha * (source === 'rage' ? .72 : .66));
    }
    ctx.restore();
  }
  function drawStructure(ctx, s) {
    const alpha = s.state === 'building' ? .58 + .22 * Math.sin(performance.now()/90) : 1;
    const aimTarget = engineerForcedSelfTarget(s.owner, enemyOf(s.owner));
    const fallbackRot = Math.atan2((aimTarget?.y||s.y)-s.y, (aimTarget?.x||s.x)-s.x) - Math.PI/2;
    const canRotateVisual = s.state === 'online';
    const rot = s.kind === 'turret' || s.kind === 'heavy_turret' || s.kind === 'war_machine'
      ? (Number.isFinite(s.aimAngle) ? s.aimAngle : (canRotateVisual ? fallbackRot : 0))
      : 0;
    const rocketRot = rot + Math.PI;
    const vr = visualRadiusForKind(s.kind, s.radius);
    const factoryBob = (s.kind === 'factory' || s.kind === 'mega_factory') && s.state === 'online' ? Math.sin(performance.now() / 170 + s.id) * 3.5 : 0;
    const mergeProgress = s.state === 'merging' ? clamp(1 - (s.mergeTimer || 0) / Math.max(.001, s.mergeDuration || 3), 0, 1) : 0;
    let drawn = false;
    if (s.kind === 'turret') {
      drawn = drawAssetSquare(ctx, 'turretBase', s.x, s.y, vr*2.25, 0, alpha);
      drawAsset(ctx, 'turretHead', s.x, s.y, vr*2.45, rot, alpha);
    } else if (s.kind === 'heavy_turret') {
      drawn = drawAssetSquare(ctx, 'rocketBase', s.x, s.y, vr*2.0, 0, alpha);
      drawAssetSquare(ctx, (s.fireCd || 0) < .25 ? 'rocketReady' : 'rocketReload', s.x, s.y, vr*2.25, rocketRot, alpha);
    } else if (s.kind === 'mine' || s.kind === 'small_mine') {
      drawn = drawAssetSquare(ctx, s.kind === 'small_mine' ? 'mineLv2' : 'mine', s.x, s.y, vr*2.35, 0, s.armed ? alpha*.82 : alpha);
    } else if (s.kind === 'minefield_core') {
      drawn = drawAssetSquare(ctx, 'mineLv2', s.x, s.y, vr*2.45, 0, alpha);
    } else if (s.kind === 'repair') {
      drawn = drawAssetSquare(ctx, 'repair', s.x, s.y, vr*2.25, 0, alpha);
    } else if (s.kind === 'healing_nexus') {
      drawn = drawAssetSquare(ctx, 'repairLv2', s.x, s.y, vr*2.25, 0, alpha);
    } else if (s.kind === 'factory') {
      drawn = drawAssetSquare(ctx, 'factory', s.x, s.y + factoryBob, vr*2.2, 0, alpha);
    } else if (s.kind === 'mega_factory') {
      drawn = drawAssetSquare(ctx, 'megaFactory', s.x, s.y + factoryBob, vr*2.25, 0, alpha);
    } else if (s.kind === 'war_machine') {
      drawn = drawAssetSquare(ctx, 'warBase', s.x, s.y, vr*2.34, 0, alpha);
      if (s.pilotedBy && ready('warPilot')) {
        drawAssetSquareKeyed(ctx, 'warPilot', s.x, s.y, vr*2.62, rot, alpha);
      } else if (!drawAssetSquare(ctx, 'warGun', s.x, s.y, vr*2.42, rot, alpha)) {
        drawAssetSquare(ctx, 'warMachine', s.x, s.y, vr*2.55, rot, alpha);
      }
      if (s.pilotedBy && !ready('warPilot')) {
        drawAssetSquare(ctx, 'main', s.x, s.y - vr * .1, vr * 1.15, rot + Math.PI, alpha);
      }
    }
    if (!drawn) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#3b3b35';
      ctx.strokeStyle = '#f1a020';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    drawStructureShieldOverlay(ctx, s, vr, alpha);
    if (s.state === 'merging') {
      const size = vr * 2.9;
      const ringAlpha = .34 + .12 * Math.sin(performance.now() / 120);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const baseOk = drawAssetSquare(ctx, ready('upgradeRing0') ? 'upgradeRing0' : 'buildRing0', s.x, s.y, size, 0, ringAlpha);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.arc(s.x, s.y, size * .58, -Math.PI / 2, -Math.PI / 2 + TAU * mergeProgress);
      ctx.closePath();
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      const fillOk = drawAssetSquare(ctx, ready('upgradeRing100') ? 'upgradeRing100' : 'buildRing100', s.x, s.y, size, 0, .66);
      ctx.restore();
      if (!baseOk || !fillOk) {
        ctx.save();
        ctx.globalAlpha = .52;
        ctx.strokeStyle = s.kind === 'war_machine' ? '#ff5a4f' : '#7ff8ff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, vr + 20, -Math.PI / 2, -Math.PI / 2 + TAU * mergeProgress);
        ctx.stroke();
        ctx.globalAlpha = .26;
        ctx.strokeStyle = '#f4ffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, vr + 20, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
    if ((s.freezeTimer || 0) > 0) {
      if (typeof drawFrozenTargetOverlay === 'function') {
        drawFrozenTargetOverlay(ctx, s);
      } else {
        ctx.save();
        ctx.globalAlpha = .44 + .18 * Math.sin(performance.now() / 75);
        ctx.fillStyle = 'rgba(190,248,255,.55)';
        ctx.strokeStyle = '#f4ffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, vr * .82, vr * .68, Math.sin(performance.now() / 180) * .15, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    const hpPct = clamp(s.hp / Math.max(1, s.maxHp), 0, 1);
    ctx.save();
    if (!mineLike(s)) {
      const hasShield = (s.shield || 0) > 0;
      const shieldPct = hasShield ? clamp(s.shield / Math.max(1, s.maxShield || s.shield), 0, 1) : 0;
      ctx.fillStyle = 'rgba(0,0,0,.68)';
      ctx.fillRect(s.x - 38, s.y + vr + 8, 76, 9);
      ctx.fillStyle = hasShield ? '#f7fbff' : '#ffb33b';
      ctx.shadowColor = hasShield ? '#ffffff' : 'transparent';
      ctx.shadowBlur = hasShield ? 8 : 0;
      ctx.fillRect(s.x - 38, s.y + vr + 8, 76 * (hasShield ? shieldPct : hpPct), 9);
    }
    if (s.state === 'building') {
      ctx.strokeStyle = '#31f5ff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, vr + 17, -Math.PI/2, -Math.PI/2 + TAU * clamp(s.progress,0,1));
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawEngineerWorld(ctx) {
    if (gameState === 'PLAYING') {
      const frameKey = window.__apexRenderFrame || 0;
      if (engineerState.lastDrawWorldFrame === frameKey) return;
      engineerState.lastDrawWorldFrame = frameKey;
    }
    function drawMagnetBeam(x1, y1, x2, y2, alpha = .75, width = 24) {
      const len = dist(x1, y1, x2, y2);
      if (len < 8) return false;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#7ff8ff';
      ctx.shadowColor = '#31f5ff';
      ctx.shadowBlur = 14;
      ctx.lineWidth = Math.max(4, width * .26);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const beamKey = ready('magnetLineNew') ? 'magnetLineNew' : (ready('magnetBeamWide') ? 'magnetBeamWide' : 'magnetBeam');
      const ok = drawAssetRect(ctx, beamKey, (x1 + x2) / 2, (y1 + y2) / 2, len, width * 1.35, angle, Math.min(1, alpha * 1.15));
      drawAssetRect(ctx, beamKey, (x1 + x2) / 2, (y1 + y2) / 2, len, width * .72, angle, Math.min(1, alpha));
      ctx.restore();
      return ok;
    }
    for (const f of fighters || []) {
      if (!live(f) || f.name !== 'ENGINEER') continue;
      const d = ownerData(f);
      for (const merge of Object.values(d.mergeIds || {})) {
        for (const s of merge.ingredients || []) {
          if (s && !s.dead) drawMagnetBeam(s.x, s.y, merge.x, merge.y, .78, 48);
        }
      }
    }
    for (const s of allEngineerStructures()) drawStructure(ctx, s);
    for (const scrap of engineerState.scraps) {
      const a = clamp(scrap.life / scrap.maxLife, 0, 1);
      const glow = clamp(scrap.pullGlow / .16, 0, 1);
      ctx.save();
      ctx.globalAlpha = .65 + .25 * a;
      ctx.translate(scrap.x, scrap.y);
      ctx.rotate((scrap.angle || 0) + (scrap.spin || 0) * matchClock);
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      const variantScale = [1, .92, 1.08, .86, 1.16][scrap.variant || 0] || 1;
      const scrapKey = ready(scrap.assetKey) ? scrap.assetKey : (ready('scrapNew') ? 'scrapNew' : 'scrap');
      const scrapSize = 72 * (scrap.scale || 1) * variantScale;
      if (glow > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawAssetSquareTintMask(ctx, scrapKey, 0, 0, scrapSize * 1.22, 0, .18 + .22 * glow);
        drawAssetSquareTintMask(ctx, scrapKey, 0, 0, scrapSize * 1.05, 0, .22 + .28 * glow, [127, 248, 255]);
        ctx.restore();
      }
      if (!drawAssetSquare(ctx, scrapKey, 0, 0, 72 * (scrap.scale || 1) * variantScale, 0, 1)) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#b5b7af';
        ctx.strokeStyle = '#2d2d28';
        ctx.lineWidth = 2;
        ctx.fillRect(-14, -8, 28, 16);
        ctx.strokeRect(-14, -8, 28, 16);
      }
      ctx.restore();
    }
    for (const sh of engineerState.shots) {
      const angle = Math.atan2(sh.vy, sh.vx);
      if (sh.assetKey && (sh.kind === 'rocket' || sh.kind === 'war_machine')) drawAssetSquare(ctx, sh.assetKey, sh.x, sh.y, sh.radius*3.4, angle, .96);
      else if (sh.assetKey) drawAssetSquare(ctx, sh.assetKey, sh.x, sh.y, sh.radius*2.8, angle, .96);
      else {
        ctx.save(); ctx.fillStyle = '#31f5ff'; ctx.beginPath(); ctx.arc(sh.x, sh.y, sh.radius, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    for (const laser of engineerState.lasers) {
      const a = clamp(laser.life / laser.maxLife, 0, 1);
      for (const seg of laser.segments || []) {
        const len = dist(seg.x1, seg.y1, seg.x2, seg.y2);
        if (len < 2) continue;
        const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
        const cx = (seg.x1 + seg.x2) / 2;
        const cy = (seg.y1 + seg.y2) / 2;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.shadowColor = '#7ff8ff';
        ctx.shadowBlur = 22;
        const assetWidth = Math.max(28, (laser.width || 18) * 1.35);
        if (!drawAssetRect(ctx, 'warLaser', cx, cy, len, assetWidth, angle, .96 * a)) {
          ctx.strokeStyle = `rgba(170,255,255,${.82 * a})`;
          ctx.lineWidth = Math.max(5, (laser.width || 18) * .36);
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(230,255,255,${.32 * a})`;
        ctx.lineWidth = Math.max(3, (laser.width || 18) * .18);
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
        ctx.restore();
      }
    }
    for (const v of engineerState.vfx) {
      const a = clamp(v.life / v.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (v.type === 'explosion') {
        if (!drawAssetSquare(ctx, 'explosion', v.x, v.y, (v.radius || 120) * (1.25 - a*.2), 0, a)) {
          ctx.fillStyle = 'rgba(255,120,40,.45)';
          ctx.beginPath(); ctx.arc(v.x, v.y, (v.radius || 120) * (1-a*.35), 0, TAU); ctx.fill();
        }
      } else if (v.type === 'salvage') {
        // Pull feedback is handled by magnet beams and per-scrap tinted masks.
      } else if (v.type === 'smoke') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a * .32;
        ctx.fillStyle = 'rgba(185,205,210,.45)';
        ctx.beginPath(); ctx.ellipse(v.x, v.y - (1-a)*34, (v.radius || 22) * (1.1-a*.25), (v.radius || 22) * .62, v.rot || 0, 0, TAU); ctx.fill();
      } else if (v.type === 'merge' || v.type === 'warmerge') {
        ctx.globalAlpha = 1;
        const progress = clamp(1 - a, 0, 1);
        const resultKind = v.resultKind;
        if (resultKind) {
          const spec = UPGRADED[resultKind] || BASE[resultKind];
          const rv = visualRadiusForKind(resultKind, spec?.radius || 70);
          ctx.save();
          ctx.globalAlpha = .24;
          if (resultKind === 'heavy_turret') {
            drawAssetSquare(ctx, 'rocketBase', v.x, v.y, rv*2.0, 0, 1);
            drawAssetSquare(ctx, 'rocketReady', v.x, v.y, rv*2.25, 0, 1);
          } else if (resultKind === 'minefield_core') {
            drawAssetSquare(ctx, 'mineLv2', v.x, v.y, rv*2.45, 0, 1);
          } else if (resultKind === 'healing_nexus') {
            drawAssetSquare(ctx, 'repairLv2', v.x, v.y, rv*2.25, 0, 1);
          } else if (resultKind === 'mega_factory') {
            drawAssetSquare(ctx, 'megaFactory', v.x, v.y, rv*2.25, 0, 1);
          } else if (resultKind === 'war_machine') {
            drawAssetSquare(ctx, 'warBase', v.x, v.y, rv*2.34, 0, 1);
            drawAssetSquare(ctx, 'warGun', v.x, v.y, rv*2.42, 0, 1);
          }
          ctx.restore();
        }
        const size = (v.radius || 170) * 2.05;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const baseOk = drawAssetSquare(ctx, ready('upgradeRing0') ? 'upgradeRing0' : 'buildRing0', v.x, v.y, size, 0, .36);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.arc(v.x, v.y, size * .58, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
        ctx.closePath();
        ctx.clip();
        ctx.globalCompositeOperation = 'screen';
        const fillOk = drawAssetSquare(ctx, ready('upgradeRing100') ? 'upgradeRing100' : 'buildRing100', v.x, v.y, size, 0, .72);
        ctx.restore();
        if (!baseOk || !fillOk) {
          ctx.strokeStyle = v.type === 'warmerge' ? '#ff3030' : '#7ff8ff';
          ctx.lineWidth = v.type === 'warmerge' ? 10 : 7;
          ctx.beginPath(); ctx.arc(v.x, v.y, (v.radius || 150), -Math.PI / 2, -Math.PI / 2 + TAU * progress); ctx.stroke();
        }
      } else if (v.type === 'mergeFail') {
        ctx.globalAlpha = 1;
        if (!drawAssetSquare(ctx, 'explosion', v.x, v.y, (v.radius || 170) * 1.18, 0, 1)) {
          ctx.fillStyle = 'rgba(255,95,35,.58)';
          ctx.beginPath(); ctx.arc(v.x, v.y, v.radius || 170, 0, TAU); ctx.fill();
        }
      } else {
        ctx.strokeStyle = v.color || '#31f5ff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(v.x, v.y, (v.radius || 60) * (1.1 - a*.25), 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawEngineerFighter(ctx, f) {
    const d = ownerData(f);
    if (d.pilotingWarMachine) return;
    ctx.save();
    const moveAngle = Math.atan2(f.dir?.y || 0, f.dir?.x || 1);
    const e = enemyOf(f);
    const manualAim = f.data?.manualController?.active && f.data.manualController.mode === 'MANUAL_LAB'
      ? f.data.manualController.getAimPoint?.()
      : null;
    const faceAngle = manualAim && Number.isFinite(manualAim.x) && Number.isFinite(manualAim.y)
      ? Math.atan2(manualAim.y - f.y, manualAim.x - f.x)
      : e ? Math.atan2(e.y - f.y, e.x - f.x) : moveAngle;
    const angle = faceAngle - moveAngle + Math.PI*1.5;
    const glow = d.salvagePulse > 0 ? 22 : 8;
    ctx.shadowColor = d.salvagePulse > 0 ? '#31f5ff' : '#f0a020';
    ctx.shadowBlur = glow;
    if (!drawAssetSquare(ctx, 'main', 0, 0, f.radius * 3.75, angle, 1)) {
      drawPolygon(ctx,[[-54,-60],[42,-64],[68,22],[22,70],[-60,44]],'#2f2b24','#f0a020',5);
      ctx.fillStyle='#31f5ff'; ctx.beginPath(); ctx.arc(16,-18,11,0,TAU); ctx.fill();
    }
    const shield = f.data?.engineerVirtualShield;
    if (shield?.amount > 0) {
      const pulse = 1 + Math.sin(performance.now() / 130) * .035 + (shield.pulse || 0) * .08;
      const shieldKey = shield.source === 'rage' ? 'shieldRage' : 'shieldNexus';
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      drawAssetSquareKeyed(ctx, shieldKey, 0, 0, f.radius * 3.55 * pulse, angle, .62);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  const engineerType = {
    name:'ENGINEER',
    color:'#f0a020',
    desc:'Scrap economy, automatic construction and match-3 war machine',
    speed:405,
    startDx:1,
    startDy:.38,
    noRage:false,
    init:f => { const d = ownerData(f); d.rageShieldBucket = -1; },
    onRage:f => {
      const d = ownerData(f);
      d.rageShieldBucket = -1;
      applyEngineerRageShield(f, 'rage_start');
    },
    speedModifier:f => {
      const d = ownerData(f);
      if (d.pilotingWarMachine || (d.salvageLock || 0) > 0) return 0;
      const manualController = f.data?.manualController;
      const manualMove = manualController?.active && manualController.mode === 'MANUAL_LAB'
        ? clamp(manualController.moveMagnitude?.() || 0, 0, 1)
        : 1;
      return (currentConstruction(d) ? .72 : 1) * manualMove;
    },
    update:updateEngineerFighter,
    onCollide:() => false,
    draw:drawEngineerFighter
  };
  engineerState.type = engineerType;
  if (!FighterTypes.some(ft => ft.name === 'ENGINEER')) FighterTypes.push(engineerType);
  else Object.assign(FighterTypes.find(ft => ft.name === 'ENGINEER'), engineerType);
  SOUND_ID.ENGINEER = { base: 220, wave:'sine', bend:1, noise:0 };

  const oldGlyphEngineer = fighterGlyph;
  fighterGlyph = function(name) { return name === 'ENGINEER' ? 'ENG' : oldGlyphEngineer(name); };

  const oldDrawProjectilesEngineer = drawProjectiles;
  drawProjectiles = function(ctx) {
    oldDrawProjectilesEngineer(ctx);
    drawEngineerWorld(ctx);
  };
  const oldUpdateEngineer = update;
  update = function(dt) {
    const r = oldUpdateEngineer(dt);
    updateEngineerSystems(dt);
    return r;
  };

  const oldTakeDamageEngineerStructures = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source = null, label = '', statusDamage = false) {
    if (this?.name === 'ENGINEER' && source !== this) {
      const wm = pilotedWarMachineFor(this);
      if (wm) {
        damageStructure(wm, amount, source, label || 'war-machine-pilot-target', statusDamage ? .5 : 0);
        return 0;
      }
      amount = absorbEngineerVirtualShield(this, amount);
      if (amount <= 0) return 0;
    }
    const before = this.hp;
    const result = oldTakeDamageEngineerStructures.call(this, amount, source, label, statusDamage);
    const dealt = Math.max(0, before - this.hp);
    if (dealt > 0) structureSplashFromFighterHit(this, source, dealt, label, statusDamage);
    return result;
  };

  const oldStartSpecificEngineer = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts = {}) {
    for (const s of allEngineerStructures()) stopStructureLoops(s);
    engineerState.scraps.length = 0;
    engineerState.shots.length = 0;
    engineerState.lasers.length = 0;
    engineerState.vfx.length = 0;
    engineerState.lastSystemUpdateKey = null;
    return oldStartSpecificEngineer(ft1, ft2, opts);
  };

  if (typeof populateRoster === 'function' && typeof selectFighter === 'function' && typeof drawRosterPreview === 'function') {
    const oldPopulateEngineer = populateRoster;
    populateRoster = function() {
      const result = oldPopulateEngineer();
      const grid = document.getElementById('roster-grid');
      const activeText = document.querySelector('#roster-tabs button.active')?.textContent || '';
      const ft = fighterTypeByName('ENGINEER');
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
  }

  const oldInspectorRowsEngineer = typeof buildInspectorRows === 'function' ? buildInspectorRows : null;
  if (oldInspectorRowsEngineer) {
    buildInspectorRows = function(f) {
      if (f?.name !== 'ENGINEER') return oldInspectorRowsEngineer(f);
      const d = ownerData(f);
      const online = (d.structures || []).filter(s => s.state === 'online' && !s.dead).length;
      const building = currentConstruction(d);
      const merging = Object.values(d.mergeIds || {})[0];
      return [
        ['SCRAP', String(d.scrap || 0)],
        ['BUILD PLAN', (BASE[d.plan]?.label || d.plan || 'NONE').toUpperCase()],
        ['AUTO RESTOCK', (d.scrap || 0) < 3 ? `${Math.max(0, 10 - (d.lowScrapTimer || 0)).toFixed(1)}s` : 'READY'],
        ['STATUS', building ? `BUILD ${Math.round(building.progress * 100)}%` : merging ? `MERGE ${Math.max(0, merging.timer).toFixed(1)}s` : 'AUTO'],
        ['STRUCTURES', `${online} ONLINE / ${d.structures.length} TOTAL`],
        ['SALVAGE', d.salvageCd > 0 ? d.salvageCd.toFixed(1) + 's' : 'READY']
      ];
    };
  }

  Object.assign(engineerState, {
    updateSystems:updateEngineerSystems,
    drawWorld:drawEngineerWorld,
    targetForDirected:directedTargetForEngineerWarMachine,
    ownerData,
    allStructures:allEngineerStructures,
    damageStructure,
    fireWarMachineLaser,
    cancelMerge,
    structureFootprint,
    manualApi:Object.freeze({
      buildKinds:Object.freeze([...buildKinds]),
      baseSpecs:BASE,
      upgradedSpecs:UPGRADED,
      buildRange:100,
      placementStatus:manualPlacementStatus,
      commitBuildAt:commitManualBuild,
      setMagnetRequested:setManualMagnetRequested,
      mergeCandidateAt:manualMergeCandidate,
      requestMergeAt:requestManualMerge,
      requestAutoMerge:requestManualAutoMerge,
      warMachineStatus:manualWarMachineStatus,
      requestWarMachine:requestManualWarMachine,
      fireWarMachineLaser,
      drawStructure,
      structureVisualFootprint,
      structureFootprint
    }),
    clearMatch:() => {
      for (const s of allEngineerStructures()) stopStructureLoops(s);
      engineerState.scraps.length = 0;
      engineerState.shots.length = 0;
      engineerState.lasers.length = 0;
      engineerState.vfx.length = 0;
      engineerState.lastSystemUpdateKey = null;
    }
  });
  window.APEX_ENGINEER_READY = true;
  console.info('[Apex Chaos] ENGINEER champion integrated', { assets:Object.keys(FILES).length, spec:'scrap-build-merge-war-machine' });
})();
