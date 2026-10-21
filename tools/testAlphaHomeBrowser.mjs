// Alpha Home acceptance (browser, production preview).
//
// Owner Requirement A/B laws, proven on the real build — not on an
// adaptation layer (the old runtime-surgery approach was retired; Home
// routes are stamped by tools/buildGoldCutover.mjs at generation time):
//   * exactly ONE account entry (bottom-nav #apexAccountOpen); the
//     retired top identity chip and dead settings button are absent;
//   * AC readout is visible and equals the live wallet balance;
//   * ENG|VIE is a segmented top-cluster control and switching to VIE
//     really translates the Home CTA;
//   * the CP3 Learn by Playing coach auto-shows for a genuinely new guest,
//     advances from the real FREE BATTLE action without blocking play,
//     persists SKIP across reload, and replays via "?";
//   * Account and Missions panels open from the bottom nav and close
//     with Escape;
//   * on a phone viewport the guide still leaves FREE BATTLE tappable.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

assert.equal(typeof process.env.CHROME_PATH, 'string', 'CHROME_PATH is required');
const url = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.APEX_EVIDENCE_DIR
  ? path.resolve(process.env.APEX_EVIDENCE_DIR)
  : path.join(root, 'qa-evidence', 'alpha-home');
fs.mkdirSync(output, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`  ✓ ${label}`); };

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`) });

async function bootHome(page) {
  await page.goto(url + '/?goldViewport=native', { waitUntil: 'domcontentloaded', timeout: 65000 });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await page.click('#apex-boot-start');
  await page.waitForFunction(
    () => !!document.querySelector('#freeBattle') && document.body?.dataset?.apexSceneTransition === 'DONE',
    { timeout: 60000 });
  await sleep(900);
}

const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.setViewport({ width: 1440, height: 900 });
await bootHome(page);

const home = await page.evaluate(() => ({
  account: document.querySelectorAll('#apexAccountOpen').length,
  missions: document.querySelectorAll('#apexMissionsOpen').length,
  chips: document.querySelectorAll('.profileIdentity').length,
  settings: document.querySelectorAll('.settings').length,
  acText: document.querySelector('[data-apex-ac]')?.textContent?.trim(),
  credits: window.APEX_ARSENAL_META?.credits?.(),
  langOptions: [...document.querySelectorAll('[data-apex-language-option]')]
    .map((b) => `${b.dataset.apexLanguageOption}:${b.getAttribute('aria-pressed')}`),
  guideOpen: !!document.querySelector('.apex-guide-card'),
  coach: (() => { try { return JSON.parse(localStorage.getItem('apex.alpha.coach.v2') || 'null'); } catch { return null; } })(),
  coachText: document.querySelector('.apex-guide-card')?.textContent?.replace(/\s+/g, ' ').trim(),
}));
check('single account + missions entries; no dead header controls', () => {
  assert.equal(home.account, 1);
  assert.equal(home.missions, 1);
  assert.equal(home.chips, 0);
  assert.equal(home.settings, 0);
});
check('AC readout equals the live wallet (350 fresh)', () => {
  assert.equal(home.credits, 350);
  assert.equal(home.acText, '350 AC');
});
check('ENG|VIE segmented control mounted with ENG active', () => {
  assert.deepEqual(home.langOptions, ['eng:true', 'vie:false']);
});
check('CP3 coach auto-shows for a genuinely new guest at step 1/6', () => {
  assert.equal(home.guideOpen, true);
  assert.equal(home.coach?.version, 2);
  assert.equal(home.coach?.step, 0);
  assert.equal(home.coach?.done, false);
  assert.equal(home.coach?.skipped, false);
  assert.match(home.coachText || '', /START HERE/);
  assert.match(home.coachText || '', /FREE BATTLE/);
});
await shot(page, 'alpha-home-desktop-guide');

// The coach must never block starting a match: use the real FREE BATTLE
// click point while its Home chip is open.
await page.click('#freeBattle');
const reachedModes = true;
await page.waitForSelector('.modeCard', { visible: true, timeout: 30000 });
check('FREE BATTLE is reachable while the CP3 coach is open', () => assert.equal(reachedModes, true));
// CP3 replaces the old off-Home hide/seen-flag contract: the real click
// advances the persisted coach to the VS BOT step, but does not complete it.
await page.waitForFunction(() => {
  const coach = window.APEX_LEARN_BY_PLAYING?.state?.();
  const text = document.querySelector('.apex-guide-card')?.textContent || '';
  return coach?.step === 1 && coach?.done === false && /FIRST FIGHT/.test(text) && /VS BOT/.test(text);
}, { timeout: 10000 });
const coachAfterFreeBattle = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.alpha.coach.v2') || 'null'));
check('CP3 coach advances from the real FREE BATTLE action without completing', () => {
  assert.equal(coachAfterFreeBattle?.version, 2);
  assert.equal(coachAfterFreeBattle?.step, 1);
  assert.equal(coachAfterFreeBattle?.done, false);
  assert.equal(coachAfterFreeBattle?.skipped, false);
});
await page.keyboard.press('Escape'); // back out of mode select
await sleep(700);
await page.waitForSelector('#freeBattle', { visible: true, timeout: 30000 });

// SKIP is the coach's only interactive element. It finishes and persists
// the v2 coach; reload must not auto-show it, while "?" replays it fresh.
await page.waitForSelector('.apex-coach-skip', { visible: true, timeout: 10000 });
await page.click('.apex-coach-skip');
await page.waitForFunction(() => !document.querySelector('.apex-guide-card'), { timeout: 10000 });
const skippedCoach = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.alpha.coach.v2') || 'null'));
check('SKIP persists the finished CP3 coach', () => {
  assert.equal(skippedCoach?.done, true);
  assert.equal(skippedCoach?.skipped, true);
});
await bootHome(page);
const afterReload = await page.evaluate(() => !!document.querySelector('.apex-guide-card'));
check('CP3 coach does not auto-show again after SKIP + reload', () => assert.equal(afterReload, false));
await page.click('#apex-guide-open');
await page.waitForSelector('.apex-coach-skip', { visible: true, timeout: 10000 });
const replayedCoach = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.alpha.coach.v2') || 'null'));
check('"?" control replays the CP3 coach on demand', () => {
  assert.equal(replayedCoach?.step, 0);
  assert.equal(replayedCoach?.done, false);
  assert.equal(replayedCoach?.skipped, false);
});
await page.click('.apex-coach-skip');
await page.waitForFunction(() => !document.querySelector('.apex-guide-card'), { timeout: 10000 });

// Language switch really translates the Home CTA, both ways.
await page.click('[data-apex-language-option="vie"]');
await page.waitForFunction(
  () => document.querySelector('#freeBattle')?.textContent?.includes('ĐẤU'), { timeout: 10000 });
check('VIE switch translates the Home CTA', () => {});
await page.click('[data-apex-language-option="eng"]');
await page.waitForFunction(
  () => /FREE BATTLE/.test(document.querySelector('#freeBattle')?.textContent || ''), { timeout: 10000 });
check('ENG switch restores the original copy', () => {});

// Account + Missions from the one bottom nav, Escapable.
await page.click('#apexAccountOpen');
await page.waitForSelector('.apex-account-overlay.is-open', { timeout: 15000 });
const acct = await page.evaluate(() => ({
  credits: document.querySelector('[data-account-credits]')?.textContent,
  signInButtons: [...document.querySelectorAll('.apex-account-btn')]
    .filter((b) => /GOOGLE|SIGN IN|OTP/.test(b.textContent || '') && !b.disabled).length,
}));
check('Account Center opens; no sign-in is demanded in Guest Alpha', () => {
  assert.equal(acct.credits, '350 AC');
  assert.equal(acct.signInButtons, 0);
});
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.querySelector('.apex-account-overlay'), { timeout: 10000 });

await page.click('#apexMissionsOpen');
await page.waitForSelector('.apex-progress-panel', { visible: true, timeout: 15000 });
const prog = await page.evaluate(() => ({
  rows: document.querySelectorAll('.apex-progress-row').length,
  balance: document.querySelector('.apex-progress-balance strong')?.textContent,
  claimButtonsEnabled: [...document.querySelectorAll('.apex-progress-claim')].filter((b) => !b.disabled).length,
}));
check('Missions panel opens with locked (not pre-claimable) rewards', () => {
  assert.equal(prog.rows, 5, 'CP3 Starter Contracts shows all five real-AC contracts');
  assert.equal(prog.balance, '350 AC');
  assert.equal(prog.claimButtonsEnabled, 0);
});
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.querySelector('.apex-progress-panel'), { timeout: 10000 });
await shot(page, 'alpha-home-desktop-after-panels');
await ctx.close();

// Phone: guide present but FREE BATTLE still tappable (real tap point).
const mctx = await browser.createBrowserContext();
const mpage = await mctx.newPage();
await mpage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await bootHome(mpage);
await mpage.waitForSelector('.apex-guide-card', { visible: true, timeout: 15000 });
const tapTarget = await mpage.evaluate(() => {
  const el = document.querySelector('#freeBattle');
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return { cx, cy, hitSelf: !!hit && (hit === el || el.contains(hit)) };
});
check('phone: guide never covers the FREE BATTLE tap point', () => {
  assert.equal(tapTarget.hitSelf, true, JSON.stringify(tapTarget));
});
await mpage.touchscreen.tap(tapTarget.cx, tapTarget.cy);
await mpage.waitForSelector('.modeCard', { visible: true, timeout: 30000 });
check('phone: tapping FREE BATTLE reaches mode select with guide open', () => {});
await shot(mpage, 'alpha-home-phone-modes');
await mctx.close();

const fatal = errors.filter((e) => !/asset-failed|ENGINEER/.test(e));
assert.equal(fatal.length, 0, `page errors: ${fatal.join(' | ')}`);
await browser.close();
console.log(`ALPHA HOME BROWSER ACCEPTANCE: PASS (${checks} checks)`);
