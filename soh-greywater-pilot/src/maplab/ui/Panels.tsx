/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { houseTest } from "../analysis";
import { centroid, polyArea } from "../geom";
import type { Interaction } from "../interact";
import { objectAnchor, zoomTo } from "../interact";
import { LAYERS } from "../render";
import type { LayerId } from "../render";
import { autoLink } from "../store";
import { reattach } from "../graph";
import type { AnyObj, Store } from "../store";
import { CLUSTERS, blockTest, proposeCluster, proposeDocks, proposePois, proposeRegen, proposeRoads, proposeSmooth, reachOverlay } from "../smart";
import { summarize } from "../validate";
import { ARCHES, ARCHE_BY_ID, BIOMES, CONF_LABEL, COLL_NAME, COLLS, ELDERS, RES_KINDS, allObjects, collOf } from "../types";
import type { CollKey, Conf, Pt } from "../types";

function TextIn({ value, onCommit, type = "text", ...rest }: { value: string | number; onCommit: (v: string) => void; type?: string; [k: string]: any }) {
  const [v, setV] = useState(String(value ?? ""));
  useEffect(() => setV(String(value ?? "")), [value]);
  return <input type={type} value={v} {...rest} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== String(value ?? "")) onCommit(v); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); e.stopPropagation(); }} />;
}
const Fld = ({ label, children }: { label: string; children: any }) => <label className="fld"><span>{label}</span><div>{children}</div></label>;

type FD = { k: string; label: string; t: "text" | "num" | "select" | "bool" | "area" | "csv"; o?: [string, string][]; step?: number };
const kinds = (a: string[]): [string, string][] => a.map((x) => [x, x]);
const FIELDS: Record<CollKey, FD[]> = {
  land: [{ k: "kind", label: "Loại", t: "select", o: [["main", "Đảo chính"], ["satellite", "Đảo vệ tinh"], ["islet", "Đảo nhỏ"]] }],
  lakes: [{ k: "oasis", label: "Ốc đảo", t: "bool" }],
  rivers: [{ k: "kind", label: "Loại", t: "select", o: [["river", "Sông"], ["canal", "Kênh đào"], ["distributary", "Phân lưu"]] }, { k: "width", label: "Độ rộng (u)", t: "num", step: 0.5 }, { k: "fordable", label: "Lội được", t: "bool" }, { k: "reason", label: "Lý do / công trình", t: "area" }],
  roads: [{ k: "kind", label: "Loại", t: "select", o: [["cart", "Xe hàng"], ["foot", "Người đi"], ["trail", "Đường rừng"], ["riverside", "Ven sông"], ["ferry", "Phà/thuyền"]] }, { k: "alt", label: "Tuyến thay thế", t: "bool" }, { k: "ford", label: "Có điểm lội", t: "bool" }, { k: "purpose", label: "Mục đích", t: "area" }],
  bridges: [{ k: "load", label: "Tải", t: "select", o: [["foot", "Người đi"], ["cart", "Xe hàng"]] }],
  docks: [{ k: "kind", label: "Loại", t: "select", o: [["inland", "Nội địa"], ["coastal", "Ven biển"]] }],
  pois: [{ k: "arche", label: "Archetype", t: "select", o: ARCHES.map((a) => [a.id, a.name]) }, { k: "depth", label: "Độ sâu", t: "select", o: [["surface", "Chỉ ngoại vi"], ["multi", "Nhiều tầng"]] }, { k: "gate", label: "Điều kiện sâu", t: "select", o: [["none", "Không"], ["key", "Thẻ/khóa"], ["power", "Điện"], ["hazard", "Bảo hộ/hazard"], ["elder", "Elder"]] }, { k: "scale", label: "Scale", t: "num", step: 0.1 }, { k: "rotDeg", label: "Xoay (°)", t: "num", step: 5 }, { k: "role", label: "Vai trò đời sống", t: "area" }, { k: "opp", label: "Cơ hội gameplay", t: "area" }, { k: "access", label: "Điều kiện/tuyến tiếp cận", t: "area" }],
  zones: [{ k: "soil", label: "Đất", t: "text" }, { k: "water", label: "Nước", t: "text" }, { k: "slope", label: "Độ dốc", t: "text" }, { k: "tags", label: "Tag (csv)", t: "csv" }],
  resources: [{ k: "kind", label: "Loại", t: "select", o: RES_KINDS.map((r) => [r.id, r.name]) }, { k: "r", label: "Bán kính (u)", t: "num", step: 2 }, { k: "dens", label: "Mật độ 1–3", t: "num", step: 1 }, { k: "gate", label: "Điều kiện", t: "select", o: [["none", "Không (mặc định)"], ["core", "Cần Core ⚠"], ["key", "Cần khóa"], ["elder", "Cần Elder ⚠"]] }],
  spawns: [{ k: "region", label: "Vùng", t: "text" }],
  elders: [{ k: "ragnarok", label: "Ragnarok 72h", t: "area" }],
  labels: [{ k: "text", label: "Chữ", t: "text" }, { k: "size", label: "Cỡ", t: "num", step: 1 }, { k: "style", label: "Kiểu", t: "select", o: [["place", "Địa danh"], ["region", "Vùng"], ["water", "Mặt nước"]] }],
};

function ProjectInfo({ st }: { st: Store }) {
  const p = st.project, tr = st.ui.testResult;
  return <div>
    <h4>Dự án</h4>
    <Fld label="Tên"><TextIn value={p.name} onCommit={(v) => st.commit("Đổi tên dự án", (q) => { q.name = v; })} /></Fld>
    <Fld label="Trạng thái"><TextIn value={p.meta.status} onCommit={(v) => st.commit("Trạng thái", (q) => { q.meta.status = v; })} /></Fld>
    <div className="card info muted">Kích thước thế giới {p.world.w}×{p.world.h}u — <b>tỉ lệ thực chưa được chốt</b> (Bible §11.5). {p.land.length} khối đất · {p.rivers.length} sông/kênh · {p.roads.length} tuyến · {p.pois.length} POI · {p.zones.length} vùng xây · {p.resources.length} nguồn.</div>
    <h4>Ghi chú gửi Map Tower</h4>
    <textarea defaultValue={(p.meta as any).notes || ""} placeholder="Ghi chú thiết kế, câu hỏi, giả định…" onBlur={(e) => { (p.meta as any).notes = e.target.value; st.touch(); }} />
    <h4>Kết quả Thử nhà {tr ? "" : "(công cụ Y)"}</h4>
    {tr ? <TestCard lines={tr.lines} /> : <div className="muted">Chọn công cụ «Thử nhà» rồi click bất kỳ điểm nào trên bản đồ.</div>}
    <h4>Mẹo</h4>
    <div className="muted">Chọn một đối tượng để sửa thuộc tính. Chuột phải = menu. Ctrl+K = tìm mọi thứ.</div>
  </div>;
}
function TestCard({ lines }: { lines: { tone: string; text: string }[] }) {
  return <div>{lines.map((l, i) => <div key={i} className={"card " + l.tone} style={{ margin: "3px 0", padding: "4px 8px" }}>{l.text}</div>)}</div>;
}

export function Inspector({ st, it }: { st: Store; it: () => Interaction }) {
  const sel = st.selected();
  if (!sel.length) return <ProjectInfo st={st} />;
  if (sel.length > 1) {
    const by: Record<string, number> = {};
    sel.forEach((o) => { const c = collOf(o.id)!; by[c] = (by[c] || 0) + 1; });
    return <div>
      <h4>Đã chọn {sel.length} đối tượng</h4>
      <div className="muted">{Object.entries(by).map(([k, v]) => `${COLL_NAME[k as CollKey]}: ${v}`).join(" · ")}</div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => st.duplicate([...st.sel])}>Nhân bản</button><button className="btn" onClick={() => st.group([...st.sel])}>Nhóm</button><button className="btn" onClick={() => st.ungroup([...st.sel])}>Bỏ nhóm</button>
        <button className="btn" onClick={() => sel.forEach((o) => st.setProps(o.id, { locked: !o.locked }))}>Khóa/mở</button><button className="btn" onClick={() => sel.forEach((o) => st.setProps(o.id, { hidden: true }))}>Ẩn</button><button className="btn" onClick={() => st.removeIds([...st.sel])}>Xóa</button>
      </div>
      <Fld label="Độ chắc chắn"><select value="" onChange={(e) => { const v = e.target.value as Conf; if (v) st.commit("Đặt mức chắc chắn", (p) => { for (const o of allObjects(p)) if (st.sel.has(o.obj.id)) o.obj.conf = v; }); }}><option value="">— đặt cho tất cả —</option>{(Object.keys(CONF_LABEL) as Conf[]).map((c) => <option key={c} value={c}>{CONF_LABEL[c]}</option>)}</select></Fld>
      <div className="list" style={{ marginTop: 8 }}>{sel.slice(0, 60).map((o) => <div key={o.id} className="li" onClick={() => st.select([o.id])}>{o.name}<span className="muted">{COLL_NAME[collOf(o.id)!]}</span></div>)}</div>
    </div>;
  }
  const o = sel[0] as AnyObj, coll = collOf(o.id)!, p = st.project;
  const set = (patch: Record<string, any>, label?: string) => st.setProps(o.id, patch, label);
  const val = (k: string) => (k === "rotDeg" ? Math.round(((o.rot || 0) * 180) / Math.PI) : k === "tags" ? (o.tags || []).join(", ") : o[k]);
  const onSet = (f: FD, v: any) => { if (f.k === "rotDeg") set({ rot: (+v * Math.PI) / 180 }); else if (f.k === "tags") set({ tags: String(v).split(",").map((s) => s.trim()).filter(Boolean) }); else if (f.t === "num") set({ [f.k]: +v }); else if (f.k === "arche") { const a = ARCHE_BY_ID[v]; set({ arche: v, depth: a.depth, gate: a.gate, role: a.role, opp: a.opp, access: a.access, resources: [...a.res] }, "Đổi archetype"); } else set({ [f.k]: v }); };
  const waterOpts: [string, string][] = [["sea", "Biển"], ...p.lakes.map((l) => [l.id, "Hồ: " + l.name] as [string, string]), ...p.rivers.map((r) => [r.id, "Sông: " + r.name] as [string, string])];
  const blocked = st.ui.blocked.has(o.id);
  const A = o.arche ? ARCHE_BY_ID[o.arche] : null;
  const area = o.ring ? Math.abs(polyArea(o.ring)) : o.rings ? Math.abs(polyArea(o.rings[0])) : 0;
  return <div>
    <div className="row"><b style={{ fontSize: 15 }}>{o.name}</b><span className="muted">{COLL_NAME[coll]} · {o.id}</span></div>
    <Fld label="Tên"><TextIn value={o.name} onCommit={(v) => set({ name: v }, "Đổi tên")} /></Fld>
    {FIELDS[coll].map((f) => <Fld key={f.k} label={f.label}>
      {f.t === "select" ? <select value={val(f.k) ?? ""} onChange={(e) => onSet(f, e.target.value)}>{(f.o || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        : f.t === "bool" ? <input type="checkbox" checked={!!o[f.k]} onChange={(e) => set({ [f.k]: e.target.checked })} />
          : f.t === "area" ? <textarea defaultValue={val(f.k) ?? ""} key={o.id + f.k} onBlur={(e) => { if (e.target.value !== (o[f.k] ?? "")) onSet(f, e.target.value); }} onKeyDown={(e) => e.stopPropagation()} />
            : <TextIn value={val(f.k) ?? ""} type={f.t === "num" ? "number" : "text"} step={f.step} onCommit={(v) => onSet(f, v)} />}
    </Fld>)}
    {coll === "docks" && <Fld label="Mặt nước"><select value={o.water} onChange={(e) => set({ water: e.target.value })}>{[["", "(chưa gắn)"] as [string, string], ...waterOpts].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Fld>}
    <Fld label="Độ chắc chắn"><select value={o.conf || "proposal"} onChange={(e) => set({ conf: e.target.value })}>{(Object.keys(CONF_LABEL) as Conf[]).map((c) => <option key={c} value={c}>{CONF_LABEL[c]}</option>)}</select></Fld>
    <Fld label="Ghi chú"><textarea defaultValue={o.notes || ""} key={o.id + "n"} onBlur={(e) => { if (e.target.value !== (o.notes || "")) set({ notes: e.target.value }, "Ghi chú"); }} onKeyDown={(e) => e.stopPropagation()} /></Fld>
    <div className="row">
      <label><input type="checkbox" checked={!!o.locked} onChange={(e) => set({ locked: e.target.checked }, "Khóa")} /> Khóa</label>
      <label><input type="checkbox" checked={!!o.hidden} onChange={(e) => set({ hidden: e.target.checked }, "Ẩn")} /> Ẩn</label>
      {o.group && <span className="chip UNKNOWN">nhóm</span>}
      <button className="btn sm" onClick={() => zoomTo(st, objectAnchor(o), 120)}>Zoom tới</button>
      <button className="btn sm" onClick={() => st.duplicate([o.id])}>Nhân bản</button>
      <button className="btn sm" onClick={() => st.removeIds([o.id])}>Xóa</button>
    </div>
    {coll === "land" && <div className="muted">Diện tích ≈ {(area / 1000).toFixed(1)}k u² · {o.rings[0].length} đỉnh · {o.rings.length - 1} hồ/lỗ biển. Dùng brush B/N hoặc kéo đỉnh để đổi hình đảo.</div>}
    {coll === "rivers" && <RiverBlock st={st} o={o} />}
    {coll === "roads" && o.kind !== "ferry" && <div><h4>Giao cắt sông</h4>{(() => { const cr = it().crossings(o.id); return <div className="row"><span className="muted">{cr.length} giao cắt, {cr.filter((c) => !c.has).length} chưa có cầu/lội.</span><button className="btn sm" onClick={() => it().autoBridges(o.id)}>Đặt cầu tự động</button></div>; })()}</div>}
    {(coll === "bridges" || coll === "docks" || coll === "roads" || coll === "rivers") && <div className="row"><button className={"btn sm" + (blocked ? " on" : "")} onClick={() => { const b = new Set(st.ui.blocked); blocked ? b.delete(o.id) : b.add(o.id); st.ui.blocked = b; st.runChecks(true); st.setUI({ panel: "smart" }); }}>{blocked ? "Bỏ chặn (đang mô phỏng chặn)" : "Thử chặn để kiểm tra liên thông"}</button></div>}
    {coll === "pois" && A && <PoiBlock st={st} o={o} />}
    {coll === "zones" && <div><h4>Phân tích vùng</h4><div className="row"><button className="btn sm" onClick={() => { const c = centroid(o.ring); const r = houseTest(p, it().getFields(), c); st.setUI({ testResult: { at: c, lines: r.lines } }); }}>Thử nhà tại tâm vùng</button></div>{st.ui.testResult && <TestCard lines={st.ui.testResult.lines} />}</div>}
    {coll === "elders" && <ElderBlock st={st} o={o} />}
  </div>;
}

function RiverBlock({ st, o }: { st: Store; o: AnyObj }) {
  const p = st.project;
  const refs = (k: string): [string, string][] => k === "lake" ? p.lakes.map((l) => [l.id, l.name]) : k === "river" ? p.rivers.filter((r) => r.id !== o.id).map((r) => [r.id, r.name]) : [];
  const setLink = (which: "mouth" | "source", kind: string, ref?: string) => st.commit("Nối thủy hệ", (q) => { const r = q.rivers.find((x) => x.id === o.id)!; (r as any)[which] = ref ? { kind, ref } : { kind }; reattach(q); });
  return <div>
    <h4>Nối thủy hệ (đồ thị)</h4>
    <Fld label="Cửa sông"><div className="row" style={{ margin: 0 }}><select value={o.mouth.kind} onChange={(e) => setLink("mouth", e.target.value, refs(e.target.value)[0]?.[0])}><option value="sea">Biển</option><option value="lake">Hồ</option><option value="river">Sông khác</option><option value="none">Không (cụt)</option></select>{refs(o.mouth.kind).length > 0 && <select value={o.mouth.ref || ""} onChange={(e) => setLink("mouth", o.mouth.kind, e.target.value)}>{refs(o.mouth.kind).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</div></Fld>
    <Fld label="Nguồn"><div className="row" style={{ margin: 0 }}><select value={o.source.kind} onChange={(e) => setLink("source", e.target.value, refs(e.target.value)[0]?.[0])}><option value="spring">Suối nguồn</option><option value="lake">Hồ</option><option value="river">Sông khác (phân lưu)</option></select>{refs(o.source.kind).length > 0 && <select value={o.source.ref || ""} onChange={(e) => setLink("source", o.source.kind, e.target.value)}>{refs(o.source.kind).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</div></Fld>
    <div className="muted">Đầu sông tự bắt vào đích khai báo; khi đích di chuyển, đầu sông bám theo (đồ thị luôn khớp hình học).</div>
    <div className="row"><button className="btn sm" onClick={() => st.commit("Đảo chiều dòng chảy", (q) => { const r = q.rivers.find((x) => x.id === o.id)!; r.points.reverse(); r.nav.reverse(); autoLink(q, r); })}>⇄ Đảo hướng chảy</button></div>
    <h4>Khả năng đi thuyền theo đoạn <span className="muted">(loại thuyền: giả định)</span></h4>
    <div className="row">{o.nav.map((v: number, i: number) => <label key={i} title={`Đoạn ${i + 1}`} onMouseEnter={() => { st.ui.hoverSeg = i; st.emit(); }} onMouseLeave={() => { st.ui.hoverSeg = -1; st.emit(); }} style={{ display: "flex", gap: 2, alignItems: "center", fontSize: 11 }}><input type="checkbox" checked={v === 1} onChange={(e) => { const nav = o.nav.slice(); nav[i] = e.target.checked ? 1 : 0; st.setProps(o.id, { nav }, "Navigable đoạn"); }} />{i + 1}</label>)}</div>
    <div className="row"><button className="btn sm" onClick={() => st.setProps(o.id, { nav: o.nav.map(() => 1) })}>Tất cả đi được</button><button className="btn sm" onClick={() => st.setProps(o.id, { nav: o.nav.map(() => 0) })}>Không đoạn nào</button></div>
    <h4>Thác / ghềnh / đập / âu</h4>
    {o.feats.map((f: any, i: number) => <div key={i} className="row"><span className="chip UNKNOWN">{f.kind}</span><span className="muted">({f.at[0].toFixed(0)}, {f.at[1].toFixed(0)})</span><button className="btn sm" onClick={() => st.setProps(o.id, { feats: o.feats.filter((_: any, j: number) => j !== i) }, "Xóa đặc điểm")}>×</button></div>)}
    <FeatAdd o={o} st={st} />
  </div>;
}
function FeatAdd({ o, st }: { o: AnyObj; st: Store }) {
  const [k, setK] = useState("waterfall"), [i, setI] = useState(0);
  return <div className="row"><select value={k} onChange={(e) => setK(e.target.value)}><option value="waterfall">Thác</option><option value="rapids">Ghềnh</option><option value="weir">Đập</option><option value="lock">Âu thuyền</option></select><select value={i} onChange={(e) => setI(+e.target.value)}>{o.points.map((_: any, j: number) => <option key={j} value={j}>tại điểm {j + 1}</option>)}</select><button className="btn sm" onClick={() => st.setProps(o.id, { feats: [...o.feats, { kind: k, at: [...o.points[i]] }] }, "Thêm đặc điểm")}>Thêm</button></div>;
}
function PoiBlock({ st, o }: { st: Store; o: AnyObj }) {
  const p = st.project, A = ARCHE_BY_ID[o.arche], R = A.r * o.scale;
  const [tgt, setTgt] = useState(""), [kind, setKind] = useState("cấp nguyên liệu");
  const rect = (w: number, h: number, dx = 0, dy = 0): Pt[] => [[-w, -h], [w, -h], [w, h], [-w, h]].map(([u, v]) => [o.at[0] + dx + u, o.at[1] + dy + v] as Pt);
  return <div>
    <h4>Footprint · ngoại vi · khu sâu · lối rút</h4>
    <div className="muted">Kéo ô vuông trắng trên bản đồ để chỉnh footprint (nâu) và khu sâu (đỏ); double-click cạnh để thêm đỉnh.</div>
    <div className="row">
      <button className="btn sm" onClick={() => st.setProps(o.id, { foot: rect(R * 0.8, R * 0.55) }, "Reset footprint")}>Reset footprint</button>
      <button className="btn sm" onClick={() => st.setProps(o.id, { deep: rect(R * 0.45, R * 0.3, R * 0.15, R * 0.1), depth: "multi" }, "Tạo khu sâu")}>Tạo khu sâu</button>
      <button className="btn sm" onClick={() => st.setProps(o.id, { deep: undefined, depth: "surface" }, "Bỏ khu sâu")}>Bỏ khu sâu</button>
      <button className="btn sm" onClick={() => st.setProps(o.id, { retreat: [...o.retreat, [o.at[0] + (Math.random() - 0.5) * R * 4, o.at[1] + R * 2]] }, "Thêm lối rút")}>+ Lối rút ({o.retreat.length})</button>
    </div>
    <h4>Tài nguyên & điều kiện</h4>
    <div className="row">{RES_KINDS.map((r) => <label key={r.id} style={{ fontSize: 11 }}><input type="checkbox" checked={o.resources.includes(r.id)} onChange={(e) => st.setProps(o.id, { resources: e.target.checked ? [...o.resources, r.id] : o.resources.filter((x: string) => x !== r.id) }, "Tài nguyên POI")} /> {r.name}</label>)}</div>
    <Fld label="Gắn Elder"><select value={o.elder || ""} onChange={(e) => st.setProps(o.id, { elder: e.target.value || undefined })}><option value="">— không —</option>{ELDERS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Fld>
    <h4>Quan hệ POI ↔ nguồn / tuyến / POI</h4>
    {o.links.map((l: any, i: number) => <div key={i} className="row"><span className="chip UNKNOWN">{l.kind}</span><span>{allObjects(p).find((x) => x.obj.id === l.to)?.obj.name || l.to}</span><button className="btn sm" onClick={() => st.setProps(o.id, { links: o.links.filter((_: any, j: number) => j !== i) }, "Xóa quan hệ")}>×</button></div>)}
    <div className="row"><select value={tgt} onChange={(e) => setTgt(e.target.value)} style={{ maxWidth: 150 }}><option value="">— đích —</option>{[...p.pois, ...p.docks, ...p.rivers, ...p.roads, ...p.resources.slice(0, 0)].filter((x) => x.id !== o.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><TextIn value={kind} onCommit={setKind} style={{ width: 120 }} /><button className="btn sm" disabled={!tgt} onClick={() => st.setProps(o.id, { links: [...o.links, { to: tgt, kind }] }, "Thêm quan hệ")}>Nối</button></div>
  </div>;
}
function ElderBlock({ st, o }: { st: Store; o: AnyObj }) {
  const p = st.project;
  const draw = (part: string) => { st.ui.opts.elderId = o.elder; st.ui.opts.elderPart = part as any; st.setUI({ tool: "elder" }); };
  const [sel, setSel] = useState("");
  return <div>
    <h4>Vẽ các phần của lãnh thổ</h4>
    <div className="row"><button className="btn sm" onClick={() => draw("outer")}>Vẽ ngoại vi ({o.outer.length})</button><button className="btn sm" onClick={() => draw("core")}>Vẽ lõi ({o.core.length})</button><button className="btn sm" onClick={() => draw("arena")}>+ Khu chiến đấu ({o.arenas.length})</button><button className="btn sm" onClick={() => draw("approach")}>+ Điểm tiếp cận ({o.approach.length})</button></div>
    <div className="row"><button className="btn sm" onClick={() => st.setProps(o.id, { arenas: [], approach: [] }, "Xóa arena/approach")}>Xóa khu chiến đấu & tiếp cận</button><button className={"btn sm" + (st.ui.ragnarok ? " on" : "")} onClick={() => st.setUI({ ragnarok: !st.ui.ragnarok })}>Overlay Ragnarok</button></div>
    <h4>POI liên quan</h4>
    {o.pois.map((i: string) => <div key={i} className="row"><span>{p.pois.find((x) => x.id === i)?.name || i}</span><button className="btn sm" onClick={() => st.setProps(o.id, { pois: o.pois.filter((x: string) => x !== i) }, "Bỏ POI")}>×</button></div>)}
    <div className="row"><select value={sel} onChange={(e) => setSel(e.target.value)}><option value="">— chọn POI —</option>{p.pois.filter((x) => !o.pois.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="btn sm" disabled={!sel} onClick={() => { st.setProps(o.id, { pois: [...o.pois, sel] }, "Gắn POI"); setSel(""); }}>Gắn</button></div>
    <div className="muted">Bật overlay Ragnarok (nút trên) để xem làn hiểm họa; tuyến đường/giao thông trong lãnh thổ xem ở chế độ 6 (Sáu Elder).</div>
  </div>;
}

export function LayersPanel({ st }: { st: Store }) {
  const [q, setQ] = useState("");
  const L = st.ui.layers;
  const LOCKS: [CollKey, string][] = COLLS.map((c) => [c, COLL_NAME[c]]);
  const objs = allObjects(st.project).filter((o) => !q || o.obj.name.toLowerCase().includes(q.toLowerCase())).slice(0, 220);
  return <div>
    <h4>Hiển thị lớp</h4>
    {LAYERS.map(([k, name]) => <div key={k} className="layer"><button className={L[k as LayerId] ? "on" : ""} title="Bật/tắt" onClick={() => st.toggleLayer(k as LayerId)}>{L[k as LayerId] ? "👁" : "⌀"}</button><span>{name}</span></div>)}
    <div className="layer"><button className={st.ui.dim ? "on" : ""} onClick={() => st.setUI({ dim: !st.ui.dim })}>◐</button><span>Làm mờ nền địa hình</span></div>
    <h4>Khóa nhóm đối tượng</h4>
    <div className="row">{LOCKS.map(([c, n]) => <button key={c} className={"btn sm" + (st.ui.lockedColls.has(c) ? " on" : "")} onClick={() => { const s = new Set(st.ui.lockedColls); s.has(c) ? s.delete(c) : s.add(c); st.setUI({ lockedColls: s }); }}>{st.ui.lockedColls.has(c) ? "🔒" : "🔓"} {n}</button>)}</div>
    <h4>Danh sách đối tượng</h4>
    <input type="text" placeholder="Lọc theo tên…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%" }} onKeyDown={(e) => e.stopPropagation()} />
    <div className="list" style={{ marginTop: 6 }}>{objs.map((o) => <div key={o.obj.id} className={"li" + (st.sel.has(o.obj.id) ? " on" : "")} onClick={() => { st.select([o.obj.id]); zoomTo(st, objectAnchor(o.obj as any), 140); }}><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.obj.name}</span><span className="muted">{COLL_NAME[o.coll]}</span></div>)}</div>
  </div>;
}

export function SmartPanel({ st, it }: { st: Store; it: () => Interaction }) {
  const [arche, setArche] = useState("sawmill"), [cluster, setCluster] = useState("village"), [rk, setRk] = useState<"cart" | "foot" | "trail">("cart"), [rm, setRm] = useState<"foot" | "cart" | "water" | "all">("foot");
  const [reachInfo, setReachInfo] = useState(""), bt = blockTest(st);
  const heat = (k: "none" | "opp" | "poi" | "build") => { st.ui.heat = k; st.ui.layers = { ...st.ui.layers, heat: k !== "none" }; st.emit(); };
  const center: Pt = [st.view.x + st.canvasSize.w / 2 / st.view.s, st.view.y + st.canvasSize.h / 2 / st.view.s];
  const anchor = (): Pt | null => { const o = st.selected()[0]; if (o?.at) return o.at; return st.ui.testResult?.at || null; };
  return <div>
    <h4>Heatmap (tính từ dữ liệu bản đồ)</h4>
    <div className="row">{([["none", "Tắt"], ["opp", "Opportunity"], ["poi", "Mật độ POI"], ["build", "Build viability"]] as const).map(([k, l]) => <button key={k} className={"btn sm" + (st.ui.heat === k ? " on" : "")} onClick={() => heat(k)}>{l}</button>)}</div>
    <div className="muted">Opportunity = đa dạng nguồn cơ bản + POI + đường + nước trong bán kính (trọng số heuristic, không phải Bible). Màu: xanh dương/tím = thấp → vàng → xanh lá = cao (Mật độ POI: xanh → đỏ).</div>
    <h4>Tiếp cận (reachability)</h4>
    <div className="row"><select value={rm} onChange={(e) => setRm(e.target.value as any)}><option value="foot">Đường người</option><option value="cart">Xe hàng</option><option value="water">Thủy lộ + phà</option><option value="all">Liên phương thức</option></select>
      <button className="btn sm" onClick={() => { const a = anchor(); if (!a) { st.toast("Chọn một POI/bến/spawn hoặc dùng Thử nhà trước"); return; } const r = reachOverlay(st, a, rm); setReachInfo(r ? `${r.pois}/${r.total} POI tiếp cận được; ${r.nodes} nút mạng.` : "Không có mạng gần điểm này"); }}>Từ đối tượng chọn / điểm thử</button>
      <button className="btn sm" onClick={() => { st.reachOv = []; setReachInfo(""); st.emit(); }}>Xóa</button></div>
    {reachInfo && <div className="card info">{reachInfo}</div>}
    <h4>Thử chặn cầu / bến</h4>
    <div className="muted">Chọn cầu/bến/đường ở Inspector → «Thử chặn». Đang chặn: {st.ui.blocked.size}.</div>
    {bt && <div className={"card " + (bt.lost.length ? "bad" : "good")}>Chặn {st.ui.blocked.size} yếu tố: {bt.before} → {bt.after} POI còn liên thông từ một làng. {bt.lost.length ? "Mất: " + bt.lost.slice(0, 8).join(", ") : "Không POI nào bị cô lập (có tuyến thay thế)."}</div>}
    {st.ui.blocked.size > 0 && <button className="btn sm" onClick={() => { st.ui.blocked = new Set(); st.runChecks(true); st.emit(); }}>Bỏ mọi chặn</button>}
    <h4>Đề xuất thông minh (có xem trước — không tự sửa)</h4>
    <div className="row"><button className="btn sm" onClick={() => { st.proposals = proposeSmooth(st); st.emit(); }}>Làm mượt đối tượng chọn</button>
      <select value={rk} onChange={(e) => setRk(e.target.value as any)}><option value="cart">xe hàng</option><option value="foot">đường người</option><option value="trail">đường rừng</option></select>
      <button className="btn sm" onClick={() => { st.proposals = proposeRoads(st, it().getFields(), rk); st.emit(); }}>Đường giữa POI đã chọn</button></div>
    <div className="row"><button className="btn sm" onClick={() => { st.proposals = proposeDocks(st); st.emit(); }}>Gợi ý bến nối sông/hồ</button></div>
    <div className="row"><select value={arche} onChange={(e) => setArche(e.target.value)}>{ARCHES.filter((a) => !["custom", "elder_site", "gate"].includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="btn sm" onClick={() => { st.proposals = proposePois(st, it().getFields(), arche); st.emit(); }}>Gợi ý vị trí POI</button></div>
    <div className="row"><select value={cluster} onChange={(e) => setCluster(e.target.value)}>{CLUSTERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn sm" onClick={() => { st.proposals = proposeCluster(st, cluster, center); st.emit(); }}>Tạo cụm tại giữa màn hình</button></div>
    <div className="row"><button className="btn sm" onClick={() => st.setUI({ tool: "region" })}>Chọn vùng (Q)</button><button className="btn sm" disabled={!st.ui.regionRect} onClick={() => { st.proposals = proposeRegen(st, st.ui.regionRect!); st.emit(); }}>Tái sinh chi tiết địa hình cục bộ</button>{st.ui.regionRect && <button className="btn sm" onClick={() => st.setUI({ regionRect: null })}>Bỏ vùng</button>}</div>
    {st.proposals.length > 0 && <h4>Đề xuất đang chờ duyệt ({st.proposals.length})</h4>}
    {st.proposals.map((pr) => <div key={pr.id} className="card prop"><b>{pr.title}</b><div className="muted" style={{ margin: "3px 0 6px" }}>{pr.detail}</div><div className="row"><button className="btn sm acc" onClick={() => { st.commit("Smart: " + pr.title, (p) => pr.apply(p), { base: true }); st.proposals = st.proposals.filter((x) => x.id !== pr.id); st.emit(); st.toast("Đã áp dụng — Ctrl+Z để hoàn tác"); }}>Áp dụng</button><button className="btn sm" onClick={() => { st.proposals = st.proposals.filter((x) => x.id !== pr.id); st.emit(); }}>Bỏ</button></div></div>)}
    {st.proposals.length > 1 && <button className="btn sm" onClick={() => { st.proposals = []; st.emit(); }}>Bỏ tất cả đề xuất</button>}
  </div>;
}

export function SnapshotsPanel({ st }: { st: Store }) {
  const [name, setName] = useState("Biến thể A");
  const d = st.diffSummary;
  return <div>
    <h4>Snapshot / biến thể</h4>
    <div className="row"><TextIn value={name} onCommit={setName} style={{ flex: 1 }} /><button className="btn sm acc" onClick={() => { st.takeSnapshot(name); st.toast("Đã lưu snapshot «" + name + "»"); }}>Lưu snapshot</button></div>
    {st.snapshots.length === 0 && <div className="muted">Chưa có snapshot. Lưu một bản rồi chỉnh sửa, sau đó bấm «So sánh» (A = snapshot, B = hiện tại).</div>}
    {st.snapshots.map((s) => <div key={s.id} className={"card" + (st.compareId === s.id ? " prop" : "")}><b>{s.name}</b> <span className="muted">{s.time}</span><div className="row"><button className="btn sm" onClick={() => st.compare(st.compareId === s.id ? null : s.id)}>{st.compareId === s.id ? "Tắt so sánh" : "So sánh với hiện tại"}</button><button className="btn sm" onClick={() => { if (confirm("Khôi phục snapshot này? (có thể Hoàn tác)")) st.restoreSnapshot(s.id); }}>Khôi phục</button><button className="btn sm" onClick={() => st.deleteSnapshot(s.id)}>Xóa</button></div></div>)}
    {d && <div><h4>Khác biệt A → B</h4><div className="card info">+{d.added.length} thêm · −{d.removed.length} xóa · ~{d.changed.length} đổi · {d.terrain} ô độ cao · {d.biome} ô biome. Vòng xanh = thêm, vòng cam = đã đổi/di chuyển (trên bản đồ).</div>
      <div className="list">{[...d.added.map((x) => ["+", x] as const), ...d.changed.map((x) => ["~", x] as const), ...d.removed.map((x) => ["−", x] as const)].slice(0, 80).map(([s, x]) => <div key={s + x.id} className="li" onClick={() => { if (s !== "−") { st.select([x.id]); const o = st.get(x.id); if (o) zoomTo(st, objectAnchor(o), 140); } }}><b>{s}</b> {x.name} <span className="muted">{COLL_NAME[x.coll]}</span></div>)}</div></div>}
  </div>;
}

export function ValidationBar({ st }: { st: Store }) {
  const checks = st.checks, s = summarize(checks), open = st.ui.bottomOpen;
  const [flt, setFlt] = useState<string>("");
  const shown = checks.filter((c) => !flt || c.status === flt);
  return <div>
    <div className="vbar">
      <b>Kiểm tra theo Bible</b>
      {(["FAIL", "WARNING", "UNKNOWN", "PASS"] as const).map((k) => <button key={k} className={"chip " + k} style={{ cursor: "pointer", opacity: flt && flt !== k ? 0.45 : 1 }} data-testid={"chip-" + k} onClick={() => { setFlt(flt === k ? "" : k); st.setUI({ bottomOpen: true }); }}>{k} {s[k]}</button>)}
      <span className="muted">{checks.length ? "" : "đang tính…"}</span>
      <div className="spacer" />
      <button className="btn sm" onClick={() => { st.runChecks(true); st.emit(); }}>Chạy lại</button>
      <button className="btn sm" data-testid="toggle-validation" onClick={() => st.setUI({ bottomOpen: !open })}>{open ? "Thu gọn ▾" : "Mở rộng ▴"}</button>
    </div>
    {open && <div className="vlist" data-testid="validation-list">{shown.map((c) => <div key={c.id} className={"vcard " + c.status} onClick={() => { const ids = c.refs.filter((r) => st.get(r)); if (ids.length) st.select(ids.slice(0, 30)); const pts: Pt[] = c.pts?.length ? c.pts : ids.flatMap((i) => objectAnchor(st.get(i)!)); if (pts.length) zoomTo(st, pts, 120); }}>
      <div className="t"><span className={"chip " + c.status}>{c.status}</span>{c.title}</div><div className="d">{c.detail}{c.bible ? `\n[${c.bible}]` : ""}</div></div>)}</div>}
  </div>;
}
void BIOMES;
