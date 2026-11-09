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

// Which browser profile to use is a real decision, not a detail.
//
// The diagnosis needs the owner's UNLOCKS: a brand-new profile owns only
// ROBOT/HUNTER, and the product's own gate (APEX_GOLD_LOCKED ->
// meta.canPublicSelect) then refuses to start a CRYSTALA vs FROST match at all.
// Seeding unlocks behind the owner's back would change the thing being
// measured, so instead the tool runs in THEIR profile:
//
//   1. the packaged profile (portable copy of their data, when present) or
//   2. a profile directory the owner points at with P0_PROFILE, or
//   3. the browser's own default profile.
//
// A throwaway profile is used ONLY when the browser refuses a live profile,
// and the report always records which one was used.
function resolveProfile() {
  const packaged = path.join(HERE, 'profile');
  const explicit = process.env.P0_PROFILE;
  if (explicit) return { dir: explicit, kind: 'P0_PROFILE', replay: false };
  const replay = path.join(HERE, 'profile', 'Default');
  if (fs.existsSync(replay)) return { dir: packaged, kind: 'packaged-owner-profile', replay: true };
  // 4. the browser's own user-data root, discovered from the OS. This is the
  //    folder that holds the owner's unlocks, so using it needs no setup step.
  const discovered = findBrowserProfile();
  if (discovered) return { dir: discovered, kind: 'browser-default-profile', replay: false, source: true };
  const fresh = path.join(HERE, '.p0profile');
  fs.mkdirSync(fresh, { recursive: true });
  return { dir: fresh, kind: 'throwaway', replay: false };
}

// Chrome/Edge keep "User Data" (Windows), "Google/Chrome" (macOS) or
// "~/.config/google-chrome" (Linux) next to their binaries. Pick the first one
// that actually contains a profile, so the game sees the owner's unlocks.
function findBrowserProfile() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const lad = process.env.LOCALAPPDATA || '';
  const candidates = [
    lad && path.join(lad, 'Google/Chrome/User Data'),
    lad && path.join(lad, 'Microsoft/Edge/User Data'),
    home && path.join(home, 'AppData/Local/Google/Chrome/User Data'),
    home && path.join(home, 'Library/Application Support/Google/Chrome'),
    home && path.join(home, '.config/google-chrome'),
    home && path.join(home, '.config/chromium'),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (!fs.existsSync(c)) continue;
      // Must contain a profile directory, or Chrome will treat it as brand new.
      const entries = fs.readdirSync(c);
      if (entries.includes('Default') || entries.some((e) => e.startsWith('Profile '))) return c;
    } catch (e) { /* keep looking */ }
  }
  return null;
}

async function main() {
  const srv = await startServer({ root: ROOT, resultsDir: RESULTS, instrument: INSTRUMENT });
  log(`serving ${ROOT}`);
  log(`open this if the browser does not appear by itself: ${srv.launch}`);

  const browser = findBrowser();
  let child = null;
  if (!browser) {
    console.error('\n[p0] No Chrome/Edge found.');
    console.error('[p0] Install Chrome, or set P0_BROWSER to the browser executable path,');
    console.error('[p0] then open this URL by hand: ' + srv.launch);
    // Keep serving so the manual path still works.
    await waitForResult(srv);
    return;
  }
  log(`browser: ${browser.name} (${browser.exe})`);

  const prof = resolveProfile();
  let profileDir = prof.dir;

  // NEVER point the browser at a profile that is in use. Chrome locks its
  // user-data folder, and even when it opens, the run would write into the
  // owner's real session. The unlocks only have to be READ, so the profile is
  // copied once into a scratch folder and the browser runs on the copy.
  if (prof.source) {
    const scratch = path.join(HERE, '.p0profile-run');
    try {
      log('copying your browser profile (read-only use of the original)...');
      fs.rmSync(scratch, { recursive: true, force: true });
      // Only the parts a boot needs: Local State holds the encryption key
      // reference, Default holds the save data. Caches and history are large
      // and irrelevant, so they are skipped.
      fs.mkdirSync(scratch, { recursive: true });
      const localState = path.join(prof.dir, 'Local State');
      if (fs.existsSync(localState)) fs.copyFileSync(localState, path.join(scratch, 'Local State'));
      const src = path.join(prof.dir, 'Default');
      const dst = path.join(scratch, 'Default');
      if (fs.existsSync(src)) {
        fs.cpSync(src, dst, {
          recursive: true, force: true,
          // Skip only the bulky caches. 'Media History' must NOT be filtered
          // out, because that substring also matches 'Media History*' files
          // that live beside real profile data; the caches alone are the win.
          filter: (f) => !/(Cache|Service Worker)/.test(path.basename(f)),
        });
      }
      profileDir = scratch;
      log('profile: copy of ' + prof.kind + ' -> ' + scratch);
    } catch (e) {
      log('profile copy failed (' + e.message + '); falling back to a fresh profile.');
      log('  a fresh profile usually has CRYSTALA/FROST locked, so the run may');
      log('  report LOCKED. Set P0_PROFILE to a copy of your Chrome "User Data".');
      profileDir = path.join(HERE, '.p0profile');
      fs.mkdirSync(profileDir, { recursive: true });
    }
  } else {
    log(`profile: ${prof.kind} (${profileDir})` +
      (prof.kind === 'throwaway' ? '  <-- a fresh profile usually has CRYSTALA/FROST locked;' : ''));
  }

  const args = [
    '--user-data-dir=' + profileDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    // The diagnosis needs the GPU, NOT a software fallback: silently switching
    // to SwiftShader would reproduce exactly the wrong thing. If the GPU is
    // blocked this run is invalid, and the report says so via environment.webgl.
    '--enable-gpu-rasterization',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    srv.launch,
  ];
  // A window, not headless: the owner must be able to see the match that is
  // being measured, and headless compositors do not behave like the real one.
  child = spawn(browser.exe, args, { stdio: 'ignore', detached: false });
  child.on('error', (e) => log('browser failed to start: ' + e.message));

  const report = await waitForResult(srv);
  try { if (child) child.kill(); } catch (e) {}
  try { srv.server.close(); } catch (e) {}

  if (!report) process.exit(1);
  printVerdict(report);
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
