// Issue #105 §5 — Help `?` (#apex-guide-open) vs ACCOUNT (#apexAccountOpen)
// overlap measured on the real home screen at every required viewport.
import { launchBrowser, openApp, wait, check } from './harness.mjs';

const VIEWPORTS = [
  { w: 320, h: 568 }, { w: 390, h: 844 }, { w: 844, h: 390 }, { w: 900, h: 900 }, { w: 1440, h: 900 }, { w: 1366, h: 768 },
];
const results = [];
const browser = await launchBrowser();
try {
  for (const lang of ['eng', 'vie']) {
    for (const v of VIEWPORTS) {
      const mobile = v.w < 500;
      const { page, context } = await openApp(browser, { width: v.w, height: v.h, dpr: 1, mobile, lang });
      await wait(900);
      const m = await page.evaluate(() => {
        const rect = (el) => {
          if (!el) return null;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, shown: cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0 };
        };
        const help = document.querySelector('#apex-guide-open');
        const acct = document.querySelector('#apexAccountOpen');
        const h = rect(help), a = rect(acct);
        const overlap = h && a && h.shown && a.shown && !(h.r <= a.x || a.r <= h.x || h.b <= a.y || a.b <= h.y);
        const area = overlap ? Math.max(0, Math.min(h.r, a.r) - Math.max(h.x, a.x)) * Math.max(0, Math.min(h.b, a.b) - Math.max(h.y, a.y)) : 0;
        return { help: h, account: a, overlap: !!overlap, overlapArea: Math.round(area), helpInViewport: !!h && h.x >= 0 && h.r <= innerWidth + 0.5 && h.b <= innerHeight + 0.5 };
      });
      const ok = !!m.help && !!m.account && !m.overlap;
      check(results, ok, `${lang} ${v.w}x${v.h}: Help ? and ACCOUNT do not overlap (both shown)`, m);
      await page.screenshot({ path: `${process.env.ISSUE105_OUT || '/tmp/i105-help-account'}/home-${lang}-${v.w}x${v.h}.png` }).catch(() => {});
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`HELP vs ACCOUNT SUMMARY ${results.length - failed}/${results.length} PASS`);
process.exitCode = failed ? 1 : 0;
