// Builds the deliverable ZIP: standalone offline HTML + launcher + docs + QA report + licenses + screenshots + source.
// usage: node scripts/package.mjs   (run AFTER qa/qa.mjs has produced qa/screens/qa_results.json)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import JSZip from "jszip";

const root = process.cwd();
const html = "public/downloads/SoulOfHero_MapLab.html";
execSync(`node scripts/bundle.mjs src/maplab/standalone.tsx ${html} "Soul of Hero — Map Lab Studio"`, { stdio: "inherit" });

// ---- third-party licenses (auto, transitive) ----
const top = ["polygon-clipping", "simplex-noise", "d3-contour", "polylabel", "jszip", "graphology", "graphology-shortest-path", "graphology-components", "react", "react-dom"];
const seen = new Map();
const collect = (n) => {
  if (seen.has(n)) return;
  const pj = path.join(root, "node_modules", n, "package.json");
  if (!fs.existsSync(pj)) return;
  const j = JSON.parse(fs.readFileSync(pj, "utf8"));
  const dir = path.dirname(pj);
  const lf = fs.readdirSync(dir).find((f) => /^licen[sc]e/i.test(f));
  seen.set(n, { v: j.version, lic: typeof j.license === "string" ? j.license : JSON.stringify(j.license || j.licenses), repo: typeof j.repository === "string" ? j.repository : j.repository?.url || "", text: lf ? fs.readFileSync(path.join(dir, lf), "utf8").slice(0, 6000) : "(không có file LICENSE trong gói npm — xem repository)" });
  for (const d of Object.keys(j.dependencies || {})) collect(d);
};
top.forEach(collect);
let lic = "# THIRD_PARTY_LICENSES\n\nSinh tự động từ `node_modules` khi đóng gói. Các gói dưới đây nằm trong bundle `SoulOfHero_MapLab.html`. JSZip: giấy phép kép (MIT OR GPL-3.0) — Map Lab sử dụng theo **MIT**. Xem thêm `OPEN_SOURCE_RESEARCH.md`.\n\n| Gói | Phiên bản | License | Repository |\n|---|---|---|---|\n";
for (const [n, i] of seen) lic += `| ${n} | ${i.v} | ${i.lic} | ${i.repo} |\n`;
lic += "\n---\n";
for (const [n, i] of seen) lic += `\n## ${n}@${i.v} (${i.lic})\n\n\`\`\`\n${i.text.trim()}\n\`\`\`\n`;
fs.writeFileSync("THIRD_PARTY_LICENSES.md", lic);

// ---- QA report ----
const qa = JSON.parse(fs.readFileSync("qa/screens/qa_results.json", "utf8"));
if (fs.existsSync("qa/screens/qa_results_extra.json")) { const ex = JSON.parse(fs.readFileSync("qa/screens/qa_results_extra.json", "utf8")); qa.results = [...qa.results, ...ex.results]; qa.errors = [...qa.errors, ...ex.errors]; }
const pass = qa.results.filter((r) => r.ok).length;
let rep = `# QA_REPORT — Soul of Hero · Map Lab Studio\n\nChạy lúc ${qa.when} bằng hai bộ kịch bản \`qa/qa.mjs\` + \`qa/qa_extra.mjs\` (Playwright + Chromium thật, headless) trên **file://SoulOfHero_MapLab.html** (bản offline), viewport 1280×720 và 1600×900.\n\n**Kết quả: ${pass}/${qa.results.length} kiểm thử đạt · lỗi JavaScript console/pageerror: ${qa.errors.length}.**\n\n| # | Kiểm thử | Kết quả | Ghi chú đo được |\n|---|---|---|---|\n`;
qa.results.forEach((r, i) => (rep += `| ${i + 1} | ${r.name} | ${r.ok ? "PASS" : "**FAIL**"} | ${r.info.replace(/\|/g, "/").slice(0, 160)} |\n`));
rep += `\n## Ảnh chụp thực (thư mục \`screenshots/\`)\n\nTất cả do trình duyệt thật chụp từ ứng dụng đang chạy (không phải mockup): \`00_first_run_help\`, \`01_atlas_1280x720\`, \`view_1…7_*\` (7 chế độ xem), \`02_new_island\`, \`03_poi_moved\`, \`04_smart_panel\`, \`05_validation_open\`, \`06_snapshot_compare\`, \`07_view_only\`, \`08_palette\`, \`09_context_menu\`, \`10_atlas_1600x900\`, \`11_validation_1600x900\`, \`12_clean_viewonly_1600x900\`. Bản đồ sạch xuất từ ZIP Map Tower: \`samples/clean_map_export.png\`.\n\n## Trạng thái từng phần (trung thực)\n\n| Phần | Trạng thái |\n|---|---|\n| Chỉnh sửa đảo (brush thêm/xóa, polygon), sông + nối phụ lưu, đường, cầu, bến, POI, vùng xây, Elder | **Hoạt động thật** (đã thao tác bằng chuột/phím trong QA ở trên) |\n| Undo/redo, lưu/mở/autosave, snapshot A/B, export PNG/SVG/JSON/ZIP + nhập lại | **Hoạt động thật** |\n| Validation (≈40 kiểm tra) | Hoạt động thật ở **tầng bản vẽ** — không thay thế nghiệm thu native/human (Bible §8) |\n| Smart tools | Hoạt động thật, luôn qua xem trước. Chất lượng gợi ý POI/đường là heuristic, cần người thiết kế duyệt |\n| Tái sinh cục bộ | Chỉ nhiễu độ cao + phân loại biome trong vùng chọn; không tạo lại sông/đường |\n\n## Giới hạn còn lại (chưa làm hoặc chưa kiểm chứng)\n\n1. **Chưa kiểm thử trên Windows/Edge thật** — chỉ Chromium headless trên Linux; file:// + localStorage dự kiến hoạt động trên Chrome/Edge.\n2. Chưa có kiểm thử tải lớn (hàng nghìn đối tượng) và chưa kiểm thử màn hình HiDPI/4K thủ công.\n3. Không có habitat quái, thời tiết, tốc độ thuyền/xe, giá Rương ký gửi, số tiền Ragnarok — validation báo **UNKNOWN**, không bịa số.\n4. Ngưỡng độ dốc/khoảng cách/phân bố là **heuristic của Map Lab**, không phải luật Bible; có thể sửa trong \`src/maplab/analysis.ts\` (\`RULES\`).\n5. Không có 'nhóm' đa cấp, căn chỉnh/phân phối đối tượng, xoay nhiều đối tượng cùng lúc; xoay/scale chỉ cho POI (Inspector).\n6. Đồ thị cổng Atlas, tuyến Rương ký gửi seller, và 640×360 1× legibility **chưa chứng minh được** (cần bản dựng native).\n7. Bản đồ khởi tạo là **đề xuất của agent**, chưa phải canon được người sáng tạo duyệt; "Hướng địa lý A" không có định nghĩa công khai để đối chiếu.\n8. Nền địa hình raster có độ phân giải 8u/ô; thao tác sửa độ cao rất chi tiết (< 8u) không khả dụng.\n`;
fs.writeFileSync("QA_REPORT.md", rep);

// ---- ZIP ----
const z = new JSZip();
const add = (f, name = f) => z.file(name, fs.readFileSync(f));
add(html, "SoulOfHero_MapLab.html");
z.file("Open_MapLab.bat", '@echo off\r\nrem Soul of Hero - Map Lab Studio (offline, khong can cai dat)\r\nstart "" "%~dp0SoulOfHero_MapLab.html"\r\n');
add("USER_GUIDE.md", "HUONG_DAN.md"); add("OPEN_SOURCE_RESEARCH.md"); add("QA_REPORT.md"); add("THIRD_PARTY_LICENSES.md");
z.file("README.txt", "SOUL OF HERO - MAP LAB STUDIO\n\n1) Giai nen ZIP.\n2) Bam dup Open_MapLab.bat (hoac mo SoulOfHero_MapLab.html bang Chrome/Edge). Chay offline.\n3) Doc HUONG_DAN.md (thao tac PC), OPEN_SOURCE_RESEARCH.md, QA_REPORT.md.\n\nBan do khoi tao la DE XUAT cua agent, chua phai canon.\nsource/ chua ma nguon day du (Next.js + TypeScript). Build offline lai: node scripts/bundle.mjs src/maplab/standalone.tsx out.html (can npm install esbuild).\n");
const shots = fs.readdirSync("qa/screens").filter((f) => /\.(png)$/.test(f) && !/^(export_2x|clean_map_export)/.test(f));
shots.forEach((f) => z.file("screenshots/" + f, fs.readFileSync("qa/screens/" + f)));
if (fs.existsSync("qa/screens/clean_map_export.png")) z.file("samples/clean_map_export.png", fs.readFileSync("qa/screens/clean_map_export.png"));
if (fs.existsSync("qa/screens/saved_project.sohmap.json")) z.file("samples/saved_project.sohmap.json", fs.readFileSync("qa/screens/saved_project.sohmap.json"));
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (["node_modules", ".next", "downloads", "screens", "screens_next", "dist-tmp"].includes(e.name)) continue; walk(p, out); } else out.push(p); } return out; };
for (const d of ["src", "scripts", "qa"]) for (const f of walk(d)) z.file("source/" + f, fs.readFileSync(f));
for (const f of ["package.json", "tsconfig.json", "next.config.ts", "OPEN_SOURCE_RESEARCH.md", "USER_GUIDE.md"]) if (fs.existsSync(f)) z.file("source/" + f, fs.readFileSync(f));
const buf = await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync("public/downloads/SoulOfHero_MapLab_Studio.zip", buf);
console.log("ZIP", (buf.length / 1048576).toFixed(1), "MB;", shots.length, "screenshots;", seen.size, "licensed packages");
