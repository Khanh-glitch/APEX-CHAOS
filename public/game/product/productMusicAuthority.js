// APEX CHAOS — the ONE product music authority (owner law 2026-10-05).
//
// The product theme is Forward Drive (/assets/audio/forward_drive_theme.ogg).
// There is exactly ONE persistent HTMLMediaElement for it in the whole
// product: this module creates/owns it. No second Audio object, no second
// music manager and no music AudioContext exists anywhere else — the Gold
// product bridge and every other surface talk to this authority through
// window.apexProductMusic instead of touching media themselves.
//
// Policy (single source of truth for both presentation and playback):
//   * Forward Drive plays continuously across Home / Mode select / Fighter
//     select / battle-entry transition (MENU_MUSIC_ALLOWED_SURFACES).
//   * It is OFF on Lucky Draw / Upgrade / Missions / Shop / live battle.
//   * A real match start fades it OUT (300–450ms) and the playhead is
//     PRESERVED; returning to an allowed surface fades it back IN from that
//     same playhead (never a restart).
//   * hidden/blur pauses; visible/focus resumes only if playback was
//     previously allowed.
//   * M mutes MUSIC ONLY (battle SFX use their own audio graph).
//   * Autoplay policy is respected: nothing here manufactures playback.
//
// This file is a plain classic script (not a module) so the App bundle and the
// headless cross-law harness load the SAME implementation.
(function apexProductMusicAuthority() {
  'use strict';
  const SOURCE = '/assets/audio/forward_drive_theme.ogg';
  const ALLOWED_SURFACES = ['home', 'mode', 'fighter', 'transition'];
  const FADE_MS = 380; // owner band 300–450ms
  const VOLUME = 0.48;

  function installProductMusicAuthority(options) {
    const opts = options || {};
    const win = opts.window || (typeof window !== 'undefined' ? window : null);
    if (!win) return null;
    const doc = opts.document || win.document;
    // Idempotent: a second install (the App installs after the runtime's own
    // auto-install) returns the SAME handle — same authority object, same one
    // element — and never creates a second music element.
    if (win.__apexProductMusicInstalled === SOURCE && win.__apexProductMusicHandle) {
      return win.__apexProductMusicHandle;
    }
    win.__apexProductMusicInstalled = SOURCE;

    const audio = opts.audio || new win.Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = VOLUME;
    audio.__apexMenuMusic = true;
    if (!audio.src) audio.src = SOURCE;
    try { audio.load(); } catch (error) { /* preload is best-effort */ }

    const allowed = new Set(opts.allowedSurfaces || ALLOWED_SURFACES);
    let surface = null; // { id, allowed }
    let wasPlaying = false;
    let fadeFrame = 0;

    const cancelFade = () => {
      if (fadeFrame) { win.cancelAnimationFrame(fadeFrame); fadeFrame = 0; }
    };

    const visible = (id) => {
      const el = doc.getElementById(id);
      if (!el || el.classList.contains('hidden')) return false;
      const style = win.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };

    // Fallback policy for hosts that never announce a surface: the semantic
    // product menu plus the active Arsenal picker are the allowed flow.
    const allowedByDom = () => visible('menu-screen') || visible('select-screen');

    const isAllowed = () => (surface ? surface.allowed === true : allowedByDom());

    const fadeTo = (target, ms, onDone) => {
      cancelFade();
      const from = Number.isFinite(audio.volume) ? audio.volume : 0;
      const started = (win.performance && win.performance.now) ? win.performance.now() : Date.now();
      const step = () => {
        const now = (win.performance && win.performance.now) ? win.performance.now() : Date.now();
        const t = Math.min(1, (now - started) / Math.max(1, ms));
        audio.volume = Math.max(0, Math.min(1, from + (target - from) * t));
        if (t < 1) { fadeFrame = win.requestAnimationFrame(step); }
        else { fadeFrame = 0; if (onDone) onDone(); }
      };
      fadeFrame = win.requestAnimationFrame(step);
    };

    const play = () => {
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      return p;
    };

    const fadeIn = (ms) => {
      if (!isAllowed()) return;
      audio.volume = 0;
      play();
      fadeTo(VOLUME, ms || FADE_MS);
    };

    const fadeOut = (ms, onDone) => {
      fadeTo(0, ms || FADE_MS, () => {
        audio.pause(); // playhead preserved — never reset here
        if (onDone) onDone();
      });
    };

    const setSurface = (surfaceId) => {
      const id = String(surfaceId == null ? '' : surfaceId).toLowerCase();
      if (!id) return;
      const ok = allowed.has(id);
      surface = { id, allowed: ok };
      if (ok) {
        if (audio.paused) {
          audio.volume = 0;
          play();
          fadeTo(VOLUME, FADE_MS);
        }
      } else if (!audio.paused) {
        fadeOut(FADE_MS);
      }
    };

    const toggleMute = () => {
      audio.muted = !audio.muted; // MUSIC ONLY — battle SFX are a separate graph
      win.__apexGoldMusicMuted = audio.muted;
      return audio.muted;
    };

    const api = {
      source: audio.currentSrc || audio.src || SOURCE,
      // Exactly one persistent product-music element exists; this is it.
      elementCount: () => 1,
      isProductMusicElement: (el) => el === audio,
      allowedSurfaces: () => [...allowed],
      setSurface,
      fadeOut: (ms) => fadeOut(ms),
      fadeIn: (ms) => fadeIn(ms),
      toggleMute,
      state: () => ({
        src: audio.currentSrc || audio.src,
        paused: audio.paused,
        muted: audio.muted,
        volume: audio.volume,
        currentTime: audio.currentTime,
        surface,
        allowed: isAllowed(),
      }),
    };

    // M is the global music mute (music element only).
    const musicKey = (e) => {
      const k = String((e && e.key) || '').toLowerCase();
      if (k !== 'm' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const tag = String((e.target && e.target.tagName) || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      toggleMute();
    };
    const pauseForHidden = () => {
      wasPlaying = !audio.paused;
      audio.pause();
    };
    const resumeForVisible = () => {
      if (!isAllowed()) { wasPlaying = false; audio.pause(); return; }
      if (!wasPlaying) return;
      wasPlaying = false;
      play();
    };
    const handleVisibility = () => { if (doc.hidden) pauseForHidden(); else resumeForVisible(); };

    win.addEventListener('keydown', musicKey);
    doc.addEventListener('visibilitychange', handleVisibility);
    win.addEventListener('blur', pauseForHidden);
    win.addEventListener('focus', resumeForVisible);

    const dispose = () => {
      win.removeEventListener('keydown', musicKey);
      doc.removeEventListener('visibilitychange', handleVisibility);
      win.removeEventListener('blur', pauseForHidden);
      win.removeEventListener('focus', resumeForVisible);
      cancelFade();
      win.__apexProductMusicInstalled = null;
      if (win.__apexProductMusicHandle === handle) delete win.__apexProductMusicHandle;
      if (win.apexProductMusic === api) delete win.apexProductMusic;
    };

    const handle = { api, audio, dispose };
    win.__apexProductMusicHandle = handle;
    win.apexProductMusic = api;
    win.apexStopMenuMusic = (reset) => {
      cancelFade();
      audio.pause();
      if (reset) { try { audio.currentTime = 0; } catch (error) {} }
    };
    win.apexPlayMenuMusic = (restart) => {
      if (!isAllowed()) return;
      if (restart) { try { audio.currentTime = 0; } catch (error) {} }
      audio.volume = VOLUME;
      play();
    };
    return handle;
  }

  const scope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (scope) {
    scope.installProductMusicAuthority = installProductMusicAuthority;
    // Auto-install in a plain browser context: the element is created here,
    // once, and the App consumes the very same authority object.
    if (!scope.__apexProductMusicAutoInstalled) {
      scope.__apexProductMusicAutoInstalled = true;
      try { installProductMusicAuthority({ window: scope }); } catch (error) { /* headless stubs */ }
    }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { installProductMusicAuthority, SOURCE, ALLOWED_SURFACES, FADE_MS, VOLUME };
  }
})();
