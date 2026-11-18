import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
const out = process.argv[2] || "/tmp/chrome/shot";
const W = Number(process.argv[3] || 1568), H = Number(process.argv[4] || 878);
const exe = await chromium.executablePath();
const browser = await puppeteer.launch({ executablePath: exe, args: chromium.args, headless: true, defaultViewport: { width: W, height: H } });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push("PAGEERR: " + e.message.slice(0, 160)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const skipTx = () => page.evaluate(() => { try { window.APEX_SCENE_TRANSITION?.dispose?.(); } catch (e) {} const bo = document.getElementById('apex-boot-blackout'); if (bo) bo.style.display = 'none'; });
const clickSel = async (sel) => { const el = await page.$(sel); if (!el) return false; const bb = await el.boundingBox(); if (!bb || !bb.width) return false; await page.mouse.click(bb.x + bb.width/2, bb.y + bb.height/2); return true; };
const modeOpen = () => page.evaluate(() => document.getElementById('modeSelectScreen')?.getAttribute('aria-hidden') === 'false');
const fighterOpen = () => page.evaluate(() => document.getElementById('fighterSelectScreen')?.getAttribute('aria-hidden') === 'false');
await page.goto("http://127.0.0.1:4173/", { waitUntil: "load", timeout: 90000 });
// 1) boot door (WebGL2 unavailable headless) -> skip; START gate appears after a short delay.
let started = false;
for (let i = 0; i < 60 && !started; i++) { await sleep(500); await skipTx(); if (await page.$('#apex-boot-start')) { await sleep(600); started = await clickSel('#apex-boot-start'); } }
console.log('start clicked:', started);
// 2) wait for scene to settle, then Free Battle CTA
for (let i = 0; i < 30; i++) { await sleep(500); await skipTx(); if (await page.evaluate(() => !document.body.classList.contains('apex-scene-transition-active') && document.getElementById('stage')?.classList.contains('ready'))) break; }
await sleep(800);
await clickSel('#gold-shell-host #freeBattle');
for (let i = 0; i < 20 && !(await modeOpen()); i++) { await sleep(500); await skipTx(); }
console.log('mode open:', await modeOpen());
await sleep(1500); await page.screenshot({ path: out + '-mode.png' });
await clickSel('[data-mode="bot"]');
for (let i = 0; i < 20 && !(await fighterOpen()); i++) { await sleep(500); await skipTx(); }
console.log('fighter open:', await fighterOpen());
await sleep(1500); await page.screenshot({ path: out + '-fighter.png' });
console.log('errors:', errs.slice(0, 6));
await browser.close();
