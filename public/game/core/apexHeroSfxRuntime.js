// APEX CHAOS — Curated Hero SFX wiring runtime for Crystala, Magnet, Frost, Mirror.
// Wires semantic gameplay events to pre-cut owner-curated audio clips.
// Robot and Hunter use their existing accepted production SFX and are NOT touched here.
//
// SFX law (authority §3):
// - semantic gameplay events only;
// - DEFAULT ON cues integrated first;
// - LOW ACCENT remains restrained;
// - OPTIONAL / OFF BY DEFAULT remains off;
// - respect rate limits;
// - no one-sound-per-render-tick;
// - keep ordinary firearm/body-hit/equip audio in shared global layer;
// - no second AudioContext.
(function apexHeroSfxRuntime() {
  if (window.apexHeroSfxRuntime === 'ready') return;
  if (typeof window === 'undefined') return;
  const audioCtx = window.audioCtx;
  const battleAudioMaster = window.battleAudioMaster;
  if (!audioCtx || !battleAudioMaster) return;

  // ── Asset paths ──────────────────────────────────────────────────
  const BASE = '/assets/hero-rework';
  const SFX = {
    // Crystala (DEFAULT ON only)
    CRYSTALA_AWAKEN:     `${BASE}/crystala-v6/sfx/crystala_a2_awaken.mp3`,
    CRYSTALA_REFLECT:    `${BASE}/crystala-v6/sfx/crystala_projectile_reflect.mp3`,
    CRYSTALA_WALL:       `${BASE}/crystala-v6/sfx/crystala_wall_construct.mp3`,
    // Crystala LOW ACCENT
    CRYSTALA_SHARD:      `${BASE}/crystala-v6/sfx/crystala_shard_pulse.mp3`,
    // Crystala OFF BY DEFAULT
    CRYSTALA_CONSTRUCT_HIT: `${BASE}/crystala-v6/sfx/crystala_construct_hit_optional.mp3`,

    // Magnet (DEFAULT ON)
    MAGNET_A1:           `${BASE}/magnet-v1/sfx/magnet_a1_attraction.mp3`,
    MAGNET_A2:           `${BASE}/magnet-v1/sfx/magnet_a2_repulsion.mp3`,
    MAGNET_DEFLECT:      `${BASE}/magnet-v1/sfx/magnet_a2_bullet_deflect.mp3`,

    // Frost (DEFAULT ON)
    FROST_BREATH:        `${BASE}/frost-v1/sfx/frost_a1_breath.mp3`,
    FROST_FREEZE:        `${BASE}/frost-v1/sfx/frost_enemy_freeze.mp3`,
    FROST_GUN_FREEZE:    `${BASE}/frost-v1/sfx/frost_weapon_freeze_a.mp3`,
    // Frost OFF BY DEFAULT
    FROST_FLOOR:         `${BASE}/frost-v1/sfx/frost_floor_contact_optional.mp3`,

    // Mirror (DEFAULT ON)
    MIRROR_A1:           `${BASE}/mirror-v1/sfx/mirror_a1_cast.mp3`,
    MIRROR_A2:           `${BASE}/mirror-v1/sfx/mirror_a2_exchange_snap.mp3`,
    MIRROR_NODE_FORM:    `${BASE}/mirror-v1/sfx/mirror_passive_node_form.mp3`,
    // Mirror LOW ACCENT — one per proc, never per shard
    MIRROR_SHARD_DROP_A: `${BASE}/mirror-v1/sfx/mirror_passive_shard_drop_a.mp3`,
    MIRROR_SHARD_DROP_B: `${BASE}/mirror-v1/sfx/mirror_passive_shard_drop_b.mp3`,
    MIRROR_SHARD_DROP_C: `${BASE}/mirror-v1/sfx/mirror_passive_shard_drop_c.mp3`,
    // Mirror OFF BY DEFAULT
    MIRROR_FOLD:         `${BASE}/mirror-v1/sfx/mirror_passive_node_fold_optional.mp3`,
  };

  // ── Decoded buffer cache ─────────────────────────────────────────
  const bufferCache = new Map();
  const pendingFetches = new Map();

  async function decodeBuffer(url) {
    if (bufferCache.has(url)) return bufferCache.get(url);
    if (pendingFetches.has(url)) return pendingFetches.get(url);
    const promise = (async () => {
      try {
        if (window.__apexStatsSilent) return null;
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`${res.status}`);
        const ab = await res.arrayBuffer();
        const buf = await audioCtx.decodeAudioData(ab);
        bufferCache.set(url, buf);
        return buf;
      } catch (e) {
        console.warn(`[hero-sfx] Failed to decode ${url}`, e);
        return null;
      } finally {
        pendingFetches.delete(url);
      }
    })();
    pendingFetches.set(url, promise);
    return promise;
  }

  // Pre-warm DEFAULT ON clips
  function preloadDefaultOn() {
    const defaults = [
      SFX.CRYSTALA_AWAKEN, SFX.CRYSTALA_REFLECT, SFX.CRYSTALA_WALL,
      SFX.MAGNET_A1, SFX.MAGNET_A2, SFX.MAGNET_DEFLECT,
      SFX.FROST_BREATH, SFX.FROST_FREEZE, SFX.FROST_GUN_FREEZE,
      SFX.MIRROR_A1, SFX.MIRROR_A2, SFX.MIRROR_NODE_FORM,
    ];
    for (const url of defaults) decodeBuffer(url);
  }

  // ── Voice limiter ────────────────────────────────────────────────
  const voiceCounters = new Map(); // url -> { count, lastAt }
  const MAX_VOICES_PER_URL = 2;
  const MIN_INTERVAL_MS = 80; // rate limit

  function canPlay(url, maxVoices = MAX_VOICES_PER_URL, minInterval = MIN_INTERVAL_MS) {
    const now = performance.now();
    const entry = voiceCounters.get(url) || { count: 0, lastAt: 0 };
    if (now - entry.lastAt < minInterval) return false;
    if (entry.count >= maxVoices) return false;
    entry.count++;
    entry.lastAt = now;
    voiceCounters.set(url, entry);
    // Decay counter
    setTimeout(() => { entry.count = Math.max(0, entry.count - 1); }, 300);
    return true;
  }

  // ── Play helper ──────────────────────────────────────────────────
  async function playClip(url, { volume = 0.5, maxVoices = 2, rateLimitMs = 80 } = {}) {
    if (window.__apexStatsSilent) return;
    if (!canPlay(url, maxVoices, rateLimitMs)) return;
    const buf = await decodeBuffer(url);
    if (!buf) return;
    try {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const gain = audioCtx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(battleAudioMaster);
      src.start();
      if (window.apexRegisterBattleAudioSource) window.apexRegisterBattleAudioSource(src);
    } catch (e) {}
  }

  // ── Semantic event wiring ────────────────────────────────────────
  function wireEvents() {
    const AIL = window.APEX_HERO_REWORK_AIL;
    if (!AIL || !AIL.bus) return;

    // ── CRYSTALA ─────────────────────────────────────────────────
    // A2 Awaken — DEFAULT ON
    AIL.bus.on('CrystalAwaken', () => {
      playClip(SFX.CRYSTALA_AWAKEN, { volume: 0.55 });
    });
    // Intercept/Refraction — DEFAULT ON, 90ms rate limit, max 2 voices
    AIL.bus.on('CrystalIntercept', () => {
      playClip(SFX.CRYSTALA_REFLECT, { volume: 0.45, maxVoices: 2, rateLimitMs: 90 });
    });
    // A1 Wall construct — DEFAULT ON
    AIL.bus.on('CrystalConstructCast', (e) => {
      if (e && e.kind === 'wall') playClip(SFX.CRYSTALA_WALL, { volume: 0.5 });
    });
    // Shard pulse — LOW ACCENT, restrained
    AIL.bus.on('CrystalReserve', () => {
      playClip(SFX.CRYSTALA_SHARD, { volume: 0.18, maxVoices: 1, rateLimitMs: 200 });
    });
    // Construct hit — OFF BY DEFAULT, not wired

    // ── MAGNET ───────────────────────────────────────────────────
    // A1 Attraction — DEFAULT ON, one-shot
    AIL.bus.on('MagnetA1Start', () => {
      playClip(SFX.MAGNET_A1, { volume: 0.5, maxVoices: 1, rateLimitMs: 150 });
    });
    // A2 Repulsion — DEFAULT ON, no loop
    AIL.bus.on('MagnetA2Start', () => {
      playClip(SFX.MAGNET_A2, { volume: 0.5, maxVoices: 1, rateLimitMs: 150 });
    });
    // A2 Bullet deflect — DEFAULT ON, 80-100ms rate limit, max 2 voices
    AIL.bus.on('MagnetA2Capture', () => {
      playClip(SFX.MAGNET_DEFLECT, { volume: 0.4, maxVoices: 2, rateLimitMs: 90 });
    });

    // ── FROST ────────────────────────────────────────────────────
    // A1 Breath — DEFAULT ON
    AIL.bus.on('FrostBreathCast', () => {
      playClip(SFX.FROST_BREATH, { volume: 0.5 });
    });
    // Gun freeze — DEFAULT ON, one per conversion
    AIL.bus.on('FrostSlotFrozen', () => {
      playClip(SFX.FROST_GUN_FREEZE, { volume: 0.4, maxVoices: 2 });
    });
    AIL.bus.on('FrostGunFrozen', () => {
      playClip(SFX.FROST_GUN_FREEZE, { volume: 0.4, maxVoices: 2 });
    });
    // Enemy freeze — DEFAULT ON; NEVER replay on FrostFreezeRefresh
    AIL.bus.on('FrostFreezeStart', () => {
      playClip(SFX.FROST_FREEZE, { volume: 0.5 });
    });
    // FrostFreezeRefresh is intentionally SILENT — do not replay freeze cue
    // Floor entry — OFF BY DEFAULT, not wired

    // ── MIRROR ───────────────────────────────────────────────────
    // A1 Cast — DEFAULT ON
    AIL.bus.on('MirrorA1Cast', () => {
      playClip(SFX.MIRROR_A1, { volume: 0.5 });
    });
    // A2 Exchange snap — DEFAULT ON at MirrorExchange, not at cast
    AIL.bus.on('MirrorExchange', () => {
      playClip(SFX.MIRROR_A2, { volume: 0.5 });
    });
    // Passive shard drop — LOW ACCENT, ONE sound per proc
    const shardVariants = [SFX.MIRROR_SHARD_DROP_A, SFX.MIRROR_SHARD_DROP_B, SFX.MIRROR_SHARD_DROP_C];
    let lastShardProc = 0;
    AIL.bus.on('MirrorShardProc', () => {
      const now = performance.now();
      if (now - lastShardProc < 200) return; // one per proc
      lastShardProc = now;
      const url = shardVariants[Math.floor(Math.random() * shardVariants.length)];
      playClip(url, { volume: 0.15, maxVoices: 1, rateLimitMs: 200 });
    });
    // Node form — DEFAULT ON, max one per Mirror
    AIL.bus.on('MirrorNodeForming', () => {
      playClip(SFX.MIRROR_NODE_FORM, { volume: 0.3, maxVoices: 1, rateLimitMs: 300 });
    });
    // Node fold — OFF BY DEFAULT, not wired
  }

  // ── Session lifecycle ────────────────────────────────────────────
  window.__apexHeroSfxPreload = preloadDefaultOn;
  window.__apexHeroSfxWire = wireEvents;

  // Auto-wire when battle audio session begins
  const origBeginSession = window.apexBeginBattleAudioSession;
  window.apexBeginBattleAudioSession = function patchedBeginSession() {
    preloadDefaultOn();
    wireEvents();
    if (typeof origBeginSession === 'function') origBeginSession.call(this);
  };

  window.apexHeroSfxRuntime = 'ready';
})();