import Graph from "graphology";
import { connectedComponents } from "graphology-components";
import { catmull, dist, lerp, nearestOnLine, pip, pipRings, resample, segInt } from "./geom";
import type { Project, Pt, River } from "./types";

export const SNAP_TOL = 7; // merge tolerance for graph nodes (same value the editor uses to attach endpoints)
export const ACCESS_R = 48; // POI -> road access radius
export const DOCK_R = 40;
export const BRIDGE_R = 22;

export const riverCurve = (r: River) => catmull(r.points);

/** Keep explicit connectivity (mouth/source references) geometrically exact after any edit. */
export function reattach(p: Project) {
  const rv = (id?: string) => p.rivers.find((r) => r.id === id);
  const coastPts = p.land.flatMap((l) => l.rings.map((r) => r));
  for (let pass = 0; pass < 3; pass++) {
    for (const r of p.rivers) {
      const n = r.points.length;
      if (n < 2) continue;
      if (r.mouth.kind === "river") {
        const par = rv(r.mouth.ref);
        if (par && par.id !== r.id) { const np = nearestOnLine(catmull(par.points).pts, r.points[n - 1]).pt; r.points[n - 1] = [np[0], np[1]]; }
      } else if (r.mouth.kind === "lake") {
        const lk = p.lakes.find((l) => l.id === r.mouth.ref);
        if (lk && !pip(r.points[n - 1], lk.ring)) {
          const np = nearestOnLine(lk.ring, r.points[n - 1], true).pt;
          const c = lk.ring.reduce((a, q) => [a[0] + q[0] / lk.ring.length, a[1] + q[1] / lk.ring.length] as Pt, [0, 0] as Pt);
          r.points[n - 1] = [lerp(np[0], c[0], 0.12), lerp(np[1], c[1], 0.12)];
        }
      } else if (r.mouth.kind === "sea") {
        let best: Pt | null = null, bd = 70;
        for (const ring of coastPts) { const q = nearestOnLine(ring, r.points[n - 1], true); if (q.d < bd) { bd = q.d; best = q.pt; } }
        if (best) r.points[n - 1] = [best[0], best[1]];
      }
      if (r.source.kind === "river") {
        const par = rv(r.source.ref);
        if (par && par.id !== r.id) { const np = nearestOnLine(catmull(par.points).pts, r.points[0]).pt; r.points[0] = [np[0], np[1]]; }
      } else if (r.source.kind === "lake") {
        const lk = p.lakes.find((l) => l.id === r.source.ref);
        if (lk) {
          const inside = pip(r.points[0], lk.ring), d = nearestOnLine(lk.ring, r.points[0], true);
          if (!inside && d.d > 2) r.points[0] = [d.pt[0], d.pt[1]];
        }
      }
    }
  }
}

export type NodeMap = Map<string, Pt>;
class Idx {
  nodes: NodeMap = new Map();
  buckets = new Map<string, string[]>();
  constructor(public tol: number) {}
  key(p: Pt, g: Graph[]): string {
    const bx = Math.floor(p[0] / this.tol), by = Math.floor(p[1] / this.tol);
    let best: string | null = null, bd = this.tol;
    for (let i = bx - 1; i <= bx + 1; i++) for (let j = by - 1; j <= by + 1; j++) {
      const b = this.buckets.get(i + "," + j);
      if (!b) continue;
      for (const k of b) { const d = dist(this.nodes.get(k)!, p); if (d <= bd) { bd = d; best = k; } }
    }
    if (best) return best;
    const id = "n" + this.nodes.size;
    this.nodes.set(id, [p[0], p[1]]);
    const bk = bx + "," + by;
    (this.buckets.get(bk) || this.buckets.set(bk, []).get(bk)!).push(id);
    for (const gr of g) gr.addNode(id, { x: p[0], y: p[1] });
    return id;
  }
}
function addEdge(g: Graph, a: string, b: string, w: number, attrs: Record<string, unknown>) {
  if (a === b) return;
  if (!g.hasNode(a)) g.addNode(a);
  if (!g.hasNode(b)) g.addNode(b);
  if (g.hasEdge(a, b)) { const old = g.getEdgeAttribute(a, b, "w") as number; if (w < old) g.setEdgeAttribute(a, b, "w", w); return; }
  g.addUndirectedEdge(a, b, { w, ...attrs });
}

export interface Nets {
  foot: Graph; cart: Graph; water: Graph; riverNet: Graph; all: Graph;
  pos: (n: string) => Pt | undefined;
  poiFoot: Record<string, string | null>; poiCart: Record<string, string | null>; poiWater: Record<string, string | null>;
  dockNode: Record<string, string>;
  bridgeless: { road: string; river: string; at: Pt; cart: boolean }[];
  nodes: NodeMap;
}

export function nearestNode(g: Graph, nodes: NodeMap, pt: Pt, maxd: number): string | null {
  let best: string | null = null, bd = maxd;
  g.forEachNode((n) => { const q = nodes.get(n); if (!q) return; const d = dist(q, pt); if (d < bd) { bd = d; best = n; } });
  return best;
}

export function buildNets(p: Project, blocked: Set<string> = new Set()): Nets {
  const foot = new Graph({ type: "undirected" }), cart = new Graph({ type: "undirected" }), water = new Graph({ type: "undirected" });
  const riverNet = new Graph({ type: "undirected" }), all = new Graph({ type: "undirected" });
  const idx = new Idx(SNAP_TOL);
  const R = [foot, cart, water, riverNet, all];
  const nodes = idx.nodes;
  const ensure = (g: Graph, n: string) => { if (!g.hasNode(n)) g.addNode(n); };

  // ---- hydrology ----
  const rsegs: { a: Pt; b: Pt; r: River }[] = [];
  const riverNodes: Record<string, string[]> = {};
  for (const r of p.rivers) {
    if (blocked.has(r.id)) continue;
    const c = riverCurve(r);
    const s = resample(c.pts, 8, c.idx);
    const ns: string[] = [];
    for (const q of s.pts) { const k = idx.key(q, R); ns.push(k); }
    riverNodes[r.id] = ns;
    for (let i = 1; i < s.pts.length; i++) {
      const w = dist(s.pts[i - 1], s.pts[i]);
      rsegs.push({ a: s.pts[i - 1], b: s.pts[i], r });
      const nav = r.nav[Math.min(s.idx[i], r.nav.length - 1)] === 1;
      const mid: Pt = [(s.pts[i - 1][0] + s.pts[i][0]) / 2, (s.pts[i - 1][1] + s.pts[i][1]) / 2];
      const fall = r.feats.some((f) => f.kind === "waterfall" && dist(f.at, mid) < 14);
      const rap = r.feats.some((f) => (f.kind === "rapids" || f.kind === "weir") && dist(f.at, mid) < 24);
      addEdge(riverNet, ns[i - 1], ns[i], w, { river: r.id, nav, fall });
      if (nav && !fall) { addEdge(water, ns[i - 1], ns[i], w * (rap ? 3 : 1), { river: r.id, rap }); addEdge(all, ns[i - 1], ns[i], w * (rap ? 3 : 1), { river: r.id }); }
    }
  }
  const lakeNode = (id: string) => "L:" + id;
  for (const lk of p.lakes) {
    for (const g of [riverNet, water, all]) g.addNode(lakeNode(lk.id));
    nodes.set(lakeNode(lk.id), lk.ring.reduce((a, q) => [a[0] + q[0] / lk.ring.length, a[1] + q[1] / lk.ring.length] as Pt, [0, 0] as Pt));
  }
  for (const r of p.rivers) {
    const ns = riverNodes[r.id];
    if (!ns) continue;
    for (const lk of p.lakes) {
      const cen = nodes.get(lakeNode(lk.id))!;
      for (const k of ns) {
        const q = nodes.get(k)!;
        const near = pip(q, lk.ring) || nearestOnLine(lk.ring, q, true).d < 9;
        if (!near) continue;
        const w = Math.max(4, dist(q, cen) * 0.5);
        addEdge(riverNet, k, lakeNode(lk.id), w, { lake: lk.id });
        if (water.hasNode(k) && water.degree(k) > 0) { addEdge(water, k, lakeNode(lk.id), w, { lake: lk.id }); addEdge(all, k, lakeNode(lk.id), w, { lake: lk.id }); }
      }
    }
    if (r.mouth.kind === "sea") {
      const k = ns[ns.length - 1];
      for (const g of [riverNet, water, all]) { ensure(g, "SEA"); }
      addEdge(riverNet, k, "SEA", 0.5, { sea: 1 });
      if (water.hasNode(k) && water.degree(k) > 0) { addEdge(water, k, "SEA", 0.5, {}); addEdge(all, k, "SEA", 0.5, {}); }
    }
  }
  // ---- roads ----
  const bridges = p.bridges.filter((b) => !blocked.has(b.id));
  const lakeRings = p.lakes.map((l) => l.ring);
  const bridgeless: Nets["bridgeless"] = [];
  const onLand = (q: Pt) => p.land.some((l) => pipRings(q, l.rings));
  const hash = new Map<string, number[]>();
  rsegs.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s.a[0], s.b[0]) / 40), x1 = Math.floor(Math.max(s.a[0], s.b[0]) / 40);
    const y0 = Math.floor(Math.min(s.a[1], s.b[1]) / 40), y1 = Math.floor(Math.max(s.a[1], s.b[1]) / 40);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + "," + y; (hash.get(k) || hash.set(k, []).get(k)!).push(i); }
  });
  const roadNodes: Record<string, string[]> = {};
  for (const rd of p.roads) {
    if (rd.kind === "ferry" || blocked.has(rd.id) || rd.points.length < 2) continue;
    const c = catmull(rd.points);
    const s = resample(c.pts, 8);
    const ns = s.pts.map((q) => idx.key(q, R));
    roadNodes[rd.id] = ns;
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i], w = dist(a, b);
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (lakeRings.some((r) => pip(mid, r)) || !onLand(mid)) continue;
      let blockFoot = false, blockCart = false, fordCost = 1;
      const seen = new Set<number>();
      const x0 = Math.floor(Math.min(a[0], b[0]) / 40), x1 = Math.floor(Math.max(a[0], b[0]) / 40);
      const y0 = Math.floor(Math.min(a[1], b[1]) / 40), y1 = Math.floor(Math.max(a[1], b[1]) / 40);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const si of hash.get(x + "," + y) || []) {
        if (seen.has(si)) continue;
        seen.add(si);
        const h = segInt(a, b, rsegs[si].a, rsegs[si].b);
        if (!h) continue;
        const br = bridges.find((bb) => dist(bb.at, h.p) < BRIDGE_R);
        if (br) { if (br.load !== "cart") blockCart = true; continue; }
        blockCart = true;
        const riv = rsegs[si].r;
        if (rd.ford || riv.fordable || (riv.kind !== "canal" && riv.width <= 3)) fordCost = 3;
        else blockFoot = true;
        bridgeless.push({ road: rd.id, river: riv.id, at: h.p, cart: rd.kind === "cart" });
      }
      if (!blockFoot) addEdge(foot, ns[i - 1], ns[i], w * fordCost, { road: rd.id, kind: rd.kind });
      if (rd.kind === "cart" && !blockCart) addEdge(cart, ns[i - 1], ns[i], w, { road: rd.id, kind: rd.kind });
      if (!blockFoot) addEdge(all, ns[i - 1], ns[i], w * fordCost, { road: rd.id });
    }
  }
  // ---- docks & ferries ----
  const dockNode: Record<string, string> = {};
  for (const d of p.docks) {
    if (blocked.has(d.id)) continue;
    const k = "D:" + d.id;
    nodes.set(k, d.at);
    for (const g of R) g.addNode(k);
    dockNode[d.id] = k;
    if (d.water === "sea") { for (const g of [water, all, riverNet]) { ensure(g, "SEA"); addEdge(g, k, "SEA", 4, {}); } }
    else if (p.lakes.some((l) => l.id === d.water)) { for (const g of [water, all, riverNet]) addEdge(g, k, lakeNode(d.water), 6, {}); }
    else {
      const ns = riverNodes[d.water];
      if (ns) {
        let best: string | null = null, bd = DOCK_R;
        for (const n of ns) { const q = dist(nodes.get(n)!, d.at); if (q < bd && water.hasNode(n) && water.degree(n) > 0) { bd = q; best = n; } }
        if (best) { addEdge(water, k, best, bd, {}); addEdge(all, k, best, bd, {}); }
        let b2: string | null = null, bd2 = DOCK_R;
        for (const n of ns) { const q = dist(nodes.get(n)!, d.at); if (q < bd2) { bd2 = q; b2 = n; } }
        if (b2) addEdge(riverNet, k, b2, bd2, {});
      }
    }
    for (const [g, gk] of [[foot, "foot"], [cart, "cart"]] as [Graph, string][]) {
      let best: string | null = null, bd = DOCK_R;
      g.forEachNode((n) => { if (n.startsWith("D:") || n.startsWith("L:") || n === "SEA") return; const q = dist(nodes.get(n)!, d.at); if (q < bd) { bd = q; best = n; } });
      if (best) { addEdge(g, k, best, bd, { dock: 1 }); if (gk === "foot") addEdge(all, k, best, bd, {}); }
    }
  }
  for (const rd of p.roads) {
    if (rd.kind !== "ferry" || blocked.has(rd.id) || rd.points.length < 2) continue;
    const ends = [rd.points[0], rd.points[rd.points.length - 1]];
    const ks = ends.map((e) => {
      let best: string | null = null, bd = 34;
      for (const d of p.docks) { if (blocked.has(d.id)) continue; const q = dist(d.at, e); if (q < bd) { bd = q; best = "D:" + d.id; } }
      return best;
    });
    if (ks[0] && ks[1]) {
      let len = 0; const c = catmull(rd.points).pts;
      for (let i = 1; i < c.length; i++) len += dist(c[i - 1], c[i]);
      addEdge(water, ks[0], ks[1], len, { ferry: rd.id }); addEdge(all, ks[0], ks[1], len, { ferry: rd.id }); addEdge(riverNet, ks[0], ks[1], len, { ferry: rd.id });
    }
  }
  const mkAccess = (g: Graph) => {
    const out: Record<string, string | null> = {};
    for (const po of p.pois) out[po.id] = nearestNode(g, nodes, po.at, ACCESS_R);
    return out;
  };
  const poiFoot = mkAccess(foot), poiCart = mkAccess(cart);
  const poiWater: Record<string, string | null> = {};
  for (const po of p.pois) {
    let best: string | null = null, bd = 70;
    for (const d of p.docks) { const q = dist(d.at, po.at); if (q < bd && dockNode[d.id]) { bd = q; best = dockNode[d.id]; } }
    poiWater[po.id] = best;
  }
  return { foot, cart, water, riverNet, all, pos: (n) => nodes.get(n), poiFoot, poiCart, poiWater, dockNode, bridgeless, nodes };
}

export function distMap(g: Graph, src: string, maxCost = Infinity, avoid?: (n: string) => boolean): Map<string, number> {
  const d = new Map<string, number>();
  if (!g.hasNode(src)) return d;
  const heap: [number, string][] = [[0, src]];
  d.set(src, 0);
  const push = (it: [number, string]) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const done = new Set<string>();
  while (heap.length) {
    const [c, n] = pop();
    if (done.has(n)) continue;
    done.add(n);
    if (c > maxCost) break;
    g.forEachEdge(n, (_e, at, s, t) => {
      const o = s === n ? t : s;
      if (avoid && avoid(o)) return;
      const nc = c + (at.w as number);
      if (nc < (d.get(o) ?? Infinity)) { d.set(o, nc); push([nc, o]); }
    });
  }
  return d;
}
export function components(g: Graph): string[][] {
  return connectedComponents(g);
}
