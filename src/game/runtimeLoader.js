import {
  BATTLE_DEFERRED_RUNTIMES,
  BOOT_GAME_RUNTIMES,
  DEFERRED_GAME_RUNTIMES,
  MODE_DEFERRED_RUNTIMES,
  hintRuntimeSources,
  prefetchDeferredRuntimeSources,
  preloadRuntimeSources,
} from './runtimeManifest.js';
import { beginPerfSpan } from './performanceMetrics.js';

export function loadClassicRuntime(src, dataKey) {
  return new Promise((resolve, reject) => {
    const endTiming = beginPerfSpan('runtime', src);
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.apexLoaded === 'true') {
      endTiming({ ok: true, cached: true });
      resolve();
      return;
    }

    const runtime = existing || document.createElement('script');
    runtime.src = src;
    runtime.async = false;
    runtime.dataset[dataKey] = 'true';
    const handleLoad = () => {
      runtime.dataset.apexLoaded = 'true';
      endTiming({ ok: true, cached: false });
      resolve();
    };
    const handleError = () => {
      endTiming({ ok: false, cached: false });
      reject(new Error(`Failed to load ${src}`));
    };
    runtime.addEventListener('load', handleLoad, { once: true });
    runtime.addEventListener('error', handleError, { once: true });
    if (!existing) document.body.appendChild(runtime);
  });
}

async function loadRuntimeList(runtimes) {
  for (const [src, dataKey, options = {}] of runtimes) {
    try {
      await loadClassicRuntime(src, dataKey);
    } catch (error) {
      if (!options.optional) throw error;
      console.warn(`[asset-loader] Optional runtime failed: ${src}`);
    }
  }
}

export async function loadRequiredGameRuntimes() {
  preloadRuntimeSources();
  return loadRuntimeList(BOOT_GAME_RUNTIMES);
}

const RUNTIME_GROUPS = {
  all: DEFERRED_GAME_RUNTIMES,
  battle: BATTLE_DEFERRED_RUNTIMES,
  manualLab: MODE_DEFERRED_RUNTIMES.manualLab,
  solo: MODE_DEFERRED_RUNTIMES.solo,
  trial: MODE_DEFERRED_RUNTIMES.trial,
  tamChien: MODE_DEFERRED_RUNTIMES.tamChien,
  soloBattle: [...MODE_DEFERRED_RUNTIMES.solo, ...BATTLE_DEFERRED_RUNTIMES],
  trialBattle: [...MODE_DEFERRED_RUNTIMES.trial, ...BATTLE_DEFERRED_RUNTIMES],
  tamChienBattle: [...MODE_DEFERRED_RUNTIMES.tamChien, ...BATTLE_DEFERRED_RUNTIMES],
};

export function loadDeferredGameRuntimes(group = 'all') {
  const runtimes = RUNTIME_GROUPS[group] || RUNTIME_GROUPS.all;
  const promiseKey = `__apexDeferredRuntimesPromise_${group}`;
  if (window[promiseKey]) return window[promiseKey];
  hintRuntimeSources(runtimes, 'prefetch');
  window[promiseKey] = loadRuntimeList(runtimes)
    .then(() => {
      window[`__apexDeferredRuntimesReady_${group}`] = true;
      if (group === 'all') window.__apexDeferredRuntimesReady = true;
    })
    .catch((error) => {
      window[promiseKey] = null;
      throw error;
    });
  if (group === 'all') window.__apexDeferredRuntimesPromise = window[promiseKey];
  return window[promiseKey];
}

export function scheduleDeferredGameRuntimes() {
  prefetchDeferredRuntimeSources();
  const start = () => {
    loadDeferredGameRuntimes().catch((error) => {
      console.warn('[asset-loader] Failed deferred game runtime.', error);
    });
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(start, { timeout: 1600 });
  } else {
    window.setTimeout(start, 900);
  }
}
