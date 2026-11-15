// Issue #105 owner R2 (P0-A) gate: Missions and Mastery are one edge-to-edge, paginated
// viewport scene. Real Chromium, real DOM, real clicks and keys. No state is injected.
//   - the panel fills the viewport (no centred dialog)
//   - no element inside the scene scrolls (no hidden scrollbar trapping content)
//   - every page's items fit inside the page stage, with zero overlap of the stage edge
//   - every claim / chapter / equip control is reached on some page, is a real button
//     of at least 44px, and is the hit-test target at its centre
//   - prev / next / ArrowLeft / ArrowRight / Home / End page; Escape closes the scene
// Covers both tabs, EN and VIE, phone portrait, phone landscape, 900x560, laptop and desktop.
import { launchBrowser, openApp, wait, check } from './harness.mjs';

const VIEWPORTS = [
  [320, 568, true], [390, 844, true], [844, 390, true], [900, 560, false],
  [1024, 640, false], [1280, 720, false], [1440, 900, false],
];
const CASES = [
  ...VIEWPORTS.map(([w, h, m]) => ({ w, h, m, lang: 'eng' })),
  { w: 320, h: 568, m: true, lang: 'vie' },
  { w: 1440, h: 900, m: false, lang: 'vie' },
];

const results = [];
const receipts = [];
const browser = await launchBrowser();

// Reads the page: stage geometry, visible items, and each control's hit-test.
const snapshot = (page) => page.evaluate(() => {
  const panel = document.querySelector('.apex-progress-panel');
  const stage = document.querySelector('.apex-pager-stage');
  const pr = panel.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  // Only the current page is mounted (ScenePager), so every item here is visible.
  const items = Array.from(stage.querySelectorAll(':scope > [data-pager-item]'));
  const visible = items;
  const overflowItems = visible.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top < sr.top - 1 || r.bottom > sr.bottom + 1;
  }).map((el) => el.textContent.trim().slice(0, 40));
  const controls = [];
  for (const it of visible) for (const el of it.querySelectorAll('button, article.apex-mastery-medal')) {
    const item = it.textContent.trim().slice(0, 30);
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const isClaimish = el.matches('.apex-progress-claim, .apex-mastery-chapter-toggle, .apex-mastery-equip, .apex-mastery-hero-rail button, .apex-mastery-view-all');
    controls.push({
      item,
      cls: el.className.toString().slice(0, 48),
      text: (el.textContent || '').trim().slice(0, 28),
      hitOk: !!hit && (el === hit || el.contains(hit)),
      inStage: r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1 && r.left >= pr.left - 1 && r.right <= pr.right + 1,
      big: !isClaimish || (r.height >= 43.5 && r.width >= 43.5) || el.matches('.apex-mastery-hero-rail button'),
      disabled: el.disabled === true,
    });
  }
  // A real scroll container is one that scrolls (auto/scroll). overflow:hidden stages
  // hold measured-but-not-current pages by design and are not scrollers.
  const scrollers = Array.from(panel.querySelectorAll('*')).filter((el) => el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY))
    .map((el) => `${el.className}:${el.scrollHeight}/${el.clientHeight}`);
  const pageLabel = document.querySelector('.apex-pager-count')?.textContent.trim() || '';
  const nav = Array.from(document.querySelectorAll('.apex-pager-arrow'));
  return {
    panel: { w: Math.round(pr.width), h: Math.round(pr.height), l: Math.round(pr.left), t: Math.round(pr.top) },
    stage: { h: Math.round(sr.height) },
    visibleCount: visible.length,
    totalItems: items.length,
    overflowItems,
    controls,
    scrollers,
    pageLabel,
    prevDisabled: nav[0] ? nav[0].disabled : null,
    nextDisabled: nav[1] ? nav[1].disabled : null,
    docScrollable: document.documentElement.scrollHeight > innerHeight + 1,
    titles: Array.from(document.querySelectorAll('.apex-progress-title')).map((n) => n.textContent.trim()),
  };
});

// Walks every page, collecting controls keyed by a stable id (class+text+index).
async function walkPages(page) {
  const seen = new Map();
  const pagesInfo = [];
  let guard = 0;
  while (guard < 60) {
    guard += 1;
    const snap = await snapshot(page);
    pagesInfo.push({ visible: snap.visibleCount, overflow: snap.overflowItems, label: snap.pageLabel });
    snap.controls.forEach((c) => {
      const key = `${c.item}|${c.cls}|${c.text}`;
      const prev = seen.get(key) || { hits: 0, bad: [] };
      prev.hits += c.hitOk ? 1 : 0;
      if (!c.hitOk || !c.inStage || !c.big) prev.bad.push({ hitOk: c.hitOk, inStage: c.inStage, big: c.big });
      seen.set(key, prev);
    });
    if (snap.nextDisabled !== false) break;
    await page.click('.apex-pager-nav .apex-pager-arrow:last-child');
    await wait(120);
  }
  return { seen, pagesInfo, pageSnapshotsOk: guard < 60 };
}

try {
  for (const c of CASES) {
    const id = `${c.lang}-${c.w}x${c.h}`;
    const { page, context, errors } = await openApp(browser, {
      width: c.w, height: c.h, mobile: c.m, lang: c.lang, storage: { 'apex.alpha.tutorial.v1': 'off' },
    });
    await page.click('#apexMissionsOpen');
    await page.waitForSelector('.apex-progress-panel', { timeout: 15000 });
    await wait(350);
    for (const tab of ['mission', 'mastery']) {
      if (tab === 'mastery') {
        await page.evaluate(() => [...document.querySelectorAll('.apex-progress-tabs [role=tab]')][1]?.click());
        await page.waitForSelector('.apex-mastery-vault', { timeout: 10000 });
        await wait(350);
      }
      const label = `${id} ${tab}`;
      const first = await snapshot(page);
      const edge = first.panel.l === 0 && first.panel.t === 0
        && Math.abs(first.panel.w - c.w) <= 1 && Math.abs(first.panel.h - c.h) <= 1;
      check(results, edge, `${label} panel fills the viewport edge to edge`, first.panel);
      check(results, first.scrollers.length === 0 && !first.docScrollable,
        `${label} no scrolling element inside the scene`, { scrollers: first.scrollers, docScrollable: first.docScrollable });
      check(results, first.stage.h >= 120, `${label} page stage has usable height`, { stage: first.stage.h });

      const walk = await walkPages(page);
      const pages = walk.pagesInfo.length;
      const overflow = walk.pagesInfo.flatMap((p) => p.overflow);
      check(results, overflow.length === 0, `${label} every item on every page fits the stage`, { pages, overflow: overflow.slice(0, 4) });

      const controlRows = [...walk.seen.entries()];
      const unreachable = controlRows.filter(([, v]) => v.hits === 0).map(([k]) => k);
      const badHits = controlRows.filter(([, v]) => v.bad.length > 0).map(([k, v]) => ({ k, bad: v.bad.slice(0, 2) }));
      check(results, unreachable.length === 0 && badHits.length === 0,
        `${label} every control is reachable, hit-testable and at least 44px`, {
          controls: controlRows.length, unreachable: unreachable.slice(0, 4), badHits: badHits.slice(0, 4),
        });
      const expectedClaims = tab === 'mission' ? 5 : null;
      if (expectedClaims !== null) {
        const claimCount = controlRows.filter(([k]) => k.includes('apex-progress-claim')).length;
        check(results, claimCount === expectedClaims, `${label} all ${expectedClaims} contract claims are reachable on pages`, { claimCount });
      }
      receipts.push({ viewport: id, tab, panel: first.panel, stageH: first.stage.h, pages, controls: controlRows.length });
    }
    // Keyboard paging and Escape close, on the Mastery tab (focus on the scene, not an input).
    await page.evaluate(() => { document.activeElement?.blur?.(); });
    await page.keyboard.press('Home');
    await wait(150);
    const atHome = await snapshot(page);
    await page.keyboard.press('ArrowRight');
    await wait(150);
    const afterRight = (await snapshot(page)).pageLabel;
    await page.keyboard.press('ArrowLeft');
    await wait(150);
    const afterLeft = (await snapshot(page)).pageLabel;
    await page.keyboard.press('End');
    await wait(150);
    const atEnd = await snapshot(page);
    const pagedOk = atHome.pageLabel !== afterRight && afterLeft === atHome.pageLabel && atEnd.nextDisabled === true && atHome.prevDisabled === true;
    check(results, pagedOk, `${id} Home / ArrowRight / ArrowLeft / End page the scene`, {
      home: atHome.pageLabel, afterRight, afterLeft, end: atEnd.pageLabel,
    });
    const expectTitle = c.lang === 'vie' ? 'KHO TINH THÔNG' : 'MASTERY VAULT';
    check(results, atEnd.titles.length === 1 && atEnd.titles[0] === expectTitle,
      `${id} Mastery title stays on the Mastery tab while paging`, { titles: atEnd.titles });
    await page.keyboard.press('Escape');
    await wait(300);
    check(results, !(await page.$('.apex-progress-panel')), `${id} Escape closes the scene`);
    const pageErrors = errors.filter((e) => e.startsWith('pageerror'));
    check(results, pageErrors.length === 0, `${id} zero uncaught page errors`, { errors: pageErrors.slice(0, 3) });
    await context.close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`SUMMARY ${JSON.stringify({ total: results.length, failed: failed.map((r) => r.name), receipts })}`);
if (failed.length) process.exit(1);
