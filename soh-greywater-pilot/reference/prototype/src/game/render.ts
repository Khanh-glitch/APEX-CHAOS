// Canvas 2D renderer — draws authoritative state + observed effects. Never mutates game state.
import { TILE, WW, WH, VIEW_W, VIEW_H, T, hash2, clamp, type GameState, type RunState, type Creature, type Entity } from './core';
import { STRUCTS, ELDERS, CREATURES, ITEMS } from './catalog';
import { getWorld, SRC_KEYS, fbm } from './world';
import { effTile, sourceAt, darkness, weatherAt, isRagnarok, entsAt, buildReason, C } from './engine';
import { FX, PROJ, HAZ, activeStack } from './sim';
import { getArt, pixelText, mk, type Sprite } from './art';

const CH = 16; const chunkCache = new Map<number, HTMLCanvasElement>();
let terrSig = ''; let terrSigT = 0; let lastRunId = '';
// ---------- terrain palette ----------
type RGB = [number, number, number];
const H = (c: string): RGB => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const PAL: Record<number, RGB[]> = {
  [T.GRASS]: ['#4f8a3a', '#5a9a42', '#3f7a32', '#76b24e', '#e8d870'].map(H), [T.MEADOW]: ['#7aa84a', '#86b452', '#6a983e', '#a2cc6a', '#c08ad8'].map(H),
  [T.FOREST]: ['#3a6e30', '#33662a', '#24501e', '#4c863a', '#6a5a2a'].map(H), [T.SAND]: ['#dcc68e', '#e4d098', '#c4aa74', '#f2e4b4', '#f0e0d0'].map(H),
  [T.SNOW]: ['#e6eef6', '#dce6f0', '#b8c8dc', '#ffffff', '#a8c0e0'].map(H), [T.HILL]: ['#8a7a62', '#94846a', '#6e604c', '#a8987c', '#5e5446'].map(H),
  [T.CLIFF]: ['#6e6a66', '#7a7672', '#4e4a48', '#9a9690', '#3a3634'].map(H), [T.MARSH]: ['#4a6a3e', '#42603a', '#2e4a2a', '#6a8a4e', '#4a3e2a'].map(H),
  [T.ASH]: ['#4a4044', '#423a3e', '#2e2a2c', '#5e5458', '#c0501e'].map(H), [T.TOXIC]: ['#6a7038', '#5e6634', '#464c28', '#8a9040', '#a8b840'].map(H),
  [T.ROAD]: ['#a08060', '#9a7a58', '#7a5e40', '#b89470', '#6a5a4a'].map(H), [T.BRIDGE]: ['#8a6038', '#7a5430', '#4a2e1a', '#a87a4a', '#3a2414'].map(H),
  [T.FLOOR]: ['#9a6a3e', '#8a5e36', '#5a3a22', '#b0804a', '#7a7a7e'].map(H), [T.PWALL]: ['#4a4048', '#544a52', '#2e2830', '#6a5e66', '#7a5a4a'].map(H),
  [T.DEEP]: ['#1e3c6a', '#22426e', '#183058', '#2a5288', '#3a6aa0'].map(H), [T.SHALLOW]: ['#2e6ea0', '#3478aa', '#24609a', '#4a90c0', '#3a82a8'].map(H),
  [T.RIVER]: ['#3478a8', '#3a80ae', '#2a6a9a', '#56a0c8', '#3a82a8'].map(H), [T.LAVA]: ['#c83a1e', '#d8481e', '#6a1e14', '#ffb040', '#ff7a2a'].map(H),
  [T.BURNT]: ['#2e2826', '#36302c', '#1e1a18', '#4a423c', '#8a3a1e'].map(H), [T.ICE]: ['#b8e0f0', '#c8ecf8', '#8ac0dc', '#ffffff', '#a0d8f0'].map(H),
};
const PRIO: Record<number, number> = { [T.DEEP]: 0, [T.SHALLOW]: 1, [T.RIVER]: 1, [T.ICE]: 2, [T.LAVA]: 3, [T.SAND]: 3, [T.MARSH]: 4, [T.ASH]: 4, [T.TOXIC]: 4, [T.SNOW]: 5, [T.BURNT]: 5, [T.MEADOW]: 6, [T.GRASS]: 6, [T.FOREST]: 7, [T.HILL]: 7, [T.ROAD]: 8, [T.BRIDGE]: -1, [T.FLOOR]: -1, [T.CLIFF]: -1, [T.PWALL]: -1 };
const water = (t: number) => t === T.DEEP || t === T.SHALLOW || t === T.RIVER;
function texel(t: number, wx: number, wy: number, tx: number, ty: number, r: RunState, ctx: { s: number; n: number; e: number; w: number; zone: number; sea: number }): RGB {
  const p = PAL[t] || PAL[T.GRASS]; const h = hash2(wx, wy, t * 13 + 1); const m = fbm(wx / 48, wy / 48, 7 + t, 2);
  let c = m > 0.5 ? p[1] : p[0];
  switch (t) {
    case T.GRASS: case T.MEADOW: case T.FOREST: { const hb = hash2(wx, wy >> 1, t); if (hb < 0.11) c = p[2]; else if (hb > 0.94) c = p[3]; if (hash2(wx >> 1, wy >> 1, t + 9) > (t === T.MEADOW ? 0.988 : 0.996)) c = p[4]; if (t === T.FOREST && m < 0.36 && h < 0.3) c = p[4]; break; }
    case T.SAND: { if (h < 0.08) c = p[2]; else if (h > 0.96) c = p[3]; if (ctx.sea <= 1) c = [c[0] - 22, c[1] - 24, c[2] - 20]; if (hash2(wx >> 1, wy >> 1, 3) > 0.997) c = p[4]; break; }
    case T.SNOW: if (h < 0.06) c = p[2]; else if (h > 0.985) c = p[3]; if (m < 0.42 && hash2(wx, wy >> 1, 5) < 0.18) c = p[4]; break;
    case T.HILL: if (h < 0.1) c = p[2]; else if (h > 0.93) c = p[3]; if (hash2(wx >> 1, wy >> 1, 4) > 0.985) c = p[4]; break;
    case T.MARSH: { if (m < 0.38) c = p[4]; if (h < 0.1) c = p[2]; if (fbm(wx / 14, wy / 14, 99, 2) > 0.66) c = H('#3a5a5a'); break; }
    case T.ASH: if (h < 0.1) c = p[2]; else if (h > 0.95) c = p[3]; if (hash2(wx, wy, 11) > 0.996) c = p[4]; break;
    case T.TOXIC: { if (h < 0.1) c = p[2]; if (fbm(wx / 16, wy / 16, 55, 2) > 0.68) c = p[4]; if (hash2(wx, wy >> 2, 2) > 0.985) c = p[2]; break; }
    case T.ROAD: { if (h < 0.12) c = p[2]; else if (h > 0.95) c = p[3]; if (hash2(wx >> 1, wy >> 1, 6) > 0.98) c = p[4]; const lx = wx % 16, ly = wy % 16; if ((ctx.n !== T.ROAD && ctx.n !== T.BRIDGE && ly < 1) || (ctx.s !== T.ROAD && ctx.s !== T.BRIDGE && ly > 14) || (ctx.w !== T.ROAD && ctx.w !== T.BRIDGE && lx < 1) || (ctx.e !== T.ROAD && ctx.e !== T.BRIDGE && lx > 14)) c = p[2]; break; }
    case T.BRIDGE: { const horiz = (ctx.e === T.BRIDGE || ctx.e === T.ROAD || ctx.w === T.BRIDGE || ctx.w === T.ROAD) && !(ctx.n === T.BRIDGE || ctx.s === T.BRIDGE); const a = horiz ? wx % 16 : wy % 16, b = horiz ? wy % 16 : wx % 16;
      c = (a % 4 === 3) ? p[2] : (Math.floor(a / 4) % 2 ? p[0] : p[1]); if (h > 0.95) c = p[3];
      const sideA = horiz ? ctx.n : ctx.w, sideB = horiz ? ctx.s : ctx.e; if ((b < 2 && water(sideA)) || (b > 13 && water(sideB))) c = b === 0 || b === 15 ? p[4] : p[3]; break; }
    case T.FLOOR: { if (ctx.zone === 7) { c = h < 0.1 ? H('#5e5e62') : m > 0.5 ? H('#7a7a7e') : H('#727276'); if (hash2(wx >> 2, wy, 8) > 0.97) c = H('#4e4e52'); } else { const ly = wy % 16; c = ly % 4 === 3 ? p[2] : (Math.floor(ly / 4) % 2 ? p[0] : p[1]); if ((wx + Math.floor(ly / 4) * 5) % 16 === 0) c = p[2]; if (h > 0.96) c = p[3]; } break; }
    case T.PWALL: case T.CLIFF: { const ly = wy % 16; const face = ctx.s !== t && ctx.s !== T.PWALL && ctx.s !== T.CLIFF;
      if (t === T.CLIFF) { if (h < 0.12) c = p[2]; else if (h > 0.93) c = p[3]; if (face && ly >= 7) { c = (wx % 5 === 0 || hash2(wx, wy, 3) < 0.08) ? p[4] : (ly % 3 ? H('#5a5450') : H('#625c58')); if (ly === 15) c = p[4]; } if (ly === 0 && ctx.n !== T.CLIFF) c = p[3]; }
      else { const metal = ctx.zone === 7; c = metal ? (h < 0.15 ? H('#3a4048') : H('#4a5058')) : p[0]; if (face && ly >= 6) { c = metal ? (wx % 4 === 0 ? H('#3a4048') : H('#6a7280')) : (ly % 3 === 0 || (wx + (Math.floor(ly / 3) % 2) * 3) % 6 === 0) ? H('#4a3428') : p[4]; } if (ly === 5 && face) c = p[2]; }
      break; }
    case T.DEEP: { const wv = Math.sin(wx * 0.15 + Math.sin(wy * 0.09) * 2 + wy * 0.05); c = wv > 0.92 ? p[3] : m > 0.5 ? p[1] : p[0]; if (h < 0.04) c = p[2]; break; }
    case T.SHALLOW: case T.RIVER: { const fresh = getWorld().fresh[ty * WW + tx]; const pp = fresh ? PAL[T.RIVER] : p; const wv = Math.sin(wx * 0.22 + wy * 0.08 + Math.sin(wy * 0.2)); c = wv > 0.9 ? pp[3] : m > 0.5 ? pp[1] : pp[0]; if (!fresh && ctx.sea === 0) { /* sea */ } if (h < 0.05) c = pp[2]; break; }
    case T.LAVA: { const v = fbm(wx / 6, wy / 6, 3, 2); c = v > 0.62 ? p[3] : v > 0.5 ? p[4] : v < 0.3 ? p[2] : p[0]; break; }
    case T.BURNT: if (h < 0.15) c = p[2]; else if (h > 0.93) c = p[3]; if (hash2(wx, wy, 7) > 0.993) c = p[4]; break;
    case T.ICE: { if (h > 0.97 || (Math.abs(((wx + wy * 0.6) % 23)) < 0.7)) c = p[3]; else if (h < 0.08) c = p[2]; break; }
  }
  return c;
}
function renderChunk(r: RunState, cx: number, cy: number) {
  const cv = document.createElement('canvas'); cv.width = CH * TILE; cv.height = CH * TILE; const g = cv.getContext('2d')!;
  const img = g.createImageData(cv.width, cv.height); const buf = new Uint32Array(img.data.buffer); const w = getWorld();
  const tt = (x: number, y: number) => (x < 0 || y < 0 || x >= WW || y >= WH) ? T.DEEP : effTile(r, x, y);
  for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
    const tx = cx * CH + i, ty = cy * CH + j; const t = tt(tx, ty);
    const ctx = { n: tt(tx, ty - 1), s: tt(tx, ty + 1), e: tt(tx + 1, ty), w: tt(tx - 1, ty), zone: w.zone[ty * WW + tx] ?? 0, sea: w.seaDist[ty * WW + tx] ?? 9 };
    const pr = PRIO[t] ?? 0; const nb: [number, number][] = [[ctx.w, 0], [ctx.e, 1], [ctx.n, 2], [ctx.s, 3]];
    const tallN = ctx.n === T.CLIFF || ctx.n === T.PWALL;
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const wx = tx * 16 + px, wy = ty * 16 + py; let use = t, uc = ctx;
      if (pr >= 0) { const ds = [px, 15 - px, py, 15 - py]; let bd = 5;
        for (const [nt, k] of nb) { const np = PRIO[nt] ?? -1; if (np > pr && ds[k] < 4 && ds[k] < bd) { const f = (1 - ds[k] / 4) * 0.9 - (nt === T.ROAD ? 0.35 : 0); if (hash2(wx, wy, 77 + nt) < f) { use = nt; bd = ds[k]; } } }
        if (use !== t) uc = { ...ctx, n: use, s: use, e: use, w: use };
      }
      let c = texel(use, wx, wy, tx, ty, r, uc);
      if (tallN && t !== T.CLIFF && t !== T.PWALL && py < 4) { const k = 0.55 + py * 0.11; c = [c[0] * k, c[1] * k, c[2] * k]; }
      if (water(t) && !water(use)) { /* fringe land into water */ }
      buf[(j * 16 + py) * cv.width + i * 16 + px] = (255 << 24) | ((c[2] & 255) << 16) | ((c[1] & 255) << 8) | (c[0] & 255);
    }
  }
  g.putImageData(img, 0, 0); return cv;
}
function getChunk(r: RunState, cx: number, cy: number) { const k = cy * 100 + cx; let c = chunkCache.get(k); if (!c) { c = renderChunk(r, cx, cy); chunkCache.set(k, c); } return c; }
function syncTerrain(r: RunState, now: number) {
  if (r.id !== lastRunId) { chunkCache.clear(); lastRunId = r.id; terrSig = ''; }
  if (now - terrSigT < 300) return; terrSigT = now;
  const sig = Object.keys(r.terrain).map(k => k + ':' + r.terrain[+k].t).join(',');
  if (sig === terrSig) return; const old = new Set(terrSig.split(',')), nw = new Set(sig.split(','));
  for (const s of [...old, ...nw]) { if (!s || (old.has(s) && nw.has(s))) continue; const i = +s.split(':')[0]; const tx = i % WW, ty = (i / WW) | 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) chunkCache.delete((((ty + dy) / CH) | 0) * 100 + (((tx + dx) / CH) | 0)); }
  terrSig = sig;
}
export function resetRenderCaches() { chunkCache.clear(); lastRunId = ''; }

// ---------- particles ----------
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; s: number; g: number; kind?: string; text?: string; a?: number; reach?: number; arc?: number; x1?: number; y1?: number; key?: string; z?: number }
const PARTS: Part[] = []; const ARCS: Part[] = []; const TEXTS: Part[] = [];
const shakeT = new Map<number, number>();
const add = (p: Partial<Part>) => { if (PARTS.length < 900) PARTS.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 400, col: '#fff', s: 1, g: 0, ...p } as Part); };
const burst = (x: number, y: number, n: number, cols: string[], sp = 60, g = 120, life = 450, s = 1) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random()); add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.5, col: cols[i % cols.length], max: life * (0.6 + Math.random() * 0.6), g, s }); } };
const MATC: Record<string, string[]> = { wood: ['#c9935a', '#8a5a32', '#e0b070', '#6aa84a'], stone: ['#b9bcc4', '#7d8088', '#ffffff'], ore: ['#d08a5a', '#7d8088', '#ffe0a0'], plant: ['#8ac25a', '#5a9a3c', '#e05a7a'], scrap: ['#c0a07a', '#ffd070', '#6f7378', '#ffffff'] };
const SURFC: Record<number, string[]> = { [T.SNOW]: ['#ffffff', '#c8d8e8'], [T.SAND]: ['#e8d8a0', '#c4aa74'], [T.MARSH]: ['#4a3e2a', '#3a5a5a'], [T.SHALLOW]: ['#a0d0ff', '#ffffff'], [T.RIVER]: ['#a0d0ff', '#ffffff'], [T.ASH]: ['#6a5a5a', '#3a3236'], [T.ROAD]: ['#b89470', '#9a7a58'] };
export let shake = 0; export let flash = 0; export const banners: { text: string; sub: string; t: number }[] = [];
export function consumeFX(onFx: (e: any) => void) {
  while (FX.length) {
    const e = FX.shift(); onFx(e);
    switch (e.type) {
      case 'slash': ARCS.push({ x: e.x, y: e.y, a: e.a, reach: e.reach, arc: e.arc, life: 0, max: 150, key: e.key } as Part); break;
      case 'chip': burst(e.x, e.y - 6, e.depleted ? 14 : 7, MATC[e.mat] || MATC.wood, 55, 160, 500); shakeT.set(Math.floor(e.x / 16) + Math.floor(e.y / 16) * WW, 160); break;
      case 'fell': burst(e.x, e.y - 14, 16, ['#6aa84a', '#3f7a32', '#c9935a'], 70, 60, 900); break;
      case 'clank': burst(e.x, e.y - 6, e.soft ? 2 : 5, ['#ffffff', '#ffe070'], 80, 200, 220); break;
      case 'mhit': burst(e.x, e.y - 6, e.big ? 12 : 8, ['#ffffff', '#ff5a4a', '#a01e1e'], 90, 220, 380); TEXTS.push({ x: e.x, y: e.y - 14, vx: 0, vy: -28, life: 0, max: 700, col: '#ffffff', text: String(e.n) } as Part); break;
      case 'phit': burst(e.x, e.y - 8, 8, ['#ff3a3a', '#ffffff', '#a01e1e'], 80, 200, 350); TEXTS.push({ x: e.x, y: e.y - 18, vx: 0, vy: -24, life: 0, max: 800, col: '#ff5a5a', text: '-' + e.n } as Part); flash = Math.max(flash, 0.25); break;
      case 'mdeath': burst(e.x, e.y - 6, 18, e.type === 'crawler' ? ['#ffd070', '#6f7378', '#ffffff'] : ['#3a2a2a', '#a01e1e', '#e0e0e0'], 70, 120, 700); break;
      case 'pickup': TEXTS.push({ x: e.x, y: e.y - 20, vx: 0, vy: -20, life: 0, max: 900, col: '#ffe27a', text: '+' + e.q, key: e.key } as Part); break;
      case 'step': { const c = SURFC[e.t]; if (c) burst(e.x, e.y, 2, c, 14, 20, 300); break; }
      case 'roll': burst(e.x, e.y + 6, 6, ['#c8b890', '#a89870'], 30, 20, 350); break;
      case 'boom': burst(e.x, e.y, e.small ? 14 : 34, ['#fff0a0', '#ffb040', '#ff6a1e', '#5a4a4a'], e.small ? 60 : 110, 40, 700, 2); ARCS.push({ x: e.x, y: e.y, life: 0, max: 300, kind: 'ring', reach: e.small ? 18 : 30 } as Part); break;
      case 'bolt': ARCS.push({ x: e.x0, y: e.y0, x1: e.x1, y1: e.y1, life: 0, max: 180, kind: 'bolt' } as Part); flash = Math.max(flash, 0.15); break;
      case 'lightning': ARCS.push({ x: e.x, y: e.y - 300, x1: e.x, y1: e.y, life: 0, max: 260, kind: 'bolt' } as Part); flash = 0.7; shake = Math.max(shake, 3); break;
      case 'ignite': burst(e.x, e.y - 12, 10, ['#ffb040', '#ff6a1e', '#fff0a0'], 30, -40, 700); break;
      case 'steam': burst(e.x, e.y - 10, 8, ['#e0e8f0', '#b0b8c0'], 20, -30, 900, 2); break;
      case 'scorch': burst(e.x, e.y, 4, ['#3a302a', '#8a3a1e'], 20, -10, 500); break;
      case 'cast': burst(e.x, e.y, 16, e.core === 'fire' ? ['#ffb040', '#fff0a0'] : e.core === 'frost' ? ['#c8f0ff', '#ffffff'] : e.core === 'storm' ? ['#c0e0ff', '#ffffff'] : ['#e0c080', '#7a5a32'], 70, 0, 400); break;
      case 'fizzle': burst(e.x, e.y - 8, 8, ['#8a8a9a', '#c0c0d0'], 30, -20, 500); break;
      case 'dodge': burst(e.x, e.y - 6, 5, ['#ffffff', '#c0e0ff'], 40, 0, 250); break;
      case 'structhit': burst(e.x, e.y - 6, 6, ['#c9935a', '#8a8a90'], 50, 150, 400); break;
      case 'structbreak': burst(e.x, e.y - 6, 20, ['#c9935a', '#8a8a90', '#5a3a22'], 80, 150, 700); break;
      case 'drain': ARCS.push({ x: e.x0, y: e.y0 - 10, x1: e.x1, y1: e.y1 - 10, life: 0, max: 600, kind: 'drain' } as Part); break;
      case 'emerge': burst(e.x, e.y, e.big ? 26 : 12, ['#7a6a50', '#a09070', '#5a4a3a'], e.big ? 90 : 50, 150, 600); break;
      case 'hazfire': if (e.style === 'meteor') burst(e.x, e.y, 18, ['#fff0a0', '#ff6a1e', '#5a4a4a'], 80, 60, 600); else if (e.kind === 'circle') burst(e.x, e.y, 8, hazCol(e.style, true), 50, 80, 450); break;
      case 'shake': shake = Math.max(shake, e.m); break;
      case 'banner': banners.push({ text: e.text, sub: e.sub, t: 0 }); break;
      case 'tell': add({ x: e.x, y: e.y - 4, vx: 0, vy: -10, max: 500, col: '#ff3a2a', s: 1, g: 0, kind: 'bang' }); break;
      case 'sniff': add({ x: e.x, y: e.y, vx: 0, vy: -8, max: 900, col: '#ffe070', s: 1, g: 0, kind: 'q' }); break;
      case 'stun': for (let i = 0; i < 3; i++) add({ x: e.x, y: e.y, vx: 0, vy: 0, max: 900, col: '#ffe070', s: 1, g: 0, kind: 'star', a: i * 2.1 }); break;
      case 'eat': burst(e.x, e.y - 8, 6, ['#8ae05a', '#ffffff'], 25, -30, 500); break;
      case 'break': burst(e.x, e.y - 8, 12, ['#a0a0a8', '#7a5232'], 70, 160, 600); break;
    }
  }
}
function hazCol(style: string, arr = false): any { const m: Record<string, string[]> = { frost: ['#bff0ff', '#ffffff'], magma: ['#ff7a2a', '#ffe070'], meteor: ['#ff7a2a', '#ffe070'], bog: ['#a0d050', '#e0f080'], pool: ['#6a9a2a', '#a0d050'], grove: ['#8ae05a', '#c9935a'], root: ['#8ae05a', '#7a5232'], seed: ['#d0a050', '#8ae05a'], tide: ['#6ad0ff', '#ffffff'], rust: ['#ff5a3a', '#ffd0a0'], beam: ['#ff3a2a', '#ffffff'], steam: ['#e0e8f0', '#ffffff'], erupt: ['#c0603a', '#ffe070'], spike: ['#c9a070', '#ffffff'], frostnova: ['#c8f0ff', '#ffffff'], burn: ['#ff6a1e', '#ffd070'] }; const c = m[style] || ['#ff5a4a', '#ffffff']; return arr ? c : c[0]; }

// ---------- helpers ----------
const whiteCache = new WeakMap<Sprite, Sprite>();
function white(s: Sprite) { let w = whiteCache.get(s); if (!w) { w = mk(s.width, s.height, g => { g.drawImage(s, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, s.width, s.height); }, null); whiteCache.set(s, w); } return w; }
const shadowCache = new Map<number, Sprite>();
function shadow(g: CanvasRenderingContext2D, x: number, y: number, rw: number) { let s = shadowCache.get(rw); if (!s) { const SW = rw * 2 + 2, SH = Math.max(3, rw) + 2; s = mk(SW, SH, gg => { gg.fillStyle = 'rgba(10,8,20,0.32)'; const ry = Math.max(1.5, rw * 0.45); for (let yy = 0; yy < SH; yy++) for (let xx = 0; xx < SW; xx++) { const nx = (xx + 0.5 - rw - 1) / rw, ny = (yy + 0.5 - (ry + 1)) / ry; if (nx * nx + ny * ny <= 1) gg.fillRect(xx, yy, 1, 1); } }, null); shadowCache.set(rw, s); } g.drawImage(s, Math.round(x - rw - 1), Math.round(y - s.height / 2)); }
function pixCircle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, step = 1) { g.fillStyle = col; const n = Math.max(12, Math.floor(r * 6.3 / step)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); } }
function pixLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, w = 1) { g.fillStyle = col; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) { const t = i / Math.max(1, n); g.fillRect(Math.round(x0 + (x1 - x0) * t - (w >> 1)), Math.round(y0 + (y1 - y0) * t - (w >> 1)), w, w); } }

// ---------- camera ----------
export const cam = { x: 0, y: 0, init: false };
let mapCanvas: HTMLCanvasElement | null = null;
export function getMapCanvas() {
  if (mapCanvas) return mapCanvas; const w = getWorld(); mapCanvas = document.createElement('canvas'); mapCanvas.width = WW; mapCanvas.height = WH; const g = mapCanvas.getContext('2d')!; const img = g.createImageData(WW, WH);
  for (let i = 0; i < WW * WH; i++) { const t = w.tiles[i]; let c = (PAL[t] || PAL[T.GRASS])[0]; if (w.src[i] >= 0 && ['oak', 'pine', 'snowpine', 'palm', 'willow'].includes(SRC_KEYS[w.src[i]])) c = [c[0] * 0.75, c[1] * 0.8, c[2] * 0.75]; img.data.set([c[0], c[1], c[2], 255], i * 4); }
  g.putImageData(img, 0, 0); return mapCanvas;
}

export interface RenderOpts { buildType: string | null; reclaim: boolean; mouseX: number; mouseY: number; target: { x: number; y: number } | null; time: number }
// ---------- main draw ----------
export function draw(g: CanvasRenderingContext2D, gs: GameState, now: number, dtMs: number, o: RenderOpts) {
  const r = gs.run!; const A = getArt(); const w = getWorld(); const p = r.player; const time = o.time;
  syncTerrain(r, now);
  // camera
  const tx0 = clamp(p.x - VIEW_W / 2, 0, WW * TILE - VIEW_W), ty0 = clamp(p.y - VIEW_H / 2 - 6, 0, WH * TILE - VIEW_H);
  if (!cam.init) { cam.x = tx0; cam.y = ty0; cam.init = true; } cam.x += (tx0 - cam.x) * Math.min(1, dtMs / 90); cam.y += (ty0 - cam.y) * Math.min(1, dtMs / 90);
  shake = Math.max(0, shake - dtMs * 0.02); const sx = shake > 0.3 ? Math.round((Math.random() - 0.5) * shake) : 0, sy = shake > 0.3 ? Math.round((Math.random() - 0.5) * shake) : 0;
  const cx = Math.round(cam.x) + sx, cy = Math.round(cam.y) + sy;
  g.save(); g.translate(-cx, -cy);
  // terrain chunks
  const c0 = Math.floor(cx / (CH * TILE)), c1 = Math.floor((cx + VIEW_W) / (CH * TILE)), r0 = Math.floor(cy / (CH * TILE)), r1 = Math.floor((cy + VIEW_H) / (CH * TILE));
  for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) if (i >= 0 && j >= 0 && i < Math.ceil(WW / CH) && j < Math.ceil(WH / CH)) g.drawImage(getChunk(r, i, j), i * CH * TILE, j * CH * TILE);
  const vx0 = Math.max(0, Math.floor(cx / TILE) - 1), vx1 = Math.min(WW - 1, Math.floor((cx + VIEW_W) / TILE) + 1), vy0 = Math.max(0, Math.floor(cy / TILE) - 1), vy1 = Math.min(WH - 1, Math.floor((cy + VIEW_H) / TILE) + 3);
  // animated water / lava
  for (let ty = vy0; ty <= vy1; ty++) for (let tx = vx0; tx <= vx1; tx++) {
    const t = effTile(r, tx, ty); const X = tx * 16, Y = ty * 16;
    if (water(t)) {
      const ph = Math.floor(time / 420); for (let k = 0; k < 2; k++) { const hx = hash2(tx * 3 + k, ty, ph), hy = hash2(tx, ty * 3 + k, ph + 1); if (hash2(tx, ty, ph + k) > 0.55) { g.fillStyle = 'rgba(220,240,255,0.7)'; g.fillRect(X + (hx * 14 | 0), Y + (hy * 15 | 0), 2, 1); } }
      const land = (dx: number, dy: number) => { const n = effTile(r, tx + dx, ty + dy); return !water(n) && n !== T.ICE; };
      const wave = Math.sin(time / 520 + tx * 0.7 + ty * 0.3); const off = Math.round(1.5 + wave * 1.5);
      g.fillStyle = 'rgba(235,248,255,0.85)';
      for (let k = 0; k < 16; k++) { if (hash2(tx * 16 + k, ty, Math.floor(time / 900)) < 0.25) continue;
        if (land(0, -1)) g.fillRect(X + k, Y + off, 1, 1); if (land(0, 1)) g.fillRect(X + k, Y + 15 - off, 1, 1); if (land(-1, 0)) g.fillRect(X + off, Y + k, 1, 1); if (land(1, 0)) g.fillRect(X + 15 - off, Y + k, 1, 1); }
    } else if (t === T.LAVA) { const pulse = 0.12 + Math.sin(time / 400 + tx + ty) * 0.08; g.fillStyle = `rgba(255,190,60,${pulse})`; g.fillRect(X, Y, 16, 16); if (hash2(tx, ty, Math.floor(time / 300)) > 0.8) { g.fillStyle = '#fff0a0'; g.fillRect(X + (hash2(tx, ty, 1) * 14 | 0), Y + (hash2(ty, tx, 2) * 14 | 0), 1, 1); } }
  }
  // footprints
  for (const tr of r.traces) { if (tr.x < cx - 4 || tr.x > cx + VIEW_W + 4 || tr.y < cy - 4 || tr.y > cy + VIEW_H + 4) continue; const a = clamp(tr.life / 60000, 0.12, 0.6);
    const col = tr.s === T.SNOW ? `rgba(120,140,180,${a + 0.2})` : tr.s === T.SAND ? `rgba(150,120,80,${a})` : tr.s === T.MARSH ? `rgba(30,30,20,${a + 0.1})` : tr.s === T.ASH ? `rgba(20,16,18,${a})` : tr.s === T.ROAD ? `rgba(90,60,40,${a * 0.7})` : `rgba(30,60,25,${a * 0.8})`;
    g.fillStyle = col; const px = Math.round(tr.x + Math.cos(tr.a + Math.PI / 2) * 1.5 * ((tr.t / 100) % 2 > 1 ? 1 : -1)), py = Math.round(tr.y); g.fillRect(px, py, 2, 1); g.fillRect(px, py - 1, 1, 1); }
  // ground layer structures
  const ents = Object.values(r.entities);
  for (const e of ents) { if (e.kind !== 'struct') continue; if (e.x < cx - 32 || e.x > cx + VIEW_W + 32 || e.y < cy - 32 || e.y > cy + VIEW_H + 48) continue; const d = STRUCTS[e.type!];
    if (d.layer === 'floor') g.drawImage(A.st[e.type!], e.x - 8, e.y - 8);
    if (e.type === 'garden') { g.drawImage(A.st.garden, e.x - 8, e.y - 8); const gd = e.garden!; if (gd.water > 0) { g.fillStyle = 'rgba(40,60,90,0.35)'; g.fillRect(e.x - 7, e.y - 5, 14, 11); } if (gd.crop) { const st = gd.growth; for (let k = 0; k < 3; k++) { const X = e.x - 5 + k * 5, Y = e.y + 3; const hgt = 1 + Math.round(st * 5); g.fillStyle = '#4a9a3a'; g.fillRect(X, Y - hgt, 1, hgt); if (st > 0.4) { g.fillStyle = '#6ac04a'; g.fillRect(X - 1, Y - hgt, 3, 1); } if (st >= 1) { g.fillStyle = '#f0b050'; g.fillRect(X - 1, Y - 1, 3, 2); } } } }
    if (e.type === 'spikes') g.drawImage(A.st.spikes, e.x - 8, e.y - 8);
    if (e.type === 'claim') { const R = 6 * 16; g.fillStyle = 'rgba(255,208,64,0.5)'; for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2 + time / 4000; g.fillRect(Math.round(e.x + Math.cos(a) * R), Math.round(e.y + Math.sin(a) * R), 2, 1); } }
  }
  // hazard telegraphs (ground)
  for (const h of HAZ) drawHaz(g, h, time);
  // y-sorted drawables
  const list: { y: number; f: () => void }[] = [];
  for (let ty = vy0; ty <= vy1 + 1 && ty < WH; ty++) for (let tx = vx0; tx <= vx1; tx++) {
    if (w.src[ty * WW + tx] < 0) continue; const s = sourceAt(r, tx, ty, now); if (!s) continue; if (s.stock <= 0 && entsAt(r, tx, ty).length) continue; list.push({ y: ty * 16 + 14, f: () => drawSource(g, r, s, tx, ty, time, p) });
  }
  for (const e of ents) { if (e.x < cx - 40 || e.x > cx + VIEW_W + 40 || e.y < cy - 20 || e.y > cy + VIEW_H + 60) continue; if (e.kind === 'struct' && ['floor', 'roof'].includes(STRUCTS[e.type!].layer)) continue; if (e.type === 'garden' || e.type === 'spikes') continue; list.push({ y: e.y + (e.kind === 'drop' ? -2 : 6), f: () => drawEntity(g, r, e, time, now) }); }
  for (const m of r.creatures) { if (m.x < cx - 40 || m.x > cx + VIEW_W + 40 || m.y < cy - 40 || m.y > cy + VIEW_H + 60) continue; list.push({ y: m.y + 4, f: () => drawCreature(g, m, time) }); }
  list.push({ y: p.y + 4, f: () => drawPlayer(g, gs, time) });
  // POI terrain walls need y-sorting vs player? They are flat tiles; fine.
  list.sort((a, b) => a.y - b.y); for (const d of list) d.f();
  // temporary terrain sprites (ice pillars, root cages)
  for (const k in r.terrain) { const m: any = r.terrain[+k]; if (!m.until || m.t !== T.PWALL) continue; const i = +k; const X = (i % WW) * 16, Y = ((i / WW) | 0) * 16; if (X < cx - 20 || X > cx + VIEW_W || Y < cy - 30 || Y > cy + VIEW_H) continue; g.drawImage(m.by === 'grove' ? A.st.rootwall : A.st.icepillar, X, Y - 8); }
  // projectiles
  for (const pr of PROJ) { if (pr.delay && pr.delay > 0) continue; drawProj(g, pr, time); }
  // roofs
  const inside = isUnderRoof(r, p.x, p.y);
  for (const b of w.buildings) { if ((b.x + b.w) * 16 < cx || b.x * 16 > cx + VIEW_W || (b.y + b.h) * 16 < cy - 16 || b.y * 16 > cy + VIEW_H) continue; const pin = p.x > b.x * 16 && p.x < (b.x + b.w) * 16 && p.y > b.y * 16 && p.y < (b.y + b.h) * 16 + 4;
    g.globalAlpha = pin ? 0.12 : 1; const spr = A.st['roof_' + b.roof] || A.st.roof_wood; for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) g.drawImage(spr, (b.x + x) * 16, (b.y + y) * 16 - 10);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(b.x * 16, (b.y + b.h) * 16 - 10, b.w * 16, 2); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(b.x * 16, b.y * 16 - 10 + Math.floor(b.h * 8), b.w * 16, 1); g.globalAlpha = 1; }
  for (const e of ents) { if (e.kind !== 'struct' || STRUCTS[e.type!].layer !== 'roof') continue; if (e.x < cx - 20 || e.x > cx + VIEW_W + 20 || e.y < cy - 20 || e.y > cy + VIEW_H + 30) continue; g.globalAlpha = inside && Math.hypot(e.x - p.x, e.y - p.y) < 120 ? 0.15 : 1; g.drawImage(A.st[e.type!], e.x - 8, e.y - 18); if (!entsAt(r, e.tx!, e.ty! + 1).some(o => o.kind === 'struct' && STRUCTS[o.type!].layer === 'roof')) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(e.x - 8, e.y - 3, 16, 2); } g.globalAlpha = 1; }
  // particles & arcs
  drawFx(g, dtMs, time);
  // build ghost / target
  if (o.buildType || o.reclaim) { const tx = Math.floor(o.mouseX / 16), ty = Math.floor(o.mouseY / 16);
    if (o.buildType) { const why = buildReason(gs, o.buildType, tx, ty); const spr = A.st[o.buildType]; g.globalAlpha = 0.65; if (spr) g.drawImage(spr, tx * 16 + 8 - spr.width / 2, ty * 16 + 16 - spr.height + (STRUCTS[o.buildType].layer === 'roof' ? -2 : 0)); g.globalAlpha = 1; g.strokeStyle = why ? '#ff4a3a' : '#7aff6a'; g.lineWidth = 1; g.strokeRect(tx * 16 + 0.5, ty * 16 + 0.5, 15, 15); }
    else { g.strokeStyle = '#ffb040'; g.setLineDash([2, 2]); g.strokeRect(tx * 16 + 0.5, ty * 16 + 0.5, 15, 15); g.setLineDash([]); } }
  if (o.target) { const bob = Math.round(Math.sin(time / 160) * 1.5); g.fillStyle = '#ffe27a'; const X = Math.round(o.target.x), Y = Math.round(o.target.y) - 20 + bob; g.fillRect(X - 2, Y, 5, 1); g.fillRect(X - 1, Y + 1, 3, 1); g.fillRect(X, Y + 2, 1, 1); }
  g.restore();
  // weather & light (screen space)
  drawWeather(g, r, now, time, cx, cy);
  drawLight(g, r, now, time, cx, cy, ents);
  if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash})`; g.fillRect(0, 0, VIEW_W, VIEW_H); flash = Math.max(0, flash - dtMs / 400); }
  if (p.hp < 30 && !p.dead) { const a = (1 - p.hp / 30) * (0.25 + Math.sin(time / 200) * 0.08); g.fillStyle = `rgba(160,0,0,${a})`; g.fillRect(0, 0, VIEW_W, 6); g.fillRect(0, VIEW_H - 6, VIEW_W, 6); g.fillRect(0, 0, 6, VIEW_H); g.fillRect(VIEW_W - 6, 0, 6, VIEW_H); }
}
function isUnderRoof(r: RunState, x: number, y: number) { return entsAt(r, Math.floor(x / 16), Math.floor(y / 16)).some(e => e.kind === 'struct' && STRUCTS[e.type!].layer === 'roof'); }

function drawSource(g: CanvasRenderingContext2D, r: RunState, s: NonNullable<ReturnType<typeof sourceAt>>, tx: number, ty: number, time: number, p: any) {
  const A = getArt(); const X = tx * 16, Y = ty * 16; const v = (hash2(tx, ty, 5) * 10) | 0; const key = s.key;
  const k = ty * WW + tx; let sh = shakeT.get(k) || 0; if (sh > 0) { shakeT.set(k, sh - 16); } const jx = sh > 0 ? Math.round(Math.sin(sh / 12) * 1.5) : 0;
  const depleted = s.stock <= 0;
  const art = s.def.art; const tall = s.def.tall;
  if (tall) {
    if (depleted) { g.drawImage(A.src.stump[0], X, Y); return; }
    const arr = A.src[art]; const spr = arr[v % arr.length]; shadow(g, X + 8, Y + 14, 8);
    const ox = X + 8 - 12 + jx + ((hash2(tx, ty, 9) * 3) | 0) - 1, oy = Y + 16 - 32;
    const covers = p.x > ox + 2 && p.x < ox + 22 && p.y > oy + 2 && p.y < Y + 6 && p.y < Y + 12;
    if (covers) g.globalAlpha = 0.5; g.drawImage(spr, ox, oy); g.globalAlpha = 1;
    if (s.fire && s.fire > r.clock.simMs) { for (let i = 0; i < 3; i++) { const fx0 = ox + 6 + hash2(i, Math.floor(time / 90), tx) * 12, fy0 = oy + 6 + hash2(i, Math.floor(time / 90), ty) * 16; g.fillStyle = i % 2 ? '#ffb040' : '#ff6a1e'; g.fillRect(fx0 | 0, fy0 | 0, 2, 3); g.fillStyle = '#fff0a0'; g.fillRect(fx0 | 0, (fy0 | 0) + 1, 1, 1); } if (Math.random() < 0.3) add({ x: ox + 12, y: oy + 8, vx: (Math.random() - 0.5) * 10, vy: -20, col: '#5a4a4a', max: 1200, s: 2, g: -5 }); }
    return;
  }
  let spr: Sprite;
  if (art === 'bush') spr = depleted ? A.src.bush_empty[v % 2] : A.src.bush[v % 2];
  else if (['grass', 'reed', 'herb', 'mush'].includes(art)) { if (depleted) { g.drawImage(A.src.picked[0], X, Y); return; } const arr = A.src[art]; spr = arr[v % arr.length];
    const sway = Math.round(Math.sin(time / 600 + tx * 0.8 + ty * 0.3) * 1); g.drawImage(spr, 0, 0, 16, 9, X + sway + jx, Y - 2, 16, 9); g.drawImage(spr, 0, 9, 16, 7, X + jx, Y + 7, 16, 7); return; }
  else if (art === 'scrap') { if (depleted) return; spr = A.src.scrap[v % 2]; }
  else if (art === 'wreck') { spr = A.src.wreck[v % 2]; shadow(g, X + 8, Y + 13, 13); if (depleted) g.globalAlpha = 0.7; g.drawImage(spr, X + 8 - 16 + jx, Y + 14 - 20); g.globalAlpha = 1; return; }
  else { if (depleted) { g.drawImage(A.src.rubble[0], X, Y); return; } const arr = A.src[art] || A.src.rock; spr = arr[v % arr.length]; if (art === 'sulfur' && Math.random() < 0.05) add({ x: X + 8, y: Y + 4, vx: 0, vy: -12, col: '#e8e0a0', max: 1200, s: 1, g: -4 }); if (art === 'crystal' && hash2(tx, ty, Math.floor(time / 500)) > 0.9) add({ x: X + 4 + Math.random() * 8, y: Y + 4 + Math.random() * 6, vx: 0, vy: 0, col: '#ffffff', max: 300, s: 1, g: 0 }); }
  shadow(g, X + 8, Y + 13, 6); g.drawImage(spr, X + jx, Y);
}

function drawEntity(g: CanvasRenderingContext2D, r: RunState, e: Entity, time: number, now: number) {
  const A = getArt(); const X = Math.round(e.x), Y = Math.round(e.y);
  switch (e.kind) {
    case 'drop': { const s = C(r, e.c!)?.slots[0]; if (!s) return; const bob = Math.round(Math.sin(time / 250 + e.x) * 1.5); shadow(g, X, Y + 4, 4); const ic = A.icon[s.key]; g.drawImage(ic, X - 6, Y - 9 + bob, 12, 12); if (s.key === 'rcash' || ITEMS[s.key].cat === 'core' || ITEMS[s.key].cat === 'stone') if (hash2(Math.floor(time / 120), X, Y) > 0.7) { g.fillStyle = '#ffffff'; g.fillRect(X - 5 + (hash2(X, Y, Math.floor(time / 120)) * 10 | 0), Y - 8 + bob, 1, 1); } return; }
    case 'bag': { shadow(g, X, Y + 5, 5); g.drawImage(A.st.bag, X - 8, Y - 10); const a = 0.5 + Math.sin(time / 300) * 0.3; g.fillStyle = `rgba(255,226,122,${a})`; g.fillRect(X, Y - 18 - Math.round(Math.sin(time / 300) * 2), 1, 4); g.fillRect(X - 1, Y - 15 - Math.round(Math.sin(time / 300) * 2), 3, 1); return; }
    case 'cart': { shadow(g, X, Y + 6, 11); g.drawImage(A.st.cart, X - 14, Y - 14); if (C(r, e.c!).slots.some(Boolean)) g.drawImage(A.st.cargo, X - 14, Y - 16); if (r.player.pulling === e.id) { g.fillStyle = '#c8a060'; const p = r.player; const n = 8; for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(Math.round(X + 12 + (p.x - X - 12) * t), Math.round(Y - 4 + (p.y - Y + 2) * t + Math.sin(t * Math.PI) * 2), 1, 1); } } return; }
    case 'loot': { const empty = !C(r, e.c!).slots.some(Boolean); shadow(g, X, Y + 5, 7); g.drawImage(empty ? A.st.loot_open : A.st.loot, X - 8, Y - 10); return; }
    case 'cash': { const rag = isRagnarok(r, now); shadow(g, X, Y + 5, 7); g.drawImage(e.minted && !C(r, e.c!).slots.some(Boolean) ? A.st.cash_open : A.st.cash, X - 8, Y - 10); if (rag && !e.minted) { const a = 0.4 + Math.sin(time / 200) * 0.3; g.fillStyle = `rgba(255,208,64,${a})`; g.fillRect(X - 7, Y - 12, 14, 1); if (Math.random() < 0.2) add({ x: X - 6 + Math.random() * 12, y: Y - 8, vx: 0, vy: -16, col: '#ffe27a', max: 700, s: 1, g: -4 }); } return; }
    case 'vendor': { shadow(g, X, Y + 6, 5); const bob = Math.floor(time / 600) % 2; g.drawImage(A.st.vendor, X - 8, Y - 18 + bob); return; }
    case 'gen': { shadow(g, X, Y + 5, 7); const run = (e.power || 0) > 0; g.drawImage(A.st.gen, X - 8 + (run ? Math.round(Math.sin(time / 40)) : 0), Y - 10); if (run && Math.random() < 0.15) add({ x: X + 5, y: Y - 10, vx: 0, vy: -14, col: '#6a6a6a', max: 1000, s: 2, g: -3 }); return; }
    case 'evac': { g.drawImage(A.st.evac, X - 8, Y - 34); if (Math.floor(time / 500) % 2) { g.fillStyle = '#ff5a3a'; g.fillRect(X - 1, Y - 32, 3, 2); } return; }
    case 'door': { g.drawImage(e.open ? A.st.poi_door_open : A.st.poi_door, X - 8, Y - 16); return; }
    case 'struct': {
      const d = STRUCTS[e.type!]; let spr = A.st[e.type!];
      if (e.type!.startsWith('door') && e.open) spr = A.st[e.type + '_open'];
      if (e.type === 'furnace' && e.station && e.station.burn > 0 && e.station.queue.length) spr = A.st.furnace_lit;
      if (!spr) return; if (d.layer !== 'wall') shadow(g, X, Y + 5, 7);
      g.drawImage(spr, X - spr.width / 2, Y + 8 - spr.height);
      if (e.type === 'campfire' && e.station && e.station.burn > 0) drawFlame(g, X, Y - 1, time, 1);
      if (e.type === 'torch_post') drawFlame(g, X, Y - 12, time, 0.6);
      if (e.type === 'escrow' && Math.random() < 0.06) add({ x: X - 6 + Math.random() * 12, y: Y - 6, vx: 0, vy: -10, col: '#c8a0ff', max: 900, s: 1, g: -2 });
      if (e.station && e.station.queue.length) { const j = e.station.queue[0]; const f = 1 - j.left / j.total; g.fillStyle = '#140c14'; g.fillRect(X - 7, Y - 16, 14, 3); g.fillStyle = (e.station.burn > 0 || d.station === 'workbench' || d.station === 'research') ? '#7aff6a' : '#ff7a3a'; g.fillRect(X - 6, Y - 15, Math.round(12 * f), 1); }
      if (e.station && C(r, e.station.outC)?.slots.some(Boolean) && Math.floor(time / 400) % 2) { g.fillStyle = '#ffe27a'; g.fillRect(X + 5, Y - 14, 2, 2); }
      if (e.hp! < e.maxHp!) { g.fillStyle = '#140c14'; g.fillRect(X - 7, Y + 7, 14, 2); g.fillStyle = '#e0a040'; g.fillRect(X - 6, Y + 7, Math.round(12 * e.hp! / e.maxHp!), 1); }
      return;
    }
  }
}
function drawFlame(g: CanvasRenderingContext2D, x: number, y: number, time: number, s: number) {
  const f = Math.floor(time / 90); for (let i = 0; i < 6; i++) { const h = hash2(i, f, 3); const fx0 = x - 3 * s + h * 6 * s, hgt = (3 + hash2(i, f, 4) * 5) * s; g.fillStyle = i % 3 === 0 ? '#fff0a0' : i % 3 === 1 ? '#ffb040' : '#ff6a1e'; g.fillRect(Math.round(fx0), Math.round(y - hgt), 1, Math.round(hgt)); }
  if (Math.random() < 0.25) add({ x: x + (Math.random() - 0.5) * 4, y: y - 6, vx: (Math.random() - 0.5) * 8, vy: -26, col: '#ffb040', max: 600, s: 1, g: -10 });
}
function drawCreature(g: CanvasRenderingContext2D, m: Creature, time: number) {
  const A = getArt(); const X = Math.round(m.x), Y = Math.round(m.y);
  if (m.elder) {
    const d = ELDERS[m.elder.key]; const set = A.elder[m.elder.key]; const aw = m.elder.awake;
    if (m.state === 'dead') { if (m.t < 1500) { g.globalAlpha = 1 - m.t / 1500; g.drawImage(set.lidle[0], X - 24, Y - 40); g.globalAlpha = 1; } return; }
    if (m.elder.submerged) { for (let i = 0; i < 3; i++) pixCircle(g, X, Y, 6 + ((time / 60 + i * 8) % 22), 'rgba(200,220,240,0.6)', 2); return; }
    let spr = m.state === 'sleep' ? set.sleep[0] : m.state === 'tell' ? set[(aw ? 'a' : 'l') + 'tell'][0] : set[(aw ? 'a' : 'l') + 'idle'][Math.floor(time / 380) % 2];
    shadow(g, X, Y + 6, d.r + 4); const jx = m.state === 'tell' ? Math.round(Math.sin(time / 30)) : 0;
    const flip = Math.cos(m.angle) < 0; g.save(); if (flip) { g.translate(X * 2, 0); g.scale(-1, 1); }
    g.drawImage(m.flash > 0 ? white(spr) : spr, X - 24 + jx, Y - 40); g.restore();
    if (aw && Math.random() < 0.4) add({ x: X + (Math.random() - 0.5) * 36, y: Y - Math.random() * 30, vx: 0, vy: -14, col: d.color, max: 800, s: 1, g: -6 });
    if (m.atk?.vuln > 0) { pixCircle(g, X, Y - 16, 22 + Math.sin(time / 80) * 2, '#ffe070', 2); }
    if (m.state === 'sleep') { const z = Math.floor(time / 700) % 3; g.fillStyle = '#c0d0ff'; g.fillRect(X + 10 + z * 3, Y - 40 - z * 4, 3, 1); g.fillRect(X + 12 + z * 3, Y - 39 - z * 4, 1, 1); g.fillRect(X + 10 + z * 3, Y - 38 - z * 4, 3, 1); }
    return;
  }
  const set = A.cre[m.type]; if (!set) return; const d = CREATURES[m.type];
  if (m.atk?.burrow) { g.fillStyle = '#5a4a3a'; g.fillRect(X - 4, Y + 2, 8, 2); g.fillStyle = '#7a6a50'; g.fillRect(X - 3, Y + 1, 6, 1); if (Math.random() < 0.5) add({ x: X, y: Y + 2, vx: (Math.random() - 0.5) * 30, vy: -20, col: '#6a5a4a', max: 300, s: 1, g: 100 }); return; }
  let spr: Sprite; let a = 1;
  if (m.state === 'dead') { spr = set.walk[0]; a = Math.max(0, 1 - m.t / 1600); }
  else if (m.state === 'tell') spr = set.tell[0]; else if (m.state === 'attack') spr = set.attack[0];
  else { const moving = m.state !== 'idle'; spr = set.walk[moving ? Math.floor(time / (m.state === 'chase' || m.state === 'track' ? 110 : 200) + m.homeX) % 4 : 0]; }
  shadow(g, X, Y + 5, d.r); g.save(); g.globalAlpha = a; const flip = Math.cos(m.angle) < 0; const jx = m.state === 'tell' ? Math.round(Math.sin(time / 25)) : 0;
  if (flip) { g.translate(X * 2, 0); g.scale(-1, 1); }
  if (m.state === 'dead') { g.translate(X, Y); g.rotate(Math.PI / 2 * Math.min(1, m.t / 200)); g.translate(-X, -Y); }
  g.drawImage(m.flash > 0 ? white(spr) : spr, X - 12 + jx, Y - 14); g.restore();
  if (m.type === 'crab' && m.atk?.tuck > 0) pixCircle(g, X, Y - 3, 8, 'rgba(255,255,255,0.6)', 3);
  if (m.state === 'tell' && d.style === 'tongue') { pixLine(g, X, Y - 4, X + Math.cos(m.angle) * 84, Y - 4 + Math.sin(m.angle) * 84, 'rgba(255,80,80,0.35)'); }
  if (m.state === 'attack' && d.style === 'tongue') { const len = Math.min(1, m.t / 120) * 84; pixLine(g, X + Math.cos(m.angle) * 6, Y - 4 + Math.sin(m.angle) * 6, X + Math.cos(m.angle) * len, Y - 4 + Math.sin(m.angle) * len, '#e05a7a', 2); }
  if (m.state === 'tell' && d.style === 'charge') pixLine(g, X, Y, X + Math.cos(m.angle) * 60, Y + Math.sin(m.angle) * 60, 'rgba(255,90,60,0.35)');
  if (m.hp < m.maxHp && m.state !== 'dead') { g.fillStyle = '#140c14'; g.fillRect(X - 7, Y - 18, 14, 3); g.fillStyle = '#e04a3a'; g.fillRect(X - 6, Y - 17, Math.max(0, Math.round(12 * m.hp / m.maxHp)), 1); }
}
function drawPlayer(g: CanvasRenderingContext2D, gs: GameState, time: number) {
  const r = gs.run!; const p = r.player; const A = getArt(); const set = A.hero[r.character]; const X = Math.round(p.x), Y = Math.round(p.y);
  shadow(g, X, Y + 5, 5);
  if (p.dead) { g.drawImage(set.dead[0], X - 8, Y - 18); return; }
  const act = p.action; let spr: Sprite; const moving = Math.hypot(p.vx, p.vy) > 4;
  if (act?.kind === 'roll') spr = set.roll[Math.floor(act.t / 65) % 4];
  else if (act?.kind === 'hurt') spr = set['hit' + p.dir][0];
  else if (act?.kind === 'swing') spr = act.t < (act.contact || 0) ? set['wind' + p.dir][0] : set['hit' + p.dir][0];
  else if (act?.kind === 'cast') spr = set['wind' + p.dir][0];
  else if (moving) spr = set['walk' + p.dir][Math.floor(time / 120) % 4]; else spr = set['idle' + p.dir][Math.floor(time / 600) % 2];
  const blink = p.invuln > 0 && act?.kind !== 'roll' && Math.floor(time / 70) % 2 === 0;
  const s = activeStack(r); const icon = s && (ITEMS[s.key].dmg || ITEMS[s.key].core || ITEMS[s.key].ranged) ? A.icon[s.key] : null;
  const drawWeapon = () => { if (!icon || act?.kind === 'roll') return; let ang = p.aim; const d = ITEMS[s!.key];
    if (act?.kind === 'swing' && !d.ranged) { const arc = d.arc || 1.2; const t = act.t / act.dur; const k = act.t < (act.contact || 0) ? -0.5 - 0.15 * (act.t / (act.contact || 1)) : -0.5 + Math.min(1, (act.t - (act.contact || 0)) / 80); ang = p.aim + arc * k * (Math.cos(p.aim) >= 0 ? 1 : -1); void t; }
    const hx = X + Math.cos(ang) * 5, hy = Y - 6 + Math.sin(ang) * 4; g.save(); g.translate(Math.round(hx), Math.round(hy)); g.rotate(ang + Math.PI / 4); if (d.core) g.rotate(-ang - Math.PI / 4); g.drawImage(icon, d.core ? -6 : -3, d.core ? -6 : -12, d.core ? 12 : 14, d.core ? 12 : 14); g.restore(); };
  if (p.dir === 3) drawWeapon();
  g.drawImage(blink ? white(spr) : spr, X - 8, Y - 19);
  if (p.dir !== 3) drawWeapon();
  if (act?.kind === 'cast') { const f = Math.min(1, act.t / (act.contact || 1)); const core = ITEMS[s?.key || '']?.core; const col = core === 'fire' ? '#ffb040' : core === 'frost' ? '#c8f0ff' : core === 'storm' ? '#a0c8ff' : '#e0c080'; pixCircle(g, X, Y - 6, 18 * (1 - f) + 4, col, 2); for (let i = 0; i < 3; i++) { const a = time / 100 + i * 2.1; add({ x: X + Math.cos(a) * 14, y: Y - 6 + Math.sin(a) * 14, vx: -Math.cos(a) * 40, vy: -Math.sin(a) * 40, col, max: 300, s: 1, g: 0 }); } }
  if (s?.key === 'torch') drawFlame(g, X + Math.cos(p.aim) * 7, Y - 12 + Math.sin(p.aim) * 4, time, 0.5);
}
function drawProj(g: CanvasRenderingContext2D, pr: any, time: number) {
  const X = Math.round(pr.x), Y = Math.round(pr.y); const a = Math.atan2(pr.vy, pr.vx);
  switch (pr.kind) {
    case 'arrow': pixLine(g, X - Math.cos(a) * 6, Y - Math.sin(a) * 6, X, Y, '#8a5a32'); g.fillStyle = '#e0e0e8'; g.fillRect(X, Y, 1, 1); break;
    case 'bolt': g.fillStyle = '#ff6a3a'; g.fillRect(X - 1, Y - 1, 3, 3); g.fillStyle = '#fff0c0'; g.fillRect(X, Y, 1, 1); add({ x: X, y: Y, vx: 0, vy: 0, col: '#ff6a3a', max: 160, s: 1, g: 0 }); break;
    case 'shard': g.save(); g.translate(X, Y); g.rotate(a); g.fillStyle = '#bff0ff'; g.fillRect(-4, -1, 8, 2); g.fillStyle = '#ffffff'; g.fillRect(1, 0, 3, 1); g.restore(); break;
    case 'spit': g.fillStyle = pr.kind === 'spit' ? '#6ad0ff' : '#a0d050'; g.fillRect(X - 2, Y - 2, 4, 4); g.fillStyle = '#ffffff'; g.fillRect(X - 1, Y - 1, 1, 1); add({ x: X, y: Y, vx: 0, vy: 10, col: '#a0e0ff', max: 200, s: 1, g: 0 }); break;
    case 'mine': g.fillStyle = '#3a3e46'; g.fillRect(X - 3, Y - 3, 6, 6); g.fillStyle = Math.floor(time / 150) % 2 ? '#ff3a2a' : '#6a1e14'; g.fillRect(X - 1, Y - 1, 2, 2); for (const [dx, dy] of [[-4, 0], [3, 0], [0, -4], [0, 3]]) { g.fillStyle = '#6a7280'; g.fillRect(X + dx, Y + dy, 1, 1); } break;
    case 'fireball': g.fillStyle = '#ff6a1e'; g.fillRect(X - 3, Y - 3, 6, 6); g.fillStyle = '#ffb040'; g.fillRect(X - 2, Y - 2, 4, 4); g.fillStyle = '#fff0a0'; g.fillRect(X - 1, Y - 1, 2, 2); for (let i = 0; i < 2; i++) add({ x: X, y: Y, vx: -pr.vx * 0.2 + (Math.random() - 0.5) * 30, vy: -pr.vy * 0.2 + (Math.random() - 0.5) * 30, col: i ? '#ff6a1e' : '#ffb040', max: 300, s: 1, g: -20 }); break;
  }
}
function drawHaz(g: CanvasRenderingContext2D, h: any, time: number) {
  const col = hazCol(h.style); const tell = h.t < h.tell; const f = tell ? h.t / h.tell : 1;
  if (h.owner === 'player') { if (!tell && h.style === 'spike') { const X = Math.round(h.x), Y = Math.round(h.y); const k = Math.min(1, (h.t - h.tell) / 60); g.fillStyle = '#7a5a32'; g.fillRect(X - 3, Y - Math.round(10 * k), 2, Math.round(10 * k)); g.fillStyle = '#c9a070'; g.fillRect(X + 1, Y - Math.round(7 * k), 2, Math.round(7 * k)); g.fillStyle = '#e0d0b0'; g.fillRect(X - 3, Y - Math.round(10 * k), 1, 1); } if (h.kind === 'ring' && !tell) { const rr = h.r * Math.min(1, (h.t - h.tell) / h.dur); pixCircle(g, h.x, h.y, rr, '#e0ffff'); pixCircle(g, h.x, h.y, rr - 2, 'rgba(160,220,255,0.6)', 2); } return; }
  g.save(); g.globalAlpha = tell ? 0.18 + f * 0.25 : 0.55;
  if (h.kind === 'circle' || h.kind === 'pool') {
    g.fillStyle = h.kind === 'pool' ? 'rgba(90,140,40,0.55)' : col; g.beginPath(); g.arc(h.x, h.y, tell ? h.r * f : h.r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; pixCircle(g, h.x, h.y, h.r, tell ? col : '#ffffff', 2);
    if (h.kind === 'pool') for (let i = 0; i < 2; i++) if (Math.random() < 0.1) add({ x: h.x + (Math.random() - 0.5) * h.r, y: h.y + (Math.random() - 0.5) * h.r, vx: 0, vy: -8, col: '#c8f070', max: 500, s: 1, g: 0 });
    if (!tell && h.style === 'root') { g.fillStyle = '#7a5232'; for (let k = 0; k < 3; k++) g.fillRect(Math.round(h.x - 4 + k * 3), Math.round(h.y - 8), 1, 8); }
  } else if (h.kind === 'ring') {
    const rr = tell ? h.r * 0.2 : h.r * Math.min(1, (h.t - h.tell) / h.dur); g.globalAlpha = 1; pixCircle(g, h.x, h.y, tell ? 14 + f * 6 : rr, col); if (!tell) pixCircle(g, h.x, h.y, rr - 3, col, 2); if (tell) pixCircle(g, h.x, h.y, h.r, 'rgba(255,255,255,0.25)', 4);
  } else {
    let a = h.angle; if (h.kind === 'sweep') a = h.a0 + (h.a1 - h.a0) * clamp((h.t - h.tell) / h.dur, 0, 1);
    let ox = h.x, oy = h.y; if (h.kind === 'wave') { const prog = tell ? 0 : (h.t - h.tell) / 1000 * 130; ox += Math.cos(a) * prog; oy += Math.sin(a) * prog; }
    g.translate(ox, oy); g.rotate(h.kind === 'wave' ? a + Math.PI / 2 : a);
    if (h.kind === 'wave') { g.fillStyle = tell ? col : '#a0e0ff'; g.fillRect(-h.len / 2, -h.w / 2, h.len, h.w); g.globalAlpha = 1; if (!tell) { g.fillStyle = '#ffffff'; for (let x = -h.len / 2; x < h.len / 2; x += 3) g.fillRect(Math.round(x), Math.round(-h.w / 2 + Math.sin(x + time / 60) * 1.5), 2, 1); } }
    else { g.fillStyle = col; g.fillRect(0, -h.w / 2, tell ? h.len * f : h.len, h.w); g.globalAlpha = 1; g.fillStyle = tell ? col : '#ffffff'; g.fillRect(0, -h.w / 2, h.len, 1); g.fillRect(0, h.w / 2 - 1, h.len, 1); if (!tell && h.style === 'beam') { g.fillStyle = '#ffffff'; g.fillRect(0, -1, h.len, 2); } }
  }
  g.restore();
}
function drawFx(g: CanvasRenderingContext2D, dtMs: number, time: number) {
  const dt = dtMs / 1000;
  for (let i = PARTS.length - 1; i >= 0; i--) { const p = PARTS[i]; p.life += dtMs; if (p.life >= p.max) { PARTS.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97;
    if (p.kind === 'bang') { g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(p.y) - 6, 1, 4); g.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 1); continue; }
    if (p.kind === 'q') { g.fillStyle = p.col; const X = Math.round(p.x), Y = Math.round(p.y) - 6; g.fillRect(X - 1, Y, 3, 1); g.fillRect(X + 1, Y + 1, 1, 1); g.fillRect(X, Y + 2, 1, 1); g.fillRect(X, Y + 4, 1, 1); continue; }
    if (p.kind === 'star') { const a = p.a! + p.life / 150; g.fillStyle = p.col; g.fillRect(Math.round(p.x + Math.cos(a) * 6), Math.round(p.y + Math.sin(a) * 2), 1, 1); continue; }
    g.fillStyle = p.col; g.globalAlpha = Math.min(1, (1 - p.life / p.max) * 1.6); g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); g.globalAlpha = 1; }
  for (let i = ARCS.length - 1; i >= 0; i--) { const a = ARCS[i]; a.life += dtMs; if (a.life >= a.max) { ARCS.splice(i, 1); continue; } const f = a.life / a.max;
    if (a.kind === 'ring') { pixCircle(g, a.x, a.y, a.reach! * (0.3 + f), f < 0.5 ? '#fff0a0' : '#ff8a3a'); continue; }
    if (a.kind === 'bolt' || a.kind === 'drain') { const n = 7; let px = a.x, py = a.y; const col = a.kind === 'drain' ? '#8ae05a' : '#e0f0ff'; for (let k = 1; k <= n; k++) { const t = k / n; const nx = a.x + (a.x1! - a.x) * t + (k < n ? (hash2(k, Math.floor(time / 40), 1) - 0.5) * (a.kind === 'drain' ? 6 : 12) : 0), ny = a.y + (a.y1! - a.y) * t + (k < n ? (hash2(k, Math.floor(time / 40), 2) - 0.5) * (a.kind === 'drain' ? 6 : 12) : 0); pixLine(g, px, py, nx, ny, col); if (a.kind === 'bolt') pixLine(g, px + 1, py, nx + 1, ny, 'rgba(120,160,255,0.6)'); px = nx; py = ny; } continue; }
    // weapon slash arc — drawn exactly at the hitbox reach/angle
    const steps = 18; const half = a.arc! / 2; const sweep = Math.min(1, f * 2.2); for (let k = 0; k <= steps; k++) { const t = k / steps; if (t > sweep) break; const ang = a.a! - half + a.arc! * t; const fade = 1 - f; for (let d = 0; d < 3; d++) { const rr = a.reach! - d * 2.2; g.fillStyle = d === 0 ? `rgba(255,255,255,${fade})` : d === 1 ? `rgba(220,235,255,${fade * 0.7})` : `rgba(160,190,255,${fade * 0.35})`; g.fillRect(Math.round(a.x + Math.cos(ang) * rr), Math.round(a.y + Math.sin(ang) * rr), 1, 1); } } }
  for (let i = TEXTS.length - 1; i >= 0; i--) { const t = TEXTS[i]; t.life += dtMs; if (t.life >= t.max) { TEXTS.splice(i, 1); continue; } t.y += t.vy * dt; t.vy *= 0.94; const X = Math.round(t.x), Y = Math.round(t.y);
    if (t.key) { const ic = getArt().icon[t.key]; if (ic) g.drawImage(ic, X - 12, Y - 3, 8, 8); pixelText(g, t.text!, X - 2, Y, t.col); } else pixelText(g, t.text!, X - t.text!.length * 2, Y, t.col); }
}
// ---------- weather ----------
const rain: { x: number; y: number; s: number }[] = Array.from({ length: 220 }, () => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: 0.6 + Math.random() * 0.6 }));
function drawWeather(g: CanvasRenderingContext2D, r: RunState, now: number, time: number, cx: number, cy: number) {
  const w = weatherAt(r, now); const zone = getWorld().zone[Math.floor(r.player.y / 16) * WW + Math.floor(r.player.x / 16)];
  const cold = zone === 5; const ash = zone === 6 || isRagnarok(r, now);
  if (w === 'cloudy' || w === 'rain' || w === 'storm' || w === 'fog') { g.fillStyle = w === 'storm' ? 'rgba(20,24,40,0.28)' : 'rgba(30,36,50,0.14)'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let k = 0; k < 4; k++) { const X = ((k * 230 + time / 40 - cx * 0.9) % (VIEW_W + 300) + VIEW_W + 300) % (VIEW_W + 300) - 150, Y = ((k * 137 - cy * 0.9) % (VIEW_H + 160) + VIEW_H + 160) % (VIEW_H + 160) - 80; g.fillStyle = 'rgba(10,12,30,0.12)'; for (let yy = -30; yy < 30; yy += 2) { const wd = Math.sqrt(1 - (yy / 30) ** 2) * 90; g.fillRect(Math.round(X - wd), Math.round(Y + yy), Math.round(wd * 2), 2); } } }
  if (w === 'rain' || w === 'storm') { const n = w === 'storm' ? 220 : 130; g.fillStyle = 'rgba(180,200,240,0.55)'; const wind = w === 'storm' ? 3 : 1;
    for (let i = 0; i < n; i++) { const d = rain[i]; d.y += 7 * d.s; d.x += wind * d.s; if (d.y > VIEW_H) { d.y = -6; d.x = Math.random() * VIEW_W; if (Math.random() < 0.5) { g.fillRect(Math.round(d.x), VIEW_H - 2 - Math.random() * VIEW_H | 0, 2, 1); } } if (d.x > VIEW_W) d.x -= VIEW_W; g.fillRect(Math.round(d.x), Math.round(d.y), 1, 4); if (wind > 1) g.fillRect(Math.round(d.x) + 1, Math.round(d.y) + 2, 1, 2); }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(200,220,255,0.5)'; g.fillRect(hash2(i, Math.floor(time / 100), 1) * VIEW_W | 0, hash2(i, Math.floor(time / 100), 2) * VIEW_H | 0, 2, 1); } }
  if (w === 'fog') { g.fillStyle = 'rgba(200,205,215,0.16)'; g.fillRect(0, 0, VIEW_W, VIEW_H); g.fillStyle = 'rgba(225,230,238,0.22)'; const ox = Math.floor(time / 70 + cx * 0.5), oy = Math.floor(cy * 0.5); for (let y = 0; y < VIEW_H; y += 2) for (let x = (y >> 1) % 2 * 2; x < VIEW_W; x += 4) { const v = fbm((x + ox) / 90, (y + oy) / 60, 41, 2); if (v > 0.55) g.fillRect(x, y, 2, 2); } }
  if (cold) { g.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 90; i++) { const X = (hash2(i, 1, 1) * VIEW_W + time / 30 * (0.5 + hash2(i, 2, 2)) + Math.sin(time / 700 + i) * 6 - cx * 0.2) % VIEW_W, Y = (hash2(i, 3, 3) * VIEW_H + time / 25 * (0.6 + hash2(i, 4, 4))) % VIEW_H; g.fillRect((X + VIEW_W) % VIEW_W | 0, Y | 0, i % 7 ? 1 : 2, 1); } }
  if (ash) { g.fillStyle = isRagnarok(r, now) ? 'rgba(255,140,80,0.7)' : 'rgba(120,110,110,0.7)'; for (let i = 0; i < 40; i++) { const X = (hash2(i, 5, 1) * VIEW_W - time / 50 * (0.5 + hash2(i, 6, 2))) % VIEW_W, Y = (hash2(i, 7, 3) * VIEW_H + time / 60) % VIEW_H; g.fillRect((X + VIEW_W) % VIEW_W | 0, Y | 0, 1, 1); } }
  if (zone === 7) { g.fillStyle = 'rgba(140,170,40,0.08)'; g.fillRect(0, 0, VIEW_W, VIEW_H); }
}
// ---------- lighting ----------
let lightCv: HTMLCanvasElement | null = null;
function drawLight(g: CanvasRenderingContext2D, r: RunState, now: number, time: number, cx: number, cy: number, ents: Entity[]) {
  let dark = darkness(r, now); const rag = isRagnarok(r, now); const w = weatherAt(r, now); if (w === 'storm') dark = Math.min(0.85, dark + 0.15);
  if (rag) { g.fillStyle = 'rgba(160,40,10,0.12)'; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (dark < 0.04) return;
  if (!lightCv) { lightCv = document.createElement('canvas'); lightCv.width = VIEW_W; lightCv.height = VIEW_H; }
  const l = lightCv.getContext('2d')!; l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, VIEW_W, VIEW_H); l.fillStyle = `rgba(6,8,26,${dark})`; l.fillRect(0, 0, VIEW_W, VIEW_H);
  const lights: [number, number, number, string][] = []; const p = r.player;
  lights.push([p.x, p.y - 6, 34, '']);
  if (activeStack(r)?.key === 'torch') lights.push([p.x, p.y - 8, 78 + Math.sin(time / 90) * 3, '#ffb040']);
  for (const e of ents) { if (e.x < cx - 100 || e.x > cx + VIEW_W + 100 || e.y < cy - 100 || e.y > cy + VIEW_H + 100) continue;
    if (e.kind === 'struct') { const d = STRUCTS[e.type!]; if (d.light && (e.type === 'torch_post' || (e.station && e.station.burn > 0 && (e.type === 'campfire' || e.station.queue.length)))) lights.push([e.x, e.y - 4, d.light + Math.sin(time / 110 + e.x) * 3, '#ff9a3a']); }
    if (e.kind === 'evac') lights.push([e.x, e.y - 30, 40, '#ff5a3a']); if (e.kind === 'vendor') lights.push([e.x, e.y - 10, 50, '#ffd070']); if (e.kind === 'cash' && rag && !e.minted) lights.push([e.x, e.y, 30, '#ffd040']); if (e.kind === 'bag') lights.push([e.x, e.y, 20, '#ffe27a']); }
  for (const pr of PROJ) if (pr.kind === 'fireball' || pr.kind === 'bolt') lights.push([pr.x, pr.y, pr.kind === 'fireball' ? 50 : 18, '#ff7a2a']);
  for (const k in r.sources) { const st: any = r.sources[+k]; if (st.fire && st.fire > r.clock.simMs) { const i = +k; lights.push([(i % WW) * 16 + 8, ((i / WW) | 0) * 16, 60, '#ff7a2a']); } }
  const tx0 = Math.floor(cx / 16), ty0 = Math.floor(cy / 16); for (let ty = ty0; ty < ty0 + 24; ty += 2) for (let tx = tx0; tx < tx0 + 41; tx += 2) if (effTile(r, tx, ty) === T.LAVA) lights.push([tx * 16 + 8, ty * 16 + 8, 34, '#ff6a1e']);
  l.globalCompositeOperation = 'destination-out';
  for (const [x, y, rad] of lights) { const X = x - cx, Y = y - cy; for (let k = 0; k < 4; k++) { l.fillStyle = `rgba(0,0,0,${0.32 + k * 0.17})`; l.beginPath(); l.arc(Math.round(X), Math.round(Y), Math.round(rad * (1 - k * 0.2)), 0, Math.PI * 2); l.fill(); } }
  g.drawImage(lightCv, 0, 0);
  g.globalCompositeOperation = 'lighter'; for (const [x, y, rad, col] of lights) { if (!col) continue; g.fillStyle = col; g.globalAlpha = 0.07 * dark * 1.5; g.beginPath(); g.arc(Math.round(x - cx), Math.round(y - cy), rad * 0.7, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
