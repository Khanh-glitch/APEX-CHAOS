import { describe, it, expect, beforeEach } from 'vitest';
import { TILE, WW, WH, T, HOUR, type GameState } from '../src/game/core';
import { getWorld, SRC_KEYS } from '../src/game/world';
import { newGame, dispatch, harvestHit, addItem, countItem, C, blockedAt, effTile, killPlayer, markDirty, endRun, sourceAt, claimAt } from '../src/game/engine';
import { tick, settle, decayTraces, HAZ, PROJ, type Input } from '../src/game/sim';

const T0 = Date.UTC(2026, 10, 1, 12);
let n = 0; const id = () => 'it' + (++n);
const idle = (mx = 0, my = 0): Input => ({ up: false, down: false, left: false, right: false, mx, my, attack: false, attackPressed: false, roll: false, cancel: false });
function fresh(region = 0): GameState { const gs = newGame(); markDirty(); const r = dispatch(gs, { id: id(), type: 'startRun', character: 'female', region, seed: 1234 + region }, T0); expect(r.ok).toBe(true); HAZ.length = 0; PROJ.length = 0; return gs; }
function totalItems(gs: GameState, key: string) { let s = 0; for (const c of Object.values(gs.run!.custody)) for (const st of c.slots) if (st?.key === key) s += st.qty; return s; }
function tp(gs: GameState, x: number, y: number) { gs.run!.player.x = x; gs.run!.player.y = y; }
function buildSpot(gs: GameState) {
  const w = getWorld(); const r = gs.run!;
  for (let ty = 20; ty < WH - 20; ty++) for (let tx = 20; tx < WW - 20; tx++) {
    if (w.places.some(p => Math.hypot(p.tx - tx, p.ty - ty) < 14)) continue; let ok = true;
    for (let y = ty - 2; y <= ty + 2 && ok; y++) for (let x = tx - 2; x <= tx + 2 && ok; x++) { const t = effTile(r, x, y); if (![T.GRASS, T.MEADOW].includes(t) || w.src[y * WW + x] >= 0) ok = false; }
    if (ok) return { tx, ty };
  }
  throw new Error('no spot');
}

describe('C24 world', () => {
  it('island is 200x200 with four distinct safe, mutually reachable starts and six elder sites', () => {
    const w = getWorld(); expect(WW * WH).toBeGreaterThanOrEqual(192 * 192); expect(w.starts.length).toBe(4); expect(new Set(w.elders.map(e => e.id)).size).toBe(6);
    const gs = fresh(); const r = gs.run!;
    const seen = new Uint8Array(WW * WH); const s = w.starts[0]; const q = [s.ty * WW + s.tx]; seen[q[0]] = 1;
    while (q.length) { const i = q.pop()!; const x = i % WW, y = (i / WW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * WW + x + dx; if (!seen[j] && !blockedAt(r, x + dx, y + dy)) { seen[j] = 1; q.push(j); } } }
    for (const st of w.starts) expect(seen[st.ty * WW + st.tx]).toBe(1);
    for (const p of w.places.filter(p => p.kind !== 'elder')) { let near = false; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (seen[(p.ty + dy) * WW + p.tx + dx]) near = true; expect(near, p.name).toBe(true); }
    // every start has wood, stone and food within 12 tiles
    for (const st of w.starts) { const kinds = new Set<string>(); for (let y = st.ty - 12; y <= st.ty + 12; y++) for (let x = st.tx - 12; x <= st.tx + 12; x++) { const k = w.src[y * WW + x]; if (k >= 0) kinds.add(SRC_KEYS[k]); } expect(kinds.has('rock')).toBe(true); expect(kinds.has('bush') || kinds.has('herb')).toBe(true); expect([...kinds].some(k => ['oak', 'pine', 'palm', 'snowpine'].includes(k))).toBe(true); }
  });
});

describe('C01/C05 harvesting & shared hit rules', () => {
  it('a source depletes once and yields exactly its stock; further hits yield nothing', () => {
    const gs = fresh(); const r = gs.run!; const w = getWorld();
    let tgt = -1; for (let i = 0; i < WW * WH; i++) if (w.src[i] >= 0 && SRC_KEYS[w.src[i]] === 'rock') { tgt = i; break; }
    const tx = tgt % WW, ty = (tgt / WW) | 0; const before = Object.keys(r.entities).length;
    expect(harvestHit(gs, tx, ty, { wood: 5 }, T0, 0, 0).result).toBe('nopower'); // knife/axe on stone
    let guard = 0; while (harvestHit(gs, tx, ty, { stone: 3 }, T0, 0, 0).result === 'yield' && guard++ < 50) {/* */}
    const drops = Object.values(r.entities).filter(e => e.kind === 'drop'); expect(Object.keys(r.entities).length - before).toBe(drops.length);
    expect(drops.reduce((a, e) => a + (C(r, e.c!).slots[0]?.key === 'stone' ? C(r, e.c!).slots[0]!.qty : 0), 0)).toBe(6);
    expect(harvestHit(gs, tx, ty, { stone: 9 }, T0, 0, 0).result).toBe('empty');
  });
  it('the same knife swing damages a creature through the real input path', () => {
    const gs = fresh(); const r = gs.run!; const p = r.player;
    r.creatures = r.creatures.filter(c => c.elder); const m = { ...r.creatures[0], id: 'mx', type: 'boar', elder: undefined, hp: 40, maxHp: 40, x: p.x + 12, y: p.y, state: 'wander' as const }; r.creatures.push(m as any);
    const inp = { ...idle(p.x + 30, p.y), attackPressed: true }; tick(gs, inp, 16, T0 + 16);
    for (let k = 0; k < 30; k++) tick(gs, idle(p.x + 30, p.y), 16, T0 + 32 + k * 16);
    expect(r.creatures.find(c => c.id === 'mx')!.hp).toBeLessThan(40);
  });
});

describe('C07 build / reclaim custody', () => {
  it('invalid build never debits; valid build debits exactly; duplicate intent ignored', () => {
    const gs = fresh(); const r = gs.run!; const { tx, ty } = buildSpot(gs); tp(gs, tx * TILE + 8, (ty + 2) * TILE + 8);
    expect(dispatch(gs, { id: id(), type: 'build', struct: 'claim', tx, ty }, T0).ok).toBe(false);
    addItem(r, 'inv', 'wood', 40); addItem(r, 'inv', 'stone', 20);
    expect(dispatch(gs, { id: id(), type: 'build', struct: 'wall_wood', tx, ty }, T0).ok).toBe(false); // not owned
    expect(countItem(r, 'inv', 'wood')).toBe(40);
    const bid = id(); expect(dispatch(gs, { id: bid, type: 'build', struct: 'claim', tx, ty }, T0).ok).toBe(true);
    expect(countItem(r, 'inv', 'wood')).toBe(30); expect(countItem(r, 'inv', 'stone')).toBe(15);
    expect(dispatch(gs, { id: bid, type: 'build', struct: 'claim', tx, ty }, T0)).toMatchObject({ ok: false, dup: true });
    expect(countItem(r, 'inv', 'wood')).toBe(30);
    expect(dispatch(gs, { id: id(), type: 'build', struct: 'chest_small', tx: tx + 1, ty }, T0).ok).toBe(true);
    const chest = Object.values(r.entities).find(e => e.type === 'chest_small')!;
    addItem(r, 'inv', 'berries', 7); const bi = C(r, 'inv').slots.findIndex(s => s?.key === 'berries');
    expect(dispatch(gs, { id: id(), type: 'move', from: 'inv', fs: bi, to: chest.c }, T0).ok).toBe(true);
    const berriesBefore = totalItems(gs, 'berries');
    expect(dispatch(gs, { id: id(), type: 'reclaim', eid: chest.id }, T0).ok).toBe(true);
    expect(totalItems(gs, 'berries')).toBe(berriesBefore); // loaded chest reclaim: moved to a bag, not deleted/duplicated
    expect(Object.values(r.entities).filter(e => e.kind === 'bag').length).toBe(1);
  });
});

describe('C06/C09 stations, fuel, offline', () => {
  it('furnace output stops exactly at fuel exhaustion during offline settlement', () => {
    const gs = fresh(); const r = gs.run!; const { tx, ty } = buildSpot(gs); tp(gs, tx * TILE + 8, (ty + 2) * TILE + 8);
    addItem(r, 'inv', 'wood', 40); addItem(r, 'inv', 'stone', 30); addItem(r, 'inv', 'iron_ore', 5);
    dispatch(gs, { id: id(), type: 'build', struct: 'claim', tx, ty }, T0); expect(dispatch(gs, { id: id(), type: 'build', struct: 'furnace', tx: tx + 1, ty }, T0).ok).toBe(true);
    const f = Object.values(r.entities).find(e => e.type === 'furnace')!; const wi = C(r, 'inv').slots.findIndex(s => s?.key === 'wood');
    expect(dispatch(gs, { id: id(), type: 'move', from: 'inv', fs: wi, to: f.station!.fuelC, qty: 1 }, T0).ok).toBe(true);
    for (let k = 0; k < 5; k++) expect(dispatch(gs, { id: id(), type: 'craft', recipe: 'iron_ingot', eid: f.id }, T0).ok).toBe(true);
    const rep = settle(gs, T0 + 10 * 60000);
    expect(countItem(r, f.station!.outC, 'iron_ingot')).toBe(2); // 20s fuel / 10s per ingot
    expect(f.station!.queue.length).toBe(3); expect(rep.join(' ')).toMatch(/fuel ran out/);
  });
  it('sheltered player cannot die from hunger alone offline; unsheltered can and leaves one bag', () => {
    const gs = fresh(); const r = gs.run!; const w = getWorld(); const b = w.buildings.find(b => b.id === 'b_tp')!;
    tp(gs, (b.x + 2) * TILE + 8, (b.y + 2) * TILE + 8); r.player.hunger = 0; r.player.thirst = 0; r.player.hp = 20; r.clock.lastSimAt = T0;
    settle(gs, T0 + 20 * HOUR); expect(r.player.dead).toBe(false); expect(r.player.hp).toBeGreaterThanOrEqual(1);
    const gs2 = fresh(1); const r2 = gs2.run!; r2.player.hunger = 0; r2.player.thirst = 0; r2.player.hp = 20; r2.clock.lastSimAt = T0;
    settle(gs2, T0 + 20 * HOUR); expect(r2.player.dead).toBe(true); expect(Object.values(r2.entities).filter(e => e.kind === 'bag').length).toBe(1);
  });
});

describe('C08/C14 traces & AI knowledge', () => {
  it('rain erodes footprints faster than clear weather', () => {
    const gs = fresh(); const r = gs.run!; r.traces = [{ x: 0, y: 0, t: T0, life: 100000, a: 0, s: T.GRASS }, { x: 0, y: 0, t: T0, life: 100000, a: 0, s: T.GRASS }];
    decayTraces(r, 20000, 'clear'); expect(r.traces[0].life).toBe(80000);
    const rr = { ...r, traces: [{ x: 0, y: 0, t: T0, life: 100000, a: 0, s: T.GRASS }] }; decayTraces(rr as any, 30000, "rain"); expect(rr.traces.length).toBe(0);
  });
  it('a creature with no sensed trail never learns where the player/home is; a real trail is followed', () => {
    const gs = fresh(); const r = gs.run!; const p = r.player; r.creatures = r.creatures.filter(c => c.elder);
    const m: any = { id: 'w1', type: 'wolf', x: p.x + 200, y: p.y, hp: 30, maxHp: 30, homeX: p.x + 200, homeY: p.y, state: 'wander', t: 0, tx: p.x + 200, ty: p.y, angle: 0, dir: 0, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0 };
    r.creatures.push(m); r.traces = [];
    for (let k = 0; k < 120; k++) tick(gs, idle(p.x, p.y), 16, T0 + k * 16);
    expect(m.knows === null || m.knows.kind !== 'trace').toBe(true);
    // lay a physical trail from the wolf toward the player
    r.traces = []; for (let k = 0; k <= 20; k++) r.traces.push({ x: m.x - k * 9, y: m.y, t: T0 + k * 1000, life: 999999, a: Math.PI, s: T.GRASS });
    let tracked = false; for (let k = 0; k < 200; k++) { tick(gs, idle(p.x, p.y), 16, T0 + 5000 + k * 16); if (m.knows?.kind === 'trace') tracked = true; }
    expect(tracked).toBe(true);
  });
});

describe('C10 death bag', () => {
  it('death moves items once into a unique bag that survives save/reload', () => {
    const gs = fresh(); const r = gs.run!; addItem(r, 'inv', 'stone', 9); const before = totalItems(gs, 'stone');
    killPlayer(gs, T0, 'test'); killPlayer(gs, T0, 'test');
    const copy: GameState = JSON.parse(JSON.stringify(gs)); const bags = Object.values(copy.run!.entities).filter(e => e.kind === 'bag');
    expect(bags.length).toBe(1); let s = 0; for (const c of Object.values(copy.run!.custody)) for (const st of c.slots) if (st?.key === 'stone') s += st.qty; expect(s).toBe(before);
    expect(dispatch(gs, { id: id(), type: 'respawn' }, T0).ok).toBe(true); expect(r.player.dead).toBe(false);
  });
});

describe('C03 charged core', () => {
  it('cancel before release uses no charge; release spends exactly one', () => {
    const gs = fresh(); const r = gs.run!; const p = r.player; addItem(r, 'inv', 'core_fire', 1); const ci = C(r, 'inv').slots.findIndex(s => s?.key === 'core_fire'); p.active = ci;
    tick(gs, { ...idle(p.x + 50, p.y), attackPressed: true }, 16, T0 + 16); tick(gs, { ...idle(p.x + 50, p.y), cancel: true }, 16, T0 + 32);
    expect(C(r, 'inv').slots[ci]!.charge).toBe(3);
    tick(gs, { ...idle(p.x + 50, p.y), attackPressed: true }, 16, T0 + 48); for (let k = 0; k < 40; k++) tick(gs, idle(p.x + 50, p.y), 16, T0 + 64 + k * 16);
    expect(C(r, 'inv').slots[ci]!.charge).toBe(2);
  });
});

describe('C04 research', () => {
  it('specimen study → physical blueprint → learned once; a second copy is refused without consumption', () => {
    const gs = fresh(); const r = gs.run!; const { tx, ty } = buildSpot(gs); tp(gs, tx * TILE + 8, (ty + 2) * TILE + 8);
    addItem(r, 'inv', 'wood', 40); addItem(r, 'inv', 'stone', 10); addItem(r, 'inv', 'spares', 10); addItem(r, 'inv', 'iron_ingot', 2); addItem(r, 'inv', 'wolf_fang', 1);
    dispatch(gs, { id: id(), type: 'build', struct: 'claim', tx, ty }, T0); expect(dispatch(gs, { id: id(), type: 'build', struct: 'research', tx: tx + 1, ty }, T0).ok).toBe(true);
    const tbl = Object.values(r.entities).find(e => e.type === 'research')!; const si = C(r, 'inv').slots.findIndex(s => s?.key === 'wolf_fang');
    expect(dispatch(gs, { id: id(), type: 'research', mode: 'specimen', slot: si, eid: tbl.id }, T0).ok).toBe(true);
    settle(gs, T0 + 60000); const out = C(r, tbl.station!.outC); const bpI = out.slots.findIndex(s => s?.key === 'blueprint'); expect(out.slots[bpI]!.meta).toBe('fur_cloak');
    expect(dispatch(gs, { id: id(), type: 'move', from: tbl.station!.outC, fs: bpI, to: 'inv' }, T0 + 60000).ok).toBe(true);
    const ii = C(r, 'inv').slots.findIndex(s => s?.key === 'blueprint'); expect(dispatch(gs, { id: id(), type: 'useItem', slot: ii }, T0).ok).toBe(true);
    expect(r.knowledge.recipes.filter(k => k === 'fur_cloak').length).toBe(1);
    addItem(r, 'inv', 'blueprint', 1, { meta: 'fur_cloak' }); const j = C(r, 'inv').slots.findIndex(s => s?.key === 'blueprint');
    expect(dispatch(gs, { id: id(), type: 'useItem', slot: j }, T0).ok).toBe(false); expect(C(r, 'inv').slots[j]?.key).toBe('blueprint');
  });
});

describe('C15–C18, C22–C23 Ragnarok cash, escrow, evacuation, run 2', () => {
  it('zero wallet → finite cash (only in last 72h) → vendor escrow chest → owned placement → atomic deposits → evacuate → run-2 spend', () => {
    const gs = fresh(); const r = gs.run!; expect(gs.profile.securedCash).toBe(0);
    const chest = Object.values(r.entities).find(e => e.kind === 'cash' && e.poi === 'tp')!; tp(gs, chest.x, chest.y + 16);
    expect(dispatch(gs, { id: id(), type: 'openCash', eid: chest.id }, T0).ok).toBe(false); // sealed before Ragnarok
    expect(totalItems(gs, 'rcash')).toBe(0);
    dispatch(gs, { id: id(), type: 'qaAdvance', hours: 265 }, T0); expect(r.qaUsed).toBe(true);
    expect(dispatch(gs, { id: id(), type: 'openCash', eid: chest.id }, T0).ok).toBe(true);
    dispatch(gs, { id: id(), type: 'openCash', eid: chest.id }, T0); expect(totalItems(gs, 'rcash')).toBe(36); // minted once
    expect(dispatch(gs, { id: id(), type: 'move', from: chest.c, fs: 0, to: 'inv' }, T0).ok).toBe(true);
    const vendor = Object.values(r.entities).find(e => e.kind === 'vendor')!; tp(gs, vendor.x, vendor.y + 16);
    expect(dispatch(gs, { id: id(), type: 'buy', eid: vendor.id, item: 'escrow_chest' }, T0).ok).toBe(true);
    expect(countItem(r, 'inv', 'rcash')).toBe(6); expect(countItem(r, 'inv', 'escrow_chest')).toBe(1);
    const { tx, ty } = buildSpot(gs); tp(gs, tx * TILE + 8, (ty + 2) * TILE + 8); addItem(r, 'inv', 'wood', 10); addItem(r, 'inv', 'stone', 5);
    expect(dispatch(gs, { id: id(), type: 'build', struct: 'escrow', tx: tx + 1, ty }, T0).ok).toBe(false); // not owned land
    expect(dispatch(gs, { id: id(), type: 'build', struct: 'claim', tx, ty }, T0).ok).toBe(true);
    expect(dispatch(gs, { id: id(), type: 'build', struct: 'escrow', tx: tx + 1, ty }, T0).ok).toBe(true);
    const esc = Object.values(r.entities).find(e => e.type === 'escrow')!; expect(claimAt(r, esc.tx!, esc.ty!)).toBeTruthy();
    const dep = id(); expect(dispatch(gs, { id: dep, type: 'deposit', eid: esc.id }, T0).ok).toBe(true);
    expect(gs.profile.securedCash).toBe(6); expect(countItem(r, 'inv', 'rcash')).toBe(0);
    expect(dispatch(gs, { id: dep, type: 'deposit', eid: esc.id }, T0)).toMatchObject({ ok: false, dup: true }); expect(gs.profile.securedCash).toBe(6);
    expect(dispatch(gs, { id: id(), type: 'deposit', eid: esc.id }, T0).ok).toBe(false);
    addItem(r, 'inv', 'rcash', 5); expect(dispatch(gs, { id: id(), type: 'deposit', eid: esc.id }, T0).ok).toBe(true); expect(gs.profile.securedCash).toBe(11); // repeat deposits, run continues
    expect(gs.run).toBeTruthy();
    addItem(r, 'inv', 'rcash', 50); // unsecured cash is NOT auto-secured at evacuation
    const ev = Object.values(r.entities).find(e => e.kind === 'evac')!; tp(gs, ev.x, ev.y + 16);
    expect(dispatch(gs, { id: id(), type: 'evacuate', eid: ev.id }, T0).ok).toBe(true);
    expect(gs.run).toBeNull(); expect(endRun(gs, 'evacuated', T0).ok).toBe(false);
    expect(gs.profile.securedCash).toBe(11); expect(gs.profile.history.length).toBe(1); expect(gs.profile.history[0].verified).toBe('LOCAL/UNVERIFIED'); expect(gs.profile.history[0].qa).toBe(true);
    // run 2: total wipe; secured cash spent at a physical stocked vendor creates run-local items
    expect(dispatch(gs, { id: id(), type: 'startRun', character: 'male', region: 2, seed: 99 }, T0 + 1000).ok).toBe(true);
    const r2 = gs.run!; expect(totalItems(gs, 'escrow_chest')).toBe(0); expect(Object.values(r2.entities).some(e => e.type === 'claim' || e.type === 'escrow')).toBe(false);
    expect(r2.knowledge.recipes.includes('fur_cloak')).toBe(false); expect(totalItems(gs, 'rcash')).toBe(0);
    const v2 = Object.values(r2.entities).find(e => e.kind === 'vendor')!; tp(gs, v2.x, v2.y + 16);
    expect(dispatch(gs, { id: id(), type: 'buy', eid: v2.id, item: 'iron_pick' }, T0 + 1000).ok).toBe(false); // 11 < 12: no partial debit
    expect(gs.profile.securedCash).toBe(11);
    expect(dispatch(gs, { id: id(), type: 'buy', eid: v2.id, item: 'medkit' }, T0 + 1000).ok).toBe(true);
    expect(gs.profile.securedCash).toBe(7); expect(countItem(r2, 'inv', 'medkit')).toBe(1);
  });
  it('run-2 secured purchase debits the profile exactly once', () => {
    const gs = fresh(); gs.profile.securedCash = 20; const r = gs.run!; const v = Object.values(r.entities).find(e => e.kind === 'vendor')!; tp(gs, v.x, v.y + 16);
    const bid = id(); expect(dispatch(gs, { id: bid, type: 'buy', eid: v.id, item: 'iron_pick' }, T0).ok).toBe(true); dispatch(gs, { id: bid, type: 'buy', eid: v.id, item: 'iron_pick' }, T0);
    expect(gs.profile.securedCash).toBe(8); expect(countItem(r, 'inv', 'iron_pick')).toBe(1);
    expect(dispatch(gs, { id: id(), type: 'buy', eid: v.id, item: 'iron_pick' }, T0).ok).toBe(false); // finite stock
    void sourceAt;
  });
});
