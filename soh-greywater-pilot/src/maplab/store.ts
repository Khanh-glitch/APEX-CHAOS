/* eslint-disable @typescript-eslint/no-explicit-any */
import { catmull, nearestOnLine, pip, pipRings } from "./geom";
import { reattach } from "./graph";
import { emptyTerrain } from "./terrain";
import { preset } from "./render";
import type { LayerState, Overlay, View } from "./render";
import { validate } from "./validate";
import type { Check } from "./validate";
import { ARCHE_BY_ID, CELL, COLLS, COLL_PREFIX, GH, GW, WORLD_H, WORLD_W, uid, allObjects, findObj, collOf } from "./types";
import { DEFAULT_SEED, GREYWATER_POI_ID, generateDetail, hashOf, reframeDetail, regenerateDetail, resolveDetail } from "./detail/generate";
import { EMPTY_OVERRIDES, overridesEmpty } from "./detail/types";
import type { PoiDetail } from "./detail/types";
import type { Base, CollKey, Poi, Project, Pt, River, RoadKind, ToolId, ViewMode } from "./types";

export type AnyObj = Base & Record<string, any>;

// ---------- serialization ----------
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...Array.from(u.subarray(i, i + 0x8000))); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export function serializeProject(p: Project, pretty = false): string {
  const t = p.terrain;
  const o = { ...p, terrain: { gw: t.gw, gh: t.gh, cell: t.cell, seed: t.seed, elev: b64(t.elev), biome: b64(t.biome) } };
  return JSON.stringify({ format: "soh-maplab", version: 1, project: o }, null, pretty ? 1 : undefined);
}
export function parseProject(s: string): Project {
  const j = JSON.parse(s);
  if (j.format !== "soh-maplab" || !j.project) throw new Error("Không phải file dự án Soul of Hero Map Lab");
  const q = j.project;
  const t = q.terrain;
  const p: Project = { ...q, terrain: { gw: t.gw, gh: t.gh, cell: t.cell, seed: t.seed, elev: unb64(t.elev), biome: unb64(t.biome) } };
  for (const c of COLLS) if (!Array.isArray((p as any)[c])) (p as any)[c] = [];
  if (!p.details || typeof p.details !== "object") p.details = {};
  p.baseId = nextBase();
  return p;
}
export const cloneProject = (p: Project): Project => structuredClone(p);
let baseSerial = 1000;
export const nextBase = () => ++baseSerial;

export function newBlankProject(name = "Dự án trống"): Project {
  const now = new Date().toISOString();
  return { v: 1, name, world: { w: WORLD_W, h: WORLD_H }, meta: { created: now, modified: now, author: "", status: "Bản nháp" }, details: {}, land: [], lakes: [], rivers: [], roads: [], bridges: [], docks: [], pois: [], zones: [], resources: [], spawns: [], elders: [], labels: [], terrain: emptyTerrain(GW, GH, CELL, 1), baseId: nextBase() };
}

// ---------- object helpers ----------
export function translateObj(o: AnyObj, dx: number, dy: number) {
  const mv = (a: Pt) => [a[0] + dx, a[1] + dy] as Pt;
  for (const k of ["at"]) if (o[k]) o[k] = mv(o[k]);
  for (const k of ["points", "ring", "foot", "deep", "retreat", "outer", "core", "approach"]) if (Array.isArray(o[k])) o[k] = o[k].map(mv);
  if (o.rings) o.rings = o.rings.map((r: Pt[]) => r.map(mv));
  if (o.arenas) o.arenas = o.arenas.map((r: Pt[]) => r.map(mv));
  if (o.feats) o.feats = o.feats.map((f: any) => ({ ...f, at: mv(f.at) }));
}
export function fixNav(r: River) {
  const n = Math.max(0, r.points.length - 1);
  while (r.nav.length < n) r.nav.push(r.nav.length ? r.nav[r.nav.length - 1] : 0);
  r.nav.length = n;
}
export function autoLink(p: Project, r: River) {
  const n = r.points.length;
  if (n < 2) return;
  const onLand = (q: Pt) => p.land.some((l) => pipRings(q, l.rings));
  const b = r.points[n - 1], a = r.points[0];
  const find = (q: Pt, exclude: string): { kind: "lake" | "river"; ref: string } | null => {
    for (const l of p.lakes) if (pip(q, l.ring) || nearestOnLine(l.ring, q, true).d < 14) return { kind: "lake", ref: l.id };
    for (const o of p.rivers) if (o.id !== exclude && o.points.length > 1 && nearestOnLine(catmull(o.points).pts, q).d < 16) return { kind: "river", ref: o.id };
    return null;
  };
  const m = find(b, r.id);
  if (m) r.mouth = m;
  else {
    let d = 1e9;
    for (const l of p.land) for (const ring of l.rings) d = Math.min(d, nearestOnLine(ring, b, true).d);
    r.mouth = !onLand(b) || d < 22 ? { kind: "sea" } : { kind: "none" };
  }
  const s = find(a, r.id);
  r.source = s && (s.kind === "lake" || s.ref !== r.mouth.ref) ? s : { kind: "spring" };
  fixNav(r);
  reattach(p);
}

export function factory(coll: CollKey, init: Record<string, any>): AnyObj {
  const id = init.id || uid(COLL_PREFIX[coll]);
  const base = { id, name: init.name || "Mới", conf: "proposal" as const };
  switch (coll) {
    case "land": return { ...base, name: init.name || "Đảo mới", kind: "islet", rings: [], ...init };
    case "lakes": return { ...base, name: init.name || "Hồ mới", ring: [], ...init };
    case "rivers": return { ...base, name: init.name || "Sông mới", points: [], width: 4, kind: "river", nav: [], feats: [], mouth: { kind: "none" }, source: { kind: "spring" }, ...init };
    case "roads": return { ...base, name: init.name || "Đường mới", points: [], kind: "cart", ...init };
    case "bridges": return { ...base, name: init.name || "Cầu mới", at: [0, 0], ang: 0, load: "foot", ...init };
    case "docks": return { ...base, name: init.name || "Bến mới", at: [0, 0], kind: "coastal", water: "sea", ...init };
    case "zones": return { ...base, name: init.name || "Vùng xây mới", ring: [], soil: "", water: "", slope: "", tags: [], ...init };
    case "resources": return { ...base, name: init.name || "Nguồn", at: [0, 0], kind: "wood", r: 24, dens: 2, gate: "none", ...init };
    case "spawns": return { ...base, name: init.name || "Spawn mới", at: [0, 0], region: "", ...init };
    case "labels": return { ...base, name: init.text || "Nhãn", at: [0, 0], text: "Nhãn", size: 16, rot: 0, style: "place", ...init };
    case "elders": return { ...base, elder: "surtur", outer: [], core: [], approach: [], arenas: [], pois: [], ragnarok: "", ...init };
    case "pois": {
      const a = ARCHE_BY_ID[init.arche || "custom"] || ARCHE_BY_ID.custom;
      const at: Pt = init.at || [0, 0];
      const R = a.r;
      const rect = (w: number, h: number, dx = 0, dy = 0): Pt[] => [[-w, -h], [w, -h], [w, h], [-w, h]].map(([u, v]) => [at[0] + dx + u, at[1] + dy + v] as Pt);
      return { ...base, name: init.name || a.name, at, arche: a.id, rot: 0, scale: 1, foot: rect(R * 0.8, R * 0.55), deep: a.depth === "multi" ? rect(R * 0.45, R * 0.3, R * 0.15, R * 0.1) : undefined, depth: a.depth, role: a.role, opp: a.opp, access: a.access, resources: [...a.res], gate: a.gate, retreat: a.depth === "multi" ? [[at[0] + R * 2, at[1] - R * 2]] : [], links: [], ...init } as AnyObj;
    }
  }
}

export interface Proposal { id: string; title: string; detail: string; overlays: Overlay[]; apply: (p: Project) => void; }
export interface UIState {
  tool: ToolId; mode: ViewMode; layers: LayerState; dim: boolean; snap: boolean; gridSize: number; viewOnly: boolean; ragnarok: boolean;
  brush: { size: number; strength: number; elevMode: "raise" | "lower" | "smooth" | "flat"; biome: number };
  opts: { roadKind: RoadKind; riverKind: "river" | "canal" | "distributary"; arche: string; elderId: string; elderPart: "outer" | "core" | "arena" | "approach"; resKind: string; bridgeLoad: "foot" | "cart"; dockKind: "inland" | "coastal"; labelStyle: "region" | "water" | "place" };
  heat: "none" | "opp" | "poi" | "build"; panel: "inspect" | "layers" | "smart" | "snap"; leftHidden: boolean; bottomOpen: boolean;
  selVertex: number; hoverSeg: number; blocked: Set<string>; testResult: { at: Pt; lines: { tone: string; text: string }[] } | null; reach: { at: Pt; mode: string } | null;
  lockedColls: Set<string>; paletteOpen: boolean; toast: string; regionRect: [number, number, number, number] | null; changed?: { added: Set<string>; moved: Set<string> };
  /** POI Detail Layer studio currently open (stable POI id). */
  detailOpen?: string | null;
}

interface Snap { label: string; project: Project }
const AUTOSAVE = "soh-maplab-autosave-v1";
const SNAPKEY = "soh-maplab-snapshots-v1";
export interface SavedSnap { id: string; name: string; time: string; json: string }

export class Store {
  project: Project;
  version = 0;
  past: Snap[] = [];
  future: Snap[] = [];
  sel = new Set<string>();
  listeners = new Set<() => void>();
  proposals: Proposal[] = [];
  checks: Check[] = [];
  checksVersion = -1;
  view: View = { x: 0, y: 0, s: 0.6 };
  canvasSize = { w: 1200, h: 700 };
  txOpen = false;
  txVersion = 0;
  hoverId: string | null = null;
  reachOv: Overlay[] = [];
  clipboard: AnyObj[] = [];
  lastSaved = "";
  ui: UIState;
  timer: ReturnType<typeof setTimeout> | null = null;
  snapshots: SavedSnap[] = [];
  compareId: string | null = null;
  diffSummary: ReturnType<typeof diffProjects> | null = null;

  constructor(p: Project) {
    this.project = p;
    const pr = preset("atlas");
    this.ui = {
      tool: "select", mode: "atlas", layers: pr.layers, dim: pr.dim, snap: true, gridSize: 100, viewOnly: false, ragnarok: false,
      brush: { size: 40, strength: 0.5, elevMode: "raise", biome: 0 },
      opts: { roadKind: "cart", riverKind: "river", arche: "village", elderId: "surtur", elderPart: "outer", resKind: "wood", bridgeLoad: "foot", dockKind: "coastal", labelStyle: "place" },
      heat: "none", panel: "inspect", leftHidden: false, bottomOpen: false, selVertex: -1, hoverSeg: -1, blocked: new Set(), testResult: null, reach: null, lockedColls: new Set(), paletteOpen: false, toast: "", regionRect: null,
    };
    try { this.snapshots = JSON.parse(localStorage.getItem(SNAPKEY) || "[]"); } catch { this.snapshots = []; }
  }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  emit() { this.listeners.forEach((f) => f()); }
  setUI(patch: Partial<UIState>) { Object.assign(this.ui, patch); this.emit(); }
  toast(msg: string) { this.ui.toast = msg; this.emit(); setTimeout(() => { if (this.ui.toast === msg) { this.ui.toast = ""; this.emit(); } }, 3200); }
  setMode(m: ViewMode) { const pr = preset(m, this.ui.layers); this.ui.mode = m; this.ui.layers = pr.layers; this.ui.dim = pr.dim; if (m === "opp") this.ui.heat = "opp"; else if (this.ui.heat === "opp") this.ui.heat = "none"; this.emit(); }
  toggleLayer(k: keyof LayerState) { this.ui.layers = { ...this.ui.layers, [k]: !this.ui.layers[k] }; this.emit(); }

  // ----- history -----
  private snap(label: string) { this.past.push({ label, project: cloneProject(this.project) }); if (this.past.length > 80) this.past.shift(); this.future = []; }
  commit(label: string, fn: (p: Project) => void, o: { base?: boolean } = {}) {
    this.snap(label);
    fn(this.project);
    this.touch(o.base);
  }
  beginTx(label: string) { if (this.txOpen) return; this.snap(label); this.txOpen = true; this.txVersion = this.version; }
  mutate(fn: (p: Project) => void, o: { base?: boolean } = {}) { fn(this.project); this.touch(o.base); }
  endTx() { if (!this.txOpen) return; this.txOpen = false; if (this.version === this.txVersion) this.past.pop(); }
  touch(base?: boolean) {
    this.version++;
    if (base) this.project.baseId = nextBase();
    this.project.meta.modified = new Date().toISOString();
    this.scheduleSave();
    this.emit();
  }
  undo() { const s = this.past.pop(); if (!s) return; this.future.push({ label: s.label, project: cloneProject(this.project) }); this.restore(s.project, "Hoàn tác: " + s.label); }
  redo() { const s = this.future.pop(); if (!s) return; this.past.push({ label: s.label, project: cloneProject(this.project) }); this.restore(s.project, "Làm lại: " + s.label); }
  private restore(p: Project, msg: string) {
    this.project = p; this.version++;
    this.project.baseId = this.project.baseId === undefined ? nextBase() : this.project.baseId;
    const ids = new Set(allObjects(p).map((o) => o.obj.id));
    this.sel = new Set([...this.sel].filter((i) => ids.has(i)));
    this.scheduleSave(); this.toast(msg);
  }
  replaceProject(p: Project, resetHistory = true) {
    this.project = p; this.sel = new Set(); this.version++; if (resetHistory) { this.past = []; this.future = []; }
    this.proposals = []; this.ui.blocked = new Set(); this.ui.testResult = null; this.diffSummary = null; this.ui.changed = undefined;
    this.scheduleSave(); this.emit();
  }

  // ----- selection / queries -----
  select(ids: string[], additive = false) {
    if (!additive) this.sel = new Set();
    for (const id of ids) { if (additive && this.sel.has(id)) this.sel.delete(id); else this.sel.add(id); }
    this.ui.selVertex = -1;
    this.emit();
  }
  get(id: string): AnyObj | null { return (findObj(this.project, id)?.obj as AnyObj) || null; }
  selected(): AnyObj[] { return [...this.sel].map((i) => this.get(i)).filter(Boolean) as AnyObj[]; }
  withGroup(ids: string[]): string[] {
    const out = new Set(ids);
    for (const id of ids) { const g = this.get(id)?.group; if (g) allObjects(this.project).forEach((o) => { if ((o.obj as AnyObj).group === g) out.add(o.obj.id); }); }
    return [...out];
  }

  // ----- editing operations (all undoable) -----
  addObject(coll: CollKey, init: Record<string, any>, label?: string): AnyObj {
    const ob = factory(coll, init);
    this.commit(label || "Thêm " + coll, (p) => { (p[coll] as any[]).push(ob); if (coll === "rivers") autoLink(p, ob as unknown as River); }, { base: coll === "land" });
    this.select([ob.id]);
    return ob;
  }
  removeIds(ids: string[], label = "Xóa") {
    if (!ids.length) return;
    const set = new Set(ids);
    this.commit(label, (p) => {
      for (const c of COLLS) (p as any)[c] = (p as any)[c].filter((o: Base) => !set.has(o.id));
      for (const r of p.rivers) { if (r.mouth.ref && set.has(r.mouth.ref)) r.mouth = { kind: "none" }; if (r.source.ref && set.has(r.source.ref)) r.source = { kind: "spring" }; }
      for (const d of p.docks) if (set.has(d.water)) d.water = "";
      for (const o of p.pois) o.links = o.links.filter((l) => !set.has(l.to));
      for (const e of p.elders) e.pois = e.pois.filter((i) => !set.has(i));
    }, { base: ids.some((i) => collOf(i) === "land") });
    this.sel = new Set([...this.sel].filter((i) => !set.has(i)));
    this.emit();
  }
  duplicate(ids: string[]) {
    const out: string[] = [];
    const gmap = new Map<string, string>();
    this.commit("Nhân bản", (p) => {
      for (const id of ids) {
        const f = findObj(p, id);
        if (!f || f.coll === "elders") continue;
        const cp = structuredClone(f.obj) as AnyObj;
        cp.id = uid(COLL_PREFIX[f.coll]); cp.name = cp.name + " (bản sao)";
        translateObj(cp, 24, 24);
        if (cp.group) { if (!gmap.has(cp.group)) gmap.set(cp.group, uid("grp")); cp.group = gmap.get(cp.group); }
        (p[f.coll] as any[]).push(cp); out.push(cp.id);
      }
    }, { base: ids.some((i) => collOf(i) === "land") });
    this.sel = new Set(out); this.emit();
  }
  group(ids: string[]) { if (ids.length < 2) return; const g = uid("grp"); this.commit("Nhóm", (p) => { for (const id of ids) { const f = findObj(p, id); if (f) (f.obj as AnyObj).group = g; } }); this.toast("Đã nhóm " + ids.length + " đối tượng"); }
  ungroup(ids: string[]) { this.commit("Bỏ nhóm", (p) => { for (const id of ids) { const f = findObj(p, id); if (f) delete (f.obj as AnyObj).group; } }); }
  setProps(id: string, patch: Record<string, any>, label = "Sửa thuộc tính") {
    this.commit(label, (p) => {
      const f = findObj(p, id); if (!f) return;
      Object.assign(f.obj, patch);
      if (f.coll === "rivers") { fixNav(f.obj as unknown as River); reattach(p); }
    }, { base: false });
  }
  copy(ids: string[]) { this.clipboard = ids.map((i) => structuredClone(this.get(i))).filter(Boolean) as AnyObj[]; this.toast(`Đã sao chép ${this.clipboard.length}`); }
  paste() {
    if (!this.clipboard.length) return;
    const out: string[] = [];
    this.commit("Dán", (p) => { for (const o of this.clipboard) { const c = collOf(o.id); if (!c || c === "elders") continue; const cp = structuredClone(o); cp.id = uid(COLL_PREFIX[c]); translateObj(cp, 30, 30); (p[c] as any[]).push(cp); out.push(cp.id); } });
    this.sel = new Set(out); this.emit();
  }

  // ----- POI Detail Layer (backward-compatible, keyed by stable POI id) -----
  /** Only Greywater is implemented in this pilot. Other POIs are never auto-populated. */
  detailSupported(poiId: string) { return poiId === GREYWATER_POI_ID; }
  getDetail(poiId: string): PoiDetail | null { return this.project.details?.[poiId] || null; }
  ensureDetail(poiId: string, seed = DEFAULT_SEED): PoiDetail | null {
    const existing = this.getDetail(poiId);
    if (existing) return existing;
    const poi = this.project.pois.find((q) => q.id === poiId);
    if (!poi) return null;
    if (!this.detailSupported(poiId)) { this.toast("Lớp chi tiết POI: pilot này chỉ mở cho Greywater Hamlet."); return null; }
    const d = generateDetail(this.project, poi, seed);
    this.commit("Tạo POI Detail: " + poi.name, (q) => {
      if (!q.details) q.details = {};
      q.details[poiId] = d;
    });
    return this.getDetail(poiId);
  }
  /** Every hand edit goes through here so undo/redo, autosave and reload stay in sync. */
  editDetail(poiId: string, label: string, fn: (d: PoiDetail) => void) {
    this.commit("Detail: " + label, (q) => {
      const d = q.details?.[poiId];
      if (!d) return;
      fn(d);
      d.edited = !overridesEmpty(d.overrides);
      d.hash = hashOf(d.generated);
    });
  }
  regenerateDetail(poiId: string, seed: number) {
    const poi = this.project.pois.find((q) => q.id === poiId);
    if (!poi) return;
    this.commit("Detail: tái sinh (seed " + seed + ")", (q) => {
      const d = q.details?.[poiId];
      if (!d) return;
      q.details![poiId] = regenerateDetail(q, poi, d, seed);
    });
  }
  /** Re-derive the site frame from the (possibly edited) POI footprint. */
  reframeDetail(poiId: string) {
    const poi = this.project.pois.find((q) => q.id === poiId);
    if (!poi) return;
    this.commit("Detail: cập nhật khung theo footprint", (q) => {
      const d = q.details?.[poiId];
      if (!d) return;
      q.details![poiId] = reframeDetail(q, poi, d);
    });
  }
  setDetailLocked(poiId: string, locked: boolean) {
    this.editDetail(poiId, locked ? "khóa bố cục" : "mở khóa bố cục", (d) => { d.locked = locked; });
  }
  clearDetailOverrides(poiId: string) {
    this.editDetail(poiId, "bỏ sửa tay", (d) => { d.overrides = EMPTY_OVERRIDES(); });
  }
  saveDetailPlay(poiId: string, play: PoiDetail["play"]) {
    // play state is saved with the project, but does not create an undo step per step
    this.mutate((q) => { const d = q.details?.[poiId]; if (d) d.play = play; });
  }
  resolvedDetail(poiId: string) {
    const d = this.getDetail(poiId);
    return d ? resolveDetail(d) : null;
  }

  // ----- validation / analysis cache -----
  runChecks(force = false): Check[] {
    if (force || this.checksVersion !== this.version) {
      try { this.checks = validate(this.project, this.ui.blocked); } catch (e) { console.error(e); this.checks = [{ id: "ERR", status: "FAIL", title: "Lỗi engine kiểm tra", detail: String(e), refs: [] }]; }
      this.checksVersion = this.version;
    }
    return this.checks;
  }

  // ----- persistence -----
  scheduleSave() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveLocal(), 900);
  }
  saveLocal(): boolean {
    try { localStorage.setItem(AUTOSAVE, serializeProject(this.project)); this.lastSaved = new Date().toLocaleTimeString(); this.emit(); return true; } catch { return false; }
  }
  static loadLocal(): Project | null {
    try { const s = localStorage.getItem(AUTOSAVE); return s ? parseProject(s) : null; } catch { return null; }
  }
  static clearLocal() { try { localStorage.removeItem(AUTOSAVE); } catch { /* ignore */ } }
  takeSnapshot(name: string) {
    const s: SavedSnap = { id: uid("snap"), name, time: new Date().toLocaleString(), json: serializeProject(this.project) };
    this.snapshots = [s, ...this.snapshots].slice(0, 8);
    try { localStorage.setItem(SNAPKEY, JSON.stringify(this.snapshots)); } catch { this.snapshots.shift(); this.toast("Bộ nhớ trình duyệt đầy — đã bỏ snapshot cũ nhất"); }
    this.emit();
  }
  deleteSnapshot(id: string) { this.snapshots = this.snapshots.filter((s) => s.id !== id); try { localStorage.setItem(SNAPKEY, JSON.stringify(this.snapshots)); } catch { /* ignore */ } if (this.compareId === id) { this.compareId = null; this.diffSummary = null; this.ui.changed = undefined; } this.emit(); }
  restoreSnapshot(id: string) { const s = this.snapshots.find((x) => x.id === id); if (!s) return; this.commit("Khôi phục snapshot " + s.name, () => undefined); const p = parseProject(s.json); this.project = p; this.version++; this.project.baseId = nextBase(); this.sel = new Set(); this.emit(); }
  compare(id: string | null) {
    this.compareId = id;
    if (!id) { this.diffSummary = null; this.ui.changed = undefined; this.emit(); return; }
    const s = this.snapshots.find((x) => x.id === id);
    if (!s) return;
    const other = parseProject(s.json);
    this.diffSummary = diffProjects(other, this.project);
    this.ui.changed = { added: new Set(this.diffSummary.added.map((x) => x.id)), moved: new Set(this.diffSummary.changed.map((x) => x.id)) };
    this.emit();
  }
}

export function diffProjects(a: Project, b: Project) {
  const res = { added: [] as { coll: CollKey; id: string; name: string }[], removed: [] as { coll: CollKey; id: string; name: string }[], changed: [] as { coll: CollKey; id: string; name: string }[], terrain: 0, biome: 0 };
  for (const c of COLLS) {
    const A = new Map((a[c] as unknown as AnyObj[]).map((o) => [o.id, o])), B = new Map((b[c] as unknown as AnyObj[]).map((o) => [o.id, o]));
    for (const [id, o] of B) { if (!A.has(id)) res.added.push({ coll: c, id, name: o.name }); else if (JSON.stringify(A.get(id)) !== JSON.stringify(o)) res.changed.push({ coll: c, id, name: o.name }); }
    for (const [id, o] of A) if (!B.has(id)) res.removed.push({ coll: c, id, name: o.name });
  }
  const n = Math.min(a.terrain.elev.length, b.terrain.elev.length);
  for (let i = 0; i < n; i++) { if (Math.abs(a.terrain.elev[i] - b.terrain.elev[i]) > 2) res.terrain++; if (a.terrain.biome[i] !== b.terrain.biome[i]) res.biome++; }
  return res;
}
