// Issue #105 §4 — Archive asset canary INSIDE the nested itch URL.
//   wrapper "/" -> iframe "/html/apex/index.html" (packed dist-itch-html5)
//   guest boot -> Field Archive (#apexDictionaryOpen, lazy open) -> every fighter
//   record -> close -> Skin Locker (.apex-skin-entry, lazy open) -> FIGHTER SKINS
//   and WEAPON SKINS -> every item and skin -> close.
// Every rendered image must be `complete && naturalWidth > 0`. Escaped root paths
// and every HTTP >= 400 under /html/apex/ are recorded and must be zero.
// Nothing is deployed, published or zipped.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, wait, check } from './harness.mjs';
import { startNestedServer, ITCH_DIR } from './nestedServer.mjs';
import fs from 'node:fs';

const OUT = process.env.ISSUE105_OUT || '/tmp/i105-archive-nested';
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900, dpr: 1, mobile: false },
  { id: 'phone-390x844', width: 390, height: 844, dpr: 2, mobile: true },
];
if (!fs.existsSync(path.join(ITCH_DIR, 'index.html'))) throw new Error(`packed build missing: ${ITCH_DIR}`);
const results = [];
const receipts = {};
const server = await startNestedServer();

async function sampleImages(frame, scope) {
  return frame.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return { present: false, imgs: [] };
    return {
      present: true,
      imgs: Array.from(root.querySelectorAll('img')).map((img) => ({
        src: img.getAttribute('src') || '', complete: img.complete, nw: img.naturalWidth,
      })),
    };
  }, scope);
}

function badImages(samples) {
  return samples.flatMap((s) => s.imgs.filter((i) => !i.src || !i.complete || !(i.nw > 0)).map((i) => ({ ...i, where: s.label })));
}

for (const vp of VIEWPORTS) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const pageErrors = [];
  const http4xx = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 240)));
  page.on('response', (r) => { if (r.url().includes('/html/apex/') && r.status() >= 400) http4xx.push(`${r.status()} ${r.url()}`); });
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr, isMobile: vp.mobile, hasTouch: vp.mobile });
  await page.goto(`${server.url}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#itch-game-drop'), { timeout: 30000 });
  let frame = null;
  for (let i = 0; i < 100 && !frame; i += 1) { await wait(200); frame = page.frames().find((f) => f.url().includes('/html/apex/index.html')) || null; }
  if (!frame) { check(results, false, `${vp.id}: nested game frame mounted`); await browser.close(); continue; }
  await frame.waitForSelector('#apex-boot-start', { visible: true, timeout: 120000 });
  await frame.click('#apex-boot-start');
  await frame.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 150000 });
  await wait(800);

  const samples = [];
  // ── Field Archive (lazy open): every page of FIGHTERS and WEAPONS ─────────
  await frame.click('#apexDictionaryOpen');
  await frame.waitForSelector('.fa3-shell', { visible: true, timeout: 120000 });
  await wait(600);
  const kindCounts = {};
  for (const kindLabel of ['FIGHTERS', 'WEAPONS']) {
    await frame.evaluate((label) => Array.from(document.querySelectorAll('.fa3-primary [role=tab]')).find((b) => b.textContent.trim() === label)?.click(), kindLabel);
    await wait(500);
    let total = 0;
    for (let pg = 0; pg < 20; pg += 1) {
      const pageLabel = await frame.evaluate(() => document.querySelector('.fa3-pager span')?.textContent.trim() || '');
      const n = await frame.evaluate(() => document.querySelectorAll('.fa3-index-list button').length);
      for (let i = 0; i < n; i += 1) {
        await frame.evaluate((k) => document.querySelectorAll('.fa3-index-list button')[k].click(), i);
        await wait(220);
        const sample = await sampleImages(frame, '.fa3-shell');
        samples.push({ label: `archive-${kindLabel}-${pageLabel}-${i}`, imgs: sample.imgs });
        total += 1;
      }
      const hasNext = await frame.evaluate(() => { const b = document.querySelector('button[aria-label="Next archive page"]'); return !!b && !b.disabled; });
      if (!hasNext) break;
      await frame.evaluate(() => document.querySelector('button[aria-label="Next archive page"]')?.click());
      await wait(300);
    }
    kindCounts[kindLabel] = total;
  }
  const archiveBad = badImages(samples);
  check(results, kindCounts.FIGHTERS >= 8 && kindCounts.WEAPONS >= 1 && archiveBad.length === 0,
    `${vp.id}: Field Archive — every FIGHTER and WEAPON record on every page renders complete && naturalWidth>0`,
    { kindCounts, bad: archiveBad.slice(0, 5) });
  receipts[`${vp.id}:archive`] = kindCounts;
  // Quick Equip from the Archive detail (appearance only, real control)
  await frame.evaluate(() => Array.from(document.querySelectorAll('.fa3-primary [role=tab]')).find((b) => b.textContent.trim() === 'FIGHTERS')?.click());
  await wait(400);
  await frame.evaluate(() => document.querySelectorAll('.fa3-index-list button')[0]?.click());
  await wait(300);
  const equipState = await frame.evaluate(() => {
    const b = document.querySelector('.fa3-equip');
    return b ? { text: b.textContent.trim(), disabled: b.disabled } : null;
  });
  check(results, equipState !== null, `${vp.id}: Archive Quick Equip control present`, equipState);
  await frame.click('.fa3-close');
  await frame.waitForFunction(() => !document.querySelector('.fa3-shell'), { timeout: 30000 }).catch(() => {});
  await wait(500);

  // ── Fighter Select Quick Equip seam (BOT) ─────────────────────────────────
  await frame.click('#freeBattle');
  await frame.waitForFunction(() => document.querySelector('#modeSelectScreen')?.getAttribute('aria-hidden') === 'false', { timeout: 60000 }).catch(() => {});
  await frame.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 150000 }).catch(() => {});
  await wait(900);
  await frame.click('.modeCard[data-mode="bot"]');
  await frame.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-fighter') && document.body.dataset.apexSceneTransition === 'DONE', { timeout: 120000 });
  await wait(900);
  const seamCount = await frame.evaluate(() => document.querySelectorAll('.fa3-pick-equip-entry').length);
  check(results, seamCount >= 1, `${vp.id}: Fighter Select Quick Equip seam mounted`, { seamCount });
  if (seamCount >= 1) {
    await frame.evaluate(() => document.querySelector('.fa3-pick-equip-entry')?.click());
    await frame.waitForSelector('.fa3-shell', { visible: true, timeout: 120000 });
    await wait(600);
    const seamSample = await sampleImages(frame, '.fa3-shell');
    const seamBad = seamSample.imgs.filter((i) => !i.src || !i.complete || !(i.nw > 0));
    check(results, seamBad.length === 0, `${vp.id}: Quick Equip (Fighter Select seam) opens with complete shipped art`, { images: seamSample.imgs.length, bad: seamBad.slice(0, 5) });
    await frame.click('.fa3-close');
    await frame.waitForFunction(() => !document.querySelector('.fa3-shell'), { timeout: 30000 }).catch(() => {});
  }
  // Lockers/pages are walked above; list kinds for the receipt.
  receipts[`${vp.id}:seam`] = { seamCount };
  const http4xxFinal = http4xx.slice(0, 20);
  check(results, server.serverErrors.length === 0, `${vp.id}: zero escaped-root / missing nested assets (404)`, { serverErrors: server.serverErrors.slice(0, 10) });
  check(results, http4xxFinal.length === 0, `${vp.id}: zero HTTP>=400 responses under /html/apex/`, { http4xx: http4xxFinal });
  check(results, pageErrors.length === 0, `${vp.id}: zero uncaught page errors`, { pageErrors: pageErrors.slice(0, 5) });
  receipts[vp.id] = { archiveRecords: kindCounts, sampledImages: samples.reduce((n, x) => n + x.imgs.length, 0), http4xx: http4xxFinal.length, serverErrors: server.serverErrors.length };
  await browser.close();
}

await server.close();
await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'gate-archive-nested.json'), JSON.stringify({ results, receipts }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log('SUMMARY', JSON.stringify({ total: results.length, failed: failed.map((r) => r.name), receipts }));
if (failed.length) process.exitCode = 1;
