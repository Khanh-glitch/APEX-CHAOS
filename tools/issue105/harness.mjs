// Shared real-Chromium harness for the Issue #105 gates.
// Requires CHROME_PATH (headless Chromium) and a running app at APEX_APP_URL
// (default http://127.0.0.1:5173/). Every profile uses its own launch().
import puppeteer from 'puppeteer-core';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const BASE = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function requireChrome() {
  if (!process.env.CHROME_PATH) throw new Error('CHROME_PATH is required (headless Chromium 131 binary)');
  return process.env.CHROME_PATH;
}

export async function launchBrowser() {
  return puppeteer.launch({
    executablePath: requireChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist'],
  });
}

// Opens the app in a fresh profile. `seed` is written to localStorage ONLY when
// it is an explicitly labelled test fixture (caller passes testSeed).
export async function openApp(browser, { width = 1440, height = 900, dpr = 1, mobile = false, seed = null, storage = {}, lang = null } = {}) {
  // Each profile is an isolated browser context (own localStorage).
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });
  await page.setViewport({ width, height, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  await page.evaluateOnNewDocument((s, kv) => {
    try {
      if (s && !localStorage.getItem('apexChaos.arsenalMeta.v1')) localStorage.setItem('apexChaos.arsenalMeta.v1', JSON.stringify(s));
      for (const [k, v] of Object.entries(kv || {})) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
    } catch (_) { /* storage denied */ }
  }, seed, storage);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await page.click('#apex-boot-start');
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 120000 });
  await wait(600);
  if (lang) await page.evaluate((l) => window.APEX_I18N?.setLanguage?.(l), lang).catch(() => {});
  return { page, errors, context };
}

// Real flow: Free Battle -> BOT mode -> fighter select -> lock -> live battle HUD.
export async function startBotBattle(page, { hero = null } = {}) {
  await page.click('#freeBattle');
  await page.waitForFunction(() => document.querySelector('#modeSelectScreen')?.getAttribute('aria-hidden') === 'false', { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 120000 }).catch(() => {});
  await wait(900);
  await page.click('.modeCard[data-mode="bot"]');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-fighter') && document.body.dataset.apexSceneTransition === 'DONE', { timeout: 60000 });
  await wait(900);
  if (hero) {
    await page.waitForFunction((h) => !!document.querySelector(`.rosterCard[data-hero="${h}"]`), { timeout: 60000 }, hero);
    await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`).click(), hero);
    await wait(700);
  }
  await page.click('#lockIn');
  const hudSel = '#battleHudHost.is-open #p1Side .skill[data-i="0"]';
  if (!(await page.$(hudSel))) await page.click('#lockIn').catch(() => {});
  await page.waitForSelector(hudSel, { timeout: 90000 });
  await wait(1200);
}

export async function saveArtifact(relPath, buffer) {
  const abs = path.resolve(process.cwd(), relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  return abs;
}

export function check(results, ok, name, details) {
  results.push({ name, ok: !!ok, details: details === undefined ? null : details });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${details === undefined ? '' : ' ' + JSON.stringify(details).slice(0, 400)}`);
  return !!ok;
}
