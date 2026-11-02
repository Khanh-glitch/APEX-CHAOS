import JSZip from "jszip";
import { catmull, centroid } from "./geom";
import { computeFields, heatmap } from "./analysis";
import { drawScene, heatCanvas, preset, renderBase, VIEW_NAMES } from "./render";
import type { SceneOpts } from "./render";
import { serializeProject } from "./store";
import { summarize } from "./validate";
import type { Check } from "./validate";
import { ARCHE_BY_ID, BIOMES, ELDERS } from "./types";
import type { Project, ViewMode } from "./types";

export function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 40) || "soh_map";

export function renderPNG(p: Project, mode: ViewMode, scale: number, base?: HTMLCanvasElement, opts: Partial<SceneOpts> = {}): Promise<Blob> {
  const pr = preset(mode);
  const cv = document.createElement("canvas");
  cv.width = Math.round(p.world.w * scale); cv.height = Math.round(p.world.h * scale);
  const c = cv.getContext("2d")!;
  const b = base || renderBase(p, scale);
  let heat: HTMLCanvasElement | null = null;
  if (pr.layers.heat) heat = heatCanvas(p, heatmap(p, computeFields(p), "opp"), "opp");
  drawScene(c, p, { x: 0, y: 0, s: scale }, { mode, layers: pr.layers, dim: pr.dim, sel: new Set(), hover: null, gridSize: 100, heat, blocked: new Set(), extras: [], ragnarok: mode === "elders", selVertex: -1, hoverSeg: -1, vw: cv.width, vh: cv.height, hideEditor: true, ...opts }, b, scale);
  return new Promise((res, rej) => cv.toBlob((bl) => (bl ? res(bl) : rej(new Error("toBlob failed"))), "image/png"));
}

const pth = (pts: [number, number][], close = false) => "M" + pts.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L") + (close ? "Z" : "");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export async function renderSVG(p: Project): Promise<string> {
  const png = await renderPNG(p, "clean", 1, undefined, {});
  const dataUrl: string = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(png); });
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.world.w} ${p.world.h}" width="${p.world.w}" height="${p.world.h}" font-family="Segoe UI,sans-serif">`);
  o.push(`<title>${esc(p.name)}</title><image href="${dataUrl}" x="0" y="0" width="${p.world.w}" height="${p.world.h}"/>`);
  o.push(`<g id="land" fill="none" stroke="#3a2818" stroke-width="1.3">${p.land.map((l) => `<path data-id="${l.id}" d="${l.rings.map((r) => pth(r, true)).join("")}"/>`).join("")}</g>`);
  o.push(`<g id="lakes" fill="#4aa3d4" stroke="#1d5b86">${p.lakes.map((l) => `<path data-id="${l.id}" d="${pth(l.ring, true)}"/>`).join("")}</g>`);
  o.push(`<g id="zones" fill="rgba(60,200,120,.28)" stroke="#147a3c" stroke-dasharray="5 3">${p.zones.map((z) => `<path data-id="${z.id}" d="${pth(z.ring, true)}"><title>${esc(z.name)}</title></path>`).join("")}</g>`);
  o.push(`<g id="elders" fill-opacity=".18" stroke-width="2">${p.elders.map((e) => { const c = ELDERS.find((x) => x.id === e.elder)!.color; return `<path data-id="${e.id}" d="${pth(e.outer, true)}" fill="${c}" stroke="${c}"/><path d="${pth(e.core, true)}" fill="${c}" stroke="${c}"/>`; }).join("")}</g>`);
  o.push(`<g id="rivers" fill="none" stroke-linecap="round">${p.rivers.map((r) => `<path data-id="${r.id}" d="${pth(catmull(r.points).pts)}" stroke="${r.kind === "canal" ? "#5cc0d8" : "#58b4e2"}" stroke-width="${Math.max(1.8, r.width)}"><title>${esc(r.name)}</title></path>`).join("")}</g>`);
  o.push(`<g id="roads" fill="none" stroke-linecap="round">${p.roads.map((r) => `<path data-id="${r.id}" d="${pth(catmull(r.points).pts)}" stroke="${r.kind === "cart" ? "#c9742e" : r.kind === "ferry" ? "#ffffff" : "#6b3a1d"}" stroke-width="${r.kind === "cart" ? 3.4 : 1.6}" ${r.kind === "cart" ? "" : 'stroke-dasharray="4 3"'}><title>${esc(r.name)}</title></path>`).join("")}</g>`);
  o.push(`<g id="bridges" fill="#f2d9a6" stroke="#3a2410">${p.bridges.map((b) => `<rect data-id="${b.id}" x="-6.5" y="-3.6" width="13" height="7.2" transform="translate(${b.at[0].toFixed(1)} ${b.at[1].toFixed(1)}) rotate(${((b.ang * 180) / Math.PI).toFixed(1)})"/>`).join("")}</g>`);
  o.push(`<g id="docks" fill="#1e6fd0" stroke="#fff">${p.docks.map((d) => `<path data-id="${d.id}" d="M0 -6.5L5.5 3L-5.5 3Z" transform="translate(${d.at[0].toFixed(1)} ${d.at[1].toFixed(1)})"><title>${esc(d.name)}</title></path>`).join("")}</g>`);
  o.push(`<g id="pois" stroke="#2a1a0a">${p.pois.map((q) => { const a = ARCHE_BY_ID[q.arche] || ARCHE_BY_ID.custom; return `<g data-id="${q.id}"><circle cx="${q.at[0].toFixed(1)}" cy="${q.at[1].toFixed(1)}" r="${(4.5 + a.r * 0.14).toFixed(1)}" fill="${a.color}"/><text x="${q.at[0].toFixed(1)}" y="${(q.at[1] + 3).toFixed(1)}" font-size="8" text-anchor="middle" stroke="none" fill="#1a1208" font-weight="700">${esc(a.code)}</text><text x="${q.at[0].toFixed(1)}" y="${(q.at[1] + 17).toFixed(1)}" font-size="9" text-anchor="middle" stroke="none" fill="#2a1a0a">${esc(q.name)}</text></g>`; }).join("")}</g>`);
  o.push(`<g id="labels" text-anchor="middle" fill="#30200f">${p.labels.map((l) => `<text data-id="${l.id}" x="${l.at[0]}" y="${l.at[1]}" font-size="${l.size}" transform="rotate(${((l.rot * 180) / Math.PI).toFixed(1)} ${l.at[0]} ${l.at[1]})">${esc(l.text)}</text>`).join("")}</g></svg>`);
  return o.join("\n");
}

const count = <T,>(a: T[], f: (x: T) => boolean) => a.filter(f).length;
export function buildBrief(p: Project, checks: Check[]): string {
  const s = summarize(checks);
  const L: string[] = [];
  L.push(`# Gameplay brief — ${p.name}`, "", `> **Trạng thái:** ${p.meta.status}. Bản đồ này là **đề xuất thiết kế trên giấy**, không phải canon, không phải bằng chứng E2/native. Sinh tự động bởi Soul of Hero Map Lab Studio lúc ${new Date().toLocaleString()}.`, "");
  L.push("## 1. Tóm tắt cấu trúc", "", `- Thế giới ${p.world.w}×${p.world.h} đơn vị trừu tượng (u). **Tỉ lệ thực/km/phút CHƯA chốt** (Bible §11.5).`, `- ${p.land.length} khối đất: ${p.land.map((l) => `${l.name} [${l.kind}]`).join("; ")}.`, `- ${p.lakes.length} hồ, ${p.rivers.length} dòng (${count(p.rivers, (r) => r.kind === "canal")} kênh, ${count(p.rivers, (r) => r.kind === "distributary")} phân lưu), ${p.bridges.length} cầu, ${p.docks.length} bến.`, `- ${p.roads.length} tuyến: ${count(p.roads, (r) => r.kind === "cart")} đường xe hàng, ${count(p.roads, (r) => r.kind === "foot" || r.kind === "trail" || r.kind === "riverside")} đường người/đường mòn, ${count(p.roads, (r) => r.kind === "ferry")} phà; ${count(p.roads, (r) => !!r.alt)} tuyến thay thế.`, `- ${p.pois.length} POI (${count(p.pois, (o) => o.depth === "multi")} nhiều tầng), ${p.zones.length} vùng xây nhà, ${p.resources.length} nút nguồn sống, ${p.spawns.length} spawn.`, "");
  L.push("## 2. Thủy lộ", "");
  for (const r of p.rivers) L.push(`- **${r.name}** (${r.kind}${r.fordable ? ", lội được" : ""}) — cửa: ${r.mouth.kind}${r.mouth.ref ? ":" + r.mouth.ref : ""}; navigable ${r.nav.filter(Boolean).length}/${r.nav.length} đoạn; ${r.feats.map((f) => f.kind).join(", ") || "không thác/ghềnh"}.${r.reason ? " Lý do kênh: " + r.reason : ""}`);
  L.push("", "## 3. Sáu Elder", "");
  for (const e of p.elders) { const d = ELDERS.find((x) => x.id === e.elder); L.push(`- **${e.name}** (${d?.stone}) — ${d?.theme}. Ngoại vi ${e.outer.length} đỉnh, lõi ${e.core.length}, ${e.arenas.length} khu chiến đấu, ${e.approach.length} điểm tiếp cận, POI: ${e.pois.map((i) => p.pois.find((q) => q.id === i)?.name || i).join(", ")}. Ragnarok: ${e.ragnarok || "—"}`); }
  L.push("", "## 4. Kiểm tra theo Bible", "", `PASS ${s.PASS} · WARNING ${s.WARNING} · UNKNOWN ${s.UNKNOWN} · FAIL ${s.FAIL}`, "");
  for (const c of checks.filter((x) => x.status !== "PASS")) L.push(`- **${c.status}** ${c.title}${c.bible ? ` _(${c.bible})_` : ""}: ${c.detail.split("\n")[0]}`);
  L.push("", "## 5. Chưa được người sáng tạo/Gameplay Tower chốt (KHÔNG coi là luật)", "", "- Loại thuyền, tải trọng, vận tốc, chi phí; kênh đào cần công trình nào.", "- Người bán Rương ký gửi nhận tiền chưa ký gửi ([ĐỀ XUẤT], Bible §5.4): giá, stock, vị trí bán.", "- Số rương tiền Ragnarok, giá trị, số chuyến; habitat quái; dự báo thời tiết 24h.", "- Đồ thị cổng Atlas (điểm vào–ra) và hình dạng thật của lãnh thổ Elder.", "- Ngưỡng độ dốc/khoảng cách trong validator là heuristic của Map Lab.", "", "## 6. Câu hỏi gửi Map Tower", "", "1. Cấu trúc địa lý/tuyến nào đáng giữ, đáng bỏ? 2. Elder nào cần lãnh thổ lại? 3. Các tuyến thủy có đủ lý do để người chơi chọn thay vì đi bộ? 4. Vùng nội địa nào còn trống?");
  return L.join("\n");
}
export function buildValidationMD(checks: Check[]): string {
  const s = summarize(checks);
  const L = ["# Validation report", "", `PASS ${s.PASS} · WARNING ${s.WARNING} · UNKNOWN ${s.UNKNOWN} · FAIL ${s.FAIL}`, "", "Ý nghĩa: PASS = dữ liệu thiết kế chứng minh được; WARNING = có thể có vấn đề; UNKNOWN = thiếu dữ liệu/cơ chế chưa chốt; FAIL = mâu thuẫn hình học hoặc vi phạm luật đã chốt. Ngưỡng số trong báo cáo là heuristic của Map Lab trừ khi ghi nguồn Bible.", ""];
  for (const c of checks) L.push(`## [${c.status}] ${c.title}`, c.bible ? `_Bible: ${c.bible}_` : "", "", c.detail, "");
  return L.join("\n");
}

export async function exportMapTowerZip(p: Project, checks: Check[], notes: string, progress?: (m: string) => void): Promise<Blob> {
  const z = new JSZip();
  const say = (m: string) => progress?.(m);
  say("Dựng nền 2×…");
  const base2 = renderBase(p, 2), base1 = renderBase(p, 1);
  z.file("maps/clean_map.png", await renderPNG(p, "clean", 2, base2));
  z.file("maps/atlas_full.png", await renderPNG(p, "atlas", 2, base2));
  for (const m of ["hydro", "transport", "poi", "elders", "opp"] as ViewMode[]) { say("Overlay " + m); z.file(`overlays/${m}_${slug(VIEW_NAMES[m])}.png`, await renderPNG(p, m, 1, base1)); }
  say("SVG + dữ liệu…");
  z.file("maps/atlas.svg", await renderSVG(p));
  z.file("data/project.sohmap.json", serializeProject(p, true));
  z.file("data/pois.json", JSON.stringify(p.pois, null, 1));
  z.file("data/pois.csv", ["id,name,archetype,x,y,depth,gate,elder,resources,confidence"].concat(p.pois.map((o) => [o.id, o.name, o.arche, o.at[0].toFixed(0), o.at[1].toFixed(0), o.depth, o.gate, o.elder || "", o.resources.join("|"), o.conf || ""].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))).join("\n"));
  z.file("data/routes.json", JSON.stringify({ rivers: p.rivers, roads: p.roads, bridges: p.bridges, docks: p.docks }, null, 1));
  z.file("data/regions.json", JSON.stringify({ land: p.land, lakes: p.lakes, zones: p.zones, elders: p.elders, spawns: p.spawns, biomes: BIOMES.map((b) => b.name), resources: p.resources }, null, 1));
  z.file("reports/validation_report.md", buildValidationMD(checks));
  z.file("reports/validation_report.json", JSON.stringify(checks, null, 1));
  z.file("GAMEPLAY_BRIEF.md", buildBrief(p, checks));
  z.file("NOTES.md", `# Ghi chú của người thiết kế\n\n${notes || "(chưa có ghi chú)"}\n\n## Ghi chú theo đối tượng\n\n` + [...p.pois, ...p.rivers, ...p.zones].filter((o) => (o as { notes?: string }).notes).map((o) => `- **${o.name}**: ${(o as { notes?: string }).notes}`).join("\n"));
  z.file("OPEN_QUESTIONS.md", "# Chưa chốt\n\n" + checks.filter((c) => c.status === "UNKNOWN").map((c) => `- **${c.title}** — ${c.detail}`).join("\n") + "\n");
  z.file("README.txt", `Export for Map Tower — ${p.name}\nTạo lúc ${new Date().toISOString()}\n\n- maps/: bản đồ sạch, atlas, SVG\n- overlays/: thủy lưu, giao thông, POI, Elder (Ragnarok), opportunity\n- data/project.sohmap.json: nạp lại bằng Map Lab (Open) để tiếp tục chỉnh sửa\n- reports/: kết quả validation (PASS/WARNING/UNKNOWN/FAIL)\n- GAMEPLAY_BRIEF.md, OPEN_QUESTIONS.md, NOTES.md\n\nBản đồ là ĐỀ XUẤT thiết kế, không phải canon.\n`);
  void centroid;
  return z.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
