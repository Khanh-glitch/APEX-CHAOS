import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { startServer } from '../perf/goldNestedServer.mjs';
import { enterMatch } from '../perf/enterMatch.js';

const OUT = '/tmp/ab';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ root: '../../dist-itch-html5' });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(mode, p1, p2, tag, fireSkills = true) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(`(()=>{try{localStorage.setItem('apexChaos.arsenalMeta.v1',JSON.stringify({version:1,ownedFighters:['ROBOT','HUNTER','CRYSTAL','MAGNET','ICE','MIRROR','BOXE','SHURI'],unlockedAt:{}}))}catch(e){}})();`);
  await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
  await page.evaluate(() => document.getElementById('apex-boot-start').click());
  await page.waitForSelector('#freeBattle', { visible: true, timeout: 150000 });
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => { const no = document.getElementById('apex-tutorial-ask-no'); if (no) { no.click(); return true; } return !document.querySelector('.fpGuide'); });
    if (done) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate((m) => { window.APEX_GRAPHICS_QUALITY?.set(m, 'ab-test'); }, mode);
  await new Promise(r => setTimeout(r, 400));
  await enterMatch(page, { p1, p2, mode: 'local1v1' });
  await new Promise(r => setTimeout(r, 1400));
  if (fireSkills) {
    for (let k = 0; k < 7; k++) {
      await page.evaluate(() => { const a = window.APEX_GOLD; try { a.pressSkill(0,0); a.pressSkill(0,1); } catch(e){} });
      await new Promise(r => setTimeout(r, 320));
    }
  }
  await new Promise(r => setTimeout(r, 260));
  const modeNow = await page.evaluate(() => ({ mode: window.APEX_GRAPHICS_QUALITY?.mode, diag: window.APEX_GRAPHICS_MODE_RUNTIME?.diagnose?.() }));
  await page.screenshot({ path: `${OUT}/${tag}-${mode}.png` });
  await page.close();
  return { tag, mode, errs: errs.slice(0, 3), ...modeNow };
}

const results = [];
for (const [p1, p2, tag] of [['crystala', 'frost', 'crystala-frost'], ['boxe', 'frost', 'boxe-frost'], ['shuri', 'crystala', 'shuri-crystala']]) {
  for (const mode of ['high', 'performance']) {
    results.push(await shot(mode, p1, p2, tag));
  }
}
const home = await browser.newPage();
await home.close();
console.log(JSON.stringify(results, null, 1));
await browser.close(); srv.server.close();
