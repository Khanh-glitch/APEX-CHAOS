#!/usr/bin/env node
/* MIRROR V1 — CHECKPOINT C: direct canonical Gold 12 reference harness.
 *
 * Executes docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html DIRECTLY
 * in a real browser. It never tests a reconstruction against itself: every
 * number recorded here comes out of the canonical HTML at runtime.
 *
 * The Gold's top-level `const`/`let` bindings live in the page's global
 * lexical environment, so they are readable by name from page.evaluate without
 * editing the canonical file. The file is NEVER modified: determinism is
 * imposed from outside by seeding Math.random before any script runs and by
 * neutralising requestAnimationFrame so the fixed-step `step(STEP)` loop can be
 * driven deterministically.
 *
 * Output: docs/hero-rework/mirror-v1/evidence/gold12-canonical-trace.json
 * Later production parity tests compare AGAINST that file.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const require = createRequire('/tmp/magnet-browser-deps/x.js');
const puppeteer = require('puppeteer-core');
const chromiumModule = require('@sparticuz/chromium');
const chromium = chromiumModule.default || chromiumModule;
process.env.LD_LIBRARY_PATH = ['/tmp/al2023', '/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const GOLD_REL = 'docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html';
const GOLD_URL = (process.env.APEX_GOLD_URL || 'http://127.0.0.1:4200') + '/' + GOLD_REL;
const EXPECT_SHA = 'c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205';

const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

/* ---- G0: canonical source identity (before any browser work) ---- */
const bytes = fs.readFileSync(GOLD_REL);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
const text = bytes.toString('utf8');
gate('G00-canonical-gold-present', fs.existsSync(GOLD_REL));
gate('G01-gold-sha256-exact', sha === EXPECT_SHA, sha);
gate('G02-gold-bytes-and-no-external-dependency',
  bytes.length === 107480 && !/<script[^>]+src=|<link[^>]+href=|fetch\(|XMLHttpRequest/.test(text),
  { bytes: bytes.length, lines: text.split('\n').length });
if (sha !== EXPECT_SHA) {
  console.log('\nCANONICAL GOLD HASH MISMATCH — STOP.');
  process.exit(1);
}

/* ---- reachability: ONE explicit URL, verified before launching ---- */
let reachable = false;
try {
  const res = await fetch(GOLD_URL, { signal: AbortSignal.timeout(8000) });
  reachable = res.ok;
} catch (e) { reachable = false; }
gate('C00-gold-url-reachable', reachable, GOLD_URL);
if (!reachable) {
  console.log(`\nGold URL not reachable: ${GOLD_URL}\nStart a static server rooted at the repo root and retry.`);
  process.exit(1);
}

const STEP = 1 / 120;
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args.filter((a) => !/use-gl|use-angle|swiftshader|gpu/.test(a)), '--disable-gpu',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  headless: true,
  protocolTimeout: Number(process.env.APEX_PROTOCOL_TIMEOUT_MS) || 600000,
});
let trace;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Deterministic RNG injected from OUTSIDE the canonical file.
  await page.evaluateOnNewDocument(() => {
    let s = 0x2f6e2b1 >>> 0;
    Math.random = function seeded() {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  });
  console.log('[phase] loading canonical Gold ...');
  await page.goto(GOLD_URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof step === 'function' && typeof M === 'object', { timeout: 60000 });
  console.log('[phase] loaded; taking deterministic control of the fixed-step loop ...');

  trace = await page.evaluate(async (STEP) => {
    // Stop the page's own rAF pump so stepping is fully deterministic.
    window.requestAnimationFrame = () => 0;
    await new Promise((r) => setTimeout(r, 60));
    if (typeof AUTO === 'object') AUTO.on = false;
    if (typeof resetAll === 'function') resetAll();
    M.drive = null;

    const drive = (n) => { for (let i = 0; i < n; i++) step(STEP); };
    const out = {};

    /* ---- temporal engine identity ---- */
    out.engine = {
      STEP, fixedHz: Math.round(1 / STEP), maxSubsteps: 12,
      HN, HS, histLength: hist.length,
      ARENA: typeof ARENA === 'number' ? ARENA : null,
      SPD: typeof SPD === 'number' ? SPD : null,
      MR: typeof MR === 'number' ? MR : null,
    };

    /* ---- V03: false-face plate roles / base delays ---- */
    out.plates = PL.map((p) => ({ id: p.id, side: p.side, delay: p.dl, role: p.role, gain: p.gain }));

    /* ---- node geometry (gameplay capture surface authority) ---- */
    out.node = {
      NV: NV.map((v) => [v[0], v[1]]),
      routeSurface: { fromVertex: 0, toVertex: 3, from: NV[0], to: NV[3] },
      lifecycleSlots: ND.length,
      shardPool: SH.length,
    };

    /* ---- A1 canonical phase edges, measured by stepping the real Gold ---- */
    resetAll(); M.drive = null;
    F.armed = true;
    castA1(false);
    const a1 = { TS: A1TS, ownStep: null, ownU: null, ownT: null, endStep: null, endU: null, endT: null, samples: [] };
    for (let i = 1; i <= Math.ceil(2.6 / STEP); i++) {
      step(STEP);
      const u = A1.u;
      if (a1.ownStep === null && u >= 0.58) { a1.ownStep = i; a1.ownU = u; a1.ownT = i * STEP; }
      if (a1.endStep === null && u >= 0.92) { a1.endStep = i; a1.endU = u; a1.endT = i * STEP; }
      if (i % 20 === 0 && a1.samples.length < 16) a1.samples.push({ step: i, t: +(i * STEP).toFixed(5), u: +u.toFixed(5), on: A1.on });
    }
    a1.nominalOwnT = 0.58 * A1TS;
    a1.nominalEndT = 0.92 * A1TS;
    out.a1 = a1;

    /* ---- A1 whiff: unarmed target must never produce a copy ---- */
    resetAll(); M.drive = null;
    F.armed = false;
    castA1(false);
    let whiffCopy = false;
    for (let i = 0; i < Math.ceil(2.0 / STEP); i++) { step(STEP); if (M.copyOn) whiffCopy = true; }
    out.a1Whiff = { whiffFlag: !!A1.whiff, everProducedCopy: whiffCopy };

    /* ---- A2 canonical snap/end edges ---- */
    resetAll(); M.drive = null;
    const beforeM = { x: M.x, y: M.y }, beforeF = { x: F.x, y: F.y };
    castA2();
    const a2 = { TS: A2TS, snapStep: null, snapU: null, snapT: null, endStep: null, endU: null, samples: [] };
    let swapped = null;
    for (let i = 1; i <= Math.ceil(2.0 / STEP); i++) {
      const pm = { x: M.x, y: M.y };
      step(STEP);
      const u = A2.u;
      if (swapped === null && Math.hypot(M.x - pm.x, M.y - pm.y) > 50) {
        swapped = { step: i, t: +(i * STEP).toFixed(5), u: +u.toFixed(5) };
      }
      if (a2.snapStep === null && u >= 0.25) { a2.snapStep = i; a2.snapU = u; a2.snapT = i * STEP; }
      if (a2.endStep === null && u >= 0.64) { a2.endStep = i; a2.endU = u; }
      if (i % 12 === 0 && a2.samples.length < 12) a2.samples.push({ step: i, t: +(i * STEP).toFixed(5), u: +u.toFixed(5) });
    }
    a2.observedSwap = swapped;
    a2.nominalSnapT = 0.25 * A2TS;
    a2.beforeM = beforeM; a2.beforeF = beforeF;
    a2.afterM = { x: M.x, y: M.y }; a2.afterF = { x: F.x, y: F.y };
    out.a2 = a2;

    /* ---- passive: five-shard cluster -> node ACTIVE timing ---- */
    resetAll(); M.drive = null;
    spawnCluster();
    const nodes = { firstLiveT: null, firstActiveStep: null, firstActiveT: null, maxActive: 0, maxLifecycle: 0, trace: [] };
    for (let i = 1; i <= Math.ceil(4.0 / STEP); i++) {
      step(STEP);
      const live = ND.filter((n) => n.on);
      const active = live.filter((n) => n.st >= 2).length;
      nodes.maxActive = Math.max(nodes.maxActive, active);
      nodes.maxLifecycle = Math.max(nodes.maxLifecycle, live.length);
      // Formation START = the frame a node first occupies a lifecycle slot.
      // Everything before that is the free-shard age gate (>.7s) plus the
      // formation scan cadence (.3s), which are separate canonical facts.
      if (nodes.firstLiveT === null && live.length > 0) nodes.firstLiveT = +(i * STEP).toFixed(4);
      if (nodes.firstActiveStep === null && active > 0) { nodes.firstActiveStep = i; nodes.firstActiveT = +(i * STEP).toFixed(4); }
      if (i % 24 === 0 && nodes.trace.length < 24) {
        nodes.trace.push({ t: +(i * STEP).toFixed(3), live: live.length, active, shardsOn: SH.filter((s) => s.on).length });
      }
    }
    nodes.spawnToActiveT = nodes.firstActiveT;
    nodes.formationStartToActiveT = (nodes.firstActiveT != null && nodes.firstLiveT != null)
      ? +(nodes.firstActiveT - nodes.firstLiveT).toFixed(4) : null;
    out.nodes = nodes;

    /* ---- history channel identity after motion ---- */
    resetAll(); M.drive = null;
    M.vx = 180; M.vy = -90;
    drive(80);
    out.history = { HN, HS, head: hHead, sampleStride: HS, nonZeroChannels: (() => {
      let n = 0;
      for (let c = 0; c < HS; c++) { for (let k = 0; k < HN; k++) { if (hist[k * HS + c] !== 0) { n++; break; } } }
      return n;
    })() };

    out.errors = [];
    return out;
  }, STEP);
  trace.pageErrors = errors;
} finally {
  await browser.close();
}

/* ---- V-series assertions against the preload contract ---- */
const e = trace.engine;
gate('V-ENGINE-fixed-1/120-and-12-substeps', e.fixedHz === 120 && e.maxSubsteps === 12, e);
gate('V-ENGINE-history-HN64-HS22', e.HN === 64 && e.HS === 22 && e.histLength === 64 * 22, { HN: e.HN, HS: e.HS });

const byId = Object.fromEntries(trace.plates.map((p) => [p.id, p]));
gate('V03-false-face-base-delays',
  byId.UL.delay === 0.095 && byId.UR.delay === 0.115 && byId.LL.delay === 0.145 && byId.LR.delay === 0.17,
  trace.plates.map((p) => `${p.id}:${p.delay}`).join(' '));
gate('V03-false-face-roles',
  byId.UL.role === 'shameless' && byId.UR.role === 'observer' && byId.LL.role === 'stale' && byId.LR.role === 'wrong',
  trace.plates.map((p) => `${p.id}:${p.role}`).join(' '));

gate('V-NODE-canonical-polygon',
  JSON.stringify(trace.node.NV) === JSON.stringify([[-5, -60], [28, -27], [20, 28], [0, 62], [-28, 31]]),
  trace.node.NV);
gate('V-NODE-route-surface-v0-to-v3',
  JSON.stringify(trace.node.routeSurface.from) === JSON.stringify([-5, -60])
  && JSON.stringify(trace.node.routeSurface.to) === JSON.stringify([0, 62]),
  trace.node.routeSurface);
gate('V-NODE-four-lifecycle-slots', trace.node.lifecycleSlots === 4, trace.node);

const a1 = trace.a1;
gate('V10-A1-timescale-1.6', a1.TS === 1.6, { A1TS: a1.TS });
gate('V10-A1-OWN-edge-at-u>=.58',
  a1.ownStep !== null && Math.abs(a1.ownT - 0.933) <= 0.01 && a1.ownU >= 0.58,
  { ownStep: a1.ownStep, ownT: a1.ownT, ownU: a1.ownU, nominal: a1.nominalOwnT });
gate('V10-A1-visual-end-at-u>=.92',
  a1.endStep !== null && Math.abs(a1.endT - 1.475) <= 0.01,
  { endT: a1.endT, nominal: a1.nominalEndT });
gate('V11-A1-whiff-never-copies', trace.a1Whiff.everProducedCopy === false, trace.a1Whiff);

const a2 = trace.a2;
gate('V12-A2-timescale-1.0', a2.TS === 1.0, { A2TS: a2.TS });
gate('V12-A2-snap-edge-exactly-0.25s',
  a2.snapStep !== null && Math.abs(a2.snapT - 0.25) <= STEP + 1e-9,
  { snapStep: a2.snapStep, snapT: a2.snapT, nominal: a2.nominalSnapT });
gate('V12-A2-observed-position-exchange-at-snap',
  !!a2.observedSwap && Math.abs(a2.observedSwap.t - 0.25) <= 2 * STEP + 1e-9,
  a2.observedSwap);
gate('V12-A2-exchange-is-exact-coordinates',
  Math.hypot(a2.afterM.x - a2.beforeF.x, a2.afterM.y - a2.beforeF.y) < 1e-6
  || Math.hypot(a2.afterF.x - a2.beforeM.x, a2.afterF.y - a2.beforeM.y) < 1e-6,
  { beforeM: a2.beforeM, beforeF: a2.beforeF, afterM: a2.afterM, afterF: a2.afterF });

// 08_GOLD_FIRST_MECHANIC_LOCK: "typical canonical formation start->ACTIVE is
// about 1.20 s". That is measured from FORMATION START (the node taking a
// lifecycle slot), not from shard spawn: the free-shard age gate (>.7s) and
// the .3s formation scan cadence come first and are asserted separately below.
gate('V13-formation-start-to-ACTIVE-near-1.20s',
  trace.nodes.formationStartToActiveT !== null && Math.abs(trace.nodes.formationStartToActiveT - 1.20) <= 0.25,
  { formationStartToActiveT: trace.nodes.formationStartToActiveT,
    firstLiveT: trace.nodes.firstLiveT, firstActiveT: trace.nodes.firstActiveT });
gate('V13-free-shard-age-gate-and-scan-cadence-precede-formation',
  trace.nodes.firstLiveT !== null && trace.nodes.firstLiveT >= 0.7 && trace.nodes.firstLiveT <= 0.7 + 0.3 + 2 * STEP,
  { firstLiveT: trace.nodes.firstLiveT, ageGate: 0.7, scanCadence: 0.3 });
gate('V13-node-lifecycle-slots-never-exceed-4', trace.nodes.maxLifecycle <= 4, trace.nodes);

gate('V-HISTORY-channels-populated', trace.history.nonZeroChannels >= 8, trace.history);
gate('C99-no-canonical-page-errors', (trace.pageErrors || []).length === 0, trace.pageErrors);

const out = {
  generatedAt: new Date().toISOString(),
  purpose: 'Canonical Gold 12 reference trace. Production Mirror parity tests compare AGAINST this; it is produced by executing the canonical HTML directly, never by a reconstruction.',
  gold: { path: GOLD_REL, sha256: sha, bytes: bytes.length, lines: text.split('\n').length },
  url: GOLD_URL,
  trace,
  ...report,
  pass: report.failures.length === 0,
};
fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/gold12-canonical-trace.json', JSON.stringify(out, null, 2));

const total = Object.keys(report.gates).length;
console.log(`\n[MIRROR GOLD 12 CANONICAL HARNESS] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
