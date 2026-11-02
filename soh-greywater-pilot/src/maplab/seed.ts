import { centroid, chaikin, catmull, dist, hash2, lerp, mulberry32, nearestOnLine, lineInts, pip, pipRings, resample, offsetLine, rdp, clipDiff } from "./geom";
import type { Poly } from "./geom";
import { buildable, computeFields, markRoad, rasterRoads, routeRuns, snapToRoads } from "./analysis";
import type { Fields } from "./analysis";
import { reattach } from "./graph";
import { elevAt, emptyTerrain, fbm, generateTerrain, noise2 } from "./terrain";
import type { GenSpec } from "./terrain";
import { ARCHE_BY_ID, CELL, GH, GW, WORLD_H, WORLD_W, RES_KINDS } from "./types";
import type { BuildZone, Dock, ElderT, Label, Lake, Land, Poi, Project, Pt, Resource, River, Road, RoadKind, Spawn, Bridge } from "./types";

function blob(c: Pt, rx: number, ry: number, rot = 0, seed = 1, n = 22, jit = 0.14): Pt[] {
  const r = mulberry32(seed), o: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * 2 * jit;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    o.push([c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return chaikin(o, 1, true);
}
function coast(pts: Pt[], seed: number, amp: number, step = 11): Pt[] {
  const r = chaikin(pts, 2, true);
  const rs = resample([...r, r[0]], step).pts;
  rs.pop();
  const n = noise2(seed);
  return rs.map((q, i) => {
    const a = rs[(i - 1 + rs.length) % rs.length], b = rs[(i + 1) % rs.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const d = fbm(n, q[0] / 55, q[1] / 55, 3) * amp;
    return [q[0] - (dy / l) * d, q[1] + (dx / l) * d] as Pt;
  });
}

const MAIN: Pt[] = [[470, 330], [520, 258], [610, 208], [720, 186], [820, 152], [930, 128], [1030, 138], [1100, 172], [1140, 222], [1096, 262], [1064, 300], [1100, 338], [1170, 322], [1240, 292], [1300, 268], [1372, 286], [1422, 342], [1402, 412], [1332, 452], [1292, 522], [1342, 592], [1382, 682], [1362, 772], [1302, 830], [1234, 858], [1212, 930], [1262, 1000], [1232, 1072], [1152, 1112], [1062, 1098], [1050, 1030], [1034, 970], [1026, 932], [1008, 904], [976, 900], [950, 912], [934, 950], [920, 1008], [896, 1086], [840, 1152], [760, 1172], [680, 1142], [590, 1172], [500, 1132], [420, 1062], [380, 962], [332, 882], [352, 782], [312, 682], [342, 592], [302, 502], [360, 420]];
const ISLES: { id: string; name: string; kind: Land["kind"]; pts: Pt[]; amp: number }[] = [
  { id: "ld_cinder", name: "Cinder Isle", kind: "satellite", amp: 7, pts: [[1560, 832], [1578, 764], [1646, 722], [1728, 728], [1792, 780], [1806, 862], [1772, 934], [1700, 972], [1622, 962], [1566, 912]] },
  { id: "ld_saltwick", name: "Saltwick Isle", kind: "satellite", amp: 6, pts: [[1520, 300], [1560, 240], [1640, 214], [1732, 236], [1792, 290], [1760, 352], [1682, 386], [1590, 372], [1534, 346]] },
  { id: "ld_gull", name: "Gull Isle", kind: "satellite", amp: 4, pts: [[1840, 418], [1888, 396], [1928, 436], [1898, 490], [1846, 472]] },
  { id: "ld_ironholm", name: "Ironholm", kind: "satellite", amp: 6, pts: [[1062, 1252], [1132, 1214], [1232, 1224], [1302, 1266], [1292, 1328], [1202, 1352], [1102, 1342]] },
  { id: "ld_threshold", name: "Threshold Isle", kind: "satellite", amp: 4, pts: [[112, 470], [168, 440], [222, 466], [240, 520], [212, 570], [150, 580], [114, 540]] },
  { id: "ld_wreck", name: "Wreck Isle", kind: "satellite", amp: 4, pts: [[120, 830], [180, 810], [232, 846], [230, 902], [170, 924], [124, 892]] },
  { id: "ld_beacon", name: "Beacon Rock", kind: "islet", amp: 2, pts: [[250, 640], [282, 632], [296, 662], [264, 680]] },
];

const SPEC: GenSpec = {
  seed: 2026,
  feats: [
    { t: "dome", c: [560, 350], r: 165, h: 0.62, p: 1.3 },
    { t: "ridge", pts: [[455, 335], [555, 312], [650, 352], [705, 420]], w: 62, h: 0.3 },
    { t: "basin", c: [625, 410], r: 40, h: 0.12 },
    { t: "rugged", c: [560, 360], r: 200, amp: 0.24 },
    { t: "ridge", pts: [[650, 500], [565, 600], [512, 700], [490, 800], [505, 885]], w: 58, h: 0.38 },
    { t: "rugged", c: [520, 720], r: 150, amp: 0.08 },
    { t: "ridge", pts: [[780, 258], [880, 214], [960, 198], [1052, 226], [1100, 278]], w: 54, h: 0.32 },
    { t: "dome", c: [950, 190], r: 90, h: 0.12 },
    { t: "ridge", pts: [[1170, 545], [1232, 612], [1218, 722], [1182, 790]], w: 52, h: 0.3 },
    { t: "dome", c: [895, 450], r: 95, h: 0.1 },
    { t: "dome", c: [1290, 350], r: 70, h: 0.1 },
    { t: "dome", c: [860, 700], r: 130, h: 0.05 },
    { t: "dome", c: [400, 640], r: 100, h: 0.1 },
    { t: "dome", c: [560, 1010], r: 120, h: 0.05 },
    { t: "dome", c: [1240, 960], r: 60, h: 0.05 },
    { t: "dome", c: [1690, 820], r: 128, h: 0.8, p: 1.5 },
    { t: "basin", c: [1690, 816], r: 26, h: 0.22 },
    { t: "rugged", c: [1690, 820], r: 140, amp: 0.08 },
    { t: "dome", c: [1650, 290], r: 70, h: 0.14 },
    { t: "dome", c: [1170, 1288], r: 80, h: 0.26 },
    { t: "dome", c: [168, 512], r: 55, h: 0.22 },
    { t: "dome", c: [176, 866], r: 45, h: 0.06 },
  ],
  stamps: [
    { ring: blob([420, 760], 80, 120, 0.1, 3), biome: 1, noise: 22 },
    { ring: blob([1250, 420], 70, 40, 0, 4), biome: 1, noise: 18 },
    { ring: blob([790, 604], 130, 38, 0, 5), biome: 0, noise: 18 },
    { ring: blob([1030, 640], 55, 95, 0.35, 6), biome: 0, noise: 18 },
    { ring: blob([1010, 480], 90, 38, 0, 7), biome: 0, noise: 16 },
    { ring: blob([1282, 380], 70, 36, 0, 8), biome: 0, noise: 16 },
    { ring: blob([1240, 500], 62, 24, 0, 9), biome: 0, noise: 14 },
    { ring: blob([386, 600], 40, 70, 0, 10), biome: 0, noise: 14 },
    { ring: blob([1650, 330], 60, 26, 0, 11), biome: 6, noise: 14 },
    { ring: [[925, 820], [1000, 812], [1060, 830], [1062, 880], [1040, 925], [1000, 935], [950, 925], [920, 880]], biome: 4, noise: 22 },
    { ring: blob([1236, 360], 40, 26, 0, 12), biome: 4, noise: 12 },
    { ring: [[410, 1000], [470, 920], [560, 890], [660, 900], [760, 930], [820, 990], [800, 1090], [720, 1150], [600, 1170], [480, 1130], [420, 1070]], biome: 5, noise: 40 },
    { ring: blob([1215, 975], 70, 70, 0, 13), biome: 10, noise: 20 },
    { ring: blob([1690, 822], 108, 98, 0.2, 14), biome: 9, noise: 26 },
    { ring: blob([1764, 900], 38, 28, 0, 15), biome: 10, noise: 10 },
    { ring: blob([880, 712], 176, 136, 0.1, 16), biome: 2, noise: 30 },
  ],
  dry: [{ c: [620, 1020], r: 240, k: 0.6 }, { c: [1200, 1010], r: 120, k: 0.25 }],
};

const lbl: Record<string, string> = Object.fromEntries(RES_KINDS.map((r) => [r.id, r.name]));

export function buildSeedProject(): Project {
  const now = new Date().toISOString();
  const p: Project = {
    v: 1, name: "Soul of Hero — Bản nháp thế giới A (đề xuất của agent)", world: { w: WORLD_W, h: WORLD_H },
    meta: { created: now, modified: now, author: "Map Lab agent", status: "ĐỀ XUẤT — chưa phải canon được người sáng tạo duyệt" },
    land: [], lakes: [], rivers: [], roads: [], bridges: [], docks: [], pois: [], zones: [], resources: [], spawns: [], elders: [], labels: [],
    terrain: emptyTerrain(GW, GH, CELL, 2026), baseId: 1,
  };
  p.land.push({ id: "ld_veyra", name: "Veyra (đảo chính)", kind: "main", rings: [coast(MAIN, 11, 9)], conf: "proposal" });
  ISLES.forEach((s, i) => p.land.push({ id: s.id, name: s.name, kind: s.kind, rings: [coast(s.pts, 20 + i, s.amp, 9)], conf: "proposal" }));

  const lake = (id: string, name: string, c: Pt, rx: number, ry: number, rot: number, seed: number, oasis = false) =>
    p.lakes.push({ id, name, ring: blob(c, rx, ry, rot, seed, 20, 0.1), oasis, conf: "proposal" } as Lake);
  lake("lk_tarn", "Mirror Tarn", [625, 410], 26, 18, 0.3, 31);
  lake("lk_grey", "Greywater Lake", [800, 535], 62, 36, -0.25, 32);
  lake("lk_verdant", "Lake Verdant", [1000, 398], 70, 38, 0.1, 33);
  lake("lk_mirage", "Mirage Pool", [650, 1002], 28, 18, 0.2, 34, true);
  lake("lk_mere", "Hook Mere", [1236, 352], 24, 15, 0, 35);

  const riv = (id: string, name: string, pts: Pt[], width: number, o: Partial<River> = {}) =>
    p.rivers.push({ id, name, points: pts, width, kind: "river", nav: new Array(pts.length - 1).fill(0), feats: [], mouth: { kind: "none" }, source: { kind: "spring" }, conf: "proposal", ...o });
  const allNav = (n: number) => new Array(n - 1).fill(1);
  const greyUp: Pt[] = [[650, 409], [690, 414], [724, 420], [748, 430], [776, 454], [792, 490], [800, 514]];
  riv("rv_grey_up", "Greywater River (thượng lưu)", greyUp, 4, { source: { kind: "lake", ref: "lk_tarn" }, mouth: { kind: "lake", ref: "lk_grey" } });
  const greyLow: Pt[] = [[836, 558], [868, 590], [896, 634], [918, 690], [934, 744], [956, 796], [978, 832], [990, 858]];
  riv("rv_grey_low", "Greywater River", greyLow, 7, { source: { kind: "lake", ref: "lk_grey" }, nav: allNav(greyLow.length), notes: "Trục thủy lộ chính: hồ Greywater → vịnh Rime. Phân lưu thành 3 nhánh ở đồng bằng cửa sông." });
  const silver: Pt[] = [[620, 632], [670, 646], [730, 650], [790, 640], [850, 640], [906, 652]];
  riv("rv_silver", "Silverrun", silver, 4, { mouth: { kind: "river", ref: "rv_grey_low" }, nav: [0, 0, 1, 1, 1] });
  const canal: Pt[] = [[1012, 434], [1032, 470], [1060, 508], [1088, 544]];
  riv("rv_canal", "Timber Cut Canal", canal, 3.5, { kind: "canal", source: { kind: "lake", ref: "lk_verdant" }, mouth: { kind: "river", ref: "rv_moss" }, nav: allNav(canal.length), conf: "assumption", reason: "Nối Lake Verdant (xưởng gỗ) với thủy hệ Greywater qua yên ngựa thấp; chỉ xuất hiện vì gỗ nặng khó chở qua đồi. Cần công trình âu/cống [GIẢ ĐỊNH — chờ Gameplay Tower].", notes: "Kênh nhân tạo: cần công trình phù hợp (lock)." });
  const moss: Pt[] = [[1088, 544], [1092, 586], [1074, 634], [1044, 680], [1012, 722], [988, 764], [962, 802]];
  riv("rv_moss", "Mossbrook", moss, 4, { source: { kind: "river", ref: "rv_canal" }, mouth: { kind: "river", ref: "rv_grey_low" }, nav: allNav(moss.length) });
  const argus: Pt[] = [[958, 262], [970, 296], [984, 330], [996, 366]];
  riv("rv_argus", "Argus Brook", argus, 2.5, { mouth: { kind: "lake", ref: "lk_verdant" } });
  const east: Pt[] = [[1068, 404], [1106, 420], [1140, 444], [1166, 470], [1200, 488], [1240, 500], [1270, 512], [1300, 526]];
  riv("rv_east", "Eastwater River", east, 6, { source: { kind: "lake", ref: "lk_verdant" }, mouth: { kind: "sea" } });
  riv("rv_d1", "Delta West Channel", [[990, 858], [974, 876], [958, 892], [950, 912]], 4, { kind: "distributary", source: { kind: "river", ref: "rv_grey_low" }, mouth: { kind: "sea" }, nav: [1, 1, 1] });
  riv("rv_d2", "Delta Centre Channel", [[990, 858], [990, 878], [986, 900]], 5, { kind: "distributary", source: { kind: "river", ref: "rv_grey_low" }, mouth: { kind: "sea" }, nav: [1, 1] });
  riv("rv_d3", "Delta East Channel", [[990, 858], [1010, 872], [1026, 894], [1028, 916], [1026, 932]], 4, { kind: "distributary", source: { kind: "river", ref: "rv_grey_low" }, mouth: { kind: "sea" }, nav: [1, 1, 1, 1] });
  riv("rv_amber_up", "Amber Wadi (thượng lưu)", [[505, 872], [540, 912], [578, 950], [624, 990]], 2.5, { mouth: { kind: "lake", ref: "lk_mirage" } });
  riv("rv_amber_low", "Amber River", [[652, 1018], [668, 1052], [680, 1092], [688, 1128], [692, 1160]], 4, { source: { kind: "lake", ref: "lk_mirage" }, mouth: { kind: "sea" }, nav: [1, 1, 1, 1] });
  riv("rv_west", "Westbrook", [[468, 432], [436, 468], [402, 500], [372, 528], [346, 548]], 3, { mouth: { kind: "sea" }, nav: [0, 0, 0, 1] });
  riv("rv_hook", "Hook Creek", [[1256, 358], [1296, 372], [1338, 386], [1384, 402]], 3, { source: { kind: "lake", ref: "lk_mere" }, mouth: { kind: "sea" }, nav: [1, 1, 0] });
  riv("rv_ash", "Ash Spring Brook", [[1668, 860], [1640, 884], [1608, 900], [1580, 906]], 2.5, { mouth: { kind: "sea" } });
  riv("rv_salt", "Salt Brook", [[1650, 304], [1626, 330], [1596, 358]], 2.5, { mouth: { kind: "sea" } });
  riv("rv_slag", "Slag Run", [[1180, 1288], [1150, 1308], [1124, 1336]], 2.5, { mouth: { kind: "sea" } });

  reattach(p);
  generateTerrain(p, SPEC);
  reattach(p);

  // Waterfalls / rapids where the carved river bed drops fastest (derived from the terrain, not hand-placed)
  const steepest = (r: River, f0: number, f1: number): Pt => {
    const S = resample(catmull(r.points).pts, 6).pts;
    const a = Math.floor(S.length * f0), b = Math.min(S.length - 7, Math.floor(S.length * f1));
    let bk = a, bd = -1;
    for (let k = a; k < b; k++) { const d = elevAt(p, S[k][0], S[k][1]) - elevAt(p, S[k + 5][0], S[k + 5][1]); if (d > bd) { bd = d; bk = k; } }
    return S[bk + 2];
  };
  const arcAt = (r: River, q: Pt) => {
    const S = catmull(r.points).pts; const n = nearestOnLine(S, q); let L = 0;
    for (let i = 0; i < n.i; i++) L += dist(S[i], S[i + 1]);
    return L + dist(S[n.i], n.pt);
  };
  const gu = p.rivers.find((r) => r.id === "rv_grey_up")!;
  const fall = steepest(gu, 0.05, 0.7);
  gu.feats.push({ at: fall, kind: "waterfall" });
  const fa = arcAt(gu, fall);
  gu.nav = gu.nav.map((_, i) => (arcAt(gu, gu.points[i]) > fa + 14 ? 1 : 0));
  gu.notes = "Thác nước nơi lòng sông dốc nhất (suy ra từ địa hình). Trên thác: không đi thuyền; dưới thác: bến đổ vào hồ. Cần đường vòng (portage).";
  const ea = p.rivers.find((r) => r.id === "rv_east")!;
  const rap = steepest(ea, 0.12, 0.6);
  ea.feats.push({ at: rap, kind: "rapids" });
  const ra = arcAt(ea, rap);
  ea.nav = ea.nav.map((_, i) => { const s0 = arcAt(ea, ea.points[i]), s1 = arcAt(ea, ea.points[i + 1]); return s1 < ra - 16 || s0 > ra + 70 ? 1 : 0; });
  ea.notes = "Ghềnh ở đoạn dốc: ngăn thuyền nối Lake Verdant ↔ cửa Eastwater; cần đường vòng bộ (Rapids Portage Trail).";
  const cn = p.rivers.find((r) => r.id === "rv_canal")!;
  cn.feats.push({ at: cn.points[2], kind: "lock" });
  const mo = p.rivers.find((r) => r.id === "rv_moss")!;
  mo.feats.push({ at: nearestOnLine(catmull(mo.points).pts, [1002, 730]).pt, kind: "weir" });

  const f: Fields = computeFields(p);
  const onLand = (q: Pt) => p.land.some((l) => pipRings(q, l.rings)) && !p.lakes.some((l) => pip(q, l.ring));
  const toLand = (q: Pt, what: string): Pt => {
    if (onLand(q)) return q;
    for (let r = 6; r <= 120; r += 6) for (let a = 0; a < 12; a++) { const c: Pt = [q[0] + Math.cos(a * 0.5236) * r, q[1] + Math.sin(a * 0.5236) * r]; if (onLand(c)) { console.warn("[seed] moved", what, Math.round(r)); return c; } }
    return q;
  };

  // ---------------- POIs ----------------
  type PO = Partial<Poi> & { sx?: number };
  const poi = (id: string, name: string, arche: string, x: number, y: number, o: PO = {}) => {
    const a = ARCHE_BY_ID[arche];
    const at = toLand([x, y], id);
    const sc = o.scale ?? 1, rot = o.rot ?? hash2(x, y, 3) * 0.8 - 0.4;
    const R = a.r * sc;
    const rect = (w: number, h: number, dx = 0, dy = 0): Pt[] => [[-w, -h], [w, -h], [w, h], [-w, h]].map(([u, v]) => [at[0] + dx + u * Math.cos(rot) - v * Math.sin(rot), at[1] + dy + u * Math.sin(rot) + v * Math.cos(rot)] as Pt);
    const depth = o.depth ?? a.depth;
    const ang = hash2(y, x, 5) * 6.28;
    p.pois.push({
      id, name, at, arche, rot, scale: sc, foot: rect(R * 0.8, R * 0.55), deep: depth === "multi" ? rect(R * 0.45, R * 0.3, R * 0.15, R * 0.1) : undefined,
      depth, role: a.role, opp: a.opp, access: a.access, resources: [...a.res], gate: a.gate, retreat: depth === "multi" || arche === "elder_site" ? [[at[0] + Math.cos(ang) * R * 2.2, at[1] + Math.sin(ang) * R * 2.2]] : [],
      links: [], conf: "proposal", ...o,
    } as Poi);
  };
  const D = (s: string) => ({ notes: s });
  // North — Argus (Mind)
  poi("po_academy", "Argus Academy", "research", 936, 262, { elder: "argus", gate: "key", ...D("Học viện: ngoại vi (giảng đường, thư viện mở) tự do; kho sâu cần thẻ + điện.") });
  poi("po_observatory", "Argus Observatory", "observatory", 958, 170, { elder: "argus" });
  poi("po_archive", "Argus Archive Vaults", "facility", 1018, 226, { elder: "argus", gate: "key" });
  poi("po_hall_eyes", "Hall of Eyes", "elder_site", 992, 212, { elder: "argus" });
  poi("po_lantern", "Lantern Light", "observatory", 1050, 152);
  poi("po_lanternstn", "Lantern Cove Station", "roadstop", 1098, 300);
  poi("po_kestrel", "Kestrel Radio Tower", "facility", 700, 300, { gate: "key", ...D("Cơ sở nhiều tầng KHÔNG boss: chân tháp tự do, tầng trên cần thẻ + điện.") });
  // NW — Typhon (Power)
  poi("po_typhon", "Typhon's Fracture", "elder_site", 556, 352, { elder: "typhon" });
  poi("po_viaduct", "Crushed Viaduct", "ruins", 655, 448, { elder: "typhon", depth: "surface" });
  poi("po_freightyard", "Shattered Freight Yard", "ruins", 690, 500, { elder: "typhon", depth: "surface", resources: ["scrap", "ore"], ...D("Bãi hàng vỡ do va đập nặng: ngoại vi Typhon có vật liệu cổ.") });
  poi("po_fracquarry", "Fracture Quarry", "quarry", 600, 525);
  poi("po_falls", "Falls Powerhouse", "powerplant", 722, 438, D("Thủy điện tại thác: cấp điện cho cơ sở sâu; cần nước + đường xe."));
  // Central
  poi("po_greywater", "Greywater Hamlet", "village", 812, 592);
  poi("po_pumphouse", "Greywater Pumphouse", "filter", 850, 556);
  poi("po_confluence", "Confluence Waystation", "roadstop", 918, 668);
  poi("po_sawaion", "Aion Edge Sawmill", "sawmill", 748, 668, { elder: "aion", ...D("Xưởng cưa ở rìa rừng cổ, chạy bằng Silverrun — ngoại vi thường ngày của Aion.") });
  poi("po_mill", "Mossbrook Mill", "mill", 1002, 730);
  poi("po_kilns", "Charcoal Kilns", "smelter", 905, 785, { scale: 0.7, elder: "aion" });
  poi("po_ranger", "Ranger Hut", "hamlet", 800, 760, { elder: "aion" });
  poi("po_glade", "Mosslight Glade", "grove", 782, 705, { elder: "aion" });
  poi("po_sapgrove", "Sap Grove", "grove", 960, 640, { elder: "aion" });
  poi("po_elderwood", "Heart of the Elderwood", "elder_site", 868, 712, { elder: "aion" });
  poi("po_siloc", "Grain Silo Complex", "warehouse", 1090, 760);
  poi("po_meridian", "Meridian Research Station", "research", 1120, 690, { gate: "key", ...D("Cơ sở nghiên cứu nhiều tầng không boss: ngoại vi mở, tầng sâu cần thẻ + điện, có lối rút.") });
  poi("po_oldpump", "Old Pumping Plant", "facility", 850, 985, { gate: "power", ...D("Cơ sở sâu cần điện/nhiên liệu — không có Elder; ngoại vi có linh kiện van.") });
  // East
  poi("po_strait", "Strait Landing", "port", 1268, 490);
  poi("po_ironvein", "Ironvein Mine", "mine", 1205, 655);
  poi("po_ridgestop", "Ridge Pass Station", "roadstop", 1178, 578);
  poi("po_rapids", "Rapids Portage Hut", "roadstop", 1150, 462);
  poi("po_hook", "Hook Village", "village", 1300, 335);
  poi("po_mere", "Hook Mere Pier", "pier", 1250, 368);
  poi("po_timberyard", "Verdant Timberyard", "sawmill", 1022, 454);
  poi("po_ember", "Emberport", "port", 1244, 838);
  poi("po_slag", "Slagworks Foundry", "smelter", 1190, 936, { gate: "hazard" });
  poi("po_southfoot", "Southfoot Landing", "port", 1196, 1070);
  // Gulf
  poi("po_gulfhead", "Gulfhead", "port", 1052, 878, { scale: 1.2 });
  poi("po_filter", "Delta Sluice & Filter Station", "filter", 934, 868);
  poi("po_westbank", "Westbank Landing", "pier", 918, 930);
  // West
  poi("po_westmouth", "Westmouth", "port", 352, 556);
  poi("po_greyquarry", "Greyback Quarry", "quarry", 506, 652);
  poi("po_westwood", "Westwood Hamlet", "hamlet", 424, 742);
  poi("po_fishcamp", "Fish Camp", "hamlet", 352, 846);
  // Anubis desert
  poi("po_necropolis", "Necropolis of the Hollow Sun", "elder_site", 604, 1042, { elder: "anubis" });
  poi("po_tombs", "Dune Tombs", "tomb", 520, 1086, { elder: "anubis" });
  poi("po_cairns", "Sunken Cairns", "ruins", 470, 990, { elder: "anubis" });
  poi("po_oasis", "Mirage Camp", "village", 668, 984, { elder: "anubis" });
  poi("po_bonestop", "Bone Road Waystation", "roadstop", 752, 975, { elder: "anubis" });
  poi("po_sandgate", "Sandgate", "port", 704, 1124);
  // West isles — Atlas
  poi("po_gate", "Threshold Gate", "gate", 168, 512, { elder: "atlas", ...D("Ngưỡng không gian: bước qua vào cảnh không gian khác CÙNG thế giới; có đường quay lại tại neo; KHÔNG phải vận tải miễn phí (không nối cổng ↔ cổng).") });
  poi("po_dpier", "Drowned Pier", "pier", 226, 520, { elder: "atlas" });
  poi("po_beacon", "Beacon Rock Light", "observatory", 268, 656, { elder: "atlas" });
  poi("po_wreck", "Wreck Isle Salvage", "ruins", 184, 872, { depth: "surface", resources: ["scrap", "fish"] });
  poi("po_tidecamp", "Tidepool Fishing Camp", "hamlet", 170, 548, { elder: undefined, resources: ["fish", "food"], notes: "Sinh kế thường ngày trên Threshold Isle (không phụ thuộc Atlas)." });
  poi("po_gullnest", "Seabird Nesting Cliffs", "grove", 1872, 428, { resources: ["food", "fish"] });
  poi("po_gullpier", "Tern Hut Pier", "pier", 1862, 470);
  poi("po_netcamp", "Gull Net Camp", "hamlet", 140, 848);
  // Cinder Isle — Surtur
  poi("po_cindercamp", "Cinder Camp", "village", 1596, 884, { elder: "surtur" });
  poi("po_obsq", "Obsidian Quarry", "quarry", 1650, 776, { resources: ["obsidian", "stone"], elder: "surtur" });
  poi("po_sulfur", "Sulfur Works", "mine", 1768, 882, { resources: ["sulfur"], elder: "surtur", gate: "hazard" });
  poi("po_geo", "Geothermal Station", "powerplant", 1736, 916, { elder: "surtur" });
  poi("po_emberwatch", "Ember Watch", "observatory", 1620, 746, { elder: "surtur" });
  poi("po_surtur", "Foundry of the First Fire", "elder_site", 1694, 826, { elder: "surtur" });
  // Saltwick / Gull / Ironholm
  poi("po_saltharbor", "Saltwick Harbor", "port", 1546, 334);
  poi("po_saltpans", "Salt Pans", "quarry", 1640, 322, { resources: ["salt"] });
  poi("po_saltlight", "Saltwick Light", "observatory", 1732, 262);
  poi("po_racks", "Kelp Racks", "hamlet", 1690, 354, { resources: ["fish", "food"] });
  poi("po_gullwreck", "Gull Isle Wreck", "ruins", 1886, 446, { depth: "surface", resources: ["scrap", "fish"] });
  poi("po_ironharbor", "Ironholm Harbor", "port", 1108, 1264);
  poi("po_ironmine", "Ironholm Mine", "mine", 1186, 1290, { resources: ["ore"] });
  poi("po_ironwh", "Ironholm Depot", "warehouse", 1236, 1290);
  // Ragnarok (non-boss)
  poi("po_rc_meridian", "Meridian Archive Cache", "ragnarok_cache", 1138, 668, D("Rương tiền cuối 72h — không qua Elder. Số lượng/giá trị do Gameplay/A3 quyết."));
  poi("po_rc_ironvein", "Foreman's Strongbox", "ragnarok_cache", 1222, 676);
  poi("po_rc_kestrel", "Kestrel Tower Safe", "ragnarok_cache", 708, 318);
  poi("po_rc_dam", "Falls Dam Vault", "ragnarok_cache", 754, 454);
  poi("po_rc_sandgate", "Sandgate Customs Strongbox", "ragnarok_cache", 718, 1106);
  poi("po_rc_salt", "Saltwick Harbor Safe", "ragnarok_cache", 1560, 322);
  poi("po_vend_gulf", "Gulfhead Trading House [ĐỀ XUẤT]", "chest_vendor", 1066, 894, { conf: "assumption" });
  poi("po_vend_strait", "Strait Landing Counter [ĐỀ XUẤT]", "chest_vendor", 1286, 500, { conf: "assumption" });
  poi("po_evac_west", "Westmouth Evac Pier", "evac", 336, 580);
  poi("po_evac_south", "Southfoot Evac Beach", "evac", 1178, 1090);
  poi("po_evac_hook", "Hook Evac Point", "evac", 1392, 374);
  const link = (a: string, b: string, kind: string) => { const o = p.pois.find((x) => x.id === a); if (o) o.links.push({ to: b, kind }); };
  link("po_vend_gulf", "po_rc_meridian", "tiền Ragnarok → bán rương"); link("po_vend_strait", "po_rc_ironvein", "tiền Ragnarok → bán rương");
  link("po_falls", "po_meridian", "điện → cơ sở sâu"); link("po_falls", "po_kestrel", "điện → cơ sở sâu"); link("po_geo", "po_surtur", "điện địa nhiệt"); link("po_sawaion", "po_ironvein", "gỗ chống hầm");

  // ---------------- docks ----------------
  const coastNear = (q: Pt): Pt => { let b: Pt = q, bd = 1e9; for (const l of p.land) for (const r of l.rings) { const n = nearestOnLine(r, q, true); if (n.d < bd) { bd = n.d; b = n.pt; } } return b; };
  const dock = (id: string, name: string, anchor: Pt, kind: Dock["kind"], water: string) => {
    let at: Pt;
    if (water === "sea") at = coastNear(anchor);
    else if (p.lakes.some((l) => l.id === water)) at = nearestOnLine(p.lakes.find((l) => l.id === water)!.ring, anchor, true).pt;
    else { const r = p.rivers.find((x) => x.id === water)!; at = nearestOnLine(catmull(r.points).pts, anchor).pt; }
    p.docks.push({ id, name, at, kind, water, conf: "proposal" });
  };
  dock("dk_westmouth", "Westmouth Pier", [330, 556], "coastal", "sea");
  dock("dk_emberport", "Emberport Quay", [1262, 846], "coastal", "sea");
  dock("dk_cinder", "Cinder Camp Dock", [1566, 884], "coastal", "sea");
  dock("dk_hook", "Hook Quay", [1415, 372], "coastal", "sea");
  dock("dk_saltwick", "Saltwick Harbor Dock", [1526, 326], "coastal", "sea");
  dock("dk_saltwick_e", "Saltwick East Landing", [1778, 330], "coastal", "sea");
  dock("dk_gull", "Gull Isle Dock", [1846, 440], "coastal", "sea");
  dock("dk_southfoot", "Southfoot Dock", [1190, 1098], "coastal", "sea");
  dock("dk_ironholm", "Ironholm Harbor Dock", [1120, 1226], "coastal", "sea");
  dock("dk_threshold", "Drowned Pier Dock", [238, 522], "coastal", "sea");
  dock("dk_wreck", "Wreck Isle Dock", [230, 868], "coastal", "sea");
  dock("dk_beacon", "Beacon Rock Landing", [262, 640], "coastal", "sea");
  dock("dk_fishcamp", "Fish Camp Pier", [330, 846], "coastal", "sea");
  dock("dk_sandgate", "Sandgate Dock", [700, 1138], "coastal", "sea");
  dock("dk_gulfhead", "Gulfhead Quay", [1022, 930], "coastal", "sea");
  dock("dk_westbank", "Westbank Landing Dock", [932, 940], "coastal", "sea");
  dock("dk_strait", "Strait Landing Dock", [1262, 500], "coastal", "rv_east");
  dock("dk_grey_n", "Greywater North Landing", [800, 497], "inland", "lk_grey");
  dock("dk_grey_s", "Greywater Hamlet Dock", [812, 571], "inland", "lk_grey");
  dock("dk_verdant_s", "Timberyard Dock", [1018, 436], "inland", "lk_verdant");
  dock("dk_verdant_n", "Verdant North Landing", [985, 362], "inland", "lk_verdant");
  dock("dk_moss", "Mossbrook Mill Dock", [1004, 728], "inland", "rv_moss");
  dock("dk_confl", "Confluence Landing", [912, 668], "inland", "rv_grey_low");
  dock("dk_mirage", "Mirage Pool Landing", [660, 986], "inland", "lk_mirage");
  dock("dk_mere", "Hook Mere Pier Dock", [1236, 366], "inland", "lk_mere");
  dock("dk_delta", "Delta Sluice Dock", [968, 884], "inland", "rv_d1");
  dock("dk_canal", "Saddle Lock Basin", [1060, 506], "inland", "rv_canal");

  // ---------------- resources (deterministic, biome driven) ----------------
  let rn = 0;
  const res = (kind: string, at: Pt, r: number, dens: number, name?: string) => p.resources.push({ id: "rs_" + (rn++).toString(36), name: name || lbl[kind], at, kind, r, dens, gate: "none", conf: "proposal" } as Resource);
  const k0 = (q: Pt) => Math.floor(q[1] / CELL) * GW + Math.floor(q[0] / CELL);
  const table: Record<number, [string, number, number][]> = {
    0: [["food", 0.38, 3], ["wood", 0.06, 1]], 1: [["wood", 0.55, 2], ["food", 0.14, 1], ["herbs", 0.1, 1]], 2: [["wood", 0.6, 3], ["herbs", 0.25, 2], ["food", 0.1, 1]],
    3: [["wood", 0.4, 2], ["stone", 0.14, 1]], 4: [["herbs", 0.3, 2], ["clay", 0.22, 2], ["food", 0.15, 1]], 5: [["stone", 0.07, 1], ["food", 0.05, 1]],
    6: [["food", 0.22, 2], ["stone", 0.15, 1], ["herbs", 0.08, 1]], 7: [["stone", 0.5, 3]], 8: [["stone", 0.1, 1]], 9: [["obsidian", 0.35, 3], ["stone", 0.25, 2], ["sulfur", 0.1, 1]],
    10: [["sulfur", 0.3, 2], ["scrap", 0.08, 1]], 11: [["fish", 0.45, 2], ["food", 0.1, 1]],
  };
  for (let y = 28; y < WORLD_H; y += 56) for (let x = 28; x < WORLD_W; x += 56) {
    const q: Pt = [x + (hash2(x, y, 1) - 0.5) * 40, y + (hash2(x, y, 2) - 0.5) * 40], k = k0(q);
    if (!f.land[k] || f.lake[k] || f.river[k]) continue;
    const b = f.biome[k];
    let h = hash2(x, y, 9), acc = 0;
    for (const [kind, pr, dens] of table[b] || []) { acc += pr; if (h < acc) { if (kind === "fish" && f.dc[k] > 22) break; res(kind, q, 22 + dens * 6, dens); break; } }
    if (b === 7 && f.elev[k] > 0.45 && hash2(x, y, 4) < 0.12) res("ore", q, 20, 1);
  }
  for (const rv of p.rivers) {
    const S = resample(catmull(rv.points).pts, 150).pts;
    S.forEach((q, i) => { const n = nearestOnLine(catmull(rv.points).pts, q); const sd = i % 2 ? 13 : -13; res("fresh_water", [n.pt[0] + sd, n.pt[1] + sd * 0.4], 14, rv.width >= 5 ? 3 : rv.width >= 3 ? 2 : 1, "Nước ngọt — " + rv.name); if (rv.nav.includes(1) && i % 2 === 0) res("fish", [n.pt[0] - sd, n.pt[1]], 16, 2, "Cá — " + rv.name); });
  }
  for (const lk of p.lakes) for (let i = 0; i < 4; i++) { const q = lk.ring[Math.floor((i / 4) * lk.ring.length)]; const c = lk.ring.reduce((a, z) => [a[0] + z[0] / lk.ring.length, a[1] + z[1] / lk.ring.length] as Pt, [0, 0] as Pt); res("fresh_water", [lerp(q[0], c[0], -0.25), lerp(q[1], c[1], -0.25)], 16, lk.oasis ? 1 : 3, "Nước ngọt — " + lk.name); if (i % 2 === 0) res("fish", [q[0], q[1]], 16, 2, "Cá — " + lk.name); }
  for (const [kind, x, y, r, d, n] of [["ore", 1205, 655, 34, 3, "Ironvein ore"], ["ore", 1186, 1290, 34, 3, "Ironholm ore"], ["salt", 1640, 322, 34, 3, "Salt pans"], ["sulfur", 1768, 882, 30, 3, "Sulfur vents"], ["obsidian", 1650, 776, 30, 3, "Obsidian seam"], ["clay", 980, 840, 30, 3, "Delta clay"], ["stone", 506, 652, 36, 3, "Greyback stone"], ["stone", 600, 525, 36, 3, "Fracture stone"], ["herbs", 868, 740, 36, 3, "Elderwood herbs"]] as [string, number, number, number, number, string][]) res(kind, [x + 10, y + 10], r, d, n);

  for (const [x, y, d, n] of [[1330, 312, 2, "Hook cliffs"], [1262, 424, 1, "Hook boulders"], [1352, 372, 2, "Hook shore rock"], [760, 612, 1, "Silverrun cobbles"], [866, 620, 2, "Greywater shingle"], [396, 640, 2, "West terrace rock"], [412, 566, 1, "Westmouth boulders"], [872, 904, 1, "Gulf west outcrop"], [806, 930, 2, "Gulf bank rock"], [1040, 560, 1, "Mossbrook erratics"], [1010, 330, 1, "Argus Brook rocks"], [1246, 716, 2, "Eastern Hills scree"]] as [number, number, number, string][]) res("stone", toLand([x, y], "stone"), 24, d, n);
  for (const l of p.land) {
    if (l.kind === "main") continue;
    const have = new Set(p.resources.filter((r) => pipRings(r.at, l.rings)).map((r) => r.kind));
    const ring = l.rings[0], cen: Pt = ring.reduce((a, q) => [a[0] + q[0] / ring.length, a[1] + q[1] / ring.length] as Pt, [0, 0] as Pt);
    let k = 0;
    for (const kind of ["fresh_water", "food", "fish", "stone", "wood"]) {
      if (have.has(kind) || l.kind === "islet") continue;
      for (let t = 0; t < 14; t++) { const a = k * 1.7 + t * 0.9, r = 14 + t * 5, q: Pt = [cen[0] + Math.cos(a) * r, cen[1] + Math.sin(a) * r]; if (onLand(q)) { res(kind, q, 20, 1 + (k % 2), (kind === "fresh_water" ? "Giếng/hứng nước mưa — " : "") + l.name); break; } }
      k++;
    }
  }
  // ---------------- elder territories (defined BEFORE roads: ordinary roads must stay out of Elder cores) ----------------
  const el = (e: string, name: string, outer: Pt[], core: Pt[], arenas: Pt[][], approach: Pt[], pois: string[], rag: string) => p.elders.push({ id: "el_" + e, name, elder: e, outer, core, arenas, approach, pois, ragnarok: rag, conf: "proposal" } as ElderT);
  el("surtur", "Surtur — Reality", blob([1684, 832], 128, 122, 0, 41), blob([1692, 824], 72, 62, 0.2, 42), [blob([1692, 826], 34, 30, 0, 43)], [[1596, 884], [1640, 850]], ["po_surtur", "po_emberwatch", "po_obsq", "po_geo", "po_cindercamp"], "Làn nhiệt quanh miệng núi lửa (có giới hạn); KHÔNG tự đốt nhà. Lối rút: Cinder Camp ↔ phà Emberport — không cần đánh Elder.");
  el("typhon", "Typhon — Power", blob([585, 375], 150, 120, 0.2, 44), blob([556, 345], 70, 58, 0, 45), [blob([556, 350], 38, 34, 0, 46)], [[690, 500], [655, 448]], ["po_typhon", "po_viaduct", "po_freightyard", "po_fracquarry", "po_falls"], "Sóng áp lực dọc khe vực; không tự xóa cầu/nhà khi offline. Lối rút: Falls Road.");
  el("aion", "Aion — Time", blob([878, 716], 180, 135, 0.1, 47), blob([868, 712], 82, 62, 0, 48), [blob([868, 712], 40, 36, 0, 49)], [[748, 668], [918, 668], [990, 740]], ["po_elderwood", "po_glade", "po_sapgrove", "po_sawaion", "po_kilns", "po_ranger"], "Echo thời gian cục bộ; KHÔNG thao túng đồng hồ 336h hay sản xuất offline. Rừng vẫn khai thác được ở rìa.");
  el("atlas", "Atlas — Space", blob([172, 514], 92, 84, 0, 50), blob([168, 512], 38, 36, 0, 51), [blob([168, 512], 26, 24, 0, 52)], [[226, 520]], ["po_gate", "po_dpier", "po_beacon", "po_westmouth"], "Cổng/neo hợp lệ có đường quay lại; không teleport toàn bản đồ; phà Westmouth vẫn là tuyến chính.");
  el("argus", "Argus — Mind", blob([965, 228], 170, 92, -0.1, 53), blob([995, 214], 52, 36, 0, 54), [blob([996, 214], 28, 22, 0, 55)], [[936, 262]], ["po_academy", "po_observatory", "po_archive", "po_hall_eyes", "po_lantern"], "Vùng nhìn rộng có địa hình che khuất; không định vị nhà người chơi. Học viện vẫn dùng được thường ngày.");
  el("anubis", "Anubis — Soul", blob([592, 1030], 195, 112, 0.1, 56), blob([600, 1042], 66, 46, 0, 57), [blob([602, 1042], 34, 30, 0, 58)], [[752, 975], [668, 984]], ["po_necropolis", "po_tombs", "po_cairns", "po_oasis", "po_bonestop"], "Đoàn hồn di chuyển có khoảng trống/đối trọng; không nhân đôi túi chết. Ốc đảo + Bone Road vẫn an toàn tương đối.");

  const pen = new Float32Array(f.gw * f.gh).fill(1);
  for (const e of p.elders) if (e.core.length > 2) for (let j = 0; j < f.gh; j++) for (let i = 0; i < f.gw; i++) if (pip([(i + 0.5) * f.cell, (j + 0.5) * f.cell], e.core)) pen[j * f.gw + i] = 8;
  f.penalty = pen;
  // ---------------- roads (A* over terrain, trimmed to T-junctions) ----------------
  let rdn = 0;
  const addRoad = (name: string, kind: RoadKind, pts: Pt[], o: Partial<Road> = {}) => {
    const a = snapToRoads(p, pts[0], 12), b = snapToRoads(p, pts[pts.length - 1], 12);
    pts = [a, ...pts.slice(1, -1), b];
    p.roads.push({ id: "rd_" + (rdn++).toString(36), name, points: pts, kind, conf: "proposal", ...o });
    markRoad(f, pts, kind);
  };
  const poiAt = (s: string | Pt): Pt => (typeof s === "string" ? p.pois.find((o) => o.id === s)!.at : s);
  const route = (name: string, kind: RoadKind, stops: (string | Pt)[], o: Partial<Road> = {}) => {
    const approach = stops.some((x) => typeof x === "string" && ["elder_site", "gate"].includes(p.pois.find((q) => q.id === x)?.arche || ""));
    const keepPen = f.penalty;
    if (approach) f.penalty = undefined;
    for (let i = 0; i < stops.length - 1; i++) {
      const A = poiAt(stops[i]), B = poiAt(stops[i + 1]);
      let runs = routeRuns(f, A, B, kind === "cart" ? "cart" : "foot");
      let kd = kind;
      if (!runs.length && kind === "cart" && dist(A, B) > 20) { runs = routeRuns(f, A, B, "foot"); kd = "foot"; if (runs.length) console.warn("[seed] cart->foot fallback", name, i); }
      runs.forEach((r, j) => addRoad(runs.length > 1 ? `${name} (${j + 1})` : stops.length > 2 ? `${name} (${i + 1})` : name, kd, r, o));
    }
    f.penalty = keepPen;
  };
  const C = (n: string, s: (string | Pt)[], purpose: string, o: Partial<Road> = {}) => route(n, "cart", s, { purpose, ...o });
  C("Gulf–Mossbrook Freight Trunk", ["po_gulfhead", "po_mill", "po_timberyard"], "Gỗ/quặng/lương thực ↔ cảng vịnh");
  C("East Ore Freight", ["po_ember", "po_ironvein", "po_ridgestop", "po_strait"], "Quặng mỏ Ironvein → cảng");
  C("Gulf Coast Freight", ["po_gulfhead", "po_slag", "po_ember"], "Thương mại giữa cảng vịnh và Emberport");
  C("Hook Road", ["po_strait", "po_hook"], "Nối Eastwater với Hook");
  C("Greywater Cross Freight", ["po_greywater", "po_confluence", "po_mill"], "Liên kết thung lũng Greywater ↔ Mossbrook");
  C("West Forest Freight", ["po_greywater", "po_sawaion", "po_greyquarry"], "Gỗ + đá về hồ");
  C("Falls Road", ["po_greywater", "po_pumphouse", "po_falls", "po_freightyard"], "Đá Typhon, điện thác → hồ");
  C("North Road", ["po_timberyard", "po_academy"], "Gỗ → học viện; trục bắc");
  C("Lantern Road", ["po_academy", "po_lanternstn", "po_hook"], "Tuyến ven vịnh Lantern");
  C("Bone Road", ["po_sandgate", "po_oasis", "po_bonestop", "po_westbank", "po_gulfhead"], "Sa mạc → vịnh (qua các nhánh châu thổ)");
  C("Old Pump Link", ["po_oldpump", "po_bonestop"], "Cơ sở sâu ↔ Bone Road");
  C("West Coast Road", ["po_westmouth", "po_westwood", "po_greyquarry"], "Ven biển tây ↔ mỏ đá");
  C("Southfoot Freight", ["po_slag", "po_southfoot"], "Xưởng luyện → bến nam");
  C("Silo Link", ["po_siloc", "po_mill"], "Kho lương thực ↔ cối xay");
  C("Cinder Freight", ["po_cindercamp", "po_obsq", "po_sulfur", "po_geo"], "Obsidian/lưu huỳnh → bến Cinder");
  C("Saltwick Freight", ["po_saltharbor", "po_saltpans", "po_racks"], "Muối/cá → bến Saltwick");
  C("Ironholm Freight", ["po_ironharbor", "po_ironmine", "po_ironwh"], "Quặng → bến Ironholm");
  const T = (n: string, k: RoadKind, s: (string | Pt)[], purpose: string, o: Partial<Road> = {}) => route(n, k, s, { purpose, ...o });
  T("Elderwood Trail", "trail", ["po_sawaion", "po_ranger", "po_glade", "po_elderwood"], "Đường rừng / tiếp cận Aion");
  T("Sap Grove Trail", "trail", ["po_confluence", "po_sapgrove", "po_elderwood"], "Đường rừng / lối rút thứ hai");
  T("Kilns Trail", "trail", ["po_ranger", "po_kilns", "po_mill"], "Than củi → cối xay");
  T("Typhon Approach", "trail", ["po_freightyard", "po_viaduct", "po_typhon"], "Tiếp cận Typhon — ngoại vi có giá trị");
  T("Academy Trail", "trail", ["po_academy", "po_observatory"], "Đường lên đài quan sát");
  T("Archive Trail", "trail", ["po_academy", "po_archive", "po_hall_eyes"], "Tiếp cận Argus");
  T("Lantern Trail", "trail", ["po_lantern", "po_observatory"], "Hải đăng ↔ đài quan sát");
  T("Kestrel Trail", "trail", ["po_academy", "po_kestrel"], "Tới tháp radio");
  T("Lantern Cove Trail", "trail", ["po_lanternstn", "po_lantern"], "Hải đăng ↔ trạm vịnh (vòng ngoài lõi Argus)");
  T("Dune Rim Trail", "trail", ["po_oasis", [598, 968], "po_cairns"], "Vòng phía bắc lõi Anubis: tuyến thường ngày không đi xuyên lõi");
  T("Tomb West Trail", "trail", ["po_cairns", [468, 1048], "po_tombs"], "Vòng phía tây lõi Anubis");
  T("Rapids Portage Trail", "trail", ["po_timberyard", "po_rapids", "po_strait"], "Đường vòng ghềnh Eastwater");
  T("Meridian Trail", "trail", ["po_meridian", "po_ridgestop"], "Tới cơ sở nghiên cứu");
  T("Dune Trail", "trail", ["po_bonestop", "po_necropolis"], "Tiếp cận Anubis");
  T("Tomb Trail", "trail", ["po_oasis", "po_tombs", "po_cairns"], "Lăng mộ ↔ ốc đảo");
  T("Hook Mere Trail", "trail", ["po_hook", "po_mere"], "Bến hồ");
  T("Delta Levee Path", "foot", ["po_gulfhead", "po_filter"], "Trạm lọc châu thổ");
  T("Fish Camp Path", "foot", ["po_westwood", "po_fishcamp"], "Trại cá");
  T("Wreck Isle Path", "foot", ["po_netcamp", "po_wreck"], "Salvage");
  T("Threshold Path", "foot", ["po_dpier", "po_gate"], "Đường tới ngưỡng không gian (có đường quay lại)");
  T("Ember Watch Trail", "trail", ["po_cindercamp", "po_emberwatch", "po_surtur"], "Tiếp cận Surtur");
  T("Salt Light Trail", "trail", ["po_saltpans", "po_saltlight"], "Hải đăng Saltwick");
  T("Beacon Path", "foot", ["po_dpier", "po_beacon"], "—");
  T("Greywater–Mill Forest Detour", "trail", ["po_greywater", "po_ranger", "po_mill"], "Tuyến thay thế xuyên rừng", { alt: true });
  T("Falls–Kestrel Ridge Detour", "foot", ["po_falls", "po_kestrel"], "Tuyến thay thế qua sườn núi", { alt: true });
  T("Coast Detour", "foot", ["po_westbank", "po_filter"], "Tuyến thay thế quanh đầu vịnh", { alt: true });
  // riverside paths (offset of the river curve)
  const side = (id: string, name: string, d: number, f0: number, f1: number) => {
    const rv = p.rivers.find((r) => r.id === id)!;
    const S = resample(catmull(rv.points).pts, 14).pts;
    const sl = S.slice(Math.floor(S.length * f0), Math.ceil(S.length * f1));
    let off = offsetLine(sl, d);
    if (off.filter((q) => onLand(q)).length < off.length * 0.8) off = offsetLine(sl, -d);
    off = off.filter((q) => onLand(q));
    if (off.length > 3) addRoad(name, "riverside", rdp(off, 3), { purpose: "Đường ven sông (bờ tây)" });
  };
  side("rv_grey_low", "Greywater West Bank Path", 17, 0.02, 0.9);
  side("rv_east", "Eastwater North Bank Path", 15, 0.55, 1);
  // docks must be reachable on foot: trail to the nearest road, else to the nearest POI on the same island
  for (const d of p.docks) {
    let bd = 1e9, bq: Pt = d.at;
    for (const r of p.roads) { if (r.kind === "ferry") continue; const n = nearestOnLine(catmull(r.points).pts, d.at); if (n.d < bd) { bd = n.d; bq = n.pt; } }
    if (bd <= 34) continue;
    const targets: Pt[] = [bq, ...[...p.pois].sort((a, b) => dist(a.at, d.at) - dist(b.at, d.at)).slice(0, 3).map((o) => o.at)];
    for (const t of targets) { const runs = routeRuns(f, d.at, t, "foot"); if (runs.length) { runs.forEach((r) => addRoad("Lối ra bến " + d.name, "trail", r, { purpose: "Bến ↔ đường/POI" })); break; } }
  }
  // access trails for any POI not already on a road
  for (const po of p.pois) {
    let best = 1e9, bq: Pt = po.at;
    for (const r of p.roads) { if (r.kind === "ferry") continue; const n = nearestOnLine(catmull(r.points).pts, po.at); if (n.d < best) { best = n.d; bq = n.pt; } }
    if (best > 34 && best < 1e8) {
      const keepP: Float32Array | undefined = f.penalty;
      if (po.elder || po.arche === "elder_site" || po.arche === "gate") f.penalty = undefined;
      const runs = routeRuns(f, po.at, bq, "foot");
      f.penalty = keepP;
      runs.forEach((r) => addRoad("Lối vào " + po.name, "trail", r, { purpose: "Tuyến tiếp cận POI" }));
    }
  }
  // ferries
  const dk = (id: string) => p.docks.find((d) => d.id === id)!.at;
  const ferry = (name: string, a: string, b: string, via: Pt[] = []) => p.roads.push({ id: "rd_" + (rdn++).toString(36), name, kind: "ferry", points: [dk(a), ...via, dk(b)], purpose: "Phà/thuyền — loại thuyền, tải, tốc độ là GIẢ ĐỊNH chờ Gameplay Tower", conf: "assumption" });
  ferry("Westmouth ↔ Threshold ferry", "dk_westmouth", "dk_threshold");
  ferry("Fish Camp ↔ Wreck Isle ferry", "dk_fishcamp", "dk_wreck");
  ferry("Drowned Pier ↔ Beacon Rock ferry", "dk_threshold", "dk_beacon", [[252, 590]]);
  ferry("Emberport ↔ Cinder ferry", "dk_emberport", "dk_cinder", [[1400, 872], [1500, 880]]);
  ferry("Hook ↔ Saltwick ferry", "dk_hook", "dk_saltwick", [[1470, 352]]);
  ferry("Saltwick ↔ Gull Isle ferry", "dk_saltwick_e", "dk_gull");
  ferry("Southfoot ↔ Ironholm ferry", "dk_southfoot", "dk_ironholm", [[1160, 1160]]);
  ferry("Gulf ferry (Gulfhead ↔ Ironholm)", "dk_gulfhead", "dk_ironholm", [[1000, 990], [1000, 1070], [1070, 1160]]);
  // bridges where roads cross rivers (small streams are fords)
  let bn = 0;
  for (const rd of p.roads) {
    if (rd.kind === "ferry") continue;
    const c = catmull(rd.points).pts;
    for (const rv of p.rivers) {
      for (const h of lineInts(c, catmull(rv.points).pts)) {
        const small = rv.kind !== "canal" && rv.width <= 3;
        if (small && rd.kind !== "cart") { rd.ford = true; continue; }
        const load: Bridge["load"] = rd.kind === "cart" ? "cart" : "foot";
        const ex = p.bridges.find((b) => dist(b.at, h.p) < 22);
        if (ex) { if (load === "cart") ex.load = "cart"; continue; }
        const a = c[h.i], b = c[h.i + 1];
        p.bridges.push({ id: "br_" + (bn++).toString(36), name: `Cầu ${rv.name}`, at: h.p, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), load, conf: "proposal" });
      }
    }
  }
  rasterRoads(p, f);

  // ---------------- build zones ----------------
  const zone = (id: string, name: string, cx: number, cy: number, w: number, h: number, rot: number, tags: string[], soil: string, water: string, slope: string, notes = "") => {
    let c = toLand([cx, cy], id);
    if (!id.includes("slag") && !buildable(f, c).ok) {
      let found = false;
      for (let r = 8; r <= 110 && !found; r += 8) for (let a = 0; a < 16 && !found; a++) { const q: Pt = [c[0] + Math.cos(a * 0.3927) * r, c[1] + Math.sin(a * 0.3927) * r]; if (onLand(q) && buildable(f, q).ok) { c = q; found = true; } }
    }
    let ring = blob(c, w / 2, h / 2, rot, Math.floor(cx + cy), 10, 0.16).map((q) => {
      let v = q;
      for (let i = 0; i < 12 && !onLand(v); i++) v = [lerp(v[0], c[0], 0.2), lerp(v[1], c[1], 0.2)];
      return v;
    });
    const lakes: Poly[] = p.lakes.map((l) => [l.ring]);
    const cl = clipDiff([[ring]], lakes);
    if (cl.length) ring = cl.sort((a, b) => b[0].length - a[0].length)[0][0];
    const cc = centroid(ring);
    if (!id.includes("slag") && !buildable(f, cc).ok) {
      let done = false;
      for (let r = 6; r <= 120 && !done; r += 6) for (let a = 0; a < 16 && !done; a++) { const q: Pt = [cc[0] + Math.cos(a * 0.3927) * r, cc[1] + Math.sin(a * 0.3927) * r]; if (onLand(q) && buildable(f, q).ok) { ring = ring.map((v) => [v[0] + q[0] - cc[0], v[1] + q[1] - cc[1]] as Pt); done = true; } }
    }
    p.zones.push({ id, name, ring, soil, water, slope, tags, notes, conf: "proposal" } as BuildZone);
  };
  zone("bz_greywater", "Greywater Lakeshore Terrace", 790, 612, 170, 46, 0, ["bờ hồ", "bình nguyên"], "đất bồi pha cát", "hồ sát bờ", "thoải");
  zone("bz_silver", "Silverrun Meadow Bank", 700, 668, 150, 36, 0, ["ven sông", "bình nguyên"], "đất phù sa", "sông nhỏ", "phẳng");
  zone("bz_moss", "Mossbrook Valley Floor", 1050, 640, 70, 150, 0.3, ["ven sông", "gần đường vận tải"], "đất phù sa", "suối + kênh", "phẳng");
  zone("bz_verdant", "Lake Verdant South Meadow", 1010, 484, 150, 40, 0, ["bờ hồ", "bình nguyên", "gần đường vận tải"], "đất mùn", "hồ + kênh", "thoải");
  zone("bz_elder_clear", "Hollow Oaks Clearing", 800, 790, 70, 55, 0, ["trong rừng"], "đất mùn rừng", "giếng/suối xa", "thoải", "Nơi ở kín trong rừng: ít dấu chân, chở quặng xa.");
  zone("bz_greyback", "Greyback Foothill Shelf", 540, 740, 58, 80, 0.2, ["nền đá cao"], "nền đá", "xa nước", "dốc nhẹ", "Nền đá cao, dễ phòng thủ, khó làm vườn.");
  zone("bz_typhon_t", "Typhon Terrace", 700, 478, 70, 40, 0, ["nền đá cao", "gần trung tâm khai thác"], "đá vụn", "thác gần", "dốc nhẹ");
  zone("bz_ridge", "Ironvein Ridge Ledge", 1160, 640, 46, 80, 0, ["nền đá cao", "gần trung tâm khai thác"], "đá", "xa nước", "dốc nhẹ");
  zone("bz_eastflats", "Eastwater Estuary Flats", 1240, 500, 90, 34, 0, ["ven sông", "ven biển", "bình nguyên"], "phù sa ven biển", "sông + biển", "phẳng");
  zone("bz_hook", "Hook Meadow", 1282, 392, 110, 50, 0, ["bình nguyên", "bờ hồ"], "đất mùn", "hồ Hook Mere", "phẳng");
  zone("bz_westmouth", "Westmouth Coastal Terrace", 386, 596, 56, 90, 0, ["ven biển", "bình nguyên"], "cát pha", "suối Westbrook", "thoải");
  zone("bz_westwood", "West Woods Shelf", 436, 770, 56, 100, 0.1, ["trong rừng", "ven biển"], "đất rừng", "suối nhỏ", "thoải");
  zone("bz_gulfwest", "Gulf West Bank Flats", 880, 920, 100, 60, 0, ["ven biển", "gần đường vận tải"], "cát pha", "vịnh + kênh châu thổ", "phẳng");
  zone("bz_delta", "Delta Levee", 1100, 836, 70, 44, 0, ["ven sông", "gần đường vận tải"], "bồi tích (ngập mùa mưa)", "nhiều nhánh", "phẳng", "Dễ ngập — đánh đổi thật.");
  zone("bz_oasis", "Mirage Oasis Terrace", 650, 962, 80, 40, 0, ["bờ hồ"], "cát cứng", "ốc đảo", "phẳng", "Nước quý hiếm trong sa mạc.");
  zone("bz_dune", "Dune Rock Outcrop", 548, 960, 50, 40, 0, ["nền đá cao"], "đá nổi", "xa nước", "dốc nhẹ");
  zone("bz_cinder", "Cinder Landing Shelf", 1604, 868, 56, 40, 0, ["ven biển"], "tro + đá", "suối ấm", "thoải");
  zone("bz_salt", "Saltwick Flats", 1608, 336, 100, 40, 0, ["ven biển", "bình nguyên"], "đất mặn", "suối nhỏ", "phẳng");
  zone("bz_ironholm", "Ironholm Terrace", 1140, 1280, 70, 40, 0, ["ven biển", "gần trung tâm khai thác"], "đá", "suối Slag Run", "thoải");
  zone("bz_argus", "Argus Valley Pasture", 900, 306, 110, 38, 0, ["ven sông", "bình nguyên"], "đất mùn", "suối Argus", "thoải");
  zone("bz_kestrel", "Kestrel Ridge Shelf", 700, 346, 60, 40, 0, ["nền đá cao"], "đá", "xa nước", "dốc nhẹ");
  zone("bz_slag", "Slag Flats Pad (đất độc — viability thấp)", 1230, 980, 60, 40, 0, ["gần đường vận tải"], "xỉ", "ô nhiễm", "phẳng", "Cố ý đặt ở vùng bất lợi để so tradeoff.");
  zone("bz_forest_n", "North Woods Hollow", 880, 392, 50, 36, 0, ["trong rừng", "ven sông"], "đất mùn", "suối Argus", "thoải");

  // ---------------- spawns ----------------
  const sp = (id: string, name: string, x: number, y: number, region: string) => p.spawns.push({ id, name, at: toLand([x, y], id), region, conf: "proposal" } as Spawn);
  sp("sp_west", "Spawn: Westmouth Shore", 372, 606, "Bờ tây");
  sp("sp_lake", "Spawn: Greywater South Shore", 790, 622, "Thung lũng hồ");
  sp("sp_hook", "Spawn: Hook Meadow", 1282, 392, "Bán đảo Hook");
  sp("sp_gulf", "Spawn: Gulf West Bank", 872, 930, "Vịnh phía tây");

  // ---------------- labels ----------------
  const L = (text: string, x: number, y: number, size: number, style: Label["style"], rot = 0) => p.labels.push({ id: "lb_" + (p.labels.length).toString(36), name: text, text, at: [x, y], size, rot, style } as Label);
  L("VEYRA", 1250, 130, 48, "region"); L("Typhon Massif", 560, 300, 20, "region", -0.1); L("Argus Highlands", 930, 200, 18, "region");
  L("Greyback Range", 505, 760, 17, "region", -1.15); L("Elderwood", 878, 778, 24, "region"); L("Eastern Hills", 1210, 700, 16, "region", -1.3);
  L("Mirage Dunes", 600, 1100, 22, "region"); L("Delta Marsh", 1010, 826, 13, "region"); L("Slag Flats", 1215, 990, 13, "region"); L("Hook Peninsula", 1320, 300, 15, "region");
  L("Cinder Isle", 1690, 1000, 20, "region"); L("Saltwick", 1650, 255, 18, "region"); L("Ironholm", 1180, 1370, 18, "region"); L("Threshold Isle", 170, 610, 15, "region"); L("Wreck Isle", 176, 950, 14, "region"); L("Gull Isle", 1886, 520, 13, "region");
  L("Gulf of Rime", 985, 1050, 18, "water", 0); L("Strait of Embers", 1470, 700, 20, "water", 0.2); L("Western Deep", 70, 700, 24, "water", -1.5); L("Northern Reach", 700, 80, 24, "water"); L("Southern Sea", 600, 1290, 24, "water");
  L("Greywater Lake", 800, 535, 11, "water"); L("Lake Verdant", 1000, 398, 11, "water"); L("Mirage Pool", 650, 1002, 9, "water");

  reattach(p);
  p.baseId = 1;
  return p;
}
