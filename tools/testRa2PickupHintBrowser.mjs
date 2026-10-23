// RA-2.3 — deferred real-pickup hint, driven through both real BOT skill casts.
// The hint must not compete with either held pause lesson. It can render only
// after both production casts complete, while unpaused, unarmed, and a real
// revealed production-configured gun is available; it must stay inside the
// existing P1 weapon-status row, away from the arena and skill controls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
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
  await sleep(180);
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
  const activate = (selector) => input === 'touch' ? tap(page, selector) : page.click(selector);
  const cast = (selector, key) => input === 'touch' ? tap(page, selector) : page.keyboard.press(key);
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

  const waitPausedStep = async (step) => page.waitForFunction((expected) => {
    const coach = window.APEX_LEARN_BY_PLAYING?.state?.();
    const layer = document.querySelector('.apex-guide-dock');
    return coach?.step === expected && !!window.APEX_TUTORIAL_PAUSE?.active
      && layer?.getAttribute('data-tutorial-paused') === 'true';
  }, { timeout: 180000 }, step);

  await waitPausedStep(3);
  const lesson1 = await page.evaluate(() => ({
    body: document.querySelector('.apex-guide-body')?.textContent || '',
    paused: !!window.APEX_TUTORIAL_PAUSE?.active,
    clock: Number(window.APEX_ARSENAL?.state?.time) || 0,
    revealed: window.APEX_ARSENAL?.state?.slots?.filter((slot) => slot?.phase === 'REVEALED').length || 0,
    hint: !!document.querySelector('.apex-guide-weapon-hint, .apex-guide-pickup-prompt'),
  }));
  assert.equal(lesson1.paused, true, `${language}: skill 1 must hold the actual tutorial pause lease`);
  assert.equal(lesson1.hint, false, `${language}: pickup copy competes with paused skill 1`);
  const lesson1Expected = input === 'touch'
    ? (language === 'vie' ? /Chạm thẻ Kỹ năng 1 ngay\./ : /Tap Skill 1 now\./)
    : (language === 'vie' ? /Nhấn J ngay\./ : /Press J now\./);
  assert.match(lesson1.body, lesson1Expected);
  await page.screenshot({ path: path.join(OUT, `${language}-${input}-skill-1-paused-${width}x${height}.png`) });

  await cast('#p1Side .skill[data-i="0"]', 'j');
  await page.waitForFunction(() => !window.APEX_TUTORIAL_PAUSE?.active, { timeout: 10000 });
  await waitPausedStep(4);
  const lesson2 = await page.evaluate(() => ({
    body: document.querySelector('.apex-guide-body')?.textContent || '',
    paused: !!window.APEX_TUTORIAL_PAUSE?.active,
    hint: !!document.querySelector('.apex-guide-weapon-hint, .apex-guide-pickup-prompt'),
  }));
  assert.equal(lesson2.paused, true, `${language}: skill 2 must have its own held pause lease`);
  assert.equal(lesson2.hint, false, `${language}: pickup copy competes with paused skill 2`);
  const lesson2Expected = input === 'touch'
    ? (language === 'vie' ? /Chạm thẻ Kỹ năng 2 ngay\./ : /Tap Skill 2 now\./)
    : (language === 'vie' ? /Nhấn K ngay\./ : /Press K now\./);
  assert.match(lesson2.body, lesson2Expected);
  await page.screenshot({ path: path.join(OUT, `${language}-${input}-skill-2-paused-${width}x${height}.png`) });

  await cast('#p1Side .skill[data-i="1"]', 'k');
  try {
    await page.waitForFunction(() => !window.APEX_TUTORIAL_PAUSE?.active
      && window.APEX_LEARN_BY_PLAYING?.state?.()?.step === 5, { timeout: 22000 });
  } catch (error) {
    console.error(`RA-2.3 ${language} skill 2 cast did not advance:`, JSON.stringify(await page.evaluate(() => ({
      coach: window.APEX_LEARN_BY_PLAYING?.state?.(),
      pause: window.APEX_TUTORIAL_PAUSE,
      card: document.querySelector('#p1Side .skill[data-i="1"]')?.dataset,
      battle: window.getArsenalBattleDebugState?.(),
    })), null, 2));
    throw error;
  }

  // Wait for a naturally occurring, actual revealed gun and unarmed P1. This
  // is a real integrated match, not a slot fixture or a relaxed assertion.
  await page.waitForFunction(() => {
    const state = window.APEX_ARSENAL?.state;
    const coach = window.APEX_LEARN_BY_PLAYING?.state?.();
    const self = window.fighters?.[0];
    const unarmed = !!self?.data && !self.data.arsenal?.weaponId;
    const isGun = window.APEX_ARSENAL_CONFIG?.isGun;
    const gunAvailable = typeof isGun === 'function' && Array.isArray(state?.slots)
      && state.slots.some((slot) => slot?.phase === 'REVEALED' && isGun(slot.weaponId) === true);
    return coach?.step === 5 && !coach?.done && state?.active === true && !state?.over
      && String(state?.battleMode).toUpperCase() === 'BOT'
      && !window.APEX_TUTORIAL_PAUSE?.active
      && !document.body?.classList?.contains('apex-tutorial-paused')
      && unarmed && gunAvailable;
  }, { timeout: 120000 }).catch(async (error) => {
    console.error(`RA-2.3 ${language} real opportunity not observed:`, JSON.stringify(await page.evaluate(() => ({
      coach: window.APEX_LEARN_BY_PLAYING?.state?.(),
      battle: window.getArsenalBattleDebugState?.(),
      selfArsenal: window.fighters?.[0]?.data?.arsenal || null,
      tutorialPause: window.APEX_TUTORIAL_PAUSE,
    })), null, 2));
    throw error;
  });
  const notificationState = await page.evaluate(() => {
    const row = document.querySelector('#p1Side .weapon')?.getBoundingClientRect();
    const blockers = [...document.querySelectorAll('.apex-achievement-toast, .apex-reward-toast, .apex-skin-unlock-dock')]
      .filter((el) => {
        const style = getComputedStyle(el); const r = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0
          && row && r.left < row.right && r.right > row.left && r.top < row.bottom && r.bottom > row.top;
      });
    return { overlapping: blockers.length, prompt: !!document.querySelector('.apex-guide-pickup-prompt') };
  });
  if (notificationState.overlapping) {
    assert.equal(notificationState.prompt, false,
      `${language}: defer pickup instruction rather than overlap an active notification`);
  }
  await page.waitForFunction(() => {
    const hint = document.querySelector('.apex-guide-pickup-prompt');
    const row = document.querySelector('#p1Side .weapon')?.getBoundingClientRect();
    if (!hint || !row) return false;
    return ![...document.querySelectorAll('.apex-achievement-toast, .apex-reward-toast, .apex-skin-unlock-dock')]
      .some((el) => {
        const style = getComputedStyle(el); const r = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0
          && r.left < row.right && r.right > row.left && r.top < row.bottom && r.bottom > row.top;
      });
  }, { timeout: 30000 });

  const prompt = await page.evaluate(() => {
    const hint = document.querySelector('.apex-guide-pickup-prompt');
    const row = document.querySelector('#p1Side .weapon');
    const canvas = [...document.querySelectorAll('canvas')].find((el) => {
      const r = el.getBoundingClientRect(); return r.width > 200 && r.height > 200;
    });
    const skills = [...document.querySelectorAll('#p1Side .skill')];
    const box = (el) => el?.getBoundingClientRect().toJSON() || null;
    const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return {
      text: hint?.textContent?.trim(),
      aria: hint?.getAttribute('aria-label'),
      role: hint?.getAttribute('role'),
      layerZIndex: document.querySelector('.apex-guide-dock') && getComputedStyle(document.querySelector('.apex-guide-dock')).zIndex,
      pointerEvents: hint && getComputedStyle(hint).pointerEvents,
      hintBox: box(hint), rowBox: box(row), canvasBox: box(canvas),
      overlapsCanvas: overlaps(hint?.getBoundingClientRect(), canvas?.getBoundingClientRect()),
      overlapsSkills: skills.map((el) => overlaps(hint?.getBoundingClientRect(), el.getBoundingClientRect())),
      overlapsNotifications: [...document.querySelectorAll('.apex-achievement-toast, .apex-reward-toast, .apex-skin-unlock-dock')]
        .filter((el) => {
          const style = getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0
            && overlaps(hint?.getBoundingClientRect(), el.getBoundingClientRect());
        }).length,
      state: window.APEX_ARSENAL?.state?.battleMode,
      playerWeaponId: window.fighters?.[0]?.data?.arsenal?.weaponId ?? null,
      revealedGunIds: (window.APEX_ARSENAL?.state?.slots || [])
        .filter((slot) => slot?.phase === 'REVEALED' && window.APEX_ARSENAL_CONFIG?.isGun?.(slot.weaponId) === true)
        .map((slot) => slot.weaponId),
      language: window.APEX_I18N?.getLanguage?.(),
      coachStep: window.APEX_LEARN_BY_PLAYING?.state?.()?.step,
    };
  });
  const expectedHint = language === 'vie'
    ? 'Chưa có súng — chạy qua khẩu súng trên sân để nhặt.'
    : 'No weapon yet — run over a gun on the ground to pick it up.';
  assert.equal(prompt.text, expectedHint, `${language}: deferred pickup copy must match the selected locale`);
  assert.equal(prompt.aria, expectedHint, `${language}: accessible label must match the visible copy`);
  assert.equal(prompt.role, 'status');
  assert.ok(Number(prompt.layerZIndex) < 2147480700,
    `${language}: pickup-only coach layer must stack beneath the achievement-toast priority`);
  assert.equal(prompt.pointerEvents, 'none');
  assert.equal(prompt.state, 'BOT');
  assert.equal(prompt.playerWeaponId, null, `${language}: P1 must be genuinely unarmed at display time`);
  assert.ok(prompt.revealedGunIds.length > 0, `${language}: display requires an actual revealed gun ID`);
  assert.equal(prompt.language, language);
  assert.equal(prompt.coachStep, 5);
  assert.ok(prompt.hintBox.left >= prompt.rowBox.left - 1 && prompt.hintBox.right <= prompt.rowBox.right + 1
    && prompt.hintBox.top >= prompt.rowBox.top - 1 && prompt.hintBox.bottom <= prompt.rowBox.bottom + 1,
  `${language}: hint must stay inside the existing weapon row: ${JSON.stringify(prompt)}`);
  assert.equal(prompt.overlapsCanvas, false, `${language}: hint must not cover the arena`);
  assert.deepEqual(prompt.overlapsSkills, [false, false], `${language}: hint must not cover skill controls`);
  assert.equal(prompt.overlapsNotifications, 0, `${language}: hint must not cover higher-priority notifications`);
  assert.deepEqual(errors, [], `${language}: browser runtime errors`);
  await page.screenshot({ path: path.join(OUT, `${language}-${input}-pickup-opportunity-${width}x${height}.png`) });

  // A real notification layer has priority over the deferred hint. This
  // geometry-only fixture lives only in the isolated QA browser and is
  // removed immediately; it never mutates achievements or wallet state.
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
  await page.waitForFunction(() => !!document.querySelector('.apex-guide-pickup-prompt'), { timeout: 5000 });

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
        hintStyle: hint ? { display: style?.display, visibility: style?.visibility, opacity: style?.opacity } : null,
        coachStep: window.APEX_LEARN_BY_PLAYING?.state?.()?.step,
        coachDone: window.APEX_LEARN_BY_PLAYING?.state?.()?.done,
        active: state?.active, over: state?.over, battleMode: state?.battleMode,
        playerWeaponId: window.fighters?.[0]?.data?.arsenal?.weaponId ?? null,
        revealedGunIds: state?.slots?.filter((slot) => slot?.phase === 'REVEALED'
          && window.APEX_ARSENAL_CONFIG?.isGun?.(slot.weaponId) === true).map((slot) => slot.weaponId) || [],
        paused: !!window.APEX_TUTORIAL_PAUSE?.active,
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
    const disposition = layout.hint ? 'prompt inside HUD row'
      : layout.blocked ? 'deferred behind notification'
        : !layout.eligible ? 'no live unarmed/revealed-gun opportunity at resize'
          : 'fail-closed (weapon row not safely visible)';
    console.log(`RA-2.3 ${language.toUpperCase()} ${viewport.name}: ${disposition}`);
  }
  console.log(`RA-2.3 ${language.toUpperCase()} PASS: paused skill prompts prioritized; real unarmed + revealed-gun hint displayed after both casts`);
  console.log(JSON.stringify({ language, lesson1, lesson2, prompt }, null, 2));
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
