// APEX CHAOS — SLIME large-hit hitch diagnostic (real Chromium via CDP).
//
// Authority: docs/hero-rework/phase1/10 — "Large-hit hitch diagnostic".
// Law: REAL Chromium 153 + REAL production damage path (weaponApi.aqDamage).
// Controlled heavy hit on REWORK SLIME vs the same hit on a non-SLIME (ICE).
// Separates: (1) intentional heavy-hit hit-stop (spec'd 0.03-0.08s at 10%
// sim speed), (2) actual browser frame/long-task hitch, (3) SLIME-specific
// synchronous split/child-creation cost, (4) legacy double-execution cost
// (zero on rework shells after the Q3a quarantine; legacy-type SLIME is
// measured as the comparison number the owner would otherwise pay).
//
// REPORTS MEASURED VALUES ONLY — invents NO pass threshold. Does NOT reduce
// blood/splatter/VFX (the full production feel pipeline runs on every hit).
//
//   LD_LIBRARY_PATH=/tmp/al2023/lib CHROME_PATH=/tmp/chromium \
//   APEX_APP_URL=http://127.0.0.1:5173 node tools/measureSlimeHeavyHitHitch.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const port = process.env.CDP_PORT || '9224';
const endpoint = `http://127.0.0.1:${port}`;
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH;
const evidenceDir = 'docs/hero-rework/evidence';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!chromePath) throw new Error('CHROME_PATH required');

const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`,
  '--window-size=1100,1100', '--user-data-dir=/tmp/.slime-hitch-profile',
  'about:blank',
], { stdio: 'ignore', detached: false });

async function pageTarget() {
  for (let i = 0; i < 100; i++) {
    try {
      const targets = await fetch(`${endpoint}/json/list`).then((r) => r.json());
      const t = targets.find((x) => x.type === 'page');
      if (t) return t;
    } catch {}
    await sleep(250);
  }
  throw new Error('CDP page did not become ready.');
}
const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let serial = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const m = JSON.parse(event.data);
  if (!m.id || !pending.has(m.id)) return;
  const p = pending.get(m.id);
  pending.delete(m.id);
  m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
});
function command(method, params = {}) {
  const id = ++serial;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

// Frame + long-task probes installed before any app script runs.
await command('Page.enable');
await command('Runtime.enable');
await command('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__slimeHitch = {
    frames: [],          // {t, dt, clock} per rAF tick (t in ms since start)
    longTasks: [],       // {start, dur} from PerformanceObserver('longtask')
    sampling: false,
  };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__slimeHitch.longTasks.push({ start: +e.startTime.toFixed(1), dur: +e.duration.toFixed(1) });
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}
  (function loop() {
    requestAnimationFrame(loop);
    if (!window.__slimeHitch.sampling) return;
    const now = performance.now();
    const w = window.__slimeHitch;
    const prev = w.frames[w.frames.length - 1];
    w.frames.push({
      t: +now.toFixed(2),
      dt: prev ? +(now - prev.t).toFixed(2) : 0,
      clock: +(window.matchClock || 0).toFixed(4),
    });
    if (w.frames.length > 4000) w.frames.splice(0, w.frames.length - 4000);
  })();
` });

await command('Page.navigate', { url: appUrl });
let appReady = false;
for (let i = 0; i < 200; i++) {
  appReady = await evaluate(`(() => !!(window.APEX_ARSENAL && window.APEX_HERO_REWORK && window.startArsenalQuestMode))()`).catch(() => false);
  if (appReady) break;
  await sleep(150);
}
if (!appReady) throw new Error('App runtimes did not become ready.');

// Install the scenario runner in-page.
await evaluate(`(() => {
  window.__runHitchScenario = async (mode) => {
    // mode: 'slime-split' (heavy hit that crosses the 80% passive knife
    // edge), 'slime-nosplit' (same target, sub-threshold hit), 'ice'
    // (identical heavy hit on a non-SLIME), 'legacy-split' (legacy-type
    // SLIME heavy hit — the pre-quarantine double-execution cost).
    const H = window.__slimeHitch;
    H.sampling = false;
    H.frames = [];
    H.longTasks = [];
    if (mode === 'legacy-split') {
      const FTs = window.FighterTypes || [];
      const t1 = FTs.find(t => t && t.name === 'SLIME' && !t.arsenalShell && !t.__hrHero);
      const t2 = FTs.find(t => t && t.name === 'ICE' && !t.arsenalShell && !t.__hrHero);
      window.startSpecificMatch(t1, t2, { countdown: false });
    } else {
      if (window.APEX_HERO_REWORK) window.APEX_HERO_REWORK.setAiEnabled(false);
      window.startArsenalQuestMode('SLIME', 'ICE');
      const s = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
      if (s) { s.spawnTimer = 1e6; s.slots = []; s.unarmedFastConsumed = true; s.spawnHeld = true; }
    }
    const a = fighters[0], b = fighters[1];
    a.x = 350; a.y = 500; b.x = 700; b.y = 500;
    await new Promise(r => setTimeout(r, 350)); // settle into live frames
    H.sampling = true;
    await new Promise(r => setTimeout(r, 400)); // pre-impact baseline cadence
    const W = window.APEX_ARSENAL.weaponApi;
    // Controlled heavy hit through the REAL production damage entry.
    // STORMBREAKER is final-authority (confirmedHitDamage) so the submitted
    // amount is the exact damage before shared roster tuning; the tuning
    // factor is measured on a tiny probe first so the realized hit lands on
    // the intended amount.
    const target = mode === 'ice' ? b : a;
    const source = mode === 'ice' ? a : b;
    const probeBefore = target.hp;
    W.aqDamage(target, 5, source, 'STORMBREAKER', {});
    const scale = (probeBefore - target.hp) / 5;
    target.hp = probeBefore;
    const wantRealized = (mode === 'slime-nosplit') ? 300 : 800;
    const submitted = wantRealized / scale;
    const countBodies = () => {
      try {
        const H = window.APEX_HERO_REWORK;
        if (H && H.byCombatant) {
          const ct = H.byCombatant(a);
          if (ct && ct.bodies) return ct.bodies.filter(x => x && x.hp > 0).length;
        }
      } catch (e) {}
      return fighters.filter(f => f && f.name === 'SLIME' && f.hp > 0).length;
    };
    const bodiesBefore = countBodies();
    const hpBeforeHit = target.hp;
    const t0 = performance.now();
    H.impactT = t0;
    const dealt = W.aqDamage(target, submitted, source, 'STORMBREAKER', {
      hitStop: 0.08,   // STORMBREAKER spec — INTENTIONAL heavy-hit stop
      shake: 15,
    });
    const syncMs = performance.now() - t0;
    const hpAfter = target.hp;
    // Snapshot the split effect IMMEDIATELY (a live battle's 1.6s tail can
    // kill bodies and would mask the synchronous creation cost).
    const bodiesAfter = countBodies();
    await new Promise(r => setTimeout(r, 1600)); // post-impact window
    H.sampling = false;
    const bodiesEnd = countBodies();
    return {
      mode, submitted, dealt, scale, hpBeforeHit, hpAfter,
      syncMs, bodiesBefore, bodiesAfter, bodiesEnd,
      impactT: H.impactT,
      frames: H.frames.slice(),
      longTasks: H.longTasks.slice(),
      fightersCount: fighters.length,
    };
  };
  return true;
})()`);

function analyze(raw) {
  const frames = raw.frames || [];
  const longTasks = raw.longTasks || [];
  const impactT = raw.impactT || 0;
  const pre = frames.filter(f => f.t < impactT);
  const post = frames.filter(f => f.t >= impactT);
  const deltas = (arr) => arr.map(f => f.dt).filter(dt => dt > 0);
  const stat = (arr) => {
    const ds = deltas(arr);
    const sorted = [...ds].sort((x, y) => y - x);
    return {
      frames: ds.length,
      maxDtMs: +(sorted[0] || 0).toFixed(2),
      top5Ms: sorted.slice(0, 5).map(x => +x.toFixed(2)),
      over50ms: ds.filter(dt => dt > 50).length,
      over100ms: ds.filter(dt => dt > 100).length,
      meanDtMs: +(ds.length ? ds.reduce((s, x) => s + x, 0) / ds.length : 0).toFixed(2),
    };
  };
  // Sim-clock rate (sim ms advanced per wall ms) in a window: the intentional
  // hit-stop (dt x 0.1 for the spec'd 0.08s) shows as a ~0.1 clock rate right
  // after impact; it is a SIM slowdown, not a frame hitch.
  const clockRate = (arr) => {
    if (arr.length < 2) return null;
    const wall = arr[arr.length - 1].t - arr[0].t;
    const clock = (arr[arr.length - 1].clock - arr[0].clock) * 1000;
    return wall > 0 ? +(clock / wall).toFixed(3) : null;
  };
  const first300 = post.filter(f => f.t < impactT + 300);
  const late300 = post.filter(f => f.t >= impactT + 400 && f.t < impactT + 700);
  return {
    pre: stat(pre),
    post: stat(post),
    clockRatePre: clockRate(pre),
    clockRateFirst300msPost: clockRate(first300),
    clockRate400to700msPost: clockRate(late300),
    hitStopRequestedMs: 80, // STORMBREAKER spec value passed in opts — intentional
    longTaskCount: longTasks.length,
    longestTaskMs: longTasks.reduce((m, x) => Math.max(m, x.dur), 0),
    longTaskTotalMs: +longTasks.reduce((s, x) => s + x.dur, 0).toFixed(1),
    longTasks,
  };
}

const modes = ['slime-split', 'slime-nosplit', 'ice', 'legacy-split'];
const report = { tool: 'measureSlimeHeavyHitHitch', app: appUrl, chromium: 'headless=new (CDP)', scenarios: {} };
// Warm-up pass (discarded): the first cold page scenario starves the rAF
// sampler during JIT/asset warm-up and would leave a hollow pre-impact
// baseline.
await evaluate(`window.__runHitchScenario('slime-nosplit')`);
const REPS = 5;
for (const mode of modes) {
  const reps = [];
  for (let i = 0; i < REPS; i++) {
    reps.push(await evaluate(`window.__runHitchScenario(${JSON.stringify(mode)})`));
  }
  const syncs = reps.map(r => +r.syncMs.toFixed(3)).sort((x, y) => x - y);
  const median = syncs[Math.floor(syncs.length / 2)];
  // Frames analysis from the rep closest to the median sync (representative).
  const mid = reps.slice().sort((x, y) => Math.abs(x.syncMs - median) - Math.abs(y.syncMs - median))[0];
  report.scenarios[mode] = {
    reps: REPS,
    syncDamageCallMs: { all: syncs, median, min: syncs[0], max: syncs[syncs.length - 1] },
    submitted: mid.submitted, scale: +mid.scale.toFixed(4),
    realizedMeasured: +(mid.hpBeforeHit - mid.hpAfter).toFixed(3), hpAfter: +mid.hpAfter.toFixed(3),
    bodiesBefore: mid.bodiesBefore, bodiesImmediatelyAfter: mid.bodiesAfter, bodiesEnd: mid.bodiesEnd,
    splitSpawned: mid.bodiesAfter > mid.bodiesBefore,
    fightersCount: mid.fightersCount,
    frames: analyze(mid),
  };
  const fr = report.scenarios[mode].frames;
  console.log(`MEASURE ${mode}: sync median=${median}ms (min ${syncs[0]} max ${syncs[syncs.length - 1]}) bodies ${mid.bodiesBefore}->${mid.bodiesAfter} (end ${mid.bodiesEnd}) preMaxDt=${fr.pre.maxDtMs}ms postMaxDt=${fr.post.maxDtMs}ms clockRate pre=${fr.clockRatePre} first300=${fr.clockRateFirst300msPost} longTasks=${fr.longTaskCount}`);
}

// Derived comparisons (measured, no thresholds).
const s = report.scenarios;
report.comparisons = {
  splitSyncCostMs: +(s['slime-split'].syncDamageCallMs.median - s['slime-nosplit'].syncDamageCallMs.median).toFixed(3),
  slimeVsIceSyncMs: +(s['slime-split'].syncDamageCallMs.median - s['ice'].syncDamageCallMs.median).toFixed(3),
  legacyDoubleExecSyncCostMs: +(s['legacy-split'].syncDamageCallMs.median - s['slime-split'].syncDamageCallMs.median).toFixed(3),
  note: 'measured values only — no pass threshold invented. Intentional hit-stop is the requested 0.08s (STORMBREAKER spec 0.03-0.08s) simulated at 10% speed; its measured signature is clockRateFirst300msPost (~10x below the pre-impact headless cadence) — SIM slowdown, not a frame hitch. Frame hitches are the measured pre/post maxDt and long tasks. legacy-split numbers show the PRE-FIX double-execution signature (per-hit guard absorb makes submitted damage unpredictable); its sync cost is the measured legacy spawn/clone work inside takeDamage.',
};
console.log('COMPARISONS:', JSON.stringify(report.comparisons));

mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, 'slime-heavy-hit-hitch-report.json'), JSON.stringify(report, null, 2));
console.log('report written:', join(evidenceDir, 'slime-heavy-hit-hitch-report.json'));
try { chrome.kill(); } catch {}
process.exit(0);
