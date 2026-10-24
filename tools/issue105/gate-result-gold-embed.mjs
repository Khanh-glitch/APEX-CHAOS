// Issue #105 §9 — Result Gold in a REAL embed (non-fullscreen iframe).
//
// Topology (identical isolation law to the nested itch gate):
//   wrapper "/embed/<w>x<h>" (served by this gate, root path)
//     -> sized <iframe src="/html/apex/result-gold/index.html"> (NOT fullscreen)
// The wrapper is the parent. It loads the REAL match-result authority from
// /html/apex/ (no hand-written result object), seals a native BOT match, and
// answers the production handshake exactly like goldProductBridge.js:
//   iframe -> APEX_RESULT_GOLD_READY  ==> parent -> APEX_RESULT_GOLD_PAYLOAD
//   iframe -> APEX_RESULT_GOLD_CONTINUE(matchId)  (physical click, no fullscreen)
//
// Checks per rectangle (900x560, 1000x600, 1200x650, phone 390x844):
//   - hero art: 2/2 `.hero__img` complete && naturalWidth>0, pick_selected_large
//   - weapon art: `.weapon__dais img` complete && naturalWidth>0
//   - zero `.art-tag` placeholders for shipped art
//   - zero text collisions between text-bearing leaf boxes, zero text box
//     outside the iframe viewport, zero clipped text (glyph Range vs box, visible nodes only)
//   - no document horizontal overflow inside the frame
//   - Continue is enabled, hittable at its real center, and a physical click
//     returns the exact native matchId to the parent (origin-checked)
//   - zero escaped-root 404s and zero HTTP>=400 under /html/apex/
// Nothing is deployed, published, zipped, or fullscreen-hidden.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
import { launchBrowser, wait, check } from './harness.mjs';
import { startNestedServer, wrapperWith, ITCH_DIR } from './nestedServer.mjs';

const OUT = process.env.ISSUE105_OUT || '/tmp/i105-result-embed';
const ALL_RECTS = [
  { w: 900, h: 560 },
  { w: 1000, h: 600 },
  { w: 1200, h: 650 },
  { w: 390, h: 844 },
];
// ONLY=1000x600,390x844 narrows a diagnostic run; the full gate runs all rects.
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const RECTS = ONLY.length ? ALL_RECTS.filter((r) => ONLY.includes(`${r.w}x${r.h}`)) : ALL_RECTS;
if (!fs.existsSync(path.join(ITCH_DIR, 'result-gold', 'index.html'))) {
  throw new Error(`packed build lacks result-gold/index.html: ${ITCH_DIR}`);
}

const MATCH_SCRIPT = `
  const actors=[{id:1,name:'ROBOT',x:180,y:450,hp:1000,maxHp:1000},
   {id:2,name:'HUNTER',x:820,y:450,hp:1000,maxHp:1000}];
  const cfg={WEAPONS:{PISTOL:{family:'SEMI'}},tierOf:()=> 'T1'};
  const ledger=window.APEX_MATCH_RESULT_AUTHORITY.create({actors,mode:'BOT',startedAt:1720000000000,weaponConfig:cfg});
  ledger.onPickup(actors[0],'PISTOL');ledger.onPickup(actors[1],'PISTOL');
  ledger.onShot(actors[0],'PISTOL');actors[1].hp=400;
  ledger.onDamage(actors[1],actors[0],'arsenal-pistol',600);
  ledger.tick(1.2);ledger.onShot(actors[1],'PISTOL');actors[0].hp=880;
  ledger.onDamage(actors[0],actors[1],'arsenal-pistol',120);
  ledger.tick(.4);ledger.onShot(actors[0],'PISTOL');actors[1].hp=0;
  ledger.onDamage(actors[1],actors[0],'arsenal-pistol',400);
  window.__goldMatch=ledger.seal('P1');
`;

function embedPage(w, h) {
  // Authority scripts are loaded from the nested build (never from root).
  const head = `<script src="/html/apex/game/arsenal/arsenalCWeaponSet.generated.js"></script>
<script src="/html/apex/game/results/ownerAwards.generated.js"></script>
<script src="/html/apex/game/results/matchResultAuthority.js"></script>`;
  const body = `
<script>
window.__goldContinue=[];window.__goldReady=0;window.__payloadSent=0;window.__payloadError='';
try{${MATCH_SCRIPT}}catch(e){window.__payloadError=String(e&&e.stack||e)}
window.addEventListener('message',function(e){
  var f=document.getElementById('embed');
  if(!f||e.source!==f.contentWindow||e.origin!==location.origin)return;
  if(e.data&&e.data.type==='APEX_RESULT_GOLD_READY'){
    window.__goldReady++;
    if(window.__goldMatch){f.contentWindow.postMessage({type:'APEX_RESULT_GOLD_PAYLOAD',match:window.__goldMatch},location.origin);window.__payloadSent++;}
  }else if(e.data&&e.data.type==='APEX_RESULT_GOLD_CONTINUE'){
    window.__goldContinue.push({origin:e.origin,matchId:e.data.matchId});
  }
});
</script>`;
  const page = wrapperWith('/html/apex/result-gold/index.html', `width:${w}px;height:${h}px;`)
    .replace('</head>', `${head}</head>`)
    .replace('</body>', `${body}</body>`);
  return page;
}

const routes = {};
for (const r of RECTS) routes[`/embed/${r.w}x${r.h}`] = embedPage(r.w, r.h);

const server = await startNestedServer({ extraRoutes: routes });
const results = [];
const receipts = {};
await mkdir(OUT, { recursive: true });

// Runs INSIDE the Result Gold document: text collision, clip, and placement.
function layoutAudit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  // A node is VISIBLE only if it and every ancestor paint: no opacity:0,
  // visibility:hidden, display:none, or aria-hidden ancestor.
  const paints = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (n.getAttribute('aria-hidden') === 'true') return false;
    }
    return true;
  };
  const textEls = Array.from(document.querySelectorAll('body *')).filter((el) => {
    if (el.closest('script,style,noscript')) return false;
    return Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
  }).filter(paints);
  const boxes = [];
  const clipped = [];
  for (const el of textEls) {
    const r = el.getBoundingClientRect();
    // <=1px boxes are visually-hidden labels (sr-only / clip pattern, e.g. the
    // icon-only phone dock button). They are not painted, so they are excluded.
    if (r.width <= 1 || r.height <= 1) continue;
    // Text-run box via Range (true glyph extent), not the element scrollWidth.
    const range = document.createRange();
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      range.selectNodeContents(n);
      const tr = range.getBoundingClientRect();
      if (tr.width <= 0) continue;
      const clipsX = getComputedStyle(el).overflowX !== 'visible' && (tr.right > r.right + 2 || tr.left < r.left - 2);
      if (clipsX) clipped.push({ t: n.textContent.trim().slice(0, 40), cls: String(el.className).slice(0, 60), ov: getComputedStyle(el).overflowX, el: [Math.round(r.left), Math.round(r.right)], txt: [Math.round(tr.left), Math.round(tr.right)] });
      boxes.push({ el, parent: el.parentElement, inline: getComputedStyle(el).display.startsWith('inline'),
        text: n.textContent.trim().slice(0, 40), x: tr.left, y: tr.top, r: tr.right, b: tr.bottom });
    }
  }
  const outside = boxes.filter((b) => b.x < -1 || b.y < -1 || b.r > vw + 1 || b.b > vh + 1)
    .map((b) => ({ text: b.text, box: [Math.round(b.x), Math.round(b.y), Math.round(b.r), Math.round(b.b)] }));
  const collisions = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // Letter/word splits of ONE run (inline siblings) are not collisions.
      if (a.parent && a.parent === b.parent && a.inline && b.inline) continue;
      const ix = Math.min(a.r, b.r) - Math.max(a.x, b.x);
      const iy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
      // Line boxes of stacked display text touch by a few px; require a real overlap.
      const minH = Math.min(a.b - a.y, b.b - b.y), minW = Math.min(a.r - a.x, b.r - b.x);
      if (ix > 0.2 * minW && iy > 0.25 * minH) collisions.push([a.text, b.text].join(' || '));
    }
  }
  const stage = document.querySelector('.ac-stage');
  const images = Array.from(document.querySelectorAll('.hero__img')).map((e) => ({
    src: e.getAttribute('src'), ok: e.complete && e.naturalWidth > 0,
  }));
  const gun = document.querySelector('.weapon__dais img');
  const btn = document.querySelector('.dock .btn--primary');
  let hit = false, center = null;
  if (btn) {
    const r = btn.getBoundingClientRect();
    center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const top = document.elementFromPoint(center.x, center.y);
    hit = !!top && (top === btn || btn.contains(top));
  }
  return {
    viewport: { w: vw, h: vh },
    docOverflowX: document.documentElement.scrollWidth - vw,
    heroes: document.querySelectorAll('.hero').length,
    done: !!document.querySelector('.ac-run.is-done'),
    images,
    gun: gun ? { src: gun.getAttribute('src'), ok: gun.complete && gun.naturalWidth > 0 } : null,
    placeholders: Array.from(document.querySelectorAll('.art-tag')).map((e) => e.textContent.trim()),
    stage: stage ? { x: stage.getBoundingClientRect().left, y: stage.getBoundingClientRect().top, r: stage.getBoundingClientRect().right, b: stage.getBoundingClientRect().bottom } : null,
    button: btn ? { enabled: !btn.disabled, hit, center, text: btn.textContent.trim().slice(0, 40) } : null,
    collisions: collisions.slice(0, 12),
    outside: outside.slice(0, 12),
    clipped: clipped.slice(0, 12),
    textBoxes: boxes.length,
  };
}

const browser = await launchBrowser();
try {
  for (const r of RECTS) {
    const id = `${r.w}x${r.h}`;
    const page = await browser.newPage();
    const http4xx = [];
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 240)));
    page.on('response', (resp) => { if (resp.url().includes('/html/apex/') && resp.status() >= 400) http4xx.push(`${resp.status()} ${resp.url()}`); });
    await page.setViewport({ width: r.w, height: r.h, deviceScaleFactor: 1, isMobile: r.w < 500, hasTouch: r.w < 500 });
    await page.goto(`${server.url}/embed/${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    let frame = null;
    for (let i = 0; i < 150 && !frame; i += 1) {
      await wait(200);
      frame = page.frames().find((f) => f.url().includes('/html/apex/result-gold/index.html')) || null;
    }
    if (!frame) { check(results, false, `${id}: nested Result Gold frame mounted`); continue; }
    // Authority proof on the parent side (real sealed match, no hand-written result).
    await page.waitForFunction(() => window.__payloadSent >= 1 || !!window.__payloadError, { timeout: 60000 });
    const parent = await page.evaluate(() => ({ err: window.__payloadError, sent: window.__payloadSent, ready: window.__goldReady, matchId: window.__goldMatch?.meta?.id || null }));
    check(results, !parent.err && parent.sent >= 1 && !!parent.matchId, `${id}: sealed native match delivered through the APEX_RESULT_GOLD_READY handshake`, parent);
    await frame.waitForFunction(() => document.querySelectorAll('.hero').length === 2, { timeout: 90000 }).catch(() => {});
    // Real Skip control (unchanged six-phase choreography), then wait for done.
    await frame.evaluate(() => document.querySelector('.skip')?.click());
    await frame.waitForFunction(() => !!document.querySelector('.ac-run.is-done'), { timeout: 120000 }).catch(() => {});
    await wait(500);
    const snap = await frame.evaluate(layoutAudit);
    const imgOk = snap.images.length === 2 && snap.images.every((i) => i.ok && i.src.includes('pick_selected_large'));
    check(results, imgOk && !!snap.gun?.ok && snap.gun.src.includes('PISTOL.png') && snap.placeholders.length === 0,
      `${id}: hero + PISTOL art naturalWidth>0 inside embed, zero placeholders`,
      { images: snap.images, gun: snap.gun, placeholders: snap.placeholders });
    check(results, snap.collisions.length === 0 && snap.outside.length === 0 && snap.clipped.length === 0 && snap.docOverflowX <= 1,
      `${id}: zero text collisions, zero out-of-viewport text, zero clipped text, zero horizontal overflow`,
      { collisions: snap.collisions, outside: snap.outside, clipped: snap.clipped, docOverflowX: snap.docOverflowX, textBoxes: snap.textBoxes });
    check(results, snap.done && snap.heroes === 2 && !!snap.button?.enabled && !!snap.button?.hit,
      `${id}: Continue enabled and hittable at its real center (no fullscreen)`, snap.button);
    // Physical click in PARENT coordinates (iframe offset + in-frame center).
    const frameEl = await page.$('#embed');
    const box = await frameEl.boundingBox();
    await page.mouse.move(box.x + snap.button.center.x, box.y + snap.button.center.y);
    await page.mouse.down();
    await page.mouse.up();
    await wait(600);
    const cont = await page.evaluate(() => window.__goldContinue.slice());
    check(results, cont.length === 1 && cont[0].matchId === parent.matchId && cont[0].origin === new URL(server.url).origin,
      `${id}: physical Continue returns exact native matchId, origin-checked`, { cont, expected: parent.matchId });
    await page.screenshot({ path: path.join(OUT, `result-gold-embed-${id}.png`) });
    const serverErrors = server.serverErrors.slice();
    check(results, serverErrors.length === 0 && http4xx.length === 0 && pageErrors.length === 0,
      `${id}: zero escaped-root / missing nested assets, zero HTTP>=400, zero page errors`,
      { serverErrors: serverErrors.slice(0, 8), http4xx: http4xx.slice(0, 8), pageErrors: pageErrors.slice(0, 4) });
    receipts[id] = { parent, snap, cont };
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
await writeFile(path.join(OUT, 'result-gold-embed-report.json'), JSON.stringify({ results, receipts }, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`RESULT GOLD EMBED SUMMARY ${results.length - failed}/${results.length} PASS`);
process.exitCode = failed ? 1 : 0;
