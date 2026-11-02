// Original pixel art for Soul of Hero, painted pixel-by-pixel into offscreen canvases at boot.
// (GOLD_SOURCE_NOT_AVAILABLE — these are original replacements; no third-party sprites used.)
import { hash2 } from './core';
import { ITEMS } from './catalog';

type G = CanvasRenderingContext2D;
export type Sprite = HTMLCanvasElement;
const OUT = '#140c14';
export function mk(w: number, h: number, fn: (g: G) => void, outline: string | null = OUT): Sprite {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; fn(g); if (outline) outlineCanvas(c, outline); return c;
}
export function outlineCanvas(c: Sprite, col: string) {
  const g = c.getContext('2d')!; const d = g.getImageData(0, 0, c.width, c.height); const a = d.data; const W = c.width, H = c.height; const src = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) src[i] = a[i * 4 + 3] > 40 ? 1 : 0;
  const [r, gg, b] = hex(col);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (src[i]) continue;
    if ((x > 0 && src[i - 1]) || (x < W - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < H - 1 && src[i + W])) { a[i * 4] = r; a[i * 4 + 1] = gg; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; } }
  g.putImageData(d, 0, 0);
}
export function hex(c: string): [number, number, number] { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const P = (g: G, x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
function ell(g: G, cx: number, cy: number, rx: number, ry: number, c: string | ((nx: number, ny: number, x: number, y: number) => string | null)) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; if (nx * nx + ny * ny > 1) continue;
    const col = typeof c === 'string' ? c : c(nx, ny, x, y); if (col) P(g, x, y, col);
  }
}
const shade = (b: string, l: string, d: string, s = 0) => (nx: number, ny: number, x: number, y: number) => { const v = -nx * 0.55 - ny * 0.8 + (hash2(x, y, s) - 0.5) * 0.35; return v > 0.45 ? l : v < -0.35 ? d : b; };
function strs(g: G, ox: number, oy: number, rows: string[], pal: Record<string, string>, flip = false) {
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[flip ? row.length - 1 - x : x]; if (ch !== '.' && pal[ch]) P(g, ox + x, oy + y, pal[ch]); } });
}

// ===================== HERO =====================
const HEAD: Record<string, string[]> = {
  down: ['...hhhh...', '.hhhhhhhh.', 'hhhHhhHhhh', 'hHssssssHh', 'hseessees h'.replace(' ', ''), 'hssssssssh', '.sssSSsss.', '..ssssss..', '...SSSS...'],
  side: ['..hhhhh...', '.hhhhhhhh.', 'hhhhhhhhh.', 'hhhhsssss.', 'hhhssssesS', 'hhHsssssss', '.hHssssSs.', '..hsssss..', '...SSSS...'],
  up: ['...hhhh...', '.hhhhhhhh.', 'hhhhhhhhhh', 'hhhHhhHhhh', 'hhhhhhhhhh', 'hhHhhhhHhh', '.hhhhhhhh.', '.hHhhhhHh.', '...SSSS...'],
};
const HEAD_F: Record<string, string[]> = {
  down: ['..hhhhhh..', '.hhhhhhhh.', 'hhhhHHhhhh', 'hhssssssHh', 'hseessees h'.replace(' ', ''), 'hssssssssh', 'hsssSSsssh', 'h.ssssss.h', 'h..SSSS..h'],
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
  // legs
  const legY = 17;
  if (pose === 'walk') {
    if (side) { const s = [0, 2, 0, -2][f]; R(g, 7 + s, legY, 2, 4, pal.p); R(g, 7 - s, legY, 2, 4, pal.T === '#1e5e66' ? '#2a2440' : '#26223a'); R(g, 7 + s, legY + 4, 3, 1, pal.k); R(g, 7 - s, legY + 4, 3, 1, pal.k); }
    else { const a = [0, -1, 0, 1][f]; R(g, 5, legY + Math.min(0, a), 2, 4 + Math.max(0, -a) - Math.max(0, a), pal.p); R(g, 9, legY + Math.min(0, -a), 2, 4 - Math.max(0, -a) + Math.max(0, a), pal.p); R(g, 5, legY + 4 - Math.max(0, a), 2, 1, pal.k); R(g, 9, legY + 4 - Math.max(0, -a), 2, 1, pal.k); }
  } else { R(g, side ? 7 : 5, legY, 2, 4, pal.p); R(g, side ? 8 : 9, legY, 2, 4, pal.p); R(g, side ? 7 : 5, legY + 4, side ? 4 : 2, 1, pal.k); if (!side) R(g, 9, legY + 4, 2, 1, pal.k); }
  // torso
  const ty = 10 - bob + ly;
  R(g, 4 + lx, ty, 8, 7, pal.t); R(g, (flip ? 4 : 10) + lx, ty, 2, 7, pal.T); R(g, 4 + lx, ty + 5, 8, 1, pal.l);
  if (female) { R(g, 4 + lx, ty + 6, 8, 1, pal.t); P(g, 7 + lx, ty + 1, pal.c); P(g, 8 + lx, ty + 1, pal.c); } else { P(g, 7 + lx, ty + 1, pal.a); R(g, 6 + lx, ty, 4, 1, pal.T); }
  if (dir === 3) R(g, 5 + lx, ty + 1, 6, 3, female ? '#245a5a' : '#6a3a22'); // back strap / pack
  // arms
  const sw = pose === 'walk' ? [0, 1, 0, -1][f] : 0;
  if (side) { const ax = flip ? 5 : 9; R(g, ax + lx + sw, ty + 1, 2, 5, pal.T); P(g, ax + lx + sw, ty + 6, pal.s); P(g, ax + 1 + lx + sw, ty + 6, pal.s); }
  else { R(g, 3 + lx, ty + 1 + sw, 1, 5, pal.T); R(g, 12 + lx, ty + 1 - sw, 1, 5, pal.T); P(g, 3 + lx, ty + 6 + sw, pal.s); P(g, 12 + lx, ty + 6 - sw, pal.s); }
  // head
  const hk = side ? 'side' : dir === 3 ? 'up' : 'down'; const rows = (female ? HEAD_F : HEAD)[hk];
  strs(g, ox + lx, 1 - bob + ly, rows, pal, flip);
  if (female && dir === 3) R(g, 7 + lx, 10 - bob, 2, 5, pal.h); // braid
  if (female && side) { const bx = flip ? 12 : 3; R(g, bx + lx, 6 - bob, 1, 6, pal.h); P(g, bx + lx, 12 - bob, pal.l); }
  if (!female && dir === 0) { P(g, 6 + lx, 8 - bob, pal.H); P(g, 9 + lx, 8 - bob, pal.H); } // stubble hint
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
    set['idle' + dir] = [0, 1].map(f => mk(16, 24, g => drawHero(g, dir, 'idle', f, female)));
    set['walk' + dir] = [0, 1, 2, 3].map(f => mk(16, 24, g => drawHero(g, dir, 'walk', f, female)));
    set['wind' + dir] = [mk(16, 24, g => drawHero(g, dir, 'wind', 0, female))];
    set['hit' + dir] = [mk(16, 24, g => drawHero(g, dir, 'hit', 0, female))];
  }
  set.roll = [0, 1, 2, 3].map(f => mk(16, 24, g => drawHeroRoll(g, f, female)));
  set.dead = [mk(16, 24, g => drawHeroDead(g, female))];
  return set;
}

// ===================== CREATURES (facing right) =====================
function legs(g: G, xs: number[], y: number, f: number, c: string, len = 3) { xs.forEach((x, i) => { const o = (i + f) % 2 ? 1 : 0; R(g, x, y - o, 1, len + o - (o ? 1 : 0), c); }); }
const CRE_DRAW: Record<string, (g: G, f: number, pose: string) => void> = {
  boar: (g, f, pose) => { const cr = pose === 'tell' ? 1 : 0; legs(g, [5, 8, 14, 17], 15, pose === 'walk' ? f : 0, '#3a2418', 3);
    ell(g, 11, 11 + cr, 8, 5, shade('#7a4a2e', '#a0683e', '#4e2e1c', 3)); for (let x = 5; x < 16; x += 2) P(g, x, 6 + cr + (x % 4 ? 0 : -1), '#2a1a12');
    ell(g, 19, 12 + cr, 3, 3, shade('#8a5434', '#b07a50', '#5a3420')); R(g, 21, 12 + cr, 2, 2, '#d08a8a'); P(g, 20, 14 + cr, '#f4f0e0'); P(g, 21, 15 + cr, '#f4f0e0'); P(g, 18, 10 + cr, pose === 'tell' ? '#ff4a2a' : '#1a1010'); P(g, 17, 8 + cr, '#4e2e1c'); },
  wolf: (g, f, pose) => { const cr = pose === 'tell' ? 2 : 0; legs(g, [6, 8, 15, 17], 15, pose === 'walk' ? f : 0, '#5a5e68', 3);
    ell(g, 12, 11 + cr * 0.5, 7, 4, shade('#8a909c', '#c0c6d0', '#5a5e68', 5)); R(g, 2, 8 + (f % 2), 4, 2, '#8a909c'); P(g, 1, 7 + (f % 2), '#c0c6d0');
    ell(g, 19, 9 + cr, 3, 3, shade('#9aa0aa', '#d0d6e0', '#5a5e68')); R(g, 21, 10 + cr, 3, 2, '#9aa0aa'); P(g, 23, 10 + cr, '#1a1a20'); P(g, 18, 5 + cr, '#5a5e68'); P(g, 20, 5 + cr, '#5a5e68'); P(g, 18, 6 + cr, '#8a909c'); P(g, 20, 8 + cr, pose === 'tell' ? '#ffd040' : '#e0e040'); if (pose === 'attack') R(g, 21, 12 + cr, 3, 1, '#f0f0f0'); },
  toad: (g, f, pose) => { const sw = pose === 'tell' ? 3 : 0; ell(g, 12, 12, 8, 5, shade('#5a8a3a', '#8ac25a', '#3a5a2a', 7)); for (let i = 0; i < 6; i++) P(g, 7 + i * 2, 10 + (i % 2), '#3a5a2a');
    ell(g, 16, 6, 2, 2, '#8ac25a'); ell(g, 10, 6, 2, 2, '#8ac25a'); P(g, 16, 5, '#1a1010'); P(g, 10, 5, '#1a1010'); P(g, 17, 5, '#ffe080'); ell(g, 13, 15 + sw * 0.3, 4 + sw, 2 + sw * 0.6, pose === 'tell' ? '#f0d070' : '#c8d890');
    R(g, 4, 15 + (f % 2), 3, 2, '#3a5a2a'); R(g, 18, 15 - (f % 2), 3, 2, '#3a5a2a'); },
  crawler: (g, f, pose) => { for (let i = 0; i < 3; i++) { const o = (i + f) % 2; R(g, 5 + i * 5, 13 + o, 1, 4 - o, '#4a4e56'); R(g, 4 + i * 5, 16, 2, 1, '#2a2e36'); R(g, 7 + i * 5, 9 - o, 1, 3, '#4a4e56'); }
    ell(g, 12, 11, 7, 5, shade('#7a7e88', '#b0b4bc', '#4a4e56', 9)); R(g, 8, 8, 8, 1, '#a07a4a'); ell(g, 15, 11, 2.5, 2.5, pose === 'tell' ? '#ff6a4a' : '#a01e1e'); P(g, 15, 10, '#ffd0c0'); R(g, 6, 12, 2, 2, '#c0a07a'); },
  beetle: (g, f, pose) => { legs(g, [6, 10, 14], 16, pose === 'walk' ? f : 0, '#2a1a1a', 2); ell(g, 11, 11, 8, 6, shade('#5a2a24', '#8a4436', '#2a1414', 11));
    for (let y = 7; y < 16; y++) P(g, 11, y, '#2a1414'); for (const [x, y] of [[8, 9], [14, 12], [7, 13], [13, 8]]) P(g, x, y, pose === 'tell' ? '#ffe070' : '#ff7a3a'); ell(g, 19, 11, 2.5, 3, '#3a2020'); R(g, 21, 8, 1, 3, '#c0603a'); P(g, 22, 7, '#e08050'); P(g, 20, 10, '#ff9a4a'); },
  crab: (g, f, pose) => { const up = pose === 'tell' || pose === 'attack' ? -2 : 0; legs(g, [6, 8, 15, 17], 15, pose === 'walk' ? f : 0, '#9a3a1e', 2);
    ell(g, 12, 12, 7, 4, shade('#c8502e', '#f08a5a', '#8a2e1a', 13)); ell(g, 4, 8 + up, 2.5, 2, '#e0703e'); ell(g, 20, 8 + up, 2.5, 2, '#e0703e'); P(g, 3, 7 + up, '#f8c0a0'); P(g, 21, 7 + up, '#f8c0a0'); R(g, 5, 10, 1, 2, '#c8502e'); R(g, 19, 10, 1, 2, '#c8502e');
    P(g, 10, 7, '#1a1010'); P(g, 14, 7, '#1a1010'); R(g, 10, 8, 1, 1, '#c8502e'); R(g, 14, 8, 1, 1, '#c8502e'); },
};
export function buildCreature(type: string) {
  const d = CRE_DRAW[type]; const fr: Record<string, Sprite[]> = {};
  fr.walk = [0, 1, 2, 3].map(f => mk(24, 20, g => d(g, f, 'walk')));
  fr.tell = [mk(24, 20, g => d(g, 0, 'tell'))]; fr.attack = [mk(24, 20, g => d(g, 1, 'attack'))];
  return fr;
}

// ===================== ELDERS (48x48, latent/awakened) =====================
const ELDER_DRAW: Record<string, (g: G, f: number, aw: boolean, tell: boolean) => void> = {
  frost: (g, f, aw, tell) => { const b = f % 2; // Glacier Matron: robed ice queen with spiked crown
    ell(g, 24, 38, 14, 8, shade('#c8e0f0', '#ffffff', '#7aa0c0', 21)); R(g, 14, 20, 20, 18, '#a0c8e8'); for (let y = 20; y < 38; y++) { P(g, 14 + ((y * 3) % 4), y, '#7aa0c0'); P(g, 33 - ((y * 5) % 3), y, '#d8f0ff'); }
    ell(g, 24, 22, 9, 5, shade('#d8f0ff', '#ffffff', '#88b0d0')); ell(g, 24, 13 - b, 6, 6, shade('#e0f0ff', '#ffffff', '#a0c0dc')); P(g, 22, 13 - b, tell ? '#ffffff' : '#2a8ad0'); P(g, 26, 13 - b, tell ? '#ffffff' : '#2a8ad0');
    const sp = aw ? 6 : 3; for (let k = -2; k <= 2; k++) R(g, 24 + k * 3, 7 - b - (2 - Math.abs(k)) * (sp / 3), 1, sp - Math.abs(k), '#bff0ff');
    for (const s of [-1, 1]) { ell(g, 24 + s * 12, 20, 3, 3, '#e8f8ff'); R(g, 24 + s * 13, 14, 1, 5, '#bff0ff'); }
    if (tell) { R(g, 8, 26 - b, 3, 1, '#ffffff'); R(g, 37, 26 - b, 3, 1, '#ffffff'); } if (!aw) for (let y = 18; y < 44; y += 3) R(g, 12, y, 24, 1, 'rgba(180,230,255,0.35)'); },
  magma: (g, f, aw, tell) => { const b = f % 2; // Caldera Titan: basalt hulk with molten heart
    ell(g, 24, 28 + b, 16, 13, shade('#4a3a36', '#6a5650', '#2a201e', 22)); ell(g, 9, 30, 6, 8, shade('#4a3a36', '#6a5650', '#2a201e', 23)); ell(g, 39, 30, 6, 8, shade('#4a3a36', '#6a5650', '#2a201e', 24));
    R(g, 14, 40, 6, 6, '#3a2c28'); R(g, 28, 40, 6, 6, '#3a2c28'); ell(g, 24, 14 + b, 7, 6, shade('#5a4842', '#7a645c', '#2a201e', 25));
    ell(g, 24, 27 + b, 5, 5, tell ? '#ffffa0' : aw ? '#ffd040' : '#ff8a2a'); ell(g, 24, 27 + b, 2.5, 2.5, '#fff0b0');
    for (const [x, y, l] of [[15, 22, 6], [33, 24, 5], [20, 34, 4], [30, 33, 5], [8, 28, 4], [40, 27, 4]]) for (let k = 0; k < l; k++) P(g, x + ((k * 7) % 3) - 1, y + k, aw ? '#ffb040' : '#d0501e');
    P(g, 21, 14 + b, '#ffd040'); P(g, 27, 14 + b, '#ffd040'); if (aw) for (let k = 0; k < 5; k++) P(g, 18 + k * 3, 7 + b - (k % 2), '#ff7a2a'); },
  bog: (g, f, aw, tell) => { const b = f % 2; // Mire Mother: bloated matriarch toad, reed-crowned, many eyes
    ell(g, 24, 30, 19, 13 + b, shade('#4a6a2e', '#7a9a4a', '#2a3a1e', 26)); ell(g, 24, 36, 12, 6 + (tell ? 3 : 0), tell ? '#e8d070' : '#a8b878');
    for (let k = 0; k < 9; k++) { const x = 10 + k * 3.5; R(g, x, 12 + (k % 3) * 2 - b, 1, 9, '#6a8a3a'); P(g, x, 11 + (k % 3) * 2 - b, '#a08a4a'); }
    for (const [x, y] of [[16, 21], [22, 19], [28, 19], [34, 21], [19, 25], [31, 25]]) { ell(g, x, y, 2, 2, '#c8d870'); P(g, x, y, aw ? '#ff3a2a' : '#1a1010'); }
    for (let k = 0; k < 8; k++) P(g, 8 + k * 4, 33 + (k % 2), '#2a3a1e'); R(g, 6, 40, 6, 3, '#3a5a2a'); R(g, 36, 40, 6, 3, '#3a5a2a'); },
  grove: (g, f, aw, tell) => { const b = f % 2; // Elder Treant: walking oak, antler branches
    R(g, 18, 18, 12, 22, '#5a3a22'); for (let y = 18; y < 40; y += 2) P(g, 20 + (y % 3), y, '#3a2414'); R(g, 26, 18, 2, 22, '#7a5232');
    for (const s of [-1, 1]) { R(g, 24 + s * 8 - 1, 24, 3, 10, '#5a3a22'); R(g, 24 + s * 14, 30 + b, 3, 6, '#5a3a22'); R(g, 24 + s * 10, 28 + b, 6 * s > 0 ? 6 : 6, 2, '#5a3a22'); }
    for (const [x, y, rr] of [[14, 10, 7], [34, 10, 7], [24, 6, 8], [10, 18, 5], [38, 18, 5]]) ell(g, x, y + b, rr, rr * 0.8, shade(aw ? '#4a9a3a' : '#3a7a2e', aw ? '#8ae05a' : '#6ab04a', '#24501e', x + y));
    R(g, 14, 40, 5, 6, '#4a2e1a'); R(g, 29, 40, 5, 6, '#4a2e1a'); R(g, 11, 45, 6, 1, '#4a2e1a'); R(g, 31, 45, 6, 1, '#4a2e1a');
    P(g, 21, 24, tell ? '#ffffa0' : '#b0ff6a'); P(g, 26, 24, tell ? '#ffffa0' : '#b0ff6a'); R(g, 22, 29, 4, 1, '#2a1a0e'); },
  tide: (g, f, aw, tell) => { const b = f % 2; // Tide Serpent: coiled sea-serpent rearing from foam
    ell(g, 24, 38, 18, 7, shade('#1e5a8a', '#3a8ac0', '#103a5a', 27)); ell(g, 24, 38, 12, 4, '#2a78b0');
    for (let k = 0; k < 14; k++) { const y = 36 - k * 2, x = 24 + Math.sin(k * 0.6 + b * 0.5) * 6; ell(g, x, y, 5 - k * 0.12, 3, shade('#2a7ab0', '#6ac8f0', '#16507a', k)); P(g, x - 3, y, '#d0f0ff'); }
    ell(g, 24 + Math.sin(8.4 + b * 0.5) * 6, 8, 6, 5, shade('#2a7ab0', '#6ac8f0', '#16507a', 31)); const hx = 24 + Math.sin(8.4 + b * 0.5) * 6;
    P(g, hx - 2, 7, tell ? '#ffffff' : '#ffe040'); P(g, hx + 2, 7, tell ? '#ffffff' : '#ffe040'); R(g, hx - 2, 11, 5, 1, '#0e2e4a');
    for (let k = 0; k < (aw ? 5 : 3); k++) R(g, hx - 6 + k * 3, 2 - (k % 2), 1, 3, '#9ae0ff'); for (const s of [-1, 1]) R(g, 24 + s * 10, 26 - b, 4 * s > 0 ? 4 : 4, 2, '#6ac8f0'); },
  rust: (g, f, aw, tell) => { const b = f % 2; // Rust Colossus: foundry mech, cyclopean lens, smokestack
    R(g, 12, 16 + b, 24, 20, '#7a4a2a'); R(g, 12, 16 + b, 24, 2, '#a86a3a'); for (let x = 14; x < 36; x += 5) R(g, x, 20 + b, 1, 14, '#5a3420'); for (const [x, y] of [[14, 18], [33, 18], [14, 33], [33, 33]]) P(g, x, y + b, '#d0a070');
    ell(g, 24, 25 + b, 6, 6, '#2a1e1a'); ell(g, 24, 25 + b, 4, 4, tell ? '#ffffff' : aw ? '#ff3a1e' : '#c84a1e'); P(g, 23, 24 + b, '#ffd0a0');
    R(g, 30, 6 + b, 4, 10, '#5a3420'); R(g, 29, 5 + b, 6, 2, '#8a5a32'); for (const s of [-1, 1]) { R(g, 24 + s * 16 - 3, 18 + b, 6, 12, '#6a3e22'); R(g, 24 + s * 16 - 2, 30 + b, 4, 6, '#9a6a3a'); }
    R(g, 15, 36, 6, 9, '#5a3420'); R(g, 27, 36, 6, 9, '#5a3420'); R(g, 13, 44, 10, 2, '#3a2214'); R(g, 25, 44, 10, 2, '#3a2214'); if (aw) for (let k = 0; k < 4; k++) P(g, 16 + k * 5, 15 + b, '#ffb040'); },
};
export function buildElder(key: string) { const d = ELDER_DRAW[key]; const out: Record<string, Sprite[]> = {};
  for (const aw of [false, true]) { out[(aw ? 'a' : 'l') + 'idle'] = [0, 1].map(f => mk(48, 48, g => d(g, f, aw, false))); out[(aw ? 'a' : 'l') + 'tell'] = [mk(48, 48, g => d(g, 0, aw, true))]; }
  out.sleep = [mk(48, 48, g => { d(g, 0, false, false); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(30,30,60,0.45)'; g.fillRect(0, 0, 48, 48); })];
  return out;
}

// ===================== TREES & SOURCES =====================
function oak(g: G, v: number, snow = false) {
  R(g, 10, 22, 4, 9, '#5a3a22'); R(g, 12, 22, 2, 9, '#7a5232'); P(g, 9, 30, '#5a3a22'); P(g, 14, 30, '#5a3a22');
  const blobs = [[12, 12, 9], [6 + v, 15, 5], [18 - v, 15, 5], [12, 6, 6], [8, 9, 5], [16, 9, 5]];
  for (const [x, y, r] of blobs) ell(g, x, y, r, r * 0.85, shade(snow ? '#4a6a5a' : '#3f7a32', snow ? '#e8f0f8' : '#6aa84a', '#24501e', x * 7 + y + v));
  for (let k = 0; k < 14; k++) { const x = 4 + hash2(k, v, 1) * 16 | 0, y = 3 + hash2(k, v, 2) * 16 | 0; if (g.getImageData(x, y, 1, 1).data[3]) P(g, x, y, hash2(k, v, 3) > 0.5 ? '#8ac25a' : '#2d5a27'); }
}
function pine(g: G, v: number, snow: boolean) {
  R(g, 11, 26, 3, 6, '#4a2e1a');
  for (let tier = 0; tier < 4; tier++) { const y0 = 3 + tier * 6, w = 4 + tier * 2.4; for (let y = 0; y < 8; y++) { const hw = (y / 8) * w; for (let x = Math.round(12 - hw); x <= Math.round(12 + hw); x++) { const nx = (x - 12) / (w + 0.1); const c = nx < -0.3 ? (snow ? '#d8e4f0' : '#4a8a4a') : nx > 0.35 ? '#1e4628' : '#2e6a3a'; P(g, x, y0 + y, (snow && y < 2) ? '#f4f8ff' : c); } } }
  if (snow) for (let k = 0; k < 6; k++) P(g, 8 + hash2(k, v, 4) * 8 | 0, 6 + k * 3, '#ffffff');
}
function palm(g: G, v: number) {
  for (let y = 10; y < 32; y++) { const x = 11 + Math.round(Math.sin(y / 9 + v) * 2); R(g, x, y, 3, 1, y % 3 ? '#8a6a3a' : '#6a4e2a'); }
  const cx = 11 + Math.round(Math.sin(10 / 9 + v) * 2) + 1;
  for (const [dx, dy] of [[-1, -0.2], [1, -0.2], [-0.8, 0.5], [0.8, 0.5], [0, -1], [-0.4, -0.8], [0.4, -0.8]]) for (let k = 0; k < 10; k++) { const x = cx + dx * k, y = 10 + dy * k + (k * k) / 18; P(g, x, y, k < 7 ? '#3f8a3a' : '#2a6a2a'); P(g, x, y + 1, '#24501e'); }
  P(g, cx, 11, '#6a4a2a'); P(g, cx - 1, 12, '#5a3a22');
}
function willow(g: G, v: number) {
  R(g, 10, 20, 4, 11, '#4a3a26'); ell(g, 12, 10, 10, 8, shade('#4a6a3a', '#7a9a5a', '#2a3a22', v));
  for (let x = 3; x < 22; x += 2) { const l = 8 + (hash2(x, v, 5) * 10 | 0); for (let y = 12; y < 12 + l; y++) P(g, x, y, y % 2 ? '#5a7a42' : '#3a5a2e'); }
}
function dead(g: G, v: number) {
  R(g, 10, 12, 3, 20, '#2a2220'); R(g, 11, 12, 1, 20, '#3a302c');
  for (const [x, y, dx] of [[11, 14, -1], [12, 10, 1], [11, 18, 1], [11, 8, -1]]) for (let k = 0; k < 6; k++) P(g, x + dx * k, y - (k >> 1), '#2a2220');
  for (let k = 0; k < 4; k++) P(g, 9 + k * 2, 25 + (k % 2), '#ff7a3a');
}
function rock(g: G, v: number, vein: string | null, vein2?: string) {
  ell(g, 8, 10, 7, 5.5, shade('#7d8088', '#b9bcc4', '#4e5058', 40 + v)); ell(g, 5 + v % 3, 8, 3, 2.5, shade('#8d9098', '#c9ccd4', '#5e6068', 41 + v));
  if (vein) for (let k = 0; k < 8; k++) { const x = 3 + hash2(k, v, 6) * 10 | 0, y = 7 + hash2(k, v, 7) * 6 | 0; P(g, x, y, k % 2 ? vein : (vein2 || vein)); }
  for (let k = 0; k < 3; k++) P(g, 4 + k * 3, 12, '#4e5058');
}
function crystal(g: G) {
  ell(g, 8, 13, 6, 2.5, '#4e5058');
  for (const [x, h, c] of [[5, 9, '#4fa6d8'], [8, 12, '#8ad0f0'], [11, 8, '#4fa6d8'], [7, 6, '#c8f0ff']] as [number, number, string][]) { for (let y = 0; y < h; y++) { R(g, x, 13 - y, 2, 1, c); } P(g, x, 13 - h, '#ffffff'); }
}
function bush(g: G, berries: boolean, v: number) {
  ell(g, 8, 10, 7, 5, shade('#3f7a32', '#6aa84a', '#24501e', 50 + v)); ell(g, 5, 8, 3.5, 3, shade('#4a8a3a', '#7ab85a', '#2a5a22', 51 + v));
  if (berries) for (let k = 0; k < 7; k++) { const x = 3 + hash2(k, v, 8) * 10 | 0, y = 6 + hash2(k, v, 9) * 7 | 0; P(g, x, y, '#e03a5a'); P(g, x, y - 1, '#ff8aa0'); }
}
function grass(g: G, v: number, col = ['#5a9a3c', '#8ac258', '#3f7a32']) { for (let k = 0; k < 9; k++) { const x = 3 + k + (hash2(k, v, 10) * 2 | 0), h = 4 + (hash2(k, v, 11) * 6 | 0); for (let y = 0; y < h; y++) P(g, x + (y > h - 3 ? (k % 2 ? 1 : -1) : 0), 14 - y, col[(k + y) % 3]); } }
function reed(g: G, v: number) { grass(g, v, ['#6a8a3a', '#9ab858', '#4a6a2a']); for (let k = 0; k < 3; k++) { R(g, 4 + k * 4, 3 + k, 1, 3, '#7a4a2a'); } }
function herb(g: G) { for (const [x, y] of [[6, 10], [9, 9], [8, 12], [11, 11], [5, 13]]) { R(g, x, y, 2, 2, '#4aa05a'); P(g, x, y, '#8ae09a'); } R(g, 8, 11, 1, 4, '#2e6a3a'); }
function mush(g: G) { for (const [x, y, c] of [[5, 10, '#8a5ab0'], [10, 9, '#a06ad0'], [8, 12, '#7a4aa0']] as [number, number, string][]) { R(g, x, y + 2, 1, 3, '#e0d8c0'); ell(g, x + 0.5, y + 1, 2.5, 1.6, c); P(g, x - 1, y, '#e0c0ff'); } }
function scrap(g: G, v: number) { R(g, 2, 10, 12, 4, '#5a5e64'); R(g, 4, 7, 6, 4, '#8a5a3a'); R(g, 9, 8, 5, 3, '#6f7378'); P(g, 5, 8, '#c0a07a'); R(g, 3, 11, 3, 1, '#a0a4a8'); R(g, 10, 12, 2, 2, '#3a3e44'); ell(g, 12, 7, 2, 2, '#4a4e54'); P(g, 12, 7, '#2a2e34'); if (v % 2) R(g, 6, 5, 1, 3, '#9a6a3a'); }
function wreck(g: G, v: number) { const body = v % 2 ? '#7a3a2a' : '#4a5a6a';
  R(g, 2, 8, 28, 9, body); R(g, 6, 4, 16, 5, body); R(g, 8, 5, 5, 3, '#2a3a4a'); R(g, 14, 5, 6, 3, '#3a4a5a'); P(g, 15, 6, '#8ab0c0');
  for (let k = 0; k < 18; k++) P(g, 2 + hash2(k, v, 12) * 28 | 0, 8 + hash2(k, v, 13) * 9 | 0, '#a0602a'); ell(g, 8, 17, 3, 2.5, '#1a1a1e'); ell(g, 24, 17, 3, 2.5, '#1a1a1e'); R(g, 2, 12, 28, 1, '#2a2a2e'); R(g, 28, 10, 2, 2, '#e0c060'); }
export function buildSources() {
  const S: Record<string, Sprite[]> = {};
  S.oak = [0, 1, 2].map(v => mk(24, 32, g => oak(g, v))); S.pine = [0, 1].map(v => mk(24, 32, g => pine(g, v, false))); S.snowpine = [0, 1].map(v => mk(24, 32, g => pine(g, v, true)));
  S.palm = [0, 1].map(v => mk(24, 32, g => palm(g, v))); S.willow = [0, 1].map(v => mk(24, 32, g => willow(g, v))); S.dead = [0, 1].map(v => mk(24, 32, g => dead(g, v)));
  S.rock = [0, 1, 2].map(v => mk(16, 16, g => rock(g, v, null))); S.iron = [0, 1].map(v => mk(16, 16, g => rock(g, v, '#d08a5a', '#a0502a'))); S.coal = [0, 1].map(v => mk(16, 16, g => rock(g, v, '#1a1a20', '#3a3a44')));
  S.sulfur = [0].map(v => mk(16, 16, g => { rock(g, v, '#f2e05a', '#b59a1e'); R(g, 6, 3, 4, 3, '#f2e05a'); })); S.crystal = [mk(16, 16, g => crystal(g))];
  S.bush = [0, 1].map(v => mk(16, 16, g => bush(g, true, v))); S.bush_empty = [0, 1].map(v => mk(16, 16, g => bush(g, false, v)));
  S.grass = [0, 1, 2].map(v => mk(16, 16, g => grass(g, v), null)); S.reed = [0, 1].map(v => mk(16, 16, g => reed(g, v), null)); S.herb = [mk(16, 16, g => herb(g))]; S.mush = [mk(16, 16, g => mush(g))];
  S.scrap = [0, 1].map(v => mk(16, 16, g => scrap(g, v))); S.wreck = [0, 1].map(v => mk(32, 20, g => wreck(g, v)));
  S.stump = [mk(16, 16, g => { ell(g, 8, 11, 4, 2.5, '#7a5232'); ell(g, 8, 10, 3, 1.5, '#c9935a'); P(g, 8, 10, '#8a5a32'); })];
  S.rubble = [mk(16, 16, g => { for (const [x, y] of [[4, 11], [8, 12], [11, 10], [6, 9]]) ell(g, x, y, 1.5, 1, '#6e7078'); })];
  S.picked = [mk(16, 16, g => { for (let k = 0; k < 4; k++) R(g, 5 + k * 2, 12, 1, 2, '#4a6a2a'); }, null)];
  return S;
}

// ===================== STRUCTURES & PROPS =====================
export function buildStructs() {
  const S: Record<string, Sprite> = {};
  S.floor_wood = mk(16, 16, g => { for (let y = 0; y < 16; y += 4) { R(g, 0, y, 16, 4, y % 8 ? '#9a6a3e' : '#8a5e36'); R(g, 0, y + 3, 16, 1, '#5a3a22'); P(g, (y * 5) % 16, y + 1, '#b0804a'); } }, null);
  S.floor_stone = mk(16, 16, g => { R(g, 0, 0, 16, 16, '#8a8a90'); for (const [x, y, w, h] of [[0, 0, 8, 8], [8, 0, 8, 8], [0, 8, 8, 8], [8, 8, 8, 8]]) { R(g, x, y, w, 1, '#a8a8b0'); R(g, x, y + h - 1, w, 1, '#5e5e66'); R(g, x + w - 1, y, 1, h, '#6a6a72'); } }, null);
  const wall = (top: string, face: string, line: string, kind: string) => mk(16, 24, g => { R(g, 0, 0, 16, 10, top); R(g, 0, 10, 16, 14, face);
    if (kind === 'wood') { for (let x = 0; x < 16; x += 4) { R(g, x, 0, 1, 24, line); R(g, x + 1, 0, 1, 10, '#b08050'); P(g, x + 2, 1, '#c89a60'); } R(g, 0, 15, 16, 1, line); }
    if (kind === 'stone') { for (let y = 10; y < 24; y += 4) { R(g, 0, y, 16, 1, line); for (let x = (y % 8 ? 0 : 4); x < 16; x += 8) R(g, x, y, 1, 4, line); } R(g, 0, 0, 16, 1, '#c0c0c8'); }
    if (kind === 'brick') { for (let y = 10; y < 24; y += 3) { R(g, 0, y, 16, 1, line); for (let x = (y % 6 ? 0 : 3); x < 16; x += 6) R(g, x, y, 1, 3, line); } R(g, 0, 0, 16, 1, '#e09a7a'); }
    R(g, 0, 9, 16, 1, 'rgba(0,0,0,0.35)'); });
  S.wall_wood = wall('#8a5e36', '#7a5230', '#4a2e1a', 'wood'); S.wall_stone = wall('#9a9aa2', '#7a7a82', '#55555e', 'stone'); S.wall_brick = wall('#b0624a', '#9a4e3a', '#5a2a1e', 'brick');
  const door = (c: string, band: string, open: boolean) => mk(16, 24, g => { R(g, 0, 0, 16, 10, '#5a3a22'); if (open) { R(g, 0, 10, 2, 14, c); R(g, 14, 10, 2, 14, c); R(g, 2, 10, 12, 14, 'rgba(20,12,20,0.6)'); } else { R(g, 1, 8, 14, 16, c); R(g, 1, 12, 14, 1, band); R(g, 1, 19, 14, 1, band); P(g, 12, 16, '#e0c060'); R(g, 7, 8, 1, 16, 'rgba(0,0,0,0.3)'); } });
  S.door_wood = door('#9a6a3e', '#4a4e56', false); S.door_wood_open = door('#9a6a3e', '#4a4e56', true); S.door_iron = door('#6a7280', '#3a3e46', false); S.door_iron_open = door('#6a7280', '#3a3e46', true);
  S.poi_door = mk(16, 24, g => { R(g, 0, 6, 16, 18, '#4a5058'); R(g, 2, 8, 12, 16, '#6a7280'); for (let y = 10; y < 24; y += 3) R(g, 2, y, 12, 1, '#3a3e46'); R(g, 12, 13, 2, 3, '#ff3a2a'); });
  S.poi_door_open = mk(16, 24, g => { R(g, 0, 6, 16, 18, '#4a5058'); R(g, 2, 8, 12, 16, '#1a141a'); R(g, 12, 13, 2, 3, '#3aff6a'); });
  S.roof_thatch = mk(16, 16, g => { for (let y = 0; y < 16; y += 3) { R(g, 0, y, 16, 3, y % 6 ? '#c8a050' : '#b08a40'); for (let x = (y % 6 ? 1 : 3); x < 16; x += 4) P(g, x, y + 2, '#8a6a2a'); } }, null);
  S.roof_tile = mk(16, 16, g => { for (let y = 0; y < 16; y += 4) for (let x = (y % 8 ? 0 : 2); x < 16; x += 4) { R(g, x, y, 4, 4, '#a84a32'); R(g, x, y + 3, 4, 1, '#6a2a1e'); P(g, x + 1, y, '#d07a5a'); } }, null);
  S.roof_tin = mk(16, 16, g => { R(g, 0, 0, 16, 16, '#7a8288'); for (let x = 0; x < 16; x += 3) R(g, x, 0, 1, 16, '#5a6268'); for (let k = 0; k < 6; k++) P(g, hash2(k, 1, 3) * 16 | 0, hash2(k, 2, 3) * 16 | 0, '#a0602a'); }, null);
  S.roof_wood = mk(16, 16, g => { for (let y = 0; y < 16; y += 2) R(g, 0, y, 16, 2, y % 4 ? '#7a5230' : '#6a4426'); for (let x = 0; x < 16; x += 5) R(g, x, 0, 1, 16, '#4a2e1a'); }, null);
  S.roof_hull = mk(16, 16, g => { for (let y = 0; y < 16; y += 3) R(g, 0, y, 16, 3, y % 6 ? '#5a3e2a' : '#4a3020'); for (let k = 0; k < 4; k++) P(g, hash2(k, 5, 3) * 16 | 0, hash2(k, 6, 3) * 16 | 0, '#2a6a6a'); }, null);
  S.roof_light = mk(16, 16, g => { for (let y = 0; y < 16; y += 4) R(g, 0, y, 16, 4, (y / 4) % 2 ? '#e0e0e0' : '#c03a2a'); }, null);
  S.bed_straw = mk(16, 16, g => { R(g, 2, 3, 12, 12, '#c8a050'); R(g, 3, 4, 10, 3, '#e8d8b0'); for (let y = 8; y < 15; y += 2) R(g, 2, y, 12, 1, '#a88a40'); R(g, 2, 9, 12, 5, '#7a4a8a'); });
  const chest = (w: number, c: string, band: string, gold?: boolean) => mk(16, 16, g => { R(g, 8 - w / 2, 5, w, 9, c); R(g, 8 - w / 2, 5, w, 3, band); R(g, 8 - w / 2, 8, w, 1, '#2a1a12'); R(g, 7, 8, 2, 2, gold ? '#ffd040' : '#c0c0c8'); if (gold) { P(g, 8 - w / 2 + 1, 6, '#ffd040'); P(g, 8 + w / 2 - 2, 6, '#ffd040'); } });
  S.chest_small = chest(12, '#9a6a3e', '#7a5230'); S.chest_large = chest(14, '#8a5a32', '#5a5e68'); S.escrow = mk(16, 16, g => { R(g, 1, 4, 14, 10, '#4a2a6a'); R(g, 1, 4, 14, 3, '#6a3a9a'); R(g, 1, 7, 14, 1, '#ffd040'); R(g, 6, 8, 4, 4, '#ffd040'); P(g, 7, 9, '#4a2a6a'); P(g, 8, 10, '#4a2a6a'); R(g, 1, 13, 14, 1, '#ffd040'); P(g, 2, 5, '#c8a0ff'); });
  S.loot = mk(16, 16, g => { R(g, 2, 4, 12, 10, '#a07040'); for (const x of [2, 13]) R(g, x, 4, 1, 10, '#6a4626'); R(g, 2, 4, 12, 1, '#c08a50'); R(g, 2, 8, 12, 1, '#6a4626'); R(g, 4, 6, 8, 1, '#5a3a22'); });
  S.loot_open = mk(16, 16, g => { R(g, 2, 6, 12, 8, '#8a5a32'); R(g, 3, 7, 10, 5, '#2a1a12'); R(g, 2, 2, 12, 3, '#a07040'); });
  S.cash = mk(16, 16, g => { R(g, 1, 4, 14, 10, '#2a2a34'); R(g, 1, 4, 14, 3, '#3a3a48'); R(g, 1, 7, 14, 1, '#6a6a7a'); R(g, 6, 8, 4, 4, '#c02a2a'); P(g, 7, 9, '#ff8a6a'); P(g, 8, 10, '#ff8a6a'); for (const x of [2, 13]) R(g, x, 5, 1, 8, '#5a5a6a'); });
  S.cash_open = mk(16, 16, g => { R(g, 1, 6, 14, 8, '#2a2a34'); R(g, 2, 7, 12, 5, '#ffd040'); for (let k = 0; k < 5; k++) P(g, 3 + k * 2, 7 + (k % 2), '#fff0a0'); R(g, 1, 2, 14, 3, '#3a3a48'); });
  S.campfire = mk(16, 16, g => { for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ell(g, 8 + Math.cos(a) * 5, 11 + Math.sin(a) * 3, 1.5, 1.2, '#8a8a90'); } R(g, 4, 10, 8, 2, '#6a4426'); R(g, 6, 9, 4, 4, '#5a3a22'); });
  S.furnace = mk(16, 24, g => { ell(g, 8, 13, 7, 9, shade('#8a8a90', '#b0b0b8', '#55555e', 60)); R(g, 1, 16, 14, 7, '#6e6e76'); R(g, 5, 15, 6, 5, '#1a1214'); R(g, 6, 3, 4, 3, '#55555e'); });
  S.furnace_lit = mk(16, 24, g => { ell(g, 8, 13, 7, 9, shade('#8a8a90', '#b0b0b8', '#55555e', 60)); R(g, 1, 16, 14, 7, '#6e6e76'); R(g, 5, 15, 6, 5, '#ff8a2a'); R(g, 6, 17, 4, 2, '#ffe070'); R(g, 6, 3, 4, 3, '#55555e'); });
  S.workbench = mk(16, 16, g => { R(g, 1, 5, 14, 5, '#9a6a3e'); R(g, 1, 5, 14, 1, '#c08a50'); R(g, 2, 10, 2, 5, '#6a4426'); R(g, 12, 10, 2, 5, '#6a4426'); R(g, 4, 3, 5, 2, '#8a8a90'); R(g, 10, 2, 1, 4, '#7a5232'); R(g, 9, 2, 3, 1, '#a0a0a8'); });
  S.research = mk(16, 16, g => { R(g, 1, 6, 14, 4, '#7a5232'); R(g, 2, 10, 2, 5, '#5a3a22'); R(g, 12, 10, 2, 5, '#5a3a22'); R(g, 3, 4, 5, 3, '#e8e0c8'); R(g, 4, 5, 3, 1, '#5a6a9a'); ell(g, 11, 5, 2, 2, '#e2c25a'); P(g, 11, 5, '#6a5a2a'); R(g, 13, 1, 1, 5, '#4a4a52'); P(g, 13, 1, '#ffe070'); });
  S.garden = mk(16, 16, g => { R(g, 1, 3, 14, 12, '#5a3a22'); for (let y = 4; y < 15; y += 3) R(g, 2, y, 12, 1, '#3e2614'); R(g, 1, 3, 14, 1, '#7a5232'); R(g, 1, 14, 14, 1, '#7a5232'); }, '#2a1a10');
  S.barrel = mk(16, 16, g => { ell(g, 8, 9, 6, 6, shade('#8a5a32', '#b07a4a', '#5a3a22', 70)); R(g, 2, 6, 12, 1, '#4a4e56'); R(g, 2, 11, 12, 1, '#4a4e56'); ell(g, 8, 4, 5, 1.5, '#2a4a6a'); });
  S.spikes = mk(16, 16, g => { for (let k = 0; k < 5; k++) { const x = 2 + k * 3; R(g, x, 9, 1, 5, '#8a6a3e'); P(g, x, 8, '#d0d0d8'); } R(g, 1, 13, 14, 1, '#5a3a22'); });
  S.barricade = mk(16, 16, g => { for (const [x1, x2] of [[1, 14], [14, 1]]) for (let k = 0; k < 14; k++) R(g, x1 + (x2 - x1) * k / 13, 4 + k * 0.7, 2, 2, '#7a5232'); R(g, 1, 11, 14, 2, '#6a4426'); P(g, 2, 4, '#d0d0d8'); P(g, 13, 4, '#d0d0d8'); });
  S.torch_post = mk(16, 24, g => { R(g, 7, 8, 2, 15, '#6a4426'); R(g, 6, 6, 4, 3, '#4a4e56'); });
  S.claim = mk(16, 32, g => { R(g, 7, 6, 3, 26, '#7a5232'); for (let y = 8; y < 30; y += 5) R(g, 6, y, 5, 1, '#c08a50'); R(g, 6, 4, 5, 3, '#e2c25a'); R(g, 10, 7, 6, 5, '#b4532a'); R(g, 10, 8, 6, 1, '#ffd040'); });
  S.vendor = mk(16, 24, g => { R(g, 4, 10, 8, 9, '#6a3a8a'); R(g, 4, 15, 8, 1, '#ffd040'); R(g, 5, 19, 2, 4, '#33304a'); R(g, 9, 19, 2, 4, '#33304a'); ell(g, 8, 7, 3.5, 3.5, '#e0b090'); R(g, 3, 3, 10, 2, '#4a2a1a'); R(g, 5, 1, 6, 3, '#4a2a1a'); R(g, 5, 3, 6, 1, '#ffd040'); P(g, 7, 7, '#2a1a2a'); P(g, 9, 7, '#2a1a2a'); R(g, 6, 9, 4, 1, '#8a6a5a'); R(g, 12, 12, 3, 4, '#c08a50'); });
  S.gen = mk(16, 16, g => { R(g, 1, 5, 14, 9, '#6a7a3a'); R(g, 1, 5, 14, 2, '#8a9a4a'); R(g, 3, 8, 4, 4, '#2a2e34'); R(g, 9, 8, 4, 2, '#c0a040'); R(g, 12, 2, 2, 4, '#4a4e56'); });
  S.evac = mk(16, 40, g => { R(g, 7, 6, 2, 34, '#8a8a90'); for (let y = 10; y < 38; y += 6) { R(g, 5, y, 6, 1, '#6a6a72'); } R(g, 4, 2, 8, 5, '#c03a2a'); R(g, 5, 3, 6, 3, '#ffd0a0'); R(g, 3, 37, 10, 3, '#5a5a62'); });
  S.bag = mk(16, 16, g => { ell(g, 8, 10, 5, 4.5, shade('#8a5a32', '#b07a4a', '#5a3a22', 80)); R(g, 6, 4, 4, 3, '#7a4a2a'); R(g, 5, 6, 6, 1, '#d0a050'); });
  S.cart = mk(28, 22, g => { R(g, 3, 4, 20, 10, '#8a5a32'); R(g, 3, 4, 20, 2, '#b07a4a'); for (let x = 5; x < 23; x += 4) R(g, x, 6, 1, 8, '#5a3a22'); ell(g, 7, 16, 4, 4, '#4a2e1a'); ell(g, 7, 16, 2, 2, '#8a8a90'); ell(g, 19, 16, 4, 4, '#4a2e1a'); ell(g, 19, 16, 2, 2, '#8a8a90'); R(g, 23, 8, 5, 1, '#6a4426'); });
  S.cargo = mk(28, 22, g => { R(g, 5, 0, 7, 5, '#a07040'); R(g, 12, 1, 6, 4, '#7d8088'); R(g, 17, 0, 5, 5, '#c9935a'); P(g, 8, 2, '#5a3a22'); }, null);
  S.icepillar = mk(16, 24, g => { for (let y = 0; y < 22; y++) { const w = 6 + Math.round(Math.sin(y * 0.7) * 1.5); R(g, 8 - w / 2, y + 1, w, 1, y < 4 ? '#ffffff' : y % 5 ? '#9ad8ff' : '#c8f0ff'); } R(g, 5, 4, 1, 14, '#e0ffff'); });
  S.rootwall = mk(16, 24, g => { for (let k = 0; k < 4; k++) for (let y = 4; y < 23; y++) P(g, 3 + k * 3 + Math.round(Math.sin(y * 0.5 + k) * 1.2), y, k % 2 ? '#5a3a22' : '#7a5232'); P(g, 6, 4, '#7ad070'); P(g, 10, 5, '#7ad070'); });
  return S;
}

// ===================== ITEM ICONS (16x16) =====================
function icon(g: G, kind: string, c1: string, c2: string) {
  switch (kind) {
    case 'log': R(g, 2, 6, 12, 5, c1); R(g, 2, 6, 12, 1, c2); ell(g, 13, 8.5, 2, 2.5, c2); P(g, 13, 8, c1); break;
    case 'stone': ell(g, 8, 9, 5, 4, shade(c1, c2, '#4e5058', 1)); break;
    case 'fiber': for (let k = 0; k < 5; k++) R(g, 4 + k * 2, 3 + (k % 2), 1, 10, k % 2 ? c1 : c2); R(g, 3, 9, 10, 1, '#c8a050'); break;
    case 'ore': ell(g, 8, 9, 5, 4, shade(c1, c1, '#2a2a30', 2)); for (const [x, y] of [[6, 8], [9, 10], [10, 7]]) P(g, x, y, c2); break;
    case 'gem': for (let y = 0; y < 8; y++) R(g, 8 - (y < 4 ? y : 8 - y), 4 + y, (y < 4 ? y : 8 - y) * 2 + 1, 1, y < 3 ? c2 : c1); break;
    case 'scrap': R(g, 3, 6, 9, 6, c1); R(g, 6, 4, 6, 3, c2); P(g, 4, 7, '#d0d0d8'); break;
    case 'gear': ell(g, 8, 8, 5, 5, c1); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; P(g, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, c1); } ell(g, 8, 8, 2, 2, c2); break;
    case 'ingot': for (let y = 0; y < 5; y++) R(g, 3 + (4 - y) * 0.5, 6 + y, 10 - (4 - y), 1, y === 0 ? c2 : c1); break;
    case 'rope': for (let k = 0; k < 4; k++) ell(g, 8, 5 + k * 2.4, 4, 1.4, k % 2 ? c1 : c2); break;
    case 'hide': ell(g, 8, 8, 6, 5, c1); P(g, 2, 4, c1); P(g, 13, 4, c1); P(g, 2, 12, c1); P(g, 13, 12, c1); ell(g, 7, 7, 2, 1.5, c2); break;
    case 'shell': ell(g, 8, 9, 6, 4, shade(c1, c2, '#2a1414', 3)); for (let x = 4; x < 13; x += 3) R(g, x, 6, 1, 6, '#2a1414'); break;
    case 'cloth': R(g, 3, 4, 10, 8, c1); R(g, 3, 4, 10, 2, c2); R(g, 3, 9, 10, 1, c2); break;
    case 'seed': for (const [x, y] of [[5, 8], [8, 6], [10, 9], [7, 11]]) { R(g, x, y, 2, 2, c1); P(g, x, y, c2); } break;
    case 'berry': for (const [x, y] of [[6, 8], [9, 7], [8, 10]]) { ell(g, x, y, 2, 2, c1); P(g, x - 1, y - 1, c2); } R(g, 8, 3, 1, 4, '#3f7a32'); break;
    case 'meat': ell(g, 7, 9, 5, 4, c1); ell(g, 6, 8, 2.5, 2, c2); R(g, 11, 5, 3, 2, '#f0e8d8'); break;
    case 'mush': R(g, 7, 9, 2, 5, '#e0d8c0'); ell(g, 8, 8, 5, 3, c1); P(g, 6, 7, c2); P(g, 10, 7, c2); break;
    case 'herb': for (const [x, y] of [[5, 6], [9, 5], [7, 9], [10, 9]]) { R(g, x, y, 2, 2, c1); P(g, x, y, c2); } R(g, 8, 8, 1, 6, '#2e6a3a'); break;
    case 'crop': ell(g, 8, 10, 4, 4, shade(c1, c2, '#6a3a12', 4)); for (let k = 0; k < 3; k++) R(g, 6 + k * 2, 3, 1, 4, '#4a9a3a'); break;
    case 'bowl': ell(g, 8, 10, 6, 3, '#7a5232'); ell(g, 8, 8, 5, 1.5, c2); P(g, 6, 5, '#e0e0e0'); P(g, 9, 4, '#e0e0e0'); break;
    case 'flask': ell(g, 8, 10, 4, 4, c1); R(g, 7, 3, 2, 4, c1); ell(g, 7, 9, 1.5, 1.5, c2); R(g, 6, 2, 4, 1, '#7a5232'); break;
    case 'kit': R(g, 3, 5, 10, 8, '#f0e8e0'); R(g, 7, 6, 2, 6, c1); R(g, 5, 8, 6, 2, c1); R(g, 6, 3, 4, 2, '#8a8a90'); break;
    case 'knife': for (let k = 0; k < 7; k++) R(g, 5 + k, 10 - k, 2, 1, c1); P(g, 11, 4, '#ffffff'); R(g, 3, 11, 3, 2, c2); break;
    case 'axe': for (let k = 0; k < 10; k++) P(g, 4 + k * 0.8, 13 - k, c2); R(g, 9, 2, 4, 5, c1); P(g, 12, 2, '#ffffff'); break;
    case 'pick': for (let k = 0; k < 10; k++) P(g, 5 + k * 0.6, 13 - k, c2); for (let k = 0; k < 11; k++) P(g, 3 + k, 4 + Math.abs(k - 5) * 0.4, c1); break;
    case 'spear': for (let k = 0; k < 12; k++) P(g, 2 + k, 14 - k, c1); R(g, 12, 2, 2, 2, c2); P(g, 14, 1, '#ffffff'); break;
    case 'sword': for (let k = 0; k < 9; k++) R(g, 6 + k, 10 - k, 1, 2, c1); P(g, 14, 2, '#ffffff'); R(g, 4, 9, 4, 1, '#a0a0a8'); R(g, 3, 11, 3, 3, c2); break;
    case 'bow': for (let k = 0; k < 12; k++) P(g, 4 + Math.sin(k / 11 * Math.PI) * 5, 2 + k, c1); R(g, 4, 2, 1, 12, c2); break;
    case 'arrow': for (let k = 0; k < 10; k++) P(g, 3 + k, 12 - k, c1); P(g, 13, 2, c2); P(g, 12, 2, c2); P(g, 13, 3, c2); R(g, 2, 12, 2, 1, '#e0e0e0'); break;
    case 'torch': R(g, 7, 6, 2, 8, c1); ell(g, 8, 5, 2.5, 3, c2); P(g, 8, 3, '#fff0a0'); break;
    case 'armor': R(g, 3, 3, 10, 10, c1); R(g, 3, 3, 3, 3, c2); R(g, 10, 3, 3, 3, c2); R(g, 6, 3, 4, 2, '#00000000'); R(g, 3, 9, 10, 1, c2); break;
    case 'cloak': for (let y = 0; y < 11; y++) R(g, 6 - y * 0.35, 3 + y, 4 + y * 0.7, 1, y % 3 ? c1 : c2); break;
    case 'mask': ell(g, 8, 8, 5, 5, c1); ell(g, 6, 7, 1.5, 1.5, '#2a3a4a'); ell(g, 10, 7, 1.5, 1.5, '#2a3a4a'); ell(g, 8, 11, 2, 2, c2); break;
    case 'helm': ell(g, 8, 8, 5, 4, c1); R(g, 3, 8, 10, 3, c1); R(g, 4, 9, 8, 1, '#2a2a30'); P(g, 6, 5, c2); break;
    case 'core': ell(g, 8, 8, 5, 5, shade(c1, c2, '#2a1414', 5)); ell(g, 8, 8, 2, 2, c2); P(g, 6, 6, '#ffffff'); for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8]]) P(g, x, y, c2); break;
    case 'relic': for (let y = 0; y < 12; y++) { const w = y < 6 ? y + 2 : 13 - y; R(g, 8 - w / 2, 2 + y, w, 1, y < 3 ? c2 : c1); } P(g, 7, 5, '#ffffff'); break;
    case 'scroll': R(g, 3, 4, 10, 8, '#e8e0c8'); R(g, 2, 3, 2, 10, c1); R(g, 12, 3, 2, 10, c1); for (let y = 6; y < 11; y += 2) R(g, 5, y, 6, 1, c1); break;
    case 'fang': for (let y = 0; y < 10; y++) R(g, 6 + y * 0.2, 3 + y, 4 - y * 0.35, 1, y < 2 ? c2 : c1); break;
    case 'card': R(g, 3, 4, 10, 8, c1); R(g, 3, 6, 10, 2, '#1a1a20'); R(g, 4, 9, 4, 2, c2); break;
    case 'can': R(g, 4, 3, 8, 11, c1); R(g, 5, 4, 2, 9, c2); R(g, 9, 1, 3, 3, '#4a4e56'); break;
    case 'coin': ell(g, 8, 8, 5, 5, c1); ell(g, 8, 8, 3.5, 3.5, c2); R(g, 7, 6, 2, 4, c1); break;
    case 'chest': R(g, 2, 5, 12, 8, c1); R(g, 2, 5, 12, 2, c2); R(g, 7, 7, 2, 3, c2); break;
    case 'cart': R(g, 2, 5, 12, 5, c1); ell(g, 5, 11, 2, 2, '#4a2e1a'); ell(g, 11, 11, 2, 2, '#4a2e1a'); break;
    default: R(g, 4, 4, 8, 8, c1);
  }
}
export function buildIcons() { const out: Record<string, Sprite> = {}; for (const [k, d] of Object.entries(ITEMS)) out[k] = mk(16, 16, g => icon(g, d.icon, d.c1, d.c2)); out.fists = mk(16, 16, g => { ell(g, 8, 9, 4, 3.5, '#eab894'); R(g, 5, 6, 6, 2, '#c08060'); }); return out; }

// pixel font for in-world numbers (3x5)
const DIG: Record<string, string> = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '-': '000000111000000' };
export function pixelText(g: G, s: string, x: number, y: number, col: string, out = '#140c14') {
  for (let pass = 0; pass < 2; pass++) { let cx = x; for (const ch of s) { const d = DIG[ch]; if (d) for (let i = 0; i < 15; i++) if (d[i] === '1') { g.fillStyle = pass ? col : out; if (pass) g.fillRect(cx + (i % 3), y + ((i / 3) | 0), 1, 1); else g.fillRect(cx + (i % 3) - 1, y + ((i / 3) | 0) - 1, 3, 3); } cx += 4; } }
}

export interface ArtSet { hero: { male: HeroSet; female: HeroSet }; cre: Record<string, Record<string, Sprite[]>>; elder: Record<string, Record<string, Sprite[]>>; src: Record<string, Sprite[]>; st: Record<string, Sprite>; icon: Record<string, Sprite> }
let ART: ArtSet | null = null;
export function getArt(): ArtSet {
  if (ART) return ART;
  ART = { hero: { male: buildHero(false), female: buildHero(true) }, cre: {}, elder: {}, src: buildSources(), st: buildStructs(), icon: buildIcons() };
  for (const k of Object.keys(CRE_DRAW)) ART.cre[k] = buildCreature(k);
  for (const k of Object.keys(ELDER_DRAW)) ART.elder[k] = buildElder(k);
  return ART;
}
