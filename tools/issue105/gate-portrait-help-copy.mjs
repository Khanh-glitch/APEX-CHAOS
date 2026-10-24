// Issue #105 owner option B: cramped-portrait instructions live in Help before combat.
// Real Chromium on the real home screen. Opens the Help sheet via its real
// control (#apex-guide-open) at 320x568 and 390x844, EN and VIE, and checks:
//  - the localized portrait note is visible, inside the viewport, not overflowing;
//  - the Tutorial / Hướng dẫn tân thủ switch is present and reachable;
//  - no uncaught page errors.
import { launchBrowser, openApp, wait, check } from './harness.mjs';

const VIEWPORTS = [{ w: 320, h: 568 }, { w: 390, h: 844 }];
const EXPECT = {
  eng: { note: 'Narrow portrait screens keep battles clean', toggle: 'Tutorial / Hướng dẫn tân thủ' },
  vie: { note: 'Màn hình dọc hẹp giữ trận đấu gọn sạch', toggle: 'Tutorial / Hướng dẫn tân thủ' },
};
const results = [];
const browser = await launchBrowser();
try {
  for (const lang of ['eng', 'vie']) {
    for (const v of VIEWPORTS) {
      const id = `${lang}-${v.w}x${v.h}`;
      const { page, context, errors } = await openApp(browser, {
        width: v.w, height: v.h, mobile: true, lang, storage: { 'apex.alpha.tutorial.v1': 'off' },
      });
      await page.waitForSelector('#apex-guide-open', { timeout: 20000 });
      await page.click('#apex-guide-open');
      await page.waitForSelector('[data-testid="apex-help-portrait-note"]', { timeout: 10000 });
      await wait(250);
      const m = await page.evaluate(() => {
        const note = document.querySelector('[data-testid="apex-help-portrait-note"]');
        const r = note.getBoundingClientRect();
        const sheet = note.closest('.apex-help-sheet')?.getBoundingClientRect();
        const toggle = document.querySelector('#apex-tutorial-toggle');
        const tr = toggle?.getBoundingClientRect();
        return {
          text: note.textContent.trim(),
          visible: r.width > 0 && r.height > 0 && getComputedStyle(note).visibility !== 'hidden',
          inViewport: r.left >= 0 && r.right <= window.innerWidth + 0.5,
          noOverflow: note.scrollWidth <= note.clientWidth + 1,
          inSheet: !!sheet && r.left >= sheet.left - 0.5 && r.right <= sheet.right + 0.5,
          toggleText: toggle?.textContent.trim() || '',
          toggleHit: !!tr && tr.width >= 44 && tr.height >= 44,
        };
      });
      check(results, m.visible && m.inViewport && m.noOverflow && m.inSheet, `${id} portrait note visible inside sheet and viewport`, m);
      check(results, m.text.startsWith(EXPECT[lang].note), `${id} portrait note is localized (${lang})`, { text: m.text.slice(0, 60) });
      check(results, m.toggleText.includes(EXPECT[lang].toggle) && m.toggleHit, `${id} tutorial switch present with 44px hitbox`, { toggleText: m.toggleText, toggleHit: m.toggleHit });
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
