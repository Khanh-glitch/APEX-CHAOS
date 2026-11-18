// APEX CHAOS — Unified Product Settings Authority (Phase 2)
//
// Single source of truth for cross-mode player preferences across Home,
// Free Battle (VS BOT / Local 1v1), Quest, BOT WAVE, and Gold overlays:
//   - gfxMode:       'auto' | 'ultra' | 'balanced' | 'off' (synced w/ APEX_GFX_QUALITY)
//   - musicMuted:    boolean (persisted; synced w/ window.apexProductMusic & M key)
//   - sfxMuted:      boolean (persisted; synced w/ battleAudio, apexUiSfx & BOT WAVE)
//   - reducedMotion: boolean (persisted; honors OS prefers-reduced-motion default)
//   - language:      'eng' | 'vie' (synced w/ window.APEX_I18N)
//
// Pure presentation/comfort authority — never mutates combat rules, saves, or economy.

const STORAGE_KEY = 'apex.settings.v1';
const GFX_STORAGE_KEY = 'apex.gfxQuality.v1';
const VALID_GFX = Object.freeze(['auto', 'ultra', 'balanced', 'off']);

function osPrefersReducedMotion(win) {
  try { return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); }
  catch { return false; }
}

function readStoredJson(win) {
  try {
    const raw = win?.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readInitialGfx(win, stored) {
  try {
    const live = win?.APEX_GFX_QUALITY?.getMode?.();
    if (VALID_GFX.includes(live)) return live;
    const saved = win?.localStorage?.getItem(GFX_STORAGE_KEY)
      || win?.localStorage?.getItem('apexEvolution.shaderQuality');
    if (VALID_GFX.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  return VALID_GFX.includes(stored.gfxMode) ? stored.gfxMode : 'auto';
}

function readInitialLang(win) {
  try {
    const live = win?.APEX_I18N?.getLanguage?.();
    if (live === 'vie' || live === 'eng') return live;
    const saved = win?.localStorage?.getItem('apex.language.v1');
    if (saved === 'vie' || saved === 'eng') return saved;
  } catch { /* storage blocked */ }
  return 'eng';
}

export function installSettingsAuthority(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return null;
  if (win.APEX_SETTINGS?.__installed) return win.APEX_SETTINGS;

  const doc = win.document;
  const stored = readStoredJson(win);
  const listeners = new Set();

  const state = {
    gfxMode: readInitialGfx(win, stored),
    musicMuted: stored.musicMuted === true,
    sfxMuted: stored.sfxMuted === true,
    reducedMotion: typeof stored.reducedMotion === 'boolean'
      ? stored.reducedMotion
      : osPrefersReducedMotion(win),
  };

  let applyingGfx = false;
  let applyingLang = false;

  const persist = () => {
    try {
      win.localStorage?.setItem(STORAGE_KEY, JSON.stringify({
        gfxMode: state.gfxMode,
        musicMuted: state.musicMuted,
        sfxMuted: state.sfxMuted,
        reducedMotion: state.reducedMotion,
      }));
      win.localStorage?.setItem(GFX_STORAGE_KEY, state.gfxMode);
      win.localStorage?.setItem('apexEvolution.shaderQuality', state.gfxMode);
    } catch { /* storage optional */ }
  };

  const getEffectiveGfx = () => {
    try {
      const eff = win.APEX_GFX_QUALITY?.getEffective?.();
      if (eff === 'ultra' || eff === 'balanced' || eff === 'off') return eff;
    } catch { /* compositor not yet evaluated */ }
    return state.gfxMode === 'auto' ? 'ultra' : state.gfxMode;
  };

  const snapshot = () => ({
    gfxMode: state.gfxMode,
    gfxEffective: getEffectiveGfx(),
    musicMuted: state.musicMuted,
    sfxMuted: state.sfxMuted,
    reducedMotion: state.reducedMotion,
    language: readInitialLang(win),
  });

  const syncWaveFrame = (snap) => {
    try {
      const frame = doc?.querySelector?.('#apex-wave-host iframe');
      const cw = frame?.contentWindow;
      if (!cw) return;
      cw.__apexSfxMuted = snap.sfxMuted;
      cw.__apexReducedMotion = snap.reducedMotion;
      if (typeof cw.apexWaveApplySettings === 'function') {
        cw.apexWaveApplySettings(snap);
      }
      cw.dispatchEvent?.(new cw.CustomEvent('apex:settings-changed', { detail: snap }));
    } catch { /* iframe initializing */ }
  };

  const applyAll = (emit = true) => {
    // 1. Music mute authority
    win.__apexGoldMusicMuted = state.musicMuted;
    try {
      const music = win.apexProductMusic;
      if (music?.setMuted) {
        music.setMuted(state.musicMuted);
      } else if (music?.state && music?.toggleMute) {
        const cur = Boolean(music.state()?.muted);
        if (cur !== state.musicMuted) music.toggleMute();
      }
    } catch { /* music runtime not yet loaded */ }

    // 2. Battle + UI + Wave SFX mute authority
    win.__apexSfxMuted = state.sfxMuted;
    try { win.apexSetBattleSfxMuted?.(state.sfxMuted); } catch { /* boot order */ }
    try {
      const uiSfx = win.apexUiSfx;
      if (uiSfx) {
        if (state.sfxMuted) uiSfx.mute?.();
        else uiSfx.unmute?.();
      }
    } catch { /* optional */ }

    // 3. Graphics quality authority
    if (!applyingGfx) {
      applyingGfx = true;
      try {
        if (win.APEX_GFX_QUALITY?.getMode && win.APEX_GFX_QUALITY.getMode() !== state.gfxMode) {
          win.APEX_GFX_QUALITY.setMode?.(state.gfxMode);
        }
      } catch { /* deferred battle runtime */ }
      applyingGfx = false;
    }

    // 4. Reduced motion authority (DOM dataset + Gold shell stage)
    win.__apexReducedMotion = state.reducedMotion;
    try {
      if (doc?.documentElement) {
        doc.documentElement.dataset.apexMotion = state.reducedMotion ? 'reduced' : 'full';
      }
      win.APEX_GOLD_SET_MOTION?.(!state.reducedMotion);
    } catch { /* optional */ }

    const snap = snapshot();
    syncWaveFrame(snap);

    if (emit) {
      for (const fn of [...listeners]) {
        try { fn(snap); } catch { /* listener fault isolated */ }
      }
      try {
        win.dispatchEvent(new CustomEvent('apex:settings-changed', { detail: snap }));
      } catch { /* headless */ }
    }
    return snap;
  };

  const update = (patch = {}) => {
    if (!patch || typeof patch !== 'object') return snapshot();
    let changed = false;
    if (VALID_GFX.includes(patch.gfxMode) && patch.gfxMode !== state.gfxMode) {
      state.gfxMode = patch.gfxMode;
      changed = true;
    }
    if (typeof patch.musicMuted === 'boolean' && patch.musicMuted !== state.musicMuted) {
      state.musicMuted = patch.musicMuted;
      changed = true;
    }
    if (typeof patch.sfxMuted === 'boolean' && patch.sfxMuted !== state.sfxMuted) {
      state.sfxMuted = patch.sfxMuted;
      changed = true;
    }
    if (typeof patch.reducedMotion === 'boolean' && patch.reducedMotion !== state.reducedMotion) {
      state.reducedMotion = patch.reducedMotion;
      changed = true;
    }
    if ((patch.language === 'eng' || patch.language === 'vie') && !applyingLang) {
      applyingLang = true;
      try { win.APEX_I18N?.setLanguage?.(patch.language); } catch { /* optional */ }
      applyingLang = false;
      changed = true;
    }
    if (changed) persist();
    return applyAll(true);
  };

  // Keep in sync when APEX_GFX_QUALITY changes directly (Auto-FPS tier shift or HUD click)
  const onGfxQualityEvent = (event) => {
    if (applyingGfx) return;
    const mode = event?.detail?.mode;
    if (VALID_GFX.includes(mode) && mode !== state.gfxMode) {
      state.gfxMode = mode;
      persist();
    }
    const snap = snapshot();
    syncWaveFrame(snap);
    for (const fn of [...listeners]) {
      try { fn(snap); } catch { /* ignore */ }
    }
    try { win.dispatchEvent(new CustomEvent('apex:settings-changed', { detail: snap })); } catch { /* ignore */ }
  };
  win.addEventListener('apex:gfx-quality-changed', onGfxQualityEvent);
  win.addEventListener('apex:gfx-quality-change', onGfxQualityEvent);

  // Keep in sync when M shortcut toggles product music directly
  win.addEventListener('apex:music-mute-changed', (event) => {
    const nextMuted = Boolean(event?.detail?.muted);
    if (nextMuted === state.musicMuted) return;
    state.musicMuted = nextMuted;
    persist();
    const snap = snapshot();
    for (const fn of [...listeners]) {
      try { fn(snap); } catch { /* ignore */ }
    }
    try { win.dispatchEvent(new CustomEvent('apex:settings-changed', { detail: snap })); } catch { /* ignore */ }
  });

  // Keep in sync when language flips via any surface
  win.addEventListener('apex:language-changed', () => {
    if (applyingLang) return;
    const snap = snapshot();
    syncWaveFrame(snap);
    for (const fn of [...listeners]) {
      try { fn(snap); } catch { /* ignore */ }
    }
    try { win.dispatchEvent(new CustomEvent('apex:settings-changed', { detail: snap })); } catch { /* ignore */ }
  });

  // Cross-tab persistence sync
  win.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      const next = readStoredJson(win);
      if (VALID_GFX.includes(next.gfxMode)) state.gfxMode = next.gfxMode;
      if (typeof next.musicMuted === 'boolean') state.musicMuted = next.musicMuted;
      if (typeof next.sfxMuted === 'boolean') state.sfxMuted = next.sfxMuted;
      if (typeof next.reducedMotion === 'boolean') state.reducedMotion = next.reducedMotion;
      applyAll(true);
    } else if (event.key === GFX_STORAGE_KEY && VALID_GFX.includes(event.newValue)) {
      state.gfxMode = event.newValue;
      applyAll(true);
    }
  });

  const api = Object.freeze({
    __installed: true,
    get: snapshot,
    update,
    sync: () => applyAll(false),
    setGfxMode: (gfxMode) => update({ gfxMode }),
    setMusicMuted: (musicMuted) => update({ musicMuted: Boolean(musicMuted) }),
    toggleMusic: () => update({ musicMuted: !state.musicMuted }),
    setSfxMuted: (sfxMuted) => update({ sfxMuted: Boolean(sfxMuted) }),
    toggleSfx: () => update({ sfxMuted: !state.sfxMuted }),
    setReducedMotion: (reducedMotion) => update({ reducedMotion: Boolean(reducedMotion) }),
    toggleReducedMotion: () => update({ reducedMotion: !state.reducedMotion }),
    setLanguage: (language) => update({ language }),
    subscribe: (fn) => {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });

  win.APEX_SETTINGS = api;
  applyAll(false);
  return api;
}
