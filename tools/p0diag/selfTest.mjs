// selfTest.mjs — prove the diagnosis tool works, before the owner ever runs it.
//
// It drives the SAME server + SAME instrument through puppeteer so the console
// is visible: boot failures, a missing API, a selector change and a hanging arm
// all show up here instead of on the owner's machine.
//
// Usage: node tools/p0diag/selfTest.mjs [--keep]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { startServer } from './p0serve.mjs';
import { inflate } from '@sparticuz/chromium';
import { join } from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(HERE, '..', 'probe', 'node_modules', '/'));
const puppeteer = require('puppeteer-core');

const ROOT = path.join(HERE, 'game');

// Resolve the @sparticuz/chromium binary bundled in the package. The
// chromium.br blob is brotli-compressed; inflate it once to a real executable.
let CHROMIUM_EXE = '/tmp/chromium';
try {
  const bin = join(path.dirname(require.resolve('@sparticuz/chromium')), 'bin');
  const inflated = await inflate(join(bin, 'chromium.br'));
  const st = fs.statSync(inflated);
  CHROMIUM_EXE = st.isDirectory() ? join(inflated, 'chromium') : inflated;
} catch (e) {
  /* fall back to the already-inflated /tmp/chromium if present */
}
// The AL2023 build needs its bundled shared libraries.
process.env.LD_LIBRARY_PATH = '/tmp/al2023/lib:' + (process.env.LD_LIBRARY_PATH || '');

const RESULTS = path.join(HERE, 'results', 'selftest');
const INSTRUMENT = fs.readFileSync(path.join(HERE, 'p0diag.js'), 'utf8');
const KEEP = process.argv.includes('--keep');

const srv = await startServer({ root: ROOT, resultsDir: RESULTS, instrument: INSTRUMENT });
const browser = await puppeteer.launch({
  executablePath: CHROMIUM_EXE,
  headless: 'new',
  protocolTimeout: 900000,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--no-zygote',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-gpu',
  ],
});
const page = await browser.newPage();
const lines = [];
page.on('console', (m) => { const t = m.text(); lines.push(t); if (t.includes('[p0diag]')) console.log('  ' + t); });
page.on('pageerror', (e) => { lines.push('PAGEERROR ' + e.message); console.log('  PAGEERROR ' + e.message); });
// DPR 1 in the self-test on purpose: the job here is to prove the INSTRUMENT
// boots, casts, arms every switch and posts a report -- not to measure the
// owner's phone. At DPR 3.5 a software rasteriser needs ~1.3 s per frame, which
// starves every arm of frames and says nothing about the arm logic.
await page.setViewport({ width: 432, height: 768, deviceScaleFactor: 1 });

console.log('[selftest] opening', srv.launch);
// The sandbox renders roughly ONE frame per second, so a 24-frame floor would
// never be met here and the proof/verdict path would stay unexercised. Lowering
// the floor is a SELF-TEST option only (the report records the override and a
// real run never sets it), and it changes how many frames are demanded -- never
// what the frames say.
const q = [];
if (process.env.P0_MIN_FRAMES) q.push('p0minframes=' + encodeURIComponent(process.env.P0_MIN_FRAMES));
q.push('p0scenario=' + encodeURIComponent(process.env.P0_SCENARIO || 'local-high'));
const launchUrl = srv.launch + (q.length ? '&' + q.join('&') : '');
await page.goto(launchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

// Watch progress rather than waiting blind: print what the instrument says.
const deadline = Date.now() + Number(process.env.P0_TIMEOUT_MS || 480000);
let report = null;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 3000));
  const state = await page.evaluate(() => ({
    has: !!window.__P0DIAG__,
    report: window.__P0DIAG_RESULT__ ? true : false,
    arms: window.__P0DIAG_RESULT__ ? window.__P0DIAG_RESULT__.arms.length : null,
  })).catch(() => ({}));
  if (state.report) { report = await page.evaluate(() => window.__P0DIAG_RESULT__); break; }
  if (srv.saved.length) { report = JSON.parse(fs.readFileSync(srv.saved[srv.saved.length - 1], 'utf8')); break; }
}
if (!report) {
  console.log('\n[selftest] FAIL: no report produced');
  console.log('[selftest] last console lines:');
  lines.slice(-25).forEach((l) => console.log('   ' + l));
  const shot = path.join(RESULTS, 'selftest-timeout.png');
  fs.mkdirSync(RESULTS, { recursive: true });
  await page.screenshot({ path: shot }).catch(() => {});
  console.log('[selftest] screenshot: ' + shot);
  await browser.close(); await srv.server.close();
  process.exit(1);
}

fs.mkdirSync(RESULTS, { recursive: true });
const out = path.join(RESULTS, 'selftest-report.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));

console.log('\n[selftest] completed=' + report.completed + ' error=' + report.error);
console.log('[selftest] arms:');
for (const a of report.arms) {
  console.log('  ' + String(a.id).padEnd(9) +
    ' frames=' + String(a.framesMeasured).padStart(4) +
    ' p50=' + String(a.raf.p50).padStart(7) +
    ' p95=' + String(a.raf.p95).padStart(7) +
    ' js%=' + String(a.jsShareOfFramePct).padStart(5) +
    ' proof=' + (a.activationProof ? JSON.stringify(a.activationProof.ok) : 'none') +
    ' valid=' + a.valid);
}
console.log('[selftest] verdict: ' + (report.summary && report.summary.verdict));
console.log('[selftest] wrote ' + out);
if (!KEEP) { await browser.close(); await srv.server.close(); }
process.exit(report.completed && report.arms.some((a) => a.valid) ? 0 : 1);
