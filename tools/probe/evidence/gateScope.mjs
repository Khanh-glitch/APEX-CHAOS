// Does `g` resolve inside each renderer module? If it throws, every quality
// gate written as `typeof g !== 'undefined' && g.FLAG === ...` silently reads
// the HIGH default in BOTH modes.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const REPO = '/home/user/APEX-CHAOS';
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 300000, args: [...chromium.args, '--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
for (const f of ['boxeGoldLibrary.js', 'crystalaGoldV6.js', 'frostGoldV1.js']) {
  const src = fs.readFileSync(REPO + '/public/game/hero-rework/' + f, 'utf8');
  const r = await page.evaluate((src) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:0;height:0;border:0';
    document.body.appendChild(frame);
    const d = frame.contentDocument;
    d.open(); d.write('<!doctype html><body></body>'); d.close();
    const s = d.createElement('script'); s.textContent = src; d.body.appendChild(s);
    const W = frame.contentWindow;
    // Evaluate the SAME guard the file uses, inside the file's own realm.
    let insideRealm = null, err = null;
    try { insideRealm = (new Function('return typeof g'))(); } catch (e) { err = String(e); }
    const out = { realmTypeofG: insideRealm, err,
                  windowHasG: typeof W.g,
                  globalThisHasG: typeof frame.contentWindow.g,
                  softAlphaReadable: frame.contentWindow.APEX_GRAPHICS_FLUID_SOFT_ALPHA };
    frame.remove();
    return out;
  }, src);
  console.log(f.padEnd(24), JSON.stringify(r));
}
await browser.close(); process.exit(0);
