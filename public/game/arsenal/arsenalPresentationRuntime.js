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
  // Checkpoint C: per-weapon authored set (generated manifest) replaces the
  // Checkpoint A/B collage atlas. Senko-reprocessed gun family + bespoke
  // melee/shield/grenade/casing, all in one flat-fill/outline language.
  const C_SET = window.APEX_ARSENAL_C_SET || { weapons: {}, muzzleFrames: [] };
  function weaponMeta(id) { return C_SET.weapons[id] || null; }
  function weaponAbs(meta) { return '/assets/arsenal/' + meta.file; }
  const MUZZLE_FRAMES = C_SET.muzzleFrames || []; // [{ file, w, h }] warm family
  const muzzleAbs = (f) => AV_ROOT + f.file;

  // ---------------------------------------------------------------------------
  // Asset tables — Checkpoint C bindings (AV_ASSET_MAP superseded for weapons).
  // POST-C §1 VFX transparency: smoke/spark are served from the BUILD-SANITIZED
  // copies under vfx/c/ (alpha keyed in tools/buildArsenalCAssets.mjs); the raw
  // kenney sources are 100%-opaque black-matte PNGs and must never be drawn
  // directly. The explosion atlas already carries real alpha.
  // ---------------------------------------------------------------------------
  const SMOKE = (n) => `vfx/c/smoke_${n}.png`;
  const SPARK = (n) => `vfx/c/spark_${n}.png`;
  const ATLAS = { file: 'vfx/explosion_pack_2/half/1.png', cell: 256, frames: 64 };

  // Trim windows measured from the source envelopes (onset analysis):
  // cz shot @0.14s, sks repeated shots from 0.34s, mosin crack @0.43s.
  const AUDIO = {
    telegraph: [{ rel: 'sfx/scifi/forceField_001.ogg', vol: 0.18, maxVoices: 2 }],
    reveal: [
      { rel: 'sfx/rpg/metalClick.ogg', vol: 0.35, maxVoices: 3 },
      { rel: 'sfx/impact/impactGeneric_light_002.ogg', vol: 0.12, maxVoices: 3 },
    ],
    pickup: [{ rel: 'sfx/rpg/metalLatch.ogg', vol: 0.42, maxVoices: 3 }],

    // Approved gun-fire baseline retained.
    pistol_shot: [{ rel: 'sfx/guns/cz.wav', offset: 0.10, dur: 0.85, vol: 0.75, maxVoices: 4 }],
    smg_shot: [{ rel: 'sfx/guns/sks.wav', slices: [0.32, 2.27, 3.31, 5.98, 7.25, 9.69, 11.43, 12.70], dur: 0.24, vol: 0.5, maxVoices: 3 }],
    shotgun_shot: [{ rel: 'sfx/guns/shotty.wav', offset: 0.0, dur: 0.7, vol: 0.95, maxVoices: 2 }],
    sniper_shot: [{ rel: 'sfx/guns/mosin.wav', offset: 0.40, dur: 1.7, vol: 0.95, maxVoices: 2 }],

    // Owner-approved C1 FINAL SFX LOCK.
    pistol_mech: [{ rel: 'sfx/c-final/PISTOL/pistol_mech_click.wav', vol: 0.50, maxVoices: 2 }],
    shotgun_rack_pull: [{ rel: 'sfx/c-final/SHOTGUN/shotgun_rack_pull.wav', vol: 0.71, maxVoices: 2 }],
    shotgun_rack_push: [{ rel: 'sfx/c-final/SHOTGUN/shotgun_rack_push.wav', vol: 0.71, maxVoices: 2 }],
    sniper_chamber: [{ rel: 'sfx/c-final/SNIPER/sniper_chamber.wav', vol: 0.63, maxVoices: 1 }],
    sniper_bolt_lock: [{ rel: 'sfx/c-final/SNIPER/sniper_bolt_lock.wav', vol: 0.50, maxVoices: 1 }],

    axe_swing: [{ rel: 'sfx/c-final/BATTLE_AXE/axe_motion.wav', vol: 0.63, maxVoices: 2 }],
    axe_hit: [
      { rel: 'sfx/c-final/BATTLE_AXE/axe_contact.wav', vol: 1.00, maxVoices: 3 },
      { rel: 'sfx/c-final/BATTLE_AXE/axe_body.wav', vol: 0.40, maxVoices: 3 },
    ],
    club_swing: [{ rel: 'sfx/c-final/SPIKED_CLUB/club_swing.wav', vol: 0.79, maxVoices: 2 }],
    club_hit: [{ rel: 'sfx/c-final/SPIKED_CLUB/club_body.wav', vol: 1.00, maxVoices: 3 }],
    dagger_swing: [{ rel: 'sfx/c-final/DAGGER/dagger_motion.wav', vol: 0.71, maxVoices: 3 }],
    dagger_hit: [{ rel: 'sfx/c-final/DAGGER/dagger_contact.wav', vol: 0.71, maxVoices: 3 }],
    sabre_swing: [{ rel: 'sfx/c-final/SABRE/sabre_motion.wav', vol: 0.63, maxVoices: 3 }],
    sabre_hit: [{ rel: 'sfx/c-final/SABRE/sabre_cut.wav', vol: 1.00, maxVoices: 3 }],
    spear_swing: [{ rel: 'sfx/c-final/SPEAR/spear_motion.wav', vol: 0.56, maxVoices: 3 }],
    spear_hit: [{ rel: 'sfx/c-final/SPEAR/spear_impact.wav', vol: 1.00, maxVoices: 3 }],
    swirl_block: [{ rel: 'sfx/c-final/SWIRL_SHIELD/swirl_shield_block.wav', vol: 1.00, maxVoices: 3 }],
    tower_block: [{ rel: 'sfx/c-final/TOWER_SHIELD/tower_shield_block.wav', vol: 1.00, maxVoices: 3 }],
    explosion: [
      { rel: 'sfx/c-final/GRENADE/grenade_core.wav', vol: 1.00, maxVoices: 2 },
      { rel: 'sfx/c-final/GRENADE/grenade_low.wav', vol: 0.40, maxVoices: 2 },
    ],
    casing_drop: [{ rel: 'sfx/impact/impactPlate_light_001.ogg', vol: 0.12, maxVoices: 2 }],

    // POST-C additions — reuse the approved baseline files ONLY (no new
    // audio sourcing): ricochet = plate tick, NEWBIE dash = force field
    // whoosh, NEWBIE fail = short metal click.
    ricochet: [{ rel: 'sfx/impact/impactPlate_light_001.ogg', vol: 0.34, maxVoices: 3 }],
    newbie_dash: [{ rel: 'sfx/scifi/forceField_001.ogg', vol: 0.30, maxVoices: 2 }],
    newbie_fail: [{ rel: 'sfx/rpg/metalClick.ogg', vol: 0.28, maxVoices: 2 }],
  };

  // Checkpoint C melee contact language: weapon-specific impact transients
  // (spark/shock), never imported slash sheets. The weapon body's own motion
  // carries the swing; contact reads through these small bounded transients.
  const MELEE_CONTACT = {
    SABRE: { spark: SPARK('05'), count: 6, speed: 420, life: 0.16, tint: '#dfe9f2' },
    BATTLE_AXE: { spark: SPARK('07'), count: 10, speed: 300, life: 0.24, tint: '#ffcf7a' },
    SPEAR: { spark: SPARK('05'), count: 5, speed: 520, life: 0.14, tint: '#e8f4d8' },
    SPIKED_CLUB: { spark: SPARK('07'), count: 8, speed: 260, life: 0.22, tint: '#e6c9ff' },
    DAGGER: { spark: SPARK('05'), count: 5, speed: 460, life: 0.12, tint: '#eef6ff' },
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
    seqAnimsPushed: 0,
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
    ...Object.values(C_SET.weapons).map((m) => weaponAbs(m)),
    ...MUZZLE_FRAMES.map((f) => muzzleAbs(f)),
    ATLAS.file,
    SMOKE('01'), SMOKE('03'), SPARK('05'), SPARK('07'),
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
    if (entry.playbackRate && src.playbackRate) {
      try { src.playbackRate.value = entry.playbackRate; } catch (e) {}
    }
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
  function playAll(listName, opts) {
    const list = AUDIO[listName];
    if (!list) return;
    for (const entry of list) {
      const e = (opts && (opts.rate || opts.vol != null))
        ? Object.assign({}, entry, {
            playbackRate: opts.rate || entry.playbackRate,
            vol: opts.vol != null ? opts.vol : entry.vol,
          })
        : entry;
      playEntry(e);
    }
  }
  function playLater(listName, delayMs) {
    if (typeof setTimeout !== 'function') return;
    setTimeout(() => playAll(listName), Math.max(0, delayMs | 0));
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

  function muzzle(x, y, angle, scale, frames, life, stretch) {
    pushVfx({ kind: 'muzzle', x, y, angle, scale, frames, life, stretch: stretch || 1 });
  }

  // ---------------------------------------------------------------------------
  // Semantic cue dispatch — the only entry point used by gameplay runtimes.
  // ---------------------------------------------------------------------------
  function cue(name, o = {}) {
    pushRing(stats.cued, Object.assign(
      { event: name, x: Math.round(o.x || 0), y: Math.round(o.y || 0) },
      o.weapon ? { weapon: o.weapon } : {},
      o.usedMeta ? { usedMeta: true } : {},
      o.vfx ? { vfx: o.vfx } : {},
      o.sfxRate ? { sfxRate: o.sfxRate } : {},
    ));
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
        if (o.weapon === 'PISTOL') playAll('pistol_mech');
        break;
      }
      case 'fire': {
        const w = o.weapon;
        const fam = o.family || (w === 'PISTOL' ? 'SEMI' : w === 'SMG' ? 'AUTO' : w === 'SHOTGUN' ? 'SHOTGUN' : 'SEMI');
        const sfx = o.sfx || { SEMI: 'pistol_shot', AUTO: 'smg_shot', BURST: 'smg_shot', SHOTGUN: 'shotgun_shot', AUTOSHOT: 'shotgun_shot', PRECISION: 'sniper_shot' }[fam];
        const recipes = (window.APEX_ARSENAL_CONFIG && window.APEX_ARSENAL_CONFIG.VFX_RECIPES) || {};
        const rec = recipes[o.vfx] || null;
        playAll(sfx, { rate: o.sfxRate || 1 });
        const scale = rec ? rec.scale : (fam === 'AUTO' ? 0.5 : fam === 'SHOTGUN' ? 1.5 : fam === 'AUTOSHOT' ? 1.15 : fam === 'BURST' ? 0.62 : 0.7);
        const stretch = rec ? rec.stretch : (fam === 'SHOTGUN' || fam === 'AUTOSHOT' ? 1.35 : 1);
        const frames = fam === 'AUTO' ? [2 + (smgSliceCursor % 2), 3] : (fam === 'SHOTGUN' || fam === 'AUTOSHOT') ? [4, 0] : fam === 'BURST' ? [0, 2] : [0, 1];
        muzzle(o.x, o.y, o.angle, scale, frames, rec ? 0.08 + (rec.smokeLife || 0) * 0.15 : 0.09, stretch);
        if (rec ? rec.smoke > 0.05 : (fam === 'SHOTGUN' || fam === 'AUTOSHOT')) {
          const smokeScale = rec ? (0.7 + rec.smoke * 0.6) : 1.1;
          pushVfx({ kind: 'smoke', x: o.x, y: o.y, angle: o.angle, scale: smokeScale, life: rec ? rec.smokeLife : 0.5, file: SMOKE('01') });
        }
        break;
      }
      case 'melee_throw': {
        // POST-C §5: the thrown sprite is the primary read; swing-family SFX
        // punctuates the release.
        if (o.weapon === 'SABRE') playAll('sabre_swing');
        else if (o.weapon === 'BATTLE_AXE') playAll('axe_swing');
        else if (o.weapon === 'DAGGER') playAll('dagger_swing');
        else if (o.weapon === 'SPEAR') playAll('spear_swing');
        else if (o.weapon === 'SPIKED_CLUB') playAll('club_swing');
        break;
      }
      case 'ricochet': {
        // Readable wall bounce: small metal tick + the runtime spark particles.
        playAll('ricochet');
        break;
      }
      case 'newbie_dash': {
        playAll('newbie_dash');
        break;
      }
      case 'newbie_fail': {
        // Deliberate no-pickup rejection: short dry click, cooldown untouched.
        playAll('newbie_fail');
        break;
      }
      case 'casing': {
        pushVfx({ kind: 'casing', x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || -120, rot: o.rot || 0, vrot: o.vrot || 11, life: 0.9 });
        playAll('casing_drop');
        break;
      }
      case 'sniper_aim': {
        // Owner-approved mechanical chamber gesture; no sci-fi charge.
        playAll('sniper_chamber');
        break;
      }
      case 'sniper_bolt_lock': {
        playAll('sniper_bolt_lock');
        break;
      }
      case 'shotgun_rack': {
        playAll('shotgun_rack_pull');
        playLater('shotgun_rack_push', 170);
        break;
      }
      case 'sniper_shot': {
        playAll('sniper_shot');
        // Long stretched transient — the near-hitscan punctuation (C §5.3).
        muzzle(o.x, o.y, o.angle, 1.9, [5, 4], 0.16, 2.1);
        pushVfx({ kind: 'smoke', x: o.x, y: o.y, angle: o.angle, scale: 0.9, life: 0.55, file: SMOKE('03') });
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
        if (o.weapon === 'BATTLE_AXE') playAll('axe_hit');
        else if (o.weapon === 'SPIKED_CLUB') playAll('club_hit');
        else if (o.weapon === 'SPEAR') playAll('spear_hit');
        else if (o.weapon === 'SABRE') playAll('sabre_hit');
        else if (o.weapon === 'DAGGER') playAll('dagger_hit');
        const contact = MELEE_CONTACT[o.weapon];
        if (contact) pushVfx({ kind: 'contact', x: o.x, y: o.y, angle: o.angle != null ? o.angle : Math.random() * 6.28, conf: contact, life: contact.life });
        break;
      }
      case 'shield_activate': {
        // Final-lock shield identity is reserved for actual contact.
        break;
      }
      case 'reflect': {
        // V2 §A4: no blue slash art on shield events; audio + the runtime's
        // native shockwave/particles already communicate the reflect.
        playAll('swirl_block');
        break;
      }
      case 'tower_block': {
        playAll('tower_block');
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
      if (v.kind === 'casing') {
        // Bounded brass physics: arc, spin, fall, settle.
        if (v.floorY == null) v.floorY = v.y + 46;
        v.vy += 1500 * dt;
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        v.rot += v.vrot * dt;
        if (v.vy > 0 && v.y > v.floorY) { v.y = v.floorY; v.vy *= -0.3; v.vx *= 0.6; v.vrot *= 0.5; }
      }
      if (v.t >= v.life) vfx.splice(i, 1);
    }
  }

  // Checkpoint C sprite draw: per-weapon authored PNG. Guns are authored
  // muzzle-right; when the aim faces left the sprite is mirrored across its
  // own axis so the weapon never renders upside-down.
  function drawWeaponSprite(ctx, weaponId, x, y, options = {}) {
    const meta = weaponMeta(weaponId);
    if (!meta) return false;
    const img = getImg(weaponAbs(meta));
    if (!img || !img.complete || !img.width) return false;

    const longSide = Math.max(meta.w, meta.h) || 1;
    const scale = (options.targetLongSide || 120) / longSide;
    const dw = meta.w * scale;
    const dh = meta.h * scale;

    ctx.save();
    ctx.translate(x || 0, y || 0);
    if (options.angle) ctx.rotate(options.angle);
    if (options.keepUpright && Math.cos(options.angle || 0) < 0) ctx.scale(1, -1);
    ctx.globalAlpha *= options.alpha == null ? 1 : options.alpha;
    if (options.glow) {
      ctx.shadowColor = options.glow;
      ctx.shadowBlur = options.shadowBlur || 14;
    }
    ctx.drawImage(img, 0, 0, meta.w, meta.h, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    if (options.mode === 'equipped') stats.equippedSpriteDraws += 1;
    else stats.floorSpriteDraws += 1;
    return true;
  }
  function weaponImage(weaponId) {
    const meta = weaponMeta(weaponId);
    if (!meta) return null;
    const img = getImg(weaponAbs(meta));
    return (img && img.complete && img.width) ? { img, w: meta.w, h: meta.h } : null;
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
      const meta = weaponMeta(weaponId);
      const cfgLong = (window.APEX_ARSENAL_CONFIG && window.APEX_ARSENAL_CONFIG.WEAPONS[weaponId]
        && window.APEX_ARSENAL_CONFIG.WEAPONS[weaponId].longSide) || 0;
      targetLongSide = cfgLong || (weaponId === 'SNIPER' ? 185 : weaponId === 'SHOTGUN' ? 165
        : weaponId === 'GRENADE' ? 62 : 145);
      offset = radius * 0.78;
    }
    return { drawOffset, targetLongSide, offset };
  }

  // Checkpoint B (B-handoff PART 2): the weapon sprite transform consumes the
  // independent weaponPose state — recoil along aim, rotational kick, local
  // offsets, flourish spin, scale. The fighter body is never touched here.
  function drawWeaponWithPose(ctx, fighter, weaponId, category, aimAngle, pose, alpha) {
    if (!weaponMeta(weaponId)) return false;
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
      keepUpright: category === 'ranged' && weaponId !== 'GRENADE',
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

  // Pose ghost (Checkpoint C §3.2): the consumed weapon exits PHYSICALLY —
  // drop / rotation / shield retract driven by advancePoseGhost — and alpha is
  // used only in the final ~15% of that already-physical exit.
  function drawPoseGhost(ctx, fighter, ghost) {
    if (!fighter || !ghost || !ghost.weaponId) return false;
    const u = Math.max(0, Math.min(1, ghost.t / (ghost.maxLife || 0.38)));
    const alpha = u < 0.85 ? 0.95 : Math.max(0, 0.95 * (1 - (u - 0.85) / 0.15));
    ctx.save();
    ctx.translate(0, ghost.drop || 0);
    const ok = drawWeaponWithPose(ctx, fighter, ghost.weaponId, ghost.category || '', ghost.aimAngle || 0, ghost.pose, alpha);
    ctx.restore();
    return ok;
  }

  function draw(ctx) {
    for (const v of vfx) {
      if (v.kind === 'muzzle') {
        const n = v.frames.length;
        const frame = MUZZLE_FRAMES[v.frames[Math.min(n - 1, Math.floor((v.t / v.life) * n))]];
        const img = frame ? getImg(muzzleAbs(frame)) : null;
        if (!img || !img.complete || !img.width) continue;
        const fade = 1 - v.t / v.life;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle || 0);
        ctx.globalAlpha = Math.min(1, 1.35 * fade + 0.2);
        ctx.globalCompositeOperation = 'lighter';
        const s = v.scale || 1;
        const st = v.stretch || 1;
        // Authored muzzle-right; anchor just behind the flash base.
        ctx.drawImage(img, 0, 0, frame.w, frame.h, -16 * s, -38 * s, 96 * s * st, 76 * s);
        ctx.restore();
      } else if (v.kind === 'smoke') {
        const img = getImg(v.file);
        if (!img || !img.complete || !img.width) continue;
        const u = v.t / v.life;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle || 0);
        ctx.globalAlpha = 0.22 * (1 - u);
        const s = (v.scale || 1) * (1 + u * 1.6);
        ctx.drawImage(img, -32 * s, -32 * s, 64 * s, 64 * s);
        ctx.restore();
      } else if (v.kind === 'contact') {
        // Melee contact transient: additive spark + short streaks (C §5.4).
        const c = v.conf;
        const img = getImg(c.spark);
        const u = v.t / v.life;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.globalCompositeOperation = 'lighter';
        if (img && img.complete && img.width) {
          ctx.save();
          ctx.rotate(v.angle || 0);
          ctx.globalAlpha = 0.8 * (1 - u);
          const s = 0.7 + u * 0.5;
          ctx.drawImage(img, -24 * s, -24 * s, 48 * s, 48 * s);
          ctx.restore();
        }
        ctx.globalAlpha = 0.7 * (1 - u);
        ctx.strokeStyle = c.tint;
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          const a = (v.angle || 0) + (i - 1.5) * 0.5;
          const r0 = 6 + u * c.speed * 0.16;
          const r1 = r0 + 14 * (1 - u) + 6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.restore();
      } else if (v.kind === 'casing') {
        const w = weaponImage('CASING');
        if (!w) continue;
        const u = v.t / v.life;
        const alpha = u < 0.85 ? 1 : Math.max(0, 1 - (u - 0.85) / 0.15);
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.rot);
        ctx.globalAlpha = alpha;
        const s = 0.9;
        ctx.drawImage(w.img, 0, 0, w.w, w.h, -14 * s, -7 * s, 28 * s, 14 * s);
        ctx.restore();
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
    weaponImage,
    weaponMeta,
      describe: () => ({
      root: AV_ROOT,
      weaponSet: Object.fromEntries(Object.entries(C_SET.weapons).map(([k, m]) => [k, m.file])),
      muzzleFrames: MUZZLE_FRAMES.map((f) => f.file),
      explosionAtlas: ATLAS.file,
      melee: Object.fromEntries(Object.entries(MELEE_CONTACT).map(([k, v]) => [k, v.spark])),
      audio: Object.fromEntries(Object.entries(AUDIO).map(([k, list]) => [k, list.map((a) => a.rel)])),
      allImages: ALL_IMAGES,
      allAudio: ALL_AUDIO,
    }),
  };
  window.apexArsenalPresentationRuntime = 'ready';
})();
