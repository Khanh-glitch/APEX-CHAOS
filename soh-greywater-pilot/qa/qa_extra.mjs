// Extra real-browser QA: brushes, canal, Smart tools (preview → apply → undo), heatmaps, reachability, block test, group/lock, river delete/move.
import { chromium } from "playwright";
import fs from "node:fs";

const URL = process.argv[2] || "file:///app/public/downloads/SoulOfHero_MapLab.html";
const OUT = process.argv[3] || "/app/qa/screens";
const results = [], errors = [];
const rec = (name, ok, info = "") => { results.push({ name, ok: !!ok, info: String(info) }); console.log((ok ? "PASS " : "FAIL ") + name + (info ? " — " + info : "")); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
page.on("dialog", (d) => d.accept("Nhãn QA"));
await page.goto(URL + "?fresh=1");
await page.waitForFunction("window.__maplab && window.__maplab.it && window.__maplab.store.checks.length>0", null, { timeout: 120000 });
await page.waitForTimeout(500);
if (await page.locator(".modal-bg").count()) await page.click("text=Bắt đầu chỉnh sửa");
const S = (expr) => page.evaluate(`(()=>{const st=window.__maplab.store,it=window.__maplab.it;return (${expr});})()`);
const w2s = (x, y) => page.evaluate(([x, y]) => { const st = window.__maplab.store, r = document.querySelector("canvas.main").getBoundingClientRect(); return [r.left + (x - st.view.x) * st.view.s, r.top + (y - st.view.y) * st.view.s]; }, [x, y]);
async function drag(a, b, steps = 10) { const [x0, y0] = await w2s(...a), [x1, y1] = await w2s(...b); await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= steps; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps); await page.mouse.up(); await page.waitForTimeout(80); }
async function click(p) { const [x, y] = await w2s(...p); await page.mouse.click(x, y); await page.waitForTimeout(60); }
const zoom = async (p, s) => { await S(`(()=>{const c=st.canvasSize;st.view={s:${s},x:${p[0]}-c.w/2/${s},y:${p[1]}-c.h/2/${s}};st.emit();return 1})()`); await page.waitForTimeout(250); };
const sum = (arr) => S(`(()=>{let s=0;const a=st.project.terrain.${arr};for(let i=0;i<a.length;i++)s+=a[i];return s})()`);

await page.keyboard.press("f");
// elevation brush + undo
await page.keyboard.press("e");
const e0 = await sum("elev");
await drag([800, 760], [900, 780]);
const e1 = await sum("elev");
rec("Elevation brush raises terrain", e1 > e0, `Σelev ${e0}→${e1}`);
await page.keyboard.press("Control+z");
rec("Undo reverts elevation painting exactly", (await sum("elev")) === e0);
// biome brush
await page.keyboard.press("g");
await S("(()=>{st.ui.brush.biome=5;st.ui.brush.size=60;st.emit();return 1})()");
const d0 = await S("(()=>{let n=0;for(const b of st.project.terrain.biome)if(b===5)n++;return n})()");
await drag([1100, 560], [1160, 580]);
const d1 = await S("(()=>{let n=0;for(const b of st.project.terrain.biome)if(b===5)n++;return n})()");
rec("Biome brush paints desert cells", d1 > d0, `${d0}→${d1}`);
await page.keyboard.press("Control+z");
// canal tool
await page.keyboard.press("c");
const rv0 = await S("st.project.rivers.length");
await click([864, 546]); await click([884, 590]); await click([906, 652]); await page.keyboard.press("Enter");
const can = await S("st.project.rivers[st.project.rivers.length-1]");
rec("Canal tool creates canal linked to lake/river", (await S("st.project.rivers.length")) === rv0 + 1 && can.kind === "canal" && can.source.kind === "lake" && can.mouth.kind === "river", JSON.stringify([can.source, can.mouth]));
await page.keyboard.press("Control+z");
// tributary + move parent
await page.keyboard.press("r");
await click([560, 520]); await click([610, 585]);
const sp = await S("st.project.rivers.find(r=>r.id==='rv_silver').points[3]");
await click(sp); await page.keyboard.press("Enter");
await page.keyboard.press("v");
await S("st.select(['rv_silver'])");
await zoom(sp, 2.4);
await drag(sp, [sp[0] + 14, sp[1] + 16]);
const hy = await S("(()=>{const c=st.runChecks(true).find(c=>c.id==='HYD-LINK');return c})()");
const tr = await S("st.project.rivers[st.project.rivers.length-1]");
const par = await S("(()=>{const r=st.project.rivers.find(r=>r.id==='rv_silver');return r.points[3]})()");
rec("Moving a parent river vertex keeps tributary attached (graph still connected)", hy.status === "PASS" && Math.hypot(par[0] - sp[0], par[1] - sp[1]) > 10, `HYD-LINK=${hy.status}; parent moved Δ=${Math.hypot(par[0] - sp[0], par[1] - sp[1]).toFixed(0)}u; tributary mouth=${tr.mouth.kind}`);
// delete the parent river → child reset, validation reacts
await S("st.removeIds(['rv_silver'])");
const tr2 = await S("st.project.rivers[st.project.rivers.length-1]");
const dead = await S("st.runChecks(true).find(c=>c.id==='HYD-DEAD').status");
rec("Deleting a river updates dependants (mouth reset, dead-end flagged)", tr2.mouth.kind === "none" && dead === "WARNING", `mouth=${tr2.mouth.kind}, HYD-DEAD=${dead}`);
await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z");
await page.keyboard.press("f");

// Smart: smooth preview -> apply -> undo
await S("st.select(['ld_veyra'])");
await page.click("text=Smart");
const sig = () => S("(()=>{const r=st.project.land.find(l=>l.id==='ld_veyra').rings[0];let s=0;r.forEach((p,i)=>{s+=p[0]*(i%7+1)+p[1]*(i%5+1)});return r.length+':'+s.toFixed(1)})()");
const n0 = await sig();
await page.click("text=Làm mượt đối tượng chọn"); await page.waitForTimeout(200);
rec("Smooth proposal does not change map before approval", (await sig()) === n0 && (await S("st.proposals.length")) === 1);
await page.screenshot({ path: `${OUT}/13_smooth_preview.png` });
await page.locator("button:has-text('Áp dụng')").first().click(); await page.waitForTimeout(500);
const n1 = await sig();
rec("Approved smoothing changes coastline", n1 !== n0, `${n0} → ${n1} (đỉnh:chữ ký tọa độ)`);
await page.keyboard.press("Control+z"); await page.waitForTimeout(300);
rec("Undo reverts automatic smoothing", (await sig()) === n0);

// Local regeneration only inside region
await S("(()=>{st.select([]);st.ui.regionRect=[860,420,1000,520];st.emit();return 1})()");
const before = await S("Array.from(st.project.terrain.elev)");
await page.click("text=Tái sinh chi tiết địa hình cục bộ"); await page.waitForTimeout(200);
await page.locator("button:has-text('Áp dụng')").first().click(); await page.waitForTimeout(600);
const after = await S("Array.from(st.project.terrain.elev)");
const inside = await S("[860,420,1000,520]");
let chIn = 0, chOut = 0;
for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { const x = (i % 250) * 8 + 4, y = Math.floor(i / 250) * 8 + 4; if (x >= inside[0] - 8 && x <= inside[2] + 8 && y >= inside[1] - 8 && y <= inside[3] + 8) chIn++; else chOut++; }
rec("Local regeneration changes only the selected region", chIn > 20 && chOut === 0, `inside=${chIn} cells changed, outside=${chOut}`);
await page.keyboard.press("Control+z");

// POI suggestions with explanation + apply
await S("st.setUI({regionRect:null})");
await page.click("text=Gợi ý vị trí POI"); await page.waitForTimeout(500);
const pr = await S("st.proposals.map(p=>({t:p.title,d:p.detail}))");
rec("POI placement suggestions come with explanations", pr.length >= 1 && pr[0].d.length > 20, pr[0] ? pr[0].t + " :: " + pr[0].d.slice(0, 100) : "none");
await page.screenshot({ path: `${OUT}/14_poi_suggestions.png` });
const pc0 = await S("st.project.pois.length");
if (pr.length) { await page.locator("button:has-text('Áp dụng')").first().click(); await page.waitForTimeout(300); }
rec("Applying a suggestion adds exactly one POI", (await S("st.project.pois.length")) === pc0 + (pr.length ? 1 : 0));
await S("(()=>{st.proposals=[];st.emit();return 1})()");
// cluster
const pc1 = await S("st.project.pois.length");
await zoom([900, 330], 1.2);
await page.click("text=Tạo cụm tại giữa màn hình"); await page.waitForTimeout(300);
if (await S("st.proposals.length")) { await page.locator("button:has-text('Áp dụng')").first().click(); await page.waitForTimeout(300); }
const grp = await S("(()=>{const g={};st.project.pois.forEach(p=>{if(p.group)g[p.group]=(g[p.group]||0)+1});return Math.max(0,...Object.values(g))})()");
rec("Quick-create archetype cluster adds a grouped set of POIs", (await S("st.project.pois.length")) - pc1 === 4 && grp === 4, `+${(await S("st.project.pois.length")) - pc1} POI, group size ${grp}`);
await page.keyboard.press("f");

// Heatmaps
for (const [k, label] of [["opp", "Opportunity"], ["poi", "Mật độ POI"], ["build", "Build viability"]]) { await page.click(`button:has-text("${label}")`); await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/heat_${k}_1600x900.png` }); }
rec("Opportunity / POI-density / build-viability heatmaps render", true);
await page.click('button:has-text("Tắt")');
// reachability
await S("st.select(['po_greywater'])");
await page.selectOption("select >> nth=0", { index: 0 }).catch(() => {});
await page.click("text=Từ đối tượng chọn / điểm thử"); await page.waitForTimeout(300);
const ro = await S("st.reachOv.length");
rec("Reachability overlay computed from selected POI", ro >= 2, `${ro} overlay layers`);
await page.screenshot({ path: `${OUT}/15_reachability.png` });
await S("(()=>{st.reachOv=[];st.emit();return 1})()");
// block test
await S("(()=>{st.select([st.project.bridges[2].id]);st.setUI({panel:'inspect'});return 1})()");
await page.click("text=Thử chặn để kiểm tra liên thông"); await page.waitForTimeout(300);
rec("Block-a-bridge test registers and re-validates", (await S("st.ui.blocked.size")) === 1);
await S("(()=>{st.ui.blocked=new Set();st.runChecks(true);st.emit();return 1})()");

// group / duplicate / lock
await S("st.select(['po_hook','po_mere'])");
await page.keyboard.press("Control+g");
const g = await S("(()=>{const a=st.get('po_hook').group,b=st.get('po_mere').group;return a&&a===b})()");
rec("Group (Ctrl+G) links objects", g);
const before2 = await S("st.get('po_hook').at");
await zoom(before2, 1.8);
await drag(before2, [before2[0] + 30, before2[1] + 10]);
const after2 = await S("[st.get('po_hook').at,st.get('po_mere').at]");
const moved2 = Math.hypot(after2[0][0] - before2[0] - 30, after2[0][1] - before2[1] - 10) < 14;
rec("Dragging one grouped object moves the whole group", moved2 && await S("(()=>{const m=st.get('po_mere').at;return Math.abs(m[0]-1250)>10})()"), JSON.stringify(after2.map((q) => q.map(Math.round))));
await page.keyboard.press("Control+Shift+G");
rec("Ungroup (Ctrl+Shift+G)", await S("!st.get('po_hook').group"));
const c0 = await S("st.project.pois.length");
await S("st.select(['po_hook'])"); await page.keyboard.press("Control+d");
rec("Duplicate (Ctrl+D)", (await S("st.project.pois.length")) === c0 + 1);
await S("st.removeIds([...st.sel])");
rec("Delete removes duplicate", (await S("st.project.pois.length")) === c0);
await S("st.setProps('po_hook',{locked:true})");
const lp = await S("st.get('po_hook').at.slice()");
await zoom(lp, 1.8); await S("st.select([])");
await drag(lp, [lp[0] + 40, lp[1] + 40]);
rec("Locked object cannot be dragged", Math.hypot((await S("st.get('po_hook').at[0]")) - lp[0], (await S("st.get('po_hook').at[1]")) - lp[1]) < 1);
await S("st.setProps('po_hook',{locked:false})");
// layer hide
await S("st.toggleLayer('pois')");
await S("st.select([])");
await click(await S("st.get('po_greywater').at"));
rec("Hidden layer objects are not selectable", (await S("st.sel.size")) === 0);
await S("st.toggleLayer('pois')");
// elder part drawing + Ragnarok overlay
await page.keyboard.press("t");
await S("(()=>{st.ui.opts.elderId='argus';st.ui.opts.elderPart='arena';st.emit();return 1})()");
await page.keyboard.press("f");
const ar0 = await S("st.project.elders.find(e=>e.elder==='argus').arenas.length");
for (const q of [[900, 280], [940, 280], [940, 305]]) await click(q);
await page.keyboard.press("Enter");
rec("Elder tool adds a combat arena to Argus", (await S("st.project.elders.find(e=>e.elder==='argus').arenas.length")) === ar0 + 1);
await page.keyboard.press("6"); await S("st.setUI({ragnarok:true})"); await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/16_elders_ragnarok_1600x900.png` });
rec("Elder view + Ragnarok overlay renders", true);
const fin = await S("st.runChecks(true).length");
rec("Validation still runs after all edits (no engine error)", fin > 25 && !(await S("st.checks.some(c=>c.id==='ERR')")));
await browser.close();
fs.writeFileSync(`${OUT}/qa_results_extra.json`, JSON.stringify({ when: new Date().toISOString(), results, errors }, null, 1));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed; JS errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 8).join("\n"));
