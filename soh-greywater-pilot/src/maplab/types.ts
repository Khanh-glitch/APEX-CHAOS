// Soul of Hero — Map Lab Studio: data model.
// World units are abstract "u". Real-world scale is NOT approved by Gameplay Tower (Bible §11.5: no invented km/minutes).
export type Pt = [number, number];
export type Conf = "fixed" | "proposal" | "assumption" | "unknown";
export const CONF_LABEL: Record<Conf, string> = {
  fixed: "Đã chốt (Bible)",
  proposal: "Đề xuất của Map Lab",
  assumption: "Giả định — chờ Gameplay Tower",
  unknown: "Chưa biết / cần đo",
};

export interface Base {
  id: string;
  name: string;
  notes?: string;
  conf?: Conf;
  group?: string;
  locked?: boolean;
  hidden?: boolean;
}
export interface Land extends Base { rings: Pt[][]; kind: "main" | "satellite" | "islet"; }
export interface Lake extends Base { ring: Pt[]; oasis?: boolean; }
export interface RiverFeat { at: Pt; kind: "waterfall" | "rapids" | "weir" | "lock"; }
export interface River extends Base {
  points: Pt[];
  width: number;
  kind: "river" | "canal" | "distributary";
  nav: number[]; // per control segment: 1 = small-boat navigable (boat type is an ASSUMPTION), 0 = not
  feats: RiverFeat[];
  mouth: { kind: "sea" | "lake" | "river" | "none"; ref?: string };
  source: { kind: "spring" | "lake" | "river"; ref?: string };
  fordable?: boolean;
  reason?: string;
}
export type RoadKind = "foot" | "trail" | "cart" | "riverside" | "ferry";
export interface Road extends Base { points: Pt[]; kind: RoadKind; alt?: boolean; purpose?: string; ford?: boolean; }
export interface Bridge extends Base { at: Pt; ang: number; load: "foot" | "cart"; }
export interface Dock extends Base { at: Pt; kind: "inland" | "coastal"; water: string; }
export interface Poi extends Base {
  at: Pt; arche: string; rot: number; scale: number;
  foot?: Pt[]; deep?: Pt[];
  depth: "surface" | "multi";
  role: string; opp: string; access: string;
  resources: string[];
  elder?: string;
  gate: "none" | "elder" | "key" | "power" | "hazard";
  retreat: Pt[];
  links: { to: string; kind: string }[];
}
export interface BuildZone extends Base { ring: Pt[]; soil: string; water: string; slope: string; tags: string[]; }
export interface Resource extends Base { at: Pt; kind: string; r: number; dens: number; gate?: "none" | "core" | "key" | "elder"; }
export interface Spawn extends Base { at: Pt; region: string; }
export interface ElderT extends Base { elder: string; outer: Pt[]; core: Pt[]; approach: Pt[]; arenas: Pt[][]; pois: string[]; ragnarok: string; }
export interface Label extends Base { at: Pt; text: string; size: number; rot: number; style: "region" | "water" | "place"; }

export interface Terrain { gw: number; gh: number; cell: number; elev: Uint8Array; biome: Uint8Array; seed: number; }
export interface Project {
  v: 1;
  /** Optional POI Detail Layer records keyed by stable POI id (v1 pilot: po_greywater only). */
  details?: Record<string, import("./detail/types").PoiDetail>;
  name: string;
  world: { w: number; h: number };
  meta: { created: string; modified: string; status: string; author: string };
  land: Land[]; lakes: Lake[]; rivers: River[]; roads: Road[]; bridges: Bridge[]; docks: Dock[];
  pois: Poi[]; zones: BuildZone[]; resources: Resource[]; spawns: Spawn[]; elders: ElderT[]; labels: Label[];
  terrain: Terrain;
  baseId: number;
}
export type CollKey = "land" | "lakes" | "rivers" | "roads" | "bridges" | "docks" | "pois" | "zones" | "resources" | "spawns" | "elders" | "labels";
export const COLLS: CollKey[] = ["land", "lakes", "rivers", "roads", "bridges", "docks", "pois", "zones", "resources", "spawns", "elders", "labels"];
export const COLL_NAME: Record<CollKey, string> = {
  land: "Đất liền / đảo", lakes: "Hồ", rivers: "Sông & kênh", roads: "Đường & tuyến", bridges: "Cầu", docks: "Bến",
  pois: "POI", zones: "Vùng xây nhà", resources: "Nguồn sống", spawns: "Điểm spawn", elders: "Lãnh thổ Elder", labels: "Nhãn",
};
export const COLL_PREFIX: Record<CollKey, string> = {
  land: "ld", lakes: "lk", rivers: "rv", roads: "rd", bridges: "br", docks: "dk", pois: "po", zones: "bz", resources: "rs", spawns: "sp", elders: "el", labels: "lb",
};

export const WORLD_W = 2000;
export const WORLD_H = 1400;
export const CELL = 8;
export const GW = WORLD_W / CELL;
export const GH = WORLD_H / CELL;

export interface BiomeDef { id: number; key: string; name: string; color: [number, number, number]; }
export const BIOMES: BiomeDef[] = [
  { id: 0, key: "meadow", name: "Bình nguyên / canh tác", color: [160, 184, 100] },
  { id: 1, key: "forest", name: "Rừng lá rộng", color: [92, 134, 74] },
  { id: 2, key: "ancient", name: "Rừng cổ (sống động)", color: [52, 116, 64] },
  { id: 3, key: "conifer", name: "Rừng thông / cao nguyên", color: [78, 114, 96] },
  { id: 4, key: "marsh", name: "Đầm lầy / cửa sông", color: [112, 136, 98] },
  { id: 5, key: "desert", name: "Sa mạc / cồn cát", color: [219, 190, 124] },
  { id: 6, key: "scrub", name: "Thảo nguyên khô", color: [190, 178, 112] },
  { id: 7, key: "rock", name: "Đá trần / núi", color: [146, 138, 128] },
  { id: 8, key: "snow", name: "Lạnh / tuyết", color: [234, 238, 242] },
  { id: 9, key: "volcanic", name: "Núi lửa / obsidian", color: [88, 72, 70] },
  { id: 10, key: "toxic", name: "Đất độc / lưu huỳnh", color: [172, 168, 76] },
  { id: 11, key: "beach", name: "Bãi cát ven biển", color: [226, 212, 164] },
];

export interface ResKind { id: string; name: string; color: string; basic: boolean; }
export const RES_KINDS: ResKind[] = [
  { id: "fresh_water", name: "Nước ngọt", color: "#3b9ad9", basic: true },
  { id: "food", name: "Thức ăn (hái/săn/trồng)", color: "#d9a13b", basic: true },
  { id: "fish", name: "Cá / hải sản", color: "#4cc3c9", basic: true },
  { id: "wood", name: "Gỗ", color: "#8a5a2b", basic: true },
  { id: "stone", name: "Đá", color: "#8d8d94", basic: true },
  { id: "ore", name: "Quặng", color: "#b0603a", basic: false },
  { id: "herbs", name: "Thảo dược", color: "#5cb85c", basic: false },
  { id: "clay", name: "Đất sét", color: "#c98a63", basic: false },
  { id: "salt", name: "Muối", color: "#e8e8f0", basic: false },
  { id: "sulfur", name: "Lưu huỳnh", color: "#e6d83a", basic: false },
  { id: "obsidian", name: "Obsidian", color: "#3a3040", basic: false },
  { id: "scrap", name: "Phế liệu / thùng", color: "#a0a0a0", basic: false },
];

export type ArcheCat = "civil" | "industry" | "water" | "research" | "ancient" | "danger" | "ragnarok" | "service";
export interface Arche {
  id: string; name: string; cat: ArcheCat; code: string; color: string; r: number;
  depth: "surface" | "multi"; gate: Poi["gate"]; res: string[]; role: string; opp: string; access: string;
}
export const CAT_COLOR: Record<ArcheCat, string> = {
  civil: "#e9d8a6", industry: "#d98e48", water: "#58b6e8", research: "#b79cf0", ancient: "#cfae7a", danger: "#e06a5c", ragnarok: "#ffd23f", service: "#9fd5a0",
};
export const ARCHES: Arche[] = [
  { id: "village", name: "Làng", cat: "civil", code: "L", color: CAT_COLOR.civil, r: 26, depth: "surface", gate: "none", res: ["food", "fresh_water"], role: "Cụm dân cư, kho nhỏ, trao đổi hàng", opp: "Loot ngoại vi nhà dân, thùng, điểm nghỉ", access: "Đường nhỏ + đường xe/bến" },
  { id: "hamlet", name: "Xóm nhỏ", cat: "civil", code: "x", color: CAT_COLOR.civil, r: 14, depth: "surface", gate: "none", res: ["food"], role: "Nhà lẻ gần nguồn nước/đường", opp: "Thùng, vườn bỏ hoang", access: "Đường mòn" },
  { id: "roadstop", name: "Trạm ven đường", cat: "service", code: "T", color: CAT_COLOR.service, r: 12, depth: "surface", gate: "none", res: ["scrap"], role: "Điểm dừng giữa tuyến; thùng phế liệu & dụng cụ", opp: "Spares, dụng cụ cơ bản (J02)", access: "Đường xe/đường nhỏ" },
  { id: "warehouse", name: "Kho hàng", cat: "industry", code: "K", color: CAT_COLOR.industry, r: 20, depth: "surface", gate: "none", res: ["scrap"], role: "Kho trung chuyển giữa mỏ/xưởng/bến", opp: "Hàng tồn, xe hàng (J14)", access: "Đường xe" },
  { id: "sawmill", name: "Xưởng cưa", cat: "industry", code: "G", color: CAT_COLOR.industry, r: 22, depth: "surface", gate: "none", res: ["wood"], role: "Chế biến gỗ, cần rừng + nước/đường", opp: "Ván, gỗ xẻ, máy cưa hỏng", access: "Đường xe + sông" },
  { id: "quarry", name: "Mỏ đá", cat: "industry", code: "Đ", color: CAT_COLOR.industry, r: 28, depth: "surface", gate: "none", res: ["stone"], role: "Khai thác đá khối", opp: "Đá, dụng cụ mỏ", access: "Đường xe tải hàng" },
  { id: "mine", name: "Mỏ quặng", cat: "industry", code: "Q", color: CAT_COLOR.industry, r: 26, depth: "multi", gate: "none", res: ["ore"], role: "Khai thác quặng, có hầm sâu (không boss)", opp: "Quặng, đồ bảo hộ", access: "Đường xe + đường hầm" },
  { id: "smelter", name: "Xưởng luyện", cat: "industry", code: "Lu", color: CAT_COLOR.industry, r: 24, depth: "surface", gate: "none", res: ["ore", "scrap"], role: "Luyện quặng, nhiên liệu lớn", opp: "Thỏi kim loại, nhiên liệu", access: "Đường xe + bến" },
  { id: "mill", name: "Cối xay", cat: "industry", code: "C", color: CAT_COLOR.industry, r: 16, depth: "surface", gate: "none", res: ["food"], role: "Xay ngũ cốc, dùng sức nước", opp: "Lương thực chế biến", access: "Đường + sông" },
  { id: "powerplant", name: "Nhà máy nước/điện", cat: "water", code: "Đi", color: CAT_COLOR.water, r: 22, depth: "multi", gate: "power", res: ["scrap"], role: "Phát điện từ thác/dòng chảy; cấp điện cho cơ sở sâu", opp: "Linh kiện điện, cổng điện (J08)", access: "Đường xe, gần dòng chảy" },
  { id: "port", name: "Cảng / bến lớn", cat: "water", code: "B", color: CAT_COLOR.water, r: 24, depth: "surface", gate: "none", res: ["fish", "scrap"], role: "Điểm nối đường thủy ↔ đường bộ ↔ đảo vệ tinh", opp: "Thùng cảng, tàu cá", access: "Đường xe + tuyến phà" },
  { id: "pier", name: "Bến nhỏ / nhà thuyền", cat: "water", code: "b", color: CAT_COLOR.water, r: 10, depth: "surface", gate: "none", res: ["fish"], role: "Điểm xuồng/thuyền nội địa", opp: "Xuồng, dụng cụ câu", access: "Đường mòn + thủy lộ" },
  { id: "filter", name: "Trạm lọc/thoát nước", cat: "water", code: "Lọ", color: CAT_COLOR.water, r: 16, depth: "surface", gate: "hazard", res: ["fresh_water", "scrap"], role: "Lọc/thoát nước vùng trũng", opp: "Linh kiện van, nước sạch", access: "Đường nhỏ" },
  { id: "research", name: "Công trình nghiên cứu", cat: "research", code: "N", color: CAT_COLOR.research, r: 24, depth: "multi", gate: "key", res: ["scrap"], role: "Phòng thí nghiệm nhiều tầng; ngoại vi hữu ích, lõi cần thẻ/điện", opp: "Mẫu nghiên cứu, thẻ (K4)", access: "Đường nhỏ + lối rút" },
  { id: "ruins", name: "Khu kiến trúc cổ", cat: "ancient", code: "Cổ", color: CAT_COLOR.ancient, r: 24, depth: "multi", gate: "none", res: ["stone", "scrap"], role: "Tàn tích, hầm ngầm", opp: "Di vật, vật liệu cổ", access: "Đường mòn" },
  { id: "facility", name: "Cơ sở nhiều tầng", cat: "danger", code: "F", color: CAT_COLOR.danger, r: 30, depth: "multi", gate: "key", res: ["scrap", "ore"], role: "Nhà máy/trại nhiều tầng có điều kiện tiếp cận, không boss", opp: "Chip, nguồn hiếm, linh kiện sâu", access: "Ngoại vi tự do; lõi cần thẻ + điện + bảo hộ" },
  { id: "observatory", name: "Đài quan sát / hải đăng", cat: "research", code: "Q", color: CAT_COLOR.research, r: 14, depth: "surface", gate: "none", res: ["scrap"], role: "Tầm nhìn xa, dự báo tại chỗ", opp: "Bản đồ, dụng cụ quang học", access: "Đường dốc" },
  { id: "tomb", name: "Lăng mộ / nghĩa địa", cat: "ancient", code: "M", color: CAT_COLOR.ancient, r: 22, depth: "multi", gate: "none", res: ["stone", "scrap"], role: "Hầm mộ, nghĩa địa cổ", opp: "Di vật, đồ tùy táng", access: "Đường mòn sa mạc" },
  { id: "elder_site", name: "Địa điểm Elder", cat: "danger", code: "E", color: "#ff7a7a", r: 34, depth: "multi", gate: "elder", res: [], role: "Không gian chiến đấu Elder (2 trạng thái)", opp: "Đá Vô cực — nhánh chinh phục tùy chọn", access: "Đường tiếp cận + đường rút" },
  { id: "gate", name: "Ngưỡng không gian (Atlas)", cat: "danger", code: "Ng", color: "#7fb2ff", r: 22, depth: "multi", gate: "elder", res: [], role: "Cổng bước vào cảnh không gian khác cùng thế giới; có đường quay lại", opp: "Cảnh không gian Atlas", access: "Phà + bến" },
  { id: "ragnarok_cache", name: "Rương tiền Ragnarok (không boss)", cat: "ragnarok", code: "$", color: CAT_COLOR.ragnarok, r: 14, depth: "surface", gate: "none", res: [], role: "Nguồn tiền vật lý hữu hạn cuối 72h (số lượng do Gameplay/A3 quyết)", opp: "Tiền Ragnarok (K3/K8)", access: "Đường bộ; không qua Elder" },
  { id: "chest_vendor", name: "Người bán Rương ký gửi [ĐỀ XUẤT]", cat: "ragnarok", code: "R", color: CAT_COLOR.ragnarok, r: 14, depth: "surface", gate: "none", res: [], role: "[ĐỀ XUẤT] nhận tiền vật lý chưa ký gửi để bán Rương (Bible §5.4); giá/stock chưa chốt", opp: "Mua Rương ký gửi", access: "Đường xe/đường nhỏ" },
  { id: "evac", name: "Điểm sơ tán vật lý", cat: "ragnarok", code: "S", color: "#a6ff9e", r: 16, depth: "surface", gate: "none", res: [], role: "Rời đảo bằng thân thể; chốt run (D068)", opp: "Sơ tán không cần boss", access: "Đường + bến" },
  { id: "grove", name: "Khoảng rừng / điểm hái", cat: "service", code: "H", color: CAT_COLOR.service, r: 16, depth: "surface", gate: "none", res: ["herbs", "food", "wood"], role: "Điểm thu hái trong rừng", opp: "Thảo dược, quả", access: "Đường rừng" },
  { id: "custom", name: "POI tùy chỉnh", cat: "service", code: "?", color: "#d0d0d0", r: 16, depth: "surface", gate: "none", res: [], role: "", opp: "", access: "" },
];
export const ARCHE_BY_ID: Record<string, Arche> = Object.fromEntries(ARCHES.map((a) => [a.id, a]));

export const ELDERS = [
  { id: "surtur", name: "Surtur", stone: "Reality", color: "#e0522f", theme: "Núi lửa, dung nham, obsidian" },
  { id: "typhon", name: "Typhon", stone: "Power", color: "#9a5ae0", theme: "Khối núi đá vỡ, khe vực, kết cấu bị nghiền" },
  { id: "aion", name: "Aion", stone: "Time", color: "#3fb35f", theme: "Khu rừng sống động được thời gian bảo vệ" },
  { id: "atlas", name: "Atlas", stone: "Space", color: "#4488ee", theme: "Ngưỡng không gian bên biển lớn" },
  { id: "argus", name: "Argus", stone: "Mind", color: "#e8c82e", theme: "Học viện, thư viện, đài quan sát, kho lưu trữ" },
  { id: "anubis", name: "Anubis", stone: "Soul", color: "#ee8f2e", theme: "Sa mạc, lăng mộ, nghĩa địa cổ, đoàn hồn" },
];

export type ToolId =
  | "select" | "pan" | "land_add" | "land_sub" | "land_poly" | "elev" | "biome"
  | "river" | "canal" | "lake" | "road" | "bridge" | "dock" | "poi" | "zone" | "elder" | "resource" | "spawn" | "housetest" | "label" | "measure" | "region";
export type ViewMode = "atlas" | "clean" | "hydro" | "transport" | "poi" | "elders" | "opp";
export type StatusKind = "PASS" | "WARNING" | "UNKNOWN" | "FAIL";

export function uid(prefix: string): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}
export function allObjects(p: Project): { coll: CollKey; obj: Base & Record<string, unknown> }[] {
  const out: { coll: CollKey; obj: Base & Record<string, unknown> }[] = [];
  for (const c of COLLS) for (const o of p[c] as unknown as (Base & Record<string, unknown>)[]) out.push({ coll: c, obj: o });
  return out;
}
export function findObj(p: Project, id: string): { coll: CollKey; obj: Base & Record<string, unknown> } | null {
  for (const c of COLLS) {
    const o = (p[c] as unknown as (Base & Record<string, unknown>)[]).find((x) => x.id === id);
    if (o) return { coll: c, obj: o };
  }
  return null;
}
export function collOf(id: string): CollKey | null {
  const pre = id.split("_")[0];
  for (const c of COLLS) if (COLL_PREFIX[c] === pre) return c;
  return null;
}
