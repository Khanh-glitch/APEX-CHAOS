// Independent RA-2 review regression: an award must originate in the active
// battle's real resultLedger -> recordMasteryProvisional path. At 844x390 the
// mobile HUD has no safe dock; the same award stays pending until portrait
// geometry exposes a safe band, then becomes visibly readable without overlap.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import owner from '../result-gold/src/data/ownerDecisions.json' with { type: 'json' };
import { translateCopy } from '../src/game/localeCatalog.js';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error('CHROME_PATH is required');
const OUT = path.resolve(process.env.RA2_RELEASE_EVIDENCE_DIR || 'docs/acceptance/ra2/evidence/release-blocker/toast-review-gaps');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(OUT, { recursive: true });

const units = [...new Set(owner.items.filter((item) => item.decision === 'keep')
  .flatMap((item) => (item.params || []).map((param) => param.unit).filter(Boolean)))];
const localizedUnits = units.map((unit) => ({
  source: unit, eng: translateCopy(unit, 'eng'), vie: translateCopy(unit, 'vie'),
}));
const longestEnglishUnit = localizedUnits.reduce((best, item) => item.eng.length > (best?.eng.length || 0) ? item : best, null);
const unitChecks = [
  { ok: translateCopy('lượt', 'eng') === 'uses', name: 'the exact failing lượt unit translates to uses in ENG' },
  { ok: translateCopy('lượt', 'vie') === 'lượt', name: 'lượt restores in VIE' },
  { ok: translateCopy('giây', 'eng') === 'seconds' && translateCopy('giây', 'vie') === 'giây', name: 'the longest English unit seconds round-trips through ENG and VIE' },
  { ok: longestEnglishUnit?.eng === 'seconds', name: 'the longest keep-catalog English unit is covered' },
  { ok: localizedUnits.every((item) => item.vie === item.source && !['lượt','lần','giây','chuỗi','món'].some((unit) => item.eng === unit)), name: 'all display-only keep-catalog units preserve VIE and remove known Vietnamese leaks in ENG' },
];

const browserErrors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'] });
const context = await browser.createBrowserContext();
const page = await context.newPage();
page.on('pageerror', (error) => browserErrors.push(String(error)));
const checks = [...unitChecks];
const measurements = [];
const check = (ok, name, detail) => {
  checks.push({ ok: !!ok, name, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} Toast review gaps: ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
};

async function openLiveBattle() {
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => localStorage.setItem('apex.alpha.coach.v2', JSON.stringify({
    version: 2, step: 6, done: true, skipped: true, baselineBotMatches: 0, baselineSealedMatches: 0,
  })));
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 65_000 });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90_000 });
  await page.click('#apex-boot-start');
  await page.waitForSelector('#freeBattle', { visible: true, timeout: 60_000 });
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 60_000 });
  await page.evaluate(() => window.APEX_I18N?.setLanguage?.('eng'));
  await page.click('#freeBattle');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-mode')
    && document.body.dataset.apexSceneTransition === 'DONE', { timeout: 30_000 });
  await page.waitForSelector('.modeCard[data-mode="bot"]', { visible: true, timeout: 30_000 });
  await page.click('.modeCard[data-mode="bot"]');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-fighter')
    && document.body.dataset.apexSceneTransition === 'DONE', { timeout: 30_000 });
  await page.click('#lockIn');
  await page.waitForSelector('.fighter-active-p2', { timeout: 30_000 });
  await page.click('#lockIn');
  await page.waitForSelector('#battleHudHost.is-open #p1Side .skill', { timeout: 60_000 });
  await page.waitForFunction(() => window.APEX_ARSENAL?.state?.active === true
    && String(window.APEX_ARSENAL?.state?.battleMode).toUpperCase() === 'BOT'
    && window.APEX_ARSENAL?.state?.resultLedger, { timeout: 30_000 });
}

async function inspectToast(viewport, language) {
  return page.evaluate(({ viewport, language }) => {
    const toast = document.querySelector('.apex-achievement-toast[data-owner-side="P1"]');
    if (!toast) return null;
    const box = toast.getBoundingClientRect();
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0
        && rect.width > 0 && rect.height > 0;
    };
    const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const selectors = [
      '#p1Side .skill','#p2Side .skill','#p1Side .weapon','#p2Side .weapon',
      '#p1Rail','#p2Rail','#matchCenter','#arena','#arenaCanvas',
      '#apexFirstPlayGuide','#firstPlayGuide','[data-apex-first-play-guide]',
      '.apex-first-play-guide','.first-play-guide',
    ];
    const blockers = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
      .filter(visible).map((element) => {
        const rect = element.getBoundingClientRect();
        return { selector: element.id ? `#${element.id}` : String(element.className || element.tagName),
          box: rect.toJSON(), overlap: overlap(box, rect) };
      });
    const meter = toast.querySelector('.apex-achievement-toast-meter');
    return {
      viewport, language, title: toast.querySelector('strong')?.textContent.trim() || '',
      visible: visible(toast), role: toast.getAttribute('role'), ariaLive: toast.getAttribute('aria-live'),
      statusText: toast.innerText.replace(/\s+/g, ' ').trim(), meterText: meter?.innerText.replace(/\s+/g, ' ').trim() || '',
      meterStatus: meter?.getAttribute('aria-label') || '', dockSafe: toast.dataset.dockSafe,
      visualPending: toast.dataset.visualPending, box: box.toJSON(), blockers,
      overlaps: blockers.filter((item) => item.overlap),
      ownerSide: toast.dataset.ownerSide, ownerKind: toast.dataset.ownerKind,
      provisional: toast.dataset.provisional, walletEligible: toast.dataset.walletEligible,
    };
  }, { viewport, language });
}

try {
  await openLiveBattle();
  const baseline = await page.evaluate(() => ({
    credits: window.APEX_ARSENAL_META?.credits?.(),
    mastery: JSON.stringify(window.APEX_ARSENAL_META?.getMastery?.() || {}),
    coachDone: window.APEX_LEARN_BY_PLAYING?.state?.()?.done,
  }));
  check(baseline.coachDone === true, 'the live First Play guide remains closed');

  // Exercise the native match-owned ledger with real live fighter references.
  // No unlock event is dispatched by this test and HP is never assigned.
  const nativeStimulus = await page.evaluate(() => {
    const state = window.APEX_ARSENAL?.state;
    const ledger = state?.resultLedger;
    const actors = window.fighters;
    if (!ledger || !Array.isArray(actors) || actors.length < 2) return { ready: false };
    const weaponId = Object.keys(window.APEX_ARSENAL_CONFIG?.WEAPONS || {})
      .find((id) => window.APEX_ARSENAL_CONFIG.WEAPONS[id]?.family === 'SEMI');
    if (!weaponId) return { ready: false, reason: 'no live SEMI weapon in native config' };
    window.__ra2NativeProvisionalEvidence = [];
    window.addEventListener('apex:mastery-provisional', (event) => {
      window.__ra2NativeProvisionalEvidence.push({
        source: event.detail?.source,
        unlocks: (event.detail?.unlocks || []).map((item) => ({
          achievementId: item.achievementId, heroId: item.heroId, ownerSide: item.ownerSide,
          ownerKind: item.ownerKind, walletEligible: item.walletEligible,
          provisional: item.provisional, value: item.value,
        })),
      });
    });
    const player = actors[0], rival = actors[1];
    const label = `arsenal-${weaponId.toLowerCase().replaceAll('_', '-')}`;
    const hpBefore = [player.hp, rival.hp];
    for (let index = 0; index < 8; index += 1) {
      ledger.onShot(player, weaponId);
      ledger.onDamage(rival, player, label, 1, false, null, null);
    }
    const hpAfterStimulus = [player.hp, rival.hp];
    return { ready: true, weaponId, actorNames: [player.name, rival.name], hpBefore, hpAfterStimulus };
  });
  check(nativeStimulus.ready === true, 'the active BOT match exposes its native ledger and actual fighter references', nativeStimulus);
  if (nativeStimulus.ready) {
    await page.waitForFunction(() => window.__ra2NativeProvisionalEvidence?.some((batch) =>
      batch.source === 'live-match-provisional' && batch.unlocks.some((item) => item.achievementId === 'steady-hand')),
    { timeout: 15_000 });
  }
  const nativeEvidence = await page.evaluate(() => ({
    batches: window.__ra2NativeProvisionalEvidence || [],
    hp: (window.fighters || []).slice(0, 2).map((fighter) => fighter.hp),
    credits: window.APEX_ARSENAL_META?.credits?.(),
    mastery: JSON.stringify(window.APEX_ARSENAL_META?.getMastery?.() || {}),
  }));
  const nativeAward = nativeEvidence.batches.flatMap((batch) => batch.unlocks.map((item) => ({ ...item, source: batch.source })))
    .find((item) => item.achievementId === 'steady-hand');
  check(nativeAward?.source === 'live-match-provisional' && nativeAward.value === 8
    && nativeAward.provisional === true && nativeAward.ownerSide === 'P1' && nativeAward.walletEligible === true,
  'the actual ledger produces the exact 8-of-6 P1 provisional event through the production record path', nativeAward);
  check(JSON.stringify(nativeStimulus.hpAfterStimulus) === JSON.stringify(nativeStimulus.hpBefore),
    'native-ledger probe leaves both fighters’ HP unchanged', { before: nativeStimulus.hpBefore, after: nativeStimulus.hpAfterStimulus });
  check(nativeEvidence.credits === baseline.credits && nativeEvidence.mastery === baseline.mastery,
    'provisional record does not mutate wallet or permanent mastery', { credits: nativeEvidence.credits });

  await sleep(3_000); // Longer than the provisional display duration: no safe dock must pause it.
  const landscape = await inspectToast('844x390', 'eng');
  check(!!landscape && landscape.dockSafe === 'false' && landscape.visualPending === 'true'
    && landscape.visible === false,
  '844x390 has no legal HUD dock and the real provisional toast remains pending, not visually passed', landscape);
  await page.screenshot({ path: path.join(OUT, 'steady-hand-native-eng-p1-844x390.png') });
  measurements.push(landscape);

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.waitForFunction(() => {
    const toast = document.querySelector('.apex-achievement-toast[data-owner-side="P1"]');
    return toast?.dataset.dockSafe === 'true' && toast.dataset.visualPending === 'false';
  }, { timeout: 12_000 }).catch(() => {});
  await sleep(180);
  const portraitEng = await inspectToast('390x844', 'eng');
  const engMeter = portraitEng?.meterText || '';
  const engStatus = portraitEng?.meterStatus || '';
  check(!!portraitEng && portraitEng.visible && portraitEng.dockSafe === 'true'
    && portraitEng.provisional === 'true' && portraitEng.ownerSide === 'P1'
    && portraitEng.walletEligible === 'true' && portraitEng.overlaps.length === 0,
  'at 390x844 the same native award becomes visibly readable in a safe band with zero HUD overlap', portraitEng);
  check(engMeter === '8 / 6 uses' && engStatus === 'Achieved 8 uses; target 6 uses'
    && portraitEng?.statusText.includes('8 / 6 uses'),
  'visible ENG meter and live status distinguish achieved 8 from target 6 and localize lượt to uses', { engMeter, engStatus, text: portraitEng?.statusText });
  await page.screenshot({ path: path.join(OUT, 'steady-hand-native-eng-p1-390x844.png') });
  measurements.push(portraitEng);

  await page.evaluate(() => window.APEX_I18N?.setLanguage?.('vie'));
  await page.waitForFunction(() => document.documentElement.lang === 'vi', { timeout: 10_000 }).catch(() => {});
  await sleep(120);
  const portraitVie = await inspectToast('390x844', 'vie');
  check(!!portraitVie && portraitVie.visible && portraitVie.dockSafe === 'true'
    && portraitVie.meterText === '8 / 6 lượt'
    && portraitVie.meterStatus === 'Đã đạt 8 lượt; mục tiêu 6 lượt'
    && portraitVie.statusText.includes('8 / 6 lượt'),
  'visible VIE meter and live status restore the same achieved/target copy and unit', portraitVie);
  const longestUnitMeasurement = await page.evaluate(() => {
    const toast = document.querySelector('.apex-achievement-toast[data-owner-side="P1"]');
    const em = toast?.querySelector('.apex-achievement-toast-meter em');
    const meter = toast?.querySelector('.apex-achievement-toast-meter');
    const copy = toast?.querySelector('.apex-achievement-toast-copy');
    if (!em || !meter || !copy) return { missing: true };
    const priorText = em.textContent;
    const priorLabel = meter.getAttribute('aria-label');
    em.textContent = '8 / ≤ 2 seconds';
    meter.setAttribute('aria-label', 'Achieved 8 seconds; target at most 2 seconds');
    const glyphs = em.getBoundingClientRect(), column = copy.getBoundingClientRect();
    const result = { text: em.textContent, status: meter.getAttribute('aria-label'),
      glyphs: { left: glyphs.left, right: glyphs.right, width: glyphs.width },
      copy: { left: column.left, right: column.right, width: column.width },
      scrollWidth: em.scrollWidth, clientWidth: em.clientWidth,
      fits: glyphs.left >= column.left - 1 && glyphs.right <= column.right + 1 && em.scrollWidth <= em.clientWidth + 1 };
    em.textContent = priorText;
    meter.setAttribute('aria-label', priorLabel || '');
    return result;
  });
  check(longestUnitMeasurement.text === '8 / ≤ 2 seconds'
    && longestUnitMeasurement.status === 'Achieved 8 seconds; target at most 2 seconds'
    && longestUnitMeasurement.fits,
  'worst-case longest English unit seconds fits the visible mobile meter and explicit status copy', longestUnitMeasurement);
  await page.screenshot({ path: path.join(OUT, 'steady-hand-native-vie-p1-390x844.png') });
  measurements.push(portraitVie);

  await page.evaluate(() => window.APEX_I18N?.setLanguage?.('eng'));
  await page.waitForFunction(() => document.documentElement.lang === 'en', { timeout: 10_000 }).catch(() => {});
  const ending = await page.evaluate(() => ({
    credits: window.APEX_ARSENAL_META?.credits?.(),
    mastery: JSON.stringify(window.APEX_ARSENAL_META?.getMastery?.() || {}),
  }));
  check(ending.credits === baseline.credits && ending.mastery === baseline.mastery,
    'ENG↔VIE display switching preserves wallet and permanent mastery', ending);
  check(browserErrors.length === 0, 'no uncaught browser errors', browserErrors);

  const report = {
    app: APP, sourcePath: 'active BOT state.resultLedger.evaluateLive -> APEX_ARSENAL_META.recordMasteryProvisional',
    evidence: nativeEvidence, nativeStimulus, achievement: 'steady-hand',
    actual: 8, threshold: 6, units: localizedUnits, longestEnglishUnit,
    measurements, checks, browserErrors,
  };
  await writeFile(path.join(OUT, 'toast-layout-report.json'), JSON.stringify(report, null, 2) + '\n');
  assert.ok(checks.every((item) => item.ok), 'native provisional meter, localization, and safe-dock visual regressions must pass');
} finally {
  await context.close();
  await browser.close();
}
