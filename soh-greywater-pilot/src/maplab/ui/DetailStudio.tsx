/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
// POI Detail Layer — editor + walk mode for the Greywater pilot.
//
// This is a *layer on top of Map Studio*, not a separate app: it reads the POI
// out of the open project (`po_greywater`), edits its detail record through the
// same Store (so undo / redo / autosave / .sohmap.json keep working) and draws
// with the prototype-derived pixel renderer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./maplab.css";
import type { Store } from "../store";
import { serializeProject } from "../store";
import { canvasSize, SITE_MARGIN } from "../detail/grid";
import { makeGrid } from "../detail/grid";
import { resolveDetail } from "../detail/generate";
import { createSession, interact, NOTICE_TEXT, sessionSave, stepSession, type PlaySession } from "../detail/play";
import type { DetailBuilding, DetailProp, DetailTree, PoiDetail, ResolvedPlan } from "../detail/types";
import { BUILDING_LABEL, ROOF_LABEL, WALL_LABEL, TREE_LABEL } from "../detail/types";
import { renderVillage, type Selection } from "../detail/render";

const T = 16;
const TILE = 16;

const BUILDING_KINDS = Object.keys(BUILDING_LABEL) as (keyof typeof BUILDING_LABEL)[];
const ROOF_KINDS = Object.keys(ROOF_LABEL) as (keyof typeof ROOF_LABEL)[];
const WALL_KINDS = Object.keys(WALL_LABEL) as (keyof typeof WALL_LABEL)[];
const TREE_KINDS = Object.keys(TREE_LABEL) as (keyof typeof TREE_LABEL)[];
const PROP_TYPES = ["crate", "barrel", "well", "notice", "signpost", "lantern", "bench", "haystack", "cart", "woodpile", "stump", "log", "garden", "laundry", "trough", "stall", "reeds", "fence"];

function useVer(st: Store) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const un = st.subscribe(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setV((x) => x + 1); }); });
    return () => { un(); cancelAnimationFrame(raf); };
  }, [st]);
  return v;
}

function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function propInteract(id: string, type: string): DetailProp["interact"] {
  switch (type) {
    case "well": return { kind: "well", text: "Giếng làng — múc nước" };
    case "crate": return { kind: "crate", key: id, text: "Thùng vật tư" };
    case "notice": return { kind: "notice", text: "Bảng tin làng" };
    case "signpost": return { kind: "sign", text: "Biển chỉ dẫn" };
    case "lantern": return { kind: "lantern", key: id, text: "Đèn lồng" };
    case "bench": return { kind: "bench", text: "Ghế nghỉ" };
    default: return undefined;
  }
}
const SOLID_PROPS = new Set(["well", "barrel", "crate", "haystack", "cart", "woodpile", "stump", "log", "trough", "stall", "signpost", "notice", "lantern", "laundry", "bench"]);

function newBuilding(id: string, x: number, y: number): DetailBuilding {
  return {
    id, name: "Nhà mới", kind: "cottage", x, y, w: 6, h: 5, wall: "wood", roof: "thatch", floor: "wood",
    door: { x: x + 3, y: y + 5, side: "s" }, props: [],
  };
}
function newProp(id: string, type: string, x: number, y: number): DetailProp {
  return { id, type, x, y, solid: SOLID_PROPS.has(type), variant: 0, interact: propInteract(id, type) };
}

function doorFor(b: DetailBuilding, side: DetailBuilding["door"]["side"]): DetailBuilding["door"] {
  if (side === "s") return { x: b.x + Math.floor(b.w / 2), y: b.y + b.h, side };
  if (side === "n") return { x: b.x + Math.floor(b.w / 2), y: b.y - 1, side };
  if (side === "e") return { x: b.x + b.w, y: b.y + Math.floor(b.h / 2), side };
  return { x: b.x - 1, y: b.y + Math.floor(b.h / 2), side };
}

interface DragState { sel: Selection; startX: number; startY: number; origX: number; origY: number; moved: boolean }

export function DetailStudio({ st, poiId, onClose }: { st: Store; poiId: string; onClose: () => void }) {
  useVer(st);
  const d = st.getDetail(poiId);

  // create the detail record on first open (one undoable step)
  useEffect(() => { if (!st.getDetail(poiId)) st.ensureDetail(poiId); /* eslint-disable-next-line */ }, []);

  const snap = useMemo(() => {
    const d2 = st.getDetail(poiId);
    if (!d2) return null;
    const plan = resolveDetail(d2);
    return { d: d2, plan, grid: makeGrid(st.project, d2.frame, plan) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poiId, st, st.version]);

  const [mode, setMode] = useState<"edit" | "play">("edit");
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<"select" | "add_building" | "add_prop" | "add_tree" | "spawn">("select");
  const [addType, setAddType] = useState("crate");
  const [addTreeKind, setAddTreeKind] = useState<DetailTree["kind"]>("oak");
  const [sel, setSel] = useState<Selection | null>(null);
  const [hover, setHover] = useState<Selection | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [seedDraft, setSeedDraft] = useState<string>("");
  const [notice, setNotice] = useState(false);
  const [hud, setHud] = useState<{ water: number; supplies: number; reads: number; lamps: number; target: string | null; targetKind: string | null; toast: string; inside: string | null }>({ water: 0, supplies: 0, reads: 0, lamps: 0, target: null, targetKind: null, toast: "", inside: null });
  const [savedPlay, setSavedPlay] = useState(!!d?.play);

  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const snapRef = useRef(snap);
  const uiRef = useRef({ mode, sel, hover, showGrid, showLabels, zoom, tool });
  const dragRef = useRef<DragState | null>(null);
  const selRef = useRef<Selection | null>(null);
  const sessionRef = useRef<PlaySession | null>(null);
  const inputRef = useRef({ up: false, down: false, left: false, right: false });
  const hudAt = useRef(0);

  useEffect(() => { snapRef.current = snap; selRef.current = sel; });

  // QA / automation hook: read-only handles + a couple of test helpers.
  useEffect(() => {
    (window as any).__greywater = {
      st, poiId,
      get plan() { return snapRef.current?.plan ?? null; },
      get grid() { return snapRef.current?.grid ?? null; },
      get detail() { return st.getDetail(poiId); },
      get session() { return sessionRef.current; },
      get mode() { return uiRef.current.mode; },
      teleport(x: number, y: number) { const s = sessionRef.current; if (s) { s.x = x; s.y = y; } },
      save: () => { const s = sessionRef.current; if (s) st.saveDetailPlay(poiId, sessionSave(s)); },
      hash: () => st.getDetail(poiId)?.hash,
    };
    return () => { delete (window as any).__greywater; };
  }, [st, poiId]);
  uiRef.current = { mode, sel, hover, showGrid, showLabels, zoom, tool };

  const size = d ? canvasSize(d.frame) : { w: 1, h: 1 };

  // ---------- render loop (also steps the walk session) ----------
  // rAF drives it while the tab is visible; a timer keeps the simulation alive
  // when the browser throttles rAF (background tab / headless capture).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      if (dt < 0.012) return;
      last = now;
      const s = snapRef.current;
      const u = uiRef.current;
      const cv = cvRef.current;
      if (!s || !cv) return;
      const sess = sessionRef.current;
      try {
        if (u.mode === "play" && sess) {
          stepSession(sess, s.grid, s.plan, dt, inputRef.current);
          if (now - hudAt.current > 120) {
            hudAt.current = now;
            setHud((h) => {
              const next = {
                water: sess.counters.water, supplies: sess.counters.supplies, reads: sess.counters.reads, lamps: sess.counters.lamps,
                target: sess.target?.label ?? null, targetKind: sess.target?.kind ?? null, toast: sess.toast, inside: sess.inside,
              };
              return JSON.stringify(h) === JSON.stringify(next) ? h : next;
            });
          }
        }
        renderVillage(cv, {
          plan: s.plan, grid: s.grid, frame: s.d.frame, time: now,
          actor: u.mode === "play" && sess ? { x: sess.x, y: sess.y, dir: sess.dir, moving: sess.moving, anim: sess.anim } : undefined,
          selection: u.mode === "edit" ? u.sel : null,
          hover: u.mode === "edit" ? u.hover : null,
          edit: u.mode === "edit",
          showGrid: u.showGrid, showLabels: u.showLabels, seed: s.d.seed,
          particles: u.mode === "play" && sess ? sess.particles : undefined,
        }, 1);
        // follow camera: keep the hero centred while walking
        const stage = scrollRef.current;
        if (u.mode === "play" && sess && stage) {
          const cx = (sess.x + SITE_MARGIN) * TILE * u.zoom;
          const cy = (sess.y + SITE_MARGIN) * TILE * u.zoom;
          const tl = cx - stage.clientWidth / 2, tt = cy - stage.clientHeight / 2;
          if (Math.abs(stage.scrollLeft - tl) > 3) stage.scrollLeft += (tl - stage.scrollLeft) * 0.3;
          if (Math.abs(stage.scrollTop - tt) > 3) stage.scrollTop += (tt - stage.scrollTop) * 0.3;
        }
      } catch (err) {
        // never kill the loop on a draw error: log once and keep the studio usable
        console.error("detail render", err);
      }
    };
    const loop = (now: number) => { tick(now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const iv = window.setInterval(() => tick(performance.now()), 60);
    return () => { cancelAnimationFrame(raf); window.clearInterval(iv); };
  }, []);

  const savePlay = useCallback(() => {
    const sess = sessionRef.current;
    if (!sess) return;
    st.saveDetailPlay(poiId, sessionSave(sess));
    setSavedPlay(true);
  }, [st, poiId]);

  useEffect(() => () => { if (sessionRef.current) st.saveDetailPlay(poiId, sessionSave(sessionRef.current)); }, [st, poiId]);

  const enterPlay = () => {
    const dv = st.getDetail(poiId);
    if (!dv) return;
    sessionRef.current = createSession(resolveDetail(dv), dv.play);
    setSel(null);
    setZoom((z) => Math.max(z, 2));
    setMode("play");
    setHud({ water: dv.play?.water || 0, supplies: dv.play?.supplies || 0, reads: dv.play?.reads || 0, lamps: dv.play?.lamps || 0, target: null, targetKind: null, toast: "", inside: null });
  };
  const leavePlay = () => {
    savePlay();
    setMode("edit");
    setNotice(false);
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.tagName === "SELECT")) return;
      const u = uiRef.current;
      if (u.mode === "play") {
        const k = e.key.toLowerCase();
        if (k === "w" || k === "arrowup") { inputRef.current.up = true; e.preventDefault(); }
        if (k === "s" || k === "arrowdown") { inputRef.current.down = true; e.preventDefault(); }
        if (k === "a" || k === "arrowleft") { inputRef.current.left = true; e.preventDefault(); }
        if (k === "d" || k === "arrowright") { inputRef.current.right = true; e.preventDefault(); }
        if (k === "e" && !e.repeat) {
          const sess = sessionRef.current;
          const s = snapRef.current;
          if (sess && s) {
            const res = interact(sess, s.plan);
            sess.toast = res.message; sess.toastT = 2.6;
            if (res.openNotice) { sess.noticeOpen = true; setNotice(true); }
            e.preventDefault();
          }
        }
        if (e.key === "Escape") { leavePlay(); e.preventDefault(); }
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); }
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === "Escape") { onClose(); e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { deleteSelection(); e.preventDefault(); e.stopImmediatePropagation(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { if (e.shiftKey) st.redo(); else st.undo(); e.preventDefault(); e.stopImmediatePropagation(); }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") inputRef.current.up = false;
      if (k === "s" || k === "arrowdown") inputRef.current.down = false;
      if (k === "a" || k === "arrowleft") inputRef.current.left = false;
      if (k === "d" || k === "arrowright") inputRef.current.right = false;
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => { window.removeEventListener("keydown", down, true); window.removeEventListener("keyup", up, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- edit helpers ----------
  const patch = useCallback((label: string, fn: (dv: PoiDetail) => void) => {
    st.editDetail(poiId, label, fn);
  }, [st, poiId]);

  const patchOne = (s: Selection, p: Record<string, unknown>, meta = false) => {
    const label = s.kind === "building" ? "sửa nhà" : s.kind === "prop" ? "sửa vật dụng" : "sửa cây";
    if (meta) {
      patch(label, (dv) => {
        const map = s.kind === "building" ? dv.overrides.buildings : s.kind === "prop" ? dv.overrides.props : dv.overrides.trees;
        (map as any)[s.id] = { ...((map as any)[s.id] || {}), ...p };
      });
    } else {
      st.mutate((q) => {
        const dv = q.details?.[poiId];
        if (!dv) return;
        const map = s.kind === "building" ? dv.overrides.buildings : s.kind === "prop" ? dv.overrides.props : dv.overrides.trees;
        (map as any)[s.id] = { ...((map as any)[s.id] || {}), ...p };
      });
    }
  };

  const deleteSelection = () => {
    const s = selRef.current;
    const dv = st.getDetail(poiId);
    if (!s || !dv || dv.locked) return;
    patch("xóa " + s.kind, (q) => {
      const kind = s.kind;
      if (kind === "building") {
        q.overrides.buildings[s.id] = { ...(q.overrides.buildings[s.id] || {}), removed: true };
        q.overrides.addedBuildings = q.overrides.addedBuildings.filter((b) => b.id !== s.id);
      } else if (kind === "prop") {
        q.overrides.props[s.id] = { ...(q.overrides.props[s.id] || {}), removed: true };
        q.overrides.addedProps = q.overrides.addedProps.filter((b) => b.id !== s.id);
      } else {
        q.overrides.trees[s.id] = { ...(q.overrides.trees[s.id] || {}), removed: true };
        q.overrides.addedTrees = q.overrides.addedTrees.filter((b) => b.id !== s.id);
      }
    });
    setSel(null);
  };

  const tileAt = (e: React.PointerEvent | React.MouseEvent): [number, number] | null => {
    const cv = cvRef.current;
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    const z = zoom;
    const x = (e.clientX - r.left) / z / T - SITE_MARGIN;
    const y = (e.clientY - r.top) / z / T - SITE_MARGIN;
    return [x, y];
  };

  const hitTest = (plan: ResolvedPlan, x: number, y: number): Selection | null => {
    for (let i = plan.props.length - 1; i >= 0; i--) {
      const p = plan.props[i];
      if (Math.abs(p.x + 0.5 - x) < 0.8 && Math.abs(p.y + 0.6 - y) < 0.95) return { kind: "prop", id: p.id };
    }
    for (let i = plan.trees.length - 1; i >= 0; i--) {
      const t = plan.trees[i];
      if (Math.hypot(t.x + 0.5 - x, t.y + 0.45 - y) < 0.85) return { kind: "tree", id: t.id };
    }
    for (let i = plan.buildings.length - 1; i >= 0; i--) {
      const b = plan.buildings[i];
      if (x >= b.x - 0.25 && x < b.x + b.w + 0.25 && y >= b.y - 1 && y < b.y + b.h + 0.45) return { kind: "building", id: b.id };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "edit" || !snap || !d) return;
    if (e.button !== 0) return;
    const p = tileAt(e);
    if (!p) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);

    if (tool === "spawn") {
      patch("đặt điểm spawn", (dv) => { dv.overrides.spawn = [Math.round(p[0] * 4) / 4, Math.round(p[1] * 4) / 4]; });
      setTool("select");
      return;
    }
    if (tool === "add_building") {
      if (d.locked) { st.toast("Bố cục đang khóa — mở khóa để thêm nhà."); return; }
      const id = "ab_" + Date.now().toString(36);
      const x = Math.max(0, Math.min(d.frame.w - 6, Math.round(p[0] - 3)));
      const y = Math.max(0, Math.min(d.frame.h - 5, Math.round(p[1] - 2)));
      const b = newBuilding(id, x, y);
      patch("thêm nhà", (dv) => { dv.overrides.addedBuildings.push(b); });
      setSel({ kind: "building", id });
      setTool("select");
      return;
    }
    if (tool === "add_prop" || tool === "add_tree") {
      if (d.locked) { st.toast("Bố cục đang khóa — mở khóa để thêm."); return; }
      const id = (tool === "add_prop" ? "ap_" : "at_") + Date.now().toString(36);
      const x = Math.round(p[0] * 4) / 4, y = Math.round(p[1] * 4) / 4;
      if (tool === "add_prop") {
        const pr = newProp(id, addType, x, y);
        patch("thêm vật dụng", (dv) => { dv.overrides.addedProps.push(pr); });
        setSel({ kind: "prop", id });
      } else {
        const tr: DetailTree = { id, kind: addTreeKind, x, y, v: Math.floor(Math.random() * 3) };
        patch("thêm cây", (dv) => { dv.overrides.addedTrees.push(tr); });
        setSel({ kind: "tree", id });
      }
      setTool("select");
      return;
    }

    const hit = hitTest(snap.plan, p[0], p[1]);
    setSel(hit);
    if (hit && !d.locked) {
      const plan = snap.plan;
      const obj = hit.kind === "building" ? plan.buildings.find((b) => b.id === hit.id) : hit.kind === "prop" ? plan.props.find((b) => b.id === hit.id) : plan.trees.find((b) => b.id === hit.id);
      if (obj) {
        dragRef.current = { sel: hit, startX: p[0], startY: p[1], origX: obj.x, origY: obj.y, moved: false };
        st.beginTx("Di chuyển " + (hit.kind === "building" ? "nhà" : hit.kind === "prop" ? "vật dụng" : "cây"));
      }
    } else if (!hit) {
      dragRef.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!snap || !d) return;
    const p = tileAt(e);
    if (!p) return;
    if (mode !== "edit") return;
    const dr = dragRef.current;
    if (dr && !d.locked) {
      const dx = p[0] - dr.startX, dy = p[1] - dr.startY;
      if (!dr.moved && Math.hypot(dx, dy) < 0.2) return;
      dr.moved = true;
      const frame = d.frame;
      if (dr.sel.kind === "building") {
        const b = snap.plan.buildings.find((q) => q.id === dr.sel.id);
        if (!b) return;
        const nx = Math.max(0, Math.min(frame.w - b.w, Math.round(dr.origX + dx)));
        const ny = Math.max(0, Math.min(frame.h - b.h, Math.round(dr.origY + dy)));
        patchOne(dr.sel, { x: nx, y: ny, door: doorFor({ ...b, x: nx, y: ny }, b.door.side) });
      } else if (dr.sel.kind === "prop") {
        const nx = Math.max(0, Math.min(frame.w - 1, Math.round((dr.origX + dx) * 4) / 4));
        const ny = Math.max(0, Math.min(frame.h - 1, Math.round((dr.origY + dy) * 4) / 4));
        patchOne(dr.sel, { x: nx, y: ny });
      } else {
        const nx = Math.max(0, Math.min(frame.w - 1, Math.round((dr.origX + dx) * 4) / 4));
        const ny = Math.max(0, Math.min(frame.h - 1, Math.round((dr.origY + dy) * 4) / 4));
        patchOne(dr.sel, { x: nx, y: ny });
      }
      return;
    }
    const h = hitTest(snap.plan, p[0], p[1]);
    setHover((cur: Selection | null) => (cur?.kind === h?.kind && cur?.id === h?.id ? cur : h));
  };

  const onPointerUp = () => {
    if (dragRef.current) {
      st.endTx();
      dragRef.current = null;
    }
  };

  // ---------- exports ----------
  const exportPNG = (scale: number) => {
    if (!snap) return;
    const cv = document.createElement("canvas");
    const s = canvasSize(snap.d.frame);
    cv.width = s.w * scale; cv.height = s.h * scale;
    const sess = sessionRef.current;
    renderVillage(cv, {
      plan: snap.plan, grid: snap.grid, frame: snap.d.frame, time: 0,
      actor: sess && mode === "play" ? { x: sess.x, y: sess.y, dir: sess.dir, moving: false, anim: 0 } : undefined,
      edit: false, showGrid: false, showLabels, seed: snap.d.seed,
    }, scale);
    cv.toBlob((b) => { if (b) downloadBlob(`greywater_poi_${scale}x.png`, b); }, "image/png");
  };

  const exportJSON = () => {
    if (!snap) return;
    downloadBlob("greywater_poi_detail.json", new Blob([JSON.stringify(snap.d, null, 2)], { type: "application/json" }));
  };
  const saveProjectFile = () => {
    st.saveLocal();
    downloadBlob("SoulOfHero_MapLab.sohmap.json", new Blob([serializeProject(st.project)], { type: "application/json" }));
    st.toast("Đã lưu dự án (kèm lớp chi tiết POI).");
  };

  if (!d || !snap) {
    return (
      <div className="ds-root" data-testid="detail-studio">
        <div className="ds-loading">Đang tạo lớp chi tiết cho POI…</div>
      </div>
    );
  }

  const plan = snap.plan;
  const selObj = sel ? (sel.kind === "building" ? plan.buildings.find((b) => b.id === sel.id) : sel.kind === "prop" ? plan.props.find((b) => b.id === sel.id) : plan.trees.find((b) => b.id === sel.id)) : null;
  const siteTiles = Math.round(d.frame.w * d.frame.h);
  const ctx = d.frame.context;
  const overCount = Object.keys(d.overrides.buildings).length + Object.keys(d.overrides.props).length + Object.keys(d.overrides.trees).length + d.overrides.addedBuildings.length + d.overrides.addedProps.length + d.overrides.addedTrees.length;
  const warnings = buildingWarnings(plan);
  const doorsOk = plan.buildings.filter((b) => !plan.buildings.some((o) => o.id !== b.id && b.door.x >= o.x && b.door.x < o.x + o.w && b.door.y >= o.y && b.door.y < o.y + o.h)).length;

  return (
    <div className="ds-root" data-testid="detail-studio">
      <header className="ds-head">
        <div className="ds-title">
          <span className="ds-badge">POI DETAIL · v1</span>
          <b>{d.poiName}</b>
          <code>{d.poiId}</code>
          <span className="ds-dim">{Math.round(d.frame.w)}×{Math.round(d.frame.h)} tiles · {siteTiles} ô · 1u = 1 tile = 16px</span>
        </div>
        <div className="ds-tabs">
          <button className={"ds-tab" + (mode === "edit" ? " on" : "")} data-testid="tab-edit" onClick={() => (mode === "play" ? leavePlay() : null)}>Chỉnh sửa</button>
          <button className={"ds-tab" + (mode === "play" ? " on" : "")} data-testid="tab-play" onClick={() => (mode === "edit" ? enterPlay() : null)}>Đi bộ / tương tác</button>
        </div>
        <div className="ds-actions">
          <button className="ds-btn" onClick={() => st.undo()} title="Undo (Ctrl+Z)" data-testid="undo">↶</button>
          <button className="ds-btn" onClick={() => st.redo()} title="Redo (Ctrl+Shift+Z)" data-testid="redo">↷</button>
          <button className={"ds-btn" + (d.locked ? " on" : "")} data-testid="lock" onClick={() => { st.setDetailLocked(poiId, !d.locked); st.toast(d.locked ? "Đã mở khóa bố cục." : "Đã khóa bố cục — không sửa/xóa/tái sinh được."); }}>{d.locked ? "🔒 Đã khóa" : "🔓 Khóa bố cục"}</button>
          <button className="ds-btn" data-testid="clear-overrides" onClick={() => { if (confirm("Bỏ toàn bộ sửa tay của Greywater? (dùng được Ctrl+Z)")) st.clearDetailOverrides(poiId); }}>Bỏ sửa tay</button>
          <button className="ds-btn primary" data-testid="save-project" onClick={saveProjectFile}>Lưu dự án</button>
          <button className="ds-btn" data-testid="close" onClick={() => { if (mode === "play") leavePlay(); onClose(); }}>Đóng ✕</button>
        </div>
      </header>

      <div className="ds-body">
        <aside className="ds-side ds-left">
          <div className="ds-sec">
            <div className="ds-h">Công cụ</div>
            <div className={"ds-tool" + (tool === "select" ? " on" : "")} onClick={() => setTool("select")}>🖱 Chọn / kéo di chuyển <kbd>V</kbd></div>
            <div className={"ds-tool" + (tool === "add_building" ? " on" : "")} data-testid="tool-add-building" onClick={() => setTool("add_building")}>🏠 Thêm nhà <kbd>B</kbd></div>
            <div className={"ds-tool" + (tool === "add_prop" ? " on" : "")} data-testid="tool-add-prop" onClick={() => setTool("add_prop")}>📦 Thêm vật dụng <kbd>P</kbd></div>
            <div className={"ds-tool" + (tool === "add_tree" ? " on" : "")} onClick={() => setTool("add_tree")}>🌳 Thêm cây <kbd>T</kbd></div>
            <div className={"ds-tool" + (tool === "spawn" ? " on" : "")} onClick={() => setTool("spawn")}>🚩 Đặt điểm spawn</div>
            {tool === "add_prop" && (
              <label className="ds-fld">Loại
                <select value={addType} onChange={(e) => setAddType(e.target.value)}>
                  {PROP_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            )}
            {tool === "add_tree" && (
              <label className="ds-fld">Cây
                <select value={addTreeKind} onChange={(e) => setAddTreeKind(e.target.value as DetailTree["kind"])}>
                  {TREE_KINDS.map((p) => <option key={p} value={p}>{TREE_LABEL[p]}</option>)}
                </select>
              </label>
            )}
            <div className="ds-hint">Click lên bản đồ để đặt · kéo để dời · Delete để xóa · Esc thoát.</div>
          </div>

          <div className="ds-sec">
            <div className="ds-h">Hiển thị</div>
            <label className="ds-chk"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Lưới ô ({T}px)</label>
            <label className="ds-chk"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Nhãn tên công trình</label>
            <div className="ds-zoom">
              {[1, 2, 3, 4].map((z) => <button key={z} className={"ds-mini" + (zoom === z ? " on" : "")} data-testid={"zoom-" + z} onClick={() => setZoom(z)}>{z}×</button>)}
              <span className="ds-dim">1× = {size.w}×{size.h}px</span>
            </div>
          </div>

          <div className="ds-sec">
            <div className="ds-h">Tái sinh / seed</div>
            <div className="ds-row">
              <input className="ds-inp" type="number" placeholder={String(d.seed)} value={seedDraft} onChange={(e) => setSeedDraft(e.target.value)} data-testid="seed-input" />
              <button className="ds-btn" data-testid="regen" disabled={d.locked} onClick={() => {
                const seed = seedDraft ? Math.floor(+seedDraft) : d.seed;
                st.regenerateDetail(poiId, seed);
                st.toast("Đã tái sinh bố cục với seed " + seed + " (giữ sửa tay).");
              }}>Tái sinh</button>
            </div>
            <div className="ds-dim">seed hiện tại <code>{d.seed}</code> · hash <code data-testid="hash">{d.hash}</code></div>
            <div className="ds-dim">Bố cục {d.edited ? <b>đã sửa tay</b> : "khớp bản sinh tự động"} · {overCount} override</div>
            <button className="ds-btn" data-testid="reframe" disabled={d.locked} onClick={() => { st.reframeDetail(poiId); st.toast("Đã cập nhật khung theo footprint POI."); }}>Cập nhật khung theo footprint</button>
          </div>

          <div className="ds-sec">
            <div className="ds-h">Xuất</div>
            <div className="ds-row">
              <button className="ds-mini" data-testid="png-1x" onClick={() => exportPNG(1)}>PNG 1×</button>
              <button className="ds-mini" data-testid="png-2x" onClick={() => exportPNG(2)}>PNG 2×</button>
              <button className="ds-mini" onClick={() => exportPNG(3)}>PNG 3×</button>
            </div>
            <button className="ds-btn" data-testid="export-json" onClick={exportJSON}>JSON lớp chi tiết</button>
            <div className="ds-hint">Ảnh xuất là pixel gốc (không upscale mượt), đúng tỉ lệ 16px/ô.</div>
          </div>
        </aside>

        <main className="ds-stage" ref={wrapRef}>
          <div className="ds-stagebar">
            <span>Site <b>{d.poiName}</b> · khung {d.frame.w.toFixed(0)}×{d.frame.h.toFixed(0)} ô</span>
            <span className="ds-dim">rot {d.frame.rot.toFixed(3)} rad · {plan.buildings.length} nhà · {plan.props.length} vật dụng · {plan.trees.length} cây · {plan.fences.length} hàng rào · {plan.connections.length} lối ra đường</span>
          </div>
          <div className="ds-scroll" ref={scrollRef}>
          <div className="ds-canvaswrap" style={{ width: size.w * zoom, height: size.h * zoom }}>
            <canvas
              ref={cvRef}
              width={size.w}
              height={size.h}
              data-testid="detail-canvas"
              className={"ds-canvas" + (tool !== "select" && mode === "edit" ? " placing" : "")}
              style={{ width: size.w * zoom, height: size.h * zoom }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => { onPointerUp(); setHover(null); }}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
          </div>
          {mode === "play" && (
              <div className="ds-hud">
                <div className="ds-chips">
                  <span className="chip">💧 Nước <b data-testid="hud-water">{hud.water}</b></span>
                  <span className="chip">📦 Vật tư <b data-testid="hud-supplies">{hud.supplies}</b></span>
                  <span className="chip">📖 Lượt đọc <b data-testid="hud-reads">{hud.reads}</b></span>
                  <span className="chip">🏮 Đèn <b data-testid="hud-lamps">{hud.lamps}</b></span>
                  {hud.inside && <span className="chip inside">🏠 Trong nhà — mái mờ</span>}
                </div>
                <div className="ds-prompt">
                  {hud.target ? <><kbd>E</kbd> {hud.target}</> : <span className="ds-dim">Đi bằng WASD / phím mũi tên · Esc để về chế độ sửa</span>}
                </div>
                {hud.toast && <div className="ds-toast" data-testid="play-toast">{hud.toast}</div>}
                <div className="ds-playbtns">
                  <button className="ds-btn" data-testid="reset-spawn" onClick={() => {
                    const sess = sessionRef.current; const dv = st.getDetail(poiId);
                    if (sess && dv) { const p = resolveDetail(dv); sess.x = p.spawn[0]; sess.y = p.spawn[1]; sess.inside = null; }
                  }}>Về điểm spawn</button>
                  <button className="ds-btn" data-testid="save-play" onClick={() => { savePlay(); st.toast("Đã lưu trạng thái đi bộ vào dự án."); }}>Lưu trạng thái</button>
                  <button className="ds-btn" onClick={leavePlay}>Về chỉnh sửa</button>
                </div>
              </div>
          )}
          {notice && (
              <div className="ds-modal" data-testid="notice" onPointerDown={(e) => e.stopPropagation()}>
                <div className="ds-modal-box">
                  <pre>{NOTICE_TEXT}</pre>
                  <button className="ds-btn primary" data-testid="notice-close" onClick={() => { setNotice(false); const s = sessionRef.current; if (s) s.noticeOpen = false; }}>Đọc xong</button>
                </div>
              </div>
          )}
          <div className="ds-legend">
            <span><i className="lg roof" /> Máy che & mờ khi vào nhà</span>
            <span><i className="lg door" /> Cửa vào</span>
            <span><i className="lg prop" /> Vật dụng tương tác</span>
            <span><i className="lg road" /> Lối ra đường Map Studio</span>
            <span><i className="lg water" /> Nước (sông/hồ Map Studio)</span>
          </div>
        </main>

        <aside className="ds-side ds-right" data-testid="inspector">
          <div className="ds-sec">
            <div className="ds-h">Bố cục</div>
            <div className="ds-kv"><span>Nhà</span><b>{plan.buildings.length}</b></div>
            <div className="ds-kv"><span>Vật dụng</span><b>{plan.props.length}</b></div>
            <div className="ds-kv"><span>Cây</span><b>{plan.trees.length}</b></div>
            <div className="ds-kv"><span>Cửa thông thoáng</span><b>{doorsOk}/{plan.buildings.length}</b></div>
            <div className="ds-kv"><span>Lối ra đường</span><b>{plan.connections.length}</b></div>
            <div className="ds-kv"><span>Cảnh báo hình học</span><b className={warnings.length ? "warn" : ""}>{warnings.length}</b></div>
            {warnings.slice(0, 4).map((w, i) => <div key={i} className="ds-warn">• {w}</div>)}
          </div>

          <div className="ds-sec">
            <div className="ds-h">Địa lý Map Studio</div>
            <div className="ds-kv"><span>Biome</span><b>{ctx.biomeName}</b></div>
            <div className="ds-kv"><span>Sông gần nhất</span><b>{ctx.nearestRiver ? `${ctx.nearestRiver.name} · ${ctx.nearestRiver.distance.toFixed(0)}u` : "—"}</b></div>
            <div className="ds-kv"><span>Hồ gần nhất</span><b>{ctx.nearestLake ? `${ctx.nearestLake.name} · ${ctx.nearestLake.distance.toFixed(0)}u` : "—"}</b></div>
            <div className="ds-kv"><span>Đường chạm site</span><b>{ctx.roadHits.length ? ctx.roadHits.map((r) => r.name).join(", ") : "—"}</b></div>
            <div className="ds-hint">Foot polygon chỉ là <b>ranh site</b>; bố cục làng do lớp chi tiết sinh ra và giữ nguyên sông/hồ/đường của Map Studio (không sửa GOLD geography).</div>
          </div>

          <div className="ds-sec">
            <div className="ds-h">Đối tượng đang chọn</div>
            {!selObj && <div className="ds-dim">Chưa chọn. Click một nhà / vật dụng / cây trên bản đồ.</div>}
            {selObj && sel?.kind === "building" && <BuildingForm key={selObj.id} b={selObj as DetailBuilding} locked={d.locked} onPatch={(p) => patchOne(sel!, p, true)} onDelete={deleteSelection} />}
            {selObj && sel?.kind === "prop" && <PropForm key={selObj.id} p={selObj as DetailProp} locked={d.locked} onPatch={(p) => patchOne(sel!, p, true)} onDelete={deleteSelection} />}
            {selObj && sel?.kind === "tree" && <TreeForm key={selObj.id} t={selObj as DetailTree} locked={d.locked} onPatch={(p) => patchOne(sel!, p, true)} onDelete={deleteSelection} />}
          </div>

          <div className="ds-sec">
            <div className="ds-h">Đi bộ</div>
            <div className="ds-kv"><span>Điểm spawn</span><b>{plan.spawn[0].toFixed(1)}, {plan.spawn[1].toFixed(1)}</b></div>
            <div className="ds-kv"><span>Trạng thái đã lưu</span><b>{savedPlay ? "có" : "—"}</b></div>
            <div className="ds-hint">Vào tab “Đi bộ / tương tác” để đi trong làng; mái nhà mờ khi vào trong; <kbd>E</kbd> dùng giếng / thùng / bảng tin / đèn.</div>
          </div>

          <div className="ds-sec">
            <div className="ds-h">Nguồn gốc code</div>
            <div className="ds-hint">
              Dựng hình pixel &amp; nhân vật: lấy từ prototype <code>src/game/art.ts</code> (<code>mk/outlineCanvas/hex/P/R/ell/shade/strs</code>, <code>buildHero</code>).
              Nền, bóng, thứ tự vẽ theo <code>render.ts</code> (<code>PAL/texel</code>, y-sort, mái <code>alpha 0.12</code> khi ở trong).
              Địa hình/đường/sông đọc từ Map Studio; toàn bộ bố cục làng là code mới viết cho site này.
            </div>
          </div>
        </aside>
      </div>

      <footer className="ds-foot">
        <span>Greywater Hamlet · pilot 1 POI · dữ liệu nằm trong <code>project.details["{poiId}"]</code> (.sohmap.json vẫn tương thích ngược)</span>
        <span className="ds-dim">Không sửa geography GOLD · A0/A3 và Map Tower không đổi</span>
      </footer>
    </div>
  );
}

// ---------------- inspector sub-forms ----------------

function NumStep({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <div className="ds-kv">
      <span>{label}</span>
      <span className="ds-num">
        <button className="ds-mini" disabled={disabled} onClick={() => onChange(Math.max(2, value - 1))}>−</button>
        <b>{value}</b>
        <button className="ds-mini" disabled={disabled} onClick={() => onChange(Math.min(24, value + 1))}>+</button>
      </span>
    </div>
  );
}

function BuildingForm({ b, locked, onPatch, onDelete }: { b: DetailBuilding; locked: boolean; onPatch: (p: Record<string, unknown>) => void; onDelete: () => void }) {
  return (
    <div className="ds-form" data-testid="form-building">
      <label className="ds-fld">Tên<input className="ds-inp" value={b.name} disabled={locked} onChange={(e) => onPatch({ name: e.target.value })} /></label>
      <label className="ds-fld">Loại
        <select value={b.kind} disabled={locked} onChange={(e) => onPatch({ kind: e.target.value })}>
          {BUILDING_KINDS.map((k) => <option key={k} value={k}>{BUILDING_LABEL[k]}</option>)}
        </select>
      </label>
      <label className="ds-fld">Mái
        <select value={b.roof} disabled={locked} onChange={(e) => onPatch({ roof: e.target.value })}>
          {ROOF_KINDS.map((k) => <option key={k} value={k}>{ROOF_LABEL[k]}</option>)}
        </select>
      </label>
      <label className="ds-fld">Vách
        <select value={b.wall} disabled={locked} onChange={(e) => onPatch({ wall: e.target.value })}>
          {WALL_KINDS.map((k) => <option key={k} value={k}>{WALL_LABEL[k]}</option>)}
        </select>
      </label>
      <NumStep label="Rộng (ô)" value={b.w} disabled={locked} onChange={(v) => onPatch({ w: v, door: doorFor({ ...b, w: v }, b.door.side) })} />
      <NumStep label="Sâu (ô)" value={b.h} disabled={locked} onChange={(v) => onPatch({ h: v, door: doorFor({ ...b, h: v }, b.door.side) })} />
      <label className="ds-fld">Hướng cửa
        <select value={b.door.side} disabled={locked} onChange={(e) => onPatch({ door: doorFor(b, e.target.value as DetailBuilding["door"]["side"]) })}>
          <option value="s">Nam (ra đường làng)</option><option value="n">Bắc</option><option value="e">Đông</option><option value="w">Tây</option>
        </select>
      </label>
      <label className="ds-chk"><input type="checkbox" checked={!!b.chimney} disabled={locked} onChange={(e) => onPatch({ chimney: e.target.checked })} /> Ống khói</label>
      <div className="ds-kv"><span>Toạ độ</span><b>{b.x}, {b.y} · {b.w}×{b.h}</b></div>
      <div className="ds-kv"><span>Cửa</span><b>{b.door.x}, {b.door.y} ({b.door.side})</b></div>
      <button className="ds-btn danger" disabled={locked} onClick={onDelete} data-testid="delete-object">Xóa nhà này</button>
    </div>
  );
}

function PropForm({ p, locked, onPatch, onDelete }: { p: DetailProp; locked: boolean; onPatch: (q: Record<string, unknown>) => void; onDelete: () => void }) {
  return (
    <div className="ds-form" data-testid="form-prop">
      <div className="ds-kv"><span>Loại</span><b>{p.type}</b></div>
      <label className="ds-fld">Loại
        <select value={p.type} disabled={locked} onChange={(e) => { const type = e.target.value; onPatch({ type, solid: SOLID_PROPS.has(type), interact: propInteract(p.id, type) }); }}>
          {PROP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="ds-chk"><input type="checkbox" checked={p.solid} disabled={locked} onChange={(e) => onPatch({ solid: e.target.checked })} /> Chặn đường</label>
      <div className="ds-kv"><span>Toạ độ</span><b>{p.x.toFixed(2)}, {p.y.toFixed(2)}</b></div>
      <div className="ds-kv"><span>Tương tác</span><b>{p.interact ? p.interact.kind : "—"}</b></div>
      {p.interact && <label className="ds-fld">Lời nhắc<input className="ds-inp" value={p.interact.text || ""} disabled={locked} onChange={(e) => onPatch({ interact: { ...p.interact!, text: e.target.value } })} /></label>}
      <button className="ds-btn danger" disabled={locked} onClick={onDelete} data-testid="delete-object">Xóa vật dụng</button>
    </div>
  );
}

function TreeForm({ t, locked, onPatch, onDelete }: { t: DetailTree; locked: boolean; onPatch: (q: Record<string, unknown>) => void; onDelete: () => void }) {
  return (
    <div className="ds-form" data-testid="form-tree">
      <label className="ds-fld">Loại
        <select value={t.kind} disabled={locked} onChange={(e) => onPatch({ kind: e.target.value })}>
          {TREE_KINDS.map((k) => <option key={k} value={k}>{TREE_LABEL[k]}</option>)}
        </select>
      </label>
      <div className="ds-kv"><span>Toạ độ</span><b>{t.x.toFixed(2)}, {t.y.toFixed(2)}</b></div>
      <button className="ds-btn danger" disabled={locked} onClick={onDelete} data-testid="delete-object">Xóa cây</button>
    </div>
  );
}

function buildingWarnings(plan: ResolvedPlan): string[] {
  const out: string[] = [];
  for (let i = 0; i < plan.buildings.length; i++) {
    for (let j = i + 1; j < plan.buildings.length; j++) {
      const a = plan.buildings[i], b = plan.buildings[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) out.push(`${a.name} chồng lấn ${b.name}`);
    }
    const b = plan.buildings[i];
    if (b.door.x < 0 || b.door.y < 0) out.push(`${b.name}: cửa nằm ngoài site`);
  }
  return out;
}
