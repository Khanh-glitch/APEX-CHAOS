// Browser acceptance: ACTUAL packaged game runs in nested /html/<game>/ iframe.
// HTTP 200 on its index.html / assets is insufficient: cosmetic registry and
// other client runtime initialization must execute successfully too.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const target = process.env.ITCH_NESTED_URL || 'https://itch-html5-subpath-20261020.apex-chaos.pages.dev/';
const browserPath = process.env.CHROME_PATH;
if (!browserPath) throw Error('CHROME_PATH required for real Chrome QA');
const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const failures = [];
  page.on('pageerror', e => failures.push(String(e)));
  page.on('console', msg => { if (msg.type() === 'error') failures.push(msg.text().slice(0,500)); });
  // RC guard: nested hosting must not 404 first-party assets. The Gold
  // mount sets <base href="/gold/">, so post-mount product URLs resolve
  // against <app>/gold/ — packItchPortable's post-base pass owns the fix;
  // this assertion keeps it from silently regressing.
  const targetOrigin = new URL(target).origin;
  const badAssets = [];
  page.on('response', r => {
    if (r.status() >= 400 && r.url().startsWith(targetOrigin)) badAssets.push(r.status() + ' ' + r.url());
  });
  await page.goto(target, { waitUntil:'domcontentloaded', timeout:45000 });
  await page.waitForFunction(
    () => [...document.querySelectorAll('iframe')].some(f => f.contentDocument?.querySelector('#apex-boot-start')),
    { timeout: 35000 },
  );
  const nested = page.frames().find(f => f.url().includes('/html/apex/'));
  assert.ok(nested, 'nested HTML5 game frame must exist');
  const button = await nested.waitForSelector('#apex-boot-start', { visible:true, timeout:25000 });
  assert.ok(button);
  await button.click();
  // Alpha Home law: the single account entry is the bottom-nav ACCOUNT
  // route (#apexAccountOpen); the retired top identity chip is gone.
  // The first-play guide may be open for this fresh guest — it must not
  // block the nav, but dismiss it first for a clean dialog read.
  await nested.waitForSelector('#apexAccountOpen', { visible:true, timeout:40000 });
  await nested.evaluate(() => document.querySelector('.apex-guide-close')?.click());
  await nested.$eval('#apexAccountOpen', el => el.click());
  const dialog = await nested.waitForSelector('[role=dialog]', { visible:true, timeout:10000 });
  const copy = await dialog.evaluate(el => el.innerText);
  assert.match(copy,/PLAY INSTANTLY — NO SIGN-IN/);
  assert.match(copy,/200 AC/);
  assert.match(copy,/350 AC/);
  assert.equal(await nested.$eval('[role=dialog]', el => el.querySelectorAll('input[type=password]').length),0,'Guest release must not display Auth password controls');
  assert.deepEqual(failures.filter(s=>/Error:|Uncaught|Cosmetic asset|failed to fetch/i.test(s)),[]);
  assert.deepEqual(badAssets, [], 'nested itch hosting must load every first-party asset (post-base URL law)');
  console.log('NESTED ITCH BROWSER RUNTIME PASS: real Chrome /html/apex/ iframe boot, Guest +200 AC, 350 starter AC, no login UI');
} finally {
  await browser.close();
}
