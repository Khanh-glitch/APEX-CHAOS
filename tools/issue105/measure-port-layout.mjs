// Measures the VS BOT portrait layout: arena square, P1 content height vs band.
import { launchBrowser, openApp, startBotBattle, wait } from './harness.mjs';
const specs = process.argv.slice(2).length ? process.argv.slice(2) : ['390x844', '320x568', '360x740', '412x915', '768x1024'];
const browser = await launchBrowser();
try {
  for (const spec of specs) {
    const [w, h] = spec.split('x').map(Number);
    const { page, context } = await openApp(browser, { width: w, height: h, mobile: true });
    await startBotBattle(page);
    await wait(800);
    const m = await page.evaluate(() => {
      const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) }; };
      const hud = document.querySelector('#hud');
      const p1 = document.querySelector('#p1Side');
      const kids = p1 ? [...p1.querySelectorAll(':scope > *')].filter((e) => e.getBoundingClientRect().height > 0) : [];
      const contentBottom = kids.length ? Math.max(...kids.map((k) => k.getBoundingClientRect().bottom)) : 0;
      const p1r = p1?.getBoundingClientRect();
      const canvas = document.querySelector('#game-canvas') || document.querySelector('#arenaCanvas');
      const cb = canvas?.getBoundingClientRect();
      return {
        layout: hud?.dataset.layout, size: hud?.dataset.size, mode: hud?.dataset.mode,
        arena: cb ? { w: Math.round(cb.width), h: Math.round(cb.height), top: Math.round(cb.top), bottom: Math.round(cb.bottom) } : null,
        p1: r('#p1Side'), p1ContentBottom: Math.round(contentBottom), p1BandUnusedPx: p1r ? Math.round(p1r.bottom - contentBottom) : null,
        skill: r('#p1Side .skill[data-i="0"]'), weapon: r('#p1Side .weapon'), hp: r('#p1Side .hp, #p1Side .hpbar, #p1Side .ident .hp'),
        vh: window.innerHeight, vw: window.innerWidth,
      };
    });
    console.log('LAYOUT', spec, JSON.stringify(m));
    await context.close();
  }
} finally { await browser.close(); }
