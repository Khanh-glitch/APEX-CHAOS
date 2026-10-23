// RA-2.3 (Tactical Pulse Non-Blocking Contract) — deferred autonomous-pickup
// status prompt, driven through BOTH real non-blocking BOT skill casts.
// Verifies:
//   1. Non-blocking skill lessons (window.APEX_TUTORIAL_PAUSE.active === false,
//      match clock ticks live, K taught first when J lacks floor gun, then J
//      taught once floor gun spawns); pickup prompt never competes with steps 3/4.
//   2. After both casts advance coach to step 5, truthful mode-accurate BOT
//      AUTO PICKUP copy renders ONLY when P1 is unarmed and a real revealed
//      gun exists on the arena floor, strictly inside #p1Side .weapon with
//      zero arena/skill/notification overlap across ENG, VIE, touch, keyboard,
//      and all 5 viewports (320x568, 768x1024, 844x390, 1284x692, 1440x900).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:4173/';
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error('CHROME_PATH is required');
const OUT = path.resolve(process.env.RA2_EVIDENCE_DIR || '/tmp/ra2-pickup-hint');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});

async function tap(page, selector) {
  const point = await page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.touchscreen.tap(point.x, point.y);
  await sleep(160);
}

async function runLanguage(language, options = {}) {
  const input = options.input || 'touch';
  const width = options.width || Number(process.env.RA2_VIEWPORT_WIDTH) || 390;
  const height = options.height || Number(process.env.RA2_VIEWPORT_HEIGHT) || 844;
  const isMobile = options.isMobile ?? true;
  const hasTouch = options.hasTouch ?? true;
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  const activate = (selector) => (input === 'touch' ? tap(page, selector) : page.click(selector));
  const castSlot = (slotIdx) => (
    input === 'touch'
      ? tap(page, `#p1Side .skill[data-i="${slotIdx}"]`)
      : page.keyboard.press(slotIdx === 0 ? 'j' : 'k')
  );
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile, hasTouch });
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 65000 });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await activate('#apex-boot-start');
  await page.waitForSelector('#freeBattle', { visible: true, timeout: 60000 });
  await page.waitForFunction(() => document.body?.dataset?.apexSceneTransition === 'DONE', { timeout: 60000 });
  await page.evaluate((lang) => window.APEX_I18N?.setLanguage?.(lang), language);
  await activate('#freeBattle');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-mode')
    && document.body?.dataset?.apexSceneTransition === 'DONE', { timeout: 30000 });
  await page.waitForSelector('.modeCard[data-mode="bot"]', { visible: true, timeout: 30000 });
  await activate('.modeCard[data-mode="bot"]');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-fighter')
    && document.body?.dataset?.apexSceneTransition === 'DONE', { timeout: 30000 });
  await activate('#lockIn');
  await page.waitForSelector('.fighter-active-p2', { timeout: 30000 });
  await activate('#lockIn');
  await page.waitForSelector('#battleHudHost.is-open #p1Side .skill', { timeout: 60000 });

  const waitLiveStep = async (step) => page.waitForFunction((expected) => {
    const coach = window.APEX_LEARN_BY_PLAYING?.state?.();
    const layer = document.querySelector('.apex-guide-dock');
    const slot = layer?.getAttribute('data-taught-slot');
    return coach?.step === expected
      && !window.APEX_TUTORIAL_PAUSE?.active
      && layer?.getAttribute('data-tutorial-paused') === 'false'
      && (slot === '0' || slot === '1');
  }, { timeout: 45000 }, step);

  await waitLiveStep(3);
  const lesson1 = await page.evaluate(() => ({
    body: document.querySelector('.apex-guide-body')?.textContent || '',
    taughtSlot: Number(document.querySelector('.apex-guide-dock')?.getAttribute('data-taught-slot')),
    paused: !!window.APEX_TUTORIAL_PAUSE?.active,
    clock: Number(window.APEX_ARSENAL?.state?.time) || 0,
    hint: !!document.querySelector('.apex-guide-weapon-hint, .apex-guide-pickup-prompt'),
  }));
  assert.equal(lesson1.paused, false, `${language}: skill lesson 1 must NOT pause simulation`);
  assert.equal(lesson1.hint, false, `${language}: pickup copy must not compete with skill lesson 1`);
  await page.screenshot({ path: path.join(OUT, `${language}-${input}-skill-1-live-${width}x${height}.png`) });

  await castSlot(lesson1.taughtSlot);
  await waitLiveStep(4);
  const lesson2 = await page.evaluate(() => ({
    body: document.querySelector('.apex-guide-body')?.textContent || '',
    taughtSlot: Number(document.querySelector('.apex-guide-dock')?.getAttribute('data-taught-slot')),
    paused: !!window.APEX_TUTORIAL_PAUSE?.active,
    clock: Number(window.APEX_ARSENAL?.state?.time) || 0,
    hint: !!document.querySelector('.apex-guide-weapon-hint, .apex-guide-pickup-prompt'),
  }));
  assert.equal(lesson2.paused, false, `${language}: skill lesson 2 must NOT pause simulation`);
  assert.notEqual(lesson2.taughtSlot, lesson1.taughtSlot, `${language}: lesson 2 must teach the remaining skill`);
  assert.equal(lesson2.hint, false, `${language}: pickup copy must not compete with skill lesson 2`);
  await page.screenshot({ path: path.join(OUT, `${language}-${input}-skill-2-live-${width}x${height}.png`) });

  if (lesson2.taughtSlot === 0) {
    await page.waitForFunction(() => window.APEX_HERO_REWORK?.observeAbilityCastability?.(window.fighters?.[0], 'A1')?.castable === true, { timeout: 25000 });
  }
  await castSlot(lesson2.taughtSlot);
  await page.waitForFunction(() => !window.APEX_TUTORIAL_PAUSE?.active
    && window.APEX_LEARN_BY_PLAYING?.state?.()?.step === 5, { timeout: 15000 });

  // Atomically await AND snapshot the live .apex-guide-pickup-prompt in a single frame
  // so an autonomous pickup 5ms later cannot race between two separate CDP round-trips.
  const promptHandle = await page.waitForFunction(() => {
    const state = window.APEX_ARSENAL?.state;
    const coach = window.APEX_LEARN_BY_PLAYING?.state?.();
    const self = window.fighters?.[0];
    const unarmed = !!self?.data && !self.data.arsenal?.weaponId;
    const isGun = window.APEX_ARSENAL_CONFIG?.isGun;
    const gunAvailable = typeof isGun === 'function' && Array.isArray(state?.slots)
      && state.slots.some((slot) => slot?.phase === 'REVEALED' && isGun(slot.weaponId) === true);
    if (!(coach?.step === 5 && !coach?.done && state?.active === true && !state?.over
      && String(state?.battleMode).toUpperCase() === 'BOT'
      && !window.APEX_TUTORIAL_PAUSE?.active
      && !document.body?.classList?.contains('apex-tutorial-paused')
      && unarmed && gunAvailable)) return null;

    const hint = document.querySelector('.apex-guide-pickup-prompt');
    const row = document.querySelector('#p1Side .weapon');
    if (!hint || !row) return null;
    const rowRect = row.getBoundingClientRect();
    const blockedByToast = [...document.querySelectorAll('.apex-achievement-toast, .apex-reward-toast, .apex-skin-unlock-dock')]
      .some((el) => {
        const style = getComputedStyle(el); const r = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0
          && r.left < rowRect.right && r.right > rowRect.left && r.top < rowRect.bottom && r.bottom > rowRect.top;
      });
    if (blockedByToast) return null;

    const canvas = [...document.querySelectorAll('canvas')].find((el) => {
      const r = el.getBoundingClientRect(); return r.width > 200 && r.height > 200;
    });
    const skills = [...document.querySelectorAll('#p1Side .skill')];
    const box = (el) => el?.getBoundingClientRect().toJSON() || null;
    const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return {
      text: hint.textContent?.trim(),
      aria: hint.getAttribute('aria-label'),
      role: hint.getAttribute('role'),
      layerZIndex: document.querySelector('.apex-guide-dock') && getComputedStyle(document.querySelector('.apex-guide-dock')).zIndex,
      pointerEvents: getComputedStyle(hint).pointerEvents,
      hintBox: box(hint), rowBox: box(row), canvasBox: box(canvas),
      overlapsCanvas: overlaps(hint.getBoundingClientRect(), canvas?.getBoundingClientRect()),
      overlapsSkills: skills.map((el) => overlaps(hint.getBoundingClientRect(), el.getBoundingClientRect())),
      overlapsNotifications: [...document.querySelectorAll('.apex-achievement-toast, .apex-reward-toast, .apex-skin-unlock-dock')]
        .filter((el) => {
          const style = getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0
            && overlaps(hint.getBoundingClientRect(), el.getBoundingClientRect());
        }).length,
      state: state?.battleMode,
      playerWeaponId: self?.data?.arsenal?.weaponId ?? null,
      revealedGunIds: (state?.slots || [])
        .filter((slot) => slot?.phase === 'REVEALED' && isGun(slot.weaponId) === true)
        .map((slot) => slot.weaponId),
      language: window.APEX_I18N?.getLanguage?.(),
      coachStep: coach?.step,
    };
  }, { timeout: 90000 });
  const prompt = await promptHandle.jsonValue();

  const expectedHint = language === 'vie'
    ? 'TỰ NHẶT SÚNG · Robot tự nhặt súng khi chạm súng trên sân.'
    : 'AUTO PICKUP · Your fighter collects a ground gun on contact.';
  assert.equal(prompt.text, expectedHint, `${language}: deferred pickup copy must state autonomous BOT pickup truthfully`);
  assert.doesNotMatch(prompt.text, /run over a gun|chạy qua khẩu súng/i, `${language}: deceptive manual walk instruction forbidden in BOT mode`);
  assert.equal(prompt.aria, expectedHint, `${language}: accessible label must match visible copy`);
  assert.equal(prompt.role, 'status');
  assert.ok(Number(prompt.layerZIndex) < 2147480700,
    `${language}: pickup-only coach layer must stack beneath achievement-toast priority`);
  assert.equal(prompt.pointerEvents, 'none');
  assert.equal(prompt.state, 'BOT');
  assert.equal(prompt.playerWeaponId, null, `${language}: P1 must be genuinely unarmed at display time`);
  assert.ok(prompt.revealedGunIds.length > 0, `${language}: display requires an actual revealed gun ID`);
  assert.equal(prompt.language, language);
  assert.equal(prompt.coachStep, 5);
  assert.ok(prompt.hintBox.left >= prompt.rowBox.left - 1 && prompt.hintBox.right <= prompt.rowBox.right + 1
    && prompt.hintBox.top >= prompt.rowBox.top - 1 && prompt.hintBox.bottom <= prompt.rowBox.bottom + 1,
  `${language}: hint must stay strictly inside #p1Side .weapon: ${JSON.stringify(prompt)}`);
  assert.equal(prompt.overlapsCanvas, false, `${language}: hint must not cover the arena`);
  assert.deepEqual(prompt.overlapsSkills, [false, false], `${language}: hint must not cover skill controls`);
  assert.equal(prompt.overlapsNotifications, 0, `${language}: hint must not cover higher-priority notifications`);
  assert.deepEqual(errors, [], `${language}: browser runtime errors`);
  await page.screenshot({ path: path.join(OUT, `${language}-${input}-pickup-opportunity-${width}x${height}.png`) });

  // Priority check: higher-priority achievement notification immediately suppresses pickup hint, then restores cleanly.
  await page.evaluate(() => {
    const row = document.querySelector('#p1Side .weapon').getBoundingClientRect();
    const blocker = document.createElement('div');
    blocker.className = 'apex-achievement-toast';
    blocker.dataset.ra2QaFixture = 'true';
    blocker.style.cssText = `position:fixed;left:${row.left}px;top:${row.top}px;width:${row.width}px;height:${row.height}px;z-index:2147480752;display:block;visibility:visible;opacity:1;pointer-events:none`;
    document.body.appendChild(blocker);
  });
  await page.waitForFunction(() => !document.querySelector('.apex-guide-pickup-prompt'), { timeout: 5000 });
  await page.evaluate(() => document.querySelector('[data-ra2-qa-fixture="true"]')?.remove());

  const viewportCases = input === 'touch' ? [
    { name: '320x568', width: 320, height: 568, isMobile: true, hasTouch: true },
    { name: '768x1024', width: 768, height: 1024, isMobile: true, hasTouch: true },
    { name: '844x390', width: 844, height: 390, isMobile: true, hasTouch: true },
    { name: '1284x692', width: 1284, height: 692, isMobile: true, hasTouch: true },
    { name: '1440x900', width: 1440, height: 900, isMobile: true, hasTouch: true },
  ] : [];
  for (const viewport of viewportCases) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await sleep(450);
    const layout = await page.evaluate(() => {
      const hint = document.querySelector('.apex-guide-pickup-prompt');
      const row = document.querySelector('#p1Side .weapon');
      const box = (el) => el?.getBoundingClientRect().toJSON() || null;
      const style = hint ? getComputedStyle(hint) : null;
      const rect = row?.getBoundingClientRect();
      const state = window.APEX_ARSENAL?.state;
      const coach = window.APEX_LEARN_BY_PLAYING?.state?.();
      const isGun = window.APEX_ARSENAL_CONFIG?.isGun;
      const eligible = coach?.step === 5 && !coach?.done && state?.active === true && !state?.over
        && String(state?.battleMode).toUpperCase() === 'BOT'
        && !window.APEX_TUTORIAL_PAUSE?.active
        && !document.body?.classList?.contains('apex-tutorial-paused')
        && !!window.fighters?.[0]?.data && !window.fighters?.[0]?.data?.arsenal?.weaponId
        && typeof isGun === 'function'
        && state?.slots?.some((slot) => slot?.phase === 'REVEALED' && isGun(slot.weaponId) === true);
      const visible = !!rect && rect.width >= 112 && rect.height >= 28 && rect.left >= 0 && rect.top >= 0
        && rect.right <= innerWidth && rect.bottom <= innerHeight;
      const blocked = !!rect && [...document.querySelectorAll('.apex-achievement-toast, .apex-reward-toast, .apex-skin-unlock-dock')]
        .some((el) => {
          const s = getComputedStyle(el); const r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0
            && rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top;
        });
      return {
        viewport: { width: innerWidth, height: innerHeight },
        hint: box(hint), row: box(row), visible, blocked, eligible,
        fontSize: style?.fontSize || null,
        textScrollHeight: hint?.scrollHeight ?? null,
        textClientHeight: hint?.clientHeight ?? null,
      };
    });
    if (layout.visible && !layout.blocked && layout.eligible) {
      await page.waitForFunction(() => {
        const hint = document.querySelector('.apex-guide-pickup-prompt');
        const row = document.querySelector('#p1Side .weapon')?.getBoundingClientRect();
        if (!hint || !row) return false;
        const r = hint.getBoundingClientRect();
        return r.left >= row.left - 1 && r.right <= row.right + 1
          && r.top >= row.top - 1 && r.bottom <= row.bottom + 1;
      }, { timeout: 5000 });
      assert.ok(parseFloat(layout.fontSize) >= 8, `${language}/${viewport.name}: text fell below 8px`);
      assert.ok(layout.textScrollHeight <= layout.textClientHeight + 1,
        `${language}/${viewport.name}: pickup copy clips: ${JSON.stringify(layout)}`);
    } else {
      assert.equal(layout.hint, null,
        `${language}/${viewport.name}: unsafe row or overlapping notification must suppress the hint: ${JSON.stringify(layout)}`);
    }
    await page.screenshot({ path: path.join(OUT, `${language}-pickup-${viewport.name}.png`) });
    console.log(`RA-2.3 ${language.toUpperCase()} ${viewport.name}: ${layout.hint ? 'prompt inside HUD row' : 'cleanly deferred/suppressed'}`);
  }
  console.log(`RA-2.3 ${language.toUpperCase()} (${input}) PASS: non-blocking skill lessons + truthful AUTO PICKUP verified`);
  await context.close();
}

try {
  const languages = String(process.env.RA2_LANGUAGES || 'eng,vie').split(',')
    .map((language) => language.trim().toLowerCase()).filter((language) => ['eng', 'vie'].includes(language));
  assert.ok(languages.length > 0, 'RA2_LANGUAGES must include eng and/or vie');
  for (const language of languages) await runLanguage(language);
  await runLanguage('eng', {
    input: 'keyboard', width: 1284, height: 692, isMobile: false, hasTouch: false,
  });
  console.log(`RA-2.3 deferred pickup browser gate PASS (${languages.join(',')} touch + ENG keyboard); evidence: ${OUT}`);
} finally {
  await browser.close();
}
