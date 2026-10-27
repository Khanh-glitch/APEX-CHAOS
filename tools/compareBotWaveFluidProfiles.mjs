// Compare same-run Apple Metal baselines. Display all measured regressions;
// deliberately never turn a single noisy A/B pair into a release-ready claim.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const dir = process.env.APEX_EVIDENCE_DIR || 'reports/bot-wave-metal-hardware';
const baseline = JSON.parse(fs.readFileSync(`${dir}/bot-wave-baseline.summary.json`, 'utf8'));
const variant = process.env.APEX_COMPARE_VARIANT || 'lossless';
assert.ok(['lossless', 'smoke-cache', 'wasm'].includes(variant), 'Unsupported A/B variant');
const candidate = JSON.parse(fs.readFileSync(`${dir}/bot-wave-${variant}.summary.json`, 'utf8'));
assert.equal(baseline.fluidVariant, 'baseline');
assert.equal(candidate.fluidVariant, variant);
assert.equal(baseline.fixture.canvas.dpr, candidate.fixture.canvas.dpr);
assert.deepEqual(baseline.fixture.canvas, candidate.fixture.canvas);
assert.equal(baseline.durationMs, candidate.durationMs);
assert.equal(baseline.browser.version.product, candidate.browser.version.product);
assert.equal(baseline.runtime.phase, 'combat');
assert.equal(candidate.runtime.phase, 'combat');
assert.ok(baseline.gameRuntimeSamples.every(s => s.phase === 'combat' && !s.paused));
assert.ok(candidate.gameRuntimeSamples.every(s => s.phase === 'combat' && !s.paused));
assert.ok(baseline.frameTiming.count > 1000 && candidate.frameTiming.count > 1000);
function metric(label, extract, higherIsBetter = false) {
    const before = extract(baseline), after = extract(candidate);
    assert.ok(Number.isFinite(before) && Number.isFinite(after), `Invalid metric: ${label}`);
    const improvementPercent = before === 0 ? null :
        Number((((higherIsBetter ? after / before - 1 : 1 - after / before)) * 100).toFixed(2));
    return { baseline: before, candidate: after, improvementPercent };
}
const metrics = {
    meanFps: metric('meanFps', s => s.frameTiming.averageFps, true),
    frameP95Ms: metric('frameP95Ms', s => s.frameTiming.p95Ms),
    frameP99Ms: metric('frameP99Ms', s => s.frameTiming.p99Ms),
    inputP95Ms: metric('inputP95Ms', s => s.inputToNextRaf.p95Ms),
    inputP99Ms: metric('inputP99Ms', s => s.inputToNextRaf.p99Ms),
    longTasks: metric('longTasks', s => s.longTasks.count),
    maxLongTaskMs: metric('maxLongTaskMs', s => s.longTasks.maxMs)
};
const comparison = {
    timestamp: new Date().toISOString(), variant, baselineRun: baseline.runId,
    candidateRun: candidate.runId, browser: baseline.browser.version.product,
    gpu: baseline.gpu.devices, viewport: baseline.browser.viewport, durationMs: baseline.durationMs,
    metrics,
    conclusion: 'Diagnostic only. One paired virtualized-Apple-Metal A/B is not physical-mobile acceptance. Compare repeat runs and bitwise solver parity; only ship if substantial gains recur.'
};
fs.writeFileSync(`${dir}/fluid-comparison-${variant}.json`, JSON.stringify(comparison, null, 2) + '\n');
console.log('BOT WAVE SAME-HOST HARDWARE A/B', JSON.stringify(metrics, null, 2));
