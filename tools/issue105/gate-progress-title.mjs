// Issue #105 owner item: MASTERY VAULT must never show the Starter Contracts title.
// Real Chromium, real DOM. The panel is opened through its real public event
// ('apex:progress-open') with each tab, in EN and VIE, at phone and desktop sizes.
// Then Escape closes it and a reopen with the other tab must re-title correctly.
import { launchBrowser, openApp, wait, check } from './harness.mjs';

const VIEWPORTS = [[390, 844], [1440, 900]];
const COPY = {
  eng: { contracts: 'STARTER CONTRACTS', mastery: 'MASTERY VAULT' },
  vie: { contracts: 'HỢP ĐỒNG KHỞI ĐẦU', mastery: 'KHO TINH THÔNG' },
};
const results = [];
const browser = await launchBrowser();
try {
  for (const lang of ['eng', 'vie']) {
    for (const [w, h] of VIEWPORTS) {
      const id = `${lang}-${w}x${h}`;
      const { page, context, errors } = await openApp(browser, {
        width: w, height: h, mobile: w < 600, lang, storage: { 'apex.alpha.tutorial.v1': 'off' },
      });
      const open = (tab) => page.evaluate((t) => {
        window.dispatchEvent(new CustomEvent('apex:progress-open', { detail: { tab: t } }));
      }, tab);
      const state = () => page.evaluate(() => ({
        title: document.querySelector('.apex-progress-title')?.textContent.trim() || '',
        selected: document.querySelector('.apex-progress-tabs [role=tab][aria-selected="true"]')?.textContent.trim() || '',
        panels: document.querySelectorAll('.apex-progress-panel').length,
      }));

      await open('mastery');
      await page.waitForSelector('.apex-progress-panel', { timeout: 15000 });
      await wait(350);
      let s = await state();
      check(results, s.title === COPY[lang].mastery, `${id} tab 'mastery' titles the panel MASTERY VAULT`, s);
      check(results, s.selected === COPY[lang].mastery, `${id} tab 'mastery' selects the Mastery sub-tab`, s);

      await page.keyboard.press('Escape');
      await wait(400);
      s = await state();
      check(results, s.panels === 0, `${id} Escape closes the panel (back)`, s);

      await open('mission');
      await page.waitForSelector('.apex-progress-panel', { timeout: 15000 });
      await wait(350);
      s = await state();
      check(results, s.title === COPY[lang].contracts, `${id} reopen with 'mission' titles STARTER CONTRACTS`, s);
      check(results, s.panels === 1, `${id} reopen yields exactly one panel`, s);

      const pageErrors = errors.filter((e) => e.startsWith('pageerror'));
      check(results, pageErrors.length === 0, `${id} zero uncaught page errors`, { errors: pageErrors.slice(0, 3) });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`SUMMARY ${JSON.stringify({ total: results.length, failed: failed.map((r) => r.name) })}`);
if (failed.length) process.exit(1);
