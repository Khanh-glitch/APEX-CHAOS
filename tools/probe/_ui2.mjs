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
await new Promise(r => setTimeout(r, 4000));

const probe = await page.evaluate(() => ({
  authority: !!window.APEX_GRAPHICS_QUALITY, authorityVersion: window.APEX_GRAPHICS_QUALITY?.version,
  mode: window.APEX_GRAPHICS_QUALITY?.mode,
  settings: !!window.APEX_GRAPHICS_SETTINGS_UI,
  advisor: !!window.APEX_GRAPHICS_ADVISOR,
  frontend: window.apexGraphicsQualityFrontend,
  diagnose: window.APEX_GRAPHICS_FRONTEND?.diagnose?.(),
  drawerBtn: !!document.getElementById('apex-graphics-open'),
  drawerValue: document.getElementById('apex-graphics-open-value')?.textContent,
  cssLinked: !!document.getElementById('apex-graphics-quality-ui-css'),
  sheet: (() => { const l = document.getElementById('apex-graphics-quality-ui-css'); return l ? { tag: l.tagName, href: l.getAttribute('href'), loaded: window.APEX_GRAPHICS_SETTINGS_UI?.stylesheet } : null; })(),
}));
console.log('BOOT', JSON.stringify(probe, null, 1));

// Open panel, switch to PERFORMANCE, verify persistence + no reload
const flow = await page.evaluate(async () => {
  const ui = window.APEX_GRAPHICS_SETTINGS_UI;
  const a = window.APEX_GRAPHICS_QUALITY;
  document.getElementById('apex-graphics-open').click();
  await new Promise(r => setTimeout(r, 250));
  const panel = document.getElementById('apex-graphics-settings');
  const openOk = !!panel && !panel.hidden;
  const radios = panel ? [...panel.querySelectorAll('[data-aqs-mode]')].map(b => b.dataset.aqsMode + ':' + b.getAttribute('aria-checked')) : [];
  const perfBtn = panel?.querySelector('[data-aqs-mode="performance"]');
  perfBtn?.click();
  await new Promise(r => setTimeout(r, 150));
  const afterMode = a.mode;
  const stored = localStorage.getItem(a.STORAGE_KEY);
  ui.close('test');
  return { openOk, radios, afterMode, stored, drawerValue: document.getElementById('apex-graphics-open-value')?.textContent };
});
console.log('PANEL', JSON.stringify(flow, null, 1));

// Advisor
const adv = await page.evaluate(async () => {
  const A = window.APEX_GRAPHICS_ADVISOR;
  if (!A) return { error: 'missing' };
  A._test.reset();
  window.APEX_GRAPHICS_QUALITY.set('high', 'test');
  // Feed three bad windows directly (frame times of 45ms => p95 45, all slow)
  const bad = new Array(60).fill(45);
  A._test.evaluateWithForce(bad); A._test.evaluateWithForce(bad); const third = A._test.evaluateWithForce(bad);
  await new Promise(r => setTimeout(r, 120));
  const panel = document.getElementById('apex-quality-advisor');
  const visible = !!panel && !panel.hidden;
  const title = panel?.querySelector('.aqa-title')?.textContent;
  const btn = panel?.querySelector('[data-aqa-action="switch"]');
  btn?.click();
  await new Promise(r => setTimeout(r, 120));
  return { third, visible, title, modeAfterSwitch: window.APEX_GRAPHICS_QUALITY.mode,
    toast: document.getElementById('apex-quality-toast')?.textContent };
});
console.log('ADVISOR', JSON.stringify(adv, null, 1));
console.log('HTTP', http.slice(0, 8));
console.log('ERRS', errs.slice(0, 8));
await page.screenshot({ path: '/tmp/ui2.png' });
await browser.close(); srv.server.close();
