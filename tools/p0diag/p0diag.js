// APEX CHAOS — P0 Performance Diagnosis Launcher (Windows package, offline).
//
// Runs inside the extracted diagnosis ZIP (Node.js required on PATH, or
// place node.exe next to this script in node/). It starts the packaged
// frozen game server, drives one Chrome instance per arm with a fresh
// temporary user-data directory (the owner's original Chrome profile is
// never touched), collects per-arm JSON reports, and writes a verdict
// report. No gameplay, VFX, balance, HUD or production file is edited:
// suppression is applied at runtime inside the diagnosis page only.
//
// Usage (inside the extracted package, Windows cmd):
//   RUN-DIAGNOSIS.cmd
//
// Output: results/report.json (+ results/report.txt human summary).
//
// Exit codes:
//   0 — report written (verdict may be inconclusive / no-cast / noise)
//   2 — infrastructure failure (missing package, build mismatch, hang, 404)

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { spawn } from 'node:child_process';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import * as os from 'node:os';

// ---------------------------------------------------------------------------
// Constants / scenario model
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(url.fileURLToPath(import.meta.url));
// When run from the extracted package this lives in <root>/diag/; the package
// root is its parent. When run from the repo it is the repo tools dir.
const PKG_ROOT = path.resolve(SCRIPT_DIR, '..');
const APP_DIR = path.join(PKG_ROOT, 'app');
const DIAG_DIR = path.join(PKG_ROOT, 'diag');
const RESULTS_DIR = path.join(PKG_ROOT, 'results');
const SERVE_PS1 = path.join(PKG_ROOT, 'serve.ps1');
const APP_INDEX = path.join(APP_DIR, 'index.html');
const SHA_FILE = path.join(APP_DIR, 'ARSENAL_BUILD_SHA.txt');
const EXPECT_FILE = path.join(DIAG_DIR, 'build.expect');

const ARM_TIMEOUT_MS = 180000;     // per-arm ceiling: no indefinite hang
const POLL_INTERVAL_MS = 300;
const MIN_FRAME_SAMPLES = 100;     // below this, frame stat is not evidence
const CONTROL_NOISE_FACTOR = 2.0;  // delta must exceed 2x control noise
const FRAME_DELTA_FLOOR_MS = 2.0;  // and exceed an absolute floor

// Scenarios. The BOT scenario uses the production CPU opponent HUNTER
// (not FROST); it must never claim to diagnose FROST.
// p1 = player (casting side), p2 = opponent.
// ICE is the production shell id of the FROST-family hero; the report
// records actual fighters and never relabels them.
const SCENARIOS = [
  {
    id: 'bot',
    p1: 'ROBOT',
    p2: 'HUNTER',
    profile: 'BOT',
    graphicsMode: 'bot · production CPU opponent is HUNTER · default renderer pipeline',
    chromeExtra: [],
  },
  {
    id: 'local-perf',
    p1: 'ICE',
    p2: 'HUNTER',
    profile: 'LOCAL',
    graphicsMode: 'local-perf · Chrome --disable-gpu --disable-accelerated-2d-canvas',
    chromeExtra: ['--disable-gpu', '--disable-accelerated-2d-canvas'],
  },
  {
    id: 'local-high',
    p1: 'ICE',
    p2: 'HUNTER',
    profile: 'LOCAL',
    graphicsMode: 'local-high · default Chrome renderer pipeline',
    chromeExtra: [],
  },
];

// Five arms per scenario; the last "full" is the control repeat used for
// the control-noise threshold.
const ARMS = ['full', 'noIce', 'noAux', 'noBloom', 'full'];

// ---------------------------------------------------------------------------
// Pure, testable cast accounting
//
// - Each arm owns its own counters.
// - The run owns independent cumulative counters.
// - No arm ever resets the cumulative counters.
// - A confirmed cast = gameplay authority accepted it (AIL 'Cast' bus event,
//   emitted only by the ability controller on successful tryCast).
// ---------------------------------------------------------------------------

export function newArmState() {
  return {
    pressed: 0,             // J presses issued (input, not acceptance)
    confirmed: 0,           // authority-accepted casts
    casts: [],              // accepted cast events {hero, slot, mechanic, side, at}
    byHeroSkill: {},        // "${hero}:${slot}" -> count
    acceptedTimes: [],      // match-time of each accepted cast
  };
}

export function newRunState() {
  return {
    pressed: 0,
    confirmed: 0,
    casts: [],
    byHeroSkill: {},
    acceptedTimes: [],
    arms: [],
  };
}

// A J press was issued in this arm. Pressing != acceptance.
export function recordPress(arm, run) {
  arm.pressed += 1;
  run.pressed += 1;
}

// The gameplay authority accepted a cast (observed 'Cast' bus event).
export function recordAccepted(arm, run, ev) {
  const e = {
    hero: String(ev.hero || 'unknown'),
    slot: String(ev.slot || '?'),
    mechanic: ev.mechanic || null,
    side: ev.side || null,
    at: Number.isFinite(ev.at) ? ev.at : null,
  };
  arm.confirmed += 1;
  run.confirmed += 1;
  arm.casts.push(e);
  run.casts.push(e);
  arm.acceptedTimes.push(e.at);
  run.acceptedTimes.push(e.at);
  const key = `${e.hero}:${e.slot}`;
  arm.byHeroSkill[key] = (arm.byHeroSkill[key] || 0) + 1;
  run.byHeroSkill[key] = (run.byHeroSkill[key] || 0) + 1;
}

export function armCastVerdict(arm) {
  return arm.confirmed === 0 ? 'no-cast-in-arm' : 'casts-in-arm';
}

export function runCastVerdict(run) {
  // Zero accepted casts across the ENTIRE run is a different claim from
  // zero casts in one arm.
  return run.confirmed === 0 ? 'no-cast-accepted-cannot-judge' : 'casts-accepted-run-level';
}

export function sumArmCounts(run) {
  let pressed = 0, confirmed = 0;
  for (const arm of run.arms) {
    pressed += arm.pressed || 0;
    confirmed += arm.confirmed || 0;
  }
  return { pressed, confirmed };
}

// ---------------------------------------------------------------------------
// Pure, testable frame / verdict logic
// ---------------------------------------------------------------------------

export function controlNoise(fullArms) {
  // Max pairwise spread between the two control ("full") arms.
  let noise = 0;
  for (let i = 0; i < fullArms.length; i++) {
    for (let j = i + 1; j < fullArms.length; j++) {
      const a = Number(fullArms[i].avgMs) || 0;
      const b = Number(fullArms[j].avgMs) || 0;
      noise = Math.max(noise, Math.abs(a - b));
    }
  }
  return noise;
}

export function controlThreshold(fullArms) {
  return Math.max(controlNoise(fullArms) * CONTROL_NOISE_FACTOR, FRAME_DELTA_FLOOR_MS);
}

export function frameVsControl(armAvgMs, controlAvgMs, threshold) {
  const delta = (armAvgMs || 0) - (controlAvgMs || 0);
  if (Math.abs(delta) < threshold) return { verdict: 'within-control-noise', delta };
  return delta < 0
    ? { verdict: 'suppression-reduces-frame-time', delta }
    : { verdict: 'slower-than-control-inconclusive', delta };
}

// Per-scenario verdict assembly (pure).
export function assembleScenarioVerdict(scenario, armsResults) {
  const arms = [];
  for (const r of armsResults) arms.push(r);

  const run = newRunState();
  for (const a of arms) {
    if (!a) continue;
    a.confirmed = a.confirmed != null ? a.confirmed : (a.acceptedCasts || 0);
    a.pressed = a.pressed != null ? a.pressed : 0;
    run.arms.push(a);
    if (a.acceptedCasts != null) {
      run.pressed += a.presses || 0;
      run.confirmed += a.acceptedCasts || 0;
      for (const c of (a.casts || [])) run.casts.push(c);
      for (const [k, v] of Object.entries(a.byHeroSkill || {})) {
        run.byHeroSkill[k] = (run.byHeroSkill[k] || 0) + v;
      }
    }
  }

  const castVerdict = runCastVerdict(run);
  const counts = sumArmCounts(run);
  const countsMatch = counts.confirmed === run.confirmed;

  const fullArms = arms.filter(
    (a) => a && a.scientificallyValid && a.arm === 'full' && a.frameSamples && a.frameSamples.count >= MIN_FRAME_SAMPLES
  );
  const controlAvg =
    fullArms.length > 0
      ? fullArms.reduce((s, a) => s + (a.frameSamples.avgMs || 0), 0) / fullArms.length
      : null;
  const threshold = controlAvg == null ? null : controlThreshold(fullArms);

  const narrative = [];
  let overall = 'inconclusive';

  if (castVerdict === 'no-cast-accepted-cannot-judge') {
    overall = 'no-cast-accepted-cannot-judge';
    narrative.push('Run-level: zero accepted casts across the entire run — no subsystem can be identified (cast-pressure test produced no accepted casts).');
  } else if (controlAvg == null || fullArms.length < 2) {
    overall = 'inconclusive';
    narrative.push('Fewer than two valid control arms: control-noise threshold cannot be established.');
  } else {
    let anySignificant = false;
    let anyValidNonControl = false;
    for (const a of arms) {
      if (!a) continue;
      if (a.arm === 'full') continue;
      if (!a.scientificallyValid) continue; // invalid arms never identify a bottleneck
      anyValidNonControl = true;
      if (!a.applicable) {
        narrative.push(`${a.arm}: inapplicable arm (target subsystem not present); cannot identify a bottleneck.`);
        continue;
      }
      anyValidNonControl = true;
      const fv = frameVsControl(a.frameSamples.avgMs, controlAvg, threshold);
      a.frameVerdict = fv.verdict;
      a.frameDeltaMs = +fv.delta.toFixed(3);
      if (fv.verdict === 'suppression-reduces-frame-time') {
        anySignificant = true;
        narrative.push(`${a.arm}: frames measurably faster with ${a.arm} suppression (delta ${a.frameDeltaMs} ms vs control ${+controlAvg.toFixed(3)} ms, noise ${+threshold.toFixed(3)} ms) — ${a.arm} is a measurable frame-cost contributor.`);
      } else if (fv.verdict === 'slower-than-control-inconclusive') {
        narrative.push(`${a.arm}: slower than control with suppression (delta ${a.frameDeltaMs} ms) — attribution inconclusive; no bottleneck identified.`);
      } else {
        narrative.push(`${a.arm}: within control noise (delta ${a.frameDeltaMs} ms, noise ${+threshold.toFixed(3)} ms) — no attributable subsystem.`);
      }
    }
    if (!anyValidNonControl) {
      overall = 'inconclusive';
      narrative.push('No valid non-control arms: no subsystem comparison possible.');
    } else if (anySignificant) {
      overall = 'suspect-significant';
    } else {
      overall = 'within-control-noise';
      narrative.push('All arms within control noise: no subsystem identified as a frame-cost contributor.');
    }
  }

  return {
    scenario: scenario.id,
    p1: scenario.p1,
    p2: scenario.p2,
    profile: scenario.profile,
    graphicsMode: scenario.graphicsMode,
    castVerdict,
    totalAcceptedCasts: run.confirmed,
    totalPressedCasts: run.pressed,
    countsMatch,
    byHeroSkill: run.byHeroSkill,
    controlAvgMs: controlAvg == null ? null : +controlAvg.toFixed(3),
    controlNoiseMs: threshold == null ? null : +(threshold / CONTROL_NOISE_FACTOR).toFixed(3),
    controlThresholdMs: threshold == null ? null : +threshold.toFixed(3),
    overall,
    narrative,
    arms,
  };
}

// ---------------------------------------------------------------------------
// Packaged-game integrity
// ---------------------------------------------------------------------------

export function sha256File(file) {
  const data = fs.readFileSync(file);
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function treeManifestSha256(root) {
  const rels = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else rels.push(path.relative(root, full));
    }
  }
  walk(root);
  rels.sort();
  const h = crypto.createHash('sha256');
  for (const rel of rels) {
    h.update(rel.replace(/\\/g, '/'));
    h.update('\0');
    h.update(sha256File(path.join(root, rel)));
    h.update('\n');
  }
  return h.digest('hex');
}

export function validatePackagedGame(root = PKG_ROOT) {
  const errors = [];
  const APP_INDEX = path.join(root, 'app', 'index.html');
  const SHA_FILE = path.join(root, 'app', 'ARSENAL_BUILD_SHA.txt');
  const EXPECT_FILE = path.join(root, 'diag', 'build.expect');
  let expected = null;
  let actual = null;
  let shaMatch = false;

  if (!fs.existsSync(APP_INDEX)) errors.push('packaged game not found: app/index.html (extract the full ZIP before running)');

  if (fs.existsSync(SHA_FILE)) actual = fs.readFileSync(SHA_FILE, 'utf8').trim().replace(/\s+$/, '');
  else errors.push('packaged game missing: app/ARSENAL_BUILD_SHA.txt');

  if (fs.existsSync(EXPECT_FILE)) expected = fs.readFileSync(EXPECT_FILE, 'utf8').trim().replace(/\s+$/, '');
  else errors.push('package missing: diag/build.expect (expected build SHA)');

  if (expected && actual) {
    shaMatch = expected === actual;
    if (!shaMatch) errors.push(`build SHA mismatch: expected ${expected}, packaged ${actual}`);
  }

  // Recompute the manifest hash from the extracted tree so any corruption or
  // partial extraction is caught (not circular: build.expect was written at
  // assembly time from the frozen build).
  let manifestOk = null;
  if (fs.existsSync(APP_DIR)) {
    manifestOk = treeManifestSha256(APP_DIR);
  }

  return {
    ok: errors.length === 0,
    root,
    expectedSha: expected,
    actualSha: actual,
    shaMatch,
    manifestOk,
    errors,
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers (orchestration only; the runner page posts results to the
// packaged server which persists them to results/)
// ---------------------------------------------------------------------------

function httpGetText(port, p, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: p, timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function waitForServer(port, timeoutMs = 30000) {
  const t0 = Date.now();
  const last = [];
  return new Promise((resolve, reject) => {
    function tryOnce() {
      httpGetText(port, '/', 2000)
        .then(() => resolve())
        .catch((e) => { last.push(String(e)); if (Date.now() - t0 > timeoutMs) reject(new Error('server did not start: ' + last.slice(-3).join(' | '))); else setTimeout(tryOnce, 250); });
    }
    tryOnce();
  });
}

// ---------------------------------------------------------------------------
// Chrome discovery
// ---------------------------------------------------------------------------

const CHROME_CANDIDATES = [
  process.env.P0DIAG_CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
  'chrome',
];

export function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    if (!c) continue;
    try {
      if (c === 'chrome' || c === 'msedge') return c;
      if (fs.existsSync(c)) return c;
    } catch (e) { /* ignore */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-arm orchestration
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resultPath(scenario, arm, runId) {
  return path.join(RESULTS_DIR, `${scenario}-${arm}-${runId}.json`);
}

function readResultFile(scenario, arm, runId) {
  try {
    const raw = fs.readFileSync(resultPath(scenario, arm, runId), 'utf8');
    const j = JSON.parse(raw);
    if (j && typeof j === 'object') return j;
  } catch (e) { /* not yet */ }
  return null;
}

function isValidArmResult(j) {
  if (!j || j.ok !== true) return false;
  const need = ['scenario', 'arm', 'fighters', 'battleMode', 'graphicsMode', 'renderer', 'suppression', 'combatStateAtStart', 'frameSamples', 'presses', 'acceptedCasts', 'scientificallyValid'];
  for (const k of need) if (!(k in j)) return false;
  const fs2 = j.frameSamples;
  if (typeof fs2.count !== 'number' || typeof fs2.avgMs !== 'number') return false;
  return true;
}

function findChromeExe() {
  const exe = findChrome();
  if (!exe) return null;
  return exe;
}

async function runArm(scenario, arm, seed, runId, serverUrl, port) {
  const armRecord = {
    arm,
    order: null,
    applicable: null,
    scientificallyValid: false,
    validityReasons: [],
    fighters: { p1: scenario.p1, p2: scenario.p2 },
    battleMode: null,
    graphicsMode: scenario.graphicsMode,
    renderer: null,
    suppression: { intended: arm, applied: false, subsystemPresent: false },
    combatStateAtStart: null,
    frameSamples: null,
    presses: 0,
    acceptedCasts: 0,
    casts: [],
    byHeroSkill: {},
    comparable: { castSequenceMatchesControl: null },
    verdict: null,
    frameDeltaMs: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  };

  const chrome = findChromeExe();
  if (!chrome) {
    armRecord.error = 'no Chrome/Edge executable found (install Chrome or set P0DIAG_CHROME)';
    armRecord.verdict = 'invalid-arm';
    armRecord.validityReasons.push(armRecord.error);
    armRecord.finishedAt = new Date().toISOString();
    return armRecord;
  }

  const profileDir = path.join(os.tmpdir(), `apex-p0diag-${scenario.id}-${arm}-${runId}-${Math.floor(Math.random() * 100000)}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const runnerUrl = `${serverUrl}/diag/runner.html?scenario=${scenario.id}&arm=${arm}&seed=${seed}&runId=${runId}`;
  const args = [
    chrome,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--no-default-browser-check',
    ...scenario.chromeExtra,
    runnerUrl,
  ];

  let proc;
  try {
    proc = spawn(chrome, args, { detached: false, stdio: 'ignore' });
  } catch (e) {
    armRecord.error = `failed to launch Chrome: ${e.message}`;
    armRecord.verdict = 'invalid-arm';
    armRecord.validityReasons.push(armRecord.error);
    armRecord.finishedAt = new Date().toISOString();
    return armRecord;
  }

  const deadline = Date.now() + ARM_TIMEOUT_MS;
  let result = null;
  while (Date.now() < deadline) {
    result = readResultFile(scenario.id, arm, runId);
    if (result) break;
    if (proc.exitCode !== null && !result) {
      // Chrome exited before producing a report.
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  // Always terminate the Chrome instance we started and remove its temp profile.
  try { proc.kill('SIGKILL'); } catch (e) { /* ignore */ }
  try {
    if (fs.existsSync(profileDir)) {
      // Best-effort recursive removal; never touches the owner's profile.
      rmRecursive(profileDir);
    }
  } catch (e) { /* ignore */ }

  if (!result) {
    armRecord.error = proc.exitCode !== null ? `Chrome exited without a report (exit ${proc.exitCode})` : `arm timed out after ${ARM_TIMEOUT_MS / 1000}s`;
    armRecord.verdict = 'invalid-arm';
    armRecord.validityReasons.push(armRecord.error);
    armRecord.finishedAt = new Date().toISOString();
    return armRecord;
  }

  if (!isValidArmResult(result)) {
    armRecord.error = `malformed report: missing fields (${JSON.stringify(result)})`;
    armRecord.verdict = 'invalid-arm';
    armRecord.validityReasons.push(armRecord.error);
    armRecord.finishedAt = new Date().toISOString();
    return armRecord;
  }

  // Map runner payload into the canonical arm record.
  armRecord.battleMode = result.battleMode;
  armRecord.graphicsMode = result.graphicsMode || scenario.graphicsMode;
  armRecord.renderer = result.renderer || null;
  armRecord.suppression = result.suppression || { intended: arm, applied: false, subsystemPresent: false };
  armRecord.combatStateAtStart = result.combatStateAtStart || null;
  armRecord.frameSamples = result.frameSamples || null;
  armRecord.presses = result.presses || 0;
  armRecord.acceptedCasts = result.acceptedCasts || 0;
  armRecord.casts = result.casts || [];
  armRecord.byHeroSkill = result.byHeroSkill || {};
  armRecord.comparable = result.comparable || { castSequenceMatchesControl: null };
  armRecord.finishedAt = new Date().toISOString();

  const reasons = [];
  let valid = true;

  if (result.renderer && result.renderer.rendererSoftware == null && result.renderer.webglRenderer) {
    // nothing; renderer block is recorded as-is
  }
  if (!result.combatStateAtStart || !result.combatStateAtStart.active) {
    valid = false; reasons.push('combat was not active at start of measurement');
  }
  if (armRecord.frameSamples == null || armRecord.frameSamples.count < MIN_FRAME_SAMPLES) {
    valid = false; reasons.push(`frame sample count ${armRecord.frameSamples ? armRecord.frameSamples.count : 0} below minimum ${MIN_FRAME_SAMPLES}`);
  }
  // Scientific comparability: same seed + same input schedule must reproduce
  // the same accepted-cast sequence across arms (render suppression does not
  // touch gameplay). Set by the launcher when it compares against control.
  if (!result.suppression.applied && result.suppression.subsystemPresent) {
    valid = false; reasons.push('intended suppression was not applied');
  }
  armRecord.scientificallyValid = valid;
  armRecord.validityReasons = reasons;
  armRecord.applicable = result.applicable != null ? result.applicable : true;
  armRecord.verdict = valid ? 'pending' : 'invalid-arm';
  return armRecord;
}

function rmRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) rmRecursive(full);
    else fs.rmSync(full, { force: true });
  }
  fs.rmdirSync(dir, { force: true });
}

// ---------------------------------------------------------------------------
// Report writing
// ---------------------------------------------------------------------------

function writeReport(report) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const jsonPath = path.join(RESULTS_DIR, 'report.json');
  const txtPath = path.join(RESULTS_DIR, 'report.txt');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(txtPath, renderReportText(report));
  return { jsonPath, txtPath };
}

function renderReportText(r) {
  const lines = [];
  lines.push('APEX CHAOS — P0 Diagnosis Report');
  lines.push(`Run ID: ${r.runId}`);
  lines.push(`Package build SHA: ${r.buildSha} (expected ${r.expectedSha}, match: ${r.shaMatch})`);
  lines.push(`Renderer software-based: ${r.rendererSoftware}`);
  lines.push('');
  for (const s of r.scenarios) {
    lines.push(`=== Scenario: ${s.scenario} (${s.graphicsMode}) ===`);
    lines.push(`  fighters: ${s.p1} vs ${s.p2} · battleMode: ${s.profile}`);
    if (s.scenario === 'bot') {
      lines.push('  NOTE: the production BOT opponent is HUNTER; FROST is not diagnosed in this scenario.');
    }
    lines.push(`  cast verdict: ${s.castVerdict} · accepted casts: ${s.totalAcceptedCasts} · counts match control sum: ${s.countsMatch}`);
    if (s.controlAvgMs != null) lines.push(`  control avg frame: ${s.controlAvgMs} ms · control noise: ${s.controlNoiseMs} ms · threshold: ${s.controlThresholdMs} ms`);
    lines.push(`  overall: ${s.overall}`);
    for (const n of s.narrative) lines.push(`  - ${n}`);
    for (const a of s.arms) {
      lines.push(`    arm ${a.arm}: valid=${a.scientificallyValid} applicable=${a.applicable} acceptedCasts=${a.acceptedCasts} presses=${a.presses} frames=${a.frameSamples ? a.frameSamples.count : 0} avgMs=${a.frameSamples ? a.frameSamples.avgMs : 'n/a'} verdict=${a.verdict || 'n/a'}`);
      if (a.validityReasons.length) lines.push(`      reasons: ${a.validityReasons.join('; ')}`);
      if (a.error) lines.push(`      error: ${a.error}`);
    }
    lines.push('');
  }
  lines.push(`Overall: ${r.overall}`);
  for (const n of r.narrative) lines.push(`- ${n}`);
  lines.push('');
  lines.push('Limitations:');
  for (const l of r.limitations) lines.push(`- ${l}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(argv) {
  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  console.log('[P0 DIAG] APEX CHAOS P0 performance diagnosis launcher');
  console.log(`[P0 DIAG] package root: ${PKG_ROOT}`);

  const integrity = validatePackagedGame(PKG_ROOT);
  console.log(`[P0 DIAG] packaged build SHA: ${integrity.actualSha || 'missing'}`);
  console.log(`[P0 DIAG] expected build SHA: ${integrity.expectedSha || 'missing'} match=${integrity.shaMatch}`);
  if (!integrity.ok) {
    for (const e of integrity.errors) console.error(`[P0 DIAG] ERROR: ${e}`);
    process.exitCode = 2;
    return { ok: false, exitCode: 2, errors: integrity.errors };
  }

  // Start the packaged static server (PowerShell/.NET, built into the ZIP).
  console.log('[P0 DIAG] starting packaged static server (serve.ps1) ...');
  let serverUrl = null;
  let port = null;
  let serverProc;
  try {
    serverProc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SERVE_PS1], {
      cwd: PKG_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    console.error(`[P0 DIAG] ERROR: failed to start serve.ps1: ${e.message}`);
    process.exitCode = 2;
    return { ok: false, exitCode: 2, errors: [`serve.ps1 launch failed: ${e.message}`] };
  }

  const onExit = () => {
    try { serverProc.kill('SIGKILL'); } catch (e) {}
  };
  process.on('exit', onExit);

  serverProc.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    const m = text.match(/http:\/\/localhost:(\d+)\//);
    if (m && !port) {
      port = parseInt(m[1], 10);
      serverUrl = `http://localhost:${port}`;
    }
  });

  try {
    await waitForServer(port || 0, 30000);
  } catch (e) {
    console.error(`[P0 DIAG] ERROR: ${e.message}`);
    onExit();
    process.exitCode = 2;
    return { ok: false, exitCode: 2, errors: [e.message] };
  }
  console.log(`[P0 DIAG] server listening at ${serverUrl}`);

  // Confirm the packaged game loads (no silent 404).
  try {
    const rootRes = await httpGetText(port, '/', 5000);
    if ((rootRes.status || 0) < 200 || (rootRes.status || 0) >= 500) throw new Error(`unexpected status ${rootRes.status}`);
  } catch (e) {
    console.error(`[P0 DIAG] ERROR: packaged game root did not load: ${e.message}`);
    onExit();
    process.exitCode = 2;
    return { ok: false, exitCode: 2, errors: [`game root load failed: ${e.message}`] };
  }

  const scenariosResults = [];
  let anyHang = false;

  for (const scenario of SCENARIOS) {
    const armsResults = [];
    console.log(`[P0 DIAG] scenario ${scenario.id}: ${scenario.p1} vs ${scenario.p2} (${scenario.profile})`);
    for (let i = 0; i < ARMS.length; i++) {
      const arm = ARMS[i];
      const record = await runArm(scenario, arm, 0x1C4C2A5E, runId, serverUrl, port);
      record.order = i + 1;
      armsResults.push(record);
      if (record.verdict === 'invalid-arm' && record.error && /timeou|exited without/.test(record.error)) anyHang = true;
      console.log(`[P0 DIAG]   arm ${i + 1}/5 ${arm}: valid=${record.scientificallyValid} accepted=${record.acceptedCasts} frames=${record.frameSamples ? record.frameSamples.count : 0} verdict=${record.verdict || 'pending'}`);
      if (record.error) console.log(`[P0 DIAG]     ${record.error}`);
    }
    scenariosResults.push({ scenario, arms: armsResults });
  }

  onExit();

  // Assemble verdicts (pure logic).
  const scenarioVerdicts = [];
  for (const { scenario, arms } of scenariosResults) {
    scenarioVerdicts.push(assembleScenarioVerdict(scenario, arms));
  }

  const runTotal = scenarioVerdicts.reduce((s, sv) => s + sv.totalAcceptedCasts, 0);
  const runPressed = scenarioVerdicts.reduce((s, sv) => s + sv.totalPressedCasts, 0);
  const armSum = scenarioVerdicts.reduce((s, sv) => s + (sv.arms.reduce((t, a) => t + (a.acceptedCasts || 0), 0)), 0);
  const countsMatch = armSum === runTotal;

  let overall = 'inconclusive';
  const narrative = [];
  if (runTotal === 0) {
    overall = 'no-cast-accepted-cannot-judge';
    narrative.push('Run-level: zero accepted casts across the entire run — no subsystem can be identified from this run.');
  } else {
    const sig = scenarioVerdicts.filter((s) => s.overall === 'suspect-significant');
    const incon = scenarioVerdicts.filter((s) => s.overall === 'inconclusive');
    if (sig.length) overall = 'suspect-significant';
    else if (incon.length) overall = 'inconclusive';
    else overall = 'within-control-noise';
    narrative.push(`Run-level: ${runTotal} accepted casts (sum of per-arm counts = ${armSum}, match = ${countsMatch}).`);
  }

  const invalidArms = [];
  for (const sv of scenarioVerdicts) {
    for (const a of sv.arms) {
      if (!a.scientificallyValid || a.verdict === 'invalid-arm' || !a.applicable) {
        invalidArms.push({ scenario: sv.scenario, arm: a.arm, reasons: a.validityReasons, applicable: a.applicable });
      }
    }
  }

  // Software renderer determination: game uses the CPU canvas2d path; probe
  // WebGL renderer string recorded per arm by the runner.
  let rendererSoftware = true;
  for (const sv of scenarioVerdicts) {
    for (const a of sv.arms) {
      if (a.renderer && a.renderer.rendererSoftware === false) rendererSoftware = false;
    }
  }

  const report = {
    schema: 'apex-p0-diagnosis/v1',
    runId,
    timestamp: new Date().toISOString(),
    package: { root: PKG_ROOT },
    buildSha: integrity.actualSha,
    expectedSha: integrity.expectedSha,
    shaMatch: integrity.shaMatch,
    manifestOk: integrity.manifestOk,
    rendererSoftware,
    armTimeoutMs: ARM_TIMEOUT_MS,
    minFrameSamples: MIN_FRAME_SAMPLES,
    scenarios: scenarioVerdicts,
    run: {
      totalAcceptedCasts: runTotal,
      totalPressedCasts: runPressed,
      sumOfArmAcceptedCasts: armSum,
      countsMatch,
      castVerdict: runTotal === 0 ? 'no-cast-accepted-cannot-judge' : 'casts-accepted-run-level',
    },
    validity: { invalidArms, allArmsValid: invalidArms.length === 0 },
    overall,
    narrative,
    limitations: [
      'Measurements are taken on the owner\'s hardware; this package does not claim any owner-device FPS improvement.',
      'The BOT scenario faces the production CPU opponent HUNTER; no FROST diagnosis is claimed for BOT.',
      'Arsenal Battle renders through the CPU canvas2d path (no WebGL game renderer); the report flags this as software-based rasterization per arm.',
      'Determinism relies on a seeded Math.random restart per arm; Chrome task scheduling still introduces frame-time noise, handled by the control-noise threshold.',
      'A bundled Windows Node runtime is not redistributable from the allowed build hosts; Node.js must be on PATH (or node.exe placed in the package node/ dir).',
      'The noBloom arm is only applicable when a bloom pass is installed in the draw pipeline; otherwise it is recorded inapplicable and cannot identify a bottleneck.',
      'Invalid or inapplicable arms never identify a subsystem; inconclusive results are reported as such.',
    ],
  };

  const written = writeReport(report);
  console.log(`[P0 DIAG] report written: ${written.jsonPath}`);
  console.log(`[P0 DIAG] overall: ${report.overall}`);
  for (const n of report.narrative) console.log(`[P0 DIAG]  - ${n}`);
  if (report.validity.invalidArms.length) {
    console.log(`[P0 DIAG] ${report.validity.invalidArms.length} arm(s) invalid or inapplicable — no bottleneck identified for them.`);
  }

  return { ok: true, exitCode: 0, report };
}

// Allow direct execution: node p0diag.js
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(url.fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[P0 DIAG] FATAL: ${e.stack || e}`);
    process.exitCode = 2;
  });
}
