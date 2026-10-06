// OWNER ASK (this turn) — LIVE proof of both:
//  1. LOCAL 1v1: the RIGHT-hand numpad pair (Numpad1/Numpad2) casts P2 abilities;
//     the top-row Digit1/Digit2 pair must be inert.
//  2. BOT: the player picks the CPU's fighter and the real spawned opponent IS it.
import { open, wait, waitStage } from './lib.mjs';
const { browser, page } = await open({ viewport: { width: 1280, height: 720 } });

async function toBattle(mode, p1, p2) {
  await page.click('#freeBattle');
  await waitStage(page, /screen-mode/);
  await page.click(`.modeCard[data-mode="${mode}"]`);
  await waitStage(page, /screen-fighter/, 20000);
  // P1 pick
  await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), p1);
  await wait(350);
  let lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(600); }
  // P2 / CPU pick
  if (p2) {
    await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), p2);
    await wait(350);
    lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
    if (/LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(600); }
  }
  lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/READY/i.test(lock) || /LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); }
  await page.waitForFunction(() => document.body.classList.contains('battle-hud-open'), { timeout: 120000, polling: 80 });
  await wait(2500);
}

// ── 1. LOCAL 1v1 key law ────────────────────────────────────────────────────
await toBattle("local1v1", "newbot", "frost");
// Truthful readout: the ONE production skill projection the Gold HUD renders
// from (skillTruthFor -> ct.__ctl.cooldownLeft), plus the engine's own per-slot
// state. Nothing here is a second authority.
const p2State = () => page.evaluate(() => {
  const proj = window.APEX_GOLD_PROJECTION ? window.APEX_GOLD_PROJECTION() : null;
  const side = proj && proj.state && proj.state.sides ? proj.state.sides[1] : null;
  const f = window.fighters && window.fighters[1];
  const ct = f && (f.__hrCombatant || (f.anchor && f.anchor.__hrCombatant));
  const cd = ct && ct.__ctl && typeof ct.__ctl.cooldownLeft === 'function'
    ? [0, 1].map((slot) => Math.round(Number(ct.__ctl.cooldownLeft(slot)) * 100) / 100) : null;
  return {
    name: f && f.name,
    battleMode: (window.APEX_ARSENAL && window.APEX_ARSENAL.state || {}).battleMode,
    projSkills: side && side.skills ? side.skills.map((s) => ({ slot: s.slot, state: s.state, cd: Math.round((Number(s.cdLeft) || 0) * 100) / 100 })) : null,
    ctCd: cd,
  };
});
const before = await p2State();
// REAL CDP key presses (a synthetic event could be caught by a different path
// than the player's actual keyboard).
const fire = async (keyName) => {
  await page.keyboard.press(keyName);
  await wait(700);
  return p2State();
};
const afterDigit1 = await fire('Digit1');
const afterDigit2 = await fire('Digit2');
const afterNumpad1 = await fire('Numpad1');
await wait(1500);
const afterNumpad2 = await fire('Numpad2');
console.log('LOCAL_BEFORE ' + JSON.stringify(before));
console.log('AFTER_Digit1 ' + JSON.stringify(afterDigit1));
console.log('AFTER_Digit2 ' + JSON.stringify(afterDigit2));
console.log('AFTER_Numpad1 ' + JSON.stringify(afterNumpad1));
console.log('AFTER_Numpad2 ' + JSON.stringify(afterNumpad2));
await browser.close();
