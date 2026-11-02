import { contours } from "d3-contour";
import polylabel from "polylabel";
import { catmull, centroid, clamp, dist, hash2, lerp, mulberry32, resample } from "./geom";
import { chamfer, landMask, lakeMask, riverMask, noise2, fbm } from "./terrain";
import { ARCHE_BY_ID, BIOMES, ELDERS, RES_KINDS } from "./types";
import type { Project, Pt, ViewMode } from "./types";

export const LAYERS = [
  ["terrain", "Địa hình & biome"], ["contours", "Đường đồng mức"], ["lakes", "Hồ"], ["rivers", "Sông & kênh"], ["roads", "Đường bộ / phà"], ["bridges", "Cầu"],
  ["docks", "Bến"], ["pois", "POI"], ["footprints", "Footprint POI"], ["zones", "Vùng xây nhà"], ["resources", "Nguồn sống"], ["spawns", "Điểm spawn"],
  ["elders", "Lãnh thổ Elder"], ["labels", "Nhãn"], ["heat", "Heatmap"], ["flow", "Hướng dòng chảy"], ["grid", "Lưới"],
] as const;
export type LayerId = (typeof LAYERS)[number][0];
export type LayerState = Record<LayerId, boolean>;
export const VIEW_NAMES: Record<ViewMode, string> = { atlas: "Atlas đầy đủ", clean: "Bản đồ sạch (không marker)", hydro: "Thủy lưu", transport: "Giao thông thủy/bộ", poi: "POI · nguồn sống · vùng xây", elders: "Sáu Elder", opp: "Gameplay opportunities" };
export function preset(mode: ViewMode, prev?: LayerState): { layers: LayerState; dim: boolean } {
  const all = Object.fromEntries(LAYERS.map(([k]) => [k, false])) as LayerState;
  const on = (...k: LayerId[]) => k.forEach((x) => (all[x] = true));
  let dim = false;
  if (mode === "atlas") on("terrain", "contours", "lakes", "rivers", "roads", "bridges", "docks", "pois", "labels", "elders");
  if (mode === "clean") on("terrain", "contours", "lakes", "rivers", "labels");
  if (mode === "hydro") { on("terrain", "lakes", "rivers", "docks", "labels", "flow"); dim = true; }
  if (mode === "transport") { on("terrain", "rivers", "lakes", "roads", "bridges", "docks", "pois", "labels"); dim = true; }
  if (mode === "poi") { on("terrain", "lakes", "rivers", "zones", "resources", "pois", "footprints", "docks", "spawns", "labels"); dim = true; }
  if (mode === "elders") { on("terrain", "lakes", "rivers", "roads", "pois", "elders", "labels", "docks"); dim = true; }
  if (mode === "opp") { on("terrain", "lakes", "rivers", "heat", "pois", "labels"); dim = true; }
  if (prev) { all.grid = prev.grid; }
  return { layers: all, dim };
}

export interface View { x: number; y: number; s: number }
export interface Overlay { kind: "poly" | "line" | "pt" | "circle" | "text"; pts: Pt[]; color: string; dashed?: boolean; label?: string; r?: number; fill?: boolean; width?: number }
export interface SceneOpts {
  mode: ViewMode; layers: LayerState; dim: boolean; sel: Set<string>; hover: string | null; gridSize: number;
  heat: HTMLCanvasElement | null; blocked: Set<string>; changed?: { added: Set<string>; moved: Set<string> }; extras: Overlay[]; ragnarok: boolean; selVertex: number; hoverSeg: number; vw: number; vh: number;
  hideEditor?: boolean;
}

const path = (c: CanvasRenderingContext2D, pts: Pt[], closed = false) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); if (closed) c.closePath(); };

// ---------------- base map (terrain raster + coast + contours + relief glyphs) ----------------
let grain: Float32Array | null = null;
function getGrain() {
  if (grain) return grain;
  grain = new Float32Array(256 * 256);
  const r = mulberry32(77);
  for (let i = 0; i < grain.length; i++) grain[i] = r() * 2 - 1;
  return grain;
}
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function renderBase(p: Project, scale: number): HTMLCanvasElement {
  const W = Math.round(p.world.w * scale), H = Math.round(p.world.h * scale), t = p.terrain;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  const mk = document.createElement("canvas");
  mk.width = W; mk.height = H;
  const mg = mk.getContext("2d", { willReadFrequently: true })!;
  mg.fillStyle = "#000"; mg.fillRect(0, 0, W, H);
  mg.scale(scale, scale); mg.fillStyle = "#fff";
  for (const l of p.land) { mg.beginPath(); for (const r of l.rings) { path(mg, r, true); } mg.fill("evenodd"); }
  const md = mg.getImageData(0, 0, W, H).data;
  const lg = landMask(p);
  const dl = chamfer(lg, t.gw, t.gh, t.cell);
  const e = new Float32Array(t.elev.length), shade = new Float32Array(t.elev.length);
  for (let i = 0; i < e.length; i++) e[i] = t.elev[i] / 255;
  for (let j = 0; j < t.gh; j++) for (let i = 0; i < t.gw; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(t.gw - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(t.gh - 1, j + 1);
    const dx = (e[j * t.gw + i1] - e[j * t.gw + i0]) / (i1 - i0), dy = (e[j1 * t.gw + i] - e[j0 * t.gw + i]) / (j1 - j0);
    shade[j * t.gw + i] = clamp(0.5 + (-dx - dy) * 9, 0, 1);
  }
  const gr = getGrain();
  const img = g.createImageData(W, H), d = img.data;
  const BC = BIOMES.map((b) => b.color as number[]);
  const shallow = [128, 198, 204], midc = [70, 142, 178], deep = [26, 72, 118];
  const cs = t.cell;
  for (let y = 0; y < H; y++) {
    const wy = (y + 0.5) / scale, fy = wy / cs - 0.5;
    const j0 = clamp(Math.floor(fy), 0, t.gh - 1), j1 = Math.min(j0 + 1, t.gh - 1), ty = clamp(fy - j0, 0, 1);
    for (let x = 0; x < W; x++) {
      const wx = (x + 0.5) / scale, fx = wx / cs - 0.5;
      const i0 = clamp(Math.floor(fx), 0, t.gw - 1), i1 = Math.min(i0 + 1, t.gw - 1), tx = clamp(fx - i0, 0, 1);
      const k00 = j0 * t.gw + i0, k10 = j0 * t.gw + i1, k01 = j1 * t.gw + i0, k11 = j1 * t.gw + i1;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const o = (y * W + x) * 4;
      const gn = gr[((y & 255) << 8) | (x & 255)];
      const sd = dl[k00] * w00 + dl[k10] * w10 + dl[k01] * w01 + dl[k11] * w11;
      // ocean
      const tt = Math.pow(clamp(sd / 200, 0, 1), 0.65);
      let oc = tt < 0.5 ? mix(shallow, midc, tt * 2) : mix(midc, deep, (tt - 0.5) * 2);
      const shore = Math.max(0, 1 - sd / 46);
      const band = 0.5 + 0.5 * Math.sin(sd * 0.32);
      const lift = shore * band * 16 + gn * 2.2;
      let R = oc[0] + lift, G = oc[1] + lift, B = oc[2] + lift;
      const a = md[o] / 255;
      if (a > 0) {
        const c00 = BC[t.biome[k00]], c10 = BC[t.biome[k10]], c01 = BC[t.biome[k01]], c11 = BC[t.biome[k11]];
        let r = c00[0] * w00 + c10[0] * w10 + c01[0] * w01 + c11[0] * w11;
        let gg = c00[1] * w00 + c10[1] * w10 + c01[1] * w01 + c11[1] * w11;
        let b = c00[2] * w00 + c10[2] * w10 + c01[2] * w01 + c11[2] * w11;
        const sh = shade[k00] * w00 + shade[k10] * w10 + shade[k01] * w01 + shade[k11] * w11;
        const el = e[k00] * w00 + e[k10] * w10 + e[k01] * w01 + e[k11] * w11;
        const rocky = t.biome[k00] === 7 || t.biome[k00] === 8 || t.biome[k00] === 9 ? 1 : 0.35;
        const g2 = gr[(((y >> 2) & 255) << 8) | ((x >> 2) & 255)];
        const m = (0.6 + 0.75 * sh) * (1 + 0.22 * g2 * rocky) * (0.94 + 0.2 * el);
        r = r * m + gn * 3; gg = gg * m + gn * 3; b = b * m + gn * 3;
        R = R * (1 - a) + r * a; G = G * (1 - a) + gg * a; B = B * (1 - a) + b * a;
      }
      d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.save();
  g.scale(scale, scale);
  // shallow-water halos (sea only)
  g.save();
  g.beginPath();
  g.rect(0, 0, p.world.w, p.world.h);
  for (const l of p.land) for (const r of l.rings) path(g, r, true);
  g.clip("evenodd");
  g.lineJoin = "round";
  for (const [w, al] of [[34, 0.07], [22, 0.09], [13, 0.12], [6, 0.16]] as [number, number][]) {
    g.lineWidth = w; g.strokeStyle = `rgba(235,250,250,${al})`;
    for (const l of p.land) for (const r of l.rings) { path(g, r, true); g.stroke(); }
  }
  g.restore();
  // contours
  const lk = lakeMask(p), rm = riverMask(p);
  const cont = contours().size([t.gw, t.gh]).thresholds([0.14, 0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86]);
  const polys = cont(Array.from(e) as number[]);
  g.save();
  g.beginPath();
  for (const l of p.land) for (const r of l.rings) path(g, r, true);
  g.clip("evenodd");
  polys.forEach((mp, ci) => {
    g.strokeStyle = ci % 2 === 1 ? "rgba(84,58,34,0.30)" : "rgba(84,58,34,0.15)";
    g.lineWidth = ci % 2 === 1 ? 0.8 : 0.5;
    for (const poly of mp.coordinates) for (const ring of poly) { g.beginPath(); ring.forEach((q, i) => { const X = (q[0] + 0.5) * cs, Y = (q[1] + 0.5) * cs; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); }
  });
  g.restore();
  // coast line
  g.lineJoin = "round";
  g.strokeStyle = "rgba(58,40,24,0.85)"; g.lineWidth = 1.3;
  for (const l of p.land) for (const r of l.rings) { path(g, r, true); g.stroke(); }
  // relief glyphs
  type Gl = { x: number; y: number; k: number; s: number; e: number };
  const gl: Gl[] = [];
  const near = (x: number, y: number) => clamp(Math.floor(y / cs), 0, t.gh - 1) * t.gw + clamp(Math.floor(x / cs), 0, t.gw - 1);
  const step = 11;
  for (let y = 6; y < p.world.h; y += step) for (let x = 6; x < p.world.w; x += step) {
    const jx = x + (hash2(x, y, 1) - 0.5) * step * 0.9, jy = y + (hash2(x, y, 2) - 0.5) * step * 0.9, k = near(jx, jy);
    if (!lg[k] || lk[k] || rm[k]) continue;
    const b = t.biome[k], el = e[k], h = hash2(x, y, 3);
    if (b === 7 || b === 8) { if (h < 0.5 && el > 0.3) gl.push({ x: jx, y: jy, k: 1, s: 0.7 + el * 0.9, e: el }); }
    else if (b === 9) { if (h < 0.45) gl.push({ x: jx, y: jy, k: 8, s: 0.8 + el, e: el }); }
    else if (b === 2) { if (h < 0.85) gl.push({ x: jx, y: jy, k: 3, s: 1.25 + h * 0.4, e: el }); }
    else if (b === 1) { if (h < 0.6) gl.push({ x: jx, y: jy, k: 2, s: 0.95 + h * 0.4, e: el }); }
    else if (b === 3) { if (h < 0.55) gl.push({ x: jx, y: jy, k: 4, s: 0.9 + h * 0.4, e: el }); }
    else if (b === 5) { if (h < 0.1) gl.push({ x: jx, y: jy, k: 5, s: 1 + h * 4, e: el }); }
    else if (b === 4) { if (h < 0.22) gl.push({ x: jx, y: jy, k: 6, s: 1, e: el }); }
    else if (b === 10) { if (h < 0.2) gl.push({ x: jx, y: jy, k: 9, s: 1, e: el }); }
    else if ((b === 0 || b === 6) && el > 0.34 && h < 0.2) gl.push({ x: jx, y: jy, k: 7, s: 1, e: el });
    else if ((b === 0 || b === 6) && h < 0.025) gl.push({ x: jx, y: jy, k: 10, s: 1, e: el });
  }
  gl.sort((a, b) => a.y - b.y);
  for (const q of gl) {
    const { x, y, s } = q;
    if (q.k === 1) { // mountain
      g.fillStyle = "#9a8e80"; g.beginPath(); g.moveTo(x - 7 * s, y + 3 * s); g.lineTo(x, y - 7 * s); g.lineTo(x + 7 * s, y + 3 * s); g.closePath(); g.fill();
      g.fillStyle = "#c9bfae"; g.beginPath(); g.moveTo(x - 7 * s, y + 3 * s); g.lineTo(x, y - 7 * s); g.lineTo(x - 1 * s, y + 3 * s); g.closePath(); g.fill();
      if (q.e > 0.78) { g.fillStyle = "#f4f6f8"; g.beginPath(); g.moveTo(x - 2.4 * s, y - 3.8 * s); g.lineTo(x, y - 7 * s); g.lineTo(x + 2.4 * s, y - 3.8 * s); g.closePath(); g.fill(); }
      g.strokeStyle = "rgba(60,48,38,.7)"; g.lineWidth = 0.55; g.beginPath(); g.moveTo(x - 7 * s, y + 3 * s); g.lineTo(x, y - 7 * s); g.lineTo(x + 7 * s, y + 3 * s); g.stroke();
    } else if (q.k === 2 || q.k === 3) { // broadleaf / ancient tree
      const r = 3.1 * s;
      g.fillStyle = "rgba(20,40,20,.3)"; g.beginPath(); g.ellipse(x + 1, y + r * 0.9, r * 0.95, r * 0.45, 0, 0, 7); g.fill();
      g.fillStyle = q.k === 3 ? "#2c6a3a" : "#4a7d3c"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = q.k === 3 ? "#4fa05a" : "#7fb059"; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, 7); g.fill();
    } else if (q.k === 4) { // conifer
      const r = 3.4 * s;
      g.fillStyle = "#2f5a48"; g.beginPath(); g.moveTo(x, y - r * 1.7); g.lineTo(x + r * 0.9, y + r * 0.6); g.lineTo(x - r * 0.9, y + r * 0.6); g.closePath(); g.fill();
      g.fillStyle = "#4f8068"; g.beginPath(); g.moveTo(x, y - r * 1.7); g.lineTo(x - r * 0.9, y + r * 0.6); g.lineTo(x, y + r * 0.6); g.closePath(); g.fill();
    } else if (q.k === 5) { // dune
      g.strokeStyle = "rgba(150,110,60,.55)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 7 * s, y + 1); g.quadraticCurveTo(x, y - 4 * s, x + 7 * s, y + 1); g.stroke();
      g.strokeStyle = "rgba(255,240,200,.5)"; g.beginPath(); g.moveTo(x - 6 * s, y + 2.2); g.quadraticCurveTo(x, y - 2.6 * s, x + 6 * s, y + 2.2); g.stroke();
    } else if (q.k === 6) { // reeds
      g.strokeStyle = "rgba(60,90,50,.85)"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - 2, y + 2); g.lineTo(x - 2.5, y - 3); g.moveTo(x, y + 2); g.lineTo(x, y - 4); g.moveTo(x + 2, y + 2); g.lineTo(x + 2.6, y - 3); g.stroke();
      g.strokeStyle = "rgba(120,170,190,.7)"; g.beginPath(); g.moveTo(x - 4, y + 3.4); g.lineTo(x + 4, y + 3.4); g.stroke();
    } else if (q.k === 7) { // low hill
      g.strokeStyle = "rgba(90,70,40,.5)"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - 5, y + 1.5); g.quadraticCurveTo(x, y - 4, x + 5, y + 1.5); g.stroke();
    } else if (q.k === 8) { // volcanic rock
      g.fillStyle = "#3a2c2a"; g.beginPath(); g.moveTo(x - 5 * s, y + 2.5 * s); g.lineTo(x - 0.5 * s, y - 5.5 * s); g.lineTo(x + 5 * s, y + 2.5 * s); g.closePath(); g.fill();
      g.fillStyle = "#6a4a40"; g.beginPath(); g.moveTo(x - 5 * s, y + 2.5 * s); g.lineTo(x - 0.5 * s, y - 5.5 * s); g.lineTo(x - 1.5 * s, y + 2.5 * s); g.closePath(); g.fill();
    } else if (q.k === 9) { // toxic
      g.strokeStyle = "rgba(100,100,20,.8)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(x + 2, y + 2); g.moveTo(x + 2, y - 2); g.lineTo(x - 2, y + 2); g.stroke();
    } else { g.strokeStyle = "rgba(60,100,40,.55)"; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x - 1.5, y + 1.5); g.lineTo(x - 2, y - 1.5); g.moveTo(x, y + 1.5); g.lineTo(x, y - 2.5); g.moveTo(x + 1.5, y + 1.5); g.lineTo(x + 2, y - 1.5); g.stroke(); }
  }
  // lava glow on volcanic core
  let vx = 0, vy = 0, vn = 0, vmax = 0;
  for (let j = 0; j < t.gh; j++) for (let i = 0; i < t.gw; i++) if (t.biome[j * t.gw + i] === 9 && lg[j * t.gw + i]) { vx += i; vy += j; vn++; vmax = Math.max(vmax, e[j * t.gw + i]); }
  if (vn > 150) {
    const cx = (vx / vn + 0.5) * cs, cy = (vy / vn + 0.5) * cs;
    const gg = g.createRadialGradient(cx, cy, 2, cx, cy, 36);
    gg.addColorStop(0, "rgba(255,200,70,.95)"); gg.addColorStop(0.35, "rgba(240,90,30,.75)"); gg.addColorStop(1, "rgba(120,30,10,0)");
    g.fillStyle = gg; g.beginPath(); g.arc(cx, cy, 36, 0, 7); g.fill();
  }
  g.restore();
  return cv;
}

// ---------------- scene overlay ----------------
const ROAD_STYLE: Record<string, { c: string; w: number; dash?: number[]; cas: string }> = {
  cart: { c: "#c9742e", w: 3.4, cas: "#fff3d6" }, foot: { c: "#6b3a1d", w: 1.7, dash: [4, 3], cas: "rgba(255,243,214,.8)" },
  trail: { c: "#4f6d2c", w: 1.5, dash: [2, 3], cas: "rgba(255,243,214,.7)" }, riverside: { c: "#7a5a3a", w: 1.5, dash: [6, 2, 1, 2], cas: "rgba(255,243,214,.7)" },
  ferry: { c: "#ffffff", w: 1.8, dash: [7, 5], cas: "rgba(20,70,120,.8)" },
};
const TRANS_COLOR: Record<string, string> = { cart: "#ff8c1a", foot: "#d6249f", trail: "#2fbf4a", riverside: "#a05fd6", ferry: "#00d0ff" };

export function drawScene(c: CanvasRenderingContext2D, p: Project, v: View, o: SceneOpts, base: HTMLCanvasElement | null, baseScale: number) {
  const L = o.layers, px = 1 / v.s;
  c.save();
  c.transform(v.s, 0, 0, v.s, -v.x * v.s, -v.y * v.s);
  c.fillStyle = "#0e2a44";
  c.fillRect(-2000, -2000, p.world.w + 4000, p.world.h + 4000);
  if (L.terrain && base) {
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    c.drawImage(base, 0, 0, base.width / baseScale, base.height / baseScale);
    if (o.dim) { c.fillStyle = "rgba(240,234,218,0.5)"; c.fillRect(0, 0, p.world.w, p.world.h); }
  } else { c.fillStyle = "#1c3550"; c.fillRect(0, 0, p.world.w, p.world.h); c.fillStyle = "#c8c0a8"; for (const l of p.land) { c.beginPath(); for (const r of l.rings) path(c, r, true); c.fill("evenodd"); } }
  if (L.heat && o.heat) { c.imageSmoothingEnabled = true; c.globalAlpha = 0.72; c.drawImage(o.heat, 0, 0, p.world.w, p.world.h); c.globalAlpha = 1; }
  if (!L.terrain) { c.strokeStyle = "#3a2818"; c.lineWidth = 1.3 * px * 1; for (const l of p.land) for (const r of l.rings) { path(c, r, true); c.stroke(); } }
  const hid = (x: { hidden?: boolean }) => x.hidden && !o.hideEditor;

  // elders
  if (L.elders) {
    for (const e of p.elders) {
      if (e.hidden) continue;
      const def = ELDERS.find((x) => x.id === e.elder)!;
      c.lineJoin = "round";
      if (e.outer.length > 2) { path(c, e.outer, true); c.fillStyle = def.color + "26"; c.fill(); c.strokeStyle = def.color + "cc"; c.lineWidth = 1.6 * px * 1.4; c.setLineDash([8 * px * 1.4, 5 * px * 1.4]); c.stroke(); c.setLineDash([]); }
      if (e.core.length > 2) { path(c, e.core, true); c.fillStyle = def.color + "40"; c.fill(); c.strokeStyle = def.color; c.lineWidth = 2.2 * px * 1.4; c.stroke(); }
      for (const a of e.arenas) { path(c, a, true); c.fillStyle = def.color + "66"; c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 1.2 * px * 1.4; c.setLineDash([3 * px * 1.4, 3 * px * 1.4]); c.stroke(); c.setLineDash([]); }
      for (const q of e.approach) { c.fillStyle = "#fff"; c.strokeStyle = def.color; c.lineWidth = 2 * px * 1.4; c.beginPath(); c.moveTo(q[0], q[1] - 6 * px * 1.3); c.lineTo(q[0] + 5 * px * 1.3, q[1]); c.lineTo(q[0], q[1] + 6 * px * 1.3); c.lineTo(q[0] - 5 * px * 1.3, q[1]); c.closePath(); c.fill(); c.stroke(); }
      if (o.ragnarok && e.core.length) {
        const ce = centroid(e.core);
        c.strokeStyle = def.color; c.setLineDash([2 * px * 2, 5 * px * 2]); c.lineWidth = 2 * px * 2;
        for (let k = 1; k <= 3; k++) { c.globalAlpha = 0.65 - k * 0.15; c.beginPath(); c.ellipse(ce[0], ce[1], 60 * k + 40, 46 * k + 30, 0, 0, 7); c.stroke(); }
        c.setLineDash([]); c.globalAlpha = 1;
        c.fillStyle = def.color; c.font = `bold ${12 * px * 1.3}px sans-serif`; c.textAlign = "center"; c.fillText("RAGNAROK 72h", ce[0], ce[1] - 70 * px * 1.2 - 40);
      }
      if (e.outer.length > 2 && (o.mode === "elders" || o.sel.has(e.id))) { const lp = polylabel([e.outer.map((q) => [q[0], q[1]] as [number, number])], 2); c.font = `bold ${13 * px * 1.5}px "Segoe UI",sans-serif`; c.textAlign = "center"; c.lineWidth = 3 * px * 1.5; c.strokeStyle = "rgba(255,255,255,.85)"; c.strokeText(def.name.toUpperCase(), lp[0], lp[1] - 36); c.fillStyle = def.color; c.fillText(def.name.toUpperCase(), lp[0], lp[1] - 36); }
    }
  }
  // zones
  if (L.zones) for (const z of p.zones) {
    if (hid(z) || z.ring.length < 3) continue;
    path(c, z.ring, true); c.fillStyle = "rgba(60,200,120,.28)"; c.fill(); c.strokeStyle = "rgba(20,120,60,.95)"; c.lineWidth = 1.4 * px * 1.3; c.setLineDash([5 * px * 1.3, 3 * px * 1.3]); c.stroke(); c.setLineDash([]);
  }
  // lakes
  if (L.lakes) for (const l of p.lakes) {
    if (hid(l)) continue;
    path(c, l.ring, true); c.fillStyle = "#4aa3d4"; c.fill(); c.strokeStyle = "#1d5b86"; c.lineWidth = 1.5; c.stroke();
    c.save(); path(c, l.ring, true); c.clip(); c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 3; path(c, l.ring, true); c.stroke(); c.restore();
  }
  // rivers
  const nav = o.mode === "hydro" || o.mode === "transport";
  if (L.rivers) for (const r of p.rivers) {
    if (hid(r)) continue;
    const cu = catmull(r.points), pts = cu.pts;
    const w = Math.max(1.8, r.width);
    const blk = o.blocked.has(r.id);
    c.lineJoin = "round"; c.lineCap = "round";
    if (r.kind === "canal") {
      path(c, pts); c.strokeStyle = "#6b5a3e"; c.lineWidth = w + 3; c.stroke(); c.strokeStyle = "#5cc0d8"; c.lineWidth = w; c.stroke();
    } else { path(c, pts); c.strokeStyle = "#1d5b86"; c.lineWidth = w + 1.8; c.stroke(); c.strokeStyle = blk ? "#888" : "#58b4e2"; c.lineWidth = w; c.stroke(); }
    if (nav && r.kind !== "canal" || nav) {
      // navigable segments highlighted
      let run: Pt[] = [];
      const flush = () => { if (run.length > 1) { path(c, run); c.strokeStyle = "#00e5ff"; c.lineWidth = Math.max(1.2, w * 0.55); c.stroke(); } run = []; };
      pts.forEach((q, i) => { const nv = r.nav[Math.min(cu.idx[i], r.nav.length - 1)] === 1; if (nv) run.push(q); else flush(); });
      flush();
    }
    if (L.flow || o.sel.has(r.id)) {
      const S = resample(pts, 90).pts;
      c.fillStyle = "#08324f";
      for (let i = 1; i < S.length - 1; i++) { const a = S[i - 1], b = S[i + 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]); c.save(); c.translate(S[i][0], S[i][1]); c.rotate(ang); c.beginPath(); c.moveTo(4, 0); c.lineTo(-3, 3); c.lineTo(-1.2, 0); c.lineTo(-3, -3); c.closePath(); c.fill(); c.restore(); }
    }
    for (const f of r.feats) {
      c.save(); c.translate(f.at[0], f.at[1]);
      if (f.kind === "waterfall") { c.strokeStyle = "#fff"; c.lineWidth = 1.6; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * 2.4, -4); c.lineTo(k * 2.4, 4); c.stroke(); } c.strokeStyle = "#08324f"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-7, 5); c.lineTo(7, 5); c.stroke(); }
      else if (f.kind === "rapids") { c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, 2); c.lineTo(-3, -3); c.lineTo(0, 2); c.lineTo(3, -3); c.lineTo(6, 2); c.stroke(); }
      else if (f.kind === "lock") { c.fillStyle = "#e8d9b0"; c.strokeStyle = "#4a3a20"; c.lineWidth = 1; c.fillRect(-5, -4, 10, 8); c.strokeRect(-5, -4, 10, 8); c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.stroke(); }
      else { c.strokeStyle = "#3a2a18"; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-1, -6); c.lineTo(-1, 6); c.stroke(); }
      c.restore();
    }
  }
  // roads
  if (L.roads) for (const r of p.roads) {
    if (hid(r)) continue;
    const st = ROAD_STYLE[r.kind], pts = catmull(r.points).pts, blk = o.blocked.has(r.id);
    const tcol = o.mode === "transport" ? TRANS_COLOR[r.kind] : st.c;
    const wd = st.w * (o.mode === "transport" ? 1.25 : 1);
    c.lineJoin = "round"; c.lineCap = "round";
    path(c, pts); c.setLineDash([]); c.strokeStyle = st.cas; c.lineWidth = wd + 2; c.stroke();
    path(c, pts); c.setLineDash(r.alt ? [3, 4] : st.dash || []); c.strokeStyle = blk ? "#777" : tcol; c.lineWidth = wd; c.stroke(); c.setLineDash([]);
  }
  if (L.bridges) for (const b of p.bridges) {
    if (hid(b)) continue;
    c.save(); c.translate(b.at[0], b.at[1]); c.rotate(b.ang);
    const blk = o.blocked.has(b.id);
    c.fillStyle = blk ? "#a33" : b.load === "cart" ? "#f2d9a6" : "#f4ecd8"; c.strokeStyle = "#3a2410"; c.lineWidth = 1.1;
    c.fillRect(-6.5, -3.6, 13, 7.2); c.strokeRect(-6.5, -3.6, 13, 7.2);
    c.beginPath(); c.moveTo(-6.5, -1.4); c.lineTo(6.5, -1.4); c.moveTo(-6.5, 1.4); c.lineTo(6.5, 1.4); c.stroke();
    c.restore();
  }
  if (L.docks) for (const d of p.docks) {
    if (hid(d)) continue;
    c.save(); c.translate(d.at[0], d.at[1]);
    const blk = o.blocked.has(d.id);
    c.fillStyle = blk ? "#a33" : d.kind === "inland" ? "#2fb8c8" : "#1e6fd0"; c.strokeStyle = "#fff"; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -6.5); c.lineTo(5.5, 3); c.lineTo(-5.5, 3); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.arc(0, -1, 1.5, 0, 7); c.fillStyle = "#fff"; c.fill();
    c.restore();
  }
  // resources
  if (L.resources) for (const r of p.resources) {
    if (hid(r)) continue;
    const k = RES_KINDS.find((x) => x.id === r.kind)!;
    c.globalAlpha = 0.12; c.fillStyle = k.color; c.beginPath(); c.arc(r.at[0], r.at[1], r.r, 0, 7); c.fill(); c.globalAlpha = 1;
    c.fillStyle = k.color; c.strokeStyle = "#fff"; c.lineWidth = 0.9; c.beginPath(); c.arc(r.at[0], r.at[1], 2.4 + r.dens * 0.5, 0, 7); c.fill(); c.stroke();
  }
  // POIs
  const placed: [number, number, number, number][] = [];
  const small = v.s < 0.7;
  if (L.pois) {
    const pois = [...p.pois].sort((a, b) => (ARCHE_BY_ID[b.arche]?.r || 0) - (ARCHE_BY_ID[a.arche]?.r || 0));
    for (const po of pois) {
      if (hid(po)) continue;
      const a = ARCHE_BY_ID[po.arche] || ARCHE_BY_ID.custom;
      if (L.footprints && po.foot) {
        path(c, po.foot, true); c.fillStyle = "rgba(255,255,255,.28)"; c.fill(); c.strokeStyle = "#5a3a1a"; c.lineWidth = 1 * px * 1.2; c.stroke();
        if (po.deep) { path(c, po.deep, true); c.fillStyle = "rgba(200,40,40,.35)"; c.fill(); c.strokeStyle = "#a02020"; c.lineWidth = 1 * px * 1.2; c.setLineDash([2 * px * 1.2, 2 * px * 1.2]); c.stroke(); c.setLineDash([]); }
        for (const q of po.retreat) { c.strokeStyle = "#1c9b4a"; c.lineWidth = 1.4 * px * 1.2; c.beginPath(); c.moveTo(po.at[0], po.at[1]); c.lineTo(q[0], q[1]); c.setLineDash([2, 2]); c.stroke(); c.setLineDash([]); c.fillStyle = "#1c9b4a"; c.beginPath(); c.arc(q[0], q[1], 2.4, 0, 7); c.fill(); }
      }
      const R = Math.max(5.2, 4.4 + a.r * 0.14 * po.scale) * (small ? 0.9 : 1);
      c.save(); c.translate(po.at[0], po.at[1]);
      c.fillStyle = a.color; c.strokeStyle = o.sel.has(po.id) ? "#ff2a6d" : "#2a1a0a"; c.lineWidth = o.sel.has(po.id) ? 2.2 : 1.3;
      c.beginPath();
      if (a.cat === "industry") c.rect(-R, -R, R * 2, R * 2);
      else if (a.cat === "research" || a.cat === "ancient") { c.moveTo(0, -R * 1.2); c.lineTo(R * 1.2, 0); c.lineTo(0, R * 1.2); c.lineTo(-R * 1.2, 0); c.closePath(); }
      else if (a.cat === "danger") { c.moveTo(0, -R * 1.2); c.lineTo(R * 1.15, R * 0.9); c.lineTo(-R * 1.15, R * 0.9); c.closePath(); }
      else if (a.cat === "ragnarok") { for (let i = 0; i < 10; i++) { const rr = i % 2 ? R * 0.55 : R * 1.25, an = (i / 10) * 6.283 - 1.57; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); }
      else c.arc(0, 0, R, 0, 7);
      c.fill(); c.stroke();
      if (po.depth === "multi") { c.strokeStyle = "#a02020"; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, R * 1.5, 0, 7); c.setLineDash([2, 2]); c.stroke(); c.setLineDash([]); }
      c.fillStyle = "#1a1208"; c.font = `bold ${Math.round(R * 1.05)}px "Segoe UI",sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(a.code, 0, 0.5);
      c.restore();
      if (L.labels && (v.s > 0.62 || ["port", "village", "elder_site", "gate", "facility"].includes(po.arche))) {
        const fs = 10.5 / Math.max(v.s, 0.8) * (v.s < 0.8 ? 0.8 : 1);
        c.font = `600 ${fs}px "Segoe UI",sans-serif`;
        const tw = c.measureText(po.name).width, bx = po.at[0] - tw / 2, by = po.at[1] + R + 2;
        if (!placed.some((q) => bx < q[0] + q[2] && bx + tw > q[0] && by < q[1] + q[3] && by + fs > q[1])) {
          placed.push([bx, by, tw, fs]);
          c.textAlign = "center"; c.textBaseline = "top"; c.lineWidth = 3 / Math.max(v.s, 0.8); c.strokeStyle = "rgba(255,250,235,.9)"; c.strokeText(po.name, po.at[0], by); c.fillStyle = "#2a1a0a"; c.fillText(po.name, po.at[0], by);
        }
      }
    }
  }
  if (L.spawns) for (const s of p.spawns) {
    if (hid(s)) continue;
    c.save(); c.translate(s.at[0], s.at[1]);
    c.strokeStyle = "#111"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -16); c.stroke();
    c.fillStyle = o.sel.has(s.id) ? "#ff2a6d" : "#35e06b"; c.beginPath(); c.moveTo(0, -16); c.lineTo(11, -12); c.lineTo(0, -8); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
  // labels
  if (L.labels) for (const l of p.labels) {
    if (hid(l)) continue;
    c.save(); c.translate(l.at[0], l.at[1]); c.rotate(l.rot);
    const sz = l.size;
    c.textAlign = "center"; c.textBaseline = "middle";
    if (l.style === "region") { c.font = `600 ${sz}px Georgia,serif`; (c as unknown as { letterSpacing: string }).letterSpacing = sz > 30 ? "10px" : "3px"; c.fillStyle = "rgba(48,32,16,.78)"; c.strokeStyle = "rgba(255,248,226,.55)"; c.lineWidth = 3; c.strokeText(l.text.toUpperCase(), 0, 0); c.fillText(l.text.toUpperCase(), 0, 0); (c as unknown as { letterSpacing: string }).letterSpacing = "0px"; }
    else if (l.style === "water") { c.font = `italic ${sz}px Georgia,serif`; (c as unknown as { letterSpacing: string }).letterSpacing = "4px"; c.fillStyle = "rgba(230,248,255,.88)"; c.strokeStyle = "rgba(10,50,90,.5)"; c.lineWidth = 2.5; c.strokeText(l.text, 0, 0); c.fillText(l.text, 0, 0); (c as unknown as { letterSpacing: string }).letterSpacing = "0px"; }
    else { c.font = `600 ${sz}px sans-serif`; c.fillStyle = "#222"; c.fillText(l.text, 0, 0); }
    if (o.sel.has(l.id)) { c.strokeStyle = "#ff2a6d"; c.lineWidth = 1; c.strokeRect(-l.text.length * sz * 0.3, -sz * 0.6, l.text.length * sz * 0.6, sz * 1.2); }
    c.restore();
  }
  // diff highlights
  if (o.changed) for (const [set, col] of [[o.changed.added, "#2cff7a"], [o.changed.moved, "#ffb02c"]] as [Set<string>, string][]) {
    for (const id of set) {
      const ob = [...p.pois, ...p.zones, ...p.roads, ...p.rivers, ...p.docks, ...p.bridges, ...p.resources].find((x) => x.id === id) as { at?: Pt; points?: Pt[]; ring?: Pt[] } | undefined;
      const q = ob?.at || (ob?.points ? ob.points[Math.floor(ob.points.length / 2)] : ob?.ring ? centroid(ob.ring) : null);
      if (q) { c.strokeStyle = col; c.lineWidth = 2 * px * 1.5; c.beginPath(); c.arc(q[0], q[1], 14, 0, 7); c.stroke(); }
    }
  }
  if (L.grid && o.gridSize > 0) {
    const gs = o.gridSize, sp = gs * v.s;
    if (sp > 10) {
      c.lineWidth = px; c.strokeStyle = "rgba(20,30,50,.22)"; c.beginPath();
      for (let x = 0; x <= p.world.w; x += gs) { c.moveTo(x, 0); c.lineTo(x, p.world.h); }
      for (let y = 0; y <= p.world.h; y += gs) { c.moveTo(0, y); c.lineTo(p.world.w, y); }
      c.stroke();
    }
  }
  c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 2 * px; c.strokeRect(0, 0, p.world.w, p.world.h);
  // selection & extras (editor only)
  if (!o.hideEditor) {
    drawSelection(c, p, o, px);
    for (const e of o.extras) drawOverlay(c, e, px);
  }
  c.restore();
}

export function objectPoints(ob: Record<string, unknown>): Pt[] | null {
  if (Array.isArray(ob.points)) return ob.points as Pt[];
  if (Array.isArray(ob.ring)) return ob.ring as Pt[];
  if (Array.isArray(ob.rings)) return (ob.rings as Pt[][])[0];
  return null;
}
function drawSelection(c: CanvasRenderingContext2D, p: Project, o: SceneOpts, px: number) {
  const all = [...p.land, ...p.lakes, ...p.rivers, ...p.roads, ...p.zones, ...p.pois, ...p.docks, ...p.bridges, ...p.resources, ...p.spawns, ...p.elders, ...p.labels] as unknown as Record<string, unknown>[];
  const single = o.sel.size === 1;
  for (const ob of all) {
    const id = ob.id as string;
    const isSel = o.sel.has(id), isHov = o.hover === id;
    if (!isSel && !isHov) continue;
    const col = isSel ? "#ff2a6d" : "#ffd23f";
    const pts = objectPoints(ob);
    if (ob.outer) { for (const key of ["outer", "core"]) { const rr = ob[key] as Pt[]; if (rr.length > 2) { path(c, rr, true); c.strokeStyle = col; c.lineWidth = 2 * px * 1.5; c.stroke(); } } }
    if (pts) {
      path(c, ob.points ? catmull(pts).pts : pts, !ob.points); c.strokeStyle = col; c.lineWidth = (isSel ? 2.2 : 1.6) * px * 1.6; c.globalAlpha = 0.9; c.stroke(); c.globalAlpha = 1;
      if (isSel && single) {
        pts.forEach((q, i) => { c.fillStyle = i === o.selVertex ? "#ff2a6d" : "#fff"; c.strokeStyle = "#ff2a6d"; c.lineWidth = 1.4 * px * 1.2; c.beginPath(); c.arc(q[0], q[1], 4.2 * px * 1.2, 0, 7); c.fill(); c.stroke(); });
        if (ob.points && o.hoverSeg >= 0 && o.hoverSeg < pts.length - 1) { c.strokeStyle = "#ffd23f"; c.lineWidth = 4 * px * 1.4; c.beginPath(); c.moveTo(pts[o.hoverSeg][0], pts[o.hoverSeg][1]); c.lineTo(pts[o.hoverSeg + 1][0], pts[o.hoverSeg + 1][1]); c.stroke(); }
      }
    }
    if (Array.isArray(ob.links) && isSel) for (const lk of ob.links as { to: string; kind: string }[]) {
      const tg = all.find((x) => x.id === lk.to) as Record<string, unknown> | undefined; const tp = (tg?.at as Pt | undefined) || (tg ? objectPoints(tg)?.[0] : undefined);
      if (tp && ob.at) { const a = ob.at as Pt; c.strokeStyle = "#a64dff"; c.lineWidth = 1.6 * px * 1.3; c.setLineDash([5 * px * 1.3, 3 * px * 1.3]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(tp[0], tp[1]); c.stroke(); c.setLineDash([]); c.font = `600 ${10 * px * 1.3}px sans-serif`; c.textAlign = "center"; c.fillStyle = "#6b21c8"; c.fillText(lk.kind, (a[0] + tp[0]) / 2, (a[1] + tp[1]) / 2 - 3 * px); }
    }
    if (ob.at && !pts) { const q = ob.at as Pt; c.strokeStyle = col; c.lineWidth = 2 * px * 1.5; c.beginPath(); c.arc(q[0], q[1], 13 * 1, 0, 7); c.stroke(); }
    if (ob.foot && isSel && single) for (const key of ["foot", "deep"] as const) { const rr = ob[key] as Pt[] | undefined; if (rr) rr.forEach((q) => { c.fillStyle = "#fff"; c.strokeStyle = key === "foot" ? "#5a3a1a" : "#a02020"; c.lineWidth = 1.4 * px * 1.2; c.beginPath(); c.rect(q[0] - 3.4 * px * 1.2, q[1] - 3.4 * px * 1.2, 6.8 * px * 1.2, 6.8 * px * 1.2); c.fill(); c.stroke(); }); }
    if (ob.elder && isSel && single) { for (const key of ["outer", "core"]) (ob[key] as Pt[]).forEach((q) => { c.fillStyle = "#fff"; c.strokeStyle = "#ff2a6d"; c.lineWidth = 1.2 * px * 1.2; c.beginPath(); c.arc(q[0], q[1], 3.6 * px * 1.2, 0, 7); c.fill(); c.stroke(); }); }
  }
}
export function drawOverlay(c: CanvasRenderingContext2D, e: Overlay, px: number) {
  c.save();
  c.strokeStyle = e.color; c.fillStyle = e.color; c.lineWidth = (e.width || 2) * px * 1.4; c.lineJoin = "round";
  if (e.dashed) c.setLineDash([6 * px * 1.4, 4 * px * 1.4]);
  if (e.kind === "poly" && e.pts.length > 1) { path(c, e.pts, true); if (e.fill) { c.globalAlpha = 0.25; c.fill(); c.globalAlpha = 1; } c.stroke(); }
  else if (e.kind === "line" && e.pts.length > 1) { path(c, e.pts); c.stroke(); }
  else if (e.kind === "pt") { for (const q of e.pts) { c.beginPath(); c.arc(q[0], q[1], (e.r || 4) * px * 1.4, 0, 7); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 1.2 * px * 1.4; c.stroke(); } }
  else if (e.kind === "circle") { c.beginPath(); c.arc(e.pts[0][0], e.pts[0][1], e.r || 10, 0, 7); c.globalAlpha = 0.14; c.fill(); c.globalAlpha = 1; c.stroke(); }
  c.setLineDash([]);
  if (e.label && e.pts.length) { const q = e.pts[e.kind === "line" ? Math.floor(e.pts.length / 2) : 0]; c.font = `600 ${12 * px * 1.4}px "Segoe UI",sans-serif`; c.textAlign = "center"; c.lineWidth = 3 * px * 1.4; c.strokeStyle = "rgba(255,255,255,.95)"; c.strokeText(e.label, q[0], q[1] - 10 * px * 1.4); c.fillStyle = "#111"; c.fillText(e.label, q[0], q[1] - 10 * px * 1.4); }
  c.restore();
}

export function heatCanvas(p: Project, data: Float32Array, kind: string): HTMLCanvasElement {
  const t = p.terrain, cv = document.createElement("canvas");
  cv.width = t.gw; cv.height = t.gh;
  const g = cv.getContext("2d")!, img = g.createImageData(t.gw, t.gh);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v <= 0) { img.data[i * 4 + 3] = 0; continue; }
    // blue -> green -> yellow -> red (opportunity / density), build: purple -> green
    const q = clamp(v, 0, 1);
    let r: number, gg: number, b: number;
    if (kind === "poi") { r = 255 * q; gg = 60 + 90 * (1 - q); b = 200 * (1 - q) + 40; }
    else if (q < 0.5) { const k = q * 2; r = lerp(40, 250, k); gg = lerp(60, 220, k); b = lerp(160, 40, k); }
    else { const k = (q - 0.5) * 2; r = lerp(250, 60, k); gg = lerp(220, 210, k); b = lerp(40, 70, k); }
    img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 40 + q * 170;
  }
  g.putImageData(img, 0, 0);
  void dist; void noise2; void fbm;
  return cv;
}

export function drawMinimap(c: CanvasRenderingContext2D, p: Project, base: HTMLCanvasElement | null, bs: number, v: View, vw: number, vh: number, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const sx = w / p.world.w, sy = h / p.world.h;
  if (base) c.drawImage(base, 0, 0, base.width, base.height, 0, 0, w, h);
  else { c.fillStyle = "#1c3550"; c.fillRect(0, 0, w, h); }
  void bs;
  c.strokeStyle = "#ff2a6d"; c.lineWidth = 1.5;
  c.strokeRect(v.x * sx, v.y * sy, (vw / v.s) * sx, (vh / v.s) * sy);
}
