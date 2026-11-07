/* APEX CHAOS — GRAPHICS QUALITY AUTHORITY (single source of truth).
 *
 * Owner law: exactly ONE place knows which graphics mode is active. Every
 * renderer, iframe and setting reads from here; nothing else may keep its own
 * `localStorage` key, URL flag or window boolean for graphics quality.
 *
 * Contract
 *   window.APEX_GRAPHICS_QUALITY = {
 *     version, MODES, STORAGE_KEY,
 *     mode, chosen, performance, high,     // readable properties
 *     state(),                              // frozen snapshot
 *     set(mode, source),                    // the ONLY writer
 *     toggle(source),
 *     subscribe(fn) -> unsubscribe,         // fires on real change only
 *     adopt(mode, source),                  // mirror an iframe/parent authority
 *     REVISION
 *   }
 *
 * Events
 *   window 'apex-graphics-quality'  CustomEvent {detail: snapshot}  (in-page)
 *   window 'apex:graphics-quality'  CustomEvent {detail: snapshot}  (compat alias)
 *
 * Cross-frame
 *   Same-origin child frames receive a postMessage mirror on adoption and on
 *   every change, and can raise 'apex:graphics-quality-ask' to get a reply. A
 *   child that adopts still owns its own listeners/settings UI, but it never
 *   becomes an independent writer unless the parent is absent.
 *
 * Persistence
 *   `apexChaos.graphicsQuality.v1` = { mode: 'high' | 'performance' }.
 *   Default HIGH. Unknown/corrupt values fall back to HIGH rather than
 *   silently downgrading a player's fidelity.
 */
(function installGraphicsQualityAuthority(global) {
  'use strict';
  if (global.APEX_GRAPHICS_QUALITY && global.APEX_GRAPHICS_QUALITY.version) return;

  var VERSION = 'graphics-quality-1';
  var REVISION = 'apex-gfx-20261108-1';
  var STORAGE_KEY = 'apexChaos.graphicsQuality.v1';
  var HIGH = 'high';
  var PERFORMANCE = 'performance';
  var MODES = Object.freeze([HIGH, PERFORMANCE]);

  function normalise(value) {
    var v = String(value == null ? '' : value).trim().toLowerCase();
    if (v === 'performance' || v === 'perf' || v === 'low') return PERFORMANCE;
    if (v === 'high' || v === 'quality' || v === 'full') return HIGH;
    return null;
  }

  function readStored() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return normalise(parsed.mode);
      return normalise(parsed);
    } catch (e) {
      return null;
    }
  }

  function writeStored(mode) {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: mode, v: 1 }));
    } catch (e) {
      /* private mode / quota — the in-memory authority stays correct */
    }
  }

  var initial = readStored();
  // `chosen` is what the player (or an adopting frame) selected; `mode` is the
  // mode actually in force. They only diverge while an external-consent path
  // is pending, which this authority never does on its own.
  var chosen = initial || HIGH;
  var mode = chosen;
  var source = initial ? 'storage' : 'default';
  var listeners = [];
  var revision = 0;

  function state() {
    return Object.freeze({
      version: VERSION,
      mode: mode,
      chosen: chosen,
      source: source,
      high: mode === HIGH,
      performance: mode === PERFORMANCE,
      stored: readStored(),
      revision: revision,
      modes: MODES,
      storageKey: STORAGE_KEY,
    });
  }

  var snapshot = state();
  function refresh() {
    revision += 1;
    snapshot = state();
    return snapshot;
  }

  function emit(reason) {
    var detail = snapshot;
    detail.reason = reason;
    try {
      global.dispatchEvent(new global.CustomEvent('apex-graphics-quality', { detail: detail }));
    } catch (e) { /* very old engines */ }
    try {
      global.dispatchEvent(new global.CustomEvent('apex:graphics-quality', { detail: detail }));
    } catch (e) { /* compat alias best effort */ }
    for (var i = 0; i < listeners.length; i += 1) {
      try {
        listeners[i](detail);
      } catch (e) {
        /* a subscriber must never break the authority */
      }
    }
    mirrorToFrames(detail);
  }

  // ------------------------------------------------------------- frames ---
  // Same-origin child frames (the battle HUD iframe) get the mode pushed so a
  // switch made in the shell applies mid-battle with no reload. The mirror is
  // one-way from this authority; a child may ask for the current value.
  var MIRROR_TYPE = 'apex:graphics-quality-mirror';
  var ASK_TYPE = 'apex:graphics-quality-ask';
  var REPLY_TYPE = 'apex:graphics-quality-state';

  function sameOriginWindow(win) {
    try {
      // Throws for cross-origin windows — exactly the guard we want.
      return !!(win && win.document && win.document.location);
    } catch (e) {
      return false;
    }
  }

  function eachChildFrame(fn) {
    var frames;
    try {
      frames = global.document && global.document.querySelectorAll('iframe');
    } catch (e) {
      return;
    }
    if (!frames) return;
    for (var i = 0; i < frames.length; i += 1) {
      var win = null;
      try {
        win = frames[i].contentWindow;
      } catch (e) {
        win = null;
      }
      if (!sameOriginWindow(win)) continue;
      fn(win, frames[i]);
    }
  }

  function mirrorToFrames(detail) {
    // Two targets per child frame: the frame window itself and any runtime
    // registered on its contentWindow. Both are same-origin windows only.
    eachChildFrame(function (win) {
      try {
        win.postMessage({ type: MIRROR_TYPE, detail: { mode: detail.mode, source: 'parent', revision: detail.revision, version: VERSION } }, '*');
      } catch (e) { /* frame navigating */ }
    });
  }

  function answerAsk(win) {
    try {
      win.postMessage({ type: REPLY_TYPE, detail: { mode: mode, source: source, revision: revision, version: VERSION } }, '*');
    } catch (e) { /* frame gone */ }
  }

  try {
    global.addEventListener('message', function (event) {
      var data = event && event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === ASK_TYPE) {
        if (event.source) answerAsk(event.source);
        return;
      }
      // A child that legitimately became the writer (standalone HUD) can push
      // its choice back up; the shell adopts it so both stay identical.
      if (data.type === MIRROR_TYPE && data.detail) {
        var next = normalise(data.detail.mode);
        if (next && next !== mode) adopt(next, data.detail.source || 'frame');
      }
    });
  } catch (e) { /* no window events in this environment */ }

  // ---------------------------------------------------------------- API ---
  function set(next, why) {
    var value = normalise(next);
    if (!value) return snapshot;
    var reason = String(why || 'set');
    if (value === mode) {
      // Still record the explicit choice so a later storage read is stable,
      // but do not notify: no renderer state changed.
      if (chosen !== value) chosen = value;
      writeStored(value);
      snapshot = refresh();
      return snapshot;
    }
    chosen = value;
    mode = value;
    source = reason;
    writeStored(value);
    snapshot = refresh();
    emit(reason);
    return snapshot;
  }

  function adopt(next, why) {
    // Adopted values are authoritative but must not write storage in a child
    // frame that does not own the player's preference. The writer decides.
    var value = normalise(next);
    if (!value || value === mode) return snapshot;
    mode = value;
    chosen = value;
    source = String(why || 'adopt');
    snapshot = refresh();
    emit(source);
    return snapshot;
  }

  function toggle(why) {
    return set(mode === HIGH ? PERFORMANCE : HIGH, why || 'toggle');
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function unsubscribe() {
      var at = listeners.indexOf(fn);
      if (at >= 0) listeners.splice(at, 1);
    };
  }

  var api = {
    version: VERSION,
    REVISION: REVISION,
    MODES: MODES,
    HIGH: HIGH,
    PERFORMANCE: PERFORMANCE,
    STORAGE_KEY: STORAGE_KEY,
    get mode() { return mode; },
    get chosen() { return chosen; },
    get performance() { return mode === PERFORMANCE; },
    get high() { return mode === HIGH; },
    get source() { return source; },
    state: state,
    set: set,
    adopt: adopt,
    toggle: toggle,
    subscribe: subscribe,
    // Diagnostics only — nothing outside this file may write these.
    _test: {
      readStored: readStored,
      clearStorage: function () { try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) {} },
    },
  };

  try {
    Object.defineProperty(global, 'APEX_GRAPHICS_QUALITY', {
      value: api,
      writable: false,
      configurable: true,
      enumerable: true,
    });
  } catch (e) {
    global.APEX_GRAPHICS_QUALITY = api;
  }

  // Announce readiness so late subscribers can attach without polling. The
  // first state is available synchronously through state().
  try {
    global.dispatchEvent(new global.CustomEvent('apex-graphics-quality-ready', { detail: snapshot }));
  } catch (e) { /* ignore */ }

  // Same-origin frames that boot later must still be told the current mode,
  // and a frame that mounts after a change asks once and gets a reply.
  if (global.document) {
    try {
      var onFrameLoad = function () { mirrorToFrames(snapshot); };
      global.document.addEventListener('load', onFrameLoad, true);
    } catch (e) { /* ignore */ }
  }
})(typeof window !== 'undefined' ? window : globalThis);
