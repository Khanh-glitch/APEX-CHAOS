// POI Detail Layer — ground/collision raster shared by renderer, play mode and QA.

import { biomeAt } from "../terrain";
import { hash2 } from "../geom";
import type { Project } from "../types";
import { frameAxes, localToWorld, SITE_MARGIN } from "./frame";
import type { DetailFrame, ResolvedPlan, TilePt } from "./types";
import { waterDepth } from "./generate";

export type Ground = "grass" | "meadow" | "forest" | "marsh" | "sand" | "water" | "dirt" | "stone" | "plaza" | "floor_wood" | "floor_stone" | "wall" | "door";

export interface SiteGrid {
  x0: number; y0: number; W: number; H: number;
  base: Ground[];
  ground: Ground[];
  water: Uint8Array;
  pathMask: Uint8Array;
  /** static collision: walls, furniture, solid props, tree trunks, water */
  solid: Uint8Array;
  buildingId: (string | null)[];
  /** tile is inside a building footprint (for roof occlusion + interiors) */
  interior: Uint8Array;
}

const waterCache = new WeakMap<object, Uint8Array>();
function waterMask(project: Project, frame: DetailFrame, x0: number, y0: number, W: number, H: number): Uint8Array {
  const hit = waterCache.get(frame);
  if (hit && hit.length === W * H) return hit;
  const out = new Uint8Array(W * H);
  for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) {
    const p = localToWorld(frame, [x + 0.5, y + 0.5]);
    if (waterDepth(project, p) > 0) out[(y - y0) * W + (x - x0)] = 1;
  }
  waterCache.set(frame, out);
  return out;
}

export function makeGrid(project: Project, frame: DetailFrame, plan: ResolvedPlan): SiteGrid {
  const x0 = -SITE_MARGIN, y0 = -SITE_MARGIN;
  const W = frame.w + SITE_MARGIN * 2, H = frame.h + SITE_MARGIN * 2;
  const N = W * H;
  const base: Ground[] = new Array(N).fill("grass");
  const ground: Ground[] = new Array(N).fill("grass");
  const water = new Uint8Array(N);
  const pathMask = new Uint8Array(N);
  const solid = new Uint8Array(N);
  const buildingId: (string | null)[] = new Array(N).fill(null);
  const interior = new Uint8Array(N);
  const idx = (x: number, y: number) => (y - y0) * W + (x - x0);
  const inb = (x: number, y: number) => x >= x0 && y >= y0 && x < x0 + W && y < y0 + H;
  const waterM = waterMask(project, frame, x0, y0, W, H);

  // ---- geography under the site (read-only) ----
  const biome = biomeAt(project, ...localToWorld(frame, [frame.w / 2, frame.h / 2]));
  const defaultGround: Ground = biome === 2 ? "forest" : biome === 1 ? "forest" : biome === 4 ? "marsh" : biome === 0 ? "meadow" : biome === 11 ? "sand" : "grass";
  for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) {
    const p = localToWorld(frame, [x + 0.5, y + 0.5]);
    const i = idx(x, y);
    if (waterM[i]) { water[i] = 1; base[i] = "water"; }
    else {
      // dither the biome lookup at tile scale so Map Studio's 8u cells do not
      // show up as hard rectangles inside the site
      let bx = p[0], by = p[1];
      if (hash2(x, y, 71) < 0.34) { bx += (hash2(x, y, 72) - 0.5) * 9; by += (hash2(x, y, 73) - 0.5) * 9; }
      const b = biomeAt(project, bx, by);
      base[i] = b === 4 ? "marsh" : b === 11 ? "sand" : b === 2 ? "forest" : b === 1 ? "forest" : b === 0 ? "meadow" : defaultGround;
    }
    ground[i] = base[i];
  }

  // ---- paths ----
  const stampPath = (x: number, y: number, kind: Ground) => {
    if (!inb(x, y)) return;
    const i = idx(x, y);
    if (water[i]) return;
    pathMask[i] = 1;
    ground[i] = kind;
  };
  for (const p of plan.paths) {
    const gk: Ground = p.kind === "plaza" ? "plaza" : p.kind === "stone" ? "stone" : "dirt";
    if (p.kind === "plaza") {
      const xs = p.points.map((q) => q[0]), ys = p.points.map((q) => q[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) stampPath(x, y, gk);
      continue;
    }
    const half = Math.max(0.5, p.width / 2);
    for (let i = 0; i < p.points.length - 1; i++) {
      const a = p.points[i], b = p.points[i + 1];
      const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 3) + 1;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t;
        const r = Math.ceil(half);
        for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
          const tx = Math.floor(cx) + dx, ty = Math.floor(cy) + dy;
          // ragged, hand-worn edge: per-tile jitter instead of a clean circle
          const jitter = (hash2(tx, ty, 17) - 0.5) * 1.05;
          if (Math.hypot(dx + 0.5, dy + 0.5) <= half + 0.25 + jitter) stampPath(tx, ty, gk);
        }
      }
    }
  }

  // ---- buildings ----
  for (const b of plan.buildings) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      if (!inb(x, y)) continue;
      const i = idx(x, y);
      const edge = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1;
      const isDoor = x === b.door.x && y === b.door.y;
      buildingId[i] = b.id;
      interior[i] = 1;
      pathMask[i] = 0;
      if (isDoor) { ground[i] = "door"; solid[i] = 0; }
      else if (edge) { ground[i] = "wall"; solid[i] = 1; }
      else { ground[i] = b.floor === "stone" ? "floor_stone" : "floor_wood"; solid[i] = 0; }
    }
    for (const p of b.props) {
      if (p.solid && inb(p.x, p.y)) solid[idx(p.x, p.y)] = 1;
    }
  }

  // ---- exterior props + tree trunks ----
  for (const p of plan.props) {
    if (p.solid && inb(Math.floor(p.x), Math.floor(p.y))) solid[idx(Math.floor(p.x), Math.floor(p.y))] = 1;
  }
  for (const t of plan.trees) {
    if (!inb(Math.floor(t.x), Math.floor(t.y))) continue;
    if (t.kind === "bush") continue;
    solid[idx(Math.floor(t.x), Math.floor(t.y))] = 1;
  }
  // fences block their line, leaving a walk-through gate every 6 posts
  for (const f of plan.fences) {
    const n = Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0));
    for (let k = 0; k <= n; k++) {
      if (k % 6 === 3) continue;
      const t = n ? k / n : 0;
      const x = Math.round(f.x0 + (f.x1 - f.x0) * t), y = Math.round(f.y0 + (f.y1 - f.y0) * t);
      if (inb(x, y)) solid[idx(x, y)] = 1;
    }
  }

  return { x0, y0, W, H, base, ground, water, pathMask, solid, buildingId, interior };
}

export function gridIndex(g: SiteGrid, x: number, y: number): number {
  const gx = Math.floor(x) - g.x0, gy = Math.floor(y) - g.y0;
  if (gx < 0 || gy < 0 || gx >= g.W || gy >= g.H) return -1;
  return gy * g.W + gx;
}
export function groundAt(g: SiteGrid, x: number, y: number): Ground {
  const i = gridIndex(g, x, y);
  return i < 0 ? "grass" : g.ground[i];
}
export function solidAt(g: SiteGrid, x: number, y: number): boolean {
  const i = gridIndex(g, x, y);
  return i < 0 ? true : !!g.solid[i];
}
export function buildingAt(g: SiteGrid, x: number, y: number): string | null {
  const i = gridIndex(g, x, y);
  return i < 0 ? null : g.buildingId[i];
}
export function insideInterior(g: SiteGrid, x: number, y: number): boolean {
  const i = gridIndex(g, x, y);
  return i < 0 ? false : !!g.interior[i];
}

/** Tile coordinate → pixel rect inside the detail canvas (margin included). */
export function tilePx(frame: DetailFrame, x: number, y: number): TilePt {
  return [(x - -SITE_MARGIN) * frame.tilePx, (y - -SITE_MARGIN) * frame.tilePx];
}

export function canvasSize(frame: DetailFrame): { w: number; h: number } {
  return { w: (frame.w + SITE_MARGIN * 2) * frame.tilePx, h: (frame.h + SITE_MARGIN * 2) * frame.tilePx };
}

export { SITE_MARGIN, frameAxes };
