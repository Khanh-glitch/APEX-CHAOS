// Verified-but-unseen items after R55/R56:
//  item 5: the Home credit readout shows the REAL current AC (not a hardcoded 350)
//  item 6: no yellow route dots on the bottom buttons, at any breakpoint
//  item 9: ability tiles carry a visible state law (dim while recharging,
//          accented while active, lighter while casting)
import { open, wait, waitStage } from './lib.mjs';
const { browser, page } = await open({ viewport: { width: 390, height: 844 } });

// ── item 5 + 6 on Home ─────────────────────────────────────────────────────
const home = await page.evaluate(() => {
  const ac = document.querySelector('[data-apex-ac]');
  const econ = window.apexEconomy || window.APEX_GOLD?.economy || null;
  let authority = null;
  try { authority = window.localStorage.getItem('apex:credits'); } catch (_) {}
  // any small round "dot" element painted yellow/gold inside a button?
  const dots = [];
  for (const el of document.querySelectorAll('button *, a *, [role="button"] *')) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0 || b.width > 14 || b.height > 14) continue;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor || '';
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) continue;
    const [r, g, bl] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (r > 170 && g > 130 && bl < 120) dots.push({ cls: String(el.className).slice(0, 30), bg, w: Math.round(b.width), h: Math.round(b.height) });
  }
  return {
    acText: ac ? ac.textContent.trim() : null,
    acRaw: ac ? ac.getAttribute('data-apex-ac') : null,
    acValue: ac ? ac.dataset.apexAcValue || null : null,
    authority,
    yellowDots: dots,
  };
});
await page.screenshot({ path: '/tmp/state-home.png' });

// ── item 9 in battle (P1 robot tiles) ──────────────────────────────────────
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/, 20000);
for (let i = 0; i < 4; i += 1) {
  await page.evaluate(() => document.querySelector('.rosterCard[data-hero="newbot"]')?.click());
  await wait(420);
  const lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/LOCK|READY/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(1200); }
  if (await page.evaluate(() => document.body.classList.contains('battle-hud-open'))) break;
}
await waitStage(page, /battle-hud-open/, 90000);
await wait(2000);
const tile = (i) => page.evaluate((idx) => {
  const s = document.querySelectorAll('#p1Side .skill')[idx];
  if (!s) return null;
  const cs = getComputedStyle(s);
  const art = s.querySelector('.sk-art');
  const acs = art ? getComputedStyle(art) : null;
  const icon = s.querySelector('.apex-skill-icon');
  return {
    state: s.dataset.state || '', info: (s.querySelector('.sk-state') || {}).textContent || '',
    filter: acs ? acs.filter : null, opacity: acs ? acs.opacity : null, brightnessHint: cs.getPropertyValue('--tileDim') || null,
    boxShadow: art && art.boxShadow ? String(art.boxShadow).slice(0, 60) : null, iconOpacity: icon ? getComputedStyle(icon).opacity : null,
  };
}, i);
const ready1 = await tile(0);
await page.keyboard.press('KeyJ');             // P1 A1
await wait(900);
const cooling1 = await tile(0);
await page.keyboard.press('KeyK');             // P1 A2 (duration skill on ROBOT)
await wait(600);
const active2 = await tile(1);
await page.screenshot({ path: '/tmp/state-battle.png' });
console.log('HOME ' + JSON.stringify(home));
console.log('TILE_A1_READY ' + JSON.stringify(ready1));
console.log('TILE_A1_COOLING ' + JSON.stringify(cooling1));
console.log('TILE_A2_ACTIVE ' + JSON.stringify(active2));
await browser.close();
