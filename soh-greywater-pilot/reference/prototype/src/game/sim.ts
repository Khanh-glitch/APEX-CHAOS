// Deterministic-ish real-time simulation layered on the engine authority. All state mutation goes through engine helpers.
import { BAL, TILE, WW, WH, T, rngNext, dist, clamp, angDiff, dirFromAngle, type GameState, type RunState, type Creature, type Entity } from './core';
import { ITEMS, CREATURES, ELDERS, STRUCTS, SOURCES } from './catalog';
import { getWorld } from './world';
import { dispatch, effTile, blockGrid, harvestHit, killCreature, killPlayer, markDirty, sourceAt, stepStations, stepGardensBarrels, weatherAt, isWet, isSheltered, phaseOf, darkness, endRun, bagContainers, receipt, pushLog, C, countItem, removeItem, award, trySpawnCreature, mkCreature, entsAt, isRagnarok, countStones } from './engine';

export interface Input { up: boolean; down: boolean; left: boolean; right: boolean; mx: number; my: number; attack: boolean; attackPressed: boolean; roll: boolean; cancel: boolean }
export const FX: any[] = []; // observed effects for renderer/audio (never authoritative)
const fx = (type: string, d: any = {}) => { if (FX.length < 400) FX.push({ type, ...d }); };
export interface Proj { x: number; y: number; vx: number; vy: number; life: number; dmg: number; from: 'player' | 'enemy'; kind: string; r: number; delay?: number; homing?: number; owner?: string }
export interface Haz { kind: 'circle' | 'line' | 'ring' | 'wave' | 'sweep' | 'pool'; x: number; y: number; r?: number; angle?: number; len?: number; w?: number; t: number; tell: number; dur: number; dmg: number; style: string; effect?: string; hit?: boolean; tickAcc?: number; a0?: number; a1?: number; done?: boolean; owner?: string; elder?: string }
export const PROJ: Proj[] = [];
export const HAZ: Haz[] = [];
let traceAcc = 0, slowTimer = 0, rootTimer = 0, shelterAcc = 0, fireAcc = 0, lightningAcc = 0, discoverAcc = 0;
let ragAnnounced = '';

const FISTS = { name: 'Fists', dmg: 4, reach: 16, arc: 1.2, swing: 280, power: { plant: 1 } } as any;
const SURF: Record<number, string> = { [T.SNOW]: 'snow', [T.MARSH]: 'marsh', [T.SAND]: 'sand', [T.ASH]: 'ash', [T.GRASS]: 'grass', [T.MEADOW]: 'meadow', [T.FOREST]: 'forest', [T.HILL]: 'hill', [T.ROAD]: 'road', [T.BRIDGE]: 'bridge', [T.FLOOR]: 'floor', [T.BURNT]: 'burnt', [T.TOXIC]: 'toxic', [T.ICE]: 'ice' };
export const SPEED_KEY: Record<number, string> = { ...SURF, [T.SHALLOW]: 'shallow', [T.RIVER]: 'shallow' };

export function activeStack(r: RunState) { return C(r, 'inv').slots[r.player.active]; }
const tileOf = (v: number) => Math.floor(v / TILE);
function solidFor(r: RunState, x: number, y: number, who: 'player' | 'creature' | 'cart') {
  const tx = tileOf(x), ty = tileOf(y); if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return true;
  const b = blockGrid(r)[ty * WW + tx];
  if (b === 4) return who === 'cart' || (who === 'creature' && false);
  return b === 1 || b === 2 || b === 3 || b === 5;
}
function moveBody(r: RunState, o: { x: number; y: number }, dx: number, dy: number, rad: number, who: 'player' | 'creature' | 'cart') {
  let hit = false;
  const nx = o.x + dx; if (!solidFor(r, nx + Math.sign(dx) * rad, o.y - rad + 1, who) && !solidFor(r, nx + Math.sign(dx) * rad, o.y + rad - 1, who)) o.x = nx; else if (dx) hit = true;
  const ny = o.y + dy; if (!solidFor(r, o.x - rad + 1, ny + Math.sign(dy) * rad, who) && !solidFor(r, o.x + rad - 1, ny + Math.sign(dy) * rad, who)) o.y = ny; else if (dy) hit = true;
  return hit;
}
function los(r: RunState, ax: number, ay: number, bx: number, by: number, blockTrees = false) {
  const d = dist(ax, ay, bx, by); const n = Math.ceil(d / 8); const g = blockGrid(r);
  for (let i = 1; i < n; i++) { const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; const b = g[tileOf(y) * WW + tileOf(x)]; if (b === 1 || b === 3 || (blockTrees && b === 2)) return false; }
  return true;
}
function rayLen(r: RunState, x: number, y: number, a: number, max: number) { const g = blockGrid(r); for (let d = 8; d < max; d += 4) { const b = g[tileOf(y + Math.sin(a) * d) * WW + tileOf(x + Math.cos(a) * d)]; if (b === 1 || b === 2 || b === 3) return d; } return max; }

// ---------- player damage ----------
export function hurtPlayer(gs: GameState, dmg: number, fx0: number, fy0: number, cause: string, now: number, kb = 140) {
  const r = gs.run!; const p = r.player; if (p.dead) return false;
  if (p.invuln > 0 || p.action?.kind === 'roll') { fx('dodge', { x: p.x, y: p.y }); return false; }
  let armor = 0; for (const s of C(r, 'eq').slots) if (s) armor += ITEMS[s.key].armor || 0;
  const d = Math.max(1, Math.round(dmg * (1 - Math.min(0.6, armor))));
  p.hp -= d; p.invuln = 520; const a = Math.atan2(p.y - fy0, p.x - fx0);
  moveBody(r, p, Math.cos(a) * kb * 0.06, Math.sin(a) * kb * 0.06, 4, 'player');
  if (p.action?.kind === 'cast') { fx('fizzle', { x: p.x, y: p.y }); dispatch(gs, { id: 'cc' + now + Math.random(), type: 'castCancel' }, now); }
  p.action = { kind: 'hurt', t: 0, dur: 220, angle: a };
  fx('phit', { x: p.x, y: p.y, n: d, a }); fx('shake', { m: Math.min(4, 1 + d / 8) });
  if (p.hp <= 0) { killPlayer(gs, now, cause); fx('pdeath', { x: p.x, y: p.y }); }
  return true;
}
function damageCreature(gs: GameState, m: Creature, dmg: number, a: number, now: number, kb = 130) {
  if (m.state === 'dead' || m.elder?.submerged || m.atk?.burrow) return false;
  const r = gs.run!;
  if (m.type === 'crab' && m.atk?.tuck > 0) dmg *= 0.25;
  if (m.elder && m.atk?.vuln > 0) dmg *= 2;
  dmg = Math.round(dmg * (1 + r.player.skills.combat * 0.002));
  m.hp -= dmg; m.flash = 120; const kbm = m.elder ? 0.12 : 1; m.kbx += Math.cos(a) * kb * kbm; m.kby += Math.sin(a) * kb * kbm;
  (m as any).prov = true; m.knows = { kind: 'sight', x: r.player.x, y: r.player.y, at: now };
  if (m.type === 'crab') m.atk = { ...(m.atk || {}), tuck: 900 };
  if (m.elder && m.state === 'sleep') wakeElder(gs, m, now);
  fx('mhit', { x: m.x, y: m.y, n: dmg, a, big: !!m.elder }); fx('hitstop', { ms: m.elder ? 70 : 55 });
  if (m.hp <= 0) { killCreature(gs, m, now); fx('mdeath', { x: m.x, y: m.y, type: m.type }); fx('shake', { m: m.elder ? 6 : 2 }); }
  return true;
}
function wakeElder(gs: GameState, m: Creature, now: number) {
  if (m.state !== 'sleep') return; m.state = 'chase'; m.cd = 1200; const d = ELDERS[m.elder!.key];
  fx('banner', { text: `${d.name}`, sub: m.elder!.awake ? `${d.title} — AWAKENED` : `${d.title} — latent form` });
  receipt(gs.run!, now, 'elder.engage', m.elder!.key);
}

// ---------- fire (K2 terrain mutation with committed causes) ----------
export function ignite(gs: GameState, tx: number, ty: number, now: number) {
  const r = gs.run!; if (isWet(weatherAt(r, now))) return false;
  const s = sourceAt(r, tx, ty, now); const i = ty * WW + tx;
  if (s && s.def.mat === 'wood' && s.def.tall && s.stock > 0 && !s.st?.burnt && !(s.fire && s.fire > r.clock.simMs)) {
    const st = r.sources[i] || (r.sources[i] = { stock: s.stock, hp: s.hp }); (st as any).fire = r.clock.simMs + 5000 + rngNext(r) * 3000; fx('ignite', { x: tx * TILE + 8, y: ty * TILE + 8 }); return true;
  }
  const t = effTile(r, tx, ty); if (t === T.GRASS || t === T.MEADOW || t === T.FOREST) { r.terrain[i] = { t: T.BURNT }; fx('scorch', { x: tx * TILE + 8, y: ty * TILE + 8 }); markDirty(); return true; }
  return false;
}
function stepFires(gs: GameState, now: number, dtMs: number) {
  const r = gs.run!; const wet = isWet(weatherAt(r, now)); fireAcc += dtMs; const doSpread = fireAcc > 900; if (doSpread) fireAcc = 0;
  for (const k in r.sources) {
    const st: any = r.sources[k]; if (!st.fire) continue; const i = +k, tx = i % WW, ty = (i / WW) | 0;
    if (wet) { st.fire = 0; fx('steam', { x: tx * TILE + 8, y: ty * TILE + 8 }); continue; }
    if (st.fire <= r.clock.simMs) { st.fire = 0; st.burnt = true; st.stock = SOURCES.deadtree.stock; st.hp = SOURCES.deadtree.hp; const t = effTile(r, tx, ty); if (t !== T.SAND && t !== T.SNOW) r.terrain[i] = { t: T.BURNT }; markDirty(); receipt(r, now, 'fire.burnout', `${tx},${ty}`); continue; }
    if (doSpread) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) if (rngNext(r) < 0.16) ignite(gs, tx + dx, ty + dy, now);
      const p = r.player; if (dist(p.x, p.y, tx * TILE + 8, ty * TILE + 8) < 18) hurtPlayer(gs, 6, tx * TILE + 8, ty * TILE + 8, 'fire', now, 60);
      for (const m of r.creatures) if (m.state !== 'dead' && dist(m.x, m.y, tx * TILE + 8, ty * TILE + 8) < 18) damageCreature(gs, m, 8, 0, now, 0);
    }
  }
}

// ---------- traces (K2/K5) ----------
function surfaceLife(t: number) { const k = SURF[t]; return k ? (BAL.traces[k] ?? 120) * 1000 : 0; }
function traceMult(w: string, surf: number) { let m = 1; if (w === 'rain') m = BAL.traces.rainDecayMult; if (w === 'storm') m = BAL.traces.stormDecayMult; if (surf === T.FLOOR || surf === T.BRIDGE) m = Math.min(m, 2); return m; }
export function decayTraces(r: RunState, dtMs: number, weather: string) {
  for (const tr of r.traces) tr.life -= dtMs * traceMult(weather, tr.s);
  if (r.traces.length && r.traces[0].life <= 0) r.traces = r.traces.filter(t => t.life > 0);
}

// ---------- core effects (C03: charge debited at commit, not windup) ----------
function commitCore(gs: GameState, now: number, slot: number, a: number) {
  const r = gs.run!; const p = r.player; const s = C(r, 'inv').slots[slot];
  if (!s || !ITEMS[s.key].core || (s.charge ?? 0) <= 0) { fx('fizzle', { x: p.x, y: p.y }); return; }
  s.charge!--; receipt(r, now, 'core.commit', `${s.key} charge→${s.charge}`); award(gs, 'first_core', now);
  const core = ITEMS[s.key].core; const hx = p.x + Math.cos(a) * 10, hy = p.y + Math.sin(a) * 10;
  fx('cast', { x: hx, y: hy, core, a });
  if (core === 'fire') PROJ.push({ x: hx, y: hy, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 0.95, dmg: 45, from: 'player', kind: 'fireball', r: 5 });
  if (core === 'earth') { for (let k = 1; k <= 8; k++) HAZ.push({ kind: 'circle', x: p.x + Math.cos(a) * k * 15, y: p.y + Math.sin(a) * k * 15, r: 9, t: 0, tell: k * 55, dur: 120, dmg: 32, style: 'spike', effect: 'quake', owner: 'player' }); fx('shake', { m: 3 }); }
  if (core === 'storm') {
    const wet = isWet(weatherAt(r, now)); let fromX = p.x, fromY = p.y; const hitSet = new Set<string>(); let any = false;
    for (let j = 0; j < 4; j++) {
      let best: Creature | null = null, bd = j ? 80 : 140;
      for (const m of r.creatures) { if (m.state === 'dead' || hitSet.has(m.id)) continue; const d = dist(fromX, fromY, m.x, m.y); if (d < bd && (j || Math.abs(angDiff(Math.atan2(m.y - p.y, m.x - p.x), a)) < 0.9)) { bd = d; best = m; } }
      if (!best) break; hitSet.add(best.id); any = true; fx('bolt', { x0: fromX, y0: fromY, x1: best.x, y1: best.y }); damageCreature(gs, best, wet ? 45 : 30, Math.atan2(best.y - fromY, best.x - fromX), now, 60); fromX = best.x; fromY = best.y;
    }
    if (!any) { const tx = p.x + Math.cos(a) * 90, ty = p.y + Math.sin(a) * 90; fx('bolt', { x0: p.x, y0: p.y, x1: tx, y1: ty }); ignite(gs, tileOf(tx), tileOf(ty), now); }
  }
  if (core === 'frost') {
    HAZ.push({ kind: 'ring', x: p.x, y: p.y, r: 60, t: 0, tell: 0, dur: 380, dmg: 20, style: 'frostnova', effect: 'slowm', owner: 'player' });
    const cx = tileOf(p.x), cy = tileOf(p.y); let froze = 0;
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) { if (Math.hypot(x - cx, y - cy) > 4.2) continue; const t = effTile(r, x, y); if (t === T.SHALLOW || t === T.RIVER) { r.terrain[y * WW + x] = { t: T.ICE, until: r.clock.simMs + 90000 }; froze++; } if ((r.sources[y * WW + x] as any)?.fire) (r.sources[y * WW + x] as any).fire = 0; }
    if (froze) { markDirty(); pushLog(r, now, `The water freezes solid (${froze} tiles) — for now.`, 'blue'); }
  }
}

// ---------- player ----------
function tickPlayer(gs: GameState, inp: Input, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player; const dt = dtMs / 1000; const B = BAL.player;
  if (p.dead) { p.deadT += dtMs; return; }
  p.invuln = Math.max(0, p.invuln - dtMs);
  p.aim = Math.atan2(inp.my - p.y, inp.mx - p.x);
  let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); const ml = Math.hypot(mx, my); if (ml) { mx /= ml; my /= ml; }
  const act = p.action;
  // start actions
  if (inp.roll && p.stamina >= B.rollCost && (!act || act.kind === 'hurt' || (act.kind === 'swing' && act.done))) {
    p.stamina -= B.rollCost; p.action = { kind: 'roll', t: 0, dur: B.rollMs, angle: ml ? Math.atan2(my, mx) : p.aim }; p.invuln = Math.max(p.invuln, B.rollMs - 40); fx('roll', { x: p.x, y: p.y });
  } else if (inp.cancel && act?.kind === 'cast') { dispatch(gs, { id: 'cc' + now, type: 'castCancel' }, now); p.action = null; fx('fizzle', { x: p.x, y: p.y }); }
  else if ((inp.attackPressed || inp.attack) && !p.action) {
    const s = activeStack(r); const d = s ? ITEMS[s.key] : null;
    if (d?.core) { if ((s!.charge ?? 0) > 0) { p.action = { kind: 'cast', t: 0, dur: 520, contact: 460, angle: p.aim, slot: p.active }; fx('windup', { x: p.x, y: p.y, core: d.core }); } else if (inp.attackPressed) fx('toast', { text: 'This Core is spent. Study it at a Research Table.' }); }
    else if (d && d.food && inp.attackPressed) { const res = dispatch(gs, { id: 'use' + now, type: 'useItem', slot: p.active }, now); fx(res.ok ? 'eat' : 'toast', { x: p.x, y: p.y, text: res.ok ? '' : (res as any).reason }); }
    else if (d && d.cat === 'bp' && inp.attackPressed) { const res = dispatch(gs, { id: 'use' + now, type: 'useItem', slot: p.active }, now); fx('toast', { text: res.ok ? res.msg : (res as any).reason }); }
    else if (s?.key === 'cart_kit' && inp.attackPressed) { const res = dispatch(gs, { id: 'cart' + now, type: 'placeCart', x: inp.mx, y: inp.my }, now); fx('toast', { text: res.ok ? 'Cart unpacked. Press F next to it to pull.' : (res as any).reason }); }
    else if (d && (d.slot || d.cat === 'kit' || d.cat === 'res' || d.cat === 'cash' || d.cat === 'stone' || d.cat === 'misc') && !d.dmg) { if (inp.attackPressed) { const tool = FISTS; p.action = { kind: 'swing', t: 0, dur: tool.swing, contact: tool.swing * 0.45, angle: p.aim, slot: -1 }; } }
    else if (d?.ranged) { if (countItem(r, 'inv', 'arrow') > 0) p.action = { kind: 'swing', t: 0, dur: d.swing!, contact: d.swing! * 0.62, angle: p.aim, slot: p.active }; else if (inp.attackPressed) fx('toast', { text: 'No arrows.' }); }
    else { const tool = d?.dmg ? d : FISTS; p.action = { kind: 'swing', t: 0, dur: tool.swing, contact: tool.swing * 0.45, angle: p.aim, slot: d?.dmg ? p.active : -1 }; fx('whoosh', { x: p.x, y: p.y }); }
  }
  // progress action
  let speedMul = 1; const a2 = p.action;
  if (a2) {
    a2.t += dtMs;
    if (a2.kind === 'swing') { speedMul = 0.45; if (!a2.done && a2.t >= (a2.contact || 0)) { a2.done = true; resolveSwing(gs, now, a2.slot ?? -1, a2.angle); } }
    if (a2.kind === 'cast') { speedMul = 0.3; a2.angle = p.aim; if (!a2.done && a2.t >= (a2.contact || 0)) { a2.done = true; commitCore(gs, now, a2.slot!, p.aim); } }
    if (a2.kind === 'hurt') speedMul = 0.6;
    if (a2.t >= a2.dur) p.action = null;
  }
  // terrain & load
  const t = effTile(r, tileOf(p.x), tileOf(p.y));
  let sp = B.speed * (BAL.terrainSpeed[SPEED_KEY[t]] ?? 1) * speedMul;
  const w = invWeightCached(r); if (w > B.carryLimit) sp *= Math.max(0.35, 1 - (w - B.carryLimit) / B.carryLimit);
  if (slowTimer > 0) { sp *= 0.5; slowTimer -= dtMs; } if (rootTimer > 0) { sp *= 0.15; rootTimer -= dtMs; }
  let cart: Entity | null = p.pulling ? r.entities[p.pulling] : null; if (p.pulling && !cart) p.pulling = null;
  if (cart) { const ct = effTile(r, tileOf(cart.x), tileOf(cart.y)); const road = ct === T.ROAD || ct === T.BRIDGE || ct === T.FLOOR; const rough = ct === T.FOREST || ct === T.MARSH || ct === T.HILL || ct === T.SNOW;
    const base = road ? BAL.cart.speedOnRoad : rough ? BAL.cart.speedRough : BAL.cart.speedOffRoad; const cw = cartWeightOf(r, cart);
    sp = B.speed * speedMul * base * Math.max(0.25, 1 - cw / 100 * BAL.cart.weightPenaltyPer100) * (cw > BAL.cart.maxWeight ? 0.4 : 1); }
  if (p.action?.kind === 'roll') { const ra = p.action.angle; moveBody(r, p, Math.cos(ra) * B.rollSpeed * dt, Math.sin(ra) * B.rollSpeed * dt, 4, 'player'); }
  else if (ml) { moveBody(r, p, mx * sp * dt, my * sp * dt, 4, 'player'); p.stepAcc += sp * dt; if (p.stepAcc > 13) { p.stepAcc = 0; fx('step', { x: p.x, y: p.y + 6, t }); } }
  p.vx = ml ? mx * sp : 0; p.vy = ml ? my * sp : 0;
  p.dir = dirFromAngle(p.aim);
  // cart rope
  if (cart) {
    const d = dist(p.x, p.y, cart.x, cart.y);
    if (d > 15) { const a = Math.atan2(p.y - cart.y, p.x - cart.x); const step = d - 15; const ox = cart.x, oy = cart.y; moveBody(r, cart, Math.cos(a) * step, Math.sin(a) * step, 5, 'cart'); if (Math.hypot(cart.x - ox, cart.y - oy) < step * 0.3 && d > 26) { const b = Math.atan2(p.y - cart.y, p.x - cart.x); p.x = cart.x + Math.cos(b) * 26; p.y = cart.y + Math.sin(b) * 26; fx('toast', { text: 'The cart is stuck — carts cannot ford water or squeeze through.', key: 'cartstuck' }); } }
  }
  // stamina
  if (!p.action || p.action.kind === 'hurt') p.stamina = Math.min(B.maxStamina, p.stamina + B.staminaRegen * dt * (p.hunger > 10 ? 1 : 0.4));
  // footprints (physical traces)
  traceAcc += Math.hypot(p.vx, p.vy) * dt + (p.action?.kind === 'roll' ? B.rollSpeed * dt : 0);
  if (traceAcc > 10) { traceAcc = 0; const life = surfaceLife(t); if (life > 0) { r.traces.push({ x: p.x, y: p.y + 5, t: now, life, a: Math.atan2(p.vy, p.vx), s: t }); if (r.traces.length > 2600) r.traces.splice(0, 200); } }
}
let wCache = { rev: -1, w: 0 }; let wTick = 0;
function invWeightCached(r: RunState) { if (++wTick % 15 === 0 || wCache.rev < 0) { let w = 0; for (const cid of ['inv', 'eq']) for (const s of C(r, cid).slots) if (s) w += ITEMS[s.key].w * s.qty; wCache = { rev: 1, w }; } return wCache.w; }
function cartWeightOf(r: RunState, e: Entity) { return C(r, e.c!).slots.reduce((a, s) => a + (s ? ITEMS[s.key].w * s.qty : 0), 0); }

function resolveSwing(gs: GameState, now: number, slot: number, a: number) {
  const r = gs.run!; const p = r.player; const s = slot >= 0 ? C(r, 'inv').slots[slot] : null; const d = s ? ITEMS[s.key] : FISTS;
  if (d.ranged) { // bow: arrow consumed at release
    if (countItem(r, 'inv', 'arrow') < 1) return; removeItem(r, 'inv', 'arrow', 1);
    PROJ.push({ x: p.x + Math.cos(a) * 8, y: p.y + Math.sin(a) * 8, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 0.85, dmg: d.dmg, from: 'player', kind: 'arrow', r: 3 }); fx('bowshot', { x: p.x, y: p.y, a });
    wearTool(gs, slot, now); return;
  }
  const R = d.reach, A = d.arc; let hitAny = false;
  fx('slash', { x: p.x, y: p.y - 2, a, reach: R, arc: A, key: s?.key || 'fists' });
  for (const m of r.creatures) {
    if (m.state === 'dead') continue; const dd = dist(p.x, p.y, m.x, m.y) - (m.elder ? ELDERS[m.elder.key].r : CREATURES[m.type]?.r || 6);
    if (dd > R) continue; const ang = Math.atan2(m.y - p.y, m.x - p.x); if (dd > 6 && Math.abs(angDiff(ang, a)) > A / 2 + 0.15) continue;
    if (!los(r, p.x, p.y, m.x, m.y)) continue;
    if (damageCreature(gs, m, d.dmg, a, now)) hitAny = true;
  }
  // structures (spikes etc. not hittable); sources — one per swing, nearest in arc
  let best: { tx: number; ty: number; d: number } | null = null;
  for (let rr = 6; rr <= R + 4; rr += 5) for (let k = -2; k <= 2; k++) {
    const ang = a + (A / 2) * (k / 2); const x = p.x + Math.cos(ang) * rr, y = p.y + Math.sin(ang) * rr; const tx = tileOf(x), ty = tileOf(y);
    const src = sourceAt(r, tx, ty, now); if (!src) continue; const dd = dist(p.x, p.y, tx * TILE + 8, ty * TILE + 8); if (!best || dd < best.d) best = { tx, ty, d: dd };
  }
  if (best) {
    const res = harvestHit(gs, best.tx, best.ty, d.power || {}, now, p.x, p.y);
    const x = best.tx * TILE + 8, y = best.ty * TILE + 8;
    if (res.result === 'yield') { fx('chip', { x, y, mat: res.mat, key: res.key, depleted: res.depleted }); hitAny = true; if (res.depleted) fx('fell', { x, y, key: res.key }); }
    else if (res.result === 'nopower') { fx('clank', { x, y, mat: res.mat }); fx('toast', { text: res.mat === 'wood' ? 'Too slow with this — an axe would fell it.' : res.mat === 'stone' || res.mat === 'ore' ? 'You need a pickaxe for this.' : 'Wrong tool for this.', key: 'tool' + res.mat }); }
    else if (res.result === 'empty') fx('clank', { x, y, mat: res.mat, soft: true });
    if (s?.key === 'torch') ignite(gs, best.tx, best.ty, now);
  }
  if (hitAny && slot >= 0) wearTool(gs, slot, now);
}
function wearTool(gs: GameState, slot: number, now: number) {
  const r = gs.run!; const s = C(r, 'inv').slots[slot]; if (!s || s.dur === undefined) return;
  s.dur--; if (s.dur <= 0) { C(r, 'inv').slots[slot] = null; fx('break', { x: r.player.x, y: r.player.y }); pushLog(r, now, `${ITEMS[s.key].name} broke.`, 'red'); receipt(r, now, 'tool.break', s.key); }
}

// ---------- creatures ----------
function astar(r: RunState, sx: number, sy: number, gx: number, gy: number, limit = 700): number[] | null {
  const g = blockGrid(r); const open: [number, number][] = [[0, sy * WW + sx]]; const came = new Map<number, number>(); const cost = new Map<number, number>([[sy * WW + sx, 0]]); const goal = gy * WW + gx; let n = 0;
  while (open.length && n++ < limit) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i; const [, cur] = open.splice(bi, 1)[0];
    if (cur === goal) { const path = [cur]; let c = cur; while (came.has(c)) { c = came.get(c)!; path.push(c); } return path.reverse(); }
    const cx = cur % WW, cy = (cur / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const j = ny * WW + nx; const b = g[j]; if ((b !== 0 && b !== 4) && j !== goal) continue;
      const nc = cost.get(cur)! + (b === 4 ? 3 : 1); if (nc < (cost.get(j) ?? 1e9)) { cost.set(j, nc); came.set(j, cur); open.push([nc + Math.abs(nx - gx) + Math.abs(ny - gy), j]); } }
  }
  return null;
}
function steer(gs: GameState, m: Creature, tx: number, ty: number, sp: number, dt: number, now: number) {
  const r = gs.run!; const d = dist(m.x, m.y, tx, ty); if (d < 2) return;
  let ax = tx, ay = ty;
  if (!los(r, m.x, m.y, tx, ty, true)) {
    m.pathT -= dt * 1000;
    if (!m.path || m.pathT <= 0) { m.path = astar(r, tileOf(m.x), tileOf(m.y), tileOf(tx), tileOf(ty)); m.pathT = 900; }
    if (m.path && m.path.length > 1) { const nxt = m.path[1]; ax = (nxt % WW) * TILE + 8; ay = ((nxt / WW) | 0) * TILE + 8; if (dist(m.x, m.y, ax, ay) < 4) m.path.shift(); }
  }
  const a = Math.atan2(ay - m.y, ax - m.x); m.angle = a; m.dir = dirFromAngle(a);
  const hit = moveBody(r, m, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, 4, 'creature');
  if (hit && (!m.path || m.path.length < 2)) bashAhead(gs, m, a, now);
}
function bashAhead(gs: GameState, m: Creature, a: number, now: number) {
  const r = gs.run!; if (m.cd > 0) return; const tx = tileOf(m.x + Math.cos(a) * 10), ty = tileOf(m.y + Math.sin(a) * 10);
  const e = entsAt(r, tx, ty).find(e => e.kind === 'struct' && (STRUCTS[e.type!].block)); if (!e) return;
  const dmg = m.elder ? ELDERS[m.elder.key].dmg * 2 : CREATURES[m.type].dmg; e.hp! -= dmg; m.cd = 900; fx('structhit', { x: e.x, y: e.y });
  if (e.hp! <= 0) { const cids = [e.c, e.station?.fuelC, e.station?.outC].filter(Boolean) as string[]; bagContainers(r, cids, e.x, e.y, now, 'Wreckage'); delete r.entities[e.id]; for (const c of cids) delete r.custody[c]; markDirty(); receipt(r, now, 'struct.destroyed', `${e.type} by ${m.type}`); pushLog(r, now, `${STRUCTS[e.type!].name} was smashed by a ${CREATURES[m.type]?.name || 'beast'}!`, 'red'); fx('structbreak', { x: e.x, y: e.y }); }
}

function tickCreatures(gs: GameState, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player; const dt = dtMs / 1000; const ACT = BAL.ai.activeRadiusTiles * TILE;
  const night = darkness(r, now) > 0.45; const rag = isRagnarok(r, now); const w = weatherAt(r, now);
  const g = blockGrid(r);
  for (let i = r.creatures.length - 1; i >= 0; i--) {
    const m = r.creatures[i];
    if (m.state === 'dead') { m.t += dtMs; if (!m.elder && m.t > 1600) r.creatures.splice(i, 1); continue; }
    const dp = dist(m.x, m.y, p.x, p.y); if (dp > ACT) continue; // off-screen beings are frozen (no fabricated remote actions)
    m.cd = Math.max(0, m.cd - dtMs); m.flash = Math.max(0, m.flash - dtMs); m.t += dtMs; if (m.slow) m.slow = Math.max(0, m.slow - dtMs);
    if (m.atk?.tuck) m.atk.tuck -= dtMs; if (m.atk?.vuln) m.atk.vuln -= dtMs;
    if (Math.abs(m.kbx) + Math.abs(m.kby) > 1) { moveBody(r, m, m.kbx * dt, m.kby * dt, 4, 'creature'); m.kbx *= 0.82; m.kby *= 0.82; }
    if (m.elder) { tickElder(gs, m, dtMs, now, dp); continue; }
    const d = CREATURES[m.type]; const spd = d.speed * (rag ? 1.2 : 1) * (m.slow ? 0.45 : 1);
    // spike traps
    const here = entsAt(r, tileOf(m.x), tileOf(m.y)).find(e => e.type === 'spikes'); if (here && m.cd <= 0) { damageCreature(gs, m, 12, 0, now, 0); m.cd = 700; here.hp! -= 4; }
    // in water? creatures avoid deep water — stuck ones wade
    const aggro = d.aggro || rag || (m as any).prov || (night && m.type === 'boar');
    // sensing
    const sight = (night ? BAL.ai.sightNight : BAL.ai.sightDay) * (d.sight / 100) * (w === 'fog' ? 0.6 : 1) * (p.sheltered ? 0.5 : 1);
    if (!p.dead && dp < sight && los(r, m.x, m.y, p.x, p.y)) { if (aggro) m.knows = { kind: 'sight', x: p.x, y: p.y, at: now }; }
    else if (aggro && (!m.knows || m.knows.kind === 'trace') && (m.t % 500) < dtMs) {
      // trace sensing — only physical footprints within reach (C08). Never home coordinates.
      const R = BAL.ai.traceSenseRadius; let best: any = null;
      for (const tr of r.traces) { if (tr.life <= 0) continue; if (Math.abs(tr.x - m.x) > R || Math.abs(tr.y - m.y) > R) continue; if (m.knows && tr.t <= m.knows.at) continue; if (!best || tr.t > best.t) best = tr; }
      if (best) { if (!m.knows) fx('sniff', { x: m.x, y: m.y - 10 }); m.knows = { kind: 'trace', x: best.x, y: best.y, at: best.t }; m.state = 'track'; }
    }
    if (m.knows?.kind === 'sight' && now - m.knows.at > 4000) { m.knows = { kind: 'trace', x: m.knows.x, y: m.knows.y, at: now - 4000 }; }
    // state machine
    switch (m.state) {
      case 'idle': case 'wander': case 'track': case 'chase': {
        if (m.knows) {
          if (m.knows.kind === 'sight') {
            m.state = 'chase'; const range = d.style === 'shoot' ? 110 : d.style === 'tongue' ? 74 : d.style === 'burrow' ? 100 : d.style === 'charge' ? 90 : d.style === 'lunge' ? 56 : 18;
            if (dp < range && m.cd <= 0 && los(r, m.x, m.y, p.x, p.y, d.style !== 'burrow')) { m.state = 'tell'; m.t = 0; m.angle = Math.atan2(p.y - m.y, p.x - m.x); m.dir = dirFromAngle(m.angle); fx('tell', { x: m.x, y: m.y - 10, style: d.style }); }
            else if (d.style === 'shoot' && dp < 70) steer(gs, m, m.x - (p.x - m.x), m.y - (p.y - m.y), spd, dt, now);
            else if (d.style === 'lunge' && dp < 70) { const a = Math.atan2(m.y - p.y, m.x - p.x) + 0.9 * dt * 2; steer(gs, m, p.x + Math.cos(a) * 46, p.y + Math.sin(a) * 46, spd, dt, now); }
            else steer(gs, m, p.x, p.y, spd, dt, now);
          } else {
            // follow footprints toward newer ones
            if (dist(m.x, m.y, m.knows.x, m.knows.y) < 7) {
              let nxt: any = null; for (const tr of r.traces) { if (tr.life <= 0 || tr.t <= m.knows.at) continue; if (dist(tr.x, tr.y, m.x, m.y) > 44) continue; if (!nxt || tr.t < nxt.t + 1500 && tr.t > nxt.t) nxt = tr; }
              if (nxt) m.knows = { kind: 'trace', x: nxt.x, y: nxt.y, at: nxt.t }; else { m.knows = null; m.state = 'wander'; fx('lost', { x: m.x, y: m.y - 10 }); }
            } else steer(gs, m, m.knows.x, m.knows.y, spd * 0.8, dt, now);
          }
        } else {
          m.state = 'wander';
          if (dist(m.x, m.y, m.tx, m.ty) < 4 || m.t > 5000) { m.t = 0; const a = rngNext(r) * Math.PI * 2, rr = rngNext(r) * 70; m.tx = m.homeX + Math.cos(a) * rr; m.ty = m.homeY + Math.sin(a) * rr; const b = g[tileOf(m.ty) * WW + tileOf(m.tx)]; if (b) { m.tx = m.x; m.ty = m.y; } }
          steer(gs, m, m.tx, m.ty, spd * 0.35, dt, now);
          if ((m.type === 'boar' || m.type === 'crab') && dp < 26 && !(m as any).prov && !night) { /* skittish */ steer(gs, m, m.x + (m.x - p.x), m.y + (m.y - p.y), spd * 0.6, dt, now); }
        }
        break;
      }
      case 'tell': {
        if (d.style === 'shoot' || d.style === 'tongue') m.angle = Math.atan2(p.y - m.y, p.x - m.x) * 0.0 + m.angle; // locked: dodgeable
        if (d.style === 'burrow' && !m.atk?.burrow) { m.atk = { burrow: true, bt: 0 }; }
        if (m.t >= d.tell) { m.state = 'attack'; m.t = 0; m.atk = { ...(m.atk || {}), hit: false };
          if (d.style === 'shoot') { PROJ.push({ x: m.x, y: m.y - 4, vx: Math.cos(m.angle) * 150, vy: Math.sin(m.angle) * 150, life: 1.6, dmg: d.dmg, from: 'enemy', kind: 'bolt', r: 3 }); fx('zap', { x: m.x, y: m.y }); }
          if (d.style === 'tongue') fx('tongue', { x: m.x, y: m.y, a: m.angle });
          if (d.style === 'burrow') { HAZ.push({ kind: 'circle', x: p.x, y: p.y, r: 18, t: 0, tell: 800, dur: 120, dmg: d.dmg, style: 'erupt', owner: m.id }); m.atk.target = { x: p.x, y: p.y }; }
        }
        break;
      }
      case 'attack': {
        const st = d.style;
        if (st === 'charge' || st === 'lunge') {
          const dur = st === 'charge' ? 560 : 230, s2 = st === 'charge' ? 215 : 250;
          const blocked = moveBody(r, m, Math.cos(m.angle) * s2 * dt, Math.sin(m.angle) * s2 * dt, 4, 'creature');
          if (!m.atk.hit && dist(m.x, m.y, p.x, p.y) < d.r + 7) { m.atk.hit = true; hurtPlayer(gs, d.dmg, m.x, m.y, d.name, now, 200); }
          if (blocked && st === 'charge') { const tx = tileOf(m.x + Math.cos(m.angle) * 9), ty = tileOf(m.y + Math.sin(m.angle) * 9); const src = sourceAt(r, tx, ty, now);
            if (src && src.def.mat === 'wood' && src.stock > 0) { harvestHit(gs, tx, ty, { wood: 4 }, now, m.x, m.y); fx('chip', { x: tx * TILE + 8, y: ty * TILE + 8, mat: 'wood' }); }
            m.state = 'recover'; m.t = -900; fx('stun', { x: m.x, y: m.y - 10 }); fx('shake', { m: 2 }); bashAhead(gs, m, m.angle, now); break; }
          if (m.t >= dur) { m.state = 'recover'; m.t = 0; }
        } else if (st === 'tongue') {
          if (!m.atk.hit && m.t > 60) { const len = 84; const px = p.x - m.x, py = p.y - m.y; const along = px * Math.cos(m.angle) + py * Math.sin(m.angle); const perp = Math.abs(-px * Math.sin(m.angle) + py * Math.cos(m.angle));
            if (along > 0 && along < len && perp < 8) { m.atk.hit = true; if (hurtPlayer(gs, d.dmg, m.x, m.y, d.name, now, 0)) { const a = Math.atan2(m.y - p.y, m.x - p.x); moveBody(r, p, Math.cos(a) * 26, Math.sin(a) * 26, 4, 'player'); } } }
          if (m.t >= 260) { m.state = 'recover'; m.t = 0; }
        } else if (st === 'burrow') {
          if (m.t < 900) steer(gs, m, m.atk.target.x, m.atk.target.y, 90, dt, now);
          if (m.t >= 950) { m.atk.burrow = false; m.state = 'recover'; m.t = 0; fx('emerge', { x: m.x, y: m.y }); }
        } else if (st === 'pinch') {
          if (!m.atk.hit && m.t > 40) { m.atk.hit = true; if (dist(m.x, m.y, p.x, p.y) < 22 && Math.abs(angDiff(Math.atan2(p.y - m.y, p.x - m.x), m.angle)) < 1.1) hurtPlayer(gs, d.dmg, m.x, m.y, d.name, now); fx('snip', { x: m.x + Math.cos(m.angle) * 10, y: m.y + Math.sin(m.angle) * 10 }); }
          if (m.t > 200) { m.state = 'recover'; m.t = 0; }
        } else { if (m.t > 300) { m.state = 'recover'; m.t = 0; } }
        break;
      }
      case 'recover': if (m.t > 650) { m.state = 'chase'; m.cd = 500 + rngNext(r) * 700; m.t = 0; } break;
      case 'sleep': break;
    }
  }
}

// ---------- Elders ----------
function tickElder(gs: GameState, m: Creature, dtMs: number, now: number, dp: number) {
  const r = gs.run!; const p = r.player; const e = m.elder!; const d = ELDERS[e.key]; const dt = dtMs / 1000;
  const awakePhase = phaseOf(r, now) === 'awakening';
  if (awakePhase && !e.awake) { e.awake = true; const f = m.hp / m.maxHp; m.maxHp = d.hpAwake; m.hp = Math.round(d.hpAwake * f); fx('banner', { text: `${d.name} AWAKENS`, sub: d.region }); pushLog(r, now, `Day 14: ${d.name} has awakened in ${d.region}.`, 'red'); }
  if (m.state === 'sleep') { if (dp < (e.awake ? 120 : 56) && !p.dead) wakeElder(gs, m, now); return; }
  const leash = dist(m.x, m.y, m.homeX, m.homeY);
  if (p.dead || dp > 230 || leash > 220) { // retreat: player can leave and come back later
    steer(gs, m, m.homeX, m.homeY, d.speed, dt, now); if (leash < 10) { m.hp = Math.min(m.maxHp, m.hp + dtMs * 0.01); if (dp > 260) { m.state = 'sleep'; e.submerged = false; } } return;
  }
  if (e.submerged) { steer(gs, m, p.x, p.y, d.speed * 1.6, dt, now); if (m.t > (m.atk?.subT || 1300)) { e.submerged = false; m.t = 0; fx('emerge', { x: m.x, y: m.y, big: true }); } return; }
  // movement between casts
  m.angle = Math.atan2(p.y - m.y, p.x - m.x); m.dir = dirFromAngle(m.angle);
  if (m.state === 'tell') { if (m.t >= (m.atk?.tell || 700)) { m.state = 'recover'; m.t = 0; } return; }
  if (dp > 60) steer(gs, m, p.x, p.y, d.speed * (e.awake ? 1.25 : 1), dt, now); else if (dp < 30) steer(gs, m, m.x - (p.x - m.x), m.y - (p.y - m.y), d.speed * 0.6, dt, now);
  if (dp < d.r + 10 && m.cd <= 0) { hurtPlayer(gs, d.dmg * 0.6, m.x, m.y, d.name, now, 220); m.cd = 700; }
  if (m.state === 'recover' && m.t < (e.awake ? 900 : 1500)) return;
  m.state = 'chase';
  const list = e.awake ? d.awakePatterns : d.patterns; const pat = list[e.pattern % list.length]; e.pattern += 1 + (rngNext(r) < 0.3 ? 1 : 0);
  castPattern(gs, m, pat, now);
}
function castPattern(gs: GameState, m: Creature, pat: string, now: number) {
  const r = gs.run!; const p = r.player; const e = m.elder!; const d = ELDERS[e.key]; const a = Math.atan2(p.y - m.y, p.x - m.x); const dmg = d.dmg * (e.awake ? 1.25 : 1);
  m.state = 'tell'; m.t = 0; m.atk = { tell: 800, pat }; fx('etell', { x: m.x, y: m.y, key: e.key, pat });
  const H = (h: Partial<Haz>) => HAZ.push({ kind: 'circle', x: m.x, y: m.y, t: 0, tell: 800, dur: 160, dmg, style: e.key, elder: e.key, owner: m.id, ...h } as Haz);
  const P = (ang: number, sp: number, kind: string, delay = 0, extra: Partial<Proj> = {}) => PROJ.push({ x: m.x, y: m.y - 6, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 2.2, dmg: dmg * 0.7, from: 'enemy', kind, r: 4, delay, ...extra });
  switch (pat) {
    case 'shardFan': for (let k = -3; k <= 3; k++) P(a + k * 0.2, 140, 'shard', 600); m.atk.tell = 700; break;
    case 'shardSpiral': for (let w = 0; w < 3; w++) for (let k = 0; k < 10; k++) P(k * Math.PI / 5 + w * 0.3, 110, 'shard', 600 + w * 320); m.atk.tell = 1500; break;
    case 'frostRing': H({ kind: 'ring', r: 110, tell: 750, dur: 900, effect: 'slow' }); m.atk.tell = 900; break;
    case 'icePillars': for (let k = 0; k < 6; k++) { const b = k / 6 * Math.PI * 2; H({ x: p.x + Math.cos(b) * 34, y: p.y + Math.sin(b) * 34, r: 9, tell: 850, dur: 100, effect: 'pillar' }); } m.atk.tell = 900; break;
    case 'fissure': H({ kind: 'line', angle: a, len: 180, w: 13, tell: 800, dur: 220, effect: 'burnline' }); break;
    case 'fissureTriple': for (const o of [-0.45, 0, 0.45]) H({ kind: 'line', angle: a + o, len: 170, w: 12, tell: 850, dur: 220, effect: 'burnline' }); m.atk.tell = 950; break;
    case 'slam': H({ r: 58, tell: 900, dur: 140, effect: 'knock' }); m.atk.tell = 1000; break;
    case 'meteors': for (let k = 0; k < 7; k++) H({ x: p.x + (rngNext(r) - 0.5) * 140, y: p.y + (rngNext(r) - 0.5) * 140, r: 16, tell: 900 + k * 150, dur: 120, effect: 'ignite', style: 'meteor' }); H({ x: p.x, y: p.y, r: 16, tell: 1000, dur: 120, effect: 'ignite', style: 'meteor' }); m.atk.tell = 900; break;
    case 'spitPools': for (let k = 0; k < 3; k++) H({ x: p.x + (rngNext(r) - 0.5) * 70, y: p.y + (rngNext(r) - 0.5) * 70, r: 20, tell: 900, dur: 100, effect: 'pool' }); break;
    case 'brood': for (let k = 0; k < 3; k++) { const c = mkCreature(r, 'toad', m.x + (k - 1) * 18, m.y + 16, 14); (c as any).prov = true; r.creatures.push(c); } fx('brood', { x: m.x, y: m.y }); m.atk.tell = 600; break;
    case 'submerge': case 'dive': e.submerged = true; m.state = 'chase'; m.t = 0; m.atk = { subT: 1300 }; fx('submerge', { x: m.x, y: m.y }); setTimeoutHaz(gs, m, dmg); break;
    case 'tongueSweep': H({ kind: 'sweep', len: 120, w: 9, a0: a - 1.1, a1: a + 1.1, tell: 650, dur: 800 }); m.atk.tell = 1400; break;
    case 'rootLine': for (let k = 1; k <= 9; k++) H({ x: m.x + Math.cos(a) * k * 18, y: m.y + Math.sin(a) * k * 18, r: 10, tell: 500 + k * 70, dur: 260, effect: 'root', style: 'root' }); m.atk.tell = 1000; break;
    case 'seedBombs': for (let k = 0; k < 4; k++) H({ x: p.x + (rngNext(r) - 0.5) * 90, y: p.y + (rngNext(r) - 0.5) * 90, r: 20, tell: 1100, dur: 120, style: 'seed' }); break;
    case 'rootCage': { const cx = tileOf(p.x), cy = tileOf(p.y); const gap = Math.floor(rngNext(r) * 12); for (let k = 0; k < 12; k++) { if (k === gap) continue; const b = k / 12 * Math.PI * 2; H({ x: (cx + Math.round(Math.cos(b) * 3)) * TILE + 8, y: (cy + Math.round(Math.sin(b) * 3)) * TILE + 8, r: 7, tell: 800, dur: 80, effect: 'cage', style: 'root' }); } m.atk.tell = 900; break; }
    case 'drainTrees': { // heals from living trees nearby — player can deny by felling them (C05/C14 world interplay)
      let n = 0; const cx = tileOf(m.x), cy = tileOf(m.y);
      for (let y = cy - 7; y <= cy + 7 && n < 5; y++) for (let x = cx - 7; x <= cx + 7 && n < 5; x++) { const s = sourceAt(r, x, y, now); if (s && s.def.mat === 'wood' && s.def.tall && s.stock > 0 && !s.st?.burnt) { const st = r.sources[s.i] || (r.sources[s.i] = { stock: s.stock, hp: s.hp }); st.stock--; st.hp = Math.max(0, st.hp - s.def.hp / s.def.stock); if (st.stock <= 0) markDirty(); n++; fx('drain', { x0: x * TILE + 8, y0: y * TILE + 8, x1: m.x, y1: m.y }); } }
      m.hp = Math.min(m.maxHp, m.hp + n * 28); if (n) receipt(r, now, 'elder.drain', `${n} trees`); else fx('toast', { text: 'The Treant reaches for trees — but none stand near it.' }); m.atk.tell = 900; break; }
    case 'spit': for (let k = -1; k <= 1; k++) P(a + k * 0.25, 160, 'spit', 500); m.atk.tell = 600; break;
    case 'wave': H({ kind: 'wave', angle: a, len: 170, w: 12, tell: 700, dur: 1500, x: m.x - Math.cos(a) * 20, y: m.y - Math.sin(a) * 20 }); m.atk.tell = 900; break;
    case 'whirl': H({ r: 26, x: p.x, y: p.y, tell: 1200, dur: 200, effect: 'pull' }); m.atk.tell = 900; break;
    case 'beam': H({ kind: 'line', angle: a, len: rayLen(r, m.x, m.y, a, 230), w: 8, tell: 900, dur: 600, effect: 'dot', style: 'beam' }); m.atk.tell = 1500; break;
    case 'beamSweep': H({ kind: 'sweep', len: 200, w: 8, a0: a - 1.3, a1: a + 1.3, tell: 800, dur: 1600, style: 'beam' }); m.atk.tell = 2400; break;
    case 'mines': for (let k = 0; k < 4; k++) P(a + (k - 1.5) * 0.6, 45, 'mine', 300, { life: 5, homing: 1, r: 6 }); m.atk.tell = 500; break;
    case 'overload': H({ kind: 'ring', r: 70, tell: 900, dur: 700, style: 'steam' }); m.atk = { tell: 1000, vuln: 3200, pat }; fx('toast', { text: 'The Colossus vents and overheats — strike now!' }); break;
  }
}
function setTimeoutHaz(gs: GameState, m: Creature, dmg: number) { const p = gs.run!.player; HAZ.push({ kind: 'circle', x: p.x, y: p.y, r: 30, t: 0, tell: 1300, dur: 140, dmg, style: m.elder!.key, owner: m.id, effect: 'emergeAt' }); }

// ---------- projectiles & hazards ----------
function tickProj(gs: GameState, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player; const dt = dtMs / 1000; const g = blockGrid(r);
  for (let i = PROJ.length - 1; i >= 0; i--) {
    const pr = PROJ[i];
    if (pr.delay && pr.delay > 0) { pr.delay -= dtMs; continue; }
    if (pr.homing) { const a = Math.atan2(p.y - pr.y, p.x - pr.x); const sp = Math.hypot(pr.vx, pr.vy); pr.vx += (Math.cos(a) * sp - pr.vx) * dt * 1.5; pr.vy += (Math.sin(a) * sp - pr.vy) * dt * 1.5; }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    const b = g[tileOf(pr.y) * WW + tileOf(pr.x)]; let dead = pr.life <= 0;
    if (b === 1 || b === 2 || b === 3) { dead = true; if (pr.kind === 'fireball') explode(gs, pr, now); else fx('ping', { x: pr.x, y: pr.y, kind: pr.kind }); if (pr.kind === 'arrow' && b === 2) { /* arrow sticks */ } }
    else if (pr.from === 'enemy' && dist(pr.x, pr.y, p.x, p.y) < pr.r + 4) { dead = true; if (pr.kind === 'mine') { fx('boom', { x: pr.x, y: pr.y, small: true }); } hurtPlayer(gs, pr.dmg, pr.x - pr.vx, pr.y - pr.vy, 'projectile', now, 100); }
    else if (pr.from === 'player') { for (const m of r.creatures) { if (m.state === 'dead') continue; const rr = m.elder ? ELDERS[m.elder.key].r : 6; if (dist(pr.x, pr.y, m.x, m.y) < rr + pr.r) { dead = true; if (pr.kind === 'fireball') explode(gs, pr, now); else damageCreature(gs, m, pr.dmg, Math.atan2(pr.vy, pr.vx), now, 80); break; } } }
    if (dead && pr.kind === 'fireball' && pr.life <= 0) explode(gs, pr, now);
    if (dead && pr.kind === 'mine' && pr.life <= 0) fx('boom', { x: pr.x, y: pr.y, small: true });
    if (dead) PROJ.splice(i, 1);
  }
}
function explode(gs: GameState, pr: Proj, now: number) {
  const r = gs.run!; if ((pr as any).exploded) return; (pr as any).exploded = true; fx('boom', { x: pr.x, y: pr.y }); fx('shake', { m: 4 });
  for (const m of r.creatures) if (m.state !== 'dead' && dist(pr.x, pr.y, m.x, m.y) < 30) damageCreature(gs, m, pr.dmg, Math.atan2(m.y - pr.y, m.x - pr.x), now, 160);
  const cx = tileOf(pr.x), cy = tileOf(pr.y); for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) ignite(gs, x, y, now);
}
function inHaz(h: Haz, x: number, y: number) {
  if (h.kind === 'circle' || h.kind === 'pool') return dist(x, y, h.x, h.y) < h.r!;
  if (h.kind === 'ring') { const prog = (h.t - h.tell) / h.dur; const rr = h.r! * Math.min(1, prog); const d = dist(x, y, h.x, h.y); return Math.abs(d - rr) < 9; }
  let a = h.angle!; if (h.kind === 'sweep') a = h.a0! + (h.a1! - h.a0!) * clamp((h.t - h.tell) / h.dur, 0, 1);
  let ox = h.x, oy = h.y; let len = h.len!;
  if (h.kind === 'wave') { const prog = (h.t - h.tell) / 1000 * 130; ox = h.x + Math.cos(h.angle!) * prog; oy = h.y + Math.sin(h.angle!) * prog; const px = x - ox, py = y - oy; const along = px * Math.cos(a) + py * Math.sin(a); const perp = -px * Math.sin(a) + py * Math.cos(a); return Math.abs(along) < h.w! && Math.abs(perp) < len / 2; }
  const px = x - ox, py = y - oy; const along = px * Math.cos(a) + py * Math.sin(a); const perp = Math.abs(-px * Math.sin(a) + py * Math.cos(a)); return along > 0 && along < len && perp < h.w! / 2 + 3;
}
function tickHaz(gs: GameState, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player;
  for (let i = HAZ.length - 1; i >= 0; i--) {
    const h = HAZ[i]; h.t += dtMs; if (h.t < h.tell) continue;
    const first = !h.done; h.done = true;
    if (first) onHazActivate(gs, h, now);
    if (h.owner === 'player') { if (first || h.kind === 'ring') for (const m of r.creatures) { if (m.state === 'dead' || (h as any)['h_' + m.id]) continue; if (inHaz(h, m.x, m.y)) { (h as any)['h_' + m.id] = 1; damageCreature(gs, m, h.dmg, Math.atan2(m.y - h.y, m.x - h.x), now, 90); if (h.effect === 'slowm') m.slow = 3000; } } }
    else {
      const dot = h.kind === 'pool' || h.effect === 'dot' || h.kind === 'sweep' || h.style === 'burn';
      if (dot) { h.tickAcc = (h.tickAcc || 0) - dtMs; if (h.tickAcc <= 0 && inHaz(h, p.x, p.y)) { h.tickAcc = h.kind === 'pool' ? 500 : 220; hurtPlayer(gs, h.kind === 'pool' ? 5 : h.dmg * 0.45, h.x, h.y, h.elder ? ELDERS[h.elder].name : 'hazard', now, 30); if (h.kind === 'pool') p.rad = Math.min(100, p.rad + 4); } }
      else if (!h.hit && inHaz(h, p.x, p.y)) { if (hurtPlayer(gs, h.dmg, h.x, h.y, h.elder ? ELDERS[h.elder].name : 'hazard', now, h.effect === 'knock' ? 320 : 140)) { h.hit = true; if (h.effect === 'slow') slowTimer = 2200; if (h.effect === 'root') rootTimer = 900; if (h.effect === 'pull') { const a = Math.atan2(h.y - p.y, h.x - p.x); moveBody(r, p, Math.cos(a) * 14, Math.sin(a) * 14, 4, 'player'); } } }
    }
    if (h.t >= h.tell + h.dur) HAZ.splice(i, 1);
  }
}
function onHazActivate(gs: GameState, h: Haz, now: number) {
  const r = gs.run!;
  fx('hazfire', { x: h.x, y: h.y, style: h.style, kind: h.kind, r: h.r, angle: h.angle, len: h.len });
  if (h.effect === 'quake') { const res = harvestHit(gs, tileOf(h.x), tileOf(h.y), { stone: 6, ore: 5 }, now, h.x, h.y); if (res.result === 'yield') fx('chip', { x: h.x, y: h.y, mat: res.mat }); }
  if (h.effect === 'ignite' || h.effect === 'burnline') { if (h.kind === 'line') { for (let d = 10; d < h.len!; d += 14) { const x = h.x + Math.cos(h.angle!) * d, y = h.y + Math.sin(h.angle!) * d; ignite(gs, tileOf(x), tileOf(y), now); } HAZ.push({ ...h, t: 0, tell: 0, dur: 3000, style: 'burn', effect: undefined, done: false, hit: false, dmg: 10 }); } else ignite(gs, tileOf(h.x), tileOf(h.y), now); }
  if (h.effect === 'pool') HAZ.push({ kind: 'pool', x: h.x, y: h.y, r: h.r, t: 0, tell: 0, dur: 6500, dmg: 5, style: 'pool', owner: h.owner, done: false });
  if (h.effect === 'pillar' || h.effect === 'cage') { const tx = tileOf(h.x), ty = tileOf(h.y); const t = effTile(r, tx, ty); const p = r.player;
    if (![T.DEEP, T.PWALL, T.CLIFF].includes(t) && !(tileOf(p.x) === tx && tileOf(p.y) === ty)) { r.terrain[ty * WW + tx] = { t: T.PWALL, until: r.clock.simMs + (h.effect === 'cage' ? 7000 : 11000), ...({ by: h.elder } as any) }; markDirty(); } }
  if (h.effect === 'emergeAt') { const m = r.creatures.find(c => c.id === h.owner); if (m) { m.x = h.x; m.y = h.y; if (m.elder) m.elder.submerged = false; fx('emerge', { x: h.x, y: h.y, big: true }); fx('shake', { m: 4 }); } }
  if (h.style === 'meteor' || h.effect === 'knock') fx('shake', { m: 3 });
}

// ---------- survival & environment ----------
function tickSurvival(gs: GameState, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player; if (p.dead) return; const B = BAL.player; const min = dtMs / 60000; const w = getWorld();
  const tx = tileOf(p.x), ty = tileOf(p.y); const t = effTile(r, tx, ty); const zone = w.zone[ty * WW + tx]; const weather = weatherAt(r, now);
  shelterAcc += dtMs; if (shelterAcc > 400) { shelterAcc = 0; p.sheltered = isSheltered(r, p.x, p.y); }
  p.hunger = Math.max(0, p.hunger - B.hungerDrainPerMin * min);
  p.thirst = Math.max(0, p.thirst - B.thirstDrainPerMin * min * (zone === 6 ? 1.9 : 1));
  if (p.hunger <= 0 || p.thirst <= 0) { p.hp -= B.starveDamagePerMin * min; if (p.hp <= 0) { killPlayer(gs, now, p.hunger <= 0 ? 'starvation' : 'thirst'); return; } }
  // warmth
  let cold = 0; if (zone === 5 || t === T.SNOW) cold += 9; if (darkness(r, now) > 0.45) cold += 2.5; if (isWet(weather)) cold += 3; if (t === T.SHALLOW || t === T.RIVER) cold += 4;
  let insul = 0; for (const s of C(r, 'eq').slots) if (s) insul += ITEMS[s.key].cold || 0;
  const fireNear = Object.values(r.entities).some(e => e.kind === 'struct' && STRUCTS[e.type!].warmth && e.station && e.station.burn > 0 && dist(e.x, e.y, p.x, p.y) < 52);
  const torch = activeStack(r)?.key === 'torch';
  let target = 100 - Math.max(0, cold - insul / 3) * 9; if (fireNear) target = 100; if (p.sheltered) target = Math.max(target, 80); if (torch) target = Math.max(target, Math.min(100, target + 20)); if (zone === 6) target = 100;
  p.warmth += (target - p.warmth) * Math.min(1, min * 1.6);
  if (p.warmth < 8) { p.hp -= B.coldDamagePerMin * min; if (p.hp <= 0) { killPlayer(gs, now, 'cold'); return; } }
  // radiation
  const mask = C(r, 'eq').slots.some(s => s && ITEMS[s.key].mask);
  if (t === T.TOXIC || (zone === 7 && t === T.FLOOR)) p.rad = Math.min(100, p.rad + (mask ? 0.8 : 7) * min); else p.rad = Math.max(0, p.rad - 1.5 * min);
  if (p.rad > 50) { p.hp -= B.radDamagePerMinOver50 * min * (p.rad / 50); if (p.hp <= 0) { killPlayer(gs, now, 'radiation'); return; } }
  // lava heat
  let lava = false; for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (effTile(r, x, y) === T.LAVA) lava = true;
  if (lava && (r.clock.simMs % 700) < dtMs) hurtPlayer(gs, 5, p.x, p.y + 10, 'lava', now, 60);
  if (p.hunger > 60 && p.thirst > 60 && p.rad < 30 && p.warmth > 30) p.hp = Math.min(B.maxHp, p.hp + 1.2 * min * 10 / 10 * 4);
}

// ---------- main tick ----------
export function tick(gs: GameState, inp: Input, dtMs: number, now: number) {
  const r = gs.run; if (!r || r.ended) return;
  dtMs = Math.min(dtMs, 50);
  r.clock.simMs += dtMs; r.clock.lastSimAt = now;
  const ph = phaseOf(r, now);
  if (ph === 'expired') { endRun(gs, 'expired', now); fx('banner', { text: 'The run has ended', sub: 'Ragnarok consumed the island.' }); return; }
  if (ph !== 'calm' && ragAnnounced !== r.id + ph) { ragAnnounced = r.id + ph; if (ph === 'danger') { award(gs, 'ragnarok', now); fx('banner', { text: 'RAGNAROK', sub: 'The final 72 hours. Sealed chests can now be opened.' }); } if (ph === 'awakening') fx('banner', { text: 'DAY 14', sub: 'The six Elders awaken.' }); }
  const weather = weatherAt(r, now);
  const slot = Math.floor((now - r.startedAt + r.qaOffset) / (BAL.weather.slotMinutes * 60000));
  if (slot !== r.clock.weatherSlot) { r.clock.weatherSlot = slot; fx('weather', { w: weather }); }
  // expiring terrain mutations (ice melts, pillars crumble)
  if ((r.clock.simMs % 1000) < dtMs) { let ch = false; for (const k in r.terrain) { const m = r.terrain[k]; if (m.until && m.until <= r.clock.simMs) { delete r.terrain[k]; ch = true; } } if (ch) markDirty(); }
  tickPlayer(gs, inp, dtMs, now);
  tickCreatures(gs, dtMs, now);
  tickProj(gs, dtMs, now);
  tickHaz(gs, dtMs, now);
  tickSurvival(gs, dtMs, now);
  stepStations(gs, dtMs, now);
  stepGardensBarrels(gs, dtMs, isWet(weather));
  stepFires(gs, now, dtMs);
  decayTraces(r, dtMs, weather);
  // drops: physics + magnet + auto pickup through the dispatcher
  const p = r.player;
  for (const e of Object.values(r.entities)) {
    if (e.kind !== 'drop') continue;
    if (e.vx || e.vy) { e.x += e.vx! * dtMs / 1000; e.y += e.vy! * dtMs / 1000; e.vx! *= 0.88; e.vy! *= 0.88; if (Math.abs(e.vx!) + Math.abs(e.vy!) < 2) { e.vx = 0; e.vy = 0; } }
    if (p.dead) continue; const d = dist(e.x, e.y, p.x, p.y); const age = now - (e.born || 0);
    if (age > 380 && d < 30) { const s = C(r, e.c!)?.slots[0]; if (!s) continue; const full = ITEMS[s.key].max > 1 && !s.meta ? false : !C(r, 'inv').slots.includes(null);
      if (full) continue; e.x += (p.x - e.x) * Math.min(1, dtMs / 90); e.y += (p.y - e.y) * Math.min(1, dtMs / 90);
      if (d < 9) { const key = s.key, q = s.qty; const res = dispatch(gs, { id: 'ap_' + e.id + '_' + q, type: 'pickup', eid: e.id }, now); if (res.ok) fx('pickup', { x: p.x, y: p.y, key, q }); else e.born = now + 1500; } }
  }
  // bag recovery achievement
  // legal renewing population
  r.clock.respawnAcc += dtMs;
  if (r.clock.respawnAcc > BAL.ai.respawnIntervalSec * 1000) { r.clock.respawnAcc = 0; const alive = r.creatures.filter(c => !c.elder && c.state !== 'dead').length; const cap = 150 * (isRagnarok(r, now) ? BAL.ai.ragnarokCapMult : 1); for (let k = 0; k < 40 && alive + k < cap; k++) trySpawnCreature(r, now, p.x, p.y, 25); }
  // storm lightning strikes (committed cause → real fire)
  if (weather === 'storm') { lightningAcc += dtMs; if (lightningAcc > 14000) { lightningAcc = 0; const tx = tileOf(p.x) + Math.floor((rngNext(r) - 0.5) * 30), ty = tileOf(p.y) + Math.floor((rngNext(r) - 0.5) * 20); fx('lightning', { x: tx * TILE + 8, y: ty * TILE + 8 }); const s = sourceAt(r, tx, ty, now); if (s && s.def.tall) { const st = r.sources[s.i] || (r.sources[s.i] = { stock: s.stock, hp: s.hp }); (st as any).fire = r.clock.simMs + 6000; } } }
  // discovery & region
  discoverAcc += dtMs; if (discoverAcc > 500) { discoverAcc = 0; discover(gs, now); }
}
function discover(gs: GameState, now: number) {
  const r = gs.run!; const p = r.player; const w = getWorld(); if (!r.discovered.length) r.discovered = Array(2500).fill(0);
  const cx = tileOf(p.x) >> 2, cy = tileOf(p.y) >> 2; for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 5; x <= cx + 5; x++) if (x >= 0 && y >= 0 && x < 50 && y < 50) r.discovered[y * 50 + x] = 1;
  const zi = w.zone[tileOf(p.y) * WW + tileOf(p.x)]; const ZN = ['Heartland', 'Meadow Bay', "Fisher's Point", 'Pinewatch', 'Eastcove', 'Frostcrown Peaks', 'Caldera Wastes', 'Dead Foundry', 'Drowned Fen', 'Oldgrowth', 'Lighthouse Spit', 'Harbor Reach', 'Serpent Strand', 'Wreck Coast', 'Old Mill', 'The Sea'];
  if (ZN[zi] !== p.regionName) { p.regionName = ZN[zi]; fx('region', { name: ZN[zi] }); }
  for (const pl of w.places) if (!r.poiSeen.includes(pl.id) && Math.hypot(pl.tx * TILE - p.x, pl.ty * TILE - p.y) < 13 * TILE) { r.poiSeen.push(pl.id); pushLog(r, now, `Discovered: ${pl.name}`, 'gold'); fx('discover', { name: pl.name }); }
  // stones
  r.elderStones = []; for (const s of C(r, 'inv').slots) if (s && s.key.startsWith('stone_')) r.elderStones.push(s.key);
  void countStones;
}

// ---------- offline settlement (C09) ----------
export function settle(gs: GameState, now: number): string[] {
  const r = gs.run; if (!r) return [];
  const gap = now - r.clock.lastSimAt; if (gap < 4000) return [];
  const report: string[] = []; const B = BAL.player; const p = r.player;
  const sheltered = isSheltered(r, p.x, p.y); p.sheltered = sheltered;
  const step = 60000; let t = r.clock.lastSimAt; let wetSlots = 0; let steps = 0; const zone = getWorld().zone[tileOf(p.y) * WW + tileOf(p.x)];
  const startHp = p.hp, startHunger = p.hunger;
  while (t < now && steps < 20200) {
    const dtMs = Math.min(step, now - t); t += dtMs; steps++;
    const w = weatherAt(r, t); if (isWet(w)) wetSlots++;
    stepStations(gs, dtMs, t, report);
    stepGardensBarrels(gs, dtMs, isWet(w));
    decayTraces(r, dtMs, w);
    r.clock.simMs += dtMs;
    if (phaseOf(r, t) === 'expired') { endRun(gs, 'expired', t); report.push('The run reached its 336-hour end while you were away.'); return report; }
    if (p.dead) continue;
    const min = dtMs / 60000 * B.offlineDrainFactor;
    p.hunger = Math.max(0, p.hunger - B.hungerDrainPerMin * min); p.thirst = Math.max(0, p.thirst - B.thirstDrainPerMin * min);
    if (p.hunger <= 0 || p.thirst <= 0) { const dmg = B.starveDamagePerMin * min; p.hp = sheltered ? Math.max(1, p.hp - dmg) : p.hp - dmg; } // LOCKED_CANON: sheltered → hunger alone cannot kill
    if ((zone === 5) && !sheltered) p.hp -= B.coldDamagePerMin * min; // cold is NOT covered by shelter immunity unless enclosed
    if (zone === 7) { p.rad = Math.min(100, p.rad + 6 * min); if (p.rad > 50) p.hp -= B.radDamagePerMinOver50 * min; }
    if (p.hp <= 0) { killPlayer(gs, t, 'exposure while offline'); report.push('You did not survive the time away. Your bag lies where you rested.'); }
  }
  for (const k in r.sources) { const st: any = r.sources[k]; if (st.fire) { st.fire = 0; st.burnt = true; st.stock = 3; st.hp = 8; } }
  for (const k in r.terrain) { const m = r.terrain[k]; if (m.until && m.until <= r.clock.simMs) delete r.terrain[k]; }
  markDirty();
  r.clock.lastSimAt = now;
  const hrs = gap / 3600000;
  report.unshift(`Away for ${hrs >= 1 ? hrs.toFixed(1) + ' h' : Math.round(gap / 60000) + ' min'}${r.qaUsed ? '' : ''}.`);
  if (wetSlots) report.push(`Rain fell for ~${wetSlots} min — footprints washed out, gardens and barrels drank.`);
  if (Math.round(startHunger - p.hunger) > 0) report.push(`Hunger ${Math.round(startHunger)} → ${Math.round(p.hunger)}${sheltered ? ' (sheltered: hunger cannot kill you)' : ''}.`);
  if (!p.dead && startHp - p.hp >= 1) report.push(`HP ${Math.round(startHp)} → ${Math.round(p.hp)}.`);
  receipt(r, now, 'offline.settle', `${Math.round(gap / 1000)}s`);
  return report;
}

// ---------- interaction finder (for E prompts) ----------
export interface Interact { kind: string; label: string; eid?: string; x: number; y: number }
export function findInteract(gs: GameState, now: number): Interact | null {
  const r = gs.run!; const p = r.player; if (p.dead) return null; let best: Interact | null = null; let bd = 30;
  const fx0 = p.x + Math.cos(p.aim) * 6, fy0 = p.y + Math.sin(p.aim) * 6;
  for (const e of Object.values(r.entities)) {
    if (e.kind === 'drop') continue; const d = dist(fx0, fy0, e.x, e.y); if (d > bd) continue;
    let label = ''; let kind = e.kind as string;
    if (e.kind === 'bag') label = `Open ${e.label || 'bag'}`;
    else if (e.kind === 'loot') label = C(r, e.c!).slots.some(Boolean) ? 'Search crate' : 'Empty crate';
    else if (e.kind === 'cash') label = isRagnarok(r, now) ? (e.minted ? 'Ragnarok chest' : 'Break the Ragnarok seal') : 'Sealed Ragnarok chest';
    else if (e.kind === 'vendor') label = `Trade with ${e.label}`;
    else if (e.kind === 'door') label = e.locked ? `${e.label} (${e.locked === 'keycard' ? 'keycard' : 'no power'})` : e.open ? 'Close door' : 'Open door';
    else if (e.kind === 'gen') label = e.power ? 'Generator (running)' : 'Fuel generator';
    else if (e.kind === 'evac') label = 'Evacuation beacon';
    else if (e.kind === 'cart') label = 'Cart cargo  [F] pull';
    else if (e.kind === 'struct') { const d2 = STRUCTS[e.type!]; kind = 'struct:' + e.type; if (e.type!.startsWith('door')) label = e.open ? 'Close door' : 'Open door'; else if (d2.station) label = `Use ${d2.name}`; else if (d2.slots) label = `Open ${d2.name}`; else if (e.type === 'escrow') label = 'Rương ký gửi'; else if (e.type === 'garden') label = !e.garden!.crop ? 'Plant seeds' : e.garden!.growth >= 1 ? 'Harvest' : 'Water garden'; else if (e.type === 'barrel') label = `Rain barrel (${Math.floor(e.water || 0)})`; else continue; }
    else continue;
    bd = d; best = { kind, label, eid: e.id, x: e.x, y: e.y };
  }
  if (!best) { const w = getWorld(); for (const [dx, dy] of [[0, 0], [Math.cos(p.aim) * 14, Math.sin(p.aim) * 14], [0, 12], [0, -12], [12, 0], [-12, 0]]) { const tx = tileOf(p.x + dx), ty = tileOf(p.y + dy); if (w.fresh[ty * WW + tx] && effTile(r, tx, ty) !== T.ICE && [T.SHALLOW, T.RIVER].includes(effTile(r, tx, ty))) return { kind: 'water', label: 'Drink fresh water', x: tx * TILE + 8, y: ty * TILE + 8 }; } }
  return best;
}
