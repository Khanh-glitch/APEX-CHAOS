// Issue #105 §7 — Missions / Mastery keyboard, back, claim and reopen gate.
// Real Chromium, real DOM, real key presses. No state is injected into React.
//   - Tab to the MASTERY tab and activate it with Enter; header title follows tab
//   - every CLAIM-style button has an accessible name, is a real <button>, and
//     can be scrolled fully into the viewport
//   - Close button and Escape both dismiss; focus returns to the opener
//   - scroll the panel, close, reopen: exactly one panel, no duplicate surface
import { launchBrowser, openApp, wait, check } from './harness.mjs';

const VIEWPORTS = [[320, 568], [390, 844], [844, 390], [1440, 900], [1920, 1080]];
const results = [];
const browser = await launchBrowser();
try {
  for (const [w, h] of VIEWPORTS) {
    const { page, context } = await openApp(browser, {
      width: w, height: h, mobile: w < 600, lang: 'eng', storage: { 'apex.alpha.tutorial.v1': 'off' },
    });
    const id = `${w}x${h}`;
    await page.click('#apexMissionsOpen');
    await page.waitForSelector('.apex-progress-panel', { timeout: 15000 });
    await wait(350);
    const title = () => page.evaluate(() => document.querySelector('.apex-progress-title')?.textContent.trim() || '');
    check(results, (await title()) === 'STARTER CONTRACTS', `${id} Missions tab header reads STARTER CONTRACTS`, { title: await title() });

    // Keyboard: focus the Mastery tab with Tab key, activate with Enter.
    await page.evaluate(() => document.querySelector('.apex-progress-tabs [role=tab]')?.focus());
    await page.keyboard.press('Tab');
    const focusedIsMastery = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement !== document.querySelector('.apex-progress-tabs [role=tab]'));
    await page.keyboard.press('Enter');
    await wait(300);
    const masteryState = await page.evaluate(() => ({
      title: document.querySelector('.apex-progress-title')?.textContent.trim() || '',
      selected: Array.from(document.querySelectorAll('.apex-progress-tabs [role=tab]')).map((b) => b.getAttribute('aria-selected')),
    }));
    check(results, focusedIsMastery && masteryState.title === 'MASTERY VAULT' && masteryState.selected[1] === 'true',
      `${id} keyboard Tab + Enter switches to MASTERY VAULT and aria-selected follows`, { focusedIsMastery, masteryState });

    // Claim-style buttons (Issue #105 R2 P0-A): the scene is paginated, so a claim is
    // reachable only when it is on the visible page. Walk every page with the real Next
    // control; each claim must be named, a real enabled-or-disabled button, inside the
    // viewport and panel, and the hit-test target at its centre on the page that shows it.
    // The keyboard step above left the scene on MASTERY; claims live on the Missions tab.
    await page.evaluate(() => document.querySelector('.apex-progress-tabs [role=tab]')?.click());
    await wait(300);
    const seenClaims = new Map();
    const pageCount = async () => page.evaluate(() => document.querySelectorAll('.apex-pager-item').length);
    for (let guard = 0; guard < 40; guard += 1) {
      const rows = await page.evaluate(() => {
        const stage = document.querySelector('.apex-pager-stage');
        const sr = stage.getBoundingClientRect();
        const pr = document.querySelector('.apex-progress-panel').getBoundingClientRect();
        return Array.from(stage.querySelectorAll('[data-pager-item] button'))
          .filter((b) => /CLAIM|CLAIMED|INCOMPLETE|NHẬN|NHAN|ĐÃ NHẬN|CHƯA ĐẠT/i.test(b.textContent || ''))
          .map((b, i) => {
            const r = b.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return {
              key: `${b.closest('[data-pager-item]').textContent.trim().slice(0, 24)}|${b.textContent.trim().slice(0, 24)}`,
              named: (b.textContent || b.getAttribute('aria-label') || '').trim().length > 0,
              hitOk: !!hit && (b === hit || b.contains(hit)),
              inViewport: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1,
              inPanel: r.left >= pr.left - 1 && r.right <= pr.right + 1 && r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1,
              size: [Math.round(r.width), Math.round(r.height)],
            };
          });
      });
      rows.forEach((row) => seenClaims.set(row.key, row));
      const nextDisabled = await page.evaluate(() => document.querySelectorAll('.apex-pager-arrow')[1]?.disabled ?? true);
      if (nextDisabled) break;
      await page.click('.apex-pager-nav .apex-pager-arrow:last-child');
      await wait(150);
    }
    const claims = [...seenClaims.values()];
    // Five starter contracts (ECOBOT/VUA HỀ are not contracts). Fixed, so a claim that
    // never reaches a page cannot pass by being absent from the DOM.
    const totalClaims = 5;
    const bad = claims.filter((c) => !c.named || !c.hitOk || !c.inViewport || !c.inPanel || c.size[0] < 44 || c.size[1] < 44);
    check(results, claims.length === totalClaims && totalClaims > 0 && bad.length === 0, `${id} every claim-style button is named, on a page, hit-testable and at least 44px`, {
      visibleOnPages: claims.length, total: totalClaims, bad: bad.slice(0, 4),
    });

    // Page back to the first page, then close with the Close control (back).
    await page.keyboard.press('Home');
    await wait(150);
    const pagesTotal = await pageCount();
    check(results, pagesTotal > 0, `${id} scene has items to page`, { pagesTotal });
    await page.click('.apex-progress-panel [aria-label="Close"]');
    await wait(300);
    const closedByButton = !(await page.$('.apex-progress-panel'));
    const focusReturned = await page.evaluate(() => document.activeElement?.id === 'apexMissionsOpen');
    check(results, closedByButton, `${id} Close control dismisses the surface (back)`);
    check(results, focusReturned, `${id} focus returns to the Missions opener after close`, { active: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) });

    // Reopen after scrolled close: exactly one surface, header on the Mastery tab
    // state is reset to the default tab (no stale sub-tab), no duplicate panel.
    await page.click('#apexMissionsOpen');
    await page.waitForSelector('.apex-progress-panel', { timeout: 15000 });
    await wait(300);
    const reopen = await page.evaluate(() => ({
      panels: document.querySelectorAll('.apex-progress-panel').length,
      title: document.querySelector('.apex-progress-title')?.textContent.trim() || '',
    }));
    check(results, reopen.panels === 1 && reopen.title === 'STARTER CONTRACTS', `${id} reopen after scroll shows one surface on the default tab`, reopen);

    // Escape also dismisses and returns focus.
    await page.keyboard.press('Escape');
    await wait(300);
    check(results, !(await page.$('.apex-progress-panel')), `${id} Escape dismisses the surface`);
    await context.close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`PROGRESS KEYBOARD SUMMARY ${results.length - failed}/${results.length} PASS`);
process.exitCode = failed ? 1 : 0;
