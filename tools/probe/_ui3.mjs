import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { startServer } from '../perf/goldNestedServer.mjs';

const srv = await startServer({ root: '../../dist-itch-html5' });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errs = [], http = [];
page.on('pageerror', e => errs.push('PAGE ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text().slice(0,160)); });
page.on('response', r => { if (r.status() >= 400) http.push(r.status() + ' ' + r.url()); });
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
await page.evaluate(() => document.getElementById('apex-boot-start').click());
await page.waitForSelector('#freeBattle', { visible: true, timeout: 150000 });
await new Promise(r => setTimeout(r, 3500));

// 60Hz panel that is slow: 30% of frames at 16.7, rest at 45-55 → p95 ~52, slowRatio .7, hz 60
const adv = await page.evaluate(async () => {
  const A = window.APEX_GRAPHICS_ADVISOR;
  const a = window.APEX_GRAPHICS_QUALITY;
  A._test.reset(); a.set('high', 'test');
  const frames = [];
  for (let i = 0; i < 60; i++) frames.push(i % 10 < 7 ? 16.7 : 48 + (i % 5));
  A._test.evaluateWithForce(frames); A._test.evaluateWithForce(frames);
  const third = A._test.evaluateWithForce(frames);
  await new Promise(r => setTimeout(r, 200));
  const panel = document.getElementById('apex-quality-advisor');
  const out = {
    recommends: third.recommend, verdict: third.verdict,
    visible: !!panel && !panel.hidden,
    title: panel?.querySelector('.aqa-title')?.textContent,
    role: panel?.getAttribute('role'),
    switchText: panel?.querySelector('[data-aqa-action="switch"]')?.textContent,
    dismissText: panel?.querySelector('[data-aqa-action="dismiss"]')?.textContent,
    autoDismissMs: A.PANEL_MS,
    cooldownMin: A.COOLDOWN_MS / 60000,
    debug: A._test.debug(),
  };
  // take screenshot data before clicking
  const r = panel?.getBoundingClientRect();
  out.rect = r ? { top: Math.round(r.top), right: Math.round(r.right), w: Math.round(r.width) } : null;
  // do NOT switch yet: verify dismiss path first
  panel?.querySelector('[data-aqa-action="dismiss"]')?.click();
  await new Promise(r2 => setTimeout(r2, 250));
  out.afterDismiss = { hidden: document.getElementById('apex-quality-advisor')?.hidden, mode: a.mode };
  return out;
});
console.log('ADVISOR_RECO', JSON.stringify(adv, null, 1));

// Now switch path + toast
const sw = await page.evaluate(async () => {
  const A = window.APEX_GRAPHICS_ADVISOR;
  const a = window.APEX_GRAPHICS_QUALITY;
  A._test.reset();
  A._test.forceRecommend();
  await new Promise(r => setTimeout(r, 150));
  document.querySelector('#apex-quality-advisor [data-aqa-action="switch"]')?.click();
  await new Promise(r => setTimeout(r, 250));
  const t = document.getElementById('apex-quality-toast');
  return { mode: a.mode, toast: t?.textContent, toastVisible: t && !t.hidden,
           panelHidden: document.getElementById('apex-quality-advisor')?.hidden,
           persisted: localStorage.getItem(a.STORAGE_KEY) };
});
console.log('ADVISOR_SWITCH', JSON.stringify(sw, null, 1));

// Persistence across reload
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
await page.evaluate(() => document.getElementById('apex-boot-start').click());
await page.waitForSelector('#freeBattle', { visible: true, timeout: 150000 });
await new Promise(r => setTimeout(r, 2500));
const persist = await page.evaluate(() => ({
  mode: window.APEX_GRAPHICS_QUALITY?.mode,
  stored: localStorage.getItem('apexChaos.graphicsQuality.v1'),
  drawerValue: document.getElementById('apex-graphics-open-value')?.textContent,
  drawerMode: document.getElementById('apex-graphics-open')?.dataset.aqsMode,
  panelRadio: null,
}));
console.log('PERSIST', JSON.stringify(persist, null, 1));
await page.screenshot({ path: '/tmp/ui3-home.png' });
console.log('HTTP', http.slice(0, 6));
console.log('ERRS', errs.slice(0, 6));
await browser.close(); srv.server.close();
