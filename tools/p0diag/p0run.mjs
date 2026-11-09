// p0run.mjs — the one command the launcher runs. Finds a browser, starts the
// server, opens the page, waits for the report, prints a verdict, exits.
//
// Exit codes: 0 report saved, 1 failure, 2 no browser found.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './p0serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, 'game');
const RESULTS = path.join(HERE, 'results');
const INSTRUMENT = fs.readFileSync(path.join(HERE, 'p0diag.js'), 'utf8');
const WAIT_MS = Number(process.env.P0_TIMEOUT_MS || 8 * 60 * 1000);

function log(m) { console.log('[p0] ' + m); }

// ---------------------------------------------------------------- browser ---
// Chrome or Edge, in the places Windows actually puts them, plus PATH. Edge is
// always present on Windows 10/11, so this cannot fail on a normal machine.
function findBrowser() {
  const explicit = process.env.P0_BROWSER;
  if (explicit && fs.existsSync(explicit)) return { exe: explicit, name: 'P0_BROWSER' };
  const candidates = [
    ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'Chrome'],
    ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'Chrome'],
    [`${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`, 'Chrome'],
    ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'Edge'],
    ['C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'Edge'],
    ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'Chrome'],
    ['/usr/bin/google-chrome', 'Chrome'],
    ['/usr/bin/chromium', 'Chromium'],
    ['/tmp/chromium', 'Chromium (sandbox build)'],
  ];
  for (const [p, name] of candidates) {
    if (p && fs.existsSync(p)) return { exe: p, name };
  }
  return null;
}

// ── profile: always a throwaway, never the owner's ──────────────────────
// The unlock problem is solved INSIDE the page (the product's own owner-playtest
// session), so the tool has no reason to read any personal browser data. Every
// run uses an empty profile created next to the tool. P0_PROFILE is
// deliberately NOT honoured: accepting it would re-open the "read the owner's
// real session" path this design exists to avoid.
//
// The origin difference (http://127.0.0.1 vs the itchio origin) is handled by
// serving the frozen build's static files from this local server exactly as the
// itch build is served -- same relative URLs, one origin, fresh storage.
function profileDir() {
  const dir = path.join(HERE, '.p0profile');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Three SEPARATE runs of the same instrument, never merged and never averaged:
//   bot        — production BOT path (the product picks the CPU opponent)
//   local-perf — LOCAL 1v1 held at PERFORMANCE quality
//   local-high — LOCAL 1v1 held at HIGH quality (the isolation control)
const SCENARIOS = ['bot', 'local-perf', 'local-high'];

function browserArgs(profile) {
  return [
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    // The diagnosis needs the GPU, NOT a software fallback: silently switching
    // to SwiftShader would reproduce exactly the wrong thing.
    '--enable-gpu-rasterization',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ];
}

// Which GPU the page actually got. A run on a software rasteriser is not
// evidence about the owner's machine, so the report has to say which one it was
// instead of leaving the reader to assume.
const GPU_PROBE = `(function(){
  try {
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { vendor: 'none', renderer: 'none' };
    var d = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      vendor: d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  } catch (e) { return { vendor: 'err', renderer: String(e && e.message) }; }
})()`;


async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error('[p0] No Chrome/Edge found. Install one, or set P0_BROWSER to its .exe path.');
    process.exit(2);
  }
  log(`browser: ${browser.name} (${browser.exe})`);
  const profile = profileDir();
  log(`profile: throwaway (${profile}) — no personal browser data is read or copied`);

  const reports = [];
  for (const scen of SCENARIOS) {
    log(`scenario ${scen}: starting`);
    const srv = await startServer({ root: ROOT, resultsDir: RESULTS, instrument: INSTRUMENT });
    // No frame target is imposed on the owner: the arms end on their own time
    // budget so the numbers reflect their machine. The override exists so the
    // same code path can be exercised end-to-end on a host without a GPU.
    let url = srv.base + `/?p0diag=1&p0scenario=${encodeURIComponent(scen)}`;
    if (process.env.P0_MIN_FRAMES) url += '&p0minframes=' + encodeURIComponent(process.env.P0_MIN_FRAMES);
    const child = spawn(browser.exe, [...browserArgs(profile), url], { stdio: 'ignore', detached: false });
    child.on('error', (e) => log('browser failed to start: ' + e.message));
    const report = await waitForResult(srv);
    try { if (child) child.kill(); } catch (e) {}
    const gpu = report && report.env ? report.env : null;
    if (gpu && gpu.renderer) {
      const soft = /swiftshader|llvmpipe|software/i.test(gpu.renderer);
      if (soft) log(`scenario ${scen}: SOFTWARE RASTERISER (${gpu.renderer}) — `
        + 'timings are not evidence about a GPU machine');
    }
    try { srv.server.close(); } catch (e) {}
    if (report) {
      const v = report.summary && report.summary.verdict;
      log(`scenario ${scen}: ${v}`);
      reports.push(report);
    } else {
      log(`scenario ${scen}: NO REPORT`);
      reports.push({ scenario: { id: scen }, error: 'no report' });
    }
  }

  const combined = {
    schema: 'APEX-CHAOS-p0-diagnosis-bundle-v1',
    createdAt: new Date().toISOString(),
    note: 'Three SEPARATE runs. BOT is the production path; the LOCAL runs are the '
      + 'control and are labelled by quality tier. They are never averaged together.',
    runs: reports,
  };
  const out = path.join(RESULTS, 'p0-diagnosis-latest.json');
  fs.writeFileSync(out, JSON.stringify(combined, null, 2));
  log('wrote ' + out);

  console.log('\n── SUMMARY ─────────────────────────────────────────────────────');
  for (const r of reports) {
    const id = (r.scenario && r.scenario.id) || '?';
    const v = (r.summary && r.summary.verdict) || r.error || 'invalid';
    const f = r.fighters ? r.fighters.join(' vs ') : '-';
    console.log(`  ${id.padEnd(11)} ${String(v).padEnd(34)} ${f}`);
    for (const a of (r.arms || [])) {
      const c = a.cast || {};
      const p = a.activationProof || {};
      console.log(`      ${String(a.id).padEnd(8)} valid=${String(a.valid).padEnd(5)}`
        + ` cast=${c.confirmed || 0}/${c.presses || 0}`
        + ` p95=${(a.raf || {}).p95}`);
      if (p.claim) console.log(`               ${p.claim}`);
    }
  }
  console.log('───────────────────────────────────────────────────────────────\n');
  process.exit(0);
}

function waitForResult(srv) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = setInterval(() => {
      if (srv.saved.length) {
        clearInterval(tick);
        try { resolve(JSON.parse(fs.readFileSync(srv.saved[srv.saved.length - 1], 'utf8'))); }
        catch (e) { resolve(null); }
        return;
      }
      if (Date.now() - t0 > WAIT_MS) {
        clearInterval(tick);
        console.error('\n[p0] No result after ' + Math.round(WAIT_MS / 1000) + 's.');
        if (srv.misses.length) console.error('[p0] missing resources: ' + srv.misses.length);
        resolve(null);
      }
    }, 1000);
  });
}

function printVerdict(r) {
  const e = r.environment || {};
  const gl = (e.webgl && e.webgl.renderer) || 'unknown';
  console.log('\n=================== P0 DIAGNOSIS ===================');
  console.log('build        ' + (r.build || 'unknown'));
  console.log('browser      ' + String(e.userAgent || '').slice(0, 90));
  console.log('GPU          ' + String(gl).slice(0, 90));
  console.log('DPR/viewport ' + e.devicePixelRatio + ' / ' + JSON.stringify(e.viewportCss));
  console.log('canvas       ' + JSON.stringify(e.canvasRect));
  console.log('LoAF support ' + (r.capabilities && r.capabilities.longAnimationFrame));
  console.log('recording    ' + JSON.stringify(r.recordingAtStart));
  console.log('flags        ' + JSON.stringify(r.flagsAtStart));
  console.log('\narm            p50     p95     p99     max   js%   long  LoAF   Δp95   valid');
  for (const a of r.arms) {
    const s = a.raf || {};
    console.log(
      String(a.id).padEnd(14) +
      String(s.p50).padStart(6) + String(s.p95).padStart(8) + String(s.p99).padStart(8) +
      String(s.max).padStart(8) +
      String(a.jsShareOfFramePct).padStart(6) +
      String((a.longTasks || {}).count).padStart(6) +
      String((a.loaf || {}).count).padStart(6) +
      String((r.summary.rows.find((x) => x.id === a.id) || {}).deltaP95Pct).padStart(8) +
      String(a.valid).padStart(8));
  }
  console.log('\nverdict      ' + r.summary.verdict +
    '   (control p95 ' + r.summary.controlP95 + ' ms, stable=' + r.summary.controlStable + ')');
  if (r.summary.biggestReducer) {
    console.log('biggest      ' + r.summary.biggestReducer.id + ' ' +
      r.summary.biggestReducer.deltaP95Pct + '% vs control');
  }
  console.log('====================================================');
  console.log('Report saved under: tools/p0diag/results/');
}
main().catch((e) => { console.error('[p0] fatal: ' + e.stack); process.exit(1); });
