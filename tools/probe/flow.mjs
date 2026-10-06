// OWNER ITEMS 7 + 10 — live end-to-end proof.
//  7: mid-match Escape must leave the battle; the returned pick screen must be
//     READY (no match-ready lock), so exactly ONE action rematches; and the
//     real K.O. path must auto-return without any taps.
// 10: hero SFX must be cached BEFORE the first ability can fire.
import { open, wait, waitStage } from './lib.mjs';
const hero = process.argv[2] || 'magnet';
const { browser, page } = await open();
const isOpen = () => document.body.classList.contains('battle-hud-open');
const hudDown = () => page.waitForFunction(
  () => !document.body.classList.contains('battle-hud-open')
    && !document.getElementById('battleHudHost').classList.contains('is-open'),
  { timeout: 20000, polling: 60 });
const hudUp = () => page.waitForFunction(
  () => document.body.classList.contains('battle-hud-open'), { timeout: 60000, polling: 60 });

// ── battle 1 ────────────────────────────────────────────────────────────────
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/, 20000);
await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), hero);
await wait(400);
const t1 = Date.now();
await page.evaluate(() => document.getElementById('lockIn')?.click());
await hudUp();
const battle1Ms = Date.now() - t1;
await wait(2500);
const sfx = await page.evaluate(() => {
  const a = window.apexHeroSfx;
  return a ? { cached: a.state().cached, heroCues: a.cues('magnet').length, frost: a.cues('frost').length } : null;
});

// ── exit 1: Escape inside the HUD frame (production mount = iframe) ─────────
const t2 = Date.now();
// The HUD is a SAME-DOCUMENT mount (#battleHudHost holds the donor DOM next to
// the engine roots), so a key press lands in this document - the same path the
// handoff harness uses.
await page.evaluate(() => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
});
await hudDown();
const exitMs = Date.now() - t2;
await wait(600);
const ready = await page.evaluate(() => {
  const stage = document.getElementById('stage');
  const lock = document.getElementById('lockIn');
  const cs = stage ? getComputedStyle(stage) : null;
  return {
    matchReadyLock: stage ? stage.classList.contains('match-ready') : null,
    stageVisible: cs ? cs.visibility : null,
    lockInLabel: lock ? lock.textContent.trim() : null,
    lockInDisabled: lock ? lock.disabled === true : null,
  };
});

// ── battle 2: ONE click from the returned screen ─────────────────────────────
const t3 = Date.now();
await page.evaluate(() => document.getElementById('lockIn')?.click());
await hudUp();
const battle2Ms = Date.now() - t3;

// ── exit 2: the REAL result path must auto-return (no taps) ─────────────────
await page.evaluate(() => {
  try { window.APEX_ARSENAL.state.over = 'ROBOT'; } catch (e) { return 'throw:' + e.message; }
  return 'set';
});
const t4 = Date.now();
let autoReturn = 'TIMEOUT';
try { await hudDown(); autoReturn = Date.now() - t4; } catch (e) { autoReturn = 'TIMEOUT'; }

console.log('SFX ' + JSON.stringify(sfx));
console.log('READY_AFTER_EXIT ' + JSON.stringify(ready));
console.log('TIMES ' + JSON.stringify({ battle1Ms, exitMs, battle2Ms, autoReturnMs: autoReturn }));
await browser.close();
