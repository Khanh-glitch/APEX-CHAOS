// POI Detail Layer — deterministic site generation.
//
// Composition is authored (a hamlet square with lanes, a hall, cottages, a
// smithy and a barn), while every seedable detail — roof variants, yard props,
// tree scatter, names, interior furniture — is derived from the seed plus the
// Map Studio geography under the site. Same seed + same geography ⇒ byte-equal
// layout (see layoutHash).

import { hash2, mulberry32 } from "../geom";
import { biomeAt } from "../terrain";
import type { Poi, Project, Pt } from "../types";
import { buildConnections, buildFrame, frameAxes, gateForAngle, insideSite, localToWorld, SITE_MARGIN } from "./frame";
import type { DetailBuilding, DetailConnection, DetailFence, DetailFrame, DetailPath, DetailProp, DetailTree, GeneratedLayout, PoiDetail, ResolvedPlan, TilePt } from "./types";
import { EMPTY_OVERRIDES, applyOverrides, layoutHash } from "./types";

const BASE_W = 41, BASE_H = 28;

export const GREYWATER_POI_ID = "po_greywater";
export const DEFAULT_SEED = 20261102;

/** Generate a fresh detail record (no hand edits). */
export function generateDetail(project: Project, poi: Poi, seed = DEFAULT_SEED): PoiDetail {
  const frame = buildFrame(project, poi);
  const generated = generateLayout(project, poi, frame, seed);
  return {
    v: 1, poiId: poi.id, poiName: poi.name, seed, frame, generated,
    overrides: EMPTY_OVERRIDES(), locked: false, edited: false, hash: hashOf(generated), notes: "",
  };
}

/**
 * Re-run the generator. Hand edits are preserved because they live in
 * `overrides`, keyed by stable object ids. Orphaned overrides are dropped.
 */
export function regenerateDetail(project: Project, poi: Poi, detail: PoiDetail, seed: number): PoiDetail {
  const frame = buildFrame(project, poi);
  const generated = generateLayout(project, poi, frame, seed);
  const ids = new Set([...generated.buildings, ...generated.props, ...generated.trees].map((o) => o.id));
  const o = detail.overrides;
  const keep = <T>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([k]) => ids.has(k)));
  return {
    ...detail, seed, frame, generated,
    overrides: {
      ...o,
      buildings: keep(o.buildings) as typeof o.buildings,
      props: keep(o.props) as typeof o.props,
      trees: keep(o.trees) as typeof o.trees,
    },
    hash: hashOf(generated),
  };
}

/** Recompute geometry (frame/context) after the POI itself was edited. */
export function reframeDetail(project: Project, poi: Poi, detail: PoiDetail): PoiDetail {
  return { ...detail, frame: buildFrame(project, poi) };
}

export function resolveDetail(detail: PoiDetail): ResolvedPlan {
  return applyOverrides(detail.generated, detail.overrides);
}

export const hashOf = layoutHash;

// ---------------------------------------------------------------- layout ----

interface Lot {
  id: string; name: string; kind: DetailBuilding["kind"];
  x: number; y: number; w: number; h: number;
  wall: DetailBuilding["wall"]; roof: DetailBuilding["roof"]; floor: DetailBuilding["floor"];
  side: DetailBuilding["door"]["side"];
  chimney?: boolean; note?: string;
}

/** Base composition on the 41×28 Greywater footprint. Scaled for other sites. */
const LOTS: Lot[] = [
  { id: "b_hall", name: "Greywater Hall", kind: "hall", x: 26, y: 2, w: 10, h: 6, wall: "stone", roof: "tile", floor: "stone", side: "s", chimney: true, note: "Nhà hội làng: nơi họp chợ, kho muối và sổ đinh." },
  { id: "b_shed", name: "Chái củi", kind: "shed", x: 2, y: 2, w: 4, h: 4, wall: "wood", roof: "wood", floor: "wood", side: "s" },
  { id: "b_cottage_a", name: "Nhà bà Mây", kind: "cottage", x: 7, y: 2, w: 6, h: 5, wall: "wood", roof: "thatch", floor: "wood", side: "s" },
  { id: "b_cottage_b", name: "Nhà ông Vện", kind: "cottage", x: 14, y: 2, w: 5, h: 4, wall: "brick", roof: "thatch", floor: "wood", side: "s" },
  { id: "b_wash", name: "Nhà giặt", kind: "washhouse", x: 2, y: 9, w: 5, h: 4, wall: "stone", roof: "tin", floor: "stone", side: "s", note: "Bể hứng nước mưa và chỗ giặt chung." },
  { id: "b_cottage_c", name: "Nhà chị Sen", kind: "cottage", x: 8, y: 9, w: 5, h: 4, wall: "wood", roof: "thatch", floor: "wood", side: "s" },
  { id: "b_pump", name: "Nhà bơm", kind: "pumphouse", x: 13, y: 9, w: 4, h: 4, wall: "brick", roof: "tin", floor: "stone", side: "s", note: "Bơm nước từ sông Greywater lên bể làng." },
  { id: "b_stable", name: "Chuồng ngựa", kind: "stable", x: 26, y: 10, w: 7, h: 4, wall: "wood", roof: "wood", floor: "wood", side: "s" },
  { id: "b_storehouse", name: "Quán đầu Đông", kind: "shed", x: 36, y: 9, w: 4, h: 5, wall: "wood", roof: "thatch", floor: "wood", side: "s" },
  { id: "b_store", name: "Nhà kho Đông", kind: "barn", x: 36, y: 2, w: 4, h: 4, wall: "wood", roof: "tin", floor: "wood", side: "s" },
  { id: "b_cottage_d", name: "Nhà bác Lâm", kind: "cottage", x: 2, y: 19, w: 5, h: 5, wall: "wood", roof: "tile", floor: "wood", side: "s" },
  { id: "b_cottage_e", name: "Nhà chú Hợi", kind: "cottage", x: 8, y: 19, w: 6, h: 5, wall: "brick", roof: "thatch", floor: "wood", side: "s" },
  { id: "b_cottage_f", name: "Nhà cô Thắm", kind: "cottage", x: 15, y: 19, w: 5, h: 4, wall: "wood", roof: "tile", floor: "wood", side: "s" },
  { id: "b_smithy", name: "Lò rèn", kind: "smithy", x: 26, y: 18, w: 6, h: 5, wall: "stone", roof: "wood", floor: "stone", side: "s", chimney: true, note: "Lò than, đe sắt và bễ thổi." },
  { id: "b_barn", name: "Kho thóc", kind: "barn", x: 33, y: 18, w: 7, h: 6, wall: "wood", roof: "tin", floor: "wood", side: "s" },
];

const ROOF_ALT: Record<string, DetailBuilding["roof"][]> = {
  thatch: ["thatch", "thatch", "wood"], tile: ["tile", "tile", "thatch"], tin: ["tin", "tin", "wood"], wood: ["wood", "wood", "thatch"],
};

function generateLayout(project: Project, poi: Poi, frame: DetailFrame, seed: number): GeneratedLayout {
  const w = frame.w, h = frame.h;
  const sx = w / BASE_W, sy = h / BASE_H;
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const sInt = (v: number, s: number, min = 1) => Math.max(min, Math.round(v * s));
  const center: TilePt = [w / 2, h / 2];

  const ctxBiome = biomeAt(project, ...localToWorld(frame, center));

  // ---- buildings ----
  const buildings: DetailBuilding[] = [];
  for (const lot of LOTS) {
    const bw = sInt(lot.w, sx, 4), bh = sInt(lot.h, sy, 3);
    const bx = Math.min(w - bw - 1, sInt(lot.x, sx));
    const by = Math.min(h - bh - 1, sInt(lot.y, sy));
    if (bx < 1 || by < 1) continue;
    const roll = hash2(bx * 7 + by, seed & 1023, 11);
    const roof = roll > 0.82 ? (ROOF_ALT[lot.roof] || [lot.roof])[Math.floor(rng() * 3)] : lot.roof;
    const name = lot.name;
    const door = doorTile(bx, by, bw, bh, lot.side);
    buildings.push({
      id: `${lot.id}`, name, kind: lot.kind, x: bx, y: by, w: bw, h: bh,
      wall: lot.wall, roof, floor: lot.floor, door,
      chimney: !!lot.chimney || hash2(bx, by, 77) > 0.72,
      props: [], note: lot.note,
    });
  }

  // ---- paths: a gently bent main street, a north–south lane, a market plaza ----
  const paths: DetailPath[] = [];
  const plaza = { x: 17, y: 11, w: 9, h: 7 };
  const streetY = 15.5;
  const laneX = 20;
  paths.push({ id: "p_main", kind: "dirt", width: 2.6, points: [[0, 16.5], [9, 15.8], [19, 15.3], [29, 15.8], [41, 16.8]] });
  paths.push({ id: "p_north", kind: "dirt", width: 2.2, points: [[laneX, 0], [laneX + 0.4, 6], [laneX, 11]] });
  paths.push({ id: "p_south", kind: "dirt", width: 2.2, points: [[laneX, 18], [laneX - 0.5, 22], [laneX, 28]] });
  const backY = Math.round(h * 0.89);
  paths.push({ id: "p_back", kind: "dirt", width: 1.6, points: [[3, backY], [w - 3, backY + 0.4]] });
  paths.push({ id: "p_plaza", kind: "plaza", width: 0, points: [[plaza.x, plaza.y], [plaza.x + plaza.w, plaza.y], [plaza.x + plaza.w, plaza.y + plaza.h], [plaza.x, plaza.y + plaza.h], [plaza.x, plaza.y]] });

  // door paths: step out of the doorway, then elbow onto the nearest lane/plaza edge
  const network: TilePt[] = [[laneX, streetY], [plaza.x + plaza.w / 2, plaza.y + plaza.h], [plaza.x, streetY], [plaza.x + plaza.w, streetY], [laneX, backY]];
  for (const b of buildings) {
    const d = b.door;
    const out: TilePt = d.side === "n" ? [d.x, d.y - 1] : d.side === "s" ? [d.x, d.y + 1] : d.side === "w" ? [d.x - 1, d.y] : [d.x + 1, d.y];
    let best = network[0], bd = Infinity;
    for (const t of network) { const dist = Math.abs(t[0] - d.x) + Math.abs(t[1] - d.y); if (dist < bd) { bd = dist; best = t; } }
    const elbow: TilePt = d.side === "n" || d.side === "s" ? [d.x, best[1]] : [best[0], d.y];
    paths.push({ id: `p_door_${b.id}`, kind: "dirt", width: 1, points: simplify([out, elbow, best]) });
  }

  const junction: TilePt = [laneX, streetY];
  const connections = buildConnections(frame, junction);
  const blocked = new Uint8Array(w * h);
  for (const b of buildings) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) blocked[y * w + x] = 1;
  for (const c of connections) {
    const route = routeBFS(c.gatePt, junction, blocked, w, h);
    if (route) paths.push({ id: `p_gate_${c.id}`, kind: "dirt", width: 1.6, points: slim(route) });
  }

  // ---- fences / yards (rail fences with walk-through gates) ----
  const fences: DetailFence[] = ([
    { id: "f_a_front", x0: 6.5, y0: 8.6, x1: 13, y1: 8.6, kind: "rail" },
    { id: "f_a_side", x0: 13, y0: 6, x1: 13, y1: 8.6, kind: "rail" },
    { id: "f_c_front", x0: 7.5, y0: 13.6, x1: 12.8, y1: 13.6, kind: "rail" },
    { id: "f_wash_yard", x0: 1.4, y0: 13.6, x1: 6, y1: 13.6, kind: "rail" },
    { id: "f_d_yard", x0: 2, y0: 24.4, x1: 7.6, y1: 24.4, kind: "rail" },
    { id: "f_e_yard", x0: 8, y0: 24.4, x1: 13.6, y1: 24.4, kind: "rail" },
    { id: "f_garden_w", x0: 1.2, y0: 16.4, x1: 1.2, y1: 21, kind: "hedge" },
    { id: "f_garden_e", x0: 39.4, y0: 22.4, x1: 39.4, y1: 26, kind: "hedge" },
  ] as DetailFence[]).map((f) => ({ ...f, x0: Math.round(f.x0 * sx * 2) / 2, x1: Math.round(f.x1 * sx * 2) / 2, y0: Math.round(f.y0 * sy * 2) / 2, y1: Math.round(f.y1 * sy * 2) / 2 }));

  // ---- props (authored composition, seeded variants) ----
  const props: DetailProp[] = [];
  const P = (type: string, x: number, y: number, solid: boolean, extra: Partial<DetailProp> = {}) => {
    props.push({ id: `x_${type}_${props.length}`, type, x, y, solid, variant: Math.floor(hash2(props.length, seed, 3) * 4), ...extra });
  };
  const px = (v: number) => Math.round(v * sx * 2) / 2;
  const py = (v: number) => Math.round(v * sy * 2) / 2;

  // village square: well, notice board, signpost, lanterns, market stalls
  P("well", px(20), py(12.6), true, { interact: { kind: "well", text: "Giếng làng Greywater — múc nước sạch", key: "well" } });
  P("notice", px(15.6), py(12.4), true, { interact: { kind: "notice", text: "Bảng tin làng", key: "notice" } });
  P("signpost", px(24.6), py(12.6), true, { interact: { kind: "sign", text: "Ngã tư Greywater", key: "sign" } });
  P("bench", px(16.5), py(14.2), true, {});
  P("bench", px(24.2), py(14.2), true, {});
  P("stall", px(18.2), py(17.4), true, {});
  P("stall", px(23.4), py(17.4), true, {});
  P("lantern", px(16.4), py(11.2), true, { interact: { kind: "lantern", text: "Đèn lồng quảng trường", key: "lamp_plaza" } });
  P("lantern", px(25.2), py(11.4), true, {});
  P("lantern", px(16.4), py(18.2), true, {});
  P("lantern", px(25.2), py(18.4), true, {});
  P("barrel", px(18.6), py(13.4), true, {});
  P("crate", px(18.6), py(14.1), true, { interact: { kind: "crate", text: "Thùng hàng chợ", charges: 1, key: "crate_market" } });
  P("crate", px(23.2), py(13.6), true, {});
  P("bench", px(21.6), py(13.8), true, {});
  // street furniture along the main lane
  P("lantern", px(8.2), py(14.4), true, { interact: { kind: "lantern", text: "Đèn đường", key: "lamp_west" } });
  P("lantern", px(31.4), py(14.4), true, {});
  P("bench", px(12.4), py(14.2), true, {});
  P("barrel", px(29.2), py(14.4), true, {});
  P("cart", px(10.4), py(17.4), true, {});
  P("haystack", px(12.6), py(17.6), true, {});
  // hall forecourt (north-east)
  P("crate", px(30.2), py(9.4), true, { interact: { kind: "crate", text: "Thùng muối của nhà hội", charges: 1, key: "crate_hall" } });
  P("crate", px(31.2), py(9.4), true, {});
  P("barrel", px(29.4), py(8.8), true, {});
  P("bench", px(26.4), py(9.6), true, {});
  P("woodpile", px(35.4), py(9.2), true, {});
  // cottage A yard
  P("woodpile", px(7.4), py(8.2), true, {});
  P("laundry", px(9.4), py(7.6), false, {});
  P("bench", px(11.4), py(8.1), true, {});
  P("garden", px(12.2), py(8.0), false, {});
  P("crate", px(6.2), py(5.2), true, {});
  // washhouse + troughs
  P("trough", px(2.6), py(12.9), true, {});
  P("barrel", px(5.4), py(13.0), true, {});
  P("barrel", px(6.0), py(12.2), true, {});
  P("laundry", px(3.4), py(8.6), false, {});
  P("reeds", px(1.2), py(12.2), false, {});
  // cottage C / pump yard
  P("woodpile", px(12.6), py(13.0), true, {});
  P("crate", px(9.0), py(13.0), true, {});
  P("garden", px(10.4), py(13.2), false, {});
  P("garden", px(11.2), py(13.2), false, {});
  P("stump", px(15.6), py(8.6), true, {});
  P("lantern", px(17.2), py(13.8), true, {});
  // stable / east
  P("haystack", px(28.4), py(14.4), true, {});
  P("trough", px(32.6), py(14.4), true, {});
  P("haystack", px(39.2), py(13.4), true, {});
  P("cart", px(34.6), py(16.6), true, {});
  P("crate", px(37.2), py(16.8), true, {});
  // smithy yard
  P("anvil", px(25.2), py(20.4), true, {});
  P("barrel", px(25.4), py(21.4), true, {});
  P("woodpile", px(32.4), py(20.4), true, {});
  P("crate", px(32.2), py(21.6), true, { interact: { kind: "crate", text: "Thùng phôi sắt", charges: 1, key: "crate_smithy" } });
  P("lantern", px(25.6), py(17.4), true, {});
  // barn / east yard
  P("haystack", px(39.2), py(17.4), true, {});
  P("haystack", px(34.4), py(26.2), true, {});
  P("cart", px(30.4), py(24.4), true, {});
  P("crate", px(39.2), py(26.2), true, {});
  P("barrel", px(38.2), py(26.6), true, {});
  P("trough", px(32.2), py(26.4), true, {});
  // south courtyards + kitchen gardens
  P("woodpile", px(18.6), py(24.4), true, {});
  P("bench", px(3.2), py(24.2), true, {});
  P("garden", px(9.0), py(24.6), false, {});
  P("garden", px(10.0), py(24.6), false, {});
  P("garden", px(11.0), py(24.6), false, {});
  P("garden", px(12.0), py(24.6), false, {});
  P("garden", px(13.0), py(24.6), false, {});
  P("barrel", px(2.4), py(24.4), true, {});
  P("laundry", px(16.4), py(23.6), false, {});
  // outer edge detail
  P("stump", px(1.4), py(2.4), true, {});
  P("log", px(37.4), py(1.6), true, {});
  P("reeds", px(1.2), py(19.4), false, {});
  P("reeds", px(1.2), py(20.2), false, {});
  P("reeds", px(39.4), py(11.2), false, {});

  // ---- trees ----
  const reserved = new Uint8Array(w * h);
  const mark = (x0: number, y0: number, x1: number, y1: number, pad = 1) => {
    for (let y = Math.floor(y0 - pad); y <= Math.ceil(y1 + pad); y++) for (let x = Math.floor(x0 - pad); x <= Math.ceil(x1 + pad); x++) {
      if (x >= 0 && y >= 0 && x < w && y < h) reserved[y * w + x] = 1;
    }
  };
  for (const b of buildings) mark(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, 0);
  for (const p of paths) {
    if (p.kind === "plaza") { const xs = p.points.map((q) => q[0]), ys = p.points.map((q) => q[1]); mark(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 1); }
    else for (let i = 0; i < p.points.length - 1; i++) {
      const a = p.points[i], b2 = p.points[i + 1];
      const steps = Math.ceil(Math.max(Math.abs(b2[0] - a[0]), Math.abs(b2[1] - a[1])) * 2) + 1;
      for (let k = 0; k <= steps; k++) { const t = k / steps; mark(a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, Math.max(0.6, p.width / 2 - 0.35)); }
    }
  }
  for (const p of props) mark(p.x, p.y, p.x, p.y, 0);
  for (const f of fences) mark(Math.min(f.x0, f.x1), Math.min(f.y0, f.y1), Math.max(f.x0, f.x1), Math.max(f.y0, f.y1), 0.3);
  for (const b of buildings) mark(b.door.x, b.door.y, b.door.x, b.door.y, 0.6);

  const trees: DetailTree[] = [];
  const isForest = ctxBiome === 1 || ctxBiome === 2;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (reserved[y * w + x]) continue;
    if (!insideSite(frame, x + 0.5, y + 0.5, 0.6)) continue;
    const dCenter = Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2));
    const edge = Math.max(0, dCenter - 0.5) / 0.5; // 0 centre → 1 edge
    const hsh = hash2(x, y, seed);
    const chance = (isForest ? 0.12 : 0.07) + edge * (isForest ? 0.4 : 0.3);
    if (hsh > chance) continue;
    // no trees on water
    const wpt = localToWorld(frame, [x + 0.5, y + 0.5]);
    if (waterDepth(project, wpt) > 0) continue;
    const kind: DetailTree["kind"] = hsh < chance * 0.2 ? "bush" : (isForest ? (hsh > 0.7 ? "willow" : "oak") : (hsh > 0.78 ? "pine" : "oak"));
    trees.push({ id: `t_${x}_${y}`, kind, x: x + 0.2 + hash2(x, y, 5) * 0.6, y: y + 0.2 + hash2(x, y, 6) * 0.6, v: Math.floor(hash2(x, y, 7) * 100) });
  }
  // authored street trees / yard trees where the village needs shade
  const AT: [DetailTree["kind"], number, number][] = [
    ["oak", 6.2, 16.4], ["oak", 13.4, 16.6], ["willow", 3.2, 10.6], ["oak", 34.6, 8.6],
    ["willow", 38.4, 15.6], ["oak", 24.8, 6.4], ["oak", 5.4, 21.6], ["pine", 21.6, 3.2],
    ["bush", 16.6, 16.6], ["bush", 26.2, 16.4], ["oak", 36.4, 26.4], ["willow", 1.6, 24.6],
  ];
  for (let k = 0; k < AT.length; k++) {
    const [kind, ax, ay] = AT[k];
    const X = px(ax), Y = py(ay);
    if (X < 1 || Y < 1 || X > w - 2 || Y > h - 2) continue;
    if (reserved[Math.floor(Y) * w + Math.floor(X)]) continue;
    trees.push({ id: `ta_${k}`, kind, x: X, y: Y, v: Math.floor(hash2(k, 9, 3) * 100) });
  }

  // a wooded frame just outside the site boundary — the hamlet should sit *in*
  // the Greywater woods, not on a floating green rectangle
  for (let y = -SITE_MARGIN + 1; y < h + SITE_MARGIN - 1; y++) for (let x = -SITE_MARGIN + 1; x < w + SITE_MARGIN - 1; x++) {
    if (insideSite(frame, x + 0.5, y + 0.5, 1.5)) continue;
    if (x < -2 || y < -2 || x > w + 1 || y > h + 1) continue;
    const hsh = hash2(x, y, seed ^ 0x51ed);
    if (hsh > 0.46) continue;
    const wpt = localToWorld(frame, [x + 0.5, y + 0.5]);
    if (waterDepth(project, wpt) > 0) continue;
    const kind: DetailTree["kind"] = hsh < 0.1 ? "bush" : isForest ? (hsh > 0.62 ? "pine" : "oak") : (hsh > 0.7 ? "pine" : "oak");
    trees.push({ id: `tm_${x}_${y}`, kind, x: x + 0.15 + hash2(x, y, 8) * 0.7, y: y + 0.15 + hash2(x, y, 9) * 0.7, v: Math.floor(hash2(x, y, 10) * 100) });
  }

  // ---- interiors (furniture inside each footprint) ----
  for (const b of buildings) b.props = interiorFor(b, seed);

  const spawn: TilePt = [laneX + 0.6, h - 3.2];
  const summary = `${buildings.length} nhà · ${props.length} vật thể · ${trees.length} cây · ${connections.length} lối vào từ đường Map Studio`;

  return {
    seed, buildings, props, trees, paths, fences, connections, spawn, summary,
  };
}


function doorTile(x: number, y: number, w: number, h: number, side: DetailBuilding["door"]["side"]): DetailBuilding["door"] {
  switch (side) {
    case "n": return { x: x + (w >> 1), y, side };
    case "s": return { x: x + (w >> 1), y: y + h - 1, side };
    case "w": return { x, y: y + (h >> 1), side };
    default: return { x: x + w - 1, y: y + (h >> 1), side: "e" };
  }
}

function interiorFor(b: DetailBuilding, seed: number): DetailProp[] {
  const out: DetailProp[] = [];
  const r = mulberry32((seed ^ (b.x * 31 + b.y * 17 + b.w * 7 + b.h)) >>> 0);
  const free = new Set<string>();
  for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) free.add(`${x},${y}`);
  const put = (type: string, dx: number, dy: number, solid: boolean) => {
    for (let k = 0; k < 12; k++) {
      const x = b.x + Math.max(1, Math.min(b.w - 2, dx + (k > 3 ? (k % 3) - 1 : 0)));
      const y = b.y + Math.max(1, Math.min(b.h - 2, dy + (k > 6 ? (k % 2) : 0)));
      const key = `${x},${y}`;
      if (free.has(key)) {
        free.delete(key);
        out.push({ id: `${b.id}_${type}_${out.length}`, type, x, y, solid, variant: Math.floor(r() * 4) });
        return;
      }
    }
  };
  switch (b.kind) {
    case "hall":
      put("hearth", 2, 2, true); put("table", 5, 3, true); put("shelf", 7, 2, true);
      put("barrel", 8, 4, true); put("chest", 2, 4, true); put("stool", 4, 3, false); put("stool", 6, 2, false);
      break;
    case "smithy":
      put("forge", 2, 2, true); put("anvil_i", 4, 3, true); put("barrel", 1, 3, true); put("shelf", 3, 1, true);
      break;
    case "barn":
      put("hay", 2, 2, true); put("hay", 3, 3, true); put("sack", 1, 3, true); put("crate", 5, 2, true); put("crate", 5, 3, true);
      break;
    case "washhouse":
      put("tub", 2, 2, true); put("tub", 1, 2, true); put("shelf", 3, 1, true);
      break;
    case "shed":
      put("crate", 1, 1, true); put("woodpile_i", 2, 2, true); put("sack", 1, 2, true);
      break;
    default:
      put("bed", 1, 1, true); put("table", 3, 2, true); put("hearth", 1, 2, true); put("stool", 2, 2, false); put("chest", 3, 1, true);
      if (r() > 0.4) put("sack", 1, 3, false); if (r() > 0.6) put("pot", 1, 3, false);
  }
  return out;
}

/** >0 when the point is under water (river/lake), in Map Studio units. */
export function waterDepth(project: Project, p: Pt): number {
  let depth = 0;
  for (const r of project.rivers) {
    if (!r.points || r.points.length < 2) continue;
    const half = Math.max(0.6, (r.width || 1) / 2);
    let best = Infinity;
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i], b = r.points[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
    }
    if (best < half) depth = Math.max(depth, half - best);
  }
  for (const l of project.lakes) {
    if (pointInRing(p, l.ring)) depth = Math.max(depth, 1);
  }
  return depth;
}
function pointInRing(p: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 4-dir BFS around blocked tiles; returns tile path or null. */
function routeBFS(a: TilePt, b: TilePt, blocked: Uint8Array, w: number, h: number): TilePt[] | null {
  const sx = Math.max(0, Math.min(w - 1, Math.round(a[0]))), sy = Math.max(0, Math.min(h - 1, Math.round(a[1])));
  const gx = Math.max(0, Math.min(w - 1, Math.round(b[0]))), gy = Math.max(0, Math.min(h - 1, Math.round(b[1])));
  const prev = new Int32Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  const q: number[] = [sy * w + sx]; seen[sy * w + sx] = 1;
  for (let head = 0; head < q.length; head++) {
    const i = q[head];
    if (i === gy * w + gx) {
      const out: TilePt[] = [];
      for (let k = i; k !== -1; k = prev[k]) out.push([k % w, Math.floor(k / w)]);
      return out.reverse();
    }
    const x = i % w, y = Math.floor(i / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seen[j] || blocked[j]) continue;
      seen[j] = 1; prev[j] = i; q.push(j);
    }
  }
  return null;
}

function slim(pts: TilePt[]): TilePt[] {
  if (pts.length < 3) return pts;
  const out: TilePt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross !== 0) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function simplify(pts: TilePt[]): TilePt[] {
  const out: TilePt[] = [];
  for (const p of pts) { const l = out[out.length - 1]; if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 0.4) out.push([Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2]); }
  return out.length > 1 ? out : pts;
}

export { gateForAngle, frameAxes, SITE_MARGIN };
export type { DetailConnection };
