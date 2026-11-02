// QA pass 1 — open the POI Detail Studio and capture the pilot.
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const OUT = "/home/user/APEX-CHAOS/soh-greywater-pilot/qa/shots";
const exe = await chromium.executablePath();

const browser = await puppeteer.launch({
  executablePath: exe,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
  headless: true,
  defaultViewport: { width: 1680, height: 1050, deviceScaleFactor: 1 },
  env: { ...process.env, LD_LIBRARY_PATH: "/home/user/browsertest/al2023/lib" },
});
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 120000 });
await page.waitForSelector(".soh", { timeout: 120000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: OUT + "/00_map_app.png" });

// click the new toolbar entry
const hasBtn = await page.$('[data-testid="open-detail"]');
if (!hasBtn) throw new Error("open-detail button missing");
await page.click('[data-testid="open-detail"]');
await page.waitForSelector('[data-testid="detail-canvas"]', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

const info = await page.evaluate(() => {
  const g = window.__greywater;
  return {
    mode: g?.mode,
    plan: g?.plan ? { b: g.plan.buildings.length, p: g.plan.props.length, t: g.plan.trees.length, f: g.plan.fences.length, c: g.plan.connections.length, spawn: g.plan.spawn } : null,
    detail: g?.detail ? { seed: g.detail.seed, hash: g.detail.hash, edited: g.detail.edited, locked: g.detail.locked, frame: { w: g.detail.frame.w, h: g.detail.frame.h, rot: g.detail.frame.rot } } : null,
    canvas: (() => { const c = document.querySelector('[data-testid="detail-canvas"]'); return c ? { w: c.width, h: c.height, cw: c.getBoundingClientRect().width } : null; })(),
    named: g?.plan?.buildings.map((b) => b.name),
  };
});
console.log(JSON.stringify(info, null, 1));

await page.click('[data-testid="zoom-1"]');
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: OUT + "/01_studio_1x.png" });
await page.click('[data-testid="zoom-2"]');
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: OUT + "/02_studio_edit.png" });

console.log("errors:", errors);
await browser.close();
