// Screenshot + layout receipts for a BOT battle. Usage: node shot-battle.mjs WxH out.png
import { launchBrowser, openApp, startBotBattle, wait } from './harness.mjs';
const [spec, out] = process.argv.slice(2);
const [w, h] = spec.split('x').map(Number);
const b = await launchBrowser();
const { page, context } = await openApp(b, { width: w, height: h, mobile: w < 600, storage: { 'apex.alpha.tutorial.v1': 'off' } });
await startBotBattle(page);
await wait(900);
const m = await page.evaluate(() => {
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
  const c = document.querySelector('#game-canvas') || document.querySelector('#arenaCanvas');
  return { layout: document.querySelector('#hud')?.dataset.layout, arena: R(c), p1: R(document.querySelector('#p1Side')), ident: R(document.querySelector('#p1Side .ident')), skills: R(document.querySelector('#p1Side .skills')), skillBtn: R(document.querySelector('#p1Side .skill[data-i="0"]')), weapon: R(document.querySelector('#p1Side .weapon')), p2: R(document.querySelector('#p2Side')), stripH: getComputedStyle(document.querySelector('#hud')).getPropertyValue('--stripH') };
});
console.log(spec, JSON.stringify(m));
await page.screenshot({ path: out });
await context.close(); await b.close();
