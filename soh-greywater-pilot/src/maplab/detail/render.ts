// POI Detail Layer — village renderer.
//
// Rendering grammar follows the original prototype's `render.ts`:
//   • cached terrain texels with palette variation (no gradients in the world layer)
//   • buildings as a baked wall ring + a tiled roof drawn *above* actors
//   • roof alpha collapse when the player is inside (prototype roof occlusion)
//   • 1px shadow masks under trees/props, depth sorting by feet
// The site's own geography (biome tint, margins, road exits) comes from Map Studio.

import { hash2 } from "../geom";
import { canvasSize, SITE_MARGIN, type SiteGrid } from "./grid";
import { getVillageArt } from "./sprites";
import { PAL, shadowSprite, texel, type PalKey, type Sprite } from "./proto-art";
import type { DetailBuilding, DetailFrame, DetailSide, ResolvedPlan } from "./types";

export interface RenderActor { x: number; y: number; dir: 0 | 1 | 2 | 3; moving: boolean; anim: number }
export interface Selection { kind: "building" | "prop" | "tree"; id: string }

export interface RenderOpts {
  plan: ResolvedPlan;
  grid: SiteGrid;
  frame: DetailFrame;
  time: number;
  actor?: RenderActor;
  selection?: Selection | null;
  hover?: Selection | null;
  edit: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  seed: number;
  hideRoofs?: boolean;
  particles?: { x: number; y: number; col: string; life: number; max: number }[];
}

const groundCache = new WeakMap<SiteGrid, { key: string; canvas: HTMLCanvasElement }>();

function keyOf(o: RenderOpts) {
  return `${o.seed}:${o.plan.buildings.length}:${o.frame.w}x${o.frame.h}:${o.grid.ground.join("").length}:${fnv(o.grid.ground.join(""))}`;
}
function fnv(s: string) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }

export function villageCanvas(frame: DetailFrame): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const s = canvasSize(frame);
  c.width = s.w; c.height = s.h;
  return c;
}

/** Draw one full frame into `cv`. `scale` is an integer device-pixel multiplier. */
export function renderVillage(cv: HTMLCanvasElement, o: RenderOpts, scale = 1) {
  const { frame, plan, grid } = o;
  const size = canvasSize(frame);
  const g = cv.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  g.save();
  g.scale(scale, scale);

  const ground = getGround(o);
  g.drawImage(ground, 0, 0);

  const T = frame.tilePx;
  const px = (x: number) => (x + SITE_MARGIN) * T;
  const art = getVillageArt();

  // ---- ambient water sparkle ----
  for (let gy = 0; gy < grid.H; gy++) for (let gx = 0; gx < grid.W; gx++) {
    const i = gy * grid.W + gx;
    if (!grid.water[i]) continue;
    const X = gx * T, Y = gy * T;
    const ph = Math.floor(o.time / 420);
    for (let k = 0; k < 2; k++) {
      const hx = hash2(gx * 3 + k, gy, ph), hy = hash2(gx, gy * 3 + k, ph + 1);
      if (hash2(gx, gy, ph + k) > 0.55) { g.fillStyle = "rgba(220,240,255,0.65)"; g.fillRect(X + ((hx * 14) | 0), Y + ((hy * 15) | 0), 2, 1); }
    }
  }

  // ---- static shadows (buildings) ----
  g.fillStyle = "rgba(12,10,26,0.20)";
  for (const b of plan.buildings) {
    g.fillRect(px(b.x) + 4, px(b.y) + 6, b.w * T, b.h * T);
    g.fillStyle = "rgba(12,10,26,0.14)";
    g.fillRect(px(b.x) + 8, px(b.y) + 9, b.w * T, b.h * T);
    g.fillStyle = "rgba(12,10,26,0.20)";
  }

  // ---- path shoulder shading: thin dark edge where a lane meets grass ----
  for (let gy = 0; gy < grid.H; gy++) for (let gx = 0; gx < grid.W; gx++) {
    const i = gy * grid.W + gx;
    const gr = grid.ground[i];
    if (gr !== "dirt" && gr !== "plaza" && gr !== "stone") continue;
    const X = gx * T, Y = gy * T;
    const nb: [number, number, number, number][] = [[gx, gy - 1, 0, 0], [gx, gy + 1, 0, 15], [gx - 1, gy, 0, 0], [gx + 1, gy, 15, 0]];
    g.fillStyle = "rgba(40,30,20,0.20)";
    for (const [nx, ny, ox, oy] of nb) {
      if (nx < 0 || ny < 0 || nx >= grid.W || ny >= grid.H) continue;
      const n = grid.ground[ny * grid.W + nx];
      if (n === "dirt" || n === "plaza" || n === "stone" || n === "floor_wood" || n === "floor_stone" || n === "wall" || n === "door") continue;
      if (ox === 0 && oy === 0) g.fillRect(X, Y, 16, 1);
      else if (oy === 15) g.fillRect(X, Y + 15, 16, 1);
      else if (ox === 15) g.fillRect(X + 15, Y, 1, 16);
      else g.fillRect(X, Y, 1, 16);
    }
  }

  // ---- y-sorted world ----
  type D = { y: number; f: () => void };
  const list: D[] = [];

  // exterior props
  for (const p of plan.props) {
    const spr = art.prop[p.type]?.[(p.variant || 0) % (art.prop[p.type]?.length || 1)];
    if (!spr) continue;
    const bob = p.type === "lantern" ? 0 : 0;
    list.push({ y: p.y * T + T + bob, f: () => {
      if (p.type !== "garden" && p.type !== "reeds" && p.type !== "laundry") {
        const sh = shadowSprite(Math.max(3, Math.round(spr.width / 3)));
        g.drawImage(sh, Math.round(px(p.x) + T / 2 - sh.width / 2), Math.round(px(p.y) + T - 2 - sh.height / 2));
      }
      g.drawImage(spr, Math.round(px(p.x) + T / 2 - spr.width / 2), Math.round(px(p.y) + T - spr.height + 1));
    }});
  }

  // interior furniture
  for (const b of plan.buildings) for (const p of b.props) {
    const spr = art.prop[p.type]?.[(p.variant || 0) % (art.prop[p.type]?.length || 1)];
    if (!spr) continue;
    list.push({ y: (p.y + 1) * T, f: () => {
      g.drawImage(spr, Math.round(px(p.x) + T / 2 - spr.width / 2), Math.round(px(p.y) + T - spr.height + 1));
    }});
  }

  // trees
  for (const t of plan.trees) {
    const arr = art.tree[t.kind] || art.tree.oak;
    const spr = arr[t.v % arr.length];
    const sway = t.kind === "bush" ? 0 : Math.round(Math.sin(o.time / 900 + t.x * 0.7 + t.y * 0.3) * 0.6);
    list.push({ y: t.y * T + T, f: () => {
      const sh = shadowSprite(Math.max(4, Math.round(spr.width / 3)));
      g.drawImage(sh, Math.round(px(t.x) + T / 2 - sh.width / 2), Math.round(px(t.y) + T - 3 - sh.height / 2));
      g.drawImage(spr, Math.round(px(t.x) + T / 2 - spr.width / 2) + sway, Math.round(px(t.y) + T - spr.height + 1));
    }});
  }

  // fences
  for (const f of plan.fences) {
    const n = Math.max(1, Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = f.x0 + (f.x1 - f.x0) * t, y = f.y0 + (f.y1 - f.y0) * t;
      list.push({ y: y * T + T, f: () => {
        const X = px(x), Y = py(o.frame, y);
        if (f.kind === "hedge") {
          g.fillStyle = "#2e5a26"; g.fillRect(X + 1, Y + 6, 15, 8);
          g.fillStyle = "#3f7a32"; g.fillRect(X + 2, Y + 4, 13, 6);
          g.fillStyle = "#6aa84a"; g.fillRect(X + 4, Y + 5, 3, 2); g.fillRect(X + 10, Y + 7, 3, 2);
        } else {
          g.fillStyle = "#5a3a22"; g.fillRect(X + 7, Y + 6, 2, 9);
          g.fillStyle = "#7a5232"; g.fillRect(X + 7, Y + 6, 1, 9);
          if (k % 3 !== 1) { g.fillStyle = "#8a5a32"; g.fillRect(X + 1, Y + 8, 14, 2); g.fillStyle = "#a8763f"; g.fillRect(X + 1, Y + 8, 14, 1); }
          if (k % 3 === 0) { g.fillStyle = "#4a2e1a"; g.fillRect(X + 6, Y + 5, 4, 2); }
        }
      }});
    }
  }

  // connections: gravel spurs leaving the site (drawn under the boundary)
  g.fillStyle = "rgba(120,95,62,0.55)";
  for (const c of plan.connections) {
    for (let i = 0; i < c.spur.length - 1; i++) {
      const a = c.spur[i], b = c.spur[i + 1];
      const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4) + 1;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        if (t < 0.18) continue;
        g.fillRect(Math.round(px(a[0] + (b[0] - a[0]) * t)), Math.round(px(a[1] + (b[1] - a[1]) * t)), 3, 3);
      }
    }
  }

  // actor
  if (o.actor) {
    const a = o.actor;
    list.push({ y: a.y * T + T, f: () => {
      const set = getHero();
      const spr = a.moving ? set["walk" + a.dir][Math.floor(a.anim) % 4] : set["idle" + a.dir][Math.floor(a.anim) % 2];
      const X = px(a.x), Y = py(o.frame, a.y);
      const sh = shadowSprite(5);
      g.drawImage(sh, Math.round(X + T / 2 - sh.width / 2), Math.round(Y + T - 4 - sh.height / 2));
      g.drawImage(spr, Math.round(X + T / 2 - 8), Math.round(Y + T - spr.height + 1));
    }});
  }

  // roofs (above actors) — prototype roof occlusion: fade when the player is inside
  if (!o.hideRoofs) {
    for (const b of plan.buildings) {
      const inside = o.actor ? o.actor.x >= b.x && o.actor.x < b.x + b.w && o.actor.y >= b.y && o.actor.y < b.y + b.h : false;
      list.push({ y: (b.y + b.h) * T + 2, f: () => drawBuilding(g, o, b, inside) });
    }
  }

  list.sort((p, q) => p.y - q.y);
  for (const d of list) d.f();

  // smoke from chimneys (above roofs)
  for (const b of plan.buildings) {
    if (!b.chimney) continue;
    const X = px(b.x + b.w - 2) + 4, Y = px(b.y) - 12;
    for (let k = 0; k < 4; k++) {
      const t = (o.time / 1400 + k / 4 + b.x * 0.13) % 1;
      const a = (1 - t) * 0.35;
      g.fillStyle = `rgba(220,220,228,${a})`;
      g.fillRect(Math.round(X + Math.sin(t * 6 + b.y) * 3), Math.round(Y - t * 22), t > 0.6 ? 2 : 1, t > 0.6 ? 2 : 1);
    }
  }

  // lantern glow (pixel dither, no smooth gradients)
  for (const p of plan.props) {
    if (p.type !== "lantern") continue;
    const cx = px(p.x) + T / 2, cy = px(p.y) + 4;
    for (let r = 4; r <= 12; r += 2) {
      const dots = Math.floor(r * 2.2);
      for (let k = 0; k < dots; k++) {
        const a = (k / dots) * Math.PI * 2;
        const jitter = hash2(p.x, p.y, Math.floor(o.time / 220) + r);
        if (jitter < 0.35) continue;
        g.fillStyle = `rgba(255,190,90,${0.16 - r * 0.008})`;
        g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
      }
    }
  }

  // interaction particles (sparks, water droplets) — 1px pixels, no gradients
  if (o.particles && o.particles.length) {
    for (const p of o.particles) {
      const a = 1 - p.life / p.max;
      if (a <= 0) continue;
      g.globalAlpha = Math.max(0, Math.min(1, a));
      g.fillStyle = p.col;
      g.fillRect(Math.round(px(p.x)), Math.round(py(o.frame, p.y)), 2, 2);
    }
    g.globalAlpha = 1;
  }

  // site boundary, edit mode only
  if (o.edit) {
    g.save();
    g.strokeStyle = "rgba(255,236,180,0.45)"; g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath();
    frame.footLocal.forEach((q, i) => { const X = px(q[0]), Y = px(q[1]); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.closePath(); g.stroke();
    g.restore();
  }

  // selection highlight
  if (o.selection) drawSelection(g, o, o.selection, "#ffd24a");
  if (o.hover && (!o.selection || o.hover.id !== o.selection.id)) drawSelection(g, o, o.hover, "rgba(255,255,255,0.55)");

  // labels
  if (o.showLabels) {
    g.font = "8px monospace"; g.textAlign = "center";
    for (const b of plan.buildings) {
      const X = px(b.x) + b.w * T / 2, Y = px(b.y) - 13;
      g.fillStyle = "rgba(10,10,20,0.55)"; g.fillRect(X - b.name.length * 2.4 - 2, Y - 8, b.name.length * 4.8 + 4, 9);
      g.fillStyle = "#ffeccc"; g.fillText(b.name, X, Y);
    }
  }

  // grid
  if (o.showGrid) {
    g.strokeStyle = "rgba(255,255,255,0.07)"; g.lineWidth = 1;
    for (let x = 0; x <= frame.w; x++) { g.beginPath(); g.moveTo(px(x) + 0.5, px(0)); g.lineTo(px(x) + 0.5, px(frame.h)); g.stroke(); }
    for (let y = 0; y <= frame.h; y++) { g.beginPath(); g.moveTo(px(0), px(y) + 0.5); g.lineTo(px(frame.w), px(y) + 0.5); g.stroke(); }
  }

  // subtle vignette + warm sunlight (kept under 8% so palette stays readable)
  const vg = g.createRadialGradient(size.w / 2, size.h / 2, Math.min(size.w, size.h) * 0.35, size.w / 2, size.h / 2, Math.max(size.w, size.h) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(8,12,24,0.20)");
  g.fillStyle = vg; g.fillRect(0, 0, size.w, size.h);
  g.restore();
}

let HERO: Record<string, Sprite[]> | null = null;
function getHero() { return HERO || (HERO = getVillageArt().hero); }

function py(f: DetailFrame, y: number) { return (y + SITE_MARGIN) * f.tilePx; }

function drawBuilding(g: CanvasRenderingContext2D, o: RenderOpts, b: DetailBuilding, inside: boolean) {
  const art = getVillageArt();
  const T = o.frame.tilePx;
  const px = (x: number) => (x + SITE_MARGIN) * T;
  const x0 = px(b.x), x1 = px(b.x + b.w);
  const yTop = px(b.y), yBot = px(b.y + b.h);
  const faceH = Math.round(Math.min(34, Math.max(20, T * 1.6)));
  const eaveY = yBot - faceH;
  const roofTop = yTop - 10;
  const wallSpr = art.wall[b.wall] || art.wall.wood;
  const w0 = x0, w1 = x1;

  // ---- facade: real wall face under the eave, so the house reads as a box ----
  g.save();
  g.fillStyle = b.wall === "stone" ? "#6e6e76" : b.wall === "brick" ? "#8a4634" : "#6a4626";
  g.fillRect(w0, eaveY, w1 - w0, faceH);
  for (let x = w0; x < w1; x += T) {
    const cw = Math.min(T, w1 - x);
    g.drawImage(wallSpr, 0, 11, Math.max(1, Math.round((cw / T) * 16)), 13, x, eaveY, cw, faceH);
  }
  // eave shadow falls on the top of the facade
  g.fillStyle = "rgba(14,8,10,0.45)"; g.fillRect(w0, eaveY, w1 - w0, 1);
  g.fillStyle = "rgba(14,8,10,0.26)"; g.fillRect(w0, eaveY + 1, w1 - w0, 2);
  // base plinth + ground contact shadow
  g.fillStyle = "rgba(26,18,14,0.55)"; g.fillRect(w0, eaveY + faceH - 2, w1 - w0, 2);
  g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(w0 + 1, eaveY + faceH, w1 - w0 - 2, 2);
  // corner posts give the box a little volume
  g.fillStyle = "rgba(30,18,12,0.35)"; g.fillRect(w0, eaveY, 2, faceH);
  g.fillStyle = "rgba(30,18,12,0.5)"; g.fillRect(w1 - 2, eaveY, 2, faceH);

  // door: a framed leaf cut into the south wall (readable at 1×)
  if (b.door.side === "s") {
    const dw = 12, dh = Math.max(14, Math.min(24, faceH - 3));
    const dx = px(b.door.x) + 2, dy = yBot - dh - 2;
    g.fillStyle = "#241610"; g.fillRect(dx - 1, dy - 1, dw + 2, dh + 2);          // frame
    g.fillStyle = "#8a5a32"; g.fillRect(dx, dy, dw, dh);                            // leaf
    for (let x = dx + 2; x < dx + dw - 1; x += 3) { g.fillStyle = "#6e4626"; g.fillRect(x, dy + 1, 1, dh - 2); }
    g.fillStyle = "#a8763f"; g.fillRect(dx + 1, dy + 1, dw - 2, 1);
    g.fillStyle = "#5a3a22"; g.fillRect(dx, dy + Math.round(dh * 0.5), dw, 1);
    g.fillStyle = "#e0c060"; g.fillRect(dx + dw - 3, dy + Math.round(dh * 0.62), 1, 2); // handle
    g.fillStyle = "#4a2e1a"; g.fillRect(dx - 2, dy - 3, dw + 4, 2);                 // lintel
    g.fillStyle = "#8a867e"; g.fillRect(dx - 2, yBot - 2, dw + 4, 2);                // threshold
    g.fillStyle = "#b8b4ac"; g.fillRect(dx - 2, yBot - 2, dw + 4, 1);
    g.fillStyle = "rgba(255,205,120,0.10)"; g.fillRect(dx, yBot - 3, dw, 1);
  }
  // windows: warm panes with frame, shutters and a sill
  for (let wx = b.x + 1; wx < b.x + b.w - 1; wx++) {
    if (Math.abs(wx - b.door.x) < 2) continue;
    if ((wx + b.y) % 3 !== 0) continue;
    const X = px(wx) + 3, Y = eaveY + Math.round(faceH * 0.28);
    g.fillStyle = "#3a2a1e"; g.fillRect(X - 1, Y - 1, 12, 11);
    g.fillStyle = (wx * 7 + b.y) % 5 === 0 ? "#8a7c58" : "#ffcf6a"; g.fillRect(X, Y, 10, 9);
    g.fillStyle = "#1e1a22"; g.fillRect(X + 4, Y, 2, 9); g.fillRect(X, Y + 4, 10, 1);
    g.fillStyle = "#fff0b0"; g.fillRect(X + 1, Y + 1, 2, 2);
    g.fillStyle = "#5a3a22"; g.fillRect(X - 2, Y, 2, 9); g.fillRect(X + 10, Y, 2, 9);
    g.fillStyle = "#6a4426"; g.fillRect(X - 2, Y + 10, 14, 2);
    g.fillStyle = "#8a6a3e"; g.fillRect(X - 2, Y + 10, 14, 1);
  }
  g.restore();

  // ---- roof: pitched field with ridge, eave overhang and inside-fade ----
  const rspr = art.roof[b.roof] || art.roof.wood;
  const rx0 = x0 - 5, rx1 = x1 + 5, ry0 = roofTop, ry1 = eaveY + 1;
  g.save();
  g.globalAlpha = inside ? 0.12 : 1;
  for (let y = ry0; y < ry1; y += T) for (let x = rx0; x < rx1; x += T) {
    const w = Math.min(T, rx1 - x), h = Math.min(T, ry1 - y);
    g.drawImage(rspr, 0, 0, w, h, x, y, w, h);
  }
  const rh = Math.max(1, ry1 - ry0);
  // ridge: the roof is pitched, so the crest sits across the middle of the slab
  const ridgeY = Math.round(ry0 + rh * 0.46);
  g.fillStyle = "rgba(255,246,214,0.16)"; g.fillRect(rx0 + 2, ridgeY - 1, rx1 - rx0 - 4, 1);
  g.fillStyle = "rgba(28,16,10,0.5)"; g.fillRect(rx0 + 2, ridgeY, rx1 - rx0 - 4, 2);
  g.fillStyle = "rgba(255,246,214,0.10)"; g.fillRect(rx0 + 2, ridgeY + 2, rx1 - rx0 - 4, 1);
  // ridge tiles
  for (let x = rx0 + 3; x < rx1 - 3; x += 5) { g.fillStyle = "rgba(20,10,8,0.5)"; g.fillRect(x, ridgeY - 1, 1, 4); }
  // the lower slope catches less light than the upper slope
  g.fillStyle = "rgba(24,12,10,0.10)"; g.fillRect(rx0, ridgeY + 3, rx1 - rx0, Math.max(1, ry1 - ridgeY - 5));
  g.fillStyle = "rgba(255,250,230,0.05)"; g.fillRect(rx0, ry0 + 1, rx1 - rx0, Math.max(1, Math.round(rh * 0.3)));
  // fascia board at the very top edge
  g.fillStyle = "rgba(28,16,10,0.40)"; g.fillRect(rx0 + 1, ry0 - 1, rx1 - rx0 - 2, 1);
  g.fillStyle = "rgba(255,244,210,0.10)"; g.fillRect(rx0 + 1, ry0, rx1 - rx0 - 2, 1);
  // hip shading at both ends so the roof does not read as a flat slab
  for (let k = 0; k < 5; k++) {
    g.fillStyle = `rgba(20,10,8,${0.05 + k * 0.02})`;
    g.fillRect(rx0 + k, ry0 + k, 1, rh - k * 2);
    g.fillRect(rx1 - 1 - k, ry0 + k, 1, rh - k * 2);
  }
  // eaves: overhang lip + shadow on the facade
  g.fillStyle = "rgba(22,12,8,0.65)"; g.fillRect(rx0, ry1, rx1 - rx0, 2);
  g.fillStyle = "rgba(255,238,200,0.10)"; g.fillRect(rx0, ry1 - 1, rx1 - rx0, 1);
  g.globalAlpha = 1;
  if (b.chimney) {
    const cx = x1 - 18, cy = ry0 + 5;
    g.fillStyle = "#4a4448"; g.fillRect(cx, cy, 8, 13);
    g.fillStyle = "#6a6068"; g.fillRect(cx + 1, cy - 3, 6, 4);
    g.fillStyle = "#2e2a2c"; g.fillRect(cx + 2, cy - 3, 4, 2);
    for (let y = cy + 4; y < cy + 12; y += 3) { g.fillStyle = "#7a7078"; g.fillRect(cx, y, 8, 1); }
  }
  g.restore();
}

function drawSelection(g: CanvasRenderingContext2D, o: RenderOpts, sel: Selection, col: string) {
  const T = o.frame.tilePx;
  const px = (x: number) => (x + SITE_MARGIN) * T;
  g.save();
  g.strokeStyle = col; g.lineWidth = 1; g.setLineDash([4, 2]);
  if (sel.kind === "building") {
    const b = o.plan.buildings.find((q) => q.id === sel.id);
    if (!b) { g.restore(); return; }
    g.strokeRect(px(b.x) - 1.5, px(b.y) - 10.5, b.w * T + 3, b.h * T + 12);
    g.setLineDash([]);
    g.fillStyle = "rgba(255,210,74,0.75)";
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.fillRect(px(b.x + b.w * dx) - 2, px(b.y + b.h * dy) - 2, 4, 4);
  } else {
    const p = sel.kind === "prop" ? o.plan.props.find((q) => q.id === sel.id) : o.plan.trees.find((q) => q.id === sel.id);
    if (!p) { g.restore(); return; }
    g.strokeRect(px(p.x) + 1.5, px(p.y) - 6.5, T - 3, T + 6);
  }
  g.restore();
}

// ------------------------------------------------------------------ ground ----
function getGround(o: RenderOpts): HTMLCanvasElement {
  const cached = groundCache.get(o.grid);
  const key = keyOf(o);
  if (cached && cached.key === key) return cached.canvas;
  const cv = buildGround(o);
  groundCache.set(o.grid, { key, canvas: cv });
  return cv;
}

function buildGround(o: RenderOpts): HTMLCanvasElement {
  const { frame, grid, plan } = o;
  const T = frame.tilePx;
  const { w, h } = canvasSize(frame);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const art = getVillageArt();
  const img = g.createImageData(w, h);
  const buf = new Uint32Array(img.data.buffer);
  const seedOff = o.seed % 997;

  const put = (X: number, Y: number, c: [number, number, number]) => {
    if (X < 0 || Y < 0 || X >= w || Y >= h) return;
    buf[Y * w + X] = (255 << 24) | ((c[2] & 255) << 16) | ((c[1] & 255) << 8) | (c[0] & 255);
  };

  for (let gy = 0; gy < grid.H; gy++) for (let gx = 0; gx < grid.W; gx++) {
    const i = gy * grid.W + gx;
    const kind = grid.ground[i];
    const base = kind === "wall" || kind === "door" ? "floor" : kind;
    const X0 = gx * T, Y0 = gy * T;
    const wx0 = (gx + SITE_MARGIN) * T + seedOff * 7;
    const wy0 = (gy + SITE_MARGIN) * T + seedOff * 13;

    if (kind === "plaza" || kind === "stone") {
      // cobbles: 8×8 stones with mortar
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const cxp = Math.floor(x / 8), cyp = Math.floor(y / 8);
        const hsh = hash2(gx * 2 + cxp, gy * 2 + cyp, 21);
        const shadeBase = hsh > 0.72 ? [168, 164, 156] : hsh > 0.4 ? [150, 146, 138] : [134, 130, 122];
        const edge = x % 8 === 0 || y % 8 === 0;
        const c = edge ? [96, 92, 86] : (y % 8 === 1 ? [Math.min(255, shadeBase[0] + 14), Math.min(255, shadeBase[1] + 14), Math.min(255, shadeBase[2] + 12)] : shadeBase);
        put(X0 + x, Y0 + y, c as [number, number, number]);
      }
    } else if (kind === "water") {
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const p = PAL.water[(x + y) % 2 ? 0 : 1];
        put(X0 + x, Y0 + y, p);
      }
      // gentle prototype-style wave lines (1px, deterministic per tile)
      for (let k = 0; k < 2; k++) {
        const wy = Math.floor(hash2(gx, gy, k + 5) * 13) + 2;
        const wx = Math.floor(hash2(gx, gy, k + 9) * 6);
        for (let x = wx; x < wx + 7; x++) if (X0 + x < (gx + 1) * T) put(X0 + x, Y0 + wy + (x - wx > 3 ? 1 : 0), [176, 224, 246]);
      }
    } else if (kind === "floor_wood" || kind === "floor_stone" || kind === "wall") {
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(X0 + x, Y0 + y, [90, 70, 52]);
    } else {
      const pal: PalKey = kind === "dirt" ? "road" : kind === "meadow" ? "meadow" : kind === "forest" ? "forest" : kind === "marsh" ? "marsh" : kind === "sand" ? "sand" : "grass";
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        put(X0 + x, Y0 + y, texel(pal, wx0 + x, wy0 + y));
      }
    }
  }

  // decorative details: grass tufts, pebbles, path ruts
  for (let gy = 0; gy < grid.H; gy++) for (let gx = 0; gx < grid.W; gx++) {
    const i = gy * grid.W + gx;
    const kind = grid.ground[i];
    const X0 = gx * T, Y0 = gy * T;
    if (kind === "grass" || kind === "meadow" || kind === "forest") {
      for (let k = 0; k < 3; k++) {
        const hsh = hash2(gx * 5 + k, gy * 7 + k, 31);
        if (hsh < 0.45) continue;
        const x = (hash2(gx, gy, k * 3 + 1) * 15) | 0, y = (hash2(gx, gy, k * 3 + 2) * 15) | 0;
        g.fillStyle = hsh > 0.8 ? "rgba(180,220,120,0.5)" : "rgba(30,60,26,0.35)";
        g.fillRect(X0 + x, Y0 + y, 1, 2);
        if (hsh > 0.86) g.fillRect(X0 + x + 1, Y0 + y + 1, 1, 1);
      }
      if (hash2(gx, gy, 44) > 0.9) {
        const cols = ["rgba(232,208,112,0.8)", "rgba(240,240,238,0.8)", "rgba(224,120,130,0.75)", "rgba(200,160,240,0.7)"];
        g.fillStyle = cols[(hash2(gx, gy, 47) * cols.length) | 0];
        g.fillRect(X0 + 4 + ((hash2(gx, gy, 45) * 8) | 0), Y0 + 4 + ((hash2(gx, gy, 46) * 8) | 0), 1, 1);
      }
    } else if (kind === "dirt") {
      for (let k = 0; k < 2; k++) {
        if (hash2(gx, gy, k + 61) < 0.6) continue;
        g.fillStyle = "rgba(70,52,36,0.5)";
        g.fillRect(X0 + ((hash2(gx, gy, k + 71) * 14) | 0), Y0 + ((hash2(gx, gy, k + 81) * 14) | 0), 2, 1);
      }
      if (hash2(gx, gy, 91) > 0.9) { g.fillStyle = "rgba(200,190,170,0.6)"; g.fillRect(X0 + ((hash2(gx, gy, 92) * 14) | 0), Y0 + ((hash2(gx, gy, 93) * 14) | 0), 1, 1); }
    }
  }

  g.putImageData(img, 0, 0);

  // re-draw floors/walls (drawImage above happened before putImageData, so do another pass)
  for (let gy = 0; gy < grid.H; gy++) for (let gx = 0; gx < grid.W; gx++) {
    const i = gy * grid.W + gx;
    const kind = grid.ground[i];
    const X0 = gx * T, Y0 = gy * T;
    if (kind === "floor_wood" || kind === "floor_stone") {
      g.drawImage(kind === "floor_wood" ? art.floor.wood : art.floor.stone, X0, Y0);
      g.fillStyle = "rgba(30,18,10,0.10)"; g.fillRect(X0, Y0, T, T);
    } else if (kind === "wall") {
      const spr = sprForWall(plan, gx, gy, art);
      g.drawImage(spr, X0, Y0 - 8);
    }
  }

  // door thresholds + interior shadow gradient near walls
  for (const b of plan.buildings) {
    const X0 = (b.x + SITE_MARGIN) * T, Y0 = (b.y + SITE_MARGIN) * T;
    g.fillStyle = "rgba(20,12,18,0.18)";
    g.fillRect(X0 + 1, Y0 + 1, b.w * T - 2, 2);
    g.fillRect(X0 + 1, Y0 + 1, 2, b.h * T - 2);
    g.fillRect(X0 + b.w * T - 3, Y0 + 1, 2, b.h * T - 2);
  }

  return cv;
}

function sprForWall(plan: ResolvedPlan, gx: number, gy: number, art: ReturnType<typeof getVillageArt>): Sprite {
  for (const b of plan.buildings) {
    if (gx >= b.x && gx < b.x + b.w && gy >= b.y && gy < b.y + b.h) {
      const front = gy === b.y + b.h - 1;
      const spr = art.wall[b.wall] || art.wall.wood;
      if (front) return spr;
      // side/back walls sit under the roof and read only as a thin top edge
      return spr;
    }
  }
  return art.wall.wood;
}

export function sideLabel(s: DetailSide): string {
  return s === "n" ? "bắc" : s === "s" ? "nam" : s === "e" ? "đông" : "tây";
}
