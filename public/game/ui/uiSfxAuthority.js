// ---------------------------------------------------------------------------
// APEX CHAOS — the ONE semantic UI/UX/HUD SFX authority (owner law 2026-10-05).
//
// The 18-key UI SFX pack (docs/gold-ui/preload/OWNER_PLAYTEST_MEDIA_R44_MANIFEST.json,
// uiSfx root public/assets/audio/ui-sfx/) is wired to REAL UI interactions
// through this single authority:
//
//   · ONE cached media element per semantic key, created at most once — never
//     a `new Audio()` per button click and never one AudioContext per event.
//   · UI-SFX volume/mute are SEPARATE from the MUSIC mute (M mutes music only;
//     UI SFX have their own level and their own mute).
//   · Retriggering resets the cached element's playhead instead of stacking a
//     second element, so a `ui.button.press` can never pile up under a
//     `fighter.lock_in`.
//   · A focus-move cue is debounced, and every cue is idempotent per call.
//
// Classic script (not a module) so every runtime loads the SAME implementation.
// ---------------------------------------------------------------------------
(function apexUiSfxAuthority() {
  'use strict';

  // The 18 semantic keys → their Git authority paths (R44 manifest gitPaths).
  const ROOT = '/assets/audio/ui-sfx/';
  const KEYS = Object.freeze({
    // 01_UI_CORE
    'ui.button.press': ROOT + '01_UI_CORE/ui_button_press.ogg',
    'ui.focus.move': ROOT + '01_UI_CORE/ui_focus_move.ogg',
    'ui.option.confirm': ROOT + '01_UI_CORE/ui_option_confirm.ogg',
    'ui.panel.open': ROOT + '01_UI_CORE/ui_panel_open.ogg',
    'ui.screen.transition': ROOT + '01_UI_CORE/ui_screen_transition.ogg',
    'ui.back.cancel': ROOT + '01_UI_CORE/ui_back_cancel.ogg',
    'ui.action.rejected': ROOT + '01_UI_CORE/ui_action_rejected.ogg',
    // 02_FIGHTER_SELECT
    'fighter.lock_in': ROOT + '02_FIGHTER_SELECT/fighter_lock_in.ogg',
    'fighter.match_ready': ROOT + '02_FIGHTER_SELECT/fighter_match_ready.ogg',
    // 03_BATTLE_TRANSITION
    'battle.transition.lock_impact': ROOT + '03_BATTLE_TRANSITION/battle_transition_lock_impact.ogg',
    'battle.transition.clamp_rail': ROOT + '03_BATTLE_TRANSITION/battle_transition_clamp_rail.ogg',
    'battle.transition.seam_open': ROOT + '03_BATTLE_TRANSITION/battle_transition_seam_open.ogg',
    // 04_LUCKY_DRAW
    'lucky.draw.enter_bay': ROOT + '04_LUCKY_DRAW/lucky_draw_enter_bay.ogg',
    'lucky.draw.machine_start': ROOT + '04_LUCKY_DRAW/lucky_draw_machine_start.ogg',
    'lucky.draw.machine_run': ROOT + '04_LUCKY_DRAW/lucky_draw_machine_run.ogg',
    'lucky.draw.reveal_charge': ROOT + '04_LUCKY_DRAW/lucky_draw_reveal_charge.ogg',
    'lucky.draw.reward_reveal': ROOT + '04_LUCKY_DRAW/lucky_draw_reward_reveal.ogg',
    // 05_HUD_STATE
    'hud.critical.warning': ROOT + '05_HUD_STATE/hud_critical_warning.ogg',
  });

  // CP4 semantic aliases. These are not new audio assets and never create a
  // second element: every alias resolves to one of the licensed canonical
  // files above, with bounded gain/rate/throttle treatment for its event.
  const ALIASES = Object.freeze({
    'tutorial.pause': Object.freeze({ key: 'ui.panel.open', gain: 0.55, rate: 0.92, throttleMs: 1200 }),
    'tutorial.resume': Object.freeze({ key: 'ui.option.confirm', gain: 0.6, rate: 1.05, throttleMs: 600 }),
    'achievement.provisional': Object.freeze({ key: 'ui.focus.move', gain: 0.65, rate: 1.12, throttleMs: 900 }),
    'achievement.official': Object.freeze({ key: 'ui.option.confirm', gain: 0.8, rate: 1, throttleMs: 500 }),
    'achievement.rare': Object.freeze({ key: 'ui.option.confirm', gain: 0.85, rate: 1.08, throttleMs: 500 }),
    'achievement.epic': Object.freeze({ key: 'fighter.match_ready', gain: 0.55, rate: 1.03, throttleMs: 700 }),
    'achievement.legendary': Object.freeze({ key: 'lucky.draw.reward_reveal', gain: 0.75, rate: 1, throttleMs: 900 }),
    'achievement.bot': Object.freeze({ key: 'ui.focus.move', gain: 0.35, rate: 0.82, throttleMs: 1200 }),
    'mission.claim': Object.freeze({ key: 'ui.option.confirm', gain: 0.85, rate: 1.05, throttleMs: 500 }),
    'skin.unlock': Object.freeze({ key: 'lucky.draw.reward_reveal', gain: 0.8, rate: 1, throttleMs: 900 }),
    'skin.equip': Object.freeze({ key: 'ui.option.confirm', gain: 0.7, rate: 1.02, throttleMs: 400 }),
    'result.win': Object.freeze({ key: 'fighter.match_ready', gain: 0.8, rate: 1, throttleMs: 1500 }),
    'result.loss': Object.freeze({ key: 'ui.back.cancel', gain: 0.65, rate: 0.9, throttleMs: 1500 }),
    'ui.locked': Object.freeze({ key: 'ui.action.rejected', gain: 0.8, rate: 1, throttleMs: 450 }),
    'ui.error': Object.freeze({ key: 'ui.action.rejected', gain: 0.9, rate: 0.92, throttleMs: 650 }),
  });

  const UI_SFX_VOLUME = 0.7;
  const FOCUS_MOVE_DEBOUNCE_MS = 70;
  // A short "press" must never stack under a longer confirmation cue.
  const SUPPRESSED_BY = { 'ui.button.press': ['fighter.lock_in', 'fighter.match_ready', 'ui.option.confirm'] };

  function installUiSfxAuthority(options) {
    const opts = options || {};
    const win = opts.window || (typeof window !== 'undefined' ? window : null);
    if (!win) return null;
    const doc = opts.document || win.document;
    if (win.__apexUiSfxInstalled && win.apexUiSfx) return win.apexUiSfx;
    win.__apexUiSfxInstalled = true;

    const AudioCtor = win.Audio || (typeof Audio !== 'undefined' ? Audio : null);
    const cache = new Map();       // key -> the ONE cached element for that key
    const lastPlayed = new Map();  // key -> timestamp (debounce support)
    const warmEvidence = new Map(); // key -> readiness timing/result; never playback
    let volume = UI_SFX_VOLUME;
    let muted = false;
    let focusTimer = 0;
    let pendingFocus = null;

    const keys = () => Object.keys(KEYS);
    const aliases = () => Object.keys(ALIASES);
    const canonicalFor = (key) => {
      if (Object.prototype.hasOwnProperty.call(KEYS, key)) return key;
      return ALIASES[key]?.key || null;
    };
    const aliasFor = (key) => ALIASES[key] || null;
    const urlFor = (key) => {
      const canonical = canonicalFor(key);
      return canonical ? KEYS[canonical] : null;
    };

    function applyLevel(el) {
      const gain = Math.max(0, Math.min(1, Number(el.__apexUiSfxGain ?? 1) || 0));
      el.volume = muted ? 0 : Math.max(0, Math.min(1, volume * gain));
      el.muted = muted;
    }

    function elementFor(requestedKey) {
      const key = canonicalFor(requestedKey);
      const url = key ? KEYS[key] : null;
      if (!url || !AudioCtor) return null;
      let el = cache.get(key);
      if (!el) {
        // Created ONCE per canonical key, then reused forever. Aliases share
        // this same cached element. No per-click Audio.
        el = new AudioCtor(url);
        el.preload = 'auto';
        el.__apexUiSfxKey = key;
        el.__apexUiSfxGain = 1;
        cache.set(key, el);
      }
      applyLevel(el);
      return el;
    }

    function isSuppressed(key) {
      const guards = SUPPRESSED_BY[key];
      if (!guards) return false;
      for (const guard of guards) {
        const el = cache.get(guard);
        if (el && !el.paused && !el.ended) return true;
      }
      return false;
    }

    // Readiness uses the SAME cached media element that play() will use.
    // It never calls play(), never creates a second element, and never claims
    // success from preload metadata alone. A short safety fuse prevents a bad
    // asset/network from stranding a scene transition forever.
    function warm(list, timeoutMs) {
      const requested = Array.isArray(list) && list.length
        ? [...new Set(list.map(canonicalFor).filter(Boolean))]
        : keys();
      const timeout = Math.max(250, Number(timeoutMs) || 5000);
      const waits = [];
      const warmed = [];

      for (const key of requested) {
        const el = elementFor(key);
        if (!el) continue;
        warmed.push(key);
        const startedAt = (win.performance && win.performance.now) ? win.performance.now() : Date.now();
        const prior = warmEvidence.get(key);
        if (Number(el.readyState) >= 3) {
          warmEvidence.set(key, {
            key, startedAt: prior?.startedAt ?? startedAt, settledAt: startedAt,
            ready: true, readyState: Number(el.readyState) || 0, reason: 'already-ready',
          });
          continue;
        }

        waits.push(new Promise((resolve) => {
          let settled = false;
          let timer = 0;
          const done = (ready, reason) => {
            if (settled) return;
            settled = true;
            if (timer) win.clearTimeout(timer);
            if (typeof el.removeEventListener === 'function') {
              el.removeEventListener('canplay', onReady);
              el.removeEventListener('canplaythrough', onReady);
              el.removeEventListener('loadeddata', onLoaded);
              el.removeEventListener('error', onError);
            }
            const at = (win.performance && win.performance.now) ? win.performance.now() : Date.now();
            const rec = {
              key, startedAt: prior?.startedAt ?? startedAt, settledAt: at,
              ready: !!ready, readyState: Number(el.readyState) || 0, reason,
            };
            warmEvidence.set(key, rec);
            resolve(rec);
          };
          const onReady = () => done(true, 'canplay');
          const onLoaded = () => {
            if (Number(el.readyState) >= 3) done(true, 'loadeddata-ready');
          };
          const onError = () => done(false, 'error');

          warmEvidence.set(key, {
            key, startedAt: prior?.startedAt ?? startedAt, settledAt: null,
            ready: false, readyState: Number(el.readyState) || 0, reason: 'warming',
          });

          if (typeof el.addEventListener === 'function') {
            el.addEventListener('canplay', onReady, { once: true });
            el.addEventListener('canplaythrough', onReady, { once: true });
            el.addEventListener('loadeddata', onLoaded, { once: true });
            el.addEventListener('error', onError, { once: true });
          }
          timer = win.setTimeout(() => done(Number(el.readyState) >= 2, 'timeout'), timeout);
          try {
            if (typeof el.load === 'function') el.load();
            else if (Number(el.readyState) >= 3) done(true, 'already-ready');
          } catch (_) {
            done(false, 'load-error');
          }
        }));
      }

      return Promise.all(waits).then((settled) => ({
        warmed,
        ready: warmed.filter((key) => warmEvidence.get(key)?.ready).length,
        settled: settled.length,
      }));
    }

    function play(key, options2) {
      const o = options2 || {};
      const canonical = canonicalFor(key);
      if (!canonical) return false;
      if (muted && !o.force) return false;
      if (isSuppressed(canonical)) return false;
      const alias = aliasFor(key);
      const now = (win.performance && win.performance.now) ? win.performance.now() : Date.now();
      if (!o.ignoreDebounce) {
        const last = lastPlayed.get(key) || -Infinity;
        const throttleMs = Math.max(
          canonical === 'ui.focus.move' ? FOCUS_MOVE_DEBOUNCE_MS : 0,
          Math.max(0, Number(alias?.throttleMs) || 0),
        );
        if (throttleMs && now - last < throttleMs) return false;
      }
      lastPlayed.set(key, now);
      const el = elementFor(canonical);
      if (!el) return false;
      el.__apexUiSfxGain = Math.max(0, Math.min(1, Number(alias?.gain ?? 1) || 0));
      try { el.playbackRate = Math.max(0.5, Math.min(2, Number(alias?.rate ?? 1) || 1)); } catch (error) { /* rate is optional */ }
      applyLevel(el);
      try { el.currentTime = 0; } catch (error) { /* not seekable yet */ }
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay/gesture policy: a UI cue never manufactures playback.
        });
      }
      return true;
    }

    // Continuous voices (e.g. the single Lucky Draw machine-run voice). Starting
    // an already-running voice is a no-op, so the cue is ONE continuous sound and
    // never restarts or stacks.
    function startLoop(key) {
      const canonical = canonicalFor(key);
      if (!canonical) return false;
      if (muted) return false;
      if (isSuppressed(canonical)) return false;
      const el = elementFor(canonical);
      if (!el) return false;
      const alias = aliasFor(key);
      el.__apexUiSfxGain = Math.max(0, Math.min(1, Number(alias?.gain ?? 1) || 0));
      try { el.playbackRate = Math.max(0.5, Math.min(2, Number(alias?.rate ?? 1) || 1)); } catch (error) { /* rate is optional */ }
      applyLevel(el);
      el.loop = true;
      if (!el.paused && !el.ended) return true; // already the ONE continuous voice
      try { el.currentTime = 0; } catch (error) { /* not seekable yet */ }
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      return true;
    }

    function stop(key) {
      const el = cache.get(canonicalFor(key));
      if (!el) return false;
      el.loop = false;
      try { el.pause(); el.currentTime = 0; } catch (error) { /* ignore */ }
      return true;
    }

    // Debounced focus movement: rapid keyboard/pointer focus changes produce a
    // single cue instead of one per event.
    function focusMove(key) {
      const k = key || 'ui.focus.move';
      pendingFocus = k;
      if (focusTimer) return false;
      focusTimer = win.setTimeout(() => {
        focusTimer = 0;
        const target = pendingFocus;
        pendingFocus = null;
        if (target) play(target);
      }, FOCUS_MOVE_DEBOUNCE_MS);
      return true;
    }

    const api = {
      keys,
      aliases,
      canonicalFor,
      urlFor,
      // Semantic playback. Never creates an element per call.
      play,
      focusMove,
      startLoop,
      stop,
      // Separate UI-SFX level/mute (MUSIC mute is untouched by these).
      setVolume: (v) => { volume = Math.max(0, Math.min(1, Number(v))); for (const el of cache.values()) applyLevel(el); return volume; },
      volume: () => volume,
      mute: () => { muted = true; for (const el of cache.values()) applyLevel(el); return muted; },
      unmute: () => { muted = false; for (const el of cache.values()) applyLevel(el); return muted; },
      toggleMute: () => (muted ? api.unmute() : api.mute()),
      isMuted: () => muted,
      // Lightweight legacy preload creates the SAME cached elements. Scene
      // readiness should use warm(), which also waits for media readiness.
      preload: (list) => {
        const target = Array.isArray(list) && list.length
          ? [...new Set(list.map(canonicalFor).filter(Boolean))]
          : keys();
        let warmed = 0;
        for (const key of target) { if (elementFor(key)) warmed += 1; }
        return warmed;
      },
      warm,
      warmStatus: () => [...warmEvidence.values()].map((rec) => ({ ...rec })),
      state: () => ({
        volume, muted, cached: cache.size, keys: keys().length, aliases: aliases().length,
        suppressed: Object.keys(SUPPRESSED_BY).length,
        warming: [...warmEvidence.values()].filter((rec) => rec.settledAt == null).length,
        warmReady: [...warmEvidence.values()].filter((rec) => rec.ready).length,
      }),
    };

    win.apexUiSfx = api;
    return api;
  }

  const scope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (scope) {
    scope.installUiSfxAuthority = installUiSfxAuthority;
    if (!scope.__apexUiSfxAutoInstalled) {
      scope.__apexUiSfxAutoInstalled = true;
      try { installUiSfxAuthority({ window: scope }); } catch (error) { /* headless stubs */ }
    }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { installUiSfxAuthority, KEYS, ALIASES, ROOT, UI_SFX_VOLUME };
  }
})();
