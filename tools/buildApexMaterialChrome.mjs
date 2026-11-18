// APEX CHAOS — UI material chrome builder.
// Composes the AI-generated raw material textures (art-src/ui_material) into
// alpha sprites + tiles under public/assets/ui_material.
// Light always comes from the TOP-LEFT; silhouettes use 45° chamfers, never radii.
//   node tools/buildApexMaterialChrome.mjs [--preview]
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'art-src', 'ui_material');
const OUT = path.join(ROOT, 'public', 'assets', 'ui_material');
fs.mkdirSync(OUT, { recursive: true });
const written = [];

let seed = 20261118;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const cv = (w, h) => createCanvas(w, h);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const save = async (name, c, q = 90) => { fs.writeFileSync(path.join(OUT, name), await c.encode('webp', q)); written.push({ name, w: c.width, h: c.height }); };

const T = {};
for (const n of ['obsidian_scratch', 'gold_leaf_worn', 'gunmetal_scuffed', 'ember_fissures', 'rust_hazard']) T[n] = await loadImage(path.join(SRC, 'tex', n + '.jpg'));
const padRaw = await loadImage(path.join(SRC, 'src', 'padlock_raw.png'));
const cornerRaw = await loadImage(path.join(SRC, 'src', 'corner_raw.png'));

/* ───────── pixel helpers ───────── */
function grade(c, { gain = 1, gamma = 1, sat = 1, mul = [1, 1, 1], add = [0, 0, 0] } = {}) {
  const g = c.getContext('2d'); const id = g.getImageData(0, 0, c.width, c.height); const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const L = .299 * r + .587 * gg + .114 * b;
    r = L + (r - L) * sat; gg = L + (gg - L) * sat; b = L + (b - L) * sat;
    d[i] = clamp(Math.pow(clamp(r * gain), gamma) * mul[0] + add[0] / 255) * 255;
    d[i + 1] = clamp(Math.pow(clamp(gg * gain), gamma) * mul[1] + add[1] / 255) * 255;
    d[i + 2] = clamp(Math.pow(clamp(b * gain), gamma) * mul[2] + add[2] / 255) * 255;
  }
  g.putImageData(id, 0, 0); return c;
}
// luminance → colour ramp (used for the cryo / P2 variants of gold + ember)
function gradMap(c, stops) {
  const g = c.getContext('2d'); const id = g.getImageData(0, 0, c.width, c.height); const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const L = clamp((.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]) / 255);
    let k = 0; while (k < stops.length - 2 && L > stops[k + 1][0]) k++;
    const [l0, c0] = stops[k], [l1, c1] = stops[k + 1]; const t = clamp((L - l0) / (l1 - l0));
    d[i] = c0[0] + (c1[0] - c0[0]) * t; d[i + 1] = c0[1] + (c1[1] - c0[1]) * t; d[i + 2] = c0[2] + (c1[2] - c0[2]) * t;
  }
  g.putImageData(id, 0, 0); return c;
}
const CRYO = [[0, [6, 12, 18]], [.35, [52, 86, 106]], [.7, [140, 190, 212]], [1, [226, 246, 255]]];
const CRYO_EMBER = [[0, [2, 6, 10]], [.4, [10, 60, 96]], [.8, [58, 190, 255]], [1, [214, 246, 255]]];

function crop(im, x, y, w, h, outW = w, outH = h) { const c = cv(outW, outH); c.getContext('2d').drawImage(im, x, y, w, h, 0, 0, outW, outH); return c; }
function mirror4(base) {
  const w = base.width, h = base.height; const c = cv(w * 2, h * 2), g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  g.save(); g.translate(w * 2, 0); g.scale(-1, 1); g.drawImage(base, 0, 0); g.restore();
  g.save(); g.translate(0, h * 2); g.scale(1, -1); g.drawImage(base, 0, 0); g.restore();
  g.save(); g.translate(w * 2, h * 2); g.scale(-1, -1); g.drawImage(base, 0, 0); g.restore();
  return c;
}
const rubStat = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; return (s / (d.length / 4) / 255).toFixed(3); };

/* ───────── geometry ───────── */
function chamfer(g, x, y, w, h, { tl = 0, tr = 0, br = 0, bl = 0 } = {}, begin = true) {
  if (begin) g.beginPath();
  g.moveTo(x + tl, y); g.lineTo(x + w - tr, y); if (tr) g.lineTo(x + w, y + tr);
  g.lineTo(x + w, y + h - br); if (br) g.lineTo(x + w - br, y + h);
  g.lineTo(x + bl, y + h); if (bl) g.lineTo(x, y + h - bl);
  g.lineTo(x, y + tl); if (tl) g.lineTo(x + tl, y); g.closePath();
}
const inset = (cut, r) => Object.fromEntries(Object.entries(cut).map(([k, v]) => [k, v ? Math.max(2, v - r * 0.586) : 0]));

/* ───────── lighting / wear ───────── */
function bevel(W, H, shape, rule, steps) {
  const out = cv(W, H), o = out.getContext('2d');
  for (const { d, aHi, aLo, hi = '#fff1c8', lo = '#000' } of steps) {
    for (const [dx, dy, col, a] of [[d, d, hi, aHi], [-d, -d, lo, aLo]]) {
      if (!a) continue;
      const t = cv(W, H), g = t.getContext('2d');
      shape(g); g.fillStyle = col; g.fill(rule);
      g.globalCompositeOperation = 'destination-out'; g.save(); g.translate(dx, dy); shape(g); g.fillStyle = '#000'; g.fill(rule); g.restore();
      o.globalAlpha = a; o.drawImage(t, 0, 0);
    }
  }
  o.globalAlpha = 1; return out;
}
function edgeWear(c, shape, rule, { width = 5, color = '#d9d0bd', alpha = .85, thr0 = .5, thr1 = .78, ox = 0, oy = 0, scale = 1 } = {}) {
  const W = c.width, H = c.height;
  const band = cv(W, H), b = band.getContext('2d');
  b.save(); shape(b); b.clip(rule); shape(b); b.lineWidth = width * 2; b.strokeStyle = '#fff'; b.stroke(); b.restore();
  const n = cv(W, H), ng = n.getContext('2d');
  ng.drawImage(T.gunmetal_scuffed, ox, oy, W / scale, H / scale, 0, 0, W, H);
  const id = ng.getImageData(0, 0, W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const L = (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) / 255; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = clamp((L - thr0) / (thr1 - thr0)) * 255; }
  ng.putImageData(id, 0, 0);
  b.globalCompositeOperation = 'destination-in'; b.drawImage(n, 0, 0);
  b.globalCompositeOperation = 'source-in'; b.fillStyle = color; b.fillRect(0, 0, W, H);
  const g = c.getContext('2d'); g.globalAlpha = alpha; g.drawImage(band, 0, 0); g.globalAlpha = 1;
}
function paintTexture(g, W, H, tex, ox = 0, oy = 0, scale = 1) {
  g.save(); g.translate(-ox, -oy); g.scale(scale, scale);
  g.fillStyle = g.createPattern(tex, 'repeat'); g.fillRect(ox / scale, oy / scale, W / scale + 2, H / scale + 2); g.restore();
}
function rivet(g, x, y, r) {
  g.save();
  g.beginPath(); g.arc(x + r * .18, y + r * .24, r * 1.08, 0, 7); g.fillStyle = 'rgba(0,0,0,.55)'; g.fill();
  const rg = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  rg.addColorStop(0, '#f1e3b4'); rg.addColorStop(.45, '#a37a38'); rg.addColorStop(1, '#241a0c');
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = rg; g.fill();
  g.lineWidth = Math.max(1, r * .16); g.strokeStyle = 'rgba(0,0,0,.6)'; g.stroke(); g.restore();
}
function keyMagenta(im, pad = 6) {
  const W = im.width, H = im.height; const c = cv(W, H), g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const id = g.getImageData(0, 0, W, H), d = id.data; let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; const r = d[i], gg = d[i + 1], b = d[i + 2];
    const m = Math.min(r, b) - gg; const a = 1 - clamp((m - 55) / 90);
    if (a > 0) { const sp = Math.max(0, Math.min(r, b) - gg); d[i] = r - sp * .9; d[i + 2] = b - sp * .9; }
    d[i + 3] = a * 255;
    if (a > .15) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  g.putImageData(id, 0, 0);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  return crop(c, x0, y0, x1 - x0, y1 - y0);
}

/* ───────── materials (graded for UI use) ───────── */
const goldTex = grade(crop(T.gold_leaf_worn, 0, 0, 1024, 1024), { gain: 1.22, gamma: .92, sat: 1.08 });
const goldDim = grade(crop(T.gold_leaf_worn, 0, 0, 1024, 1024), { gain: .78, gamma: 1.0, sat: .9 });
const goldCryo = gradMap(crop(T.gold_leaf_worn, 0, 0, 1024, 1024), CRYO);
const steelTex = grade(crop(T.gunmetal_scuffed, 0, 0, 1024, 1024), { gain: 1.02, gamma: 1.0, sat: .95 });
const steelDark = grade(crop(T.gunmetal_scuffed, 0, 0, 1024, 1024), { gain: .42, gamma: 1.05, sat: .9 });
const hazardTex = grade(crop(T.rust_hazard, 0, 0, 1024, 1024), { gain: .8, gamma: 1.0, sat: .85 });
const emberTex = crop(T.ember_fissures, 0, 0, 1024, 1024);
const emberCryo = gradMap(crop(T.ember_fissures, 0, 0, 1024, 1024), CRYO_EMBER);

const padlock = keyMagenta(padRaw, 6);
const cornerPiece = keyMagenta(cornerRaw, 4);

/* ───────── 1. CARD FRAMES (9-slice: 192² source, slice 64) ───────── */
const S = 192;
const FRAME = {
  idle:   { ring: 15, cut: { tl: 54, br: 54 }, tex: steelTex, wearTex: 1, line: [214, 168, 82], lineA: .55, lugs: false, glow: null },
  p1:     { ring: 28, cut: { tl: 54, br: 54 }, tex: goldTex, line: [255, 148, 31], lineA: 1, lugs: true, glow: [255, 148, 31] },
  p2:     { ring: 28, cut: { tl: 54, br: 54 }, tex: goldCryo, line: [92, 214, 255], lineA: 1, lugs: true, glow: [72, 190, 255] },
  locked: { ring: 24, cut: { tl: 46, tr: 46, br: 46, bl: 46 }, tex: hazardTex, line: [120, 70, 40], lineA: .7, lugs: false, glow: null, rivets: true },
};
function buildFrame(kind) {
  const f = FRAME[kind]; const c = cv(S, S), g = c.getContext('2d');
  const outer = (q) => chamfer(q, 0, 0, S, S, f.cut);
  const ringPath = (q) => { chamfer(q, 0, 0, S, S, f.cut); chamfer(q, f.ring, f.ring, S - f.ring * 2, S - f.ring * 2, inset(f.cut, f.ring), false); };
  const innerPath = (q) => chamfer(q, f.ring, f.ring, S - f.ring * 2, S - f.ring * 2, inset(f.cut, f.ring));
  // iron underlay + material
  ringPath(g); g.fillStyle = '#0b0a09'; g.fill('evenodd');
  g.save(); ringPath(g); g.clip('evenodd');
  paintTexture(g, S, S, f.tex, 200 + (kind.length * 77) % 400, 120 + (kind.length * 131) % 500, kind === 'idle' ? .9 : 1.1);
  g.restore();
  // bevel: light TL / shadow BR on both the outer and the inner wall
  const bv = bevel(S, S, ringPath, 'evenodd', [{ d: 2, aHi: .85, aLo: .75 }, { d: 4, aHi: .35, aLo: .4 }, { d: 7, aHi: .14, aLo: .22 }]);
  g.drawImage(bv, 0, 0);
  edgeWear(g.canvas, ringPath, 'evenodd', { width: kind === 'idle' ? 3 : 5, color: kind === 'p2' ? '#cfe9f5' : '#e6dcc4', alpha: .85, ox: 80 * kind.length, oy: 40 * kind.length, scale: 1.3 });
  // cavity shadow: the ring casts into the card well
  g.save(); innerPath(g); g.clip();
  for (let k = 1; k <= 18; k++) { innerPath(g); g.lineWidth = k * 2; g.strokeStyle = 'rgba(0,0,0,.05)'; g.stroke(); }
  g.restore();
  // inner hairline (ember / cryo / brass)
  if (f.line) {
    g.save(); innerPath(g); g.clip();
    const [lr, lg, lb] = f.line;
    if (f.glow) for (const [w, a] of [[9, .1], [6, .16], [3.4, .3]]) { innerPath(g); g.lineWidth = w; g.strokeStyle = `rgba(${lr},${lg},${lb},${a})`; g.stroke(); }
    innerPath(g); g.lineWidth = f.glow ? 1.6 : 1.4; g.strokeStyle = `rgba(${lr},${lg},${lb},${f.lineA})`; g.stroke();
    g.restore();
  }
  // corner lugs on the two square corners of selected cards
  if (f.lugs) {
    const lugS = 66, k = lugS / cornerPiece.width; const lw = cornerPiece.width * k, lh = cornerPiece.height * k;
    const put = (sx, sy, tx, ty) => { g.save(); g.translate(tx, ty); g.scale(sx, sy); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 5; g.shadowOffsetX = 1.5 * sx; g.shadowOffsetY = 2; g.drawImage(cornerPiece, 0, 0, lw, lh); g.restore(); };
    put(-1, 1, S - 1, 1);   // TR
    put(1, -1, 1, S - 1);   // BL
  }
  if (f.rivets) for (const [x, y] of [[S - 15, 17], [17, S - 15]]) rivet(g, x, y, 5.5);
  if (f.rivets) { // sealed plates: second pair of rivets on the chamfers
    rivet(g, 34, 34, 4.6); rivet(g, S - 34, S - 34, 4.6); rivet(g, S - 34, 34, 4.6); rivet(g, 34, S - 34, 4.6);
  }
  return c;
}

/* ───────── 2. BUTTON PLATES (cap-L / mid / cap-R) ───────── */
function buildPlate({ W, H, cut, ring, bezel, bezelDark, well, glowTex, glowGain, lineColor, wearColor, texOff = [0, 0] }) {
  const c = cv(W, H), g = c.getContext('2d');
  const ringPath = (q) => { chamfer(q, 0, 0, W, H, cut); chamfer(q, ring, ring, W - ring * 2, H - ring * 2, inset(cut, ring), false); };
  const innerPath = (q) => chamfer(q, ring, ring, W - ring * 2, H - ring * 2, inset(cut, ring));
  // bezel
  ringPath(g); g.fillStyle = bezelDark; g.fill('evenodd');
  g.save(); ringPath(g); g.clip('evenodd'); paintTexture(g, W, H, bezel, texOff[0], texOff[1], 1); g.restore();
  // well
  g.save(); innerPath(g); g.clip();
  g.fillStyle = well; g.fillRect(0, 0, W, H);
  if (glowTex) {
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = glowGain;
    paintTexture(g, W, H, glowTex, 300 + texOff[0], 500 + texOff[1], 1.0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // keep the text lane calm: dark centre scrim, glow survives toward the bezel + bottom
    const lg = g.createLinearGradient(0, ring, 0, H - ring);
    lg.addColorStop(0, 'rgba(0,0,0,.62)'); lg.addColorStop(.55, 'rgba(0,0,0,.42)'); lg.addColorStop(1, 'rgba(0,0,0,.05)');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
  }
  g.restore();
  // bevel on the bezel, inset shadow on the well
  g.drawImage(bevel(W, H, ringPath, 'evenodd', [{ d: 2, aHi: .9, aLo: .8 }, { d: 5, aHi: .32, aLo: .4 }, { d: 9, aHi: .12, aLo: .22 }]), 0, 0);
  g.drawImage(bevel(W, H, innerPath, 'nonzero', [{ d: 3, aHi: 0, aLo: 0 }]), 0, 0);
  g.save(); innerPath(g); g.clip();
  for (let k = 1; k <= 14; k++) { innerPath(g); g.lineWidth = k * 2; g.strokeStyle = 'rgba(0,0,0,.065)'; g.stroke(); }
  g.restore();
  if (lineColor) { g.save(); innerPath(g); g.clip(); innerPath(g); g.lineWidth = 2; g.strokeStyle = lineColor; g.stroke(); g.restore(); }
  edgeWear(c, ringPath, 'evenodd', { width: 6, color: wearColor, alpha: .8, ox: 120 + texOff[0], oy: 60 + texOff[1], scale: 1.1 });
  // soft top sheen on the bezel (light from above)
  g.save(); ringPath(g); g.clip('evenodd');
  const sh = g.createLinearGradient(0, 0, 0, H * .5); sh.addColorStop(0, 'rgba(255,248,226,.2)'); sh.addColorStop(1, 'rgba(255,248,226,0)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H * .5); g.restore();
  return c;
}
// plates are consumed through CSS border-image (slice = cap width, `fill` centre) so one file per button
async function savePlate(name, c) { await save(`${name}.webp`, c, 92); }

/* ───────── 3. TILES / RAILS / ICONS ───────── */
function buildRail() {
  const W = 512, H = 40; const c = cv(W, H), g = c.getContext('2d');
  g.fillStyle = '#0b0a09'; g.fillRect(0, 0, W, H);
  paintTexture(g, W, H, goldTex, 240, 360, 1.0);
  const sh = g.createLinearGradient(0, 0, 0, H);
  sh.addColorStop(0, 'rgba(255,244,206,.62)'); sh.addColorStop(.18, 'rgba(255,230,160,.12)'); sh.addColorStop(.5, 'rgba(0,0,0,.08)'); sh.addColorStop(.86, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,.85)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,248,226,.8)'; g.fillRect(0, 0, W, 2);
  return c;
}
const tiles = {
  tile_obsidian: () => { const raw = mirror4(crop(T.obsidian_scratch, 380, 300, 256, 256)); return grade(raw, { gain: 0.085 / Math.max(+rubStat(raw), 0.01), gamma: 1.12 }); },
  tile_gunmetal: () => grade(mirror4(crop(steelDark, 200, 420, 256, 256)), { gain: 1.0 }),
  tile_hazard: () => mirror4(crop(hazardTex, 300, 300, 80, 80)),
  tile_ember: () => mirror4(crop(emberTex, 250, 250, 256, 256)),
  tile_ember_cryo: () => mirror4(crop(emberCryo, 250, 250, 256, 256)),
  tile_gold: () => mirror4(crop(goldTex, 420, 420, 64, 64)),
  tile_gold_cryo: () => mirror4(crop(goldCryo, 420, 420, 64, 64)),
};

/* ───────── run ───────── */
for (const k of Object.keys(FRAME)) await save(`frame_${k}.webp`, buildFrame(k), 92);

const GOLD_PLATE = buildPlate({ W: 1024, H: 160, cut: { tl: 54, br: 54, tr: 18, bl: 18 }, ring: 24, bezel: goldTex, bezelDark: '#0b0a09', well: '#0a0806', glowTex: emberTex, glowGain: .95, lineColor: 'rgba(255,170,60,.55)', wearColor: '#f2e6c4', texOff: [100, 80] });
const CRYO_PLATE = buildPlate({ W: 1024, H: 160, cut: { tl: 54, br: 54, tr: 18, bl: 18 }, ring: 24, bezel: goldCryo, bezelDark: '#070b10', well: '#04080c', glowTex: emberCryo, glowGain: .95, lineColor: 'rgba(110,214,255,.6)', wearColor: '#e0f2fb', texOff: [100, 80] });
const STEEL_PLATE = buildPlate({ W: 768, H: 96, cut: { tl: 30, br: 30, tr: 10, bl: 10 }, ring: 13, bezel: steelTex, bezelDark: '#0a0b0c', well: '#0b0c0e', glowTex: null, lineColor: 'rgba(214,168,82,.5)', wearColor: '#e4ddcc', texOff: [260, 140] });
await savePlate('btn_lock_gold', GOLD_PLATE);
await savePlate('btn_lock_cryo', CRYO_PLATE);
await savePlate('btn_steel', STEEL_PLATE);

await save('rail_brass.webp', buildRail(), 90);
for (const [n, fn] of Object.entries(tiles)) { const t = fn(); await save(`${n}.webp`, t, n === 'tile_obsidian' || n === 'tile_gunmetal' ? 86 : 90); if (n.startsWith('tile_obs') || n.startsWith('tile_gun')) console.log(n, 'mean lum', rubStat(t)); }

// padlock icon (keyed) – 2 sizes of the same raster
{ const k = 160 / Math.max(padlock.width, padlock.height); const c = cv(Math.round(padlock.width * k), Math.round(padlock.height * k)); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(padlock, 0, 0, c.width, c.height); await save('icon_padlock.webp', c, 92); }
// corner guard (keyed) – kept standalone for reuse
{ const k = 128 / Math.max(cornerPiece.width, cornerPiece.height); const c = cv(Math.round(cornerPiece.width * k), Math.round(cornerPiece.height * k)); c.getContext('2d').drawImage(cornerPiece, 0, 0, c.width, c.height); await save('ornament_corner_gold.webp', c, 92); }

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ generatedBy: 'tools/buildApexMaterialChrome.mjs', files: written }, null, 2));
console.log('wrote', written.length, 'files →', path.relative(ROOT, OUT));

/* ───────── optional contact sheet for review ───────── */
if (process.argv.includes('--preview')) {
  const sheet = cv(1700, 1000), s = sheet.getContext('2d');
  s.fillStyle = '#2a2420'; s.fillRect(0, 0, 1700, 1000);
  let x = 20; for (const k of Object.keys(FRAME)) { s.drawImage(buildFrame(k), x, 20); x += 215; }
  s.fillStyle = '#6a3a1a'; s.fillRect(900, 20, 780, 192);
  s.drawImage(GOLD_PLATE, 910, 30, 512, 80); s.drawImage(CRYO_PLATE, 910, 120, 512, 80);
  s.drawImage(STEEL_PLATE, 1430, 30, 240, 30); s.drawImage(buildRail(), 1430, 80, 240, 16);
  s.drawImage(padlock, 1430, 110, 80, 80);
  let tx = 20; for (const [n, fn] of Object.entries(tiles)) { const t = fn(); s.drawImage(t, tx, 250, 200, 200); tx += 215; if (tx > 1500) break; }
  // fake card + button composites at 2x so detail can be judged
  s.drawImage(GOLD_PLATE, 20, 480, 1024, 160); s.drawImage(STEEL_PLATE, 20, 660, 768, 96); s.drawImage(buildFrame('p1'), 900, 480);
  fs.writeFileSync(path.join(ROOT, '..', 'qa', 'work', 'sprites_preview.png'), await sheet.encode('png'));
}
