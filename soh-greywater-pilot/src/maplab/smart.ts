/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCHES, ARCHE_BY_ID, uid } from "./types";
import type { Pt, Project } from "./types";
import { buildNets, distMap, nearestNode } from "./graph";
import { markRoad, routeRuns, snapToRoads, suggestPoi } from "./analysis";
import type { Fields } from "./analysis";
import { catmull, chaikin, dist, nearestOnLine, pipRings, rdp, rdpRing } from "./geom";
import { fixNav } from "./store";
import type { AnyObj, Proposal, Store } from "./store";
import { regenRegion } from "./terrain";

const pid = () => uid("prop");

/** Auto-smooth selected coast / lake / river / road. Result is a PREVIEW proposal; nothing changes until the user applies it. */
export function proposeSmooth(st: Store): Proposal[] {
  const out: Proposal[] = [];
  const sel = st.selected();
  const changes: { id: string; key: string; idx?: number; pts: Pt[]; oldN: number }[] = [];
  const overlays: Proposal["overlays"] = [];
  for (const o of sel) {
    if (o.locked) continue;
    if (o.rings) o.rings.forEach((r: Pt[], i: number) => { const n = rdpRing(chaikin(r, 1, true), 0.8); changes.push({ id: o.id, key: "rings", idx: i, pts: n, oldN: r.length }); overlays.push({ kind: "poly", pts: n, color: "#ff2a6d", dashed: true }); });
    else if (o.ring) { const n = chaikin(o.ring, 1, true); changes.push({ id: o.id, key: "ring", pts: n, oldN: o.ring.length }); overlays.push({ kind: "poly", pts: n, color: "#ff2a6d", dashed: true }); }
    else if (o.points && o.points.length > 2) { const n = rdp(chaikin(o.points, 1), 2.5); changes.push({ id: o.id, key: "points", pts: n, oldN: o.points.length }); overlays.push({ kind: "line", pts: catmull(n).pts, color: "#ff2a6d", dashed: true, width: 3 }); }
  }
  if (!changes.length) { st.toast("Chọn bờ đảo / hồ / sông / đường để làm mượt"); return out; }
  out.push({
    id: pid(), title: `Làm mượt ${changes.length} đường viền/tuyến`, detail: "Chaikin + rút gọn đỉnh. Xem đường nét đứt hồng trên bản đồ; bấm Áp dụng để xác nhận (Ctrl+Z hoàn tác).", overlays,
    apply: (p) => { for (const c of changes) { for (const coll of ["land", "lakes", "rivers", "roads", "zones"] as const) { const ob = (p[coll] as AnyObj[]).find((x) => x.id === c.id); if (!ob) continue; if (c.idx !== undefined) ob[c.key][c.idx] = c.pts; else ob[c.key] = c.pts; if (ob.nav) { const old = ob.nav.slice(); const n = Math.max(0, c.pts.length - 1); ob.nav = Array.from({ length: n }, (_, i) => old[Math.min(old.length - 1, Math.floor((i / Math.max(1, n)) * old.length))] ?? 0); fixNav(ob as any); } } } },
  });
  return out;
}

/** Generate plausible local roads between selected POIs (terrain-following A*, MST order). */
export function proposeRoads(st: Store, f: Fields, kind: "cart" | "foot" | "trail"): Proposal[] {
  const pois = st.selected().filter((o) => o.at && o.arche);
  if (pois.length < 2) { st.toast("Chọn ≥ 2 POI để tạo đường nội bộ"); return []; }
  const used = new Set([pois[0].id]), edges: [AnyObj, AnyObj][] = [];
  while (used.size < pois.length) {
    let best: [AnyObj, AnyObj] | null = null, bd = Infinity;
    for (const a of pois) if (used.has(a.id)) for (const b of pois) if (!used.has(b.id)) { const d = dist(a.at, b.at); if (d < bd) { bd = d; best = [a, b]; } }
    if (!best) break;
    used.add(best[1].id); edges.push(best);
  }
  const ff: Fields = { ...f, roadFoot: Uint8Array.from(f.roadFoot), roadCart: Uint8Array.from(f.roadCart) };
  const props: { name: string; pts: Pt[] }[] = [];
  for (const [a, b] of edges) {
    for (const [i, run] of routeRuns(ff, a.at, b.at, kind === "cart" ? "cart" : "foot").entries()) {
      const pts = [snapToRoads(st.project, run[0], 12), ...run.slice(1, -1), snapToRoads(st.project, run[run.length - 1], 12)];
      props.push({ name: `Đường ${a.name} – ${b.name}${i ? ` (${i + 1})` : ""}`, pts }); markRoad(ff, pts, kind);
    }
  }
  if (!props.length) { st.toast("Không tìm được tuyến (có thể bị nước/vách chắn, hoặc đã có đường)"); return []; }
  return [{ id: pid(), title: `${props.length} đoạn đường ${kind === "cart" ? "xe hàng" : "mòn"} giữa ${pois.length} POI`, detail: "Bám độ dốc/bề mặt, tái dùng đường sẵn có (T-junction), né nước. Cần đặt cầu thủ công/tự động nếu cắt sông.", overlays: props.map((r) => ({ kind: "line" as const, pts: catmull(r.pts).pts, color: "#ff8c1a", dashed: true, width: 3, label: undefined })), apply: (p) => { for (const r of props) p.roads.push({ id: uid("rd"), name: r.name, points: r.pts, kind, purpose: "Sinh bởi Smart tool", conf: "proposal" }); } }];
}

/** Suggest docks for POIs near navigable water that have none. */
export function proposeDocks(st: Store): Proposal[] {
  const p = st.project, out: Proposal[] = [];
  const cands = p.pois.filter((o) => ["civil", "industry", "water", "research"].includes(ARCHE_BY_ID[o.arche]?.cat || "") && !p.docks.some((d) => dist(d.at, o.at) < 70));
  for (const o of cands) {
    let best: { pt: Pt; d: number; water: string; label: string } | null = null;
    for (const lk of p.lakes) { const n = nearestOnLine(lk.ring, o.at, true); if (n.d < 110 && (!best || n.d < best.d)) best = { pt: n.pt, d: n.d, water: lk.id, label: lk.name }; }
    for (const r of p.rivers) if (r.nav.includes(1)) { const n = nearestOnLine(catmull(r.points).pts, o.at); if (n.d < 110 && (!best || n.d < best.d)) best = { pt: n.pt, d: n.d, water: r.id, label: r.name }; }
    if (!best) continue;
    const b = best;
    out.push({ id: pid(), title: `Bến cho «${o.name}»`, detail: `Cách ${b.d.toFixed(0)}u tới ${b.label} (thủy lộ navigable). Lý do: POI công nghiệp/dân cư gần nước nhưng chưa có điểm lên xuống thuyền; bến rút ngắn tuyến chở hàng nặng.`, overlays: [{ kind: "pt", pts: [b.pt], color: "#00bcd4", r: 5, label: "Bến đề xuất" }, { kind: "line", pts: [o.at, b.pt], color: "#00bcd4", dashed: true }], apply: (pp) => { pp.docks.push({ id: uid("dk"), name: "Bến " + o.name, at: b.pt, kind: "inland", water: b.water, conf: "proposal" }); } });
  }
  if (!out.length) st.toast("Không có POI nào cần thêm bến");
  return out.slice(0, 8);
}

export function proposePois(st: Store, f: Fields, arche: string): Proposal[] {
  const sug = suggestPoi(st.project, f, arche, 5);
  const a = ARCHE_BY_ID[arche];
  if (!sug.length) st.toast("Không tìm được vị trí phù hợp theo luật của loại này");
  return sug.map((s, i) => ({ id: pid(), title: `#${i + 1} ${a.name} (${s.score.toFixed(1)})`, detail: s.reasons.join(" · "), overlays: [{ kind: "pt" as const, pts: [s.at], color: "#a64dff", r: 6, label: `#${i + 1} ${a.name}` }, { kind: "circle" as const, pts: [s.at], r: 30, color: "#a64dff" }], apply: (p: Project) => { p.pois.push({ ...(structuredCloneFromArche(arche, s.at)) }); } }));
}
function structuredCloneFromArche(arche: string, at: Pt) {
  const a = ARCHE_BY_ID[arche], R = a.r;
  const rect = (w: number, h: number, dx = 0, dy = 0): Pt[] => [[-w, -h], [w, -h], [w, h], [-w, h]].map(([u, v]) => [at[0] + dx + u, at[1] + dy + v] as Pt);
  return { id: uid("po"), name: a.name, at, arche, rot: 0, scale: 1, foot: rect(R * 0.8, R * 0.55), deep: a.depth === "multi" ? rect(R * 0.45, R * 0.3, R * 0.15, R * 0.1) : undefined, depth: a.depth, role: a.role, opp: a.opp, access: a.access, resources: [...a.res], gate: a.gate, retreat: a.depth === "multi" ? ([[at[0] + R * 2, at[1] - R * 2]] as Pt[]) : [], links: [], conf: "proposal" as const };
}

export const CLUSTERS: { id: string; name: string; parts: [string, number, number][] }[] = [
  { id: "village", name: "Cụm làng (làng + xóm + kho + bến nhỏ)", parts: [["village", 0, 0], ["hamlet", 50, 20], ["warehouse", -46, 28], ["pier", 8, 56]] },
  { id: "mining", name: "Cụm khai thác (mỏ + xưởng luyện + kho + trạm)", parts: [["mine", 0, 0], ["smelter", 56, 24], ["warehouse", -44, 36], ["roadstop", 8, 62]] },
  { id: "port", name: "Cụm cảng (cảng + kho + trạm lọc + trạm)", parts: [["port", 0, 0], ["warehouse", 50, 10], ["filter", -46, 22], ["roadstop", 6, 54]] },
  { id: "research", name: "Cụm nghiên cứu (cơ sở + đài + trạm điện)", parts: [["research", 0, 0], ["observatory", 52, -16], ["powerplant", -50, 24], ["roadstop", 4, 54]] },
];
export function proposeCluster(st: Store, id: string, at: Pt): Proposal[] {
  const cl = CLUSTERS.find((c) => c.id === id)!, p = st.project;
  const onLand = (q: Pt) => p.land.some((l) => pipRings(q, l.rings));
  const parts = cl.parts.map(([a, dx, dy]) => ({ a, at: [at[0] + dx, at[1] + dy] as Pt }));
  if (!parts.every((x) => onLand(x.at))) { st.toast("Một phần cụm rơi xuống biển — dời tâm vào đất liền (di chuyển view)"); return []; }
  const g = uid("grp");
  return [{ id: pid(), title: cl.name, detail: "Tạo nhóm POI (cùng group, di chuyển cùng nhau); chỉnh từng cái sau đó.", overlays: parts.map((x) => ({ kind: "pt" as const, pts: [x.at], color: "#a64dff", r: 5, label: ARCHE_BY_ID[x.a].name })), apply: (pp: Project) => { for (const x of parts) pp.pois.push({ ...structuredCloneFromArche(x.a, x.at), group: g } as any); } }];
}

export function proposeRegen(st: Store, rect: [number, number, number, number]): Proposal[] {
  const seed = Math.floor(Math.random() * 1e6);
  return [{ id: pid(), title: "Tái sinh chi tiết địa hình trong vùng chọn", detail: "Chỉ thêm nhiễu độ cao + phân loại lại biome trong vùng; giữ nguyên lòng sông, hồ, biome được bảo vệ (rừng cổ, sa mạc, núi lửa…). Không đụng ngoài vùng.", overlays: [{ kind: "poly", pts: [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]], color: "#ff9f1c", dashed: true, fill: true }], apply: (p) => regenRegion(p, rect, seed) }];
}

export function reachOverlay(st: Store, at: Pt, mode: "foot" | "cart" | "water" | "all") {
  const nets = buildNets(st.project, st.ui.blocked);
  const g = nets[mode];
  const n = nearestNode(g, nets.nodes, at, 90);
  if (!n) { st.reachOv = []; st.toast("Không có đường/bến trong 90u từ điểm này (" + mode + ")"); st.emit(); return null; }
  const d = distMap(g, n);
  const pts: Pt[] = [];
  for (const k of d.keys()) { const q = nets.pos(k); if (q && !k.startsWith("L:") && k !== "SEA") pts.push(q); }
  const pois = st.project.pois.filter((o) => { const a = mode === "water" ? nets.poiWater[o.id] : mode === "cart" ? nets.poiCart[o.id] : nets.poiFoot[o.id]; return a && d.has(a); });
  st.reachOv = [{ kind: "pt", pts, color: mode === "water" ? "#00d0ff" : mode === "cart" ? "#ff8c1a" : "#d6249f", r: 1.6 }, { kind: "pt", pts: pois.map((o) => o.at), color: "#2cff7a", r: 4 }, { kind: "pt", pts: [at], color: "#fff", r: 5, label: `Tiếp cận ${mode}` }];
  st.emit();
  return { nodes: pts.length, pois: pois.length, total: st.project.pois.length };
}

export function blockTest(st: Store): { lost: string[]; before: number; after: number } | null {
  if (!st.ui.blocked.size) return null;
  const p = st.project;
  const a = buildNets(p), b = buildNets(p, st.ui.blocked);
  const root = p.pois.find((o) => a.poiFoot[o.id] && o.arche === "village");
  if (!root) return null;
  const da = distMap(a.all, a.poiFoot[root.id]!), db = distMap(b.all, b.poiFoot[root.id] || "x");
  const reach = (n: typeof a, d: Map<string, number>, o: Project["pois"][0]) => { const k = n.poiFoot[o.id] || n.poiWater[o.id]; return !!k && d.has(k); };
  const before = p.pois.filter((o) => reach(a, da, o)), after = p.pois.filter((o) => reach(b, db, o));
  return { lost: before.filter((o) => !after.includes(o)).map((o) => o.name), before: before.length, after: after.length };
}
void ARCHES;
