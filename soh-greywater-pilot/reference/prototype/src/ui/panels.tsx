import { useEffect, useRef, useState } from 'react';
import { ITEMS, RECIPES, STRUCTS, BUILD_ORDER, VENDOR_SECURED, ACHIEVEMENTS, ELDERS, CORE_STUDY } from '../game/catalog';
import { BAL, TILE, WW, type Stack } from '../game/core';
import { C, countItem, invWeight, isRagnarok, runHours, cartWeight, phaseOf } from '../game/engine';
import { getWorld, ZONES } from '../game/world';
import { getMapCanvas } from '../game/render';
import { setVolume } from '../game/audio';
import { Panel, Slot, Icon, Cost, type Api } from './common';

const have = (api: Api) => (k: string) => countItem(api.gs.run!, 'inv', k);
function slotClick(api: Api, c: string, i: number, e: React.MouseEvent, quickTo?: string) {
  const r = api.gs.run!; const s = C(r, c)?.slots[i];
  if (e.shiftKey && s) { const to = c === 'inv' ? quickTo : 'inv'; if (to) { api.act('move', { from: c, fs: i, to }); api.setSel(null); } return; }
  if (api.sel) { if (api.sel.c === c && api.sel.slot === i) { api.setSel(null); return; } api.act('move', { from: api.sel.c, fs: api.sel.slot, to: c, ts: i }); api.setSel(null); return; }
  if (s) { api.setSel({ c, slot: i }); api.sfx('ui'); }
}
function slotContext(api: Api, c: string, i: number, quickTo?: string) {
  const r = api.gs.run!; const s = C(r, c)?.slots[i]; if (!s) return;
  if (c === 'inv') { if (quickTo) api.act('move', { from: c, fs: i, to: quickTo }); else api.act('useItem', { slot: i }); }
  else api.act('move', { from: c, fs: i, to: 'inv' });
}
function Grid({ api, cid, cols = 8, quickTo, hotRow = false }: { api: Api; cid: string; cols?: number; quickTo?: string; hotRow?: boolean }) {
  const c = C(api.gs.run!, cid); if (!c) return null;
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 20px)`, gap: 2 }}>
    {c.slots.map((s, i) => <Slot key={i} s={s} sel={api.sel?.c === cid && api.sel.slot === i} active={hotRow && i === api.gs.run!.player.active} hotkey={hotRow && i < 8 ? String(i + 1) : undefined} onClick={e => slotClick(api, cid, i, e, quickTo)} onContext={() => slotContext(api, cid, i, quickTo)} />)}
  </div>;
}
function ItemInfo({ s }: { s: Stack | null }) {
  if (!s) return <div style={{ fontSize: 10, color: '#8a7a9a', minHeight: 34 }}>Click to pick up · click again to place/swap · right-click to use/equip · Shift-click to quick-transfer.</div>;
  const d = ITEMS[s.key];
  const stats: string[] = []; if (d.dmg) stats.push(`DMG ${d.dmg}`); if (d.reach) stats.push(`Reach ${d.reach}`); if (d.power) stats.push('Work: ' + Object.entries(d.power).map(([m, p]) => `${m} ${p}`).join(' ')); if (d.armor) stats.push(`Armor ${Math.round(d.armor * 100)}%`); if (d.cold) stats.push(`Warmth +${d.cold}`); if (d.fuel) stats.push(`Fuel ${d.fuel}s`); if (d.food) stats.push(Object.entries(d.food).map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`).join(' ')); stats.push(`${d.w}kg`);
  return <div style={{ fontSize: 10, minHeight: 34 }}><div style={{ color: '#ffe0a0', fontSize: 12 }}>{d.name}{s.meta ? `: ${ITEMS[RECIPES[s.meta]?.out]?.name || s.meta}` : ''}{s.charge !== undefined && d.charge ? ` — ${s.charge}/${d.charge} charges` : ''}{s.dur !== undefined && d.dur ? ` — ${s.dur}/${d.dur}` : ''}</div><div style={{ color: '#cfc2dc' }}>{d.desc}</div><div style={{ color: '#9ad0a0' }}>{stats.join(' · ')}</div></div>;
}

export function InventoryPanel({ api, quickTo, x = 404 }: { api: Api; quickTo?: string; x?: number }) {
  const r = api.gs.run!; const sel = api.sel ? C(r, api.sel.c)?.slots[api.sel.slot] ?? null : null; const w = invWeight(r);
  let armor = 0, warm = 0; for (const s of C(r, 'eq').slots) if (s) { armor += ITEMS[s.key].armor || 0; warm += ITEMS[s.key].cold || 0; }
  return <Panel title="Inventory" style={{ left: x, top: 34, width: 196 }} onClose={() => api.open(null)}>
    <div className="flex gap-2 items-center" style={{ marginBottom: 4 }}>
      {['head', 'body', 'back'].map((sl, i) => <div key={sl} className="flex flex-col items-center" style={{ fontSize: 8, color: '#8a7a9a' }}><Slot s={C(r, 'eq').slots[i]} sel={api.sel?.c === 'eq' && api.sel.slot === i} onClick={e => slotClick(api, 'eq', i, e)} onContext={() => slotContext(api, 'eq', i)} />{sl}</div>)}
      <div style={{ fontSize: 10, lineHeight: 1.1, marginLeft: 4 }}><div>Armor {Math.round(armor * 100)}% · Warmth +{warm}</div><div style={{ color: w > BAL.player.carryLimit ? '#ff8a7a' : '#cfc2dc' }}>Load {w.toFixed(1)} / {BAL.player.carryLimit} kg{w > BAL.player.carryLimit ? ' (slowed)' : ''}</div><div style={{ color: '#ffe27a' }}>Carried cash {countItem(r, 'inv', 'rcash')} · Secured {api.gs.profile.securedCash}</div></div>
    </div>
    <Grid api={api} cid="inv" quickTo={quickTo} hotRow />
    <div style={{ borderTop: '1px solid #3a2e46', marginTop: 4, paddingTop: 3 }}><ItemInfo s={sel} /></div>
    <div className="flex gap-1" style={{ marginTop: 3 }}>
      <button className="btn" disabled={!sel} onClick={() => { if (api.sel) { api.act('useItem', { c: api.sel.c, slot: api.sel.slot }); api.setSel(null); } }}>Use</button>
      <button className="btn" disabled={!sel || sel.qty < 2} onClick={() => api.sel && api.act('split', { c: api.sel.c, slot: api.sel.slot })}>Split</button>
      <button className="btn" disabled={!sel} onClick={() => { if (api.sel) { api.act('drop', { c: api.sel.c, slot: api.sel.slot }); api.setSel(null); } }}>Drop</button>
      <button className="btn" onClick={() => api.act('sort', { c: 'inv' })}>Sort</button>
    </div>
  </Panel>;
}

export function ContainerPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const e = r.entities[eid]; if (!e) return null;
  const st = e.station; const kind = e.type ? STRUCTS[e.type]?.station : null;
  const title = e.kind === 'bag' ? (e.label || 'Bag') : e.kind === 'loot' ? 'Crate' : e.kind === 'cash' ? 'Ragnarok Chest' : e.kind === 'cart' ? 'Cart Cargo' : STRUCTS[e.type!]?.name || 'Storage';
  const takeAll = (cid: string) => { const c = C(r, cid); for (let i = 0; i < c.slots.length; i++) if (c.slots[i]) { const res = api.act('move', { from: cid, fs: i, to: 'inv' }); if (!res.ok) break; } };
  const quickTo = st ? (kind === 'research' ? undefined : st.fuelC) : e.c;
  return <>
    <Panel title={title} style={{ left: 168, top: 34, width: 230, maxHeight: 300 }} onClose={() => api.open(null)} className="scroll">
      <div className="scroll" style={{ maxHeight: 270, overflowY: 'auto', overflowX: 'hidden' }}>
        {e.c && <><Grid api={api} cid={e.c} cols={8} /><div className="flex gap-1" style={{ marginTop: 4 }}><button className="btn" onClick={() => takeAll(e.c!)}>Take all</button>{e.kind === 'cart' && <span style={{ fontSize: 10, color: '#cfc2dc' }}>Load {cartWeight(r, e.c).toFixed(0)}/{BAL.cart.maxWeight} kg · [F] pull</span>}{e.kind === 'cart' && <button className="btn ghost" onClick={() => api.act('reclaim', { eid })}>Pack up</button>}</div></>}
        {st && kind !== 'research' && <StationBody api={api} eid={eid} />}
        {st && kind === 'research' && <ResearchBody api={api} eid={eid} />}
        {e.kind === 'struct' && <div style={{ marginTop: 6, fontSize: 10, color: '#8a7a9a' }}>HP {Math.round(e.hp!)}/{e.maxHp} <button className="btn ghost" style={{ marginLeft: 6 }} onClick={() => { api.act('reclaim', { eid }); api.open(null); }}>Reclaim</button></div>}
      </div>
    </Panel>
    <InventoryPanel api={api} quickTo={quickTo} />
  </>;
}
function StationBody({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const e = r.entities[eid]; const st = e.station!; const kind = STRUCTS[e.type!].station!;
  const recipes = Object.entries(RECIPES).filter(([, rc]) => rc.station === kind); const known = recipes.filter(([k]) => r.knowledge.recipes.includes(k));
  const fuelled = kind === 'campfire' || kind === 'furnace';
  return <div>
    {fuelled && <div style={{ marginBottom: 4 }}><div style={{ fontSize: 10, color: '#ffd98a' }}>Fuel {st.burn > 0 ? <span style={{ color: '#ffb040' }}>· burning {Math.ceil(st.burn / 1000)}s</span> : <span style={{ color: '#8a7a9a' }}>· cold</span>}{kind === 'campfire' ? ' (burns continuously; warmth + light)' : ' (burns only while working)'}</div><Grid api={api} cid={st.fuelC} cols={3} /></div>}
    <div style={{ fontSize: 10, color: '#ffd98a' }}>Queue</div>
    {st.queue.length === 0 && <div style={{ fontSize: 10, color: '#8a7a9a' }}>Idle.</div>}
    {st.queue.map((j, i) => { const out = j.recipe.startsWith('R:') ? 'blueprint' : RECIPES[j.recipe].out; return <div key={j.id} className="flex items-center gap-1" style={{ fontSize: 10 }}><Icon k={out} size={12} /><span style={{ width: 90 }}>{ITEMS[out].name}</span><div className="bar" style={{ width: 60 }}><i style={{ width: `${(1 - j.left / j.total) * 100}%`, background: i === 0 && (!fuelled || st.burn > 0) ? '#7aff6a' : '#a07a3a' }} /></div><span>{Math.ceil(j.left / 1000)}s</span><button className="btn ghost" style={{ padding: '0 3px' }} onClick={() => api.act('cancelJob', { eid, jobId: j.id })}>✕</button></div>; })}
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Output</div><Grid api={api} cid={st.outC} cols={6} />
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Recipes</div>
    {known.map(([k, rc]) => <div key={k} className="flex items-center gap-1" style={{ fontSize: 10, marginBottom: 1 }}><Icon k={rc.out} size={12} /><span style={{ width: 82 }}>{ITEMS[rc.out].name}{rc.qty > 1 ? ` ×${rc.qty}` : ''}</span><Cost ins={rc.ins} have={have(api)} /><span style={{ color: '#8a7a9a' }}>{rc.secs}s</span><button className="btn" style={{ marginLeft: 'auto', padding: '1px 5px' }} onClick={() => api.act('craft', { recipe: k, eid })}>Queue</button></div>)}
    {recipes.length > known.length && <div style={{ fontSize: 10, color: '#8a7a9a' }}>{recipes.length - known.length} more recipes undiscovered here (blueprints, research, specimens).</div>}
  </div>;
}
function ResearchBody({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const e = r.entities[eid]; const st = e.station!; const B = BAL.research;
  const unknown = Object.keys(RECIPES).filter(k => !r.knowledge.recipes.includes(k));
  const specimens = C(r, 'inv').slots.map((s, i) => [s, i] as const).filter(([s]) => s && (ITEMS[s.key].specimen || CORE_STUDY[s.key]));
  return <div>
    <div style={{ fontSize: 10, color: '#cfc2dc' }}>Spares in pack: <b style={{ color: '#ffe27a' }}>{countItem(r, 'inv', 'spares')}</b> · Known recipes {r.knowledge.recipes.length}/{Object.keys(RECIPES).length}</div>
    <div className="flex gap-1 items-center" style={{ margin: '3px 0' }}><button className="btn gold" onClick={() => api.act('research', { mode: 'random', eid })}>Tinker ({B.randomSparesCost} Spares, {B.randomSeconds}s)</button><span style={{ fontSize: 9, color: '#8a7a9a' }}>random unknown recipe</span></div>
    <div style={{ fontSize: 10, color: '#ffd98a' }}>Directed study ({B.directedSparesCost} Spares, {B.directedSeconds}s)</div>
    <div className="flex flex-wrap gap-1" style={{ marginBottom: 3 }}>{unknown.filter(k => RECIPES[k].tier < 3).slice(0, 14).map(k => <button key={k} className="btn ghost" style={{ padding: '1px 3px', fontSize: 10 }} onClick={() => api.act('research', { mode: 'directed', recipe: k, eid })}><Icon k={RECIPES[k].out} size={10} /> {ITEMS[RECIPES[k].out].name}</button>)}</div>
    <div style={{ fontSize: 10, color: '#ffd98a' }}>Specimen / Core study ({B.specimenSeconds}s, consumes 1)</div>
    {specimens.length === 0 && <div style={{ fontSize: 10, color: '#8a7a9a' }}>Carry a creature specimen or a Core to study it.</div>}
    {specimens.map(([s, i]) => <div key={i} className="flex items-center gap-1" style={{ fontSize: 10 }}><Icon k={s!.key} size={12} />{ITEMS[s!.key].name}<button className="btn" style={{ marginLeft: 'auto', padding: '1px 5px' }} onClick={() => api.act('research', { mode: 'specimen', slot: i, eid })}>Study</button></div>)}
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>In progress</div>
    {st.queue.map(j => <div key={j.id} className="flex items-center gap-1" style={{ fontSize: 10 }}><Icon k="blueprint" size={12} />{ITEMS[RECIPES[j.recipe.slice(2)].out].name}<div className="bar" style={{ width: 60 }}><i style={{ width: `${(1 - j.left / j.total) * 100}%`, background: '#9ad0ff' }} /></div>{Math.ceil(j.left / 1000)}s</div>)}
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Blueprints ready (take, then use to learn)</div><Grid api={api} cid={st.outC} cols={4} />
  </div>;
}

export function CraftPanel({ api }: { api: Api }) {
  const r = api.gs.run!; const groups: [string, string | null][] = [['By hand', null], ['Campfire', 'campfire'], ['Furnace', 'furnace'], ['Workbench', 'workbench']];
  const nearSt = (k: string) => Object.values(r.entities).find(e => e.kind === 'struct' && STRUCTS[e.type!].station === k && Math.hypot(e.x - r.player.x, e.y - r.player.y) < 3 * TILE);
  return <><Panel title={`Crafting — ${r.knowledge.recipes.length}/${Object.keys(RECIPES).length} recipes known`} style={{ left: 8, top: 34, width: 390, maxHeight: 316 }} onClose={() => api.open(null)}>
    <div className="scroll" style={{ maxHeight: 286, overflowY: 'auto' }}>
      {groups.map(([label, st]) => { const list = Object.entries(RECIPES).filter(([k, rc]) => rc.station === st && r.knowledge.recipes.includes(k)); const ns = st ? nearSt(st) : null; const hidden = Object.entries(RECIPES).filter(([k, rc]) => rc.station === st && !r.knowledge.recipes.includes(k)).length;
        return <div key={label} style={{ marginBottom: 4 }}><div style={{ fontSize: 11, color: '#ffd98a' }}>{label} {st && <span style={{ color: ns ? '#7aff6a' : '#8a7a9a', fontSize: 10 }}>{ns ? '· station in reach' : `· build or stand at a ${STRUCTS[st].name}`}</span>}</div>
          {list.map(([k, rc]) => { const ok = rc.ins.every(([i, q]) => countItem(r, 'inv', i) >= q); return <div key={k} className="flex items-center gap-1" style={{ fontSize: 10, padding: '1px 0', borderBottom: '1px solid #2a2034' }}><Icon k={rc.out} size={14} /><span style={{ width: 110, color: ok ? '#fff' : '#bba' }}>{ITEMS[rc.out].name}{rc.qty > 1 ? ` ×${rc.qty}` : ''}</span><Cost ins={rc.ins} have={have(api)} /><button className="btn" style={{ marginLeft: 'auto', padding: '1px 6px' }} disabled={!!st && !ns} onClick={() => api.act('craft', { recipe: k, eid: ns?.id })}>{st ? 'Queue' : 'Craft'}</button></div>; })}
          {hidden > 0 && <div style={{ fontSize: 9, color: '#7a6a8a' }}>+{hidden} undiscovered — blueprints in ruins, research table, specimens, Cores.</div>}</div>; })}
    </div></Panel><InventoryPanel api={api} /></>;
}

export function BuildPanel({ api }: { api: Api }) {
  const r = api.gs.run!; const owned = Object.values(r.entities).some(e => e.type === 'claim');
  return <Panel title="Build — pay real materials; place on claimed land" style={{ left: 8, top: 34, width: 400 }} onClose={() => api.open(null)}>
    {!owned && <div style={{ fontSize: 10, color: '#ffd98a', marginBottom: 3 }}>Start with a Claim Totem in open wilderness (away from landmarks). Campfires can go anywhere.</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
      {BUILD_ORDER.map(k => { const d = STRUCTS[k]; const ok = d.cost.every(([i, q]) => countItem(r, 'inv', i) >= q);
        return <button key={k} className={`btn ${api.buildType === k ? 'gold' : 'ghost'}`} style={{ textAlign: 'left', padding: 3, opacity: ok ? 1 : 0.65 }} title={d.desc} onClick={() => { api.setBuild(k); api.setReclaim(false); api.open(null); }}>
          <div className="flex items-center gap-1"><img className="px" src={iconUrlSt(k)} style={{ width: 16, height: 16, objectFit: 'contain' }} alt="" /><span style={{ fontSize: 10 }}>{d.name}</span></div>
          <div style={{ fontSize: 9 }}><Cost ins={d.cost} have={have(api)} /></div></button>; })}
    </div>
    <div className="flex gap-2 items-center" style={{ marginTop: 4, fontSize: 10, color: '#cfc2dc' }}><button className={`btn ${api.reclaim ? 'gold' : ''}`} onClick={() => { api.setReclaim(!api.reclaim); api.setBuild(null); api.open(null); }}>Reclaim mode [X]</button> Left-click to place · right-click/Esc to stop · reclaim refunds {Math.round(BAL.economy.reclaimRefund * 100)}% and bags any stored contents.</div>
  </Panel>;
}
import { iconUrl } from './common';
const iconUrlSt = (k: string) => iconUrl('st:' + (k === 'escrow' ? 'escrow' : k));

export function MapPanel({ api }: { api: Api }) {
  const ref = useRef<HTMLCanvasElement>(null); const r = api.gs.run!; const w = getWorld();
  useEffect(() => { const c = ref.current!; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(getMapCanvas(), 0, 0);
    const disc = r.discovered; g.fillStyle = 'rgba(12,10,20,0.86)'; for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) if (!disc[y * 50 + x]) g.fillRect(x * 4, y * 4, 4, 4);
    const dot = (x: number, y: number, col: string, s = 3) => { g.fillStyle = '#000'; g.fillRect(x - 1 - (s >> 1), y - 1 - (s >> 1), s + 2, s + 2); g.fillStyle = col; g.fillRect(x - (s >> 1), y - (s >> 1), s, s); };
    for (const p of w.places) if (r.poiSeen.includes(p.id)) dot(p.tx, p.ty, p.kind === 'elder' ? '#ff4a3a' : p.kind === 'evac' ? '#5af0ff' : p.kind === 'start' ? '#a0e070' : '#ffd040');
    for (const e of Object.values(r.entities)) { if (e.type === 'claim') dot(e.tx!, e.ty!, '#ff9a3a', 4); if (e.kind === 'bag') dot(e.x / 16, e.y / 16, '#ffffff'); if (e.kind === 'cart') dot(e.x / 16, e.y / 16, '#c9935a'); }
    const p = r.player; dot(p.x / 16, p.y / 16, Math.floor(Date.now() / 300) % 2 ? '#ffffff' : '#ff4a8a', 3);
  });
  const p = r.player; const h = runHours(r, api.now());
  return <Panel title={`Map of the island — ${ZONES[w.zone[Math.floor(p.y / 16) * WW + Math.floor(p.x / 16)]]}`} style={{ left: 120, top: 26, width: 400 }} onClose={() => api.open(null)}>
    <div className="flex gap-2"><canvas ref={ref} width={200} height={200} style={{ width: 260, height: 260, border: '1px solid #3a2e46' }} />
      <div style={{ fontSize: 10, lineHeight: 1.15, width: 125 }}>
        <div style={{ color: '#ffd98a' }}>Discovered</div>{w.places.filter(pl => r.poiSeen.includes(pl.id)).map(pl => <div key={pl.id} style={{ color: pl.kind === 'elder' ? '#ff8a7a' : pl.kind === 'evac' ? '#5af0ff' : '#e0d0b0' }}>• {pl.name}</div>)}
        {r.poiSeen.length === 0 && <div style={{ color: '#8a7a9a' }}>Nothing yet — explore.</div>}
        <div style={{ color: '#ffd98a', marginTop: 4 }}>Legend</div><div><span style={{ color: '#ffd040' }}>■</span> landmark <span style={{ color: '#ff4a3a' }}>■</span> elder</div><div><span style={{ color: '#ff9a3a' }}>■</span> your claim <span style={{ color: '#fff' }}>■</span> bag</div><div><span style={{ color: '#5af0ff' }}>■</span> evacuation</div>
        <div style={{ color: '#8a7a9a', marginTop: 4 }}>Run hour {h.toFixed(1)} / {BAL.run.maxRunHours} · {phaseOf(r, api.now()).toUpperCase()}</div>
      </div></div></Panel>;
}

export function SkillsPanel({ api }: { api: Api }) {
  const r = api.gs.run!; const lvl = (xp: number) => Math.floor(Math.sqrt(xp / 3));
  const labels: Record<string, string> = { gather: 'Gathering', combat: 'Combat (+0.2% dmg/xp)', craft: 'Crafting', survival: 'Survival' };
  return <Panel title="Adventurer — skills, knowledge, stones" style={{ left: 120, top: 34, width: 400 }} onClose={() => api.open(null)}>
    <div className="flex gap-3" style={{ fontSize: 10 }}>
      <div style={{ width: 170 }}>{Object.entries(r.player.skills).map(([k, xp]) => <div key={k} style={{ marginBottom: 3 }}><div className="flex justify-between"><span>{labels[k]}</span><span style={{ color: '#ffd98a' }}>Lv {lvl(xp)}</span></div><div className="bar" style={{ width: 160 }}><i style={{ width: `${((Math.sqrt(xp / 3) % 1) * 100)}%`, background: '#9ad0ff' }} /></div></div>)}
        <div style={{ color: '#ffd98a', marginTop: 6 }}>Elder stones (optional)</div>
        <div className="flex gap-1" style={{ marginTop: 2 }}>{Object.values(ELDERS).map(e => <div key={e.stone} title={e.name} style={{ opacity: r.elderStones.includes(e.stone) ? 1 : 0.25 }}><Icon k={e.stone} /></div>)}</div>
        <div style={{ color: '#8a7a9a' }}>{r.elderStones.length}/6 — six stones + evacuation = exceptional ending.</div>
        <div style={{ color: '#ffd98a', marginTop: 6 }}>Run achievements · {r.score} local score</div>{r.achievements.map(a => <div key={a}>★ {ACHIEVEMENTS[a].name} <span style={{ color: '#8a7a9a' }}>+{ACHIEVEMENTS[a].score}</span></div>)}
        <div style={{ color: '#ff9a7a', fontSize: 9 }}>LOCAL/UNVERIFIED — never converts into cash.</div>
      </div>
      <div style={{ flex: 1 }}><div style={{ color: '#ffd98a' }}>Known recipes ({r.knowledge.recipes.length})</div>
        <div className="scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', maxHeight: 220, overflowY: 'auto' }}>{r.knowledge.recipes.map(k => <div key={k} className="flex items-center gap-1"><Icon k={RECIPES[k].out} size={10} />{ITEMS[RECIPES[k].out].name}</div>)}</div></div>
    </div></Panel>;
}

export function MenuPanel({ api, onQuit, onSave }: { api: Api; onQuit: () => void; onSave: () => void }) {
  const [confirm, setConfirm] = useState(false); const pf = api.gs.profile; const r = api.gs.run!;
  return <Panel title="Paused menu — the island keeps living in real time" style={{ left: 150, top: 40, width: 340 }} onClose={() => api.open(null)}>
    <div className="flex flex-wrap gap-1"><button className="btn gold" onClick={() => api.open(null)}>Resume</button><button className="btn" onClick={() => { onSave(); api.toast('Saved.'); }}>Save now</button><button className="btn" onClick={onQuit}>Save & quit to title</button></div>
    <div style={{ fontSize: 10, marginTop: 6 }} className="flex items-center gap-2">Volume <input type="range" min={0} max={1} step={0.05} value={pf.settings.volume} onChange={e => { pf.settings.volume = +e.target.value; setVolume(pf.settings.volume, pf.settings.muted); api.rerender(); }} /><label><input type="checkbox" checked={pf.settings.muted} onChange={e => { pf.settings.muted = e.target.checked; setVolume(pf.settings.volume, pf.settings.muted); api.rerender(); }} /> mute</label></div>
    <div style={{ fontSize: 10, marginTop: 6, color: '#cfc2dc', lineHeight: 1.15 }}>WASD move · mouse aim · LMB attack/use · Space dodge-roll · E interact · F pull cart · 1–8 / wheel quickbar · I inventory · C craft · B build (X reclaim) · R research · M map · Tab skills · RMB cancel cast/build · Esc menu</div>
    <div className="panel" style={{ padding: 4, marginTop: 6, background: '#1a0e10' }}><div style={{ fontSize: 10, color: '#ff9a7a' }}>QA time acceleration — marks this run QA · LOCAL/UNVERIFIED (not real elapsed time)</div>
      <div className="flex flex-wrap gap-1" style={{ marginTop: 3 }}>{[1, 24].map(h => <button key={h} className="btn ghost" onClick={() => api.act('qaAdvance', { hours: h })}>+{h}h</button>)}
        <button className="btn ghost" onClick={() => api.act('qaAdvance', { hours: Math.max(0, 264.05 - runHours(r, api.now())) })}>→ Ragnarok (h264)</button>
        <button className="btn ghost" onClick={() => api.act('qaAdvance', { hours: Math.max(0, 312.05 - runHours(r, api.now())) })}>→ Day 14 (h312)</button></div></div>
    <div style={{ marginTop: 6 }}>{!confirm ? <button className="btn danger" onClick={() => setConfirm(true)}>Abandon run…</button> : <span className="flex gap-1 items-center" style={{ fontSize: 10 }}>Abandon wipes all run items, home and unsecured cash. <button className="btn danger" onClick={() => api.act('abandon')}>Confirm abandon</button><button className="btn ghost" onClick={() => setConfirm(false)}>No</button></span>}</div>
  </Panel>;
}

export function VendorPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const cash = countItem(r, 'inv', 'rcash'); const pf = api.gs.profile;
  return <><Panel title="Mirela the Trader — Crossroads" style={{ left: 120, top: 40, width: 280 }} onClose={() => api.open(null)}>
    <div style={{ fontSize: 10, color: '#cfc2dc' }}>"Only Ragnarok coin buys an escrow chest. No banks out here — carry it home yourself."</div>
    <div className="flex items-center gap-1" style={{ marginTop: 4, fontSize: 11 }}><Icon k="escrow_chest" /> Rương ký gửi <span style={{ color: '#ffe27a' }}>{BAL.economy.escrowChestPrice} physical cash</span> <span style={{ color: '#8a7a9a' }}>stock {r.vendorStock.escrow_chest}</span>
      <button className="btn gold" style={{ marginLeft: 'auto' }} disabled={cash < BAL.economy.escrowChestPrice || r.vendorStock.escrow_chest <= 0} onClick={() => api.act('buy', { eid, item: 'escrow_chest' })}>Buy</button></div>
    <div style={{ fontSize: 10, color: cash ? '#ffe27a' : '#8a7a9a' }}>You carry {cash} unsecured cash.{!isRagnarok(r, api.now()) && ' Cash only appears from sealed chests in the final 72 hours.'}</div>
    <div style={{ fontSize: 11, color: '#ffd98a', marginTop: 6 }}>Profile-secured goods <span style={{ fontSize: 10, color: '#cfc2dc' }}>(you have {pf.securedCash} secured)</span></div>
    {Object.entries(VENDOR_SECURED).map(([k, v]) => <div key={k} className="flex items-center gap-1" style={{ fontSize: 10 }}><Icon k={k} size={12} />{ITEMS[k].name}<span style={{ color: '#ffe27a' }}>{v.price}</span><span style={{ color: '#8a7a9a' }}>×{r.vendorStock[k]}</span><button className="btn" style={{ marginLeft: 'auto', padding: '1px 5px' }} disabled={pf.securedCash < v.price || r.vendorStock[k] <= 0} onClick={() => api.act('buy', { eid, item: k })}>Buy</button></div>)}
    <div style={{ fontSize: 9, color: '#8a7a9a', marginTop: 3 }}>Purchases become run-local items and are wiped when this run ends. Prices/stock: PROPOSED.</div>
  </Panel><InventoryPanel api={api} /></>;
}
export function EscrowPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const cash = countItem(r, 'inv', 'rcash');
  return <Panel title="Rương ký gửi — escrow chest" style={{ left: 180, top: 70, width: 280 }} onClose={() => api.open(null)}>
    <div style={{ fontSize: 11 }}>Carried physical cash: <b style={{ color: '#ffe27a' }}>{cash}</b> · Profile-secured: <b style={{ color: '#9ae0ff' }}>{api.gs.profile.securedCash}</b></div>
    <div style={{ fontSize: 10, color: '#cfc2dc', margin: '3px 0' }}>Depositing converts every coin you carry into profile-secured cash in one atomic step. You may deposit again any time; the run continues. Secured cash survives the end of the run — nothing else does.</div>
    <div className="flex gap-1"><button className="btn gold" disabled={!cash} onClick={() => { const res = api.act('deposit', { eid }); if (res.ok) api.sfx('coin'); }}>Deposit {cash}</button><button className="btn ghost" onClick={() => { api.act('reclaim', { eid }); api.open(null); }}>Pick up chest</button></div>
    <div style={{ fontSize: 9, color: '#8a7a9a', marginTop: 3 }}>Run total deposited: {r.deposited}</div>
  </Panel>;
}
export function EvacPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const cash = countItem(r, 'inv', 'rcash'); const [sure, setSure] = useState(false);
  return <Panel title="Evacuation Beacon" style={{ left: 170, top: 70, width: 300 }} onClose={() => api.open(null)}>
    <div style={{ fontSize: 10, color: '#cfc2dc' }}>Signal the boat and leave the island. Evacuation ends this run successfully. Everything run-local is wiped: items, Cores, recipes, buildings, cargo and any <b style={{ color: '#ff9a7a' }}>unsecured cash ({cash})</b>. Only profile-secured cash ({api.gs.profile.securedCash}), achievements and history remain.</div>
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 3 }}>Elder stones carried: {r.elderStones.length}/6{r.elderStones.length >= 6 ? ' — the Crown of Six awaits!' : ''}</div>
    <div className="flex gap-1" style={{ marginTop: 5 }}>{!sure ? <button className="btn gold" onClick={() => setSure(true)}>Light the beacon…</button> : <button className="btn danger" onClick={() => api.act('evacuate', { eid })}>Confirm evacuation</button>}<button className="btn ghost" onClick={() => api.open(null)}>Stay</button></div>
  </Panel>;
}
export function ReportPanel({ api, lines }: { api: Api; lines: string[] }) {
  return <Panel title="While you were away" style={{ left: 170, top: 80, width: 300 }} onClose={() => api.open(null)}>
    {lines.map((l, i) => <div key={i} style={{ fontSize: 11, color: i ? '#cfc2dc' : '#ffd98a' }}>• {l}</div>)}
    <div style={{ fontSize: 9, color: '#8a7a9a', marginTop: 3 }}>Settled chronologically from real elapsed time: only your known stations, gardens, weather and body changed. No invented raids or gifts.</div>
    <button className="btn gold" style={{ marginTop: 4 }} onClick={() => api.open(null)}>Continue</button>
  </Panel>;
}
