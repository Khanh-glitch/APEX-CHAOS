// OWNER ASK (this turn): in BOT mode the PLAYER picks the CPU's fighter, and the
// spawned opponent must BE that fighter (one production authority, no stale copy).
import { open, wait, waitStage } from './lib.mjs';
const pick = process.argv[2] || 'hunter';
const { browser, page } = await open({ viewport: { width: 1280, height: 720 } });
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/, 20000);
// P1 own pick
await page.evaluate(() => document.querySelector('.rosterCard[data-hero="newbot"]')?.click());
await wait(350);
let lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
if (/LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(600); }
const activeBefore = await page.evaluate(() => ({
  active: document.querySelector('.rosterCard.is-active')?.dataset.hero || null,
  activePlayer: window.__apexActivePlayer || null,
  banner: (document.getElementById('handoffBanner') || {}).textContent || '',
}));
// P2 = the CPU's fighter, chosen by the PLAYER
await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), pick);
await wait(400);
const picked = await page.evaluate(() => ({
  shownP2: (document.querySelector('.rosterCard[data-role="p2"]') || document.querySelectorAll('.rosterCard.is-p2')[0] || {}).dataset?.hero || null,
  banner: (document.getElementById('handoffBanner') || {}).textContent || '',
  bridgeSays: window.APEX_GOLD.botOpponentProductionId ? window.APEX_GOLD.botOpponentProductionId() : null,
  bridgeShellKey: window.APEX_GOLD.botOpponentShellKey ? window.APEX_GOLD.botOpponentShellKey() : null,
}));
lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
if (/LOCK|READY/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); }
await page.waitForFunction(() => document.body.classList.contains('battle-hud-open'), { timeout: 120000, polling: 80 });
await wait(2500);
const inBattle = await page.evaluate(() => {
  const f2 = window.fighters && window.fighters[1];
  const f1 = window.fighters && window.fighters[0];
  const side2 = document.querySelector('#p2Side');
  return {
    p1: f1 && f1.name, p2: f2 && f2.name,
    p2NameShown: (side2?.querySelector('.id-name, .name') || {}).textContent || '',
    p2Portrait: (side2?.querySelector('.apex-battle-avatar, .portrait img') || {}).getAttribute?.('src') || '',
    mode: (window.APEX_ARSENAL && window.APEX_ARSENAL.state || {}).battleMode,
    botId: window.APEX_GOLD.botOpponentProductionId ? window.APEX_GOLD.botOpponentProductionId() : null,
  };
});
// NEGATIVE LAW: in BOT mode P2 is the CPU - no human ability key may cast it.
await page.evaluate(() => {
  window.__botCalls = [];
  const HR = window.APEX_HERO_REWORK;
  if (HR && HR.pressAbility && !HR.pressAbility.__counted) {
    const base = HR.pressAbility;
    const wrapped = function (f, slot, opts) { window.__botCalls.push([slot, opts && opts.source, opts && opts.key, f && f.name]); return base.apply(this, arguments); };
    wrapped.__counted = true;
    HR.pressAbility = wrapped;
  }
});
await page.keyboard.press('Numpad1'); await wait(400);
await page.keyboard.press('Numpad2'); await wait(400);
await page.keyboard.press('KeyU'); await wait(400);   // local P2-era key, must also be inert
const botKeyCalls = await page.evaluate(() => window.__botCalls);
console.log('BOT_KEY_CALLS ' + JSON.stringify(botKeyCalls));
console.log('ACTIVE_BEFORE_P2_PICK ' + JSON.stringify(activeBefore));
console.log('AFTER_P2_PICK ' + JSON.stringify(picked));
console.log('IN_BATTLE ' + JSON.stringify(inBattle));
await page.screenshot({ path: `/tmp/botpick-${pick}.png` });
await browser.close();
