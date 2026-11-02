// POI Detail Layer — site frame and Map Studio geography sampling.
//
// The detail grid is built *from* the POI's authored footprint: the footprint
// is the site boundary. Nothing here mutates the project; it only reads
// geography so the village can respect rivers, lakes, roads and biome.

import { catmull, centroid, nearestOnLine, pip } from "../geom";
import { BIOMES } from "../types";
import type { Poi, Project, Pt } from "../types";
import { biomeAt } from "../terrain";
import type { DetailConnection, DetailFrame, SiteContextInfo, TilePt } from "./types";

export const TILE_PX = 16;      // native pixels per detail tile (same grammar as the prototype)
export const UNITS_PER_TILE = 1; // 1 detail tile = 1 Map Studio unit
export const SITE_MARGIN = 4;    // tiles of surrounding world drawn around the site

export interface FrameBuild {
  frame: DetailFrame;
  /** site dimensions in tiles */
  w: number;
  h: number;
}

/** Deterministically derive the detail grid from a POI's foot polygon. */
export function buildFrame(project: Project, poi: Poi): DetailFrame {
  const foot: Pt[] = (poi.foot && poi.foot.length >= 4)
    ? poi.foot
    : rectFoot(poi.at, poi.scale || 1, poi.rot || 0);
  const c = centroid(foot);
  // Long edge → local +x. Rotate with the POI so authoring stays predictable.
  let best = 0, bestLen = -1;
  for (let i = 0; i < foot.length; i++) {
    const a = foot[i], b = foot[(i + 1) % foot.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > bestLen) { bestLen = l; best = i; }
  }
  const a = foot[best], b = foot[(best + 1) % foot.length];
  let ux = (b[0] - a[0]) / (bestLen || 1), uy = (b[1] - a[1]) / (bestLen || 1);
  // Keep +x pointing east-ish so the detail view reads like a map.
  if (ux < 0) { ux = -ux; uy = -uy; }
  const vx = -uy, vy = ux;
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const q of foot) {
    const du = (q[0] - c[0]) * ux + (q[1] - c[1]) * uy;
    const dv = (q[0] - c[0]) * vx + (q[1] - c[1]) * vy;
    umin = Math.min(umin, du); umax = Math.max(umax, du);
    vmin = Math.min(vmin, dv); vmax = Math.max(vmax, dv);
  }
  const w = Math.max(16, Math.floor(umax - umin));
  const h = Math.max(12, Math.floor(vmax - vmin));
  const origin: Pt = [c[0] + ux * umin + vx * vmin, c[1] + uy * umin + vy * vmin];
  const rot = Math.atan2(uy, ux);
  const footLocal = foot.map((q) => {
    const du = (q[0] - c[0]) * ux + (q[1] - c[1]) * uy - umin;
    const dv = (q[0] - c[0]) * vx + (q[1] - c[1]) * vy - vmin;
    return [round2(du / UNITS_PER_TILE), round2(dv / UNITS_PER_TILE)] as TilePt;
  });
  const context = sampleContext(project, poi, w, h, origin, ux, uy, vx, vy);
  return {
    w, h, rot, origin: [round2(origin[0]), round2(origin[1])],
    unitsPerTile: UNITS_PER_TILE, tilePx: TILE_PX,
    footLocal, footWorld: foot.map((q) => [round2(q[0]), round2(q[1])] as TilePt),
    context,
  };
}

function rectFoot(at: Pt, scale: number, rot: number): Pt[] {
  const R = 26 * (scale || 1);
  const w = R * 0.8, h = R * 0.55;
  return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => [
    at[0] + x * Math.cos(rot) - y * Math.sin(rot),
    at[1] + x * Math.sin(rot) + y * Math.cos(rot),
  ] as Pt);
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export interface FrameAxes { ux: number; uy: number; vx: number; vy: number }
export function frameAxes(f: DetailFrame): FrameAxes {
  const ux = Math.cos(f.rot), uy = Math.sin(f.rot);
  return { ux, uy, vx: -uy, vy: ux };
}

export function localToWorld(f: DetailFrame, p: TilePt): Pt {
  const { ux, uy, vx, vy } = frameAxes(f);
  const s = f.unitsPerTile;
  return [f.origin[0] + (ux * p[0] + vx * p[1]) * s, f.origin[1] + (uy * p[0] + vy * p[1]) * s];
}
export function worldToLocal(f: DetailFrame, p: Pt): TilePt {
  const { ux, uy, vx, vy } = frameAxes(f);
  const dx = p[0] - f.origin[0], dy = p[1] - f.origin[1];
  return [(dx * ux + dy * uy) / f.unitsPerTile, (dx * vx + dy * vy) / f.unitsPerTile];
}

export function insideSite(f: DetailFrame, px: number, py: number, inset = 0): boolean {
  const p: TilePt = [px, py];
  if (f.footLocal.length < 3) return px >= inset && py >= inset && px <= f.w - inset && py <= f.h - inset;
  // fast reject in the axis-aligned local box, then exact polygon test
  if (px < -inset || py < -inset || px > f.w + inset || py > f.h + inset) return false;
  if (inset > 0) {
    const xs = f.footLocal.map((q) => q[0]), ys = f.footLocal.map((q) => q[1]);
    return px >= Math.min(...xs) + inset && px <= Math.max(...xs) - inset && py >= Math.min(...ys) + inset && py <= Math.max(...ys) - inset;
  }
  return pip(p, f.footLocal);
}

function sampleContext(project: Project, poi: Poi, w: number, h: number, origin: Pt, ux: number, uy: number, vx: number, vy: number): SiteContextInfo {
  const center = localToWorld({ origin, rot: Math.atan2(uy, ux), w, h, unitsPerTile: UNITS_PER_TILE, tilePx: TILE_PX, footLocal: [], footWorld: [], context: emptyCtx() }, [w / 2, h / 2]);
  const biome = biomeAt(project, center[0], center[1]);
  let river: SiteContextInfo["nearestRiver"];
  for (const r of project.rivers) {
    if (!r.points || r.points.length < 2) continue;
    const pts = catmull(r.points).pts;
    const d = nearestOnLine(pts, center).d - (r.width || 1) / 2;
    if (!river || d < river.distance) river = { id: r.id, name: r.name, distance: round2(d), width: r.width };
  }
  let lake: SiteContextInfo["nearestLake"];
  for (const l of project.lakes) {
    const d = nearestOnLine(l.ring, center, true).d;
    if (!lake || d < lake.distance) lake = { id: l.id, name: l.name, distance: round2(d) };
  }
  const roadHits: SiteContextInfo["roadHits"] = [];
  for (const r of project.roads) {
    if (!r.points || r.points.length < 2) continue;
    const pts = catmull(r.points).pts;
    const near = nearestOnLine(pts, center);
    const d = near.d;
    if (d > 48) continue;
    const ang = Math.atan2(near.pt[1] - center[1], near.pt[0] - center[0]);
    roadHits.push({ id: r.id, name: r.name, kind: r.kind, distance: round2(d), angle: ang });
  }
  roadHits.sort((a, b) => a.distance - b.distance);
  return {
    biome: BIOMES[biome]?.key || "meadow",
    biomeName: BIOMES[biome]?.name || "Bình nguyên",
    nearestRiver: river, nearestLake: lake,
    roadHits: roadHits.slice(0, 6),
    poiAt: [round2(poi.at[0]), round2(poi.at[1])],
  };
}
function emptyCtx(): SiteContextInfo {
  return { biome: "meadow", biomeName: "", roadHits: [], poiAt: [0, 0] };
}

/** Cardinal gate on the boundary for a world-space direction. */
export function gateForAngle(angle: number, w: number, h: number): { side: "n" | "s" | "e" | "w"; pt: TilePt } {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const cx = w / 2, cy = h / 2;
  const cands: { side: "n" | "s" | "e" | "w"; t: number; pt: TilePt }[] = [];
  if (dx > 1e-6) { const t = (w - cx) / dx; cands.push({ side: "e", t, pt: [w, cy + dy * t] }); }
  if (dx < -1e-6) { const t = -cx / dx; cands.push({ side: "w", t, pt: [0, cy + dy * t] }); }
  if (dy > 1e-6) { const t = (h - cy) / dy; cands.push({ side: "s", t, pt: [cx + dx * t, h] }); }
  if (dy < -1e-6) { const t = -cy / dy; cands.push({ side: "n", t, pt: [cx + dx * t, 0] }); }
  cands.sort((a, b) => a.t - b.t);
  const c = cands[0];
  const pt: TilePt = [clamp(c.pt[0], 2, w - 2), clamp(c.pt[1], 2, h - 2)];
  return { side: c.side, pt: [Math.round(pt[0]), Math.round(pt[1])] };
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Build road connections from the geography the site actually touches. */
export function buildConnections(f: DetailFrame, centerLocal: TilePt): DetailConnection[] {
  const out: DetailConnection[] = [];
  const seen: number[] = [];
  for (const hit of f.context.roadHits) {
    // local direction of the road, relative to the site frame
    const wx = Math.cos(hit.angle), wy = Math.sin(hit.angle);
    const { ux, uy, vx, vy } = frameAxes(f);
    const lx = wx * ux + wy * uy;
    const ly = wx * vx + wy * vy;
    const ang = Math.atan2(ly, lx);
    if (seen.some((a) => Math.abs(a - ang) < 0.42)) continue;
    seen.push(ang);
    const gate = gateForAngle(ang, f.w, f.h);
    const anchorWorld = localToWorld(f, gate.pt);
    const dir = [Math.cos(ang), Math.sin(ang)];
    const spur: TilePt[] = [
      centerLocal,
      gate.pt,
      [Math.round(gate.pt[0] + dir[0] * SITE_MARGIN), Math.round(gate.pt[1] + dir[1] * SITE_MARGIN)],
    ];
    out.push({
      id: "cx_" + hit.id,
      roadId: hit.id, roadName: hit.name, roadKind: hit.kind,
      gate: gate.side, gatePt: gate.pt,
      anchor: [round2(anchorWorld[0]), round2(anchorWorld[1])],
      angle: round2(ang),
      spur,
    });
  }
  return out;
}
