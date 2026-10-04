// APEX CHAOS — Product theme music authority (Forward Drive).
//
// Owner source: "Forward Drive.mp3"
//   owner SHA-256  e3207b5744ad1657fd77d757bd732a71eda5a4c471e0abef7f68a121b32a2c9e
// Runtime encode (Ogg Opus, repository-efficient):
//   /assets/music/forward_drive_theme.ogg
//   SHA-256        15afd820d5ca061f374ea41ad425f795204cf2be0e1f03d641f9b1f85f6dfb9b
//   duration       ~158.06 s
//
// ── LAW ──────────────────────────────────────────────────────────────────────
// This module is NOT a second music manager. src/App.jsx keeps owning the ONE
// HTMLMediaElement and keeps the theme outside the battle-audio graph
// (public/game/core/apexBattleAudioRuntime.js). This module replaces the
// BEHAVIOR of the old menu-BGM seam (menu/select-only, currentTime reset on
// handoff, no fade, no music toggle) while preserving its architecture.
//
// Replaced behavior:
//   4.1 PLAYHEAD CONTINUITY — ordinary surface transitions never restart the
//       track. Pause preserves currentTime; resume continues from it. A loop
//       boundary is not a surface-transition restart. Only a genuine new
//       application session starts at 0.
//   4.2 SURFACE POLICY — data-driven, so unlocking Quest/Shop later needs no
//       audio-manager rewrite.
//   4.3 FADE — every policy-driven audible start/stop fades through one
//       production-owned duration; no hard cut, no overlapping elements,
//       reversible mid-transition, no timer/promise accumulation.
//   4.4 TAB/WINDOW — document.hidden or window blur silences the theme; resume
//       only when visible/focused, unmuted and policy-allowed, from the SAME
//       playhead.
//   4.5 M KEY — global MUSIC-only mute/unmute. Never affects battle SFX or
//       master, never changes BOT/Local/P1/P2 mode. The Battle HUD donor's
//       demo-only "M = toggle 1P/2P" binding does not survive production.
//   4.6 AUDIO GRAPH — no new AudioContext; theme never routes into
//       battleAudioMaster; pausing the theme never clears decoded battle SFX.

// ── Production-owned constants ───────────────────────────────────────────────
export const THEME_MUSIC = Object.freeze({
  // Stable materialized runtime path (never a ZIP dependency).
  src: '/assets/music/forward_drive_theme.ogg',
  ownerSourceName: 'Forward Drive.mp3',
  ownerSourceSha256: 'e3207b5744ad1657fd77d757bd732a71eda5a4c471e0abef7f68a121b32a2c9e',
  runtimeSha256: '15afd820d5ca061f374ea41ad425f795204cf2be0e1f03d641f9b1f85f6dfb9b',
  durationSeconds: 158.06,
  // ONE production fade duration (owner-accepted 300–450 ms band).
  fadeMs: 380,
  targetVolume: 0.48,
  // M is the global MUSIC-only mute/unmute key.
  muteKey: 'm',
  loop: true,
});

export const THEME_DECISION = Object.freeze({
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
});

// ── 4.2 SURFACE POLICY (data-driven, never hard-coded per screen) ────────────
// Explicit owner exceptions are music-OFF/PAUSED. Everything else in the
// normal product flow keeps the theme running continuously until the ACTUAL
// BATTLE MATCH begins — selecting a battle does not stop the theme; only the
// real match-start seam does.
//
// Quest and Shop stay in the table while lightly locked, so a future unlock is
// a product-graph change, not an audio-manager rewrite.
const POLICY = {
  // Allowed — theme continues.
  home: THEME_DECISION.PLAY,
  navigation: THEME_DECISION.PLAY,
  'bot-pick': THEME_DECISION.PLAY,
  'local-pick': THEME_DECISION.PLAY,
  pick: THEME_DECISION.PLAY,
  // Battle-entry transition / handoff BEFORE the real match start.
  'battle-entry': THEME_DECISION.PLAY,
  // Result / return flow resumes the same preserved playhead.
  result: THEME_DECISION.PLAY,

  // Explicit owner exceptions — fade out, pause, PRESERVE currentTime.
  'lucky-draw': THEME_DECISION.PAUSE,
  'fighter-upgrade': THEME_DECISION.PAUSE,
  missions: THEME_DECISION.PAUSE,
  mission: THEME_DECISION.PAUSE,
  'fighter-shop': THEME_DECISION.PAUSE,
  // Quest is a future surface; its policy is declared now so unlocking it
  // later cannot require rewriting this module.
  'quest-01': THEME_DECISION.PAUSE,
  // The ACTUAL battle match — the only seam where the theme stops for combat.
  'battle-match': THEME_DECISION.PAUSE,
};

// Default for any surface not yet in the table: keep the theme running. A new
// product surface is therefore music-continuous unless explicitly excepted.
const DEFAULT_DECISION = THEME_DECISION.PLAY;

function normalizeSurface(surfaceId) {
  return String(surfaceId == null ? '' : surfaceId).trim().toLowerCase();
}

export function themePolicyFor(surfaceId) {
  const key = normalizeSurface(surfaceId);
  if (!key) return DEFAULT_DECISION;
  if (Object.prototype.hasOwnProperty.call(POLICY, key)) return POLICY[key];
  return DEFAULT_DECISION;
}

// The complete declared policy table, for gates that must prove the music-off
// surfaces are declared even while their product surface is locked.
export function themeSurfacePolicyTable() {
  return { ...POLICY };
}

// ── Controller ───────────────────────────────────────────────────────────────
// Injected dependencies keep the whole continuity/fade/policy/M-key contract
// deterministically testable without a browser or real timers.
export function createThemeMusicController(options = {}) {
  const media = options.media;
  const fadeMs = Number(options.fadeMs) > 0 ? Number(options.fadeMs) : THEME_MUSIC.fadeMs;
  const targetVolume = Number(options.targetVolume) > 0 ? Number(options.targetVolume) : THEME_MUSIC.targetVolume;
  const stepMs = Number(options.stepMs) > 0 ? Number(options.stepMs) : 16;
  const setTimer = options.setInterval || ((fn, ms) => setInterval(fn, ms));
  const clearTimer = options.clearInterval || ((handle) => clearInterval(handle));

  let surface = normalizeSurface(options.surface) || 'home';
  let muted = false;
  // §4.4: paused because the tab/window is not the user's focus.
  let suppressed = false;
  // §4.3: a monotonic generation. Every asynchronous resume re-checks it, so a
  // battle start can never be raced by a late theme resume.
  let generation = 0;
  let fadeTimer = null;
  // Explicit new-session reset is the ONLY playhead reset in the module.
  let explicitReset = false;

  const stats = {
    playRequests: 0,
    pauseRequests: 0,
    fadesStarted: 0,
    fadesCancelled: 0,
    hardCuts: 0,
    playheadResets: 0,
    suppressedPauses: 0,
    muteToggles: 0,
    suppressedResumes: 0,
  };

  const snapshot = () => ({
    surface,
    decision: themePolicyFor(surface),
    muted,
    suppressed,
    paused: media ? !!media.paused : true,
    currentTime: media ? Number(media.currentTime) || 0 : 0,
    volume: media ? Number(media.volume) || 0 : 0,
    fading: fadeTimer != null,
    generation,
  });

  function stopFade() {
    if (fadeTimer == null) return;
    clearTimer(fadeTimer);
    fadeTimer = null;
    stats.fadesCancelled += 1;
  }

  function setVolume(value) {
    if (!media) return;
    const next = Math.max(0, Math.min(1, value));
    if (Number(media.volume) === next) return;
    try { media.volume = next; } catch (error) { /* some engines clamp */ }
  }

  // ── 4.3 FADE LAW ─────────────────────────────────────────────────────────
  // One fade primitive. Reversing mid-transition just retargets: the running
  // ramp is cancelled and a new one starts from the CURRENT volume, so there
  // is never a jump and never two ramps fighting.
  function fadeTo(target, onSettled) {
    if (!media) { if (onSettled) onSettled(); return; }
    stopFade();
    const from = Number(media.volume) || 0;
    const to = Math.max(0, Math.min(1, target));
    if (Math.abs(from - to) < 0.001) {
      setVolume(to);
      if (onSettled) onSettled();
      return;
    }
    stats.fadesStarted += 1;
    const span = to - from;
    const steps = Math.max(1, Math.round(fadeMs / stepMs));
    let step = 0;
    const token = generation;
    fadeTimer = setTimer(() => {
      // A superseded generation (battle started, surface changed) abandons
      // this ramp instead of writing stale volume.
      if (token !== generation) { stopFade(); return; }
      step += 1;
      const t = Math.min(1, step / steps);
      setVolume(from + span * t);
      if (t >= 1) {
        stopFade();
        if (onSettled) onSettled();
      }
    }, stepMs);
  }

  function pausePreservingPlayhead() {
    if (!media) return;
    stats.pauseRequests += 1;
    // Never touch currentTime here — that is the entire continuity law.
    fadeTo(0, () => {
      if (!media || media.paused) return;
      try { media.pause(); } catch (error) {}
    });
  }

  function resumePreservingPlayhead() {
    if (!media) return;
    stats.playRequests += 1;
    if (media.paused) {
      // currentTime is intentionally NOT reset. A loop boundary is handled by
      // the element's own `loop`, which is not a surface-transition restart.
      const p = media.play();
      if (p && p.catch) p.catch(() => { /* autoplay policy: healed by next gesture */ });
    }
    fadeTo(targetVolume);
  }

  // ── Policy evaluation ─────────────────────────────────────────────────────
  // Audible only when: surface policy allows, user has not muted with M, and
  // the tab/window has focus/visibility. All three are independent gates.
  function shouldBeAudible() {
    return themePolicyFor(surface) === THEME_DECISION.PLAY && !muted && !suppressed;
  }

  function apply() {
    if (!media) return;
    if (explicitReset) {
      explicitReset = false;
      try { media.currentTime = 0; } catch (error) {}
      stats.playheadResets += 1;
    }
    if (shouldBeAudible()) resumePreservingPlayhead();
    else pausePreservingPlayhead();
  }

  return {
    // -- surface policy (§4.1/§4.2) --
    setSurface(nextSurface) {
      const key = normalizeSurface(nextSurface) || 'home';
      if (key === surface) return apply();
      surface = key;
      // Ordinary navigation must NOT restart the track, so this path never
      // touches currentTime.
      return apply();
    },
    surface: () => surface,
    decision: () => themePolicyFor(surface),

    // -- §4.5 M KEY: music-only mute/unmute --
    // Deliberately named for MUSIC. It changes nothing about battle SFX,
    // master volume, or BOT/Local/P1/P2 mode.
    setMuted(next) {
      const value = !!next;
      if (value === muted) return snapshot();
      muted = value;
      stats.muteToggles += 1;
      apply();
      return snapshot();
    },
    toggleMuted() { return this.setMuted(!muted); },
    isMuted: () => muted,
    // True only for the music key. Battle SFX and game mode are untouched.
    handlesKey(key) {
      return String(key == null ? '' : key).toLowerCase() === THEME_MUSIC.muteKey;
    },

    // -- §4.4 TAB/WINDOW --
    setSuppressed(next) {
      const value = !!next;
      if (value === suppressed) return snapshot();
      suppressed = value;
      if (value) stats.suppressedPauses += 1;
      else stats.suppressedResumes += 1;
      // currentTime is never reset on blur/visibility pause.
      apply();
      return snapshot();
    },
    isSuppressed: () => suppressed,

    // -- §4.1 explicit new-session start (the ONLY playhead reset) --
    resetForNewSession() {
      explicitReset = true;
      generation += 1;
      stopFade();
      apply();
      return snapshot();
    },

    // -- battle start seam --
    // Invalidates every in-flight fade/resume so a late theme resume cannot
    // race the battle session, then pauses with a fade.
    enterBattleMatch() {
      generation += 1;
      stopFade();
      surface = 'battle-match';
      return apply();
    },

    apply,
    snapshot,
    stats,
    // Test/inspection seam: force-abandon in-flight ramps (e.g. teardown).
    dispose() {
      generation += 1;
      stopFade();
      if (media && !media.paused) { try { media.pause(); } catch (error) {} }
    },
  };
}
