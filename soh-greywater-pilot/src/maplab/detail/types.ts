// POI Detail Layer — data model (v1, backward compatible with .sohmap.json v1).
//
// A POI in Map Studio is a *site*, not a finished village. This module adds an
// optional, keyed-by-POI-ID detail record that expands one site into an
// editable settlement plan: buildings, roofs, doors, floors, lanes, yards,
// vegetation, props and interaction anchors.
//
// Only `po_greywater` (Greywater Hamlet) is generated in this pilot. Every
// other POI keeps the exact geometry it had before this layer existed.

export type DetailSide = "n" | "s" | "e" | "w";
export type WallKind = "wood" | "stone" | "brick";
export type RoofKind = "thatch" | "tile" | "tin" | "wood";
export type FloorKind = "wood" | "stone";
export type BuildingKind = "hall" | "cottage" | "barn" | "smithy" | "pumphouse" | "shed" | "washhouse" | "stable";
export type TreeKind = "oak" | "pine" | "willow" | "bush";
export type PathKind = "dirt" | "stone" | "plaza";

/** Local detail coordinates are in *tiles*. 1 tile = `unitsPerTile` Map Studio units. */
export type TilePt = [number, number];

export interface DetailInteract {
  kind: "well" | "crate" | "notice" | "sign" | "lantern" | "door" | "bench";
  /** Player-facing line. */
  text?: string;
  /** Remaining pickups for crates (finite, saved). */
  charges?: number;
  /** Stable id used by the save format for the "already used" bookkeeping. */
  key?: string;
}

export interface DetailBuilding {
  id: string;
  name: string;
  kind: BuildingKind;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  w: number;
  h: number;
  wall: WallKind;
  roof: RoofKind;
  floor: FloorKind;
  /** Door tile (world detail tile coords) + which wall it cuts. */
  door: { x: number; y: number; side: DetailSide };
  chimney?: boolean;
  /** Interior furniture/props (tile coords, inside the footprint). */
  props: DetailProp[];
  note?: string;
}

export interface DetailProp {
  id: string;
  type: string;
  /** Tile coordinates. Props are drawn with their base near (x, y). */
  x: number;
  y: number;
  solid: boolean;
  variant?: number;
  rot?: number;
  interact?: DetailInteract;
}

export interface DetailTree {
  id: string;
  kind: TreeKind;
  x: number;
  y: number;
  v: number;
}

export interface DetailPath {
  id: string;
  kind: PathKind;
  /** Width in tiles. */
  width: number;
  points: TilePt[];
}

export interface DetailFence {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  kind: "post" | "rail" | "hedge";
}

export interface DetailConnection {
  id: string;
  /** Map Studio road that physically meets this site (may be absent). */
  roadId?: string;
  roadName?: string;
  roadKind?: string;
  /** Cardinal gate on the site boundary. */
  gate: DetailSide;
  gatePt: TilePt;
  /** World-space anchor of the connecting road (Map Studio units). */
  anchor: [number, number];
  /** Direction (radians, world) the road leaves along. */
  angle: number;
  /** Local spur drawn from the gate into the surrounding margin. */
  spur: TilePt[];
}

/** Orientation of the detail grid inside Map Studio's world. */
export interface DetailFrame {
  w: number;
  h: number;
  rot: number;
  /** World position of local tile (0,0). */
  origin: [number, number];
  /** Map Studio units per detail tile. */
  unitsPerTile: number;
  /** Native pixels per tile for rendering. */
  tilePx: number;
  /** Foot polygon in local tile coordinates (site boundary). */
  footLocal: TilePt[];
  /** Foot polygon in world units (as authored in Map Studio). */
  footWorld: TilePt[];
  /** Sample of Map Studio geography under the site (documented, not gameplay authority). */
  context: SiteContextInfo;
}

export interface SiteContextInfo {
  biome: string;
  biomeName: string;
  nearestRiver?: { id: string; name: string; distance: number; width: number };
  nearestLake?: { id: string; name: string; distance: number };
  /** Roads that physically reach the site. */
  roadHits: { id: string; name: string; kind: string; distance: number; angle: number }[];
  /** Elevated Map Studio POI centre, for the "site inside the world" proof. */
  poiAt: [number, number];
}

/** Deterministic output of the generator for one seed + one site. */
export interface GeneratedLayout {
  seed: number;
  buildings: DetailBuilding[];
  props: DetailProp[];
  trees: DetailTree[];
  paths: DetailPath[];
  fences: DetailFence[];
  connections: DetailConnection[];
  spawn: TilePt;
  /** Extra flavour recorded in the plan inspector. */
  summary: string;
}

/**
 * Hand edits, applied *on top of* the generated layout. Regenerating with a new
 * seed keeps these overrides, which is what makes "regenerate" safe to use
 * inside a hand-tuned site.
 */
export interface LayoutOverrides {
  buildings: Record<string, Partial<Pick<DetailBuilding, "x" | "y" | "w" | "h" | "roof" | "wall" | "floor" | "name" | "door" | "kind">> & { removed?: boolean }>;
  props: Record<string, Partial<DetailProp> & { removed?: boolean }>;
  trees: Record<string, Partial<DetailTree> & { removed?: boolean }>;
  addedBuildings: DetailBuilding[];
  addedProps: DetailProp[];
  addedTrees: DetailTree[];
  spawn?: TilePt;
}

export const EMPTY_OVERRIDES = (): LayoutOverrides => ({ buildings: {}, props: {}, trees: {}, addedBuildings: [], addedProps: [], addedTrees: [] });

export function newDetail(poiId: string, poiName: string, frame: DetailFrame, generated: GeneratedLayout): PoiDetail {
  return {
    v: 1,
    poiId,
    poiName,
    seed: generated.seed,
    frame,
    generated,
    overrides: EMPTY_OVERRIDES(),
    locked: false,
    edited: false,
    hash: layoutHash(generated),
    notes: "",
  };
}

export interface PoiDetail {
  v: 1;
  poiId: string;
  poiName: string;
  seed: number;
  frame: DetailFrame;
  generated: GeneratedLayout;
  overrides: LayoutOverrides;
  /** Hand-tuned: blocks drag/resize/regenerate until unlocked. */
  locked: boolean;
  edited: boolean;
  /** Deterministic fingerprint of `generated` (not of hand edits). */
  hash: string;
  notes?: string;
  /** Optional saved walk/interaction state (created by play mode). */
  play?: { water: number; supplies: number; reads: number; lamps: number; used: Record<string, boolean>; lampsOn: Record<string, boolean> };
}

/** A resolved, render-ready plan (generated + overrides). */
export interface ResolvedPlan {
  seed: number;
  buildings: DetailBuilding[];
  props: DetailProp[];
  trees: DetailTree[];
  paths: DetailPath[];
  fences: DetailFence[];
  connections: DetailConnection[];
  spawn: TilePt;
  summary: string;
}

export function applyOverrides(g: GeneratedLayout, o: LayoutOverrides): ResolvedPlan {
  const patch = <T extends { id: string }>(list: T[], map: Record<string, Partial<T> & { removed?: boolean }>): T[] => {
    const out: T[] = [];
    for (const it of list) {
      const p = map[it.id];
      if (!p) { out.push(it); continue; }
      if (p.removed) continue;
      out.push({ ...it, ...p, id: it.id } as T);
    }
    return out;
  };
  const buildings = patch([...g.buildings, ...o.addedBuildings], o.buildings);
  const props = patch([...g.props, ...o.addedProps], o.props);
  const trees = patch([...g.trees, ...o.addedTrees], o.trees);
  return {
    seed: g.seed,
    buildings, props, trees,
    paths: g.paths, fences: g.fences, connections: g.connections,
    spawn: o.spawn ? [o.spawn[0], o.spawn[1]] : [g.spawn[0], g.spawn[1]],
    summary: g.summary,
  };
}

/** FNV-1a over a canonical JSON form: stable across runs/platforms. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") + "}";
}
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ((h >>> 0).toString(16) + "00000000").slice(0, 8);
}
export function layoutHash(g: GeneratedLayout): string {
  // Connections and trees are included: they depend on Map Studio geography.
  return fnv1a(stableStringify({ s: g.seed, b: g.buildings, p: g.props, t: g.trees, pa: g.paths, f: g.fences, c: g.connections, sp: g.spawn }));
}

export function overridesEmpty(o: LayoutOverrides): boolean {
  return Object.keys(o.buildings).length === 0 && Object.keys(o.props).length === 0 && Object.keys(o.trees).length === 0
    && o.addedBuildings.length === 0 && o.addedProps.length === 0 && o.addedTrees.length === 0 && !o.spawn;
}

export const BUILDING_LABEL: Record<BuildingKind, string> = {
  hall: "Nhà hội làng", cottage: "Nhà dân", barn: "Kho thóc / chuồng", smithy: "Lò rèn",
  pumphouse: "Nhà bơm", shed: "Chái kho", washhouse: "Nhà giặt / sên nước", stable: "Chuồng ngựa",
};
export const ROOF_LABEL: Record<RoofKind, string> = { thatch: "Mái rơm", tile: "Mái ngói", tin: "Mái tôn", wood: "Mái gỗ" };
export const WALL_LABEL: Record<WallKind, string> = { wood: "Vách gỗ", stone: "Tường đá", brick: "Tường gạch" };
export const TREE_LABEL: Record<TreeKind, string> = { oak: "Sồi", pine: "Thông", willow: "Liễu", bush: "Bụi rậm" };
