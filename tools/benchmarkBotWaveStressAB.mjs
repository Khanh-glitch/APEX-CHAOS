// Counterbalanced repeated BOT WAVE stress A/B with fresh Chromium processes.
// Each pair shares a random seed and identical viewport, actors, effects and input.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const output = process.env.APEX_EVIDENCE_DIR || 'reports/bot-wave-stress-ab';
fs.mkdirSync(output, { recursive: true });
const reps = Number(process.env.APEX_STRESS_REPLICATES || 3);
const durationMs = Number(process.env.APEX_STRESS_DURATION_MS || 60000);
const profile = process.env.APEX_PERF_PROFILE || 'desktop-1440x900';
const bots = Number(process.env.APEX_PERF_BOTS || 14);
const seedBase = Number(process.env.APEX_STRESS_SEED || 20261027) >>> 0;
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const warmupMs = Number(process.env.APEX_PERF_WARMUP_MS || 4000);
const schedule = Array.from({ length: reps }, (_, i) => i % 2 ? ['on', 'off'] : ['off', 'on']);
const results = [];
const childTimeoutMs = Number(process.env.APEX_STRESS_CHILD_TIMEOUT_MS || durationMs * 4 + 180000);
const percentile = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return { n: sorted.length, p50: sorted[Math.floor((sorted.length - 1) * .5)], p95: sorted[Math.floor((sorted.length - 1) * .95)], p99: sorted[Math.floor((sorted.length - 1) * .99)] };
};
for (let pair = 0; pair < reps; pair++) {
  const seed = (seedBase + pair) >>> 0;
  const pairResults = {};
  for (const mode of schedule[pair]) {
    const runId = `pair-${String(pair + 1).padStart(2, '0')}-${mode}-seed-${seed}`;
    const env = {
      ...process.env,
      APEX_APP_URL: appUrl,
      APEX_PERF_MODE: mode,
      APEX_PERF_PROFILE: profile,
      APEX_PERF_BOTS: String(bots),
      APEX_PERF_SEED: String(seed),
      APEX_PERF_DURATION_MS: String(durationMs),
      APEX_PERF_WARMUP_MS: String(warmupMs),
      APEX_PERF_RUN_ID: runId,
      APEX_EVIDENCE_DIR: output,
    };
    console.log(`\n=== Stress A/B pair ${pair + 1}/${reps}: ${mode}, seed ${seed}, ${durationMs} ms ===`);
    const child = spawnSync(process.execPath, ['tools/profileBotWaveStressRun.mjs'], {
      cwd: process.cwd(), env, stdio: 'inherit', timeout: childTimeoutMs,
    });
    const reportPath = path.join(output, `stress-${runId}.json`);
    const failurePath = path.join(output, `failure-${runId}.json`);
    const run = {
      pair: pair + 1, seed, mode, runId, exitStatus: child.status,
      signal: child.signal || null, error: child.error ? String(child.error) : null,
      reportPath: fs.existsSync(reportPath) ? reportPath : null,
      failurePath: fs.existsSync(failurePath) ? failurePath : null,
      report: fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null,
      failure: fs.existsSync(failurePath) ? JSON.parse(fs.readFileSync(failurePath, 'utf8')) : null,
    };
    pairResults[mode] = run;
    results.push(run);
  }
  const off = pairResults.off?.report, on = pairResults.on?.report;
  if (off && on) console.log('PAIRED_STRESS_DELTA', JSON.stringify({ pair: pair + 1, seed,
    frameP95Ms: { off: off.frameTimeP95Ms, on: on.frameTimeP95Ms, deltaPct: +(100 * (on.frameTimeP95Ms - off.frameTimeP95Ms) / Math.max(1, off.frameTimeP95Ms)).toFixed(1) },
    frameP99Ms: { off: off.frameTimeP99Ms, on: on.frameTimeP99Ms, deltaPct: +(100 * (on.frameTimeP99Ms - off.frameTimeP99Ms) / Math.max(1, off.frameTimeP99Ms)).toFixed(1) },
    inputP95Ms: { off: off.inputToNextFrameP95Ms, on: on.inputToNextFrameP95Ms, deltaPct: +(100 * (on.inputToNextFrameP95Ms - off.inputToNextFrameP95Ms) / Math.max(1, off.inputToNextFrameP95Ms)).toFixed(1) },
    inputP99Ms: { off: off.inputToNextFrameP99Ms, on: on.inputToNextFrameP99Ms, deltaPct: +(100 * (on.inputToNextFrameP99Ms - off.inputToNextFrameP99Ms) / Math.max(1, off.inputToNextFrameP99Ms)).toFixed(1) },
  }));
}
const paired = [];
for (let pair = 1; pair <= reps; pair++) {
  const off = results.find(r => r.pair === pair && r.mode === 'off')?.report;
  const on = results.find(r => r.pair === pair && r.mode === 'on')?.report;
  if (off && on) paired.push({ pair, seed: off.seed, off, on });
}
const metrics = ['frameTimeP95Ms', 'frameTimeP99Ms', 'inputToNextFrameP95Ms', 'inputToNextFrameP99Ms', 'renderP95Ms', 'postP95Ms'];
const pairedDeltas = Object.fromEntries(metrics.map(key => [key, percentile(paired.map(p => 100 * (p.on[key] - p.off[key]) / Math.max(1, p.off[key])))]));
const stableImprovement = paired.length === reps && paired.every(p =>
  p.on.frameTimeP95Ms <= p.off.frameTimeP95Ms && p.on.frameTimeP99Ms <= p.off.frameTimeP99Ms &&
  p.on.inputToNextFrameP95Ms <= p.off.inputToNextFrameP95Ms && p.on.inputToNextFrameP99Ms <= p.off.inputToNextFrameP99Ms) &&
  paired.some(p => p.on.frameTimeP95Ms < p.off.frameTimeP95Ms || p.on.frameTimeP99Ms < p.off.frameTimeP99Ms ||
    p.on.inputToNextFrameP95Ms < p.off.inputToNextFrameP95Ms || p.on.inputToNextFrameP99Ms < p.off.inputToNextFrameP99Ms);
const report = {
  createdAt: new Date().toISOString(), appUrl, profile, bots, durationMsPerRun: durationMs,
  totalMeasuredSecondsPerMode: paired.length ? paired.length * durationMs / 1000 : 0,
  seeds: paired.map(p => p.seed), order: schedule, randomizedOrder: 'counterbalanced off/on, on/off, off/on',
  stableImprovement, pairedReplicates: paired.length, pairedDeltasPercent: pairedDeltas,
  acceptance: 'This report measures headless Chromium/SwiftShader only. A performance pass does not establish production readiness, physical mobile GPU performance, or gameplay/CI acceptance.',
  metrics, paired: paired.map(p => ({ pair: p.pair, seed: p.seed,
    off: Object.fromEntries(metrics.map(k => [k, p.off[k]])),
    on: Object.fromEntries(metrics.map(k => [k, p.on[k]])),
    actors: { off: p.off.activeBotsAtEnd, on: p.on.activeBotsAtEnd },
    movementPx: { off: p.off.movementPx, on: p.on.movementPx },
    gameClockSeconds: { off: p.off.gameClockSeconds, on: p.on.gameClockSeconds },
  })),
  runs: results.map(({ report: runReport, failure, ...run }) => ({ ...run, report: runReport ? { reportPath: run.reportPath } : null, failure: failure ? { failurePath: run.failurePath, stage: failure.stage, message: failure.message } : null })),
};
const reportPath = path.join(output, `ab-summary-${profile}-${Date.now()}.json`);
const markdownPath = reportPath.replace(/\.json$/, '.md');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const rows = metrics.map(key => `| ${key} | ${paired.map(p => p.off[key].toFixed(2)).join(' / ')} | ${paired.map(p => p.on[key].toFixed(2)).join(' / ')} | ${pairedDeltas[key]?.p50?.toFixed(1) ?? 'n/a'}% |`).join('\n');
fs.writeFileSync(markdownPath, `# BOT WAVE repeated stress A/B\n\n- Profile: ${profile}; bots: ${bots}; duration: ${durationMs / 1000}s per run; pairs: ${paired.length}\n- Order: counterbalanced (off/on, on/off, off/on)\n- Stable improvement across frame P95/P99 and input-to-next-frame P95/P99: **${stableImprovement ? 'YES' : 'NO'}**\n- Environment: headless Chromium/SwiftShader; not physical mobile GPU evidence\n\n| Metric | Baseline P95/P99 by pair | Candidate P95/P99 by pair | Median paired delta |\n|---|---:|---:|---:|\n${rows}\n\nRaw report: ${path.basename(reportPath)}\n`);
console.log('\nBOT_WAVE_STRESS_AB_SUMMARY', JSON.stringify({ reportPath, markdownPath, stableImprovement, pairedReplicates: paired.length, pairedDeltasPercent: pairedDeltas }));
if (paired.length !== reps || results.some(r => r.exitStatus !== 0)) process.exitCode = 1;
