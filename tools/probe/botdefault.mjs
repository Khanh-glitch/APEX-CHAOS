// BOT regression + flow: the untouched default must still face ROBOT, and the
// post-match return must rematch the SAME chosen CPU in ONE action.
import { open, wait, waitStage } from './lib.mjs';
const { browser, page } = await open();
const hudUp = () => page.waitForFunction(() => document.body.classList.contains('battle-hud-open'), { timeout: 90000, polling: 60 });
const hudDown = () => page.waitForFunction(() => !document.body.classList.contains('battle-hud-open'), { timeout: 25000, polling: 60 });

// A) default BOT: pick nothing for the CPU -> the two presses still face ROBOT
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/, 20000);
await wait(500);
const d0 = await page.evaluate(() => document.getElementById('p2Side').querySelector('.fighterName')?.textContent);
await page.evaluate(() => document.querySelector('.rosterCard[data-hero="hunter"]')?.click());
await wait(400);
await page.evaluate(() => document.getElementById('lockIn')?.click());   // lock P1
await wait(700);
const d1 = await page.evaluate(() => ({ lock: document.getElementById('lockIn').innerText.trim(), tag: document.getElementById('p2Side').querySelector('.fighterTag')?.textContent }));
await page.evaluate(() => document.getElementById('lockIn')?.click());   // lock the (default) BOT slot
await hudUp();
await wait(2500);
const defaultFighters = await page.evaluate(() => (window.fighters || []).map((f) => f && f.name));
await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
await hudDown();
await wait(700);
const returned = await page.evaluate(() => ({
  matchReady: document.getElementById('stage').classList.contains('match-ready'),
  lock: document.getElementById('lockIn').innerText.trim(),
  botName: document.getElementById('p2Side').querySelector('.fighterName')?.textContent,
}));
// B) ONE action must rematch with the same CPU fighter
const t = Date.now();
await page.evaluate(() => document.getElementById('lockIn')?.click());
await hudUp();
const rematchMs = Date.now() - t;
await wait(2500);
const rematchFighters = await page.evaluate(() => (window.fighters || []).map((f) => f && f.name));
console.log('BOT_DEFAULT_NAME ' + d0);
console.log('BOT_DEFAULT_AFTER_P1 ' + JSON.stringify(d1));
console.log('BOT_DEFAULT_FIGHTERS ' + JSON.stringify(defaultFighters));
console.log('BOT_RETURNED ' + JSON.stringify(returned));
console.log('BOT_REMATCH ' + JSON.stringify({ rematchMs, fighters: rematchFighters }));
await browser.close();
