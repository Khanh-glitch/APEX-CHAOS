// APEX CHAOS local performance harness.
// Drives the PRODUCTION packaged build through the nested /html/apex/ path.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from './goldNestedServer.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const require = createRequire(new URL('../probe/node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

export const probeSource = fs.readFileSync(path.join(HERE, 'instrument.js'), 'utf8');
export const qaProfileSource = fs.readFileSync(path.join(HERE, 'qaProfile.js'), 'utf8');
export const instrumentSource = probeSource;

export async function launch({ distRoot, args = [] }) {
  const srv = await startServer({ root: path.isAbsolute(distRoot) ? distRoot : path.join(REPO_ROOT, distRoot) });
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: true,
    protocolTimeout: 600000,
    args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required', ...args],
  });
  return { srv, browser, base: srv.nested };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The owner first-play guide gates FREE BATTLE behind one answered question.
export async function dismissFirstPlayGuide(page) {
  for (let i = 0; i < 60; i += 1) {
    const state = await page.evaluate(() => {
      const no = document.getElementById('apex-tutorial-ask-no');
      if (no) { no.click(); return 'answered'; }
      const close = document.querySelector('.fpGuide [data-apex-guide-close], .firstPlayGuide [data-close], [data-apex-guide-dismiss]');
      if (close) { close.click(); return 'closed'; }
      const guide = document.querySelector('.fpGuide, .firstPlayGuide, #apex-first-play-guide');
      if (guide && guide.offsetParent !== null) return 'waiting';
      return 'gone';
    });
    if (state === 'gone') return true;
    await sleep(250);
  }
  return false;
}

export async function newGamePage(browser, base, { viewport = { width: 1440, height: 900 }, dpr = 1, mobile = false, injectProbe = true, seedRoster = true } = {}) {
  const page = await browser.newPage();
  const errors = []; const http = [];
  page.on('pageerror', (e) => errors.push('PAGE ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 240)); });
  page.on('response', (r) => { if (r.status() >= 400) http.push(r.status() + ' ' + r.url()); });
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  if (injectProbe) await page.evaluateOnNewDocument(probeSource);
  if (seedRoster) await page.evaluateOnNewDocument(qaProfileSource);
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
  return { page, errors, http };
}

export async function bootToHome(page) {
  await page.evaluate(() => document.getElementById('apex-boot-start')?.click());
  await page.waitForSelector('#freeBattle', { visible: true, timeout: 150000 });
  await dismissFirstPlayGuide(page);
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 90000 }).catch(() => {});
}

export async function instrStart(page) { await page.evaluate(() => window.__APEX_INSTR.start()); }
export async function instrStop(page, label) { return await page.evaluate((l) => window.__APEX_INSTR.stop(l), label); }
export async function measure(page, ms, label) { await instrStart(page); await sleep(ms); return await instrStop(page, label); }

export async function closeAll(ctx) {
  try { await ctx.browser?.close(); } catch (_) {}
  try { await ctx.srv?.server?.close(); } catch (_) {}
}
