// Presentation budgets only. Simulation, hit boxes, hazards and skill timing
// never depend on the selected graphics profile.
export const GRAPHICS_KEY = 'apex.graphics.v1';
export const QUALITY_ORDER = ['low', 'balanced', 'high', 'ultra'];
export const GRAPHICS_PROFILES = Object.freeze({
  low: Object.freeze({ shader: 'off', postScale: 0.5, particles: 160, density: 0.3, hudMs: 100, ambience: false }),
  balanced: Object.freeze({ shader: 'off', postScale: 0.65, particles: 320, density: 0.5, hudMs: 80, ambience: true }),
  high: Object.freeze({ shader: 'balanced', postScale: 0.75, particles: 560, density: 0.75, hudMs: 66, ambience: true }),
  ultra: Object.freeze({ shader: 'ultra', postScale: 1, particles: 900, density: 1, hudMs: 55, ambience: true }),
});

export function normalizePreferences(value = {}) {
  return {
    quality: ['auto', ...QUALITY_ORDER].includes(value?.quality) ? value.quality : 'auto',
    motion: ['system', 'reduced', 'full'].includes(value?.motion) ? value.motion : 'system',
    clarity: value?.clarity !== false,
    showFps: value?.showFps === true,
  };
}

export function initialAutoQuality({ memory = 0, cores = 0, coarse = false, saveData = false } = {}) {
  if (saveData || (memory > 0 && memory <= 2) || (cores > 0 && cores <= 2)) return 'low';
  // Unknown capabilities (including Safari) get a conservative, usable floor.
  return !coarse && memory >= 8 && cores >= 8 ? 'high' : 'balanced';
}

// Two sustained slow windows lower detail; recovery needs 5 good windows.
// Ignore loading/resume gaps and never promote Auto beyond its initial ceiling.
export function createFrameGovernor(initial = 'balanced') {
  const ceiling = Math.max(0, QUALITY_ORDER.indexOf(initial));
  let level = ceiling, samples = [], elapsed = 0, slow = 0, fast = 0;
  return {
    reset() { samples = []; elapsed = 0; slow = 0; fast = 0; },
    sample(ms) {
      if (!Number.isFinite(ms) || ms <= 0 || ms > 150) { this.reset(); return null; }
      samples.push(ms); elapsed += ms;
      if (elapsed < 3000 || samples.length < 30) return null;
      const fps = 1000 * samples.length / elapsed;
      const missed = samples.filter(v => v > 23).length / samples.length;
      slow = missed > 0.25 ? slow + 1 : 0;
      fast = fps >= 57 && missed < 0.04 ? fast + 1 : 0;
      let changed = false;
      if (slow >= 2 && level > 0) { level--; changed = true; }
      else if (fast >= 5 && level < ceiling) { level++; changed = true; }
      samples = []; elapsed = 0;
      if (changed) { slow = 0; fast = 0; }
      return { quality: QUALITY_ORDER[level], fps: Math.round(fps), changed };
    },
  };
}

export function installGraphicsQuality(win = window) {
  if (win.APEX_GRAPHICS) return win.APEX_GRAPHICS;
  let saved;
  try { saved = JSON.parse(win.localStorage.getItem(GRAPHICS_KEY)); } catch (_) {}
  let preferences = normalizePreferences(saved);
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const autoStart = initialAutoQuality({ memory: win.navigator.deviceMemory, cores: win.navigator.hardwareConcurrency,
    coarse: win.matchMedia?.('(pointer: coarse)').matches, saveData: win.navigator.connection?.saveData });
  const governor = createFrameGovernor(autoStart);
  let autoQuality = autoStart, fps = null, gpuAvailable = true;
  let snapshot;
  const listeners = new Set();
  const publish = () => {
    const effective = preferences.quality === 'auto' ? autoQuality : preferences.quality;
    const reducedMotion = preferences.motion === 'reduced' || (preferences.motion === 'system' && !!media?.matches);
    snapshot = Object.freeze({ ...preferences, effective, reducedMotion, fps, gpuAvailable,
      profile: Object.freeze({ ...GRAPHICS_PROFILES[effective],
        shader: gpuAvailable ? GRAPHICS_PROFILES[effective].shader : 'off' }) });
    const root = win.document.documentElement;
    root.dataset.apexQuality = effective;
    root.dataset.apexMotion = reducedMotion ? 'reduced' : 'full';
    root.dataset.apexClarity = preferences.clarity ? 'on' : 'off';
    listeners.forEach(fn => fn());
    win.dispatchEvent(new win.CustomEvent('apex:graphics-changed', { detail: snapshot }));
  };
  const api = {
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    update(patch) {
      preferences = normalizePreferences({ ...preferences, ...patch });
      governor.reset();
      try { win.localStorage.setItem(GRAPHICS_KEY, JSON.stringify(preferences)); } catch (_) {}
      publish();
    },
    reportFrame(ms) {
      if (win.document.hidden || win.autoBattlePaused) { governor.reset(); return; }
      const result = governor.sample(ms);
      if (!result) return;
      fps = result.fps;
      const previous = autoQuality;
      if (preferences.quality === 'auto') autoQuality = result.quality;
      if (autoQuality !== previous || preferences.showFps) publish();
    },
    reportGpuAvailability(available) {
      if (gpuAvailable === available) return;
      gpuAvailable = available; publish();
    },
    resetFrameWindow: () => governor.reset(),
  };
  win.APEX_GRAPHICS = api;
  media?.addEventListener?.('change', publish);
  win.document.addEventListener('visibilitychange', () => governor.reset());
  publish();
  return api;
}

// Same-origin BOT WAVE shares the player's actual preferences and governor.
// The frame keeps its own canvas/layout and is detached cleanly on return Home.
export function connectGraphicsFrame(frame, win = window) {
  const api = installGraphicsQuality(win);
  let lastKey = '', currentDocument;
  const apply = () => {
    const view = frame.contentWindow, doc = frame.contentDocument;
    if (!view || !doc?.documentElement) return;
    view.APEX_GRAPHICS = api;
    const state = api.getSnapshot();
    const key = `${state.effective}:${state.reducedMotion}:${state.clarity}`;
    if (key === lastKey && currentDocument === doc) return;
    lastKey = key; currentDocument = doc;
    doc.documentElement.dataset.apexQuality = state.effective;
    doc.documentElement.dataset.apexMotion = state.reducedMotion ? 'reduced' : 'full';
    doc.documentElement.dataset.apexClarity = state.clarity ? 'on' : 'off';
    view.dispatchEvent(new view.Event('resize'));
  };
  const unsubscribe = api.subscribe(apply);
  frame.addEventListener('load', apply);
  apply();
  return () => { unsubscribe(); frame.removeEventListener('load', apply); };
}
