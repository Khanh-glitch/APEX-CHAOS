// Issue #105 — Lucky bay door: progress-based reveal budget (coordinator fix).
//
// Root cause under test: the reveal budget was measured in WALL time from
// OPENING. On a starved renderer the authored door (openingEnd 1.68s of engine
// time, dt clamped to 50ms/frame) legitimately takes longer than 4s of wall
// time while still advancing, so healthy transitions were fail-opened and
// logged "[APEX Lucky Draw] transition recovered". The fix measures engine
// PHASE progress (getDebug().stateTime) instead.
//
// Cases (real Chromium, real Lucky donor, real Lucky button):
//   A  progressing door, throttled renderer: OPENING completes through its
//      phase clock; NO "transition recovered" warning; the bay opens.
//   B  frozen door (requestAnimationFrame stopped while OPENING): the watchdog
//      visibly recovers (warning is expected here, it is a genuine stall),
//      scene input is not dead (body phase leaves OPENING, the cover is hidden),
//      and an intent queued during the stall runs after recovery.
//   C  normal journey: same flow, duration and frame rate recorded for the
//      unchanged-timing comparison.
//
// STALL_MS_GATE mirrors the coordinator's default stall guard (6000 ms).
const STALL_MS_GATE = 6000;
// Usage: APEX_APP_URL=... CHROME_PATH=... node tools/issue105/gate-door-progress.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, openApp, check, wait, BASE } from './harness.mjs';

const OUT = process.env.ISSUE105_OUT || '/tmp/i105-door-progress';
const results = [];
const seed = (credits) => ({ version: 1, testFixture: 'ISSUE-105-LABELLED-TEST-SEED-DOOR', credits, ownedFighters: ['ROBOT'], lastSelectedP1: 'ROBOT', lastSelectedP2: 'ROBOT', totalSpins: 0, unlockedAt: { ROBOT: 0 } });
const browser = await launchBrowser();
const report = {};

// rAF freeze hook, installed before any app script runs. Freezing drops the
// door's tick (the real stall mechanism) without touching timers, so the
// coordinator watchdog (setInterval) keeps running exactly as in production.
const FREEZE_HOOK = `(() => {
  const raf = window.requestAnimationFrame.bind(window);
  const held = [];
  window.__rafFrozen = false;
  window.__rafHeld = held;
  window.requestAnimationFrame = (cb) => {
    if (!window.__rafFrozen) return raf(cb);
    held.push(cb);
    return -1;
  };
  window.__rafThaw = () => { window.__rafFrozen = false; const cbs = held.splice(0); cbs.forEach((cb) => raf(cb)); };
  // The coordinator logs its stall BEFORE it finishes the transaction and starts
  // any queued intent. Thawing here means the queued intent runs on a live renderer
  // (the test isolates the stall to the frozen door only).
  const warn = console.warn.bind(console);
  console.warn = (...a) => { if (String(a[0]).includes('[scene-transition]')) window.__rafThaw(); return warn(...a); };
})();`;

async function openProfile(credits) {
  const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, dpr: 1, seed: seed(credits), storage: { 'apex.alpha.tutorial.v1': 'off' } });
  await page.evaluate(FREEZE_HOOK);
  const warnings = [];
  // Capture the FULL console text, including the Error object's message, so a
  // recovery warning always names its real reason.
  page.on('console', async (m) => {
    if (m.type() !== 'warning' && m.type() !== 'error') return;
    const parts = await Promise.all(m.args().map((a) => a.evaluate((x) => (x && x.message) ? x.message : String(x)).catch(() => '?')));
    warnings.push(`${m.type()}: ${parts.join(' | ').slice(0, 400)}`);
  });
  return { page, context, errors, warnings };
}

// Samples the body phase at ~50ms and returns the OPENING interval.
async function driveOpen(page, { freezeAtOpening = false, sampleMs = 50, maxMs = 60000 } = {}) {
  await page.waitForSelector('#openLuckyDraw', { visible: true, timeout: 60000 });
  const t0 = Date.now();
  // The render-loop sampler is installed BEFORE the click: a stall between the click
  // and a late install would be invisible to the justification below (#105).
  const sample = await page.evaluate(() => { window.__frameN = 0; window.__maxGap = 0; let last = performance.now(); const tick = () => { const n = performance.now(); window.__maxGap = Math.max(window.__maxGap, n - last); last = n; window.__frameN += 1; requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; }).catch(() => false);
  await page.click('#openLuckyDraw');
  let openingAt = null; let doneAt = null; let frozenAt = null; let fps = null; let queued = null;
  // Largest render-loop gap (ms between rAF callbacks) observed during the open.
  // A recovery warning is only justified when the render loop really stopped for
  // the guard's STALL_MS; otherwise the warning would be a false positive.
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => document.body.dataset.apexSceneTransition || 'IDLE').catch(() => 'ERR');
    const now = Date.now();
    if (s === 'OPENING' && openingAt == null) openingAt = now;
    if (freezeAtOpening && s === 'OPENING' && frozenAt == null) {
      await page.evaluate(() => { window.__rafFrozen = true; });
      frozenAt = now;
      // An intent issued DURING the stall must be queued (latest intent wins), not
      // swallowed, and must run once the coordinator recovers the scene.
      queued = await page.evaluate(() => {
        const tr = window.APEX_SCENE_TRANSITION;
        if (!tr || typeof tr.run !== 'function') return 'no-coordinator';
        window.__queuedProbe = 'pending';
        const shell = () => document.getElementById('gold-shell-host') || document.body;
        tr.run({ name: 'queued-probe', source: shell, target: shell, prepare: async () => true, commit: () => { window.__queuedProbe = 'committed'; }, rollback: () => {} })
          .then((r) => { window.__queuedProbe = r && r.ok === false ? ('resolved-not-ok:' + String(r.error)) : (window.__queuedProbe === 'committed' ? 'ok' : 'resolved'); })
          .catch((e) => { window.__queuedProbe = 'rejected:' + String(e); });
        return 'issued';
      });
    }
    if (openingAt != null && (s === 'DONE' || s === 'IDLE') && doneAt == null) { doneAt = now; break; }
    if (freezeAtOpening && frozenAt != null && now - frozenAt > 25000) break;
    await wait(sampleMs);
  }
  const f0 = await page.evaluate(() => window.__frameN || 0).catch(() => 0);
  await wait(1000);
  const f1 = await page.evaluate(() => window.__frameN || 0).catch(() => 0);
  fps = Math.round((f1 - f0) / 1.0);
  const maxRafGapMs = await page.evaluate(() => Math.round(window.__maxGap || 0)).catch(() => null);
  return { openingMs: openingAt && doneAt ? doneAt - openingAt : null, openingAt, doneAt, frozenAt, fps, maxRafGapMs, sampleOk: !!sample, queued };
}

try {
  // ── A: progressing door on the starved renderer ───────────────────────────
  {
    const { page, context, errors, warnings } = await openProfile(1000);
    const r = await driveOpen(page);
    await wait(800);
    const recovered = [...errors, ...warnings].filter((e) => /transition recovered|still-opening door/.test(e));
    const engineOk = await page.evaluate(() => { const f = document.getElementById('luckyDonorHost'); return !!f; });
    report.A = { ...r, recovered, bayHost: engineOk };
    const justifiedA = recovered.length === 0 || (r.maxRafGapMs ?? 0) >= STALL_MS_GATE;
    check(results, justifiedA && r.openingMs != null, 'A progressing throttled door: any "transition recovered" warning is backed by a real >=STALL_MS render gap', { recovered, fps: r.fps, maxRafGapMs: r.maxRafGapMs, openingMs: r.openingMs });
    check(results, r.openingMs != null, 'A progressing throttled door: OPENING reaches DONE on its own', { openingMs: r.openingMs, fps: r.fps });
    await context.close();
  }

  // ── B: genuinely frozen door ──────────────────────────────────────────────
  {
    const { page, context, errors, warnings } = await openProfile(1000);
    const r = await driveOpen(page, { freezeAtOpening: true });
    // Watchdog should release within ~REVEAL_GRACE_MS of no phase progress.
    const frozenFor = r.frozenAt && r.doneAt ? r.doneAt - r.frozenAt : null;
    const bodyPhase = await page.evaluate(() => document.body.dataset.apexSceneTransition || 'IDLE');
    const coverHidden = await page.evaluate(() => { const c = document.getElementById('apex-scene-transition'); return !c || c.style.display === 'none' || getComputedStyle(c).display === 'none'; });
    // Input is not dead: a queued intent issued DURING the stall must still run.
    await page.evaluate(() => window.__rafThaw && window.__rafThaw());
    await wait(500);
    const recovered = [...errors, ...warnings].filter((e) => /transition recovered|still-opening door|no OPENING phase progress/.test(e));
    // The queued intent must settle after recovery (wait up to 15s).
    let queuedState = 'unknown';
    for (let i = 0; i < 75; i += 1) {
      queuedState = await page.evaluate(() => window.__queuedProbe || 'missing').catch(() => 'eval-error');
      if (queuedState !== 'pending') break;
      await wait(200);
    }
    report.B = { ...r, frozenFor, bodyPhase, coverHidden, recovered, queuedState };
    check(results, r.queued === 'issued', 'B an intent issued during the stall is accepted (not swallowed)', { queued: r.queued });
    check(results, queuedState === 'committed' || queuedState === 'ok', 'B the queued intent runs after recovery (commit reached)', { queuedState });
    check(results, r.frozenAt != null, 'B the door was actually frozen in OPENING (stall injected)', { frozenAt: r.frozenAt });
    check(results, recovered.length >= 1, 'B frozen door: watchdog reports the genuine stall (warning expected)', { recovered: recovered.slice(0, 2) });
    check(results, bodyPhase !== 'OPENING', 'B frozen door: scene phase leaves OPENING (input not dead)', { bodyPhase });
    check(results, frozenFor != null && frozenFor < 15000, 'B frozen door: recovery is prompt (< 15s after freeze)', { frozenFor });
    await context.close();
  }

  // ── C: normal journey timing, recorded for comparison ───────────────────
  {
    const { page, context, errors, warnings } = await openProfile(1000);
    const r = await driveOpen(page);
    const recovered = [...errors, ...warnings].filter((e) => /transition recovered|still-opening door/.test(e));
    report.C = { ...r, recovered };
    const justifiedC = recovered.length === 0 || (r.maxRafGapMs ?? 0) >= STALL_MS_GATE;
    check(results, justifiedC && r.openingMs != null, 'C normal journey: completes; any recovery warning is backed by a real >=STALL_MS render gap', { openingMs: r.openingMs, fps: r.fps, recovered, maxRafGapMs: r.maxRafGapMs });
    await context.close();
  }
} catch (err) {
  check(results, false, 'door gate completed without exception', { error: String(err && err.stack || err).slice(0, 600) });
} finally {
  await browser.close();
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'gate-door-progress.json'), JSON.stringify({ base: BASE, report, results }, null, 2));
}
const failed = results.filter((r) => !r.ok);
console.log('SUMMARY', JSON.stringify({ total: results.length, failed: failed.map((r) => r.name), report }));
if (failed.length) process.exitCode = 1;
