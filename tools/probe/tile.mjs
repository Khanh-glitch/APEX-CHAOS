import { open, wait, waitStage } from './lib.mjs';
const which = process.argv[2] || 'port';
const mode = process.argv[3] || 'local1v1';
const VP = { port: { width: 390, height: 844 }, land: { width: 844, height: 390 }, desk: { width: 1280, height: 720 } };
const { browser, page } = await open({ viewport: VP[which] });
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click(`.modeCard[data-mode="${mode}"]`);
await waitStage(page, /screen-fighter/, 20000);
for (let i = 0; i < 3; i += 1) {
  await page.evaluate(() => document.querySelector('.rosterCard[data-hero="newbot"]')?.click());
  await wait(420);
  const lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(1400); }
  if (/battle-hud-open/.test(await page.evaluate(() => document.getElementById('stage').className))) break;
}
await waitStage(page, /battle-hud-open/, 90000);
await wait(1500);
console.log(JSON.stringify(await page.evaluate(() => {
  const out = {};
  const dump = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { box: [Math.round(b.width), Math.round(b.height)], rows: cs.gridTemplateRows, cols: cs.gridTemplateColumns, h: cs.height, fs: cs.fontSize, kids: [...el.children].map((c) => String(c.className).split(' ')[0]) }; };
  for (const p of [1, 2]) {
    const side = document.getElementById(p === 1 ? 'p1Side' : 'p2Side');
    const tile = side.querySelectorAll('.skill')[0];
    out['p' + p] = {
      side: dump(side),
      tile: dump(tile),
      art: dump(side.querySelector('.sk-art')),
      info: dump(side.querySelector('.sk-info')),
      name: dump(side.querySelector('.sk-name')),
      nameText: side.querySelector('.sk-name') && side.querySelector('.sk-name').textContent,
      ctrl: side.querySelector('.id-ctrl') && side.querySelector('.id-ctrl').textContent,
      weapon: dump(side.querySelector('.weapon')),
      ico: dump(side.querySelector('.wp-ico')),
      vars: ['--wpH', '--amF', '--porH', '--artW', '--skNF', '--tw', '--nameF'].map((v) => v + '=' + getComputedStyle(side).getPropertyValue(v).trim()),
    };
  }
  return out;
}), null, 1));
await browser.close();
