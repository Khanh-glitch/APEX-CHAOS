// CRYSTALA headless performance PROXY — sandbox fallback for
// profileCrystalaPerformance.mjs (which is production-BROWSER evidence and needs
// CHROME_PATH). This measures the same scenario labels through the jsdom +
// @napi-rs/canvas harness: runtime tick cost + Gold draw cost per frame. It is
// directional evidence only (no GPU/compositor); the browser profiler remains
// the authoritative artifact when a Chrome binary is available.
//
// Usage: node tools/profileCrystalaPerformanceHeadless.mjs
// Output: docs/hero-rework/crystala-v1/perf/crystala-performance-profile-headless.json
import fs from 'node:fs';
import path from 'node:path';
import { bootHarness } from './lib/crystalaHarness.mjs';

const OUT = path.resolve('docs/hero-rework/crystala-v1/perf');
fs.mkdirSync(OUT, { recursive: true });

const H = await bootHarness();
const { win, T, HR, CRY, GOLD, W, CFG } = H;

const stats = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, p50: q(0.5), p95: q(0.95), max: s[s.length - 1], mean: xs.reduce((a, b) => a + b, 0) / (xs.length || 1) };
};

function measure(label, frames = 120, warm = 20, ct = null) {
  const stepMs = [], drawMs = [], frameMs = [];
  const canvas = win.document.createElement('canvas');
  canvas.width = 960; canvas.height = 540;
  const ctx = canvas.getContext('2d');
  const bloom = GOLD.createBloomSystem({ width: 960, height: 540, scale: 0.5 });
  const region = { x: 0, y: 0, w: 960, h: 540 };
  const drawScene = () => {
    // Real Gold draw composition (same calls as crystalaPresentationRuntime):
    // bloom begin -> stones -> hero body -> construct layers -> composite.
    const gx = bloom.begin(null, region);
    if (ct) {
      const rig = CRY.rigOf(ct);
      for (const st of rig.stones) GOLD.drawStone(gx, st, 1, true);
      GOLD.drawCrystala(gx, rig.hero, true, 1);
      for (const cons of rig.constructs || []) {
        if (cons.kind === 'wall') { GOLD.drawWall(gx, cons.geom, false); GOLD.drawWall(gx, cons.geom, true); }
        else { GOLD.drawPrison(gx, cons.prison, false); GOLD.drawPrison(gx, cons.prison, true); }
      }
    }
    bloom.composite(ctx, 960, 540, region);
  };
  for (let i = 0; i < warm + frames; i++) {
    const t0 = performance.now();
    const s0 = performance.now();
    T.step(1 / 60, 1 / 60);
    const s1 = performance.now();
    drawScene();
    const t1 = performance.now();
    if (i >= warm) { stepMs.push(s1 - s0); drawMs.push(t1 - s1); frameMs.push(t1 - t0); }
  }
  return { label, step: stats(stepMs), draw: stats(drawMs), frame: stats(frameMs) };
}

function fireAt(owner, x, y, tx, ty, weapon = 'PISTOL') {
  const spec = (CFG && CFG.WEAPONS && CFG.WEAPONS[weapon]) || {};
  const speed = spec.bulletSpeed || ({ PISTOL: 2600, SMG: 3100, SNIPER: 5800 }[weapon] || 2600);
  const damage = spec.damagePerShot || spec.damage || spec.damagePerPellet || 4.5;
  W.fireBullet({ owner, x, y, angle: Math.atan2(ty - y, tx - x), speed, damage,
    radius: spec.bulletRadius || 7, life: spec.bulletLife || 1, weapon, color: '#fff' });
}

function match(p1, p2) {
  HR.setSeed(42); HR.setAiEnabled(false);
  const m = T.start(p1, p2); T.holdSpawns();
  const [a, b] = H.fighters();
  a.x = 150; a.y = 500; a.setDir(1, 0); b.x = 850; b.y = 500; b.setDir(-1, 0);
  T.step(0.3);
  return { m, a, b, ct: m.combatants[0] };
}

const rows = [];
{
  match('ROBOT', 'HUNTER');
  rows.push(measure('baseline-robot-hunter'));
}
{
  const { ct } = match('CRYSTAL', 'ROBOT');
  rows.push(measure('crystal-dormant-full', 120, 20, ct));
}
{
  const { a, ct } = match('CRYSTAL', 'ROBOT');
  HR.pressAbility(a, 'A2');
  T.step(0.17);
  rows.push(measure('crystal-k-awake-full', 110, 10, ct));
}
{
  const { a, ct } = match('CRYSTAL', 'ROBOT');
  HR.pressAbility(a, 'A2');
  HR.pressAbility(a, 'A1');                    // HEXA (window open, 6 free)
  T.step(0.92);                                 // through the Gold build/lock path
  rows.push(measure('crystal-prison-full', 120, 5, ct));
}
{
  const { a, b, ct } = match('CRYSTAL', 'ROBOT');
  HR.pressAbility(a, 'A2');
  T.step(1.35);                                 // past the 1.2 s HEXA decision window
  const cast = HR.pressAbility(a, 'A1');        // WALL fallback (blades [0,1])
  if (!cast.ok) throw new Error('headless wall setup failed: ' + (cast.reason || '?'));
  T.step(0.85);
  rows.push(measure('crystal-k-wall-full', 120, 5, ct));
  // live threat stream through the wall: real reflect + predictor load
  for (let k = 0; k < 6; k++) { fireAt(b, 850, 500, 150, 500, 'PISTOL'); T.step(0.2); }
  rows.push(measure('crystal-wall-under-fire', 120, 5, ct));
}

const out = {
  kind: 'headless-proxy (jsdom + napi-rs/canvas) — NOT the production-browser profile',
  note: 'Browser profiler (tools/profileCrystalaPerformance.mjs) blocked in this sandbox: no Chrome binary and the Chrome download CDN is unreachable. GOLD draw code is byte-untouched by the V2 patch (see testCrystalaGoldParity + git diff).',
  generatedAt: new Date().toISOString(),
  rows,
};
const outPath = path.join(OUT, 'crystala-performance-profile-headless.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
for (const r of rows) {
  console.log(JSON.stringify({ label: r.label, stepP50: +r.step.p50.toFixed(3), stepP95: +r.step.p95.toFixed(3), drawP50: +r.draw.p50.toFixed(3), frameP95: +r.frame.p95.toFixed(3) }));
}
console.log('WROTE ' + outPath);
process.exit(0);
