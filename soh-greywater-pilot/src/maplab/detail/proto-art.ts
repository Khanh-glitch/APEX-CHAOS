/* eslint-disable */
// ============================================================================
// REUSED FROM THE ORIGINAL PROTOTYPE
// Source: Soul of Hero browser prototype, `src/game/art.ts` and `src/game/render.ts`
// (input archive 01_original_prototype.zip, sha256 fa95538271fd…).
//
// Reuse is direct for: the sprite `mk`/outline pipeline, pixel primitives,
// the hero sprite sheets (HEAD/HEAD_F/drawHero/buildHero), the terrain palette
// and the texel variation logic, and the shadow mask builder.
// Adaptations are marked `// ADAPTED:` — they only decouple the code from the
// prototype's RunState / world singleton so it can serve a POI site.
// New village props live in `sprites.ts`; they are newly authored but use the
// same primitives, palette discipline and 1px outline convention.
// ============================================================================

import { hash2 } from "../geom";

export type G = CanvasRenderingContext2D;
export type Sprite = HTMLCanvasElement;
export const OUT = "#140c14";

export function mk(w: number, h: number, fn: (g: G) => void, outline: string | null = OUT): Sprite {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!; g.imageSmoothingEnabled = false; fn(g);
  if (outline) outlineCanvas(c, outline);
  return c;
}
export function outlineCanvas(c: Sprite, col: string) {
  const g = c.getContext("2d")!; const d = g.getImageData(0, 0, c.width, c.height); const a = d.data;
  const W = c.width, H = c.height; const src = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) src[i] = a[i * 4 + 3] > 40 ? 1 : 0;
  const [r, gg, b] = hex(col);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (src[i]) continue;
    if ((x > 0 && src[i - 1]) || (x < W - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < H - 1 && src[i + W])) {
      a[i * 4] = r; a[i * 4 + 1] = gg; a[i * 4 + 2] = b; a[i * 4 + 3] = 255;
    }
  }
  g.putImageData(d, 0, 0);
}
export function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const P = (g: G, x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
export const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
export function ell(g: G, cx: number, cy: number, rx: number, ry: number, c: string | ((nx: number, ny: number, x: number, y: number) => string | null)) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; if (nx * nx + ny * ny > 1) continue;
    const col = typeof c === "string" ? c : c(nx, ny, x, y); if (col) P(g, x, y, col);
  }
}
export const shade = (b: string, l: string, d: string, s = 0) => (nx: number, ny: number, x: number, y: number) => {
  const v = -nx * 0.55 - ny * 0.8 + (hash2(x, y, s) - 0.5) * 0.35;
  return v > 0.45 ? l : v < -0.35 ? d : b;
};
export function strs(g: G, ox: number, oy: number, rows: string[], pal: Record<string, string>, flip = false) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) { const ch = row[flip ? row.length - 1 - x : x]; if (ch !== "." && pal[ch]) P(g, ox + x, oy + y, pal[ch]); }
  });
}

// ===================== HERO (reused verbatim) =====================
const HEAD: Record<string, string[]> = {
  down: ['...hhhh...', '.hhhhhhhh.', 'hhhHhhHhhh', 'hHssssssHh', 'hseesseesh', 'hssssssssh', '.sssSSsss.', '..ssssss..', '...SSSS...'],
  side: ['..hhhhh...', '.hhhhhhhh.', 'hhhhhhhhh.', 'hhhhsssss.', 'hhhssssesS', 'hhHsssssss', '.hHssssSs.', '..hsssss..', '...SSSS...'],
  up: ['...hhhh...', '.hhhhhhhh.', 'hhhhhhhhhh', 'hhhHhhHhhh', 'hhhhhhhhhh', 'hhHhhhhHhh', '.hhhhhhhh.', '.hHhhhhHh.', '...SSSS...'],
};
const HEAD_F: Record<string, string[]> = {
  down: ['..hhhhhh..', '.hhhhhhhh.', 'hhhhHHhhhh', 'hhssssssHh', 'hseesseesh', 'hssssssssh', 'hsssSSsssh', 'h.ssssss.h', 'h..SSSS..h'],
  side: ['..hhhhhh..', '.hhhhhhhhh', 'hhhhhhhhhh', 'hhhhsssss.', 'hhhssssesS', 'hhHsssssss', 'hhHssssSs.', 'hh.sssss..', 'hh.SSSS...'],
  up: ['..hhhhhh..', '.hhhhhhhh.', 'hhhhhhhhhh', 'hhhHhhHhhh', 'hhhhhhhhhh', 'hhHhhhhHhh', 'hhhhhhhhhh', '.hHhhhhHh.', '...hhhh...'],
};
export interface HeroSet { [k: string]: Sprite[] }
function drawHero(g: G, dir: number, pose: string, f: number, female: boolean) {
  const pal = female
    ? { h: '#b4482a', H: '#7e2e1c', s: '#f2c39c', S: '#c98a68', e: '#2a1a2a', t: '#2f8f8a', T: '#1e5e66', l: '#d0a050', p: '#3c3456', k: '#2a1e1a', a: '#ffe0b0', c: '#6ad0c0' }
    : { h: '#5a3a22', H: '#3a2414', s: '#eab894', S: '#c08060', e: '#2a1a2a', t: '#b4532a', T: '#7a3420', l: '#6a4a2a', p: '#33304a', k: '#2a1e1a', a: '#ffe0b0', c: '#e09050' };
  const side = dir === 1 || dir === 2, flip = dir === 1;
  const ox = 3, bob = pose === 'idle' ? (f % 2) : pose === 'walk' ? (f % 2) : 0;
  const lean = pose === 'wind' ? -1 : pose === 'hit' ? 1 : 0;
  const lx = side ? (flip ? -lean : lean) : 0, ly = !side ? (dir === 0 ? lean : -lean) : 0;
  const legY = 17;
  if (pose === 'walk') {
    if (side) { const s = [0, 2, 0, -2][f]; R(g, 7 + s, legY, 2, 4, pal.p); R(g, 7 - s, legY, 2, 4, pal.T === '#1e5e66' ? '#2a2440' : '#26223a'); R(g, 7 + s, legY + 4, 3, 1, pal.k); R(g, 7 - s, legY + 4, 3, 1, pal.k); }
    else { const a = [0, -1, 0, 1][f]; R(g, 5, legY + Math.min(0, a), 2, 4 + Math.max(0, -a) - Math.max(0, a), pal.p); R(g, 9, legY + Math.min(0, -a), 2, 4 - Math.max(0, -a) + Math.max(0, a), pal.p); R(g, 5, legY + 4 - Math.max(0, a), 2, 1, pal.k); R(g, 9, legY + 4 - Math.max(0, -a), 2, 1, pal.k); }
  } else { R(g, side ? 7 : 5, legY, 2, 4, pal.p); R(g, side ? 8 : 9, legY, 2, 4, pal.p); R(g, side ? 7 : 5, legY + 4, side ? 4 : 2, 1, pal.k); if (!side) R(g, 9, legY + 4, 2, 1, pal.k); }
  const ty = 10 - bob + ly;
  R(g, 4 + lx, ty, 8, 7, pal.t); R(g, (flip ? 4 : 10) + lx, ty, 2, 7, pal.T); R(g, 4 + lx, ty + 5, 8, 1, pal.l);
  if (female) { R(g, 4 + lx, ty + 6, 8, 1, pal.t); P(g, 7 + lx, ty + 1, pal.c); P(g, 8 + lx, ty + 1, pal.c); } else { P(g, 7 + lx, ty + 1, pal.a); R(g, 6 + lx, ty, 4, 1, pal.T); }
  if (dir === 3) R(g, 5 + lx, ty + 1, 6, 3, female ? '#245a5a' : '#6a3a22');
  const sw = pose === 'walk' ? [0, 1, 0, -1][f] : 0;
  if (side) { const ax = flip ? 5 : 9; R(g, ax + lx + sw, ty + 1, 2, 5, pal.T); P(g, ax + lx + sw, ty + 6, pal.s); P(g, ax + 1 + lx + sw, ty + 6, pal.s); }
  else { R(g, 3 + lx, ty + 1 + sw, 1, 5, pal.T); R(g, 12 + lx, ty + 1 - sw, 1, 5, pal.T); P(g, 3 + lx, ty + 6 + sw, pal.s); P(g, 12 + lx, ty + 6 - sw, pal.s); }
  const hk = side ? 'side' : dir === 3 ? 'up' : 'down'; const rows = (female ? HEAD_F : HEAD)[hk];
  strs(g, ox + lx, 1 - bob + ly, rows, pal, flip);
  if (female && dir === 3) R(g, 7 + lx, 10 - bob, 2, 5, pal.h);
  if (female && side) { const bx = flip ? 12 : 3; R(g, bx + lx, 6 - bob, 1, 6, pal.h); P(g, bx + lx, 12 - bob, pal.l); }
  if (!female && dir === 0) { P(g, 6 + lx, 8 - bob, pal.H); P(g, 9 + lx, 8 - bob, pal.H); }
}
function drawHeroRoll(g: G, f: number, female: boolean) {
  const t = female ? '#2f8f8a' : '#b4532a', h = female ? '#b4482a' : '#5a3a22';
  ell(g, 8, 15, 6, 6, (nx, ny) => { const a = Math.atan2(ny, nx) + f * Math.PI / 2; return Math.sin(a) > 0.3 ? h : Math.cos(a) > 0.5 ? '#33304a' : t; });
}
function drawHeroDead(g: G, female: boolean) {
  const t = female ? '#2f8f8a' : '#b4532a', h = female ? '#b4482a' : '#5a3a22';
  R(g, 2, 17, 4, 5, h); R(g, 3, 18, 3, 3, '#eab894'); R(g, 6, 17, 7, 5, t); R(g, 13, 18, 3, 3, '#33304a');
}
export function buildHero(female: boolean): HeroSet {
  const set: HeroSet = {};
  for (let dir = 0; dir < 4; dir++) {
    set['idle' + dir] = [0, 1].map((f) => mk(16, 24, (g) => drawHero(g, dir, 'idle', f, female)));
    set['walk' + dir] = [0, 1, 2, 3].map((f) => mk(16, 24, (g) => drawHero(g, dir, 'walk', f, female)));
    set['wind' + dir] = [mk(16, 24, (g) => drawHero(g, dir, 'wind', 0, female))];
    set['hit' + dir] = [mk(16, 24, (g) => drawHero(g, dir, 'hit', 0, female))];
  }
  set.roll = [0, 1, 2, 3].map((f) => mk(16, 24, (g) => drawHeroRoll(g, f, female)));
  set.dead = [mk(16, 24, (g) => drawHeroDead(g, female))];
  return set;
}

// ===================== TERRAIN (reused palette + texel logic) =====================
export type RGB = [number, number, number];
const H = (c: string): RGB => hex(c);
export type PalKey = "grass" | "meadow" | "forest" | "marsh" | "sand" | "road" | "floor" | "wall" | "water";
export const PAL: Record<PalKey, RGB[]> = {
  grass: ['#4f8a3a', '#5a9a42', '#3f7a32', '#76b24e', '#e8d870'].map(H),
  meadow: ['#7aa84a', '#86b452', '#6a983e', '#a2cc6a', '#c08ad8'].map(H),
  forest: ['#3a6e30', '#33662a', '#24501e', '#4c863a', '#6a5a2a'].map(H),
  marsh: ['#4a6a3e', '#42603a', '#2e4a2a', '#6a8a4e', '#4a3e2a'].map(H),
  sand: ['#dcc68e', '#e4d098', '#c4aa74', '#f2e4b4', '#f0e0d0'].map(H),
  road: ['#a08060', '#9a7a58', '#7a5e40', '#b89470', '#6a5a4a'].map(H),
  floor: ['#9a6a3e', '#8a5e36', '#5a3a22', '#b0804a', '#7a7a7e'].map(H),
  wall: ['#4a4048', '#544a52', '#2e2830', '#6a5e66', '#7a5a4a'].map(H),
  water: ['#2e6ea0', '#3478aa', '#24609a', '#4a90c0', '#3a82a8'].map(H),
};

/**
 * ADAPTED: prototype `texel()` from render.ts, reduced to the ground types a POI
 * site can have. Same palette entries, same hash/fbm-free variation rules.
 * (fbm is replaced with a two-octave hash lattice to keep generation local.)
 */
export function texel(kind: PalKey, wx: number, wy: number): RGB {
  const p = PAL[kind];
  const h = hash2(wx, wy, kind.length * 13 + 1);
  const hb = hash2(wx, wy >> 1, kind.length + 3);
  let c = hb > 0.5 ? p[1] : p[0];
  if (hb < 0.11) c = p[2]; else if (hb > 0.94) c = p[3];
  if (kind === "grass" || kind === "meadow" || kind === "forest") {
    if (hash2(wx >> 1, wy >> 1, 9) > (kind === "meadow" ? 0.988 : 0.996)) c = p[4];
    if (kind === "forest" && h < 0.3) c = p[4];
  }
  if (kind === "road") {
    const lx = wx % 16, ly = wy % 16;
    if (hash2(wx >> 1, wy >> 1, 6) > 0.98) c = p[4];
    if (ly < 1 || ly > 14) c = p[2];
    void lx;
  }
  if (kind === "wall") { const ly = wy % 16; if (ly >= 6) c = (ly % 3 === 0 || (wx + (Math.floor(ly / 3) % 2) * 3) % 6 === 0) ? H('#4a3428') : p[4]; }
  return c;
}

/** Reused prototype shadow mask builder (render.ts `shadow`). */
const shadowCache = new Map<number, Sprite>();
export function shadowSprite(rw: number): Sprite {
  let s = shadowCache.get(rw);
  if (!s) {
    const SW = rw * 2 + 2, SH = Math.max(3, rw) + 2;
    s = mk(SW, SH, (gg) => {
      gg.fillStyle = "rgba(10,8,20,0.32)";
      const ry = Math.max(1.5, rw * 0.45);
      for (let yy = 0; yy < SH; yy++) for (let xx = 0; xx < SW; xx++) {
        const nx = (xx + 0.5 - rw - 1) / rw, ny = (yy + 0.5 - (ry + 1)) / ry;
        if (nx * nx + ny * ny <= 1) gg.fillRect(xx, yy, 1, 1);
      }
    }, null);
    shadowCache.set(rw, s);
  }
  return s;
}
