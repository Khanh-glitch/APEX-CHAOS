// Final evidence screenshots for the Greywater POI Detail Layer pilot.
// Real Chromium (headless), 1× device scale; captures the app, the studio in
// edit mode, play mode (spawn / interior / well / notice / lantern) and edits.
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "node:fs";

const OUT = "/home/user/APEX-CHAOS/soh-greywater-pilot/qa/shots";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
  headless: true,
  defaultViewport: { width: 1680, height: 1050, deviceScaleFactor: 1 },
  env: { ...process.env, LD_LIBRARY_PATH: "/home/user/browsertest/al2023/lib" },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 120000 });
await page.waitForSelector(".soh");
await sleep(2000);
await page.screenshot({ path: OUT + "/60_map_app_with_entry.png" });

await page.evaluate(() => document.querySelector('[data-testid="open-detail"]').click());
await page.waitForSelector('[data-testid="detail-canvas"]');
await sleep(1200);
await page.screenshot({ path: OUT + "/61_studio_edit_1x.png" });
const cv = await page.$('[data-testid="detail-canvas"]');
await cv.screenshot({ path: OUT + "/62_village_1x.png" });

// select the hall for the inspector
const rect = await page.$eval('[data-testid="detail-canvas"]', (c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const zoom = Math.round(rect.w / 784);
const at = (x, y) => ({ x: rect.x + (x + 4) * 16 * zoom, y: rect.y + (y + 4) * 16 * zoom });
const hall = await page.evaluate(() => { const b = window.__greywater.plan.buildings.find((q) => q.id === "b_hall"); return { x: b.x, y: b.y, w: b.w, h: b.h }; });
let p = at(hall.x + 3, hall.y + 2);
await page.mouse.click(p.x, p.y);
await sleep(500);
await page.screenshot({ path: OUT + "/63_studio_selected_building.png" });

// drag the selected building by one tile
p = at(hall.x + hall.w / 2, hall.y + hall.h / 2);
await page.mouse.move(p.x, p.y);
await page.mouse.down();
await page.mouse.move(p.x + 16 * zoom, p.y, { steps: 10 });
await page.mouse.up();
await sleep(500);
await page.screenshot({ path: OUT + "/64_studio_drag_override.png" });
await page.click('[data-testid="undo"]');
await sleep(400);

// play mode
await page.click('[data-testid="tab-play"]');
await sleep(900);
await page.screenshot({ path: OUT + "/65_play_spawn.png" });

await page.evaluate(() => {
  const g = window.__greywater;
  const b = g.plan.buildings.find((q) => q.id === "b_hall");
  g.teleport(b.door.x + 0.5, b.door.y - 0.4);
});
await sleep(900);
await page.screenshot({ path: OUT + "/66_play_inside_roof_fade.png" });

await page.evaluate(() => {
  const g = window.__greywater;
  const p = g.plan.props.find((q) => q.interact && q.interact.kind === "well");
  g.teleport(p.x + 0.9, p.y + 0.7);
});
await sleep(600);
await page.keyboard.press("e");
await sleep(180);
await page.screenshot({ path: OUT + "/67_play_well_feedback.png" });

await page.evaluate(() => {
  const g = window.__greywater;
  const p = g.plan.props.find((q) => q.interact && q.interact.kind === "notice");
  g.teleport(p.x + 0.8, p.y + 0.7);
});
await sleep(500);
await page.keyboard.press("e");
await sleep(500);
await page.screenshot({ path: OUT + "/68_play_notice_modal.png" });
await page.click('[data-testid="notice-close"]');
await sleep(300);

await page.evaluate(() => {
  const g = window.__greywater;
  const p = g.plan.props.find((q) => q.interact && q.interact.kind === "lantern");
  g.teleport(p.x + 0.9, p.y + 0.8);
});
await sleep(500);
await page.keyboard.press("e");
await sleep(400);
await page.keyboard.down("ArrowDown");
await sleep(500);
await page.keyboard.up("ArrowDown");
await sleep(500);
await page.screenshot({ path: OUT + "/69_play_lantern_street.png" });
await page.keyboard.press("Escape");
await sleep(700);

// export the detail record + the whole project to disk as evidence
const dump = await page.evaluate(() => {
  const st = window.__greywater.st;
  const d = st.getDetail("po_greywater");
  const proj = st.project;
  const clone = { ...proj, terrain: { ...proj.terrain } };
  return { detail: JSON.stringify(d), project: JSON.stringify({ format: "soh-maplab", version: 1, project: clone }) };
});
fs.writeFileSync(OUT + "/greywater_poi_detail.json", dump.detail);
fs.writeFileSync(OUT + "/saved_project_with_detail.json", dump.project);
await browser.close();
console.log("shots done", fs.readdirSync(OUT).length);
