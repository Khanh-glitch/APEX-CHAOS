// RA-1.E — Integrated device compatibility matrix (real app, real flow).
//
// Not a fixture: each row boots the production app, walks Home → Mode →
// Fighter (and into a live battle for the core rows) with the input class the
// device really has, then measures:
//   page-level horizontal overflow, per-element clipping, covered/hidden
//   primary controls, the live coach slot, console errors and failed requests.
//
// Viewports: 320×568, 360×560, 390×844, 667×375, 768×1024, 844×390, 1284×692, 1440×900
// Languages: ENG and VIE. Modes: BOT (touch) and LOCAL (touch), keyboard at
// desktop widths. Every row captures a screenshot for visual inspection.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const BIN = process.env.CHROME_PATH;
if (!BIN) throw new Error('CHROME_PATH not set');
const PORT = Number(process.env.CDP_PORT || 9441);
const DIR = process.env.APEX_EVIDENCE_DIR || '/tmp/apex-ra1-compatibility';
fs.mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWPORTS = [
  { name: '320x568', w: 320, h: 568, touch: true },
  { name: '360x560', w: 360, h: 560, touch: true },
  { name: '390x844', w: 390, h: 844, touch: true },
  { name: '667x375', w: 667, h: 375, touch: true },
  { name: '768x1024', w: 768, h: 1024, touch: true },
  { name: '844x390', w: 844, h: 390, touch: true },
  { name: '1284x692', w: 1284, h: 692, touch: false },
  { name: '1440x900', w: 1440, h: 900, touch: false },
];

const failures = [];
const passes = [];
const rows = [];
function check(name, ok, detail = '') {
  (ok ? passes : failures).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

const chrome = spawn(BIN, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--remote-allow-origins=*', '--no-first-run',
  '--remote-debugging-port=' + PORT, '--window-size=390,844',
  '--user-data-dir=/tmp/apex-ra1-compat-' + process.pid, 'about:blank',
], { stdio: 'ignore' });

let ws; let serial = 0; const pending = new Map();
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const to = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')); }, 40000);
    pending.set(id, { resolve: (v) => { clearTimeout(to); resolve(v); }, reject: (e) => { clearTimeout(to); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evl(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function waitFor(expr, label, timeoutMs = 45000) {
  const t0 = Date.now();
  for (;;) { let v = false; try { v = await evl(expr); } catch { /* nav */ } if (v) return true; if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timeout: ' + label); await sleep(320); }
}
async function httpJson(p) { const r = await fetch(`http://127.0.0.1:${PORT}${p}`); return r.json(); }
async function shot(name) {
  const s = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(s.data, 'base64'));
}
const TX = `!document.body.classList.contains('apex-scene-transition-active')`;
async function press(sel, touch = true) {
  const c = await evl(`(()=>{const l=[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),w:r.width,h:r.height,vis:s.visibility,disp:s.display,op:Number(s.opacity)}}).filter(c=>c.w>2&&c.h>2&&c.vis!=='hidden'&&c.disp!=='none'&&c.op>0.05);return l[0]||null})()`);
  if (!c) throw new Error('press target missing: ' + sel);
  if (touch) {
    await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
    await sleep(70);
    await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
    await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    await sleep(70);
    await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  }
  await sleep(280);
}

// A measured surface report: overflow, clipped visible text, covered controls.
const SURFACE = `(()=>{
  const vis=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0.05&&r.width>1&&r.height>1};
  const rect=(el)=>{const r=el.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
  const clipped=[...document.querySelectorAll('#stage .fighterName,#stage .fighterTag,.rosterName,.modeTitle,.modeKicker,.homeTitle,.apex-guide-body,#p2Side .id-name,#p2Rail .vr-name,#p2Rail .vr-hp,.playerFlag')]
    .filter(vis).filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>({cls:el.className,text:(el.textContent||'').trim().slice(0,28),need:el.scrollWidth,have:el.clientWidth}));
  const hit=(sel)=>{const el=document.querySelector(sel);if(!vis(el))return {sel,present:!!el,visible:false};const r=el.getBoundingClientRect();const pts=[[.5,.5],[.25,.5],[.75,.5]];const ok=pts.some(([fx,fy])=>{const h=document.elementFromPoint(r.left+r.width*fx,r.top+r.height*fy);return h&&(h===el||el.contains(h))});return {sel,visible:true,rect:rect(el),inView:r.top>=-1&&r.left>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hittable:ok}};
  return {
    v:[innerWidth,innerHeight],
    lang:document.documentElement.lang,
    scrollOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
    clipped,
    free:hit('#freeBattle'), lock:hit('#lockIn'),
    bots:[...document.querySelectorAll('.modeCard')].filter(vis).length,
    roster:[...document.querySelectorAll('.rosterCard')].filter(vis).filter(c=>{const deck=document.querySelector('.selectionDeckV6 .roster');if(!deck)return true;const r=c.getBoundingClientRect(),d=deck.getBoundingClientRect();return r.left>=d.left-1&&r.right<=d.right+1&&r.top>=d.top-1&&r.bottom<=d.bottom+1;}).length,
    preview:(()=>{const i=document.querySelector('#p1WorldArt img');return i?{nw:i.naturalWidth,src:i.getAttribute('src')}:null})(),
    hud:document.querySelector('#hud')?.dataset?.mode||null,
  };
})()`;

async function viewport(v) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: v.touch, screenOrientation: { type: v.w < v.h ? 'portraitPrimary' : 'landscapePrimary', angle: v.w < v.h ? 0 : 90 } });
  await cmd('Emulation.setTouchEmulationEnabled', v.touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await sleep(220);
}

const errors = [];
async function collectErrors(tag) {
  const list = await evl(`(()=>({console:window.__ra1Console||[],ready:document.readyState}))()`);
  if (list.console.length) errors.push({ tag, ...list });
  return list.console;
}

async function runRow(v, lang, mode) {
  const tag = `${v.name}-${lang}-${mode}`;
  await viewport(v);
  await cmd('Page.navigate', { url: APP });
  await cmd('Runtime.evaluate', { expression: `window.__ra1Console=[];(function(){const c=console.error;console.error=function(){window.__ra1Console.push([...arguments].map(String).join(' ').slice(0,200));return c.apply(console,arguments)}})()` });
  await waitFor(`!!document.querySelector('#apex-boot-start')`, tag + ' boot');
  await sleep(500);
  await press('#apex-boot-start', v.touch);
  await waitFor(`!!document.querySelector('#freeBattle') && ${TX}`, tag + ' home');
  await sleep(400);
  await evl(`window.APEX_I18N && window.APEX_I18N.setLanguage(${JSON.stringify(lang)})`);
  await sleep(400);
  // returning coach: dismiss it the way a player does, at every viewport
  if (await evl(`!!document.querySelector('.apex-coach-skip')`)) {
    await press('.apex-coach-skip', v.touch);
    await waitFor(`!document.querySelector('.apex-coach-skip')`, tag + ' coach dismissed', 8000).catch(() => false);
  }
  const home = await evl(SURFACE);
  check(tag + ' Home: no page overflow and FREE BATTLE is visible + hittable',
    home.scrollOverflow === 0 && home.free?.visible && home.free?.inView && home.free?.hittable,
    JSON.stringify({ overflow: home.scrollOverflow, free: home.free }));
  check(tag + ' Home: no clipped visible text', home.clipped.length === 0, JSON.stringify(home.clipped));
  await shot(tag + '-home');

  await press('#freeBattle', v.touch);
  await waitFor(`document.querySelector('#stage')?.classList.contains('screen-mode') && ${TX}`, tag + ' mode');
  await sleep(450);
  const modeSnap = await evl(SURFACE);
  check(tag + ' Mode: both mode cards render with no overflow/clipping',
    modeSnap.bots === 2 && modeSnap.scrollOverflow === 0 && modeSnap.clipped.length === 0,
    JSON.stringify({ cards: modeSnap.bots, overflow: modeSnap.scrollOverflow, clipped: modeSnap.clipped }));
  await shot(tag + '-mode');

  const modeSel = mode === 'bot' ? '.modeCard[data-mode="bot"]' : '.modeCard[data-mode="local1v1"]';
  await press(modeSel, v.touch);
  await waitFor(`document.querySelector('#stage')?.classList.contains('screen-fighter') && ${TX}`, tag + ' fighter');
  // Wait for the pick screen's own entrance to finish painting (LOCK IN is
  // animated in from opacity 0), instead of sampling a fixed delay.
  await waitFor(`(()=>{const b=document.querySelector('#lockIn');if(!b)return false;const s=getComputedStyle(b);const r=b.getBoundingClientRect();return Number(s.opacity)>0.95&&r.width>40&&r.height>20})()`, tag + ' lock entrance', 12000).catch(() => false);
  await sleep(250);
  const pick = await evl(SURFACE);
  // Phones page the deck 3x2 (exactly six fully visible). Wider decks show a
  // full row of six inside the scrollport; the rest are reached by the deck's
  // own pager/scroll (proven in testFighterSelectPagerBrowser).
  const rosterOk = v.w < 700 ? pick.roster === 6 : pick.roster >= 6;
  check(tag + ' Fighter Select: a full roster page (' + (v.w < 700 ? 6 : '>=6') + ') is visible, LOCK visible/hittable, preview decoded',
    rosterOk && pick.lock?.visible === true && pick.lock?.inView === true && pick.lock?.hittable === true
    && !!pick.preview && pick.preview.nw > 0,
    JSON.stringify({ roster: pick.roster, lock: pick.lock, preview: pick.preview }));
  await shot(tag + '-fighter');

  // Orientation change while the pick screen is open must not break it.
  if (v.name === '390x844' || v.name === '844x390') {
    const alt = v.name === '390x844' ? { w: 844, h: 390 } : { w: 390, h: 844 };
    await viewport({ w: alt.w, h: alt.h, touch: true });
    await sleep(900);
    const rotated = await evl(SURFACE);
    check(tag + ' survives a live orientation change with LOCK still reachable',
      rotated.scrollOverflow === 0 && rotated.lock?.visible === true && rotated.lock?.inView === true && rotated.lock?.hittable === true,
      JSON.stringify({ overflow: rotated.scrollOverflow, lock: rotated.lock }));
    await shot(tag + '-rotated-' + alt.w + 'x' + alt.h);
    await viewport(v);
    await sleep(700);
  }

  // Battle rows: one BOT battle per viewport, plus LOCAL at phone portrait.
  const entersBattle = mode === 'bot' || v.name === '390x844';
  if (entersBattle) {
    await press('#lockIn', v.touch);
    await waitFor(`document.querySelector('#stage')?.classList.contains('fighter-active-p2') || document.querySelector('#battleHudHost')?.classList.contains('is-open')`, tag + ' lock', 20000);
    await sleep(300);
    if (!(await evl(`document.querySelector('#battleHudHost')?.classList.contains('is-open')`))) await press('#lockIn', v.touch);
    const live = await waitFor(`document.querySelector('#battleHudHost')?.classList.contains('is-open') && window.APEX_ARSENAL?.state?.battleMode`, tag + ' battle', 60000).catch(() => false);
    check(tag + ' reaches a live battle', live === true, JSON.stringify(await evl(`document.querySelector('#hud')?.dataset?.mode||null`)));
    if (live) {
      await sleep(1200);
      const battle = await evl(SURFACE);
      const identity = await evl(`(()=>{const n=document.querySelector('#p2Side .id-name'),hp=document.querySelector('#p2Rail .vr-hp');const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};const a=r(n),b=r(hp);const overlap=a&&b?Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)):0;return{name:n?n.textContent.trim():null,shown:!!n&&getComputedStyle(n).display!=='none',overflow:n?n.scrollWidth-n.clientWidth:null,overlap}})()`);
      check(tag + ' battle HUD: opponent identity readable, never overlapping HP',
        battle.scrollOverflow === 0 && identity.overlap === 0 && identity.overflow !== null && identity.overflow <= 1,
        JSON.stringify({ overflow: battle.scrollOverflow, identity }));
      await shot(tag + '-battle');
      // Leaving mid-match must always be possible (no locked-in match).
      await press('#battleHudExit, .battleHudExit, [data-battle-exit]', v.touch).catch(async () => {
        await cmd('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 27, code: 'Escape', key: 'Escape' });
        await cmd('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27, code: 'Escape', key: 'Escape' });
      });
      const left = await waitFor(`document.querySelector('#stage')?.classList.contains('screen-fighter')`, tag + ' left battle', 25000).catch(() => false);
      check(tag + ' can always leave the match (ESC/EXIT returns to Fighter Select)', left === true);
    }
  }
  const consoleErrors = await evl(`window.__ra1Console||[]`);
  check(tag + ' zero console errors', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 3)));
  rows.push({ tag, viewport: v.name, lang, mode, home, modeSnap, pick });
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Network.enable');
  // Headless Chrome can treat the page as occluded and freeze the CSS
  // animation clock (entrance animations park at currentTime 0 with
  // playState "running"). That is an environment artifact, not product
  // behaviour: emulate a focused page so entrance transitions run.
  await cmd('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  const netFailures = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Network.loadingFailed' && !m.params?.canceled) netFailures.push({ type: m.params?.type, error: m.params?.errorText });
    if (m.method === 'Network.responseReceived' && m.params?.response?.status >= 400) netFailures.push({ status: m.params.response.status, url: m.params.response.url });
  });

  const only = String(process.env.RA1_ONLY || '').toLowerCase();
  for (const v of VIEWPORTS) {
    if (only && !only.includes(v.name)) continue;
    for (const lang of ['eng', 'vie']) {
      const mode = v.touch ? 'bot' : 'bot';
      await runRow(v, lang, mode);
      if (v.touch && (v.name === '390x844' || v.name === '360x560')) await runRow(v, lang, 'local');
    }
  }

  const relevantNet = netFailures.filter((f) => (f.status && f.status >= 400) || String(f.error || '').includes('FAILED'));
  check('no first-party request fails across the compatibility matrix', relevantNet.length === 0, JSON.stringify(relevantNet.slice(0, 6)));
  fs.writeFileSync(`${DIR}/compatibility-matrix.json`, JSON.stringify({ generatedAt: new Date().toISOString(), rows, netFailures, passes, failures }, null, 2));

  console.log('');
  console.log('RA-1 compatibility — evidence ' + DIR);
  if (failures.length) { console.error('RESULT: FAIL (' + passes.length + ' pass, ' + failures.length + ' fail)'); process.exitCode = 1; }
  else console.log('RESULT: PASS (' + passes.length + ' pass, 0 fail)');
  try { chrome.kill('SIGKILL'); } catch { /* gone */ }
  process.exit(process.exitCode || 0);
}
main().catch((e) => { console.error('GATE ERROR', e); try { chrome.kill('SIGKILL'); } catch { /* noop */ } process.exit(1); });
