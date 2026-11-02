/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useRef, useState } from "react";
import "./maplab.css";
import { buildSeedProject } from "../seed";
import { Store, newBlankProject, parseProject, serializeProject } from "../store";
import { Interaction, fitView, zoomTo, objectAnchor } from "../interact";
import { drawMinimap, drawScene, heatCanvas, renderBase, VIEW_NAMES } from "../render";
import { heatmap, houseTest } from "../analysis";
import { buildBrief, buildValidationMD, download, exportMapTowerZip, renderPNG, renderSVG } from "../exporter";
import { ARCHES, BIOMES, COLL_NAME, ELDERS, RES_KINDS, allObjects } from "../types";
import type { ToolId, ViewMode } from "../types";
import { Inspector, LayersPanel, SmartPanel, SnapshotsPanel, ValidationBar } from "./Panels";
import { DetailStudio } from "./DetailStudio";
import { proposeSmooth } from "../smart";

const ICONS: Record<string, string> = {
  select: "M5 3l14 8-6 2 4 7-3 1-4-7-5 4z", pan: "M8 12V6a1.5 1.5 0 013 0v5m0-6a1.5 1.5 0 013 0v6m0-4a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-1a6 6 0 01-5-3l-3-5a1.5 1.5 0 012.5-1.5L8 15",
  land_add: "M4 15c0-5 4-9 9-9s7 4 7 8-3 6-8 6-8-1-8-5zM12 10v6M9 13h6", land_sub: "M4 15c0-5 4-9 9-9s7 4 7 8-3 6-8 6-8-1-8-5zM9 13h6", land_poly: "M4 18l3-11 8-3 5 8-4 8z",
  elev: "M3 19l6-10 4 6 3-4 5 8z", biome: "M12 3c5 3 7 8 0 18C5 11 7 6 12 3zM12 8v10", river: "M3 7c4-3 5 3 9 0s5-2 9 0M3 14c4-3 5 3 9 0s5-2 9 0M3 20c4-3 5 3 9 0s5-2 9 0",
  canal: "M4 8h16M4 16h16M8 8v8M16 8v8", lake: "M4 12c0-4 4-7 9-6s7 5 6 8-6 5-10 4-5-3-5-6z", road: "M8 3L5 21M16 3l3 18M12 5v3M12 11v3M12 17v3",
  bridge: "M2 17h20M4 17v-4c0-4 4-6 8-6s8 2 8 6v4M8 17v-5M12 17V8M16 17v-5", dock: "M12 3v18M7 8h10M5 14c0 4 3 6 7 6s7-2 7-6", poi: "M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11zM12 7a3 3 0 100 6 3 3 0 000-6z",
  zone: "M4 5h16v14H4zM4 12h16M12 5v14", elder: "M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z", resource: "M12 3l8 9-8 9-8-9z", spawn: "M6 21V4M6 4h12l-3 4 3 4H6",
  housetest: "M3 11l9-8 9 8M6 10v10h12V10M10 20v-6h4v6", label: "M5 5h14M12 5v14M9 19h6", measure: "M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2", region: "M4 4h6M14 4h6M4 20h6M14 20h6M4 4v6M4 14v6M20 4v6M20 14v6",
};
export const TOOLS: { id: ToolId; name: string; key: string; hint: string; div?: boolean }[] = [
  { id: "select", name: "Chọn / di chuyển", key: "V", hint: "Click chọn · Shift+click đa chọn · kéo nền trống = chọn khung · kéo đối tượng để di chuyển · kéo chấm trắng = sửa đỉnh · double-click cạnh = thêm đỉnh · Alt+click đỉnh = xóa đỉnh" },
  { id: "pan", name: "Kéo bản đồ (Space + kéo)", key: "H", hint: "Kéo để di chuyển khung nhìn · lăn chuột = zoom theo vị trí con trỏ" },
  { id: "land_add", name: "Brush thêm đất / đảo", key: "B", hint: "Kéo để thêm đất; tạo đảo mới ngoài biển; hợp nhất đảo chạm nhau · [ ] đổi cỡ brush", div: true },
  { id: "land_sub", name: "Brush xóa đất / tạo vịnh, hồ biển, lỗ biển", key: "N", hint: "Kéo để cắt đất: vịnh, eo biển, lỗ biển giữa đảo; tách đảo" },
  { id: "land_poly", name: "Vẽ khối đất (polygon)", key: "P", hint: "Click từng điểm · double-click/Enter = xong · Esc = hủy" },
  { id: "elev", name: "Vẽ độ cao (Shift = ngược)", key: "E", hint: "Kéo để nâng/hạ/làm mượt/san phẳng độ cao. Ảnh hưởng hillshade, đồng mức, độ dốc" },
  { id: "biome", name: "Vẽ biome", key: "G", hint: "Chọn biome ở thanh trên rồi kéo để sơn" },
  { id: "river", name: "Vẽ sông (spline)", key: "R", hint: "Click thêm điểm điều khiển theo chiều chảy; đầu cuối tự bắt vào hồ/sông/biển · double-click/Enter = xong", div: true },
  { id: "canal", name: "Vẽ kênh đào", key: "C", hint: "Giống sông nhưng là kênh nhân tạo (cần lý do + công trình)" },
  { id: "lake", name: "Vẽ hồ", key: "L", hint: "Click các điểm · double-click = xong" },
  { id: "road", name: "Vẽ đường / tuyến phà", key: "D", hint: "Chọn loại ở thanh trên. Điểm đầu/cuối bắt vào POI, bến, đường khác (T-junction)", div: true },
  { id: "bridge", name: "Đặt cầu", key: "J", hint: "Click gần giao cắt đường–sông" },
  { id: "dock", name: "Đặt bến", key: "K", hint: "Click sát bờ hồ/sông/biển — bến tự gắn vào nước gần nhất" },
  { id: "poi", name: "Đặt POI (hoặc kéo từ thư viện)", key: "O", hint: "Chọn archetype bên trái rồi click, hoặc kéo-thả vào bản đồ", div: true },
  { id: "zone", name: "Vẽ vùng xây nhà", key: "Z", hint: "Click các điểm · double-click = xong" },
  { id: "elder", name: "Lãnh thổ Elder", key: "T", hint: "Chọn Elder + phần (ngoại vi/lõi/khu chiến đấu/điểm tiếp cận) rồi vẽ" },
  { id: "resource", name: "Đặt nguồn sống", key: "S", hint: "Click để đặt nút nguồn" },
  { id: "spawn", name: "Đặt điểm spawn", key: "W", hint: "Click để đặt spawn" },
  { id: "housetest", name: "Thử nhà tại điểm bất kỳ", key: "Y", hint: "Click bất kỳ điểm nào để xem lợi thế/bất lợi (Inspector)", div: true },
  { id: "label", name: "Nhãn chữ", key: "X", hint: "Click để đặt nhãn" },
  { id: "measure", name: "Đo khoảng cách", key: "M", hint: "Kéo để đo (đơn vị trừu tượng u)" },
  { id: "region", name: "Chọn vùng (cho tái sinh cục bộ)", key: "Q", hint: "Kéo khung → tab Smart → tái sinh chi tiết cục bộ" },
];
const KEYMAP: Record<string, ToolId> = Object.fromEntries(TOOLS.map((t) => [t.key.toLowerCase(), t.id]));

function useVer(st: Store) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const un = st.subscribe(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setV((x) => x + 1); }); });
    return () => { un(); cancelAnimationFrame(raf); };
  }, [st]);
  return v;
}
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d");

export default function MapLabApp() {
  const [st, setSt] = useState<Store | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      const fresh = new URLSearchParams(location.search).has("fresh");
      let p = fresh ? null : Store.loadLocal();
      const restored = !!p;
      if (!p) p = buildSeedProject();
      const s = new Store(p);
      (window as any).__maplab = { store: s };
      setSt(s);
      if (restored) s.toast("Đã khôi phục bản tự lưu cục bộ");
    }, 40);
    return () => clearTimeout(id);
  }, []);
  if (!st) return <div className="soh"><div className="loading" style={{ gridColumn: "1 / -1", gridRow: "1 / -1" }}>Đang dựng thế giới Soul of Hero…</div></div>;
  return <Shell st={st} />;
}

function Shell({ st }: { st: Store }) {
  useVer(st);
  const ui = st.ui;
  const cvRef = useRef<HTMLCanvasElement>(null), miniRef = useRef<HTMLCanvasElement>(null);
  const itRef = useRef<Interaction | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; hit: string | null; w: [number, number] } | null>(null);
  const [help, setHelp] = useState(() => { try { return !localStorage.getItem("soh-maplab-seen"); } catch { return false; } });
  const [busy, setBusy] = useState("");
  const [mini, setMini] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [palQ, setPalQ] = useState(""); const [palI, setPalI] = useState(0);

  // ---- canvas + render loop ----
  useEffect(() => {
    const cv = cvRef.current!, mini = miniRef.current!;
    const it = new Interaction(st, cv);
    itRef.current = it;
    (window as any).__maplab.it = it;
    it.onContext = (x, y, hit, w) => { if (hit && !st.sel.has(hit.id)) st.select(st.withGroup([hit.id])); setCtx({ x, y, hit: hit?.id || null, w }); };
    const detach = it.attach();
    let dirty = true, raf = 0, first = true, hiTimer: any = 0;
    const cache: Record<number, { id: number; c: HTMLCanvasElement }> = {};
    const build = (s: number) => (cache[s] = { id: st.project.baseId, c: renderBase(st.project, s) });
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = cv.parentElement!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      st.canvasSize = { w: r.width, h: r.height };
      if (first) { first = false; fitView(st); }
      dirty = true;
    };
    const ro = new ResizeObserver(resize); ro.observe(cv.parentElement!); resize();
    const un = st.subscribe(() => { dirty = true; });
    let heat: { key: string; cv: HTMLCanvasElement | null } = { key: "", cv: null };
    const getBase = () => {
      const p = st.project, ok = (s: number) => (cache[s] && cache[s].id === p.baseId ? cache[s] : null);
      if (it.busy) { const b = ok(0.5) || build(0.5); return { c: b.c, s: 0.5 }; }
      const lo = ok(1) || build(1);
      if (st.view.s * dpr > 1.45 && !ok(2) && !hiTimer) hiTimer = setTimeout(() => { hiTimer = 0; if (!it.busy) { build(2); dirty = true; } }, 450);
      const hi = ok(2);
      return hi ? { c: hi.c, s: 2 } : { c: lo.c, s: 1 };
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!dirty) return;
      dirty = false;
      const p = st.project, u = st.ui, g = cv.getContext("2d")!;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      const b = getBase();
      if (u.layers.heat && u.heat !== "none") { const key = st.version + u.heat; if (heat.key !== key && !it.drag) heat = { key, cv: heatCanvas(p, heatmap(p, it.getFields(), u.heat), u.heat) }; }
      g.save(); g.scale(dpr, dpr);
      drawScene(g, p, st.view, { mode: u.mode, layers: u.layers, dim: u.dim, sel: st.sel, hover: st.hoverId, gridSize: u.gridSize, heat: u.layers.heat ? heat.cv : null, blocked: u.blocked, changed: u.changed, extras: it.extras(), ragnarok: u.ragnarok, selVertex: u.selVertex, hoverSeg: u.hoverSeg, vw: st.canvasSize.w, vh: st.canvasSize.h, hideEditor: u.viewOnly }, b.c, b.s);
      // scale bar
      const len = 100 * st.view.s;
      g.fillStyle = "#0f1a26dd"; g.fillRect(st.canvasSize.w - 190, st.canvasSize.h - 54, 180, 22);
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.moveTo(st.canvasSize.w - 182, st.canvasSize.h - 38); g.lineTo(st.canvasSize.w - 182, st.canvasSize.h - 34); g.lineTo(st.canvasSize.w - 182 + Math.min(len, 90), st.canvasSize.h - 34); g.lineTo(st.canvasSize.w - 182 + Math.min(len, 90), st.canvasSize.h - 38); g.stroke();
      g.fillStyle = "#cde"; g.font = "11px Segoe UI, sans-serif"; g.fillText(`${Math.round(Math.min(len, 90) / st.view.s)} u (đơn vị trừu tượng)`, st.canvasSize.w - 182 + Math.min(len, 90) + 6, st.canvasSize.h - 36);
      g.restore();
      const mg = mini.getContext("2d")!;
      drawMinimap(mg, p, cache[1]?.id === p.baseId ? cache[1].c : b.c, b.s, st.view, st.canvasSize.w, st.canvasSize.h, mini.width, mini.height);
      cv.style.cursor = u.tool === "pan" || it.space ? "grab" : u.tool === "select" ? (st.hoverId ? "pointer" : "default") : "crosshair";
    };
    raf = requestAnimationFrame(frame);
    const t = setInterval(() => { dirty = true; }, 1500);
    // debounced validation
    let vt: any = 0;
    const un2 = st.subscribe(() => { if (vt) clearTimeout(vt); if (it.busy || it.drag) return; vt = setTimeout(() => { st.runChecks(); st.emit(); }, 1100); });
    vt = setTimeout(() => { st.runChecks(); st.emit(); }, 400);
    return () => { cancelAnimationFrame(raf); detach(); ro.disconnect(); un(); un2(); clearInterval(t); clearTimeout(vt); };
  }, [st]);

  // ---- keyboard ----
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (st.ui.detailOpen) return; // POI Detail Studio owns the keyboard while open
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tg?.tagName)) { if (e.key === "Escape") (tg as HTMLElement).blur(); return; }
      const it = itRef.current!, k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (mod) {
        if (k === "z") { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); }
        else if (k === "y") { e.preventDefault(); st.redo(); }
        else if (k === "d") { e.preventDefault(); st.duplicate([...st.sel]); }
        else if (k === "g") { e.preventDefault(); e.shiftKey ? st.ungroup([...st.sel]) : st.group([...st.sel]); }
        else if (k === "s") { e.preventDefault(); download((st.project.name.replace(/\W+/g, "_") || "soh_map") + ".sohmap.json", new Blob([serializeProject(st.project)], { type: "application/json" })); st.toast("Đã lưu dự án (.sohmap.json)"); }
        else if (k === "k") { e.preventDefault(); st.setUI({ paletteOpen: true }); setPalQ(""); setPalI(0); }
        else if (k === "c") { st.copy([...st.sel]); }
        else if (k === "v") { st.paste(); }
        else if (k === "a") { e.preventDefault(); st.select(allObjects(st.project).filter((o) => o.coll !== "land").map((o) => o.obj.id)); }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (it.draft.length) { it.draft.pop(); st.emit(); return; }
        const one = st.sel.size === 1 ? st.get([...st.sel][0]) : null;
        if (one && st.ui.selVertex >= 0) { const vs = (one.points && "points") || (one.ring && "ring") || (one.rings && "rings") || null; if (vs) { it.removeVertex(one.id, vs, vs === "rings" ? 0 : undefined, st.ui.selVertex); st.ui.selVertex = -1; return; } }
        st.removeIds([...st.sel].filter((i) => !st.get(i)?.locked)); return;
      }
      if (e.key === "Escape") { if (it.draft.length || it.drag) it.cancelDraft(); else if (st.proposals.length) { st.proposals = []; st.emit(); } else if (st.sel.size) st.select([]); else st.setUI({ tool: "select", testResult: null, regionRect: null }); st.reachOv = []; st.emit(); return; }
      if (e.key === "Enter") { if (it.draft.length) it.finishDraft(); return; }
      if (e.key === "Tab") { e.preventDefault(); st.setUI({ viewOnly: !st.ui.viewOnly }); return; }
      if (e.key === "[") { st.ui.brush.size = Math.max(8, st.ui.brush.size - 8); st.emit(); return; }
      if (e.key === "]") { st.ui.brush.size = Math.min(160, st.ui.brush.size + 8); st.emit(); return; }
      if (e.key === "?" || e.key === "F1") { e.preventDefault(); setHelp(true); return; }
      if (k === "f" || e.key === "Home") { fitView(st); return; }
      if (e.key >= "1" && e.key <= "7") { st.setMode((["atlas", "clean", "hydro", "transport", "poi", "elders", "opp"] as ViewMode[])[+e.key - 1]); return; }
      if (k === "+" || k === "=") { st.view = { ...st.view, s: Math.min(10, st.view.s * 1.25) }; st.emit(); return; }
      if (k === "-") { st.view = { ...st.view, s: Math.max(0.15, st.view.s / 1.25) }; st.emit(); return; }
      if (KEYMAP[k] && !e.shiftKey) { it.cancelDraft(); st.setUI({ tool: KEYMAP[k] }); }
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [st]);

  useEffect(() => { const c = () => { setMenu(null); setCtx(null); }; window.addEventListener("pointerdown", c); return () => window.removeEventListener("pointerdown", c); }, []);
  const it = () => itRef.current!;
  const act = async (name: string, fn: () => Promise<void> | void) => { setBusy(name); try { await new Promise((r) => setTimeout(r, 30)); await fn(); } catch (e) { st.toast("Lỗi: " + (e as Error).message); console.error(e); } setBusy(""); };
  const projName = (st.project.name || "soh_map").replace(/\W+/g, "_").slice(0, 40);

  const exportZip = () => act("Đang dựng Export for Map Tower…", async () => {
    const checks = st.runChecks(true);
    const blob = await exportMapTowerZip(st.project, checks, (st.project.meta as any).notes || "", (m) => setBusy("Export for Map Tower: " + m));
    download(`${projName}_MapTower_export.zip`, blob); st.toast("Đã xuất ZIP cho Map Tower");
  });
  const commands: { name: string; run: () => void }[] = [
    ...TOOLS.map((t) => ({ name: `Công cụ: ${t.name} [${t.key}]`, run: () => st.setUI({ tool: t.id }) })),
    ...(Object.keys(VIEW_NAMES) as ViewMode[]).map((m, i) => ({ name: `Chế độ xem ${i + 1}: ${VIEW_NAMES[m]}`, run: () => st.setMode(m) })),
    { name: "Hoàn tác (Ctrl+Z)", run: () => st.undo() }, { name: "Làm lại (Ctrl+Y)", run: () => st.redo() }, { name: "Zoom vừa bản đồ (F)", run: () => fitView(st) },
    { name: "Chế độ chỉ xem (Tab)", run: () => st.setUI({ viewOnly: true }) }, { name: "Lưu dự án (.json)", run: () => download(projName + ".sohmap.json", new Blob([serializeProject(st.project)], { type: "application/json" })) },
    { name: "Export for Map Tower (ZIP)", run: () => void exportZip() }, { name: "Chạy kiểm tra Bible", run: () => { st.runChecks(true); st.setUI({ bottomOpen: true }); } },
    { name: "Làm mượt đối tượng đang chọn (xem trước)", run: () => { st.proposals = proposeSmooth(st); st.setUI({ panel: "smart" }); } },
    { name: "Bật/tắt Ragnarok overlay", run: () => st.setUI({ ragnarok: !st.ui.ragnarok }) }, { name: "Bật/tắt snap", run: () => st.setUI({ snap: !st.ui.snap }) }, { name: "Hướng dẫn & phím tắt", run: () => setHelp(true) },
    ...allObjects(st.project).filter((o) => o.coll !== "land" || true).map((o) => ({ name: `${COLL_NAME[o.coll]}: ${o.obj.name}`, run: () => { st.select([o.obj.id]); zoomTo(st, objectAnchor(o.obj as any), 140); st.setUI({ panel: "inspect" }); } })),
  ];
  const palRes = ui.paletteOpen ? commands.filter((c) => norm(c.name).includes(norm(palQ))).slice(0, 40) : [];

  const tool = TOOLS.find((t) => t.id === ui.tool)!;
  const sel = st.selected();
  const ctxObj = ctx?.hit ? st.get(ctx.hit) : null;
  const cur = itRef.current?.cursor || [0, 0];

  return (
    <div className={"soh" + (ui.viewOnly ? " viewonly" : "")}>
      <header className="top">
        <div className="brand">⚔ <span>Soul of Hero · <b>Map Lab</b></span></div>
        <div className="sep" />
        <div className="menu" onPointerDown={(e) => e.stopPropagation()}>
          <button className="btn" onClick={() => setMenu(menu === "file" ? null : "file")}>Dự án ▾</button>
          {menu === "file" && <div className="pop">
            <button onClick={() => { setMenu(null); if (confirm("Tạo dự án trống? (Bản hiện tại có thể khôi phục bằng Hoàn tác)")) st.replaceProject(newBlankProject(), false), fitView(st); }}>🗎 Dự án mới (bản đồ trống)</button>
            <button onClick={() => { setMenu(null); act("Đang dựng bản đồ Soul of Hero…", () => { st.replaceProject(buildSeedProject()); fitView(st); }); }}>🌍 Nạp bản đồ Soul of Hero khởi tạo</button>
            <hr />
            <button onClick={() => { setMenu(null); download(projName + ".sohmap.json", new Blob([serializeProject(st.project)], { type: "application/json" })); st.toast("Đã lưu " + projName + ".sohmap.json"); }}>💾 Lưu dự án (.sohmap.json)  <span className="kbd">Ctrl+S</span></button>
            <button onClick={() => { setMenu(null); fileRef.current?.click(); }}>📂 Mở / nhập dự án…</button>
            <hr />
            <button onClick={() => { setMenu(null); st.takeSnapshot("Snapshot " + new Date().toLocaleTimeString()); st.setUI({ panel: "snap" }); }}>📸 Lưu snapshot (so sánh A/B)</button>
            <button onClick={() => { setMenu(null); setHelp(true); }}>❓ Hướng dẫn & phím tắt</button>
          </div>}
        </div>
        <div className="menu" onPointerDown={(e) => e.stopPropagation()}>
          <button className="btn" onClick={() => setMenu(menu === "exp" ? null : "exp")}>Xuất ▾</button>
          {menu === "exp" && <div className="pop">
            <button onClick={() => { setMenu(null); act("Xuất PNG…", async () => download(projName + "_2x.png", await renderPNG(st.project, ui.mode, 2))); }}>🖼 PNG độ phân giải cao 2× (theo chế độ xem)</button>
            <button onClick={() => { setMenu(null); act("Xuất PNG 3×…", async () => download(projName + "_3x.png", await renderPNG(st.project, ui.mode, 3))); }}>🖼 PNG 3× (6000×4200)</button>
            <button onClick={() => { setMenu(null); act("Xuất SVG…", async () => download(projName + ".svg", new Blob([await renderSVG(st.project)], { type: "image/svg+xml" }))); }}>✏ SVG (vector + nền raster)</button>
            <button onClick={() => { setMenu(null); download(projName + ".sohmap.json", new Blob([serializeProject(st.project, true)], { type: "application/json" })); }}>{"{ }"} JSON đầy đủ (nạp lại không mất gì)</button>
            <button onClick={() => { setMenu(null); download(projName + "_brief.md", new Blob([buildBrief(st.project, st.runChecks(true))], { type: "text/markdown" })); }}>📝 Brief Markdown tự sinh</button>
            <button onClick={() => { setMenu(null); download(projName + "_validation.md", new Blob([buildValidationMD(st.runChecks(true))], { type: "text/markdown" })); }}>✔ Báo cáo validation (MD)</button>
            <hr />
            <button onClick={() => { setMenu(null); void exportZip(); }}><b>📦 Export for Map Tower (ZIP)</b></button>
          </div>}
        </div>
        <input ref={fileRef} type="file" accept=".json,.sohmap" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const p = parseProject(await f.text()); st.replaceProject(p); fitView(st); st.toast("Đã mở " + f.name); } catch (er) { st.toast("Không mở được: " + (er as Error).message); } e.target.value = ""; }} />
        <div className="sep" />
        <button className="btn" title="Hoàn tác (Ctrl+Z)" disabled={!st.past.length} onClick={() => st.undo()}>↶</button>
        <button className="btn" title="Làm lại (Ctrl+Y)" disabled={!st.future.length} onClick={() => st.redo()}>↷</button>
        <div className="sep" />
        <select value={ui.mode} onChange={(e) => st.setMode(e.target.value as ViewMode)} title="Chế độ xem (phím 1–7)">
          {(Object.keys(VIEW_NAMES) as ViewMode[]).map((m, i) => <option key={m} value={m}>{i + 1} · {VIEW_NAMES[m]}</option>)}
        </select>
        <button className="btn" onClick={() => fitView(st)} title="Zoom vừa (F)">⤢</button>
        <button className="btn" onClick={() => { st.view = { ...st.view, s: Math.max(0.15, st.view.s / 1.25) }; st.emit(); }}>−</button>
        <span className="status hide-md">{Math.round(st.view.s * 100)}%</span>
        <button className="btn" onClick={() => { st.view = { ...st.view, s: Math.min(10, st.view.s * 1.25) }; st.emit(); }}>+</button>
        <button className={"btn" + (ui.snap ? " on" : "")} onClick={() => st.setUI({ snap: !ui.snap })} title="Smart snap">Snap</button>
        <button className={"btn" + (ui.layers.grid ? " on" : "")} onClick={() => st.toggleLayer("grid")} title="Lưới">Lưới</button>
        <input className="hide-md" type="number" value={ui.gridSize} min={20} max={400} step={10} style={{ width: 58 }} onChange={(e) => st.setUI({ gridSize: Math.max(20, +e.target.value || 100) })} title="Cỡ ô lưới / bước snap (u)" />
        <div className="spacer" />
        <button className="btn" onClick={() => { st.setUI({ paletteOpen: true }); setPalQ(""); setPalI(0); }} title="Command palette / tìm kiếm (Ctrl+K)">🔍 Tìm / lệnh <span className="kbd">Ctrl+K</span></button>
        <button className={"btn" + (ui.ragnarok ? " on" : "")} onClick={() => st.setUI({ ragnarok: !ui.ragnarok })} title="Overlay Ragnarok 72h">Ragnarok</button>
        <button className={"btn" + (ui.detailOpen ? " on" : "")} data-testid="open-detail" onClick={() => st.setUI({ detailOpen: ui.detailOpen ? null : "po_greywater" })} title="Lớp chi tiết POI — pilot Greywater Hamlet">🏘 Chi tiết POI</button>
        <button className="btn" onClick={() => st.setUI({ viewOnly: true })} title="Chế độ chỉ xem (Tab)">👁 Chỉ xem</button>
        <span className="status hide-sm">{st.lastSaved ? "Tự lưu " + st.lastSaved : "Chưa tự lưu"}</span>
      </header>

      <nav className="tools">
        {TOOLS.map((t) => (
          <div key={t.id} style={{ display: "contents" }}>
            {t.div && <div className="div" />}
            <button className={"tb" + (ui.tool === t.id ? " on" : "")} data-tip={`${t.name} [${t.key}]`} data-tool={t.id} aria-label={t.name} onClick={() => { it().cancelDraft(); st.setUI({ tool: t.id }); }}>
              <svg viewBox="0 0 24 24"><path d={ICONS[t.id]} /></svg><span className="k">{t.key}</span>
            </button>
          </div>
        ))}
      </nav>

      <main className="stage">
        <canvas ref={cvRef} className="main" data-testid="map-canvas" />
        {["land_add", "land_sub", "elev", "biome", "road", "river", "bridge", "resource", "label", "elder"].includes(ui.tool) && <div className="optbar">
          <b style={{ color: "#fff" }}>{tool.name}</b>
          {["land_add", "land_sub", "elev", "biome"].includes(ui.tool) && <>
            <label>Cỡ <input type="range" min={8} max={160} value={ui.brush.size} onChange={(e) => { ui.brush.size = +e.target.value; st.emit(); }} /> {ui.brush.size}u</label>
            {ui.tool === "elev" && <><label>Chế độ <select value={ui.brush.elevMode} onChange={(e) => { ui.brush.elevMode = e.target.value as any; st.emit(); }}><option value="raise">Nâng</option><option value="lower">Hạ</option><option value="smooth">Làm mượt</option><option value="flat">San phẳng</option></select></label><label>Lực <input type="range" min={0.1} max={1} step={0.05} value={ui.brush.strength} onChange={(e) => { ui.brush.strength = +e.target.value; st.emit(); }} /></label></>}
            {ui.tool === "biome" && <label>Biome <select value={ui.brush.biome} onChange={(e) => { ui.brush.biome = +e.target.value; st.emit(); }}>{BIOMES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><span className="sw" style={{ background: `rgb(${BIOMES[ui.brush.biome].color.join(",")})` }} /></label>}
          </>}
          {ui.tool === "road" && <label>Loại <select value={ui.opts.roadKind} onChange={(e) => { ui.opts.roadKind = e.target.value as any; st.emit(); }}><option value="cart">Đường xe hàng</option><option value="foot">Đường người đi</option><option value="trail">Đường rừng / mòn</option><option value="riverside">Đường ven sông</option><option value="ferry">Tuyến thuyền / phà</option></select></label>}
          {ui.tool === "river" && <label>Loại <select value={ui.opts.riverKind} onChange={(e) => { ui.opts.riverKind = e.target.value as any; st.emit(); }}><option value="river">Sông / phụ lưu</option><option value="distributary">Phân lưu</option></select></label>}
          {ui.tool === "bridge" && <label>Tải <select value={ui.opts.bridgeLoad} onChange={(e) => { ui.opts.bridgeLoad = e.target.value as any; st.emit(); }}><option value="foot">Người đi</option><option value="cart">Xe hàng</option></select></label>}
          {ui.tool === "resource" && <label>Loại <select value={ui.opts.resKind} onChange={(e) => { ui.opts.resKind = e.target.value; st.emit(); }}>{RES_KINDS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
          {ui.tool === "label" && <label>Kiểu <select value={ui.opts.labelStyle} onChange={(e) => { ui.opts.labelStyle = e.target.value as any; st.emit(); }}><option value="place">Địa danh</option><option value="region">Vùng</option><option value="water">Mặt nước</option></select></label>}
          {ui.tool === "elder" && <><label>Elder <select value={ui.opts.elderId} onChange={(e) => { ui.opts.elderId = e.target.value; st.emit(); }}>{ELDERS.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.stone}</option>)}</select></label><label>Phần <select value={ui.opts.elderPart} onChange={(e) => { ui.opts.elderPart = e.target.value as any; st.emit(); }}><option value="outer">Vùng ngoại vi</option><option value="core">Lãnh thổ lõi</option><option value="arena">Khu chiến đấu</option><option value="approach">Điểm tiếp cận</option></select></label></>}
        </div>}
        <div className="hintbar"><b>{tool.name}</b> — {tool.hint}</div>
        {ui.tool === "poi" && <div className="poilib" onPointerDown={(e) => e.stopPropagation()}>
          <div className="muted" style={{ padding: "2px 6px 6px" }}>Thư viện archetype — click để chọn, kéo-thả vào bản đồ</div>
          {ARCHES.map((a) => <div key={a.id} className={"it" + (ui.opts.arche === a.id ? " on" : "")} draggable data-arche={a.id} onDragStart={(e) => e.dataTransfer.setData("application/x-soh-arche", a.id)} onClick={() => { ui.opts.arche = a.id; st.emit(); }}><span className="dot" style={{ background: a.color }}>{a.code}</span><span>{a.name}</span></div>)}
        </div>}
        <button className="btn sm minitoggle" style={{ left: mini ? 176 : 10 }} title="Thu gọn / mở minimap" onClick={() => setMini(!mini)}>{mini ? "✕" : "▣ Minimap"}</button>
        <canvas ref={miniRef} className="minimap" style={{ display: mini ? "block" : "none" }} width={200} height={140} onPointerDown={(e) => { const mv = (ev: PointerEvent) => { const r = (e.target as HTMLElement).getBoundingClientRect(); const wx = ((ev.clientX - r.left) / r.width) * st.project.world.w, wy = ((ev.clientY - r.top) / r.height) * st.project.world.h; st.view = { ...st.view, x: wx - st.canvasSize.w / 2 / st.view.s, y: wy - st.canvasSize.h / 2 / st.view.s }; st.emit(); }; mv(e.nativeEvent); const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); }} />
        <div className="coords">x {cur[0].toFixed(0)} · y {cur[1].toFixed(0)}</div>
        {ui.viewOnly && <button className="btn vo-exit" onClick={() => st.setUI({ viewOnly: false })}>Thoát chế độ xem (Tab)</button>}
        {ui.toast && <div className="toast">{ui.toast}</div>}
        {busy && <div className="toast" style={{ bottom: "50%" }}>⏳ {busy}</div>}
      </main>

      <aside className="side">
        <div className="tabs">
          {([["inspect", "Inspector"], ["layers", "Layers"], ["smart", "Smart"], ["snap", "Snapshots"]] as const).map(([k, l]) => <button key={k} className={ui.panel === k ? "on" : ""} onClick={() => st.setUI({ panel: k })}>{l}</button>)}
        </div>
        <div className="pane">
          {ui.panel === "inspect" && <Inspector st={st} it={it} />}
          {ui.panel === "layers" && <LayersPanel st={st} />}
          {ui.panel === "smart" && <SmartPanel st={st} it={it} />}
          {ui.panel === "snap" && <SnapshotsPanel st={st} />}
        </div>
      </aside>
      <footer className="bottom"><ValidationBar st={st} /></footer>

      {ctx && <div className="ctx" style={{ left: Math.min(ctx.x, window.innerWidth - 230), top: Math.min(ctx.y, window.innerHeight - 330) }} onPointerDown={(e) => e.stopPropagation()}>
        {ctxObj ? <>
          <button onClick={() => { st.removeIds([...st.sel]); setCtx(null); }}>🗑 Xóa</button>
          <button onClick={() => { st.duplicate([...st.sel]); setCtx(null); }}>⧉ Nhân bản</button>
          <button onClick={() => { st.group([...st.sel]); setCtx(null); }}>⛓ Nhóm</button>
          <button onClick={() => { st.ungroup([...st.sel]); setCtx(null); }}>⛓‍💥 Bỏ nhóm</button>
          <button onClick={() => { for (const o of sel) st.setProps(o.id, { locked: !o.locked }, "Khóa/mở"); setCtx(null); }}>🔒 Khóa / mở khóa</button>
          <button onClick={() => { for (const o of sel) st.setProps(o.id, { hidden: !o.hidden }, "Ẩn/hiện"); setCtx(null); }}>🙈 Ẩn</button>
          <hr />
          <button onClick={() => { zoomTo(st, sel.flatMap((o) => objectAnchor(o as any)), 120); setCtx(null); }}>🔎 Zoom tới</button>
          <button onClick={() => { st.proposals = proposeSmooth(st); st.setUI({ panel: "smart" }); setCtx(null); }}>〰 Làm mượt (xem trước)</button>
          {(ctxObj.points || ctxObj.ring || ctxObj.rings) && <button onClick={() => { const o = ctxObj, w = ctx.w; const key = o.points ? "points" : o.ring ? "ring" : "rings"; const arr: any = key === "rings" ? o.rings[0] : o[key]; let bi = 0, bd = 1e9; arr.forEach((q: any, i: number) => { const d = Math.hypot(q[0] - w[0], q[1] - w[1]); if (d < bd) { bd = d; bi = i; } }); it().removeVertex(o.id, key, key === "rings" ? 0 : undefined, bi); setCtx(null); }}>✂ Xóa đỉnh gần nhất</button>}
        </> : <>
          <button onClick={() => { const q = ctx.w; st.addObject("pois", { arche: ui.opts.arche, at: q }, "Đặt POI"); setCtx(null); }}>📍 Đặt POI «{ARCHES.find((a) => a.id === ui.opts.arche)?.name}» tại đây</button>
          <button onClick={() => { st.addObject("spawns", { at: ctx.w }); setCtx(null); }}>🚩 Đặt spawn tại đây</button>
          <button onClick={() => { const q = ctx.w; const r = houseTest(st.project, it().getFields(), q); st.setUI({ testResult: { at: q, lines: r.lines }, panel: "inspect" }); setCtx(null); }}>🏠 Thử nhà tại đây</button>
          <button onClick={() => { st.paste(); setCtx(null); }}>📋 Dán</button>
          <button onClick={() => { fitView(st); setCtx(null); }}>⤢ Zoom vừa bản đồ</button>
        </>}
      </div>}

      {ui.paletteOpen && <div className="modal-bg" onPointerDown={() => st.setUI({ paletteOpen: false })}>
        <div className="modal pal" onPointerDown={(e) => e.stopPropagation()}>
          <input autoFocus type="text" placeholder="Tìm công cụ, lệnh, hoặc đối tượng (POI, sông, đảo…)" value={palQ} onChange={(e) => { setPalQ(e.target.value); setPalI(0); }} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setPalI((i) => Math.min(i + 1, palRes.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setPalI((i) => Math.max(0, i - 1)); } else if (e.key === "Enter") { const c = palRes[palI]; st.setUI({ paletteOpen: false }); c?.run(); } else if (e.key === "Escape") st.setUI({ paletteOpen: false }); }} />
          <div className="res">{palRes.map((c, i) => <div key={i} className={i === palI ? "on" : ""} onClick={() => { st.setUI({ paletteOpen: false }); c.run(); }}>{c.name}</div>)}</div>
        </div>
      </div>}

      {help && <div className="modal-bg" onPointerDown={() => { setHelp(false); try { localStorage.setItem("soh-maplab-seen", "1"); } catch { /* */ } }}>
        <div className="modal" onPointerDown={(e) => e.stopPropagation()}>
          <h2>Soul of Hero — Map Lab Studio</h2>
          <p className="muted">Công cụ thiết kế thế giới trên giấy số. Bản đồ nạp sẵn là <b>ĐỀ XUẤT của agent</b> (chưa phải canon): mọi thành phần — đảo, sông, đường, POI, vùng xây, Elder — đều sửa được bằng chuột. Tự lưu cục bộ; dùng <b>Dự án ▸ Lưu</b> để lấy file; <b>Xuất ▸ Export for Map Tower</b> để gửi ZIP.</p>
          <h3>Thao tác chính</h3>
          <p><kbd>V</kbd> chọn/di chuyển · <kbd>Space</kbd>+kéo hoặc <kbd>H</kbd> = kéo bản đồ · lăn chuột = zoom · <kbd>F</kbd> zoom vừa · <kbd>Tab</kbd> chỉ xem · <kbd>Ctrl+K</kbd> tìm/lệnh · <kbd>1–7</kbd> chế độ xem</p>
          <p><kbd>B</kbd>/<kbd>N</kbd> brush thêm/xóa đất · <kbd>E</kbd> độ cao · <kbd>G</kbd> biome · <kbd>R</kbd> sông · <kbd>C</kbd> kênh · <kbd>L</kbd> hồ · <kbd>D</kbd> đường · <kbd>J</kbd> cầu · <kbd>K</kbd> bến · <kbd>O</kbd> POI · <kbd>Z</kbd> vùng xây · <kbd>T</kbd> Elder · <kbd>S</kbd> nguồn · <kbd>W</kbd> spawn · <kbd>Y</kbd> thử nhà · <kbd>M</kbd> đo · <kbd>Q</kbd> chọn vùng</p>
          <p><kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> undo/redo · <kbd>Ctrl+D</kbd> nhân bản · <kbd>Ctrl+G</kbd> nhóm (+Shift bỏ nhóm) · <kbd>Delete</kbd> xóa · <kbd>[</kbd> <kbd>]</kbd> cỡ brush · <kbd>Esc</kbd> hủy · <kbd>Enter</kbd>/double-click kết thúc nét vẽ · Alt+click đỉnh = xóa đỉnh · double-click cạnh = thêm đỉnh · chuột phải = menu</p>
          <h3>Quy ước trung thực</h3>
          <p className="muted">PASS = dữ liệu thiết kế chứng minh được · WARNING = cần xem · UNKNOWN = Bible chưa chốt/thiếu dữ liệu · FAIL = mâu thuẫn hình học/luật đã chốt. Loại thuyền, giá rương, habitat quái… <b>không</b> được gán số. Thanh Smart tools chỉ <b>đề xuất có xem trước</b>, không tự sửa.</p>
          <p className="muted">Bản offline cho Windows: tải <a style={{ color: "#6cc4ff" }} href="/downloads/SoulOfHero_MapLab_Studio.zip">SoulOfHero_MapLab_Studio.zip</a>, giải nén, bấm đúp <b>Open_MapLab.bat</b> (hoặc mở <b>SoulOfHero_MapLab.html</b>) — không cần cài đặt, chạy offline.</p>
          <div className="row"><button className="btn acc" onClick={() => { setHelp(false); try { localStorage.setItem("soh-maplab-seen", "1"); } catch { /* */ } }}>Bắt đầu chỉnh sửa</button></div>
        </div>
      </div>}
      {ui.detailOpen && st.detailSupported(ui.detailOpen) && (
        <DetailStudio st={st} poiId={ui.detailOpen} onClose={() => st.setUI({ detailOpen: null })} />
      )}

    </div>
  );
}
