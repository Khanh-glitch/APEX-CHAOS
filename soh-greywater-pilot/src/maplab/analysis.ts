import { chaikin, clamp, dist, nearestOnLine, rdp, catmull } from "./geom";
import { BIOMES, ARCHE_BY_ID } from "./types";
import type { Project, Pt } from "./types";
import { chamfer, elevAt, lakeMask, landMask, maskFromDraw, riverMask } from "./terrain";

// Heuristic constants of Map Lab (NOT Bible values; Bible §11.5 forbids invented km/minutes/prices).
export const RULES = {
  buildSlopeMax: 0.5,
  cartSlopeMax: 0.7,
  footSlopeMax: 1.5,
  spawnReach: 300, // effort units for basic resources from a spawn
  interiorDist: 110, // "interior" = farther than this from coast
  coastRim: 60,
};

export interface Fields {
  gw: number; gh: number; cell: number;
  land: Uint8Array; lake: Uint8Array; river: Uint8Array;
  elev: Float32Array; slope: Float32Array; biome: Uint8Array;
  dc: Float32Array; dw: Float32Array; dRoad: Float32Array;
  roadFoot: Uint8Array; roadCart: Uint8Array;
  penalty?: Float32Array; // optional cost multiplier (e.g. keep ordinary roads out of Elder cores)
}

export function rasterRoads(p: Project, f: Fields) {
  const g = f.gw * f.gh;
  f.roadFoot = maskFromDraw(f.gw, f.gh, f.cell, (c) => {
    c.lineWidth = 9;
    for (const r of p.roads) {
      if (r.kind === "ferry") continue;
      const s = catmull(r.points).pts;
      c.beginPath(); s.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
    }
  });
  f.roadCart = maskFromDraw(f.gw, f.gh, f.cell, (c) => {
    c.lineWidth = 9;
    for (const r of p.roads) {
      if (r.kind !== "cart") continue;
      const s = catmull(r.points).pts;
      c.beginPath(); s.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
    }
  });
  const any = new Uint8Array(g);
  for (let i = 0; i < g; i++) any[i] = f.roadFoot[i] | f.roadCart[i];
  f.dRoad = chamfer(any, f.gw, f.gh, f.cell);
}

export function computeFields(p: Project): Fields {
  const t = p.terrain, n = t.gw * t.gh;
  const land = landMask(p), lake = lakeMask(p), river = riverMask(p);
  const elev = new Float32Array(n);
  for (let i = 0; i < n; i++) elev[i] = t.elev[i] / 255;
  const slope = new Float32Array(n);
  for (let j = 0; j < t.gh; j++) for (let i = 0; i < t.gw; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(t.gw - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(t.gh - 1, j + 1);
    const dx = (elev[j * t.gw + i1] - elev[j * t.gw + i0]) / ((i1 - i0) * t.cell);
    const dy = (elev[j1 * t.gw + i] - elev[j0 * t.gw + i]) / ((j1 - j0) * t.cell);
    slope[j * t.gw + i] = Math.hypot(dx, dy) * 100;
  }
  const sea = new Uint8Array(n), wm = new Uint8Array(n);
  for (let i = 0; i < n; i++) { sea[i] = land[i] ? 0 : 1; wm[i] = lake[i] | river[i]; }
  const f: Fields = {
    gw: t.gw, gh: t.gh, cell: t.cell, land, lake, river, elev, slope, biome: t.biome,
    dc: chamfer(sea, t.gw, t.gh, t.cell), dw: chamfer(wm, t.gw, t.gh, t.cell),
    dRoad: new Float32Array(n), roadFoot: new Uint8Array(n), roadCart: new Uint8Array(n),
  };
  rasterRoads(p, f);
  return f;
}

const FOOT_B = [1, 1.2, 1.5, 1.15, 2.4, 1.25, 1.0, 1.7, 2.6, 1.6, 1.7, 1.05];
const CART_B = [1, 1.35, 1.8, 1.2, 3.2, 1.3, 1.05, 2.2, 99, 1.8, 2.2, 1.05];
export function stepMult(f: Fields, k: number, mode: "foot" | "cart"): number {
  if (!f.land[k] || f.lake[k]) return Infinity;
  const s = f.slope[k], b = f.biome[k];
  let m: number;
  if (mode === "cart") { if (s > RULES.cartSlopeMax) return Infinity; m = (1 + 7 * (s / 0.45) ** 2) * CART_B[b]; }
  else { if (s > RULES.footSlopeMax) return Infinity; m = (1 + 2.5 * (s / 0.6) ** 2) * FOOT_B[b]; }
  if (f.river[k]) m += mode === "cart" ? 80 : 50;
  if (f.penalty) m *= f.penalty[k];
  if (mode === "cart" && f.roadCart[k]) m *= 0.3;
  else if (mode === "foot") { if (f.roadCart[k]) m *= 0.3; else if (f.roadFoot[k]) m *= 0.4; }
  return m;
}

class Heap {
  k: number[] = []; v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    this.k.push(key); this.v.push(val);
    let i = this.k.length - 1;
    while (i > 0) { const pa = (i - 1) >> 1; if (this.k[pa] <= this.k[i]) break; this.swap(pa, i); i = pa; }
  }
  pop(): [number, number] {
    const rk = this.k[0], rv = this.v[0], lk = this.k.pop()!, lv = this.v.pop()!;
    if (this.k.length) {
      this.k[0] = lk; this.v[0] = lv;
      let i = 0;
      for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < this.k.length && this.k[l] < this.k[m]) m = l; if (r < this.k.length && this.k[r] < this.k[m]) m = r; if (m === i) break; this.swap(m, i); i = m; }
    }
    return [rk, rv];
  }
  swap(a: number, b: number) { [this.k[a], this.k[b]] = [this.k[b], this.k[a]]; [this.v[a], this.v[b]] = [this.v[b], this.v[a]]; }
}
const cellOf = (f: Fields, q: Pt) => clamp(Math.floor(q[1] / f.cell), 0, f.gh - 1) * f.gw + clamp(Math.floor(q[0] / f.cell), 0, f.gw - 1);
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function gridPath(f: Fields, a: Pt, b: Pt, mode: "foot" | "cart"): Pt[] | null {
  const n = f.gw * f.gh, s = cellOf(f, a), t = cellOf(f, b);
  const g = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const h = new Heap();
  g[s] = 0; h.push(0, s);
  const tx = t % f.gw, ty = Math.floor(t / f.gw);
  while (h.size) {
    const [, c] = h.pop();
    if (closed[c]) continue;
    closed[c] = 1;
    if (c === t) break;
    const cx = c % f.gw, cy = Math.floor(c / f.gw);
    for (const [dx, dy] of NB) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= f.gw || y >= f.gh) continue;
      const k = y * f.gw + x;
      if (closed[k]) continue;
      let m = stepMult(f, k, mode);
      if (k === t || k === s) m = Math.min(m, 3);
      if (!isFinite(m)) continue;
      const ng = g[c] + (dx && dy ? 1.414 : 1) * f.cell * m;
      if (ng < g[k]) { g[k] = ng; from[k] = c; h.push(ng + Math.hypot(x - tx, y - ty) * f.cell * 0.3, k); }
    }
  }
  if (from[t] < 0 && s !== t) return null;
  const path: Pt[] = [];
  for (let c = t; c >= 0; c = from[c]) { path.push([(c % f.gw + 0.5) * f.cell, (Math.floor(c / f.gw) + 0.5) * f.cell]); if (c === s) break; }
  path.reverse();
  path[0] = [a[0], a[1]];
  path[path.length - 1] = [b[0], b[1]];
  return path;
}

export function gridCost(f: Fields, src: Pt, mode: "foot" | "cart", maxCost: number): Float32Array {
  const n = f.gw * f.gh, d = new Float32Array(n).fill(Infinity), h = new Heap(), s = cellOf(f, src);
  d[s] = 0; h.push(0, s);
  while (h.size) {
    const [c0, c] = h.pop();
    if (c0 > d[c] || c0 > maxCost) continue;
    const cx = c % f.gw, cy = Math.floor(c / f.gw);
    for (const [dx, dy] of NB) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= f.gw || y >= f.gh) continue;
      const k = y * f.gw + x, m = stepMult(f, k, mode);
      if (!isFinite(m)) continue;
      const nd = d[c] + (dx && dy ? 1.414 : 1) * f.cell * m;
      if (nd < d[k]) { d[k] = nd; h.push(nd, k); }
    }
  }
  return d;
}
export const costAt = (f: Fields, d: Float32Array, q: Pt) => d[cellOf(f, q)];

/** Route a→b over terrain; the part that re-uses existing roads is trimmed so new roads join as T-junctions. */
export function routeRuns(f: Fields, a: Pt, b: Pt, mode: "foot" | "cart"): Pt[][] {
  const path = gridPath(f, a, b, mode);
  if (!path) return [];
  const net = (q: Pt) => { const k = cellOf(f, q); return mode === "cart" ? f.roadCart[k] === 1 : f.roadCart[k] === 1 || f.roadFoot[k] === 1; };
  const on = path.map((q, i) => (i === 0 || i === path.length - 1 ? false : net(q)));
  const runs: Pt[][] = [];
  let cur: number[] = [];
  const flush = () => {
    if (cur.length) {
      const s = Math.max(0, cur[0] - 1), e = Math.min(path.length - 1, cur[cur.length - 1] + 1);
      const pts = path.slice(s, e + 1);
      if (pts.length >= 2) runs.push(rdp(chaikin(pts, 2), 3.5));
      cur = [];
    }
  };
  for (let i = 0; i < path.length; i++) { if (!on[i]) cur.push(i); else flush(); }
  flush();
  return runs.filter((r) => r.length >= 2 && r.reduce((s, q, i) => (i ? s + dist(q, r[i - 1]) : 0), 0) > 12);
}
export function markRoad(f: Fields, pts: Pt[], kind: string) {
  const c = catmull(pts).pts;
  for (let i = 1; i < c.length; i++) {
    const L = dist(c[i - 1], c[i]);
    for (let s = 0; s <= L; s += 3) {
      const t = L ? s / L : 0, q: Pt = [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t];
      const k = cellOf(f, q);
      f.roadFoot[k] = 1;
      if (kind === "cart") f.roadCart[k] = 1;
    }
  }
}
export function snapToRoads(p: Project, q: Pt, tol: number): Pt {
  let best = q, bd = tol;
  for (const r of p.roads) {
    if (r.kind === "ferry") continue;
    const n = nearestOnLine(catmull(r.points).pts, q);
    if (n.d < bd) { bd = n.d; best = n.pt; }
  }
  return best;
}

// ---------- site profiles / house test ----------
export function nearestRes(p: Project, q: Pt, kind: string): { d: number; id: string } | null {
  let best: { d: number; id: string } | null = null;
  for (const r of p.resources) if (r.kind === kind) { const d = Math.max(0, dist(r.at, q) - r.r); if (!best || d < best.d) best = { d, id: r.id }; }
  for (const po of p.pois) if (po.resources.includes(kind)) { const d = dist(po.at, q); if (!best || d < best.d) best = { d, id: po.id }; }
  return best;
}
const BAD_BUILD = new Set([4, 8, 9, 10]);
export function buildable(f: Fields, q: Pt): { ok: boolean; why: string } {
  const k = cellOf(f, q);
  if (!f.land[k]) return { ok: false, why: "ngoài đất liền (biển)" };
  if (f.lake[k]) return { ok: false, why: "trên mặt hồ" };
  if (f.river[k]) return { ok: false, why: "trên lòng sông" };
  if (f.slope[k] > RULES.buildSlopeMax) return { ok: false, why: "độ dốc quá lớn (vách)" };
  if (BAD_BUILD.has(f.biome[k])) return { ok: false, why: "bề mặt không phù hợp: " + BIOMES[f.biome[k]].name };
  return { ok: true, why: "" };
}
export interface SiteProfile { tags: string[]; m: Record<string, number>; }
export function siteProfile(p: Project, f: Fields, q: Pt): SiteProfile {
  const k = cellOf(f, q), tags: string[] = [];
  const dw = f.dw[k], dr = f.dRoad[k], dc = f.dc[k];
  let nearLake = Infinity;
  for (const l of p.lakes) nearLake = Math.min(nearLake, nearestOnLine(l.ring, q, true).d);
  if (nearLake < 60) tags.push("bờ hồ");
  else if (dw < 50) tags.push("ven sông");
  const b = f.biome[k];
  if (b === 1 || b === 2 || b === 3) tags.push("trong rừng");
  if (b === 0 || b === 6) tags.push("bình nguyên");
  if (b === 7 || f.elev[k] > 0.4) tags.push("nền đá cao");
  if (dc < 70) tags.push("ven biển");
  let near = 0, ex = 0, cnt = 0;
  for (const po of p.pois) if ((po.arche === "mine" || po.arche === "quarry" || po.arche === "smelter" || po.arche === "sawmill") && dist(po.at, q) < 170) near++;
  if (near >= 1) tags.push("gần trung tâm khai thác");
  for (const r of p.roads) if (r.kind === "cart" && nearestOnLine(r.points, q).d < 70) { tags.push("gần đường vận tải"); break; }
  for (let a = 0; a < 8; a++) { const ang = (a / 8) * Math.PI * 2; ex += elevAt(p, q[0] + Math.cos(ang) * 100, q[1] + Math.sin(ang) * 100); cnt++; }
  const relief = f.elev[k] - ex / cnt;
  return { tags, m: { dw, dr, dc, slope: f.slope[k], relief, elev: f.elev[k] } };
}
export function houseTest(p: Project, f: Fields, q: Pt): { lines: { tone: "good" | "bad" | "info"; text: string }[]; profile: SiteProfile; ok: boolean } {
  const L: { tone: "good" | "bad" | "info"; text: string }[] = [];
  const bl = buildable(f, q);
  const prof = siteProfile(p, f, q);
  const k = cellOf(f, q);
  L.push({ tone: bl.ok ? "good" : "bad", text: bl.ok ? `Đất hợp lệ để dựng nhà (${BIOMES[f.biome[k]].name}, độ dốc ${f.slope[k].toFixed(2)}).` : `Không dựng được: ${bl.why}.` });
  if (prof.tags.length) L.push({ tone: "info", text: "Kiểu vị trí: " + prof.tags.join(", ") });
  const dw = f.dw[k];
  L.push({ tone: dw < 60 ? "good" : dw > 220 ? "bad" : "info", text: `Nước ngọt gần nhất ~${dw.toFixed(0)}u${dw < 20 ? " (sát bờ — nguy cơ ngập/ẩm)" : ""}.` });
  for (const [kind, label] of [["wood", "Gỗ"], ["stone", "Đá"], ["food", "Thức ăn"], ["fish", "Cá"], ["ore", "Quặng"]] as const) {
    const r = nearestRes(p, q, kind);
    if (r) L.push({ tone: r.d < 140 ? "good" : r.d > 320 ? "bad" : "info", text: `${label} gần nhất: ${r.d.toFixed(0)}u.` });
  }
  const dr = f.dRoad[k];
  L.push({ tone: dr < 60 ? "good" : dr > 200 ? "bad" : "info", text: `Đường gần nhất: ${dr.toFixed(0)}u${f.roadCart[k] ? " (đường xe hàng ngay trên ô)" : ""}. Chi phí chở hàng thực: phải đo bằng K7 (Gameplay).` });
  let nd = Infinity, nn = "";
  for (const d of p.docks) { const x = dist(d.at, q); if (x < nd) { nd = x; nn = d.name; } }
  if (isFinite(nd)) L.push({ tone: nd < 120 ? "good" : "info", text: `Bến gần nhất: ${nn} (${nd.toFixed(0)}u) — lối thủy cho hàng nặng.` });
  const rel = prof.m.relief;
  L.push({ tone: "info", text: rel > 0.04 ? "Địa thế cao: tầm nhìn xa, dễ phòng thủ, nhưng gió/thời tiết lộ và dấu chân dễ thấy." : rel < -0.04 ? "Địa thế trũng: kín gió, thoát hiểm khó, có thể ẩm/ngập mùa mưa." : "Địa thế bằng: cân bằng." });
  L.push({ tone: "info", text: `Cách bờ biển ${f.dc[k].toFixed(0)}u — ${f.dc[k] < 60 ? "ven biển: dễ ra bến/đường rút bằng thuyền." : "nội địa: đường rút phụ thuộc đường bộ."}` });
  L.push({ tone: "info", text: "UNKNOWN: giao tuyến habitat quái / dấu chân (MAP-U1) — chưa có dữ liệu habitat; A1/Gameplay phải cung cấp." });
  return { lines: L, profile: prof, ok: bl.ok };
}

// ---------- heatmaps ----------
export type HeatKind = "opp" | "poi" | "build";
export function heatmap(p: Project, f: Fields, kind: HeatKind): Float32Array {
  const out = new Float32Array(f.gw * f.gh);
  const basic = ["fresh_water", "food", "wood", "stone"];
  for (let j = 0; j < f.gh; j++) for (let i = 0; i < f.gw; i++) {
    const k = j * f.gw + i;
    if (!f.land[k]) continue;
    const q: Pt = [(i + 0.5) * f.cell, (j + 0.5) * f.cell];
    if (kind === "poi") {
      let s = 0;
      for (const po of p.pois) { const d = dist(po.at, q) / 120; if (d < 3) s += Math.exp(-d * d); }
      out[k] = clamp(s / 2.5, 0, 1);
    } else if (kind === "opp") {
      const have = new Set<string>();
      for (const r of p.resources) if (dist(r.at, q) < 130 + r.r) have.add(r.kind);
      let pc = 0;
      for (const po of p.pois) { if (dist(po.at, q) < 170) { pc++; for (const rk of po.resources) have.add(rk); } }
      const div = basic.filter((b) => have.has(b)).length / 4;
      out[k] = clamp(0.38 * div + 0.2 * Math.min(1, pc / 3) + 0.24 * Math.exp(-f.dRoad[k] / 130) + 0.18 * Math.exp(-f.dw[k] / 100) + 0.05 * Math.min(1, have.size / 7), 0, 1);
    } else {
      const bl = !f.lake[k] && !f.river[k] && f.slope[k] <= RULES.buildSlopeMax && !BAD_BUILD.has(f.biome[k]);
      if (!bl) continue;
      const have = new Set<string>();
      for (const r of p.resources) if (dist(r.at, q) < 140 + r.r) have.add(r.kind);
      const div = basic.filter((b) => have.has(b)).length / 4;
      out[k] = clamp(0.3 * Math.exp(-f.dw[k] / 110) + 0.28 * Math.exp(-f.dRoad[k] / 150) + 0.27 * div + 0.15 * (1 - f.slope[k] / RULES.buildSlopeMax), 0.04, 1);
    }
  }
  return out;
}

// ---------- suggestions ----------
export interface Suggest { at: Pt; score: number; reasons: string[]; }
interface Rule { res?: [string, number]; water?: number; road?: number; coast?: "near" | "far"; biomes?: number[]; spacing: number; slope?: number; elevMin?: number; }
const RULESET: Record<string, Rule> = {
  sawmill: { res: ["wood", 90], water: 70, road: 110, biomes: [1, 2, 3], spacing: 170, slope: 0.4 },
  quarry: { res: ["stone", 70], road: 130, biomes: [7, 3, 6], spacing: 180, slope: 0.7 },
  mine: { res: ["stone", 80], road: 160, biomes: [7, 3], spacing: 200, slope: 0.7, elevMin: 0.3 },
  mill: { water: 40, road: 90, biomes: [0, 1, 6], spacing: 160, slope: 0.4 },
  port: { coast: "near", road: 120, spacing: 200, slope: 0.4 },
  pier: { water: 30, road: 100, spacing: 90, slope: 0.5 },
  village: { water: 90, road: 80, biomes: [0, 1, 6], spacing: 170, slope: 0.35 },
  hamlet: { water: 110, road: 100, biomes: [0, 1, 6, 3], spacing: 100, slope: 0.4 },
  roadstop: { road: 25, spacing: 120, slope: 0.4 },
  warehouse: { road: 40, spacing: 150, slope: 0.35 },
  smelter: { road: 80, water: 120, spacing: 200, slope: 0.4 },
  powerplant: { water: 40, road: 140, spacing: 220, slope: 0.7 },
  grove: { biomes: [1, 2], spacing: 90, slope: 0.5 },
};
export function suggestPoi(p: Project, f: Fields, arche: string, count = 5): Suggest[] {
  const rule = RULESET[arche] || { road: 100, spacing: 120, slope: 0.5 };
  const out: Suggest[] = [];
  for (let j = 2; j < f.gh - 2; j += 2) for (let i = 2; i < f.gw - 2; i += 2) {
    const k = j * f.gw + i;
    if (!f.land[k] || f.lake[k] || f.river[k]) continue;
    const q: Pt = [(i + 0.5) * f.cell, (j + 0.5) * f.cell];
    if (f.slope[k] > (rule.slope ?? 0.5) || BAD_BUILD.has(f.biome[k]) && arche !== "mine") continue;
    if (rule.elevMin && f.elev[k] < rule.elevMin) continue;
    if (p.pois.some((o) => o.arche === arche && dist(o.at, q) < rule.spacing)) continue;
    let s = 0; const why: string[] = [];
    if (rule.res) { const r = nearestRes(p, q, rule.res[0]); if (r && r.d < rule.res[1]) { s += 1 - r.d / rule.res[1]; why.push(`${rule.res[0]} cách ${r.d.toFixed(0)}u`); } else continue; }
    if (rule.water !== undefined) { if (f.dw[k] < rule.water) { s += 1 - f.dw[k] / rule.water; why.push(`nước ngọt ${f.dw[k].toFixed(0)}u`); } else continue; }
    if (rule.road !== undefined) { if (f.dRoad[k] < rule.road) { s += 1 - f.dRoad[k] / rule.road; why.push(`đường ${f.dRoad[k].toFixed(0)}u`); } else continue; }
    if (rule.coast === "near") { if (f.dc[k] < 24) { s += 1 - f.dc[k] / 24; why.push("sát bờ biển"); } else continue; }
    if (rule.biomes) { if (rule.biomes.includes(f.biome[k])) { s += 0.6; why.push(BIOMES[f.biome[k]].name); } else continue; }
    // spread: prefer far from other POIs of any kind, and interior
    let nearest = 999;
    for (const o of p.pois) nearest = Math.min(nearest, dist(o.at, q));
    s += Math.min(1, nearest / 220) * 0.8;
    if (nearest > 120) why.push(`cách POI khác ${nearest.toFixed(0)}u (phân bố rộng)`);
    if (f.dc[k] > RULES.interiorDist) { s += 0.3; why.push("nội địa"); }
    out.push({ at: q, score: s, reasons: why });
  }
  out.sort((a, b) => b.score - a.score);
  const pick: Suggest[] = [];
  for (const c of out) { if (pick.every((x) => dist(x.at, c.at) > 90)) pick.push(c); if (pick.length >= count) break; }
  const ar = ARCHE_BY_ID[arche];
  return pick.map((s) => ({ ...s, reasons: [ar ? `Phù hợp «${ar.name}»` : arche, ...s.reasons] }));
}
export function regionOf(p: Project, q: Pt): string {
  let best = "biển", bd = Infinity;
  for (const l of p.land) {
    const n = nearestOnLine(l.rings[0], q, true);
    if (n.d < bd) { bd = n.d; best = l.name; }
  }
  return best;
}
