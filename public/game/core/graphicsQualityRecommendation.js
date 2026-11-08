/* APEX CHAOS — LOW PERFORMANCE RECOMMENDATION ADVISOR.
 *
 * Watches real frame timing while a HIGH-mode battle is actually being played
 * and offers PERFORMANCE mode. It NEVER switches by itself: the player must
 * press SWITCH.
 *
 * Detection law (owner spec)
 *   - 4 000 ms rolling windows; the first 4 500 ms of a match are warm-up.
 *   - Three consecutive bad windows (≈12 s of sustained cost) are required.
 *   - A window is bad when p95 frame time > 38 ms (≈26 fps) AND at least 20 %
 *     of frames exceed 25 ms (≈40 fps) AND the display refreshes ≥ 50 Hz, so a
 *     30/60 Hz-capped device is never blamed for its own refresh rate.
 *   - Frames are ignored while: boot / scene transition / pause / tab hidden /
 *     resize / recording setup / mode already PERFORMANCE.
 *   - After showing once, the advisor is silent for 10 minutes or until the
 *     match ends (once per match), whichever is longer.
 *
 * Presentation
 *   #apex-quality-advisor  role=alertdialog, title "LOW PERFORMANCE DETECTED",
 *                          SWITCH + DISMISS, auto-dismiss after 5 s with a
 *                          draining life rail, safe-area aware, keyboard
 *                          reachable, focus restored to the prior element.
 *   #apex-quality-toast    "PERFORMANCE MODE ACTIVE" confirmation after switch.
 *
 * Test hooks (never used by production logic): _evaluate(stats), _forceRecommend(),
 * showNow(), _reset(), _debug().
 */
(function installGraphicsQualityAdvisor(global) {
  'use strict';
  if (global.APEX_GRAPHICS_ADVISOR && global.APEX_GRAPHICS_ADVISOR.version) return;

  var VERSION = 'graphics-advisor-1';
  var WINDOW_MS = 4000;
  var WARMUP_MS = 4500;
  var CONFIRM_WINDOWS = 3;
  var P95_LIMIT_MS = 38;
  var SLOW_FRAME_MS = 25;
  var SLOW_RATIO_LIMIT = 0.2;
  // Retained for diagnostics/tests only. The verdict no longer uses a flat Hz
  // floor (see isRefreshCapped): a 14 Hz device must still be offered
  // PERFORMANCE, while a genuine 30 Hz panel must not be blamed for its own
  // refresh rate.
  var MIN_REFRESH_HZ = 50;
  var COOLDOWN_MS = 10 * 60 * 1000;
  var PANEL_MS = 5000;
  var TICK_MS = 500;

  function authority() {
    return global.APEX_GRAPHICS_QUALITY || null;
  }

  var state = {
    active: false,        // a match is running and timing is meaningful
    running: false,       // sampler attached
    windows: [],          // recent window verdicts (bool)
    lastRecommend: 0,
    shownAt: 0,
    panelOpen: false,
    cooldownUntil: 0,
    matchId: 0,
    suppressedReason: '',
    frames: 0,
    windowsSeen: 0,
    recommendCount: 0,
    switchCount: 0,
    dismissed: 0,
  };

  // ------------------------------------------------------------- sampling --
  var frameTimes = [];
  var rafId = 0;
  var lastTs = 0;
  var matchStart = 0;
  var refreshHz = 60;
  var refreshSamples = [];

  function supportsRaf() {
    return typeof global.requestAnimationFrame === 'function';
  }

  function sampleRaf(ts) {
    if (!state.running) return;
    if (lastTs) {
      var dt = ts - lastTs;
      // Ignore absurd gaps: tab switch, debugger pause, OS sleep.
      if (dt > 0 && dt < 500) {
        frameTimes.push(dt);
        state.frames += 1;
        if (refreshSamples.length < 240) refreshSamples.push(dt);
      }
    }
    lastTs = ts;
    rafId = global.requestAnimationFrame(sampleRaf);
  }

  /**
   * Panel refresh rate, derived from the FASTEST frames in the window.
   *
   * A device that is coping presents some frames exactly at its panel interval,
   * so the low percentile of frame times is refresh-locked even while the
   * game is struggling. Using the median instead would report the average
   * frame rate and make a 60 Hz panel look like a 20 Hz panel — which then
   * wrongly excuses the slowdown as "refresh capped". The separate rAF stream
   * is only a fallback for windows with too few samples to trust.
   */
  function estimateRefreshHz(frames) {
    var source = (frames && frames.length >= 30) ? frames : refreshSamples;
    if (!source || !source.length) return refreshHz;
    var sorted = source.slice().sort(function (a, b) { return a - b; });
    var fast = sorted[Math.max(0, Math.floor(sorted.length * 0.1))];
    if (!(fast > 0)) return refreshHz;
    var hz = 1000 / fast;
    // Snap to the common panels so a 59.7 Hz measurement still reads as 60.
    var candidates = [24, 30, 48, 50, 60, 72, 75, 90, 120, 144, 165, 240];
    var best = 60;
    var bestErr = Infinity;
    for (var i = 0; i < candidates.length; i += 1) {
      var err = Math.abs(candidates[i] - hz);
      if (err < bestErr) { bestErr = err; best = candidates[i]; }
    }
    return bestErr <= 6 ? best : Math.round(hz);
  }

  function percentile(values, p) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
    return sorted[idx];
  }

  /**
   * Is this device simply running at its own panel rate?
   *
   * The original rule ("ignore anything under 50 Hz") was wrong: a device
   * delivering 70 ms frames measured 14 Hz and was silently excluded as
   * "refresh-capped", so the one machine that most needed the offer never got
   * it. The honest test for a refresh cap is that the median frame interval
   * EQUALS a real panel interval — the device is keeping up with a slow
   * display. A device that is merely slow shows a median well above every
   * panel interval, which is exactly the case we must not exempt.
   *
   * Guarded rates are the panel rates a product actually meets: 24/30/48 Hz.
   * Anything faster than that is a target the game is expected to hit, so no
   * exemption applies.
   */
  var PANEL_RATES = [24, 30, 48];
  /**
   * Decide the cap from the MEDIAN FRAME INTERVAL only.
   *
   * The reported `hz` is snapped to a nearby common panel rate for display,
   * so it must never feed this test: a 38.5 ms cadence rounded to "24 Hz" and
   * was then exempted as a capped display even though the device was simply
   * slow. Comparing the raw median against each panel interval with a tight
   * tolerance (5.5 %, i.e. well under one rAF jitter tick) tests the only claim
   * that matters — "the median frame landed exactly on a display tick".
   */
  function isRefreshCapped(hz, p50) {
    if (!(p50 > 0)) return false;
    for (var i = 0; i < PANEL_RATES.length; i += 1) {
      var interval = 1000 / PANEL_RATES[i];
      if (Math.abs(p50 - interval) <= interval * 0.055) return true;
    }
    return false;
  }

  /** Reduce one window of frame times to its verdict + diagnostics. */
  function analyse(frames) {
    if (!frames || frames.length < 30) {
      return { ok: false, reason: 'too-few-frames', n: frames ? frames.length : 0, p50: 0, p95: 0, slowRatio: 0, hz: refreshHz };
    }
    var p50 = percentile(frames, 0.5);
    var p95 = percentile(frames, 0.95);
    var slow = 0;
    for (var i = 0; i < frames.length; i += 1) if (frames[i] > SLOW_FRAME_MS) slow += 1;
    var slowRatio = slow / frames.length;
    var hz = estimateRefreshHz(frames);
    var capped = isRefreshCapped(hz, p50);
    var bad = p95 > P95_LIMIT_MS && slowRatio >= SLOW_RATIO_LIMIT && !capped;
    return {
      ok: bad,
      n: frames.length,
      p50: Math.round(p50 * 10) / 10,
      p95: Math.round(p95 * 10) / 10,
      slowRatio: Math.round(slowRatio * 100) / 100,
      hz: hz,
      capped: capped,
      reason: bad ? 'slow' : (p95 <= P95_LIMIT_MS ? 'p95-ok' : (capped ? 'refresh-capped' : (slowRatio < SLOW_RATIO_LIMIT ? 'rare-slow' : 'hz-unknown'))),
    };
  }

  // -------------------------------------------------------------- context --
  function battleIsReal() {
    var fighters = global.fighters;
    if (!Array.isArray(fighters) || fighters.length < 2) return 'no-fighters';
    var alive = 0;
    for (var i = 0; i < fighters.length; i += 1) {
      if (fighters[i] && Number(fighters[i].hp) > 0) alive += 1;
    }
    if (alive < 2) return 'match-over';
    if (global.gameState && global.gameState !== 'BATTLE' && global.gameState !== 'ARSENAL') return 'not-battle';
    return '';
  }

  function visibilityOk() {
    try {
      if (global.document && global.document.visibilityState === 'hidden') return false;
    } catch (e) { /* ignore */ }
    return true;
  }

  /** Everything that must never be blamed on steady-state combat cost. */
  function suppressionReason() {
    var a = authority();
    if (!a) return 'no-authority';
    if (a.mode === a.PERFORMANCE) return 'already-performance';
    if (!state.active) return 'inactive';
    if (!visibilityOk()) return 'hidden';
    var body = global.document && global.document.body;
    if (body && body.classList) {
      // Shell transition / battle hand-off / HUD mounting are excluded.
      if (body.classList.contains('battle-transition-active')) return 'transition';
      if (body.classList.contains('is-preloading')) return 'transition';
      if (body.dataset && body.dataset.apexSceneTransition && body.dataset.apexSceneTransition !== 'DONE') return 'transition';
    }
    var real = battleIsReal();
    if (real) return real;
    if (global.paused === true) return 'paused';
    if (global.isPaused === true) return 'paused';
    if (global.matchPaused === true) return 'paused';
    if (global.__apexResizing || (global.APEX_SCENE_TRANSITION && global.APEX_SCENE_TRANSITION.isBusy)) return 'resize';
    return '';
  }

  function inCooldown() {
    var now = Date.now();
    if (state.cooldownUntil && now < state.cooldownUntil) return true;
    return false;
  }

  // ------------------------------------------------------------ evaluation --
  function evaluate(frames, opts) {
    var force = !!(opts && opts.force);
    var why = force ? '' : suppressionReason();
    state.suppressedReason = why;
    if (why) {
      // A suppressed window must not count toward the confirmation streak.
      return { recommend: false, suppressed: why };
    }
    var verdict = analyse(frames);
    state.windowsSeen += 1;
    state.windows.push(verdict.ok);
    if (state.windows.length > CONFIRM_WINDOWS) state.windows.shift();
    var streak = state.windows.length === CONFIRM_WINDOWS && state.windows.every(Boolean);
    if (!streak) return { recommend: false, verdict: verdict, streak: state.windows.slice() };
    if (inCooldown()) return { recommend: false, verdict: verdict, streak: state.windows.slice(), cooldown: true };
    state.windows.length = 0;
    recommend(verdict);
    return { recommend: true, verdict: verdict };
  }

  function recommend(verdict) {
    state.lastRecommend = Date.now();
    state.recommendCount += 1;
    show(verdict);
  }

  // ---------------------------------------------------------------- panel --
  var panel = null;
  var toast = null;
  var panelTimer = 0;
  var hideToken = 0;
  var toastTimer = 0;
  var previousFocus = null;

  function ensureStyles() {
    if (global.document.getElementById('apex-graphics-quality-ui-css')) return;
    var link = global.document.createElement('link');
    link.id = 'apex-graphics-quality-ui-css';
    link.rel = 'stylesheet';
    // Same relative root as every other core runtime; the packaging step makes
    // this URL relative for the nested itch.io path.
    // No leading slash on purpose: the itch packaging rewrite would turn a
    // root-absolute literal into '../game/...', which escapes the app root
    // whenever this document is the shell (not the Gold subtree). APEX_APP_URL
    // resolves against the entry base and is immune to <base> retargeting.
    var rel = 'game/core/graphicsQualityUi.css';
    var href = '';
    try {
      href = (typeof global.APEX_APP_URL === 'function' && global.APEX_APP_URL(rel)) ||
        new URL(rel, global.document.baseURI || global.location.href).href;
    } catch (e) {
      href = rel;
    }
    link.href = href;
    link.dataset.apexGraphicsUi = 'true';
    (global.document.head || global.document.documentElement).appendChild(link);
  }

  function ensurePanel() {
    if (panel && panel.isConnected) return panel;
    var doc = global.document;
    if (!doc || !doc.body) return null;
    panel = doc.createElement('div');
    panel.id = 'apex-quality-advisor';
    panel.className = 'aqa';
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-live', 'assertive');
    panel.setAttribute('aria-labelledby', 'aqa-title');
    panel.setAttribute('aria-describedby', 'aqa-body');
    panel.hidden = true;
    panel.innerHTML =
      '<div class="aqa-card">' +
        '<div class="aqa-rail" aria-hidden="true"></div>' +
        '<p class="aqa-kicker">APEX / SYSTEM</p>' +
        '<h2 class="aqa-title" id="aqa-title">LOW PERFORMANCE DETECTED</h2>' +
        '<p class="aqa-body" id="aqa-body">Frame rate has stayed low for several seconds. PERFORMANCE mode keeps every ability, telegraph and hit effect while trimming redundant rendering. Nothing changes until you choose.</p>' +
        '<div class="aqa-actions">' +
          '<button type="button" class="aqa-btn aqa-btn-primary" data-aqa-action="switch">SWITCH TO PERFORMANCE</button>' +
          '<button type="button" class="aqa-btn aqa-btn-ghost" data-aqa-action="dismiss">KEEP HIGH</button>' +
        '</div>' +
        '<div class="aqa-life" aria-hidden="true"><i></i></div>' +
      '</div>';
    doc.body.appendChild(panel);
    panel.querySelector('[data-aqa-action="switch"]').addEventListener('click', onSwitch);
    panel.querySelector('[data-aqa-action="dismiss"]').addEventListener('click', onDismiss);
    panel.addEventListener('keydown', onPanelKeydown);
    return panel;
  }

  function ensureToast() {
    if (toast && toast.isConnected) return toast;
    var doc = global.document;
    if (!doc || !doc.body) return null;
    toast = doc.createElement('div');
    toast.id = 'apex-quality-toast';
    toast.className = 'aqt';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.hidden = true;
    doc.body.appendChild(toast);
    return toast;
  }

  function show(verdict) {
    var el = ensurePanel();
    if (!el) return;
    ensureStyles();
    state.panelOpen = true;
    state.shownAt = Date.now();
    // Re-showing restarts the 5 s life rail from full, and invalidates any
    // pending exit completion so it cannot hide what we are showing now.
    hideToken += 1;
    el.classList.remove('is-leaving');
    el.hidden = false;
    // Force a style flush so the rail animation restarts on repeat shows.
    void el.offsetWidth;
    el.classList.add('is-open');
    el.dataset.verdict = verdict ? JSON.stringify({ p95: verdict.p95, slowRatio: verdict.slowRatio, hz: verdict.hz, n: verdict.n }) : '';
    var btn = el.querySelector('[data-aqa-action="switch"]');
    try {
      previousFocus = global.document.activeElement;
      // Focus the safe action, not the destructive one.
      (el.querySelector('[data-aqa-action="dismiss"]') || btn).focus({ preventScroll: true });
    } catch (e) { /* ignore */ }
    clearTimeout(panelTimer);
    panelTimer = setTimeout(function () { hide('auto'); }, PANEL_MS);
    // Cooldown starts when it was shown, not when it is dismissed.
    state.cooldownUntil = Date.now() + COOLDOWN_MS;
  }

  function hide(reason) {
    if (!panel || panel.hidden) return;
    clearTimeout(panelTimer);
    panel.classList.remove('is-open');
    panel.classList.add('is-leaving');
    // Deferred completion must not land on a panel that has been SHOWN again in
    // the meantime. Without this guard a show() within the 180 ms exit window
    // is silently undone by the stale timer: the panel keeps `is-open` (so DOM
    // assertions still pass) while `hidden` is true, i.e. invisible.
    var token = ++hideToken;
    var finish = function () {
      if (!panel || token !== hideToken || state.panelOpen) return;
      panel.hidden = true;
      panel.classList.remove('is-leaving');
    };
    // Must not depend on transitionend: reduced-motion skips transitions.
    setTimeout(finish, 180);
    state.panelOpen = false;
    try {
      if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
    } catch (e) { /* ignore */ }
    previousFocus = null;
    return reason;
  }

  function onSwitch(event) {
    if (event) event.preventDefault();
    var a = authority();
    hide('switch');
    if (!a) return;
    state.switchCount += 1;
    a.set(a.PERFORMANCE, 'advisor');
    showToast('PERFORMANCE MODE ACTIVE');
  }

  function onDismiss(event) {
    if (event) event.preventDefault();
    state.dismissed += 1;
    hide('dismiss');
  }

  function onPanelKeydown(event) {
    if (!event) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      onDismiss(event);
      return;
    }
    if (event.key === 'Tab') {
      // Small focus trap: the dialog is modal in intent even though the match
      // keeps running behind it.
      var focusables = panel.querySelectorAll('button');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && global.document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && global.document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  }

  function showToast(text) {
    var el = ensureToast();
    if (!el) return;
    ensureStyles();
    el.textContent = text || 'PERFORMANCE MODE ACTIVE';
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (!el) return;
      el.classList.remove('is-open');
      setTimeout(function () { if (el) el.hidden = true; }, 200);
    }, 3200);
  }

  // --------------------------------------------------------------- driver --
  var tickTimer = 0;
  var windowFrames = [];

  function tick() {
    if (!state.running) return;
    var now = Date.now();
    if (!matchStart) matchStart = now;
    // Warm-up: never judge the first frames of a match (asset decoding, JIT,
    // HUD mount). Warm-up frames are discarded, not merely ignored.
    if (now - matchStart < WARMUP_MS) {
      frameTimes.length = 0;
      refreshSamples.length = 0;
      return;
    }
    // Move the sampled frames into this window and evaluate.
    windowFrames = frameTimes.splice(0, frameTimes.length);
    if (!windowFrames.length) return;
    evaluate(windowFrames);
  }

  function startSampler() {
    if (state.running || !supportsRaf()) return;
    state.running = true;
    lastTs = 0;
    rafId = global.requestAnimationFrame(sampleRaf);
    tickTimer = setInterval(tick, TICK_MS);
  }

  function stopSampler() {
    state.running = false;
    if (rafId) { try { global.cancelAnimationFrame(rafId); } catch (e) {} rafId = 0; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
    frameTimes.length = 0;
    refreshSamples.length = 0;
    state.windows.length = 0;
  }

  function reset() {
    stopSampler();
    state.active = false;
    state.matchId += 1;
    matchStart = 0;
    state.windows.length = 0;
    hide('reset');
  }

  function beginMatch() {
    reset();
    state.active = true;
    matchStart = 0;
    // Once per match: a new match clears the once-per-match cooldown floor but
    // keeps the 10-minute floor, which is the stricter of the two.
    startSampler();
  }

  function endMatch() {
    state.active = false;
    hide('match-end');
    stopSampler();
  }

  // ------------------------------------------------------------- listeners --
  var disposers = [];
  function listen(target, type, fn, opts) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, fn, opts);
    disposers.push(function () { try { target.removeEventListener(type, fn, opts); } catch (e) {} });
  }

  listen(global, 'apex-match-start', function () { beginMatch(); });
  listen(global, 'apex:battle-live', function () { beginMatch(); });
  listen(global, 'apex-match-end', function () { endMatch(); });
  listen(global, 'apex-battle-exit', function () { endMatch(); });
  listen(global, 'apex-graphics-quality', function (event) {
    var detail = event && event.detail;
    // Becoming PERFORMANCE ends the advisor's job for this match.
    if (detail && detail.mode === 'performance') {
      state.windows.length = 0;
      hide('mode-changed');
    }
  });

  var api = {
    version: VERSION,
    PANEL_MS: PANEL_MS,
    WINDOW_MS: WINDOW_MS,
    COOLDOWN_MS: COOLDOWN_MS,
    state: state,
    start: beginMatch,
    stop: endMatch,
    isOpen: function () { return !!(panel && !panel.hidden); },
    showNow: function (verdict) { show(verdict); },
    dispose: function () {
      stopSampler();
      while (disposers.length) { try { disposers.pop()(); } catch (e) {} }
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
      panel = null; toast = null;
    },
    _test: {
      analyse: analyse,
      evaluate: evaluate,
      // Test/diagnostic hooks: `force` skips the "is this a real battle frame"
      // context gate so the panel can be exercised in isolation. Production
      // code never passes it.
      evaluateWithForce: function (frames) { return evaluate(frames, { force: true }); },
      forceRecommend: function () { recommend(analyse([40, 40, 40, 40, 40])); },
      suppressionReason: suppressionReason,
      hide: function () { return hide('test'); },
      // Detach/reattach the live rAF sampler. Without this a deterministic
      // three-window sequence cannot be observed: the real sampler keeps
      // producing its own windows (and on a genuinely slow device it will
      // legitimately re-show the panel 500 ms after a hide()).
      pause: function () { stopSampler(); return state.running; },
      resume: function () { startSampler(); return state.running; },
      reset: function () { state.cooldownUntil = 0; state.windows.length = 0; state.recommendCount = 0; },
      debug: function () {
        return {
          active: state.active, running: state.running, windows: state.windows.slice(),
          cooldownUntil: state.cooldownUntil, suppressedReason: state.suppressedReason,
          recommendCount: state.recommendCount, switchCount: state.switchCount,
          panelOpen: state.panelOpen, frames: state.frames, hz: refreshHz,
        };
      },
    },
  };

  try {
    Object.defineProperty(global, 'APEX_GRAPHICS_ADVISOR', { value: api, writable: false, configurable: true, enumerable: true });
  } catch (e) {
    global.APEX_GRAPHICS_ADVISOR = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
