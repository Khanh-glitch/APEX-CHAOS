import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as assert from 'node:assert/strict';
import {
  newArmState, newRunState, recordPress, recordAccepted,
  armCastVerdict, runCastVerdict, sumArmCounts,
  controlNoise, controlThreshold, frameVsControl,
  assembleScenarioVerdict, validatePackagedGame,
} from './p0diag.js';

let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log('PASS -', name); } catch (e) { console.error('FAIL -', name, '\n', e); process.exitCode = 1; } }

// 1. Each arm has its own cast counters; the run has independent cumulative
// counters; no arm resets the cumulative counters.
t('per-arm counters are independent and cumulative run counts accumulate', () => {
  const run = newRunState();
  const a1 = newArmState(); const a2 = newArmState();
  run.arms = [a1, a2];
  recordPress(a1, run); recordAccepted(a1, run, { hero: 'ICE', slot: 'A1', mechanic: 'ice-cd', side: 'p1', at: 1.5 });
  recordPress(a2, run); recordPress(a2, run); // two presses in arm 2, none accepted
  assert.equal(a1.pressed, 1);
  assert.equal(a1.confirmed, 1);
  assert.equal(a2.pressed, 2);
  assert.equal(a2.confirmed, 0);
  // run totals are the sum; arm 2's activity did not reset arm 1's counts
  assert.equal(run.pressed, 3);
  assert.equal(run.confirmed, 1);
  assert.deepEqual(run.byHeroSkill, { 'ICE:A1': 1 });
  assert.equal(sumArmCounts(run).confirmed, run.confirmed);
});

// 2. A confirmed cast requires a gameplay-authority-accepted cast; a key
// press alone never confirms.
t('confirmed cast requires authority acceptance', () => {
  const run = newRunState(); const a = newArmState(); run.arms = [a];
  recordPress(a, run); recordPress(a, run);
  assert.equal(a.pressed, 2);
  assert.equal(a.confirmed, 0);
  assert.equal(run.confirmed, 0);
  recordAccepted(a, run, { hero: 'HUNTER', slot: 'A2', mechanic: 'hunt-cd', side: 'p2', at: 3.0 });
  assert.equal(a.confirmed, 1);
  assert.equal(run.confirmed, 1);
  assert.equal(a.byHeroSkill['HUNTER:A2'], 1);
  assert.equal(run.casts[0].hero, 'HUNTER');
  assert.equal(a.casts[0].side, 'p2');
});

// 3. Successful casts in early arms followed by zero casts in the final arm:
// the run-level verdict must NOT be "no-cast-accepted-cannot-judge", while
// the final arm is flagged "no-cast-in-arm".
t('early-arm casts survive a cast-free final arm (the reset bug is fixed)', () => {
  const run = newRunState();
  const early = newArmState(); recordAccepted(early, run, { hero: 'ICE', slot: 'A1', mechanic: 'ice-cd', side: 'p1', at: 1.5 });
  recordAccepted(early, run, { hero: 'ICE', slot: 'A1', mechanic: 'ice-cd', side: 'p1', at: 3.0 });
  const final = newArmState(); // no casts in the final arm
  run.arms = [early, final];
  assert.equal(run.confirmed, 2);
  assert.equal(runCastVerdict(run), 'casts-accepted-run-level');
  assert.equal(armCastVerdict(final), 'no-cast-in-arm');
  assert.equal(armCastVerdict(early), 'casts-in-arm');
});

// 4. Zero accepted casts in every arm => run-level cannot-judge.
t('zero accepted casts everywhere => no-cast-accepted-cannot-judge', () => {
  const run = newRunState();
  for (let i = 0; i < 5; i++) run.arms.push(newArmState());
  assert.equal(runCastVerdict(run), 'no-cast-accepted-cannot-judge');
  assert.equal(sumArmCounts(run).confirmed, 0);
});

// 5. Aggregate cast counts equal the sum of per-arm counts.
t('aggregate casts equal sum of per-arm counts', () => {
  const run = newRunState();
  const expected = [];
  for (let i = 0; i < 5; i++) {
    const a = newArmState();
    const n = i % 3;
    for (let j = 0; j < n; j++) recordAccepted(a, run, { hero: 'ICE', slot: 'A1', mechanic: 'm', side: 'p1', at: j + 1 });
    expected.push(n);
    run.arms.push(a);
  }
  assert.equal(run.confirmed, expected.reduce((s, n) => s + n, 0));
  assert.equal(sumArmCounts(run).confirmed, run.confirmed);
});

// 6. Control-noise threshold.
t('control noise and threshold', () => {
  assert.equal(controlNoise([{ avgMs: 16.7 }, { avgMs: 16.7 }]), 0);
  assert.equal(controlNoise([{ avgMs: 10 }, { avgMs: 14 }, { avgMs: 12 }]), 4);
  // factor 2x noise with 2 ms floor
  assert.equal(controlThreshold([{ avgMs: 16 }, { avgMs: 16 }]), 2.0);
  assert.equal(controlThreshold([{ avgMs: 10 }, { avgMs: 20 }]), 20.0);
});

t('frameVsControl verdicts', () => {
  const thr = 2.0;
  assert.equal(frameVsControl(14.0, 16.0, thr).verdict, 'suppression-reduces-frame-time');
  assert.equal(frameVsControl(20.0, 16.0, thr).verdict, 'slower-than-control-inconclusive');
  assert.equal(frameVsControl(16.5, 16.0, thr).verdict, 'within-control-noise');
  assert.equal(frameVsControl(14.001, 16.0, thr).verdict, 'within-control-noise');
  const d = frameVsControl(12.0, 16.0, thr);
  assert.equal(d.verdict, 'suppression-reduces-frame-time');
  assert.equal(d.delta, -4.0);
});

// 7. assembleScenarioVerdict: no accepted casts at run level.
t('scenario verdict: run-level no-cast-accepted-cannot-judge', () => {
  const arms = [];
  for (let i = 0; i < 5; i++) arms.push({ arm: ['full','noIce','noAux','noBloom','full'][i], scientificallyValid: true, applicable: true, acceptedCasts: 0, presses: 0, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 16.7 } });
  const out = assembleScenarioVerdict({ id: 'bot', p1: 'ROBOT', p2: 'HUNTER', profile: 'BOT', graphicsMode: 'bot' }, arms);
  assert.equal(out.castVerdict, 'no-cast-accepted-cannot-judge');
  assert.equal(out.overall, 'no-cast-accepted-cannot-judge');
  assert.equal(out.totalAcceptedCasts, 0);
  assert.ok(out.narrative.some((n) => n.includes('Run-level: zero accepted casts across the entire run')));
  assert.ok(out.arms.every((a) => !a.frameVerdict || a.frameVerdict === 'within-control-noise'));
});

// 8. assembleScenarioVerdict: significant suppression arm -> suspect-significant.
t('scenario verdict: significant arm flagged, control-repeat arm not flagged as subsystem', () => {
  const arms = [
    { arm: 'full', scientificallyValid: true, applicable: true, acceptedCasts: 4, presses: 5, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 16.7 } },
    { arm: 'noIce', scientificallyValid: true, applicable: true, acceptedCasts: 4, presses: 5, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 10.0 } },
    { arm: 'noAux', scientificallyValid: true, applicable: true, acceptedCasts: 4, presses: 5, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 16.8 } },
    { arm: 'noBloom', scientificallyValid: true, applicable: false, acceptedCasts: 4, presses: 5, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 16.7 } },
    { arm: 'full', scientificallyValid: true, applicable: true, acceptedCasts: 4, presses: 5, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 16.8 } },
  ];
  const out = assembleScenarioVerdict({ id: 'local-perf', p1: 'ICE', p2: 'HUNTER', profile: 'LOCAL', graphicsMode: 'local-perf' }, arms);
  assert.equal(out.castVerdict, 'casts-accepted-run-level');
  assert.equal(out.totalAcceptedCasts, 20);
  assert.equal(out.countsMatch, true);
  const noIce = out.arms.find((a) => a.arm === 'noIce');
  assert.equal(noIce.frameVerdict, 'suppression-reduces-frame-time');
  assert.ok(noIce.frameDeltaMs < -2, String(noIce.frameDeltaMs));
  const noBloom = out.arms.find((a) => a.arm === 'noBloom');
  assert.equal(noBloom.frameVerdict, undefined);
  assert.ok(out.narrative.some((n) => n.includes('noIce') && n.includes('measurable frame-cost contributor')));
  assert.equal(out.overall, 'suspect-significant');
});

// 9. assembleScenarioVerdict: invalid/inapplicable arms cannot identify bottleneck.
t('scenario verdict: invalid arm cannot identify a bottleneck', () => {
  const arms = [
    { arm: 'full', scientificallyValid: true, applicable: true, acceptedCasts: 3, presses: 3, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 16.7 } },
    { arm: 'noIce', scientificallyValid: false, applicable: true, acceptedCasts: 3, presses: 3, casts: [], byHeroSkill: {}, frameSamples: { count: 10, avgMs: 999 }, validityReasons: ['frame sample count 10 below minimum 100'] },
    { arm: 'noAux', scientificallyValid: false, applicable: false, acceptedCasts: 0, presses: 0, casts: [], byHeroSkill: {}, frameSamples: { count: 0, avgMs: 0 } },
    { arm: 'noBloom', scientificallyValid: true, applicable: false, acceptedCasts: 3, presses: 3, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 16.7 } },
    { arm: 'full', scientificallyValid: true, applicable: true, acceptedCasts: 3, presses: 3, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 16.8 } },
  ];
  const out = assembleScenarioVerdict({ id: 'local-high', p1: 'ICE', p2: 'HUNTER', profile: 'LOCAL', graphicsMode: 'local-high' }, arms);
  assert.equal(out.overall, 'within-control-noise');
  assert.ok(out.narrative.some((n) => n.includes('inapplicable arm')));
  assert.equal(out.arms.find((a) => a.arm === 'noIce').scientificallyValid, false);
  assert.equal(out.arms.find((a) => a.arm === 'noIce').frameVerdict, undefined);
});

// 10. assembleScenarioVerdict: all within control noise.
t('scenario verdict: within-control-noise when no arm exceeds threshold', () => {
  const arms = [];
  for (let i = 0; i < 5; i++) arms.push({ arm: ['full','noIce','noAux','noBloom','full'][i], scientificallyValid: true, applicable: true, acceptedCasts: 2, presses: 2, casts: [], byHeroSkill: {}, frameSamples: { count: 300, avgMs: 16.7 + (i % 2) * 0.3 } });
  const out = assembleScenarioVerdict({ id: 'local-high', p1: 'ICE', p2: 'HUNTER', profile: 'LOCAL', graphicsMode: 'local-high' }, arms);
  assert.equal(out.overall, 'within-control-noise');
  assert.ok(out.narrative.some((n) => n.includes('within control noise')));
});

// 11. validatePackagedGame integrity checks (temp dirs).
t('validatePackagedGame: missing app/index.html reports error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0diag-test-'));
  try {
    const r = validatePackagedGame(dir);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('app/index.html')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

t('validatePackagedGame: SHA mismatch reports error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0diag-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'diag'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app', 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'app', 'ARSENAL_BUILD_SHA.txt'), 'expected-sha\n');
    fs.writeFileSync(path.join(dir, 'diag', 'build.expect'), 'different-sha\n');
    const r = validatePackagedGame(dir);
    assert.equal(r.ok, false);
    assert.equal(r.shaMatch, false);
    assert.ok(r.errors.some((e) => e.includes('mismatch')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

t('validatePackagedGame: matching SHA passes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0diag-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'diag'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app', 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'app', 'ARSENAL_BUILD_SHA.txt'), 'abc123\n');
    fs.writeFileSync(path.join(dir, 'diag', 'build.expect'), 'abc123\n');
    const r = validatePackagedGame(dir);
    assert.equal(r.ok, true);
    assert.equal(r.shaMatch, true);
    assert.equal(r.expectedSha, 'abc123');
    assert.equal(r.actualSha, 'abc123');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

console.log(`\n${passed} tests passed`);
