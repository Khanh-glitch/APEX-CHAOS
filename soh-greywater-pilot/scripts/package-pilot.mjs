// Builds the Greywater pilot ZIP: offline HTML + docs + QA evidence + screenshots + samples + patch + source.
// usage: node scripts/package-pilot.mjs   (after qa/pilot-test.mjs and qa/tmp/geo-compare.ts have run)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import JSZip from "jszip";

const root = process.cwd();
const html = "public/downloads/SoulOfHero_MapLab.html";
execSync(`node scripts/bundle.mjs src/maplab/standalone.tsx ${html} "Soul of Hero — Map Lab Studio"`, { stdio: "inherit" });

const z = new JSZip();
const add = (f, name = f) => { if (fs.existsSync(f)) z.file(name, fs.readFileSync(f)); };
const qa = JSON.parse(fs.readFileSync("qa/qa_results.json", "utf8"));
const geo = fs.existsSync("qa/geo_preservation.json") ? JSON.parse(fs.readFileSync("qa/geo_preservation.json", "utf8")) : null;
const pass = qa.results.filter((r) => r.ok).length;

let rep = `# QA_REPORT — GREYWATER POI DETAIL PILOT\n\nChạy lúc ${qa.when} · harness: ${qa.harness || "puppeteer-core + @sparticuz/chromium (headless, Linux)"} · app: ${qa.app || "http://localhost:3000"}.\n\n**Kết quả: ${pass}/${qa.results.length} PASS · lỗi JavaScript console/pageerror: ${qa.errors.length}.**\n\n| # | Kiểm thử | Kết quả | Ghi chú đo được |\n|---|---|---|---|\n`;
qa.results.forEach((r, i) => (rep += `| ${i + 1} | ${r.name.replace(/\|/g, "/")} | ${r.ok ? "PASS" : "**FAIL**"} | ${String(r.info || "").replace(/\|/g, "/").slice(0, 200)} |\n`));
if (geo) {
  rep += `\n## Bảo toàn địa lý — ${geo.verdict}\n\n| Tập | Seed | App | Giống |\n|---|---|---|---|\n`;
  for (const [k, v] of Object.entries(geo.collections)) rep += `| ${k} | ${v.refCount} | ${v.appCount} | ${v.identical ? "✅" : "—"} |\n`;
  rep += `\nTerrain: seed ${geo.terrain.refSeed}, cell ${geo.terrain.cell}, elev ${geo.terrain.sameElev ? "giống" : "khác"}, biome ${geo.terrain.sameBiome ? "giống" : "khác"}. World ${geo.world.app.w}×${geo.world.app.h}. POI null-key note: ${geo.poiNullKeyNote}\n`;
}
rep += `\n## Ảnh (thư mục \`screenshots/\`)\n\nChụp bằng Chromium thật ở 1× từ ứng dụng đang chạy: 60–69 (Map Studio + Detail Studio + play), 70–73 (prototype gốc để so sánh), 74–75 (Bridge kit bị loại), 80–82 (bản offline file://).\n`;
rep += `\n## Giới hạn\n\nGodot integration NOT TESTẸD; play mode là sandbox pilot; không có NPC/thời tiết; chi tiết trong \`GREYWATER_PILOT_HANDOFF.md\` §7.\n`;
fs.writeFileSync("QA_PILOT_REPORT.md", rep.replace("TESTẸD", "TESTED"));

add(html, "SoulOfHero_MapLab.html");
z.file("Open_MapLab.bat", '@echo off\r\nrem Soul of Hero - Map Lab Studio + Greywater POI detail layer (offline)\r\nstart "" "%~dp0SoulOfHero_MapLab.html"\r\n');
add("USER_GUIDE.md", "HUONG_DAN.md");
add("GREYWATER_PILOT_HANDOFF.md");
add("QA_PILOT_REPORT.md");
add("qa/qa_results.json");
add("qa/geo_preservation.json");
add("qa/greywater-poi-layer.patch");
add("qa/samples/sohmap_with_greywater_detail.json");
add("qa/samples/greywater_poi_detail.json");
add("qa/samples/app_saved_with_detail.json");
for (const f of fs.readdirSync("qa/shots")) if (/\.(png)$/.test(f) && !/^debug/.test(f)) z.file("screenshots/" + f, fs.readFileSync("qa/shots/" + f));
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (["node_modules", ".next", "downloads", "screens", "screens_next", "shots", "dist-tmp", "tmp"].includes(e.name)) continue; walk(p, out); } else out.push(p); } return out; };
for (const f of walk("src")) z.file("source/" + f, fs.readFileSync(f));
for (const f of walk("qa")) z.file("source/" + f, fs.readFileSync(f));
for (const f of ["package.json", "tsconfig.json", "next.config.ts", "USER_GUIDE.md", "GREYWATER_PILOT_HANDOFF.md"]) if (fs.existsSync(f)) z.file("source/" + f, fs.readFileSync(f));
for (const f of fs.readdirSync("scripts")) z.file("source/scripts/" + f, fs.readFileSync(path.join("scripts", f)));

const buf = await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync("public/downloads/SoulOfHero_MapLab_Greywater.zip", buf);
console.log("ZIP", (buf.length / 1048576).toFixed(1), "MB ·", pass + "/" + qa.results.length, "PASS ·", z.files ? "" : "");
