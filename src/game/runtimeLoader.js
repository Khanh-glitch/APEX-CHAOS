import {
  BATTLE_RUNTIMES,
  BATTLE_DEFERRED_RUNTIMES,
  DEFERRED_GAME_RUNTIMES,
  MENU_INTERACTIVE_RUNTIMES,
  MODE_DEFERRED_RUNTIMES,
  SELECT_RUNTIMES,
  WARMUP_GROUP_SEQUENCE,
  hintRuntimeSources,
  prefetchDeferredRuntimeSources,
  preloadRuntimeSources,
} from './runtimeManifest.js';
import { beginPerfSpan, markBootPhase } from './performanceMetrics.js';

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

// ─────────────────────────────────────────────────────────────────────────────
// Tiered loading with deterministic priority (authority §A2/§A3).
//
// One shared sequential queue owns classic-script insertion. Background warmup
// (Tier 2) drains the queue at idle; a route intent (Tier 3) jumps its whole
// group ahead of any warmup entries that have not started yet, so a click
// waits only for its own dependencies — never for unrelated background work.
// The currently-loading script is never cancelled; every group keeps its
// internal order, so patch chains (populateRoster wrappers etc.) stay exact.
// ─────────────────────────────────────────────────────────────────────────────
const loadQueue = [];
let queueRunning = false;
let priorityDepth = 0;

function runtimeAlreadyLoaded(src) {
  const existing = document.querySelector(`script[src="${src}"]`);
  return Boolean(existing && existing.dataset.apexLoaded === 'true');
}

function makeQueueEntry([src, dataKey, options]) {
  let settle, fail;
  const promise = new Promise((resolve, reject) => { settle = resolve; fail = reject; });
  return { src, dataKey, options, priority: false, promise, settle, fail };
}

async function pumpQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (loadQueue.length) {
      const entry = loadQueue.shift();
      if (entry.priority) priorityDepth = Math.max(0, priorityDepth - 1);
      try {
        await loadClassicRuntime(entry.src, entry.dataKey);
        entry.settle();
      } catch (error) {
        if (!entry.options || !entry.options.optional) {
          entry.fail(error);
        } else {
          console.warn(`[asset-loader] Optional runtime failed: ${entry.src}`);
          entry.settle();
        }
      }
    }
  } finally {
    queueRunning = false;
  }
}

// Enqueue a runtime group. Priority groups (route intent, §A3) are inserted
// ahead of any queued background-warmup entries; not-yet-started queue
// entries the group also needs are adopted (moved, keeping their settle
// promise) so patch chains keep their relative order and the click waits only
// for its own dependencies — never for unrelated background work.
function enqueueGroup(runtimes, { priority = false } = {}) {
  const entries = [];
  for (const tuple of runtimes) {
    if (runtimeAlreadyLoaded(tuple[0])) continue;
    const queued = loadQueue.find((q) => q.src === tuple[0]);
    entries.push(queued || makeQueueEntry(tuple));
  }
  if (!entries.length) return Promise.resolve();
  for (const entry of entries) {
    const i = loadQueue.indexOf(entry);
    if (i >= 0) loadQueue.splice(i, 1);
  }
  if (priority) {
    for (const entry of entries) entry.priority = true;
    loadQueue.splice(priorityDepth, 0, ...entries);
    priorityDepth += entries.length;
  } else {
    loadQueue.push(...entries);
  }
  void pumpQueue();
  return Promise.all(entries.map((e) => e.promise));
}

export async function loadMenuInteractiveRuntimes() {
  preloadRuntimeSources();
  return loadRuntimeList(MENU_INTERACTIVE_RUNTIMES);
}

// Back-compat name: the required-at-boot set is now exactly the menu tier.
export function loadRequiredGameRuntimes() {
  return loadMenuInteractiveRuntimes();
}

const RUNTIME_GROUPS = {
  all: DEFERRED_GAME_RUNTIMES,
  battle: BATTLE_RUNTIMES,
  battleDeferred: BATTLE_DEFERRED_RUNTIMES,
  manualLab: MODE_DEFERRED_RUNTIMES.manualLab,
  solo: MODE_DEFERRED_RUNTIMES.solo,
  trial: MODE_DEFERRED_RUNTIMES.trial,
  tamChien: MODE_DEFERRED_RUNTIMES.tamChien,
  arsenalQuest: MODE_DEFERRED_RUNTIMES.arsenalQuest,
  select: SELECT_RUNTIMES,
  soloBattle: MODE_DEFERRED_RUNTIMES.soloBattle,
  trialBattle: MODE_DEFERRED_RUNTIMES.trialBattle,
};

export function loadDeferredGameRuntimes(group = 'all', { priority = true } = {}) {
  const runtimes = RUNTIME_GROUPS[group] || RUNTIME_GROUPS.all;
  const promiseKey = `__apexDeferredRuntimesPromise_${group}`;
  if (window[promiseKey]) return window[promiseKey];
  // Route intent: this group must not wait behind background warmup entries.
  const gate = enqueueGroup(runtimes, { priority })
    .then(() => {
      window[`__apexDeferredRuntimesReady_${group}`] = true;
      if (group === 'all') window.__apexDeferredRuntimesReady = true;
    })
    .catch((error) => {
      window[promiseKey] = null;
      throw error;
    });
  window[promiseKey] = gate;
  hintRuntimeSources(runtimes, 'prefetch');
  if (group === 'all') window.__apexDeferredRuntimesPromise = gate;
  return gate;
}

// Tier 2 — likely-next background warmup. Runs only after the menu is
// interactive (callers must gate it) and yields to any route intent through
// the priority queue. Sequential by design: never monopolizes the main thread
// with parallel script execution/decode.
export async function scheduleDeferredGameRuntimes() {
  prefetchDeferredRuntimeSources();
  const start = () => {
    markBootPhase('warmup-start');
    (async () => {
      for (const group of WARMUP_GROUP_SEQUENCE) {
        try {
          // Background warmup never preempts an in-flight route intent.
          await loadDeferredGameRuntimes(group, { priority: false });
        } catch (error) {
          console.warn(`[asset-loader] Background warmup failed for group ${group}.`, error);
        }
      }
      markBootPhase('warmup-end');
      window.__apexWarmupComplete = true;
    })();
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(start, { timeout: 1200 });
  } else {
    window.setTimeout(start, 600);
  }
}
