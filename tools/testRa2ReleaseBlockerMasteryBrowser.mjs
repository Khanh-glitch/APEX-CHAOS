// Owner-reported RA-2 blocker regression: localized achievement display and
// accessible names in the progressed Mastery Vault. The profile is seeded in
// an isolated Chromium context and never touches a real save or game authority.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { CP3_NEWBOT_ACHIEVEMENT_IDS, cp3EntitledProfile } from './cp3MasteryFixture.mjs';
import { translateCopy } from '../src/game/localeCatalog.js';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error('CHROME_PATH is required');
const OUT = path.resolve(process.env.RA2_RELEASE_EVIDENCE_DIR || 'docs/acceptance/ra2/evidence/release-blocker/mastery-regression');
await mkdir(OUT, { recursive: true });
const owner = JSON.parse(fs.readFileSync('result-gold/src/data/ownerDecisions.json', 'utf8'));
const catalog = owner.items.filter((item) => item.decision === 'keep');
const titleById = new Map(catalog.map((item) => [item.id, item.name]));
const profile = cp3EntitledProfile({
  credits: 550,
  progression: { botMatches: 2, botWins: 1, localMatches: 0, claimedIds: [] },
});
profile.mastery.earned = {
  NEWBOT: Object.fromEntries(CP3_NEWBOT_ACHIEVEMENT_IDS.slice(0, 21).map((id, index) => [id, index + 1])),
};
profile.mastery.recent = CP3_NEWBOT_ACHIEVEMENT_IDS.slice(0, 8).map((achievementId, index) => ({
  heroId: 'NEWBOT', achievementId, at: Date.now() - index * 60_000,
}));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.createBrowserContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((serialized) => localStorage.setItem('apexChaos.arsenalMeta.v1', serialized), JSON.stringify(profile));
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 70_000 });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90_000 });
  await page.click('#apex-boot-start');
  await page.waitForSelector('#freeBattle', { visible: true, timeout: 60_000 });
  await page.click('#freeBattle');
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 60_000 });
  await page.waitForFunction(() => window.APEX_ARSENAL_META && window.APEX_I18N, { timeout: 45_000 });
  await page.evaluate(() => window.APEX_I18N.setLanguage('eng'));
  await page.click('#apexMissionsOpen');
  await page.waitForSelector('.apex-progress-panel', { visible: true, timeout: 15_000 });
  await page.click('.apex-progress-tabs button:last-child');
  await page.waitForSelector('.apex-mastery-vault', { visible: true, timeout: 10_000 });
  await page.waitForFunction(() => document.querySelectorAll('.apex-mastery-recent-chip').length === 8, { timeout: 10_000 });
  const offense = await page.$$('.apex-mastery-chapter-toggle');
  for (const button of offense) {
    if ((await button.evaluate((el) => el.innerText)).includes('OFFENSE')) {
      if (await button.evaluate((el) => el.getAttribute('aria-expanded')) !== 'true') await button.click();
      break;
    }
  }
  await page.waitForFunction(() => [...document.querySelectorAll('.apex-mastery-chapter')]
    .some((chapter) => chapter.querySelector('.apex-mastery-chapter-name')?.textContent === 'OFFENSE'
      && chapter.classList.contains('is-open')), { timeout: 10_000 });
  await sleep(250);

  const startingState = await page.evaluate(() => ({
    credits: window.APEX_ARSENAL_META.credits(),
    mastery: JSON.stringify(window.APEX_ARSENAL_META.getMastery()),
    total: document.querySelector('.apex-mastery-total strong')?.textContent.trim(),
    selected: document.querySelector('.apex-mastery-ring strong')?.textContent.trim(),
    recentCount: document.querySelectorAll('.apex-mastery-recent-chip').length,
    expanded: [...document.querySelectorAll('.apex-mastery-chapter.is-open .apex-mastery-chapter-name')].map((el) => el.textContent.trim()),
  }));
  assert.deepEqual({ credits: startingState.credits, total: startingState.total, selected: startingState.selected, recentCount: startingState.recentCount, expanded: startingState.expanded },
    { credits: 550, total: '21/252', selected: '21/42', recentCount: 8, expanded: ['OFFENSE'] }, 'owner progressed state is reproduced exactly');

  const inspectNames = async () => page.evaluate(() => ({
    recent: [...document.querySelectorAll('.apex-mastery-recent-chip b')].map((el) => el.textContent.trim()),
    medals: [...document.querySelectorAll('.apex-mastery-chapter.is-open .apex-mastery-medal')].map((el) => ({
      name: el.querySelector('h4')?.textContent.trim() || '',
      aria: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
    })),
    chapterNext: [...document.querySelectorAll('.apex-mastery-chapter-next')].map((el) => el.textContent.trim()),
    nextLines: [...document.querySelectorAll('.apex-mastery-next-line b')].map((el) => el.textContent.trim()),
    visibleText: document.querySelector('.apex-mastery-vault')?.innerText || '',
  }));
  const expected = (id, language) => translateCopy(titleById.get(id) || id, language);
  const assertLanguage = async (language) => {
    const actual = await inspectNames();
    const recentIds = profile.mastery.recent.map((item) => item.achievementId);
    const offenseIds = catalog.filter((item) => item.heroId == null || item.heroId === 'NEWBOT')
      .filter((item) => String(item.category).toUpperCase() === 'OFFENSE').map((item) => item.id);
    const expectedRecent = recentIds.map((id) => expected(id, language));
    const expectedOffense = offenseIds.map((id) => expected(id, language));
    const expectedChapterNext = actual.chapterNext.map((label) => {
      let result = label;
      for (const item of catalog) result = result.replaceAll(item.name, expected(item.id, language));
      return result;
    });
    return {
      language, actual,
      recentMatches: JSON.stringify(actual.recent) === JSON.stringify(expectedRecent),
      medalNamesMatch: actual.medals.length === expectedOffense.length
        && JSON.stringify([...actual.medals.map((item) => item.name)].sort()) === JSON.stringify([...expectedOffense].sort()),
      ariaNamesMatch: actual.medals.length === expectedOffense.length
        && actual.medals.every((item) => expectedOffense.includes(item.name) && item.aria.startsWith(`${item.name}.`)), 
      chapterNamesMatch: JSON.stringify(actual.chapterNext) === JSON.stringify(expectedChapterNext),
      nextLinesMatch: actual.nextLines.every((name) => catalog.some((item) => name === expected(item.id, language))),
      rawVietnameseLeaks: language === 'eng' ? catalog.filter((item) =>
        [
          ...actual.recent,
          ...actual.medals.flatMap((medal) => [medal.name, medal.aria, medal.title]),
          ...actual.chapterNext, ...actual.nextLines,
        ].some((value) => value.includes(item.name)))
        .map((item) => ({ id: item.id, name: item.name })) : [],
    };
  };

  const eng = await assertLanguage('eng');
  await page.screenshot({ path: path.join(OUT, 'progressed-550ac-21of252-newbot-21of42-eng-offense-1440x900.png') });
  await page.evaluate(() => window.APEX_I18N.setLanguage('vie'));
  await page.waitForFunction(() => document.documentElement.lang === 'vi', { timeout: 10_000 });
  await sleep(200);
  const vie = await assertLanguage('vie');
  await page.screenshot({ path: path.join(OUT, 'progressed-550ac-21of252-newbot-21of42-vie-offense-1440x900.png') });
  await page.evaluate(() => window.APEX_I18N.setLanguage('eng'));
  await page.waitForFunction(() => document.documentElement.lang === 'en', { timeout: 10_000 });
  await sleep(200);
  const restored = await assertLanguage('eng');
  const endingState = await page.evaluate(() => ({ credits: window.APEX_ARSENAL_META.credits(), mastery: JSON.stringify(window.APEX_ARSENAL_META.getMastery()) }));
  const checks = [
    [eng.recentMatches, 'ENG recent achievement names use canonical English'],
    [eng.medalNamesMatch, 'ENG expanded OFFENSE medal headings are localized'],
    [eng.ariaNamesMatch, 'ENG medal accessible labels use the same localized names'],
    [eng.chapterNamesMatch, 'ENG chapter-next achievement names are localized'],
    [eng.nextLinesMatch, 'ENG next-objective names are localized'],
    [eng.rawVietnameseLeaks.length === 0, 'ENG visible and accessible award-name surfaces contain no Vietnamese source names'],
    [vie.recentMatches && vie.medalNamesMatch && vie.ariaNamesMatch && vie.chapterNamesMatch && vie.nextLinesMatch, 'VIE names restore exactly on live language switch'],
    [restored.recentMatches && restored.medalNamesMatch && restored.ariaNamesMatch && restored.chapterNamesMatch && restored.nextLinesMatch, 'ENG names restore after VIE toggle'],
    [endingState.credits === startingState.credits && endingState.mastery === startingState.mastery, 'locale switching does not mutate AC or mastery award data'],
    [errors.length === 0, 'no uncaught browser errors'],
  ];
  const report = { viewport: '1440x900', sourceProfile: { credits: 550, total: '21/252', newbot: '21/42', recent: 8, expanded: 'OFFENSE' }, startingState, eng, vie, restored, checks: checks.map(([ok, name]) => ({ ok, name })), browserErrors: errors };
  await writeFile(path.join(OUT, 'mastery-localization-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('RA-2 release-blocker Mastery checks', JSON.stringify(report.checks));
  assert.ok(checks.every(([ok]) => ok), 'owner progressed Mastery profile must pass all localized visible/aria name checks');
} finally {
  await context.close();
  await browser.close();
}
