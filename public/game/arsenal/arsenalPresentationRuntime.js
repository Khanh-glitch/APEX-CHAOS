// ARSENAL QUEST — curated VFX/SFX presentation layer (AV_INTEGRATION_HANDOFF.md).
// ISOLATED presentation: no gameplay logic lives here. The weapon/spawn runtimes
// emit semantic cues through avCue(); this runtime turns them into preloaded
// image animations and bounded WebAudio playback on the EXISTING Apex audio
// graph (audioCtx / battleAudioMaster). No second engine, no engine fork.
(function apexArsenalPresentationRuntime() {
  if (window.apexArsenalPresentationRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL;
  const AV_ROOT = '/assets/arsenal/av/';

  // ---------------------------------------------------------------------------
  // Asset tables — exact bindings from docs/arsenal-quest/AV_ASSET_MAP.csv.
  // ---------------------------------------------------------------------------
  const MUZZLE = { sheet: 'vfx/muzzle_flash/muzzleFlash0_transparent.png', frames: 4, fw: 128, fh: 128 };
  const ORANGE = (n) => `vfx/slash_orange_primary/Alternative_3_${String(n).padStart(2, '0')}.png`;
  const BLUE = (n) => `vfx/slash_blue_shield/Alternative_2_${String(n).padStart(2, '0')}.png`;
  const ATLAS = { file: 'vfx/explosion_pack_2/half/1.png', cell: 256, frames: 64 };

  // Trim windows measured from the source envelopes (onset analysis):
  // cz shot @0.14s, sks repeated shots from 0.34s, mosin crack @0.43s.
  const AUDIO = {
    telegraph: [{ rel: 'sfx/scifi/forceField_001.ogg', vol: 0.30, maxVoices: 2 }],
    reveal: [
      { rel: 'sfx/rpg/metalClick.ogg', vol: 0.55, maxVoices: 3 },
      { rel: 'sfx/impact/impactGeneric_light_002.ogg', vol: 0.18, maxVoices: 3 },
    ],
    pickup: [
      { rel: 'sfx/rpg/metalLatch.ogg', vol: 0.7, maxVoices: 3 },
      { rel: 'sfx/impact/impactGeneric_light_002.ogg', vol: 0.2, maxVoices: 3 },
    ],
    pistol_shot: [{ rel: 'sfx/guns/cz.wav', offset: 0.10, dur: 0.85, vol: 0.75, maxVoices: 4 }],
    shotgun_shot: [
      { rel: 'sfx/guns/shotty.wav', offset: 0.0, dur: 0.7, vol: 0.95, maxVoices: 2 },
      { rel: 'sfx/impact/impactPunch_heavy_001.ogg', vol: 0.25, maxVoices: 2 },
    ],
    smg_shot: [{ rel: 'sfx/guns/sks.wav', slices: [0.32, 2.27, 3.31, 5.98, 7.25, 9.69, 11.43, 12.70], dur: 0.24, vol: 0.5, maxVoices: 3 }],
    sniper_charge: [{ rel: 'sfx/scifi/laserLarge_003.ogg', vol: 0.28, maxVoices: 1 }],
    sniper_shot: [{ rel: 'sfx/guns/mosin.wav', offset: 0.40, dur: 1.7, vol: 0.95, maxVoices: 2 }],
    explosion: [
      { rel: 'sfx/scifi/explosionCrunch_002.ogg', vol: 0.9, maxVoices: 2 },
      { rel: 'sfx/scifi/lowFrequency_explosion_001.ogg', vol: 0.32, maxVoices: 2 },
    ],
    sabre_swing: [{ rel: 'sfx/rpg/knifeSlice.ogg', vol: 0.65, maxVoices: 3 }],
    axe_swing: [{ rel: 'sfx/rpg/chop.ogg', vol: 0.85, maxVoices: 3 }],
    dagger_swing: [
      { rel: 'sfx/rpg/knifeSlice2.ogg', vol: 0.6, maxVoices: 3 },
      { rel: 'sfx/rpg/drawKnife1.ogg', vol: 0.25, maxVoices: 2 },
    ],
    spear_swing: [{ rel: 'sfx/rpg/knifeSlice.ogg', vol: 0.55, maxVoices: 3 }],
    club_swing: [{ rel: 'sfx/rpg/chop.ogg', vol: 0.5, maxVoices: 3 }],
    hit_blade: [{ rel: 'sfx/impact/impactGeneric_light_002.ogg', vol: 0.5, maxVoices: 5 }],
    hit_thrust: [{ rel: 'sfx/impact/impactPunch_medium_001.ogg', vol: 0.6, maxVoices: 5 }],
    hit_heavy: [{ rel: 'sfx/impact/impactPunch_heavy_001.ogg', vol: 0.8, maxVoices: 5 }],
    shield_activate_swirl: [{ rel: 'sfx/scifi/forceField_003.ogg', vol: 0.5, maxVoices: 2 }],
    shield_activate_tower: [{ rel: 'sfx/scifi/forceField_003.ogg', vol: 0.28, maxVoices: 2 }],
    reflect: [
      { rel: 'sfx/scifi/impactMetal_002.ogg', vol: 0.85, maxVoices: 3 },
      { rel: 'sfx/impact/impactPlate_light_001.ogg', vol: 0.3, maxVoices: 3 },
    ],
    block_heavy: [{ rel: 'sfx/impact/impactPlate_heavy_001.ogg', vol: 0.8, maxVoices: 4 }],
    block_light: [{ rel: 'sfx/impact/impactPlate_light_001.ogg', vol: 0.5, maxVoices: 4 }],
  };

  // Per-weapon melee animation recipes over the curated families. Sequences
  // were chosen by inspecting the frames: 1-12 crescents, 13-18 faint trails,
  // 19-24 diagonal thrust streaks, 25-30 long energy blades.
  const MELEE_VFX = {
    SABRE: { seq: [2, 3, 4, 5, 6], scale: 1.25, life: 0.18, family: ORANGE, spin: 0.9 },
    BATTLE_AXE: { seq: [5, 4, 3, 2, 1], scale: 1.85, life: 0.42, family: ORANGE, spin: 1.35 },
    SPEAR: { seq: [19, 20, 21, 22, 23], scale: 1.45, life: 0.22, family: ORANGE, spin: 0 },
    SPIKED_CLUB: { seq: [14, 15, 16, 17, 18], scale: 1.55, life: 0.3, family: ORANGE, spin: 1.1 },
    DAGGER: { seq: [20, 21, 22], scale: 0.85, life: 0.14, family: ORANGE, spin: 0.25 },
  };

  // ---------------------------------------------------------------------------
  // Cache / stats plumbing.
  // ---------------------------------------------------------------------------
  const imageCache = new Map();
  const audioBuffers = new Map();
  const audioLoading = new Set();
  const audioFailed = new Set();
  const activeVoices = new Map();
  const vfx = [];
  const VFX_CAP = 240;
  let smgSliceCursor = 0;

  const stats = {
    cued: [],          // ring of {event, ...opts-lite} for runtime logs/tests
    scheduled: [],     // ring of every intended audio playback (even if skipped)
    throttled: {},     // per-reason throttle counters
    played: 0,
    imagesLoaded: 0,
    imagesFailed: 0,
    audioLoaded: 0,
    audioFailed: 0,
    vfxPeak: 0,
    vfxDropped: 0,
  };
  function pushRing(ring, entry, cap = 600) {
    ring.push(entry);
    if (ring.length > cap) ring.splice(0, ring.length - cap);
  }
  function avLog(event, fields) {
    const line = fields ? `[AQ-AV] ${event} ${fields}` : `[AQ-AV] ${event}`;
    console.log(line);
    if (AQ && AQ.events) { AQ.events.push(line); if (AQ.events.length > 160) AQ.events.splice(0, AQ.events.length - 160); }
    return line;
  }

  // ---------------------------------------------------------------------------
  // Preload — once per mode entry, never per frame / per shot.
  // ---------------------------------------------------------------------------
  function getImg(rel) {
    let img = imageCache.get(rel);
    if (!img) {
      img = new Image();
      img.onload = () => { stats.imagesLoaded += 1; };
      img.onerror = () => { stats.imagesFailed += 1; avLog('IMG_FAIL', `file=${rel}`); };
      img.src = AV_ROOT + rel;
      imageCache.set(rel, img);
    }
    return img;
  }
  function audioCtxOf() { return typeof audioCtx !== 'undefined' ? audioCtx : null; }
  function loadAudio(rel) {
    if (audioBuffers.has(rel) || audioLoading.has(rel) || audioFailed.has(rel)) return;
    const ctx = audioCtxOf();
    if (!ctx || typeof fetch !== 'function' || !ctx.decodeAudioData) return;
    audioLoading.add(rel);
    fetch(AV_ROOT + rel)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => { audioBuffers.set(rel, decoded); stats.audioLoaded += 1; })
      .catch(() => { audioFailed.add(rel); stats.audioFailed += 1; avLog('SFX_FAIL', `file=${rel}`); })
      .finally(() => audioLoading.delete(rel));
  }

  const ALL_IMAGES = [
    MUZZLE.sheet, ATLAS.file,
    ...Array.from({ length: 30 }, (_, i) => ORANGE(i + 1)),
    ...Array.from({ length: 30 }, (_, i) => BLUE(i + 1)),
  ];
  const ALL_AUDIO = Array.from(new Set(AUDIO ? Object.values(AUDIO).flat().map((a) => a.rel) : []));

  function preload() {
    for (const rel of ALL_IMAGES) getImg(rel);
    for (const rel of ALL_AUDIO) loadAudio(rel);
  }
  function clear() {
    vfx.length = 0;
    activeVoices.clear();
  }

  // ---------------------------------------------------------------------------
  // Audio playback — bounded polyphony on the existing Apex audio graph.
  // ---------------------------------------------------------------------------
  function playEntry(entry) {
    pushRing(stats.scheduled, { rel: entry.rel, offset: entry.offset || 0, dur: entry.dur || null, vol: entry.vol }, 900);
    const ctx = audioCtxOf();
    const buffer = audioBuffers.get(entry.rel);
    if (!ctx || !buffer) { stats.throttled.notReady = (stats.throttled.notReady || 0) + 1; return; }
    const active = activeVoices.get(entry.rel) || 0;
    const cap = entry.maxVoices || 4;
    if (active >= cap) { stats.throttled[entry.rel] = (stats.throttled[entry.rel] || 0) + 1; return; }
    let offset = entry.offset || 0;
    if (entry.slices) { offset = entry.slices[smgSliceCursor++ % entry.slices.length]; }
    const dur = entry.dur || Math.max(0.05, (buffer.duration || 1) - offset);
    // Reserve the voice (harness and browser share the cap accounting); release
    // when the clip would have ended.
    activeVoices.set(entry.rel, active + 1);
    const release = () => activeVoices.set(entry.rel, Math.max(0, (activeVoices.get(entry.rel) || 1) - 1));
    if (typeof setTimeout === 'function') setTimeout(release, Math.ceil(dur * 1000) + 40);
    if (window.__apexStatsSilent) return; // harness: intent + cap accounting recorded, no sound
    if (typeof ensureBattleAudioReady === 'function') ensureBattleAudioReady();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(entry.vol != null ? entry.vol : 0.7, ctx.currentTime);
    src.connect(gain);
    gain.connect(typeof battleAudioMaster !== 'undefined' ? battleAudioMaster : ctx.destination);
    src.onended = release;
    try {
      src.start(ctx.currentTime, offset, dur);
      stats.played += 1;
    } catch (error) {
      release();
    }
  }
  function playAll(listName) {
    const list = AUDIO[listName];
    if (!list) return;
    for (const entry of list) playEntry(entry);
  }

  // ---------------------------------------------------------------------------
  // VFX instances — pure value snapshots (no fighter refs retained).
  // ---------------------------------------------------------------------------
  function pushVfx(inst) {
    if (vfx.length >= VFX_CAP) { vfx.shift(); stats.vfxDropped += 1; }
    inst.t = 0;
    vfx.push(inst);
    stats.vfxPeak = Math.max(stats.vfxPeak, vfx.length);
  }

  function muzzle(x, y, angle, scale, frames, life) {
    pushVfx({ kind: 'muzzle', x, y, angle, scale, frames, life });
  }
  function seqAnim(family, seq, o) {
    pushVfx(Object.assign({ kind: 'seq', family }, o, { seq }));
  }

  // ---------------------------------------------------------------------------
  // Semantic cue dispatch — the only entry point used by gameplay runtimes.
  // ---------------------------------------------------------------------------
  function cue(name, o = {}) {
    pushRing(stats.cued, Object.assign({ event: name, x: Math.round(o.x || 0), y: Math.round(o.y || 0) }, o.weapon ? { weapon: o.weapon } : {}));
    switch (name) {
      case 'telegraph': {
        playAll('telegraph');
        // Neutral cool accent — identical for every slot, no identity hint.
        seqAnim(BLUE, [13, 14, 15, 16, 17, 18], { x: o.x, y: o.y, angle: Math.random() * TAU, scale: 0.8, life: 1.1, alpha: 0.3, spin: 1.6 });
        break;
      }
      case 'reveal': {
        playAll('reveal');
        seqAnim(BLUE, [3, 4, 5, 4, 3], { x: o.x, y: o.y, angle: Math.random() * TAU, scale: 1.0, life: 0.34, alpha: 0.75, spin: 2.2 });
        break;
      }
      case 'pickup': {
        playAll('pickup');
        if (o.weapon === 'DAGGER') playAll('dagger_swing'); // draw-knife accent on equip
        muzzle(o.x, o.y - 10, 0, 1.0, [3, 2], 0.16);
        break;
      }
      case 'fire': {
        const w = o.weapon;
        if (w === 'PISTOL') { playAll('pistol_shot'); muzzle(o.x, o.y, o.angle, 0.85, [0, 1], 0.1); }
        else if (w === 'SMG') { playAll('smg_shot'); muzzle(o.x, o.y, o.angle, 0.6, [smgSliceCursor % 2, (smgSliceCursor + 1) % 2], 0.07); }
        else if (w === 'SHOTGUN') { playAll('shotgun_shot'); muzzle(o.x, o.y, o.angle, 1.6, [3, 0, 1], 0.15); }
        break;
      }
      case 'sniper_aim': {
        playAll('sniper_charge');
        seqAnim(BLUE, [19, 20, 21], { x: o.x, y: o.y, angle: o.angle || 0, scale: 0.7, life: 0.7, alpha: 0.35, spin: 0 });
        break;
      }
      case 'sniper_shot': {
        playAll('sniper_shot');
        muzzle(o.x, o.y, o.angle, 2.0, [3, 2, 1], 0.18);
        break;
      }
      case 'grenade_throw': {
        seqAnim(ORANGE, [13, 14], { x: o.x, y: o.y, angle: o.angle || 0, scale: 0.7, life: 0.2, alpha: 0.5, spin: 0 });
        break;
      }
      case 'explosion': {
        playAll('explosion');
        pushVfx({ kind: 'atlas', x: o.x, y: o.y, life: 64 / 34, fps: 34, size: 400 });
        break;
      }
      case 'melee_swing': {
        const recipe = MELEE_VFX[o.weapon];
        if (!recipe) break;
        seqAnim(recipe.family, recipe.seq, { x: o.x, y: o.y, angle: o.angle || 0, scale: recipe.scale, life: recipe.life, alpha: 0.95, spin: recipe.spin });
        if (o.weapon === 'SABRE') playAll('sabre_swing');
        else if (o.weapon === 'BATTLE_AXE') playAll('axe_swing');
        else if (o.weapon === 'DAGGER') playAll('dagger_swing');
        else if (o.weapon === 'SPEAR') playAll('spear_swing');
        else if (o.weapon === 'SPIKED_CLUB') playAll('club_swing');
        break;
      }
      case 'melee_hit': {
        if (o.weapon === 'BATTLE_AXE' || o.weapon === 'SPIKED_CLUB') playAll('hit_heavy');
        else if (o.weapon === 'SPEAR') playAll('hit_thrust');
        else playAll('hit_blade');
        break;
      }
      case 'shield_activate': {
        playAll(o.weapon === 'TOWER_SHIELD' ? 'shield_activate_tower' : 'shield_activate_swirl');
        seqAnim(BLUE, [1, 2, 3, 4, 5, 6, 7, 8], { x: o.x, y: o.y, angle: 0, scale: 0.85, life: 0.6, alpha: 0.55, spin: 3.4 });
        break;
      }
      case 'reflect': {
        playAll('reflect');
        seqAnim(BLUE, [20, 21, 22, 23], { x: o.x, y: o.y, angle: o.angle || 0, scale: 0.9, life: 0.3, alpha: 0.95, spin: 0 });
        muzzle(o.x, o.y, (o.angle || 0) + Math.PI, 0.9, [3, 2], 0.14);
        break;
      }
      case 'tower_block': {
        playAll(o.heavy ? 'block_heavy' : 'block_light');
        seqAnim(BLUE, [8, 9, 10], { x: o.x, y: o.y, angle: o.angle || 0, scale: 0.9, life: 0.18, alpha: 0.8, spin: 0 });
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Tick / draw.
  // ---------------------------------------------------------------------------
  function tick(dt) {
    for (let i = vfx.length - 1; i >= 0; i--) {
      const v = vfx[i];
      v.t += dt;
      if (v.spin && v.angle !== undefined) v.angle += v.spin * dt;
      if (v.t >= v.life) vfx.splice(i, 1);
    }
  }

  function drawSeqFrame(ctx, v) {
    const n = v.seq.length;
    const idx = Math.min(n - 1, Math.floor((v.t / v.life) * n));
    const img = getImg(v.family(v.seq[idx]));
    if (!img || !img.complete || !img.width) return;
    const fade = Math.pow(Math.max(0, 1 - v.t / v.life), 0.8);
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle || 0);
    ctx.globalAlpha = (v.alpha != null ? v.alpha : 0.9) * fade;
    ctx.globalCompositeOperation = 'lighter';
    const s = (v.scale || 1) * 2.2;
    ctx.drawImage(img, (-75 * s) / 2 + 20, (-85 * s) / 2, 126 * s * 0.9, 150 * s * 0.9);
    ctx.restore();
  }

  function draw(ctx) {
    for (const v of vfx) {
      if (v.kind === 'muzzle') {
        const img = getImg(MUZZLE.sheet);
        if (!img || !img.complete || !img.width) continue;
        const n = v.frames.length;
        const idx = v.frames[Math.min(n - 1, Math.floor((v.t / v.life) * n))];
        const fade = 1 - v.t / v.life;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle || 0);
        ctx.globalAlpha = Math.min(1, 1.35 * fade + 0.2);
        ctx.globalCompositeOperation = 'lighter';
        const s = v.scale || 1;
        ctx.drawImage(img, idx * MUZZLE.fw, 0, MUZZLE.fw, MUZZLE.fh, -14 * s, -36 * s, 92 * s, 72 * s);
        ctx.restore();
      } else if (v.kind === 'seq') {
        drawSeqFrame(ctx, v);
      } else if (v.kind === 'atlas') {
        const img = getImg(ATLAS.file);
        if (!img || !img.complete || !img.width) continue;
        const frame = Math.min(ATLAS.frames - 1, Math.floor(v.t * v.fps));
        const sx = (frame % 8) * ATLAS.cell;
        const sy = Math.floor(frame / 8) * ATLAS.cell;
        const grow = 0.9 + 0.3 * Math.min(1, v.t * 2.6);
        const size = v.size * grow;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.globalAlpha = frame > 52 ? Math.max(0, 1 - (frame - 52) / 12) : 1;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, sx, sy, ATLAS.cell, ATLAS.cell, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }
  }

  window.APEX_ARSENAL_AV = {
    cue,
    tick,
    draw,
    preload,
    clear,
    stats,
    audioReady: () => stats.audioLoaded,
    imagesReady: () => stats.imagesLoaded,
    activeVfx: () => vfx.length,
    describe: () => ({
      root: AV_ROOT,
      muzzleSheet: MUZZLE.sheet,
      explosionAtlas: ATLAS.file,
      melee: Object.fromEntries(Object.entries(MELEE_VFX).map(([k, v]) => [k, v.seq.map((n) => v.family(n))])),
      audio: Object.fromEntries(Object.entries(AUDIO).map(([k, list]) => [k, list.map((a) => a.rel)])),
      allImages: ALL_IMAGES,
      allAudio: ALL_AUDIO,
    }),
  };
  window.apexArsenalPresentationRuntime = 'ready';
})();
