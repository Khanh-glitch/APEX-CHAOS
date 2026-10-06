// FIGHTER PICK surface probe (owner item 12): what the pick screen shows for a
// hero — portrait, identity and the A1/A2/PASSIVE display — at every aspect.
import { open, wait, waitStage } from './lib.mjs';
const VP = {
  desk: { width: 1280, height: 720 }, port: { width: 390, height: 844 },
  land: { width: 844, height: 390 }, phones: { width: 360, height: 780 },
};
const which = process.argv[2] || 'desk';
const hero = process.argv[3] || 'magnet';
const { browser, page } = await open({ viewport: VP[which] || VP.desk });
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/, 20000);
await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), hero);
await wait(900);
const info = await page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) : null);
  const cs = (el) => { if (!el) return null; const c = getComputedStyle(el); return { fs: c.fontSize, color: c.color, op: c.opacity, ff: c.fontFamily.split(',')[0], ls: c.letterSpacing }; };
  const chips = [...document.querySelectorAll('.skillChip')];
  return {
    vp: [innerWidth, innerHeight],
    stageCls: document.getElementById('stage').className,
    fighter: r(document.getElementById('fighterScreen')),
    portrait: r(document.querySelector('.fighterPortrait, .worldHeroSlot, #fighterScreen img')),
    heroName: r(document.querySelector('.fighterName, #fighterScreen h2, .heroName')),
    heroNameTxt: txt(document.querySelector('.fighterName, #fighterScreen h2, .heroName')),
    nameCs: cs(document.querySelector('.fighterName, #fighterScreen h2, .heroName')),
    chips: chips.map((c) => ({ box: r(c), text: txt(c), cs: cs(c) })),
    chipHost: r(document.querySelector('.skillRow, .skillChips, .fighterSkills')),
    roster: r(document.querySelector('.roster')),
    overflow: [...document.querySelectorAll('#fighterScreen *')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1 || b.top < -1 || b.bottom > innerHeight + 1);
    }).slice(0, 8).map((el) => (el.id || String(el.className).split(' ')[0]) + ':' + r(el).join(',')),
  };
});
console.log('PICK ' + JSON.stringify(info));
await page.screenshot({ path: `/tmp/pick-${which}.png` });
await browser.close();
