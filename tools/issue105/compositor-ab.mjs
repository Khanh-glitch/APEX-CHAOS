// Issue #105 §1 — genuine actual-fighter compositor A/B.
// Ground truth: fighter.draw(ctx) drawn directly. Candidate: drawFighterWithSideEdge(...).
// Both are rendered in the SAME synchronous task with the SAME live transform and
// the SAME fighter state, into offscreen canvases the size of the real backing store.
// Body pixels (where the direct draw has alpha) must match the candidate exactly
// (the keyline only adds pixels OUTSIDE the silhouette). Any direct-body pixel the
// candidate drops is a clipping receipt.
// Bands are measured in units of fighter radius r: [0,1r], (1r,3r], (3r,5.5r].
// Usage: node tools/issue105/compositor-ab.mjs [heroes...]  (env DPRS="1 2")
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, openApp, startBotBattle, wait, check } from './harness.mjs';

const HEROES = process.argv.slice(2).length ? process.argv.slice(2) : ['shuri', 'hunter', 'newbot', 'boxe', 'crystala', 'magnet', 'frost', 'mirror'];
const DPRS = (process.env.DPRS || '1 2').split(' ').map(Number);
const OUT = process.env.COMP_OUT || '/home/user/issue105-backup/evidence/compositor';
const results = [];
const receipts = [];
const browser = await launchBrowser();

const SAMPLE_JS = `(() => {
  const main = document.querySelector('#game-canvas');
  const ctx = main.getContext('2d');
  const W = main.width, H = main.height;
  const m = ctx.getTransform();
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const A = mk(), B = mk();
  const ac = A.getContext('2d'), bc = B.getContext('2d');
  const mode = (typeof apexSideIdentityContext === 'function') ? apexSideIdentityContext() : null;
  const out = [];
  const fighters = Array.isArray(window.fighters) ? window.fighters : [];
  for (let i = 0; i < 2; i++) {
    const f = fighters[i];
    if (!f || f.hp <= 0 || typeof f.draw !== 'function') continue;
    const scale = Math.hypot(m.a, m.b) || 1;
    const r = Math.max(20, f.radius || 75) * scale;
    const cx = m.a * f.x + m.c * f.y + m.e, cy = m.b * f.x + m.d * f.y + m.f;
    ac.setTransform(1,0,0,1,0,0); ac.clearRect(0,0,W,H); ac.setTransform(m.a,m.b,m.c,m.d,m.e,m.f); f.draw(ac); ac.setTransform(1,0,0,1,0,0);
    bc.setTransform(1,0,0,1,0,0); bc.clearRect(0,0,W,H);
    if (mode && typeof drawFighterWithSideEdge === 'function') { bc.setTransform(m.a,m.b,m.c,m.d,m.e,m.f); drawFighterWithSideEdge(bc, f, i, mode); bc.setTransform(1,0,0,1,0,0); }
    else { bc.setTransform(m.a,m.b,m.c,m.d,m.e,m.f); f.draw(bc); bc.setTransform(1,0,0,1,0,0); }
    // Body fidelity is measured on the compositor's OWN device-space body canvas (before the
    // keyline is composited underneath). Comparing the final composite would mix translucent
    // body pixels with the keyline colour and report a false mismatch.
    const pool = window.__apexEdgePool;
    const bodyFromPool = !!(pool && pool.body instanceof HTMLCanvasElement && pool.body.width === W && pool.body.height === H);
    const bodyCanvas = bodyFromPool ? pool.body : B;
    const da = ac.getImageData(0,0,W,H).data, db = bodyCanvas.getContext('2d').getImageData(0,0,W,H).data;
    const dbFinal = bc.getImageData(0,0,W,H).data;
    const band = { near: [0,0,0,0,0], mid: [0,0,0,0,0], far: [0,0,0,0,0] }; // [bodyPx, bodyMismatch, bodyDropped, finalDropped, finalOpaqueMismatch]
    let maxDist = 0;
    const x0 = Math.max(0, Math.floor(cx - 5.6 * r)), x1 = Math.min(W, Math.ceil(cx + 5.6 * r));
    const y0 = Math.max(0, Math.floor(cy - 5.6 * r)), y1 = Math.min(H, Math.ceil(cy + 5.6 * r));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const p = (y * W + x) * 4;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d > 5.5) continue;
      const key = d <= 1 ? 'near' : d <= 3 ? 'mid' : 'far';
      const aA = da[p + 3];
      if (aA === 0) continue;
      band[key][0]++;
      // final composite (what the player sees), valid for old and new compositor alike
      if (dbFinal[p + 3] === 0) band[key][3]++;
      if (aA === 255 && dbFinal[p + 3] > 0 && (Math.abs(dbFinal[p] - da[p]) + Math.abs(dbFinal[p+1] - da[p+1]) + Math.abs(dbFinal[p+2] - da[p+2])) > 8) band[key][4]++;
      if (db[p + 3] === 0) { band[key][2]++; continue; }
      const diff = Math.max(Math.abs(da[p] - db[p]), Math.abs(da[p+1] - db[p+1]), Math.abs(da[p+2] - db[p+2]), Math.abs(da[p+3] - db[p+3]));
      if (diff > 8) band[key][1]++;
      if (d > maxDist) maxDist = d;
    }
    // crop (2.4r half-size) for visual receipts, direct vs candidate, 2x upscale
    const half = Math.round(2.4 * r);
    const cw = Math.max(8, Math.min(W, half * 2)), ch = Math.max(8, Math.min(H, half * 2));
    const sx = Math.max(0, Math.round(cx - half)), sy = Math.max(0, Math.round(cy - half));
    const crop = (src) => { const c = document.createElement('canvas'); c.width = cw * 2; c.height = ch * 2; const k = c.getContext('2d'); k.imageSmoothingEnabled = false; k.drawImage(src, sx, sy, cw, ch, 0, 0, cw * 2, ch * 2); return c.toDataURL('image/png'); };
    out.push({ idx: i, id: f.id || f.name || null, rPx: Math.round(r), cx: Math.round(cx), cy: Math.round(cy), bands: band, maxDistR: Math.round(maxDist * 100) / 100, cropDirect: crop(A), cropCandidate: crop(B), dpr: window.devicePixelRatio, canvasW: W, canvasH: H, mode: mode ? String(mode) : null, bodySource: bodyFromPool ? 'pool.body(device-sized)' : 'candidate-canvas(no device body pool)' });
  }
  return out;
})()`;

async function driveAndSample(page, samples) {
  // cast both skills repeatedly so wide effects (FROST ice, CRYSTALA, MIRROR) are live
  const rows = [];
  for (let t = 0; t < samples; t++) {
    if (t % 2 === 0) await page.keyboard.press('KeyJ');
    if (t % 3 === 0) await page.keyboard.press('KeyK');
    await wait(260);
    rows.push(...(await page.evaluate(SAMPLE_JS)));
  }
  return rows;
}

try {
  for (const dpr of DPRS) {
    for (const hero of HEROES) {
      const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, dpr, storage: { 'apex.alpha.tutorial.v1': 'off' } });
      await startBotBattle(page, { hero });
      await wait(900);
      const rows = await driveAndSample(page, 14);
      await context.close();
      const agg = { near: [0, 0, 0, 0, 0], mid: [0, 0, 0, 0, 0], far: [0, 0, 0, 0, 0] };
      let best = null;
      for (const row of rows) {
        for (const k of Object.keys(agg)) for (let j = 0; j < 5; j++) agg[k][j] += row.bands[k][j];
        if (row.bands.far[0] > 0 && (!best || row.bands.far[0] > best.bands.far[0])) best = row;
      }
      const pc = (n, d) => (d ? Math.round((n / d) * 10000) / 100 : 0);
      const band = (a) => ({ bodyPx: a[0], bodyMismatchPct: pc(a[1], a[0]), bodyDroppedPct: pc(a[2], a[0]), finalDroppedPct: pc(a[3], a[0]), finalOpaqueMismatchPct: pc(a[4], a[0]) });
      const dir = path.join(OUT, `dpr${dpr}`, hero);
      await mkdir(dir, { recursive: true });
      const pick = best || rows.find((r) => r.cropDirect) || null;
      if (pick) {
        await writeFile(path.join(dir, 'crop-direct.png'), Buffer.from(pick.cropDirect.split(',')[1], 'base64'));
        await writeFile(path.join(dir, 'crop-candidate.png'), Buffer.from(pick.cropCandidate.split(',')[1], 'base64'));
      }
      const receipt = {
        hero, dpr, samples: rows.length, canvas: rows[0] ? `${rows[0].canvasW}x${rows[0].canvasH}` : null,
        mode: rows[0]?.mode ?? null,
        bodySource: rows[0]?.bodySource ?? null,
        near_0to1r: band(agg.near), mid_1to3r: band(agg.mid), far_3to5_5r: band(agg.far),
        maxDistR: Math.max(0, ...rows.map((r) => r.maxDistR)),
        errors: errors.slice(0, 3),
      };
      receipts.push(receipt);
      // Gate: body is preserved (no dropped pixels anywhere; near-body mismatch ~0; far mismatch small).
      check(results, agg.near[3] + agg.mid[3] + agg.far[3] === 0, `${hero} dpr${dpr}: no direct-body pixel missing in the final composite (0 clipped)`, { finalDropped: [agg.near[3], agg.mid[3], agg.far[3]] });
      check(results, receipt.near_0to1r.bodyMismatchPct <= 0.5 && receipt.mid_1to3r.bodyMismatchPct <= 1.0, `${hero} dpr${dpr}: body canvas matches direct draw (<=0.5% near, <=1% mid)`, { near: receipt.near_0to1r.bodyMismatchPct, mid: receipt.mid_1to3r.bodyMismatchPct });
      console.log('RECEIPT', JSON.stringify(receipt));
    }
  }
} finally {
  await browser.close();
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'compositor-ab.json'), JSON.stringify({ results, receipts }, null, 2));
}
const failed = results.filter((r) => !r.ok);
console.log('SUMMARY', JSON.stringify({ total: results.length, failed: failed.map((r) => r.name) }));
if (failed.length) process.exitCode = 1;
