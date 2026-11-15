// Issue #105 owner rejection R2, P0-B: playable heroes carry NO P1/P2 side outline.
// Real Chromium, real BOT battle, real skills, DPR 1 and 2.
// Measured on the live main canvas: pixels just outside each fighter's own silhouette
// (annulus 1.0r..1.9r, outside the body alpha of that fighter drawn alone) that carry
// the Gold side colours P1 #FF941F or P2 #3AA7FF AND touch the body within 3 px. The old
// compositor painted exactly that keyline. Baseline (7ef2dc0) fails; HEAD must pass.
// Rule (measured, not guessed): the keyline is a continuous ring in the exact Gold side colours hugging the
// body. Metric = edge coverage: the fraction of body-boundary pixels with an exact P1 (#FF941F) or P2 (#3AA7FF)
// pixel outside them within 2 px (colour tolerance 6). Peak per sample must be <= 0.002.
// Measured: HEAD 0 in every sample for all 8 heroes at DPR1 and DPR2 (16 runs). Baseline 7ef2dc0 shows
// 0.007-0.059 in samples, and FAILS on several hero-runs. The edge is intermittent (while fighters overlap).
// Also writes crops (2x, nearest) of each fighter from the live canvas for DPR receipts.
// Usage: APEX_APP_URL=... [ISSUE105_OUT=dir] node tools/issue105/gate-no-side-outline.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { launchBrowser, openApp, startBotBattle, wait, check } from './harness.mjs';

const HEROES = process.argv.slice(2).length ? process.argv.slice(2) : ['shuri', 'hunter', 'newbot', 'boxe', 'crystala', 'magnet', 'frost', 'mirror'];
const DPRS = (process.env.DPRS || '1 2').split(' ').map(Number);
const OUT = process.env.NO_OUTLINE_OUT || path.join(process.env.ISSUE105_OUT || os.tmpdir(), 'no-side-outline');
const results = [];
const receipts = [];
const browser = await launchBrowser();

const SAMPLE_JS = `(() => {
  const main = document.querySelector('#game-canvas');
  const ctx = main.getContext('2d');
  const W = main.width, H = main.height;
  const m = ctx.getTransform();
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const oc = off.getContext('2d');
  const live = (window.fighters || []).map((f, i) => ({ f, i })).filter(({ f }) => f && f.hp > 0 && typeof f.draw === 'function');
  const main2 = ctx.getImageData(0, 0, W, H).data;
  const P1 = [255, 148, 31], P2 = [58, 167, 255];
  const near = (p, c) => Math.abs(p[0] - c[0]) <= 20 && Math.abs(p[1] - c[1]) <= 20 && Math.abs(p[2] - c[2]) <= 20;
  const exact = (p, c) => Math.abs(p[0] - c[0]) <= 6 && Math.abs(p[1] - c[1]) <= 6 && Math.abs(p[2] - c[2]) <= 6;
  const out = [];
  for (const { f, i } of live) {
    const scale = Math.hypot(m.a, m.b) || 1;
    const r = Math.max(20, f.radius || 75) * scale;
    const cx = m.a * f.x + m.c * f.y + m.e, cy = m.b * f.x + m.d * f.y + m.f;
    oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, W, H);
    oc.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); f.draw(oc); oc.setTransform(1, 0, 0, 1, 0, 0);
    const body = oc.getImageData(0, 0, W, H).data;
    const band = { ring: 0, p1: 0, p2: 0, sideLike: 0, perim: 0, cov: 0 };
    const x0 = Math.max(0, Math.floor(cx - 1.9 * r)), x1 = Math.min(W, Math.ceil(cx + 1.9 * r));
    const y0 = Math.max(0, Math.floor(cy - 1.9 * r)), y1 = Math.min(H, Math.ceil(cy + 1.9 * r));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const p = (y * W + x) * 4;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      // Adjacency, not a radius band: the keyline hugs the rendered silhouette, which can sit inside 1.0r.
      if (d > 1.9) continue;
      if (body[p + 3] !== 0) continue;
      band.ring++;
      const px = [main2[p], main2[p + 1], main2[p + 2]];
      const isP1 = near(px, P1), isP2 = near(px, P2);
      if (!isP1 && !isP2) continue;
      // An outline is a keyline hugging the body: count only side-coloured pixels that
      // touch the body within 3 device px. Distant arena or VFX colour is not an outline.
      let touches = false;
      for (let dy = -3; dy <= 3 && !touches; dy++) for (let dx = -3; dx <= 3 && !touches; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if (body[(yy * W + xx) * 4 + 3] > 0) touches = true;
      }
      if (!touches) continue;
      if (isP1) band.p1++;
      if (isP2) band.p2++;
    }
    band.sideLike = band.p1 + band.p2;
    // Edge coverage: the keyline is a continuous ring hugging the silhouette. Count body-boundary pixels that have
    // a side-coloured pixel outside them within 2 px. Blobs of VFX (ice, gloves) touch only a small part of the boundary.
    for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
      const p = (y * W + x) * 4;
      if (body[p + 3] === 0) continue;
      const boundary = body[p - 4 + 3] === 0 || body[p + 4 + 3] === 0 || body[p - W * 4 + 3] === 0 || body[p + W * 4 + 3] === 0;
      if (!boundary) continue;
      band.perim++;
      let hit = false;
      for (let dy = -2; dy <= 2 && !hit; dy++) for (let dx = -2; dx <= 2 && !hit; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const q = (yy * W + xx) * 4;
        if (body[q + 3] !== 0) continue;
        const px = [main2[q], main2[q + 1], main2[q + 2]];
        if (exact(px, P1) || exact(px, P2)) hit = true;
      }
      if (hit) band.cov++;
    }
    const half = Math.round(2.4 * r);
    const sx = Math.max(0, Math.round(cx - half)), sy = Math.max(0, Math.round(cy - half));
    const cw = Math.max(8, Math.min(W - sx, half * 2)), ch = Math.max(8, Math.min(H - sy, half * 2));
    const crop = document.createElement('canvas'); crop.width = cw * 2; crop.height = ch * 2;
    const k = crop.getContext('2d'); k.imageSmoothingEnabled = false; k.drawImage(main, sx, sy, cw, ch, 0, 0, cw * 2, ch * 2);
    out.push({ idx: i, id: f.id || f.name || null, rPx: Math.round(r), dpr: window.devicePixelRatio, ring: band.ring, sideLike: band.sideLike, p1: band.p1, p2: band.p2, perim: band.perim, cov: band.cov, crop: crop.toDataURL('image/png') });
  }
  return out;
})()`;

async function sampleBattle(page, samples) {
  const rows = [];
  for (let t = 0; t < samples; t++) {
    if (t % 2 === 0) await page.keyboard.press('KeyJ');
    if (t % 3 === 0) await page.keyboard.press('KeyK');
    await wait(260);
    const batch = await page.evaluate(SAMPLE_JS);
    for (const r of batch) r.t = t;
    rows.push(...batch);
  }
  return rows;
}

try {
  for (const dpr of DPRS) {
    for (const hero of HEROES) {
      const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, dpr, storage: { 'apex.alpha.tutorial.v1': 'off' } });
      await startBotBattle(page, { hero });
      await wait(900);
      const rows = await sampleBattle(page, 14);
      await context.close();
      const ring = rows.reduce((a, r) => a + r.ring, 0);
      const sideLike = rows.reduce((a, r) => a + r.sideLike, 0);
      // A keyline is persistent: it is present in most samples. A single VFX spark touching the body
      // in one sample is not an outline (it is art/effect colour). Count samples over threshold, per sample.
      const perSample = Array.from({ length: 14 }, (_, t) => rows.filter((r) => r.t === t).reduce((a, r) => a + r.sideLike, 0));
      const peakSample = Math.max(...perSample);
      const perSampleCoverage = Array.from({ length: 14 }, (_, t) => { const rs = rows.filter((r) => r.t === t); return rs.length ? Math.max(...rs.map((r) => (r.perim ? r.cov / r.perim : 0))) : 0; });
      const peakCoverage = Math.max(...perSampleCoverage);
      const dir = path.join(OUT, `dpr${dpr}`, hero);
      await mkdir(dir, { recursive: true });
      const withCrop = rows.filter((r) => r.crop);
      const pick = withCrop.sort((a, b) => b.ring - a.ring)[0];
      if (pick) await writeFile(path.join(dir, 'crop-live-2x.png'), Buffer.from(pick.crop.split(',')[1], 'base64'));
      const receipt = { hero, dpr, samples: rows.length, ringPx: ring, sideColourPx: sideLike, peakSampleSideColourPx: peakSample, perSampleSideColourPx: perSample, peakCoverage: Math.round(peakCoverage * 1000) / 1000, perSampleCoverage: perSampleCoverage.map((v) => Math.round(v * 1000) / 1000), pctOfRing: ring ? Math.round((sideLike / ring) * 10000) / 100 : 0, errors: errors.slice(0, 3) };
      receipts.push(receipt);
      check(results, peakCoverage <= 0.002, `${hero} dpr${dpr}: no P1/P2 side outline touching the actor`, { peakEdgeCoverage: Math.round(peakCoverage * 1000) / 1000, limit: 0.002, adjacentSideColourPx: sideLike });
      console.log('RECEIPT', JSON.stringify(receipt));
    }
  }
} finally {
  await browser.close();
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'no-side-outline.json'), JSON.stringify({ results, receipts }, null, 2));
}
const failed = results.filter((r) => !r.ok);
console.log('SUMMARY', JSON.stringify({ total: results.length, failed: failed.map((r) => r.name) }));
if (failed.length) process.exitCode = 1;
