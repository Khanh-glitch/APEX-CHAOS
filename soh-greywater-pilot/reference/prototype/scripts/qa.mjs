// Real-browser QA: serves dist/, performs real inputs, saves screenshots to qa-shots/. Usage: node scripts/qa.mjs
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, mkdirSync } from 'fs';
const html = readFileSync('dist/index.html');
const srv = createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end(html); }).listen(4317);
mkdirSync('qa-shots', { recursive: true });
const errors = [];
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = async n => { await page.screenshot({ path: `qa-shots/${n}.png` }); console.log('shot', n); };
const wait = ms => page.waitForTimeout(ms);
await page.goto('http://localhost:4317/'); await wait(2500); await shot('01-title');
await page.getByText('New run').click(); await wait(400); await shot('02-select');
await page.getByText('Meadow Bay').click(); await page.getByText('Begin the 14 days').click(); await wait(1800); await shot('03-world');
// walk around and swing
await page.mouse.move(800, 300);
await page.keyboard.down('KeyD'); await wait(900); await page.keyboard.up('KeyD');
await page.keyboard.down('KeyS'); await wait(500); await page.keyboard.up('KeyS');
for (let i = 0; i < 6; i++) { await page.mouse.down(); await wait(60); await page.mouse.up(); await wait(320); }
await shot('04-swing');
await page.keyboard.press('KeyI'); await wait(300); await shot('05-inventory'); await page.keyboard.press('KeyI');
await page.keyboard.press('KeyB'); await wait(300); await shot('06-build'); await page.keyboard.press('Escape');
await page.keyboard.press('KeyC'); await wait(300); await shot('07-craft'); await page.keyboard.press('Escape');
await page.keyboard.press('KeyM'); await wait(400); await shot('08-map'); await page.keyboard.press('Escape');
await page.keyboard.press('Escape'); await wait(300); await shot('09-menu');
// QA jump to Ragnarok and inspect
await page.getByText('→ Ragnarok (h264)').click(); await wait(300); await page.keyboard.press('Escape'); await wait(1500); await shot('10-ragnarok');
// reload persistence
const before = await page.evaluate(() => localStorage.getItem('soh.state.v3')?.length);
await page.reload(); await wait(2500); await shot('11-reload-title');
await page.getByText(/Continue/).click(); await wait(1500); await shot('12-continue');
// smaller viewport check (640x360 logical at 1x)
await page.setViewportSize({ width: 640, height: 360 }); await wait(800); await shot('13-640x360');
console.log('saved bytes before reload', before);
console.log('ERRORS', JSON.stringify(errors, null, 1));
await b.close(); srv.close();
