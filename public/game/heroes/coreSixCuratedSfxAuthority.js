// ---------------------------------------------------------------------------
// APEX CHAOS — the ONE semantic hero-SFX authority for the four newer Core Six
// heroes (CRYSTALA / MAGNET / FROST / MIRROR).
//
// Owner law 2026-10-05, finding 9:
//   · ROBOT and HUNTER keep their EXISTING accepted production SFX
//     (public/assets/hero-rework/robot-final/sfx/ and .../hunter-v10/sfx/) and
//     are deliberately ABSENT from this authority — no replacement packages.
//   · CRYSTALA / MAGNET / FROST / MIRROR get their accepted VFX plus the
//     owner-CURATED SFX, materialised byte-identically from the preload archive.
//   · Every cue is triggered from a REAL production semantic event. No demo cast
//     events, no guessed event names, no render-frame or simulation-tick
//     triggering.
//   · The integration maps' first-mix decisions are binding: DEFAULT ON,
//     LOW ACCENT and OFF BY DEFAULT / SILENT cues are never all fired just
//     because a file exists.
//   · Hero SFX volume/mute is SEPARATE from the MUSIC mute (M mutes music only)
//     and from the UI-SFX authority.
//
// Classic script (not a module) so every runtime loads the SAME implementation.
// ---------------------------------------------------------------------------
(function apexHeroSfxAuthority() {
  'use strict';

  // The curated cue table. `file` values are byte-identical copies of the owner
  // preload clips (see docs/gold-ui/preload/CORE_SIX_CURATED_SFX_MANIFEST.json).
  const ROOT = '/assets/hero-rework/';
  const CUES = Object.freeze({
    crystala: Object.freeze({
      a2_awaken: { file: 'crystala-curated/sfx/crystala_a2_awaken.mp3', policy: 'DEFAULT_ON', vol: 0.62, rate: 0, voices: 1 },
      wall_construct: { file: 'crystala-curated/sfx/crystala_wall_construct.mp3', policy: 'DEFAULT_ON', vol: 0.55, rate: 0, voices: 1 },
      projectile_reflect: { file: 'crystala-curated/sfx/crystala_projectile_reflect.mp3', policy: 'DEFAULT_ON', vol: 0.42, rate: 90, voices: 2 },
      shard_pulse: { file: 'crystala-curated/sfx/crystala_shard_pulse.mp3', policy: 'LOW_ACCENT', vol: 0.22, rate: 90, voices: 2 },
      // OFF BY DEFAULT in the curated first mix — declared, never auto-played.
      construct_hit_optional: { file: 'crystala-curated/sfx/crystala_construct_hit_optional.mp3', policy: 'OFF_BY_DEFAULT', vol: 0.2, rate: 140, voices: 1 },
    }),
    magnet: Object.freeze({
      a1_attraction: { file: 'magnet-curated/sfx/magnet_a1_attraction.mp3', policy: 'DEFAULT_ON', vol: 0.55, rate: 0, voices: 1 },
      a2_repulsion: { file: 'magnet-curated/sfx/magnet_a2_repulsion.mp3', policy: 'DEFAULT_ON', vol: 0.6, rate: 0, voices: 1 },
      a2_bullet_deflect: { file: 'magnet-curated/sfx/magnet_a2_bullet_deflect.mp3', policy: 'DEFAULT_ON', vol: 0.45, rate: 90, voices: 2 },
    }),
    frost: Object.freeze({
      a1_breath: { file: 'frost-curated/sfx/frost_a1_breath.mp3', policy: 'DEFAULT_ON', vol: 0.58, rate: 0, voices: 1 },
      enemy_freeze: { file: 'frost-curated/sfx/frost_enemy_freeze.mp3', policy: 'DEFAULT_ON', vol: 0.55, rate: 0, voices: 1 },
      weapon_freeze: { file: 'frost-curated/sfx/frost_weapon_freeze_a.mp3', policy: 'DEFAULT_ON', vol: 0.5, rate: 0, voices: 2, roundRobin: ['weapon_freeze', 'weapon_freeze_b', 'weapon_freeze_c'] },
      weapon_freeze_b: { file: 'frost-curated/sfx/frost_weapon_freeze_b.mp3', policy: 'DEFAULT_ON', vol: 0.5, rate: 0, voices: 2 },
      weapon_freeze_c: { file: 'frost-curated/sfx/frost_weapon_freeze_c.mp3', policy: 'DEFAULT_ON', vol: 0.5, rate: 0, voices: 2 },
      floor_contact_optional: { file: 'frost-curated/sfx/frost_floor_contact_optional.mp3', policy: 'OFF_BY_DEFAULT', vol: 0.25, rate: 250, voices: 1 },
    }),
    mirror: Object.freeze({
      a1_cast: { file: 'mirror-curated/sfx/mirror_a1_cast.mp3', policy: 'DEFAULT_ON', vol: 0.58, rate: 0, voices: 1 },
      a2_exchange_snap: { file: 'mirror-curated/sfx/mirror_a2_exchange_snap.mp3', policy: 'DEFAULT_ON', vol: 0.6, rate: 0, voices: 1 },
      passive_shard_drop: { file: 'mirror-curated/sfx/mirror_passive_shard_drop_a.mp3', policy: 'LOW_ACCENT', vol: 0.34, rate: 0, voices: 1, roundRobin: ['passive_shard_drop', 'passive_shard_drop_b', 'passive_shard_drop_c'] },
      passive_shard_drop_b: { file: 'mirror-curated/sfx/mirror_passive_shard_drop_b.mp3', policy: 'LOW_ACCENT', vol: 0.34, rate: 0, voices: 1 },
      passive_shard_drop_c: { file: 'mirror-curated/sfx/mirror_passive_shard_drop_c.mp3', policy: 'LOW_ACCENT', vol: 0.34, rate: 0, voices: 1 },
      passive_node_form: { file: 'mirror-curated/sfx/mirror_passive_node_form.mp3', policy: 'DEFAULT_ON', vol: 0.42, rate: 0, voices: 1 },
      passive_node_fold_optional: { file: 'mirror-curated/sfx/mirror_passive_node_fold_optional.mp3', policy: 'OFF_BY_DEFAULT', vol: 0.3, rate: 0, voices: 1 },
    }),
  });

  // Semantic production event → cue. Event names are read from the shipping
  // gameplay runtimes (crystalGameplayRuntime.js, magnetGameplayRuntime.js,
  // frostGameplayRuntime.js, heroMechanicsRuntime.js) — never guessed.
  // The magnet a2capture seam is a presentation cue driven by the gameplay
  // runtime's real captureEvents, so it is subscribed by the magnet bridge.
  const EVENT_MAP = Object.freeze({
    CrystalAwaken: { hero: 'crystala', cue: 'a2_awaken' },
    CrystalConstructCast: { hero: 'crystala', cue: 'wall_construct', when: (p) => !p || p.kind === 'wall' },
    CrystalIntercept: { hero: 'crystala', cue: 'projectile_reflect' },
    CrystalReserve: { hero: 'crystala', cue: 'shard_pulse' },
    CrystalConstructHit: { hero: 'crystala', cue: 'construct_hit_optional' }, // OFF BY DEFAULT
    MagnetA1Start: { hero: 'magnet', cue: 'a1_attraction' },
    MagnetA2Start: { hero: 'magnet', cue: 'a2_repulsion' },
    a2capture: { hero: 'magnet', cue: 'a2_bullet_deflect' },
    FrostBreathCast: { hero: 'frost', cue: 'a1_breath' },
    FrostFreezeStart: { hero: 'frost', cue: 'enemy_freeze' },
    FrostSlotFrozen: { hero: 'frost', cue: 'weapon_freeze' },
    FrostGunFrozen: { hero: 'frost', cue: 'weapon_freeze' },
    MirrorA1Cast: { hero: 'mirror', cue: 'a1_cast' },
    MirrorExchange: { hero: 'mirror', cue: 'a2_exchange_snap' },
    MirrorNodeForming: { hero: 'mirror', cue: 'passive_node_form' },
    MirrorNodeOff: { hero: 'mirror', cue: 'passive_node_fold_optional' }, // OFF BY DEFAULT
  });

  // Mirror's passive shard drop is seeded from a REAL realized damage event that
  // creates shards; the wiring lives in the mirror bridge (one cue per proc).
  const HEROES = Object.freeze(['crystala', 'magnet', 'frost', 'mirror']);
  const HERO_VOLUME = 0.85;

  function installHeroSfxAuthority(options) {
    const opts = options || {};
    const win = opts.window || (typeof window !== 'undefined' ? window : null);
    if (!win) return null;
    if (win.__apexHeroSfxInstalled && win.apexHeroSfx) return win.apexHeroSfx;
    win.__apexHeroSfxInstalled = true;

    const AudioCtor = win.Audio || (typeof Audio !== 'undefined' ? Audio : null);
    const cache = new Map();       // "hero/cue" -> the ONE cached element
    const lastAt = new Map();      // "hero/cue" -> last start timestamp
    const active = new Map();      // "hero/cue" -> live voice count
    const rrIndex = new Map();     // round-robin group -> next slice
    let volume = HERO_VOLUME;
    let muted = false;
    let offByDefaultEnabled = false;

    const keyOf = (hero, cue) => `${hero}/${cue}`;
    const specOf = (hero, cue) => (CUES[hero] ? CUES[hero][cue] : null);

    function elementFor(hero, cue) {
      const spec = specOf(hero, cue);
      if (!spec || !AudioCtor) return null;
      const key = keyOf(hero, cue);
      let el = cache.get(key);
      if (!el) {
        el = new AudioCtor(ROOT + spec.file);
        el.preload = 'auto';
        el.__apexHeroSfxKey = key;
        cache.set(key, el);
      }
      const level = muted ? 0 : (volume * (spec.vol || 1));
      el.volume = Math.max(0, Math.min(1, level));
      el.muted = muted;
      return el;
    }

    function activeVoices(hero, cue) { return active.get(keyOf(hero, cue)) || 0; }

    // Resolve a round-robin group to the slice that should sound this proc, so a
    // conversion never repeats the identical sample twice in a row.
    function resolveRoundRobin(hero, cue) {
      const spec = specOf(hero, cue);
      if (!spec || !spec.roundRobin) return cue;
      const group = keyOf(hero, cue);
      const list = spec.roundRobin;
      const i = rrIndex.get(group) || 0;
      rrIndex.set(group, (i + 1) % list.length);
      return list[i];
    }

    function play(hero, cue, options2) {
      const o = options2 || {};
      if (!HEROES.includes(hero)) return false;
      const spec = specOf(hero, cue);
      if (!spec) return false;
      if (muted && !o.force) return false;
      // OFF BY DEFAULT cues stay silent unless explicitly opted in.
      if (spec.policy === 'OFF_BY_DEFAULT' && !o.force && !offByDefaultEnabled) return false;
      // Round-robin groups share one policy slot; resolve before rate limiting.
      const resolved = resolveRoundRobin(hero, cue);
      const rspec = specOf(hero, resolved);
      if (!rspec) return false;
      const key = keyOf(hero, resolved);
      // Rate limit + voice cap from the integration map.
      const now = (win.performance && win.performance.now) ? win.performance.now() : Date.now();
      const rate = rspec.rate || 0;
      if (rate > 0) {
        const last = lastAt.get(key);
        if (last !== undefined && now - last < rate) return false;
      }
      const cap = rspec.voices || 1;
      if (cap > 0 && activeVoices(hero, resolved) >= cap) return false;
      lastAt.set(key, now);
      const el = elementFor(hero, resolved);
      if (!el) return false;
      active.set(key, activeVoices(hero, resolved) + 1);
      const done = () => { active.set(key, Math.max(0, activeVoices(hero, resolved) - 1)); };
      if (typeof el.addEventListener === 'function') {
        el.addEventListener('ended', done, { once: true });
      } else {
        win.setTimeout(done, 400);
      }
      try { el.currentTime = 0; } catch (error) { /* not seekable yet */ }
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay/gesture policy: a hero cue never manufactures playback.
          done();
        });
      }
      return true;
    }

    // Dispatch a real production semantic event.
    function dispatch(type, payload) {
      const map = EVENT_MAP[type];
      if (!map) return false;
      if (map.when && !map.when(payload || {})) return false;
      return play(map.hero, map.cue);
    }

    const api = {
      heroes: () => HEROES.slice(),
      cues: (hero) => (CUES[hero] ? Object.keys(CUES[hero]) : []),
      urlFor: (hero, cue) => {
        const spec = specOf(hero, cue);
        return spec ? ROOT + spec.file : null;
      },
      policyFor: (hero, cue) => { const s = specOf(hero, cue); return s ? s.policy : null; },
      play,
      dispatch,
      // OWNER LAW (R56): a cue's FIRST trigger in a match must not pay for its
      // own fetch+decode. Elements used to be constructed lazily inside
      // elementFor(), so whichever ability happened to fire first was the one
      // that sounded late (the owner's "sometimes right, sometimes late").
      // Warming is scheduling only: the SAME cache, the SAME elements, the SAME
      // volume policy - nothing new is played, and an already-cached cue is a
      // no-op.
      warm: (heroIds) => {
        const requested = heroIds == null
          ? HEROES.slice()
          : (Array.isArray(heroIds) ? heroIds : [heroIds]);
        const warmed = [];
        for (const raw of requested) {
          // Hero ids in this authority are lower-case ('crystala','magnet',
          // 'frost','mirror'); accept either case from callers.
          const hero = String(raw == null ? '' : raw).toLowerCase();
          const cues = CUES[hero];
          if (!cues) continue;
          for (const cue of Object.keys(cues)) {
            const el = elementFor(hero, cue);
            if (!el) continue;
            el.preload = 'auto';
            try { if (typeof el.load === 'function') el.load(); } catch (_) {}
            warmed.push(keyOf(hero, cue));
          }
        }
        return warmed;
      },
      // Separate hero-SFX level/mute (MUSIC mute and UI-SFX mute are untouched).
      setVolume: (v) => {
        volume = Math.max(0, Math.min(1, Number(v)));
        for (const [key, el] of cache) {
          const [h, c] = key.split('/');
          const spec = specOf(h, c);
          el.volume = muted ? 0 : volume * (spec ? (spec.vol || 1) : 1);
        }
        return volume;
      },
      volume: () => volume,
      mute: () => { muted = true; for (const el of cache.values()) { el.muted = true; el.volume = 0; } return muted; },
      unmute: () => {
        muted = false;
        for (const [key, el] of cache) {
          const [h, c] = key.split('/');
          const spec = specOf(h, c);
          el.muted = false;
          el.volume = volume * (spec ? (spec.vol || 1) : 1);
        }
        return muted;
      },
      toggleMute: () => (muted ? api.unmute() : api.mute()),
      isMuted: () => muted,
      // Explicit, owner-visible opt-in for the OFF BY DEFAULT cues.
      setOffByDefaultEnabled: (on) => { offByDefaultEnabled = !!on; return offByDefaultEnabled; },
      offByDefaultEnabled: () => offByDefaultEnabled,
      state: () => ({
        volume, muted, cached: cache.size,
        offByDefaultEnabled,
        active: [...active.entries()].filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`),
      }),
      dispose: () => { cache.clear(); active.clear(); lastAt.clear(); rrIndex.clear(); win.__apexHeroSfxInstalled = false; delete win.apexHeroSfx; },
    };

    win.apexHeroSfx = api;
    return api;
  }

  const scope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (scope) {
    scope.installHeroSfxAuthority = installHeroSfxAuthority;
    if (!scope.__apexHeroSfxAutoInstalled) {
      scope.__apexHeroSfxAutoInstalled = true;
      try { installHeroSfxAuthority({ window: scope }); } catch (error) { /* headless stubs */ }
    }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { installHeroSfxAuthority, CUES, EVENT_MAP, ROOT, HEROES, HERO_VOLUME };
  }
})();
