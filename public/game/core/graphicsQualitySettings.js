/* APEX CHAOS — GRAPHICS SETTINGS PANEL (Gold design).
 *
 * One panel implementation, three ways in:
 *   1. Gold Shell settings drawer  -> row button #apex-graphics-open
 *   2. Battle HUD iframe           -> same panel, projected into the iframe
 *   3. Any product surface         -> APEX_GRAPHICS_SETTINGS_UI.open()
 *
 * The panel is a real radiogroup so keyboard users get roving tabindex with
 * arrow keys; it closes on Escape or an outside pointer press, and it always
 * writes through the ONE authority (never to storage itself).
 *
 * window.APEX_GRAPHICS_SETTINGS_UI = {
 *   version, open(host?), close(reason?), toggle(), isOpen(), sync(),
 *   destroy(), _test: { panel, applyMode }
 * }
 */
(function installGraphicsQualitySettingsUi(global) {
  'use strict';
  if (global.APEX_GRAPHICS_SETTINGS_UI && global.APEX_GRAPHICS_SETTINGS_UI.version) return;

  var VERSION = 'graphics-settings-1';
  var PANEL_ID = 'apex-graphics-settings';

  function doc() { return global.document; }

  function authority() {
    var a = global.APEX_GRAPHICS_QUALITY;
    // The panel must never invent a mode when the authority is missing.
    return a && a.version ? a : null;
  }

  function text(key) {
    var i18n = global.APEX_I18N;
    var lang = 'eng';
    try { lang = (i18n && i18n.getLanguage && i18n.getLanguage()) || 'eng'; } catch (e) { lang = 'eng'; }
    var copy = COPY[key];
    if (!copy) return key;
    return copy[lang] || copy.eng;
  }

  // Vietnamese-first copy for VIE, English for ENG — same strings the owner
  // sees in the shell, kept inline so the panel works before localization
  // finishes mounting.
  var COPY = {
    kicker: { eng: 'APEX / SYSTEM', vie: 'APEX / HỆ THỐNG' },
    title: { eng: 'GRAPHICS', vie: 'ĐỒ HOẠ' },
    sub: {
      eng: 'Choose how much extra rendering the arena spends on effects. Gameplay, hitboxes, damage and audio are identical in both modes.',
      vie: 'Chọn mức hiệu ứng mà đấu trường dùng để dựng hình. Lối chơi, vùng đánh, sát thương và âm thanh giống hệt nhau ở cả hai chế độ.',
    },
    legend: { eng: 'QUALITY MODE', vie: 'CHẾ ĐỘ ĐỒ HOẠ' },
    high: { eng: 'HIGH', vie: 'CAO' },
    highDesc: {
      eng: 'Full authored fidelity: every reflection, bloom pass, ice facet and ember.',
      vie: 'Đầy đủ chi tiết gốc: mọi phản chiếu, bloom, tinh thể băng và tàn lửa.',
    },
    highTag: { eng: 'DEFAULT', vie: 'MẶC ĐỊNH' },
    perf: { eng: 'PERFORMANCE', vie: 'HIỆU NĂNG' },
    perfDesc: {
      eng: 'Keeps every ability, telegraph and impact; removes duplicated rendering work.',
      vie: 'Giữ nguyên mọi chiêu, dấu hiệu và va chạm; bỏ phần dựng hình bị lặp.',
    },
    perfTag: { eng: 'FASTER', vie: 'NHANH HƠN' },
    note: {
      eng: 'Changes apply immediately — even in the middle of a fight. No reload.',
      vie: 'Thay đổi áp dụng ngay — kể cả giữa trận. Không cần tải lại.',
    },
    close: { eng: 'CLOSE', vie: 'ĐÓNG' },
  };

  var panel = null;
  var hostEl = null;
  var previousFocus = null;
  var disposers = [];
  var unsubscribe = null;

  function listen(target, type, fn, opts) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, fn, opts);
    disposers.push(function () { try { target.removeEventListener(type, fn, opts); } catch (e) {} });
  }

  var CSS_STATE = { loaded: false, error: '' };

  /**
   * Stylesheet URL through the app-root authority.
   *
   * A root-absolute '/game/...' literal is rewritten by the itch packager to
   * '../game/...', which only resolves AFTER the Gold mount retargets <base> to
   * <app>/gold/. This runtime can run before that (menu tier), where '../'
   * escapes the app root entirely and the sheet 404s — so the path is handed to
   * APEX_APP_URL (immune to <base>) and only falls back to document-relative
   * resolution when the bundle has not published it yet.
   */
  function uiCssHref() {
    // NOTE: deliberately no leading slash, so the packaging rewrite (which only
    // matches quote-then-'/game/') leaves this literal alone.
    var rel = 'game/core/graphicsQualityUi.css';
    var appUrl = global.APEX_APP_URL;
    if (typeof appUrl === 'function') {
      try {
        var resolved = appUrl(rel);
        if (resolved) return resolved;
      } catch (e) { /* fall through */ }
    }
    try {
      return new URL(rel, global.document.baseURI || global.location.href).href;
    } catch (e) {
      return rel;
    }
  }

  function ensureStyles() {
    var d = doc();
    if (!d) return;
    if (d.getElementById('apex-graphics-quality-ui-css')) return;
    if (global.__APEX_GRAPHICS_UI_CSS) {
      // Inlined by the HUD/embedded host so no extra request is needed.
      var style = d.createElement('style');
      style.id = 'apex-graphics-quality-ui-css';
      style.textContent = String(global.__APEX_GRAPHICS_UI_CSS);
      (d.head || d.documentElement).appendChild(style);
      return;
    }
    var link = d.createElement('link');
    link.id = 'apex-graphics-quality-ui-css';
    link.rel = 'stylesheet';
    link.href = uiCssHref();
    link.dataset.apexGraphicsUi = 'true';
    link.addEventListener('load', function () { CSS_STATE.loaded = true; CSS_STATE.error = ''; });
    link.addEventListener('error', function () { CSS_STATE.loaded = false; CSS_STATE.error = 'stylesheet failed: ' + link.href; });
    (d.head || d.documentElement).appendChild(link);
  }

  function build() {
    var d = doc();
    if (!d || !d.body) return null;
    ensureStyles();
    var el = d.createElement('div');
    el.id = PANEL_ID;
    el.className = 'aqs';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'aqs-title');
    el.innerHTML =
      '<div class="aqs-card" role="document">' +
        '<p class="aqs-kicker"></p>' +
        '<h2 class="aqs-title" id="aqs-title"></h2>' +
        '<p class="aqs-sub"></p>' +
        '<fieldset class="aqs-group" role="radiogroup">' +
          '<legend class="aqs-legend"></legend>' +
          '<button type="button" class="aqs-option" role="radio" aria-checked="false" data-aqs-mode="high" tabindex="0">' +
            '<span class="aqs-mark" aria-hidden="true"><i></i></span>' +
            '<span><span class="aqs-name"></span><span class="aqs-desc"></span></span>' +
            '<span class="aqs-tag" data-aqs-tag="high"></span>' +
          '</button>' +
          '<button type="button" class="aqs-option" role="radio" aria-checked="false" data-aqs-mode="performance" tabindex="-1">' +
            '<span class="aqs-mark" aria-hidden="true"><i></i></span>' +
            '<span><span class="aqs-name"></span><span class="aqs-desc"></span></span>' +
            '<span class="aqs-tag" data-aqs-tag="performance"></span>' +
          '</button>' +
        '</fieldset>' +
        '<p class="aqs-note"></p>' +
        '<div class="aqs-actions"><button type="button" class="aqs-btn aqs-btn-primary" data-aqs-close></button></div>' +
      '</div>';
    (hostEl && hostEl.isConnected ? hostEl : d.body).appendChild(el);
    localise(el);
    el.addEventListener('click', onBackdropClick);
    el.addEventListener('keydown', onKeydown);
    var options = el.querySelectorAll('[data-aqs-mode]');
    for (var i = 0; i < options.length; i += 1) {
      options[i].addEventListener('click', onOptionClick);
      options[i].addEventListener('keydown', onOptionKeydown);
    }
    el.querySelector('[data-aqs-close]').addEventListener('click', function () { close('button'); });
    return el;
  }

  function localise(el) {
    var q = function (sel) { return el.querySelector(sel); };
    q('.aqs-kicker').textContent = text('kicker');
    q('.aqs-title').textContent = text('title');
    q('.aqs-sub').textContent = text('sub');
    q('.aqs-legend').textContent = text('legend');
    q('.aqs-note').textContent = text('note');
    q('[data-aqs-close]').textContent = text('close');
    var high = q('[data-aqs-mode="high"]');
    high.querySelector('.aqs-name').textContent = text('high');
    high.querySelector('.aqs-desc').textContent = text('highDesc');
    high.querySelector('[data-aqs-tag="high"]').textContent = text('highTag');
    var perf = q('[data-aqs-mode="performance"]');
    perf.querySelector('.aqs-name').textContent = text('perf');
    perf.querySelector('.aqs-desc').textContent = text('perfDesc');
    perf.querySelector('[data-aqs-tag="performance"]').textContent = text('perfTag');
  }

  function sync() {
    if (!panel) return;
    var a = authority();
    var mode = a ? a.mode : 'high';
    var options = panel.querySelectorAll('[data-aqs-mode]');
    for (var i = 0; i < options.length; i += 1) {
      var on = options[i].dataset.aqsMode === mode;
      options[i].setAttribute('aria-checked', on ? 'true' : 'false');
      options[i].tabIndex = on ? 0 : -1;
    }
    panel.dataset.aqsActive = mode;
    // Shell drawer readout mirrors the panel.
    var drawer = global.document && global.document.getElementById('apex-graphics-open');
    if (drawer) {
      drawer.dataset.aqsMode = mode;
      var value = drawer.querySelector('#apex-graphics-open-value');
      if (value) value.textContent = mode === 'performance' ? text('perf') : text('high');
    }
  }

  function onOptionClick(event) {
    var btn = event.currentTarget;
    if (!btn) return;
    applyMode(btn.dataset.aqsMode);
  }

  function onOptionKeydown(event) {
    var key = event && event.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    event.preventDefault();
    var options = Array.prototype.slice.call(panel.querySelectorAll('[data-aqs-mode]'));
    var at = options.indexOf(event.currentTarget);
    var next;
    if (key === 'Home') next = 0;
    else if (key === 'End') next = options.length - 1;
    else if (key === 'ArrowDown' || key === 'ArrowRight') next = (at + 1) % options.length;
    else next = (at - 1 + options.length) % options.length;
    options[next].focus({ preventScroll: true });
    // Radio-group convention: arrow keys also select.
    applyMode(options[next].dataset.aqsMode);
  }

  function applyMode(mode) {
    var a = authority();
    if (!a) return false;
    a.set(mode, 'settings-ui');
    sync();
    return true;
  }

  function onKeydown(event) {
    if (!event) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close('escape');
      return;
    }
    if (event.key === 'Tab' && panel) {
      var focusables = panel.querySelectorAll('button:not([disabled])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && global.document.activeElement === first) {
        event.preventDefault(); last.focus({ preventScroll: true });
      } else if (!event.shiftKey && global.document.activeElement === last) {
        event.preventDefault(); first.focus({ preventScroll: true });
      }
    }
  }

  function onBackdropClick(event) {
    if (event.target === panel) close('outside');
  }

  function open(host) {
    var d = doc();
    if (!d) return false;
    if (host && host !== hostEl) {
      hostEl = host;
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      panel = null;
    }
    if (!panel || !panel.isConnected) panel = build();
    if (!panel) return false;
    if (!panel.hidden) { sync(); return true; }
    sync();
    try { previousFocus = d.activeElement; } catch (e) { previousFocus = null; }
    panel.hidden = false;
    panel.classList.add('is-open');
    var checked = panel.querySelector('[data-aqs-mode][aria-checked="true"]') || panel.querySelector('[data-aqs-mode]');
    if (checked) { try { checked.focus({ preventScroll: true }); } catch (e) {} }
    return true;
  }

  // The global outside-pointer / Escape guards are installed ONCE at boot and
  // are inert while the panel is closed. Registering them per open() would
  // accumulate document listeners across the life of the page.
  function outsideHandler(event) {
    if (!panel || panel.hidden) return;
    if (event.type === 'keydown') {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close('escape');
      return;
    }
    if (panel.contains(event.target)) return;
    // The opener button toggles itself; do not fight it.
    if (event.target && event.target.closest && event.target.closest('#apex-graphics-open')) return;
    close('outside');
  }

  function close(reason) {
    if (!panel || panel.hidden) return false;
    panel.hidden = true;
    panel.classList.remove('is-open');
    try {
      if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
    } catch (e) { /* detached */ }
    previousFocus = null;
    if (global.dispatchEvent) {
      try { global.dispatchEvent(new global.CustomEvent('apex-graphics-settings-close', { detail: { reason: String(reason || 'close') } })); } catch (e) {}
    }
    return true;
  }

  function isOpen() {
    return !!(panel && !panel.hidden);
  }

  function toggle(host) {
    if (isOpen()) { close('toggle'); return false; }
    return open(host);
  }

  function destroy() {
    while (disposers.length) { try { disposers.pop()(); } catch (e) {} }
    if (unsubscribe) { try { unsubscribe(); } catch (e) {} unsubscribe = null; }
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null;
    hostEl = null;
  }

  var api = {
    version: VERSION,
    PANEL_ID: PANEL_ID,
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    sync: sync,
    applyMode: applyMode,
    destroy: destroy,
    // Install the shared stylesheet without building/opening the panel.
    preloadStyles: ensureStyles,
    get stylesheet() { return Object.freeze({ loaded: CSS_STATE.loaded, error: CSS_STATE.error, href: uiCssHref() }); },
    _test: {
      get panel() { return panel; },
      text: text,
      COPY: COPY,
    },
  };

  try {
    Object.defineProperty(global, 'APEX_GRAPHICS_SETTINGS_UI', { value: api, writable: false, configurable: true, enumerable: true });
  } catch (e) {
    global.APEX_GRAPHICS_SETTINGS_UI = api;
  }

  // Re-localise + re-sync if the interface language changes while mounted.
  listen(global, 'apex:language-changed', function () { if (panel) { localise(panel); sync(); } });
  // Adopt external writes (authority changed by the advisor or another tab).
  var a = authority();
  if (a && typeof a.subscribe === 'function') unsubscribe = a.subscribe(function () { sync(); });
  // Multi-tab: storage events are a legitimate cross-tab mirror, not a second
  // authority — the value is adopted, never re-derived locally.
  listen(global, 'storage', function (event) {
    if (!event || event.key !== (a ? a.STORAGE_KEY : 'apexChaos.graphicsQuality.v1')) return;
    var auth = authority();
    if (auth && event.newValue) {
      try {
        var parsed = JSON.parse(event.newValue);
        var mode = parsed && parsed.mode ? parsed.mode : parsed;
        if (mode === 'high' || mode === 'performance') auth.adopt(mode, 'storage-event');
      } catch (e) { /* ignore malformed */ }
    }
  });

  // One-time global guards (inert while closed).
  listen(doc(), 'pointerdown', outsideHandler, true);
  listen(doc(), 'keydown', function (event) {
    if (!panel || panel.hidden) return;
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close('escape');
  }, true);

  // Give the rest of the product a synchronous sync point on boot.
  if (doc() && doc().readyState !== 'loading') sync();
  else listen(doc(), 'DOMContentLoaded', function () { sync(); });
})(typeof window !== 'undefined' ? window : globalThis);
