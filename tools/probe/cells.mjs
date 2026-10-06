// OWNER ITEM 1 locator: dump every element box inside a side so a "dead cell"
// is proved by ABSENCE, not by reading a screenshot.
import { open, wait, waitStage } from './lib.mjs';
const which = process.argv[2] || 'port';
const mode = process.argv[3] || 'bot';
const VP = {
  port: { width: 390, height: 844 }, land: { width: 844, height: 390 }, desk: { width: 1280, height: 720 },
  phones: { width: 360, height: 780 }, big: { width: 430, height: 932 }, tabport: { width: 820, height: 1180 },
};
const { browser, page } = await open({ viewport: VP[which] });
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click(`.modeCard[data-mode="${mode}"]`);
await waitStage(page, /screen-fighter/, 20000);
const heroes = mode === 'bot' ? ['newbot'] : ['newbot', 'frost'];
for (let i = 0; i < 4; i += 1) {
  await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), heroes[Math.min(i, heroes.length - 1)]);
  await wait(420);
  const lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(1400); }
}
await waitStage(page, /battle-hud-open/, 90000);
await wait(1500);
const out = await page.evaluate(() => {
  // Content-occupancy gap finder: a "dead cell" is a rectangle with only
  // structural panels in it - no text, no art, no button. Mark a 3px cell
  // occupied when any element under that point is a leaf carrying ink
  // (text node, background-image, or an <img>), then report the largest
  // all-empty rectangle per side.
  const biggestGap = (side) => {
    const sb = side.getBoundingClientRect();
    const step = 3;
    const cols = Math.floor(sb.width / step), rows = Math.floor(sb.height / step);
    const ink = [];
    for (let y = 0; y < rows; y += 1) { ink.push(new Array(cols).fill(0)); }
    // Paint every ink element's own box. elementsFromPoint was wrong here: it
    // skips pointer-events:none layers, which is exactly what the tile art is.
    for (const el of side.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.02) continue;
      // A translucent sheen sweep spanning a whole tile is decoration, not
      // content: counting it hid the very dead area the owner reports.
      if (el.classList.contains('sk-sweep')) continue;
      const hasArt = cs.backgroundImage !== 'none' || el.tagName === 'IMG';
      const hasText = el.children.length === 0 && (el.textContent || '').trim().length > 0;
      if (!hasArt && !hasText) continue;
      const eb = el.getBoundingClientRect();
      const x0 = Math.max(0, Math.floor((eb.left - sb.left) / step));
      const x1 = Math.min(cols - 1, Math.ceil((eb.right - sb.left) / step) - 1);
      const y0 = Math.max(0, Math.floor((eb.top - sb.top) / step));
      const y1 = Math.min(rows - 1, Math.ceil((eb.bottom - sb.top) / step) - 1);
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) ink[y][x] = 1;
    }
    // maximal all-zero rectangle (histogram method)
    const hist = new Array(cols).fill(0);
    let best = { area: 0, x: 0, y: 0, w: 0, h: 0 };
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) hist[x] = ink[y][x] ? 0 : hist[x] + 1;
      const stack = [];
      for (let x = 0; x <= cols; x += 1) {
        const h = x === cols ? 0 : hist[x];
        let start = x;
        while (stack.length && stack[stack.length - 1][1] >= h) {
          const [sx, sh] = stack.pop();
          const area = sh * (x - sx);
          if (area > best.area) best = { area, x: sx, y: y - sh + 1, w: x - sx, h: sh };
          start = sx;
        }
        stack.push([start, h]);
      }
    }
    return {
      px: { x: Math.round(sb.left + best.x * step), y: Math.round(sb.top + best.y * step), w: best.w * step, h: best.h * step },
      pctOfSide: Math.round((best.area / (cols * rows)) * 100),
    };
  };
  const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  const dump = (root, label) => {
    const rows = [];
    for (const el of root.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (b.width < 4 || b.height < 4) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.02) continue;
      const cls = String(el.className || '').split(/\s+/).filter(Boolean).join('.');
      const art = cs.backgroundImage !== 'none' ? '+' : '';
      const txt = (el.children.length === 0 ? (el.textContent || '').trim().slice(0, 18) : '');
      rows.push({ sel: (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '') + art).slice(0, 58), b: r(el), txt });
    }
    return { label, side: r(root), rows };
  };
  return {
    hud: r(document.getElementById('hud')),
    gapP1: biggestGap(document.getElementById('p1Side')),
    gapP2: biggestGap(document.getElementById('p2Side')),
    p1: dump(document.getElementById('p1Side'), 'p1'),
    p2: dump(document.getElementById('p2Side'), 'p2'),
  };
});
console.log('GAPS ' + JSON.stringify({ vp: out.hud, p1: out.gapP1, p2: out.gapP2 }));
if (process.env.CELLS_DUMP !== '1') { await browser.close(); process.exit(0); }
for (const side of ['p2', 'p1']) {
  const d = out[side];
  console.log('\n== ' + d.label + ' side ' + JSON.stringify(d.side));
  for (const row of d.rows.sort((a, b) => a.b[1] - b.b[1] || a.b[0] - b.b[0])) {
    console.log('  y' + String(row.b[1]).padStart(4) + ' x' + String(row.b[0]).padStart(4) + ' ' + String(row.b[2]).padStart(4) + 'x' + String(row.b[3]).padStart(3) + '  ' + row.sel + (row.txt ? '  "' + row.txt + '"' : ''));
  }
}
await browser.close();
