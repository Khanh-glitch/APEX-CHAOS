// Issue #105 BEFORE/AFTER evidence capture (real Chromium, real app, no mockups).
// Usage: APEX_APP_URL=http://127.0.0.1:5176/ node tools/issue105/capture-gallery.mjs before
//        APEX_APP_URL=http://127.0.0.1:5175/ node tools/issue105/capture-gallery.mjs after
// Writes PNGs into evidence/issue-105/gallery/<label>/ (label = before | after) and a receipts JSON.
// Captures: Missions and Mastery (desktop 1440x900, phone 390x844), Fighter Pick (BOT), menu toast control,
// and a live battle with a provisional achievement event (toast count recorded, screenshot taken).
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, openApp, startBotBattle, wait } from './harness.mjs';

const label = process.argv[2] || process.env.GALLERY_LABEL || 'after';
if (!['before', 'after'].includes(label)) throw new Error('label must be before or after');
const OUT = path.resolve(process.env.GALLERY_OUT || `evidence/issue-105/gallery/${label}`);
await mkdir(OUT, { recursive: true });
const receipts = { label, url: process.env.APEX_APP_URL || null, shots: [], notes: [] };
const shot = async (page, name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  receipts.shots.push(name);
  return file;
};
const emit = (page, type) => page.evaluate((t) => {
  const unlock = { achievementId: 'first-blood', heroId: 'SHURI', at: Date.now(), value: 1, ownerSide: 'P1', battleMode: 'BOT', provisional: t === 'apex:mastery-provisional' };
  window.dispatchEvent(new CustomEvent(t, { detail: { unlocks: [unlock], provisional: [unlock], source: 'live-match-provisional' } }));
}, type);
const toastCount = (page) => page.evaluate(() => document.querySelectorAll('.apex-achievement-toast').length);

const browser = await launchBrowser();
try {
  // 1. Missions and Mastery, desktop and phone.
  for (const v of [{ name: 'desktop-1440x900', w: 1440, h: 900, mobile: false }, { name: 'phone-390x844', w: 390, h: 844, mobile: true }]) {
    const { page, context } = await openApp(browser, { width: v.w, height: v.h, mobile: v.mobile, storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await page.click('#apexMissionsOpen');
    await page.waitForSelector('.apex-progress-panel', { timeout: 15000 });
    await wait(900);
    await shot(page, `missions-${v.name}`);
    await page.evaluate(() => [...document.querySelectorAll('.apex-progress-panel button')].find((b) => /MASTERY/i.test(b.textContent || ''))?.click());
    await wait(900);
    await shot(page, `mastery-${v.name}`);
    await context.close();
  }

  // 2. Fighter Pick (BOT), desktop, before any lock.
  {
    const { page, context } = await openApp(browser, { width: 1440, height: 900, storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await page.waitForSelector('#freeBattle', { timeout: 90000 });
    await page.click('#freeBattle');
    await page.waitForFunction(() => document.querySelector('#modeSelectScreen')?.getAttribute('aria-hidden') === 'false', { timeout: 60000 }).catch(() => {});
    await wait(900);
    await page.click('.modeCard[data-mode="bot"]');
    await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-fighter'), { timeout: 60000 });
    await wait(1200);
    await shot(page, 'pick-bot-desktop-1440x900');
    await context.close();
  }

  // 3. Menu toast control (the same event SHOULD show a toast on the menu), then a live battle (must not).
  {
    const { page, context } = await openApp(browser, { width: 390, height: 844, mobile: true, lang: 'eng', storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await page.waitForSelector('#freeBattle', { timeout: 90000 });
    await wait(600);
    await emit(page, 'apex:mastery-provisional');
    await wait(500);
    receipts.menuToastCount = await toastCount(page);
    await shot(page, 'menu-control-toast-phone-390x844');
    await page.waitForFunction(() => document.querySelectorAll('.apex-achievement-toast').length === 0, { timeout: 30000 }).catch(() => {});
    await wait(600);
    await startBotBattle(page, {});
    await page.waitForFunction(() => window.APEX_ARSENAL?.state?.active === true, { timeout: 90000 });
    await emit(page, 'apex:mastery-provisional');
    await emit(page, 'apex:mastery-unlocked');
    await wait(1500);
    receipts.liveBattleToastCount = await toastCount(page);
    await shot(page, `battle-live-phone-390x844-toast-${receipts.liveBattleToastCount}`);
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(OUT, 'receipts.json'), JSON.stringify(receipts, null, 2));
  console.log('GALLERY', JSON.stringify({ label, out: OUT, shots: receipts.shots.length, menuToastCount: receipts.menuToastCount, liveBattleToastCount: receipts.liveBattleToastCount }));
}
