// OWNER LAWS 2026-10-06, live:
//  1) LOCAL 1v1: P2 abilities come from the RIGHT-HAND NUMPAD pair only; the
//     top-row 1/2 pair must cast nothing.
//  2) BOT: the player picks the CPU's fighter (no auto ROBOT).
import { open, wait, waitStage } from './lib.mjs';
const { browser, page } = await open();
const abilityWords = (page) => page.evaluate(() => {
  const out = [];
  for (const i of [0, 1]) {
    const f = window.fighters && window.fighters[i];
    if (f) out.push({ i, name: String(f.name || ''), hero: f.__hrHero || f.heroId || null });
  }
  return out;
});

// ── 1) LOCAL: numpad casts, top row does not ────────────────────────────────
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="local1v1"]');
await waitStage(page, /screen-fighter/, 20000);
for (const h of ['newbot', 'frost']) {
  await page.evaluate((x) => document.querySelector(`.rosterCard[data-hero="${x}"]`)?.click(), h);
  await wait(350);
  const label = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/LOCK/i.test(label)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(1300); }
}
await waitStage(page, /battle-hud-open/, 90000);
await wait(1500);
const localKeys = await page.evaluate(() => {
  const seen = [];
  const HR = window.APEX_HERO_REWORK;
  const bus = window.APEX_ARSENAL?.state;
  const orig = HR.pressAbility;
  HR.pressAbility = function patched(f, slot, opts) { seen.push({ name: String(f && f.name), slot, key: opts && opts.key }); return orig.apply(this, arguments); };
  for (const [key, code] of [['1', 'Digit1'], ['2', 'Digit2']]) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }));
  }
  const afterTop = seen.slice();
  for (const [key, code] of [['1', 'Numpad1'], ['2', 'Numpad2']]) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }));
  }
  HR.pressAbility = orig;
  return { topRow: afterTop, numpad: seen.slice(afterTop.length) };
});
// leave the match through the HUD exit
await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
await page.waitForFunction(() => !document.body.classList.contains('battle-hud-open'), { timeout: 20000, polling: 60 });
await wait(600);

// ── 2) BOT: choose the CPU's fighter ───────────────────────────────────────
await page.evaluate(() => document.getElementById('freeBattle')?.click());
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/, 20000);
await wait(500);
const beforePick = await page.evaluate(() => {
  const side = document.getElementById('p2Side');
  return { tag: side.querySelector('.fighterTag')?.textContent, name: side.querySelector('.fighterName')?.textContent, lock: document.getElementById('lockIn')?.innerText.trim() };
});
// P1 = magnet, then the BOT's fighter = crystala
await page.evaluate(() => document.querySelector('.rosterCard[data-hero="magnet"]')?.click());
await wait(400);
await page.evaluate(() => document.getElementById('lockIn')?.click());
await wait(700);
const afterP1 = await page.evaluate(() => ({
  lock: document.getElementById('lockIn')?.innerText.trim(),
  prompt: document.querySelector('.selectionPrompt')?.textContent || null,
  p2Active: document.getElementById('p2Side')?.classList.contains('is-active'),
}));
await page.evaluate(() => document.querySelector('.rosterCard[data-hero="crystala"]')?.click());
await wait(500);
const afterBotPick = await page.evaluate(() => {
  const side = document.getElementById('p2Side');
  return {
    tag: side.querySelector('.fighterTag')?.textContent,
    name: side.querySelector('.fighterName')?.textContent,
    skills: side.querySelectorAll('.skillChip').length,
    p2SelectedCard: document.querySelector('.rosterCard.p2-selected')?.dataset.hero || null,
    lock: document.getElementById('lockIn')?.innerText.trim(),
    productionBot: window.APEX_ARSENAL_SHELLS.botOpponentId(),
  };
});
await page.evaluate(() => document.getElementById('lockIn')?.click());
await waitStage(page, /battle-hud-open/, 90000);
await wait(2500);
const fighters = await abilityWords(page);
const hudP2 = await page.evaluate(() => {
  const side = document.getElementById('p2Side');
  return { name: side?.querySelector('.name')?.textContent, ident: side?.querySelector('.id-name')?.textContent };
});
console.log('LOCAL_KEYS ' + JSON.stringify(localKeys));
console.log('BOT_BEFORE ' + JSON.stringify(beforePick));
console.log('BOT_AFTER_P1 ' + JSON.stringify(afterP1));
console.log('BOT_AFTER_PICK ' + JSON.stringify(afterBotPick));
console.log('BOT_FIGHTERS ' + JSON.stringify(fighters));
console.log('BOT_HUD_P2 ' + JSON.stringify(hudP2));
await page.screenshot({ path: '/tmp/r56-botpick.png' });
await browser.close();
