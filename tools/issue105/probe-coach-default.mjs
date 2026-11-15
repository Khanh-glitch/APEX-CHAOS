// Diagnostic: what does a FRESH profile see when it enters a BOT battle?
// Records coach/beacon/cable/pickup/HUD-instruction DOM and 60 frames of the
// battle guide frame. Diagnostic only; the gate lives in gate-first-play-guide.mjs.
import { launchBrowser, openApp, startBotBattle, wait } from './harness.mjs';

const browser = await launchBrowser();
try {
  const { page, errors } = await openApp(browser, { width: 1440, height: 900 });
  const menu = await page.evaluate(() => ({
    stored: localStorage.getItem('apex.alpha.coach.v2'),
    legacy: localStorage.getItem('apex.alpha.guide.v1'),
    pref: localStorage.getItem('apex.alpha.tutorial.v1'),
    coachLayer: !!document.querySelector('.apex-coach-layer'),
  }));
  console.log('MENU', JSON.stringify(menu));
  await startBotBattle(page);
  await wait(1500);
  const battle = await page.evaluate(() => ({
    coachLayer: !!document.querySelector('.apex-coach-layer'),
    beacon: !!document.querySelector('.apex-coach-beacon'),
    cable: !!document.querySelector('.apex-coach-cable, [class*="cable"]'),
    pickup: !!document.querySelector('.apex-guide-pickup-prompt'),
    stored: localStorage.getItem('apex.alpha.coach.v2')?.slice(0, 200),
    tutorialOpen: window.APEX_FIRST_PLAY_GUIDE ? window.APEX_FIRST_PLAY_GUIDE.isOpen?.() : 'no-api',
  }));
  console.log('BATTLE', JSON.stringify(battle));
  const frames = await page.evaluate(async () => {
    const out = [];
    const box = () => {
      const el = document.querySelector('.apex-coach-copy, .apex-coach-beacon');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) };
    };
    for (let i = 0; i < 60; i++) {
      out.push(box());
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    return out;
  });
  const xs = frames.filter(Boolean).map((b) => b.x);
  const flips = xs.reduce((n, x, i) => (i && Math.abs(x - xs[i - 1]) > 40 ? n + 1 : n), 0);
  console.log('FRAMES_VISIBLE', xs.length, 'FLIPS>40px', flips, 'XS', JSON.stringify(xs.slice(0, 60)));
  console.log('ERRORS', JSON.stringify(errors.slice(0, 5)));
} finally {
  await browser.close();
}
