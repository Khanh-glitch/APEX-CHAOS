import polygonClipping from "polygon-clipping";
import type { Pt } from "./types";

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function bbox(pts: Pt[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of pts) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; }
  return [a, b, c, d];
}
export function polyArea(r: Pt[]): number {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return s / 2;
}
export function centroid(r: Pt[]): Pt {
  if (r.length === 0) return [0, 0];
  let x = 0, y = 0;
  for (const p of r) { x += p[0]; y += p[1]; }
  return [x / r.length, y / r.length];
}
export function pip(p: Pt, r: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function pipRings(p: Pt, rings: Pt[][]): boolean {
  let c = 0;
  for (const r of rings) if (pip(p, r)) c++;
  return c % 2 === 1;
}
export function distSeg(p: Pt, a: Pt, b: Pt): number {
  return dist(p, projSeg(p, a, b).pt);
}
export function projSeg(p: Pt, a: Pt, b: Pt): { pt: Pt; t: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = clamp(t, 0, 1);
  return { pt: [a[0] + dx * t, a[1] + dy * t], t };
}
export function nearestOnLine(pts: Pt[], p: Pt, closed = false): { pt: Pt; i: number; t: number; d: number } {
  let best = { pt: pts[0], i: 0, t: 0, d: Infinity };
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const pr = projSeg(p, a, b);
    const d = dist(p, pr.pt);
    if (d < best.d) best = { pt: pr.pt, i, t: pr.t, d };
  }
  return best;
}
export function lineLen(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}
export function ringDist(p: Pt, ring: Pt[]): number {
  return nearestOnLine(ring, p, true).d;
}
export function signedDist(p: Pt, ring: Pt[]): number {
  const d = ringDist(p, ring);
  return pip(p, ring) ? -d : d;
}

export function chaikin(pts: Pt[], iters = 1, closed = false): Pt[] {
  let cur = pts;
  for (let k = 0; k < iters; k++) {
    const out: Pt[] = [];
    const n = cur.length;
    const m = closed ? n : n - 1;
    if (!closed) out.push(cur[0]);
    for (let i = 0; i < m; i++) {
      const a = cur[i], b = cur[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) out.push(cur[n - 1]);
    cur = out;
  }
  return cur;
}

/** Catmull-Rom spline through control points. idx[k] = control segment index of sample k. */
export function catmull(pts: Pt[]): { pts: Pt[]; idx: number[] } {
  if (pts.length < 3) return { pts: pts.slice(), idx: pts.map((_, i) => Math.min(i, Math.max(0, pts.length - 2))) };
  const out: Pt[] = [];
  const idx: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const n = clamp(Math.ceil(dist(p1, p2) / 9), 2, 28);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
      idx.push(i);
    }
  }
  out.push(pts[pts.length - 1]);
  idx.push(pts.length - 2);
  return { pts: out, idx };
}
export const smoothLine = (pts: Pt[]) => catmull(pts).pts;

export function resample(pts: Pt[], step: number, idx?: number[]): { pts: Pt[]; idx: number[] } {
  if (pts.length < 2) return { pts: pts.slice(), idx: idx ? idx.slice() : [0] };
  const out: Pt[] = [pts[0]];
  const oidx: number[] = [idx ? idx[0] : 0];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = dist(a, b);
    if (seg === 0) continue;
    let pos = step - carry;
    while (pos <= seg) {
      const t = pos / seg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      oidx.push(idx ? idx[i - 1] : 0);
      pos += step;
    }
    carry = seg - (pos - step);
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > 0.01) { out.push(last); oidx.push(idx ? idx[idx.length - 1] : 0); }
  else out[out.length - 1] = last;
  return { pts: out, idx: oidx };
}

export function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let md = 0, mi = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distSeg(pts[i], pts[s], pts[e]);
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi >= 0) { keep[mi] = 1; stack.push([s, mi], [mi, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
export function rdpRing(r: Pt[], eps: number): Pt[] {
  if (r.length < 8) return r;
  const o = rdp([...r, r[0]], eps);
  o.pop();
  return o.length >= 3 ? o : r;
}

export function segInt(a: Pt, b: Pt, c: Pt, d: Pt): { p: Pt; t: number; u: number } | null {
  const r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1];
  const den = r0 * s1 - r1 * s0;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den;
  const u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { p: [a[0] + r0 * t, a[1] + r1 * t], t, u };
}
export function lineInts(A: Pt[], B: Pt[]): { p: Pt; i: number; j: number }[] {
  const out: { p: Pt; i: number; j: number }[] = [];
  const bb = bbox(B);
  for (let i = 0; i < A.length - 1; i++) {
    const a = A[i], b = A[i + 1];
    if (Math.max(a[0], b[0]) < bb[0] - 1 || Math.min(a[0], b[0]) > bb[2] + 1 || Math.max(a[1], b[1]) < bb[1] - 1 || Math.min(a[1], b[1]) > bb[3] + 1) continue;
    for (let j = 0; j < B.length - 1; j++) {
      const r = segInt(a, b, B[j], B[j + 1]);
      if (r) out.push({ p: r.p, i, j });
    }
  }
  return out;
}
export function circlePoly(c: Pt, r: number, n = 28): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
  return o;
}
export function offsetLine(pts: Pt[], d: number): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    o.push([pts[i][0] - (dy / l) * d, pts[i][1] + (dx / l) * d]);
  }
  return o;
}
export function translatePts(pts: Pt[], dx: number, dy: number): Pt[] {
  return pts.map((p) => [p[0] + dx, p[1] + dy] as Pt);
}
export function rotPt(p: Pt, c: Pt, a: number): Pt {
  const s = Math.sin(a), co = Math.cos(a);
  const x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * co - y * s, c[1] + x * s + y * co];
}

// ---- boolean polygon ops (polygon-clipping, MIT) ----
export type Poly = Pt[][];
const close = (r: Pt[]): [number, number][] => [...r.map((p) => [p[0], p[1]] as [number, number]), [r[0][0], r[0][1]]];
const toG = (m: Poly[]) => m.map((poly) => poly.map(close));
const fromG = (g: [number, number][][][]): Poly[] => g.map((poly) => poly.map((ring) => ring.slice(0, -1).map((p) => [p[0], p[1]] as Pt)));
export function clipUnion(a: Poly[], b: Poly[]): Poly[] {
  if (!a.length) return b;
  if (!b.length) return a;
  return fromG(polygonClipping.union(toG(a), toG(b)));
}
export function clipDiff(a: Poly[], b: Poly[]): Poly[] {
  if (!a.length || !b.length) return a;
  return fromG(polygonClipping.difference(toG(a), toG(b)));
}
export function ringsBBoxHit(rings: Pt[][], c: Pt, r: number): boolean {
  const bb = bbox(rings[0]);
  return !(c[0] + r < bb[0] || c[0] - r > bb[2] || c[1] + r < bb[1] || c[1] - r > bb[3]);
}
