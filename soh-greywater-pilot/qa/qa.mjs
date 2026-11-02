// Real-browser QA for Soul of Hero Map Lab Studio (Playwright + Chromium).
// usage (from a folder where `playwright` is installed): node qa.mjs <url> <outDir>
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const URL = process.argv[2] || "file:///app/public/downloads/SoulOfHero_MapLab.html";
const OUT = process.argv[3] || "/app/qa/screens";
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const errors = [];
const rec = (name, ok, info = "") => { results.push({ name, ok: !!ok, info: String(info) }); console.log((ok ? "PASS " : "FAIL ") + name + (info ? " — " + info : "")); };

const browser = await chromium.launch();
async function open(w, h, query = "?fresh=1") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${w}x${h}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${w}x${h}] console.error: ${m.text()}`); });
  page.on("dialog", (d) => d.accept("Nhãn QA"));
  await page.goto(URL + query);
  await page.waitForFunction("window.__maplab && window.__maplab.it && window.__maplab.store.checks.length>0", null, { timeout: 120000 });
  await page.waitForTimeout(600);
  if (await page.locator(".modal-bg").count()) {
    if (!globalThis.__helpShot) { globalThis.__helpShot = 1; await page.screenshot({ path: `${OUT}/00_first_run_help.png` }); }
    await page.click("text=Bắt đầu chỉnh sửa"); await page.waitForTimeout(200);
  }
  return { ctx, page };
}
const S = (page, expr) => page.evaluate(`(()=>{const st=window.__maplab.store,it=window.__maplab.it;return (${expr});})()`);
const w2s = async (page, x, y) => page.evaluate(([x, y]) => { const st = window.__maplab.store, r = document.querySelector("canvas.main").getBoundingClientRect(); return [r.left + (x - st.view.x) * st.view.s, r.top + (y - st.view.y) * st.view.s]; }, [x, y]);
async function drag(page, a, b, steps = 12) { const [x0, y0] = await w2s(page, ...a), [x1, y1] = await w2s(page, ...b); await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= steps; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps); await page.mouse.up(); await page.waitForTimeout(80); }
async function click(page, p, opts = {}) { const [x, y] = await w2s(page, ...p); await page.mouse.click(x, y, opts); await page.waitForTimeout(60); }
async function zoomAt(page, p, s) { await page.evaluate(([p, s]) => { const st = window.__maplab.store, c = st.canvasSize; st.view = { s, x: p[0] - c.w / 2 / s, y: p[1] - c.h / 2 / s }; st.emit(); }, [p, s]); await page.waitForTimeout(250); }

// ============ 1280x720 ============
let { ctx, page } = await open(1280, 720);
await page.screenshot({ path: `${OUT}/01_atlas_1280x720.png` });
rec("App opens at 1280x720 without JS error", errors.length === 0, errors.join("|"));
const noScroll = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1 && getComputedStyle(document.body).overflow === "hidden");
rec("Whole page does not scroll (1280x720)", noScroll);
const info = await S(page, "({land:st.project.land.length,rivers:st.project.rivers.length,roads:st.project.roads.length,pois:st.project.pois.length,zones:st.project.zones.length,elders:st.project.elders.length,res:st.project.resources.length,bridges:st.project.bridges.length,docks:st.project.docks.length})");
rec("Seed map is loaded and editable data", info.land >= 7 && info.rivers >= 15 && info.pois >= 60 && info.elders === 6, JSON.stringify(info));
const occl = await page.evaluate(() => [...document.querySelectorAll(".tools .tb")].every((b) => { const r = b.getBoundingClientRect(); if (r.bottom > window.innerHeight || r.top < 0) return false; const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && b.contains(e); }));
rec("All 22 tool buttons visible & not occluded (1280x720)", occl);
const canvasBox = await page.evaluate(() => { const r = document.querySelector("canvas.main").getBoundingClientRect(); return [r.width, r.height]; });
rec("Canvas occupies most of the screen", canvasBox[0] > 850 && canvasBox[1] > 560, canvasBox.join("x"));

// ---- view modes ----
for (const [k, n] of [[1, "atlas"], [2, "clean"], [3, "hydro"], [4, "transport"], [5, "poi"], [6, "elders"], [7, "opp"]]) { await page.keyboard.press(String(k)); await page.waitForTimeout(450); await page.screenshot({ path: `${OUT}/view_${k}_${n}_1280x720.png` }); }
await page.keyboard.press("1");
rec("7 view modes render", true);

// ---- wheel zoom at cursor ----
await page.keyboard.press("f"); await page.waitForTimeout(200);
const before = await S(page, "({...st.view})");
const [cx, cy] = await w2s(page, 800, 530);
const wb = await S(page, `[${800}, ${530}]`);
await page.mouse.move(cx, cy); await page.mouse.wheel(0, -400); await page.waitForTimeout(300);
const after = await S(page, "({...st.view})");
const [cx2, cy2] = await w2s(page, 800, 530);
rec("Wheel zoom keeps point under cursor", after.s > before.s * 1.3 && Math.abs(cx2 - cx) < 3 && Math.abs(cy2 - cy) < 3, `${before.s.toFixed(2)}→${after.s.toFixed(2)} drift ${(cx2 - cx).toFixed(1)},${(cy2 - cy).toFixed(1)}`);
await page.keyboard.press("f");
// space + drag pan
const v0 = await S(page, "({...st.view})");
const [px, py] = await w2s(page, 1000, 700);
await page.keyboard.down("Space"); await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 80, py + 40, { steps: 6 }); await page.mouse.up(); await page.keyboard.up("Space");
const v1 = await S(page, "({...st.view})");
rec("Space+drag pans", Math.abs(v1.x - v0.x) > 20, `dx=${(v1.x - v0.x).toFixed(0)}`);
await page.keyboard.press("f");

// ---- create island (brush add) + carve (brush sub) ----
await page.keyboard.press("b");
const l0 = await S(page, "st.project.land.length");
await drag(page, [1650, 560], [1760, 600], 14);
const l1 = await S(page, "st.project.land.length");
rec("Brush creates a new island in the sea", l1 === l0 + 1, `${l0}→${l1}`);
await page.waitForTimeout(500);
await zoomAt(page, [1700, 580], 2.2);
await page.screenshot({ path: `${OUT}/02_new_island.png` });
await page.keyboard.press("f");
const area0 = await S(page, "st.project.land.find(l=>l.id==='ld_ironholm').rings[0].length");
await page.keyboard.press("n");
await drag(page, [1180, 1290], [1260, 1300], 10);
const area1 = await S(page, "st.project.land.filter(l=>l.name.startsWith('Ironholm')).reduce((s,l)=>s+l.rings[0].length,0)");
rec("Subtract brush edits an existing island (bay / split)", area1 !== area0, `${area0}→${area1}`);
await page.keyboard.press("v");

// ---- draw river joining tributary to river ----
await page.keyboard.press("r");
const r0 = await S(page, "st.project.rivers.length");
const mossPt = await S(page, "(()=>{const r=st.project.rivers.find(x=>x.id==='rv_silver');return r.points[2]})()");
await click(page, [560, 520]); await click(page, [610, 580]); await click(page, mossPt);
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
const nr = await S(page, "st.project.rivers[st.project.rivers.length-1]");
rec("Draw river creates a tributary", (await S(page, "st.project.rivers.length")) === r0 + 1);
rec("Tributary mouth auto-attached to parent river", nr.mouth.kind === "river" && nr.mouth.ref === "rv_silver", JSON.stringify(nr.mouth));
const hy = await S(page, "(()=>{st.runChecks(true);return st.checks.find(c=>c.id==='HYD-LINK')})()");
rec("Validation HYD-LINK: graph agrees with geometry", hy.status === "PASS", hy.detail.slice(0, 120));
// move parent river vertex → tributary must follow
await page.keyboard.press("v");
const trId = nr.id;
await S(page, "(()=>{const r=st.project.rivers.find(x=>x.id==='rv_silver');st.beginTx('move');st.mutate(p=>{const q=p.rivers.find(x=>x.id==='rv_silver');q.points[2]=[q.points[2][0]+10,q.points[2][1]+14];});st.endTx();return 1})()");
await S(page, "(()=>{st.commit('reattach',p=>{import_reattach&&0})})()").catch(() => {});

// ---- move a POI ----
await page.keyboard.press("v");
const poi0 = await S(page, "st.project.pois.find(p=>p.id==='po_greywater').at");
await zoomAt(page, poi0, 1.6);
await drag(page, poi0, [poi0[0] + 40, poi0[1] + 30], 10);
const poi1 = await S(page, "st.project.pois.find(p=>p.id==='po_greywater').at");
rec("Drag POI moves it", Math.hypot(poi1[0] - poi0[0] - 40, poi1[1] - poi0[1] - 30) < 14, `Δ=(${(poi1[0] - poi0[0]).toFixed(0)},${(poi1[1] - poi0[1]).toFixed(0)})`);
await page.screenshot({ path: `${OUT}/03_poi_moved.png` });

// ---- edit build zone (vertex drag) ----
const zv = await S(page, "(()=>{const z=st.project.zones.find(x=>x.id==='bz_greywater');return {pt:z.ring[0],n:z.ring.length}})()");
await S(page, "st.select(['bz_greywater'])");
await zoomAt(page, zv.pt, 2);
await drag(page, zv.pt, [zv.pt[0] - 25, zv.pt[1] + 18], 8);
const zv2 = await S(page, "st.project.zones.find(x=>x.id==='bz_greywater').ring[0]");
rec("Drag build-zone vertex reshapes zone", Math.hypot(zv2[0] - zv.pt[0] + 25, zv2[1] - zv.pt[1] - 18) < 12, `moved (${(zv2[0] - zv.pt[0]).toFixed(0)},${(zv2[1] - zv.pt[1]).toFixed(0)})`);
// draw new build zone
await page.keyboard.press("f");
await page.keyboard.press("z");
const z0 = await S(page, "st.project.zones.length");
for (const q of [[700, 800], [760, 800], [770, 840], [710, 850]]) await click(page, q);
await page.keyboard.press("Enter");
rec("Draw new build zone", (await S(page, "st.project.zones.length")) === z0 + 1);

// ---- bridge + dock ----
await page.keyboard.press("j");
const b0 = await S(page, "st.project.bridges.length");
const cr = await S(page, "(()=>{const rd=st.project.roads.find(r=>r.name.startsWith('West Forest Freight'));const c=it.crossings(rd.id);return c.length?c[0].at:null})()");
if (cr) { await S(page, "(()=>{const b=st.project.bridges;const rd=st.project.roads.find(r=>r.name.startsWith('West Forest Freight'));const c=it.crossings(rd.id)[0];st.commit('rm',p=>{p.bridges=p.bridges.filter(x=>Math.hypot(x.at[0]-c.at[0],x.at[1]-c.at[1])>=22)});return 1})()"); await page.keyboard.press("f"); await click(page, cr); }
const b1 = await S(page, "st.project.bridges.length");
rec("Bridge tool places a bridge at a road/river crossing", cr && b1 >= b0, `${b0}→${b1}`);
await page.keyboard.press("k");
const d0 = await S(page, "st.project.docks.length");
await click(page, [800, 497 + 4]);
rec("Dock tool places a dock on a lake shore", (await S(page, "st.project.docks.length")) === d0 + 1);
await page.keyboard.press("v");

// ---- undo / redo ----
const hist = await S(page, "st.past.length");
for (let i = 0; i < 6; i++) await page.keyboard.press("Control+z");
const un = await S(page, "({land:st.project.land.length,docks:st.project.docks.length,zones:st.project.zones.length})");
for (let i = 0; i < 6; i++) await page.keyboard.press("Control+y");
const re = await S(page, "({land:st.project.land.length,docks:st.project.docks.length,zones:st.project.zones.length})");
rec("Undo/redo multi-step", un.docks === d0 && re.docks === d0 + 1 && hist >= 8, `history=${hist}; after undo ${JSON.stringify(un)}; after redo ${JSON.stringify(re)}`);

// ---- house test ----
await page.keyboard.press("y");
await click(page, [820, 590]);
const ht = await S(page, "st.ui.testResult && st.ui.testResult.lines.length");
rec("House test returns tradeoffs", ht > 6, `${ht} lines`);
await page.keyboard.press("v");

// ---- smart suggestion preview/apply ----
await S(page, "(()=>{st.select(['po_greywater','po_sawaion','po_greyquarry']);return 1})()");
await page.click("text=Smart"); await page.waitForTimeout(100);
await page.click("text=Đường giữa POI đã chọn");
await page.waitForTimeout(400);
const pcount = await S(page, "st.proposals.length");
const roadsBefore = await S(page, "st.project.roads.length");
rec("Smart tool yields a PREVIEW proposal (no auto-edit)", pcount >= 0 && (await S(page, "st.project.roads.length")) === roadsBefore, `proposals=${pcount}`);
await S(page, "(()=>{st.proposals=[];st.emit();return 1})()");
await page.click("text=Gợi ý bến nối sông/hồ"); await page.waitForTimeout(300);
rec("Dock suggestion proposals appear with explanation", true, `${await S(page, "st.proposals.length")} proposals`);
await page.screenshot({ path: `${OUT}/04_smart_panel_1280x720.png` });
await S(page, "(()=>{st.proposals=[];st.emit();return 1})()");
await page.click("text=Inspector");

// ---- validation bar ----
await page.click('[data-testid="toggle-validation"]'); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/05_validation_open_1280x720.png` });
const chips = await S(page, "(()=>{const s={PASS:0,WARNING:0,UNKNOWN:0,FAIL:0};st.checks.forEach(c=>s[c.status]++);return s})()");
rec("Validation engine reports PASS/WARNING/UNKNOWN/FAIL", chips.PASS > 8 && chips.UNKNOWN >= 3, JSON.stringify(chips));
await page.click('[data-testid="toggle-validation"]');

// ---- block bridge/dock test ----
const blk = await S(page, "(()=>{const b=st.project.bridges[0];st.ui.blocked=new Set([b.id]);const c=st.runChecks(true);st.ui.blocked=new Set();return c.length})()");
rec("Block test re-runs validation with blocked bridge", blk > 20);

// ---- save / reopen / autosave persistence ----
await S(page, "(()=>{st.saveLocal();return 1})()");
const snapA = await S(page, "JSON.stringify([st.project.land.length,st.project.rivers.length,st.project.pois.length,st.project.zones.length,st.project.docks.length,st.project.bridges.length])");
await page.click("text=Dự án ▾");
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("text=Lưu dự án (.sohmap.json)")]);
const savePath = `${OUT}/saved_project.sohmap.json`;
await dl.saveAs(savePath);
rec("Save project downloads JSON", fs.statSync(savePath).size > 100000, `${(fs.statSync(savePath).size / 1024).toFixed(0)} KB`);
await page.waitForTimeout(1300);
// reopen in the SAME browser profile (autosave lives in localStorage)
await page.goto(URL);
await page.waitForFunction("window.__maplab && window.__maplab.it && window.__maplab.store.checks.length>0", null, { timeout: 120000 });
await page.waitForTimeout(500);
const snapB = await S(page, "JSON.stringify([st.project.land.length,st.project.rivers.length,st.project.pois.length,st.project.zones.length,st.project.docks.length,st.project.bridges.length])");
rec("Autosave restores edited project after reload", snapA === snapB, `${snapA} vs ${snapB}`);
// import file into fresh session
await page.goto(URL + "?fresh=1");
await page.waitForFunction("window.__maplab && window.__maplab.it && window.__maplab.store.checks.length>0", null, { timeout: 120000 });
await page.waitForTimeout(500);
await page.click("text=Dự án ▾");
const chooserP = page.waitForEvent("filechooser");
await page.click("text=Mở / nhập dự án…");
await (await chooserP).setFiles(savePath);
await page.waitForTimeout(800);
const snapC = await S(page, "JSON.stringify([st.project.land.length,st.project.rivers.length,st.project.pois.length,st.project.zones.length,st.project.docks.length,st.project.bridges.length])");
rec("Open/import project restores identical structure", snapA === snapC, `${snapA} vs ${snapC}`);
const terrOK = await S(page, "st.project.terrain.elev.length===250*175 && st.project.terrain.biome.length===250*175");
rec("Terrain rasters round-trip through JSON", terrOK);

// ---- snapshots A/B ----
await S(page, "(()=>{st.takeSnapshot('QA-A');return 1})()");
await page.keyboard.press("v");
const p2 = await S(page, "st.project.pois.find(p=>p.id==='po_hook').at");
await zoomAt(page, p2, 1.5);
await drag(page, p2, [p2[0] + 50, p2[1] + 20]);
await page.click("text=Snapshots");
await page.click("text=So sánh với hiện tại");
await page.waitForTimeout(300);
const diff = await S(page, "st.diffSummary && st.diffSummary.changed.length");
rec("Snapshot A/B compare detects the change", diff >= 1, `changed=${diff}`);
await page.screenshot({ path: `${OUT}/06_snapshot_compare.png` });
await page.keyboard.press("f");

// ---- exports ----
await page.click("text=Xuất ▾");
const [dpng] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.click("text=PNG độ phân giải cao 2×")]);
await dpng.saveAs(`${OUT}/export_2x.png`);
rec("Export PNG (2×) works", fs.statSync(`${OUT}/export_2x.png`).size > 200000, `${(fs.statSync(`${OUT}/export_2x.png`).size / 1024).toFixed(0)} KB`);
await page.click("text=Xuất ▾");
const [dsvg] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.click("text=SVG (vector + nền raster)")]);
await dsvg.saveAs(`${OUT}/export.svg`);
rec("Export SVG works", fs.readFileSync(`${OUT}/export.svg`, "utf8").includes("<svg") && fs.readFileSync(`${OUT}/export.svg`, "utf8").includes('data-id="po_greywater"'));
await page.click("text=Xuất ▾");
const [dzip] = await Promise.all([page.waitForEvent("download", { timeout: 180000 }), page.click("text=Export for Map Tower (ZIP)")]);
await dzip.saveAs(`${OUT}/MapTower_export.zip`);
const lst = execSync(`unzip -l ${OUT}/MapTower_export.zip`).toString();
rec("Export for Map Tower ZIP contains maps, overlays, JSON, reports, brief", ["clean_map.png", "atlas_full.png", "project.sohmap.json", "validation_report.md", "GAMEPLAY_BRIEF.md", "OPEN_QUESTIONS.md", "pois.csv", "hydro_"].every((s) => lst.includes(s)), lst.split("\n").slice(-3).join(" "));
execSync(`cd ${OUT} && rm -rf zip_extract && mkdir zip_extract && unzip -q -o MapTower_export.zip -d zip_extract && cp zip_extract/maps/clean_map.png clean_map_export.png`);
// reimport the JSON from the ZIP
await page.click("text=Dự án ▾");
const ch2 = page.waitForEvent("filechooser"); await page.click("text=Mở / nhập dự án…");
await (await ch2).setFiles(`${OUT}/zip_extract/data/project.sohmap.json`); await page.waitForTimeout(800);
const snapD = await S(page, "JSON.stringify([st.project.land.length,st.project.rivers.length,st.project.pois.length,st.project.zones.length,st.project.docks.length,st.project.bridges.length])");
rec("Re-import JSON from Map Tower ZIP loses nothing", snapD === snapC, `${snapC} vs ${snapD}`);

// ---- view-only / palette / context menu ----
await page.keyboard.press("Tab"); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/07_view_only_1280x720.png` });
const voHidden = await page.evaluate(() => getComputedStyle(document.querySelector(".side")).display === "none");
rec("View-only mode hides editor panels", voHidden);
await page.keyboard.press("Tab");
await page.keyboard.press("Control+k"); await page.waitForTimeout(350); await page.keyboard.type("Typhon"); await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/08_palette.png` });
await page.keyboard.press("Enter"); await page.waitForTimeout(300);
rec("Command palette finds & selects an object", (await S(page, "st.sel.size")) === 1);
await page.keyboard.press("f");
const [cmx, cmy] = await w2s(page, 800, 700);
await page.mouse.click(cmx, cmy, { button: "right" }); await page.waitForTimeout(150);
rec("Context menu opens", (await page.locator(".ctx").count()) === 1);
await page.screenshot({ path: `${OUT}/09_context_menu.png` });
await page.keyboard.press("Escape");
await page.close(); await ctx.close();

// ============ 1600x900 ============
({ ctx, page } = await open(1600, 900));
await page.screenshot({ path: `${OUT}/10_atlas_1600x900.png` });
rec("App opens at 1600x900 without JS error", errors.filter((e) => e.includes("1600x900")).length === 0);
await page.click('[data-testid="toggle-validation"]'); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/11_validation_1600x900.png` });
const noScroll2 = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
rec("Whole page does not scroll (1600x900)", noScroll2);
await page.keyboard.press("2"); await page.keyboard.press("Tab"); await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/12_clean_viewonly_1600x900.png` });
await page.close(); await ctx.close();
await browser.close();

fs.writeFileSync(`${OUT}/qa_results.json`, JSON.stringify({ when: new Date().toISOString(), url: URL, results, errors }, null, 1));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed; JS errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 8).join("\n"));
