import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs22.x';
const { default: chromium } = await import('@sparticuz/chromium');
const base = (process.env.APEX_APP_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const output = process.env.APEX_EVIDENCE_DIR || 'reports/bot-wave-wrapper-qa';
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || await chromium.executablePath(),
  headless: true,
  args: [...chromium.args.filter(arg => arg !== '--single-process'), '--no-sandbox', '--disable-setuid-sandbox'],
});
const profiles = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1 },
  { name: 'mobile-landscape', width: 844, height: 390, dpr: 2 },
].filter(profile => !process.env.APEX_PERF_PROFILE || process.env.APEX_PERF_PROFILE === profile.name);
const results = [];
try {
  for (const profile of profiles) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.setViewport({ width: profile.width, height: profile.height, deviceScaleFactor: profile.dpr, isMobile: profile.dpr > 1, hasTouch: profile.dpr > 1 });
    await page.goto(`${base}/bot-wave/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const started = Date.now();
    let frame;
    while (Date.now() - started < 60000) {
      frame = page.frames().find(f => f.url().includes('/bot-wave/game.html'));
      if (frame && await frame.evaluate(() => !!window.BOXE_WAVE_PILOT && window.APEX_BOT_WAVE_INTERFACE_V2?.installed === true).catch(() => false)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(frame, `${profile.name}: BOT WAVE iframe loaded`);
    assert.equal(await page.$eval('#wave', e => e.hidden), false, `${profile.name}: wrapper reveals the Gold game after HUD install`);
    const returnButton = await page.$eval('#return', e => e.offsetWidth > 0 && e.offsetHeight > 0);
    const hud = await frame.evaluate(() => ({
      pilot: !!window.BOXE_WAVE_PILOT,
      presentation: window.APEX_BOT_WAVE_INTERFACE_V2?.installed === true,
      waveHud: !!document.getElementById('wave-hud'),
      commandBar: !!document.querySelector('#wave-hud .bw-bottom'),
      joystick: !!document.querySelector('#wave-hud .bw-movement #wave-stick'),
      startButton: !!document.getElementById('w-go'),
      productionPerfDiagnosticsEnabled: window.APEX_WAVE_PERF.snapshot().enabled,
    }));
    hud.returnButton = returnButton;
    assert.ok(hud.pilot && hud.presentation && hud.waveHud && hud.commandBar && hud.joystick && hud.startButton && hud.returnButton,
      `${profile.name}: Gold HUD/onboarding/Home controls exist: ${JSON.stringify(hud)}`);
    assert.equal(hud.productionPerfDiagnosticsEnabled, false, `${profile.name}: detailed telemetry stays off in the production-default route`);
    await page.screenshot({ path: path.join(output, `${profile.name}-entry.png`) });
    await frame.click('#w-go');
    const combatStart = Date.now();
    while (Date.now() - combatStart < 20000 && await frame.evaluate(() => window.BOXE_WAVE_PILOT.state.phase !== 'combat'))
      await new Promise(resolve => setTimeout(resolve, 100));
    const phase = await frame.evaluate(() => window.BOXE_WAVE_PILOT.state.phase);
    assert.equal(phase, 'combat', `${profile.name}: combat starts through Gold onboarding`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const before = await frame.evaluate(() => ({ x: window.handLab.player.x, y: window.handLab.player.y, t: window.handLab.time }));
    let touchStick = null;
    let keyboardEvents = [];
    if (profile.dpr > 1) {
      touchStick = await frame.$eval('#wave-stick', e => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, visible: r.width > 0 && r.height > 0 };
      });
      assert.ok(touchStick.visible && touchStick.x < profile.width * .25 && touchStick.y > profile.height * .7,
        `${profile.name}: touch joystick remains visible and anchored at lower-left: ${JSON.stringify(touchStick)}`);
      const cdp = await page.target().createCDPSession();
      const x = touchStick.x + touchStick.width / 2, y = touchStick.y + touchStick.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + touchStick.width * .35, y, id: 1 }] });
      await new Promise(resolve => setTimeout(resolve, 500));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      const canvasBox = await frame.evaluate(() => {
        const r = window.handLab.canvas.getBoundingClientRect();
        window.handLab.canvas.tabIndex = 0;
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.mouse.click(canvasBox.x, canvasBox.y);
      await frame.evaluate(() => {
        window.handLab.canvas.focus(); window.focus(); window.__qaKeys = [];
        window.addEventListener('keydown', e => window.__qaKeys.push({ code: e.code, target: e.target?.tagName }), true);
      });
      await page.keyboard.down('d'); await new Promise(resolve => setTimeout(resolve, 800));
      const keyState = await frame.evaluate(() => ({ events: window.__qaKeys, keys: [...window.handLab.keys] }));
      keyboardEvents = keyState.events;
      assert.ok(keyState.events.some(e => e.code === 'KeyD') && keyState.keys.includes('KeyD'),
        `${profile.name}: keyboard input reaches Gold runtime: ${JSON.stringify(keyState)}`);
      await page.keyboard.up('d');
    }
    const after = await frame.evaluate(() => ({ x: window.handLab.player.x, y: window.handLab.player.y, t: window.handLab.time }));
    const movementPx = Math.hypot(after.x - before.x, after.y - before.y);
    if (profile.dpr > 1) assert.ok(movementPx > 8, `${profile.name}: touch drag moves the Gold player`);
    await page.screenshot({ path: path.join(output, `${profile.name}-combat.png`) });
    assert.deepEqual(errors, [], `${profile.name}: no runtime exceptions`);
    results.push({ profile: profile.name, viewport: profile, hud, inputMode: profile.dpr > 1 ? 'emulated-touch joystick drag' : 'keyboard KeyD', touchStick, keyboardEvents, movementPx, gameTimeDelta: after.t - before.t, errors });
    await frame.evaluate(() => window.handLab?.destroy());
    await page.close({ runBeforeUnload: false });
  }
  const reportName = `wrapper-qa-${profiles.map(profile => profile.name).join('_')}.json`;
  fs.writeFileSync(path.join(output, reportName), JSON.stringify({
    note: 'Headless Chromium/SwiftShader viewport QA, not a physical mobile-device acceptance test.', results,
  }, null, 2) + '\n');
  console.log('BOT WAVE wrapper desktop/mobile viewport QA PASS', JSON.stringify(results));
} finally {
  browser.process()?.kill('SIGKILL');
}
