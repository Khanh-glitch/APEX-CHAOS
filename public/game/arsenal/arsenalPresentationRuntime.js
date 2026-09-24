// ARSENAL QUEST — curated VFX/SFX presentation layer (AV_INTEGRATION_HANDOFF.md).
// ISOLATED presentation: no gameplay logic lives here. The weapon/spawn runtimes
// emit semantic cues through avCue(); this runtime turns them into preloaded
// image animations and bounded WebAudio playback on the EXISTING Apex audio
// graph (audioCtx / battleAudioMaster). No second engine, no engine fork.
(function apexArsenalPresentationRuntime() {
  if (window.apexArsenalPresentationRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL;
  const AV_ROOT = '/assets/arsenal/av/';
  const WEAPON_ROOT = '/assets/arsenal/weapons/';
  const WEAPON_ATLAS = {
    file: WEAPON_ROOT + 'arsenal_p0_weapon_atlas.png',
    cells: {
      PISTOL:       { x:0,   y:0,   box:{x:22,y:43,w:212,h:169} },
      SHOTGUN:      { x:256, y:0,   box:{x:22,y:97,w:212,h:61} },
      SMG:          { x:512, y:0,   box:{x:22,y:91,w:212,h:74} },
      SNIPER:       { x:768, y:0,   box:{x:22,y:87,w:212,h:81} },
      GRENADE:      { x:0,   y:256, box:{x:33,y:22,w:189,h:212} },
      SABRE:        { x:256, y:256, box:{x:108,y:22,w:40,h:212} },
      BATTLE_AXE:   { x:512, y:256, box:{x:97,y:22,w:62,h:212} },
      DAGGER:       { x:768, y:256, box:{x:102,y:22,w:51,h:212} },
      SPEAR:        { x:0,   y:512, box:{x:123,y:22,w:10,h:212} },
      SPIKED_CLUB:  { x:256, y:512, box:{x:115,y:22,w:25,h:212} },
      SWIRL_SHIELD: { x:512, y:512, box:{x:22,y:22,w:212,h:212} },
      TOWER_SHIELD: { x:768, y:512, box:{x:67,y:22,w:121,h:212} },
    },
  };

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
    floorSpriteDraws: 0,
    equippedSpriteDraws: 0,
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
      img.src = rel.startsWith('/') ? rel : AV_ROOT + rel;
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
    WEAPON_ATLAS.file, MUZZLE.sheet, ATLAS.file,
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
    stats.seqAnimsPushed = (stats.seqAnimsPushed || 0) + 1;
    pushVfx(Object.assign({ kind: 'seq', family }, o, { seq }));
  }

  // ---------------------------------------------------------------------------
  // Semantic cue dispatch — the only entry point used by gameplay runtimes.
  // ---------------------------------------------------------------------------
  function cue(name, o = {}) {
    pushRing(stats.cued, Object.assign({ event: name, x: Math.round(o.x || 0), y: Math.round(o.y || 0) }, o.weapon ? { weapon: o.weapon } : {}));
    switch (name) {
      case 'telegraph': {
        // Audio only: slash-family art must never decorate an unknown pickup.
        playAll('telegraph');
        break;
      }
      case 'reveal': {
        // Spawn runtime already supplies a neutral shockwave/particle pop.
        // Do not use slash-family art for reveal.
        playAll('reveal');
        break;
      }
      case 'pickup': {
        playAll('pickup');
        if (o.weapon === 'DAGGER') playAll('dagger_swing'); // draw-knife accent on equip
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
        // The weapon runtime owns the actual red aimline. Keep this cue audio-only.
        playAll('sniper_charge');
        break;
      }
      case 'sniper_shot': {
        playAll('sniper_shot');
        muzzle(o.x, o.y, o.angle, 2.0, [3, 2, 1], 0.18);
        break;
      }
      case 'grenade_throw': {
        // The grenade projectile itself communicates the throw; no slash trail.
        break;
      }
      case 'explosion': {
        playAll('explosion');
        stats.atlasCued = (stats.atlasCued || 0) + 1; // bomb explosion stays (V2 §A4)
        pushVfx({ kind: 'atlas', x: o.x, y: o.y, life: 64 / 34, fps: 34, size: 400 });
        break;
      }
      case 'melee_swing': {
        // V2 §A4: imported slash/swipe sequences are disabled in normal
        // gameplay. The weapon sprite's own motion communicates the attack;
        // swing SFX remain.
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
        // Equipped shield sprite is the persistent visual; activation is audio-only.
        playAll(o.weapon === 'TOWER_SHIELD' ? 'shield_activate_tower' : 'shield_activate_swirl');
        break;
      }
      case 'reflect': {
        // V2 §A4: no blue slash art on shield events; audio + the runtime's
        // native shockwave/particles already communicate the reflect.
        playAll('reflect');
        break;
      }
      case 'tower_block': {
        playAll(o.heavy ? 'block_heavy' : 'block_light');
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

  function drawWeaponSprite(ctx, weaponId, x, y, options = {}) {
    const meta = WEAPON_ATLAS.cells[weaponId];
    if (!meta) return false;
    const img = getImg(WEAPON_ATLAS.file);
    if (!img || !img.complete || !img.width) return false;

    const box = meta.box;
    const sx = meta.x + box.x;
    const sy = meta.y + box.y;
    const sw = box.w;
    const sh = box.h;
    const longSide = Math.max(sw, sh) || 1;
    const targetLongSide = options.targetLongSide || 120;
    const scale = targetLongSide / longSide;
    const dw = sw * scale;
    const dh = sh * scale;

    ctx.save();
    ctx.translate(x || 0, y || 0);
    if (options.angle) ctx.rotate(options.angle);
    ctx.globalAlpha *= options.alpha == null ? 1 : options.alpha;
    if (options.glow) {
      ctx.shadowColor = options.glow;
      ctx.shadowBlur = options.shadowBlur || 14;
    }
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    if (options.mode === 'equipped') stats.equippedSpriteDraws += 1;
    else stats.floorSpriteDraws += 1;
    return true;
  }

  // Shared per-weapon draw parameters (base pose, before Checkpoint B pose
  // state is applied). Melee/shield sprites are authored upright: their -Y
  // long axis is rotated onto the weapon aim direction.
  function weaponDrawParams(weaponId, category, radius) {
    let drawOffset = Math.PI / 2; // extra rotation for upright-authored sprites
    let targetLongSide = 138;
    let offset = radius * 0.72;
    if (category === 'melee') {
      targetLongSide = weaponId === 'SPEAR' ? 190 : weaponId === 'BATTLE_AXE' ? 155 : 145;
    } else if (category === 'defense') {
      targetLongSide = weaponId === 'TOWER_SHIELD' ? 145 : 128;
      offset = radius * 0.82;
    } else {
      drawOffset = 0;
      targetLongSide = weaponId === 'SNIPER' ? 185 : weaponId === 'SHOTGUN' ? 165 : 145;
      offset = radius * 0.78;
    }
    return { drawOffset, targetLongSide, offset };
  }

  // Checkpoint B (B-handoff PART 2): the weapon sprite transform consumes the
  // independent weaponPose state — recoil along aim, rotational kick, local
  // offsets, flourish spin, scale. The fighter body is never touched here.
  function drawWeaponWithPose(ctx, fighter, weaponId, category, aimAngle, pose, alpha) {
    const meta = WEAPON_ATLAS.cells[weaponId];
    if (!meta) return false;
    const params = weaponDrawParams(weaponId, category, fighter.radius || 75);
    const p = pose || {};
    const offset = params.offset + (p.localX || 0) - (p.recoil || 0);
    const lateral = p.localY || 0;
    const drawAngle = aimAngle + params.drawOffset + (p.rotKick || 0) + (p.flourish || 0);
    const x = fighter.x + Math.cos(aimAngle) * offset + Math.cos(aimAngle + Math.PI / 2) * lateral;
    const y = fighter.y + Math.sin(aimAngle) * offset + Math.sin(aimAngle + Math.PI / 2) * lateral;
    return drawWeaponSprite(ctx, weaponId, x, y, {
      mode: 'equipped',
      targetLongSide: params.targetLongSide * (p.scaleX || 1),
      angle: drawAngle,
      alpha: alpha == null ? 0.98 : alpha,
      glow: category === 'defense' ? '#9fe8ff' : null,
      shadowBlur: 10,
    });
  }

  function drawEquippedWeapon(ctx, fighter, holder) {
    if (!fighter || !holder || !holder.weaponId) return false;
    // V2 §A2: equipped weapons continuously face the opponent through the
    // independent aim angle — never through the fighter movement direction.
    const angle = (holder.meta && holder.meta.aimAngle != null)
      ? holder.meta.aimAngle
      : Math.atan2(fighter.dir?.y || 0, fighter.dir?.x || 1);
    return drawWeaponWithPose(ctx, fighter, holder.weaponId, holder.def?.category || '', angle, holder.meta && holder.meta.pose, 0.98);
  }

  // Pose ghost: the fading weapon sprite that carries the recoil settle /
  // throw / thrust-return motion for a beat after consume() (presentation only).
  function drawPoseGhost(ctx, fighter, ghost) {
    if (!fighter || !ghost || !ghost.weaponId) return false;
    const a = Math.max(0, Math.min(1, ghost.life / (ghost.maxLife || 0.38)));
    return drawWeaponWithPose(ctx, fighter, ghost.weaponId, ghost.category || '', ghost.aimAngle || 0, ghost.pose, 0.55 * a + 0.15);
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
    drawWeaponSprite,
    drawEquippedWeapon,
    drawPoseGhost,
    describe: () => ({
      root: AV_ROOT,
      weaponAtlas: WEAPON_ATLAS.file,
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
