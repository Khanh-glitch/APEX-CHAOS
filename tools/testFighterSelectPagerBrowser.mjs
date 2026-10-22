// Fighter Select roster pager — production browser acceptance gate.
//
// Owner law under test: on phones the roster is a 3x2 PAGE (six fighters per
// view) with explicit page navigation (header dots + margin chevrons) and
// swipe that settles on whole pages; all 14 cards are reachable while locked
// records remain unselectable; BOT/Local playable picks reach battle and back.
// Tablet/desktop: layout fits, LOCK and the hero preview are never covered;
// desktop keeps the canonical scrollport (pager hidden) and the selection
// track cursor stays on its track for every fighter index.
//
// Harness pattern (house): real app via APEX_APP_URL (dev server must be up),
// CHROME_PATH points at a Chromium binary. Touch is real CDP touch input.
// Scene transitions are waited out via the coordinator's own idle signal
// (body class), never fixed sleeps — the door is a rAF machine and headless
// renderers are slow. One boot reload retry covers a headless-only image
// decode flake observed in this environment (shell mount aborts before the
// boot-start control exists; a fresh load succeeds).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const BIN = process.env.CHROME_PATH;
if (!BIN) throw new Error('CHROME_PATH not set');
const PORT = Number(process.env.CDP_PORT || 9431);
const SHOTDIR = process.env.SHOTDIR || '/tmp/apex-fighter-pager-gate';
fs.mkdirSync(SHOTDIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  (ok ? passes : failures).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

const chrome = spawn(BIN, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
  '--remote-allow-origins=*', '--no-first-run',
  '--remote-debugging-port=' + PORT,
  '--window-size=1366,768',
  '--user-data-dir=/tmp/apex-pager-gate-' + process.pid, 'about:blank',
], { stdio: 'ignore' });

let ws; let serial = 0; const pending = new Map();
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const to = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')); }, 35000);
    pending.set(id, { resolve: (v) => { clearTimeout(to); resolve(v); }, reject: (e) => { clearTimeout(to); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function httpJson(p) { const r = await fetch(`http://127.0.0.1:${PORT}${p}`); return r.json(); }
async function evl(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function waitFor(expr, label, timeoutMs = 45000) {
  const t0 = Date.now();
  for (;;) {
    let v = false;
    try { v = await evl(expr); } catch {}
    if (v) return true;
    if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timeout: ' + label);
    await sleep(350);
  }
}
async function shot(name) {
  const s = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(`${SHOTDIR}/${name}.png`, Buffer.from(s.data, 'base64'));
  console.log('SHOT', name);
}
const TX_IDLE = `!document.body.classList.contains('apex-scene-transition-active')`;
async function clickSel(sel) {
  const r = await evl(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'NOT_FOUND'; e.scrollIntoView({block:'center'}); e.click(); return 'OK'; })()`);
  if (r !== 'OK') throw new Error('click failed ' + sel);
}
async function tapAt(x, y) {
  await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
  await sleep(70);
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapSel(sel) {
  const c = await evl(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}; })()`);
  if (!c) throw new Error('tap target missing: ' + sel);
  await tapAt(c.x, c.y);
}
async function touchSwipe(x1, y1, x2, y2) {
  const n = 16;
  await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1, id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
  for (let i = 1; i <= n; i++) {
    await cmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(x1 + (x2 - x1) * i / n), y: Math.round(y1 + (y2 - y1) * i / n), id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
    await sleep(16);
  }
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function key(code, keyName, vk) {
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: vk, code, key: keyName });
  await sleep(60);
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: vk, code, key: keyName });
}
const PAGER_STATE = `(()=>{ const P=window.APEX_ROSTER_PAGER; const ros=document.querySelector('.selectionDeckV6 .roster'); return P&&ros?{page:P.page,pages:P.pages,sl:ros.scrollLeft}:null; })()`;
async function stableScroll() {
  let last = -1;
  for (let i = 0; i < 24; i++) {
    const s = await evl(PAGER_STATE);
    if (s && s.sl === last) return s;
    last = s ? s.sl : last;
    await sleep(300);
  }
  return evl(PAGER_STATE);
}
const VISIBLE = `(()=>{ const ros=document.querySelector('.selectionDeckV6 .roster'); if(!ros) return []; const rr=ros.getBoundingClientRect(); return [...ros.querySelectorAll('.rosterCard')].filter(c=>{const r=c.getBoundingClientRect(); return r.left>=rr.left-1&&r.right<=rr.right+1&&r.top>=rr.top-1&&r.bottom<=rr.bottom+1;}).map(c=>c.dataset.hero); })()`;
const ORDER = `(()=>[...document.querySelectorAll('.rosterCard')].map(c=>c.dataset.hero))()`;
const STARTS = `(()=>{ const ros=document.querySelector('.selectionDeckV6 .roster'); const cards=[...ros.querySelectorAll('.rosterCard')]; const rr=ros.getBoundingClientRect(); const maxSl=Math.max(0,ros.scrollWidth-ros.clientWidth); const inset=parseFloat(getComputedStyle(ros).scrollPaddingLeft)||0; const out=[]; for(let i=0;i<cards.length;i+=6) out.push(Math.min(maxSl,Math.max(0,Math.round(ros.scrollLeft+cards[i].getBoundingClientRect().left-rr.left-inset)))); return out; })()`;
async function tapChevronVerified(expectPage) {
  // A chevron tap can land while the deck is still committing its entrance
  // transform (fresh profile, first paint). Re-tap against the pager's own
  // page readout; a genuinely dead chevron still fails after 3 attempts.
  let st = null;
  for (let i = 0; i < 3; i++) {
    await tapSel('.rosterPagerNext');
    st = await stableScroll();
    if (st && st.page === expectPage) return st;
  }
  return st;
}
async function tapCardVerified(hero, side) {
  // The shell reveals the active side's current fighter after a lock, which
  // can page the roster away from the target card between measuring it and
  // touching it. Navigate to the hero's page via the dots first, then tap,
  // verifying against the identity zone — the same contract a player sees.
  for (let i = 0; i < 4; i++) {
    const order = await evl(ORDER);
    const page = Math.floor(order.indexOf(hero) / 6);
    const now = await evl(PAGER_STATE);
    if (!now || now.page !== page) {
      await tapSel(`.rosterPagerDot:nth-child(${page + 1})`);
      await stableScroll();
    }
    await tapSel(`button.rosterCard[data-hero="${hero}"]`);
    try {
      await waitFor(`document.getElementById('p${side}Side')?.getAttribute('data-hero')===${JSON.stringify(hero)}`, `p${side}=${hero}`, 4000);
      return true;
    } catch {}
  }
  return false;
}

async function boot() {
  // Fresh player per context: progression legitimately changes product flow
  // (after an early battle, locking NEWBOT is hijacked into the Quest 01
  // onboarding interlude). Pager acceptance must not depend on that, so each
  // context starts from clean storage — the exact state a new player has.
  try {
    await cmd('Storage.clearDataForOrigin', { origin: new URL(APP).origin, storageTypes: 'local_storage,session_storage,indexeddb,service_workers,cache_storage' });
  } catch {}
  await cmd('Page.navigate', { url: APP });
  try {
    await waitFor(`!!document.getElementById('apex-boot-start')`, 'boot start', 30000);
  } catch {
    // Headless-only decode flake: shell mount aborted before boot-start
    // existed. One fresh load is the documented recovery.
    await cmd('Page.navigate', { url: APP });
    await waitFor(`!!document.getElementById('apex-boot-start')`, 'boot start (retry)', 30000);
  }
  await clickSel('#apex-boot-start');
  await waitFor(`!!document.getElementById('freeBattle') && ${TX_IDLE}`, 'home ready');
  // Progression can bring the first-play coach back on a later clean boot.
  // Dismiss it intentionally so automation exercises the same visible mode
  // controls a player would reach, rather than clicking through the overlay.
  if (await evl(`!!document.querySelector('.apex-coach-skip')`)) {
    await clickSel('.apex-coach-skip');
    await waitFor(`!document.querySelector('.apex-coach-skip')`, 'coach dismissed');
  }
}
async function toPick(modeName) {
  // Choose the mode card by its label, never by index: progression can add
  // cards (a Quest card appears after early play), shifting positions.
  await clickSel('#freeBattle');
  await waitFor(`document.querySelectorAll('.modeCard').length>=2 && ${TX_IDLE}`, 'mode ready');
  const picked = await evl(`(()=>{ const cs=[...document.querySelectorAll('.modeCard')]; const re=${modeName === 'local' ? '/LOCAL/' : '/SOLO/'}; const t=cs.find(c=>re.test(c.textContent)); if(!t) return 'NOT_FOUND:'+cs.map(c=>(c.textContent||'').trim().slice(0,24)).join('|'); t.click(); return 'OK'; })()`);
  if (picked !== 'OK') throw new Error('mode card not found for ' + modeName + ' :: ' + picked);
  await waitFor(`document.getElementById('stage')?.classList.contains('screen-fighter') && !document.getElementById('stage')?.classList.contains('flow-transition') && ${TX_IDLE}`, 'fighter pick committed');
  await waitFor(`!!document.querySelector('button.rosterCard')`, 'roster mounted');
  await sleep(500);
}
async function setViewport(w, h, mobile) {
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: !!mobile, maxTouchPoints: 5 });
  await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
}
const eqSet = (a, b) => a.length === b.length && a.every((v) => b.includes(v));

async function overlapPx(selA, selB) {
  return evl(`(()=>{ const a=document.querySelector(${JSON.stringify(selA)}); const b=document.querySelector(${JSON.stringify(selB)}); if(!a||!b) return -999; const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect(); const ox=Math.max(0,Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left)); const oy=Math.max(0,Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top)); return Math.round(ox*oy); })()`);
}

async function main() {
  for (let i = 0; i < 80; i++) { try { await httpJson('/json/version'); break; } catch { await sleep(300); if (i === 79) throw new Error('devtools up fail'); } }
  const targets = await httpJson('/json/list');
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');

  // ── A: phone portrait 390x844, BOT, full pager + battle round-trip ───────
  await setViewport(390, 844, true);
  await boot();
  await toPick('solo');
  const order = await evl(ORDER);
  check('A roster exposes 14 fighters', order.length === 14, order.join(','));
  const vis0 = await evl(VISIBLE);
  check('A page 1 shows exactly the first six fighters (3x2)', eqSet(vis0, order.slice(0, 6)), vis0.join(','));
  const chrome0 = await evl(`(()=>{ const d=[...document.querySelectorAll('.rosterPagerDot')]; const pv=document.querySelector('.rosterPagerPrev'); const nx=document.querySelector('.rosterPagerNext'); return {dots:d.length, cur:d.map(x=>x.getAttribute('aria-current')), prev:getComputedStyle(pv).display, next:getComputedStyle(nx).display, prevDis:pv.disabled, nextDis:nx.disabled}; })()`);
  check('A pager chrome visible: 3 dots + chevrons, prev disabled on page 1',
    chrome0.dots === 3 && chrome0.cur[0] === 'true' && chrome0.prev === 'block' && chrome0.next === 'block' && chrome0.prevDis === true && chrome0.nextDis === false,
    JSON.stringify(chrome0));
  await shot('A-390-page1');
  await tapSel('.rosterPagerNext');
  let st = await stableScroll();
  const startsA = await evl(STARTS);
  check('A chevron advances to page 2 and settles on the page start', st && st.page === 1 && Math.abs(st.sl - startsA[1]) <= 3,
    `page=${st?.page} sl=${st?.sl} start1=${startsA[1]}`);
  const vis1 = await evl(VISIBLE);
  check('A page 2 shows fighters 7-12', eqSet(vis1, order.slice(6, 12)), vis1.join(','));
  const robotOkOnPage2 = await tapCardVerified('newbot', 1);
  check('A tap selects NEWBOT from page 2 for P1', robotOkOnPage2);
  check('A progression-locked SHURI remains visibly marked unavailable',
    await evl(`(()=>{const c=document.querySelector('.rosterCard[data-hero="shuri"]');return !!c?.classList.contains('is-locked')})()`));
  await shot('A-390-page2-newbot');
  await tapSel('#lockIn');
  await waitFor(`(document.getElementById('stage')?.className||'').includes('fighter-active-p2')`, 'P2 pick phase', 20000).catch(() => {});
  const p2Phase = await evl(`(document.getElementById('stage')?.className||'').includes('fighter-active-p2')`);
  check('A LOCK advances to the BOT pick phase', p2Phase === true);
  await tapSel('.rosterPagerDot:nth-child(3)');
  st = await stableScroll();
  const vis2 = await evl(VISIBLE);
  // 14 = 6+6+2: the final page is end-aligned (last six on screen, fighters
  // 13-14 at the right edge), which is where mandatory snap rests.
  check('A dot 3 jumps to the end-aligned last page (fighters 13-14 reachable)',
    st && st.page === 2 && eqSet(vis2, order.slice(8, 14)) && order.slice(12, 14).every((h) => vis2.includes(h)),
    `page=${st?.page} vis=${vis2.join(',')}`);
  // Swipe right (back a page) from inside the roster.
  const deckC = await evl(`(()=>{ const r=document.querySelector('.selectionDeckV6 .roster').getBoundingClientRect(); return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), w:Math.round(r.width)}; })()`);
  await touchSwipe(deckC.x - 100, deckC.y, deckC.x + 110, deckC.y);
  st = await stableScroll();
  check('A swipe back settles exactly on a page start', st && Math.abs(st.sl - startsA[st.page]) <= 3 && st.page <= 1,
    `page=${st?.page} sl=${st?.sl} start=${st ? startsA[st.page] : '?'}`);
  await shot('A-390-page3-swipeback');
  // Keyboard arrows remain owned by the canonical shell. On a clean profile
  // NEWBOT is the sole unlocked fighter; adjacent cards are progression-locked,
  // so rejection (not selecting locked fighters) is the correct contract.
  await evl(`(()=>{ document.activeElement?.blur?.(); return true; })()`);
  const eligible = await evl(`(()=>[...document.querySelectorAll('.rosterCard')].filter(c=>!c.classList.contains('is-locked')&&!c.disabled).map(c=>c.dataset.hero))()`);
  const kbStart = await evl(`(()=>{ const h=document.getElementById('p2Side')?.getAttribute('data-hero'); return ${JSON.stringify(order)}.indexOf(h); })()`);
  let kbCur = order[kbStart], kbInvalid = false, kbCrossed = false, kbViolations = [];
  for (let i = 0; i < 4; i++) {
    const prev = kbCur;
    await key('ArrowLeft', 'ArrowLeft', 37);
    await sleep(80);
    kbCur = await evl(`document.getElementById('p2Side')?.getAttribute('data-hero')`);
    if (kbCur !== prev && !eligible.includes(kbCur)) kbInvalid = true;
    const idxNow = order.indexOf(kbCur);
    if (kbCur !== prev && Math.floor(idxNow / 6) !== Math.floor(order.indexOf(prev) / 6)) {
      kbCrossed = true;
      const stNow = await stableScroll();
      if (!stNow || stNow.page !== Math.floor(idxNow / 6)) kbViolations.push(`${prev}->${kbCur} page=${stNow?.page}`);
    }
  }
  st = await stableScroll();
  const kb = await evl(`(()=>{ const h=document.getElementById('p2Side')?.getAttribute('data-hero'); return {hero:h, idx:${JSON.stringify(order)}.indexOf(h)}; })()`);
  check('A keyboard navigation never selects a progression-locked fighter', !kbInvalid && eligible.includes(kb?.hero),
    `eligible=${eligible.join(',')} hero=${kb?.hero}`);
  check('A pager page follows keyboard selection across pages when a move is legal',
    (!kbCrossed || kbViolations.length === 0) && kb && kb.idx >= 0 && st && Math.floor(kb.idx / 6) === st.page,
    `crossed=${kbCrossed} violations=${kbViolations.join(';')} page=${st?.page}`);
  // Pick ROBOT (newbot) for the BOT via pager dots, then lock into battle.
  const newbotPage = Math.floor(order.indexOf('newbot') / 6);
  await tapSel(`.rosterPagerDot:nth-child(${newbotPage + 1})`);
  await stableScroll();
  const robotOk = await tapCardVerified('newbot', 2);
  check('A tap selects ROBOT for the BOT from its page', robotOk);
  await tapSel('#lockIn');
  await waitFor(`!!document.getElementById('hud') && document.getElementById('hud').dataset.mode==='1p'`, 'battle live (1p)', 60000).catch(() => {});
  const hudMode = await evl(`document.getElementById('hud')?.dataset.mode || null`);
  check('A LOCK BOT enters the live battle (HUD mode 1p)', hudMode === '1p', String(hudMode));
  await shot('A-390-battle');
  await key('Escape', 'Escape', 27);
  await waitFor(`(document.getElementById('stage')?.className||'').includes('screen-fighter') && ${TX_IDLE}`, 'back at pick', 45000).catch(() => {});
  const backCls = await evl(`document.getElementById('stage')?.className || ''`);
  check('A ESC returns from battle to Fighter Pick', backCls.includes('screen-fighter'), backCls.slice(0, 80));
  const pageBefore = (await evl(PAGER_STATE))?.page;
  await tapSel('.rosterPagerNext');
  st = await stableScroll();
  check('A pager still navigates after the battle round-trip', st && pageBefore != null && st.page === Math.min(pageBefore + 1, st.pages - 1),
    `before=${pageBefore} after=${st?.page}`);

  // ── B: phone portrait 430x932, Local 2P ──────────────────────────────────
  await setViewport(430, 932, true);
  await boot();
  await toPick('local');
  const orderB = await evl(ORDER);
  const nbPageB = Math.floor(orderB.indexOf('newbot') / 6);
  for (let i = 0; i < nbPageB; i++) { await tapSel('.rosterPagerNext'); await stableScroll(); }
  check('B Local P1 selects ROBOT from a later page', await tapCardVerified('newbot', 1));
  await tapSel('#lockIn');
  await waitFor(`(document.getElementById('stage')?.className||'').includes('fighter-active-p2')`, 'Local P2 phase', 20000).catch(() => {});
  // The clean profile only owns NEWBOT; SHURI and the other records stay
  // progression-locked. Verify P2's playable selection remains NEWBOT rather
  // than weakening unlock gates to satisfy a test fixture.
  check('B Local P2 can keep the unlocked NEWBOT selection', await tapCardVerified('newbot', 2));
  await shot('B-430-local-pick');
  await tapSel('#lockIn');
  await waitFor(`!!document.getElementById('hud') && document.getElementById('hud').dataset.mode==='2p'`, 'battle live (2p)', 60000).catch(() => {});
  check('B Local LOCK x2 enters the live battle (HUD mode 2p)', (await evl(`document.getElementById('hud')?.dataset.mode || null`)) === '2p');

  // ── C: phone landscape 932x430, BOT (compact-landscape paging) ───────────
  await setViewport(932, 430, true);
  await boot();
  await toPick('solo');
  const visC = await evl(VISIBLE);
  check('C landscape phone shows six fighters per view', visC.length === 6, visC.join(','));
  st = await tapChevronVerified(1);
  check('C landscape chevron pages by six', st && st.page === 1, `page=${st?.page}`);
  const lockClear = await overlapPx('.selectionDeckV6', '#lockIn');
  check('C deck never covers the LOCK mechanism', lockClear === 0, `overlapPx=${lockClear}`);
  const lockHit = await evl(`(()=>{ const l=document.getElementById('lockIn'); const r=l.getBoundingClientRect(); const e=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)); return !!(e && (e===l || l.contains(e))); })()`);
  check('C LOCK is the topmost hit target at its center', lockHit === true);
  await shot('C-932-land-page2');

  // ── D: tablet portrait 768x1024, BOT ─────────────────────────────────────
  await setViewport(768, 1024, true);
  await boot();
  await toPick('solo');
  const visD = await evl(VISIBLE);
  check('D tablet portrait pages 3x2 (six per view)', visD.length === 6, visD.join(','));
  check('D deck never covers the LOCK mechanism', (await overlapPx('.selectionDeckV6', '#lockIn')) === 0);
  check('D roster deck never covers the hero preview block', (await overlapPx('.selectionDeckV6 .roster', '#p1Side')) === 0);
  await shot('D-768-tablet');

  // ── E: desktop 1366x768 — canonical scrollport kept, cursor on-track ─────
  await setViewport(1366, 768, false);
  await boot();
  await toPick('solo');
  const deskChrome = await evl(`(()=>{ const p=document.querySelector('.apexRosterPager'); const b=document.querySelector('.rosterPagerNext'); return {pager:getComputedStyle(p).display, btn:getComputedStyle(b).display, meta:(document.querySelector('.selectionMeta')?.textContent||'').trim()}; })()`);
  check('E desktop keeps the canonical scrollport (pager chrome hidden)',
    deskChrome.pager === 'none' && deskChrome.btn === 'none', JSON.stringify(deskChrome));
  check('E roster metadata count is honest (14 fighters)', /^14 FIGHTERS/.test(deskChrome.meta), deskChrome.meta);
  const orderE = await evl(ORDER);
  const lastHero = orderE[13];
  await evl(`(()=>{ const c=document.querySelector('button.rosterCard[data-hero=${JSON.stringify(lastHero)}]'); c.scrollIntoView({block:'center',inline:'center'}); c.click(); return true; })()`);
  await sleep(900);
  const cur = await evl(`(()=>{ const cur=document.getElementById('selectionCursorV6'); const trk=cur?.parentElement; if(!cur||!trk) return null; const cr=cur.getBoundingClientRect(), tr=trk.getBoundingClientRect(); return {curL:Math.round(cr.left),curR:Math.round(cr.right),trkL:Math.round(tr.left),trkR:Math.round(tr.right),n:getComputedStyle(cur).getPropertyValue('--cursor-n').trim()}; })()`);
  check('E selection cursor stays on its track for the 14th fighter',
    !!cur && cur.curL >= cur.trkL - 1 && cur.curR <= cur.trkR + 1, JSON.stringify(cur));
  await shot('E-1366-desk');

  try { ws.close(); } catch {}
  chrome.kill('SIGKILL');
  console.log(`\nRESULT: ${failures.length === 0 ? 'PASS' : 'FAIL'} (${passes.length} pass, ${failures.length} fail)`);
  if (failures.length) process.exitCode = 1;
}
main().catch((e) => {
  console.error('GATE ERROR', e);
  try { chrome.kill('SIGKILL'); } catch {}
  console.log(`\nRESULT: FAIL (${passes.length} pass, ${failures.length + 1} fail)`);
  process.exitCode = 1;
});
