import {
  ARSENAL_HUB_RUNTIMES,
  MENU_INTERACTIVE_RUNTIMES,
  arsenalBattleRuntimesFor,
  PRODUCT_MUSIC_BOOT_RUNTIMES,
  MODE_DEFERRED_RUNTIMES,
  SELECT_RUNTIMES,
  WARMUP_GROUP_SEQUENCE,
  hintRuntimeSources,
  preloadRuntimeSources,
} from './runtimeManifest.js';
import { beginPerfSpan, markBootPhase } from './performanceMetrics.js';
import { AUDIO_WARM_BANKS } from './audioWarmBanks.generated.js';

// Audio 2B — tiered audio preparation. Runs when a group's scripts have all
// evaluated, so lazily-constructed HTMLAudioElements / runtime
// fetch+decodeAudioData paths start from the HTTP cache (no trigger-time
// network). The Arsenal AV HOT bank is decoded by its own runtime preload.
function warmGroupAudio(group) {
  try {
    if (group === 'arsenalProduct') {
      window.APEX_ARSENAL_AV?.preload?.();
    }
    const urls = AUDIO_WARM_BANKS[group];
    if (urls?.length && typeof window.apexWarmAudioUrls === 'function') {
      window.apexWarmAudioUrls(urls);
    }
  } catch (error) {
    console.warn(`[asset-loader] Audio warmup failed for group ${group}.`, error);
  }
}

function runtimeScriptFor(src) {
  const base = document.baseURI || 'http://localhost/';
  let target;
  try { target = new URL(src, base).href; } catch (error) { target = String(src); }
  const scripts = document.querySelectorAll('script[src]');
  for (const node of scripts) {
    const raw = node.getAttribute('src');
    if (!raw) continue;
    let candidate;
    try { candidate = new URL(raw, base).href; } catch (error) { candidate = raw; }
    if (candidate === target) return node;
  }
  return null;
}

// CP15: the browser dispatches <script>.load even when executing that script
// throws. A successful fetch is NOT proof that its classic global evaluated.
// Only essential runtime authorities require a legacy "ready" marker: those
// markers are written by the current canonical scripts after initialization.
const REQUIRED_CLASSIC_READY_MARKERS = new Set([
  'apexArsenalConfig', 'apexArsenalIdentityRuntime',
  'apexArsenalWeaponRuntime', 'apexArsenalSpawnRuntime',
  'apexArsenalPresentationRuntime', 'apexArsenalChamberPaletteRuntime',
  'apexHeroReworkAil', 'apexHeroReworkRegistry',
  'apexHeroReworkMechanics', 'apexHeroReworkRuntime',
  'apexArsenalBattleRuntime',
]);
const classicRuntimeInflight = new Map();
function runtimeUrl(src) {
  return new URL(src, document.baseURI || 'http://localhost/').href;
}
function runtimeAdmissionError(src, reason) {
  return new Error(`Classic runtime admission failed [${src}]: ${reason}`);
}
export function loadClassicRuntime(src, dataKey) {
  const url = runtimeUrl(src);
  if (classicRuntimeInflight.has(url)) return classicRuntimeInflight.get(url);
  const gate = new Promise((resolve, reject) => {
    const endTiming = beginPerfSpan('runtime', src);
    const existing = runtimeScriptFor(src);
    const markerReady = () => !REQUIRED_CLASSIC_READY_MARKERS.has(dataKey) ||
      window[dataKey] === 'ready';
    if (existing?.dataset.apexFailed === 'true') {
      endTiming({ ok: false, cached: true, reason: 'prior-evaluation-failure' });
      reject(runtimeAdmissionError(src, 'earlier evaluation failed; reload the page'));
      return;
    }
    if (existing?.dataset.apexLoaded === 'true') {
      if (!markerReady()) {
        endTiming({ ok: false, cached: true, reason: 'missing-ready-marker' });
        reject(runtimeAdmissionError(src, `missing ${dataKey}=ready after cached load`));
      } else {
        endTiming({ ok: true, cached: true });
        resolve();
      }
      return;
    }

    const runtime = existing || document.createElement('script');
    if (!existing) runtime.src = src; // never restart a pre-existing script
    runtime.async = false;
    runtime.dataset[dataKey] = 'true';
    let settled = false;
    const evaluationErrors = [];
    const onEvaluationError = (event) => {
      // Attribution is filename-specific: concurrent unrelated page errors
      // must not invalidate the runtime being admitted.
      try {
        if (event?.filename && runtimeUrl(event.filename) === url)
          evaluationErrors.push(String(event.message || event.error?.message || 'evaluation error'));
      } catch (_) {}
    };
    const cleanup = () => {
      runtime.removeEventListener('load', handleLoad);
      runtime.removeEventListener('error', handleError);
      window.removeEventListener('error', onEvaluationError, true);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        runtime.dataset.apexFailed = 'true';
        endTiming({ ok: false, cached: false, reason: String(error.message) });
        reject(error);
      } else {
        runtime.dataset.apexLoaded = 'true';
        endTiming({ ok: true, cached: false });
        resolve();
      }
    };
    const handleLoad = () => {
      if (evaluationErrors.length)
        return finish(runtimeAdmissionError(src, evaluationErrors[0]));
      if (!markerReady())
        return finish(runtimeAdmissionError(src, `missing ${dataKey}=ready after evaluation`));
      finish();
    };
    const handleError = () => finish(runtimeAdmissionError(src, 'script network/load error'));
    window.addEventListener('error', onEvaluationError, true);
    runtime.addEventListener('load', handleLoad, { once: true });
    runtime.addEventListener('error', handleError, { once: true });
    if (!existing) document.body.appendChild(runtime);
  });
  classicRuntimeInflight.set(url, gate);
  // Clear only the active promise. A failed script node stays marked failed,
  // since blindly re-evaluating partly mutated classic globals is unsafe.
  void gate.then(
    () => { if (classicRuntimeInflight.get(url) === gate) classicRuntimeInflight.delete(url); },
    () => { if (classicRuntimeInflight.get(url) === gate) classicRuntimeInflight.delete(url); },
  );
  return gate;
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
  const existing = runtimeScriptFor(src);
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

let productMusicBootPromise = null;
export function loadProductMusicBootRuntime() {
  if (productMusicBootPromise) return productMusicBootPromise;
  productMusicBootPromise = loadRuntimeList(PRODUCT_MUSIC_BOOT_RUNTIMES).catch((error) => {
    productMusicBootPromise = null;
    throw error;
  });
  return productMusicBootPromise;
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
  arsenalHub: ARSENAL_HUB_RUNTIMES,
  arsenalProduct: MODE_DEFERRED_RUNTIMES.arsenalProduct,
  select: SELECT_RUNTIMES,
};

// Audio banks (dozens of HTMLAudioElements per group and the AV HOT-bank
// decode) warm on ROUTE INTENT only — the moment the user actually heads
// somewhere. Background warmup never pays that cost on the menu. The warm
// is keyed to the GROUP, not to whichever caller created the load promise:
// a route intent for a group the background warmup already started still
// fires the warm exactly once.
const warmAudioDone = new Set();
function warmGroupAudioWhenReady(group, gatePromise) {
  if (warmAudioDone.has(group)) return;
  warmAudioDone.add(group);
  gatePromise.then(() => warmGroupAudio(group)).catch(() => {});
}
export function loadDeferredGameRuntimes(group, { priority = true } = {}) {
  const runtimes = RUNTIME_GROUPS[group];
  if (!runtimes) return Promise.reject(new Error(`Unknown runtime group: ${group}`));
  const promiseKey = `__apexDeferredRuntimesPromise_${group}`;
  if (window[promiseKey]) {
    if (priority) warmGroupAudioWhenReady(group, window[promiseKey]);
    return window[promiseKey];
  }
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
  if (priority) warmGroupAudioWhenReady(group, gate);
  hintRuntimeSources(runtimes, 'prefetch');
  if (group === 'all') window.__apexDeferredRuntimesPromise = gate;
  return gate;
}

// E4 public battle path: selected-combatant runtime view. The canonical
// arsenalProduct group remains available for Lab/diagnostics. A stable ordered
// runtime key dedupes prepareSurface -> onBattleLive and makes rematches add
// only modules not already evaluated.
const battleRuntimePromises = new Map();
const battleRuntimeReadyKeys = new Set();
function publishBattleRuntimeState(key, heroIds, ready) {
  window.__apexBattleRuntimeState = {
    key,
    heroIds: [...new Set((Array.isArray(heroIds) ? heroIds : []).map((id) => String(id || '').toLowerCase()).filter(Boolean))],
    ready: ready === true,
  };
}
export function loadBattleGameRuntimes(heroIds) {
  const runtimes = arsenalBattleRuntimesFor(heroIds);
  const key = runtimes.map(([src]) => src).join('\n');
  if (battleRuntimeReadyKeys.has(key)) {
    publishBattleRuntimeState(key, heroIds, true);
    return Promise.resolve(true);
  }
  if (battleRuntimePromises.has(key)) return battleRuntimePromises.get(key);
  publishBattleRuntimeState(key, heroIds, false);
  const gate = enqueueGroup(runtimes, { priority: true })
    .then(() => {
      battleRuntimeReadyKeys.add(key);
      publishBattleRuntimeState(key, heroIds, true);
      return true;
    })
    .catch((error) => {
      battleRuntimePromises.delete(key);
      if (window.__apexBattleRuntimeState?.key === key) publishBattleRuntimeState(key, heroIds, false);
      throw error;
    });
  battleRuntimePromises.set(key, gate);
  // Audio scoping is a separate optimization seam. Preserve the accepted
  // arsenalProduct audio warm contract in E5; this change owns runtime
  // readiness only.
  warmGroupAudioWhenReady('arsenalProduct', gate);
  hintRuntimeSources(runtimes, 'prefetch');
  return gate;
}

// Tier 2 — likely-next background warmup. Runs only after the menu is
// interactive (callers must gate it) and yields to any route intent through
// the priority queue. Sequential by design: never monopolizes the main thread
// with parallel script execution/decode.
//
// Correction pass (menu responsiveness):
//  - NO prefetch-everything: the old boot-time hint of EVERY deferred
//    runtime is gone; each group's sources are hinted only when that group
//    actually loads (inside loadDeferredGameRuntimes).
//  - Only the genuinely likely-next groups warm (see WARMUP_GROUP_SEQUENCE);
//    legacy modes are route-intent/deep-lazy.
//  - The loop yields to a real idle slot BETWEEN groups, so evaluation chunks
//    never run back-to-back; a hard timeout keeps warmup progressing on busy
//    pages.
function yieldToIdleBudget() {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 1500 });
    } else {
      window.setTimeout(resolve, 120);
    }
  });
}
export async function scheduleDeferredGameRuntimes() {
  const start = () => {
    markBootPhase('warmup-start');
    // Prefetch the Arsenal hub critical path scripts immediately so a cold
    // product-surface press opens from warm HTTP cache during background warmup.
    try { hintRuntimeSources(ARSENAL_HUB_RUNTIMES, 'prefetch'); } catch (error) {}
    (async () => {
      for (let i = 0; i < WARMUP_GROUP_SEQUENCE.length; i++) {
        try {
          // Background warmup never preempts an in-flight route intent.
          await loadDeferredGameRuntimes(WARMUP_GROUP_SEQUENCE[i], { priority: false });
        } catch (error) {
          console.warn(`[asset-loader] Background warmup failed for group ${WARMUP_GROUP_SEQUENCE[i]}.`, error);
        }
        if (i < WARMUP_GROUP_SEQUENCE.length - 1) await yieldToIdleBudget();
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
