// HUD surface probe: what the battle HUD exposes per mode, plus phone geometry.
import { open, wait, waitStage, botMatch } from './lib.mjs';
const vp = process.argv[2] === 'phone' ? { width: 390, height: 844 } : process.argv[2] === 'land' ? { width: 844, height: 390 } : { width: 1280, height: 720 };
const mode = process.argv[3] || 'bot';
const { browser, page } = await open({ viewport: vp });
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click(`.modeCard[data-mode="${mode}"]`);
await waitStage(page, /screen-fighter/, 20000);
for (let i = 0; i < 2; i += 1) {
  await page.evaluate(() => document.querySelector('.rosterCard[data-hero="newbot"]')?.click());
  await wait(350);
  const lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(1200); }
}
await waitStage(page, /battle-hud-open/, 90000);
await wait(1500);
const out = await page.evaluate(() => {
  const hud = document.querySelector('#hud');
  const frame = document.getElementById('battleHudFrame');
  const doc = frame && frame.contentDocument;
  const inside = doc ? doc.querySelector('#hud') : null;
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const skillInfo = (sel) => [...(doc || document).querySelectorAll(sel)].map((s) => ({
    side: s.closest('.side')?.id || '', i: s.dataset.i, state: s.dataset.state || '', key: (s.querySelector('.sk-key') || {}).textContent || '',
    pe: getComputedStyle(s).pointerEvents, box: box(s), name: ((s.querySelector('.sk-name') || {}).textContent || '').slice(0, 18),
  }));
  const wpn = (doc || document).querySelectorAll('.weapon, .wpn, .wp');
  return {
    layout: inside ? inside.dataset.layout : (hud ? hud.dataset.layout : null),
    mode: inside ? inside.dataset.mode : null,
    skills: skillInfo('.skill'),
    weapons: [...wpn].map((w) => ({ cls: String(w.className).slice(0, 40), box: box(w), text: (w.innerText || '').replace(/\s+/g, ' ').slice(0, 60) })),
    ammo: [...(doc || document).querySelectorAll('.ammo, .sk-ammo, .wp-ammo')].map((a) => ({ cls: String(a.className).slice(0, 30), text: (a.textContent || '').slice(0, 12), box: box(a) })),
    vsRail: box((doc || document).querySelector('#versusRail')),
    p2Side: box((doc || document).querySelector('#p2Side')),
    p1Side: box((doc || document).querySelector('#p1Side')),
    arena: box((doc || document).querySelector('#arena, .arena')),
    viewport: [innerWidth, innerHeight],
  };
});
console.log('HUD ' + JSON.stringify(out, null, 1));
await page.screenshot({ path: `/home/user/APEX-CHAOS/docs/acceptance/owner-playtest/fx/r55-hud-${mode}-${vp.width}x${vp.height}.png` });
await browser.close();
