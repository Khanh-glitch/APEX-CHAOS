import { createNoise2D } from "simplex-noise";
import { catmull, clamp, distSeg, mulberry32, resample, signedDist, smoothstep } from "./geom";
import type { Pt, Project, Terrain } from "./types";

const noiseCache = new Map<number, (x: number, y: number) => number>();
export function noise2(seed: number) {
  let n = noiseCache.get(seed);
  if (!n) { n = createNoise2D(mulberry32(seed)); noiseCache.set(seed, n); }
  return n;
}
export function fbm(n: (x: number, y: number) => number, x: number, y: number, oct = 4, lac = 2, g = 0.5) {
  let a = 1, f = 1, s = 0, m = 0;
  for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); m += a; a *= g; f *= lac; }
  return s / m;
}

export function emptyTerrain(gw: number, gh: number, cell: number, seed: number): Terrain {
  return { gw, gh, cell, elev: new Uint8Array(gw * gh), biome: new Uint8Array(gw * gh), seed };
}
export function sampleGrid(t: { gw: number; gh: number; cell: number }, arr: ArrayLike<number>, x: number, y: number, scale = 1): number {
  const fx = x / t.cell - 0.5, fy = y / t.cell - 0.5;
  const i0 = clamp(Math.floor(fx), 0, t.gw - 1), j0 = clamp(Math.floor(fy), 0, t.gh - 1);
  const i1 = Math.min(i0 + 1, t.gw - 1), j1 = Math.min(j0 + 1, t.gh - 1);
  const tx = clamp(fx - i0, 0, 1), ty = clamp(fy - j0, 0, 1);
  const a = arr[j0 * t.gw + i0], b = arr[j0 * t.gw + i1], c = arr[j1 * t.gw + i0], d = arr[j1 * t.gw + i1];
  return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) * scale;
}
export const elevAt = (p: Project, x: number, y: number) => sampleGrid(p.terrain, p.terrain.elev, x, y, 1 / 255);
/** Relative steepness index (elevation units per world unit × 100). Heuristic scale, not a Bible value. */
export function slopeAt(p: Project, x: number, y: number): number {
  const h = 8;
  const dx = (elevAt(p, x + h, y) - elevAt(p, x - h, y)) / (2 * h);
  const dy = (elevAt(p, x, y + h) - elevAt(p, x, y - h)) / (2 * h);
  return Math.hypot(dx, dy) * 100;
}
export function biomeAt(p: Project, x: number, y: number): number {
  const t = p.terrain;
  const i = clamp(Math.floor(x / t.cell), 0, t.gw - 1), j = clamp(Math.floor(y / t.cell), 0, t.gh - 1);
  return t.biome[j * t.gw + i];
}

export function maskFromDraw(gw: number, gh: number, cell: number, fn: (g: CanvasRenderingContext2D) => void): Uint8Array {
  const c = document.createElement("canvas");
  c.width = gw; c.height = gh;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#000"; g.fillRect(0, 0, gw, gh);
  g.scale(1 / cell, 1 / cell);
  g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.lineJoin = "round"; g.lineCap = "round";
  fn(g);
  const d = g.getImageData(0, 0, gw, gh).data;
  const out = new Uint8Array(gw * gh);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] > 110 ? 1 : 0;
  return out;
}
export function landMask(p: Project): Uint8Array {
  const t = p.terrain;
  return maskFromDraw(t.gw, t.gh, t.cell, (g) => {
    for (const l of p.land) {
      g.beginPath();
      for (const r of l.rings) { r.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); }
      g.fill("evenodd");
    }
  });
}
export function lakeMask(p: Project): Uint8Array {
  const t = p.terrain;
  return maskFromDraw(t.gw, t.gh, t.cell, (g) => {
    for (const l of p.lakes) { g.beginPath(); l.ring.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); }
  });
}
export function riverMask(p: Project): Uint8Array {
  const t = p.terrain;
  return maskFromDraw(t.gw, t.gh, t.cell, (g) => {
    for (const r of p.rivers) {
      const s = catmull(r.points).pts;
      g.lineWidth = Math.max(r.width, 9);
      g.beginPath(); s.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke();
    }
  });
}
/** Chamfer distance transform: distance (world units) from every cell to the nearest source cell (src != 0). */
export function chamfer(src: Uint8Array, gw: number, gh: number, cell: number): Float32Array {
  const INF = 1e9, d = new Float32Array(gw * gh);
  for (let i = 0; i < d.length; i++) d[i] = src[i] ? 0 : INF;
  const W1 = 1, W2 = Math.SQRT2;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + W1);
    if (j > 0) { v = Math.min(v, d[k - gw] + W1); if (i > 0) v = Math.min(v, d[k - gw - 1] + W2); if (i < gw - 1) v = Math.min(v, d[k - gw + 1] + W2); }
    d[k] = v;
  }
  for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) {
    const k = j * gw + i; let v = d[k];
    if (i < gw - 1) v = Math.min(v, d[k + 1] + W1);
    if (j < gh - 1) { v = Math.min(v, d[k + gw] + W1); if (i < gw - 1) v = Math.min(v, d[k + gw + 1] + W2); if (i > 0) v = Math.min(v, d[k + gw - 1] + W2); }
    d[k] = v;
  }
  for (let i = 0; i < d.length; i++) d[i] = d[i] >= INF ? 99999 : d[i] * cell;
  return d;
}

// ---------------- terrain generation from an authored feature spec ----------------
export type Feat =
  | { t: "dome"; c: Pt; r: number; h: number; p?: number }
  | { t: "ridge"; pts: Pt[]; w: number; h: number }
  | { t: "basin"; c: Pt; r: number; h: number }
  | { t: "rugged"; c: Pt; r: number; amp: number };
export interface BiomeStamp { ring: Pt[]; biome: number; noise: number; }
export interface GenSpec { seed: number; feats: Feat[]; stamps: BiomeStamp[]; dry: { c: Pt; r: number; k: number }[]; }

const soft = (e: number) => (e < 0.75 ? e : 0.75 + 0.25 * (1 - Math.exp(-(e - 0.75) * 4)));

export function classify(e: number, slope: number, moist: number, dc: number, dw: number, n: number): number {
  if (dc < 13 && e < 0.1) return 11;
  if (e > 0.8) return 8;
  if (e > 0.6 || slope > 1.05) return 7;
  if (e < 0.12 && dw < 30 && moist > 0.5 + n * 0.1) return 4;
  if (e > 0.42 && moist > 0.32) return 3;
  if (moist > 0.56 + n * 0.08) return 1;
  if (moist < 0.3 + n * 0.06) return 6;
  return 0;
}
export function moistureField(p: Project, dw: Float32Array, dry: GenSpec["dry"], seed: number): Float32Array {
  const t = p.terrain, n = noise2(seed + 7), out = new Float32Array(t.gw * t.gh);
  for (let j = 0; j < t.gh; j++) for (let i = 0; i < t.gw; i++) {
    const x = (i + 0.5) * t.cell, y = (j + 0.5) * t.cell, k = j * t.gw + i;
    let m = 0.2 + 0.5 * Math.exp(-dw[k] / 110) + 0.18 * (fbm(n, x / 330, y / 330, 3) * 0.5 + 0.5);
    for (const d of dry) { const q = Math.hypot(x - d.c[0], y - d.c[1]) / d.r; m -= d.k * Math.exp(-q * q); }
    out[k] = clamp(m, 0, 1);
  }
  return out;
}

export function carveHydrology(p: Project) {
  const t = p.terrain;
  const e = new Float32Array(t.elev.length);
  for (let i = 0; i < e.length; i++) e[i] = t.elev[i] / 255;
  const at = (x: number, y: number) => sampleGrid(t, e, x, y);
  const carve = (x: number, y: number, bed: number, R: number, a: number) => {
    const i0 = Math.max(0, Math.floor((x - R) / t.cell)), i1 = Math.min(t.gw - 1, Math.ceil((x + R) / t.cell));
    const j0 = Math.max(0, Math.floor((y - R) / t.cell)), j1 = Math.min(t.gh - 1, Math.ceil((y + R) / t.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot((i + 0.5) * t.cell - x, (j + 0.5) * t.cell - y);
      if (d > R) continue;
      const k = j * t.gw + i;
      const target = bed + a * Math.pow(d / R, 1.5);
      if (e[k] > target) e[k] = target;
    }
  };
  const lakeLevel: Record<string, number> = {};
  for (const lk of p.lakes) {
    let mn = 1, c = 0;
    const xs = lk.ring.map((q) => q[0]), ys = lk.ring.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let y = y0; y <= y1; y += 6) for (let x = x0; x <= x1; x += 6) {
      let inside = false;
      for (let a = 0, b = lk.ring.length - 1; a < lk.ring.length; b = a++) {
        const xi = lk.ring[a][0], yi = lk.ring[a][1], xj = lk.ring[b][0], yj = lk.ring[b][1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) { mn = Math.min(mn, at(x, y)); c++; }
    }
    const level = Math.max(0.05, (c ? mn : 0.2) - 0.004);
    lakeLevel[lk.id] = level;
    for (let y = y0 - 18; y <= y1 + 18; y += 5) for (let x = x0 - 18; x <= x1 + 18; x += 5) {
      const sd = signedDist([x, y], lk.ring);
      if (sd < 0) carve(x, y, level, 6, 0);
      else if (sd < 18) carve(x, y, level + 0.02, 7, 0.05 * (sd / 18));
    }
  }
  for (const rv of p.rivers) {
    const S = resample(catmull(rv.points).pts, 6).pts;
    if (S.length < 2) continue;
    const terr = S.map((q) => at(q[0], q[1]));
    const bed = new Array<number>(S.length);
    const eps = rv.kind === "canal" ? 0.0003 : 0.0005;
    bed[0] = terr[0];
    for (let k = 1; k < S.length; k++) bed[k] = Math.min(bed[k - 1] - eps, terr[k]);
    let endE: number | null = null;
    if (rv.mouth.kind === "lake" && rv.mouth.ref && lakeLevel[rv.mouth.ref] !== undefined) endE = lakeLevel[rv.mouth.ref];
    else if (rv.mouth.kind === "river") endE = at(S[S.length - 1][0], S[S.length - 1][1]);
    else if (rv.mouth.kind === "sea") endE = 0.03;
    if (endE !== null) {
      const n0 = Math.floor(S.length * 0.8);
      for (let k = n0; k < S.length; k++) bed[k] = Math.min(bed[k], 1) * (1 - (k - n0) / (S.length - n0)) + endE * ((k - n0) / (S.length - n0));
      for (let k = 1; k < S.length; k++) bed[k] = Math.min(bed[k], bed[k - 1]);
    }
    const R = rv.kind === "canal" ? 16 : Math.max(20, rv.width * 4);
    const a = rv.kind === "canal" ? 0.05 : 0.22;
    for (let k = 0; k < S.length; k++) carve(S[k][0], S[k][1], Math.max(0.02, bed[k]), R, a);
  }
  for (let i = 0; i < e.length; i++) if (t.elev[i] > 0) t.elev[i] = Math.max(1, Math.round(clamp(e[i], 0, 1) * 255));
}

export function generateTerrain(p: Project, spec: GenSpec) {
  const t = p.terrain;
  const mask = landMask(p);
  const sea = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) sea[i] = mask[i] ? 0 : 1;
  const dc = chamfer(sea, t.gw, t.gh, t.cell);
  const n1 = noise2(spec.seed), n2 = noise2(spec.seed + 101);
  for (let j = 0; j < t.gh; j++) for (let i = 0; i < t.gw; i++) {
    const k = j * t.gw + i;
    if (!mask[k]) { t.elev[k] = 0; continue; }
    const x = (i + 0.5) * t.cell, y = (j + 0.5) * t.cell;
    let e = 0.05 + 0.2 * Math.pow(smoothstep(0, 240, dc[k]), 0.9);
    for (const f of spec.feats) {
      if (f.t === "dome" || f.t === "basin") {
        const d = Math.hypot(x - f.c[0], y - f.c[1]) / f.r;
        if (d < 1) { const v = f.h * Math.pow(1 - d * d, f.t === "dome" ? f.p ?? 1.5 : 1.3); e += f.t === "dome" ? v : -v; }
      } else if (f.t === "ridge") {
        let d = 1e9;
        for (let s = 0; s < f.pts.length - 1; s++) d = Math.min(d, distSeg([x, y], f.pts[s], f.pts[s + 1]));
        if (d < f.w) { const q = d / f.w; e += f.h * Math.pow(1 - q * q, 1.5) * (0.8 + 0.4 * (fbm(n2, x / 140, y / 140, 2) * 0.5 + 0.5)); }
      } else {
        const d = Math.hypot(x - f.c[0], y - f.c[1]) / f.r;
        if (d < 1) { const rn = 1 - Math.abs(fbm(n2, x / 48, y / 48, 3)); e += f.amp * Math.pow(1 - d, 1.1) * (rn * rn - 0.45); }
      }
    }
    e += fbm(n1, x / 240, y / 240, 4) * 0.055 * (0.6 + e);
    t.elev[k] = Math.max(1, Math.round(clamp(soft(Math.max(0.02, e)), 0, 1) * 255));
  }
  carveHydrology(p);
  const wm = new Uint8Array(mask.length), lm = lakeMask(p), rm = riverMask(p);
  for (let i = 0; i < wm.length; i++) wm[i] = lm[i] | rm[i];
  const dw = chamfer(wm, t.gw, t.gh, t.cell);
  const moist = moistureField(p, dw, spec.dry, spec.seed);
  const ns = noise2(spec.seed + 55);
  for (let j = 0; j < t.gh; j++) for (let i = 0; i < t.gw; i++) {
    const k = j * t.gw + i;
    if (!mask[k]) { t.biome[k] = 0; continue; }
    const x = (i + 0.5) * t.cell, y = (j + 0.5) * t.cell;
    const n = fbm(ns, x / 90, y / 90, 3);
    t.biome[k] = classify(t.elev[k] / 255, slopeAt(p, x, y), moist[k], dc[k], dw[k], n);
  }
  modeFilter(t, mask, 2);
  for (const s of spec.stamps) {
    const xs = s.ring.map((q) => q[0]), ys = s.ring.map((q) => q[1]);
    const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 60, y0 = Math.min(...ys) - 60, y1 = Math.max(...ys) + 60;
    for (let j = Math.max(0, Math.floor(y0 / t.cell)); j <= Math.min(t.gh - 1, Math.ceil(y1 / t.cell)); j++)
      for (let i = Math.max(0, Math.floor(x0 / t.cell)); i <= Math.min(t.gw - 1, Math.ceil(x1 / t.cell)); i++) {
        const k = j * t.gw + i;
        if (!mask[k]) continue;
        const x = (i + 0.5) * t.cell, y = (j + 0.5) * t.cell;
        if (signedDist([x, y], s.ring) + fbm(ns, x / 55, y / 55, 3) * s.noise < 0) t.biome[k] = s.biome;
      }
  }
}

function modeFilter(t: Terrain, mask: Uint8Array, passes: number) {
  const tmp = new Uint8Array(t.biome.length);
  for (let pass = 0; pass < passes; pass++) {
    tmp.set(t.biome);
    for (let j = 1; j < t.gh - 1; j++) for (let i = 1; i < t.gw - 1; i++) {
      const k = j * t.gw + i;
      if (!mask[k]) continue;
      const cnt = new Uint8Array(16);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = (j + dj) * t.gw + i + di; if (mask[q]) cnt[t.biome[q]]++; }
      let best = t.biome[k];
      for (let b = 0; b < 12; b++) if (cnt[b] > cnt[best]) best = b;
      tmp[k] = best;
    }
    t.biome.set(tmp);
  }
}

/** Local terrain-detail regeneration inside a rectangle (keeps river beds / lakes / protected biomes). */
export function regenRegion(p: Project, rect: [number, number, number, number], seed: number, amp = 0.06) {
  const t = p.terrain, n = noise2(seed), mask = landMask(p);
  const lm = lakeMask(p), rm = riverMask(p);
  const wm = new Uint8Array(mask.length);
  for (let i = 0; i < wm.length; i++) wm[i] = lm[i] | rm[i];
  const dw = chamfer(wm, t.gw, t.gh, t.cell);
  const sea = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) sea[i] = mask[i] ? 0 : 1;
  const dc = chamfer(sea, t.gw, t.gh, t.cell);
  const moist = moistureField(p, dw, [], t.seed);
  const prot = new Set([2, 5, 9, 10, 8]);
  const ns = noise2(seed + 3);
  for (let j = Math.max(0, Math.floor(rect[1] / t.cell)); j <= Math.min(t.gh - 1, Math.ceil(rect[3] / t.cell)); j++)
    for (let i = Math.max(0, Math.floor(rect[0] / t.cell)); i <= Math.min(t.gw - 1, Math.ceil(rect[2] / t.cell)); i++) {
      const k = j * t.gw + i;
      if (!mask[k]) continue;
      const x = (i + 0.5) * t.cell, y = (j + 0.5) * t.cell;
      const edge = Math.min(x - rect[0], rect[2] - x, y - rect[1], rect[3] - y);
      const w = smoothstep(0, 40, edge) * smoothstep(8, 40, dw[k]);
      const e = t.elev[k] / 255 + fbm(n, x / 120, y / 120, 4) * amp * w;
      t.elev[k] = Math.max(1, Math.round(clamp(e, 0.02, 1) * 255));
      if (!prot.has(t.biome[k]) && w > 0.3) t.biome[k] = classify(t.elev[k] / 255, slopeAt(p, x, y), moist[k], dc[k], dw[k], fbm(ns, x / 90, y / 90, 3));
    }
}

/** After land edits: new land gets a low coastal elevation + beach/meadow biome. */
export function fixTerrainAfterLand(p: Project, before: Uint8Array) {
  const t = p.terrain, after = landMask(p), n = noise2(t.seed + 9);
  for (let j = 0; j < t.gh; j++) for (let i = 0; i < t.gw; i++) {
    const k = j * t.gw + i;
    if (after[k] && !before[k]) {
      const x = (i + 0.5) * t.cell, y = (j + 0.5) * t.cell;
      t.elev[k] = Math.round((0.07 + 0.03 * (n(x / 50, y / 50) * 0.5 + 0.5)) * 255);
      t.biome[k] = 11;
    } else if (!after[k] && before[k]) t.elev[k] = 0;
  }
}
