// Issue #105 owner rejection R2, P0-D: no mission/achievement popup while a battle is live.
// Real Chromium, real first-use route. The live-match feed uses the same ledger event the
// battle runtime emits (apex:mastery-provisional, source live-match-provisional).
// Control: the same event on the menu MUST show the toast, so a pass is not vacuous.
// Pre-fix behaviour: the toast appears during the battle, and this gate fails.
import { launchBrowser, openApp, startBotBattle, wait, check } from './harness.mjs';

const results = [];
const browser = await launchBrowser();
const emit = (page, type) => page.evaluate((t) => {
  const unlock = { achievementId: 'first-blood', heroId: 'SHURI', at: Date.now(), value: 1, ownerSide: 'P1', battleMode: 'BOT', provisional: t === 'apex:mastery-provisional' };
  window.dispatchEvent(new CustomEvent(t, { detail: { unlocks: [unlock], provisional: [unlock], source: 'live-match-provisional' } }));
}, type);
const toastCount = (page) => page.evaluate(() => document.querySelectorAll('.apex-achievement-toast').length);
try {
  for (const v of [{ w: 390, h: 844, mobile: true }, { w: 1440, h: 900, mobile: false }]) {
    const id = `${v.w}x${v.h}`;
    const { page, context, errors } = await openApp(browser, { width: v.w, height: v.h, mobile: v.mobile, lang: 'eng', storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await page.waitForSelector('#freeBattle', { timeout: 90000 });
    await wait(600);
    await emit(page, 'apex:mastery-provisional');
    await wait(900);
    const menuControl = await toastCount(page);
    check(results, menuControl > 0, `${id} control: a provisional feed event on the menu shows the toast`, { menuControl });
    // Let the control toast leave on its own timer. Never remove React-owned nodes by hand.
    await page.waitForFunction(() => document.querySelectorAll('.apex-achievement-toast').length === 0, { timeout: 30000 });
    await startBotBattle(page, {});
    await page.waitForFunction(() => window.APEX_ARSENAL?.state?.active === true, { timeout: 90000 });
    await emit(page, 'apex:mastery-provisional');
    await emit(page, 'apex:mastery-unlocked');
    await wait(1500);
    const live = await toastCount(page);
    check(results, live === 0, `${id} live battle: no mission/achievement toast is presented`, { liveToastCount: live });
    const pageErrors = errors.filter((e) => e.startsWith('pageerror'));
    check(results, pageErrors.length === 0, `${id} zero uncaught page errors`, { errors: pageErrors.slice(0, 3) });
    await context.close();
  }
} finally { await browser.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`SUMMARY ${JSON.stringify({ total: results.length, failed: failed.map((r) => r.name) })}`);
if (failed.length) process.exit(1);
