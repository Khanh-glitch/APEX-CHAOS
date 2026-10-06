// Shared headless-probe surface. Every probe measures the PRUNED dist through
// `vite preview` (never the dev server), with web-font requests intercepted so
// a sandbox font stall can never be mistaken for a product stall.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
export const B = 'http://127.0.0.1:4173';
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export async function open({ viewport = { width: 1280, height: 720 } } = {}) {
  const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) r.respond({ status: 200, contentType: 'text/css', body: '' });
    else r.continue();
  });
  page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
  await page.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#freeBattle', { timeout: 60000 });
  for (let i = 0; i < 200; i += 1) {
    if (!(await page.evaluate(() => !!window.APEX_SCENE_TRANSITION?.active?.()))) break;
    await wait(120);
  }
  return { browser, page };
}
export const stage = (page) => page.evaluate(() => ({ stage: (document.getElementById('stage') || {}).className || '' }));
export async function waitStage(page, re, ms = 15000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const s = await stage(page);
    if (re.test(s.stage)) return s;
    await wait(200);
  }
  return await stage(page);
}
// Enter a match for `heroId` (BOT profile) and return once the HUD is live.
export async function botMatch(page, heroId, { timeout = 90000 } = {}) {
  await page.click('#freeBattle');
  await waitStage(page, /screen-mode/);
  await page.click('.modeCard[data-mode="bot"]');
  await waitStage(page, /screen-fighter/, 20000);
  await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), heroId);
  await wait(400);
  const lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/LOCK/i.test(lock)) await page.evaluate(() => document.getElementById('lockIn')?.click());
  return await waitStage(page, /battle-hud-open/, timeout);
}
// P1/P2 robot pose + per-slot cooldown snapshot (one call = one sample).
export const robotSample = (page) => page.evaluate(() => {
  const HR = window.APEX_HERO_REWORK;
  const R = window.APEX_ROBOT_PRESENTATION;
  const f = window.fighters || [];
  return {
    heroes: f.map((x) => x.name),
    pose: f.map((x) => { const st = R?.getRobotState?.(x); return st ? { armor: !!st.armor, lockFlash: +((st.lockFlash || 0)).toFixed(3) } : null; }),
    cd: f.map((x) => {
      try {
        const c = HR.abilityController(HR.byCombatant(x));
        return c ? { A1: +(c.skills.A1.cdLeft || 0).toFixed(2), A2: +(c.skills.A2.cdLeft || 0).toFixed(2), chA2: c.skills.A2.charges } : null;
      } catch (_) { return null; }
    }),
    bus: (() => { try { return HR.AIL.bus.ring.slice(-8).map((e) => e.type + '|' + (e.payload && (e.payload.side || e.payload.combatantId)) + '|' + (e.payload && e.payload.slot)); } catch (_) { return []; } })(),
  };
});
