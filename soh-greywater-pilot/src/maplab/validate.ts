import { buildNets, components, distMap, nearestNode, SNAP_TOL } from "./graph";
import { RULES, buildable, computeFields, gridCost, nearestRes, siteProfile } from "./analysis";
import type { Fields } from "./analysis";
import { catmull, dist, lineInts, nearestOnLine, pip, pipRings, polyArea, resample, centroid } from "./geom";
import { elevAt } from "./terrain";
import { ARCHE_BY_ID, allObjects } from "./types";
import type { Project, Pt, StatusKind } from "./types";

export interface Check { id: string; status: StatusKind; title: string; detail: string; refs: string[]; bible?: string; pts?: Pt[] }
const costNear = (f: Fields, d: Float32Array, q: Pt) => { let b = Infinity; const i0 = Math.floor(q[0] / f.cell), j0 = Math.floor(q[1] / f.cell); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= f.gw || j >= f.gh) continue; b = Math.min(b, d[j * f.gw + i]); } return b; };
const BASIC = ["fresh_water", "food", "wood", "stone"];
const ORDER: Record<StatusKind, number> = { FAIL: 0, WARNING: 1, UNKNOWN: 2, PASS: 3 };

export function validate(p: Project, blocked: Set<string> = new Set()): Check[] {
  const out: Check[] = [];
  const add = (id: string, status: StatusKind, title: string, detail: string, refs: string[] = [], bible?: string, pts?: Pt[]) => out.push({ id, status, title, detail, refs, bible, pts });
  const f = computeFields(p);
  const nets = buildNets(p, blocked);
  const land0 = p.land.find((l) => l.kind === "main") || p.land[0];
  const onLand = (q: Pt) => p.land.some((l) => pipRings(q, l.rings));
  const landOf = (q: Pt) => p.land.find((l) => pipRings(q, l.rings))?.id || "";
  const elderCore = (q: Pt) => p.elders.some((e) => e.core.length > 2 && pip(q, e.core));

  // ---- integrity ----
  const ids = new Map<string, number>();
  for (const { obj } of allObjects(p)) ids.set(obj.id, (ids.get(obj.id) || 0) + 1);
  const dup = [...ids].filter(([, n]) => n > 1).map(([k]) => k);
  const dangling: string[] = [];
  for (const po of p.pois) for (const l of po.links) if (!ids.has(l.to)) dangling.push(po.id);
  for (const e of p.elders) for (const q of e.pois) if (!ids.has(q)) dangling.push(e.id);
  for (const r of p.rivers) { for (const x of [r.mouth.ref, r.source.ref]) if (x && !ids.has(x)) dangling.push(r.id); }
  for (const d of p.docks) if (d.water !== "sea" && !ids.has(d.water)) dangling.push(d.id);
  add("INT-IDS", dup.length || dangling.length ? "FAIL" : "PASS", "Toàn vẹn tham chiếu dữ liệu", dup.length || dangling.length ? `ID trùng: ${dup.join(", ") || "—"}; tham chiếu treo: ${[...new Set(dangling)].join(", ") || "—"}` : `${ids.size} đối tượng, không ID trùng, không tham chiếu treo.`, [...dup, ...dangling]);

  // ---- hydrology graph consistency ----
  const comps = components(nets.riverNet);
  const compOf = new Map<string, number>();
  comps.forEach((c, i) => c.forEach((n) => compOf.set(n, i)));
  const near = (q: Pt) => nearestNode(nets.riverNet, nets.nodes, q, SNAP_TOL + 1);
  const bad: string[] = [], deadend: string[] = [], pts: Pt[] = [];
  for (const r of p.rivers) {
    const a = r.points[0], b = r.points[r.points.length - 1];
    const kids = p.rivers.some((x) => x.source.ref === r.id && x.id !== r.id);
    if (r.mouth.kind === "sea") { let d = 1e9; for (const l of p.land) for (const ring of l.rings) d = Math.min(d, nearestOnLine(ring, b, true).d); if (d > 16 && onLand(b)) { bad.push(r.id); pts.push(b); } }
    else if (r.mouth.kind === "lake") { const lk = p.lakes.find((l) => l.id === r.mouth.ref); if (!lk || !(pip(b, lk.ring) || nearestOnLine(lk.ring, b, true).d < 9)) { bad.push(r.id); pts.push(b); } else { const nb = near(b); if (!nb || !comps.length) { bad.push(r.id); pts.push(b); } } }
    else if (r.mouth.kind === "river") { const par = p.rivers.find((x) => x.id === r.mouth.ref); if (!par) bad.push(r.id); else { const d = nearestOnLine(catmull(par.points).pts, b).d; const n1 = near(b), n2 = near(nearestOnLine(catmull(par.points).pts, b).pt); if (d > 3 || !n1 || !n2 || compOf.get(n1) !== compOf.get(n2)) { bad.push(r.id); pts.push(b); } } }
    else if (!kids) deadend.push(r.id);
    if (r.source.kind === "river") { const par = p.rivers.find((x) => x.id === r.source.ref); if (!par || nearestOnLine(catmull(par.points).pts, a).d > 3) { bad.push(r.id); pts.push(a); } }
    if (r.source.kind === "lake") { const lk = p.lakes.find((l) => l.id === r.source.ref); if (!lk || !(pip(a, lk.ring) || nearestOnLine(lk.ring, a, true).d < 9)) { bad.push(r.id); pts.push(a); } }
  }
  add("HYD-LINK", bad.length ? "FAIL" : "PASS", "Sông/phụ lưu/hồ nối đúng cả hình học và đồ thị", bad.length ? `Đầu sông KHÔNG nối thật với đích đã khai báo (nhìn như nối nhưng đồ thị rời): ${bad.map((i) => p.rivers.find((r) => r.id === i)?.name).join(", ")}.` : `${p.rivers.length} dòng; mọi hợp lưu/hồ/cửa biển khớp trong dung sai ${SNAP_TOL}u và cùng thành phần liên thông.`, bad, "§4.3 · MAP", pts);
  add("HYD-DEAD", deadend.length ? "WARNING" : "PASS", "Sông cụt (không đổ vào đâu)", deadend.length ? `Sông chưa có cửa: ${deadend.map((i) => p.rivers.find((r) => r.id === i)?.name).join(", ")}. Đặt mouth (biển/hồ/sông) hoặc đánh dấu phân lưu.` : "Mọi dòng đều có cửa hoặc phân lưu.", deadend);
  const up: string[] = [];
  for (const r of p.rivers) {
    const S = resample(catmull(r.points).pts, 8).pts;
    let gain = 0, prev = elevAt(p, S[0][0], S[0][1]);
    for (const q of S) { const e = elevAt(p, q[0], q[1]); if (e > prev + 0.004) gain += e - prev - 0.004; prev = Math.min(prev, e) + (e > prev ? 0 : 0); prev = e; }
    if (gain > 0.06) up.push(r.name + ` (+${gain.toFixed(2)})`);
  }
  add("HYD-DOWNHILL", up.length ? "WARNING" : "PASS", "Dòng chảy xuôi dốc (watershed hợp lý)", up.length ? `Đoạn chảy ngược lên cao: ${up.join(", ")} — hãy hạ địa hình (brush) hoặc đổi hướng.` : "Cao độ dọc mọi sông không tăng đáng kể theo chiều chảy.", []);

  // ---- navigable network ----
  const wcomps = components(nets.water).filter((c) => c.some((n) => !n.startsWith("D:") && n !== "SEA" || n.startsWith("L:")) && c.length > 2);
  const badNav: string[] = [];
  for (const r of p.rivers) {
    const cu = catmull(r.points);
    for (const ft of r.feats) if (ft.kind === "waterfall") for (let i = 0; i < cu.pts.length; i++) if (r.nav[Math.min(cu.idx[i], r.nav.length - 1)] === 1 && dist(cu.pts[i], ft.at) < 12) { badNav.push(r.id); break; }
  }
  add("NAV-FALL", badNav.length ? "FAIL" : "PASS", "Đoạn 'đi thuyền' không xuyên thác", badNav.length ? `Thác nằm trong đoạn navigable: ${[...new Set(badNav)].map((i) => p.rivers.find((r) => r.id === i)?.name).join(", ")}.` : "Không có thác nào nằm trong đoạn được gắn nhãn đi thuyền.", badNav);
  const noDock = wcomps.filter((c) => !c.some((n) => n.startsWith("D:")));
  add("NAV-CONNECT", noDock.length ? "WARNING" : wcomps.length ? "PASS" : "UNKNOWN", "Thủy lộ navigable liên thông & có bến", wcomps.length ? `${wcomps.length} mạng thủy lộ rời nhau (đoạn bị ghềnh/thác/đất cắt); ${noDock.length} mạng không có bến nào. Loại thuyền/tải/tốc độ = GIẢ ĐỊNH chờ Gameplay Tower.` : "Chưa có đoạn navigable nào.", []);
  const wsizes = wcomps.map((c) => c.filter((n) => n.startsWith("D:")).length).sort((a, b) => b - a);
  add("NAV-USEFUL", wsizes[0] >= 4 ? "PASS" : "WARNING", "Thủy lộ nội địa hữu ích sớm", `Mạng thủy lộ lớn nhất nối ${wsizes[0] || 0} bến; ${p.docks.filter((d) => d.kind === "inland").length} bến nội địa, ${p.docks.filter((d) => d.kind === "coastal").length} bến ven biển.`, []);

  // ---- roads vs water ----
  const inWater: string[] = [];
  for (const r of p.roads) {
    const S = resample(catmull(r.points).pts, 12).pts;
    if (r.kind === "ferry") { if (S.some((q, i) => i > 1 && i < S.length - 2 && (onLand(q) || p.lakes.some((l) => pip(q, l.ring)) && false))) inWater.push(r.id); }
    else if (S.some((q) => { const sea = !onLand(q) && p.land.every((l) => l.rings.every((ring) => nearestOnLine(ring, q, true).d > 6)); const lake = p.lakes.some((l) => pip(q, l.ring) && nearestOnLine(l.ring, q, true).d > 5); return sea || lake; })) inWater.push(r.id);
  }
  add("ROAD-WATER", inWater.length ? "FAIL" : "PASS", "Đường bộ không nằm trên biển/hồ; phà không xuyên đất", inWater.length ? `Vi phạm: ${inWater.map((i) => p.roads.find((r) => r.id === i)?.name).join(", ")}.` : "Không có đường bộ nằm trong nước; mọi tuyến phà đi qua mặt nước.", inWater);
  const cross = nets.bridgeless;
  const cartBad = cross.filter((c) => c.cart), footBad = cross.filter((c) => !c.cart && !(p.rivers.find((r) => r.id === c.river)?.fordable || p.roads.find((r) => r.id === c.road)?.ford || (p.rivers.find((r) => r.id === c.river)?.width ?? 9) <= 3));
  add("ROAD-CROSS", cartBad.length || footBad.length ? "FAIL" : cross.length ? "UNKNOWN" : "PASS", "Đường vượt sông phải có cầu/điểm lội", cartBad.length || footBad.length ? `${cartBad.length + footBad.length} giao cắt đường–sông không có cầu: ${[...new Set([...cartBad, ...footBad].map((c) => p.roads.find((r) => r.id === c.road)?.name))].slice(0, 6).join(", ")}.` : cross.length ? `${cross.length} điểm lội qua suối nhỏ (chỉ đường người đi). Luật lội nước của người chơi CHƯA được Gameplay chốt — đang là giả định.` : "Mọi giao cắt có cầu.", [...cartBad, ...footBad].map((c) => c.road), "MAP-LOG-03", [...cartBad, ...footBad].map((c) => c.at));
  const orphan = p.bridges.filter((b) => !p.roads.some((r) => r.kind !== "ferry" && nearestOnLine(catmull(r.points).pts, b.at).d < 14) || !p.rivers.some((r) => nearestOnLine(catmull(r.points).pts, b.at).d < 14));
  add("BRIDGE-VALID", orphan.length ? "WARNING" : "PASS", "Cầu nằm đúng giao cắt đường–sông", orphan.length ? `Cầu không nằm trên giao cắt: ${orphan.map((b) => b.name).join(", ")}` : `${p.bridges.length} cầu đều nằm đúng điểm giao cắt.`, orphan.map((b) => b.id));
  const steep: string[] = [];
  for (const r of p.roads) if (r.kind === "cart") { const S = resample(catmull(r.points).pts, 12).pts; const k = S.filter((q) => f.slope[Math.floor(q[1] / f.cell) * f.gw + Math.floor(q[0] / f.cell)] > RULES.cartSlopeMax * 1.15).length; if (k > 2) steep.push(r.id); }
  add("ROAD-SLOPE", steep.length ? "WARNING" : "PASS", "Đường xe hàng bám địa hình (độ dốc)", steep.length ? `Đoạn dốc gắt cho xe: ${steep.map((i) => p.roads.find((r) => r.id === i)?.name).join(", ")}. Ngưỡng là heuristic Map Lab (${RULES.cartSlopeMax}), không phải Bible.` : "Không đoạn đường xe nào vượt ngưỡng dốc heuristic.", steep);

  // ---- docks ----
  const lone = p.docks.filter((d) => { const k = nets.dockNode[d.id]; return !k || nets.foot.degree(k) === 0; });
  const offW = p.docks.filter((d) => { const k = nets.dockNode[d.id]; return !k || nets.water.degree(k) === 0; });
  add("DOCK-LINK", lone.length || offW.length ? "WARNING" : "PASS", "Bến nối cả đường bộ và mặt nước", lone.length || offW.length ? `Chưa nối đường bộ: ${lone.map((d) => d.name).join(", ") || "—"}; chưa nối thủy lộ: ${offW.map((d) => d.name).join(", ") || "—"}.` : `${p.docks.length} bến đều có đường tiếp cận và thủy lộ.`, [...lone, ...offW].map((d) => d.id));

  // ---- islands ----
  const mainDocks = p.docks.filter((d) => landOf(d.at) === land0.id || (landOf(d.at) === "" && nearestOnLine(land0.rings[0], d.at, true).d < 14));
  const mainNode = mainDocks.map((d) => nets.dockNode[d.id]).find((n) => n && nets.water.hasNode(n));
  const reachW = mainNode ? distMap(nets.water, mainNode) : new Map<string, number>();
  for (const l of p.land) {
    if (l.id === land0.id || l.kind === "islet") continue;
    const ps = p.pois.filter((o) => landOf(o.at) === l.id), rs = p.resources.filter((r) => landOf(r.at) === l.id);
    const kinds = new Set(rs.map((r) => r.kind));
    const docks = p.docks.filter((d) => nearestOnLine(l.rings[0], d.at, true).d < 16);
    const linked = docks.some((d) => reachW.has(nets.dockNode[d.id]));
    const nonElder = ps.filter((o) => !o.elder || ARCHE_BY_ID[o.arche]?.cat !== "danger");
    const onlyElder = ps.length > 0 && ps.every((o) => o.arche === "elder_site" || o.arche === "gate");
    const worth = nonElder.length >= 2 && kinds.size >= 2;
    const st: StatusKind = onlyElder ? "FAIL" : !linked || !worth ? "WARNING" : "PASS";
    add("ISL-" + l.id, st, `Đảo vệ tinh «${l.name}» có sinh kế và kết nối`, `${ps.length} POI (${nonElder.length} không-boss), ${kinds.size} loại nguồn, ${docks.length} bến, ${linked ? "có tuyến thủy tới đảo chính" : "KHÔNG có tuyến thủy tới đảo chính"}.${onlyElder ? " Đảo chỉ chứa địa điểm Elder — trái bài học đã xác nhận." : ""}`, [l.id], "§4.1 bài học đã xác nhận");
  }

  // ---- distribution ----
  const mainPois = p.pois.filter((o) => landOf(o.at) === land0.id);
  const inter = mainPois.filter((o) => f.dc[Math.floor(o.at[1] / f.cell) * f.gw + Math.floor(o.at[0] / f.cell)] > RULES.interiorDist).length;
  const frac = mainPois.length ? inter / mainPois.length : 0;
  add("DIST-POI", frac < 0.35 ? "WARNING" : "PASS", "POI không tụ ở vành đảo", `${inter}/${mainPois.length} POI trên đảo chính cách bờ > ${RULES.interiorDist}u (${(frac * 100).toFixed(0)}%). Ngưỡng 35% là heuristic Map Lab.`, []);
  const zin = p.zones.filter((z) => z.ring.length > 2).map((z) => centroid(z.ring)).filter((c) => f.dc[Math.floor(c[1] / f.cell) * f.gw + Math.floor(c[0] / f.cell)] > RULES.interiorDist).length;
  add("DIST-ZONE", p.zones.length && zin / p.zones.length >= 0.3 ? "PASS" : "WARNING", "Vùng xây nhà phân bố cả nội địa", `${zin}/${p.zones.length} vùng xây ở nội địa (> ${RULES.interiorDist}u cách bờ).`, []);
  let hole = 0, hp: Pt = [0, 0];
  for (let j = 0; j < f.gh; j += 2) for (let i = 0; i < f.gw; i += 2) {
    const k = j * f.gw + i;
    if (!f.land[k] || f.lake[k] || f.dc[k] < 60) continue;
    const q: Pt = [(i + 0.5) * f.cell, (j + 0.5) * f.cell];
    if (landOf(q) !== land0.id) continue;
    let d = 1e9;
    for (const o of p.pois) d = Math.min(d, dist(o.at, q));
    if (d > hole) { hole = d; hp = q; }
  }
  add("DIST-VOID", hole > 240 ? "WARNING" : "PASS", "Không có vùng nội địa khổng lồ trống", `Điểm nội địa xa POI nhất cách ${hole.toFixed(0)}u (ngưỡng cảnh báo heuristic 240u).`, [], "§4.1", hole > 240 ? [hp] : undefined);

  // ---- spawns (MAP-SPAWN-04) ----
  const gated = p.resources.filter((r) => BASIC.includes(r.kind) && r.gate && r.gate !== "none").map((r) => r.id);
  add("SPAWN-NOCORE", gated.length ? "FAIL" : "PASS", "Nguồn sống cơ bản không đòi Core/khóa/Elder", gated.length ? `${gated.length} nguồn cơ bản bị gắn gate.` : "Mọi nguồn nước/thức ăn/gỗ/đá không có gate (không cần Core để sinh tồn).", gated, "MAP-SPAWN-04");
  let minD = 1e9;
  for (let i = 0; i < p.spawns.length; i++) for (let j = i + 1; j < p.spawns.length; j++) minD = Math.min(minD, dist(p.spawns[i].at, p.spawns[j].at));
  const spawnRegions = new Set(p.spawns.map((s) => s.region));
  const spawnDetails: string[] = [];
  let spStatus: StatusKind = p.spawns.length >= 4 ? "PASS" : "FAIL";
  for (const s of p.spawns) {
    const d = gridCost(f, s.at, "foot", 900);
    const rowK: string[] = [];
    for (const kind of BASIC) {
      let best = Infinity;
      for (const r of p.resources) if (r.kind === kind) best = Math.min(best, costNear(f, d, r.at));
      for (const po of p.pois) if (po.resources.includes(kind)) best = Math.min(best, costNear(f, d, po.at));
      rowK.push(`${kind}:${isFinite(best) ? best.toFixed(0) : "∞"}`);
      if (!isFinite(best)) spStatus = "FAIL"; else if (best > RULES.spawnReach && spStatus === "PASS") spStatus = "WARNING";
    }
    let bz = Infinity;
    for (const z of p.zones) bz = Math.min(bz, costNear(f, d, centroid(z.ring)));
    const dr = f.dRoad[Math.floor(s.at[1] / f.cell) * f.gw + Math.floor(s.at[0] / f.cell)];
    if (!isFinite(bz) && spStatus !== "FAIL") spStatus = "FAIL";
    if (dr > 260 && spStatus === "PASS") spStatus = "WARNING";
    spawnDetails.push(`${s.name}: ${rowK.join(" ")} · vùng xây gần nhất ${isFinite(bz) ? bz.toFixed(0) : "∞"} · đường ${dr.toFixed(0)}u`);
  }
  if (p.spawns.length >= 4 && (minD < 250 || spawnRegions.size < 4) && spStatus === "PASS") spStatus = "WARNING";
  add("SPAWN-04", p.spawns.length < 4 ? "FAIL" : spStatus, "Bốn spawn độc lập đều có nguồn sống cơ bản, đường và đất xây", `Chi phí đi bộ (đơn vị 'effort', heuristic; ngưỡng ${RULES.spawnReach}). Khoảng cách spawn nhỏ nhất ${isFinite(minD) ? minD.toFixed(0) : "—"}u, ${spawnRegions.size} vùng.\n` + spawnDetails.join("\n"), p.spawns.map((s) => s.id), "MAP-SPAWN-04");

  // ---- build zones / home ----
  const zprof = p.zones.map((z) => ({ z, c: centroid(z.ring), pr: siteProfile(p, f, centroid(z.ring)) }));
  const tags = new Set<string>();
  zprof.forEach((x) => x.pr.tags.forEach((t) => tags.add(t)));
  const badZ = zprof.filter((x) => { const b = buildable(f, x.c); return !b.ok && b.why.startsWith("ngoài") || p.lakes.some((l) => pip(x.c, l.ring)); });
  const unsuit = zprof.filter((x) => !buildable(f, x.c).ok && !badZ.includes(x) && !/Cố ý/.test(x.z.notes || ""));
  add("HOME-VALID", badZ.length ? "FAIL" : unsuit.length ? "WARNING" : "PASS", "Vùng xây nhà nằm trên đất hợp lệ", badZ.length ? `Tâm vùng ở biển/hồ: ${badZ.map((x) => x.z.name).join(", ")}.` : unsuit.length ? `Bề mặt bất lợi (đầm/độc/vách): ${unsuit.map((x) => `${x.z.name} (${buildable(f, x.c).why})`).join("; ")}.` : `${p.zones.length} vùng đều trên đất xây được (heuristic).`, [...badZ, ...unsuit].map((x) => x.z.id));
  const regions = new Set(zprof.map((x) => landOf(x.c)));
  add("HOME-03", tags.size >= 5 && zprof.length >= 6 ? "PASS" : tags.size >= 3 ? "WARNING" : "FAIL", "Nhiều vị trí nhà với tradeoff khác nhau", `${zprof.length} vùng, ${regions.size} đảo; kiểu vị trí: ${[...tags].join(", ")}. Kiểm bằng 'Thử nhà' trên bất kỳ điểm nào. Giao tuyến habitat/dấu chân: xem UNKNOWN.`, [], "MAP-HOME-03");

  // ---- POI depth (MAP-POI-02) ----
  const multi = p.pois.filter((o) => o.depth === "multi" && o.arche !== "elder_site" && o.arche !== "gate");
  const goodMulti = multi.filter((o) => o.foot && o.foot.length > 2 && o.deep && o.deep.length > 2 && o.retreat.length > 0 && o.access.trim() && nets.poiFoot[o.id]);
  add("POI-02", goodMulti.length >= 2 ? "PASS" : "WARNING", "POI nhiều tầng: ngoại vi hữu ích + khu sâu + lối rút + đường tiếp cận", `${goodMulti.length}/${multi.length} POI nhiều tầng đủ dữ liệu: ${goodMulti.map((o) => o.name).join(", ")}. Softlock/khóa/điện cần A8 kiểm bằng cảnh thật.`, goodMulti.map((o) => o.id), "MAP-POI-02");
  const nonBoss = multi.filter((o) => o.gate !== "elder" && !o.elder);
  add("POI-NOBOSS", nonBoss.length ? "PASS" : "FAIL", "Có cơ sở sâu không cần đánh Elder", nonBoss.length ? `${nonBoss.length} cơ sở: ${nonBoss.map((o) => o.name).join(", ")}.` : "Không có cơ sở sâu nào độc lập với Elder.", nonBoss.map((o) => o.id), "§4.6");
  const unreach = p.pois.filter((o) => !nets.poiFoot[o.id] && !nets.poiWater[o.id] && o.arche !== "evac");
  add("POI-ACCESS", unreach.length ? "WARNING" : "PASS", "Mọi POI có tuyến tiếp cận", unreach.length ? `Không có đường/bến trong ${48}u: ${unreach.map((o) => o.name).join(", ")}.` : `${p.pois.length} POI đều có đường hoặc bến tiếp cận.`, unreach.map((o) => o.id));

  // ---- logistics differences (MAP-LOG-03) ----
  const srcs = p.pois.filter((o) => ["mine", "quarry", "sawmill", "smelter", "port"].includes(o.arche) && nets.poiCart[o.id] && nets.poiFoot[o.id]).slice(0, 12);
  let best = { ratio: 1, a: "", b: "", cd: 0, fd: 0 }, notCart = 0;
  for (const a of srcs) {
    const fm = distMap(nets.foot, nets.poiFoot[a.id]!, 4000), cm = distMap(nets.cart, nets.poiCart[a.id]!, 6000);
    for (const b of srcs) {
      if (a === b) continue;
      const fd = fm.get(nets.poiFoot[b.id]!), cd = cm.get(nets.poiCart[b.id]!);
      if (fd === undefined) continue;
      if (cd === undefined) { notCart++; continue; }
      if (cd / fd > best.ratio) best = { ratio: cd / fd, a: a.name, b: b.name, cd, fd };
    }
  }
  let waterWin = { ratio: 9, a: "", b: "", wd: 0, rd: 0 };
  const iDocks = p.docks.filter((d) => nets.dockNode[d.id] && nets.water.hasNode(nets.dockNode[d.id]));
  for (const a of iDocks.slice(0, 14)) {
    const wm = distMap(nets.water, nets.dockNode[a.id], 3000), fm = distMap(nets.foot, nets.dockNode[a.id], 4000);
    for (const b of iDocks) {
      if (a === b) continue;
      const wd = wm.get(nets.dockNode[b.id]), rd = fm.get(nets.dockNode[b.id]);
      if (wd !== undefined && rd !== undefined && wd > 40 && wd / rd < waterWin.ratio) waterWin = { ratio: wd / rd, a: a.name, b: b.name, wd, rd };
    }
  }
  const logOk = (best.ratio > 1.1 || notCart > 0) && waterWin.ratio < 0.92;
  add("LOG-03", logOk ? "PASS" : "WARNING", "Đi bộ ≠ xe hàng ≠ đường thủy (khác biệt có nghĩa)", `Xe/ bộ: tuyến xe dài hơn đường người tới ${best.ratio.toFixed(2)}× (${best.a} → ${best.b}: ${best.cd.toFixed(0)}u vs ${best.fd.toFixed(0)}u); ${notCart} cặp chỉ đi được bằng bộ. Thủy: ${waterWin.a} → ${waterWin.b} đường thủy ${waterWin.wd.toFixed(0)}u vs đường bộ ${waterWin.rd.toFixed(0)}u (${waterWin.ratio.toFixed(2)}×). Chỉ so độ dài; thời gian cần tốc độ thuyền/xe do Gameplay chốt.`, [], "MAP-LOG-03");

  // ---- Ragnarok no-boss chain (MAP-U4) ----
  const caches = p.pois.filter((o) => o.arche === "ragnarok_cache" && o.gate !== "elder"), vends = p.pois.filter((o) => o.arche === "chest_vendor"), evacs = p.pois.filter((o) => o.arche === "evac");
  const zoneNodes = p.zones.map((z) => nearestNode(nets.foot, nets.nodes, centroid(z.ring), 130)).filter(Boolean) as string[];
  const spawnNodes = p.spawns.map((s) => nearestNode(nets.foot, nets.nodes, s.at, 130)).filter(Boolean) as string[];
  const avoid = (n: string) => { const q = nets.pos(n); return !!q && elderCore(q); };
  let chain: string | null = null, chainDetail = "";
  for (const v of vends) {
    const vn = nets.poiFoot[v.id];
    if (!vn) continue;
    const dm = distMap(nets.foot, vn, 20000, avoid);
    const cOk = caches.filter((c) => nets.poiFoot[c.id] && dm.has(nets.poiFoot[c.id]!)), eOk = evacs.filter((e) => nets.poiFoot[e.id] && dm.has(nets.poiFoot[e.id]!));
    const zOk = zoneNodes.some((n) => dm.has(n)), sOk = spawnNodes.some((n) => dm.has(n));
    if (cOk.length && eOk.length && zOk && sOk) { chain = v.id; chainDetail = `Người bán ${v.name}: tiếp cận được ${cOk.length} rương không boss (${cOk.map((c) => c.name).slice(0, 3).join(", ")}), ≥1 vùng xây, ${eOk.length} điểm sơ tán, ${spawnNodes.length ? "nối từ các spawn" : ""} — tất cả KHÔNG đi qua lõi Elder.`; break; }
  }
  const cacheCoreBad = [...caches, ...vends, ...evacs].filter((o) => elderCore(o.at));
  add("RAG-CHAIN", cacheCoreBad.length ? "FAIL" : chain ? "PASS" : "FAIL", "Chuỗi không boss: tiền Ragnarok → người bán rương → nhà → ký gửi → sơ tán", cacheCoreBad.length ? `POI Ragnarok nằm trong lõi Elder: ${cacheCoreBad.map((o) => o.name).join(", ")}` : chain ? chainDetail + " (Đường bộ chứng minh liên thông ở mức hình học; seller là [ĐỀ XUẤT].)" : "Không tìm được chuỗi hợp lệ (cần ≥1 rương, người bán, vùng xây, sơ tán trong cùng mạng đường bộ, tránh lõi Elder).", [...caches, ...vends, ...evacs].map((o) => o.id), "MAP-U4");

  // ---- Elders ----
  const centre = centroid(land0.rings[0]);
  const elTerr = p.elders.filter((e) => e.outer.length > 2);
  const miss = p.elders.filter((e) => e.outer.length < 3 || e.core.length < 3 || !e.approach.length || !e.arenas.length || !e.pois.length);
  add("ELD-PARTS", p.elders.length < 6 ? "FAIL" : miss.length ? "WARNING" : "PASS", "Mỗi Elder có ngoại vi, lõi, điểm tiếp cận, khu chiến đấu, POI liên quan", p.elders.length < 6 ? `Mới có ${p.elders.length}/6 Elder.` : miss.length ? `Thiếu thành phần: ${miss.map((e) => e.name).join(", ")}.` : "Sáu Elder đều đủ thành phần.", miss.map((e) => e.id), "MAP-U5");
  let overlap = 0;
  const ovl: string[] = [];
  for (let i = 0; i < elTerr.length; i++) for (let j = i + 1; j < elTerr.length; j++) { const A = elTerr[i], B = elTerr[j]; const ca = centroid(A.outer), cb = centroid(B.outer); if (dist(ca, cb) < 120) { overlap++; ovl.push(`${A.name} / ${B.name}`); } }
  const angs = elTerr.map((e) => Math.atan2(centroid(e.outer)[1] - centre[1], centroid(e.outer)[0] - centre[0])).sort((a, b) => a - b);
  const gaps = angs.map((a, i) => (i < angs.length - 1 ? angs[i + 1] - a : angs[0] + Math.PI * 2 - a));
  const mg = gaps.reduce((s, g) => s + g, 0) / (gaps.length || 1), cvA = Math.sqrt(gaps.reduce((s, g) => s + (g - mg) ** 2, 0) / (gaps.length || 1)) / (mg || 1);
  const rr = elTerr.map((e) => dist(centroid(e.outer), centre)), mr = rr.reduce((s, x) => s + x, 0) / (rr.length || 1), cvR = Math.sqrt(rr.reduce((s, x) => s + (x - mr) ** 2, 0) / (rr.length || 1)) / (mr || 1);
  const areas = elTerr.map((e) => Math.abs(polyArea(e.outer)));
  const sym = elTerr.length >= 5 && cvA < 0.25 && cvR < 0.2;
  add("ELD-DISTINCT", ovl.length || sym ? "WARNING" : elTerr.length >= 6 ? "PASS" : "UNKNOWN", "Lãnh thổ Elder phân biệt, không đối xứng sáu miếng", sym ? "Sáu lãnh thổ phân bố gần đối xứng (góc/bán kính đều) — trái bài học đã xác nhận." : ovl.length ? `Tâm lãnh thổ trùng nhau: ${ovl.join(", ")}.` : `Khoảng cách góc CV=${cvA.toFixed(2)}, bán kính CV=${cvR.toFixed(2)}, diện tích ${areas.map((a) => (a / 1000).toFixed(0)).join("/")}k u² — bất đối xứng, không chia đều.`, p.elders.map((e) => e.id), "MAP-U5");
  const dis: string[] = [];
  for (const e of elTerr) {
    if (e.core.length < 3) continue;
    const av = (n: string) => { const q = nets.pos(n); return !!q && pip(q, e.core); };
    const normal = p.pois.filter((o) => o.arche !== "elder_site" && o.arche !== "gate" && !pip(o.at, e.core) && nets.poiFoot[o.id]);
    if (!normal.length) continue;
    const root = normal.find((o) => nets.poiFoot[o.id])!;
    const base = distMap(nets.foot, nets.poiFoot[root.id]!, 1e9), cut = distMap(nets.foot, nets.poiFoot[root.id]!, 1e9, av);
    const lost = normal.filter((o) => base.has(nets.poiFoot[o.id]!) && !cut.has(nets.poiFoot[o.id]!));
    if (lost.length) dis.push(`${e.name} khóa ${lost.length} POI: ${lost.slice(0, 3).map((o) => o.name).join(", ")}`);
  }
  add("ELD-NOLOCK", dis.length ? "FAIL" : "PASS", "Elder không khóa sinh tồn/hoạt động thường ngày", dis.length ? dis.join("; ") : "Loại bỏ lõi từng Elder khỏi đồ thị đường bộ không cắt đứt POI thường ngày nào đang nối.", [], "MAP-U5 / §4.7");
  const gate = p.pois.find((o) => o.arche === "gate");
  add("ELD-ATLAS", gate && gate.retreat.length ? "UNKNOWN" : "WARNING", "Atlas: ngưỡng không gian có đường quay lại, không phải vận tải miễn phí", gate ? "Dữ liệu cổng, neo quay lại và tuyến phà đã có. Đồ thị cổng/portal thật (điểm vào–ra, giới hạn) CHƯA được Gameplay chốt → không chứng minh được ở tầng bản vẽ." : "Chưa có POI loại 'gate'.", gate ? [gate.id] : [], "Elder doc");

  // ---- resources ----
  const rdiv: string[] = [];
  for (const k of BASIC) {
    const rs = p.resources.filter((r) => r.kind === k), cellsU = new Set(rs.map((r) => Math.floor(r.at[0] / 400) + "," + Math.floor(r.at[1] / 400))), dens = new Set(rs.map((r) => r.dens));
    if (rs.length < 6 || cellsU.size < 3 || dens.size < 2) rdiv.push(`${k}: ${rs.length} nút, ${cellsU.size} ô vùng, ${dens.size} mức mật độ`);
  }
  add("RES-DIST", rdiv.length ? "WARNING" : "PASS", "Nguồn cơ bản phân bố rộng, mật độ khác nhau", rdiv.length ? "Phân bố hẹp: " + rdiv.join("; ") : `Nước/thức ăn/gỗ/đá mỗi loại ≥6 nút, ≥3 ô vùng, nhiều mức mật độ (tổng ${p.resources.length} nút).`, []);
  const canalBad = p.rivers.filter((r) => r.kind === "canal" && (!r.reason || !r.reason.trim()));
  add("HYD-CANAL", canalBad.length ? "WARNING" : "PASS", "Kênh đào có lý do địa hình/kinh tế", canalBad.length ? `Kênh thiếu lý do: ${canalBad.map((r) => r.name).join(", ")}` : `${p.rivers.filter((r) => r.kind === "canal").length} kênh đều có lý do và công trình giả định.`, canalBad.map((r) => r.id));

  // ---- UNKNOWN (not decided by Bible) ----
  add("UNK-BOAT", "UNKNOWN", "Loại thuyền, tải trọng, tốc độ, chi phí", "Bible chưa chốt — Map Lab KHÔNG gán số. Mọi tuyến thủy lộ/phà đánh dấu 'giả định' chờ Gameplay Tower.", [], "§11.5");
  add("UNK-SELL", "UNKNOWN", "Giá/stock/seller của Rương ký gửi; số tiền Ragnarok", "Giá rương, số rương, tiền trong rương, quyền mua bằng tiền chưa ký gửi = [ĐỀ XUẤT]/[CẦN ĐO]; Gameplay + A3 quyết.", vends.map((v) => v.id), "§5.4");
  add("UNK-HABITAT", "UNKNOWN", "Habitat quái / giao tuyến dấu chân (MAP-U1) và dự báo thời tiết (MAP-U2)", "Chưa có dữ liệu habitat/thời tiết trong Map Lab; chỉ có tag vị trí. A1/Gameplay phải cung cấp trước khi so sánh ba nhà về footprint.", [], "MAP-U1/U2");
  add("UNK-NATIVE", "UNKNOWN", "Xe qua cầu thật, collision, đọc rõ ở 640×360 1× (MAP-CAMERA)", "Bản vẽ giấy không chứng minh được; cần bản dựng native + người chơi thật.", [], "MAP-CAMERA");
  out.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  void nearestRes;
  void lineInts;
  return out;
}

export function summarize(c: Check[]): Record<StatusKind, number> {
  const s = { PASS: 0, WARNING: 0, UNKNOWN: 0, FAIL: 0 };
  c.forEach((x) => s[x.status]++);
  return s;
}
