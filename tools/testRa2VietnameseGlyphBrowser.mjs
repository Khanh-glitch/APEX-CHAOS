// RA-2.2 browser gate for Vietnamese Gold display-font loading and glyph
// rendering, including precomposed upper/lowercase and decomposed combining
// sequences. Uses the production Home DOM/font, not a mock screen.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error('CHROME_PATH is required');
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 65000 });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await page.click('#apex-boot-start');
  await page.waitForSelector('#freeBattle', { visible: true, timeout: 60000 });
  await page.waitForFunction(() => document.body?.dataset?.apexSceneTransition === 'DONE', { timeout: 60000 });
  await page.evaluate(() => window.APEX_I18N?.setLanguage?.('vie'));
  const audit = await page.evaluate(async () => {
    const samples = [
      { label: 'uppercase precomposed', text: 'Ắ Ằ Ẳ Ẵ Ặ Ấ Ầ Ẩ Ẫ Ậ' },
      { label: 'lowercase precomposed', text: 'ắ ằ ẳ ẵ ặ ấ ầ ẩ ẫ ậ' },
      { label: 'combining acute/dot/circumflex/horn', text: 'A\u0301 E\u0323\u0302 o\u0302 u\u031B' },
    ];
    const font = '700 28px ApexVietCondensed';
    await document.fonts.load(font, samples.map((sample) => sample.text).join(' '));
    await document.fonts.ready;
    const title = document.querySelector('#gold-shell-host #stage .storyTitle');
    const titleStyle = title && getComputedStyle(title);
    const faces = [...document.fonts].filter((face) => face.family.replaceAll('"', '').replaceAll("'", '') === 'ApexVietCondensed');
    const probe = document.createElement('canvas');
    probe.width = 1200; probe.height = 96;
    const context = probe.getContext('2d', { willReadFrequently: true });
    context.font = font;
    context.fillStyle = '#fff';
    const results = samples.map((sample, index) => {
      context.clearRect(0, 0, probe.width, probe.height);
      context.fillText(sample.text, 8, 64);
      const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
      let painted = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) painted++;
      return {
        ...sample,
        measuredWidth: context.measureText(sample.text).width,
        paintedPixels: painted,
        fontLoaded: document.fonts.check(font, sample.text),
      };
    });
    return {
      lang: document.documentElement.lang,
      title: title?.textContent?.trim(),
      titleFont: titleStyle?.fontFamily,
      titleFontSize: titleStyle?.fontSize,
      faceStatuses: faces.map((face) => ({ family: face.family, status: face.status, weight: face.weight })),
      fontCheck: document.fonts.check(font, samples.map((sample) => sample.text).join(' ')),
      results,
    };
  });
  assert.equal(audit.lang, 'vi');
  assert.match(audit.title || '', /[À-ỹ]/u, 'the live Gold title should render the VIE copy');
  assert.match(audit.titleFont || '', /ApexVietCondensed/);
  assert.ok(audit.faceStatuses.some((face) => face.status === 'loaded'), JSON.stringify(audit.faceStatuses));
  assert.equal(audit.fontCheck, true);
  assert.ok(audit.results.every((sample) => sample.fontLoaded && sample.measuredWidth > 0 && sample.paintedPixels > 0),
    JSON.stringify(audit.results));
  assert.deepEqual(errors, []);
  console.log('RA-2.2 Vietnamese DOM/font/canvas glyph audit PASS', JSON.stringify(audit));
} finally {
  await browser.close();
}
