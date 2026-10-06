import { open, wait, waitStage } from './lib.mjs';
const which = process.argv[2] || 'port';       // port | land | desk | phones | tabport
const mode = process.argv[3] || 'bot';         // bot | local1v1
const inject = process.argv[4] === 'wpn';      // inject a real weapon to measure the cluster
const VP = { port: { width: 390, height: 844 }, land: { width: 844, height: 390 }, desk: { width: 1280, height: 720 }, phones: { width: 360, height: 780 }, tabport: { width: 820, height: 1180 } };
const { browser, page } = await open({ viewport: VP[which] });
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click(`.modeCard[data-mode="${mode}"]`);
await waitStage(page, /screen-fighter/, 20000);
const heroes = mode === 'bot' ? ['newbot'] : ['newbot', 'frost'];
for (let i = 0; i < 4; i += 1) {
  await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), heroes[Math.min(i, heroes.length - 1)]);
  await wait(420);
  const lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(1400); }
  if (/battle-hud-open/.test((await page.evaluate(() => document.getElementById('stage').className)))) break;
}
await waitStage(page, /battle-hud-open/, 90000);
await wait(1200);
if (inject) {
  await page.evaluate(() => {
    const seam = window.APEX_GOLD_HUD, orig = seam.applyState.bind(seam);
    const w = (name, type, file, mag, ammo, tier, tierColor) => ({ name, type, asset: `/assets/arsenal/weapons/c/${file}`, mag, ammo, usesAmmo: true, tier, tierColor });
    orig({ sides: [
      { weapon: w('AK-47', 'RIFLE', 'AK_47.png', 30, 24, 'RARE', '#4ea6ff') },
      { weapon: w('MOSSBERG 500', 'SHOTGUN', 'MOSSBERG_500.png', 8, 1, 'EPIC', '#c07bff') },
    ] });
    seam.applyState = () => {};   // freeze: the production pump must not overwrite the measurement state
  });
  await wait(600);
}
const info = await page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  const hud = document.getElementById('hud');
  const out = { layout: hud.dataset.layout, mode: hud.dataset.mode, vp: [innerWidth, innerHeight], stageCls: document.getElementById('stage').className };
  for (const p of [1, 2]) {
    const side = document.getElementById(p === 1 ? 'p1Side' : 'p2Side');
    const o = { side: r(side), mirror: side.hasAttribute('data-mirror') };
    for (const sel of ['.ident', '.portrait', '.id-name', '.name', '.skills', '.weapon', '.wp-ico', '.wp-txt', '.wp-amm', '.wp-swap', '.wp-mag', '.wp-cur', '.wp-name', '.wp-type', '.sk-art', '.sk-info', '.sk-name', '.sk-state']) {
      o[sel] = r(side.querySelector(sel));
    }
    o.skill1 = r(side.querySelectorAll('.skill')[0]);
    o.skill2 = r(side.querySelectorAll('.skill')[1]);
    o.text = side.innerText.replace(/\s+/g, ' ').slice(0, 150);
    out['p' + p] = o;
  }
  out.rail1 = r(document.getElementById('p1Rail')); out.rail2 = r(document.getElementById('p2Rail'));
  out.mc = r(document.getElementById('matchCenter')); out.arena = r(document.getElementById('arenaZone'));
  out.overflow = [...document.querySelectorAll('#hud *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1 || b.top < -1 || b.bottom > innerHeight + 1); }).slice(0, 12).map((el) => (el.id || String(el.className).split(' ')[0]) + ':' + r(el).join(','));
  return out;
});
console.log(JSON.stringify(info));
await page.screenshot({ path: `/tmp/lay-${which}-${mode}${inject ? '-w' : ''}.png` });
await browser.close();
