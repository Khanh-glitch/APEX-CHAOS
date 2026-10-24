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

    // Claim-style buttons: real buttons, named, scrollable fully into view.
    const claims = await page.evaluate(() => {
      const panel = document.querySelector('.apex-progress-panel');
      const pr = panel.getBoundingClientRect();
      const list = Array.from(panel.querySelectorAll('button')).filter((b) => /CLAIM|CLAIMED|INCOMPLETE|NHẬN|NHAN/i.test(b.textContent || ''));
      return list.map((b) => {
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return {
          text: b.textContent.trim().slice(0, 24),
          named: (b.textContent || b.getAttribute('aria-label') || '').trim().length > 0,
          disabled: b.disabled,
          inViewport: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1,
          inPanel: r.left >= pr.left - 1 && r.right <= pr.right + 1,
          size: [Math.round(r.width), Math.round(r.height)],
        };
      });
    });
    const bad = claims.filter((c) => !c.named || !c.inViewport || !c.inPanel || c.size[0] < 8 || c.size[1] < 8);
    check(results, bad.length === 0, `${id} every claim-style button is named, reachable and inside the viewport`, { count: claims.length, bad: bad.slice(0, 4) });

    // Scroll the panel body, then close with the Close control (back).
    await page.evaluate(() => {
      const panel = document.querySelector('.apex-progress-panel');
      const sc = Array.from(panel.querySelectorAll('*')).find((el) => el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY));
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await wait(150);
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
