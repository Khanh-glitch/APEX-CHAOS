// K2 — stable geographic island (LOCKED_CANON: same geography across runs). Deterministic from WORLD_SEED.
import { T, WW, WH, WORLD_SEED, hash2, TILE } from './core';
import { SOURCES } from './catalog';

export const SRC_KEYS = Object.keys(SOURCES);
export interface Building { id: string; x: number; y: number; w: number; h: number; roof: string; name: string }
export interface StaticEnt { kind: string; tx: number; ty: number; type?: string; poi?: string; locked?: string; loot?: [string, number][]; cash?: number; label?: string }
export interface Place { id: string; name: string; tx: number; ty: number; kind: 'start' | 'poi' | 'elder' | 'evac' }
export interface World {
  tiles: Uint8Array; fresh: Uint8Array; src: Int8Array; zone: Uint8Array; seaDist: Uint8Array;
  buildings: Building[]; statics: StaticEnt[]; places: Place[]; starts: Place[]; elders: Place[];
}

function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, s: number, oct = 4) {
  let f = 0, amp = 0.5, fr = 1, n = 0;
  for (let i = 0; i < oct; i++) { f += vnoise(x * fr, y * fr, s + i * 17) * amp; n += amp; amp *= 0.5; fr *= 2; }
  return f / n;
}
const E = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => Math.hypot((x - cx) / rx, (y - cy) / ry);
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay; const l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function polyDist(px: number, py: number, pts: number[][]) {
  let m = 9; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return m;
}

export const ZONES = ['Heartland', 'Meadow Bay', "Fisher's Point", 'Pinewatch', 'Eastcove', 'Frostcrown Peaks', 'Caldera Wastes', 'Dead Foundry', 'Drowned Fen', 'Oldgrowth', 'Lighthouse Spit', 'Harbor Reach', 'Serpent Strand', 'Wreck Coast', 'Old Mill', 'The Sea'];
const ZONE_CENTERS: [number, number, number][] = [[0, .5, .55], [1, .17, .54], [2, .42, .86], [3, .38, .37], [4, .84, .36], [10, .15, .86], [11, .85, .15], [12, .92, .62], [13, .64, .9], [14, .62, .45]];

const RIDGE = [[.16, .29], [.3, .245], [.43, .27], [.56, .245], [.68, .31]];
const PASS = [.435, .27];
const VOLC = [.72, .76];
const RIVERS = [
  [[.33, .27], [.3, .36], [.24, .44], [.16, .49], [.06, .5]],
  [[.55, .27], [.52, .36], [.47, .45], [.49, .55], [.53, .68], [.55, .8], [.56, .97]],
  [[.4, .6], [.33, .68], [.24, .74], [.14, .77], [.04, .78]],
  [[.66, .33], [.72, .4], [.8, .42], [.86, .46], [.98, .46]],
];

let cached: World | null = null;
export function getWorld(): World { return cached || (cached = genWorld()); }

function genWorld(): World {
  const S = WORLD_SEED;
  const N = WW * WH;
  const tiles = new Uint8Array(N), fresh = new Uint8Array(N), zone = new Uint8Array(N), src = new Int8Array(N).fill(-1);
  const elev = new Float32Array(N);
  for (let ty = 0; ty < WH; ty++) for (let tx = 0; tx < WW; tx++) {
    const x = tx / WW, y = ty / WH, i = ty * WW + tx;
    const n = fbm(x * 6, y * 6, S) - 0.5, n2 = fbm(x * 14, y * 14, S + 5) - 0.5;
    let land = Math.max(1 - E(x, y, .5, .54, .41, .37), 1 - E(x, y, .82, .19, .12, .1), 1 - E(x, y, .17, .84, .11, .1), 1 - E(x, y, .74, .27, .1, .05), 1 - E(x, y, .3, .2, .17, .1));
    land -= Math.max(0, 1 - E(x, y, .06, .5, .09, .065)) * 1.4 + Math.max(0, 1 - E(x, y, .57, .99, .07, .08)) * 1.4 + Math.max(0, 1 - E(x, y, .63, .1, .07, .07)) * 1.4 + Math.max(0, 1 - E(x, y, .99, .78, .07, .12)) * 1.4;
    land += n * 0.42 + n2 * 0.12;
    const rd = polyDist(x, y, RIDGE);
    let m = Math.exp(-((rd / 0.04) ** 2)) * (0.8 + n * 0.9);
    const pd = Math.hypot(x - PASS[0], y - PASS[1]); if (pd < 0.03) m *= pd / 0.03 * 0.6;
    const vd = Math.hypot(x - VOLC[0], y - VOLC[1]);
    let volc = vd < 0.075 ? (1 - vd / 0.075) * 1.1 : 0; if (vd < 0.026) volc = 0.15; // crater floor
    if (Math.abs(Math.atan2(y - VOLC[1], x - VOLC[0]) - 2.2) < 0.18 && vd < .08) volc *= 0.25; // crater access path (SW)
    m = Math.max(m, volc) + Math.max(0, fbm(x * 9, y * 9, S + 9) - 0.62) * 1.2;
    elev[i] = m;
    let t: number;
    if (land < -0.06) t = T.DEEP; else if (land < 0) t = T.SHALLOW;
    else {
      const moist = fbm(x * 8 + 3, y * 8, S + 33);
      const cold = y < 0.215 + n * 0.06;
      if (m > 0.62) t = T.CLIFF;
      else if (cold) t = m > 0.33 ? T.HILL : T.SNOW;
      else if (vd < 0.14 + n * 0.05) t = (vd < 0.026) ? T.ASH : (fbm(x * 30, y * 30, S + 7) > 0.72 && vd > 0.03 ? T.LAVA : T.ASH);
      else if (E(x, y, .83, .5, .09, .1) + n * 0.6 < 1) t = T.TOXIC;
      else if (E(x, y, .29, .71, .11, .075) + n * 0.7 < 1) t = fbm(x * 22, y * 22, S + 2) > 0.66 ? T.SHALLOW : T.MARSH;
      else if (m > 0.33) t = T.HILL;
      else if (E(x, y, .24, .4, .09, .08) + n < 1 || moist > 0.56) t = T.FOREST;
      else t = moist < 0.44 ? T.MEADOW : T.GRASS;
      if (t === T.SNOW && m <= 0.33 && moist > 0.6) t = T.SNOW;
    }
    // lake
    const ld = E(x, y, .475, .475, .05, .034) + n * 0.5;
    if (ld < 1 && land > 0) { t = T.SHALLOW; fresh[i] = 1; }
    tiles[i] = t;
  }
  // rivers (fresh, continuous to sea)
  for (const r of RIVERS) {
    for (let ty = 0; ty < WH; ty++) for (let tx = 0; tx < WW; tx++) {
      const x = tx / WW, y = ty / WH, i = ty * WW + tx;
      const d = polyDist(x, y, r.map((p, k) => [p[0] + (k ? (fbm(p[0] * 9, p[1] * 9, S) - .5) * 0.0 : 0), p[1]]));
      const w = 0.0055 + fbm(x * 20, y * 20, S + 1) * 0.004;
      if (d < w && tiles[i] !== T.DEEP && tiles[i] !== T.LAVA) { tiles[i] = T.RIVER; fresh[i] = 1; }
    }
  }
  // sea flood & sand
  const sea = new Uint8Array(N); const q: number[] = [0]; sea[0] = 1;
  while (q.length) { const i = q.pop()!; const x = i % WW, y = (i / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const j = ny * WW + nx;
      if (!sea[j] && (tiles[j] === T.DEEP || (tiles[j] === T.SHALLOW && !fresh[j]))) { sea[j] = 1; q.push(j); } } }
  const seaDist = new Uint8Array(N).fill(255); const bq: number[] = [];
  for (let i = 0; i < N; i++) if (sea[i]) { seaDist[i] = 0; bq.push(i); }
  for (let h = 0; h < bq.length; h++) { const i = bq[h]; const x = i % WW, y = (i / WW) | 0; if (seaDist[i] > 6) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const j = ny * WW + nx; if (seaDist[j] === 255) { seaDist[j] = seaDist[i] + 1; bq.push(j); } } }
  for (let i = 0; i < N; i++) {
    if (sea[i] || fresh[i]) continue; const t = tiles[i];
    const sd = seaDist[i] + (hash2(i % WW, i / WW | 0, S) > .5 ? 1 : 0);
    if (sd <= 2 && t !== T.CLIFF && t !== T.LAVA && t !== T.SNOW && t !== T.TOXIC) tiles[i] = T.SAND;
    if (!sea[i] && tiles[i] === T.SHALLOW && !fresh[i]) fresh[i] = 1; // marsh pools are fresh-ish
  }
  // places
  const P = (id: string, name: string, x: number, y: number, kind: Place['kind']): Place => ({ id, name, tx: Math.round(x * WW), ty: Math.round(y * WH), kind });
  const starts = [P('s0', 'Meadow Bay', .18, .545, 'start'), P('s1', "Fisher's Point", .42, .855, 'start'), P('s2', 'Pinewatch', .37, .37, 'start'), P('s3', 'Eastcove', .835, .355, 'start')];
  const pois = [P('tp', 'Crossroads Trading Post', .5, .6, 'poi'), P('mill', 'Old Mill Village', .63, .46, 'poi'), P('factory', 'Dead Foundry Works', .78, .5, 'poi'), P('light', 'Spit Lighthouse', .14, .885, 'poi'), P('wreck', 'Wreck of the Halcyon', .655, .905, 'poi'), P('watch', 'Pass Watchtower', .435, .29, 'poi'), P('evac', 'Harbor Evacuation Pier', .87, .115, 'evac')];
  const elders = [P('frost', 'Frostcrown Summit', .36, .13, 'elder'), P('magma', 'Caldera Throat', VOLC[0], VOLC[1], 'elder'), P('bog', 'Fen Heart', .28, .72, 'elder'), P('grove', 'Oldgrowth Ring', .25, .4, 'elder'), P('tide', 'Serpent Strand', .91, .63, 'elder'), P('rust', 'Foundry Yard', .87, .565, 'elder')];
  const all = [...starts, ...pois];
  // clear land under places
  const clearArea = (cx: number, cy: number, r: number, t: number) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) { if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1) continue; const i = y * WW + x; if (Math.hypot(x - cx, y - cy) <= r + .3 && tiles[i] !== T.RIVER && !(tiles[i] === T.SHALLOW && fresh[i])) { if (tiles[i] === T.DEEP || tiles[i] === T.SHALLOW || tiles[i] === T.CLIFF || tiles[i] === T.LAVA) tiles[i] = t; } } };
  for (const p of all) clearArea(p.tx, p.ty, 6, T.GRASS);
  for (const e of elders) clearArea(e.tx, e.ty, 7, e.id === 'frost' ? T.SNOW : e.id === 'magma' ? T.ASH : e.id === 'tide' ? T.SAND : e.id === 'rust' ? T.TOXIC : e.id === 'bog' ? T.MARSH : T.FOREST);
  { // frost summit path & plateau
    const e = elders[0]; for (let y = e.ty - 7; y <= e.ty + 7; y++) for (let x = e.tx - 7; x <= e.tx + 7; x++) { const i = y * WW + x; if (Math.hypot(x - e.tx, y - e.ty) < 7 && tiles[i] !== T.DEEP) tiles[i] = T.SNOW; }
  }
  // roads (A*)
  const cost = (i: number) => { const t = tiles[i]; switch (t) { case T.DEEP: case T.LAVA: case T.CLIFF: return 0; case T.SHALLOW: return fresh[i] ? 9 : 0; case T.RIVER: return 7; case T.MARSH: return 5; case T.HILL: return 3; case T.FOREST: return 1.8; case T.SAND: return 1.6; case T.SNOW: return 2.2; case T.ROAD: case T.BRIDGE: return 0.4; default: return 1; } };
  const road = (a: Place, b: Place) => {
    const start = a.ty * WW + a.tx, goal = b.ty * WW + b.tx; const g = new Float64Array(N).fill(1e9); const from = new Int32Array(N).fill(-1);
    const heap: [number, number][] = []; const push = (f: number, i: number) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    g[start] = 0; push(0, start);
    while (heap.length) { const [, i] = pop(); if (i === goal) break; const x = i % WW, y = (i / WW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue; const j = ny * WW + nx; const c = cost(j); if (!c) continue;
        const wig = 1 + hash2(nx >> 2, ny >> 2, S + 77) * 0.6; const ng = g[i] + c * wig; if (ng < g[j]) { g[j] = ng; from[j] = i; push(ng + (Math.abs(nx - b.tx) + Math.abs(ny - b.ty)) * 0.45, j); } } }
    let i = goal; let guard = 0; while (i !== -1 && i !== start && guard++ < 5000) { const t = tiles[i]; tiles[i] = (t === T.RIVER || t === T.SHALLOW) ? T.BRIDGE : T.ROAD; i = from[i]; }
  };
  const byId = (id: string) => all.find(p => p.id === id)!;
  for (const [a, b] of [['s0', 'tp'], ['s1', 'tp'], ['tp', 'mill'], ['mill', 's2'], ['s2', 'watch'], ['s0', 's2'], ['mill', 's3'], ['s3', 'factory'], ['s3', 'evac'], ['s1', 'light'], ['s1', 'wreck'], ['tp', 'factory']]) road(byId(a), byId(b));
  // buildings & statics
  const buildings: Building[] = []; const statics: StaticEnt[] = [];
  const stamp = (id: string, name: string, cx: number, cy: number, w: number, h: number, roof: string, doors: [number, number][], floorOnly = false) => {
    const x0 = cx - (w >> 1), y0 = cy - (h >> 1);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1; tiles[y * WW + x] = edge && !floorOnly ? T.PWALL : T.FLOOR; src[y * WW + x] = -1; }
    for (const [dx, dy] of doors) tiles[(y0 + dy) * WW + x0 + dx] = T.FLOOR;
    for (let x = x0 - 1; x <= x0 + w; x++) for (const y of [y0 - 1, y0 + h]) if (tiles[y * WW + x] !== T.ROAD && tiles[y * WW + x] !== T.PWALL && tiles[y * WW + x] !== T.FLOOR) tiles[y * WW + x] = T.GRASS === tiles[y * WW + x] ? T.GRASS : tiles[y * WW + x];
    const b = { id, name, x: x0, y: y0, w, h, roof }; buildings.push(b); return b;
  };
  const crate = (tx: number, ty: number, poi: string, loot: [string, number][]) => statics.push({ kind: 'loot', tx, ty, poi, loot });
  // starts: humble shelters with starter crates
  const st = starts;
  stamp('b_s0', 'Farmstead', st[0].tx + 3, st[0].ty - 3, 6, 5, 'thatch', [[2, 4]]); crate(st[0].tx + 2, st[0].ty - 4, 's0', [['berries', 3], ['fiber', 6], ['rope', 1]]);
  stamp('b_s1', 'Net Shed', st[1].tx - 3, st[1].ty - 2, 5, 5, 'thatch', [[2, 4]]); crate(st[1].tx - 3, st[1].ty - 3, 's1', [['meat', 2], ['rope', 2], ['bandage', 1]]);
  stamp('b_s2', 'Ranger Cabin', st[2].tx + 6, st[2].ty + 3, 6, 5, 'wood', [[2, 0]]); crate(st[2].tx + 6, st[2].ty + 3, 's2', [['torch', 2], ['stone', 4], ['bandage', 1]]);
  stamp('b_s3', 'Salvager Shack', st[3].tx - 3, st[3].ty + 3, 5, 5, 'tin', [[2, 0]]); crate(st[3].tx - 3, st[3].ty + 4, 's3', [['scrap', 4], ['spares', 2], ['water_flask', 1]]);
  // trading post
  const tp = byId('tp'); stamp('b_tp', 'Trading Post', tp.tx, tp.ty - 4, 11, 7, 'tile', [[5, 6]]);
  statics.push({ kind: 'vendor', tx: tp.tx, ty: tp.ty - 5, poi: 'tp', label: 'Mirela the Trader' });
  statics.push({ kind: 'cash', tx: tp.tx + 4, ty: tp.ty - 6, poi: 'tp', cash: 36 });
  crate(tp.tx - 4, tp.ty - 6, 'tp', [['rope', 3], ['cloth', 2], ['blueprint:bow', 1]]); crate(tp.tx + 7, tp.ty + 1, 'tp', [['wood', 8], ['iron_ingot', 1]]);
  // old mill
  const mill = byId('mill'); stamp('b_m1', 'Mill House', mill.tx - 5, mill.ty - 3, 6, 5, 'thatch', [[3, 4]]); stamp('b_m2', 'Chapel', mill.tx + 4, mill.ty - 3, 7, 6, 'tile', [[3, 5]]); stamp('b_m3', 'Cottage', mill.tx, mill.ty + 5, 5, 5, 'thatch', [[2, 0]]);
  crate(mill.tx - 6, mill.ty - 4, 'mill', [['seed', 6], ['blueprint:stew', 1], ['crop', 2]]); crate(mill.tx, mill.ty + 6, 'mill', [['leather', 2], ['blueprint:brick', 1]]);
  statics.push({ kind: 'cash', tx: mill.tx + 4, ty: mill.ty - 4, poi: 'mill', cash: 40 });
  // factory with inner vault (keycard) — optional deeper access
  const fa = byId('factory'); stamp('b_fa', 'Foundry Hall', fa.tx, fa.ty, 17, 12, 'tin', [[8, 11], [0, 5]]);
  for (let y = fa.ty - 5; y <= fa.ty - 1; y++) tiles[y * WW + fa.tx + 2] = T.PWALL; for (let x = fa.tx + 2; x <= fa.tx + 7; x++) tiles[(fa.ty - 1) * WW + x] = T.PWALL;
  statics.push({ kind: 'door', tx: fa.tx + 4, ty: fa.ty - 1, poi: 'factory', locked: 'keycard', label: 'Vault Door' });
  buildings.push({ id: 'b_vault', name: 'Sealed Vault', x: fa.tx + 3, y: fa.ty - 5, w: 5, h: 4, roof: 'tin' });
  crate(fa.tx + 4, fa.ty - 4, 'factory_vault', [['core_fire', 1], ['blueprint:core_earth', 1], ['spares', 6]]);
  crate(fa.tx + 6, fa.ty - 4, 'factory_vault', [['blueprint:gas_mask', 1], ['iron_ingot', 4]]);
  statics.push({ kind: 'cash', tx: fa.tx + 5, ty: fa.ty - 3, poi: 'factory_vault', cash: 80 });
  crate(fa.tx - 6, fa.ty + 3, 'factory', [['scrap', 6], ['spares', 3]]); crate(fa.tx - 2, fa.ty - 4, 'factory', [['iron_ore', 4], ['coal', 3]]);
  // lighthouse (power gated)
  const li = byId('light'); stamp('b_li', 'Lighthouse', li.tx, li.ty, 5, 5, 'light', [[2, 4]]);
  statics.push({ kind: 'door', tx: li.tx, ty: li.ty + 2, poi: 'light', locked: 'power', label: 'Lighthouse Door' });
  statics.push({ kind: 'gen', tx: li.tx + 3, ty: li.ty + 3, poi: 'light', label: 'Generator' });
  crate(li.tx - 1, li.ty - 1, 'light_top', [['core_storm', 1], ['blueprint:leather_armor', 1]]);
  statics.push({ kind: 'cash', tx: li.tx + 1, ty: li.ty - 1, poi: 'light_top', cash: 60 });
  crate(li.tx + 3, li.ty - 2, 'light', [['fuel_can', 1], ['rope', 2]]);
  // wreck
  const wr = byId('wreck'); stamp('b_wr', 'Halcyon Hull', wr.tx, wr.ty, 9, 5, 'hull', [[0, 2], [8, 2]]);
  crate(wr.tx - 2, wr.ty, 'wreck', [['core_frost', 1], ['spares', 4]]); crate(wr.tx + 2, wr.ty - 1, 'wreck', [['cloth', 3], ['fuel_can', 1], ['blueprint:arrow', 1]]);
  statics.push({ kind: 'cash', tx: wr.tx, ty: wr.ty + 1, poi: 'wreck', cash: 45 });
  // watchtower
  const wa = byId('watch'); stamp('b_wa', 'Watchtower', wa.tx, wa.ty, 5, 5, 'wood', [[2, 4]]);
  crate(wa.tx - 1, wa.ty - 1, 'watch', [['keycard', 1], ['blueprint:fur_cloak', 1], ['torch', 2]]);
  statics.push({ kind: 'cash', tx: wa.tx + 1, ty: wa.ty - 1, poi: 'watch', cash: 34 });
  // evacuation pier
  const ev = byId('evac'); stamp('b_ev', 'Harbor Office', ev.tx - 3, ev.ty + 1, 5, 4, 'tin', [[2, 3]]);
  for (let k = 0; k < 9; k++) for (let w = 0; w < 2; w++) { const i = (ev.ty - 1 - k) * WW + ev.tx + 1 + w; tiles[i] = T.BRIDGE; }
  statics.push({ kind: 'evac', tx: ev.tx + 1, ty: ev.ty - 9, poi: 'evac', label: 'Evacuation Beacon' });
  statics.push({ kind: 'cash', tx: ev.tx - 4, ty: ev.ty + 1, poi: 'evac', cash: 30 });
  crate(ev.tx - 2, ev.ty + 1, 'evac', [['medkit', 1], ['water_flask', 1]]);
  // places zone claims
  for (let i = 0; i < N; i++) {
    const x = (i % WW) / WW, y = ((i / WW) | 0) / WH, t = tiles[i];
    let z = 0;
    if (t === T.DEEP || (t === T.SHALLOW && !fresh[i])) z = 15;
    else if (y < 0.24 && (t === T.SNOW || t === T.HILL || t === T.CLIFF)) z = 5;
    else if (Math.hypot(x - VOLC[0], y - VOLC[1]) < 0.15) z = 6;
    else if (E(x, y, .83, .5, .11, .12) < 1) z = 7;
    else if (E(x, y, .29, .71, .12, .085) < 1) z = 8;
    else if (E(x, y, .25, .4, .09, .085) < 1) z = 9;
    else { let best = 1e9; for (const [zi, cx, cy] of ZONE_CENTERS) { const d = Math.hypot(x - cx, y - cy); if (d < best) { best = d; z = zi; } } }
    zone[i] = z;
  }
  // base sources (K3): deterministic per tile, by biome; roadside scrap for C02
  const SK = (k: string) => SRC_KEYS.indexOf(k);
  const nearRoad = (x: number, y: number) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const t = tiles[(y + dy) * WW + x + dx]; if (t === T.ROAD) return true; } return false; };
  const isPOI = (x: number, y: number) => all.some(p => Math.abs(p.tx - x) < 5 && Math.abs(p.ty - y) < 5) || buildings.some(b => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h);
  for (let ty = 2; ty < WH - 2; ty++) for (let tx = 2; tx < WW - 2; tx++) {
    const i = ty * WW + tx, t = tiles[i]; if (t === T.ROAD || t === T.BRIDGE || t === T.FLOOR || t === T.PWALL) continue; if (isPOI(tx, ty)) continue;
    if (elders.some(e => Math.hypot(e.tx - tx, e.ty - ty) < 5.5)) continue;
    const r = hash2(tx, ty, S + 101), r2 = hash2(tx, ty, S + 202); const y = ty / WH;
    let k = -1;
    const nr = nearRoad(tx, ty);
    if (nr && r2 < 0.05 && t !== T.SHALLOW && t !== T.RIVER && t !== T.DEEP) k = r < 0.18 ? SK('wreck') : SK('scrap');
    else switch (t) {
      case T.FOREST: k = r < (y < 0.42 ? 0.0 : 0.3) ? SK('oak') : r < 0.42 ? SK('pine') : r < 0.47 ? SK('bush') : r < 0.53 ? SK('grass') : r < 0.545 ? SK('herb') : r < 0.555 ? SK('rock') : -1; if (y >= 0.42 && r >= 0.3 && r < 0.42) k = SK('oak'); break;
      case T.GRASS: k = r < 0.045 ? SK('oak') : r < 0.075 ? SK('bush') : r < 0.14 ? SK('grass') : r < 0.155 ? SK('rock') : r < 0.163 ? SK('herb') : -1; break;
      case T.MEADOW: k = r < 0.015 ? SK('oak') : r < 0.055 ? SK('bush') : r < 0.17 ? SK('grass') : r < 0.185 ? SK('rock') : -1; break;
      case T.SNOW: k = r < 0.12 ? SK('snowpine') : r < 0.15 ? SK('rock') : r < 0.165 ? SK('crystal') : -1; break;
      case T.HILL: k = r < 0.1 ? SK('rock') : r < 0.145 ? SK('iron') : r < 0.165 ? SK('coalv') : (y < 0.24 && r < 0.18) ? SK('crystal') : -1; break;
      case T.SAND: k = y > 0.45 && r < 0.035 ? SK('palm') : r < 0.042 ? SK('rock') : -1; break;
      case T.MARSH: k = r < 0.06 ? SK('willow') : r < 0.2 ? SK('reed') : r < 0.235 ? SK('mushroom') : r < 0.245 ? SK('herb') : -1; break;
      case T.ASH: k = r < 0.03 ? SK('sulfur') : r < 0.07 ? SK('rock') : r < 0.09 ? SK('deadtree') : r < 0.105 ? SK('coalv') : -1; break;
      case T.TOXIC: k = r < 0.018 ? SK('wreck') : r < 0.05 ? SK('scrap') : r < 0.06 ? SK('deadtree') : r < 0.068 ? SK('iron') : -1; break;
    }
    if (k >= 0) src[i] = k;
  }
  // guarantee each start has viable survival resources within reach (LOCKED_CANON: viable starts)
  for (const s of starts) {
    for (let d = 0; d < 360; d += 24) {
      const a = d * Math.PI / 180, rr = 7 + (d % 5);
      const x = Math.round(s.tx + Math.cos(a) * rr), y = Math.round(s.ty + Math.sin(a) * rr), i = y * WW + x;
      const t = tiles[i]; if (t === T.ROAD || t === T.BRIDGE || t === T.FLOOR || t === T.PWALL || t === T.RIVER || t === T.SHALLOW || t === T.DEEP || isPOIb(x, y)) continue;
      src[i] = SK(['oak', 'rock', 'bush', 'oak', 'grass', 'rock', 'herb', 'oak', 'bush', 'rock', 'grass', 'oak', 'rock', 'bush', 'oak'][d / 24]);
    }
    for (let y = s.ty - 2; y <= s.ty + 2; y++) for (let x = s.tx - 2; x <= s.tx + 2; x++) src[y * WW + x] = -1;
  }
  function isPOIb(x: number, y: number) { return buildings.some(b => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h); }
  return { tiles, fresh, src, zone, seaDist, buildings, statics, places: [...all, ...elders], starts, elders };
}

export function tileAt(w: World, tx: number, ty: number) { if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return T.DEEP; return w.tiles[ty * WW + tx]; }
export function zoneAtPx(w: World, x: number, y: number) { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return 15; return w.zone[ty * WW + tx]; }
