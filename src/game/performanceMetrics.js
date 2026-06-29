const MAX_TIMINGS = 250;
const MAX_FRAME_SAMPLES = 600;

const now = () => performance.now();
const round = (value, digits = 1) => Number(value.toFixed(digits));

const state = {
  boot: {
    startedAt: now(),
    interactiveAt: null,
    loaderHiddenAt: null,
    phases: [],
  },
  timings: [],
  frames: [],
  longTasks: [],
};

function pushBounded(list, value, limit) {
  list.push(value);
  if (list.length > limit) list.splice(0, list.length - limit);
}

export function beginPerfSpan(category, name, metadata = {}) {
  const startedAt = now();
  let finished = false;
  return (extra = {}) => {
    if (finished) return null;
    finished = true;
    const timing = {
      category,
      name,
      startedAt: round(startedAt),
      durationMs: round(now() - startedAt),
      ...metadata,
      ...extra,
    };
    pushBounded(state.timings, timing, MAX_TIMINGS);
    return timing;
  };
}

export function markBootPhase(name, metadata = {}) {
  state.boot.phases.push({ name, atMs: round(now() - state.boot.startedAt), ...metadata });
}

export function markBootInteractive() {
  if (state.boot.interactiveAt !== null) return;
  state.boot.interactiveAt = now();
  markBootPhase('interactive');
  startFrameMonitor();
}

export function markLoaderHidden() {
  if (state.boot.loaderHiddenAt !== null) return;
  state.boot.loaderHiddenAt = now();
  markBootPhase('loader-hidden');
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function frameSummary() {
  const values = state.frames.map((sample) => sample.durationMs);
  if (!values.length) return { samples: 0, avgMs: 0, p95Ms: 0, maxMs: 0, fps: 0, slowFrames: 0 };
  const total = values.reduce((sum, value) => sum + value, 0);
  const avgMs = total / values.length;
  return {
    samples: values.length,
    avgMs: round(avgMs, 2),
    p95Ms: round(percentile(values, 0.95), 2),
    maxMs: round(Math.max(...values), 2),
    fps: round(1000 / avgMs, 1),
    slowFrames: values.filter((value) => value > 20).length,
  };
}

function slowestTimings(limit = 12) {
  return [...state.timings]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, limit);
}

export function getPerformanceReport() {
  const current = now();
  const longTaskSamples = [...state.longTasks];
  return {
    boot: {
      interactiveMs: state.boot.interactiveAt === null ? null : round(state.boot.interactiveAt - state.boot.startedAt),
      loaderHiddenMs: state.boot.loaderHiddenAt === null ? null : round(state.boot.loaderHiddenAt - state.boot.startedAt),
      elapsedMs: round(current - state.boot.startedAt),
      phases: [...state.boot.phases],
    },
    resources: {
      samples: state.timings.length,
      slowest: slowestTimings(),
      timings: [...state.timings],
    },
    frames: frameSummary(),
    longTasks: {
      count: longTaskSamples.length,
      totalMs: round(longTaskSamples.reduce((sum, task) => sum + task.durationMs, 0)),
      slowest: [...longTaskSamples].sort((a, b) => b.durationMs - a.durationMs).slice(0, 12),
      samples: longTaskSamples,
    },
  };
}

let frameMonitorStarted = false;
function startFrameMonitor() {
  if (frameMonitorStarted || typeof requestAnimationFrame !== 'function') return;
  frameMonitorStarted = true;
  let previous = 0;
  const sample = (timestamp) => {
    if (document.visibilityState !== 'visible') {
      previous = timestamp;
    } else if (previous) {
      const durationMs = timestamp - previous;
      if (durationMs > 0 && durationMs < 250) {
        pushBounded(state.frames, { at: round(timestamp), durationMs: round(durationMs, 2) }, MAX_FRAME_SAMPLES);
      }
      previous = timestamp;
    } else {
      previous = timestamp;
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

if (typeof PerformanceObserver !== 'undefined') {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        pushBounded(state.longTasks, {
          at: round(entry.startTime),
          durationMs: round(entry.duration),
        }, 100);
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch (error) {
    // Long Tasks API is optional and is not exposed by every browser.
  }
}

if (typeof window !== 'undefined') {
  window.apexPerfReport = () => getPerformanceReport();
  window.apexPerfSummary = () => {
    const report = getPerformanceReport();
    console.info('[Apex Perf] Slowest resources');
    console.table(report.resources.slowest);
    console.info('[Apex Perf] Slowest long tasks');
    console.table(report.longTasks.slowest);
    console.info('[Apex Perf]', { boot: report.boot, frames: report.frames, longTasks: report.longTasks });
    return report;
  };
}

markBootPhase('metrics-ready');
