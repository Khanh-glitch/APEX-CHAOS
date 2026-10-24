import { launchBrowser, openApp, wait } from './harness.mjs';
const b = await launchBrowser();
const { page, context, errors } = await openApp(b, { width: 1440, height: 900 });
const fails = [];
page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/assets/')) fails.push(r.status() + ' ' + r.url().slice(0, 120)); });
await page.click('#apexDictionaryOpen');
await wait(2500);
const info = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src')?.slice(0, 90), ok: i.complete && i.naturalWidth > 0, inArchive: !!i.closest('[class*="fa3"],[class*="archive"],[class*="Archive"],[class*="dictionary"]') }));
  const cls = [...new Set([...document.querySelectorAll('[class*="fa3"],[class*="dictionary"],[class*="archive"]')].map((e) => e.className.toString().split(' ')[0]))].slice(0, 25);
  const btns = [...document.querySelectorAll('[class*="fa3"] button, [class*="fa3"] [role="button"], [class*="fa3"] [data-hero], [data-hero]')].slice(0, 40).map((e) => (e.getAttribute('data-hero') || e.getAttribute('data-weapon') || e.textContent || '').trim().slice(0, 18));
  return { imgs: imgs.length, bad: imgs.filter((i) => !i.ok).slice(0, 8), sample: imgs.slice(0, 6), cls, btns };
});
console.log(JSON.stringify(info, null, 1).slice(0, 2500));
console.log('FAILS', JSON.stringify(fails.slice(0, 10)), 'ERR', JSON.stringify(errors.slice(0, 3)));
await context.close(); await b.close();
