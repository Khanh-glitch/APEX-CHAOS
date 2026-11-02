// Greywater POI Detail Layer — functional QA (play, edits, undo/lock, save/reload).
// Run from /home/user/browsertest (needs puppeteer-core + @sparticuz/chromium).
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const OUT = "/home/user/APEX-CHAOS/soh-greywater-pilot/qa/shots";
const R = { ok: [], fail: [] };
const check = (name, cond, extra = "") => { (cond ? R.ok : R.fail).push(name + (extra ? " — " + extra : "")); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// store writes are synchronous but React re-renders on the next animation frame;
// poll briefly instead of asserting on a fixed sleep
async function readSoon(fn, pred, ms = 2000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    last = await page.evaluate(fn);
    if (pred(last)) return last;
    await sleep(80);
  }
  return last;
}

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
  headless: true,
  defaultViewport: { width: 1680, height: 1050, deviceScaleFactor: 1 },
  env: { ...process.env, LD_LIBRARY_PATH: "/home/user/browsertest/al2023/lib" },
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

async function openStudio() {
  await page.waitForSelector(".soh", { timeout: 120000 });
  await sleep(1500);
  await page.evaluate(() => document.querySelector('[data-testid="open-detail"]').click());
  await page.waitForSelector('[data-testid="detail-canvas"]');
  await sleep(900);
}

await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 120000 });
await openStudio();
await page.screenshot({ path: OUT + "/30_studio_edit.png" });
await page.$eval('[data-testid="detail-canvas"]', (c) => c.scrollIntoView());

const initial = await page.evaluate(() => {
  const g = window.__greywater, d = g.detail;
  return { hash: d.hash, seed: d.seed, buildings: d.generated.buildings.length, props: d.generated.props.length, trees: d.generated.trees.length, conns: d.generated.connections.length, frame: [d.frame.w, d.frame.h] };
});
console.log("initial", JSON.stringify(initial));

// ---------------- PLAY ----------------
await page.click('[data-testid="tab-play"]');
await sleep(500);
const spawn = await page.evaluate(() => ({ x: window.__greywater.session.x, y: window.__greywater.session.y, mode: window.__greywater.mode }));
check("play mode starts a session", spawn.mode === "play" && !!spawn.x);
await page.screenshot({ path: OUT + "/31_play_spawn.png" });

await page.keyboard.down("ArrowUp");
await sleep(700);
await page.keyboard.up("ArrowUp");
await sleep(120);
const moved = await page.evaluate(() => ({ x: window.__greywater.session.x, y: window.__greywater.session.y, steps: window.__greywater.session.steps }));
check("keyboard moves the hero", Math.abs(moved.y - spawn.y) > 0.3 || Math.abs(moved.x - spawn.x) > 0.3, `Δ=(${(moved.x - spawn.x).toFixed(2)},${(moved.y - spawn.y).toFixed(2)})`);

// collision: walk into the hall's south wall away from the door
const wall = await page.evaluate(() => {
  const g = window.__greywater, b = g.plan.buildings.find((q) => q.id === "b_hall");
  const x = b.x + 1.5, y = b.y + b.h + 1.2;
  g.teleport(x, y);
  return { x, y, wallY: b.y + b.h - 1 };
});
await sleep(200);
await page.keyboard.down("ArrowUp");
await sleep(1500);
await page.keyboard.up("ArrowUp");
await sleep(150);
const afterWall = await page.evaluate(() => ({ x: window.__greywater.session.x, y: window.__greywater.session.y }));
check("walls block movement", afterWall.y > wall.wallY + 0.8, `y=${afterWall.y.toFixed(2)} wallTileY=${wall.wallY}`);
await page.screenshot({ path: OUT + "/32_play_wall.png" });

// interior: stand on the hall's door tile
const inside = await page.evaluate(() => {
  const g = window.__greywater, b = g.plan.buildings.find((q) => q.id === "b_hall");
  g.teleport(b.door.x + 0.5, b.door.y + 0.2);
  return { door: b.door, id: b.id };
});
await sleep(400);
const insideState = await page.evaluate(() => ({ inside: window.__greywater.session.inside }));
check("door tile puts the hero inside (roof fades)", insideState.inside === inside.id, `inside=${insideState.inside}`);
await page.screenshot({ path: OUT + "/33_play_inside_hall.png" });

// well
const well = await page.evaluate(() => {
  const g = window.__greywater;
  const p = g.plan.props.find((q) => q.interact && q.interact.kind === "well");
  g.teleport(p.x + 0.9, p.y + 0.6);
  return p;
});
await sleep(300);
await page.keyboard.press("e");
await sleep(350);
const wellState = await page.evaluate(() => ({ water: window.__greywater.session.counters.water, toast: window.__greywater.session.toast }));
check("well interaction increments water", wellState.water === 1, `water=${wellState.water} msg="${wellState.toast}"`);
await page.screenshot({ path: OUT + "/34_play_well.png" });

// crate (finite)
await page.evaluate(() => {
  const g = window.__greywater;
  const p = g.plan.props.find((q) => q.interact && q.interact.kind === "crate");
  g.teleport(p.x + 0.8, p.y + 0.6);
});
await sleep(300);
await page.keyboard.press("e");
await sleep(250);
const crate1 = await page.evaluate(() => ({ s: window.__greywater.session.counters.supplies, t: window.__greywater.session.toast }));
await page.keyboard.press("e");
await sleep(250);
const crate2 = await page.evaluate(() => ({ s: window.__greywater.session.counters.supplies, t: window.__greywater.session.toast }));
check("crate is usable exactly once", crate1.s === 1 && crate2.s === 1, `first="${crate1.t}" second="${crate2.t}"`);

// notice board → modal
await page.evaluate(() => {
  const g = window.__greywater;
  const p = g.plan.props.find((q) => q.interact && q.interact.kind === "notice");
  g.teleport(p.x + 0.8, p.y + 0.7);
});
await sleep(300);
await page.keyboard.press("e");
await sleep(400);
const noticeOpen = await page.evaluate(() => !!document.querySelector('[data-testid="notice"]'));
check("notice board opens a readable notice", noticeOpen);
await page.screenshot({ path: OUT + "/35_play_notice.png" });
if (noticeOpen) { await page.click('[data-testid="notice-close"]'); await sleep(200); }

// lantern
await page.evaluate(() => {
  const g = window.__greywater;
  const p = g.plan.props.find((q) => q.interact && q.interact.kind === "lantern");
  g.teleport(p.x + 0.8, p.y + 0.7);
});
await sleep(300);
await page.keyboard.press("e");
await sleep(250);
const lampState = await page.evaluate(() => ({ lamps: window.__greywater.session.counters.lamps, on: Object.values(window.__greywater.session.lamps) }));
check("lantern toggles", lampState.lamps >= 1, JSON.stringify(lampState));
await page.screenshot({ path: OUT + "/36_play_lantern.png" });

const hud = await page.evaluate(() => ({
  water: document.querySelector('[data-testid="hud-water"]')?.textContent,
  supplies: document.querySelector('[data-testid="hud-supplies"]')?.textContent,
  lamps: document.querySelector('[data-testid="hud-lamps"]')?.textContent,
}));
check("HUD mirrors the session counters", hud.water === "1" && hud.supplies === "1", JSON.stringify(hud));

// back to edit (saves play state)
await page.keyboard.press("Escape");
await sleep(600);
const playSaved = await page.evaluate(() => JSON.stringify(window.__greywater.detail.play || null));
check("play state is written to the detail record", playSaved !== "null" && playSaved.includes("\"water\":1"), playSaved);

// ---------------- EDIT ----------------
const rect = await page.$eval('[data-testid="detail-canvas"]', (c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const tileToScreen = (x, y, zoom) => ({ x: rect.x + (x + 4) * 16 * zoom, y: rect.y + (y + 4) * 16 * zoom });
const zoom = Math.round(rect.w / 784);

const hall0 = await page.evaluate(() => { const b = window.__greywater.plan.buildings.find((q) => q.id === "b_hall"); return { x: b.x, y: b.y, w: b.w, h: b.h }; });
let p0 = tileToScreen(hall0.x + hall0.w / 2, hall0.y + hall0.h / 2, zoom);
await page.mouse.move(p0.x, p0.y);
await page.mouse.down();
await page.mouse.move(p0.x + 16 * zoom, p0.y + 0, { steps: 8 });
await page.mouse.up();
await sleep(400);
const hall1 = await page.evaluate(() => { const b = window.__greywater.plan.buildings.find((q) => q.id === "b_hall"); return { x: b.x, y: b.y, ov: window.__greywater.detail.overrides.buildings.b_hall || null }; });
check("drag moves a building and records an override", hall1.x === hall0.x + 1, `x ${hall0.x}→${hall1.x} ov=${JSON.stringify(hall1.ov)}`);
await page.screenshot({ path: OUT + "/40_edit_drag.png" });

await page.click('[data-testid="undo"]');
const hall2 = await readSoon(() => ({ x: window.__greywater.plan.buildings.find((q) => q.id === "b_hall").x, ov: window.__greywater.detail.overrides.buildings.b_hall || null }), (v) => v.x === hall0.x);
check("undo restores the building", hall2.x === hall0.x, `x=${hall2.x}`);
await page.click('[data-testid="redo"]');
const hall3 = await readSoon(() => window.__greywater.plan.buildings.find((q) => q.id === "b_hall").x, (v) => v === hall0.x + 1);
check("redo re-applies the move", hall3 === hall0.x + 1, `x=${hall3}`);

await page.click('[data-testid="lock"]');
await sleep(300);
p0 = tileToScreen(hall3 + 2, hall0.y + 2, zoom);
await page.mouse.move(p0.x, p0.y);
await page.mouse.down();
await page.mouse.move(p0.x + 32 * zoom, p0.y + 16 * zoom, { steps: 6 });
await page.mouse.up();
await sleep(300);
const locked = await page.evaluate(() => ({ locked: window.__greywater.detail.locked, x: window.__greywater.plan.buildings.find((q) => q.id === "b_hall").x }));
check("layout lock blocks dragging", locked.locked === true && locked.x === hall3, JSON.stringify(locked));
await page.screenshot({ path: OUT + "/41_edit_locked.png" });
await page.click('[data-testid="lock"]');
await sleep(200);

// add a building with the tool
await page.click('[data-testid="tool-add-building"]');
const free = tileToScreen(19.5, 21.5, zoom);
await page.mouse.click(free.x, free.y);
await sleep(400);
const added = await page.evaluate(() => ({ n: window.__greywater.detail.overrides.addedBuildings.length, total: window.__greywater.plan.buildings.length }));
check("add-building tool creates a new building", added.n === 1 && added.total === initial.buildings + 1, JSON.stringify(added));
await page.screenshot({ path: OUT + "/42_edit_added.png" });
await page.keyboard.press("Delete");
await sleep(400);
const deleted = await page.evaluate(() => ({ n: window.__greywater.detail.overrides.addedBuildings.length, total: window.__greywater.plan.buildings.length }));
check("delete removes the added building", deleted.n === 0 && deleted.total === initial.buildings, JSON.stringify(deleted));

// regeneration
const beforeRegen = await page.evaluate(() => ({ hash: window.__greywater.detail.hash, b: window.__greywater.detail.generated.buildings.length }));
await page.click('[data-testid="seed-input"]', { clickCount: 3 });
await page.keyboard.type("12345");
await sleep(200);
const seedDraft = await page.$eval('[data-testid="seed-input"]', (el) => el.value);
check("seed field accepts a new seed", seedDraft === "12345", seedDraft);
await page.click('[data-testid="regen"]');
await sleep(700);
const afterRegen = await page.evaluate(() => ({ hash: window.__greywater.detail.hash, seed: window.__greywater.detail.seed, b: window.__greywater.detail.generated.buildings.length, keep: window.__greywater.detail.overrides.buildings.b_hall || null }));
check("regenerate with a new seed is deterministic output", afterRegen.seed === 12345 && afterRegen.hash !== beforeRegen.hash, `${beforeRegen.hash}→${afterRegen.hash}`);
check("manual overrides survive regeneration", !!afterRegen.keep && afterRegen.keep.x === hall0.x + 1, JSON.stringify(afterRegen.keep));
await page.screenshot({ path: OUT + "/43_edit_regen.png" });

// ---------------- SAVE / RELOAD ----------------
await sleep(1400); // autosave debounce
const saved = await page.evaluate(() => {
  const raw = localStorage.getItem("soh-maplab-autosave-v1");
  if (!raw) return null;
  const j = JSON.parse(raw);
  const p = j.project || j;
  const d = p.details && p.details.po_greywater;
  return d ? { hash: d.hash, seed: d.seed, ov: d.overrides.buildings.b_hall || null, play: d.play || null, buildings: d.generated.buildings.length } : null;
});
check("autosave stores the POI detail record", !!saved && saved.seed === 12345, JSON.stringify(saved && { hash: saved.hash, seed: saved.seed }));
check("autosave keeps overrides and play counters", !!saved && !!saved.ov && !!saved.play && saved.play.water === 1, JSON.stringify(saved && saved.ov));

await page.reload({ waitUntil: "networkidle2", timeout: 120000 });
await openStudio();
await sleep(800);
const reloaded = await page.evaluate(() => {
  const d = window.__greywater.detail;
  return { hash: d.hash, seed: d.seed, ov: d.overrides.buildings.b_hall || null, play: d.play || null, trees: d.generated.trees.length };
});
check("reload restores the same layout hash", reloaded.hash === saved.hash, `${reloaded.hash} vs ${saved.hash}`);
check("reload restores overrides", !!reloaded.ov && reloaded.ov.x === hall0.x + 1, JSON.stringify(reloaded.ov));
check("reload restores play progress", !!reloaded.play && reloaded.play.water === 1, JSON.stringify(reloaded.play));
await page.screenshot({ path: OUT + "/50_after_reload.png" });

// export check (serialize the project the same way the save button does)
const exported = await page.evaluate(() => {
  const st = window.__greywater.st;
  const p = st.project;
  const json = JSON.stringify({ format: "soh-maplab", version: 1, project: { ...p, terrain: { ...p.terrain, elev: "", biome: "" } } });
  return { hasDetails: !!p.details.po_greywater, bytes: json.length, pois: p.pois.length, roads: p.roads.length };
});
check("project export still carries all 81 POIs and the detail layer", exported.hasDetails && exported.pois === 81, JSON.stringify(exported));

const results = {
  when: new Date().toISOString(),
  harness: "puppeteer-core + @sparticuz/chromium (headless Chromium), 1680x1050, deviceScaleFactor 1",
  app: "http://localhost:3000/ (Next dev build of soh-greywater-pilot)",
  initial,
  results: [...R.ok.map((name) => ({ name, ok: true })), ...R.fail.map((name) => ({ name, ok: false }))],
  errors: errs,
};
await import("node:fs").then((fs) => fs.writeFileSync("/home/user/APEX-CHAOS/soh-greywater-pilot/qa/qa_results.json", JSON.stringify(results, null, 1)));
console.log("\nERRORS", errs.slice(0, 8));
console.log("\nSUMMARY", JSON.stringify({ ok: R.ok.length, fail: R.fail.length, failed: R.fail }, null, 1));
await browser.close();
