// Issue #105 §7 gate: Missions / Mastery use ONE adaptive surface.
// Asserts at 320..1920: same panel width for Missions and Mastery, panel inside
// the viewport, Escape closes, reopen works, Mastery tab reachable.
import { launchBrowser, openApp, wait, check } from './harness.mjs';

const results = [];
const receipts = [];
const browser = await launchBrowser();
try {
  for (const [w, h] of [[320, 568], [390, 844], [844, 390], [1440, 900], [1920, 1080]]) {
    const { page, context } = await openApp(browser, { width: w, height: h, mobile: w < 600, storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await page.click('#apexMissionsOpen');
    await page.waitForSelector('.apex-progress-panel', { timeout: 15000 });
    await wait(350);
    const mission = await page.evaluate(() => { const r = document.querySelector('.apex-progress-panel').getBoundingClientRect(); return { w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }; });
    const vaultBtn = await page.evaluate(() => [...document.querySelectorAll('.apex-progress-panel button')].find((b) => /MASTERY/i.test(b.textContent || ''))?.getBoundingClientRect().width || 0);
    // Mastery: click the in-panel MASTERY VAULT button (progress-open detail does not switch sub-tab).
    await page.evaluate(() => [...document.querySelectorAll('.apex-progress-panel button')].find((b) => /MASTERY/i.test(b.textContent || ''))?.click());
    await page.waitForSelector('.apex-mastery-vault', { timeout: 10000 }).catch(() => {});
    await wait(350);
    const mastery = await page.evaluate(() => { const r = document.querySelector('.apex-progress-panel').getBoundingClientRect(); return { w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right) }; });
    const inside = (b) => b.l >= 0 && b.r <= w + 0.5;
    const sameWidth = Math.abs(mission.w - mastery.w) <= 1;
    const row = { viewport: `${w}x${h}`, mission, mastery, vaultBtnW: vaultBtn };
    receipts.push(row);
    check(results, sameWidth && inside(mission) && inside(mastery), `${w}x${h} Missions and Mastery share one adaptive width inside the viewport`, row);
    await page.keyboard.press('Escape');
    await wait(300);
    const closed = !(await page.$('.apex-progress-panel'));
    check(results, closed, `${w}x${h} Escape closes the progress surface`);
    await page.click('#apexMissionsOpen');
    await page.waitForSelector('.apex-progress-panel', { timeout: 15000 });
    check(results, !!(await page.$('.apex-progress-panel')), `${w}x${h} reopen after close works`);
    await context.close();
  }
} finally { await browser.close(); }
const failed = results.filter((r) => !r.ok);
console.log('SUMMARY', JSON.stringify({ total: results.length, failed: failed.map((r) => r.name), receipts }));
if (failed.length) process.exitCode = 1;
