// Issue #105 §6 gate: VS BOT portrait 1P layout (phone portrait only).
// Asserts: arena stays square, arena is not smaller than before the change,
// no empty band between identity and J/K, J/K >=44px, identity+weapon visible,
// and non-portrait layouts (desktop/landscape) are unchanged.
import { launchBrowser, openApp, startBotBattle, wait, check } from './harness.mjs';

const results = [];
const receipts = [];
// Pre-change baseline measured on 63cc8354 + WIP (see evidence/issue-105/receipts).
const BEFORE_ARENA = { '390x844': 378, '320x568': 252 };
const browser = await launchBrowser();
try {
  for (const spec of ['390x844', '320x568']) {
    const [w, h] = spec.split('x').map(Number);
    const { page, context, errors } = await openApp(browser, { width: w, height: h, mobile: true, storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await startBotBattle(page);
    await wait(800);
    const m = await page.evaluate(() => {
      const R = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right }; };
      const c = document.querySelector('#game-canvas') || document.querySelector('#arenaCanvas');
      const cb = c.getBoundingClientRect();
      const ident = R('#p1Side .ident'); const skills = R('#p1Side .skills'); const k = R('#p1Side .skill[data-i="0"]'); const j = R('#p1Side .skill[data-i="1"]');
      const weapon = R('#p1Side .weapon');
      return { layout: document.querySelector('#hud').dataset.layout, arena: { w: cb.width, h: cb.height }, gap: skills && ident ? skills.y - ident.b : null,
        skillMinH: Math.min(k?.h || 0, j?.h || 0), skillMinW: Math.min(k?.w || 0, j?.w || 0), identVisible: !!ident && ident.b <= innerHeight, weaponVisible: !!weapon && weapon.b <= innerHeight && weapon.w > 0,
        skillsInside: !!skills && skills.b <= innerHeight, vh: innerHeight };
    });
    const before = BEFORE_ARENA[spec];
    receipts.push({ spec, ...m, arenaBefore: before });
    check(results, layoutOk(m), `${spec} portrait 1P: square arena, no band, J/K >=44px, identity+weapon visible`, m);
    check(results, m.arena.w >= before - 0.5 && Math.abs(m.arena.w - m.arena.h) <= 1, `${spec} arena not smaller than before (${before}px) and square`, { now: m.arena, before });
    check(results, errors.filter((e) => /hud|layout|pageerror/i.test(e)).length === 0, `${spec} no HUD page errors`, errors.slice(0, 3));
    await context.close();
  }
  // Desktop is not portrait: its layout token must be unchanged.
  {
    const { page, context } = await openApp(browser, { width: 1440, height: 900, storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await startBotBattle(page);
    await wait(500);
    const layout = await page.evaluate(() => document.querySelector('#hud').dataset.layout);
    check(results, layout !== 'port', 'desktop 1440x900 is not the portrait layout (unchanged path)', { layout });
    await context.close();
  }
} finally {
  await browser.close();
}
function layoutOk(m) {
  return m.layout === 'port'
    && Math.abs(m.arena.w - m.arena.h) <= 1
    && m.gap !== null && m.gap <= 16
    && m.skillMinH >= 44 && m.skillMinW >= 44
    && m.identVisible && m.weaponVisible && m.skillsInside;
}
const failed = results.filter((r) => !r.ok);
console.log('SUMMARY', JSON.stringify({ total: results.length, failed: failed.map((r) => r.name) }));
if (failed.length) process.exitCode = 1;
