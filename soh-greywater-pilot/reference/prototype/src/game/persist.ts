// Versioned durable persistence. One record = one consistent snapshot (profile + run + receipts),
// written in a single IndexedDB transaction so a debit and its credit can never be split. localStorage fallback.
import { SAVE_VERSION, type GameState } from './core';
import { newGame } from './engine';

const DB = 'soul-of-hero', STORE = 'kv', KEY = 'state', LS = 'soh.state.v' + SAVE_VERSION;
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise(res => { try { const rq = indexedDB.open(DB, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(STORE); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); } catch { res(null); } });
  return dbp;
}
export type LoadResult = { gs: GameState; note?: string };
export function validate(raw: any): GameState | null {
  if (!raw || typeof raw !== 'object' || !raw.profile || typeof raw.profile.securedCash !== 'number') return null;
  if (raw.run && (!raw.run.custody?.inv || !raw.run.player)) return null;
  return raw as GameState;
}
export function migrate(raw: any): LoadResult {
  if (raw.version === SAVE_VERSION) return { gs: raw };
  // Older snapshots: keep only permitted profile fields; an incompatible run is closed honestly.
  const g = newGame(); g.profile = { ...g.profile, ...raw.profile };
  return { gs: g, note: `Save format v${raw.version} migrated to v${SAVE_VERSION}. Profile kept; the old in-progress run could not be migrated.` };
}
export async function load(): Promise<LoadResult> {
  let text: string | null = null; let note: string | undefined;
  const d = await db();
  if (d) text = await new Promise(res => { try { const tx = d.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get(KEY); rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => res(null); } catch { res(null); } });
  const ls = (() => { try { return localStorage.getItem(LS); } catch { return null; } })();
  // choose the newest revision between IDB and fallback
  const parse = (s: string | null) => { if (!s) return null; try { return JSON.parse(s); } catch { return 'corrupt'; } };
  const a = parse(text), b = parse(ls);
  let pick: any = null;
  for (const c of [a, b]) { if (c === 'corrupt') { note = 'A corrupted save copy was detected and set aside.'; try { localStorage.setItem('soh.corrupt.' + Date.now(), String(c === a ? text : ls).slice(0, 200000)); } catch { /* */ } continue; } const v = validate(c); if (v && (!pick || (v.revision ?? 0) > (pick.revision ?? 0))) pick = v; }
  if (!pick) return { gs: newGame(), note };
  const m = migrate(pick); return { gs: m.gs, note: m.note || note };
}
let pending: string | null = null; let writing = false;
export async function save(gs: GameState) {
  const text = JSON.stringify(gs);
  try { localStorage.setItem(LS, text); } catch { /* quota */ }
  pending = text; if (writing) return; writing = true;
  const d = await db();
  while (pending && d) { const t = pending; pending = null; await new Promise<void>(res => { try { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(t, KEY); tx.oncomplete = () => res(); tx.onerror = () => res(); tx.onabort = () => res(); } catch { res(); } }); }
  writing = false;
}
export function saveSync(gs: GameState) { try { localStorage.setItem(LS, JSON.stringify(gs)); } catch { /* */ } }
export async function wipeAll() { try { localStorage.removeItem(LS); } catch { /* */ } const d = await db(); if (d) await new Promise<void>(res => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(KEY); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
