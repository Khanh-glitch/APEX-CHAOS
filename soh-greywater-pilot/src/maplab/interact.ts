/* eslint-disable @typescript-eslint/no-explicit-any */
import { circlePoly, clipDiff, clipUnion, catmull, dist, lineInts, nearestOnLine, pip, rdpRing, clamp, bbox } from "./geom";
import type { Poly } from "./geom";
import { houseTest, computeFields } from "./analysis";
import type { Fields } from "./analysis";
import { reattach } from "./graph";
import { fixNav, translateObj, Store } from "./store";
import type { AnyObj } from "./store";
import type { Overlay } from "./render";
import { fixTerrainAfterLand, landMask } from "./terrain";
import { ARCHE_BY_ID, COLLS, ELDERS, uid } from "./types";
import type { CollKey, Pt, Project } from "./types";

const LAYER_OF: Record<CollKey, string> = { land: "terrain", lakes: "lakes", rivers: "rivers", roads: "roads", bridges: "bridges", docks: "docks", pois: "pois", zones: "zones", resources: "resources", spawns: "spawns", elders: "elders", labels: "labels" };

export interface Hit { id: string; coll: CollKey; d: number }
export function hitTest(st: Store, q: Pt): Hit | null {
  const p = st.project, s = st.view.s, L = st.ui.layers;
  const vis = (c: CollKey, o: AnyObj) => (L as any)[LAYER_OF[c]] && !o.hidden && !st.ui.lockedColls.has(c);
  let best: Hit | null = null;
  const cand = (id: string, coll: CollKey, d: number, bias: number) => { const dd = d + bias; if (!best || dd < best.d) best = { id, coll, d: dd }; };
  for (const o of p.pois as AnyObj[]) if (vis("pois", o)) { const a = ARCHE_BY_ID[o.arche] || ARCHE_BY_ID.custom; const R = Math.max(9, 6 + a.r * 0.14 * o.scale); const d = dist(o.at, q); if (d < R) cand(o.id, "pois", d, -50); }
  for (const c of ["docks", "bridges"] as CollKey[]) for (const o of p[c] as AnyObj[]) if (vis(c, o)) { const d = dist(o.at, q); if (d < 9) cand(o.id, c, d, -40); }
  for (const o of p.spawns as AnyObj[]) if (vis("spawns", o)) { const d = dist([o.at[0], o.at[1] - 8], q); if (d < 11) cand(o.id, "spawns", d, -40); }
  for (const o of p.resources as AnyObj[]) if (vis("resources", o)) { const d = dist(o.at, q); if (d < 6 + o.dens) cand(o.id, "resources", d, -30); }
  for (const o of p.labels as AnyObj[]) if (vis("labels", o)) { if (Math.abs(q[0] - o.at[0]) < o.text.length * o.size * 0.32 && Math.abs(q[1] - o.at[1]) < o.size * 0.6) cand(o.id, "labels", 5, -20); }
  const thr = Math.max(6 / s, 4);
  for (const c of ["roads", "rivers"] as CollKey[]) for (const o of p[c] as AnyObj[]) if (vis(c, o) && o.points.length > 1) { const n = nearestOnLine(catmull(o.points).pts, q); const w = c === "rivers" ? o.width / 2 + 2 : 3; if (n.d < Math.max(thr, w)) cand(o.id, c, n.d, -10); }
  for (const o of p.lakes as AnyObj[]) if (vis("lakes", o) && pip(q, o.ring)) cand(o.id, "lakes", 0, 0);
  for (const o of p.zones as AnyObj[]) if (vis("zones", o) && o.ring.length > 2 && pip(q, o.ring)) cand(o.id, "zones", 1, 5);
  for (const o of p.elders as AnyObj[]) if (vis("elders", o)) { if (o.core.length > 2 && pip(q, o.core)) cand(o.id, "elders", 2, 8); else if (o.outer.length > 2 && pip(q, o.outer)) cand(o.id, "elders", 3, 12); }
  if (!best) for (const o of p.land as AnyObj[]) if (pip(q, o.rings[0]) && !(o.rings.slice(1) as Pt[][]).some((h) => pip(q, h))) cand(o.id, "land", 4, 30);
  return best;
}

export function vertexSets(o: AnyObj): { key: string; idx?: number; pts: Pt[] }[] {
  const out: { key: string; idx?: number; pts: Pt[] }[] = [];
  for (const k of ["points", "ring", "outer", "core", "foot", "deep"]) if (Array.isArray(o[k]) && o[k].length) out.push({ key: k, pts: o[k] });
  if (o.rings) (o.rings as Pt[][]).forEach((r, i) => out.push({ key: "rings", idx: i, pts: r }));
  if (o.arenas) (o.arenas as Pt[][]).forEach((r, i) => out.push({ key: "arenas", idx: i, pts: r }));
  if (Array.isArray(o.approach) && o.approach.length) out.push({ key: "approach", pts: o.approach });
  if (Array.isArray(o.retreat) && o.retreat.length) out.push({ key: "retreat", pts: o.retreat });
  return out;
}
const MIN_PTS: Record<string, number> = { points: 2, approach: 0, retreat: 0 };

export function fitView(st: Store) {
  const { w, h } = st.canvasSize, p = st.project;
  const s = Math.min(w / (p.world.w + 60), h / (p.world.h + 60));
  st.view = { s, x: p.world.w / 2 - w / 2 / s, y: p.world.h / 2 - h / 2 / s };
  st.emit();
}
export function zoomTo(st: Store, pts: Pt[], pad = 80) {
  if (!pts.length) return;
  const bb = bbox(pts), { w, h } = st.canvasSize;
  const s = clamp(Math.min(w / (bb[2] - bb[0] + pad * 2), h / (bb[3] - bb[1] + pad * 2)), 0.2, 4);
  st.view = { s, x: (bb[0] + bb[2]) / 2 - w / 2 / s, y: (bb[1] + bb[3]) / 2 - h / 2 / s };
  st.emit();
}
export function objectAnchor(o: AnyObj): Pt[] {
  if (o.at) return [o.at];
  const pts = o.points || o.ring || (o.rings && o.rings[0]) || o.outer;
  return pts || [];
}

type Drag =
  | { k: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { k: "move"; last: Pt; moved: boolean }
  | { k: "vertex"; id: string; key: string; idx?: number; i: number }
  | { k: "fvertex"; id: string; key: string; idx?: number; i: number }
  | { k: "box"; a: Pt; b: Pt; add: boolean }
  | { k: "brush"; last: Pt; before: Uint8Array | null }
  | { k: "measure"; a: Pt; b: Pt }
  | { k: "region"; a: Pt; b: Pt };

export class Interaction {
  drag: Drag | null = null;
  draft: Pt[] = [];
  cursor: Pt = [0, 0];
  space = false;
  hoverId: string | null = null;
  fields: Fields | null = null;
  fieldsV = -1;
  busy = false;
  onContext: ((x: number, y: number, hit: Hit | null, w: Pt) => void) | null = null;
  snapLabel = "";
  constructor(public st: Store, public cv: HTMLCanvasElement) {}

  getFields(): Fields {
    if (!this.fields || this.fieldsV !== this.st.version) { this.fields = computeFields(this.st.project); this.fieldsV = this.st.version; }
    return this.fields;
  }
  toWorld(e: { clientX: number; clientY: number }): Pt {
    const r = this.cv.getBoundingClientRect(), v = this.st.view;
    return [v.x + (e.clientX - r.left) / v.s, v.y + (e.clientY - r.top) / v.s];
  }
  gridSnap(q: Pt): Pt {
    const g = Math.max(5, this.st.ui.gridSize / 10);
    return this.st.ui.snap ? [Math.round(q[0] / g) * g, Math.round(q[1] / g) * g] : q;
  }
  /** Smart snapping: attaches to POI centres, docks, road/river curves, lake shores and coast. */
  snapPoint(q: Pt, tool: string): Pt {
    this.snapLabel = "";
    if (!this.st.ui.snap) return q;
    const p = this.st.project, thr = 11 / this.st.view.s;
    let best: Pt | null = null, bd = thr, lab = "";
    const tryP = (c: Pt, l: string) => { const d = dist(c, q); if (d < bd) { bd = d; best = c; lab = l; } };
    const tryL = (pts: Pt[], l: string, closed = false) => { if (pts.length < 2) return; const n = nearestOnLine(pts, q, closed); if (n.d < bd) { bd = n.d; best = n.pt; lab = l; } };
    const road = tool === "road" || tool === "elder";
    if (road) { for (const o of p.pois) tryP(o.at, "POI " + o.name); for (const o of p.docks) tryP(o.at, "Bến " + o.name); }
    if (road || tool === "river" || tool === "canal") { for (const r of p.roads) if (road && r.kind !== "ferry") tryL(catmull(r.points).pts, "nối đường " + r.name); if (!road) for (const r of p.rivers) tryL(catmull(r.points).pts, "nối sông " + r.name); }
    if (tool === "river" || tool === "canal") { for (const l of p.lakes) tryL(l.ring, "bờ hồ " + l.name, true); for (const l of p.land) for (const r of l.rings) tryL(r, "bờ biển", true); }
    if (tool === "road") for (const r of p.rivers) { void r; }
    if (best) { this.snapLabel = lab; return best; }
    return this.gridSnap(q);
  }

  attach() {
    const cv = this.cv;
    const down = (e: PointerEvent) => this.down(e), move = (e: PointerEvent) => this.move(e), up = (e: PointerEvent) => this.up(e);
    const wheel = (e: WheelEvent) => { e.preventDefault(); this.wheel(e); };
    const ctx = (e: MouseEvent) => { e.preventDefault(); const w = this.toWorld(e); this.onContext?.(e.clientX, e.clientY, hitTest(this.st, w), w); };
    const dbl = (e: MouseEvent) => this.dbl(e);
    const dragover = (e: DragEvent) => { if (e.dataTransfer?.types.includes("application/x-soh-arche")) e.preventDefault(); };
    const drop = (e: DragEvent) => { const a = e.dataTransfer?.getData("application/x-soh-arche"); if (!a) return; e.preventDefault(); const w = this.gridSnap(this.toWorld(e)); this.st.addObject("pois", { arche: a, at: w }, "Kéo thả POI"); this.st.setUI({ tool: "select" }); };
    const kd = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "SELECT") return; if (e.code === "Space") { this.space = true; e.preventDefault(); } };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") this.space = false; };
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    cv.addEventListener("wheel", wheel, { passive: false }); cv.addEventListener("contextmenu", ctx); cv.addEventListener("dblclick", dbl);
    cv.addEventListener("dragover", dragover); cv.addEventListener("drop", drop);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => {
      cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      cv.removeEventListener("wheel", wheel); cv.removeEventListener("contextmenu", ctx); cv.removeEventListener("dblclick", dbl);
      cv.removeEventListener("dragover", dragover); cv.removeEventListener("drop", drop); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
    };
  }

  wheel(e: WheelEvent) {
    const v = this.st.view, r = this.cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const wx = v.x + sx / v.s, wy = v.y + sy / v.s;
    const s = clamp(v.s * Math.pow(1.0016, -e.deltaY), 0.15, 10);
    this.st.view = { s, x: wx - sx / s, y: wy - sy / s };
    this.st.emit();
  }

  extras(): Overlay[] {
    const o: Overlay[] = [], t = this.st.ui.tool, br = this.st.ui.brush;
    if (["land_add", "land_sub", "elev", "biome"].includes(t)) o.push({ kind: "circle", pts: [this.cursor], r: br.size, color: t === "land_sub" ? "#ff4d4d" : "#2cff7a", width: 1.5 });
    if (this.draft.length) {
      const poly = ["land_poly", "lake", "zone"].includes(t) || (t === "elder" && this.st.ui.opts.elderPart !== "approach");
      const pts = [...this.draft, this.cursor];
      o.push({ kind: poly ? "poly" : "line", pts: poly ? pts : pts, color: "#ff2a6d", dashed: true, fill: poly, width: 2 });
      o.push({ kind: "pt", pts: this.draft, color: "#ff2a6d", r: 3.5 });
    }
    if (this.snapLabel && ["river", "canal", "road", "dock"].includes(t)) o.push({ kind: "pt", pts: [this.cursor], color: "#ffd23f", r: 5, label: this.snapLabel });
    const d = this.drag;
    if (d?.k === "box" || d?.k === "region") { const a = d.a, b = d.b; o.push({ kind: "poly", pts: [a, [b[0], a[1]], b, [a[0], b[1]]], color: d.k === "box" ? "#4da3ff" : "#ff9f1c", dashed: true, fill: true }); }
    if (d?.k === "measure") o.push({ kind: "line", pts: [d.a, d.b], color: "#ffd23f", label: `${dist(d.a, d.b).toFixed(0)} u`, width: 2.5 });
    const rr = this.st.ui.regionRect;
    if (rr && d?.k !== "region") o.push({ kind: "poly", pts: [[rr[0], rr[1]], [rr[2], rr[1]], [rr[2], rr[3]], [rr[0], rr[3]]], color: "#ff9f1c", dashed: true, fill: true, label: "Vùng chọn" });
    const tr = this.st.ui.testResult;
    if (tr) o.push({ kind: "circle", pts: [tr.at], r: 14, color: "#a64dff", label: "Điểm thử nhà", width: 2 });
    for (const pr of this.st.proposals) o.push(...pr.overlays);
    o.push(...this.st.reachOv);
    return o;
  }

  down(e: PointerEvent) {
    this.cv.setPointerCapture(e.pointerId);
    const st = this.st, ui = st.ui, w = this.toWorld(e), tool = ui.tool;
    this.cursor = w;
    if (e.button === 1 || (e.button === 0 && (this.space || tool === "pan"))) { this.drag = { k: "pan", sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y }; return; }
    if (e.button === 2) return;
    if (e.button !== 0) return;
    if (tool === "select") {
      const single = st.sel.size === 1 ? st.get([...st.sel][0]) : null;
      if (single && !single.locked) {
        const thr = 8 / st.view.s;
        for (const vs of vertexSets(single)) for (let i = 0; i < vs.pts.length; i++) if (dist(vs.pts[i], w) < thr) {
          if (e.altKey) { this.removeVertex(single.id, vs.key, vs.idx, i); return; }
          st.beginTx("Di chuyển điểm"); ui.selVertex = i; this.drag = { k: "vertex", id: single.id, key: vs.key, idx: vs.idx, i }; st.emit(); return;
        }
      }
      const hit = hitTest(st, w);
      if (hit) {
        const ids = st.withGroup([hit.id]);
        if (e.shiftKey) st.select(ids, true);
        else if (!st.sel.has(hit.id)) st.select(ids);
        if (st.sel.has(hit.id)) { const locked = st.selected().every((o) => o.locked); if (!locked) { st.beginTx("Di chuyển"); this.drag = { k: "move", last: this.gridSnap(w), moved: false }; } }
      } else { this.drag = { k: "box", a: w, b: w, add: e.shiftKey }; if (!e.shiftKey) st.select([]); }
      return;
    }
    if (tool === "land_add" || tool === "land_sub") { st.beginTx(tool === "land_add" ? "Brush thêm đất" : "Brush xóa đất"); this.busy = true; this.drag = { k: "brush", last: w, before: landMask(st.project) }; this.landBrush(w, tool === "land_add"); return; }
    if (tool === "elev" || tool === "biome") { st.beginTx(tool === "elev" ? "Vẽ độ cao" : "Vẽ biome"); this.busy = true; this.drag = { k: "brush", last: w, before: null }; this.terrainBrush(w, e.shiftKey); return; }
    if (tool === "measure") { this.drag = { k: "measure", a: w, b: w }; return; }
    if (tool === "region") { this.drag = { k: "region", a: w, b: w }; return; }
    // click-based tools
    const poly = ["land_poly", "lake", "zone"].includes(tool) || (tool === "elder" && ui.opts.elderPart !== "approach");
    const line = ["river", "canal", "road"].includes(tool);
    if (poly || line) { const q = line ? this.snapPoint(w, tool) : this.gridSnap(w); this.draft.push(q); st.emit(); return; }
    if (tool === "poi") { st.addObject("pois", { arche: ui.opts.arche, at: this.gridSnap(w) }, "Đặt POI"); return; }
    if (tool === "resource") { const k = ui.opts.resKind; st.addObject("resources", { kind: k, at: this.gridSnap(w), name: k }, "Đặt nguồn"); return; }
    if (tool === "spawn") { st.addObject("spawns", { at: this.gridSnap(w), region: "" }, "Đặt spawn"); return; }
    if (tool === "label") { const t = window.prompt("Nội dung nhãn:", "Nhãn mới"); if (t) st.addObject("labels", { at: w, text: t, name: t, style: ui.opts.labelStyle, size: ui.opts.labelStyle === "region" ? 22 : 15 }, "Thêm nhãn"); return; }
    if (tool === "elder" && ui.opts.elderPart === "approach") { this.addElderPart([w]); return; }
    if (tool === "bridge") { this.placeBridge(w); return; }
    if (tool === "dock") { this.placeDock(w); return; }
    if (tool === "housetest") { const f = this.getFields(); const r = houseTest(st.project, f, w); st.setUI({ testResult: { at: w, lines: r.lines }, panel: "inspect" }); return; }
  }

  move(e: PointerEvent) {
    const st = this.st, w = this.toWorld(e);
    this.cursor = w;
    const d = this.drag;
    if (!d) {
      if (st.ui.tool === "select") { const h = hitTest(st, w); const id = h?.id || null; if (id !== this.hoverId) { this.hoverId = id; st.hoverId = id; } }
      if (["river", "canal", "road", "dock"].includes(st.ui.tool)) this.snapPoint(w, st.ui.tool);
      st.emit();
      return;
    }
    if (d.k === "pan") { st.view = { ...st.view, x: d.vx - (e.clientX - d.sx) / st.view.s, y: d.vy - (e.clientY - d.sy) / st.view.s }; st.emit(); return; }
    if (d.k === "move") {
      const q = this.gridSnap(w), dx = q[0] - d.last[0], dy = q[1] - d.last[1];
      if (dx || dy) { d.last = q; d.moved = true; const ids = st.selected().filter((o) => !o.locked).map((o) => o.id); st.mutate((p) => { for (const id of ids) { const o = (COLLS.map((c) => (p[c] as AnyObj[]).find((x) => x.id === id)).find(Boolean)) as AnyObj; if (o) translateObj(o, dx, dy); } reattach(p); }, { base: ids.some((i) => i.startsWith("ld_")) }); }
      return;
    }
    if (d.k === "vertex") {
      const o = st.get(d.id);
      const q = o && (o.points || o.outer) ? this.snapPoint(w, o.kind === "canal" || o.mouth ? "river" : o.points ? "road" : "") : this.gridSnap(w);
      st.mutate((p) => { const ob = (COLLS.map((c) => (p[c] as AnyObj[]).find((x) => x.id === d.id)).find(Boolean)) as AnyObj; if (!ob) return; const arr = d.idx !== undefined ? ob[d.key][d.idx] : ob[d.key]; arr[d.i] = [q[0], q[1]]; if (ob.mouth) reattach(p); }, { base: d.id.startsWith("ld_") });
      return;
    }
    if (d.k === "box" || d.k === "region" || d.k === "measure") { d.b = w; st.emit(); return; }
    if (d.k === "brush") {
      const t = st.ui.tool;
      if (dist(d.last, w) >= st.ui.brush.size * 0.3) {
        d.last = w;
        if (t === "land_add" || t === "land_sub") this.landBrush(w, t === "land_add"); else this.terrainBrush(w, e.shiftKey);
      } else st.emit();
    }
  }

  up(_e: PointerEvent) {
    const st = this.st, d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.k === "move" || d.k === "vertex") { st.mutate((p) => reattach(p), {}); st.endTx(); st.ui.selVertex = d.k === "vertex" ? d.i : -1; st.emit(); }
    else if (d.k === "box") {
      const a = d.a, b = d.b, x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      if (x1 - x0 > 3 || y1 - y0 > 3) {
        const ids: string[] = [], L = st.ui.layers as any;
        const p = st.project;
        for (const c of COLLS) { if (c === "land" || !L[LAYER_OF[c]]) continue; for (const o of p[c] as AnyObj[]) { if (o.hidden) continue; const an = objectAnchor(o); const m = an.length === 1 ? an[0] : an.length ? [an.reduce((s, q) => s + q[0], 0) / an.length, an.reduce((s, q) => s + q[1], 0) / an.length] : null; if (m && m[0] >= x0 && m[0] <= x1 && m[1] >= y0 && m[1] <= y1) ids.push(o.id); } }
        st.select(st.withGroup(ids), d.add);
      } else st.emit();
    } else if (d.k === "region") { const a = d.a, b = d.b; if (Math.abs(a[0] - b[0]) > 8) st.setUI({ regionRect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], panel: "smart" }); }
    else if (d.k === "brush") {
      this.busy = false;
      if (d.before) { const before = d.before; st.mutate((p) => { fixTerrainAfterLand(p, before); }, { base: true }); }
      st.endTx(); st.mutate(() => undefined, { base: true });
    }
  }

  dbl(e: MouseEvent) {
    const st = this.st, tool = st.ui.tool, w = this.toWorld(e);
    if (this.draft.length && ["land_poly", "lake", "zone", "river", "canal", "road", "elder"].includes(tool)) { this.draft.pop(); this.finishDraft(); return; }
    if (tool === "select" && st.sel.size === 1) {
      const o = st.get([...st.sel][0]);
      if (!o || o.locked) return;
      let best: { key: string; idx?: number; i: number; d: number; closed: boolean; pt: Pt } | null = null;
      for (const vs of vertexSets(o)) { if (["retreat", "approach"].includes(vs.key)) continue; const closed = vs.key !== "points"; const n = nearestOnLine(vs.pts, w, closed); if (n.d < 10 / st.view.s && (!best || n.d < best.d)) best = { key: vs.key, idx: vs.idx, i: n.i, d: n.d, closed, pt: n.pt }; }
      if (best) { const b = best; st.commit("Thêm đỉnh", (p) => { const ob = (COLLS.map((c) => (p[c] as AnyObj[]).find((x) => x.id === o.id)).find(Boolean)) as AnyObj; const arr: Pt[] = b.idx !== undefined ? ob[b.key][b.idx] : ob[b.key]; arr.splice(b.i + 1, 0, [b.pt[0], b.pt[1]]); if (ob.nav) ob.nav.splice(b.i, 0, ob.nav[b.i] ?? 0); }, { base: o.id.startsWith("ld_") }); }
    }
  }

  removeVertex(id: string, key: string, idx: number | undefined, i: number) {
    const st = this.st;
    st.commit("Xóa đỉnh", (p) => {
      const ob = (COLLS.map((c) => (p[c] as AnyObj[]).find((x) => x.id === id)).find(Boolean)) as AnyObj;
      const arr: Pt[] = idx !== undefined ? ob[key][idx] : ob[key];
      const min = key in MIN_PTS ? MIN_PTS[key] : 3;
      if (arr.length <= min) return;
      arr.splice(i, 1);
      if (ob.nav) { ob.nav.splice(Math.min(i, ob.nav.length - 1), 1); fixNav(ob as any); }
      reattach(p);
    }, { base: id.startsWith("ld_") });
  }

  finishDraft() {
    const st = this.st, tool = st.ui.tool, pts = this.draft.slice();
    this.draft = [];
    const o = st.ui.opts;
    if (["river", "canal", "road"].includes(tool) && pts.length >= 2) {
      if (tool === "road") {
        const ob = st.addObject("roads", { points: pts, kind: o.roadKind, name: o.roadKind === "ferry" ? "Tuyến phà mới" : "Đường mới" }, "Vẽ đường");
        const n = this.crossings(ob.id).filter((c) => !c.has).length;
        if (n && o.roadKind !== "ferry") st.toast(`${n} giao cắt đường–sông chưa có cầu — dùng nút «Đặt cầu tự động» ở Inspector`);
      } else {
        const kind = tool === "canal" ? "canal" : o.riverKind;
        st.addObject("rivers", { points: pts, kind, width: tool === "canal" ? 3.5 : 4, nav: new Array(pts.length - 1).fill(tool === "canal" ? 1 : 0), name: tool === "canal" ? "Kênh mới" : "Sông mới", reason: tool === "canal" ? "" : undefined, conf: tool === "canal" ? "assumption" : "proposal" }, tool === "canal" ? "Vẽ kênh" : "Vẽ sông");
      }
    } else if (["land_poly", "lake", "zone"].includes(tool) && pts.length >= 3) {
      if (tool === "land_poly") { const before = landMask(st.project); st.addObject("land", { rings: [pts], kind: "islet" }, "Vẽ đất"); st.mutate((p) => fixTerrainAfterLand(p, before), { base: true }); }
      else if (tool === "lake") st.addObject("lakes", { ring: pts }, "Vẽ hồ");
      else st.addObject("zones", { ring: pts }, "Vẽ vùng xây");
    } else if (tool === "elder" && pts.length >= 3) this.addElderPart(pts);
    st.emit();
  }
  cancelDraft() { this.draft = []; this.drag = null; this.st.emit(); }

  addElderPart(pts: Pt[]) {
    const st = this.st, { elderId, elderPart } = st.ui.opts;
    const def = ELDERS.find((x) => x.id === elderId)!;
    let el = st.project.elders.find((x) => x.elder === elderId);
    if (!el) { st.addObject("elders", { id: "el_" + elderId, elder: elderId, name: `${def.name} — ${def.stone}` }, "Thêm lãnh thổ Elder"); el = st.project.elders.find((x) => x.elder === elderId)!; }
    const id = el.id;
    st.commit("Elder: " + elderPart, (p) => { const e = p.elders.find((x) => x.id === id)!; if (elderPart === "outer") e.outer = pts; else if (elderPart === "core") e.core = pts; else if (elderPart === "arena") e.arenas.push(pts); else e.approach.push(pts[0]); });
    st.select([id]);
  }

  crossings(roadId: string): { at: Pt; river: string; ang: number; has: boolean }[] {
    const p = this.st.project, rd = p.roads.find((r) => r.id === roadId);
    if (!rd) return [];
    const c = catmull(rd.points).pts, out: { at: Pt; river: string; ang: number; has: boolean }[] = [];
    for (const rv of p.rivers) for (const h of lineInts(c, catmull(rv.points).pts)) out.push({ at: h.p, river: rv.id, ang: Math.atan2(c[h.i + 1][1] - c[h.i][1], c[h.i + 1][0] - c[h.i][0]), has: p.bridges.some((b) => dist(b.at, h.p) < 22) || (rv.kind !== "canal" && rv.width <= 3 && rd.kind !== "cart") });
    return out;
  }
  autoBridges(roadId: string) {
    const st = this.st, rd = st.project.roads.find((r) => r.id === roadId);
    if (!rd) return;
    const cr = this.crossings(roadId).filter((c) => !c.has);
    if (!cr.length) { st.toast("Mọi giao cắt đã có cầu/điểm lội"); return; }
    st.commit("Đặt cầu tự động", (p) => { for (const c of cr) p.bridges.push({ id: uid("br"), name: "Cầu " + (p.rivers.find((r) => r.id === c.river)?.name || ""), at: c.at, ang: c.ang, load: rd.kind === "cart" ? "cart" : "foot", conf: "proposal" }); });
    st.toast(`Đã đặt ${cr.length} cầu`);
  }
  placeBridge(w: Pt) {
    const st = this.st, p = st.project;
    let best: { at: Pt; ang: number; d: number; name: string } | null = null;
    for (const rd of p.roads) { if (rd.kind === "ferry") continue; for (const c of this.crossings(rd.id)) { const d = dist(c.at, w); if (d < 40 / st.view.s + 10 && (!best || d < best.d)) best = { at: c.at, ang: c.ang, d, name: p.rivers.find((r) => r.id === c.river)?.name || "" }; } }
    if (!best) {
      let bd = 30 / st.view.s + 6, bb: { at: Pt; ang: number } | null = null;
      for (const rd of p.roads) { if (rd.kind === "ferry") continue; const cu = catmull(rd.points).pts; const n = nearestOnLine(cu, w); if (n.d < bd) { bd = n.d; bb = { at: n.pt, ang: Math.atan2(cu[n.i + 1][1] - cu[n.i][1], cu[n.i + 1][0] - cu[n.i][0]) }; } }
      if (!bb) { st.toast("Đặt cầu gần một con đường (hoặc giao cắt đường–sông)"); return; }
      best = { at: bb.at, ang: bb.ang, d: bd, name: "" };
    }
    st.addObject("bridges", { at: best.at, ang: best.ang, load: st.ui.opts.bridgeLoad, name: "Cầu " + best.name }, "Đặt cầu");
  }
  placeDock(w: Pt) {
    const st = this.st, p = st.project, thr = 30 / st.view.s + 8;
    let best: { at: Pt; d: number; water: string; kind: "inland" | "coastal" } | null = null;
    const t = (pt: Pt, d: number, water: string, kind: "inland" | "coastal") => { if (d < thr && (!best || d < best.d)) best = { at: pt, d, water, kind }; };
    for (const l of p.lakes) { const n = nearestOnLine(l.ring, w, true); t(n.pt, n.d, l.id, "inland"); }
    for (const r of p.rivers) { const n = nearestOnLine(catmull(r.points).pts, w); t(n.pt, n.d, r.id, r.mouth.kind === "sea" && dist(n.pt, r.points[r.points.length - 1]) < 120 ? "coastal" : "inland"); }
    for (const l of p.land) for (const r of l.rings) { const n = nearestOnLine(r, w, true); t(n.pt, n.d, "sea", "coastal"); }
    if (!best) { st.toast("Đặt bến sát bờ hồ/sông/biển"); return; }
    const b = best as { at: Pt; d: number; water: string; kind: "inland" | "coastal" };
    st.addObject("docks", { at: b.at, water: b.water, kind: b.kind, name: "Bến mới" }, "Đặt bến");
  }

  landBrush(c: Pt, add: boolean) {
    const r = this.st.ui.brush.size;
    this.st.mutate((p) => applyLandBrush(p, c, r, add), { base: true });
  }
  terrainBrush(c: Pt, shift: boolean) {
    const st = this.st, b = st.ui.brush, tool = st.ui.tool;
    st.mutate((p) => {
      const t = p.terrain, R = b.size;
      const i0 = Math.max(0, Math.floor((c[0] - R) / t.cell)), i1 = Math.min(t.gw - 1, Math.ceil((c[0] + R) / t.cell));
      const j0 = Math.max(0, Math.floor((c[1] - R) / t.cell)), j1 = Math.min(t.gh - 1, Math.ceil((c[1] + R) / t.cell));
      const snap = tool === "elev" && (b.elevMode === "smooth" || b.elevMode === "flat") ? Uint8Array.from(t.elev) : null;
      const centerE = t.elev[Math.floor(c[1] / t.cell) * t.gw + Math.floor(c[0] / t.cell)];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * t.gw + i, d = Math.hypot((i + 0.5) * t.cell - c[0], (j + 0.5) * t.cell - c[1]);
        if (d > R || t.elev[k] === 0) continue;
        const f = Math.pow(1 - d / R, 1.4);
        if (tool === "biome") { t.biome[k] = b.biome; continue; }
        const dir = shift ? -1 : 1;
        if (b.elevMode === "raise") t.elev[k] = Math.min(255, t.elev[k] + b.strength * f * 7 * dir);
        else if (b.elevMode === "lower") t.elev[k] = Math.max(2, t.elev[k] - b.strength * f * 7 * dir);
        else if (b.elevMode === "smooth" && snap) { let s = 0, n = 0; for (let jj = -1; jj <= 1; jj++) for (let ii = -1; ii <= 1; ii++) { const x = clamp(i + ii, 0, t.gw - 1), y = clamp(j + jj, 0, t.gh - 1); if (snap[y * t.gw + x] > 0) { s += snap[y * t.gw + x]; n++; } } t.elev[k] = snap[k] + (s / n - snap[k]) * Math.min(1, b.strength * f * 1.2); }
        else if (b.elevMode === "flat") t.elev[k] = Math.round(t.elev[k] + (centerE - t.elev[k]) * Math.min(1, b.strength * f * 0.9));
      }
    }, { base: true });
  }
}

export function applyLandBrush(p: Project, c: Pt, r: number, add: boolean) {
  const circ: Poly[] = [[circlePoly(c, r, 24)]];
  const hit = p.land.filter((l) => !(c[0] + r < Math.min(...l.rings[0].map((q) => q[0])) || c[0] - r > Math.max(...l.rings[0].map((q) => q[0])) || c[1] + r < Math.min(...l.rings[0].map((q) => q[1])) || c[1] - r > Math.max(...l.rings[0].map((q) => q[1]))));
  if (add) {
    if (!hit.length) { p.land.push({ id: uid("ld"), name: "Đảo mới", kind: "islet", rings: [circlePoly(c, r, 24)], conf: "proposal" }); return; }
    let merged: Poly[] = circ;
    for (const l of hit) merged = clipUnion(merged, [l.rings]);
    const keep = hit[0];
    p.land = p.land.filter((l) => !hit.includes(l));
    merged.sort((a, b) => b[0].length - a[0].length);
    merged.forEach((poly, i) => p.land.push({ ...(i === 0 ? keep : { id: uid("ld"), name: "Đảo mới", kind: "islet" as const, conf: "proposal" as const }), kind: i === 0 ? keep.kind : "islet", rings: poly.map((ring) => rdpRing(ring, 0.7)) }));
  } else {
    for (const l of hit) {
      const res = clipDiff([l.rings], circ);
      p.land = p.land.filter((x) => x !== l);
      res.sort((a, b) => b[0].length - a[0].length);
      res.forEach((poly, i) => p.land.push({ ...(i === 0 ? l : { id: uid("ld"), name: l.name + " (tách)", kind: "islet" as const, conf: "proposal" as const }), kind: i === 0 ? l.kind : "islet", rings: poly.map((ring) => rdpRing(ring, 0.7)) }));
    }
  }
}
