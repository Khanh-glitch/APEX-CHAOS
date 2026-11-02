// QA pass 2: combat, elder, POI cash chest, vendor, escrow flow through real clicks. QA teleports are LOCAL/UNVERIFIED.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync } from 'fs';
const html = readFileSync('dist/index.html'); const srv = createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end(html); }).listen(4318);
const errors = []; const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => errors.push(e.message));
const wait = ms => page.waitForTimeout(ms); const shot = async n => { await page.screenshot({ path: `qa-shots/${n}.png` }); console.log('shot', n); };
const tp = (x, y) => page.evaluate(([x, y]) => { const p = window.__soh.run.player; p.x = x; p.y = y; }, [x, y]);
await page.goto('http://localhost:4318/'); await wait(2000); await shot('20-title-fixed');
await page.getByText('New run').click(); await wait(200); await page.getByText("Fisher's Point").click(); await page.getByText('Begin the 14 days').click(); await wait(1500);
// fight: spawn wolf next to player via QA hook
await page.evaluate(() => { const r = window.__soh.run; const p = r.player; const m = JSON.parse(JSON.stringify(r.creatures.find(c => c.type === 'wolf'))); m.id = 'qa_w'; m.x = p.x + 40; m.y = p.y; m.state = 'chase'; m.knows = { kind: 'sight', x: p.x, y: p.y, at: Date.now() }; m.homeX = m.x; m.homeY = m.y; r.creatures.push(m); });
await page.mouse.move(720, 360); for (let i = 0; i < 8; i++) { await page.mouse.down(); await wait(40); await page.mouse.up(); await wait(140); if (i === 2) await shot('21-combat'); }
await wait(300); await shot('22-combat2');
// elder: Caldera Titan
const elder = await page.evaluate(() => { const m = window.__soh.run.creatures.find(c => c.elder?.key === 'magma'); return [m.x, m.y]; });
await tp(elder[0] - 50, elder[1] + 10); await wait(2200); await shot('23-elder-magma');
for (let i = 0; i < 6; i++) { await page.mouse.down(); await wait(40); await page.mouse.up(); await wait(200); }
await wait(900); await shot('24-elder-magma2');
const e2 = await page.evaluate(() => { const m = window.__soh.run.creatures.find(c => c.elder?.key === 'frost'); window.__soh.run.player.hp = 100; window.__soh.run.player.dead = false; return [m.x, m.y]; });
await tp(e2[0] - 45, e2[1] + 20); await wait(2600); await shot('25-elder-frost');
// Ragnarok cash → vendor → escrow
await page.evaluate(() => { const r = window.__soh.run; r.player.hp = 100; r.player.dead = false; r.qaOffset += 265 * 3600000; r.qaUsed = true; });
const cash = await page.evaluate(() => { const e = Object.values(window.__soh.run.entities).find(e => e.kind === 'cash' && e.poi === 'tp'); return [e.x, e.y]; });
await tp(cash[0], cash[1] + 18); await page.mouse.move(640, 300); await wait(600); await shot('26-cash-chest');
await page.keyboard.press('KeyE'); await wait(400); await shot('27-cash-open'); await page.getByText('Take all').click(); await wait(200); await page.keyboard.press('Escape');
const v = await page.evaluate(() => { const e = Object.values(window.__soh.run.entities).find(e => e.kind === 'vendor'); return [e.x, e.y]; });
await tp(v[0], v[1] + 18); await page.mouse.move(640, 300); await wait(400); await page.keyboard.press('KeyE'); await wait(300); await shot('28-vendor');
await page.locator('button:has-text("Buy")').first().click(); await wait(300); await shot('29-bought');
console.log('held', await page.evaluate(() => JSON.stringify(window.__soh.run.custody.inv.slots.filter(Boolean).map(s => s.key + 'x' + s.qty))));
console.log('ERRORS', JSON.stringify(errors.slice(0, 5)));
await b.close(); srv.close();
