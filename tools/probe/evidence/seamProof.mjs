// Isolates WHERE the residual differs. If the change is what it claims
// (merging same-colour sub-paths), the delta must live on anti-aliased SEAM
// pixels between two same-colour nodes - never in a node interior, never in a
// different-colour boundary.
//
// We render one pass at a time by handing each realm two nodes of the SAME
// colour that overlap, then measure the delta and classify it.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const REPO = '/home/user/APEX-CHAOS';
const SRC = {
  old: fs.readFileSync('/tmp/frost-old.js', 'utf8'),
  new: fs.readFileSync(REPO + '/public/game/hero-rework/frostGoldV1.js', 'utf8'),
};
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 700, height: 700 });
await page.setContent('<!doctype html><html><body></body></html>');

async function paint(source, code) {
  return page.evaluate(async ({ source, code }) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:0;height:0;border:0';
    document.body.appendChild(frame);
    const d = frame.contentDocument;
    d.open(); d.write('<!doctype html><body></body>'); d.close();
    let a = 0x9E3779B9;
    frame.contentWindow.Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const s = d.createElement('script'); s.textContent = source; d.body.appendChild(s);
    const W = frame.contentWindow;
    const cv = d.createElement('canvas'); cv.width = 600; cv.height = 600; d.body.appendChild(cv);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    let err = null;
    try { await new Function('W', 'ctx', 'cv', code)(W, ctx, cv); } catch (e) { err = String(e).slice(0, 200); }
    let data = null;
    if (!err) data = Array.from(ctx.getImageData(0, 0, 600, 600).data);
    frame.remove();
    return { err, data };
  }, { source, code });
}

// Two SAME-colour overlapping ice nodes, plus one DIFFERENT-colour node that
// must be untouched.
const CODE = `
  const G = W.APEX_FROST_GOLD;
  const f = new G.IceField(600, 600);
  // Both are 'wall' -> identical geometry style, same P3 colour (lock<0.8 ->
  // #c9e6f6). They overlap heavily.
  const n1 = f.add(250, 300, 0.2, 170, 90, 0.0, 'wall', { lockDur: 0.55 });
  const n2 = f.add(320, 320, 0.6, 170, 90, 0.0, 'wall', { lockDur: 0.55 });
  // A decaying node uses a different colour band; its boundary with the others
  // must not change.
  const n3 = null; // single-colour case: no third node
  const t = 1.9;
  f.render(ctx, t, 1);
  window.__nodes = { n1: !!n1, n2: !!n2 };
`;

const oldR = await paint(SRC.old, CODE);
const newR = await paint(SRC.new, CODE);
if (oldR.err || newR.err) { console.log('ERR', oldR.err, newR.err); process.exit(1); }
let total = 0, differing = 0, maxD = 0, sumD = 0;
// Classify: is a differing pixel ADJACENT to a same-value neighbour in old
// (i.e. an interior seam) or on a colour boundary?
const buckets = { seamSameColor: 0, boundary: 0, other: 0 };
const W = 600;
const oldD = oldR.data, newD = newR.data;
function at(buf, x, y) { const i = (y * W + x) * 4; return [buf[i], buf[i+1], buf[i+2], buf[i+3]]; }
for (let y = 0; y < W; y += 1) for (let x = 0; x < W; x += 1) {
  const i = (y * W + x) * 4;
  total += 1;
  const dd = Math.max(Math.abs(oldD[i]-newD[i]), Math.abs(oldD[i+1]-newD[i+1]), Math.abs(oldD[i+2]-newD[i+2]));
  if (dd === 0) continue;
  differing += 1; sumD += dd; if (dd > maxD) maxD = dd;
  // neighbour analysis on the OLD image
  let sameColorNeighbours = 0, diffNeighbours = 0;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
    const o = at(oldD, nx, ny);
    const same = o[0] === oldD[i] && o[1] === oldD[i+1] && o[2] === oldD[i+2];
    if (same) sameColorNeighbours += 1; else diffNeighbours += 1;
  }
  if (sameColorNeighbours > 0 && diffNeighbours === 0) buckets.seamSameColor += 1;
  else if (diffNeighbours > 0) buckets.boundary += 1;
  else buckets.other += 1;
}
const pct = (n) => +(100 * n / total).toFixed(4);
console.log(JSON.stringify({
  totalPixels: total, differingPixels: differing, differingPct: pct(differing),
  maxDelta: maxD, meanAbsAllPixels: +(sumD/total).toFixed(4),
  classification: { seamSameColorPct: pct(buckets.seamSameColor), boundaryPct: pct(buckets.boundary), otherPct: pct(buckets.other) },
  note: 'seamSameColor = differing pixel wholly surrounded by same-colour pixels in the baseline (an interior anti-aliased seam). boundary = differing pixel touches a different-colour edge.',
}, null, 1));
await browser.close(); process.exit(0);
