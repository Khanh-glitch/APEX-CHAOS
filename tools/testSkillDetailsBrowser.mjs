import { GUEST_ONLY_RELEASE } from '../src/game/releasePolicy.js';
// A1 browser acceptance — production progression, Account Center, Admin
// gate, and symmetrical P1/P2 SKILL DETAILS on the built product.
//
// Proof level: BROWSER ACCEPTANCE (vite preview + real Chrome input).
// Verifies with real mouse/keyboard:
//   * a fresh player boots with 350 AC + NEWBOT only (Home chip, wallet,
//     Account Center all agree; no 12,000 seed, no roster override),
//   * Account Center opens from the Home chip with honest cloud state,
//   * Fighter Select carries an identical SKILL DETAILS control on BOTH
//     sides; P1, P2 and the BOT opponent resolve the same component/data,
//   * PASSIVE/A1/A2 names, descriptions and cooldown semantics equal the
//     production registry truth (EN + VI),
//   * inspecting never selects/locks/launches; background keys are inert
//     while the panel is open; ESC/close restores focus,
//   * switching the presented fighter changes the details (no stale data),
//   * locked fighters stay unselectable through every surface,
//   * a normal player pressing Ctrl+Shift+F8 is denied (no admin session),
//   * portrait + landscape keep the panel on-screen.
// P1 and P2 are exercised INDEPENDENTLY — neither pass implies the other.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const url = (process.env.APEX_APP_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = process.env.APEX_EVIDENCE_DIR || 'docs/a1/skill-details-browser';
fs.mkdirSync(output, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: `${output}/${name}.png` });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});

async function bootHome(page) {
  await page.goto(url + '/?goldViewport=native', { waitUntil: 'domcontentloaded', timeout: 65000 });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await page.click('#apex-boot-start');
  await page.waitForFunction(
    () => !!document.querySelector('#freeBattle') && document.body?.dataset?.apexSceneTransition === 'DONE',
    { timeout: 60000 });
  await sleep(500);
}

async function enterFighterSelect(page, modeText) {
  await page.click('#freeBattle');
  await page.waitForSelector('.modeCard', { visible: true, timeout: 30000 });
  await sleep(600);
  const clicked = await page.evaluate((needle) => {
    const card = [...document.querySelectorAll('.modeCard')]
      .find((c) => (c.innerText || '').toUpperCase().includes(needle));
    if (!card) return false;
    card.click();
    return true;
  }, modeText);
  assert.equal(clicked, true, `mode card ${modeText} clickable`);
  await page.waitForFunction(
    () => document.querySelector('#stage')?.classList.contains('screen-fighter'),
    { timeout: 45000 });
  await page.waitForFunction(
    () => !!window.APEX_SKILL_DETAILS
      && !!document.querySelector('.apex-skill-details-btn[data-side="p1"]')
      && !!document.querySelector('.apex-skill-details-btn[data-side="p2"]'),
    { timeout: 45000 });
  await sleep(600);
}

const sideState = (page) => page.evaluate(() => ({
  p1Hero: document.querySelector('#p1Side')?.dataset.hero || '',
  p2Hero: document.querySelector('#p2Side')?.dataset.hero || '',
  p1Name: document.querySelector('#p1Name')?.textContent || '',
  p2Name: document.querySelector('#p2Name')?.textContent || '',
  p1BtnHidden: document.querySelector('.apex-skill-details-btn[data-side="p1"]')?.hidden,
  p2BtnHidden: document.querySelector('.apex-skill-details-btn[data-side="p2"]')?.hidden,
  p1Locked: document.querySelector('#stage')?.classList.contains('fighter-p1-locked'),
  modalOpen: !!document.querySelector('#apex-skill-details.is-open'),
  modalTitle: document.querySelector('.apex-sd-name')?.textContent || '',
  modalKicker: document.querySelector('.apex-sd-kicker')?.textContent || '',
  skills: [...document.querySelectorAll('.apex-sd-skill')].map((el) => ({
    slot: el.dataset.slot,
    name: el.querySelector('.apex-sd-skillname')?.textContent || '',
    meta: el.querySelector('.apex-sd-meta')?.textContent || '',
    desc: el.querySelector('.apex-sd-desc')?.textContent || '',
    icon: el.querySelector('img.apex-sd-icon')?.getAttribute('src') || '',
  })),
}));

const REGISTRY_TRUTH = {
  newbot: {
    name: 'NEWBOT',
    skills: {
      PASSIVE: { name: 'ROLLING BURST', desc: 'Damage dealt inside a 1.2-second burst window refunds skill cooldown.' },
      A1: { name: 'WEAPON DASH', desc: 'Quickly closes the distance to a revealed floor weapon.', meta: /10\.0S COOLDOWN/ },
      A2: { name: 'VIRTUAL ARMOR', desc: 'Reduces incoming damage for 3 seconds.', meta: /3\.0S ACTIVE · 10\.0S CD/ },
    },
  },
  hunter: {
    name: 'HUNTER',
    skills: {
      PASSIVE: { name: "PREDATOR'S LAW", desc: 'Marked prey turns WEAK for 1 second: it takes 25% more damage and deals 25% less.' },
      A1: { name: 'TRAP DEPLOY', desc: 'Plants a trap that roots the first opponent who steps in.', meta: /3 CHARGES · 6\.5S RECHARGE/ },
      A2: { name: 'DASH / STRIKE', desc: 'Dashes in with a strike that can disarm the opponent.', meta: /12\.0S COOLDOWN/ },
    },
  },
};

function assertDetails(state, heroKey, sideLabelPart) {
  const truth = REGISTRY_TRUTH[heroKey];
  assert.equal(state.modalOpen, true, 'modal open');
  assert.equal(state.modalTitle, truth.name, `modal hero is ${truth.name}`);
  assert.ok(state.modalKicker.includes(sideLabelPart), `kicker identifies side (${state.modalKicker})`);
  assert.equal(state.skills.length, 3, 'three skill rows');
  for (const s of state.skills) {
    const t = truth.skills[s.slot];
    assert.equal(s.name, t.name, `${heroKey}/${s.slot} canonical name`);
    assert.equal(s.desc, t.desc, `${heroKey}/${s.slot} registry description`);
    assert.ok(s.icon.length > 4, `${heroKey}/${s.slot} approved icon present`);
    if (t.meta) assert.match(s.meta, t.meta, `${heroKey}/${s.slot} cooldown semantics`);
    if (s.slot === 'PASSIVE') assert.equal(s.meta, 'ALWAYS ACTIVE', 'passive semantic');
  }
}

// ── Scenario 1: fresh player (desktop) ─────────────────────────────────────
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await bootHome(page);

  const home = await page.evaluate(() => ({
    ac: document.querySelector('[data-apex-ac]')?.textContent,
    oldTopAccount: !!document.querySelector('.profileIdentity'),
    bottomAccount: !!document.querySelector('[data-apex-account-entry]'),
    credits: window.APEX_ARSENAL_META?.credits(),
    owned: window.APEX_ARSENAL_META?.getState().ownedFighters,
    canSelectHunter: window.APEX_ARSENAL_META?.canPublicSelect('HUNTER'),
    canSelectRobot: window.APEX_ARSENAL_META?.canPublicSelect('ROBOT'),
    accountName: window.APEX_PLAYER_ACCOUNT?.profile().displayName,
    isAdmin: window.APEX_ADMIN_AUTHORITY?.isAdmin(),
    cloud: window.APEX_CLOUD_ACCOUNT?.isCloudConfigured(),
  }));
  assert.equal(home.ac, '350 AC', 'Home AC chip shows the A1 fresh balance');
  assert.equal(home.credits, 350, 'wallet boots at exactly 350');
  assert.deepEqual(home.owned, ['ROBOT'], 'fresh ownership is NEWBOT only');
  assert.equal(home.canSelectHunter, false, 'unowned fighter is not selectable');
  assert.equal(home.canSelectRobot, true, 'NEWBOT selectable');
  assert.equal(home.oldTopAccount, false, 'retired duplicate top account identity is absent');
  assert.equal(home.bottomAccount, true, 'existing lower Home Account entry opens the real profile');
  assert.equal(home.isAdmin, false, 'fresh player is not admin');
  await shot(page, 'desktop-home-fresh');

  // Account Center (guest, honest cloud state)
  await page.click('[data-apex-account-entry]');
  await page.waitForSelector('.apex-account-overlay.is-open', { timeout: 15000 });
  const acct = await page.evaluate(() => ({
    credits: document.querySelector('[data-account-credits]')?.textContent,
    owned: document.querySelector('[data-account-owned]')?.textContent,
    ownedChips: [...document.querySelectorAll('[data-owned-fighter]')].map((e) => e.dataset.ownedFighter),
    lockedChips: document.querySelectorAll('[data-locked-fighter]').length,
    sync: document.querySelector('[data-account-sync]')?.textContent,
    googleDisabled: [...document.querySelectorAll('.apex-account-btn')]
      .find((b) => b.textContent.includes('GOOGLE'))?.disabled,
  }));
  assert.equal(acct.credits, '350 AC');
  assert.equal(acct.owned, '1 / 8');
  assert.deepEqual(acct.ownedChips, ['ROBOT']);
  assert.equal(acct.lockedChips, 7);
  if (home.cloud === false) {
    if (GUEST_ONLY_RELEASE) {
      assert.ok(acct.sync.includes('ĐÃ BẬT LƯU TRÊN THIẾT BỊ'), 'Guest release truthfully labels local save');
      assert.equal(acct.googleDisabled, undefined, 'Guest release renders no disabled fake Google button');
      assert.equal(await page.$('[aria-label="SIGN IN"]'), null, 'Guest release has no Cloud login section');
    } else {
      assert.ok(acct.sync.includes('CLOUD NOT CONFIGURED'), 'honest unconfigured sync state');
      assert.equal(acct.googleDisabled, true, 'no fake login button when cloud is unconfigured');
    }
  }
  await shot(page, 'desktop-account-guest');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.apex-account-overlay'), { timeout: 10000 });

  // Fighter Select vs BOT — symmetric details
  await enterFighterSelect(page, 'SOLO');
  let st = await sideState(page);
  assert.equal(st.p1Hero, 'newbot');
  assert.equal(st.p2Hero, 'newbot', 'BOT opponent defaults to production NEWBOT');
  assert.equal(st.p1BtnHidden, false, 'P1 details control visible');
  assert.equal(st.p2BtnHidden, false, 'P2/BOT details control visible');

  // P1 details (mouse)
  await page.click('.apex-skill-details-btn[data-side="p1"]');
  await sleep(400);
  st = await sideState(page);
  assertDetails(st, 'newbot', 'P1');
  assert.equal(st.p1Hero, 'newbot', 'inspecting did not change P1');
  assert.equal(st.p1Locked, false, 'inspecting did not lock P1');
  await shot(page, 'desktop-p1-details-newbot');
  // Background keys are inert while open: arrows cannot move the selection…
  await page.keyboard.press('ArrowRight');
  await sleep(300);
  st = await sideState(page);
  assert.equal(st.modalOpen, true, 'panel survives background arrow keys');
  assert.equal(st.p1Hero, 'newbot', 'arrow key did not change selection behind panel');
  assert.equal(st.p1Locked, false);
  // …and Enter (focused on the panel's close control) activates CLOSE —
  // it must never fall through to the shell's LOCK IN.
  await page.keyboard.press('Enter');
  await sleep(300);
  st = await sideState(page);
  assert.equal(st.modalOpen, false, 'Enter activated the close control');
  assert.equal(st.p1Locked, false, 'Enter did not lock behind panel');
  // Reopen and close with ESC for the focus-restore check
  await page.click('.apex-skill-details-btn[data-side="p1"]');
  await sleep(400);
  assert.equal((await sideState(page)).modalOpen, true, 'panel reopens');
  await page.keyboard.press('Escape');
  await sleep(300);
  st = await sideState(page);
  assert.equal(st.modalOpen, false);
  const focusedSide = await page.evaluate(() => document.activeElement?.dataset?.side || '');
  assert.equal(focusedSide, 'p1', 'focus restored to the P1 details button');

  // BOT (P2) details — exercised independently
  await page.click('.apex-skill-details-btn[data-side="p2"]');
  await sleep(400);
  st = await sideState(page);
  assertDetails(st, 'newbot', 'BOT');
  await shot(page, 'desktop-p2-bot-details-newbot');
  await page.click('[data-sd-close]');
  await sleep(300);
  assert.equal((await sideState(page)).modalOpen, false, 'close button closes');

  // Locked fighter cannot be selected (fresh player owns NEWBOT only)
  await page.evaluate(() => document.querySelector('.rosterCard[data-hero="hunter"]')?.click());
  await sleep(400);
  st = await sideState(page);
  assert.equal(st.p1Hero, 'newbot', 'locked HUNTER stays unselectable');

  // Admin denial for a normal player
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.press('F8');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  await sleep(500);
  const adminProbe = await page.evaluate(() => ({
    overlay: document.querySelector('#aq-owner-keyboard-overlay')?.textContent || '',
    ownerTest: window.APEX_ARSENAL_OWNER_TEST?.active,
    session: window.APEX_ADMIN_AUTHORITY?.isAdminTestSessionActive(),
  }));
  assert.equal(adminProbe.ownerTest, false, 'owner test never activates for a normal player');
  assert.equal(adminProbe.session, false, 'no admin session is granted by the shortcut');
  if (adminProbe.overlay) assert.ok(adminProbe.overlay.includes('ACCESS DENIED'), 'explicit denial feedback');

  await page.close();
  await ctx.close();
  console.log('A1 browser scenario 1 PASS: fresh economy + account + BOT skill details symmetry + admin denial');
}

// ── Scenario 2: seeded owner of HUNTER (switching + VI + LOCAL P2-empty) ──
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('apexChaos.arsenalMeta.v1', JSON.stringify({
      version: 1, credits: 425, ownedFighters: ['ROBOT', 'HUNTER'],
      lastSelectedP1: 'ROBOT', lastSelectedP2: 'ROBOT', totalSpins: 1,
      unlockedAt: { ROBOT: 0, HUNTER: 123 }, arenaPaletteId: null, claimedMatchIds: [],
    }));
  });
  await bootHome(page);
  const preserved = await page.evaluate(() => ({
    credits: window.APEX_ARSENAL_META?.credits(),
    ac: document.querySelector('[data-apex-ac]')?.textContent,
  }));
  assert.equal(preserved.credits, 425, 'existing balance preserved verbatim (no reseed)');
  assert.equal(preserved.ac, '425 AC');

  await enterFighterSelect(page, 'LOCAL');
  let st = await sideState(page);
  assert.equal(st.p2BtnHidden, true, 'LOCAL: no P2 details before a P2 fighter exists');
  assert.equal(await page.evaluate(() => window.APEX_SKILL_DETAILS.open('p2')), false, 'P2 details refuse empty side');

  // Switch P1 to the owned HUNTER, then inspect (details must follow)
  await page.evaluate(() => document.querySelector('.rosterCard[data-hero="hunter"]')?.click());
  await sleep(500);
  st = await sideState(page);
  assert.equal(st.p1Hero, 'hunter', 'owned HUNTER selectable');
  await page.click('.apex-skill-details-btn[data-side="p1"]');
  await sleep(400);
  st = await sideState(page);
  assertDetails(st, 'hunter', 'P1');
  await shot(page, 'desktop-p1-details-hunter');
  await page.keyboard.press('Escape');
  await sleep(300);

  // VI: names/descriptions/button localize from the same authorities
  await page.evaluate(() => window.APEX_I18N?.setLanguage('vie'));
  await sleep(600);
  const viBtn = await page.evaluate(() =>
    document.querySelector('.apex-skill-details-btn[data-side="p1"] span')?.textContent);
  assert.equal(viBtn, 'CHI TIẾT KỸ NĂNG', 'VI button label');
  await page.click('.apex-skill-details-btn[data-side="p1"]');
  await sleep(400);
  st = await sideState(page);
  const a1 = st.skills.find((s) => s.slot === 'A1');
  assert.equal(a1.name, 'ĐẶT BẪY', 'VI canonical A1 name (TRAP DEPLOY)');
  assert.equal(a1.desc, 'Đặt một cái bẫy trói chân đối thủ đầu tiên bước vào.', 'VI registry description');
  await shot(page, 'desktop-p1-details-hunter-vie');
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.evaluate(() => window.APEX_I18N?.setLanguage('eng'));
  await sleep(400);

  // Lock P1 → P2 fighter deploys → P2 details become available and correct
  await page.click('#lockIn');
  await sleep(700);
  st = await sideState(page);
  assert.equal(st.p1Locked, true, 'P1 locked by the real lock-in control');
  assert.equal(st.p2BtnHidden, false, 'P2 details available after deployment');
  await page.click('.apex-skill-details-btn[data-side="p2"]');
  await sleep(400);
  st = await sideState(page);
  assertDetails(st, st.p2Hero === 'hunter' ? 'hunter' : 'newbot', 'P2');
  await shot(page, 'desktop-p2-details-local');
  await page.keyboard.press('Escape');

  await page.close();
  await ctx.close();
  console.log('A1 browser scenario 2 PASS: switching + VI + LOCAL P2 lifecycle');
}

// ── Scenario 3: responsive (portrait P1, landscape P2) ─────────────────────
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 391, height: 844, isMobile: true, hasTouch: true });
  await bootHome(page);
  await enterFighterSelect(page, 'SOLO');
  await page.tap('.apex-skill-details-btn[data-side="p1"]');
  await sleep(500);
  let st = await sideState(page);
  assertDetails(st, 'newbot', 'P1');
  const box = await page.evaluate(() => {
    const r = document.querySelector('.apex-sd-panel')?.getBoundingClientRect();
    return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight } : null;
  });
  assert.ok(box && box.left >= 0 && box.right <= box.vw && box.top >= 0 && box.bottom <= box.vh + 1,
    `portrait panel on-screen ${JSON.stringify(box)}`);
  await shot(page, 'portrait-p1-details-newbot');
  await page.keyboard.press('Escape');
  await sleep(300);

  await page.setViewport({ width: 851, height: 393, isMobile: true, hasTouch: true });
  await sleep(600);
  await page.tap('.apex-skill-details-btn[data-side="p2"]');
  await sleep(500);
  st = await sideState(page);
  assertDetails(st, 'newbot', 'BOT');
  const box2 = await page.evaluate(() => {
    const r = document.querySelector('.apex-sd-panel')?.getBoundingClientRect();
    return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight } : null;
  });
  assert.ok(box2 && box2.left >= 0 && box2.right <= box2.vw && box2.bottom <= box2.vh + 1,
    `landscape panel on-screen ${JSON.stringify(box2)}`);
  await shot(page, 'landscape-p2-details-newbot');
  await page.keyboard.press('Escape');

  await page.close();
  await ctx.close();
  console.log('A1 browser scenario 3 PASS: portrait/landscape touch details');}

await browser.close();
console.log('A1 BROWSER ACCEPTANCE PASS: economy, account, admin denial, P1+P2 skill details (independent), VI, responsive');
