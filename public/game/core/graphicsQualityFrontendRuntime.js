/* APEX CHAOS — GRAPHICS QUALITY FRONTEND RUNTIME (shell-side bootstrap).
 *
 * Owns the visible entry points for the ONE quality authority:
 *   - the Gold Shell settings drawer row (#apex-graphics-open)
 *   - the settings panel host + open/close wiring
 *   - the recommendation advisor's lifecycle (start/stop per match)
 *   - the battle-HUD iframe handshake (asks the HUD frame for its mode)
 *
 * Everything here is additive: if the authority is absent the runtime reports
 * that loudly instead of guessing a mode, and if the shell has no drawer the
 * panel is still reachable through APEX_GRAPHICS_SETTINGS_UI.open().
 *
 * Readiness marker: window.apexGraphicsQualityFrontend = 'ready'.
 * Diagnostic:       window.APEX_GRAPHICS_FRONTEND.diagnose()
 */
(function installGraphicsQualityFrontendRuntime(global) {
  'use strict';
  var VERSION = 'apex-gfx-frontend-1';
  var STATE = {
    version: VERSION,
    mounted: false,
    drawerInstalled: false,
    advisorStarted: false,
    hudFrameSynced: false,
    bootAttempts: 0,
    errors: [],
  };

  function note(kind, error) {
    var message = String((error && error.message) || error || 'unknown');
    STATE.errors.push(kind + ': ' + message.slice(0, 180));
    // Never throw from the runtime: a broken settings row must not stop a
    // battle from starting.
    try { console.warn('[graphics-quality] ' + kind + ': ' + message); } catch (e) {}
  }

  function authority() { return global.APEX_GRAPHICS_QUALITY || null; }
  function settings() { return global.APEX_GRAPHICS_SETTINGS_UI || null; }
  function advisor() { return global.APEX_GRAPHICS_ADVISOR || null; }

  /** The Gold shell stage (drawer host) — same node the localization drawer uses. */
  function shellStage() {
    return global.document && global.document.querySelector('#gold-shell-host #stage');
  }

  // ------------------------------------------------------------- drawer ----
  function installDrawer() {
    var d = global.document;
    if (!d) return false;
    var existing = d.getElementById('apex-graphics-open');
    if (existing && existing.isConnected) {
      STATE.drawerInstalled = true;
      return true;
    }
    var stage = shellStage();
    var picker = d.getElementById('apex-language-picker');
    // Prefer the settings drawer (it already owns the utility section); fall
    // back to the stage so the row exists even before localization mounts.
    var host = picker && picker.isConnected ? picker : stage;
    if (!host) return false;

    var button = d.createElement('button');
    button.type = 'button';
    button.id = 'apex-graphics-open';
    button.dataset.apexNoLocalize = '';
    button.setAttribute('aria-haspopup', 'dialog');
    button.dataset.aqsMode = (authority() ? authority().mode : 'high');
    button.innerHTML =
      '<span><span class="apex-graphics-open-label">GRAPHICS / ĐỒ HOẠ</span>' +
      '<span class="apex-graphics-open-sub">Quality mode / Chế độ hiển thị</span></span>' +
      '<span class="apex-graphics-open-value" id="apex-graphics-open-value">HIGH</span>';
    // Insert before the GUIDE row so the drawer keeps its reading order:
    // LANGUAGE -> GRAPHICS -> GUIDE.
    var guide = host.querySelector('.apex-utility-help-label');
    if (guide && guide.parentNode === host) host.insertBefore(button, guide);
    else host.appendChild(button);

    button.addEventListener('click', function (event) {
      event.preventDefault();
      var ui = settings();
      if (!ui) { note('drawer-open', 'APEX_GRAPHICS_SETTINGS_UI missing'); return; }
      ui.open(d.body);
      var drawer = d.getElementById('apex-language-picker');
      // Collapse the drawer under the panel so both are not focus traps.
      if (drawer && !drawer.hidden) {
        var toggle = d.getElementById('apex-utility-toggle');
        if (toggle) toggle.click();
      }
    });
    STATE.drawerInstalled = true;
    syncDrawer();
    return true;
  }

  function syncDrawer() {
    var d = global.document;
    if (!d) return;
    var btn = d.getElementById('apex-graphics-open');
    if (!btn) return;
    var a = authority();
    var mode = a ? a.mode : 'high';
    btn.dataset.aqsMode = mode;
    var value = btn.querySelector('#apex-graphics-open-value');
    if (value) {
      var i18n = global.APEX_I18N;
      var lang = 'eng';
      try { lang = (i18n && i18n.getLanguage && i18n.getLanguage()) || 'eng'; } catch (e) {}
      value.textContent = mode === 'performance' ? (lang === 'vie' ? 'HIỆU NĂNG' : 'PERFORMANCE') : (lang === 'vie' ? 'CAO' : 'HIGH');
    }
  }

  // ------------------------------------------------------------ HUD frame --
  // The battle HUD runs in a same-origin iframe. It reads the mode from the
  // authority mirror, but it also needs to be told once at mount (an iframe
  // that starts after the last change would otherwise use its stored default).
  function syncHudFrame() {
    var d = global.document;
    if (!d) return false;
    var frame = d.getElementById('battleHudFrame') || d.querySelector('#battleHudHost iframe');
    if (!frame) return false;
    var a = authority();
    if (!a) return false;
    try {
      var win = frame.contentWindow;
      if (!win || !win.document) return false;
      // Prefer the direct call (same origin) — it is synchronous and immune to
      // message-order races; postMessage stays as the cross-check for frames
      // that adopt later.
      if (win.APEX_GRAPHICS_QUALITY && typeof win.APEX_GRAPHICS_QUALITY.adopt === 'function') {
        win.APEX_GRAPHICS_QUALITY.adopt(a.mode, 'shell-frame-sync');
        STATE.hudFrameSynced = true;
        return true;
      }
      win.postMessage({ type: 'apex:graphics-quality-mirror', detail: { mode: a.mode, source: 'shell' } }, '*');
      STATE.hudFrameSynced = true;
      return true;
    } catch (e) {
      note('hud-frame-sync', e);
      return false;
    }
  }

  // --------------------------------------------------------------- advisor --
  function startAdvisor() {
    var adv = advisor();
    if (!adv) { note('advisor', 'APEX_GRAPHICS_ADVISOR missing'); return false; }
    STATE.advisorStarted = true;
    // The advisor starts itself on apex-match-start / apex:battle-live; calling
    // start() here only makes boot order irrelevant.
    if (typeof adv.start === 'function') {
      try { adv.start(); } catch (e) { note('advisor-start', e); }
    }
    return true;
  }

  // ---------------------------------------------------------------- mount --
  function mount() {
    STATE.bootAttempts += 1;
    var a = authority();
    if (!a) { note('authority', 'APEX_GRAPHICS_QUALITY missing'); return false; }
    var ui = settings();
    if (!ui) { note('settings', 'APEX_GRAPHICS_SETTINGS_UI missing'); return false; }
    installDrawer();
    ui.sync();
    startAdvisor();
    syncHudFrame();
    if (typeof a.subscribe === 'function') {
      a.subscribe(function () {
        syncDrawer();
        try { ui.sync(); } catch (e) { note('sync', e); }
        syncHudFrame();
      });
    }
    try {
      global.addEventListener('apex:language-changed', syncDrawer);
      global.addEventListener('locale:changed', syncDrawer);
      // Mounting a HUD frame late (first match) must still receive the mode.
      global.addEventListener('apex:battle-hud-mounted', syncHudFrame);
      global.addEventListener('apex:battle-live', syncHudFrame);
      global.addEventListener('apex:graphics-quality-request-sync', syncHudFrame);
    } catch (e) { note('listeners', e); }
    STATE.mounted = true;
    return true;
  }

  // Boot strategy: mount ONCE (subscriptions and listeners must not stack),
  // then keep a short bounded loop that only retries the *drawer row*, because
  // the Gold settings drawer is created by the localization runtime and can
  // appear after this script evaluates.
  var subscribed = false;
  var drawerTries = 0;
  var MAX_DRAWER_TRIES = 60;   // ~15 s at 250 ms
  function tryMount() {
    if (STATE.mounted) return;
    var ok = mount();
    if (!ok) {
      // The authority/runtimes are loaded as a group; if one is missing the
      // loader order is wrong. Report once, do not silently retry forever.
      note('mount', 'required runtime missing: ' + JSON.stringify(diagnose().state.errors.slice(-1)));
      return;
    }
    subscribed = true;
  }
  function ensureDrawer() {
    if (STATE.drawerInstalled) return;
    drawerTries += 1;
    if (installDrawer()) return;
    if (drawerTries < MAX_DRAWER_TRIES) setTimeout(ensureDrawer, 250);
  }

  function diagnose() {
    var d = global.document;
    return {
      version: VERSION,
      authorityReady: !!authority(),
      authorityMarker: authority() ? authority().version : null,
      settingsReady: !!settings(),
      advisorReady: !!advisor(),
      drawerInDom: !!(d && d.getElementById('apex-graphics-open')),
      panelInDom: !!(d && d.getElementById(PANEL_ID_SAFE())),
      mode: authority() ? authority().mode : null,
      cssLinked: !!(d && d.getElementById('apex-graphics-quality-ui-css')),
      state: STATE,
    };
  }
  function PANEL_ID_SAFE() { return 'apex-graphics-settings'; }

  var api = { version: VERSION, mount: mount, diagnose: diagnose, syncDrawer: syncDrawer, syncHudFrame: syncHudFrame, STATE: STATE };
  try {
    Object.defineProperty(global, 'APEX_GRAPHICS_FRONTEND', { value: api, writable: false, configurable: true, enumerable: true });
  } catch (e) {
    global.APEX_GRAPHICS_FRONTEND = api;
  }
  // Explicit readiness marker for the runtime loader / acceptance checks.
  global.apexGraphicsQualityFrontend = 'ready';

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', function () { tryMount(); ensureDrawer(); }, { once: true });
    tryMount();
    ensureDrawer();
  } else {
    tryMount();
    ensureDrawer();
  }
})(typeof window !== 'undefined' ? window : globalThis);
