// APEX CHAOS — CORE SIX hero SFX semantic authority (AV preload, 2026-10-04).
//
// Authority: docs/gold-ui/preload/APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip
//   heroes/<HERO>/INTEGRATION_MAP.md and heroes/<HERO>/SFX/SOURCE_CUT_AUTHORITY.md
//
// LAW
//   REAL GAMEPLAY TRUTH -> THIN SEMANTIC ADAPTER -> ACCEPTED AV ENGINE
//
// The accepted engine is the EXISTING `APEX_ARSENAL_AV.playHeroSfx` seam, which
// reuses the same audio bank, AudioContext, session lifecycle, timer tracking
// and voice-cap accounting as Robot/Hunter. This runtime forks nothing: it only
// maps semantic gameplay events onto pre-cut clips and enforces each pack's
// anti-noise rules.
//
// MIX POLICY IS BINDING. `DEFAULT ON` cues are wired. `LOW ACCENT` cues stay
// restrained. `OFF BY DEFAULT` and `SILENT` beats stay unwired — the presence
// of a file is never a reason to play it.
//
// Triggers come from the semantic event seam only, never from render frames or
// simulation ticks, and compatibility/alias events for one semantic action
// still produce only ONE audible cue.

(function apexCoreSixHeroSfxRuntime(globalScope) {
  'use strict';
  if (!globalScope) return;
  if (globalScope.APEX_CORE_SIX_SFX) return;

  const MIX = Object.freeze({
    DEFAULT_ON: 'DEFAULT_ON',
    LOW_ACCENT: 'LOW_ACCENT',
    OFF_BY_DEFAULT: 'OFF_BY_DEFAULT',
    SILENT: 'SILENT',
  });

  const CRYSTALA = '/assets/hero-rework/crystala-v1/sfx/';
  const MAGNET = '/assets/hero-rework/magnet-v1/sfx/';
  const FROST = '/assets/hero-rework/frost-v1/sfx/';
  const MIRROR = '/assets/hero-rework/mirror-v1/sfx/';

  // ── Semantic event -> clip table ───────────────────────────────────────────
  // `rateLimitMs` is the pack's stated anti-noise floor. `maxVoices` is the
  // pack's stated overlapping-voice ceiling. `slice` selects one take when a
  // source holds several separated regions.
  const POLICY = Object.freeze({
    // -- CRYSTALA: a few precise crystal/material beats, not a chime machine --
    CrystalAwaken: Object.freeze({
      hero: 'CRYSTALA', mix: MIX.DEFAULT_ON, event: 'A2_AWAKEN',
      clip: CRYSTALA + 'crystala_a2_awaken.mp3', vol: 0.55, maxVoices: 1,
    }),
    // One interception = ONE audible reflect. The paired CrystalReflect alias
    // event for the same interception must never add a second cue.
    CrystalIntercept: Object.freeze({
      hero: 'CRYSTALA', mix: MIX.DEFAULT_ON, event: 'INTERCEPT_REFRACTION',
      clip: CRYSTALA + 'crystala_projectile_reflect.mp3', vol: 0.34,
      rateLimitMs: 90, maxVoices: 2,
    }),
    // Material-growth body of the Wall. Prison stays SILENT: never reuse the
    // Wall sound on a different construct identity.
    CrystalConstructCast: Object.freeze({
      hero: 'CRYSTALA', mix: MIX.DEFAULT_ON, event: 'A1_WALL_GROW',
      clip: CRYSTALA + 'crystala_wall_construct.mp3', vol: 0.45, maxVoices: 1,
      // Only kind === 'wall' is audible in the first mix.
      when: (payload) => String(payload && payload.kind).toLowerCase() === 'wall',
    }),
    // Two authored Wall shards read as two quiet micro-cuts, never a long
    // overlapping chord from full source plays.
    CrystalConstructCastShards: Object.freeze({
      hero: 'CRYSTALA', mix: MIX.LOW_ACCENT, event: 'A1_WALL_GROW_SHARD_ACCENT',
      clip: CRYSTALA + 'crystala_shard_pulse.mp3', vol: 0.22, maxVoices: 2,
      when: (payload) => String(payload && payload.kind).toLowerCase() === 'wall',
    }),
    // OFF BY DEFAULT: byte-identical sonic fingerprint to Mirror's glass snap,
    // so it must not become a prominent Crystala identity cue.
    CrystalConstructHit: Object.freeze({
      hero: 'CRYSTALA', mix: MIX.OFF_BY_DEFAULT, event: 'WALL_HIT_CRACK',
      clip: CRYSTALA + 'optional/crystala_construct_hit_optional.mp3',
      vol: 0.2, rateLimitMs: 140, maxVoices: 1, enabled: false,
    }),
    // SILENT beats — declared so the silence is auditable, not accidental.
    CrystalRelease: Object.freeze({ hero: 'CRYSTALA', mix: MIX.SILENT, event: 'RELEASE_RECOIL_RETURN' }),
    CrystalDock: Object.freeze({ hero: 'CRYSTALA', mix: MIX.SILENT, event: 'RELEASE_RECOIL_RETURN' }),
    CrystalReflect: Object.freeze({ hero: 'CRYSTALA', mix: MIX.SILENT, event: 'INTERCEPT_ALIAS' }),
    CrystalConstructBreak: Object.freeze({ hero: 'CRYSTALA', mix: MIX.SILENT, event: 'WALL_BREAK_COLLAPSE' }),
    // LOW ACCENT / OPTIONAL: the six-shard count read. Stays off while
    // crystala_a2_awaken already reads clearly in OWNER playtest.
    CrystalReserve: Object.freeze({
      hero: 'CRYSTALA', mix: MIX.OFF_BY_DEFAULT, event: 'SHARD_RESERVE_OUTBOUND',
      clip: CRYSTALA + 'crystala_shard_pulse.mp3', vol: 0.18, maxVoices: 1, enabled: false,
    }),

    // -- MAGNET: readable without turning the arena into constant ambience ----
    MagnetA1Start: Object.freeze({
      hero: 'MAGNET', mix: MIX.DEFAULT_ON, event: 'A1_ATTRACTION',
      clip: MAGNET + 'magnet_a1_attraction.mp3', vol: 0.5, maxVoices: 1,
    }),
    // One-shot; never looped across the whole 1.80 s field.
    MagnetA2Start: Object.freeze({
      hero: 'MAGNET', mix: MIX.DEFAULT_ON, event: 'A2_REPULSION',
      clip: MAGNET + 'magnet_a2_repulsion.mp3', vol: 0.5, maxVoices: 1,
    }),
    // The pre-cut whizz/redirection portion only: no wall-impact transient and
    // never one sound per tick.
    MagnetA2BulletDeflect: Object.freeze({
      hero: 'MAGNET', mix: MIX.DEFAULT_ON, event: 'A2_BULLET_DEFLECT',
      clip: MAGNET + 'magnet_a2_bullet_deflect.mp3', vol: 0.3,
      rateLimitMs: 90, maxVoices: 2,
      attack: 0.005, fadeTail: 0.02,
    }),
    // No gun-by-gun pull sound, no field hum, no per-tick sound.
    MagnetPassiveEmission: Object.freeze({ hero: 'MAGNET', mix: MIX.SILENT, event: 'PASSIVE_ACCELERATION' }),

    // -- FROST: A1 breath, freeze conversion and enemy freeze only ------------
    FrostBreathCast: Object.freeze({
      hero: 'FROST', mix: MIX.DEFAULT_ON, event: 'A1_CHARGE_RELEASE',
      clip: FROST + 'frost_a1_breath.mp3', vol: 0.55, maxVoices: 1,
      attack: 0.008, fadeTail: 0.045,
    }),
    // Variant A is the safest default. One voice per semantic conversion.
    FrostSlotFrozen: Object.freeze({
      hero: 'FROST', mix: MIX.DEFAULT_ON, event: 'GUN_FREEZE',
      clip: FROST + 'frost_weapon_freeze_a.mp3', vol: 0.36, maxVoices: 2,
    }),
    FrostGunFrozen: Object.freeze({
      hero: 'FROST', mix: MIX.DEFAULT_ON, event: 'GUN_FREEZE',
      clip: FROST + 'frost_weapon_freeze_a.mp3', vol: 0.36, maxVoices: 2,
    }),
    FrostFreezeStart: Object.freeze({
      hero: 'FROST', mix: MIX.DEFAULT_ON, event: 'ENEMY_FREEZE',
      clip: FROST + 'frost_enemy_freeze.mp3', vol: 0.45, maxVoices: 2,
      fadeTail: 0.04,
    }),
    // HARD RULE: a refresh extends an already readable freeze. Replaying the
    // full cue per refresh would reward rapid Frozen Bullet hits with clutter.
    FrostFreezeRefresh: Object.freeze({ hero: 'FROST', mix: MIX.SILENT, event: 'ENEMY_FREEZE_REFRESH' }),
    FrostFloorContact: Object.freeze({
      hero: 'FROST', mix: MIX.OFF_BY_DEFAULT, event: 'FLOOR_ENTRY',
      clip: FROST + 'optional/frost_floor_contact_optional.mp3',
      vol: 0.2, rateLimitMs: 250, maxVoices: 1, enabled: false,
    }),

    // -- MIRROR: one sound per semantic transformation ------------------------
    MirrorA1Cast: Object.freeze({
      hero: 'MIRROR', mix: MIX.DEFAULT_ON, event: 'A1_REFLECTION_PEEL',
      clip: MIRROR + 'mirror_a1_cast.mp3', vol: 0.5, maxVoices: 1,
    }),
    // A1 OWN accent stays off: the cast cue already carries the transformation.
    MirrorA1Own: Object.freeze({
      hero: 'MIRROR', mix: MIX.OFF_BY_DEFAULT, event: 'A1_OWN_EDGE',
      clip: MIRROR + 'mirror_a2_exchange_snap.mp3', vol: 0.2, maxVoices: 1, enabled: false,
    }),
    // The snap belongs at the ATOMIC EXCHANGE, not at cast.
    MirrorExchange: Object.freeze({
      hero: 'MIRROR', mix: MIX.DEFAULT_ON, event: 'A2_PRE_SNAP_EXCHANGE',
      clip: MIRROR + 'mirror_a2_exchange_snap.mp3', vol: 0.45, maxVoices: 1,
    }),
    MirrorA2Cast: Object.freeze({ hero: 'MIRROR', mix: MIX.SILENT, event: 'A2_CAST_PRE_SNAP' }),
    // ONE drop accent per realized proc even when several shards are created.
    MirrorPassiveShardProc: Object.freeze({
      hero: 'MIRROR', mix: MIX.LOW_ACCENT, event: 'PASSIVE_SHARD_DROP',
      clip: MIRROR + 'mirror_passive_shard_drop_a.mp3', vol: 0.24,
      rateLimitMs: 100, maxVoices: 1,
    }),
    // Single formation-to-lock sound; no second full-volume lock at NodeActive.
    MirrorNodeForming: Object.freeze({
      hero: 'MIRROR', mix: MIX.DEFAULT_ON, event: 'PASSIVE_NODE_FORM',
      clip: MIRROR + 'mirror_passive_node_form.mp3', vol: 0.3, maxVoices: 1,
    }),
    MirrorNodeActive: Object.freeze({ hero: 'MIRROR', mix: MIX.SILENT, event: 'PASSIVE_NODE_ACTIVE' }),
    // No fold-START seam exists (only NodeOff at the END), so this stays off
    // rather than playing late just to use the file.
    MirrorNodeOff: Object.freeze({
      hero: 'MIRROR', mix: MIX.OFF_BY_DEFAULT, event: 'PASSIVE_NODE_FOLD',
      clip: MIRROR + 'optional/mirror_passive_node_fold_optional.mp3',
      vol: 0.2, maxVoices: 1, enabled: false,
    }),
    MirrorRouteCapture: Object.freeze({ hero: 'MIRROR', mix: MIX.SILENT, event: 'PROJECTILE_CAPTURE' }),
    MirrorRouteEmerge: Object.freeze({ hero: 'MIRROR', mix: MIX.SILENT, event: 'PROJECTILE_EMERGE' }),
    MirrorEscrowImage: Object.freeze({ hero: 'MIRROR', mix: MIX.SILENT, event: 'DESTINATION_IMAGE' }),
    MirrorA1Whiff: Object.freeze({ hero: 'MIRROR', mix: MIX.SILENT, event: 'A1_WHIFF' }),
  });

  // Clips that must exist at runtime, derived from the wired policy so the
  // shipping prune can never silently drop an audible cue.
  const REQUIRED_CLIPS = Object.freeze(
    Array.from(new Set(
      Object.values(POLICY)
        .filter((entry) => entry.mix !== MIX.SILENT && entry.enabled !== false && entry.clip)
        .map((entry) => entry.clip),
    )).sort(),
  );

  // ── Dispatch ───────────────────────────────────────────────────────────────
  function av() { return globalScope.APEX_ARSENAL_AV || null; }

  const stats = {
    dispatched: 0,
    played: 0,
    suppressedOffByDefault: 0,
    suppressedSilent: 0,
    suppressedGuard: 0,
    throttled: 0,
    noEngine: 0,
  };

  // The ONE audible-cue rule. Compatibility/alias events for the same semantic
  // action must still produce only one sound, which is why alias beats above
  // are declared SILENT rather than pointing at a clip.
  function dispatch(semanticEvent, payload) {
    const entry = POLICY[semanticEvent];
    if (!entry) return { semanticEvent, played: false, reason: 'unmapped' };
    stats.dispatched += 1;
    if (entry.mix === MIX.SILENT || !entry.clip) {
      stats.suppressedSilent += 1;
      return { semanticEvent, played: false, reason: 'silent', mix: entry.mix };
    }
    if (entry.enabled === false || entry.mix === MIX.OFF_BY_DEFAULT) {
      stats.suppressedOffByDefault += 1;
      return { semanticEvent, played: false, reason: 'off-by-default', mix: entry.mix };
    }
    if (typeof entry.when === 'function' && !entry.when(payload)) {
      stats.suppressedGuard += 1;
      return { semanticEvent, played: false, reason: 'guard', mix: entry.mix };
    }
    const engine = av();
    if (!engine || typeof engine.playHeroSfx !== 'function') {
      stats.noEngine += 1;
      return { semanticEvent, played: false, reason: 'no-engine', mix: entry.mix };
    }
    // Per-Mirror-owner / per-Magnet-owner rate limiting uses the pack's own
    // key space so two heroes cannot throttle each other.
    const ownerKey = payload && (payload.owner != null ? `o${payload.owner}`
      : payload.combatantIndex != null ? `c${payload.combatantIndex}`
        : payload.body != null ? `b${payload.body}` : '');
    const ok = engine.playHeroSfx(entry.clip, {
      vol: entry.vol,
      maxVoices: entry.maxVoices,
      attack: entry.attack,
      fadeTail: entry.fadeTail,
      rateLimitMs: entry.rateLimitMs,
      rateKey: entry.rateLimitMs ? `${entry.hero}:${entry.event}:${ownerKey}` : undefined,
      event: entry.event,
    });
    if (ok) stats.played += 1;
    else stats.throttled += 1;
    return { semanticEvent, played: !!ok, reason: ok ? 'played' : 'throttled', mix: entry.mix };
  }

  // ── Bus adapter (thin; no gameplay logic) ──────────────────────────────────
  const SUBSCRIBED = Object.freeze(Object.keys(POLICY));
  const unsubscribers = [];

  function onBusEvent(type, payload) {
    // FrostFreezeRefresh must never reach dispatch as a freeze start.
    if (type === 'FrostFreezeRefresh') { dispatch('FrostFreezeRefresh', payload); return; }
    dispatch(type, payload);
    // Crystala Wall also gets its two quiet shard micro-cuts, staggered per the
    // cut authority (+0.000 s and +0.090 s).
    if (type === 'CrystalConstructCast') {
      const shardEntry = POLICY.CrystalConstructCastShards;
      if (shardEntry.mix !== MIX.SILENT && shardEntry.enabled !== false
        && (!shardEntry.when || shardEntry.when(payload))) {
        const engine = av();
        if (engine && typeof engine.playHeroSfx === 'function') {
          engine.playHeroSfx(shardEntry.clip, { vol: shardEntry.vol, maxVoices: shardEntry.maxVoices, event: shardEntry.event });
          if (typeof globalScope.setTimeout === 'function') {
            globalScope.setTimeout(() => {
              engine.playHeroSfx(shardEntry.clip, { vol: shardEntry.vol, maxVoices: shardEntry.maxVoices, event: shardEntry.event });
            }, 90);
          }
        }
      }
    }
  }

  function subscribe() {
    const AIL = globalScope.APEX_HERO_AIL || globalScope.APEX_HERO_REWORK_AIL;
    const bus = AIL && AIL.bus;
    if (!bus || typeof bus.on !== 'function') return false;
    for (const type of SUBSCRIBED) {
      const handler = (payload) => onBusEvent(type, payload);
      const off = bus.on(type, handler);
      if (typeof off === 'function') unsubscribers.push(off);
    }
    return true;
  }

  function unsubscribe() {
    while (unsubscribers.length) {
      const off = unsubscribers.pop();
      try { off(); } catch (error) { /* teardown must not throw */ }
    }
  }

  // Warm every wired clip so the first combat event never decodes mid-fight.
  function warm() {
    const engine = av();
    if (!engine || typeof engine.warmHeroSfx !== 'function') return 0;
    for (const clip of REQUIRED_CLIPS) engine.warmHeroSfx(clip);
    return REQUIRED_CLIPS.length;
  }

  // Subscribe as soon as the AIL bus exists. Script order in the runtime
  // manifest puts this after the gameplay/AIL chain, so the bus is normally
  // live already; subscribe() stays exported for an explicit retry seam.
  let subscribedOnce = false;
  function ensureSubscribed() {
    if (subscribedOnce) return true;
    subscribedOnce = subscribe();
    return subscribedOnce;
  }
  ensureSubscribed();

  globalScope.APEX_CORE_SIX_SFX = Object.freeze({
    version: 'apex-core-six-hero-sfx-v1',
    MIX,
    POLICY,
    REQUIRED_CLIPS,
    SUBSCRIBED_EVENTS: SUBSCRIBED,
    dispatch,
    subscribe,
    ensureSubscribed,
    unsubscribe,
    warm,
    stats,
  });
})(typeof window !== 'undefined' ? window : globalThis);
